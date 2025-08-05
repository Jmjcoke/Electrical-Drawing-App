/**
 * Lazy Highlight Overlay Component
 * Implements lazy loading and virtualization for handling large numbers of highlights efficiently
 */

import * as React from 'react';
import { 
  useRef, 
  useEffect, 
  useCallback, 
  useMemo, 
  useState,
  startTransition
} from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import type {
  ComponentHighlight,
  ViewportState,
  Point
} from '../../types/highlighting.types';
import { getOptimizedHighlightRenderer } from '../../services/optimized-highlight-renderer';
import { mapNormalizedToCanvas, transformHighlightCoordinates } from '../../utils/coordinate-mapper';

interface LazyHighlightOverlayProps {
  readonly highlights: ComponentHighlight[];
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly viewportState: ViewportState;
  readonly originalViewport: { width: number; height: number };
  readonly onHighlightClick?: (highlightId: string) => void;
  readonly onHighlightHover?: (highlightId: string | null) => void;
  readonly className?: string;
  readonly chunkSize?: number;
  readonly loadingThreshold?: number;
  readonly enableVirtualization?: boolean;
  readonly maxConcurrentLoads?: number;
}

interface HighlightChunk {
  readonly id: string;
  readonly highlights: ComponentHighlight[];
  readonly bounds: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };
  readonly isLoaded: boolean;
  readonly isVisible: boolean;
  readonly priority: number;
}

interface LoadingState {
  readonly isLoading: boolean;
  readonly loadedChunks: number;
  readonly totalChunks: number;
  readonly error: string | null;
}

