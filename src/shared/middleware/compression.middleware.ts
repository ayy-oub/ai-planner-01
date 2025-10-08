import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { logger } from '../utils/logger';

/**
 * Compression middleware configuration
 */
export class CompressionMiddleware {
    /**
     * Main compression middleware
     */
    compression = compression({
        filter: this.shouldCompress.bind(this),
        threshold: 1024, // Compress responses larger than 1KB
        level: 6, // Compression level (1-9, where 9 is best compression)
        memLevel: 8, // Memory usage level (1-9, where 9 uses most memory)
        strategy: 0, // Default compression strategy
        chunkSize: 16384, // 16KB chunks
        windowBits: 15, // Window size for compression
    });

    /**
     * High compression for bandwidth-sensitive scenarios
     */
    highCompression = compression({
        filter: this.shouldCompress.bind(this),
        threshold: 512, // Compress responses larger than 512B
        level: 9, // Maximum compression
        memLevel: 9, // Maximum memory usage
        strategy: 0,
        chunkSize: 8192, // Smaller chunks for better compression
        windowBits: 15,
    });

    /**
     * Fast compression for CPU-sensitive scenarios
     */
    fastCompression = compression({
        filter: this.shouldCompress.bind(this),
        threshold: 2048, // Only compress responses larger than 2KB
        level: 1, // Minimum compression for speed
        memLevel: 1, // Minimum memory usage
        strategy: 0,
        chunkSize: 32768, // Larger chunks for speed
        windowBits: 15,
    });

    /**
     * Smart compression based on content type and size
     */
    smartCompression = compression({
        filter: (req: Request, res: Response) => {
            // Don't compress if client doesn't support it
            if (!this.clientSupportsCompression(req)) {
                return false;
            }

            // Don't compress small responses
            const contentLength = res.getHeader('content-length');
            if (contentLength && parseInt(contentLength as string) < 512) {
                return false;
            }

            // Compress based on content type
            const contentType = res.getHeader('content-type') as string;
            if (!contentType) return false;

            // Always compress these content types
            const alwaysCompress = [
                'text/html',
                'text/css',
                'text/javascript',
                'text/plain',
                'application/javascript',
                'application/json',
                'application/xml',
                'application/rss+xml',
                'application/atom+xml',
                'image/svg+xml',
            ];

            // Never compress these content types
            const neverCompress = [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'image/bmp',
                'video/',
                'audio/',
                'application/zip',
                'application/gzip',
                'application/pdf',
            ];

            // Check if content type should always be compressed
            if (alwaysCompress.some(type => contentType.includes(type))) {
                return true;
            }

            // Check if content type should never be compressed
            if (neverCompress.some(type => contentType.includes(type))) {
                return false;
            }

            // Compress other text-based content
            if (contentType.includes('text/') || contentType.includes('application/')) {
                return true;
            }

            return false;
        },
        threshold: 0, // Handled by filter function
        level: 6, // Balanced compression
        memLevel: 8,
        strategy: 0,
        chunkSize: 16384,
        windowBits: 15,
    });

    /**
     * Selective compression for API responses
     */
    apiCompression = compression({
        filter: (req: Request, res: Response) => {
            // Only compress API responses
            if (!req.path.startsWith('/api')) {
                return false;
            }

            return this.shouldCompress(req, res);
        },
        threshold: 512, // Lower threshold for API responses
        level: 6,
        memLevel: 8,
        strategy: 0,
        chunkSize: 16384,
        windowBits: 15,
    });

    /**
     * Static asset compression
     */
    staticCompression = compression({
        filter: (req: Request, res: Response) => {
            // Only compress static assets
            const staticExtensions = [
                '.js', '.css', '.html', '.xml', '.json', '.svg',
                '.txt', '.md', '.yml', '.yaml'
            ];

            const ext = req.path.toLowerCase();
            return staticExtensions.some(extension => ext.endsWith(extension));
        },
        threshold: 1024,
        level: 9, // Maximum compression for static assets
        memLevel: 9,
        strategy: 0,
        chunkSize: 8192,
        windowBits: 15,
    });

    /**
     * Determine if response should be compressed
     */
    private shouldCompress(req: Request, res: Response): boolean {
        // Don't compress if client doesn't support it
        if (!this.clientSupportsCompression(req)) {
            return false;
        }

        // Don't compress if response is already compressed
        if (res.getHeader('content-encoding')) {
            return false;
        }

        // Don't compress very small responses
        const contentLength = res.getHeader('content-length');
        if (contentLength && parseInt(contentLength as string) < 1024) {
            return false;
        }

        return true;
    }

    /**
     * Check if client supports compression
     */
    private clientSupportsCompression(req: Request): boolean {
        const acceptEncoding = req.headers['accept-encoding'];
        return !!(acceptEncoding && acceptEncoding.includes('gzip'));
    }

    /**
     * Compression analytics middleware
     */
    compressionAnalytics = (req: Request, res: Response, next: NextFunction) => {
        const originalSend = res.send;
        const startTime = Date.now();

        res.send = function (body: any) {
            const endTime = Date.now();
            const compressionTime = endTime - startTime;

            // Log compression details
            const contentEncoding = res.getHeader('content-encoding');
            const originalSize = res.getHeader('x-original-content-length');
            const compressedSize = res.getHeader('content-length');

            if (contentEncoding === 'gzip' && originalSize && compressedSize) {
                const compressionRatio = (1 - (parseInt(compressedSize as string) / parseInt(originalSize as string))) * 100;

                logger.debug('Response compressed', {
                    url: req.originalUrl,
                    method: req.method,
                    originalSize: originalSize,
                    compressedSize: compressedSize,
                    compressionRatio: `${compressionRatio.toFixed(1)}%`,
                    compressionTime: `${compressionTime}ms`,
                    contentType: res.getHeader('content-type'),
                });
            }

            return originalSend.call(this, body);
        };

        next();
    };

    /**
     * Custom compression middleware with logging
     */
    loggedCompression = compression({
        filter: (req: Request, res: Response) => {
            const shouldCompress = this.shouldCompress(req, res);

            if (shouldCompress) {
                logger.debug('Compressing response', {
                    url: req.originalUrl,
                    contentType: res.getHeader('content-type'),
                    contentLength: res.getHeader('content-length'),
                });
            }

            return shouldCompress;
        },
        threshold: 1024,
        level: 6,
        memLevel: 8,
        strategy: 0,
        chunkSize: 16384,
        windowBits: 15,
    });

    /**
     * Compression middleware with error handling
     */
    safeCompression = (req: Request, res: Response, next: NextFunction) => {
        try {
            this.compression(req, res, (error) => {
                if (error) {
                    logger.error('Compression error:', {
                        error: error.message,
                        url: req.originalUrl,
                        method: req.method,
                    });
                    // Continue without compression
                }
                next();
            });
        } catch (error) {
            logger.error('Compression middleware error:', error);
            next();
        }
    };
}

export const compressionMiddleware = new CompressionMiddleware();