"use strict";
/**
 * Symbol Detection Types
 *
 * TypeScript type definitions for electrical symbol detection system
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MLClassificationError = exports.PatternMatchingError = exports.ImageProcessingError = exports.SymbolDetectionError = void 0;
// Error types for symbol detection
class SymbolDetectionError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'SymbolDetectionError';
    }
}
exports.SymbolDetectionError = SymbolDetectionError;
class ImageProcessingError extends SymbolDetectionError {
    constructor(message, details) {
        super(message, 'IMAGE_PROCESSING_ERROR', details);
        this.name = 'ImageProcessingError';
    }
}
exports.ImageProcessingError = ImageProcessingError;
class PatternMatchingError extends SymbolDetectionError {
    constructor(message, details) {
        super(message, 'PATTERN_MATCHING_ERROR', details);
        this.name = 'PatternMatchingError';
    }
}
exports.PatternMatchingError = PatternMatchingError;
class MLClassificationError extends SymbolDetectionError {
    constructor(message, details) {
        super(message, 'ML_CLASSIFICATION_ERROR', details);
        this.name = 'MLClassificationError';
    }
}
exports.MLClassificationError = MLClassificationError;
//# sourceMappingURL=symbol-detection.types.js.map