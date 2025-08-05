/**
 * Highlight Navigation Service
 * Provides navigation between highlighted components and areas
 */

import type {
  ComponentHighlight,
  ViewportState,
  Point
} from '../types/highlighting.types';

export interface NavigationTarget {
  readonly id: string;
  readonly highlightId: string;
  readonly title: string;
  readonly description?: string;
  readonly position: Point;
  readonly bounds: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };
  readonly type: string;
  readonly isVisible: boolean;
  readonly distance?: number; // Distance from current position
}

export interface NavigationPath {
  readonly id: string;
  readonly name: string;
  readonly targets: NavigationTarget[];
  readonly totalDistance: number;
  readonly estimatedTime: number; // seconds
  readonly description?: string;
}

export interface NavigationState {
  readonly currentTargetId: string | null;
  readonly currentIndex: number;
  readonly totalTargets: number;
  readonly path: NavigationPath | null;
  readonly history: string[]; // IDs of visited targets
  readonly bookmarks: string[]; // IDs of bookmarked targets
}

export interface NavigationOptions {
  readonly animationDuration?: number;
  readonly padding?: number; // Viewport padding around target
  readonly autoAdvance?: boolean;
  readonly autoAdvanceDelay?: number;
  readonly includeHidden?: boolean;
  readonly sortBy?: 'distance' | 'creation_time' | 'name' | 'type';
  readonly groupBy?: 'type' | 'area' | 'circuit' | 'none';
  readonly enableHistory?: boolean;
  readonly maxHistorySize?: number;
}

export interface NavigationTour {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly path: NavigationPath;
  readonly isGuided: boolean;
  readonly narration?: NavigationNarration[];
}

export interface NavigationNarration {
  readonly targetId: string;
  readonly title: string;
  readonly content: string;
  readonly duration?: number;
  readonly voiceOver?: boolean;
}

export interface SearchResult {
  readonly highlightId: string;
  readonly target: NavigationTarget;
  readonly relevanceScore: number;
  readonly matchedTerms: string[];
}

export class HighlightNavigationService {
  private currentState: NavigationState = {
    currentTargetId: null,
    currentIndex: -1,
    totalTargets: 0,
    path: null,
    history: [],
    bookmarks: []
  };

  private options: Required<NavigationOptions> = {
    animationDuration: 800,
    padding: 50,
    autoAdvance: false,
    autoAdvanceDelay: 3000,
    includeHidden: false,
    sortBy: 'distance',
    groupBy: 'none',
    enableHistory: true,
    maxHistorySize: 50
  };

  private navigationTargets: Map<string, NavigationTarget> = new Map();
  private eventListeners: Map<string, Function[]> = new Map();
  private autoAdvanceTimer: number | null = null;

  constructor(options: Partial<NavigationOptions> = {}) {
    this.options = { ...this.options, ...options };
  }

  /**
   * Build navigation targets from highlights
   */
  buildNavigationTargets(
    highlights: ComponentHighlight[],
    currentPosition?: Point
  ): NavigationTarget[] {
    const targets: NavigationTarget[] = [];
    
    highlights.forEach(highlight => {
      if (!this.options.includeHidden && !highlight.isVisible) {
        return;
      }

      const target: NavigationTarget = {
        id: `target_${highlight.id}`,
        highlightId: highlight.id,
        title: highlight.componentId || `Highlight ${highlight.id.slice(-4)}`,
        description: this.generateTargetDescription(highlight),
        position: {
          x: highlight.coordinates.x,
          y: highlight.coordinates.y
        },
        bounds: this.calculateTargetBounds(highlight),
        type: highlight.type,
        isVisible: highlight.isVisible,
        distance: currentPosition ? this.calculateDistance(currentPosition, {
          x: highlight.coordinates.x,
          y: highlight.coordinates.y
        }) : undefined
      };

      targets.push(target);
      this.navigationTargets.set(target.id, target);
    });

    return this.sortTargets(targets);
  }