export const LazyHighlightOverlay: React.FC<LazyHighlightOverlayProps> = React.memo((props) => {
  const {
    highlights,
    canvasWidth,
    canvasHeight,
    viewportState,
    originalViewport,
    onHighlightClick,
    onHighlightHover,
    className,
    chunkSize = 50,
    loadingThreshold = 100,
    enableVirtualization = true,
    maxConcurrentLoads = 3
  } = props;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const interactionCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef(getOptimizedHighlightRenderer());
  const loadingQueue = useRef<HighlightChunk[]>([]);
  const loadingPromises = useRef(new Set<Promise<void>>());
  
  const [chunks, setChunks] = useState<HighlightChunk[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    loadedChunks: 0,
    totalChunks: 0,
    error: null
  });

  // Determine if lazy loading should be enabled based on highlight count
  const shouldUseLazyLoading = highlights.length > loadingThreshold;

  // Create highlight chunks for lazy loading
  const highlightChunks = useMemo(() => {
    if (!shouldUseLazyLoading || !enableVirtualization) {
      return [{
        id: 'single-chunk',
        highlights,
        bounds: { left: 0, top: 0, right: canvasWidth, bottom: canvasHeight },
        isLoaded: true,
        isVisible: true,
        priority: 1
      }];
    }

    return createHighlightChunks(highlights, chunkSize, canvasWidth, canvasHeight, originalViewport);
  }, [highlights, shouldUseLazyLoading, enableVirtualization, chunkSize, canvasWidth, canvasHeight, originalViewport]);

  // Update visible chunks based on viewport
  const visibleChunks = useMemo(() => {
    if (!shouldUseLazyLoading) return highlightChunks;

    return updateVisibleChunks(highlightChunks, viewportState, canvasWidth, canvasHeight);
  }, [highlightChunks, viewportState, canvasWidth, canvasHeight, shouldUseLazyLoading]);

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = rendererRef.current;
    const initialized = renderer.initialize(canvas);

    if (!initialized) {
      setLoadingState(prev => ({
        ...prev,
        error: 'Failed to initialize highlight renderer'
      }));
    }

    return () => {
      renderer.dispose();
    };
  }, []);

  // Update canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    const interactionCanvas = interactionCanvasRef.current;
    
    if (canvas) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }
    
    if (interactionCanvas) {
      interactionCanvas.width = canvasWidth;
      interactionCanvas.height = canvasHeight;
    }
  }, [canvasWidth, canvasHeight]);

  // Load visible chunks progressively
  useEffect(() => {
    if (!shouldUseLazyLoading) {
      // Direct rendering for small highlight sets
      renderHighlights(highlights);
      return;
    }

    loadVisibleChunks(visibleChunks);
  }, [visibleChunks, shouldUseLazyLoading]);

  // Render highlights function
  const renderHighlights = useCallback((highlightsToRender: ComponentHighlight[]) => {
    const renderer = rendererRef.current;
    
    startTransition(() => {
      try {
        renderer.render(highlightsToRender, viewportState, originalViewport);
      } catch (error) {
        console.error('Highlight rendering error:', error);
        setError(error instanceof Error ? error.message : 'Rendering failed');
      }
    });
  }, [viewportState, originalViewport]);

  // Load visible chunks with priority queue
  const loadVisibleChunks = useCallback(async (chunksToLoad: HighlightChunk[]) => {
    const unloadedVisibleChunks = chunksToLoad
      .filter(chunk => chunk.isVisible && !chunk.isLoaded)
      .sort((a, b) => b.priority - a.priority);

    if (unloadedVisibleChunks.length === 0) {
      // All visible chunks are loaded, render them
      const loadedHighlights = chunksToLoad
        .filter(chunk => chunk.isLoaded && chunk.isVisible)
        .flatMap(chunk => chunk.highlights);
      
      renderHighlights(loadedHighlights);
      return;
    }

    setLoadingState(prev => ({
      ...prev,
      isLoading: true,
      totalChunks: unloadedVisibleChunks.length
    }));

    // Process chunks in batches to avoid overwhelming the system
    const batches = createBatches(unloadedVisibleChunks, maxConcurrentLoads);
    
    for (const batch of batches) {
      await Promise.all(batch.map(chunk => loadChunk(chunk)));
      
      setLoadingState(prev => ({
        ...prev,
        loadedChunks: prev.loadedChunks + batch.length
      }));

      // Render loaded chunks incrementally
      const currentlyLoaded = chunksToLoad
        .filter(chunk => chunk.isLoaded && chunk.isVisible)
        .flatMap(chunk => chunk.highlights);
      
      renderHighlights(currentlyLoaded);
    }

    setLoadingState(prev => ({
      ...prev,
      isLoading: false
    }));
  }, [maxConcurrentLoads, renderHighlights]);

  // Load individual chunk
  const loadChunk = useCallback(async (chunk: HighlightChunk): Promise<void> => {
    return new Promise((resolve) => {
      // Simulate processing time for complex highlights
      const processingTime = Math.min(chunk.highlights.length * 2, 100);
      
      setTimeout(() => {
        // Mark chunk as loaded
        setChunks(prevChunks => 
          prevChunks.map(c => 
            c.id === chunk.id ? { ...c, isLoaded: true } : c
          )
        );
        resolve();
      }, processingTime);
    });
  }, []);

  // Handle canvas interactions
  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onHighlightClick) return;

    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    // Find clicked highlight
    const clickedHighlight = findHighlightAtPoint({ x, y }, visibleChunks);
    if (clickedHighlight) {
      onHighlightClick(clickedHighlight.id);
    }
  }, [onHighlightClick, visibleChunks]);

  const handleCanvasMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onHighlightHover) return;

    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    // Find hovered highlight
    const hoveredHighlight = findHighlightAtPoint({ x, y }, visibleChunks);
    onHighlightHover(hoveredHighlight?.id || null);
  }, [onHighlightHover, visibleChunks]);

  // Show loading indicator for heavy operations
  if (shouldUseLazyLoading && loadingState.isLoading) {
    return (
      <Box className={className} sx={{ position: 'relative', width: canvasWidth, height: canvasHeight }}>
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          role="img"
          aria-label={`Interactive highlight overlay with ${highlights.length} highlights`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none'
          }}
        />
        
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: 2,
            borderRadius: 1,
            boxShadow: 2
          }}
        >
          <CircularProgress size={24} />
          <Box>
            Loading highlights... {loadingState.loadedChunks}/{loadingState.totalChunks}
          </Box>
        </Box>
      </Box>
    );
  }

  // Show error state
  if (loadingState.error) {
    return (
      <Box className={className} sx={{ position: 'relative', width: canvasWidth, height: canvasHeight }}>
        <Alert severity="error" sx={{ position: 'absolute', top: 16, left: 16, right: 16 }}>
          {loadingState.error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box className={className} sx={{ position: 'relative' }}>
      {/* Main rendering canvas */}
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        role="img"
        aria-label={`Interactive highlight overlay with ${highlights.length} highlights`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none'
        }}
      />
      
      {/* Interaction canvas */}
      <canvas
        ref={interactionCanvasRef}
        width={canvasWidth}
        height={canvasHeight}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMouseMove}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          cursor: onHighlightClick ? 'pointer' : 'default',
          backgroundColor: 'transparent'
        }}
      />

      {/* Performance metrics in development */}
      {process.env.NODE_ENV === 'development' && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: 1,
            borderRadius: 1,
            fontSize: '0.75rem',
            fontFamily: 'monospace'
          }}
        >
          {(() => {
            const metrics = rendererRef.current.getMetrics();
            return (
              <>
                <div>Highlights: {metrics.highlightsRendered}/{highlights.length}</div>
                <div>Culled: {metrics.highlightsCulled}</div>
                <div>FPS: {metrics.frameRate}</div>
                <div>Render: {metrics.renderTime.toFixed(1)}ms</div>
                <div>Cache: {metrics.memoryUsage}</div>
              </>
            );
          })()}
        </Box>
      )}
    </Box>
  );
});

