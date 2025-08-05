/**
 * Response Parser Utilities
 *
 * Provides utilities for parsing and normalizing responses from different
 * LLM providers into a standardized format.
 */
import { LLMResponse } from './LLMProvider.interface';
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
export declare abstract class ResponseParser {
    protected readonly options: Required<ResponseParsingOptions>;
    constructor(options?: ResponseParsingOptions);
    /**
     * Parses a raw provider response into standardized format
     */
    abstract parseResponse(rawResponse: any, providerName: string, startTime: number): LLMResponse;
    /**
     * Creates a standardized LLMResponse object
     */
    protected createStandardResponse(parsed: ParsedResponse, providerName: string, startTime: number, rawResponse?: any): LLMResponse;
    /**
     * Extracts content from various response formats
     */
    protected extractContent(response: any): string;
    /**
     * Extracts token usage from various response formats
     */
    protected extractTokenUsage(response: any): number;
    /**
     * Attempts to extract confidence score from response
     */
    protected extractConfidence(response: any): number;
    /**
     * Extracts metadata from response
     */
    protected extractMetadata(response: any): Record<string, unknown>;
    /**
     * Normalizes confidence score to 0-1 range
     */
    private normalizeConfidence;
    /**
     * Truncates content if it exceeds maximum length
     */
    private truncateContent;
    /**
     * Generates a unique response ID
     */
    private generateResponseId;
}
/**
 * OpenAI Response Parser
 */
export declare class OpenAIResponseParser extends ResponseParser {
    parseResponse(rawResponse: any, providerName: string, startTime: number): LLMResponse;
}
/**
 * Anthropic Response Parser
 */
export declare class AnthropicResponseParser extends ResponseParser {
    parseResponse(rawResponse: any, providerName: string, startTime: number): LLMResponse;
}
/**
 * Google Response Parser
 */
export declare class GoogleResponseParser extends ResponseParser {
    parseResponse(rawResponse: any, providerName: string, startTime: number): LLMResponse;
}
/**
 * Factory for creating appropriate response parsers
 */
export declare class ResponseParserFactory {
    private static readonly parsers;
    /**
     * Creates appropriate parser for provider type
     */
    static createParser(providerType: string, options?: ResponseParsingOptions): ResponseParser;
    /**
     * Registers a custom parser for a provider type
     */
    static registerParser(providerType: string, parserClass: new (options?: ResponseParsingOptions) => ResponseParser): void;
    /**
     * Gets all registered parser types
     */
    static getRegisteredTypes(): string[];
}
//# sourceMappingURL=ResponseParser.d.ts.map