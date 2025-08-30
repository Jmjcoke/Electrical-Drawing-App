import { performance } from 'perf_hooks';
import { sharedStorageLogger } from './shared-storage.logger';
import { sharedStorageMetrics } from './shared-storage.metrics';
import { SharedStorageAlerts } from './shared-storage.alerts';

/**
 * SharedStoragePerformance provides advanced performance monitoring and optimization
 * Implements automatic threshold monitoring, profiling, and performance regression detection
 */
export class SharedStoragePerformance {
  private readonly performanceThreshold: number = 100; // 100ms threshold
  private operationProfiles: Map<string, OperationProfile> = new Map();
  private performanceHistory: PerformanceHistory[] = [];
  private readonly historySize: number = 1000; // Keep last 1000 performance samples
  private regressionDetector: RegressionDetector;
  private connectionPool?: ConnectionPool;

  constructor(private alerts: SharedStorageAlerts) {
    this.regressionDetector = new RegressionDetector(this.alerts);
    this.initializePerformanceMonitoring();
  }

  /**
   * Initialize performance monitoring system
   */
  private initializePerformanceMonitoring(): void {
    // Set up periodic performance analysis
    setInterval(() => {
      this.analyzePerformanceTrends();
    }, 60000); // Analyze every minute

    // Set up connection pooling if enabled
    this.initializeConnectionPooling();

    sharedStorageLogger.logInfo('Performance monitoring initialized', {
      threshold: this.performanceThreshold,
      historySize: this.historySize
    });
  }

