/**
 * ContextUsageAnalyzer Service Tests
 * Unit tests for context usage analysis and optimization insights
 */

import { ContextUsageAnalyzerService, type ContextUsageAnalyzerConfig } from '../ContextUsageAnalyzer';
import type {
  ContextUsageAnalytics,
  ContextMetrics,
  ContextQualityMetrics
} from '../../../../../shared/types/context';

describe('ContextUsageAnalyzerService', () => {
  let service: ContextUsageAnalyzerService;
  let config: ContextUsageAnalyzerConfig;

  beforeEach(() => {
    config = {
      analysisWindowDays: 7,
      minPatternFrequency: 3,
      performanceThresholds: {
        excellentMs: 100,
        goodMs: 200,
        acceptableMs: 500
      }
    };
    service = new ContextUsageAnalyzerService(config);
  });

  describe('recordUsageData', () => {
    it('should record usage data for analysis', () => {
      const sessionId = 'test-session-1';
      const usageData: ContextUsageAnalytics = {
        sessionId,
        totalQueries: 10,
        followUpQueries: 6,
        contextRetrievals: 8,
        avgRelevanceScore: 0.85,
        sessionDurationMs: 1800000, // 30 minutes
        storageGrowthRate: 15.5,
        mostUsedContextTypes: ['document', 'entity', 'temporal']
      };

      service.recordUsageData(sessionId, usageData);

      // Verify data was recorded by attempting to generate session recommendations
      const recommendations = service.generateSessionRecommendations(sessionId);
      expect(recommendations).toBeInstanceOf(Array);
      expect(recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('recordMetrics', () => {
    it('should record metrics for analysis', () => {
      const sessionId = 'test-session-2';
      const metrics: ContextMetrics[] = [
        {
          sessionId,
          metricType: 'retrieval_time_ms',
          value: 150,
          timestamp: new Date(),
          metadata: { operation: 'context_retrieval' }
        },
        {
          sessionId,
          metricType: 'context_enhancement_time_ms',
          value: 75,
          timestamp: new Date(),
          metadata: { operation: 'query_enhancement' }
        }
      ];

      service.recordMetrics(sessionId, metrics);

      // Should not throw error
      expect(() => service.analyzeUsagePatterns()).not.toThrow();
    });
  });

  describe('recordQualityMetrics', () => {
    it('should record quality metrics for analysis', () => {
      const contextId = 'test-context-1';
      const qualityMetrics: ContextQualityMetrics = {
        contextId,
        accuracy: {
          contextRelevanceScore: 0.92,
          entityResolutionAccuracy: 0.88,
          temporalAccuracy: 0.95,
          overallAccuracy: 0.91
        },
        completeness: {
          requiredFieldsPresent: 0.98,
          contextCoverageScore: 0.85,
          informationDensity: 0.73
        },
        consistency: {
          crossTurnConsistency: 0.94,
          entityConsistency: 0.89,
          temporalConsistency: 0.97
        },
        performance: {
          retrievalTimeMs: 120,
          processingTimeMs: 45,
          cacheHitRate: 0.78,
          compressionRatio: 0.65
        },
        timestamp: new Date()
      };

      service.recordQualityMetrics(contextId, qualityMetrics);

      // Should not throw error when generating insights
      expect(() => service.generateOptimizationInsights()).not.toThrow();
    });
  });

  describe('analyzeUsagePatterns', () => {
    beforeEach(() => {
      // Setup test data for pattern analysis
      const sessions = [
        {
          sessionId: 'session-1',
          usageData: {
            sessionId: 'session-1',
            totalQueries: 10,
            followUpQueries: 7, // High follow-up ratio
            contextRetrievals: 9,
            avgRelevanceScore: 0.85,
            sessionDurationMs: 2700000, // 45 minutes
            storageGrowthRate: 12.5,
            mostUsedContextTypes: ['document', 'entity']
          }
        },
        {
          sessionId: 'session-2',
          usageData: {
            sessionId: 'session-2',
            totalQueries: 8,
            followUpQueries: 6, // High follow-up ratio
            contextRetrievals: 7,
            avgRelevanceScore: 0.78,
            sessionDurationMs: 1800000, // 30 minutes
            storageGrowthRate: 8.2,
            mostUsedContextTypes: ['document', 'temporal']
          }
        },
        {
          sessionId: 'session-3',
          usageData: {
            sessionId: 'session-3',
            totalQueries: 15,
            followUpQueries: 12, // High follow-up ratio
            contextRetrievals: 14,
            avgRelevanceScore: 0.92,
            sessionDurationMs: 4200000, // 70 minutes
            storageGrowthRate: 18.7,
            mostUsedContextTypes: ['entity', 'temporal']
          }
        }
      ];

      sessions.forEach(({ sessionId, usageData }) => {
        service.recordUsageData(sessionId, usageData);
        
        // Add some metrics for each session
        const metrics: ContextMetrics[] = [
          {
            sessionId,
            metricType: 'retrieval_time_ms',
            value: 120 + Math.random() * 80,
            timestamp: new Date(),
            metadata: {}
          },
          {
            sessionId,
            metricType: 'context_enhancement_time_ms',
            value: 60 + Math.random() * 40,
            timestamp: new Date(),
            metadata: {}
          }
        ];
        service.recordMetrics(sessionId, metrics);
      });
    });

    it('should identify high follow-up usage pattern', () => {
      const patterns = service.analyzeUsagePatterns();

      const highFollowUpPattern = patterns.find(p => p.pattern === 'high_followup');
      expect(highFollowUpPattern).toBeDefined();
      expect(highFollowUpPattern!.frequency).toBe(3); // All 3 sessions have high follow-up ratio
      expect(highFollowUpPattern!.recommendedOptimization).toContain('context pre-loading');
    });

    it('should identify context type usage patterns', () => {
      const patterns = service.analyzeUsagePatterns();

      const documentPattern = patterns.find(p => p.pattern === 'context_type_document');
      const entityPattern = patterns.find(p => p.pattern === 'context_type_entity');
      const temporalPattern = patterns.find(p => p.pattern === 'context_type_temporal');

      expect(documentPattern).toBeDefined();
      expect(entityPattern).toBeDefined();
      expect(temporalPattern).toBeDefined();
    });

    it('should calculate pattern metrics correctly', () => {
      const patterns = service.analyzeUsagePatterns();

      patterns.forEach(pattern => {
        expect(pattern.frequency).toBeGreaterThanOrEqual(config.minPatternFrequency);
        expect(pattern.avgPerformance).toBeGreaterThanOrEqual(0);
        expect(pattern.successRate).toBeGreaterThanOrEqual(0);
        expect(pattern.successRate).toBeLessThanOrEqual(1);
        expect(pattern.recommendedOptimization).toBeDefined();
        expect(typeof pattern.recommendedOptimization).toBe('string');
      });
    });

    it('should filter patterns below minimum frequency', () => {
      // Create a new service with higher minimum frequency
      const strictConfig: ContextUsageAnalyzerConfig = {
        ...config,
        minPatternFrequency: 10 // Higher than our test data
      };
      const strictService = new ContextUsageAnalyzerService(strictConfig);

      // Record same data
      service.recordUsageData('session-1', {
        sessionId: 'session-1',
        totalQueries: 5,
        followUpQueries: 1,
        contextRetrievals: 3,
        avgRelevanceScore: 0.75,
        sessionDurationMs: 900000,
        storageGrowthRate: 5.0,
        mostUsedContextTypes: ['document']
      });

      const patterns = strictService.analyzeUsagePatterns();
      expect(patterns).toHaveLength(0); // No patterns should meet the minimum frequency
    });
  });

  describe('generateOptimizationInsights', () => {
    beforeEach(() => {
      // Setup test data with performance issues
      const qualityMetrics: ContextQualityMetrics = {
        contextId: 'context-1',
        accuracy: {
          contextRelevanceScore: 0.75, // Below optimal
          entityResolutionAccuracy: 0.70,
          temporalAccuracy: 0.80,
          overallAccuracy: 0.75
        },
        completeness: {
          requiredFieldsPresent: 0.95,
          contextCoverageScore: 0.80,
          informationDensity: 0.70
        },
        consistency: {
          crossTurnConsistency: 0.90,
          entityConsistency: 0.85,
          temporalConsistency: 0.92
        },
        performance: {
          retrievalTimeMs: 600, // Slow
          processingTimeMs: 200,
          cacheHitRate: 0.45, // Low
          compressionRatio: 0.60
        },
        timestamp: new Date()
      };

      service.recordQualityMetrics('context-1', qualityMetrics);

      // Add usage data with storage growth issues
      service.recordUsageData('session-1', {
        sessionId: 'session-1',
        totalQueries: 20,
        followUpQueries: 16,
        contextRetrievals: 18,
        avgRelevanceScore: 0.75,
        sessionDurationMs: 3600000,
        storageGrowthRate: 25.5, // High growth
        mostUsedContextTypes: ['document', 'entity']
      });
    });

    it('should generate performance optimization insights', () => {
      const insights = service.generateOptimizationInsights();

      const performanceInsight = insights.find(i => 
        i.category === 'performance' && i.title.includes('Context Retrieval Performance')
      );

      expect(performanceInsight).toBeDefined();
      expect(performanceInsight!.priority).toBe('critical');
      expect(performanceInsight!.description).toContain('600ms');
      expect(performanceInsight!.implementation).toContain('caching');
    });

    it('should generate storage optimization insights', () => {
      const insights = service.generateOptimizationInsights();

      const storageInsight = insights.find(i => 
        i.category === 'storage' && i.title.includes('Storage Growth')
      );

      expect(storageInsight).toBeDefined();
      expect(storageInsight!.priority).toBe('medium');
      expect(storageInsight!.description).toContain('25.5%');
      expect(storageInsight!.implementation).toContain('compression');
    });

    it('should generate accuracy improvement insights', () => {
      const insights = service.generateOptimizationInsights();

      const accuracyInsight = insights.find(i => 
        i.category === 'accuracy' && i.title.includes('Context Accuracy')
      );

      expect(accuracyInsight).toBeDefined();
      expect(accuracyInsight!.priority).toBe('high');
      expect(accuracyInsight!.description).toContain('75.0%');
      expect(accuracyInsight!.implementation).toContain('entity resolution');
    });

    it('should generate cache optimization insights', () => {
      const insights = service.generateOptimizationInsights();

      const cacheInsight = insights.find(i => 
        i.category === 'performance' && i.title.includes('Cache Strategy')
      );

      expect(cacheInsight).toBeDefined();
      expect(cacheInsight!.priority).toBe('medium');
      expect(cacheInsight!.description).toContain('45.0%');
      expect(cacheInsight!.implementation).toContain('cache eviction');
    });

    it('should sort insights by priority', () => {
      const insights = service.generateOptimizationInsights();

      const priorities = insights.map(i => i.priority);
      const priorityOrder = ['critical', 'high', 'medium', 'low'];

      for (let i = 0; i < priorities.length - 1; i++) {
        const currentIndex = priorityOrder.indexOf(priorities[i]);
        const nextIndex = priorityOrder.indexOf(priorities[i + 1]);
        expect(currentIndex).toBeLessThanOrEqual(nextIndex);
      }
    });
  });

  describe('analyzeEfficiency', () => {
    beforeEach(() => {
      // Setup test data for efficiency analysis
      const qualityMetrics: ContextQualityMetrics = {
        contextId: 'efficiency-context',
        accuracy: {
          contextRelevanceScore: 0.82,
          entityResolutionAccuracy: 0.79,
          temporalAccuracy: 0.88,
          overallAccuracy: 0.83
        },
        completeness: {
          requiredFieldsPresent: 0.96,
          contextCoverageScore: 0.84,
          informationDensity: 0.75
        },
        consistency: {
          crossTurnConsistency: 0.91,
          entityConsistency: 0.86,
          temporalConsistency: 0.94
        },
        performance: {
          retrievalTimeMs: 180,
          processingTimeMs: 65,
          cacheHitRate: 0.72,
          compressionRatio: 0.68
        },
        timestamp: new Date()
      };

      service.recordQualityMetrics('efficiency-context', qualityMetrics);

      const usageData: ContextUsageAnalytics = {
        sessionId: 'efficiency-session',
        totalQueries: 12,
        followUpQueries: 8,
        contextRetrievals: 10,
        avgRelevanceScore: 0.83,
        sessionDurationMs: 2400000,
        storageGrowthRate: 8.5,
        mostUsedContextTypes: ['document', 'entity', 'temporal']
      };

      service.recordUsageData('efficiency-session', usageData);
    });

    it('should analyze efficiency and identify bottlenecks', () => {
      const analysis = service.analyzeEfficiency();

      expect(analysis.bottlenecks).toBeInstanceOf(Array);
      expect(analysis.efficiency.overall).toBeGreaterThanOrEqual(0);
      expect(analysis.efficiency.overall).toBeLessThanOrEqual(100);
      expect(analysis.efficiency.breakdown).toHaveProperty('retrieval');
      expect(analysis.efficiency.breakdown).toHaveProperty('accuracy');
      expect(analysis.efficiency.breakdown).toHaveProperty('cache');
      expect(analysis.efficiency.breakdown).toHaveProperty('storage');
      expect(analysis.trends.improving).toBeInstanceOf(Array);
      expect(analysis.trends.degrading).toBeInstanceOf(Array);
      expect(analysis.trends.stable).toBeInstanceOf(Array);
    });

    it('should identify performance bottlenecks', () => {
      // Add slower metrics to trigger bottleneck detection
      const slowQualityMetrics: ContextQualityMetrics = {
        contextId: 'slow-context',
        accuracy: {
          contextRelevanceScore: 0.65, // Low accuracy
          entityResolutionAccuracy: 0.60,
          temporalAccuracy: 0.70,
          overallAccuracy: 0.65
        },
        completeness: {
          requiredFieldsPresent: 0.90,
          contextCoverageScore: 0.75,
          informationDensity: 0.65
        },
        consistency: {
          crossTurnConsistency: 0.85,
          entityConsistency: 0.80,
          temporalConsistency: 0.88
        },
        performance: {
          retrievalTimeMs: 800, // Very slow
          processingTimeMs: 300,
          cacheHitRate: 0.35, // Very low
          compressionRatio: 0.50
        },
        timestamp: new Date()
      };

      service.recordQualityMetrics('slow-context', slowQualityMetrics);

      const analysis = service.analyzeEfficiency();

      const retrievalBottleneck = analysis.bottlenecks.find(b => b.component === 'Context Retrieval');
      const cacheBottleneck = analysis.bottlenecks.find(b => b.component === 'Cache System');
      const accuracyBottleneck = analysis.bottlenecks.find(b => b.component === 'Context Accuracy');

      expect(retrievalBottleneck).toBeDefined();
      expect(retrievalBottleneck!.severity).toBe('high');

      expect(cacheBottleneck).toBeDefined();
      expect(cacheBottleneck!.severity).toBe('medium');

      expect(accuracyBottleneck).toBeDefined();
      expect(accuracyBottleneck!.severity).toBe('high');
    });

    it('should calculate efficiency breakdown correctly', () => {
      const analysis = service.analyzeEfficiency();

      Object.values(analysis.efficiency.breakdown).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });

      expect(analysis.efficiency.overall).toBeGreaterThanOrEqual(0);
      expect(analysis.efficiency.overall).toBeLessThanOrEqual(100);
    });
  });

  describe('generateSessionRecommendations', () => {
    it('should generate recommendations for high follow-up sessions', () => {
      const sessionId = 'high-followup-session';
      const usageData: ContextUsageAnalytics = {
        sessionId,
        totalQueries: 10,
        followUpQueries: 9, // 90% follow-up ratio
        contextRetrievals: 8,
        avgRelevanceScore: 0.88,
        sessionDurationMs: 1800000,
        storageGrowthRate: 7.2,
        mostUsedContextTypes: ['document']
      };

      service.recordUsageData(sessionId, usageData);

      const recommendations = service.generateSessionRecommendations(sessionId);

      expect(recommendations).toContain(
        expect.stringContaining('High follow-up query usage detected')
      );
    });

    it('should generate recommendations for low relevance sessions', () => {
      const sessionId = 'low-relevance-session';
      const usageData: ContextUsageAnalytics = {
        sessionId,
        totalQueries: 8,
        followUpQueries: 3,
        contextRetrievals: 6,
        avgRelevanceScore: 0.55, // Low relevance
        sessionDurationMs: 1200000,
        storageGrowthRate: 4.8,
        mostUsedContextTypes: ['entity']
      };

      service.recordUsageData(sessionId, usageData);

      const recommendations = service.generateSessionRecommendations(sessionId);

      expect(recommendations).toContain(
        expect.stringContaining('Low context relevance scores')
      );
    });

    it('should generate recommendations for long sessions', () => {
      const sessionId = 'long-session';
      const usageData: ContextUsageAnalytics = {
        sessionId,
        totalQueries: 25,
        followUpQueries: 15,
        contextRetrievals: 20,
        avgRelevanceScore: 0.85,
        sessionDurationMs: 8400000, // 2.33 hours
        storageGrowthRate: 22.5,
        mostUsedContextTypes: ['document', 'entity', 'temporal']
      };

      service.recordUsageData(sessionId, usageData);

      const recommendations = service.generateSessionRecommendations(sessionId);

      expect(recommendations).toContain(
        expect.stringContaining('Long session detected')
      );
    });

    it('should return positive feedback for optimal sessions', () => {
      const sessionId = 'optimal-session';
      const usageData: ContextUsageAnalytics = {
        sessionId,
        totalQueries: 6,
        followUpQueries: 2,
        contextRetrievals: 4,
        avgRelevanceScore: 0.92,
        sessionDurationMs: 900000, // 15 minutes
        storageGrowthRate: 3.2,
        mostUsedContextTypes: ['document']
      };

      service.recordUsageData(sessionId, usageData);

      // Add fast metrics
      const metrics: ContextMetrics[] = [
        {
          sessionId,
          metricType: 'retrieval_time_ms',
          value: 80, // Fast
          timestamp: new Date(),
          metadata: {}
        }
      ];
      service.recordMetrics(sessionId, metrics);

      const recommendations = service.generateSessionRecommendations(sessionId);

      expect(recommendations).toContain('Session performance is within acceptable parameters');
    });

    it('should handle non-existent session', () => {
      const recommendations = service.generateSessionRecommendations('non-existent-session');

      expect(recommendations).toHaveLength(1);
      expect(recommendations[0]).toBe('No usage data available for analysis');
    });
  });
});