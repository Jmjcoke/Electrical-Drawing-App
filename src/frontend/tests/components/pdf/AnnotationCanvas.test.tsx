import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { jest } from '@jest/globals';
import { AnnotationCanvas } from '../../../components/pdf/AnnotationCanvas';
import { Annotation } from '../../../types/annotations';

// Mock canvas context
const mockContext = {
  clearRect: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  scale: jest.fn(),
  translate: jest.fn(),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 1,
  globalAlpha: 1,
  font: '',
  setLineDash: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  strokeRect: jest.fn(),
  fillRect: jest.fn(),
  fillText: jest.fn(),
  arc: jest.fn(),
  closePath: jest.fn(),
  globalCompositeOperation: 'source-over',
  shadowColor: '',
  shadowBlur: 0,
  measureText: jest.fn(() => ({ width: 100 }))
};

// Mock HTMLCanvasElement.getContext
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: jest.fn(() => mockContext),
  writable: true
});

describe('AnnotationCanvas', () => {
  const mockAnnotations: Annotation[] = [
    {
      id: 'ann-1',
      type: 'rectangle',
      points: [{ x: 100, y: 100 }, { x: 200, y: 200 }],
      bounds: { x: 100, y: 100, width: 100, height: 100 },
      style: {
        strokeColor: '#FF0000',
        fillColor: '#FF0000',
        strokeWidth: 2,
        fillOpacity: 0.1,
        fontSize: 14
      },
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      authorId: 'user-1',
      authorName: 'Test User'
    },
    {
      id: 'ann-2',
      type: 'text',
      text: 'Test annotation',
      position: { x: 150, y: 150 },
      style: {
        strokeColor: '#0000FF',
        fillColor: '#0000FF',
        strokeWidth: 1,
        fillOpacity: 1,
        fontSize: 16
      },
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-01T00:00:00Z',
      authorId: 'user-1',
      authorName: 'Test User'
    }
  ];

  const defaultProps = {
    width: 800,
    height: 600,
    scale: 1,
    activeTool: 'select' as const,
    annotationStyle: {
      strokeColor: '#FF0000',
      fillColor: '#FF0000',
      strokeWidth: 2,
      fillOpacity: 0.1,
      fontSize: 14
    },
    annotations: mockAnnotations,
    onAnnotationAdd: jest.fn(),
    onAnnotationUpdate: jest.fn(),
    onAnnotationDelete: jest.fn(),
    measurementUnit: 'ft' as const,
    isReadOnly: false,
    selectedAnnotationId: undefined,
    onAnnotationSelect: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockContext).forEach(mock => {
      if (typeof mock === 'function') {
        mock.mockClear?.();
      }
    });
  });

  describe('Rendering', () => {
    it('should render canvas with correct dimensions', () => {
      render(<AnnotationCanvas {...defaultProps} />);
      
      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveAttribute('width', '800');
      expect(canvas).toHaveAttribute('height', '600');
    });

    it('should render existing annotations', () => {
      render(<AnnotationCanvas {...defaultProps} />);
      
      // Canvas context should be called for drawing
      expect(mockContext.clearRect).toHaveBeenCalled();
      expect(mockContext.save).toHaveBeenCalled();
      expect(mockContext.restore).toHaveBeenCalled();
    });

    it('should apply scale transformation', () => {
      render(<AnnotationCanvas {...defaultProps} scale={2} />);
      
      expect(mockContext.scale).toHaveBeenCalledWith(2, 2);
    });
  });

  describe('Drawing Tools', () => {
    it('should start drawing rectangle on mouse down', () => {
      const onAnnotationAdd = jest.fn();
      render(
        <AnnotationCanvas 
          {...defaultProps} 
          activeTool="rectangle"
          onAnnotationAdd={onAnnotationAdd}
        />
      );
      
      const canvas = document.querySelector('canvas')!;
      
      // Start drawing
      fireEvent.mouseDown(canvas, {
        clientX: 100,
        clientY: 100
      });

      fireEvent.mouseMove(canvas, {
        clientX: 200,
        clientY: 200
      });

      fireEvent.mouseUp(canvas);

      expect(onAnnotationAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'rectangle',
          bounds: expect.any(Object)
        })
      );
    });

    it('should create text annotation with prompt', () => {
      const onAnnotationAdd = jest.fn();
      
      // Mock window.prompt
      const originalPrompt = window.prompt;
      window.prompt = jest.fn(() => 'Test text');
      
      render(
        <AnnotationCanvas 
          {...defaultProps} 
          activeTool="text"
          onAnnotationAdd={onAnnotationAdd}
        />
      );
      
      const canvas = document.querySelector('canvas')!;
      
      fireEvent.mouseDown(canvas, {
        clientX: 100,
        clientY: 100
      });

      expect(window.prompt).toHaveBeenCalledWith('Enter text:');
      expect(onAnnotationAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'text',
          text: 'Test text'
        })
      );

      // Restore original prompt
      window.prompt = originalPrompt;
    });

    it('should draw circle annotation', () => {
      const onAnnotationAdd = jest.fn();
      render(
        <AnnotationCanvas 
          {...defaultProps} 
          activeTool="circle"
          onAnnotationAdd={onAnnotationAdd}
        />
      );
      
      const canvas = document.querySelector('canvas')!;
      
      fireEvent.mouseDown(canvas, {
        clientX: 150,
        clientY: 150
      });

      fireEvent.mouseMove(canvas, {
        clientX: 200,
        clientY: 200
      });

      fireEvent.mouseUp(canvas);

      expect(onAnnotationAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'circle',
          center: expect.any(Object),
          radius: expect.any(Number)
        })
      );
    });

    it('should handle freehand drawing', () => {
      const onAnnotationAdd = jest.fn();
      render(
        <AnnotationCanvas 
          {...defaultProps} 
          activeTool="freehand"
          onAnnotationAdd={onAnnotationAdd}
        />
      );
      
      const canvas = document.querySelector('canvas')!;
      
      // Start freehand drawing
      fireEvent.mouseDown(canvas, {
        clientX: 100,
        clientY: 100
      });

      // Draw multiple points
      fireEvent.mouseMove(canvas, {
        clientX: 110,
        clientY: 110
      });

      fireEvent.mouseMove(canvas, {
        clientX: 120,
        clientY: 120
      });

      fireEvent.mouseUp(canvas);

      expect(onAnnotationAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'freehand',
          points: expect.arrayContaining([
            expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })
          ])
        })
      );
    });
  });

  describe('Annotation Selection', () => {
    it('should select annotation on click in select mode', () => {
      const onAnnotationSelect = jest.fn();
      render(
        <AnnotationCanvas 
          {...defaultProps} 
          activeTool="select"
          onAnnotationSelect={onAnnotationSelect}
        />
      );
      
      const canvas = document.querySelector('canvas')!;
      
      // Click on annotation area
      fireEvent.click(canvas, {
        clientX: 150, // Within bounds of first annotation
        clientY: 150
      });

      expect(onAnnotationSelect).toHaveBeenCalled();
    });

    it('should clear selection when clicking empty area', () => {
      const onAnnotationSelect = jest.fn();
      render(
        <AnnotationCanvas 
          {...defaultProps} 
          activeTool="select"
          onAnnotationSelect={onAnnotationSelect}
        />
      );
      
      const canvas = document.querySelector('canvas')!;
      
      // Click on empty area
      fireEvent.click(canvas, {
        clientX: 50,
        clientY: 50
      });

      expect(onAnnotationSelect).toHaveBeenCalledWith(null);
    });

    it('should highlight selected annotation', () => {
      render(
        <AnnotationCanvas 
          {...defaultProps} 
          selectedAnnotationId="ann-1"
        />
      );
      
      // Should draw with selection styling
      expect(mockContext.shadowColor).toBe('#0099FF');
      expect(mockContext.shadowBlur).toBe(5);
    });
  });

  describe('Read-Only Mode', () => {
    it('should not allow drawing in read-only mode', () => {
      const onAnnotationAdd = jest.fn();
      render(
        <AnnotationCanvas 
          {...defaultProps} 
          isReadOnly={true}
          activeTool="rectangle"
          onAnnotationAdd={onAnnotationAdd}
        />
      );
      
      const canvas = document.querySelector('canvas')!;
      
      fireEvent.mouseDown(canvas, {
        clientX: 100,
        clientY: 100
      });

      fireEvent.mouseUp(canvas);

      expect(onAnnotationAdd).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should delete selected annotation on Delete key', () => {
      const onAnnotationDelete = jest.fn();
      const onAnnotationSelect = jest.fn();
      
      render(
        <AnnotationCanvas 
          {...defaultProps} 
          selectedAnnotationId="ann-1"
          onAnnotationDelete={onAnnotationDelete}
          onAnnotationSelect={onAnnotationSelect}
        />
      );
      
      // Press Delete key
      fireEvent.keyDown(window, { key: 'Delete' });

      expect(onAnnotationDelete).toHaveBeenCalledWith('ann-1');
      expect(onAnnotationSelect).toHaveBeenCalledWith(null);
    });

    it('should not delete when no annotation is selected', () => {
      const onAnnotationDelete = jest.fn();
      
      render(
        <AnnotationCanvas 
          {...defaultProps} 
          onAnnotationDelete={onAnnotationDelete}
        />
      );
      
      // Press Delete key
      fireEvent.keyDown(window, { key: 'Delete' });

      expect(onAnnotationDelete).not.toHaveBeenCalled();
    });
  });

  describe('Cursor Styles', () => {
    it('should show crosshair cursor for drawing tools', () => {
      render(
        <AnnotationCanvas 
          {...defaultProps} 
          activeTool="rectangle"
        />
      );
      
      const canvas = document.querySelector('canvas')!;
      expect(canvas.style.cursor).toBe('crosshair');
    });

    it('should show pointer cursor for select tool', () => {
      render(
        <AnnotationCanvas 
          {...defaultProps} 
          activeTool="select"
        />
      );
      
      const canvas = document.querySelector('canvas')!;
      expect(canvas.style.cursor).toBe('pointer');
    });

    it('should show grab cursor for pan tool', () => {
      render(
        <AnnotationCanvas 
          {...defaultProps} 
          activeTool="pan"
        />
      );
      
      const canvas = document.querySelector('canvas')!;
      expect(canvas.style.cursor).toBe('grab');
    });
  });

  describe('Annotation Rendering', () => {
    it('should render rectangle annotations correctly', () => {
      render(<AnnotationCanvas {...defaultProps} />);
      
      expect(mockContext.strokeRect).toHaveBeenCalled();
      expect(mockContext.fillRect).toHaveBeenCalled();
    });

    it('should render text annotations correctly', () => {
      render(<AnnotationCanvas {...defaultProps} />);
      
      expect(mockContext.fillText).toHaveBeenCalledWith(
        'Test annotation',
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should apply annotation styles correctly', () => {
      render(<AnnotationCanvas {...defaultProps} />);
      
      expect(mockContext.strokeStyle).toBe('#FF0000');
      expect(mockContext.fillStyle).toBe('#FF0000');
      expect(mockContext.lineWidth).toBe(2);
    });
  });

  describe('Measurement Integration', () => {
    it('should create measurement annotation with display text', () => {
      const onAnnotationAdd = jest.fn();
      render(
        <AnnotationCanvas 
          {...defaultProps} 
          activeTool="measurement"
          onAnnotationAdd={onAnnotationAdd}
        />
      );
      
      const canvas = document.querySelector('canvas')!;
      
      fireEvent.mouseDown(canvas, {
        clientX: 100,
        clientY: 100
      });

      fireEvent.mouseMove(canvas, {
        clientX: 200,
        clientY: 200
      });

      fireEvent.mouseUp(canvas);

      expect(onAnnotationAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'measurement',
          measurement: expect.objectContaining({
            distance: expect.any(Number),
            unit: 'ft',
            displayText: expect.any(String)
          })
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing canvas context gracefully', () => {
      // Mock getContext to return null
      HTMLCanvasElement.prototype.getContext = jest.fn(() => null);
      
      expect(() => {
        render(<AnnotationCanvas {...defaultProps} />);
      }).not.toThrow();
    });

    it('should handle invalid annotation data', () => {
      const invalidAnnotations = [
        {
          ...mockAnnotations[0],
          bounds: undefined
        }
      ];
      
      expect(() => {
        render(
          <AnnotationCanvas 
            {...defaultProps} 
            annotations={invalidAnnotations as any}
          />
        );
      }).not.toThrow();
    });
  });
});