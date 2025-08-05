/**
 * FollowUpDetector Service Tests
 * Unit tests for follow-up query detection functionality
 */

import { FollowUpDetectorService, defaultFollowUpConfig, FollowUpDetectionConfig } from '../FollowUpDetector';
import type {
  ProcessedQuery,
  ConversationTurn,
  AnalysisResult,
  QueryIntent,
  ConfidenceScore,
  ModelConsensus
} from '../../../../../shared/types/context';

describe('FollowUpDetectorService', () => {
  let service: FollowUpDetectorService;
  let config: FollowUpDetectionConfig;

  beforeEach(() => {
    config = { ...defaultFollowUpConfig };
    service = new FollowUpDetectorService(config);
  });

  describe('detectFollowUp', () => {
    it('should return low confidence for queries with no conversation history', async () => {
      const query = createMockQuery('What is this resistor?');
      
      const result = await service.detectFollowUp(query, []);
      
      expect(result.confidence).toBe(0);
      expect(result.detectedReferences).toHaveLength(0);
      expect(result.detectionReasoning).toContain('No conversation history');
    });

    it('should detect pronoun references', async () => {
      const previousTurn = createMockTurn('What is this resistor?', 'This is a 10kΩ resistor');
      const currentQuery = createMockQuery('What is its resistance value?');
      
      const result = await service.detectFollowUp(currentQuery, [previousTurn]);
      
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.detectedReferences.some(ref => ref.type === 'pronoun')).toBe(true);
      expect(result.detectionReasoning).toContain('pronoun reference');
    });

    it('should detect temporal references', async () => {
      const previousTurn = createMockTurn('Analyze this circuit', 'Found several components');
      const currentQuery = createMockQuery('What happened before that?');
      
      const result = await service.detectFollowUp(currentQuery, [previousTurn]);
      
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.detectedReferences.some(ref => ref.type === 'temporal')).toBe(true);
      expect(result.detectionReasoning).toContain('temporal reference');
    });

    it('should detect implicit references', async () => {
      const previousTurn = createMockTurn('Show me the capacitors', 'Found three capacitors');
      const currentQuery = createMockQuery('Also show me the resistors');
      
      const result = await service.detectFollowUp(currentQuery, [previousTurn]);
      
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.detectedReferences.some(ref => ref.type === 'implicit')).toBe(true);
      expect(result.detectionReasoning).toContain('implicit reference');
    });

    it('should detect spatial references', async () => {
      const previousTurn = createMockTurn('Identify this component', 'Found a transistor');
      const currentQuery = createMockQuery('What is next to it?');
      
      const result = await service.detectFollowUp(currentQuery, [previousTurn]);
      
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.detectedReferences.some(ref => ref.type === 'spatial')).toBe(true);
      expect(result.detectionReasoning).toContain('spatial reference');
    });

    it('should detect incomplete questions', async () => {
      const previousTurn = createMockTurn('What is this?', 'This is a resistor');
      const currentQuery = createMockQuery('And this?');
      
      const result = await service.detectFollowUp(currentQuery, [previousTurn]);
      
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.detectionReasoning).toContain('incomplete');
    });

    it('should detect confirmation requests', async () => {
      const previousTurn = createMockTurn('Is this a resistor?', 'Yes, it appears to be a resistor');
      const currentQuery = createMockQuery('Is that correct?');
      
      const result = await service.detectFollowUp(currentQuery, [previousTurn]);
      
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.detectionReasoning).toContain('confirmation');
    });

    it('should enrich query with context when references are found', async () => {
      const previousTurn = createMockTurn('What is this resistor?', 'This is a 10kΩ carbon resistor');
      const currentQuery = createMockQuery('What is its power rating?');
      
      const result = await service.detectFollowUp(currentQuery, [previousTurn]);
      
      expect(result.contextualEnrichment).not.toBe(result.originalQuery);
      // The enrichment should contain some context reference
      expect(result.contextualEnrichment.length).toBeGreaterThan(result.originalQuery.length);
    });

    it('should handle multiple reference types in one query', async () => {
      const previousTurn = createMockTurn('Analyze this circuit', 'Found resistors and capacitors');
      const currentQuery = createMockQuery('Also, what about those components over there?');
      
      const result = await service.detectFollowUp(currentQuery, [previousTurn]);
      
      // Should detect "also" (implicit) and "those" (pronoun) and "there" (spatial)
      expect(result.detectedReferences.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('should limit lookback to configured number of turns', async () => {
      const turns = [
        createMockTurn('Query 1', 'Response 1'),
        createMockTurn('Query 2', 'Response 2'),
        createMockTurn('Query 3', 'Response 3'),
        createMockTurn('Query 4', 'Response 4'),
        createMockTurn('Query 5', 'Response 5')
      ];
      
      const currentQuery = createMockQuery('What about that component?');
      
      const result = await service.detectFollowUp(currentQuery, turns);
      
      // Should only consider the last 3 turns (maxLookbackTurns = 3)
      expect(result).toBeDefined();
    });
  });

  describe('shouldApplyFallback', () => {
    it('should recommend fallback for low confidence results', () => {
      const lowConfidenceResult = {
        originalQuery: 'Test query',
        detectedReferences: [],
        contextualEnrichment: 'Test query',
        confidence: 0.3, // Below threshold
        detectionReasoning: 'Low confidence'
      };
      
      expect(service.shouldApplyFallback(lowConfidenceResult)).toBe(true);
    });

    it('should not recommend fallback for high confidence results', () => {
      const highConfidenceResult = {
        originalQuery: 'Test query',
        detectedReferences: [],
        contextualEnrichment: 'Test query',
        confidence: 0.8, // Above threshold
        detectionReasoning: 'High confidence'
      };
      
      expect(service.shouldApplyFallback(highConfidenceResult)).toBe(false);
    });
  });

  describe('applyFallbackHandling', () => {
    it('should apply fallback handling to uncertain results', async () => {
      const uncertainResult = {
        originalQuery: 'Test query',
        detectedReferences: [],
        contextualEnrichment: 'Enhanced query',
        confidence: 0.3,
        detectionReasoning: 'Uncertain detection'
      };
      
      const fallbackResult = await service.applyFallbackHandling(uncertainResult);
      
      expect(fallbackResult.contextualEnrichment).toBe(uncertainResult.originalQuery);
      expect(fallbackResult.detectionReasoning).toContain('Applied fallback');
    });
  });

  describe('edge cases', () => {
    it('should handle empty query text gracefully', async () => {
      const emptyQuery = createMockQuery('');
      const previousTurn = createMockTurn('Previous query', 'Previous response');
      
      const result = await service.detectFollowUp(emptyQuery, [previousTurn]);
      
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.originalQuery).toBe('');
    });

    it('should handle queries with only whitespace', async () => {
      const whitespaceQuery = createMockQuery('   ');
      const previousTurn = createMockTurn('Previous query', 'Previous response');
      
      const result = await service.detectFollowUp(whitespaceQuery, [previousTurn]);
      
      expect(result.confidence).toBeLessThan(0.5);
    });

    it('should handle queries with special characters', async () => {
      const specialQuery = createMockQuery('What about this??? !@#$%');
      const previousTurn = createMockTurn('Previous query', 'Previous response');
      
      const result = await service.detectFollowUp(specialQuery, [previousTurn]);
      
      expect(result).toBeDefined();
      expect(result.originalQuery).toBe('What about this??? !@#$%');
    });
  });

  describe('performance', () => {
    it('should handle large conversation histories efficiently', async () => {
      // Create 100 conversation turns
      const largeTurns = Array.from({ length: 100 }, (_, i) => 
        createMockTurn(`Query ${i}`, `Response ${i}`)
      );
      
      const currentQuery = createMockQuery('What about that component?');
      
      const startTime = Date.now();
      const result = await service.detectFollowUp(currentQuery, largeTurns);
      const endTime = Date.now();
      
      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });
  });

  // Helper functions
  function createMockQuery(text: string): ProcessedQuery {
    const mockIntent: QueryIntent = {
      type: 'component_identification',
      confidence: 0.9,
      reasoning: 'Test intent'
    };

    return {
      id: `query-${Date.now()}`,
      originalText: text,
      cleanedText: text.toLowerCase(),
      intent: mockIntent,
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

  function createMockTurn(queryText: string, responseText: string): ConversationTurn {
    const mockConfidence: ConfidenceScore = {
      overall: 0.8,
      breakdown: {},
      reasoning: 'Test confidence'
    };

    const mockConsensus: ModelConsensus = {
      agreementLevel: 0.9,
      conflictingResponses: [],
      consensusResponse: responseText
    };

    const mockResponse: AnalysisResult = {
      summary: responseText,
      components: [],
      confidence: mockConfidence,
      consensus: mockConsensus
    };

    return {
      id: `turn-${Date.now()}-${Math.random()}`,
      turnNumber: 1,
      query: createMockQuery(queryText),
      response: mockResponse,
      contextContributions: [],
      followUpDetected: false,
      timestamp: new Date()
    };
  }
});