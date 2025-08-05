"use strict";
/**
 * Provider Configuration System
 *
 * Manages configuration for LLM providers including secure API key handling,
 * validation, and provider-specific settings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderConfigFactory = exports.ProviderConfigManager = void 0;
const RateLimiter_1 = require("../reliability/RateLimiter");
/**
 * Configuration validator and manager
 */
class ProviderConfigManager {
    constructor(config, encryptionKey) {
        this.encryptionKey = encryptionKey;
        this.validateConfiguration(config);
        this.config = this.processConfiguration(config);
    }
    /**
     * Gets configuration for a specific provider
     */
    getProviderConfig(providerId) {
        return this.config.providers[providerId];
    }
    /**
     * Gets configurations for all enabled providers
     */
    getEnabledProviders() {
        const enabled = {};
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
    getProvidersByPriority() {
        return Object.entries(this.config.providers)
            .filter(([, config]) => config.enabled)
            .map(([id, config]) => ({ id, config }))
            .sort((a, b) => b.config.priority - a.config.priority);
    }
    /**
     * Updates a provider configuration
     */
    updateProviderConfig(providerId, updates) {
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
    addProviderConfig(providerId, config) {
        if (this.config.providers[providerId]) {
            throw new Error(`Provider already exists: ${providerId}`);
        }
        this.validateProviderConfig(config);
        this.config.providers[providerId] = config;
    }
    /**
     * Removes a provider configuration
     */
    removeProviderConfig(providerId) {
        if (!this.config.providers[providerId]) {
            return false;
        }
        delete this.config.providers[providerId];
        return true;
    }
    /**
     * Gets the decrypted API key for a provider
     */
    getApiKey(providerId) {
        const config = this.config.providers[providerId];
        if (!config) {
            throw new Error(`Provider not found: ${providerId}`);
        }
        return this.decryptApiKey(config.security.apiKey);
    }
    /**
     * Updates the API key for a provider
     */
    updateApiKey(providerId, apiKey) {
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
    getDefaults() {
        return this.config.defaults;
    }
    /**
     * Gets security configuration
     */
    getSecurityConfig() {
        return this.config.security;
    }
    /**
     * Gets monitoring configuration
     */
    getMonitoringConfig() {
        return this.config.monitoring;
    }
    /**
     * Gets ensemble configuration
     */
    getEnsembleConfig() {
        return this.config.ensemble;
    }
    /**
     * Updates ensemble configuration
     */
    updateEnsembleConfig(updates) {
        this.config = {
            ...this.config,
            ensemble: { ...this.config.ensemble, ...updates }
        };
    }
    /**
     * Validates the entire configuration
     */
    validateConfiguration(config) {
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
            }
            catch (error) {
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
    validateProviderConfig(config) {
        const required = ['type', 'name', 'security', 'endpoint', 'model', 'rateLimit', 'circuitBreaker', 'cost'];
        for (const field of required) {
            if (!(field in config) || !config[field]) {
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
        }
        catch {
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
    validateDefaults(defaults) {
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
    validateSecurityConfig(security) {
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
    validateMonitoringConfig(monitoring) {
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
    validateEnsembleConfig(ensemble) {
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
    processConfiguration(config) {
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
    encryptApiKey(apiKey) {
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
    decryptApiKey(encryptedApiKey) {
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
exports.ProviderConfigManager = ProviderConfigManager;
/**
 * Configuration factory for creating common provider configurations
 */
class ProviderConfigFactory {
    /**
     * Creates a configuration for OpenAI provider
     */
    static createOpenAIConfig(apiKey, overrides) {
        const baseConfig = {
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
                backoffStrategy: RateLimiter_1.BackoffStrategy.EXPONENTIAL
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
    static createClaudeConfig(apiKey, overrides) {
        const baseConfig = {
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
                backoffStrategy: RateLimiter_1.BackoffStrategy.EXPONENTIAL
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
    static createGeminiConfig(apiKey, overrides) {
        const baseConfig = {
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
                backoffStrategy: RateLimiter_1.BackoffStrategy.LINEAR
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
exports.ProviderConfigFactory = ProviderConfigFactory;
//# sourceMappingURL=providers.config.js.map