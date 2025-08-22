/**
 * Export Monitoring Service
 * Comprehensive monitoring, metrics collection, and alerting for export operations
 * Production hardening for Story 4.5
 */

import { EventEmitter } from 'events';
import { ExportFormat } from '../../../../shared/types/nlp.types';

export interface ExportMetrics {
  totalExports: number;
  successfulExports: number;
  failedExports: number;
  averageProcessingTime: number;
  averageFileSize: number;
  exportsByFormat: Record<ExportFormat, number>;
  exportsByHour: Record<string, number>;
  errorsByType: Record<string, number>;
  memoryUsageStats: {
    average: number;
    peak: number;
    current: number;
  };
  performanceStats: {
    componentsPerSecond: number;
    throughputMBps: number;
    concurrentExports: number;
  };
}

export interface ExportEvent {
  type: 'export_started' | 'export_completed' | 'export_failed' | 'export_warning' | 'system_alert';
  timestamp: Date;
  sessionId: string;
  exportFormat?: ExportFormat;
  componentCount?: number;
  processingTime?: number;
  fileSize?: number;
  error?: string;
  memoryUsage?: number;
  metadata?: Record<string, any>;
}

export interface AlertThresholds {
  failureRate: number;           // Percentage (e.g., 10 = 10%)
  averageProcessingTime: number; // Milliseconds
  memoryUsage: number;          // Bytes
  diskUsage: number;            // Bytes
  concurrentExports: number;    // Number of concurrent exports
  errorCount: number;           // Number of errors in time window
  timeWindowMs: number;         // Time window for rate calculations
}

export interface Alert {
  id: string;
  type: 'error' | 'warning' | 'critical';
  title: string;
  description: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
  sessionId?: string;
  resolved: boolean;
  metadata?: Record<string, any>;
}

/**
 * Export Monitoring Service
 * Centralized monitoring and alerting for export operations
 */
export class ExportMonitoringService extends EventEmitter {
  private metrics: ExportMetrics;
  private events: ExportEvent[] = [];
  private alerts: Alert[] = [];
  private activeExports: Map<string, { startTime: Date; sessionId: string; format: ExportFormat }> = new Map();
  private thresholds: AlertThresholds;
  private maxEventHistory: number;

  constructor(thresholds?: Partial<AlertThresholds>, maxEventHistory: number = 10000) {
    super();
    
    this.maxEventHistory = maxEventHistory;
    this.thresholds = {
      failureRate: 20,                    // 20% failure rate threshold
      averageProcessingTime: 30000,       // 30 second processing time threshold
      memoryUsage: 1024 * 1024 * 1024,   // 1GB memory usage threshold
      diskUsage: 10 * 1024 * 1024 * 1024, // 10GB disk usage threshold
      concurrentExports: 10,               // 10 concurrent exports threshold
      errorCount: 10,                     // 10 errors in time window
      timeWindowMs: 300000,               // 5 minute time window
      ...thresholds
    };

    this.initializeMetrics();
    this.startPeriodicChecks();
  }

  /**
   * Initialize metrics with default values
   */
  private initializeMetrics(): void {
    this.metrics = {
      totalExports: 0,
      successfulExports: 0,
      failedExports: 0,
      averageProcessingTime: 0,
      averageFileSize: 0,
      exportsByFormat: {
        'json': 0,
        'csv': 0,
        'excel': 0,
        'pdf': 0
      },
      exportsByHour: {},
      errorsByType: {},
      memoryUsageStats: {
        average: 0,
        peak: 0,
        current: 0
      },
      performanceStats: {
        componentsPerSecond: 0,
        throughputMBps: 0,
        concurrentExports: 0
      }
    };
  }

  /**
   * Record export start event
   */
  recordExportStart(sessionId: string, exportFormat: ExportFormat, componentCount: number): void {
    const event: ExportEvent = {
      type: 'export_started',
      timestamp: new Date(),
      sessionId,
      exportFormat,
      componentCount,
      memoryUsage: process.memoryUsage().heapUsed
    };

    this.addEvent(event);
    this.activeExports.set(sessionId, {
      startTime: new Date(),
      sessionId,
      format: exportFormat
    });

    this.updateMetrics();
    this.emit('export_started', event);
  }

