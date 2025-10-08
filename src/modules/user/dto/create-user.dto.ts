import { IsString, IsEmail, IsOptional, IsBoolean, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
    @ApiProperty({
        description: 'User email address',
        example: 'john.doe@example.com',
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        description: 'User password',
        example: 'SecurePassword123!',
        minLength: 8,
        maxLength: 128,
    })
    @IsString()
    @MinLength(8)
    @MaxLength(128)
    @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
        message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    })
    password: string;

    @ApiPropertyOptional({
        description: 'User display name',
        example: 'John Doe',
        minLength: 2,
        maxLength: 50,
    })
    @IsString()
    @MinLength(2)
    @MaxLength(50)
    @IsOptional()
    displayName?: string;

    @ApiPropertyOptional({
        description: 'User phone number',
        example: '+1234567890',
    })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiPropertyOptional({
        description: 'Accept terms and conditions',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    acceptTerms?: boolean;

    @ApiPropertyOptional({
        description: 'Subscribe to newsletter',
        example: false,
    })
    @IsBoolean()
    @IsOptional()
    newsletter?: boolean;

    @ApiPropertyOptional({
        description: 'Referral code',
        example: 'REF123',
        maxLength: 20,
    })
    @IsString()
    @MaxLength(20)
    @IsOptional()
    referralCode?: string;

    @ApiPropertyOptional({
        description: 'User timezone',
        example: 'America/New_York',
        maxLength: 50,
    })
    @IsString()
    @MaxLength(50)
    @IsOptional()
    timezone?: string;

    @ApiPropertyOptional({
        description: 'User language',
        example: 'en',
        maxLength: 10,
    })
    @IsString()
    @MaxLength(10)
    @IsOptional()
    language?: string;
}