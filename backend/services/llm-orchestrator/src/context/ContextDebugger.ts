/**
 * ContextDebugger Service
 * Provides debugging tools and diagnostics for context management system
 */

import type {
  ContextDebugInfo,
  ConversationContext,
  ContextValidationResult
} from '../../../../shared/types/context';

export interface DebugSession {
  readonly sessionId: string;
  readonly startTime: Date;
  readonly operations: ContextDebugInfo[];
  readonly isActive: boolean;
}

export interface ContextDiagnostics {
  readonly contextId: string;
  readonly sessionId: string;
  readonly health: {
    readonly score: number;
    readonly issues: string[];
    readonly warnings: string[];
  };
  readonly performance: {
    readonly avgOperationTime: number;
    readonly slowestOperations: Array<{ operation: string; timeMs: number }>;
    readonly errorRate: number;
  };
  readonly structure: {
    readonly turnCount: number;
    readonly entityCount: number;
    readonly compressionLevel: number;
    readonly storageSize: number;
  };
  readonly recommendations: string[];
}

export interface ContextDebuggerConfig {
  readonly maxDebugSessions: number;
  readonly maxOperationsPerSession: number;
  readonly enableDetailedLogging: boolean;
  readonly performanceThresholds: {
    readonly slowOperationMs: number;
    readonly criticalOperationMs: number;
  };
}

export class ContextDebuggerService {
  private readonly config: ContextDebuggerConfig;
  private readonly debugSessions = new Map<string, DebugSession>();
  private readonly debugHistory = new Map<string, ContextDebugInfo[]>();

  constructor(config: ContextDebuggerConfig) {
    this.config = config;
  }

  /**
   * Starts a new debug session
   * @param sessionId - Session identifier
   * @returns Debug session identifier
   */
  startDebugSession(sessionId: string): string {
    // Clean up old sessions if we're at the limit
    if (this.debugSessions.size >= this.config.maxDebugSessions) {
      const oldestSession = Array.from(this.debugSessions.values())
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];
      this.stopDebugSession(oldestSession.sessionId);
    }

    const debugSession: DebugSession = {
      sessionId,
      startTime: new Date(),
      operations: [],
      isActive: true
    };

    this.debugSessions.set(sessionId, debugSession);
    
    if (this.config.enableDetailedLogging) {
      console.log(`Debug session started for session: ${sessionId}`);
    }