  /**
   * Create navigation path from targets
   */
  createNavigationPath(
    targets: NavigationTarget[],
    name: string,
    description?: string
  ): NavigationPath {
    const optimizedTargets = this.optimizeNavigationOrder(targets);
    const totalDistance = this.calculatePathDistance(optimizedTargets);
    const estimatedTime = this.estimateNavigationTime(optimizedTargets);

    const path: NavigationPath = {
      id: this.generateId(),
      name,
      targets: optimizedTargets,
      totalDistance,
      estimatedTime,
      description
    };

    this.currentState = {
      ...this.currentState,
      path,
      totalTargets: optimizedTargets.length,
      currentIndex: -1,
      currentTargetId: null
    };

    return path;
  }

  /**
   * Start navigation tour
   */
  startNavigation(
    path?: NavigationPath,
    startIndex: number = 0
  ): Promise<{ success: boolean; target?: NavigationTarget; error?: string }> {
    const navigationPath = path || this.currentState.path;
    
    if (!navigationPath || navigationPath.targets.length === 0) {
      return Promise.resolve({
        success: false,
        error: 'No navigation path available'
      });
    }

    const targetIndex = Math.max(0, Math.min(startIndex, navigationPath.targets.length - 1));
    const target = navigationPath.targets[targetIndex];

    this.currentState = {
      ...this.currentState,
      path: navigationPath,
      currentIndex: targetIndex,
      currentTargetId: target.id,
      totalTargets: navigationPath.targets.length
    };

    this.addToHistory(target.id);
    this.emit('navigation_started', { target, path: navigationPath });

    return this.navigateToTarget(target);
  }

  /**
   * Navigate to next target
   */
  navigateNext(): Promise<{ success: boolean; target?: NavigationTarget; error?: string }> {
    if (!this.currentState.path) {
      return Promise.resolve({ success: false, error: 'No active navigation path' });
    }

    const nextIndex = this.currentState.currentIndex + 1;
    if (nextIndex >= this.currentState.totalTargets) {
      this.emit('navigation_completed');
      return Promise.resolve({ success: false, error: 'End of navigation path reached' });
    }

    const target = this.currentState.path.targets[nextIndex];
    this.currentState = {
      ...this.currentState,
      currentIndex: nextIndex,
      currentTargetId: target.id
    };

    this.addToHistory(target.id);
    this.emit('navigation_next', { target, index: nextIndex });

    return this.navigateToTarget(target);
  }

  /**
   * Navigate to previous target
   */
  navigatePrevious(): Promise<{ success: boolean; target?: NavigationTarget; error?: string }> {
    if (!this.currentState.path) {
      return Promise.resolve({ success: false, error: 'No active navigation path' });
    }

    const prevIndex = this.currentState.currentIndex - 1;
    if (prevIndex < 0) {
      return Promise.resolve({ success: false, error: 'Beginning of navigation path reached' });
    }

    const target = this.currentState.path.targets[prevIndex];
    this.currentState = {
      ...this.currentState,
      currentIndex: prevIndex,
      currentTargetId: target.id
    };

    this.addToHistory(target.id);
    this.emit('navigation_previous', { target, index: prevIndex });

    return this.navigateToTarget(target);
  }

  /**
   * Navigate to specific target by ID
   */
  navigateToTargetById(targetId: string): Promise<{ success: boolean; target?: NavigationTarget; error?: string }> {
    const target = this.navigationTargets.get(targetId);
    if (!target) {
      return Promise.resolve({ success: false, error: 'Target not found' });
    }

    // Update current state if target is in current path
    if (this.currentState.path) {
      const targetIndex = this.currentState.path.targets.findIndex(t => t.id === targetId);
      if (targetIndex !== -1) {
        this.currentState = {
          ...this.currentState,
          currentIndex: targetIndex,
          currentTargetId: targetId
        };
      }
    }

    this.addToHistory(targetId);
    this.emit('navigation_jump', { target });

    return this.navigateToTarget(target);
  }

  /**
   * Search navigation targets
   */
  searchTargets(query: string, maxResults: number = 10): SearchResult[] {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 0);

