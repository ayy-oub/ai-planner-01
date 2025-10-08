import { IsString, IsOptional, IsUrl, MaxLength, MinLength, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
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
        description: 'User bio or description',
        example: 'Productivity enthusiast and AI planner user',
        maxLength: 500,
    })
    @IsString()
    @MaxLength(500)
    @IsOptional()
    bio?: string;

    @ApiPropertyOptional({
        description: 'User avatar URL',
        example: 'https://example.com/avatar.jpg',
    })
    @IsUrl()
    @IsOptional()
    photoURL?: string;

    @ApiPropertyOptional({
        description: 'User phone number',
        example: '+1234567890',
    })
    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @ApiPropertyOptional({
        description: 'User location/city',
        example: 'New York, USA',
        maxLength: 100,
    })
    @IsString()
    @MaxLength(100)
    @IsOptional()
    location?: string;

    @ApiPropertyOptional({
        description: 'User website URL',
        example: 'https://johndoe.com',
    })
    @IsUrl()
    @IsOptional()
    website?: string;

    @ApiPropertyOptional({
        description: 'User social links',
        type: 'object',
        example: {
            twitter: 'https://twitter.com/johndoe',
            linkedin: 'https://linkedin.com/in/johndoe',
            github: 'https://github.com/johndoe'
        }
    })
    @IsOptional()
    socialLinks?: {
        twitter?: string;
        linkedin?: string;
        github?: string;
        facebook?: string;
        instagram?: string;
    };

    @ApiPropertyOptional({
        description: 'User pronouns',
        example: 'he/him',
        maxLength: 20,
    })
    @IsString()
    @MaxLength(20)
    @IsOptional()
    pronouns?: string;

    @ApiPropertyOptional({
        description: 'User job title',
        example: 'Software Engineer',
        maxLength: 100,
    })
    @IsString()
    @MaxLength(100)
    @IsOptional()
    jobTitle?: string;

    @ApiPropertyOptional({
        description: 'User company',
        example: 'Tech Corp',
        maxLength: 100,
    })
    @IsString()
    @MaxLength(100)
    @IsOptional()
    company?: string;

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
        description: 'User language preference',
        example: 'en',
        maxLength: 10,
    })
    @IsString()
    @MaxLength(10)
    @IsOptional()
    language?: string;

    @ApiPropertyOptional({
        description: 'User birthday',
        example: '1990-01-01',
    })
    @IsString()
    @IsOptional()
    birthday?: string;

    @ApiPropertyOptional({
        description: 'User gender',
        example: 'male',
        enum: ['male', 'female', 'non-binary', 'prefer-not-to-say', 'other'],
    })
    @IsEnum(['male', 'female', 'non-binary', 'prefer-not-to-say', 'other'])
    @IsOptional()
    gender?: string;
}