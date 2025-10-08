import { IsString, IsOptional, IsBoolean, IsArray, IsEmail, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSecurityDto {
    @ApiPropertyOptional({
        description: 'Recovery email address',
        example: 'recovery@example.com',
    })
    @IsEmail()
    @IsOptional()
    recoveryEmail?: string;

    @ApiPropertyOptional({
        description: 'Enable two-factor authentication',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    twoFactorEnabled?: boolean;

    @ApiPropertyOptional({
        description: 'Data encryption enabled',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    dataEncryptionEnabled?: boolean;

    @ApiPropertyOptional({
        description: 'Trusted devices',
        type: [Object],
        example: [{
            name: 'iPhone 12',
            type: 'mobile',
            os: 'iOS 15.0',
            browser: 'Safari',
            ipAddress: '192.168.1.1'
        }]
    })
    @IsOptional()
    trustedDevices?: Array<{
        id?: string;
        name: string;
        type: string;
        os: string;
        browser: string;
        ipAddress: string;
    }>;

    @ApiPropertyOptional({
        description: 'Security questions',
        type: [Object],
        example: [{
            question: 'What is your mother\'s maiden name?',
            answer: 'Smith'
        }]
    })
    @IsOptional()
    securityQuestions?: Array<{
        id?: string;
        question: string;
        answer: string;
    }>;

    @ApiPropertyOptional({
        description: 'Current password (required for sensitive changes)',
        example: 'CurrentPassword123!',
    })
    @IsString()
    @MinLength(8)
    @MaxLength(128)
    @IsOptional()
    currentPassword?: string;

    @ApiPropertyOptional({
        description: 'New password',
        example: 'NewPassword123!',
        minLength: 8,
        maxLength: 128,
    })
    @IsString()
    @MinLength(8)
    @MaxLength(128)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    })
    @IsOptional()
    newPassword?: string;

    @ApiPropertyOptional({
        description: 'Confirm new password',
        example: 'NewPassword123!',
    })
    @IsString()
    @IsOptional()
    confirmPassword?: string;

    @ApiPropertyOptional({
        description: 'Session timeout in minutes',
        example: 60,
        minimum: 15,
        maximum: 1440,
    })
    @IsOptional()
    sessionTimeout?: number;

    @ApiPropertyOptional({
        description: 'Require two-factor for sensitive operations',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    requireTwoFactorForSensitive?: boolean;

    @ApiPropertyOptional({
        description: 'Login notification settings',
        type: 'object',
        example: {
            email: true,
            sms: false,
            push: true
        }
    })
    @IsOptional()
    loginNotifications?: {
        email?: boolean;
        sms?: boolean;
        push?: boolean;
    };

    @ApiPropertyOptional({
        description: 'Suspicious activity alerts',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    suspiciousActivityAlerts?: boolean;
}