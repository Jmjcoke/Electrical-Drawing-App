/**
 * Optimized Highlight Renderer
 * High-performance Canvas/WebGL-based rendering system for smooth real-time highlighting
 */

import type {
  ComponentHighlight,
  ViewportState,
  HighlightStyle
} from '../types/highlighting.types';

export interface RenderingOptions {
  readonly enableWebGL?: boolean;
  readonly maxHighlights?: number;
  readonly animationFPS?: number;
  readonly debounceInterval?: number;
  readonly enableBatching?: boolean;
  readonly cullingEnabled?: boolean;
  readonly viewportPadding?: number;
}

export interface RenderingMetrics {
  readonly renderTime: number;
  readonly highlightsRendered: number;
  readonly highlightsCulled: number;
  readonly frameRate: number;
  readonly memoryUsage: number;
}

export class OptimizedHighlightRenderer {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private webglCtx: WebGLRenderingContext | null = null;
  private animationFrameId: number | null = null;
  private lastRenderTime: number = 0;
  private frameCount: number = 0;
  private renderQueue: ComponentHighlight[] = [];
  private visibleHighlights: Set<string> = new Set();
  private highlightCache: Map<string, ImageData> = new Map();
  private debounceTimeout: number | null = null;
  
  private readonly options: Required<RenderingOptions>;
  private metrics: RenderingMetrics = {
    renderTime: 0,
    highlightsRendered: 0,
    highlightsCulled: 0,
    frameRate: 0,
    memoryUsage: 0
  };

  constructor(options: RenderingOptions = {}) {
    this.options = {
      enableWebGL: options.enableWebGL ?? true,
      maxHighlights: options.maxHighlights ?? 500,
      animationFPS: options.animationFPS ?? 60,
      debounceInterval: options.debounceInterval ?? 16, // ~60fps
      enableBatching: options.enableBatching ?? true,
      cullingEnabled: options.cullingEnabled ?? true,
      viewportPadding: options.viewportPadding ?? 100
    };
  }

  /**
   * Initialize the renderer with a canvas element
   */
  initialize(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas;
    
    try {
      // Try WebGL first if enabled
      if (this.options.enableWebGL) {
        this.webglCtx = canvas.getContext('webgl') as WebGLRenderingContext || canvas.getContext('experimental-webgl') as WebGLRenderingContext;
        if (this.webglCtx) {
          this.initializeWebGL();
          console.log('OptimizedHighlightRenderer: WebGL context initialized');
          return true;
        }
      }

      // Fallback to 2D canvas
      this.ctx = canvas.getContext('2d');
      if (this.ctx) {
        this.initialize2D();
        console.log('OptimizedHighlightRenderer: 2D context initialized');
        return true;
      }

      console.error('OptimizedHighlightRenderer: Failed to initialize any rendering context');
      return false;
    } catch (error) {
      console.error('OptimizedHighlightRenderer: Initialization error:', error);
      return false;
    }
  }

  /**
   * Render highlights with performance optimizations
   */
  render(
    highlights: ComponentHighlight[],
    viewportState: ViewportState,
    originalViewport: { width: number; height: number }
  ): void {
    if (!this.canvas) return;

    // Debounce rapid render calls
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = window.setTimeout(() => {
      this.performRender(highlights, viewportState, originalViewport);
    }, this.options.debounceInterval);
  }

  /**
   * Perform the actual rendering with optimizations
   */
  private performRender(
    highlights: ComponentHighlight[],
    viewportState: ViewportState,
    originalViewport: { width: number; height: number }
  ): void {
    const startTime = performance.now();

    try {
      // Update render queue with visible highlights
      this.updateRenderQueue(highlights, viewportState, originalViewport);

      // Choose rendering method based on context availability
      if (this.webglCtx) {
        this.renderWebGL();
      } else if (this.ctx) {
        this.render2D();
      }

      // Update metrics
      this.updateMetrics(startTime, highlights.length);
    } catch (error) {
      console.error('OptimizedHighlightRenderer: Render error:', error);
    }
  }

