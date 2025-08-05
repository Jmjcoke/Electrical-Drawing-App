/**
 * Ensemble Orchestrator Unit Tests
 * 
 * Comprehensive test suite for the EnsembleOrchestrator class covering
 * all scenarios including parallel processing, error handling, and aggregation.
 */

import { EnsembleOrchestrator, EnsembleConfig } from '../../ensemble/orchestrator';
import { LLMProvider, LLMResponse, AnalysisOptions, ProviderError } from '../../providers/base/LLMProvider.interface';
import { CircuitBreaker, CircuitBreakerConfig } from '../../reliability/CircuitBreaker';

// Mock implementations
class MockProvider implements LLMProvider {
  constructor(
    public readonly name: string,
    public readonly version: string = '1.0.0',
    private responseTime: number = 1000,
    private shouldFail: boolean = false,
    private confidence: number = 0.8
  ) {}

  readonly metadata = {
    name: this.name,
    version: this.version,
    capabilities: {
      supportsVision: true,
      maxImageSize: 5 * 1024 * 1024,
      supportedImageFormats: ['jpeg', 'png'],
      maxPromptLength: 10000,
      supportsStreaming: false
    },
    description: `Mock ${this.name} provider`
  };

  async analyze(_image: Buffer, _prompt: string, _options?: AnalysisOptions): Promise<LLMResponse> {
    // Simulate response time
    await new Promise(resolve => setTimeout(resolve, this.responseTime));

    if (this.shouldFail) {
      throw new ProviderError(`${this.name} analysis failed`, 'ANALYSIS_ERROR', this.name);
    }

    return {
      id: `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: `Analysis result from ${this.name}: Component identification shows electrical circuit with resistors and capacitors.`,
      confidence: this.confidence,
      tokensUsed: Math.floor(Math.random() * 500) + 100,
      responseTime: this.responseTime,
      model: this.name,
      timestamp: new Date(),
      metadata: {
        components: [
          { type: 'resistor', location: { x: 100, y: 200 }, confidence: this.confidence },
          { type: 'capacitor', location: { x: 300, y: 200 }, confidence: this.confidence - 0.1 }
        ]
      }
    };
  }

  async healthCheck(): Promise<boolean> {
    return !this.shouldFail;
  }

  getRateLimit() {
    return {
      requestsPerMinute: 60,
      requestsRemaining: 59,
      resetTime: new Date(Date.now() + 60000),
      dailyLimit: 1000,
      dailyUsed: 10
    };
  }

  getCost(tokens: number): number {
    return tokens * 0.001; // $0.001 per token
  }

  getRequiredConfig(): string[] {
    return ['apiKey'];
  }

  validateConfig(config: Record<string, unknown>): boolean {
    return !!config.apiKey;
  }

  // Test helper methods
  setResponseTime(time: number): void {
    this.responseTime = time;
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  setConfidence(confidence: number): void {
    this.confidence = confidence;
  }
}

class MockCircuitBreaker extends CircuitBreaker {
  private _isOpen = false;

  constructor() {
    const config: CircuitBreakerConfig = {
      failureThreshold: 0.5,
      recoveryTimeout: 30000,
      halfOpenMaxRequests: 3,
      timeout: 30000,
      monitoringWindow: 60000,
      minimumRequests: 5
    };
    super(config);
  }

  isOpen(): boolean {
    return this._isOpen;
  }

  setOpen(open: boolean): void {
    this._isOpen = open;
  }
}

describe('EnsembleOrchestrator', () => {
  let orchestrator: EnsembleOrchestrator;
  let mockProvider1: MockProvider;
  let mockProvider2: MockProvider;
  let mockProvider3: MockProvider;
  let mockCircuitBreaker1: MockCircuitBreaker;
  let mockCircuitBreaker2: MockCircuitBreaker;
  let mockCircuitBreaker3: MockCircuitBreaker;
  let testConfig: EnsembleConfig;
  let testImage: Buffer;

  beforeEach(() => {
    testConfig = {
      providers: {
        enabled: ['openai', 'claude', 'gemini'],
        priority: { openai: 100, claude: 90, gemini: 80 },
        weights: { openai: 1.0, claude: 0.9, gemini: 0.8 }
      },
      performance: {
        maxTotalTimeout: 15000,
        maxProviderTimeout: 10000,
        minProvidersRequired: 2,
        enableLoadBalancing: true
      },
      aggregation: {
        consensusThreshold: 0.7,
        confidenceWeighting: {
          agreement: 0.4,
          completeness: 0.3,
          consistency: 0.3
        },
        componentClusteringThreshold: 50
      },
      monitoring: {
        enablePerformanceTracking: true,
        enableHealthChecks: true,
        healthCheckInterval: 30000
      }
    };

    orchestrator = new EnsembleOrchestrator(testConfig);
    
    mockProvider1 = new MockProvider('openai', '1.0.0', 1000, false, 0.9);
    mockProvider2 = new MockProvider('claude', '1.0.0', 1200, false, 0.85);
    mockProvider3 = new MockProvider('gemini', '1.0.0', 800, false, 0.8);
    
    mockCircuitBreaker1 = new MockCircuitBreaker();
    mockCircuitBreaker2 = new MockCircuitBreaker();
    mockCircuitBreaker3 = new MockCircuitBreaker();

    testImage = Buffer.from('mock image data');
  });

  describe('Provider Registration', () => {
    test('should register providers successfully', () => {
      orchestrator.registerProvider('openai', mockProvider1, mockCircuitBreaker1);
      orchestrator.registerProvider('claude', mockProvider2, mockCircuitBreaker2);
      orchestrator.registerProvider('gemini', mockProvider3, mockCircuitBreaker3);

      const available = orchestrator.getAvailableProviders();
      expect(available).toContain('openai');
      expect(available).toContain('claude');
      expect(available).toContain('gemini');
      expect(available).toHaveLength(3);
    });

    test('should unregister providers successfully', () => {
      orchestrator.registerProvider('openai', mockProvider1, mockCircuitBreaker1);
      orchestrator.registerProvider('claude', mockProvider2, mockCircuitBreaker2);

      expect(orchestrator.getAvailableProviders()).toHaveLength(2);

      const result = orchestrator.unregisterProvider('openai');
      expect(result).toBe(true);
      expect(orchestrator.getAvailableProviders()).toHaveLength(1);
      expect(orchestrator.getAvailableProviders()).not.toContain('openai');
    });

    test('should handle unregistering non-existent provider', () => {
      const result = orchestrator.unregisterProvider('nonexistent');
      expect(result).toBe(false);
    });

    test('should filter out providers with open circuit breakers', () => {
      orchestrator.registerProvider('openai', mockProvider1, mockCircuitBreaker1);
      orchestrator.registerProvider('claude', mockProvider2, mockCircuitBreaker2);

      mockCircuitBreaker1.setOpen(true);

      const healthy = orchestrator.getHealthyProviders();
      expect(healthy).toContain('claude');
      expect(healthy).not.toContain('openai');
      expect(healthy).toHaveLength(1);
    });
  });

  describe('Ensemble Analysis', () => {
    beforeEach(() => {
      orchestrator.registerProvider('openai', mockProvider1, mockCircuitBreaker1);
      orchestrator.registerProvider('claude', mockProvider2, mockCircuitBreaker2);
      orchestrator.registerProvider('gemini', mockProvider3, mockCircuitBreaker3);
    });

    test('should execute successful ensemble analysis with all providers', async () => {
      const prompt = 'Analyze this electrical circuit diagram';
      
      const result = await orchestrator.analyzeWithEnsemble(testImage, prompt);

      expect(result).toBeDefined();
      expect(result.individual).toHaveLength(3);
      expect(result.metadata.providersSuccessful).toHaveLength(3);
      expect(result.metadata.providersFailed).toHaveLength(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.metadata.totalTime).toBeGreaterThan(0);
      expect(result.aggregated).toBeDefined();
      expect(result.consensus).toBeDefined();
    });

    test('should handle partial provider failures gracefully', async () => {
      mockProvider2.setShouldFail(true); // Claude fails
      
      const prompt = 'Analyze this electrical circuit diagram';
      const result = await orchestrator.analyzeWithEnsemble(testImage, prompt);

      expect(result.individual).toHaveLength(2); // Only successful responses
      expect(result.metadata.providersSuccessful).toHaveLength(2);
      expect(result.metadata.providersFailed).toHaveLength(1);
      expect(result.metadata.providersFailed[0].provider).toBe('claude');
      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should fail when insufficient providers are available', async () => {
      // Make two providers fail, leaving only one (below minimum of 2)
      mockProvider1.setShouldFail(true);
      mockProvider2.setShouldFail(true);

      const prompt = 'Analyze this electrical circuit diagram';
      
      await expect(orchestrator.analyzeWithEnsemble(testImage, prompt))
        .rejects
        .toThrow('Insufficient healthy providers');
    });

    test('should respect provider timeout constraints', async () => {
      // Set one provider to take too long
      mockProvider2.setResponseTime(12000); // Exceeds maxProviderTimeout of 10000

      const prompt = 'Analyze this electrical circuit diagram';
      const result = await orchestrator.analyzeWithEnsemble(testImage, prompt);

      // Should still succeed with other providers
      expect(result.individual.length).toBeLessThan(3);
      expect(result.metadata.providersFailed.length).toBeGreaterThan(0);
    });

    test('should handle circuit breaker activation', async () => {
      mockCircuitBreaker2.setOpen(true); // Claude circuit breaker is open
      
      const prompt = 'Analyze this electrical circuit diagram';
      const result = await orchestrator.analyzeWithEnsemble(testImage, prompt);

      expect(result.individual).toHaveLength(2); // Only providers with closed circuit breakers
      expect(result.metadata.providersAttempted).toHaveLength(2);
      expect(result.metadata.circuitBreakerStatus.claude).toBe(true);
    });

    test('should fail completely when all providers fail', async () => {
      mockProvider1.setShouldFail(true);
      mockProvider2.setShouldFail(true);
      mockProvider3.setShouldFail(true);

      const prompt = 'Analyze this electrical circuit diagram';
      
      await expect(orchestrator.analyzeWithEnsemble(testImage, prompt))
        .rejects
        .toThrow('All providers failed to complete analysis');
    });

    test('should handle timeout options correctly', async () => {
      const options: AnalysisOptions = {
        timeout: 5000 // Shorter than default
      };
      
      mockProvider2.setResponseTime(6000); // Will timeout with custom timeout
      
      const prompt = 'Analyze this electrical circuit diagram';
      const result = await orchestrator.analyzeWithEnsemble(testImage, prompt, options);

      // Should succeed with providers that respond within timeout
      expect(result.individual.length).toBeLessThan(3);
    });
  });

  describe('Response Aggregation', () => {
    beforeEach(() => {
      orchestrator.registerProvider('openai', mockProvider1, mockCircuitBreaker1);
      orchestrator.registerProvider('claude', mockProvider2, mockCircuitBreaker2);
      orchestrator.registerProvider('gemini', mockProvider3, mockCircuitBreaker3);
    });

    test('should aggregate responses with proper consensus', async () => {
      const prompt = 'Identify components in this circuit';
      const result = await orchestrator.analyzeWithEnsemble(testImage, prompt);

      expect(result.consensus).toBeDefined();
      expect(result.consensus.agreementLevel).toBeGreaterThanOrEqual(0);
      expect(result.consensus.agreementLevel).toBeLessThanOrEqual(1);
      expect(result.consensus.consensusContent).toBeDefined();
      expect(typeof result.consensus.consensusContent).toBe('string');
    });

    test('should calculate confidence based on provider agreement', async () => {
      // Set all providers to high confidence
      mockProvider1.setConfidence(0.9);
      mockProvider2.setConfidence(0.95);
      mockProvider3.setConfidence(0.85);

      const prompt = 'Analyze this electrical diagram';
      const result = await orchestrator.analyzeWithEnsemble(testImage, prompt);

      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.aggregated.modelComparison).toBeDefined();
      expect(result.aggregated.modelComparison.providers).toHaveLength(3);
    });

    test('should handle low confidence scenarios', async () => {
      // Set all providers to low confidence
      mockProvider1.setConfidence(0.3);
      mockProvider2.setConfidence(0.4);
      mockProvider3.setConfidence(0.2);

      const prompt = 'Analyze this unclear diagram';
      const result = await orchestrator.analyzeWithEnsemble(testImage, prompt);

      expect(result.confidence).toBeLessThan(0.5);
      expect(result.consensus.disagreements.length).toBeGreaterThanOrEqual(0);
    });

    test('should provide model comparison data', async () => {
      const prompt = 'Compare circuit analysis';
      const result = await orchestrator.analyzeWithEnsemble(testImage, prompt);

      const comparison = result.aggregated.modelComparison;
      expect(comparison.providers).toHaveLength(3);
      expect(comparison.performanceMetrics).toBeDefined();
      expect(comparison.qualityScores).toBeDefined();

      // Check provider comparison details
      for (const provider of comparison.providers) {
        expect(provider.provider).toBeDefined();
        expect(provider.responseTime).toBeGreaterThan(0);
        expect(provider.tokensUsed).toBeGreaterThan(0);
        expect(provider.confidence).toBeGreaterThanOrEqual(0);
        expect(provider.cost).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(() => {
      orchestrator.registerProvider('openai', mockProvider1, mockCircuitBreaker1);
      orchestrator.registerProvider('claude', mockProvider2, mockCircuitBreaker2);
    });

    test('should track parallel execution efficiency', async () => {
      mockProvider1.setResponseTime(1000);
      mockProvider2.setResponseTime(1500);

      const prompt = 'Efficiency test';
      const result = await orchestrator.analyzeWithEnsemble(testImage, prompt);

      expect(result.metadata.performance.parallelEfficiency).toBeGreaterThan(0);
      expect(result.metadata.performance.parallelEfficiency).toBeLessThanOrEqual(1);
      expect(result.metadata.totalTime).toBeLessThan(3000); // Should be parallel, not sequential
    });

    test('should calculate cost breakdown correctly', async () => {
      const prompt = 'Cost tracking test';
      const result = await orchestrator.analyzeWithEnsemble(testImage, prompt);

      const costBreakdown = result.metadata.costBreakdown;
      expect(costBreakdown.total).toBeGreaterThan(0);
      expect(costBreakdown.byProvider).toHaveLength(2);
      expect(costBreakdown.breakdown).toBeDefined();
      
      // Verify cost breakdown sums up
      const providerCostSum = costBreakdown.byProvider.reduce((sum, p) => sum + p.cost, 0);
      expect(Math.abs(providerCostSum - costBreakdown.total)).toBeLessThan(0.001);
    });

    test('should track provider success and failure rates', async () => {
      mockProvider2.setShouldFail(true);

      const prompt = 'Success rate test';
      const result = await orchestrator.analyzeWithEnsemble(testImage, prompt);

      expect(result.metadata.performance.providersSuccessful).toBe(1);
      expect(result.metadata.performance.providersFailed).toBe(1);
      expect(result.metadata.performance.providersUsed).toBe(2);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      orchestrator.registerProvider('openai', mockProvider1, mockCircuitBreaker1);
      orchestrator.registerProvider('claude', mockProvider2, mockCircuitBreaker2);
    });

    test('should handle provider errors without crashing', async () => {
      mockProvider1.setShouldFail(true);
      
      const prompt = 'Error handling test';
      const result = await orchestrator.analyzeWithEnsemble(testImage, prompt);

      expect(result).toBeDefined();
      expect(result.metadata.providersFailed).toHaveLength(1);
      expect(result.metadata.providersFailed[0].provider).toBe('openai');
      expect(result.metadata.providersFailed[0].error).toContain('analysis failed');
    });

    test('should handle timeout errors appropriately', async () => {
      mockProvider1.setResponseTime(12000); // Exceeds provider timeout
      
      const prompt = 'Timeout test';
      const result = await orchestrator.analyzeWithEnsemble(testImage, prompt);

      expect(result.metadata.providersFailed.length).toBeGreaterThan(0);
      const timeoutFailure = result.metadata.providersFailed.find(f => f.error.includes('timeout'));
      expect(timeoutFailure).toBeDefined();
    });

    test('should validate minimum providers before starting', async () => {
      // Only register one provider when minimum is 2
      orchestrator = new EnsembleOrchestrator({
        ...testConfig,
        performance: { ...testConfig.performance, minProvidersRequired: 2 }
      });
      orchestrator.registerProvider('openai', mockProvider1, mockCircuitBreaker1);
      mockCircuitBreaker1.setOpen(true); // Make it unhealthy

      const prompt = 'Minimum providers test';
      
      await expect(orchestrator.analyzeWithEnsemble(testImage, prompt))
        .rejects
        .toThrow('Insufficient healthy providers');
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration dynamically', () => {
      const newConfig: Partial<EnsembleConfig> = {
        performance: {
          ...testConfig.performance,
          maxTotalTimeout: 20000
        }
      };

      orchestrator.updateConfig(newConfig);
      
      // Configuration update should not throw
      expect(() => orchestrator.updateConfig(newConfig)).not.toThrow();
    });

    test('should provide orchestration statistics', () => {
      orchestrator.registerProvider('openai', mockProvider1, mockCircuitBreaker1);
      orchestrator.registerProvider('claude', mockProvider2, mockCircuitBreaker2);

      const stats = orchestrator.getStatistics();
      
      expect(stats.totalProviders).toBe(2);
      expect(stats.enabledProviders).toBe(2);
      expect(stats.healthyProviders).toBe(2);
      expect(stats.requestsProcessed).toBe(0);
      expect(stats.circuitBreakerStatus).toBeDefined();
    });

    test('should perform health checks on all providers', async () => {
      orchestrator.registerProvider('openai', mockProvider1, mockCircuitBreaker1);
      orchestrator.registerProvider('claude', mockProvider2, mockCircuitBreaker2);
      
      mockProvider2.setShouldFail(true); // Make Claude unhealthy

      const healthStatus = await orchestrator.performHealthCheck();
      
      expect(healthStatus.openai).toBe(true);
      expect(healthStatus.claude).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty provider list gracefully', async () => {
      // No providers registered
      const prompt = 'Empty providers test';
      
      await expect(orchestrator.analyzeWithEnsemble(testImage, prompt))
        .rejects
        .toThrow('Insufficient healthy providers');
    });

    test('should handle single provider scenario', async () => {
      orchestrator = new EnsembleOrchestrator({
        ...testConfig,
        performance: { ...testConfig.performance, minProvidersRequired: 1 }
      });
      orchestrator.registerProvider('openai', mockProvider1, mockCircuitBreaker1);

      const prompt = 'Single provider test';
      const result = await orchestrator.analyzeWithEnsemble(testImage, prompt);

      expect(result.individual).toHaveLength(1);
      expect(result.consensus.agreementLevel).toBe(1.0); // Perfect agreement with single provider
    });

    test('should handle very fast provider responses', async () => {
      mockProvider1.setResponseTime(10); // Very fast
      mockProvider2.setResponseTime(20); // Very fast
      
      orchestrator.registerProvider('openai', mockProvider1, mockCircuitBreaker1);
      orchestrator.registerProvider('claude', mockProvider2, mockCircuitBreaker2);

      const prompt = 'Fast response test';
      const result = await orchestrator.analyzeWithEnsemble(testImage, prompt);

      expect(result.metadata.totalTime).toBeLessThan(1000);
      expect(result.metadata.performance.parallelEfficiency).toBeGreaterThan(0.5);
    });

    test('should handle providers with identical responses', async () => {
      // Create providers that return very similar responses
      const identicalProvider1 = new MockProvider('provider1', '1.0.0', 1000, false, 0.9);
      const identicalProvider2 = new MockProvider('provider2', '1.0.0', 1000, false, 0.9);
      
      orchestrator.registerProvider('provider1', identicalProvider1, mockCircuitBreaker1);
      orchestrator.registerProvider('provider2', identicalProvider2, mockCircuitBreaker2);

      const prompt = 'Identical responses test';
      const result = await orchestrator.analyzeWithEnsemble(testImage, prompt);

      expect(result.consensus.agreementLevel).toBeGreaterThan(0.8); // High agreement
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Concurrent Requests', () => {
    beforeEach(() => {
      orchestrator.registerProvider('openai', mockProvider1, mockCircuitBreaker1);
      orchestrator.registerProvider('claude', mockProvider2, mockCircuitBreaker2);
    });

    test('should handle multiple concurrent ensemble requests', async () => {
      const promises = Array.from({ length: 3 }, (_, i) => 
        orchestrator.analyzeWithEnsemble(testImage, `Concurrent test ${i}`)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.individual.length).toBeGreaterThan(0);
      });

      // All requests should have unique IDs
      const ids = results.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    test('should maintain performance under concurrent load', async () => {
      const startTime = Date.now();
      
      const promises = Array.from({ length: 5 }, (_, i) => 
        orchestrator.analyzeWithEnsemble(testImage, `Load test ${i}`)
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;
      
      expect(results).toHaveLength(5);
      // Should complete in reasonable time (not much more than sequential)
      expect(totalTime).toBeLessThan(8000); // Allowing for some overhead
    });
  });
});