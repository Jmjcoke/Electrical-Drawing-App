"use strict";
/**
 * Provider Registry
 *
 * Centralized registration system for all LLM providers.
 * Registers providers with the factory and manages provider initialization.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAllProviders = registerAllProviders;
exports.createProvidersFromEnv = createProvidersFromEnv;
exports.getProviderRegistrations = getProviderRegistrations;
exports.checkProviderHealth = checkProviderHealth;
const ProviderFactory_1 = require("./base/ProviderFactory");
const claude_provider_1 = require("./claude.provider");
const gemini_provider_1 = require("./gemini.provider");
/**
 * Registers all available providers with the factory
 */
function registerAllProviders() {
    const factory = ProviderFactory_1.ProviderFactory.getInstance();
    // Register Claude provider
    factory.registerProvider({
        type: 'anthropic',
        name: 'Anthropic Claude 3.5 Sonnet',
        description: 'Anthropic Claude 3.5 Sonnet for advanced visual analysis of electrical drawings',
        factory: (config) => {
            const claudeConfig = {
                apiKey: config.apiKey,
                model: config.model || 'claude-3-5-sonnet-20241022',
                maxTokens: config.maxTokens || 4096,
                temperature: config.temperature || 0.1,
                timeout: config.timeout || 30000,
                maxRetries: config.maxRetries || 3,
                anthropicVersion: config.anthropicVersion || '2023-06-01'
            };
            if (config.baseUrl) {
                claudeConfig.baseUrl = config.baseUrl;
            }
            if (config.rateLimit) {
                claudeConfig.rateLimit = config.rateLimit;
            }
            return new claude_provider_1.ClaudeProvider(claudeConfig);
        },
        requiredConfig: ['apiKey', 'model', 'maxTokens', 'temperature'],
        defaultConfig: {
            model: 'claude-3-5-sonnet-20241022',
            maxTokens: 4096,
            temperature: 0.1,
            timeout: 30000,
            maxRetries: 3,
            anthropicVersion: '2023-06-01'
        }
    });
    // Register Gemini provider
    factory.registerProvider({
        type: 'google',
        name: 'Google Gemini Pro Vision',
        description: 'Google Gemini Pro Vision for advanced multimodal analysis of electrical drawings',
        factory: (config) => {
            const geminiConfig = {
                apiKey: config.apiKey,
                model: 'gemini-pro-vision',
                maxTokens: config.maxTokens || 2048,
                temperature: config.temperature || 0.1,
                timeout: config.timeout || 30000,
                maxRetries: config.maxRetries || 3
            };
            // Add optional properties conditionally
            if (config.safetySettings) {
                geminiConfig.safetySettings = config.safetySettings;
            }
            if (config.generationConfig) {
                geminiConfig.generationConfig = config.generationConfig;
            }
            if (config.baseUrl) {
                geminiConfig.baseUrl = config.baseUrl;
            }
            if (config.rateLimit) {
                geminiConfig.rateLimit = config.rateLimit;
            }
            return new gemini_provider_1.GeminiProvider(geminiConfig);
        },
        requiredConfig: ['apiKey', 'model', 'maxTokens', 'temperature'],
        defaultConfig: {
            model: 'gemini-pro-vision',
            maxTokens: 2048,
            temperature: 0.1,
            timeout: 30000,
            maxRetries: 3
        }
    });
    console.log('✅ All providers registered with factory');
}
/**
 * Creates providers from environment configuration
 */
function createProvidersFromEnv() {
    const factory = ProviderFactory_1.ProviderFactory.getInstance();
    const providerConfigs = [];
    // Claude provider configuration
    if (process.env.ANTHROPIC_API_KEY) {
        providerConfigs.push({
            type: 'anthropic',
            enabled: true,
            priority: 90,
            config: {
                apiKey: process.env.ANTHROPIC_API_KEY,
                model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
                maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4096'),
                temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.1'),
                timeout: parseInt(process.env.CLAUDE_TIMEOUT || '30000'),
                maxRetries: parseInt(process.env.CLAUDE_MAX_RETRIES || '3'),
                anthropicVersion: process.env.ANTHROPIC_VERSION || '2023-06-01'
            }
        });
    }
    else {
        console.warn('⚠️  WARNING: ANTHROPIC_API_KEY environment variable not set! Claude provider will not be available.');
    }
    // Gemini provider configuration
    if (process.env.GOOGLE_API_KEY) {
        providerConfigs.push({
            type: 'google',
            enabled: true,
            priority: 80,
            config: {
                apiKey: process.env.GOOGLE_API_KEY,
                model: 'gemini-pro-vision',
                maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '2048'),
                temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.1'),
                timeout: parseInt(process.env.GEMINI_TIMEOUT || '30000'),
                maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES || '3')
            }
        });
    }
    else {
        console.warn('⚠️  WARNING: GOOGLE_API_KEY environment variable not set! Gemini provider will not be available.');
    }
    if (providerConfigs.length === 0) {
        console.warn('⚠️  WARNING: No provider configurations found. Please set API keys in environment variables.');
        return new Map();
    }
    try {
        return factory.createProviders(providerConfigs);
    }
    catch (error) {
        console.error('❌ Failed to create providers:', error);
        return new Map();
    }
}
/**
 * Gets provider registration information
 */
function getProviderRegistrations() {
    const factory = ProviderFactory_1.ProviderFactory.getInstance();
    return factory.getRegisteredProviderTypes();
}
/**
 * Checks provider health status
 */
async function checkProviderHealth(providers) {
    const healthStatus = new Map();
    const healthChecks = Array.from(providers.entries()).map(async ([type, provider]) => {
        try {
            const isHealthy = await provider.healthCheck();
            healthStatus.set(type, isHealthy);
            return { type, isHealthy };
        }
        catch (error) {
            console.error(`Health check failed for ${type} provider:`, error);
            healthStatus.set(type, false);
            return { type, isHealthy: false };
        }
    });
    await Promise.allSettled(healthChecks);
    return healthStatus;
}
//# sourceMappingURL=registry.js.map