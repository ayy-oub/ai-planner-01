// src/shared/container.ts
import { container } from 'tsyringe';
import Redis from 'ioredis';

// Repositories
import { AuthRepository } from '../modules/auth/auth.repository';

// Shared services
import { CacheService } from './services/cache.service';
import { EmailService } from './services/email.service';
import { AuditService } from './services/audit.service';
import { QueueService } from './services/queue.service';
import { FirebaseService } from './services/firebase.service';
import { connectRedis } from '@/infrastructure/database/redis';

export async function registerDependencies() {
    // Wait for Redis to be connected
    const redisClient: Redis = await connectRedis();

    // Register Redis instance
    container.registerInstance<Redis>('RedisClient', redisClient);

    // Register repositories
    container.registerSingleton<AuthRepository>('AuthRepository', AuthRepository);

    // Register shared services
    container.registerSingleton<CacheService>('CacheService', CacheService);
    container.registerSingleton<EmailService>('EmailService', EmailService);
    container.registerSingleton<AuditService>('AuditService', AuditService);
    container.registerSingleton<QueueService>('QueueService', QueueService);
    container.registerSingleton<FirebaseService>('FirebaseService', FirebaseService);
}
