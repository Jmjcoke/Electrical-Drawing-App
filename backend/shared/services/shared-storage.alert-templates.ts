/**
 * SharedStorageAlertTemplates provides standardized alert message templates
 * Implements consistent formatting and actionable guidance for different alert types
 */

export class SharedStorageAlertTemplates {
  private static readonly templates = {
    // Performance-related alerts
    performance_degradation: {
      slack: {
        title: '🚨 SharedStorage Performance Degradation',
        description: 'Shared storage operations are running slower than expected',
        fields: [
          { name: 'Operation', key: 'operation' },
          { name: 'Duration', key: 'duration', format: (val: number) => `${val}ms` },
          { name: 'Threshold', key: 'threshold', format: (val: number) => `${val}ms` },
          { name: 'Degradation', key: 'degradationPercent', format: (val: number) => `${val.toFixed(1)}%` }
        ],
        actions: [
          'Check system load and resource usage',
          'Review recent deployments for performance regressions',
          'Monitor database connection pool status',
          'Consider scaling storage resources if load is legitimate'
        ],
        priority: 'HIGH'
      },
      pagerduty: {
        title: 'SharedStorage Performance Degradation Alert',
        description: 'Storage operations exceeding performance thresholds',
        severity: 'warning',
        component: 'shared-storage-service',
        class: 'performance'
      }
    },

    // Error rate alerts
    high_error_rate: {
      slack: {
        title: '⚠️ SharedStorage High Error Rate',
        description: 'Error rate has exceeded acceptable thresholds',
        fields: [
          { name: 'Service', key: 'service' },
          { name: 'Error Rate', key: 'errorRate', format: (val: number) => `${(val * 100).toFixed(1)}%` },
          { name: 'Threshold', key: 'threshold', format: (val: number) => `${(val * 100).toFixed(1)}%` },
          { name: 'Time Window', key: 'timeWindow', default: '5 minutes' }
        ],
        actions: [
          'Check application logs for error patterns',
          'Verify external service dependencies (database, network)',
          'Review recent configuration changes',
          'Monitor for resource exhaustion (memory, disk, connections)'
        ],
        priority: 'MEDIUM'
      },
      pagerduty: {
        title: 'SharedStorage High Error Rate Alert',
        description: 'Error rate exceeding acceptable thresholds',
        severity: 'warning',
        component: 'shared-storage-service',
        class: 'reliability'
      }
    },

    // Storage system failure alerts
    storage_failure_access_denied: {
      slack: {
        title: '🚨 SharedStorage Access Denied',
        description: 'Critical storage access failure detected',
        fields: [
          { name: 'Service', key: 'service' },
          { name: 'Session ID', key: 'sessionId' },
          { name: 'File Path', key: 'filepath' },
          { name: 'Error', key: 'error' }
        ],
        actions: [
          'Verify service permissions and authentication',
          'Check session validity and expiration',
          'Review file access policies and security rules',
          'Investigate potential security breaches or misconfigurations'
        ],
        priority: 'CRITICAL'
      },
      pagerduty: {
        title: 'SharedStorage Access Denied Failure',
        description: 'Storage access denied - potential security or configuration issue',
        severity: 'critical',
        component: 'shared-storage-service',
        class: 'security'
      }
    },

    storage_failure_disk_full: {
      slack: {
        title: '🚨 SharedStorage Disk Full',
        description: 'Storage disk space critically low',
        fields: [
          { name: 'Available Space', key: 'availableBytes', format: SharedStorageAlertTemplates.formatBytes },
          { name: 'Available %', key: 'availablePercent', format: (val: number) => `${val.toFixed(1)}%` },
          { name: 'Total Space', key: 'totalBytes', format: SharedStorageAlertTemplates.formatBytes },
          { name: 'Mount Point', key: 'mountPoint', default: '/opt/shared-storage' }
        ],
        actions: [
          'Immediate: Clean up temporary files and old sessions',
          'Check for large files consuming excessive space',
          'Review data retention policies',
          'Consider increasing disk space or implementing compression'
        ],
        priority: 'CRITICAL'
      },
      pagerduty: {
        title: 'SharedStorage Disk Full Alert',
        description: 'Critical disk space shortage affecting storage operations',
        severity: 'critical',
        component: 'shared-storage-service',
        class: 'capacity'
      }
    },

    storage_failure_volume_unmounted: {
      slack: {
        title: '🚨 SharedStorage Volume Unmounted',
        description: 'Critical storage volume is no longer accessible',
        fields: [
          { name: 'Volume', key: 'volume', default: 'shared-sessions' },
          { name: 'Mount Point', key: 'mountPoint', default: '/opt/shared-storage' },
          { name: 'Last Seen', key: 'lastSeen', default: 'Unknown' },
          { name: 'Affected Services', key: 'affectedServices', format: (val: string[]) => val.join(', ') }
        ],
        actions: [
          'IMMEDIATE: Check Docker volume status and mounts',
          'Verify Kubernetes persistent volume claims',
          'Restart affected services to re-establish connections',
          'Escalate to infrastructure/SRE team for volume recovery'
        ],
        priority: 'CRITICAL'
      },
      pagerduty: {
        title: 'SharedStorage Volume Unmounted Failure',
        description: 'Storage volume unmounted - service disruption likely',
        severity: 'critical',
        component: 'shared-storage-service',
        class: 'infrastructure'
      }
    },

    storage_failure_corruption: {
      slack: {
        title: '🚨 SharedStorage Data Corruption',
        description: 'Data corruption detected in shared storage',
        fields: [
          { name: 'Corruption Type', key: 'corruptionType', default: 'Unknown' },
          { name: 'Affected Files', key: 'affectedFiles', format: (val: string[]) => val.join(', ') },
          { name: 'Detection Time', key: 'detectionTime', default: new Date().toISOString() },
          { name: 'Severity', key: 'severity', default: 'High' }
        ],
        actions: [
          'IMMEDIATE: Quarantine affected files and sessions',
          'Verify backup integrity and recovery procedures',
          'Investigate root cause (hardware failure, software bug, etc.)',
          'Implement data recovery from backups if necessary'
        ],
        priority: 'CRITICAL'
      },
      pagerduty: {
        title: 'SharedStorage Data Corruption Alert',
        description: 'Data corruption detected - potential data loss risk',
        severity: 'critical',
        component: 'shared-storage-service',
        class: 'data-integrity'
      }
    },

    // Health check failure alerts
    health_check_failure: {
      slack: {
        title: '⚠️ SharedStorage Health Check Failed',
        description: 'Health check failure detected',
        fields: [
          { name: 'Check Type', key: 'checkType' },
          { name: 'Status', key: 'status', default: 'unhealthy' },
          { name: 'Failure Reason', key: 'failureReason' },
          { name: 'Check Duration', key: 'checkDuration', format: (val: number) => `${val}ms` }
        ],
        actions: [
          'Review detailed health check results',
          'Check service dependencies and connectivity',
          'Verify configuration and environment variables',
          'Monitor for cascading failures in dependent services'
        ],
        priority: 'HIGH'
      },
      pagerduty: {
        title: 'SharedStorage Health Check Failure',
        description: 'Health check failure - service may be degraded',
        severity: 'warning',
        component: 'shared-storage-service',
        class: 'health'
      }
    },

    // Operation failure alerts
    operation_failure: {
      slack: {
        title: '⚠️ SharedStorage Operation Failed',
        description: 'Storage operation failed unexpectedly',
        fields: [
          { name: 'Operation', key: 'operation' },
          { name: 'Service', key: 'service' },
          { name: 'Session ID', key: 'sessionId' },
          { name: 'Error Message', key: 'error' }
        ],
        actions: [
          'Check service logs for detailed error information',
          'Verify session validity and permissions',
          'Test operation manually to reproduce issue',
          'Check for pattern of failures across multiple operations'
        ],
        priority: 'MEDIUM'
      },
      pagerduty: {
        title: 'SharedStorage Operation Failure',
        description: 'Storage operation failed - check service health',
        severity: 'warning',
        component: 'shared-storage-service',
        class: 'operation'
      }
    }
  };

