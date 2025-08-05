/**
 * Custom hook for schematic coordinate mapping and transformations
 * Handles PDF viewport changes, zoom, pan, and coordinate conversions
 */

import * as React from 'react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import type { ViewportState, CoordinateTransform, Point } from '../types/highlighting.types';
import { 
  mapNormalizedToCanvas, 
  mapCanvasToNormalized,
  calculateTransform 
} from '../utils/coordinate-mapper';

interface UseSchematicCoordinatesOptions {
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly initialZoom?: number;
  readonly minZoom?: number;
  readonly maxZoom?: number;
  readonly onViewportChange?: (viewport: ViewportState) => void;
}

interface UseSchematicCoordinatesReturn {
  // Current viewport state
  readonly viewport: ViewportState;
  readonly originalViewport: ViewportState;
  readonly transform: CoordinateTransform;
  
  // Coordinate conversion functions
  readonly normalizedToCanvas: (coords: Point) => Point;
  readonly canvasToNormalized: (coords: Point) => Point;
  
  // Viewport manipulation
  readonly setZoom: (zoom: number) => void;
  readonly setPan: (x: number, y: number) => void;
  readonly resetViewport: () => void;
  readonly fitToCanvas: () => void;
  
  // Event handlers for PDF integration
  readonly handleWheel: (event: WheelEvent) => void;
  readonly handleMouseDown: (event: MouseEvent) => void;
  readonly handleMouseMove: (event: MouseEvent) => void;
  readonly handleMouseUp: (event: MouseEvent) => void;
}

export function useSchematicCoordinates({
  canvasWidth,
  canvasHeight,
  initialZoom = 1,
  minZoom = 0.1,
  maxZoom = 10,
  onViewportChange
}: UseSchematicCoordinatesOptions): UseSchematicCoordinatesReturn {
  
  // Create initial viewport state
  const initialViewport = useMemo((): ViewportState => ({
    zoom: initialZoom,
    panX: 0,
    panY: 0,
    width: canvasWidth,
    height: canvasHeight
  }), [initialZoom, canvasWidth, canvasHeight]);
  
  // Current viewport state
  const [viewport, setViewport] = useState<ViewportState>(initialViewport);
  
  // Mouse interaction state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [lastPan, setLastPan] = useState<Point>({ x: 0, y: 0 });
  
  // Calculate coordinate transformation
  const transform = useMemo(() => 
    calculateTransform(initialViewport, viewport),
    [initialViewport, viewport]
  );
  
  // Update viewport when canvas dimensions change
  useEffect(() => {
    setViewport(prev => ({
      ...prev,
      width: canvasWidth,
      height: canvasHeight
    }));
  }, [canvasWidth, canvasHeight]);
  
  // Notify parent of viewport changes
  useEffect(() => {
    onViewportChange?.(viewport);
  }, [viewport, onViewportChange]);
  
  // Coordinate conversion functions
  const normalizedToCanvas = useCallback((coords: Point): Point => {
    return mapNormalizedToCanvas(coords, canvasWidth, canvasHeight, viewport);
  }, [canvasWidth, canvasHeight, viewport]);
  
  const canvasToNormalized = useCallback((coords: Point): Point => {
    return mapCanvasToNormalized(coords, canvasWidth, canvasHeight, viewport);
  }, [canvasWidth, canvasHeight, viewport]);
  
  // Viewport manipulation functions
  const setZoom = useCallback((zoom: number): void => {
    const clampedZoom = Math.max(minZoom, Math.min(maxZoom, zoom));
    
    setViewport(prev => ({
      ...prev,
      zoom: clampedZoom
    }));
  }, [minZoom, maxZoom]);
  
  const setPan = useCallback((x: number, y: number): void => {
    // Clamp pan values to prevent over-panning
    const maxPanX = Math.max(0, (canvasWidth * viewport.zoom - canvasWidth) / 2);
    const maxPanY = Math.max(0, (canvasHeight * viewport.zoom - canvasHeight) / 2);
    
    const clampedX = Math.max(-maxPanX, Math.min(maxPanX, x));
    const clampedY = Math.max(-maxPanY, Math.min(maxPanY, y));
    
    setViewport(prev => ({
      ...prev,
      panX: clampedX,
      panY: clampedY
    }));
  }, [canvasWidth, canvasHeight, viewport.zoom]);
  
  const resetViewport = useCallback((): void => {
    setViewport(initialViewport);
  }, [initialViewport]);
  
  const fitToCanvas = useCallback((): void => {
    setViewport({
      zoom: 1,
      panX: 0,
      panY: 0,
      width: canvasWidth,
      height: canvasHeight
    });
  }, [canvasWidth, canvasHeight]);
  
  // Mouse wheel zoom handler
  const handleWheel = useCallback((event: WheelEvent): void => {
    event.preventDefault();
    
    const zoomFactor = 1 + (event.deltaY > 0 ? -0.1 : 0.1);
    const newZoom = viewport.zoom * zoomFactor;
    
    if (newZoom >= minZoom && newZoom <= maxZoom) {
      // Calculate zoom center point
      const rect = (event.target as HTMLElement).getBoundingClientRect();
      const centerX = event.clientX - rect.left;
      const centerY = event.clientY - rect.top;
      
      // Adjust pan to zoom towards mouse cursor
      const panAdjustX = (centerX - canvasWidth / 2) * (zoomFactor - 1);
      const panAdjustY = (centerY - canvasHeight / 2) * (zoomFactor - 1);
      
      setViewport(prev => ({
        ...prev,
        zoom: newZoom,
        panX: prev.panX - panAdjustX,
        panY: prev.panY - panAdjustY
      }));
    }
  }, [viewport.zoom, minZoom, maxZoom, canvasWidth, canvasHeight]);
  
  // Mouse drag start handler
  const handleMouseDown = useCallback((event: MouseEvent): void => {
    if (event.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: event.clientX, y: event.clientY });
      setLastPan({ x: viewport.panX, y: viewport.panY });
    }
  }, [viewport.panX, viewport.panY]);
  
  // Mouse drag handler
  const handleMouseMove = useCallback((event: MouseEvent): void => {
    if (!isDragging) return;
    
    const deltaX = event.clientX - dragStart.x;
    const deltaY = event.clientY - dragStart.y;
    
    setPan(lastPan.x + deltaX, lastPan.y + deltaY);
  }, [isDragging, dragStart, lastPan, setPan]);
  
  // Mouse drag end handler
  const handleMouseUp = useCallback((event: MouseEvent): void => {
    if (event.button === 0) { // Left mouse button
      setIsDragging(false);
      setDragStart({ x: 0, y: 0 });
      setLastPan({ x: 0, y: 0 });
    }
  }, []);
  
  return {
    // Current state
    viewport,
    originalViewport: initialViewport,
    transform,
    
    // Coordinate conversion
    normalizedToCanvas,
    canvasToNormalized,
    
    // Viewport manipulation
    setZoom,
    setPan,
    resetViewport,
    fitToCanvas,
    
    // Event handlers
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  };
}