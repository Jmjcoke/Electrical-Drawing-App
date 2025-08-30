import { EventEmitter } from 'events';
import { sharedStorageLogger } from './shared-storage.logger';
import { sharedStorageMetrics } from './shared-storage.metrics';
import {
  ErrorAnalyticsConfig,
  ErrorPattern,
  ErrorTrend,
  PredictiveFailureData,
  ImpactAssessment,
  IncidentIntelligence,
  ErrorCorrelation,
  LearningModel,
  ErrorAnalyticsResult,
  defaultErrorAnalyticsConfig
} from './error-analytics.types';

/**
 * Advanced Error Analytics & Intelligence Service
 * Provides error trend analysis, predictive failure detection, and incident intelligence
 */
export class ErrorAnalyticsService extends EventEmitter {
  private readonly errorPatterns: Map<string, ErrorPattern> = new Map();
  private readonly errorTrends: Map<string, ErrorTrend> = new Map();
  private readonly predictiveModels: Map<string, PredictiveFailureData> = new Map();
  private readonly incidentIntelligence: Map<string, IncidentIntelligence> = new Map();
  private readonly learningModels: Map<string, LearningModel> = new Map();
  private readonly errorHistory: ErrorContext[] = [];
  private readonly maxHistorySize = 10000;

  constructor(
    private readonly config: ErrorAnalyticsConfig = defaultErrorAnalyticsConfig
  ) {
    super();
    this.initializeErrorAnalytics();
  }

  /**
   * Initialize error analytics service
   */
  private initializeErrorAnalytics(): void {
    // Set up periodic analysis and learning
    setInterval(() => {
      this.analyzeErrorTrends();
      this.updatePredictiveModels();
      this.performImpactAssessment();
      this.generateIncidentIntelligence();
    }, this.config.analysisInterval);

    // Initialize default error patterns
    this.initializeDefaultErrorPatterns();

    sharedStorageLogger.logInfo('Error Analytics Service initialized', {
      analysisInterval: this.config.analysisInterval,
      predictionWindow: this.config.predictionWindow,
      learningRate: this.config.learningRate
    });
  }

  /**
   * Initialize default error patterns for common issues
   */
  private initializeDefaultErrorPatterns(): void {
    const patterns: ErrorPattern[] = [
      {
        id: 'circuit_breaker_pattern',
        name: 'Circuit Breaker Activation',
        description: 'Pattern of circuit breaker opening due to high failure rates',
        errorTypes: ['CircuitBreakerError', 'ServiceUnavailable'],
        frequency: 'high',
        severity: 'high',
        indicators: ['circuit breaker opened', 'service unavailable'],
        mitigationStrategies: [
          'Check dependent service health',
          'Implement gradual recovery',
          'Scale up service instances'
        ]
      },
      {
        id: 'memory_exhaustion_pattern',
        name: 'Memory Exhaustion',
        description: 'Progressive memory usage leading to out of memory errors',
        errorTypes: ['OutOfMemoryError', 'MemoryAllocationError'],
        frequency: 'medium',
        severity: 'critical',
        indicators: ['out of memory', 'heap exhaustion', 'memory allocation failed'],
        mitigationStrategies: [
          'Increase memory limits',
          'Implement memory cleanup',
          'Add memory monitoring alerts'
        ]
      },
      {
        id: 'network_timeout_pattern',
        name: 'Network Timeouts',
        description: 'Increasing network timeout errors indicating connectivity issues',
        errorTypes: ['TimeoutError', 'ConnectionTimeout'],
        frequency: 'high',
        severity: 'medium',
        indicators: ['timeout', 'connection refused', 'network unreachable'],
        mitigationStrategies: [
          'Check network connectivity',
          'Implement retry with backoff',
          'Add circuit breaker for network calls'
        ]
      },
      {
        id: 'database_connection_pattern',
        name: 'Database Connection Issues',
        description: 'Database connection pool exhaustion or connectivity problems',
        errorTypes: ['ConnectionError', 'PoolExhaustedError'],
        frequency: 'medium',
        severity: 'high',
        indicators: ['connection pool exhausted', 'database unreachable', 'connection timeout'],
        mitigationStrategies: [
          'Increase connection pool size',
          'Implement connection health checks',
          'Add database failover'
        ]
      }
    ];

    patterns.forEach(pattern => {
      this.errorPatterns.set(pattern.id, pattern);
    });
  }

