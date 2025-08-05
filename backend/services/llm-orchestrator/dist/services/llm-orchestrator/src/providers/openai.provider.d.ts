/**
 * OpenAI GPT-4 Vision provider implementation
 */
import { LLMProvider, AnalysisResult, ProviderCapabilities, AnalysisOptions, ProviderConfig } from './provider.interface';
export declare class OpenAIProvider implements LLMProvider {
    private client;
    private config;
    constructor(config: ProviderConfig);
    analyze(images: Buffer[], prompt: string, options?: AnalysisOptions): Promise<AnalysisResult>;
    validateConfiguration(): boolean;
    getCapabilities(): ProviderCapabilities;
    getName(): string;
    healthCheck(): Promise<boolean>;
    private validateInputs;
    private generateAnalysisId;
    private calculateConfidence;
    private mapOpenAIErrorCode;
    private isRetryableError;
}
//# sourceMappingURL=openai.provider.d.ts.map