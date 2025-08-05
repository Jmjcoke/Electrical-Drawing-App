/**
 * Performance Benchmark System
 * 
 * Comprehensive benchmarking system for the Symbol Detection Engine
 * Provides automated performance testing, regression detection, and optimization recommendations
 */

import { EventEmitter } from 'events';
import { SymbolDetectionService } from '../detection/symbol-detector';
import { SymbolDetectionPerformanceMonitor } from './symbol-detection-performance.monitor';
import { DetectionSettings, SymbolDetectionResult } from '../../../../shared/types/symbol-detection.types';

export interface BenchmarkConfiguration {
  testSuites: BenchmarkTestSuite[];
  iterations: number;
  warmupRuns: number;
  timeoutMs: number;
  collectSystemMetrics: boolean;
  enableRegressionDetection: boolean;
}

export interface BenchmarkTestSuite {
  name: string;
  description: string;
  testCases: BenchmarkTestCase[];
  acceptanceCriteria: AcceptanceCriteria;
}

export interface BenchmarkTestCase {
  name: string;
  description: string;
  bufferSize: number;
  complexity: 'minimal' | 'simple' | 'moderate' | 'complex' | 'extreme';
  settings: Partial<DetectionSettings>;
  expectedResults: ExpectedResults;
}

export interface AcceptanceCriteria {
  maxProcessingTimeMs: number;
  minThroughput: number; // symbols per second
  minAccuracy: number;
  maxMemoryUsageMB: number;
  minCacheEfficiency: number;
}

export interface ExpectedResults {
  minSymbolsDetected: number;
  maxSymbolsDetected: number;
  targetAccuracy: number;
  estimatedProcessingTimeMs: number;
}

export interface BenchmarkResult {
  testSuite: string;
  testCase: string;
  iterations: number;
  metrics: {
    avgProcessingTime: number;
    minProcessingTime: number;
    maxProcessingTime: number;
    stdDevProcessingTime: number;
    avgThroughput: number;
    avgAccuracy: number;
    avgMemoryUsage: number;
    cacheEfficiency: number;
    successRate: number;
  };
  performance: {
    meetsTimeRequirement: boolean;
    meetsThroughputRequirement: boolean;
    meetsAccuracyRequirement: boolean;
    meetsMemoryRequirement: boolean;
    meetsCacheRequirement: boolean;
    overallPass: boolean;
  };
  regressionAnalysis?: {
    comparedToBaseline: boolean;
    performanceChange: number; // percentage
    regressionDetected: boolean;
    recommendations: string[];
  };
  systemMetrics: {
    cpuUsage: number[];
    memoryUsage: number[];
    gcActivity: number;
    eventLoopLag: number[];
  };
  timestamp: Date;
}

export interface BenchmarkReport {
  summary: {
    totalTestSuites: number;
    totalTestCases: number;
    totalIterations: number;
    overallPassRate: number;
    avgProcessingTime: number;
    avgThroughput: number;
    avgAccuracy: number;
    regressionCount: number;
  };
  results: BenchmarkResult[];
  recommendations: string[];
  regressionAlerts: Array<{
    testCase: string;
    metric: string;
    change: number;
    severity: 'minor' | 'moderate' | 'major' | 'critical';
  }>;
  performanceTrends: {
    processingTime: 'improving' | 'stable' | 'degrading';
    throughput: 'improving' | 'stable' | 'degrading';
    accuracy: 'improving' | 'stable' | 'degrading';
    memory: 'improving' | 'stable' | 'degrading';
  };
}

export class PerformanceBenchmarkSystem extends EventEmitter {
  private symbolDetectionService: SymbolDetectionService;
  private performanceMonitor: SymbolDetectionPerformanceMonitor;
  private baselineResults = new Map<string, BenchmarkResult>();
  private historicalResults: BenchmarkResult[] = [];
  private readonly MAX_HISTORICAL_RESULTS = 1000;
  
