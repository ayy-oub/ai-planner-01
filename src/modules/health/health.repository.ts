import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../../shared/services/firebase.service';
import { CacheService } from '../../shared/services/cache.service';
import { HealthHistory, HealthAlert, HealthReport } from './health.types';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { logger } from '../../shared/utils/logger';
import { subDays } from 'date-fns';

@Injectable()
export class HealthRepository {
    private readonly logger = new Logger(HealthRepository.name);
    private readonly db;
    private readonly cachePrefix = 'health:';

    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly cacheService: CacheService
    ) {
        this.db = this.firebaseService.getFirestore();
    }

    /**
     * Save health history
     */
    async saveHealthHistory(history: HealthHistory): Promise<void> {
        try {
            const historyRef = this.db.collection('healthHistory').doc(history.id);
            await historyRef.set({
                ...history,
                timestamp: FieldValue.serverTimestamp(),
            });

            logger.info(`Health history saved: ${history.id}`);
        } catch (error) {
            logger.error('Error saving health history:', error);
            throw error;
        }
    }

    /**
     * Get health history
     */
    async getHealthHistory(
        startDate: Date,
        endDate: Date,
        service?: string
    ): Promise<HealthHistory[]> {
        try {
            let query = this.db.collection('healthHistory')
                .where('timestamp', '>=', startDate)
                .where('timestamp', '<=', endDate)
                .orderBy('timestamp', 'desc')
                .limit(1000);

            if (service) {
                query = query.where('checks', 'array-contains', { name: service });
            }

            const snapshot = await query.get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date()
            } as HealthHistory));
        } catch (error) {
            logger.error('Error retrieving health history:', error);
            throw error;
        }
    }

    /**
     * Save health alert
     */
    async saveAlert(alert: HealthAlert): Promise<void> {
        try {
            const alertRef = this.db.collection('healthAlerts').doc(alert.id);
            await alertRef.set({
                ...alert,
                timestamp: FieldValue.serverTimestamp(),
            });

            logger.info(`Health alert saved: ${alert.id}`);
        } catch (error) {
            logger.error('Error saving health alert:', error);
            throw error;
        }
    }

    /**
     * Get health alerts
     */
    async getHealthAlerts(
        acknowledged?: boolean,
        resolved?: boolean,
        severity?: string
    ): Promise<HealthAlert[]> {
        try {
            let query = this.db.collection('healthAlerts').orderBy('timestamp', 'desc');

            if (acknowledged !== undefined) {
                query = query.where('acknowledged', '==', acknowledged);
            }

            if (resolved !== undefined) {
                query = query.where('resolved', '==', resolved);
            }

            if (severity) {
                query = query.where('severity', '==', severity);
            }

            const snapshot = await query.limit(100).get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date(),
                acknowledgedAt: doc.data().acknowledgedAt?.toDate(),
                resolvedAt: doc.data().resolvedAt?.toDate()
            } as HealthAlert));
        } catch (error) {
            logger.error('Error retrieving health alerts:', error);
            throw error;
        }
    }

    /**
     * Update health alert
     */
    async updateAlert(alertId: string, updates: Partial<HealthAlert>): Promise<void> {
        try {
            const alertRef = this.db.collection('healthAlerts').doc(alertId);
            await alertRef.update({
                ...updates,
                updatedAt: FieldValue.serverTimestamp(),
            });

            logger.info(`Health alert updated: ${alertId}`);
        } catch (error) {
            logger.error('Error updating health alert:', error);
            throw error;
        }
    }

    /**
     * Save health report
     */
    async saveHealthReport(report: HealthReport): Promise<void> {
        try {
            const reportRef = this.db.collection('healthReports').doc(report.id);
            await reportRef.set({
                ...report,
                timestamp: FieldValue.serverTimestamp(),
            });

            logger.info(`Health report saved: ${report.id}`);
        } catch (error) {
            logger.error('Error saving health report:', error);
            throw error;
        }
    }

    /**
     * Get latest health report
     */
    async getLatestHealthReport(): Promise<HealthReport | null> {
        try {
            const snapshot = await this.db.collection('healthReports')
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get();

            if (snapshot.empty) return null;

            const doc = snapshot.docs[0];
            return {
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date()
            } as HealthReport;
        } catch (error) {
            logger.error('Error retrieving latest health report:', error);
            throw error;
        }
    }

    /**
     * Get health statistics
     */
    async getHealthStats(startDate: Date, endDate: Date): Promise<any> {
        try {
            // Get health history for the period
            const history = await this.getHealthHistory(startDate, endDate);

            // Get alerts for the period
            const alertsSnapshot = await this.db.collection('healthAlerts')
                .where('timestamp', '>=', startDate)
                .where('timestamp', '<=', endDate)
                .get();

            const alerts = alertsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date()
            }));

            // Calculate statistics
            const stats = {
                period: {
                    start: startDate,
                    end: endDate,
                    duration: endDate.getTime() - startDate.getTime()
                },
                overall: {
                    totalChecks: history.length,
                    healthyChecks: history.filter(h => h.status === 'healthy').length,
                    degradedChecks: history.filter(h => h.status === 'degraded').length,
                    unhealthyChecks: history.filter(h => h.status === 'unhealthy').length,
                    uptimePercentage: 0
                },
                alerts: {
                    total: alerts.length,
                    bySeverity: {
                        low: alerts.filter(a => a.severity === 'low').length,
                        medium: alerts.filter(a => a.severity === 'medium').length,
                        high: alerts.filter(a => a.severity === 'high').length,
                        critical: alerts.filter(a => a.severity === 'critical').length
                    },
                    byType: alerts.reduce((acc, alert) => {
                        acc[alert.type] = (acc[alert.type] || 0) + 1;
                        return acc;
                    }, {}),
                    acknowledged: alerts.filter(a => a.acknowledged).length,
                    resolved: alerts.filter(a => a.resolved).length
                },
                services: {},
                trends: this.calculateTrends(history)
            };

            // Calculate uptime percentage
            if (stats.overall.totalChecks > 0) {
                stats.overall.uptimePercentage =
                    (stats.overall.healthyChecks / stats.overall.totalChecks) * 100;
            }

            // Service-specific statistics
            const serviceStats = this.calculateServiceStats(history);
            stats.services = serviceStats;

            return stats;
        } catch (error) {
            logger.error('Error calculating health statistics:', error);
            throw error;
        }
    }

    /**
     * Calculate service-specific statistics
     */
    private calculateServiceStats(history: HealthHistory[]): Record<string, any> {
        const serviceStats: Record<string, any> = {};

        history.forEach(record => {
            record.checks.forEach(check => {
                if (!serviceStats[check.name]) {
                    serviceStats[check.name] = {
                        total: 0,
                        healthy: 0,
                        degraded: 0,
                        unhealthy: 0,
                        avgResponseTime: 0,
                        maxResponseTime: 0,
                        minResponseTime: Infinity
                    };
                }

                const stats = serviceStats[check.name];
                stats.total++;
                stats[check.status]++;
                stats.avgResponseTime += check.duration;
                stats.maxResponseTime = Math.max(stats.maxResponseTime, check.duration);
                stats.minResponseTime = Math.min(stats.minResponseTime, check.duration);
            });
        });

        // Calculate averages
        Object.keys(serviceStats).forEach(service => {
            const stats = serviceStats[service];
            if (stats.total > 0) {
                stats.avgResponseTime = Math.round(stats.avgResponseTime / stats.total);
                if (stats.minResponseTime === Infinity) {
                    stats.minResponseTime = 0;
                }
                stats.availability = (stats.healthy / stats.total) * 100;
            }
        });

        return serviceStats;
    }

    /**
     * Calculate health trends
     */
    private calculateTrends(history: HealthHistory[]): any {
        if (history.length < 2) return {};

        const recent = history.slice(0, 10); // Last 10 records
        const older = history.slice(10, 20); // Previous 10 records

        const recentHealthy = recent.filter(h => h.status === 'healthy').length;
        const olderHealthy = older.filter(h => h.status === 'healthy').length;

        return {
            healthTrend: recentHealthy > olderHealthy ? 'improving' :
                recentHealthy < olderHealthy ? 'degrading' : 'stable',
            recentHealthRate: (recentHealthy / recent.length) * 100,
            olderHealthRate: olderHealthy > 0 ? (olderHealthy / older.length) * 100 : 100
        };
    }

    /**
     * Cleanup old health history
     */
    async cleanupOldHistory(cutoffDate: Date): Promise<number> {
        try {
            const snapshot = await this.db.collection('healthHistory')
                .where('timestamp', '<', cutoffDate)
                .limit(500)
                .get();

            const batch = this.db.batch();
            let deletedCount = 0;

            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
            });

            await batch.commit();

            logger.info(`Cleaned up ${deletedCount} old health history records`);
            return deletedCount;
        } catch (error) {
            logger.error('Error cleaning up old health history:', error);
            throw error;
        }
    }

    /**
     * Cleanup old health reports
     */
    async cleanupOldReports(cutoffDate: Date): Promise<number> {
        try {
            const snapshot = await this.db.collection('healthReports')
                .where('timestamp', '<', cutoffDate)
                .limit(500)
                .get();

            const batch = this.db.batch();
            let deletedCount = 0;

            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
                deletedCount++;
            });

            await batch.commit();

            logger.info(`Cleaned up ${deletedCount} old health reports`);
            return deletedCount;
        } catch (error) {
            logger.error('Error cleaning up old health reports:', error);
            throw error;
        }
    }

    /**
     * Get active alerts count
     */
    async getActiveAlertsCount(): Promise<number> {
        try {
            const snapshot = await this.db.collection('healthAlerts')
                .where('resolved', '==', false)
                .count()
                .get();

            return snapshot.data().count;
        } catch (error) {
            logger.error('Error getting active alerts count:', error);
            throw error;
        }
    }

    /**
     * Get critical alerts
     */
    async getCriticalAlerts(): Promise<HealthAlert[]> {
        try {
            const snapshot = await this.db.collection('healthAlerts')
                .where('severity', '==', 'critical')
                .where('resolved', '==', false)
                .orderBy('timestamp', 'desc')
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date(),
                acknowledgedAt: doc.data().acknowledgedAt?.toDate(),
                resolvedAt: doc.data().resolvedAt?.toDate()
            } as HealthAlert));
        } catch (error) {
            logger.error('Error getting critical alerts:', error);
            throw error;
        }
    }
}