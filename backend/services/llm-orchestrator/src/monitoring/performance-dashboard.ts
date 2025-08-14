/**
 * Performance Dashboard
 * 
 * Real-time performance monitoring dashboard for Symbol Detection Engine
 * Provides live metrics, alerts, and performance insights
 */

import { EventEmitter } from 'events';
import { ProductionPerformanceValidator, ValidationResult } from './production-performance-validator';
import { SymbolDetectionPerformanceMonitor, PerformanceMetrics } from './symbol-detection-performance.monitor';
import * as os from 'os';

export interface DashboardMetrics {
  timestamp: Date;
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkLatency: number;
  };
  detection: {
    activeJobs: number;
    queueLength: number;
    processingRate: number;
    averageTime: number;
    successRate: number;
  };
  performance: {
    ac9Status: 'pass' | 'warning' | 'fail';
    ac8Status: 'pass' | 'warning' | 'fail';
    throughput: number;
    latency: number;
    errorRate: number;
  };
  alerts: Alert[];
}

export interface Alert {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: 'performance' | 'accuracy' | 'system' | 'compliance';
  message: string;
  metadata?: any;
}

export interface PerformanceChart {
  name: string;
  type: 'line' | 'bar' | 'gauge' | 'heatmap';
  data: ChartData[];
  thresholds?: {
    warning: number;
    critical: number;
  };
}

export interface ChartData {
  timestamp: Date;
  value: number;
  label?: string;
}

export class PerformanceDashboard extends EventEmitter {
  private validator: ProductionPerformanceValidator;
  private monitor: SymbolDetectionPerformanceMonitor;
  private metrics: DashboardMetrics[] = [];
  private alerts: Alert[] = [];
  private charts: Map<string, PerformanceChart> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly MAX_METRICS_HISTORY = 1000;
  private readonly MAX_ALERTS = 100;

  constructor(
    validator: ProductionPerformanceValidator,
    monitor: SymbolDetectionPerformanceMonitor
  ) {
    super();
    this.validator = validator;
    this.monitor = monitor;
    
    this.initializeCharts();
    this.setupEventListeners();
    this.startMetricsCollection();
  }

  /**
   * Get current dashboard snapshot
   */
  getCurrentSnapshot(): {
    metrics: DashboardMetrics;
    charts: PerformanceChart[];
    alerts: Alert[];
    compliance: {
      ac9: boolean;
      ac8: boolean;
      productionReady: boolean;
    };
    recommendations: string[];
  } {
    const currentMetrics = this.metrics[this.metrics.length - 1] || this.createDefaultMetrics();
    const readiness = this.validator.getProductionReadiness();
    
    return {
      metrics: currentMetrics,
      charts: Array.from(this.charts.values()),
      alerts: this.alerts.slice(-10), // Last 10 alerts
      compliance: {
        ac9: readiness.status.ac9Compliance,
        ac8: readiness.status.ac8Compliance,
        productionReady: readiness.ready,
      },
      recommendations: readiness.recommendations,
    };
  }

