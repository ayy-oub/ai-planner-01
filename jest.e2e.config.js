/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',

    // E2E test patterns
    testMatch: [
        '**/tests/e2e/**/*.test.ts',
        '**/tests/e2e/**/*.spec.ts'
    ],

    // Longer timeout for E2E tests
    testTimeout: 60000,

    // Setup files
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    globalTeardown: '<rootDir>/tests/teardown.ts',

    // Run tests sequentially for E2E
    maxWorkers: 1,
    runInBand: true,

    // Module name mapping
    moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@shared/(.*)$': '<rootDir>/src/shared/$1',
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1'
    },

    // Transform configuration
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            tsconfig: {
                esModuleInterop: true,
                allowSyntheticDefaultImports: true
            }
        }]
    },

    // Display name
    displayName: {
        name: 'AI-PLANNER-API-E2E',
        color: 'green'
    },

    // Verbose output
    verbose: true
};