/**
 * Context Highlight Manager
 * Manages highlight state integration with chat context and conversation flow
 */

import type {
  ComponentHighlight,
  HighlightReference,
  HighlightGroup
} from '../types/highlighting.types';
import type {
  Query,
  SessionState,
  SessionHighlightContext,
  ComponentSuggestion,
  QueryHighlights
} from '../types/chat';
import { ResponseLinkerService, getResponseLinkerService } from './response-linker.service';
import { HighlightingService, getHighlightingService } from './highlighting.service';

export interface ContextHighlightManagerOptions {
  readonly maxPersistentHighlights?: number;
  readonly suggestionThreshold?: number;
  readonly contextRetentionTime?: number; // in milliseconds
  readonly enableSemanticSuggestions?: boolean;
}

export class ContextHighlightManager {
  private readonly responseLinker: ResponseLinkerService;
  private readonly highlightService: HighlightingService;
  private readonly options: Required<ContextHighlightManagerOptions>;

  constructor(options: ContextHighlightManagerOptions = {}) {
    this.responseLinker = getResponseLinkerService();
    this.highlightService = getHighlightingService();
    this.options = {
      maxPersistentHighlights: options.maxPersistentHighlights ?? 10,
      suggestionThreshold: options.suggestionThreshold ?? 0.6,
      contextRetentionTime: options.contextRetentionTime ?? 30 * 60 * 1000, // 30 minutes
      enableSemanticSuggestions: options.enableSemanticSuggestions ?? true
    };
  }

  /**
   * Process a new query response and generate highlights with context awareness
   */
  async processQueryResponse(
    query: Query,
    sessionState: SessionState
  ): Promise<{
    highlights: ComponentHighlight[];
    references: HighlightReference[];
    suggestions: ComponentSuggestion[];
    updatedContext: SessionHighlightContext;
  }> {
    try {
      const responseText = query.aggregatedResult?.summary || '';
      if (!responseText) {
        return this.createEmptyResult(sessionState.highlightContext);
      }

      // Generate highlights from response
      const highlights = await this.responseLinker.analyzeResponse(
        responseText,
        query.id,
        query.id,
        sessionState.sessionId
      );

      // Create highlight references for text linking
      const componentMentions = this.extractComponentMentions(responseText, highlights);
      const references = highlights.length > 0 ? this.responseLinker.createHighlightReferences(
        highlights,
        responseText,
        componentMentions
      ) : [];

      // Generate context-aware suggestions
      const suggestions = await this.generateContextualSuggestions(
        query,
        highlights,
        sessionState.highlightContext
      );

      // Update session highlight context
      const updatedContext = this.updateHighlightContext(
        sessionState.highlightContext,
        query,
        highlights,
        suggestions
      );

      return {
        highlights,
        references,
        suggestions,
        updatedContext
      };
    } catch (error) {
      console.error('Error processing query response highlights:', error);
      return this.createEmptyResult(sessionState.highlightContext);
    }
  }

  /**
   * Generate highlight suggestions based on conversation context and history
   */
  async generateContextualSuggestions(
    currentQuery: Query,
    currentHighlights: ComponentHighlight[],
    context?: SessionHighlightContext
  ): Promise<ComponentSuggestion[]> {
    const suggestions: ComponentSuggestion[] = [];

    if (!context || !this.options.enableSemanticSuggestions) {
      return suggestions;
    }

    try {
      // Analyze query history for component patterns
      const historicalSuggestions = this.analyzeHistoricalPatterns(
        currentQuery,
        context.highlightHistory
      );
      suggestions.push(...historicalSuggestions);

      // Generate semantic suggestions based on current highlights
      const semanticSuggestions = await this.generateSemanticSuggestions(
        currentQuery,
        currentHighlights,
        context
      );
      suggestions.push(...semanticSuggestions);

      // Filter and rank suggestions
      return this.rankAndFilterSuggestions(suggestions);
    } catch (error) {
      console.error('Error generating contextual suggestions:', error);
      return [];
    }
  }

  /**
   * Update highlight persistence based on conversation context
   */
  updateHighlightPersistence(
    highlights: ComponentHighlight[],
    query: Query,
    context?: SessionHighlightContext
  ): ComponentHighlight[] {
    return highlights.map(highlight => {
      const shouldPersist = this.shouldHighlightPersist(highlight, query, context);
      const updatedHighlight: ComponentHighlight = {
        ...highlight,
        isPersistent: shouldPersist,
        expiresAt: shouldPersist ? undefined : new Date(Date.now() + this.options.contextRetentionTime)
      };

      return updatedHighlight;
    });
  }

