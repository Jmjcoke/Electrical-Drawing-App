/**
 * ContextAnalytics Service
 * Provides comprehensive analytics and metrics tracking for context management system
 */
import type { ContextMetrics, ContextMetricType, ContextQualityMetrics, ContextAccuracyMetrics, ContextPerformanceMetrics, ContextUsageAnalytics, ConversationContext } from '../../../../shared/types/context';
export interface ContextAnalyticsConfig {
    readonly metricsRetentionDays: number;
    readonly aggregationIntervalMinutes: number;
    readonly enableRealTimeMetrics: boolean;
    readonly performanceThresholds: {
        readonly retrievalTimeMs: number;
        readonly enhancementTimeMs: number;
        readonly summarizationTimeMs: number;
    };
}
export declare class ContextAnalyticsService {
    private readonly config;
    private readonly metrics;
    private readonly qualityMetrics;
    private readonly usageAnalytics;
    private readonly performanceHistory;
    constructor(config: ContextAnalyticsConfig);
    /**
     * Records a performance metric for context operations
     * @param sessionId - Session identifier
     * @param contextId - Context identifier
     * @param metricType - Type of metric being recorded
     * @param value - Metric value
     * @param metadata - Additional metric metadata
     */
    recordMetric(sessionId: string, contextId: string, metricType: ContextMetricType, value: number, metadata?: Record<string, unknown>): void;
    /**
     * Records context quality metrics
     * @param context - Conversation context
     * @param accuracyScores - Accuracy measurement results
     * @param performanceTiming - Performance timing data
     */
    recordQualityMetrics(context: ConversationContext, accuracyScores: Partial<ContextAccuracyMetrics>, performanceTiming: Partial<ContextPerformanceMetrics>): void;
    /**
     * Updates usage analytics for a session
     * @param sessionId - Session identifier
     * @param updateData - Usage data to update
     */
    updateUsageAnalytics(sessionId: string, updateData: Partial<ContextUsageAnalytics>): void;
    /**
     * Retrieves performance metrics for a specific time period
     * @param sessionId - Session identifier
     * @param contextId - Optional context identifier
     * @param fromDate - Start date for metrics
     * @param toDate - End date for metrics
     * @returns Array of context metrics
     */
    getMetrics(sessionId: string, contextId?: string, fromDate?: Date, toDate?: Date): ContextMetrics[];
    /**
     * Retrieves aggregated quality metrics
     * @param contextId - Optional context identifier
     * @returns Quality metrics or aggregated metrics
     */
    getQualityMetrics(contextId?: string): ContextQualityMetrics | ContextQualityMetrics[] | null;
    /**
     * Generates usage analytics report
     * @param sessionId - Optional session identifier
     * @returns Usage analytics data
     */
    getUsageAnalytics(sessionId?: string): ContextUsageAnalytics | ContextUsageAnalytics[] | null;
    /**
     * Analyzes performance trends over time
     * @param metricType - Type of metric to analyze
     * @param windowSize - Number of recent values to analyze
     * @returns Trend analysis results
     */
    analyzePerformanceTrends(metricType: ContextMetricType, windowSize?: number): {
        trend: 'improving' | 'degrading' | 'stable';
        averageValue: number;
        standardDeviation: number;
        recentAverage: number;
        changePercentage: number;
    };
    /**
     * Generates comprehensive analytics summary
     * @param sessionId - Optional session identifier
     * @returns Analytics summary report
     */
    generateAnalyticsSummary(sessionId?: string): {
        overview: {
            totalSessions: number;
            totalContexts: number;
            totalMetrics: number;
            avgPerformance: Record<string, number>;
        };
        quality: {
            avgAccuracy: number;
            avgRelevanceScore: number;
            performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
        };
        recommendations: string[];
    };
    private calculateStorageMetrics;
    private updatePerformanceHistory;
    private cleanupOldMetrics;
    private calculatePerformanceGrade;
    private generateRecommendations;
}
//# sourceMappingURL=ContextAnalytics.d.ts.map