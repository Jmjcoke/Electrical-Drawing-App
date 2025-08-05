/**
 * Unit tests for Context Highlight Manager
 * Tests context integration, suggestion generation, and highlight persistence
 */

import { ContextHighlightManager } from '../context-highlight-manager';
import type {
  ComponentHighlight,
  HighlightStyle
} from '../../types/highlighting.types';
import type {
  Query,
  SessionState,
  SessionHighlightContext,
  ComponentSuggestion
} from '../../types/chat';

// Mock the services
const mockAnalyzeResponse = jest.fn();
const mockCreateHighlightReferences = jest.fn();

jest.mock('../response-linker.service', () => ({
  getResponseLinkerService: () => ({
    analyzeResponse: mockAnalyzeResponse,
    createHighlightReferences: mockCreateHighlightReferences
  })
}));

const mockCreateHighlight = jest.fn();
const mockUpdateHighlight = jest.fn();
const mockDeleteHighlight = jest.fn();

jest.mock('../highlighting.service', () => ({
  getHighlightingService: () => ({
    createHighlight: mockCreateHighlight,
    updateHighlight: mockUpdateHighlight,
    deleteHighlight: mockDeleteHighlight
  })
}));

describe('ContextHighlightManager', () => {
  let manager: ContextHighlightManager;
  const mockHighlightStyle: HighlightStyle = {
    color: '#2196F3',
    opacity: 0.8,
    strokeWidth: 2,
    strokeStyle: 'solid',
    fillOpacity: 0.2,
    zIndex: 1
  };

  const mockHighlight: ComponentHighlight = {
    id: 'highlight-1',
    componentId: 'resistor R1',
    type: 'component',
    coordinates: {
      x: 0.3,
      y: 0.5,
      width: 0.1,
      height: 0.05,
      pageNumber: 1,
      zoomLevel: 1,
      viewportOffset: { x: 0, y: 0 }
    },
    style: mockHighlightStyle,
    responseId: 'response-1',
    queryId: 'query-1',
    sessionId: 'session-1',
    createdAt: new Date(),
    isVisible: true,
    isPersistent: false
  };

  const mockQuery: Query = {
    id: 'query-1',
    text: 'What is the value of resistor R1?',
    type: 'component_identification',
    timestamp: new Date(),
    documentIds: ['doc-1'],
    responses: [{
      id: 'response-1',
      modelName: 'gpt-4',
      modelVersion: '1.0',
      responseText: 'The resistor R1 has a value of 1kΩ.',
      confidenceScore: 0.9,
      responseTime: 1000
    }],
    aggregatedResult: {
      summary: 'The resistor R1 has a value of 1kΩ.',
      components: [],
      confidence: {
        overall: 0.9,
        agreement: 0.9,
        completeness: 0.9,
        consistency: 0.9,
        factors: {
          modelConsensus: 0.9,
          responseQuality: 0.9,
          logicalConsistency: 0.9,
          coverage: 0.9,
          uncertainty: 0.1
        }
      },
      consensus: {
        agreementLevel: 0.9,
        conflictingResponses: [],
        consensusResponse: 'The resistor R1 has a value of 1kΩ.'
      }
    }
  };

  const mockSessionState: SessionState = {
    sessionId: 'session-1',
    uploadedFiles: [],
    currentQuery: '',
    queryHistory: [mockQuery],
    highlightContext: {
      persistentHighlights: [],
      activeHighlights: [],
      highlightHistory: [],
      contextualSuggestions: [],
      lastUpdated: new Date()
    }
  };

  beforeEach(() => {
    manager = new ContextHighlightManager({
      maxPersistentHighlights: 5,
      suggestionThreshold: 0.6,
      contextRetentionTime: 10000, // 10 seconds for testing
      enableSemanticSuggestions: true
    });
    
    // Clear all mocks
    mockAnalyzeResponse.mockClear();
    mockCreateHighlightReferences.mockClear();
    mockCreateHighlight.mockClear();
    mockUpdateHighlight.mockClear();
    mockDeleteHighlight.mockClear();
  });

  describe('processQueryResponse', () => {
    it('should process query response and generate highlights', async () => {
      mockAnalyzeResponse.mockResolvedValue([mockHighlight]);
      mockCreateHighlightReferences.mockReturnValue([]);

      const result = await manager.processQueryResponse(mockQuery, mockSessionState);

      expect(result.highlights).toHaveLength(1);
      expect(result.highlights[0]).toEqual(mockHighlight);
      expect(result.updatedContext).toBeDefined();
      expect(mockAnalyzeResponse).toHaveBeenCalledWith(
        mockQuery.aggregatedResult!.summary,
        mockQuery.id,
        mockQuery.id,
        mockSessionState.sessionId
      );
    });

    it('should handle empty response text gracefully', async () => {
      const queryWithoutResult = { ...mockQuery, aggregatedResult: undefined };
      
      const result = await manager.processQueryResponse(queryWithoutResult, mockSessionState);

      expect(result.highlights).toHaveLength(0);
      expect(result.references).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });

    it('should handle service errors gracefully', async () => {
      mockAnalyzeResponse.mockRejectedValue(new Error('Service error'));

      const result = await manager.processQueryResponse(mockQuery, mockSessionState);

      expect(result.highlights).toHaveLength(0);
      expect(result.references).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });
  });

  describe('generateContextualSuggestions', () => {
    it('should generate suggestions based on historical patterns', async () => {
      const contextWithHistory: SessionHighlightContext = {
        persistentHighlights: [],
        activeHighlights: [],
        highlightHistory: [
          {
            highlightIds: ['h1'],
            suggestedHighlights: [],
            activeComponents: ['resistor R1', 'capacitor C1'],
            contextualReferences: []
          },
          {
            highlightIds: ['h2'],
            suggestedHighlights: [],
            activeComponents: ['resistor R1', 'resistor R2'],
            contextualReferences: []
          }
        ],
        contextualSuggestions: [],
        lastUpdated: new Date()
      };

      const suggestions = await manager.generateContextualSuggestions(
        mockQuery,
        [mockHighlight],
        contextWithHistory
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.source === 'history')).toBe(true);
    });

    it('should generate semantic suggestions based on current highlights', async () => {
      const suggestions = await manager.generateContextualSuggestions(
        mockQuery,
        [mockHighlight],
        mockSessionState.highlightContext
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.source === 'semantic')).toBe(true);
    });

    it('should filter suggestions by confidence threshold', async () => {
      const lowConfidenceQuery = {
        ...mockQuery,
        text: 'random unrelated question'
      };

      const suggestions = await manager.generateContextualSuggestions(
        lowConfidenceQuery,
        [mockHighlight],
        mockSessionState.highlightContext
      );

      expect(suggestions.every(s => s.confidence >= 0.6)).toBe(true);
    });

    it('should return empty array when semantic suggestions are disabled', async () => {
      const managerWithoutSemantic = new ContextHighlightManager({
        enableSemanticSuggestions: false
      });

      const suggestions = await managerWithoutSemantic.generateContextualSuggestions(
        mockQuery,
        [mockHighlight],
        mockSessionState.highlightContext
      );

      expect(suggestions).toHaveLength(0);
    });
  });

  describe('updateHighlightPersistence', () => {
    it('should make highlights persistent for component identification queries', () => {
      const updatedHighlights = manager.updateHighlightPersistence(
        [mockHighlight],
        mockQuery,
        mockSessionState.highlightContext
      );

      expect(updatedHighlights[0].isPersistent).toBe(true);
      expect(updatedHighlights[0].expiresAt).toBeUndefined();
    });

    it('should make high confidence highlights persistent', () => {
      const highConfidenceHighlight = {
        ...mockHighlight,
        style: { ...mockHighlight.style, opacity: 0.95 }
      };

      const updatedHighlights = manager.updateHighlightPersistence(
        [highConfidenceHighlight],
        { ...mockQuery, type: 'general_question' as const },
        mockSessionState.highlightContext
      );

      expect(updatedHighlights[0].isPersistent).toBe(true);
    });

    it('should set expiration for non-persistent highlights', () => {
      const generalQuery = { ...mockQuery, type: 'general_question' as const };
      const lowConfidenceHighlight = {
        ...mockHighlight,
        style: { ...mockHighlight.style, opacity: 0.5 }
      };

      const updatedHighlights = manager.updateHighlightPersistence(
        [lowConfidenceHighlight],
        generalQuery,
        mockSessionState.highlightContext
      );

      expect(updatedHighlights[0].isPersistent).toBe(false);
      expect(updatedHighlights[0].expiresAt).toBeDefined();
    });
  });

  describe('cleanupExpiredHighlights', () => {
    it('should identify expired highlights correctly', () => {
      const expiredHighlight = {
        ...mockHighlight,
        id: 'expired-1',
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
        isPersistent: false
      };

      const activeHighlight = {
        ...mockHighlight,
        id: 'active-1',
        isPersistent: true
      };

      const { activeHighlights, expiredHighlights } = manager.cleanupExpiredHighlights(
        [expiredHighlight, activeHighlight],
        mockSessionState.highlightContext!
      );

      expect(activeHighlights).toHaveLength(1);
      expect(activeHighlights[0].id).toBe('active-1');
      expect(expiredHighlights).toHaveLength(1);
      expect(expiredHighlights[0].id).toBe('expired-1');
    });

    it('should not expire persistent highlights even if they have expiration dates', () => {
      const persistentExpiredHighlight = {
        ...mockHighlight,
        id: 'persistent-expired',
        expiresAt: new Date(Date.now() - 1000),
        isPersistent: true
      };

      const { activeHighlights, expiredHighlights } = manager.cleanupExpiredHighlights(
        [persistentExpiredHighlight],
        mockSessionState.highlightContext!
      );

      expect(activeHighlights).toHaveLength(1);
      expect(expiredHighlights).toHaveLength(0);
    });

    it('should handle highlights in persistent list from context', () => {
      const contextHighlight = {
        ...mockHighlight,
        id: 'context-persistent',
        expiresAt: new Date(Date.now() - 1000),
        isPersistent: false
      };

      const contextWithPersistent: SessionHighlightContext = {
        ...mockSessionState.highlightContext!,
        persistentHighlights: ['context-persistent']
      };

      const { activeHighlights, expiredHighlights } = manager.cleanupExpiredHighlights(
        [contextHighlight],
        contextWithPersistent
      );

      expect(activeHighlights).toHaveLength(1);
      expect(expiredHighlights).toHaveLength(0);
    });
  });

  describe('linkHighlightsToQuery', () => {
    it('should create query highlights structure', () => {
      const highlightIds = ['h1', 'h2', 'h3'];
      const linkedQuery = manager.linkHighlightsToQuery(mockQuery, highlightIds);

      expect(linkedQuery.highlights).toBeDefined();
      expect(linkedQuery.highlights!.highlightIds).toEqual(highlightIds);
      expect(linkedQuery.highlights!.suggestedHighlights).toEqual([]);
      expect(linkedQuery.highlights!.contextualReferences).toEqual([]);
    });
  });

  describe('getQueryRelevantHighlights', () => {
    it('should return highlights relevant to query', () => {
      const queryWithHighlights = {
        ...mockQuery,
        highlights: {
          highlightIds: ['highlight-1'],
          suggestedHighlights: [],
          activeComponents: ['resistor R1'],
          contextualReferences: []
        }
      };

      const allHighlights = [
        mockHighlight,
        { ...mockHighlight, id: 'highlight-2', componentId: 'capacitor C1' }
      ];

      const relevantHighlights = manager.getQueryRelevantHighlights(
        queryWithHighlights,
        allHighlights,
        mockSessionState.highlightContext
      );

      expect(relevantHighlights).toHaveLength(1);
      expect(relevantHighlights[0].id).toBe('highlight-1');
    });

    it('should return empty array when no context is provided', () => {
      const relevantHighlights = manager.getQueryRelevantHighlights(
        mockQuery,
        [mockHighlight],
        undefined
      );

      expect(relevantHighlights).toHaveLength(0);
    });

    it('should include contextually relevant highlights based on query text', () => {
      const resistorQuery = {
        ...mockQuery,
        text: 'Tell me about the resistor in this circuit'
      };

      const allHighlights = [
        { ...mockHighlight, componentId: 'resistor R1' },
        { ...mockHighlight, id: 'h2', componentId: 'capacitor C1' }
      ];

      const relevantHighlights = manager.getQueryRelevantHighlights(
        resistorQuery,
        allHighlights,
        mockSessionState.highlightContext
      );

      expect(relevantHighlights.length).toBeGreaterThan(0);
      expect(relevantHighlights.some(h => h.componentId?.includes('resistor'))).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle missing aggregated result gracefully', async () => {
      const queryWithoutResult = {
        ...mockQuery,
        aggregatedResult: undefined
      };

      const result = await manager.processQueryResponse(queryWithoutResult, mockSessionState);

      expect(result.highlights).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
      expect(result.updatedContext).toBeDefined();
    });

    it('should handle empty session state gracefully', async () => {
      const emptySessionState: SessionState = {
        sessionId: 'empty',
        uploadedFiles: [],
        currentQuery: '',
        queryHistory: []
      };

      const result = await manager.processQueryResponse(mockQuery, emptySessionState);

      expect(result).toBeDefined();
      expect(result.updatedContext).toBeDefined();
    });

    it('should handle malformed highlight data gracefully', () => {
      const malformedHighlight = {
        ...mockHighlight,
        componentId: undefined,
        coordinates: undefined as any
      };

      expect(() => {
        manager.updateHighlightPersistence(
          [malformedHighlight],
          mockQuery,
          mockSessionState.highlightContext
        );
      }).not.toThrow();
    });
  });

  describe('performance', () => {
    it('should handle large numbers of highlights efficiently', async () => {
      const manyHighlights = Array.from({ length: 100 }, (_, i) => ({
        ...mockHighlight,
        id: `highlight-${i}`,
        componentId: `component-${i}`
      }));

      const startTime = Date.now();
      
      const suggestions = await manager.generateContextualSuggestions(
        mockQuery,
        manyHighlights,
        mockSessionState.highlightContext
      );

      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(suggestions.length).toBeLessThanOrEqual(10); // Should limit results
    });

    it('should limit suggestions to prevent overwhelming UI', async () => {
      const contextWithManyComponents: SessionHighlightContext = {
        persistentHighlights: [],
        activeHighlights: [],
        highlightHistory: Array.from({ length: 50 }, (_, i) => ({
          highlightIds: [`h${i}`],
          suggestedHighlights: [],
          activeComponents: [`component-${i}`],
          contextualReferences: []
        })),
        contextualSuggestions: [],
        lastUpdated: new Date()
      };

      const suggestions = await manager.generateContextualSuggestions(
        mockQuery,
        [],
        contextWithManyComponents
      );

      expect(suggestions.length).toBeLessThanOrEqual(10);
    });
  });
});