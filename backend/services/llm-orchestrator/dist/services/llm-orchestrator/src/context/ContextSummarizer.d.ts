/**
 * Context Summarization and Memory Management System
 * Provides intelligent summarization and memory-efficient storage for conversation contexts
 */
import { ConversationContext, ContextSummary } from '../../../../shared/types/context';
export interface SummarizationConfig {
    readonly maxContextLength: number;
    readonly compressionRatio: number;
    readonly relevanceThreshold: number;
    readonly preserveRecentTurns: number;
    readonly entityImportanceWeight: number;
    readonly topicContinuityWeight: number;
}
export interface CompressionResult {
    readonly originalSize: number;
    readonly compressedSize: number;
    readonly compressionRatio: number;
    readonly preservedTurns: number;
    readonly summaryGenerated: boolean;
}
export interface ExpirationPolicy {
    readonly name: string;
    readonly maxAge: number;
    readonly maxInactivity: number;
    readonly priority: 'low' | 'medium' | 'high';
    readonly conditions: string[];
}
export interface CleanupResult {
    readonly contextsRemoved: number;
    readonly turnsRemoved: number;
    readonly spaceSaved: number;
    readonly policies: string[];
}
export interface MemoryUsage {
    readonly totalContexts: number;
    readonly totalTurns: number;
    readonly memoryUsed: number;
    readonly compressionSavings: number;
    readonly oldestContext: Date;
    readonly newestContext: Date;
}
export interface RelevanceScore {
    readonly turnId: string;
    readonly overallScore: number;
    readonly entityRelevance: number;
    readonly topicRelevance: number;
    readonly recencyScore: number;
    readonly interactionScore: number;
}
export declare class ContextSummarizer {
    private readonly config;
    private readonly expirationPolicies;
    constructor(config?: Partial<SummarizationConfig>, policies?: ExpirationPolicy[]);
    /**
     * Generate intelligent summary of conversation context
     */
    generateContextSummary(context: ConversationContext): Promise<ContextSummary>;
    /**
     * Compress context by removing less relevant turns and generating summaries
     */
    compressContext(context: ConversationContext): Promise<{
        compressedContext: ConversationContext;
        compressionResult: CompressionResult;
    }>;
    /**
     * Apply expiration policies and clean up old contexts
     */
    applyCleanupPolicies(contexts: ConversationContext[]): CleanupResult;
    /**
     * Calculate memory usage statistics
     */
    calculateMemoryUsage(contexts: ConversationContext[]): MemoryUsage;
    /**
     * Optimize context storage for better performance
     */
    optimizeContextStorage(contexts: ConversationContext[]): Promise<{
        optimizedContexts: ConversationContext[];
        optimizationResults: {
            compressed: number;
            summarized: number;
            cleaned: number;
            spaceSaved: number;
        };
    }>;
    private calculateTurnRelevance;
    private calculateEntityRelevance;
    private calculateTopicRelevance;
    private calculateRecencyScore;
    private calculateInteractionScore;
    private selectImportantTurns;
    private selectMostRelevantTurns;
    private generateSummaryText;
    private extractKeyPoints;
    private extractRelevantEntities;
    private calculateSummaryConfidence;
    private extractKeyTopicsFromTurns;
    private extractMajorFindings;
    private updateCumulativeContext;
    private calculateContextSize;
    private estimateOriginalSize;
    private isContextExpiredByPolicy;
    private evaluateCondition;
    private getDefaultPolicies;
}
//# sourceMappingURL=ContextSummarizer.d.ts.map