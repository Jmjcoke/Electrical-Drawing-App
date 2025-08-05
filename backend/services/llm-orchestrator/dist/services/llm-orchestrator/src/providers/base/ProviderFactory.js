"use strict";
/**
 * Provider Factory Pattern Implementation
 *
 * This factory provides dynamic provider instantiation and registration
 * capabilities for the LLM ensemble system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderFactory = void 0;
const LLMProvider_interface_1 = require("./LLMProvider.interface");
/**
 * Factory class for creating and managing LLM providers
 */
class ProviderFactory {
    constructor() {
        this.registeredProviders = new Map();
        this.activeProviders = new Map();
    }
    /**
     * Gets the singleton instance of the provider factory
     */
    static getInstance() {
        if (!ProviderFactory.instance) {
            ProviderFactory.instance = new ProviderFactory();
        }
        return ProviderFactory.instance;
    }
    /**
     * Registers a new provider type with the factory
     */
    registerProvider(registration) {
        if (this.registeredProviders.has(registration.type)) {
            throw new Error(`Provider type '${registration.type}' is already registered`);
        }
        this.validateRegistration(registration);
        this.registeredProviders.set(registration.type, registration);
    }
    /**
     * Creates a provider instance based on configuration
     */
    createProvider(config) {
        const registration = this.registeredProviders.get(config.type);
        if (!registration) {
            throw new LLMProvider_interface_1.ConfigurationError(`Unknown provider type: ${config.type}`, config.type);
        }
        try {
            // Validate required configuration
            this.validateProviderConfig(registration, config.config);
            // Merge with default configuration
            const mergedConfig = {
                ...registration.defaultConfig,
                ...config.config
            };
            // Create provider instance
            const provider = registration.factory(mergedConfig);
            // Validate the created provider
            this.validateProviderInstance(provider, config.type);
            return provider;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorCause = error instanceof Error ? error : undefined;
            throw new LLMProvider_interface_1.ConfigurationError(`Failed to create provider '${config.type}': ${errorMessage}`, config.type, errorCause);
        }
    }
    /**
     * Creates multiple providers from configuration array
     */
    createProviders(configs) {
        const providers = new Map();
        const errors = [];
        // Sort by priority (higher priority first)
        const sortedConfigs = [...configs]
            .filter(config => config.enabled)
            .sort((a, b) => b.priority - a.priority);
        for (const config of sortedConfigs) {
            try {
                const provider = this.createProvider(config);
                providers.set(config.type, provider);
            }
            catch (error) {
                const errorInstance = error instanceof Error ? error : new Error(String(error));
                errors.push({ type: config.type, error: errorInstance });
            }
        }
        // If no providers were created successfully, throw error
        if (providers.size === 0 && errors.length > 0) {
            const errorMessages = errors.map(e => `${e.type}: ${e.error.message}`).join('; ');
            throw new LLMProvider_interface_1.ConfigurationError(`Failed to create any providers: ${errorMessages}`, 'factory');
        }
        // Store active providers
        for (const [type, provider] of providers) {
            this.activeProviders.set(type, provider);
        }
        return providers;
    }
    /**
     * Gets a provider by type (if already created)
     */
    getProvider(type) {
        return this.activeProviders.get(type);
    }
    /**
     * Gets all active providers
     */
    getActiveProviders() {
        return new Map(this.activeProviders);
    }
    /**
     * Gets information about registered provider types
     */
    getRegisteredProviderTypes() {
        return Array.from(this.registeredProviders.values()).map(reg => ({
            type: reg.type,
            name: reg.name,
            description: reg.description,
            requiredConfig: reg.requiredConfig
        }));
    }
    /**
     * Checks if a provider type is registered
     */
    isProviderRegistered(type) {
        return this.registeredProviders.has(type);
    }
    /**
     * Discovers providers that can handle a given capability
     */
    discoverProviders(capability) {
        const results = [];
        for (const [type, registration] of this.registeredProviders) {
            const provider = this.activeProviders.get(type);
            // Check if provider supports the capability
            if (provider && this.providerSupportsCapability(provider, capability)) {
                results.push({
                    type,
                    name: registration.name,
                    provider
                });
            }
            else {
                // Include registered but inactive providers
                results.push({
                    type,
                    name: registration.name
                });
            }
        }
        return results;
    }
    /**
     * Creates providers with fallback chain
     */
    createProvidersWithFallback(configs) {
        const primary = this.createProviders(configs);
        const fallbacks = new Map();
        // Build fallback chains
        for (const config of configs.filter(c => c.enabled)) {
            if (config.fallbackProviders && config.fallbackProviders.length > 0) {
                const fallbackProviders = [];
                for (const fallbackType of config.fallbackProviders) {
                    const fallbackProvider = primary.get(fallbackType);
                    if (fallbackProvider) {
                        fallbackProviders.push(fallbackProvider);
                    }
                }
                if (fallbackProviders.length > 0) {
                    fallbacks.set(config.type, fallbackProviders);
                }
            }
        }
        return { primary, fallbacks };
    }
    /**
     * Validates provider registration
     */
    validateRegistration(registration) {
        if (!registration.type || typeof registration.type !== 'string') {
            throw new Error('Provider registration must have a valid type');
        }
        if (!registration.name || typeof registration.name !== 'string') {
            throw new Error('Provider registration must have a valid name');
        }
        if (typeof registration.factory !== 'function') {
            throw new Error('Provider registration must have a factory function');
        }
        if (!Array.isArray(registration.requiredConfig)) {
            throw new Error('Provider registration must specify required configuration keys');
        }
    }
    /**
     * Validates provider configuration
     */
    validateProviderConfig(registration, config) {
        for (const requiredKey of registration.requiredConfig) {
            if (!(requiredKey in config) || config[requiredKey] === undefined || config[requiredKey] === null) {
                throw new Error(`Missing required configuration: ${requiredKey}`);
            }
        }
    }
    /**
     * Validates a created provider instance
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    validateProviderInstance(provider, _type) {
        if (!provider || typeof provider !== 'object') {
            throw new Error('Provider factory must return a valid provider instance');
        }
        // Check required methods
        const requiredMethods = ['analyze', 'healthCheck', 'getRateLimit', 'getCost'];
        for (const method of requiredMethods) {
            if (typeof provider[method] !== 'function') {
                throw new Error(`Provider instance must implement ${method} method`);
            }
        }
        // Check required properties
        if (!provider.name || !provider.version || !provider.metadata) {
            throw new Error('Provider instance must have name, version, and metadata properties');
        }
    }
    /**
     * Checks if a provider supports a given capability
     */
    providerSupportsCapability(provider, capability) {
        const metadata = provider.metadata;
        switch (capability.toLowerCase()) {
            case 'vision':
                return metadata.capabilities.supportsVision;
            case 'streaming':
                return metadata.capabilities.supportsStreaming;
            default:
                return true; // Assume basic capabilities are supported
        }
    }
    /**
     * Clears all active providers (useful for testing)
     */
    clearActiveProviders() {
        this.activeProviders.clear();
    }
    /**
     * Unregisters a provider type (useful for testing)
     */
    unregisterProvider(type) {
        return this.registeredProviders.delete(type);
    }
}
exports.ProviderFactory = ProviderFactory;
//# sourceMappingURL=ProviderFactory.js.map