/**
 * Provider Health Monitoring System
 *
 * Monitors the health status of LLM providers by performing periodic
 * health checks and tracking provider availability and performance metrics.
 */
import { LLMProvider } from '../providers/base/LLMProvider.interface';
import { CircuitBreaker, CircuitBreakerState } from './CircuitBreaker';
export declare enum HealthStatus {
    HEALTHY = "HEALTHY",
    DEGRADED = "DEGRADED",
    UNHEALTHY = "UNHEALTHY",
    UNKNOWN = "UNKNOWN"
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
export declare class ProviderHealthMonitor {
    private readonly config;
    private readonly providers;
    private readonly circuitBreakers?;
    private readonly healthHistory;
    private readonly consecutiveFailures;
    private readonly lastHealthCheck;
    private readonly schedules;
    private schedulerInterval?;
    constructor(config: HealthMonitorConfig, providers: Map<string, LLMProvider>, circuitBreakers?: Map<string, CircuitBreaker> | undefined);
    /**
     * Starts the health monitoring scheduler
     */
    start(): void;
    /**
     * Stops the health monitoring scheduler
     */
    stop(): void;
    /**
     * Performs immediate health check on a specific provider
     */
    checkProviderHealth(providerId: string): Promise<HealthCheckResult>;
    /**
     * Gets health information for a specific provider
     */
    getProviderHealth(providerId: string): ProviderHealthInfo | undefined;
    /**
     * Gets health information for all providers
     */
    getAllProviderHealth(): Map<string, ProviderHealthInfo>;
    /**
     * Gets overall system health summary
     */
    getSystemHealthSummary(): {
        totalProviders: number;
        healthyProviders: number;
        degradedProviders: number;
        unhealthyProviders: number;
        unknownProviders: number;
        overallStatus: HealthStatus;
    };
    /**
     * Adds a new provider to monitor
     */
    addProvider(providerId: string, provider: LLMProvider, circuitBreaker?: CircuitBreaker): void;
    /**
     * Removes a provider from monitoring
     */
    removeProvider(providerId: string): boolean;
    /**
     * Schedules health checks for a provider
     */
    private scheduleHealthCheck;
    /**
     * Runs health checks that are due
     */
    private runScheduledHealthChecks;
    /**
     * Records a health check result
     */
    private recordHealthCheckResult;
    /**
     * Calculates current status based on recent health checks
     */
    private calculateCurrentStatus;
    /**
     * Calculates uptime percentage
     */
    private calculateUptime;
    /**
     * Calculates average response time
     */
    private calculateAverageResponseTime;
    /**
     * Validates monitor configuration
     */
    private validateConfig;
}
/**
 * Factory for creating health monitors with common configurations
 */
export declare class HealthMonitorFactory {
    /**
     * Creates a health monitor with default settings for LLM providers
     */
    static createDefault(providers: Map<string, LLMProvider>, circuitBreakers?: Map<string, CircuitBreaker>): ProviderHealthMonitor;
    /**
     * Creates a health monitor with aggressive monitoring
     */
    static createAggressive(providers: Map<string, LLMProvider>, circuitBreakers?: Map<string, CircuitBreaker>): ProviderHealthMonitor;
    /**
     * Creates a health monitor with conservative monitoring
     */
    static createConservative(providers: Map<string, LLMProvider>, circuitBreakers?: Map<string, CircuitBreaker>): ProviderHealthMonitor;
}
//# sourceMappingURL=HealthMonitor.d.ts.map