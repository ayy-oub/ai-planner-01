import { HandwritingService } from '../../../../src/modules/handwriting/handwriting.service';
import { CacheService } from '../../../../src/shared/services/cache.service';
import { EventEmitter } from '../../../../src/shared/services/event-emitter.service';
import { AppError } from '../../../../src/shared/utils/errors';
import { HandwritingStyle, ExportFormat } from '../../../../src/shared/types/handwriting.types';

jest.mock('../../../../src/shared/services/cache.service');
jest.mock('../../../../src/shared/services/event-emitter.service');

describe('HandwritingService', () => {
    let handwritingService: HandwritingService;
    let cacheService: jest.Mocked<CacheService>;
    let eventEmitter: jest.Mocked<EventEmitter>;

    const userId = 'test-user-id';
    const plannerId = 'test-planner-id';

    beforeEach(() => {
        cacheService = new CacheService() as jest.Mocked<CacheService>;
        eventEmitter = new EventEmitter() as jest.Mocked<EventEmitter>;

        handwritingService = new HandwritingService(cacheService, eventEmitter);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('convertToHandwriting', () => {
        const convertData = {
            text: 'My Daily Tasks:\n- Complete project documentation\n- Review pull requests\n- Team standup meeting',
            style: HandwritingStyle.CURSIVE,
            format: ExportFormat.SVG,
            options: {
                fontSize: 16,
                lineHeight: 1.5,
                color: '#000000',
                paperTexture: 'ruled'
            }
        };

        it('should successfully convert text to handwriting', async () => {
            const mockResult = {
                data: '<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><text x="10" y="30" font-family="cursive" font-size="16">My Daily Tasks:</text></svg>',
                format: ExportFormat.SVG,
                fileName: 'handwriting.svg',
                mimeType: 'image/svg+xml',
                size: 2048
            };

            jest.spyOn(handwritingService as any, 'generateHandwritingSVG').mockResolvedValue(mockResult.data);
            cacheService.set.mockResolvedValue();
            eventEmitter.emit.mockReturnValue();

            const result = await handwritingService.convertToHandwriting(userId, convertData);

            expect(cacheService.set).toHaveBeenCalledWith(
                `handwriting:${userId}:${Buffer.from(convertData.text).toString('base64').slice(0, 50)}`,
                JSON.stringify(mockResult),
                3600
            );
            expect(eventEmitter.emit).toHaveBeenCalledWith('handwriting.converted', {
                conversion: result,
                userId
            });
            expect(result).toEqual(mockResult);
        });

        it('should return cached result if available', async () => {
            const cachedResult = {
                data: '<svg>Cached handwriting</svg>',
                format: ExportFormat.SVG,
                fileName: 'cached.svg',
                mimeType: 'image/svg+xml',
                size: 1024
            };

            cacheService.get.mockResolvedValue(JSON.stringify(cachedResult));

            const result = await handwritingService.convertToHandwriting(userId, convertData);

            expect(result).toEqual(cachedResult);
        });

        it('should validate input text', async () => {
            const invalidData = {
                ...convertData,
                text: '' // Empty text
            };

            await expect(handwritingService.convertToHandwriting(userId, invalidData))
                .rejects.toThrow('Text content is required');
        });

        it('should handle text length limits', async () => {
            const longTextData = {
                ...convertData,
                text: 'a'.repeat(10000) // Very long text
            };

            await expect(handwritingService.convertToHandwriting(userId, longTextData))
                .rejects.toThrow('Text exceeds maximum length of 5000 characters');
        });

        it('should support different handwriting styles', async () => {
            const styles = [HandwritingStyle.CURSIVE, HandwritingStyle.PRINT, HandwritingStyle.SCRIPT];

            for (const style of styles) {
                jest.spyOn(handwritingService as any, 'generateHandwritingSVG').mockResolvedValue(`<svg>${style}</svg>`);

                const result = await handwritingService.convertToHandwriting(userId, {
                    ...convertData,
                    style
                });

                expect(result.data).toContain(style);
            }
        });
    });

    describe('convertPlannerToHandwriting', () => {
        const plannerData = {
            title: 'My Weekly Planner',
            sections: [
                {
                    title: 'Monday',
                    activities: [
                        { title: 'Morning workout', completed: true },
                        { title: 'Team meeting', completed: false },
                        { title: 'Code review', completed: false }
                    ]
                },
                {
                    title: 'Tuesday',
                    activities: [
                        { title: 'Client call', completed: false },
                        { title: 'Project planning', completed: true }
                    ]
                }
            ]
        };

        it('should successfully convert planner to handwriting', async () => {
            const mockHandwriting = `<svg width="210mm" height="297mm">
        <text font-family="cursive" font-size="24">My Weekly Planner</text>
        <text font-family="cursive" font-size="18">Monday</text>
        <text font-family="cursive" font-size="16">✓ Morning workout</text>
        <text font-family="cursive" font-size="16">○ Team meeting</text>
      </svg>`;

            jest.spyOn(handwritingService as any, 'plannerToHandwriting').mockResolvedValue(mockHandwriting);
            jest.spyOn(handwritingService as any, 'fetchPlannerData').mockResolvedValue(plannerData);
            cacheService.set.mockResolvedValue();

            const result = await handwritingService.convertPlannerToHandwriting(userId, {
                plannerId,
                style: HandwritingStyle.CURSIVE,
                format: ExportFormat.SVG,
                options: {
                    showCompleted: true,
                    showCheckboxes: true,
                    fontSize: 18
                }
            });

            expect(result.data).toContain('My Weekly Planner');
            expect(result.data).toContain('Monday');
            expect(result.data).toContain('Morning workout');
            expect(cacheService.set).toHaveBeenCalled();
        });

        it('should handle different completion indicators', async () => {
            jest.spyOn(handwritingService as any, 'fetchPlannerData').mockResolvedValue(plannerData);
            jest.spyOn(handwritingService as any, 'plannerToHandwriting').mockImplementation((data, options) => {
                const completedChar = options.showCheckboxes ? '✓' : '✔';
                const incompleteChar = options.showCheckboxes ? '○' : '•';
                return `<svg>${completedChar} ${incompleteChar}</svg>`;
            });

            const result = await handwritingService.convertPlannerToHandwriting(userId, {
                plannerId,
                style: HandwritingStyle.PRINT,
                format: ExportFormat.SVG,
                options: {
                    showCompleted: true,
                    showCheckboxes: true
                }
            });

            expect(result.data).toContain('✓');
            expect(result.data).toContain('○');
        });

        it('should support different paper formats', async () => {
            const paperFormats = ['A4', 'letter', 'legal'] as const;

            for (const format of paperFormats) {
                jest.spyOn(handwritingService as any, 'fetchPlannerData').mockResolvedValue(plannerData);
                jest.spyOn(handwritingService as any, 'plannerToHandwriting').mockResolvedValue(`<svg>${format}</svg>`);

                const result = await handwritingService.convertPlannerToHandwriting(userId, {
                    plannerId,
                    style: HandwritingStyle.CURSIVE,
                    format: ExportFormat.SVG,
                    options: {
                        paperSize: format,
                        orientation: 'portrait'
                    }
                });

                expect(result.data).toContain(format);
            }
        });

        it('should handle empty planner sections', async () => {
            const emptyPlannerData = {
                title: 'Empty Planner',
                sections: []
            };

            jest.spyOn(handwritingService as any, 'fetchPlannerData').mockResolvedValue(emptyPlannerData);
            jest.spyOn(handwritingService as any, 'plannerToHandwriting').mockResolvedValue('<svg>Empty planner message</svg>');

            const result = await handwritingService.convertPlannerToHandwriting(userId, {
                plannerId,
                style: HandwritingStyle.CURSIVE,
                format: ExportFormat.SVG
            });

            expect(result.data).toContain('Empty planner message');
        });

        it('should validate planner access', async () => {
            jest.spyOn(handwritingService as any, 'fetchPlannerData').mockRejectedValue(
                new Error('Planner not found')
            );

            await expect(handwritingService.convertPlannerToHandwriting(userId, {
                plannerId: 'invalid-planner',
                style: HandwritingStyle.CURSIVE,
                format: ExportFormat.SVG
            })).rejects.toThrow('Failed to fetch planner data');
        });
    });

    describe('generateHandwritingFont', () => {
        const fontData = {
            style: HandwritingStyle.CURSIVE,
            baseFont: 'Arial',
            variations: {
                slant: 15, // degrees
                sizeVariation: 0.1, // 10% size variation
                spacing: 1.2 // letter spacing multiplier
            }
        };

        it('should successfully generate handwriting font', async () => {
            const mockFontData = {
                fontFamily: 'CustomCursive',
                src: 'data:font/woff2;base64,d09GMk9UVE8AA...',
                css: '@font-face { font-family: "CustomCursive"; src: url("data:font/woff2;base64,d09GMk9UVE8AA..."); }',
                metrics: {
                    ascent: 800,
                    descent: 200,
                    unitsPerEm: 1000
                }
            };

            jest.spyOn(handwritingService as any, 'generateFontData').mockResolvedValue(mockFontData);
            cacheService.set.mockResolvedValue();

            const result = await handwritingService.generateHandwritingFont(userId, fontData);

            expect(result).toEqual(mockFontData);
            expect(cacheService.set).toHaveBeenCalledWith(
                `handwriting:font:${userId}:${fontData.style}`,
                JSON.stringify(mockFontData),
                86400
            );
        });

        it('should return cached font if available', async () => {
            const cachedFont = {
                fontFamily: 'CachedFont',
                src: 'cached-src',
                css: 'cached-css'
            };

            cacheService.get.mockResolvedValue(JSON.stringify(cachedFont));

            const result = await handwritingService.generateHandwritingFont(userId, fontData);

            expect(result).toEqual(cachedFont);
        });

        it('should validate font parameters', async () => {
            const invalidFontData = {
                ...fontData,
                variations: {
                    slant: 90, // Too much slant
                    sizeVariation: 0.5, // Too much variation
                    spacing: 5 // Too much spacing
                }
            };

            await expect(handwritingService.generateHandwritingFont(userId, invalidFontData))
                .rejects.toThrow('Invalid font variation parameters');
        });

        it('should handle font generation failures', async () => {
            jest.spyOn(handwritingService as any, 'generateFontData').mockRejectedValue(
                new Error('Font generation service unavailable')
            );

            await expect(handwritingService.generateHandwritingFont(userId, fontData))
                .rejects.toThrow('Failed to generate handwriting font');
        });
    });

    describe('convertHandwritingToText', () => {
        const imageData = {
            imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            language: 'en',
            options: {
                confidenceThreshold: 0.8,
                preprocessing: true,
                segmentation: 'word'
            }
        };

        it('should successfully convert handwriting image to text', async () => {
            const mockResult = {
                text: 'Hello World\nThis is handwritten text',
                confidence: 0.92,
                segments: [
                    { text: 'Hello', confidence: 0.95, bbox: [10, 10, 50, 30] },
                    { text: 'World', confidence: 0.89, bbox: [60, 10, 100, 30] }
                ],
                language: 'en',
                processingTime: 1250
            };

            jest.spyOn(handwritingService as any, 'recognizeHandwriting').mockResolvedValue(mockResult);
            cacheService.set.mockResolvedValue();

            const result = await handwritingService.convertHandwritingToText(userId, imageData);

            expect(result).toEqual(mockResult);
            expect(cacheService.set).toHaveBeenCalledWith(
                `handwriting:ocr:${userId}:${imageData.imageBase64.slice(-50)}`,
                JSON.stringify(mockResult),
                7200
            );
        });

        it('should validate image format', async () => {
            const invalidImageData = {
                ...imageData,
                imageBase64: 'invalid-image-data'
            };

            await expect(handwritingService.convertHandwritingToText(userId, invalidImageData))
                .rejects.toThrow('Invalid image format');
        });

        it('should handle image size limits', async () => {
            const largeImageData = {
                ...imageData,
                imageBase64: 'data:image/png;base64,' + 'a'.repeat(10 * 1024 * 1024) // 10MB image
            };

            await expect(handwritingService.convertHandwritingToText(userId, largeImageData))
                .rejects.toThrow('Image size exceeds maximum limit of 5MB');
        });

        it('should support multiple languages', async () => {
            const languages = ['en', 'es', 'fr', 'de', 'zh'];

            for (const language of languages) {
                jest.spyOn(handwritingService as any, 'recognizeHandwriting').mockResolvedValue({
                    text: 'Recognized text',
                    confidence: 0.9,
                    language
                });

                const result = await handwritingService.convertHandwritingToText(userId, {
                    ...imageData,
                    language
                });

                expect(result.language).toBe(language);
            }
        });

        it('should handle low confidence recognition', async () => {
            const lowConfidenceResult = {
                text: 'Uncertain text',
                confidence: 0.6,
                segments: [
                    { text: 'Uncertain', confidence: 0.55, bbox: [10, 10, 80, 30] }
                ]
            };

            jest.spyOn(handwritingService as any, 'recognizeHandwriting').mockResolvedValue(lowConfidenceResult);

            const result = await handwritingService.convertHandwritingToText(userId, {
                ...imageData,
                options: {
                    ...imageData.options,
                    confidenceThreshold: 0.8
                }
            });

            expect(result.confidence).toBeLessThan(0.8);
            expect(result).toHaveProperty('warning', 'Low confidence recognition');
        });

        it('should handle OCR failures gracefully', async () => {
            jest.spyOn(handwritingService as any, 'recognizeHandwriting').mockRejectedValue(
                new Error('OCR service unavailable')
            );

            await expect(handwritingService.convertHandwritingToText(userId, imageData))
                .rejects.toThrow('Failed to recognize handwriting');
        });
    });

    describe('getHandwritingStyles', () => {
        it('should return available handwriting styles', async () => {
            const mockStyles = [
                {
                    id: 'cursive',
                    name: 'Cursive',
                    description: 'Elegant connected handwriting',
                    preview: 'data:image/png;base64,preview1',
                    fonts: ['Dancing Script', 'Pacifico']
                },
                {
                    id: 'print',
                    name: 'Print',
                    description: 'Clean printed handwriting',
                    preview: 'data:image/png;base64,preview2',
                    fonts: ['Arial', 'Helvetica']
                }
            ];

            jest.spyOn(handwritingService as any, 'fetchAvailableStyles').mockResolvedValue(mockStyles);
            cacheService.get.mockResolvedValue(null);
            cacheService.set.mockResolvedValue();

            const result = await handwritingService.getHandwritingStyles();

            expect(result).toEqual(mockStyles);
            expect(cacheService.set).toHaveBeenCalledWith(
                'handwriting:styles',
                JSON.stringify(mockStyles),
                86400
            );
        });

        it('should return cached styles if available', async () => {
            const cachedStyles = [
                {
                    id: 'cached-style',
                    name: 'Cached Style',
                    description: 'From cache',
                    preview: 'cached-preview'
                }
            ];

            cacheService.get.mockResolvedValue(JSON.stringify(cachedStyles));

            const result = await handwritingService.getHandwritingStyles();

            expect(result).toEqual(cachedStyles);
        });

        it('should filter styles by language support', async () => {
            const multilingualStyles = [
                {
                    id: 'cursive',
                    name: 'Cursive',
                    supportedLanguages: ['en', 'es', 'fr']
                },
                {
                    id: 'chinese',
                    name: 'Chinese Brush',
                    supportedLanguages: ['zh', 'ja', 'ko']
                }
            ];

            jest.spyOn(handwritingService as any, 'fetchAvailableStyles').mockResolvedValue(multilingualStyles);

            const result = await handwritingService.getHandwritingStyles('zh');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('chinese');
        });
    });

    describe('trackHandwritingUsage', () => {
        it('should track handwriting conversion usage', async () => {
            const usageData = {
                style: HandwritingStyle.CURSIVE,
                format: ExportFormat.SVG,
                textLength: 150,
                processingTime: 2500,
                userAgent: 'Mozilla/5.0...',
                timestamp: new Date()
            };

            jest.spyOn(handwritingService as any, 'saveUsageMetrics').mockResolvedValue(true);
            eventEmitter.emit.mockReturnValue();

            const result = await handwritingService.trackHandwritingUsage(userId, usageData);

            expect(result).toBe(true);
            expect(eventEmitter.emit).toHaveBeenCalledWith('handwriting.usage.tracked', {
                userId,
                usage: usageData
            });
        });

        it('should handle usage tracking failures', async () => {
            jest.spyOn(handwritingService as any, 'saveUsageMetrics').mockRejectedValue(
                new Error('Database error')
            );

            await expect(handwritingService.trackHandwritingUsage(userId, {
                style: HandwritingStyle.PRINT,
                format: ExportFormat.PNG,
                textLength: 100,
                processingTime: 1000
            })).rejects.toThrow('Failed to track usage');
        });

        it('should anonymize usage data', async () => {
            jest.spyOn(handwritingService as any, 'saveUsageMetrics').mockResolvedValue(true);

            await handwritingService.trackHandwritingUsage(userId, {
                style: HandwritingStyle.CURSIVE,
                format: ExportFormat.SVG,
                textLength: 200,
                processingTime: 3000,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            });

            expect(eventEmitter.emit).toHaveBeenCalledWith(
                'handwriting.usage.tracked',
                expect.objectContaining({
                    userId,
                    usage: expect.objectContaining({
                        userAgent: expect.stringContaining('Mozilla/5.0'),
                        // Should not contain detailed OS info
                        userAgent: expect.not.stringContaining('Windows NT 10.0')
                    })
                })
            );
        });
    });
});