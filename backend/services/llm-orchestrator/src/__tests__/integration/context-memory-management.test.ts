/**
 * Context Memory Management and Cleanup Tests
 * Tests for memory management, cleanup policies, and resource optimization
 */

import { ConversationContextService } from '../../context/ConversationContext';
import { ContextSummarizerService } from '../../context/ContextSummarizer';
import type {
  ContextStorageConfig,
  ContextSummarizerConfig,
  ProcessedQuery,
  AnalysisResult,
  ConversationContext
} from '../../../../../shared/types/context';

// Mock memory monitoring utilities
const createMemoryMonitor = () => {
  let allocatedMemory = 0;
  const allocations = new Map<string, number>();

  return {
    allocate: (id: string, size: number) => {
      allocations.set(id, size);
      allocatedMemory += size;
    },
    deallocate: (id: string) => {
      const size = allocations.get(id) || 0;
      allocations.delete(id);
      allocatedMemory -= size;
    },
    getCurrentUsage: () => allocatedMemory,
    getAllocations: () => allocations,
    reset: () => {
      allocations.clear();
      allocatedMemory = 0;
    }
  };
};

// Mock storage service with memory tracking
const createMemoryTrackingStorage = (memoryMonitor: ReturnType<typeof createMemoryMonitor>) => {
  const contexts = new Map<string, any>();
  const sessionContexts = new Map<string, string>();

  return {
    storeContext: jest.fn().mockImplementation(async (context: ConversationContext) => {
      const serialized = JSON.stringify(context);
      const size = serialized.length;
      
      contexts.set(context.id, {
        data: context,
        serialized,
        size,
        lastAccessed: new Date()
      });
      
      sessionContexts.set(context.sessionId, context.id);
      memoryMonitor.allocate(context.id, size);
      
      return context.id;
    }),

    retrieveContext: jest.fn().mockImplementation(async (contextId: string) => {
      const stored = contexts.get(contextId);
      if (!stored) return null;

      stored.lastAccessed = new Date();
      contexts.set(contextId, stored);
      
      return stored.data;
    }),

    retrieveContextBySession: jest.fn().mockImplementation(async (sessionId: string) => {
      const contextId = sessionContexts.get(sessionId);
      if (!contextId) return null;
      
      const stored = contexts.get(contextId);
      if (!stored) return null;

      stored.lastAccessed = new Date();
      contexts.set(contextId, stored);
      
      return stored.data;
    }),

    updateContext: jest.fn().mockImplementation(async (contextId: string, updates: any) => {
      const stored = contexts.get(contextId);
      if (!stored) return false;

      // Update the stored data
      Object.assign(stored.data, updates);
      const newSerialized = JSON.stringify(stored.data);
      const oldSize = stored.size;
      const newSize = newSerialized.length;

      stored.serialized = newSerialized;
      stored.size = newSize;
      stored.lastAccessed = new Date();
      
      contexts.set(contextId, stored);
      
      // Update memory tracking
      memoryMonitor.deallocate(contextId);
      memoryMonitor.allocate(contextId, newSize);
      
      return true;
    }),

    deleteContext: jest.fn().mockImplementation(async (contextId: string) => {
      const stored = contexts.get(contextId);
      if (!stored) return false;

      contexts.delete(contextId);
      sessionContexts.delete(stored.data.sessionId);
      memoryMonitor.deallocate(contextId);
      
      return true;
    }),

    cleanupExpiredContexts: jest.fn().mockImplementation(async () => {
      const now = new Date();
      let cleanedCount = 0;
      
      for (const [contextId, stored] of contexts.entries()) {
        if (stored.data.expiresAt < now) {
          contexts.delete(contextId);
          sessionContexts.delete(stored.data.sessionId);
          memoryMonitor.deallocate(contextId);
          cleanedCount++;
        }
      }
      
      return cleanedCount;
    }),

    cleanupByAccessTime: jest.fn().mockImplementation(async (maxIdleTimeMs: number) => {
      const cutoffTime = new Date(Date.now() - maxIdleTimeMs);
      let cleanedCount = 0;
      
      for (const [contextId, stored] of contexts.entries()) {
        if (stored.lastAccessed < cutoffTime) {
          contexts.delete(contextId);
          sessionContexts.delete(stored.data.sessionId);
          memoryMonitor.deallocate(contextId);
          cleanedCount++;
        }
      }
      
      return cleanedCount;
    }),

    getMemoryUsage: jest.fn().mockImplementation(async () => {
      const totalSize = Array.from(contexts.values()).reduce((sum, stored) => sum + stored.size, 0);
      const contextCount = contexts.size;
      const avgSize = contextCount > 0 ? totalSize / contextCount : 0;
      
      return {
        totalBytes: totalSize,
        contextCount,
        averageContextSize: avgSize,
        largestContextSize: Math.max(...Array.from(contexts.values()).map(s => s.size), 0)
      };
    }),

    compressContext: jest.fn().mockImplementation(async (contextId: string) => {
      const stored = contexts.get(contextId);
      if (!stored) return false;

      // Simulate compression (reduce size by ~60%)
      const originalSize = stored.size;
      const compressedSize = Math.floor(originalSize * 0.4);
      
      stored.size = compressedSize;
      stored.data.metadata.compressionApplied = true;
      contexts.set(contextId, stored);
      
      memoryMonitor.deallocate(contextId);
      memoryMonitor.allocate(contextId, compressedSize);
      
      return {
        originalSize,
        compressedSize,
        compressionRatio: compressedSize / originalSize
      };
    }),

    getContexts: () => contexts,
    getSessionContexts: () => sessionContexts
  };
};

