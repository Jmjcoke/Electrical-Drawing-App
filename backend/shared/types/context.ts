/**
 * Context Management Type Definitions
 * Shared types for conversation context management across services
 */

export type ContextType = 'entity' | 'document' | 'topic' | 'insight' | 'relationship';

export type ReferenceType = 'pronoun' | 'implicit' | 'temporal' | 'spatial';

export interface ContextMetadata {
  readonly createdAt: Date;
  readonly lastAccessed: Date;
  readonly accessCount: number;
  readonly compressionLevel: number;
  readonly tags: string[];
}

export interface ConversationContext {
  readonly id: string;
  readonly sessionId: string;
  readonly conversationThread: ConversationTurn[];
  readonly cumulativeContext: CumulativeContext;
  readonly lastUpdated: Date;
  readonly expiresAt: Date;
  readonly metadata: ContextMetadata;
}

export interface ConversationTurn {
  readonly id: string;
  readonly turnNumber: number;
  readonly query: ProcessedQuery;
  readonly response: AnalysisResult;
  readonly contextContributions: string[];
  readonly followUpDetected: boolean;
  readonly timestamp: Date;
}

export interface CumulativeContext {
  readonly extractedEntities: Map<string, EntityMention[]>;
  readonly documentContext: DocumentContextSummary[];
  readonly topicProgression: TopicNode[];
  readonly keyInsights: string[];
  readonly relationshipMap: EntityRelationship[];
}

export interface EntityMention {
  readonly text: string;
  readonly type: string;
  readonly confidence: number;
  readonly context: string;
  readonly turnId: string;
  readonly position: number;
  readonly firstMentioned: Date;
  readonly mentions: number;
}

export interface DocumentContextSummary {
  readonly documentId: string;
  readonly filename: string;
  readonly relevantPages: number[];
  readonly keyFindings: string[];
  readonly lastReferenced: Date;
}

export interface TopicNode {
  readonly topic: string;
  readonly relevance: number;
  readonly firstIntroduced: Date;
  readonly relatedTopics: string[];
  readonly queryIds: string[];
}

export interface EntityRelationship {
  readonly source: string;
  readonly target: string;
  readonly relationship: string;
  readonly confidence: number;
  readonly context: string;
}

export interface ProcessedQuery {
  readonly id: string;
  readonly originalText: string;
  readonly cleanedText: string;
  readonly intent: QueryIntent;
  readonly intentConfidence: number;
  readonly entities: ExtractedEntity[];
  readonly context: QueryContext;
  readonly optimizedPrompts: Record<string, string>;
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
  readonly metadata: Record<string, unknown>;
}

export interface QueryContext {
  readonly sessionHistory: string[];
  readonly documentContext: DocumentReference[];
  readonly previousQueries: Query[];
  readonly conversationFlow: ConversationNode[];
  readonly extractedTopics: string[];
}

export interface DocumentReference {
  readonly id: string;
  readonly filename: string;
  readonly pageNumber?: number;
  readonly relevance: number;
}

export interface Query {
  readonly id: string;
  readonly text: string;
  readonly type: 'component_identification' | 'general_question' | 'schematic_analysis';
  readonly timestamp: Date;
  readonly documentIds: string[];
}

export interface ConversationNode {
  readonly id: string;
  readonly type: 'query' | 'response' | 'context';
  readonly content: string;
  readonly timestamp: Date;
  readonly children: string[];
}

export interface QueryProcessingMetadata {
  readonly processingTime: number;
  readonly stagesCompleted: string[];
  readonly warnings: string[];
  readonly debug: Record<string, unknown>;
}

export interface AnalysisResult {
  readonly summary: string;
  readonly components: ComponentIdentification[];
  readonly confidence: ConfidenceScore;
  readonly consensus: ModelConsensus;
}

export interface ComponentIdentification {
  readonly id: string;
  readonly type: string;
  readonly description: string;
  readonly location: {
    readonly x: number;
    readonly y: number;
    readonly page: number;
  };
  readonly boundingBox: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly confidence: number;
  readonly properties: Record<string, unknown>;
}

export interface ConfidenceScore {
  readonly overall: number;
  readonly breakdown: Record<string, number>;
  readonly reasoning: string;
}

export interface ModelConsensus {
  readonly agreementLevel: number;
  readonly conflictingResponses: string[];
  readonly consensusResponse: string;
}

export interface FollowUpQuery {
  readonly originalQuery: string;
  readonly detectedReferences: Reference[];
  readonly contextualEnrichment: string;
  readonly confidence: number;
  readonly detectionReasoning: string;
}

export interface Reference {
  readonly type: ReferenceType;
  readonly text: string;
  readonly resolvedEntity?: string;
  readonly sourceContext: string;
  readonly confidence: number;
}

export interface ContextRetrievalRequest {
  readonly currentQuery: string;
  readonly sessionId: string;
  readonly maxContextTurns: number;
  readonly relevanceThreshold: number;
  readonly contextTypes: ContextType[];
}

