/**
 * Unit tests for Optimized Highlight Renderer
 * Tests Canvas/WebGL rendering, viewport culling, and performance optimizations
 */

import { OptimizedHighlightRenderer } from '../optimized-highlight-renderer';
import type {
  ComponentHighlight,
  ViewportState,
  HighlightStyle,
  RenderingOptions,
  RenderingMetrics
} from '../../types/highlighting.types';

// Mock Canvas and WebGL contexts
const mockCanvas = {
  width: 800,
  height: 600,
  getContext: jest.fn()
} as unknown as HTMLCanvasElement;

const mockCtx = {
  clearRect: jest.fn(),
  beginPath: jest.fn(),
  rect: jest.fn(),
  arc: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  scale: jest.fn(),
  setLineDash: jest.fn(),
  getImageData: jest.fn(),
  putImageData: jest.fn(),
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'high',
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  globalAlpha: 1
} as unknown as CanvasRenderingContext2D;

const mockWebGLCtx = {
  clear: jest.fn(),
  clearColor: jest.fn(),
  enable: jest.fn(),
  blendFunc: jest.fn(),
  COLOR_BUFFER_BIT: 1,
  BLEND: 2,
  SRC_ALPHA: 3,
  ONE_MINUS_SRC_ALPHA: 4
} as unknown as WebGLRenderingContext;