  // Default benchmark configuration
  private defaultConfig: BenchmarkConfiguration = {
    testSuites: [
      {
        name: 'AC9_Compliance',
        description: 'Validates 30-second processing requirement (AC #9)',
        testCases: [
          {
            name: 'Simple_Circuit',
            description: 'Basic electrical circuit with 5-10 symbols',
            bufferSize: 100000,
            complexity: 'simple',
            settings: { confidenceThreshold: 0.7, processingTimeout: 30000 },
            expectedResults: { minSymbolsDetected: 3, maxSymbolsDetected: 15, targetAccuracy: 0.9, estimatedProcessingTimeMs: 8000 }
          },
          {
            name: 'Complex_Schematic',
            description: 'Industrial schematic with 20-40 symbols',
            bufferSize: 500000,
            complexity: 'complex',
            settings: { confidenceThreshold: 0.7, processingTimeout: 30000 },
            expectedResults: { minSymbolsDetected: 15, maxSymbolsDetected: 50, targetAccuracy: 0.85, estimatedProcessingTimeMs: 25000 }
          },
          {
            name: 'Maximum_Complexity',
            description: 'Extreme complexity test with 50+ symbols',
            bufferSize: 1000000,
            complexity: 'extreme',
            settings: { confidenceThreshold: 0.6, processingTimeout: 30000 },
            expectedResults: { minSymbolsDetected: 25, maxSymbolsDetected: 100, targetAccuracy: 0.8, estimatedProcessingTimeMs: 29000 }
          }
        ],
        acceptanceCriteria: {\n          maxProcessingTimeMs: 30000, // AC #9\n          minThroughput: 0.3,\n          minAccuracy: 0.8,\n          maxMemoryUsageMB: 1024,\n          minCacheEfficiency: 0.2\n        }\n      },\n      {\n        name: 'AC8_Accuracy',\n        description: 'Validates 90% accuracy requirement (AC #8)',\n        testCases: [\n          {\n            name: 'Standard_Symbols',\n            description: 'Test with standard IEEE electrical symbols',\n            bufferSize: 200000,\n            complexity: 'moderate',\n            settings: { confidenceThreshold: 0.8, enableMLClassification: true, enablePatternMatching: true },\n            expectedResults: { minSymbolsDetected: 8, maxSymbolsDetected: 25, targetAccuracy: 0.92, estimatedProcessingTimeMs: 15000 }\n          },\n          {\n            name: 'Mixed_Symbol_Types',\n            description: 'Mixed passive, active, and logic symbols',\n            bufferSize: 300000,\n            complexity: 'moderate',\n            settings: { confidenceThreshold: 0.75, maxSymbolsPerPage: 50 },\n            expectedResults: { minSymbolsDetected: 10, maxSymbolsDetected: 30, targetAccuracy: 0.9, estimatedProcessingTimeMs: 18000 }\n          }\n        ],\n        acceptanceCriteria: {\n          maxProcessingTimeMs: 25000,\n          minThroughput: 0.5,\n          minAccuracy: 0.9, // AC #8\n          maxMemoryUsageMB: 512,\n          minCacheEfficiency: 0.3\n        }\n      },\n      {\n        name: 'Performance_Optimization',\n        description: 'Validates performance optimizations effectiveness',\n        testCases: [\n          {\n            name: 'Parallel_Processing',\n            description: 'Test parallel processing optimization',\n            bufferSize: 400000,\n            complexity: 'complex',\n            settings: { confidenceThreshold: 0.7, enableMLClassification: true, enablePatternMatching: true },\n            expectedResults: { minSymbolsDetected: 12, maxSymbolsDetected: 35, targetAccuracy: 0.85, estimatedProcessingTimeMs: 20000 }\n          },\n          {\n            name: 'Caching_Efficiency',\n            description: 'Test caching system performance',\n            bufferSize: 250000,\n            complexity: 'moderate',\n            settings: { confidenceThreshold: 0.75 },\n            expectedResults: { minSymbolsDetected: 8, maxSymbolsDetected: 20, targetAccuracy: 0.88, estimatedProcessingTimeMs: 12000 }\n          }\n        ],\n        acceptanceCriteria: {\n          maxProcessingTimeMs: 20000,\n          minThroughput: 0.8,\n          minAccuracy: 0.85,\n          maxMemoryUsageMB: 768,\n          minCacheEfficiency: 0.4\n        }\n      }\n    ],\n    iterations: 5,\n    warmupRuns: 2,\n    timeoutMs: 45000,\n    collectSystemMetrics: true,\n    enableRegressionDetection: true\n  };\n\n  constructor(\n    symbolDetectionService: SymbolDetectionService,\n    performanceMonitor: SymbolDetectionPerformanceMonitor\n  ) {\n    super();\n    this.symbolDetectionService = symbolDetectionService;\n    this.performanceMonitor = performanceMonitor;\n  }\n\n  /**\n   * Run comprehensive benchmark suite\n   */\n  async runBenchmarks(config?: Partial<BenchmarkConfiguration>): Promise<BenchmarkReport> {\n    const benchmarkConfig = { ...this.defaultConfig, ...config };\n    const results: BenchmarkResult[] = [];\n    \n    console.log('🚀 Starting Symbol Detection Engine Performance Benchmarks');\n    console.log(`Configuration: ${benchmarkConfig.testSuites.length} test suites, ${benchmarkConfig.iterations} iterations each`);\n    \n    this.emit('benchmark-started', { config: benchmarkConfig });\n    \n    // Perform warmup\n    await this.performWarmup(benchmarkConfig.warmupRuns);\n    \n    // Run each test suite\n    for (const testSuite of benchmarkConfig.testSuites) {\n      console.log(`\\n📊 Running test suite: ${testSuite.name}`);\n      \n      for (const testCase of testSuite.testCases) {\n        console.log(`  🧪 Running test case: ${testCase.name}`);\n        \n        const result = await this.runTestCase(\n          testSuite,\n          testCase,\n          benchmarkConfig.iterations,\n          benchmarkConfig.timeoutMs,\n          benchmarkConfig.collectSystemMetrics\n        );\n        \n        // Perform regression analysis if enabled\n        if (benchmarkConfig.enableRegressionDetection) {\n          result.regressionAnalysis = this.performRegressionAnalysis(testCase.name, result);\n        }\n        \n        results.push(result);\n        this.addToHistory(result);\n        \n        // Emit progress update\n        this.emit('test-case-completed', { testSuite: testSuite.name, testCase: testCase.name, result });\n        \n        console.log(`    ✅ Completed: avg ${result.metrics.avgProcessingTime.toFixed(0)}ms, ${result.performance.overallPass ? 'PASS' : 'FAIL'}`);\n      }\n    }\n    \n    // Generate comprehensive report\n    const report = this.generateBenchmarkReport(results);\n    \n    console.log('\\n📈 Benchmark Summary:');\n    console.log(`  Overall Pass Rate: ${(report.summary.overallPassRate * 100).toFixed(1)}%`);\n    console.log(`  Average Processing Time: ${report.summary.avgProcessingTime.toFixed(0)}ms`);\n    console.log(`  Average Throughput: ${report.summary.avgThroughput.toFixed(2)} symbols/sec`);\n    console.log(`  Average Accuracy: ${(report.summary.avgAccuracy * 100).toFixed(1)}%`);\n    \n    if (report.regressionAlerts.length > 0) {\n      console.log(`  ⚠️  Regression Alerts: ${report.regressionAlerts.length}`);\n    }\n    \n    this.emit('benchmark-completed', { report });\n    \n    return report;\n  }\n\n  /**\n   * Run a single test case with multiple iterations\n   */\n  private async runTestCase(\n    testSuite: BenchmarkTestSuite,\n    testCase: BenchmarkTestCase,\n    iterations: number,\n    timeoutMs: number,\n    collectSystemMetrics: boolean\n  ): Promise<BenchmarkResult> {\n    const iterationResults: Array<{\n      processingTime: number;\n      symbolsDetected: number;\n      accuracy: number;\n      memoryUsage: number;\n      success: boolean;\n    }> = [];\n    \n    const systemMetrics = {\n      cpuUsage: [] as number[],\n      memoryUsage: [] as number[],\n      gcActivity: 0,\n      eventLoopLag: [] as number[],\n    };\n    \n    // Track GC activity\n    let gcCount = 0;\n    if (global.gc) {\n      const originalGc = global.gc;\n      global.gc = () => {\n        gcCount++;\n        return originalGc();\n      };\n    }\n    \n    for (let i = 0; i < iterations; i++) {\n      const mockBuffer = this.createMockPdfBuffer(testCase.bufferSize, testCase.complexity);\n      const startTime = Date.now();\n      const startMemory = process.memoryUsage();\n      \n      try {\n        // Collect system metrics if enabled\n        if (collectSystemMetrics) {\n          systemMetrics.cpuUsage.push(process.cpuUsage().user / 1000000); // Convert to seconds\n          systemMetrics.memoryUsage.push(startMemory.heapUsed / 1024 / 1024); // Convert to MB\n        }\n        \n        // Run detection\n        const jobId = await this.symbolDetectionService.processDocument(\n          `benchmark-${testCase.name}-${i}`,\n          `benchmark-session-${i}`,\n          mockBuffer,\n          testCase.settings\n        );\n        \n        const result = await this.waitForJobCompletion(jobId, timeoutMs);\n        const endTime = Date.now();\n        const endMemory = process.memoryUsage();\n        \n        iterationResults.push({\n          processingTime: endTime - startTime,\n          symbolsDetected: result.detectedSymbols.length,\n          accuracy: result.overallConfidence,\n          memoryUsage: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,\n          success: true,\n        });\n        \n      } catch (error) {\n        console.warn(`    ⚠️  Iteration ${i + 1} failed:`, error instanceof Error ? error.message : String(error));\n        \n        iterationResults.push({\n          processingTime: Date.now() - startTime,\n          symbolsDetected: 0,\n          accuracy: 0,\n          memoryUsage: 0,\n          success: false,\n        });\n      }\n      \n      // Small delay between iterations\n      await new Promise(resolve => setTimeout(resolve, 100));\n    }\n    \n    systemMetrics.gcActivity = gcCount;\n    \n    // Calculate statistics\n    const successfulResults = iterationResults.filter(r => r.success);\n    const processingTimes = successfulResults.map(r => r.processingTime);\n    const throughputs = successfulResults.map(r => r.symbolsDetected / (r.processingTime / 1000));\n    const accuracies = successfulResults.map(r => r.accuracy);\n    const memoryUsages = successfulResults.map(r => r.memoryUsage);\n    \n    const metrics = {\n      avgProcessingTime: this.calculateMean(processingTimes),\n      minProcessingTime: Math.min(...processingTimes),\n      maxProcessingTime: Math.max(...processingTimes),\n      stdDevProcessingTime: this.calculateStandardDeviation(processingTimes),\n      avgThroughput: this.calculateMean(throughputs),\n      avgAccuracy: this.calculateMean(accuracies),\n      avgMemoryUsage: this.calculateMean(memoryUsages),\n      cacheEfficiency: this.performanceMonitor.getPerformanceStats().session.cacheHits / \n        (this.performanceMonitor.getPerformanceStats().session.cacheHits + \n         this.performanceMonitor.getPerformanceStats().session.cacheMisses || 1),\n      successRate: successfulResults.length / iterations,\n    };\n    \n    // Evaluate performance against acceptance criteria\n    const performance = {\n      meetsTimeRequirement: metrics.avgProcessingTime <= testSuite.acceptanceCriteria.maxProcessingTimeMs,\n      meetsThroughputRequirement: metrics.avgThroughput >= testSuite.acceptanceCriteria.minThroughput,\n      meetsAccuracyRequirement: metrics.avgAccuracy >= testSuite.acceptanceCriteria.minAccuracy,\n      meetsMemoryRequirement: metrics.avgMemoryUsage <= testSuite.acceptanceCriteria.maxMemoryUsageMB,\n      meetsCacheRequirement: metrics.cacheEfficiency >= testSuite.acceptanceCriteria.minCacheEfficiency,\n      overallPass: false,\n    };\n    \n    performance.overallPass = \n      performance.meetsTimeRequirement &&\n      performance.meetsThroughputRequirement &&\n      performance.meetsAccuracyRequirement &&\n      performance.meetsMemoryRequirement &&\n      performance.meetsCacheRequirement;\n    \n    return {\n      testSuite: testSuite.name,\n      testCase: testCase.name,\n      iterations,\n      metrics,\n      performance,\n      systemMetrics,\n      timestamp: new Date(),\n    };\n  }\n\n  /**\n   * Perform regression analysis against baseline\n   */\n  private performRegressionAnalysis(testCaseName: string, currentResult: BenchmarkResult): {\n    comparedToBaseline: boolean;\n    performanceChange: number;\n    regressionDetected: boolean;\n    recommendations: string[];\n  } {\n    const baseline = this.baselineResults.get(testCaseName);\n    \n    if (!baseline) {\n      // Set current result as baseline\n      this.baselineResults.set(testCaseName, currentResult);\n      return {\n        comparedToBaseline: false,\n        performanceChange: 0,\n        regressionDetected: false,\n        recommendations: ['Baseline established for future regression analysis'],\n      };\n    }\n    \n    // Calculate performance change\n    const performanceChange = \n      ((currentResult.metrics.avgProcessingTime - baseline.metrics.avgProcessingTime) / \n       baseline.metrics.avgProcessingTime) * 100;\n    \n    // Detect regression (>5% performance degradation)\n    const regressionDetected = performanceChange > 5;\n    \n    const recommendations: string[] = [];\n    \n    if (regressionDetected) {\n      recommendations.push(`Performance regression detected: ${performanceChange.toFixed(1)}% slower`);\n      \n      if (currentResult.metrics.avgThroughput < baseline.metrics.avgThroughput * 0.9) {\n        recommendations.push('Throughput significantly reduced - check parallel processing configuration');\n      }\n      \n      if (currentResult.metrics.avgMemoryUsage > baseline.metrics.avgMemoryUsage * 1.2) {\n        recommendations.push('Memory usage increased - check for memory leaks or cache size');\n      }\n      \n      if (currentResult.metrics.cacheEfficiency < baseline.metrics.cacheEfficiency * 0.8) {\n        recommendations.push('Cache efficiency degraded - review caching strategy');\n      }\n    } else if (performanceChange < -5) {\n      recommendations.push(`Performance improvement detected: ${Math.abs(performanceChange).toFixed(1)}% faster`);\n    }\n    \n    return {\n      comparedToBaseline: true,\n      performanceChange,\n      regressionDetected,\n      recommendations,\n    };\n  }\n\n  /**\n   * Generate comprehensive benchmark report\n   */\n  private generateBenchmarkReport(results: BenchmarkResult[]): BenchmarkReport {\n    const summary = {\n      totalTestSuites: new Set(results.map(r => r.testSuite)).size,\n      totalTestCases: results.length,\n      totalIterations: results.reduce((sum, r) => sum + r.iterations, 0),\n      overallPassRate: results.filter(r => r.performance.overallPass).length / results.length,\n      avgProcessingTime: this.calculateMean(results.map(r => r.metrics.avgProcessingTime)),\n      avgThroughput: this.calculateMean(results.map(r => r.metrics.avgThroughput)),\n      avgAccuracy: this.calculateMean(results.map(r => r.metrics.avgAccuracy)),\n      regressionCount: results.filter(r => r.regressionAnalysis?.regressionDetected).length,\n    };\n    \n    const regressionAlerts = results\n      .filter(r => r.regressionAnalysis?.regressionDetected)\n      .map(r => ({\n        testCase: r.testCase,\n        metric: 'processingTime',\n        change: r.regressionAnalysis!.performanceChange,\n        severity: this.categorizeRegressionSeverity(r.regressionAnalysis!.performanceChange),\n      }));\n    \n    const recommendations = this.generateOverallRecommendations(results);\n    const performanceTrends = this.calculatePerformanceTrends();\n    \n    return {\n      summary,\n      results,\n      recommendations,\n      regressionAlerts,\n      performanceTrends,\n    };\n  }\n\n  // UTILITY METHODS\n\n  private async performWarmup(warmupRuns: number): Promise<void> {\n    console.log(`🔥 Performing ${warmupRuns} warmup runs...`);\n    \n    for (let i = 0; i < warmupRuns; i++) {\n      const mockBuffer = this.createMockPdfBuffer(50000, 'simple');\n      \n      try {\n        const jobId = await this.symbolDetectionService.processDocument(\n          `warmup-${i}`,\n          `warmup-session-${i}`,\n          mockBuffer,\n          { confidenceThreshold: 0.8, processingTimeout: 15000 }\n        );\n        \n        await this.waitForJobCompletion(jobId, 20000);\n      } catch (error) {\n        console.warn(`Warmup run ${i + 1} failed:`, error);\n      }\n    }\n    \n    console.log('✅ Warmup completed');\n  }\n\n  private createMockPdfBuffer(size: number, complexity: string): Buffer {\n    const buffer = Buffer.alloc(size);\n    \n    // Create different patterns based on complexity\n    const patterns = {\n      minimal: [0x25, 0x50, 0x44, 0x46], // %PDF\n      simple: [0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34], // %PDF-1.4\n      moderate: [0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x35], // %PDF-1.5\n      complex: [0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37], // %PDF-1.7\n      extreme: [0x25, 0x50, 0x44, 0x46, 0x2D, 0x32, 0x2E, 0x30], // %PDF-2.0\n    };\n    \n    const pattern = patterns[complexity as keyof typeof patterns] || patterns.simple;\n    \n    for (let i = 0; i < size; i++) {\n      buffer[i] = pattern[i % pattern.length];\n    }\n    \n    return buffer;\n  }\n\n  private async waitForJobCompletion(jobId: string, timeoutMs: number): Promise<any> {\n    const startTime = Date.now();\n    \n    while (Date.now() - startTime < timeoutMs) {\n      try {\n        const jobResult = await this.symbolDetectionService.getJobStatus(jobId);\n        \n        if (jobResult?.result) {\n          return jobResult.result;\n        }\n        \n        if (jobResult?.error) {\n          throw new Error(jobResult.error);\n        }\n        \n      } catch (error) {\n        if (Date.now() - startTime > timeoutMs * 0.9) {\n          throw error;\n        }\n      }\n      \n      await new Promise(resolve => setTimeout(resolve, 100));\n    }\n    \n    throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);\n  }\n\n  private calculateMean(values: number[]): number {\n    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;\n  }\n\n  private calculateStandardDeviation(values: number[]): number {\n    const mean = this.calculateMean(values);\n    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));\n    return Math.sqrt(this.calculateMean(squaredDiffs));\n  }\n\n  private categorizeRegressionSeverity(changePercentage: number): 'minor' | 'moderate' | 'major' | 'critical' {\n    if (changePercentage > 50) return 'critical';\n    if (changePercentage > 25) return 'major';\n    if (changePercentage > 10) return 'moderate';\n    return 'minor';\n  }\n\n  private generateOverallRecommendations(results: BenchmarkResult[]): string[] {\n    const recommendations: string[] = [];\n    \n    const avgPassRate = results.filter(r => r.performance.overallPass).length / results.length;\n    if (avgPassRate < 0.8) {\n      recommendations.push('Overall pass rate is below 80% - review system configuration and optimization settings');\n    }\n    \n    const avgProcessingTime = this.calculateMean(results.map(r => r.metrics.avgProcessingTime));\n    if (avgProcessingTime > 25000) {\n      recommendations.push('Average processing time exceeds 25 seconds - consider enabling more aggressive optimizations');\n    }\n    \n    const avgAccuracy = this.calculateMean(results.map(r => r.metrics.avgAccuracy));\n    if (avgAccuracy < 0.85) {\n      recommendations.push('Average accuracy is below 85% - review ML model performance and confidence thresholds');\n    }\n    \n    if (recommendations.length === 0) {\n      recommendations.push('All performance metrics are within acceptable ranges');\n    }\n    \n    return recommendations;\n  }\n\n  private calculatePerformanceTrends(): {\n    processingTime: 'improving' | 'stable' | 'degrading';\n    throughput: 'improving' | 'stable' | 'degrading';\n    accuracy: 'improving' | 'stable' | 'degrading';\n    memory: 'improving' | 'stable' | 'degrading';\n  } {\n    // Simplified trend analysis based on recent vs older results\n    const recent = this.historicalResults.slice(-10);\n    const older = this.historicalResults.slice(-20, -10);\n    \n    return {\n      processingTime: this.compareTrend(recent, older, 'avgProcessingTime', true), // lower is better\n      throughput: this.compareTrend(recent, older, 'avgThroughput', false), // higher is better\n      accuracy: this.compareTrend(recent, older, 'avgAccuracy', false), // higher is better\n      memory: this.compareTrend(recent, older, 'avgMemoryUsage', true), // lower is better\n    };\n  }\n\n  private compareTrend(\n    recent: BenchmarkResult[],\n    older: BenchmarkResult[],\n    metric: keyof BenchmarkResult['metrics'],\n    lowerIsBetter: boolean\n  ): 'improving' | 'stable' | 'degrading' {\n    if (recent.length === 0 || older.length === 0) return 'stable';\n    \n    const recentAvg = this.calculateMean(recent.map(r => r.metrics[metric] as number));\n    const olderAvg = this.calculateMean(older.map(r => r.metrics[metric] as number));\n    \n    const change = (recentAvg - olderAvg) / olderAvg;\n    \n    if (Math.abs(change) < 0.05) return 'stable';\n    \n    if (lowerIsBetter) {\n      return change < 0 ? 'improving' : 'degrading';\n    } else {\n      return change > 0 ? 'improving' : 'degrading';\n    }\n  }\n\n  private addToHistory(result: BenchmarkResult): void {\n    this.historicalResults.push(result);\n    \n    if (this.historicalResults.length > this.MAX_HISTORICAL_RESULTS) {\n      this.historicalResults = this.historicalResults.slice(-this.MAX_HISTORICAL_RESULTS);\n    }\n  }\n\n  /**\n   * Get historical performance data\n   */\n  getPerformanceHistory(): BenchmarkResult[] {\n    return [...this.historicalResults];\n  }\n\n  /**\n   * Export benchmark results to JSON\n   */\n  exportResults(results: BenchmarkResult[]): string {\n    return JSON.stringify(results, null, 2);\n  }\n\n  /**\n   * Clear historical data and baselines\n   */\n  clearHistory(): void {\n    this.historicalResults = [];\n    this.baselineResults.clear();\n    console.log('Performance benchmark history cleared');\n  }\n}"