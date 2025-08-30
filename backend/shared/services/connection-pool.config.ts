import { ConnectionPoolConfig } from './connection-pool.manager';

/**
 * Load testing results for pool size optimization
 */
export interface LoadTestResult {
  concurrentUsers: number;
  averageResponseTime: number;
  maxResponseTime: number;
  errorRate: number;
  throughput: number;
  memoryUsage: number;
  connectionPoolSize: number;
}

/**
 * Optimal pool configuration recommendations
 */
export interface PoolOptimizationResult {
  recommendedConfig: ConnectionPoolConfig;
  performanceScore: number;
  costEfficiency: number;
  scalabilityRating: number;
  recommendations: string[];
}

/**
 * Connection pool configuration optimizer
 */
export class ConnectionPoolOptimizer {
  private static readonly PERFORMANCE_WEIGHT = 0.4;
  private static readonly EFFICIENCY_WEIGHT = 0.3;
  private static readonly SCALABILITY_WEIGHT = 0.3;

  /**
   * Analyze load test results and recommend optimal pool configuration
   */
  static analyzeLoadTestResults(results: LoadTestResult[]): PoolOptimizationResult {
    if (results.length === 0) {
      return this.getDefaultConfiguration();
    }

    // Analyze performance patterns
    const performanceAnalysis = this.analyzePerformance(results);
    const efficiencyAnalysis = this.analyzeEfficiency(results);
    const scalabilityAnalysis = this.analyzeScalability(results);

    // Calculate optimal configuration
    const optimalConfig = this.calculateOptimalConfig(
      performanceAnalysis,
      efficiencyAnalysis,
      scalabilityAnalysis
    );

    // Calculate scores
    const performanceScore = this.calculatePerformanceScore(results, optimalConfig);
    const costEfficiency = this.calculateCostEfficiency(results, optimalConfig);
    const scalabilityRating = this.calculateScalabilityRating(results, optimalConfig);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      results,
      performanceAnalysis,
      efficiencyAnalysis,
      scalabilityAnalysis
    );

