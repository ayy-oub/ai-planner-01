import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { HandwritingRequestDto } from './dto/handwriting-request.dto';
import { HandwritingResponseDto } from './dto/handwriting-response.dto';
import { HandwritingRecognitionResult, HandwritingProcessingOptions } from './handwriting.types';

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);
const readFile = promisify(fs.readFile);

@Injectable()
export class HandwritingService {
    private readonly logger = new Logger(HandwritingService.name);
    private readonly uploadDir = path.join(process.cwd(), 'uploads', 'handwriting');
    private readonly supportedFormats = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

    constructor() {
        // Ensure upload directory exists
        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
    }

    /**
     * Process handwriting recognition from uploaded image/PDF
     */
    async processHandwriting(
        file: Express.Multer.File,
        options: HandwritingRequestDto,
        userId: string
    ): Promise<HandwritingResponseDto> {
        try {
            // Validate file
            this.validateFile(file);

            // Generate unique filename
            const fileName = this.generateFileName(file.originalname);
            const filePath = path.join(this.uploadDir, fileName);

            // Save file temporarily
            await writeFile(filePath, file.buffer);

            try {
                // Process handwriting recognition
                const result = await this.recognizeHandwriting(filePath, options);

                // Clean up temporary file
                await unlink(filePath);

                return {
                    success: true,
                    data: {
                        text: result.text,
                        confidence: result.confidence,
                        processingTime: result.processingTime,
                        language: result.language,
                        segments: result.segments,
                        metadata: {
                            originalFileName: file.originalname,
                            fileSize: file.size,
                            mimeType: file.mimetype,
                            processedAt: new Date(),
                            userId,
                        }
                    }
                };
            } catch (error) {
                // Clean up file on error
                await unlink(filePath).catch(() => { });
                throw error;
            }
        } catch (error) {
            this.logger.error(`Handwriting processing failed: ${error.message}`, error.stack);
            throw new HttpException(
                `Handwriting processing failed: ${error.message}`,
                HttpStatus.BAD_REQUEST
            );
        }
    }

    /**
     * Process handwriting from base64 data
     */
    async processHandwritingFromBase64(
        base64Data: string,
        options: HandwritingRequestDto,
        userId: string
    ): Promise<HandwritingResponseDto> {
        try {
            // Validate and decode base64
            const buffer = this.decodeBase64Image(base64Data);

            // Create temporary file
            const fileName = this.generateFileName('base64.png');
            const filePath = path.join(this.uploadDir, fileName);

            await writeFile(filePath, buffer);

            try {
                // Process handwriting recognition
                const result = await this.recognizeHandwriting(filePath, options);

                // Clean up temporary file
                await unlink(filePath);

                return {
                    success: true,
                    data: {
                        text: result.text,
                        confidence: result.confidence,
                        processingTime: result.processingTime,
                        language: result.language,
                        segments: result.segments,
                        metadata: {
                            originalFileName: 'base64_input.png',
                            fileSize: buffer.length,
                            mimeType: 'image/png',
                            processedAt: new Date(),
                            userId,
                        }
                    }
                };
            } catch (error) {
                // Clean up file on error
                await unlink(filePath).catch(() => { });
                throw error;
            }
        } catch (error) {
            this.logger.error(`Base64 handwriting processing failed: ${error.message}`, error.stack);
            throw new HttpException(
                `Base64 handwriting processing failed: ${error.message}`,
                HttpStatus.BAD_REQUEST
            );
        }
    }

