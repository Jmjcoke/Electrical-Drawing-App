"use strict";
/**
 * Provider Health Monitoring System
 *
 * Monitors the health status of LLM providers by performing periodic
 * health checks and tracking provider availability and performance metrics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthMonitorFactory = exports.ProviderHealthMonitor = exports.HealthStatus = void 0;
const CircuitBreaker_1 = require("./CircuitBreaker");
var HealthStatus;
(function (HealthStatus) {
    HealthStatus["HEALTHY"] = "HEALTHY";
    HealthStatus["DEGRADED"] = "DEGRADED";
    HealthStatus["UNHEALTHY"] = "UNHEALTHY";
    HealthStatus["UNKNOWN"] = "UNKNOWN";
})(HealthStatus || (exports.HealthStatus = HealthStatus = {}));
/**
 * Monitors health of individual LLM providers
 */
class ProviderHealthMonitor {
    constructor(config, providers, circuitBreakers) {
        this.config = config;
        this.providers = providers;
        this.circuitBreakers = circuitBreakers;
        this.healthHistory = new Map();
        this.consecutiveFailures = new Map();
        this.lastHealthCheck = new Map();
        this.schedules = new Map();
        this.validateConfig(config);
    }
    /**
     * Starts the health monitoring scheduler
     */
    start() {
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
    stop() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = undefined;
        }
        console.log('Health monitor stopped');
    }
    /**
     * Performs immediate health check on a specific provider
     */
    async checkProviderHealth(providerId) {
        const provider = this.providers.get(providerId);
        if (!provider) {
            throw new Error(`Provider not found: ${providerId}`);
        }
        const startTime = Date.now();
        let result;
        try {
            // Perform health check with timeout
            const healthCheckPromise = provider.healthCheck();
            const timeoutPromise = new Promise((_, reject) => {
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
        }
        catch (error) {
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
    getProviderHealth(providerId) {
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
            circuitBreakerState: circuitBreaker?.getState() || CircuitBreaker_1.CircuitBreakerState.CLOSED
        };
    }
    /**
     * Gets health information for all providers
     */
    getAllProviderHealth() {
        const healthMap = new Map();
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
    getSystemHealthSummary() {
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
        let overallStatus;
        if (statusCounts[HealthStatus.UNHEALTHY] > 0) {
            overallStatus = HealthStatus.UNHEALTHY;
        }
        else if (statusCounts[HealthStatus.DEGRADED] > 0) {
            overallStatus = HealthStatus.DEGRADED;
        }
        else if (statusCounts[HealthStatus.HEALTHY] > 0) {
            overallStatus = HealthStatus.HEALTHY;
        }
        else {
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
    addProvider(providerId, provider, circuitBreaker) {
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
    removeProvider(providerId) {
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
    scheduleHealthCheck(providerId, interval) {
        const schedule = {
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
    async runScheduledHealthChecks() {
        const now = new Date();
        const dueChecks = [];
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
            }
            catch (error) {
                console.error(`Health check failed for provider ${providerId}:`, error);
            }
        });
        await Promise.allSettled(checkPromises);
    }
    /**
     * Records a health check result
     */
    recordHealthCheckResult(providerId, result) {
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
        }
        else {
            const current = this.consecutiveFailures.get(providerId) || 0;
            this.consecutiveFailures.set(providerId, current + 1);
        }
        // Update last check time
        this.lastHealthCheck.set(providerId, result.timestamp);
    }
    /**
     * Calculates current status based on recent health checks
     */
    calculateCurrentStatus(providerId) {
        const history = this.healthHistory.get(providerId) || [];
        if (history.length === 0) {
            return HealthStatus.UNKNOWN;
        }
        const recentChecks = history.slice(-10); // Consider last 10 checks
        const healthyCount = recentChecks.filter(r => r.status === HealthStatus.HEALTHY).length;
        const healthyRatio = healthyCount / recentChecks.length;
        if (healthyRatio >= this.config.degradedThreshold) {
            return HealthStatus.HEALTHY;
        }
        else if (healthyRatio >= this.config.unhealthyThreshold) {
            return HealthStatus.DEGRADED;
        }
        else {
            return HealthStatus.UNHEALTHY;
        }
    }
    /**
     * Calculates uptime percentage
     */
    calculateUptime(history) {
        if (history.length === 0) {
            return 0;
        }
        const healthyCount = history.filter(r => r.status === HealthStatus.HEALTHY).length;
        return (healthyCount / history.length) * 100;
    }
    /**
     * Calculates average response time
     */
    calculateAverageResponseTime(history) {
        if (history.length === 0) {
            return 0;
        }
        const totalTime = history.reduce((sum, result) => sum + result.responseTime, 0);
        return totalTime / history.length;
    }
    /**
     * Validates monitor configuration
     */
    validateConfig(config) {
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
exports.ProviderHealthMonitor = ProviderHealthMonitor;
/**
 * Factory for creating health monitors with common configurations
 */
class HealthMonitorFactory {
    /**
     * Creates a health monitor with default settings for LLM providers
     */
    static createDefault(providers, circuitBreakers) {
        const config = {
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
    static createAggressive(providers, circuitBreakers) {
        const config = {
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
    static createConservative(providers, circuitBreakers) {
        const config = {
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
exports.HealthMonitorFactory = HealthMonitorFactory;
//# sourceMappingURL=HealthMonitor.js.map