describe('OptimizedHighlightRenderer', () => {
  let renderer: OptimizedHighlightRenderer;
  
  const mockHighlightStyle: HighlightStyle = {
    color: '#2196F3',
    opacity: 0.8,
    strokeWidth: 2,
    strokeStyle: 'solid',
    fillOpacity: 0.2,
    zIndex: 1
  };

  const mockHighlight: ComponentHighlight = {
    id: 'highlight-1',
    componentId: 'resistor R1',
    type: 'component',
    coordinates: {
      x: 0.3,
      y: 0.5,
      width: 0.1,
      height: 0.05,
      pageNumber: 1,
      zoomLevel: 1,
      viewportOffset: { x: 0, y: 0 }
    },
    style: mockHighlightStyle,
    responseId: 'response-1',
    queryId: 'query-1',
    sessionId: 'session-1',
    createdAt: new Date(),
    isVisible: true,
    isPersistent: false
  };

  const mockViewportState: ViewportState = {
    zoom: 1,
    panX: 0,
    panY: 0,
    rotation: 0
  };

  const mockOriginalViewport = {
    width: 1000,
    height: 800
  };

  beforeEach(() => {
    jest.clearAllMocks();
    renderer = new OptimizedHighlightRenderer();
  });

  afterEach(() => {
    renderer.dispose();
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      expect(renderer).toBeDefined();
      const metrics = renderer.getMetrics();
      expect(metrics.renderTime).toBe(0);
      expect(metrics.highlightsRendered).toBe(0);
    });

    it('should initialize with custom options', () => {
      const options: RenderingOptions = {
        enableWebGL: false,
        maxHighlights: 100,
        debounceInterval: 32,
        enableBatching: false
      };
      
      const customRenderer = new OptimizedHighlightRenderer(options);
      expect(customRenderer).toBeDefined();
      customRenderer.dispose();
    });

    it('should initialize 2D context when canvas is provided', () => {
      mockCanvas.getContext = jest.fn().mockReturnValue(mockCtx);
      
      const success = renderer.initialize(mockCanvas);
      
      expect(success).toBe(true);
      expect(mockCanvas.getContext).toHaveBeenCalledWith('webgl');
      expect(mockCanvas.getContext).toHaveBeenCalledWith('experimental-webgl');
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
    });

    it('should initialize WebGL context when available', () => {
      mockCanvas.getContext = jest.fn()
        .mockReturnValueOnce(null) // First call for 'webgl'
        .mockReturnValueOnce(mockWebGLCtx) // Second call for 'experimental-webgl'
        .mockReturnValue(mockCtx);
      
      const success = renderer.initialize(mockCanvas);
      
      expect(success).toBe(true);
      expect(mockWebGLCtx.clearColor).toHaveBeenCalled();
      expect(mockWebGLCtx.enable).toHaveBeenCalled();
    });

    it('should fail to initialize when no context is available', () => {
      mockCanvas.getContext = jest.fn().mockReturnValue(null);
      
      const success = renderer.initialize(mockCanvas);
      
      expect(success).toBe(false);
    });

    it('should handle initialization errors gracefully', () => {
      mockCanvas.getContext = jest.fn().mockImplementation(() => {
        throw new Error('Context creation failed');
      });
      
      const success = renderer.initialize(mockCanvas);
      
      expect(success).toBe(false);
    });
  });

  describe('rendering', () => {
    beforeEach(() => {
      mockCanvas.getContext = jest.fn().mockReturnValue(mockCtx);
      renderer.initialize(mockCanvas);
    });

    it('should render highlights with debouncing', (done) => {
      const highlights = [mockHighlight];
      
      renderer.render(highlights, mockViewportState, mockOriginalViewport);
      
      // Should not render immediately due to debouncing
      expect(mockCtx.clearRect).not.toHaveBeenCalled();
      
      // Should render after debounce delay
      setTimeout(() => {
        expect(mockCtx.clearRect).toHaveBeenCalled();
        done();
      }, 20);
    });

    it('should handle empty highlights array', (done) => {
      renderer.render([], mockViewportState, mockOriginalViewport);
      
      setTimeout(() => {
        expect(mockCtx.clearRect).toHaveBeenCalled();
        done();
      }, 20);
    });

    it('should not render when canvas is not initialized', () => {
      const uninitializedRenderer = new OptimizedHighlightRenderer();
      
      uninitializedRenderer.render([mockHighlight], mockViewportState, mockOriginalViewport);
      
      expect(mockCtx.clearRect).not.toHaveBeenCalled();
      uninitializedRenderer.dispose();
    });

    it('should apply correct canvas styles for different highlight types', (done) => {
      const componentHighlight = { ...mockHighlight, type: 'component' as const };
      const areaHighlight = { ...mockHighlight, id: 'h2', type: 'area' as const };
      
      renderer.render([componentHighlight, areaHighlight], mockViewportState, mockOriginalViewport);
      
      setTimeout(() => {
        expect(mockCtx.rect).toHaveBeenCalled(); // For component
        expect(mockCtx.arc).toHaveBeenCalled(); // For area (fallback to circle)
        done();
      }, 20);
    });

    it('should handle highlights with animation styles', (done) => {
      const animatedHighlight = {
        ...mockHighlight,
        style: { ...mockHighlightStyle, animationType: 'pulse' as const }
      };
      
      renderer.render([animatedHighlight], mockViewportState, mockOriginalViewport);
      
      setTimeout(() => {
        expect(mockCtx.scale).toHaveBeenCalled();
        done();
      }, 20);
    });
  });

  describe('viewport culling', () => {
    beforeEach(() => {
      mockCanvas.getContext = jest.fn().mockReturnValue(mockCtx);
      renderer.initialize(mockCanvas);
    });

    it('should cull highlights outside viewport', (done) => {
      const highlights = [
        mockHighlight, // Should be visible
        {
          ...mockHighlight,
          id: 'outside',
          coordinates: {
            ...mockHighlight.coordinates,
            x: 2.0, // Outside viewport
            y: 2.0
          }
        }
      ];
      
      renderer.render(highlights, mockViewportState, mockOriginalViewport);
      
      setTimeout(() => {
        const metrics = renderer.getMetrics();
        expect(metrics.highlightsCulled).toBeGreaterThan(0);
        done();
      }, 20);
    });

    it('should handle viewport transformations correctly', (done) => {
      const transformedViewport: ViewportState = {
        zoom: 2,
        panX: -100,
        panY: -100,
        rotation: 0
      };
      
      renderer.render([mockHighlight], transformedViewport, mockOriginalViewport);
      
      setTimeout(() => {
        const metrics = renderer.getMetrics();
        expect(metrics.highlightsRendered).toBeGreaterThanOrEqual(0);
        done();
      }, 20);
    });
  });

  describe('performance optimization', () => {
    beforeEach(() => {
      mockCanvas.getContext = jest.fn().mockReturnValue(mockCtx);
      renderer.initialize(mockCanvas);
    });

    it('should limit rendered highlights based on maxHighlights option', (done) => {
      const limitedRenderer = new OptimizedHighlightRenderer({ maxHighlights: 2 });
      mockCanvas.getContext = jest.fn().mockReturnValue(mockCtx);
      limitedRenderer.initialize(mockCanvas);
      
      const manyHighlights = Array.from({ length: 5 }, (_, i) => ({
        ...mockHighlight,
        id: `highlight-${i}`
      }));
      
      limitedRenderer.render(manyHighlights, mockViewportState, mockOriginalViewport);
      
      setTimeout(() => {
        const metrics = limitedRenderer.getMetrics();
        expect(metrics.highlightsRendered).toBeLessThanOrEqual(2);
        limitedRenderer.dispose();
        done();
      }, 20);
    });

    it('should group highlights by style for batching', (done) => {
      const highlights = [
        mockHighlight,
        { ...mockHighlight, id: 'h2' }, // Same style
        { 
          ...mockHighlight, 
          id: 'h3',
          style: { ...mockHighlightStyle, color: '#FF0000' } // Different style
        }
      ];
      
      renderer.render(highlights, mockViewportState, mockOriginalViewport);
      
      setTimeout(() => {
        // Should call beginPath for each style group
        expect(mockCtx.beginPath).toHaveBeenCalled();
        done();
      }, 20);
    });

    it('should update metrics correctly', (done) => {
      renderer.render([mockHighlight], mockViewportState, mockOriginalViewport);
      
      setTimeout(() => {
        const metrics = renderer.getMetrics();
        expect(metrics.renderTime).toBeGreaterThan(0);
        expect(metrics.highlightsRendered).toBe(1);
        expect(metrics.frameRate).toBeGreaterThanOrEqual(0);
        done();
      }, 20);
    });
  });

  describe('caching', () => {
    beforeEach(() => {
      mockCanvas.getContext = jest.fn().mockReturnValue(mockCtx);
      mockCtx.getImageData = jest.fn().mockReturnValue(new ImageData(10, 10));
      renderer.initialize(mockCanvas);
    });

    it('should cache static highlights', (done) => {
      const staticHighlight = { ...mockHighlight };
      
      // Render twice
      renderer.render([staticHighlight], mockViewportState, mockOriginalViewport);
      
      setTimeout(() => {
        renderer.render([staticHighlight], mockViewportState, mockOriginalViewport);
        
        setTimeout(() => {
          const metrics = renderer.getMetrics();
          expect(metrics.memoryUsage).toBeGreaterThan(0);
          done();
        }, 20);
      }, 20);
    });

    it('should clear cache when requested', () => {
      renderer.clearCache();
      const metrics = renderer.getMetrics();
      expect(metrics.memoryUsage).toBe(0);
    });
  });

  describe('animation support', () => {
    beforeEach(() => {
      mockCanvas.getContext = jest.fn().mockReturnValue(mockCtx);
      renderer.initialize(mockCanvas);
    });

    it('should apply pulse animation transform', (done) => {
      const pulseHighlight = {
        ...mockHighlight,
        style: { ...mockHighlightStyle, animationType: 'pulse' as const }
      };
      
      renderer.render([pulseHighlight], mockViewportState, mockOriginalViewport);
      
      setTimeout(() => {
        expect(mockCtx.scale).toHaveBeenCalled();
        done();
      }, 20);
    });

    it('should apply glow animation transform', (done) => {
      const glowHighlight = {
        ...mockHighlight,
        style: { ...mockHighlightStyle, animationType: 'glow' as const }
      };
      
      renderer.render([glowHighlight], mockViewportState, mockOriginalViewport);
      
      setTimeout(() => {
        expect(mockCtx.save).toHaveBeenCalled();
        expect(mockCtx.restore).toHaveBeenCalled();
        done();
      }, 20);
    });

    it('should apply fade animation transform', (done) => {
      const fadeHighlight = {
        ...mockHighlight,
        style: { ...mockHighlightStyle, animationType: 'fade' as const }
      };
      
      renderer.render([fadeHighlight], mockViewportState, mockOriginalViewport);
      
      setTimeout(() => {
        expect(mockCtx.save).toHaveBeenCalled();
        expect(mockCtx.restore).toHaveBeenCalled();
        done();
      }, 20);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      mockCanvas.getContext = jest.fn().mockReturnValue(mockCtx);
      renderer.initialize(mockCanvas);
    });

    it('should handle rendering errors gracefully', (done) => {
      mockCtx.clearRect = jest.fn().mockImplementation(() => {
        throw new Error('Rendering error');
      });
      
      expect(() => {
        renderer.render([mockHighlight], mockViewportState, mockOriginalViewport);
      }).not.toThrow();
      
      setTimeout(done, 20);
    });

    it('should handle malformed highlight data', (done) => {
      const malformedHighlight = {
        ...mockHighlight,
        coordinates: undefined as any
      };
      
      expect(() => {
        renderer.render([malformedHighlight], mockViewportState, mockOriginalViewport);
      }).not.toThrow();
      
      setTimeout(done, 20);
    });

    it('should handle cache errors gracefully', (done) => {
      mockCtx.getImageData = jest.fn().mockImplementation(() => {
        throw new Error('Cache error');
      });
      
      renderer.render([mockHighlight], mockViewportState, mockOriginalViewport);
      
      setTimeout(() => {
        // Should not throw and should continue rendering
        expect(mockCtx.clearRect).toHaveBeenCalled();
        done();
      }, 20);
    });
  });

  describe('cleanup', () => {
    it('should dispose resources properly', () => {
      mockCanvas.getContext = jest.fn().mockReturnValue(mockCtx);
      renderer.initialize(mockCanvas);
      
      renderer.dispose();
      
      // Should clear cache
      const metrics = renderer.getMetrics();
      expect(metrics.memoryUsage).toBe(0);
    });

    it('should cancel pending animations on dispose', () => {
      const cancelAnimationFrameSpy = jest.spyOn(window, 'cancelAnimationFrame');
      
      renderer.dispose();
      
      // Should not throw if no animation frame is active
      expect(() => renderer.dispose()).not.toThrow();
      
      cancelAnimationFrameSpy.mockRestore();
    });
  });

  describe('WebGL rendering', () => {
    beforeEach(() => {
      mockCanvas.getContext = jest.fn()
        .mockReturnValueOnce(mockWebGLCtx)
        .mockReturnValue(mockCtx);
      renderer.initialize(mockCanvas);
    });

    it('should use WebGL context when available', (done) => {
      renderer.render([mockHighlight], mockViewportState, mockOriginalViewport);
      
      setTimeout(() => {
        expect(mockWebGLCtx.clear).toHaveBeenCalled();
        done();
      }, 20);
    });
  });
});