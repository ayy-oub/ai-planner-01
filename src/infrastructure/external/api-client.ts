import { axiosConfig } from './axios-config';
import { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../../shared/utils/logger';
import { AppError } from '../../shared/utils/errors';
import { tracingService } from '../monitoring/tracing';
import { metricsCollector } from '../monitoring/metrics';

// Base API Client interface
interface IApiClient {
    get<T>(path: string, params?: any, headers?: any): Promise<T>;
    post<T>(path: string, data?: any, headers?: any): Promise<T>;
    put<T>(path: string, data?: any, headers?: any): Promise<T>;
    patch<T>(path: string, data?: any, headers?: any): Promise<T>;
    delete<T>(path: string, headers?: any): Promise<T>;
    healthCheck(): Promise<boolean>;
}

// Base API Client class
abstract class BaseApiClient implements IApiClient {
    protected client: AxiosInstance;
    protected serviceName: string;

    constructor(serviceName: string, client: AxiosInstance) {
        this.serviceName = serviceName;
        this.client = client;
    }

    async get<T>(path: string, params?: any, headers?: any): Promise<T> {
        return this.executeRequest<T>('GET', path, { params, headers });
    }

    async post<T>(path: string, data?: any, headers?: any): Promise<T> {
        return this.executeRequest<T>('POST', path, { data, headers });
    }

    async put<T>(path: string, data?: any, headers?: any): Promise<T> {
        return this.executeRequest<T>('PUT', path, { data, headers });
    }

    async patch<T>(path: string, data?: any, headers?: any): Promise<T> {
        return this.executeRequest<T>('PATCH', path, { data, headers });
    }

    async delete<T>(path: string, headers?: any): Promise<T> {
        return this.executeRequest<T>('DELETE', path, { headers });
    }

    protected async executeRequest<T>(
        method: string,
        path: string,
        options: any = {}
    ): Promise<T> {
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
                try {
                    const startTime = Date.now();

                    const response = await this.client.request({
                        method,
                        url: path,
                        ...options,
                    });

                    const duration = Date.now() - startTime;

                    // Record metrics
                    metricsCollector.recordApiPerformance(
                        method,
                        path,
                        response.status,
                        duration,
                        response.headers['user-agent'],
                        response.headers['x-forwarded-for'] as string
                    );

                    span.setAttributes({
                        'http.status_code': response.status,
                        'http.response_time': duration,
                    });

                    logger.debug(`${this.serviceName} API request completed`, {
                        method,
                        path,
                        status: response.status,
                        duration: `${duration}ms`,
                    });

                    return response.data;
                } catch (error) {
                    span.recordException(error);
                    throw error;
                }
            }
        );
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.get('/health');
            return true;
        } catch (error) {
            logger.warn(`${this.serviceName} health check failed`, { error });
            return false;
        }
    }
}