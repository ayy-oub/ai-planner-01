import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSubscriptionDto {
    @ApiProperty({
        description: 'Subscription plan',
        enum: ['free', 'premium', 'enterprise'],
        example: 'premium',
    })
    @IsEnum(['free', 'premium', 'enterprise'])
    plan: 'free' | 'premium' | 'enterprise';

    @ApiProperty({
        description: 'Subscription status',
        enum: ['active', 'inactive', 'cancelled', 'past_due', 'trialing'],
        example: 'active',
    })
    @IsEnum(['active', 'inactive', 'cancelled', 'past_due', 'trialing'])
    status: 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing';

    @ApiPropertyOptional({
        description: 'Cancel at period end',
        example: false,
    })
    @IsOptional()
    cancelAtPeriodEnd?: boolean;

    @ApiPropertyOptional({
        description: 'Payment method ID',
        example: 'pm_123abc',
    })
    @IsString()
    @IsOptional()
    paymentMethod?: string;

    @ApiPropertyOptional({
        description: 'Subscription ID from payment provider',
        example: 'sub_123abc',
    })
    @IsString()
    @IsOptional()
    subscriptionId?: string;

    @ApiPropertyOptional({
        description: 'Customer ID from payment provider',
        example: 'cus_123abc',
    })
    @IsString()
    @IsOptional()
    customerId?: string;

    @ApiPropertyOptional({
        description: 'Price ID from payment provider',
        example: 'price_123abc',
    })
    @IsString()
    @IsOptional()
    priceId?: string;

    @ApiPropertyOptional({
        description: 'Trial end date (ISO string)',
        example: '2024-12-31T23:59:59Z',
    })
    @IsString()
    @IsOptional()
    trialEnd?: string;

    @ApiPropertyOptional({
        description: 'Current period start date (ISO string)',
        example: '2024-01-01T00:00:00Z',
    })
    @IsString()
    @IsOptional()
    currentPeriodStart?: string;

    @ApiPropertyOptional({
        description: 'Current period end date (ISO string)',
        example: '2024-01-31T23:59:59Z',
    })
    @IsString()
    @IsOptional()
    currentPeriodEnd?: string;

    @ApiPropertyOptional({
        description: 'Available features for this subscription',
        type: [String],
        example: ['unlimited_planners', 'advanced_analytics', 'priority_support'],
    })
    @IsOptional()
    features?: string[];

    @ApiPropertyOptional({
        description: 'Subscription limits',
        type: Object,
        example: {
            planners: 100,
            collaborators: 50,
            storage: 10240,
            exports: 100,
            aiRequests: 1000
        }
    })
    @IsOptional()
    limits?: {
        planners?: number;
        collaborators?: number;
        storage?: number;
        exports?: number;
        aiRequests?: number;
    };

    @ApiPropertyOptional({
        description: 'Reason for subscription change',
        example: 'User upgraded to premium plan',
        maxLength: 500,
    })
    @IsString()
    @MaxLength(500)
    @IsOptional()
    reason?: string;
}