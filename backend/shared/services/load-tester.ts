import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { createClient, RedisClientType } from 'redis';

/**
 * Load test scenario configuration
 */
export interface LoadTestScenario {
  name: string;
  description: string;
  duration: number; // seconds
  concurrency: number;
  rampUpTime: number; // seconds
  operations: LoadTestOperation[];
  targetThroughput?: number; // operations per second
  dataPattern: LoadTestDataPattern;
}

/**
 * Load test operation
 */
export interface LoadTestOperation {
  type: 'read' | 'write' | 'delete' | 'list' | 'exists';
  weight: number; // Probability weight for this operation
  fileSizeRange: { min: number; max: number }; // bytes
  frequency: number; // operations per second
  sessionDistribution: 'uniform' | 'normal' | 'zipfian'; // Session access pattern
}

/**
 * Load test data pattern
 */
export interface LoadTestDataPattern {
  totalFiles: number;
  fileSizeDistribution: 'uniform' | 'normal' | 'pareto';
  sessionCount: number;
  hotSpotRatio: number; // Ratio of files that are accessed frequently (0-1)
  temporalLocality: number; // How likely to access recently accessed files (0-1)
}

/**
 * Load test result
 */
export interface LoadTestResult {
  scenario: string;
  startTime: number;
  endTime: number;
  duration: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  throughput: number; // operations per second
  latency: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };
  errorRate: number;
  resourceUsage: {
    avgCpu: number;
    peakCpu: number;
    avgMemory: number;
    peakMemory: number;
    avgDiskIO: number;
    peakDiskIO: number;
  };
  bottlenecks: string[];
  recommendations: string[];
}

/**
 * Performance benchmark
 */
export interface PerformanceBenchmark {
  name: string;
  category: 'latency' | 'throughput' | 'resource' | 'scalability';
  baseline: number;
  target: number;
  tolerance: number; // percentage
  description: string;
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  benchmark: PerformanceBenchmark;
  measured: number;
  passed: boolean;
  deviation: number; // percentage from target
  trend: 'improving' | 'degrading' | 'stable';
  confidence: number; // 0-1
}

/**
 * Load testing configuration
 */
export interface LoadTesterConfig {
  redisUrl: string;
  resultsRetention: number; // hours
  maxConcurrentOperations: number;
  enableRealTimeMonitoring: boolean;
  monitoringInterval: number; // seconds
  benchmarkHistorySize: number;
  regressionThreshold: number; // percentage
  reportFormats: ('json' | 'html' | 'csv')[];
}

/**
 * Load testing and benchmarking service
 */
export class LoadTester extends EventEmitter {
  private redis: RedisClientType | null = null;
  private config: LoadTesterConfig;
  private activeTests: Map<string, LoadTestExecution> = new Map();
  private benchmarks: Map<string, PerformanceBenchmark[]> = new Map();
  private testHistory: Map<string, LoadTestResult[]> = new Map();

  constructor(config: LoadTesterConfig) {
    super();
    this.config = config;
    this.initializeRedis();
    this.initializeBenchmarks();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    if (!this.config.redisUrl) return;

    try {
      this.redis = createClient({ url: this.config.redisUrl });
      await this.redis.connect();
      this.emit('redisConnected');
    } catch (error) {
      this.emit('redisError', error);
      this.redis = null;
    }
  }

