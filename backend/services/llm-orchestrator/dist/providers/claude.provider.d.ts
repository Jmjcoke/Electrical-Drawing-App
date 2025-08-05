/**
 * Anthropic Claude 3.5 Sonnet Provider Implementation
 *
 * Integrates Claude 3.5 Sonnet as a secondary provider in the LLM ensemble,
 * providing advanced visual analysis capabilities for electrical drawings.
 */
import { BaseProvider, BaseProviderConfig } from './base/BaseProvider';
import { LLMResponse, AnalysisOptions, ProviderMetadata } from './base/LLMProvider.interface';
export interface ClaudeConfig extends BaseProviderConfig {
    readonly model: string;
    readonly maxTokens: number;
    readonly temperature: number;
    readonly anthropicVersion?: string;
}
/**
 * Anthropic Claude provider implementation
 * Provides vision analysis capabilities using Claude 3.5 Sonnet
 */
export declare class ClaudeProvider extends BaseProvider {
    private client;
    private claudeConfig;
    readonly name = "claude-3-5-sonnet";
    readonly version = "20241022";
    readonly metadata: ProviderMetadata;
    constructor(config: ClaudeConfig);
    /**
     * Analyzes an image using Claude 3.5 Sonnet
     */
    analyze(image: Buffer, prompt: string, options?: AnalysisOptions): Promise<LLMResponse>;
    /**
     * Performs health check on Claude API
     */
    healthCheck(): Promise<boolean>;
    /**
     * Calculates cost for given number of tokens
     */
    getCost(tokens: number): number;
    /**
     * Gets required configuration keys
     */
    getRequiredConfig(): string[];
    /**
     * Validates Claude-specific configuration
     */
    protected validateProviderSpecificConfig(config: Record<string, unknown>): boolean;
    /**
     * Initializes the Anthropic client
     */
    private initializeClient;
    /**
     * Validates Claude-specific configuration
     */
    private validateClaudeConfig;
    /**
     * Validates analysis inputs
     */
    private validateAnalysisInputs;
    /**
     * Detects media type from image buffer
     */
    private detectMediaType;
    /**
     * Calculates confidence score based on response characteristics
     */
    private calculateConfidence;
    /**
     * Handles Claude-specific errors
     */
    private handleClaudeError;
}
//# sourceMappingURL=claude.provider.d.ts.map