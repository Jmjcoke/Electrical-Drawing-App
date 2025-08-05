/**
 * ContextAnalytics Service
 * Provides comprehensive analytics and metrics tracking for context management system
 */

import type {
  ContextMetrics,
  ContextMetricType,
  ContextQualityMetrics,
  ContextAccuracyMetrics,
  ContextPerformanceMetrics,
  ContextStorageMetrics,
  ContextUsageAnalytics,
  ConversationContext
} from '../../../../shared/types/context';

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

export class ContextAnalyticsService {
  private readonly config: ContextAnalyticsConfig;
  private readonly metrics = new Map<string, ContextMetrics[]>();
  private readonly qualityMetrics = new Map<string, ContextQualityMetrics>();
  private readonly usageAnalytics = new Map<string, ContextUsageAnalytics>();
  private readonly performanceHistory = new Map<string, number[]>();

  constructor(config: ContextAnalyticsConfig) {
    this.config = config;
  }

  /**
   * Records a performance metric for context operations
   * @param sessionId - Session identifier
   * @param contextId - Context identifier
   * @param metricType - Type of metric being recorded
   * @param value - Metric value
   * @param metadata - Additional metric metadata
   */
  recordMetric(
    sessionId: string,
    contextId: string,
    metricType: ContextMetricType,
    value: number,
    metadata: Record<string, unknown> = {}
  ): void {
    const metric: ContextMetrics = {
      timestamp: new Date(),
      sessionId,
      contextId,
      metricType,
      value,
      metadata
    };

    const key = `${sessionId}:${contextId}`;
    const existing = this.metrics.get(key) || [];
    existing.push(metric);
    this.metrics.set(key, existing);

    // Update performance history for trend analysis
    this.updatePerformanceHistory(metricType, value);

    // Clean up old metrics if needed
    this.cleanupOldMetrics(key);
  }

  /**
   * Records context quality metrics
   * @param context - Conversation context
   * @param accuracyScores - Accuracy measurement results
   * @param performanceTiming - Performance timing data
   */
  recordQualityMetrics(
    context: ConversationContext,
    accuracyScores: Partial<ContextAccuracyMetrics>,
    performanceTiming: Partial<ContextPerformanceMetrics>
  ): void {
    const storageMetrics = this.calculateStorageMetrics(context);
    
    const qualityMetrics: ContextQualityMetrics = {
      contextId: context.id,
      sessionId: context.sessionId,
      accuracy: {
        followUpDetectionAccuracy: accuracyScores.followUpDetectionAccuracy || 0,
        entityResolutionAccuracy: accuracyScores.entityResolutionAccuracy || 0,
        contextRelevanceScore: accuracyScores.contextRelevanceScore || 0,
        userSatisfactionScore: accuracyScores.userSatisfactionScore || 0,
        falsePositiveRate: accuracyScores.falsePositiveRate || 0,
        falseNegativeRate: accuracyScores.falseNegativeRate || 0
      },
      performance: {
        retrievalTimeMs: performanceTiming.retrievalTimeMs || 0,
        enhancementTimeMs: performanceTiming.enhancementTimeMs || 0,
        summarizationTimeMs: performanceTiming.summarizationTimeMs || 0,
        totalProcessingTimeMs: performanceTiming.totalProcessingTimeMs || 0,
        cacheHitRate: performanceTiming.cacheHitRate || 0,
        memoryUsageMb: performanceTiming.memoryUsageMb || 0
      },
      storage: storageMetrics,
      timestamp: new Date()
    };

    this.qualityMetrics.set(context.id, qualityMetrics);
  }

  /**
   * Updates usage analytics for a session
   * @param sessionId - Session identifier
   * @param updateData - Usage data to update
   */
  updateUsageAnalytics(
    sessionId: string,
    updateData: Partial<ContextUsageAnalytics>
  ): void {
    const existing = this.usageAnalytics.get(sessionId) || {
      sessionId,
      totalQueries: 0,
      followUpQueries: 0,
      contextRetrievals: 0,
      enhancementRequests: 0,
      avgRelevanceScore: 0,
      mostUsedContextTypes: [],
      sessionDurationMs: 0,
      storageGrowthRate: 0,
      timestamp: new Date()
    };

    const updated: ContextUsageAnalytics = {
      ...existing,
      ...updateData,
      timestamp: new Date()
    };

    this.usageAnalytics.set(sessionId, updated);
  }