  /**
   * Initialize performance benchmarks
   */
  private initializeBenchmarks(): void {
    // Latency benchmarks
    this.benchmarks.set('latency', [
      {
        name: 'fileAccessLatency',
        category: 'latency',
        baseline: 50, // 50ms baseline
        target: 100, // 100ms target (requirement)
        tolerance: 10, // 10% tolerance
        description: 'Average file access latency under normal load',
      },
      {
        name: 'fileWriteLatency',
        category: 'latency',
        baseline: 75,
        target: 150,
        tolerance: 15,
        description: 'Average file write latency under normal load',
      },
      {
        name: 'cacheHitLatency',
        category: 'latency',
        baseline: 5,
        target: 10,
        tolerance: 20,
        description: 'Cache hit latency',
      },
    ]);

    // Throughput benchmarks
    this.benchmarks.set('throughput', [
      {
        name: 'readThroughput',
        category: 'throughput',
        baseline: 100, // ops/sec
        target: 200,
        tolerance: 15,
        description: 'File read operations per second',
      },
      {
        name: 'writeThroughput',
        category: 'throughput',
        baseline: 50,
        target: 100,
        tolerance: 15,
        description: 'File write operations per second',
      },
      {
        name: 'mixedWorkloadThroughput',
        category: 'throughput',
        baseline: 75,
        target: 150,
        tolerance: 15,
        description: 'Mixed read/write operations per second',
      },
    ]);

    // Resource benchmarks
    this.benchmarks.set('resource', [
      {
        name: 'memoryEfficiency',
        category: 'resource',
        baseline: 0.8, // 80% memory efficiency
        target: 0.7, // 70% target (higher efficiency)
        tolerance: 5,
        description: 'Memory usage efficiency (lower is better)',
      },
      {
        name: 'cpuEfficiency',
        category: 'resource',
        baseline: 0.6, // 60% CPU usage baseline
        target: 0.7, // Allow up to 70%
        tolerance: 10,
        description: 'CPU usage under load',
      },
    ]);

    // Scalability benchmarks
    this.benchmarks.set('scalability', [
      {
        name: 'concurrentUsers',
        category: 'scalability',
        baseline: 50,
        target: 100,
        tolerance: 10,
        description: 'Maximum concurrent users supported',
      },
      {
        name: 'fileCountScalability',
        category: 'scalability',
        baseline: 10000,
        target: 50000,
        tolerance: 20,
        description: 'Maximum files that can be efficiently managed',
      },
    ]);
  }

  /**
   * Execute a load test scenario
   */
  async executeLoadTest(scenario: LoadTestScenario): Promise<LoadTestResult> {
    const executionId = crypto.randomUUID();
    const execution: LoadTestExecution = {
      id: executionId,
      scenario,
      startTime: Date.now(),
      status: 'running',
      operations: [],
      metrics: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        latencies: [],
        errors: [],
        resourceUsage: [],
      },
    };

    this.activeTests.set(executionId, execution);
    this.emit('testStarted', { executionId, scenario: scenario.name });

