/**
 * Context-Enhanced Chat Controller
 * Integrates context management with chat interface for conversational electrical drawing analysis
 */
import { Request, Response, NextFunction } from 'express';
import { AnalysisController } from './analysis.controller';
import type { ConversationTurn, AnalysisResult } from '../../../../shared/types/context';
export interface ContextChatRequest {
    sessionId: string;
    queryText: string;
    documentIds?: string[];
    resetContext?: boolean;
    includeContextVisualization?: boolean;
    maxContextHistory?: number;
}
export interface ContextChatResponse {
    success: boolean;
    response: {
        analysisResult: AnalysisResult;
        originalQuery: string;
        enhancedQuery: string;
        contextSources: Array<{
            type: string;
            content: string;
            relevance: number;
            turnId?: string;
        }>;
        conversationHistory?: ConversationTurn[];
        contextVisualization?: {
            influencingQueries: Array<{
                turnId: string;
                queryText: string;
                relevance: number;
                timestamp: Date;
            }>;
            resolvedEntities: Array<{
                originalText: string;
                resolvedText: string;
                confidence: number;
            }>;
            detectedAmbiguities: Array<{
                text: string;
                type: string;
                resolutions: string[];
            }>;
        };
        contextSummary?: {
            summary: string;
            keyPoints: string[];
            relevantEntities: string[];
        };
    };
    processingTime: number;
    timestamp: Date;
}
export interface ContextSuggestionsRequest {
    sessionId: string;
    partialQuery: string;
    maxSuggestions?: number;
    includeContextual?: boolean;
}
export interface ContextSuggestionsResponse {
    success: boolean;
    suggestions: Array<{
        text: string;
        type: 'contextual' | 'template' | 'completion';
        confidence: number;
        contextSource?: string;
    }>;
    contextualSuggestions?: Array<{
        type: 'follow_up' | 'related' | 'clarification';
        suggestion: string;
        relevantContext: string;
    }>;
    processingTime: number;
}
export interface ConversationHistoryRequest {
    sessionId: string;
    limit?: number;
    includeContext?: boolean;
    summarize?: boolean;
}
export interface ConversationHistoryResponse {
    success: boolean;
    conversationHistory: ConversationTurn[];
    contextSummary?: {
        summary: string;
        keyPoints: string[];
        relevantEntities: string[];
        totalTurns: number;
    };
    contextMetrics: {
        totalTurns: number;
        followUpDetected: number;
        avgConfidence: number;
        topEntities: string[];
    };
}
export declare class ContextChatController extends AnalysisController {
    private contextService;
    private queryEnhancer;
    private contextSummarizer;
    constructor();
    /**
     * Process a context-aware chat query
     */
    processChatQuery: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Get context-aware autocomplete suggestions
     */
    getContextualSuggestions: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Get conversation history with context
     */
    getConversationHistory: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Reset conversation context
     */
    resetConversationContext: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Get context health and statistics
     */
    getContextHealth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    private processEnhancedQuery;
    private buildContextVisualization;
    private generateContextSummary;
    private generateContextualSuggestions;
    private calculateContextMetrics;
    private validateContextChatRequest;
    private validateContextSuggestionsRequest;
    private validateConversationHistoryRequest;
}
//# sourceMappingURL=context-chat.controller.d.ts.map