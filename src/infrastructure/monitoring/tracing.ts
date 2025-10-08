import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { ZipkinExporter } from '@opentelemetry/exporter-zipkin';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { BatchSpanProcessor, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { trace, context, SpanStatusCode, SpanKind, Span, Context } from '@opentelemetry/api';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { config } from '../../shared/config';
import { logger } from '../../shared/utils/logger';

interface TracingConfig {
    serviceName: string;
    serviceVersion: string;
    environment: string;
    enabled: boolean;
    exporter: 'jaeger' | 'zipkin' | 'console' | 'none';
    endpoint?: string;
    samplingRate: number;
}

interface TraceContext {
    traceId: string;
    spanId: string;
    traceFlags: number;
}

class TracingService {
    private static instance: TracingService;
    private provider: NodeTracerProvider | null = null;
    private isInitialized = false;

    private constructor() {
        if (config.monitoring.tracing.enabled) {
            this.initializeTracing();
        }
    }

    static getInstance(): TracingService {
        if (!TracingService.instance) {
            TracingService.instance = new TracingService();
        }
        return TracingService.instance;
    }

    private initializeTracing(): void {
        try {
            const tracingConfig = config.monitoring.tracing;

            // Create resource
            const resource = new Resource({
                [SemanticResourceAttributes.SERVICE_NAME]: tracingConfig.serviceName,
                [SemanticResourceAttributes.SERVICE_VERSION]: tracingConfig.serviceVersion,
                [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: tracingConfig.environment,
            });

            // Create provider
            this.provider = new NodeTracerProvider({
                resource,
            });

            // Create exporter
            const exporter = this.createExporter(tracingConfig);

            if (exporter) {
                // Use BatchSpanProcessor for production, SimpleSpanProcessor for development
                const spanProcessor = config.app.env === 'production'
                    ? new BatchSpanProcessor(exporter)
                    : new SimpleSpanProcessor(exporter);

                this.provider.addSpanProcessor(spanProcessor);
            }

            // Register provider
            this.provider.register();

            // Register instrumentations
            this.registerInstrumentations();

            this.isInitialized = true;
            logger.info('Distributed tracing initialized successfully', {
                serviceName: tracingConfig.serviceName,
                exporter: tracingConfig.exporter,
                environment: tracingConfig.environment,
            });
        } catch (error) {
            logger.error('Failed to initialize distributed tracing:', error);
            throw error;
        }
    }

    private createExporter(tracingConfig: TracingConfig) {
        switch (tracingConfig.exporter) {
            case 'jaeger':
                return new JaegerExporter({
                    endpoint: tracingConfig.endpoint || 'http://localhost:14268/api/traces',
                });

            case 'zipkin':
                return new ZipkinExporter({
                    url: tracingConfig.endpoint || 'http://localhost:9411/api/v2/spans',
                });

            case 'console':
                return new ConsoleSpanExporter();

            case 'none':
            default:
                return null;
        }
    }

    private registerInstrumentations(): void {
        const instrumentations = [
            new HttpInstrumentation({
                requestHook: (span, request) => {
                    span.setAttribute('http.request.body', JSON.stringify(request.body));
                },
                responseHook: (span, response) => {
                    span.setAttribute('http.response.body', JSON.stringify(response.body));
                },
            }),
            new ExpressInstrumentation(),
            new RedisInstrumentation({
                dbStatementSerializer: (cmdName, cmdArgs) => {
                    // Sanitize Redis commands to avoid exposing sensitive data
                    if (cmdName.toLowerCase().includes('auth')) {
                        return `${cmdName} [REDACTED]`;
                    }
                    return `${cmdName} ${cmdArgs.join(' ')}`;
                },
            }),
        ];

        // Add MongoDB instrumentation if MongoDB is configured
        if (config.mongo.uri) {
            instrumentations.push(
                new MongoDBInstrumentation({
                    dbStatementSerializer: (operation, payload) => {
                        // Sanitize MongoDB operations
                        const sanitized = { ...payload };
                        if (sanitized.filter) {
                            sanitized.filter = this.sanitizeMongoData(sanitized.filter);
                        }
                        return JSON.stringify(sanitized);
                    },
                })
            );
        }

        registerInstrumentations({
            instrumentations,
        });
    }

    private sanitizeMongoData(data: any): any {
        if (typeof data !== 'object' || data === null) {
            return data;
        }

        const sanitized = { ...data };
        const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'privateKey'];

        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    // Create a new span
    createSpan(
        name: string,
        options: {
            kind?: SpanKind;
            attributes?: Record<string, any>;
            parentContext?: Context;
        } = {}
    ): Span {
        if (!this.isInitialized) {
            return this.createNoOpSpan();
        }

        const tracer = this.provider!.getTracer(config.monitoring.tracing.serviceName);

        const span = tracer.startSpan(name, {
            kind: options.kind || SpanKind.INTERNAL,
            attributes: options.attributes,
        }, options.parentContext);

        return span;
    }

    // Create a span with automatic context management
    withSpan<T>(
        name: string,
        options: {
            kind?: SpanKind;
            attributes?: Record<string, any>;
        },
        callback: (span: Span) => Promise<T>
    ): Promise<T> {
        if (!this.isInitialized) {
            return callback(this.createNoOpSpan());
        }

        const span = this.createSpan(name, options);

        return context.with(trace.setSpan(context.active(), span), async () => {
            try {
                const result = await callback(span);
                span.setStatus({ code: SpanStatusCode.OK });
                return result;
            } catch (error) {
                span.setStatus({
                    code: SpanStatusCode.ERROR,
                    message: error instanceof Error ? error.message : 'Unknown error',
                });
                span.recordException(error);
                throw error;
            } finally {
                span.end();
            }
        });
    }

    // Create a span for HTTP requests
    createHttpSpan(
        method: string,
        url: string,
        options: {
            target?: string;
            attributes?: Record<string, any>;
        } = {}
    ): Span {
        const span = this.createSpan(`${method} ${url}`, {
            kind: SpanKind.CLIENT,
            attributes: {
                'http.method': method,
                'http.url': url,
                'http.target': options.target || url,
                'http.host': new URL(url).host,
                'http.scheme': new URL(url).protocol.replace(':', ''),
                ...options.attributes,
            },
        });

        return span;
    }

    // Create a span for database operations
    createDatabaseSpan(
        operation: string,
        collection: string,
        attributes: Record<string, any> = {}
    ): Span {
        return this.createSpan(`db.${operation}`, {
            kind: SpanKind.CLIENT,
            attributes: {
                'db.system': 'firestore', // or 'mongodb', 'redis'
                'db.operation': operation,
                'db.collection': collection,
                ...attributes,
            },
        });
    }

    // Create a span for queue operations
    createQueueSpan(
        queueName: string,
        operation: string,
        jobId?: string,
        attributes: Record<string, any> = {}
    ): Span {
        return this.createSpan(`queue.${operation}`, {
            kind: SpanKind.PRODUCER,
            attributes: {
                'messaging.system': 'bullmq',
                'messaging.destination': queueName,
                'messaging.operation': operation,
                'messaging.message_id': jobId,
                ...attributes,
            },
        });
    }

    // Create a span for AI operations
    createAISpan(
        aiType: string,
        model?: string,
        attributes: Record<string, any> = {}
    ): Span {
        return this.createSpan(`ai.${aiType}`, {
            attributes: {
                'ai.type': aiType,
                'ai.model': model,
                'ai.system': 'openai', // or other AI provider
                ...attributes,
            },
        });
    }

    // Extract trace context from headers
    extractContextFromHeaders(headers: Record<string, string>): Context {
        if (!this.isInitialized) {
            return context.active();
        }

        // Simple W3C Trace Context extraction
        const traceParent = headers['traceparent'];
        if (traceParent) {
            try {
                const parts = traceParent.split('-');
                if (parts.length >= 3) {
                    const traceId = parts[1];
                    const spanId = parts[2];
                    const traceFlags = parseInt(parts[3], 16);

                    return trace.setSpanContext(context.active(), {
                        traceId,
                        spanId,
                        traceFlags,
                        isRemote: true,
                    });
                }
            } catch (error) {
                logger.warn('Failed to extract trace context from headers:', error);
            }
        }

        return context.active();
    }

    // Inject trace context into headers
    injectContextIntoHeaders(headers: Record<string, string>): void {
        if (!this.isInitialized) {
            return;
        }

        const spanContext = trace.getSpanContext(context.active());
        if (spanContext) {
            // Simple W3C Trace Context injection
            const traceParent = `00-${spanContext.traceId}-${spanContext.spanId}-0${spanContext.traceFlags.toString(16)}`;
            headers['traceparent'] = traceParent;
        }
    }

    // Get current trace context
    getCurrentTraceContext(): TraceContext | null {
        if (!this.isInitialized) {
            return null;
        }

        const spanContext = trace.getSpanContext(context.active());
        if (spanContext) {
            return {
                traceId: spanContext.traceId,
                spanId: spanContext.spanId,
                traceFlags: spanContext.traceFlags,
            };
        }

        return null;
    }

    // Add event to current span
    addEvent(name: string, attributes?: Record<string, any>): void {
        if (!this.isInitialized) {
            return;
        }

        const span = trace.getSpan(context.active());
        if (span) {
            span.addEvent(name, attributes);
        }
    }

    // Add attribute to current span
    setAttribute(key: string, value: any): void {
        if (!this.isInitialized) {
            return;
        }

        const span = trace.getSpan(context.active());
        if (span) {
            span.setAttribute(key, value);
        }
    }

    // Record exception in current span
    recordException(error: Error): void {
        if (!this.isInitialized) {
            return;
        }

        const span = trace.getSpan(context.active());
        if (span) {
            span.recordException(error);
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message,
            });
        }
    }

    // Create a no-op span for when tracing is disabled
    private createNoOpSpan(): Span {
        return {
            spanContext: () => ({
                traceId: '00000000000000000000000000000000',
                spanId: '0000000000000000',
                traceFlags: 0,
                isRemote: false,
            }),
            setAttribute: () => { },
            setAttributes: () => { },
            addEvent: () => { },
            setStatus: () => { },
            updateName: () => { },
            end: () => { },
            isRecording: () => false,
            recordException: () => { },
        } as Span;
    }

    // Shutdown tracing
    async shutdown(): Promise<void> {
        if (this.provider) {
            try {
                await this.provider.shutdown();
                this.isInitialized = false;
                logger.info('Distributed tracing shutdown successfully');
            } catch (error) {
                logger.error('Error shutting down distributed tracing:', error);
                throw error;
            }
        }
    }

    // Get tracing status
    get isTracingEnabled(): boolean {
        return this.isInitialized;
    }
}

// Export singleton instance
export const tracingService = TracingService.getInstance();
export default tracingService;

// Decorator for automatic span creation
export function Trace(options: {
    name?: string;
    kind?: SpanKind;
    attributes?: Record<string, any>;
} = {}) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const spanName = options.name || `${target.constructor.name}.${propertyKey}`;

            return tracingService.withSpan(
                spanName,
                {
                    kind: options.kind,
                    attributes: {
                        'code.function': propertyKey,
                        'code.class': target.constructor.name,
                        ...options.attributes,
                    },
                },
                async (span) => {
                    // Add method arguments as span attributes (be careful with sensitive data)
                    args.forEach((arg, index) => {
                        if (typeof arg === 'object' && arg !== null) {
                            span.setAttribute(`arg.${index}`, JSON.stringify(arg));
                        } else {
                            span.setAttribute(`arg.${index}`, arg);
                        }
                    });

                    return await originalMethod.apply(this, args);
                }
            );
        };

        return descriptor;
    };
}