export interface ContextSummary {
  readonly summary: string;
  readonly keyPoints: string[];
  readonly relevantEntities: string[];
  readonly compressionRatio: number;
  readonly originalTurnCount: number;
  readonly summaryConfidence: number;
}

export interface ContextStorageConfig {
  readonly maxTurnsPerContext: number;
  readonly compressionThreshold: number;
  readonly expirationHours: number;
  readonly cleanupIntervalMinutes: number;
}

export interface ContextValidationResult {
  readonly isValid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
  readonly correctedContext?: ConversationContext;
}

// Type alias for entity extraction
export type EntityExtraction = ExtractedEntity;

// Context Analytics and Monitoring Types

export interface ContextMetrics {
  readonly timestamp: Date;
  readonly sessionId: string;
  readonly contextId: string;
  readonly metricType: ContextMetricType;
  readonly value: number;
  readonly metadata: Record<string, unknown>;
}

export type ContextMetricType = 
  | 'retrieval_time_ms'
  | 'follow_up_detection_time_ms'
  | 'context_enhancement_time_ms'
  | 'storage_size_bytes'
  | 'turn_count'
  | 'relevance_score'
  | 'compression_ratio'
  | 'cache_hit_rate'
  | 'accuracy_score';

export interface ContextQualityMetrics {
  readonly contextId: string;
  readonly sessionId: string;
  readonly accuracy: ContextAccuracyMetrics;
  readonly performance: ContextPerformanceMetrics;
  readonly storage: ContextStorageMetrics;
  readonly timestamp: Date;
}

export interface ContextAccuracyMetrics {
  readonly followUpDetectionAccuracy: number;
  readonly entityResolutionAccuracy: number;
  readonly contextRelevanceScore: number;
  readonly userSatisfactionScore?: number;
  readonly falsePositiveRate: number;
  readonly falseNegativeRate: number;
}

export interface ContextPerformanceMetrics {
  readonly retrievalTimeMs: number;
  readonly enhancementTimeMs: number;
  readonly summarizationTimeMs: number;
  readonly totalProcessingTimeMs: number;
  readonly cacheHitRate: number;
  readonly memoryUsageMb: number;
}

export interface ContextStorageMetrics {
  readonly totalSizeBytes: number;
  readonly compressedSizeBytes: number;
  readonly compressionRatio: number;
  readonly turnCount: number;
  readonly entityCount: number;
  readonly documentReferenceCount: number;
}

export interface ContextUsageAnalytics {
  readonly sessionId: string;
  readonly totalQueries: number;
  readonly followUpQueries: number;
  readonly contextRetrievals: number;
  readonly enhancementRequests: number;
  readonly avgRelevanceScore: number;
  readonly mostUsedContextTypes: ContextType[];
  readonly sessionDurationMs: number;
  readonly storageGrowthRate: number;
  readonly timestamp: Date;
}

export interface ContextDebugInfo {
  readonly contextId: string;
  readonly sessionId: string;
  readonly operation: string;
  readonly input: Record<string, unknown>;
  readonly output: Record<string, unknown>;
  readonly executionTimeMs: number;
  readonly errors: string[];
  readonly warnings: string[];
  readonly debugData: Record<string, unknown>;
  readonly timestamp: Date;
}

export interface ContextABTestConfig {
  readonly testId: string;
  readonly name: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly trafficPercentage: number;
  readonly variants: ContextABVariant[];
  readonly successMetrics: string[];
  readonly startDate: Date;
  readonly endDate?: Date;
}

export interface ContextABVariant {
  readonly variantId: string;
  readonly name: string;
  readonly trafficPercentage: number;
  readonly config: Record<string, unknown>;
  readonly isControl: boolean;
}

export interface ContextABTestResult {
  readonly testId: string;
  readonly variantId: string;
  readonly sessionId: string;
  readonly metrics: Record<string, number>;
  readonly isSuccessful: boolean;
  readonly timestamp: Date;
}

export interface ContextAlert {
  readonly alertId: string;
  readonly type: ContextAlertType;
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
  readonly title: string;
  readonly description: string;
  readonly contextId?: string;
  readonly sessionId?: string;
  readonly metrics: Record<string, number>;
  readonly threshold: number;
  readonly timestamp: Date;
  readonly resolved: boolean;
}

export type ContextAlertType = 
  | 'performance_degradation'
  | 'storage_limit_exceeded'
  | 'accuracy_drop'
  | 'memory_leak'
  | 'error_rate_spike'
  | 'cache_miss_rate_high';

// WebSocket Events for Context Management
export interface ContextWebSocketEvents {
  // Client to Server
  'context-enhance-query': { queryText: string; sessionId: string };
  'context-reset': { sessionId: string };
  
  // Server to Client
  'context-updated': { contextId: string; turnCount: number };
  'follow-up-detected': { queryId: string; references: Reference[] };
  'context-enhanced': { queryId: string; enhancedQuery: string };
  'context-summary-ready': { summary: ContextSummary };
  'context-cleanup-complete': { contextId: string; turnsRemoved: number };
  'context-metrics-updated': { metrics: ContextMetrics };
  'context-alert-triggered': { alert: ContextAlert };
}