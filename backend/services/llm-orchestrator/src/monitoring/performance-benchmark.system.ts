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
        acceptanceCriteria: {
          maxProcessingTimeMs: 30000, // AC #9
          minThroughput: 0.3,
          minAccuracy: 0.8,
          maxMemoryUsageMB: 1024,
          minCacheEfficiency: 0.2
        }
      },
      {
        name: 'AC8_Accuracy',
        description: 'Validates 90% accuracy requirement (AC #8)',
        testCases: [
          {
            name: 'Standard_Symbols',
            description: 'Test with standard IEEE electrical symbols',
            bufferSize: 200000,
            complexity: 'moderate',
            settings: { confidenceThreshold: 0.8, enableMLClassification: true, enablePatternMatching: true },
            expectedResults: { minSymbolsDetected: 8, maxSymbolsDetected: 25, targetAccuracy: 0.92, estimatedProcessingTimeMs: 15000 }
          },
          {
            name: 'Mixed_Symbol_Types',
            description: 'Mixed passive, active, and logic symbols',
            bufferSize: 300000,
            complexity: 'moderate',
            settings: { confidenceThreshold: 0.75, maxSymbolsPerPage: 50 },
            expectedResults: { minSymbolsDetected: 10, maxSymbolsDetected: 30, targetAccuracy: 0.9, estimatedProcessingTimeMs: 18000 }
          }
        ],
        acceptanceCriteria: {
          maxProcessingTimeMs: 25000,
          minThroughput: 0.5,
          minAccuracy: 0.9, // AC #8
          maxMemoryUsageMB: 512,
          minCacheEfficiency: 0.3
        }
      },
      {
        name: 'Performance_Optimization',
        description: 'Validates performance optimizations effectiveness',
        testCases: [
          {
            name: 'Parallel_Processing',
            description: 'Test parallel processing optimization',
            bufferSize: 400000,
            complexity: 'complex',
            settings: { confidenceThreshold: 0.7, enableMLClassification: true, enablePatternMatching: true },
            expectedResults: { minSymbolsDetected: 12, maxSymbolsDetected: 35, targetAccuracy: 0.85, estimatedProcessingTimeMs: 20000 }
          },
          {
            name: 'Caching_Efficiency',
            description: 'Test caching system performance',
            bufferSize: 250000,
            complexity: 'moderate',
            settings: { confidenceThreshold: 0.75 },
            expectedResults: { minSymbolsDetected: 8, maxSymbolsDetected: 20, targetAccuracy: 0.88, estimatedProcessingTimeMs: 12000 }
          }
        ],
        acceptanceCriteria: {
          maxProcessingTimeMs: 20000,
          minThroughput: 0.8,
          minAccuracy: 0.85,
          maxMemoryUsageMB: 768,
          minCacheEfficiency: 0.4
        }
      }
    ],
    iterations: 5,
    warmupRuns: 2,
    timeoutMs: 45000,
    collectSystemMetrics: true,
    enableRegressionDetection: true
  };

  constructor(
    symbolDetectionService: SymbolDetectionService,
    performanceMonitor: SymbolDetectionPerformanceMonitor
  ) {
    super();
    this.symbolDetectionService = symbolDetectionService;
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * Run comprehensive benchmark suite
   */
  async runBenchmarks(config?: Partial<BenchmarkConfiguration>): Promise<BenchmarkReport> {
    const benchmarkConfig = { ...this.defaultConfig, ...config };
    const results: BenchmarkResult[] = [];
    
    console.log('🚀 Starting Symbol Detection Engine Performance Benchmarks');
    console.log(`Configuration: ${benchmarkConfig.testSuites.length} test suites, ${benchmarkConfig.iterations} iterations each`);
    
    this.emit('benchmark-started', { config: benchmarkConfig });
    
    // Perform warmup
    await this.performWarmup(benchmarkConfig.warmupRuns);
    
    // Run each test suite
    for (const testSuite of benchmarkConfig.testSuites) {
      console.log(`\n📊 Running test suite: ${testSuite.name}`);
      
      for (const testCase of testSuite.testCases) {
        console.log(`  🧪 Running test case: ${testCase.name}`);
        
        const result = await this.runTestCase(
          testSuite,
          testCase,
          benchmarkConfig.iterations,
          benchmarkConfig.timeoutMs,
          benchmarkConfig.collectSystemMetrics
        );
        
        // Perform regression analysis if enabled
        if (benchmarkConfig.enableRegressionDetection) {
          result.regressionAnalysis = this.performRegressionAnalysis(testCase.name, result);
        }
        
        results.push(result);
        this.addToHistory(result);
        
        // Emit progress update
        this.emit('test-case-completed', { testSuite: testSuite.name, testCase: testCase.name, result });
        
        console.log(`    ✅ Completed: avg ${result.metrics.avgProcessingTime.toFixed(0)}ms, ${result.performance.overallPass ? 'PASS' : 'FAIL'}`);
      }
    }
    
    // Generate comprehensive report
    const report = this.generateBenchmarkReport(results);
    
    console.log('\n📈 Benchmark Summary:');
    console.log(`  Overall Pass Rate: ${(report.summary.overallPassRate * 100).toFixed(1)}%`);
    console.log(`  Average Processing Time: ${report.summary.avgProcessingTime.toFixed(0)}ms`);
    console.log(`  Average Throughput: ${report.summary.avgThroughput.toFixed(2)} symbols/sec`);
    console.log(`  Average Accuracy: ${(report.summary.avgAccuracy * 100).toFixed(1)}%`);
    
    if (report.regressionAlerts.length > 0) {
      console.log(`  ⚠️  Regression Alerts: ${report.regressionAlerts.length}`);
    }
    
    this.emit('benchmark-completed', { report });
    
    return report;
  }

  /**
   * Run a single test case with multiple iterations
   */
  private async runTestCase(
    testSuite: BenchmarkTestSuite,
    testCase: BenchmarkTestCase,
    iterations: number,
    timeoutMs: number,
    collectSystemMetrics: boolean
  ): Promise<BenchmarkResult> {
    const iterationResults: Array<{
      processingTime: number;
      symbolsDetected: number;
      accuracy: number;
      memoryUsage: number;
      success: boolean;
    }> = [];
    
    const systemMetrics = {
      cpuUsage: [] as number[],
      memoryUsage: [] as number[],
      gcActivity: 0,
      eventLoopLag: [] as number[],
    };
    
    // Track GC activity
    let gcCount = 0;
    if (global.gc) {
      const originalGc = global.gc;
      global.gc = () => {
        gcCount++;
        return originalGc();
      };
    }
    
    for (let i = 0; i < iterations; i++) {
      const mockBuffer = this.createMockPdfBuffer(testCase.bufferSize, testCase.complexity);
      const startTime = Date.now();
      const startMemory = process.memoryUsage();
      
      try {
        // Collect system metrics if enabled
        if (collectSystemMetrics) {
          systemMetrics.cpuUsage.push(process.cpuUsage().user / 1000000); // Convert to seconds
          systemMetrics.memoryUsage.push(startMemory.heapUsed / 1024 / 1024); // Convert to MB
        }
        
        // Run detection
        const jobId = await this.symbolDetectionService.processDocument(
          `benchmark-${testCase.name}-${i}`,
          `benchmark-session-${i}`,
          mockBuffer,
          testCase.settings
        );
        
        const result = await this.waitForJobCompletion(jobId, timeoutMs);
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        
        iterationResults.push({
          processingTime: endTime - startTime,
          symbolsDetected: result.detectedSymbols.length,
          accuracy: result.overallConfidence,
          memoryUsage: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024,
          success: true,
        });
        
      } catch (error) {
        console.warn(`    ⚠️  Iteration ${i + 1} failed:`, error instanceof Error ? error.message : String(error));
        
        iterationResults.push({
          processingTime: Date.now() - startTime,
          symbolsDetected: 0,
          accuracy: 0,
          memoryUsage: 0,
          success: false,
        });
      }
      
      // Small delay between iterations
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    systemMetrics.gcActivity = gcCount;
    
    // Calculate statistics
    const successfulResults = iterationResults.filter(r => r.success);
    const processingTimes = successfulResults.map(r => r.processingTime);
    const throughputs = successfulResults.map(r => r.symbolsDetected / (r.processingTime / 1000));
    const accuracies = successfulResults.map(r => r.accuracy);
    const memoryUsages = successfulResults.map(r => r.memoryUsage);
    
    const metrics = {
      avgProcessingTime: this.calculateMean(processingTimes),
      minProcessingTime: Math.min(...processingTimes),
      maxProcessingTime: Math.max(...processingTimes),
      stdDevProcessingTime: this.calculateStandardDeviation(processingTimes),
      avgThroughput: this.calculateMean(throughputs),
      avgAccuracy: this.calculateMean(accuracies),
      avgMemoryUsage: this.calculateMean(memoryUsages),
      cacheEfficiency: this.performanceMonitor.getPerformanceStats().session.cacheHits / 
        (this.performanceMonitor.getPerformanceStats().session.cacheHits + 
         this.performanceMonitor.getPerformanceStats().session.cacheMisses || 1),
      successRate: successfulResults.length / iterations,
    };
    
    // Evaluate performance against acceptance criteria
    const performance = {
      meetsTimeRequirement: metrics.avgProcessingTime <= testSuite.acceptanceCriteria.maxProcessingTimeMs,
      meetsThroughputRequirement: metrics.avgThroughput >= testSuite.acceptanceCriteria.minThroughput,
      meetsAccuracyRequirement: metrics.avgAccuracy >= testSuite.acceptanceCriteria.minAccuracy,
      meetsMemoryRequirement: metrics.avgMemoryUsage <= testSuite.acceptanceCriteria.maxMemoryUsageMB,
      meetsCacheRequirement: metrics.cacheEfficiency >= testSuite.acceptanceCriteria.minCacheEfficiency,
      overallPass: false,
    };
    
    performance.overallPass = 
      performance.meetsTimeRequirement &&
      performance.meetsThroughputRequirement &&
      performance.meetsAccuracyRequirement &&
      performance.meetsMemoryRequirement &&
      performance.meetsCacheRequirement;
    
    return {
      testSuite: testSuite.name,
      testCase: testCase.name,
      iterations,
      metrics,
      performance,
      systemMetrics,
      timestamp: new Date(),
    };
  }

  /**
   * Perform regression analysis against baseline
   */
  private performRegressionAnalysis(testCaseName: string, currentResult: BenchmarkResult): {
    comparedToBaseline: boolean;
    performanceChange: number;
    regressionDetected: boolean;
    recommendations: string[];
  } {
    const baseline = this.baselineResults.get(testCaseName);
    
    if (!baseline) {
      // Set current result as baseline
      this.baselineResults.set(testCaseName, currentResult);
      return {
        comparedToBaseline: false,
        performanceChange: 0,
        regressionDetected: false,
        recommendations: ['Baseline established for future regression analysis'],
      };
    }
    
    // Calculate performance change
    const performanceChange = 
      ((currentResult.metrics.avgProcessingTime - baseline.metrics.avgProcessingTime) / 
       baseline.metrics.avgProcessingTime) * 100;
    
    // Detect regression (>5% performance degradation)
    const regressionDetected = performanceChange > 5;
    
    const recommendations: string[] = [];
    
    if (regressionDetected) {
      recommendations.push(`Performance regression detected: ${performanceChange.toFixed(1)}% slower`);
      
      if (currentResult.metrics.avgThroughput < baseline.metrics.avgThroughput * 0.9) {
        recommendations.push('Throughput significantly reduced - check parallel processing configuration');
      }
      
      if (currentResult.metrics.avgMemoryUsage > baseline.metrics.avgMemoryUsage * 1.2) {
        recommendations.push('Memory usage increased - check for memory leaks or cache size');
      }
      
      if (currentResult.metrics.cacheEfficiency < baseline.metrics.cacheEfficiency * 0.8) {
        recommendations.push('Cache efficiency degraded - review caching strategy');
      }
    } else if (performanceChange < -5) {
      recommendations.push(`Performance improvement detected: ${Math.abs(performanceChange).toFixed(1)}% faster`);
    }
    
    return {
      comparedToBaseline: true,
      performanceChange,
      regressionDetected,
      recommendations,
    };
  }

  /**
   * Generate comprehensive benchmark report
   */
  private generateBenchmarkReport(results: BenchmarkResult[]): BenchmarkReport {
    const summary = {
      totalTestSuites: new Set(results.map(r => r.testSuite)).size,
      totalTestCases: results.length,
      totalIterations: results.reduce((sum, r) => sum + r.iterations, 0),
      overallPassRate: results.filter(r => r.performance.overallPass).length / results.length,
      avgProcessingTime: this.calculateMean(results.map(r => r.metrics.avgProcessingTime)),
      avgThroughput: this.calculateMean(results.map(r => r.metrics.avgThroughput)),
      avgAccuracy: this.calculateMean(results.map(r => r.metrics.avgAccuracy)),
      regressionCount: results.filter(r => r.regressionAnalysis?.regressionDetected).length,
    };
    
    const regressionAlerts = results
      .filter(r => r.regressionAnalysis?.regressionDetected)
      .map(r => ({
        testCase: r.testCase,
        metric: 'processingTime',
        change: r.regressionAnalysis!.performanceChange,
        severity: this.categorizeRegressionSeverity(r.regressionAnalysis!.performanceChange),
      }));
    
    const recommendations = this.generateOverallRecommendations(results);
    const performanceTrends = this.calculatePerformanceTrends();
    
    return {
      summary,
      results,
      recommendations,
      regressionAlerts,
      performanceTrends,
    };
  }

  // UTILITY METHODS

  private async performWarmup(warmupRuns: number): Promise<void> {
    console.log(`🔥 Performing ${warmupRuns} warmup runs...`);
    
    for (let i = 0; i < warmupRuns; i++) {
      const mockBuffer = this.createMockPdfBuffer(50000, 'simple');
      
      try {
        const jobId = await this.symbolDetectionService.processDocument(
          `warmup-${i}`,
          `warmup-session-${i}`,
          mockBuffer,
          { confidenceThreshold: 0.8, processingTimeout: 15000 }
        );
        
        await this.waitForJobCompletion(jobId, 20000);
      } catch (error) {
        console.warn(`Warmup run ${i + 1} failed:`, error);
      }
    }
    
    console.log('✅ Warmup completed');
  }

  private createMockPdfBuffer(size: number, complexity: string): Buffer {
    const buffer = Buffer.alloc(size);
    
    // Create different patterns based on complexity
    const patterns = {
      minimal: [0x25, 0x50, 0x44, 0x46], // %PDF
      simple: [0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34], // %PDF-1.4
      moderate: [0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x35], // %PDF-1.5
      complex: [0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37], // %PDF-1.7
      extreme: [0x25, 0x50, 0x44, 0x46, 0x2D, 0x32, 0x2E, 0x30], // %PDF-2.0
    };
    
    const pattern = patterns[complexity as keyof typeof patterns] || patterns.simple;
    
    for (let i = 0; i < size; i++) {
      buffer[i] = pattern[i % pattern.length];
    }
    
    return buffer;
  }

  private async waitForJobCompletion(jobId: string, timeoutMs: number): Promise<any> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const jobResult = await this.symbolDetectionService.getJobStatus(jobId);
        
        if (jobResult?.result) {
          return jobResult.result;
        }
        
        if (jobResult?.error) {
          throw new Error(jobResult.error);
        }
        
      } catch (error) {
        if (Date.now() - startTime > timeoutMs * 0.9) {
          throw error;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
  }

  private calculateMean(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return Math.sqrt(this.calculateMean(squaredDiffs));
  }

  private categorizeRegressionSeverity(changePercentage: number): 'minor' | 'moderate' | 'major' | 'critical' {
    if (changePercentage > 50) return 'critical';
    if (changePercentage > 25) return 'major';
    if (changePercentage > 10) return 'moderate';
    return 'minor';
  }

  private generateOverallRecommendations(results: BenchmarkResult[]): string[] {
    const recommendations: string[] = [];
    
    const avgPassRate = results.filter(r => r.performance.overallPass).length / results.length;
    if (avgPassRate < 0.8) {
      recommendations.push('Overall pass rate is below 80% - review system configuration and optimization settings');
    }
    
    const avgProcessingTime = this.calculateMean(results.map(r => r.metrics.avgProcessingTime));
    if (avgProcessingTime > 25000) {
      recommendations.push('Average processing time exceeds 25 seconds - consider enabling more aggressive optimizations');
    }
    
    const avgAccuracy = this.calculateMean(results.map(r => r.metrics.avgAccuracy));
    if (avgAccuracy < 0.85) {
      recommendations.push('Average accuracy is below 85% - review ML model performance and confidence thresholds');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All performance metrics are within acceptable ranges');
    }
    
    return recommendations;
  }

  private calculatePerformanceTrends(): {
    processingTime: 'improving' | 'stable' | 'degrading';
    throughput: 'improving' | 'stable' | 'degrading';
    accuracy: 'improving' | 'stable' | 'degrading';
    memory: 'improving' | 'stable' | 'degrading';
  } {
    // Simplified trend analysis based on recent vs older results
    const recent = this.historicalResults.slice(-10);
    const older = this.historicalResults.slice(-20, -10);
    
    return {
      processingTime: this.compareTrend(recent, older, 'avgProcessingTime', true), // lower is better
      throughput: this.compareTrend(recent, older, 'avgThroughput', false), // higher is better
      accuracy: this.compareTrend(recent, older, 'avgAccuracy', false), // higher is better
      memory: this.compareTrend(recent, older, 'avgMemoryUsage', true), // lower is better
    };
  }

  private compareTrend(
    recent: BenchmarkResult[],
    older: BenchmarkResult[],
    metric: keyof BenchmarkResult['metrics'],
    lowerIsBetter: boolean
  ): 'improving' | 'stable' | 'degrading' {
    if (recent.length === 0 || older.length === 0) return 'stable';
    
    const recentAvg = this.calculateMean(recent.map(r => r.metrics[metric] as number));
    const olderAvg = this.calculateMean(older.map(r => r.metrics[metric] as number));
    
    const change = (recentAvg - olderAvg) / olderAvg;
    
    if (Math.abs(change) < 0.05) return 'stable';
    
    if (lowerIsBetter) {
      return change < 0 ? 'improving' : 'degrading';
    } else {
      return change > 0 ? 'improving' : 'degrading';
    }
  }

  private addToHistory(result: BenchmarkResult): void {
    this.historicalResults.push(result);
    
    if (this.historicalResults.length > this.MAX_HISTORICAL_RESULTS) {
      this.historicalResults = this.historicalResults.slice(-this.MAX_HISTORICAL_RESULTS);
    }
  }

  /**
   * Get historical performance data
   */
  getPerformanceHistory(): BenchmarkResult[] {
    return [...this.historicalResults];
  }

  /**
   * Export benchmark results to JSON
   */
  exportResults(results: BenchmarkResult[]): string {
    return JSON.stringify(results, null, 2);
  }

  /**
   * Clear historical data and baselines
   */
  clearHistory(): void {
    this.historicalResults = [];
    this.baselineResults.clear();
    console.log('Performance benchmark history cleared');
  }
}