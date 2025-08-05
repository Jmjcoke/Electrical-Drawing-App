/**
 * ML Classifier
 *
 * Machine learning-based classification for electrical symbols
 * using TensorFlow.js models and advanced feature extraction
 */
import * as tf from '@tensorflow/tfjs-node';
import { DetectedSymbol, ElectricalSymbolType, SymbolCategory } from '../../../../shared/types/symbol-detection.types';
export interface MLClassificationOptions {
    confidenceThreshold: number;
    enableEnsemble?: boolean;
    modelVersion?: string;
}
export interface MLPrediction {
    symbolType: ElectricalSymbolType;
    symbolCategory: SymbolCategory;
    confidence: number;
    probabilities: Record<ElectricalSymbolType, number>;
}
export interface FeatureVector {
    geometric: number[];
    visual: number[];
    contextual: number[];
}
export interface NeuralNetworkModel {
    mainClassifier: tf.LayersModel;
    geometricClassifier: tf.LayersModel;
    visualClassifier: tf.LayersModel;
    ensembleModel: tf.LayersModel;
}
export declare class MLClassifier {
    private models;
    private isModelLoaded;
    private modelVersion;
    private featureExtractor;
    private supportedSymbols;
    private readonly FEATURE_MEANS;
    private readonly FEATURE_STDS;
    constructor();
    /**
     * Classify symbols using TensorFlow.js neural networks
     */
    classifySymbols(imageBuffer: Buffer, existingSymbols?: DetectedSymbol[]): Promise<DetectedSymbol[]>;
    /**
     * Extract regions of interest for classification
     */
    private extractRegionsOfInterest;
    /**
     * Find symbol candidates using computer vision techniques
     */
    private findSymbolCandidates;
    /**
     * Validate if a region could contain a symbol
     */
    private isValidSymbolRegion;
    /**
     * Extract region image from full image
     */
    private extractRegionImage;
    /**
     * Extract advanced features from region
     */
    private extractAdvancedFeatures;
    /**
     * Classify a batch of regions using neural networks
     */
    private classifyRegionBatch;
    /**
     * Prepare feature tensor from advanced feature vector
     */
    private prepareFeatureTensor;
    /**
     * Normalize features using z-score normalization
     */
    private normalizeFeatures;
    /**
     * Create DetectedSymbol from region and prediction
     */
    private createDetectedSymbol;
    /**
     * Enhanced ensemble method combining pattern matching and ML predictions
     */
    private enhanceWithEnsembleMethod;
    /**
     * Create consensus symbol from pattern matching and ML predictions
     */
    private createConsensusSymbol;
    /**
     * Apply ensemble-specific filters
     */
    private applyEnsembleFilters;
    /**
     * Remove spatially overlapping duplicate symbols
     */
    private removeSpatialDuplicates;
    /**
     * Apply electrical engineering validation rules
     */
    private applyElectricalValidation;
    /**
     * Enhance existing symbols with ML predictions (fallback method)
     */
    private enhanceExistingSymbols;
    /**
     * Calculate overlap between two bounding boxes
     */
    private calculateOverlap;
    /**
     * Get symbol category from symbol type
     */
    private getSymbolCategory;
    /**
     * Get symbol description
     */
    private getSymbolDescription;
    /**
     * Generate mock contour points for bounding box
     */
    private generateMockContourPoints;
    /**
     * Extract mock features for testing
     */
    private extractMockFeatures;
    /**
     * Initialize TensorFlow.js models
     */
    private initializeModels;
    /**
     * Create main classifier neural network
     */
    private createMainClassifierModel;
    /**
     * Create specialized geometric classifier
     */
    private createGeometricClassifierModel;
    /**
     * Create specialized visual classifier
     */
    private createVisualClassifierModel;
    /**
     * Create ensemble model that combines specialist predictions
     */
    private createEnsembleModel;
    /**
     * Get model information
     */
    getModelInfo(): {
        version: string;
        supportedSymbols: ElectricalSymbolType[];
        isLoaded: boolean;
    };
    /**
     * Performance optimization methods
     */
    optimizeForPerformance(): Promise<void>;
    /**
     * Warm up models with dummy inference to optimize performance
     */
    private warmUpModels;
    /**
     * Get performance metrics
     */
    getPerformanceMetrics(): {
        modelMemoryUsage: number;
        averageInferenceTime: number;
        supportedBatchSize: number;
        isOptimized: boolean;
    };
    /**
     * Clean up GPU memory and dispose models
     */
    dispose(): Promise<void>;
    /**
     * Update model version and reload
     */
    updateModel(version: string): Promise<void>;
    /**
     * Enable/disable parallel processing
     */
    setParallelProcessing(enabled: boolean): void;
    /**
     * Set memory growth to prevent OOM errors
     */
    setMemoryGrowth(enabled: boolean): void;
}
//# sourceMappingURL=ml-classifier.d.ts.map