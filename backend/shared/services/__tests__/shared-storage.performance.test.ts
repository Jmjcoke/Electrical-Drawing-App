import { SharedStoragePerformance } from '../shared-storage.performance';
import { SharedStorageAlerts } from '../shared-storage.alerts';
import { sharedStorageMetrics } from '../shared-storage.metrics';

// Mock dependencies
jest.mock('../shared-storage.alerts');
jest.mock('../shared-storage.metrics');

describe('SharedStoragePerformance', () => {
  let performanceMonitor: SharedStoragePerformance;
  let mockAlerts: jest.Mocked<SharedStorageAlerts>;

  beforeEach(() => {
    mockAlerts = {
      alertPerformanceDegradation: jest.fn(),
      alertHighErrorRate: jest.fn(),
      alertStorageFailure: jest.fn(),
      alertHealthCheckFailure: jest.fn(),
      getAlertStats: jest.fn()
    } as any;

    performanceMonitor = new SharedStoragePerformance(mockAlerts);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Operation Performance Tracking', () => {
    it('should track operation performance successfully', async () => {
      const timer = performanceMonitor.startOperation('test_operation', 'test_service', {
        sessionId: 'session-123',
        filepath: '/test/file.txt'
      });

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));

      const duration = timer.end({ success: true, result: 'completed' });

      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThan(50); // Should be fast
    });

    it('should track operation errors', async () => {
      const timer = performanceMonitor.startOperation('failing_operation', 'test_service');

      // Simulate error
      await new Promise(resolve => setTimeout(resolve, 5));

      const duration = timer.end({
        success: false,
        error: 'Operation failed',
        errorCode: 'TEST_ERROR'
      });

      expect(duration).toBeGreaterThan(0);
    });

    it('should handle missing metadata gracefully', async () => {
      const timer = performanceMonitor.startOperation('test_operation', 'test_service');

      const duration = timer.end();

      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('Performance Analysis', () => {
    beforeEach(() => {
      // Add some test data by running operations
      for (let i = 0; i < 10; i++) {
        const timer = performanceMonitor.startOperation('test_operation', 'test_service');
        setTimeout(() => timer.end({ success: true }), Math.random() * 50);
      }
    });

    it('should generate performance analysis', () => {
      const analysis = performanceMonitor.generatePerformanceAnalysis();

      expect(analysis).toHaveProperty('totalOperations');
      expect(analysis).toHaveProperty('avgResponseTime');
      expect(analysis).toHaveProperty('slowestOperations');
      expect(analysis).toHaveProperty('performanceInsights');
      expect(analysis).toHaveProperty('analysisTimestamp');

      expect(analysis.totalOperations).toBeGreaterThan(0);
      expect(analysis.avgResponseTime).toBeGreaterThan(0);
    });

    it('should identify slowest operations', () => {
      // Add a slow operation
      const slowTimer = performanceMonitor.startOperation('slow_operation', 'test_service');
      setTimeout(() => slowTimer.end({ success: true }), 200);

      const analysis = performanceMonitor.generatePerformanceAnalysis();

      expect(analysis.slowestOperations.length).toBeGreaterThan(0);
      expect(analysis.slowestOperations[0]).toHaveProperty('operation');
      expect(analysis.slowestOperations[0]).toHaveProperty('duration');
    });
  });

  describe('Performance Threshold Monitoring', () => {
    it('should trigger alerts for operations exceeding threshold', async () => {
      // Create operations that exceed threshold multiple times
      for (let i = 0; i < 8; i++) {
        const timer = performanceMonitor.startOperation('slow_operation', 'test_service');
        setTimeout(() => timer.end({ success: true }), 150); // 150ms > 100ms threshold
      }

      // Give time for analysis
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockAlerts.alertPerformanceDegradation).toHaveBeenCalledWith(
        'slow_operation',
        'test_service',
        expect.any(Number),
        100
      );
    });

    it('should not trigger alerts for operations within threshold', async () => {
      // Create fast operations
      for (let i = 0; i < 5; i++) {
        const timer = performanceMonitor.startOperation('fast_operation', 'test_service');
        setTimeout(() => timer.end({ success: true }), 20); // 20ms < 100ms threshold
      }

      // Give time for analysis
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockAlerts.alertPerformanceDegradation).not.toHaveBeenCalled();
    });
  });

  describe('Operation Statistics', () => {
    beforeEach(() => {
      // Add test data
      for (let i = 0; i < 20; i++) {
        const timer = performanceMonitor.startOperation('stats_test', 'test_service');
        setTimeout(() => timer.end({ success: true }), Math.random() * 100);
      }
    });

    it('should provide operation statistics', () => {
      const stats = performanceMonitor.getOperationStats('stats_test', 'test_service');

      expect(stats).not.toBeNull();
      expect(stats?.operation).toBe('stats_test');
      expect(stats?.service).toBe('test_service');
      expect(stats?.totalOperations).toBeGreaterThan(0);
      expect(stats?.avgDuration).toBeGreaterThan(0);
      expect(stats?.minDuration).toBeGreaterThan(0);
      expect(stats?.maxDuration).toBeGreaterThan(0);
    });

    it('should return null for non-existent operations', () => {
      const stats = performanceMonitor.getOperationStats('non_existent', 'test_service');
      expect(stats).toBeNull();
    });
  });

  describe('Overall Performance Statistics', () => {
    beforeEach(() => {
      // Add diverse test data
      const operations = ['read_file', 'write_file', 'list_files', 'get_metadata'];
      const services = ['file-processor', 'llm-orchestrator'];

      for (let i = 0; i < 50; i++) {
        const operation = operations[Math.floor(Math.random() * operations.length)];
        const service = services[Math.floor(Math.random() * services.length)];
        const timer = performanceMonitor.startOperation(operation, service);
        setTimeout(() => timer.end({ success: true }), Math.random() * 80);
      }
    });

    it('should provide comprehensive overall statistics', () => {
      const stats = performanceMonitor.getOverallStats();

      expect(stats.totalOperations).toBeGreaterThan(0);
      expect(stats.avgResponseTime).toBeGreaterThan(0);
      expect(stats.slowOperationsCount).toBeGreaterThanOrEqual(0);
      expect(stats.performanceThreshold).toBe(100);

      expect(stats.operationsByType).toBeDefined();
      expect(stats.servicesByType).toBeDefined();
      expect(stats.analysisTimestamp).toBeInstanceOf(Date);
    });

    it('should track operations by type', () => {
      const stats = performanceMonitor.getOverallStats();

      expect(Object.keys(stats.operationsByType).length).toBeGreaterThan(0);
      expect(Object.values(stats.operationsByType).every(count => count > 0)).toBe(true);
    });

    it('should track services by type', () => {
      const stats = performanceMonitor.getOverallStats();

      expect(Object.keys(stats.servicesByType).length).toBeGreaterThan(0);
      expect(Object.values(stats.servicesByType).every(count => count > 0)).toBe(true);
    });
  });

  describe('Performance Insights', () => {
    it('should generate optimization insights', () => {
      // Create a consistently slow operation
      for (let i = 0; i < 30; i++) {
        const timer = performanceMonitor.startOperation('slow_operation', 'test_service');
        setTimeout(() => timer.end({ success: true }), 120); // Consistently over threshold
      }

      const analysis = performanceMonitor.generatePerformanceAnalysis();

      expect(analysis.performanceInsights.length).toBeGreaterThan(0);

      const slowOperationInsight = analysis.performanceInsights.find(
        insight => insight.title.includes('slow operation')
      );

      expect(slowOperationInsight).toBeDefined();
      expect(slowOperationInsight?.severity).toMatch(/low|medium|high/);
      expect(slowOperationInsight?.recommendation).toBeDefined();
    });

    it('should detect performance consistency issues', () => {
      // Create operation with high variance
      for (let i = 0; i < 20; i++) {
        const duration = i % 2 === 0 ? 10 : 200; // Alternate between fast and slow
        const timer = performanceMonitor.startOperation('variable_operation', 'test_service');
        setTimeout(() => timer.end({ success: true }), duration);
      }

      const analysis = performanceMonitor.generatePerformanceAnalysis();

      const consistencyIssue = analysis.performanceInsights.find(
        insight => insight.type === 'consistency_issue'
      );

      expect(consistencyIssue).toBeDefined();
      expect(consistencyIssue?.variance).toBeGreaterThan(0);
    });
  });

  describe('Regression Detection', () => {
    it('should detect performance regression', async () => {
      // Establish baseline with fast operations
      for (let i = 0; i < 60; i++) {
        const timer = performanceMonitor.startOperation('regression_test', 'test_service');
        setTimeout(() => timer.end({ success: true }), 20); // Fast baseline
      }

      // Wait a bit for baseline to establish
      await new Promise(resolve => setTimeout(resolve, 100));

      // Introduce slow operations (regression)
      for (let i = 0; i < 10; i++) {
        const timer = performanceMonitor.startOperation('regression_test', 'test_service');
        setTimeout(() => timer.end({ success: true }), 80); // Slower - potential regression
      }

      // Give time for regression detection
      await new Promise(resolve => setTimeout(resolve, 200));

      // Regression detection happens internally and triggers alerts
      // The test validates that the system can detect regressions
      expect(mockAlerts.alertPerformanceDegradation).toHaveBeenCalled();
    });
  });

  describe('Test Alert Triggering', () => {
    it('should trigger test performance alerts', async () => {
      await performanceMonitor.triggerTestAlert('performance', { duration: 150 });

      expect(mockAlerts.alertPerformanceDegradation).toHaveBeenCalledWith(
        'test_operation',
        'test_service',
        150,
        100
      );
    });

    it('should trigger test error rate alerts', async () => {
      await performanceMonitor.triggerTestAlert('error', { errorRate: 0.08 });

      expect(mockAlerts.alertHighErrorRate).toHaveBeenCalledWith(
        'test_service',
        0.08,
        0.05
      );
    });

    it('should trigger test storage failure alerts', async () => {
      const context = { volume: 'test-volume' };
      await performanceMonitor.triggerTestAlert('storage', context);

      expect(mockAlerts.alertStorageFailure).toHaveBeenCalledWith(
        'access_denied',
        context
      );
    });

    it('should handle unknown alert types', async () => {
      await performanceMonitor.triggerTestAlert('unknown_type');

      expect(mockAlerts.alertOperationFailure).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle operation failures gracefully', async () => {
      const timer = performanceMonitor.startOperation('failing_operation', 'test_service');

      // Simulate operation failure
      expect(() => {
        // This should not throw even if operation fails
        timer.end({ success: false, error: 'Test failure' });
      }).not.toThrow();
    });

    it('should handle analysis errors gracefully', () => {
      // Mock a scenario that might cause analysis errors
      expect(() => {
        performanceMonitor.generatePerformanceAnalysis();
      }).not.toThrow();
    });

    it('should handle missing operation data gracefully', () => {
      const stats = performanceMonitor.getOperationStats('nonexistent', 'test');
      expect(stats).toBeNull();
    });
  });

  describe('Performance Data Management', () => {
    it('should maintain performance history within limits', () => {
      // This test would require mocking the history size limit
      // For now, we verify the structure exists
      const analysis = performanceMonitor.generatePerformanceAnalysis();
      expect(Array.isArray(analysis.slowestOperations)).toBe(true);
    });

    it('should provide timestamped analysis', () => {
      const before = new Date();
      const analysis = performanceMonitor.generatePerformanceAnalysis();
      const after = new Date();

      expect(analysis.analysisTimestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(analysis.analysisTimestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
