// Computer Vision Service Types for AI Canvas Integration

export interface ComponentDetection {
  id: string;
  type: ElectricalComponentType;
  confidence: number;
  boundingBox: BoundingBox;
  specifications?: ComponentSpecifications;
  metadata?: ComponentMetadata;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComponentSpecifications {
  manufacturer?: string;
  modelNumber?: string;
  voltage?: number;
  amperage?: number;
  powerRating?: number;
  environmentalRating?: string;
}

export interface ComponentMetadata {
  detectionTimestamp: Date;
  modelVersion: string;
  processingTime: number;
  imageRegion: ImageRegion;
}

export interface ImageRegion {
  sourceWidth: number;
  sourceHeight: number;
  scale: number;
  offset: { x: number; y: number };
}

export enum ElectricalComponentType {
  BREAKER = 'breaker',
  RELAY = 'relay',
  CONTACTOR = 'contactor',
  TRANSFORMER = 'transformer',
  SWITCH = 'switch',
  FUSE = 'fuse',
  TERMINAL = 'terminal',
  JUNCTION_BOX = 'junction_box',
  CONDUIT = 'conduit',
  WIRE = 'wire',
  MOTOR = 'motor',
  SENSOR = 'sensor',
  UNKNOWN = 'unknown'
}

export interface ComponentDetectionResult {
  analysisId: string;
  drawingId: string;
  components: ComponentDetection[];
  processingTime: number;
  modelVersion: string;
  confidence: {
    overall: number;
    byType: Record<ElectricalComponentType, number>;
  };
  metadata: {
    imageResolution: { width: number; height: number };
    analysisTimestamp: Date;
    totalDetections: number;
  };
}

export interface AnalysisSession {
  id: string;
  drawingId: string;
  status: AnalysisStatus;
  currentStage: AnalysisStage;
  startTime: Date;
  estimatedCompletion?: Date;
  results?: ComponentDetectionResult;
  progress: {
    overall: number;
    byStage: Record<AnalysisStage, number>;
  };
}

export enum AnalysisStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum AnalysisStage {
  IDLE = 'idle',
  PREPROCESSING = 'preprocessing',
  COMPONENT_DETECTION = 'component-detection',
  CLOUD_DETECTION = 'cloud-detection',
  CIRCUIT_ANALYSIS = 'circuit-analysis',
  ESTIMATION = 'estimation',
  COMPLETE = 'complete',
  ERROR = 'error'
}

export interface AnalysisOptions {
  confidenceThreshold?: number;
  includeText?: boolean;
  forceRefresh?: boolean;
  maxDetections?: number;
  enableCloudDetection?: boolean;
  enableCircuitTracing?: boolean;
}

export interface AIUpdate {
  type: AIUpdateType;
  analysisId: string;
  timestamp: Date;
  data: any;
  error?: Error;
}

export enum AIUpdateType {
  ANALYSIS_STARTED = 'analysis-started',
  STAGE_UPDATED = 'stage-updated',
  COMPONENT_DETECTED = 'component-detected',
  CLOUD_DETECTED = 'cloud-detected',
  CIRCUIT_TRACED = 'circuit-traced',
  ESTIMATION_UPDATED = 'estimation-updated',
  ANALYSIS_COMPLETE = 'analysis-complete',
  ERROR_OCCURRED = 'error-occurred'
}

export interface AIError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  recoverable: boolean;
}

export interface ConfidenceMetrics {
  overall: number;
  byService: Record<string, number>;
  distribution: {
    high: number; // >85%
    medium: number; // 70-85%
    low: number; // <70%
  };
}