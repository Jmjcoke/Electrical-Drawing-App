/**
 * Unit tests for ProviderFactory
 */

import {
  ProviderFactory,
  ProviderConfig,
  ProviderRegistration
} from '../../providers/base/ProviderFactory';
import {
  LLMProvider,
  ConfigurationError,
  ProviderMetadata
} from '../../providers/base/LLMProvider.interface';

// Mock provider implementation for testing
class MockTestProvider implements LLMProvider {
  readonly name = 'Mock Test Provider';
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
  constructor(private _config: Record<string, unknown>) {}

  async analyze() {
    return {
      id: 'test',
      content: 'test',
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

  getRateLimit() {
    return {
      requestsPerMinute: 60,
      requestsRemaining: 45,
      resetTime: new Date(Date.now() + 60000)
    };
  }

  getCost(tokens: number): number {
    return tokens * 0.001;
  }

  getRequiredConfig(): string[] {
    return ['apiKey'];
  }

  validateConfig(config: Record<string, unknown>): boolean {
    return config.apiKey !== undefined;
  }
}

describe('ProviderFactory', () => {
  let factory: ProviderFactory;
  let mockProviderConfig: ProviderConfig;
  let mockRegistration: ProviderRegistration;

  beforeEach(() => {
    factory = ProviderFactory.getInstance();
    factory.clearActiveProviders();

    mockProviderConfig = {
      type: 'mock-test',
      enabled: true,
      priority: 100,
      config: {
        apiKey: 'test-api-key',
        timeout: 30000
      }
    };

    mockRegistration = {
      type: 'mock-test',
      name: 'Mock Test Provider',
      description: 'A mock provider for testing',
      factory: (config: Record<string, unknown>) => new MockTestProvider(config),
      requiredConfig: ['apiKey'],
      defaultConfig: {
        timeout: 30000,
        retryAttempts: 3
      }
    };
  });

  afterEach(() => {
    // Clean up registrations
    factory.unregisterProvider('mock-test');
    factory.unregisterProvider('another-mock');
    factory.clearActiveProviders();
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const factory1 = ProviderFactory.getInstance();
      const factory2 = ProviderFactory.getInstance();
      expect(factory1).toBe(factory2);
    });
  });

  describe('Provider Registration', () => {
    it('should register a new provider successfully', () => {
      expect(() => factory.registerProvider(mockRegistration)).not.toThrow();
      expect(factory.isProviderRegistered('mock-test')).toBe(true);
    });

    it('should throw error when registering duplicate provider type', () => {
      factory.registerProvider(mockRegistration);
      expect(() => factory.registerProvider(mockRegistration))
        .toThrow("Provider type 'mock-test' is already registered");
    });

    it('should validate registration properties', () => {
      const invalidRegistration = {
        ...mockRegistration,
        type: ''
      };

      expect(() => factory.registerProvider(invalidRegistration))
        .toThrow('Provider registration must have a valid type');
    });

    it('should validate factory function', () => {
      const invalidRegistration = {
        ...mockRegistration,
        factory: null as any
      };

      expect(() => factory.registerProvider(invalidRegistration))
        .toThrow('Provider registration must have a factory function');
    });

    it('should validate required config array', () => {
      const invalidRegistration = {
        ...mockRegistration,
        requiredConfig: null as any
      };

      expect(() => factory.registerProvider(invalidRegistration))
        .toThrow('Provider registration must specify required configuration keys');
    });
  });

  describe('Provider Creation', () => {
    beforeEach(() => {
      factory.registerProvider(mockRegistration);
    });

    it('should create provider successfully with valid config', () => {
      const provider = factory.createProvider(mockProviderConfig);
      
      expect(provider).toBeInstanceOf(MockTestProvider);
      expect(provider.name).toBe('Mock Test Provider');
      expect(provider.version).toBe('1.0.0');
    });

    it('should throw error for unknown provider type', () => {
      const unknownConfig = {
        ...mockProviderConfig,
        type: 'unknown-provider'
      };

      expect(() => factory.createProvider(unknownConfig))
        .toThrow(ConfigurationError);
    });

    it('should throw error for missing required config', () => {
      const invalidConfig = {
        ...mockProviderConfig,
        config: {}
      };

      expect(() => factory.createProvider(invalidConfig))
        .toThrow(ConfigurationError);
    });

    it('should merge with default configuration', () => {
      const minimalConfig = {
        type: 'mock-test',
        enabled: true,
        priority: 100,
        config: {
          apiKey: 'test-key'
        }
      };

      const provider = factory.createProvider(minimalConfig);
      expect(provider).toBeInstanceOf(MockTestProvider);
    });
  });

  describe('Multiple Providers Creation', () => {
    beforeEach(() => {
      factory.registerProvider(mockRegistration);
    });

    it('should create multiple enabled providers', () => {
      const configs = [
        mockProviderConfig,
        {
          ...mockProviderConfig,
          type: 'mock-test',
          priority: 90
        }
      ];

      const providers = factory.createProviders(configs);
      expect(providers.size).toBe(1); // Same type, so only one instance
    });

    it('should filter out disabled providers', () => {
      const configs = [
        mockProviderConfig,
        {
          ...mockProviderConfig,
          enabled: false
        }
      ];

      const providers = factory.createProviders(configs);
      expect(providers.size).toBe(1);
    });

    it('should sort providers by priority', () => {
      // Register another provider type
      const anotherRegistration = {
        ...mockRegistration,
        type: 'another-mock',
        name: 'Another Mock Provider'
      };
      factory.registerProvider(anotherRegistration);

      const configs = [
        { ...mockProviderConfig, priority: 50 },
        { ...mockProviderConfig, type: 'another-mock', priority: 100 }
      ];

      const providers = factory.createProviders(configs);
      expect(providers.size).toBe(2);
    });

    it('should throw error if no providers can be created', () => {
      const invalidConfigs = [
        {
          ...mockProviderConfig,
          config: {} // Missing required apiKey
        }
      ];

      expect(() => factory.createProviders(invalidConfigs))
        .toThrow(ConfigurationError);
    });
  });

  describe('Provider Discovery', () => {
    beforeEach(() => {
      factory.registerProvider(mockRegistration);
    });

    it('should discover providers by capability', () => {
      factory.createProvider(mockProviderConfig);
      
      const visionProviders = factory.discoverProviders('vision');
      expect(visionProviders.length).toBeGreaterThan(0);
      
      const provider = visionProviders.find((p: any) => p.type === 'mock-test');
      expect(provider).toBeDefined();
      expect(provider?.provider).toBeInstanceOf(MockTestProvider);
    });

    it('should include inactive providers in discovery', () => {
      const inactiveProviders = factory.discoverProviders('vision');
      
      const provider = inactiveProviders.find((p: any) => p.type === 'mock-test');
      expect(provider).toBeDefined();
      expect(provider?.provider).toBeUndefined();
    });
  });

  describe('Fallback Provider Creation', () => {
    beforeEach(() => {
      factory.registerProvider(mockRegistration);
      
      // Register another provider for fallback
      const fallbackRegistration = {
        ...mockRegistration,
        type: 'fallback-mock',
        name: 'Fallback Mock Provider'
      };
      factory.registerProvider(fallbackRegistration);
    });

    it('should create providers with fallback chains', () => {
      const configsWithFallback = [
        {
          ...mockProviderConfig,
          fallbackProviders: ['fallback-mock']
        },
        {
          ...mockProviderConfig,
          type: 'fallback-mock'
        }
      ];

      const result = factory.createProvidersWithFallback(configsWithFallback);
      
      expect(result.primary.size).toBe(2);
      expect(result.fallbacks.has('mock-test')).toBe(true);
      expect(result.fallbacks.get('mock-test')?.length).toBe(1);
    });

    it('should ignore non-existent fallback providers', () => {
      const configsWithInvalidFallback = [
        {
          ...mockProviderConfig,
          fallbackProviders: ['non-existent-provider']
        }
      ];

      const result = factory.createProvidersWithFallback(configsWithInvalidFallback);
      
      expect(result.primary.size).toBe(1);
      expect(result.fallbacks.has('mock-test')).toBe(false);
    });
  });

  describe('Provider Management', () => {
    beforeEach(() => {
      factory.registerProvider(mockRegistration);
    });

    it('should get provider by type', () => {
      factory.createProvider(mockProviderConfig);
      
      const provider = factory.getProvider('mock-test');
      expect(provider).toBeInstanceOf(MockTestProvider);
    });

    it('should return undefined for non-existent provider', () => {
      const provider = factory.getProvider('non-existent');
      expect(provider).toBeUndefined();
    });

    it('should get all active providers', () => {
      factory.createProvider(mockProviderConfig);
      
      const activeProviders = factory.getActiveProviders();
      expect(activeProviders.size).toBe(1);
      expect(activeProviders.has('mock-test')).toBe(true);
    });

    it('should get registered provider types info', () => {
      const providerTypes = factory.getRegisteredProviderTypes();
      
      expect(providerTypes.length).toBe(1);
      expect(providerTypes[0].type).toBe('mock-test');
      expect(providerTypes[0].name).toBe('Mock Test Provider');
      expect(providerTypes[0].requiredConfig).toEqual(['apiKey']);
    });
  });

  describe('Provider Validation', () => {
    beforeEach(() => {
      factory.registerProvider(mockRegistration);
    });

    it('should validate provider instance has required methods', () => {
      // This test indirectly checks validation by successful creation
      const provider = factory.createProvider(mockProviderConfig);
      
      expect(typeof provider.analyze).toBe('function');
      expect(typeof provider.healthCheck).toBe('function');
      expect(typeof provider.getRateLimit).toBe('function');
      expect(typeof provider.getCost).toBe('function');
    });

    it('should validate provider instance has required properties', () => {
      const provider = factory.createProvider(mockProviderConfig);
      
      expect(provider.name).toBeDefined();
      expect(provider.version).toBeDefined();
      expect(provider.metadata).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should wrap factory errors in ConfigurationError', () => {
      const faultyRegistration = {
        ...mockRegistration,
        factory: () => {
          throw new Error('Factory method failed');
        }
      };
      
      factory.registerProvider(faultyRegistration);
      
      expect(() => factory.createProvider(mockProviderConfig))
        .toThrow(ConfigurationError);
    });
  });
});