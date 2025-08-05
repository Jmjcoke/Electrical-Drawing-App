/**
 * Highlight Chat Synchronization Service
 * Manages real-time synchronization between chat events and highlighting system
 */

import type { 
  ComponentHighlight, 
  HighlightReference 
} from '../types/highlighting.types';
import type {
  Query,
  SessionState,
  ComponentSuggestion,
  ChatWebSocketEvents
} from '../types/chat';
import { getContextHighlightManager } from './context-highlight-manager';
import { getHighlightingService } from './highlighting.service';

export interface HighlightSyncEventHandlers {
  onHighlightsUpdate: (highlights: ComponentHighlight[]) => void;
  onReferencesUpdate: (references: HighlightReference[]) => void;
  onSuggestionsUpdate: (suggestions: ComponentSuggestion[]) => void;
  onSessionContextUpdate: (sessionState: SessionState) => void;
}

export class HighlightChatSyncService {
  private readonly contextManager = getContextHighlightManager();
  private readonly highlightService = getHighlightingService();
  private websocket: WebSocket | null = null;
  private eventHandlers: HighlightSyncEventHandlers | null = null;
  private syncQueue: Array<() => Promise<void>> = [];
  private isProcessing = false;

  /**
   * Initialize WebSocket connection for highlight synchronization
   */
  initialize(websocketUrl: string, sessionId: string, handlers: HighlightSyncEventHandlers): void {
    this.eventHandlers = handlers;
    
    try {
      this.websocket = new WebSocket(websocketUrl);
      this.setupWebSocketHandlers(sessionId);
    } catch (error) {
      console.error('Failed to initialize highlight sync WebSocket:', error);
    }
  }

