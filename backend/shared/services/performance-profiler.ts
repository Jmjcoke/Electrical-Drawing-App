import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as os from 'os';
import * as process from 'process';
import { createClient, RedisClientType } from 'redis';

/**
 * Performance metric types
 */
export enum PerformanceMetricType {
  OPERATION_DURATION = 'operation_duration',
  MEMORY_USAGE = 'memory_usage',
  CPU_USAGE = 'cpu_usage',
  CACHE_HIT_RATE = 'cache_hit_rate',
  CONNECTION_POOL_UTILIZATION = 'connection_pool_utilization',
  FILE_SIZE_DISTRIBUTION = 'file_size_distribution',
  ERROR_RATE = 'error_rate',
  THROUGHPUT = 'throughput',
}

/**
 * Performance sample data
 */
export interface PerformanceSample {
  timestamp: number;
  operation: string;
  sessionId: string;
  service: string;
  duration: number;
  memoryUsage: number;
  cpuUsage: number;
  success: boolean;
  errorType?: string;
  fileSize?: number;
  cacheHit?: boolean;
  metadata: Record<string, any>;
}

/**
 * Bottleneck detection result
 */
export interface BottleneckAnalysis {
  detectedAt: number;
  operation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metrics: {
    avgDuration: number;
    p95Duration: number;
    p99Duration: number;
    throughput: number;
    errorRate: number;
    memoryPressure: number;
  };
  recommendations: string[];
}

/**
 * Performance regression detection
 */
export interface RegressionAlert {
  detectedAt: number;
  operation: string;
  baselineValue: number;
  currentValue: number;
  degradationPercent: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isResolved: boolean;
  resolvedAt?: number;
}

/**
 * Performance threshold configuration
 */
export interface PerformanceThresholds {
  [PerformanceMetricType.OPERATION_DURATION]: {
    warning: number; // milliseconds
    critical: number; // milliseconds
    p95Warning: number;
    p95Critical: number;
  };
  [PerformanceMetricType.MEMORY_USAGE]: {
    warning: number; // percentage
    critical: number; // percentage
  };
  [PerformanceMetricType.CACHE_HIT_RATE]: {
    warning: number; // percentage
    critical: number; // percentage
  };
  [PerformanceMetricType.ERROR_RATE]: {
    warning: number; // percentage
    critical: number; // percentage
  };
  regressionThreshold: number; // percentage change to trigger regression alert
}

/**
 * Performance profiler configuration
 */
export interface PerformanceProfilerConfig {
  redisUrl: string;
  enableRedisStorage: boolean;
  sampleRate: number; // 0-1, percentage of operations to sample
  retentionPeriod: number; // hours to keep performance data
  thresholds: PerformanceThresholds;
  dashboardUpdateInterval: number; // seconds
  bottleneckDetectionInterval: number; // minutes
  regressionCheckInterval: number; // hours
  alertCooldownPeriod: number; // minutes
}

/**
 * Performance profiling and monitoring service
 */
export class PerformanceProfiler extends EventEmitter {
  private redis: RedisClientType | null = null;
  private config: PerformanceProfilerConfig;
  private samples: Map<string, PerformanceSample[]> = new Map();
  private activeOperations: Map<string, { startTime: number; metadata: Record<string, any> }> = new Map();
  private baselines: Map<string, { avgDuration: number; p95Duration: number; timestamp: number }> = new Map();
  private bottlenecks: BottleneckAnalysis[] = [];
  private regressionAlerts: RegressionAlert[] = [];
  private lastDashboardUpdate: number = 0;
  private lastBottleneckCheck: number = 0;
  private lastRegressionCheck: number = 0;
  private alertCooldowns: Map<string, number> = new Map();

  constructor(config: PerformanceProfilerConfig) {
    super();
    this.config = config;
    this.initializeRedis();
    this.startMonitoringLoops();
  }

