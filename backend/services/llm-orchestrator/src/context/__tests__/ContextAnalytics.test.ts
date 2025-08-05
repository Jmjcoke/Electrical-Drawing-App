/**
 * Unit tests for ContextAnalytics service
 */

import { ContextAnalyticsService, ContextAnalyticsConfig } from '../ContextAnalytics';
import type {
  ContextMetrics,
  ContextQualityMetrics,
  ContextUsageAnalytics,
  ConversationContext,
  ConversationTurn
} from '../../../../../shared/types/context';

describe('ContextAnalyticsService', () => {
  let analyticsService: ContextAnalyticsService;
  let config: ContextAnalyticsConfig;

  beforeEach(() => {
    config = {
      metricsRetentionDays: 30,
      aggregationIntervalMinutes: 5,
      enableRealTimeMetrics: true,
      performanceThresholds: {
        retrievalTimeMs: 150,
        enhancementTimeMs: 300,
        summarizationTimeMs: 500
      }
    };

    analyticsService = new ContextAnalyticsService(config);
  });

  describe('recordMetric', () => {
    it('should record a performance metric', () => {
      const sessionId = 'session-123';
      const contextId = 'context-456';
      
      analyticsService.recordMetric(sessionId, contextId, 'retrieval_time_ms', 100);
      
      const metrics = analyticsService.getMetrics(sessionId, contextId);
      expect(metrics).toHaveLength(1);
      expect(metrics[0]).toMatchObject({
        sessionId,
        contextId,
        metricType: 'retrieval_time_ms',
        value: 100
      });
    });

    it('should record multiple metrics for the same context', () => {
      const sessionId = 'session-123';
      const contextId = 'context-456';
      
      analyticsService.recordMetric(sessionId, contextId, 'retrieval_time_ms', 100);
      analyticsService.recordMetric(sessionId, contextId, 'context_enhancement_time_ms', 200);
      
      const metrics = analyticsService.getMetrics(sessionId, contextId);
      expect(metrics).toHaveLength(2);
      expect(metrics.map(m => m.metricType)).toEqual(['retrieval_time_ms', 'context_enhancement_time_ms']);
    });

    it('should include metadata with metrics', () => {
      const sessionId = 'session-123';
      const contextId = 'context-456';
      const metadata = { cacheHit: true, algorithm: 'v2' };
      
      analyticsService.recordMetric(sessionId, contextId, 'retrieval_time_ms', 100, metadata);
      
      const metrics = analyticsService.getMetrics(sessionId, contextId);
      expect(metrics[0].metadata).toEqual(metadata);
    });
  });

  describe('recordQualityMetrics', () => {
    it('should record quality metrics for a context', () => {
      const mockContext = createMockContext();
      const accuracyScores = {
        followUpDetectionAccuracy: 0.85,
        entityResolutionAccuracy: 0.90,
        contextRelevanceScore: 0.88
      };
      const performanceTiming = {
        retrievalTimeMs: 120,
        enhancementTimeMs: 250
      };

      analyticsService.recordQualityMetrics(mockContext, accuracyScores, performanceTiming);
      
      const qualityMetrics = analyticsService.getQualityMetrics(mockContext.id) as ContextQualityMetrics;
      expect(qualityMetrics).toBeDefined();
      expect(qualityMetrics.accuracy.followUpDetectionAccuracy).toBe(0.85);
      expect(qualityMetrics.performance.retrievalTimeMs).toBe(120);
    });

    it('should calculate storage metrics automatically', () => {
      const mockContext = createMockContext();
      
      analyticsService.recordQualityMetrics(mockContext, {}, {});
      
      const qualityMetrics = analyticsService.getQualityMetrics(mockContext.id) as ContextQualityMetrics;
      expect(qualityMetrics.storage.totalSizeBytes).toBeGreaterThan(0);
      expect(qualityMetrics.storage.turnCount).toBe(mockContext.conversationThread.length);
    });
  });

  describe('updateUsageAnalytics', () => {
    it('should update usage analytics for a session', () => {
      const sessionId = 'session-123';
      const updateData = {
        totalQueries: 10,
        followUpQueries: 6,
        contextRetrievals: 8
      };

      analyticsService.updateUsageAnalytics(sessionId, updateData);
      
      const usage = analyticsService.getUsageAnalytics(sessionId) as ContextUsageAnalytics;
      expect(usage.totalQueries).toBe(10);
      expect(usage.followUpQueries).toBe(6);
      expect(usage.contextRetrievals).toBe(8);
    });

    it('should merge updates with existing analytics', () => {
      const sessionId = 'session-123';
      
      analyticsService.updateUsageAnalytics(sessionId, { totalQueries: 5 });
      analyticsService.updateUsageAnalytics(sessionId, { followUpQueries: 3 });
      
      const usage = analyticsService.getUsageAnalytics(sessionId) as ContextUsageAnalytics;
      expect(usage.totalQueries).toBe(5);
      expect(usage.followUpQueries).toBe(3);
    });
  });

  describe('getMetrics', () => {
    it('should retrieve metrics for a specific context', () => {
      const sessionId = 'session-123';
      const contextId = 'context-456';
      
      analyticsService.recordMetric(sessionId, contextId, 'retrieval_time_ms', 100);
      
      const metrics = analyticsService.getMetrics(sessionId, contextId);
      expect(metrics).toHaveLength(1);
    });

    it('should retrieve all metrics for a session', () => {
      const sessionId = 'session-123';
      
      analyticsService.recordMetric(sessionId, 'context-1', 'retrieval_time_ms', 100);
      analyticsService.recordMetric(sessionId, 'context-2', 'retrieval_time_ms', 150);
      
      const metrics = analyticsService.getMetrics(sessionId);
      expect(metrics).toHaveLength(2);
    });

    it('should filter metrics by date range', () => {
      const sessionId = 'session-123';
      const contextId = 'context-456';
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      analyticsService.recordMetric(sessionId, contextId, 'retrieval_time_ms', 100);
      
      const metricsInRange = analyticsService.getMetrics(sessionId, contextId, yesterday, tomorrow);
      const metricsOutOfRange = analyticsService.getMetrics(sessionId, contextId, tomorrow);
      
      expect(metricsInRange).toHaveLength(1);
      expect(metricsOutOfRange).toHaveLength(0);
    });
  });

  describe('analyzePerformanceTrends', () => {
    it('should analyze improving performance trends', () => {
      // Record decreasing response times (improvement)
      const sessionId = 'session-123';
      const contextId = 'context-456';
      
      for (let i = 0; i < 10; i++) {
        analyticsService.recordMetric(sessionId, contextId, 'retrieval_time_ms', 200 - i * 10);
      }

      const trends = analyticsService.analyzePerformanceTrends('retrieval_time_ms', 10);
      expect(trends.trend).toBe('improving');
      expect(trends.changePercentage).toBeLessThan(0);
    });

    it('should analyze degrading performance trends', () => {
      // Record increasing response times (degradation)
      const sessionId = 'session-123';
      const contextId = 'context-456';
      
      for (let i = 0; i < 10; i++) {
        analyticsService.recordMetric(sessionId, contextId, 'retrieval_time_ms', 100 + i * 20);
      }

      const trends = analyticsService.analyzePerformanceTrends('retrieval_time_ms', 10);
      expect(trends.trend).toBe('degrading');
      expect(trends.changePercentage).toBeGreaterThan(0);
    });

    it('should handle stable performance trends', () => {
      // Record consistent response times
      const sessionId = 'session-123';
      const contextId = 'context-456';
      
      for (let i = 0; i < 10; i++) {
        analyticsService.recordMetric(sessionId, contextId, 'retrieval_time_ms', 150 + (i % 2)); // Small variation
      }

      const trends = analyticsService.analyzePerformanceTrends('retrieval_time_ms', 10);
      expect(trends.trend).toBe('stable');
      expect(Math.abs(trends.changePercentage)).toBeLessThan(5);
    });
  });

  describe('generateAnalyticsSummary', () => {
    it('should generate comprehensive analytics summary', () => {
      const sessionId = 'session-123';
      const contextId = 'context-456';
      const mockContext = createMockContext();
      
      // Record sample data
      analyticsService.recordMetric(sessionId, contextId, 'retrieval_time_ms', 120);
      analyticsService.recordMetric(sessionId, contextId, 'context_enhancement_time_ms', 280);
      analyticsService.recordQualityMetrics(mockContext, { contextRelevanceScore: 0.85 }, {});
      
      const summary = analyticsService.generateAnalyticsSummary(sessionId);
      
      expect(summary.overview.totalSessions).toBe(1);
      expect(summary.overview.totalMetrics).toBe(2);
      expect(summary.quality.avgRelevanceScore).toBe(0.85);
      expect(summary.recommendations).toBeInstanceOf(Array);
    });

    it('should provide appropriate performance grade', () => {
      const sessionId = 'session-123';
      const contextId = 'context-456';
      const mockContext = createMockContext();
      
      // Record excellent performance
      analyticsService.recordMetric(sessionId, contextId, 'retrieval_time_ms', 50);
      analyticsService.recordQualityMetrics(mockContext, { contextRelevanceScore: 0.95 }, {});
      
      const summary = analyticsService.generateAnalyticsSummary(sessionId);
      expect(['A', 'B']).toContain(summary.quality.performanceGrade);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty analytics gracefully', () => {
      const metrics = analyticsService.getMetrics('nonexistent-session');
      expect(metrics).toEqual([]);
      
      const qualityMetrics = analyticsService.getQualityMetrics('nonexistent-context');
      expect(qualityMetrics).toBeNull();
    });

    it('should handle metrics cleanup', () => {
      // Set a very short retention period for testing
      const shortRetentionConfig = {
        ...config,
        metricsRetentionDays: 0
      };
      const shortRetentionService = new ContextAnalyticsService(shortRetentionConfig);
      
      const sessionId = 'session-123';
      const contextId = 'context-456';
      
      shortRetentionService.recordMetric(sessionId, contextId, 'retrieval_time_ms', 100);
      
      // Wait a bit for cleanup to potentially occur
      setTimeout(() => {
        const metrics = shortRetentionService.getMetrics(sessionId, contextId);
        expect(metrics).toHaveLength(0);
      }, 10);
    });

    it('should handle performance trends with insufficient data', () => {
      const trends = analyticsService.analyzePerformanceTrends('retrieval_time_ms', 100);
      expect(trends.trend).toBe('stable');
      expect(trends.averageValue).toBe(0);
    });
  });
});

