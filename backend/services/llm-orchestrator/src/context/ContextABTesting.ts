/**
 * ContextABTesting Service
 * A/B testing framework for context management improvements and optimizations
 */

import { randomUUID } from 'crypto';
import type {
  ContextABTestConfig,
  ContextABVariant,
  ContextABTestResult
} from '../../../../shared/types/context';

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

export class ContextABTestingService {
  private readonly config: ContextABTestingConfig;
  private readonly activeTests = new Map<string, ContextABTestConfig>();
  private readonly testResults = new Map<string, ContextABTestResult[]>();
  private readonly testAssignments = new Map<string, string>(); // sessionId -> variantId
  private readonly completedTests = new Map<string, ABTestStatistics>();

  constructor(config: ContextABTestingConfig) {
    this.config = config;
  }

  /**
   * Creates and starts a new A/B test
   * @param testConfig - Test configuration
   * @returns Test identifier
   */
  createTest(testConfig: Omit<ContextABTestConfig, 'testId'>): string {
    if (this.activeTests.size >= this.config.maxConcurrentTests) {
      throw new Error('Maximum number of concurrent tests reached');
    }

    const testId = randomUUID();
    const fullConfig: ContextABTestConfig = {
      ...testConfig,
      testId
    };

    // Validate test configuration
    this.validateTestConfig(fullConfig);

    this.activeTests.set(testId, fullConfig);
    this.testResults.set(testId, []);

    console.log(`A/B test created: ${fullConfig.name} (${testId})`);
    return testId;
  }

  /**
   * Assigns a session to a test variant
   * @param sessionId - Session identifier
   * @param testId - Test identifier
   * @returns Assigned variant configuration
   */
  assignVariant(sessionId: string, testId: string): ContextABVariant | null {
    const test = this.activeTests.get(testId);
    if (!test || !test.enabled) {
      return null;
    }

    // Check if test is still active
    if (test.endDate && new Date() > test.endDate) {
      return null;
    }

    // Check if session is already assigned
    const existingAssignment = this.testAssignments.get(`${sessionId}:${testId}`);
    if (existingAssignment) {
      return test.variants.find(v => v.variantId === existingAssignment) || null;
    }

    // Assign based on traffic percentage and current distribution
    const currentResults = this.testResults.get(testId) || [];
    const variantCounts = new Map<string, number>();
    
    // Count current assignments
    test.variants.forEach(variant => {
      const count = currentResults.filter(r => r.variantId === variant.variantId).length;
      variantCounts.set(variant.variantId, count);
    });

    // Find variant that needs more traffic
    const totalAssigned = Array.from(variantCounts.values()).reduce((sum, count) => sum + count, 0);
    let selectedVariant: ContextABVariant | null = null;

    for (const variant of test.variants) {
      const currentCount = variantCounts.get(variant.variantId) || 0;
      const expectedCount = Math.floor((totalAssigned + 1) * (variant.trafficPercentage / 100));
      
      if (currentCount < expectedCount || selectedVariant === null) {
        selectedVariant = variant;
        break;
      }
    }

    if (!selectedVariant) {
      selectedVariant = test.variants[0]; // Fallback to first variant
    }

    // Record assignment
    this.testAssignments.set(`${sessionId}:${testId}`, selectedVariant.variantId);

    return selectedVariant;
  }

  /**
   * Records a test result
   * @param testId - Test identifier
   * @param sessionId - Session identifier
   * @param metrics - Performance metrics
   * @param isSuccessful - Whether the interaction was successful
   */
  recordResult(
    testId: string,
    sessionId: string,
    metrics: Record<string, number>,
    isSuccessful: boolean
  ): void {
    const test = this.activeTests.get(testId);
    if (!test) {
      return;
    }

    const variantId = this.testAssignments.get(`${sessionId}:${testId}`);
    if (!variantId) {
      return;
    }

    const result: ContextABTestResult = {
      testId,
      variantId,
      sessionId,
      metrics,
      isSuccessful,
      timestamp: new Date()
    };

    const existing = this.testResults.get(testId) || [];
    existing.push(result);
    this.testResults.set(testId, existing);

    // Check if test should be analyzed or concluded
    this.checkTestCompletion(testId);
  }

