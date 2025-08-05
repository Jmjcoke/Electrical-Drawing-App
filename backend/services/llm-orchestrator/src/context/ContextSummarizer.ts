/**
 * Context Summarization and Memory Management System
 * Provides intelligent summarization and memory-efficient storage for conversation contexts
 */

import {
  ConversationContext,
  ConversationTurn,
  ContextSummary,
  CumulativeContext,
  EntityMention
} from '../../../../shared/types/context';

export interface SummarizationConfig {
  readonly maxContextLength: number;
  readonly compressionRatio: number;
  readonly relevanceThreshold: number;
  readonly preserveRecentTurns: number;
  readonly entityImportanceWeight: number;
  readonly topicContinuityWeight: number;
}

export interface CompressionResult {
  readonly originalSize: number;
  readonly compressedSize: number;
  readonly compressionRatio: number;
  readonly preservedTurns: number;
  readonly summaryGenerated: boolean;
}

export interface ExpirationPolicy {
  readonly name: string;
  readonly maxAge: number; // milliseconds
  readonly maxInactivity: number; // milliseconds
  readonly priority: 'low' | 'medium' | 'high';
  readonly conditions: string[];
}

export interface CleanupResult {
  readonly contextsRemoved: number;
  readonly turnsRemoved: number;
  readonly spaceSaved: number; // bytes
  readonly policies: string[];
}

export interface MemoryUsage {
  readonly totalContexts: number;
  readonly totalTurns: number;
  readonly memoryUsed: number; // bytes
  readonly compressionSavings: number; // bytes
  readonly oldestContext: Date;
  readonly newestContext: Date;
}

export interface RelevanceScore {
  readonly turnId: string;
  readonly overallScore: number;
  readonly entityRelevance: number;
  readonly topicRelevance: number;
  readonly recencyScore: number;
  readonly interactionScore: number;
}

export class ContextSummarizer {
  private readonly config: SummarizationConfig;
  private readonly expirationPolicies: ExpirationPolicy[];

  constructor(
    config: Partial<SummarizationConfig> = {},
    policies: ExpirationPolicy[] = []
  ) {
    this.config = {
      maxContextLength: 50,
      compressionRatio: 0.3,
      relevanceThreshold: 0.4,
      preserveRecentTurns: 5,
      entityImportanceWeight: 0.3,
      topicContinuityWeight: 0.4,
      ...config
    };

    this.expirationPolicies = policies.length > 0 ? policies : this.getDefaultPolicies();
  }

  /**
   * Generate intelligent summary of conversation context
   */
  public async generateContextSummary(context: ConversationContext): Promise<ContextSummary> {
    const turns = context.conversationThread;
    const relevanceScores = this.calculateTurnRelevance(turns, context.cumulativeContext);
    
    // Select most relevant turns for summary
    const importantTurns = this.selectImportantTurns(turns, relevanceScores);
    
    // Generate summary content
    const summary = this.generateSummaryText(importantTurns, context.cumulativeContext);
    const keyPoints = this.extractKeyPoints(importantTurns, context.cumulativeContext);
    const relevantEntities = this.extractRelevantEntities(importantTurns, context.cumulativeContext);
    
    const compressionRatio = importantTurns.length / turns.length;
    const summaryConfidence = this.calculateSummaryConfidence(importantTurns, relevanceScores);

    return {
      summary,
      keyPoints,
      relevantEntities,
      compressionRatio,
      originalTurnCount: turns.length,
      summaryConfidence
    };
  }

