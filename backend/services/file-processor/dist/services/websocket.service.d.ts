/**
 * WebSocket service for real-time PDF conversion progress updates
 */
import { Server as HttpServer } from 'http';
import { ConversionProgress } from '../types/api.types.js';
export interface ProcessingProgress extends ConversionProgress {
    sessionId: string;
}
export interface QueueStatus {
    sessionId: string;
    position: number;
    estimatedWaitTimeMs: number;
}
export interface ConversionError {
    sessionId: string;
    documentId: string;
    error: string;
    retryable: boolean;
}
declare class WebSocketService {
    private io;
    private connectedSessions;
    private socketSessions;
    /**
     * Initialize WebSocket server
     */
    initialize(httpServer: HttpServer): void;
    /**
     * Setup WebSocket event handlers
     */
    private setupEventHandlers;
    /**
     * Handle client joining a session
     */
    private handleJoinSession;
    /**
     * Handle client disconnect
     */
    private handleDisconnect;
    /**
     * Remove socket from session
     */
    private leaveSession;
    /**
     * Broadcast conversion progress to session
     */
    broadcastConversionProgress(sessionId: string, progress: ConversionProgress): void;
    /**
     * Broadcast conversion completion to session
     */
    broadcastConversionComplete(sessionId: string, result: {
        documentId: string;
        imagePaths: string[];
        success: boolean;
        durationMs: number;
        pageCount: number;
    }): void;
    /**
     * Broadcast conversion error to session
     */
    broadcastConversionError(sessionId: string, error: {
        documentId: string;
        error: string;
        retryable: boolean;
    }): void;
    /**
     * Broadcast queue status to session
     */
    broadcastQueueStatus(sessionId: string, status: {
        position: number;
        estimatedWaitTimeMs: number;
    }): void;
    /**
     * Get connection statistics
     */
    getConnectionStats(): {
        totalConnections: number;
        activeSessions: number;
        connectionsPerSession: Map<string, number>;
    };
    /**
     * Health check for WebSocket service
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
export declare const webSocketService: WebSocketService;
export {};
//# sourceMappingURL=websocket.service.d.ts.map