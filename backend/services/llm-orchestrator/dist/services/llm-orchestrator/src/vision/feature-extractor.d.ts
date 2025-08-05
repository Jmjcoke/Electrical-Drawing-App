/**
 * Feature Extractor
 *
 * Advanced computer vision feature extraction for electrical symbol classification
 * using OpenCV and geometric analysis
 */
import { BoundingBox, SymbolFeatures } from '../../../../shared/types/symbol-detection.types';
export interface AdvancedFeatureVector {
    geometric: {
        area: number;
        perimeter: number;
        aspectRatio: number;
        compactness: number;
        rectangularity: number;
        elongation: number;
        solidity: number;
        extent: number;
        eccentricity: number;
        orientation: number;
        convexity: number;
        roundness: number;
        formFactor: number;
        symmetryX: number;
        symmetryY: number;
        centroidDistance: number;
        hullDefects: number;
    };
    visual: {
        meanIntensity: number;
        stdIntensity: number;
        contrast: number;
        energy: number;
        entropy: number;
        homogeneity: number;
        edgeDensity: number;
        cornerCount: number;
        lineSegments: number;
        curvature: number;
        textureVariance: number;
        gradientMagnitudeStd: number;
    };
    topological: {
        holes: number;
        endpoints: number;
        junctions: number;
        branchPoints: number;
        loops: number;
        chainCode: number[];
        skeletonLength: number;
        eulerNumber: number;
    };
    contextual: {
        relativePosition: number[];
        localDensity: number;
        proximityToEdge: number;
        alignmentScore: number;
        scaleRatio: number;
        isolationScore: number;
        connectionCount: number;
    };
}
export interface HoughFeatures {
    lines: Array<{
        rho: number;
        theta: number;
        votes: number;
    }>;
    circles: Array<{
        x: number;
        y: number;
        radius: number;
        votes: number;
    }>;
    lineCount: number;
    circleCount: number;
    dominantOrientation: number;
    parallelLines: number;
    perpendicularLines: number;
}
export interface MomentFeatures {
    huMoments: number[];
    centralMoments: number[][];
    normalizedMoments: number[][];
    invariantMoments: number[];
}
export declare class FeatureExtractor {
    private imageProcessor;
    constructor();
    /**
     * Extract comprehensive features from a region
     */
    extractFeatures(regionBuffer: Buffer, boundingBox: BoundingBox, fullImageBuffer?: Buffer): Promise<{
        advanced: AdvancedFeatureVector;
        moments: MomentFeatures;
        hough: HoughFeatures;
        symbolFeatures: SymbolFeatures;
    }>;
    /**
     * Extract geometric features using OpenCV contour analysis
     */
    private extractGeometricFeatures;
    /**
     * Extract visual and texture features
     */
    private extractVisualFeatures;
    /**
     * Extract topological features using morphological operations
     */
    private extractTopologicalFeatures;
    /**
     * Extract contextual features based on position and surroundings
     */
    private extractContextualFeatures;
    /**
     * Extract Hu invariant moments and other moment features
     */
    private extractMomentFeatures;
    /**
     * Extract Hough transform features for line and circle detection
     */
    private extractHoughFeatures;
    /**
     * Extract symbol-specific features for electrical components
     */
    private extractSymbolFeatures;
    private calculateCentroidDistance;
    private calculateCentroid;
    private calculateConvexHullArea;
    private calculateConvexHullPerimeter;
    private calculateEccentricity;
    private calculateOrientation;
    private calculateHorizontalSymmetry;
    private calculateVerticalSymmetry;
    private calculateConvexityDefects;
    private calculateTextureFeatures;
    private calculateGLCMFeatures;
    private detectCorners;
    private detectLineSegments;
    private calculateEdgeDensity;
    private getDefaultGeometricFeatures;
    private getDefaultVisualFeatures;
    private getDefaultTopologicalFeatures;
    private getDefaultContextualFeatures;
    private getDefaultMomentFeatures;
    private getDefaultHoughFeatures;
    private getDefaultSymbolFeatures;
    private generateDefaultContourPoints;
    private analyzeSkeleton;
    private detectHoles;
    private analyzeConnections;
    private analyzeNeighborhood;
    private calculateImageMoments;
    private detectHoughLines;
    private detectHoughCircles;
    private analyzeLineOrientations;
    private detectConnectionPoints;
    private calculateShapeComplexity;
    private estimateStrokeWidth;
    private isClosedShape;
}
//# sourceMappingURL=feature-extractor.d.ts.map