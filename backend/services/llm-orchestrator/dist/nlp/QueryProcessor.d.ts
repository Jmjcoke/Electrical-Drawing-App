/**
 * QueryProcessor - Main query processing pipeline for NLP operations
 * Orchestrates classification, extraction, optimization, and validation
 */
import type { ProcessQueryRequest, ProcessQueryResponse, NLPConfig } from '@/types/nlp.types';
export declare class QueryProcessor {
    private readonly classifier;
    private readonly contextExtractor;
    private readonly optimizer;
    private readonly validator;
    private readonly suggestionEngine;
    private readonly config;
    constructor(config: NLPConfig);
    /**
     * Process a complete query through the NLP pipeline
     * @param request - Query processing request
     * @returns Processed query with all NLP enhancements
     */
    processQuery(request: ProcessQueryRequest): Promise<ProcessQueryResponse>;
    /**
     * Execute a processing stage with timing and error handling
     */
    private executeStage;
    /**
     * Build processing metadata from stages
     */
    private buildProcessingMetadata;
    /**
     * Create standardized NLP error
     */
    private createNLPError;
    /**
     * Log analytics data for query processing
     */
    private logAnalytics;
    /**
     * Get processing statistics for monitoring
     */
    getProcessingStats(): Record<string, any>;
    /**
     * Health check for all NLP components
     */
    healthCheck(): Promise<{
        healthy: boolean;
        components: Record<string, boolean>;
    }>;
}
//# sourceMappingURL=QueryProcessor.d.ts.map