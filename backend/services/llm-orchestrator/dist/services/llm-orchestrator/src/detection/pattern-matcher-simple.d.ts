/**
 * Simple Pattern Matcher - Phase 2 Implementation
 *
 * Core pattern matching functionality with advanced features
 */
import { DetectedSymbol } from '../../../../shared/types/symbol-detection.types';
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
export declare class PatternMatcherSimple {
    private symbolLibrary;
    constructor();
    /**
     * Get available symbol templates
     */
    getAvailableTemplates(): import("../vision/symbol-library").SymbolTemplate[];
    /**
     * Detect symbols in an image using advanced pattern matching
     */
    detectSymbols(_imageBuffer: Buffer, options: PatternMatchingOptions): Promise<DetectedSymbol[]>;
    /**
     * Perform high-priority template matching
     */
    private performHighPriorityMatching;
    /**
     * Perform rotation/scale invariant matching
     */
    private performInvariantMatching;
    /**
     * Perform ensemble matching
     */
    private performEnsembleMatching;
    /**
     * Match a single template against the image
     */
    private matchTemplate;
    /**
     * Match template variants for invariant matching
     */
    private matchTemplateVariants;
    /**
     * Match template using ensemble method
     */
    private matchTemplateEnsemble;
    /**
     * Create a detected symbol from template and confidence
     */
    private createDetectedSymbol;
    /**
     * Generate mock contour points
     */
    private generateMockContourPoints;
    /**
     * Finalize detection results
     */
    private finalizeResults;
    /**
     * Remove duplicate detections
     */
    private removeDuplicates;
    /**
     * Calculate overlap between two bounding boxes
     */
    private calculateOverlap;
}
//# sourceMappingURL=pattern-matcher-simple.d.ts.map