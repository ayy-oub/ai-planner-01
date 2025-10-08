import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import xss from 'xss-clean';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

import { config } from '@shared/config';
import { logger, stream } from '@shared/utils/logger';
import { errorHandler, notFoundHandler } from '@shared/middleware/error.middleware';
import { securityMiddleware } from '@shared/middleware/security.middleware';
import { rateLimitMiddleware } from '@shared/middleware/rate-limit.middleware';
import { requestIdMiddleware } from '@shared/middleware/request-id.middleware';
import { loggingMiddleware } from '@shared/middleware/logging.middleware';

// Import routes
import authRoutes from '@modules/auth/auth.routes';
import plannerRoutes from '@modules/planner/planner.routes';
import sectionRoutes from '@modules/section/section.routes';
import activityRoutes from '@modules/activity/activity.routes';
import aiRoutes from '@modules/ai/ai.routes';
import exportRoutes from '@modules/export/export.routes';
import calendarRoutes from '@modules/calendar/calendar.routes';
import adminRoutes from '@modules/admin/admin.routes';
import userRoutes from '@modules/user/user.routes';
import healthRoutes from '@modules/health/health.routes';

const app: Application = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: config.app.env === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: config.app.env === 'production' ? undefined : false,
}));

app.use(xss());
app.use(mongoSanitize());
app.use(hpp());

// CORS configuration
app.use(cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
    methods: config.cors.methods,
    allowedHeaders: config.cors.headers,
}));

// Compression
app.use(compression());

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware
app.use(requestIdMiddleware);

// Logging middleware
app.use(morgan(config.app.env === 'production' ? 'combined' : 'dev', { stream }));

// Custom logging middleware
app.use(loggingMiddleware);

// Rate limiting
app.use(rateLimitMiddleware);

// Security middleware
app.use(securityMiddleware);

// Swagger documentation (development only)
if (config.swagger.enabled && config.app.env !== 'production') {
    const swaggerOptions = {
        definition: {
            openapi: '3.0.0',
            info: {
                title: 'AI Planner API',
                version: config.app.version,
                description: 'Production-ready AI Planner Backend API',
                contact: {
                    name: 'AI Planner Team',
                    email: 'support@aiplanner.com',
                },
            },
            servers: [
                {
                    url: `http://${config.swagger.host}${config.app.prefix}`,
                    description: 'Development server',
                },
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                    },
                },
            },
        },
        apis: ['./src/modules/**/*.routes.ts', './src/modules/**/*.controller.ts'],
    };

    const specs = swaggerJsdoc(swaggerOptions);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'AI Planner API Documentation',
    }));
}

// Health check endpoint (before rate limiting)
app.use('/health', healthRoutes);

// API routes
app.use(`${config.app.prefix}/auth`, authRoutes);
app.use(`${config.app.prefix}/planners`, plannerRoutes);
app.use(`${config.app.prefix}/sections`, sectionRoutes);
app.use(`${config.app.prefix}/activities`, activityRoutes);
app.use(`${config.app.prefix}/ai`, aiRoutes);
app.use(`${config.app.prefix}/export`, exportRoutes);
app.use(`${config.app.prefix}/calendar`, calendarRoutes);
app.use(`${config.app.prefix}/admin`, adminRoutes);
app.use(`${config.app.prefix}/users`, userRoutes);

// Default route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'AI Planner API',
        version: config.app.version,
        environment: config.app.env,
        timestamp: new Date().toISOString(),
        documentation: config.swagger.enabled ? `/api-docs` : null,
        health: '/health',
    });
});

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

export default app;