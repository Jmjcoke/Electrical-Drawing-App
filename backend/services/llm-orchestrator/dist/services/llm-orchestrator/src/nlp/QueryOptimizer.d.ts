/**
 * QueryOptimizer - Query optimization service for LLM providers
 * Optimizes queries for specific providers and estimates costs
 */
import type { QueryIntent, QueryOptimizationResult, ContextExtractionResult } from '../../../../shared/types/nlp.types';
interface OptimizationConfig {
    readonly enableCaching: boolean;
    readonly cacheTimeout: number;
    readonly maxOptimizationTime: number;
}
interface OptimizationStats {
    totalOptimizations: number;
    cacheHits: number;
    averageOptimizationTime: number;
    providerUsage: Record<string, number>;
    averageComplexityScore: number;
}
export declare class QueryOptimizer {
    private readonly config;
    private stats;
    private optimizationCache;
    private readonly providerConfigs;
    private readonly intentTemplates;
    constructor(config: OptimizationConfig);
    /**
     * Optimize query for all supported LLM providers
     * @param queryText - The sanitized query text
     * @param intent - Classified query intent
     * @param context - Extracted context information
     * @returns Optimization results for all providers
     */
    optimizeForProviders(queryText: string, intent: QueryIntent, context: ContextExtractionResult): Promise<QueryOptimizationResult>;
    /**
     * Optimize query for a specific provider
     */
    private optimizeForProvider;
    /**
     * Build base prompt from template and configuration
     */
    private buildBasePrompt;
    /**
     * Build technical context from extracted entities and topics
     */
    private buildTechnicalContext;
    /**
     * Get provider-specific parameter adjustments
     */
    private getProviderParameters;
    /**
     * Build reasoning chain for complex queries
     */
    private buildReasoningChain;
    /**
     * Calculate query complexity score
     */
    private calculateComplexityScore;
    /**
     * Calculate cost estimation for optimized queries
     */
    private calculateCostEstimation;
    /**
     * Generate cache key for optimization results
     */
    private generateCacheKey;
    /**
     * Get cached optimization result
     */
    private getCachedOptimization;
    /**
     * Cache optimization result
     */
    private cacheOptimization;
    /**
     * Clean expired cache entries
     */
    private cleanCache;
    /**
     * Create fallback optimization on error
     */
    private createFallbackOptimization;
    /**
     * Update optimization statistics
     */
    private updateStats;
    /**
     * Get optimization statistics
     */
    getStats(): OptimizationStats;
    /**
     * Health check for optimizer
     */
    healthCheck(): Promise<boolean>;
}
export {};
//# sourceMappingURL=QueryOptimizer.d.ts.map