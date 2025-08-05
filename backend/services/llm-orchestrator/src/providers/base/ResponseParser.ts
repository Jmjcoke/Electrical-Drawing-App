/**
 * Response Parser Utilities
 * 
 * Provides utilities for parsing and normalizing responses from different
 * LLM providers into a standardized format.
 */

import { LLMResponse, ProviderError } from './LLMProvider.interface';

export interface ParsedResponse {
  readonly content: string;
  readonly tokensUsed: number;
  readonly confidence: number;
  readonly metadata: Record<string, unknown>;
}

export interface ResponseParsingOptions {
  readonly extractConfidence?: boolean;
  readonly defaultConfidence?: number;
  readonly maxContentLength?: number;
  readonly includeRawResponse?: boolean;
}

/**
 * Base class for provider-specific response parsers
 */
export abstract class ResponseParser {
  protected readonly options: Required<ResponseParsingOptions>;

  constructor(options: ResponseParsingOptions = {}) {
    this.options = {
      extractConfidence: options.extractConfidence ?? true,
      defaultConfidence: options.defaultConfidence ?? 0.8,
      maxContentLength: options.maxContentLength ?? 50000,
      includeRawResponse: options.includeRawResponse ?? false
    };
  }

  /**
   * Parses a raw provider response into standardized format
   */
  public abstract parseResponse(
    rawResponse: any,
    providerName: string,
    startTime: number
  ): LLMResponse;

  /**
   * Creates a standardized LLMResponse object
   */
  protected createStandardResponse(
    parsed: ParsedResponse,
    providerName: string,
    startTime: number,
    rawResponse?: any
  ): LLMResponse {
    const responseTime = Date.now() - startTime;
    
    // Truncate content if it exceeds max length
    const content = this.truncateContent(parsed.content);
    
    // Generate unique response ID
    const id = this.generateResponseId(providerName, startTime);

    const response: LLMResponse = {
      id,
      content,
      confidence: this.normalizeConfidence(parsed.confidence),
      tokensUsed: Math.max(0, Math.floor(parsed.tokensUsed)),
      responseTime,
      model: providerName,
      timestamp: new Date(),
      metadata: {
        ...parsed.metadata,
        ...(this.options.includeRawResponse ? { rawResponse } : {})
      }
    };

    return response;
  }

  /**
   * Extracts content from various response formats
   */
  protected extractContent(response: any): string {
    // Handle different response structures
    if (typeof response === 'string') {
      return response;
    }

    // OpenAI format
    if (response.choices?.[0]?.message?.content) {
      return response.choices[0].message.content;
    }

    // Anthropic format
    if (response.content?.[0]?.text) {
      return response.content[0].text;
    }

    // Google format
    if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.candidates[0].content.parts[0].text;
    }

    // Generic content field
    if (response.content) {
      return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    }

    // Text field
    if (response.text) {
      return response.text;
    }

    // Response field
    if (response.response) {
      return response.response;
    }

