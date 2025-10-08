import autocannon from 'autocannon';
import { testHelpers } from '../utils/test-helpers';
import { config } from '@shared/config';

describe('Performance Tests', () => {
    let accessToken: string;
    const baseUrl = `http://localhost:${config.app.port}`;

    beforeAll(async () => {
        // Create test user and get access token
        const { tokens } = await testHelpers.createTestUser({
            email: testHelpers.generateRandomData('email'),
            password: 'PerfTest123!@#',
            displayName: 'Performance Test User',
        });
        accessToken = tokens.accessToken;
    });

    describe('Load Testing', () => {
        it('should handle 100 concurrent requests to health endpoint', async () => {
            const result = await autocannon({
                url: `${baseUrl}/health`,
                connections: 100,
                duration: 10,
                timeout: 5,
            });

            expect(result.errors).toBe(0);
            expect(result.timeouts).toBe(0);
            expect(result.requests.average).toBeGreaterThan(50); // At least 50 req/s
            expect(result.latency.average).toBeLessThan(100); // Less than 100ms average
        });

        it('should handle 50 concurrent requests to protected endpoint', async () => {
            const result = await autocannon({
                url: `${baseUrl}/api/v1/auth/me`,
                connections: 50,
                duration: 10,
                timeout: 5,
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            expect(result.errors).toBe(0);
            expect(result.timeouts).toBe(0);
            expect(result.requests.average).toBeGreaterThan(25);
            expect(result.latency.average).toBeLessThan(200);
        });

        it('should handle mixed load across multiple endpoints', async () => {
            const scenarios = [
                { url: '/health', weight: 20 },
                { url: '/api/v1/auth/me', weight: 30, headers: { Authorization: `Bearer ${accessToken}` } },
                { url: '/api/v1/planners', weight: 50, headers: { Authorization: `Bearer ${accessToken}` } },
            ];

            const result = await autocannon({
                url: baseUrl,
                connections: 30,
                duration: 30,
                timeout: 5,
                requests: scenarios.map(s => ({
                    method: 'GET',
                    path: s.url,
                    headers: s.headers || {},
                    weight: s.weight,
                })),
            });

            expect(result.errors).toBe(0);
            expect(result.timeouts).toBe(0);
            expect(result.requests.average).toBeGreaterThan(100);
        });
    });

    describe('Stress Testing', () => {
        it('should handle sustained high load', async () => {
            const result = await autocannon({
                url: `${baseUrl}/health`,
                connections: 200,
                duration: 60, // 1 minute
                timeout: 10,
            });

            expect(result.errors).toBeLessThan(result.requests.total * 0.01); // Less than 1% errors
            expect(result.latency.p99).toBeLessThan(1000); // 99th percentile under 1s
        });

        it('should recover from spike load', async () => {
            // First, normal load
            const normalResult = await autocannon({
                url: `${baseUrl}/health`,
                connections: 10,
                duration: 10,
            });

            // Then, spike load
            const spikeResult = await autocannon({
                url: `${baseUrl}/health`,
                connections: 500,
                duration: 5,
            });

            // Then, normal load again
            const recoveryResult = await autocannon({
                url: `${baseUrl}/health`,
                connections: 10,
                duration: 10,
            });

            expect(normalResult.latency.average).toBeLessThan(50);
            expect(recoveryResult.latency.average).toBeLessThan(100);
            expect(recoveryResult.requests.average).toBeGreaterThan(normalResult.requests.average * 0.8);
        });
    });

    describe('Endpoint-Specific Performance', () => {
        it('should meet response time requirements for auth endpoints', async () => {
            const endpoints = [
                { path: '/api/v1/auth/register', method: 'POST', body: { email: testHelpers.generateRandomData('email'), password: 'Test123!@#', displayName: 'Perf Test', acceptTerms: true } },
                { path: '/api/v1/auth/login', method: 'POST', body: { email: testHelpers.generateRandomData('email'), password: 'Test123!@#' } },
                { path: '/api/v1/auth/me', method: 'GET', headers: { Authorization: `Bearer ${accessToken}` } },
            ];

            for (const endpoint of endpoints) {
                const result = await autocannon({
                    url: `${baseUrl}${endpoint.path}`,
                    method: endpoint.method,
                    body: endpoint.body ? JSON.stringify(endpoint.body) : undefined,
                    headers: {
                        'Content-Type': 'application/json',
                        ...endpoint.headers,
                    },
                    connections: 10,
                    duration: 10,
                });

                expect(result.latency.average).toBeLessThan(500);
                expect(result.latency.p95).toBeLessThan(1000);
            }
        });

        it('should handle planner creation load', async () => {
            const plannerData = {
                title: 'Performance Test Planner',
                color: 'blue',
                icon: 'calendar',
                description: 'Testing performance',
            };

            const result = await autocannon({
                url: `${baseUrl}/api/v1/planners`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify(plannerData),
                connections: 20,
                duration: 30,
            });

            expect(result.errors).toBe(0);
            expect(result.requests.average).toBeGreaterThan(10);
            expect(result.latency.average).toBeLessThan(1000);
        });
    });

    describe('Memory and Resource Usage', () => {
        it('should not leak memory under sustained load', async () => {
            const initialMemory = process.memoryUsage().heapUsed;

            await autocannon({
                url: `${baseUrl}/api/v1/auth/me`,
                headers: { Authorization: `Bearer ${accessToken}` },
                connections: 50,
                duration: 60,
            });

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;

            // Memory increase should be less than 50MB
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
        });
    });
});