  /**
   * Record error for analysis
   */
  recordError(errorContext: ErrorContext): void {
    // Add to history
    this.errorHistory.push(errorContext);

    // Maintain history size limit
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Update error patterns
    this.updateErrorPatterns(errorContext);

    // Update trends
    this.updateErrorTrends(errorContext);

    // Check for predictive indicators
    this.checkPredictiveIndicators(errorContext);

    sharedStorageLogger.logInfo('Error recorded for analysis', {
      errorId: errorContext.id,
      errorType: errorContext.errorType,
      severity: errorContext.severity,
      service: errorContext.service
    });
  }

  /**
   * Analyze error trends
   */
  private analyzeErrorTrends(): void {
    const now = Date.now();
    const analysisWindow = this.config.analysisWindow;

    // Group errors by time windows
    const timeWindows = this.createTimeWindows(now - analysisWindow, now, 15 * 60 * 1000); // 15-minute windows

    for (const window of timeWindows) {
      const windowErrors = this.errorHistory.filter(
        error => error.timestamp >= window.start && error.timestamp < window.end
      );

      const errorCounts = this.countErrorsByType(windowErrors);
      const trend = this.calculateTrend(errorCounts);

      this.errorTrends.set(`trend_${window.start}_${window.end}`, {
        timeWindow: window,
        errorCounts,
        trend,
        anomalyScore: this.calculateAnomalyScore(errorCounts),
        predictedIncrease: this.predictErrorIncrease(errorCounts)
      });
    }

    // Emit trend analysis results
    this.emit('trendAnalysisComplete', {
      trends: Array.from(this.errorTrends.values()),
      timestamp: now
    });
  }

  /**
   * Update predictive models
   */
  private updatePredictiveModels(): void {
    for (const [patternId, pattern] of this.errorPatterns.entries()) {
      const predictiveData = this.generatePredictiveData(pattern);
      this.predictiveModels.set(patternId, predictiveData);

      // Check for failure predictions
      if (predictiveData.failureProbability > this.config.failurePredictionThreshold) {
        this.emit('failurePredicted', {
          patternId,
          pattern: pattern.name,
          probability: predictiveData.failureProbability,
          timeToFailure: predictiveData.timeToFailure,
          recommendedActions: predictiveData.recommendedActions
        });
      }
    }
  }

  /**
   * Perform impact assessment
   */
  private performImpactAssessment(): void {
    const recentErrors = this.errorHistory.filter(
      error => Date.now() - error.timestamp < this.config.impactAssessmentWindow
    );

    const impactAssessment: ImpactAssessment = {
      timestamp: Date.now(),
      affectedServices: this.identifyAffectedServices(recentErrors),
      errorVolume: recentErrors.length,
      severityDistribution: this.calculateSeverityDistribution(recentErrors),
      businessImpact: this.assessBusinessImpact(recentErrors),
      recommendedActions: this.generateImpactRecommendations(recentErrors)
    };

    this.emit('impactAssessmentComplete', impactAssessment);
  }

  /**
   * Generate incident intelligence
   */
  private generateIncidentIntelligence(): void {
    const recentErrors = this.errorHistory.filter(
      error => Date.now() - error.timestamp < this.config.incidentIntelligenceWindow
    );

    if (recentErrors.length < this.config.minErrorsForIncident) {
      return;
    }

    const intelligence: IncidentIntelligence = {
      id: this.generateIncidentId(),
      timestamp: Date.now(),
      title: this.generateIncidentTitle(recentErrors),
      description: this.generateIncidentDescription(recentErrors),
      severity: this.calculateIncidentSeverity(recentErrors),
      affectedComponents: this.identifyAffectedComponents(recentErrors),
      rootCause: this.analyzeRootCause(recentErrors),
      impact: this.assessIncidentImpact(recentErrors),
      resolutionSteps: this.generateResolutionSteps(recentErrors),
      preventionMeasures: this.generatePreventionMeasures(recentErrors)
    };

    this.incidentIntelligence.set(intelligence.id, intelligence);

    this.emit('incidentIntelligenceGenerated', intelligence);
  }

  /**
   * Update error patterns based on new error
   */
  private updateErrorPatterns(errorContext: ErrorContext): void {
    for (const [patternId, pattern] of this.errorPatterns.entries()) {
      if (this.matchesPattern(errorContext, pattern)) {
        pattern.occurrences++;
        pattern.lastSeen = errorContext.timestamp;
        pattern.averageFrequency = this.calculateAverageFrequency(pattern);

        // Update pattern learning
        this.updatePatternLearning(pattern, errorContext);
      }
    }
  }