  /**
   * Get real-time performance summary
   */
  getPerformanceSummary(): {
    status: 'optimal' | 'acceptable' | 'degraded' | 'critical';
    score: number;
    metrics: {
      avgProcessingTime: number;
      avgAccuracy: number;
      throughput: number;
      uptime: number;
    };
    trends: {
      processing: 'improving' | 'stable' | 'degrading';
      accuracy: 'improving' | 'stable' | 'degrading';
      throughput: 'improving' | 'stable' | 'degrading';
    };
  } {
    const recentMetrics = this.metrics.slice(-100);
    
    if (recentMetrics.length === 0) {
      return {
        status: 'critical',
        score: 0,
        metrics: {
          avgProcessingTime: 0,
          avgAccuracy: 0,
          throughput: 0,
          uptime: 0,
        },
        trends: {
          processing: 'stable',
          accuracy: 'stable',
          throughput: 'stable',
        },
      };
    }
    
    // Calculate averages
    const avgProcessingTime = recentMetrics.reduce((sum, m) => sum + m.detection.averageTime, 0) / recentMetrics.length;
    const avgAccuracy = recentMetrics.reduce((sum, m) => sum + m.detection.successRate, 0) / recentMetrics.length;
    const avgThroughput = recentMetrics.reduce((sum, m) => sum + m.performance.throughput, 0) / recentMetrics.length;
    
    // Determine status
    let status: 'optimal' | 'acceptable' | 'degraded' | 'critical';
    let score = 100;
    
    if (avgProcessingTime > 30000) {
      status = 'critical';
      score -= 40;
    } else if (avgProcessingTime > 25000) {
      status = 'degraded';
      score -= 20;
    } else if (avgProcessingTime > 20000) {
      status = 'acceptable';
      score -= 10;
    } else {
      status = 'optimal';
    }
    
    if (avgAccuracy < 0.9) {
      score -= 30;
      if (status !== 'critical') {
        status = avgAccuracy < 0.8 ? 'critical' : 'degraded';
      }
    }
    
    // Calculate trends
    const trends = this.calculateTrends(recentMetrics);
    
    return {
      status,
      score: Math.max(0, score),
      metrics: {
        avgProcessingTime,
        avgAccuracy,
        throughput: avgThroughput,
        uptime: process.uptime(),
      },
      trends,
    };
  }

