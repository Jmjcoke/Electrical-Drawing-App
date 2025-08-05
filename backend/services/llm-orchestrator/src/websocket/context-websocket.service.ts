/**
 * Context WebSocket Service Extension
 * Provides real-time context updates and notifications for chat interface
 */

import { Server, Socket } from 'socket.io';
import { ConversationContext, ConversationTurn, ContextSummary } from '../../../../shared/types/context';
import { EnhancementResult } from '../context/ContextAwareQueryEnhancer';

export interface ContextWebSocketEvents {
  // Client to Server events
  'context-join-session': (data: { sessionId: string }) => void;
  'context-enhance-query': (data: { queryText: string; sessionId: string }) => void;
  'context-reset': (data: { sessionId: string }) => void;
  'context-request-suggestions': (data: { sessionId: string; partialQuery: string }) => void;
  
  // Server to Client events
  'context-updated': (data: { contextId: string; turnCount: number; sessionId: string }) => void;
  'context-enhanced': (data: { queryId: string; enhancedQuery: string; sessionId: string }) => void;
  'context-summary-ready': (data: { summary: ContextSummary; sessionId: string }) => void;
  'context-cleanup-complete': (data: { contextId: string; turnsRemoved: number; sessionId: string }) => void;
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
  'context-error': (data: { error: string; sessionId: string }) => void;
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

export class ContextWebSocketService {
  private io: Server | null = null;
  private contextSessions = new Map<string, Set<string>>(); // sessionId -> socket IDs
  private socketToSession = new Map<string, string>(); // socketId -> sessionId

  /**
   * Initialize the context WebSocket service with existing Socket.IO server
   */
  initialize(io: Server): void {
    this.io = io;
    this.setupContextEventHandlers();
    console.log('Context WebSocket service initialized');
  }

  /**
   * Setup WebSocket event handlers for context management
   */
  private setupContextEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      console.log('Client connected to context service', { socketId: socket.id });

      // Handle session join for context
      socket.on('context-join-session', (data: { sessionId: string }) => {
        this.handleContextJoinSession(socket, data.sessionId);
      });

      // Handle context-specific query enhancement
      socket.on('context-enhance-query', async (data: { queryText: string; sessionId: string }) => {
        try {
          // This would integrate with the ContextAwareQueryEnhancer
          // For now, we'll emit a mock response
          socket.emit('context-enhanced', {
            queryId: `query-${Date.now()}`,
            enhancedQuery: `Enhanced: ${data.queryText}`,
            sessionId: data.sessionId
          });
        } catch (error) {
          socket.emit('context-error', {
            error: error instanceof Error ? error.message : 'Context enhancement failed',
            sessionId: data.sessionId
          });
        }
      });

      // Handle context reset
      socket.on('context-reset', (data: { sessionId: string }) => {
        this.handleContextReset(socket, data.sessionId);
      });

