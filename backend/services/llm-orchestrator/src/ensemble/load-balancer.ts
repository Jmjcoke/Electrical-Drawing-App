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

export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  WEIGHTED_ROUND_ROBIN = 'weighted_round_robin',
  LEAST_CONNECTIONS = 'least_connections',
  FASTEST_RESPONSE = 'fastest_response',
  LOWEST_COST = 'lowest_cost',
  ADAPTIVE = 'adaptive'
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
  readonly trend: number; // Positive = improving, Negative = degrading
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
export class ProviderLoadBalancer {
  private providers: Map<string, ProviderInfo> = new Map();
  private metrics: Map<string, ProviderMetrics> = new Map();
  private config: LoadBalancerConfig;
  private roundRobinIndex = 0;
  private lastHealthCheck = 0;

  constructor(config: LoadBalancerConfig) {
    this.config = config;
  }

  /**
   * Registers a provider with the load balancer
   */
  public registerProvider(
    name: string,
    provider: LLMProvider,
    circuitBreaker: CircuitBreaker,
    weight: number = 1.0
  ): void {
    const providerInfo: ProviderInfo = {
      provider,
      circuitBreaker,
      weight,
      enabled: true,
      priority: 50
    };

    this.providers.set(name, providerInfo);
    this.initializeMetrics(name);
    
    console.log(`📊 Registered provider ${name} with load balancer (weight: ${weight})`);
  }

  /**
   * Unregisters a provider from the load balancer
   */
  public unregisterProvider(name: string): boolean {
    const result = this.providers.delete(name);
    if (result) {
      this.metrics.delete(name);
      console.log(`📊 Unregistered provider ${name} from load balancer`);
    }
    return result;
  }

  /**
   * Selects optimal providers for ensemble execution
   */
  public async selectProviders(
    requestCount: number = -1, // -1 means all available providers
    options: {
      excludeProviders?: string[];
      requireProviders?: string[];
      maxCost?: number;
      maxResponseTime?: number;
    } = {}
  ): Promise<LoadBalancingDecision> {
    await this.updateHealthStatus();

    const availableProviders = this.getAvailableProviders(options.excludeProviders);
    
    if (availableProviders.length === 0) {
      throw new Error('No available providers for load balancing');
    }

    // If requestCount is -1, use all available providers
    const targetCount = requestCount === -1 ? availableProviders.length : Math.min(requestCount, availableProviders.length);

    let selectedProviders: string[];
    let reasoning: string;

    switch (this.config.strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        selectedProviders = this.selectRoundRobin(availableProviders, targetCount);
        reasoning = 'Round-robin selection for even distribution';
        break;

      case LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN:
        selectedProviders = this.selectWeightedRoundRobin(availableProviders, targetCount);
        reasoning = 'Weighted round-robin based on provider weights';
        break;

      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        selectedProviders = this.selectLeastConnections(availableProviders, targetCount);
        reasoning = 'Least connections strategy for optimal load distribution';
        break;

      case LoadBalancingStrategy.FASTEST_RESPONSE:
        selectedProviders = this.selectFastestResponse(availableProviders, targetCount);
        reasoning = 'Fastest response time optimization';
        break;

      case LoadBalancingStrategy.LOWEST_COST:
        selectedProviders = this.selectLowestCost(availableProviders, targetCount);
        reasoning = 'Cost optimization strategy';
        break;

      case LoadBalancingStrategy.ADAPTIVE:
      default:
        selectedProviders = this.selectAdaptive(availableProviders, targetCount, options);
        reasoning = 'Adaptive selection based on performance, cost, and availability';
        break;
    }

    // Apply required providers constraint
    if (options.requireProviders) {
      for (const required of options.requireProviders) {
        if (!selectedProviders.includes(required) && availableProviders.includes(required)) {
          selectedProviders.push(required);
          reasoning += ` (includes required provider: ${required})`;
        }
      }
    }

    const expectedPerformance = this.calculateExpectedPerformance(selectedProviders);
    const alternatives = this.generateAlternatives(availableProviders, selectedProviders, targetCount);

    return {
      selectedProviders,
      reasoning,
      expectedPerformance,
      alternatives
    };
  }

  /**
   * Records execution metrics for a provider
   */
  public recordExecution(
    providerName: string,
    responseTime: number,
    success: boolean,
    tokensUsed: number,
    cost: number
  ): void {
    const metrics = this.metrics.get(providerName);
    if (!metrics) return;

    // Update response time
    this.updatePerformanceWindow(metrics.responseTime, responseTime);

    // Update success rate
    this.updatePerformanceWindow(metrics.successRate, success ? 1 : 0);

    // Update cost
    this.updatePerformanceWindow(metrics.cost, cost);

    // Update active connections (decrement)
    if (metrics.activeConnections > 0) {
      (metrics as any).activeConnections--;
    }

    console.log(`📊 Recorded execution for ${providerName}: ${responseTime}ms, success: ${success}, cost: $${cost.toFixed(4)}`);
  }