  /**
   * Update error trends
   */
  private updateErrorTrends(errorContext: ErrorContext): void {
    const trendKey = this.generateTrendKey(errorContext.timestamp);
    let trend = this.errorTrends.get(trendKey);

    if (!trend) {
      trend = {
        timeWindow: {
          start: errorContext.timestamp - (errorContext.timestamp % (15 * 60 * 1000)),
          end: errorContext.timestamp - (errorContext.timestamp % (15 * 60 * 1000)) + (15 * 60 * 1000)
        },
        errorCounts: new Map(),
        trend: 'stable',
        anomalyScore: 0,
        predictedIncrease: 0
      };
      this.errorTrends.set(trendKey, trend);
    }

    const currentCount = trend.errorCounts.get(errorContext.errorType) || 0;
    trend.errorCounts.set(errorContext.errorType, currentCount + 1);
  }

  /**
   * Check predictive indicators
   */
  private checkPredictiveIndicators(errorContext: ErrorContext): void {
    // Check for early warning signs
    const recentErrors = this.errorHistory.filter(
      error => Date.now() - error.timestamp < this.config.earlyWarningWindow
    );

    const errorRate = recentErrors.length / (this.config.earlyWarningWindow / 1000);

    if (errorRate > this.config.errorRateThreshold) {
      this.emit('earlyWarning', {
        message: 'High error rate detected',
        errorRate,
        threshold: this.config.errorRateThreshold,
        recentErrors: recentErrors.length,
        timeWindow: this.config.earlyWarningWindow
      });
    }
  }

  /**
   * Utility methods
   */
  private matchesPattern(errorContext: ErrorContext, pattern: ErrorPattern): boolean {
    return pattern.errorTypes.includes(errorContext.errorType) ||
           pattern.indicators.some(indicator =>
             errorContext.message.toLowerCase().includes(indicator.toLowerCase())
           );
  }

  private updatePatternLearning(pattern: ErrorPattern, errorContext: ErrorContext): void {
    // Update learning model for this pattern
    const learningKey = `${pattern.id}_learning`;
    let learningModel = this.learningModels.get(learningKey);

    if (!learningModel) {
      learningModel = {
        patternId: pattern.id,
        features: [],
        weights: new Map(),
        accuracy: 0,
        lastUpdated: Date.now()
      };
      this.learningModels.set(learningKey, learningModel);
    }

    // Simple learning: update weights based on error characteristics
    this.updateLearningWeights(learningModel, errorContext);
    learningModel.lastUpdated = Date.now();
  }

  private updateLearningWeights(model: LearningModel, errorContext: ErrorContext): void {
    // Implement simple reinforcement learning for pattern recognition
    const features = this.extractErrorFeatures(errorContext);

    features.forEach(feature => {
      const currentWeight = model.weights.get(feature) || 0;
      model.weights.set(feature, currentWeight + this.config.learningRate);
    });
  }

  private extractErrorFeatures(errorContext: ErrorContext): string[] {
    const features: string[] = [];

    // Extract features from error message
    if (errorContext.message.includes('timeout')) features.push('timeout');
    if (errorContext.message.includes('connection')) features.push('connection');
    if (errorContext.message.includes('memory')) features.push('memory');
    if (errorContext.message.includes('circuit')) features.push('circuit_breaker');

    // Add severity as feature
    features.push(`severity_${errorContext.severity}`);

    // Add service as feature
    features.push(`service_${errorContext.service}`);

    return features;
  }

  private createTimeWindows(start: number, end: number, windowSize: number): Array<{ start: number; end: number }> {
    const windows: Array<{ start: number; end: number }> = [];

    for (let windowStart = start; windowStart < end; windowStart += windowSize) {
      windows.push({
        start: windowStart,
        end: Math.min(windowStart + windowSize, end)
      });
    }

    return windows;
  }

  private countErrorsByType(errors: ErrorContext[]): Map<string, number> {
    const counts = new Map<string, number>();

    errors.forEach(error => {
      const currentCount = counts.get(error.errorType) || 0;
      counts.set(error.errorType, currentCount + 1);
    });

    return counts;
  }

  private calculateTrend(errorCounts: Map<string, number>): 'increasing' | 'decreasing' | 'stable' {
    // Simple trend calculation - in production, use more sophisticated algorithms
    const totalErrors = Array.from(errorCounts.values()).reduce((sum, count) => sum + count, 0);

    // Compare with previous trend data
    const previousTrends = Array.from(this.errorTrends.values())
      .slice(-2) // Get last 2 trends
      .map(trend => Array.from(trend.errorCounts.values()).reduce((sum, count) => sum + count, 0));

    if (previousTrends.length < 2) return 'stable';

    const avgPrevious = previousTrends.reduce((sum, count) => sum + count, 0) / previousTrends.length;

    if (totalErrors > avgPrevious * 1.2) return 'increasing';
    if (totalErrors < avgPrevious * 0.8) return 'decreasing';

    return 'stable';
  }