  /**
   * Compress context by removing less relevant turns and generating summaries
   */
  public async compressContext(context: ConversationContext): Promise<{
    compressedContext: ConversationContext;
    compressionResult: CompressionResult;
  }> {
    const originalSize = this.calculateContextSize(context);
    const turns = context.conversationThread;

    if (turns.length <= this.config.maxContextLength) {
      return {
        compressedContext: context,
        compressionResult: {
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1.0,
          preservedTurns: turns.length,
          summaryGenerated: false
        }
      };
    }

    // Calculate relevance scores for all turns
    const relevanceScores = this.calculateTurnRelevance(turns, context.cumulativeContext);
    
    // Preserve recent turns and select most relevant older turns
    const recentTurns = turns.slice(-this.config.preserveRecentTurns);
    const olderTurns = turns.slice(0, -this.config.preserveRecentTurns);
    
    const targetOlderTurns = Math.max(
      1,
      Math.floor((this.config.maxContextLength - this.config.preserveRecentTurns) * this.config.compressionRatio)
    );

    const selectedOlderTurns = this.selectMostRelevantTurns(
      olderTurns,
      relevanceScores,
      targetOlderTurns
    );

    // Generate summary for removed turns
    const removedTurns = olderTurns.filter(turn => 
      !selectedOlderTurns.some(selected => selected.id === turn.id)
    );

    const summary = removedTurns.length > 0 
      ? await this.generateContextSummary({
          ...context,
          conversationThread: removedTurns
        })
      : null;

    // Create compressed context
    const compressedTurns = [...selectedOlderTurns, ...recentTurns]
      .sort((a, b) => a.turnNumber - b.turnNumber);

    const compressedContext: ConversationContext = {
      ...context,
      conversationThread: compressedTurns,
      cumulativeContext: this.updateCumulativeContext(context.cumulativeContext, compressedTurns),
      lastUpdated: new Date(),
      metadata: {
        ...context.metadata,
        compressionLevel: context.metadata.compressionLevel + 1,
        lastAccessed: new Date(),
        tags: summary 
          ? [...context.metadata.tags, 'compressed', 'summarized']
          : [...context.metadata.tags, 'compressed']
      }
    };

    const compressedSize = this.calculateContextSize(compressedContext);

    return {
      compressedContext,
      compressionResult: {
        originalSize,
        compressedSize,
        compressionRatio: compressedSize / originalSize,
        preservedTurns: compressedTurns.length,
        summaryGenerated: summary !== null
      }
    };
  }

  /**
   * Apply expiration policies and clean up old contexts
   */
  public applyCleanupPolicies(contexts: ConversationContext[]): CleanupResult {
    let contextsRemoved = 0;
    let turnsRemoved = 0;
    let spaceSaved = 0;
    const appliedPolicies: string[] = [];

    const now = new Date();

    for (const policy of this.expirationPolicies) {
      const expiredContexts = contexts.filter(context => 
        this.isContextExpiredByPolicy(context, policy, now)
      );

      for (const context of expiredContexts) {
        spaceSaved += this.calculateContextSize(context);
        turnsRemoved += context.conversationThread.length;
        contextsRemoved++;
      }

      if (expiredContexts.length > 0) {
        appliedPolicies.push(policy.name);
      }

      // Remove expired contexts from the array
      contexts.splice(0, contexts.length, ...contexts.filter(context => 
        !this.isContextExpiredByPolicy(context, policy, now)
      ));
    }

    return {
      contextsRemoved,
      turnsRemoved,
      spaceSaved,
      policies: appliedPolicies
    };
  }

  /**
   * Calculate memory usage statistics
   */
  public calculateMemoryUsage(contexts: ConversationContext[]): MemoryUsage {
    let totalTurns = 0;
    let memoryUsed = 0;
    let compressionSavings = 0;
    let oldestContext = new Date();
    let newestContext = new Date(0);

    for (const context of contexts) {
      totalTurns += context.conversationThread.length;
      memoryUsed += this.calculateContextSize(context);
      
      // Estimate compression savings based on compression level
      if (context.metadata.compressionLevel > 0) {
        compressionSavings += this.estimateOriginalSize(context) - this.calculateContextSize(context);
      }

      if (context.metadata.createdAt < oldestContext) {
        oldestContext = context.metadata.createdAt;
      }
      if (context.metadata.createdAt > newestContext) {
        newestContext = context.metadata.createdAt;
      }
    }

    return {
      totalContexts: contexts.length,
      totalTurns,
      memoryUsed,
      compressionSavings,
      oldestContext,
      newestContext
    };
  }