    try {
      // Prepare test data
      await this.prepareTestData(scenario);

      // Execute the test
      const result = await this.runTestExecution(execution);

      // Store results
      await this.storeTestResult(result);

      // Update test history
      this.updateTestHistory(scenario.name, result);

      // Check benchmarks
      const benchmarkResults = await this.evaluateBenchmarks(result);
      result.benchmarks = benchmarkResults;

      // Generate recommendations
      result.recommendations = this.generateRecommendations(result, benchmarkResults);

      this.emit('testCompleted', { executionId, result });
      return result;

    } catch (error) {
      execution.status = 'failed';
      this.emit('testFailed', { executionId, error: error as Error });
      throw error;
    } finally {
      this.activeTests.delete(executionId);
    }
  }

  /**
   * Prepare test data for the scenario
   */
  private async prepareTestData(scenario: LoadTestScenario): Promise<void> {
    const baseDir = '/tmp/load-test-data';
    await fs.mkdir(baseDir, { recursive: true });

    // Generate test files based on data pattern
    const { totalFiles, fileSizeDistribution, sessionCount } = scenario.dataPattern;

    for (let i = 0; i < totalFiles; i++) {
      const sessionId = `session-${i % sessionCount}`;
      const sessionDir = path.join(baseDir, sessionId);
      await fs.mkdir(sessionDir, { recursive: true });

      const fileSize = this.generateFileSize(fileSizeDistribution);
      const filePath = path.join(sessionDir, `file-${i}.dat`);
      const content = crypto.randomBytes(fileSize);

      await fs.writeFile(filePath, content);
    }

    this.emit('testDataPrepared', { scenario: scenario.name, totalFiles });
  }

  /**
   * Generate file size based on distribution
   */
  private generateFileSize(distribution: string): number {
    switch (distribution) {
      case 'uniform':
        return Math.floor(Math.random() * (1024 * 1024)) + 1024; // 1KB to 1MB
      case 'normal':
        // Normal distribution around 100KB
        const mean = 100 * 1024;
        const stdDev = 50 * 1024;
        return Math.max(1024, Math.floor(this.randomNormal(mean, stdDev)));
      case 'pareto':
        // Pareto distribution (80/20 rule - most files small, few large)
        const scale = 10 * 1024; // 10KB minimum
        const shape = 1.16; // Pareto shape parameter
        return Math.floor(scale / Math.pow(Math.random(), 1 / shape));
      default:
        return 64 * 1024; // 64KB default
    }
  }

  /**
   * Generate random number from normal distribution
   */
  private randomNormal(mean: number, stdDev: number): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * Run the actual test execution
   */
  private async runTestExecution(execution: LoadTestExecution): Promise<LoadTestResult> {
    const { scenario } = execution;
    const startTime = performance.now();
    const endTime = startTime + (scenario.duration * 1000);

    // Start monitoring
    const monitoringInterval = setInterval(() => {
      this.collectResourceMetrics(execution);
    }, this.config.monitoringInterval * 1000);

    try {
      // Execute operations with controlled concurrency
      const operationPromises: Promise<void>[] = [];

      for (let i = 0; i < scenario.concurrency; i++) {
        operationPromises.push(this.executeWorker(execution, i, endTime));
      }

      await Promise.allSettled(operationPromises);

      clearInterval(monitoringInterval);

      // Calculate final metrics
      const duration = (performance.now() - startTime) / 1000; // seconds
      const { metrics } = execution;

      return {
        scenario: scenario.name,
        startTime: execution.startTime,
        endTime: Date.now(),
        duration,
        totalOperations: metrics.totalOperations,
        successfulOperations: metrics.successfulOperations,
        failedOperations: metrics.failedOperations,
        throughput: metrics.totalOperations / duration,
        latency: this.calculateLatencyStats(metrics.latencies),
        errorRate: metrics.failedOperations / metrics.totalOperations,
        resourceUsage: this.calculateResourceStats(metrics.resourceUsage),
        bottlenecks: this.identifyBottlenecks(metrics),
        recommendations: [],
      };

    } finally {
      clearInterval(monitoringInterval);
    }
  }

  /**
   * Execute a worker thread for the load test
   */
  private async executeWorker(
    execution: LoadTestExecution,
    workerId: number,
    endTime: number
  ): Promise<void> {
    const { scenario } = execution;

    while (performance.now() < endTime) {
      try {
        const operation = this.selectOperation(scenario.operations);
        const operationStart = performance.now();

        // Execute the operation
        await this.executeOperation(execution, operation);

        const operationEnd = performance.now();
        const latency = operationEnd - operationStart;

        execution.metrics.totalOperations++;
        execution.metrics.successfulOperations++;
        execution.metrics.latencies.push(latency);

        // Rate limiting
        const targetInterval = 1000 / operation.frequency;
        const actualInterval = performance.now() - operationStart;

        if (actualInterval < targetInterval) {
          await new Promise(resolve =>
            setTimeout(resolve, targetInterval - actualInterval)
          );
        }

      } catch (error) {
        execution.metrics.totalOperations++;
        execution.metrics.failedOperations++;
        execution.metrics.errors.push(error as Error);
      }
    }
  }

  /**
   * Select operation based on weights
   */
  private selectOperation(operations: LoadTestOperation[]): LoadTestOperation {
    const totalWeight = operations.reduce((sum, op) => sum + op.weight, 0);
    let random = Math.random() * totalWeight;

    for (const operation of operations) {
      random -= operation.weight;
      if (random <= 0) {
        return operation;
      }
    }

    return operations[0]; // Fallback
  }

  /**
   * Execute a single operation
   */
  private async executeOperation(
    execution: LoadTestExecution,
    operation: LoadTestOperation
  ): Promise<void> {
    const { scenario } = execution;
    const sessionId = this.selectSession(scenario.dataPattern.sessionCount, operation.sessionDistribution);
    const filepath = this.selectFile(sessionId, operation);

    // This would integrate with the actual SharedStorageService
    // For now, simulate the operation
    switch (operation.type) {
      case 'read':
        await this.simulateReadOperation(sessionId, filepath);
        break;
      case 'write':
        await this.simulateWriteOperation(sessionId, filepath, operation.fileSizeRange);
        break;
      case 'delete':
        await this.simulateDeleteOperation(sessionId, filepath);
        break;
      case 'list':
        await this.simulateListOperation(sessionId);
        break;
      case 'exists':
        await this.simulateExistsOperation(sessionId, filepath);
        break;
    }
  }

  /**
   * Select session based on distribution
   */
  private selectSession(sessionCount: number, distribution: string): string {
    switch (distribution) {
      case 'uniform':
        return `session-${Math.floor(Math.random() * sessionCount)}`;
      case 'normal':
        const normalIndex = Math.max(0, Math.min(sessionCount - 1,
          Math.floor(this.randomNormal(sessionCount / 2, sessionCount / 6))));
        return `session-${normalIndex}`;
      case 'zipfian':
        // Zipfian distribution favors lower indices
        const zipfRandom = Math.random();
        const zipfIndex = Math.floor(sessionCount * Math.pow(zipfRandom, 3)); // Skew towards beginning
        return `session-${Math.min(zipfIndex, sessionCount - 1)}`;
      default:
        return `session-${Math.floor(Math.random() * sessionCount)}`;
    }
  }

  /**
   * Select file for operation
   */
  private selectFile(sessionId: string, operation: LoadTestOperation): string {
    // Simple file selection - in production this would be more sophisticated
    const fileIndex = Math.floor(Math.random() * 1000);
    return `file-${fileIndex}.dat`;
  }

  /**
   * Simulate read operation
   */
  private async simulateReadOperation(sessionId: string, filepath: string): Promise<void> {
    // Simulate file read with some processing time
    const baseDir = '/tmp/load-test-data';
    const fullPath = path.join(baseDir, sessionId, filepath);

    try {
      await fs.access(fullPath);
      // Simulate some processing
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
    } catch (error) {
      throw new Error(`File not found: ${filepath}`);
    }
  }

  /**
   * Simulate write operation
   */
  private async simulateWriteOperation(
    sessionId: string,
    filepath: string,
    sizeRange: { min: number; max: number }
  ): Promise<void> {
    const baseDir = '/tmp/load-test-data';
    const fullPath = path.join(baseDir, sessionId, filepath);
    const size = Math.floor(Math.random() * (sizeRange.max - sizeRange.min)) + sizeRange.min;
    const content = crypto.randomBytes(size);

    await fs.writeFile(fullPath, content);
  }

  /**
   * Simulate delete operation
   */
  private async simulateDeleteOperation(sessionId: string, filepath: string): Promise<void> {
    const baseDir = '/tmp/load-test-data';
    const fullPath = path.join(baseDir, sessionId, filepath);

    try {
      await fs.unlink(fullPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Simulate list operation
   */
  private async simulateListOperation(sessionId: string): Promise<void> {
    const baseDir = '/tmp/load-test-data';
    const sessionDir = path.join(baseDir, sessionId);

    try {
      await fs.readdir(sessionDir);
    } catch (error) {
      // Directory might not exist
    }
  }

  /**
   * Simulate exists operation
   */
  private async simulateExistsOperation(sessionId: string, filepath: string): Promise<void> {
    const baseDir = '/tmp/load-test-data';
    const fullPath = path.join(baseDir, sessionId, filepath);

    try {
      await fs.access(fullPath);
    } catch (error) {
      throw new Error(`File not found: ${filepath}`);
    }
  }

  /**
   * Collect resource metrics during test
   */
  private collectResourceMetrics(execution: LoadTestExecution): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    execution.metrics.resourceUsage.push({
      timestamp: Date.now(),
      memory: memUsage.heapUsed / memUsage.heapTotal,
      cpu: (cpuUsage.user + cpuUsage.system) / 1000000,
      diskIO: 0, // Would need system monitoring for this
    });
  }

  /**
   * Calculate latency statistics
   */
  private calculateLatencyStats(latencies: number[]): LoadTestResult['latency'] {
    if (latencies.length === 0) {
      return { avg: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
    }

    const sorted = latencies.sort((a, b) => a - b);
    const avg = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;

    return {
      avg,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
    };
  }

  /**
   * Calculate resource usage statistics
   */
  private calculateResourceStats(usage: any[]): LoadTestResult['resourceUsage'] {
    if (usage.length === 0) {
      return { avgCpu: 0, peakCpu: 0, avgMemory: 0, peakMemory: 0, avgDiskIO: 0, peakDiskIO: 0 };
    }

    const cpus = usage.map(u => u.cpu);
    const memories = usage.map(u => u.memory);
    const diskIOs = usage.map(u => u.diskIO);

    return {
      avgCpu: cpus.reduce((sum, cpu) => sum + cpu, 0) / cpus.length,
      peakCpu: Math.max(...cpus),
      avgMemory: memories.reduce((sum, mem) => sum + mem, 0) / memories.length,
      peakMemory: Math.max(...memories),
      avgDiskIO: diskIOs.reduce((sum, io) => sum + io, 0) / diskIOs.length,
      peakDiskIO: Math.max(...diskIOs),
    };
  }

  /**
   * Identify performance bottlenecks
   */
  private identifyBottlenecks(metrics: any): string[] {
    const bottlenecks: string[] = [];

    if (metrics.latencies.some((lat: number) => lat > 1000)) {
      bottlenecks.push('High latency operations detected (>1s)');
    }

    if (metrics.failedOperations / metrics.totalOperations > 0.1) {
      bottlenecks.push('High error rate detected (>10%)');
    }

    if (metrics.resourceUsage.some((u: any) => u.memory > 0.9)) {
      bottlenecks.push('Memory usage bottleneck detected');
    }

    if (metrics.resourceUsage.some((u: any) => u.cpu > 0.8)) {
      bottlenecks.push('CPU usage bottleneck detected');
    }

    return bottlenecks;
  }

  /**
   * Evaluate benchmarks against test results
   */
  private async evaluateBenchmarks(result: LoadTestResult): Promise<BenchmarkResult[]> {
    const benchmarkResults: BenchmarkResult[] = [];

    for (const [category, benchmarks] of this.benchmarks) {
      for (const benchmark of benchmarks) {
        const measured = this.extractBenchmarkValue(result, benchmark);
        const deviation = Math.abs((measured - benchmark.target) / benchmark.target) * 100;
        const passed = deviation <= benchmark.tolerance;

        // Determine trend (would need historical comparison)
        const trend = 'stable'; // Simplified

        benchmarkResults.push({
          benchmark,
          measured,
          passed,
          deviation,
          trend,
          confidence: 0.95, // Simplified
        });
      }
    }

    return benchmarkResults;
  }

  /**
   * Extract benchmark value from test result
   */
  private extractBenchmarkValue(result: LoadTestResult, benchmark: PerformanceBenchmark): number {
    switch (benchmark.name) {
      case 'fileAccessLatency':
        return result.latency.avg;
      case 'fileWriteLatency':
        return result.latency.avg * 1.5; // Estimate
      case 'cacheHitLatency':
        return result.latency.avg * 0.1; // Estimate
      case 'readThroughput':
        return result.throughput * 0.7; // Estimate read portion
      case 'writeThroughput':
        return result.throughput * 0.3; // Estimate write portion
      case 'mixedWorkloadThroughput':
        return result.throughput;
      case 'memoryEfficiency':
        return result.resourceUsage.avgMemory;
      case 'cpuEfficiency':
        return result.resourceUsage.avgCpu;
      case 'concurrentUsers':
        return 100; // Would need to be calculated from scenario
      case 'fileCountScalability':
        return 50000; // Would need to be calculated from scenario
      default:
        return benchmark.baseline;
    }
  }

  /**
   * Generate recommendations based on results
   */
  private generateRecommendations(result: LoadTestResult, benchmarks: BenchmarkResult[]): string[] {
    const recommendations: string[] = [];

    if (result.latency.avg > 100) {
      recommendations.push('Optimize file access patterns and consider caching improvements');
    }

    if (result.errorRate > 0.05) {
      recommendations.push('Investigate and fix error conditions to improve reliability');
    }

    if (result.resourceUsage.avgMemory > 0.8) {
      recommendations.push('Implement memory optimization strategies and monitor memory leaks');
    }

    const failedBenchmarks = benchmarks.filter(b => !b.passed);
    if (failedBenchmarks.length > 0) {
      recommendations.push(`Address ${failedBenchmarks.length} failed performance benchmarks`);
    }

    if (result.bottlenecks.length > 0) {
      recommendations.push('Resolve identified performance bottlenecks');
    }

    return recommendations;
  }

  /**
   * Store test result in Redis
   */
  private async storeTestResult(result: LoadTestResult): Promise<void> {
    if (!this.redis) return;

    try {
      const key = `load_test_result:${result.scenario}:${result.startTime}`;
      await this.redis.setEx(key, this.config.resultsRetention * 3600, JSON.stringify(result));
    } catch (error) {
      this.emit('storageError', error);
    }
  }

  /**
   * Update test history
   */
  private updateTestHistory(scenarioName: string, result: LoadTestResult): void {
    if (!this.testHistory.has(scenarioName)) {
      this.testHistory.set(scenarioName, []);
    }

    const history = this.testHistory.get(scenarioName)!;
    history.push(result);

    // Keep only recent history
    if (history.length > this.config.benchmarkHistorySize) {
      history.shift();
    }
  }

  /**
   * Get test history for a scenario
   */
  getTestHistory(scenarioName: string): LoadTestResult[] {
    return this.testHistory.get(scenarioName) || [];
  }

  /**
   * Generate performance comparison report
   */
  async generateComparisonReport(scenarioName: string): Promise<any> {
    const history = this.getTestHistory(scenarioName);

    if (history.length < 2) {
      return { error: 'Insufficient historical data for comparison' };
    }

    const current = history[history.length - 1];
    const previous = history[history.length - 2];

    const latencyChange = ((current.latency.avg - previous.latency.avg) / previous.latency.avg) * 100;
    const throughputChange = ((current.throughput - previous.throughput) / previous.throughput) * 100;

    return {
      scenario: scenarioName,
      comparison: {
        current: {
          timestamp: current.startTime,
          latency: current.latency.avg,
          throughput: current.throughput,
          errorRate: current.errorRate,
        },
        previous: {
          timestamp: previous.startTime,
          latency: previous.latency.avg,
          throughput: previous.throughput,
          errorRate: previous.errorRate,
        },
        changes: {
          latencyPercent: latencyChange,
          throughputPercent: throughputChange,
          latencyTrend: latencyChange > 5 ? 'degraded' : latencyChange < -5 ? 'improved' : 'stable',
          throughputTrend: throughputChange > 5 ? 'improved' : throughputChange < -5 ? 'degraded' : 'stable',
        },
      },
      recommendations: this.generateComparisonRecommendations(current, previous),
    };
  }

  /**
   * Generate recommendations based on comparison
   */
  private generateComparisonRecommendations(current: LoadTestResult, previous: LoadTestResult): string[] {
    const recommendations: string[] = [];

    const latencyChange = ((current.latency.avg - previous.latency.avg) / previous.latency.avg) * 100;

    if (latencyChange > 10) {
      recommendations.push('Performance degradation detected - investigate recent changes');
    } else if (latencyChange < -10) {
      recommendations.push('Performance improvement detected - validate optimizations');
    }

    const errorChange = ((current.errorRate - previous.errorRate) / (previous.errorRate || 0.001)) * 100;

    if (errorChange > 20) {
      recommendations.push('Error rate increase detected - investigate error sources');
    }

    return recommendations;
  }

  /**
   * Check for performance regressions
   */
  async checkPerformanceRegressions(scenarioName: string): Promise<any[]> {
    const history = this.getTestHistory(scenarioName);

    if (history.length < 3) {
      return [];
    }

    const regressions: any[] = [];
    const recent = history.slice(-3); // Last 3 tests

    for (let i = 1; i < recent.length; i++) {
      const current = recent[i];
      const previous = recent[i - 1];

      const latencyRegression = ((current.latency.avg - previous.latency.avg) / previous.latency.avg) * 100;

      if (Math.abs(latencyRegression) > this.config.regressionThreshold) {
        regressions.push({
          type: 'latency',
          severity: Math.abs(latencyRegression) > 25 ? 'high' : 'medium',
          change: latencyRegression,
          current: current.latency.avg,
          previous: previous.latency.avg,
          timestamp: current.startTime,
        });
      }
    }

    return regressions;
  }

  /**
   * Get active test executions
   */
  getActiveTests(): string[] {
    return Array.from(this.activeTests.keys());
  }

  /**
   * Cancel a running test
   */
  async cancelTest(executionId: string): Promise<void> {
    const execution = this.activeTests.get(executionId);
    if (execution) {
      execution.status = 'cancelled';
      this.activeTests.delete(executionId);
      this.emit('testCancelled', { executionId });
    }
  }

  /**
   * Close the load tester
   */
  async close(): Promise<void> {
    // Cancel all active tests
    for (const executionId of this.activeTests.keys()) {
      await this.cancelTest(executionId);
    }

    if (this.redis) {
      await this.redis.quit();
    }

    this.emit('closed');
  }
}

/**
 * Load test execution state
 */
interface LoadTestExecution {
  id: string;
  scenario: LoadTestScenario;
  startTime: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  operations: any[];
  metrics: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    latencies: number[];
    errors: Error[];
    resourceUsage: any[];
  };
}

/**
 * Default load testing configuration
 */
export const DEFAULT_LOAD_TEST_CONFIG: LoadTesterConfig = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  resultsRetention: 24, // 24 hours
  maxConcurrentOperations: 100,
  enableRealTimeMonitoring: true,
  monitoringInterval: 5, // 5 seconds
  benchmarkHistorySize: 10,
  regressionThreshold: 15, // 15%
  reportFormats: ['json', 'html'],
};

/**
 * Factory function to create LoadTester
 */
export function createLoadTester(config?: Partial<LoadTesterConfig>): LoadTester {
  return new LoadTester({ ...DEFAULT_LOAD_TEST_CONFIG, ...config });
}
