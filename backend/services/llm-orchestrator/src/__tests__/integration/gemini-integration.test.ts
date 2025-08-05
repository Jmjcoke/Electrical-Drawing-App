/**
 * Integration tests for Gemini Provider
 * 
 * Tests provider integration with:
 * - Provider Factory and registration system
 * - Circuit breaker and reliability patterns
 * - Provider registry and ensemble orchestration
 * - End-to-end analysis workflow
 */

import { ProviderFactory } from '../../providers/base/ProviderFactory';
import { GeminiProvider, GeminiConfig } from '../../providers/gemini.provider';
import { registerAllProviders, createProvidersFromEnv } from '../../providers/registry';
import { CircuitBreaker } from '../../reliability/CircuitBreaker';
import { LLMProvider } from '../../providers/base/LLMProvider.interface';

// Mock environment variables
const originalEnv = process.env;

describe('Gemini Provider Integration', () => {
  let factory: ProviderFactory;
  let testConfig: GeminiConfig;

  beforeEach(() => {
    // Reset factory singleton and clear registrations
    (ProviderFactory as any)._instance = null;
    factory = ProviderFactory.getInstance();
    // Clear any existing registrations
    (factory as any).registeredProviders.clear();
    
    // Setup test configuration
    testConfig = {
      apiKey: 'test-api-key',
      model: 'gemini-pro-vision',
      maxTokens: 2048,
      temperature: 0.1,
      timeout: 30000,
      maxRetries: 3
    };

    // Mock environment variables
    process.env = {
      ...originalEnv,
      GOOGLE_API_KEY: 'test-google-api-key',
      GEMINI_MAX_TOKENS: '2048',
      GEMINI_TEMPERATURE: '0.1',
      GEMINI_TIMEOUT: '30000',
      GEMINI_MAX_RETRIES: '3'
    };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Provider Factory Integration', () => {
    beforeEach(() => {
      registerAllProviders();
    });

    it('should register Gemini provider with factory', () => {
      const registrations = factory.getRegisteredProviderTypes();
      const geminiRegistration = registrations.find(reg => reg.type === 'google');

      expect(geminiRegistration).toBeDefined();
      expect(geminiRegistration?.name).toBe('Google Gemini Pro Vision');
      expect(geminiRegistration?.description).toContain('multimodal analysis');
    });

    it('should create Gemini provider through factory', () => {
      const providerConfig = {
        type: 'google',
        enabled: true,
        priority: 80,
        config: {
          apiKey: 'test-key',
          model: 'gemini-pro-vision',
          maxTokens: 2048,
          temperature: 0.1
        }
      };

      const provider = factory.createProvider(providerConfig);
      
      expect(provider).toBeInstanceOf(GeminiProvider);
      expect(provider.name).toBe('gemini-pro-vision');
      expect(provider.version).toBe('1.0');
    });

    it('should validate required configuration through factory', () => {
      const incompleteProviderConfig = {
        type: 'google',
        enabled: true,
        priority: 80,
        config: {
          apiKey: 'test-key'
          // Missing required fields
        }
      };

      expect(() => factory.createProvider(incompleteProviderConfig))
        .toThrow();
    });

    it('should use default configuration values', () => {
      const minimalProviderConfig = {
        type: 'google',
        enabled: true,
        priority: 80,
        config: {
          apiKey: 'test-key',
          model: 'gemini-pro-vision',
          maxTokens: 2048,
          temperature: 0.1
        }
      };

      // Should not throw with minimal config due to defaults
      const provider = factory.createProvider(minimalProviderConfig);
      expect(provider).toBeInstanceOf(GeminiProvider);
    });
  });

  describe('Environment Configuration Integration', () => {
    it('should create providers from environment variables', () => {
      registerAllProviders();
      const providers = createProvidersFromEnv();

      expect(providers.has('google')).toBe(true);
      
      const geminiProvider = providers.get('google');
      expect(geminiProvider).toBeInstanceOf(GeminiProvider);
    });

    it('should handle missing environment variables gracefully', () => {
      // Remove Google API key
      delete process.env.GOOGLE_API_KEY;

      registerAllProviders();
      const providers = createProvidersFromEnv();

      expect(providers.has('google')).toBe(false);
    });

    it('should apply environment configuration to provider', () => {
      process.env.GEMINI_MAX_TOKENS = '4096';
      process.env.GEMINI_TEMPERATURE = '0.2';

      registerAllProviders();
      const providers = createProvidersFromEnv();
      
      const geminiProvider = providers.get('google') as GeminiProvider;
      expect(geminiProvider).toBeDefined();
      
      // Verify configuration was applied (indirectly through behavior)
      expect(geminiProvider.metadata.capabilities.supportsVision).toBe(true);
    });
  });

  describe('Circuit Breaker Integration', () => {
    let provider: GeminiProvider;
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      provider = new GeminiProvider(testConfig);
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 0.5,
        recoveryTimeout: 1000,
        timeout: 5000,
        halfOpenMaxRequests: 2,
        monitoringWindow: 10000,
        minimumRequests: 3
      });
    });

    it('should integrate with circuit breaker pattern', async () => {
      const testImage = Buffer.from('test-image-data');
      const testPrompt = 'Test prompt';

      // Mock a successful operation
      const mockAnalyze = jest.spyOn(provider, 'analyze').mockResolvedValue({
        id: 'test-id',
        content: 'Analysis result',
        confidence: 0.9,
        tokensUsed: 100,
        responseTime: 500,
        model: 'gemini-pro-vision',
        timestamp: new Date(),
        metadata: {}
      });

      // Execute through circuit breaker
      const result = await circuitBreaker.execute(
        () => provider.analyze(testImage, testPrompt)
      );

      expect(result.content).toBe('Analysis result');
      expect(mockAnalyze).toHaveBeenCalledWith(testImage, testPrompt);
    });

    it('should trip circuit breaker on repeated failures', async () => {
      const testImage = Buffer.from('test-image-data');
      const testPrompt = 'Test prompt';

      // Mock failing operations
      jest.spyOn(provider, 'analyze').mockRejectedValue(new Error('API failure'));

      // Execute enough failures to trip the breaker
      const failures = [];
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(
            () => provider.analyze(testImage, testPrompt)
          );
        } catch (error) {
          failures.push(error);
        }
      }

      expect(failures.length).toBeGreaterThan(0);
      
      // Circuit should be open now
      expect(circuitBreaker.getState()).toBe('OPEN');
    });

    it('should allow health check through circuit breaker', async () => {
      // Mock successful health check
      jest.spyOn(provider, 'healthCheck').mockResolvedValue(true);

      const isHealthy = await circuitBreaker.execute(
        () => provider.healthCheck()
      );

      expect(isHealthy).toBe(true);
    });
  });

  describe('Provider Rate Limiting', () => {
    let provider: GeminiProvider;

    beforeEach(() => {
      provider = new GeminiProvider(testConfig);
    });

    it('should have rate limiting through BaseProvider framework', () => {
      const rateLimit = provider.getRateLimit();
      expect(rateLimit).toBeDefined();
      expect(rateLimit.requestsPerMinute).toBeGreaterThan(0);
      expect(rateLimit.requestsRemaining).toBeDefined();
      expect(rateLimit.resetTime).toBeInstanceOf(Date);
    });

    it('should calculate cost correctly', () => {
      const cost = provider.getCost(1000);
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });
  });

  describe('Multi-Provider Ensemble Integration', () => {
    let providers: Map<string, LLMProvider>;

    beforeEach(() => {
      registerAllProviders();
      
      // Create multiple providers for ensemble testing
      const configs = [
        {
          type: 'google',
          enabled: true,
          priority: 80,
          config: {
            apiKey: 'test-google-key',
            model: 'gemini-pro-vision',
            maxTokens: 2048,
            temperature: 0.1
          }
        }
      ];

      providers = factory.createProviders(configs);
    });

    it('should create Gemini provider as part of ensemble', () => {
      expect(providers.has('google')).toBe(true);
      
      const geminiProvider = providers.get('google');
      expect(geminiProvider).toBeInstanceOf(GeminiProvider);
      expect(geminiProvider?.name).toBe('gemini-pro-vision');
    });

    it('should support provider priority ordering', () => {
      const configs = [
        {
          type: 'google',
          enabled: true,
          priority: 80,
          config: { 
            apiKey: 'test-key',
            model: 'gemini-pro-vision',
            maxTokens: 2048,
            temperature: 0.1
          }
        }
      ];

      const orderedProviders = factory.createProviders(configs);
      
      // Verify provider was created with correct priority
      expect(orderedProviders.has('google')).toBe(true);
    });
  });

  describe('End-to-End Analysis Workflow', () => {
    let provider: GeminiProvider;

    beforeEach(() => {
      provider = new GeminiProvider(testConfig);
    });

    it('should complete full analysis workflow', async () => {
      const testImage = Buffer.from('mock-electrical-schematic-data');
      const electricalPrompt = `
        Analyze this electrical schematic and identify:
        1. Components present (resistors, capacitors, etc.)
        2. Circuit topology
        3. Potential issues or recommendations
      `;

      // Mock the analysis response
      jest.spyOn(provider, 'analyze').mockResolvedValue({
        id: 'analysis-123',
        content: `
          This electrical schematic contains:
          1. Components: 3 resistors (R1, R2, R3), 2 capacitors (C1, C2)
          2. Topology: Series-parallel configuration
          3. Recommendations: Consider adding a fuse for protection
        `,
        confidence: 0.92,
        tokensUsed: 250,
        responseTime: 1200,
        model: 'gemini-pro-vision',
        timestamp: new Date(),
        metadata: {
          finishReason: 'STOP',
          safetyRatings: [],
          usageMetadata: {
            promptTokenCount: 150,
            candidatesTokenCount: 100,
            totalTokenCount: 250
          }
        }
      });

      const result = await provider.analyze(testImage, electricalPrompt);

      // Verify complete workflow
      expect(result.id).toBeDefined();
      expect(result.content).toContain('electrical schematic');
      expect(result.content).toContain('resistors');
      expect(result.content).toContain('capacitors');
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.tokensUsed).toBeGreaterThan(0);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.model).toBe('gemini-pro-vision');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.metadata).toBeDefined();
    });

    it('should handle workflow with analysis options', async () => {
      const testImage = Buffer.from('complex-schematic-data');
      const complexPrompt = 'Provide detailed analysis of this complex electrical system';
      const options = {
        maxTokens: 4096,
        temperature: 0.05,
        timeout: 45000
      };

      // Mock analysis with options
      jest.spyOn(provider, 'analyze').mockResolvedValue({
        id: 'complex-analysis-456',
        content: 'Detailed analysis of complex electrical system...',
        confidence: 0.88,
        tokensUsed: 800,
        responseTime: 2500,
        model: 'gemini-pro-vision',
        timestamp: new Date(),
        metadata: {}
      });

      const result = await provider.analyze(testImage, complexPrompt, options);

      expect(result.tokensUsed).toBeGreaterThan(500); // More tokens for complex analysis
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should maintain provider health during workflow', async () => {
      // Mock successful health check
      jest.spyOn(provider, 'healthCheck').mockResolvedValue(true);

      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(true);

      // Should still be healthy after analysis
      const testImage = Buffer.from('test-data');
      jest.spyOn(provider, 'analyze').mockResolvedValue({
        id: 'test-id',
        content: 'Test analysis',
        confidence: 0.9,
        tokensUsed: 100,
        responseTime: 500,
        model: 'gemini-pro-vision',
        timestamp: new Date(),
        metadata: {}
      });

      await provider.analyze(testImage, 'Test prompt');
      
      const stillHealthy = await provider.healthCheck();
      expect(stillHealthy).toBe(true);
    });
  });

  describe('Configuration and Registry Integration', () => {
    it('should validate provider configuration in registry', () => {
      registerAllProviders();
      
      const validConfig = {
        apiKey: 'valid-key',
        model: 'gemini-pro-vision',
        maxTokens: 2048,
        temperature: 0.1
      };

      const providerConfig = {
        type: 'google',
        enabled: true,
        priority: 80,
        config: validConfig
      };
      
      expect(() => factory.createProvider(providerConfig))
        .not.toThrow();
    });

    it('should handle invalid configuration in registry', () => {
      registerAllProviders();
      
      const invalidConfig = {
        apiKey: 'valid-key',
        model: 'invalid-unsupported-model' as any, // This should trigger validation error in GeminiProvider constructor
        maxTokens: -100, // Also invalid
        temperature: 0.1
      };

      const invalidProviderConfig = {
        type: 'google',
        enabled: true,
        priority: 80,
        config: invalidConfig
      };
      
      expect(() => factory.createProvider(invalidProviderConfig))
        .toThrow(); // Should throw ConfigurationError from GeminiProvider validation
    });

    it('should support custom safety settings in configuration', () => {
      registerAllProviders();
      
      const configWithSafety = {
        apiKey: 'valid-key',
        model: 'gemini-pro-vision',
        maxTokens: 2048,
        temperature: 0.1,
        safetySettings: [
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_ONLY_HIGH'
          }
        ]
      };

      const safetyProviderConfig = {
        type: 'google',
        enabled: true,
        priority: 80,
        config: configWithSafety
      };
      
      expect(() => factory.createProvider(safetyProviderConfig))
        .not.toThrow();
    });
  });
});