    for (const target of this.navigationTargets.values()) {
      const searchableText = [
        target.title,
        target.description || '',
        target.type,
        target.highlightId
      ].join(' ').toLowerCase();

      const matchedTerms: string[] = [];
      let relevanceScore = 0;

      queryTerms.forEach(term => {
        if (searchableText.includes(term)) {
          matchedTerms.push(term);
          relevanceScore += 1;

          // Boost score for exact title matches
          if (target.title.toLowerCase().includes(term)) {
            relevanceScore += 2;
          }

          // Boost score for type matches
          if (target.type.toLowerCase().includes(term)) {
            relevanceScore += 1.5;
          }
        }
      });

      if (matchedTerms.length > 0) {
        results.push({
          highlightId: target.highlightId,
          target,
          relevanceScore,
          matchedTerms
        });
      }
    }

    return results
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  }

  /**
   * Create guided tour
   */
  createGuidedTour(
    targets: NavigationTarget[],
    tourName: string,
    description: string,
    narrations: NavigationNarration[]
  ): NavigationTour {
    const path = this.createNavigationPath(targets, tourName, description);
    
    return {
      id: this.generateId(),
      name: tourName,
      description,
      path,
      isGuided: true,
      narration: narrations
    };
  }

  /**
   * Get navigation suggestions based on current position
   */
  getNavigationSuggestions(
    currentPosition: Point,
    maxSuggestions: number = 5
  ): NavigationTarget[] {
    const suggestions: NavigationTarget[] = [];

    for (const target of this.navigationTargets.values()) {
      if (!target.isVisible && !this.options.includeHidden) continue;
      if (target.id === this.currentState.currentTargetId) continue;

      const distance = this.calculateDistance(currentPosition, target.position);
      suggestions.push({ ...target, distance });
    }

    return suggestions
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, maxSuggestions);
  }

  /**
   * Bookmark a target
   */
  bookmarkTarget(targetId: string): boolean {
    if (!this.navigationTargets.has(targetId)) {
      return false;
    }

    if (!this.currentState.bookmarks.includes(targetId)) {
      this.currentState = {
        ...this.currentState,
        bookmarks: [...this.currentState.bookmarks, targetId]
      };
      this.emit('target_bookmarked', { targetId });
    }

    return true;
  }

  /**
   * Remove bookmark
   */
  removeBookmark(targetId: string): boolean {
    const index = this.currentState.bookmarks.indexOf(targetId);
    if (index === -1) {
      return false;
    }

    this.currentState = {
      ...this.currentState,
      bookmarks: this.currentState.bookmarks.filter(id => id !== targetId)
    };

    this.emit('bookmark_removed', { targetId });
    return true;
  }

  /**
   * Get bookmarked targets
   */
  getBookmarkedTargets(): NavigationTarget[] {
    return this.currentState.bookmarks
      .map(id => this.navigationTargets.get(id))
      .filter((target): target is NavigationTarget => target !== undefined);
  }

  /**
   * Enable/disable auto-advance
   */
  setAutoAdvance(enabled: boolean, delay?: number): void {
    this.options.autoAdvance = enabled;
    if (delay !== undefined) {
      this.options.autoAdvanceDelay = delay;
    }

    if (enabled && this.currentState.currentTargetId) {
      this.startAutoAdvanceTimer();
    } else {
      this.stopAutoAdvanceTimer();
    }
  }

  /**
   * Get current navigation state
   */
  getCurrentState(): NavigationState {
    return { ...this.currentState };
  }

  /**
   * Register event listener
   */
  on(event: string, handler: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(handler);
  }

  /**
   * Unregister event listener
   */
  off(event: string, handler: Function): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Navigate to target (implementation depends on viewport control)
   */
  private async navigateToTarget(target: NavigationTarget): Promise<{
    success: boolean;
    target?: NavigationTarget;
    error?: string;
  }> {
    try {
      // This would typically integrate with the viewport/camera system
      // For now, we emit an event that the UI can listen to
      this.emit('navigate_to_target', {
        target,
        options: {
          duration: this.options.animationDuration,
          padding: this.options.padding
        }
      });

      // Start auto-advance timer if enabled
      if (this.options.autoAdvance) {
        this.startAutoAdvanceTimer();
      }

      return { success: true, target };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Navigation failed'
      };
    }
  }

  /**
   * Sort targets based on options
   */
  private sortTargets(targets: NavigationTarget[]): NavigationTarget[] {
    switch (this.options.sortBy) {
      case 'distance':
        return targets.sort((a, b) => (a.distance || 0) - (b.distance || 0));
      case 'name':
        return targets.sort((a, b) => a.title.localeCompare(b.title));
      case 'type':
        return targets.sort((a, b) => a.type.localeCompare(b.type));
      case 'creation_time':
      default:
        return targets; // Maintain original order
    }
  }

  /**
   * Optimize navigation order for efficient traversal
   */
  private optimizeNavigationOrder(targets: NavigationTarget[]): NavigationTarget[] {
    if (targets.length <= 2) return targets;

    // Simple nearest neighbor algorithm
    const optimized: NavigationTarget[] = [];
    const remaining = [...targets];
    
    // Start with first target
    let current = remaining.shift()!;
    optimized.push(current);

    while (remaining.length > 0) {
      // Find nearest remaining target
      let nearestIndex = 0;
      let nearestDistance = this.calculateDistance(current.position, remaining[0].position);

      for (let i = 1; i < remaining.length; i++) {
        const distance = this.calculateDistance(current.position, remaining[i].position);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      current = remaining.splice(nearestIndex, 1)[0];
      optimized.push(current);
    }

    return optimized;
  }

  /**
   * Calculate total path distance
   */
  private calculatePathDistance(targets: NavigationTarget[]): number {
    let totalDistance = 0;
    
    for (let i = 1; i < targets.length; i++) {
      totalDistance += this.calculateDistance(targets[i - 1].position, targets[i].position);
    }

    return totalDistance;
  }

  /**
   * Estimate navigation time
   */
  private estimateNavigationTime(targets: NavigationTarget[]): number {
    // Base time per target + animation time
    const baseTimePerTarget = 2; // seconds
    const animationTime = (this.options.animationDuration / 1000) * targets.length;
    
    return (baseTimePerTarget * targets.length) + animationTime;
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(point1: Point, point2: Point): number {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Generate target description
   */
  private generateTargetDescription(highlight: ComponentHighlight): string {
    const type = highlight.type.charAt(0).toUpperCase() + highlight.type.slice(1);
    const position = `at (${Math.round(highlight.coordinates.x * 100)}%, ${Math.round(highlight.coordinates.y * 100)}%)`;
    
    return `${type} highlight ${position}`;
  }

  /**
   * Calculate target bounds
   */
  private calculateTargetBounds(highlight: ComponentHighlight): NavigationTarget['bounds'] {
    const { x, y, width = 0.05, height = 0.05 } = highlight.coordinates;
    
    return {
      left: x - width / 2,
      top: y - height / 2,
      right: x + width / 2,
      bottom: y + height / 2
    };
  }

  /**
   * Add target to history
   */
  private addToHistory(targetId: string): void {
    if (!this.options.enableHistory) return;

    const history = this.currentState.history.filter(id => id !== targetId);
    history.push(targetId);

    if (history.length > this.options.maxHistorySize) {
      history.shift();
    }

    this.currentState = {
      ...this.currentState,
      history
    };
  }

  /**
   * Start auto-advance timer
   */
  private startAutoAdvanceTimer(): void {
    this.stopAutoAdvanceTimer();
    
    this.autoAdvanceTimer = window.setTimeout(() => {
      this.navigateNext();
    }, this.options.autoAdvanceDelay);
  }

  /**
   * Stop auto-advance timer
   */
  private stopAutoAdvanceTimer(): void {
    if (this.autoAdvanceTimer) {
      clearTimeout(this.autoAdvanceTimer);
      this.autoAdvanceTimer = null;
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data?: any): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in navigation event handler:', error);
        }
      });
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `nav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopAutoAdvanceTimer();
    this.eventListeners.clear();
    this.navigationTargets.clear();
    
    this.currentState = {
      currentTargetId: null,
      currentIndex: -1,
      totalTargets: 0,
      path: null,
      history: [],
      bookmarks: []
    };
  }
}

// Singleton instance
let highlightNavigationServiceInstance: HighlightNavigationService | null = null;

export function getHighlightNavigationService(options?: Partial<NavigationOptions>): HighlightNavigationService {
  if (!highlightNavigationServiceInstance) {
    highlightNavigationServiceInstance = new HighlightNavigationService(options);
  }
  return highlightNavigationServiceInstance;
}