  /**
   * Retrieves performance metrics for a specific time period
   * @param sessionId - Session identifier
   * @param contextId - Optional context identifier
   * @param fromDate - Start date for metrics
   * @param toDate - End date for metrics
   * @returns Array of context metrics
   */
  getMetrics(
    sessionId: string,
    contextId?: string,
    fromDate?: Date,
    toDate?: Date
  ): ContextMetrics[] {
    const key = contextId ? `${sessionId}:${contextId}` : sessionId;
    let metrics: ContextMetrics[] = [];

    if (contextId) {
      metrics = this.metrics.get(key) || [];
    } else {
      // Aggregate metrics from all contexts in the session
      for (const [metricKey, metricList] of this.metrics.entries()) {
        if (metricKey.startsWith(`${sessionId}:`)) {
          metrics.push(...metricList);
        }
      }
    }

    // Filter by date range if provided
    if (fromDate || toDate) {
      metrics = metrics.filter(metric => {
        const timestamp = metric.timestamp;
        if (fromDate && timestamp < fromDate) return false;
        if (toDate && timestamp > toDate) return false;
        return true;
      });
    }

    return metrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Retrieves aggregated quality metrics
   * @param contextId - Optional context identifier
   * @returns Quality metrics or aggregated metrics
   */
  getQualityMetrics(contextId?: string): ContextQualityMetrics | ContextQualityMetrics[] | null {
    if (contextId) {
      return this.qualityMetrics.get(contextId) || null;
    }

    return Array.from(this.qualityMetrics.values());
  }

  /**
   * Generates usage analytics report
   * @param sessionId - Optional session identifier
   * @returns Usage analytics data
   */
  getUsageAnalytics(sessionId?: string): ContextUsageAnalytics | ContextUsageAnalytics[] | null {
    if (sessionId) {
      return this.usageAnalytics.get(sessionId) || null;
    }

    return Array.from(this.usageAnalytics.values());
  }

  /**
   * Analyzes performance trends over time
   * @param metricType - Type of metric to analyze
   * @param windowSize - Number of recent values to analyze
   * @returns Trend analysis results
   */
  analyzePerformanceTrends(
    metricType: ContextMetricType,
    windowSize: number = 100
  ): {
    trend: 'improving' | 'degrading' | 'stable';
    averageValue: number;
    standardDeviation: number;
    recentAverage: number;
    changePercentage: number;
  } {
    const history = this.performanceHistory.get(metricType) || [];
    if (history.length < 2) {
      return {
        trend: 'stable',
        averageValue: history[0] || 0,
        standardDeviation: 0,
        recentAverage: history[0] || 0,
        changePercentage: 0
      };
    }

    const recentValues = history.slice(-windowSize);
    const averageValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
    
    // Calculate standard deviation
    const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - averageValue, 2), 0) / recentValues.length;
    const standardDeviation = Math.sqrt(variance);

    // Compare recent performance to historical
    const recentWindow = Math.min(10, recentValues.length);
    const recentAverage = recentValues.slice(-recentWindow).reduce((sum, val) => sum + val, 0) / recentWindow;
    const historicalAverage = recentValues.slice(0, -recentWindow).reduce((sum, val) => sum + val, 0) / (recentValues.length - recentWindow);
    
    const changePercentage = historicalAverage > 0 ? ((recentAverage - historicalAverage) / historicalAverage) * 100 : 0;
    
    let trend: 'improving' | 'degrading' | 'stable' = 'stable';
    if (Math.abs(changePercentage) > 5) {
      // For performance metrics, lower values are generally better
      trend = changePercentage < 0 ? 'improving' : 'degrading';
    }