  /**
   * Update the render queue with viewport culling
   */
  private updateRenderQueue(
    highlights: ComponentHighlight[],
    viewportState: ViewportState,
    originalViewport: { width: number; height: number }
  ): void {
    this.renderQueue = [];
    this.visibleHighlights.clear();

    const visibleHighlights = this.options.cullingEnabled
      ? this.cullHighlights(highlights, viewportState, originalViewport)
      : highlights.filter(h => h.isVisible);

    // Limit highlights for performance
    const limitedHighlights = visibleHighlights.slice(0, this.options.maxHighlights);

    this.renderQueue = limitedHighlights;
    limitedHighlights.forEach(h => this.visibleHighlights.add(h.id));
  }

  /**
   * Cull highlights outside the viewport for performance
   */
  private cullHighlights(
    highlights: ComponentHighlight[],
    viewportState: ViewportState,
    originalViewport: { width: number; height: number }
  ): ComponentHighlight[] {
    const padding = this.options.viewportPadding;
    const viewportBounds = {
      left: -viewportState.panX - padding,
      top: -viewportState.panY - padding,
      right: -viewportState.panX + this.canvas!.width / viewportState.zoom + padding,
      bottom: -viewportState.panY + this.canvas!.height / viewportState.zoom + padding
    };

    return highlights.filter(highlight => {
      if (!highlight.isVisible) return false;

      const x = highlight.coordinates.x * originalViewport.width;
      const y = highlight.coordinates.y * originalViewport.height;
      const width = (highlight.coordinates.width || 0.1) * originalViewport.width;
      const height = (highlight.coordinates.height || 0.1) * originalViewport.height;

      // Check if highlight intersects with viewport
      return !(
        x + width < viewportBounds.left ||
        x > viewportBounds.right ||
        y + height < viewportBounds.top ||
        y > viewportBounds.bottom
      );
    });
  }

  /**
   * WebGL rendering implementation
   */
  private renderWebGL(): void {
    if (!this.webglCtx || !this.canvas) return;

    const gl = this.webglCtx;
    
    // Clear canvas
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Batch render all highlights
    if (this.options.enableBatching) {
      this.renderBatchedWebGL();
    } else {
      this.renderIndividualWebGL();
    }
  }

  /**
   * 2D Canvas rendering implementation
   */
  private render2D(): void {
    if (!this.ctx || !this.canvas) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Enable hardware acceleration hints
    this.ctx.imageSmoothingEnabled = false;
    
    // Batch render all highlights
    if (this.options.enableBatching) {
      this.renderBatched2D();
    } else {
      this.renderIndividual2D();
    }
  }

  /**
   * Batched 2D rendering for performance
   */
  private renderBatched2D(): void {
    if (!this.ctx) return;

    // Group highlights by style for batching
    const styleGroups = this.groupHighlightsByStyle();

    for (const [_styleKey, highlights] of styleGroups) {
      const style = highlights[0].style;
      this.applyStyle2D(style);

      // Draw all highlights with the same style
      this.ctx.beginPath();
      for (const highlight of highlights) {
        this.addHighlightPath2D(highlight);
      }
      this.ctx.fill();
      this.ctx.stroke();
    }
  }

  /**
   * Individual 2D rendering with caching
   */
  private renderIndividual2D(): void {
    if (!this.ctx) return;

    for (const highlight of this.renderQueue) {
      // Check cache first
      const cacheKey = this.getHighlightCacheKey(highlight);
      const cached = this.highlightCache.get(cacheKey);

      if (cached && !this.shouldAnimateHighlight(highlight)) {
        // Use cached version
        this.ctx.putImageData(cached, highlight.coordinates.x, highlight.coordinates.y);
      } else {
        // Render and cache
        this.renderSingleHighlight2D(highlight);
        if (this.highlightCache.size < 100) { // Limit cache size
          this.cacheHighlight(highlight, cacheKey);
        }
      }
    }
  }