LazyHighlightOverlay.displayName = 'LazyHighlightOverlay';

// Helper functions

function createHighlightChunks(
  highlights: ComponentHighlight[],
  chunkSize: number,
  canvasWidth: number,
  canvasHeight: number,
  originalViewport: { width: number; height: number }
): HighlightChunk[] {
  const chunks: HighlightChunk[] = [];
  
  // Spatial partitioning: divide canvas into grid
  const gridSize = Math.ceil(Math.sqrt(highlights.length / chunkSize));
  const cellWidth = canvasWidth / gridSize;
  const cellHeight = canvasHeight / gridSize;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const bounds = {
        left: col * cellWidth,
        top: row * cellHeight,
        right: (col + 1) * cellWidth,
        bottom: (row + 1) * cellHeight
      };

      const cellHighlights = highlights.filter(highlight => 
        isHighlightInBounds(highlight, bounds, originalViewport, canvasWidth, canvasHeight)
      );

      if (cellHighlights.length > 0) {
        chunks.push({
          id: `chunk-${row}-${col}`,
          highlights: cellHighlights,
          bounds,
          isLoaded: false,
          isVisible: false,
          priority: 0
        });
      }
    }
  }

  return chunks;
}

function updateVisibleChunks(
  chunks: HighlightChunk[],
  viewportState: ViewportState,
  canvasWidth: number,
  canvasHeight: number
): HighlightChunk[] {
  const viewportBounds = {
    left: -viewportState.panX,
    top: -viewportState.panY,
    right: -viewportState.panX + canvasWidth / viewportState.zoom,
    bottom: -viewportState.panY + canvasHeight / viewportState.zoom
  };

  return chunks.map(chunk => {
    const isVisible = boundsIntersect(chunk.bounds, viewportBounds);
    const priority = isVisible ? calculateChunkPriority(chunk, viewportBounds) : 0;

    return {
      ...chunk,
      isVisible,
      priority
    };
  });
}

function isHighlightInBounds(
  highlight: ComponentHighlight,
  bounds: { left: number; top: number; right: number; bottom: number },
  originalViewport: { width: number; height: number },
  canvasWidth: number,
  canvasHeight: number
): boolean {
  const x = highlight.coordinates.x * canvasWidth;
  const y = highlight.coordinates.y * canvasHeight;
  const width = (highlight.coordinates.width || 0.1) * canvasWidth;
  const height = (highlight.coordinates.height || 0.05) * canvasHeight;

  return !(
    x + width < bounds.left ||
    x > bounds.right ||
    y + height < bounds.top ||
    y > bounds.bottom
  );
}

function boundsIntersect(
  bounds1: { left: number; top: number; right: number; bottom: number },
  bounds2: { left: number; top: number; right: number; bottom: number }
): boolean {
  return !(
    bounds1.right < bounds2.left ||
    bounds1.left > bounds2.right ||
    bounds1.bottom < bounds2.top ||
    bounds1.top > bounds2.bottom
  );
}

function calculateChunkPriority(
  chunk: HighlightChunk,
  viewportBounds: { left: number; top: number; right: number; bottom: number }
): number {
  const chunkCenter = {
    x: (chunk.bounds.left + chunk.bounds.right) / 2,
    y: (chunk.bounds.top + chunk.bounds.bottom) / 2
  };

  const viewportCenter = {
    x: (viewportBounds.left + viewportBounds.right) / 2,
    y: (viewportBounds.top + viewportBounds.bottom) / 2
  };

  // Distance from viewport center (closer = higher priority)
  const distance = Math.sqrt(
    Math.pow(chunkCenter.x - viewportCenter.x, 2) +
    Math.pow(chunkCenter.y - viewportCenter.y, 2)
  );

  // Normalize and invert (closer = higher priority)
  return Math.max(0, 1000 - distance);
}

function createBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

function findHighlightAtPoint(
  point: Point,
  chunks: HighlightChunk[]
): ComponentHighlight | null {
  for (const chunk of chunks) {
    if (!chunk.isLoaded || !chunk.isVisible) continue;

    for (const highlight of chunk.highlights) {
      if (isPointInHighlight(point, highlight)) {
        return highlight;
      }
    }
  }
  return null;
}

function isPointInHighlight(point: Point, highlight: ComponentHighlight): boolean {
  const coords = highlight.coordinates;
  const width = coords.width || 0.1;
  const height = coords.height || 0.05;

  return point.x >= coords.x &&
         point.x <= coords.x + width &&
         point.y >= coords.y &&
         point.y <= coords.y + height;
}