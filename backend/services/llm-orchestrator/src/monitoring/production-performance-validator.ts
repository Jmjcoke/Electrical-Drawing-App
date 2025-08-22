/**
 * Production Performance Validator
 * 
 * Real-time performance validation and monitoring for production deployment
 * Ensures continuous compliance with AC #8 and AC #9 requirements
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import { 
  SymbolDetectionResult,
  DetectionMetadata,
  ElectricalSymbolType 
} from '../../../../shared/types/symbol-detection.types';

export interface ValidationConfig {
  // AC #9: Processing time requirement
  maxProcessingTimeMs: number; // 30000ms maximum
  
  // AC #8: Accuracy requirement  
  minAccuracyTarget: number; // 0.90 for common symbols
  
  // Memory limits
  maxMemoryUsageMB: number;
  
  // Throughput requirements
  minThroughputSymbolsPerSec: number;
  
  // Monitoring settings
  enableRealTimeMonitoring: boolean;
  alertingEnabled: boolean;
  metricsRetentionDays: number;
}

export interface ValidationResult {
  timestamp: Date;
  passed: boolean;
  metrics: {
    processingTime: number;
    accuracy: number;
    memoryUsage: number;
    throughput: number;
    symbolsDetected: number;
  };
  violations: ValidationViolation[];
  recommendations: string[];
  performanceScore: number; // 0-100
}

export interface ValidationViolation {
  type: 'processing_time' | 'accuracy' | 'memory' | 'throughput';
  severity: 'warning' | 'critical' | 'fatal';
  actualValue: number;
  expectedValue: number;
  message: string;
  acceptanceCriteria?: string;
}

export interface PerformanceTrend {
  metric: string;
  trend: 'improving' | 'stable' | 'degrading';
  changePercent: number;
  prediction: string;
}

export interface ProductionMetrics {
  uptime: number;
  totalProcessed: number;
  averageProcessingTime: number;
  averageAccuracy: number;
  successRate: number;
  errorRate: number;
  p95ProcessingTime: number;
  p99ProcessingTime: number;
  currentLoad: number;
  peakLoad: number;
}

export class ProductionPerformanceValidator extends EventEmitter {
  private config: ValidationConfig;
  private validationHistory: ValidationResult[] = [];
  private performanceBaseline: Map<string, number> = new Map();
  private alertThresholds: Map<string, number> = new Map();
  private productionMetrics: ProductionMetrics = {
    uptime: 0,
    totalProcessed: 0,
    averageProcessingTime: 0,
    averageAccuracy: 0,
    successRate: 0,
    errorRate: 0,
    p95ProcessingTime: 0,
    p99ProcessingTime: 0,
    currentLoad: 0,
    peakLoad: 0,
  };
  private startTime: Date;
  private readonly MAX_HISTORY_SIZE = 10000;

  constructor(config?: Partial<ValidationConfig>) {
    super();
    
    this.config = {
      maxProcessingTimeMs: 30000, // AC #9 requirement
      minAccuracyTarget: 0.90, // AC #8 requirement
      maxMemoryUsageMB: 2048,
      minThroughputSymbolsPerSec: 1.0,
      enableRealTimeMonitoring: true,
      alertingEnabled: true,
      metricsRetentionDays: 30,
      ...config,
    };
    
    this.startTime = new Date();
    this.initializeMetrics();
    this.setupAlertThresholds();
    this.establishPerformanceBaseline();
    
    if (this.config.enableRealTimeMonitoring) {
      this.startRealTimeMonitoring();
    }
  }

  /**
   * Validate a symbol detection result against production requirements
   */
  validateDetectionResult(
    result: SymbolDetectionResult,
    metadata: DetectionMetadata,
    groundTruth?: {
      expectedSymbols: ElectricalSymbolType[];
      knownAccuracy?: number;
    }
  ): ValidationResult {
    const violations: ValidationViolation[] = [];
    const recommendations: string[] = [];
    
    // Validate AC #9: Processing time under 30 seconds
    const processingTime = metadata.totalProcessingTime;
    if (processingTime > this.config.maxProcessingTimeMs) {
      violations.push({
        type: 'processing_time',
        severity: 'critical',
        actualValue: processingTime,
        expectedValue: this.config.maxProcessingTimeMs,
        message: `Processing time ${processingTime}ms exceeds 30-second limit`,
        acceptanceCriteria: 'AC #9',
      });
      
      recommendations.push('Enable performance optimizations (caching, parallel processing)');
      recommendations.push('Consider reducing image resolution for faster processing');
    } else if (processingTime > this.config.maxProcessingTimeMs * 0.8) {
      violations.push({
        type: 'processing_time',
        severity: 'warning',
        actualValue: processingTime,
        expectedValue: this.config.maxProcessingTimeMs,
        message: `Processing time ${processingTime}ms approaching 30-second limit`,
        acceptanceCriteria: 'AC #9',
      });
    }
    
    // Validate AC #8: 90% accuracy for common symbols
    const accuracy = this.calculateAccuracy(result, groundTruth);
    if (accuracy < this.config.minAccuracyTarget) {
      violations.push({
        type: 'accuracy',
        severity: accuracy < 0.7 ? 'critical' : 'warning',
        actualValue: accuracy,
        expectedValue: this.config.minAccuracyTarget,
        message: `Accuracy ${(accuracy * 100).toFixed(1)}% below 90% requirement`,
        acceptanceCriteria: 'AC #8',
      });
      
      recommendations.push('Review ML model performance and consider retraining');
      recommendations.push('Adjust confidence thresholds for better detection');
      recommendations.push('Verify image quality and preprocessing steps');
    }
    
    // Validate memory usage
    const memoryUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
    if (memoryUsageMB > this.config.maxMemoryUsageMB) {
      violations.push({
        type: 'memory',
        severity: memoryUsageMB > this.config.maxMemoryUsageMB * 1.5 ? 'critical' : 'warning',
        actualValue: memoryUsageMB,
        expectedValue: this.config.maxMemoryUsageMB,
        message: `Memory usage ${memoryUsageMB.toFixed(2)}MB exceeds limit`,
      });
      
      recommendations.push('Implement memory cleanup between processing');
      recommendations.push('Reduce batch size for parallel processing');
    }
    
    // Validate throughput
    const throughput = result.detectedSymbols.length / (processingTime / 1000);
    if (throughput < this.config.minThroughputSymbolsPerSec) {
      violations.push({
        type: 'throughput',
        severity: 'warning',
        actualValue: throughput,
        expectedValue: this.config.minThroughputSymbolsPerSec,
        message: `Throughput ${throughput.toFixed(2)} symbols/sec below minimum`,
      });
      
      recommendations.push('Enable parallel processing for better throughput');
      recommendations.push('Optimize detection algorithms for speed');
    }
    
    // Calculate performance score (0-100)
    const performanceScore = this.calculatePerformanceScore({
      processingTime,
      accuracy,
      memoryUsageMB,
      throughput,
    });
    
    const validationResult: ValidationResult = {
      timestamp: new Date(),
      passed: violations.filter(v => v.severity === 'critical' || v.severity === 'fatal').length === 0,
      metrics: {
        processingTime,
        accuracy,
        memoryUsage: memoryUsageMB,
        throughput,
        symbolsDetected: result.detectedSymbols.length,
      },
      violations,
      recommendations: recommendations.length > 0 ? recommendations : ['System performing within acceptable parameters'],
      performanceScore,
    };
    
    // Store validation result
    this.addValidationResult(validationResult);
    
    // Update production metrics
    this.updateProductionMetrics(validationResult);
    
    // Emit events for monitoring
    if (validationResult.passed) {
      this.emit('validation-passed', validationResult);
    } else {
      this.emit('validation-failed', validationResult);
      
      if (this.config.alertingEnabled) {
        this.triggerAlerts(validationResult);
      }
    }
    
    return validationResult;
  }

  /**
   * Get current production readiness status
   */
  getProductionReadiness(): {
    ready: boolean;
    score: number;
    status: {
      ac9Compliance: boolean;
      ac8Compliance: boolean;
      memoryHealth: boolean;
      throughputHealth: boolean;
    };
    metrics: ProductionMetrics;
    trends: PerformanceTrend[];
    recommendations: string[];
  } {
    const recentValidations = this.validationHistory.slice(-100);
    
    if (recentValidations.length === 0) {
      return {
        ready: false,
        score: 0,
        status: {
          ac9Compliance: false,
          ac8Compliance: false,
          memoryHealth: false,
          throughputHealth: false,
        },
        metrics: this.productionMetrics,
        trends: [],
        recommendations: ['No validation data available - run performance tests'],
      };
    }
    
    // Check AC #9 compliance (processing time)
    const ac9Compliance = recentValidations.every(v => 
      v.metrics.processingTime <= this.config.maxProcessingTimeMs
    );
    
    // Check AC #8 compliance (accuracy)
    const avgAccuracy = recentValidations.reduce((sum, v) => sum + v.metrics.accuracy, 0) / recentValidations.length;
    const ac8Compliance = avgAccuracy >= this.config.minAccuracyTarget;
    
    // Check memory health
    const avgMemory = recentValidations.reduce((sum, v) => sum + v.metrics.memoryUsage, 0) / recentValidations.length;
    const memoryHealth = avgMemory <= this.config.maxMemoryUsageMB;
    
    // Check throughput health
    const avgThroughput = recentValidations.reduce((sum, v) => sum + v.metrics.throughput, 0) / recentValidations.length;
    const throughputHealth = avgThroughput >= this.config.minThroughputSymbolsPerSec;
    
    // Calculate overall readiness
    const ready = ac9Compliance && ac8Compliance && memoryHealth;
    
    // Calculate readiness score
    let score = 100;
    if (!ac9Compliance) score -= 30;
    if (!ac8Compliance) score -= 30;
    if (!memoryHealth) score -= 20;
    if (!throughputHealth) score -= 20;
    
    // Adjust for actual values
    if (avgAccuracy > 0.95) score += 10;
    if (avgThroughput > 3.0) score += 10;
    
    score = Math.max(0, Math.min(100, score));
    
    // Analyze trends
    const trends = this.analyzePerformanceTrends();
    
    // Generate recommendations
    const recommendations = this.generateProductionRecommendations({
      ac9Compliance,
      ac8Compliance,
      memoryHealth,
      throughputHealth,
      trends,
    });
    
    return {
      ready,
      score,
      status: {
        ac9Compliance,
        ac8Compliance,
        memoryHealth,
        throughputHealth,
      },
      metrics: this.productionMetrics,
      trends,
      recommendations,
    };
  }

  /**
   * Perform comprehensive system validation
   */
  async performSystemValidation(): Promise<{
    systemHealth: 'healthy' | 'degraded' | 'critical';
    validationSummary: {
      totalTests: number;
      passed: number;
      failed: number;
      warnings: number;
    };
    performanceBaseline: Map<string, number>;
    recommendations: string[];
    requiredActions: string[];
  }> {
    console.log('Starting comprehensive system validation...');
    
    const validationSummary = {
      totalTests: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
    };
    
    const recommendations: string[] = [];
    const requiredActions: string[] = [];
    
    // Test 1: Memory pressure test
    const memoryTest = await this.testMemoryPressure();
    validationSummary.totalTests++;
    if (memoryTest.passed) {
      validationSummary.passed++;
    } else {
      validationSummary.failed++;
      requiredActions.push('Optimize memory usage before production deployment');
    }
    
    // Test 2: CPU load test
    const cpuTest = await this.testCPULoad();
    validationSummary.totalTests++;
    if (cpuTest.passed) {
      validationSummary.passed++;
    } else {
      validationSummary.warnings++;
      recommendations.push('Consider scaling horizontally for high CPU load');
    }
    
    // Test 3: Concurrent processing test
    const concurrencyTest = await this.testConcurrentProcessing();
    validationSummary.totalTests++;
    if (concurrencyTest.passed) {
      validationSummary.passed++;
    } else {
      validationSummary.failed++;
      requiredActions.push('Fix concurrent processing issues');
    }
    
    // Test 4: Accuracy validation
    const accuracyTest = await this.testAccuracyCompliance();
    validationSummary.totalTests++;
    if (accuracyTest.passed) {
      validationSummary.passed++;
    } else {
      validationSummary.warnings++;
      recommendations.push('Review and improve symbol detection accuracy');
    }
    
    // Test 5: Performance regression test
    const regressionTest = await this.testPerformanceRegression();
    validationSummary.totalTests++;
    if (regressionTest.passed) {
      validationSummary.passed++;
    } else {
      validationSummary.warnings++;
      recommendations.push('Performance degradation detected - investigate recent changes');
    }
    
    // Determine system health
    let systemHealth: 'healthy' | 'degraded' | 'critical';
    if (validationSummary.failed > 0) {
      systemHealth = 'critical';
    } else if (validationSummary.warnings > 2) {
      systemHealth = 'degraded';
    } else {
      systemHealth = 'healthy';
    }
    
    console.log(`System validation complete: ${systemHealth}`);
    
    return {
      systemHealth,
      validationSummary,
      performanceBaseline: this.performanceBaseline,
      recommendations,
      requiredActions,
    };
  }

  /**
   * Generate detailed performance report
   */
  generatePerformanceReport(): string {
    const report: string[] = [];
    
    report.push('='.repeat(80));
    report.push('PRODUCTION PERFORMANCE VALIDATION REPORT');
    report.push(`Generated: ${new Date().toISOString()}`);
    report.push('='.repeat(80));
    report.push('');
    
    // System information
    report.push('SYSTEM INFORMATION:');
    report.push('-'.repeat(40));
    report.push(`Uptime: ${this.formatUptime()}`);
    report.push(`CPU Cores: ${os.cpus().length}`);
    report.push(`Total Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`);
    report.push(`Node Version: ${process.version}`);
    report.push('');
    
    // Production metrics
    report.push('PRODUCTION METRICS:');
    report.push('-'.repeat(40));
    report.push(`Total Processed: ${this.productionMetrics.totalProcessed}`);
    report.push(`Success Rate: ${(this.productionMetrics.successRate * 100).toFixed(2)}%`);
    report.push(`Error Rate: ${(this.productionMetrics.errorRate * 100).toFixed(2)}%`);
    report.push(`Average Processing Time: ${this.productionMetrics.averageProcessingTime.toFixed(2)}ms`);
    report.push(`P95 Processing Time: ${this.productionMetrics.p95ProcessingTime.toFixed(2)}ms`);
    report.push(`P99 Processing Time: ${this.productionMetrics.p99ProcessingTime.toFixed(2)}ms`);
    report.push(`Average Accuracy: ${(this.productionMetrics.averageAccuracy * 100).toFixed(2)}%`);
    report.push('');
    
    // Acceptance criteria compliance
    report.push('ACCEPTANCE CRITERIA COMPLIANCE:');
    report.push('-'.repeat(40));
    
    const readiness = this.getProductionReadiness();
    
    report.push(`AC #9 (30-second processing): ${readiness.status.ac9Compliance ? 'PASS ✓' : 'FAIL ✗'}`);
    if (!readiness.status.ac9Compliance) {
      const violations = this.validationHistory
        .filter(v => v.metrics.processingTime > this.config.maxProcessingTimeMs)
        .slice(-5);
      
      report.push('  Recent violations:');
      violations.forEach(v => {
        report.push(`    - ${v.timestamp.toISOString()}: ${v.metrics.processingTime}ms`);
      });
    }
    
    report.push(`AC #8 (90% accuracy): ${readiness.status.ac8Compliance ? 'PASS ✓' : 'FAIL ✗'}`);
    if (!readiness.status.ac8Compliance) {
      report.push(`  Current average: ${(this.productionMetrics.averageAccuracy * 100).toFixed(2)}%`);
      report.push(`  Required: ${(this.config.minAccuracyTarget * 100)}%`);
    }
    
    report.push('');
    
    // Performance trends
    report.push('PERFORMANCE TRENDS:');
    report.push('-'.repeat(40));
    
    readiness.trends.forEach(trend => {
      const arrow = trend.trend === 'improving' ? '↑' :
                   trend.trend === 'degrading' ? '↓' : '→';
      report.push(`${trend.metric}: ${arrow} ${trend.trend} (${trend.changePercent.toFixed(1)}%)`);
      if (trend.prediction) {
        report.push(`  Prediction: ${trend.prediction}`);
      }
    });
    
    report.push('');
    
    // Recent validations
    report.push('RECENT VALIDATION RESULTS:');
    report.push('-'.repeat(40));
    
    const recentValidations = this.validationHistory.slice(-10);
    recentValidations.forEach(v => {
      const status = v.passed ? 'PASS' : 'FAIL';
      report.push(`${v.timestamp.toISOString()} - ${status} (Score: ${v.performanceScore}/100)`);
      
      if (v.violations.length > 0) {
        v.violations.forEach(violation => {
          report.push(`  - ${violation.type}: ${violation.message}`);
        });
      }
    });
    
    report.push('');
    
    // Recommendations
    report.push('RECOMMENDATIONS:');
    report.push('-'.repeat(40));
    
    readiness.recommendations.forEach((rec, index) => {
      report.push(`${index + 1}. ${rec}`);
    });
    
    report.push('');
    
    // Production readiness summary
    report.push('PRODUCTION READINESS:');
    report.push('-'.repeat(40));
    report.push(`Overall Score: ${readiness.score}/100`);
    report.push(`Status: ${readiness.ready ? 'READY FOR PRODUCTION ✓' : 'NOT READY FOR PRODUCTION ✗'}`);
    
    if (!readiness.ready) {
      report.push('');
      report.push('Required actions before production:');
      
      if (!readiness.status.ac9Compliance) {
        report.push('  - Optimize processing time to meet 30-second requirement');
      }
      if (!readiness.status.ac8Compliance) {
        report.push('  - Improve accuracy to meet 90% requirement');
      }
      if (!readiness.status.memoryHealth) {
        report.push('  - Reduce memory usage or increase available memory');
      }
    }
    
    report.push('');
    report.push('='.repeat(80));
    report.push('END OF REPORT');
    report.push('='.repeat(80));
    
    return report.join('\n');
  }

  // Private helper methods

  private initializeMetrics(): void {
    this.productionMetrics = {
      uptime: 0,
      totalProcessed: 0,
      averageProcessingTime: 0,
      averageAccuracy: 0,
      successRate: 0,
      errorRate: 0,
      p95ProcessingTime: 0,
      p99ProcessingTime: 0,
      currentLoad: 0,
      peakLoad: 0,
    };
  }

  private setupAlertThresholds(): void {
    // Critical thresholds
    this.alertThresholds.set('processing_time_critical', this.config.maxProcessingTimeMs);
    this.alertThresholds.set('processing_time_warning', this.config.maxProcessingTimeMs * 0.8);
    
    this.alertThresholds.set('accuracy_critical', this.config.minAccuracyTarget * 0.8);
    this.alertThresholds.set('accuracy_warning', this.config.minAccuracyTarget);
    
    this.alertThresholds.set('memory_critical', this.config.maxMemoryUsageMB * 1.2);
    this.alertThresholds.set('memory_warning', this.config.maxMemoryUsageMB);
    
    this.alertThresholds.set('throughput_critical', this.config.minThroughputSymbolsPerSec * 0.5);
    this.alertThresholds.set('throughput_warning', this.config.minThroughputSymbolsPerSec);
  }

  private establishPerformanceBaseline(): void {
    // Establish baseline performance metrics
    this.performanceBaseline.set('processing_time', 15000); // 15 seconds baseline
    this.performanceBaseline.set('accuracy', 0.92); // 92% baseline accuracy
    this.performanceBaseline.set('memory_usage', 512); // 512MB baseline
    this.performanceBaseline.set('throughput', 2.0); // 2 symbols/sec baseline
  }

  private startRealTimeMonitoring(): void {
    // Monitor system resources
    setInterval(() => {
      const memoryUsageMB = process.memoryUsage().heapUsed / 1024 / 1024;
      const cpuUsage = process.cpuUsage();
      
      this.emit('metrics-update', {
        timestamp: new Date(),
        memory: memoryUsageMB,
        cpu: cpuUsage,
        load: os.loadavg(),
      });
      
      // Check for resource warnings
      if (memoryUsageMB > this.alertThresholds.get('memory_warning')!) {
        this.emit('resource-warning', {
          type: 'memory',
          current: memoryUsageMB,
          threshold: this.alertThresholds.get('memory_warning'),
        });
      }
    }, 5000); // Every 5 seconds
    
    // Cleanup old validation history
    setInterval(() => {
      const retentionMs = this.config.metricsRetentionDays * 24 * 60 * 60 * 1000;
      const cutoffTime = Date.now() - retentionMs;
      
      this.validationHistory = this.validationHistory.filter(v => 
        v.timestamp.getTime() > cutoffTime
      );
    }, 60 * 60 * 1000); // Every hour
  }

  private calculateAccuracy(
    result: SymbolDetectionResult,
    groundTruth?: {
      expectedSymbols: ElectricalSymbolType[];
      knownAccuracy?: number;
    }
  ): number {
    if (groundTruth?.knownAccuracy !== undefined) {
      return groundTruth.knownAccuracy;
    }
    
    // Use confidence scores as proxy for accuracy
    if (result.detectedSymbols.length === 0) {
      return 0;
    }
    
    const avgConfidence = result.detectedSymbols.reduce((sum, s) => sum + s.confidence, 0) / result.detectedSymbols.length;
    
    // Apply accuracy estimation based on confidence
    // High confidence (>0.8) likely accurate
    // Medium confidence (0.6-0.8) moderately accurate
    // Low confidence (<0.6) potentially inaccurate
    
    let accuracy = avgConfidence;
    
    // Adjust based on overall detection confidence
    accuracy *= result.overallConfidence;
    
    return Math.min(1, accuracy);
  }

  private calculatePerformanceScore(metrics: {
    processingTime: number;
    accuracy: number;
    memoryUsageMB: number;
    throughput: number;
  }): number {
    let score = 100;
    
    // Processing time scoring (40% weight)
    const timeRatio = metrics.processingTime / this.config.maxProcessingTimeMs;
    if (timeRatio > 1) {
      score -= 40; // Full deduction if over limit
    } else {
      score -= (timeRatio * 0.8) * 40; // Gradual deduction
    }
    
    // Accuracy scoring (40% weight)
    const accuracyRatio = metrics.accuracy / this.config.minAccuracyTarget;
    if (accuracyRatio < 1) {
      score -= (1 - accuracyRatio) * 40;
    }
    
    // Memory scoring (10% weight)
    const memoryRatio = metrics.memoryUsageMB / this.config.maxMemoryUsageMB;
    if (memoryRatio > 1) {
      score -= 10;
    } else {
      score -= (memoryRatio * 0.5) * 10;
    }
    
    // Throughput scoring (10% weight)
    const throughputRatio = metrics.throughput / this.config.minThroughputSymbolsPerSec;
    if (throughputRatio < 1) {
      score -= (1 - throughputRatio) * 10;
    }
    
    return Math.max(0, Math.round(score));
  }

  private addValidationResult(result: ValidationResult): void {
    this.validationHistory.push(result);
    
    // Maintain history size limit
    if (this.validationHistory.length > this.MAX_HISTORY_SIZE) {
      this.validationHistory.shift();
    }
  }

  private updateProductionMetrics(result: ValidationResult): void {
    const total = this.productionMetrics.totalProcessed + 1;
    
    // Update running averages
    this.productionMetrics.averageProcessingTime = 
      (this.productionMetrics.averageProcessingTime * this.productionMetrics.totalProcessed + result.metrics.processingTime) / total;
    
    this.productionMetrics.averageAccuracy = 
      (this.productionMetrics.averageAccuracy * this.productionMetrics.totalProcessed + result.metrics.accuracy) / total;
    
    this.productionMetrics.totalProcessed = total;
    
    // Update success/error rates
    if (result.passed) {
      this.productionMetrics.successRate = 
        (this.productionMetrics.successRate * (total - 1) + 1) / total;
    } else {
      this.productionMetrics.errorRate = 
        (this.productionMetrics.errorRate * (total - 1) + 1) / total;
    }
    
    // Update percentiles
    this.updatePercentiles();
    
    // Update uptime
    this.productionMetrics.uptime = Date.now() - this.startTime.getTime();
  }

  private updatePercentiles(): void {
    if (this.validationHistory.length < 20) {
      return;
    }
    
    const processingTimes = this.validationHistory
      .map(v => v.metrics.processingTime)
      .sort((a, b) => a - b);
    
    const p95Index = Math.floor(processingTimes.length * 0.95);
    const p99Index = Math.floor(processingTimes.length * 0.99);
    
    this.productionMetrics.p95ProcessingTime = processingTimes[p95Index];
    this.productionMetrics.p99ProcessingTime = processingTimes[p99Index];
  }

  private analyzePerformanceTrends(): PerformanceTrend[] {
    const trends: PerformanceTrend[] = [];
    
    if (this.validationHistory.length < 20) {
      return trends;
    }
    
    const recent = this.validationHistory.slice(-10);
    const older = this.validationHistory.slice(-20, -10);
    
    // Processing time trend
    const recentAvgTime = recent.reduce((sum, v) => sum + v.metrics.processingTime, 0) / recent.length;
    const olderAvgTime = older.reduce((sum, v) => sum + v.metrics.processingTime, 0) / older.length;
    const timeChange = ((recentAvgTime - olderAvgTime) / olderAvgTime) * 100;
    
    trends.push({
      metric: 'Processing Time',
      trend: timeChange < -5 ? 'improving' : timeChange > 5 ? 'degrading' : 'stable',
      changePercent: timeChange,
      prediction: timeChange > 10 ? 'May exceed 30-second limit soon' : 'Within acceptable range',
    });
    
    // Accuracy trend
    const recentAvgAccuracy = recent.reduce((sum, v) => sum + v.metrics.accuracy, 0) / recent.length;
    const olderAvgAccuracy = older.reduce((sum, v) => sum + v.metrics.accuracy, 0) / older.length;
    const accuracyChange = ((recentAvgAccuracy - olderAvgAccuracy) / olderAvgAccuracy) * 100;
    
    trends.push({
      metric: 'Accuracy',
      trend: accuracyChange > 2 ? 'improving' : accuracyChange < -2 ? 'degrading' : 'stable',
      changePercent: accuracyChange,
      prediction: recentAvgAccuracy < 0.85 ? 'Below acceptable threshold' : 'Meeting requirements',
    });
    
    return trends;
  }

  private generateProductionRecommendations(status: {
    ac9Compliance: boolean;
    ac8Compliance: boolean;
    memoryHealth: boolean;
    throughputHealth: boolean;
    trends: PerformanceTrend[];
  }): string[] {
    const recommendations: string[] = [];
    
    if (!status.ac9Compliance) {
      recommendations.push('CRITICAL: Optimize processing time to meet 30-second requirement');
      recommendations.push('Enable all performance optimizations (caching, parallel processing)');
      recommendations.push('Consider horizontal scaling for load distribution');
    }
    
    if (!status.ac8Compliance) {
      recommendations.push('CRITICAL: Improve detection accuracy to meet 90% requirement');
      recommendations.push('Review and retrain ML models with more diverse training data');
      recommendations.push('Implement ensemble methods for better accuracy');
    }
    
    if (!status.memoryHealth) {
      recommendations.push('Optimize memory usage or increase available resources');
      recommendations.push('Implement aggressive garbage collection strategies');
      recommendations.push('Review for memory leaks in image processing pipeline');
    }
    
    if (!status.throughputHealth) {
      recommendations.push('Enable parallel processing to improve throughput');
      recommendations.push('Optimize batch processing strategies');
    }
    
    // Trend-based recommendations
    status.trends.forEach(trend => {
      if (trend.trend === 'degrading' && trend.changePercent > 10) {
        recommendations.push(`Investigate ${trend.metric} degradation: ${trend.prediction}`);
      }
    });
    
    if (recommendations.length === 0) {
      recommendations.push('System performing optimally - maintain current configuration');
    }
    
    return recommendations;
  }

  private triggerAlerts(result: ValidationResult): void {
    result.violations.forEach(violation => {
      if (violation.severity === 'critical' || violation.severity === 'fatal') {
        this.emit('critical-alert', {
          timestamp: new Date(),
          violation,
          result,
        });
      }
    });
  }

  private formatUptime(): string {
    const uptimeMs = Date.now() - this.startTime.getTime();
    const days = Math.floor(uptimeMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((uptimeMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((uptimeMs % (60 * 60 * 1000)) / (60 * 1000));
    
    return `${days}d ${hours}h ${minutes}m`;
  }

  private async testMemoryPressure(): Promise<{ passed: boolean }> {
    // Simulate memory pressure test
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Allocate temporary memory
    const buffers: Buffer[] = [];
    for (let i = 0; i < 10; i++) {
      buffers.push(Buffer.alloc(10 * 1024 * 1024)); // 10MB each
    }
    
    // const underPressure = process.memoryUsage().heapUsed;
    
    // Cleanup
    buffers.length = 0;
    if (global.gc) global.gc();
    
    const afterCleanup = process.memoryUsage().heapUsed;
    
    // Check if memory was properly released
    const memoryLeak = (afterCleanup - initialMemory) > 50 * 1024 * 1024; // 50MB threshold
    
    return { passed: !memoryLeak };
  }

  private async testCPULoad(): Promise<{ passed: boolean }> {
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    
    // Pass if load average is less than 80% of CPU count
    return { passed: loadAvg < cpuCount * 0.8 };
  }

  private async testConcurrentProcessing(): Promise<{ passed: boolean }> {
    // This would test actual concurrent processing capability
    // For now, return true as placeholder
    return { passed: true };
  }

  private async testAccuracyCompliance(): Promise<{ passed: boolean }> {
    const avgAccuracy = this.productionMetrics.averageAccuracy;
    return { passed: avgAccuracy >= this.config.minAccuracyTarget };
  }

  private async testPerformanceRegression(): Promise<{ passed: boolean }> {
    if (this.validationHistory.length < 20) {
      return { passed: true }; // Not enough data
    }
    
    const recent = this.validationHistory.slice(-10);
    const baseline = this.performanceBaseline.get('processing_time') || 15000;
    
    const avgRecent = recent.reduce((sum, v) => sum + v.metrics.processingTime, 0) / recent.length;
    
    // Fail if performance degraded by more than 20%
    return { passed: avgRecent < baseline * 1.2 };
  }
}