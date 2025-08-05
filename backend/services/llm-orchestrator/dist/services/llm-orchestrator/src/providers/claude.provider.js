"use strict";
/**
 * Anthropic Claude 3.5 Sonnet Provider Implementation
 *
 * Integrates Claude 3.5 Sonnet as a secondary provider in the LLM ensemble,
 * providing advanced visual analysis capabilities for electrical drawings.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeProvider = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const BaseProvider_1 = require("./base/BaseProvider");
const LLMProvider_interface_1 = require("./base/LLMProvider.interface");
/**
 * Anthropic Claude provider implementation
 * Provides vision analysis capabilities using Claude 3.5 Sonnet
 */
class ClaudeProvider extends BaseProvider_1.BaseProvider {
    constructor(config) {
        super(config);
        this.name = 'claude-3-5-sonnet';
        this.version = '20241022';
        this.metadata = {
            name: this.name,
            version: this.version,
            capabilities: {
                supportsVision: true,
                maxImageSize: 5 * 1024 * 1024, // 5MB
                supportedImageFormats: ['jpeg', 'png', 'gif', 'webp'],
                maxPromptLength: 200000,
                supportsStreaming: false
            },
            description: 'Anthropic Claude 3.5 Sonnet for advanced visual analysis of electrical drawings'
        };
        this.claudeConfig = config;
        this.validateClaudeConfig(config);
        this.initializeClient();
    }
    /**
     * Analyzes an image using Claude 3.5 Sonnet
     */
    async analyze(image, prompt, options) {
        return this.executeAnalysis(async () => {
            const startTime = Date.now();
            try {
                // Validate inputs
                this.validateAnalysisInputs(image, prompt);
                // Convert image to base64
                const base64Image = image.toString('base64');
                const mediaType = this.detectMediaType(image);
                // Prepare the message
                const response = await this.client.messages.create({
                    model: this.claudeConfig.model,
                    max_tokens: options?.maxTokens || this.claudeConfig.maxTokens,
                    temperature: options?.temperature || this.claudeConfig.temperature,
                    messages: [{
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: prompt
                                },
                                {
                                    type: 'image',
                                    source: {
                                        type: 'base64',
                                        media_type: mediaType,
                                        data: base64Image
                                    }
                                }
                            ]
                        }]
                });
                // Parse response
                const content = response.content[0];
                if (content.type !== 'text') {
                    throw new LLMProvider_interface_1.AnalysisError('Unexpected response format from Claude', this.name);
                }
                const processingTime = Date.now() - startTime;
                const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
                return {
                    id: `claude_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                    content: content.text,
                    confidence: this.calculateConfidence(content.text, tokensUsed),
                    tokensUsed,
                    responseTime: processingTime,
                    model: response.model,
                    timestamp: new Date(),
                    metadata: {
                        inputTokens: response.usage.input_tokens,
                        outputTokens: response.usage.output_tokens,
                        imageSize: image.length,
                        promptLength: prompt.length,
                        stopReason: response.stop_reason
                    }
                };
            }
            catch (error) {
                throw this.handleClaudeError(error);
            }
        }, options);
    }
    /**
     * Performs health check on Claude API
     */
    async healthCheck() {
        try {
            // Simple test message to verify API connectivity
            const testResponse = await this.client.messages.create({
                model: this.claudeConfig.model,
                max_tokens: 10,
                messages: [{
                        role: 'user',
                        content: 'Hello'
                    }]
            });
            return testResponse.content.length > 0;
        }
        catch (error) {
            console.error('Claude health check failed:', error);
            return false;
        }
    }
    /**
     * Calculates cost for given number of tokens
     */
    getCost(tokens) {
        // Claude 3.5 Sonnet pricing (as of 2024)
        const inputCostPer1K = 0.003; // $0.003 per 1K input tokens
        const outputCostPer1K = 0.015; // $0.015 per 1K output tokens
        // Estimate 70% input, 30% output for cost calculation
        const inputTokens = Math.floor(tokens * 0.7);
        const outputTokens = tokens - inputTokens;
        return (inputTokens / 1000) * inputCostPer1K + (outputTokens / 1000) * outputCostPer1K;
    }
    /**
     * Gets required configuration keys
     */
    getRequiredConfig() {
        return [
            'apiKey',
            'model',
            'maxTokens',
            'temperature'
        ];
    }
    /**
     * Validates Claude-specific configuration
     */
    validateProviderSpecificConfig(config) {
        const claudeConfig = config;
        if (!claudeConfig.model || typeof claudeConfig.model !== 'string') {
            throw new Error('Model is required and must be a string');
        }
        if (!claudeConfig.model.startsWith('claude-3')) {
            throw new Error('Model must be a Claude 3 model');
        }
        if (typeof claudeConfig.maxTokens !== 'number' || claudeConfig.maxTokens <= 0) {
            throw new Error('maxTokens must be a positive number');
        }
        if (typeof claudeConfig.temperature !== 'number' || claudeConfig.temperature < 0 || claudeConfig.temperature > 1) {
            throw new Error('temperature must be a number between 0 and 1');
        }
        return true;
    }
    /**
     * Initializes the Anthropic client
     */
    initializeClient() {
        try {
            this.client = new sdk_1.default({
                apiKey: this.config.apiKey,
                timeout: this.config.timeout || 30000,
                maxRetries: this.config.maxRetries || 3,
                defaultHeaders: this.claudeConfig.anthropicVersion ? {
                    'anthropic-version': this.claudeConfig.anthropicVersion
                } : undefined
            });
        }
        catch (error) {
            throw new LLMProvider_interface_1.ConfigurationError(`Failed to initialize Anthropic client: ${error instanceof Error ? error.message : String(error)}`, this.name, error instanceof Error ? error : undefined);
        }
    }
    /**
     * Validates Claude-specific configuration
     */
    validateClaudeConfig(config) {
        if (!config.model) {
            throw new LLMProvider_interface_1.ConfigurationError('Model is required for Claude provider', this.name);
        }
        if (!config.model.startsWith('claude-3')) {
            throw new LLMProvider_interface_1.ConfigurationError('Only Claude 3 models are supported', this.name);
        }
        if (config.maxTokens <= 0 || config.maxTokens > 8192) {
            throw new LLMProvider_interface_1.ConfigurationError('maxTokens must be between 1 and 8192', this.name);
        }
        if (config.temperature < 0 || config.temperature > 1) {
            throw new LLMProvider_interface_1.ConfigurationError('temperature must be between 0 and 1', this.name);
        }
    }
    /**
     * Validates analysis inputs
     */
    validateAnalysisInputs(image, prompt) {
        if (!image || image.length === 0) {
            throw new LLMProvider_interface_1.AnalysisError('Image buffer is required', this.name);
        }
        if (image.length > this.metadata.capabilities.maxImageSize) {
            throw new LLMProvider_interface_1.AnalysisError(`Image size (${image.length} bytes) exceeds maximum allowed size (${this.metadata.capabilities.maxImageSize} bytes)`, this.name);
        }
        if (!prompt || prompt.trim().length === 0) {
            throw new LLMProvider_interface_1.AnalysisError('Prompt is required', this.name);
        }
        if (prompt.length > this.metadata.capabilities.maxPromptLength) {
            throw new LLMProvider_interface_1.AnalysisError(`Prompt length (${prompt.length}) exceeds maximum allowed length (${this.metadata.capabilities.maxPromptLength})`, this.name);
        }
    }
    /**
     * Detects media type from image buffer
     */
    detectMediaType(buffer) {
        // Check file signature
        const signature = buffer.subarray(0, 4);
        if (signature[0] === 0xFF && signature[1] === 0xD8) {
            return 'image/jpeg';
        }
        if (signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E && signature[3] === 0x47) {
            return 'image/png';
        }
        if (signature[0] === 0x47 && signature[1] === 0x49 && signature[2] === 0x46) {
            return 'image/gif';
        }
        if (signature.subarray(0, 4).toString() === 'RIFF' || signature.subarray(8, 12).toString() === 'WEBP') {
            return 'image/webp';
        }
        // Default to JPEG if can't detect
        return 'image/jpeg';
    }
    /**
     * Calculates confidence score based on response characteristics
     */
    calculateConfidence(content, tokensUsed) {
        let confidence = 0.7; // Base confidence for Claude
        // Longer, more detailed responses tend to be more confident
        if (content.length > 200)
            confidence += 0.1;
        if (content.length > 500)
            confidence += 0.05;
        // Check for electrical analysis keywords
        const electricalKeywords = /circuit|component|electrical|voltage|current|resistor|capacitor|schematic|diagram|wire|connection/gi;
        const matches = content.match(electricalKeywords);
        if (matches && matches.length > 0) {
            confidence += Math.min(matches.length * 0.02, 0.1);
        }
        // Check for specific component identifications
        if (/identified|found|detected|located/i.test(content)) {
            confidence += 0.05;
        }
        // Higher token usage may indicate more thorough analysis
        if (tokensUsed > 1000)
            confidence += 0.05;
        return Math.min(confidence, 1.0);
    }
    /**
     * Handles Claude-specific errors
     */
    handleClaudeError(error) {
        if (error instanceof LLMProvider_interface_1.ProviderError) {
            return error;
        }
        // Handle Anthropic SDK errors
        if (error.type) {
            switch (error.type) {
                case 'authentication_error':
                    return new LLMProvider_interface_1.ConfigurationError(`Authentication failed: ${error.message}`, this.name, error);
                case 'permission_error':
                    return new LLMProvider_interface_1.ConfigurationError(`Permission denied: ${error.message}`, this.name, error);
                case 'rate_limit_error': {
                    const retryAfter = error.details?.retry_after || 60;
                    return new LLMProvider_interface_1.RateLimitError(`Rate limit exceeded: ${error.message}`, this.name, retryAfter, error);
                }
                case 'request_too_large':
                    return new LLMProvider_interface_1.AnalysisError(`Request too large: ${error.message}`, this.name, error);
                case 'api_error':
                default:
                    return new LLMProvider_interface_1.AnalysisError(`Claude API error: ${error.message}`, this.name, error);
            }
        }
        // Handle HTTP status codes
        if (error.status) {
            switch (error.status) {
                case 400:
                    return new LLMProvider_interface_1.AnalysisError(`Bad request: ${error.message}`, this.name, error);
                case 401:
                    return new LLMProvider_interface_1.ConfigurationError(`Unauthorized: ${error.message}`, this.name, error);
                case 403:
                    return new LLMProvider_interface_1.ConfigurationError(`Forbidden: ${error.message}`, this.name, error);
                case 429:
                    return new LLMProvider_interface_1.RateLimitError(`Rate limit exceeded: ${error.message}`, this.name, 60, error);
                case 500:
                case 502:
                case 503:
                case 504:
                    return new LLMProvider_interface_1.AnalysisError(`Server error: ${error.message}`, this.name, error);
                default:
                    return new LLMProvider_interface_1.AnalysisError(`HTTP ${error.status}: ${error.message}`, this.name, error);
            }
        }
        // Default error handling
        return new LLMProvider_interface_1.AnalysisError(`Claude provider error: ${error instanceof Error ? error.message : String(error)}`, this.name, error instanceof Error ? error : undefined);
    }
}
exports.ClaudeProvider = ClaudeProvider;
//# sourceMappingURL=claude.provider.js.map