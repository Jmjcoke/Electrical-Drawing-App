// AI WebSocket Client for Real-time Analysis Updates - Story 3.2

import { io, Socket } from 'socket.io-client';
import { AIUpdate, AIUpdateType, AnalysisSession } from '@/types/ai/computerVision';

export interface AIWebSocketConfig {
  wsEndpoint: string;
  reconnectAttempts: number;
  reconnectDelay: number;
  timeout: number;
}

export interface AIAnalysisCallbacks {
  onComponentDetected?: (data: any) => void;
  onCloudDetected?: (data: any) => void;
  onCircuitTraced?: (data: any) => void;
  onEstimationUpdated?: (data: any) => void;
  onStageProgress?: (stage: string, progress: number) => void;
  onComplete?: (result: any) => void;
  onError?: (error: Error) => void;
  onConnectionStatusChange?: (status: WebSocketStatus) => void;
}

export interface AISubscription {
  id: string;
  analysisId: string;
  callbacks: AIAnalysisCallbacks;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  createdAt: Date;
}

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

export class AIWebSocketManager {
  private socket: Socket | null = null;
  private config: AIWebSocketConfig;
  private subscriptions: Map<string, AISubscription> = new Map();
  private reconnectAttempts = 0;
  private connectionStatus: WebSocketStatus = 'disconnected';
  private statusCallbacks: Set<(status: WebSocketStatus) => void> = new Set();
  private connectionQuality = {
    latency: 0,
    lastPing: Date.now(),
    packetLoss: 0,
    messagesReceived: 0,
    messagesLost: 0
  };

  constructor(config: Partial<AIWebSocketConfig> = {}) {
    this.config = {
      wsEndpoint: process.env.NEXT_PUBLIC_AI_WS_ENDPOINT || 'ws://localhost:8000',
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      timeout: 30000,
      ...config
    };
  }