  /**
   * Optimize context storage for better performance
   */
  public async optimizeContextStorage(contexts: ConversationContext[]): Promise<{
    optimizedContexts: ConversationContext[];
    optimizationResults: {
      compressed: number;
      summarized: number;
      cleaned: number;
      spaceSaved: number;
    };
  }> {
    let compressed = 0;
    let summarized = 0;
    let cleaned = 0;
    let spaceSaved = 0;

    const optimizedContexts: ConversationContext[] = [];

    for (const context of contexts) {
      const originalSize = this.calculateContextSize(context);

      // Apply compression if context is too large
      if (context.conversationThread.length > this.config.maxContextLength) {
        const { compressedContext, compressionResult } = await this.compressContext(context);
        optimizedContexts.push(compressedContext);
        spaceSaved += originalSize - compressionResult.compressedSize;
        compressed++;
        
        if (compressionResult.summaryGenerated) {
          summarized++;
        }
      } else {
        optimizedContexts.push(context);
      }
    }

    // Apply cleanup policies
    const cleanupResult = this.applyCleanupPolicies(optimizedContexts);
    cleaned = cleanupResult.contextsRemoved;
    spaceSaved += cleanupResult.spaceSaved;

    return {
      optimizedContexts,
      optimizationResults: {
        compressed,
        summarized,
        cleaned,
        spaceSaved
      }
    };
  }

  // Private helper methods

  private calculateTurnRelevance(
    turns: ConversationTurn[],
    cumulativeContext: CumulativeContext
  ): Map<string, RelevanceScore> {
    const scores = new Map<string, RelevanceScore>();
    const now = new Date();

    for (const turn of turns) {
      const entityRelevance = this.calculateEntityRelevance(turn, cumulativeContext);
      const topicRelevance = this.calculateTopicRelevance(turn, cumulativeContext);
      const recencyScore = this.calculateRecencyScore(turn.timestamp, now);
      const interactionScore = this.calculateInteractionScore(turn);

      const overallScore = 
        (entityRelevance * this.config.entityImportanceWeight) +
        (topicRelevance * this.config.topicContinuityWeight) +
        (recencyScore * 0.2) +
        (interactionScore * 0.1);

      scores.set(turn.id, {
        turnId: turn.id,
        overallScore,
        entityRelevance,
        topicRelevance,
        recencyScore,
        interactionScore
      });
    }

    return scores;
  }

  private calculateEntityRelevance(
    turn: ConversationTurn,
    cumulativeContext: CumulativeContext
  ): number {
    let relevanceScore = 0;
    const turnText = `${turn.query.text} ${turn.response.summary || ''}`.toLowerCase();

    // Check for mentions of important entities
    for (const [entity, mentions] of cumulativeContext.extractedEntities) {
      if (turnText.includes(entity.toLowerCase())) {
        // Higher score for entities mentioned frequently
        const entityImportance = Math.min(mentions.length / 10, 1.0);
        relevanceScore += entityImportance * 0.3;
      }
    }

    return Math.min(relevanceScore, 1.0);
  }

  private calculateTopicRelevance(
    turn: ConversationTurn,
    cumulativeContext: CumulativeContext
  ): number {
    let relevanceScore = 0;

    // Check if turn is part of ongoing topics
    for (const topic of cumulativeContext.topicProgression) {
      if (topic.queryIds.includes(turn.query.id)) {
        // Higher score for topics with more queries (indicating importance)
        const topicImportance = Math.min(topic.queryIds.length / 5, 1.0);
        relevanceScore += topicImportance * topic.relevance;
      }
    }

    return Math.min(relevanceScore, 1.0);
  }

  private calculateRecencyScore(timestamp: Date, now: Date): number {
    const ageHours = (now.getTime() - timestamp.getTime()) / (1000 * 60 * 60);
    // Exponential decay over 24 hours
    return Math.exp(-ageHours / 24);
  }

  private calculateInteractionScore(turn: ConversationTurn): number {
    let score = 0;

    // Higher score for follow-up questions (indicates engagement)
    if (turn.followUpDetected) {
      score += 0.3;
    }

    // Higher score for high-confidence responses
    if (turn.response.confidence.overall > 0.8) {
      score += 0.4;
    }

    // Higher score for turns with many context contributions
    score += Math.min(turn.contextContributions.length / 5, 0.3);

    return Math.min(score, 1.0);
  }

  private selectImportantTurns(
    turns: ConversationTurn[],
    relevanceScores: Map<string, RelevanceScore>
  ): ConversationTurn[] {
    return turns
      .filter(turn => {
        const score = relevanceScores.get(turn.id);
        return score && score.overallScore >= this.config.relevanceThreshold;
      })
      .sort((a, b) => {
        const scoreA = relevanceScores.get(a.id)?.overallScore || 0;
        const scoreB = relevanceScores.get(b.id)?.overallScore || 0;
        return scoreB - scoreA;
      });
  }

