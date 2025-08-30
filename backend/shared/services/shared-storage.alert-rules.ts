import { SharedStorageAlerts } from './shared-storage.alerts';
import { sharedStorageLogger } from './shared-storage.logger';
import { sharedStorageMetrics } from './shared-storage.metrics';
import { SharedStorageHealthCheck } from './shared-storage.health';
import { SessionPathConfig } from '../types/shared-storage.types';

/**
 * SharedStorageAlertRules defines and manages alerting rules for SharedStorageService
 * Implements automatic alert triggering based on health checks, metrics, and thresholds
 */
export class SharedStorageAlertRules {
  private alerts: SharedStorageAlerts;
  private healthCheck: SharedStorageHealthCheck;
  private rules: AlertRule[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private readonly checkIntervalMs: number = 30000; // Check every 30 seconds

  constructor(
    alerts: SharedStorageAlerts,
    healthCheck: SharedStorageHealthCheck,
    config: SessionPathConfig
  ) {
    this.alerts = alerts;
    this.healthCheck = healthCheck;
    this.initializeRules(config);
  }

  /**
   * Initialize alerting rules
   */
  private initializeRules(config: SessionPathConfig): void {
    // Performance degradation rules
    this.addRule({
      id: 'performance_degradation',
      name: 'Performance Degradation Alert',
      description: 'Alert when operations exceed performance threshold',
      severity: 'warning',
      condition: async () => {
        const metricsJson = await sharedStorageMetrics.getMetricsJson();
        return metricsJson.avgAccessTime > 100; // 100ms threshold
      },
      action: async () => {
        const metricsJson = await sharedStorageMetrics.getMetricsJson();
        await this.alerts.alertPerformanceDegradation(
          'shared_storage_access',
          'all_services',
          metricsJson.avgAccessTime,
          100
        );
      },
      cooldownMs: 300000 // 5 minutes
    });

    // High error rate rules
    this.addRule({
      id: 'high_error_rate',
      name: 'High Error Rate Alert',
      description: 'Alert when error rate exceeds threshold',
      severity: 'warning',
      condition: async () => {
        const metricsJson = await sharedStorageMetrics.getMetricsJson();
        return metricsJson.errorRate > 0.05; // 5% error rate
      },
      action: async () => {
        const metricsJson = await sharedStorageMetrics.getMetricsJson();
        await this.alerts.alertHighErrorRate(
          'all_services',
          metricsJson.errorRate,
          0.05
        );
      },
      cooldownMs: 600000 // 10 minutes
    });

    // Storage health failure rules
    this.addRule({
      id: 'storage_health_failure',
      name: 'Storage Health Failure Alert',
      description: 'Alert when storage health checks fail',
      severity: 'critical',
      condition: async () => {
        const health = await this.healthCheck.detailedHealth();
        return health.status === 'unhealthy' &&
               health.checks.storage.status === 'unhealthy';
      },
      action: async () => {
        const health = await this.healthCheck.detailedHealth();
        await this.alerts.alertHealthCheckFailure('storage', {
          storageStatus: health.checks.storage.status,
          storageDetails: health.checks.storage.details,
          overallHealth: health.status
        });
      },
      cooldownMs: 120000 // 2 minutes
    });

    // Disk space critical rules
    this.addRule({
      id: 'disk_space_critical',
      name: 'Disk Space Critical Alert',
      description: 'Alert when disk space is critically low',
      severity: 'critical',
      condition: async () => {
        try {
          const stats = await this.getDiskStats(config.baseSessionPath);
          return stats.availablePercent < 5; // Less than 5% free space
        } catch {
          return false;
        }
      },
      action: async () => {
        const stats = await this.getDiskStats(config.baseSessionPath);
        await this.alerts.alertStorageFailure('disk_full', {
          availableBytes: stats.availableBytes,
          availablePercent: stats.availablePercent,
          totalBytes: stats.totalBytes
        });
      },
      cooldownMs: 1800000 // 30 minutes
    });

    // Service-specific error rules for each configured service
    Object.keys(config.serviceMap).forEach(serviceName => {
      this.addRule({
        id: `service_error_rate_${serviceName}`,
        name: `High Error Rate Alert for ${serviceName}`,
        description: `Alert when ${serviceName} has high error rate`,
        severity: 'warning',
        condition: async () => {
          // In a real implementation, this would track per-service metrics
          const metricsJson = await sharedStorageMetrics.getMetricsJson();
          return metricsJson.errorRate > 0.03; // 3% error rate per service
        },
        action: async () => {
          const metricsJson = await sharedStorageMetrics.getMetricsJson();
          await this.alerts.alertHighErrorRate(
            serviceName,
            metricsJson.errorRate,
            0.03
          );
        },
        cooldownMs: 900000 // 15 minutes
      });
    });
  }

  /**
   * Add a new alerting rule
   */
  addRule(rule: AlertRule): void {
    this.rules.push({
      ...rule,
      lastTriggered: 0,
      enabled: true
    });

    sharedStorageLogger.logInfo(`Alert rule added: ${rule.id}`, {
      ruleId: rule.id,
      severity: rule.severity,
      description: rule.description
    });
  }

  /**
   * Remove an alerting rule
   */
  removeRule(ruleId: string): void {
    const index = this.rules.findIndex(rule => rule.id === ruleId);
    if (index > -1) {
      this.rules.splice(index, 1);
      sharedStorageLogger.logInfo(`Alert rule removed: ${ruleId}`, { ruleId });
    }
  }

  /**
   * Enable or disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      sharedStorageLogger.logInfo(`Alert rule ${enabled ? 'enabled' : 'disabled'}: ${ruleId}`, {
        ruleId,
        enabled
      });
    }
  }

  /**
   * Start monitoring and alert evaluation
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      sharedStorageLogger.logInfo('Alert monitoring already running');
      return;
    }

    sharedStorageLogger.logInfo('Starting alert monitoring', {
      checkIntervalMs: this.checkIntervalMs,
      ruleCount: this.rules.length
    });

    this.monitoringInterval = setInterval(async () => {
      await this.evaluateRules();
    }, this.checkIntervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      sharedStorageLogger.logInfo('Alert monitoring stopped');
    }
  }

  /**
   * Manually evaluate all rules (useful for testing)
   */
  async evaluateRules(): Promise<void> {
    const now = Date.now();
    let triggeredCount = 0;

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      // Check cooldown period
      if (now - rule.lastTriggered < rule.cooldownMs) continue;

      try {
        const shouldTrigger = await rule.condition();

        if (shouldTrigger) {
          await rule.action();
          rule.lastTriggered = now;
          triggeredCount++;

          sharedStorageLogger.logInfo(`Alert rule triggered: ${rule.id}`, {
            ruleId: rule.id,
            severity: rule.severity,
            description: rule.description
          });
        }
      } catch (error) {
        sharedStorageLogger.logError(
          'rule_evaluation_failed',
          error as Error,
          undefined,
          undefined,
          undefined,
          rule.id
        );
      }
    }

    if (triggeredCount > 0) {
      sharedStorageLogger.logInfo(`Alert evaluation completed: ${triggeredCount} rules triggered`, {
        triggeredCount,
        totalRules: this.rules.length
      });
    }
  }