  /**
   * Records the start of an execution (for active connection tracking)
   */
  public recordExecutionStart(providerName: string): void {
    const metrics = this.metrics.get(providerName);
    if (metrics) {
      (metrics as any).activeConnections++;
    }
  }

  /**
   * Gets current provider metrics
   */
  public getProviderMetrics(providerName?: string): ProviderMetrics | Map<string, ProviderMetrics> {
    if (providerName) {
      const metrics = this.metrics.get(providerName);
      if (!metrics) {
        throw new Error(`Provider not found: ${providerName}`);
      }
      return metrics;
    }
    return new Map(this.metrics);
  }

  /**
   * Gets load balancer statistics
   */
  public getStatistics(): {
    totalProviders: number;
    availableProviders: number;
    healthyProviders: number;
    strategy: LoadBalancingStrategy;
    lastHealthCheck: Date;
    providerDistribution: Array<{ provider: string; weight: number; activeConnections: number }>;
  } {
    const availableProviders = this.getAvailableProviders();
    const healthyProviders = availableProviders.filter(name => {
      const metrics = this.metrics.get(name);
      return metrics && metrics.availability > 0.8 && !metrics.circuitBreakerOpen;
    });

    const providerDistribution = Array.from(this.providers.entries()).map(([name, info]) => {
      const metrics = this.metrics.get(name);
      return {
        provider: name,
        weight: info.weight,
        activeConnections: metrics?.activeConnections || 0
      };
    });

    return {
      totalProviders: this.providers.size,
      availableProviders: availableProviders.length,
      healthyProviders: healthyProviders.length,
      strategy: this.config.strategy,
      lastHealthCheck: new Date(this.lastHealthCheck),
      providerDistribution
    };
  }

  /**
   * Round-robin provider selection
   */
  private selectRoundRobin(availableProviders: string[], count: number): string[] {
    const selected: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const index = (this.roundRobinIndex + i) % availableProviders.length;
      selected.push(availableProviders[index]);
    }
    
