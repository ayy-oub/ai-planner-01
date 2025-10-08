import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../../shared/services/firebase.service';
import { CacheService } from '../../shared/services/cache.service';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const readFile = promisify(fs.readFile);

@Injectable()
export class HandwritingRepository {
    private readonly logger = new Logger(HandwritingRepository.name);
    private readonly collectionName = 'handwriting_processing';
    private readonly uploadDir = path.join(process.cwd(), 'uploads', 'handwriting');

    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly cacheService: CacheService,
    ) {
        // Ensure upload directory exists
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    /**
     * Save handwriting processing result to Firebase
     */
    async saveProcessingResult(userId: string, result: any): Promise<string> {
        try {
            const db = this.firebaseService.getFirestore();
            const docRef = await db.collection(this.collectionName).add({
                userId,
                ...result,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            return docRef.id;
        } catch (error) {
            this.logger.error(`Failed to save processing result: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get handwriting processing history for user
     */
    async getProcessingHistory(userId: string, limit: number, offset: number): Promise<any[]> {
        try {
            const cacheKey = `handwriting_history:${userId}:${limit}:${offset}`;
            const cached = await this.cacheService.get(cacheKey);

            if (cached) {
                return cached;
            }

            const db = this.firebaseService.getFirestore();
            const snapshot = await db.collection(this.collectionName)
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .offset(offset)
                .get();

            const history = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Cache for 15 minutes
            await this.cacheService.set(cacheKey, history, 900);

            return history;
        } catch (error) {
            this.logger.error(`Failed to fetch processing history: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get processing statistics for user
     */
    async getProcessingStats(userId: string, startDate?: Date, endDate?: Date): Promise<any> {
        try {
            const db = this.firebaseService.getFirestore();
            let query = db.collection(this.collectionName)
                .where('userId', '==', userId);

            if (startDate) {
                query = query.where('createdAt', '>=', startDate);
            }
            if (endDate) {
                query = query.where('createdAt', '<=', endDate);
            }

            const snapshot = await query.get();

            const stats = {
                totalProcessed: snapshot.size,
                languageDistribution: {},
                averageConfidence: 0,
                averageProcessingTime: 0
            };

            if (snapshot.size > 0) {
                let totalConfidence = 0;
                let totalProcessingTime = 0;

                snapshot.forEach(doc => {
                    const data = doc.data();

                    // Language distribution
                    const lang = data.language || 'en';
                    stats.languageDistribution[lang] = (stats.languageDistribution[lang] || 0) + 1;

                    // Sum for averages
                    totalConfidence += data.confidence || 0;
                    totalProcessingTime += data.processingTime || 0;
                });

                stats.averageConfidence = totalConfidence / snapshot.size;
                stats.averageProcessingTime = totalProcessingTime / snapshot.size;
            }

            return stats;
        } catch (error) {
            this.logger.error(`Failed to fetch processing stats: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get specific processing result
     */
    async getProcessingResult(resultId: string, userId: string): Promise<any> {
        try {
            const db = this.firebaseService.getFirestore();
            const doc = await db.collection(this.collectionName)
                .doc(resultId)
                .get();

            if (!doc.exists) {
                return null;
            }

            const data = doc.data();

            // Ensure user owns this result
            if (data.userId !== userId) {
                return null;
            }

            return {
                id: doc.id,
                ...data
            };
        } catch (error) {
            this.logger.error(`Failed to fetch processing result: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete processing result
     */
    async deleteProcessingResult(resultId: string, userId: string): Promise<boolean> {
        try {
            const db = this.firebaseService.getFirestore();

            // First check if user owns this result
            const doc = await db.collection(this.collectionName)
                .doc(resultId)
                .get();

            if (!doc.exists || doc.data().userId !== userId) {
                return false;
            }

            await db.collection(this.collectionName)
                .doc(resultId)
                .delete();

            return true;
        } catch (error) {
            this.logger.error(`Failed to delete processing result: ${error.message}`);
            throw error;
        }
    }

    /**
     * Save temporary file
     */
    async saveTemporaryFile(fileName: string, buffer: Buffer): Promise<string> {
        const filePath = path.join(this.uploadDir, fileName);
        await writeFile(filePath, buffer);
        return filePath;
    }

    /**
     * Delete temporary file
     */
    async deleteTemporaryFile(filePath: string): Promise<void> {
        try {
            if (fs.existsSync(filePath)) {
                await unlink(filePath);
            }
        } catch (error) {
            this.logger.warn(`Failed to delete temporary file: ${error.message}`);
        }
    }

    /**
     * Get user processing count for rate limiting
     */
    async getUserProcessingCount(userId: string, timeWindow: number = 3600000): Promise<number> {
        try {
            const db = this.firebaseService.getFirestore();
            const startTime = new Date(Date.now() - timeWindow);

            const snapshot = await db.collection(this.collectionName)
                .where('userId', '==', userId)
                .where('createdAt', '>=', startTime)
                .count()
                .get();

            return snapshot.data().count;
        } catch (error) {
            this.logger.error(`Failed to get user processing count: ${error.message}`);
            return 0;
        }
    }
}