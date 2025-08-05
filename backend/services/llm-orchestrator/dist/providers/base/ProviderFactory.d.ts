/**
 * Provider Factory Pattern Implementation
 *
 * This factory provides dynamic provider instantiation and registration
 * capabilities for the LLM ensemble system.
 */
import { LLMProvider } from './LLMProvider.interface';
export interface ProviderConfig {
    readonly type: string;
    readonly enabled: boolean;
    readonly priority: number;
    readonly config: Record<string, unknown>;
    readonly fallbackProviders?: string[];
}
export interface ProviderRegistration {
    readonly type: string;
    readonly name: string;
    readonly description: string;
    readonly factory: (config: Record<string, unknown>) => LLMProvider;
    readonly requiredConfig: string[];
    readonly defaultConfig?: Record<string, unknown>;
}
/**
 * Factory class for creating and managing LLM providers
 */
export declare class ProviderFactory {
    private static instance;
    private readonly registeredProviders;
    private readonly activeProviders;
    private constructor();
    /**
     * Gets the singleton instance of the provider factory
     */
    static getInstance(): ProviderFactory;
    /**
     * Registers a new provider type with the factory
     */
    registerProvider(registration: ProviderRegistration): void;
    /**
     * Creates a provider instance based on configuration
     */
    createProvider(config: ProviderConfig): LLMProvider;
    /**
     * Creates multiple providers from configuration array
     */
    createProviders(configs: ProviderConfig[]): Map<string, LLMProvider>;
    /**
     * Gets a provider by type (if already created)
     */
    getProvider(type: string): LLMProvider | undefined;
    /**
     * Gets all active providers
     */
    getActiveProviders(): Map<string, LLMProvider>;
    /**
     * Gets information about registered provider types
     */
    getRegisteredProviderTypes(): Array<{
        type: string;
        name: string;
        description: string;
        requiredConfig: string[];
    }>;
    /**
     * Checks if a provider type is registered
     */
    isProviderRegistered(type: string): boolean;
    /**
     * Discovers providers that can handle a given capability
     */
    discoverProviders(capability: string): Array<{
        type: string;
        name: string;
        provider?: LLMProvider;
    }>;
    /**
     * Creates providers with fallback chain
     */
    createProvidersWithFallback(configs: ProviderConfig[]): {
        primary: Map<string, LLMProvider>;
        fallbacks: Map<string, LLMProvider[]>;
    };
    /**
     * Validates provider registration
     */
    private validateRegistration;
    /**
     * Validates provider configuration
     */
    private validateProviderConfig;
    /**
     * Validates a created provider instance
     */
    private validateProviderInstance;
    /**
     * Checks if a provider supports a given capability
     */
    private providerSupportsCapability;
    /**
     * Clears all active providers (useful for testing)
     */
    clearActiveProviders(): void;
    /**
     * Unregisters a provider type (useful for testing)
     */
    unregisterProvider(type: string): boolean;
}
//# sourceMappingURL=ProviderFactory.d.ts.map