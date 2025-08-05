/**
 * Confidence Scorer
 *
 * Multi-factor confidence scoring system for symbol detection
 * combining pattern matching, ML prediction, and context validation
 */
import { DetectedSymbol, ImageQuality } from '../../../../shared/types/symbol-detection.types';
export interface ConfidenceFactors {
    patternMatchScore: number;
    mlPredictionScore: number;
    contextValidationScore: number;
    imageQualityScore: number;
    geometricConsistencyScore: number;
    spatialCoherenceScore: number;
}
export interface ConfidenceWeights {
    patternMatch: number;
    mlPrediction: number;
    contextValidation: number;
    imageQuality: number;
    geometricConsistency: number;
    spatialCoherence: number;
}
export declare class ConfidenceScorer {
    private readonly defaultWeights;
    /**
     * Calculate multi-factor confidence score for a detected symbol
     */
    calculateConfidence(symbol: DetectedSymbol, imageBuffer: Buffer, imageQuality: ImageQuality, weights?: Partial<ConfidenceWeights>): Promise<number>;
    /**
     * Calculate individual confidence factors
     */
    private calculateConfidenceFactors;
    /**
     * Calculate pattern matching confidence score
     */
    private calculatePatternMatchScore;
    /**
     * Calculate ML prediction confidence score
     */
    private calculateMLPredictionScore;
    /**
     * Calculate context validation score
     */
    private calculateContextValidationScore;
    /**
     * Calculate image quality impact on confidence
     */
    private calculateImageQualityScore;
    /**
     * Calculate geometric consistency score
     */
    private calculateGeometricConsistencyScore;
    /**
     * Calculate spatial coherence score
     */
    private calculateSpatialCoherenceScore;
    /**
     * Analyze local context around symbol
     */
    private analyzeLocalContext;
    /**
     * Check electrical symbol characteristics
     */
    private checkElectricalCharacteristics;
    /**
     * Validate symbol size reasonableness
     */
    private validateSymbolSize;
    /**
     * Validate symbol area
     */
    private validateSymbolArea;
    /**
     * Get expected aspect ratio for symbol type
     */
    private getExpectedAspectRatio;
    /**
     * Get expected complexity for symbol type
     */
    private getExpectedComplexity;
    /**
     * Get confidence score interpretation
     */
    getConfidenceInterpretation(confidence: number): string;
    /**
     * Calculate ensemble confidence from multiple detections
     */
    calculateEnsembleConfidence(symbols: DetectedSymbol[]): number;
}
//# sourceMappingURL=confidence-scorer.d.ts.map