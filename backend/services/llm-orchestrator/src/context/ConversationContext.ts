/**
 * ConversationContext Service
 * Main context management service for handling query-response history and contextual awareness
 */

import { randomUUID } from 'crypto';
import type {
  ConversationContext,
  ConversationTurn,
  CumulativeContext,
  ProcessedQuery,
  AnalysisResult,
  ContextStorageConfig,
  ContextValidationResult
} from '../../../../shared/types/context';

export class ConversationContextService {
  private readonly config: ContextStorageConfig;
  private readonly contextCache = new Map<string, ConversationContext>();

  constructor(config: ContextStorageConfig) {
    this.config = config;
  }

  /**
   * Creates a new conversation context for a session
   * @param sessionId - Session identifier
   * @returns Promise resolving to new conversation context
   */
  async createContext(sessionId: string): Promise<ConversationContext> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.expirationHours * 60 * 60 * 1000);

    const context: ConversationContext = {
      id: randomUUID(),
      sessionId,
      conversationThread: [],
      cumulativeContext: {
        extractedEntities: new Map(),
        documentContext: [],
        topicProgression: [],
        keyInsights: [],
        relationshipMap: []
      },
      lastUpdated: now,
      expiresAt,
      metadata: {
        createdAt: now,
        lastAccessed: now,
        accessCount: 0,
        compressionLevel: 0,
        tags: []
      }
    };

    // Cache the context
    this.contextCache.set(context.id, context);

    return context;
  }

  /**
   * Retrieves conversation context by session ID
   * @param sessionId - Session identifier
   * @returns Promise resolving to conversation context or null if not found
   */
  async getContextBySessionId(sessionId: string): Promise<ConversationContext | null> {
    // First check cache
    for (const context of this.contextCache.values()) {
      if (context.sessionId === sessionId && !this.isExpired(context)) {
        await this.updateAccessMetadata(context.id);
        return this.contextCache.get(context.id) || null;
      }
    }

    // If not in cache, would query database here
    // For now, return null (database integration will be added)
    return null;
  }

  /**
   * Adds a new conversation turn to the context
   * @param contextId - Context identifier
   * @param query - Processed query
   * @param response - Analysis result
   * @param followUpDetected - Whether this was detected as a follow-up
   * @returns Promise resolving to updated context
   */
  async addTurn(
    contextId: string,
    query: ProcessedQuery,
    response: AnalysisResult,
    followUpDetected: boolean = false
  ): Promise<ConversationContext> {
    const context = this.contextCache.get(contextId);
    if (!context) {
      throw new Error(`Context not found: ${contextId}`);
    }

    if (this.isExpired(context)) {
      throw new Error(`Context expired: ${contextId}`);
    }

    const turn: ConversationTurn = {
      id: randomUUID(),
      turnNumber: context.conversationThread.length + 1,
      query,
      response,
      contextContributions: this.extractContextContributions(query, response),
      followUpDetected,
      timestamp: new Date()
    };

    // Ensure lastUpdated is always newer than the original context
    const now = new Date();
    const lastUpdated = now.getTime() > context.lastUpdated.getTime() ? now : new Date(context.lastUpdated.getTime() + 1);

    const updatedContext: ConversationContext = {
      ...context,
      conversationThread: [...context.conversationThread, turn],
      cumulativeContext: await this.updateCumulativeContext(context.cumulativeContext, turn),
      lastUpdated
    };

    // Check if compression is needed
    if (updatedContext.conversationThread.length >= this.config.maxTurnsPerContext) {
      return await this.compressContext(updatedContext);
    }

    // Update cache
    this.contextCache.set(contextId, updatedContext);

    return updatedContext;
  }

  /**
   * Retrieves relevant context for a new query
   * @param sessionId - Session identifier
   * @param currentQuery - Current query text
   * @param maxTurns - Maximum number of turns to retrieve
   * @returns Promise resolving to relevant conversation turns
   */
  async getRelevantContext(
    sessionId: string,
    currentQuery: string,
    maxTurns: number = 5
  ): Promise<ConversationTurn[]> {
    const context = await this.getContextBySessionId(sessionId);
    if (!context) {
      return [];
    }

    // Simple relevance scoring based on query similarity and recency
    const scoredTurns = context.conversationThread
      .map(turn => ({
        turn,
        relevanceScore: this.calculateRelevanceScore(turn, currentQuery)
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxTurns)
      .map(scored => scored.turn);

    return scoredTurns;
  }

  /**
   * Resets conversation context for a session
   * @param sessionId - Session identifier
   * @returns Promise resolving to new clean context
   */
  async resetContext(sessionId: string): Promise<ConversationContext> {
    // Remove existing context from cache
    for (const [contextId, context] of this.contextCache.entries()) {
      if (context.sessionId === sessionId) {
        this.contextCache.delete(contextId);
        break;
      }
    }

    // Create new context
    return await this.createContext(sessionId);
  }

  /**
   * Validates context integrity and consistency
   * @param context - Context to validate
   * @returns Validation result with errors and warnings
   */
  validateContext(context: ConversationContext): ContextValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check basic structure
    if (!context.id || !context.sessionId) {
      errors.push('Missing required context identifiers');
    }

    if (context.expiresAt < new Date()) {
      warnings.push('Context has expired');
    }

    // Validate conversation thread integrity
    for (let i = 0; i < context.conversationThread.length; i++) {
      const turn = context.conversationThread[i];
      if (turn.turnNumber !== i + 1) {
        errors.push(`Turn number mismatch at position ${i}`);
      }
    }

    // Check cumulative context consistency
    if (context.cumulativeContext.extractedEntities.size === 0 && 
        context.conversationThread.length > 0) {
      warnings.push('No entities extracted despite having conversation turns');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Cleans up expired contexts
   * @returns Promise resolving to number of contexts cleaned up
   */
  async cleanupExpiredContexts(): Promise<number> {
    let cleanedCount = 0;
    const now = new Date();

    for (const [contextId, context] of this.contextCache.entries()) {
      if (context.expiresAt < now) {
        this.contextCache.delete(contextId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  // Private helper methods

  private isExpired(context: ConversationContext): boolean {
    return context.expiresAt < new Date();
  }

  private async updateAccessMetadata(contextId: string): Promise<void> {
    const context = this.contextCache.get(contextId);
    if (context) {
      // Ensure lastAccessed is always newer than the original
      const now = new Date();
      const lastAccessed = now.getTime() > context.metadata.lastAccessed.getTime() 
        ? now 
        : new Date(context.metadata.lastAccessed.getTime() + 1);

      const updatedContext: ConversationContext = {
        ...context,
        metadata: {
          ...context.metadata,
          lastAccessed,
          accessCount: context.metadata.accessCount + 1
        }
      };
      this.contextCache.set(contextId, updatedContext);
    }
  }

  private extractContextContributions(query: ProcessedQuery, response: AnalysisResult): string[] {
    const contributions: string[] = [];

    // Extract entities from query
    query.entities.forEach(entity => {
      contributions.push(`entity:${entity.type}:${entity.text}`);
    });

    // Extract components from response
    response.components.forEach(component => {
      contributions.push(`component:${component.type}:${component.description}`);
    });

    // Add query intent
    contributions.push(`intent:${query.intent.type}`);

    return contributions;
  }

  private async updateCumulativeContext(
    current: CumulativeContext,
    turn: ConversationTurn
  ): Promise<CumulativeContext> {
    const updated: CumulativeContext = {
      extractedEntities: new Map(current.extractedEntities),
      documentContext: [...current.documentContext],
      topicProgression: [...current.topicProgression],
      keyInsights: [...current.keyInsights],
      relationshipMap: [...current.relationshipMap]
    };

    // Update entities from the new turn
    turn.query.entities.forEach(entity => {
      const key = `${entity.type}:${entity.text}`;
      const existing = updated.extractedEntities.get(key) || [];
      const newMention = {
        text: entity.text,
        type: entity.type,
        confidence: entity.confidence,
        context: turn.query.originalText,
        firstMentioned: existing.length > 0 ? existing[0].firstMentioned : turn.timestamp,
        mentions: existing.length + 1
      };
      updated.extractedEntities.set(key, [...existing, newMention]);
    });

    // Add key insights from response
    if (turn.response.summary) {
      updated.keyInsights.push(turn.response.summary);
    }

    // Update topic progression
    const topic = {
      topic: turn.query.intent.type,
      relevance: turn.query.intentConfidence,
      firstIntroduced: turn.timestamp,
      relatedTopics: turn.query.context.extractedTopics,
      queryIds: [turn.query.id]
    };
    updated.topicProgression.push(topic);

    return updated;
  }

  private calculateRelevanceScore(turn: ConversationTurn, currentQuery: string): number {
    let score = 0;

    // Recency score (more recent = higher score)
    const hoursSinceTurn = (Date.now() - turn.timestamp.getTime()) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 1 - hoursSinceTurn / 24); // Decays over 24 hours
    score += recencyScore * 0.3;

    // Content similarity score (improved keyword matching)
    const queryWords = currentQuery.toLowerCase().split(/\s+/);
    const turnWords = turn.query.originalText.toLowerCase().split(/\s+/);
    
    // Count common words and give extra weight to exact matches
    let commonWords = 0;
    let exactMatches = 0;
    
    for (const queryWord of queryWords) {
      if (turnWords.includes(queryWord)) {
        commonWords++;
        if (queryWord.length > 3) { // Give more weight to longer words
          exactMatches++;
        }
      }
    }
    
    const similarityScore = (commonWords + exactMatches) / Math.max(queryWords.length, turnWords.length);
    score += similarityScore * 0.5;

    // Follow-up bonus
    if (turn.followUpDetected) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  private async compressContext(context: ConversationContext): Promise<ConversationContext> {
    // Simple compression: keep most recent turns and summarize older ones
    const keepRecentTurns = Math.floor(this.config.maxTurnsPerContext * 0.7);
    const recentTurns = context.conversationThread.slice(-keepRecentTurns);
    const olderTurns = context.conversationThread.slice(0, -keepRecentTurns);

    // Create summary of older turns
    const summary = this.summarizeOlderTurns(olderTurns);
    
    const compressedContext: ConversationContext = {
      ...context,
      conversationThread: recentTurns,
      cumulativeContext: {
        ...context.cumulativeContext,
        keyInsights: [...context.cumulativeContext.keyInsights, summary]
      },
      metadata: {
        ...context.metadata,
        compressionLevel: context.metadata.compressionLevel + 1
      }
    };

    this.contextCache.set(context.id, compressedContext);
    return compressedContext;
  }

  private summarizeOlderTurns(turns: ConversationTurn[]): string {
    const topics = turns.map(turn => turn.query.intent.type);
    const uniqueTopics = [...new Set(topics)];
    return `Previous conversation covered: ${uniqueTopics.join(', ')} (${turns.length} turns)`;
  }
}