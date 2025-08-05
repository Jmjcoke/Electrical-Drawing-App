/**
 * Symbol Detection Types
 *
 * TypeScript type definitions for electrical symbol detection system
 */
export interface SymbolDetectionResult {
    id: string;
    queryId: string;
    documentId: string;
    pageNumber: number;
    detectedSymbols: DetectedSymbol[];
    processingTimeMs: number;
    overallConfidence: number;
    detectionMetadata: DetectionMetadata;
    createdAt: Date;
}
export interface DetectedSymbol {
    id: string;
    symbolType: ElectricalSymbolType;
    symbolCategory: SymbolCategory;
    description: string;
    confidence: number;
    location: SymbolLocation;
    boundingBox: BoundingBox;
    detectionMethod: DetectionMethod;
    features: SymbolFeatures;
    validationScore: number;
}
export interface SymbolLocation {
    x: number;
    y: number;
    pageNumber: number;
    originalX: number;
    originalY: number;
    imageWidth: number;
    imageHeight: number;
}
export interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    area: number;
}
export interface SymbolFeatures {
    contourPoints: Point[];
    geometricProperties: GeometricProperties;
    connectionPoints: ConnectionPoint[];
    shapeAnalysis: ShapeAnalysis;
    textLabels?: string[];
}
export interface Point {
    x: number;
    y: number;
}
export interface GeometricProperties {
    area: number;
    perimeter: number;
    centroid: Point;
    boundaryRectangle: BoundingBox;
    symmetryAxes: SymmetryAxis[];
    aspectRatio: number;
}
export interface SymmetryAxis {
    angle: number;
    confidence: number;
}
export interface ConnectionPoint {
    location: Point;
    type: 'input' | 'output' | 'bidirectional' | 'ground';
    connectedTo?: string[];
}
export interface ShapeAnalysis {
    complexity: number;
    orientation: number;
    strokeWidth: number;
    isClosed: boolean;
}
export interface DetectionMetadata {
    imageProcessingTime: number;
    patternMatchingTime: number;
    mlClassificationTime: number;
    validationTime: number;
    totalProcessingTime: number;
    imageQuality: ImageQuality;
    detectionSettings: DetectionSettings;
}
export interface ImageQuality {
    resolution: number;
    clarity: number;
    contrast: number;
    noiseLevel: number;
    skewAngle?: number;
}
export interface DetectionSettings {
    confidenceThreshold: number;
    maxSymbolsPerPage: number;
    enableMLClassification: boolean;
    enablePatternMatching: boolean;
    enableLLMValidation: boolean;
    processingTimeout: number;
}
export type ElectricalSymbolType = 'resistor' | 'capacitor' | 'inductor' | 'diode' | 'transistor' | 'integrated_circuit' | 'connector' | 'switch' | 'relay' | 'transformer' | 'ground' | 'power_supply' | 'battery' | 'fuse' | 'led' | 'operational_amplifier' | 'logic_gate' | 'custom' | 'unknown';
export type SymbolCategory = 'passive' | 'active' | 'connector' | 'power' | 'protection' | 'logic' | 'custom';
export type DetectionMethod = 'pattern_matching' | 'ml_classification' | 'llm_analysis' | 'consensus';
export interface DetectionJob {
    id: string;
    documentId: string;
    sessionId: string;
    pageNumber: number;
    imageBuffer: Buffer;
    settings: DetectionSettings;
    createdAt: Date;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progressStage?: string;
    progressPercent?: number;
}
export interface DetectionJobResult {
    jobId: string;
    result?: SymbolDetectionResult;
    error?: string;
    completedAt: Date;
}
export interface SymbolDetectionWebSocketEvents {
    'start-symbol-detection': {
        documentId: string;
        sessionId: string;
        options?: Partial<DetectionSettings>;
    };
    'cancel-symbol-detection': {
        detectionJobId: string;
    };
    'symbol-detection-started': {
        jobId: string;
        estimatedTime: number;
    };
    'symbol-detection-progress': {
        jobId: string;
        progress: number;
        stage: string;
        currentSymbol?: string;
    };
    'symbol-detection-completed': {
        jobId: string;
        result: SymbolDetectionResult;
    };
    'symbol-detection-error': {
        jobId: string;
        error: string;
        details?: any;
    };
    'symbol-detected': {
        symbol: DetectedSymbol;
        totalFound: number;
    };
}
export declare class SymbolDetectionError extends Error {
    code: string;
    details?: any | undefined;
    constructor(message: string, code: string, details?: any | undefined);
}
export declare class ImageProcessingError extends SymbolDetectionError {
    constructor(message: string, details?: any);
}
export declare class PatternMatchingError extends SymbolDetectionError {
    constructor(message: string, details?: any);
}
export declare class MLClassificationError extends SymbolDetectionError {
    constructor(message: string, details?: any);
}
//# sourceMappingURL=symbol-detection.types.d.ts.map