/**
 * ContextStorage Service Tests
 * Unit tests for database persistence layer functionality
 */

import { Pool, PoolClient } from 'pg';
import { ContextStorageService } from '../ContextStorage';
import type {
  ConversationContext,
  ConversationTurn,
  ContextStorageConfig
} from '../../../../../shared/types/context';

// Mock pg module
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    end: jest.fn()
  }))
}));

describe('ContextStorageService', () => {
  let service: ContextStorageService;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: jest.Mocked<PoolClient>;
  let config: ContextStorageConfig;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    } as any;

    // Setup mock pool
    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      end: jest.fn()
    } as any;

    config = {
      maxTurnsPerContext: 10,
      compressionThreshold: 100,
      expirationHours: 24,
      cleanupIntervalMinutes: 60
    };

    service = new ContextStorageService({
      database: mockPool,
      config
    });
  });

  describe('storeContext', () => {
    it('should store a new conversation context successfully', async () => {
      const context: ConversationContext = {
        id: 'test-context-id',
        sessionId: 'test-session-id',
        conversationThread: [],
        cumulativeContext: {
          extractedEntities: new Map(),
          documentContext: [],
          topicProgression: [],
          keyInsights: [],
          relationshipMap: []
        },
        lastUpdated: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {
          createdAt: new Date(),
          turnCount: 0,
          storageSize: 0,
          compressionApplied: false,
          lastAccessedAt: new Date()
        }
      };

      // Mock successful database operations
      mockClient.query
        .mockResolvedValueOnce({ command: 'BEGIN' }) // BEGIN transaction
        .mockResolvedValueOnce({ rows: [{ id: context.id }] }) // INSERT context
        .mockResolvedValueOnce({ command: 'COMMIT' }); // COMMIT transaction

      const result = await service.storeContext(context);

      expect(result).toBe(context.id);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle database errors and rollback transaction', async () => {
      const context: ConversationContext = {
        id: 'test-context-id',
        sessionId: 'test-session-id',
        conversationThread: [],
        cumulativeContext: {
          extractedEntities: new Map(),
          documentContext: [],
          topicProgression: [],
          keyInsights: [],
          relationshipMap: []
        },
        lastUpdated: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {
          createdAt: new Date(),
          turnCount: 0,
          storageSize: 0,
          compressionApplied: false,
          lastAccessedAt: new Date()
        }
      };

      // Mock database error
      const dbError = new Error('Database connection failed');
      mockClient.query
        .mockResolvedValueOnce({ command: 'BEGIN' }) // BEGIN transaction
        .mockRejectedValueOnce(dbError); // INSERT fails

      await expect(service.storeContext(context)).rejects.toThrow('Database connection failed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should store context with conversation turns', async () => {
      const turn: ConversationTurn = {
        id: 'turn-1',
        turnNumber: 1,
        query: {
          id: 'query-1',
          originalText: 'What is this component?',
          processedText: 'What is this component?',
          intent: 'component_identification',
          entities: [],
          metadata: {
            timestamp: new Date(),
            confidence: 0.95,
            processingTimeMs: 150
          }
        },
        response: {
          id: 'response-1',
          queryId: 'query-1',
          analysisType: 'component_identification',
          result: {
            summary: 'This is a resistor',
            confidence: 0.92,
            evidence: []
          },
          metadata: {
            timestamp: new Date(),
            processingTimeMs: 300,
            model: 'gpt-4'
          }
        },
        contextContributions: ['entity: resistor', 'component_type: passive'],
        followUpDetected: false,
        timestamp: new Date()
      };

      const context: ConversationContext = {
        id: 'test-context-with-turns',
        sessionId: 'test-session-id',
        conversationThread: [turn],
        cumulativeContext: {
          extractedEntities: new Map([['resistor', [{ text: 'resistor', type: 'component', confidence: 0.92 }]]]),
          documentContext: [],
          topicProgression: [],
          keyInsights: [],
          relationshipMap: []
        },
        lastUpdated: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {
          createdAt: new Date(),
          turnCount: 1,
          storageSize: 1024,
          compressionApplied: false,
          lastAccessedAt: new Date()
        }
      };

      // Mock successful database operations
      mockClient.query
        .mockResolvedValueOnce({ command: 'BEGIN' })
        .mockResolvedValueOnce({ rows: [{ id: context.id }] }) // INSERT context
        .mockResolvedValueOnce({ rows: [{ id: 'turn-1' }] }) // INSERT turn
        .mockResolvedValueOnce({ command: 'COMMIT' });

      const result = await service.storeContext(context);

      expect(result).toBe(context.id);
      expect(mockClient.query).toHaveBeenCalledTimes(4); // BEGIN, INSERT context, INSERT turn, COMMIT
    });
  });

  describe('retrieveContext', () => {
    it('should retrieve existing conversation context', async () => {
      const contextId = 'existing-context-id';
      const mockContextData = {
        id: contextId,
        session_id: 'test-session',
        context_data: JSON.stringify({
          conversationThread: [],
          cumulativeContext: {
            extractedEntities: {},
            documentContext: [],
            topicProgression: [],
            keyInsights: [],
            relationshipMap: []
          }
        }),
        cumulative_context: JSON.stringify({}),
        turn_count: 0,
        last_updated: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        compression_applied: false
      };

      // Mock database query
      mockClient.query.mockResolvedValueOnce({
        rows: [mockContextData]
      });

      const result = await service.retrieveContext(contextId);

      expect(result).toBeDefined();
      expect(result!.id).toBe(contextId);
      expect(result!.sessionId).toBe('test-session');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [contextId]
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return null for non-existent context', async () => {
      const contextId = 'non-existent-context';

      // Mock empty result
      mockClient.query.mockResolvedValueOnce({
        rows: []
      });

      const result = await service.retrieveContext(contextId);

      expect(result).toBeNull();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const contextId = 'error-context';
      const dbError = new Error('Database query failed');

      mockClient.query.mockRejectedValueOnce(dbError);

      await expect(service.retrieveContext(contextId)).rejects.toThrow('Database query failed');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('retrieveContextBySession', () => {
    it('should retrieve context by session ID', async () => {
      const sessionId = 'test-session-123';
      const mockContextData = {
        id: 'context-for-session',
        session_id: sessionId,
        context_data: JSON.stringify({
          conversationThread: [],
          cumulativeContext: {
            extractedEntities: {},
            documentContext: [],
            topicProgression: [],
            keyInsights: [],
            relationshipMap: []
          }
        }),
        cumulative_context: JSON.stringify({}),
        turn_count: 0,
        last_updated: new Date(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        compression_applied: false
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [mockContextData]
      });

      const result = await service.retrieveContextBySession(sessionId);

      expect(result).toBeDefined();
      expect(result!.sessionId).toBe(sessionId);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE session_id = $1'),
        [sessionId]
      );
    });

    it('should return null for session with no context', async () => {
      const sessionId = 'session-without-context';

      mockClient.query.mockResolvedValueOnce({
        rows: []
      });

      const result = await service.retrieveContextBySession(sessionId);

      expect(result).toBeNull();
    });
  });

  describe('updateContext', () => {
    it('should update existing context successfully', async () => {
      const contextId = 'context-to-update';
      const updates = {
        turnCount: 5,
        lastUpdated: new Date(),
        compressionApplied: true
      };

      mockClient.query.mockResolvedValueOnce({
        rowCount: 1
      });

      const result = await service.updateContext(contextId, updates);

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE'),
        expect.arrayContaining([contextId])
      );
    });

    it('should return false for non-existent context update', async () => {
      const contextId = 'non-existent-context';
      const updates = {
        turnCount: 1
      };

      mockClient.query.mockResolvedValueOnce({
        rowCount: 0
      });

      const result = await service.updateContext(contextId, updates);

      expect(result).toBe(false);
    });
  });

  describe('deleteContext', () => {
    it('should delete context successfully', async () => {
      const contextId = 'context-to-delete';

      mockClient.query
        .mockResolvedValueOnce({ command: 'BEGIN' })
        .mockResolvedValueOnce({ rowCount: 3 }) // Delete turns
        .mockResolvedValueOnce({ rowCount: 1 }) // Delete context
        .mockResolvedValueOnce({ command: 'COMMIT' });

      const result = await service.deleteContext(contextId);

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should return false for non-existent context deletion', async () => {
      const contextId = 'non-existent-context';

      mockClient.query
        .mockResolvedValueOnce({ command: 'BEGIN' })
        .mockResolvedValueOnce({ rowCount: 0 }) // Delete turns
        .mockResolvedValueOnce({ rowCount: 0 }) // Delete context
        .mockResolvedValueOnce({ command: 'COMMIT' });

      const result = await service.deleteContext(contextId);

      expect(result).toBe(false);
    });
  });

  describe('cleanupExpiredContexts', () => {
    it('should cleanup expired contexts', async () => {
      const expiredCount = 5;

      mockClient.query
        .mockResolvedValueOnce({ command: 'BEGIN' })
        .mockResolvedValueOnce({ rowCount: 15 }) // Delete expired turns
        .mockResolvedValueOnce({ rowCount: expiredCount }) // Delete expired contexts
        .mockResolvedValueOnce({ command: 'COMMIT' });

      const result = await service.cleanupExpiredContexts();

      expect(result).toBe(expiredCount);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE expires_at < NOW()')
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      const cleanupError = new Error('Cleanup failed');

      mockClient.query
        .mockResolvedValueOnce({ command: 'BEGIN' })
        .mockRejectedValueOnce(cleanupError);

      await expect(service.cleanupExpiredContexts()).rejects.toThrow('Cleanup failed');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getContextStats', () => {
    it('should return context statistics', async () => {
      const mockStats = [
        {
          total_contexts: '10',
          active_contexts: '8',
          expired_contexts: '2',
          avg_turn_count: '3.5',
          total_storage_bytes: '102400'
        }
      ];

      mockClient.query.mockResolvedValueOnce({
        rows: mockStats
      });

      const stats = await service.getContextStats();

      expect(stats).toEqual({
        totalContexts: 10,
        activeContexts: 8,
        expiredContexts: 2,
        avgTurnCount: 3.5,
        totalStorageBytes: 102400
      });
    });
  });

  describe('searchContexts', () => {
    it('should search contexts by query text', async () => {
      const searchQuery = 'resistor component';
      const limit = 5;

      const mockResults = [
        {
          id: 'context-1',
          session_id: 'session-1',
          context_data: JSON.stringify({ conversationThread: [] }),
          cumulative_context: JSON.stringify({}),
          turn_count: 2,
          last_updated: new Date(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
          compression_applied: false,
          relevance_score: 0.85
        }
      ];

      mockClient.query.mockResolvedValueOnce({
        rows: mockResults
      });

      const results = await service.searchContexts(searchQuery, limit);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('context-1');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE'),
        expect.arrayContaining([expect.stringContaining(searchQuery), limit])
      );
    });

    it('should return empty array when no contexts match', async () => {
      const searchQuery = 'non-existent-term';

      mockClient.query.mockResolvedValueOnce({
        rows: []
      });

      const results = await service.searchContexts(searchQuery);

      expect(results).toHaveLength(0);
    });
  });

  describe('connection management', () => {
    it('should properly release client connections on success', async () => {
      const context: ConversationContext = {
        id: 'test-context',
        sessionId: 'test-session',
        conversationThread: [],
        cumulativeContext: {
          extractedEntities: new Map(),
          documentContext: [],
          topicProgression: [],
          keyInsights: [],
          relationshipMap: []
        },
        lastUpdated: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        metadata: {
          createdAt: new Date(),
          turnCount: 0,
          storageSize: 0,
          compressionApplied: false,
          lastAccessedAt: new Date()
        }
      };

      mockClient.query
        .mockResolvedValueOnce({ command: 'BEGIN' })
        .mockResolvedValueOnce({ rows: [{ id: context.id }] })
        .mockResolvedValueOnce({ command: 'COMMIT' });

      await service.storeContext(context);

      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('should properly release client connections on error', async () => {
      const contextId = 'error-context';
      const dbError = new Error('Database error');

      mockClient.query.mockRejectedValueOnce(dbError);

      await expect(service.retrieveContext(contextId)).rejects.toThrow();

      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });
});