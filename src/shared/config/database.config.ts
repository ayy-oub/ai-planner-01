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
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
        username: config.database.user,
        password: config.database.password,
        ssl: config.database.ssl,
        pool: {
            min: config.database.pool.min,
            max: config.database.pool.max,
            acquire: config.database.pool.acquire,
            idle: config.database.pool.idle,
        },
    },
    query: {
        timeout: config.database.query.timeout,
        slowQueryThreshold: config.database.query.slowQueryThreshold,
        maxQueryTime: config.database.query.maxQueryTime,
    },
    cache: {
        enabled: config.database.cache.enabled,
        ttl: config.database.cache.ttl,
        checkPeriod: config.database.cache.checkPeriod,
    },
    backup: {
        enabled: config.database.backup.enabled,
        interval: config.database.backup.interval,
        retention: config.database.backup.retention,
        bucket: config.database.backup.bucket,
    },
};

export default databaseConfig;