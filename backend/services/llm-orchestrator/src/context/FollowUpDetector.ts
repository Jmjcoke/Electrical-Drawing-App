/**
 * FollowUpDetector Service
 * Detects when queries are follow-ups to previous conversations
 */

import type {
  ProcessedQuery,
  ConversationTurn,
  FollowUpQuery,
  Reference
} from '../../../../shared/types/context';

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

export class FollowUpDetectorService {
  private readonly config: FollowUpDetectionConfig;

  constructor(config: FollowUpDetectionConfig) {
    this.config = config;
  }

  /**
   * Detects if a query is a follow-up to previous conversation turns
   * @param currentQuery - Current query to analyze
   * @param conversationHistory - Previous conversation turns
   * @returns Promise resolving to follow-up analysis
   */
  async detectFollowUp(
    currentQuery: ProcessedQuery,
    conversationHistory: ConversationTurn[]
  ): Promise<FollowUpQuery> {
    const detectedReferences: Reference[] = [];
    let confidence = 0;
    const reasoning: string[] = [];

    // Skip if no conversation history
    if (conversationHistory.length === 0) {
      return {
        originalQuery: currentQuery.originalText,
        detectedReferences: [],
        contextualEnrichment: currentQuery.originalText,
        confidence: 0,
        detectionReasoning: 'No conversation history available'
      };
    }

    // Analyze recent turns (limited by config)
    const recentTurns = conversationHistory
      .slice(-this.config.maxLookbackTurns)
      .reverse(); // Most recent first

    // 1. Pronoun Reference Detection
    const pronounReferences = this.detectPronounReferences(currentQuery, recentTurns);
    detectedReferences.push(...pronounReferences);

    if (pronounReferences.length > 0) {
      confidence += 0.4;
      reasoning.push(`Found ${pronounReferences.length} pronoun reference(s)`);
    }

    // 2. Temporal Reference Detection
    const temporalReferences = this.detectTemporalReferences(currentQuery, recentTurns);
    detectedReferences.push(...temporalReferences);

    if (temporalReferences.length > 0) {
      confidence += 0.3;
      reasoning.push(`Found ${temporalReferences.length} temporal reference(s)`);
    }

    // 3. Implicit Reference Detection
    const implicitReferences = this.detectImplicitReferences(currentQuery, recentTurns);
    detectedReferences.push(...implicitReferences);

    if (implicitReferences.length > 0) {
      confidence += 0.25;
      reasoning.push(`Found ${implicitReferences.length} implicit reference(s)`);
    }

    // 4. Spatial Reference Detection
    const spatialReferences = this.detectSpatialReferences(currentQuery, recentTurns);
    detectedReferences.push(...spatialReferences);

    if (spatialReferences.length > 0) {
      confidence += 0.2;
      reasoning.push(`Found ${spatialReferences.length} spatial reference(s)`);
    }

    // 5. Check for incomplete questions
    if (this.isIncompleteQuestion(currentQuery)) {
      confidence += 0.3;
      reasoning.push('Query appears incomplete, likely continuation');
    }

    // 6. Check for confirmation/clarification patterns
    if (this.isConfirmationRequest(currentQuery)) {
      confidence += 0.35;
      reasoning.push('Query is a confirmation or clarification request');
    }

    // Normalize confidence to 0-1 range
    confidence = Math.min(1, confidence);

    // Create contextual enrichment
    const contextualEnrichment = await this.enrichQueryWithContext(
      currentQuery,
      detectedReferences,
      recentTurns
    );

    return {
      originalQuery: currentQuery.originalText,
      detectedReferences,
      contextualEnrichment,
      confidence,
      detectionReasoning: reasoning.join('; ')
    };
  }

  /**
   * Checks if query contains fallback mechanisms for uncertain follow-up detection
   * @param followUpResult - Follow-up detection result
   * @returns Whether fallback handling should be applied
   */
  shouldApplyFallback(followUpResult: FollowUpQuery): boolean {
    return followUpResult.confidence < this.config.confidenceThreshold;
  }

