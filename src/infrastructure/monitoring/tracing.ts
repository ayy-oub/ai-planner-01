/* ===================================================================
 * tracing.service.ts  –  OpenTelemetry 2.1  (bullmq-safe)
 * =================================================================== */
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  ConsoleSpanExporter,
  BatchSpanProcessor,
  SimpleSpanProcessor,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import {
  trace,
  context,
  SpanStatusCode,
  SpanKind,
  Span,
  Context,
  propagation,
} from '@opentelemetry/api';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';

import { monitoringConfig } from '../../shared/config/monitoring.config';
import { logger } from '../../shared/utils/logger';

/* ------------------------------------------------------------------ */
class TracingService {
  private static instance: TracingService;
  private provider: NodeTracerProvider | null = null;
  private isInitialized = false;

  private constructor() {
    if (monitoringConfig.tracing.enabled) this.initTracing();
  }

  static getInstance(): TracingService {
    if (!TracingService.instance) TracingService.instance = new TracingService();
    return TracingService.instance;
  }

  /* ---------------  init  ----------------------------------------- */
  private initTracing(): void {
    const cfg = monitoringConfig.tracing;

    const resource = resourceFromAttributes({
      'service.name': cfg.serviceName,
      'service.version': cfg.serviceVersion,
      'deployment.environment': cfg.environment,
    });

    const processors: SpanProcessor[] = [];
    const exporter = this.createExporter(cfg);
    if (exporter) {
      processors.push(
        process.env.NODE_ENV === 'production'
          ? new BatchSpanProcessor(exporter)
          : new SimpleSpanProcessor(exporter)
      );
    }

    // v2.x constructor signature
    this.provider = new NodeTracerProvider({
      resource,
      spanProcessors: processors,
    });

    this.provider.register();

    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation(),
        new ExpressInstrumentation(),
        new RedisInstrumentation(),
        ...(monitoringConfig.mongo?.uri ? [new MongoDBInstrumentation()] : []),
      ],
    });

    this.isInitialized = true;
    logger.info('Tracing initialized', {
      serviceName: cfg.serviceName,
      exporters: cfg.exporters,
    });
  }

  /* ---------------  exporter  ------------------------------------- */
  private createExporter(cfg: typeof monitoringConfig.tracing) {
    if (cfg.exporters.console) return new ConsoleSpanExporter();
    if (cfg.exporters.jaeger || cfg.exporters.zipkin)
      return new OTLPTraceExporter({
        url: cfg.endpoint || 'http://localhost:4318/v1/traces',
      });
    return null;
  }

  /* ---------------  span helpers  --------------------------------- */
  createSpan(
    name: string,
    options: {
      kind?: SpanKind;
      attributes?: Record<string, any>;
      parentContext?: Context;
    } = {}
  ): Span {
    if (!this.isInitialized) return this.noOpSpan();
    const tracer = trace.getTracer(monitoringConfig.tracing.serviceName);
    return tracer.startSpan(
      name,
      { kind: options.kind ?? SpanKind.INTERNAL, attributes: options.attributes },
      options.parentContext
    );
  }

  async withSpan<T>(
    name: string,
    options: { kind?: SpanKind; attributes?: Record<string, any> } = {},
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    const span = this.createSpan(name, options);
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err: any) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : 'Unknown',
        });
        span.recordException(err);
        throw err;
      } finally {
        span.end();
      }
    });
  }

  /* ---------------  shutdown  ------------------------------------- */
  async shutdown(): Promise<void> {
    if (this.provider) {
      await this.provider.shutdown();
      this.isInitialized = false;
      logger.info('Tracing shutdown');
    }
  }

  /* ---------------  no-op fall-back  ------------------------------ */
  private noOpSpan(): Span {
    return {
      spanContext: () => ({
        traceId: '0',
        spanId: '0',
        traceFlags: 0,
        isRemote: false,
      }),
      setAttribute: () => { },
      setAttributes: () => { },
      addEvent: () => { },
      addLink: () => { },
      setStatus: () => { },
      updateName: () => { },
      end: () => { },
      isRecording: () => false,
      recordException: () => { },
    } as unknown as Span;
  }

  recordException(err: any, span?: Span): void {
    if (!span) span = trace.getSpan(context.active());
    if (span) span.recordException(err);
  }

  injectContextIntoHeaders(headers: Record<string, string>): void {
    const ctx = context.active();
    propagation.inject(ctx, headers);
  }
}

/* ------------------------------------------------------------------ */
export const tracingService = TracingService.getInstance();
export default tracingService;