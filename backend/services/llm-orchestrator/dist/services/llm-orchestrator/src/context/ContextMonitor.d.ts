/**
 * ContextMonitor Service
 * Monitors context quality, performance, and issues in real-time
 */
import type { ContextAlert, ContextQualityMetrics, ConversationContext } from '../../../../shared/types/context';
export interface ContextMonitorConfig {
    readonly alertThresholds: {
        readonly maxRetrievalTimeMs: number;
        readonly maxEnhancementTimeMs: number;
        readonly minAccuracyScore: number;
        readonly maxStorageSizeMb: number;
        readonly maxMemoryUsageMb: number;
        readonly minCacheHitRate: number;
        readonly maxErrorRatePercent: number;
    };
    readonly monitoringIntervalMs: number;
    readonly enableRealTimeAlerts: boolean;
    readonly alertRetentionDays: number;
}
export declare class ContextMonitorService {
    private readonly config;
    private readonly activeAlerts;
    private readonly alertHistory;
    private readonly errorCounts;
    private readonly performanceBaselines;
    private monitoringInterval;
    constructor(config: ContextMonitorConfig);
    /**
     * Starts the monitoring service
     */
    startMonitoring(): void;
    /**
     * Stops the monitoring service
     */
    stopMonitoring(): void;
    /**
     * Monitors context operation performance and triggers alerts if needed
     * @param operation - Name of the operation
     * @param executionTimeMs - Time taken to execute
     * @param contextId - Context identifier
     * @param sessionId - Session identifier
     * @param success - Whether the operation was successful
     * @param errorMessage - Error message if operation failed
     */
    monitorOperation(operation: string, executionTimeMs: number, contextId: string, sessionId: string, success?: boolean, _errorMessage?: string): void;
    /**
     * Monitors context quality metrics and accuracy
     * @param qualityMetrics - Quality metrics to monitor
     */
    monitorQuality(qualityMetrics: ContextQualityMetrics): void;
    /**
     * Monitors context memory usage
     * @param contextId - Context identifier
     * @param sessionId - Session identifier
     * @param memoryUsageMb - Current memory usage in MB
     */
    monitorMemoryUsage(contextId: string, sessionId: string, memoryUsageMb: number): void;
    /**
     * Analyzes context health and returns assessment
     * @param context - Context to analyze
     * @returns Health assessment
     */
    analyzeContextHealth(context: ConversationContext): {
        healthScore: number;
        issues: string[];
        recommendations: string[];
        riskLevel: 'low' | 'medium' | 'high' | 'critical';
    };
    /**
     * Gets all active alerts
     * @returns Array of active alerts
     */
    getActiveAlerts(): ContextAlert[];
    /**
     * Gets alert history
     * @param limit - Maximum number of alerts to return
     * @returns Array of historical alerts
     */
    getAlertHistory(limit?: number): ContextAlert[];
    /**
     * Resolves an active alert
     * @param alertId - Alert identifier
     * @param resolution - Resolution description
     */
    resolveAlert(alertId: string, resolution?: string): boolean;
    /**
     * Gets monitoring statistics
     * @returns Monitoring statistics
     */
    getMonitoringStats(): {
        activeAlertsCount: number;
        totalAlertsToday: number;
        errorRate: number;
        avgPerformance: Record<string, number>;
        isMonitoring: boolean;
    };
    private triggerAlert;
    private checkPerformanceThresholds;
    private trackError;
    private updatePerformanceBaseline;
    private performRoutineChecks;
    private cleanupOldAlerts;
    private initializeBaselines;
}
//# sourceMappingURL=ContextMonitor.d.ts.map