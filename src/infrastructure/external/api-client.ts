import { AxiosInstance } from 'axios';
import { axiosConfig } from './axios-config';
import { AppError } from '../../shared/utils/errors';
import { tracingService } from '../monitoring/tracing';
import { metricsCollector } from '../monitoring/metrics';
import { circuitBreakers, CircuitBreaker } from '../../shared/middleware/circuit-breaker.middleware';

/**
 * Base API Client interface
 */
interface IApiClient {
    get<T>(path: string, params?: any, headers?: any): Promise<T>;
    post<T>(path: string, data?: any, headers?: any): Promise<T>;
    put<T>(path: string, data?: any, headers?: any): Promise<T>;
    patch<T>(path: string, data?: any, headers?: any): Promise<T>;
    delete<T>(path: string, headers?: any): Promise<T>;
    healthCheck(): Promise<boolean>;
}

/**
 * Base API Client
 * Provides:
 * - Axios singleton from axiosConfig
 * - Circuit breaker protection
 * - Tracing and metrics
 * - Unified error handling
 */
export class BaseApiClient implements IApiClient {
    protected client: AxiosInstance;
    protected serviceName: string;
    protected circuitBreaker?: CircuitBreaker;

    constructor(serviceName: keyof typeof circuitBreakers, client?: AxiosInstance, useCircuitBreaker: boolean = true) {
        this.serviceName = serviceName;
        this.client = client || axiosConfig.getClient(serviceName) || axiosConfig.createClient(serviceName);

        if (useCircuitBreaker && circuitBreakers[serviceName]) {
            this.circuitBreaker = circuitBreakers[serviceName];
        }
    }

    async get<T>(path: string, params?: any, headers?: any): Promise<T> {
        return this.request<T>('GET', path, { params, headers });
    }

    async post<T>(path: string, data?: any, headers?: any): Promise<T> {
        return this.request<T>('POST', path, { data, headers });
    }

    async put<T>(path: string, data?: any, headers?: any): Promise<T> {
        return this.request<T>('PUT', path, { data, headers });
    }

    async patch<T>(path: string, data?: any, headers?: any): Promise<T> {
        return this.request<T>('PATCH', path, { data, headers });
    }

    async delete<T>(path: string, headers?: any): Promise<T> {
        return this.request<T>('DELETE', path, { headers });
    }

    /**
     * Core request execution with:
     * - Circuit breaker
     * - Tracing
     * - Metrics
     * - Unified AppError handling
     */
    private async request<T>(method: string, path: string, options: any = {}): Promise<T> {
        const execute = async () => {
            return tracingService.withSpan(
                `${this.serviceName}.http`,
                {
                    kind: 2, // SpanKind.CLIENT
                    attributes: {
                        'http.method': method,
                        'http.url': path,
                        'peer.service': this.serviceName,
                    },
                },
                async (span) => {
                    const startTime = Date.now();
                    try {
                        const response = await this.client.request({
                            method,
                            url: path,
                            ...options,
                        });

                        const duration = Date.now() - startTime;

                        // Metrics
                        metricsCollector.recordApiPerformance(
                            method,
                            path,
                            response.status,
                            duration,
                            response.headers['user-agent'] || '',
                            response.headers['x-forwarded-for'] || ''
                        );

                        span.setAttributes({
                            'http.status_code': response.status,
                            'http.response_time': duration,
                        });

                        return response.data;
                    } catch (error: any) {
                        span.recordException(error);
                        metricsCollector.recordApiPerformance(
                            method,
                            path,
                            error.response?.status || 500,
                            Date.now() - startTime,
                            error.config?.headers?.['User-Agent'] || '',
                            error.config?.headers?.['X-Forwarded-For'] || ''
                        );
                        throw this.toAppError(error);
                    }
                }
            );
        };

        if (this.circuitBreaker) {
            return this.circuitBreaker.execute(execute);
        } else {
            return execute();
        }
    }

    /**
     * Transform Axios errors into AppError
     */
    private toAppError(error: any): AppError {
        if (error.response) {
            return new AppError(
                (error.response.data?.message || error.message) as string,
                error.response.status,
                (error.response.data?.code || 'HTTP_ERROR') as string
            );
        } else if (error.request) {
            return new AppError('No response received from external service', 503, 'NO_RESPONSE');
        } else {
            return new AppError(error.message, 500, 'REQUEST_SETUP_ERROR');
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<boolean> {
        try {
            const startTime = Date.now();
            await this.get('/health');
            const duration = Date.now() - startTime;

            metricsCollector.recordApiPerformance('GET', '/health', 200, duration);
            return true;
        } catch (error: any) {
            metricsCollector.recordApiPerformance('GET', '/health', error.response?.status || 500, 0);
            return false;
        }
    }
}
