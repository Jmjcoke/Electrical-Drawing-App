/**
 * Context WebSocket Service Extension
 * Provides real-time context updates and notifications for chat interface
 */
import { Server } from 'socket.io';
import { ContextSummary } from '../../../../shared/types/context';
import { EnhancementResult } from '../context/ContextAwareQueryEnhancer';
export interface ContextWebSocketEvents {
    'context-join-session': (data: {
        sessionId: string;
    }) => void;
    'context-enhance-query': (data: {
        queryText: string;
        sessionId: string;
    }) => void;
    'context-reset': (data: {
        sessionId: string;
    }) => void;
    'context-request-suggestions': (data: {
        sessionId: string;
        partialQuery: string;
    }) => void;
    'context-updated': (data: {
        contextId: string;
        turnCount: number;
        sessionId: string;
    }) => void;
    'context-enhanced': (data: {
        queryId: string;
        enhancedQuery: string;
        sessionId: string;
    }) => void;
    'context-summary-ready': (data: {
        summary: ContextSummary;
        sessionId: string;
    }) => void;
    'context-cleanup-complete': (data: {
        contextId: string;
        turnsRemoved: number;
        sessionId: string;
    }) => void;
    'follow-up-detected': (data: {
        queryId: string;
        references: Array<{
            type: string;
            text: string;
            resolvedEntity?: string;
            confidence: number;
        }>;
        sessionId: string;
    }) => void;
    'context-suggestions': (data: {
        sessionId: string;
        suggestions: Array<{
            text: string;
            type: 'contextual' | 'template' | 'completion';
            confidence: number;
            contextSource?: string;
        }>;
    }) => void;
    'context-error': (data: {
        error: string;
        sessionId: string;
    }) => void;
    'context-query-processed': (data: {
        sessionId: string;
        queryId: string;
        enhancementResult: EnhancementResult;
        processingTime: number;
    }) => void;
    'context-visualization-update': (data: {
        sessionId: string;
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
    }) => void;
}
export declare class ContextWebSocketService {
    private io;
    private contextSessions;
    private socketToSession;
    /**
     * Initialize the context WebSocket service with existing Socket.IO server
     */
    initialize(io: Server): void;
    /**
     * Setup WebSocket event handlers for context management
     */
    private setupContextEventHandlers;
    /**
     * Handle client joining a context session
     */
    private handleContextJoinSession;
    /**
     * Handle context reset for a session
     */
    private handleContextReset;
    /**
     * Handle client disconnect from context
     */
    private handleContextDisconnect;
    /**
     * Remove socket from context session
     */
    private leaveContextSession;
    /**
     * Generate mock suggestions for testing
     */
    private generateMockSuggestions;
    /**
     * Broadcast context update to session
     */
    broadcastContextUpdate(sessionId: string, contextId: string, turnCount: number): void;
    /**
     * Broadcast follow-up detection to session
     */
    broadcastFollowUpDetected(sessionId: string, queryId: string, references: Array<{
        type: string;
        text: string;
        resolvedEntity?: string;
        confidence: number;
    }>): void;
    /**
     * Broadcast context summary to session
     */
    broadcastContextSummary(sessionId: string, summary: ContextSummary): void;
    /**
     * Broadcast query processing result to session
     */
    broadcastQueryProcessed(sessionId: string, queryId: string, enhancementResult: EnhancementResult, processingTime: number): void;
    /**
     * Broadcast context visualization update to session
     */
    broadcastContextVisualization(sessionId: string, visualization: {
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
    }): void;
    /**
     * Get connection statistics for context sessions
     */
    getContextConnectionStats(): {
        totalContextConnections: number;
        activeContextSessions: number;
        connectionsPerContextSession: Map<string, number>;
    };
    /**
     * Health check for context WebSocket service
     */
    healthCheck(): {
        status: string;
        stats: any;
    };
    /**
     * Graceful shutdown
     */
    shutdown(): Promise<void>;
}
export declare const contextWebSocketService: ContextWebSocketService;
//# sourceMappingURL=context-websocket.service.d.ts.map