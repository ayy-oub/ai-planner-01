/* // src/shared/container.ts
;
import Redis from 'ioredis';

// ---------- Infrastructure ----------
import { connectRedis } from '@/infrastructure/database/redis';
import { firebaseConnection } from '@/infrastructure/database/firebase';

// ---------- Repositories ----------
import { AuthRepository } from '@/modules/auth/auth.repository';
import { UserRepository } from '@/modules/user/user.repository';
import { PlannerRepository } from '@/modules/planner/planner.repository';
import { SectionRepository } from '@/modules/section/section.repository';
import { ActivityRepository } from '@/modules/activity/activity.repository';
import { ExportService } from '../modules/export/export.service';

// ---------- Services ----------
import { CacheService } from './services/cache.service';
import { EmailService } from './services/email.service';
import { AuditService } from './services/audit.service';
import { QueueService } from './services/queue.service';
import { FirebaseService } from './services/firebase.service';
import { AuthService } from '@/modules/auth/auth.service';
import { UserService } from '@/modules/user/user.service';
import { SecurityMiddleware } from './middleware/security.middleware';

export async function registerDependencies() {
    // 1.  wait for connections
    const redisClient = await connectRedis(); // returns connected Redis

    // 2.  register infrastructure singletons
    container.registerInstance('RedisClient', redisClient);
    container.registerInstance('FirebaseAdmin', firebaseConnection.getApp());

    // 3.  register repositories (singletons)
    container.registerSingleton('AuthRepository', AuthRepository);
    container.registerSingleton('UserRepository', UserRepository);
    container.registerSingleton('PlannerRepository', PlannerRepository);
    container.registerSingleton('SectionRepository', SectionRepository);
    container.registerSingleton('ActivityRepository', ActivityRepository);

    // 4.  register services (singletons)
    container.registerSingleton(CacheService);
    container.registerSingleton(EmailService);
    container.registerSingleton(AuditService);
    container.registerSingleton(QueueService);
    container.registerSingleton(FirebaseService);
    container.registerSingleton<AuthService>('AuthService', AuthService);
    container.registerSingleton(UserService);
    container.registerSingleton(SecurityMiddleware);

    console.log('✅  All tokens registered in tsyringe');
} */

// src/shared/container.ts
import { QueueService, QueueServiceConfig } from './services/queue.service';
import { CacheService } from './services/cache.service';
import { EmailService } from './services/email.service';
import { AuditService } from './services/audit.service';
import { AuthRepository } from '@/modules/auth/auth.repository';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthController } from '@/modules/auth/auth.controller';
import { UserRepository } from '@/modules/user/user.repository';
import { UserService } from '@/modules/user/user.service';
import { UserController } from '@/modules/user/user.controller';
import { config } from '@/shared/config';
import { FirebaseService } from './services/firebase.service';
import { PlannerController } from '@/modules/planner/planner.controller';
import { PlannerService } from '@/modules/planner/planner.service';
import { PlannerRepository } from '@/modules/planner/planner.repository';
import { SectionRepository } from '@/modules/section/section.repository';
import { ActivityRepository } from '@/modules/activity/activity.repository';
import { ExportService } from '@/modules/export/export.service';
import { AIService } from '../modules/ai/ai.service';
import { AIRepository } from '@/modules/ai/ai.repository';
import { ExportRepository } from '@/modules/export/export.repository';
import { FileUploadService } from './services/file-upload.service';
import { SectionController } from '@/modules/section/section.controller';
import { SectionService } from '@/modules/section/section.service';
import { ActivityService } from '@/modules/activity/activity.service';
import { ActivityController } from '@/modules/activity/activity.controller';
import { AIController } from '@/modules/ai/ai.controller';
import { ExportController } from '@/modules/export/export.controller';
import { AdminController } from '@/modules/admin/admin.controller';
import { AdminRepository } from '@/modules/admin/admin.repository';
import { AdminService } from '@/modules/admin/admin.service';
import { HealthService } from '@/modules/health/health.service';
import { HealthController } from '@/modules/health/health.controller';
import { HealthRepository } from '@/modules/health/health.repository';

// ---------------------  base dependencies ---------------------
export const cacheService = new CacheService();
export const fileUploadService = new FileUploadService();
export const emailService = new EmailService();
export const firebaseService = new FirebaseService();
export const auditService = new AuditService(firebaseService);

// ---------------------  queue service -------------------------
const queueConfig: QueueServiceConfig = {
    redis: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: 0,
    },
    defaultJobOptions: {
        attempts: 3,
        removeOnComplete: true,
        removeOnFail: true,
    },
};

export const queueService = new QueueService(queueConfig);

// ---------------------  repositories --------------------------
export const authRepository = new AuthRepository(firebaseService);
export const userRepository = new UserRepository();
export const plannerRepository = new PlannerRepository(cacheService);
export const sectionRepository = new SectionRepository(cacheService);
export const activityRepository = new ActivityRepository(cacheService);
export const aiRepository = new AIRepository(cacheService);
export const exportRepository = new ExportRepository(cacheService);
export const adminRepository = new AdminRepository();
export const healthRepository = new HealthRepository(firebaseService, cacheService);

// ---------------------  services ------------------------------
export const authService = new AuthService(
    authRepository,
    cacheService,
    emailService,
    auditService,
    queueService
);

export const userService = new UserService(
    userRepository,
    cacheService,
    emailService,
    firebaseService
);

export const sectionService = new SectionService(
    sectionRepository,
    plannerRepository,
    activityRepository,
    auditService,
);
export const activityService = new ActivityService(
    activityRepository
);

export const exportService = new ExportService(
    exportRepository,
    userRepository,
    plannerRepository,
    sectionRepository,
    activityRepository,
    fileUploadService,
    queueService,
    emailService,
    auditService,
);

export const aiService = new AIService(
    aiRepository,
    userRepository,
    cacheService,
    plannerRepository,
    sectionRepository,
    activityRepository,
);

export const plannerService = new PlannerService(
    plannerRepository,
    userRepository,
    sectionRepository,
    activityRepository,
    emailService,
    exportService,
    queueService,
    auditService,
    aiService,
);

export const adminService = new AdminService(
    adminRepository,
    cacheService,
    emailService
);

export const healthService = new HealthService(
    healthRepository,
    cacheService,
    firebaseService
);
// ---------------------  controllers ---------------------------
export const adminController = new AdminController(adminService);
export const authController = new AuthController(authService);
export const userController = new UserController(userService);
export const plannerController = new PlannerController(plannerService);
export const sectionController = new SectionController(sectionService);
export const activityController = new ActivityController(activityService);
export const aiController = new AIController(aiService);
export const exportController = new ExportController(exportService);
export const healthController = new HealthController(healthService);
