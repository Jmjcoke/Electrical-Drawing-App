/**
 * Abstract LLM Provider Interface
 *
 * This interface defines the contract that all LLM providers must implement
 * to ensure consistent behavior across the ensemble system.
 *
 * @interface LLMProvider
 */
export interface AnalysisOptions {
    readonly maxTokens?: number;
    readonly temperature?: number;
    readonly timeout?: number;
    readonly retryAttempts?: number;
}
export interface RateLimitInfo {
    readonly requestsPerMinute: number;
    readonly requestsRemaining: number;
    readonly resetTime: Date;
    readonly dailyLimit?: number;
    readonly dailyUsed?: number;
}
export interface LLMResponse {
    readonly id: string;
    readonly content: string;
    readonly confidence: number;
    readonly tokensUsed: number;
    readonly responseTime: number;
    readonly model: string;
    readonly timestamp: Date;
    readonly metadata?: Record<string, unknown>;
}
export interface ProviderCapabilities {
    readonly supportsVision: boolean;
    readonly maxImageSize: number;
    readonly supportedImageFormats: string[];
    readonly maxPromptLength: number;
    readonly supportsStreaming: boolean;
}
export interface ProviderMetadata {
    readonly name: string;
    readonly version: string;
    readonly capabilities: ProviderCapabilities;
    readonly description: string;
}
/**
 * Abstract LLM Provider Interface
 * All LLM providers must implement this interface to ensure consistent behavior
 */
export interface LLMProvider {
    readonly name: string;
    readonly version: string;
    readonly metadata: ProviderMetadata;
    /**
     * Analyzes an image with the provided prompt
     * @param image - Image buffer to analyze
     * @param prompt - Analysis prompt/question
     * @param options - Optional analysis configuration
     * @returns Promise resolving to LLM response
     * @throws {ProviderError} When analysis fails
     */
    analyze(image: Buffer, prompt: string, options?: AnalysisOptions): Promise<LLMResponse>;
    /**
     * Performs health check on the provider
     * @returns Promise resolving to true if provider is healthy
     */
    healthCheck(): Promise<boolean>;
    /**
     * Gets current rate limit information
     * @returns Current rate limit status
     */
    getRateLimit(): RateLimitInfo;
    /**
     * Calculates cost for given number of tokens
     * @param tokens - Number of tokens to calculate cost for
     * @returns Cost in USD
     */
    getCost(tokens: number): number;
    /**
     * Gets provider-specific configuration requirements
     * @returns Array of required configuration keys
     */
    getRequiredConfig(): string[];
    /**
     * Validates provider configuration
     * @param config - Configuration object to validate
     * @returns True if configuration is valid
     * @throws {ConfigurationError} When configuration is invalid
     */
    validateConfig(config: Record<string, unknown>): boolean;
}
/**
 * Provider-specific error types
 */
export declare class ProviderError extends Error {
    readonly code: string;
    readonly provider: string;
    readonly originalError?: Error | undefined;
    constructor(message: string, code: string, provider: string, originalError?: Error | undefined);
}
export declare class ConfigurationError extends ProviderError {
    constructor(message: string, provider: string, originalError?: Error);
}
export declare class RateLimitError extends ProviderError {
    readonly retryAfter: number;
    constructor(message: string, provider: string, retryAfter: number, originalError?: Error);
}
export declare class AnalysisError extends ProviderError {
    constructor(message: string, provider: string, originalError?: Error);
}
//# sourceMappingURL=LLMProvider.interface.d.ts.map