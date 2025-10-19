// src/modules/health/health.repository.ts
import { Logger } from '@nestjs/common';
import { CacheService } from '../../shared/services/cache.service';
import { FirebaseService } from '../../shared/services/firebase.service';
import {
    HealthAlert,
    HealthHistory,
    HealthReport,
} from './health.types';
import { cacheService, firebaseService } from '@/shared/container';

export class HealthRepository {
    private readonly logger = new Logger(HealthRepository.name);

    constructor() { }
    get cacheService(): CacheService { return cacheService; }
    get firebaseService(): FirebaseService { return firebaseService; }

    private get db() {
        return this.firebaseService.db;
    }

    /**
     * 🧠 Save Health Report
     */
    async saveHealthReport(report: HealthReport): Promise<void> {
        try {
            await this.db.collection('healthReports').doc(report.id).set(report);
            await this.cacheService.set(`health:report:${report.id}`, report, { ttl: 300 }); // cache 5 min
        } catch (error) {
            this.logger.error('Failed to save health report', error);
            throw error;
        }
    }

    /**
     * 🧠 Save Health History
     */
    async saveHealthHistory(history: HealthHistory): Promise<void> {
        try {
            await this.db.collection('healthHistory').doc(history.id).set(history);
            await this.cacheService.set(`health:history:${history.id}`, history, { ttl: 300 });
        } catch (error) {
            this.logger.error('Failed to save health history', error);
            throw error;
        }
    }

    /**
     * 🧠 Get Health History
     */
    async getHealthHistory(startDate: Date, endDate: Date, service?: string): Promise<HealthHistory[]> {
        const cacheKey = `health:history:${startDate.toISOString()}-${endDate.toISOString()}-${service ?? 'all'}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached) return cached;

        try {
            let query = this.db
                .collection('healthHistory')
                .where('timestamp', '>=', startDate)
                .where('timestamp', '<=', endDate);

            if (service) {
                query = query.where('service', '==', service);
            }

            const snapshot = await query.get();
            const data = snapshot.docs.map((doc) => doc.data() as HealthHistory);

            await this.cacheService.set(cacheKey, data, { ttl: 60 });
            return data;
        } catch (error) {
            this.logger.error('Failed to get health history', error);
            throw error;
        }
    }

    /**
     * 🧠 Save Alert
     */
    async saveAlert(alert: HealthAlert): Promise<void> {
        try {
            await this.db.collection('healthAlerts').doc(alert.id).set(alert);
            await this.cacheService.set(`health:alert:${alert.id}`, alert, { ttl: 300 });
        } catch (error) {
            this.logger.error('Failed to save health alert', error);
            throw error;
        }
    }

    /**
     * 🧠 Update Alert
     */
    async updateAlert(alertId: string, updates: Partial<HealthAlert>): Promise<void> {
        try {
            const ref = this.db.collection('healthAlerts').doc(alertId);
            await ref.update(updates);

            // Invalidate cache
            await this.cacheService.delete(`health:alert:${alertId}`);
        } catch (error) {
            this.logger.error(`Failed to update alert ${alertId}`, error);
            throw error;
        }
    }

    /**
     * 🧠 Get Alerts
     */
    async getHealthAlerts(
        acknowledged?: boolean,
        resolved?: boolean,
        severity?: string,
    ): Promise<HealthAlert[]> {
        const cacheKey = `health:alerts:${acknowledged ?? 'all'}-${resolved ?? 'all'}-${severity ?? 'all'}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached) return cached as HealthAlert[];

        try {
            let q: FirebaseFirestore.Query = this.db.collection('healthAlerts');

            if (acknowledged !== undefined) q = q.where('acknowledged', '==', acknowledged);
            if (resolved !== undefined) q = q.where('resolved', '==', resolved);
            if (severity) q = q.where('severity', '==', severity);

            const snap = await q.get();
            const data = snap.docs.map(d => d.data() as HealthAlert);

            await this.cacheService.set(cacheKey, data, { ttl: 60 });
            return data;
        } catch (error) {
            this.logger.error('Failed to get health alerts', error);
            throw error;
        }
    }

    /**
     * 🧠 Cleanup Old Health History
     */
    async cleanupOldHistory(beforeDate: Date): Promise<void> {
        try {
            const snapshot = await this.db.collection('healthHistory').where('timestamp', '<', beforeDate).get();
            const batch = this.db.batch();
            snapshot.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
            this.logger.log(`Cleaned up ${snapshot.size} old health history entries`);
        } catch (error) {
            this.logger.error('Failed to cleanup old history', error);
        }
    }
}
