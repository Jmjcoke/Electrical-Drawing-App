/**
 * ConversationContext Service
 * Main context management service for handling query-response history and contextual awareness
 */
import type { ConversationContext, ConversationTurn, ProcessedQuery, AnalysisResult, ContextStorageConfig, ContextValidationResult } from '../../../../shared/types/context';
export declare class ConversationContextService {
    private readonly config;
    private readonly contextCache;
    constructor(config: ContextStorageConfig);
    /**
     * Creates a new conversation context for a session
     * @param sessionId - Session identifier
     * @returns Promise resolving to new conversation context
     */
    createContext(sessionId: string): Promise<ConversationContext>;
    /**
     * Retrieves conversation context by session ID
     * @param sessionId - Session identifier
     * @returns Promise resolving to conversation context or null if not found
     */
    getContextBySessionId(sessionId: string): Promise<ConversationContext | null>;
    /**
     * Adds a new conversation turn to the context
     * @param contextId - Context identifier
     * @param query - Processed query
     * @param response - Analysis result
     * @param followUpDetected - Whether this was detected as a follow-up
     * @returns Promise resolving to updated context
     */
    addTurn(contextId: string, query: ProcessedQuery, response: AnalysisResult, followUpDetected?: boolean): Promise<ConversationContext>;
    /**
     * Retrieves relevant context for a new query
     * @param sessionId - Session identifier
     * @param currentQuery - Current query text
     * @param maxTurns - Maximum number of turns to retrieve
     * @returns Promise resolving to relevant conversation turns
     */
    getRelevantContext(sessionId: string, currentQuery: string, maxTurns?: number): Promise<ConversationTurn[]>;
    /**
     * Resets conversation context for a session
     * @param sessionId - Session identifier
     * @returns Promise resolving to new clean context
     */
    resetContext(sessionId: string): Promise<ConversationContext>;
    /**
     * Validates context integrity and consistency
     * @param context - Context to validate
     * @returns Validation result with errors and warnings
     */
    validateContext(context: ConversationContext): ContextValidationResult;
    /**
     * Cleans up expired contexts
     * @returns Promise resolving to number of contexts cleaned up
     */
    cleanupExpiredContexts(): Promise<number>;
    private isExpired;
    private updateAccessMetadata;
    private extractContextContributions;
    private updateCumulativeContext;
    private calculateRelevanceScore;
    private compressContext;
    private summarizeOlderTurns;
}
//# sourceMappingURL=ConversationContext.d.ts.map