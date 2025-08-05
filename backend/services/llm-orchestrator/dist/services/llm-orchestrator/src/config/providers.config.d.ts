/**
 * Provider Configuration System
 *
 * Manages configuration for LLM providers including secure API key handling,
 * validation, and provider-specific settings.
 */
import { RateLimitConfig } from '../reliability/RateLimiter';
import { CircuitBreakerConfig } from '../reliability/CircuitBreaker';
export interface ProviderSecurityConfig {
    readonly apiKey: string;
    readonly apiKeyRotation?: {
        enabled: boolean;
        rotationInterval: number;
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
        auth?: {
            username: string;
            password: string;
        };
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
    readonly inputTokenCost: number;
    readonly outputTokenCost: number;
    readonly visionCost?: number;
    readonly minimumCharge?: number;
    readonly currency: string;
    readonly costTracking: boolean;
    readonly budgetAlerts?: {
        enabled: boolean;
        dailyLimit: number;
        monthlyLimit: number;
        alertThresholds: number[];
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
export declare class ProviderConfigManager {
    private config;
    private encryptionKey?;
    constructor(config: ProvidersConfiguration, encryptionKey?: string);
    /**
     * Gets configuration for a specific provider
     */
    getProviderConfig(providerId: string): ProviderConfig | undefined;
    /**
     * Gets configurations for all enabled providers
     */
    getEnabledProviders(): Record<string, ProviderConfig>;
    /**
     * Gets providers sorted by priority
     */
    getProvidersByPriority(): Array<{
        id: string;
        config: ProviderConfig;
    }>;
    /**
     * Updates a provider configuration
     */
    updateProviderConfig(providerId: string, updates: Partial<ProviderConfig>): void;
    /**
     * Adds a new provider configuration
     */
    addProviderConfig(providerId: string, config: ProviderConfig): void;
    /**
     * Removes a provider configuration
     */
    removeProviderConfig(providerId: string): boolean;
    /**
     * Gets the decrypted API key for a provider
     */
    getApiKey(providerId: string): string;
    /**
     * Updates the API key for a provider
     */
    updateApiKey(providerId: string, apiKey: string): void;
    /**
     * Gets default configuration values
     */
    getDefaults(): ProvidersConfiguration['defaults'];
    /**
     * Gets security configuration
     */
    getSecurityConfig(): ProvidersConfiguration['security'];
    /**
     * Gets monitoring configuration
     */
    getMonitoringConfig(): ProvidersConfiguration['monitoring'];
    /**
     * Gets ensemble configuration
     */
    getEnsembleConfig(): EnsembleConfiguration;
    /**
     * Updates ensemble configuration
     */
    updateEnsembleConfig(updates: Partial<EnsembleConfiguration>): void;
    /**
     * Validates the entire configuration
     */
    private validateConfiguration;
    /**
     * Validates a single provider configuration
     */
    private validateProviderConfig;
    /**
     * Validates default configuration
     */
    private validateDefaults;
    /**
     * Validates security configuration
     */
    private validateSecurityConfig;
    /**
     * Validates monitoring configuration
     */
    private validateMonitoringConfig;
    /**
     * Validates ensemble configuration
     */
    private validateEnsembleConfig;
    /**
     * Processes configuration after validation
     */
    private processConfiguration;
    /**
     * Encrypts an API key
     */
    private encryptApiKey;
    /**
     * Decrypts an API key
     */
    private decryptApiKey;
}
/**
 * Configuration factory for creating common provider configurations
 */
export declare class ProviderConfigFactory {
    /**
     * Creates a configuration for OpenAI provider
     */
    static createOpenAIConfig(apiKey: string, overrides?: Partial<ProviderConfig>): ProviderConfig;
    /**
     * Creates a configuration for Anthropic Claude provider
     */
    static createClaudeConfig(apiKey: string, overrides?: Partial<ProviderConfig>): ProviderConfig;
    /**
     * Creates a configuration for Google Gemini provider
     */
    static createGeminiConfig(apiKey: string, overrides?: Partial<ProviderConfig>): ProviderConfig;
}
//# sourceMappingURL=providers.config.d.ts.map