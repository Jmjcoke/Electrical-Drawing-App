/**
 * Cost Tracking System
 * 
 * Tracks API costs, token usage, and provides budgeting capabilities
 * for LLM provider usage monitoring and cost optimization.
 */

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export interface CostBreakdown {
  readonly inputTokenCost: number;
  readonly outputTokenCost: number;
  readonly visionCost?: number;
  readonly totalCost: number;
  readonly currency: string;
}

export interface UsageRecord {
  readonly timestamp: Date;
  readonly providerId: string;
  readonly providerName: string;
  readonly model: string;
  readonly sessionId?: string;
  readonly requestId: string;
  readonly tokenUsage: TokenUsage;
  readonly costBreakdown: CostBreakdown;
  readonly success: boolean;
  readonly responseTime: number;
  readonly metadata?: Record<string, unknown>;
}

export interface BudgetAlert {
  readonly type: 'daily' | 'monthly' | 'total';
  readonly threshold: number; // Percentage of budget
  readonly currentUsage: number;
  readonly budgetLimit: number;
  readonly providerId?: string;
  readonly timestamp: Date;
  readonly message: string;
}

export interface CostSummary {
  readonly totalCost: number;
  readonly totalTokens: number;
  readonly totalRequests: number;
  readonly successfulRequests: number;
  readonly failedRequests: number;
  readonly averageCostPerRequest: number;
  readonly averageCostPerToken: number;
  readonly byProvider: Map<string, {
    cost: number;
    tokens: number;
    requests: number;
    successRate: number;
  }>;
  readonly byModel: Map<string, {
    cost: number;
    tokens: number;
    requests: number;
    successRate: number;
  }>;
  readonly timeRange: {
    start: Date;
    end: Date;
  };
}

export interface BudgetConfiguration {
  readonly dailyLimit?: number;
  readonly monthlyLimit?: number;
  readonly totalLimit?: number;
  readonly alertThresholds: number[]; // Percentage thresholds (e.g., [50, 80, 95])
  readonly currency: string;
  readonly alertWebhookUrl?: string;
  readonly alertEmails?: string[];
}

/**
 * Cost tracker interface for different implementations
 */
export interface CostTracker {
  /**
   * Records usage and cost for a request
   */
  recordUsage(record: Omit<UsageRecord, 'timestamp'>): void;

  /**
   * Calculates cost for given token usage
   */
  calculateCost(
    providerId: string,
    model: string,
    tokenUsage: TokenUsage,
    hasVision?: boolean
  ): CostBreakdown;

  /**
   * Gets cost summary for a time period
   */
  getCostSummary(startDate: Date, endDate: Date): CostSummary;

  /**
   * Gets current budget status
   */
  getBudgetStatus(): {
    daily: { used: number; limit?: number; remaining?: number };
    monthly: { used: number; limit?: number; remaining?: number };
    total: { used: number; limit?: number; remaining?: number };
  };

  /**
   * Checks if request would exceed budget
   */
  wouldExceedBudget(estimatedCost: number): {
    allowed: boolean;
    reason?: string;
    currentUsage: number;
    limit?: number;
  };

  /**
   * Gets usage history
   */
  getUsageHistory(
    startDate: Date,
    endDate: Date,
    providerId?: string
  ): UsageRecord[];

  /**
   * Sets budget configuration
   */
  setBudgetConfiguration(config: BudgetConfiguration): void;

  /**
   * Gets pending budget alerts
   */
  getPendingAlerts(): BudgetAlert[];
}

/**
 * In-memory cost tracker implementation
 */
export class InMemoryCostTracker implements CostTracker {
  private usageHistory: UsageRecord[] = [];
  private budgetConfig: BudgetConfiguration;
  private alerts: BudgetAlert[] = [];
  private lastAlertCheck = new Date();

  constructor(
    private readonly providerCosts: Map<string, {
      inputTokenCost: number;
      outputTokenCost: number;
      visionCost?: number;
      currency: string;
    }>,
    budgetConfig?: BudgetConfiguration
  ) {
    this.budgetConfig = budgetConfig || {
      alertThresholds: [80, 95],
      currency: 'USD'
    };
  }

  public recordUsage(record: Omit<UsageRecord, 'timestamp'>): void {
    const fullRecord: UsageRecord = {
      ...record,
      timestamp: new Date()
    };

    this.usageHistory.push(fullRecord);
    this.checkBudgetAlerts();
    this.cleanOldRecords();
  }