    return sessionId;
  }

  /**
   * Stops a debug session
   * @param sessionId - Session identifier
   */
  stopDebugSession(sessionId: string): void {
    const session = this.debugSessions.get(sessionId);
    if (session) {
      // Archive operations to history
      this.debugHistory.set(sessionId, [...session.operations]);
      
      // Mark as inactive
      const inactiveSession: DebugSession = {
        ...session,
        isActive: false
      };
      
      this.debugSessions.set(sessionId, inactiveSession);
      
      if (this.config.enableDetailedLogging) {
        console.log(`Debug session stopped for session: ${sessionId}. Recorded ${session.operations.length} operations.`);
      }
    }
  }

  /**
   * Records debug information for an operation
   * @param sessionId - Session identifier
   * @param contextId - Context identifier
   * @param operation - Operation name
   * @param input - Operation input
   * @param output - Operation output
   * @param executionTimeMs - Execution time
   * @param errors - Any errors that occurred
   * @param warnings - Any warnings
   * @param additionalDebugData - Additional debug data
   */
  recordOperation(
    sessionId: string,
    contextId: string,
    operation: string,
    input: Record<string, unknown>,
    output: Record<string, unknown>,
    executionTimeMs: number,
    errors: string[] = [],
    warnings: string[] = [],
    additionalDebugData: Record<string, unknown> = {}
  ): void {
    const session = this.debugSessions.get(sessionId);
    if (!session || !session.isActive) {
      return; // Session not active
    }

    const debugInfo: ContextDebugInfo = {
      contextId,
      sessionId,
      operation,
      input,
      output,
      executionTimeMs,
      errors,
      warnings,
      debugData: additionalDebugData,
      timestamp: new Date()
    };

    session.operations.push(debugInfo);

    // Limit operations per session
    if (session.operations.length > this.config.maxOperationsPerSession) {
      session.operations.splice(0, session.operations.length - this.config.maxOperationsPerSession);
    }

    // Log performance issues
    if (executionTimeMs > this.config.performanceThresholds.slowOperationMs) {
      const level = executionTimeMs > this.config.performanceThresholds.criticalOperationMs ? 'CRITICAL' : 'WARNING';
      console.warn(`[${level}] Slow operation detected: ${operation} took ${executionTimeMs}ms`);
    }

    if (errors.length > 0) {
      console.error(`Operation errors in ${operation}:`, errors);
    }
  }

  /**
   * Performs comprehensive diagnostics on a context
   * @param context - Context to diagnose
   * @param includePerformanceHistory - Whether to include performance history
   * @returns Diagnostic report
   */
  diagnoseContext(context: ConversationContext, _includePerformanceHistory: boolean = true): ContextDiagnostics {
    const issues: string[] = [];
    const warnings: string[] = [];
    let healthScore = 100;

    // Check context structure
    if (context.conversationThread.length === 0) {
      issues.push('Context has no conversation turns');
      healthScore -= 20;
    }

    if (context.cumulativeContext.extractedEntities.size === 0 && context.conversationThread.length > 0) {
      warnings.push('No entities extracted despite having conversation turns');
      healthScore -= 5;
    }

    // Check expiration
    if (context.expiresAt < new Date()) {
      issues.push('Context has expired');
      healthScore -= 30;
    } else if (context.expiresAt.getTime() - Date.now() < 60 * 60 * 1000) {
      warnings.push('Context expires within 1 hour');
      healthScore -= 5;
    }

    // Check compression
    if (context.conversationThread.length > 30 && context.metadata.compressionLevel === 0) {
      warnings.push('Context has many turns but no compression applied');
      healthScore -= 10;
    }

    // Check turn sequence integrity
    for (let i = 0; i < context.conversationThread.length; i++) {
      const turn = context.conversationThread[i];
      if (turn.turnNumber !== i + 1) {
        issues.push(`Turn sequence error at position ${i}: expected ${i + 1}, got ${turn.turnNumber}`);
        healthScore -= 15;
      }
    }

    // Performance analysis
    const sessionOperations = this.debugSessions.get(context.sessionId)?.operations || [];
    const contextOperations = sessionOperations.filter(op => op.contextId === context.id);
    
    const avgOperationTime = contextOperations.length > 0
      ? contextOperations.reduce((sum, op) => sum + op.executionTimeMs, 0) / contextOperations.length
      : 0;

    const slowestOperations = contextOperations
      .sort((a, b) => b.executionTimeMs - a.executionTimeMs)
      .slice(0, 5)
      .map(op => ({ operation: op.operation, timeMs: op.executionTimeMs }));

    const operationsWithErrors = contextOperations.filter(op => op.errors.length > 0);
    const errorRate = contextOperations.length > 0 ? operationsWithErrors.length / contextOperations.length : 0;

    // Storage analysis
    const contextJson = JSON.stringify(context);
    const storageSize = Buffer.byteLength(contextJson, 'utf8');

    // Generate recommendations
    const recommendations = this.generateDiagnosticRecommendations(
      context,
      healthScore,
      avgOperationTime,
      errorRate,
      storageSize
    );

    return {
      contextId: context.id,
      sessionId: context.sessionId,
      health: {
        score: Math.max(0, healthScore),
        issues,
        warnings
      },
      performance: {
        avgOperationTime,
        slowestOperations,
        errorRate
      },
      structure: {
        turnCount: context.conversationThread.length,
        entityCount: context.cumulativeContext.extractedEntities.size,
        compressionLevel: context.metadata.compressionLevel,
        storageSize
      },
      recommendations
    };
  }

  /**
   * Validates context data integrity
   * @param context - Context to validate
   * @returns Validation result with detailed findings
   */
  validateContextIntegrity(context: ConversationContext): ContextValidationResult & {
    detailedFindings: {
      structuralIssues: string[];
      dataInconsistencies: string[];
      performanceWarnings: string[];
    };
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const structuralIssues: string[] = [];
    const dataInconsistencies: string[] = [];
    const performanceWarnings: string[] = [];

    // Basic structure validation
    if (!context.id || typeof context.id !== 'string') {
      errors.push('Invalid context ID');
      structuralIssues.push('Context ID is missing or invalid');
    }

    if (!context.sessionId || typeof context.sessionId !== 'string') {
      errors.push('Invalid session ID');
      structuralIssues.push('Session ID is missing or invalid');
    }

    // Validate conversation thread
    const turnNumbers = context.conversationThread.map(turn => turn.turnNumber);
    const expectedNumbers = Array.from({ length: turnNumbers.length }, (_, i) => i + 1);
    
    if (JSON.stringify(turnNumbers) !== JSON.stringify(expectedNumbers)) {
      errors.push('Conversation turn sequence is not continuous');
      structuralIssues.push('Turn numbers are not sequential or have gaps');
    }

    // Validate timestamps
    for (let i = 1; i < context.conversationThread.length; i++) {
      const prevTurn = context.conversationThread[i - 1];
      const currentTurn = context.conversationThread[i];
      
      if (currentTurn.timestamp < prevTurn.timestamp) {
        warnings.push(`Turn ${i + 1} timestamp is earlier than turn ${i} timestamp`);
        dataInconsistencies.push(`Timestamp ordering issue at turn ${i + 1}`);
      }
    }

    // Validate cumulative context consistency
    const extractedEntityTypes = new Set<string>();
    context.conversationThread.forEach(turn => {
      turn.query.entities.forEach(entity => {
        extractedEntityTypes.add(`${entity.type}:${entity.text}`);
      });
    });

    const cumulativeEntityTypes = new Set(context.cumulativeContext.extractedEntities.keys());
    
    for (const entityType of extractedEntityTypes) {
      if (!cumulativeEntityTypes.has(entityType)) {
        warnings.push(`Entity ${entityType} found in turns but missing from cumulative context`);
        dataInconsistencies.push(`Missing entity in cumulative context: ${entityType}`);
      }
    }

    // Performance validation
    const avgTurnSize = context.conversationThread.length > 0
      ? Buffer.byteLength(JSON.stringify(context.conversationThread), 'utf8') / context.conversationThread.length
      : 0;

    if (avgTurnSize > 5000) { // 5KB per turn
      warnings.push('Large average turn size may impact performance');
      performanceWarnings.push('Consider implementing turn data compression');
    }

    if (context.cumulativeContext.extractedEntities.size > 500) {
      warnings.push('High entity count may impact performance');
      performanceWarnings.push('Consider implementing entity pruning strategies');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      detailedFindings: {
        structuralIssues,
        dataInconsistencies,
        performanceWarnings
      }
    };
  }

  /**
   * Traces the flow of a specific query through the context system
   * @param sessionId - Session identifier
   * @param queryId - Query identifier to trace
   * @returns Trace information
   */
  traceQueryFlow(sessionId: string, queryId: string): {
    queryId: string;
    operations: ContextDebugInfo[];
    totalTimeMs: number;
    errors: string[];
    warnings: string[];
    flowSummary: string[];
  } {
    const session = this.debugSessions.get(sessionId);
    const allOperations = session?.operations || this.debugHistory.get(sessionId) || [];
    
    // Find operations related to this query
    const relatedOperations = allOperations.filter(op => 
      JSON.stringify(op.input).includes(queryId) || 
      JSON.stringify(op.output).includes(queryId)
    );

    const totalTimeMs = relatedOperations.reduce((sum, op) => sum + op.executionTimeMs, 0);
    const errors = relatedOperations.flatMap(op => op.errors);
    const warnings = relatedOperations.flatMap(op => op.warnings);

    const flowSummary = relatedOperations
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .map(op => `${op.operation} (${op.executionTimeMs}ms)${op.errors.length > 0 ? ' [ERROR]' : ''}`);

    return {
      queryId,
      operations: relatedOperations,
      totalTimeMs,
      errors,
      warnings,
      flowSummary
    };
  }

  /**
   * Gets debug session information
   * @param sessionId - Session identifier
   * @returns Debug session or null if not found
   */
  getDebugSession(sessionId: string): DebugSession | null {
    return this.debugSessions.get(sessionId) || null;
  }

  /**
   * Gets all active debug sessions
   * @returns Array of active debug sessions
   */
  getActiveDebugSessions(): DebugSession[] {
    return Array.from(this.debugSessions.values()).filter(session => session.isActive);
  }

  /**
   * Exports debug data for external analysis
   * @param sessionId - Optional session identifier
   * @returns Debug data export
   */
  exportDebugData(sessionId?: string): {
    sessions: DebugSession[];
    operations: ContextDebugInfo[];
    summary: {
      totalOperations: number;
      avgOperationTime: number;
      errorRate: number;
      mostCommonOperations: Array<{ operation: string; count: number }>;
    };
  } {
    const sessions = sessionId 
      ? [this.debugSessions.get(sessionId)].filter(Boolean) as DebugSession[]
      : Array.from(this.debugSessions.values());

    const operations = sessions.flatMap(session => session.operations);

    // Calculate summary statistics
    const totalOperations = operations.length;
    const avgOperationTime = totalOperations > 0 
      ? operations.reduce((sum, op) => sum + op.executionTimeMs, 0) / totalOperations
      : 0;

    const operationsWithErrors = operations.filter(op => op.errors.length > 0);
    const errorRate = totalOperations > 0 ? operationsWithErrors.length / totalOperations : 0;

    const operationCounts = new Map<string, number>();
    operations.forEach(op => {
      operationCounts.set(op.operation, (operationCounts.get(op.operation) || 0) + 1);
    });

    const mostCommonOperations = Array.from(operationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([operation, count]) => ({ operation, count }));

    return {
      sessions,
      operations,
      summary: {
        totalOperations,
        avgOperationTime,
        errorRate,
        mostCommonOperations
      }
    };
  }

  // Private helper methods

  private generateDiagnosticRecommendations(
    context: ConversationContext,
    healthScore: number,
    avgOperationTime: number,
    errorRate: number,
    storageSize: number
  ): string[] {
    const recommendations: string[] = [];

    if (healthScore < 70) {
      recommendations.push('Context health is poor - review structural issues and implement fixes');
    }

    if (avgOperationTime > this.config.performanceThresholds.slowOperationMs) {
      recommendations.push('Operations are running slowly - optimize processing pipeline');
    }

    if (errorRate > 0.1) {
      recommendations.push('High error rate detected - review error handling and input validation');
    }

    if (storageSize > 100000) { // 100KB
      recommendations.push('Context storage is large - consider implementing compression or summarization');
    }

    if (context.conversationThread.length > 50) {
      recommendations.push('High turn count - implement context compression to maintain performance');
    }

    if (context.cumulativeContext.extractedEntities.size > 200) {
      recommendations.push('High entity count - consider entity pruning or relevance filtering');
    }

    if (recommendations.length === 0) {
      recommendations.push('Context is performing well - continue monitoring');
    }

    return recommendations;
  }
}