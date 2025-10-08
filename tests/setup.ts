import { config } from 'dotenv';
import { join } from 'path';
import { logger } from '../src/shared/utils/logger';

// Load test environment variables
config({ path: join(__dirname, '../.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';

// Global test timeout
jest.setTimeout(30000);

// Mock console.log in tests unless explicitly enabled
if (!process.env.ENABLE_CONSOLE_LOG) {
    global.console.log = jest.fn();
    global.console.warn = jest.fn();
    global.console.error = jest.fn();
}

// Global test setup
beforeAll(async () => {
    logger.info('🧪 Starting test suite...');

    // Initialize any global test resources
    if (process.env.TEST_DATABASE_URL) {
        // Setup test database connection if needed
    }
});

afterAll(async () => {
    logger.info('✅ Test suite completed');

    // Cleanup global test resources
    if (process.env.TEST_DATABASE_URL) {
        // Cleanup test database if needed
    }
});

// Global test utilities
global.testUtils = {
    // Add any global test utilities here
    delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

    // Mock Firebase auth token
    mockAuthToken: {
        uid: 'test-user-id',
        email: 'test@example.com',
        role: 'user'
    },

    // Mock user data
    mockUser: {
        uid: 'test-user-id',
        email: 'test@example.com',
        displayName: 'Test User',
        emailVerified: true
    }
};

export { };