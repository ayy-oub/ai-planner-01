import { IsString, IsOptional, IsIn, IsHexColor, IsBoolean, IsISO6391 } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
    @ApiProperty({
        description: 'Display name',
        example: 'John Doe',
        required: false,
        minLength: 2,
        maxLength: 50,
    })
    @IsString()
    @IsOptional()
    displayName?: string;

    @ApiProperty({
        description: 'Profile photo URL',
        example: 'https://example.com/photo.jpg',
        required: false,
    })
    @IsString()
    @IsOptional()
    photoURL?: string;

    @ApiProperty({
        description: 'Theme preference',
        example: 'dark',
        required: false,
        enum: ['light', 'dark', 'auto'],
    })
    @IsIn(['light', 'dark', 'auto'])
    @IsOptional()
    theme?: 'light' | 'dark' | 'auto';

    @ApiProperty({
        description: 'Accent color in hex format',
        example: '#3B82F6',
        required: false,
    })
    @IsHexColor()
    @IsOptional()
    accentColor?: string;

    @ApiProperty({
        description: 'Default view preference',
        example: 'weekly',
        required: false,
        enum: ['daily', 'weekly', 'monthly'],
    })
    @IsIn(['daily', 'weekly', 'monthly'])
    @IsOptional()
    defaultView?: 'daily' | 'weekly' | 'monthly';

    @ApiProperty({
        description: 'Enable/disable notifications',
        example: true,
        required: false,
    })
    @IsBoolean()
    @IsOptional()
    notifications?: boolean;

    @ApiProperty({
        description: 'Language code (ISO 639-1)',
        example: 'en',
        required: false,
    })
    @IsISO6391()
    @IsOptional()
    language?: string;

    @ApiProperty({
        description: 'Timezone identifier',
        example: 'America/New_York',
        required: false,
    })
    @IsString()
    @IsOptional()
    timezone?: string;

    @ApiProperty({
        description: 'Date format preference',
        example: 'MM/DD/YYYY',
        required: false,
        enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
    })
    @IsIn(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'])
    @IsOptional()
    dateFormat?: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';

    @ApiProperty({
        description: 'Time format preference',
        example: '12h',
        required: false,
        enum: ['12h', '24h'],
    })
    @IsIn(['12h', '24h'])
    @IsOptional()
    timeFormat?: '12h' | '24h';
}

export class UpdateProfileResponseDto {
    @ApiProperty({
        description: 'Update status',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Success message',
        example: 'Profile updated successfully',
    })
    message: string;

    @ApiProperty({
        description: 'Updated user data',
        type: Object,
    })
    data: {
        user: any;
    };
}