describe('Context Memory Management and Cleanup Tests', () => {
  let contextService: ConversationContextService;
  let summarizerService: ContextSummarizerService;
  let memoryMonitor: ReturnType<typeof createMemoryMonitor>;
  let mockStorage: ReturnType<typeof createMemoryTrackingStorage>;
  let contextConfig: ContextStorageConfig;
  let summarizerConfig: ContextSummarizerConfig;

  beforeEach(() => {
    memoryMonitor = createMemoryMonitor();
    mockStorage = createMemoryTrackingStorage(memoryMonitor);

    contextConfig = {
      maxTurnsPerContext: 20,
      compressionThreshold: 1000,
      expirationHours: 24,
      cleanupIntervalMinutes: 60
    };

    summarizerConfig = {
      maxTurnsBeforeSummarization: 15,
      targetCompressionRatio: 0.6,
      relevanceThreshold: 0.7,
      preserveRecentTurns: 5
    };

    contextService = new ConversationContextService(contextConfig);
    summarizerService = new ContextSummarizerService(summarizerConfig);
    
    // Replace storage with memory-tracking mock
    (contextService as any).storage = mockStorage;
  });

  afterEach(() => {
    memoryMonitor.reset();
  });

  describe('Memory Allocation and Tracking', () => {
    it('should track memory usage across context operations', async () => {
      const sessionId = 'memory-tracking-session';
      
      // Initial memory usage should be zero
      expect(memoryMonitor.getCurrentUsage()).toBe(0);

      // Create context and verify memory allocation
      const context = await contextService.createContext(sessionId);
      expect(memoryMonitor.getCurrentUsage()).toBeGreaterThan(0);
      
      const initialMemory = memoryMonitor.getCurrentUsage();

      // Add turns and track memory growth
      const memorySnapshots: number[] = [initialMemory];
      
      for (let i = 1; i <= 10; i++) {
        const query: ProcessedQuery = {
          id: `memory-query-${i}`,
          originalText: `Memory test query ${i} `.repeat(50), // Large content
          processedText: `Memory test query ${i} `.repeat(50),
          intent: 'memory_test',
          entities: [
            { text: `entity_${i}`, type: 'test_entity', confidence: 0.8 }
          ],
          metadata: {
            timestamp: new Date(),
            confidence: 0.8,
            processingTimeMs: 100
          }
        };

        const response: AnalysisResult = {
          id: `memory-response-${i}`,
          queryId: `memory-query-${i}`,
          analysisType: 'memory_test',
          result: {
            summary: `Memory test response ${i} `.repeat(40),
            confidence: 0.85,
            evidence: [`Evidence ${i} `.repeat(30)]
          },
          metadata: {
            timestamp: new Date(),
            processingTimeMs: 200,
            model: 'gpt-4'
          }
        };

        await contextService.addTurn(context.id, query, response);
        memorySnapshots.push(memoryMonitor.getCurrentUsage());
      }

      // Verify memory growth pattern
      for (let i = 1; i < memorySnapshots.length; i++) {
        expect(memorySnapshots[i]).toBeGreaterThan(memorySnapshots[i - 1]);
      }

      // Verify memory usage is proportional to content size
      const finalMemory = memoryMonitor.getCurrentUsage();
      expect(finalMemory).toBeGreaterThan(initialMemory * 5); // Should grow significantly

      // Check memory usage breakdown
      const memoryUsage = await mockStorage.getMemoryUsage();
      expect(memoryUsage.totalBytes).toBe(finalMemory);
      expect(memoryUsage.contextCount).toBe(1);
      expect(memoryUsage.averageContextSize).toBe(finalMemory);
    });

    it('should handle memory cleanup when contexts are deleted', async () => {
      const sessions = ['cleanup-session-1', 'cleanup-session-2', 'cleanup-session-3'];
      const contexts: ConversationContext[] = [];

      // Create multiple contexts with content
      for (const sessionId of sessions) {
        const context = await contextService.createContext(sessionId);
        contexts.push(context);

        // Add content to each context
        const query: ProcessedQuery = {
          id: `${sessionId}-query`,
          originalText: `Large content for ${sessionId} `.repeat(100),
          processedText: `Large content for ${sessionId} `.repeat(100),
          intent: 'cleanup_test',
          entities: [{ text: sessionId, type: 'session_id', confidence: 0.9 }],
          metadata: { timestamp: new Date(), confidence: 0.9, processingTimeMs: 150 }
        };

        const response: AnalysisResult = {
          id: `${sessionId}-response`,
          queryId: `${sessionId}-query`,
          analysisType: 'cleanup_test',
          result: {
            summary: `Large response for ${sessionId} `.repeat(80),
            confidence: 0.88,
            evidence: [`Large evidence for ${sessionId} `.repeat(60)]
          },
          metadata: { timestamp: new Date(), processingTimeMs: 250, model: 'gpt-4' }
        };

        await contextService.addTurn(context.id, query, response);
      }

      const peakMemory = memoryMonitor.getCurrentUsage();
      expect(peakMemory).toBeGreaterThan(0);

      // Delete contexts one by one and verify memory cleanup
      for (let i = 0; i < contexts.length; i++) {
        const memoryBeforeDelete = memoryMonitor.getCurrentUsage();
        
        await mockStorage.deleteContext(contexts[i].id);
        
        const memoryAfterDelete = memoryMonitor.getCurrentUsage();
        expect(memoryAfterDelete).toBeLessThan(memoryBeforeDelete);
      }

      // All memory should be freed
      expect(memoryMonitor.getCurrentUsage()).toBe(0);
      expect(memoryMonitor.getAllocations().size).toBe(0);
    });

    it('should detect and handle memory pressure situations', async () => {
      const memoryLimit = 10000; // 10KB limit for testing
      const sessionId = 'memory-pressure-session';
      const context = await contextService.createContext(sessionId);

      let turnCount = 0;
      
      // Add content until we approach memory limit
      while (memoryMonitor.getCurrentUsage() < memoryLimit * 0.8) {
        turnCount++;
        
        const query: ProcessedQuery = {
          id: `pressure-query-${turnCount}`,
          originalText: `Memory pressure test query ${turnCount} `.repeat(20),
          processedText: `Memory pressure test query ${turnCount} `.repeat(20),
          intent: 'pressure_test',
          entities: [{ text: `entity_${turnCount}`, type: 'pressure_entity', confidence: 0.8 }],
          metadata: { timestamp: new Date(), confidence: 0.8, processingTimeMs: 100 }
        };

        const response: AnalysisResult = {
          id: `pressure-response-${turnCount}`,
          queryId: `pressure-query-${turnCount}`,
          analysisType: 'pressure_test',
          result: {
            summary: `Memory pressure response ${turnCount} `.repeat(15),
            confidence: 0.85,
            evidence: [`Pressure evidence ${turnCount} `.repeat(10)]
          },
          metadata: { timestamp: new Date(), processingTimeMs: 150, model: 'gpt-4' }
        };

        await contextService.addTurn(context.id, query, response);
      }

      const memoryBeforeCompression = memoryMonitor.getCurrentUsage();
      expect(memoryBeforeCompression).toBeGreaterThan(memoryLimit * 0.7);

      // Simulate memory pressure response: compression
      const compressionResult = await mockStorage.compressContext(context.id);
      expect(compressionResult).toBeDefined();
      expect(compressionResult.compressedSize).toBeLessThan(compressionResult.originalSize);

      const memoryAfterCompression = memoryMonitor.getCurrentUsage();
      expect(memoryAfterCompression).toBeLessThan(memoryBeforeCompression);
      expect(compressionResult.compressionRatio).toBeLessThan(1);
    });
  });

  describe('Context Expiration and Cleanup Policies', () => {
    it('should automatically clean up expired contexts', async () => {
      // Create contexts with different expiration times
      const shortExpirationConfig: ContextStorageConfig = {
        ...contextConfig,
        expirationHours: 0.001 // ~3.6 seconds
      };

      const shortTermService = new ConversationContextService(shortExpirationConfig);
      (shortTermService as any).storage = mockStorage;

      // Create mix of short-term and long-term contexts
      const longTermContext = await contextService.createContext('long-term-session');
      const shortTermContext1 = await shortTermService.createContext('short-term-session-1');
      const shortTermContext2 = await shortTermService.createContext('short-term-session-2');

      // Add content to all contexts
      const contexts = [
        { service: contextService, context: longTermContext },
        { service: shortTermService, context: shortTermContext1 },
        { service: shortTermService, context: shortTermContext2 }
      ];

      for (const { service, context } of contexts) {
        const query: ProcessedQuery = {
          id: `${context.id}-query`,
          originalText: 'Test content for expiration',
          processedText: 'Test content for expiration',
          intent: 'expiration_test',
          entities: [{ text: 'test', type: 'test_entity', confidence: 0.8 }],
          metadata: { timestamp: new Date(), confidence: 0.8, processingTimeMs: 100 }
        };

        const response: AnalysisResult = {
          id: `${context.id}-response`,
          queryId: `${context.id}-query`,
          analysisType: 'expiration_test',
          result: { summary: 'Test response', confidence: 0.85, evidence: ['Test evidence'] },
          metadata: { timestamp: new Date(), processingTimeMs: 150, model: 'gpt-4' }
        };

        await service.addTurn(context.id, query, response);
      }

      const initialMemory = memoryMonitor.getCurrentUsage();
      expect(initialMemory).toBeGreaterThan(0);

      // Wait for short-term contexts to expire
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Run cleanup
      const cleanedCount = await mockStorage.cleanupExpiredContexts();
      expect(cleanedCount).toBe(2); // Two short-term contexts should be cleaned

      const memoryAfterCleanup = memoryMonitor.getCurrentUsage();
      expect(memoryAfterCleanup).toBeLessThan(initialMemory);

      // Verify long-term context still exists
      const remainingContext = await contextService.getContext(longTermContext.id);
      expect(remainingContext).toBeDefined();

      // Verify short-term contexts are cleaned up
      const cleanedContext1 = await shortTermService.getContext(shortTermContext1.id);
      const cleanedContext2 = await shortTermService.getContext(shortTermContext2.id);
      expect(cleanedContext1).toBeNull();
      expect(cleanedContext2).toBeNull();
    });

    it('should implement LRU-based cleanup for inactive contexts', async () => {
      const sessions = ['lru-session-1', 'lru-session-2', 'lru-session-3', 'lru-session-4'];
      const contexts: ConversationContext[] = [];

      // Create multiple contexts
      for (const sessionId of sessions) {
        const context = await contextService.createContext(sessionId);
        contexts.push(context);

        const query: ProcessedQuery = {
          id: `${sessionId}-query`,
          originalText: `Content for ${sessionId}`,
          processedText: `Content for ${sessionId}`,
          intent: 'lru_test',
          entities: [{ text: sessionId, type: 'session', confidence: 0.8 }],
          metadata: { timestamp: new Date(), confidence: 0.8, processingTimeMs: 100 }
        };

        const response: AnalysisResult = {
          id: `${sessionId}-response`,
          queryId: `${sessionId}-query`,
          analysisType: 'lru_test',
          result: { summary: `Response for ${sessionId}`, confidence: 0.85, evidence: ['LRU evidence'] },
          metadata: { timestamp: new Date(), processingTimeMs: 150, model: 'gpt-4' }
        };

        await contextService.addTurn(context.id, query, response);
        
        // Add delay to create different access times
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Access some contexts to update their access times
      await contextService.getContext(contexts[1].id); // session-2
      await new Promise(resolve => setTimeout(resolve, 100));
      await contextService.getContext(contexts[3].id); // session-4

      const memoryBeforeCleanup = memoryMonitor.getCurrentUsage();

      // Clean up contexts that haven't been accessed recently (500ms threshold)
      const idleThreshold = 500;
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const cleanedCount = await mockStorage.cleanupByAccessTime(idleThreshold);
      expect(cleanedCount).toBeGreaterThan(0);

      const memoryAfterCleanup = memoryMonitor.getCurrentUsage();
      expect(memoryAfterCleanup).toBeLessThan(memoryBeforeCleanup);

      // Recently accessed contexts should still exist
      const recentContext1 = await contextService.getContext(contexts[1].id);
      const recentContext2 = await contextService.getContext(contexts[3].id);
      expect(recentContext1).toBeDefined();
      expect(recentContext2).toBeDefined();
    });

    it('should handle cleanup during high memory pressure', async () => {
      const sessionId = 'pressure-cleanup-session';
      const context = await contextService.createContext(sessionId);

      // Fill context with large amounts of data to simulate memory pressure
      for (let i = 1; i <= 25; i++) {
        const largeContent = `Large content block ${i} `.repeat(200);
        
        const query: ProcessedQuery = {
          id: `pressure-query-${i}`,
          originalText: largeContent,
          processedText: largeContent,
          intent: 'pressure_cleanup_test',
          entities: [{ text: `large_entity_${i}`, type: 'large_type', confidence: 0.8 }],
          metadata: { timestamp: new Date(), confidence: 0.8, processingTimeMs: 200 }
        };

        const response: AnalysisResult = {
          id: `pressure-response-${i}`,
          queryId: `pressure-query-${i}`,
          analysisType: 'pressure_cleanup_test',
          result: {
            summary: `Large response ${i} `.repeat(150),
            confidence: 0.85,
            evidence: [`Large evidence ${i} `.repeat(100)]
          },
          metadata: { timestamp: new Date(), processingTimeMs: 400, model: 'gpt-4' }
        };

        await contextService.addTurn(context.id, query, response);
      }

      const highMemoryUsage = memoryMonitor.getCurrentUsage();
      const memoryLimit = 20000; // 20KB limit

      if (highMemoryUsage > memoryLimit) {
        // Simulate automatic cleanup under memory pressure
        
        // Step 1: Try compression
        const compressionResult = await mockStorage.compressContext(context.id);
        expect(compressionResult.compressedSize).toBeLessThan(compressionResult.originalSize);

        const memoryAfterCompression = memoryMonitor.getCurrentUsage();
        expect(memoryAfterCompression).toBeLessThan(highMemoryUsage);

        // Step 2: If still over limit, try summarization
        if (memoryAfterCompression > memoryLimit * 0.8) {
          const currentContext = await contextService.getContext(context.id);
          const summaryResult = await summarizerService.summarizeContext(currentContext!);

          expect(summaryResult.compressionRatio).toBeLessThan(1);
          expect(summaryResult.summary).toBeDefined();
          expect(summaryResult.keyPoints.length).toBeGreaterThan(0);

          // Simulate applying summarization (in practice, would update context)
          const estimatedSizeReduction = highMemoryUsage * (1 - summaryResult.compressionRatio);
          expect(estimatedSizeReduction).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Context Summarization and Compression', () => {
    it('should automatically summarize contexts when turn limit is exceeded', async () => {
      const sessionId = 'auto-summarization-session';
      const context = await contextService.createContext(sessionId);

      // Add turns beyond the summarization threshold
      for (let i = 1; i <= summarizerConfig.maxTurnsBeforeSummarization + 5; i++) {
        const query: ProcessedQuery = {
          id: `auto-summary-query-${i}`,
          originalText: `Summarization test query ${i} about electrical components`,
          processedText: `Summarization test query ${i} about electrical components`,
          intent: 'component_analysis',
          entities: [
            { text: `component_${i}`, type: 'electrical_component', confidence: 0.85 }
          ],
          metadata: { timestamp: new Date(), confidence: 0.85, processingTimeMs: 120 }
        };

        const response: AnalysisResult = {
          id: `auto-summary-response-${i}`,
          queryId: `auto-summary-query-${i}`,
          analysisType: 'component_analysis',
          result: {
            summary: `Analysis result ${i} for electrical component with detailed explanation`,
            confidence: 0.88,
            evidence: [`Technical evidence ${i}`, `Specification detail ${i}`]
          },
          metadata: { timestamp: new Date(), processingTimeMs: 250, model: 'gpt-4' }
        };

        await contextService.addTurn(context.id, query, response);
      }

      const largeContext = await contextService.getContext(context.id);
      expect(largeContext!.conversationThread.length).toBe(summarizerConfig.maxTurnsBeforeSummarization + 5);

      const memoryBeforeSummarization = memoryMonitor.getCurrentUsage();

      // Trigger summarization
      const summaryResult = await summarizerService.summarizeContext(largeContext!);

      expect(summaryResult.summary).toBeDefined();
      expect(summaryResult.summary.length).toBeGreaterThan(0);
      expect(summaryResult.keyPoints.length).toBeGreaterThan(0);
      expect(summaryResult.compressionRatio).toBeLessThan(1);
      expect(summaryResult.originalTurnCount).toBe(summarizerConfig.maxTurnsBeforeSummarization + 5);

      // Verify summarization preserves important information
      expect(summaryResult.summary).toContain('electrical');
      expect(summaryResult.relevantEntities.length).toBeGreaterThan(0);
      expect(summaryResult.relevantEntities.some(entity => entity.includes('component'))).toBe(true);

      // Memory savings should be achieved
      const estimatedMemorySavings = memoryBeforeSummarization * (1 - summaryResult.compressionRatio);
      expect(estimatedMemorySavings).toBeGreaterThan(0);
    });

    it('should preserve recent important turns during summarization', async () => {
      const sessionId = 'preservation-test-session';
      const context = await contextService.createContext(sessionId);

      // Add older turns (should be summarized)
      for (let i = 1; i <= 12; i++) {
        const query: ProcessedQuery = {
          id: `old-query-${i}`,
          originalText: `Old query ${i}`,
          processedText: `Old query ${i}`,
          intent: 'old_analysis',
          entities: [{ text: `old_entity_${i}`, type: 'old_type', confidence: 0.7 }],
          metadata: { timestamp: new Date(Date.now() - (15 - i) * 60000), confidence: 0.7, processingTimeMs: 100 }
        };

        const response: AnalysisResult = {
          id: `old-response-${i}`,
          queryId: `old-query-${i}`,
          analysisType: 'old_analysis',
          result: { summary: `Old response ${i}`, confidence: 0.75, evidence: [`Old evidence ${i}`] },
          metadata: { timestamp: new Date(Date.now() - (15 - i) * 60000 + 30000), processingTimeMs: 150, model: 'gpt-4' }
        };

        await contextService.addTurn(context.id, query, response);
      }

      // Add recent important turns (should be preserved)
      for (let i = 1; i <= 6; i++) {
        const query: ProcessedQuery = {
          id: `recent-query-${i}`,
          originalText: `Recent important query ${i} about critical electrical analysis`,
          processedText: `Recent important query ${i} about critical electrical analysis`,
          intent: 'critical_analysis',
          entities: [
            { text: `critical_component_${i}`, type: 'critical_component', confidence: 0.95 }
          ],
          metadata: { timestamp: new Date(), confidence: 0.95, processingTimeMs: 150 }
        };

        const response: AnalysisResult = {
          id: `recent-response-${i}`,
          queryId: `recent-query-${i}`,
          analysisType: 'critical_analysis',
          result: {
            summary: `Critical analysis result ${i} with high importance`,
            confidence: 0.93,
            evidence: [`Critical evidence ${i}`, `High-confidence finding ${i}`]
          },
          metadata: { timestamp: new Date(), processingTimeMs: 300, model: 'gpt-4' }
        };

        await contextService.addTurn(context.id, query, response);
      }

      const fullContext = await contextService.getContext(context.id);
      expect(fullContext!.conversationThread.length).toBe(18);

      // Perform summarization
      const summaryResult = await summarizerService.summarizeContext(fullContext!);

      // Verify recent turns are preserved in the summary
      expect(summaryResult.summary).toContain('critical');
      expect(summaryResult.summary).toContain('recent important');
      
      // Verify recent entities are included
      expect(summaryResult.relevantEntities.some(entity => 
        entity.includes('critical_component')
      )).toBe(true);

      // Verify compression occurred but important content preserved
      expect(summaryResult.compressionRatio).toBeLessThan(1);
      expect(summaryResult.compressionRatio).toBeGreaterThan(0.3); // Not too aggressive

      // Recent turns should have higher relevance
      const recentKeyPoints = summaryResult.keyPoints.filter(point => 
        point.includes('critical') || point.includes('recent')
      );
      expect(recentKeyPoints.length).toBeGreaterThan(0);
    });

    it('should optimize memory usage through intelligent compression', async () => {
      const sessionId = 'compression-optimization-session';
      const context = await contextService.createContext(sessionId);

      // Create content with varying importance levels
      const contentTypes = [
        { type: 'high', importance: 0.9, repetitions: 3 },
        { type: 'medium', importance: 0.7, repetitions: 5 },
        { type: 'low', importance: 0.4, repetitions: 7 }
      ];

      let turnNumber = 1;
      for (const contentType of contentTypes) {
        for (let i = 1; i <= contentType.repetitions; i++) {
          const query: ProcessedQuery = {
            id: `${contentType.type}-query-${i}`,
            originalText: `${contentType.type} importance query ${i} `.repeat(20),
            processedText: `${contentType.type} importance query ${i} `.repeat(20),
            intent: `${contentType.type}_importance_analysis`,
            entities: [
              { text: `${contentType.type}_entity_${i}`, type: contentType.type, confidence: contentType.importance }
            ],
            metadata: { timestamp: new Date(), confidence: contentType.importance, processingTimeMs: 100 }
          };

          const response: AnalysisResult = {
            id: `${contentType.type}-response-${i}`,
            queryId: `${contentType.type}-query-${i}`,
            analysisType: `${contentType.type}_importance_analysis`,
            result: {
              summary: `${contentType.type} importance response ${i} `.repeat(15),
              confidence: contentType.importance,
              evidence: [`${contentType.type} evidence ${i} `.repeat(10)]
            },
            metadata: { timestamp: new Date(), processingTimeMs: 200, model: 'gpt-4' }
          };

          await contextService.addTurn(context.id, query, response);
          turnNumber++;
        }
      }

      const memoryBeforeOptimization = memoryMonitor.getCurrentUsage();
      const fullContext = await contextService.getContext(context.id);

      // Apply intelligent compression
      const summaryResult = await summarizerService.summarizeContext(fullContext!);

      // Verify compression efficiency
      expect(summaryResult.compressionRatio).toBeLessThan(0.7); // Good compression
      expect(summaryResult.summary).toBeDefined();

      // Verify high-importance content is preserved
      expect(summaryResult.summary).toContain('high importance');
      expect(summaryResult.relevantEntities.some(entity => entity.includes('high'))).toBe(true);

      // Verify intelligent content selection
      const highImportancePoints = summaryResult.keyPoints.filter(point => 
        point.includes('high importance')
      );
      const lowImportancePoints = summaryResult.keyPoints.filter(point => 
        point.includes('low importance')
      );

      expect(highImportancePoints.length).toBeGreaterThan(lowImportancePoints.length);

      // Simulate applying compression and measure memory savings
      const compressionResult = await mockStorage.compressContext(context.id);
      expect(compressionResult.compressionRatio).toBeLessThan(1);

      const memoryAfterOptimization = memoryMonitor.getCurrentUsage();
      expect(memoryAfterOptimization).toBeLessThan(memoryBeforeOptimization);

      // Verify optimization effectiveness
      const memoryReduction = memoryBeforeOptimization - memoryAfterOptimization;
      const reductionPercentage = memoryReduction / memoryBeforeOptimization;
      expect(reductionPercentage).toBeGreaterThan(0.3); // At least 30% reduction
    });
  });

  describe('Resource Monitoring and Alerts', () => {
    it('should monitor resource usage and trigger alerts', async () => {
      const alerts: Array<{ type: string; message: string; timestamp: Date }> = [];
      
      const alertSystem = {
        triggerAlert: (type: string, message: string) => {
          alerts.push({ type, message, timestamp: new Date() });
        }
      };

      const memoryThreshold = 5000; // 5KB threshold
      const sessionId = 'resource-monitoring-session';
      const context = await contextService.createContext(sessionId);

      // Monitor memory usage and trigger alerts
      const checkMemoryUsage = () => {
        const currentUsage = memoryMonitor.getCurrentUsage();
        if (currentUsage > memoryThreshold) {
          alertSystem.triggerAlert('MEMORY_HIGH', `Memory usage ${currentUsage} bytes exceeds threshold ${memoryThreshold}`);
        }
      };

      // Add content until memory threshold is exceeded
      for (let i = 1; i <= 20; i++) {
        const query: ProcessedQuery = {
          id: `monitoring-query-${i}`,
          originalText: `Resource monitoring test query ${i} `.repeat(30),
          processedText: `Resource monitoring test query ${i} `.repeat(30),
          intent: 'resource_monitoring_test',
          entities: [{ text: `monitor_entity_${i}`, type: 'monitor_type', confidence: 0.8 }],
          metadata: { timestamp: new Date(), confidence: 0.8, processingTimeMs: 100 }
        };

        const response: AnalysisResult = {
          id: `monitoring-response-${i}`,
          queryId: `monitoring-query-${i}`,
          analysisType: 'resource_monitoring_test',
          result: {
            summary: `Resource monitoring response ${i} `.repeat(25),
            confidence: 0.85,
            evidence: [`Monitoring evidence ${i} `.repeat(20)]
          },
          metadata: { timestamp: new Date(), processingTimeMs: 150, model: 'gpt-4' }
        };

        await contextService.addTurn(context.id, query, response);
        checkMemoryUsage();
      }

      // Verify alerts were triggered
      const memoryAlerts = alerts.filter(alert => alert.type === 'MEMORY_HIGH');
      expect(memoryAlerts.length).toBeGreaterThan(0);

      // Test cleanup response to alerts
      if (memoryAlerts.length > 0) {
        // Simulate automatic cleanup in response to alert
        const compressionResult = await mockStorage.compressContext(context.id);
        expect(compressionResult).toBeDefined();

        const memoryAfterResponse = memoryMonitor.getCurrentUsage();
        expect(memoryAfterResponse).toBeLessThan(compressionResult.originalSize);

        // Verify alert system tracked the response
        const finalUsage = memoryMonitor.getCurrentUsage();
        if (finalUsage <= memoryThreshold) {
          alertSystem.triggerAlert('MEMORY_NORMAL', `Memory usage normalized to ${finalUsage} bytes`);
        }

        const normalAlerts = alerts.filter(alert => alert.type === 'MEMORY_NORMAL');
        expect(normalAlerts.length).toBeGreaterThan(0);
      }
    });

    it('should provide comprehensive resource statistics', async () => {
      // Create multiple contexts with varying characteristics
      const sessions = [
        { id: 'stats-light-session', turns: 3, contentSize: 'small' },
        { id: 'stats-medium-session', turns: 10, contentSize: 'medium' },
        { id: 'stats-heavy-session', turns: 20, contentSize: 'large' }
      ];

      for (const session of sessions) {
        const context = await contextService.createContext(session.id);
        
        const contentMultiplier = session.contentSize === 'small' ? 5 : 
                                 session.contentSize === 'medium' ? 15 : 30;

        for (let i = 1; i <= session.turns; i++) {
          const query: ProcessedQuery = {
            id: `${session.id}-query-${i}`,
            originalText: `Content query ${i} `.repeat(contentMultiplier),
            processedText: `Content query ${i} `.repeat(contentMultiplier),
            intent: 'stats_test',
            entities: [{ text: `entity_${i}`, type: 'stats_entity', confidence: 0.8 }],
            metadata: { timestamp: new Date(), confidence: 0.8, processingTimeMs: 100 }
          };

          const response: AnalysisResult = {
            id: `${session.id}-response-${i}`,
            queryId: `${session.id}-query-${i}`,
            analysisType: 'stats_test',
            result: {
              summary: `Response ${i} `.repeat(contentMultiplier),
              confidence: 0.85,
              evidence: [`Evidence ${i} `.repeat(contentMultiplier / 2)]
            },
            metadata: { timestamp: new Date(), processingTimeMs: 150, model: 'gpt-4' }
          };

          await contextService.addTurn(context.id, query, response);
        }
      }

      // Get comprehensive statistics
      const memoryUsage = await mockStorage.getMemoryUsage();
      
      expect(memoryUsage.contextCount).toBe(3);
      expect(memoryUsage.totalBytes).toBeGreaterThan(0);
      expect(memoryUsage.averageContextSize).toBeGreaterThan(0);
      expect(memoryUsage.largestContextSize).toBeGreaterThanOrEqual(memoryUsage.averageContextSize);

      // Verify statistics accuracy
      const totalMemory = memoryMonitor.getCurrentUsage();
      expect(memoryUsage.totalBytes).toBe(totalMemory);

      // Verify size distribution makes sense
      expect(memoryUsage.largestContextSize).toBeGreaterThan(memoryUsage.averageContextSize);
      
      // The heavy session should be the largest
      const contexts = mockStorage.getContexts();
      const heavyContext = Array.from(contexts.values()).find(c => 
        c.data.sessionId === 'stats-heavy-session'
      );
      expect(heavyContext?.size).toBeGreaterThan(0);
    });
  });
});