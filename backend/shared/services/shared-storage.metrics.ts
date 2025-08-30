import { register, collectDefaultMetrics, Histogram, Gauge, Counter } from 'prom-client';
import { performance } from 'perf_hooks';

/**
 * SharedStorageMetrics provides comprehensive metrics collection for SharedStorageService
 * Implements Prometheus metrics for monitoring file access performance and system health
 */
export class SharedStorageMetrics {
  private readonly accessDuration: Histogram<string>;
  private readonly accessSuccessRate: Gauge<string>;
  private readonly activeConnections: Gauge<string>;
  private readonly errorRate: Counter<string>;
  private readonly volumeHealth: Gauge<string>;
  private readonly operationsTotal: Counter<string>;
  private readonly performanceThresholdExceeded: Counter<string>;

  private activeOperations: Map<string, number> = new Map();
  private readonly performanceThreshold: number = 100; // 100ms threshold
  private totalOperations: number = 0;
  private errorCount: number = 0;

  constructor() {
    // Initialize default metrics collection
    collectDefaultMetrics();

    // File access duration histogram with performance buckets
    this.accessDuration = new Histogram({
      name: 'shared_storage_access_duration_seconds',
      help: 'Duration of shared storage file access operations in seconds',
      labelNames: ['operation', 'service', 'success'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    });

    // Success rate gauge
    this.accessSuccessRate = new Gauge({
      name: 'shared_storage_access_success_rate',
      help: 'Current success rate of shared storage operations (0.0 to 1.0)',
      labelNames: ['service', 'operation']
    });

    // Active connections gauge
    this.activeConnections = new Gauge({
      name: 'shared_storage_active_connections',
      help: 'Number of currently active shared storage connections',
      labelNames: ['service']
    });

    // Error rate counter
    this.errorRate = new Counter({
      name: 'shared_storage_errors_total',
      help: 'Total number of shared storage errors',
      labelNames: ['service', 'operation', 'error_type']
    });

    // Volume health gauge
    this.volumeHealth = new Gauge({
      name: 'shared_storage_volume_health',
      help: 'Health status of shared storage volume (0=unhealthy, 1=healthy)',
      labelNames: ['volume']
    });

    // Total operations counter
    this.operationsTotal = new Counter({
      name: 'shared_storage_operations_total',
      help: 'Total number of shared storage operations',
      labelNames: ['service', 'operation', 'success']
    });

    // Performance threshold exceeded counter
    this.performanceThresholdExceeded = new Counter({
      name: 'shared_storage_performance_threshold_exceeded_total',
      help: 'Number of operations exceeding performance threshold (>100ms)',
      labelNames: ['service', 'operation']
    });

    // Set initial volume health to healthy
    this.volumeHealth.set({ volume: 'shared_sessions' }, 1);
  }

  /**
   * Record file access operation metrics
   */
  recordAccessMetrics(
    operation: string,
    service: string,
    duration: number,
    success: boolean,
    errorType?: string
  ): void {
    const durationSeconds = duration / 1000;

    // Record operation duration
    this.accessDuration
      .labels(operation, service, success.toString())
      .observe(durationSeconds);

    // Record total operations
    this.operationsTotal
      .labels(service, operation, success.toString())
      .inc();

    // Record performance threshold violations
    if (duration > this.performanceThreshold) {
      this.performanceThresholdExceeded
        .labels(service, operation)
        .inc();
    }

    // Record errors
    if (!success && errorType) {
      this.errorRate
        .labels(service, operation, errorType)
        .inc();
    }

    // Update success rate (rolling average simulation)
    this.updateSuccessRate(operation, service, success);
  }

  /**
   * Track active operations
   */
  startOperation(service: string, operationId: string): void {
    const currentCount = this.activeOperations.get(service) || 0;
    this.activeOperations.set(service, currentCount + 1);
    this.activeConnections.set({ service }, currentCount + 1);
  }

  /**
   * Complete operation tracking
   */
  endOperation(service: string, operationId: string): void {
    const currentCount = this.activeOperations.get(service) || 0;
    const newCount = Math.max(0, currentCount - 1);
    this.activeOperations.set(service, newCount);
    this.activeConnections.set({ service }, newCount);
  }

  /**
   * Update volume health status
   */
  updateVolumeHealth(volume: string, isHealthy: boolean): void {
    this.volumeHealth.set({ volume }, isHealthy ? 1 : 0);
  }

  /**
   * Get metrics for Prometheus scraping
   */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }



