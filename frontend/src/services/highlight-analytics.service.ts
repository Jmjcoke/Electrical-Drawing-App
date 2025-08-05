/**
 * Highlight Analytics Service
 * Tracks usage patterns and performance metrics for highlighting system optimization
 */

import type {
  ComponentHighlight,
  ViewportState,
  HighlightStyle
} from '../types/highlighting.types';

export interface HighlightEvent {
  readonly id: string;
  readonly type: HighlightEventType;
  readonly timestamp: Date;
  readonly sessionId: string;
  readonly userId?: string;
  readonly highlightId?: string;
  readonly data: Record<string, any>;
  readonly performance?: PerformanceData;
}

export type HighlightEventType =
  | 'highlight_created'
  | 'highlight_selected'
  | 'highlight_edited'
  | 'highlight_deleted'
  | 'highlight_visibility_toggled'
  | 'highlight_style_changed'
  | 'highlight_moved'
  | 'highlight_copied'
  | 'highlight_exported'
  | 'highlight_shared'
  | 'highlight_focused'
  | 'highlight_hovered'
  | 'navigation_used'
  | 'accessibility_toggled'
  | 'performance_threshold_exceeded'
  | 'rendering_optimized'
  | 'lazy_loading_triggered'
  | 'user_interaction'
  | 'error_occurred';

export interface PerformanceData {
  readonly renderTime: number;
  readonly memoryUsage: number;
  readonly highlightCount: number;
  readonly fps: number;
  readonly viewportCulled: number;
  readonly cacheHits: number;
  readonly cacheMisses: number;
}

export interface UsagePattern {
  readonly type: string;
  readonly frequency: number;
  readonly averageDuration: number;
  readonly timeOfDay: number[]; // Hours 0-23
  readonly dayOfWeek: number[]; // Days 0-6 (Sunday=0)
  readonly associatedFeatures: string[];
}

export interface PerformanceMetrics {
  readonly averageRenderTime: number;
  readonly p95RenderTime: number;
  readonly averageMemoryUsage: number;
  readonly averageFPS: number;
  readonly totalHighlightsRendered: number;
  readonly cullRatio: number; // Percentage of highlights culled
  readonly cacheHitRatio: number;
  readonly lazyLoadingEffectiveness: number;
}

export interface UserBehaviorInsights {
  readonly mostUsedFeatures: string[];
  readonly averageSessionDuration: number;
  readonly highlightsPerSession: number;
  readonly preferredHighlightTypes: string[];
  readonly commonNavigationPatterns: string[];
  readonly accessibilityUsage: number; // Percentage of sessions using accessibility features
  readonly exportFrequency: number;
  readonly sharingFrequency: number;
}

export interface AnalyticsReport {
  readonly generatedAt: Date;
  readonly period: {
    readonly start: Date;
    readonly end: Date;
  };
  readonly totalEvents: number;
  readonly uniqueSessions: number;
  readonly uniqueUsers: number;
  readonly usagePatterns: UsagePattern[];
  readonly performanceMetrics: PerformanceMetrics;
  readonly userBehaviorInsights: UserBehaviorInsights;
  readonly recommendations: string[];
  readonly errorSummary: {
    readonly totalErrors: number;
    readonly errorTypes: Record<string, number>;
    readonly commonErrorMessages: string[];
  };
}

export interface AnalyticsConfig {
  readonly enableTracking: boolean;
  readonly enablePerformanceTracking: boolean;
  readonly enableUserBehaviorTracking: boolean;
  readonly enableErrorTracking: boolean;
  readonly sampleRate: number; // 0.0 to 1.0
  readonly batchSize: number;
  readonly flushInterval: number; // milliseconds
  readonly retentionDays: number;
  readonly anonymizeUserId: boolean;
}

