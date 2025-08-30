import { jest } from '@jest/globals';
import { LoadTester, createLoadTester, DEFAULT_LOAD_TEST_CONFIG } from '../load-tester';
import * as fs from 'fs/promises';
import * as path from 'path';

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

// Mock fs/promises
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  access: jest.fn(),
  unlink: jest.fn(),
  readdir: jest.fn(),
}));

describe('LoadTester', () => {
  let loadTester: LoadTester;
  let mockRedis: any;

  beforeEach(() => {
    jest.useFakeTimers();
    loadTester = createLoadTester({
      redisUrl: 'redis://localhost:6379',
      resultsRetention: 24,
      maxConcurrentOperations: 10,
      enableRealTimeMonitoring: false, // Disable for tests
      monitoringInterval: 5,
    });

    mockRedis = (loadTester as any).redis;
  });

  afterEach(async () => {
    await loadTester.close();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const defaultTester = createLoadTester();
      expect(defaultTester).toBeDefined();
    });

    test('should initialize benchmarks on creation', () => {
      const benchmarks = (loadTester as any).benchmarks;
      expect(benchmarks.has('latency')).toBe(true);
      expect(benchmarks.has('throughput')).toBe(true);
      expect(benchmarks.has('resource')).toBe(true);
      expect(benchmarks.has('scalability')).toBe(true);
    });
  });

  describe('Load Test Scenarios', () => {
    const testScenario = {
      name: 'basic-load-test',
      description: 'Basic load test scenario',
      duration: 5, // 5 seconds for testing
      concurrency: 2,
      rampUpTime: 1,
      operations: [
        {
          type: 'read' as const,
          weight: 70,
          fileSizeRange: { min: 1024, max: 10240 },
          frequency: 10,
          sessionDistribution: 'uniform' as const,
        },
        {
          type: 'write' as const,
          weight: 30,
          fileSizeRange: { min: 1024, max: 5120 },
          frequency: 5,
          sessionDistribution: 'uniform' as const,
        },
      ],
      dataPattern: {
        totalFiles: 10,
        fileSizeDistribution: 'uniform' as const,
        sessionCount: 3,
        hotSpotRatio: 0.2,
        temporalLocality: 0.8,
      },
    };

    test('should execute load test scenario', async () => {
      const mockFs = require('fs/promises');
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.access.mockResolvedValue(undefined);

      const result = await loadTester.executeLoadTest(testScenario);

      expect(result).toBeDefined();
      expect(result.scenario).toBe('basic-load-test');
      expect(result.totalOperations).toBeGreaterThan(0);
      expect(result.successfulOperations).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.throughput).toBeGreaterThan(0);
      expect(result.latency.avg).toBeGreaterThan(0);
    });

    test('should handle test data preparation', async () => {
      const mockFs = require('fs/promises');
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const scenario = { ...testScenario, dataPattern: { ...testScenario.dataPattern, totalFiles: 5 } };

      // Mock the private method
      const prepareDataSpy = jest.spyOn(loadTester as any, 'prepareTestData');
      prepareDataSpy.mockResolvedValue(undefined);

      await loadTester.executeLoadTest(scenario);

      expect(prepareDataSpy).toHaveBeenCalledWith(scenario);
    });

    test('should calculate latency statistics correctly', () => {
      const latencies = [10, 20, 30, 40, 50];
      const stats = (loadTester as any).calculateLatencyStats(latencies);

      expect(stats.avg).toBe(30);
      expect(stats.min).toBe(10);
      expect(stats.max).toBe(50);
      expect(stats.p50).toBe(30);
      expect(stats.p95).toBe(50);
      expect(stats.p99).toBe(50);
    });

    test('should handle empty latency data', () => {
      const stats = (loadTester as any).calculateLatencyStats([]);

      expect(stats.avg).toBe(0);
      expect(stats.min).toBe(0);
      expect(stats.max).toBe(0);
      expect(stats.p50).toBe(0);
      expect(stats.p95).toBe(0);
      expect(stats.p99).toBe(0);
    });
  });

  describe('File Size Generation', () => {
    test('should generate uniform file sizes', () => {
      const sizes: number[] = [];
      for (let i = 0; i < 10; i++) {
        sizes.push((loadTester as any).generateFileSize('uniform'));
      }

      expect(sizes.every(size => size >= 1024 && size <= 1024 * 1024)).toBe(true);
      expect(sizes.length).toBe(10);
    });

    test('should generate normal distribution file sizes', () => {
      const sizes: number[] = [];
      for (let i = 0; i < 10; i++) {
        sizes.push((loadTester as any).generateFileSize('normal'));
      }

      expect(sizes.every(size => size >= 1024)).toBe(true);
      expect(sizes.length).toBe(10);
    });

    test('should generate pareto distribution file sizes', () => {
      const sizes: number[] = [];
      for (let i = 0; i < 10; i++) {
        sizes.push((loadTester as any).generateFileSize('pareto'));
      }

      expect(sizes.every(size => size > 0)).toBe(true);
      expect(sizes.length).toBe(10);
    });
  });

  describe('Operation Selection', () => {
    const operations = [
      { type: 'read' as const, weight: 60, fileSizeRange: { min: 1, max: 10 }, frequency: 10, sessionDistribution: 'uniform' as const },
      { type: 'write' as const, weight: 40, fileSizeRange: { min: 1, max: 10 }, frequency: 10, sessionDistribution: 'uniform' as const },
    ];

    test('should select operations based on weights', () => {
      const selections: string[] = [];
      for (let i = 0; i < 100; i++) {
        const operation = (loadTester as any).selectOperation(operations);
        selections.push(operation.type);
      }

      const readCount = selections.filter(s => s === 'read').length;
      const writeCount = selections.filter(s => s === 'write').length;

      // Should be roughly 60/40 split
      expect(readCount).toBeGreaterThan(50);
      expect(writeCount).toBeGreaterThan(25);
      expect(readCount + writeCount).toBe(100);
    });
  });

  describe('Session Selection', () => {
    test('should select sessions with uniform distribution', () => {
      const selections: string[] = [];
      for (let i = 0; i < 50; i++) {
        selections.push((loadTester as any).selectSession(5, 'uniform'));
      }

      const uniqueSessions = new Set(selections);
      expect(uniqueSessions.size).toBeGreaterThan(1); // Should use multiple sessions
    });

    test('should select sessions with normal distribution', () => {
      const selections: string[] = [];
      for (let i = 0; i < 50; i++) {
        selections.push((loadTester as any).selectSession(5, 'normal'));
      }

      expect(selections.length).toBe(50);
      expect(selections.every(s => s.startsWith('session-'))).toBe(true);
    });

    test('should select sessions with zipfian distribution', () => {
      const selections: string[] = [];
      for (let i = 0; i < 50; i++) {
        selections.push((loadTester as any).selectSession(5, 'zipfian'));
      }

      expect(selections.length).toBe(50);
      // Zipfian should favor lower session numbers
      const session0Count = selections.filter(s => s === 'session-0').length;
      const session4Count = selections.filter(s => s === 'session-4').length;
      expect(session0Count).toBeGreaterThan(session4Count);
    });
  });

  describe('Benchmarking', () => {
    test('should evaluate benchmarks against test results', async () => {
      const mockResult = {
        scenario: 'test-scenario',
        startTime: Date.now(),
        endTime: Date.now() + 10000,
        duration: 10,
        totalOperations: 100,
        successfulOperations: 95,
        failedOperations: 5,
        throughput: 10,
        latency: {
          avg: 50,
          p50: 45,
          p95: 80,
          p99: 95,
          min: 10,
          max: 100,
        },
        errorRate: 0.05,
        resourceUsage: {
          avgCpu: 0.3,
          peakCpu: 0.5,
          avgMemory: 0.6,
          peakMemory: 0.8,
          avgDiskIO: 0,
          peakDiskIO: 0,
        },
        bottlenecks: [],
        recommendations: [],
      };

      const benchmarkResults = await (loadTester as any).evaluateBenchmarks(mockResult);

      expect(benchmarkResults).toBeDefined();
      expect(benchmarkResults.length).toBeGreaterThan(0);
      expect(benchmarkResults.every(r => typeof r.passed === 'boolean')).toBe(true);
    });

    test('should extract benchmark values correctly', () => {
      const mockResult = {
        latency: { avg: 75 },
        throughput: 50,
        resourceUsage: { avgMemory: 0.7, avgCpu: 0.4 },
      };

      const benchmark = {
        name: 'fileAccessLatency',
        category: 'latency' as const,
        baseline: 50,
        target: 100,
        tolerance: 10,
        description: 'Test benchmark',
      };

      const value = (loadTester as any).extractBenchmarkValue(mockResult, benchmark);
      expect(value).toBe(75);
    });
  });

  describe('Performance Regression Detection', () => {
    test('should check for performance regressions', async () => {
      // Add mock test history
      const mockHistory = [
        {
          scenario: 'test-scenario',
          startTime: Date.now() - 300000, // 5 minutes ago
          latency: { avg: 50 },
          throughput: 100,
          errorRate: 0.01,
        },
        {
          scenario: 'test-scenario',
          startTime: Date.now() - 180000, // 3 minutes ago
          latency: { avg: 75 },
          throughput: 80,
          errorRate: 0.02,
        },
        {
          scenario: 'test-scenario',
          startTime: Date.now() - 60000, // 1 minute ago
          latency: { avg: 90 },
          throughput: 60,
          errorRate: 0.03,
        },
      ];

      (loadTester as any).testHistory.set('test-scenario', mockHistory);

      const regressions = await loadTester.checkPerformanceRegressions('test-scenario');

      expect(regressions).toBeDefined();
      expect(regressions.length).toBeGreaterThan(0);
      expect(regressions.some(r => r.type === 'latency')).toBe(true);
    });

    test('should return empty array when insufficient data', async () => {
      const regressions = await loadTester.checkPerformanceRegressions('nonexistent-scenario');
      expect(regressions).toEqual([]);
    });
  });

  describe('Comparison Reports', () => {
    test('should generate comparison reports', async () => {
      // Add mock test history
      const mockHistory = [
        {
          scenario: 'comparison-test',
          startTime: Date.now() - 300000,
          latency: { avg: 60 },
          throughput: 90,
          errorRate: 0.02,
        },
        {
          scenario: 'comparison-test',
          startTime: Date.now() - 60000,
          latency: { avg: 45 },
          throughput: 110,
          errorRate: 0.01,
        },
      ];

      (loadTester as any).testHistory.set('comparison-test', mockHistory);

      const report = await loadTester.generateComparisonReport('comparison-test');

      expect(report).toBeDefined();
      expect(report.scenario).toBe('comparison-test');
      expect(report.comparison).toBeDefined();
      expect(report.comparison.changes).toBeDefined();
      expect(report.comparison.changes.latencyPercent).toBeLessThan(0); // Improved latency
      expect(report.comparison.changes.throughputPercent).toBeGreaterThan(0); // Improved throughput
    });

    test('should handle insufficient data for comparison', async () => {
      const report = await loadTester.generateComparisonReport('empty-scenario');

      expect(report.error).toBe('Insufficient historical data for comparison');
    });
  });

  describe('Test Management', () => {
    test('should track active tests', () => {
      const activeTests = loadTester.getActiveTests();
      expect(Array.isArray(activeTests)).toBe(true);
    });

    test('should cancel running tests', async () => {
      // Add a mock active test
      const executionId = 'test-execution';
      (loadTester as any).activeTests.set(executionId, {
        id: executionId,
        scenario: { name: 'test' },
        startTime: Date.now(),
        status: 'running',
      });

      expect(loadTester.getActiveTests()).toContain(executionId);

      await loadTester.cancelTest(executionId);

      expect(loadTester.getActiveTests()).not.toContain(executionId);
    });

    test('should handle canceling non-existent tests', async () => {
      await expect(loadTester.cancelTest('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('Test History', () => {
    test('should maintain test history', () => {
      const history = loadTester.getTestHistory('test-scenario');
      expect(Array.isArray(history)).toBe(true);
    });

    test('should store test results in history', async () => {
      const mockFs = require('fs/promises');
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.access.mockResolvedValue(undefined);

      const scenario = {
        name: 'history-test',
        description: 'Test for history',
        duration: 1,
        concurrency: 1,
        rampUpTime: 0,
        operations: [{
          type: 'read' as const,
          weight: 100,
          fileSizeRange: { min: 1024, max: 1024 },
          frequency: 10,
          sessionDistribution: 'uniform' as const,
        }],
        dataPattern: {
          totalFiles: 5,
          fileSizeDistribution: 'uniform' as const,
          sessionCount: 2,
          hotSpotRatio: 0.2,
          temporalLocality: 0.8,
        },
      };

      await loadTester.executeLoadTest(scenario);

      const history = loadTester.getTestHistory('history-test');
      expect(history.length).toBe(1);
      expect(history[0].scenario).toBe('history-test');
    });
  });

  describe('Resource Management', () => {
    test('should cleanup resources on close', async () => {
      // Add mock active test
      (loadTester as any).activeTests.set('test', { id: 'test' });

      await loadTester.close();

      expect(loadTester.getActiveTests()).toHaveLength(0);
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    test('should handle Redis connection errors gracefully', async () => {
      mockRedis.connect.mockRejectedValue(new Error('Connection failed'));

      const testerWithRedisError = createLoadTester({
        redisUrl: 'redis://invalid:6379',
      });

      expect(testerWithRedisError).toBeDefined();
      await testerWithRedisError.close();
    });
  });

  describe('Bottleneck Detection', () => {
    test('should identify performance bottlenecks', () => {
      const metrics = {
        latencies: [50, 1200, 80, 60], // One very slow operation
        totalOperations: 100,
        failedOperations: 15, // 15% error rate
        resourceUsage: [
          { memory: 0.95, cpu: 0.9 }, // High memory and CPU usage
        ],
      };

      const bottlenecks = (loadTester as any).identifyBottlenecks(metrics);

      expect(bottlenecks).toContain('High latency operations detected (>1s)');
      expect(bottlenecks).toContain('High error rate detected (>10%)');
      expect(bottlenecks).toContain('Memory usage bottleneck detected');
      expect(bottlenecks).toContain('CPU usage bottleneck detected');
    });

    test('should return empty array when no bottlenecks', () => {
      const metrics = {
        latencies: [50, 60, 70, 80],
        totalOperations: 100,
        failedOperations: 2, // 2% error rate
        resourceUsage: [
          { memory: 0.6, cpu: 0.4 }, // Normal usage
        ],
      };

      const bottlenecks = (loadTester as any).identifyBottlenecks(metrics);
      expect(bottlenecks).toEqual([]);
    });
  });

  describe('Recommendations Generation', () => {
    test('should generate recommendations based on results', () => {
      const result = {
        latency: { avg: 150 },
        errorRate: 0.08,
        resourceUsage: { avgMemory: 0.9 },
        bottlenecks: ['High latency', 'Memory pressure'],
      };

      const benchmarks = [
        { benchmark: { name: 'latency' }, passed: false },
        { benchmark: { name: 'memory' }, passed: false },
      ];

      const recommendations = (loadTester as any).generateRecommendations(result, benchmarks);

      expect(recommendations).toContain('Optimize file access patterns and consider caching improvements');
      expect(recommendations).toContain('Investigate and fix error conditions to improve reliability');
      expect(recommendations).toContain('Implement memory optimization strategies and monitor memory leaks');
      expect(recommendations).toContain('Resolve identified performance bottlenecks');
    });

    test('should generate comparison recommendations', () => {
      const current = {
        latency: { avg: 120 },
        errorRate: 0.05,
      };

      const previous = {
        latency: { avg: 80 },
        errorRate: 0.02,
      };

      const recommendations = (loadTester as any).generateComparisonRecommendations(current, previous);

      expect(recommendations).toContain('Performance degradation detected - investigate recent changes');
      expect(recommendations).toContain('Error rate increase detected - investigate error sources');
    });
  });

  describe('Configuration', () => {
    test('should respect custom configuration values', () => {
      const customTester = createLoadTester({
        maxConcurrentOperations: 50,
        resultsRetention: 48,
        monitoringInterval: 10,
      });

      expect((customTester as any).config.maxConcurrentOperations).toBe(50);
      expect((customTester as any).config.resultsRetention).toBe(48);
      expect((customTester as any).config.monitoringInterval).toBe(10);

      customTester.close();
    });

    test('should use default values for unspecified configuration', () => {
      const partialTester = createLoadTester({
        maxConcurrentOperations: 25, // Only specify one value
      });

      expect((partialTester as any).config.maxConcurrentOperations).toBe(25);
      expect((partialTester as any).config.resultsRetention).toBe(24); // Default
      expect((partialTester as any).config.enableRealTimeMonitoring).toBe(true); // Default

      partialTester.close();
    });
  });

  describe('Event Emission', () => {
    test('should emit test lifecycle events', async () => {
      const mockEmit = jest.fn();
      const originalEmit = loadTester.emit;
      loadTester.emit = mockEmit;

      const mockFs = require('fs/promises');
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.access.mockResolvedValue(undefined);

      const scenario = {
        name: 'event-test',
        description: 'Test events',
        duration: 1,
        concurrency: 1,
        rampUpTime: 0,
        operations: [{
          type: 'read' as const,
          weight: 100,
          fileSizeRange: { min: 1024, max: 1024 },
          frequency: 10,
          sessionDistribution: 'uniform' as const,
        }],
        dataPattern: {
          totalFiles: 3,
          fileSizeDistribution: 'uniform' as const,
          sessionCount: 2,
          hotSpotRatio: 0.2,
          temporalLocality: 0.8,
        },
      };

      await loadTester.executeLoadTest(scenario);

      expect(mockEmit).toHaveBeenCalledWith('testStarted', expect.any(Object));
      expect(mockEmit).toHaveBeenCalledWith('testCompleted', expect.any(Object));

      loadTester.emit = originalEmit;
    });

    test('should emit error events', async () => {
      const mockEmit = jest.fn();
      const originalEmit = loadTester.emit;
      loadTester.emit = mockEmit;

      const mockFs = require('fs/promises');
      mockFs.mkdir.mockRejectedValue(new Error('Filesystem error'));

      const scenario = {
        name: 'error-test',
        description: 'Test error handling',
        duration: 1,
        concurrency: 1,
        rampUpTime: 0,
        operations: [{
          type: 'read' as const,
          weight: 100,
          fileSizeRange: { min: 1024, max: 1024 },
          frequency: 10,
          sessionDistribution: 'uniform' as const,
        }],
        dataPattern: {
          totalFiles: 3,
          fileSizeDistribution: 'uniform' as const,
          sessionCount: 2,
          hotSpotRatio: 0.2,
          temporalLocality: 0.8,
        },
      };

      await expect(loadTester.executeLoadTest(scenario)).rejects.toThrow();

      expect(mockEmit).toHaveBeenCalledWith('testFailed', expect.any(Object));

      loadTester.emit = originalEmit;
    });
  });
});
