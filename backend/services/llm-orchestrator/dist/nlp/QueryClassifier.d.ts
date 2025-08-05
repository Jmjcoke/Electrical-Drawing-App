/**
 * QueryClassifier - Intent classification service for electrical drawing queries
 * Categorizes queries into component_identification, general_question, or schematic_analysis
 */
import type { QueryIntent, ClassificationResult, ClassificationTrainingData } from '@/types/nlp.types';
interface ClassificationConfig {
    readonly confidenceThreshold: number;
    readonly fallbackIntent: QueryIntent['type'];
    readonly modelPath?: string;
    readonly trainingDataPath?: string;
}
interface ClassificationStats {
    totalClassifications: number;
    successfulClassifications: number;
    averageConfidence: number;
    intentDistribution: Record<string, number>;
    averageProcessingTime: number;
}
export declare class QueryClassifier {
    private readonly config;
    private stats;
    private trainingData;
    private readonly componentKeywords;
    private readonly schematicKeywords;
    private readonly generalKeywords;
    constructor(config: ClassificationConfig);
    /**
     * Classify query intent with confidence scoring
     * @param queryText - The sanitized query text to classify
     * @returns Classification result with intent and alternatives
     */
    classifyIntent(queryText: string): Promise<ClassificationResult>;
    /**
     * Calculate intent scores based on keyword matching and patterns
     */
    private calculateIntentScores;
    /**
     * Count keyword matches in query words
     */
    private countKeywordMatches;
    /**
     * Determine subcategory based on intent type and query content
     */
    private determineSubcategory;
    /**
     * Generate reasoning explanation for classification decision
     */
    private generateReasoning;
    /**
     * Normalize text for consistent processing
     */
    private normalizeText;
    /**
     * Update classification statistics
     */
    private updateStats;
    /**
     * Initialize training data for future ML model improvements
     */
    private initializeTrainingData;
    /**
     * Get classification statistics
     */
    getStats(): ClassificationStats;
    /**
     * Health check for classifier component
     */
    healthCheck(): Promise<boolean>;
    /**
     * Add training data for future model improvements
     */
    addTrainingData(data: ClassificationTrainingData): void;
    /**
     * Get training data for analysis
     */
    getTrainingData(): ClassificationTrainingData[];
}
export {};
//# sourceMappingURL=QueryClassifier.d.ts.map