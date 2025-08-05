/**
 * Context-Aware Query Enhancement System
 * Integrates context management with NLP processing to enhance queries with relevant contextual information
 */
import { ConversationContext, ContextRetrievalRequest } from '../../../../shared/types/context';
import { ContextEnricher } from './ContextEnricher';
import { FollowUpDetectorService } from './FollowUpDetector';
export interface QueryEnhancementConfig {
    readonly maxContextLength: number;
    readonly entityResolutionThreshold: number;
    readonly ambiguityDetectionThreshold: number;
    readonly contextRelevanceThreshold: number;
    readonly maxContextSources: number;
    readonly enableDebugMode: boolean;
}
export interface EnhancementResult {
    readonly originalQuery: string;
    readonly enhancedQuery: string;
    readonly contextSources: ContextSource[];
    readonly resolvedEntities: ResolvedEntity[];
    readonly detectedAmbiguities: Ambiguity[];
    readonly confidence: number;
    readonly processingTime: number;
    readonly debugInfo?: EnhancementDebugInfo;
}
export interface ContextSource {
    readonly type: 'previous_query' | 'entity_reference' | 'topic_continuation' | 'document_context';
    readonly content: string;
    readonly relevance: number;
    readonly turnId?: string;
    readonly entityId?: string;
    readonly documentId?: string;
}
export interface ResolvedEntity {
    readonly originalText: string;
    readonly resolvedText: string;
    readonly entityType: string;
    readonly confidence: number;
    readonly contextSource: string;
    readonly alternatives: string[];
}
export interface Ambiguity {
    readonly text: string;
    readonly type: 'pronoun' | 'implicit_reference' | 'ambiguous_entity' | 'contextual_dependency';
    readonly possibleResolutions: string[];
    readonly confidence: number;
    readonly requiresContext: boolean;
}
export interface EnhancementDebugInfo {
    processingSteps: ProcessingStep[];
    contextRetrievalDetails: ContextRetrievalDebug;
    entityResolutionAttempts: EntityResolutionAttempt[];
    ambiguityAnalysis: AmbiguityAnalysis;
    validationResults: ValidationResult[];
}
export interface ProcessingStep {
    readonly step: string;
    readonly timestamp: number;
    readonly duration: number;
    readonly input: string;
    readonly output: string;
    readonly metadata: Record<string, unknown>;
}
export interface ContextRetrievalDebug {
    readonly requestDetails: ContextRetrievalRequest;
    readonly candidateContexts: number;
    readonly filteredContexts: number;
    readonly selectedContexts: ContextSource[];
    readonly rejectionReasons: string[];
}
export interface EntityResolutionAttempt {
    readonly entity: string;
    readonly candidates: string[];
    readonly selectedResolution: string;
    readonly confidence: number;
    readonly resolutionMethod: string;
}
export interface AmbiguityAnalysis {
    readonly totalAmbiguities: number;
    readonly resolvedAmbiguities: number;
    readonly unresolvedAmbiguities: Ambiguity[];
    readonly resolutionStrategies: string[];
}
export interface ValidationResult {
    readonly rule: string;
    readonly passed: boolean;
    readonly message: string;
    readonly severity: 'info' | 'warning' | 'error';
}
export interface PromptTemplate {
    readonly name: string;
    readonly template: string;
    readonly variables: string[];
    readonly contextPlaceholders: string[];
}
export declare class ContextAwareQueryEnhancer {
    private readonly config;
    private readonly contextEnricher;
    private readonly followUpDetector;
    private readonly promptTemplates;
    constructor(config?: Partial<QueryEnhancementConfig>, contextEnricher?: ContextEnricher, followUpDetector?: FollowUpDetectorService);
    /**
     * Enhance query with contextual information from conversation history
     */
    enhanceQuery(query: string, conversationContext: ConversationContext, sessionId: string): Promise<EnhancementResult>;
    /**
     * Generate context-enhanced prompts for LLM providers
     */
    generateContextEnhancedPrompt(_query: string, enhancementResult: EnhancementResult, templateName?: string): string;
    /**
     * Create debugging report for enhancement issues
     */
    generateDebugReport(enhancementResult: EnhancementResult): string;
    private detectAmbiguities;
    private retrieveRelevantContext;
    private resolveEntities;
    private buildEnhancedQuery;
    private validateEnhancement;
    private calculateEnhancementConfidence;
    private findPronounResolutions;
    private isAmbiguousReference;
    private findImplicitResolutions;
    private extractEntitiesFromQuery;
    private findEntityCandidates;
    private calculateEntityResolutionConfidence;
    private calculateSimilarity;
    private initializePromptTemplates;
    private initializeDebugInfo;
    private addProcessingStep;
}
//# sourceMappingURL=ContextAwareQueryEnhancer.d.ts.map