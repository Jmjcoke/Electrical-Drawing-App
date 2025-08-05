/**
 * Highlight Sharing Service
 * Enables collaborative analysis sessions with real-time highlight sharing
 */

import type {
  ComponentHighlight,
  HighlightGroup,
  ViewportState
} from '../types/highlighting.types';

export interface ShareableSession {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly expiresAt?: Date;
  readonly isPublic: boolean;
  readonly allowAnonymousView: boolean;
  readonly allowAnonymousEdit: boolean;
  readonly documentId: string;
  readonly maxParticipants?: number;
}

export interface SessionParticipant {
  readonly id: string;
  readonly name: string;
  readonly email?: string;
  readonly role: 'owner' | 'editor' | 'viewer';
  readonly joinedAt: Date;
  readonly lastActive: Date;
  readonly isOnline: boolean;
  readonly cursor?: {
    readonly x: number;
    readonly y: number;
    readonly visible: boolean;
  };
}

export interface SharedHighlight extends ComponentHighlight {
  readonly createdBy: string;
  readonly sharedAt: Date;
  readonly permissions: {
    readonly canEdit: boolean;
    readonly canDelete: boolean;
    readonly canMove: boolean;
  };
  readonly collaborativeData?: {
    readonly comments: HighlightComment[];
    readonly reactions: HighlightReaction[];
    readonly lastModifiedBy?: string;
    readonly lastModifiedAt?: Date;
  };
}

export interface HighlightComment {
  readonly id: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly text: string;
  readonly createdAt: Date;
  readonly editedAt?: Date;
  readonly parentCommentId?: string; // For threaded comments
}

export interface HighlightReaction {
  readonly id: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly type: 'like' | 'approve' | 'question' | 'concern' | 'custom';
  readonly customEmoji?: string;
  readonly createdAt: Date;
}

export interface CollaborativeViewport {
  readonly participantId: string;
  readonly participantName: string;
  readonly viewport: ViewportState;
  readonly followable: boolean;
  readonly lastUpdated: Date;
}

export interface ShareableHighlightData {
  readonly session: ShareableSession;
  readonly highlights: SharedHighlight[];
  readonly groups: HighlightGroup[];
  readonly participants: SessionParticipant[];
  readonly viewports: CollaborativeViewport[];
  readonly version: number;
  readonly lastSynced: Date;
}

export interface ShareOptions {
  readonly title: string;
  readonly description?: string;
  readonly isPublic?: boolean;
  readonly allowAnonymousView?: boolean;
  readonly allowAnonymousEdit?: boolean;
  readonly expiresIn?: number; // hours
  readonly maxParticipants?: number;
  readonly requireApproval?: boolean;
}

export interface JoinOptions {
  readonly sessionId: string;
  readonly participantName: string;
  readonly participantEmail?: string;
  readonly role?: 'editor' | 'viewer';
}

export class HighlightSharingService {
  private socket: WebSocket | null = null;
  private currentSession: ShareableSession | null = null;
  private participants: Map<string, SessionParticipant> = new Map();
  private sharedHighlights: Map<string, SharedHighlight> = new Map();
  private messageHandlers: Map<string, Function[]> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(private baseUrl: string = '') {
    this.setupMessageHandlers();
  }

