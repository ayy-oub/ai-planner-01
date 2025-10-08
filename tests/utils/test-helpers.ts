import request from 'supertest';
import app from '@/app';
import { FirebaseService } from '@shared/services/firebase.service';
import { CacheService } from '@shared/services/cache.service';

export class TestHelpers {
  private firebaseService: FirebaseService;
  private cacheService: CacheService;

  constructor() {
    this.firebaseService = new FirebaseService();
    this.cacheService = new CacheService();
  }

  /**
   * Create a test user and return auth tokens
   */
  async createTestUser(userData: any) {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...userData,
        acceptTerms: true,
      });

    if (response.status !== 201) {
      throw new Error(`Failed to create test user: ${response.body.message}`);
    }

    return {
      user: response.body.data.user,
      tokens: response.body.data.tokens,
    };
  }

  /**
   * Login as existing user
   */
  async loginUser(email: string, password: string) {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });

    if (response.status !== 200) {
      throw new Error(`Failed to login user: ${response.body.message}`);
    }

    return {
      user: response.body.data.user,
      tokens: response.body.data.tokens,
    };
  }

  /**
   * Create a test planner
   */
  async createPlanner(accessToken: string, plannerData: any) {
    const response = await request(app)
      .post('/api/v1/planners')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(plannerData);

    if (response.status !== 201) {
      throw new Error(`Failed to create planner: ${response.body.message}`);
    }

    return response.body.data.planner;
  }

  /**
   * Create test sections
   */
  async createSections(accessToken: string, plannerId: string, sections: any[]) {
    const createdSections = [];

    for (const section of sections) {
      const response = await request(app)
        .post(`/api/v1/planners/${plannerId}/sections`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(section);

      if (response.status !== 201) {
        throw new Error(`Failed to create section: ${response.body.message}`);
      }

      createdSections.push(response.body.data.section);
    }

    return createdSections;
  }

  /**
   * Clean up test data
   */
  async cleanup() {
    try {
      // Clear cache
      await this.cacheService.flushall();

      // Clean up test users from Firebase
      const testUserEmails = [
        testUsers.admin.email,
        testUsers.regular.email,
        testUsers.premium.email,
      ];

      for (const email of testUserEmails) {
        try {
          const user = await this.firebaseService.getUserByEmail(email);
          if (user) {
            await this.firebaseService.deleteUser(user.uid);
          }
        } catch (error) {
          // Ignore errors for non-existent users
        }
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  /**
   * Wait for a condition to be met
   */
  async waitFor(condition: () => Promise<boolean>, timeout = 10000, interval = 500) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await this.delay(interval);
    }

    throw new Error('Timeout waiting for condition');
  }

  /**
   * Delay execution
   */
  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate random test data
   */
  generateRandomData(type: string) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);

    switch (type) {
      case 'email':
        return `test.${timestamp}.${random}@example.com`;
      case 'planner':
        return {
          title: `Test Planner ${timestamp}`,
          color: ['blue', 'green', 'purple', 'orange'][Math.floor(Math.random() * 4)],
          icon: ['calendar', 'star', 'heart', 'target'][Math.floor(Math.random() * 4)],
          description: `Test planner description ${random}`,
        };
      case 'section':
        return {
          title: `Test Section ${timestamp}`,
          type: ['todo_list', 'notes', 'habit_tracker'][Math.floor(Math.random() * 3)],
          content: { text: `Test content ${random}` },
        };
      default:
        return `test-${timestamp}-${random}`;
    }
  }

  /**
   * Validate API response structure
   */
  validateApiResponse(response: any, expectedStatus = 200) {
    expect(response.status).toBe(expectedStatus);

    if (expectedStatus >= 200 && expectedStatus < 300) {
      expect(response.body).toMatchObject({
        success: true,
        message: expect.any(String),
        data: expect.any(Object),
      });
    } else {
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: expect.any(String),
          message: expect.any(String),
        },
      });
    }
  }

  /**
   * Simulate concurrent requests
   */
  async simulateConcurrentRequests(requests: Array<() => Promise<any>>, maxConcurrent = 10) {
    const results = [];
    const executing = [];

    for (const request of requests) {
      const promise = request().then(result => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });

      results.push(promise);
      executing.push(promise);

      if (executing.length >= maxConcurrent) {
        await Promise.race(executing);
      }
    }

    return Promise.all(results);
  }

  /**
   * Measure API response time
   */
  async measureResponseTime(requestFn: () => Promise<any>, iterations = 10) {
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await requestFn();
      const end = process.hrtime.bigint();
      times.push(Number(end - start) / 1e6); // Convert to milliseconds
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    return {
      average: avg,
      min,
      max,
      times,
    };
  }
}

export const testHelpers = new TestHelpers();F