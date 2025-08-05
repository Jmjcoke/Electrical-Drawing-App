/**
 * Provider Health Monitoring System
 * 
 * Monitors the health status of LLM providers by performing periodic
 * health checks and tracking provider availability and performance metrics.
 */

import { LLMProvider } from '../providers/base/LLMProvider.interface';
import { CircuitBreaker, CircuitBreakerState } from './CircuitBreaker';

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
  UNKNOWN = 'UNKNOWN'
}

export interface HealthCheckResult {
  readonly status: HealthStatus;
  readonly responseTime: number;
  readonly timestamp: Date;
  readonly error?: Error;
  readonly metadata?: Record<string, unknown>;
}

export interface ProviderHealthInfo {
  readonly providerId: string;
  readonly providerName: string;
  readonly currentStatus: HealthStatus;
  readonly lastHealthCheck: Date;
  readonly consecutiveFailures: number;
  readonly uptime: number;
  readonly averageResponseTime: number;
  readonly healthHistory: HealthCheckResult[];
  readonly circuitBreakerState: CircuitBreakerState;
}

export interface HealthMonitorConfig {
  readonly checkInterval: number;
  readonly timeout: number;
  readonly maxConsecutiveFailures: number;
  readonly historySize: number;
  readonly degradedThreshold: number;
  readonly unhealthyThreshold: number;
}

export interface HealthCheckSchedule {
  readonly providerId: string;
  readonly interval: number;
  readonly enabled: boolean;
  readonly lastCheck?: Date;
  readonly nextCheck?: Date;
}

/**
 * Monitors health of individual LLM providers
 */
export class ProviderHealthMonitor {
  private readonly healthHistory = new Map<string, HealthCheckResult[]>();
  private readonly consecutiveFailures = new Map<string, number>();
  private readonly lastHealthCheck = new Map<string, Date>();
  private readonly schedules = new Map<string, HealthCheckSchedule>();
  private schedulerInterval?: NodeJS.Timeout | undefined;

  constructor(
    private readonly config: HealthMonitorConfig,
    private readonly providers: Map<string, LLMProvider>,
    private readonly circuitBreakers?: Map<string, CircuitBreaker>
  ) {
    this.validateConfig(config);
  }

  /**
   * Starts the health monitoring scheduler
   */
  public start(): void {
    if (this.schedulerInterval) {
      return; // Already started
    }

    // Schedule health checks for all providers
    for (const [providerId] of this.providers) {
      this.scheduleHealthCheck(providerId, this.config.checkInterval);
    }

    // Start the scheduler
    this.schedulerInterval = setInterval(() => {
      this.runScheduledHealthChecks();
    }, 1000); // Check every second for due health checks

    console.log(`Health monitor started with ${this.providers.size} providers`);
  }

  /**
   * Stops the health monitoring scheduler
   */
  public stop(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = undefined;
    }

