/**
 * Highlighting service for API integration and business logic
 * Handles CRUD operations, WebSocket communication, and state management
 */

import type {
  ComponentHighlight,
  HighlightGroup,
  HighlightApiResponse,
  HighlightBatchResponse,
  HighlightingWebSocketEvents
} from '../types/highlighting.types';

interface HighlightingServiceConfig {
  readonly apiBaseUrl: string;
  readonly websocketUrl?: string;
  readonly maxHighlights?: number;
  readonly defaultTimeout?: number;
}

export class HighlightingService {
  private readonly config: HighlightingServiceConfig;
  private websocket: WebSocket | null = null;
  private eventListeners: Map<string, ((data: any) => void)[]> = new Map();

  constructor(config: HighlightingServiceConfig) {
    this.config = {
      maxHighlights: 100,
      defaultTimeout: 10000,
      ...config
    };
  }

  /**
   * Initialize WebSocket connection for real-time updates
   */
  async initializeWebSocket(sessionId: string): Promise<void> {
    if (!this.config.websocketUrl) return;

    try {
      this.websocket = new WebSocket(`${this.config.websocketUrl}?sessionId=${sessionId}`);
      
      this.websocket.onopen = () => {
        console.log('Highlighting WebSocket connected');
      };
      
      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.websocket.onclose = () => {
        console.log('Highlighting WebSocket disconnected');
        // Attempt reconnection after delay
        setTimeout(() => this.initializeWebSocket(sessionId), 3000);
      };
      
      this.websocket.onerror = (error) => {
        console.error('Highlighting WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(data: any): void {
    const { type, payload } = data;
    const listeners = this.eventListeners.get(type) || [];
    
    listeners.forEach(listener => {
      try {
        listener(payload);
      } catch (error) {
        console.error(`Error in WebSocket listener for ${type}:`, error);
      }
    });
  }

  /**
   * Subscribe to WebSocket events
   */
  on<K extends keyof HighlightingWebSocketEvents>(
    event: K,
    listener: (data: HighlightingWebSocketEvents[K]) => void
  ): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(listener);
    this.eventListeners.set(event, listeners);
  }

  /**
   * Unsubscribe from WebSocket events
   */
  off<K extends keyof HighlightingWebSocketEvents>(
    event: K,
    listener: (data: HighlightingWebSocketEvents[K]) => void
  ): void {
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
      this.eventListeners.set(event, listeners);
    }
  }

  /**
   * Emit WebSocket event
   */
  private emit<K extends keyof HighlightingWebSocketEvents>(
    event: K,
    data: HighlightingWebSocketEvents[K]
  ): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ type: event, payload: data }));
    }
  }

  /**
   * Create a new highlight
   */
  async createHighlight(
    sessionId: string,
    highlight: Omit<ComponentHighlight, 'id' | 'createdAt'>
  ): Promise<HighlightApiResponse> {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/sessions/${sessionId}/highlights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(highlight),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: HighlightApiResponse = await response.json();
      
      // Emit WebSocket event for real-time updates
      if (result.success && result.highlight) {
        this.emit('highlight-create', { highlight: result.highlight, sessionId });
      }
      
      return result;
    } catch (error) {
      console.error('Failed to create highlight:', error);
      return {
        id: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update an existing highlight
   */
  async updateHighlight(
    sessionId: string,
    highlightId: string,
    updates: Partial<ComponentHighlight>
  ): Promise<HighlightApiResponse> {
    try {
      const response = await fetch(
        `${this.config.apiBaseUrl}/sessions/${sessionId}/highlights/${highlightId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: HighlightApiResponse = await response.json();
      
      // Emit WebSocket event
      if (result.success) {
        this.emit('highlight-update', { highlightId, updates });
      }
      
      return result;
    } catch (error) {
      console.error('Failed to update highlight:', error);
      return {
        id: highlightId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete a highlight
   */
  async deleteHighlight(sessionId: string, highlightId: string): Promise<HighlightApiResponse> {
    try {
      const response = await fetch(
        `${this.config.apiBaseUrl}/sessions/${sessionId}/highlights/${highlightId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: HighlightApiResponse = await response.json();
      
      // Emit WebSocket event
      if (result.success) {
        this.emit('highlight-delete', { highlightId, sessionId });
      }
      
      return result;
    } catch (error) {
      console.error('Failed to delete highlight:', error);
      return {
        id: highlightId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all highlights for a session
   */
  async getHighlights(sessionId: string): Promise<ComponentHighlight[]> {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/sessions/${sessionId}/highlights`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get highlights:', error);
      return [];
    }
  }

  /**
   * Toggle highlight visibility
   */
  async toggleHighlightVisibility(
    sessionId: string,
    highlightIds: string[],
    visible: boolean
  ): Promise<HighlightBatchResponse> {
    try {
      const updates = highlightIds.map(id => ({
        id,
        updates: { isVisible: visible }
      }));

      const response = await fetch(`${this.config.apiBaseUrl}/sessions/${sessionId}/highlights/batch`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operations: updates }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: HighlightBatchResponse = await response.json();
      
      // Emit WebSocket event
      if (result.success) {
        this.emit('highlight-visibility-toggle', { highlightIds, visible });
      }
      
      return result;
    } catch (error) {
      console.error('Failed to toggle highlight visibility:', error);
      return {
        success: false,
        results: [],
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Create highlight group
   */
  async createHighlightGroup(
    sessionId: string,
    group: Omit<HighlightGroup, 'id'>
  ): Promise<HighlightGroup | null> {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/sessions/${sessionId}/highlights/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(group),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to create highlight group:', error);
      return null;
    }
  }

  /**
   * Get highlight groups for a session
   */
  async getHighlightGroups(sessionId: string): Promise<HighlightGroup[]> {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/sessions/${sessionId}/highlights/groups`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get highlight groups:', error);
      return [];
    }
  }

  /**
   * Clean up resources
   */
  disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.eventListeners.clear();
  }
}

// Singleton instance for global use
let highlightingService: HighlightingService | null = null;

export function getHighlightingService(config?: HighlightingServiceConfig): HighlightingService {
  if (!highlightingService && config) {
    highlightingService = new HighlightingService(config);
  }
  
  if (!highlightingService) {
    throw new Error('HighlightingService not initialized. Provide config on first call.');
  }
  
  return highlightingService;
}