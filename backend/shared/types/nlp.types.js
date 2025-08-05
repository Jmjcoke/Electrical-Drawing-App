"use strict";
/**
 * NLP-specific TypeScript interfaces for electrical drawing analysis
 * Defines data structures for query processing, intent classification, and context extraction
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NLPErrorCodes = void 0;
// Error Types
var NLPErrorCodes;
(function (NLPErrorCodes) {
    NLPErrorCodes["CLASSIFICATION_FAILED"] = "CLASSIFICATION_FAILED";
    NLPErrorCodes["EXTRACTION_FAILED"] = "EXTRACTION_FAILED";
    NLPErrorCodes["OPTIMIZATION_FAILED"] = "OPTIMIZATION_FAILED";
    NLPErrorCodes["VALIDATION_FAILED"] = "VALIDATION_FAILED";
    NLPErrorCodes["INSUFFICIENT_CONTEXT"] = "INSUFFICIENT_CONTEXT";
    NLPErrorCodes["RATE_LIMITED"] = "RATE_LIMITED";
    NLPErrorCodes["INVALID_INPUT"] = "INVALID_INPUT";
    NLPErrorCodes["PROCESSING_TIMEOUT"] = "PROCESSING_TIMEOUT";
    NLPErrorCodes["MODEL_UNAVAILABLE"] = "MODEL_UNAVAILABLE";
    NLPErrorCodes["CACHE_ERROR"] = "CACHE_ERROR";
})(NLPErrorCodes || (exports.NLPErrorCodes = NLPErrorCodes = {}));
//# sourceMappingURL=nlp.types.js.map