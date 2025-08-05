/**
 * ContextABTesting Service
 * A/B testing framework for context management improvements and optimizations
 */
import type { ContextABTestConfig, ContextABVariant, ContextABTestResult } from '../../../../shared/types/context';
export interface ABTestMetrics {
    readonly variant: string;
    readonly sampleSize: number;
    readonly averagePerformance: number;
    readonly successRate: number;
    readonly userSatisfaction: number;
    readonly errorRate: number;
    readonly conversionRate: number;
}
export interface ABTestStatistics {
    readonly testId: string;
    readonly isSignificant: boolean;
    readonly confidence: number;
    readonly winningVariant?: string | undefined;
    readonly metrics: Record<string, ABTestMetrics>;
    readonly recommendations: string[];
}
export interface ContextABTestingConfig {
    readonly minSampleSize: number;
    readonly significanceThreshold: number;
    readonly maxConcurrentTests: number;
    readonly defaultTestDurationDays: number;
}
export declare class ContextABTestingService {
    private readonly config;
    private readonly activeTests;
    private readonly testResults;
    private readonly testAssignments;
    private readonly completedTests;
    constructor(config: ContextABTestingConfig);
    /**
     * Creates and starts a new A/B test
     * @param testConfig - Test configuration
     * @returns Test identifier
     */
    createTest(testConfig: Omit<ContextABTestConfig, 'testId'>): string;
    /**
     * Assigns a session to a test variant
     * @param sessionId - Session identifier
     * @param testId - Test identifier
     * @returns Assigned variant configuration
     */
    assignVariant(sessionId: string, testId: string): ContextABVariant | null;
    /**
     * Records a test result
     * @param testId - Test identifier
     * @param sessionId - Session identifier
     * @param metrics - Performance metrics
     * @param isSuccessful - Whether the interaction was successful
     */
    recordResult(testId: string, sessionId: string, metrics: Record<string, number>, isSuccessful: boolean): void;
    /**
     * Analyzes test results and determines statistical significance
     * @param testId - Test identifier
     * @returns Test statistics and analysis
     */
    analyzeTest(testId: string): ABTestStatistics | null;
    /**
     * Concludes a test and provides final results
     * @param testId - Test identifier
     * @param reason - Reason for conclusion
     * @returns Final test statistics
     */
    concludeTest(testId: string, reason?: string): ABTestStatistics | null;
    /**
     * Gets all active tests
     * @returns Array of active test configurations
     */
    getActiveTests(): ContextABTestConfig[];
    /**
     * Gets completed tests
     * @returns Array of completed test statistics
     */
    getCompletedTests(): ABTestStatistics[];
    /**
     * Gets test results for a specific test
     * @param testId - Test identifier
     * @returns Array of test results
     */
    getTestResults(testId: string): ContextABTestResult[];
    /**
     * Pauses or resumes a test
     * @param testId - Test identifier
     * @param enabled - Whether to enable or disable the test
     */
    toggleTest(testId: string, enabled: boolean): boolean;
    private validateTestConfig;
    private checkTestCompletion;
    private calculateStatisticalSignificance;
    private generateTestRecommendations;
    private calculateVariance;
}
//# sourceMappingURL=ContextABTesting.d.ts.map