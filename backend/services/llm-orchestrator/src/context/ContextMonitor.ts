/**
 * ContextMonitor Service
 * Monitors context quality, performance, and issues in real-time
 */

import { randomUUID } from 'crypto';
import type {
  ContextAlert,
  ContextAlertType,
  ContextQualityMetrics,
  ConversationContext
} from '../../../../shared/types/context';

export interface ContextMonitorConfig {
  readonly alertThresholds: {
    readonly maxRetrievalTimeMs: number;
    readonly maxEnhancementTimeMs: number;
    readonly minAccuracyScore: number;
    readonly maxStorageSizeMb: number;
    readonly maxMemoryUsageMb: number;
    readonly minCacheHitRate: number;
    readonly maxErrorRatePercent: number;
  };
  readonly monitoringIntervalMs: number;
  readonly enableRealTimeAlerts: boolean;
  readonly alertRetentionDays: number;
}

export class ContextMonitorService {
  private readonly config: ContextMonitorConfig;
  private readonly activeAlerts = new Map<string, ContextAlert>();
  private readonly alertHistory: ContextAlert[] = [];
  private readonly errorCounts = new Map<string, number>();
  private readonly performanceBaselines = new Map<string, number>();
  private monitoringInterval: NodeJS.Timeout | undefined;

  constructor(config: ContextMonitorConfig) {
    this.config = config;
    this.initializeBaselines();
  }

  /**
   * Starts the monitoring service
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      return; // Already monitoring
    }

    this.monitoringInterval = setInterval(() => {
      this.performRoutineChecks();
    }, this.config.monitoringIntervalMs);

    console.log('Context monitoring started');
  }

  /**
   * Stops the monitoring service
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      console.log('Context monitoring stopped');
    }
  }

  /**
   * Monitors context operation performance and triggers alerts if needed
   * @param operation - Name of the operation
   * @param executionTimeMs - Time taken to execute
   * @param contextId - Context identifier
   * @param sessionId - Session identifier
   * @param success - Whether the operation was successful
   * @param errorMessage - Error message if operation failed
   */
  monitorOperation(
    operation: string,
    executionTimeMs: number,
    contextId: string,
    sessionId: string,
    success: boolean = true,
    _errorMessage?: string
  ): void {
    // Check performance thresholds
    this.checkPerformanceThresholds(operation, executionTimeMs, contextId, sessionId);

    // Track errors
    if (!success) {
      this.trackError(operation, contextId, sessionId, _errorMessage);
    }

    // Update performance baselines
    this.updatePerformanceBaseline(operation, executionTimeMs);
  }

  /**
   * Monitors context quality metrics and accuracy
   * @param qualityMetrics - Quality metrics to monitor
   */
  monitorQuality(qualityMetrics: ContextQualityMetrics): void {
    const { accuracy, performance, storage } = qualityMetrics;

    // Check accuracy thresholds
    if (accuracy.contextRelevanceScore < this.config.alertThresholds.minAccuracyScore) {
      this.triggerAlert({
        type: 'accuracy_drop',
        severity: 'high',
        title: 'Context Accuracy Below Threshold',
        description: `Context relevance score (${accuracy.contextRelevanceScore.toFixed(2)}) is below minimum threshold (${this.config.alertThresholds.minAccuracyScore})`,
        contextId: qualityMetrics.contextId,
        sessionId: qualityMetrics.sessionId,
        metrics: { accuracy: accuracy.contextRelevanceScore },
        threshold: this.config.alertThresholds.minAccuracyScore
      });
    }

    // Check performance thresholds
    if (performance.retrievalTimeMs > this.config.alertThresholds.maxRetrievalTimeMs) {
      this.triggerAlert({
        type: 'performance_degradation',
        severity: 'medium',
        title: 'Context Retrieval Performance Degradation',
        description: `Context retrieval time (${performance.retrievalTimeMs}ms) exceeds threshold (${this.config.alertThresholds.maxRetrievalTimeMs}ms)`,
        contextId: qualityMetrics.contextId,
        sessionId: qualityMetrics.sessionId,
        metrics: { retrievalTimeMs: performance.retrievalTimeMs },
        threshold: this.config.alertThresholds.maxRetrievalTimeMs
      });
    }

    // Check storage limits
    const storageMb = storage.totalSizeBytes / (1024 * 1024);
    if (storageMb > this.config.alertThresholds.maxStorageSizeMb) {
      this.triggerAlert({
        type: 'storage_limit_exceeded',
        severity: 'high',
        title: 'Context Storage Limit Exceeded',
        description: `Context storage (${storageMb.toFixed(2)}MB) exceeds limit (${this.config.alertThresholds.maxStorageSizeMb}MB)`,
        contextId: qualityMetrics.contextId,
        sessionId: qualityMetrics.sessionId,
        metrics: { storageMb },
        threshold: this.config.alertThresholds.maxStorageSizeMb
      });
    }

    // Check cache hit rate
    if (performance.cacheHitRate < this.config.alertThresholds.minCacheHitRate) {
      this.triggerAlert({
        type: 'cache_miss_rate_high',
        severity: 'medium',
        title: 'Low Cache Hit Rate',
        description: `Cache hit rate (${(performance.cacheHitRate * 100).toFixed(1)}%) is below threshold (${(this.config.alertThresholds.minCacheHitRate * 100).toFixed(1)}%)`,
        contextId: qualityMetrics.contextId,
        sessionId: qualityMetrics.sessionId,
        metrics: { cacheHitRate: performance.cacheHitRate },
        threshold: this.config.alertThresholds.minCacheHitRate
      });
    }
  }