  public calculateCost(
    providerId: string,
    _model: string,
    tokenUsage: TokenUsage,
    hasVision: boolean = false
  ): CostBreakdown {
    const providerCost = this.providerCosts.get(providerId);
    
    if (!providerCost) {
      throw new Error(`Cost configuration not found for provider: ${providerId}`);
    }

    const inputTokenCost = (tokenUsage.inputTokens / 1000) * providerCost.inputTokenCost;
    const outputTokenCost = (tokenUsage.outputTokens / 1000) * providerCost.outputTokenCost;
    const visionCost = hasVision && providerCost.visionCost ? providerCost.visionCost : 0;

    return {
      inputTokenCost,
      outputTokenCost,
      visionCost,
      totalCost: inputTokenCost + outputTokenCost + visionCost,
      currency: providerCost.currency
    };
  }

  public getCostSummary(startDate: Date, endDate: Date): CostSummary {
    const filteredRecords = this.usageHistory.filter(
      record => record.timestamp >= startDate && record.timestamp <= endDate
    );

    const totalCost = filteredRecords.reduce((sum, record) => sum + record.costBreakdown.totalCost, 0);
    const totalTokens = filteredRecords.reduce((sum, record) => sum + record.tokenUsage.totalTokens, 0);
    const totalRequests = filteredRecords.length;
    const successfulRequests = filteredRecords.filter(record => record.success).length;
    const failedRequests = totalRequests - successfulRequests;

    // Group by provider
    const byProvider = new Map<string, {
      cost: number;
      tokens: number;
      requests: number;
      successRate: number;
    }>();

    // Group by model
    const byModel = new Map<string, {
      cost: number;
      tokens: number;
      requests: number;
      successRate: number;
    }>();

    for (const record of filteredRecords) {
      // Provider statistics
      const providerStats = byProvider.get(record.providerId) || {
        cost: 0,
        tokens: 0,
        requests: 0,
        successRate: 0
      };

      providerStats.cost += record.costBreakdown.totalCost;
      providerStats.tokens += record.tokenUsage.totalTokens;
      providerStats.requests += 1;
      
      byProvider.set(record.providerId, providerStats);

      // Model statistics
      const modelStats = byModel.get(record.model) || {
        cost: 0,
        tokens: 0,
        requests: 0,
        successRate: 0
      };

      modelStats.cost += record.costBreakdown.totalCost;
      modelStats.tokens += record.tokenUsage.totalTokens;
      modelStats.requests += 1;
      
      byModel.set(record.model, modelStats);
    }

    // Calculate success rates
    for (const [providerId, stats] of byProvider) {
      const providerRecords = filteredRecords.filter(r => r.providerId === providerId);
      const successfulCount = providerRecords.filter(r => r.success).length;
      stats.successRate = stats.requests > 0 ? (successfulCount / stats.requests) * 100 : 0;
      byProvider.set(providerId, stats);
    }

    for (const [model, stats] of byModel) {
      const modelRecords = filteredRecords.filter(r => r.model === model);
      const successfulCount = modelRecords.filter(r => r.success).length;
      stats.successRate = stats.requests > 0 ? (successfulCount / stats.requests) * 100 : 0;
      byModel.set(model, stats);
    }

    return {
      totalCost,
      totalTokens,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageCostPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0,
      averageCostPerToken: totalTokens > 0 ? totalCost / totalTokens : 0,
      byProvider,
      byModel,
      timeRange: { start: startDate, end: endDate }
    };
  }

  public getBudgetStatus(): {
    daily: { used: number; limit?: number; remaining?: number };
    monthly: { used: number; limit?: number; remaining?: number };
    total: { used: number; limit?: number; remaining?: number };
  } {
    const now = new Date();
    
    // Daily usage
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dailyUsage = this.getCostSummary(todayStart, now);

    // Monthly usage
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyUsage = this.getCostSummary(monthStart, now);

    // Total usage
    const totalUsage = this.getCostSummary(new Date(0), now);

    return {
      daily: {
        used: dailyUsage.totalCost,
        ...(this.budgetConfig.dailyLimit !== undefined && { 
          limit: this.budgetConfig.dailyLimit,
          remaining: Math.max(0, this.budgetConfig.dailyLimit - dailyUsage.totalCost)
        })
      },
      monthly: {
        used: monthlyUsage.totalCost,
        ...(this.budgetConfig.monthlyLimit !== undefined && { 
          limit: this.budgetConfig.monthlyLimit,
          remaining: Math.max(0, this.budgetConfig.monthlyLimit - monthlyUsage.totalCost)
        })
      },
      total: {
        used: totalUsage.totalCost,
        ...(this.budgetConfig.totalLimit !== undefined && { 
          limit: this.budgetConfig.totalLimit,
          remaining: Math.max(0, this.budgetConfig.totalLimit - totalUsage.totalCost)
        })
      }
    };
  }

