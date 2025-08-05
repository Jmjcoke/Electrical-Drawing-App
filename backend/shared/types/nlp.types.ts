/**
 * NLP-specific TypeScript interfaces for electrical drawing analysis
 * Defines data structures for query processing, intent classification, and context extraction
 */

// Query Processing Interfaces
export interface ProcessedQuery {
  readonly id: string;
  readonly originalText: string;
  readonly cleanedText: string;
  readonly intent: QueryIntent;
  readonly intentConfidence: number;
  readonly entities: ExtractedEntity[];
  readonly context: QueryContext;
  readonly optimizedPrompts: Record<string, string>; // Provider-specific optimized versions
  readonly processingMetadata: QueryProcessingMetadata;
  readonly timestamp: Date;
}

export interface QueryIntent {
  readonly type: 'component_identification' | 'general_question' | 'schematic_analysis';
  readonly confidence: number;
  readonly subcategory?: string;
  readonly reasoning: string;
}

export interface ExtractedEntity {
  readonly text: string;
  readonly type: 'component' | 'location' | 'property' | 'measurement';
  readonly confidence: number;
  readonly position: { start: number; end: number };
  readonly metadata: Record<string, any>;
}

export interface QueryContext {
  readonly sessionHistory: string[];
  readonly documentContext: DocumentReference[];
  readonly previousQueries: Query[];
  readonly conversationFlow: ConversationNode[];
  readonly extractedTopics: string[];
}

export interface DocumentReference {
  readonly documentId: string;
  readonly fileName: string;
  readonly relevanceScore: number;
  readonly extractedContent?: string;
}

export interface ConversationNode {
  readonly id: string;
  readonly queryText: string;
  readonly timestamp: Date;
  readonly intent: QueryIntent;
  readonly children: string[]; // IDs of follow-up queries
}

export interface Query {
  readonly id: string;
  readonly text: string;
  readonly timestamp: Date;
  readonly sessionId: string;
  readonly intent?: QueryIntent;
}

export interface QueryProcessingMetadata {
  readonly classificationTime: number; // milliseconds
  readonly extractionTime: number; // milliseconds
  readonly optimizationTime: number; // milliseconds
  readonly totalProcessingTime: number; // milliseconds
  readonly cacheHit: boolean;
  readonly confidenceBreakdown: {
    readonly intentConfidence: number;
    readonly entityConfidence: number;
    readonly contextRelevance: number;
  };
}

// Suggestion System Interfaces
export interface SuggestionRequest {
  readonly partialQuery: string;
  readonly sessionId: string;
  readonly documentIds: string[];
  readonly currentContext: QueryContext;
}

export interface AutocompleteSuggestion {
  readonly text: string;
  readonly category: string;
  readonly relevanceScore: number;
  readonly reasoning: string;
  readonly examples?: string[];
}

// Query Classification Interfaces
export interface ClassificationResult {
  readonly intent: QueryIntent;
  readonly alternativeIntents: QueryIntent[];
  readonly processingTime: number;
  readonly modelUsed: string;
}

export interface ClassificationTrainingData {
  readonly query: string;
  readonly expectedIntent: QueryIntent['type'];
  readonly context?: Partial<QueryContext>;
  readonly confidence: number;
}

// Context Extraction Interfaces
export interface ContextExtractionResult {
  readonly entities: ExtractedEntity[];
  readonly topics: string[];
  readonly relevantDocuments: DocumentReference[];
  readonly contextScore: number;
  readonly extractionConfidence: number;
}

// Query Optimization Interfaces
export interface QueryOptimizationResult {
  readonly optimizedPrompts: Record<string, string>;
  readonly providerSpecificEnhancements: Record<string, QueryEnhancement>;
  readonly costEstimation: CostEstimation;
  readonly complexityScore: number;
}

export interface QueryEnhancement {
  readonly enhancedQuery: string;
  readonly technicalContext: string[];
  readonly parameterAdjustments: Record<string, any>;
  readonly reasoningChain: string[];
}

export interface CostEstimation {
  readonly estimatedTokens: Record<string, number>;
  readonly estimatedCost: Record<string, number>;
  readonly providerRecommendation: string;
}

// Validation and Sanitization Interfaces
export interface ValidationResult {
  readonly isValid: boolean;
  readonly sanitizedText: string;
  readonly flaggedContent: FlaggedContent[];
  readonly securityScore: number;
}

export interface FlaggedContent {
  readonly type: 'xss' | 'injection' | 'profanity' | 'inappropriate' | 'malicious';
  readonly content: string;
  readonly position: { start: number; end: number };
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly action: 'remove' | 'sanitize' | 'block';
}

// Analytics and Logging Interfaces
export interface QueryAnalytics {
  readonly queryId: string;
  readonly sessionId: string;
  readonly processingStages: ProcessingStage[];
  readonly performanceMetrics: PerformanceMetrics;
  readonly userSatisfaction?: UserSatisfactionData;
  readonly timestamp: Date;
}