  /**
   * Initialize WebSocket connection
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.setConnectionStatus('connecting');
        
        this.socket = io(this.config.wsEndpoint, {
          timeout: this.config.timeout,
          transports: ['websocket', 'polling'],
          auth: {
            token: this.getAuthToken()
          }
        });

        this.setupEventHandlers();
        
        this.socket.on('connect', () => {
          console.log('AI WebSocket connected');
          this.setConnectionStatus('connected');
          this.reconnectAttempts = 0;
          this.startConnectionMonitoring();
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('AI WebSocket connection error:', error);
          this.setConnectionStatus('error');
          this.handleReconnection();
          reject(error);
        });

      } catch (error) {
        console.error('Failed to initialize WebSocket:', error);
        this.setConnectionStatus('error');
        reject(error);
      }
    });
  }

  /**
   * Disconnect WebSocket
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.setConnectionStatus('disconnected');
    this.subscriptions.clear();
  }

  /**
   * Subscribe to AI analysis updates
   */
  public subscribeToAnalysis(
    analysisId: string,
    callbacks: AIAnalysisCallbacks
  ): AISubscription {
    const subscriptionId = `analysis-${analysisId}-${Date.now()}`;
    
    const subscription: AISubscription = {
      id: subscriptionId,
      analysisId,
      callbacks,
      status: 'connecting',
      createdAt: new Date()
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Ensure connection is established
    if (this.connectionStatus !== 'connected') {
      this.connect().then(() => {
        this.sendSubscriptionRequest(subscription);
      }).catch((error) => {
        subscription.status = 'error';
        callbacks.onError?.(error);
      });
    } else {
      this.sendSubscriptionRequest(subscription);
    }

    return subscription;
  }

  /**
   * Unsubscribe from analysis updates
   */
  public unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription && this.socket) {
      this.socket.emit('unsubscribe', {
        subscriptionId,
        analysisId: subscription.analysisId
      });
      this.subscriptions.delete(subscriptionId);
    }
  }

  /**
   * Get current connection status
   */
  public getConnectionStatus(): WebSocketStatus {
    return this.connectionStatus;
  }

  /**
   * Get connection quality metrics
   */
  public getConnectionQuality() {
    return { ...this.connectionQuality };
  }

  /**
   * Add connection status callback
   */
  public onStatusChange(callback: (status: WebSocketStatus) => void): () => void {
    this.statusCallbacks.add(callback);
    return () => this.statusCallbacks.delete(callback);
  }

  /**
   * Manual reconnection trigger
   */
  public reconnect(): Promise<void> {
    this.disconnect();
    return this.connect();
  }

  // Private methods

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      console.log('AI WebSocket disconnected:', reason);
      this.setConnectionStatus('disconnected');
      
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect automatically
        return;
      }
      
      this.handleReconnection();
    });

    this.socket.on('reconnect', () => {
      console.log('AI WebSocket reconnected');
      this.setConnectionStatus('connected');
      this.resubscribeAll();
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('AI WebSocket reconnection error:', error);
      this.setConnectionStatus('error');
    });

    // AI-specific event handlers
    this.socket.on('ai_update', (update: AIUpdate) => {
      this.handleAIUpdate(update);
    });

    this.socket.on('analysis_progress', (data: { analysisId: string; stage: string; progress: number }) => {
      this.handleProgressUpdate(data);
    });

    this.socket.on('analysis_complete', (data: { analysisId: string; result: any }) => {
      this.handleAnalysisComplete(data);
    });

    this.socket.on('analysis_error', (data: { analysisId: string; error: any }) => {
      this.handleAnalysisError(data);
    });

    // Connection monitoring
    this.socket.on('pong', () => {
      const now = Date.now();
      this.connectionQuality.latency = now - this.connectionQuality.lastPing;
      this.connectionQuality.messagesReceived++;
    });
  }

  private sendSubscriptionRequest(subscription: AISubscription): void {
    if (!this.socket) return;

    this.socket.emit('subscribe_analysis', {
      subscriptionId: subscription.id,
      analysisId: subscription.analysisId
    });

    subscription.status = 'connected';
  }

  private handleAIUpdate(update: AIUpdate): void {
    // Find relevant subscriptions for this analysis
    const relevantSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.analysisId === update.analysisId);

    relevantSubscriptions.forEach(subscription => {
      const { callbacks } = subscription;

      switch (update.type) {
        case AIUpdateType.COMPONENT_DETECTED:
          callbacks.onComponentDetected?.(update.data);
          break;
        case AIUpdateType.CLOUD_DETECTED:
          callbacks.onCloudDetected?.(update.data);
          break;
        case AIUpdateType.CIRCUIT_TRACED:
          callbacks.onCircuitTraced?.(update.data);
          break;
        case AIUpdateType.ESTIMATION_UPDATED:
          callbacks.onEstimationUpdated?.(update.data);
          break;
        case AIUpdateType.ERROR_OCCURRED:
          callbacks.onError?.(update.error || new Error('Unknown AI error'));
          break;
      }
    });
  }

  private handleProgressUpdate(data: { analysisId: string; stage: string; progress: number }): void {
    const relevantSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.analysisId === data.analysisId);

    relevantSubscriptions.forEach(subscription => {
      subscription.callbacks.onStageProgress?.(data.stage, data.progress);
    });
  }

  private handleAnalysisComplete(data: { analysisId: string; result: any }): void {
    const relevantSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.analysisId === data.analysisId);

    relevantSubscriptions.forEach(subscription => {
      subscription.callbacks.onComplete?.(data.result);
    });
  }

  private handleAnalysisError(data: { analysisId: string; error: any }): void {
    const relevantSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.analysisId === data.analysisId);

    relevantSubscriptions.forEach(subscription => {
      subscription.callbacks.onError?.(new Error(data.error.message || 'Analysis failed'));
    });
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.config.reconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.setConnectionStatus('error');
      return;
    }

    this.setConnectionStatus('reconnecting');
    this.reconnectAttempts++;

    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    setTimeout(() => {
      console.log(`Attempting to reconnect (attempt ${this.reconnectAttempts}/${this.config.reconnectAttempts})`);
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  private resubscribeAll(): void {
    this.subscriptions.forEach(subscription => {
      this.sendSubscriptionRequest(subscription);
    });
  }

  private setConnectionStatus(status: WebSocketStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status;
      this.statusCallbacks.forEach(callback => callback(status));
      
      // Notify all subscriptions
      this.subscriptions.forEach(subscription => {
        subscription.callbacks.onConnectionStatusChange?.(status);
      });
    }
  }

  private startConnectionMonitoring(): void {
    // Ping server every 10 seconds to monitor connection quality
    const pingInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.connectionQuality.lastPing = Date.now();
        this.socket.emit('ping');
      } else {
        clearInterval(pingInterval);
      }
    }, 10000);
  }

  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth-token');
    }
    return null;
  }
}

// Singleton instance for global use
export const aiWebSocketManager = new AIWebSocketManager();