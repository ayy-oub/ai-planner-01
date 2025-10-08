/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',

    // Test file patterns
    testMatch: [
        '**/tests/**/*.test.ts',
        '**/tests/**/*.spec.ts'
    ],

    // Module paths
    moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@shared/(.*)$': '<rootDir>/src/shared/$1',
        '^@modules/(.*)$': '<rootDir>/src/modules/$1',
        '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1'
    },

    // Setup files
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
    globalTeardown: '<rootDir>/tests/teardown.ts',

    // Coverage configuration
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/**/*.interface.ts',
        '!src/**/index.ts',
        '!src/**/types.ts',
        '!src/server.ts',
        '!src/app.ts'
    ],

    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        }
    },

    // Test timeout
    testTimeout: 30000,

    // Verbose output
    verbose: true,

    // Clear mocks between tests
    clearMocks: true,

    // Reset modules between tests
    resetModules: true,

    // Coverage providers
    coverageProvider: 'v8',

    // Transform configuration
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            tsconfig: {
                esModuleInterop: true,
                allowSyntheticDefaultImports: true
            }
        }]
    },

    // Test path ignore patterns
    testPathIgnorePatterns: [
        '<rootDir>/node_modules/',
        '<rootDir>/dist/',
        '<rootDir>/build/',
        '<rootDir>/coverage/'
    ],

    // Module file extensions
    moduleFileExtensions: ['ts', 'js', 'json'],

    // Display name
    displayName: {
        name: 'AI-PLANNER-API',
        color: 'blue'
    },

    // Fake timers
    fakeTimers: {
        enableGlobally: true
    }
};