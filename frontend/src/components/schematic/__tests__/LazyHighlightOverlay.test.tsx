/**
 * Unit tests for Lazy Highlight Overlay
 * Tests lazy loading, virtualization, and performance optimizations
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LazyHighlightOverlay } from '../LazyHighlightOverlay';
import type {
  ComponentHighlight,
  ViewportState,
  HighlightStyle
} from '../../../types/highlighting.types';

// Mock the optimized renderer
const mockRenderer = {
  initialize: jest.fn().mockReturnValue(true),
  render: jest.fn(),
  dispose: jest.fn(),
  getMetrics: jest.fn().mockReturnValue({
    renderTime: 5.2,
    highlightsRendered: 10,
    highlightsCulled: 5,
    frameRate: 60,
    memoryUsage: 3
  })
};

jest.mock('../../../services/optimized-highlight-renderer', () => ({
  getOptimizedHighlightRenderer: jest.fn(() => mockRenderer)
}));

// Mock coordinate mapping utilities
jest.mock('../../../utils/coordinate-mapper', () => ({
  mapNormalizedToCanvas: jest.fn((coord, width, height) => ({
    x: coord.x * width,
    y: coord.y * height
  })),
  transformHighlightCoordinates: jest.fn((highlight, viewport) => highlight.coordinates)
}));

describe('LazyHighlightOverlay', () => {
  const mockHighlightStyle: HighlightStyle = {
    color: '#2196F3',
    opacity: 0.8,
    strokeWidth: 2,
    strokeStyle: 'solid',
    fillOpacity: 0.2,
    zIndex: 1
  };

  const createMockHighlight = (id: string, x: number = 0.3, y: number = 0.5): ComponentHighlight => ({
    id,
    componentId: `component-${id}`,
    type: 'component',
    coordinates: {
      x,
      y,
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
  });

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

  const defaultProps = {
    highlights: [createMockHighlight('1')],
    canvasWidth: 800,
    canvasHeight: 600,
    viewportState: mockViewportState,
    originalViewport: mockOriginalViewport
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock canvas getContext
    HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      drawImage: jest.fn(),
    });
  });

  describe('basic rendering', () => {
    it('should render without crashing', () => {
      render(<LazyHighlightOverlay {...defaultProps} />);
      
      expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
    });

    it('should initialize renderer on mount', () => {
      render(<LazyHighlightOverlay {...defaultProps} />);
      
      expect(mockRenderer.initialize).toHaveBeenCalled();
    });

    it('should render highlights directly when count is below threshold', async () => {
      const smallHighlightSet = [createMockHighlight('1'), createMockHighlight('2')];
      
      render(
        <LazyHighlightOverlay 
          {...defaultProps} 
          highlights={smallHighlightSet}
          loadingThreshold={10}
        />
      );
      
      await waitFor(() => {
        expect(mockRenderer.render).toHaveBeenCalledWith(
          smallHighlightSet,
          mockViewportState,
          mockOriginalViewport
        );
      });
    });

    it('should set canvas dimensions correctly', () => {
      render(<LazyHighlightOverlay {...defaultProps} />);
      
      const canvases = document.querySelectorAll('canvas');
      canvases.forEach(canvas => {
        expect(canvas.width).toBe(800);
        expect(canvas.height).toBe(600);
      });
    });
  });

  describe('lazy loading behavior', () => {
    it('should enable lazy loading for large highlight sets', () => {
      const manyHighlights = Array.from({ length: 150 }, (_, i) => 
        createMockHighlight(`highlight-${i}`, Math.random(), Math.random())
      );
      
      render(
        <LazyHighlightOverlay 
          {...defaultProps} 
          highlights={manyHighlights}
          loadingThreshold={100}
        />
      );
      
      expect(screen.getByText(/Loading highlights/)).toBeInTheDocument();
    });

    it('should show loading progress indicator', async () => {
      const manyHighlights = Array.from({ length: 200 }, (_, i) => 
        createMockHighlight(`highlight-${i}`, Math.random(), Math.random())
      );
      
      render(
        <LazyHighlightOverlay 
          {...defaultProps} 
          highlights={manyHighlights}
          loadingThreshold={50}
        />
      );
      
      expect(screen.getByText(/Loading highlights/)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should disable lazy loading when enableVirtualization is false', async () => {
      const manyHighlights = Array.from({ length: 200 }, (_, i) => 
        createMockHighlight(`highlight-${i}`, Math.random(), Math.random())
      );
      
      render(
        <LazyHighlightOverlay 
          {...defaultProps} 
          highlights={manyHighlights}
          loadingThreshold={50}
          enableVirtualization={false}
        />
      );
      
      await waitFor(() => {
        expect(mockRenderer.render).toHaveBeenCalledWith(
          manyHighlights,
          mockViewportState,
          mockOriginalViewport
        );
      });
    });

    it('should handle custom chunk size', () => {
      const manyHighlights = Array.from({ length: 150 }, (_, i) => 
        createMockHighlight(`highlight-${i}`, Math.random(), Math.random())
      );
      
      render(
        <LazyHighlightOverlay 
          {...defaultProps} 
          highlights={manyHighlights}
          loadingThreshold={100}
          chunkSize={25}
        />
      );
      
      expect(screen.getByText(/Loading highlights/)).toBeInTheDocument();
    });

    it('should respect maxConcurrentLoads limit', () => {
      const manyHighlights = Array.from({ length: 200 }, (_, i) => 
        createMockHighlight(`highlight-${i}`, Math.random(), Math.random())
      );
      
      render(
        <LazyHighlightOverlay 
          {...defaultProps} 
          highlights={manyHighlights}
          loadingThreshold={50}
          maxConcurrentLoads={2}
        />
      );
      
      expect(screen.getByText(/Loading highlights/)).toBeInTheDocument();
    });
  });

  describe('viewport culling', () => {
    it('should update visible chunks based on viewport changes', async () => {
      const distributedHighlights = [
        createMockHighlight('1', 0.1, 0.1), // Top-left
        createMockHighlight('2', 0.9, 0.1), // Top-right
        createMockHighlight('3', 0.1, 0.9), // Bottom-left
        createMockHighlight('4', 0.9, 0.9)  // Bottom-right
      ];
      
      const { rerender } = render(
        <LazyHighlightOverlay 
          {...defaultProps} 
          highlights={distributedHighlights}
          loadingThreshold={2}
        />
      );
      
      // Change viewport to focus on top-left
      const zoomedViewport: ViewportState = {
        zoom: 2,
        panX: 0,
        panY: 0,
        rotation: 0
      };
      
      rerender(
        <LazyHighlightOverlay 
          {...defaultProps} 
          highlights={distributedHighlights}
          viewportState={zoomedViewport}
          loadingThreshold={2}
        />
      );
      
      // Should still process the highlights
      expect(screen.getByText(/Loading highlights/)).toBeInTheDocument();
    });

    it('should handle empty viewport bounds', () => {
      const highlights = [createMockHighlight('1')];
      
      render(
        <LazyHighlightOverlay 
          {...defaultProps} 
          highlights={highlights}
          viewportState={{
            zoom: 0,
            panX: 0,
            panY: 0,
            rotation: 0
          }}
        />
      );
      
      expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
    });
  });

  describe('interaction handling', () => {
    it('should handle canvas click events', async () => {
      const onHighlightClick = jest.fn();
      
      render(
        <LazyHighlightOverlay 
          {...defaultProps} 
          onHighlightClick={onHighlightClick}
        />
      );
      
      const interactionCanvas = document.querySelectorAll('canvas')[1];
      
      fireEvent.click(interactionCanvas, {
        clientX: 240, // 0.3 * 800
        clientY: 300  // 0.5 * 600
      });
      
      // Should attempt to find highlight at click position
      expect(interactionCanvas).toBeInTheDocument();
    });

    it('should handle canvas mouse move events', async () => {
      const onHighlightHover = jest.fn();
      
      render(
        <LazyHighlightOverlay 
          {...defaultProps} 
          onHighlightHover={onHighlightHover}
        />
      );
      
      const interactionCanvas = document.querySelectorAll('canvas')[1];
      
      fireEvent.mouseMove(interactionCanvas, {
        clientX: 240,
        clientY: 300
      });
      
      expect(interactionCanvas).toBeInTheDocument();
    });

    it('should not handle interactions when handlers are not provided', () => {
      render(<LazyHighlightOverlay {...defaultProps} />);
      
      const interactionCanvas = document.querySelectorAll('canvas')[1];
      
      expect(() => {
        fireEvent.click(interactionCanvas);
        fireEvent.mouseMove(interactionCanvas);
      }).not.toThrow();
    });

    it('should set correct cursor style based on click handler', () => {
      const { rerender } = render(<LazyHighlightOverlay {...defaultProps} />);
      
      let interactionCanvas = document.querySelectorAll('canvas')[1];
      expect(interactionCanvas).toHaveStyle('cursor: default');
      
      rerender(<LazyHighlightOverlay {...defaultProps} onHighlightClick={jest.fn()} />);
      
      interactionCanvas = document.querySelectorAll('canvas')[1];
      expect(interactionCanvas).toHaveStyle('cursor: pointer');
    });
  });

  describe('error handling', () => {
    it('should show error state when renderer initialization fails', () => {
      mockRenderer.initialize.mockReturnValueOnce(false);
      
      render(<LazyHighlightOverlay {...defaultProps} />);
      
      expect(screen.getByText(/Failed to initialize highlight renderer/)).toBeInTheDocument();
    });

    it('should handle renderer errors gracefully', () => {
      mockRenderer.render.mockImplementationOnce(() => {
        throw new Error('Rendering error');
      });
      
      expect(() => {
        render(<LazyHighlightOverlay {...defaultProps} />);
      }).not.toThrow();
    });

    it('should handle malformed highlight data', () => {
      const malformedHighlight = {
        ...createMockHighlight('malformed'),
        coordinates: undefined as any
      };
      
      expect(() => {
        render(
          <LazyHighlightOverlay 
            {...defaultProps} 
            highlights={[malformedHighlight]}
          />
        );
      }).not.toThrow();
    });
  });

  describe('performance metrics', () => {
    it('should display performance metrics in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      render(<LazyHighlightOverlay {...defaultProps} />);
      
      expect(screen.getByText(/Highlights: 10\/1/)).toBeInTheDocument();
      expect(screen.getByText(/Culled: 5/)).toBeInTheDocument();
      expect(screen.getByText(/FPS: 60/)).toBeInTheDocument();
      expect(screen.getByText(/Render: 5.2ms/)).toBeInTheDocument();
      expect(screen.getByText(/Cache: 3/)).toBeInTheDocument();
      
      process.env.NODE_ENV = originalEnv;
    });

    it('should not display metrics in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      render(<LazyHighlightOverlay {...defaultProps} />);
      
      expect(screen.queryByText(/Highlights:/)).not.toBeInTheDocument();
      
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('cleanup', () => {
    it('should dispose renderer on unmount', () => {
      const { unmount } = render(<LazyHighlightOverlay {...defaultProps} />);
      
      unmount();
      
      expect(mockRenderer.dispose).toHaveBeenCalled();
    });

    it('should handle disposal errors gracefully', () => {
      mockRenderer.dispose.mockImplementationOnce(() => {
        throw new Error('Disposal error');
      });
      
      const { unmount } = render(<LazyHighlightOverlay {...defaultProps} />);
      
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('responsive behavior', () => {
    it('should update canvas size when dimensions change', () => {
      const { rerender } = render(<LazyHighlightOverlay {...defaultProps} />);
      
      rerender(
        <LazyHighlightOverlay 
          {...defaultProps} 
          canvasWidth={1200}
          canvasHeight={900}
        />
      );
      
      const canvases = document.querySelectorAll('canvas');
      canvases.forEach(canvas => {
        expect(canvas.width).toBe(1200);
        expect(canvas.height).toBe(900);
      });
    });

    it('should re-render when viewport state changes', async () => {
      const { rerender } = render(<LazyHighlightOverlay {...defaultProps} />);
      
      const newViewportState: ViewportState = {
        zoom: 2,
        panX: -100,
        panY: -100,
        rotation: 0
      };
      
      rerender(
        <LazyHighlightOverlay 
          {...defaultProps} 
          viewportState={newViewportState}
        />
      );
      
      await waitFor(() => {
        expect(mockRenderer.render).toHaveBeenCalledWith(
          expect.any(Array),
          newViewportState,
          mockOriginalViewport
        );
      });
    });

    it('should handle original viewport changes', async () => {
      const { rerender } = render(<LazyHighlightOverlay {...defaultProps} />);
      
      const newOriginalViewport = { width: 1500, height: 1200 };
      
      rerender(
        <LazyHighlightOverlay 
          {...defaultProps} 
          originalViewport={newOriginalViewport}
        />
      );
      
      await waitFor(() => {
        expect(mockRenderer.render).toHaveBeenCalledWith(
          expect.any(Array),
          mockViewportState,
          newOriginalViewport
        );
      });
    });
  });

  describe('accessibility', () => {
    it('should provide proper canvas labeling', () => {
      render(<LazyHighlightOverlay {...defaultProps} />);
      
      const canvases = document.querySelectorAll('canvas');
      expect(canvases).toHaveLength(2);
      
      // Main rendering canvas should not be interactive
      expect(canvases[0]).toHaveStyle('pointer-events: none');
      
      // Interaction canvas should be interactive
      expect(canvases[1]).not.toHaveStyle('pointer-events: none');
    });

    it('should handle keyboard interactions appropriately', () => {
      render(<LazyHighlightOverlay {...defaultProps} />);
      
      const interactionCanvas = document.querySelectorAll('canvas')[1];
      
      fireEvent.keyDown(interactionCanvas, { key: 'Enter' });
      fireEvent.keyDown(interactionCanvas, { key: 'Space' });
      
      // Should not crash on keyboard events
      expect(interactionCanvas).toBeInTheDocument();
    });
  });

  describe('loading states', () => {
    it('should show loading state during chunk processing', async () => {
      const manyHighlights = Array.from({ length: 150 }, (_, i) => 
        createMockHighlight(`highlight-${i}`, Math.random(), Math.random())
      );
      
      render(
        <LazyHighlightOverlay 
          {...defaultProps} 
          highlights={manyHighlights}
          loadingThreshold={50}
        />
      );
      
      expect(screen.getByText(/Loading highlights/)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should complete loading and show content', async () => {
      const manyHighlights = Array.from({ length: 150 }, (_, i) => 
        createMockHighlight(`highlight-${i}`, Math.random(), Math.random())
      );
      
      render(
        <LazyHighlightOverlay 
          {...defaultProps} 
          highlights={manyHighlights}
          loadingThreshold={50}
        />
      );
      
      // Wait for loading to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 300));
      });
      
      // Should eventually show the canvas
      expect(document.querySelectorAll('canvas')).toHaveLength(2);
    });
  });
});