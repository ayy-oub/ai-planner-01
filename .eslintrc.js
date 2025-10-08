module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
    },
    plugins: [
        '@typescript-eslint',
        'security',
    ],
    extends: [
        'eslint:recommended',
        '@typescript-eslint/recommended',
        '@typescript-eslint/recommended-requiring-type-checking',
        'prettier',
        'plugin:security/recommended',
    ],
    root: true,
    env: {
        node: true,
        jest: true,
    },
    ignorePatterns: ['.eslintrc.js', 'dist/', 'node_modules/', 'coverage/'],
    rules: {
        // TypeScript specific
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/prefer-const': 'error',
        '@typescript-eslint/no-var-requires': 'error',

        // Security
        'security/detect-object-injection': 'error',
        'security/detect-eval-with-expression': 'error',
        'security/detect-non-literal-regexp': 'error',
        'security/detect-unsafe-regex': 'error',
        'security/detect-buffer-noassert': 'error',
        'security/detect-child-process': 'error',
        'security/detect-disable-mustache-escape': 'error',
        'security/detect-no-csrf-before-method-override': 'error',
        'security/detect-non-literal-fs-filename': 'error',
        'security/detect-non-literal-require': 'error',
        'security/detect-possible-timing-attacks': 'error',
        'security/detect-pseudoRandomBytes': 'error',

        // General
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        'no-debugger': 'error',
        'prefer-const': 'error',
        'no-var': 'error',
        'object-shorthand': 'error',
        'prefer-template': 'error',
        'template-curly-spacing': 'error',
        'arrow-spacing': 'error',
        'prefer-arrow-callback': 'error',
        'arrow-parens': ['error', 'always'],
        'arrow-body-style': ['error', 'as-needed'],
        'no-duplicate-imports': 'error',
        'no-useless-constructor': 'error',
        'no-unused-expressions': 'error',
        'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
        'max-len': ['error', { code: 120, ignoreUrls: true }],
        'comma-dangle': ['error', 'always-multiline'],
        'quotes': ['error', 'single', { avoidEscape: true }],
        'semi': ['error', 'always'],
        'indent': ['error', 2],
        'linebreak-style': ['error', 'unix'],
        'eol-last': 'error',
        'no-trailing-spaces': 'error',
        'object-curly-spacing': ['error', 'always'],
        'array-bracket-spacing': ['error', 'never'],
        'space-before-function-paren': ['error', {
            anonymous: 'always',
            named: 'never',
            asyncArrow: 'always'
        }],
    },
    overrides: [
        {
            files: ['*.test.ts', '*.spec.ts'],
            rules: {
                '@typescript-eslint/no-explicit-any': 'off',
                'security/detect-object-injection': 'off',
            },
        },
        {
            files: ['*.config.ts', '*.config.js'],
            rules: {
                '@typescript-eslint/no-var-requires': 'off',
                'security/detect-non-literal-require': 'off',
            },
        },
    ],
};