  private selectMostRelevantTurns(
    turns: ConversationTurn[],
    relevanceScores: Map<string, RelevanceScore>,
    count: number
  ): ConversationTurn[] {
    return turns
      .map(turn => ({
        turn,
        score: relevanceScores.get(turn.id)?.overallScore || 0
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(item => item.turn)
      .sort((a, b) => a.turnNumber - b.turnNumber);
  }

  private generateSummaryText(
    turns: ConversationTurn[],
    cumulativeContext: CumulativeContext
  ): string {
    if (turns.length === 0) {
      return 'No significant conversation activity.';
    }

    const keyTopics = this.extractKeyTopicsFromTurns(turns, cumulativeContext);
    const majorFindings = this.extractMajorFindings(turns);
    
    let summary = `Conversation summary covering ${turns.length} key interactions. `;
    
    if (keyTopics.length > 0) {
      summary += `Main topics discussed: ${keyTopics.join(', ')}. `;
    }
    
    if (majorFindings.length > 0) {
      summary += `Key findings: ${majorFindings.join('; ')}.`;
    }

    return summary.trim();
  }

  private extractKeyPoints(
    turns: ConversationTurn[],
    cumulativeContext: CumulativeContext
  ): string[] {
    const keyPoints: string[] = [];

    // Extract high-confidence insights
    for (const turn of turns) {
      if (turn.response.confidence.overall > 0.8 && turn.response.summary) {
        const summary = turn.response.summary;
        if (summary.length > 20 && summary.length < 200) {
          keyPoints.push(`Turn ${turn.turnNumber}: ${summary}`);
        }
      }
    }

    // Extract important entity relationships
    const importantRelationships = cumulativeContext.relationshipMap
      .filter(rel => rel.confidence > 0.7)
      .slice(0, 3);

    for (const rel of importantRelationships) {
      keyPoints.push(`Relationship: ${rel.source} ${rel.relationship} ${rel.target}`);
    }

    return keyPoints.slice(0, 10); // Limit to 10 key points
  }

  private extractRelevantEntities(
    turns: ConversationTurn[],
    cumulativeContext: CumulativeContext
  ): string[] {
    const entityCounts = new Map<string, number>();

    // Count entity mentions in selected turns
    for (const turn of turns) {
      for (const [entity, mentions] of cumulativeContext.extractedEntities) {
        const turnMentions = mentions.filter(mention => mention.turnId === turn.id);
        if (turnMentions.length > 0) {
          entityCounts.set(entity, (entityCounts.get(entity) || 0) + turnMentions.length);
        }
      }
    }

    // Return most frequently mentioned entities
    return Array.from(entityCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([entity]) => entity);
  }

  private calculateSummaryConfidence(
    turns: ConversationTurn[],
    relevanceScores: Map<string, RelevanceScore>
  ): number {
    if (turns.length === 0) return 0;

    const avgRelevanceScore = turns.reduce((sum, turn) => {
      return sum + (relevanceScores.get(turn.id)?.overallScore || 0);
    }, 0) / turns.length;

    const avgResponseConfidence = turns.reduce((sum, turn) => {
      return sum + turn.response.confidence.overall;
    }, 0) / turns.length;

    // Combine relevance and response confidence
    return (avgRelevanceScore * 0.6) + (avgResponseConfidence * 0.4);
  }

  private extractKeyTopicsFromTurns(
    turns: ConversationTurn[],
    cumulativeContext: CumulativeContext
  ): string[] {
    const topicCounts = new Map<string, number>();

    for (const turn of turns) {
      for (const topic of cumulativeContext.topicProgression) {
        if (topic.queryIds.includes(turn.query.id)) {
          topicCounts.set(topic.topic, (topicCounts.get(topic.topic) || 0) + 1);
        }
      }
    }

    return Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);
  }

  private extractMajorFindings(turns: ConversationTurn[]): string[] {
    return turns
      .filter(turn => turn.response.confidence.overall > 0.9)
      .map(turn => turn.response.summary || '')
      .filter(summary => summary.length > 10)
      .slice(0, 3);
  }

  private updateCumulativeContext(
    originalContext: CumulativeContext,
    remainingTurns: ConversationTurn[]
  ): CumulativeContext {
    const remainingTurnIds = new Set(remainingTurns.map(t => t.id));

    // Filter entities to only include those from remaining turns
    const filteredEntities = new Map<string, EntityMention[]>();
    for (const [entity, mentions] of originalContext.extractedEntities) {
      const relevantMentions = mentions.filter(mention => 
        remainingTurnIds.has(mention.turnId)
      );
      if (relevantMentions.length > 0) {
        filteredEntities.set(entity, relevantMentions);
      }
    }

    // Filter other context elements similarly
    const filteredDocuments = originalContext.documentContext.filter(doc =>
      remainingTurns.some(turn => 
        turn.query.documentIds && turn.query.documentIds.includes(doc.documentId)
      )
    );

    const filteredTopics = originalContext.topicProgression.filter(topic =>
      topic.queryIds.some(id => 
        remainingTurns.some(turn => turn.query.id === id)
      )
    );

    const filteredRelationships = originalContext.relationshipMap.filter(rel =>
      remainingTurns.some(turn => turn.id === (rel as any).turnId)
    );

    return {
      extractedEntities: filteredEntities,
      documentContext: filteredDocuments,
      topicProgression: filteredTopics,
      keyInsights: originalContext.keyInsights.slice(0, 5), // Keep some key insights
      relationshipMap: filteredRelationships
    };
  }

  private calculateContextSize(context: ConversationContext): number {
    // Rough estimation of context size in bytes
    let size = 0;
    
    // Base context metadata
    size += 1000; // Approximate base size
    
    // Conversation turns
    for (const turn of context.conversationThread) {
      size += turn.query.text.length * 2; // UTF-16 encoding
      size += (turn.response.summary || '').length * 2;
      size += turn.contextContributions.join('').length * 2;
      size += 500; // Other turn metadata
    }
    
    // Cumulative context
    for (const [entity, mentions] of context.cumulativeContext.extractedEntities) {
      size += entity.length * 2;
      size += mentions.length * 200; // Approximate mention size
    }
    
    size += context.cumulativeContext.keyInsights.join('').length * 2;
    size += context.cumulativeContext.relationshipMap.length * 300;
    
    return size;
  }

  private estimateOriginalSize(context: ConversationContext): number {
    // Estimate original size before compression
    const currentSize = this.calculateContextSize(context);
    const compressionLevel = context.metadata.compressionLevel;
    
    // Assume each compression level reduces size by ~30%
    return currentSize * Math.pow(1.43, compressionLevel); // 1/0.7 ≈ 1.43
  }

  private isContextExpiredByPolicy(
    context: ConversationContext,
    policy: ExpirationPolicy,
    now: Date
  ): boolean {
    const age = now.getTime() - context.metadata.createdAt.getTime();
    const inactivity = now.getTime() - context.metadata.lastAccessed.getTime();

    // Check age-based expiration
    if (policy.maxAge > 0 && age > policy.maxAge) {
      return true;
    }

    // Check inactivity-based expiration
    if (policy.maxInactivity > 0 && inactivity > policy.maxInactivity) {
      return true;
    }

    // Check custom conditions
    for (const condition of policy.conditions) {
      if (this.evaluateCondition(context, condition)) {
        return true;
      }
    }

    return false;
  }

  private evaluateCondition(context: ConversationContext, condition: string): boolean {
    // Simple condition evaluation - in production would use a proper expression evaluator
    switch (condition) {
      case 'low_access_count':
        return context.metadata.accessCount < 3;
      case 'no_follow_ups':
        return !context.conversationThread.some(turn => turn.followUpDetected);
      case 'low_confidence':
        const avgConfidence = context.conversationThread.reduce((sum, turn) => 
          sum + turn.response.confidence.overall, 0) / context.conversationThread.length;
        return avgConfidence < 0.5;
      default:
        return false;
    }
  }

  private getDefaultPolicies(): ExpirationPolicy[] {
    return [
      {
        name: 'Old Low-Priority Contexts',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        maxInactivity: 3 * 24 * 60 * 60 * 1000, // 3 days
        priority: 'low',
        conditions: ['low_access_count']
      },
      {
        name: 'Inactive Medium-Priority Contexts',
        maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
        maxInactivity: 7 * 24 * 60 * 60 * 1000, // 7 days
        priority: 'medium',
        conditions: []
      },
      {
        name: 'Very Old High-Priority Contexts',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        maxInactivity: 14 * 24 * 60 * 60 * 1000, // 14 days
        priority: 'high',
        conditions: []
      }
    ];
  }
}