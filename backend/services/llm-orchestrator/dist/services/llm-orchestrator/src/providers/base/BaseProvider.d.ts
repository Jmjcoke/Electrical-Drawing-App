/**
 * Base Provider Implementation
 *
 * Provides common functionality for all LLM providers including:
 * - Request/response logging
 * - Error handling
 * - Rate limiting validation
 * - Metrics collection
 */
import { LLMProvider, LLMResponse, AnalysisOptions, RateLimitInfo, ProviderMetadata } from './LLMProvider.interface';
export interface BaseProviderConfig {
    readonly apiKey: string;
    readonly timeout?: number;
    readonly maxRetries?: number;
    readonly baseUrl?: string;
    readonly rateLimit?: {
        requestsPerMinute: number;
        dailyLimit?: number;
    };
}
export interface RequestMetrics {
    readonly startTime: number;
    readonly endTime?: number;
    readonly duration?: number;
    readonly tokensUsed?: number;
    readonly success: boolean;
    readonly error?: Error;
}
/**
 * Abstract base class providing common provider functionality
 */
export declare abstract class BaseProvider implements LLMProvider {
    protected readonly config: BaseProviderConfig;
    private requestHistory;
    private currentRateLimit;
    constructor(config: BaseProviderConfig);
    abstract readonly name: string;
    abstract readonly version: string;
    abstract readonly metadata: ProviderMetadata;
    abstract analyze(image: Buffer, prompt: string, options?: AnalysisOptions): Promise<LLMResponse>;
    abstract healthCheck(): Promise<boolean>;
    abstract getCost(tokens: number): number;
    abstract getRequiredConfig(): string[];
    /**
     * Gets current rate limit information
     */
    getRateLimit(): RateLimitInfo;
    /**
     * Validates provider configuration
     */
    validateConfig(config: Record<string, unknown>): boolean;
    /**
     * Protected method for executing analysis with common error handling
     */
    protected executeAnalysis(analysisFunction: () => Promise<LLMResponse>, options?: AnalysisOptions): Promise<LLMResponse>;
    /**
     * Validates base configuration common to all providers
     */
    private validateBaseConfig;
    /**
     * Provider-specific configuration validation (override in subclasses)
     */
    protected validateProviderSpecificConfig(_config: Record<string, unknown>): boolean;
    /**
     * Initializes rate limit information
     */
    private initializeRateLimit;
    /**
     * Updates rate limit information based on recent requests
     */
    private updateRateLimitInfo;
    /**
     * Checks if request can be made within rate limits
     */
    private checkRateLimit;
    /**
     * Records request metrics
     */
    private recordRequest;
    /**
     * Updates rate limit info after successful request
     */
    private updateRateLimitAfterRequest;
    /**
     * Wraps a promise with timeout
     */
    private withTimeout;
    /**
     * Handles and wraps errors in appropriate error types
     */
    private handleError;
    /**
     * Extracts retry-after value from error response
     */
    private extractRetryAfterFromError;
    /**
     * Gets request history for monitoring/debugging
     */
    protected getRequestHistory(): ReadonlyArray<RequestMetrics>;
    /**
     * Gets performance metrics
     */
    protected getPerformanceMetrics(): {
        totalRequests: number;
        successfulRequests: number;
        failedRequests: number;
        averageResponseTime: number;
        totalTokensUsed: number;
    };
}
//# sourceMappingURL=BaseProvider.d.ts.map