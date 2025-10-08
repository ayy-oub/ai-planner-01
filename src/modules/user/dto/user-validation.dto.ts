import { IsString, IsOptional, IsEmail, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ValidateUserDto {
    @ApiPropertyOptional({
        description: 'User email to validate',
        example: 'john.doe@example.com',
    })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiPropertyOptional({
        description: 'User display name to validate',
        example: 'John Doe',
    })
    @IsString()
    @IsOptional()
    displayName?: string;

    @ApiPropertyOptional({
        description: 'User phone number to validate',
        example: '+1234567890',
    })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiPropertyOptional({
        description: 'Password to validate',
        example: 'SecurePassword123!',
    })
    @IsString()
    @IsOptional()
    password?: string;

    @ApiPropertyOptional({
        description: 'User preferences to validate',
        type: Object,
    })
    @IsOptional()
    preferences?: any;

    @ApiPropertyOptional({
        description: 'User settings to validate',
        type: Object,
    })
    @IsOptional()
    settings?: any;

    @ApiPropertyOptional({
        description: 'User social links to validate',
        type: Object,
    })
    @IsOptional()
    socialLinks?: any;
}

export class UserValidationResponseDto {
    @ApiProperty({
        description: 'Validation result',
        example: true,
    })
    valid: boolean;

    @ApiProperty({
        description: 'Validation errors',
        type: [String],
        example: ['Email format is invalid', 'Password is too weak'],
    })
    errors: string[];

    @ApiProperty({
        description: 'Validation warnings',
        type: [String],
        example: ['Phone number format may be invalid'],
    })
    warnings: string[];

    @ApiProperty({
        description: 'Improvement suggestions',
        type: [String],
        example: ['Consider adding a display name', 'Enable two-factor authentication'],
    })
    suggestions: string[];
}