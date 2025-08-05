/**
 * Context Management Integration Tests
 * Tests for the complete context management pipeline integration
 */

import { ConversationContextService } from '../../context/ConversationContext';
import { FollowUpDetectorService } from '../../context/FollowUpDetector';
import { ContextEnricherService } from '../../context/ContextEnricher';
import { ContextSummarizerService } from '../../context/ContextSummarizer';
import { ContextAwareQueryEnhancerService } from '../../context/ContextAwareQueryEnhancer';
import type {
  ContextStorageConfig,
  ProcessedQuery,
  AnalysisResult,
  FollowUpDetectorConfig,
  ContextEnricherConfig,
  ContextSummarizerConfig,
  QueryEnhancerConfig
} from '../../../../../shared/types/context';

describe('Context Management Integration Tests', () => {
  let contextService: ConversationContextService;
  let followUpDetector: FollowUpDetectorService;
  let contextEnricher: ContextEnricherService;
  let contextSummarizer: ContextSummarizerService;
  let queryEnhancer: ContextAwareQueryEnhancerService;

  beforeEach(() => {
    // Initialize services with test configurations
    const contextConfig: ContextStorageConfig = {
      maxTurnsPerContext: 50,
      compressionThreshold: 1000,
      expirationHours: 24,
      cleanupIntervalMinutes: 60
    };

    const followUpConfig: FollowUpDetectorConfig = {
      confidenceThreshold: 0.7,
      maxRecentTurns: 10,
      enabledDetectionTypes: ['pronoun', 'temporal', 'implicit', 'spatial']
    };

    const enricherConfig: ContextEnricherConfig = {
      maxContextTurns: 10,
      relevanceThreshold: 0.6,
      semanticSimilarityThreshold: 0.7,
      mergeSimilarityThreshold: 0.8
    };

    const summarizerConfig: ContextSummarizerConfig = {
      maxTurnsBeforeSummarization: 20,
      targetCompressionRatio: 0.5,
      relevanceThreshold: 0.6,
      preserveRecentTurns: 5
    };

    const enhancerConfig: QueryEnhancerConfig = {
      maxContextLength: 2000,
      relevanceThreshold: 0.6,
      ambiguityThreshold: 0.5,
      enableEntityResolution: true,
      enableSemanticEnhancement: true
    };

    contextService = new ConversationContextService(contextConfig);
    followUpDetector = new FollowUpDetectorService(followUpConfig);
    contextEnricher = new ContextEnricherService(enricherConfig);
    contextSummarizer = new ContextSummarizerService(summarizerConfig);
    queryEnhancer = new ContextAwareQueryEnhancerService(enhancerConfig);
  });

  describe('End-to-End Context Flow', () => {
    it('should handle complete conversation flow with context management', async () => {
      const sessionId = 'integration-test-session';
      
      // Step 1: Create initial context
      const context = await contextService.createContext(sessionId);
      expect(context.id).toBeDefined();
      expect(context.conversationThread).toHaveLength(0);

      // Step 2: Process first query (no follow-up expected)
      const firstQuery: ProcessedQuery = {
        id: 'query-1',
        originalText: 'What type of component is shown in this electrical diagram?',
        processedText: 'What type of component is shown in this electrical diagram?',
        intent: 'component_identification',
        entities: [
          { text: 'component', type: 'electrical_part', confidence: 0.9 },
          { text: 'electrical diagram', type: 'document_type', confidence: 0.95 }
        ],
        metadata: {
          timestamp: new Date(),
          confidence: 0.88,
          processingTimeMs: 120
        }
      };

      const firstResponse: AnalysisResult = {
        id: 'response-1',
        queryId: 'query-1',
        analysisType: 'component_identification',
        result: {
          summary: 'This appears to be a resistor component based on the zigzag pattern shown in the diagram.',
          confidence: 0.92,
          evidence: [
            'Zigzag pattern characteristic of resistor symbols',
            'Two connection points typical of resistor components'
          ]
        },
        metadata: {
          timestamp: new Date(),
          processingTimeMs: 450,
          model: 'gpt-4'
        }
      };

      // Add first turn to context
      await contextService.addTurn(context.id, firstQuery, firstResponse);
      
      const updatedContext = await contextService.getContext(context.id);
      expect(updatedContext!.conversationThread).toHaveLength(1);
      expect(updatedContext!.cumulativeContext.extractedEntities.has('resistor')).toBe(true);

      // Step 3: Process follow-up query
      const followUpQuery: ProcessedQuery = {
        id: 'query-2',
        originalText: 'What is its typical resistance value?',
        processedText: 'What is its typical resistance value?',
        intent: 'component_properties',
        entities: [
          { text: 'resistance value', type: 'electrical_property', confidence: 0.85 }
        ],
        metadata: {
          timestamp: new Date(),
          confidence: 0.82,
          processingTimeMs: 95
        }
      };

      // Step 4: Detect follow-up reference
      const followUpResult = await followUpDetector.detectFollowUp(
        followUpQuery,
        updatedContext!.conversationThread
      );

      expect(followUpResult.isFollowUp).toBe(true);
      expect(followUpResult.confidence).toBeGreaterThan(0.7);
      expect(followUpResult.detectedReferences).toContainEqual(
        expect.objectContaining({
          type: 'pronoun',
          text: 'its'
        })
      );

      // Step 5: Enhance query with context
      const enhancedQuery = await queryEnhancer.enhanceQuery(
        followUpQuery,
        updatedContext!
      );

      expect(enhancedQuery.enhancedText).toContain('resistor');
      expect(enhancedQuery.contextualInformation).toContain('resistor component');
      expect(enhancedQuery.resolvedAmbiguities).toContainEqual(
        expect.objectContaining({
          original: 'its',
          resolved: 'resistor'
        })
      );

      // Step 6: Process enhanced follow-up response
      const followUpResponse: AnalysisResult = {
        id: 'response-2',
        queryId: 'query-2',
        analysisType: 'component_properties',
        result: {
          summary: 'Typical resistor values range from 1Ω to 10MΩ, with common values being 220Ω, 470Ω, 1kΩ, 4.7kΩ, and 10kΩ.',
          confidence: 0.89,
          evidence: [
            'Standard E-series values commonly manufactured',
            'Values depend on specific application requirements'
          ]
        },
        metadata: {
          timestamp: new Date(),
          processingTimeMs: 380,
          model: 'gpt-4'
        }
      };

      // Add second turn with follow-up detection
      await contextService.addTurn(context.id, enhancedQuery.originalQuery, followUpResponse, true);

      const finalContext = await contextService.getContext(context.id);
      expect(finalContext!.conversationThread).toHaveLength(2);
      expect(finalContext!.conversationThread[1].followUpDetected).toBe(true);

      // Step 7: Verify context enrichment
      const enrichmentResult = await contextEnricher.enrichContext(
        followUpQuery,
        followUpResponse,
        finalContext!
      );

      expect(enrichmentResult.newEntities).toContain('resistance_value');
      expect(enrichmentResult.updatedRelationships).toContainEqual(
        expect.objectContaining({
          from: 'resistor',
          to: 'resistance_value',
          type: 'has_property'
        })
      );

      // Verify the complete context state
      expect(finalContext!.cumulativeContext.extractedEntities.size).toBeGreaterThan(1);
      expect(finalContext!.cumulativeContext.keyInsights).toContain(
        expect.stringContaining('resistor')
      );
    });

    it('should handle context summarization when turn limit is reached', async () => {
      const sessionId = 'summarization-test-session';
      const context = await contextService.createContext(sessionId);

      // Add multiple turns to trigger summarization
      for (let i = 1; i <= 25; i++) {
        const query: ProcessedQuery = {
          id: `query-${i}`,
          originalText: `Question ${i} about electrical components`,
          processedText: `Question ${i} about electrical components`,
          intent: 'component_identification',
          entities: [
            { text: `component${i}`, type: 'electrical_part', confidence: 0.8 }
          ],
          metadata: {
            timestamp: new Date(),
            confidence: 0.8,
            processingTimeMs: 100
          }
        };

        const response: AnalysisResult = {
          id: `response-${i}`,
          queryId: `query-${i}`,
          analysisType: 'component_identification',
          result: {
            summary: `Answer ${i} about components`,
            confidence: 0.85,
            evidence: [`Evidence ${i}`]
          },
          metadata: {
            timestamp: new Date(),
            processingTimeMs: 200,
            model: 'gpt-4'
          }
        };

        await contextService.addTurn(context.id, query, response);
      }

      const longContext = await contextService.getContext(context.id);
      expect(longContext!.conversationThread).toHaveLength(25);

      // Trigger summarization
      const summarizationResult = await contextSummarizer.summarizeContext(longContext!);

      expect(summarizationResult.summary).toBeDefined();
      expect(summarizationResult.keyPoints.length).toBeGreaterThan(0);
      expect(summarizationResult.compressionRatio).toBeLessThan(1);
      expect(summarizationResult.relevantEntities.length).toBeGreaterThan(0);

      // Verify summarization preserves important information
      expect(summarizationResult.summary).toContain('component');
      expect(summarizationResult.keyPoints.some(point => 
        point.includes('electrical') || point.includes('component')
      )).toBe(true);
    });

    it('should maintain performance within acceptable thresholds', async () => {
      const sessionId = 'performance-test-session';
      const context = await contextService.createContext(sessionId);

      const startTime = Date.now();

      // Process 10 queries with context management
      for (let i = 1; i <= 10; i++) {
        const query: ProcessedQuery = {
          id: `perf-query-${i}`,
          originalText: `Performance test query ${i}`,
          processedText: `Performance test query ${i}`,
          intent: 'component_identification',
          entities: [
            { text: `test_entity_${i}`, type: 'test_type', confidence: 0.8 }
          ],
          metadata: {
            timestamp: new Date(),
            confidence: 0.8,
            processingTimeMs: 50
          }
        };

        // Measure context operations
        const contextOpStart = Date.now();
        
        const currentContext = await contextService.getContext(context.id);
        const followUpResult = await followUpDetector.detectFollowUp(
          query,
          currentContext!.conversationThread
        );
        
        let enhancedQuery = query;
        if (followUpResult.isFollowUp) {
          const enhancement = await queryEnhancer.enhanceQuery(query, currentContext!);
          enhancedQuery = enhancement.originalQuery;
        }

        const response: AnalysisResult = {
          id: `perf-response-${i}`,
          queryId: query.id,
          analysisType: 'component_identification',
          result: {
            summary: `Performance test response ${i}`,
            confidence: 0.85,
            evidence: [`Performance evidence ${i}`]
          },
          metadata: {
            timestamp: new Date(),
            processingTimeMs: 150,
            model: 'gpt-4'
          }
        };

        await contextService.addTurn(context.id, enhancedQuery, response, followUpResult.isFollowUp);
        
        const contextOpEnd = Date.now();
        const contextOpTime = contextOpEnd - contextOpStart;

        // Performance assertions
        expect(contextOpTime).toBeLessThan(500); // Context operations under 500ms
      }

      const totalTime = Date.now() - startTime;
      const avgTimePerQuery = totalTime / 10;

      // Overall performance assertions
      expect(avgTimePerQuery).toBeLessThan(600); // Average under 600ms per query
      expect(totalTime).toBeLessThan(8000); // Total under 8 seconds for 10 queries

      // Verify final context state
      const finalContext = await contextService.getContext(context.id);
      expect(finalContext!.conversationThread).toHaveLength(10);
      expect(finalContext!.cumulativeContext.extractedEntities.size).toBeGreaterThan(0);
    });

    it('should handle error scenarios gracefully', async () => {
      const sessionId = 'error-handling-test-session';
      const context = await contextService.createContext(sessionId);

      // Test with malformed query
      const malformedQuery: ProcessedQuery = {
        id: 'malformed-query',
        originalText: '',
        processedText: '',
        intent: 'unknown',
        entities: [],
        metadata: {
          timestamp: new Date(),
          confidence: 0,
          processingTimeMs: 0
        }
      };

      // Should not throw error
      const followUpResult = await followUpDetector.detectFollowUp(
        malformedQuery,
        context.conversationThread
      );

      expect(followUpResult.isFollowUp).toBe(false);
      expect(followUpResult.confidence).toBe(0);

      // Test context enhancement with empty context
      const emptyContext = await contextService.createContext('empty-session');
      const enhancementResult = await queryEnhancer.enhanceQuery(malformedQuery, emptyContext);

      expect(enhancementResult.enhancedText).toBe('');
      expect(enhancementResult.contextualInformation).toBe('');
      expect(enhancementResult.resolvedAmbiguities).toHaveLength(0);

      // Test summarization with minimal data
      const minimalContext = await contextService.createContext('minimal-session');
      const minimalQuery: ProcessedQuery = {
        id: 'minimal-query',
        originalText: 'test',
        processedText: 'test',
        intent: 'test',
        entities: [],
        metadata: {
          timestamp: new Date(),
          confidence: 0.5,
          processingTimeMs: 100
        }
      };

      const minimalResponse: AnalysisResult = {
        id: 'minimal-response',
        queryId: 'minimal-query',
        analysisType: 'test',
        result: {
          summary: 'test response',
          confidence: 0.5,
          evidence: []
        },
        metadata: {
          timestamp: new Date(),
          processingTimeMs: 100,
          model: 'test'
        }
      };

      await contextService.addTurn(minimalContext.id, minimalQuery, minimalResponse);

      const summaryResult = await contextSummarizer.summarizeContext(minimalContext);
      expect(summaryResult.summary).toBeDefined();
      expect(summaryResult.summary.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Service Integration', () => {
    it('should integrate context management with NLP processing pipeline', async () => {
      const sessionId = 'nlp-integration-session';
      const context = await contextService.createContext(sessionId);

      // Simulate NLP processing results
      const nlpProcessedQuery: ProcessedQuery = {
        id: 'nlp-query-1',
        originalText: 'Analyze this circuit diagram for voltage divider configuration',
        processedText: 'Analyze this circuit diagram for voltage divider configuration',
        intent: 'circuit_analysis',
        entities: [
          { text: 'circuit diagram', type: 'document', confidence: 0.95 },
          { text: 'voltage divider', type: 'circuit_type', confidence: 0.88 },
          { text: 'configuration', type: 'analysis_aspect', confidence: 0.82 }
        ],
        metadata: {
          timestamp: new Date(),
          confidence: 0.89,
          processingTimeMs: 180
        }
      };

      const analysisResponse: AnalysisResult = {
        id: 'nlp-response-1',
        queryId: 'nlp-query-1',
        analysisType: 'circuit_analysis',
        result: {
          summary: 'This circuit shows a voltage divider with two resistors R1 and R2 in series.',
          confidence: 0.91,
          evidence: [
            'Two resistors connected in series configuration',
            'Input voltage applied across both resistors',
            'Output taken from junction between resistors'
          ]
        },
        metadata: {
          timestamp: new Date(),
          processingTimeMs: 520,
          model: 'gpt-4'
        }
      };

      // Process through context management
      await contextService.addTurn(context.id, nlpProcessedQuery, analysisResponse);

      // Follow-up query processing
      const followUpNlpQuery: ProcessedQuery = {
        id: 'nlp-query-2',
        originalText: 'What would be the output voltage if R1 is 10k and R2 is 5k?',
        processedText: 'What would be the output voltage if R1 is 10k and R2 is 5k?',
        intent: 'calculation_request',
        entities: [
          { text: 'output voltage', type: 'electrical_parameter', confidence: 0.92 },
          { text: 'R1', type: 'component_reference', confidence: 0.95 },
          { text: '10k', type: 'resistance_value', confidence: 0.98 },
          { text: 'R2', type: 'component_reference', confidence: 0.95 },
          { text: '5k', type: 'resistance_value', confidence: 0.98 }
        ],
        metadata: {
          timestamp: new Date(),
          confidence: 0.94,
          processingTimeMs: 145
        }
      };

      const updatedContext = await contextService.getContext(context.id);
      
      // Detect follow-up
      const followUpDetection = await followUpDetector.detectFollowUp(
        followUpNlpQuery,
        updatedContext!.conversationThread
      );

      expect(followUpDetection.isFollowUp).toBe(true);
      expect(followUpDetection.detectedReferences.some(ref => 
        ref.resolvedEntity?.includes('voltage divider')
      )).toBe(true);

      // Enhance with context
      const contextEnhancement = await queryEnhancer.enhanceQuery(
        followUpNlpQuery,
        updatedContext!
      );

      expect(contextEnhancement.enhancedText).toContain('voltage divider');
      expect(contextEnhancement.contextualInformation).toContain('series');

      // Verify context enrichment
      const enrichmentResult = await contextEnricher.enrichContext(
        followUpNlpQuery,
        analysisResponse,
        updatedContext!
      );

      expect(enrichmentResult.newEntities).toContain('R1');
      expect(enrichmentResult.newEntities).toContain('R2');
      expect(enrichmentResult.updatedRelationships.some(rel =>
        rel.type === 'circuit_component' && (rel.to === 'R1' || rel.to === 'R2')
      )).toBe(true);
    });

    it('should maintain session isolation across concurrent contexts', async () => {
      const session1Id = 'concurrent-session-1';
      const session2Id = 'concurrent-session-2';

      // Create contexts for both sessions
      const context1 = await contextService.createContext(session1Id);
      const context2 = await contextService.createContext(session2Id);

      // Add different content to each session
      const query1: ProcessedQuery = {
        id: 'session1-query',
        originalText: 'What is a capacitor?',
        processedText: 'What is a capacitor?',
        intent: 'component_definition',
        entities: [{ text: 'capacitor', type: 'component', confidence: 0.9 }],
        metadata: { timestamp: new Date(), confidence: 0.9, processingTimeMs: 100 }
      };

      const query2: ProcessedQuery = {
        id: 'session2-query',
        originalText: 'What is an inductor?',
        processedText: 'What is an inductor?',
        intent: 'component_definition',
        entities: [{ text: 'inductor', type: 'component', confidence: 0.9 }],
        metadata: { timestamp: new Date(), confidence: 0.9, processingTimeMs: 100 }
      };

      const response1: AnalysisResult = {
        id: 'session1-response',
        queryId: 'session1-query',
        analysisType: 'component_definition',
        result: { summary: 'A capacitor stores electrical energy', confidence: 0.9, evidence: [] },
        metadata: { timestamp: new Date(), processingTimeMs: 200, model: 'gpt-4' }
      };

      const response2: AnalysisResult = {
        id: 'session2-response',
        queryId: 'session2-query',
        analysisType: 'component_definition',
        result: { summary: 'An inductor stores magnetic energy', confidence: 0.9, evidence: [] },
        metadata: { timestamp: new Date(), processingTimeMs: 200, model: 'gpt-4' }
      };

      // Process both sessions
      await contextService.addTurn(context1.id, query1, response1);
      await contextService.addTurn(context2.id, query2, response2);

      // Verify session isolation
      const updatedContext1 = await contextService.getContext(context1.id);
      const updatedContext2 = await contextService.getContext(context2.id);

      expect(updatedContext1!.cumulativeContext.extractedEntities.has('capacitor')).toBe(true);
      expect(updatedContext1!.cumulativeContext.extractedEntities.has('inductor')).toBe(false);

      expect(updatedContext2!.cumulativeContext.extractedEntities.has('inductor')).toBe(true);
      expect(updatedContext2!.cumulativeContext.extractedEntities.has('capacitor')).toBe(false);

      // Test follow-up detection isolation
      const followUpQuery: ProcessedQuery = {
        id: 'followup-query',
        originalText: 'How does it work?',
        processedText: 'How does it work?',
        intent: 'mechanism_explanation',
        entities: [],
        metadata: { timestamp: new Date(), confidence: 0.8, processingTimeMs: 90 }
      };

      const followUp1 = await followUpDetector.detectFollowUp(
        followUpQuery,
        updatedContext1!.conversationThread
      );

      const followUp2 = await followUpDetector.detectFollowUp(
        followUpQuery,
        updatedContext2!.conversationThread
      );

      // Both should detect follow-up but with different resolutions
      expect(followUp1.isFollowUp).toBe(true);
      expect(followUp2.isFollowUp).toBe(true);

      const enhancement1 = await queryEnhancer.enhanceQuery(followUpQuery, updatedContext1!);
      const enhancement2 = await queryEnhancer.enhanceQuery(followUpQuery, updatedContext2!);

      expect(enhancement1.contextualInformation).toContain('capacitor');
      expect(enhancement1.contextualInformation).not.toContain('inductor');

      expect(enhancement2.contextualInformation).toContain('inductor');
      expect(enhancement2.contextualInformation).not.toContain('capacitor');
    });
  });
});