  /**
   * Generate HTML dashboard
   */
  generateHTMLDashboard(): string {
    const snapshot = this.getCurrentSnapshot();
    const summary = this.getPerformanceSummary();
    
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Symbol Detection Performance Dashboard</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f1419;
      color: #e1e8ed;
      padding: 20px;
    }
    .dashboard {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
    }
    h1 {
      font-size: 2em;
      margin-bottom: 10px;
    }
    .status {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      margin-top: 10px;
    }
    .status.optimal { background: #00a67e; }
    .status.acceptable { background: #1da1f2; }
    .status.degraded { background: #ffad1f; color: #0f1419; }
    .status.critical { background: #e0245e; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .card {
      background: #192734;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #38444d;
    }
    .card h3 {
      font-size: 0.9em;
      color: #8899a6;
      text-transform: uppercase;
      margin-bottom: 15px;
    }
    .metric {
      font-size: 2.5em;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .metric.pass { color: #00a67e; }
    .metric.warning { color: #ffad1f; }
    .metric.fail { color: #e0245e; }
    .label {
      color: #8899a6;
      font-size: 0.9em;
    }
    .chart {
      background: #192734;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      border: 1px solid #38444d;
    }
    .progress-bar {
      width: 100%;
      height: 30px;
      background: #253341;
      border-radius: 15px;
      overflow: hidden;
      position: relative;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #00a67e 0%, #1da1f2 100%);
      transition: width 0.3s ease;
    }
    .alerts {
      background: #192734;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #38444d;
    }
    .alert {
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
    }
    .alert.info { background: #1da1f233; border-left: 4px solid #1da1f2; }
    .alert.warning { background: #ffad1f33; border-left: 4px solid #ffad1f; }
    .alert.error { background: #e0245e33; border-left: 4px solid #e0245e; }
    .alert.critical {
      background: #e0245e;
      color: white;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.8; }
    }
    .compliance {
      display: flex;
      gap: 20px;
      margin-bottom: 30px;
    }
    .compliance-item {
      flex: 1;
      background: #192734;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      border: 1px solid #38444d;
    }
    .compliance-icon {
      font-size: 3em;
      margin-bottom: 10px;
    }
    .recommendations {
      background: #253341;
      border-radius: 12px;
      padding: 20px;
      margin-top: 30px;
    }
    .recommendations ul {
      list-style: none;
      padding-left: 0;
    }
    .recommendations li {
      padding: 10px 0;
      border-bottom: 1px solid #38444d;
    }
    .recommendations li:last-child {
      border-bottom: none;
    }
    .trend {
      display: inline-block;
      margin-left: 10px;
      font-size: 0.9em;
    }
    .trend.up { color: #00a67e; }
    .trend.down { color: #e0245e; }
    .trend.stable { color: #8899a6; }
  </style>
</head>
<body>
  <div class="dashboard">
    <div class="header">
      <h1>Symbol Detection Performance Dashboard</h1>
      <div>Real-time Performance Monitoring</div>
      <div class="status ${summary.status}">${summary.status.toUpperCase()}</div>
    </div>
    
    <div class="compliance">
      <div class="compliance-item">
        <div class="compliance-icon">${snapshot.compliance.ac9 ? '✅' : '❌'}</div>
        <h3>AC #9: Processing Time</h3>
        <div class="label">${snapshot.compliance.ac9 ? 'Compliant (<30s)' : 'Non-Compliant (>30s)'}</div>
      </div>
      <div class="compliance-item">
        <div class="compliance-icon">${snapshot.compliance.ac8 ? '✅' : '❌'}</div>
        <h3>AC #8: Accuracy</h3>
        <div class="label">${snapshot.compliance.ac8 ? 'Compliant (>90%)' : 'Non-Compliant (<90%)'}</div>
      </div>
      <div class="compliance-item">
        <div class="compliance-icon">${snapshot.compliance.productionReady ? '🚀' : '⚠️'}</div>
        <h3>Production Ready</h3>
        <div class="label">${snapshot.compliance.productionReady ? 'Ready for Deployment' : 'Requires Optimization'}</div>
      </div>
    </div>
    
    <div class="grid">
      <div class="card">
        <h3>Processing Time</h3>
        <div class="metric ${this.getMetricClass(summary.metrics.avgProcessingTime, 30000, 25000)}">
          ${(summary.metrics.avgProcessingTime / 1000).toFixed(1)}s
        </div>
        <div class="label">Average</div>
        <span class="trend ${this.getTrendClass(summary.trends.processing)}">
          ${this.getTrendIcon(summary.trends.processing)} ${summary.trends.processing}
        </span>
      </div>
      
      <div class="card">
        <h3>Accuracy</h3>
        <div class="metric ${this.getMetricClass(summary.metrics.avgAccuracy, 0.8, 0.9, true)}">
          ${(summary.metrics.avgAccuracy * 100).toFixed(1)}%
        </div>
        <div class="label">Detection Rate</div>
        <span class="trend ${this.getTrendClass(summary.trends.accuracy)}">
          ${this.getTrendIcon(summary.trends.accuracy)} ${summary.trends.accuracy}
        </span>
      </div>
      
      <div class="card">
        <h3>Throughput</h3>
        <div class="metric">
          ${summary.metrics.throughput.toFixed(1)}
        </div>
        <div class="label">Symbols/sec</div>
        <span class="trend ${this.getTrendClass(summary.trends.throughput)}">
          ${this.getTrendIcon(summary.trends.throughput)} ${summary.trends.throughput}
        </span>
      </div>
      
      <div class="card">
        <h3>System Load</h3>
        <div class="metric">
          ${snapshot.metrics.system.cpuUsage.toFixed(1)}%
        </div>
        <div class="label">CPU Usage</div>
        <div class="progress-bar" style="margin-top: 10px;">
          <div class="progress-fill" style="width: ${snapshot.metrics.system.cpuUsage}%"></div>
        </div>
      </div>
      
      <div class="card">
        <h3>Memory Usage</h3>
        <div class="metric">
          ${(snapshot.metrics.system.memoryUsage / 1024).toFixed(1)}GB
        </div>
        <div class="label">Heap Used</div>
        <div class="progress-bar" style="margin-top: 10px;">
          <div class="progress-fill" style="width: ${(snapshot.metrics.system.memoryUsage / 4096) * 100}%"></div>
        </div>
      </div>
      
      <div class="card">
        <h3>Performance Score</h3>
        <div class="metric ${this.getScoreClass(summary.score)}">
          ${summary.score}/100
        </div>
        <div class="label">Overall Health</div>
        <div class="progress-bar" style="margin-top: 10px;">
          <div class="progress-fill" style="width: ${summary.score}%"></div>
        </div>
      </div>
    </div>
    
    ${snapshot.alerts.length > 0 ? `
    <div class="alerts">
      <h3>Recent Alerts</h3>
      ${snapshot.alerts.map(alert => `
        <div class="alert ${alert.severity}">
          <div>
            <strong>${alert.category.toUpperCase()}</strong>: ${alert.message}
            <div style="font-size: 0.8em; color: #8899a6; margin-top: 5px;">
              ${new Date(alert.timestamp).toLocaleString()}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}
    
    ${snapshot.recommendations.length > 0 ? `
    <div class="recommendations">
      <h3>Recommendations</h3>
      <ul>
        ${snapshot.recommendations.map(rec => `<li>• ${rec}</li>`).join('')}
      </ul>
    </div>
    ` : ''}
    
    <div style="text-align: center; margin-top: 40px; color: #8899a6;">
      Last Updated: ${new Date().toLocaleString()} | Uptime: ${this.formatUptime(summary.metrics.uptime)}
    </div>
  </div>
  
  <script>
    // Auto-refresh every 5 seconds
    setTimeout(() => location.reload(), 5000);
  </script>
</body>
</html>
    `;
  }

  /**
   * Export performance data as JSON
   */
  exportPerformanceData(): {
    exportDate: Date;
    summary: any;
    metrics: DashboardMetrics[];
    alerts: Alert[];
    charts: any[];
    report: string;
  } {
    return {
      exportDate: new Date(),
      summary: this.getPerformanceSummary(),
      metrics: this.metrics.slice(-1000), // Last 1000 metrics
      alerts: this.alerts,
      charts: Array.from(this.charts.values()),
      report: this.validator.generatePerformanceReport(),
    };
  }

  /**
   * Stop dashboard monitoring
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.removeAllListeners();
    console.log('Performance dashboard stopped');
  }

  // Private helper methods

  private initializeCharts(): void {
    // Processing time chart
    this.charts.set('processing-time', {
      name: 'Processing Time',
      type: 'line',
      data: [],
      thresholds: {
        warning: 25000,
        critical: 30000,
      },
    });
    
    // Accuracy chart
    this.charts.set('accuracy', {
      name: 'Detection Accuracy',
      type: 'line',
      data: [],
      thresholds: {
        warning: 0.85,
        critical: 0.80,
      },
    });
    
    // Throughput chart
    this.charts.set('throughput', {
      name: 'Symbol Throughput',
      type: 'line',
      data: [],
    });
    
    // Memory usage chart
    this.charts.set('memory', {
      name: 'Memory Usage',
      type: 'line',
      data: [],
      thresholds: {
        warning: 1536,
        critical: 2048,
      },
    });
    
    // System load chart
    this.charts.set('cpu', {
      name: 'CPU Usage',
      type: 'gauge',
      data: [],
      thresholds: {
        warning: 70,
        critical: 90,
      },
    });
  }

  private setupEventListeners(): void {
    // Listen to validator events
    this.validator.on('validation-passed', (result: ValidationResult) => {
      this.addAlert({
        id: `val-${Date.now()}`,
        timestamp: new Date(),
        severity: 'info',
        category: 'performance',
        message: `Validation passed with score ${result.performanceScore}/100`,
        metadata: result,
      });
    });
    
    this.validator.on('validation-failed', (result: ValidationResult) => {
      this.addAlert({
        id: `val-${Date.now()}`,
        timestamp: new Date(),
        severity: result.violations.some(v => v.severity === 'critical') ? 'critical' : 'warning',
        category: 'compliance',
        message: `Validation failed: ${result.violations.map(v => v.type).join(', ')}`,
        metadata: result,
      });
    });
    
    // Listen to monitor events
    this.monitor.on('performance-update', (data: any) => {
      this.updateCharts(data.metrics);
    });
    
    this.monitor.on('performance-violation', (data: any) => {
      this.addAlert({
        id: `perf-${Date.now()}`,
        timestamp: new Date(),
        severity: 'warning',
        category: 'performance',
        message: `Performance violation detected: ${data.violations.map((v: any) => v.metric).join(', ')}`,
        metadata: data,
      });
    });
    
    this.monitor.on('memory-warning', (data: any) => {
      this.addAlert({
        id: `mem-${Date.now()}`,
        timestamp: new Date(),
        severity: 'warning',
        category: 'system',
        message: `High memory usage: ${data.current.toFixed(0)}MB (threshold: ${data.threshold}MB)`,
        metadata: data,
      });
    });
  }

  private startMetricsCollection(): void {
    // Update metrics every 1 second
    this.updateInterval = setInterval(() => {
      this.collectMetrics();
    }, 1000);
    
    // Initial collection
    this.collectMetrics();
  }

  private collectMetrics(): void {
    const stats = this.monitor.getPerformanceStats();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const metrics: DashboardMetrics = {
      timestamp: new Date(),
      system: {
        cpuUsage: this.calculateCPUPercentage(cpuUsage),
        memoryUsage: memUsage.heapUsed / 1024 / 1024,
        diskUsage: 0, // Would need actual disk monitoring
        networkLatency: 0, // Would need actual network monitoring
      },
      detection: {
        activeJobs: stats.session.totalProcessed,
        queueLength: 0, // Would need queue integration
        processingRate: stats.session.totalProcessed / ((Date.now() - stats.session.startTime) / 1000),
        averageTime: stats.average.totalProcessingTime || 0,
        successRate: 1 - stats.session.errors / Math.max(1, stats.session.totalProcessed),
      },
      performance: {
        ac9Status: this.getComplianceStatus(stats.average.totalProcessingTime || 0, 30000, 25000),
        ac8Status: this.getComplianceStatus(stats.average.accuracy || 0, 0.85, 0.90, true),
        throughput: stats.average.throughput || 0,
        latency: stats.average.totalProcessingTime || 0,
        errorRate: stats.session.errors / Math.max(1, stats.session.totalProcessed),
      },
      alerts: [...this.alerts],
    };
    
    this.addMetrics(metrics);
    this.emit('metrics-update', metrics);
  }

  private addMetrics(metrics: DashboardMetrics): void {
    this.metrics.push(metrics);
    
    // Maintain history limit
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics.shift();
    }
  }

  private addAlert(alert: Alert): void {
    this.alerts.push(alert);
    
    // Maintain alert limit
    if (this.alerts.length > this.MAX_ALERTS) {
      this.alerts.shift();
    }
    
    this.emit('alert', alert);
  }

  private updateCharts(metrics: PerformanceMetrics): void {
    const timestamp = new Date();
    
    // Update processing time chart
    const processingChart = this.charts.get('processing-time');
    if (processingChart) {
      processingChart.data.push({
        timestamp,
        value: metrics.totalProcessingTime,
      });
      
      // Keep last 100 points
      if (processingChart.data.length > 100) {
        processingChart.data.shift();
      }
    }
    
    // Update accuracy chart
    const accuracyChart = this.charts.get('accuracy');
    if (accuracyChart) {
      accuracyChart.data.push({
        timestamp,
        value: metrics.accuracy,
      });
      
      if (accuracyChart.data.length > 100) {
        accuracyChart.data.shift();
      }
    }
    
    // Update throughput chart
    const throughputChart = this.charts.get('throughput');
    if (throughputChart) {
      throughputChart.data.push({
        timestamp,
        value: metrics.throughput,
      });
      
      if (throughputChart.data.length > 100) {
        throughputChart.data.shift();
      }
    }
    
    // Update memory chart
    const memoryChart = this.charts.get('memory');
    if (memoryChart) {
      memoryChart.data.push({
        timestamp,
        value: metrics.memoryUsage.heapUsed / 1024 / 1024,
      });
      
      if (memoryChart.data.length > 100) {
        memoryChart.data.shift();
      }
    }
  }

  private calculateCPUPercentage(cpuUsage: NodeJS.CpuUsage): number {
    const totalTime = cpuUsage.user + cpuUsage.system;
    const elapsedTime = process.uptime() * 1000000; // Convert to microseconds
    return Math.min(100, (totalTime / elapsedTime) * 100);
  }

  private calculateTrends(metrics: DashboardMetrics[]): {
    processing: 'improving' | 'stable' | 'degrading';
    accuracy: 'improving' | 'stable' | 'degrading';
    throughput: 'improving' | 'stable' | 'degrading';
  } {
    if (metrics.length < 20) {
      return {
        processing: 'stable',
        accuracy: 'stable',
        throughput: 'stable',
      };
    }
    
    const recent = metrics.slice(-10);
    const older = metrics.slice(-20, -10);
    
    const recentAvgTime = recent.reduce((sum, m) => sum + m.detection.averageTime, 0) / recent.length;
    const olderAvgTime = older.reduce((sum, m) => sum + m.detection.averageTime, 0) / older.length;
    
    const recentAvgAccuracy = recent.reduce((sum, m) => sum + m.detection.successRate, 0) / recent.length;
    const olderAvgAccuracy = older.reduce((sum, m) => sum + m.detection.successRate, 0) / older.length;
    
    const recentAvgThroughput = recent.reduce((sum, m) => sum + m.performance.throughput, 0) / recent.length;
    const olderAvgThroughput = older.reduce((sum, m) => sum + m.performance.throughput, 0) / older.length;
    
    return {
      processing: recentAvgTime < olderAvgTime * 0.95 ? 'improving' :
                 recentAvgTime > olderAvgTime * 1.05 ? 'degrading' : 'stable',
      accuracy: recentAvgAccuracy > olderAvgAccuracy * 1.02 ? 'improving' :
               recentAvgAccuracy < olderAvgAccuracy * 0.98 ? 'degrading' : 'stable',
      throughput: recentAvgThroughput > olderAvgThroughput * 1.05 ? 'improving' :
                 recentAvgThroughput < olderAvgThroughput * 0.95 ? 'degrading' : 'stable',
    };
  }

  private getComplianceStatus(value: number, failThreshold: number, warnThreshold: number, inverse: boolean = false): 'pass' | 'warning' | 'fail' {
    if (inverse) {
      if (value >= warnThreshold) return 'pass';
      if (value >= failThreshold) return 'warning';
      return 'fail';
    } else {
      if (value <= warnThreshold) return 'pass';
      if (value <= failThreshold) return 'warning';
      return 'fail';
    }
  }

  private createDefaultMetrics(): DashboardMetrics {
    return {
      timestamp: new Date(),
      system: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkLatency: 0,
      },
      detection: {
        activeJobs: 0,
        queueLength: 0,
        processingRate: 0,
        averageTime: 0,
        successRate: 0,
      },
      performance: {
        ac9Status: 'fail',
        ac8Status: 'fail',
        throughput: 0,
        latency: 0,
        errorRate: 0,
      },
      alerts: [],
    };
  }

  private getMetricClass(value: number, failThreshold: number, warnThreshold: number, inverse: boolean = false): string {
    if (inverse) {
      if (value >= warnThreshold) return 'pass';
      if (value >= failThreshold) return 'warning';
      return 'fail';
    } else {
      if (value <= warnThreshold) return 'pass';
      if (value <= failThreshold) return 'warning';
      return 'fail';
    }
  }

  private getScoreClass(score: number): string {
    if (score >= 80) return 'pass';
    if (score >= 60) return 'warning';
    return 'fail';
  }

  private getTrendClass(trend: 'improving' | 'stable' | 'degrading'): string {
    switch (trend) {
      case 'improving': return 'up';
      case 'degrading': return 'down';
      default: return 'stable';
    }
  }

  private getTrendIcon(trend: 'improving' | 'stable' | 'degrading'): string {
    switch (trend) {
      case 'improving': return '↑';
      case 'degrading': return '↓';
      default: return '→';
    }
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }
}