export class HighlightAnalyticsService {
  private events: HighlightEvent[] = [];
  private performanceBuffer: PerformanceData[] = [];
  private config: AnalyticsConfig;
  private flushTimer: number | null = null;
  private sessionStartTime: Date = new Date();
  private currentSessionId: string;
  private eventQueue: HighlightEvent[] = [];

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      enableTracking: true,
      enablePerformanceTracking: true,
      enableUserBehaviorTracking: true,
      enableErrorTracking: true,
      sampleRate: 1.0,
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
      retentionDays: 30,
      anonymizeUserId: true,
      ...config
    };

    this.currentSessionId = this.generateSessionId();
    this.startPeriodicFlush();
  }

  /**
   * Track a highlight event
   */
  trackEvent(
    type: HighlightEventType,
    data: Record<string, any> = {},
    highlightId?: string,
    performance?: PerformanceData
  ): void {
    if (!this.config.enableTracking) return;
    if (Math.random() > this.config.sampleRate) return;

    const event: HighlightEvent = {
      id: this.generateEventId(),
      type,
      timestamp: new Date(),
      sessionId: this.currentSessionId,
      userId: this.getUserId(),
      highlightId,
      data,
      performance
    };

    this.events.push(event);
    this.eventQueue.push(event);

    // Flush if batch size reached
    if (this.eventQueue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Track highlight creation
   */
  trackHighlightCreated(highlight: ComponentHighlight, method: 'manual' | 'automatic' | 'imported'): void {
    this.trackEvent('highlight_created', {
      highlightType: highlight.type,
      method,
      coordinates: highlight.coordinates,
      style: highlight.style,
      isPersistent: highlight.isPersistent
    }, highlight.id);
  }

  /**
   * Track highlight interaction
   */
  trackHighlightInteraction(
    type: 'selected' | 'hovered' | 'focused',
    highlightId: string,
    interactionData: Record<string, any> = {}
  ): void {
    const eventType = type === 'selected' ? 'highlight_selected' :
                     type === 'hovered' ? 'highlight_hovered' : 'highlight_focused';
    
    this.trackEvent(eventType, {
      interactionMethod: interactionData.method || 'click',
      ...interactionData
    }, highlightId);
  }

  /**
   * Track performance metrics
   */
  trackPerformance(performance: PerformanceData): void {
    if (!this.config.enablePerformanceTracking) return;

    this.performanceBuffer.push(performance);

    // Track performance threshold exceeded events
    if (performance.renderTime > 100) { // 100ms threshold
      this.trackEvent('performance_threshold_exceeded', {
        metric: 'renderTime',
        value: performance.renderTime,
        threshold: 100
      });
    }

    if (performance.fps < 30) { // 30 FPS threshold
      this.trackEvent('performance_threshold_exceeded', {
        metric: 'fps',
        value: performance.fps,
        threshold: 30
      });
    }

    // Keep buffer size manageable
    if (this.performanceBuffer.length > 1000) {
      this.performanceBuffer = this.performanceBuffer.slice(-500);
    }
  }

  /**
   * Track rendering optimization
   */
  trackRenderingOptimization(optimizationType: string, data: Record<string, any>): void {
    this.trackEvent('rendering_optimized', {
      optimizationType,
      ...data
    });
  }

  /**
   * Track lazy loading usage
   */
  trackLazyLoading(data: {
    totalHighlights: number;
    chunksLoaded: number;
    loadTime: number;
  }): void {
    this.trackEvent('lazy_loading_triggered', data);
  }

  /**
   * Track user navigation patterns
   */
  trackNavigation(
    navigationType: 'keyboard' | 'mouse' | 'touch' | 'programmatic',
    target: string,
    data: Record<string, any> = {}
  ): void {
    this.trackEvent('navigation_used', {
      navigationType,
      target,
      ...data
    });
  }

  /**
   * Track accessibility feature usage
   */
  trackAccessibilityUsage(feature: string, action: string, data: Record<string, any> = {}): void {
    this.trackEvent('accessibility_toggled', {
      feature,
      action,
      ...data
    });
  }

  /**
   * Track export operations
   */
  trackExport(format: string, highlightCount: number, success: boolean, data: Record<string, any> = {}): void {
    this.trackEvent('highlight_exported', {
      format,
      highlightCount,
      success,
      ...data
    });
  }

  /**
   * Track sharing operations
   */
  trackSharing(action: string, data: Record<string, any> = {}): void {
    this.trackEvent('highlight_shared', {
      action,
      ...data
    });
  }

  /**
   * Track errors
   */
  trackError(error: Error, context: string, highlightId?: string): void {
    if (!this.config.enableErrorTracking) return;

    this.trackEvent('error_occurred', {
      errorMessage: error.message,
      errorName: error.name,
      errorStack: error.stack,
      context
    }, highlightId);
  }

  /**
   * Generate analytics report
   */
  generateReport(
    startDate: Date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
    endDate: Date = new Date()
  ): AnalyticsReport {
    const relevantEvents = this.events.filter(
      e => e.timestamp >= startDate && e.timestamp <= endDate
    );

    const relevantPerformance = this.performanceBuffer.filter(
      p => relevantEvents.some(e => e.performance === p)
    );

    return {
      generatedAt: new Date(),
      period: { start: startDate, end: endDate },
      totalEvents: relevantEvents.length,
      uniqueSessions: new Set(relevantEvents.map(e => e.sessionId)).size,
      uniqueUsers: new Set(relevantEvents.map(e => e.userId).filter(Boolean)).size,
      usagePatterns: this.analyzeUsagePatterns(relevantEvents),
      performanceMetrics: this.analyzePerformance(relevantPerformance),
      userBehaviorInsights: this.analyzeUserBehavior(relevantEvents),
      recommendations: this.generateRecommendations(relevantEvents, relevantPerformance),
      errorSummary: this.analyzeErrors(relevantEvents)
    };
  }

  /**
   * Get real-time performance metrics
   */
  getRealTimeMetrics(): {
    currentFPS: number;
    averageRenderTime: number;
    memoryUsage: number;
    highlightCount: number;
    cacheHitRatio: number;
  } {
    const recentPerformance = this.performanceBuffer.slice(-10);
    
    return {
      currentFPS: recentPerformance[recentPerformance.length - 1]?.fps || 0,
      averageRenderTime: recentPerformance.reduce((sum, p) => sum + p.renderTime, 0) / recentPerformance.length || 0,
      memoryUsage: recentPerformance[recentPerformance.length - 1]?.memoryUsage || 0,
      highlightCount: recentPerformance[recentPerformance.length - 1]?.highlightCount || 0,
      cacheHitRatio: recentPerformance.length > 0 
        ? recentPerformance.reduce((sum, p) => sum + (p.cacheHits / (p.cacheHits + p.cacheMisses)), 0) / recentPerformance.length
        : 0
    };
  }

  /**
   * Clear old events based on retention policy
   */
  cleanup(): void {
    const cutoffDate = new Date(Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000);
    this.events = this.events.filter(e => e.timestamp >= cutoffDate);
  }

  /**
   * Flush queued events to server
   */
  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToFlush = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Send to analytics endpoint
      await fetch('/api/analytics/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events: eventsToFlush,
          sessionId: this.currentSessionId
        }),
      });
    } catch (error) {
      console.error('Failed to flush analytics events:', error);
      // Re-queue events for retry
      this.eventQueue.unshift(...eventsToFlush);
    }
  }

  /**
   * Start periodic flush timer
   */
  private startPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = window.setInterval(() => {
      this.flush();
      this.cleanup();
    }, this.config.flushInterval);
  }

  /**
   * Analyze usage patterns
   */
  private analyzeUsagePatterns(events: HighlightEvent[]): UsagePattern[] {
    const patterns: Record<string, {
      frequency: number;
      durations: number[];
      hours: number[];
      days: number[];
      features: Set<string>;
    }> = {};

    events.forEach(event => {
      if (!patterns[event.type]) {
        patterns[event.type] = {
          frequency: 0,
          durations: [],
          hours: [],
          days: [],
          features: new Set()
        };
      }

      patterns[event.type].frequency++;
      patterns[event.type].hours.push(event.timestamp.getHours());
      patterns[event.type].days.push(event.timestamp.getDay());
      
      // Track associated features
      Object.keys(event.data).forEach(key => {
        patterns[event.type].features.add(key);
      });
    });

    return Object.entries(patterns).map(([type, data]) => ({
      type,
      frequency: data.frequency,
      averageDuration: data.durations.reduce((sum, d) => sum + d, 0) / data.durations.length || 0,
      timeOfDay: Array.from(new Set(data.hours)),
      dayOfWeek: Array.from(new Set(data.days)),
      associatedFeatures: Array.from(data.features)
    }));
  }

  /**
   * Analyze performance metrics
   */
  private analyzePerformance(performanceData: PerformanceData[]): PerformanceMetrics {
    if (performanceData.length === 0) {
      return {
        averageRenderTime: 0,
        p95RenderTime: 0,
        averageMemoryUsage: 0,
        averageFPS: 0,
        totalHighlightsRendered: 0,
        cullRatio: 0,
        cacheHitRatio: 0,
        lazyLoadingEffectiveness: 0
      };
    }

    const renderTimes = performanceData.map(p => p.renderTime).sort((a, b) => a - b);
    const p95Index = Math.floor(renderTimes.length * 0.95);

    return {
      averageRenderTime: renderTimes.reduce((sum, t) => sum + t, 0) / renderTimes.length,
      p95RenderTime: renderTimes[p95Index] || 0,
      averageMemoryUsage: performanceData.reduce((sum, p) => sum + p.memoryUsage, 0) / performanceData.length,
      averageFPS: performanceData.reduce((sum, p) => sum + p.fps, 0) / performanceData.length,
      totalHighlightsRendered: performanceData.reduce((sum, p) => sum + p.highlightCount, 0),
      cullRatio: performanceData.reduce((sum, p) => sum + (p.viewportCulled / p.highlightCount), 0) / performanceData.length,
      cacheHitRatio: performanceData.reduce((sum, p) => sum + (p.cacheHits / (p.cacheHits + p.cacheMisses)), 0) / performanceData.length,
      lazyLoadingEffectiveness: 0 // TODO: Calculate based on lazy loading events
    };
  }

  /**
   * Analyze user behavior
   */
  private analyzeUserBehavior(events: HighlightEvent[]): UserBehaviorInsights {
    const sessions = new Map<string, HighlightEvent[]>();
    events.forEach(event => {
      if (!sessions.has(event.sessionId)) {
        sessions.set(event.sessionId, []);
      }
      sessions.get(event.sessionId)!.push(event);
    });

    const featureUsage = new Map<string, number>();
    const highlightTypes = new Map<string, number>();
    let totalAccessibilityUsage = 0;
    let totalExports = 0;
    let totalShares = 0;

    events.forEach(event => {
      featureUsage.set(event.type, (featureUsage.get(event.type) || 0) + 1);
      
      if (event.type === 'highlight_created' && event.data.highlightType) {
        highlightTypes.set(event.data.highlightType, (highlightTypes.get(event.data.highlightType) || 0) + 1);
      }
      
      if (event.type === 'accessibility_toggled') totalAccessibilityUsage++;
      if (event.type === 'highlight_exported') totalExports++;
      if (event.type === 'highlight_shared') totalShares++;
    });

    const sessionDurations = Array.from(sessions.values()).map(sessionEvents => {
      const timestamps = sessionEvents.map(e => e.timestamp.getTime());
      return (Math.max(...timestamps) - Math.min(...timestamps)) / 1000; // seconds
    });

    return {
      mostUsedFeatures: Array.from(featureUsage.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([feature]) => feature),
      averageSessionDuration: sessionDurations.reduce((sum, d) => sum + d, 0) / sessionDurations.length || 0,
      highlightsPerSession: events.filter(e => e.type === 'highlight_created').length / sessions.size || 0,
      preferredHighlightTypes: Array.from(highlightTypes.entries())
        .sort(([,a], [,b]) => b - a)
        .map(([type]) => type),
      commonNavigationPatterns: [], // TODO: Implement pattern detection
      accessibilityUsage: (totalAccessibilityUsage / sessions.size) * 100 || 0,
      exportFrequency: totalExports / sessions.size || 0,
      sharingFrequency: totalShares / sessions.size || 0
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(events: HighlightEvent[], performance: PerformanceData[]): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    const avgRenderTime = performance.reduce((sum, p) => sum + p.renderTime, 0) / performance.length;
    if (avgRenderTime > 50) {
      recommendations.push('Consider enabling lazy loading for better performance with large highlight sets');
    }

    const avgFPS = performance.reduce((sum, p) => sum + p.fps, 0) / performance.length;
    if (avgFPS < 45) {
      recommendations.push('Frame rate is below optimal - consider optimizing rendering or reducing highlight complexity');
    }

    // Usage recommendations
    const accessibilityEvents = events.filter(e => e.type === 'accessibility_toggled').length;
    if (accessibilityEvents === 0) {
      recommendations.push('Consider promoting accessibility features to improve user experience');
    }

    const exportEvents = events.filter(e => e.type === 'highlight_exported').length;
    if (exportEvents > events.length * 0.1) {
      recommendations.push('High export usage detected - consider optimizing export performance');
    }

    return recommendations;
  }

  /**
   * Analyze errors
   */
  private analyzeErrors(events: HighlightEvent[]): AnalyticsReport['errorSummary'] {
    const errorEvents = events.filter(e => e.type === 'error_occurred');
    const errorTypes: Record<string, number> = {};
    const errorMessages: string[] = [];

    errorEvents.forEach(event => {
      const errorName = event.data.errorName || 'Unknown';
      errorTypes[errorName] = (errorTypes[errorName] || 0) + 1;
      
      if (event.data.errorMessage) {
        errorMessages.push(event.data.errorMessage);
      }
    });

    // Get most common error messages
    const messageCounts = errorMessages.reduce((acc, msg) => {
      acc[msg] = (acc[msg] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const commonMessages = Object.entries(messageCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([msg]) => msg);

    return {
      totalErrors: errorEvents.length,
      errorTypes,
      commonErrorMessages: commonMessages
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get user ID (anonymized if configured)
   */
  private getUserId(): string | undefined {
    if (!this.config.enableUserBehaviorTracking) return undefined;
    
    // TODO: Get actual user ID from auth context
    const userId = 'user_12345';
    
    if (this.config.anonymizeUserId) {
      // Simple hash for anonymization
      return btoa(userId).replace(/[^a-zA-Z0-9]/g, '').substr(0, 16);
    }
    
    return userId;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Final flush
    this.flush();
  }
}

// Singleton instance
let highlightAnalyticsServiceInstance: HighlightAnalyticsService | null = null;

export function getHighlightAnalyticsService(config?: Partial<AnalyticsConfig>): HighlightAnalyticsService {
  if (!highlightAnalyticsServiceInstance) {
    highlightAnalyticsServiceInstance = new HighlightAnalyticsService(config);
  }
  return highlightAnalyticsServiceInstance;
}