    return {
      trend,
      averageValue,
      standardDeviation,
      recentAverage,
      changePercentage
    };
  }

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
  } {
    const allMetrics = sessionId 
      ? this.getMetrics(sessionId)
      : Array.from(this.metrics.values()).flat();

    const allQualityMetrics = sessionId
      ? [this.getQualityMetrics(sessionId)].filter(Boolean) as ContextQualityMetrics[]
      : this.getQualityMetrics() as ContextQualityMetrics[];

    // Calculate averages
    const performanceMetrics = allMetrics.filter(m => 
      ['retrieval_time_ms', 'context_enhancement_time_ms', 'follow_up_detection_time_ms'].includes(m.metricType)
    );

    const avgPerformance: Record<string, number> = {};
    for (const metricType of ['retrieval_time_ms', 'context_enhancement_time_ms', 'follow_up_detection_time_ms']) {
      const values = performanceMetrics.filter(m => m.metricType === metricType).map(m => m.value);
      avgPerformance[metricType] = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
    }

    const avgAccuracy = allQualityMetrics.length > 0
      ? allQualityMetrics.reduce((sum, qm) => sum + qm.accuracy.contextRelevanceScore, 0) / allQualityMetrics.length
      : 0;

    const avgRelevanceScore = allQualityMetrics.length > 0
      ? allQualityMetrics.reduce((sum, qm) => sum + qm.accuracy.contextRelevanceScore, 0) / allQualityMetrics.length
      : 0;

    // Generate performance grade
    const performanceGrade = this.calculatePerformanceGrade(avgPerformance, avgAccuracy);

    // Generate recommendations
    const recommendations = this.generateRecommendations(avgPerformance, allQualityMetrics);

    return {
      overview: {
        totalSessions: sessionId ? 1 : this.usageAnalytics.size,
        totalContexts: sessionId ? 1 : this.qualityMetrics.size,
        totalMetrics: allMetrics.length,
        avgPerformance
      },
      quality: {
        avgAccuracy,
        avgRelevanceScore,
        performanceGrade
      },
      recommendations
    };
  }

  // Private helper methods

  private calculateStorageMetrics(context: ConversationContext): ContextStorageMetrics {
    // Estimate storage size (simplified calculation)
    const contextJson = JSON.stringify(context);
    const totalSizeBytes = Buffer.byteLength(contextJson, 'utf8');
    
    // Estimate compression (assuming typical 30-50% compression)
    const compressionRatio = 0.4;
    const compressedSizeBytes = Math.floor(totalSizeBytes * compressionRatio);

    const entityCount = context.cumulativeContext.extractedEntities.size;
    const documentReferenceCount = context.cumulativeContext.documentContext.length;

    return {
      totalSizeBytes,
      compressedSizeBytes,
      compressionRatio,
      turnCount: context.conversationThread.length,
      entityCount,
      documentReferenceCount
    };
  }

  private updatePerformanceHistory(metricType: ContextMetricType, value: number): void {
    const existing = this.performanceHistory.get(metricType) || [];
    existing.push(value);
    
    // Keep only recent history (last 1000 values)
    if (existing.length > 1000) {
      existing.splice(0, existing.length - 1000);
    }
    
    this.performanceHistory.set(metricType, existing);
  }

  private cleanupOldMetrics(key: string): void {
    const metrics = this.metrics.get(key) || [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.metricsRetentionDays);

    const filtered = metrics.filter(metric => metric.timestamp >= cutoffDate);
    this.metrics.set(key, filtered);
  }

  private calculatePerformanceGrade(
    avgPerformance: Record<string, number>,
    avgAccuracy: number
  ): 'A' | 'B' | 'C' | 'D' | 'F' {
    const retrievalTime = avgPerformance.retrieval_time_ms || 0;
    const enhancementTime = avgPerformance.context_enhancement_time_ms || 0;

    // Grade based on performance thresholds and accuracy
    let score = 0;

    // Performance scoring (40% of grade)
    if (retrievalTime <= this.config.performanceThresholds.retrievalTimeMs) score += 20;
    else if (retrievalTime <= this.config.performanceThresholds.retrievalTimeMs * 1.5) score += 15;
    else if (retrievalTime <= this.config.performanceThresholds.retrievalTimeMs * 2) score += 10;

    if (enhancementTime <= this.config.performanceThresholds.enhancementTimeMs) score += 20;
    else if (enhancementTime <= this.config.performanceThresholds.enhancementTimeMs * 1.5) score += 15;
    else if (enhancementTime <= this.config.performanceThresholds.enhancementTimeMs * 2) score += 10;

    // Accuracy scoring (60% of grade)
    if (avgAccuracy >= 0.9) score += 60;
    else if (avgAccuracy >= 0.8) score += 48;
    else if (avgAccuracy >= 0.7) score += 36;
    else if (avgAccuracy >= 0.6) score += 24;
    else if (avgAccuracy >= 0.5) score += 12;

    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private generateRecommendations(
    avgPerformance: Record<string, number>,
    qualityMetrics: ContextQualityMetrics[]
  ): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (avgPerformance.retrieval_time_ms > this.config.performanceThresholds.retrievalTimeMs) {
      recommendations.push('Consider optimizing context retrieval algorithms or adding more aggressive caching');
    }

    if (avgPerformance.context_enhancement_time_ms > this.config.performanceThresholds.enhancementTimeMs) {
      recommendations.push('Context enhancement is taking longer than expected - review query preprocessing pipeline');
    }

    // Accuracy recommendations
    const avgFollowUpAccuracy = qualityMetrics.length > 0
      ? qualityMetrics.reduce((sum, qm) => sum + qm.accuracy.followUpDetectionAccuracy, 0) / qualityMetrics.length
      : 0;

    if (avgFollowUpAccuracy < 0.8) {
      recommendations.push('Follow-up detection accuracy is below 80% - consider improving reference resolution algorithms');
    }

    // Storage recommendations
    const avgCompressionRatio = qualityMetrics.length > 0
      ? qualityMetrics.reduce((sum, qm) => sum + qm.storage.compressionRatio, 0) / qualityMetrics.length
      : 0;

    if (avgCompressionRatio > 0.7) {
      recommendations.push('Context storage is not compressing well - review summarization strategies');
    }

    if (recommendations.length === 0) {
      recommendations.push('Context management system is performing well within all thresholds');
    }

    return recommendations;
  }
}