    /**
     * Get handwriting processing history for a user
     */
    async getProcessingHistory(
        userId: string,
        limit: number = 10,
        offset: number = 0
    ): Promise<any> {
        try {
            // In a real implementation, you would query your database
            // For now, return mock data
            const mockHistory = [
                {
                    id: 'proc_123',
                    text: 'Sample handwritten text',
                    confidence: 0.95,
                    processedAt: new Date(Date.now() - 3600000),
                    fileName: 'sample1.jpg'
                },
                {
                    id: 'proc_124',
                    text: 'Another handwritten note',
                    confidence: 0.87,
                    processedAt: new Date(Date.now() - 7200000),
                    fileName: 'sample2.png'
                }
            ];

            return {
                success: true,
                data: mockHistory.slice(offset, offset + limit),
                metadata: {
                    total: mockHistory.length,
                    limit,
                    offset
                }
            };
        } catch (error) {
            this.logger.error(`Failed to fetch processing history: ${error.message}`, error.stack);
            throw new HttpException(
                'Failed to fetch processing history',
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Validate uploaded file
     */
    private validateFile(file: Express.Multer.File): void {
        if (!file) {
            throw new Error('No file provided');
        }

        if (!this.supportedFormats.includes(file.mimetype)) {
            throw new Error(`Unsupported file format. Supported formats: ${this.supportedFormats.join(', ')}`);
        }

        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            throw new Error('File size exceeds 10MB limit');
        }
    }

    /**
     * Generate unique filename
     */
    private generateFileName(originalName: string): string {
        const timestamp = Date.now();
        const randomString = crypto.randomBytes(8).toString('hex');
        const extension = path.extname(originalName);
        return `handwriting_${timestamp}_${randomString}${extension}`;
    }

    /**
     * Decode base64 image
     */
    private decodeBase64Image(base64String: string): Buffer {
        const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

        if (!matches || matches.length !== 3) {
            throw new Error('Invalid base64 string format');
        }

        return Buffer.from(matches[2], 'base64');
    }

    /**
     * Perform handwriting recognition (mock implementation)
     * In a real implementation, you would integrate with:
     * - Google Cloud Vision API
     * - Azure Computer Vision
     * - AWS Textract
     * - Tesseract OCR with handwriting models
     */
    private async recognizeHandwriting(
        filePath: string,
        options: HandwritingRequestDto
    ): Promise<HandwritingRecognitionResult> {
        // Mock processing delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        // Mock recognition result
        const mockText = this.generateMockHandwritingText(options.language);
        const confidence = 0.7 + Math.random() * 0.25; // 0.7 - 0.95
        const processingTime = Math.floor(1000 + Math.random() * 2000);

        return {
            text: mockText,
            confidence: Math.round(confidence * 100) / 100,
            processingTime,
            language: options.language || 'en',
            segments: this.generateMockSegments(mockText),
            rawData: { mock: true }
        };
    }

    /**
     * Generate mock handwriting text for demonstration
     */
    private generateMockHandwritingText(language: string = 'en'): string {
        const mockTexts = {
            en: [
                'Meeting with John at 3 PM tomorrow',
                'Buy groceries: milk, bread, eggs',
                'Call mom about weekend plans',
                'Finish project report by Friday',
                'Book flight to New York'
            ],
            es: [
                'Reunión con Juan a las 3 PM mañana',
                'Comprar comestibles: leche, pan, huevos',
                'Llamar a mamá sobre planes de fin de semana',
                'Terminar informe del proyecto antes del viernes',
                'Reservar vuelo a Nueva York'
            ],
            fr: [
                'Réunion avec Jean à 15h demain',
                'Acheter des courses: lait, pain, œufs',
                'Appeler maman au sujet des plans de week-end',
                'Terminer le rapport de projet avant vendredi',
                'Réserver un vol vers New York'
            ]
        };

        const texts = mockTexts[language] || mockTexts.en;
        return texts[Math.floor(Math.random() * texts.length)];
    }

    /**
     * Generate mock text segments
     */
    private generateMockSegments(text: string): any[] {
        const words = text.split(' ');
        const segments = [];

        for (let i = 0; i < words.length; i++) {
            segments.push({
                text: words[i],
                confidence: 0.75 + Math.random() * 0.2, // 0.75 - 0.95
                bbox: {
                    x: Math.random() * 100,
                    y: Math.random() * 50,
                    width: words[i].length * 8 + Math.random() * 10,
                    height: 20 + Math.random() * 10
                }
            });
        }

        return segments;
    }
}