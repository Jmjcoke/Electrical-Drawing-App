/**
 * Performance Monitor
 *
 * Comprehensive performance monitoring for ensemble orchestration including
 * SLA enforcement, real-time metrics collection, and alerting for violations.
 */
import { EnsembleResponse } from '../ensemble/orchestrator';
export interface PerformanceMonitorConfig {
    readonly slaThresholds: SLAThresholds;
    readonly metricsCollection: {
        enabled: boolean;
        interval: number;
        retentionPeriod: number;
        aggregationWindows: number[];
    };
    readonly alerting: {
        enabled: boolean;
        webhookUrl?: string;
        emailRecipients?: string[];
        slackChannel?: string;
        alertCooldown: number;
    };
    readonly dashboards: {
        enabled: boolean;
        realTimeUpdates: boolean;
        updateInterval: number;
    };
}
export interface SLAThresholds {
    readonly maxEnsembleResponseTime: number;
    readonly maxProviderResponseTime: number;
    readonly minSuccessRate: number;
    readonly maxCostPerRequest: number;
    readonly minConfidenceScore: number;
    readonly maxParallelEfficiencyLoss: number;
}
export interface PerformanceMetrics {
    readonly timestamp: Date;
    readonly ensembleMetrics: EnsembleMetrics;
    readonly providerMetrics: Map<string, ProviderMetrics>;
    readonly systemMetrics: SystemMetrics;
    readonly slaCompliance: SLACompliance;
}
export interface EnsembleMetrics {
    readonly totalRequests: number;
    readonly successfulRequests: number;
    readonly failedRequests: number;
    readonly averageResponseTime: number;
    readonly p95ResponseTime: number;
    readonly p99ResponseTime: number;
    readonly parallelEfficiency: number;
    readonly averageCost: number;
    readonly averageConfidence: number;
    readonly throughput: number;
}
export interface ProviderMetrics {
    readonly provider: string;
    readonly requests: number;
    readonly successes: number;
    readonly failures: number;
    readonly averageResponseTime: number;
    readonly p95ResponseTime: number;
    readonly circuitBreakerTrips: number;
    readonly rateLimitHits: number;
    readonly totalCost: number;
    readonly averageConfidence: number;
    readonly availability: number;
}
export interface SystemMetrics {
    readonly cpuUsage: number;
    readonly memoryUsage: number;
    readonly activeConnections: number;
    readonly queuedRequests: number;
    readonly errorRate: number;
}
export interface SLACompliance {
    readonly overallCompliance: number;
    readonly violations: SLAViolation[];
    readonly complianceByMetric: {
        responseTime: number;
        successRate: number;
        cost: number;
        confidence: number;
        parallelEfficiency: number;
    };
}
export interface SLAViolation {
    readonly type: SLAViolationType;
    readonly severity: ViolationSeverity;
    readonly metric: string;
    readonly threshold: number;
    readonly actualValue: number;
    readonly timestamp: Date;
    readonly duration: number;
    readonly affectedRequests: number;
}
export declare enum SLAViolationType {
    RESPONSE_TIME = "response_time",
    SUCCESS_RATE = "success_rate",
    COST = "cost",
    CONFIDENCE = "confidence",
    PARALLEL_EFFICIENCY = "parallel_efficiency"
}
export declare enum ViolationSeverity {
    CRITICAL = "critical",
    HIGH = "high",
    MEDIUM = "medium",
    LOW = "low"
}
export interface PerformanceDashboard {
    readonly overview: DashboardOverview;
    readonly realTimeMetrics: RealTimeMetrics;
    readonly trends: TrendAnalysis;
    readonly alerts: AlertSummary;
    readonly providerComparison: ProviderComparison[];
}
export interface DashboardOverview {
    readonly status: 'healthy' | 'degraded' | 'critical';
    readonly uptime: number;
    readonly totalRequests: number;
    readonly averageResponseTime: number;
    readonly successRate: number;
    readonly costEfficiency: number;
}
export interface RealTimeMetrics {
    readonly currentThroughput: number;
    readonly activeRequests: number;
    readonly queueDepth: number;
    readonly responseTimeDistribution: number[];
    readonly errorRateByProvider: Record<string, number>;
}
export interface TrendAnalysis {
    readonly responseTimeTrend: TimeSeries;
    readonly throughputTrend: TimeSeries;
    readonly errorRateTrend: TimeSeries;
    readonly costTrend: TimeSeries;
    readonly confidenceTrend: TimeSeries;
}
export interface TimeSeries {
    readonly timestamps: Date[];
    readonly values: number[];
    readonly trend: 'increasing' | 'decreasing' | 'stable';
    readonly changeRate: number;
}
export interface AlertSummary {
    readonly activeAlerts: number;
    readonly criticalAlerts: number;
    readonly recentAlerts: Alert[];
    readonly alertHistory: AlertHistory;
}
export interface Alert {
    readonly id: string;
    readonly type: SLAViolationType;
    readonly severity: ViolationSeverity;
    readonly message: string;
    readonly timestamp: Date;
    readonly resolved: boolean;
    readonly resolvedAt?: Date;
}
export interface AlertHistory {
    readonly totalAlerts: number;
    readonly alertsByType: Record<SLAViolationType, number>;
    readonly alertsBySeverity: Record<ViolationSeverity, number>;
    readonly meanTimeToResolution: number;
}
export interface ProviderComparison {
    readonly provider: string;
    readonly rank: number;
    readonly score: number;
    readonly strengths: string[];
    readonly weaknesses: string[];
    readonly recommendations: string[];
}
/**
 * Performance Monitor Implementation
 */
