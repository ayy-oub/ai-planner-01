import {
    Controller,
    Get,
    Post,
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
    Res,
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
import { Response } from 'express';
import { ExportService } from './export.service';
import { AuthGuard } from '../../shared/middleware/auth.middleware';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { ExportRequestDto } from './dto/export-request.dto';
import { ExportResultResponseDto } from './dto/export-response.dto';

@ApiTags('Export')
@ApiBearerAuth()
@Controller('export')
@UseGuards(AuthGuard)
export class ExportController {
    constructor(private readonly exportService: ExportService) { }

    /**
     * Create a new export
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({
        summary: 'Create a new export',
        description: 'Create and queue a new export job in various formats (PDF, CSV, Excel, JSON, etc.)',
    })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'Export created successfully',
        type: ExportResultResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid request data',
    })
    @ApiResponse({
        status: HttpStatus.TOO_MANY_REQUESTS,
        description: 'Export quota exceeded',
    })
    @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
    async createExport(
        @Body() requestDto: ExportRequestDto,
        @CurrentUser() user: any
    ): Promise<ExportResultResponseDto> {
        const exportResult = await this.exportService.createExport({
            ...requestDto,
            userId: user.uid,
        });

        return {
            success: true,
            data: exportResult,
            message: 'Export created successfully and is being processed',
        };
    }

    /**
     * Get user exports
     */
    @Get()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get user exports',
        description: 'Retrieve a paginated list of exports for the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Exports retrieved successfully',
        type: ExportResultResponseDto,
        isArray: true,
    })
    @ApiQuery({
        name: 'status',
        description: 'Filter by export status',
        required: false,
        enum: ['pending', 'processing', 'completed', 'failed', 'expired'],
    })
    @ApiQuery({
        name: 'limit',
        description: 'Number of exports to return',
        required: false,
        type: Number,
    })
    @ApiQuery({
        name: 'offset',
        description: 'Number of exports to skip',
        required: false,
        type: Number,
    })
    async getUserExports(
        @Query('status') status?: string,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
        @CurrentUser() user: any
    ): Promise<any> {
        const exports = await this.exportService.getUserExports(
            user.uid,
            limit,
            offset,
            status as any
        );

        return {
            success: true,
            data: exports,
            metadata: {
                total: exports.length,
                limit,
                offset,
            },
        };
    }

    /**
     * Get export by ID
     */
    @Get(':exportId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get export by ID',
        description: 'Retrieve a specific export by its ID',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Export retrieved successfully',
        type: ExportResultResponseDto,
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Export not found',
    })
    @ApiParam({
        name: 'exportId',
        description: 'Export ID',
        example: 'export_123abc',
    })
    async getExport(
        @Param('exportId') exportId: string,
        @CurrentUser() user: any
    ): Promise<ExportResultResponseDto> {
        const exportResult = await this.exportService.getExport(user.uid, exportId);

        return {
            success: true,
            data: exportResult,
        };
    }

    /**
     * Download export file
     */
    @Get(':exportId/download')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Download export file',
        description: 'Download the exported file directly',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'File downloaded successfully',
        content: {
            'application/octet-stream': {
                schema: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'Export file not found',
    })
    async downloadExport(
        @Param('exportId') exportId: string,
        @Res() res: Response,
        @CurrentUser() user: any
    ): Promise<void> {
        const exportResult = await this.exportService.getExport(user.uid, exportId);

        if (!exportResult.fileUrl) {
            throw new NotFoundException('Export file not found');
        }

        // Get file from storage
        const fileBuffer = await this.exportService.getExportFile(exportResult.fileUrl);

        // Set appropriate headers
        const mimeType = this.getMimeType(exportResult.format);
        const fileName = `export_${exportId}.${exportResult.format}`;

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', fileBuffer.length);

        res.send(fileBuffer);
    }

    /**
     * Delete export
     */
    @Delete(':exportId')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Delete export',
        description: 'Delete an export and its associated file',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Export deleted successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
            },
        },
    })
    @ApiParam({
        name: 'exportId',
        description: 'Export ID',
        example: 'export_123abc',
    })
    async deleteExport(
        @Param('exportId') exportId: string,
        @CurrentUser() user: any
    ): Promise<any> {
        await this.exportService.deleteExport(user.uid, exportId);

        return {
            success: true,
            message: 'Export deleted successfully',
        };
    }

    /**
     * Get export quota
     */
    @Get('quota/info')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Get export quota information',
        description: 'Get current export quota usage and limits for the authenticated user',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Quota information retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean' },
                data: {
                    type: 'object',
                    properties: {
                        userId: { type: 'string' },
                        plan: { type: 'string' },
                        monthlyQuota: { type: 'number' },
                        usedThisMonth: { type: 'number' },
                        remainingQuota: { type: 'number' },
                        resetsAt: { type: 'string', format: 'date-time' },
                        unlimited: { type: 'boolean' },
                    },
                },
            },
        },
    })
    async getExportQuota(@CurrentUser() user: any): Promise<any> {
        const quota = await this.exportService.getExportQuota(user.uid);

        return {
            success: true,
            data: quota,
        };
    }

    /**
     * Helper method to get MIME type
     */
    private getMimeType(format: string): string {
        const mimeTypes = {
            pdf: 'application/pdf',
            csv: 'text/csv',
            excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            json: 'application/json',
            ical: 'text/calendar',
            markdown: 'text/markdown',
            html: 'text/html',
            txt: 'text/plain',
        };
        return mimeTypes[format] || 'application/octet-stream';
    }
}