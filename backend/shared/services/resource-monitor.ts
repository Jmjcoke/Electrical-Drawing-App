import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as os from 'os';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createClient, RedisClientType } from 'redis';
import v8 from 'v8';

/**
 * Resource type enumeration
 */
export enum ResourceType {
  CPU = 'cpu',
  MEMORY = 'memory',
  DISK_IO = 'disk_io',
  NETWORK_IO = 'network_io',
  FILESYSTEM = 'filesystem',
  CACHE = 'cache',
  DATABASE = 'database',
}

/**
 * Resource usage level
 */
export enum ResourceUsageLevel {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Resource metric
 */
export interface ResourceMetric {
  timestamp: number;
  resourceType: ResourceType;
  name: string;
  value: number;
  unit: string;
  level: ResourceUsageLevel;
  metadata: Record<string, any>;
}

/**
 * Resource usage statistics
 */
export interface ResourceUsageStats {
  timestamp: number;
  duration: number; // seconds
  cpu: {
    usage: number; // percentage
    user: number;
    system: number;
    idle: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    used: number; // bytes
    total: number; // bytes
    usage: number; // percentage
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  diskIO: {
    readBytes: number;
    writeBytes: number;
    readOps: number;
    writeOps: number;
    queueLength: number;
  };
  networkIO: {
    rxBytes: number;
    txBytes: number;
    rxPackets: number;
    txPackets: number;
  };
  filesystem: {
    total: number;
    used: number;
    available: number;
    usage: number; // percentage
  };
  cache: {
    hitRate: number;
    missRate: number;
    size: number;
    evictions: number;
  };
  database: {
    connections: number;
    activeConnections: number;
    queryCount: number;
    slowQueries: number;
  };
}

/**
 * Resource threshold configuration
 */
export interface ResourceThresholds {
  [ResourceType.CPU]: {
    warning: number; // percentage
    critical: number; // percentage
    sustained: number; // minutes
  };
  [ResourceType.MEMORY]: {
    warning: number; // percentage
    critical: number; // percentage
    sustained: number; // minutes
  };
  [ResourceType.DISK_IO]: {
    warning: number; // IOPS
    critical: number; // IOPS
    sustained: number; // minutes
  };
  [ResourceType.NETWORK_IO]: {
    warning: number; // MB/s
    critical: number; // MB/s
    sustained: number; // minutes
  };
  [ResourceType.FILESYSTEM]: {
    warning: number; // percentage
    critical: number; // percentage
  };
  [ResourceType.CACHE]: {
    warning: number; // hit rate percentage
    critical: number; // hit rate percentage
  };
  [ResourceType.DATABASE]: {
    warning: number; // active connections
    critical: number; // active connections
  };
}

/**
 * Resource alert
 */
export interface ResourceAlert {
  id: string;
  timestamp: number;
  resourceType: ResourceType;
  severity: 'warning' | 'critical';
  message: string;
  currentValue: number;
  threshold: number;
  unit: string;
  sustained: boolean;
  recommendations: string[];
}

/**
 * Resource prediction
 */
export interface ResourcePrediction {
  resourceType: ResourceType;
  timestamp: number;
  predictedValue: number;
  confidence: number; // 0-1
  timeHorizon: number; // minutes
  trend: 'increasing' | 'decreasing' | 'stable';
  projectedThresholdBreach: {
    timeToBreach: number; // minutes
    severity: 'warning' | 'critical';
  } | null;
}

/**
 * Resource optimization recommendation
 */
export interface ResourceOptimization {
  resourceType: ResourceType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
  expectedImprovement: number; // percentage
  implementationEffort: 'low' | 'medium' | 'high';
  automated: boolean;
  metadata: Record<string, any>;
}

/**
 * Resource monitor configuration
 */
export interface ResourceMonitorConfig {
  redisUrl: string;
  monitoringInterval: number; // seconds
  retentionPeriod: number; // hours
  predictionEnabled: boolean;
  predictionInterval: number; // minutes
  thresholds: ResourceThresholds;
  alertCooldownPeriod: number; // minutes
  enableDetailedMetrics: boolean;
}

/**
 * Resource usage monitor
 */
export class ResourceMonitor extends EventEmitter {
  private redis: RedisClientType | null = null;
  private config: ResourceMonitorConfig;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private predictionTimer: NodeJS.Timeout | null = null;
  private activeAlerts: Map<string, ResourceAlert> = new Map();
  private resourceHistory: Map<ResourceType, ResourceMetric[]> = new Map();
  private alertCooldowns: Map<string, number> = new Map();