  /**
   * Analyzes test results and determines statistical significance
   * @param testId - Test identifier
   * @returns Test statistics and analysis
   */
  analyzeTest(testId: string): ABTestStatistics | null {
    const test = this.activeTests.get(testId);
    const results = this.testResults.get(testId);

    if (!test || !results || results.length === 0) {
      return null;
    }

    // Group results by variant
    const variantResults = new Map<string, ContextABTestResult[]>();
    results.forEach(result => {
      const existing = variantResults.get(result.variantId) || [];
      existing.push(result);
      variantResults.set(result.variantId, existing);
    });

    // Calculate metrics for each variant
    const variantMetrics: Record<string, ABTestMetrics> = {};
    
    for (const [variantId, variantResultList] of variantResults.entries()) {
      const sampleSize = variantResultList.length;
      const successCount = variantResultList.filter(r => r.isSuccessful).length;
      const successRate = sampleSize > 0 ? successCount / sampleSize : 0;

      // Calculate average performance metrics
      const performanceValues = variantResultList
        .flatMap(r => Object.values(r.metrics))
        .filter(v => typeof v === 'number');
      
      const averagePerformance = performanceValues.length > 0
        ? performanceValues.reduce((sum, val) => sum + val, 0) / performanceValues.length
        : 0;

      // Calculate user satisfaction (if available in metrics)
      const satisfactionValues = variantResultList
        .map(r => r.metrics.userSatisfaction)
        .filter(v => typeof v === 'number');
      
      const userSatisfaction = satisfactionValues.length > 0
        ? satisfactionValues.reduce((sum, val) => sum + val, 0) / satisfactionValues.length
        : 0;

      const errorCount = variantResultList.filter(r => !r.isSuccessful).length;
      const errorRate = sampleSize > 0 ? errorCount / sampleSize : 0;

      // Conversion rate (assuming successful interactions are conversions)
      const conversionRate = successRate;

      variantMetrics[variantId] = {
        variant: variantId,
        sampleSize,
        averagePerformance,
        successRate,
        userSatisfaction,
        errorRate,
        conversionRate
      };
    }

    // Determine statistical significance and winning variant
    const { isSignificant, confidence, winningVariant } = this.calculateStatisticalSignificance(variantMetrics);

    // Generate recommendations
    const recommendations = this.generateTestRecommendations(test, variantMetrics, isSignificant, winningVariant);

    const statistics: ABTestStatistics = {
      testId,
      isSignificant,
      confidence,
      winningVariant,
      metrics: variantMetrics,
      recommendations
    };

    return statistics;
  }

  /**
   * Concludes a test and provides final results
   * @param testId - Test identifier
   * @param reason - Reason for conclusion
   * @returns Final test statistics
   */
  concludeTest(testId: string, reason: string = 'Manual conclusion'): ABTestStatistics | null {
    const statistics = this.analyzeTest(testId);
    if (!statistics) {
      return null;
    }

    // Mark test as completed
    this.completedTests.set(testId, statistics);
    this.activeTests.delete(testId);

    console.log(`A/B test concluded: ${testId}. Reason: ${reason}`);
    
    return statistics;
  }

  /**
   * Gets all active tests
   * @returns Array of active test configurations
   */
  getActiveTests(): ContextABTestConfig[] {
    return Array.from(this.activeTests.values());
  }

  /**
   * Gets completed tests
   * @returns Array of completed test statistics
   */
  getCompletedTests(): ABTestStatistics[] {
    return Array.from(this.completedTests.values());
  }

  /**
   * Gets test results for a specific test
   * @param testId - Test identifier
   * @returns Array of test results
   */
  getTestResults(testId: string): ContextABTestResult[] {
    return this.testResults.get(testId) || [];
  }

  /**
   * Pauses or resumes a test
   * @param testId - Test identifier
   * @param enabled - Whether to enable or disable the test
   */
  toggleTest(testId: string, enabled: boolean): boolean {
    const test = this.activeTests.get(testId);
    if (!test) {
      return false;
    }

    const updatedTest: ContextABTestConfig = {
      ...test,
      enabled
    };

    this.activeTests.set(testId, updatedTest);
    return true;
  }

  // Private helper methods

  private validateTestConfig(config: ContextABTestConfig): void {
    if (config.variants.length < 2) {
      throw new Error('Test must have at least 2 variants');
    }

    const totalTraffic = config.variants.reduce((sum, variant) => sum + variant.trafficPercentage, 0);
    if (Math.abs(totalTraffic - 100) > 0.1) {
      throw new Error('Variant traffic percentages must sum to 100');
    }

    const hasControl = config.variants.some(v => v.isControl);
    if (!hasControl) {
      throw new Error('Test must have a control variant');
    }

    if (config.successMetrics.length === 0) {
      throw new Error('Test must define success metrics');
    }
  }

