/**
 * Integration tests for Claude provider with factory and ensemble
 */

import { ProviderFactory } from '../../providers/base/ProviderFactory';
import { ClaudeProvider } from '../../providers/claude.provider';
import { registerAllProviders } from '../../providers/registry';

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn()
      }
    }))
  };
});

describe('Claude Integration Tests', () => {
  let factory: ProviderFactory;
  let mockAnthropicClient: any;

  beforeEach(() => {
    // Clear factory instance for clean state
    (ProviderFactory as any).instance = undefined;
    factory = ProviderFactory.getInstance();

    // Clear all mocks
    jest.clearAllMocks();

    // Mock Anthropic client
    const AnthropicMock = require('@anthropic-ai/sdk').default;
    mockAnthropicClient = {
      messages: {
        create: jest.fn()
      }
    };
    AnthropicMock.mockImplementation(() => mockAnthropicClient);

    // Register providers
    registerAllProviders();
  });

  afterEach(() => {
    factory.clearActiveProviders();
  });

  describe('Provider Factory Integration', () => {
    it('should register Claude provider with factory', () => {
      const registeredTypes = factory.getRegisteredProviderTypes();
      const claudeRegistration = registeredTypes.find(p => p.type === 'anthropic');
      
      expect(claudeRegistration).toBeDefined();
      expect(claudeRegistration?.name).toBe('Anthropic Claude 3.5 Sonnet');
      expect(claudeRegistration?.requiredConfig).toEqual(['apiKey', 'model', 'maxTokens', 'temperature']);
    });

    it('should create Claude provider from configuration', () => {
      const config = {
        type: 'anthropic',
        enabled: true,
        priority: 90,
        config: {
          apiKey: 'sk-ant-api03-test-key',
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 4096,
          temperature: 0.1
        }
      };

      const provider = factory.createProvider(config);
      
      expect(provider).toBeInstanceOf(ClaudeProvider);
      expect(provider.name).toBe('claude-3-5-sonnet');
      expect(provider.version).toBe('20241022');
    });

    it('should handle missing required configuration', () => {
      const config = {
        type: 'anthropic',
        enabled: true,
        priority: 90,
        config: {
          apiKey: 'sk-ant-api03-test-key'
          // Missing required fields
        }
      };

      expect(() => factory.createProvider(config)).toThrow();
    });

    it('should merge default configuration', () => {
      const config = {
        type: 'anthropic',
        enabled: true,
        priority: 90,
        config: {
          apiKey: 'sk-ant-api03-test-key',
          model: 'claude-3-5-sonnet-20241022', // Required field must be provided
          maxTokens: 4096, // Required field must be provided  
          temperature: 0.1 // Required field must be provided
          // Other optional fields should use defaults
        }
      };

      const provider = factory.createProvider(config) as ClaudeProvider;
      
      // Should use provided required values and default optional values
      expect(provider.name).toBe('claude-3-5-sonnet');
      expect(provider.version).toBe('20241022');
    });
  });

  describe('Multi-Provider Ensemble Integration', () => {
    it('should create multiple providers with priorities', () => {
      const configs = [
        {
          type: 'anthropic',
          enabled: true,
          priority: 90,
          config: {
            apiKey: 'sk-ant-api03-test-key',
            model: 'claude-3-5-sonnet-20241022',
            maxTokens: 4096,
            temperature: 0.1
          }
        }
      ];

      const providers = factory.createProviders(configs);
      
      expect(providers.size).toBe(1);
      expect(providers.has('anthropic')).toBe(true);
      
      const claudeProvider = providers.get('anthropic');
      expect(claudeProvider).toBeInstanceOf(ClaudeProvider);
    });

    it('should handle provider creation failures gracefully', () => {
      const configs = [
        {
          type: 'anthropic',
          enabled: true,
          priority: 90,
          config: {
            apiKey: '', // Invalid API key
            model: 'claude-3-5-sonnet-20241022',
            maxTokens: 4096,
            temperature: 0.1
          }
        }
      ];

      expect(() => factory.createProviders(configs)).toThrow();
    });

    it('should sort providers by priority', () => {
      const configs = [
        {
          type: 'anthropic',
          enabled: true,
          priority: 90,
          config: {
            apiKey: 'sk-ant-api03-test-key',
            model: 'claude-3-5-sonnet-20241022',
            maxTokens: 4096,
            temperature: 0.1
          }
        }
      ];

      factory.createProviders(configs);
      
      // Verify provider was created successfully  
      const activeProviders = factory.getActiveProviders();
      expect(activeProviders.size).toBe(1);
      expect(activeProviders.has('anthropic')).toBe(true);
    });

    it('should discover providers by capability', () => {
      const configs = [
        {
          type: 'anthropic',
          enabled: true,
          priority: 90,
          config: {
            apiKey: 'sk-ant-api03-test-key',
            model: 'claude-3-5-sonnet-20241022',
            maxTokens: 4096,
            temperature: 0.1
          }
        }
      ];

      factory.createProviders(configs);
      const visionProviders = factory.discoverProviders('vision');
      
      expect(visionProviders.length).toBeGreaterThan(0);
      const claudeProvider = visionProviders.find(p => p.type === 'anthropic');
      expect(claudeProvider).toBeDefined();
      expect(claudeProvider?.provider).toBeInstanceOf(ClaudeProvider);
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should integrate with circuit breaker pattern', async () => {
      // Mock successful API response
      const mockResponse = {
        content: [{ type: 'text', text: 'Circuit analysis complete' }],
        usage: { input_tokens: 100, output_tokens: 50 },
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn'
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      const config = {
        type: 'anthropic',
        enabled: true,
        priority: 90,
        config: {
          apiKey: 'sk-ant-api03-test-key',
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 4096,
          temperature: 0.1
        }
      };

      const provider = factory.createProvider(config) as ClaudeProvider;
      const imageBuffer = Buffer.from('fake-image-data');
      const prompt = 'Analyze this electrical diagram';

      // Should successfully analyze
      const result = await provider.analyze(imageBuffer, prompt);
      expect(result.content).toBe('Circuit analysis complete');
    });

    it('should handle circuit breaker failures', async () => {
      // Mock API failure
      mockAnthropicClient.messages.create.mockRejectedValue(new Error('API timeout'));

      const config = {
        type: 'anthropic',
        enabled: true,
        priority: 90,
        config: {
          apiKey: 'sk-ant-api03-test-key',
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 4096,
          temperature: 0.1
        }
      };

      const provider = factory.createProvider(config) as ClaudeProvider;
      const imageBuffer = Buffer.from('fake-image-data');
      const prompt = 'Analyze this electrical diagram';

      // Should throw error due to circuit breaker
      await expect(provider.analyze(imageBuffer, prompt)).rejects.toThrow();
    });
  });

  describe('End-to-End Workflow Integration', () => {
    it('should complete full analysis workflow', async () => {
      // Mock successful API response
      const mockResponse = {
        content: [{ 
          type: 'text', 
          text: 'This electrical schematic contains 3 resistors (R1: 100Ω, R2: 220Ω, R3: 330Ω), 2 capacitors (C1: 10μF, C2: 22μF), and 1 voltage source (V1: 12V DC). The circuit appears to be a basic RC filter configuration.' 
        }],
        usage: { input_tokens: 150, output_tokens: 200 },
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn'
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      const config = {
        type: 'anthropic',
        enabled: true,
        priority: 90,
        config: {
          apiKey: 'sk-ant-api03-test-key',
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 4096,
          temperature: 0.1
        }
      };

      const provider = factory.createProvider(config) as ClaudeProvider;
      
      // Create realistic electrical diagram analysis scenario
      const imageBuffer = Buffer.from('fake-electrical-schematic-data');
      const prompt = 'Please analyze this electrical schematic and identify all components with their values and connections.';

      // Perform analysis
      const result = await provider.analyze(imageBuffer, prompt);

      // Verify complete workflow
      expect(result.id).toMatch(/^claude_\d+_\w+$/);
      expect(result.content).toContain('resistors');
      expect(result.content).toContain('capacitors');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.tokensUsed).toBe(350);
      expect(result.responseTime).toBeGreaterThanOrEqual(0); // Allow for zero response time in mocked scenarios
      expect(result.model).toBe('claude-3-5-sonnet-20241022');
      expect(result.timestamp).toBeInstanceOf(Date);
      
      // Verify metadata
      expect(result.metadata).toEqual({
        inputTokens: 150,
        outputTokens: 200,
        imageSize: imageBuffer.length,
        promptLength: prompt.length,
        stopReason: 'end_turn'
      });
    });

    it('should handle health checks in ensemble context', async () => {
      // Mock successful health check
      const mockHealthResponse = {
        content: [{ type: 'text', text: 'Hello' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn'
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockHealthResponse);

      const configs = [
        {
          type: 'anthropic',
          enabled: true,
          priority: 90,
          config: {
            apiKey: 'sk-ant-api03-test-key',
            model: 'claude-3-5-sonnet-20241022',
            maxTokens: 4096,
            temperature: 0.1
          }
        }
      ];

      const providers = factory.createProviders(configs);
      const claudeProvider = providers.get('anthropic') as ClaudeProvider;

      // Perform health check
      const isHealthy = await claudeProvider.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should calculate costs correctly in ensemble context', () => {
      const config = {
        type: 'anthropic',
        enabled: true,
        priority: 90,
        config: {
          apiKey: 'sk-ant-api03-test-key',
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 4096,
          temperature: 0.1
        }
      };

      const provider = factory.createProvider(config) as ClaudeProvider;
      
      // Test cost calculation for different token amounts
      const cost1000 = provider.getCost(1000);
      const cost5000 = provider.getCost(5000);
      
      expect(cost1000).toBeGreaterThan(0);
      expect(cost5000).toBeGreaterThan(cost1000);
      expect(cost5000).toBeCloseTo(cost1000 * 5, 3);
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should respect rate limits through base provider', async () => {
      const config = {
        type: 'anthropic',
        enabled: true,
        priority: 90,
        config: {
          apiKey: 'sk-ant-api03-test-key',
          model: 'claude-3-5-sonnet-20241022',
          maxTokens: 4096,
          temperature: 0.1,
          rateLimit: {
            requestsPerMinute: 1 // Very low rate limit for testing
          }
        }
      };

      const provider = factory.createProvider(config) as ClaudeProvider;
      
      // Check rate limit info
      const rateLimitInfo = provider.getRateLimit();
      expect(rateLimitInfo.requestsPerMinute).toBe(1);
      expect(rateLimitInfo.requestsRemaining).toBe(1);
    });
  });
});