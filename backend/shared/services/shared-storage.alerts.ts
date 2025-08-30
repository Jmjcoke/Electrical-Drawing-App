import { sharedStorageLogger } from './shared-storage.logger';
import { sharedStorageMetrics } from './shared-storage.metrics';

/**
 * SharedStorageAlerts provides comprehensive alerting for SharedStorageService
 * Implements Slack and PagerDuty integration with intelligent escalation
 */
export class SharedStorageAlerts {
  private readonly serviceName: string = 'shared-storage-service';
  private alertHistory: Map<string, { timestamp: Date; count: number; lastAlert: Date }> = new Map();
  private readonly alertCooldownMs: number = 300000; // 5 minutes cooldown between duplicate alerts
  private readonly maxAlertsPerHour: number = 10; // Rate limiting

  constructor(
    private config: {
      slackWebhookUrl?: string;
      pagerdutyRoutingKey?: string;
      environment: string;
      alertThresholds: {
        errorRateThreshold: number;
        performanceThresholdMs: number;
        storageFailureThreshold: number;
      };
    }
  ) {}

  /**
   * Alert on shared storage operation failures
   */
  async alertOperationFailure(
    operation: string,
    service: string,
    error: Error,
    context: Record<string, any> = {}
  ): Promise<void> {
    const alertKey = `operation_failure_${operation}_${service}`;
    const severity = this.determineSeverity(error, context);

    const alertData = {
      title: `SharedStorage Operation Failed: ${operation}`,
      description: `Operation ${operation} failed for service ${service}`,
      severity,
      error: error.message,
      stack: error.stack?.substring(0, 500), // Limit stack trace
      context: {
        operation,
        service,
        sessionId: context.sessionId,
        filepath: context.filepath,
        timestamp: new Date().toISOString(),
        ...context
      }
    };

    await this.sendAlert(alertKey, alertData);
  }

  /**
   * Alert on performance degradation
   */
  async alertPerformanceDegradation(
    operation: string,
    service: string,
    duration: number,
    threshold: number
  ): Promise<void> {
    const alertKey = `performance_degradation_${operation}_${service}`;
    const degradationPercent = ((duration - threshold) / threshold) * 100;
    const severity = degradationPercent > 50 ? 'critical' : 'warning';

    const alertData = {
      title: `SharedStorage Performance Degradation: ${operation}`,
      description: `Operation ${operation} exceeded performance threshold by ${degradationPercent.toFixed(1)}%`,
      severity,
      metrics: {
        operation,
        service,
        duration,
        threshold,
        degradationPercent,
        timestamp: new Date().toISOString()
      }
    };

    await this.sendAlert(alertKey, alertData);
  }

  /**
   * Alert on storage system failures
   */
  async alertStorageFailure(
    failureType: 'access_denied' | 'disk_full' | 'volume_unmounted' | 'corruption',
    details: Record<string, any> = {}
  ): Promise<void> {
    const alertKey = `storage_failure_${failureType}`;
    const severity = failureType === 'volume_unmounted' || failureType === 'corruption' ? 'critical' : 'warning';

    const alertData = {
      title: `SharedStorage System Failure: ${failureType.replace('_', ' ').toUpperCase()}`,
      description: `Critical storage system failure detected: ${failureType}`,
      severity,
      failureType,
      details: {
        ...details,
        timestamp: new Date().toISOString(),
        affectedServices: this.getAffectedServices()
      }
    };

    await this.sendAlert(alertKey, alertData);
  }

  /**
   * Alert on high error rates
   */
  async alertHighErrorRate(
    service: string,
    errorRate: number,
    threshold: number
  ): Promise<void> {
    const alertKey = `high_error_rate_${service}`;
    const severity = errorRate > threshold * 2 ? 'critical' : 'warning';

    const alertData = {
      title: `SharedStorage High Error Rate: ${service}`,
      description: `Service ${service} error rate (${(errorRate * 100).toFixed(1)}%) exceeded threshold`,
      severity,
      metrics: {
        service,
        errorRate,
        threshold,
        timestamp: new Date().toISOString()
      }
    };

    await this.sendAlert(alertKey, alertData);
  }

