import { IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSessionDto {
    @ApiProperty({
        description: 'Session token',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    @IsString()
    token: string;

    @ApiPropertyOptional({
        description: 'Refresh token',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    })
    @IsString()
    @IsOptional()
    refreshToken?: string;

    @ApiProperty({
        description: 'Device information',
        type: Object,
        example: {
            type: 'desktop',
            os: 'Windows 11',
            browser: 'Chrome',
            version: '120.0.0.0'
        }
    })
    @IsObject()
    deviceInfo: {
        type: string;
        os: string;
        browser: string;
        version: string;
    };

    @ApiPropertyOptional({
        description: 'Location information',
        type: Object,
        example: {
            country: 'United States',
            city: 'New York',
            coordinates: { lat: 40.7128, lng: -74.0060 }
        }
    })
    @IsObject()
    @IsOptional()
    location?: {
        country: string;
        city: string;
        coordinates?: { lat: number; lng: number };
    };

    @ApiProperty({
        description: 'IP address',
        example: '192.168.1.1',
    })
    @IsString()
    ipAddress: string;

    @ApiProperty({
        description: 'User agent string',
        example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',
    })
    @IsString()
    userAgent: string;
}

export class SessionFiltersDto {
    @ApiPropertyOptional({
        description: 'Filter by active sessions only',
        example: true,
    })
    @IsBoolean()
    @IsOptional()
    activeOnly?: boolean;

    @ApiPropertyOptional({
        description: 'Filter by device type',
        enum: ['desktop', 'mobile', 'tablet'],
        example: 'mobile',
    })
    @IsEnum(['desktop', 'mobile', 'tablet'])
    @IsOptional()
    deviceType?: 'desktop' | 'mobile' | 'tablet';

    @ApiPropertyOptional({
        description: 'Filter by location',
        example: 'United States',
    })
    @IsString()
    @IsOptional()
    location?: string;

    @ApiPropertyOptional({
        description: 'Filter by IP address',
        example: '192.168.1.1',
    })
    @IsString()
    @IsOptional()
    ipAddress?: string;
}

export class InvalidateSessionDto {
    @ApiProperty({
        description: 'Reason for invalidating session',
        example: 'User requested logout',
        maxLength: 200,
    })
    @IsString()
    @IsOptional()
    reason?: string;

    @ApiProperty({
        description: 'Invalidate all sessions except current one',
        example: false,
    })
    @IsBoolean()
    @IsOptional()
    invalidateAllOthers?: boolean;
}