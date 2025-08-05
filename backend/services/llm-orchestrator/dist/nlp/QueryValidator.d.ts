/**
 * QueryValidator - Input validation and sanitization service
 * Prevents XSS, injection attacks, and inappropriate content
 */
import type { ValidationResult } from '@/types/nlp.types';
interface ValidationConfig {
    readonly enableSanitization: boolean;
    readonly maxQueryLength: number;
    readonly blockedPatterns: string[];
}
interface ValidationStats {
    totalValidations: number;
    validQueries: number;
    blockedQueries: number;
    sanitizedQueries: number;
    averageSecurityScore: number;
    flaggedContentTypes: Record<string, number>;
}
export declare class QueryValidator {
    private readonly config;
    private stats;
    private readonly securityPatterns;
    private readonly technicalExceptions;
    constructor(config: ValidationConfig);
    /**
     * Validate and sanitize query input
     * @param queryText - Raw query text from user
     * @returns Validation result with sanitized text and security assessment
     */
    validate(queryText: string): Promise<ValidationResult>;
    /**
     * Create a blocked validation result
     */
    private createBlockedResult;
    /**
     * Check if flagged content is a technical exception
     */
    private isTechnicalException;
    /**
     * Determine severity level for flagged content
     */
    private getSeverityLevel;
    /**
     * Determine required action for flagged content
     */
    private getRequiredAction;
    /**
     * Apply sanitization to flagged content
     */
    private applySanitization;
    /**
     * Perform final sanitization pass
     */
    private performFinalSanitization;
    /**
     * Calculate overall security score (0-1, higher is more secure)
     */
    private calculateSecurityScore;
    /**
     * Update security statistics
     */
    private updateSecurityStats;
    /**
     * Get validation statistics
     */
    getStats(): ValidationStats;
    /**
     * Health check for validator
     */
    healthCheck(): Promise<boolean>;
    /**
     * Add custom blocked pattern
     */
    addBlockedPattern(pattern: string): void;
    /**
     * Remove blocked pattern
     */
    removeBlockedPattern(pattern: string): void;
    /**
     * Get current validation configuration
     */
    getConfig(): ValidationConfig;
}
export {};
//# sourceMappingURL=QueryValidator.d.ts.map