  /**
   * Start performance monitoring for an operation
   */
  startOperation(operation: string, service: string, metadata: Record<string, any> = {}): PerformanceTimer {
    const startTime = performance.now();
    const operationId = `${operation}_${service}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const timer: PerformanceTimer = {
      operationId,
      operation,
      service,
      startTime,
      metadata,
      end: (additionalMetadata: Record<string, any> = {}) => {
        const endTime = performance.now();
        const duration = endTime - startTime;

        this.recordOperationPerformance(operationId, operation, service, duration, {
          ...metadata,
          ...additionalMetadata
        });

        return duration;
      }
    };

    // Track active operation
    this.trackActiveOperation(operationId, operation, service, startTime);

    return timer;
  }

  /**
   * Record operation performance data
   */
  private recordOperationPerformance(
    operationId: string,
    operation: string,
    service: string,
    duration: number,
    metadata: Record<string, any>
  ): void {
    const performanceData: PerformanceHistory = {
      operationId,
      operation,
      service,
      duration,
      timestamp: new Date(),
      metadata
    };

    // Add to history
    this.performanceHistory.push(performanceData);

    // Maintain history size limit
    if (this.performanceHistory.length > this.historySize) {
      this.performanceHistory.shift();
    }

    // Update operation profile
    this.updateOperationProfile(operation, service, duration, metadata);

    // Check performance thresholds
    this.checkPerformanceThresholds(operation, service, duration, metadata);

    // Record in metrics
    sharedStorageMetrics.recordAccessMetrics(operation, service, duration, true);

    // Log detailed performance data if threshold exceeded
    if (duration > this.performanceThreshold) {
      this.logDetailedPerformance(operationId, operation, service, duration, metadata);
    }

    // Check for performance regressions
    this.regressionDetector.checkForRegression(operation, service, duration);
  }

  /**
   * Update operation performance profile
   */
  private updateOperationProfile(
    operation: string,
    service: string,
    duration: number,
    metadata: Record<string, any>
  ): void {
    const profileKey = `${operation}_${service}`;
    let profile = this.operationProfiles.get(profileKey);

    if (!profile) {
      profile = {
        operation,
        service,
        totalOperations: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        avgDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
        recentDurations: [],
        lastUpdated: new Date(),
        metadata: {}
      };
      this.operationProfiles.set(profileKey, profile);
    }

    // Update statistics
    profile.totalOperations++;
    profile.totalDuration += duration;
    profile.minDuration = Math.min(profile.minDuration, duration);
    profile.maxDuration = Math.max(profile.maxDuration, duration);
    profile.avgDuration = profile.totalDuration / profile.totalOperations;

    // Maintain recent durations for percentile calculations
    profile.recentDurations.push(duration);
    if (profile.recentDurations.length > 100) {
      profile.recentDurations.shift();
    }

    // Calculate percentiles
    profile.p95Duration = this.calculatePercentile(profile.recentDurations, 95);
    profile.p99Duration = this.calculatePercentile(profile.recentDurations, 99);

    profile.lastUpdated = new Date();
    profile.metadata = { ...profile.metadata, ...metadata };
  }

  /**
   * Check performance thresholds and trigger alerts if needed
   */
  private checkPerformanceThresholds(
    operation: string,
    service: string,
    duration: number,
    metadata: Record<string, any>
  ): void {
    const profile = this.operationProfiles.get(`${operation}_${service}`);
    if (!profile) return;

    // Check if this operation is consistently slow
    const recentOperations = profile.recentDurations.slice(-10); // Last 10 operations
    const slowOperations = recentOperations.filter(d => d > this.performanceThreshold);

    if (slowOperations.length >= 7) { // 70% of recent operations are slow
      this.alerts.alertPerformanceDegradation(
        operation,
        service,
        duration,
        this.performanceThreshold
      );
    }

    // Check for significant performance degradation
    if (profile.totalOperations > 10) {
      const recentAvg = recentOperations.reduce((a, b) => a + b, 0) / recentOperations.length;
      const overallAvg = profile.avgDuration;

      if (recentAvg > overallAvg * 1.5) { // 50% degradation
        sharedStorageLogger.logPerformanceMetric(
          operation,
          recentAvg,
          'performance_regression',
          service,
          undefined
        );
      }
    }
  }

  /**
   * Log detailed performance information for slow operations
   */
  private logDetailedPerformance(
    operationId: string,
    operation: string,
    service: string,
    duration: number,
    metadata: Record<string, any>
  ): void {
    const profile = this.operationProfiles.get(`${operation}_${service}`);

    sharedStorageLogger.logPerformanceMetric(
      operation,
      duration,
      operationId,
      service,
      operationId
    );

    // Log additional context for debugging
    sharedStorageLogger.logInfo(`Performance threshold exceeded: ${operation}`, {
      operationId,
      operation,
      service,
      duration,
      threshold: this.performanceThreshold,
      degradationPercent: ((duration - this.performanceThreshold) / this.performanceThreshold * 100).toFixed(1) + '%',
      operationProfile: profile ? {
        totalOperations: profile.totalOperations,
        avgDuration: profile.avgDuration.toFixed(2),
        p95Duration: profile.p95Duration.toFixed(2),
        p99Duration: profile.p99Duration.toFixed(2)
      } : null,
      metadata
    });
  }

  /**
   * Track active operation for connection pooling
   */
  private trackActiveOperation(
    operationId: string,
    operation: string,
    service: string,
    startTime: number
  ): void {
    if (this.connectionPool) {
      this.connectionPool.trackOperation(operationId, operation, service, startTime);
    }
  }

  /**
   * Initialize connection pooling for performance optimization
   */
  private initializeConnectionPooling(): void {
    // Initialize connection pool if Docker volume access is detected
    if (process.env.DOCKER_VOLUME_PATH) {
      this.connectionPool = new ConnectionPool({
        maxConnections: parseInt(process.env.MAX_CONNECTIONS || '10'),
        idleTimeout: parseInt(process.env.CONNECTION_IDLE_TIMEOUT || '30000'),
        volumePath: process.env.DOCKER_VOLUME_PATH
      });

      sharedStorageLogger.logInfo('Connection pooling initialized', {
        maxConnections: this.connectionPool.maxConnections,
        volumePath: process.env.DOCKER_VOLUME_PATH
      });
    }
  }

  /**
   * Analyze performance trends and generate insights
   */
  private analyzePerformanceTrends(): void {
    const analysis = this.generatePerformanceAnalysis();

    // Log significant findings
    if (analysis.slowestOperations.length > 0) {
      sharedStorageLogger.logInfo('Performance analysis completed', {
        analysisTimestamp: new Date().toISOString(),
        totalOperations: analysis.totalOperations,
        avgResponseTime: analysis.avgResponseTime.toFixed(2),
        slowestOperations: analysis.slowestOperations.slice(0, 5),
        performanceInsights: analysis.performanceInsights
      });
    }

    // Check for optimization opportunities
    this.identifyOptimizationOpportunities(analysis);
  }

  /**
   * Generate comprehensive performance analysis
   */
  generatePerformanceAnalysis(): PerformanceAnalysis {
    const totalOperations = this.performanceHistory.length;
    const totalDuration = this.performanceHistory.reduce((sum, record) => sum + record.duration, 0);
    const avgResponseTime = totalOperations > 0 ? totalDuration / totalOperations : 0;

    // Find slowest operations
    const slowestOperations = [...this.performanceHistory]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)
      .map(record => ({
        operation: record.operation,
        service: record.service,
        duration: record.duration,
        timestamp: record.timestamp
      }));

    // Generate performance insights
    const performanceInsights = this.generatePerformanceInsights();

    return {
      totalOperations,
      avgResponseTime,
      slowestOperations,
      performanceInsights,
      analysisTimestamp: new Date()
    };
  }

  /**
   * Generate performance insights and recommendations
   */
  private generatePerformanceInsights(): PerformanceInsight[] {
    const insights: PerformanceInsight[] = [];

    // Analyze operation profiles for optimization opportunities
    for (const [profileKey, profile] of this.operationProfiles.entries()) {
      // Check for consistently slow operations
      if (profile.avgDuration > this.performanceThreshold * 1.2) {
        insights.push({
          type: 'optimization_opportunity',
          severity: 'medium',
          title: `Slow operation detected: ${profile.operation}`,
          description: `${profile.operation} in ${profile.service} averages ${profile.avgDuration.toFixed(2)}ms`,
          recommendation: 'Consider implementing caching or optimizing the operation',
          affectedOperation: profile.operation,
          affectedService: profile.service,
          currentAvgDuration: profile.avgDuration,
          improvementPotential: profile.avgDuration - this.performanceThreshold
        });
      }

      // Check for high variance in performance
      if (profile.recentDurations.length > 10) {
        const variance = this.calculateVariance(profile.recentDurations);
        const coefficientOfVariation = Math.sqrt(variance) / profile.avgDuration;

        if (coefficientOfVariation > 0.5) { // High variance
          insights.push({
            type: 'consistency_issue',
            severity: 'low',
            title: `Performance inconsistency: ${profile.operation}`,
            description: `High variance in ${profile.operation} response times`,
            recommendation: 'Investigate sources of performance variability',
            affectedOperation: profile.operation,
            affectedService: profile.service,
            variance: coefficientOfVariation
          });
        }
      }
    }

    return insights;
  }

  /**
   * Identify specific optimization opportunities
   */
  private identifyOptimizationOpportunities(analysis: PerformanceAnalysis): void {
    // Check for file access patterns that could benefit from caching
    const fileAccessPatterns = this.analyzeFileAccessPatterns();

    if (fileAccessPatterns.frequentAccessFiles.length > 0) {
      sharedStorageLogger.logInfo('Caching optimization opportunity identified', {
        frequentAccessFiles: fileAccessPatterns.frequentAccessFiles.slice(0, 5),
        recommendation: 'Consider implementing file access caching for frequently accessed files'
      });
    }

    // Check for sequential access patterns
    if (fileAccessPatterns.sequentialAccessDetected) {
      sharedStorageLogger.logInfo('Sequential access pattern detected', {
        recommendation: 'Consider implementing read-ahead caching for sequential file access'
      });
    }
  }

  /**
   * Analyze file access patterns for optimization opportunities
   */
  private analyzeFileAccessPatterns(): FileAccessAnalysis {
    const fileAccessCount = new Map<string, number>();
    const accessSequence: string[] = [];

    // Analyze recent file access patterns
    for (const record of this.performanceHistory.slice(-100)) { // Last 100 operations
      if (record.metadata.filepath) {
        const filepath = record.metadata.filepath;
        fileAccessCount.set(filepath, (fileAccessCount.get(filepath) || 0) + 1);
        accessSequence.push(filepath);
      }
    }

    // Find frequently accessed files
    const frequentAccessFiles = Array.from(fileAccessCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([filepath, count]) => ({ filepath, accessCount: count }));

    // Detect sequential access patterns
    let sequentialAccessCount = 0;
    for (let i = 1; i < accessSequence.length; i++) {
      if (accessSequence[i] === accessSequence[i - 1]) {
        sequentialAccessCount++;
      }
    }

    const sequentialAccessDetected = sequentialAccessCount > accessSequence.length * 0.3; // 30% sequential

    return {
      frequentAccessFiles,
      sequentialAccessDetected,
      totalAnalyzedOperations: Math.min(100, this.performanceHistory.length)
    };
  }

  /**
   * Get performance statistics for a specific operation
   */
  getOperationStats(operation: string, service?: string): OperationStats | null {
    const profileKey = service ? `${operation}_${service}` : Object.keys(this.operationProfiles).find(key => key.startsWith(`${operation}_`));

    if (!profileKey) return null;

    const profile = this.operationProfiles.get(profileKey);
    if (!profile) return null;

    return {
      operation: profile.operation,
      service: profile.service,
      totalOperations: profile.totalOperations,
      avgDuration: profile.avgDuration,
      minDuration: profile.minDuration,
      maxDuration: profile.maxDuration,
      p95Duration: profile.p95Duration,
      p99Duration: profile.p99Duration,
      lastUpdated: profile.lastUpdated
    };
  }

  /**
   * Get overall performance statistics
   */
  getOverallStats(): OverallPerformanceStats {
    const totalOperations = this.performanceHistory.length;
    const totalDuration = this.performanceHistory.reduce((sum, record) => sum + record.duration, 0);
    const avgResponseTime = totalOperations > 0 ? totalDuration / totalOperations : 0;

    const operationsByType = new Map<string, number>();
    const servicesByType = new Map<string, number>();

    for (const record of this.performanceHistory) {
      operationsByType.set(record.operation, (operationsByType.get(record.operation) || 0) + 1);
      servicesByType.set(record.service, (servicesByType.get(record.service) || 0) + 1);
    }

    return {
      totalOperations,
      avgResponseTime,
      operationsByType: Object.fromEntries(operationsByType),
      servicesByType: Object.fromEntries(servicesByType),
      slowOperationsCount: this.performanceHistory.filter(r => r.duration > this.performanceThreshold).length,
      performanceThreshold: this.performanceThreshold,
      analysisTimestamp: new Date()
    };
  }

  /**
   * Calculate percentile from array of values
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sorted[lower];
    }

    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  }

  /**
   * Calculate variance of an array of numbers
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }
}

/**
 * Performance timer for operation tracking
 */
export interface PerformanceTimer {
  operationId: string;
  operation: string;
  service: string;
  startTime: number;
  metadata: Record<string, any>;
  end: (additionalMetadata?: Record<string, any>) => number;
}

/**
 * Operation performance profile
 */
export interface OperationProfile {
  operation: string;
  service: string;
  totalOperations: number;
  totalDuration: number;
  minDuration: number;
  maxDuration: number;
  avgDuration: number;
  p95Duration: number;
  p99Duration: number;
  recentDurations: number[];
  lastUpdated: Date;
  metadata: Record<string, any>;
}

/**
 * Performance history record
 */
export interface PerformanceHistory {
  operationId: string;
  operation: string;
  service: string;
  duration: number;
  timestamp: Date;
  metadata: Record<string, any>;
}

/**
 * Performance analysis result
 */
export interface PerformanceAnalysis {
  totalOperations: number;
  avgResponseTime: number;
  slowestOperations: Array<{
    operation: string;
    service: string;
    duration: number;
    timestamp: Date;
  }>;
  performanceInsights: PerformanceInsight[];
  analysisTimestamp: Date;
}

/**
 * Performance insight
 */
export interface PerformanceInsight {
  type: 'optimization_opportunity' | 'consistency_issue' | 'bottleneck_detected';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  recommendation: string;
  affectedOperation?: string;
  affectedService?: string;
  currentAvgDuration?: number;
  improvementPotential?: number;
  variance?: number;
}

/**
 * File access pattern analysis
 */
export interface FileAccessAnalysis {
  frequentAccessFiles: Array<{
    filepath: string;
    accessCount: number;
  }>;
  sequentialAccessDetected: boolean;
  totalAnalyzedOperations: number;
}

/**
 * Operation statistics
 */
export interface OperationStats {
  operation: string;
  service: string;
  totalOperations: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  p95Duration: number;
  p99Duration: number;
  lastUpdated: Date;
}

/**
 * Overall performance statistics
 */
export interface OverallPerformanceStats {
  totalOperations: number;
  avgResponseTime: number;
  operationsByType: Record<string, number>;
  servicesByType: Record<string, number>;
  slowOperationsCount: number;
  performanceThreshold: number;
  analysisTimestamp: Date;
}

/**
 * Regression detector for performance monitoring
 */
class RegressionDetector {
  private baselinePerformance: Map<string, number> = new Map();
  private readonly regressionThreshold: number = 1.2; // 20% degradation
  private readonly baselineWindow: number = 50; // Operations for baseline

  constructor(private alerts: SharedStorageAlerts) {}

  /**
   * Check for performance regression
   */
  checkForRegression(operation: string, service: string, duration: number): void {
    const key = `${operation}_${service}`;
    const baseline = this.baselinePerformance.get(key);

    if (!baseline) {
      // Establish baseline after sufficient operations
      const operationRecords = Array.from(this.baselinePerformance.keys())
        .filter(k => k.startsWith(key))
        .length;

      if (operationRecords >= this.baselineWindow) {
        this.baselinePerformance.set(key, duration);
      }
      return;
    }

    // Check for regression
    if (duration > baseline * this.regressionThreshold) {
      this.alerts.alertPerformanceDegradation(
        operation,
        service,
        duration,
        baseline
      );

      sharedStorageLogger.logInfo('Performance regression detected', {
        operation,
        service,
        baseline,
        currentDuration: duration,
        degradationPercent: ((duration - baseline) / baseline * 100).toFixed(1) + '%'
      });
    }
  }
}

/**
 * Connection pool for Docker volume access optimization
 */
class ConnectionPool {
  private activeConnections: Set<string> = new Set();
  private connectionQueue: Array<{ resolve: Function; reject: Function; operationId: string }> = [];
  private lastCleanup: number = Date.now();

  constructor(
    public maxConnections: number,
    private idleTimeout: number,
    private volumePath: string
  ) {}

  /**
   * Track operation for connection pooling
   */
  trackOperation(operationId: string, operation: string, service: string, startTime: number): void {
    this.activeConnections.add(operationId);

    // Simulate connection cleanup
    setTimeout(() => {
      this.activeConnections.delete(operationId);
      this.processQueue();
    }, Math.min(this.idleTimeout, 5000)); // Max 5 seconds for demo
  }

  /**
   * Process queued connection requests
   */
  private processQueue(): void {
    if (this.connectionQueue.length > 0 && this.activeConnections.size < this.maxConnections) {
      const request = this.connectionQueue.shift();
      if (request) {
        request.resolve();
      }
    }
  }

  /**
   * Get connection pool statistics
   */
  getStats(): {
    activeConnections: number;
    queuedRequests: number;
    maxConnections: number;
    utilizationPercent: number;
  } {
    return {
      activeConnections: this.activeConnections.size,
      queuedRequests: this.connectionQueue.length,
      maxConnections: this.maxConnections,
      utilizationPercent: (this.activeConnections.size / this.maxConnections) * 100
    };
  }
}

// Export factory function
export const createSharedStoragePerformance = (alerts: SharedStorageAlerts) => {
  return new SharedStoragePerformance(alerts);
};
