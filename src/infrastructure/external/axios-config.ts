import axios, {
    AxiosInstance,
    AxiosRequestConfig,
    AxiosResponse,
    AxiosError,
    InternalAxiosRequestConfig
} from 'axios';
import { config } from '../../shared/config';
import { logger } from '../../shared/utils/logger';
import { AppError } from '../../shared/utils/errors';
import { tracingService } from '../monitoring/tracing';
import { circuitBreaker } from '../../shared/utils/circuit-breaker';
import CircuitBreaker from 'opossum';

// Custom configuration interface
interface CustomAxiosConfig extends AxiosRequestConfig {
    retryCount?: number;
    retryDelay?: number;
    enableCircuitBreaker?: boolean;
    enableTracing?: boolean;
    sanitizeRequest?: boolean;
    sanitizeResponse?: boolean;
}

interface RetryConfig {
    maxRetries: number;
    retryDelay: number;
    retryCondition?: (error: AxiosError) => boolean;
}

class AxiosConfig {
    private static instance: AxiosConfig;
    private clients: Map<string, AxiosInstance> = new Map();
    private circuitBreakers: Map<string, CircuitBreaker> = new Map();

    private readonly defaultRetryConfig: RetryConfig = {
        maxRetries: 3,
        retryDelay: 1000,
        retryCondition: (error: AxiosError) => {
            // Retry on network errors or 5xx errors
            return !error.response || error.response.status >= 500;
        },
    };

    private constructor() { }

    static getInstance(): AxiosConfig {
        if (!AxiosConfig.instance) {
            AxiosConfig.instance = new AxiosConfig();
        }
        return AxiosConfig.instance;
    }

    createClient(
        name: string,
        baseConfig: CustomAxiosConfig = {},
        retryConfig: Partial<RetryConfig> = {}
    ): AxiosInstance {
        if (this.clients.has(name)) {
            logger.warn(`Axios client '${name}' already exists, returning existing instance`);
            return this.clients.get(name)!;
        }

        const finalRetryConfig = { ...this.defaultRetryConfig, ...retryConfig };

        const client = axios.create({
            timeout: 30000, // 30 seconds default
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': `AI-Planner-API/${config.app.version}`,
            },
            ...baseConfig,
        });

        // Request interceptor
        client.interceptors.request.use(
            (config: InternalAxiosRequestConfig) => this.handleRequest(config, baseConfig),
            (error: AxiosError) => this.handleRequestError(error)
        );

        // Response interceptor
        client.interceptors.response.use(
            (response: AxiosResponse) => this.handleResponse(response, baseConfig),
            (error: AxiosError) => this.handleResponseError(error, baseConfig, finalRetryConfig)
        );

        // Circuit breaker setup
        if (baseConfig.enableCircuitBreaker !== false) {
            this.setupCircuitBreaker(name, client, baseConfig);
        }

        this.clients.set(name, client);
        logger.info(`Axios client '${name}' created successfully`);