    // Fallback: stringify the entire response
    return JSON.stringify(response);
  }

  /**
   * Extracts token usage from various response formats
   */
  protected extractTokenUsage(response: any): number {
    // OpenAI format
    if (response.usage?.total_tokens) {
      return response.usage.total_tokens;
    }

    // Anthropic format
    if (response.usage?.input_tokens && response.usage?.output_tokens) {
      return response.usage.input_tokens + response.usage.output_tokens;
    }

    // Google format
    if (response.usageMetadata?.totalTokenCount) {
      return response.usageMetadata.totalTokenCount;
    }

    // Generic usage field
    if (response.tokens) {
      return response.tokens;
    }

    // Estimate based on content length (rough approximation: 4 chars = 1 token)
    const content = this.extractContent(response);
    return Math.ceil(content.length / 4);
  }

  /**
   * Attempts to extract confidence score from response
   */
  protected extractConfidence(response: any): number {
    if (!this.options.extractConfidence) {
      return this.options.defaultConfidence;
    }

    // Look for explicit confidence fields
    if (typeof response.confidence === 'number') {
      return response.confidence;
    }

    if (typeof response.score === 'number') {
      return response.score;
    }

    // OpenAI logprobs (if available)
    if (response.choices?.[0]?.logprobs?.content?.[0]?.logprob) {
      const logprob = response.choices[0].logprobs.content[0].logprob;
      return Math.exp(logprob); // Convert log probability to probability
    }

    // Google safety ratings as confidence proxy
    if (response.candidates?.[0]?.safetyRatings) {
      const ratings = response.candidates[0].safetyRatings;
      const highConfidenceRatings = ratings.filter((r: any) => r.probability === 'NEGLIGIBLE' || r.probability === 'LOW');
      return highConfidenceRatings.length / ratings.length;
    }

    return this.options.defaultConfidence;
  }

  /**
   * Extracts metadata from response
   */
  protected extractMetadata(response: any): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    // Common metadata fields
    if (response.model) metadata.model = response.model;
    if (response.created) metadata.created = response.created;
    if (response.id) metadata.providerId = response.id;

    // OpenAI specific
    if (response.system_fingerprint) metadata.systemFingerprint = response.system_fingerprint;
    if (response.usage) metadata.usage = response.usage;

    // Anthropic specific
    if (response.stop_reason) metadata.stopReason = response.stop_reason;
    if (response.stop_sequence) metadata.stopSequence = response.stop_sequence;

    // Google specific
    if (response.candidates?.[0]?.finishReason) {
      metadata.finishReason = response.candidates[0].finishReason;
    }
    if (response.usageMetadata) metadata.usageMetadata = response.usageMetadata;

    return metadata;
  }

  /**
   * Normalizes confidence score to 0-1 range
   */
  private normalizeConfidence(confidence: number): number {
    if (confidence < 0) return 0;
    if (confidence > 1) return 1;
    return Math.round(confidence * 1000) / 1000; // Round to 3 decimal places
  }

  /**
   * Truncates content if it exceeds maximum length
   */
  private truncateContent(content: string): string {
    if (content.length <= this.options.maxContentLength) {
      return content;
    }

    const truncated = content.substring(0, this.options.maxContentLength - 3);
    return truncated + '...';
  }

  /**
   * Generates a unique response ID
   */
  private generateResponseId(providerName: string, startTime: number): string {
    const timestamp = startTime.toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${providerName.toLowerCase()}-${timestamp}-${random}`;
  }
}

/**
 * OpenAI Response Parser
 */
export class OpenAIResponseParser extends ResponseParser {
  public parseResponse(rawResponse: any, providerName: string, startTime: number): LLMResponse {
    try {
      const parsed: ParsedResponse = {
        content: this.extractContent(rawResponse),
        tokensUsed: this.extractTokenUsage(rawResponse),
        confidence: this.extractConfidence(rawResponse),
        metadata: this.extractMetadata(rawResponse)
      };

      return this.createStandardResponse(parsed, providerName, startTime, rawResponse);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCause = error instanceof Error ? error : undefined;
      throw new ProviderError(
        `Failed to parse OpenAI response: ${errorMessage}`,
        'RESPONSE_PARSING_ERROR',
        providerName,
        errorCause
      );
    }
  }
}

/**
 * Anthropic Response Parser
 */
export class AnthropicResponseParser extends ResponseParser {
  public parseResponse(rawResponse: any, providerName: string, startTime: number): LLMResponse {
    try {
      const parsed: ParsedResponse = {
        content: this.extractContent(rawResponse),
        tokensUsed: this.extractTokenUsage(rawResponse),
        confidence: this.extractConfidence(rawResponse),
        metadata: this.extractMetadata(rawResponse)
      };

      return this.createStandardResponse(parsed, providerName, startTime, rawResponse);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCause = error instanceof Error ? error : undefined;
      throw new ProviderError(
        `Failed to parse Anthropic response: ${errorMessage}`,
        'RESPONSE_PARSING_ERROR',
        providerName,
        errorCause
      );
    }
  }
}

/**
 * Google Response Parser
 */
export class GoogleResponseParser extends ResponseParser {
  public parseResponse(rawResponse: any, providerName: string, startTime: number): LLMResponse {
    try {
      const parsed: ParsedResponse = {
        content: this.extractContent(rawResponse),
        tokensUsed: this.extractTokenUsage(rawResponse),
        confidence: this.extractConfidence(rawResponse),
        metadata: this.extractMetadata(rawResponse)
      };

      return this.createStandardResponse(parsed, providerName, startTime, rawResponse);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCause = error instanceof Error ? error : undefined;
      throw new ProviderError(
        `Failed to parse Google response: ${errorMessage}`,
        'RESPONSE_PARSING_ERROR',
        providerName,
        errorCause
      );
    }
  }
}

/**
 * Factory for creating appropriate response parsers
 */
export class ResponseParserFactory {
  private static readonly parsers = new Map<string, new (options?: ResponseParsingOptions) => ResponseParser>([
    ['openai', OpenAIResponseParser],
    ['gpt-4', OpenAIResponseParser],
    ['gpt-4v', OpenAIResponseParser],
    ['gpt-4-vision', OpenAIResponseParser],
    ['anthropic', AnthropicResponseParser],
    ['claude', AnthropicResponseParser],
    ['claude-3', AnthropicResponseParser],
    ['claude-3.5', AnthropicResponseParser],
    ['google', GoogleResponseParser],
    ['gemini', GoogleResponseParser],
    ['gemini-pro', GoogleResponseParser]
  ]);

  /**
   * Creates appropriate parser for provider type
   */
  public static createParser(
    providerType: string,
    options?: ResponseParsingOptions
  ): ResponseParser {
    const normalizedType = providerType.toLowerCase();
    const ParserClass = this.parsers.get(normalizedType);

    if (!ParserClass) {
      // Fallback to OpenAI parser for unknown types
      return new OpenAIResponseParser(options);
    }

    return new ParserClass(options);
  }

  /**
   * Registers a custom parser for a provider type
   */
  public static registerParser(
    providerType: string,
    parserClass: new (options?: ResponseParsingOptions) => ResponseParser
  ): void {
    this.parsers.set(providerType.toLowerCase(), parserClass);
  }

  /**
   * Gets all registered parser types
   */
  public static getRegisteredTypes(): string[] {
    return Array.from(this.parsers.keys());
  }
}