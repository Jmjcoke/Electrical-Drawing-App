import { jest } from '@jest/globals';
import {
  ConnectionPoolOptimizer,
  generateLoadTestConfig,
  LOAD_TEST_SCENARIOS,
} from '../connection-pool.config';
import { LoadTestResult } from '../connection-pool.config';

describe('ConnectionPoolOptimizer', () => {
  describe('analyzeLoadTestResults', () => {
    test('should return default configuration when no results provided', () => {
      const result = ConnectionPoolOptimizer.analyzeLoadTestResults([]);

      expect(result.recommendedConfig.maxConnections).toBe(20);
      expect(result.recommendedConfig.minConnections).toBe(5);
      expect(result.performanceScore).toBeGreaterThan(0);
      expect(result.recommendations).toContain('Default configuration suitable for moderate load');
    });

    test('should optimize for high performance requirements', () => {
      const results: LoadTestResult[] = [
        {
          concurrentUsers: 100,
          averageResponseTime: 25,
          maxResponseTime: 50,
          errorRate: 0.001,
          throughput: 800,
          memoryUsage: 50 * 1024 * 1024, // 50MB
          connectionPoolSize: 30,
        },
        {
          concurrentUsers: 200,
          averageResponseTime: 45,
          maxResponseTime: 80,
          errorRate: 0.005,
          throughput: 1200,
          memoryUsage: 80 * 1024 * 1024, // 80MB
          connectionPoolSize: 50,
        },
      ];

      const result = ConnectionPoolOptimizer.analyzeLoadTestResults(results);

      expect(result.recommendedConfig.maxConnections).toBeGreaterThan(20);
      expect(result.recommendedConfig.minConnections).toBeGreaterThan(5);
      expect(result.performanceScore).toBeGreaterThan(0.7);
      expect(result.recommendations).toContain('High-performance configuration');
    });

    test('should optimize for cost efficiency', () => {
      const results: LoadTestResult[] = [
        {
          concurrentUsers: 10,
          averageResponseTime: 150,
          maxResponseTime: 200,
          errorRate: 0.01,
          throughput: 50,
          memoryUsage: 20 * 1024 * 1024, // 20MB
          connectionPoolSize: 5,
        },
        {
          concurrentUsers: 25,
          averageResponseTime: 180,
          maxResponseTime: 250,
          errorRate: 0.02,
          throughput: 80,
          memoryUsage: 30 * 1024 * 1024, // 30MB
          connectionPoolSize: 8,
        },
      ];

      const result = ConnectionPoolOptimizer.analyzeLoadTestResults(results);

      expect(result.recommendedConfig.maxConnections).toBeLessThanOrEqual(20);
      expect(result.costEfficiency).toBeGreaterThan(0.8);
      expect(result.recommendations).toContain('Cost-optimized configuration');
    });

    test('should handle high error rates appropriately', () => {
      const results: LoadTestResult[] = [
        {
          concurrentUsers: 50,
          averageResponseTime: 100,
          maxResponseTime: 150,
          errorRate: 0.1, // 10% error rate
          throughput: 300,
          memoryUsage: 60 * 1024 * 1024,
          connectionPoolSize: 20,
        },
      ];

      const result = ConnectionPoolOptimizer.analyzeLoadTestResults(results);

      expect(result.recommendedConfig.retryAttempts).toBeGreaterThan(3);
      expect(result.recommendations).toContain('Error rate above 1%');
    });

    test('should provide scalability recommendations for high load', () => {
      const results: LoadTestResult[] = [
        {
          concurrentUsers: 150,
          averageResponseTime: 80,
          maxResponseTime: 120,
          errorRate: 0.005,
          throughput: 1000,
          memoryUsage: 100 * 1024 * 1024,
          connectionPoolSize: 40,
        },
      ];

      const result = ConnectionPoolOptimizer.analyzeLoadTestResults(results);

      expect(result.recommendations).toContain('High concurrent user load detected');
      expect(result.scalabilityRating).toBeGreaterThan(0.5);
    });
  });

  describe('getDefaultConfiguration', () => {
    test('should return conservative configuration values', () => {
      const result = ConnectionPoolOptimizer.getDefaultConfiguration();

      expect(result.recommendedConfig.maxConnections).toBe(20);
      expect(result.recommendedConfig.minConnections).toBe(5);
      expect(result.recommendedConfig.maxIdleTime).toBe(300000);
      expect(result.recommendedConfig.connectionTimeout).toBe(30000);
      expect(result.performanceScore).toBe(0.7);
      expect(result.costEfficiency).toBe(0.8);
    });
  });

  describe('getHighPerformanceConfiguration', () => {
    test('should return high-performance configuration values', () => {
      const result = ConnectionPoolOptimizer.getHighPerformanceConfiguration();

      expect(result.recommendedConfig.maxConnections).toBe(100);
      expect(result.recommendedConfig.minConnections).toBe(20);
      expect(result.recommendedConfig.acquireTimeout).toBe(5000);
      expect(result.recommendedConfig.healthCheckInterval).toBe(30000);
      expect(result.performanceScore).toBeGreaterThan(0.9);
      expect(result.recommendations).toContain('High-performance configuration');
    });
  });

  describe('getCostOptimizedConfiguration', () => {
    test('should return cost-optimized configuration values', () => {
      const result = ConnectionPoolOptimizer.getCostOptimizedConfiguration();

      expect(result.recommendedConfig.maxConnections).toBe(10);
      expect(result.recommendedConfig.minConnections).toBe(2);
      expect(result.recommendedConfig.maxIdleTime).toBe(600000);
      expect(result.costEfficiency).toBeGreaterThan(0.9);
      expect(result.recommendations).toContain('Cost-optimized configuration');
    });
  });

  describe('Performance Score Calculation', () => {
    test('should calculate high performance score for good metrics', () => {
      const results: LoadTestResult[] = [
        {
          concurrentUsers: 50,
          averageResponseTime: 25,
          maxResponseTime: 40,
          errorRate: 0.001,
          throughput: 800,
          memoryUsage: 50 * 1024 * 1024,
          connectionPoolSize: 20,
        },
      ];

      const config = ConnectionPoolOptimizer.getDefaultConfiguration().recommendedConfig;
      const score = (ConnectionPoolOptimizer as any).calculatePerformanceScore(results, config);

      expect(score).toBeGreaterThan(0.8);
    });

    test('should calculate low performance score for poor metrics', () => {
      const results: LoadTestResult[] = [
        {
          concurrentUsers: 50,
          averageResponseTime: 200,
          maxResponseTime: 500,
          errorRate: 0.1,
          throughput: 100,
          memoryUsage: 100 * 1024 * 1024,
          connectionPoolSize: 20,
        },
      ];

      const config = ConnectionPoolOptimizer.getDefaultConfiguration().recommendedConfig;
      const score = (ConnectionPoolOptimizer as any).calculatePerformanceScore(results, config);

      expect(score).toBeLessThan(0.5);
    });
  });

  describe('Cost Efficiency Calculation', () => {
    test('should calculate high efficiency for low resource usage', () => {
      const results: LoadTestResult[] = [
        {
          concurrentUsers: 50,
          averageResponseTime: 50,
          maxResponseTime: 80,
          errorRate: 0.01,
          throughput: 500,
          memoryUsage: 30 * 1024 * 1024, // 30MB
          connectionPoolSize: 10,
        },
      ];

      const config = ConnectionPoolOptimizer.getDefaultConfiguration().recommendedConfig;
      const efficiency = (ConnectionPoolOptimizer as any).calculateCostEfficiency(results, config);

      expect(efficiency).toBeGreaterThan(0.7);
    });

    test('should calculate low efficiency for high resource usage', () => {
      const results: LoadTestResult[] = [
        {
          concurrentUsers: 50,
          averageResponseTime: 50,
          maxResponseTime: 80,
          errorRate: 0.01,
          throughput: 200,
          memoryUsage: 200 * 1024 * 1024, // 200MB
          connectionPoolSize: 50,
        },
      ];

      const config = ConnectionPoolOptimizer.getDefaultConfiguration().recommendedConfig;
      const efficiency = (ConnectionPoolOptimizer as any).calculateCostEfficiency(results, config);

      expect(efficiency).toBeLessThan(0.5);
    });
  });

  describe('Scalability Rating Calculation', () => {
    test('should calculate good scalability for linear scaling', () => {
      const results: LoadTestResult[] = [
        {
          concurrentUsers: 10,
          averageResponseTime: 20,
          maxResponseTime: 30,
          errorRate: 0.001,
          throughput: 200,
          memoryUsage: 20 * 1024 * 1024,
          connectionPoolSize: 5,
        },
        {
          concurrentUsers: 50,
          averageResponseTime: 25,
          maxResponseTime: 40,
          errorRate: 0.005,
          throughput: 800,
          memoryUsage: 50 * 1024 * 1024,
          connectionPoolSize: 15,
        },
      ];

      const config = ConnectionPoolOptimizer.getDefaultConfiguration().recommendedConfig;
      const rating = (ConnectionPoolOptimizer as any).calculateScalabilityRating(results, config);

      expect(rating).toBeGreaterThan(0.5);
    });

    test('should calculate poor scalability for exponential degradation', () => {
      const results: LoadTestResult[] = [
        {
          concurrentUsers: 10,
          averageResponseTime: 20,
          maxResponseTime: 30,
          errorRate: 0.001,
          throughput: 200,
          memoryUsage: 20 * 1024 * 1024,
          connectionPoolSize: 5,
        },
        {
          concurrentUsers: 50,
          averageResponseTime: 100,
          maxResponseTime: 200,
          errorRate: 0.05,
          throughput: 300,
          memoryUsage: 80 * 1024 * 1024,
          connectionPoolSize: 20,
        },
      ];

      const config = ConnectionPoolOptimizer.getDefaultConfiguration().recommendedConfig;
      const rating = (ConnectionPoolOptimizer as any).calculateScalabilityRating(results, config);

      expect(rating).toBeLessThan(0.5);
    });
  });
});

