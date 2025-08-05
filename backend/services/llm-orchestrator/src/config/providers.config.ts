/**
 * Provider Configuration System
 * 
 * Manages configuration for LLM providers including secure API key handling,
 * validation, and provider-specific settings.
 */

import { RateLimitConfig, BackoffStrategy } from '../reliability/RateLimiter';
import { CircuitBreakerConfig } from '../reliability/CircuitBreaker';

export interface ProviderSecurityConfig {
  readonly apiKey: string;
  readonly apiKeyRotation?: {
    enabled: boolean;
    rotationInterval: number; // milliseconds
    backupKeys?: string[];
  };
  readonly encryptionKey?: string;
  readonly allowedOrigins?: string[];
  readonly rateLimitByIp?: boolean;
}

export interface ProviderEndpointConfig {
  readonly baseUrl: string;
  readonly timeout: number;
  readonly retryAttempts: number;
  readonly backoffDelay: number;
  readonly headers?: Record<string, string>;
  readonly proxy?: {
    host: string;
    port: number;
    auth?: { username: string; password: string };
  };
}

export interface ProviderModelConfig {
  readonly defaultModel: string;
  readonly availableModels: string[];
  readonly modelSettings: Record<string, {
    maxTokens: number;
    temperature: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stopSequences?: string[];
  }>;
  readonly visionSupport: boolean;
  readonly maxImageSize: number;
  readonly supportedFormats: string[];
}

export interface ProviderCostConfig {
  readonly inputTokenCost: number; // Cost per 1K input tokens in USD
  readonly outputTokenCost: number; // Cost per 1K output tokens in USD
  readonly visionCost?: number; // Cost per image analysis in USD
  readonly minimumCharge?: number; // Minimum charge per request in USD
  readonly currency: string;
  readonly costTracking: boolean;
  readonly budgetAlerts?: {
    enabled: boolean;
    dailyLimit: number;
    monthlyLimit: number;
    alertThresholds: number[]; // Percentage thresholds (e.g., [50, 80, 95])
  };
}

export interface ProviderConfig {
  readonly type: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly priority: number;
  readonly description: string;
  readonly version: string;
  readonly security: ProviderSecurityConfig;
  readonly endpoint: ProviderEndpointConfig;
  readonly model: ProviderModelConfig;
  readonly rateLimit: RateLimitConfig;
  readonly circuitBreaker: CircuitBreakerConfig;
  readonly cost: ProviderCostConfig;
  readonly healthCheck: {
    enabled: boolean;
    interval: number;
    timeout: number;
    retryAttempts: number;
  };
  readonly fallbackProviders?: string[];
  readonly customSettings?: Record<string, unknown>;
}

export interface ProvidersConfiguration {
  readonly providers: Record<string, ProviderConfig>;
  readonly defaults: {
    timeout: number;
    retryAttempts: number;
    maxConcurrentRequests: number;
    enableLogging: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  readonly security: {
    encryptApiKeys: boolean;
    rotateApiKeys: boolean;
    auditRequests: boolean;
    allowInsecureConnections: boolean;
  };
  readonly monitoring: {
    enableMetrics: boolean;
    metricsInterval: number;
    healthCheckInterval: number;
    alerting: {
      enabled: boolean;
      webhookUrl?: string;
      emailRecipients?: string[];
    };
  };
  readonly ensemble: EnsembleConfiguration;
}

export interface EnsembleConfiguration {
  readonly enabled: boolean;
  readonly providers: {
    enabled: string[];
    priority: Record<string, number>;
    weights: Record<string, number>;
  };
  readonly performance: {
    maxTotalTimeout: number;
    maxProviderTimeout: number;
    minProvidersRequired: number;
    enableLoadBalancing: boolean;
    parallelExecutionTimeout: number;
    performanceTracking: boolean;
  };
  readonly aggregation: {
    consensusThreshold: number;
    confidenceWeighting: {
      agreement: number;
      completeness: number;
      consistency: number;
    };
    componentClusteringThreshold: number;
    enableAdvancedRanking: boolean;
    outlierDetection: boolean;
  };
  readonly loadBalancing: {
    strategy: 'round_robin' | 'weighted_round_robin' | 'least_connections' | 'fastest_response' | 'lowest_cost' | 'adaptive';
    healthCheckInterval: number;
    performanceWindowSize: number;
    costWeighting: number;
    performanceWeighting: number;
    availabilityWeighting: number;
    minHealthyProviders: number;
  };
  readonly monitoring: {
    enablePerformanceTracking: boolean;
    enableHealthChecks: boolean;
    healthCheckInterval: number;
    metricsCollectionInterval: number;
    performanceDashboard: boolean;
    alerting: {
      enabled: boolean;
      slaViolationThreshold: number;
      costThreshold: number;
      failureRateThreshold: number;
    };
  };
}

/**
 * Configuration validator and manager
 */
export class ProviderConfigManager {
  private config: ProvidersConfiguration;
  private encryptionKey?: string | undefined;