  private calculateAnomalyScore(errorCounts: Map<string, number>): number {
    // Calculate anomaly score based on deviation from normal patterns
    const totalErrors = Array.from(errorCounts.values()).reduce((sum, count) => sum + count, 0);

    // Simple anomaly detection - compare with historical average
    const historicalAverage = this.calculateHistoricalAverage();

    if (historicalAverage === 0) return 0;

    const deviation = Math.abs(totalErrors - historicalAverage) / historicalAverage;
    return Math.min(deviation * 100, 100); // Cap at 100
  }

  private predictErrorIncrease(errorCounts: Map<string, number>): number {
    // Simple linear prediction based on recent trends
    const recentTrends = Array.from(this.errorTrends.values()).slice(-5);
    if (recentTrends.length < 2) return 0;

    const errorVolumes = recentTrends.map(trend =>
      Array.from(trend.errorCounts.values()).reduce((sum, count) => sum + count, 0)
    );

    // Calculate slope of error volume over time
    const n = errorVolumes.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = errorVolumes.reduce((sum, volume) => sum + volume, 0);
    const sumXY = errorVolumes.reduce((sum, volume, index) => sum + volume * index, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    return Math.max(0, slope); // Return positive slope as prediction
  }

  private calculateHistoricalAverage(): number {
    const allTrends = Array.from(this.errorTrends.values());
    if (allTrends.length === 0) return 0;

    const totalErrors = allTrends.map(trend =>
      Array.from(trend.errorCounts.values()).reduce((sum, count) => sum + count, 0)
    ).reduce((sum, count) => sum + count, 0);

    return totalErrors / allTrends.length;
  }

  private generatePredictiveData(pattern: ErrorPattern): PredictiveFailureData {
    const recentErrors = this.errorHistory.filter(
      error => this.matchesPattern(error, pattern) &&
               Date.now() - error.timestamp < this.config.predictionWindow
    );

    const errorRate = recentErrors.length / (this.config.predictionWindow / 1000);

    // Simple prediction based on current error rate
    const failureProbability = Math.min(errorRate * pattern.frequency === 'high' ? 2 : 1, 1);
    const timeToFailure = failureProbability > 0.8 ? Math.random() * 3600000 : null; // Random 0-1 hour

    return {
      patternId: pattern.id,
      failureProbability,
      timeToFailure,
      confidence: 0.7, // Mock confidence score
      indicators: pattern.indicators,
      recommendedActions: pattern.mitigationStrategies
    };
  }

  private identifyAffectedServices(errors: ErrorContext[]): string[] {
    return [...new Set(errors.map(error => error.service))];
  }

  private calculateSeverityDistribution(errors: ErrorContext[]): Record<string, number> {
    const distribution: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    errors.forEach(error => {
      distribution[error.severity] = (distribution[error.severity] || 0) + 1;
    });

    return distribution;
  }

  private assessBusinessImpact(errors: ErrorContext[]): string {
    const severityDistribution = this.calculateSeverityDistribution(errors);
    const criticalCount = severityDistribution.critical || 0;
    const highCount = severityDistribution.high || 0;

    if (criticalCount > 5 || highCount > 20) return 'high';
    if (criticalCount > 2 || highCount > 10) return 'medium';
    return 'low';
  }

  private generateImpactRecommendations(errors: ErrorContext[]): string[] {
    const recommendations: string[] = [];
    const severityDistribution = this.calculateSeverityDistribution(errors);

    if (severityDistribution.critical > 0) {
      recommendations.push('Immediate attention required for critical errors');
    }

    if (severityDistribution.high > 10) {
      recommendations.push('Consider scaling up affected services');
    }

    if (this.calculateAnomalyScore(this.countErrorsByType(errors)) > 50) {
      recommendations.push('Investigate anomalous error patterns');
    }

    return recommendations;
  }

  private generateIncidentId(): string {
    return `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateIncidentTitle(errors: ErrorContext[]): string {
    const errorTypes = [...new Set(errors.map(e => e.errorType))];
    const affectedServices = this.identifyAffectedServices(errors);

    return `Multiple ${errorTypes.join(', ')} errors affecting ${affectedServices.join(', ')}`;
  }

  private generateIncidentDescription(errors: ErrorContext[]): string {
    const errorCount = errors.length;
    const timeSpan = Date.now() - Math.min(...errors.map(e => e.timestamp));
    const timeSpanMinutes = Math.round(timeSpan / 60000);

    return `${errorCount} errors occurred over the last ${timeSpanMinutes} minutes`;
  }

  private calculateIncidentSeverity(errors: ErrorContext[]): 'low' | 'medium' | 'high' | 'critical' {
    const severityDistribution = this.calculateSeverityDistribution(errors);
    const criticalCount = severityDistribution.critical || 0;
    const highCount = severityDistribution.high || 0;

    if (criticalCount > 10 || highCount > 50) return 'critical';
    if (criticalCount > 5 || highCount > 25) return 'high';
    if (criticalCount > 1 || highCount > 10) return 'medium';
    return 'low';
  }

  private identifyAffectedComponents(errors: ErrorContext[]): string[] {
    const components: string[] = [];

    if (errors.some(e => e.service.includes('storage'))) components.push('SharedStorageService');
    if (errors.some(e => e.message.includes('circuit'))) components.push('CircuitBreaker');
    if (errors.some(e => e.message.includes('redis'))) components.push('Redis');
    if (errors.some(e => e.message.includes('network'))) components.push('Network');

    return components;
  }

  private analyzeRootCause(errors: ErrorContext[]): string {
    // Simple root cause analysis based on error patterns
    const timeoutErrors = errors.filter(e => e.message.includes('timeout')).length;
    const connectionErrors = errors.filter(e => e.message.includes('connection')).length;
    const memoryErrors = errors.filter(e => e.message.includes('memory')).length;

    const maxErrors = Math.max(timeoutErrors, connectionErrors, memoryErrors);

    if (maxErrors === timeoutErrors) return 'Network connectivity issues';
    if (maxErrors === connectionErrors) return 'Service dependency failures';
    if (maxErrors === memoryErrors) return 'Resource exhaustion';

    return 'Multiple contributing factors';
  }

  private assessIncidentImpact(errors: ErrorContext[]): string {
    const severity = this.calculateIncidentSeverity(errors);
    const affectedServices = this.identifyAffectedServices(errors);

    return `${severity} impact affecting ${affectedServices.length} services`;
  }

  private generateResolutionSteps(errors: ErrorContext[]): string[] {
    const steps: string[] = [];
    const rootCause = this.analyzeRootCause(errors);

    steps.push(`1. Identify root cause: ${rootCause}`);
    steps.push('2. Isolate affected components');
    steps.push('3. Implement immediate mitigation');
    steps.push('4. Monitor recovery progress');
    steps.push('5. Document lessons learned');

    return steps;
  }

  private generatePreventionMeasures(errors: ErrorContext[]): string[] {
    const measures: string[] = [];
    const rootCause = this.analyzeRootCause(errors);

    if (rootCause.includes('Network')) {
      measures.push('Implement circuit breakers for network calls');
      measures.push('Add network monitoring and alerting');
    }

    if (rootCause.includes('Resource')) {
      measures.push('Implement resource usage monitoring');
      measures.push('Add auto-scaling based on resource metrics');
    }

    measures.push('Enhance error handling and retry logic');
    measures.push('Implement comprehensive logging and monitoring');

    return measures;
  }

  private generateTrendKey(timestamp: number): string {
    const windowSize = 15 * 60 * 1000; // 15 minutes
    const windowStart = timestamp - (timestamp % windowSize);
    return `trend_${windowStart}`;
  }

  /**
   * Get error analytics results
   */
  getErrorAnalytics(): ErrorAnalyticsResult {
    return {
      timestamp: Date.now(),
      totalErrors: this.errorHistory.length,
      errorPatterns: Array.from(this.errorPatterns.values()),
      activeTrends: Array.from(this.errorTrends.values()),
      predictiveInsights: Array.from(this.predictiveModels.values()),
      recentIncidents: Array.from(this.incidentIntelligence.values()).slice(-10),
      systemHealth: this.assessSystemHealth()
    };
  }

  private assessSystemHealth(): 'healthy' | 'warning' | 'critical' {
    const recentErrors = this.errorHistory.filter(
      error => Date.now() - error.timestamp < 3600000 // Last hour
    );

    const errorRate = recentErrors.length / 3600; // Errors per second

    if (errorRate > 10) return 'critical';
    if (errorRate > 1) return 'warning';
    return 'healthy';
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.errorPatterns.clear();
    this.errorTrends.clear();
    this.predictiveModels.clear();
    this.incidentIntelligence.clear();
    this.learningModels.clear();
    this.errorHistory.length = 0;
    sharedStorageLogger.logInfo('Error Analytics Service cleaned up');
  }
}

// Export factory function
export const createErrorAnalyticsService = (config?: ErrorAnalyticsConfig) => {
  return new ErrorAnalyticsService(config);
};