  /**
   * Create a new collaborative session
   */
  async createSession(
    highlights: ComponentHighlight[],
    groups: HighlightGroup[],
    documentId: string,
    options: ShareOptions
  ): Promise<{
    success: boolean;
    session?: ShareableSession;
    shareUrl?: string;
    error?: string;
  }> {
    try {
      const sessionData = {
        title: options.title,
        description: options.description,
        documentId,
        isPublic: options.isPublic ?? false,
        allowAnonymousView: options.allowAnonymousView ?? false,
        allowAnonymousEdit: options.allowAnonymousEdit ?? false,
        expiresIn: options.expiresIn,
        maxParticipants: options.maxParticipants,
        highlights: highlights.map(h => this.convertToSharedHighlight(h)),
        groups
      };

      const response = await fetch(`${this.baseUrl}/api/sharing/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData),
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }

      const result = await response.json();
      const session: ShareableSession = result.session;
      const shareUrl = `${window.location.origin}/shared/${session.id}`;

      this.currentSession = session;

      return {
        success: true,
        session,
        shareUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating session'
      };
    }
  }

  /**
   * Join an existing collaborative session
   */
  async joinSession(options: JoinOptions): Promise<{
    success: boolean;
    sessionData?: ShareableHighlightData;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/sharing/sessions/${options.sessionId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          participantName: options.participantName,
          participantEmail: options.participantEmail,
          role: options.role || 'viewer'
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to join session: ${response.statusText}`);
      }

      const sessionData: ShareableHighlightData = await response.json();
      
      // Update local state
      this.currentSession = sessionData.session;
      this.sharedHighlights.clear();
      sessionData.highlights.forEach(h => this.sharedHighlights.set(h.id, h));
      
      this.participants.clear();
      sessionData.participants.forEach(p => this.participants.set(p.id, p));

      // Connect to real-time updates
      await this.connectToSession(options.sessionId);

      return {
        success: true,
        sessionData
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error joining session'
      };
    }
  }

  /**
   * Leave the current session
   */
  async leaveSession(): Promise<void> {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    if (this.currentSession) {
      try {
        await fetch(`${this.baseUrl}/api/sharing/sessions/${this.currentSession.id}/leave`, {
          method: 'POST',
        });
      } catch (error) {
        console.error('Error leaving session:', error);
      }
    }

    this.currentSession = null;
    this.participants.clear();
    this.sharedHighlights.clear();
    this.reconnectAttempts = 0;
  }

  /**
   * Share a new highlight in the current session
   */
  async shareHighlight(highlight: ComponentHighlight): Promise<{
    success: boolean;
    sharedHighlight?: SharedHighlight;
    error?: string;
  }> {
    if (!this.currentSession) {
      return { success: false, error: 'No active session' };
    }

    try {
      const sharedHighlight = this.convertToSharedHighlight(highlight);
      
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({
          type: 'highlight_shared',
          data: { highlight: sharedHighlight }
        }));
      }

      this.sharedHighlights.set(sharedHighlight.id, sharedHighlight);

      return {
        success: true,
        sharedHighlight
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error sharing highlight'
      };
    }
  }

  /**
   * Update a shared highlight
   */
  async updateSharedHighlight(
    highlightId: string,
    updates: Partial<ComponentHighlight>
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.currentSession) {
      return { success: false, error: 'No active session' };
    }

    const existingHighlight = this.sharedHighlights.get(highlightId);
    if (!existingHighlight) {
      return { success: false, error: 'Highlight not found' };
    }

    // Check permissions
    if (!existingHighlight.permissions.canEdit) {
      return { success: false, error: 'No permission to edit this highlight' };
    }

    try {
      const updatedHighlight: SharedHighlight = {
        ...existingHighlight,
        ...updates,
        collaborativeData: {
          ...existingHighlight.collaborativeData,
          lastModifiedBy: 'current-user', // TODO: Get from auth context
          lastModifiedAt: new Date()
        }
      };

      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({
          type: 'highlight_updated',
          data: { highlightId, updates: updatedHighlight }
        }));
      }

      this.sharedHighlights.set(highlightId, updatedHighlight);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error updating highlight'
      };
    }
  }

  /**
   * Delete a shared highlight
   */
  async deleteSharedHighlight(highlightId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.currentSession) {
      return { success: false, error: 'No active session' };
    }

    const existingHighlight = this.sharedHighlights.get(highlightId);
    if (!existingHighlight) {
      return { success: false, error: 'Highlight not found' };
    }

    // Check permissions
    if (!existingHighlight.permissions.canDelete) {
      return { success: false, error: 'No permission to delete this highlight' };
    }

    try {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({
          type: 'highlight_deleted',
          data: { highlightId }
        }));
      }

      this.sharedHighlights.delete(highlightId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error deleting highlight'
      };
    }
  }

  /**
   * Add comment to a shared highlight
   */
  async addHighlightComment(
    highlightId: string,
    text: string,
    parentCommentId?: string
  ): Promise<{ success: boolean; comment?: HighlightComment; error?: string }> {
    if (!this.currentSession) {
      return { success: false, error: 'No active session' };
    }

    try {
      const comment: HighlightComment = {
        id: this.generateId(),
        authorId: 'current-user', // TODO: Get from auth context
        authorName: 'Current User', // TODO: Get from auth context
        text,
        createdAt: new Date(),
        parentCommentId
      };

      const highlight = this.sharedHighlights.get(highlightId);
      if (highlight) {
        const updatedHighlight: SharedHighlight = {
          ...highlight,
          collaborativeData: {
            ...highlight.collaborativeData,
            comments: [...(highlight.collaborativeData?.comments || []), comment],
            reactions: highlight.collaborativeData?.reactions || []
          }
        };

        this.sharedHighlights.set(highlightId, updatedHighlight);

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({
            type: 'comment_added',
            data: { highlightId, comment }
          }));
        }
      }

      return { success: true, comment };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error adding comment'
      };
    }
  }

  /**
   * Add reaction to a shared highlight
   */
  async addHighlightReaction(
    highlightId: string,
    type: HighlightReaction['type'],
    customEmoji?: string
  ): Promise<{ success: boolean; reaction?: HighlightReaction; error?: string }> {
    if (!this.currentSession) {
      return { success: false, error: 'No active session' };
    }

    try {
      const reaction: HighlightReaction = {
        id: this.generateId(),
        authorId: 'current-user', // TODO: Get from auth context
        authorName: 'Current User', // TODO: Get from auth context
        type,
        customEmoji,
        createdAt: new Date()
      };

      const highlight = this.sharedHighlights.get(highlightId);
      if (highlight) {
        const updatedHighlight: SharedHighlight = {
          ...highlight,
          collaborativeData: {
            ...highlight.collaborativeData,
            comments: highlight.collaborativeData?.comments || [],
            reactions: [...(highlight.collaborativeData?.reactions || []), reaction]
          }
        };

        this.sharedHighlights.set(highlightId, updatedHighlight);

        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({
            type: 'reaction_added',
            data: { highlightId, reaction }
          }));
        }
      }

      return { success: true, reaction };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error adding reaction'
      };
    }
  }

  /**
   * Share viewport state with other participants
   */
  shareViewport(viewport: ViewportState): void {
    if (!this.currentSession || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify({
      type: 'viewport_shared',
      data: {
        viewport,
        followable: true,
        lastUpdated: new Date()
      }
    }));
  }

  /**
   * Follow another participant's viewport
   */
  followParticipant(participantId: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify({
      type: 'follow_participant',
      data: { participantId }
    }));
  }

  /**
   * Get current session data
   */
  getCurrentSessionData(): ShareableHighlightData | null {
    if (!this.currentSession) {
      return null;
    }

    return {
      session: this.currentSession,
      highlights: Array.from(this.sharedHighlights.values()),
      groups: [], // TODO: Implement group sharing
      participants: Array.from(this.participants.values()),
      viewports: [], // TODO: Track participant viewports
      version: 1,
      lastSynced: new Date()
    };
  }

  /**
   * Register event handler
   */
  on(event: string, handler: Function): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)!.push(handler);
  }

  /**
   * Unregister event handler
   */
  off(event: string, handler: Function): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  private async connectToSession(sessionId: string): Promise<void> {
    const wsUrl = `${this.baseUrl.replace('http', 'ws')}/ws/sharing/${sessionId}`;
    
    try {
      this.socket = new WebSocket(wsUrl);
      
      this.socket.onopen = () => {
        console.log('Connected to collaborative session');
        this.reconnectAttempts = 0;
        this.emit('connected');
      };

      this.socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.socket.onclose = () => {
        console.log('Disconnected from collaborative session');
        this.emit('disconnected');
        this.attemptReconnect(sessionId);
      };

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };
    } catch (error) {
      console.error('Failed to connect to session:', error);
      throw error;
    }
  }

  /**
   * Attempt to reconnect to session
   */
  private attemptReconnect(sessionId: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('reconnect_failed');
      return;
    }

    const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
    this.reconnectAttempts++;

    setTimeout(() => {
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.connectToSession(sessionId);
    }, delay);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: any): void {
    switch (message.type) {
      case 'highlight_shared':
        this.sharedHighlights.set(message.data.highlight.id, message.data.highlight);
        this.emit('highlight_shared', message.data.highlight);
        break;

      case 'highlight_updated':
        this.sharedHighlights.set(message.data.highlightId, message.data.updates);
        this.emit('highlight_updated', message.data);
        break;

      case 'highlight_deleted':
        this.sharedHighlights.delete(message.data.highlightId);
        this.emit('highlight_deleted', message.data.highlightId);
        break;

      case 'comment_added':
        this.emit('comment_added', message.data);
        break;

      case 'reaction_added':
        this.emit('reaction_added', message.data);
        break;

      case 'participant_joined':
        this.participants.set(message.data.participant.id, message.data.participant);
        this.emit('participant_joined', message.data.participant);
        break;

      case 'participant_left':
        this.participants.delete(message.data.participantId);
        this.emit('participant_left', message.data.participantId);
        break;

      case 'viewport_shared':
        this.emit('viewport_shared', message.data);
        break;

      default:
        console.warn('Unknown message type:', message.type);
    }
  }

  /**
   * Setup message handlers
   */
  private setupMessageHandlers(): void {
    // Default handlers are set up in handleMessage method
  }

  /**
   * Emit event to registered handlers
   */
  private emit(event: string, data?: any): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in event handler:', error);
        }
      });
    }
  }

  /**
   * Convert regular highlight to shared highlight
   */
  private convertToSharedHighlight(highlight: ComponentHighlight): SharedHighlight {
    return {
      ...highlight,
      createdBy: 'current-user', // TODO: Get from auth context
      sharedAt: new Date(),
      permissions: {
        canEdit: true,
        canDelete: true,
        canMove: true
      },
      collaborativeData: {
        comments: [],
        reactions: []
      }
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.leaveSession();
    this.messageHandlers.clear();
  }
}

// Singleton instance
let highlightSharingServiceInstance: HighlightSharingService | null = null;

export function getHighlightSharingService(): HighlightSharingService {
  if (!highlightSharingServiceInstance) {
    highlightSharingServiceInstance = new HighlightSharingService(
      process.env.REACT_APP_API_BASE_URL || ''
    );
  }
  return highlightSharingServiceInstance;
}