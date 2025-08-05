/**
 * ContextUsageAnalyzer Service
 * Analyzes context usage patterns and provides optimization insights
 */
import type { ContextUsageAnalytics, ContextMetrics, ContextQualityMetrics } from '../../../../shared/types/context';
export interface UsagePattern {
    readonly pattern: string;
    readonly frequency: number;
    readonly avgPerformance: number;
    readonly successRate: number;
    readonly recommendedOptimization: string;
}
export interface OptimizationInsight {
    readonly category: 'performance' | 'storage' | 'accuracy' | 'user_experience';
    readonly priority: 'low' | 'medium' | 'high' | 'critical';
    readonly title: string;
    readonly description: string;
    readonly impact: string;
    readonly implementation: string;
    readonly estimatedBenefit: string;
    readonly relatedMetrics: string[];
}
export interface ContextUsageAnalyzerConfig {
    readonly analysisWindowDays: number;
    readonly minPatternFrequency: number;
    readonly performanceThresholds: {
        readonly excellentMs: number;
        readonly goodMs: number;
        readonly acceptableMs: number;
    };
}
export declare class ContextUsageAnalyzerService {
    private readonly config;
    private readonly usageData;
    private readonly metrics;
    private readonly qualityMetrics;
    constructor(config: ContextUsageAnalyzerConfig);
    /**
     * Records usage data for analysis
     * @param sessionId - Session identifier
     * @param usageData - Usage analytics data
     */
    recordUsageData(sessionId: string, usageData: ContextUsageAnalytics): void;
    /**
     * Records metrics for analysis
     * @param sessionId - Session identifier
     * @param metrics - Context metrics
     */
    recordMetrics(sessionId: string, metrics: ContextMetrics[]): void;
    /**
     * Records quality metrics for analysis
     * @param contextId - Context identifier
     * @param qualityMetrics - Quality metrics
     */
    recordQualityMetrics(contextId: string, qualityMetrics: ContextQualityMetrics): void;
    /**
     * Analyzes usage patterns across all sessions
     * @returns Array of identified usage patterns
     */
    analyzeUsagePatterns(): UsagePattern[];
    /**
     * Generates optimization insights based on usage analysis
     * @returns Array of optimization insights
     */
    generateOptimizationInsights(): OptimizationInsight[];
    /**
     * Analyzes context efficiency and bottlenecks
     * @returns Efficiency analysis report
     */
    analyzeEfficiency(): {
        bottlenecks: Array<{
            component: string;
            severity: 'low' | 'medium' | 'high';
            description: string;
            recommendation: string;
        }>;
        efficiency: {
            overall: number;
            breakdown: Record<string, number>;
        };
        trends: {
            improving: string[];
            degrading: string[];
            stable: string[];
        };
    };
    /**
     * Generates usage recommendations for specific sessions
     * @param sessionId - Session identifier
     * @returns Session-specific recommendations
     */
    generateSessionRecommendations(sessionId: string): string[];
    private updatePatternStats;
    private generatePatternRecommendation;
    private calculateOverallMetrics;
}
//# sourceMappingURL=ContextUsageAnalyzer.d.ts.map