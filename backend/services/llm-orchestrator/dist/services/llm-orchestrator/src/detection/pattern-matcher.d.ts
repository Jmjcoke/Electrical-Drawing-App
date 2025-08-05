/**
 * Pattern Matcher
 *
 * Template matching algorithms for electrical symbol recognition
 * using contour detection and template matching
 */
import { DetectedSymbol, BoundingBox, Point } from '../../../../shared/types/symbol-detection.types';
import { SymbolTemplate } from '../vision/symbol-library';
export interface PatternMatchingOptions {
    confidenceThreshold: number;
    maxSymbols: number;
    enableRotationInvariance?: boolean;
    enableScaleInvariance?: boolean;
    enableEnsembleMatching?: boolean;
    enableHuMoments?: boolean;
    enableKeyPointMatching?: boolean;
    parallelProcessing?: boolean;
    maxProcessingTime?: number;
    adaptiveFiltering?: boolean;
    earlyTermination?: boolean;
    memoryOptimization?: boolean;
    batchSize?: number;
}
export declare class PatternMatcher {
    private templates;
    private symbolLibrary;
    private isInitialized;
    private imageProcessor;
    constructor();
    /**
     * Advanced detect symbols with rotation/scale invariance, ensemble matching, and performance optimization
     */
    detectSymbols(imageBuffer: Buffer, options: PatternMatchingOptions): Promise<DetectedSymbol[]>;
    /**
     * Apply performance optimizations based on image size and processing constraints
     */
    private applyPerformanceOptimizations;
    /**
     * Check if processing should terminate early
     */
    private shouldTerminateEarly;
    /**
     * Check if there's sufficient time remaining for next phase
     */
    private hasTimeRemaining;
    /**
     * Finalize detection results with optimization and performance logging
     */
    private finalizeResults;
    /**
     * Get distribution of symbol types for performance analysis
     */
    private getSymbolTypeDistribution;
    /**
     * Perform high-priority template matching for common symbols
     */
    private performHighPriorityMatching;
    /**
     * Perform rotation and scale invariant matching
     */
    private performInvariantMatching;
    /**
     * Perform ensemble matching combining multiple template variants
     */
    private performEnsembleMatching;
    /**
     * Perform keypoint-based matching using SIFT/ORB-like features
     */
    private performKeypointMatching;
    /**
     * Extract contours from image for symbol detection using OpenCV
     */
    private extractContours;
    /**
     * Generate mock contours for fallback
     */
    private generateMockContours;
    /**
     * Match a contour against all symbol templates
     */
    private extractSymbolFeatures;
    /**
     * Calculate invariant moments for shape matching using OpenCV
     */
    private calculateInvariantMoments;
    /**
     * Create image buffer from contour points for OpenCV processing
     */
    private createContourImageBuffer;
    /**
     * Calculate Hu moments using OpenCV (mock implementation for now)
     */
    private calculateHuMoments;
    /**
     * Calculate geometric-based moments as fallback
     */
    private calculateGeometricMoments;
    /**
     * Calculate similarity between moment vectors
     */
    private calculateMomentSimilarity;
    /**
     * Calculate geometric properties of contour
     */
    private calculateGeometricProperties;
    /**
     * Calculate geometric similarity between shapes
     */
    private calculateGeometricSimilarity;
    /**
     * Find potential connection points in contour
     */
    private findConnectionPoints;
    /**
     * Calculate centroid of point cloud
     */
    private calculateCentroid;
    /**
     * Calculate shape complexity
     */
    private calculateShapeComplexity;
    /**
     * Calculate shape orientation
     */
    private calculateOrientation;
    /**
     * Estimate stroke width
     */
    private estimateStrokeWidth;
    /**
     * Check if contour is closed
     */
    private isClosedContour;
    /**
     * Initialize symbol templates
     */
    private initializeTemplates;
    /**
     * Get available templates
     */
    getAvailableTemplates(): SymbolTemplate[];
    /**
     * Add custom template
     */
    addTemplate(template: SymbolTemplate): void;
    /**
     * Remove template
     */
    removeTemplate(templateId: string): boolean;
    /**
     * Enhanced template matching using OpenCV techniques
     */
    performTemplateMatching(imageBuffer: Buffer, templateImage: Buffer, options?: {
        method?: 'TM_CCOEFF_NORMED' | 'TM_CCORR_NORMED' | 'TM_SQDIFF_NORMED';
        threshold?: number;
    }): Promise<{
        matches: Array<{
            x: number;
            y: number;
            confidence: number;
            width: number;
            height: number;
        }>;
        matchImage: Buffer;
    }>;
    /**
     * Simulate template matching (placeholder for actual OpenCV implementation)
     */
    private simulateTemplateMatching;
    /**
     * Create visualization of template matches
     */
    private createMatchVisualization;
    /**
     * Calculate template similarity using multiple metrics
     */
    calculateTemplateSimilarity(contour: Contour, templateContour: Contour): Promise<{
        shapeMatch: number;
        sizeMatch: number;
        orientationMatch: number;
        overallSimilarity: number;
    }>;
    /**
     * Batch contours for parallel processing
     */
    private batchContours;
    (): any;
}
interface Contour {
    points: Point[];
    boundingBox: BoundingBox;
    area: number;
    perimeter: number;
}
export {};
//# sourceMappingURL=pattern-matcher.d.ts.map