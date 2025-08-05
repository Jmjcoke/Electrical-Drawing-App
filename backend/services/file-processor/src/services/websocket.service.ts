/**
 * WebSocket service for real-time PDF conversion progress updates
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';
import { ConversionProgress, WebSocketEvents } from '../types/api.types.js';

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

class WebSocketService {
  private io: Server | null = null;
  private connectedSessions = new Map<string, Set<string>>(); // sessionId -> socket IDs
  private socketSessions = new Map<string, string>(); // socketId -> sessionId

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HttpServer): void {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventHandlers();
    logger.info('WebSocket service initialized');
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      logger.info('Client connected', { socketId: socket.id });

      // Handle session join
      socket.on('join-session', (data: { sessionId: string }) => {
        this.handleJoinSession(socket, data.sessionId);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Handle ping for connection health
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
      });
    });
  }

  /**
   * Handle client joining a session
   */
  private handleJoinSession(socket: Socket, sessionId: string): void {
    try {
      // Leave previous session if any
      const previousSessionId = this.socketSessions.get(socket.id);
      if (previousSessionId) {
        this.leaveSession(socket.id, previousSessionId);
      }

      // Join new session
      socket.join(sessionId);
      this.socketSessions.set(socket.id, sessionId);

      // Track session connections
      if (!this.connectedSessions.has(sessionId)) {
        this.connectedSessions.set(sessionId, new Set());
      }
      this.connectedSessions.get(sessionId)!.add(socket.id);

      socket.emit('session-joined', { 
        sessionId, 
        connectedClients: this.connectedSessions.get(sessionId)!.size 
      });

      logger.info('Client joined session', { 
        socketId: socket.id, 
        sessionId,
        totalConnections: this.connectedSessions.get(sessionId)!.size
      });
    } catch (error) {
      logger.error('Failed to join session', { socketId: socket.id, sessionId, error });
      socket.emit('error', { message: 'Failed to join session' });
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(socket: Socket): void {
    try {
      const sessionId = this.socketSessions.get(socket.id);
      if (sessionId) {
        this.leaveSession(socket.id, sessionId);
      }

      logger.info('Client disconnected', { socketId: socket.id, sessionId });
    } catch (error) {
      logger.error('Error handling disconnect', { socketId: socket.id, error });
    }
  }

  /**
   * Remove socket from session
   */
  private leaveSession(socketId: string, sessionId: string): void {
    const sessionSockets = this.connectedSessions.get(sessionId);
    if (sessionSockets) {
      sessionSockets.delete(socketId);
      if (sessionSockets.size === 0) {
        this.connectedSessions.delete(sessionId);
      }
    }
    this.socketSessions.delete(socketId);
  }

  /**
   * Broadcast conversion progress to session
   */
  broadcastConversionProgress(sessionId: string, progress: ConversionProgress): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    try {
      this.io.to(sessionId).emit('conversion-progress', progress);
      
      logger.debug('Conversion progress broadcasted', {
        sessionId,
        documentId: progress.documentId,
        stage: progress.stage,
        percentage: progress.percentage,
        connectedClients: this.connectedSessions.get(sessionId)?.size || 0
      });
    } catch (error) {
      logger.error('Failed to broadcast conversion progress', { sessionId, error });
    }
  }

  /**
   * Broadcast conversion completion to session
   */
  broadcastConversionComplete(sessionId: string, result: { 
    documentId: string; 
    imagePaths: string[];
    success: boolean;
    durationMs: number;
    pageCount: number;
  }): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    try {
      this.io.to(sessionId).emit('conversion-complete', result);
      
      logger.info('Conversion completion broadcasted', {
        sessionId,
        documentId: result.documentId,
        success: result.success,
        pageCount: result.pageCount,
        durationMs: result.durationMs,
        connectedClients: this.connectedSessions.get(sessionId)?.size || 0
      });
    } catch (error) {
      logger.error('Failed to broadcast conversion completion', { sessionId, error });
    }
  }

  /**
   * Broadcast conversion error to session
   */
  broadcastConversionError(sessionId: string, error: {
    documentId: string;
    error: string;
    retryable: boolean;
  }): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    try {
      this.io.to(sessionId).emit('conversion-error', error);
      
      logger.warn('Conversion error broadcasted', {
        sessionId,
        documentId: error.documentId,
        error: error.error,
        retryable: error.retryable,
        connectedClients: this.connectedSessions.get(sessionId)?.size || 0
      });
    } catch (error: any) {
      logger.error('Failed to broadcast conversion error', { sessionId, error: error.message });
    }
  }

  /**
   * Broadcast queue status to session
   */
  broadcastQueueStatus(sessionId: string, status: {
    position: number;
    estimatedWaitTimeMs: number;
  }): void {
    if (!this.io) {
      logger.warn('WebSocket server not initialized');
      return;
    }

    try {
      this.io.to(sessionId).emit('queue-status', status);
      
      logger.debug('Queue status broadcasted', {
        sessionId,
        position: status.position,
        waitTimeMs: status.estimatedWaitTimeMs,
        connectedClients: this.connectedSessions.get(sessionId)?.size || 0
      });
    } catch (error) {
      logger.error('Failed to broadcast queue status', { sessionId, error });
    }
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    activeSessions: number;
    connectionsPerSession: Map<string, number>;
  } {
    const totalConnections = this.socketSessions.size;
    const activeSessions = this.connectedSessions.size;
    const connectionsPerSession = new Map<string, number>();

    for (const [sessionId, sockets] of this.connectedSessions.entries()) {
      connectionsPerSession.set(sessionId, sockets.size);
    }

    return {
      totalConnections,
      activeSessions,
      connectionsPerSession
    };
  }

  /**
   * Health check for WebSocket service
   */
  healthCheck(): { status: string; stats: any } {
    const stats = this.getConnectionStats();
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
      logger.info('Shutting down WebSocket service');
      
      // Notify all connected clients
      this.io.emit('server-shutdown', { 
        message: 'Server is shutting down', 
        timestamp: new Date().toISOString() 
      });

      // Close all connections
      this.io.close();
      this.io = null;
      
      // Clear internal state
      this.connectedSessions.clear();
      this.socketSessions.clear();
      
      logger.info('WebSocket service shutdown complete');
    }
  }
}

export const webSocketService = new WebSocketService();