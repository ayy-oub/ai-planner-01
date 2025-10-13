import { container } from 'tsyringe';

// Repositories
import { AuthRepository } from '../modules/auth/auth.repository';

// Shared services
import { CacheService } from './services/cache.service';
import { EmailService } from './services/email.service';
import { AuditService } from './services/audit.service';
import { QueueService } from './services/queue.service';
import { FirebaseService } from './services/firebase.service';

// Register repositories
container.registerSingleton<AuthRepository>('AuthRepository', AuthRepository);

// Register shared services
container.registerSingleton<CacheService>('CacheService', CacheService);
container.registerSingleton<EmailService>('EmailService', EmailService);
container.registerSingleton<AuditService>('AuditService', AuditService);
container.registerSingleton<QueueService>('QueueService', QueueService);
container.registerSingleton<FirebaseService>('FirebaseService', FirebaseService);

export { container };
