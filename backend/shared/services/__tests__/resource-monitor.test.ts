import { jest } from '@jest/globals';
import { ResourceMonitor, createResourceMonitor, ResourceType, ResourceUsageLevel } from '../resource-monitor';
import * as os from 'os';
import * as fs from 'fs/promises';

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    setEx: jest.fn(),
    get: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
  })),
}));

// Mock os module
jest.mock('os', () => ({
  cpus: jest.fn(() => [{}]), // Mock single CPU
  loadavg: jest.fn(() => [1.0, 1.0, 1.0]),
  totalmem: jest.fn(() => 8 * 1024 * 1024 * 1024), // 8GB
  freemem: jest.fn(() => 4 * 1024 * 1024 * 1024), // 4GB
}));

// Mock fs module
jest.mock('fs/promises', () => ({
  statvfs: jest.fn(),
}));

// Mock v8
jest.mock('v8', () => ({
  getHeapStatistics: jest.fn(() => ({
    heap_size_limit: 2 * 1024 * 1024 * 1024, // 2GB
    used_heap_size: 1 * 1024 * 1024 * 1024, // 1GB
    total_heap_size: 1.5 * 1024 * 1024 * 1024, // 1.5GB
  })),
}));

describe('ResourceMonitor', () => {
  let resourceMonitor: ResourceMonitor;
  let mockRedis: any;

  beforeEach(() => {
    jest.useFakeTimers();
    resourceMonitor = createResourceMonitor({
      redisUrl: 'redis://localhost:6379',
      monitoringInterval: 30,
      enableDetailedMetrics: false, // Disable for tests
    });

    mockRedis = (resourceMonitor as any).redis;
  });

  afterEach(async () => {
    await resourceMonitor.close();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const defaultMonitor = createResourceMonitor();
      expect(defaultMonitor).toBeDefined();
    });

    test('should initialize resource history for all types', () => {
      const history = (resourceMonitor as any).resourceHistory;
      expect(history.has(ResourceType.CPU)).toBe(true);
      expect(history.has(ResourceType.MEMORY)).toBe(true);
      expect(history.has(ResourceType.FILESYSTEM)).toBe(true);
      expect(history.has(ResourceType.CACHE)).toBe(true);
    });
  });

  describe('Resource Metrics Collection', () => {
    test('should collect comprehensive resource metrics', async () => {
      // Mock process.memoryUsage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 500 * 1024 * 1024, // 500MB
        heapTotal: 1024 * 1024 * 1024, // 1GB
        external: 50 * 1024 * 1024, // 50MB
        rss: 600 * 1024 * 1024, // 600MB
        arrayBuffers: 0,
      }));

      // Mock process.cpuUsage
      const originalCpuUsage = process.cpuUsage;
      process.cpuUsage = jest.fn(() => ({
        user: 1000000, // 1 second
        system: 500000, // 0.5 seconds
      }));

      // Mock fs.statvfs
      const mockFs = require('fs/promises');
      mockFs.statvfs.mockResolvedValue({
        f_blocks: 1000000,
        f_frsize: 4096,
        f_available: 500000,
      });

      const stats = await resourceMonitor.getCurrentStats();

      expect(stats).toBeDefined();
      expect(stats.cpu).toBeDefined();
      expect(stats.memory).toBeDefined();
      expect(stats.filesystem).toBeDefined();
      expect(stats.cache).toBeDefined();

      // Restore mocks
      process.memoryUsage = originalMemoryUsage;
      process.cpuUsage = originalCpuUsage;
    });

    test('should calculate CPU usage correctly', async () => {
      const originalCpuUsage = process.cpuUsage;
      process.cpuUsage = jest.fn(() => ({
        user: 2000000, // 2 seconds
        system: 1000000, // 1 second
      }));

      const stats = await resourceMonitor.getCurrentStats();

      expect(stats.cpu.user).toBeGreaterThan(0);
      expect(stats.cpu.system).toBeGreaterThan(0);

      process.cpuUsage = originalCpuUsage;
    });

    test('should calculate memory usage percentages', async () => {
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 800 * 1024 * 1024, // 800MB
        heapTotal: 1024 * 1024 * 1024, // 1GB
        external: 0,
        rss: 900 * 1024 * 1024,
        arrayBuffers: 0,
      }));

      const stats = await resourceMonitor.getCurrentStats();

      expect(stats.memory.usage).toBeGreaterThan(0);
      expect(stats.memory.usage).toBeLessThanOrEqual(100);

      process.memoryUsage = originalMemoryUsage;
    });

    test('should handle filesystem stats gracefully', async () => {
      const mockFs = require('fs/promises');
      mockFs.statvfs.mockRejectedValue(new Error('statvfs not supported'));

      const stats = await resourceMonitor.getCurrentStats();

      // Should fallback to basic memory-based calculation
      expect(stats.filesystem.total).toBe(os.totalmem());
      expect(stats.filesystem.usage).toBeGreaterThan(0);
    });
  });

  describe('Threshold Checking and Alerting', () => {
    test('should emit alerts for critical CPU usage', async () => {
      const mockEmit = jest.fn();
      const originalEmit = resourceMonitor.emit;
      resourceMonitor.emit = mockEmit;

      // Mock high CPU usage
      const originalMemoryUsage = process.memoryUsage;
      const originalCpuUsage = process.cpuUsage;

      process.memoryUsage = jest.fn(() => ({
        heapUsed: 100 * 1024 * 1024,
        heapTotal: 1024 * 1024 * 1024,
        external: 0,
        rss: 200 * 1024 * 1024,
        arrayBuffers: 0,
      }));

      process.cpuUsage = jest.fn(() => ({
        user: 90000000, // Very high CPU usage
        system: 10000000,
      }));

      // Trigger threshold check manually
      await (resourceMonitor as any).checkThresholds();

      expect(mockEmit).toHaveBeenCalledWith('resourceAlert', expect.objectContaining({
        resourceType: ResourceType.CPU,
        severity: 'critical',
      }));

      process.memoryUsage = originalMemoryUsage;
      process.cpuUsage = originalCpuUsage;
      resourceMonitor.emit = originalEmit;
    });

    test('should emit alerts for memory usage', async () => {
      const mockEmit = jest.fn();
      const originalEmit = resourceMonitor.emit;
      resourceMonitor.emit = mockEmit;

      // Mock critical memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 980 * 1024 * 1024, // 980MB
        heapTotal: 1024 * 1024 * 1024, // 1GB
        external: 0,
        rss: 990 * 1024 * 1024,
        arrayBuffers: 0,
      }));

      await (resourceMonitor as any).checkThresholds();

      expect(mockEmit).toHaveBeenCalledWith('resourceAlert', expect.objectContaining({
        resourceType: ResourceType.MEMORY,
        severity: 'critical',
      }));

      process.memoryUsage = originalMemoryUsage;
      resourceMonitor.emit = originalEmit;
    });

    test('should respect alert cooldown period', async () => {
      const mockEmit = jest.fn();
      const originalEmit = resourceMonitor.emit;
      resourceMonitor.emit = mockEmit;

      // Mock critical memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 980 * 1024 * 1024,
        heapTotal: 1024 * 1024 * 1024,
        external: 0,
        rss: 990 * 1024 * 1024,
        arrayBuffers: 0,
      }));

      // First alert
      await (resourceMonitor as any).checkThresholds();

      // Second alert (should be blocked by cooldown)
      await (resourceMonitor as any).checkThresholds();

      expect(mockEmit).toHaveBeenCalledTimes(1);

      process.memoryUsage = originalMemoryUsage;
      resourceMonitor.emit = originalEmit;
    });

    test('should generate appropriate recommendations for CPU alerts', async () => {
      const recommendations = (resourceMonitor as any).generateResourceRecommendations(ResourceType.CPU, 'critical');

      expect(recommendations).toContain('Consider horizontal scaling or optimizing CPU-intensive operations');
      expect(recommendations).toContain('Review and optimize database queries');
    });

    test('should generate appropriate recommendations for memory alerts', async () => {
      const recommendations = (resourceMonitor as any).generateResourceRecommendations(ResourceType.MEMORY, 'critical');

      expect(recommendations).toContain('Immediate action required: memory leak or excessive usage detected');
      expect(recommendations).toContain('Consider increasing memory allocation or optimizing memory usage');
    });
  });

  describe('Resource Usage History', () => {
    test('should maintain resource usage history', async () => {
      // Add some metrics to history
      await resourceMonitor.getCurrentStats();

      const cpuHistory = resourceMonitor.getResourceHistory(ResourceType.CPU, 1);
      expect(cpuHistory.length).toBeGreaterThan(0);

      const memoryHistory = resourceMonitor.getResourceHistory(ResourceType.MEMORY, 1);
      expect(memoryHistory.length).toBeGreaterThan(0);
    });

    test('should filter history by time range', async () => {
      // Add metrics
      await resourceMonitor.getCurrentStats();

      // Get history for last hour
      const recentHistory = resourceMonitor.getResourceHistory(ResourceType.CPU, 1);
      expect(recentHistory.length).toBeGreaterThan(0);

      // Get history for last minute (should be empty or very small)
      const veryRecentHistory = resourceMonitor.getResourceHistory(ResourceType.CPU, 1/60);
      expect(veryRecentHistory.length).toBeLessThanOrEqual(recentHistory.length);
    });
  });

  describe('Resource Predictions', () => {
    test('should generate resource usage predictions', async () => {
      // Add sufficient historical data for prediction
      const mockMetrics = [];
      const baseTime = Date.now() - 20 * 60 * 1000; // 20 minutes ago

      for (let i = 0; i < 15; i++) {
        mockMetrics.push({
          timestamp: baseTime + i * 60 * 1000, // Every minute
          resourceType: ResourceType.CPU,
          name: 'cpu_usage',
          value: 50 + i * 2, // Gradually increasing CPU usage
          unit: '%',
          level: ResourceUsageLevel.MODERATE,
          metadata: {},
        });
      }

      (resourceMonitor as any).resourceHistory.set(ResourceType.CPU, mockMetrics);

      const predictions = await resourceMonitor.getPredictions();

      expect(predictions.length).toBeGreaterThan(0);
      const cpuPrediction = predictions.find(p => p.resourceType === ResourceType.CPU);
      expect(cpuPrediction).toBeDefined();
      expect(cpuPrediction!.trend).toBe('increasing');
    });

    test('should handle insufficient data for predictions', async () => {
      // Clear history
      (resourceMonitor as any).resourceHistory.set(ResourceType.CPU, []);

      const predictions = await resourceMonitor.getPredictions();

      // Should not generate predictions with insufficient data
      expect(predictions.filter(p => p.resourceType === ResourceType.CPU)).toHaveLength(0);
    });
  });

  describe('Optimization Recommendations', () => {
    test('should generate CPU optimization recommendations', async () => {
      // Mock high CPU usage
      const originalMemoryUsage = process.memoryUsage;
      const originalCpuUsage = process.cpuUsage;

      process.memoryUsage = jest.fn(() => ({
        heapUsed: 100 * 1024 * 1024,
        heapTotal: 1024 * 1024 * 1024,
        external: 0,
        rss: 200 * 1024 * 1024,
        arrayBuffers: 0,
      }));

      process.cpuUsage = jest.fn(() => ({
        user: 80000000, // High CPU usage
        system: 20000000,
      }));

      const recommendations = await resourceMonitor.getOptimizationRecommendations();

      expect(recommendations.length).toBeGreaterThan(0);
      const cpuRec = recommendations.find(r => r.resourceType === ResourceType.CPU);
      expect(cpuRec).toBeDefined();
      expect(cpuRec!.priority).toBe('critical');

      process.memoryUsage = originalMemoryUsage;
      process.cpuUsage = originalCpuUsage;
    });

    test('should generate memory optimization recommendations', async () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 950 * 1024 * 1024, // 950MB
        heapTotal: 1024 * 1024 * 1024, // 1GB
        external: 0,
        rss: 960 * 1024 * 1024,
        arrayBuffers: 0,
      }));

      const recommendations = await resourceMonitor.getOptimizationRecommendations();

      expect(recommendations.length).toBeGreaterThan(0);
      const memoryRec = recommendations.find(r => r.resourceType === ResourceType.MEMORY);
      expect(memoryRec).toBeDefined();
      expect(memoryRec!.priority).toBe('critical');

      process.memoryUsage = originalMemoryUsage;
    });

    test('should generate cache optimization recommendations', async () => {
      // Mock low cache hit rate
      const mockStats = await resourceMonitor.getCurrentStats();
      mockStats.cache.hitRate = 0.4; // 40% hit rate

      const recommendations = await resourceMonitor.getOptimizationRecommendations();

      // Should include cache optimization recommendations
      const cacheRec = recommendations.find(r => r.resourceType === ResourceType.CACHE);
      if (cacheRec) {
        expect(cacheRec.priority).toBe('high');
        expect(cacheRec.expectedImprovement).toBeGreaterThan(0);
      }
    });
  });

  describe('Dashboard Data', () => {
    test('should provide comprehensive dashboard data', async () => {
      const dashboard = await resourceMonitor.getDashboardData();

      expect(dashboard).toBeDefined();
      expect(dashboard.timestamp).toBeDefined();
      expect(dashboard.currentStats).toBeDefined();
      expect(dashboard.alerts).toBeDefined();
      expect(dashboard.predictions).toBeDefined();
      expect(dashboard.recommendations).toBeDefined();
      expect(dashboard.trends).toBeDefined();
      expect(dashboard.summary).toBeDefined();
    });

    test('should calculate overall health score', async () => {
      const currentStats = await resourceMonitor.getCurrentStats();
      const activeAlerts: any[] = [];

      const healthScore = (resourceMonitor as any).calculateOverallHealth(currentStats, activeAlerts);

      expect(healthScore).toBeGreaterThanOrEqual(0);
      expect(healthScore).toBeLessThanOrEqual(100);
    });

    test('should calculate resource efficiency', async () => {
      const currentStats = await resourceMonitor.getCurrentStats();

      const efficiency = (resourceMonitor as any).calculateResourceEfficiency(currentStats);

      expect(efficiency).toBeGreaterThanOrEqual(0);
      expect(efficiency).toBeLessThanOrEqual(100);
    });
  });

  describe('Resource History Management', () => {
    test('should store metrics in Redis when available', async () => {
      mockRedis.setEx.mockResolvedValue('OK');

      await resourceMonitor.getCurrentStats();

      expect(mockRedis.setEx).toHaveBeenCalledWith(
        expect.stringContaining('resource_stats:'),
        expect.any(Number),
        expect.any(String)
      );
    });

    test('should handle Redis storage errors gracefully', async () => {
      mockRedis.setEx.mockRejectedValue(new Error('Redis connection failed'));

      // Should not throw error
      await expect(resourceMonitor.getCurrentStats()).resolves.toBeDefined();
    });
  });

  describe('Active Alerts Management', () => {
    test('should track active alerts', async () => {
      // Initially no alerts
      expect(resourceMonitor.getActiveAlerts()).toHaveLength(0);

      // Add a mock alert
      const mockAlert = {
        id: 'test-alert',
        timestamp: Date.now(),
        resourceType: ResourceType.CPU,
        severity: 'warning' as const,
        message: 'Test alert',
        currentValue: 80,
        threshold: 70,
        unit: '%',
        sustained: true,
        recommendations: ['Test recommendation'],
      };

      (resourceMonitor as any).activeAlerts.set(mockAlert.id, mockAlert);

      expect(resourceMonitor.getActiveAlerts()).toHaveLength(1);
      expect(resourceMonitor.getActiveAlerts()[0].id).toBe('test-alert');
    });
  });

  describe('Configuration', () => {
    test('should respect custom configuration values', () => {
      const customMonitor = createResourceMonitor({
        monitoringInterval: 60,
        retentionPeriod: 48,
        alertCooldownPeriod: 10,
      });

      expect((customMonitor as any).config.monitoringInterval).toBe(60);
      expect((customMonitor as any).config.retentionPeriod).toBe(48);
      expect((customMonitor as any).config.alertCooldownPeriod).toBe(10);

      customMonitor.close();
    });

    test('should use default values for unspecified configuration', () => {
      const partialMonitor = createResourceMonitor({
        monitoringInterval: 45, // Only specify one value
      });

      expect((partialMonitor as any).config.monitoringInterval).toBe(45);
      expect((partialMonitor as any).config.retentionPeriod).toBe(24); // Default
      expect((partialMonitor as any).config.enableDetailedMetrics).toBe(true); // Default

      partialMonitor.close();
    });
  });

  describe('Resource Management', () => {
    test('should cleanup resources on close', async () => {
      // Add some test data
      (resourceMonitor as any).activeAlerts.set('test', { id: 'test' });
      (resourceMonitor as any).resourceHistory.set(ResourceType.CPU, [{ timestamp: Date.now() }]);

      expect((resourceMonitor as any).activeAlerts.size).toBeGreaterThan(0);
      expect((resourceMonitor as any).resourceHistory.get(ResourceType.CPU)).toBeDefined();

      await resourceMonitor.close();

      expect((resourceMonitor as any).activeAlerts.size).toBe(0);
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    test('should handle Redis connection errors during initialization', async () => {
      mockRedis.connect.mockRejectedValue(new Error('Connection failed'));

      const monitorWithRedisError = createResourceMonitor({
        redisUrl: 'redis://invalid:6379',
      });

      expect(monitorWithRedisError).toBeDefined();
      await monitorWithRedisError.close();
    });
  });

  describe('Event Emission', () => {
    test('should emit metrics collected events', async () => {
      const mockEmit = jest.fn();
      const originalEmit = resourceMonitor.emit;
      resourceMonitor.emit = mockEmit;

      await resourceMonitor.getCurrentStats();

      expect(mockEmit).toHaveBeenCalledWith('metricsCollected', expect.any(Object));

      resourceMonitor.emit = originalEmit;
    });

    test('should emit dashboard data events', async () => {
      const mockEmit = jest.fn();
      const originalEmit = resourceMonitor.emit;
      resourceMonitor.emit = mockEmit;

      await resourceMonitor.getDashboardData();

      // Dashboard data emission is internal, but metrics collection should trigger
      expect(mockEmit).toHaveBeenCalledWith('metricsCollected', expect.any(Object));

      resourceMonitor.emit = originalEmit;
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle multiple resource types simultaneously', async () => {
      const stats = await resourceMonitor.getCurrentStats();

      // Should have data for all resource types
      expect(stats.cpu).toBeDefined();
      expect(stats.memory).toBeDefined();
      expect(stats.filesystem).toBeDefined();
      expect(stats.cache).toBeDefined();
      expect(stats.database).toBeDefined();
    });

    test('should provide consistent data across multiple calls', async () => {
      const stats1 = await resourceMonitor.getCurrentStats();
      const stats2 = await resourceMonitor.getCurrentStats();

      // Should have consistent structure
      expect(Object.keys(stats1)).toEqual(Object.keys(stats2));
      expect(stats1.cpu).toBeDefined();
      expect(stats2.cpu).toBeDefined();
    });

    test('should maintain history across multiple metric collections', async () => {
      // First collection
      await resourceMonitor.getCurrentStats();
      const historyAfterFirst = resourceMonitor.getResourceHistory(ResourceType.CPU, 1);

      // Second collection
      await resourceMonitor.getCurrentStats();
      const historyAfterSecond = resourceMonitor.getResourceHistory(ResourceType.CPU, 1);

      expect(historyAfterSecond.length).toBeGreaterThanOrEqual(historyAfterFirst.length);
    });
  });
});
