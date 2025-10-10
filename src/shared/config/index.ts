import Joi from 'joi';
import dotenv from 'dotenv';

dotenv.config();

// Validation schema
const configSchema = Joi.object({
    // Application
    NODE_ENV: Joi.string().valid('development', 'production', 'test', 'staging').default('development'),
    PORT: Joi.number().port().default(5000),
    APP_URL: Joi.string().uri().default('http://localhost:5000'),
    API_VERSION: Joi.string().default('v1'),
    API_PREFIX: Joi.string().default('/api'),

    // Security
    JWT_SECRET: Joi.string().min(256).required(),
    JWT_ACCESS_EXPIRE: Joi.string().default('15m'),
    JWT_REFRESH_EXPIRE: Joi.string().default('7d'),
    JWT_RESET_PASSWORD_EXPIRE: Joi.string().default('10m'),
    JWT_EMAIL_VERIFY_EXPIRE: Joi.string().default('10m'),
    BCRYPT_ROUNDS: Joi.number().min(10).max(20).default(12),
    SESSION_SECRET: Joi.string().min(256).required(),
    API_KEY_SECRET: Joi.string().min(32).required(),

    // Firebase
    FIREBASE_PROJECT_ID: Joi.string().required(),
    FIREBASE_CLIENT_EMAIL: Joi.string().email().required(),
    FIREBASE_PRIVATE_KEY: Joi.string().required(),
    FIREBASE_DATABASE_URL: Joi.string().uri().required(),
    FIREBASE_STORAGE_BUCKET: Joi.string().required(),
    UPLOAD_STORAGE_DEFAULT: Joi.string().valid('local', 'cloudinary', 's3', 'firebase').default('local'), UPLOAD_FIREBASE_PUBLIC: Joi.boolean().default(true),
    UPLOAD_FIREBASE_SIGNED_URL_EXPIRY_MS: Joi.number().default(1000 * 60 * 60 * 24 * 365 * 10), // 10 y

    // Database:
    DB_HOST: Joi.string().default('localhost'),
    DB_PORT: Joi.number().default(5432),
    DB_NAME: Joi.string().default('ai_planner'),
    DB_USER: Joi.string().allow(''),
    DB_PASSWORD: Joi.string().allow(''),
    DB_SSL: Joi.boolean().default(false),
    DB_POOL_MIN: Joi.number().default(2),
    DB_POOL_MAX: Joi.number().default(10),
    DB_POOL_ACQUIRE: Joi.number().default(30000),
    DB_POOL_IDLE: Joi.number().default(10000),

    DB_QUERY_TIMEOUT: Joi.number().default(30000),
    DB_SLOW_QUERY_THRESHOLD: Joi.number().default(1000),
    DB_MAX_QUERY_TIME: Joi.number().default(60000),

    DB_CACHE_ENABLED: Joi.boolean().default(false),
    DB_CACHE_TTL: Joi.number().default(300),
    DB_CACHE_CHECK_PERIOD: Joi.number().default(60),

    DB_BACKUP_ENABLED: Joi.boolean().default(false),
    DB_BACKUP_INTERVAL: Joi.string().default('0 2 * * *'),
    DB_BACKUP_RETENTION: Joi.number().default(30),
    DB_BACKUP_BUCKET: Joi.string().allow(''),

    // Redis
    REDIS_HOST: Joi.string().default('localhost'),
    REDIS_PORT: Joi.number().port().default(6379),
    REDIS_PASSWORD: Joi.string().allow(''),
    REDIS_DB: Joi.number().default(0),
    REDIS_TLS: Joi.boolean().default(false),
    REDIS_CLUSTER: Joi.boolean().default(false),

    //Cloudinary
    CLOUDINARY_CLOUD_NAME: Joi.string().allow(''),
    CLOUDINARY_API_KEY: Joi.string().allow(''),
    CLOUDINARY_API_SECRET: Joi.string().allow(''),


    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
    RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
    AUTH_RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
    AUTH_RATE_LIMIT_MAX_REQUESTS: Joi.number().default(5),
    PREMIUM_RATE_LIMIT_MULTIPLIER: Joi.number().default(5),

    // File Upload
    MAX_FILE_SIZE: Joi.number().default(10485760),
    ALLOWED_FILE_TYPES: Joi.string().default('jpg,jpeg,png,pdf,webp'),
    UPLOAD_DIR: Joi.string().default('uploads'),
    MAX_FILES_PER_REQUEST: Joi.number().default(5),

    // Logging
    LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    LOG_FILE_MAX_SIZE: Joi.string().default('20m'),
    LOG_FILE_MAX_FILES: Joi.string().default('14d'),
    LOG_FORMAT: Joi.string().default('combined'),
    ENABLE_AUDIT_LOG: Joi.boolean().default(true),

    // Monitoring
    METRICS_ENABLED: Joi.boolean().default(true),
    HEALTH_CHECK_ENABLED: Joi.boolean().default(true),
    GRAFANA_PASSWORD: Joi.string().default('admin'),

    // CORS
    CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
    CORS_CREDENTIALS: Joi.boolean().default(true),
    CORS_METHODS: Joi.string().default('GET,POST,PUT,PATCH,DELETE,OPTIONS'),
    CORS_HEADERS: Joi.string().default('Content-Type,Authorization,X-Requested-With'),

    // Security
    COOKIE_SECURE: Joi.boolean().default(false),
    COOKIE_HTTP_ONLY: Joi.boolean().default(true),
    COOKIE_SAME_SITE: Joi.string().valid('strict', 'lax', 'none').default('strict'),
    ENABLE_HSTS: Joi.boolean().default(true),
    ENABLE_CSP: Joi.boolean().default(true),

    // Email
    SMTP_HOST: Joi.string().default('smtp.gmail.com'),
    SMTP_PORT: Joi.number().port().default(587),
    SMTP_USER: Joi.string().email().allow(''),
    SMTP_PASS: Joi.string().allow(''),
    SMTP_SECURE: Joi.boolean().default(false),
    SMTP_TLS: Joi.boolean().default(true),
    FROM_EMAIL: Joi.string().email().allow(''),
    FROM_NAME: Joi.string().default('AI Planner'),

    // External Services
    N8N_WEBHOOK_URL: Joi.string().uri().allow(''),
    AI_SERVICE_URL: Joi.string().uri().allow(''),
    CALENDAR_SYNC_URL: Joi.string().uri().allow(''),
    WEBHOOK_SECRET: Joi.string().min(32).default('your-webhook-secret'),

    // Development
    DEBUG: Joi.boolean().default(false),
    ENABLE_SWAGGER: Joi.boolean().default(true),
    SWAGGER_HOST: Joi.string().default('localhost:5000'),
    SWAGGER_SCHEMES: Joi.string().default('http,https'),

    // AI Service
    AI_API_KEY: Joi.string().min(10).allow(''),
    AI_MODEL: Joi.string().default('gpt-4'),
    AI_MAX_TOKENS: Joi.number().default(2000),
    AI_TEMPERATURE: Joi.number().min(0).max(2).default(0.7),

    // File Processing
    IMAGE_PROCESSING_ENABLED: Joi.boolean().default(true),
    MAX_IMAGE_WIDTH: Joi.number().default(2048),
    MAX_IMAGE_HEIGHT: Joi.number().default(2048),
    IMAGE_QUALITY: Joi.number().min(1).max(100).default(85),
    THUMBNAIL_WIDTH: Joi.number().default(300),
    THUMBNAIL_HEIGHT: Joi.number().default(300),

    // Queue Configuration
    QUEUE_CONCURRENCY: Joi.number().default(5),
    QUEUE_ATTEMPTS: Joi.number().default(3),
    QUEUE_BACKOFF_DELAY: Joi.number().default(5000),
    QUEUE_REMOVE_ON_SUCCESS: Joi.boolean().default(true),
    QUEUE_REMOVE_ON_FAILURE: Joi.boolean().default(false),

    // Backup Configuration
    BACKUP_ENABLED: Joi.boolean().default(true),
    BACKUP_INTERVAL: Joi.string().default('24h'),
    BACKUP_RETENTION_DAYS: Joi.number().default(30),
    BACKUP_STORAGE_PATH: Joi.string().default('/backups'),

    // Feature Flags
    ENABLE_REGISTRATION: Joi.boolean().default(true),
    ENABLE_EMAIL_VERIFICATION: Joi.boolean().default(true),
    ENABLE_TWO_FACTOR_AUTH: Joi.boolean().default(false),
    ENABLE_SOCIAL_LOGIN: Joi.boolean().default(false),
    ENABLE_PREMIUM_FEATURES: Joi.boolean().default(true),
    ENABLE_AI_FEATURES: Joi.boolean().default(true),
    ENABLE_REAL_TIME_NOTIFICATIONS: Joi.boolean().default(true),
    ENABLE_CALENDAR_SYNC: Joi.boolean().default(true),
    ENABLE_HANDWRITING_RECOGNITION: Joi.boolean().default(true),




});

