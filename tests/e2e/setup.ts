import 'dotenv/config';
import { config } from '@shared/config';
import { testHelpers } from '../utils/test-helpers';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PORT = '5001'; // Use different port for E2E tests

// Start test server
let server: any;

beforeAll(async () => {
    console.log('🚀 Starting E2E test server...');

    // Import app without starting server
    const app = require('@/app').default;
    const http = require('http');

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
        server.listen(5001, () => {
            console.log('✅ Test server started on port 5001');
            resolve();
        });
    });

    // Clean up any existing test data
    await testHelpers.cleanup();
}, 30000);

afterAll(async () => {
    console.log('🧹 Cleaning up E2E test data...');

    // Clean up test data
    await testHelpers.cleanup();

    // Stop test server
    if (server) {
        await new Promise<void>((resolve) => {
            server.close(() => {
                console.log('✅ Test server stopped');
                resolve();
            });
        });
    }
}, 30000);

// Global test configuration
global.__E2E_CONFIG__ = {
    baseUrl: 'http://localhost:5001',
    timeout: 60000,
    retries: 3,
};