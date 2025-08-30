/**
 * Cross Page Reference Types
 * 
 * TypeScript definitions for cross-page reference operations in electrical drawings
 */

export interface CrossPageReference {
  id: string;
  sessionId: string;
  sourcePageId: string;
  targetPageId: string;
  sourceElementId: string;
  targetElementId: string;
  referenceType: CrossPageReferenceType;
  sourceCoordinates: Coordinates;
  targetCoordinates: Coordinates;
  description: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export enum CrossPageReferenceType {
  CONTINUATION = 'continuation',
  CONNECTOR = 'connector',
  SIGNAL_REFERENCE = 'signal_reference',
  COMPONENT_REFERENCE = 'component_reference',
  WIRE_CONTINUATION = 'wire_continuation',
  TERMINAL_REFERENCE = 'terminal_reference',
  NOTE_REFERENCE = 'note_reference'
}

export interface Coordinates {
  x: number;
  y: number;
  page?: number;
}

export interface CrossPageReferenceSearchRequest {
  sessionId: string;
  pageId?: string;
  elementId?: string;
  referenceType?: CrossPageReferenceType;
  searchRadius?: number;
  coordinates?: Coordinates;
}

export interface CrossPageReferenceSearchResponse {
  references: CrossPageReference[];
  total: number;
}

export interface CrossPageReferenceCreateRequest {
  sessionId: string;
  sourcePageId: string;
  targetPageId: string;
  sourceElementId: string;
  targetElementId: string;
  referenceType: CrossPageReferenceType;
  sourceCoordinates: Coordinates;
  targetCoordinates: Coordinates;
  description: string;
  metadata?: Record<string, any>;
}

export interface CrossPageReferenceUpdateRequest {
  targetPageId?: string;
  targetElementId?: string;
  targetCoordinates?: Coordinates;
  description?: string;
  metadata?: Record<string, any>;
}

export interface CrossPageValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface CrossPageAnalysisResult {
  totalReferences: number;
  referencesByType: Record<CrossPageReferenceType, number>;
  orphanedReferences: CrossPageReference[];
  missingTargets: CrossPageReference[];
  duplicateReferences: CrossPageReference[];
  validationResults: CrossPageValidationResult[];
}