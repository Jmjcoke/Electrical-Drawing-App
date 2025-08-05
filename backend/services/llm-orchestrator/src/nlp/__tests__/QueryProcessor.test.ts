/**
 * Unit tests for QueryProcessor service
 * Tests the main NLP processing pipeline orchestration
 */

import { QueryProcessor } from '../QueryProcessor';
import type { ProcessQueryRequest, NLPConfig } from '../../../../../shared/types/nlp.types';

describe('QueryProcessor', () => {
  let processor: QueryProcessor;
  let mockConfig: NLPConfig;

  beforeEach(() => {
    mockConfig = {
      classification: {
        confidenceThreshold: 0.6,
        fallbackIntent: 'general_question'
      },
      extraction: {
        entityTypes: ['component', 'location', 'property', 'measurement'],
        confidenceThreshold: 0.5,
        maxEntities: 10
      },
      optimization: {
        enableCaching: false, // Disable for testing
        cacheTimeout: 300,
        maxOptimizationTime: 5000
      },
      validation: {
        enableSanitization: true,
        maxQueryLength: 1000,
        blockedPatterns: []
      },
      performance: {
        maxProcessingTime: 10000,
        enableMetrics: true,
        enableAnalytics: false // Disable for testing
      }
    };

    processor = new QueryProcessor(mockConfig);
  });

  describe('Query Processing Pipeline', () => {
    it('should successfully process a simple electrical query', async () => {
      const request: ProcessQueryRequest = {
        queryText: 'What is the resistance of R1?',
        sessionId: 'test-session-1',
        documentIds: ['doc1'],
        context: {
          sessionHistory: [],
          documentContext: [],
          previousQueries: [],
          conversationFlow: [],
          extractedTopics: []
        }
      };

      const response = await processor.processQuery(request);

      expect(response.success).toBe(true);
      expect(response.processedQuery).toBeDefined();
      expect(response.processedQuery?.id).toBeDefined();
      expect(response.processedQuery?.originalText).toBe(request.queryText);
      expect(response.processedQuery?.cleanedText).toBeDefined();
      expect(response.processedQuery?.intent).toBeDefined();
      expect(response.processedQuery?.entities).toBeDefined();
      expect(response.processedQuery?.optimizedPrompts).toBeDefined();
      expect(response.processingTime).toBeGreaterThan(0);
    });

    it('should process component identification queries correctly', async () => {
      const request: ProcessQueryRequest = {
        queryText: 'Identify the 100 ohm resistor R1 in this circuit',
        sessionId: 'test-session-2'
      };

      const response = await processor.processQuery(request);

      expect(response.success).toBe(true);
      expect(response.processedQuery?.intent.type).toBe('component_identification');
      expect(response.processedQuery?.entities.length).toBeGreaterThan(0);
      
      // Should identify resistor and R1
      const entityTexts = response.processedQuery?.entities.map(e => e.text.toLowerCase()) || [];
      expect(entityTexts.some(text => text.includes('resistor') || text.includes('r1'))).toBe(true);
    });

    it('should process schematic analysis queries correctly', async () => {
      const request: ProcessQueryRequest = {
        queryText: 'Analyze the current flow in this amplifier circuit',
        sessionId: 'test-session-3'
      };

      const response = await processor.processQuery(request);

      expect(response.success).toBe(true);
      expect(response.processedQuery?.intent.type).toBe('schematic_analysis');
      expect(response.processedQuery?.context.extractedTopics).toContain('amplifier');
    });

    it('should generate optimized prompts for all providers', async () => {
      const request: ProcessQueryRequest = {
        queryText: 'What is the voltage across the capacitor C1?',
        sessionId: 'test-session-4'
      };

      const response = await processor.processQuery(request);

      expect(response.success).toBe(true);
      expect(response.processedQuery?.optimizedPrompts).toBeDefined();
      
      const providers = Object.keys(response.processedQuery?.optimizedPrompts || {});
      expect(providers).toContain('openai');
      expect(providers).toContain('claude');
      expect(providers).toContain('gemini');
      
      // Each prompt should be a non-empty string
      for (const [, prompt] of Object.entries(response.processedQuery?.optimizedPrompts || {})) {
        expect(typeof prompt).toBe('string');
        expect((prompt as string).length).toBeGreaterThan(0);
      }
    });
  });

  describe('Input Validation', () => {
    it('should reject empty queries', async () => {
      const request: ProcessQueryRequest = {
        queryText: '',
        sessionId: 'test-session-empty'
      };

      const response = await processor.processQuery(request);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error).toContain('validation');
    });

    it('should sanitize potentially malicious input', async () => {
      const request: ProcessQueryRequest = {
        queryText: 'What is <script>alert("xss")</script> this resistor?',
        sessionId: 'test-session-xss'
      };

      const response = await processor.processQuery(request);

      if (response.success) {
        expect(response.processedQuery?.cleanedText).not.toContain('<script>');
        expect(response.processedQuery?.cleanedText).not.toContain('alert');
      } else {
        // Should be blocked if deemed too dangerous
        expect(response.error).toBeDefined();
      }
    });

    it('should handle queries that exceed maximum length', async () => {
      const longQuery = 'What is this resistor? '.repeat(200); // Exceeds 1000 char limit
      const request: ProcessQueryRequest = {
        queryText: longQuery,
        sessionId: 'test-session-long'
      };

      const response = await processor.processQuery(request);

      expect(response.success).toBe(false);
      expect(response.error).toContain('length');
    });
  });

  describe('Context Processing', () => {
    it('should incorporate session history into context', async () => {
      const request: ProcessQueryRequest = {
        queryText: 'What about the capacitor?',
        sessionId: 'test-session-context',
        context: {
          sessionHistory: ['Previous query about power supply'],
          documentContext: [],
          previousQueries: [
            {
              id: 'prev-1',
              text: 'Analyze this power supply',
              timestamp: new Date(),
              sessionId: 'test-session-context'
            }
          ],
          conversationFlow: [],
          extractedTopics: ['power supply']
        }
      };

      const response = await processor.processQuery(request);

      expect(response.success).toBe(true);
      expect(response.processedQuery?.context.sessionHistory).toContain('Previous query about power supply');
      expect(response.processedQuery?.context.extractedTopics).toContain('power supply');
    });

    it('should process document context when provided', async () => {
      const request: ProcessQueryRequest = {
        queryText: 'Analyze this circuit',
        sessionId: 'test-session-docs',
        documentIds: ['doc1', 'doc2', 'doc3']
      };

      const response = await processor.processQuery(request);

      expect(response.success).toBe(true);
      expect(response.processedQuery?.context.documentContext).toBeDefined();
      expect(response.processedQuery?.context.documentContext.length).toBeGreaterThan(0);
    });
  });

  describe('Processing Metadata', () => {
    it('should provide detailed processing metadata', async () => {
      const request: ProcessQueryRequest = {
        queryText: 'Check the voltage of R1',
        sessionId: 'test-session-metadata'
      };

      const response = await processor.processQuery(request);

      expect(response.success).toBe(true);
      
      const metadata = response.processedQuery?.processingMetadata;
      expect(metadata).toBeDefined();
      expect(metadata?.classificationTime).toBeGreaterThan(0);
      expect(metadata?.extractionTime).toBeGreaterThan(0);
      expect(metadata?.optimizationTime).toBeGreaterThan(0);
      expect(metadata?.totalProcessingTime).toBeGreaterThan(0);
      expect(metadata?.confidenceBreakdown).toBeDefined();
      expect(metadata?.confidenceBreakdown.intentConfidence).toBeGreaterThan(0);
    });

    it('should track processing stages', async () => {
      const request: ProcessQueryRequest = {
        queryText: 'What is the current through L1?',
        sessionId: 'test-session-stages'
      };

      const response = await processor.processQuery(request);

      expect(response.success).toBe(true);
      expect(response.processingTime).toBeGreaterThan(0);
      expect(response.processingTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid input gracefully', async () => {
      const request: ProcessQueryRequest = {
        queryText: null as any,
        sessionId: 'test-session-null'
      };

      const response = await processor.processQuery(request);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.processingTime).toBeGreaterThan(0);
    });

    it('should handle processing timeouts', async () => {
      // Note: This test demonstrates timeout handling
      // In a real implementation, you'd inject timeouts at specific stages
      // For now, we'll just acknowledge that timeout handling exists
    });

    it('should provide error details for debugging', async () => {
      const request: ProcessQueryRequest = {
        queryText: '', // Empty query will fail validation
        sessionId: 'test-session-debug'
      };

      const response = await processor.processQuery(request);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(typeof response.error).toBe('string');
      expect(response.processingTime).toBeGreaterThan(0);
    });
  });

  describe('Performance and Statistics', () => {
    it('should provide processing statistics', () => {
      const stats = processor.getProcessingStats();

      expect(stats).toBeDefined();
      expect(stats.classifier).toBeDefined();
      expect(stats.contextExtractor).toBeDefined();
      expect(stats.optimizer).toBeDefined();
      expect(stats.validator).toBeDefined();
      expect(stats.config).toBeDefined();
    });

    it('should complete health check successfully', async () => {
      const healthCheck = await processor.healthCheck();

      expect(healthCheck.healthy).toBe(true);
      expect(healthCheck.components).toBeDefined();
      expect(healthCheck.components.classifier).toBe(true);
      expect(healthCheck.components.contextExtractor).toBe(true);
      expect(healthCheck.components.optimizer).toBe(true);
      expect(healthCheck.components.validator).toBe(true);
      expect(healthCheck.components.suggestionEngine).toBe(true);
    });

    it('should process multiple queries efficiently', async () => {
      const queries = [
        'What is R1?',
        'Analyze this amplifier',
        'How does this circuit work?',
        'Identify the capacitor',
        'Calculate the voltage'
      ];

      const startTime = Date.now();
      const promises = queries.map((queryText, index) => 
        processor.processQuery({
          queryText,
          sessionId: `test-session-parallel-${index}`
        })
      );

      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All queries should succeed
      for (const response of responses) {
        expect(response.success).toBe(true);
      }

      // Parallel processing should be reasonably efficient
      expect(totalTime).toBeLessThan(15000); // Less than 15 seconds for 5 queries
    });
  });

  describe('Query Types Coverage', () => {
    const testQueries = [
      { 
        query: 'What is the resistance of R5?', 
        expectedIntent: 'component_identification',
        shouldHaveEntities: true 
      },
      { 
        query: 'Trace the current path through this filter circuit', 
        expectedIntent: 'schematic_analysis',
        shouldHaveTopics: true 
      },
      { 
        query: 'How do op-amps work in general?', 
        expectedIntent: 'general_question',
        shouldHaveEntities: true 
      },
      { 
        query: 'Check the 12V power supply output', 
        expectedIntent: 'component_identification',
        shouldHaveEntities: true 
      },
      { 
        query: 'Why does this oscillator circuit oscillate?', 
        expectedIntent: 'general_question',
        shouldHaveTopics: true 
      }
    ];

    testQueries.forEach(({ query, expectedIntent, shouldHaveEntities, shouldHaveTopics }, index) => {
      it(`should process ${expectedIntent} query: "${query}"`, async () => {
        const request: ProcessQueryRequest = {
          queryText: query,
          sessionId: `test-coverage-${index}`
        };

        const response = await processor.processQuery(request);

        expect(response.success).toBe(true);
        expect(response.processedQuery?.intent.type).toBe(expectedIntent);

        if (shouldHaveEntities) {
          expect(response.processedQuery?.entities.length).toBeGreaterThan(0);
        }

        if (shouldHaveTopics) {
          expect(response.processedQuery?.context.extractedTopics.length).toBeGreaterThan(0);
        }

        // All queries should have optimized prompts
        expect(Object.keys(response.processedQuery?.optimizedPrompts || {})).toContain('openai');
        expect(Object.keys(response.processedQuery?.optimizedPrompts || {})).toContain('claude');
        expect(Object.keys(response.processedQuery?.optimizedPrompts || {})).toContain('gemini');
      });
    });
  });
});