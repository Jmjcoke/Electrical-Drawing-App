/**
 * Unit tests for ContextMonitor service
 */

import { ContextMonitorService, ContextMonitorConfig } from '../ContextMonitor';
import type {
  ContextAlert,
  ContextQualityMetrics,
  ConversationContext
} from '../../../../../shared/types/context';

describe('ContextMonitorService', () => {
  let monitorService: ContextMonitorService;
  let config: ContextMonitorConfig;

  beforeEach(() => {
    config = {
      alertThresholds: {
        maxRetrievalTimeMs: 200,
        maxEnhancementTimeMs: 400,
        minAccuracyScore: 0.8,
        maxStorageSizeMb: 10,
        maxMemoryUsageMb: 100,
        minCacheHitRate: 0.7,
        maxErrorRatePercent: 5
      },
      monitoringIntervalMs: 1000,
      enableRealTimeAlerts: false, // Disable for tests
      alertRetentionDays: 7
    };

    monitorService = new ContextMonitorService(config);
  });

  afterEach(() => {
    monitorService.stopMonitoring();
  });

  describe('startMonitoring and stopMonitoring', () => {
    it('should start monitoring successfully', () => {
      monitorService.startMonitoring();
      const stats = monitorService.getMonitoringStats();
      expect(stats.isMonitoring).toBe(true);
    });

    it('should stop monitoring successfully', () => {
      monitorService.startMonitoring();
      monitorService.stopMonitoring();
      const stats = monitorService.getMonitoringStats();
      expect(stats.isMonitoring).toBe(false);
    });

    it('should not start multiple monitoring sessions', () => {
      monitorService.startMonitoring();
      monitorService.startMonitoring(); // Should not create duplicate
      const stats = monitorService.getMonitoringStats();
      expect(stats.isMonitoring).toBe(true);
    });
  });

  describe('monitorOperation', () => {
    it('should monitor successful operations without alerts', () => {
      const contextId = 'context-123';
      const sessionId = 'session-456';
      
      monitorService.monitorOperation('retrieval', 100, contextId, sessionId, true);
      
      const alerts = monitorService.getActiveAlerts();
      expect(alerts).toHaveLength(0);
    });

    it('should trigger performance alert for slow operations', () => {
      const contextId = 'context-123';
      const sessionId = 'session-456';
      
      monitorService.monitorOperation('retrieval', 500, contextId, sessionId, true);
      
      const alerts = monitorService.getActiveAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('performance_degradation');
      expect(alerts[0].severity).toBe('high');
    });

    it('should track errors and trigger alerts for high error rates', () => {
      const contextId = 'context-123';
      const sessionId = 'session-456';
      
      // Create multiple errors to exceed threshold
      for (let i = 0; i < 10; i++) {
        monitorService.monitorOperation('retrieval', 100, contextId, sessionId, false, 'Test error');
      }
      
      const alerts = monitorService.getActiveAlerts();
      const errorRateAlert = alerts.find(alert => alert.type === 'error_rate_spike');
      expect(errorRateAlert).toBeDefined();
    });

    it('should not duplicate similar alerts', () => {
      const contextId = 'context-123';
      const sessionId = 'session-456';
      
      // Trigger the same type of alert multiple times
      monitorService.monitorOperation('retrieval', 500, contextId, sessionId, true);
      monitorService.monitorOperation('retrieval', 600, contextId, sessionId, true);
      
      const alerts = monitorService.getActiveAlerts();
      expect(alerts).toHaveLength(1); // Should not duplicate
    });
  });

  describe('monitorQuality', () => {
    it('should trigger accuracy alert for low context relevance', () => {
      const qualityMetrics = createMockQualityMetrics();
      qualityMetrics.accuracy.contextRelevanceScore = 0.6; // Below threshold
      
      monitorService.monitorQuality(qualityMetrics);
      
      const alerts = monitorService.getActiveAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('accuracy_drop');
    });

    it('should trigger performance alert for slow retrieval', () => {
      const qualityMetrics = createMockQualityMetrics();
      qualityMetrics.performance.retrievalTimeMs = 300; // Above threshold
      
      monitorService.monitorQuality(qualityMetrics);
      
      const alerts = monitorService.getActiveAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('performance_degradation');
    });

    it('should trigger storage alert for large contexts', () => {
      const qualityMetrics = createMockQualityMetrics();
      qualityMetrics.storage.totalSizeBytes = 15 * 1024 * 1024; // 15MB, above threshold
      
      monitorService.monitorQuality(qualityMetrics);
      
      const alerts = monitorService.getActiveAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('storage_limit_exceeded');
    });

    it('should trigger cache alert for low hit rate', () => {
      const qualityMetrics = createMockQualityMetrics();
      qualityMetrics.performance.cacheHitRate = 0.5; // Below threshold
      
      monitorService.monitorQuality(qualityMetrics);
      
      const alerts = monitorService.getActiveAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('cache_miss_rate_high');
    });
  });

  describe('monitorMemoryUsage', () => {
    it('should trigger memory alert for high usage', () => {
      const contextId = 'context-123';
      const sessionId = 'session-456';
      
      monitorService.monitorMemoryUsage(contextId, sessionId, 150); // Above threshold
      
      const alerts = monitorService.getActiveAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('memory_leak');
      expect(alerts[0].severity).toBe('critical');
    });

    it('should not trigger alert for normal memory usage', () => {
      const contextId = 'context-123';
      const sessionId = 'session-456';
      
      monitorService.monitorMemoryUsage(contextId, sessionId, 50); // Below threshold
      
      const alerts = monitorService.getActiveAlerts();
      expect(alerts).toHaveLength(0);
    });
  });

  describe('analyzeContextHealth', () => {
    it('should analyze healthy context correctly', () => {
      const context = createMockContext();
      
      const health = monitorService.analyzeContextHealth(context);
      
      expect(health.healthScore).toBeGreaterThan(80);
      expect(health.riskLevel).toBe('low');
      expect(health.issues).toHaveLength(0);
    });

    it('should detect issues with old contexts', () => {
      const context = createMockContext();
      // Make context old
      context.metadata.createdAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      
      const health = monitorService.analyzeContextHealth(context);
      
      expect(health.healthScore).toBeLessThan(100);
      expect(health.issues.some(issue => issue.includes('older than 24 hours'))).toBe(true);
    });

    it('should detect issues with high turn count', () => {
      const context = createMockContext();
      // Add many turns
      for (let i = 0; i < 60; i++) {
        context.conversationThread.push({
          ...context.conversationThread[0],
          id: `turn-${i + 2}`,
          turnNumber: i + 2
        });
      }
      
      const health = monitorService.analyzeContextHealth(context);
      
      expect(health.healthScore).toBeLessThan(100);
      expect(health.issues.some(issue => issue.includes('High number of conversation turns'))).toBe(true);
    });

    it('should detect expired contexts', () => {
      const context = createMockContext();
      context.expiresAt = new Date(Date.now() - 1000); // Expired
      
      const health = monitorService.analyzeContextHealth(context);
      
      expect(health.healthScore).toBeLessThan(70);
      expect(health.riskLevel).not.toBe('low');
      expect(health.issues.some(issue => issue.includes('expired'))).toBe(true);
    });
  });

  describe('alert management', () => {
    it('should get active alerts', () => {
      const contextId = 'context-123';
      const sessionId = 'session-456';
      
      monitorService.monitorOperation('retrieval', 500, contextId, sessionId, true);
      
      const alerts = monitorService.getActiveAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].resolved).toBe(false);
    });

    it('should get alert history', () => {
      const contextId = 'context-123';
      const sessionId = 'session-456';
      
      monitorService.monitorOperation('retrieval', 500, contextId, sessionId, true);
      
      const history = monitorService.getAlertHistory();
      expect(history).toHaveLength(1);
    });

    it('should resolve alerts', () => {
      const contextId = 'context-123';
      const sessionId = 'session-456';
      
      monitorService.monitorOperation('retrieval', 500, contextId, sessionId, true);
      
      const alerts = monitorService.getActiveAlerts();
      const alertId = alerts[0].alertId;
      
      const resolved = monitorService.resolveAlert(alertId, 'Performance improved');
      expect(resolved).toBe(true);
      
      const activeAlertsAfter = monitorService.getActiveAlerts();
      expect(activeAlertsAfter).toHaveLength(0);
    });

    it('should handle resolving non-existent alerts', () => {
      const resolved = monitorService.resolveAlert('non-existent-id');
      expect(resolved).toBe(false);
    });
  });

  describe('monitoring statistics', () => {
    it('should provide monitoring statistics', () => {
      const stats = monitorService.getMonitoringStats();
      
      expect(stats).toHaveProperty('activeAlertsCount');
      expect(stats).toHaveProperty('totalAlertsToday');
      expect(stats).toHaveProperty('errorRate');
      expect(stats).toHaveProperty('avgPerformance');
      expect(stats).toHaveProperty('isMonitoring');
      
      expect(typeof stats.activeAlertsCount).toBe('number');
      expect(typeof stats.errorRate).toBe('number');
      expect(typeof stats.isMonitoring).toBe('boolean');
    });

    it('should track alerts created today', () => {
      const contextId = 'context-123';
      const sessionId = 'session-456';
      
      monitorService.monitorOperation('retrieval', 500, contextId, sessionId, true);
      
      const stats = monitorService.getMonitoringStats();
      expect(stats.totalAlertsToday).toBe(1);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty quality metrics gracefully', () => {
      const emptyMetrics = {
        contextId: 'context-123',
        sessionId: 'session-456',
        accuracy: {
          followUpDetectionAccuracy: 0,
          entityResolutionAccuracy: 0,
          contextRelevanceScore: 0.9, // Still above threshold
          falsePositiveRate: 0,
          falseNegativeRate: 0
        },
        performance: {
          retrievalTimeMs: 100, // Below threshold
          enhancementTimeMs: 200, // Below threshold
          summarizationTimeMs: 300,
          totalProcessingTimeMs: 600,
          cacheHitRate: 0.8, // Above threshold
          memoryUsageMb: 50 // Below threshold
        },
        storage: {
          totalSizeBytes: 1024, // Small size
          compressedSizeBytes: 512,
          compressionRatio: 0.5,
          turnCount: 1,
          entityCount: 1,
          documentReferenceCount: 0
        },
        timestamp: new Date()
      };
      
      expect(() => monitorService.monitorQuality(emptyMetrics)).not.toThrow();
      
      const alerts = monitorService.getActiveAlerts();
      expect(alerts).toHaveLength(0); // Should not trigger any alerts
    });

    it('should handle context health analysis with minimal data', () => {
      const minimalContext = {
        id: 'context-123',
        sessionId: 'session-456',
        conversationThread: [],
        cumulativeContext: {
          extractedEntities: new Map(),
          documentContext: [],
          topicProgression: [],
          keyInsights: [],
          relationshipMap: []
        },
        lastUpdated: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        metadata: {
          createdAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 0,
          compressionLevel: 0,
          tags: []
        }
      };
      
      const health = monitorService.analyzeContextHealth(minimalContext);
      
      expect(health.healthScore).toBeLessThan(100);
      expect(health.issues.some(issue => issue.includes('no conversation turns'))).toBe(true);
    });
  });
});

// Helper functions
function createMockQualityMetrics(): ContextQualityMetrics {
  return {
    contextId: 'context-123',
    sessionId: 'session-456',
    accuracy: {
      followUpDetectionAccuracy: 0.85,
      entityResolutionAccuracy: 0.90,
      contextRelevanceScore: 0.88,
      falsePositiveRate: 0.05,
      falseNegativeRate: 0.03
    },
    performance: {
      retrievalTimeMs: 120,
      enhancementTimeMs: 250,
      summarizationTimeMs: 400,
      totalProcessingTimeMs: 770,
      cacheHitRate: 0.8,
      memoryUsageMb: 45
    },
    storage: {
      totalSizeBytes: 2048,
      compressedSizeBytes: 1024,
      compressionRatio: 0.5,
      turnCount: 5,
      entityCount: 12,
      documentReferenceCount: 2
    },
    timestamp: new Date()
  };
}

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
    ],
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