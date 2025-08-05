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
    readonly threshold: number;
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
    readonly alertThresholds: number[];
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
    calculateCost(providerId: string, model: string, tokenUsage: TokenUsage, hasVision?: boolean): CostBreakdown;
    /**
     * Gets cost summary for a time period
     */
    getCostSummary(startDate: Date, endDate: Date): CostSummary;
    /**
     * Gets current budget status
     */
    getBudgetStatus(): {
        daily: {
            used: number;
            limit?: number;
            remaining?: number;
        };
        monthly: {
            used: number;
            limit?: number;
            remaining?: number;
        };
        total: {
            used: number;
            limit?: number;
            remaining?: number;
        };
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
    getUsageHistory(startDate: Date, endDate: Date, providerId?: string): UsageRecord[];
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
export declare class InMemoryCostTracker implements CostTracker {
    private readonly providerCosts;
    private usageHistory;
    private budgetConfig;
    private alerts;
    private lastAlertCheck;
    constructor(providerCosts: Map<string, {
        inputTokenCost: number;
        outputTokenCost: number;
        visionCost?: number;
        currency: string;
    }>, budgetConfig?: BudgetConfiguration);
    recordUsage(record: Omit<UsageRecord, 'timestamp'>): void;
    calculateCost(providerId: string, _model: string, tokenUsage: TokenUsage, hasVision?: boolean): CostBreakdown;
    getCostSummary(startDate: Date, endDate: Date): CostSummary;
    getBudgetStatus(): {
        daily: {
            used: number;
            limit?: number;
            remaining?: number;
        };
        monthly: {
            used: number;
            limit?: number;
            remaining?: number;
        };
        total: {
            used: number;
            limit?: number;
            remaining?: number;
        };
    };
    wouldExceedBudget(estimatedCost: number): {
        allowed: boolean;
        reason?: string;
        currentUsage: number;
        limit?: number;
    };
    getUsageHistory(startDate: Date, endDate: Date, providerId?: string): UsageRecord[];
    setBudgetConfiguration(config: BudgetConfiguration): void;
    getPendingAlerts(): BudgetAlert[];
    /**
     * Checks for budget alerts and creates them if thresholds are exceeded
     */
    private checkBudgetAlerts;
    /**
     * Checks if there's a recent alert for the same type and threshold
     */
    private hasRecentAlert;
    /**
     * Cleans old usage records to prevent memory issues
     */
    private cleanOldRecords;
}
/**
 * Factory for creating cost trackers with common configurations
 */
export declare class CostTrackerFactory {
    /**
     * Creates a cost tracker with standard provider costs
     */
    static createWithStandardCosts(budgetConfig?: BudgetConfiguration): CostTracker;
    /**
     * Creates a cost tracker with custom provider costs
     */
    static createWithCustomCosts(providerCosts: Map<string, {
        inputTokenCost: number;
        outputTokenCost: number;
        visionCost?: number;
        currency: string;
    }>, budgetConfig?: BudgetConfiguration): CostTracker;
}
/**
 * Cost analysis utilities
 */
export declare class CostAnalyzer {
    /**
     * Analyzes cost trends over time
     */
    static analyzeTrends(costTracker: CostTracker, period?: 'daily' | 'weekly' | 'monthly', numberOfPeriods?: number): Array<{
        period: string;
        cost: number;
        tokens: number;
        requests: number;
        avgCostPerRequest: number;
    }>;
    /**
     * Finds cost optimization opportunities
     */
    static findOptimizationOpportunities(costTracker: CostTracker, startDate: Date, endDate: Date): {
        expensiveProviders: Array<{
            providerId: string;
            cost: number;
            suggestions: string[];
        }>;
        inefficientModels: Array<{
            model: string;
            avgCostPerToken: number;
            suggestions: string[];
        }>;
        unusedCapacity: Array<{
            providerId: string;
            utilization: number;
            suggestions: string[];
        }>;
    };
}
//# sourceMappingURL=CostTracker.d.ts.map