  constructor(config: ProvidersConfiguration, encryptionKey?: string) {
    this.encryptionKey = encryptionKey;
    this.validateConfiguration(config);
    this.config = this.processConfiguration(config);
  }

  /**
   * Gets configuration for a specific provider
   */
  public getProviderConfig(providerId: string): ProviderConfig | undefined {
    return this.config.providers[providerId];
  }

  /**
   * Gets configurations for all enabled providers
   */
  public getEnabledProviders(): Record<string, ProviderConfig> {
    const enabled: Record<string, ProviderConfig> = {};
    
    for (const [id, config] of Object.entries(this.config.providers)) {
      if (config.enabled) {
        enabled[id] = config;
      }
    }

    return enabled;
  }

  /**
   * Gets providers sorted by priority
   */
  public getProvidersByPriority(): Array<{ id: string; config: ProviderConfig }> {
    return Object.entries(this.config.providers)
      .filter(([, config]) => config.enabled)
      .map(([id, config]) => ({ id, config }))
      .sort((a, b) => b.config.priority - a.config.priority);
  }

  /**
   * Updates a provider configuration
   */
  public updateProviderConfig(providerId: string, updates: Partial<ProviderConfig>): void {
    const current = this.config.providers[providerId];
    if (!current) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    const updated = { ...current, ...updates };
    this.validateProviderConfig(updated);
    
    this.config.providers[providerId] = updated;
  }

  /**
   * Adds a new provider configuration
   */
  public addProviderConfig(providerId: string, config: ProviderConfig): void {
    if (this.config.providers[providerId]) {
      throw new Error(`Provider already exists: ${providerId}`);
    }

    this.validateProviderConfig(config);
    this.config.providers[providerId] = config;
  }

  /**
   * Removes a provider configuration
   */
  public removeProviderConfig(providerId: string): boolean {
    if (!this.config.providers[providerId]) {
      return false;
    }

    delete this.config.providers[providerId];
    return true;
  }

  /**
   * Gets the decrypted API key for a provider
   */
  public getApiKey(providerId: string): string {
    const config = this.config.providers[providerId];
    if (!config) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    return this.decryptApiKey(config.security.apiKey);
  }

  /**
   * Updates the API key for a provider
   */
  public updateApiKey(providerId: string, apiKey: string): void {
    const config = this.config.providers[providerId];
    if (!config) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    const encryptedKey = this.encryptApiKey(apiKey);
    this.config.providers[providerId] = {
      ...config,
      security: {
        ...config.security,
        apiKey: encryptedKey
      }
    };
  }

  /**
   * Gets default configuration values
   */
  public getDefaults(): ProvidersConfiguration['defaults'] {
    return this.config.defaults;
  }

  /**
   * Gets security configuration
   */
  public getSecurityConfig(): ProvidersConfiguration['security'] {
    return this.config.security;
  }

  /**
   * Gets monitoring configuration
   */
  public getMonitoringConfig(): ProvidersConfiguration['monitoring'] {
    return this.config.monitoring;
  }

  /**
   * Gets ensemble configuration
   */
  public getEnsembleConfig(): EnsembleConfiguration {
    return this.config.ensemble;
  }

  /**
   * Updates ensemble configuration
   */
  public updateEnsembleConfig(updates: Partial<EnsembleConfiguration>): void {
    this.config = {
      ...this.config,
      ensemble: { ...this.config.ensemble, ...updates }
    };
  }

  /**
   * Validates the entire configuration
   */
  private validateConfiguration(config: ProvidersConfiguration): void {
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be an object');
    }

    if (!config.providers || typeof config.providers !== 'object') {
      throw new Error('Configuration must include providers object');
    }

