/**
 * ContextWebSocketService Test Suite
 * Comprehensive unit tests for context WebSocket service functionality
 */

import { Server } from 'socket.io';
import { Socket } from 'socket.io-client';
import { ContextWebSocketService } from '../context-websocket.service';
import { EnhancementResult } from '../../context/ContextAwareQueryEnhancer';
import { ContextSummary } from '../../../../../shared/types/context';

// Mock Socket.IO
jest.mock('socket.io');

describe('ContextWebSocketService', () => {
  let contextWebSocketService: ContextWebSocketService;
  let mockIo: jest.Mocked<Server>;
  let mockSocket: jest.Mocked<any>;

  beforeEach(() => {
    // Reset service instance
    contextWebSocketService = new ContextWebSocketService();

    // Create mock Socket.IO server
    mockIo = {
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    } as any;

    // Create mock socket
    mockSocket = {
      id: 'socket-123',
      on: jest.fn(),
      emit: jest.fn(),
      join: jest.fn(),
      disconnect: jest.fn()
    };

    // Setup Socket.IO mock to call connection handler
    mockIo.on.mockImplementation((event: string, handler: (socket: any) => void) => {
      if (event === 'connection') {
        // Store the handler for manual invocation in tests
        (contextWebSocketService as any).connectionHandler = handler;
      }
    });
  });

  describe('initialize', () => {
    it('should initialize with Socket.IO server', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      contextWebSocketService.initialize(mockIo);

      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(consoleSpy).toHaveBeenCalledWith('Context WebSocket service initialized');

      consoleSpy.mockRestore();
    });

    it('should setup event handlers on client connection', () => {
      contextWebSocketService.initialize(mockIo);

      // Simulate client connection
      const connectionHandler = (contextWebSocketService as any).connectionHandler;
      connectionHandler(mockSocket);

      expect(mockSocket.on).toHaveBeenCalledWith('context-join-session', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('context-enhance-query', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('context-reset', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('context-request-suggestions', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('context-ping', expect.any(Function));
    });
  });

  describe('session management', () => {
    beforeEach(() => {
      contextWebSocketService.initialize(mockIo);
    });

    it('should handle context session join', () => {
      const connectionHandler = (contextWebSocketService as any).connectionHandler;
      connectionHandler(mockSocket);

      // Find the join session handler
      const joinSessionCall = mockSocket.on.mock.calls.find(call => call[0] === 'context-join-session');
      const joinSessionHandler = joinSessionCall![1];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Simulate join session event
      joinSessionHandler({ sessionId: 'test-session-1' });

      expect(mockSocket.join).toHaveBeenCalledWith('context-test-session-1');
      expect(mockSocket.emit).toHaveBeenCalledWith('context-session-joined', {
        sessionId: 'test-session-1',
        connectedClients: 1
      });

      consoleSpy.mockRestore();
    });

    it('should handle leaving previous session when joining new one', () => {
      const connectionHandler = (contextWebSocketService as any).connectionHandler;
      connectionHandler(mockSocket);

      const joinSessionCall = mockSocket.on.mock.calls.find(call => call[0] === 'context-join-session');
      const joinSessionHandler = joinSessionCall![1];

      // Join first session
      joinSessionHandler({ sessionId: 'session-1' });

      // Join second session (should leave first)
      joinSessionHandler({ sessionId: 'session-2' });

      expect(mockSocket.join).toHaveBeenCalledWith('context-session-2');
      expect(mockSocket.emit).toHaveBeenLastCalledWith('context-session-joined', {
        sessionId: 'session-2',
        connectedClients: 1
      });
    });

    it('should handle context session join errors', () => {
      const connectionHandler = (contextWebSocketService as any).connectionHandler;
      connectionHandler(mockSocket);

      const joinSessionCall = mockSocket.on.mock.calls.find(call => call[0] === 'context-join-session');
      const joinSessionHandler = joinSessionCall![1];

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockSocket.join.mockImplementation(() => {
        throw new Error('Join failed');
      });

      joinSessionHandler({ sessionId: 'test-session' });

      expect(mockSocket.emit).toHaveBeenCalledWith('context-error', {
        error: 'Failed to join context session',
        sessionId: 'test-session'
      });

      consoleErrorSpy.mockRestore();
    });

    it('should handle disconnect', () => {
      const connectionHandler = (contextWebSocketService as any).connectionHandler;
      connectionHandler(mockSocket);

      // Join a session first
      const joinSessionCall = mockSocket.on.mock.calls.find(call => call[0] === 'context-join-session');
      const joinSessionHandler = joinSessionCall![1];
      joinSessionHandler({ sessionId: 'test-session' });

      // Now disconnect
      const disconnectCall = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
      const disconnectHandler = disconnectCall![1];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      disconnectHandler();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Client disconnected from context service',
        expect.objectContaining({
          socketId: 'socket-123',
          sessionId: 'test-session'
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('query enhancement', () => {
    beforeEach(() => {
      contextWebSocketService.initialize(mockIo);
    });

    it('should handle context query enhancement', async () => {
      const connectionHandler = (contextWebSocketService as any).connectionHandler;
      connectionHandler(mockSocket);

      const enhanceQueryCall = mockSocket.on.mock.calls.find(call => call[0] === 'context-enhance-query');
      const enhanceQueryHandler = enhanceQueryCall![1];

      await enhanceQueryHandler({
        queryText: 'What is the resistor value?',
        sessionId: 'test-session'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('context-enhanced', {
        queryId: expect.stringMatching(/^query-\d+$/),
        enhancedQuery: 'Enhanced: What is the resistor value?',
        sessionId: 'test-session'
      });
    });

    it('should handle context enhancement errors', async () => {
      const connectionHandler = (contextWebSocketService as any).connectionHandler;
      connectionHandler(mockSocket);

      const enhanceQueryCall = mockSocket.on.mock.calls.find(call => call[0] === 'context-enhance-query');
      const enhanceQueryHandler = enhanceQueryCall![1];

      // Mock the enhancement to throw an error
      jest.spyOn(contextWebSocketService as any, 'enhanceQuery').mockImplementation(() => {
        throw new Error('Enhancement failed');
      });

      await enhanceQueryHandler({
        queryText: 'What is the resistor value?',
        sessionId: 'test-session'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('context-error', {
        error: 'Enhancement failed',
        sessionId: 'test-session'
      });
    });
  });

  describe('context reset', () => {
    beforeEach(() => {
      contextWebSocketService.initialize(mockIo);
    });

    it('should handle context reset', () => {
      const connectionHandler = (contextWebSocketService as any).connectionHandler;
      connectionHandler(mockSocket);

      const resetCall = mockSocket.on.mock.calls.find(call => call[0] === 'context-reset');
      const resetHandler = resetCall![1];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      resetHandler({ sessionId: 'test-session' });

      expect(mockIo.to).toHaveBeenCalledWith('context-test-session');
      expect(mockIo.emit).toHaveBeenCalledWith('context-cleanup-complete', {
        contextId: 'context-test-session',
        turnsRemoved: 0,
        sessionId: 'test-session'
      });

      consoleSpy.mockRestore();
    });

    it('should handle context reset errors', () => {
      const connectionHandler = (contextWebSocketService as any).connectionHandler;
      connectionHandler(mockSocket);

      const resetCall = mockSocket.on.mock.calls.find(call => call[0] === 'context-reset');
      const resetHandler = resetCall![1];

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockIo.to.mockImplementation(() => {
        throw new Error('Reset failed');
      });

      resetHandler({ sessionId: 'test-session' });

      expect(mockSocket.emit).toHaveBeenCalledWith('context-error', {
        error: 'Context reset failed',
        sessionId: 'test-session'
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('suggestions', () => {
    beforeEach(() => {
      contextWebSocketService.initialize(mockIo);
    });

    it('should handle suggestion requests', async () => {
      const connectionHandler = (contextWebSocketService as any).connectionHandler;
      connectionHandler(mockSocket);

      const suggestionsCall = mockSocket.on.mock.calls.find(call => call[0] === 'context-request-suggestions');
      const suggestionsHandler = suggestionsCall![1];

      await suggestionsHandler({
        sessionId: 'test-session',
        partialQuery: 'What is the resistor'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('context-suggestions', {
        sessionId: 'test-session',
        suggestions: expect.arrayContaining([
          expect.objectContaining({
            text: expect.any(String),
            type: expect.stringMatching(/contextual|template|completion/),
            confidence: expect.any(Number)
          })
        ])
      });
    });

    it('should generate appropriate suggestions based on query content', async () => {
      const connectionHandler = (contextWebSocketService as any).connectionHandler;
      connectionHandler(mockSocket);

      const suggestionsCall = mockSocket.on.mock.calls.find(call => call[0] === 'context-request-suggestions');
      const suggestionsHandler = suggestionsCall![1];

      await suggestionsHandler({
        sessionId: 'test-session',
        partialQuery: 'What is the resistor'
      });

      const emitCall = mockSocket.emit.mock.calls.find(call => call[0] === 'context-suggestions');
      const suggestions = emitCall![1].suggestions;

      expect(suggestions).toContainEqual(
        expect.objectContaining({
          text: 'What is the power rating of the resistor?',
          type: 'contextual',
          confidence: 0.9,
          contextSource: 'Previous resistor discussion'
        })
      );
    });
  });

  describe('broadcast methods', () => {
    beforeEach(() => {
      contextWebSocketService.initialize(mockIo);
    });

    it('should broadcast context updates', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      contextWebSocketService.broadcastContextUpdate('session-1', 'context-1', 5);

      expect(mockIo.to).toHaveBeenCalledWith('context-session-1');
      expect(mockIo.emit).toHaveBeenCalledWith('context-updated', {
        contextId: 'context-1',
        turnCount: 5,
        sessionId: 'session-1'
      });

      consoleSpy.mockRestore();
    });

    it('should broadcast follow-up detection', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const references = [
        {
          type: 'pronoun',
          text: 'that',
          resolvedEntity: 'resistor R1',
          confidence: 0.8
        }
      ];

      contextWebSocketService.broadcastFollowUpDetected('session-1', 'query-1', references);

      expect(mockIo.to).toHaveBeenCalledWith('context-session-1');
      expect(mockIo.emit).toHaveBeenCalledWith('follow-up-detected', {
        queryId: 'query-1',
        references,
        sessionId: 'session-1'
      });

      consoleSpy.mockRestore();
    });

    it('should broadcast context summary', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const summary: ContextSummary = {
        summary: 'Discussion about resistors',
        keyPoints: ['R1 is 10kΩ', 'Power rating is 0.25W'],
        relevantEntities: ['R1', 'resistor'],
        compressionRatio: 0.5,
        originalTurnCount: 3,
        summaryConfidence: 0.9
      };

      contextWebSocketService.broadcastContextSummary('session-1', summary);

      expect(mockIo.to).toHaveBeenCalledWith('context-session-1');
      expect(mockIo.emit).toHaveBeenCalledWith('context-summary-ready', {
        summary,
        sessionId: 'session-1'
      });

      consoleSpy.mockRestore();
    });

    it('should broadcast query processing results', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const enhancementResult: EnhancementResult = {
        originalQuery: 'What is the resistor?',
        enhancedQuery: 'What is the resistor R1 in the circuit?',
        contextSources: [],
        resolvedEntities: [],
        detectedAmbiguities: [],
        confidence: 0.8,
        processingTime: 150
      };

      contextWebSocketService.broadcastQueryProcessed('session-1', 'query-1', enhancementResult, 200);

      expect(mockIo.to).toHaveBeenCalledWith('context-session-1');
      expect(mockIo.emit).toHaveBeenCalledWith('context-query-processed', {
        sessionId: 'session-1',
        queryId: 'query-1',
        enhancementResult,
        processingTime: 200
      });

      consoleSpy.mockRestore();
    });

    it('should broadcast context visualization', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const visualization = {
        influencingQueries: [
          {
            turnId: 'turn-1',
            queryText: 'What is R1?',
            relevance: 0.9,
            timestamp: new Date()
          }
        ],
        resolvedEntities: [
          {
            originalText: 'that resistor',
            resolvedText: 'resistor R1',
            confidence: 0.8
          }
        ]
      };

      contextWebSocketService.broadcastContextVisualization('session-1', visualization);

      expect(mockIo.to).toHaveBeenCalledWith('context-session-1');
      expect(mockIo.emit).toHaveBeenCalledWith('context-visualization-update', {
        sessionId: 'session-1',
        ...visualization
      });

      consoleSpy.mockRestore();
    });

    it('should handle broadcast errors gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockIo.to.mockImplementation(() => {
        throw new Error('Broadcast failed');
      });

      contextWebSocketService.broadcastContextUpdate('session-1', 'context-1', 5);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to broadcast context update',
        expect.objectContaining({
          sessionId: 'session-1',
          error: expect.any(Error)
        })
      );

      consoleErrorSpy.mockRestore();
    });

    it('should warn when WebSocket server not initialized', () => {
      const uninitializedService = new ContextWebSocketService();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      uninitializedService.broadcastContextUpdate('session-1', 'context-1', 5);

      expect(consoleWarnSpy).toHaveBeenCalledWith('Context WebSocket server not initialized');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('connection statistics', () => {
    beforeEach(() => {
      contextWebSocketService.initialize(mockIo);
    });

    it('should return connection statistics', () => {
      // Simulate some connections
      const connectionHandler = (contextWebSocketService as any).connectionHandler;
      
      const socket1 = { ...mockSocket, id: 'socket-1' };
      const socket2 = { ...mockSocket, id: 'socket-2' };
      
      connectionHandler(socket1);
      connectionHandler(socket2);

      // Join sessions
      const joinSessionCall = socket1.on.mock.calls.find(call => call[0] === 'context-join-session');
      const joinSessionHandler = joinSessionCall![1];
      
      joinSessionHandler.call({ id: 'socket-1' }, { sessionId: 'session-1' });
      joinSessionHandler.call({ id: 'socket-2' }, { sessionId: 'session-2' });

      const stats = contextWebSocketService.getContextConnectionStats();

      expect(stats).toEqual({
        totalContextConnections: expect.any(Number),
        activeContextSessions: expect.any(Number),
        connectionsPerContextSession: expect.any(Map)
      });
    });

    it('should provide health check', () => {
      const health = contextWebSocketService.healthCheck();

      expect(health).toEqual({
        status: 'healthy',
        stats: expect.objectContaining({
          totalContextConnections: expect.any(Number),
          activeContextSessions: expect.any(Number)
        })
      });
    });

    it('should report unhealthy when not initialized', () => {
      const uninitializedService = new ContextWebSocketService();
      const health = uninitializedService.healthCheck();

      expect(health.status).toBe('unhealthy');
    });
  });

  describe('shutdown', () => {
    beforeEach(() => {
      contextWebSocketService.initialize(mockIo);
    });

    it('should shutdown gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await contextWebSocketService.shutdown();

      expect(mockIo.emit).toHaveBeenCalledWith('context-server-shutdown', {
        message: 'Context service is shutting down',
        timestamp: expect.any(String)
      });

      expect(consoleSpy).toHaveBeenCalledWith('Shutting down Context WebSocket service');
      expect(consoleSpy).toHaveBeenCalledWith('Context WebSocket service shutdown complete');

      consoleSpy.mockRestore();
    });

    it('should handle shutdown when not initialized', async () => {
      const uninitializedService = new ContextWebSocketService();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await uninitializedService.shutdown();

      // Should not log anything or throw errors
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('ping/pong', () => {
    beforeEach(() => {
      contextWebSocketService.initialize(mockIo);
    });

    it('should handle ping with pong response', () => {
      const connectionHandler = (contextWebSocketService as any).connectionHandler;
      connectionHandler(mockSocket);

      const pingCall = mockSocket.on.mock.calls.find(call => call[0] === 'context-ping');
      const pingHandler = pingCall![1];

      pingHandler();

      expect(mockSocket.emit).toHaveBeenCalledWith('context-pong', {
        timestamp: expect.any(Number)
      });
    });
  });
});