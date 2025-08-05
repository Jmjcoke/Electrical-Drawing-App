/**
 * Symbol Validator
 *
 * Validation system using electrical engineering principles
 * and false positive filtering for symbol detection
 */
import { DetectedSymbol, ElectricalSymbolType, SymbolCategory } from '../../../../shared/types/symbol-detection.types';
export interface ValidationRule {
    name: string;
    description: string;
    validate: (symbol: DetectedSymbol, context: ValidationContext) => ValidationResult;
    severity: 'error' | 'warning' | 'info';
    category: 'electrical' | 'geometric' | 'contextual';
}
export interface ValidationResult {
    isValid: boolean;
    confidence: number;
    issues: string[];
    suggestions: string[];
}
export interface ValidationContext {
    allSymbols: DetectedSymbol[];
    imageBuffer: Buffer;
    imageWidth: number;
    imageHeight: number;
    pageNumber: number;
}
export interface CircuitValidationRules {
    minDistance: number;
    maxDistance: number;
    allowedConnections: Record<ElectricalSymbolType, ElectricalSymbolType[]>;
    forbiddenPlacements: Record<ElectricalSymbolType, SymbolCategory[]>;
}
export declare class SymbolValidator {
    private validationRules;
    private circuitRules;
    constructor();
    /**
     * Validate a symbol using electrical engineering principles
     */
    validateSymbol(symbol: DetectedSymbol, allSymbols: DetectedSymbol[], imageBuffer: Buffer): Promise<number>;
    /**
     * Filter false positives from detected symbols
     */
    filterFalsePositives(symbols: DetectedSymbol[], imageBuffer: Buffer): Promise<DetectedSymbol[]>;
    /**
     * Detect if a symbol is likely a false positive
     */
    private detectFalsePositive;
    /**
     * Check if symbol is at image edge
     */
    private isAtImageEdge;
    /**
     * Find symbols that overlap with the given symbol
     */
    private findOverlappingSymbols;
    /**
     * Check for inconsistent geometric properties
     */
    private hasInconsistentGeometry;
    /**
     * Check if symbol is likely misclassified text
     */
    private isLikelyText;
    /**
     * Validate circuit coherence across all symbols
     */
    private validateCircuitCoherence;
    /**
     * Find symbols near the given symbol
     */
    private findNearbySymbols;
    /**
     * Check if two symbols can validly appear together
     */
    private isValidSymbolCombination;
    /**
     * Check if symbol violates circuit rules
     */
    private violatesCircuitRules;
    /**
     * Initialize validation rules
     */
    private initializeValidationRules;
    /**
     * Initialize circuit validation rules
     */
    private initializeCircuitRules;
    /**
     * Get validation statistics
     */
    getValidationStats(symbols: DetectedSymbol[]): {
        totalSymbols: number;
        validatedSymbols: number;
        averageValidationScore: number;
        ruleViolations: number;
    };
}
//# sourceMappingURL=symbol-validator.d.ts.map