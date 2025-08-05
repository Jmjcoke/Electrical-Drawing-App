/**
 * HighlightOverlay component for rendering interactive highlights on PDF canvas
 * Supports multiple highlight types, animations, and responsive scaling
 * Now enhanced with performance optimization and accessibility features
 */

import * as React from 'react';
import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import type { 
  ComponentHighlight, 
  HighlightStyle,
  ViewportState,
  Point
} from '../../types/highlighting.types';
import { 
  mapNormalizedToCanvas, 
  transformHighlightCoordinates,
  calculateTransform,
  validateCoordinates
} from '../../utils/coordinate-mapper';
import { LazyHighlightOverlay } from './LazyHighlightOverlay';
import { AccessibleHighlightSystem } from '../accessibility/AccessibleHighlightSystem';

interface HighlightOverlayProps {
  readonly highlights: ComponentHighlight[];
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly viewportState: ViewportState;
  readonly originalViewport: ViewportState;
  readonly onHighlightClick?: (highlightId: string) => void;
  readonly onHighlightHover?: (highlightId: string | null) => void;
  readonly onHighlightSelect?: (highlightId: string | null) => void;
  readonly onHighlightToggle?: (highlightId: string, visible: boolean) => void;
  readonly onHighlightFocus?: (highlightId: string) => void;
  readonly selectedHighlightId?: string | null;
  readonly enableAccessibility?: boolean;
  readonly enableLazyLoading?: boolean;
  readonly enableHighContrast?: boolean;
  readonly enableReducedMotion?: boolean;
  readonly className?: string;
}

/**
 * Renders shape-specific highlight on canvas context
 */
function renderHighlight(
  ctx: CanvasRenderingContext2D,
  highlight: ComponentHighlight,
  canvasCoords: Point,
  style: HighlightStyle
): void {
  const { coordinates } = highlight;
  
  // Set common style properties
  ctx.globalAlpha = style.opacity;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.strokeWidth;
  ctx.fillStyle = style.color;
  ctx.globalAlpha = style.fillOpacity;
  
  // Set line style
  switch (style.strokeStyle) {
    case 'dashed':
      ctx.setLineDash([5, 5]);
      break;
    case 'dotted':
      ctx.setLineDash([2, 2]);
      break;
    default:
      ctx.setLineDash([]);
  }
  
  ctx.beginPath();
  
  // Render based on highlight type and available coordinate data
  if (coordinates.radius !== undefined) {
    // Circular highlight
    const radius = coordinates.radius * Math.min(ctx.canvas.width, ctx.canvas.height);
    ctx.arc(canvasCoords.x, canvasCoords.y, radius, 0, 2 * Math.PI);
  } else if (coordinates.points && coordinates.points.length > 2) {
    // Polygon highlight
    const firstPoint = mapNormalizedToCanvas(
      coordinates.points[0], 
      ctx.canvas.width, 
      ctx.canvas.height,
      { zoom: 1, panX: 0, panY: 0, width: ctx.canvas.width, height: ctx.canvas.height }
    );
    ctx.moveTo(firstPoint.x, firstPoint.y);
    
    coordinates.points.slice(1).forEach(point => {
      const canvasPoint = mapNormalizedToCanvas(
        point, 
        ctx.canvas.width, 
        ctx.canvas.height,
        { zoom: 1, panX: 0, panY: 0, width: ctx.canvas.width, height: ctx.canvas.height }
      );
      ctx.lineTo(canvasPoint.x, canvasPoint.y);
    });
    
    ctx.closePath();
  } else {
    // Rectangular highlight (default)
    const width = (coordinates.width || 0.05) * ctx.canvas.width;
    const height = (coordinates.height || 0.05) * ctx.canvas.height;
    ctx.rect(
      canvasCoords.x - width / 2, 
      canvasCoords.y - height / 2, 
      width, 
      height
    );
  }
  
  // Fill and stroke the shape
  if (style.fillOpacity > 0) {
    ctx.globalAlpha = style.fillOpacity;
    ctx.fill();
  }
  
  ctx.globalAlpha = style.opacity;
  ctx.stroke();
  
  // Reset context state
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
}

/**
 * Applies animation effects to highlight rendering
 */
function applyAnimation(
  ctx: CanvasRenderingContext2D,
  animationType: string,
  timestamp: number
): void {
  switch (animationType) {
    case 'pulse':
      const pulseScale = 1 + 0.1 * Math.sin(timestamp * 0.005);
      ctx.scale(pulseScale, pulseScale);
      break;
    case 'glow':
      ctx.shadowColor = ctx.strokeStyle as string;
      ctx.shadowBlur = 10 + 5 * Math.sin(timestamp * 0.003);
      break;
    case 'fade':
      const fadeAlpha = 0.5 + 0.3 * Math.sin(timestamp * 0.002);
      ctx.globalAlpha *= fadeAlpha;
      break;
    default:
      // No animation
      break;
  }
}

