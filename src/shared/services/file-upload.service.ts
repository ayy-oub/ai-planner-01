// src/shared/services/file-upload.service.ts

import { injectable } from 'inversify';
import * as multer from 'multer';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';
import { config } from '../config';

export interface FileUploadOptions {
    maxSize?: number;
    allowedTypes?: string[];
    destination?: string;
    filename?: string;
    storage?: 'local' | 'cloudinary' | 's3';
    folder?: string;
    public?: boolean;
}

export interface UploadedFile {
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    path: string;
    url: string;
    publicId?: string;
    uploadedAt: Date;
}

export interface FileUploadResult {
    success: boolean;
    file?: UploadedFile;
    error?: string;
}

@injectable()
export class FileUploadService {
    private uploadDir: string;
    private maxFileSize: number;
    private allowedFileTypes: string[];

    constructor() {
        this.uploadDir = config.FILE_UPLOAD_DIR || 'uploads';
        this.maxFileSize = config.MAX_FILE_SIZE || 10 * 1024 * 1024; // 10MB default
        this.allowedFileTypes = config.ALLOWED_FILE_TYPES || [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        this.ensureUploadDirectory();
        this.configureCloudinary();
    }

    /**
     * Create multer middleware for handling file uploads
     */
    createUploadMiddleware(options: FileUploadOptions = {}): multer.Multer {
        const storage = this.createStorage(options);
        const fileFilter = this.createFileFilter(options);

        return multer({
            storage,
            fileFilter,
            limits: {
                fileSize: options.maxSize || this.maxFileSize,
                files: 10 // Maximum 10 files per request
            }
        });
    }

    /**
     * Upload a single file
     */
    async uploadFile(file: Express.Multer.File, options: FileUploadOptions = {}): Promise<UploadedFile> {
        try {
            if (!file) {
                throw new AppError('No file provided', 400);
            }

            // Validate file
            this.validateFile(file, options);

            let uploadedFile: UploadedFile;

            switch (options.storage || 'local') {
                case 'cloudinary':
                    uploadedFile = await this.uploadToCloudinary(file, options);
                    break;
                case 's3':
                    uploadedFile = await this.uploadToS3(file, options);
                    break;
                default:
                    uploadedFile = await this.uploadToLocal(file, options);
            }

            logger.info(`File uploaded successfully: ${file.originalname} (${uploadedFile.url})`);
            return uploadedFile;
        } catch (error) {
            logger.error('Error uploading file:', error);
            throw error instanceof AppError ? error : new AppError('Failed to upload file', 500);
        }
    }

    /**
     * Upload multiple files
     */
    async uploadFiles(files: Express.Multer.File[], options: FileUploadOptions = {}): Promise<FileUploadResult[]> {
        const results: FileUploadResult[] = [];

        for (const file of files) {
            try {
                const uploadedFile = await this.uploadFile(file, options);
                results.push({
                    success: true,
                    file: uploadedFile
                });
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Delete a file
     */
    async deleteFile(fileUrl: string, storage: string = 'local'): Promise<void> {
        try {
            switch (storage) {
                case 'cloudinary':
                    await this.deleteFromCloudinary(fileUrl);
                    break;
                case 's3':
                    await this.deleteFromS3(fileUrl);
                    break;
                default:
                    await this.deleteFromLocal(fileUrl);
            }

            logger.info(`File deleted successfully: ${fileUrl}`);
        } catch (error) {
            logger.error('Error deleting file:', error);
            throw new AppError('Failed to delete file', 500);
        }
    }

    /**
     * Generate a unique filename
     */
    generateFilename(originalName: string): string {
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');
        const extension = path.extname(originalName);
        const basename = path.basename(originalName, extension);
        const sanitizedBasename = basename.replace(/[^a-zA-Z0-9]/g, '_');

        return `${timestamp}-${randomString}-${sanitizedBasename}${extension}`;
    }

    /**
     * Validate file type and size
     */
    private validateFile(file: Express.Multer.File, options: FileUploadOptions): void {
        // Check file size
        if (file.size > (options.maxSize || this.maxFileSize)) {
            throw new AppError(`File size exceeds maximum allowed size of ${(options.maxSize || this.maxFileSize) / (1024 * 1024)}MB`, 400);
        }

        // Check file type
        const allowedTypes = options.allowedTypes || this.allowedFileTypes;
        if (!allowedTypes.includes(file.mimetype)) {
            throw new AppError(`File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`, 400);
        }

        // Additional security checks
        this.performSecurityChecks(file);
    }

    /**
     * Perform security checks on uploaded files
     */
    private performSecurityChecks(file: Express.Multer.File): void {
        // Check for potential malware signatures
        const suspiciousPatterns = [
            /eval\s*\(/,
            /script\s*>/,
            /javascript:/,
            /onload\s*=/,
            /onerror\s*=/
        ];

        const fileContent = file.buffer?.toString() || '';

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(fileContent)) {
                throw new AppError('File contains potentially malicious content', 400);
            }
        }

        // Check file extension matches MIME type
        const extension = path.extname(file.originalname).toLowerCase();
        const expectedMimeType = this.getExpectedMimeType(extension);

        if (expectedMimeType && file.mimetype !== expectedMimeType) {
            throw new AppError(`File extension does not match MIME type`, 400);
        }
    }

    /**
     * Get expected MIME type for file extension
     */
    private getExpectedMimeType(extension: string): string | null {
        const mimeTypes: Record<string, string> = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.pdf': 'application/pdf',
            '.txt': 'text/plain',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };

        return mimeTypes[extension] || null;
    }

    /**
     * Create multer storage configuration
     */
    private createStorage(options: FileUploadOptions): multer.StorageEngine {
        switch (options.storage || 'local') {
            case 'cloudinary':
                return multer.memoryStorage(); // Cloudinary requires buffer
            case 's3':
                return multer.memoryStorage(); // S3 requires buffer
            default:
                return multer.diskStorage({
                    destination: async (req, file, cb) => {
                        const dest = options.destination || this.uploadDir;
                        await this.ensureDirectory(dest);
                        cb(null, dest);
                    },
                    filename: (req, file, cb) => {
                        const filename = options.filename || this.generateFilename(file.originalname);
                        cb(null, filename);
                    }
                });
        }
    }

    /**
     * Create file filter for multer
     */
    private createFileFilter(options: FileUploadOptions): multer.Options['fileFilter'] {
        return (req, file, cb) => {
            try {
                this.validateFile(file, options);
                cb(null, true);
            } catch (error) {
                cb(error as any, false);
            }
        };
    }

    /**
     * Upload file to local storage
     */
    private async uploadToLocal(file: Express.Multer.File, options: FileUploadOptions): Promise<UploadedFile> {
        const filename = options.filename || this.generateFilename(file.originalname);
        const destination = options.destination || this.uploadDir;
        const filepath = path.join(destination, filename);

        // If file is already on disk (multer.diskStorage), just return the info
        if (file.path) {
            return {
                filename,
                originalName: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                path: file.path,
                url: `${config.APP_URL}/uploads/${filename}`,
                uploadedAt: new Date()
            };
        }

        // If file is in memory (multer.memoryStorage), write it to disk
        await fs.writeFile(filepath, file.buffer);

        return {
            filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            path: filepath,
            url: `${config.APP_URL}/uploads/${filename}`,
            uploadedAt: new Date()
        };
    }

    /**
     * Upload file to Cloudinary
     */
    private async uploadToCloudinary(file: Express.Multer.File, options: FileUploadOptions): Promise<UploadedFile> {
        return new Promise((resolve, reject) => {
            const uploadOptions: any = {
                folder: options.folder || 'ai-planner',
                public_id: this.generateFilename(file.originalname).replace(/\.[^/.]+$/, ''),
                resource_type: 'auto'
            };

            if (options.public === false) {
                uploadOptions.type = 'private';
            }

            cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
                if (error) {
                    reject(new AppError(`Cloudinary upload failed: ${error.message}`, 500));
                } else {
                    resolve({
                        filename: result!.public_id,
                        originalName: file.originalname,
                        mimetype: file.mimetype,
                        size: file.size,
                        path: result!.secure_url,
                        url: result!.secure_url,
                        publicId: result!.public_id,
                        uploadedAt: new Date()
                    });
                }
            }).end(file.buffer);
        });
    }

