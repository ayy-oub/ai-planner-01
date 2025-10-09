import { Server } from 'http';
import Redis from 'ioredis';
import { logger } from './logger';

export interface ShutdownOptions {
  timeout?: number; // Maximum wait for shutdown (ms)
  forceExit?: boolean; 
  signals?: NodeJS.Signals[];
  cleanup?: () => Promise<void>;
}

export interface DisposableResource {
  name: string;
  close: () => Promise<void>;
  isConnected?: () => boolean;
}

export class GracefulShutdownManager {
  private resources: DisposableResource[] = [];
  private isShuttingDownFlag = false;
  private options: Required<ShutdownOptions>;

  constructor(options: ShutdownOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000,
      forceExit: options.forceExit !== false,
      signals: options.signals ?? ['SIGTERM', 'SIGINT', 'SIGUSR2'],
      cleanup: options.cleanup ?? (async () => {}),
    };

    this.setupSignalHandlers();
  }

  private setupSignalHandlers(): void {
    this.options.signals.forEach(sig => {
      process.on(sig, () => {
        logger.info(`Received signal ${sig}, starting graceful shutdown`);
        this.shutdown(sig).catch(err => {
          logger.error('Shutdown error in signal handler', { err: err instanceof Error ? err.message : String(err) });
        });
      });
    });

    process.on('uncaughtException', (error: unknown) => {
      logger.error('Uncaught exception', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      this.shutdown('UNCAUGHT_EXCEPTION').catch(() => process.exit(1));
    });

    process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
      logger.error('Unhandled rejection', { reason, promise });
      this.shutdown('UNHANDLED_REJECTION').catch(() => process.exit(1));
    });
  }

  addResource(resource: DisposableResource): void {
    this.resources.push(resource);
    logger.info(`Added resource for cleanup: ${resource.name}`);
  }

  addHttpServer(server: Server, name = 'HTTP Server'): void {
    this.addResource({
      name,
      close: () => new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => {
          if (error) {
            logger.error(`Error closing ${name}`, { error: error.message });
            reject(error);
          } else {
            logger.info(`${name} closed successfully`);
            resolve();
          }
        });
      }),
      isConnected: () => {
        // Type assertion: Node.js Server has `listening`
        // @ts-ignore
        return (server as any).listening === true;
      },
    });
  }

  addRedis(redisClient: Redis, name = 'Redis'): void {
    this.addResource({
      name,
      close: async () => {
        await redisClient.quit();
        logger.info(`${name} connection closed`);
      },
      isConnected: () => redisClient.status === 'ready',
    });
  }

  addDatabase(connection: any, name = 'Database'): void {
    this.addResource({
      name,
      close: async () => {
        if (typeof connection.close === 'function') {
          await connection.close();
        } else if (typeof connection.destroy === 'function') {
          connection.destroy();
        }
        logger.info(`${name} connection closed`);
      },
      isConnected: () => {
        if ('readyState' in connection) {
          return connection.readyState === 1;
        }
        if ('connected' in connection) {
          return connection.connected === true;
        }
        return false;
      },
    });
  }

  public async shutdown(signal: string | NodeJS.Signals): Promise<void> {
    if (this.isShuttingDownFlag) {
      logger.warn('Shutdown already in progress');
      return;
    }
    this.isShuttingDownFlag = true;
    const start = Date.now();

    try {
      logger.info('Starting graceful shutdown', { signal, resources: this.resources.length });

      // (Optional) stop accepting new connections: typically HTTP servers do this automatically after close()

      logger.info('Running custom cleanup');
      await this.runWithTimeout(this.options.cleanup(), 5000, 'Custom cleanup timed out');

      logger.info('Closing resources');
      await this.closeResources();

      await this.finalCleanup();

      const duration = Date.now() - start;
      logger.info('Graceful shutdown completed', { duration: `${duration}ms` });

      process.exit(0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Graceful shutdown failed', {
        error: msg,
        duration: `${Date.now() - start}ms`,
      });

      if (this.options.forceExit) {
        logger.warn('Forcing exit due to shutdown failure');
        process.exit(1);
      }
    }
  }

  private async closeResources(): Promise<void> {
    const reversed = [...this.resources].reverse();
    for (const resource of reversed) {
      try {
        logger.info(`Closing resource: ${resource.name}`);
        if (resource.isConnected && !resource.isConnected()) {
          logger.info(`Resource ${resource.name} already disconnected`);
          continue;
        }
        await this.runWithTimeout(resource.close(), 10000, `Resource ${resource.name} close timed out`);
        logger.info(`Resource ${resource.name} closed successfully`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Error closing resource ${resource.name}`, { error: msg });
      }
    }
  }

  private async finalCleanup(): Promise<void> {
    logger.info('Performing final cleanup');
    try {
      // If logger has transports to close, do it here
      // Clearing intervals / timeouts, etc.
      // Using internal Node methods is risky: process._getActiveHandles etc.
      // You may wrap it in try/catch or mark @ts-ignore
      // ...
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('Final cleanup error', { error: msg });
    }
  }

  private async runWithTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });
    return Promise.race([promise, timeout]);
  }

  public isShuttingDown(): boolean {
    return this.isShuttingDownFlag;
  }

  public getResourceStatus(): Array<{ name: string; status: 'connected' | 'disconnected' | 'unknown' }> {
    return this.resources.map(res => ({
      name: res.name,
      status: res.isConnected
        ? (res.isConnected() ? 'connected' : 'disconnected')
        : 'unknown'
    }));
  }
}

export class HealthCheckManager {
  private checks = new Map<string, () => Promise<boolean>>();

  addCheck(name: string, checkFn: () => Promise<boolean>): void {
    this.checks.set(name, checkFn);
  }

  async runChecks(): Promise<{ status: 'healthy' | 'unhealthy'; checks: Record<string, boolean> }> {
    const results: Record<string, boolean> = {};
    let allHealthy = true;

    const promises = Array.from(this.checks.entries()).map(async ([name, fn]) => {
      try {
        const ok = await fn();
        results[name] = ok;
        if (!ok) allHealthy = false;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`Health check failed for ${name}`, { error: msg });
        results[name] = false;
        allHealthy = false;
      }
    });

    await Promise.all(promises);

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      checks: results,
    };
  }
}

export class ProcessManager {
  private shutdownManager: GracefulShutdownManager;
  private healthCheckManager: HealthCheckManager;

  constructor(options?: ShutdownOptions) {
    this.shutdownManager = new GracefulShutdownManager(options);
    this.healthCheckManager = new HealthCheckManager();
  }

  getShutdownManager(): GracefulShutdownManager {
    return this.shutdownManager;
  }

  getHealthCheckManager(): HealthCheckManager {
    return this.healthCheckManager;
  }

  setupMonitoring(): void {
    // Memory usage monitor
    const memoryCheck = setInterval(() => {
      const usage = process.memoryUsage();
      const usedMb = (usage.heapUsed / 1024 / 1024).toFixed(2);
      const totalMb = (usage.heapTotal / 1024 / 1024).toFixed(2);

      if (usage.heapUsed > 500 * 1024 * 1024) {
        logger.warn('High memory usage detected', {
          heapUsed: `${usedMb}MB`,
          heapTotal: `${totalMb}MB`,
          rss: `${(usage.rss / 1024 / 1024).toFixed(2)}MB`,
        });
      }
    }, 30000);

    this.shutdownManager.addResource({
      name: 'Memory Monitor',
      close: async () => {
        clearInterval(memoryCheck);
      },
    });

    // Event loop lag monitor
    let last = process.hrtime.bigint();
    const lagCheck = setInterval(() => {
      const now = process.hrtime.bigint();
      const diffMs = Number(now - last) / 1_000_000 - 1000;
      if (diffMs > 1000) {
        logger.warn('Event loop lag detected', { lag: `${diffMs.toFixed(2)}ms` });
      }
      last = now;
    }, 1000);

    this.shutdownManager.addResource({
      name: 'Event Loop Monitor',
      close: async () => {
        clearInterval(lagCheck);
      },
    });
  }
}

export const cleanupUtils = {
  async closeDatabaseConnections(): Promise<void> {
    logger.info('Closing database connections');
    // ...
  },
  async closeCacheConnections(): Promise<void> {
    logger.info('Closing cache connections');
    // ...
  },
  async stopBackgroundJobs(): Promise<void> {
    logger.info('Stopping background jobs');
    // ...
  },
  async closeFileHandles(): Promise<void> {
    logger.info('Closing file handles');
    // ...
  },
  async cleanupTemporaryFiles(): Promise<void> {
    logger.info('Cleaning up temporary files');
    // ...
  },
  async notifyExternalServices(): Promise<void> {
    logger.info('Notifying external services of shutdown');
    // ...
  }
};

export const setupGracefulShutdown = (
  server?: Server,
  redisClient?: Redis,
  options?: ShutdownOptions
): GracefulShutdownManager => {
  const manager = new GracefulShutdownManager(options);
  if (server) {
    manager.addHttpServer(server);
  }
  if (redisClient) {
    manager.addRedis(redisClient);
  }

  manager.addResource({
    name: 'Default Cleanup',
    close: async () => {
      await Promise.all([
        cleanupUtils.closeDatabaseConnections(),
        cleanupUtils.closeCacheConnections(),
        cleanupUtils.stopBackgroundJobs(),
        cleanupUtils.cleanupTemporaryFiles(),
        cleanupUtils.notifyExternalServices(),
      ]);
    }
  });

  return manager;
};

export const emergencyShutdown = (reason: string, code = 1): void => {
  logger.error('Emergency shutdown initiated', { reason, code });
  console.error('Emergency shutdown stack trace:');
  console.trace();
  setTimeout(() => {
    process.exit(code);
  }, 1000);
};