  /**
   * Alert on health check failures
   */
  async alertHealthCheckFailure(
    checkType: string,
    failureDetails: Record<string, any>
  ): Promise<void> {
    const alertKey = `health_check_failure_${checkType}`;
    const severity = checkType === 'storage' ? 'critical' : 'warning';

    const alertData = {
      title: `SharedStorage Health Check Failed: ${checkType}`,
      description: `Health check ${checkType} failed with critical issues`,
      severity,
      checkType,
      failureDetails: {
        ...failureDetails,
        timestamp: new Date().toISOString()
      }
    };

    await this.sendAlert(alertKey, alertData);
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(alertKey: string, alertData: any): Promise<void> {
    // Rate limiting check
    if (!this.shouldSendAlert(alertKey)) {
      sharedStorageLogger.logInfo(`Alert rate limited: ${alertKey}`, { alertKey });
      return;
    }

    try {
      // Send to Slack if configured
      if (this.config.slackWebhookUrl) {
        await this.sendSlackAlert(alertData);
      }

      // Send to PagerDuty if configured and critical
      if (this.config.pagerdutyRoutingKey && alertData.severity === 'critical') {
        await this.sendPagerDutyAlert(alertData);
      }

      // Log the alert
      sharedStorageLogger.logInfo(`Alert sent: ${alertKey}`, {
        alertKey,
        severity: alertData.severity,
        title: alertData.title
      });

      // Update alert history
      this.updateAlertHistory(alertKey);

    } catch (error) {
      sharedStorageLogger.logError(
        'alert_send_failed',
        error as Error,
        undefined,
        undefined,
        undefined,
        alertKey
      );
    }
  }

  /**
   * Send alert to Slack
   */
  private async sendSlackAlert(alertData: any): Promise<void> {
    if (!this.config.slackWebhookUrl) return;

    const slackMessage = {
      text: `🚨 *${alertData.title}*`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `🚨 ${alertData.title}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Description:* ${alertData.description}\n*Severity:* ${alertData.severity.toUpperCase()}\n*Service:* ${this.serviceName}\n*Environment:* ${this.config.environment}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Details:*\n${this.formatAlertDetails(alertData)}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Alert generated at ${new Date().toISOString()}`
            }
          ]
        }
      ],
      attachments: [
        {
          color: alertData.severity === 'critical' ? 'danger' : 'warning',
          fields: this.formatSlackFields(alertData)
        }
      ]
    };

    const response = await fetch(this.config.slackWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(slackMessage)
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Send alert to PagerDuty
   */
  private async sendPagerDutyAlert(alertData: any): Promise<void> {
    if (!this.config.pagerdutyRoutingKey) return;

    const pagerdutyEvent = {
      routing_key: this.config.pagerdutyRoutingKey,
      event_action: 'trigger',
      dedup_key: `shared-storage-${alertData.title.toLowerCase().replace(/\s+/g, '-')}`,
      payload: {
        summary: alertData.title,
        source: this.serviceName,
        severity: alertData.severity,
        component: 'shared-storage-service',
        group: 'backend-services',
        class: 'storage-failure',
        custom_details: {
          ...alertData,
          environment: this.config.environment
        }
      }
    };

    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pagerdutyEvent)
    });

    if (!response.ok) {
      throw new Error(`PagerDuty API failed: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Determine alert severity based on error and context
   */
  private determineSeverity(error: Error, context: Record<string, any>): 'critical' | 'warning' | 'info' {
    // Critical conditions
    if (error.message.includes('volume unmounted') ||
        error.message.includes('disk full') ||
        error.message.includes('corruption')) {
      return 'critical';
    }

    // High-severity conditions
    if (error.message.includes('permission denied') ||
        error.message.includes('access denied') ||
        context.errorCount > 10) {
      return 'warning';
    }

    return 'info';
  }

  /**
   * Check if alert should be sent (rate limiting)
   */
  private shouldSendAlert(alertKey: string): boolean {
    const now = Date.now();
    const history = this.alertHistory.get(alertKey);

    if (!history) return true;

    // Check cooldown period
    if (now - history.lastAlert.getTime() < this.alertCooldownMs) {
      return false;
    }

    // Check hourly rate limit
    const hourAgo = now - (60 * 60 * 1000);
    if (history.timestamp.getTime() > hourAgo && history.count >= this.maxAlertsPerHour) {
      return false;
    }

    return true;
  }

  /**
   * Update alert history for rate limiting
   */
  private updateAlertHistory(alertKey: string): void {
    const now = new Date();
    const history = this.alertHistory.get(alertKey);

    if (history) {
      // Check if we're in a new hour
      const hourAgo = now.getTime() - (60 * 60 * 1000);
      if (history.timestamp.getTime() < hourAgo) {
        // Reset count for new hour
        history.count = 1;
        history.timestamp = now;
      } else {
        history.count++;
      }
      history.lastAlert = now;
    } else {
      this.alertHistory.set(alertKey, {
        timestamp: now,
        count: 1,
        lastAlert: now
      });
    }
  }

  /**
   * Get list of affected services for storage failures
   */
  private getAffectedServices(): string[] {
    // In a real implementation, this would query service registry
    // For now, return known services
    return ['file-processor', 'llm-orchestrator'];
  }

  /**
   * Format alert details for Slack messages
   */
  private formatAlertDetails(alertData: any): string {
    const details = [];

    if (alertData.error) {
      details.push(`• Error: ${alertData.error}`);
    }

    if (alertData.metrics) {
      Object.entries(alertData.metrics).forEach(([key, value]) => {
        if (typeof value === 'number') {
          details.push(`• ${key}: ${value}`);
        }
      });
    }

    if (alertData.context) {
      if (alertData.context.sessionId) {
        details.push(`• Session: ${alertData.context.sessionId}`);
      }
      if (alertData.context.service) {
        details.push(`• Service: ${alertData.context.service}`);
      }
    }

    return details.length > 0 ? details.join('\n') : 'No additional details available';
  }

  /**
   * Format Slack attachment fields
   */
  private formatSlackFields(alertData: any): any[] {
    const fields = [];

    if (alertData.context?.sessionId) {
      fields.push({
        title: 'Session ID',
        value: alertData.context.sessionId,
        short: true
      });
    }

    if (alertData.context?.service) {
      fields.push({
        title: 'Service',
        value: alertData.context.service,
        short: true
      });
    }

    if (alertData.metrics?.duration) {
      fields.push({
        title: 'Duration',
        value: `${alertData.metrics.duration}ms`,
        short: true
      });
    }

    if (alertData.metrics?.errorRate) {
      fields.push({
        title: 'Error Rate',
        value: `${(alertData.metrics.errorRate * 100).toFixed(1)}%`,
        short: true
      });
    }

    return fields;
  }

  /**
   * Get alert statistics for monitoring
   */
  getAlertStats(): Record<string, any> {
    const stats = {
      totalAlerts: 0,
      alertsBySeverity: {
        critical: 0,
        warning: 0,
        info: 0
      },
      alertsByType: {} as Record<string, number>,
      recentAlerts: [] as any[]
    };

    for (const [alertKey, history] of this.alertHistory.entries()) {
      stats.totalAlerts += history.count;

      // Extract severity from alert key (simplified)
      if (alertKey.includes('critical') || alertKey.includes('failure')) {
        stats.alertsBySeverity.critical += history.count;
      } else if (alertKey.includes('degradation') || alertKey.includes('high')) {
        stats.alertsBySeverity.warning += history.count;
      } else {
        stats.alertsBySeverity.info += history.count;
      }

      // Count by type
      const type = alertKey.split('_')[0];
      stats.alertsByType[type] = (stats.alertsByType[type] || 0) + history.count;

      // Add recent alerts
      if (history.lastAlert.getTime() > Date.now() - (60 * 60 * 1000)) { // Last hour
        stats.recentAlerts.push({
          key: alertKey,
          count: history.count,
          lastAlert: history.lastAlert.toISOString()
        });
      }
    }

    return stats;
  }
}

// Export singleton instance factory
export const createSharedStorageAlerts = (config: {
  slackWebhookUrl?: string;
  pagerdutyRoutingKey?: string;
  environment: string;
  alertThresholds: {
    errorRateThreshold: number;
    performanceThresholdMs: number;
    storageFailureThreshold: number;
  };
}) => {
  return new SharedStorageAlerts(config);
};