      // Handle context suggestion requests
      socket.on('context-request-suggestions', async (data: { sessionId: string; partialQuery: string }) => {
        try {
          // This would integrate with the ContextChatController
          // For now, we'll emit mock suggestions
          const suggestions = this.generateMockSuggestions(data.partialQuery);
          
          socket.emit('context-suggestions', {
            sessionId: data.sessionId,
            suggestions
          });
        } catch (error) {
          socket.emit('context-error', {
            error: error instanceof Error ? error.message : 'Suggestion generation failed',
            sessionId: data.sessionId
          });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleContextDisconnect(socket);
      });

      // Handle connection health check
      socket.on('context-ping', () => {
        socket.emit('context-pong', { timestamp: Date.now() });
      });
    });
  }

  /**
   * Handle client joining a context session
   */
  private handleContextJoinSession(socket: Socket, sessionId: string): void {
    try {
      // Leave previous session if any
      const previousSessionId = this.socketToSession.get(socket.id);
      if (previousSessionId) {
        this.leaveContextSession(socket.id, previousSessionId);
      }

      // Join new context session
      socket.join(`context-${sessionId}`);
      this.socketToSession.set(socket.id, sessionId);

      // Track session connections
      if (!this.contextSessions.has(sessionId)) {
        this.contextSessions.set(sessionId, new Set());
      }
      this.contextSessions.get(sessionId)!.add(socket.id);

      socket.emit('context-session-joined', { 
        sessionId, 
        connectedClients: this.contextSessions.get(sessionId)!.size 
      });

      console.log('Client joined context session', { 
        socketId: socket.id, 
        sessionId,
        totalConnections: this.contextSessions.get(sessionId)!.size
      });
    } catch (error) {
      console.error('Failed to join context session', { socketId: socket.id, sessionId, error });
      socket.emit('context-error', { 
        error: 'Failed to join context session',
        sessionId 
      });
    }
  }

  /**
   * Handle context reset for a session
   */
  private handleContextReset(socket: Socket, sessionId: string): void {
    try {
      // Broadcast reset to all clients in the session
      this.io?.to(`context-${sessionId}`).emit('context-cleanup-complete', {
        contextId: `context-${sessionId}`,
        turnsRemoved: 0, // Would be actual count from context service
        sessionId
      });

      console.log('Context reset for session', { sessionId, requestedBy: socket.id });
    } catch (error) {
      console.error('Context reset failed', { sessionId, error });
      socket.emit('context-error', {
        error: 'Context reset failed',
        sessionId
      });
    }
  }

  /**
   * Handle client disconnect from context
   */
  private handleContextDisconnect(socket: Socket): void {
    try {
      const sessionId = this.socketToSession.get(socket.id);
      if (sessionId) {
        this.leaveContextSession(socket.id, sessionId);
      }

      console.log('Client disconnected from context service', { socketId: socket.id, sessionId });
    } catch (error) {
      console.error('Error handling context disconnect', { socketId: socket.id, error });
    }
  }

  /**
   * Remove socket from context session
   */
  private leaveContextSession(socketId: string, sessionId: string): void {
    const sessionSockets = this.contextSessions.get(sessionId);
    if (sessionSockets) {
      sessionSockets.delete(socketId);
      if (sessionSockets.size === 0) {
        this.contextSessions.delete(sessionId);
      }
    }
    this.socketToSession.delete(socketId);
  }

  /**
   * Generate mock suggestions for testing
   */
  private generateMockSuggestions(partialQuery: string): Array<{
    text: string;
    type: 'contextual' | 'template' | 'completion';
    confidence: number;
    contextSource?: string;
  }> {
    const suggestions = [];
    
    if (partialQuery.toLowerCase().includes('resistor')) {
      suggestions.push({
        text: 'What is the power rating of the resistor?',
        type: 'contextual' as const,
        confidence: 0.9,
        contextSource: 'Previous resistor discussion'
      });
    }
    
    if (partialQuery.toLowerCase().includes('component')) {
      suggestions.push({
        text: 'Show me the component specifications',
        type: 'template' as const,
        confidence: 0.8
      });
    }
    
    suggestions.push({
      text: `${partialQuery} in the circuit diagram`,
      type: 'completion' as const,
      confidence: 0.7
    });

    return suggestions;
  }

  // Public broadcast methods for integration with context services

  /**
   * Broadcast context update to session
   */
  broadcastContextUpdate(sessionId: string, contextId: string, turnCount: number): void {
    if (!this.io) {
      console.warn('Context WebSocket server not initialized');
      return;
    }

    try {
      this.io.to(`context-${sessionId}`).emit('context-updated', {
        contextId,
        turnCount,
        sessionId
      });

      console.log('Context update broadcasted', {
        sessionId,
        contextId,
        turnCount,
        connectedClients: this.contextSessions.get(sessionId)?.size || 0
      });
    } catch (error) {
      console.error('Failed to broadcast context update', { sessionId, error });
    }
  }

  /**
   * Broadcast follow-up detection to session
   */
  broadcastFollowUpDetected(sessionId: string, queryId: string, references: Array<{
    type: string;
    text: string;
    resolvedEntity?: string;
    confidence: number;
  }>): void {
    if (!this.io) {
      console.warn('Context WebSocket server not initialized');
      return;
    }

    try {
      this.io.to(`context-${sessionId}`).emit('follow-up-detected', {
        queryId,
        references,
        sessionId
      });

      console.log('Follow-up detection broadcasted', {
        sessionId,
        queryId,
        referenceCount: references.length,
        connectedClients: this.contextSessions.get(sessionId)?.size || 0
      });
    } catch (error) {
      console.error('Failed to broadcast follow-up detection', { sessionId, error });
    }
  }

  /**
   * Broadcast context summary to session
   */
  broadcastContextSummary(sessionId: string, summary: ContextSummary): void {
    if (!this.io) {
      console.warn('Context WebSocket server not initialized');
      return;
    }

    try {
      this.io.to(`context-${sessionId}`).emit('context-summary-ready', {
        summary,
        sessionId
      });

      console.log('Context summary broadcasted', {
        sessionId,
        keyPointsCount: summary.keyPoints.length,
        connectedClients: this.contextSessions.get(sessionId)?.size || 0
      });
    } catch (error) {
      console.error('Failed to broadcast context summary', { sessionId, error });
    }
  }

  /**
   * Broadcast query processing result to session
   */
  broadcastQueryProcessed(sessionId: string, queryId: string, enhancementResult: EnhancementResult, processingTime: number): void {
    if (!this.io) {
      console.warn('Context WebSocket server not initialized');
      return;
    }

    try {
      this.io.to(`context-${sessionId}`).emit('context-query-processed', {
        sessionId,
        queryId,
        enhancementResult,
        processingTime
      });

      console.log('Query processing result broadcasted', {
        sessionId,
        queryId,
        processingTime,
        confidence: enhancementResult.confidence,
        connectedClients: this.contextSessions.get(sessionId)?.size || 0
      });
    } catch (error) {
      console.error('Failed to broadcast query processing result', { sessionId, error });
    }
  }

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
  }): void {
    if (!this.io) {
      console.warn('Context WebSocket server not initialized');
      return;
    }

    try {
      this.io.to(`context-${sessionId}`).emit('context-visualization-update', {
        sessionId,
        ...visualization
      });

      console.log('Context visualization broadcasted', {
        sessionId,
        influencingQueries: visualization.influencingQueries.length,
        resolvedEntities: visualization.resolvedEntities.length,
        connectedClients: this.contextSessions.get(sessionId)?.size || 0
      });
    } catch (error) {
      console.error('Failed to broadcast context visualization', { sessionId, error });
    }
  }

  /**
   * Get connection statistics for context sessions
   */
  getContextConnectionStats(): {
    totalContextConnections: number;
    activeContextSessions: number;
    connectionsPerContextSession: Map<string, number>;
  } {
    const totalContextConnections = this.socketToSession.size;
    const activeContextSessions = this.contextSessions.size;
    const connectionsPerContextSession = new Map<string, number>();

    for (const [sessionId, sockets] of this.contextSessions.entries()) {
      connectionsPerContextSession.set(sessionId, sockets.size);
    }

    return {
      totalContextConnections,
      activeContextSessions,
      connectionsPerContextSession
    };
  }

  /**
   * Health check for context WebSocket service
   */
  healthCheck(): { status: string; stats: any } {
    const stats = this.getContextConnectionStats();
    return {
      status: this.io ? 'healthy' : 'unhealthy',
      stats
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.io) {
      console.log('Shutting down Context WebSocket service');
      
      // Notify all connected context clients
      this.io.emit('context-server-shutdown', { 
        message: 'Context service is shutting down', 
        timestamp: new Date().toISOString() 
      });

      // Clear internal state
      this.contextSessions.clear();
      this.socketToSession.clear();
      
      console.log('Context WebSocket service shutdown complete');
    }
  }
}

export const contextWebSocketService = new ContextWebSocketService();