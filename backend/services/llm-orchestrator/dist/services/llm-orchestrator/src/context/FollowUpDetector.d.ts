/**
 * FollowUpDetector Service
 * Detects when queries are follow-ups to previous conversations
 */
import type { ProcessedQuery, ConversationTurn, FollowUpQuery } from '../../../../shared/types/context';
export interface FollowUpDetectionConfig {
    confidenceThreshold: number;
    maxLookbackTurns: number;
    referencePatterns: {
        pronouns: string[];
        temporalWords: string[];
        implicitWords: string[];
        spatialWords: string[];
    };
}
export declare class FollowUpDetectorService {
    private readonly config;
    constructor(config: FollowUpDetectionConfig);
    /**
     * Detects if a query is a follow-up to previous conversation turns
     * @param currentQuery - Current query to analyze
     * @param conversationHistory - Previous conversation turns
     * @returns Promise resolving to follow-up analysis
     */
    detectFollowUp(currentQuery: ProcessedQuery, conversationHistory: ConversationTurn[]): Promise<FollowUpQuery>;
    /**
     * Checks if query contains fallback mechanisms for uncertain follow-up detection
     * @param followUpResult - Follow-up detection result
     * @returns Whether fallback handling should be applied
     */
    shouldApplyFallback(followUpResult: FollowUpQuery): boolean;
    /**
     * Applies fallback handling for uncertain follow-up detection
     * @param followUpResult - Original follow-up result
     * @returns Enhanced follow-up result with fallback handling
     */
    applyFallbackHandling(followUpResult: FollowUpQuery): Promise<FollowUpQuery>;
    private detectPronounReferences;
    private detectTemporalReferences;
    private detectImplicitReferences;
    private detectSpatialReferences;
    private findPronounReferent;
    private isIncompleteQuestion;
    private isConfirmationRequest;
    private enrichQueryWithContext;
    private extractRecentContext;
}
export declare const defaultFollowUpConfig: FollowUpDetectionConfig;
//# sourceMappingURL=FollowUpDetector.d.ts.map