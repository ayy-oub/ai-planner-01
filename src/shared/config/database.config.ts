import { config } from './index';

export interface DatabaseConfig {
    connection: {
        host: string;
        port: number;
        database: string;
        username?: string;
        password?: string;
        ssl?: boolean;
        pool?: {
            min: number;
            max: number;
            acquire: number;
            idle: number;
        };
    };
    query: {
        timeout: number;
        slowQueryThreshold: number;
        maxQueryTime: number;
    };
    cache: {
        enabled: boolean;
        ttl: number;
        checkPeriod: number;
    };
    backup: {
        enabled: boolean;
        interval: string;
        retention: number;
        bucket?: string;
    };
}

export const databaseConfig: DatabaseConfig = {
    connection: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'ai_planner',
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'true',
        pool: {
            min: parseInt(process.env.DB_POOL_MIN || '2', 10),
            max: parseInt(process.env.DB_POOL_MAX || '10', 10),
            acquire: parseInt(process.env.DB_POOL_ACQUIRE || '30000', 10),
            idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10),
        },
    },
    query: {
        timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
        slowQueryThreshold: parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000', 10),
        maxQueryTime: parseInt(process.env.DB_MAX_QUERY_TIME || '60000', 10),
    },
    cache: {
        enabled: process.env.DB_CACHE_ENABLED === 'true',
        ttl: parseInt(process.env.DB_CACHE_TTL || '300', 10),
        checkPeriod: parseInt(process.env.DB_CACHE_CHECK_PERIOD || '60', 10),
    },
    backup: {
        enabled: process.env.DB_BACKUP_ENABLED === 'true',
        interval: process.env.DB_BACKUP_INTERVAL || '0 2 * * *',
        retention: parseInt(process.env.DB_BACKUP_RETENTION || '30', 10),
        bucket: process.env.DB_BACKUP_BUCKET,
    },
};

export default databaseConfig;