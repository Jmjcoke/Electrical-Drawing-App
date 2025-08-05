"use strict";
/**
 * OpenAI GPT-4 Vision provider implementation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
const openai_1 = __importDefault(require("openai"));
class OpenAIProvider {
    constructor(config) {
        this.config = config;
        this.client = new openai_1.default({
            apiKey: config.apiKey,
            baseURL: config.baseUrl,
            timeout: config.timeout || 30000,
            maxRetries: config.retryAttempts || 3,
        });
    }
    async analyze(images, prompt, options = {}) {
        const startTime = Date.now();
        const analysisId = this.generateAnalysisId();
        try {
            // Validate inputs
            this.validateInputs(images, prompt);
            // Convert images to base64
            const imageMessages = images.map(buffer => ({
                type: 'image_url',
                image_url: {
                    url: `data:image/jpeg;base64,${buffer.toString('base64')}`,
                    detail: 'high'
                }
            }));
            // Prepare the message
            const messages = [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: prompt
                        },
                        ...imageMessages
                    ]
                }
            ];
            // Call OpenAI API
            const response = await this.client.chat.completions.create({
                model: options.model || this.config.model || 'gpt-4-vision-preview',
                messages,
                max_tokens: options.maxTokens || 4096,
                temperature: options.temperature || 0.1,
            });
            const processingTime = Date.now() - startTime;
            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new ProviderError('No content in OpenAI response', 'openai', 'API_ERROR', false);
            }
            // Calculate confidence based on response characteristics
            const confidence = this.calculateConfidence(content, response);
            return {
                analysisId,
                result: content,
                confidence,
                processingTime,
                provider: 'openai',
                timestamp: new Date(),
                metadata: {
                    model: response.model,
                    tokenUsage: response.usage ? {
                        prompt: response.usage.prompt_tokens,
                        completion: response.usage.completion_tokens,
                        total: response.usage.total_tokens,
                    } : undefined,
                    imageCount: images.length,
                    promptLength: prompt.length,
                }
            };
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            if (error instanceof openai_1.default.APIError) {
                throw new ProviderError(`OpenAI API error: ${error.message}`, 'openai', this.mapOpenAIErrorCode(error), this.isRetryableError(error), { status: error.status, code: error.code });
            }
            throw new ProviderError(`OpenAI provider error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'openai', 'API_ERROR', false, { processingTime });
        }
    }
    validateConfiguration() {
        return !!(this.config.apiKey && this.config.apiKey.startsWith('sk-'));
    }
    getCapabilities() {
        return {
            supportsVision: true,
            maxImageSize: 20 * 1024 * 1024, // 20MB
            maxImagesPerRequest: 4,
            supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
            maxTokens: 4096,
            costPerToken: 0.00003, // Approximate cost per token
        };
    }
    getName() {
        return 'openai';
    }
    async healthCheck() {
        try {
            // Simple API call to check connectivity
            await this.client.models.list();
            return true;
        }
        catch (error) {
            console.error('OpenAI health check failed:', error);
            return false;
        }
    }
    validateInputs(images, prompt) {
        if (!images || images.length === 0) {
            throw new ProviderError('No images provided', 'openai', 'INVALID_REQUEST', false);
        }
        if (images.length > this.getCapabilities().maxImagesPerRequest) {
            throw new ProviderError(`Too many images: ${images.length}. Maximum allowed: ${this.getCapabilities().maxImagesPerRequest}`, 'openai', 'INVALID_REQUEST', false);
        }
        if (!prompt || prompt.trim().length === 0) {
            throw new ProviderError('Empty prompt provided', 'openai', 'INVALID_REQUEST', false);
        }
        // Check image sizes
        const maxSize = this.getCapabilities().maxImageSize;
        for (let i = 0; i < images.length; i++) {
            if (images[i].length > maxSize) {
                throw new ProviderError(`Image ${i + 1} too large: ${images[i].length} bytes. Maximum: ${maxSize} bytes`, 'openai', 'INVALID_REQUEST', false);
            }
        }
    }
    generateAnalysisId() {
        return `openai_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }
    calculateConfidence(content, response) {
        // Basic confidence calculation based on response characteristics
        let confidence = 0.5; // Base confidence
        // Longer responses tend to be more confident
        if (content.length > 100)
            confidence += 0.1;
        if (content.length > 500)
            confidence += 0.1;
        // Specific indicators in electrical analysis responses
        if (/circuit|component|electrical|voltage|current|resistor|capacitor|schematic/i.test(content)) {
            confidence += 0.2;
        }
        // High-quality model responses
        if (response.model.includes('gpt-4')) {
            confidence += 0.1;
        }
        return Math.min(confidence, 1.0);
    }
    mapOpenAIErrorCode(error) {
        if (error.status === 429)
            return 'RATE_LIMITED';
        if (error.status === 400)
            return 'INVALID_REQUEST';
        if (error.status === 401)
            return 'CONFIGURATION_ERROR';
        if (error.status === 408 || error.status === 504)
            return 'TIMEOUT';
        return 'API_ERROR';
    }
    isRetryableError(error) {
        // Retry on rate limits, timeouts, and server errors
        return error.status === 429 || error.status === 408 || error.status === 504 || error.status >= 500;
    }
}
exports.OpenAIProvider = OpenAIProvider;
// Helper class for ProviderError
class ProviderError extends Error {
    constructor(message, provider, code, retryable, details) {
        super(message);
        this.provider = provider;
        this.code = code;
        this.retryable = retryable;
        this.details = details;
        this.name = 'ProviderError';
    }
}
//# sourceMappingURL=openai.provider.js.map