    /**
     * Upload file to S3 (placeholder implementation)
     */
    private async uploadToS3(file: Express.Multer.File, options: FileUploadOptions): Promise<UploadedFile> {
        // This is a placeholder implementation
        // In a real scenario, you would integrate with AWS S3 SDK
        logger.warn('S3 upload not implemented, falling back to local storage');
        return this.uploadToLocal(file, options);
    }

    /**
     * Delete file from local storage
     */
    private async deleteFromLocal(fileUrl: string): Promise<void> {
        try {
            const filename = path.basename(fileUrl);
            const filepath = path.join(this.uploadDir, filename);

            await fs.unlink(filepath);
        } catch (error) {
            if ((error as any).code === 'ENOENT') {
                logger.warn(`File not found for deletion: ${fileUrl}`);
            } else {
                throw error;
            }
        }
    }

    /**
     * Delete file from Cloudinary
     */
    private async deleteFromCloudinary(fileUrl: string): Promise<void> {
        try {
            const publicId = this.extractCloudinaryPublicId(fileUrl);
            if (publicId) {
                await cloudinary.uploader.destroy(publicId);
            }
        } catch (error) {
            logger.error('Error deleting from Cloudinary:', error);
            throw error;
        }
    }

    /**
     * Delete file from S3 (placeholder implementation)
     */
    private async deleteFromS3(fileUrl: string): Promise<void> {
        // This is a placeholder implementation
        logger.warn('S3 deletion not implemented');
    }