  // Previous measurements for rate calculations
  private previousCpuUsage: NodeJS.CpuUsage | null = null;
  private previousDiskStats: any = null;
  private previousNetworkStats: any = null;

  constructor(config: ResourceMonitorConfig) {
    super();
    this.config = config;
    this.initializeRedis();
    this.startMonitoring();
    this.initializeResourceHistory();
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
   * Initialize resource history maps
   */
  private initializeResourceHistory(): void {
    Object.values(ResourceType).forEach(resourceType => {
      this.resourceHistory.set(resourceType, []);
    });
  }

  /**
   * Start monitoring resources
   */
  private startMonitoring(): void {
    this.monitoringTimer = setInterval(async () => {
      try {
        await this.collectResourceMetrics();
        await this.checkThresholds();
        await this.updateHistory();
      } catch (error) {
        this.emit('monitoringError', error);
      }
    }, this.config.monitoringInterval * 1000);

    if (this.config.predictionEnabled) {
      this.predictionTimer = setInterval(async () => {
        try {
          await this.generatePredictions();
        } catch (error) {
          this.emit('predictionError', error);
        }
      }, this.config.predictionInterval * 60 * 1000);
    }
  }

  /**
   * Collect comprehensive resource metrics
   */
  private async collectResourceMetrics(): Promise<ResourceUsageStats> {
    const timestamp = Date.now();

    // CPU metrics
    const cpuUsage = process.cpuUsage(this.previousCpuUsage || undefined);
    const loadAverage = os.loadavg();
    const cpuStats = {
      usage: ((cpuUsage.user + cpuUsage.system) / 1000000) / os.cpus().length * 100,
      user: cpuUsage.user / 1000000,
      system: cpuUsage.system / 1000000,
      idle: 0, // Would need system-level monitoring
      cores: os.cpus().length,
      loadAverage,
    };
    this.previousCpuUsage = cpuUsage;

    // Memory metrics
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const memoryStats = {
      used: memUsage.heapUsed,
      total: totalMemory,
      usage: (memUsage.heapUsed / totalMemory) * 100,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
    };

    // Disk I/O metrics (simplified - would need system monitoring)
    const diskStats = {
      readBytes: 0, // Would need system monitoring
      writeBytes: 0,
      readOps: 0,
      writeOps: 0,
      queueLength: 0,
    };

    // Network I/O metrics (simplified)
    const networkStats = {
      rxBytes: 0, // Would need system monitoring
      txBytes: 0,
      rxPackets: 0,
      txPackets: 0,
    };

    // Filesystem metrics
    const fsStats = await this.getFilesystemStats();
    const filesystemStats = {
      total: fsStats.total,
      used: fsStats.used,
      available: fsStats.available,
      usage: fsStats.usage,
    };

    // Cache metrics (would integrate with cache managers)
    const cacheStats = {
      hitRate: 0.85, // Placeholder
      missRate: 0.15,
      size: 100 * 1024 * 1024, // 100MB
      evictions: 0,
    };

    // Database metrics (would integrate with database clients)
    const databaseStats = {
      connections: 10,
      activeConnections: 5,
      queryCount: 1000,
      slowQueries: 5,
    };

    const stats: ResourceUsageStats = {
      timestamp,
      duration: this.config.monitoringInterval,
      cpu: cpuStats,
      memory: memoryStats,
      diskIO: diskStats,
      networkIO: networkStats,
      filesystem: filesystemStats,
      cache: cacheStats,
      database: databaseStats,
    };

    this.emit('metricsCollected', stats);
    return stats;
  }

  /**
   * Get filesystem statistics
   */
  private async getFilesystemStats(): Promise<{ total: number; used: number; available: number; usage: number }> {
    try {
      // Get stats for the temp directory used by the service
      const tempDir = '/tmp';
      const stats = await fs.statvfs(tempDir);

      const total = stats.f_blocks * stats.f_frsize;
      const available = stats.f_available * stats.f_frsize;
      const used = total - available;
      const usage = (used / total) * 100;

      return { total, used, available, usage };
    } catch (error) {
      // Fallback for systems without statvfs
      return {
        total: os.totalmem(),
        used: os.totalmem() * 0.6,
        available: os.totalmem() * 0.4,
        usage: 60,
      };
    }
  }

  /**
   * Check resource thresholds and emit alerts
   */
  private async checkThresholds(): Promise<void> {
    const stats = await this.collectResourceMetrics();
    const thresholds = this.config.thresholds;

    // CPU threshold checking
    if (stats.cpu.usage > thresholds[ResourceType.CPU].critical) {
      await this.emitResourceAlert(ResourceType.CPU, 'critical', stats.cpu.usage, thresholds[ResourceType.CPU].critical, '%');
    } else if (stats.cpu.usage > thresholds[ResourceType.CPU].warning) {
      await this.emitResourceAlert(ResourceType.CPU, 'warning', stats.cpu.usage, thresholds[ResourceType.CPU].warning, '%');
    }

    // Memory threshold checking
    if (stats.memory.usage > thresholds[ResourceType.MEMORY].critical) {
      await this.emitResourceAlert(ResourceType.MEMORY, 'critical', stats.memory.usage, thresholds[ResourceType.MEMORY].critical, '%');
    } else if (stats.memory.usage > thresholds[ResourceType.MEMORY].warning) {
      await this.emitResourceAlert(ResourceType.MEMORY, 'warning', stats.memory.usage, thresholds[ResourceType.MEMORY].warning, '%');
    }

    // Filesystem threshold checking
    if (stats.filesystem.usage > thresholds[ResourceType.FILESYSTEM].critical) {
      await this.emitResourceAlert(ResourceType.FILESYSTEM, 'critical', stats.filesystem.usage, thresholds[ResourceType.FILESYSTEM].critical, '%');
    } else if (stats.filesystem.usage > thresholds[ResourceType.FILESYSTEM].warning) {
      await this.emitResourceAlert(ResourceType.FILESYSTEM, 'warning', stats.filesystem.usage, thresholds[ResourceType.FILESYSTEM].warning, '%');
    }

    // Cache hit rate checking
    if (stats.cache.hitRate < thresholds[ResourceType.CACHE].critical / 100) {
      await this.emitResourceAlert(ResourceType.CACHE, 'critical', stats.cache.hitRate * 100, thresholds[ResourceType.CACHE].critical, '%');
    } else if (stats.cache.hitRate < thresholds[ResourceType.CACHE].warning / 100) {
      await this.emitResourceAlert(ResourceType.CACHE, 'warning', stats.cache.hitRate * 100, thresholds[ResourceType.CACHE].warning, '%');
    }
  }

  /**
   * Emit resource alert with cooldown
   */
  private async emitResourceAlert(
    resourceType: ResourceType,
    severity: 'warning' | 'critical',
    currentValue: number,
    threshold: number,
    unit: string
  ): Promise<void> {
    const alertKey = `${resourceType}-${severity}`;

    // Check cooldown period
    const lastAlert = this.alertCooldowns.get(alertKey);
    if (lastAlert && Date.now() - lastAlert < this.config.alertCooldownPeriod * 60000) {
      return; // Still in cooldown
    }

    this.alertCooldowns.set(alertKey, Date.now());

    const alert: ResourceAlert = {
      id: `${alertKey}-${Date.now()}`,
      timestamp: Date.now(),
      resourceType,
      severity,
      message: `${resourceType.toUpperCase()} usage is ${severity}: ${currentValue.toFixed(2)}${unit} (threshold: ${threshold}${unit})`,
      currentValue,
      threshold,
      unit,
      sustained: true,
      recommendations: this.generateResourceRecommendations(resourceType, severity),
    };

    this.activeAlerts.set(alert.id, alert);
    this.emit('resourceAlert', alert);
  }

  /**
   * Generate resource optimization recommendations
   */
  private generateResourceRecommendations(resourceType: ResourceType, severity: 'warning' | 'critical'): string[] {
    const recommendations: string[] = [];

    switch (resourceType) {
      case ResourceType.CPU:
        if (severity === 'critical') {
          recommendations.push('Consider horizontal scaling or optimizing CPU-intensive operations');
          recommendations.push('Review and optimize database queries');
          recommendations.push('Implement request rate limiting');
        } else {
          recommendations.push('Monitor CPU usage trends and plan for scaling');
          recommendations.push('Optimize application code for better CPU efficiency');
        }
        break;

      case ResourceType.MEMORY:
        if (severity === 'critical') {
          recommendations.push('Immediate action required: memory leak or excessive usage detected');
          recommendations.push('Consider increasing memory allocation or optimizing memory usage');
          recommendations.push('Review cache sizes and memory-intensive operations');
        } else {
          recommendations.push('Monitor memory usage and implement memory optimization strategies');
          recommendations.push('Consider implementing memory-efficient data structures');
        }
        break;

      case ResourceType.FILESYSTEM:
        if (severity === 'critical') {
          recommendations.push('Critical: filesystem nearly full, immediate cleanup required');
          recommendations.push('Delete unnecessary files and implement log rotation');
          recommendations.push('Consider increasing disk space or implementing data archiving');
        } else {
          recommendations.push('Monitor disk usage and implement cleanup strategies');
          recommendations.push('Consider implementing file compression or deduplication');
        }
        break;

      case ResourceType.CACHE:
        if (severity === 'critical') {
          recommendations.push('Cache hit rate critically low, performance severely impacted');
          recommendations.push('Review cache configuration and size limits');
          recommendations.push('Consider cache warming strategies');
        } else {
          recommendations.push('Optimize cache hit rate through better key distribution');
          recommendations.push('Consider increasing cache size or implementing cache clustering');
        }
        break;
    }

    return recommendations;
  }

  /**
   * Generate resource usage predictions
   */
  private async generatePredictions(): Promise<ResourcePrediction[]> {
    const predictions: ResourcePrediction[] = [];
    const history = this.resourceHistory;

    for (const [resourceType, metrics] of history) {
      if (metrics.length < 10) continue; // Need sufficient historical data

      const prediction = this.predictResourceUsage(resourceType, metrics);
      if (prediction) {
        predictions.push(prediction);
      }
    }

    if (predictions.length > 0) {
      this.emit('predictionsGenerated', predictions);
    }

    return predictions;
  }

  /**
   * Predict resource usage based on historical data
   */
  private predictResourceUsage(resourceType: ResourceType, metrics: ResourceMetric[]): ResourcePrediction | null {
    if (metrics.length < 5) return null;

    // Simple linear regression for prediction
    const recentMetrics = metrics.slice(-10); // Last 10 measurements
    const values = recentMetrics.map(m => m.value);
    const timestamps = recentMetrics.map(m => m.timestamp);

    // Calculate trend (slope)
    const n = values.length;
    const sumX = timestamps.reduce((sum, t) => sum + t, 0);
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = timestamps.reduce((sum, t, i) => sum + t * values[i], 0);
    const sumXX = timestamps.reduce((sum, t) => sum + t * t, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Predict value 30 minutes from now
    const predictionTime = Date.now() + 30 * 60 * 1000;
    const predictedValue = slope * predictionTime + intercept;

    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (slope > 1) trend = 'increasing';
    else if (slope < -1) trend = 'decreasing';

    // Check for threshold breach
    const thresholds = this.config.thresholds[resourceType];
    let projectedThresholdBreach = null;

    if (trend === 'increasing' && thresholds) {
      const warningThreshold = thresholds.warning;
      const criticalThreshold = thresholds.critical;

      if (predictedValue > criticalThreshold) {
        const timeToBreach = (criticalThreshold - values[values.length - 1]) / slope / (60 * 1000); // minutes
        projectedThresholdBreach = {
          timeToBreach: Math.max(0, timeToBreach),
          severity: 'critical' as const,
        };
      } else if (predictedValue > warningThreshold) {
        const timeToBreach = (warningThreshold - values[values.length - 1]) / slope / (60 * 1000);
        projectedThresholdBreach = {
          timeToBreach: Math.max(0, timeToBreach),
          severity: 'warning' as const,
        };
      }
    }

    return {
      resourceType,
      timestamp: Date.now(),
      predictedValue,
      confidence: 0.8, // Simplified confidence calculation
      timeHorizon: 30,
      trend,
      projectedThresholdBreach,
    };
  }

  /**
   * Update resource history
   */
  private async updateHistory(): Promise<void> {
    const stats = await this.collectResourceMetrics();

    // Convert stats to metrics
    const metrics: ResourceMetric[] = [
      {
        timestamp: stats.timestamp,
        resourceType: ResourceType.CPU,
        name: 'cpu_usage',
        value: stats.cpu.usage,
        unit: '%',
        level: this.getUsageLevel(stats.cpu.usage, this.config.thresholds[ResourceType.CPU]),
        metadata: { cores: stats.cpu.cores },
      },
      {
        timestamp: stats.timestamp,
        resourceType: ResourceType.MEMORY,
        name: 'memory_usage',
        value: stats.memory.usage,
        unit: '%',
        level: this.getUsageLevel(stats.memory.usage, this.config.thresholds[ResourceType.MEMORY]),
        metadata: { heapUsed: stats.memory.heapUsed },
      },
      {
        timestamp: stats.timestamp,
        resourceType: ResourceType.FILESYSTEM,
        name: 'filesystem_usage',
        value: stats.filesystem.usage,
        unit: '%',
        level: this.getUsageLevel(stats.filesystem.usage, this.config.thresholds[ResourceType.FILESYSTEM]),
        metadata: { available: stats.filesystem.available },
      },
      {
        timestamp: stats.timestamp,
        resourceType: ResourceType.CACHE,
        name: 'cache_hit_rate',
        value: stats.cache.hitRate * 100,
        unit: '%',
        level: this.getCacheUsageLevel(stats.cache.hitRate * 100),
        metadata: { size: stats.cache.size },
      },
    ];

    // Update history
    metrics.forEach(metric => {
      const history = this.resourceHistory.get(metric.resourceType) || [];
      history.push(metric);

      // Keep only recent history (last 24 hours)
      const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
      const recentHistory = history.filter(m => m.timestamp > cutoffTime);
      this.resourceHistory.set(metric.resourceType, recentHistory);
    });

    // Store in Redis if available
    if (this.redis) {
      try {
        await this.redis.setEx(
          `resource_stats:${stats.timestamp}`,
          this.config.retentionPeriod * 3600,
          JSON.stringify(stats)
        );
      } catch (error) {
        this.emit('storageError', error);
      }
    }
  }

  /**
   * Get usage level based on thresholds
   */
  private getUsageLevel(value: number, thresholds: any): ResourceUsageLevel {
    if (thresholds && value > thresholds.critical) {
      return ResourceUsageLevel.CRITICAL;
    } else if (thresholds && value > thresholds.warning) {
      return ResourceUsageLevel.HIGH;
    } else if (thresholds && value > thresholds.warning * 0.5) {
      return ResourceUsageLevel.MODERATE;
    }
    return ResourceUsageLevel.LOW;
  }

  /**
   * Get cache usage level (reverse logic - higher hit rate is better)
   */
  private getCacheUsageLevel(hitRate: number): ResourceUsageLevel {
    if (hitRate < 50) {
      return ResourceUsageLevel.CRITICAL;
    } else if (hitRate < 70) {
      return ResourceUsageLevel.HIGH;
    } else if (hitRate < 85) {
      return ResourceUsageLevel.MODERATE;
    }
    return ResourceUsageLevel.LOW;
  }

  /**
   * Get current resource usage statistics
   */
  async getCurrentStats(): Promise<ResourceUsageStats> {
    return await this.collectResourceMetrics();
  }

  /**
   * Get resource usage history
   */
  getResourceHistory(resourceType: ResourceType, hours: number = 24): ResourceMetric[] {
    const history = this.resourceHistory.get(resourceType) || [];
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    return history.filter(m => m.timestamp > cutoffTime);
  }

  /**
   * Get active resource alerts
   */
  getActiveAlerts(): ResourceAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get resource usage predictions
   */
  async getPredictions(): Promise<ResourcePrediction[]> {
    return await this.generatePredictions();
  }

  /**
   * Generate optimization recommendations
   */
  async getOptimizationRecommendations(): Promise<ResourceOptimization[]> {
    const recommendations: ResourceOptimization[] = [];
    const currentStats = await this.getCurrentStats();
    const activeAlerts = this.getActiveAlerts();

    // CPU optimization recommendations
    if (currentStats.cpu.usage > 70) {
      recommendations.push({
        resourceType: ResourceType.CPU,
        priority: currentStats.cpu.usage > 90 ? 'critical' : 'high',
        recommendation: 'Implement CPU optimization strategies',
        expectedImprovement: 20,
        implementationEffort: 'medium',
        automated: false,
        metadata: { currentUsage: currentStats.cpu.usage },
      });
    }

    // Memory optimization recommendations
    if (currentStats.memory.usage > 80) {
      recommendations.push({
        resourceType: ResourceType.MEMORY,
        priority: currentStats.memory.usage > 95 ? 'critical' : 'high',
        recommendation: 'Implement memory optimization and garbage collection tuning',
        expectedImprovement: 30,
        implementationEffort: 'high',
        automated: true,
        metadata: { currentUsage: currentStats.memory.usage },
      });
    }

    // Cache optimization recommendations
    if (currentStats.cache.hitRate < 0.8) {
      recommendations.push({
        resourceType: ResourceType.CACHE,
        priority: currentStats.cache.hitRate < 0.6 ? 'high' : 'medium',
        recommendation: 'Optimize cache configuration and access patterns',
        expectedImprovement: 25,
        implementationEffort: 'medium',
        automated: false,
        metadata: { currentHitRate: currentStats.cache.hitRate },
      });
    }

    // Filesystem optimization recommendations
    if (currentStats.filesystem.usage > 85) {
      recommendations.push({
        resourceType: ResourceType.FILESYSTEM,
        priority: currentStats.filesystem.usage > 95 ? 'critical' : 'high',
        recommendation: 'Implement file cleanup and archiving strategies',
        expectedImprovement: 15,
        implementationEffort: 'low',
        automated: true,
        metadata: { currentUsage: currentStats.filesystem.usage },
      });
    }

    // Add recommendations based on active alerts
    activeAlerts.forEach(alert => {
      const existingRec = recommendations.find(r => r.resourceType === alert.resourceType);
      if (!existingRec) {
        recommendations.push({
          resourceType: alert.resourceType,
          priority: alert.severity === 'critical' ? 'critical' : 'high',
          recommendation: alert.recommendations[0] || 'Review resource usage and implement optimizations',
          expectedImprovement: 20,
          implementationEffort: 'medium',
          automated: false,
          metadata: { alertId: alert.id, severity: alert.severity },
        });
      }
    });

    return recommendations;
  }

  /**
   * Create resource usage dashboard data
   */
  async getDashboardData(): Promise<any> {
    const currentStats = await this.getCurrentStats();
    const activeAlerts = this.getActiveAlerts();
    const predictions = await this.getPredictions();
    const recommendations = await this.getOptimizationRecommendations();

    return {
      timestamp: Date.now(),
      currentStats,
      alerts: {
        active: activeAlerts.length,
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
        warning: activeAlerts.filter(a => a.severity === 'warning').length,
        details: activeAlerts,
      },
      predictions: predictions.slice(0, 10), // Top 10 predictions
      recommendations: recommendations.slice(0, 5), // Top 5 recommendations
      trends: {
        cpu: this.getResourceHistory(ResourceType.CPU, 1),
        memory: this.getResourceHistory(ResourceType.MEMORY, 1),
        filesystem: this.getResourceHistory(ResourceType.FILESYSTEM, 1),
        cache: this.getResourceHistory(ResourceType.CACHE, 1),
      },
      summary: {
        overallHealth: this.calculateOverallHealth(currentStats, activeAlerts),
        efficiency: this.calculateResourceEfficiency(currentStats),
        alertsTrend: this.calculateAlertsTrend(),
      },
    };
  }

  /**
   * Calculate overall system health score
   */
  private calculateOverallHealth(stats: ResourceUsageStats, alerts: ResourceAlert[]): number {
    let healthScore = 100;

    // Deduct points based on resource usage
    if (stats.cpu.usage > 80) healthScore -= 20;
    if (stats.memory.usage > 85) healthScore -= 25;
    if (stats.filesystem.usage > 90) healthScore -= 30;
    if (stats.cache.hitRate < 0.8) healthScore -= 15;

    // Deduct points for active alerts
    healthScore -= alerts.length * 10;

    // Deduct points for critical alerts
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    healthScore -= criticalAlerts * 20;

    return Math.max(0, healthScore);
  }

  /**
   * Calculate resource efficiency score
   */
  private calculateResourceEfficiency(stats: ResourceUsageStats): number {
    // Higher scores indicate better efficiency
    const cpuEfficiency = Math.max(0, 100 - stats.cpu.usage);
    const memoryEfficiency = Math.max(0, 100 - stats.memory.usage);
    const cacheEfficiency = stats.cache.hitRate * 100;

    return (cpuEfficiency + memoryEfficiency + cacheEfficiency) / 3;
  }

  /**
   * Calculate alerts trend (simplified)
   */
  private calculateAlertsTrend(): 'increasing' | 'decreasing' | 'stable' {
    // Simplified trend calculation
    return 'stable';
  }

  /**
   * Close the resource monitor
   */
  async close(): Promise<void> {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    if (this.predictionTimer) {
      clearInterval(this.predictionTimer);
      this.predictionTimer = null;
    }

    if (this.redis) {
      await this.redis.quit();
    }

    this.activeAlerts.clear();
    this.resourceHistory.clear();
    this.alertCooldowns.clear();

    this.emit('closed');
  }
}

/**
 * Default resource monitor configuration
 */
export const DEFAULT_RESOURCE_CONFIG: ResourceMonitorConfig = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  monitoringInterval: 30, // 30 seconds
  retentionPeriod: 24, // 24 hours
  predictionEnabled: true,
  predictionInterval: 15, // 15 minutes
  alertCooldownPeriod: 5, // 5 minutes
  enableDetailedMetrics: true,
  thresholds: {
    [ResourceType.CPU]: {
      warning: 70,
      critical: 90,
      sustained: 5,
    },
    [ResourceType.MEMORY]: {
      warning: 80,
      critical: 95,
      sustained: 5,
    },
    [ResourceType.DISK_IO]: {
      warning: 1000,
      critical: 5000,
      sustained: 5,
    },
    [ResourceType.NETWORK_IO]: {
      warning: 50,
      critical: 200,
      sustained: 5,
    },
    [ResourceType.FILESYSTEM]: {
      warning: 85,
      critical: 95,
    },
    [ResourceType.CACHE]: {
      warning: 70,
      critical: 50,
    },
    [ResourceType.DATABASE]: {
      warning: 20,
      critical: 50,
    },
  },
};

/**
 * Factory function to create ResourceMonitor
 */
export function createResourceMonitor(config?: Partial<ResourceMonitorConfig>): ResourceMonitor {
  return new ResourceMonitor({ ...DEFAULT_RESOURCE_CONFIG, ...config });
}
