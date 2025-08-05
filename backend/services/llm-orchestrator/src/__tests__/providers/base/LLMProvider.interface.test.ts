/**
 * Unit tests for LLMProvider interface and related types
 */

import {
  LLMProvider,
  LLMResponse,
  AnalysisOptions,
  RateLimitInfo,
  ProviderCapabilities,
  ProviderMetadata,
  ProviderError,
  ConfigurationError,
  RateLimitError,
  AnalysisError
} from '../../providers/base/LLMProvider.interface';

describe('LLMProvider Interface Types', () => {
  describe('LLMResponse', () => {
    it('should have all required properties', () => {
      const mockResponse: LLMResponse = {
        id: 'test-response-123',
        content: 'Test response content',
        confidence: 0.95,
        tokensUsed: 150,
        responseTime: 1500,
        model: 'test-model',
        timestamp: new Date(),
        metadata: { test: 'data' }
      };

      expect(mockResponse.id).toBe('test-response-123');
      expect(mockResponse.content).toBe('Test response content');
      expect(mockResponse.confidence).toBe(0.95);
      expect(mockResponse.tokensUsed).toBe(150);
      expect(mockResponse.responseTime).toBe(1500);
      expect(mockResponse.model).toBe('test-model');
      expect(mockResponse.timestamp).toBeInstanceOf(Date);
      expect(mockResponse.metadata).toEqual({ test: 'data' });
    });

    it('should allow optional metadata', () => {
      const responseWithoutMetadata: LLMResponse = {
        id: 'test-response-123',
        content: 'Test response content',
        confidence: 0.95,
        tokensUsed: 150,
        responseTime: 1500,
        model: 'test-model',
        timestamp: new Date()
      };

      expect(responseWithoutMetadata.metadata).toBeUndefined();
    });
  });

  describe('AnalysisOptions', () => {
    it('should have all optional properties', () => {
      const options: AnalysisOptions = {
        maxTokens: 4096,
        temperature: 0.1,
        timeout: 30000,
        retryAttempts: 3
      };

      expect(typeof options.maxTokens).toBe('number');
      expect(typeof options.temperature).toBe('number');
      expect(typeof options.timeout).toBe('number');
      expect(typeof options.retryAttempts).toBe('number');
    });

    it('should allow empty options object', () => {
      const emptyOptions: AnalysisOptions = {};
      expect(emptyOptions).toEqual({});
    });
  });

  describe('RateLimitInfo', () => {
    it('should have required properties', () => {
      const rateLimitInfo: RateLimitInfo = {
        requestsPerMinute: 60,
        requestsRemaining: 45,
        resetTime: new Date(Date.now() + 60000),
        dailyLimit: 1000,
        dailyUsed: 250
      };

      expect(rateLimitInfo.requestsPerMinute).toBe(60);
      expect(rateLimitInfo.requestsRemaining).toBe(45);
      expect(rateLimitInfo.resetTime).toBeInstanceOf(Date);
      expect(rateLimitInfo.dailyLimit).toBe(1000);
      expect(rateLimitInfo.dailyUsed).toBe(250);
    });

    it('should allow optional daily properties', () => {
      const basicRateLimit: RateLimitInfo = {
        requestsPerMinute: 60,
        requestsRemaining: 45,
        resetTime: new Date(Date.now() + 60000)
      };

      expect(basicRateLimit.dailyLimit).toBeUndefined();
      expect(basicRateLimit.dailyUsed).toBeUndefined();
    });
  });

  describe('ProviderCapabilities', () => {
    it('should define all capability properties', () => {
      const capabilities: ProviderCapabilities = {
        supportsVision: true,
        maxImageSize: 20 * 1024 * 1024,
        supportedImageFormats: ['jpeg', 'png', 'webp'],
        maxPromptLength: 32000,
        supportsStreaming: false
      };

      expect(capabilities.supportsVision).toBe(true);
      expect(capabilities.maxImageSize).toBe(20971520);
      expect(capabilities.supportedImageFormats).toEqual(['jpeg', 'png', 'webp']);
      expect(capabilities.maxPromptLength).toBe(32000);
      expect(capabilities.supportsStreaming).toBe(false);
    });
  });

  describe('ProviderMetadata', () => {
    it('should include all metadata properties', () => {
      const metadata: ProviderMetadata = {
        name: 'Test Provider',
        version: '1.0.0',
        capabilities: {
          supportsVision: true,
          maxImageSize: 10 * 1024 * 1024,
          supportedImageFormats: ['jpeg', 'png'],
          maxPromptLength: 16000,
          supportsStreaming: true
        },
        description: 'A test LLM provider for unit testing'
      };

      expect(metadata.name).toBe('Test Provider');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.capabilities).toBeDefined();
      expect(metadata.description).toBe('A test LLM provider for unit testing');
    });
  });
});