export const HighlightOverlay: React.FC<HighlightOverlayProps> = React.memo(({
  highlights,
  canvasWidth,
  canvasHeight,
  viewportState,
  originalViewport,
  onHighlightClick,
  onHighlightHover,
  onHighlightSelect,
  onHighlightToggle,
  onHighlightFocus,
  selectedHighlightId = null,
  enableAccessibility = true,
  enableLazyLoading = true,
  enableHighContrast = false,
  enableReducedMotion = false,
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const lastTimestampRef = useRef<number>(0);
  const [showAccessibilityPanel, setShowAccessibilityPanel] = useState(false);
  
  // Calculate coordinate transformation for responsive highlighting
  const coordinateTransform = useMemo(() => 
    calculateTransform(originalViewport, viewportState),
    [originalViewport, viewportState]
  );
  
  // Filter and sort highlights by z-index
  const visibleHighlights = useMemo(() => 
    highlights
      .filter(h => h.isVisible && validateCoordinates(h.coordinates))
      .sort((a, b) => a.style.zIndex - b.style.zIndex),
    [highlights]
  );
  
  // Determine rendering strategy based on highlight count and preferences
  const shouldUseLazyLoading = enableLazyLoading && highlights.length > 50;
  const shouldUseOptimizedRenderer = highlights.length > 20;
  
  // Animation loop for highlight effects
  const animate = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Render each visible highlight
    visibleHighlights.forEach(highlight => {
      ctx.save();
      
      // Transform coordinates for current viewport
      const transformedCoords = transformHighlightCoordinates(
        highlight.coordinates,
        coordinateTransform,
        canvasWidth,
        canvasHeight
      );
      
      // Map to canvas coordinates
      const canvasCoords = mapNormalizedToCanvas(
        { x: transformedCoords.x, y: transformedCoords.y },
        canvasWidth,
        canvasHeight,
        viewportState
      );
      
      // Apply animation if specified
      if (highlight.style.animationType && highlight.style.animationType !== 'none') {
        applyAnimation(ctx, highlight.style.animationType, timestamp);
      }
      
      // Render the highlight
      renderHighlight(ctx, highlight, canvasCoords, highlight.style);
      
      ctx.restore();
    });
    
    // Continue animation loop if any highlights have animations
    const hasAnimations = visibleHighlights.some(h => 
      h.style.animationType && h.style.animationType !== 'none'
    );
    
    if (hasAnimations) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
    
    lastTimestampRef.current = timestamp;
  }, [visibleHighlights, coordinateTransform, canvasWidth, canvasHeight, viewportState]);
  
  // Handle canvas click events
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onHighlightClick) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    
    // Find clicked highlight (reverse order to check top highlights first)
    const clickedHighlight = [...visibleHighlights].reverse().find(highlight => {
      const transformedCoords = transformHighlightCoordinates(
        highlight.coordinates,
        coordinateTransform,
        canvasWidth,
        canvasHeight
      );
      
      const canvasCoords = mapNormalizedToCanvas(
        { x: transformedCoords.x, y: transformedCoords.y },
        canvasWidth,
        canvasHeight,
        viewportState
      );
      
      // Simple distance-based hit testing
      const distance = Math.sqrt(
        Math.pow(clickX - canvasCoords.x, 2) + Math.pow(clickY - canvasCoords.y, 2)
      );
      
      const hitRadius = Math.max(
        (transformedCoords.radius || 0.02) * Math.min(canvasWidth, canvasHeight),
        20 // Minimum 20px hit area
      );
      
      return distance <= hitRadius;
    });
    
    if (clickedHighlight) {
      onHighlightClick(clickedHighlight.id);
    }
  }, [visibleHighlights, coordinateTransform, canvasWidth, canvasHeight, viewportState, onHighlightClick]);
  
  // Handle mouse move for hover effects
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onHighlightHover) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Find hovered highlight
    const hoveredHighlight = [...visibleHighlights].reverse().find(highlight => {
      const transformedCoords = transformHighlightCoordinates(
        highlight.coordinates,
        coordinateTransform,
        canvasWidth,
        canvasHeight
      );
      
      const canvasCoords = mapNormalizedToCanvas(
        { x: transformedCoords.x, y: transformedCoords.y },
        canvasWidth,
        canvasHeight,
        viewportState
      );
      
      const distance = Math.sqrt(
        Math.pow(mouseX - canvasCoords.x, 2) + Math.pow(mouseY - canvasCoords.y, 2)
      );
      
      const hitRadius = Math.max(
        (transformedCoords.radius || 0.02) * Math.min(canvasWidth, canvasHeight),
        20
      );
      
      return distance <= hitRadius;
    });
    
    onHighlightHover(hoveredHighlight?.id || null);
  }, [visibleHighlights, coordinateTransform, canvasWidth, canvasHeight, viewportState, onHighlightHover]);
  
  // Setup canvas and start animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set canvas size
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [canvasWidth, canvasHeight, animate]);
  
  // Re-render when highlights change
  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [animate]);
  
  // Handle accessibility panel toggle
  const handleAccessibilityToggle = useCallback(() => {
    setShowAccessibilityPanel(!showAccessibilityPanel);
  }, [showAccessibilityPanel]);
  
  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.altKey && event.key === 'a') {
      event.preventDefault();
      handleAccessibilityToggle();
    }
  }, [handleAccessibilityToggle]);
  
  // Setup keyboard event listeners
  useEffect(() => {
    if (enableAccessibility) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [enableAccessibility, handleKeyDown]);

  // Render with performance optimization and accessibility
  if (shouldUseLazyLoading) {
    return (
      <Box className={className} sx={{ position: 'relative', width: canvasWidth, height: canvasHeight }}>
        <LazyHighlightOverlay
          highlights={highlights}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          viewportState={viewportState}
          originalViewport={{ width: originalViewport.width, height: originalViewport.height }}
          onHighlightClick={onHighlightClick}
          onHighlightHover={onHighlightHover}
          enableVirtualization={enableLazyLoading}
          loadingThreshold={50}
          chunkSize={25}
          maxConcurrentLoads={3}
        />
        
        {enableAccessibility && (
          <>
            {/* Accessibility toggle button */}
            <Box
              component="button"
              onClick={handleAccessibilityToggle}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                border: 'none',
                borderRadius: 1,
                padding: '4px 8px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                zIndex: 1000,
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.9)'
                },
                '&:focus': {
                  outline: '2px solid white',
                  outlineOffset: 2
                }
              }}
              aria-label="Toggle accessibility panel (Alt+A)"
              title="Toggle accessibility panel (Alt+A)"
            >
              A11y
            </Box>
            
            {/* Accessibility panel */}
            {showAccessibilityPanel && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 40,
                  right: 8,
                  width: 300,
                  maxHeight: 400,
                  backgroundColor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  boxShadow: 3,
                  zIndex: 1000,
                  overflow: 'hidden'
                }}
              >
                <AccessibleHighlightSystem
                  highlights={highlights}
                  selectedHighlightId={selectedHighlightId}
                  onHighlightSelect={onHighlightSelect || (() => {})}
                  onHighlightToggle={onHighlightToggle || (() => {})}
                  onHighlightFocus={onHighlightFocus || (() => {})}
                  enableHighContrast={enableHighContrast}
                  enableReducedMotion={enableReducedMotion}
                  announceChanges={true}
                />
              </Box>
            )}
          </>
        )}
      </Box>
    );
  }

  // Fallback to original rendering for smaller highlight sets
  return (
    <Box className={className} sx={{ position: 'relative', width: canvasWidth, height: canvasHeight }}>
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'auto',
          cursor: visibleHighlights.length > 0 ? 'pointer' : 'default'
        }}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => onHighlightHover?.(null)}
        aria-label="Interactive highlight overlay"
        role="img"
      />
      
      {enableAccessibility && (
        <>
          {/* Accessibility toggle button */}
          <Box
            component="button"
            onClick={handleAccessibilityToggle}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              border: 'none',
              borderRadius: 1,
              padding: '4px 8px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              zIndex: 1000,
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.9)'
              },
              '&:focus': {
                outline: '2px solid white',
                outlineOffset: 2
              }
            }}
            aria-label="Toggle accessibility panel (Alt+A)"
            title="Toggle accessibility panel (Alt+A)"
          >
            A11y
          </Box>
          
          {/* Accessibility panel */}
          {showAccessibilityPanel && (
            <Box
              sx={{
                position: 'absolute',
                top: 40,
                right: 8,
                width: 300,
                maxHeight: 400,
                backgroundColor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                boxShadow: 3,
                zIndex: 1000,
                overflow: 'hidden'
              }}
            >
              <AccessibleHighlightSystem
                highlights={highlights}
                selectedHighlightId={selectedHighlightId}
                onHighlightSelect={onHighlightSelect || (() => {})}
                onHighlightToggle={onHighlightToggle || (() => {})}
                onHighlightFocus={onHighlightFocus || (() => {})}
                enableHighContrast={enableHighContrast}
                enableReducedMotion={enableReducedMotion}
                announceChanges={true}
              />
            </Box>
          )}
        </>
      )}
    </Box>
  );
});

HighlightOverlay.displayName = 'HighlightOverlay';