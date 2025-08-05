/**
 * SuggestionEngine - Autocomplete suggestions service
 * Provides context-aware query recommendations for electrical engineering queries
 */
import type { GetSuggestionsRequest, GetSuggestionsResponse } from '../../../../shared/types/nlp.types';
interface SuggestionStats {
    totalRequests: number;
    suggestionsGenerated: number;
    averageSuggestionsPerRequest: number;
    averageProcessingTime: number;
    popularSuggestions: Record<string, number>;
}
export declare class SuggestionEngine {
    private stats;
    private readonly questionTemplates;
    private readonly components;
    private readonly properties;
    private readonly concepts;
    private readonly problems;
    private readonly contextPatterns;
    constructor();
    /**
     * Generate autocomplete suggestions based on partial query and context
     * @param request - Suggestion request with partial query and context
     * @returns Array of ranked autocomplete suggestions
     */
    generateSuggestions(request: GetSuggestionsRequest): Promise<GetSuggestionsResponse>;
    /**
     * Generate suggestions from question templates
     */
    private generateTemplateSuggestions;
    /**
     * Generate context-aware suggestions based on document content
     */
    private generateContextSuggestions;
    /**
     * Generate query completion suggestions
     */
    private generateCompletionSuggestions;
    /**
     * Generate popular/trending suggestions
     */
    private generatePopularSuggestions;
    /**
     * Fill template variables with context-appropriate values
     */
    private fillTemplate;
    /**
     * Select component based on context
     */
    private selectContextualComponent;
    /**
     * Select a pair of related components for comparison
     */
    private selectComponentPair;
    /**
     * Generate a random node name
     */
    private generateNodeName;
    /**
     * Select random item from array
     */
    private selectRandomFrom;
    /**
     * Identify circuit types from context
     */
    private identifyCircuitTypes;
    /**
     * Calculate template relevance score
     */
    private calculateTemplateRelevance;
    /**
     * Calculate context-based relevance
     */
    private calculateContextRelevance;
    /**
     * Calculate string similarity/relevance
     */
    private calculateStringRelevance;
    /**
     * Suggest common electrical objects for completion
     */
    private suggestCommonObjects;
    /**
     * Remove duplicate suggestions
     */
    private removeDuplicates;
    /**
     * Rank suggestions by relevance and other factors
     */
    private rankSuggestions;
    /**
     * Get category-specific boost for ranking
     */
    private getCategoryBoost;
    /**
     * Get template examples for display
     */
    private getTemplateExamples;
    /**
     * Update suggestion statistics
     */
    private updateStats;
    /**
     * Get suggestion statistics
     */
    getStats(): SuggestionStats;
    /**
     * Health check for suggestion engine
     */
    healthCheck(): Promise<boolean>;
}
export {};
//# sourceMappingURL=SuggestionEngine.d.ts.map