  /**
   * Applies fallback handling for uncertain follow-up detection
   * @param followUpResult - Original follow-up result
   * @returns Enhanced follow-up result with fallback handling
   */
  async applyFallbackHandling(followUpResult: FollowUpQuery): Promise<FollowUpQuery> {
    return {
      ...followUpResult,
      contextualEnrichment: followUpResult.originalQuery, // Use original query as-is
      detectionReasoning: `${followUpResult.detectionReasoning}; Applied fallback due to low confidence`
    };
  }

  // Private helper methods

  private detectPronounReferences(
    query: ProcessedQuery,
    recentTurns: ConversationTurn[]
  ): Reference[] {
    const references: Reference[] = [];
    const queryWords = query.cleanedText.toLowerCase().split(/\s+/);

    for (const pronoun of this.config.referencePatterns.pronouns) {
      if (queryWords.includes(pronoun.toLowerCase())) {
        // Find potential referent in recent turns
        const referent = this.findPronounReferent(pronoun, recentTurns);
        
        const reference: Reference = {
          type: 'pronoun',
          text: pronoun,
          sourceContext: query.originalText,
          confidence: referent ? 0.8 : 0.5,
          ...(referent && { resolvedEntity: referent })
        };
        
        references.push(reference);
      }
    }

    return references;
  }

  private detectTemporalReferences(
    query: ProcessedQuery,
    _recentTurns: ConversationTurn[]
  ): Reference[] {
    const references: Reference[] = [];
    const queryWords = query.cleanedText.toLowerCase().split(/\s+/);

    for (const temporalWord of this.config.referencePatterns.temporalWords) {
      if (queryWords.includes(temporalWord.toLowerCase())) {
        references.push({
          type: 'temporal',
          text: temporalWord,
          sourceContext: query.originalText,
          confidence: 0.7
        });
      }
    }

    return references;
  }

  private detectImplicitReferences(
    query: ProcessedQuery,
    _recentTurns: ConversationTurn[]
  ): Reference[] {
    const references: Reference[] = [];
    const queryWords = query.cleanedText.toLowerCase().split(/\s+/);

    for (const implicitWord of this.config.referencePatterns.implicitWords) {
      if (queryWords.includes(implicitWord.toLowerCase())) {
        references.push({
          type: 'implicit',
          text: implicitWord,
          sourceContext: query.originalText,
          confidence: 0.6
        });
      }
    }

    return references;
  }

  private detectSpatialReferences(
    query: ProcessedQuery,
    _recentTurns: ConversationTurn[]
  ): Reference[] {
    const references: Reference[] = [];
    const queryText = query.cleanedText.toLowerCase();
    const queryWords = queryText.split(/\s+/);

    // Check for individual spatial words
    for (const spatialWord of this.config.referencePatterns.spatialWords) {
      if (queryWords.includes(spatialWord.toLowerCase())) {
        references.push({
          type: 'spatial',
          text: spatialWord,
          sourceContext: query.originalText,
          confidence: 0.65
        });
      }
    }

    // Check for multi-word spatial phrases
    const spatialPhrases = ['next to', 'close to', 'near to', 'on top of', 'underneath'];
    for (const phrase of spatialPhrases) {
      if (queryText.includes(phrase)) {
        references.push({
          type: 'spatial',
          text: phrase,
          sourceContext: query.originalText,
          confidence: 0.7
        });
      }
    }

    return references;
  }

  private findPronounReferent(_pronoun: string, recentTurns: ConversationTurn[]): string | undefined {
    // Simple heuristic: look for nouns in recent responses that could be referents
    for (const turn of recentTurns) {
      // Check response components for potential referents
      for (const component of turn.response.components) {
        if (component.type && component.description) {
          return component.description;
        }
      }

      // Check extracted entities
      for (const entity of turn.query.entities) {
        if (entity.type === 'component' && entity.text) {
          return entity.text;
        }
      }
    }

    return undefined;
  }