    this.roundRobinIndex = (this.roundRobinIndex + count) % availableProviders.length;
    return selected;
  }

  /**
   * Weighted round-robin provider selection
   */
  private selectWeightedRoundRobin(availableProviders: string[], count: number): string[] {
    const weightedProviders: string[] = [];
    
    // Build weighted list
    for (const provider of availableProviders) {
      const providerInfo = this.providers.get(provider);
      const weight = Math.ceil((providerInfo?.weight || 1) * 10);
      for (let i = 0; i < weight; i++) {
        weightedProviders.push(provider);
      }
    }

    const selected: string[] = [];
    const usedProviders = new Set<string>();

    for (let i = 0; i < count && usedProviders.size < availableProviders.length; i++) {
      const index = (this.roundRobinIndex + i) % weightedProviders.length;
      const provider = weightedProviders[index];
      
      if (!usedProviders.has(provider)) {
        selected.push(provider);
        usedProviders.add(provider);
      }
    }

    this.roundRobinIndex = (this.roundRobinIndex + count) % weightedProviders.length;
    return selected;
  }

  /**
   * Least connections provider selection
   */
  private selectLeastConnections(availableProviders: string[], count: number): string[] {
    const providersWithConnections = availableProviders.map(name => {
      const metrics = this.metrics.get(name);
      return {
        name,
        connections: metrics?.activeConnections || 0
      };
    });

    // Sort by least connections, then by name for deterministic ordering
    providersWithConnections.sort((a, b) => {
      if (a.connections !== b.connections) {
        return a.connections - b.connections;
      }
      return a.name.localeCompare(b.name);
    });

    return providersWithConnections.slice(0, count).map(p => p.name);
  }

  /**
   * Fastest response provider selection
   */
  private selectFastestResponse(availableProviders: string[], count: number): string[] {
    const providersWithSpeed = availableProviders.map(name => {
      const metrics = this.metrics.get(name);
      return {
        name,
        avgResponseTime: metrics?.responseTime.average || Infinity
      };
    });

    providersWithSpeed.sort((a, b) => a.avgResponseTime - b.avgResponseTime);
    return providersWithSpeed.slice(0, count).map(p => p.name);
  }

  /**
   * Lowest cost provider selection
   */
  private selectLowestCost(availableProviders: string[], count: number): string[] {
    const providersWithCost = availableProviders.map(name => {
      const metrics = this.metrics.get(name);
      return {
        name,
        avgCost: metrics?.cost.average || Infinity
      };
    });

    providersWithCost.sort((a, b) => a.avgCost - b.avgCost);
    return providersWithCost.slice(0, count).map(p => p.name);
  }

  /**
   * Adaptive provider selection based on multiple factors
   */
  private selectAdaptive(
    availableProviders: string[],
    count: number,
    options: { maxCost?: number; maxResponseTime?: number }
  ): string[] {
    const scoredProviders = availableProviders.map(name => {
      const metrics = this.metrics.get(name);
      const providerInfo = this.providers.get(name);
      
      if (!metrics || !providerInfo) {
        return { name, score: 0 };
      }

      // Calculate composite score
      const performanceScore = this.calculatePerformanceScore(metrics);
      const costScore = this.calculateCostScore(metrics);
      const availabilityScore = this.calculateAvailabilityScore(metrics);

      // Apply constraints
      if (options.maxCost && metrics.cost.average > options.maxCost) return { name, score: 0 };
      if (options.maxResponseTime && metrics.responseTime.average > options.maxResponseTime) return { name, score: 0 };

      const totalScore = (
        performanceScore * this.config.performanceWeighting +
        costScore * this.config.costWeighting +
        availabilityScore * this.config.availabilityWeighting
      ) / (this.config.performanceWeighting + this.config.costWeighting + this.config.availabilityWeighting);

      return { name, score: totalScore };
    });

    // Sort by score (descending) and select top providers
    scoredProviders.sort((a, b) => b.score - a.score);
    return scoredProviders.slice(0, count).map(p => p.name);
  }

  /**
   * Calculates performance score for a provider (0-1, higher is better)
   */
  private calculatePerformanceScore(metrics: ProviderMetrics): number {
    const responseTimeScore = 1 / (1 + metrics.responseTime.average / 1000); // Normalize around 1 second
    const successRateScore = metrics.successRate.average;
    const trendScore = Math.max(0, Math.min(1, 0.5 + metrics.responseTime.trend * 0.1)); // Trend bonus/penalty
    
    return (responseTimeScore + successRateScore + trendScore) / 3;
  }

  /**
   * Calculates cost score for a provider (0-1, higher is better/cheaper)
   */
  private calculateCostScore(metrics: ProviderMetrics): number {
    // Normalize cost - assuming $0.01 as reference point
    const normalizedCost = Math.min(1, 0.01 / Math.max(0.001, metrics.cost.average));
    return normalizedCost;
  }

  /**
   * Calculates availability score for a provider (0-1, higher is better)
   */
  private calculateAvailabilityScore(metrics: ProviderMetrics): number {
    let score = metrics.availability;
    
    // Penalty for circuit breaker being open
    if (metrics.circuitBreakerOpen) {
      score *= 0.1;
    }
    
    // Penalty for being near rate limits
    const rateLimitUtilization = 1 - (metrics.rateLimit.requestsRemaining / metrics.rateLimit.requestsPerMinute);
    if (rateLimitUtilization > 0.8) {
      score *= (1 - rateLimitUtilization * 0.5);
    }
    
    return score;
  }

  /**
   * Gets list of available providers
   */
  private getAvailableProviders(excludeProviders: string[] = []): string[] {
    return Array.from(this.providers.entries())
      .filter(([name, info]) => 
        info.enabled && 
        !excludeProviders.includes(name) &&
        !info.circuitBreaker.isOpen()
      )
      .map(([name]) => name);
  }

  /**
   * Initializes metrics for a provider
   */
  private initializeMetrics(name: string): void {
    const providerInfo = this.providers.get(name);
    if (!providerInfo) return;

    const initialMetrics: ProviderMetrics = {
      name,
      responseTime: { values: [], average: 0, p95: 0, trend: 0 },
      successRate: { values: [], average: 1.0, p95: 1.0, trend: 0 },
      cost: { values: [], average: 0, p95: 0, trend: 0 },
      availability: 1.0,
      lastHealthCheck: new Date(),
      activeConnections: 0,
      rateLimit: providerInfo.provider.getRateLimit(),
      circuitBreakerOpen: providerInfo.circuitBreaker.isOpen()
    };

    this.metrics.set(name, initialMetrics);
  }

  /**
   * Updates a performance window with a new value
   */
  private updatePerformanceWindow(window: PerformanceWindow, value: number): void {
    const mutableWindow = window as any;
    mutableWindow.values.push(value);
    
    // Keep only recent values
    if (mutableWindow.values.length > this.config.performanceWindowSize) {
      mutableWindow.values = mutableWindow.values.slice(-this.config.performanceWindowSize);
    }
    
    // Recalculate statistics
    mutableWindow.average = mutableWindow.values.reduce((sum: number, v: number) => sum + v, 0) / mutableWindow.values.length;
    
    const sorted = [...mutableWindow.values].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    mutableWindow.p95 = sorted[p95Index] || 0;
    
    // Calculate trend (simple linear regression slope)
    if (mutableWindow.values.length >= 5) {
      const n = mutableWindow.values.length;
      const xMean = (n - 1) / 2;
      const yMean = mutableWindow.average;
      
      let numerator = 0;
      let denominator = 0;
      
      for (let i = 0; i < n; i++) {
        const x = i - xMean;
        const y = mutableWindow.values[i] - yMean;
        numerator += x * y;
        denominator += x * x;
      }
      
      mutableWindow.trend = denominator !== 0 ? numerator / denominator : 0;
    }
  }

  /**
   * Updates health status for all providers
   */
  private async updateHealthStatus(): Promise<void> {
    const now = Date.now();
    
    if (now - this.lastHealthCheck < this.config.healthCheckInterval) {
      return; // Too soon to check again
    }

    const healthPromises = Array.from(this.providers.entries()).map(
      async ([name, info]) => {
        try {
          const healthy = await info.provider.healthCheck();
          const metrics = this.metrics.get(name);
          if (metrics) {
            (metrics as any).availability = healthy ? 1.0 : 0.0;
            (metrics as any).lastHealthCheck = new Date();
            (metrics as any).rateLimit = info.provider.getRateLimit();
            (metrics as any).circuitBreakerOpen = info.circuitBreaker.isOpen();
          }
          return { name, healthy };
        } catch (error) {
          const metrics = this.metrics.get(name);
          if (metrics) {
            (metrics as any).availability = 0.0;
            (metrics as any).lastHealthCheck = new Date();
          }
          return { name, healthy: false };
        }
      }
    );

    await Promise.allSettled(healthPromises);
    this.lastHealthCheck = now;
  }

  /**
   * Calculates expected performance for a set of providers
   */
  private calculateExpectedPerformance(providerNames: string[]): {
    averageResponseTime: number;
    totalCost: number;
    successProbability: number;
  } {
    if (providerNames.length === 0) {
      return { averageResponseTime: 0, totalCost: 0, successProbability: 0 };
    }

    let totalResponseTime = 0;
    let totalCost = 0;
    let combinedSuccessProbability = 1;

    for (const name of providerNames) {
      const metrics = this.metrics.get(name);
      if (metrics) {
        totalResponseTime += metrics.responseTime.average;
        totalCost += metrics.cost.average;
        // For parallel execution, overall success probability improves
        combinedSuccessProbability *= (1 - metrics.successRate.average);
      }
    }

    return {
      averageResponseTime: totalResponseTime / providerNames.length,
      totalCost,
      successProbability: 1 - combinedSuccessProbability
    };
  }

  /**
   * Generates alternative provider selections
   */
  private generateAlternatives(
    availableProviders: string[],
    selectedProviders: string[],
    targetCount: number
  ): Array<{ providers: string[]; score: number; reason: string }> {
    const alternatives: Array<{ providers: string[]; score: number; reason: string }> = [];
    
    // Cost-optimized alternative
    const costOptimized = this.selectLowestCost(availableProviders, targetCount);
    if (!this.arraysEqual(costOptimized, selectedProviders)) {
      const expectedPerf = this.calculateExpectedPerformance(costOptimized);
      alternatives.push({
        providers: costOptimized,
        score: 1 / (expectedPerf.totalCost + 0.001),
        reason: 'Cost-optimized selection'
      });
    }

    // Speed-optimized alternative
    const speedOptimized = this.selectFastestResponse(availableProviders, targetCount);
    if (!this.arraysEqual(speedOptimized, selectedProviders)) {
      const expectedPerf = this.calculateExpectedPerformance(speedOptimized);
      alternatives.push({
        providers: speedOptimized,
        score: 1 / (expectedPerf.averageResponseTime + 1),
        reason: 'Speed-optimized selection'
      });
    }

    return alternatives.slice(0, 3); // Return top 3 alternatives
  }

  /**
   * Utility function to compare arrays
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, index) => val === sortedB[index]);
  }
}

/**
 * Helper interfaces
 */
interface ProviderInfo {
  provider: LLMProvider;
  circuitBreaker: CircuitBreaker;
  weight: number;
  enabled: boolean;
  priority: number;
}