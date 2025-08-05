/**
 * Image Processor
 *
 * Handles PDF to image conversion, image preprocessing, and quality assessment
 * for electrical symbol detection
 */
import { ImageQuality, Point } from '../../../../shared/types/symbol-detection.types';
export interface ImageProcessingOptions {
    enhanceContrast?: boolean;
    reduceNoise?: boolean;
    detectEdges?: boolean;
    normalizeResolution?: boolean;
    targetResolution?: number;
}
export interface CoordinateNormalizationResult {
    normalizedX: number;
    normalizedY: number;
    originalX: number;
    originalY: number;
    imageWidth: number;
    imageHeight: number;
}
export declare class ImageProcessor {
    private readonly DEFAULT_DPI;
    private isOpenCVReady;
    /**
     * Convert PDF buffer to array of image buffers
     */
    convertPdfToImages(pdfBuffer: Buffer, options?: {
        dpi?: number;
        format?: 'png' | 'jpeg';
    }): Promise<Buffer[]>;
    /**
     * Preprocess image for better symbol detection
     */
    preprocessImage(imageBuffer: Buffer, options?: ImageProcessingOptions): Promise<Buffer>;
    /**
     * Initialize OpenCV if not already ready
     */
    private initializeOpenCV;
    /**
     * Advanced preprocessing using OpenCV
     */
    preprocessImageWithOpenCV(imageBuffer: Buffer, options?: ImageProcessingOptions & {
        morphologyOperation?: 'opening' | 'closing' | 'gradient' | 'tophat' | 'blackhat';
        kernelSize?: number;
        gaussianKernelSize?: number;
        bilateralD?: number;
        cannyLowThreshold?: number;
        cannyHighThreshold?: number;
    }): Promise<{
        processed: Buffer;
        edges: Buffer;
        morphological: Buffer;
        denoised: Buffer;
    }>;
    /**
     * Extract contours using OpenCV
     */
    extractContoursWithOpenCV(imageBuffer: Buffer): Promise<{
        contours: any[];
        hierarchy: any[];
        contoursImage: Buffer;
    }>;
    /**
     * Convert Buffer to OpenCV Mat
     */
    private bufferToMat;
    /**
     * Convert OpenCV Mat to Buffer
     */
    private matToBuffer;
    /**
     * Assess image quality for detection reliability
     */
    assessImageQuality(imageBuffer: Buffer): Promise<ImageQuality>;
    /**
     * Normalize coordinates from pixel to relative coordinates (0-1)
     */
    normalizeCoordinates(pixelX: number, pixelY: number, imageWidth: number, imageHeight: number): CoordinateNormalizationResult;
    /**
     * Convert normalized coordinates back to pixel coordinates
     */
    denormalizeCoordinates(normalizedX: number, normalizedY: number, imageWidth: number, imageHeight: number): Point;
    /**
     * Extract regions of interest from image based on bounding boxes
     */
    extractRegions(imageBuffer: Buffer, regions: {
        x: number;
        y: number;
        width: number;
        height: number;
    }[]): Promise<Buffer[]>;
    /**
     * Apply image filters for better symbol detection using OpenCV
     */
    applyDetectionFilters(imageBuffer: Buffer): Promise<{
        original: Buffer;
        edges: Buffer;
        morphological: Buffer;
        thresholded: Buffer;
    }>;
    /**
     * Advanced morphological operations using OpenCV
     */
    applyMorphologicalOperations(imageBuffer: Buffer, operations: Array<{
        operation: 'opening' | 'closing' | 'gradient' | 'tophat' | 'blackhat' | 'dilate' | 'erode';
        kernelSize: number;
        iterations?: number;
    }>): Promise<{
        processed: Buffer;
        steps: Buffer[];
    }>;
    /**
     * Multi-scale edge detection using different techniques
     */
    detectMultiScaleEdges(imageBuffer: Buffer): Promise<{
        canny: Buffer;
        sobel: Buffer;
        laplacian: Buffer;
        combined: Buffer;
    }>;
    /**
     * Combine multiple edge detection results
     */
    private combineEdgeResults;
    /**
     * Create mock PDF page for testing
     */
    private createMockPdfPage;
    /**
     * Calculate image clarity based on statistics
     */
    private calculateClarity;
    /**
     * Calculate image contrast based on statistics
     */
    private calculateContrast;
    /**
     * Estimate noise level in image
     */
    private estimateNoiseLevel;
    /**
     * Detect document skew angle (simplified implementation)
     */
    private detectSkewAngle;
}
//# sourceMappingURL=image-processor.d.ts.map