/**
 * Analysis controller for LLM-based electrical drawing analysis
 */
import { Request, Response, NextFunction } from 'express';
export interface AnalysisRequest {
    sessionId: string;
    documentId: string;
    prompt?: string;
    templateName?: string;
    templateVariables?: Record<string, string | number | boolean>;
    options?: {
        maxTokens?: number;
        temperature?: number;
        model?: string;
    };
}
export interface AnalysisResponse {
    analysisId: string;
    result: string;
    confidence: number;
    processingTime: number;
    provider: string;
    templateUsed?: string | undefined;
    timestamp: Date;
    metadata: {
        model: string;
        tokenUsage?: {
            readonly prompt: number;
            readonly completion: number;
            readonly total: number;
        } | undefined;
        readonly imageCount: number;
        readonly promptLength: number;
    };
}
export interface AnalysisStatusResponse {
    analysisId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: string;
    error?: string;
    processingTime?: number;
    timestamp: Date;
}
export declare enum AnalysisErrorCodes {
    RATE_LIMITED = "RATE_LIMITED",
    IMAGES_NOT_FOUND = "IMAGES_NOT_FOUND",
    MISSING_ANALYSIS_ID = "MISSING_ANALYSIS_ID",
    ANALYSIS_NOT_FOUND = "ANALYSIS_NOT_FOUND",
    INVALID_REQUEST = "INVALID_REQUEST",
    PROVIDER_ERROR = "PROVIDER_ERROR",
    TIMEOUT = "TIMEOUT",
    CONFIGURATION_ERROR = "CONFIGURATION_ERROR"
}
export declare class AnalysisController {
    private openaiProvider;
    private promptService;
    private circuitBreaker;
    private sessionRateLimit;
    private providerRateLimit;
    private analysisResults;
    private queryProcessor;
    private suggestionEngine;
    constructor();
    /**
     * Analyze images using LLM
     */
    analyzeImages: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Get analysis status by ID
     */
    getAnalysisStatus: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * List available prompt templates
     */
    listTemplates: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Process natural language query for electrical drawing analysis
     */
    processQuery: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Get autocomplete suggestions for query input
     */
    getSuggestions: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Get NLP processing statistics
     */
    getNLPStats: (_req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Health check endpoint
     */
    healthCheck: (_req: Request, res: Response, next: NextFunction) => Promise<void>;
    private validateAnalysisRequest;
    private getDocumentImages;
    private generatePrompt;
    private validateProcessQueryRequest;
    private validateSuggestionsRequest;
}
//# sourceMappingURL=analysis.controller.d.ts.map