/**
 * ContextSummarizer Test Suite
 * Comprehensive unit tests for context summarization and memory management functionality
 */

import {
  ContextSummarizer,
  SummarizationConfig,
  ExpirationPolicy
} from '../ContextSummarizer';
import {
  ConversationContext,
  ConversationTurn,
  ProcessedQuery,
  AnalysisResult
} from '../../../../../shared/types/context';

describe('ContextSummarizer', () => {
  let contextSummarizer: ContextSummarizer;
  let mockContext: ConversationContext;
  let mockTurns: ConversationTurn[];

  beforeEach(() => {
    // Configure for testing with smaller contexts
    contextSummarizer = new ContextSummarizer({
      maxContextLength: 15, // Lower threshold for testing compression
      compressionRatio: 0.5,
      relevanceThreshold: 0.3,
      preserveRecentTurns: 3
    });

    // Create extensive mock conversation turns for testing
    mockTurns = Array.from({ length: 20 }, (_, i) => ({
      id: `turn-${i + 1}`,
      turnNumber: i + 1,
      query: {
        id: `query-${i + 1}`,
        text: i % 3 === 0 
          ? `What is the voltage rating of the ${i === 0 ? 'resistor' : i === 3 ? 'capacitor' : 'inductor'}?`
          : i % 3 === 1 
          ? `How do I connect the ${i === 1 ? 'power supply' : i === 4 ? 'ground' : 'circuit'}?`
          : `What are the specifications for component ${i + 1}?`,
        type: 'component_identification' as const,
        timestamp: new Date(Date.now() - (20 - i) * 60000), // Each turn 1 minute apart
        documentIds: [`doc-${Math.floor(i / 5) + 1}`],
        processedText: `processed query ${i + 1}`,
        extractedEntities: [] as any,
        intent: 'component_identification',
        confidence: 0.8 + (i % 5) * 0.04 // Varies from 0.8 to 0.96
      } as unknown as ProcessedQuery,
      response: {
        summary: i % 4 === 0 
          ? `Identified a ${i === 0 ? '10kΩ resistor' : i === 4 ? '100µF capacitor' : i === 8 ? '1mH inductor' : 'component'} with high confidence`
          : i % 4 === 1
          ? `Found connection point at ${i === 1 ? 'terminal A' : i === 5 ? 'ground plane' : 'pin ' + i}`
          : i % 4 === 2
          ? `Specification shows ${i === 2 ? '5V rating' : i === 6 ? '2A current' : i + 'Ω resistance'}`
          : `Analysis complete for component ${i + 1}`,
        components: [],
        confidence: { 
          overall: 0.7 + (i % 6) * 0.05, // Varies from 0.7 to 0.95
          breakdown: {}, 
          reasoning: `Analysis ${i + 1} completed` 
        },
        consensus: { 
          agreementLevel: 0.85 + (i % 4) * 0.03, 
          conflictingResponses: [], 
          consensusResponse: `Consensus ${i + 1}` 
        }
      } as AnalysisResult,
      contextContributions: [
        `contribution-${i + 1}`,
        ...(i % 3 === 0 ? [`entity-${i}`] : []),
        ...(i % 5 === 0 ? [`relationship-${i}`] : [])
      ],
      followUpDetected: i > 0 && i % 4 === 1, // Every 4th turn after first is follow-up
      timestamp: new Date(Date.now() - (20 - i) * 60000)
    }));

    // Create mock cumulative context
    const mockEntities = new Map([
      ['resistor', [
        { text: 'resistor', type: 'electrical_component', confidence: 0.9, context: 'circuit analysis', turnId: 'turn-1', position: 15, firstMentioned: new Date(), mentions: 3 }
      ]],
      ['capacitor', [
        { text: 'capacitor', type: 'electrical_component', confidence: 0.85, context: 'power filtering', turnId: 'turn-4', position: 20, firstMentioned: new Date(), mentions: 2 }
      ]],
      ['voltage', [
        { text: 'voltage', type: 'measurement', confidence: 0.8, context: 'electrical property', turnId: 'turn-1', position: 8, firstMentioned: new Date(), mentions: 5 }
      ]]
    ]);

    const mockTopics = [
      { topic: 'component_identification', relevance: 0.9, firstIntroduced: new Date(), relatedTopics: ['electrical_analysis'], queryIds: ['query-1', 'query-4', 'query-8'] },
      { topic: 'connection_analysis', relevance: 0.7, firstIntroduced: new Date(), relatedTopics: ['circuit_design'], queryIds: ['query-2', 'query-5'] },
      { topic: 'specification_review', relevance: 0.6, firstIntroduced: new Date(), relatedTopics: ['datasheet_analysis'], queryIds: ['query-3', 'query-6'] }
    ];

    mockContext = {
      id: 'context-large',
      sessionId: 'session-test',
      conversationThread: mockTurns,
      cumulativeContext: {
        extractedEntities: mockEntities,
        documentContext: [
          { documentId: 'doc-1', filename: 'schematic1.pdf', relevantPages: [1, 2], keyFindings: ['resistor_analysis'], lastReferenced: new Date() },
          { documentId: 'doc-2', filename: 'schematic2.pdf', relevantPages: [1], keyFindings: ['capacitor_analysis'], lastReferenced: new Date() }
        ] as any,
        topicProgression: mockTopics as any,
        keyInsights: [
          '1: Identified a 10kΩ resistor with high confidence',
          '4: Identified a 100µF capacitor with high confidence',
          '8: Identified a 1mH inductor with high confidence'
        ],
        relationshipMap: [
          { source: 'resistor', target: 'voltage', relationship: 'measures', confidence: 0.8, context: 'electrical analysis' },
          { source: 'capacitor', target: 'voltage', relationship: 'filters', confidence: 0.7, context: 'power supply analysis' }
        ] as any
      },
      lastUpdated: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      metadata: {
        createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        lastAccessed: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        accessCount: 5,
        compressionLevel: 0,
        tags: ['electrical_analysis', 'testing']
      }
    };
  });

  describe('constructor and configuration', () => {
    it('should initialize with default configuration', () => {
      const summarizer = new ContextSummarizer();
      expect(summarizer).toBeDefined();
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<SummarizationConfig> = {
        maxContextLength: 30,
        compressionRatio: 0.5,
        relevanceThreshold: 0.6
      };

      const summarizer = new ContextSummarizer(customConfig);
      expect(summarizer).toBeDefined();
    });

    it('should accept custom expiration policies', () => {
      const customPolicy: ExpirationPolicy = {
        name: 'Test Policy',
        maxAge: 1000,
        maxInactivity: 500,
        priority: 'high',
        conditions: ['test_condition']
      };

      const summarizer = new ContextSummarizer({}, [customPolicy]);
      expect(summarizer).toBeDefined();
    });
  });

  describe('generateContextSummary', () => {
    it('should generate comprehensive context summary', async () => {
      const result = await contextSummarizer.generateContextSummary(mockContext);

      expect(result).toBeDefined();
      expect(result.summary).toContain('Conversation summary');
      expect(result.keyPoints).toBeDefined();
      expect(Array.isArray(result.keyPoints)).toBe(true);
      expect(result.relevantEntities).toBeDefined();
      expect(Array.isArray(result.relevantEntities)).toBe(true);
      expect(result.compressionRatio).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeLessThanOrEqual(1);
      expect(result.originalTurnCount).toBe(20);
      expect(result.summaryConfidence).toBeGreaterThan(0);
      expect(result.summaryConfidence).toBeLessThanOrEqual(1);
    });

    it('should include relevant entities in summary', async () => {
      const result = await contextSummarizer.generateContextSummary(mockContext);

      expect(result.relevantEntities).toContain('resistor');
      expect(result.relevantEntities).toContain('capacitor');
      expect(result.relevantEntities).toContain('voltage');
    });

    it('should extract meaningful key points', async () => {
      const result = await contextSummarizer.generateContextSummary(mockContext);

      expect(result.keyPoints.length).toBeGreaterThan(0);
      // Should include high-confidence findings or relationships
      const hasElectricalContent = result.keyPoints.some(point => 
        point.includes('resistor') || 
        point.includes('capacitor') || 
        point.includes('Relationship') ||
        point.includes('Turn')
      );
      expect(hasElectricalContent).toBe(true);
    });

    it('should handle empty context gracefully', async () => {
      const emptyContext = {
        ...mockContext,
        conversationThread: [],
        cumulativeContext: {
          extractedEntities: new Map(),
          documentContext: [],
          topicProgression: [],
          keyInsights: [],
          relationshipMap: []
        }
      };

      const result = await contextSummarizer.generateContextSummary(emptyContext);

      expect(result.summary).toContain('No significant conversation activity');
      expect(result.keyPoints).toEqual([]);
      expect(result.relevantEntities).toEqual([]);
      expect(result.originalTurnCount).toBe(0);
    });

    it('should calculate appropriate confidence scores', async () => {
      const result = await contextSummarizer.generateContextSummary(mockContext);

      expect(result.summaryConfidence).toBeGreaterThan(0.5);
      expect(result.summaryConfidence).toBeLessThan(1.0);
    });
  });

  describe('compressContext', () => {
    it('should not compress context below threshold', async () => {
      const smallContext = {
        ...mockContext,
        conversationThread: mockTurns.slice(0, 5) // Only 5 turns
      };

      const result = await contextSummarizer.compressContext(smallContext);

      expect(result.compressedContext.conversationThread.length).toBe(5);
      expect(result.compressionResult.compressionRatio).toBe(1.0);
      expect(result.compressionResult.summaryGenerated).toBe(false);
    });

    it('should compress large contexts effectively', async () => {
      const result = await contextSummarizer.compressContext(mockContext);

      expect(result.compressedContext.conversationThread.length).toBeLessThan(mockContext.conversationThread.length);
      expect(result.compressionResult.compressionRatio).toBeLessThan(1.0);
      expect(result.compressionResult.preservedTurns).toBeGreaterThan(0);
    });

    it('should preserve recent turns during compression', async () => {
      const result = await contextSummarizer.compressContext(mockContext);

      const compressedTurns = result.compressedContext.conversationThread;
      const recentTurns = mockTurns.slice(-3); // Last 3 turns (matching preserveRecentTurns config)

      // Check that recent turns are preserved
      for (const recentTurn of recentTurns) {
        expect(compressedTurns.some(turn => turn.id === recentTurn.id)).toBe(true);
      }
    });

    it('should update metadata after compression', async () => {
      const result = await contextSummarizer.compressContext(mockContext);

      expect(result.compressedContext.metadata.compressionLevel).toBe(1);
      expect(result.compressedContext.metadata.tags).toContain('compressed');
      expect(result.compressedContext.lastUpdated).toBeInstanceOf(Date);
    });

    it('should maintain turn order after compression', async () => {
      const result = await contextSummarizer.compressContext(mockContext);

      const compressedTurns = result.compressedContext.conversationThread;
      
      for (let i = 1; i < compressedTurns.length; i++) {
        expect(compressedTurns[i].turnNumber).toBeGreaterThan(compressedTurns[i - 1].turnNumber);
      }
    });

    it('should update cumulative context appropriately', async () => {
      const result = await contextSummarizer.compressContext(mockContext);

      const originalEntityCount = mockContext.cumulativeContext.extractedEntities.size;
      const compressedEntityCount = result.compressedContext.cumulativeContext.extractedEntities.size;

      expect(compressedEntityCount).toBeLessThanOrEqual(originalEntityCount);
    });
  });

  describe('applyCleanupPolicies', () => {
    let contextsForCleanup: ConversationContext[];

    beforeEach(() => {
      // Create contexts with different ages and access patterns
      contextsForCleanup = [
        {
          ...mockContext,
          id: 'context-old',
          metadata: {
            ...mockContext.metadata,
            createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days old
            lastAccessed: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days inactive
            accessCount: 2
          }
        },
        {
          ...mockContext,
          id: 'context-recent',
          metadata: {
            ...mockContext.metadata,
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours old
            lastAccessed: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes inactive
            accessCount: 10
          }
        },
        {
          ...mockContext,
          id: 'context-inactive',
          metadata: {
            ...mockContext.metadata,
            createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days old
            lastAccessed: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days inactive
            accessCount: 1
          }
        }
      ];
    });

    it('should apply cleanup policies and remove expired contexts', () => {
      const result = contextSummarizer.applyCleanupPolicies([...contextsForCleanup]);

      expect(result.contextsRemoved).toBeGreaterThan(0);
      expect(result.turnsRemoved).toBeGreaterThan(0);
      expect(result.spaceSaved).toBeGreaterThan(0);
      expect(Array.isArray(result.policies)).toBe(true);
    });

    it('should preserve recent and active contexts', () => {
      const contextsCopy = [...contextsForCleanup];
      contextSummarizer.applyCleanupPolicies(contextsCopy);

      // Recent context should be preserved
      expect(contextsCopy.some(ctx => ctx.id === 'context-recent')).toBe(true);
    });

    it('should provide detailed cleanup statistics', () => {
      const result = contextSummarizer.applyCleanupPolicies([...contextsForCleanup]);

      expect(typeof result.contextsRemoved).toBe('number');
      expect(typeof result.turnsRemoved).toBe('number');
      expect(typeof result.spaceSaved).toBe('number');
      expect(Array.isArray(result.policies)).toBe(true);
      expect(result.contextsRemoved).toBeGreaterThanOrEqual(0);
      expect(result.turnsRemoved).toBeGreaterThanOrEqual(0);
      expect(result.spaceSaved).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateMemoryUsage', () => {
    it('should calculate comprehensive memory usage statistics', () => {
      const contexts = [mockContext];
      const result = contextSummarizer.calculateMemoryUsage(contexts);

      expect(result.totalContexts).toBe(1);
      expect(result.totalTurns).toBe(20);
      expect(result.memoryUsed).toBeGreaterThan(0);
      expect(result.compressionSavings).toBeGreaterThanOrEqual(0);
      expect(result.oldestContext).toBeInstanceOf(Date);
      expect(result.newestContext).toBeInstanceOf(Date);
    });

    it('should handle multiple contexts correctly', () => {
      const contexts = [
        mockContext,
        {
          ...mockContext,
          id: 'context-2',
          conversationThread: mockTurns.slice(0, 10),
          metadata: {
            ...mockContext.metadata,
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            compressionLevel: 1
          }
        }
      ];

      const result = contextSummarizer.calculateMemoryUsage(contexts);

      expect(result.totalContexts).toBe(2);
      expect(result.totalTurns).toBe(30);
      expect(result.compressionSavings).toBeGreaterThan(0); // Due to compression in second context
    });

    it('should handle empty context array', () => {
      const result = contextSummarizer.calculateMemoryUsage([]);

      expect(result.totalContexts).toBe(0);
      expect(result.totalTurns).toBe(0);
      expect(result.memoryUsed).toBe(0);
      expect(result.compressionSavings).toBe(0);
    });
  });

  describe('optimizeContextStorage', () => {
    it('should optimize multiple contexts comprehensively', async () => {
      const contexts = [
        mockContext, // Large context that needs compression
        {
          ...mockContext,
          id: 'context-small',
          conversationThread: mockTurns.slice(0, 5), // Small context
          metadata: {
            ...mockContext.metadata,
            createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // Very old
            lastAccessed: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            accessCount: 1
          }
        }
      ];

      const result = await contextSummarizer.optimizeContextStorage(contexts);

      expect(result.optimizedContexts).toBeDefined();
      expect(result.optimizationResults).toBeDefined();
      expect(typeof result.optimizationResults.compressed).toBe('number');
      expect(typeof result.optimizationResults.summarized).toBe('number');
      expect(typeof result.optimizationResults.cleaned).toBe('number');
      expect(typeof result.optimizationResults.spaceSaved).toBe('number');
    });

    it('should compress large contexts during optimization', async () => {
      const contexts = [mockContext];
      const result = await contextSummarizer.optimizeContextStorage(contexts);

      expect(result.optimizationResults.compressed).toBeGreaterThan(0);
      expect(result.optimizedContexts[0].conversationThread.length).toBeLessThan(
        mockContext.conversationThread.length
      );
    });

    it('should preserve small contexts during optimization', async () => {
      const smallContext = {
        ...mockContext,
        conversationThread: mockTurns.slice(0, 5)
      };

      const result = await contextSummarizer.optimizeContextStorage([smallContext]);

      expect(result.optimizedContexts[0].conversationThread.length).toBe(5);
      expect(result.optimizationResults.compressed).toBe(0);
    });
  });

  describe('relevance scoring', () => {
    it('should score turns based on entity relevance', async () => {
      // Create a context summary to trigger relevance scoring
      const result = await contextSummarizer.generateContextSummary(mockContext);

      // Turns with important entities should be included
      expect(result.relevantEntities.length).toBeGreaterThan(0);
      expect(result.keyPoints.length).toBeGreaterThan(0);
    });

    it('should consider recency in relevance scoring', async () => {
      // Recent turns should have higher scores
      const result = await contextSummarizer.compressContext(mockContext);

      // Should preserve recent turns
      const compressedTurns = result.compressedContext.conversationThread;
      const lastTurn = mockTurns[mockTurns.length - 1];
      
      expect(compressedTurns.some(turn => turn.id === lastTurn.id)).toBe(true);
    });

    it('should consider interaction quality in scoring', async () => {
      // High-confidence responses should be preserved
      const result = await contextSummarizer.compressContext(mockContext);

      // Should preserve some high-confidence turns
      expect(result.compressedContext.conversationThread.length).toBeGreaterThan(5);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle context with no cumulative data', async () => {
      const emptyContext = {
        ...mockContext,
        cumulativeContext: {
          extractedEntities: new Map(),
          documentContext: [],
          topicProgression: [],
          keyInsights: [],
          relationshipMap: []
        }
      };

      const result = await contextSummarizer.generateContextSummary(emptyContext);
      expect(result).toBeDefined();
      expect(result.relevantEntities).toEqual([]);
    });

    it('should handle contexts with very low confidence scores', async () => {
      const lowConfidenceContext = {
        ...mockContext,
        conversationThread: mockTurns.map(turn => ({
          ...turn,
          response: {
            ...turn.response,
            confidence: { overall: 0.1, breakdown: {}, reasoning: 'low confidence' }
          }
        }))
      };

      const result = await contextSummarizer.generateContextSummary(lowConfidenceContext);
      expect(result.summaryConfidence).toBeLessThan(0.5);
    });

    it('should handle context compression with minimal data', async () => {
      const minimalContext = {
        ...mockContext,
        conversationThread: mockTurns.slice(0, 2),
        cumulativeContext: {
          extractedEntities: new Map(),
          documentContext: [],
          topicProgression: [],
          keyInsights: [],
          relationshipMap: []
        }
      };

      const result = await contextSummarizer.compressContext(minimalContext);
      expect(result.compressedContext.conversationThread.length).toBe(2);
      expect(result.compressionResult.compressionRatio).toBe(1.0);
    });

    it('should handle memory usage calculation for compressed contexts', () => {
      const compressedContext = {
        ...mockContext,
        metadata: {
          ...mockContext.metadata,
          compressionLevel: 2
        }
      };

      const result = contextSummarizer.calculateMemoryUsage([compressedContext]);
      expect(result.compressionSavings).toBeGreaterThan(0);
    });
  });

  describe('performance considerations', () => {
    it('should handle large-scale optimization efficiently', async () => {
      const manyContexts = Array.from({ length: 50 }, (_, i) => ({
        ...mockContext,
        id: `context-${i}`,
        conversationThread: mockTurns.slice(0, 10)
      }));

      const startTime = Date.now();
      const result = await contextSummarizer.optimizeContextStorage(manyContexts);
      const processingTime = Date.now() - startTime;

      expect(result.optimizedContexts).toBeDefined();
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should efficiently calculate memory usage for many contexts', () => {
      const manyContexts = Array.from({ length: 100 }, (_, i) => ({
        ...mockContext,
        id: `context-${i}`,
        conversationThread: mockTurns.slice(0, 5)
      }));

      const startTime = Date.now();
      const result = contextSummarizer.calculateMemoryUsage(manyContexts);
      const processingTime = Date.now() - startTime;

      expect(result.totalContexts).toBe(100);
      expect(processingTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle cleanup of many expired contexts efficiently', () => {
      const expiredContexts = Array.from({ length: 200 }, (_, i) => ({
        ...mockContext,
        id: `expired-context-${i}`,
        metadata: {
          ...mockContext.metadata,
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days old
          lastAccessed: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days inactive
          accessCount: 1
        }
      }));

      const startTime = Date.now();
      const result = contextSummarizer.applyCleanupPolicies([...expiredContexts]);
      const processingTime = Date.now() - startTime;

      expect(result.contextsRemoved).toBeGreaterThan(0);
      expect(processingTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});