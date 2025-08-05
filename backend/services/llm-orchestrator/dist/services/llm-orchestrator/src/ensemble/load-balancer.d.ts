/**
 * Provider Load Balancer
 *
 * Implements intelligent load balancing for ensemble orchestration based on
 * provider performance history, health status, and cost optimization.
 */
import { LLMProvider, RateLimitInfo } from '../providers/base/LLMProvider.interface';
import { CircuitBreaker } from '../reliability/CircuitBreaker';
export interface LoadBalancerConfig {
    readonly strategy: LoadBalancingStrategy;
    readonly healthCheckInterval: number;
    readonly performanceWindowSize: number;
    readonly costWeighting: number;
    readonly performanceWeighting: number;
    readonly availabilityWeighting: number;
    readonly minHealthyProviders: number;
}
export declare enum LoadBalancingStrategy {
    ROUND_ROBIN = "round_robin",
    WEIGHTED_ROUND_ROBIN = "weighted_round_robin",
    LEAST_CONNECTIONS = "least_connections",
    FASTEST_RESPONSE = "fastest_response",
    LOWEST_COST = "lowest_cost",
    ADAPTIVE = "adaptive"
}
export interface ProviderMetrics {
    readonly name: string;
    readonly responseTime: PerformanceWindow;
    readonly successRate: PerformanceWindow;
    readonly cost: PerformanceWindow;
    readonly availability: number;
    readonly lastHealthCheck: Date;
    readonly activeConnections: number;
    readonly rateLimit: RateLimitInfo;
    readonly circuitBreakerOpen: boolean;
}
export interface PerformanceWindow {
    readonly values: number[];
    readonly average: number;
    readonly p95: number;
    readonly trend: number;
}
export interface LoadBalancingDecision {
    readonly selectedProviders: string[];
    readonly reasoning: string;
    readonly expectedPerformance: {
        averageResponseTime: number;
        totalCost: number;
        successProbability: number;
    };
    readonly alternatives: Array<{
        providers: string[];
        score: number;
        reason: string;
    }>;
}
/**
 * Adaptive Load Balancer for Provider Selection
 */
export declare class ProviderLoadBalancer {
    private providers;
    private metrics;
    private config;
    private roundRobinIndex;
    private lastHealthCheck;
    constructor(config: LoadBalancerConfig);
    /**
     * Registers a provider with the load balancer
     */
    registerProvider(name: string, provider: LLMProvider, circuitBreaker: CircuitBreaker, weight?: number): void;
    /**
     * Unregisters a provider from the load balancer
     */
    unregisterProvider(name: string): boolean;
    /**
     * Selects optimal providers for ensemble execution
     */
    selectProviders(requestCount?: number, // -1 means all available providers
    options?: {
        excludeProviders?: string[];
        requireProviders?: string[];
        maxCost?: number;
        maxResponseTime?: number;
    }): Promise<LoadBalancingDecision>;
    /**
     * Records execution metrics for a provider
     */
    recordExecution(providerName: string, responseTime: number, success: boolean, tokensUsed: number, cost: number): void;
    /**
     * Records the start of an execution (for active connection tracking)
     */
    recordExecutionStart(providerName: string): void;
    /**
     * Gets current provider metrics
     */
    getProviderMetrics(providerName?: string): ProviderMetrics | Map<string, ProviderMetrics>;
    /**
     * Gets load balancer statistics
     */
    getStatistics(): {
        totalProviders: number;
        availableProviders: number;
        healthyProviders: number;
        strategy: LoadBalancingStrategy;
        lastHealthCheck: Date;
        providerDistribution: Array<{
            provider: string;
            weight: number;
            activeConnections: number;
        }>;
    };
    /**
     * Round-robin provider selection
     */
    private selectRoundRobin;
    /**
     * Weighted round-robin provider selection
     */
    private selectWeightedRoundRobin;
    /**
     * Least connections provider selection
     */
    private selectLeastConnections;
    /**
     * Fastest response provider selection
     */
    private selectFastestResponse;
    /**
     * Lowest cost provider selection
     */
    private selectLowestCost;
    /**
     * Adaptive provider selection based on multiple factors
     */
    private selectAdaptive;
    /**
     * Calculates performance score for a provider (0-1, higher is better)
     */
    private calculatePerformanceScore;
    /**
     * Calculates cost score for a provider (0-1, higher is better/cheaper)
     */
    private calculateCostScore;
    /**
     * Calculates availability score for a provider (0-1, higher is better)
     */
    private calculateAvailabilityScore;
    /**
     * Gets list of available providers
     */
    private getAvailableProviders;
    /**
     * Initializes metrics for a provider
     */
    private initializeMetrics;
    /**
     * Updates a performance window with a new value
     */
    private updatePerformanceWindow;
    /**
     * Updates health status for all providers
     */
    private updateHealthStatus;
    /**
     * Calculates expected performance for a set of providers
     */
    private calculateExpectedPerformance;
    /**
     * Generates alternative provider selections
     */
    private generateAlternatives;
    /**
     * Utility function to compare arrays
     */
    private arraysEqual;
}
//# sourceMappingURL=load-balancer.d.ts.map