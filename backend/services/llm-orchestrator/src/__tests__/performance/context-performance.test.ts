/**
 * Context Performance Tests
 * Performance benchmarks for context retrieval, enrichment, and processing speed
 */

import { ConversationContextService } from '../../context/ConversationContext';
import { FollowUpDetectorService } from '../../context/FollowUpDetector';
import { ContextEnricherService } from '../../context/ContextEnricher';
import { ContextSummarizerService } from '../../context/ContextSummarizer';
import { ContextAwareQueryEnhancerService } from '../../context/ContextAwareQueryEnhancer';
import type {
  ContextStorageConfig,
  FollowUpDetectorConfig,
  ContextEnricherConfig,
  ContextSummarizerConfig,
  QueryEnhancerConfig,
  ProcessedQuery,
  AnalysisResult
} from '../../../../../shared/types/context';

// Performance measurement utilities
const measureAsync = async <T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> => {
  const start = performance.now();
  const result = await operation();
  const end = performance.now();
  return { result, duration: end - start };
};

const measureSync = <T>(operation: () => T): { result: T; duration: number } => {
  const start = performance.now();
  const result = operation();
  const end = performance.now();
  return { result, duration: end - start };
};

const generateLargeContent = (baseText: string, multiplier: number = 10): string => {
  return `${baseText} `.repeat(multiplier).trim();
};

const createTestQuery = (id: string, content: string, entities: Array<{ text: string; type: string; confidence: number }> = []): ProcessedQuery => ({
  id,
  originalText: content,
  processedText: content,
  intent: 'performance_test',
  entities,
  metadata: {
    timestamp: new Date(),
    confidence: 0.85,
    processingTimeMs: 100
  }
});

const createTestResponse = (queryId: string, content: string): AnalysisResult => ({
  id: `response-${queryId}`,
  queryId,
  analysisType: 'performance_test',
  result: {
    summary: content,
    confidence: 0.88,
    evidence: [`Evidence for ${queryId}`]
  },
  metadata: {
    timestamp: new Date(),
    processingTimeMs: 200,
    model: 'gpt-4'
  }
});

