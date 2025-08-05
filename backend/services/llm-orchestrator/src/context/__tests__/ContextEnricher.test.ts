/**
 * ContextEnricher Test Suite
 * Comprehensive unit tests for context enrichment and retrieval functionality
 */

import { ContextEnricher } from '../ContextEnricher';
import {
  ConversationContext,
  ConversationTurn,
  ContextRetrievalRequest,
  ProcessedQuery,
  AnalysisResult
} from '../../../../../shared/types/context';

describe('ContextEnricher', () => {
  let contextEnricher: ContextEnricher;
  let mockConversationContext: ConversationContext;
  let mockTurns: ConversationTurn[];

  beforeEach(() => {
    contextEnricher = new ContextEnricher();

    // Create mock conversation turns
    mockTurns = [
      {
        id: 'turn-1',
        turnNumber: 1,
        query: {
          id: 'query-1',
          text: 'What type of resistor is shown in the circuit?',
          type: 'component_identification',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          documentIds: ['doc-1'],
          processedText: 'What type of resistor is shown in the circuit?',
          extractedEntities: [] as any,
          intent: 'component_identification',
          confidence: 0.9
        } as unknown as ProcessedQuery,
        response: {
          summary: 'Identified a 10kΩ carbon film resistor with 5% tolerance',
          components: [],
          confidence: { overall: 0.85, breakdown: {}, reasoning: 'High confidence identification' },
          consensus: { agreementLevel: 0.9, conflictingResponses: [], consensusResponse: 'Resistor identified' }
        } as AnalysisResult,
        contextContributions: ['resistor identification'],
        followUpDetected: false,
        timestamp: new Date('2024-01-01T10:00:00Z')
      },
      {
        id: 'turn-2',
        turnNumber: 2,
        query: {
          id: 'query-2',
          text: 'What is the power rating of that resistor?',
          type: 'component_identification',
          timestamp: new Date('2024-01-01T10:01:00Z'),
          documentIds: ['doc-1'],
          processedText: 'What is the power rating of that resistor?',
          extractedEntities: [] as any,
          intent: 'component_identification',
          confidence: 0.8
        } as unknown as ProcessedQuery,
        response: {
          summary: 'The resistor has a power rating of 0.25W (1/4 watt)',
          components: [],
          confidence: { overall: 0.9, breakdown: {}, reasoning: 'Clear power rating identification' },
          consensus: { agreementLevel: 0.95, conflictingResponses: [], consensusResponse: 'Power rating confirmed' }
        } as AnalysisResult,
        contextContributions: ['power rating'],
        followUpDetected: true,
        timestamp: new Date('2024-01-01T10:01:00Z')
      },
      {
        id: 'turn-3',
        turnNumber: 3,
        query: {
          id: 'query-3',
          text: 'Is there a capacitor in this circuit?',
          type: 'component_identification',
          timestamp: new Date('2024-01-01T10:02:00Z'),
          documentIds: ['doc-1'],
          processedText: 'Is there a capacitor in this circuit?',
          extractedEntities: [] as any,
          intent: 'component_identification',
          confidence: 0.7
        } as unknown as ProcessedQuery,
        response: {
          summary: 'Yes, there is a 100µF electrolytic capacitor connected in parallel',
          components: [],
          confidence: { overall: 0.8, breakdown: {}, reasoning: 'Capacitor clearly visible' },
          consensus: { agreementLevel: 0.85, conflictingResponses: [], consensusResponse: 'Capacitor identified' }
        } as AnalysisResult,
        contextContributions: ['capacitor identification'],
        followUpDetected: false,
        timestamp: new Date('2024-01-01T10:02:00Z')
      }
    ];

    mockConversationContext = {
      id: 'context-1',
      sessionId: 'session-1',
      conversationThread: mockTurns,
      cumulativeContext: {
        extractedEntities: new Map(),
        documentContext: [],
        topicProgression: [],
        keyInsights: [],
        relationshipMap: []
      },
      lastUpdated: new Date('2024-01-01T10:02:00Z'),
      expiresAt: new Date('2024-01-01T18:00:00Z'),
      metadata: {
        createdAt: new Date('2024-01-01T10:00:00Z'),
        lastAccessed: new Date('2024-01-01T10:02:00Z'),
        accessCount: 3,
        compressionLevel: 0,
        tags: ['electrical_analysis']
      }
    };
  });

  describe('buildCumulativeContext', () => {
    it('should extract entities from conversation turns', () => {
      const result = contextEnricher.buildCumulativeContext(mockTurns);

      expect(result.extractedEntities).toBeDefined();
      expect(result.extractedEntities.size).toBeGreaterThan(0);
      
      // Should extract electrical components
      expect(result.extractedEntities.has('resistor')).toBe(true);
      expect(result.extractedEntities.has('capacitor')).toBe(true);
    });

    it('should build document context from turns with document IDs', () => {
      const result = contextEnricher.buildCumulativeContext(mockTurns);

      expect(result.documentContext).toBeDefined();
      expect(result.documentContext.length).toBe(1);
      expect(result.documentContext[0].documentId).toBe('doc-1');
      expect(result.documentContext[0].keyFindings.length).toBeGreaterThan(0);
    });

    it('should create topic progression from conversation flow', () => {
      const result = contextEnricher.buildCumulativeContext(mockTurns);

      expect(result.topicProgression).toBeDefined();
      expect(result.topicProgression.length).toBeGreaterThan(0);
    });

    it('should extract key insights from high-confidence responses', () => {
      const result = contextEnricher.buildCumulativeContext(mockTurns);

      expect(result.keyInsights).toBeDefined();
      expect(result.keyInsights.length).toBeGreaterThan(0);
    });

    it('should build relationship map between co-occurring entities', () => {
      const result = contextEnricher.buildCumulativeContext(mockTurns);

      expect(result.relationshipMap).toBeDefined();
      expect(result.relationshipMap.length).toBeGreaterThan(0);
      expect(result.relationshipMap[0].relationship).toBe('co_occurrence');
    });
  });

  describe('retrieveRelevantContext', () => {
    let mockRequest: ContextRetrievalRequest;

    beforeEach(() => {
      mockRequest = {
        currentQuery: 'What components are connected in series?',
        sessionId: 'session-1',
        maxContextTurns: 5,
        relevanceThreshold: 0.3,
        contextTypes: ['entity', 'topic']
      };
    });

    it('should return relevant context scores above threshold', async () => {
      const result = await contextEnricher.retrieveRelevantContext(mockRequest, mockConversationContext);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.every(score => score.combinedScore >= mockRequest.relevanceThreshold)).toBe(true);
    });

    it('should sort results by combined score in descending order', async () => {
      const result = await contextEnricher.retrieveRelevantContext(mockRequest, mockConversationContext);

      if (result.length > 1) {
        for (let i = 1; i < result.length; i++) {
          expect(result[i - 1].combinedScore).toBeGreaterThanOrEqual(result[i].combinedScore);
        }
      }
    });

    it('should include matching concepts in relevance scores', async () => {
      const result = await contextEnricher.retrieveRelevantContext(mockRequest, mockConversationContext);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].matchingConcepts).toBeDefined();
      expect(Array.isArray(result[0].matchingConcepts)).toBe(true);
    });

    it('should respect maxContextTurns limit', async () => {
      const limitedRequest = { ...mockRequest, maxContextTurns: 2 };
      const result = await contextEnricher.retrieveRelevantContext(limitedRequest, mockConversationContext);

      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should apply recency decay to older turns', async () => {
      const result = await contextEnricher.retrieveRelevantContext(mockRequest, mockConversationContext);

      // More recent turns should have higher recency scores
      const sortedByTurn = result.sort((a, b) => 
        parseInt(b.turnId.split('-')[1]) - parseInt(a.turnId.split('-')[1])
      );

      if (sortedByTurn.length > 1) {
        expect(sortedByTurn[0].recencyScore).toBeGreaterThanOrEqual(sortedByTurn[1].recencyScore);
      }
    });
  });

  describe('enhanceQueryWithContext', () => {
    let mockRelevantContext: any[];

    beforeEach(() => {
      mockRelevantContext = [
        {
          contextId: 'turn-1',
          turnId: 'turn-1',
          relevanceScore: 0.8,
          recencyScore: 0.9,
          combinedScore: 0.83,
          matchingConcepts: ['component_identification']
        },
        {
          contextId: 'turn-2',
          turnId: 'turn-2',
          relevanceScore: 0.7,
          recencyScore: 0.85,
          combinedScore: 0.745,
          matchingConcepts: ['component_identification']
        }
      ];
    });

    it('should enhance query with relevant context', async () => {
      const originalQuery = 'What is the voltage across the component?';
      const result = await contextEnricher.enhanceQueryWithContext(
        originalQuery,
        mockRelevantContext,
        mockConversationContext
      );

      expect(result.originalQuery).toBe(originalQuery);
      expect(result.enhancedQuery).toContain(originalQuery);
      expect(result.enhancedQuery.length).toBeGreaterThan(originalQuery.length);
    });

    it('should include context sources in the result', async () => {
      const result = await contextEnricher.enhanceQueryWithContext(
        'Test query',
        mockRelevantContext,
        mockConversationContext
      );

      expect(result.contextSources).toBeDefined();
      expect(result.contextSources.length).toBe(mockRelevantContext.length);
      expect(result.contextSources[0].turnId).toBe('turn-1');
    });

    it('should extract relevant entities from context', async () => {
      // Set up cumulative context with entities
      const cumulativeContext = contextEnricher.buildCumulativeContext(mockTurns);
      mockConversationContext = {
        ...mockConversationContext,
        cumulativeContext
      };

      const result = await contextEnricher.enhanceQueryWithContext(
        'Test query',
        mockRelevantContext,
        mockConversationContext
      );

      expect(result.relevantEntities).toBeDefined();
      expect(Array.isArray(result.relevantEntities)).toBe(true);
    });

    it('should calculate enhancement confidence', async () => {
      const result = await contextEnricher.enhanceQueryWithContext(
        'Test query',
        mockRelevantContext,
        mockConversationContext
      );

      expect(result.confidence).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should limit context to prevent prompt bloat', async () => {
      // Create many high-relevance context sources using existing turn IDs
      const manyContextSources = Array.from({ length: 10 }, (_, i) => ({
        contextId: `turn-${(i % 3) + 1}`, // Cycle through turn-1, turn-2, turn-3
        turnId: `turn-${(i % 3) + 1}`,
        relevanceScore: 0.9,
        recencyScore: 0.8,
        combinedScore: 0.87,
        matchingConcepts: ['test']
      }));

      const result = await contextEnricher.enhanceQueryWithContext(
        'Test query',
        manyContextSources,
        mockConversationContext
      );

      // Should not include all context sources to prevent bloat
      const contextMatches = result.enhancedQuery.match(/\[Previous context:/g);
      expect(contextMatches ? contextMatches.length : 0).toBeLessThanOrEqual(1);
    });
  });

  describe('mergeRelatedContexts', () => {
    let additionalContext: ConversationContext;

    beforeEach(() => {
      additionalContext = {
        ...mockConversationContext,
        id: 'context-2',
        conversationThread: [
          {
            id: 'turn-4',
            turnNumber: 4,
            query: {
              id: 'query-4',
              text: 'What is the total impedance?',
              type: 'schematic_analysis',
              timestamp: new Date('2024-01-01T10:03:00Z'),
              documentIds: ['doc-2']
            } as unknown as ProcessedQuery,
            response: {
              summary: 'Total impedance is 15.2Ω at 60Hz',
              components: [],
              confidence: { overall: 0.88, breakdown: {}, reasoning: 'Clear calculation' },
              consensus: { agreementLevel: 0.9, conflictingResponses: [], consensusResponse: 'Impedance calculated' }
            } as AnalysisResult,
            contextContributions: ['impedance calculation'],
            followUpDetected: false,
            timestamp: new Date('2024-01-01T10:03:00Z')
          }
        ]
      };
    });

    it('should merge multiple conversation contexts', () => {
      const result = contextEnricher.mergeRelatedContexts([mockConversationContext, additionalContext]);

      expect(result).toBeDefined();
      expect(result.conversationThread.length).toBe(4);
    });

    it('should maintain chronological order after merge', () => {
      const result = contextEnricher.mergeRelatedContexts([mockConversationContext, additionalContext]);

      const timestamps = result.conversationThread.map(turn => turn.timestamp.getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });

    it('should renumber turns sequentially after merge', () => {
      const result = contextEnricher.mergeRelatedContexts([mockConversationContext, additionalContext]);

      const turnNumbers = result.conversationThread.map(turn => turn.turnNumber);
      expect(turnNumbers).toEqual([1, 2, 3, 4]);
    });

    it('should handle single context without error', () => {
      const result = contextEnricher.mergeRelatedContexts([mockConversationContext]);

      expect(result).toEqual(mockConversationContext);
    });

    it('should throw error for empty context array', () => {
      expect(() => contextEnricher.mergeRelatedContexts([])).toThrow('Cannot merge empty context array');
    });
  });

  describe('validateContext', () => {
    it('should validate a well-formed context', () => {
      const result = contextEnricher.validateContext(mockConversationContext);

      expect(result.isValid).toBe(true);
      expect(result.validationErrors).toEqual([]);
      expect(result.inconsistencies.length).toBe(0);
    });

    it('should detect missing required fields', () => {
      const invalidContext = { ...mockConversationContext, id: '' };

      const result = contextEnricher.validateContext(invalidContext);

      expect(result.isValid).toBe(false);
      expect(result.validationErrors).toContain('Missing required context identifiers');
    });

    it('should detect empty conversation thread', () => {
      const invalidContext = { ...mockConversationContext, conversationThread: [] };

      const result = contextEnricher.validateContext(invalidContext);

      expect(result.isValid).toBe(false);
      expect(result.validationErrors).toContain('Empty conversation thread');
    });

    it('should detect turn sequence gaps', () => {
      const contextWithGap = {
        ...mockConversationContext,
        conversationThread: [
          { ...mockTurns[0], turnNumber: 1 },
          { ...mockTurns[1], turnNumber: 3 }, // Gap: missing turn 2
          { ...mockTurns[2], turnNumber: 4 }
        ]
      };

      const result = contextEnricher.validateContext(contextWithGap);

      expect(result.inconsistencies.some(inc => inc.includes('Turn sequence gap'))).toBe(true);
    });

    it('should detect timestamp order violations', () => {
      const contextWithBadTimestamps = {
        ...mockConversationContext,
        conversationThread: [
          { ...mockTurns[0], timestamp: new Date('2024-01-01T10:02:00Z') },
          { ...mockTurns[1], timestamp: new Date('2024-01-01T10:01:00Z') }, // Earlier than previous
          { ...mockTurns[2], timestamp: new Date('2024-01-01T10:03:00Z') }
        ]
      };

      const result = contextEnricher.validateContext(contextWithBadTimestamps);

      expect(result.inconsistencies.some(inc => inc.includes('Timestamp order violation'))).toBe(true);
    });

    it('should provide detailed validation results', () => {
      const result = contextEnricher.validateContext(mockConversationContext);

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('validationErrors');
      expect(result).toHaveProperty('inconsistencies');
      expect(Array.isArray(result.validationErrors)).toBe(true);
      expect(Array.isArray(result.inconsistencies)).toBe(true);
    });
  });

  describe('entity extraction and processing', () => {
    it('should extract electrical components from text', () => {
      const result = contextEnricher.buildCumulativeContext(mockTurns);

      expect(result.extractedEntities.has('resistor')).toBe(true);
      expect(result.extractedEntities.has('capacitor')).toBe(true);
    });

    it('should extract measurements with units', () => {
      const result = contextEnricher.buildCumulativeContext(mockTurns);

      // Should extract measurements like "10kΩ", "0.25W", "100µF"
      const allEntities = Array.from(result.extractedEntities.keys());
      const hasMeasurements = allEntities.some(entity => 
        /\d+(\.\d+)?\s*(k?Ω|W|µF)/i.test(entity)
      );
      expect(hasMeasurements).toBe(true);
    });

    it('should track entity mentions across turns', () => {
      const result = contextEnricher.buildCumulativeContext(mockTurns);

      const resistorMentions = result.extractedEntities.get('resistor');
      expect(resistorMentions).toBeDefined();
      expect(resistorMentions!.length).toBeGreaterThan(0);
      expect(resistorMentions![0]).toHaveProperty('turnId');
      expect(resistorMentions![0]).toHaveProperty('position');
    });
  });

  describe('performance and memory considerations', () => {
    it('should handle large conversation contexts efficiently', () => {
      // Create a large number of turns
      const largeTurns = Array.from({ length: 100 }, (_, i) => ({
        ...mockTurns[0],
        id: `turn-${i}`,
        turnNumber: i + 1,
        timestamp: new Date(Date.now() + i * 1000)
      }));

      const startTime = Date.now();
      const result = contextEnricher.buildCumulativeContext(largeTurns);
      const processingTime = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(processingTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should limit context retrieval for performance', async () => {
      const largeContext = {
        ...mockConversationContext,
        conversationThread: Array.from({ length: 50 }, (_, i) => ({
          ...mockTurns[0],
          id: `turn-${i}`,
          turnNumber: i + 1
        }))
      };

      const request: ContextRetrievalRequest = {
        currentQuery: 'test query',
        sessionId: 'session-1',
        maxContextTurns: 10,
        relevanceThreshold: 0.1,
        contextTypes: ['entity']
      };

      const result = await contextEnricher.retrieveRelevantContext(request, largeContext);

      expect(result.length).toBeLessThanOrEqual(10);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty query strings gracefully', async () => {
      const request: ContextRetrievalRequest = {
        currentQuery: '',
        sessionId: 'session-1',
        maxContextTurns: 5,
        relevanceThreshold: 0.3,
        contextTypes: ['entity']
      };

      const result = await contextEnricher.retrieveRelevantContext(request, mockConversationContext);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle contexts with no turns', () => {
      const result = contextEnricher.buildCumulativeContext([]);

      expect(result.extractedEntities.size).toBe(0);
      expect(result.documentContext.length).toBe(0);
      expect(result.topicProgression.length).toBe(0);
      expect(result.keyInsights.length).toBe(0);
      expect(result.relationshipMap.length).toBe(0);
    });

    it('should handle malformed turn data', () => {
      const malformedTurns = [
        {
          ...mockTurns[0],
          query: { ...mockTurns[0].query, text: '' }, // Empty query text
          response: { ...mockTurns[0].response, summary: '' } // Empty summary
        }
      ];

      expect(() => contextEnricher.buildCumulativeContext(malformedTurns)).not.toThrow();
    });

    it('should handle missing context turn references gracefully', async () => {
      const invalidRelevantContext = [
        {
          contextId: 'nonexistent-turn',
          turnId: 'nonexistent-turn',
          relevanceScore: 0.8,
          recencyScore: 0.9,
          combinedScore: 0.83,
          matchingConcepts: ['test']
        }
      ];

      await expect(contextEnricher.enhanceQueryWithContext(
        'test query',
        invalidRelevantContext,
        mockConversationContext
      )).rejects.toThrow('Turn not found');
    });
  });
});