  /**
   * Record successful export completion
   */
  recordExportSuccess(
    sessionId: string,
    exportFormat: ExportFormat,
    componentCount: number,
    processingTime: number,
    fileSize: number
  ): void {
    const event: ExportEvent = {
      type: 'export_completed',
      timestamp: new Date(),
      sessionId,
      exportFormat,
      componentCount,
      processingTime,
      fileSize,
      memoryUsage: process.memoryUsage().heapUsed
    };

    this.addEvent(event);
    this.activeExports.delete(sessionId);
    
    // Update metrics
    this.metrics.totalExports++;
    this.metrics.successfulExports++;
    this.metrics.exportsByFormat[exportFormat]++;
    
    // Update averages
    this.updateAverageProcessingTime(processingTime);
    this.updateAverageFileSize(fileSize);
    
    // Update hourly stats
    this.updateHourlyStats();
    
    // Update performance stats
    this.updatePerformanceStats(componentCount, processingTime, fileSize);
    
    this.updateMetrics();
    this.emit('export_completed', event);
    
    // Check thresholds
    this.checkThresholds();
  }

  /**
   * Record export failure
   */
  recordExportFailure(
    sessionId: string,
    exportFormat: ExportFormat,
    error: string,
    componentCount?: number,
    processingTime?: number
  ): void {
    const event: ExportEvent = {
      type: 'export_failed',
      timestamp: new Date(),
      sessionId,
      exportFormat,
      componentCount,
      processingTime,
      error,
      memoryUsage: process.memoryUsage().heapUsed
    };

    this.addEvent(event);
    this.activeExports.delete(sessionId);
    
    // Update metrics
    this.metrics.totalExports++;
    this.metrics.failedExports++;
    
    // Update error statistics
    const errorType = this.categorizeError(error);
    this.metrics.errorsByType[errorType] = (this.metrics.errorsByType[errorType] || 0) + 1;
    
    this.updateMetrics();
    this.emit('export_failed', event);
    
    // Check thresholds
    this.checkThresholds();
    
    // Generate alert for failure
    this.generateAlert('error', 'Export Failed', `Export failed for session ${sessionId}: ${error}`, {
      sessionId,
      exportFormat,
      error
    });
  }

  /**
   * Record export warning
   */
  recordExportWarning(
    sessionId: string,
    warning: string,
    metadata?: Record<string, any>
  ): void {
    const event: ExportEvent = {
      type: 'export_warning',
      timestamp: new Date(),
      sessionId,
      error: warning,
      metadata,
      memoryUsage: process.memoryUsage().heapUsed
    };

    this.addEvent(event);
    this.emit('export_warning', event);
    
    // Generate alert for warning
    this.generateAlert('warning', 'Export Warning', warning, { sessionId, ...metadata });
  }

  /**
   * Get current metrics
   */
  getMetrics(): ExportMetrics {
    this.updateRealTimeMetrics();
    return { ...this.metrics };
  }