  /**
   * Initialize Redis connection for persistent storage
   */
  private async initializeRedis(): Promise<void> {
    if (!this.config.enableRedisStorage) {
      return;
    }

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
   * Start performance profiling for an operation
   */
  startOperation(operationId: string, operation: string, metadata: Record<string, any> = {}): void {
    // Sample based on configured rate
    if (Math.random() > this.config.sampleRate) {
      return;
    }

    const startTime = performance.now();
    this.activeOperations.set(operationId, { startTime, metadata });
  }

  /**
   * End performance profiling for an operation
   */
  endOperation(
    operationId: string,
    operation: string,
    sessionId: string,
    service: string,
    success: boolean = true,
    errorType?: string,
    fileSize?: number,
    cacheHit?: boolean
  ): void {
    const activeOp = this.activeOperations.get(operationId);
    if (!activeOp) {
      return; // Operation wasn't being profiled
    }

    const endTime = performance.now();
    const duration = endTime - activeOp.startTime;

    // Collect system metrics
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const sample: PerformanceSample = {
      timestamp: Date.now(),
      operation,
      sessionId,
      service,
      duration,
      memoryUsage: memoryUsage.heapUsed / memoryUsage.heapTotal,
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
      success,
      errorType,
      fileSize,
      cacheHit,
      metadata: activeOp.metadata,
    };

    this.activeOperations.delete(operationId);
    this.storeSample(sample);
    this.checkThresholds(sample);
  }

  /**
   * Record a custom performance metric
   */
  recordMetric(
    operation: string,
    sessionId: string,
    service: string,
    metricType: PerformanceMetricType,
    value: number,
    metadata: Record<string, any> = {}
  ): void {
    const sample: PerformanceSample = {
      timestamp: Date.now(),
      operation,
      sessionId,
      service,
      duration: metricType === PerformanceMetricType.OPERATION_DURATION ? value : 0,
      memoryUsage: metricType === PerformanceMetricType.MEMORY_USAGE ? value : 0,
      cpuUsage: metricType === PerformanceMetricType.CPU_USAGE ? value : 0,
      success: true,
      metadata: { ...metadata, metricType, customValue: value },
    };

    this.storeSample(sample);
    this.checkThresholds(sample);
  }

  /**
   * Store performance sample
   */
  private async storeSample(sample: PerformanceSample): Promise<void> {
    // Store in memory for immediate access
    const key = `${sample.operation}:${sample.service}`;
    if (!this.samples.has(key)) {
      this.samples.set(key, []);
    }
    this.samples.get(key)!.push(sample);

    // Keep only recent samples (last hour)
    const oneHourAgo = Date.now() - 3600000;
    const recentSamples = this.samples.get(key)!.filter(s => s.timestamp > oneHourAgo);
    this.samples.set(key, recentSamples);

    // Store in Redis if available
    if (this.redis) {
      try {
        const redisKey = `perf:${key}:${sample.timestamp}`;
        await this.redis.setEx(redisKey, this.config.retentionPeriod * 3600, JSON.stringify(sample));
      } catch (error) {
        this.emit('redisStorageError', error);
      }
    }

    this.emit('sampleStored', sample);
  }

  /**
   * Check if metrics exceed thresholds
   */
  private checkThresholds(sample: PerformanceSample): void {
    const thresholds = this.config.thresholds;

    // Check operation duration
    if (sample.duration > thresholds[PerformanceMetricType.OPERATION_DURATION].critical) {
      this.emitAlert('critical', 'operation_duration', sample, `Operation duration exceeded critical threshold: ${sample.duration}ms`);
    } else if (sample.duration > thresholds[PerformanceMetricType.OPERATION_DURATION].warning) {
      this.emitAlert('warning', 'operation_duration', sample, `Operation duration exceeded warning threshold: ${sample.duration}ms`);
    }

    // Check memory usage
    if (sample.memoryUsage > thresholds[PerformanceMetricType.MEMORY_USAGE].critical) {
      this.emitAlert('critical', 'memory_usage', sample, `Memory usage exceeded critical threshold: ${(sample.memoryUsage * 100).toFixed(1)}%`);
    } else if (sample.memoryUsage > thresholds[PerformanceMetricType.MEMORY_USAGE].warning) {
      this.emitAlert('warning', 'memory_usage', sample, `Memory usage exceeded warning threshold: ${(sample.memoryUsage * 100).toFixed(1)}%`);
    }

    // Check error rate (if this is an error)
    if (!sample.success) {
      const errorRate = this.calculateErrorRate(sample.operation, sample.service);
      if (errorRate > thresholds[PerformanceMetricType.ERROR_RATE].critical) {
        this.emitAlert('critical', 'error_rate', sample, `Error rate exceeded critical threshold: ${(errorRate * 100).toFixed(1)}%`);
      } else if (errorRate > thresholds[PerformanceMetricType.ERROR_RATE].warning) {
        this.emitAlert('warning', 'error_rate', sample, `Error rate exceeded warning threshold: ${(errorRate * 100).toFixed(1)}%`);
      }
    }
  }

  /**
   * Emit performance alert
   */
  private emitAlert(severity: 'warning' | 'critical', alertType: string, sample: PerformanceSample, message: string): void {
    const alertKey = `${alertType}:${sample.operation}:${sample.service}`;

    // Check cooldown period
    const lastAlert = this.alertCooldowns.get(alertKey);
    if (lastAlert && Date.now() - lastAlert < this.config.alertCooldownPeriod * 60000) {
      return; // Still in cooldown
    }

    this.alertCooldowns.set(alertKey, Date.now());

    const alert = {
      severity,
      alertType,
      operation: sample.operation,
      service: sample.service,
      sessionId: sample.sessionId,
      timestamp: sample.timestamp,
      message,
      metrics: {
        duration: sample.duration,
        memoryUsage: sample.memoryUsage,
        cpuUsage: sample.cpuUsage,
        success: sample.success,
      },
    };

    this.emit('performanceAlert', alert);
  }

  /**
   * Calculate error rate for an operation
   */
  private calculateErrorRate(operation: string, service: string): number {
    const key = `${operation}:${service}`;
    const operationSamples = this.samples.get(key) || [];

    if (operationSamples.length === 0) return 0;

    const errorCount = operationSamples.filter(s => !s.success).length;
    return errorCount / operationSamples.length;
  }

  /**
   * Detect performance bottlenecks
   */
  async detectBottlenecks(): Promise<BottleneckAnalysis[]> {
    const bottlenecks: BottleneckAnalysis[] = [];

    for (const [key, samples] of this.samples) {
      if (samples.length < 10) continue; // Need minimum samples for analysis

      const durations = samples.map(s => s.duration).sort((a, b) => a - b);
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const p95Duration = durations[Math.floor(durations.length * 0.95)];
      const p99Duration = durations[Math.floor(durations.length * 0.99)];

      const recentSamples = samples.filter(s => s.timestamp > Date.now() - 300000); // Last 5 minutes
      const throughput = recentSamples.length / 5; // operations per minute
      const errorRate = recentSamples.filter(s => !s.success).length / recentSamples.length;

      const memoryPressure = recentSamples.reduce((sum, s) => sum + s.memoryUsage, 0) / recentSamples.length;

      // Check for bottlenecks
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      let description = '';
      const recommendations: string[] = [];

      if (p99Duration > this.config.thresholds[PerformanceMetricType.OPERATION_DURATION].critical) {
        severity = 'critical';
        description = `Critical bottleneck detected: P99 duration ${p99Duration.toFixed(2)}ms exceeds critical threshold`;
        recommendations.push('Consider implementing caching for this operation');
        recommendations.push('Review and optimize database queries');
        recommendations.push('Consider horizontal scaling');
      } else if (p95Duration > this.config.thresholds[PerformanceMetricType.OPERATION_DURATION].warning) {
        severity = 'high';
        description = `High bottleneck detected: P95 duration ${p95Duration.toFixed(2)}ms exceeds warning threshold`;
        recommendations.push('Monitor resource utilization');
        recommendations.push('Consider query optimization');
      } else if (throughput < 10) { // Less than 10 operations per minute
        severity = 'medium';
        description = `Low throughput detected: ${throughput.toFixed(2)} operations/minute`;
        recommendations.push('Investigate potential blocking operations');
      }

      if (errorRate > this.config.thresholds[PerformanceMetricType.ERROR_RATE].warning) {
        if (severity !== 'critical') severity = 'high';
        description += ` High error rate: ${(errorRate * 100).toFixed(1)}%`;
        recommendations.push('Investigate and fix underlying errors');
        recommendations.push('Implement better error handling');
      }

      if (severity !== 'low') {
        const bottleneck: BottleneckAnalysis = {
          detectedAt: Date.now(),
          operation: key.split(':')[0],
          severity,
          description,
          metrics: {
            avgDuration,
            p95Duration,
            p99Duration,
            throughput,
            errorRate,
            memoryPressure,
          },
          recommendations,
        };

        bottlenecks.push(bottleneck);
        this.bottlenecks.push(bottleneck);
      }
    }

    // Keep only recent bottlenecks
    this.bottlenecks = this.bottlenecks.filter(b => b.detectedAt > Date.now() - 3600000); // Last hour

    return bottlenecks;
  }

  /**
   * Check for performance regressions
   */
  async checkPerformanceRegressions(): Promise<RegressionAlert[]> {
    const regressions: RegressionAlert[] = [];

    for (const [operation, samples] of this.samples) {
      if (samples.length < 20) continue; // Need sufficient historical data

      const recentSamples = samples.filter(s => s.timestamp > Date.now() - 3600000); // Last hour
      const olderSamples = samples.filter(s => s.timestamp <= Date.now() - 3600000 && s.timestamp > Date.now() - 7200000); // Previous hour

      if (recentSamples.length < 5 || olderSamples.length < 5) continue;

      const recentAvg = recentSamples.reduce((sum, s) => sum + s.duration, 0) / recentSamples.length;
      const olderAvg = olderSamples.reduce((sum, s) => sum + s.duration, 0) / olderSamples.length;

      const baseline = this.baselines.get(operation);
      if (baseline && Date.now() - baseline.timestamp > 24 * 3600000) { // Baseline is older than 24 hours
        // Update baseline
        this.baselines.set(operation, {
          avgDuration: recentAvg,
          p95Duration: this.calculatePercentile(recentSamples.map(s => s.duration), 95),
          timestamp: Date.now(),
        });
      } else if (!baseline) {
        // Set initial baseline
        this.baselines.set(operation, {
          avgDuration: recentAvg,
          p95Duration: this.calculatePercentile(recentSamples.map(s => s.duration), 95),
          timestamp: Date.now(),
        });
      } else {
        // Check for regression
        const degradationPercent = ((recentAvg - baseline.avgDuration) / baseline.avgDuration) * 100;

        if (Math.abs(degradationPercent) > this.config.thresholds.regressionThreshold) {
          let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

          if (Math.abs(degradationPercent) > 50) severity = 'critical';
          else if (Math.abs(degradationPercent) > 25) severity = 'high';
          else if (Math.abs(degradationPercent) > 10) severity = 'medium';

          const regression: RegressionAlert = {
            detectedAt: Date.now(),
            operation,
            baselineValue: baseline.avgDuration,
            currentValue: recentAvg,
            degradationPercent,
            severity,
            isResolved: false,
          };

          regressions.push(regression);
          this.regressionAlerts.push(regression);

          // Update baseline if degradation is significant
          if (Math.abs(degradationPercent) > 20) {
            this.baselines.set(operation, {
              avgDuration: recentAvg,
              p95Duration: this.calculatePercentile(recentSamples.map(s => s.duration), 95),
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    return regressions;
  }

  /**
   * Get real-time performance dashboard data
   */
  async getDashboardData(): Promise<any> {
    const dashboard = {
      timestamp: Date.now(),
      systemMetrics: {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        uptime: process.uptime(),
        loadAverage: os.loadavg(),
      },
      operations: {} as Record<string, any>,
      alerts: {
        activeBottlenecks: this.bottlenecks.filter(b => b.detectedAt > Date.now() - 3600000),
        recentRegressions: this.regressionAlerts.filter(r => !r.isResolved && r.detectedAt > Date.now() - 3600000),
      },
    };

    // Aggregate operation metrics
    for (const [key, samples] of this.samples) {
      const recentSamples = samples.filter(s => s.timestamp > Date.now() - 300000); // Last 5 minutes

      if (recentSamples.length === 0) continue;

      const durations = recentSamples.map(s => s.duration);
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const p95Duration = this.calculatePercentile(durations, 95);
      const throughput = recentSamples.length / 5; // operations per minute
      const errorRate = recentSamples.filter(s => !s.success).length / recentSamples.length;

      dashboard.operations[key] = {
        sampleCount: recentSamples.length,
        avgDuration,
        p95Duration,
        throughput,
        errorRate,
        successRate: 1 - errorRate,
        lastUpdated: Math.max(...recentSamples.map(s => s.timestamp)),
      };
    }

    return dashboard;
  }

  /**
   * Calculate percentile from sorted array
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
   * Start monitoring loops
   */
  private startMonitoringLoops(): void {
    // Dashboard updates
    setInterval(async () => {
      try {
        const dashboard = await this.getDashboardData();
        this.emit('dashboardUpdate', dashboard);
      } catch (error) {
        this.emit('dashboardUpdateError', error);
      }
    }, this.config.dashboardUpdateInterval * 1000);

    // Bottleneck detection
    setInterval(async () => {
      try {
        const bottlenecks = await this.detectBottlenecks();
        if (bottlenecks.length > 0) {
          this.emit('bottlenecksDetected', bottlenecks);
        }
      } catch (error) {
        this.emit('bottleneckDetectionError', error);
      }
    }, this.config.bottleneckDetectionInterval * 60000);

    // Regression monitoring
    setInterval(async () => {
      try {
        const regressions = await this.checkPerformanceRegressions();
        if (regressions.length > 0) {
          this.emit('regressionsDetected', regressions);
        }
      } catch (error) {
        this.emit('regressionDetectionError', error);
      }
    }, this.config.regressionCheckInterval * 3600000);
  }

  /**
   * Get performance statistics for a specific operation
   */
  getOperationStats(operation: string, service: string): any {
    const key = `${operation}:${service}`;
    const samples = this.samples.get(key) || [];

    if (samples.length === 0) {
      return null;
    }

    const durations = samples.map(s => s.duration);
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    const p50Duration = this.calculatePercentile(durations, 50);
    const p95Duration = this.calculatePercentile(durations, 95);
    const p99Duration = this.calculatePercentile(durations, 99);

    const errorRate = samples.filter(s => !s.success).length / samples.length;
    const throughput = samples.length / ((Date.now() - Math.min(...samples.map(s => s.timestamp))) / 60000); // operations per minute

    return {
      operation,
      service,
      sampleCount: samples.length,
      timeRange: {
        start: Math.min(...samples.map(s => s.timestamp)),
        end: Math.max(...samples.map(s => s.timestamp)),
      },
      duration: {
        avg: avgDuration,
        min: minDuration,
        max: maxDuration,
        p50: p50Duration,
        p95: p95Duration,
        p99: p99Duration,
      },
      errorRate,
      throughput,
      successRate: 1 - errorRate,
    };
  }

  /**
   * Get all performance statistics
   */
  getAllStats(): any {
    const stats: Record<string, any> = {};

    for (const [key, samples] of this.samples) {
      const [operation, service] = key.split(':');
      stats[key] = this.getOperationStats(operation, service);
    }

    return {
      timestamp: Date.now(),
      totalOperations: Object.keys(stats).length,
      operations: stats,
      systemInfo: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
      },
    };
  }

  /**
   * Clear old performance data
   */
  async clearOldData(): Promise<void> {
    const cutoffTime = Date.now() - (this.config.retentionPeriod * 3600000);

    // Clear in-memory data
    for (const [key, samples] of this.samples) {
      const recentSamples = samples.filter(s => s.timestamp > cutoffTime);
      this.samples.set(key, recentSamples);
    }

    // Clear Redis data if available
    if (this.redis) {
      try {
        const keys = await this.redis.keys('perf:*');
        for (const key of keys) {
          const ttl = await this.redis.ttl(key);
          if (ttl === -1) { // Key has no expiration
            await this.redis.del(key);
          }
        }
      } catch (error) {
        this.emit('cleanupError', error);
      }
    }

    // Clear old alerts
    this.bottlenecks = this.bottlenecks.filter(b => b.detectedAt > cutoffTime);
    this.regressionAlerts = this.regressionAlerts.filter(r => r.detectedAt > cutoffTime || r.isResolved);
  }

  /**
   * Close the profiler and cleanup resources
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    this.samples.clear();
    this.activeOperations.clear();
    this.baselines.clear();
    this.bottlenecks.length = 0;
    this.regressionAlerts.length = 0;
    this.emit('closed');
  }
}

/**
 * Default performance thresholds
 */
export const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  [PerformanceMetricType.OPERATION_DURATION]: {
    warning: 100, // 100ms
    critical: 500, // 500ms
    p95Warning: 200,
    p95Critical: 1000,
  },
  [PerformanceMetricType.MEMORY_USAGE]: {
    warning: 0.8, // 80%
    critical: 0.9, // 90%
  },
  [PerformanceMetricType.CACHE_HIT_RATE]: {
    warning: 0.7, // 70%
    critical: 0.5, // 50%
  },
  [PerformanceMetricType.ERROR_RATE]: {
    warning: 0.05, // 5%
    critical: 0.1, // 10%
  },
  regressionThreshold: 15, // 15% change triggers regression alert
};

/**
 * Factory function to create PerformanceProfiler
 */
export function createPerformanceProfiler(config?: Partial<PerformanceProfilerConfig>): PerformanceProfiler {
  const defaultConfig: PerformanceProfilerConfig = {
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    enableRedisStorage: true,
    sampleRate: 0.1, // Sample 10% of operations
    retentionPeriod: 24, // 24 hours
    thresholds: DEFAULT_PERFORMANCE_THRESHOLDS,
    dashboardUpdateInterval: 30, // 30 seconds
    bottleneckDetectionInterval: 5, // 5 minutes
    regressionCheckInterval: 1, // 1 hour
    alertCooldownPeriod: 10, // 10 minutes
  };

  return new PerformanceProfiler({ ...defaultConfig, ...config });
}
