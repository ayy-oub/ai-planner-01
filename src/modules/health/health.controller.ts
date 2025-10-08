import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    Query,
    UseGuards,
    ValidationPipe,
    UsePipes,
    HttpCode,
    HttpStatus,
    ParseIntPipe,
    DefaultValuePipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
    ApiParam,
    ApiBody,
} from '@nestjs/swagger';
import { HealthService } from './health.service';
import { AuthGuard } from '../../shared/middleware/auth.middleware';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { AdminGuard } from '../../shared/middleware/admin.middleware';
import { HealthStatusResponseDto, HealthReportResponseDto, HealthHistoryResponseDto, HealthAlertsResponseDto } from './dto/health-response.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
    constructor(private readonly healthService: HealthService) { }

    /**
     * Get basic health status (no auth required)
     */
    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get basic health status',
        description: 'Get basic system health status without authentication',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Health status retrieved successfully',
        type: HealthStatusResponseDto,
    })
    @ApiQuery({
        name: 'detailed',
        description: 'Include detailed health information',
        required: false,
        type: Boolean,
    })
    async getHealthStatus(
        @Query('detailed') detailed?: boolean
    ): Promise<HealthStatusResponseDto> {
        const healthStatus = await this.healthService.getHealthStatus(detailed === true);

        return {
            success: true,
            data: healthStatus,
        };
    }

    /**
     * Get detailed health report (requires auth)
     */
    @Get('report')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get detailed health report',
        description: 'Get comprehensive health report with system metrics, service status, and recommendations',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Health report retrieved successfully',
        type: HealthReportResponseDto,
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getHealthReport(): Promise<HealthReportResponseDto> {
        const healthReport = await this.healthService.getHealthReport();

        return {
            success: true,
            data: healthReport,
        };
    }

    /**
     * Get health history (requires auth)
     */
    @Get('history')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get health history',
        description: 'Get historical health data for a specified time period',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Health history retrieved successfully',
        type: HealthHistoryResponseDto,
        isArray: true,
    })
    @ApiQuery({
        name: 'startDate',
        description: 'Start date for history (ISO format)',
        required: true,
        example: '2024-01-01',
    })
    @ApiQuery({
        name: 'endDate',
        description: 'End date for history (ISO format)',
        required: true,
        example: '2024-01-31',
    })
    @ApiQuery({
        name: 'service',
        description: 'Filter by specific service',
        required: false,
        example: 'database',
    })
    @ApiQuery({
        name: 'limit',
        description: 'Number of records to return',
        required: false,
        type: Number,
    })
    @ApiQuery({
        name: 'offset',
        description: 'Number of records to skip',
        required: false,
        type: Number,
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getHealthHistory(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('service') service?: string,
        @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
        @CurrentUser() user: any
    ): Promise<any> {
        const history = await this.healthService.getHealthHistory(
            new Date(startDate),
            new Date(endDate),
            service
        );

        // Apply pagination
        const paginatedHistory = history.slice(offset, offset + limit);

        return {
            success: true,
            data: paginatedHistory,
            metadata: {
                total: history.length,
                limit,
                offset,
            },
        };
    }

    /**
     * Get health alerts (requires auth)
     */
    @Get('alerts')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get health alerts',
        description: 'Get health alerts with optional filtering by status, resolution, and severity',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Health alerts retrieved successfully',
        type: HealthAlertsResponseDto,
        isArray: true,
    })
    @ApiQuery({
        name: 'acknowledged',
        description: 'Filter by acknowledgment status',
        required: false,
        type: Boolean,
    })
    @ApiQuery({
        name: 'resolved',
        description: 'Filter by resolution status',
        required: false,
        type: Boolean,
    })
    @ApiQuery({
        name: 'severity',
        description: 'Filter by severity level',
        required: false,
        enum: ['low', 'medium', 'high', 'critical'],
    })
    @ApiQuery({
        name: 'limit',
        description: 'Number of alerts to return',
        required: false,
        type: Number,
    })
    @ApiQuery({
        name: 'offset',
        description: 'Number of alerts to skip',
        required: false,
        type: Number,
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async getHealthAlerts(
        @Query('acknowledged') acknowledged?: boolean,
        @Query('resolved') resolved?: boolean,
        @Query('severity') severity?: string,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
        @CurrentUser() user: any
    ): Promise<any> {
        const alerts = await this.healthService.getHealthAlerts(
            acknowledged,
            resolved,
            severity
        );

        // Apply pagination
        const paginatedAlerts = alerts.slice(offset, offset + limit);

        return {
            success: true,
            data: paginatedAlerts,
            metadata: {
                total: alerts.length,
                limit,
                offset,
            },
        };
    }

    /**
     * Acknowledge health alert (requires auth)
     */
    @Post('alerts/:alertId/acknowledge')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Acknowledge health alert',
        description: 'Mark a health alert as acknowledged',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Alert acknowledged successfully',
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
        description: 'Alert not found',
    })
    @ApiParam({
        name: 'alertId',
        description: 'Alert ID',
        example: 'alert_123abc',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async acknowledgeAlert(
        @Param('alertId') alertId: string,
        @CurrentUser() user: any
    ): Promise<any> {
        await this.healthService.acknowledgeAlert(alertId, user.uid);

        return {
            success: true,
            message: 'Alert acknowledged successfully',
        };
    }

    /**
     * Resolve health alert (requires auth)
     */
    @Post('alerts/:alertId/resolve')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Resolve health alert',
        description: 'Mark a health alert as resolved',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Alert resolved successfully',
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
        description: 'Alert not found',
    })
    @ApiParam({
        name: 'alertId',
        description: 'Alert ID',
        example: 'alert_123abc',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async resolveAlert(
        @Param('alertId') alertId: string,
        @CurrentUser() user: any
    ): Promise<any> {
        await this.healthService.resolveAlert(alertId, user.uid);

        return {
            success: true,
            message: 'Alert resolved successfully',
        };
    }

    /**
     * Get system metrics (requires auth)
     */
    @Get('metrics')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get system metrics',
        description: 'Get detailed system metrics including memory, CPU, disk, and network usage',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'System metrics retrieved successfully',
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
    async getSystemMetrics(): Promise<any> {
        const metrics = await this.healthService.getSystemMetrics();

        return {
            success: true,
            data: metrics,
        };
    }

    /**
     * Run specific health check (requires auth)
     */
    @Post('checks/:checkName')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Run specific health check',
        description: 'Run a specific health check by name',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Health check completed successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: { type: 'object' },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Health check not found',
    })
    @ApiParam({
        name: 'checkName',
        description: 'Name of the health check to run',
        example: 'database',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard)
    async runHealthCheck(
        @Param('checkName') checkName: string,
        @CurrentUser() user: any
    ): Promise<any> {
        const result = await this.healthService.runHealthCheck(checkName);

        return {
            success: true,
            data: result,
        };
    }

    /**
     * Get health statistics (admin only)
     */
    @Get('stats')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get health statistics',
        description: 'Get health statistics and trends (admin only)',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Health statistics retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: { type: 'object' },
            },
        },
    })
    @ApiQuery({
        name: 'startDate',
        description: 'Start date for statistics',
        required: true,
        example: '2024-01-01',
    })
    @ApiQuery({
        name: 'endDate',
        description: 'End date for statistics',
        required: true,
        example: '2024-01-31',
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard, AdminGuard)
    async getHealthStats(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @CurrentUser() user: any
    ): Promise<any> {
        const stats = await this.healthService.getHealthStats(
            new Date(startDate),
            new Date(endDate)
        );

        return {
            success: true,
            data: stats,
        };
    }

    /**
     * Register custom health check (admin only)
     */
    @Post('checks')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Register custom health check',
        description: 'Register a custom health check function (admin only)',
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Health check registered successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
            },
        },
    })
    @ApiBody({
        description: 'Health check registration data',
        schema: {
            type: 'object',
            properties: {
                name: { type: 'string', example: 'custom-service' },
                description: { type: 'string', example: 'Custom service health check' },
                endpoint: { type: 'string', example: 'https://api.example.com/health' },
                timeout: { type: 'number', example: 5000 },
                retries: { type: 'number', example: 3 },
            },
        },
    })
    @ApiBearerAuth()
    @UseGuards(AuthGuard, AdminGuard)
    async registerHealthCheck(
        @Body() checkData: any,
        @CurrentUser() user: any
    ): Promise<any> {
        // In a real implementation, you would store and manage custom health checks
        // For now, we'll just acknowledge the registration

        return {
            success: true,
            message: `Health check '${checkData.name}' registered successfully`,
        };
    }
}