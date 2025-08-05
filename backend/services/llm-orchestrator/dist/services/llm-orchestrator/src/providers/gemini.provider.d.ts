/**
 * Google Gemini Pro Vision Provider Implementation
 *
 * Integrates Google Gemini Pro Vision as a tertiary provider in the LLM ensemble,
 * providing advanced visual analysis capabilities for electrical drawings with
 * Google's latest multimodal AI technology.
 */
import { HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { BaseProvider, BaseProviderConfig } from './base/BaseProvider';
import { LLMResponse, AnalysisOptions, ProviderMetadata } from './base/LLMProvider.interface';
export interface GeminiConfig extends BaseProviderConfig {
    readonly model: 'gemini-pro-vision';
    readonly maxTokens: number;
    readonly temperature: number;
    readonly safetySettings?: Array<{
        category: HarmCategory;
        threshold: HarmBlockThreshold;
    }>;
    readonly generationConfig?: {
        stopSequences?: string[];
        candidateCount?: number;
        maxOutputTokens?: number;
        temperature?: number;
        topP?: number;
        topK?: number;
    };
}
export interface GeminiSafetyRating {
    category: HarmCategory;
    probability: string;
}
export interface GeminiUsageMetadata {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
}
/**
 * Google Gemini Pro Vision provider implementation
 * Provides advanced vision analysis capabilities using Gemini Pro Vision
 */
export declare class GeminiProvider extends BaseProvider {
    private client;
    private model;
    private geminiConfig;
    readonly name = "gemini-pro-vision";
    readonly version = "1.0";
    readonly metadata: ProviderMetadata;
    constructor(config: GeminiConfig);
    /**
     * Analyzes an image using Gemini Pro Vision
     */
    analyze(image: Buffer, prompt: string, options?: AnalysisOptions): Promise<LLMResponse>;
    /**
     * Performs health check on the Gemini provider
     */
    healthCheck(): Promise<boolean>;
    /**
     * Calculates cost for given number of tokens
     * Based on Gemini Pro Vision pricing
     */
    getCost(tokens: number): number;
    /**
     * Gets provider-specific configuration requirements
     */
    getRequiredConfig(): string[];
    /**
     * Validates Gemini-specific configuration
     */
    protected validateProviderSpecificConfig(config: Record<string, unknown>): boolean;
    /**
     * Initializes the Gemini client and model
     */
    private initializeClient;
    /**
     * Validates Gemini-specific configuration
     */
    private validateGeminiConfig;
    /**
     * Validates analysis inputs
     */
    private validateAnalysisInputs;
    /**
     * Detects media type from image buffer
     */
    private detectMediaType;
    /**
     * Calculates confidence score based on safety ratings and finish reason
     */
    private calculateConfidenceScore;
    /**
     * Generates a unique response ID
     */
    private generateResponseId;
    /**
     * Estimates token count when not provided by API
     */
    private estimateTokenCount;
    /**
     * Gets default safety settings for electrical drawing analysis
     */
    private getDefaultSafetySettings;
    /**
     * Handles Gemini-specific errors
     */
    private handleGeminiError;
}
//# sourceMappingURL=gemini.provider.d.ts.map