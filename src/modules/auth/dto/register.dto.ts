import { IsEmail, IsString, IsBoolean, IsOptional, IsObject, ValidateNested, IsStrongPassword } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class DeviceInfoDto {
    @ApiProperty({
        description: 'User agent string',
        example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        required: false,
    })
    @IsString()
    @IsOptional()
    userAgent?: string;

    @ApiProperty({
        description: 'Unique device identifier',
        example: 'device-123-abc',
        required: false,
    })
    @IsString()
    @IsOptional()
    deviceId?: string;
}

export class RegisterDto {
    @ApiProperty({ description: 'User email address', example: 'newuser@example.com', required: true })
    @IsEmail()
    email!: string;

    @ApiProperty({
        description: 'User password - must be strong',
        example: 'StrongP@ssw0rd123',
        required: true,
        minLength: 8,
        maxLength: 128,
    })
    @IsStrongPassword({
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
    })
    password!: string;

    @ApiProperty({ description: 'Display name (optional)', example: 'John Doe', required: false })
    @IsString()
    @IsOptional()
    displayName?: string;

    @ApiProperty({ description: 'Must accept terms and conditions', example: true, required: true })
    @IsBoolean()
    acceptTerms!: boolean;

    @ApiProperty({ description: 'Opt-in for marketing emails', example: false, required: false, default: false })
    @IsBoolean()
    @IsOptional()
    marketingEmails?: boolean;

    @ApiProperty({ description: 'Device information for session management', type: DeviceInfoDto, required: false })
    @IsObject()
    @IsOptional()
    @ValidateNested()
    @Type(() => DeviceInfoDto)
    deviceInfo?: DeviceInfoDto;
}