  /**
   * Render a single highlight with 2D canvas
   */
  private renderSingleHighlight2D(highlight: ComponentHighlight): void {
    if (!this.ctx) return;

    this.ctx.save();
    this.applyStyle2D(highlight.style);
    
    // Apply animation transforms if needed
    if (this.shouldAnimateHighlight(highlight)) {
      this.applyAnimationTransform2D(highlight);
    }

    this.addHighlightPath2D(highlight);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * Apply 2D canvas style
   */
  private applyStyle2D(style: HighlightStyle): void {
    if (!this.ctx) return;

    this.ctx.fillStyle = this.addAlpha(style.color, style.fillOpacity || 0.2);
    this.ctx.strokeStyle = this.addAlpha(style.color, style.opacity);
    this.ctx.lineWidth = style.strokeWidth;
    this.ctx.globalAlpha = style.opacity;

    // Set line dash for stroke style
    switch (style.strokeStyle) {
      case 'dashed':
        this.ctx.setLineDash([5, 5]);
        break;
      case 'dotted':
        this.ctx.setLineDash([2, 2]);
        break;
      default:
        this.ctx.setLineDash([]);
    }
  }

  /**
   * Add highlight path to 2D context
   */
  private addHighlightPath2D(highlight: ComponentHighlight): void {
    if (!this.ctx || !this.canvas) return;

    const coords = highlight.coordinates;
    const x = coords.x * this.canvas.width;
    const y = coords.y * this.canvas.height;

    switch (highlight.type) {
      case 'component': {
        const width = (coords.width || 0.1) * this.canvas.width;
        const height = (coords.height || 0.05) * this.canvas.height;
        this.ctx.rect(x, y, width, height);
        break;
      }

      case 'area':
        if (coords.points && coords.points.length > 0) {
          this.ctx.moveTo(coords.points[0].x, coords.points[0].y);
          for (let i = 1; i < coords.points.length; i++) {
            this.ctx.lineTo(coords.points[i].x, coords.points[i].y);
          }
          this.ctx.closePath();
        } else {
          // Fallback to circle
          const radius = (coords.radius || 0.05) * Math.min(this.canvas.width, this.canvas.height);
          this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
        }
        break;

      default:
        // Default to rectangle
        const defaultWidth = 0.1 * this.canvas.width;
        const defaultHeight = 0.05 * this.canvas.height;
        this.ctx.rect(x, y, defaultWidth, defaultHeight);
    }
  }

  /**
   * Initialize WebGL context
   */
  private initializeWebGL(): void {
    if (!this.webglCtx) return;

    const gl = this.webglCtx;
    
    // Set clear color
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Create shader program (simplified for this example)
    // In a real implementation, you would create proper vertex and fragment shaders
  }

  /**
   * Initialize 2D context
   */
  private initialize2D(): void {
    if (!this.ctx) return;

    // Enable hardware acceleration hints
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
  }

  /**
   * Group highlights by style for batching
   */
  private groupHighlightsByStyle(): Map<string, ComponentHighlight[]> {
    const groups = new Map<string, ComponentHighlight[]>();

    for (const highlight of this.renderQueue) {
      const styleKey = this.getStyleKey(highlight.style);
      const group = groups.get(styleKey) || [];
      group.push(highlight);
      groups.set(styleKey, group);
    }

    return groups;
  }

  /**
   * Generate style key for grouping
   */
  private getStyleKey(style: HighlightStyle): string {
    return `${style.color}-${style.opacity}-${style.strokeWidth}-${style.strokeStyle}`;
  }

  /**
   * Generate cache key for highlight
   */
  private getHighlightCacheKey(highlight: ComponentHighlight): string {
    const coords = highlight.coordinates;
    return `${highlight.id}-${coords.x}-${coords.y}-${coords.width}-${coords.height}-${this.getStyleKey(highlight.style)}`;
  }

  /**
   * Check if highlight should be animated
   */
  private shouldAnimateHighlight(highlight: ComponentHighlight): boolean {
    return highlight.style.animationType !== 'none' && highlight.style.animationType !== undefined;
  }

  /**
   * Apply animation transform for 2D rendering
   */
  private applyAnimationTransform2D(highlight: ComponentHighlight): void {
    if (!this.ctx) return;

    const time = Date.now();
    const animationType = highlight.style.animationType;

    switch (animationType) {
      case 'pulse': {
        const pulseScale = 1 + 0.1 * Math.sin(time * 0.005);
        this.ctx.scale(pulseScale, pulseScale);
        break;
      }

      case 'glow': {
        const glowAlpha = 0.5 + 0.3 * Math.sin(time * 0.003);
        this.ctx.globalAlpha *= glowAlpha;
        break;
      }

      case 'fade': {
        const fadeAlpha = 0.3 + 0.7 * Math.sin(time * 0.002);
        this.ctx.globalAlpha *= fadeAlpha;
        break;
      }
    }
  }

  /**
   * Cache a rendered highlight
   */
  private cacheHighlight(highlight: ComponentHighlight, cacheKey: string): void {
    if (!this.ctx || !this.canvas) return;

    try {
      const coords = highlight.coordinates;
      const x = coords.x * this.canvas.width;
      const y = coords.y * this.canvas.height;
      const width = (coords.width || 0.1) * this.canvas.width;
      const height = (coords.height || 0.05) * this.canvas.height;

      const imageData = this.ctx.getImageData(x, y, width, height);
      this.highlightCache.set(cacheKey, imageData);
    } catch (error) {
      // Ignore cache errors
    }
  }

  /**
   * Add alpha to color string
   */
  private addAlpha(color: string, alpha: number): string {
    if (color.startsWith('#')) {
      const hex = color.substring(1);
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }

  /**
   * Update rendering metrics
   */
  private updateMetrics(startTime: number, totalHighlights: number): void {
    const renderTime = performance.now() - startTime;
    const currentTime = Date.now();
    
    this.frameCount++;
    
    // Update FPS every second
    if (currentTime - this.lastRenderTime >= 1000) {
      this.metrics = {
        renderTime,
        highlightsRendered: this.renderQueue.length,
        highlightsCulled: totalHighlights - this.renderQueue.length,
        frameRate: this.frameCount,
        memoryUsage: this.highlightCache.size
      };
      
      this.frameCount = 0;
      this.lastRenderTime = currentTime;
    }
  }

  /**
   * Batched WebGL rendering (simplified implementation)
   */
  private renderBatchedWebGL(): void {
    // Simplified WebGL implementation
    // In a real implementation, you would use vertex buffers and shaders
    console.log('WebGL batched rendering not fully implemented in this example');
  }

  /**
   * Individual WebGL rendering (simplified implementation)
   */
  private renderIndividualWebGL(): void {
    // Simplified WebGL implementation
    console.log('WebGL individual rendering not fully implemented in this example');
  }

  /**
   * Get current rendering metrics
   */
  getMetrics(): RenderingMetrics {
    return { ...this.metrics };
  }

  /**
   * Clear highlight cache
   */
  clearCache(): void {
    this.highlightCache.clear();
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    this.clearCache();
    this.canvas = null;
    this.ctx = null;
    this.webglCtx = null;
  }
}

// Singleton instance
let optimizedRendererInstance: OptimizedHighlightRenderer | null = null;

export function getOptimizedHighlightRenderer(options?: RenderingOptions): OptimizedHighlightRenderer {
  if (!optimizedRendererInstance) {
    optimizedRendererInstance = new OptimizedHighlightRenderer(options);
  }
  return optimizedRendererInstance;
}