    console.log('Health monitor stopped');
  }

  /**
   * Performs immediate health check on a specific provider
   */
  public async checkProviderHealth(providerId: string): Promise<HealthCheckResult> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      // Perform health check with timeout
      const healthCheckPromise = provider.healthCheck();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.config.timeout);
      });

      const isHealthy = await Promise.race([healthCheckPromise, timeoutPromise]);
      const responseTime = Date.now() - startTime;

      result = {
        status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        responseTime,
        timestamp: new Date(),
        metadata: {
          providerId,
          providerName: provider.name,
          version: provider.version
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      result = {
        status: HealthStatus.UNHEALTHY,
        responseTime,
        timestamp: new Date(),
        error: errorObj,
        metadata: {
          providerId,
          providerName: provider.name,
          version: provider.version,
          errorMessage
        }
      };
    }

    this.recordHealthCheckResult(providerId, result);
    return result;
  }

  /**
   * Gets health information for a specific provider
   */
  public getProviderHealth(providerId: string): ProviderHealthInfo | undefined {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return undefined;
    }

    const history = this.healthHistory.get(providerId) || [];
    const failures = this.consecutiveFailures.get(providerId) || 0;
    const lastCheck = this.lastHealthCheck.get(providerId);
    const circuitBreaker = this.circuitBreakers?.get(providerId);

    // Calculate current status based on recent health checks
    const currentStatus = this.calculateCurrentStatus(providerId);
    
    // Calculate uptime percentage
    const uptime = this.calculateUptime(history);
    
    // Calculate average response time
    const averageResponseTime = this.calculateAverageResponseTime(history);

    return {
      providerId,
      providerName: provider.name,
      currentStatus,
      lastHealthCheck: lastCheck || new Date(0),
      consecutiveFailures: failures,
      uptime,
      averageResponseTime,
      healthHistory: [...history],
      circuitBreakerState: circuitBreaker?.getState() || CircuitBreakerState.CLOSED
    };
  }

  /**
   * Gets health information for all providers
   */
  public getAllProviderHealth(): Map<string, ProviderHealthInfo> {
    const healthMap = new Map<string, ProviderHealthInfo>();

    for (const providerId of this.providers.keys()) {
      const health = this.getProviderHealth(providerId);
      if (health) {
        healthMap.set(providerId, health);
      }
    }

    return healthMap;
  }

  /**
   * Gets overall system health summary
   */
  public getSystemHealthSummary(): {
    totalProviders: number;
    healthyProviders: number;
    degradedProviders: number;
    unhealthyProviders: number;
    unknownProviders: number;
    overallStatus: HealthStatus;
  } {
    const allHealth = this.getAllProviderHealth();
    const statusCounts = {
      [HealthStatus.HEALTHY]: 0,
      [HealthStatus.DEGRADED]: 0,
      [HealthStatus.UNHEALTHY]: 0,
      [HealthStatus.UNKNOWN]: 0
    };

    for (const health of allHealth.values()) {
      statusCounts[health.currentStatus]++;
    }

    // Determine overall status
    let overallStatus: HealthStatus;
    if (statusCounts[HealthStatus.UNHEALTHY] > 0) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (statusCounts[HealthStatus.DEGRADED] > 0) {
      overallStatus = HealthStatus.DEGRADED;
    } else if (statusCounts[HealthStatus.HEALTHY] > 0) {
      overallStatus = HealthStatus.HEALTHY;
    } else {
      overallStatus = HealthStatus.UNKNOWN;
    }

    return {
      totalProviders: allHealth.size,
      healthyProviders: statusCounts[HealthStatus.HEALTHY],
      degradedProviders: statusCounts[HealthStatus.DEGRADED],
      unhealthyProviders: statusCounts[HealthStatus.UNHEALTHY],
      unknownProviders: statusCounts[HealthStatus.UNKNOWN],
      overallStatus
    };
  }

  /**
   * Adds a new provider to monitor
   */
  public addProvider(providerId: string, provider: LLMProvider, circuitBreaker?: CircuitBreaker): void {
    this.providers.set(providerId, provider);
    
    if (circuitBreaker && this.circuitBreakers) {
      this.circuitBreakers.set(providerId, circuitBreaker);
    }

    // Schedule health checks if monitor is running
    if (this.schedulerInterval) {
      this.scheduleHealthCheck(providerId, this.config.checkInterval);
    }
  }

  /**
   * Removes a provider from monitoring
   */
  public removeProvider(providerId: string): boolean {
    const removed = this.providers.delete(providerId);
    
    if (removed) {
      this.healthHistory.delete(providerId);
      this.consecutiveFailures.delete(providerId);
      this.lastHealthCheck.delete(providerId);
      this.schedules.delete(providerId);
      this.circuitBreakers?.delete(providerId);
    }

    return removed;
  }

  /**
   * Schedules health checks for a provider
   */
  private scheduleHealthCheck(providerId: string, interval: number): void {
    const schedule: HealthCheckSchedule = {
      providerId,
      interval,
      enabled: true,
      nextCheck: new Date(Date.now() + interval)
    };

    this.schedules.set(providerId, schedule);
  }

  /**
   * Runs health checks that are due
   */
  private async runScheduledHealthChecks(): Promise<void> {
    const now = new Date();
    const dueChecks: string[] = [];

    // Find providers with due health checks
    for (const [providerId, schedule] of this.schedules) {
      if (schedule.enabled && schedule.nextCheck && now >= schedule.nextCheck) {
        dueChecks.push(providerId);
      }
    }

    // Run health checks concurrently
    const checkPromises = dueChecks.map(async (providerId) => {
      try {
        await this.checkProviderHealth(providerId);
        
        // Update schedule for next check
        const schedule = this.schedules.get(providerId);
        if (schedule) {
          this.schedules.set(providerId, {
            ...schedule,
            lastCheck: now,
            nextCheck: new Date(now.getTime() + schedule.interval)
          });
        }
      } catch (error) {
        console.error(`Health check failed for provider ${providerId}:`, error);
      }
    });

    await Promise.allSettled(checkPromises);
  }

  /**
   * Records a health check result
   */
  private recordHealthCheckResult(providerId: string, result: HealthCheckResult): void {
    // Update history
    let history = this.healthHistory.get(providerId) || [];
    history.push(result);
    
    // Keep only recent history
    if (history.length > this.config.historySize) {
      history = history.slice(-this.config.historySize);
    }
    
    this.healthHistory.set(providerId, history);

    // Update consecutive failures
    if (result.status === HealthStatus.HEALTHY) {
      this.consecutiveFailures.set(providerId, 0);
    } else {
      const current = this.consecutiveFailures.get(providerId) || 0;
      this.consecutiveFailures.set(providerId, current + 1);
    }

    // Update last check time
    this.lastHealthCheck.set(providerId, result.timestamp);
  }

  /**
   * Calculates current status based on recent health checks
   */
  private calculateCurrentStatus(providerId: string): HealthStatus {
    const history = this.healthHistory.get(providerId) || [];
    
    if (history.length === 0) {
      return HealthStatus.UNKNOWN;
    }

    const recentChecks = history.slice(-10); // Consider last 10 checks
    const healthyCount = recentChecks.filter(r => r.status === HealthStatus.HEALTHY).length;
    const healthyRatio = healthyCount / recentChecks.length;

    if (healthyRatio >= this.config.degradedThreshold) {
      return HealthStatus.HEALTHY;
    } else if (healthyRatio >= this.config.unhealthyThreshold) {
      return HealthStatus.DEGRADED;
    } else {
      return HealthStatus.UNHEALTHY;
    }
  }

  /**
   * Calculates uptime percentage
   */
  private calculateUptime(history: HealthCheckResult[]): number {
    if (history.length === 0) {
      return 0;
    }

    const healthyCount = history.filter(r => r.status === HealthStatus.HEALTHY).length;
    return (healthyCount / history.length) * 100;
  }

  /**
   * Calculates average response time
   */
  private calculateAverageResponseTime(history: HealthCheckResult[]): number {
    if (history.length === 0) {
      return 0;
    }

    const totalTime = history.reduce((sum, result) => sum + result.responseTime, 0);
    return totalTime / history.length;
  }

  /**
   * Validates monitor configuration
   */
  private validateConfig(config: HealthMonitorConfig): void {
    if (config.checkInterval <= 0) {
      throw new Error('Check interval must be positive');
    }

    if (config.timeout <= 0) {
      throw new Error('Timeout must be positive');
    }

    if (config.maxConsecutiveFailures <= 0) {
      throw new Error('Max consecutive failures must be positive');
    }

    if (config.historySize <= 0) {
      throw new Error('History size must be positive');
    }

    if (config.degradedThreshold <= 0 || config.degradedThreshold > 1) {
      throw new Error('Degraded threshold must be between 0 and 1');
    }

    if (config.unhealthyThreshold <= 0 || config.unhealthyThreshold > 1) {
      throw new Error('Unhealthy threshold must be between 0 and 1');
    }

    if (config.unhealthyThreshold >= config.degradedThreshold) {
      throw new Error('Unhealthy threshold must be less than degraded threshold');
    }
  }
}