  /**
   * Disconnect WebSocket and cleanup
   */
  disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.eventHandlers = null;
    this.syncQueue = [];
  }

  /**
   * Synchronize highlights when a new query response is received
   */
  async syncQueryResponse(query: Query, sessionState: SessionState): Promise<void> {
    return this.enqueueSync(async () => {
      try {
        const result = await this.contextManager.processQueryResponse(query, sessionState);
        
        // Update highlights with context-aware persistence
        const updatedHighlights = this.contextManager.updateHighlightPersistence(
          result.highlights,
          query,
          sessionState.highlightContext
        );

        // Notify handlers
        this.eventHandlers?.onHighlightsUpdate(updatedHighlights);
        this.eventHandlers?.onReferencesUpdate(result.references);
        this.eventHandlers?.onSuggestionsUpdate(result.suggestions);

        // Send WebSocket update
        this.sendWebSocketEvent('highlight-query-link', {
          queryId: query.id,
          highlightIds: result.highlights.map(h => h.id)
        });

        // Update session context
        const updatedSessionState: SessionState = {
          ...sessionState,
          highlightContext: result.updatedContext
        };
        this.eventHandlers?.onSessionContextUpdate(updatedSessionState);

      } catch (error) {
        console.error('Error syncing query response highlights:', error);
      }
    });
  }

  /**
   * Request contextual highlight suggestions for current query
   */
  async requestHighlightSuggestions(sessionId: string, currentQuery: string): Promise<void> {
    return this.enqueueSync(async () => {
      try {
        this.sendWebSocketEvent('request-highlight-suggestions', {
          sessionId,
          currentQuery
        });
      } catch (error) {
        console.error('Error requesting highlight suggestions:', error);
      }
    });
  }

  /**
   * Sync highlight visibility changes across the session
   */
  async syncHighlightVisibility(
    highlightId: string, 
    visible: boolean, 
    sessionState: SessionState
  ): Promise<void> {
    return this.enqueueSync(async () => {
      try {
        // Update highlight locally
        await this.highlightService.updateHighlight(highlightId, { isVisible: visible });

        // Broadcast change via WebSocket
        this.sendWebSocketEvent('highlight-visibility-toggle', {
          highlightIds: [highlightId],
          visible
        });

      } catch (error) {
        console.error('Error syncing highlight visibility:', error);
      }
    });
  }

  /**
   * Sync highlight cleanup for expired contexts
   */
  async syncHighlightCleanup(
    highlights: ComponentHighlight[],
    sessionState: SessionState
  ): Promise<void> {
    return this.enqueueSync(async () => {
      try {
        if (!sessionState.highlightContext) return;

        const { activeHighlights, expiredHighlights } = this.contextManager.cleanupExpiredHighlights(
          highlights,
          sessionState.highlightContext
        );

        if (expiredHighlights.length > 0) {
          // Remove expired highlights
          for (const highlight of expiredHighlights) {
            await this.highlightService.deleteHighlight(highlight.id);
          }

          // Update handlers
          this.eventHandlers?.onHighlightsUpdate(activeHighlights);

          // Broadcast cleanup via WebSocket
          this.sendWebSocketEvent('highlights-cleaned', {
            sessionId: sessionState.sessionId,
            expiredIds: expiredHighlights.map(h => h.id),
            activeCount: activeHighlights.length
          });
        }
      } catch (error) {
        console.error('Error syncing highlight cleanup:', error);
      }
    });
  }

  /**
   * Handle incoming highlight-related WebSocket events
   */
  private setupWebSocketHandlers(sessionId: string): void {
    if (!this.websocket) return;

    this.websocket.onopen = () => {
      console.log('Highlight sync WebSocket connected');
      this.sendWebSocketEvent('join-session', { sessionId });
    };

    this.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleWebSocketEvent(data.type, data.payload);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.websocket.onclose = () => {
      console.log('Highlight sync WebSocket disconnected');
      // Attempt reconnection after delay
      setTimeout(() => {
        if (this.eventHandlers) {
          console.log('Attempting to reconnect highlight sync WebSocket');
          // Would need to store connection details for reconnection
        }
      }, 5000);
    };

    this.websocket.onerror = (error) => {
      console.error('Highlight sync WebSocket error:', error);
    };
  }

  /**
   * Handle incoming WebSocket events
   */
  private async handleWebSocketEvent(type: string, payload: any): Promise<void> {
    try {
      switch (type) {
        case 'query-response':
          await this.handleQueryResponseEvent(payload);
          break;
          
        case 'highlight-suggestions':
          await this.handleHighlightSuggestionsEvent(payload);
          break;
          
        case 'highlight-context-updated':
          await this.handleContextUpdatedEvent(payload);
          break;
          
        case 'session-updated':
          await this.handleSessionUpdatedEvent(payload);
          break;
          
        default:
          console.log('Unhandled WebSocket event:', type, payload);
      }
    } catch (error) {
      console.error(`Error handling WebSocket event ${type}:`, error);
    }
  }

  /**
   * Handle query response events with suggested highlights
   */
  private async handleQueryResponseEvent(payload: {
    queryId: string;
    response: any;
    suggestedHighlights?: string[];
  }): Promise<void> {
    if (payload.suggestedHighlights && payload.suggestedHighlights.length > 0) {
      // Fetch suggested highlights and update UI
      const suggestions: ComponentSuggestion[] = payload.suggestedHighlights.map((componentId, index) => ({
        componentId,
        componentType: componentId.split(' ')[0]?.toLowerCase() || 'component',
        confidence: 0.7, // Default confidence from server suggestions
        source: 'context' as const,
        reasoning: 'Server-generated suggestion based on query context'
      }));

      this.eventHandlers?.onSuggestionsUpdate(suggestions);
    }
  }

  /**
   * Handle highlight suggestions from server
   */
  private async handleHighlightSuggestionsEvent(payload: {
    sessionId: string;
    suggestions: ComponentSuggestion[];
  }): Promise<void> {
    this.eventHandlers?.onSuggestionsUpdate(payload.suggestions);
  }

  /**
   * Handle highlight context updates from server
   */
  private async handleContextUpdatedEvent(payload: {
    sessionId: string;
    context: any;
  }): Promise<void> {
    // Update local session state with new context
    // This would typically involve updating the session state store
    console.log('Highlight context updated:', payload.context);
  }

  /**
   * Handle session updates that might affect highlights
   */
  private async handleSessionUpdatedEvent(payload: {
    sessionId: string;
    queryHistory: Query[];
  }): Promise<void> {
    // Process any new queries in the history for highlight generation
    // This would typically be handled by the main application state management
    console.log('Session updated with query history:', payload.queryHistory.length);
  }

  /**
   * Send WebSocket event if connection is available
   */
  private sendWebSocketEvent(type: keyof ChatWebSocketEvents, payload: any): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ type, payload }));
    }
  }

  /**
   * Queue synchronization operations to avoid race conditions
   */
  private async enqueueSync(operation: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.syncQueue.push(async () => {
        try {
          await operation();
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  /**
   * Process the synchronization queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.syncQueue.length === 0) return;

    this.isProcessing = true;

    try {
      while (this.syncQueue.length > 0) {
        const operation = this.syncQueue.shift();
        if (operation) {
          await operation();
        }
      }
    } catch (error) {
      console.error('Error processing sync queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }
}

// Singleton instance
let highlightChatSyncInstance: HighlightChatSyncService | null = null;

export function getHighlightChatSyncService(): HighlightChatSyncService {
  if (!highlightChatSyncInstance) {
    highlightChatSyncInstance = new HighlightChatSyncService();
  }
  return highlightChatSyncInstance;
}