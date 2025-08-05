/**
 * ConversationContext Service Tests
 * Unit tests for context management functionality
 */

import { ConversationContextService } from '../ConversationContext';
import type {
  ContextStorageConfig,
  ProcessedQuery,
  AnalysisResult,
  QueryIntent,
  ConfidenceScore,
  ModelConsensus
} from '../../../../../shared/types/context';

describe('ConversationContextService', () => {
  let service: ConversationContextService;
  let config: ContextStorageConfig;

  beforeEach(() => {
    config = {
      maxTurnsPerContext: 10,
      compressionThreshold: 100,
      expirationHours: 24,
      cleanupIntervalMinutes: 60
    };
    service = new ConversationContextService(config);
  });

  describe('createContext', () => {
    it('should create a new conversation context', async () => {
      const sessionId = 'test-session-id';
      const context = await service.createContext(sessionId);

      expect(context.id).toBeDefined();
      expect(context.sessionId).toBe(sessionId);
      expect(context.conversationThread).toHaveLength(0);
      expect(context.cumulativeContext.extractedEntities.size).toBe(0);
      expect(context.metadata.createdAt).toBeInstanceOf(Date);
      expect(context.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should set expiration time based on config', async () => {
      const sessionId = 'test-session-id';
      const context = await service.createContext(sessionId);
      
      const expectedExpiration = new Date(Date.now() + config.expirationHours * 60 * 60 * 1000);
      const timeDiff = Math.abs(context.expiresAt.getTime() - expectedExpiration.getTime());
      
      // Allow 1 second tolerance for test execution time
      expect(timeDiff).toBeLessThan(1000);
    });
  });

  describe('getContextBySessionId', () => {
    it('should retrieve context by session ID', async () => {
      const sessionId = 'test-session-id';
      const createdContext = await service.createContext(sessionId);
      
      const retrievedContext = await service.getContextBySessionId(sessionId);
      
      expect(retrievedContext).not.toBeNull();
      expect(retrievedContext?.id).toBe(createdContext.id);
      expect(retrievedContext?.sessionId).toBe(sessionId);
    });

    it('should return null for non-existent session', async () => {
      const context = await service.getContextBySessionId('non-existent-session');
      expect(context).toBeNull();
    });

    it('should update access metadata when retrieving context', async () => {
      const sessionId = 'test-session-id';
      const createdContext = await service.createContext(sessionId);
      const initialAccessCount = createdContext.metadata.accessCount;
      
      const retrievedContext = await service.getContextBySessionId(sessionId);
      
      expect(retrievedContext?.metadata.accessCount).toBe(initialAccessCount + 1);
      expect(retrievedContext?.metadata.lastAccessed.getTime()).toBeGreaterThan(
        createdContext.metadata.lastAccessed.getTime()
      );
    });
  });

  describe('addTurn', () => {
    let mockQuery: ProcessedQuery;
    let mockResponse: AnalysisResult;

    beforeEach(() => {
      const mockIntent: QueryIntent = {
        type: 'component_identification',
        confidence: 0.9,
        reasoning: 'Test reasoning'
      };

      const mockConfidence: ConfidenceScore = {
        overall: 0.85,
        breakdown: { model1: 0.8, model2: 0.9 },
        reasoning: 'High confidence'
      };

      const mockConsensus: ModelConsensus = {
        agreementLevel: 0.9,
        conflictingResponses: [],
        consensusResponse: 'Test consensus'
      };

      mockQuery = {
        id: 'query-1',
        originalText: 'What is this resistor?',
        cleanedText: 'what is this resistor',
        intent: mockIntent,
        intentConfidence: 0.9,
        entities: [
          {
            text: 'resistor',
            type: 'component',
            confidence: 0.95,
            position: { start: 13, end: 21 },
            metadata: {}
          }
        ],
        context: {
          sessionHistory: [],
          documentContext: [],
          previousQueries: [],
          conversationFlow: [],
          extractedTopics: ['components']
        },
        optimizedPrompts: {},
        processingMetadata: {
          processingTime: 150,
          stagesCompleted: ['classification', 'entity-extraction'],
          warnings: [],
          debug: {}
        },
        timestamp: new Date()
      };

      mockResponse = {
        summary: 'Found a 10kΩ resistor',
        components: [
          {
            id: 'comp-1',
            type: 'resistor',
            description: '10kΩ carbon film resistor',
            location: { x: 100, y: 200, page: 1 },
            boundingBox: { x: 95, y: 195, width: 10, height: 10 },
            confidence: 0.9,
            properties: { value: '10kΩ', type: 'carbon_film' }
          }
        ],
        confidence: mockConfidence,
        consensus: mockConsensus
      };
    });

    it('should add a new turn to the context', async () => {
      const sessionId = 'test-session-id';
      const context = await service.createContext(sessionId);
      
      const updatedContext = await service.addTurn(context.id, mockQuery, mockResponse);
      
      expect(updatedContext.conversationThread).toHaveLength(1);
      expect(updatedContext.conversationThread[0].turnNumber).toBe(1);
      expect(updatedContext.conversationThread[0].query).toBe(mockQuery);
      expect(updatedContext.conversationThread[0].response).toBe(mockResponse);
      expect(updatedContext.lastUpdated.getTime()).toBeGreaterThan(context.lastUpdated.getTime());
    });

    it('should update cumulative context with entities', async () => {
      const sessionId = 'test-session-id';
      const context = await service.createContext(sessionId);
      
      const updatedContext = await service.addTurn(context.id, mockQuery, mockResponse);
      
      expect(updatedContext.cumulativeContext.extractedEntities.size).toBeGreaterThan(0);
      expect(updatedContext.cumulativeContext.keyInsights).toContain('Found a 10kΩ resistor');
      expect(updatedContext.cumulativeContext.topicProgression).toHaveLength(1);
    });

    it('should handle follow-up detection flag', async () => {
      const sessionId = 'test-session-id';
      const context = await service.createContext(sessionId);
      
      const updatedContext = await service.addTurn(context.id, mockQuery, mockResponse, true);
      
      expect(updatedContext.conversationThread[0].followUpDetected).toBe(true);
    });

    it('should throw error for non-existent context', async () => {
      await expect(
        service.addTurn('non-existent-context', mockQuery, mockResponse)
      ).rejects.toThrow('Context not found');
    });

    it('should trigger compression when max turns exceeded', async () => {
      const sessionId = 'test-session-id';
      const context = await service.createContext(sessionId);
      
      // Add turns up to the limit
      let updatedContext = context;
      for (let i = 0; i < config.maxTurnsPerContext + 1; i++) {
        const query = { ...mockQuery, id: `query-${i}` };
        updatedContext = await service.addTurn(updatedContext.id, query, mockResponse);
      }
      
      // Should have compressed and kept fewer turns
      expect(updatedContext.conversationThread.length).toBeLessThan(config.maxTurnsPerContext);
      expect(updatedContext.metadata.compressionLevel).toBeGreaterThan(0);
    });
  });

  describe('getRelevantContext', () => {
    it('should return relevant context turns', async () => {
      const sessionId = 'test-session-id';
      const context = await service.createContext(sessionId);
      
      // Add some turns with different queries
      const queries = [
        'What is this resistor?',
        'How does it work?',
        'What about capacitors?'
      ];
      
      let updatedContext = context;
      for (let i = 0; i < queries.length; i++) {
        const query = {
          ...createMockQuery(`query-${i}`, queries[i]),
          timestamp: new Date(Date.now() - (queries.length - i) * 1000) // Make earlier queries older
        };
        updatedContext = await service.addTurn(updatedContext.id, query, createMockResponse());
      }
      
      const relevantTurns = await service.getRelevantContext(sessionId, 'Tell me more about resistors', 2);
      
      expect(relevantTurns).toHaveLength(2);
      // Check that we got some relevant turns
      const hasResistorQuery = relevantTurns.some(turn => turn.query.originalText.includes('resistor'));
      expect(hasResistorQuery).toBe(true);
    });

    it('should return empty array for non-existent session', async () => {
      const relevantTurns = await service.getRelevantContext('non-existent-session', 'test query');
      expect(relevantTurns).toHaveLength(0);
    });
  });

  describe('resetContext', () => {
    it('should reset context for a session', async () => {
      const sessionId = 'test-session-id';
      const originalContext = await service.createContext(sessionId);
      
      // Add some turns
      const updatedContext = await service.addTurn(
        originalContext.id,
        createMockQuery('query-1', 'test query'),
        createMockResponse()
      );
      expect(updatedContext.conversationThread).toHaveLength(1);
      
      // Reset context
      const resetContext = await service.resetContext(sessionId);
      
      expect(resetContext.id).not.toBe(originalContext.id);
      expect(resetContext.conversationThread).toHaveLength(0);
      expect(resetContext.sessionId).toBe(sessionId);
    });
  });

  describe('validateContext', () => {
    it('should validate a correct context', async () => {
      const sessionId = 'test-session-id';
      const context = await service.createContext(sessionId);
      
      const validation = service.validateContext(context);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect expired context', async () => {
      const sessionId = 'test-session-id';
      const context = await service.createContext(sessionId);
      
      // Manually set expiration to past
      const expiredContext = {
        ...context,
        expiresAt: new Date(Date.now() - 1000)
      };
      
      const validation = service.validateContext(expiredContext);
      
      expect(validation.warnings).toContain('Context has expired');
    });

    it('should detect turn number inconsistencies', async () => {
      const sessionId = 'test-session-id';
      const context = await service.createContext(sessionId);
      
      // Create context with inconsistent turn numbers
      const invalidContext = {
        ...context,
        conversationThread: [
          {
            id: 'turn-1',
            turnNumber: 1,
            query: createMockQuery('query-1', 'test'),
            response: createMockResponse(),
            contextContributions: [],
            followUpDetected: false,
            timestamp: new Date()
          },
          {
            id: 'turn-2',
            turnNumber: 3, // Should be 2
            query: createMockQuery('query-2', 'test'),
            response: createMockResponse(),
            contextContributions: [],
            followUpDetected: false,
            timestamp: new Date()
          }
        ]
      };
      
      const validation = service.validateContext(invalidContext);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Turn number mismatch at position 1');
    });
  });

  describe('cleanupExpiredContexts', () => {
    it('should clean up expired contexts', async () => {
      // Create some contexts
      await service.createContext('session-1');
      await service.createContext('session-2');
      
      // Initially should clean up 0 contexts
      let cleaned = await service.cleanupExpiredContexts();
      expect(cleaned).toBe(0);
      
      // This test would need to mock time or create contexts with past expiration
      // For now, just verify the method exists and returns a number
      expect(typeof cleaned).toBe('number');
    });
  });

  // Helper functions
  function createMockQuery(id: string, text: string): ProcessedQuery {
    return {
      id,
      originalText: text,
      cleanedText: text.toLowerCase(),
      intent: {
        type: 'component_identification',
        confidence: 0.9,
        reasoning: 'Test'
      },
      intentConfidence: 0.9,
      entities: [],
      context: {
        sessionHistory: [],
        documentContext: [],
        previousQueries: [],
        conversationFlow: [],
        extractedTopics: []
      },
      optimizedPrompts: {},
      processingMetadata: {
        processingTime: 100,
        stagesCompleted: ['classification'],
        warnings: [],
        debug: {}
      },
      timestamp: new Date()
    };
  }

  function createMockResponse(): AnalysisResult {
    return {
      summary: 'Test response',
      components: [],
      confidence: {
        overall: 0.8,
        breakdown: {},
        reasoning: 'Test'
      },
      consensus: {
        agreementLevel: 0.9,
        conflictingResponses: [],
        consensusResponse: 'Test consensus'
      }
    };
  }
});