export interface ProcessingStage {
  readonly stage: 'classification' | 'extraction' | 'optimization' | 'validation';
  readonly startTime: Date;
  readonly endTime: Date;
  readonly duration: number;
  readonly success: boolean;
  readonly error?: string;
  readonly metadata: Record<string, any>;
}

export interface PerformanceMetrics {
  readonly totalProcessingTime: number;
  readonly classificationAccuracy?: number;
  readonly entityExtractionAccuracy?: number;
  readonly cacheHitRate: number;
  readonly memoryUsage: number;
}

export interface UserSatisfactionData {
  readonly rating: number; // 1-5 scale
  readonly feedback?: string;
  readonly wasHelpful: boolean;
  readonly followUpQueries: number;
  readonly timestamp: Date;
}

// WebSocket Event Interfaces for NLP Processing
export interface NLPWebSocketEvents {
  // Client to Server Events
  'query-preprocessing-start': {
    readonly queryId: string;
    readonly queryText: string;
  };
  'get-suggestions': {
    readonly partialQuery: string;
    readonly sessionId: string;
  };
  
  // Server to Client Events
  'query-preprocessing-progress': {
    readonly queryId: string;
    readonly stage: string;
    readonly progress: number;
  };
  'query-classified': {
    readonly queryId: string;
    readonly intent: QueryIntent;
  };
  'query-optimized': {
    readonly queryId: string;
    readonly optimizedPrompts: Record<string, string>;
  };
  'suggestions-ready': {
    readonly suggestions: AutocompleteSuggestion[];
  };
  'nlp-processing-complete': {
    readonly queryId: string;
    readonly processedQuery: ProcessedQuery;
  };
  'nlp-processing-error': {
    readonly queryId: string;
    readonly error: string;
    readonly stage: string;
  };
}

// API Request/Response Interfaces
export interface ProcessQueryRequest {
  readonly queryText: string;
  readonly sessionId: string;
  readonly documentIds?: string[];
  readonly context?: Partial<QueryContext>;
}

export interface ProcessQueryResponse {
  readonly success: boolean;
  readonly processedQuery?: ProcessedQuery;
  readonly error?: string;
  readonly processingTime: number;
}

export interface GetSuggestionsRequest {
  readonly partialQuery: string;
  readonly sessionId: string;
  readonly documentIds?: string[];
  readonly maxSuggestions?: number;
  readonly currentContext?: QueryContext;
}

export interface GetSuggestionsResponse {
  readonly success: boolean;
  readonly suggestions: AutocompleteSuggestion[];
  readonly processingTime: number;
}

export interface OptimizeQueryRequest {
  readonly queryId: string;
  readonly targetProvider: string;
  readonly additionalContext?: Record<string, any>;
}

export interface OptimizeQueryResponse {
  readonly success: boolean;
  readonly optimizedPrompt: string;
  readonly enhancement: QueryEnhancement;
  readonly processingTime: number;
}

// Error Types
export enum NLPErrorCodes {
  CLASSIFICATION_FAILED = 'CLASSIFICATION_FAILED',
  EXTRACTION_FAILED = 'EXTRACTION_FAILED',
  OPTIMIZATION_FAILED = 'OPTIMIZATION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INSUFFICIENT_CONTEXT = 'INSUFFICIENT_CONTEXT',
  RATE_LIMITED = 'RATE_LIMITED',
  INVALID_INPUT = 'INVALID_INPUT',
  PROCESSING_TIMEOUT = 'PROCESSING_TIMEOUT',
  MODEL_UNAVAILABLE = 'MODEL_UNAVAILABLE',
  CACHE_ERROR = 'CACHE_ERROR'
}

export interface NLPError extends Error {
  readonly code: NLPErrorCodes;
  readonly stage: string;
  readonly queryId?: string;
  readonly sessionId?: string;
  readonly details?: Record<string, any>;
}

// Configuration Interfaces
export interface NLPConfig {
  readonly classification: {
    readonly confidenceThreshold: number;
    readonly fallbackIntent: QueryIntent['type'];
    readonly modelPath?: string;
    readonly trainingDataPath?: string;
  };
  readonly extraction: {
    readonly entityTypes: ExtractedEntity['type'][];
    readonly confidenceThreshold: number;
    readonly maxEntities: number;
  };
  readonly optimization: {
    readonly enableCaching: boolean;
    readonly cacheTimeout: number; // seconds
    readonly maxOptimizationTime: number; // milliseconds
  };
  readonly validation: {
    readonly enableSanitization: boolean;
    readonly maxQueryLength: number;
    readonly blockedPatterns: string[];
  };
  readonly performance: {
    readonly maxProcessingTime: number; // milliseconds
    readonly enableMetrics: boolean;
    readonly enableAnalytics: boolean;
  };
}