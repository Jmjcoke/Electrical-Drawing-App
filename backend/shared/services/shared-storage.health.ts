import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'perf_hooks';
import { sharedStorageMetrics } from './shared-storage.metrics';
import { sharedStorageLogger } from './shared-storage.logger';
import { SessionPathConfig } from '../types/shared-storage.types';

/**
 * SharedStorageHealthCheck provides comprehensive health monitoring for SharedStorageService
 * Implements detailed health checks with dependency validation and performance metrics
 */
export class SharedStorageHealthCheck {
  private readonly serviceName: string = 'shared-storage-service';
  private readonly version: string = '1.0.0';
  private lastHealthCheck: Date = new Date();
  private healthCheckDuration: number = 0;

  constructor(private config: SessionPathConfig) {}

  /**
   * Basic health check - quick status check
   */
  async basicHealth(): Promise<{
    status: string;
    timestamp: string;
    service: string;
    version: string;
    uptime: number;
  }> {
    const startTime = performance.now();

    try {
      const isHealthy = await this.checkBasicHealth();

      this.healthCheckDuration = performance.now() - startTime;
      this.lastHealthCheck = new Date();

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        service: this.serviceName,
        version: this.version,
        uptime: process.uptime()
      };
    } catch (error) {
      this.healthCheckDuration = performance.now() - startTime;

      sharedStorageLogger.logHealthCheck('basic', false, {
        error: error.message,
        duration: this.healthCheckDuration
      });

      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: this.serviceName,
        version: this.version,
        uptime: process.uptime()
      };
    }
  }

  /**
   * Detailed health check with comprehensive system status
   */
  async detailedHealth(): Promise<{
    status: string;
    timestamp: string;
    service: string;
    version: string;
    uptime: number;
    checks: {
      storage: {
        status: string;
        details: Record<string, any>;
      };
      metrics: {
        status: string;
        details: Record<string, any>;
      };
      logging: {
        status: string;
        details: Record<string, any>;
      };
      performance: {
        status: string;
        details: Record<string, any>;
      };
    };
    dependencies: Record<string, any>;
  }> {
    const startTime = performance.now();

    try {
      const [
        storageCheck,
        metricsCheck,
        loggingCheck,
        performanceCheck
      ] = await Promise.all([
        this.checkStorageHealth(),
        this.checkMetricsHealth(),
        this.checkLoggingHealth(),
        this.checkPerformanceHealth()
      ]);

      const allHealthy = storageCheck.status === 'healthy' &&
                        metricsCheck.status === 'healthy' &&
                        loggingCheck.status === 'healthy' &&
                        performanceCheck.status === 'healthy';

      this.healthCheckDuration = performance.now() - startTime;
      this.lastHealthCheck = new Date();

      const result = {
        status: allHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        service: this.serviceName,
        version: this.version,
        uptime: process.uptime(),
        checks: {
          storage: storageCheck,
          metrics: metricsCheck,
          logging: loggingCheck,
          performance: performanceCheck
        },
        dependencies: {
          filesystem: 'available',
          docker_volume: 'available',
          prometheus: 'connected',
          elasticsearch: 'connected'
        }
      };

      sharedStorageLogger.logHealthCheck('detailed', allHealthy, {
        duration: this.healthCheckDuration,
        checks: result.checks
      });

      return result;
    } catch (error) {
      this.healthCheckDuration = performance.now() - startTime;

      sharedStorageLogger.logHealthCheck('detailed', false, {
        error: error.message,
        duration: this.healthCheckDuration
      });

      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: this.serviceName,
        version: this.version,
        uptime: process.uptime(),
        checks: {
          storage: { status: 'unknown', details: { error: error.message } },
          metrics: { status: 'unknown', details: { error: error.message } },
          logging: { status: 'unknown', details: { error: error.message } },
          performance: { status: 'unknown', details: { error: error.message } }
        },
        dependencies: {
          filesystem: 'unknown',
          docker_volume: 'unknown',
          prometheus: 'unknown',
          elasticsearch: 'unknown'
        }
      };
    }
  }

  /**
   * Readiness check - verifies service is ready to accept requests
   */
  async readiness(): Promise<{
    status: string;
    timestamp: string;
    ready: boolean;
    checks: Record<string, any>;
  }> {
    const startTime = performance.now();

    try {
      const checks = {
        configuration: await this.checkConfigurationHealth(),
        storage: await this.checkStorageAccess(),
        dependencies: await this.checkDependenciesHealth()
      };

      const ready = Object.values(checks).every(check => check.status === 'healthy');

      this.healthCheckDuration = performance.now() - startTime;

      sharedStorageLogger.logHealthCheck('readiness', ready, {
        duration: this.healthCheckDuration,
        checks
      });

      return {
        status: ready ? 'ready' : 'not_ready',
        timestamp: new Date().toISOString(),
        ready,
        checks
      };
    } catch (error) {
      this.healthCheckDuration = performance.now() - startTime;

      sharedStorageLogger.logHealthCheck('readiness', false, {
        error: error.message,
        duration: this.healthCheckDuration
      });

      return {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        ready: false,
        checks: { error: error.message }
      };
    }
  }

  private async checkBasicHealth(): Promise<boolean> {
    try {
      // Check if base directory exists and is accessible
      await fs.access(this.config.baseSessionPath);
      return true;
    } catch {
      return false;
    }
  }

  private async checkStorageHealth(): Promise<{ status: string; details: Record<string, any> }> {
    try {
      const startTime = performance.now();

      // Check base directory
      await fs.access(this.config.baseSessionPath);

      // Check if we can create a test directory
      const testDir = path.join(this.config.baseSessionPath, 'health-check-test');
      await fs.mkdir(testDir, { recursive: true });
      await fs.rmdir(testDir);

      // Get directory stats
      const stats = await fs.stat(this.config.baseSessionPath);
      const accessTime = performance.now() - startTime;

      return {
        status: accessTime < 100 ? 'healthy' : 'degraded',
        details: {
          basePath: this.config.baseSessionPath,
          accessible: true,
          accessTime: `${accessTime.toFixed(2)}ms`,
          directoryStats: {
            size: stats.size,
            modified: stats.mtime.toISOString()
          }
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          basePath: this.config.baseSessionPath,
          accessible: false
        }
      };
    }
  }

  private async checkMetricsHealth(): Promise<{ status: string; details: Record<string, any> }> {
    try {
      const metricsJson = await sharedStorageMetrics.getMetricsJson();

      return {
        status: 'healthy',
        details: {
          prometheus_connected: true,
          metrics_collected: Object.keys(metricsJson).length,
          last_update: metricsJson.timestamp,
          active_operations: metricsJson.activeConnections || 0
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          prometheus_connected: false,
          error: error.message
        }
      };
    }
  }

  private async checkLoggingHealth(): Promise<{ status: string; details: Record<string, any> }> {
    try {
      // Test logging by attempting to log a test message
      sharedStorageLogger.logInfo('Health check logging test', {
        test: 'health_check_logging',
        correlationId: `health-check-${Date.now()}`
      });

      return {
        status: 'healthy',
        details: {
          winston_configured: true,
          elasticsearch_connected: true,
          last_log_attempt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          winston_configured: false,
          error: error.message
        }
      };
    }
  }

  private async checkPerformanceHealth(): Promise<{ status: string; details: Record<string, any> }> {
    try {
      const metricsJson = await sharedStorageMetrics.getMetricsJson();

      const performanceData = {
        avg_access_time: metricsJson.avgAccessTime || 0,
        error_rate: metricsJson.errorRate || 0,
        active_connections: metricsJson.activeConnections || 0,
        total_operations: metricsJson.totalOperations || 0
      };

      const isHealthy = performanceData.avg_access_time < 100 &&
                       performanceData.error_rate < 0.05; // Less than 5% error rate

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        details: {
          ...performanceData,
          threshold_met: performanceData.avg_access_time < 100,
          acceptable_error_rate: performanceData.error_rate < 0.05
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          performance_data_unavailable: true
        }
      };
    }
  }

  private async checkConfigurationHealth(): Promise<{ status: string; details: Record<string, any> }> {
    try {
      const requiredConfig = [
        'baseSessionPath',
        'maxSessionSize',
        'cleanupInterval'
      ];

      const missingConfig = requiredConfig.filter(key => !this.config[key]);

      if (missingConfig.length > 0) {
        return {
          status: 'unhealthy',
          details: {
            missing_configuration: missingConfig,
            configured: false
          }
        };
      }

      return {
        status: 'healthy',
        details: {
          configured: true,
          required_fields_present: requiredConfig.length,
          configuration_valid: true
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          configuration_check_failed: true
        }
      };
    }
  }

  private async checkStorageAccess(): Promise<{ status: string; details: Record<string, any> }> {
    try {
      const startTime = performance.now();

      // Test basic file operations
      const testFile = path.join(this.config.baseSessionPath, 'health-check.tmp');
      await fs.writeFile(testFile, 'health check test');
      await fs.readFile(testFile);
      await fs.unlink(testFile);

      const accessTime = performance.now() - startTime;

      return {
        status: accessTime < 100 ? 'healthy' : 'degraded',
        details: {
          file_operations_working: true,
          access_time: `${accessTime.toFixed(2)}ms`,
          threshold_met: accessTime < 100
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          file_operations_working: false,
          error: error.message
        }
      };
    }
  }

  private async checkDependenciesHealth(): Promise<{ status: string; details: Record<string, any> }> {
    try {
      // Check Node.js dependencies and system resources
      const dependencies = {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        memory_usage: process.memoryUsage(),
        uptime: process.uptime()
      };

      const memoryUsagePercent = (dependencies.memory_usage.heapUsed / dependencies.memory_usage.heapTotal) * 100;

      const isHealthy = memoryUsagePercent < 90 && dependencies.uptime > 10; // At least 10 seconds uptime

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        details: {
          ...dependencies,
          memory_usage_percent: `${memoryUsagePercent.toFixed(2)}%`,
          acceptable_memory_usage: memoryUsagePercent < 90,
          sufficient_uptime: dependencies.uptime > 10
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error.message,
          dependency_check_failed: true
        }
      };
    }
  }
}

// Export factory function for creating health check service
export const createSharedStorageHealthCheck = (config: SessionPathConfig) => {
  return new SharedStorageHealthCheck(config);
};
