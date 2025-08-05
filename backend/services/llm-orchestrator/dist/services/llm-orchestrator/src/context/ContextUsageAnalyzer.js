"use strict";
/**
 * ContextUsageAnalyzer Service
 * Analyzes context usage patterns and provides optimization insights
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextUsageAnalyzerService = void 0;
class ContextUsageAnalyzerService {
    constructor(config) {
        this.usageData = new Map();
        this.metrics = new Map();
        this.qualityMetrics = new Map();
        this.config = config;
    }
    /**
     * Records usage data for analysis
     * @param sessionId - Session identifier
     * @param usageData - Usage analytics data
     */
    recordUsageData(sessionId, usageData) {
        this.usageData.set(sessionId, usageData);
    }
    /**
     * Records metrics for analysis
     * @param sessionId - Session identifier
     * @param metrics - Context metrics
     */
    recordMetrics(sessionId, metrics) {
        const existing = this.metrics.get(sessionId) || [];
        this.metrics.set(sessionId, [...existing, ...metrics]);
    }
    /**
     * Records quality metrics for analysis
     * @param contextId - Context identifier
     * @param qualityMetrics - Quality metrics
     */
    recordQualityMetrics(contextId, qualityMetrics) {
        this.qualityMetrics.set(contextId, qualityMetrics);
    }
    /**
     * Analyzes usage patterns across all sessions
     * @returns Array of identified usage patterns
     */
    analyzeUsagePatterns() {
        const patterns = new Map();
        // Analyze conversation patterns
        for (const [sessionId, usage] of this.usageData.entries()) {
            const sessionMetrics = this.metrics.get(sessionId) || [];
            // Pattern: Follow-up query ratio
            const followUpRatio = usage.totalQueries > 0 ? usage.followUpQueries / usage.totalQueries : 0;
            let patternKey = 'low_followup';
            if (followUpRatio > 0.6)
                patternKey = 'high_followup';
            else if (followUpRatio > 0.3)
                patternKey = 'medium_followup';
            this.updatePatternStats(patterns, patternKey, sessionMetrics, true);
            // Pattern: Context retrieval frequency
            const retrievalRatio = usage.totalQueries > 0 ? usage.contextRetrievals / usage.totalQueries : 0;
            let retrievalPattern = 'low_retrieval';
            if (retrievalRatio > 0.8)
                retrievalPattern = 'high_retrieval';
            else if (retrievalRatio > 0.5)
                retrievalPattern = 'medium_retrieval';
            this.updatePatternStats(patterns, retrievalPattern, sessionMetrics, true);
            // Pattern: Session duration categories
            const durationMinutes = usage.sessionDurationMs / (1000 * 60);
            let durationPattern = 'short_session';
            if (durationMinutes > 60)
                durationPattern = 'long_session';
            else if (durationMinutes > 20)
                durationPattern = 'medium_session';
            this.updatePatternStats(patterns, durationPattern, sessionMetrics, true);
            // Pattern: Context types usage
            for (const contextType of usage.mostUsedContextTypes) {
                const typePattern = `context_type_${contextType}`;
                this.updatePatternStats(patterns, typePattern, sessionMetrics, true);
            }
        }
        // Convert to UsagePattern objects
        return Array.from(patterns.entries())
            .filter(([, stats]) => stats.count >= this.config.minPatternFrequency)
            .map(([pattern, stats]) => ({
            pattern,
            frequency: stats.count,
            avgPerformance: stats.performanceTimes.length > 0
                ? stats.performanceTimes.reduce((sum, time) => sum + time, 0) / stats.performanceTimes.length
                : 0,
            successRate: stats.count > 0 ? stats.successCount / stats.count : 0,
            recommendedOptimization: this.generatePatternRecommendation(pattern, stats)
        }))
            .sort((a, b) => b.frequency - a.frequency);
    }
    /**
     * Generates optimization insights based on usage analysis
     * @returns Array of optimization insights
     */
    generateOptimizationInsights() {
        const insights = [];
        const patterns = this.analyzeUsagePatterns();
        const overallMetrics = this.calculateOverallMetrics();
        // Performance insights
        if (overallMetrics.avgRetrievalTime > this.config.performanceThresholds.acceptableMs) {
            insights.push({
                category: 'performance',
                priority: overallMetrics.avgRetrievalTime > this.config.performanceThresholds.goodMs * 2 ? 'critical' : 'high',
                title: 'Context Retrieval Performance Optimization',
                description: `Average context retrieval time (${overallMetrics.avgRetrievalTime.toFixed(0)}ms) exceeds acceptable thresholds`,
                impact: 'Improved user experience and reduced wait times',
                implementation: 'Implement more aggressive caching, optimize database queries, or add context pre-loading',
                estimatedBenefit: `Potential 30-50% reduction in retrieval time`,
                relatedMetrics: ['retrieval_time_ms', 'cache_hit_rate']
            });
        }
        // Storage insights
        if (overallMetrics.avgStorageGrowth > 10) { // 10% growth per session
            insights.push({
                category: 'storage',
                priority: 'medium',
                title: 'Context Storage Growth Optimization',
                description: `Context storage is growing at ${overallMetrics.avgStorageGrowth.toFixed(1)}% per session`,
                impact: 'Reduced storage costs and improved performance',
                implementation: 'Implement more aggressive context compression or summarization strategies',
                estimatedBenefit: 'Potential 20-40% reduction in storage usage',
                relatedMetrics: ['storage_size_bytes', 'compression_ratio']
            });
        }
        // Accuracy insights
        if (overallMetrics.avgAccuracy < 0.85) {
            insights.push({
                category: 'accuracy',
                priority: overallMetrics.avgAccuracy < 0.7 ? 'critical' : 'high',
                title: 'Context Accuracy Improvement',
                description: `Average context accuracy (${(overallMetrics.avgAccuracy * 100).toFixed(1)}%) is below optimal levels`,
                impact: 'Better user satisfaction and more relevant responses',
                implementation: 'Enhance entity resolution algorithms and context relevance scoring',
                estimatedBenefit: 'Potential 10-20% improvement in user satisfaction',
                relatedMetrics: ['accuracy_score', 'relevance_score']
            });
        }
        // Usage pattern insights
        const highFollowUpPattern = patterns.find(p => p.pattern === 'high_followup');
        if (highFollowUpPattern && highFollowUpPattern.avgPerformance > this.config.performanceThresholds.goodMs) {
            insights.push({
                category: 'user_experience',
                priority: 'medium',
                title: 'Follow-up Query Optimization',
                description: 'High follow-up query usage with suboptimal performance',
                impact: 'Smoother conversational flow and reduced user frustration',
                implementation: 'Pre-cache related context for anticipated follow-up queries',
                estimatedBenefit: 'Potential 40-60% improvement in follow-up query response time',
                relatedMetrics: ['follow_up_detection_time_ms', 'context_enhancement_time_ms']
            });
        }
        // Cache efficiency insights
        if (overallMetrics.avgCacheHitRate < 0.7) {
            insights.push({
                category: 'performance',
                priority: 'medium',
                title: 'Cache Strategy Optimization',
                description: `Cache hit rate (${(overallMetrics.avgCacheHitRate * 100).toFixed(1)}%) indicates inefficient caching`,
                impact: 'Faster response times and reduced computational overhead',
                implementation: 'Optimize cache eviction policies and increase cache size for frequently accessed contexts',
                estimatedBenefit: 'Potential 25-40% improvement in overall response time',
                relatedMetrics: ['cache_hit_rate', 'retrieval_time_ms']
            });
        }
        // Sort by priority and category
        return insights.sort((a, b) => {
            const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }
    /**
     * Analyzes context efficiency and bottlenecks
     * @returns Efficiency analysis report
     */
    analyzeEfficiency() {
        const bottlenecks = [];
        const overallMetrics = this.calculateOverallMetrics();
        // Check for bottlenecks
        if (overallMetrics.avgRetrievalTime > this.config.performanceThresholds.goodMs) {
            bottlenecks.push({
                component: 'Context Retrieval',
                severity: overallMetrics.avgRetrievalTime > this.config.performanceThresholds.acceptableMs ? 'high' : 'medium',
                description: `Retrieval operations taking ${overallMetrics.avgRetrievalTime.toFixed(0)}ms on average`,
                recommendation: 'Optimize database queries and implement better indexing'
            });
        }
        if (overallMetrics.avgCacheHitRate < 0.6) {
            bottlenecks.push({
                component: 'Cache System',
                severity: 'medium',
                description: `Low cache hit rate of ${(overallMetrics.avgCacheHitRate * 100).toFixed(1)}%`,
                recommendation: 'Review cache eviction policy and increase cache capacity'
            });
        }
        if (overallMetrics.avgAccuracy < 0.8) {
            bottlenecks.push({
                component: 'Context Accuracy',
                severity: overallMetrics.avgAccuracy < 0.7 ? 'high' : 'medium',
                description: `Context accuracy below optimal at ${(overallMetrics.avgAccuracy * 100).toFixed(1)}%`,
                recommendation: 'Improve entity resolution and context relevance algorithms'
            });
        }
        // Calculate efficiency scores
        const retrievalEfficiency = Math.max(0, 100 - (overallMetrics.avgRetrievalTime / this.config.performanceThresholds.excellentMs) * 100);
        const accuracyEfficiency = overallMetrics.avgAccuracy * 100;
        const cacheEfficiency = overallMetrics.avgCacheHitRate * 100;
        const storageEfficiency = Math.max(0, 100 - overallMetrics.avgStorageGrowth);
        const overall = (retrievalEfficiency + accuracyEfficiency + cacheEfficiency + storageEfficiency) / 4;
        return {
            bottlenecks,
            efficiency: {
                overall: Math.round(overall),
                breakdown: {
                    retrieval: Math.round(retrievalEfficiency),
                    accuracy: Math.round(accuracyEfficiency),
                    cache: Math.round(cacheEfficiency),
                    storage: Math.round(storageEfficiency)
                }
            },
            trends: {
                improving: [], // Would require historical data for trend analysis
                degrading: [],
                stable: []
            }
        };
    }
    /**
     * Generates usage recommendations for specific sessions
     * @param sessionId - Session identifier
     * @returns Session-specific recommendations
     */
    generateSessionRecommendations(sessionId) {
        const usage = this.usageData.get(sessionId);
        const sessionMetrics = this.metrics.get(sessionId) || [];
        const recommendations = [];
        if (!usage) {
            return ['No usage data available for analysis'];
        }
        // Analyze session patterns
        const followUpRatio = usage.totalQueries > 0 ? usage.followUpQueries / usage.totalQueries : 0;
        const avgRelevance = usage.avgRelevanceScore;
        if (followUpRatio > 0.8) {
            recommendations.push('High follow-up query usage detected - consider implementing query prediction for better performance');
        }
        if (avgRelevance < 0.7) {
            recommendations.push('Low context relevance scores - review query preprocessing and entity extraction');
        }
        const avgRetrievalTime = sessionMetrics
            .filter(m => m.metricType === 'retrieval_time_ms')
            .reduce((sum, m, _, arr) => sum + m.value / arr.length, 0);
        if (avgRetrievalTime > this.config.performanceThresholds.goodMs) {
            recommendations.push('Context retrieval performance could be improved with better caching strategies');
        }
        if (usage.sessionDurationMs > 2 * 60 * 60 * 1000) { // More than 2 hours
            recommendations.push('Long session detected - consider implementing context summarization to maintain performance');
        }
        if (recommendations.length === 0) {
            recommendations.push('Session performance is within acceptable parameters');
        }
        return recommendations;
    }
    // Private helper methods
    updatePatternStats(patterns, patternKey, sessionMetrics, isSuccess) {
        const existing = patterns.get(patternKey) || { count: 0, performanceTimes: [], successCount: 0 };
        existing.count++;
        if (isSuccess)
            existing.successCount++;
        // Add performance metrics
        const relevantMetrics = sessionMetrics.filter(m => ['retrieval_time_ms', 'context_enhancement_time_ms'].includes(m.metricType));
        existing.performanceTimes.push(...relevantMetrics.map(m => m.value));
        patterns.set(patternKey, existing);
    }
    generatePatternRecommendation(pattern, stats) {
        const avgPerformance = stats.performanceTimes.length > 0
            ? stats.performanceTimes.reduce((sum, time) => sum + time, 0) / stats.performanceTimes.length
            : 0;
        const successRate = stats.count > 0 ? stats.successCount / stats.count : 0;
        if (pattern.includes('high_followup')) {
            if (avgPerformance > this.config.performanceThresholds.goodMs) {
                return 'Implement context pre-loading for anticipated follow-up queries';
            }
            return 'Optimize follow-up detection algorithms for better accuracy';
        }
        if (pattern.includes('high_retrieval')) {
            return 'Consider implementing more aggressive caching for frequently retrieved contexts';
        }
        if (pattern.includes('long_session')) {
            return 'Implement context summarization to maintain performance in extended sessions';
        }
        if (successRate < 0.8) {
            return 'Review and optimize processing pipeline for this usage pattern';
        }
        return 'Continue monitoring this pattern for optimization opportunities';
    }
    calculateOverallMetrics() {
        const allMetrics = Array.from(this.metrics.values()).flat();
        const allQualityMetrics = Array.from(this.qualityMetrics.values());
        const allUsage = Array.from(this.usageData.values());
        const retrievalMetrics = allMetrics.filter(m => m.metricType === 'retrieval_time_ms');
        const avgRetrievalTime = retrievalMetrics.length > 0
            ? retrievalMetrics.reduce((sum, m) => sum + m.value, 0) / retrievalMetrics.length
            : 0;
        const avgAccuracy = allQualityMetrics.length > 0
            ? allQualityMetrics.reduce((sum, qm) => sum + qm.accuracy.contextRelevanceScore, 0) / allQualityMetrics.length
            : 0;
        const avgCacheHitRate = allQualityMetrics.length > 0
            ? allQualityMetrics.reduce((sum, qm) => sum + qm.performance.cacheHitRate, 0) / allQualityMetrics.length
            : 0;
        const avgStorageGrowth = allUsage.length > 0
            ? allUsage.reduce((sum, usage) => sum + usage.storageGrowthRate, 0) / allUsage.length
            : 0;
        return {
            avgRetrievalTime,
            avgAccuracy,
            avgCacheHitRate,
            avgStorageGrowth
        };
    }
}
exports.ContextUsageAnalyzerService = ContextUsageAnalyzerService;
//# sourceMappingURL=ContextUsageAnalyzer.js.map