describe('Provider Error Classes', () => {
  describe('ProviderError', () => {
    it('should create error with all properties', () => {
      const originalError = new Error('Original error');
      const providerError = new ProviderError(
        'Provider failed',
        'PROVIDER_FAILURE',
        'test-provider',
        originalError
      );

      expect(providerError.message).toBe('Provider failed');
      expect(providerError.code).toBe('PROVIDER_FAILURE');
      expect(providerError.provider).toBe('test-provider');
      expect(providerError.originalError).toBe(originalError);
      expect(providerError.name).toBe('ProviderError');
    });

    it('should work without original error', () => {
      const providerError = new ProviderError(
        'Provider failed',
        'PROVIDER_FAILURE',
        'test-provider'
      );

      expect(providerError.originalError).toBeUndefined();
    });
  });

  describe('ConfigurationError', () => {
    it('should extend ProviderError', () => {
      const configError = new ConfigurationError(
        'Invalid configuration',
        'test-provider'
      );

      expect(configError).toBeInstanceOf(ProviderError);
      expect(configError.name).toBe('ConfigurationError');
      expect(configError.code).toBe('CONFIGURATION_ERROR');
      expect(configError.message).toBe('Invalid configuration');
      expect(configError.provider).toBe('test-provider');
    });
  });

  describe('RateLimitError', () => {
    it('should extend ProviderError and include retryAfter', () => {
      const rateLimitError = new RateLimitError(
        'Rate limit exceeded',
        'test-provider',
        60
      );

      expect(rateLimitError).toBeInstanceOf(ProviderError);
      expect(rateLimitError.name).toBe('RateLimitError');
      expect(rateLimitError.code).toBe('RATE_LIMIT_ERROR');
      expect(rateLimitError.retryAfter).toBe(60);
    });
  });

  describe('AnalysisError', () => {
    it('should extend ProviderError', () => {
      const analysisError = new AnalysisError(
        'Analysis failed',
        'test-provider'
      );

      expect(analysisError).toBeInstanceOf(ProviderError);
      expect(analysisError.name).toBe('AnalysisError');
      expect(analysisError.code).toBe('ANALYSIS_ERROR');
    });
  });
});

// Mock provider implementation for interface testing
class MockLLMProvider implements LLMProvider {
  readonly name = 'Mock Provider';
  readonly version = '1.0.0';
  readonly metadata: ProviderMetadata = {
    name: this.name,
    version: this.version,
    capabilities: {
      supportsVision: true,
      maxImageSize: 10 * 1024 * 1024,
      supportedImageFormats: ['jpeg', 'png'],
      maxPromptLength: 16000,
      supportsStreaming: false
    },
    description: 'Mock provider for testing'
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async analyze(_image: Buffer, _prompt: string, _options?: AnalysisOptions): Promise<LLMResponse> {
    return {
      id: 'mock-response-123',
      content: 'Mock analysis result',
      confidence: 0.9,
      tokensUsed: 100,
      responseTime: 1000,
      model: this.name,
      timestamp: new Date()
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  getRateLimit(): RateLimitInfo {
    return {
      requestsPerMinute: 60,
      requestsRemaining: 45,
      resetTime: new Date(Date.now() + 60000)
    };
  }

  getCost(tokens: number): number {
    return tokens * 0.001; // $0.001 per token
  }

  getRequiredConfig(): string[] {
    return ['apiKey'];
  }

  validateConfig(config: Record<string, unknown>): boolean {
    return config.apiKey !== undefined;
  }
}

describe('LLMProvider Interface Implementation', () => {
  let mockProvider: MockLLMProvider;

  beforeEach(() => {
    mockProvider = new MockLLMProvider();
  });

  describe('Provider Properties', () => {
    it('should have required properties', () => {
      expect(mockProvider.name).toBe('Mock Provider');
      expect(mockProvider.version).toBe('1.0.0');
      expect(mockProvider.metadata).toBeDefined();
      expect(mockProvider.metadata.capabilities).toBeDefined();
    });
  });

  describe('analyze method', () => {
    it('should return valid LLMResponse', async () => {
      const mockImage = Buffer.from('mock-image-data');
      const prompt = 'Analyze this image';
      
      const response = await mockProvider.analyze(mockImage, prompt);

      expect(response.id).toBeDefined();
      expect(response.content).toBe('Mock analysis result');
      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
      expect(response.tokensUsed).toBeGreaterThan(0);
      expect(response.responseTime).toBeGreaterThan(0);
      expect(response.model).toBe('Mock Provider');
      expect(response.timestamp).toBeInstanceOf(Date);
    });

    it('should accept optional parameters', async () => {
      const mockImage = Buffer.from('mock-image-data');
      const prompt = 'Analyze this image';
      const options: AnalysisOptions = {
        maxTokens: 2000,
        temperature: 0.2
      };
      
      const response = await mockProvider.analyze(mockImage, prompt, options);
      expect(response).toBeDefined();
    });
  });

  describe('healthCheck method', () => {
    it('should return boolean', async () => {
      const isHealthy = await mockProvider.healthCheck();
      expect(typeof isHealthy).toBe('boolean');
    });
  });

  describe('getRateLimit method', () => {
    it('should return valid RateLimitInfo', () => {
      const rateLimit = mockProvider.getRateLimit();
      
      expect(rateLimit.requestsPerMinute).toBeGreaterThan(0);
      expect(rateLimit.requestsRemaining).toBeGreaterThanOrEqual(0);
      expect(rateLimit.resetTime).toBeInstanceOf(Date);
    });
  });

  describe('getCost method', () => {
    it('should calculate cost for tokens', () => {
      const cost = mockProvider.getCost(1000);
      expect(cost).toBe(1.0); // 1000 * 0.001
    });

    it('should handle zero tokens', () => {
      const cost = mockProvider.getCost(0);
      expect(cost).toBe(0);
    });
  });

  describe('getRequiredConfig method', () => {
    it('should return array of required config keys', () => {
      const required = mockProvider.getRequiredConfig();
      expect(Array.isArray(required)).toBe(true);
      expect(required).toContain('apiKey');
    });
  });

  describe('validateConfig method', () => {
    it('should validate correct configuration', () => {
      const config = { apiKey: 'test-key' };
      expect(mockProvider.validateConfig(config)).toBe(true);
    });

    it('should reject invalid configuration', () => {
      const config = {};
      expect(mockProvider.validateConfig(config)).toBe(false);
    });
  });
});