  public wouldExceedBudget(estimatedCost: number): {
    allowed: boolean;
    reason?: string;
    currentUsage: number;
    limit?: number;
  } {
    const budgetStatus = this.getBudgetStatus();

    // Check daily limit
    if (budgetStatus.daily.limit && 
        budgetStatus.daily.used + estimatedCost > budgetStatus.daily.limit) {
      return {
        allowed: false,
        reason: 'Would exceed daily budget limit',
        currentUsage: budgetStatus.daily.used,
        limit: budgetStatus.daily.limit
      };
    }

    // Check monthly limit
    if (budgetStatus.monthly.limit && 
        budgetStatus.monthly.used + estimatedCost > budgetStatus.monthly.limit) {
      return {
        allowed: false,
        reason: 'Would exceed monthly budget limit',
        currentUsage: budgetStatus.monthly.used,
        limit: budgetStatus.monthly.limit
      };
    }

    // Check total limit
    if (budgetStatus.total.limit && 
        budgetStatus.total.used + estimatedCost > budgetStatus.total.limit) {
      return {
        allowed: false,
        reason: 'Would exceed total budget limit',
        currentUsage: budgetStatus.total.used,
        limit: budgetStatus.total.limit
      };
    }

    return {
      allowed: true,
      currentUsage: budgetStatus.daily.used // Return daily usage as default
    };
  }

  public getUsageHistory(
    startDate: Date,
    endDate: Date,
    providerId?: string
  ): UsageRecord[] {
    let filtered = this.usageHistory.filter(
      record => record.timestamp >= startDate && record.timestamp <= endDate
    );

    if (providerId) {
      filtered = filtered.filter(record => record.providerId === providerId);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public setBudgetConfiguration(config: BudgetConfiguration): void {
    this.budgetConfig = config;
  }

  public getPendingAlerts(): BudgetAlert[] {
    return [...this.alerts];
  }

  /**
   * Checks for budget alerts and creates them if thresholds are exceeded
   */
  private checkBudgetAlerts(): void {
    const now = new Date();
    
    // Don't check alerts too frequently
    if (now.getTime() - this.lastAlertCheck.getTime() < 60000) { // 1 minute
      return;
    }

    this.lastAlertCheck = now;
    const budgetStatus = this.getBudgetStatus();

    // Check daily alerts
    if (budgetStatus.daily.limit) {
      const usage = budgetStatus.daily.used;
      const limit = budgetStatus.daily.limit;
      const percentage = (usage / limit) * 100;

      for (const threshold of this.budgetConfig.alertThresholds) {
        if (percentage >= threshold && !this.hasRecentAlert('daily', threshold)) {
          this.alerts.push({
            type: 'daily',
            threshold,
            currentUsage: usage,
            budgetLimit: limit,
            timestamp: now,
            message: `Daily budget usage has reached ${percentage.toFixed(1)}% (${usage.toFixed(2)} ${this.budgetConfig.currency} of ${limit} ${this.budgetConfig.currency})`
          });
        }
      }
    }

    // Check monthly alerts
    if (budgetStatus.monthly.limit) {
      const usage = budgetStatus.monthly.used;
      const limit = budgetStatus.monthly.limit;
      const percentage = (usage / limit) * 100;

      for (const threshold of this.budgetConfig.alertThresholds) {
        if (percentage >= threshold && !this.hasRecentAlert('monthly', threshold)) {
          this.alerts.push({
            type: 'monthly',
            threshold,
            currentUsage: usage,
            budgetLimit: limit,
            timestamp: now,
            message: `Monthly budget usage has reached ${percentage.toFixed(1)}% (${usage.toFixed(2)} ${this.budgetConfig.currency} of ${limit} ${this.budgetConfig.currency})`
          });
        }
      }
    }

    // Clean old alerts (keep only last 24 hours)
    const oneDayAgo = new Date(now.getTime() - 86400000);
    this.alerts = this.alerts.filter(alert => alert.timestamp > oneDayAgo);
  }

  /**
   * Checks if there's a recent alert for the same type and threshold
   */
  private hasRecentAlert(type: 'daily' | 'monthly' | 'total', threshold: number): boolean {
    const oneHourAgo = new Date(Date.now() - 3600000);
    return this.alerts.some(
      alert => alert.type === type && 
               alert.threshold === threshold && 
               alert.timestamp > oneHourAgo
    );
  }

  /**
   * Cleans old usage records to prevent memory issues
   */
  private cleanOldRecords(): void {
    // Keep records for the last 90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    this.usageHistory = this.usageHistory.filter(
      record => record.timestamp > ninetyDaysAgo
    );
  }
}

/**
 * Factory for creating cost trackers with common configurations
 */
export class CostTrackerFactory {
  /**
   * Creates a cost tracker with standard provider costs
   */
  public static createWithStandardCosts(budgetConfig?: BudgetConfiguration): CostTracker {
    const providerCosts = new Map([
      ['openai', {
        inputTokenCost: 0.01, // $0.01 per 1K tokens
        outputTokenCost: 0.03, // $0.03 per 1K tokens
        visionCost: 0.00765, // $0.00765 per image
        currency: 'USD'
      }],
      ['anthropic', {
        inputTokenCost: 0.003, // $0.003 per 1K tokens
        outputTokenCost: 0.015, // $0.015 per 1K tokens
        currency: 'USD'
      }],
      ['google', {
        inputTokenCost: 0.00025, // $0.00025 per 1K tokens
        outputTokenCost: 0.0005, // $0.0005 per 1K tokens
        currency: 'USD'
      }]
    ]);

    return new InMemoryCostTracker(providerCosts, budgetConfig);
  }