describe('generateLoadTestConfig', () => {
  test('should generate valid Artillery configuration for light scenario', () => {
    const config = generateLoadTestConfig('light');

    expect(config).toContain('target: \'http://localhost:3000\'');
    expect(config).toContain('duration: 60'); // rampUpTime
    expect(config).toContain('duration: 300'); // test duration
    expect(config).toContain('rampTo: 50'); // max concurrent users
    expect(config).toContain('SharedStorage Performance Test');
  });

  test('should generate valid Artillery configuration for moderate scenario', () => {
    const config = generateLoadTestConfig('moderate');

    expect(config).toContain('duration: 120'); // rampUpTime
    expect(config).toContain('duration: 600'); // test duration
    expect(config).toContain('rampTo: 100'); // max concurrent users
  });

  test('should generate valid Artillery configuration for heavy scenario', () => {
    const config = generateLoadTestConfig('heavy');

    expect(config).toContain('duration: 180'); // rampUpTime
    expect(config).toContain('duration: 900'); // test duration
    expect(config).toContain('rampTo: 200'); // max concurrent users
  });

  test('should include proper test scenarios', () => {
    const config = generateLoadTestConfig('light');

    expect(config).toContain('scenarios:');
    expect(config).toContain('flow:');
    expect(config).toContain('get:');
    expect(config).toContain('post:');
    expect(config).toContain('expect:');
    expect(config).toContain('statusCode: 200');
  });
});

describe('LOAD_TEST_SCENARIOS', () => {
  test('should define light scenario correctly', () => {
    expect(LOAD_TEST_SCENARIOS.light.concurrentUsers).toEqual([10, 25, 50]);
    expect(LOAD_TEST_SCENARIOS.light.duration).toBe(300);
    expect(LOAD_TEST_SCENARIOS.light.rampUpTime).toBe(60);
  });

  test('should define moderate scenario correctly', () => {
    expect(LOAD_TEST_SCENARIOS.moderate.concurrentUsers).toEqual([25, 50, 100]);
    expect(LOAD_TEST_SCENARIOS.moderate.duration).toBe(600);
    expect(LOAD_TEST_SCENARIOS.moderate.rampUpTime).toBe(120);
  });

  test('should define heavy scenario correctly', () => {
    expect(LOAD_TEST_SCENARIOS.heavy.concurrentUsers).toEqual([50, 100, 200]);
    expect(LOAD_TEST_SCENARIOS.heavy.duration).toBe(900);
    expect(LOAD_TEST_SCENARIOS.heavy.rampUpTime).toBe(180);
  });
});
