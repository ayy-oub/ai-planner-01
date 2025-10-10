import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { logger } from '../../shared/utils/logger';
import { AppError } from '../../shared/utils/errors';
import { tracingService } from '../monitoring/tracing';
import { circuitBreakers, CircuitState } from '../../shared/middleware/circuit-breaker.middleware';
import { config } from '../../shared/config';

interface CustomAxiosConfig extends AxiosRequestConfig {
    retryCount?: number;
    enableTracing?: boolean;
    sanitizeRequest?: boolean;
    sanitizeResponse?: boolean;
    circuitBreakerName?: keyof typeof circuitBreakers;
}

interface RetryConfig {
    maxRetries: number;
    retryDelay: number;
    retryCondition?: (error: AxiosError) => boolean;
}

class AxiosConfig {
    private static instance: AxiosConfig;
    private clients: Map<string, AxiosInstance> = new Map();

    private readonly defaultRetryConfig: RetryConfig = {
        maxRetries: 3,
        retryDelay: 1000,
        retryCondition: (error: AxiosError) => !error.response || error.response.status >= 500,
    };

    private constructor() {}

    static getInstance(): AxiosConfig {
        if (!AxiosConfig.instance) AxiosConfig.instance = new AxiosConfig();
        return AxiosConfig.instance;
    }

    createClient(name: string, baseConfig: CustomAxiosConfig = {}, retryConfig: Partial<RetryConfig> = {}): AxiosInstance {
        if (this.clients.has(name)) return this.clients.get(name)!;

        const finalRetryConfig = { ...this.defaultRetryConfig, ...retryConfig };
        const client = axios.create({
            timeout: 30000,
            headers: { 'Content-Type': 'application/json', 'User-Agent': `AI-Planner-API/${config.app.version}` },
            ...baseConfig,
        });

        client.interceptors.request.use(
            (cfg: InternalAxiosRequestConfig) => this.handleRequest(cfg, baseConfig),
            (err: AxiosError) => Promise.reject(err)
        );

        client.interceptors.response.use(
            (res: AxiosResponse) => this.handleResponse(res, baseConfig),
            (err: AxiosError) => this.handleResponseError(err, baseConfig, finalRetryConfig)
        );

        this.clients.set(name, client);
        logger.info(`Axios client '${name}' created successfully`);
        return client;
    }

    private handleRequest(config: InternalAxiosRequestConfig, customConfig: CustomAxiosConfig): InternalAxiosRequestConfig {
        if (customConfig.enableTracing !== false) tracingService.injectContextIntoHeaders(config.headers || {});

        if (customConfig.sanitizeRequest !== false && config.data && typeof config.data === 'object') {
            config.data = this.sanitizeData(config.data);
        }

        (config as any).metadata = { startTime: Date.now(), ...((config as any).metadata || {}) };

        logger.debug(`HTTP ${config.method?.toUpperCase()} ${config.url}`, {
            method: config.method,
            url: config.url,
            headers: this.sanitizeHeaders(config.headers),
        });

        return config;
    }

    private handleResponse(response: AxiosResponse, customConfig: CustomAxiosConfig): AxiosResponse {
        const startTime = (response.config as any)?.metadata?.startTime;
        if (startTime) {
            const duration = Date.now() - startTime;
            response.headers['x-response-time'] = `${duration}ms`;
        }

        if (customConfig.sanitizeResponse !== false && response.data && typeof response.data === 'object') {
            response.data = this.sanitizeData(response.data);
        }

        logger.debug(`HTTP ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
            status: response.status,
            responseTime: response.headers['x-response-time'],
        });

        return response;
    }

    private async handleResponseError(error: AxiosError, customConfig: CustomAxiosConfig, retryConfig: RetryConfig): Promise<any> {
        const config = error.config as CustomAxiosConfig;
        const retryCount = config.retryCount || 0;

        // Retry logic
        if (retryCount < retryConfig.maxRetries && retryConfig.retryCondition?.(error)) {
            config.retryCount = retryCount + 1;
            await this.delay(retryConfig.retryDelay * Math.pow(2, retryCount));
            return axios(config);
        }

        // Circuit breaker logic
        const breakerName = customConfig.circuitBreakerName;
        if (breakerName) {
            const breaker = circuitBreakers[breakerName];
            if (breaker.getState() === CircuitState.OPEN) {
                throw new AppError(`${breakerName} service is unavailable`, 503);
            }
        }

        // Log error and tracing
        this.logError(error);
        if (customConfig.enableTracing !== false) {
            tracingService.recordException(error);
        }

        return Promise.reject(new AppError(error.message, error.response?.status ?? 500));
    }

    private sanitizeData(data: any): any {
        if (typeof data !== 'object' || data === null) return data;

        const sanitized = { ...data };
        ['password', 'token', 'secret', 'apiKey', 'privateKey', 'auth', 'authorization', 'x-api-key', 'x-auth-token'].forEach(field => {
            if (sanitized[field]) sanitized[field] = '[REDACTED]';
        });

        return sanitized;
    }

    private sanitizeHeaders(headers: any): any {
        if (!headers) return headers;

        const sanitized = { ...headers };
        ['authorization', 'x-api-key', 'x-auth-token', 'cookie', 'set-cookie'].forEach(h => {
            if (sanitized[h]) sanitized[h] = '[REDACTED]';
        });

        return sanitized;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private logError(error: AxiosError): void {
        if (error.response) {
            logger.error('HTTP Response Error', {
                method: error.config?.method?.toUpperCase(),
                url: error.config?.url,
                status: error.response.status,
                data: error.response.data,
                headers: this.sanitizeHeaders(error.response.headers),
            });
        } else if (error.request) {
            logger.error('HTTP Request Error - No Response', {
                method: error.config?.method?.toUpperCase(),
                url: error.config?.url,
                message: error.message,
            });
        } else {
            logger.error('HTTP Request Setup Error', { message: error.message });
        }
    }

    getClient(name: string): AxiosInstance | undefined {
        return this.clients.get(name);
    }
}

export const axiosConfig = AxiosConfig.getInstance();
export default axiosConfig;