// Helper function to create mock conversation context
function createMockContext(): ConversationContext {
  return {
    id: 'context-123',
    sessionId: 'session-456',
    conversationThread: [
      {
        id: 'turn-1',
        turnNumber: 1,
        query: {
          id: 'query-1',
          originalText: 'What is this component?',
          cleanedText: 'What is this component?',
          intent: { type: 'component_identification', confidence: 0.9, reasoning: 'Direct component question' },
          intentConfidence: 0.9,
          entities: [
            {
              text: 'component',
              type: 'component',
              confidence: 0.8,
              position: { start: 13, end: 22 },
              metadata: {}
            }
          ],
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
            stagesCompleted: ['cleaning', 'intent', 'entity'],
            warnings: [],
            debug: {}
          },
          timestamp: new Date()
        },
        response: {
          summary: 'This appears to be a resistor',
          components: [],
          confidence: { overall: 0.8, breakdown: {}, reasoning: 'High confidence match' },
          consensus: { agreementLevel: 0.9, conflictingResponses: [], consensusResponse: 'Resistor identified' }
        },
        contextContributions: ['entity:component:component'],
        followUpDetected: false,
        timestamp: new Date()
      }
    ] as ConversationTurn[],
    cumulativeContext: {
      extractedEntities: new Map([['component:component', [{
        text: 'component',
        type: 'component',
        confidence: 0.8,
        context: 'What is this component?',
        turnId: 'turn-1',
        position: 13,
        firstMentioned: new Date(),
        mentions: 1
      }]]]),
      documentContext: [],
      topicProgression: [],
      keyInsights: ['This appears to be a resistor'],
      relationshipMap: []
    },
    lastUpdated: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    metadata: {
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1,
      compressionLevel: 0,
      tags: []
    }
  };
}