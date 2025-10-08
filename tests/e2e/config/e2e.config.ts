import { config } from '@shared/config';

export const e2eConfig = {
    ...config,
    app: {
        ...config.app,
        port: 5001, // Use different port for E2E tests
    },
    test: {
        timeout: 30000,
        retries: 3,
        delay: 1000,
        cleanup: true,
    },
    database: {
        testDatabase: 'ai_planner_test',
        cleanupInterval: 60000, // 1 minute
    },
    services: {
        mockExternal: true,
        email: {
            testInbox: 'test@example.com',
            checkInterval: 5000,
        },
    },
};

export const testUsers = {
    admin: {
        email: 'admin.test@example.com',
        password: 'AdminTest123!@#',
        displayName: 'Test Admin',
    },
    regular: {
        email: 'user.test@example.com',
        password: 'UserTest123!@#',
        displayName: 'Test User',
    },
    premium: {
        email: 'premium.test@example.com',
        password: 'PremiumTest123!@#',
        displayName: 'Test Premium User',
    },
};

export const testPlanners = {
    daily: {
        title: 'Daily Planner',
        color: 'blue',
        icon: 'calendar',
        description: 'Daily planning and tasks',
    },
    weekly: {
        title: 'Weekly Planner',
        color: 'green',
        icon: 'calendar-week',
        description: 'Weekly goals and review',
    },
    project: {
        title: 'Project Planner',
        color: 'purple',
        icon: 'project',
        description: 'Project management and tracking',
    },
};