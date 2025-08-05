/**
 * Google Gemini Pro Vision Provider Implementation
 * 
 * Integrates Google Gemini Pro Vision as a tertiary provider in the LLM ensemble,
 * providing advanced visual analysis capabilities for electrical drawings with
 * Google's latest multimodal AI technology.
 */

import { GoogleGenerativeAI, GenerativeModel, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { BaseProvider, BaseProviderConfig } from './base/BaseProvider';
import {
  LLMResponse,
  AnalysisOptions,
  ProviderMetadata,
  ProviderError,
  ConfigurationError,
  AnalysisError,
  RateLimitError
} from './base/LLMProvider.interface';

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
export class GeminiProvider extends BaseProvider {
  private client!: GoogleGenerativeAI;
  private model!: GenerativeModel;
  private geminiConfig: GeminiConfig;

  readonly name = 'gemini-pro-vision';
  readonly version = '1.0';
  readonly metadata: ProviderMetadata = {
    name: this.name,
    version: this.version,
    capabilities: {
      supportsVision: true,
      maxImageSize: 20 * 1024 * 1024, // 20MB - Gemini supports larger images
      supportedImageFormats: ['jpeg', 'jpg', 'png', 'webp', 'heic', 'heif'],
      maxPromptLength: 1000000, // 1M tokens context length
      supportsStreaming: true
    },
    description: 'Google Gemini Pro Vision for advanced multimodal analysis of electrical drawings'
  };

  constructor(config: GeminiConfig) {
    super(config);
    this.geminiConfig = config;
    this.validateGeminiConfig(config);
    this.initializeClient();
  }

  /**
   * Analyzes an image using Gemini Pro Vision
   */
  async analyze(image: Buffer, prompt: string, options?: AnalysisOptions): Promise<LLMResponse> {
    return this.executeAnalysis(async () => {
      const startTime = Date.now();
      
      try {
        // Validate inputs
        this.validateAnalysisInputs(image, prompt);
        
        // Convert image to inline data format required by Gemini
        const imageData = {
          inlineData: {
            data: image.toString('base64'),
            mimeType: this.detectMediaType(image)
          }
        };
        
        // Prepare generation config
        const generationConfig = {
          temperature: options?.temperature ?? this.geminiConfig.temperature,
          maxOutputTokens: options?.maxTokens ?? this.geminiConfig.maxTokens,
          topP: this.geminiConfig.generationConfig?.topP ?? 0.8,
          topK: this.geminiConfig.generationConfig?.topK ?? 40,
          ...this.geminiConfig.generationConfig
        };

        // Generate content
        const result = await this.model.generateContent({
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              imageData
            ]
          }],
          generationConfig,
          safetySettings: this.geminiConfig.safetySettings || this.getDefaultSafetySettings()
        });

        const response = result.response;
        
        // Check for safety issues
        if (response.promptFeedback?.blockReason) {
          throw new AnalysisError(
            `Content blocked by safety filters: ${response.promptFeedback.blockReason}`,
            this.name
          );
        }

        // Extract response content
        const text = response.text();
        if (!text) {
          throw new AnalysisError('No text content received from Gemini', this.name);
        }

        // Calculate confidence score based on safety ratings and finish reason
        const confidence = this.calculateConfidenceScore(
          response.candidates?.[0]?.safetyRatings || [],
          response.candidates?.[0]?.finishReason || 'STOP'
        );

        // Extract usage metadata
        const usageMetadata = response.usageMetadata as GeminiUsageMetadata | undefined;
        const tokensUsed = usageMetadata?.totalTokenCount || this.estimateTokenCount(prompt + text);

        return {
          id: this.generateResponseId(),
          content: text,
          confidence,
          tokensUsed,
          responseTime: Date.now() - startTime,
          model: this.name,
          timestamp: new Date(),
          metadata: {
            finishReason: response.candidates?.[0]?.finishReason,
            safetyRatings: response.candidates?.[0]?.safetyRatings,
            usageMetadata: usageMetadata,
            promptFeedback: response.promptFeedback
          }
        };

      } catch (error: any) {
        throw this.handleGeminiError(error);
      }
    }, options);
  }

  /**
   * Performs health check on the Gemini provider
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Create a simple test image (1x1 pixel PNG)
      const testImage = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77yQAAAABJRU5ErkJggg==',
        'base64'
      );

      const result = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: 'What do you see in this image?' },
            {
              inlineData: {
                data: testImage.toString('base64'),
                mimeType: 'image/png'
              }
            }
          ]
        }],
        generationConfig: {
          maxOutputTokens: 10,
          temperature: 0
        }
      });

      return !!result.response.text();
    } catch (error) {
      console.error(`Gemini health check failed: ${error}`);
      return false;
    }
  }

  /**
   * Calculates cost for given number of tokens
   * Based on Gemini Pro Vision pricing
   */
  getCost(tokens: number): number {
    // Gemini Pro Vision pricing (as of 2024)
    // Input: $0.00025 per 1K tokens
    // Output: $0.0005 per 1K tokens
    // Using blended rate for simplicity
    const costPerThousandTokens = 0.000375;
    return (tokens / 1000) * costPerThousandTokens;
  }

  /**
   * Gets provider-specific configuration requirements
   */
  getRequiredConfig(): string[] {
    return [
      'apiKey',
      'model',
      'maxTokens',
      'temperature'
    ];
  }

  /**
   * Validates Gemini-specific configuration
   */
  protected validateProviderSpecificConfig(config: Record<string, unknown>): boolean {
    const geminiConfig = config as Partial<GeminiConfig>;

    if (!geminiConfig.model || geminiConfig.model !== 'gemini-pro-vision') {
      throw new Error('Model must be "gemini-pro-vision"');
    }

    if (typeof geminiConfig.maxTokens !== 'number' || geminiConfig.maxTokens <= 0) {
      throw new Error('maxTokens must be a positive number');
    }

    if (typeof geminiConfig.temperature !== 'number' || 
        geminiConfig.temperature < 0 || geminiConfig.temperature > 1) {
      throw new Error('temperature must be a number between 0 and 1');
    }

    return true;
  }

  /**
   * Initializes the Gemini client and model
   */
  private initializeClient(): void {
    try {
      this.client = new GoogleGenerativeAI(this.config.apiKey);
      this.model = this.client.getGenerativeModel({ 
        model: this.geminiConfig.model,
        safetySettings: this.geminiConfig.safetySettings || this.getDefaultSafetySettings()
      });
    } catch (error) {
      throw new ConfigurationError(
        `Failed to initialize Gemini client: ${error}`,
        this.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Validates Gemini-specific configuration
   */
  private validateGeminiConfig(config: GeminiConfig): void {
    if (config.model !== 'gemini-pro-vision') {
      throw new ConfigurationError(
        'Only gemini-pro-vision model is supported',
        this.name
      );
    }

    if (config.maxTokens <= 0 || config.maxTokens > 8192) {
      throw new ConfigurationError(
        'maxTokens must be between 1 and 8192',
        this.name
      );
    }

    if (config.temperature < 0 || config.temperature > 1) {
      throw new ConfigurationError(
        'temperature must be between 0 and 1',
        this.name
      );
    }
  }

  /**
   * Validates analysis inputs
   */
  private validateAnalysisInputs(image: Buffer, prompt: string): void {
    if (!image || image.length === 0) {
      throw new AnalysisError('Image buffer is required and cannot be empty', this.name);
    }

    if (!prompt || prompt.trim().length === 0) {
      throw new AnalysisError('Prompt is required and cannot be empty', this.name);
    }

    if (image.length > this.metadata.capabilities.maxImageSize) {
      throw new AnalysisError(
        `Image size (${image.length} bytes) exceeds maximum allowed size (${this.metadata.capabilities.maxImageSize} bytes)`,
        this.name
      );
    }

    if (prompt.length > this.metadata.capabilities.maxPromptLength) {
      throw new AnalysisError(
        `Prompt length (${prompt.length}) exceeds maximum allowed length (${this.metadata.capabilities.maxPromptLength})`,
        this.name
      );
    }
  }

  /**
   * Detects media type from image buffer
   */
  private detectMediaType(image: Buffer): string {
    // Check for common image file signatures
    if (image.length >= 8) {
      // PNG signature
      if (image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
        return 'image/png';
      }
      
      // JPEG signature
      if (image.subarray(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]))) {
        return 'image/jpeg';
      }
      
      // WebP signature
      if (image.subarray(0, 4).equals(Buffer.from('RIFF', 'ascii')) &&
          image.subarray(8, 12).equals(Buffer.from('WEBP', 'ascii'))) {
        return 'image/webp';
      }
    }

    // Default to JPEG if we can't detect
    return 'image/jpeg';
  }

  /**
   * Calculates confidence score based on safety ratings and finish reason
   */
  private calculateConfidenceScore(safetyRatings: GeminiSafetyRating[], finishReason: string): number {
    let confidence = 0.85; // Base confidence for Gemini

    // Adjust based on finish reason
    switch (finishReason) {
      case 'STOP':
        confidence += 0.1; // Natural completion
        break;
      case 'MAX_TOKENS':
        confidence -= 0.05; // Truncated response
        break;
      case 'SAFETY':
        confidence -= 0.3; // Safety concerns
        break;
      case 'RECITATION':
        confidence -= 0.2; // Potential copyright issues
        break;
      default:
        confidence -= 0.1; // Unknown reason
    }

    // Adjust based on safety ratings
    for (const rating of safetyRatings) {
      if (rating.probability === 'HIGH' || rating.probability === 'MEDIUM') {
        confidence -= 0.1;
      }
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Generates a unique response ID
   */
  private generateResponseId(): string {
    return `gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Estimates token count when not provided by API
   */
  private estimateTokenCount(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Gets default safety settings for electrical drawing analysis
   */
  private getDefaultSafetySettings() {
    return [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH
      }
    ];
  }

  /**
   * Handles Gemini-specific errors
   */
  private handleGeminiError(error: any): ProviderError {
    if (error instanceof ProviderError) {
      return error;
    }

    // Handle Google AI SDK specific errors
    if (error?.message) {
      const message = error.message.toLowerCase();
      
      if (message.includes('api key') || message.includes('authentication')) {
        return new ConfigurationError(`Authentication failed: ${error.message}`, this.name, error);
      }
      
      if (message.includes('quota') || message.includes('rate limit')) {
        return new RateLimitError(`Rate limit exceeded: ${error.message}`, this.name, 60, error);
      }
      
      if (message.includes('safety') || message.includes('blocked')) {
        return new AnalysisError(`Content safety violation: ${error.message}`, this.name, error);
      }
      
      if (message.includes('timeout')) {
        return new AnalysisError(`Request timeout: ${error.message}`, this.name, error);
      }
    }

    // Default error handling
    return new AnalysisError(`Gemini analysis failed: ${error?.message || error}`, this.name, error);
  }
}