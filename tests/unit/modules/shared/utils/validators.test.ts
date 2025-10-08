import {
    validateEmail,
    validatePassword,
    validateUsername,
    validateUrl,
    validatePhoneNumber,
    validateDateRange,
    validateFileUpload,
    validatePaginationParams
} from '../../../../src/shared/utils/validators';
import { AppError } from '../../../../src/shared/utils/errors';

describe('Validators', () => {
    describe('validateEmail', () => {
        it('should validate correct email addresses', () => {
            const validEmails = [
                'user@example.com',
                'test.user@domain.co.uk',
                'user+tag@example.com',
                'admin@localhost'
            ];

            validEmails.forEach(email => {
                expect(() => validateEmail(email)).not.toThrow();
            });
        });

        it('should reject invalid email addresses', () => {
            const invalidEmails = [
                'invalid-email',
                'user@',
                '@domain.com',
                'user@domain',
                '',
                'user space@domain.com'
            ];

            invalidEmails.forEach(email => {
                expect(() => validateEmail(email)).toThrow(AppError);
                expect(() => validateEmail(email)).toThrow('Invalid email format');
            });
        });

        it('should handle edge cases', () => {
            expect(() => validateEmail('')).toThrow('Email is required');
            expect(() => validateEmail(null as any)).toThrow('Email must be a string');
            expect(() => validateEmail(undefined as any)).toThrow('Email is required');
        });
    });

    describe('validatePassword', () => {
        it('should validate strong passwords', () => {
            const validPasswords = [
                'SecurePass123!',
                'MyP@ssw0rdIsStrong',
                'C0mpl3x!Pass2024',
                'Str0ng&Secure#Pass'
            ];

            validPasswords.forEach(password => {
                expect(() => validatePassword(password)).not.toThrow();
            });
        });

        it('should reject weak passwords', () => {
            const weakPasswords = [
                '123456',
                'password',
                'abc123',
                'short',
                'alllowercase',
                'ALLUPPERCASE',
                'NoNumbers!',
                'NoSpecialChars123'
            ];

            weakPasswords.forEach(password => {
                expect(() => validatePassword(password)).toThrow(AppError);
            });
        });

        it('should validate custom password requirements', () => {
            const customOptions = {
                minLength: 12,
                requireUppercase: true,
                requireLowercase: true,
                requireNumbers: true,
                requireSpecialChars: true,
                maxLength: 30
            };

            expect(() => validatePassword('Short1!', customOptions)).toThrow('at least 12 characters');
            expect(() => validatePassword('ValidPassword123!@#', customOptions)).not.toThrow();
        });

        it('should check for common password patterns', () => {
            const commonPatterns = [
                'Password123!',
                'Admin123!',
                'Welcome123!',
                'Qwerty123!'
            ];

            commonPatterns.forEach(password => {
                expect(() => validatePassword(password)).toThrow('too common');
            });
        });
    });

    describe('validateUsername', () => {
        it('should validate correct usernames', () => {
            const validUsernames = [
                'john_doe',
                'user123',
                'test_user_2024',
                'a',
                'user_name-test'
            ];

            validUsernames.forEach(username => {
                expect(() => validateUsername(username)).not.toThrow();
            });
        });

        it('should reject invalid usernames', () => {
            const invalidUsernames = [
                'user name', // space
                'user@name', // special char
                'us', // too short
                'a'.repeat(51), // too long
                '', // empty
                '123user', // starts with number
                '-user', // starts with dash
                'user-', // ends with dash
                '__double underscore'
            ];

            invalidUsernames.forEach(username => {
                expect(() => validateUsername(username)).toThrow(AppError);
            });
        });

        it('should handle reserved usernames', () => {
            const reservedUsernames = ['admin', 'root', 'system', 'api', 'www'];

            reservedUsernames.forEach(username => {
                expect(() => validateUsername(username)).toThrow('reserved');
            });
        });
    });

    describe('validateUrl', () => {
        it('should validate correct URLs', () => {
            const validUrls = [
                'https://example.com',
                'http://localhost:3000',
                'https://sub.domain.co.uk/path',
                'https://example.com/path?param=value',
                'https://example.com#section'
            ];

            validUrls.forEach(url => {
                expect(() => validateUrl(url)).not.toThrow();
            });
        });

        it('should reject invalid URLs', () => {
            const invalidUrls = [
                'not-a-url',
                'http://',
                '://example.com',
                'example.com',
                'http://example',
                ''
            ];

            invalidUrls.forEach(url => {
                expect(() => validateUrl(url)).toThrow(AppError);
            });
        });

        it('should validate specific URL protocols', () => {
            const httpsOnly = { allowedProtocols: ['https:'] };

            expect(() => validateUrl('https://example.com', httpsOnly)).not.toThrow();
            expect(() => validateUrl('http://example.com', httpsOnly)).toThrow('HTTPS required');
        });
    });

    describe('validatePhoneNumber', () => {
        it('should validate correct phone numbers', () => {
            const validNumbers = [
                '+1234567890',
                '+1 (555) 123-4567',
                '+44 20 7946 0958',
                '+86 138 0013 8000',
                '123-456-7890'
            ];

            validNumbers.forEach(number => {
                expect(() => validatePhoneNumber(number)).not.toThrow();
            });
        });

        it('should reject invalid phone numbers', () => {
            const invalidNumbers = [
                '123',
                'abcdefghijk',
                '+123',
                '++++123',
                '123-456-789',
                'invalid-number'
            ];

            invalidNumbers.forEach(number => {
                expect(() => validatePhoneNumber(number)).toThrow(AppError);
            });
        });

        it('should validate specific country formats', () => {
            const usOptions = { country: 'US' };
            const ukOptions = { country: 'UK' };

            expect(() => validatePhoneNumber('+1 555 123 4567', usOptions)).not.toThrow();
            expect(() => validatePhoneNumber('+44 20 7946 0958', ukOptions)).not.toThrow();
            expect(() => validatePhoneNumber('+44 20 7946 0958', usOptions)).toThrow('US format');
        });
    });

    describe('validateDateRange', () => {
        it('should validate correct date ranges', () => {
            const validRanges = [
                {
                    start: new Date('2024-01-01'),
                    end: new Date('2024-01-31')
                },
                {
                    start: new Date(),
                    end: new Date(Date.now() + 24 * 60 * 60 * 1000)
                }
            ];

            validRanges.forEach(range => {
                expect(() => validateDateRange(range)).not.toThrow();
            });
        });

        it('should reject invalid date ranges', () => {
            const invalidRanges = [
                {
                    start: new Date('2024-01-31'),
                    end: new Date('2024-01-01') // end before start
                },
                {
                    start: new Date('invalid'),
                    end: new Date('2024-01-31')
                },
                {
                    start: new Date('2024-01-01'),
                    end: new Date('invalid')
                }
            ];

            invalidRanges.forEach(range => {
                expect(() => validateDateRange(range)).toThrow(AppError);
            });
        });

        it('should validate date range limits', () => {
            const maxRange = 30 * 24 * 60 * 60 * 1000; // 30 days
            const tooLongRange = {
                start: new Date('2024-01-01'),
                end: new Date('2024-03-01') // 60 days
            };

            expect(() => validateDateRange(tooLongRange, { maxRange })).toThrow('30 days');
        });

        it('should require future dates when specified', () => {
            const pastRange = {
                start: new Date(Date.now() - 24 * 60 * 60 * 1000),
                end: new Date()
            };

            expect(() => validateDateRange(pastRange, { requireFuture: true })).toThrow('future');
        });
    });

    describe('validateFileUpload', () => {
        const mockFile = {
            originalname: 'test.pdf',
            mimetype: 'application/pdf',
            size: 1024 * 1024, // 1MB
            buffer: Buffer.from('file content')
        };

        it('should validate correct file uploads', () => {
            expect(() => validateFileUpload(mockFile)).not.toThrow();
        });

        it('should reject files based on size limits', () => {
            const largeFile = {
                ...mockFile,
                size: 10 * 1024 * 1024 // 10MB
            };

            expect(() => validateFileUpload(largeFile, { maxSize: 5 * 1024 * 1024 }))
                .toThrow('5MB');
        });

        it('should reject files based on type restrictions', () => {
            const exeFile = {
                ...mockFile,
                originalname: 'virus.exe',
                mimetype: 'application/x-msdownload'
            };

            expect(() => validateFileUpload(exeFile, {
                allowedTypes: ['image/jpeg', 'image/png', 'application/pdf']
            })).toThrow('PDF, JPG, PNG');
        });

        it('should validate file name', () => {
            const invalidNameFile = {
                ...mockFile,
                originalname: '../../../etc/passwd'
            };

            expect(() => validateFileUpload(invalidNameFile)).toThrow('Invalid file name');
        });

        it('should scan for malicious content when specified', () => {
            const mockScan = jest.fn().mockReturnValue({ isSafe: false, threats: ['virus'] });

            const suspiciousFile = { ...mockFile };

            expect(() => validateFileUpload(suspiciousFile, {
                scanForViruses: true,
                virusScanner: mockScan
            })).toThrow('malicious content');

            expect(mockScan).toHaveBeenCalled();
        });
    });

    describe('validatePaginationParams', () => {
        it('should validate correct pagination parameters', () => {
            const validParams = [
                { page: 1, limit: 10 },
                { page: 5, limit: 50 },
                { page: 1, limit: 100 }
            ];

            validParams.forEach(params => {
                expect(() => validatePaginationParams(params)).not.toThrow();
            });
        });

        it('should reject invalid pagination parameters', () => {
            const invalidParams = [
                { page: 0, limit: 10 }, // page too low
                { page: -1, limit: 10 }, // negative page
                { page: 1, limit: 0 }, // limit too low
                { page: 1, limit: 1000 }, // limit too high
                { page: 10000, limit: 10 } // page too high
            ];

            invalidParams.forEach(params => {
                expect(() => validatePaginationParams(params)).toThrow(AppError);
            });
        });

        it('should apply default values', () => {
            const result = validatePaginationParams({});

            expect(result.page).toBe(1);
            expect(result.limit).toBe(20);
        });

        it('should validate sort parameters', () => {
            const validSort = { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' };
            const invalidSort = { page: 1, limit: 10, sortBy: 'invalid_field' };

            expect(() => validatePaginationParams(validSort)).not.toThrow();
            expect(() => validatePaginationParams(invalidSort, {
                allowedSortFields: ['createdAt', 'updatedAt']
            })).toThrow('Invalid sort field');
        });
    });
});