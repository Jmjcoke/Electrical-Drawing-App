/**
 * Provider abstraction interface for LLM integrations
 */
export interface ProviderCapabilities {
    supportsVision: boolean;
    maxImageSize: number;
    maxImagesPerRequest: number;
    supportedFormats: string[];
    maxTokens: number;
    costPerToken: number;
}
export interface AnalysisResult {
    analysisId: string;
    result: string;
    confidence: number;
    processingTime: number;
    provider: string;
    timestamp: Date;
    metadata: {
        model: string;
        tokenUsage?: {
            prompt: number;
            completion: number;
            total: number;
        } | undefined;
        imageCount: number;
        promptLength: number;
    };
}
export interface LLMProvider {
    /**
     * Analyzes images with the given prompt
     */
    analyze(images: Buffer[], prompt: string, options?: AnalysisOptions): Promise<AnalysisResult>;
    /**
     * Validates that the provider is properly configured
     */
    validateConfiguration(): boolean;
    /**
     * Returns the capabilities of this provider
     */
    getCapabilities(): ProviderCapabilities;
    /**
     * Gets the provider name
     */
    getName(): string;
    /**
     * Health check for the provider
     */
    healthCheck(): Promise<boolean>;
}
export interface AnalysisOptions {
    maxTokens?: number;
    temperature?: number;
    timeout?: number;
    retryCount?: number;
    model?: string;
}
export interface ProviderConfig {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
    retryAttempts?: number;
    maxConcurrentRequests?: number;
    model?: string;
}
export interface ProviderError extends Error {
    provider: string;
    code: 'API_ERROR' | 'TIMEOUT' | 'RATE_LIMITED' | 'INVALID_REQUEST' | 'CONFIGURATION_ERROR';
    retryable: boolean;
    details?: unknown;
}
//# sourceMappingURL=provider.interface.d.ts.map