  /**
   * Creates a cost tracker with custom provider costs
   */
  public static createWithCustomCosts(
    providerCosts: Map<string, {
      inputTokenCost: number;
      outputTokenCost: number;
      visionCost?: number;
      currency: string;
    }>,
    budgetConfig?: BudgetConfiguration
  ): CostTracker {
    return new InMemoryCostTracker(providerCosts, budgetConfig);
  }
}

/**
 * Cost analysis utilities
 */
export class CostAnalyzer {
  /**
   * Analyzes cost trends over time
   */
  public static analyzeTrends(
    costTracker: CostTracker,
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    numberOfPeriods: number = 7
  ): Array<{
    period: string;
    cost: number;
    tokens: number;
    requests: number;
    avgCostPerRequest: number;
  }> {
    const now = new Date();
    const results: Array<{
      period: string;
      cost: number;
      tokens: number;
      requests: number;
      avgCostPerRequest: number;
    }> = [];

    for (let i = 0; i < numberOfPeriods; i++) {
      let startDate: Date;
      let endDate: Date;
      let periodLabel: string;

      switch (period) {
        case 'daily':
          endDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
          periodLabel = endDate.toISOString().split('T')[0];
          break;
        
        case 'weekly':
          endDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
          startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
          periodLabel = `Week of ${startDate.toISOString().split('T')[0]}`;
          break;
        
        case 'monthly':
          endDate = new Date(now.getFullYear(), now.getMonth() - i, 0);
          startDate = new Date(now.getFullYear(), now.getMonth() - i - 1, 1);
          periodLabel = `${endDate.toLocaleString('default', { month: 'long' })} ${endDate.getFullYear()}`;
          break;
      }

      const summary = costTracker.getCostSummary(startDate, endDate);
      
      results.push({
        period: periodLabel,
        cost: summary.totalCost,
        tokens: summary.totalTokens,
        requests: summary.totalRequests,
        avgCostPerRequest: summary.averageCostPerRequest
      });
    }

    return results.reverse(); // Return chronological order
  }

  /**
   * Finds cost optimization opportunities
   */
  public static findOptimizationOpportunities(
    costTracker: CostTracker,
    startDate: Date,
    endDate: Date
  ): {
    expensiveProviders: Array<{ providerId: string; cost: number; suggestions: string[] }>;
    inefficientModels: Array<{ model: string; avgCostPerToken: number; suggestions: string[] }>;
    unusedCapacity: Array<{ providerId: string; utilization: number; suggestions: string[] }>;
  } {
    const summary = costTracker.getCostSummary(startDate, endDate);
    
    const expensiveProviders = Array.from(summary.byProvider.entries())
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 3)
      .map(([providerId, stats]) => ({
        providerId,
        cost: stats.cost,
        suggestions: [
          stats.successRate < 90 ? 'Improve error handling to reduce failed requests' : '',
          stats.cost > summary.totalCost * 0.5 ? 'Consider load balancing across providers' : '',
          'Review rate limiting to optimize request batching'
        ].filter(Boolean)
      }));

    const inefficientModels = Array.from(summary.byModel.entries())
      .map(([model, stats]) => ({
        model,
        avgCostPerToken: stats.tokens > 0 ? stats.cost / stats.tokens : 0,
        suggestions: [
          stats.successRate < 95 ? 'Review model configuration for better reliability' : '',
          'Consider using more cost-effective models for simpler tasks'
        ].filter(Boolean)
      }))
      .sort((a, b) => b.avgCostPerToken - a.avgCostPerToken)
      .slice(0, 3);

    // Mock unused capacity analysis
    const unusedCapacity = Array.from(summary.byProvider.entries())
      .map(([providerId]) => ({
        providerId,
        utilization: Math.random() * 100, // In real implementation, calculate based on rate limits
        suggestions: [
          'Increase request batching',
          'Optimize prompt templates to reduce token usage'
        ]
      }))
      .filter(item => item.utilization < 50);

    return {
      expensiveProviders,
      inefficientModels,
      unusedCapacity
    };
  }
}