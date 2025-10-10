import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TokenDto {
    @ApiProperty({
        description: 'Refresh token',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        required: true,
    })
    @IsString()
    @IsNotEmpty()
    refreshToken!: string;
}

export class TokenResponseDto {
    @ApiProperty({
        description: 'Token refresh status',
        example: true,
    })
    success!: boolean;

    @ApiProperty({
        description: 'Success message',
        example: 'Token refreshed successfully',
    })
    message!: string;

    @ApiProperty({
        description: 'New tokens',
        type: Object,
    })
    data!: {
        tokens: {
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
            tokenType: string;
        };
    };
}