/**
 * Factory for creating health monitors with common configurations
 */
export class HealthMonitorFactory {
  /**
   * Creates a health monitor with default settings for LLM providers
   */
  public static createDefault(
    providers: Map<string, LLMProvider>,
    circuitBreakers?: Map<string, CircuitBreaker>
  ): ProviderHealthMonitor {
    const config: HealthMonitorConfig = {
      checkInterval: 30000, // 30 seconds
      timeout: 10000, // 10 seconds
      maxConsecutiveFailures: 3,
      historySize: 100,
      degradedThreshold: 0.8, // 80% healthy
      unhealthyThreshold: 0.5 // 50% healthy
    };

    return new ProviderHealthMonitor(config, providers, circuitBreakers);
  }

  /**
   * Creates a health monitor with aggressive monitoring
   */
  public static createAggressive(
    providers: Map<string, LLMProvider>,
    circuitBreakers?: Map<string, CircuitBreaker>
  ): ProviderHealthMonitor {
    const config: HealthMonitorConfig = {
      checkInterval: 10000, // 10 seconds
      timeout: 5000, // 5 seconds
      maxConsecutiveFailures: 2,
      historySize: 200,
      degradedThreshold: 0.9, // 90% healthy
      unhealthyThreshold: 0.7 // 70% healthy
    };

    return new ProviderHealthMonitor(config, providers, circuitBreakers);
  }

  /**
   * Creates a health monitor with conservative monitoring
   */
  public static createConservative(
    providers: Map<string, LLMProvider>,
    circuitBreakers?: Map<string, CircuitBreaker>
  ): ProviderHealthMonitor {
    const config: HealthMonitorConfig = {
      checkInterval: 60000, // 1 minute
      timeout: 30000, // 30 seconds
      maxConsecutiveFailures: 5,
      historySize: 50,
      degradedThreshold: 0.6, // 60% healthy
      unhealthyThreshold: 0.3 // 30% healthy
    };

    return new ProviderHealthMonitor(config, providers, circuitBreakers);
  }
}