  /**
   * Get recent events
   */
  getRecentEvents(count: number = 100): ExportEvent[] {
    return this.events.slice(-count);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(count: number = 100): Alert[] {
    return this.alerts.slice(-count);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.emit('alert_resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Get export health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // Calculate failure rate
    const failureRate = this.metrics.totalExports > 0 
      ? (this.metrics.failedExports / this.metrics.totalExports) * 100 
      : 0;
    
    // Check various health indicators
    if (failureRate > this.thresholds.failureRate) {
      issues.push(`High failure rate: ${failureRate.toFixed(1)}%`);
      recommendations.push('Investigate recent export failures');
    }
    
    if (this.metrics.averageProcessingTime > this.thresholds.averageProcessingTime) {
      issues.push(`Slow processing: ${(this.metrics.averageProcessingTime / 1000).toFixed(1)}s average`);
      recommendations.push('Optimize export processing or use streaming for large datasets');
    }
    
    const memoryUsage = process.memoryUsage().heapUsed;
    if (memoryUsage > this.thresholds.memoryUsage) {
      issues.push(`High memory usage: ${(memoryUsage / 1024 / 1024).toFixed(1)}MB`);
      recommendations.push('Consider restarting service or optimizing memory usage');
    }
    
    const activeExportCount = this.activeExports.size;
    if (activeExportCount > this.thresholds.concurrentExports) {
      issues.push(`Too many concurrent exports: ${activeExportCount}`);
      recommendations.push('Implement export queue or increase rate limiting');
    }
    
    // Calculate health score
    let score = 100;
    score -= Math.min(failureRate * 2, 40); // Max 40 points for failure rate
    score -= Math.min((this.metrics.averageProcessingTime / 1000) / 10 * 10, 30); // Max 30 points for processing time
    score -= Math.min((memoryUsage / this.thresholds.memoryUsage) * 20, 20); // Max 20 points for memory
    score -= Math.min(activeExportCount / this.thresholds.concurrentExports * 10, 10); // Max 10 points for concurrency
    
    score = Math.max(score, 0);
    
    // Determine status
    let status: 'healthy' | 'warning' | 'critical';
    if (score >= 80) {
      status = 'healthy';
    } else if (score >= 60) {
      status = 'warning';
    } else {
      status = 'critical';
    }
    
    return {
      status,
      score: Math.round(score),
      issues,
      recommendations
    };
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): {
    summary: {
      totalExports: number;
      successRate: number;
      averageProcessingTime: number;
      averageFileSize: number;
      throughput: number;
    };
    trends: {
      hourlyExports: Record<string, number>;
      formatDistribution: Record<ExportFormat, number>;
      errorTrends: Record<string, number>;
    };
    recommendations: string[];
  } {
    const successRate = this.metrics.totalExports > 0 
      ? (this.metrics.successfulExports / this.metrics.totalExports) * 100 
      : 0;
    
    const throughput = this.metrics.performanceStats.componentsPerSecond;
    
    const recommendations: string[] = [];
    
    if (successRate < 95) {
      recommendations.push('Improve error handling and recovery mechanisms');
    }
    
    if (this.metrics.averageProcessingTime > 10000) {
      recommendations.push('Consider implementing streaming for large exports');
    }
    
    if (throughput < 100) {
      recommendations.push('Optimize component processing algorithms');
    }
    
    // Find most common error
    const mostCommonError = Object.entries(this.metrics.errorsByType)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (mostCommonError && mostCommonError[1] > 5) {
      recommendations.push(`Address frequent ${mostCommonError[0]} errors`);
    }
    
    return {
      summary: {
        totalExports: this.metrics.totalExports,
        successRate: Math.round(successRate * 100) / 100,
        averageProcessingTime: Math.round(this.metrics.averageProcessingTime),
        averageFileSize: Math.round(this.metrics.averageFileSize),
        throughput: Math.round(throughput)
      },
      trends: {
        hourlyExports: { ...this.metrics.exportsByHour },
        formatDistribution: { ...this.metrics.exportsByFormat },
        errorTrends: { ...this.metrics.errorsByType }
      },
      recommendations
    };
  }

  /**
   * Add event to history
   */
  private addEvent(event: ExportEvent): void {
    this.events.push(event);
    
    // Maintain event history size
    if (this.events.length > this.maxEventHistory) {
      this.events = this.events.slice(-this.maxEventHistory);
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    // Update concurrent exports count
    this.metrics.performanceStats.concurrentExports = this.activeExports.size;
    
    // Update memory stats
    const memUsage = process.memoryUsage().heapUsed;
    this.metrics.memoryUsageStats.current = memUsage;
    this.metrics.memoryUsageStats.peak = Math.max(this.metrics.memoryUsageStats.peak, memUsage);
    
    // Calculate average memory usage from recent events
    const recentEvents = this.events.slice(-100);
    const memoryReadings = recentEvents
      .filter(e => e.memoryUsage)
      .map(e => e.memoryUsage!);
    
    if (memoryReadings.length > 0) {
      this.metrics.memoryUsageStats.average = 
        memoryReadings.reduce((sum, val) => sum + val, 0) / memoryReadings.length;
    }
  }

  /**
   * Update real-time metrics
   */
  private updateRealTimeMetrics(): void {
    this.updateMetrics();
  }

  /**
   * Update average processing time
   */
  private updateAverageProcessingTime(processingTime: number): void {
    const count = this.metrics.successfulExports;
    const currentAvg = this.metrics.averageProcessingTime;
    this.metrics.averageProcessingTime = 
      ((currentAvg * (count - 1)) + processingTime) / count;
  }

  /**
   * Update average file size
   */
  private updateAverageFileSize(fileSize: number): void {
    const count = this.metrics.successfulExports;
    const currentAvg = this.metrics.averageFileSize;
    this.metrics.averageFileSize = 
      ((currentAvg * (count - 1)) + fileSize) / count;
  }

  /**
   * Update hourly statistics
   */
  private updateHourlyStats(): void {
    const hour = new Date().toISOString().substring(0, 13); // YYYY-MM-DDTHH
    this.metrics.exportsByHour[hour] = (this.metrics.exportsByHour[hour] || 0) + 1;
  }

  /**
   * Update performance statistics
   */
  private updatePerformanceStats(componentCount: number, processingTime: number, fileSize: number): void {
    // Calculate components per second
    const componentsPerSecond = (componentCount / processingTime) * 1000;
    
    // Calculate throughput in MB/s
    const throughputMBps = (fileSize / processingTime) * 1000 / (1024 * 1024);
    
    // Update running averages
    const exportCount = this.metrics.successfulExports;
    this.metrics.performanceStats.componentsPerSecond = 
      ((this.metrics.performanceStats.componentsPerSecond * (exportCount - 1)) + componentsPerSecond) / exportCount;
    
    this.metrics.performanceStats.throughputMBps = 
      ((this.metrics.performanceStats.throughputMBps * (exportCount - 1)) + throughputMBps) / exportCount;
  }

  /**
   * Categorize error for statistics
   */
  private categorizeError(error: string): string {
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('memory') || errorLower.includes('heap')) {
      return 'memory_error';
    } else if (errorLower.includes('permission') || errorLower.includes('access')) {
      return 'permission_error';
    } else if (errorLower.includes('disk') || errorLower.includes('space')) {
      return 'disk_error';
    } else if (errorLower.includes('timeout') || errorLower.includes('time')) {
      return 'timeout_error';
    } else if (errorLower.includes('database') || errorLower.includes('connection')) {
      return 'database_error';
    } else if (errorLower.includes('network')) {
      return 'network_error';
    } else {
      return 'unknown_error';
    }
  }

  /**
   * Generate alert
   */
  private generateAlert(
    type: 'error' | 'warning' | 'critical',
    title: string,
    description: string,
    metadata?: Record<string, any>
  ): void {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      description,
      threshold: 0,
      currentValue: 0,
      timestamp: new Date(),
      resolved: false,
      metadata
    };

    this.alerts.push(alert);
    this.emit('alert_generated', alert);
    
    // Auto-resolve warnings after 1 hour
    if (type === 'warning') {
      setTimeout(() => {
        if (!alert.resolved) {
          this.resolveAlert(alert.id);
        }
      }, 3600000); // 1 hour
    }
  }

  /**
   * Check thresholds and generate alerts
   */
  private checkThresholds(): void {
    // Check failure rate
    if (this.metrics.totalExports >= 10) { // Only check after 10 exports
      const failureRate = (this.metrics.failedExports / this.metrics.totalExports) * 100;
      if (failureRate > this.thresholds.failureRate) {
        this.generateAlert(
          'critical',
          'High Failure Rate',
          `Export failure rate is ${failureRate.toFixed(1)}% (threshold: ${this.thresholds.failureRate}%)`,
          { failureRate, threshold: this.thresholds.failureRate }
        );
      }
    }

    // Check processing time
    if (this.metrics.averageProcessingTime > this.thresholds.averageProcessingTime) {
      this.generateAlert(
        'warning',
        'Slow Processing Time',
        `Average processing time is ${(this.metrics.averageProcessingTime / 1000).toFixed(1)}s (threshold: ${(this.thresholds.averageProcessingTime / 1000).toFixed(1)}s)`,
        { processingTime: this.metrics.averageProcessingTime, threshold: this.thresholds.averageProcessingTime }
      );
    }

    // Check concurrent exports
    if (this.activeExports.size > this.thresholds.concurrentExports) {
      this.generateAlert(
        'warning',
        'High Concurrent Exports',
        `${this.activeExports.size} concurrent exports running (threshold: ${this.thresholds.concurrentExports})`,
        { concurrentExports: this.activeExports.size, threshold: this.thresholds.concurrentExports }
      );
    }
  }

  /**
   * Start periodic threshold checks
   */
  private startPeriodicChecks(): void {
    setInterval(() => {
      this.checkThresholds();
      this.updateMetrics();
    }, 30000); // Check every 30 seconds
    
    // Cleanup old events and alerts periodically
    setInterval(() => {
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      // Remove old events
      this.events = this.events.filter(e => e.timestamp > cutoffTime);
      
      // Remove old resolved alerts
      this.alerts = this.alerts.filter(a => 
        !a.resolved || a.timestamp > cutoffTime
      );
    }, 3600000); // Cleanup every hour
  }
}