  private isIncompleteQuestion(query: ProcessedQuery): boolean {
    const text = query.cleanedText.toLowerCase();
    
    // Check for incomplete patterns
    const incompletePatterns = [
      /^(and|or|but|also)\s/,
      /\?\s*$/, // Ends with just a question mark
      /^(what about|how about|what if)\s/,
      /^(more|tell me more|continue)\s/
    ];

    return incompletePatterns.some(pattern => pattern.test(text)) ||
           text.split(/\s+/).length < 3; // Very short queries often incomplete
  }

  private isConfirmationRequest(query: ProcessedQuery): boolean {
    const text = query.cleanedText.toLowerCase();
    
    const confirmationPatterns = [
      /^(is that|are those|did you|do you|can you|will you)\s/,
      /^(yes|no|ok|okay|right|correct)\s*[?.]?$/,
      /^(confirm|verify|check)\s/,
      /(right\?|correct\?|true\?)$/
    ];

    return confirmationPatterns.some(pattern => pattern.test(text));
  }

  private async enrichQueryWithContext(
    query: ProcessedQuery,
    references: Reference[],
    recentTurns: ConversationTurn[]
  ): Promise<string> {
    if (references.length === 0) {
      return query.originalText;
    }

    let enrichedQuery = query.originalText;
    let hasEnrichment = false;
    
    // Replace pronouns with their referents
    for (const reference of references) {
      if (reference.type === 'pronoun' && reference.resolvedEntity) {
        // Simple replacement (could be more sophisticated)
        const pronounRegex = new RegExp(`\\b${reference.text}\\b`, 'gi');
        const replaced = enrichedQuery.replace(pronounRegex, reference.resolvedEntity);
        if (replaced !== enrichedQuery) {
          enrichedQuery = replaced;
          hasEnrichment = true;
        }
      }
    }

    // Add context from recent turns if needed
    if (references.some(ref => ref.type === 'implicit' || ref.type === 'temporal' || ref.type === 'spatial')) {
      const recentContext = this.extractRecentContext(recentTurns);
      if (recentContext) {
        enrichedQuery = `Context: ${recentContext}. Query: ${enrichedQuery}`;
        hasEnrichment = true;
      }
    }

    // If we have references but no actual enrichment, still mark as enriched
    if (references.length > 0 && !hasEnrichment) {
      const contextSummary = recentTurns.length > 0 ? 
        `Previous discussion about ${recentTurns[0].query.intent.type}` : 
        'Following up on previous query';
      enrichedQuery = `${contextSummary}. ${enrichedQuery}`;
    }

    return enrichedQuery;
  }

  private extractRecentContext(recentTurns: ConversationTurn[]): string {
    if (recentTurns.length === 0) return '';

    const mostRecentTurn = recentTurns[0];
    
    // Extract key information from the most recent turn
    const contextParts: string[] = [];

    // Add query intent
    if (mostRecentTurn.query.intent) {
      contextParts.push(`Previous query was about ${mostRecentTurn.query.intent.type}`);
    }

    // Add key entities
    const entities = mostRecentTurn.query.entities.slice(0, 2); // Top 2 entities
    if (entities.length > 0) {
      const entityTexts = entities.map(e => e.text).join(', ');
      contextParts.push(`discussing ${entityTexts}`);
    }

    // Add response summary if available
    if (mostRecentTurn.response.summary) {
      contextParts.push(mostRecentTurn.response.summary.substring(0, 100));
    }

    return contextParts.join('; ');
  }
}

// Default configuration
export const defaultFollowUpConfig: FollowUpDetectionConfig = {
  confidenceThreshold: 0.6,
  maxLookbackTurns: 3,
  referencePatterns: {
    pronouns: ['it', 'this', 'that', 'these', 'those', 'they', 'them', 'its', 'their'],
    temporalWords: ['now', 'then', 'before', 'after', 'next', 'previous', 'earlier', 'later', 'first', 'last'],
    implicitWords: ['also', 'too', 'additionally', 'furthermore', 'moreover', 'similarly'],
    spatialWords: ['here', 'there', 'above', 'below', 'nearby', 'around', 'beside', 'next', 'to']
  }
};