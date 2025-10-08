import { config } from './index';

export interface SwaggerConfig {
    enabled: boolean;
    route: string;
    options: {
        definition: {
            openapi: string;
            info: {
                title: string;
                version: string;
                description: string;
                contact: {
                    name: string;
                    email: string;
                    url: string;
                };
                license: {
                    name: string;
                    url: string;
                };
            };
            servers: Array<{
                url: string;
                description: string;
            }>;
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: string;
                        scheme: string;
                        bearerFormat: string;
                        description: string;
                    };
                    apiKeyAuth: {
                        type: string;
                        in: string;
                        name: string;
                        description: string;
                    };
                };
                schemas: Record<string, any>;
            };
            security: Array<{
                bearerAuth: string[];
            }>;
            tags: Array<{
                name: string;
                description: string;
            }>;
        };
        apis: string[];
    };
}

export const swaggerConfig: SwaggerConfig = {
    enabled: config.swagger.enabled,
    route: '/api-docs',
    options: {
        definition: {
            openapi: '3.0.0',
            info: {
                title: 'AI Planner API',
                version: config.app.version,
                description: 'Production-ready AI-powered planning and productivity platform API',
                contact: {
                    name: 'AI Planner Support',
                    email: 'support@aiplanner.com',
                    url: 'https://aiplanner.com',
                },
                license: {
                    name: 'MIT',
                    url: 'https://opensource.org/licenses/MIT',
                },
            },
            servers: [
                {
                    url: `http://localhost:${config.app.port}${config.app.prefix}`,
                    description: 'Development server',
                },
                {
                    url: `https://api.aiplanner.com${config.app.prefix}`,
                    description: 'Production server',
                },
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                        description: 'JWT authentication token. Enter your access token in the format: Bearer <token>',
                    },
                    apiKeyAuth: {
                        type: 'apiKey',
                        in: 'header',
                        name: 'X-API-Key',
                        description: 'API key authentication for external services',
                    },
                },
                schemas: {
                    // Common response schemas
                    ApiResponse: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean' },
                            message: { type: 'string' },
                            data: { type: 'object' },
                            timestamp: { type: 'string', format: 'date-time' },
                            requestId: { type: 'string' },
                        },
                    },
                    ErrorResponse: {
                        type: 'object',
                        properties: {
                            success: { type: 'boolean', default: false },
                            error: {
                                type: 'object',
                                properties: {
                                    code: { type: 'string' },
                                    message: { type: 'string' },
                                    details: { type: 'array', items: { type: 'object' } },
                                },
                            },
                            timestamp: { type: 'string', format: 'date-time' },
                            requestId: { type: 'string' },
                        },
                    },
                    PaginationMeta: {
                        type: 'object',
                        properties: {
                            page: { type: 'integer', minimum: 1 },
                            limit: { type: 'integer', minimum: 1, maximum: 100 },
                            total: { type: 'integer', minimum: 0 },
                            pages: { type: 'integer', minimum: 0 },
                            hasNext: { type: 'boolean' },
                            hasPrev: { type: 'boolean' },
                        },
                    },
                    // User schemas
                    User: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            email: { type: 'string', format: 'email' },
                            displayName: { type: 'string' },
                            photoURL: { type: 'string', format: 'uri' },
                            emailVerified: { type: 'boolean' },
                            role: { type: 'string', enum: ['user', 'admin'] },
                            preferences: { type: 'object' },
                            createdAt: { type: 'string', format: 'date-time' },
                            updatedAt: { type: 'string', format: 'date-time' },
                        },
                    },
                    // Auth schemas
                    LoginRequest: {
                        type: 'object',
                        required: ['email', 'password'],
                        properties: {
                            email: { type: 'string', format: 'email' },
                            password: { type: 'string', minLength: 8 },
                        },
                    },
                    LoginResponse: {
                        type: 'object',
                        properties: {
                            accessToken: { type: 'string' },
                            refreshToken: { type: 'string' },
                            user: { $ref: '#/components/schemas/User' },
                        },
                    },
                    // Planner schemas
                    Planner: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            title: { type: 'string' },
                            description: { type: 'string' },
                            color: { type: 'string' },
                            icon: { type: 'string' },
                            sections: { type: 'array', items: { type: 'object' } },
                            settings: { type: 'object' },
                            collaborators: { type: 'array', items: { type: 'object' } },
                            tags: { type: 'array', items: { type: 'string' } },
                            createdAt: { type: 'string', format: 'date-time' },
                            updatedAt: { type: 'string', format: 'date-time' },
                        },
                    },
                    CreatePlannerRequest: {
                        type: 'object',
                        required: ['title'],
                        properties: {
                            title: { type: 'string', minLength: 1, maxLength: 100 },
                            description: { type: 'string', maxLength: 500 },
                            color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
                            icon: { type: 'string' },
                            tags: { type: 'array', items: { type: 'string' } },
                        },
                    },
                    // Activity schemas
                    Activity: {
                        type: 'object',
                        properties: {
                            id: { type: 'string' },
                            title: { type: 'string' },
                            description: { type: 'string' },
                            type: { type: 'string', enum: ['task', 'event', 'note', 'goal'] },
                            status: { type: 'string', enum: ['pending', 'in-progress', 'completed', 'cancelled'] },
                            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
                            dueDate: { type: 'string', format: 'date-time' },
                            completedAt: { type: 'string', format: 'date-time' },
                            tags: { type: 'array', items: { type: 'string' } },
                            createdAt: { type: 'string', format: 'date-time' },
                            updatedAt: { type: 'string', format: 'date-time' },
                        },
                    },
                    CreateActivityRequest: {
                        type: 'object',
                        required: ['title'],
                        properties: {
                            title: { type: 'string', minLength: 1, maxLength: 200 },
                            description: { type: 'string', maxLength: 1000 },
                            type: { type: 'string', enum: ['task', 'event', 'note', 'goal'] },
                            priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
                            dueDate: { type: 'string', format: 'date-time' },
                            tags: { type: 'array', items: { type: 'string' } },
                        },
                    },
                    // Error schemas
                    ValidationError: {
                        type: 'object',
                        properties: {
                            field: { type: 'string' },
                            message: { type: 'string' },
                            value: { type: 'string' },
                        },
                    },
                },
            },
            security: [
                {
                    bearerAuth: [],
                },
            ],
            tags: [
                { name: 'Authentication', description: 'User authentication endpoints' },
                { name: 'Users', description: 'User management endpoints' },
                { name: 'Planners', description: 'Planner management endpoints' },
                { name: 'Sections', description: 'Section management endpoints' },
                { name: 'Activities', description: 'Activity management endpoints' },
                { name: 'AI', description: 'AI-powered features endpoints' },
                { name: 'Export', description: 'Export functionality endpoints' },
                { name: 'Calendar', description: 'Calendar integration endpoints' },
                { name: 'Admin', description: 'Administration endpoints' },
                { name: 'Health', description: 'Health check endpoints' },
            ],
        },
        apis: [
            './src/modules/**/*.ts',
            './src/shared/types/*.ts',
            './docs/swagger/*.yaml',
            './docs/swagger/*.yml',
        ],
    },
};

export default swaggerConfig;