  private checkTestCompletion(testId: string): void {
    const test = this.activeTests.get(testId);
    const results = this.testResults.get(testId);

    if (!test || !results) {
      return;
    }

    // Check if minimum sample size is reached for all variants
    const variantCounts = new Map<string, number>();
    results.forEach(result => {
      variantCounts.set(result.variantId, (variantCounts.get(result.variantId) || 0) + 1);
    });

    const allVariantsHaveMinSample = test.variants.every(variant => 
      (variantCounts.get(variant.variantId) || 0) >= this.config.minSampleSize
    );

    if (allVariantsHaveMinSample) {
      const statistics = this.analyzeTest(testId);
      if (statistics?.isSignificant) {
        this.concludeTest(testId, 'Statistical significance reached');
      }
    }

    // Check if test duration has expired
    if (test.endDate && new Date() > test.endDate) {
      this.concludeTest(testId, 'Test duration expired');
    }
  }

  private calculateStatisticalSignificance(
    variantMetrics: Record<string, ABTestMetrics>
  ): { isSignificant: boolean; confidence: number; winningVariant?: string } {
    const variants = Object.values(variantMetrics);
    
    if (variants.length < 2) {
      return { isSignificant: false, confidence: 0 };
    }

    // Find control and treatment variants
    const controlVariant = variants.find(v => v.variant.includes('control')) || variants[0];
    const treatmentVariants = variants.filter(v => v !== controlVariant);

    let bestTreatment = treatmentVariants[0];
    let maxImprovement = 0;

    // Simple improvement calculation (in a real implementation, you'd use proper statistical tests)
    for (const treatment of treatmentVariants) {
      const improvement = (treatment.successRate - controlVariant.successRate) / controlVariant.successRate;
      if (improvement > maxImprovement) {
        maxImprovement = improvement;
        bestTreatment = treatment;
      }
    }

    // Simplified significance test (in reality, you'd use chi-square or t-test)
    const minSampleSize = Math.min(controlVariant.sampleSize, bestTreatment.sampleSize);
    const improvementThreshold = 0.05; // 5% improvement
    const sampleSizeThreshold = this.config.minSampleSize;

    const isSignificant = 
      minSampleSize >= sampleSizeThreshold &&
      Math.abs(maxImprovement) > improvementThreshold &&
      Math.abs(bestTreatment.successRate - controlVariant.successRate) > 0.02; // 2% absolute difference

    const confidence = isSignificant ? Math.min(95, 50 + (maxImprovement * 100)) : 0;
    const winningVariant = isSignificant && maxImprovement > 0 ? bestTreatment.variant : undefined;

    return {
      isSignificant,
      confidence,
      winningVariant: winningVariant || undefined
    };
  }

  private generateTestRecommendations(
    _test: ContextABTestConfig,
    variantMetrics: Record<string, ABTestMetrics>,
    isSignificant: boolean,
    winningVariant?: string
  ): string[] {
    const recommendations: string[] = [];

    if (isSignificant && winningVariant) {
      const winner = variantMetrics[winningVariant];
      const control = Object.values(variantMetrics).find(v => v.variant.includes('control'));
      
      if (control) {
        const improvement = ((winner.successRate - control.successRate) / control.successRate * 100).toFixed(1);
        recommendations.push(`Deploy variant ${winningVariant} - shows ${improvement}% improvement over control`);
      }
    } else if (!isSignificant) {
      const maxSampleSize = Math.max(...Object.values(variantMetrics).map(v => v.sampleSize));
      
      if (maxSampleSize < this.config.minSampleSize) {
        recommendations.push('Continue test until minimum sample size is reached');
      } else {
        recommendations.push('No significant difference detected - consider testing more dramatic changes');
      }
    }

    // Performance recommendations
    const avgPerformances = Object.values(variantMetrics).map(v => v.averagePerformance);
    const performanceVariance = this.calculateVariance(avgPerformances);
    
    if (performanceVariance > 100) {
      recommendations.push('High performance variance detected - investigate causes');
    }

    // Error rate recommendations
    const highErrorVariants = Object.values(variantMetrics).filter(v => v.errorRate > 0.1);
    if (highErrorVariants.length > 0) {
      recommendations.push(`High error rates in variants: ${highErrorVariants.map(v => v.variant).join(', ')}`);
    }

    // Sample size recommendations
    const lowSampleVariants = Object.values(variantMetrics).filter(v => v.sampleSize < this.config.minSampleSize);
    if (lowSampleVariants.length > 0) {
      recommendations.push('Increase traffic allocation to reach statistical significance faster');
    }

    return recommendations;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }
}