/**
 * Unit tests for coordinate mapping utilities
 * Tests coordinate transformations, viewport handling, and location parsing
 */

import {
  mapNormalizedToCanvas,
  mapCanvasToNormalized,
  calculateTransform,
  transformHighlightCoordinates,
  parseLocationHints,
  validateCoordinates
} from '../coordinate-mapper';
import type { ViewportState, HighlightCoordinates } from '../../types/highlighting.types';

describe('coordinate-mapper', () => {
  const mockViewport: ViewportState = {
    zoom: 1,
    panX: 0,
    panY: 0,
    width: 800,
    height: 600
  };

  describe('mapNormalizedToCanvas', () => {
    it('should map normalized coordinates to canvas coordinates', () => {
      const result = mapNormalizedToCanvas(
        { x: 0.5, y: 0.5 },
        800,
        600,
        mockViewport
      );

      expect(result).toEqual({ x: 400, y: 300 });
    });

    it('should handle zoom scaling', () => {
      const zoomedViewport: ViewportState = {
        ...mockViewport,
        zoom: 2
      };

      const result = mapNormalizedToCanvas(
        { x: 0.5, y: 0.5 },
        800,
        600,
        zoomedViewport
      );

      expect(result).toEqual({ x: 800, y: 600 });
    });

    it('should handle pan offset', () => {
      const pannedViewport: ViewportState = {
        ...mockViewport,
        panX: 100,
        panY: 50
      };

      const result = mapNormalizedToCanvas(
        { x: 0.5, y: 0.5 },
        800,
        600,
        pannedViewport
      );

      expect(result).toEqual({ x: 500, y: 350 });
    });

    it('should clamp coordinates to canvas bounds', () => {
      const result = mapNormalizedToCanvas(
        { x: 2, y: -1 },
        800,
        600,
        mockViewport
      );

      expect(result.x).toBeLessThanOrEqual(800);
      expect(result.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe('mapCanvasToNormalized', () => {
    it('should map canvas coordinates to normalized coordinates', () => {
      const result = mapCanvasToNormalized(
        { x: 400, y: 300 },
        800,
        600,
        mockViewport
      );

      expect(result).toEqual({ x: 0.5, y: 0.5 });
    });

    it('should handle zoom scaling in reverse', () => {
      const zoomedViewport: ViewportState = {
        ...mockViewport,
        zoom: 2
      };

      const result = mapCanvasToNormalized(
        { x: 800, y: 600 },
        800,
        600,
        zoomedViewport
      );

      expect(result).toEqual({ x: 0.5, y: 0.5 });
    });

    it('should clamp to normalized bounds', () => {
      const result = mapCanvasToNormalized(
        { x: 1000, y: -100 },
        800,
        600,
        mockViewport
      );

      expect(result.x).toBeLessThanOrEqual(1);
      expect(result.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateTransform', () => {
    it('should calculate identity transform for same viewports', () => {
      const transform = calculateTransform(mockViewport, mockViewport);

      expect(transform).toEqual({
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        rotation: 0
      });
    });

    it('should calculate scale transform for zoom changes', () => {
      const zoomedViewport: ViewportState = {
        ...mockViewport,
        zoom: 2
      };

      const transform = calculateTransform(mockViewport, zoomedViewport);

      expect(transform.scale).toBe(2);
    });

    it('should calculate offset transform for pan changes', () => {
      const pannedViewport: ViewportState = {
        ...mockViewport,
        panX: 100,
        panY: 50
      };

      const transform = calculateTransform(mockViewport, pannedViewport);

      expect(transform.offsetX).toBe(100);
      expect(transform.offsetY).toBe(50);
    });
  });

  describe('transformHighlightCoordinates', () => {
    const mockCoordinates: HighlightCoordinates = {
      x: 0.5,
      y: 0.5,
      width: 0.1,
      height: 0.1,
      pageNumber: 1,
      zoomLevel: 1,
      viewportOffset: { x: 0, y: 0 }
    };

    it('should apply identity transform correctly', () => {
      const transform = {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
        rotation: 0
      };

      const result = transformHighlightCoordinates(
        mockCoordinates,
        transform,
        800,
        600
      );

      expect(result.x).toBeCloseTo(0.5);
      expect(result.y).toBeCloseTo(0.5);
      expect(result.width).toBeCloseTo(0.1);
      expect(result.height).toBeCloseTo(0.1);
    });

    it('should apply scale transform', () => {
      const transform = {
        scale: 2,
        offsetX: 0,
        offsetY: 0,
        rotation: 0
      };

      const result = transformHighlightCoordinates(
        mockCoordinates,
        transform,
        800,
        600
      );

      expect(result.width).toBeCloseTo(0.2);
      expect(result.height).toBeCloseTo(0.2);
    });

    it('should handle polygon points transformation', () => {
      const polygonCoords: HighlightCoordinates = {
        ...mockCoordinates,
        points: [
          { x: 0.3, y: 0.3 },
          { x: 0.7, y: 0.3 },
          { x: 0.7, y: 0.7 },
          { x: 0.3, y: 0.7 }
        ]
      };

      const transform = {
        scale: 1.5,
        offsetX: 50,
        offsetY: 25,
        rotation: 0
      };

      const result = transformHighlightCoordinates(
        polygonCoords,
        transform,
        800,
        600
      );

      expect(result.points).toBeDefined();
      expect(result.points).toHaveLength(4);
      
      // First point should be transformed
      expect(result.points![0].x).not.toBe(0.3);
      expect(result.points![0].y).not.toBe(0.3);
    });
  });

  describe('parseLocationHints', () => {
    it('should parse coordinate patterns', () => {
      const text = 'The component is located at coordinates 0.3, 0.7 in the drawing.';
      const hints = parseLocationHints(text);

      expect(hints).toHaveLength(1);
      expect(hints[0].type).toBe('coordinate');
      expect(hints[0].parsedValue).toEqual({ x: 0.3, y: 0.7 });
      expect(hints[0].confidence).toBe(0.9);
    });

    it('should parse pixel coordinates with lower confidence', () => {
      const text = 'The resistor is at position (150, 200) on the schematic.';
      const hints = parseLocationHints(text);

      expect(hints).toHaveLength(1);
      expect(hints[0].type).toBe('coordinate');
      expect(hints[0].parsedValue).toEqual({ x: 150, y: 200 });
      expect(hints[0].confidence).toBe(0.7);
    });

    it('should parse relative position patterns', () => {
      const text = 'The capacitor is in the top-left corner of the circuit.';
      const hints = parseLocationHints(text);

      expect(hints.some(h => h.type === 'relative')).toBe(true);
      const relativeHint = hints.find(h => h.type === 'relative');
      expect(relativeHint?.parsedValue?.reference).toBe('top-left');
    });

    it('should parse descriptive patterns', () => {
      const text = 'The LED is located next to the resistor in the circuit.';
      const hints = parseLocationHints(text);

      expect(hints.some(h => h.type === 'descriptive')).toBe(true);
      const descriptiveHint = hints.find(h => h.type === 'descriptive');
      expect(descriptiveHint?.parsedValue?.reference).toBe('resistor');
    });

    it('should sort hints by confidence', () => {
      const text = 'The component at 0.5, 0.5 is near the resistor in the top-right area.';
      const hints = parseLocationHints(text);

      expect(hints.length).toBeGreaterThan(1);
      
      // Should be sorted by confidence (descending)
      for (let i = 1; i < hints.length; i++) {
        expect(hints[i - 1].confidence).toBeGreaterThanOrEqual(hints[i].confidence);
      }
    });

    it('should handle text with no location hints', () => {
      const text = 'This is just regular text without any location information.';
      const hints = parseLocationHints(text);

      expect(hints).toHaveLength(0);
    });
  });

  describe('validateCoordinates', () => {
    it('should validate correct coordinates', () => {
      const validCoords: HighlightCoordinates = {
        x: 0.5,
        y: 0.3,
        width: 0.2,
        height: 0.1,
        pageNumber: 1,
        zoomLevel: 1,
        viewportOffset: { x: 0, y: 0 }
      };

      expect(validateCoordinates(validCoords)).toBe(true);
    });

    it('should reject coordinates outside bounds', () => {
      const invalidCoords: HighlightCoordinates = {
        x: 1.5,
        y: 0.3,
        pageNumber: 1,
        zoomLevel: 1,
        viewportOffset: { x: 0, y: 0 }
      };

      expect(validateCoordinates(invalidCoords)).toBe(false);
    });

    it('should reject negative coordinates', () => {
      const invalidCoords: HighlightCoordinates = {
        x: -0.1,
        y: 0.3,
        pageNumber: 1,
        zoomLevel: 1,
        viewportOffset: { x: 0, y: 0 }
      };

      expect(validateCoordinates(invalidCoords)).toBe(false);
    });

    it('should validate radius constraints', () => {
      const validCircle: HighlightCoordinates = {
        x: 0.5,
        y: 0.5,
        radius: 0.3,
        pageNumber: 1,
        zoomLevel: 1,
        viewportOffset: { x: 0, y: 0 }
      };

      expect(validateCoordinates(validCircle)).toBe(true);

      const invalidCircle: HighlightCoordinates = {
        x: 0.5,
        y: 0.5,
        radius: 0.8, // Too large
        pageNumber: 1,
        zoomLevel: 1,
        viewportOffset: { x: 0, y: 0 }
      };

      expect(validateCoordinates(invalidCircle)).toBe(false);
    });

    it('should validate polygon points', () => {
      const validPolygon: HighlightCoordinates = {
        x: 0.5,
        y: 0.5,
        points: [
          { x: 0.3, y: 0.3 },
          { x: 0.7, y: 0.3 },
          { x: 0.7, y: 0.7 }
        ],
        pageNumber: 1,
        zoomLevel: 1,
        viewportOffset: { x: 0, y: 0 }
      };

      expect(validateCoordinates(validPolygon)).toBe(true);

      const invalidPolygon: HighlightCoordinates = {
        x: 0.5,
        y: 0.5,
        points: [
          { x: 1.5, y: 0.3 }, // Out of bounds
          { x: 0.7, y: 0.3 }
        ],
        pageNumber: 1,
        zoomLevel: 1,
        viewportOffset: { x: 0, y: 0 }
      };

      expect(validateCoordinates(invalidPolygon)).toBe(false);
    });
  });
});