  /**
   * Clean up expired highlights based on context rules
   */
  cleanupExpiredHighlights(
    highlights: ComponentHighlight[],
    context: SessionHighlightContext
  ): {
    activeHighlights: ComponentHighlight[];
    expiredHighlights: ComponentHighlight[];
  } {
    const now = new Date();
    const activeHighlights: ComponentHighlight[] = [];
    const expiredHighlights: ComponentHighlight[] = [];

    highlights.forEach(highlight => {
      const isExpired = highlight.expiresAt && highlight.expiresAt < now;
      const isPersistent = highlight.isPersistent || context.persistentHighlights.includes(highlight.id);

      if (isExpired && !isPersistent) {
        expiredHighlights.push(highlight);
      } else {
        activeHighlights.push(highlight);
      }
    });

    return { activeHighlights, expiredHighlights };
  }

  /**
   * Link highlights to specific queries for context tracking
   */
  linkHighlightsToQuery(
    query: Query,
    highlightIds: string[]
  ): Query {
    const queryHighlights: QueryHighlights = {
      highlightIds,
      suggestedHighlights: [],
      activeComponents: this.extractActiveComponents(highlightIds),
      contextualReferences: []
    };

    return {
      ...query,
      highlights: queryHighlights
    };
  }

  /**
   * Get highlights relevant to a specific query context
   */
  getQueryRelevantHighlights(
    query: Query,
    allHighlights: ComponentHighlight[],
    context?: SessionHighlightContext
  ): ComponentHighlight[] {
    if (!context) return [];

    // Get highlights from current query
    const queryHighlightIds = query.highlights?.highlightIds || [];
    const queryHighlights = allHighlights.filter(h => queryHighlightIds.includes(h.id));

    // Get contextually relevant highlights from history
    const contextualHighlights = this.getContextuallyRelevantHighlights(
      query,
      allHighlights,
      context
    );

    // Combine and deduplicate
    const combinedHighlights = new Map<string, ComponentHighlight>();
    [...queryHighlights, ...contextualHighlights].forEach(highlight => {
      combinedHighlights.set(highlight.id, highlight);
    });

    return Array.from(combinedHighlights.values());
  }

  // Private helper methods

  private createEmptyResult(context?: SessionHighlightContext) {
    return {
      highlights: [],
      references: [],
      suggestions: [],
      updatedContext: context || this.createDefaultContext()
    };
  }

  private createDefaultContext(): SessionHighlightContext {
    return {
      persistentHighlights: [],
      activeHighlights: [],
      highlightHistory: [],
      contextualSuggestions: [],
      lastUpdated: new Date()
    };
  }

  private extractComponentMentions(text: string, highlights: ComponentHighlight[]) {
    // Extract component mentions from text for highlight reference creation
    if (!highlights || highlights.length === 0) {
      return [];
    }
    
    return highlights.map((highlight, index) => {
      const componentId = highlight.componentId || 'component';
      const startIndex = text.toLowerCase().indexOf(componentId.toLowerCase());
      
      return {
        componentType: componentId.split(' ')[0]?.toLowerCase() || 'component',
        description: componentId,
        mentionText: componentId,
        confidence: 0.8,
        startIndex: Math.max(0, startIndex),
        endIndex: Math.max(10, startIndex + componentId.length),
        contextualClues: []
      };
    });
  }

  private updateHighlightContext(
    existingContext: SessionHighlightContext | undefined,
    query: Query,
    highlights: ComponentHighlight[],
    suggestions: ComponentSuggestion[]
  ): SessionHighlightContext {
    const context = existingContext || this.createDefaultContext();

    const queryHighlights: QueryHighlights = {
      highlightIds: highlights.map(h => h.id),
      suggestedHighlights: suggestions.map(s => s.componentId),
      activeComponents: highlights.map(h => h.componentId || ''),
      contextualReferences: []
    };

    return {
      ...context,
      activeHighlights: highlights.map(h => h.id),
      highlightHistory: [...context.highlightHistory, queryHighlights].slice(-20), // Keep last 20
      contextualSuggestions: suggestions,
      lastUpdated: new Date()
    };
  }

