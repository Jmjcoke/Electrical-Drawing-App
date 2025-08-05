/**
 * ContextDebugger Service
 * Provides debugging tools and diagnostics for context management system
 */
import type { ContextDebugInfo, ConversationContext, ContextValidationResult } from '../../../../shared/types/context';
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
        readonly slowestOperations: Array<{
            operation: string;
            timeMs: number;
        }>;
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
export declare class ContextDebuggerService {
    private readonly config;
    private readonly debugSessions;
    private readonly debugHistory;
    constructor(config: ContextDebuggerConfig);
    /**
     * Starts a new debug session
     * @param sessionId - Session identifier
     * @returns Debug session identifier
     */
    startDebugSession(sessionId: string): string;
    /**
     * Stops a debug session
     * @param sessionId - Session identifier
     */
    stopDebugSession(sessionId: string): void;
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
    recordOperation(sessionId: string, contextId: string, operation: string, input: Record<string, unknown>, output: Record<string, unknown>, executionTimeMs: number, errors?: string[], warnings?: string[], additionalDebugData?: Record<string, unknown>): void;
    /**
     * Performs comprehensive diagnostics on a context
     * @param context - Context to diagnose
     * @param includePerformanceHistory - Whether to include performance history
     * @returns Diagnostic report
     */
    diagnoseContext(context: ConversationContext, _includePerformanceHistory?: boolean): ContextDiagnostics;
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
    };
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
    };
    /**
     * Gets debug session information
     * @param sessionId - Session identifier
     * @returns Debug session or null if not found
     */
    getDebugSession(sessionId: string): DebugSession | null;
    /**
     * Gets all active debug sessions
     * @returns Array of active debug sessions
     */
    getActiveDebugSessions(): DebugSession[];
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
            mostCommonOperations: Array<{
                operation: string;
                count: number;
            }>;
        };
    };
    private generateDiagnosticRecommendations;
}
//# sourceMappingURL=ContextDebugger.d.ts.map