  /**
   * Get alert template by type
   */
  static getTemplate(alertType: string, channel: 'slack' | 'pagerduty' = 'slack') {
    const templateKey = alertType.replace(/[_-]/g, '_');
    return this.templates[templateKey]?.[channel];
  }

  /**
   * Render template with data
   */
  static renderTemplate(template: any, data: Record<string, any>): any {
    if (!template) return data;

    const rendered = { ...template };

    // Render fields
    if (template.fields) {
      rendered.fields = template.fields.map((field: any) => ({
        title: field.name,
        value: this.renderFieldValue(field, data),
        short: true
      }));
    }

    // Add actions as formatted text
    if (template.actions) {
      rendered.actionsText = template.actions.map((action: string, index: number) =>
        `${index + 1}. ${action}`
      ).join('\n');
    }

    return rendered;
  }

  /**
   * Render field value with formatting
   */
  private static renderFieldValue(field: any, data: Record<string, any>): string {
    const value = data[field.key] !== undefined ? data[field.key] : field.default;

    if (value === undefined || value === null) {
      return 'N/A';
    }

    if (field.format && typeof field.format === 'function') {
      return field.format(value);
    }

    return String(value);
  }

  /**
   * Format bytes for display
   */
  private static formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }

    return `${value.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Get escalation policy for alert type
   */
  static getEscalationPolicy(alertType: string): {
    initialResponse: string;
    escalationTime: number;
    escalationContacts: string[];
  } {
    const policies = {
      critical: {
        initialResponse: 'Immediate response required - page on-call engineer',
        escalationTime: 5, // minutes
        escalationContacts: ['SRE Team Lead', 'Infrastructure Manager']
      },
      high: {
        initialResponse: 'Response within 15 minutes',
        escalationTime: 15, // minutes
        escalationContacts: ['DevOps Team', 'Service Owner']
      },
      medium: {
        initialResponse: 'Response within 1 hour',
        escalationTime: 60, // minutes
        escalationContacts: ['Development Team', 'QA Team']
      }
    };

    const template = this.getTemplate(alertType);
    const priority = template?.priority?.toLowerCase() || 'medium';

    return policies[priority as keyof typeof policies] || policies.medium;
  }

  /**
   * Get runbook reference for alert type
   */
  static getRunbookReference(alertType: string): {
    primary: string;
    secondary: string[];
    troubleshooting: string[];
  } {
    const runbooks = {
      performance_degradation: {
        primary: 'Runbook: SharedStorage Performance Troubleshooting',
        secondary: [
          'Runbook: Database Connection Pool Management',
          'Runbook: System Resource Monitoring'
        ],
        troubleshooting: [
          'Check system load average and CPU usage',
          'Verify database connection pool status',
          'Review recent application deployments',
          'Monitor network latency and throughput'
        ]
      },

      high_error_rate: {
        primary: 'Runbook: SharedStorage Error Rate Analysis',
        secondary: [
          'Runbook: Service Dependency Health Checks',
          'Runbook: Log Analysis and Pattern Detection'
        ],
        troubleshooting: [
          'Review application error logs for patterns',
          'Check external service dependencies',
          'Verify configuration changes',
          'Monitor resource utilization'
        ]
      },

      storage_failure_access_denied: {
        primary: 'Runbook: SharedStorage Access Control Issues',
        secondary: [
          'Runbook: Authentication and Authorization',
          'Runbook: Session Management'
        ],
        troubleshooting: [
          'Verify service authentication credentials',
          'Check session validity and expiration',
          'Review permission policies',
          'Investigate recent security changes'
        ]
      },

      storage_failure_disk_full: {
        primary: 'Runbook: Storage Capacity Management',
        secondary: [
          'Runbook: Data Retention and Cleanup',
          'Runbook: Storage Expansion Procedures'
        ],
        troubleshooting: [
          'Identify large files consuming space',
          'Check data retention policies',
          'Clean up temporary and old files',
          'Consider storage expansion options'
        ]
      }
    };

    return runbooks[alertType as keyof typeof runbooks] || {
      primary: 'Runbook: General SharedStorage Troubleshooting',
      secondary: ['Runbook: Service Health Monitoring'],
      troubleshooting: [
        'Check service logs for error details',
        'Verify service configuration',
        'Test service connectivity',
        'Review recent changes and deployments'
      ]
    };
  }

  /**
   * Generate alert summary for dashboards
   */
  static generateAlertSummary(alertType: string, data: Record<string, any>): {
    type: string;
    severity: string;
    summary: string;
    impact: string;
    recommendedAction: string;
  } {
    const template = this.getTemplate(alertType);

    return {
      type: alertType,
      severity: template?.priority || 'MEDIUM',
      summary: template?.slack?.description || 'Alert triggered',
      impact: this.getImpactDescription(alertType),
      recommendedAction: template?.slack?.actions?.[0] || 'Investigate and resolve'
    };
  }

  /**
   * Get impact description for alert type
   */
  private static getImpactDescription(alertType: string): string {
    const impacts = {
      performance_degradation: 'Users may experience slower response times',
      high_error_rate: 'Increased error rate may affect service reliability',
      storage_failure_access_denied: 'Services may be unable to access required files',
      storage_failure_disk_full: 'Storage operations may fail due to insufficient space',
      storage_failure_volume_unmounted: 'Complete service disruption likely',
      storage_failure_corruption: 'Potential data loss or corruption',
      health_check_failure: 'Service health degradation detected',
      operation_failure: 'Specific storage operations are failing'
    };

    return impacts[alertType as keyof typeof impacts] || 'Service impact detected';
  }
}

// Export singleton instance
export const sharedStorageAlertTemplates = new SharedStorageAlertTemplates();
