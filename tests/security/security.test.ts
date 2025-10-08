import request from 'supertest';
import app from '@/app';
import { testHelpers } from '../utils/test-helpers';

describe('Security Tests', () => {
    let accessToken: string;

    beforeAll(async () => {
        const { tokens } = await testHelpers.createTestUser({
            email: testHelpers.generateRandomData('email'),
            password: 'SecurityTest123!@#',
            displayName: 'Security Test User',
        });
        accessToken = tokens.accessToken;
    });

    describe('Input Validation', () => {
        it('should prevent XSS attacks', async () => {
            const xssPayloads = [
                '<script>alert("XSS")</script>',
                'javascript:alert("XSS")',
                '<img src=x onerror=alert("XSS")>',
                '"><script>alert("XSS")</script>',
            ];

            for (const payload of xssPayloads) {
                const response = await request(app)
                    .patch('/api/v1/auth/update-profile')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .send({
                        displayName: payload,
                    })
                    .expect(200);

                // Should be sanitized
                expect(response.body.data.user.displayName).not.toContain('<script>');
                expect(response.body.data.user.displayName).not.toContain('javascript:');
            }
        });

        it('should prevent SQL injection attempts', async () => {
            const sqlInjectionPayloads = [
                "'; DROP TABLE users; --",
                "' OR '1'='1",
                "admin'--",
                "1; WAITFOR DELAY '0:0:10'--",
            ];

            for (const payload of sqlInjectionPayloads) {
                const response = await request(app)
                    .post('/api/v1/auth/login')
                    .send({
                        email: payload,
                        password: 'password123',
                    });

                // Should not crash or reveal database information
                expect(response.status).toBe(400);
                expect(response.body).not.toContain('SQL');
                expect(response.body).not.toContain('DROP');
            }
        });

        it('should validate file upload types and sizes', async () => {
            const maliciousFiles = [
                { name: 'test.php', type: 'application/x-php', size: 1024 },
                { name: 'test.exe', type: 'application/x-msdownload', size: 1024 },
                { name: 'test.js', type: 'application/javascript', size: 1024 },
                { name: 'huge.jpg', type: 'image/jpeg', size: 100 * 1024 * 1024 }, // 100MB
            ];

            for (const file of maliciousFiles) {
                const response = await request(app)
                    .post('/api/v1/upload')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .attach('file', Buffer.alloc(file.size), file.name)
                    .expect(400);

                expect(response.body.error.code).toBe('INVALID_INPUT');
            }
        });
    });

    describe('Authentication Security', () => {
        it('should prevent timing attacks on login', async () => {
            const iterations = 10;
            const timings = [];

            for (let i = 0; i < iterations; i++) {
                const start = process.hrtime.bigint();

                await request(app)
                    .post('/api/v1/auth/login')
                    .send({
                        email: 'nonexistent@example.com',
                        password: 'wrongpassword',
                    });

                const end = process.hrtime.bigint();
                timings.push(Number(end - start));
            }

            // Response times should be consistent (within reasonable variance)
            const avg = timings.reduce((a, b) => a + b) / timings.length;
            const variance = timings.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / timings.length;
            const stdDev = Math.sqrt(variance);

            expect(stdDev).toBeLessThan(avg * 0.3); // Less than 30% standard deviation
        });

        it('should enforce strong password requirements', async () => {
            const weakPasswords = [
                '123456',
                'password',
                'Password', // No number or special char
                'Password123', // No special char
                'P@ssw0rd', // Too common
                '12345678',
            ];

            for (const password of weakPasswords) {
                const response = await request(app)
                    .post('/api/v1/auth/register')
                    .send({
                        email: testHelpers.generateRandomData('email'),
                        password,
                        displayName: 'Test User',
                        acceptTerms: true,
                    });

                expect(response.status).toBe(400);
                expect(response.body.errors).toBeDefined();
            }
        });

        it('should handle JWT token manipulation', async () => {
            const manipulations = [
                'invalid.token.format',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid',
            ];

            for (const token of manipulations) {
                const response = await request(app)
                    .get('/api/v1/auth/me')
                    .set('Authorization', `Bearer ${token}`)
                    .expect(401);

                expect(response.body.error.code).toBe('TOKEN_INVALID');
            }
        });
    });

    describe('Rate Limiting and DDoS Protection', () => {
        it('should implement exponential backoff for failed requests', async () => {
            const email = 'backoff.test@example.com';
            let lastDelay = 0;

            for (let i = 0; i < 5; i++) {
                const start = Date.now();

                await request(app)
                    .post('/api/v1/auth/login')
                    .send({
                        email,
                        password: 'wrongpassword',
                    });

                const delay = Date.now() - start;

                if (i > 0) {
                    expect(delay).toBeGreaterThan(lastDelay * 0.8); // Should increase
                }

                lastDelay = delay;
            }
        });

        it('should block suspicious IP addresses', async () => {
            const suspiciousIP = '192.168.1.100';

            // Simulate many failed requests from same IP
            for (let i = 0; i < 20; i++) {
                await request(app)
                    .post('/api/v1/auth/login')
                    .set('X-Forwarded-For', suspiciousIP)
                    .send({
                        email: 'suspicious@example.com',
                        password: 'wrongpassword',
                    });
            }

            // Next request should be blocked
            const response = await request(app)
                .post('/api/v1/auth/login')
                .set('X-Forwarded-For', suspiciousIP)
                .send({
                    email: 'suspicious@example.com',
                    password: 'wrongpassword',
                });

            expect(response.status).toBe(403);
            expect(response.body.error.message).toContain('blocked');
        });
    });

    describe('Header Security', () => {
        it('should set appropriate security headers', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.headers['x-content-type-options']).toBe('nosniff');
            expect(response.headers['x-frame-options']).toBe('DENY');
            expect(response.headers['x-xss-protection']).toBe('1; mode=block');
            expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
            expect(response.headers['strict-transport-security']).toBeDefined();
        });

        it('should not leak server information', async () => {
            const response = await request(app)
                .get('/health')
                .expect(200);

            expect(response.headers['x-powered-by']).toBeUndefined();
            expect(response.headers['server']).toBeUndefined();
        });
    });

    describe('CORS and CSRF Protection', () => {
        it('should enforce CORS policies', async () => {
            const origins = [
                'https://malicious-site.com',
                'http://localhost:3001',
                'null',
            ];

            for (const origin of origins) {
                const response = await request(app)
                    .options('/api/v1/auth/me')
                    .set('Origin', origin)
                    .set('Access-Control-Request-Method', 'GET');

                expect(response.headers['access-control-allow-origin']).not.toBe(origin);
            }
        });

        it('should validate content-type for state-changing operations', async () => {
            const endpoints = [
                { method: 'POST', path: '/api/v1/auth/login' },
                { method: 'PATCH', path: '/api/v1/auth/update-profile' },
                { method: 'POST', path: '/api/v1/planners' },
            ];

            for (const endpoint of endpoints) {
                const response = await request(app)
                [endpoint.method.toLowerCase()](endpoint.path)
                    .set('Authorization', endpoint.path.includes('update') ? `Bearer ${accessToken}` : '')
                    .set('Content-Type', 'text/plain')
                    .send('malicious payload');

                expect(response.status).toBe(400);
            }
        });
    });

    describe('Data Exposure Prevention', () => {
        it('should not expose sensitive data in errors', async () => {
            const response = await request(app)
                .post('/api/v1/auth/login')
                .send({
                    email: "test'; SELECT * FROM users; --",
                    password: 'password',
                });

            expect(response.status).toBe(400);
            expect(response.body).not.toContain('SELECT');
            expect(response.body).not.toContain('users');
            expect(response.body).not.toContain('database');
        });

        it('should sanitize error messages in production', async () => {
            // Force an error that might contain stack trace
            const response = await request(app)
                .get('/api/v1/nonexistent')
                .expect(404);

            expect(response.body.error.message).toBe('Route /api/v1/nonexistent not found');
            expect(response.body.error).not.toHaveProperty('stack');
        });
    });
});