    /**
     * Extract Cloudinary public ID from URL
     */
    private extractCloudinaryPublicId(url: string): string | null {
        const match = url.match(/\/([^/]+)\.(jpg|jpeg|png|gif|webp|pdf|txt|doc|docx)$/);
        return match ? match[1] : null;
    }

    /**
     * Ensure upload directory exists
     */
    private async ensureUploadDirectory(): Promise<void> {
        try {
            await this.ensureDirectory(this.uploadDir);
        } catch (error) {
            logger.error('Error creating upload directory:', error);
        }
    }

    /**
     * Ensure directory exists
     */
    private async ensureDirectory(dirPath: string): Promise<void> {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    /**
     * Configure Cloudinary
     */
    private configureCloudinary(): void {
        if (config.CLOUDINARY_CLOUD_NAME && config.CLOUDINARY_API_KEY && config.CLOUDINARY_API_SECRET) {
            cloudinary.config({
                cloud_name: config.CLOUDINARY_CLOUD_NAME,
                api_key: config.CLOUDINARY_API_KEY,
                api_secret: config.CLOUDINARY_API_SECRET
            });
        }
    }

    /**
     * Generate thumbnail for image files
     */
    async generateThumbnail(filePath: string, width: number = 200, height: number = 200): Promise<string> {
        // This would use a library like Sharp to generate thumbnails
        // For now, return the original path
        return filePath;
    }

    /**
     * Get file metadata
     */
    async getFileMetadata(filePath: string): Promise<Record<string, any>> {
        try {
            const stats = await fs.stat(filePath);
            return {
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                accessed: stats.atime
            };
        } catch (error) {
            logger.error('Error getting file metadata:', error);
            throw new AppError('Failed to get file metadata', 500);
        }
    }

    /**
     * Validate file integrity
     */
    async validateFileIntegrity(filePath: string, expectedHash: string): Promise<boolean> {
        try {
            const fileBuffer = await fs.readFile(filePath);
            const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            return hash === expectedHash;
        } catch (error) {
            logger.error('Error validating file integrity:', error);
            return false;
        }
    }
}