  private analyzeHistoricalPatterns(
    currentQuery: Query,
    highlightHistory: QueryHighlights[]
  ): ComponentSuggestion[] {
    const suggestions: ComponentSuggestion[] = [];
    const componentFrequency = new Map<string, number>();

    // Analyze component frequency in history
    highlightHistory.forEach(queryHighlights => {
      queryHighlights.activeComponents.forEach(component => {
        if (component) {
          componentFrequency.set(component, (componentFrequency.get(component) || 0) + 1);
        }
      });
    });

    // Generate suggestions based on frequency and relevance
    componentFrequency.forEach((frequency, componentId) => {
      const componentType = componentId.split(' ')[0]?.toLowerCase() || 'component';
      const confidence = Math.min(frequency / highlightHistory.length, 1.0);

      if (confidence >= this.options.suggestionThreshold) {
        suggestions.push({
          componentId,
          componentType,
          confidence,
          source: 'history',
          reasoning: `Frequently referenced component (${frequency} times in recent queries)`
        });
      }
    });

    return suggestions;
  }

  private async generateSemanticSuggestions(
    query: Query,
    highlights: ComponentHighlight[],
    context: SessionHighlightContext
  ): Promise<ComponentSuggestion[]> {
    const suggestions: ComponentSuggestion[] = [];

    // Analyze semantic relationships between current query and highlights
    const queryText = query.text.toLowerCase();
    const queryType = query.type;

    highlights.forEach(highlight => {
      if (!highlight.componentId) return;

      const componentType = highlight.componentId.split(' ')[0]?.toLowerCase() || 'component';
      let confidence = 0.5;

      // Boost confidence based on query type relevance
      if (queryType === 'component_identification' && componentType !== 'component') {
        confidence += 0.2;
      }

      // Boost confidence if component type appears in query text
      if (queryText.includes(componentType)) {
        confidence += 0.3;
      }

      if (confidence >= this.options.suggestionThreshold) {
        suggestions.push({
          componentId: highlight.componentId,
          componentType,
          confidence,
          source: 'semantic',
          reasoning: `Semantically relevant to current query about ${queryType.replace('_', ' ')}`
        });
      }
    });

    return suggestions;
  }

  private rankAndFilterSuggestions(suggestions: ComponentSuggestion[]): ComponentSuggestion[] {
    // Remove duplicates
    const uniqueSuggestions = new Map<string, ComponentSuggestion>();
    suggestions.forEach(suggestion => {
      const existing = uniqueSuggestions.get(suggestion.componentId);
      if (!existing || suggestion.confidence > existing.confidence) {
        uniqueSuggestions.set(suggestion.componentId, suggestion);
      }
    });

    // Sort by confidence and limit results
    return Array.from(uniqueSuggestions.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10); // Limit to top 10 suggestions
  }

  private shouldHighlightPersist(
    highlight: ComponentHighlight,
    query: Query,
    context?: SessionHighlightContext
  ): boolean {
    // Always persist highlights with high confidence
    if (highlight.style.opacity >= 0.9) return true;

    // Persist highlights for component identification queries
    if (query.type === 'component_identification') return true;

    // Persist highlights that appear frequently in context
    if (context) {
      const frequency = context.highlightHistory.reduce((count, queryHighlights) => {
        return count + (queryHighlights.activeComponents.includes(highlight.componentId || '') ? 1 : 0);
      }, 0);

      if (frequency >= 2) return true;
    }

    return false;
  }

  private extractActiveComponents(highlightIds: string[]): string[] {
    // This would typically query the highlight service to get component IDs
    // For now, return empty array as placeholder
    return [];
  }

  private getContextuallyRelevantHighlights(
    query: Query,
    allHighlights: ComponentHighlight[],
    context: SessionHighlightContext
  ): ComponentHighlight[] {
    const relevantHighlights: ComponentHighlight[] = [];
    const queryText = query.text.toLowerCase();

    // Get highlights that match query context
    allHighlights.forEach(highlight => {
      if (!highlight.componentId) return;

      const componentType = highlight.componentId.split(' ')[0]?.toLowerCase();
      
      // Include if component type is mentioned in query
      if (componentType && queryText.includes(componentType)) {
        relevantHighlights.push(highlight);
      }

      // Include persistent highlights
      if (context.persistentHighlights.includes(highlight.id)) {
        relevantHighlights.push(highlight);
      }
    });

    return relevantHighlights;
  }
}

// Singleton instance
let contextHighlightManagerInstance: ContextHighlightManager | null = null;

export function getContextHighlightManager(
  options?: ContextHighlightManagerOptions
): ContextHighlightManager {
  if (!contextHighlightManagerInstance) {
    contextHighlightManagerInstance = new ContextHighlightManager(options);
  }
  return contextHighlightManagerInstance;
}