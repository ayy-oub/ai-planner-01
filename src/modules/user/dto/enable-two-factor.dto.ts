import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EnableTwoFactorDto {
    @ApiProperty({
        description: 'Two-factor authentication code',
        example: '123456',
        minLength: 6,
        maxLength: 6,
    })
    @IsString()
    @IsNotEmpty()
    @Length(6, 6)
    code: string;

    @ApiProperty({
        description: 'Backup verification code (if 2FA is being disabled)',
        example: 'ABC123',
        required: false,
    })
    @IsString()
    backupCode?: string;
}