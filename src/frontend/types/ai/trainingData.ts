// Training Data Management Types - Story 3.6

export interface TrainingDataset {
  id: string;
  name: string;
  description: string;
  category: DatasetCategory;
  electricalStandard: ElectricalStandard;
  projectType: ProjectType;
  annotations: Annotation[];
  qualityScore: number;
  fileCount: number;
  totalSize: number;
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
  status: DatasetStatus;
  tags: string[];
}

export interface TrainingFile {
  id: string;
  datasetId: string;
  originalName: string;
  fileName: string;
  fileType: SupportedFileType;
  fileSize: number;
  uploadedAt: Date;
  uploadedBy: string;
  processingStatus: FileProcessingStatus;
  annotations: Annotation[];
  metadata: FileMetadata;
  thumbnailUrl?: string;
  previewUrl?: string;
}

export interface Annotation {
  id: string;
  fileId: string;
  boundingBox: BoundingBox;
  componentType: ElectricalComponentType;
  specifications: ComponentSpecifications;
  confidence: number;
  annotatedBy: string;
  annotatedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewStatus: ReviewStatus;
  reviewComments?: string;
  isGroundTruth: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface ComponentSpecifications {
  manufacturer?: string;
  modelNumber?: string;
  voltage?: number;
  amperage?: number;
  powerRating?: number;
  frequency?: number;
  phases?: number;
  mountingType?: string;
  environmentalRating?: string;
  customAttributes?: Record<string, any>;
}

export enum DatasetCategory {
  SYMBOLS = 'symbols',
  LEGENDS = 'legends',
  COMPONENTS = 'components',
  CIRCUITS = 'circuits',
  FULL_DRAWINGS = 'full_drawings',
  TEXT_LABELS = 'text_labels',
  WIRING_DIAGRAMS = 'wiring_diagrams',
  SCHEMATICS = 'schematics'
}

export enum ElectricalStandard {
  NEC = 'nec',           // National Electrical Code
  IEC = 'iec',           // International Electrotechnical Commission
  ANSI = 'ansi',         // American National Standards Institute
  IEEE = 'ieee',         // Institute of Electrical and Electronics Engineers
  CSA = 'csa',           // Canadian Standards Association
  BS = 'bs',             // British Standards
  DIN = 'din',           // Deutsches Institut für Normung
  CUSTOM = 'custom'      // Project-specific standards
}

export enum ProjectType {
  INDUSTRIAL = 'industrial',
  COMMERCIAL = 'commercial',
  RESIDENTIAL = 'residential',
  UTILITY = 'utility',
  MARINE = 'marine',
  AEROSPACE = 'aerospace',
  AUTOMOTIVE = 'automotive',
  RENEWABLE_ENERGY = 'renewable_energy'
}

export enum SupportedFileType {
  PDF = 'pdf',
  PNG = 'png',
  JPG = 'jpg',
  JPEG = 'jpeg',
  SVG = 'svg',
  DWG = 'dwg',
  DXF = 'dxf',
  TIFF = 'tiff'
}

export enum FileProcessingStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
  ARCHIVED = 'archived'
}

export enum DatasetStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  TRAINING = 'training',
  ARCHIVED = 'archived',
  ERROR = 'error'
}

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  NEEDS_REVISION = 'needs_revision'
}

export interface FileMetadata {
  originalDimensions?: { width: number; height: number };
  dpi?: number;
  colorSpace?: string;
  pageCount?: number;
  extractedText?: string;
  drawingScale?: string;
  drawingTitle?: string;
  drawingNumber?: string;
  revision?: string;
  dateCreated?: Date;
  software?: string;
}

export interface TrainingJob {
  id: string;
  name: string;
  description?: string;
  datasets: string[];
  modelType: ModelType;
  status: TrainingJobStatus;
  progress: number;
  metrics?: TrainingMetrics;
  config: TrainingConfig;
  startTime: Date;
  endTime?: Date;
  estimatedCompletion?: Date;
  createdBy: string;
  logs?: TrainingLog[];
}

export enum ModelType {
  COMPONENT_DETECTION = 'component_detection',
  SYMBOL_RECOGNITION = 'symbol_recognition',
  TEXT_EXTRACTION = 'text_extraction',
  CIRCUIT_TRACING = 'circuit_tracing',
  LAYOUT_ANALYSIS = 'layout_analysis'
}

export enum TrainingJobStatus {
  QUEUED = 'queued',
  PREPARING = 'preparing',
  TRAINING = 'training',
  VALIDATING = 'validating',
  COMPLETE = 'complete',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface TrainingMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  validationLoss: number;
  trainingLoss: number;
  epochs: number;
  learningRate: number;
  confusionMatrix?: number[][];
  classMetrics?: Record<string, ClassMetrics>;
}

export interface ClassMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  support: number;
}

export interface TrainingConfig {
  modelArchitecture: string;
  learningRate: number;
  batchSize: number;
  epochs: number;
  validationSplit: number;
  augmentation: AugmentationConfig;
  optimizer: string;
  lossFunction: string;
}

export interface AugmentationConfig {
  rotation: boolean;
  scaling: boolean;
  flipping: boolean;
  brightness: boolean;
  contrast: boolean;
  noise: boolean;
}

export interface TrainingLog {
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  message: string;
  epoch?: number;
  metrics?: Partial<TrainingMetrics>;
}

export interface DataQualityReport {
  datasetId: string;
  overallScore: number;
  issues: QualityIssue[];
  recommendations: string[];
  annotationStats: AnnotationStats;
  generatedAt: Date;
}

export interface QualityIssue {
  type: QualityIssueType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedFiles: string[];
  affectedAnnotations: string[];
  suggestedAction: string;
}

export enum QualityIssueType {
  DUPLICATE_FILES = 'duplicate_files',
  INCONSISTENT_ANNOTATIONS = 'inconsistent_annotations',
  MISSING_ANNOTATIONS = 'missing_annotations',
  LOW_QUALITY_IMAGES = 'low_quality_images',
  INCORRECT_LABELS = 'incorrect_labels',
  IMBALANCED_CLASSES = 'imbalanced_classes',
  ANNOTATION_OVERLAP = 'annotation_overlap'
}

export interface AnnotationStats {
  totalAnnotations: number;
  approvedAnnotations: number;
  pendingAnnotations: number;
  rejectedAnnotations: number;
  averageConfidence: number;
  annotationsByType: Record<string, number>;
  annotatorStats: Record<string, AnnotatorStats>;
}

export interface AnnotatorStats {
  totalAnnotations: number;
  averageQualityScore: number;
  approvalRate: number;
  averageTimePerAnnotation: number;
}

export interface BatchUploadResult {
  successful: string[];
  failed: Array<{
    fileName: string;
    error: string;
  }>;
  duplicates: string[];
  totalProcessed: number;
}

export interface AnnotationTool {
  id: string;
  name: string;
  type: 'bounding_box' | 'polygon' | 'point' | 'line';
  hotkey?: string;
  color: string;
  componentTypes: ElectricalComponentType[];
}

// Re-export from computerVision types for consistency
export { ElectricalComponentType } from './computerVision';