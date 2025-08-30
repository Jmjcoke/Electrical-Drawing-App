/**
 * Types and interfaces for the Intelligent Retry Manager
 */

export interface RetryManagerConfig {
  defaultRetryConfig: RetryConfig;
  operationSpecificConfigs?: Record<string, Partial<RetryConfig>>;
  maxConcurrentRetries: number;
  cleanupInterval: number;
  contextExpirationTime: number;
  defaultRetryBudget: number;
  budgetResetInterval: number;
  predictiveAnalysisWindow: number;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  minDelay: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  jitterRange?: number;
  totalTimeout: number;
  operationTimeout: number;
}

export interface RetryOperationContext {
  operationType: string;
  service?: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  fallback?: () => Promise<any>;
  metadata?: Record<string, any>;
}

export interface RetryExecutionContext {
  operationId: string;
  operationContext: RetryOperationContext;
  startTime: number;
  attempts: RetryAttempt[];
  status: 'running' | 'success' | 'failed' | 'circuit_open' | 'timeout';
  correlationId: string;
  finalError?: Error;
}

export interface RetryAttempt {
  attemptNumber: number;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: Error;
}

export interface RetryBudget {
  operationType: string;
  limit: number;
  currentUsage: number;
  resetTime: number;
  lastReset: number;
}

export interface ErrorPattern {
  operationType: string;
  errorType: string;
  occurrences: number;
  lastSeen: number;
  avgTimeBetweenOccurrences: number;
  previousOccurrence: number;
}

export interface PredictiveRetryData {
  operationType: string;
  errorPatterns: Map<string, ErrorPatternStats>;
  lastUpdated: number;
  totalRetries: number;
  successRate: number;
}

export interface ErrorPatternStats {
  errorType: string;
  totalAttempts: number;
  successCount: number;
  avgRetryTime: number;
  lastSeen: number;
}

export interface RetryManagerStatistics {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  successRate: number;
  activeContexts: number;
  activeBudgets: number;
  circuitBreakerStatuses: Record<string, any>;
}

/**
 * Default configuration for the retry manager
 */
export const defaultRetryManagerConfig: RetryManagerConfig = {
  defaultRetryConfig: {
    maxAttempts: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    minDelay: 100, // 100ms minimum
    backoffMultiplier: 2.0,
    jitterEnabled: true,
    jitterRange: 0.2, // ±20% jitter
    totalTimeout: 120000, // 2 minutes total
    operationTimeout: 10000 // 10 seconds per operation
  },
  maxConcurrentRetries: 100,
  cleanupInterval: 300000, // 5 minutes
  contextExpirationTime: 3600000, // 1 hour
  defaultRetryBudget: 1000, // 1000 retries per budget period
  budgetResetInterval: 3600000, // 1 hour
  predictiveAnalysisWindow: 1800000 // 30 minutes
};
