import { IsString, IsStrongPassword, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
    @ApiProperty({
        description: 'Password reset token',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    token: string;

    @ApiProperty({
        description: 'New password',
        example: 'NewStrongP@ssw0rd123',
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
    newPassword: string;

    @ApiProperty({
        description: 'Confirm new password',
        example: 'NewStrongP@ssw0rd123',
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    confirmPassword: string;
}

export class ResetPasswordResponseDto {
    @ApiProperty({
        description: 'Reset status',
        example: true,
    })
    success: boolean;

    @ApiProperty({
        description: 'Success message',
        example: 'Password reset successfully',
    })
    message: string;
}