export declare class PerformanceMonitor {
    private config;
    private metricsHistory;
    private activeAlerts;
    private requestHistory;
    private alertCooldowns;
    private startTime;
    constructor(config: PerformanceMonitorConfig);
    /**
     * Records a completed ensemble request for performance analysis
     */
    recordEnsembleRequest(request: EnsembleRequestContext, response: EnsembleResponse, duration: number): void;
    /**
     * Records a failed ensemble request
     */
    recordEnsembleFailure(request: EnsembleRequestContext, error: Error, duration: number): void;
    /**
     * Gets current performance metrics
     */
    getCurrentMetrics(): PerformanceMetrics;
    /**
     * Gets performance dashboard data
     */
    getDashboard(): PerformanceDashboard;
    /**
     * Forces an SLA check on current performance
     */
    checkSLACompliance(): SLACompliance;
    /**
     * Gets all active alerts
     */
    getActiveAlerts(): Alert[];
    /**
     * Resolves an alert
     */
    resolveAlert(alertId: string): boolean;
    /**
     * Starts automatic performance data collection
     */
    private startPerformanceCollection;
    /**
     * Checks for SLA violations in a request record
     */
    private checkSLAViolations;
    /**
     * Creates a new alert if not in cooldown
     */
    private createAlert;
    /**
     * Sends alert notification to configured channels
     */
    private sendAlertNotification;
    /**
     * Calculates ensemble metrics from request records
     */
    private calculateEnsembleMetrics;
    /**
     * Calculates provider-specific metrics
     */
    private calculateProviderMetrics;
    /**
     * Calculates system metrics (simplified implementation)
     */
    private calculateSystemMetrics;
    /**
     * Calculates SLA compliance
     */
    private calculateSLACompliance;
    /**
     * Helper methods
     */
    private getRecentRequests;
    private trimRequestHistory;
    private trimMetricsHistory;
    private determineSeverity;
    private calculateThroughput;
    private calculateErrorRate;
    private calculateCostEfficiency;
    private calculateResponseTimeDistribution;
    private calculateErrorRateByProvider;
    private calculateTrends;
    private calculateTimeSeries;
    private getAlertSummary;
    private getProviderComparison;
    private determineSystemStatus;
    private groupAlertsByType;
    private groupAlertsBySeverity;
    private calculateMTTR;
    private identifyProviderStrengths;
    private identifyProviderWeaknesses;
    private generateProviderRecommendations;
}
/**
 * Helper interfaces
 */
interface EnsembleRequestContext {
    providers?: string[];
    image?: Buffer;
    prompt?: string;
    options?: any;
}
export {};
//# sourceMappingURL=performance.monitor.d.ts.map