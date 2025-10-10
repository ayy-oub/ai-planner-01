import { IsEmail, IsString, IsBoolean, IsOptional, IsObject, ValidateNested } from 'class-validator';
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

export class LoginDto {
    @ApiProperty({
        description: 'User email address',
        example: 'user@example.com',
        required: true,
    })
    @IsEmail()
    email!: string;

    @ApiProperty({
        description: 'User password',
        example: 'StrongP@ssw0rd',
        required: true,
        minLength: 8,
        maxLength: 128,
    })
    @IsString()
    password!: string;

    @ApiProperty({
        description: 'Remember me option',
        example: true,
        required: false,
        default: false,
    })
    @IsBoolean()
    @IsOptional()
    rememberMe?: boolean;

    @ApiProperty({
        description: 'Device information for session management',
        type: DeviceInfoDto,
        required: false,
    })
    @IsObject()
    @IsOptional()
    @ValidateNested()
    @Type(() => DeviceInfoDto)
    deviceInfo?: DeviceInfoDto;
}

export class LoginResponseDto {
    @ApiProperty({
        description: 'Authentication status',
        example: true,
    })
    success!: boolean;

    @ApiProperty({
        description: 'Success message',
        example: 'Login successful',
    })
    message!: string;

    @ApiProperty({
        description: 'User data',
        type: Object,
    })
    data!: {
        user: any;
        tokens: {
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
            tokenType: string;
        };
    };
}