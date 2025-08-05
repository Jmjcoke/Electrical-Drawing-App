/**
 * Coordinate mapping utilities for translating AI location data to visual overlay positions
 * Handles PDF zoom, pan, and viewport transformations
 */

import type { 
  Point, 
  HighlightCoordinates, 
  CoordinateTransform, 
  ViewportState 
} from '../types/highlighting.types';

/**
 * Maps normalized coordinates (0-1) to actual canvas coordinates
 * @param normalizedCoords - Normalized coordinates from AI response
 * @param canvasWidth - Current canvas width in pixels
 * @param canvasHeight - Current canvas height in pixels
 * @param viewportState - Current zoom and pan state
 * @returns Actual pixel coordinates for rendering
 */
export function mapNormalizedToCanvas(
  normalizedCoords: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
  viewportState: ViewportState
): Point {
  // Apply zoom and pan transformations
  const scaledX = (normalizedCoords.x * canvasWidth * viewportState.zoom) + viewportState.panX;
  const scaledY = (normalizedCoords.y * canvasHeight * viewportState.zoom) + viewportState.panY;
  
  return {
    x: Math.max(0, Math.min(scaledX, canvasWidth)),
    y: Math.max(0, Math.min(scaledY, canvasHeight))
  };
}

/**
 * Maps canvas coordinates back to normalized coordinates
 * @param canvasCoords - Canvas pixel coordinates
 * @param canvasWidth - Current canvas width in pixels
 * @param canvasHeight - Current canvas height in pixels
 * @param viewportState - Current zoom and pan state
 * @returns Normalized coordinates (0-1)
 */
export function mapCanvasToNormalized(
  canvasCoords: Point,
  canvasWidth: number,
  canvasHeight: number,
  viewportState: ViewportState
): Point {
  // Reverse zoom and pan transformations
  const normalizedX = (canvasCoords.x - viewportState.panX) / (canvasWidth * viewportState.zoom);
  const normalizedY = (canvasCoords.y - viewportState.panY) / (canvasHeight * viewportState.zoom);
  
  return {
    x: Math.max(0, Math.min(normalizedX, 1)),
    y: Math.max(0, Math.min(normalizedY, 1))
  };
}

/**
 * Calculates the transformation matrix for responsive highlighting
 * @param originalViewport - Original viewport when highlight was created
 * @param currentViewport - Current viewport state
 * @returns Coordinate transformation parameters
 */
export function calculateTransform(
  originalViewport: ViewportState,
  currentViewport: ViewportState
): CoordinateTransform {
  const scaleX = currentViewport.zoom / originalViewport.zoom;
  const scaleY = currentViewport.zoom / originalViewport.zoom;
  
  const offsetX = currentViewport.panX - (originalViewport.panX * scaleX);
  const offsetY = currentViewport.panY - (originalViewport.panY * scaleY);
  
  return {
    scale: scaleX,
    offsetX,
    offsetY,
    rotation: 0 // No rotation support in current implementation
  };
}

/**
 * Transforms highlight coordinates for responsive display
 * @param coordinates - Original highlight coordinates
 * @param transform - Coordinate transformation parameters
 * @param canvasWidth - Current canvas width
 * @param canvasHeight - Current canvas height
 * @returns Transformed coordinates for current viewport
 */
export function transformHighlightCoordinates(
  coordinates: HighlightCoordinates,
  transform: CoordinateTransform,
  canvasWidth: number,
  canvasHeight: number
): HighlightCoordinates {
  const transformedX = (coordinates.x * canvasWidth * transform.scale) + transform.offsetX;
  const transformedY = (coordinates.y * canvasHeight * transform.scale) + transform.offsetY;
  
  return {
    ...coordinates,
    x: transformedX / canvasWidth,
    y: transformedY / canvasHeight,
    width: coordinates.width ? coordinates.width * transform.scale : undefined,
    height: coordinates.height ? coordinates.height * transform.scale : undefined,
    radius: coordinates.radius ? coordinates.radius * transform.scale : undefined,
    points: coordinates.points?.map(point => ({
      x: ((point.x * canvasWidth * transform.scale) + transform.offsetX) / canvasWidth,
      y: ((point.y * canvasHeight * transform.scale) + transform.offsetY) / canvasHeight
    }))
  };
}

/**
 * Parses location hints from AI response text
 * @param text - AI response text that may contain location references
 * @returns Array of parsed location hints with confidence scores
 */
export function parseLocationHints(text: string): Array<{
  type: 'coordinate' | 'relative' | 'descriptive';
  value: string;
  parsedValue?: { x?: number; y?: number; reference?: string };
  confidence: number;
}> {
  const hints: Array<{
    type: 'coordinate' | 'relative' | 'descriptive';
    value: string;
    parsedValue?: { x?: number; y?: number; reference?: string };
    confidence: number;
  }> = [];
  
  // Coordinate pattern matching (e.g., "at coordinates 0.3, 0.7" or "at (150, 200)")
  const coordRegex = /(?:at|coordinates?|position|located)\s*(?:at)?\s*\(?(\d+\.?\d*),?\s*(\d+\.?\d*)\)?/gi;
  let coordMatch;
  
  while ((coordMatch = coordRegex.exec(text)) !== null) {
    const x = parseFloat(coordMatch[1]);
    const y = parseFloat(coordMatch[2]);
    
    // Determine if coordinates are normalized (0-1) or pixel values
    const isNormalized = x <= 1 && y <= 1;
    
    hints.push({
      type: 'coordinate',
      value: coordMatch[0],
      parsedValue: { x, y },
      confidence: isNormalized ? 0.9 : 0.7
    });
  }
  
  // Relative position patterns (e.g., "top-left", "center", "bottom-right")
  const relativeRegex = /\b(top|bottom|center|middle|left|right|upper|lower)[-\s]?(left|right|center|middle)?\b/gi;
  let relativeMatch;
  
  while ((relativeMatch = relativeRegex.exec(text)) !== null) {
    hints.push({
      type: 'relative',
      value: relativeMatch[0],
      parsedValue: { reference: relativeMatch[0].toLowerCase().replace(/\s+/g, '-') },
      confidence: 0.6
    });
  }
  
  // Descriptive patterns (e.g., "near the resistor", "next to component")
  const descriptiveRegex = /\b(?:near|next to|beside|above|below|left of|right of)\s+(?:the\s+)?(\w+)/gi;
  let descriptiveMatch;
  
  while ((descriptiveMatch = descriptiveRegex.exec(text)) !== null) {
    hints.push({
      type: 'descriptive',
      value: descriptiveMatch[0],
      parsedValue: { reference: descriptiveMatch[1] },
      confidence: 0.4
    });
  }
  
  return hints.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Validates coordinate data for rendering safety
 * @param coordinates - Coordinates to validate
 * @returns True if coordinates are valid for rendering
 */
export function validateCoordinates(coordinates: HighlightCoordinates): boolean {
  // Check basic coordinate validity
  if (coordinates.x < 0 || coordinates.x > 1 || coordinates.y < 0 || coordinates.y > 1) {
    return false;
  }
  
  // Check optional dimension validity
  if (coordinates.width !== undefined && (coordinates.width < 0 || coordinates.width > 1)) {
    return false;
  }
  
  if (coordinates.height !== undefined && (coordinates.height < 0 || coordinates.height > 1)) {
    return false;
  }
  
  if (coordinates.radius !== undefined && (coordinates.radius < 0 || coordinates.radius > 0.5)) {
    return false;
  }
  
  // Check polygon points validity
  if (coordinates.points) {
    return coordinates.points.every(point => 
      point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
    );
  }
  
  return true;
}