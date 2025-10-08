import { logger } from '../src/shared/utils/logger';

// Global test teardown
module.exports = async () => {
    logger.info('🧹 Cleaning up after tests...');

    // Close any open connections
    if (global.__REDIS__) {
        await global.__REDIS__.quit();
    }

    if (global.__FIREBASE__) {
        await global.__FIREBASE__.cleanup();
    }

    // Clear any cached modules
    jest.clearAllMocks();

    logger.info('✅ Cleanup completed');
};