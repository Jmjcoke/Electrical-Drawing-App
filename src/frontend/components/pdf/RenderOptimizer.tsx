import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { Point, BoundingBox } from '../../types/electrical';
import { ViewportState, RenderSettings, RenderLayer, VisibilityBounds } from '../../types/rendering';

interface RenderOptimizerProps {
  canvas: HTMLCanvasElement | null;
  viewport: ViewportState;
  documentBounds: BoundingBox;
  layers: RenderLayer[];
  settings: RenderSettings;
  onSettingsChange: (settings: Partial<RenderSettings>) => void;
  onPerformanceUpdate: (metrics: PerformanceMetrics) => void;
}

interface RenderTile {
  id: string;
  bounds: BoundingBox;
  canvas: HTMLCanvasElement;
  lastRendered: number;
  isDirty: boolean;
  priority: number;
  memoryUsage: number;
}

interface RenderQueue {
  high: RenderTile[];
  medium: RenderTile[];
  low: RenderTile[];
}

interface PerformanceMetrics {
  frameRate: number;
  renderTime: number;
  tilesRendered: number;
  memoryUsage: number;
  culledObjects: number;
  visibleObjects: number;
}

export const RenderOptimizer: React.FC<RenderOptimizerProps> = ({
  canvas,
  viewport,
  documentBounds,
  layers,
  settings,
  onSettingsChange,
  onPerformanceUpdate
}) => {
  const [renderTiles, setRenderTiles] = useState<Map<string, RenderTile>>(new Map());
  const [renderQueue, setRenderQueue] = useState<RenderQueue>({ high: [], medium: [], low: [] });
  const [isRendering, setIsRendering] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    frameRate: 60,
    renderTime: 0,
    tilesRendered: 0,
    memoryUsage: 0,
    culledObjects: 0,
    visibleObjects: 0
  });

  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const frameTimesRef = useRef<number[]>([]);
  const renderWorkerRef = useRef<Worker | null>(null);

  // Calculate optimal tile size based on viewport and performance settings
  const tileSize = useMemo(() => {
    const baseSize = settings.enableTileRendering ? 512 : 1024;
    const scaleFactor = Math.max(0.5, Math.min(2, viewport.scale));
    return Math.floor(baseSize * scaleFactor);
  }, [settings.enableTileRendering, viewport.scale]);

  // Generate tiles for the document
  const generateTiles = useCallback((): Map<string, RenderTile> => {
    const tiles = new Map<string, RenderTile>();
    
    if (!settings.enableTileRendering) {
      // Single tile for entire document
      const tileId = 'full_document';
      const tileCanvas = document.createElement('canvas');
      tileCanvas.width = documentBounds.width;
      tileCanvas.height = documentBounds.height;
      
      tiles.set(tileId, {
        id: tileId,
        bounds: documentBounds,
        canvas: tileCanvas,
        lastRendered: 0,
        isDirty: true,
        priority: 1,
        memoryUsage: tileCanvas.width * tileCanvas.height * 4 // RGBA
      });
      
      return tiles;
    }

    const tilesX = Math.ceil(documentBounds.width / tileSize);
    const tilesY = Math.ceil(documentBounds.height / tileSize);

    for (let y = 0; y < tilesY; y++) {
      for (let x = 0; x < tilesX; x++) {
        const tileId = `tile_${x}_${y}`;
        const bounds: BoundingBox = {
          x: documentBounds.x + x * tileSize,
          y: documentBounds.y + y * tileSize,
          width: Math.min(tileSize, documentBounds.width - x * tileSize),
          height: Math.min(tileSize, documentBounds.height - y * tileSize)
        };

        const tileCanvas = document.createElement('canvas');
        tileCanvas.width = bounds.width;
        tileCanvas.height = bounds.height;

        tiles.set(tileId, {
          id: tileId,
          bounds,
          canvas: tileCanvas,
          lastRendered: 0,
          isDirty: true,
          priority: 0,
          memoryUsage: bounds.width * bounds.height * 4
        });
      }
    }

    return tiles;
  }, [documentBounds, tileSize, settings.enableTileRendering]);

  // Calculate visibility bounds for viewport culling
  const calculateVisibilityBounds = useCallback((): VisibilityBounds => {
    const padding = settings.cullingPadding || 100;
    
    return {
      left: -viewport.offsetX / viewport.scale - padding,
      top: -viewport.offsetY / viewport.scale - padding,
      right: (-viewport.offsetX + (canvas?.width || 0)) / viewport.scale + padding,
      bottom: (-viewport.offsetY + (canvas?.height || 0)) / viewport.scale + padding
    };
  }, [viewport, canvas, settings.cullingPadding]);

  // Check if a bounding box is visible in the current viewport
  const isVisible = useCallback((bounds: BoundingBox, visibilityBounds: VisibilityBounds): boolean => {
    return !(
      bounds.x + bounds.width < visibilityBounds.left ||
      bounds.x > visibilityBounds.right ||
      bounds.y + bounds.height < visibilityBounds.top ||
      bounds.y > visibilityBounds.bottom
    );
  }, []);

  // Calculate tile priority based on distance from viewport center
  const calculateTilePriority = useCallback((tile: RenderTile): number => {
    const visibilityBounds = calculateVisibilityBounds();
    const viewportCenterX = (visibilityBounds.left + visibilityBounds.right) / 2;
    const viewportCenterY = (visibilityBounds.top + visibilityBounds.bottom) / 2;
    
    const tileCenterX = tile.bounds.x + tile.bounds.width / 2;
    const tileCenterY = tile.bounds.y + tile.bounds.height / 2;
    
    const distance = Math.sqrt(
      Math.pow(tileCenterX - viewportCenterX, 2) + 
      Math.pow(tileCenterY - viewportCenterY, 2)
    );

    // Higher priority for closer tiles
    const maxDistance = Math.sqrt(
      Math.pow(documentBounds.width, 2) + Math.pow(documentBounds.height, 2)
    );
    return Math.max(0, 1 - distance / maxDistance);
  }, [calculateVisibilityBounds, documentBounds]);

  // Update render queue based on visibility and priority
  const updateRenderQueue = useCallback(() => {
    const visibilityBounds = calculateVisibilityBounds();
    const queue: RenderQueue = { high: [], medium: [], low: [] };

    renderTiles.forEach(tile => {
      if (isVisible(tile.bounds, visibilityBounds)) {
        const priority = calculateTilePriority(tile);
        tile.priority = priority;

        if (tile.isDirty || tile.lastRendered < Date.now() - settings.tileRefreshInterval) {
          if (priority > 0.7) {
            queue.high.push(tile);
          } else if (priority > 0.3) {
            queue.medium.push(tile);
          } else {
            queue.low.push(tile);
          }
        }
      }
    });

    // Sort by priority within each queue
    queue.high.sort((a, b) => b.priority - a.priority);
    queue.medium.sort((a, b) => b.priority - a.priority);
    queue.low.sort((a, b) => b.priority - a.priority);

    setRenderQueue(queue);
  }, [renderTiles, calculateVisibilityBounds, isVisible, calculateTilePriority, settings.tileRefreshInterval]);

  // Render a single tile
  const renderTile = useCallback(async (tile: RenderTile): Promise<void> => {
    const ctx = tile.canvas.getContext('2d');
    if (!ctx) return;

    const startTime = performance.now();

    // Clear tile
    ctx.clearRect(0, 0, tile.canvas.width, tile.canvas.height);
    ctx.save();

    // Set up coordinate system for tile
    ctx.translate(-tile.bounds.x, -tile.bounds.y);

    // Render layers in order
    for (const layer of layers) {
      if (!layer.isVisible) continue;

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode || 'source-over';

      // Apply layer-specific culling
      const layerObjects = layer.objects.filter(obj => {
        if (!obj.bounds) return true;
        return isVisible(obj.bounds, {
          left: tile.bounds.x,
          top: tile.bounds.y,
          right: tile.bounds.x + tile.bounds.width,
          bottom: tile.bounds.y + tile.bounds.height
        });
      });

      // Render objects with level-of-detail optimization
      for (const obj of layerObjects) {
        const lodLevel = calculateLOD(obj, viewport.scale);
        renderObject(ctx, obj, lodLevel, settings);
      }

      ctx.restore();
    }

    ctx.restore();

    // Update tile metadata
    tile.lastRendered = Date.now();
    tile.isDirty = false;

    const renderTime = performance.now() - startTime;
    
    // Update performance metrics
    setPerformanceMetrics(prev => ({
      ...prev,
      renderTime: renderTime,
      tilesRendered: prev.tilesRendered + 1
    }));
  }, [layers, isVisible, viewport.scale, settings]);

  // Calculate level of detail based on object size and zoom level
  const calculateLOD = useCallback((obj: any, scale: number): number => {
    if (!settings.enableLOD) return 0;

    const objectSize = obj.bounds ? 
      Math.max(obj.bounds.width, obj.bounds.height) * scale : 100;

    if (objectSize < 5) return 3; // Very low detail
    if (objectSize < 20) return 2; // Low detail
    if (objectSize < 100) return 1; // Medium detail
    return 0; // Full detail
  }, [settings.enableLOD]);

  // Render an object with appropriate level of detail
  const renderObject = useCallback((
    ctx: CanvasRenderingContext2D, 
    obj: any, 
    lodLevel: number, 
    settings: RenderSettings
  ) => {
    if (!obj.bounds) return;

    ctx.save();

    switch (lodLevel) {
      case 3: // Very low detail - just a colored rectangle
        ctx.fillStyle = obj.color || '#CCCCCC';
        ctx.fillRect(obj.bounds.x, obj.bounds.y, obj.bounds.width, obj.bounds.height);
        break;

      case 2: // Low detail - simplified shape
        ctx.strokeStyle = obj.color || '#000000';
        ctx.lineWidth = Math.max(1, 3 / viewport.scale);
        ctx.strokeRect(obj.bounds.x, obj.bounds.y, obj.bounds.width, obj.bounds.height);
        break;

      case 1: // Medium detail - basic features
        if (obj.render) {
          obj.render(ctx, { simplified: true });
        } else {
          ctx.fillStyle = obj.color || '#CCCCCC';
          ctx.fillRect(obj.bounds.x, obj.bounds.y, obj.bounds.width, obj.bounds.height);
        }
        break;

      case 0: // Full detail
      default:
        if (obj.render) {
          obj.render(ctx, { simplified: false });
        } else {
          ctx.fillStyle = obj.color || '#CCCCCC';
          ctx.fillRect(obj.bounds.x, obj.bounds.y, obj.bounds.width, obj.bounds.height);
        }
        break;
    }

    ctx.restore();
  }, [viewport.scale]);

  // Process render queue with time slicing
  const processRenderQueue = useCallback(async (timeSlice: number = 16) => {
    if (isRendering) return;

    setIsRendering(true);
    const startTime = performance.now();
    let tilesProcessed = 0;

    try {
      // Process high priority tiles first
      while (renderQueue.high.length > 0 && performance.now() - startTime < timeSlice) {
        const tile = renderQueue.high.shift()!;
        await renderTile(tile);
        tilesProcessed++;
      }

      // Process medium priority tiles if time remaining
      while (renderQueue.medium.length > 0 && performance.now() - startTime < timeSlice * 0.7) {
        const tile = renderQueue.medium.shift()!;
        await renderTile(tile);
        tilesProcessed++;
      }

      // Process low priority tiles if time remaining
      while (renderQueue.low.length > 0 && performance.now() - startTime < timeSlice * 0.5) {
        const tile = renderQueue.low.shift()!;
        await renderTile(tile);
        tilesProcessed++;
      }

    } finally {
      setIsRendering(false);
    }

    return tilesProcessed;
  }, [isRendering, renderQueue, renderTile]);

  // Composite tiles onto main canvas
  const compositeTiles = useCallback(() => {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const startTime = performance.now();
    const visibilityBounds = calculateVisibilityBounds();
    let tilesComposited = 0;

    ctx.save();
    ctx.scale(viewport.scale, viewport.scale);
    ctx.translate(viewport.offsetX, viewport.offsetY);

    // Clear canvas
    ctx.clearRect(
      visibilityBounds.left,
      visibilityBounds.top,
      visibilityBounds.right - visibilityBounds.left,
      visibilityBounds.bottom - visibilityBounds.top
    );

    // Composite visible tiles
    renderTiles.forEach(tile => {
      if (isVisible(tile.bounds, visibilityBounds) && !tile.isDirty) {
        ctx.drawImage(
          tile.canvas,
          tile.bounds.x,
          tile.bounds.y,
          tile.bounds.width,
          tile.bounds.height
        );
        tilesComposited++;
      }
    });

    ctx.restore();

    // Update performance metrics
    const compositeTime = performance.now() - startTime;
    setPerformanceMetrics(prev => ({
      ...prev,
      tilesRendered: tilesComposited
    }));
  }, [canvas, viewport, calculateVisibilityBounds, renderTiles, isVisible]);

  // Main render loop
  const renderLoop = useCallback(() => {
    const currentTime = performance.now();
    const deltaTime = currentTime - lastFrameTimeRef.current;
    
    // Calculate frame rate
    frameTimesRef.current.push(deltaTime);
    if (frameTimesRef.current.length > 60) {
      frameTimesRef.current.shift();
    }
    
    const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
    const frameRate = 1000 / avgFrameTime;

    // Update render queue
    updateRenderQueue();

    // Process render queue
    processRenderQueue().then(() => {
      // Composite tiles
      compositeTiles();

      // Update performance metrics
      const memoryUsage = Array.from(renderTiles.values())
        .reduce((total, tile) => total + tile.memoryUsage, 0);

      const visibilityBounds = calculateVisibilityBounds();
      const visibleObjects = layers.reduce((count, layer) => {
        return count + layer.objects.filter(obj => 
          obj.bounds && isVisible(obj.bounds, visibilityBounds)
        ).length;
      }, 0);

      const totalObjects = layers.reduce((count, layer) => count + layer.objects.length, 0);

      setPerformanceMetrics(prev => ({
        ...prev,
        frameRate,
        memoryUsage,
        visibleObjects,
        culledObjects: totalObjects - visibleObjects
      }));

      onPerformanceUpdate({
        frameRate,
        renderTime: performance.now() - currentTime,
        tilesRendered: renderTiles.size,
        memoryUsage,
        visibleObjects,
        culledObjects: totalObjects - visibleObjects
      });
    });

    lastFrameTimeRef.current = currentTime;

    if (settings.enableContinuousRendering || renderQueue.high.length > 0 || renderQueue.medium.length > 0) {
      animationFrameRef.current = requestAnimationFrame(renderLoop);
    }
  }, [
    updateRenderQueue,
    processRenderQueue,
    compositeTiles,
    renderTiles,
    layers,
    calculateVisibilityBounds,
    isVisible,
    renderQueue,
    settings.enableContinuousRendering,
    onPerformanceUpdate
  ]);

  // Initialize tiles when dependencies change
  useEffect(() => {
    const tiles = generateTiles();
    setRenderTiles(tiles);
  }, [generateTiles]);

  // Start render loop when viewport changes
  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [renderLoop]);

  // Mark tiles as dirty when layers change
  useEffect(() => {
    setRenderTiles(prev => {
      const updated = new Map(prev);
      updated.forEach(tile => {
        tile.isDirty = true;
      });
      return updated;
    });
  }, [layers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Clean up worker
      if (renderWorkerRef.current) {
        renderWorkerRef.current.terminate();
      }
    };
  }, []);

  // Memory cleanup for unused tiles
  const cleanupMemory = useCallback(() => {
    const visibilityBounds = calculateVisibilityBounds();
    const currentTime = Date.now();
    const maxAge = settings.tileMaxAge || 30000; // 30 seconds

    setRenderTiles(prev => {
      const updated = new Map(prev);
      
      updated.forEach((tile, id) => {
        const isCurrentlyVisible = isVisible(tile.bounds, visibilityBounds);
        const isOld = currentTime - tile.lastRendered > maxAge;
        
        if (!isCurrentlyVisible && isOld) {
          // Keep tile but mark as dirty to save memory
          tile.isDirty = true;
          
          // Clear canvas to free memory
          const ctx = tile.canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, tile.canvas.width, tile.canvas.height);
          }
        }
      });
      
      return updated;
    });
  }, [calculateVisibilityBounds, isVisible, settings.tileMaxAge]);

  // Run memory cleanup periodically
  useEffect(() => {
    const interval = setInterval(cleanupMemory, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [cleanupMemory]);

  return (
    <div className="render-optimizer">
      {/* Performance overlay */}
      {settings.showPerformanceOverlay && (
        <div className="performance-overlay">
          <div className="performance-stats">
            <div className="stat">FPS: {performanceMetrics.frameRate.toFixed(1)}</div>
            <div className="stat">Render: {performanceMetrics.renderTime.toFixed(1)}ms</div>
            <div className="stat">Tiles: {performanceMetrics.tilesRendered}</div>
            <div className="stat">Memory: {(performanceMetrics.memoryUsage / 1024 / 1024).toFixed(1)}MB</div>
            <div className="stat">Visible: {performanceMetrics.visibleObjects}</div>
            <div className="stat">Culled: {performanceMetrics.culledObjects}</div>
          </div>
        </div>
      )}

      {/* Render settings panel */}
      {settings.showSettingsPanel && (
        <div className="render-settings-panel">
          <h5>Render Settings</h5>
          <label>
            <input
              type="checkbox"
              checked={settings.enableTileRendering}
              onChange={(e) => onSettingsChange({ enableTileRendering: e.target.checked })}
            />
            Tile Rendering
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.enableLOD}
              onChange={(e) => onSettingsChange({ enableLOD: e.target.checked })}
            />
            Level of Detail
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.enableContinuousRendering}
              onChange={(e) => onSettingsChange({ enableContinuousRendering: e.target.checked })}
            />
            Continuous Rendering
          </label>
          <label>
            Culling Padding:
            <input
              type="range"
              min="0"
              max="500"
              value={settings.cullingPadding || 100}
              onChange={(e) => onSettingsChange({ cullingPadding: parseInt(e.target.value) })}
            />
          </label>
        </div>
      )}
    </div>
  );
};