        return client;
    }

    private async handleRequest(
        config: InternalAxiosRequestConfig,
        customConfig: CustomAxiosConfig
    ): Promise<InternalAxiosRequestConfig> {
        try {
            // Add tracing headers if enabled
            if (customConfig.enableTracing !== false) {
                tracingService.injectContextIntoHeaders(config.headers || {});
            }

            // Add authentication headers if needed
            if (config.url?.includes('api.github.com')) {
                if (config.githubToken) {
                    config.headers = {
                        ...config.headers,
                        'Authorization': `token ${config.githubToken}`,
                    };
                }
            }

            // Sanitize request data if enabled
            if (customConfig.sanitizeRequest !== false) {
                if (config.data && typeof config.data === 'object') {
                    config.data = this.sanitizeData(config.data);
                }
            }

            // Add request timestamp for latency calculation
            (config as any).metadata = {
                startTime: Date.now(),
                ...((config as any).metadata || {}),
            };

            logger.debug(`HTTP ${config.method?.toUpperCase()} ${config.url}`, {
                method: config.method,
                url: config.url,
                headers: this.sanitizeHeaders(config.headers),
            });

            return config;
        } catch (error) {
            logger.error('Request interceptor error:', error);
            return config;
        }
    }

    private handleRequestError(error: AxiosError): Promise<AxiosError> {
        logger.error('Request configuration error:', error);
        return Promise.reject(error);
    }

    private handleResponse(
        response: AxiosResponse,
        customConfig: CustomAxiosConfig
    ): AxiosResponse {
        try {
            // Calculate response time
            const startTime = (response.config as any).metadata?.startTime;
            if (startTime) {
                const responseTime = Date.now() - startTime;
                response.headers['x-response-time'] = `${responseTime}ms`;

                // Record metrics
                if (customConfig.enableTracing !== false) {
                    tracingService.addEvent('http.response', {
                        'http.status_code': response.status,
                        'http.response_time': responseTime,
                    });
                }
            }

            // Sanitize response data if enabled
            if (customConfig.sanitizeResponse !== false) {
                if (response.data && typeof response.data === 'object') {
                    response.data = this.sanitizeData(response.data);
                }
            }

            logger.debug(`HTTP ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
                status: response.status,
                statusText: response.statusText,
                responseTime: response.headers['x-response-time'],
            });

            return response;
        } catch (error) {
            logger.error('Response interceptor error:', error);
            return response;
        }
    }

    private async handleResponseError(
        error: AxiosError,
        customConfig: CustomAxiosConfig,
        retryConfig: RetryConfig
    ): Promise<AxiosResponse> {
        const config = error.config as CustomAxiosConfig;
        const currentRetryCount = config.retryCount || 0;

        // Check if we should retry
        if (currentRetryCount < retryConfig.maxRetries &&
            retryConfig.retryCondition?.(error)) {

            config.retryCount = currentRetryCount + 1;

            logger.warn(`Retrying request ${config.method?.toUpperCase()} ${config.url} (attempt ${config.retryCount}/${retryConfig.maxRetries})`);

            // Calculate delay with exponential backoff
            const delay = retryConfig.retryDelay * Math.pow(2, currentRetryCount);

            // Wait before retrying
            await this.delay(delay);

            // Retry the request
            return axios(config);
        }

        // Log error details
        this.logError(error);

        // Record tracing error
        if (customConfig.enableTracing !== false) {
            tracingService.recordException(this.createAppError(error));
        }

        // Transform to AppError
        const appError = this.createAppError(error);
        return Promise.reject(appError);
    }

    private setupCircuitBreaker(
        name: string,
        client: AxiosInstance,
        config: CustomAxiosConfig
    ): void {
        const breaker = new CircuitBreaker(
            async (requestConfig: AxiosRequestConfig) => {
                return await client.request(requestConfig);
            },
            {
                timeout: 30000,
                errorThresholdPercentage: 50,
                resetTimeout: 30000,
                volumeThreshold: 10,
            }
        );

        // Circuit breaker event handlers
        breaker.on('open', () => {
            logger.warn(`Circuit breaker '${name}' is now OPEN`);
        });

        breaker.on('halfOpen', () => {
            logger.info(`Circuit breaker '${name}' is now HALF_OPEN`);
        });

        breaker.on('close', () => {
            logger.info(`Circuit breaker '${name}' is now CLOSED`);
        });

        breaker.on('fire', () => {
            logger.debug(`Circuit breaker '${name}' fired`);
        });

        this.circuitBreakers.set(name, breaker);

        // Override the client's request method to use circuit breaker
        const originalRequest = client.request.bind(client);
        client.request = async (config: AxiosRequestConfig) => {
            const breaker = this.circuitBreakers.get(name);
            if (breaker && breaker.opened) {
                throw new AppError(`Circuit breaker '${name}' is OPEN`, 503);
            }
            return originalRequest(config);
        };
    }

    private createAppError(error: AxiosError): AppError {
        if (error.response) {
            // Server responded with error status
            const status = error.response.status;
            const message = (error.response.data as any)?.message || error.message;
            const code = (error.response.data as any)?.code || 'HTTP_ERROR';

            return new AppError(message, status, code);
        } else if (error.request) {
            // Request made but no response received
            return new AppError('No response received from external service', 503, 'NO_RESPONSE');
        } else {
            // Request setup error
            return new AppError(error.message, 500, 'REQUEST_SETUP_ERROR');
        }
    }

    private logError(error: AxiosError): void {
        if (error.response) {
            logger.error('HTTP Response Error', {
                method: error.config?.method?.toUpperCase(),
                url: error.config?.url,
                status: error.response.status,
                statusText: error.response.statusText,
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
            logger.error('HTTP Request Setup Error', {
                message: error.message,
                stack: error.stack,
            });
        }
    }

    private sanitizeData(data: any): any {
        if (typeof data !== 'object' || data === null) {
            return data;
        }

        const sanitized = { ...data };
        const sensitiveFields = [
            'password', 'token', 'secret', 'apiKey', 'privateKey',
            'auth', 'authorization', 'x-api-key', 'x-auth-token'
        ];

        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    private sanitizeHeaders(headers: any): any {
        if (!headers) return headers;

        const sanitized = { ...headers };
        const sensitiveHeaders = [
            'authorization', 'x-api-key', 'x-auth-token', 'cookie', 'set-cookie'
        ];

        sensitiveHeaders.forEach(header => {
            if (sanitized[header]) {
                sanitized[header] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get client by name
    getClient(name: string): AxiosInstance | undefined {
        return this.clients.get(name);
    }

    // Get all client names
    getClientNames(): string[] {
        return Array.from(this.clients.keys());
    }

    // Remove client
    removeClient(name: string): boolean {
        const client = this.clients.get(name);
        if (client) {
            this.clients.delete(name);
            this.circuitBreakers.delete(name);
            logger.info(`Axios client '${name}' removed`);
            return true;
        }
        return false;
    }

    // Close all clients
    async closeAllClients(): Promise<void> {
        const closePromises = Array.from(this.clients.keys()).map(name => this.removeClient(name));
        await Promise.all(closePromises);
        logger.info('All Axios clients closed');
    }

    // Get circuit breaker status
    getCircuitBreakerStatus(name: string): any {
        const breaker = this.circuitBreakers.get(name);
        if (!breaker) return null;

        return {
            name,
            status: breaker.opened ? 'OPEN' : breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
            stats: breaker.stats,
        };
    }

    // Health check for all clients
    async healthCheck(): Promise<Record<string, boolean>> {
        const health: Record<string, boolean> = {};

        for (const [name, client] of this.clients) {
            try {
                // Simple health check - you can customize this
                await client.get('/health');
                health[name] = true;
            } catch (error) {
                health[name] = false;
            }
        }

        return health;
    }
}

// Export singleton instance
export const axiosConfig = AxiosConfig.getInstance();
export default axiosConfig;

// Pre-configured clients for common services
export const createGitHubClient = (token?: string) => {
    return axiosConfig.createClient('github', {
        baseURL: 'https://api.github.com',
        timeout: 10000,
        githubToken: token,
    });
};

export const createOpenAIClient = (apiKey: string) => {
    return axiosConfig.createClient('openai', {
        baseURL: 'https://api.openai.com/v1',
        timeout: 30000,
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
    });
};

export const createGoogleCalendarClient = (accessToken: string) => {
    return axiosConfig.createClient('google-calendar', {
        baseURL: 'https://www.googleapis.com/calendar/v3',
        timeout: 15000,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });
};

export const createSendGridClient = (apiKey: string) => {
    return axiosConfig.createClient('sendgrid', {
        baseURL: 'https://api.sendgrid.com/v3',
        timeout: 10000,
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
    });
};