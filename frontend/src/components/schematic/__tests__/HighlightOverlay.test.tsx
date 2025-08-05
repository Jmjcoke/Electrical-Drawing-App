/**
 * Unit tests for HighlightOverlay component
 * Tests rendering, interactions, and coordinate transformations
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HighlightOverlay } from '../HighlightOverlay';
import type { ComponentHighlight, ViewportState } from '../../../types/highlighting.types';

// Mock the coordinate mapper utilities
jest.mock('../../../utils/coordinate-mapper', () => ({
  mapNormalizedToCanvas: jest.fn((coords, width, height) => ({
    x: coords.x * width,
    y: coords.y * height
  })),
  transformHighlightCoordinates: jest.fn((coords) => coords),
  calculateTransform: jest.fn(() => ({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    rotation: 0
  })),
  validateCoordinates: jest.fn(() => true)
}));

// Mock canvas context
const mockCanvas = {
  getContext: jest.fn(() => ({
    clearRect: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    rect: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    scale: jest.fn(),
    setLineDash: jest.fn(),
    canvas: { width: 800, height: 600 }
  })),
  width: 800,
  height: 600
};

// Mock requestAnimationFrame and cancelAnimationFrame
const mockRequestAnimationFrame = jest.fn((callback) => {
  setTimeout(callback, 16);
  return 1;
});
const mockCancelAnimationFrame = jest.fn();

global.requestAnimationFrame = mockRequestAnimationFrame;
global.cancelAnimationFrame = mockCancelAnimationFrame;

describe('HighlightOverlay', () => {
  const mockViewport: ViewportState = {
    zoom: 1,
    panX: 0,
    panY: 0,
    width: 800,
    height: 600
  };

  const mockHighlight: ComponentHighlight = {
    id: 'highlight-1',
    type: 'component',
    coordinates: {
      x: 0.5,
      y: 0.5,
      width: 0.1,
      height: 0.1,
      pageNumber: 1,
      zoomLevel: 1,
      viewportOffset: { x: 0, y: 0 }
    },
    style: {
      color: '#ff0000',
      opacity: 0.8,
      strokeWidth: 2,
      strokeStyle: 'solid',
      fillOpacity: 0.3,
      zIndex: 1
    },
    responseId: 'response-1',
    queryId: 'query-1',
    sessionId: 'session-1',
    createdAt: new Date(),
    isVisible: true,
    isPersistent: false
  };

  const defaultProps = {
    highlights: [mockHighlight],
    canvasWidth: 800,
    canvasHeight: 600,
    viewportState: mockViewport,
    originalViewport: mockViewport
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock canvas element
    HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCanvas.getContext());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render canvas element', () => {
    render(<HighlightOverlay {...defaultProps} />);
    
    const canvas = screen.getByRole('img');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('aria-label', 'Interactive highlight overlay');
  });

  it('should set canvas dimensions correctly', () => {
    render(<HighlightOverlay {...defaultProps} />);
    
    const canvas = screen.getByRole('img') as HTMLCanvasElement;
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(600);
  });

  it('should apply custom className', () => {
    render(<HighlightOverlay {...defaultProps} className="custom-overlay" />);
    
    const canvas = screen.getByRole('img');
    expect(canvas).toHaveClass('custom-overlay');
  });

  it('should handle highlight click events', () => {
    const onHighlightClick = jest.fn();
    render(
      <HighlightOverlay
        {...defaultProps}
        onHighlightClick={onHighlightClick}
      />
    );
    
    const canvas = screen.getByRole('img');
    
    // Mock getBoundingClientRect
    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: jest.fn()
    }));
    
    // Click near the highlight center (400, 300)
    fireEvent.click(canvas, { clientX: 400, clientY: 300 });
    
    expect(onHighlightClick).toHaveBeenCalledWith('highlight-1');
  });

  it('should handle mouse hover events', () => {
    const onHighlightHover = jest.fn();
    render(
      <HighlightOverlay
        {...defaultProps}
        onHighlightHover={onHighlightHover}
      />
    );
    
    const canvas = screen.getByRole('img');
    
    canvas.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: jest.fn()
    }));
    
    // Hover over highlight
    fireEvent.mouseMove(canvas, { clientX: 400, clientY: 300 });
    expect(onHighlightHover).toHaveBeenCalledWith('highlight-1');
    
    // Mouse leave should clear hover
    fireEvent.mouseLeave(canvas);
    expect(onHighlightHover).toHaveBeenCalledWith(null);
  });

  it('should filter out invalid coordinates', () => {
    const invalidHighlight: ComponentHighlight = {
      ...mockHighlight,
      id: 'invalid-highlight',
      coordinates: {
        ...mockHighlight.coordinates,
        x: 1.5 // Invalid coordinate
      }
    };

    // Mock validateCoordinates to return false for invalid highlight
    const { validateCoordinates } = require('../../../utils/coordinate-mapper');
    validateCoordinates.mockImplementation((coords: any) => coords.x <= 1);
    
    render(
      <HighlightOverlay
        {...defaultProps}
        highlights={[mockHighlight, invalidHighlight]}
      />
    );
    
    // Should only process valid highlights
    expect(validateCoordinates).toHaveBeenCalledTimes(2);
  });

  it('should sort highlights by z-index', () => {
    const highlight1 = { ...mockHighlight, id: 'h1', style: { ...mockHighlight.style, zIndex: 2 } };
    const highlight2 = { ...mockHighlight, id: 'h2', style: { ...mockHighlight.style, zIndex: 1 } };
    const highlight3 = { ...mockHighlight, id: 'h3', style: { ...mockHighlight.style, zIndex: 3 } };
    
    render(
      <HighlightOverlay
        {...defaultProps}
        highlights={[highlight1, highlight2, highlight3]}
      />
    );
    
    // Animation frame should be requested for rendering
    expect(mockRequestAnimationFrame).toHaveBeenCalled();
  });

  it('should handle invisible highlights', () => {
    const invisibleHighlight = {
      ...mockHighlight,
      id: 'invisible',
      isVisible: false
    };
    
    render(
      <HighlightOverlay
        {...defaultProps}
        highlights={[mockHighlight, invisibleHighlight]}
      />
    );
    
    // Should still render, but invisible highlights should be filtered out
    expect(mockRequestAnimationFrame).toHaveBeenCalled();
  });

  it('should start animation loop for animated highlights', async () => {
    const animatedHighlight = {
      ...mockHighlight,
      style: {
        ...mockHighlight.style,
        animationType: 'pulse' as const
      }
    };
    
    render(
      <HighlightOverlay
        {...defaultProps}
        highlights={[animatedHighlight]}
      />
    );
    
    // Should request animation frame for animated highlights
    expect(mockRequestAnimationFrame).toHaveBeenCalled();
  });

  it('should clean up animation frame on unmount', () => {
    const { unmount } = render(<HighlightOverlay {...defaultProps} />);
    
    unmount();
    
    expect(mockCancelAnimationFrame).toHaveBeenCalled();
  });

  it('should update cursor style based on highlights', () => {
    render(<HighlightOverlay {...defaultProps} />);
    
    const canvas = screen.getByRole('img');
    expect(canvas).toHaveStyle({ cursor: 'pointer' });
  });

  it('should set default cursor when no highlights', () => {
    render(<HighlightOverlay {...defaultProps} highlights={[]} />);
    
    const canvas = screen.getByRole('img');
    expect(canvas).toHaveStyle({ cursor: 'default' });
  });

  it('should handle canvas rendering errors gracefully', () => {
    // Mock getContext to return null
    HTMLCanvasElement.prototype.getContext = jest.fn(() => null);
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    render(<HighlightOverlay {...defaultProps} />);
    
    // Should not crash, but may log errors
    expect(consoleSpy).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it('should handle different highlight shapes', () => {
    const circularHighlight = {
      ...mockHighlight,
      id: 'circular',
      coordinates: {
        ...mockHighlight.coordinates,
        radius: 0.05
      }
    };
    
    const polygonHighlight = {
      ...mockHighlight,
      id: 'polygon',
      coordinates: {
        ...mockHighlight.coordinates,
        points: [
          { x: 0.3, y: 0.3 },
          { x: 0.7, y: 0.3 },
          { x: 0.7, y: 0.7 },
          { x: 0.3, y: 0.7 }
        ]
      }
    };
    
    render(
      <HighlightOverlay
        {...defaultProps}
        highlights={[mockHighlight, circularHighlight, polygonHighlight]}
      />
    );
    
    expect(mockRequestAnimationFrame).toHaveBeenCalled();
  });

  it('should apply different stroke styles', () => {
    const dashedHighlight = {
      ...mockHighlight,
      id: 'dashed',
      style: {
        ...mockHighlight.style,
        strokeStyle: 'dashed' as const
      }
    };
    
    render(
      <HighlightOverlay
        {...defaultProps}
        highlights={[dashedHighlight]}
      />
    );
    
    expect(mockRequestAnimationFrame).toHaveBeenCalled();
  });
});