    return {
      recommendedConfig: optimalConfig,
      performanceScore,
      costEfficiency,
      scalabilityRating,
      recommendations,
    };
  }

  /**
   * Get conservative default configuration for initial deployment
   */
  static getDefaultConfiguration(): PoolOptimizationResult {
    const config: ConnectionPoolConfig = {
      maxConnections: 20,
      minConnections: 5,
      maxIdleTime: 300000, // 5 minutes
      connectionTimeout: 30000, // 30 seconds
      retryAttempts: 3,
      healthCheckInterval: 60000, // 1 minute
      acquireTimeout: 10000, // 10 seconds
      validationInterval: 120000, // 2 minutes
    };

    return {
      recommendedConfig: config,
      performanceScore: 0.7,
      costEfficiency: 0.8,
      scalabilityRating: 0.75,
      recommendations: [
        'Default configuration suitable for moderate load (up to 50 concurrent users)',
        'Monitor performance metrics to adjust configuration based on actual usage',
        'Consider load testing to optimize for your specific use case',
      ],
    };
  }

  /**
   * Get high-performance configuration for demanding workloads
   */
  static getHighPerformanceConfiguration(): PoolOptimizationResult {
    const config: ConnectionPoolConfig = {
      maxConnections: 100,
      minConnections: 20,
      maxIdleTime: 60000, // 1 minute
      connectionTimeout: 15000, // 15 seconds
      retryAttempts: 5,
      healthCheckInterval: 30000, // 30 seconds
      acquireTimeout: 5000, // 5 seconds
      validationInterval: 60000, // 1 minute
    };

    return {
      recommendedConfig: config,
      performanceScore: 0.95,
      costEfficiency: 0.6,
      scalabilityRating: 0.9,
      recommendations: [
        'High-performance configuration for demanding workloads',
        'Higher resource usage - monitor memory and CPU consumption',
        'Suitable for 200+ concurrent users with low latency requirements',
        'Consider horizontal scaling for extreme loads',
      ],
    };
  }

  /**
   * Get cost-optimized configuration for resource-constrained environments
   */
  static getCostOptimizedConfiguration(): PoolOptimizationResult {
    const config: ConnectionPoolConfig = {
      maxConnections: 10,
      minConnections: 2,
      maxIdleTime: 600000, // 10 minutes
      connectionTimeout: 45000, // 45 seconds
      retryAttempts: 2,
      healthCheckInterval: 120000, // 2 minutes
      acquireTimeout: 15000, // 15 seconds
      validationInterval: 300000, // 5 minutes
    };

    return {
      recommendedConfig: config,
      performanceScore: 0.5,
      costEfficiency: 0.95,
      scalabilityRating: 0.4,
      recommendations: [
        'Cost-optimized configuration for resource-constrained environments',
        'Suitable for light to moderate loads (up to 20 concurrent users)',
        'May experience higher latency under load',
        'Monitor queue times and adjust if needed',
      ],
    };
  }

  /**
   * Analyze performance characteristics from load test results
   */
  private static analyzePerformance(results: LoadTestResult[]): any {
    const avgResponseTimes = results.map(r => r.averageResponseTime);
    const maxResponseTimes = results.map(r => r.maxResponseTime);
    const errorRates = results.map(r => r.errorRate);
    const throughputs = results.map(r => r.throughput);

    return {
      avgResponseTime: avgResponseTimes.reduce((a, b) => a + b, 0) / avgResponseTimes.length,
      maxResponseTime: Math.max(...maxResponseTimes),
      avgErrorRate: errorRates.reduce((a, b) => a + b, 0) / errorRates.length,
      maxThroughput: Math.max(...throughputs),
      performanceStability: this.calculateStability(avgResponseTimes),
    };
  }

  /**
   * Analyze efficiency characteristics from load test results
   */
  private static analyzeEfficiency(results: LoadTestResult[]): any {
    const memoryUsages = results.map(r => r.memoryUsage);
    const connectionPoolSizes = results.map(r => r.connectionPoolSize);

    return {
      avgMemoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
      maxMemoryUsage: Math.max(...memoryUsages),
      avgPoolSize: connectionPoolSizes.reduce((a, b) => a + b, 0) / connectionPoolSizes.length,
      resourceEfficiency: this.calculateResourceEfficiency(results),
    };
  }

  /**
   * Analyze scalability characteristics from load test results
   */
  private static analyzeScalability(results: LoadTestResult[]): any {
    const sortedResults = results.sort((a, b) => a.concurrentUsers - b.concurrentUsers);

    return {
      maxConcurrentUsers: Math.max(...results.map(r => r.concurrentUsers)),
      scalabilityFactor: this.calculateScalabilityFactor(sortedResults),
      bottleneckPoints: this.identifyBottlenecks(sortedResults),
    };
  }

  /**
   * Calculate optimal configuration based on analysis
   */
  private static calculateOptimalConfig(
    performance: any,
    efficiency: any,
    scalability: any
  ): ConnectionPoolConfig {
    // Base configuration
    const config: ConnectionPoolConfig = {
      maxConnections: 20,
      minConnections: 5,
      maxIdleTime: 300000,
      connectionTimeout: 30000,
      retryAttempts: 3,
      healthCheckInterval: 60000,
      acquireTimeout: 10000,
      validationInterval: 120000,
    };

    // Adjust based on performance requirements
    if (performance.avgResponseTime < 50) {
      // High performance requirements
      config.maxConnections = Math.max(50, Math.min(100, scalability.maxConcurrentUsers / 2));
      config.minConnections = Math.max(10, config.maxConnections / 4);
      config.connectionTimeout = 15000;
      config.acquireTimeout = 5000;
      config.healthCheckInterval = 30000;
    } else if (performance.avgResponseTime < 100) {
      // Moderate performance requirements
      config.maxConnections = Math.max(20, Math.min(50, scalability.maxConcurrentUsers / 3));
      config.minConnections = Math.max(5, config.maxConnections / 4);
    } else {
      // Lower performance requirements, focus on efficiency
      config.maxConnections = Math.max(10, Math.min(30, scalability.maxConcurrentUsers / 4));
      config.minConnections = Math.max(2, config.maxConnections / 5);
      config.maxIdleTime = 600000; // Longer idle time for efficiency
    }

    // Adjust retry attempts based on error rate
    if (performance.avgErrorRate > 0.05) {
      config.retryAttempts = 5;
    } else if (performance.avgErrorRate > 0.01) {
      config.retryAttempts = 4;
    }

    return config;
  }

  /**
   * Calculate performance score (0-1, higher is better)
   */
  private static calculatePerformanceScore(results: LoadTestResult[], config: ConnectionPoolConfig): number {
    const avgResponseTime = results.reduce((sum, r) => sum + r.averageResponseTime, 0) / results.length;
    const avgErrorRate = results.reduce((sum, r) => sum + r.errorRate, 0) / results.length;
    const maxThroughput = Math.max(...results.map(r => r.throughput));

    // Response time score (inverse relationship - lower time = higher score)
    const responseTimeScore = Math.max(0, Math.min(1, 1 - (avgResponseTime - 50) / 150));

    // Error rate score (inverse relationship - lower error = higher score)
    const errorRateScore = Math.max(0, 1 - avgErrorRate * 10);

    // Throughput score (higher throughput = higher score, normalized)
    const throughputScore = Math.min(1, maxThroughput / 1000);

    return (responseTimeScore * 0.5 + errorRateScore * 0.3 + throughputScore * 0.2);
  }

  /**
   * Calculate cost efficiency score (0-1, higher is better)
   */
  private static calculateCostEfficiency(results: LoadTestResult[], config: ConnectionPoolConfig): number {
    const avgMemoryUsage = results.reduce((sum, r) => sum + r.memoryUsage, 0) / results.length;
    const avgPoolSize = results.reduce((sum, r) => sum + r.connectionPoolSize, 0) / results.length;

    // Memory efficiency score (lower memory usage = higher score)
    const memoryScore = Math.max(0, Math.min(1, 1 - avgMemoryUsage / (100 * 1024 * 1024))); // 100MB baseline

    // Pool size efficiency score (smaller pool for same performance = higher score)
    const poolScore = Math.max(0, Math.min(1, 1 - avgPoolSize / 50)); // 50 connections baseline

    return (memoryScore * 0.6 + poolScore * 0.4);
  }

  /**
   * Calculate scalability rating (0-1, higher is better)
   */
  private static calculateScalabilityRating(results: LoadTestResult[], config: ConnectionPoolConfig): number {
    const sortedResults = results.sort((a, b) => a.concurrentUsers - b.concurrentUsers);
    const scalabilityFactor = this.calculateScalabilityFactor(sortedResults);

    // Scalability score based on how well performance scales with load
    const scalabilityScore = Math.max(0, Math.min(1, scalabilityFactor));

    // Concurrent user capacity score
    const maxUsers = Math.max(...results.map(r => r.concurrentUsers));
    const capacityScore = Math.min(1, maxUsers / 200); // 200 concurrent users as target

    return (scalabilityScore * 0.7 + capacityScore * 0.3);
  }

  /**
   * Calculate stability metric
   */
  private static calculateStability(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / mean;

    // Lower coefficient of variation = higher stability
    return Math.max(0, Math.min(1, 1 - coefficientOfVariation));
  }

  /**
   * Calculate resource efficiency
   */
  private static calculateResourceEfficiency(results: LoadTestResult[]): number {
    const avgMemoryUsage = results.reduce((sum, r) => sum + r.memoryUsage, 0) / results.length;
    const avgThroughput = results.reduce((sum, r) => sum + r.throughput, 0) / results.length;

    // Efficiency = throughput per unit of memory
    const efficiency = avgThroughput / avgMemoryUsage;

    // Normalize to 0-1 scale
    return Math.min(1, efficiency * 1000); // Adjust multiplier based on expected efficiency
  }

  /**
   * Calculate scalability factor
   */
  private static calculateScalabilityFactor(sortedResults: LoadTestResult[]): number {
    if (sortedResults.length < 2) return 0.5;

    // Calculate how response time scales with concurrent users
    const lowLoad = sortedResults[0];
    const highLoad = sortedResults[sortedResults.length - 1];

    const loadIncrease = highLoad.concurrentUsers / lowLoad.concurrentUsers;
    const responseTimeIncrease = highLoad.averageResponseTime / lowLoad.averageResponseTime;

    // Scalability factor = load increase / response time increase
    // Higher factor = better scalability
    const scalabilityFactor = loadIncrease / responseTimeIncrease;

    // Normalize to 0-1 scale
    return Math.max(0, Math.min(1, scalabilityFactor / 2));
  }

  /**
   * Identify performance bottlenecks
   */
  private static identifyBottlenecks(results: LoadTestResult[]): string[] {
    const bottlenecks: string[] = [];

    for (const result of results) {
      if (result.averageResponseTime > 100) {
        bottlenecks.push(`High response time (${result.averageResponseTime}ms) at ${result.concurrentUsers} users`);
      }
      if (result.errorRate > 0.05) {
        bottlenecks.push(`High error rate (${result.errorRate * 100}%) at ${result.concurrentUsers} users`);
      }
      if (result.memoryUsage > 200 * 1024 * 1024) { // 200MB
        bottlenecks.push(`High memory usage (${Math.round(result.memoryUsage / 1024 / 1024)}MB) at ${result.concurrentUsers} users`);
      }
    }

    return bottlenecks;
  }

  /**
   * Generate configuration recommendations
   */
  private static generateRecommendations(
    results: LoadTestResult[],
    performance: any,
    efficiency: any,
    scalability: any
  ): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (performance.avgResponseTime > 100) {
      recommendations.push('Consider increasing maxConnections for better performance under load');
      recommendations.push('Evaluate connectionTimeout settings - may need faster timeouts');
    }

    // Efficiency recommendations
    if (efficiency.avgMemoryUsage > 100 * 1024 * 1024) { // 100MB
      recommendations.push('High memory usage detected - consider reducing maxConnections or optimizing connection handling');
    }

    // Scalability recommendations
    if (scalability.maxConcurrentUsers > 100) {
      recommendations.push('High concurrent user load detected - consider high-performance configuration');
      recommendations.push('Monitor connection pool saturation and consider horizontal scaling');
    }

    // General recommendations
    if (performance.avgErrorRate > 0.01) {
      recommendations.push('Error rate above 1% - review retryAttempts and connection health checks');
    }

    if (recommendations.length === 0) {
      recommendations.push('Current configuration appears optimal based on test results');
      recommendations.push('Continue monitoring performance metrics in production');
    }

    return recommendations;
  }
}

