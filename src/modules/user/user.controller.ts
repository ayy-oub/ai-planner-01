import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    ValidationPipe,
    UsePipes,
    HttpCode,
    HttpStatus,
    ParseIntPipe,
    DefaultValuePipe,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
    ApiParam,
    ApiBody,
    ApiConsumes,
    ApiHeader,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { AuthGuard } from '../../shared/middleware/auth.middleware';
import { AdminGuard } from '../../shared/middleware/admin.middleware';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateSecurityDto } from './dto/update-security.dto';
import { EnableTwoFactorDto } from './dto/enable-two-factor.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { UserProfileResponseDto, UserPreferencesResponseDto, UserSettingsResponseDto, UserSubscriptionResponseDto } from './dto/user-response.dto';

@ApiTags('User')
@Controller('users')
export class UserController {
    constructor(private readonly userService: UserService) { }

    /**
     * Get current user profile
     */
    @Get('me')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get current user profile',
        description: 'Get the profile of the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User profile retrieved successfully',
        type: UserProfileResponseDto,
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getCurrentUserProfile(@CurrentUser() user: any): Promise<UserProfileResponseDto> {
        const profile = await this.userService.getUserProfile(user.uid);

        return {
            success: true,
            data: profile,
        };
    }

    /**
     * Update current user profile
     */
    @Patch('me/profile')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Update current user profile',
        description: 'Update the profile of the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User profile updated successfully',
        type: UserProfileResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid request data',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    async updateCurrentUserProfile(
        @Body() updateDto: UpdateProfileDto,
        @CurrentUser() user: any
    ): Promise<UserProfileResponseDto> {
        const updatedProfile = await this.userService.updateUserProfile(user.uid, updateDto);

        return {
            success: true,
            data: updatedProfile,
            message: 'Profile updated successfully',
        };
    }

    /**
     * Upload user avatar
     */
    @Post('me/avatar')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Upload user avatar',
        description: 'Upload a new avatar image for the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Avatar uploaded successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'object',
                    properties: {
                        photoURL: { type: 'string' },
                    },
                },
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid file format or size',
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                avatar: {
                    type: 'string',
                    format: 'binary',
                    description: 'Avatar image file (max 5MB, formats: jpg, png, gif)',
                },
            },
        },
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @UseInterceptors(FileInterceptor('avatar'))
    async uploadAvatar(
        @UploadedFile() file: Express.Multer.File,
        @CurrentUser() user: any
    ): Promise<any> {
        // Validate file
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.mimetype)) {
            throw new BadRequestException('Invalid file format. Only JPG, PNG, and GIF are allowed');
        }

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            throw new BadRequestException('File size exceeds 5MB limit');
        }

        // Upload file (implementation would go here)
        const photoURL = `https://storage.googleapis.com/bucket/avatars/${user.uid}/${file.filename}`;

        // Update user profile
        await this.userService.updateUserProfile(user.uid, { photoURL });

        return {
            success: true,
            data: { photoURL },
            message: 'Avatar uploaded successfully',
        };
    }

    /**
     * Get user preferences
     */
    @Get('me/preferences')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get user preferences',
        description: 'Get the preferences of the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User preferences retrieved successfully',
        type: UserPreferencesResponseDto,
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getUserPreferences(@CurrentUser() user: any): Promise<UserPreferencesResponseDto> {
        const preferences = await this.userService.getUserPreferences(user.uid);

        return {
            success: true,
            data: preferences,
        };
    }

    /**
     * Update user preferences
     */
    @Patch('me/preferences')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Update user preferences',
        description: 'Update the preferences of the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User preferences updated successfully',
        type: UserPreferencesResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid request data',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    async updateUserPreferences(
        @Body() preferencesDto: UpdatePreferencesDto,
        @CurrentUser() user: any
    ): Promise<UserPreferencesResponseDto> {
        const updatedPreferences = await this.userService.updateUserPreferences(user.uid, preferencesDto);

        return {
            success: true,
            data: updatedPreferences,
            message: 'Preferences updated successfully',
        };
    }

    /**
     * Get user settings
     */
    @Get('me/settings')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get user settings',
        description: 'Get the settings of the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User settings retrieved successfully',
        type: UserSettingsResponseDto,
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getUserSettings(@CurrentUser() user: any): Promise<UserSettingsResponseDto> {
        const settings = await this.userService.getUserSettings(user.uid);

        return {
            success: true,
            data: settings,
        };
    }

    /**
     * Update user settings
     */
    @Patch('me/settings')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Update user settings',
        description: 'Update the settings of the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User settings updated successfully',
        type: UserSettingsResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid request data',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    async updateUserSettings(
        @Body() settingsDto: UpdateSettingsDto,
        @CurrentUser() user: any
    ): Promise<UserSettingsResponseDto> {
        const updatedSettings = await this.userService.updateUserSettings(user.uid, settingsDto);

        return {
            success: true,
            data: updatedSettings,
            message: 'Settings updated successfully',
        };
    }

    /**
     * Get user statistics
     */
    @Get('me/statistics')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get user statistics',
        description: 'Get usage statistics for the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User statistics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: { type: 'object' },
            },
        },
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getUserStatistics(@CurrentUser() user: any): Promise<any> {
        const statistics = await this.userService.getUserStatistics(user.uid);

        return {
            success: true,
            data: statistics,
        };
    }

    /**
     * Get user subscription
     */
    @Get('me/subscription')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get user subscription',
        description: 'Get subscription information for the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User subscription retrieved successfully',
        type: UserSubscriptionResponseDto,
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getUserSubscription(@CurrentUser() user: any): Promise<UserSubscriptionResponseDto> {
        const subscription = await this.userService.getUserSubscription(user.uid);

        return {
            success: true,
            data: subscription,
        };
    }

    /**
     * Get user security settings
     */
    @Get('me/security')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get user security settings',
        description: 'Get security settings for the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Security settings retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: { type: 'object' },
            },
        },
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getUserSecurity(@CurrentUser() user: any): Promise<any> {
        const security = await this.userService.getUserSecurity(user.uid);

        return {
            success: true,
            data: security,
        };
    }

    /**
     * Update user security settings
     */
    @Patch('me/security')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Update user security settings',
        description: 'Update security settings for the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Security settings updated successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: { type: 'object' },
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid request data',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    async updateUserSecurity(
        @Body() securityDto: UpdateSecurityDto,
        @CurrentUser() user: any
    ): Promise<any> {
        const updatedSecurity = await this.userService.updateUserSecurity(user.uid, securityDto);

        return {
            success: true,
            data: updatedSecurity,
            message: 'Security settings updated successfully',
        };
    }

    /**
     * Enable two-factor authentication
     */
    @Post('me/security/2fa/enable')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Enable two-factor authentication',
        description: 'Enable two-factor authentication for the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Two-factor authentication enabled successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'object',
                    properties: {
                        secret: { type: 'string' },
                        qrCode: { type: 'string' },
                    },
                },
                message: { type: 'string' },
            },
        },
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async enableTwoFactor(@CurrentUser() user: any): Promise<any> {
        const result = await this.userService.enableTwoFactor(user.uid);

        return {
            success: true,
            data: result,
            message: 'Two-factor authentication enabled successfully. Scan the QR code with your authenticator app.',
        };
    }

    /**
     * Disable two-factor authentication
     */
    @Post('me/security/2fa/disable')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Disable two-factor authentication',
        description: 'Disable two-factor authentication for the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Two-factor authentication disabled successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid authentication code',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    async disableTwoFactor(
        @Body() disableDto: EnableTwoFactorDto,
        @CurrentUser() user: any
    ): Promise<any> {
        await this.userService.disableTwoFactor(user.uid, disableDto.code);

        return {
            success: true,
            message: 'Two-factor authentication disabled successfully',
        };
    }

    /**
     * Get user activity log
     */
    @Get('me/activity')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get user activity log',
        description: 'Get the activity log for the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Activity log retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'array',
                    items: { type: 'object' },
                },
                metadata: {
                    type: 'object',
                    properties: {
                        total: { type: 'number' },
                        limit: { type: 'number' },
                        offset: { type: 'number' },
                    },
                },
            },
        },
    })
    @ApiQuery({
        name: 'limit',
        description: 'Number of activities to return',
        required: false,
        type: Number,
    })
    @ApiQuery({
        name: 'offset',
        description: 'Number of activities to skip',
        required: false,
        type: Number,
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getUserActivity(
        @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
        @CurrentUser() user: any
    ): Promise<any> {
        const activities = await this.userService.getUserActivity(user.uid, limit, offset);

        return {
            success: true,
            data: activities,
            metadata: {
                total: activities.length,
                limit,
                offset,
            },
        };
    }

    /**
     * Get user sessions
     */
    @Get('me/sessions')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get user sessions',
        description: 'Get active sessions for the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Sessions retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'array',
                    items: { type: 'object' },
                },
            },
        },
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getUserSessions(@CurrentUser() user: any): Promise<any> {
        const sessions = await this.userService.getUserSessions(user.uid);

        return {
            success: true,
            data: sessions,
        };
    }

    /**
     * Invalidate user session
     */
    @Delete('me/sessions/:sessionId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Invalidate user session',
        description: 'Invalidate a specific session for the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Session invalidated successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Session not found',
    })
    @ApiParam({
        name: 'sessionId',
        description: 'Session ID to invalidate',
        example: 'session_123abc',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async invalidateSession(
        @Param('sessionId') sessionId: string,
        @CurrentUser() user: any
    ): Promise<any> {
        await this.userService.invalidateSession(sessionId);

        return {
            success: true,
            message: 'Session invalidated successfully',
        };
    }

    /**
     * Get user notifications
     */
    @Get('me/notifications')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get user notifications',
        description: 'Get notifications for the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Notifications retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'array',
                    items: { type: 'object' },
                },
                metadata: {
                    type: 'object',
                    properties: {
                        total: { type: 'number' },
                        unread: { type: 'number' },
                        limit: { type: 'number' },
                        offset: { type: 'number' },
                    },
                },
            },
        },
    })
    @ApiQuery({
        name: 'unread',
        description: 'Filter by unread notifications only',
        required: false,
        type: Boolean,
    })
    @ApiQuery({
        name: 'limit',
        description: 'Number of notifications to return',
        required: false,
        type: Number,
    })
    @ApiQuery({
        name: 'offset',
        description: 'Number of notifications to skip',
        required: false,
        type: Number,
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getUserNotifications(
        @Query('unread') unreadOnly?: boolean,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
        @CurrentUser() user: any
    ): Promise<any> {
        const notifications = await this.userService.getUserNotifications(
            user.uid,
            unreadOnly,
            limit,
            offset
        );

        const unreadCount = notifications.filter(n => !n.read).length;

        return {
            success: true,
            data: notifications,
            metadata: {
                total: notifications.length,
                unread: unreadCount,
                limit,
                offset,
            },
        };
    }

    /**
     * Mark notification as read
     */
    @Post('me/notifications/:notificationId/read')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Mark notification as read',
        description: 'Mark a notification as read for the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Notification marked as read successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Notification not found',
    })
    @ApiParam({
        name: 'notificationId',
        description: 'Notification ID',
        example: 'notification_123abc',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async markNotificationAsRead(
        @Param('notificationId') notificationId: string,
        @CurrentUser() user: any
    ): Promise<any> {
        await this.userService.markNotificationAsRead(user.uid, notificationId);

        return {
            success: true,
            message: 'Notification marked as read successfully',
        };
    }

    /**
     * Dismiss notification
     */
    @Post('me/notifications/:notificationId/dismiss')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Dismiss notification',
        description: 'Dismiss a notification for the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Notification dismissed successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Notification not found',
    })
    @ApiParam({
        name: 'notificationId',
        description: 'Notification ID',
        example: 'notification_123abc',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async dismissNotification(
        @Param('notificationId') notificationId: string,
        @CurrentUser() user: any
    ): Promise<any> {
        await this.userService.dismissNotification(user.uid, notificationId);

        return {
            success: true,
            message: 'Notification dismissed successfully',
        };
    }

    /**
     * Export user data
     */
    @Post('me/export')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Export user data',
        description: 'Export all user data (GDPR compliance)',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Data export initiated successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'object',
                    properties: {
                        exportId: { type: 'string' },
                        downloadUrl: { type: 'string' },
                    },
                },
                message: { type: 'string' },
            },
        },
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async exportUserData(@CurrentUser() user: any): Promise<any> {
        const exportData = await this.userService.exportUserData(user.uid);

        // In a real implementation, you would create a secure download link
        // For now, return the data directly
        return {
            success: true,
            data: {
                exportId: `export_${Date.now()}`,
                downloadUrl: null, // Would be generated in production
                data: exportData
            },
            message: 'User data exported successfully',
        };
    }

    /**
     * Delete user account
     */
    @Delete('me')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Delete user account',
        description: 'Delete the authenticated user account (GDPR compliance)',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Account deletion initiated successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Account deletion failed',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async deleteUserAccount(
        @Body() deletionData: { reason?: string; confirmation: string },
        @CurrentUser() user: any
    ): Promise<any> {
        // Validate confirmation
        if (deletionData.confirmation !== 'DELETE MY ACCOUNT') {
            throw new BadRequestException('Invalid confirmation text');
        }

        await this.userService.deleteUserAccount(user.uid, deletionData.reason);

        return {
            success: true,
            message: 'Account deletion initiated successfully. You will receive a confirmation email.',
        };
    }

    /**
     * Get user by ID (admin only)
     */
    @Get(':userId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get user by ID',
        description: 'Get a specific user by ID (admin only)',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User retrieved successfully',
        type: UserProfileResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'User not found',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: 'Access denied',
    })
    @ApiParam({
        name: 'userId',
        description: 'User ID',
        example: 'user_123abc',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard, AdminGuard)
    async getUserById(
        @Param('userId') userId: string,
        @CurrentUser() admin: any
    ): Promise<UserProfileResponseDto> {
        const user = await this.userService.getUserProfile(userId);

        return {
            success: true,
            data: user,
        };
    }

    /**
     * Search users (admin only)
     */
    @Get('admin/search')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Search users',
        description: 'Search for users with various filters (admin only)',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Users retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'array',
                    items: { type: 'object' },
                },
                metadata: {
                    type: 'object',
                    properties: {
                        total: { type: 'number' },
                        page: { type: 'number' },
                        limit: { type: 'number' },
                        hasNext: { type: 'boolean' },
                        hasPrev: { type: 'boolean' },
                    },
                },
            },
        },
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard, AdminGuard)
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    async searchUsers(
        @Query() searchDto: SearchUsersDto,
        @CurrentUser() admin: any
    ): Promise<any> {
        const result = await this.userService.searchUsers(searchDto);

        return {
            success: true,
            data: result.users,
            metadata: {
                total: result.total,
                page: Math.floor(searchDto.offset / searchDto.limit) + 1,
                limit: searchDto.limit,
                hasNext: result.hasNext,
                hasPrev: result.hasPrev,
            },
        };
    }

    /**
     * Get user analytics (admin only)
     */
    @Get('admin/analytics')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get user analytics',
        description: 'Get comprehensive user analytics and metrics (admin only)',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Analytics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: { type: 'object' },
            },
        },
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard, AdminGuard)
    async getUserAnalytics(@CurrentUser() admin: any): Promise<any> {
        const analytics = await this.userService.getUserAnalytics();

        return {
            success: true,
            data: analytics,
        };
    }

    /**
     * Perform bulk operation on users (admin only)
     */
    @Post('admin/bulk')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Perform bulk operation',
        description: 'Perform bulk operations on multiple users (admin only)',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Bulk operation completed successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid operation',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard, AdminGuard)
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    async performBulkOperation(
        @Body() bulkDto: any,
        @CurrentUser() admin: any
    ): Promise<any> {
        await this.userService.performBulkOperation({
            ...bulkDto,
            performedBy: admin.uid,
            performedAt: new Date(),
        });

        return {
            success: true,
            message: `Bulk operation '${bulkDto.operation}' completed successfully`,
        };
    }

    /**
     * Update user subscription (admin only)
     */
    @Patch(':userId/subscription')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Update user subscription',
        description: 'Update subscription for a specific user (admin only)',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Subscription updated successfully',
        type: UserSubscriptionResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'User not found',
    })
    @ApiResponse({
        status: HttpStatus.FORBIDDEN,
        description: 'Access denied',
    })
    @ApiParam({
        name: 'userId',
        description: 'User ID',
        example: 'user_123abc',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard, AdminGuard)
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    async updateUserSubscription(
        @Param('userId') userId: string,
        @Body() subscriptionDto: any,
        @CurrentUser() admin: any
    ): Promise<UserSubscriptionResponseDto> {
        return {
            success: true,
            data: updatedSubscription,
            message: 'Subscription updated successfully',
        };
    }
}
