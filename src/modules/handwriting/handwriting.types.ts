export interface HandwritingRecognitionResult {
    text: string;
    confidence: number;
    processingTime: number;
    language: string;
    segments: TextSegment[];
    rawData?: any;
}

export interface TextSegment {
    text: string;
    confidence: number;
    bbox: BoundingBox;
}

export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface HandwritingProcessingOptions {
    language?: string;
    autoCorrect?: boolean;
    preserveFormatting?: boolean;
    extractTables?: boolean;
    confidenceThreshold?: number;
}

export interface HandwritingHistoryItem {
    id: string;
    text: string;
    confidence: number;
    processedAt: Date;
    fileName: string;
    language: string;
}

export interface SupportedLanguage {
    code: string;
    name: string;
    nativeName: string;
}

export interface ProcessingStats {
    totalProcessed: number;
    averageConfidence: number;
    averageProcessingTime: number;
    languageDistribution: Record<string, number>;
}