  /**
   * Get current rules configuration
   */
  getRules(): AlertRuleConfig[] {
    return this.rules.map(rule => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      enabled: rule.enabled,
      cooldownMs: rule.cooldownMs,
      lastTriggered: rule.lastTriggered
    }));
  }

  /**
   * Get alert statistics
   */
  getStats(): Record<string, any> {
    return {
      totalRules: this.rules.length,
      enabledRules: this.rules.filter(r => r.enabled).length,
      disabledRules: this.rules.filter(r => !r.enabled).length,
      rulesBySeverity: {
        critical: this.rules.filter(r => r.severity === 'critical').length,
        warning: this.rules.filter(r => r.severity === 'warning').length,
        info: this.rules.filter(r => r.severity === 'info').length
      },
      monitoringActive: this.monitoringInterval !== undefined,
      checkIntervalMs: this.checkIntervalMs,
      lastEvaluation: new Date().toISOString()
    };
  }

  /**
   * Get disk statistics for a given path
   */
  private async getDiskStats(path: string): Promise<{
    totalBytes: number;
    availableBytes: number;
    availablePercent: number;
  }> {
    // This is a simplified implementation
    // In production, you might use system-specific APIs or libraries like 'diskusage'
    try {
      // For now, return mock data - in real implementation, use actual disk stats
      return {
        totalBytes: 1000000000, // 1GB
        availableBytes: 100000000, // 100MB
        availablePercent: 10 // 10%
      };
    } catch (error) {
      sharedStorageLogger.logError('disk_stats_failed', error as Error);
      throw error;
    }
  }

  /**
   * Trigger a manual alert for testing
   */
  async triggerTestAlert(alertType: string, context?: Record<string, any>): Promise<void> {
    sharedStorageLogger.logInfo(`Manual test alert triggered: ${alertType}`, {
      alertType,
      context,
      test: true
    });

    switch (alertType) {
      case 'performance':
        await this.alerts.alertPerformanceDegradation(
          'test_operation',
          'test_service',
          150,
          100
        );
        break;

      case 'error':
        await this.alerts.alertHighErrorRate(
          'test_service',
          0.08,
          0.05
        );
        break;

      case 'storage':
        await this.alerts.alertStorageFailure('access_denied', context);
        break;

      default:
        await this.alerts.alertOperationFailure(
          'test_operation',
          'test_service',
          new Error(`Test ${alertType} alert`),
          context
        );
    }
  }
}

/**
 * Alert rule configuration
 */
export interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  condition: () => Promise<boolean>;
  action: () => Promise<void>;
  cooldownMs: number;
  lastTriggered?: number;
  enabled?: boolean;
}

/**
 * Alert rule configuration for external access
 */
export interface AlertRuleConfig {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  enabled: boolean;
  cooldownMs: number;
  lastTriggered: number;
}

// Export factory function
export const createSharedStorageAlertRules = (
  alerts: SharedStorageAlerts,
  healthCheck: SharedStorageHealthCheck,
  config: SessionPathConfig
) => {
  return new SharedStorageAlertRules(alerts, healthCheck, config);
};