    // Validate each provider
    for (const [id, providerConfig] of Object.entries(config.providers)) {
      try {
        this.validateProviderConfig(providerConfig);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid configuration for provider '${id}': ${errorMessage}`);
      }
    }

    // Validate defaults
    this.validateDefaults(config.defaults);
    
    // Validate security settings
    this.validateSecurityConfig(config.security);
    
    // Validate monitoring settings
    this.validateMonitoringConfig(config.monitoring);
    
    // Validate ensemble settings
    this.validateEnsembleConfig(config.ensemble);
  }

  /**
   * Validates a single provider configuration
   */
  private validateProviderConfig(config: ProviderConfig): void {
    const required = ['type', 'name', 'security', 'endpoint', 'model', 'rateLimit', 'circuitBreaker', 'cost'];
    
    for (const field of required) {
      if (!(field in config) || !config[field as keyof ProviderConfig]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate security config
    if (!config.security.apiKey) {
      throw new Error('API key is required');
    }

    // Validate endpoint config
    if (!config.endpoint.baseUrl) {
      throw new Error('Base URL is required');
    }

    try {
      new URL(config.endpoint.baseUrl);
    } catch {
      throw new Error('Invalid base URL format');
    }

    if (config.endpoint.timeout <= 0) {
      throw new Error('Timeout must be positive');
    }

    // Validate model config
    if (!config.model.defaultModel) {
      throw new Error('Default model is required');
    }

    if (!Array.isArray(config.model.availableModels) || config.model.availableModels.length === 0) {
      throw new Error('Available models must be a non-empty array');
    }

    if (!config.model.availableModels.includes(config.model.defaultModel)) {
      throw new Error('Default model must be in available models list');
    }

    // Validate rate limit config
    if (config.rateLimit.requestsPerMinute <= 0) {
      throw new Error('Requests per minute must be positive');
    }

    // Validate circuit breaker config
    if (config.circuitBreaker.failureThreshold <= 0 || config.circuitBreaker.failureThreshold > 1) {
      throw new Error('Circuit breaker failure threshold must be between 0 and 1');
    }

    // Validate cost config
    if (config.cost.inputTokenCost < 0 || config.cost.outputTokenCost < 0) {
      throw new Error('Token costs cannot be negative');
    }
  }

  /**
   * Validates default configuration
   */
  private validateDefaults(defaults: ProvidersConfiguration['defaults']): void {
    if (defaults.timeout <= 0) {
      throw new Error('Default timeout must be positive');
    }

    if (defaults.retryAttempts < 0) {
      throw new Error('Default retry attempts cannot be negative');
    }

    if (defaults.maxConcurrentRequests <= 0) {
      throw new Error('Max concurrent requests must be positive');
    }
  }

  /**
   * Validates security configuration
   */
  private validateSecurityConfig(security: ProvidersConfiguration['security']): void {
    if (typeof security.encryptApiKeys !== 'boolean') {
      throw new Error('encryptApiKeys must be boolean');
    }

    if (typeof security.rotateApiKeys !== 'boolean') {
      throw new Error('rotateApiKeys must be boolean');
    }
  }

  /**
   * Validates monitoring configuration
   */
  private validateMonitoringConfig(monitoring: ProvidersConfiguration['monitoring']): void {
    if (monitoring.metricsInterval <= 0) {
      throw new Error('Metrics interval must be positive');
    }

    if (monitoring.healthCheckInterval <= 0) {
      throw new Error('Health check interval must be positive');
    }
  }

  /**
   * Validates ensemble configuration
   */
  private validateEnsembleConfig(ensemble: EnsembleConfiguration): void {
    // Validate performance settings
    if (ensemble.performance.maxTotalTimeout <= 0) {
      throw new Error('Max total timeout must be positive');
    }

    if (ensemble.performance.maxProviderTimeout <= 0) {
      throw new Error('Max provider timeout must be positive');
    }

    if (ensemble.performance.maxProviderTimeout >= ensemble.performance.maxTotalTimeout) {
      throw new Error('Provider timeout must be less than total timeout');
    }

    if (ensemble.performance.minProvidersRequired < 1) {
      throw new Error('Minimum providers required must be at least 1');
    }

    // Validate aggregation settings
    if (ensemble.aggregation.consensusThreshold < 0 || ensemble.aggregation.consensusThreshold > 1) {
      throw new Error('Consensus threshold must be between 0 and 1');
    }

    if (ensemble.aggregation.componentClusteringThreshold < 0) {
      throw new Error('Component clustering threshold must be non-negative');
    }

    // Validate confidence weighting
    const weights = ensemble.aggregation.confidenceWeighting;
    if (weights.agreement < 0 || weights.completeness < 0 || weights.consistency < 0) {
      throw new Error('Confidence weights must be non-negative');
    }

    // Validate load balancing settings
    if (ensemble.loadBalancing.healthCheckInterval <= 0) {
      throw new Error('Load balancing health check interval must be positive');
    }

    if (ensemble.loadBalancing.performanceWindowSize <= 0) {
      throw new Error('Performance window size must be positive');
    }

    if (ensemble.loadBalancing.minHealthyProviders < 1) {
      throw new Error('Minimum healthy providers must be at least 1');
    }

    // Validate monitoring settings
    if (ensemble.monitoring.healthCheckInterval <= 0) {
      throw new Error('Ensemble health check interval must be positive');
    }

    if (ensemble.monitoring.metricsCollectionInterval <= 0) {
      throw new Error('Metrics collection interval must be positive');
    }

    // Validate alerting thresholds
    const alerting = ensemble.monitoring.alerting;
    if (alerting.slaViolationThreshold < 0 || alerting.slaViolationThreshold > 1) {
      throw new Error('SLA violation threshold must be between 0 and 1');
    }

    if (alerting.failureRateThreshold < 0 || alerting.failureRateThreshold > 1) {
      throw new Error('Failure rate threshold must be between 0 and 1');
    }
  }

  /**
   * Processes configuration after validation
   */
  private processConfiguration(config: ProvidersConfiguration): ProvidersConfiguration {
    // Decrypt API keys if encryption is enabled
    if (config.security.encryptApiKeys && this.encryptionKey) {
      const processedProviders = { ...config.providers };
      
      for (const [id, providerConfig] of Object.entries(processedProviders)) {
        processedProviders[id] = {
          ...providerConfig,
          security: {
            ...providerConfig.security,
            apiKey: this.decryptApiKey(providerConfig.security.apiKey)
          }
        };
      }
      
      return {
        ...config,
        providers: processedProviders
      };
    }

    return config;
  }

  /**
   * Encrypts an API key
   */
  private encryptApiKey(apiKey: string): string {
    if (!this.config.security.encryptApiKeys || !this.encryptionKey) {
      return apiKey;
    }

    // Simple encryption for demo - use proper encryption in production
    const crypto = require('crypto');
    const cipher = crypto.createCipher('aes192', this.encryptionKey);
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypts an API key
   */
  private decryptApiKey(encryptedApiKey: string): string {
    if (!this.config.security.encryptApiKeys || !this.encryptionKey) {
      return encryptedApiKey;
    }

    // Simple decryption for demo - use proper decryption in production
    const crypto = require('crypto');
    const decipher = crypto.createDecipher('aes192', this.encryptionKey);
    let decrypted = decipher.update(encryptedApiKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

/**
 * Configuration factory for creating common provider configurations
 */
export class ProviderConfigFactory {
  /**
   * Creates a configuration for OpenAI provider
   */
  public static createOpenAIConfig(apiKey: string, overrides?: Partial<ProviderConfig>): ProviderConfig {
    const baseConfig: ProviderConfig = {
      type: 'openai',
      name: 'OpenAI GPT-4 Vision',
      enabled: true,
      priority: 100,
      description: 'OpenAI GPT-4 Vision model for image analysis',
      version: '1.0.0',
      security: {
        apiKey,
        apiKeyRotation: {
          enabled: false,
          rotationInterval: 86400000 // 24 hours
        }
      },
      endpoint: {
        baseUrl: 'https://api.openai.com/v1',
        timeout: 30000,
        retryAttempts: 3,
        backoffDelay: 1000,
        headers: {
          'User-Agent': 'electrical-drawing-app/1.0'
        }
      },
      model: {
        defaultModel: 'gpt-4-vision-preview',
        availableModels: ['gpt-4-vision-preview', 'gpt-4-turbo-vision'],
        modelSettings: {
          'gpt-4-vision-preview': {
            maxTokens: 4096,
            temperature: 0.1,
            topP: 1.0
          }
        },
        visionSupport: true,
        maxImageSize: 20 * 1024 * 1024, // 20MB
        supportedFormats: ['jpeg', 'png', 'gif', 'webp']
      },
      rateLimit: {
        requestsPerMinute: 60,
        requestsPerHour: 3500,
        tokensPerMinute: 90000,
        burstLimit: 10,
        queueLimit: 50,
        backoffStrategy: BackoffStrategy.EXPONENTIAL
      },
      circuitBreaker: {
        failureThreshold: 0.5,
        recoveryTimeout: 30000,
        halfOpenMaxRequests: 3,
        timeout: 30000,
        monitoringWindow: 60000,
        minimumRequests: 5
      },
      cost: {
        inputTokenCost: 0.01, // $0.01 per 1K tokens
        outputTokenCost: 0.03, // $0.03 per 1K tokens
        visionCost: 0.00765, // $0.00765 per image
        currency: 'USD',
        costTracking: true,
        budgetAlerts: {
          enabled: true,
          dailyLimit: 100,
          monthlyLimit: 2000,
          alertThresholds: [50, 80, 95]
        }
      },
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 10000,
        retryAttempts: 2
      }
    };

    return { ...baseConfig, ...overrides };
  }

  /**
   * Creates a configuration for Anthropic Claude provider
   */
  public static createClaudeConfig(apiKey: string, overrides?: Partial<ProviderConfig>): ProviderConfig {
    const baseConfig: ProviderConfig = {
      type: 'anthropic',
      name: 'Anthropic Claude 3.5 Sonnet',
      enabled: true,
      priority: 90,
      description: 'Anthropic Claude 3.5 Sonnet for image analysis',
      version: '1.0.0',
      security: {
        apiKey
      },
      endpoint: {
        baseUrl: 'https://api.anthropic.com',
        timeout: 30000,
        retryAttempts: 3,
        backoffDelay: 1000,
        headers: {
          'anthropic-version': '2023-06-01'
        }
      },
      model: {
        defaultModel: 'claude-3-5-sonnet-20241022',
        availableModels: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
        modelSettings: {
          'claude-3-5-sonnet-20241022': {
            maxTokens: 4096,
            temperature: 0.1
          }
        },
        visionSupport: true,
        maxImageSize: 5 * 1024 * 1024, // 5MB
        supportedFormats: ['jpeg', 'png', 'gif', 'webp']
      },
      rateLimit: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        tokensPerMinute: 40000,
        burstLimit: 5,
        queueLimit: 30,
        backoffStrategy: BackoffStrategy.EXPONENTIAL
      },
      circuitBreaker: {
        failureThreshold: 0.5,
        recoveryTimeout: 30000,
        halfOpenMaxRequests: 3,
        timeout: 30000,
        monitoringWindow: 60000,
        minimumRequests: 5
      },
      cost: {
        inputTokenCost: 0.003, // $0.003 per 1K tokens
        outputTokenCost: 0.015, // $0.015 per 1K tokens
        currency: 'USD',
        costTracking: true,
        budgetAlerts: {
          enabled: true,
          dailyLimit: 50,
          monthlyLimit: 1000,
          alertThresholds: [50, 80, 95]
        }
      },
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 10000,
        retryAttempts: 2
      }
    };

    return { ...baseConfig, ...overrides };
  }

  /**
   * Creates a configuration for Google Gemini provider
   */
  public static createGeminiConfig(apiKey: string, overrides?: Partial<ProviderConfig>): ProviderConfig {
    const baseConfig: ProviderConfig = {
      type: 'google',
      name: 'Google Gemini Pro Vision',
      enabled: true,
      priority: 80,
      description: 'Google Gemini Pro Vision for image analysis',
      version: '1.0.0',
      security: {
        apiKey
      },
      endpoint: {
        baseUrl: 'https://generativelanguage.googleapis.com/v1',
        timeout: 30000,
        retryAttempts: 3,
        backoffDelay: 1000
      },
      model: {
        defaultModel: 'gemini-pro-vision',
        availableModels: ['gemini-pro-vision', 'gemini-1.5-pro-vision'],
        modelSettings: {
          'gemini-pro-vision': {
            maxTokens: 2048,
            temperature: 0.1
          }
        },
        visionSupport: true,
        maxImageSize: 4 * 1024 * 1024, // 4MB
        supportedFormats: ['jpeg', 'png']
      },
      rateLimit: {
        requestsPerMinute: 15,
        requestsPerHour: 1500,
        tokensPerMinute: 32000,
        burstLimit: 5,
        queueLimit: 25,
        backoffStrategy: BackoffStrategy.LINEAR
      },
      circuitBreaker: {
        failureThreshold: 0.5,
        recoveryTimeout: 30000,
        halfOpenMaxRequests: 3,
        timeout: 30000,
        monitoringWindow: 60000,
        minimumRequests: 5
      },
      cost: {
        inputTokenCost: 0.00025, // $0.00025 per 1K tokens
        outputTokenCost: 0.0005, // $0.0005 per 1K tokens
        currency: 'USD',
        costTracking: true,
        budgetAlerts: {
          enabled: true,
          dailyLimit: 25,
          monthlyLimit: 500,
          alertThresholds: [50, 80, 95]
        }
      },
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 10000,
        retryAttempts: 2
      }
    };

    return { ...baseConfig, ...overrides };
  }
}