"use strict";
/**
 * Response Parser Utilities
 *
 * Provides utilities for parsing and normalizing responses from different
 * LLM providers into a standardized format.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseParserFactory = exports.GoogleResponseParser = exports.AnthropicResponseParser = exports.OpenAIResponseParser = exports.ResponseParser = void 0;
const LLMProvider_interface_1 = require("./LLMProvider.interface");
/**
 * Base class for provider-specific response parsers
 */
class ResponseParser {
    constructor(options = {}) {
        this.options = {
            extractConfidence: options.extractConfidence ?? true,
            defaultConfidence: options.defaultConfidence ?? 0.8,
            maxContentLength: options.maxContentLength ?? 50000,
            includeRawResponse: options.includeRawResponse ?? false
        };
    }
    /**
     * Creates a standardized LLMResponse object
     */
    createStandardResponse(parsed, providerName, startTime, rawResponse) {
        const responseTime = Date.now() - startTime;
        // Truncate content if it exceeds max length
        const content = this.truncateContent(parsed.content);
        // Generate unique response ID
        const id = this.generateResponseId(providerName, startTime);
        const response = {
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
    extractContent(response) {
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
    extractTokenUsage(response) {
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
    extractConfidence(response) {
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
            const highConfidenceRatings = ratings.filter((r) => r.probability === 'NEGLIGIBLE' || r.probability === 'LOW');
            return highConfidenceRatings.length / ratings.length;
        }
        return this.options.defaultConfidence;
    }
    /**
     * Extracts metadata from response
     */
    extractMetadata(response) {
        const metadata = {};
        // Common metadata fields
        if (response.model)
            metadata.model = response.model;
        if (response.created)
            metadata.created = response.created;
        if (response.id)
            metadata.providerId = response.id;
        // OpenAI specific
        if (response.system_fingerprint)
            metadata.systemFingerprint = response.system_fingerprint;
        if (response.usage)
            metadata.usage = response.usage;
        // Anthropic specific
        if (response.stop_reason)
            metadata.stopReason = response.stop_reason;
        if (response.stop_sequence)
            metadata.stopSequence = response.stop_sequence;
        // Google specific
        if (response.candidates?.[0]?.finishReason) {
            metadata.finishReason = response.candidates[0].finishReason;
        }
        if (response.usageMetadata)
            metadata.usageMetadata = response.usageMetadata;
        return metadata;
    }
    /**
     * Normalizes confidence score to 0-1 range
     */
    normalizeConfidence(confidence) {
        if (confidence < 0)
            return 0;
        if (confidence > 1)
            return 1;
        return Math.round(confidence * 1000) / 1000; // Round to 3 decimal places
    }
    /**
     * Truncates content if it exceeds maximum length
     */
    truncateContent(content) {
        if (content.length <= this.options.maxContentLength) {
            return content;
        }
        const truncated = content.substring(0, this.options.maxContentLength - 3);
        return truncated + '...';
    }
    /**
     * Generates a unique response ID
     */
    generateResponseId(providerName, startTime) {
        const timestamp = startTime.toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `${providerName.toLowerCase()}-${timestamp}-${random}`;
    }
}
exports.ResponseParser = ResponseParser;
/**
 * OpenAI Response Parser
 */
class OpenAIResponseParser extends ResponseParser {
    parseResponse(rawResponse, providerName, startTime) {
        try {
            const parsed = {
                content: this.extractContent(rawResponse),
                tokensUsed: this.extractTokenUsage(rawResponse),
                confidence: this.extractConfidence(rawResponse),
                metadata: this.extractMetadata(rawResponse)
            };
            return this.createStandardResponse(parsed, providerName, startTime, rawResponse);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorCause = error instanceof Error ? error : undefined;
            throw new LLMProvider_interface_1.ProviderError(`Failed to parse OpenAI response: ${errorMessage}`, 'RESPONSE_PARSING_ERROR', providerName, errorCause);
        }
    }
}
exports.OpenAIResponseParser = OpenAIResponseParser;
/**
 * Anthropic Response Parser
 */
class AnthropicResponseParser extends ResponseParser {
    parseResponse(rawResponse, providerName, startTime) {
        try {
            const parsed = {
                content: this.extractContent(rawResponse),
                tokensUsed: this.extractTokenUsage(rawResponse),
                confidence: this.extractConfidence(rawResponse),
                metadata: this.extractMetadata(rawResponse)
            };
            return this.createStandardResponse(parsed, providerName, startTime, rawResponse);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorCause = error instanceof Error ? error : undefined;
            throw new LLMProvider_interface_1.ProviderError(`Failed to parse Anthropic response: ${errorMessage}`, 'RESPONSE_PARSING_ERROR', providerName, errorCause);
        }
    }
}
exports.AnthropicResponseParser = AnthropicResponseParser;
/**
 * Google Response Parser
 */
class GoogleResponseParser extends ResponseParser {
    parseResponse(rawResponse, providerName, startTime) {
        try {
            const parsed = {
                content: this.extractContent(rawResponse),
                tokensUsed: this.extractTokenUsage(rawResponse),
                confidence: this.extractConfidence(rawResponse),
                metadata: this.extractMetadata(rawResponse)
            };
            return this.createStandardResponse(parsed, providerName, startTime, rawResponse);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorCause = error instanceof Error ? error : undefined;
            throw new LLMProvider_interface_1.ProviderError(`Failed to parse Google response: ${errorMessage}`, 'RESPONSE_PARSING_ERROR', providerName, errorCause);
        }
    }
}
exports.GoogleResponseParser = GoogleResponseParser;
/**
 * Factory for creating appropriate response parsers
 */
class ResponseParserFactory {
    /**
     * Creates appropriate parser for provider type
     */
    static createParser(providerType, options) {
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
    static registerParser(providerType, parserClass) {
        this.parsers.set(providerType.toLowerCase(), parserClass);
    }
    /**
     * Gets all registered parser types
     */
    static getRegisteredTypes() {
        return Array.from(this.parsers.keys());
    }
}
exports.ResponseParserFactory = ResponseParserFactory;
ResponseParserFactory.parsers = new Map([
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
//# sourceMappingURL=ResponseParser.js.map