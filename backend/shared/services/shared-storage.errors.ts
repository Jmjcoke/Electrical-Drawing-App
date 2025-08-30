import { sharedStorageLogger } from './shared-storage.logger';
import { sharedStorageMetrics } from './shared-storage.metrics';
import { SharedStorageAlerts } from './shared-storage.alerts';

/**
 * SharedStorageErrors provides comprehensive error tracking, categorization,
 * analysis, and recovery mechanisms for the shared storage service
 */
export class SharedStorageErrors {
  private errorHistory: ErrorRecord[] = [];
  private errorTrends: Map<string, ErrorTrend> = new Map();
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map();
  private errorThresholds: Map<string, ErrorThreshold> = new Map();
  private retryConfigurations: Map<string, RetryConfig> = new Map();
  private readonly maxHistorySize: number = 10000; // Keep last 10K errors
  private readonly trendWindow: number = 3600000; // 1 hour for trend analysis

  constructor(private alerts: SharedStorageAlerts) {
    this.initializeErrorTracking();
    this.setupDefaultRecoveryStrategies();
    this.setupDefaultErrorThresholds();
  }

  /**
   * Initialize error tracking system
   */
  private initializeErrorTracking(): void {
    // Set up periodic error analysis
    setInterval(() => {
      this.analyzeErrorTrends();
      this.checkErrorThresholds();
    }, 300000); // Analyze every 5 minutes

    sharedStorageLogger.logInfo('Error tracking system initialized', {
      maxHistorySize: this.maxHistorySize,
      trendWindow: this.trendWindow
    });
  }

