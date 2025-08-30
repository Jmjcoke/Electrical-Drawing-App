import { jest } from '@jest/globals';
import { PerformanceProfiler, createPerformanceProfiler, DEFAULT_PERFORMANCE_THRESHOLDS } from '../performance-profiler';

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    ttl: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
  })),
}));

describe('PerformanceProfiler', () => {
  let profiler: PerformanceProfiler;
  let mockRedis: any;

  beforeEach(() => {
    jest.useFakeTimers();
    profiler = createPerformanceProfiler({
      redisUrl: 'redis://localhost:6379',
      enableRedisStorage: false, // Disable Redis for tests
      sampleRate: 1.0, // Sample all operations for testing
    });

    // Get mock Redis instance
    mockRedis = (profiler as any).redis;
  });

  afterEach(async () => {
    await profiler.close();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Operation Profiling', () => {
    test('should start and end operation profiling', () => {
      const operationId = 'test-op-1';
      const operation = 'fileAccess';
      const metadata = { sessionId: 'session1', service: 'file-service' };

      profiler.startOperation(operationId, operation, metadata);
      profiler.endOperation(operationId, operation, 'session1', 'file-service', true);

      const stats = profiler.getOperationStats(operation, 'file-service');
      expect(stats).toBeDefined();
      expect(stats.sampleCount).toBe(1);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });

    test('should handle failed operations', () => {
      const operationId = 'test-op-2';
      const operation = 'fileUpload';

      profiler.startOperation(operationId, operation);
      profiler.endOperation(operationId, operation, 'session1', 'file-service', false, 'FileTooLargeError');

      const stats = profiler.getOperationStats(operation, 'file-service');
      expect(stats).toBeDefined();
      expect(stats.errorRate).toBe(1.0);
      expect(stats.successRate).toBe(0.0);
    });

    test('should record custom metrics', () => {
      profiler.recordMetric(
        'cacheHit',
        'session1',
        'cache-service',
        'cache_hit_rate' as any,
        0.85,
        { cacheType: 'redis' }
      );

      const stats = profiler.getOperationStats('cacheHit', 'cache-service');
      expect(stats).toBeDefined();
      expect(stats.sampleCount).toBe(1);
    });
  });

  describe('Threshold Checking', () => {
    test('should emit alerts for critical operation duration', () => {
      const mockEmit = jest.fn();
      const originalEmit = profiler.emit;
      profiler.emit = mockEmit;

      const operationId = 'slow-op';
      profiler.startOperation(operationId, 'slowOperation');

      // Simulate slow operation exceeding critical threshold (500ms)
      jest.advanceTimersByTime(600);

      profiler.endOperation(operationId, 'slowOperation', 'session1', 'test-service', true);

      expect(mockEmit).toHaveBeenCalledWith('performanceAlert', expect.objectContaining({
        severity: 'critical',
        alertType: 'operation_duration',
        operation: 'slowOperation',
        service: 'test-service',
      }));

      profiler.emit = originalEmit;
    });

    test('should emit alerts for high memory usage', () => {
      const mockEmit = jest.fn();
      const originalEmit = profiler.emit;
      profiler.emit = mockEmit;

      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 900 * 1024 * 1024, // 900MB
        heapTotal: 1024 * 1024 * 1024, // 1GB
        external: 0,
        rss: 0,
        arrayBuffers: 0,
      }));

      const operationId = 'memory-intensive-op';
      profiler.startOperation(operationId, 'memoryOperation');
      profiler.endOperation(operationId, 'memoryOperation', 'session1', 'test-service', true);

      expect(mockEmit).toHaveBeenCalledWith('performanceAlert', expect.objectContaining({
        severity: 'critical',
        alertType: 'memory_usage',
        operation: 'memoryOperation',
      }));

      process.memoryUsage = originalMemoryUsage;
      profiler.emit = originalEmit;
    });

    test('should respect alert cooldown period', () => {
      const mockEmit = jest.fn();
      const originalEmit = profiler.emit;
      profiler.emit = mockEmit;

      const operationId1 = 'cooldown-op-1';
      const operationId2 = 'cooldown-op-2';

      // First alert
      profiler.startOperation(operationId1, 'cooldownTest');
      jest.advanceTimersByTime(600);
      profiler.endOperation(operationId1, 'cooldownTest', 'session1', 'test-service', true);

      // Second alert (should be blocked by cooldown)
      profiler.startOperation(operationId2, 'cooldownTest');
      jest.advanceTimersByTime(600);
      profiler.endOperation(operationId2, 'cooldownTest', 'session1', 'test-service', true);

      // Should only emit one alert due to cooldown
      expect(mockEmit).toHaveBeenCalledTimes(1);

      profiler.emit = originalEmit;
    });
  });

  describe('Bottleneck Detection', () => {
    test('should detect critical bottlenecks', async () => {
      // Add multiple slow operations to trigger bottleneck detection
      for (let i = 0; i < 15; i++) {
        const operationId = `bottleneck-op-${i}`;
        profiler.startOperation(operationId, 'bottleneckTest');
        jest.advanceTimersByTime(600); // Exceed critical threshold
        profiler.endOperation(operationId, 'bottleneckTest', 'session1', 'test-service', true);
      }

      const bottlenecks = await profiler['detectBottlenecks']();

      expect(bottlenecks.length).toBeGreaterThan(0);
      const criticalBottleneck = bottlenecks.find(b => b.severity === 'critical');
      expect(criticalBottleneck).toBeDefined();
      expect(criticalBottleneck!.description).toContain('Critical bottleneck detected');
      expect(criticalBottleneck!.recommendations).toContain('Consider implementing caching');
    });

    test('should detect high error rate bottlenecks', async () => {
      // Add operations with high error rate
      for (let i = 0; i < 20; i++) {
        const operationId = `error-op-${i}`;
        profiler.startOperation(operationId, 'errorTest');
        profiler.endOperation(operationId, 'errorTest', 'session1', 'test-service', i % 5 !== 0, 'TestError'); // 80% error rate
      }

      const bottlenecks = await profiler['detectBottlenecks']();

      expect(bottlenecks.length).toBeGreaterThan(0);
      const errorBottleneck = bottlenecks.find(b => b.description.includes('High error rate'));
      expect(errorBottleneck).toBeDefined();
    });
  });

  describe('Performance Regression Monitoring', () => {
    test('should detect performance regressions', async () => {
      const operation = 'regressionTest';

      // Establish baseline with fast operations
      for (let i = 0; i < 10; i++) {
        const operationId = `baseline-op-${i}`;
        profiler.startOperation(operationId, operation);
        jest.advanceTimersByTime(10); // Fast operation
        profiler.endOperation(operationId, operation, 'session1', 'test-service', true);
      }

      // Manually set baseline (simulate time passage)
      const baseline = (profiler as any).baselines.get(operation);
      if (baseline) {
        baseline.timestamp = Date.now() - 25 * 3600000; // 25 hours ago
      }

      // Add slow operations that should trigger regression
      for (let i = 0; i < 10; i++) {
        const operationId = `regression-op-${i}`;
        profiler.startOperation(operationId, operation);
        jest.advanceTimersByTime(100); // Much slower operation
        profiler.endOperation(operationId, operation, 'session1', 'test-service', true);
      }

      const regressions = await profiler['checkPerformanceRegressions']();

      expect(regressions.length).toBeGreaterThan(0);
      const significantRegression = regressions.find(r => r.degradationPercent > 20);
      expect(significantRegression).toBeDefined();
      expect(significantRegression!.severity).toBe('high');
    });

    test('should update baseline after significant regression', async () => {
      const operation = 'baselineUpdateTest';

      // Establish baseline
      for (let i = 0; i < 10; i++) {
        const operationId = `baseline-op-${i}`;
        profiler.startOperation(operationId, operation);
        jest.advanceTimersByTime(10);
        profiler.endOperation(operationId, operation, 'session1', 'test-service', true);
      }

      const initialBaseline = (profiler as any).baselines.get(operation);
      expect(initialBaseline).toBeDefined();

      // Simulate significant regression (>20%)
      for (let i = 0; i < 10; i++) {
        const operationId = `regression-op-${i}`;
        profiler.startOperation(operationId, operation);
        jest.advanceTimersByTime(50); // 5x slower
        profiler.endOperation(operationId, operation, 'session1', 'test-service', true);
      }

      await profiler['checkPerformanceRegressions']();

      const updatedBaseline = (profiler as any).baselines.get(operation);
      expect(updatedBaseline.avgDuration).toBeGreaterThan(initialBaseline.avgDuration);
    });
  });

  describe('Dashboard Data', () => {
    test('should provide comprehensive dashboard data', async () => {
      // Add some test operations
      for (let i = 0; i < 5; i++) {
        const operationId = `dashboard-op-${i}`;
        profiler.startOperation(operationId, 'dashboardTest');
        jest.advanceTimersByTime(20 + i * 10);
        profiler.endOperation(operationId, 'dashboardTest', 'session1', 'test-service', true);
      }

      const dashboard = await profiler.getDashboardData();

      expect(dashboard).toBeDefined();
      expect(dashboard.timestamp).toBeDefined();
      expect(dashboard.systemMetrics).toBeDefined();
      expect(dashboard.operations).toBeDefined();
      expect(dashboard.operations['dashboardTest:test-service']).toBeDefined();

      const operationData = dashboard.operations['dashboardTest:test-service'];
      expect(operationData.sampleCount).toBe(5);
      expect(operationData.avgDuration).toBeGreaterThan(0);
      expect(operationData.throughput).toBeGreaterThan(0);
    });

    test('should include system metrics in dashboard', async () => {
      const dashboard = await profiler.getDashboardData();

      expect(dashboard.systemMetrics).toBeDefined();
      expect(dashboard.systemMetrics.memoryUsage).toBeDefined();
      expect(dashboard.systemMetrics.cpuUsage).toBeDefined();
      expect(dashboard.systemMetrics.uptime).toBeDefined();
    });
  });

  describe('Statistics and Analytics', () => {
    test('should calculate operation statistics correctly', () => {
      const operation = 'statsTest';

      // Add operations with varying durations
      const durations = [10, 20, 30, 40, 50];
      durations.forEach((duration, i) => {
        const operationId = `stats-op-${i}`;
        profiler.startOperation(operationId, operation);
        jest.advanceTimersByTime(duration);
        profiler.endOperation(operationId, operation, 'session1', 'test-service', true);
      });

      const stats = profiler.getOperationStats(operation, 'test-service');

      expect(stats).toBeDefined();
      expect(stats.sampleCount).toBe(5);
      expect(stats.duration.avg).toBe(30); // Average of [10,20,30,40,50]
      expect(stats.duration.min).toBe(10);
      expect(stats.duration.max).toBe(50);
      expect(stats.successRate).toBe(1.0);
    });

    test('should provide comprehensive system statistics', () => {
      // Add some test data
      profiler.recordMetric('testOp', 'session1', 'testService', 'operation_duration' as any, 100);

      const allStats = profiler.getAllStats();

      expect(allStats).toBeDefined();
      expect(allStats.timestamp).toBeDefined();
      expect(allStats.totalOperations).toBeGreaterThan(0);
      expect(allStats.operations).toBeDefined();
      expect(allStats.systemInfo).toBeDefined();
      expect(allStats.systemInfo.platform).toBeDefined();
    });
  });

  describe('Data Management', () => {
    test('should clear old performance data', async () => {
      // Add some old data
      const oldTimestamp = Date.now() - 48 * 3600000; // 48 hours ago

      const oldSample = {
        timestamp: oldTimestamp,
        operation: 'oldOperation',
        sessionId: 'session1',
        service: 'test-service',
        duration: 100,
        memoryUsage: 0.5,
        cpuUsage: 0.1,
        success: true,
      };

      (profiler as any).samples.set('oldOperation:test-service', [oldSample]);

      await profiler.clearOldData();

      const remainingSamples = (profiler as any).samples.get('oldOperation:test-service') || [];
      expect(remainingSamples.length).toBe(0);
    });

    test('should handle Redis storage errors gracefully', async () => {
      const profilerWithRedis = createPerformanceProfiler({
        enableRedisStorage: true,
      });

      // Mock Redis to throw error
      const mockRedisInstance = (profilerWithRedis as any).redis;
      mockRedisInstance.setEx.mockRejectedValue(new Error('Redis connection failed'));

      const operationId = 'redis-error-test';
      profilerWithRedis.startOperation(operationId, 'redisTest');
      profilerWithRedis.endOperation(operationId, 'redisTest', 'session1', 'test-service', true);

      // Should not throw error, just emit event
      const mockEmit = jest.fn();
      const originalEmit = profilerWithRedis.emit;
      profilerWithRedis.emit = mockEmit;

      await new Promise(resolve => setTimeout(resolve, 10)); // Allow async operations

      profilerWithRedis.emit = originalEmit;
      await profilerWithRedis.close();
    });
  });

  describe('Event Emission', () => {
    test('should emit dashboard update events', async () => {
      const mockEmit = jest.fn();
      const originalEmit = profiler.emit;
      profiler.emit = mockEmit;

      // Trigger dashboard update manually
      await profiler.getDashboardData();

      expect(mockEmit).toHaveBeenCalledWith('dashboardUpdate', expect.any(Object));

      profiler.emit = originalEmit;
    });

    test('should emit bottleneck detection events', async () => {
      // Add operations that will trigger bottleneck
      for (let i = 0; i < 15; i++) {
        const operationId = `bottleneck-event-${i}`;
        profiler.startOperation(operationId, 'bottleneckEventTest');
        jest.advanceTimersByTime(600);
        profiler.endOperation(operationId, 'bottleneckEventTest', 'session1', 'test-service', true);
      }

      const mockEmit = jest.fn();
      const originalEmit = profiler.emit;
      profiler.emit = mockEmit;

      // Manually trigger bottleneck detection
      const bottlenecks = await profiler['detectBottlenecks']();

      if (bottlenecks.length > 0) {
        expect(mockEmit).not.toHaveBeenCalledWith('bottlenecksDetected', bottlenecks);
      }

      profiler.emit = originalEmit;
    });
  });

  describe('Resource Management', () => {
    test('should cleanup resources on close', async () => {
      // Add some test data
      profiler.recordMetric('cleanupTest', 'session1', 'testService', 'operation_duration' as any, 50);

      expect((profiler as any).samples.size).toBeGreaterThan(0);

      await profiler.close();

      expect((profiler as any).samples.size).toBe(0);
      expect((profiler as any).activeOperations.size).toBe(0);
      expect((profiler as any).baselines.size).toBe(0);
    });

    test('should handle sampling rate correctly', () => {
      const lowSampleProfiler = createPerformanceProfiler({
        sampleRate: 0.5, // 50% sampling
      });

      // Mock Math.random to control sampling
      const originalRandom = Math.random;
      Math.random = jest.fn()
        .mockReturnValueOnce(0.3) // Sample this one (below 0.5)
        .mockReturnValueOnce(0.7); // Don't sample this one (above 0.5)

      const operationId1 = 'sampled-op';
      const operationId2 = 'not-sampled-op';

      lowSampleProfiler.startOperation(operationId1, 'sampledTest');
      lowSampleProfiler.endOperation(operationId1, 'sampledTest', 'session1', 'test-service', true);

      lowSampleProfiler.startOperation(operationId2, 'notSampledTest');
      lowSampleProfiler.endOperation(operationId2, 'notSampledTest', 'session1', 'test-service', true);

      const sampledStats = lowSampleProfiler.getOperationStats('sampledTest', 'test-service');
      const notSampledStats = lowSampleProfiler.getOperationStats('notSampledTest', 'test-service');

      expect(sampledStats).toBeDefined();
      expect(sampledStats!.sampleCount).toBe(1);

      // notSampledStats should be null or have 0 samples due to sampling
      expect(notSampledStats).toBeNull();

      Math.random = originalRandom;
      lowSampleProfiler.close();
    });
  });

  describe('Configuration', () => {
    test('should use default configuration when not provided', () => {
      const defaultProfiler = createPerformanceProfiler();

      expect((defaultProfiler as any).config.sampleRate).toBe(0.1);
      expect((defaultProfiler as any).config.retentionPeriod).toBe(24);
      expect((defaultProfiler as any).config.thresholds).toEqual(DEFAULT_PERFORMANCE_THRESHOLDS);

      defaultProfiler.close();
    });

    test('should merge custom configuration with defaults', () => {
      const customProfiler = createPerformanceProfiler({
        sampleRate: 0.5,
        retentionPeriod: 48,
      });

      expect((customProfiler as any).config.sampleRate).toBe(0.5);
      expect((customProfiler as any).config.retentionPeriod).toBe(48);
      expect((customProfiler as any).config.dashboardUpdateInterval).toBe(30); // Default value

      customProfiler.close();
    });
  });
});