  /**
   * Monitors context memory usage
   * @param contextId - Context identifier
   * @param sessionId - Session identifier
   * @param memoryUsageMb - Current memory usage in MB
   */
  monitorMemoryUsage(contextId: string, sessionId: string, memoryUsageMb: number): void {
    if (memoryUsageMb > this.config.alertThresholds.maxMemoryUsageMb) {
      this.triggerAlert({
        type: 'memory_leak',
        severity: 'critical',
        title: 'High Memory Usage Detected',
        description: `Context memory usage (${memoryUsageMb.toFixed(2)}MB) exceeds threshold (${this.config.alertThresholds.maxMemoryUsageMb}MB)`,
        contextId,
        sessionId,
        metrics: { memoryUsageMb },
        threshold: this.config.alertThresholds.maxMemoryUsageMb
      });
    }
  }

  /**
   * Analyzes context health and returns assessment
   * @param context - Context to analyze
   * @returns Health assessment
   */
  analyzeContextHealth(context: ConversationContext): {
    healthScore: number;
    issues: string[];
    recommendations: string[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let healthScore = 100;

    // Check context age
    const ageHours = (Date.now() - context.metadata.createdAt.getTime()) / (1000 * 60 * 60);
    if (ageHours > 24) {
      issues.push('Context is older than 24 hours');
      recommendations.push('Consider context summarization or cleanup');
      healthScore -= 10;
    }

    // Check turn count
    if (context.conversationThread.length > 50) {
      issues.push('High number of conversation turns');
      recommendations.push('Enable context compression or summarization');
      healthScore -= 15;
    }

    // Check compression level
    if (context.metadata.compressionLevel === 0 && context.conversationThread.length > 20) {
      issues.push('Context not compressed despite high turn count');
      recommendations.push('Enable automatic context compression');
      healthScore -= 10;
    }

    // Check entity growth
    const entityCount = context.cumulativeContext.extractedEntities.size;
    if (entityCount > 200) {
      issues.push('Very high entity count may impact performance');
      recommendations.push('Review entity extraction and pruning strategies');
      healthScore -= 10;
    }

    // Check expiration
    const timeToExpiry = context.expiresAt.getTime() - Date.now();
    if (timeToExpiry < 60 * 60 * 1000) { // Less than 1 hour
      issues.push('Context expires soon');
      recommendations.push('Consider extending context expiration if still active');
      healthScore -= 5;
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (healthScore < 50) riskLevel = 'critical';
    else if (healthScore < 70) riskLevel = 'high';
    else if (healthScore < 85) riskLevel = 'medium';

    return {
      healthScore: Math.max(0, healthScore),
      issues,
      recommendations,
      riskLevel
    };
  }

  /**
   * Gets all active alerts
   * @returns Array of active alerts
   */
  getActiveAlerts(): ContextAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Gets alert history
   * @param limit - Maximum number of alerts to return
   * @returns Array of historical alerts
   */
  getAlertHistory(limit: number = 100): ContextAlert[] {
    return this.alertHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Resolves an active alert
   * @param alertId - Alert identifier
   * @param resolution - Resolution description
   */
  resolveAlert(alertId: string, resolution?: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    const resolvedAlert: ContextAlert = {
      ...alert,
      resolved: true,
      description: resolution ? `${alert.description} | Resolved: ${resolution}` : alert.description
    };

    this.activeAlerts.delete(alertId);
    
    // Update in history
    const historyIndex = this.alertHistory.findIndex(a => a.alertId === alertId);
    if (historyIndex >= 0) {
      this.alertHistory[historyIndex] = resolvedAlert;
    }

    return true;
  }

  /**
   * Gets monitoring statistics
   * @returns Monitoring statistics
   */
  getMonitoringStats(): {
    activeAlertsCount: number;
    totalAlertsToday: number;
    errorRate: number;
    avgPerformance: Record<string, number>;
    isMonitoring: boolean;
  } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const alertsToday = this.alertHistory.filter(alert => alert.timestamp >= today).length;
    const totalOperations = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    const totalErrors = Array.from(this.errorCounts.entries())
      .filter(([key]) => key.includes('error'))
      .reduce((sum, [, count]) => sum + count, 0);

    const errorRate = totalOperations > 0 ? (totalErrors / totalOperations) * 100 : 0;

    return {
      activeAlertsCount: this.activeAlerts.size,
      totalAlertsToday: alertsToday,
      errorRate,
      avgPerformance: Object.fromEntries(this.performanceBaselines.entries()),
      isMonitoring: this.monitoringInterval !== undefined
    };
  }

  // Private methods

  private triggerAlert(alertData: Omit<ContextAlert, 'alertId' | 'timestamp' | 'resolved'>): void {
    const alert: ContextAlert = {
      alertId: randomUUID(),
      timestamp: new Date(),
      resolved: false,
      ...alertData
    };

    // Check if similar alert already exists
    const existingAlert = Array.from(this.activeAlerts.values()).find(
      existing => existing.type === alert.type && 
                 existing.contextId === alert.contextId &&
                 existing.sessionId === alert.sessionId
    );

    if (existingAlert) {
      return; // Don't duplicate alerts
    }

    this.activeAlerts.set(alert.alertId, alert);
    this.alertHistory.push(alert);

    if (this.config.enableRealTimeAlerts) {
      console.warn(`Context Alert [${alert.severity.toUpperCase()}]: ${alert.title}`, alert);
    }

    // Clean up old alerts
    this.cleanupOldAlerts();
  }

  private checkPerformanceThresholds(
    operation: string,
    executionTimeMs: number,
    contextId: string,
    sessionId: string
  ): void {
    let threshold: number;
    let alertType: ContextAlertType = 'performance_degradation';

    switch (operation) {
      case 'retrieval':
        threshold = this.config.alertThresholds.maxRetrievalTimeMs;
        break;
      case 'enhancement':
        threshold = this.config.alertThresholds.maxEnhancementTimeMs;
        break;
      default:
        return; // No threshold defined for this operation
    }

    if (executionTimeMs > threshold) {
      this.triggerAlert({
        type: alertType,
        severity: executionTimeMs > threshold * 2 ? 'high' : 'medium',
        title: `${operation} Performance Threshold Exceeded`,
        description: `${operation} operation took ${executionTimeMs}ms, exceeding threshold of ${threshold}ms`,
        contextId,
        sessionId,
        metrics: { [`${operation}TimeMs`]: executionTimeMs },
        threshold
      });
    }
  }

  private trackError(operation: string, contextId: string, sessionId: string, _errorMessage?: string): void {
    const errorKey = `${operation}:error`;
    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);

    const totalOperationsKey = `${operation}:total`;
    const totalOperations = this.errorCounts.get(totalOperationsKey) || 0;
    const errorRate = ((currentCount + 1) / (totalOperations + 1)) * 100;

    if (errorRate > this.config.alertThresholds.maxErrorRatePercent) {
      this.triggerAlert({
        type: 'error_rate_spike',
        severity: 'high',
        title: 'High Error Rate Detected',
        description: `Error rate for ${operation} (${errorRate.toFixed(1)}%) exceeds threshold (${this.config.alertThresholds.maxErrorRatePercent}%)`,
        contextId,
        sessionId,
        metrics: { errorRate },
        threshold: this.config.alertThresholds.maxErrorRatePercent
      });
    }
  }

  private updatePerformanceBaseline(operation: string, executionTimeMs: number): void {
    const currentBaseline = this.performanceBaselines.get(operation) || executionTimeMs;
    // Use exponential moving average to update baseline
    const alpha = 0.1; // Smoothing factor
    const newBaseline = alpha * executionTimeMs + (1 - alpha) * currentBaseline;
    this.performanceBaselines.set(operation, newBaseline);

    // Track total operations
    const totalKey = `${operation}:total`;
    const currentTotal = this.errorCounts.get(totalKey) || 0;
    this.errorCounts.set(totalKey, currentTotal + 1);
  }

  private performRoutineChecks(): void {
    // This would be expanded to perform periodic health checks
    console.log('Performing routine context monitoring checks...');
    
    // Check for memory leaks in the monitoring system itself
    const memoryUsage = process.memoryUsage();
    const heapUsedMb = memoryUsage.heapUsed / (1024 * 1024);
    
    if (heapUsedMb > 500) { // Example threshold
      console.warn(`High memory usage in monitoring system: ${heapUsedMb.toFixed(2)}MB`);
    }
  }

  private cleanupOldAlerts(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.alertRetentionDays);

    // Remove old alerts from history
    const filteredHistory = this.alertHistory.filter(alert => alert.timestamp >= cutoffDate);
    this.alertHistory.splice(0, this.alertHistory.length, ...filteredHistory);
  }

  private initializeBaselines(): void {
    // Initialize with reasonable defaults
    this.performanceBaselines.set('retrieval', 100);
    this.performanceBaselines.set('enhancement', 200);
    this.performanceBaselines.set('summarization', 500);
  }
}