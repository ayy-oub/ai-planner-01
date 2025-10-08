import { ExternalService } from '../../../../src/modules/external/external.service';
import { ExternalRepository } from '../../../../src/modules/external/external.repository';
import { CacheService } from '../../../../src/shared/services/cache.service';
import { EventEmitter } from '../../../../src/shared/services/event-emitter.service';
import { AppError } from '../../../../src/shared/utils/errors';
import { WebhookEvent, ExternalProvider } from '../../../../src/shared/types/external.types';

jest.mock('../../../../src/modules/external/external.repository');
jest.mock('../../../../src/shared/services/cache.service');
jest.mock('../../../../src/shared/services/event-emitter.service');

describe('ExternalService', () => {
    let externalService: ExternalService;
    let externalRepository: jest.Mocked<ExternalRepository>;
    let cacheService: jest.Mocked<CacheService>;
    let eventEmitter: jest.Mocked<EventEmitter>;

    const userId = 'test-user-id';

    beforeEach(() => {
        externalRepository = new ExternalRepository() as jest.Mocked<ExternalRepository>;
        cacheService = new CacheService() as jest.Mocked<CacheService>;
        eventEmitter = new EventEmitter() as jest.Mocked<EventEmitter>;

        externalService = new ExternalService(externalRepository, cacheService, eventEmitter);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('registerWebhook', () => {
        const webhookData = {
            url: 'https://example.com/webhook',
            events: ['planner.created', 'task.completed'],
            secret: 'webhook-secret-123',
            active: true
        };

        it('should successfully register webhook', async () => {
            const mockWebhook = {
                id: 'webhook-123',
                userId,
                ...webhookData,
                createdAt: new Date()
            };

            externalRepository.createWebhook.mockResolvedValue(mockWebhook);
            externalRepository.validateWebhookUrl.mockResolvedValue(true);
            cacheService.set.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await externalService.registerWebhook(userId, webhookData);

            expect(externalRepository.createWebhook).toHaveBeenCalledWith(userId, webhookData);
            expect(externalRepository.validateWebhookUrl).toHaveBeenCalledWith(webhookData.url);
            expect(cacheService.set).toHaveBeenCalledWith(
                `webhook:${result.id}`,
                JSON.stringify(result),
                3600
            );
            expect(result).toEqual(mockWebhook);
        });

        it('should validate webhook URL', async () => {
            externalRepository.validateWebhookUrl.mockResolvedValue(false);

            await expect(externalService.registerWebhook(userId, webhookData))
                .rejects.toThrow('Invalid webhook URL');
        });

        it('should validate webhook events', async () => {
            const invalidData = {
                ...webhookData,
                events: ['invalid-event', 'another-invalid']
            };

            await expect(externalService.registerWebhook(userId, invalidData))
                .rejects.toThrow('Invalid webhook events');
        });

        it('should handle duplicate webhooks', async () => {
            externalRepository.findWebhookByUrl.mockResolvedValue({
                id: 'existing-webhook',
                url: webhookData.url,
                userId
            });

            await expect(externalService.registerWebhook(userId, webhookData))
                .rejects.toThrow('Webhook already registered');
        });

        it('should encrypt webhook secret', async () => {
            externalRepository.createWebhook.mockResolvedValue({
                id: 'webhook-123',
                userId,
                ...webhookData
            });
            externalRepository.validateWebhookUrl.mockResolvedValue(true);

            const result = await externalService.registerWebhook(userId, webhookData);

            expect(externalRepository.createWebhook).toHaveBeenCalledWith(
                userId,
                expect.objectContaining({
                    secret: expect.not.stringMatching(webhookData.secret)
                })
            );
        });
    });

    describe('handleWebhookEvent', () => {
        const webhookEvent = {
            webhookId: 'webhook-123',
            event: 'planner.created' as WebhookEvent,
            data: {
                plannerId: 'planner-456',
                userId: 'user-789',
                title: 'New Planner'
            },
            timestamp: new Date()
        };

        it('should successfully handle webhook event', async () => {
            const mockWebhook = {
                id: 'webhook-123',
                url: 'https://example.com/webhook',
                secret: 'encrypted-secret',
                active: true,
                events: ['planner.created']
            };

            externalRepository.findWebhookById.mockResolvedValue(mockWebhook);
            externalRepository.logWebhookEvent.mockResolvedValue();
            jest.spyOn(externalService as any, 'sendWebhookRequest').mockResolvedValue({ status: 200 });
            eventEmitter.emit.mockReturnValue();

            const result = await externalService.handleWebhookEvent(webhookEvent);

            expect(externalRepository.findWebhookById).toHaveBeenCalledWith(webhookEvent.webhookId);
            expect(externalRepository.logWebhookEvent).toHaveBeenCalledWith(webhookEvent);
            expect(result).toBe(true);
        });

        it('should skip inactive webhooks', async () => {
            const inactiveWebhook = {
                id: 'webhook-123',
                active: false
            };

            externalRepository.findWebhookById.mockResolvedValue(inactiveWebhook);

            const result = await externalService.handleWebhookEvent(webhookEvent);

            expect(result).toBe(false);
            expect(externalRepository.logWebhookEvent).not.toHaveBeenCalled();
        });

        it('should validate webhook event type', async () => {
            const invalidEvent = {
                ...webhookEvent,
                event: 'invalid-event' as WebhookEvent
            };

            const mockWebhook = {
                id: 'webhook-123',
                events: ['planner.created']
            };

            externalRepository.findWebhookById.mockResolvedValue(mockWebhook);

            const result = await externalService.handleWebhookEvent(invalidEvent);

            expect(result).toBe(false);
        });

        it('should retry failed webhook deliveries', async () => {
            const mockWebhook = {
                id: 'webhook-123',
                url: 'https://example.com/webhook',
                active: true,
                events: ['planner.created'],
                retryConfig: { maxRetries: 3, retryDelay: 1000 }
            };

            externalRepository.findWebhookById.mockResolvedValue(mockWebhook);
            jest.spyOn(externalService as any, 'sendWebhookRequest')
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Timeout'))
                .mockResolvedValueOnce({ status: 200 });

            const retrySpy = jest.spyOn(externalService as any, 'scheduleRetry');

            const result = await externalService.handleWebhookEvent(webhookEvent);

            expect(retrySpy).toHaveBeenCalledTimes(2);
            expect(result).toBe(true);
        });

        it('should handle webhook delivery failures', async () => {
            const mockWebhook = {
                id: 'webhook-123',
                url: 'https://example.com/webhook',
                active: true,
                events: ['planner.created']
            };

            externalRepository.findWebhookById.mockResolvedValue(mockWebhook);
            jest.spyOn(externalService as any, 'sendWebhookRequest').mockRejectedValue(
                new Error('Webhook endpoint unreachable')
            );

            await expect(externalService.handleWebhookEvent(webhookEvent))
                .rejects.toThrow('Webhook delivery failed');
        });
    });

    describe('processExternalIntegration', () => {
        const integrationData = {
            provider: ExternalProvider.ZAPIER,
            action: 'create_task',
            data: {
                title: 'New Task from Zapier',
                description: 'Task created via Zapier integration',
                dueDate: '2024-01-15'
            },
            userId: 'user-123'
        };

        it('should successfully process external integration', async () => {
            const mockIntegration = {
                id: 'integration-456',
                provider: integrationData.provider,
                userId: integrationData.userId,
                status: 'active',
                config: { apiKey: 'encrypted-key' }
            };

            externalRepository.findIntegration.mockResolvedValue(mockIntegration);
            externalRepository.validateIntegration.mockResolvedValue(true);
            externalRepository.logIntegrationEvent.mockResolvedValue();
            jest.spyOn(externalService as any, 'executeIntegrationAction').mockResolvedValue({
                success: true,
                result: { taskId: 'task-789' }
            });
            eventEmitter.emit.mockReturnValue();

            const result = await externalService.processExternalIntegration(integrationData);

            expect(externalRepository.findIntegration).toHaveBeenCalledWith(
                integrationData.userId,
                integrationData.provider
            );
            expect(externalRepository.validateIntegration).toHaveBeenCalledWith(mockIntegration);
            expect(result.success).toBe(true);
            expect(result.result).toHaveProperty('taskId');
        });

        it('should validate integration status', async () => {
            const inactiveIntegration = {
                id: 'integration-456',
                status: 'inactive'
            };

            externalRepository.findIntegration.mockResolvedValue(inactiveIntegration);

            await expect(externalService.processExternalIntegration(integrationData))
                .rejects.toThrow('Integration is not active');
        });

        it('should handle rate limiting for integrations', async () => {
            const mockIntegration = {
                id: 'integration-456',
                provider: integrationData.provider,
                userId: integrationData.userId,
                status: 'active',
                rateLimit: { requestsPerHour: 100, currentCount: 100 }
            };

            externalRepository.findIntegration.mockResolvedValue(mockIntegration);

            await expect(externalService.processExternalIntegration(integrationData))
                .rejects.toThrow('Rate limit exceeded for this integration');
        });

        it('should validate required integration data', async () => {
            const incompleteData = {
                provider: ExternalProvider.ZAPIER,
                action: 'create_task'
                // Missing required data
            };

            await expect(externalService.processExternalIntegration(incompleteData))
                .rejects.toThrow('Missing required integration data');
        });

        it('should handle integration-specific validation', async () => {
            const mockIntegration = {
                id: 'integration-456',
                provider: integrationData.provider,
                userId: integrationData.userId,
                status: 'active',
                config: { apiKey: 'encrypted-key' }
            };

            externalRepository.findIntegration.mockResolvedValue(mockIntegration);
            externalRepository.validateIntegration.mockRejectedValue(
                new Error('Invalid API configuration')
            );

            await expect(externalService.processExternalIntegration(integrationData))
                .rejects.toThrow('Integration validation failed');
        });
    });

    describe('getIntegrationStatus', () => {
        it('should return integration status', async () => {
            const mockIntegrations = [
                {
                    id: 'integration-1',
                    provider: ExternalProvider.ZAPIER,
                    status: 'active',
                    lastUsed: new Date(),
                    stats: { requests: 150, errors: 2 }
                },
                {
                    id: 'integration-2',
                    provider: ExternalProvider.MAKE,
                    status: 'inactive',
                    lastUsed: null,
                    stats: { requests: 0, errors: 0 }
                }
            ];

            externalRepository.getUserIntegrations.mockResolvedValue(mockIntegrations);
            cacheService.get.mockResolvedValue(null);
            cacheService.set.mockResolvedValue();

            const result = await externalService.getIntegrationStatus(userId);

            expect(externalRepository.getUserIntegrations).toHaveBeenCalledWith(userId);
            expect(result).toHaveLength(2);
            expect(result[0].provider).toBe(ExternalProvider.ZAPIER);
            expect(result[0].status).toBe('active');
            expect(cacheService.set).toHaveBeenCalledWith(
                `integrations:${userId}`,
                JSON.stringify(result),
                1800
            );
        });

        it('should return cached status if available', async () => {
            const cachedIntegrations = [
                {
                    id: 'cached-integration',
                    provider: ExternalProvider.ZAPIER,
                    status: 'active'
                }
            ];

            cacheService.get.mockResolvedValue(JSON.stringify(cachedIntegrations));

            const result = await externalService.getIntegrationStatus(userId);

            expect(externalRepository.getUserIntegrations).not.toHaveBeenCalled();
            expect(result).toEqual(cachedIntegrations);
        });

        it('should include integration health metrics', async () => {
            const mockIntegrations = [
                {
                    id: 'integration-1',
                    provider: ExternalProvider.ZAPIER,
                    status: 'active',
                    health: {
                        successRate: 0.95,
                        averageResponseTime: 450,
                        lastError: null
                    }
                }
            ];

            externalRepository.getUserIntegrations.mockResolvedValue(mockIntegrations);

            const result = await externalService.getIntegrationStatus(userId);

            expect(result[0].health).toBeDefined();
            expect(result[0].health.successRate).toBe(0.95);
        });
    });

    describe('updateIntegrationConfig', () => {
        const updateData = {
            integrationId: 'integration-123',
            config: {
                apiKey: 'new-api-key',
                webhookUrl: 'https://new-url.com/webhook'
            },
            enabled: true
        };

        it('should successfully update integration configuration', async () => {
            const existingIntegration = {
                id: updateData.integrationId,
                userId,
                provider: ExternalProvider.ZAPIER,
                config: { apiKey: 'old-key' },
                enabled: false
            };

            const updatedIntegration = {
                ...existingIntegration,
                ...updateData,
                config: { ...updateData.config },
                updatedAt: new Date()
            };

            externalRepository.findIntegrationById.mockResolvedValue(existingIntegration);
            externalRepository.updateIntegration.mockResolvedValue(updatedIntegration);
            externalRepository.validateIntegration.mockResolvedValue(true);
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await externalService.updateIntegrationConfig(userId, updateData);

            expect(externalRepository.updateIntegration).toHaveBeenCalledWith(
                updateData.integrationId,
                updateData
            );
            expect(cacheService.del).toHaveBeenCalledWith(`integrations:${userId}`);
            expect(result.enabled).toBe(true);
            expect(result.config.apiKey).toBe('new-api-key');
        });

        it('should validate integration ownership', async () => {
            externalRepository.findIntegrationById.mockResolvedValue({
                id: updateData.integrationId,
                userId: 'different-user-id'
            });

            await expect(externalService.updateIntegrationConfig(userId, updateData))
                .rejects.toThrow('Integration not found or access denied');
        });

        it('should validate new configuration', async () => {
            const existingIntegration = {
                id: updateData.integrationId,
                userId,
                provider: ExternalProvider.ZAPIER,
                config: { apiKey: 'old-key' }
            };

            externalRepository.findIntegrationById.mockResolvedValue(existingIntegration);
            externalRepository.validateIntegration.mockResolvedValue(false);

            await expect(externalService.updateIntegrationConfig(userId, updateData))
                .rejects.toThrow('Invalid integration configuration');
        });

        it('should encrypt sensitive configuration data', async () => {
            const existingIntegration = {
                id: updateData.integrationId,
                userId,
                provider: ExternalProvider.ZAPIER,
                config: { apiKey: 'old-key' }
            };

            externalRepository.findIntegrationById.mockResolvedValue(existingIntegration);
            externalRepository.updateIntegration.mockResolvedValue({
                ...existingIntegration,
                ...updateData
            });
            externalRepository.validateIntegration.mockResolvedValue(true);

            await externalService.updateIntegrationConfig(userId, updateData);

            expect(externalRepository.updateIntegration).toHaveBeenCalledWith(
                updateData.integrationId,
                expect.objectContaining({
                    config: expect.objectContaining({
                        apiKey: expect.not.stringMatching('new-api-key')
                    })
                })
            );
        });
    });

    describe('deleteIntegration', () => {
        it('should successfully delete integration', async () => {
            const existingIntegration = {
                id: 'integration-123',
                userId,
                provider: ExternalProvider.ZAPIER,
                status: 'active'
            };

            externalRepository.findIntegrationById.mockResolvedValue(existingIntegration);
            externalRepository.deleteIntegration.mockResolvedValue(true);
            externalRepository.cleanupIntegrationData.mockResolvedValue();
            cacheService.del.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await externalService.deleteIntegration(userId, 'integration-123');

            expect(externalRepository.deleteIntegration).toHaveBeenCalledWith('integration-123');
            expect(externalRepository.cleanupIntegrationData).toHaveBeenCalledWith('integration-123');
            expect(cacheService.del).toHaveBeenCalledWith(`integrations:${userId}`);
            expect(eventEmitter.emit).toHaveBeenCalledWith('integration.deleted', {
                integrationId: 'integration-123',
                userId
            });
            expect(result).toBe(true);
        });

        it('should handle active integration deletion', async () => {
            const activeIntegration = {
                id: 'integration-123',
                userId,
                provider: ExternalProvider.ZAPIER,
                status: 'active',
                lastUsed: new Date()
            };

            externalRepository.findIntegrationById.mockResolvedValue(activeIntegration);

            await expect(externalService.deleteIntegration(userId, 'integration-123'))
                .rejects.toThrow('Cannot delete active integration');
        });

        it('should only allow owner to delete integration', async () => {
            externalRepository.findIntegrationById.mockResolvedValue({
                id: 'integration-123',
                userId: 'different-user-id'
            });

            await expect(externalService.deleteIntegration(userId, 'integration-123'))
                .rejects.toThrow('Integration not found or access denied');
        });
    });

    describe('handleExternalAPIRequest', () => {
        const apiRequest = {
            provider: ExternalProvider.ZAPIER,
            endpoint: '/tasks',
            method: 'POST',
            data: {
                title: 'New Task',
                description: 'Task from external API'
            },
            headers: {
                'Authorization': 'Bearer external-token',
                'Content-Type': 'application/json'
            }
        };

        it('should successfully handle external API request', async () => {
            const mockResponse = {
                status: 200,
                data: {
                    taskId: 'task-123',
                    title: 'New Task',
                    createdAt: new Date()
                }
            };

            externalRepository.validateApiRequest.mockResolvedValue(true);
            jest.spyOn(externalService as any, 'executeApiRequest').mockResolvedValue(mockResponse);
            externalRepository.logApiRequest.mockResolvedValue();

            const result = await externalService.handleExternalAPIRequest(userId, apiRequest);

            expect(externalRepository.validateApiRequest).toHaveBeenCalledWith(userId, apiRequest);
            expect(result).toEqual(mockResponse);
            expect(externalRepository.logApiRequest).toHaveBeenCalled();
        });

        it('should validate API request permissions', async () => {
            externalRepository.validateApiRequest.mockResolvedValue(false);

            await expect(externalService.handleExternalAPIRequest(userId, apiRequest))
                .rejects.toThrow('API request not authorized');
        });

        it('should handle API rate limiting', async () => {
            externalRepository.validateApiRequest.mockResolvedValue(true);
            externalRepository.checkRateLimit.mockResolvedValue({
                allowed: false,
                limit: 100,
                remaining: 0,
                resetTime: new Date(Date.now() + 60 * 60 * 1000)
            });

            await expect(externalService.handleExternalAPIRequest(userId, apiRequest))
                .rejects.toThrow('API rate limit exceeded');
        });

        it('should handle external API errors', async () => {
            externalRepository.validateApiRequest.mockResolvedValue(true);
            jest.spyOn(externalService as any, 'executeApiRequest').mockRejectedValue(
                new Error('External API unavailable')
            );

            await expect(externalService.handleExternalAPIRequest(userId, apiRequest))
                .rejects.toThrow('External API request failed');
        });

        it('should sanitize sensitive data in API requests', async () => {
            const requestWithSensitiveData = {
                ...apiRequest,
                data: {
                    title: 'New Task',
                    apiKey: 'sensitive-api-key', // Should be sanitized
                    password: 'user-password' // Should be sanitized
                }
            };

            externalRepository.validateApiRequest.mockResolvedValue(true);
            jest.spyOn(externalService as any, 'executeApiRequest').mockResolvedValue({ status: 200 });

            await externalService.handleExternalAPIRequest(userId, requestWithSensitiveData);

            expect(externalRepository.logApiRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.not.objectContaining({
                        apiKey: 'sensitive-api-key',
                        password: 'user-password'
                    })
                })
            );
        });
    });
});