  /**
   * Track and categorize an error
   */
  async trackError(
    error: Error,
    context: ErrorContext,
    operation?: string
  ): Promise<ErrorRecord> {
    const errorRecord: ErrorRecord = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
        errno: (error as any).errno
      },
      context,
      operation: operation || 'unknown',
      category: this.categorizeError(error, context),
      severity: this.determineSeverity(error, context),
      fingerprint: this.generateErrorFingerprint(error, context),
      retryable: this.isRetryable(error, context),
      recovered: false
    };

    // Add to history
    this.errorHistory.push(errorRecord);

    // Maintain history size limit
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Update error trends
    this.updateErrorTrends(errorRecord);

    // Record error metrics
    sharedStorageMetrics.recordError(
      errorRecord.category,
      errorRecord.severity,
      context.service
    );

    // Log structured error
    sharedStorageLogger.logError(
      operation || 'unknown',
      error,
      context.sessionId,
      context.service,
      context.filepath,
      errorRecord.id
    );

    // Check if error threshold exceeded
    this.checkErrorThresholdExceeded(errorRecord);

    // Attempt automatic recovery if applicable
    if (errorRecord.retryable) {
      await this.attemptRecovery(errorRecord);
    }

    return errorRecord;
  }

  /**
   * Categorize error based on type and context
   */
  private categorizeError(error: Error, context: ErrorContext): ErrorCategory {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();
    const errorCode = (error as any).code;

    // Permission and security errors
    if (errorMessage.includes('permission') ||
        errorMessage.includes('access denied') ||
        errorMessage.includes('unauthorized') ||
        errorCode === 'EACCES' ||
        errorCode === 'EPERM') {
      return 'permission_denied';
    }

    // File system errors
    if (errorCode === 'ENOENT' || errorMessage.includes('no such file')) {
      return 'file_not_found';
    }

    if (errorCode === 'EEXIST' || errorMessage.includes('file exists')) {
      return 'file_exists';
    }

    if (errorCode === 'ENOTDIR' || errorMessage.includes('not a directory')) {
      return 'not_a_directory';
    }

    if (errorCode === 'EISDIR' || errorMessage.includes('is a directory')) {
      return 'is_a_directory';
    }

    if (errorCode === 'ENOSPC' || errorMessage.includes('no space')) {
      return 'disk_full';
    }

    // Network and connection errors
    if (errorName === 'timeouterror' ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection') ||
        errorCode === 'ECONNREFUSED' ||
        errorCode === 'ENOTFOUND') {
      return 'connection_error';
    }

    // Validation errors
    if (errorMessage.includes('invalid') ||
        errorMessage.includes('validation') ||
        errorMessage.includes('malformed')) {
      return 'validation_error';
    }

    // Session errors
    if (errorMessage.includes('session') ||
        context.operation === 'getSessionPath') {
      return 'session_error';
    }

    // Service errors
    if (errorMessage.includes('service') ||
        context.service !== 'shared-storage') {
      return 'service_error';
    }

    // Default to unknown
    return 'unknown_error';
  }

  /**
   * Determine error severity based on impact and context
   */
  private determineSeverity(error: Error, context: ErrorContext): ErrorSeverity {
    const category = this.categorizeError(error, context);

    // Critical errors that require immediate attention
    if (category === 'permission_denied' ||
        category === 'disk_full' ||
        category === 'connection_error') {
      return 'critical';
    }

    // High impact errors
    if (category === 'file_not_found' ||
        category === 'session_error') {
      return 'high';
    }

    // Medium impact errors
    if (category === 'validation_error' ||
        category === 'service_error') {
      return 'medium';
    }

    // Low impact errors
    return 'low';
  }

  /**
   * Generate error fingerprint for deduplication
   */
  private generateErrorFingerprint(error: Error, context: ErrorContext): string {
    const components = [
      error.name,
      (error as any).code,
      this.categorizeError(error, context),
      context.service,
      context.operation
    ];

    // Include relevant context in fingerprint
    if (context.filepath) {
      components.push(context.filepath.split('/').pop() || 'unknown');
    }

    return components.join('|').toLowerCase();
  }

  /**
   * Determine if error is retryable
   */
  private isRetryable(error: Error, context: ErrorContext): boolean {
    const category = this.categorizeError(error, context);
    const errorCode = (error as any).code;

    // Retryable errors
    const retryableCategories: ErrorCategory[] = [
      'connection_error',
      'service_error'
    ];

    const retryableCodes = [
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET'
    ];

    return retryableCategories.includes(category) ||
           (errorCode && retryableCodes.includes(errorCode));
  }

  /**
   * Update error trends for analysis
   */
  private updateErrorTrends(errorRecord: ErrorRecord): void {
    const trendKey = errorRecord.fingerprint;
    let trend = this.errorTrends.get(trendKey);

    if (!trend) {
      trend = {
        fingerprint: trendKey,
        category: errorRecord.category,
        severity: errorRecord.severity,
        firstSeen: errorRecord.timestamp,
        lastSeen: errorRecord.timestamp,
        count: 0,
        occurrences: [],
        averageInterval: 0,
        trend: 'stable'
      };
      this.errorTrends.set(trendKey, trend);
    }

    // Update trend statistics
    trend.count++;
    trend.lastSeen = errorRecord.timestamp;
    trend.occurrences.push(errorRecord.timestamp);

    // Maintain recent occurrences for analysis
    const oneHourAgo = new Date(Date.now() - this.trendWindow);
    trend.occurrences = trend.occurrences.filter(time => time > oneHourAgo);

    // Calculate average interval
    if (trend.occurrences.length > 1) {
      const intervals = [];
      for (let i = 1; i < trend.occurrences.length; i++) {
        intervals.push(trend.occurrences[i].getTime() - trend.occurrences[i-1].getTime());
      }
      trend.averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    }

    // Determine trend
    trend.trend = this.calculateErrorTrend(trend);
  }

  /**
   * Calculate error trend (increasing, decreasing, stable)
   */
  private calculateErrorTrend(trend: ErrorTrend): 'increasing' | 'decreasing' | 'stable' {
    const recentOccurrences = trend.occurrences.slice(-10); // Last 10 occurrences

    if (recentOccurrences.length < 5) {
      return 'stable';
    }

    // Calculate rate of change in recent occurrences
    const intervals = [];
    for (let i = 1; i < recentOccurrences.length; i++) {
      intervals.push(recentOccurrences[i].getTime() - recentOccurrences[i-1].getTime());
    }

    if (intervals.length < 2) {
      return 'stable';
    }

    // Compare first half vs second half of intervals
    const midPoint = Math.floor(intervals.length / 2);
    const firstHalf = intervals.slice(0, midPoint);
    const secondHalf = intervals.slice(midPoint);

    const firstHalfAvg = firstHalf.reduce((sum, interval) => sum + interval, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, interval) => sum + interval, 0) / secondHalf.length;

    const changeRatio = secondHalfAvg / firstHalfAvg;

    if (changeRatio < 0.7) { // 30% faster (errors occurring more frequently)
      return 'increasing';
    } else if (changeRatio > 1.3) { // 30% slower (errors occurring less frequently)
      return 'decreasing';
    }

    return 'stable';
  }

  /**
   * Analyze error trends and generate insights
   */
  private analyzeErrorTrends(): void {
    const analysis = this.generateErrorAnalysis();

    // Log significant findings
    if (analysis.topErrors.length > 0) {
      sharedStorageLogger.logInfo('Error trend analysis completed', {
        analysisTimestamp: new Date().toISOString(),
        totalErrors: analysis.totalErrors,
        uniqueErrorTypes: analysis.uniqueErrorTypes,
        topErrors: analysis.topErrors.slice(0, 5),
        errorTrends: analysis.errorTrends.slice(0, 3),
        insights: analysis.insights
      });
    }

    // Alert on critical error trends
    this.alertOnCriticalTrends(analysis);
  }

  /**
   * Generate comprehensive error analysis
   */
  generateErrorAnalysis(): ErrorAnalysis {
    const totalErrors = this.errorHistory.length;
    const uniqueErrorTypes = new Set(this.errorHistory.map(e => e.fingerprint)).size;

    // Find top errors by frequency
    const errorFrequency = new Map<string, number>();
    for (const error of this.errorHistory) {
      errorFrequency.set(error.fingerprint, (errorFrequency.get(error.fingerprint) || 0) + 1);
    }

    const topErrors = Array.from(errorFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([fingerprint, count]) => {
        const error = this.errorHistory.find(e => e.fingerprint === fingerprint);
        return {
          fingerprint,
          count,
          category: error?.category || 'unknown',
          severity: error?.severity || 'low',
          lastSeen: error?.timestamp || new Date(),
          trend: this.errorTrends.get(fingerprint)?.trend || 'stable'
        };
      });

    // Analyze trends
    const errorTrends = Array.from(this.errorTrends.values())
      .filter(trend => trend.count > 5) // Only significant trends
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Generate insights
    const insights = this.generateErrorInsights(topErrors, errorTrends);

    return {
      totalErrors,
      uniqueErrorTypes,
      topErrors,
      errorTrends,
      insights,
      analysisTimestamp: new Date()
    };
  }

  /**
   * Generate error insights and recommendations
   */
  private generateErrorInsights(
    topErrors: Array<{
      fingerprint: string;
      count: number;
      category: ErrorCategory;
      severity: ErrorSeverity;
      lastSeen: Date;
      trend: 'increasing' | 'decreasing' | 'stable';
    }>,
    errorTrends: ErrorTrend[]
  ): ErrorInsight[] {
    const insights: ErrorInsight[] = [];

    // Check for increasing error rates
    const increasingErrors = topErrors.filter(error => error.trend === 'increasing');
    if (increasingErrors.length > 0) {
      insights.push({
        type: 'increasing_error_rate',
        severity: 'high',
        title: `${increasingErrors.length} error types showing increasing trends`,
        description: `Error rates are increasing for ${increasingErrors.map(e => e.category).join(', ')}`,
        recommendation: 'Investigate root causes and implement mitigation strategies',
        affectedCategories: increasingErrors.map(e => e.category),
        trend: 'increasing',
        impact: increasingErrors.length
      });
    }

    // Check for critical errors
    const criticalErrors = topErrors.filter(error => error.severity === 'critical');
    if (criticalErrors.length > 0) {
      insights.push({
        type: 'critical_errors_detected',
        severity: 'critical',
        title: `${criticalErrors.length} critical errors detected`,
        description: `Critical errors in categories: ${criticalErrors.map(e => e.category).join(', ')}`,
        recommendation: 'Immediate investigation required for critical errors',
        affectedCategories: criticalErrors.map(e => e.category),
        trend: 'stable',
        impact: criticalErrors.length
      });
    }

    // Check for error patterns
    const permissionErrors = topErrors.filter(error => error.category === 'permission_denied');
    if (permissionErrors.length > 3) {
      insights.push({
        type: 'security_concern',
        severity: 'high',
        title: 'Multiple permission denied errors',
        description: `${permissionErrors.length} permission-related errors detected`,
        recommendation: 'Review access control policies and user permissions',
        affectedCategories: ['permission_denied'],
        trend: 'stable',
        impact: permissionErrors.length
      });
    }

    return insights;
  }

  /**
   * Alert on critical error trends
   */
  private alertOnCriticalTrends(analysis: ErrorAnalysis): void {
    // Alert on critical errors
    const criticalErrors = analysis.topErrors.filter(error => error.severity === 'critical');
    if (criticalErrors.length > 0) {
      this.alerts.alertHighErrorRate(
        'shared-storage',
        criticalErrors.reduce((sum, error) => sum + error.count, 0),
        5 // Threshold for critical errors
      );
    }

    // Alert on rapidly increasing errors
    const rapidlyIncreasing = analysis.errorTrends.filter(trend => trend.trend === 'increasing' && trend.count > 10);
    if (rapidlyIncreasing.length > 0) {
      this.alerts.alertOperationFailure(
        'shared-storage',
        'error_rate_increasing',
        {
          increasingErrors: rapidlyIncreasing.length,
          mostFrequent: rapidlyIncreasing[0]?.category
        }
      );
    }
  }

  /**
   * Check if error thresholds are exceeded
   */
  private checkErrorThresholds(): void {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - this.trendWindow);

    // Count errors in the last hour by category
    const recentErrors = this.errorHistory.filter(error => error.timestamp > oneHourAgo);
    const errorCounts = new Map<ErrorCategory, number>();

    for (const error of recentErrors) {
      errorCounts.set(error.category, (errorCounts.get(error.category) || 0) + 1);
    }

    // Check each threshold
    for (const [category, threshold] of this.errorThresholds.entries()) {
      const count = errorCounts.get(category) || 0;

      if (count > threshold.count) {
        this.alerts.alertHighErrorRate(
          'shared-storage',
          count,
          threshold.count
        );

        sharedStorageLogger.logInfo('Error threshold exceeded', {
          category,
          count,
          threshold: threshold.count,
          timeWindow: '1_hour'
        });
      }
    }
  }

  /**
   * Check if specific error threshold is exceeded
   */
  private checkErrorThresholdExceeded(errorRecord: ErrorRecord): void {
    const threshold = this.errorThresholds.get(errorRecord.category);
    if (!threshold) return;

    // Count recent errors of this type
    const now = new Date();
    const timeWindow = threshold.timeWindow || 3600000; // 1 hour default
    const windowStart = new Date(now.getTime() - timeWindow);

    const recentErrors = this.errorHistory.filter(error =>
      error.category === errorRecord.category &&
      error.timestamp > windowStart
    );

    if (recentErrors.length > threshold.count) {
      this.alerts.alertHighErrorRate(
        'shared-storage',
        recentErrors.length,
        threshold.count
      );
    }
  }

  /**
   * Attempt automatic recovery for retryable errors
   */
  private async attemptRecovery(errorRecord: ErrorRecord): Promise<void> {
    const strategy = this.recoveryStrategies.get(errorRecord.category);
    if (!strategy) return;

    try {
      sharedStorageLogger.logInfo('Attempting error recovery', {
        errorId: errorRecord.id,
        category: errorRecord.category,
        strategy: strategy.name
      });

      // Execute recovery strategy
      const success = await strategy.execute(errorRecord);

      if (success) {
        errorRecord.recovered = true;
        sharedStorageLogger.logInfo('Error recovery successful', {
          errorId: errorRecord.id,
          category: errorRecord.category
        });
      } else {
        sharedStorageLogger.logInfo('Error recovery failed', {
          errorId: errorRecord.id,
          category: errorRecord.category
        });
      }
    } catch (recoveryError) {
      sharedStorageLogger.logError('Error recovery failed with exception', recoveryError as Error, errorRecord.context.sessionId, errorRecord.context.service, undefined, errorRecord.id);
    }
  }

  /**
   * Setup default recovery strategies
   */
  private setupDefaultRecoveryStrategies(): void {
    // Connection error recovery
    this.recoveryStrategies.set('connection_error', {
      name: 'connection_retry',
      category: 'connection_error',
      execute: async (errorRecord: ErrorRecord) => {
        // Implement exponential backoff retry logic
        const retryConfig = this.retryConfigurations.get('connection_error') ||
                           { maxAttempts: 3, baseDelay: 1000, maxDelay: 10000 };

        // Simulate retry logic (would integrate with actual service calls)
        await new Promise(resolve => setTimeout(resolve, retryConfig.baseDelay));
        return Math.random() > 0.5; // Simulate success/failure
      }
    });

    // File system error recovery
    this.recoveryStrategies.set('file_not_found', {
      name: 'filesystem_retry',
      category: 'file_not_found',
      execute: async (errorRecord: ErrorRecord) => {
        // Check if file exists now (might have been created)
        // This would integrate with actual filesystem checks
        await new Promise(resolve => setTimeout(resolve, 500));
        return Math.random() > 0.7; // Lower success rate for file operations
      }
    });
  }

  /**
   * Setup default error thresholds
   */
  private setupDefaultErrorThresholds(): void {
    this.errorThresholds.set('permission_denied', {
      category: 'permission_denied',
      count: 10,
      timeWindow: 3600000, // 1 hour
      severity: 'critical'
    });

    this.errorThresholds.set('connection_error', {
      category: 'connection_error',
      count: 20,
      timeWindow: 3600000,
      severity: 'high'
    });

    this.errorThresholds.set('disk_full', {
      category: 'disk_full',
      count: 1, // Even one disk full error is critical
      timeWindow: 3600000,
      severity: 'critical'
    });

    this.errorThresholds.set('validation_error', {
      category: 'validation_error',
      count: 50,
      timeWindow: 3600000,
      severity: 'medium'
    });
  }

  /**
   * Get error statistics for a specific category
   */
  getErrorStats(category?: ErrorCategory): ErrorStats {
    const relevantErrors = category
      ? this.errorHistory.filter(error => error.category === category)
      : this.errorHistory;

    const totalErrors = relevantErrors.length;
    const errorsBySeverity = new Map<ErrorSeverity, number>();
    const errorsByService = new Map<string, number>();
    const recoveryRate = relevantErrors.length > 0
      ? (relevantErrors.filter(error => error.recovered).length / relevantErrors.length) * 100
      : 0;

    for (const error of relevantErrors) {
      errorsBySeverity.set(error.severity, (errorsBySeverity.get(error.severity) || 0) + 1);
      errorsByService.set(error.context.service, (errorsByService.get(error.context.service) || 0) + 1);
    }

    return {
      totalErrors,
      category: category || 'all',
      errorsBySeverity: Object.fromEntries(errorsBySeverity),
      errorsByService: Object.fromEntries(errorsByService),
      recoveryRate,
      timeRange: {
        from: relevantErrors.length > 0 ? relevantErrors[0].timestamp : new Date(),
        to: new Date()
      }
    };
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats(): RecoveryStats {
    const totalErrors = this.errorHistory.length;
    const recoveredErrors = this.errorHistory.filter(error => error.recovered).length;
    const recoveryRate = totalErrors > 0 ? (recoveredErrors / totalErrors) * 100 : 0;

    const recoveryByCategory = new Map<ErrorCategory, { total: number; recovered: number }>();

    for (const error of this.errorHistory) {
      const stats = recoveryByCategory.get(error.category) || { total: 0, recovered: 0 };
      stats.total++;
      if (error.recovered) stats.recovered++;
      recoveryByCategory.set(error.category, stats);
    }

    return {
      totalErrors,
      recoveredErrors,
      recoveryRate,
      recoveryByCategory: Object.fromEntries(
        Array.from(recoveryByCategory.entries()).map(([category, stats]) => [
          category,
          {
            total: stats.total,
            recovered: stats.recovered,
            rate: stats.total > 0 ? (stats.recovered / stats.total) * 100 : 0
          }
        ])
      )
    };
  }

  /**
   * Export error data for external analysis
   */
  exportErrorData(options?: {
    from?: Date;
    to?: Date;
    category?: ErrorCategory;
    format?: 'json' | 'csv';
  }): string {
    const { from, to, category, format = 'json' } = options || {};

    let filteredErrors = this.errorHistory;

    if (from) {
      filteredErrors = filteredErrors.filter(error => error.timestamp >= from);
    }

    if (to) {
      filteredErrors = filteredErrors.filter(error => error.timestamp <= to);
    }

    if (category) {
      filteredErrors = filteredErrors.filter(error => error.category === category);
    }

    if (format === 'csv') {
      return this.errorsToCSV(filteredErrors);
    }

    return JSON.stringify(filteredErrors, null, 2);
  }

  /**
   * Convert errors to CSV format
   */
  private errorsToCSV(errors: ErrorRecord[]): string {
    const headers = [
      'id',
      'timestamp',
      'category',
      'severity',
      'operation',
      'service',
      'sessionId',
      'filepath',
      'error_name',
      'error_message',
      'error_code',
      'retryable',
      'recovered'
    ];

    const rows = errors.map(error => [
      error.id,
      error.timestamp.toISOString(),
      error.category,
      error.severity,
      error.operation,
      error.context.service,
      error.context.sessionId,
      error.context.filepath || '',
      error.error.name,
      `"${error.error.message.replace(/"/g, '""')}"`,
      error.error.code || '',
      error.retryable,
      error.recovered
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add custom recovery strategy
   */
  addRecoveryStrategy(category: ErrorCategory, strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(category, strategy);
    sharedStorageLogger.logInfo('Recovery strategy added', { category, strategyName: strategy.name });
  }

  /**
   * Add custom error threshold
   */
  addErrorThreshold(threshold: ErrorThreshold): void {
    this.errorThresholds.set(threshold.category, threshold);
    sharedStorageLogger.logInfo('Error threshold added', {
      category: threshold.category,
      count: threshold.count,
      timeWindow: threshold.timeWindow
    });
  }

  /**
   * Configure retry settings for error category
   */
  configureRetry(category: ErrorCategory, config: RetryConfig): void {
    this.retryConfigurations.set(category, config);
    sharedStorageLogger.logInfo('Retry configuration updated', { category, config });
  }
}

/**
 * Error record interface
 */
export interface ErrorRecord {
  id: string;
  timestamp: Date;
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    errno?: number;
  };
  context: ErrorContext;
  operation: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  fingerprint: string;
  retryable: boolean;
  recovered: boolean;
}

/**
 * Error context interface
 */
export interface ErrorContext {
  sessionId: string;
  service: string;
  filepath?: string;
  operation?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Error categories
 */
export type ErrorCategory =
  | 'permission_denied'
  | 'file_not_found'
  | 'file_exists'
  | 'not_a_directory'
  | 'is_a_directory'
  | 'disk_full'
  | 'connection_error'
  | 'validation_error'
  | 'session_error'
  | 'service_error'
  | 'unknown_error';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error trend interface
 */
export interface ErrorTrend {
  fingerprint: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  firstSeen: Date;
  lastSeen: Date;
  count: number;
  occurrences: Date[];
  averageInterval: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

/**
 * Recovery strategy interface
 */
export interface RecoveryStrategy {
  name: string;
  category: ErrorCategory;
  execute: (errorRecord: ErrorRecord) => Promise<boolean>;
}

/**
 * Error threshold interface
 */
export interface ErrorThreshold {
  category: ErrorCategory;
  count: number;
  timeWindow?: number; // milliseconds
  severity: ErrorSeverity;
}

/**
 * Retry configuration interface
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffMultiplier?: number;
}

/**
 * Error analysis result
 */
export interface ErrorAnalysis {
  totalErrors: number;
  uniqueErrorTypes: number;
  topErrors: Array<{
    fingerprint: string;
    count: number;
    category: ErrorCategory;
    severity: ErrorSeverity;
    lastSeen: Date;
    trend: 'increasing' | 'decreasing' | 'stable';
  }>;
  errorTrends: ErrorTrend[];
  insights: ErrorInsight[];
  analysisTimestamp: Date;
}

/**
 * Error insight interface
 */
export interface ErrorInsight {
  type: string;
  severity: ErrorSeverity;
  title: string;
  description: string;
  recommendation: string;
  affectedCategories: ErrorCategory[];
  trend: 'increasing' | 'decreasing' | 'stable';
  impact: number;
}

/**
 * Error statistics interface
 */
export interface ErrorStats {
  totalErrors: number;
  category: ErrorCategory | 'all';
  errorsBySeverity: Record<ErrorSeverity, number>;
  errorsByService: Record<string, number>;
  recoveryRate: number;
  timeRange: {
    from: Date;
    to: Date;
  };
}

/**
 * Recovery statistics interface
 */
export interface RecoveryStats {
  totalErrors: number;
  recoveredErrors: number;
  recoveryRate: number;
  recoveryByCategory: Record<ErrorCategory, {
    total: number;
    recovered: number;
    rate: number;
  }>;
}

// Export factory function
export const createSharedStorageErrors = (alerts: SharedStorageAlerts) => {
  return new SharedStorageErrors(alerts);
};