/**
 * Load testing scenario configurations
 */
export const LOAD_TEST_SCENARIOS = {
  light: {
    concurrentUsers: [10, 25, 50],
    duration: 300, // 5 minutes
    rampUpTime: 60, // 1 minute
  },
  moderate: {
    concurrentUsers: [25, 50, 100],
    duration: 600, // 10 minutes
    rampUpTime: 120, // 2 minutes
  },
  heavy: {
    concurrentUsers: [50, 100, 200],
    duration: 900, // 15 minutes
    rampUpTime: 180, // 3 minutes
  },
};

/**
 * Generate load test configuration for Artillery
 */
export function generateLoadTestConfig(scenario: keyof typeof LOAD_TEST_SCENARIOS): string {
  const config = LOAD_TEST_SCENARIOS[scenario];

  return `
config:
  target: 'http://localhost:3000'
  phases:
    - duration: ${config.rampUpTime}
      arrivalRate: 1
      rampTo: ${Math.max(...config.concurrentUsers)}
    - duration: ${config.duration}
      arrivalRate: ${Math.max(...config.concurrentUsers)}

scenarios:
  - name: 'SharedStorage Performance Test'
    weight: 100
    flow:
      - get:
          url: '/api/shared-storage/session/test-session-id/files'
          expect:
            - statusCode: 200
      - get:
          url: '/api/shared-storage/session/test-session-id/file/test-file.txt'
          expect:
            - statusCode: 200
          capture:
            json: '$.data'
            as: 'fileData'
      - post:
          url: '/api/shared-storage/session/test-session-id/file/test-file.txt'
          json:
            data: 'test content'
          expect:
            - statusCode: 200
`;
}
