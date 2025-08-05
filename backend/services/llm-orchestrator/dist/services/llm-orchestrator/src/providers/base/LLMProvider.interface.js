"use strict";
/**
 * Abstract LLM Provider Interface
 *
 * This interface defines the contract that all LLM providers must implement
 * to ensure consistent behavior across the ensemble system.
 *
 * @interface LLMProvider
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisError = exports.RateLimitError = exports.ConfigurationError = exports.ProviderError = void 0;
/**
 * Provider-specific error types
 */
class ProviderError extends Error {
    constructor(message, code, provider, originalError) {
        super(message);
        this.code = code;
        this.provider = provider;
        this.originalError = originalError;
        this.name = 'ProviderError';
    }
}
exports.ProviderError = ProviderError;
class ConfigurationError extends ProviderError {
    constructor(message, provider, originalError) {
        super(message, 'CONFIGURATION_ERROR', provider, originalError);
        this.name = 'ConfigurationError';
    }
}
exports.ConfigurationError = ConfigurationError;
class RateLimitError extends ProviderError {
    constructor(message, provider, retryAfter, originalError) {
        super(message, 'RATE_LIMIT_ERROR', provider, originalError);
        this.retryAfter = retryAfter;
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
class AnalysisError extends ProviderError {
    constructor(message, provider, originalError) {
        super(message, 'ANALYSIS_ERROR', provider, originalError);
        this.name = 'AnalysisError';
    }
}
exports.AnalysisError = AnalysisError;
//# sourceMappingURL=LLMProvider.interface.js.map