// Validate configuration
const { error, value: envVars } = configSchema.validate(process.env, {
    allowUnknown: true,
    stripUnknown: true,
});

if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

// Helper function to parse comma-separated strings
const parseArray = (value: string): string[] => {
    return value.split(',').map(item => item.trim()).filter(Boolean);
};

// Export configuration
export const config = {
    app: {
        env: envVars.NODE_ENV,
        port: envVars.PORT,
        url: envVars.APP_URL,
        version: envVars.API_VERSION,
        prefix: envVars.API_PREFIX,
        debug: envVars.DEBUG,
    },

    security: {
        jwtSecret: envVars.JWT_SECRET,
        jwtAccessExpire: envVars.JWT_ACCESS_EXPIRE,
        jwtRefreshExpire: envVars.JWT_REFRESH_EXPIRE,
        jwtResetPasswordExpire: envVars.JWT_RESET_PASSWORD_EXPIRE,
        jwtEmailVerifyExpire: envVars.JWT_EMAIL_VERIFY_EXPIRE,
        bcryptRounds: envVars.BCRYPT_ROUNDS,
        sessionSecret: envVars.SESSION_SECRET,
        apiKeySecret: envVars.API_KEY_SECRET,
        enableHsts: envVars.ENABLE_HSTS,
        enableCsp: envVars.ENABLE_CSP,
    },

    firebase: {
        projectId: envVars.FIREBASE_PROJECT_ID,
        clientEmail: envVars.FIREBASE_CLIENT_EMAIL,
        privateKey: envVars.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        databaseURL: envVars.FIREBASE_DATABASE_URL,
        storageBucket: envVars.FIREBASE_STORAGE_BUCKET,
    },

    cloudinary: {
        cloudName: envVars.CLOUDINARY_CLOUD_NAME,
        apiKey: envVars.CLOUDINARY_API_KEY,
        apiSecret: envVars.CLOUDINARY_API_SECRET,
    },

    database: {
        host: envVars.DB_HOST || 'localhost',
        port: parseInt(envVars.DB_PORT, 10) || 5432,
        name: envVars.DB_NAME || 'ai_planner',
        user: envVars.DB_USER || '',
        password: envVars.DB_PASSWORD || '',
        ssl: envVars.DB_SSL === true || envVars.DB_SSL === 'true',

        pool: {
            min: parseInt(envVars.DB_POOL_MIN, 10) || 2,
            max: parseInt(envVars.DB_POOL_MAX, 10) || 10,
            acquire: parseInt(envVars.DB_POOL_ACQUIRE, 10) || 30000,
            idle: parseInt(envVars.DB_POOL_IDLE, 10) || 10000,
        },

        query: {
            timeout: parseInt(envVars.DB_QUERY_TIMEOUT, 10) || 30000,
            slowQueryThreshold: parseInt(envVars.DB_SLOW_QUERY_THRESHOLD, 10) || 1000,
            maxQueryTime: parseInt(envVars.DB_MAX_QUERY_TIME, 10) || 60000,
        },

        cache: {
            enabled: envVars.DB_CACHE_ENABLED === 'true',
            ttl: parseInt(envVars.DB_CACHE_TTL, 10) || 300,
            checkPeriod: parseInt(envVars.DB_CACHE_CHECK_PERIOD, 10) || 60,
        },

        backup: {
            enabled: envVars.DB_BACKUP_ENABLED === 'true',
            interval: envVars.DB_BACKUP_INTERVAL || '0 2 * * *',
            retention: parseInt(envVars.DB_BACKUP_RETENTION, 10) || 30,
            bucket: envVars.DB_BACKUP_BUCKET || '',
        },
    },

    redis: {
        host: envVars.REDIS_HOST,
        port: envVars.REDIS_PORT,
        password: envVars.REDIS_PASSWORD,
        db: envVars.REDIS_DB,
        tls: envVars.REDIS_TLS,
        cluster: envVars.REDIS_CLUSTER,
        retry: {
            maxRetriesPerRequest: 3,
            enableOfflineQueue: false,
        }
    },

    rateLimit: {
        windowMs: envVars.RATE_LIMIT_WINDOW_MS,
        maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS,
        authWindowMs: envVars.AUTH_RATE_LIMIT_WINDOW_MS,
        authMaxRequests: envVars.AUTH_RATE_LIMIT_MAX_REQUESTS,
        premiumMultiplier: envVars.PREMIUM_RATE_LIMIT_MULTIPLIER,
    },

    upload: {
        maxFileSize: envVars.MAX_FILE_SIZE,
        allowedFileTypes: parseArray(envVars.ALLOWED_FILE_TYPES),
        uploadDir: envVars.UPLOAD_DIR,
        maxFilesPerRequest: envVars.MAX_FILES_PER_REQUEST,
        storageDefault: envVars.UPLOAD_STORAGE_DEFAULT,
        firebase: {
            public: envVars.UPLOAD_FIREBASE_PUBLIC,
            signedUrlExpiryMs: envVars.UPLOAD_FIREBASE_SIGNED_URL_EXPIRY_MS,
            bucket: envVars.FIREBASE_STORAGE_BUCKET,
        },
    },

    logging: {
        level: envVars.LOG_LEVEL,
        maxSize: envVars.LOG_FILE_MAX_SIZE,
        maxFiles: envVars.LOG_FILE_MAX_FILES,
        format: envVars.LOG_FORMAT,
        enableAuditLog: envVars.ENABLE_AUDIT_LOG,
    },

    monitoring: {
        metricsEnabled: envVars.METRICS_ENABLED,
        healthCheckEnabled: envVars.HEALTH_CHECK_ENABLED,
        grafanaPassword: envVars.GRAFANA_PASSWORD,
    },

    cors: {
        origin: parseArray(envVars.CORS_ORIGIN),
        credentials: envVars.CORS_CREDENTIALS,
        methods: parseArray(envVars.CORS_METHODS),
        headers: parseArray(envVars.CORS_HEADERS),
    },

    cookies: {
        secure: envVars.COOKIE_SECURE,
        httpOnly: envVars.COOKIE_HTTP_ONLY,
        sameSite: envVars.COOKIE_SAME_SITE,
    },

    email: {
        transport: 'smtp' as const,
        smtp: {
            host: envVars.SMTP_HOST,
            port: envVars.SMTP_PORT,
            secure: envVars.SMTP_SECURE,
            auth: {
                user: envVars.SMTP_USER,
                pass: envVars.SMTP_PASS,
            },
            pool: true, // enables connection pooling
            maxConnections: 5, // maximum simultaneous connections
            maxMessages: 100, // maximum messages per connection
            rateDelta: 2000, // time window for rate limiting (in ms)
            rateLimit: 5, // maximum messages per rateDelta
        },
        from: {
            email: envVars.FROM_EMAIL,
            name: envVars.FROM_NAME,
        },
    },

    external: {
        n8nWebhookUrl: envVars.N8N_WEBHOOK_URL,
        aiServiceUrl: envVars.AI_SERVICE_URL,
        calendarSyncUrl: envVars.CALENDAR_SYNC_URL,
        webhookSecret: envVars.WEBHOOK_SECRET,
    },

    swagger: {
        enabled: envVars.ENABLE_SWAGGER,
        host: envVars.SWAGGER_HOST,
        schemes: parseArray(envVars.SWAGGER_SCHEMES),
    },

    ai: {
        apiKey: envVars.AI_API_KEY,
        model: envVars.AI_MODEL,
        maxTokens: envVars.AI_MAX_TOKENS,
        temperature: envVars.AI_TEMPERATURE,
    },

    imageProcessing: {
        enabled: envVars.IMAGE_PROCESSING_ENABLED,
        maxWidth: envVars.MAX_IMAGE_WIDTH,
        maxHeight: envVars.MAX_IMAGE_HEIGHT,
        quality: envVars.IMAGE_QUALITY,
        thumbnailWidth: envVars.THUMBNAIL_WIDTH,
        thumbnailHeight: envVars.THUMBNAIL_HEIGHT,
    },

    queue: {
        concurrency: envVars.QUEUE_CONCURRENCY,
        attempts: envVars.QUEUE_ATTEMPTS,
        backoffDelay: envVars.QUEUE_BACKOFF_DELAY,
        removeOnSuccess: envVars.QUEUE_REMOVE_ON_SUCCESS,
        removeOnFailure: envVars.QUEUE_REMOVE_ON_FAILURE,
    },

    backup: {
        enabled: envVars.BACKUP_ENABLED,
        interval: envVars.BACKUP_INTERVAL,
        retentionDays: envVars.BACKUP_RETENTION_DAYS,
        storagePath: envVars.BACKUP_STORAGE_PATH,
    },

    features: {
        enableRegistration: envVars.ENABLE_REGISTRATION,
        enableEmailVerification: envVars.ENABLE_EMAIL_VERIFICATION,
        enableTwoFactorAuth: envVars.ENABLE_TWO_FACTOR_AUTH,
        enableSocialLogin: envVars.ENABLE_SOCIAL_LOGIN,
        enablePremiumFeatures: envVars.ENABLE_PREMIUM_FEATURES,
        enableAiFeatures: envVars.ENABLE_AI_FEATURES,
        enableRealTimeNotifications: envVars.ENABLE_REAL_TIME_NOTIFICATIONS,
        enableCalendarSync: envVars.ENABLE_CALENDAR_SYNC,
        enableHandwritingRecognition: envVars.ENABLE_HANDWRITING_RECOGNITION,
    },
} as const;

// Type for config
export type Config = typeof config;