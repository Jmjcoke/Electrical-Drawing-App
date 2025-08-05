/**
 * Provider Registry
 *
 * Centralized registration system for all LLM providers.
 * Registers providers with the factory and manages provider initialization.
 */
import { LLMProvider } from './base/LLMProvider.interface';
/**
 * Registers all available providers with the factory
 */
export declare function registerAllProviders(): void;
/**
 * Creates providers from environment configuration
 */
export declare function createProvidersFromEnv(): Map<string, LLMProvider>;
/**
 * Gets provider registration information
 */
export declare function getProviderRegistrations(): Array<{
    type: string;
    name: string;
    description: string;
    requiredConfig: string[];
}>;
/**
 * Checks provider health status
 */
export declare function checkProviderHealth(providers: Map<string, LLMProvider>): Promise<Map<string, boolean>>;
//# sourceMappingURL=registry.d.ts.map