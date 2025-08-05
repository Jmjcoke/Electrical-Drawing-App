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
  x: number;              // Normalized coordinates (0-1)
  y: number;              // Normalized coordinates (0-1)
  pageNumber: number;
  originalX: number;      // Original pixel coordinates
  originalY: number;      // Original pixel coordinates
  imageWidth: number;     // Original image dimensions
  imageHeight: number;
}

export interface BoundingBox {
  x: number;              // Top-left corner
  y: number;              // Top-left corner  
  width: number;
  height: number;
  rotation?: number;      // Symbol rotation angle
  area: number;          // Bounding box area
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
  connectedTo?: string[];   // IDs of connected symbols
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
  clarity: number;        // 0-1 scale
  contrast: number;       // 0-1 scale
  noiseLevel: number;     // 0-1 scale
  skewAngle?: number;     // Document skew in degrees
}

export interface DetectionSettings {
  confidenceThreshold: number;
  maxSymbolsPerPage: number;
  enableMLClassification: boolean;
  enablePatternMatching: boolean;
  enableLLMValidation: boolean;
  processingTimeout: number;
}

export type ElectricalSymbolType = 
  | 'resistor' | 'capacitor' | 'inductor' | 'diode' | 'transistor'
  | 'integrated_circuit' | 'connector' | 'switch' | 'relay' | 'transformer'
  | 'ground' | 'power_supply' | 'battery' | 'fuse' | 'led'
  | 'operational_amplifier' | 'logic_gate' | 'custom' | 'unknown';

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

// WebSocket Events for Symbol Detection
export interface SymbolDetectionWebSocketEvents {
  // Client to Server
  'start-symbol-detection': { 
    documentId: string; 
    sessionId: string; 
    options?: Partial<DetectionSettings>; 
  };
  'cancel-symbol-detection': { detectionJobId: string };
  
  // Server to Client
  'symbol-detection-started': { jobId: string; estimatedTime: number };
  'symbol-detection-progress': { 
    jobId: string; 
    progress: number; 
    stage: string; 
    currentSymbol?: string; 
  };
  'symbol-detection-completed': { jobId: string; result: SymbolDetectionResult };
  'symbol-detection-error': { jobId: string; error: string; details?: any };
  'symbol-detected': { symbol: DetectedSymbol; totalFound: number };
}

// Error types for symbol detection
export class SymbolDetectionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SymbolDetectionError';
  }
}

export class ImageProcessingError extends SymbolDetectionError {
  constructor(message: string, details?: any) {
    super(message, 'IMAGE_PROCESSING_ERROR', details);
    this.name = 'ImageProcessingError';
  }
}

export class PatternMatchingError extends SymbolDetectionError {
  constructor(message: string, details?: any) {
    super(message, 'PATTERN_MATCHING_ERROR', details);
    this.name = 'PatternMatchingError';
  }
}

export class MLClassificationError extends SymbolDetectionError {
  constructor(message: string, details?: any) {
    super(message, 'ML_CLASSIFICATION_ERROR', details);
    this.name = 'MLClassificationError';
  }
}