  /**
   * Reset all metrics (useful for testing)
   */
  reset(): void {
    register.resetMetrics();
    this.activeOperations.clear();
    // Re-initialize metrics after reset
    collectDefaultMetrics();
    this.initializeMetrics();
  }

  /**
   * Get performance summary for a time period
   */
  getPerformanceSummary(service?: string, timeRangeMinutes: number = 5): Record<string, any> {
    // This would typically aggregate metrics from Prometheus
    // For now, return a summary structure
    return {
      service: service || 'all',
      timeRange: `${timeRangeMinutes} minutes`,
      summary: {
        totalOperations: 0, // Would be aggregated from Prometheus
        averageResponseTime: 0,
        p95ResponseTime: 0,
        errorRate: 0,
        thresholdViolations: 0
      }
    };
  }

  private initializeMetrics(): void {
    // Re-initialize all metrics after reset
    this.volumeHealth.set({ volume: 'shared_sessions' }, 1);
  }

  private updateSuccessRate(operation: string, service: string, success: boolean): void {
    // Simple success rate calculation (in production, this would use a sliding window)
    // For now, we'll use a basic approach - just track success/failure ratio
    const label = `${operation}_${service}`;

    // Update success rate based on recent operations (simplified approach)
    const successRate = success ? 1.0 : 0.0;
    this.accessSuccessRate.set({ service, operation }, successRate);
  }

  /**
   * Get metrics as JSON for health checks
   */
  async getMetricsJson(): Promise<Record<string, any>> {
    try {
      const prometheusMetrics = await this.getPrometheusMetrics();

      return {
        activeConnections: this.activeOperations.size,
        totalOperations: this.totalOperations,
        errorCount: this.errorCount,
        prometheus_available: true,
        timestamp: new Date().toISOString(),
        metrics_format: 'json'
      };
    } catch (error) {
      return {
        activeConnections: this.activeOperations.size,
        totalOperations: this.totalOperations,
        errorCount: this.errorCount,
        prometheus_available: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        metrics_format: 'json'
      };
    }
  }

  /**
   * Get Prometheus-formatted metrics for scraping
   */
  async getPrometheusMetrics(): Promise<string> {
    try {
      let prometheusOutput = '# HELP shared_storage_active_connections Number of active file operations\n';
      prometheusOutput += '# TYPE shared_storage_active_connections gauge\n';
      prometheusOutput += `shared_storage_active_connections ${this.activeOperations.size}\n\n`;

      prometheusOutput += '# HELP shared_storage_total_operations Total number of operations performed\n';
      prometheusOutput += '# TYPE shared_storage_total_operations counter\n';
      prometheusOutput += `shared_storage_total_operations ${this.totalOperations}\n\n`;

      prometheusOutput += '# HELP shared_storage_error_count Total number of errors encountered\n';
      prometheusOutput += '# TYPE shared_storage_error_count counter\n';
      prometheusOutput += `shared_storage_error_count ${this.errorCount}\n\n`;

      prometheusOutput += '# HELP shared_storage_status Service health status\n';
      prometheusOutput += '# TYPE shared_storage_status gauge\n';
      prometheusOutput += 'shared_storage_status 1\n';

      return prometheusOutput;
    } catch (error) {
      // Return minimal metrics if Prometheus client fails
      return `# Shared Storage Metrics - Error: ${error.message}\nshared_storage_status 0\n`;
    }
  }
}

/**
 * Singleton instance for application-wide metrics collection
 */
export const sharedStorageMetrics = new SharedStorageMetrics();
