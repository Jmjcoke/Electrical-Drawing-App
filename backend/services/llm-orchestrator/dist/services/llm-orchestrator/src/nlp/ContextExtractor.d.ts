/**
 * ContextExtractor - Context and entity extraction service
 * Identifies relevant drawing elements, extracts entities, and builds conversation context
 */
import type { ExtractedEntity, QueryContext, ConversationNode, ContextExtractionResult } from '../../../../shared/types/nlp.types';
interface ExtractionConfig {
    readonly entityTypes: ExtractedEntity['type'][];
    readonly confidenceThreshold: number;
    readonly maxEntities: number;
}
interface ExtractionStats {
    totalExtractions: number;
    entitiesExtracted: number;
    averageEntitiesPerQuery: number;
    averageConfidence: number;
    averageProcessingTime: number;
    entityTypeDistribution: Record<string, number>;
}
export declare class ContextExtractor {
    private readonly config;
    private stats;
    private readonly componentPatterns;
    private readonly electricalTopics;
    constructor(config: ExtractionConfig);
    /**
     * Extract context information from query and session data
     * @param queryText - The sanitized query text
     * @param existingContext - Partial context from previous interactions
     * @param documentIds - Optional document IDs for context
     * @returns Complete context extraction result
     */
    extractContext(queryText: string, existingContext?: Partial<QueryContext>, documentIds?: string[]): Promise<ContextExtractionResult>;
    /**
     * Extract entities from query text using pattern matching
     */
    private extractEntities;
    /**
     * Calculate confidence score for extracted entity
     */
    private calculateEntityConfidence;
    /**
     * Extract electrical engineering topics from query text
     */
    private extractTopics;
    /**
     * Build document references with relevance scoring
     */
    private buildDocumentReferences;
    /**
     * Calculate relevance score for document
     */
    private calculateDocumentRelevance;
    /**
     * Calculate overall context score
     */
    private calculateContextScore;
    /**
     * Calculate extraction confidence
     */
    private calculateExtractionConfidence;
    /**
     * Update extraction statistics
     */
    private updateStats;
    /**
     * Analyze conversation flow and build context nodes
     */
    buildConversationFlow(_currentQuery: string, previousQueries: Array<{
        id: string;
        text: string;
        timestamp: Date;
        intent?: any;
    }>, maxDepth?: number): ConversationNode[];
    /**
     * Get extraction statistics
     */
    getStats(): ExtractionStats;
    /**
     * Health check for context extractor
     */
    healthCheck(): Promise<boolean>;
}
export {};
//# sourceMappingURL=ContextExtractor.d.ts.map