describe('Context Performance Tests', () => {
  let contextService: ConversationContextService;
  let followUpDetector: FollowUpDetectorService;
  let contextEnricher: ContextEnricherService;
  let contextSummarizer: ContextSummarizerService;
  let queryEnhancer: ContextAwareQueryEnhancerService;

  beforeEach(() => {
    const contextConfig: ContextStorageConfig = {
      maxTurnsPerContext: 100,
      compressionThreshold: 5000,
      expirationHours: 24,
      cleanupIntervalMinutes: 60
    };

    const followUpConfig: FollowUpDetectorConfig = {
      confidenceThreshold: 0.7,
      maxRecentTurns: 10,
      enabledDetectionTypes: ['pronoun', 'temporal', 'implicit', 'spatial']
    };

    const enricherConfig: ContextEnricherConfig = {
      maxContextTurns: 15,
      relevanceThreshold: 0.6,
      semanticSimilarityThreshold: 0.7,
      mergeSimilarityThreshold: 0.8
    };

    const summarizerConfig: ContextSummarizerConfig = {
      maxTurnsBeforeSummarization: 50,
      targetCompressionRatio: 0.6,
      relevanceThreshold: 0.7,
      preserveRecentTurns: 10
    };

    const enhancerConfig: QueryEnhancerConfig = {
      maxContextLength: 3000,
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

  describe('Context Retrieval Performance', () => {
    it('should retrieve contexts within performance thresholds', async () => {
      const sessionId = 'retrieval-performance-session';
      const context = await contextService.createContext(sessionId);

      // Add substantial content to context
      for (let i = 1; i <= 20; i++) {
        const query = createTestQuery(
          `perf-query-${i}`,
          generateLargeContent(`Performance test query ${i} about electrical components`, 15),
          [{ text: `component_${i}`, type: 'electrical_component', confidence: 0.9 }]
        );

        const response = createTestResponse(
          query.id,
          generateLargeContent(`Performance test response ${i} with detailed analysis`, 20)
        );

        await contextService.addTurn(context.id, query, response);
      }

      // Measure context retrieval performance
      const retrievalMeasurements: number[] = [];
      
      for (let i = 0; i < 50; i++) {
        const { duration } = await measureAsync(() => contextService.getContext(context.id));
        retrievalMeasurements.push(duration);
      }

      // Performance assertions
      const avgRetrievalTime = retrievalMeasurements.reduce((sum, time) => sum + time, 0) / retrievalMeasurements.length;
      const maxRetrievalTime = Math.max(...retrievalMeasurements);
      const minRetrievalTime = Math.min(...retrievalMeasurements);

      expect(avgRetrievalTime).toBeLessThan(150); // Average under 150ms
      expect(maxRetrievalTime).toBeLessThan(300); // Maximum under 300ms
      expect(minRetrievalTime).toBeGreaterThan(0); // Sanity check

      // Verify retrieval consistency (95th percentile)
      const sortedTimes = retrievalMeasurements.sort((a, b) => a - b);
      const p95Time = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
      expect(p95Time).toBeLessThan(250); // 95% of retrievals under 250ms

      console.log(`Context Retrieval Performance:
        Average: ${avgRetrievalTime.toFixed(2)}ms
        P95: ${p95Time.toFixed(2)}ms
        Min: ${minRetrievalTime.toFixed(2)}ms
        Max: ${maxRetrievalTime.toFixed(2)}ms`);
    });

    it('should handle concurrent context retrievals efficiently', async () => {
      const sessions = Array.from({ length: 10 }, (_, i) => `concurrent-session-${i}`);
      const contexts = [];

      // Create multiple contexts
      for (const sessionId of sessions) {
        const context = await contextService.createContext(sessionId);
        contexts.push(context);

        // Add content to each
        for (let j = 1; j <= 10; j++) {
          const query = createTestQuery(
            `${sessionId}-query-${j}`,
            `Concurrent test query ${j}`,
            [{ text: `entity_${j}`, type: 'test_entity', confidence: 0.8 }]
          );

          const response = createTestResponse(query.id, `Concurrent test response ${j}`);
          await contextService.addTurn(context.id, query, response);
        }
      }

      // Measure concurrent retrieval performance
      const { duration: concurrentDuration } = await measureAsync(async () => {
        const promises = contexts.map(context => contextService.getContext(context.id));
        return Promise.all(promises);
      });

      // Measure sequential retrieval for comparison
      const { duration: sequentialDuration } = await measureAsync(async () => {
        const results = [];
        for (const context of contexts) {
          results.push(await contextService.getContext(context.id));
        }
        return results;
      });

      // Concurrent should be significantly faster than sequential
      expect(concurrentDuration).toBeLessThan(sequentialDuration * 0.8);
      expect(concurrentDuration).toBeLessThan(1000); // Under 1 second for 10 contexts

      console.log(`Concurrent Retrieval Performance:
        Concurrent: ${concurrentDuration.toFixed(2)}ms
        Sequential: ${sequentialDuration.toFixed(2)}ms
        Speedup: ${(sequentialDuration / concurrentDuration).toFixed(2)}x`);
    });

    it('should scale retrieval performance with context size', async () => {
      const sizeLevels = [5, 15, 30, 50];
      const performanceResults: Array<{ size: number; avgTime: number; p95Time: number }> = [];

      for (const size of sizeLevels) {
        const sessionId = `scale-test-session-${size}`;
        const context = await contextService.createContext(sessionId);

        // Add varying amounts of content
        for (let i = 1; i <= size; i++) {
          const query = createTestQuery(
            `scale-query-${i}`,
            generateLargeContent(`Scale test query ${i}`, 10),
            [{ text: `scale_entity_${i}`, type: 'scale_type', confidence: 0.85 }]
          );

          const response = createTestResponse(
            query.id,
            generateLargeContent(`Scale test response ${i}`, 12)
          );

          await contextService.addTurn(context.id, query, response);
        }

        // Measure retrieval performance for this size
        const measurements: number[] = [];
        for (let i = 0; i < 20; i++) {
          const { duration } = await measureAsync(() => contextService.getContext(context.id));
          measurements.push(duration);
        }

        const avgTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
        const sortedTimes = measurements.sort((a, b) => a - b);
        const p95Time = sortedTimes[Math.floor(sortedTimes.length * 0.95)];

        performanceResults.push({ size, avgTime, p95Time });

        // Performance should still be reasonable even with larger contexts
        expect(avgTime).toBeLessThan(size * 10); // Linear scaling with reasonable constant
        expect(p95Time).toBeLessThan(500); // P95 should remain under 500ms
      }

      // Verify scaling characteristics
      for (let i = 1; i < performanceResults.length; i++) {
        const current = performanceResults[i];
        const previous = performanceResults[i - 1];
        
        // Performance should scale sub-linearly with size
        const sizeRatio = current.size / previous.size;
        const timeRatio = current.avgTime / previous.avgTime;
        
        expect(timeRatio).toBeLessThan(sizeRatio * 1.5); // Allow some overhead but not linear scaling
      }

      console.log('Scaling Performance Results:');
      performanceResults.forEach(result => {
        console.log(`  Size ${result.size}: Avg ${result.avgTime.toFixed(2)}ms, P95 ${result.p95Time.toFixed(2)}ms`);
      });
    });
  });

  describe('Follow-Up Detection Performance', () => {
    it('should detect follow-ups within performance thresholds', async () => {
      const sessionId = 'followup-performance-session';
      const context = await contextService.createContext(sessionId);

      // Build conversation history
      const historyQueries = [];
      for (let i = 1; i <= 15; i++) {
        const query = createTestQuery(
          `history-query-${i}`,
          `What is the ${i === 1 ? 'resistor' : i === 5 ? 'capacitor' : i === 10 ? 'inductor' : 'component'} in this circuit?`,
          [{ text: i === 1 ? 'resistor' : i === 5 ? 'capacitor' : i === 10 ? 'inductor' : 'component', type: 'electrical_component', confidence: 0.9 }]
        );

        const response = createTestResponse(
          query.id,
          `This is a detailed analysis of the ${i === 1 ? 'resistor' : i === 5 ? 'capacitor' : i === 10 ? 'inductor' : 'component'} component.`
        );

        await contextService.addTurn(context.id, query, response);
        historyQueries.push(query);
      }

      const currentContext = await contextService.getContext(context.id);

      // Test follow-up detection performance with different types
      const followUpTests = [
        createTestQuery('pronoun-test', 'What is its resistance value?'),
        createTestQuery('temporal-test', 'How does that component work?'),
        createTestQuery('implicit-test', 'Show me the specifications.'),
        createTestQuery('spatial-test', 'What about the one next to it?'),
        createTestQuery('no-followup-test', 'What is a transistor?')
      ];

      const detectionMeasurements: number[] = [];

      for (const testQuery of followUpTests) {
        // Measure multiple detection attempts
        for (let i = 0; i < 20; i++) {
          const { duration } = await measureAsync(() => 
            followUpDetector.detectFollowUp(testQuery, currentContext!.conversationThread)
          );
          detectionMeasurements.push(duration);
        }
      }

      // Performance assertions
      const avgDetectionTime = detectionMeasurements.reduce((sum, time) => sum + time, 0) / detectionMeasurements.length;
      const maxDetectionTime = Math.max(...detectionMeasurements);
      const sortedTimes = detectionMeasurements.sort((a, b) => a - b);
      const p95Time = sortedTimes[Math.floor(sortedTimes.length * 0.95)];

      expect(avgDetectionTime).toBeLessThan(200); // Average under 200ms
      expect(maxDetectionTime).toBeLessThan(400); // Maximum under 400ms
      expect(p95Time).toBeLessThan(300); // P95 under 300ms

      console.log(`Follow-Up Detection Performance:
        Average: ${avgDetectionTime.toFixed(2)}ms
        P95: ${p95Time.toFixed(2)}ms
        Max: ${maxDetectionTime.toFixed(2)}ms`);
    });

    it('should maintain detection performance with large conversation history', async () => {
      const sessionId = 'large-history-session';
      const context = await contextService.createContext(sessionId);

      // Build large conversation history
      for (let i = 1; i <= 100; i++) {
        const query = createTestQuery(
          `large-history-query-${i}`,
          `Query ${i} about electrical analysis with detailed technical content`,
          [{ text: `technical_term_${i}`, type: 'technical_term', confidence: 0.8 }]
        );

        const response = createTestResponse(
          query.id,
          generateLargeContent(`Detailed technical response ${i}`, 8)
        );

        await contextService.addTurn(context.id, query, response);
      }

      const largeContext = await contextService.getContext(context.id);
      expect(largeContext!.conversationThread.length).toBe(100);

      // Test detection performance with large history
      const followUpQuery = createTestQuery('large-history-followup', 'What about that component?');

      const largeMeasurements: number[] = [];
      for (let i = 0; i < 30; i++) {
        const { duration } = await measureAsync(() =>
          followUpDetector.detectFollowUp(followUpQuery, largeContext!.conversationThread)
        );
        largeMeasurements.push(duration);
      }

      const avgLargeTime = largeMeasurements.reduce((sum, time) => sum + time, 0) / largeMeasurements.length;
      
      // Should still perform well with large history due to windowing
      expect(avgLargeTime).toBeLessThan(250); // Average under 250ms even with large history

      console.log(`Large History Detection Performance:
        Average: ${avgLargeTime.toFixed(2)}ms
        History Size: 100 turns`);
    });
  });

  describe('Context Enrichment Performance', () => {
    it('should enrich contexts within performance thresholds', async () => {
      const sessionId = 'enrichment-performance-session';
      const context = await contextService.createContext(sessionId);

      // Build rich context for enrichment
      for (let i = 1; i <= 25; i++) {
        const query = createTestQuery(
          `enrich-query-${i}`,
          `Query ${i} about ${i % 3 === 0 ? 'resistors' : i % 3 === 1 ? 'capacitors' : 'inductors'}`,
          [
            { text: i % 3 === 0 ? 'resistor' : i % 3 === 1 ? 'capacitor' : 'inductor', type: 'component', confidence: 0.9 },
            { text: `value_${i}`, type: 'parameter', confidence: 0.8 }
          ]
        );

        const response = createTestResponse(
          query.id,
          `Response ${i} with detailed component analysis and technical specifications`
        );

        await contextService.addTurn(context.id, query, response);
      }

      const richContext = await contextService.getContext(context.id);

      // Test enrichment performance
      const enrichmentMeasurements: number[] = [];
      
      for (let i = 0; i < 25; i++) {
        const testQuery = createTestQuery(
          `enrichment-test-${i}`,
          'How do electrical components interact in circuits?',
          [{ text: 'electrical components', type: 'general_term', confidence: 0.8 }]
        );

        const testResponse = createTestResponse(
          testQuery.id,
          'Components interact through electrical connections and shared current paths.'
        );

        const { duration } = await measureAsync(() =>
          contextEnricher.enrichContext(testQuery, testResponse, richContext!)
        );
        
        enrichmentMeasurements.push(duration);
      }

      // Performance assertions
      const avgEnrichmentTime = enrichmentMeasurements.reduce((sum, time) => sum + time, 0) / enrichmentMeasurements.length;
      const maxEnrichmentTime = Math.max(...enrichmentMeasurements);
      const sortedEnrichmentTimes = enrichmentMeasurements.sort((a, b) => a - b);
      const p95EnrichmentTime = sortedEnrichmentTimes[Math.floor(sortedEnrichmentTimes.length * 0.95)];

      expect(avgEnrichmentTime).toBeLessThan(300); // Average under 300ms
      expect(maxEnrichmentTime).toBeLessThan(600); // Maximum under 600ms
      expect(p95EnrichmentTime).toBeLessThan(450); // P95 under 450ms

      console.log(`Context Enrichment Performance:
        Average: ${avgEnrichmentTime.toFixed(2)}ms
        P95: ${p95EnrichmentTime.toFixed(2)}ms
        Max: ${maxEnrichmentTime.toFixed(2)}ms`);
    });

    it('should handle semantic similarity calculations efficiently', async () => {
      const sessionId = 'similarity-performance-session';
      const context = await contextService.createContext(sessionId);

      // Create diverse content for similarity testing
      const topics = ['resistors', 'capacitors', 'inductors', 'transistors', 'diodes', 'transformers'];
      
      for (let i = 1; i <= 30; i++) {
        const topic = topics[i % topics.length];
        const query = createTestQuery(
          `similarity-query-${i}`,
          generateLargeContent(`Detailed analysis of ${topic} in electronic circuits`, 12),
          [{ text: topic, type: 'component_type', confidence: 0.9 }]
        );

        const response = createTestResponse(
          query.id,
          generateLargeContent(`Comprehensive response about ${topic} characteristics and applications`, 15)
        );

        await contextService.addTurn(context.id, query, response);
      }

      const diverseContext = await contextService.getContext(context.id);

      // Test similarity calculation performance
      const similarityMeasurements: number[] = [];

      for (let i = 0; i < 20; i++) {
        const testQuery = createTestQuery(
          `similarity-test-${i}`,
          'Analysis of electronic component behavior in complex circuits'
        );

        const { duration } = await measureAsync(() =>
          contextEnricher.retrieveRelevantContext({
            currentQuery: testQuery.originalText,
            sessionId: diverseContext!.sessionId,
            maxContextTurns: 10,
            relevanceThreshold: 0.6,
            contextTypes: ['entity', 'relationship']
          }, diverseContext!)
        );

        similarityMeasurements.push(duration);
      }

      const avgSimilarityTime = similarityMeasurements.reduce((sum, time) => sum + time, 0) / similarityMeasurements.length;
      
      expect(avgSimilarityTime).toBeLessThan(200); // Similarity calculations under 200ms

      console.log(`Semantic Similarity Performance:
        Average: ${avgSimilarityTime.toFixed(2)}ms
        Context Size: 30 turns`);
    });
  });

  describe('Query Enhancement Performance', () => {
    it('should enhance queries within performance thresholds', async () => {
      const sessionId = 'enhancement-performance-session';
      const context = await contextService.createContext(sessionId);

      // Build context with entities and relationships
      for (let i = 1; i <= 20; i++) {
        const query = createTestQuery(
          `enhancement-query-${i}`,
          `Analysis of circuit component ${i} with specifications and requirements`,
          [
            { text: `component_${i}`, type: 'circuit_element', confidence: 0.9 },
            { text: `specification_${i}`, type: 'requirement', confidence: 0.85 }
          ]
        );

        const response = createTestResponse(
          query.id,
          `Detailed analysis of component ${i} including technical specifications and usage guidelines`
        );

        await contextService.addTurn(context.id, query, response);
      }

      const enhancementContext = await contextService.getContext(context.id);

      // Test query enhancement performance
      const enhancementMeasurements: number[] = [];
      const ambiguousQueries = [
        'What is its value?',
        'How does that work?',
        'Show me the specifications.',
        'What about the previous one?',
        'Can you explain this component?'
      ];

      for (const queryText of ambiguousQueries) {
        for (let i = 0; i < 10; i++) {
          const ambiguousQuery = createTestQuery(`ambiguous-${i}`, queryText);
          
          const { duration } = await measureAsync(() =>
            queryEnhancer.enhanceQuery(ambiguousQuery, enhancementContext!)
          );
          
          enhancementMeasurements.push(duration);
        }
      }

      // Performance assertions
      const avgEnhancementTime = enhancementMeasurements.reduce((sum, time) => sum + time, 0) / enhancementMeasurements.length;
      const maxEnhancementTime = Math.max(...enhancementMeasurements);
      const sortedEnhancementTimes = enhancementMeasurements.sort((a, b) => a - b);
      const p95EnhancementTime = sortedEnhancementTimes[Math.floor(sortedEnhancementTimes.length * 0.95)];

      expect(avgEnhancementTime).toBeLessThan(300); // Average under 300ms
      expect(maxEnhancementTime).toBeLessThan(600); // Maximum under 600ms
      expect(p95EnhancementTime).toBeLessThan(450); // P95 under 450ms

      console.log(`Query Enhancement Performance:
        Average: ${avgEnhancementTime.toFixed(2)}ms
        P95: ${p95EnhancementTime.toFixed(2)}ms
        Max: ${maxEnhancementTime.toFixed(2)}ms`);
    });

    it('should handle entity resolution efficiently', async () => {
      const sessionId = 'entity-resolution-session';
      const context = await contextService.createContext(sessionId);

      // Create context with many entities for resolution testing
      const entityTypes = ['resistor', 'capacitor', 'transistor', 'diode', 'voltage_source'];
      
      for (let i = 1; i <= 50; i++) {
        const entityType = entityTypes[i % entityTypes.length];
        const query = createTestQuery(
          `entity-query-${i}`,
          `The ${entityType} labeled R${i} has specific characteristics and requirements`,
          [
            { text: entityType, type: 'component_type', confidence: 0.95 },
            { text: `R${i}`, type: 'component_id', confidence: 0.9 }
          ]
        );

        const response = createTestResponse(
          query.id,
          `Component R${i} is a ${entityType} with the following specifications and operational parameters`
        );

        await contextService.addTurn(context.id, query, response);
      }

      const entityRichContext = await contextService.getContext(context.id);

      // Test entity resolution performance
      const resolutionMeasurements: number[] = [];
      const ambiguousReferences = [
        'What is the value of R5?',
        'How does that transistor work?',
        'Show specifications for the diode.',
        'What about the voltage source?',
        'Can you analyze this component?'
      ];

      for (const referenceText of ambiguousReferences) {
        for (let i = 0; i < 8; i++) {
          const referenceQuery = createTestQuery(`reference-${i}`, referenceText);
          
          const { duration } = await measureAsync(() =>
            queryEnhancer.enhanceQuery(referenceQuery, entityRichContext!)
          );
          
          resolutionMeasurements.push(duration);
        }
      }

      const avgResolutionTime = resolutionMeasurements.reduce((sum, time) => sum + time, 0) / resolutionMeasurements.length;
      
      expect(avgResolutionTime).toBeLessThan(250); // Entity resolution under 250ms

      console.log(`Entity Resolution Performance:
        Average: ${avgResolutionTime.toFixed(2)}ms
        Entity Count: ~150 entities`);
    });
  });

  describe('Context Summarization Performance', () => {
    it('should summarize large contexts within performance thresholds', async () => {
      const sessionId = 'summarization-performance-session';
      const context = await contextService.createContext(sessionId);

      // Build large context requiring summarization
      for (let i = 1; i <= 60; i++) {
        const query = createTestQuery(
          `summary-query-${i}`,
          generateLargeContent(`Complex electrical analysis query ${i} with detailed technical requirements`, 20),
          [
            { text: `analysis_${i}`, type: 'analysis_type', confidence: 0.9 },
            { text: `requirement_${i}`, type: 'requirement', confidence: 0.85 }
          ]
        );

        const response = createTestResponse(
          query.id,
          generateLargeContent(`Comprehensive analysis result ${i} with detailed findings and recommendations`, 25)
        );

        await contextService.addTurn(context.id, query, response);
      }

      const largeContext = await contextService.getContext(context.id);
      expect(largeContext!.conversationThread.length).toBe(60);

      // Test summarization performance
      const summarizationMeasurements: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const { duration } = await measureAsync(() =>
          contextSummarizer.summarizeContext(largeContext!)
        );
        
        summarizationMeasurements.push(duration);
      }

      // Performance assertions
      const avgSummarizationTime = summarizationMeasurements.reduce((sum, time) => sum + time, 0) / summarizationMeasurements.length;
      const maxSummarizationTime = Math.max(...summarizationMeasurements);

      expect(avgSummarizationTime).toBeLessThan(500); // Average under 500ms
      expect(maxSummarizationTime).toBeLessThan(800); // Maximum under 800ms

      console.log(`Context Summarization Performance:
        Average: ${avgSummarizationTime.toFixed(2)}ms
        Max: ${maxSummarizationTime.toFixed(2)}ms
        Context Size: 60 turns`);
    });

    it('should handle compression ratios efficiently', async () => {
      const compressionLevels = [0.8, 0.6, 0.4, 0.3];
      const performanceResults: Array<{ ratio: number; avgTime: number }> = [];

      for (const targetRatio of compressionLevels) {
        const sessionId = `compression-test-${targetRatio}`;
        const context = await contextService.createContext(sessionId);

        // Build consistent context
        for (let i = 1; i <= 40; i++) {
          const query = createTestQuery(
            `compression-query-${i}`,
            generateLargeContent(`Compression test query ${i}`, 15),
            [{ text: `test_entity_${i}`, type: 'test_type', confidence: 0.8 }]
          );

          const response = createTestResponse(
            query.id,
            generateLargeContent(`Compression test response ${i}`, 18)
          );

          await contextService.addTurn(context.id, query, response);
        }

        const testContext = await contextService.getContext(context.id);

        // Test compression performance
        const measurements: number[] = [];
        const customSummarizer = new ContextSummarizerService({
          ...contextSummarizer['config'],
          targetCompressionRatio: targetRatio
        });

        for (let i = 0; i < 5; i++) {
          const { duration } = await measureAsync(() =>
            customSummarizer.summarizeContext(testContext!)
          );
          measurements.push(duration);
        }

        const avgTime = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
        performanceResults.push({ ratio: targetRatio, avgTime });

        // More aggressive compression should not take exponentially longer
        expect(avgTime).toBeLessThan(1000); // All compression levels under 1 second
      }

      console.log('Compression Performance Results:');
      performanceResults.forEach(result => {
        console.log(`  Ratio ${result.ratio}: ${result.avgTime.toFixed(2)}ms`);
      });
    });
  });

  describe('End-to-End Performance', () => {
    it('should handle complete context workflow within performance thresholds', async () => {
      const sessionId = 'e2e-performance-session';
      const context = await contextService.createContext(sessionId);

      // Build initial context
      for (let i = 1; i <= 10; i++) {
        const query = createTestQuery(
          `e2e-initial-${i}`,
          `Initial context query ${i} about electrical circuit analysis`,
          [{ text: `circuit_element_${i}`, type: 'circuit_element', confidence: 0.9 }]
        );

        const response = createTestResponse(query.id, `Initial response ${i} with circuit analysis`);
        await contextService.addTurn(context.id, query, response);
      }

      // Measure complete workflow performance
      const workflowMeasurements: number[] = [];

      for (let i = 1; i <= 20; i++) {
        const { duration } = await measureAsync(async () => {
          // Step 1: Retrieve current context
          const currentContext = await contextService.getContext(context.id);
          
          // Step 2: Create follow-up query
          const followUpQuery = createTestQuery(
            `e2e-followup-${i}`,
            `What about that component's specifications?`
          );

          // Step 3: Detect follow-up
          const followUpResult = await followUpDetector.detectFollowUp(
            followUpQuery,
            currentContext!.conversationThread
          );

          // Step 4: Enhance query if follow-up
          let enhancedQuery = followUpQuery;
          if (followUpResult.isFollowUp) {
            const enhancement = await queryEnhancer.enhanceQuery(followUpQuery, currentContext!);
            enhancedQuery = enhancement.originalQuery;
          }

          // Step 5: Create response
          const response = createTestResponse(
            enhancedQuery.id,
            `End-to-end response ${i} with enhanced context`
          );

          // Step 6: Add turn with enrichment
          await contextService.addTurn(context.id, enhancedQuery, response, followUpResult.isFollowUp);

          // Step 7: Enrich context
          await contextEnricher.enrichContext(enhancedQuery, response, currentContext!);

          return { followUp: followUpResult.isFollowUp };
        });

        workflowMeasurements.push(duration);
      }

      // Performance assertions for complete workflow
      const avgWorkflowTime = workflowMeasurements.reduce((sum, time) => sum + time, 0) / workflowMeasurements.length;
      const maxWorkflowTime = Math.max(...workflowMeasurements);
      const sortedWorkflowTimes = workflowMeasurements.sort((a, b) => a - b);
      const p95WorkflowTime = sortedWorkflowTimes[Math.floor(sortedWorkflowTimes.length * 0.95)];

      expect(avgWorkflowTime).toBeLessThan(600); // Average complete workflow under 600ms
      expect(maxWorkflowTime).toBeLessThan(1200); // Maximum under 1.2 seconds
      expect(p95WorkflowTime).toBeLessThan(900); // P95 under 900ms

      console.log(`End-to-End Workflow Performance:
        Average: ${avgWorkflowTime.toFixed(2)}ms
        P95: ${p95WorkflowTime.toFixed(2)}ms
        Max: ${maxWorkflowTime.toFixed(2)}ms
        Operations: 20 complete workflows`);
    });

    it('should maintain performance under sustained load', async () => {
      const sessionId = 'sustained-load-session';
      const context = await contextService.createContext(sessionId);

      const loadTestDuration = 30000; // 30 seconds
      const operationInterval = 100; // Operation every 100ms
      
      const performanceMetrics: Array<{ timestamp: number; duration: number; operation: string }> = [];
      const startTime = Date.now();

      // Sustained load test
      while (Date.now() - startTime < loadTestDuration) {
        const operationStart = Date.now();
        
        try {
          // Vary operations to simulate real usage
          const operationType = Math.random();
          
          if (operationType < 0.4) {
            // Context retrieval (40%)
            const { duration } = await measureAsync(() => contextService.getContext(context.id));
            performanceMetrics.push({ timestamp: Date.now(), duration, operation: 'retrieval' });
            
          } else if (operationType < 0.7) {
            // Add turn (30%)
            const turnIndex = performanceMetrics.filter(m => m.operation === 'add_turn').length + 1;
            const query = createTestQuery(`load-query-${turnIndex}`, `Load test query ${turnIndex}`);
            const response = createTestResponse(query.id, `Load test response ${turnIndex}`);
            
            const { duration } = await measureAsync(() => 
              contextService.addTurn(context.id, query, response)
            );
            performanceMetrics.push({ timestamp: Date.now(), duration, operation: 'add_turn' });
            
          } else if (operationType < 0.9) {
            // Follow-up detection (20%)
            const currentContext = await contextService.getContext(context.id);
            const testQuery = createTestQuery('load-followup', 'What about that?');
            
            const { duration } = await measureAsync(() =>
              followUpDetector.detectFollowUp(testQuery, currentContext!.conversationThread)
            );
            performanceMetrics.push({ timestamp: Date.now(), duration, operation: 'followup_detection' });
            
          } else {
            // Query enhancement (10%)
            const currentContext = await contextService.getContext(context.id);
            const testQuery = createTestQuery('load-enhancement', 'Enhance this query');
            
            const { duration } = await measureAsync(() =>
              queryEnhancer.enhanceQuery(testQuery, currentContext!)
            );
            performanceMetrics.push({ timestamp: Date.now(), duration, operation: 'query_enhancement' });
          }
          
        } catch (error) {
          console.error('Load test operation failed:', error);
        }

        // Maintain operation interval
        const operationEnd = Date.now();
        const elapsed = operationEnd - operationStart;
        if (elapsed < operationInterval) {
          await new Promise(resolve => setTimeout(resolve, operationInterval - elapsed));
        }
      }

      // Analyze sustained load performance
      const operationTypes = ['retrieval', 'add_turn', 'followup_detection', 'query_enhancement'];
      
      for (const opType of operationTypes) {
        const opMetrics = performanceMetrics.filter(m => m.operation === opType);
        if (opMetrics.length > 0) {
          const avgDuration = opMetrics.reduce((sum, m) => sum + m.duration, 0) / opMetrics.length;
          const maxDuration = Math.max(...opMetrics.map(m => m.duration));
          
          // Performance should remain stable under load
          expect(avgDuration).toBeLessThan(800); // Average under 800ms
          expect(maxDuration).toBeLessThan(2000); // Maximum under 2 seconds
          
          console.log(`Sustained Load - ${opType}:
            Operations: ${opMetrics.length}
            Average: ${avgDuration.toFixed(2)}ms
            Max: ${maxDuration.toFixed(2)}ms`);
        }
      }

      expect(performanceMetrics.length).toBeGreaterThan(200); // Should complete many operations
    });
  });
});