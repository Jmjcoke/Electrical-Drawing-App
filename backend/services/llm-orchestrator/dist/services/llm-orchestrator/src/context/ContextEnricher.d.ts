/**
 * Context Enrichment and Retrieval System
 * Builds cumulative knowledge and provides relevant context for query enhancement
 */
import { ConversationContext, ConversationTurn, CumulativeContext, ContextRetrievalRequest, ContextType } from '../../../../shared/types/context';
export interface ContextRelevanceScore {
    readonly contextId: string;
    readonly turnId: string;
    readonly relevanceScore: number;
    readonly recencyScore: number;
    readonly combinedScore: number;
    readonly matchingConcepts: string[];
}
export interface EnrichedQuery {
    readonly originalQuery: string;
    readonly enhancedQuery: string;
    readonly contextSources: ContextSource[];
    readonly relevantEntities: string[];
    readonly topicContext: string[];
    readonly confidence: number;
}
export interface ContextSource {
    readonly turnId: string;
    readonly contribution: string;
    readonly relevanceScore: number;
    readonly contextType: ContextType;
}
export interface SemanticMatch {
    readonly query: string;
    readonly contextText: string;
    readonly similarity: number;
    readonly conceptOverlap: string[];
}
export declare class ContextEnricher {
    private readonly recencyDecayFactor;
    /**
     * Build cumulative knowledge from conversation turns
     */
    buildCumulativeContext(turns: ConversationTurn[]): CumulativeContext;
    /**
     * Retrieve relevant context for query enhancement
     */
    retrieveRelevantContext(request: ContextRetrievalRequest, context: ConversationContext): Promise<ContextRelevanceScore[]>;
    /**
     * Enhance query with relevant context
     */
    enhanceQueryWithContext(query: string, relevantContext: ContextRelevanceScore[], conversationContext: ConversationContext): Promise<EnrichedQuery>;
    /**
     * Merge related conversation threads
     */
    mergeRelatedContexts(contexts: ConversationContext[]): ConversationContext;
    /**
     * Validate context accuracy and consistency
     */
    validateContext(context: ConversationContext): {
        isValid: boolean;
        validationErrors: string[];
        inconsistencies: string[];
    };
    private extractAndMergeEntities;
    private extractEntitiesFromText;
    private buildDocumentContext;
    private buildTopicProgression;
    private extractTopics;
    private extractKeyInsights;
    private buildRelationshipMap;
    private filterCandidateTurns;
    private calculateRelevanceScore;
    private calculateSemanticSimilarity;
    private findMatchingConcepts;
    private buildContextSources;
    private determineContextType;
    private extractRelevantEntities;
    private extractTopicContext;
    private buildEnhancedQuery;
    private calculateEnhancementConfidence;
    private mergeConversationTurns;
    private mergeCumulativeContexts;
}
//# sourceMappingURL=ContextEnricher.d.ts.map