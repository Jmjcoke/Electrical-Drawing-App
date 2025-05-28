// Custom hook for Fabric.js canvas management with AI overlay support

import { useRef, useEffect, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { 
  FabricCanvasConfig, 
  CanvasEventHandlers, 
  CanvasState,
  ComponentOverlay,
  CanvasPerformanceMetrics,
  ZoomConfig,
  PanConfig
} from '@/types/canvas/fabricTypes';
import { ComponentDetection } from '@/types/ai/computerVision';

interface UseFabricCanvasProps extends FabricCanvasConfig {
  eventHandlers?: CanvasEventHandlers;
  performanceMode?: boolean;
}

interface UseFabricCanvasReturn {
  fabricCanvas: fabric.Canvas | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  canvasState: CanvasState;
  
  // Canvas operations
  addComponentOverlay: (detection: ComponentDetection) => ComponentOverlay;
  removeComponentOverlay: (componentId: string) => void;
  updateComponentOverlay: (componentId: string, updates: Partial<ComponentDetection>) => void;
  clearAllOverlays: () => void;
  
  // Viewport controls
  zoomTo: (zoom: number, center?: { x: number; y: number }) => void;
  panTo: (offset: { x: number; y: number }) => void;
  fitToCanvas: () => void;
  resetView: () => void;
  
  // Selection management
  selectComponent: (componentId: string) => void;
  selectComponents: (componentIds: string[]) => void;
  clearSelection: () => void;
  
  // Performance monitoring
  getPerformanceMetrics: () => CanvasPerformanceMetrics;
  optimizeRendering: () => void;
}

export const useFabricCanvas = ({
  width,
  height,
  enableSelection = true,
  enableZoom = true,
  backgroundColor = '#ffffff',
  preserveObjectStacking = true,
  eventHandlers,
  performanceMode = false
}: UseFabricCanvasProps): UseFabricCanvasReturn => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const overlayObjectsRef = useRef<Map<string, ComponentOverlay>>(new Map());
  const performanceMetricsRef = useRef<CanvasPerformanceMetrics>({
    renderTime: 0,
    objectCount: 0,
    memoryUsage: 0,
    fps: 0,
    lastUpdate: new Date()
  });
  
  const [canvasState, setCanvasState] = useState<CanvasState>({
    zoom: 1,
    pan: { x: 0, y: 0 },
    selection: [],
    visibleComponents: [],
    overlayObjects: new Map(),
    isLoading: false,
    isDirty: false
  });

  // Initialize Fabric.js canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor,
      preserveObjectStacking,
      selection: enableSelection,
      defaultCursor: 'default',
      hoverCursor: 'pointer',
      moveCursor: 'move',
      renderOnAddRemove: !performanceMode, // Disable auto-render in performance mode
      skipTargetFind: false,
      perPixelTargetFind: true
    });

    // Configure zoom behavior
    if (enableZoom) {
      canvas.on('mouse:wheel', (opt) => {
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        
        // Limit zoom range
        zoom = Math.max(0.1, Math.min(10, zoom));
        
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        
        setCanvasState(prev => ({ ...prev, zoom, isDirty: true }));
        eventHandlers?.onZoomChange?.(zoom);
        
        opt.e.preventDefault();
        opt.e.stopPropagation();
      });
    }

    // Configure pan behavior
    canvas.on('mouse:down', (opt) => {
      const evt = opt.e;
      if (evt.altKey || evt.button === 1) { // Alt key or middle mouse button
        canvas.isDragging = true;
        canvas.selection = false;
        canvas.lastPosX = evt.clientX;
        canvas.lastPosY = evt.clientY;
      }
    });

    canvas.on('mouse:move', (opt) => {
      if (canvas.isDragging) {
        const e = opt.e;
        const vpt = canvas.viewportTransform!;
        vpt[4] += e.clientX - canvas.lastPosX;
        vpt[5] += e.clientY - canvas.lastPosY;
        canvas.requestRenderAll();
        canvas.lastPosX = e.clientX;
        canvas.lastPosY = e.clientY;
        
        setCanvasState(prev => ({ 
          ...prev, 
          pan: { x: vpt[4], y: vpt[5] },
          isDirty: true 
        }));
        eventHandlers?.onPanChange?.({ x: vpt[4], y: vpt[5] });
      }
    });

    canvas.on('mouse:up', () => {
      canvas.setViewportTransform(canvas.viewportTransform!);
      canvas.isDragging = false;
      canvas.selection = enableSelection;
    });

    // Component selection handling
    canvas.on('selection:created', (opt) => {
      const selectedObjects = opt.selected || [];
      const selectedComponents = selectedObjects
        .filter((obj): obj is ComponentOverlay => 'componentId' in obj)
        .map(overlay => overlay.detection);
      
      setCanvasState(prev => ({ ...prev, selection: selectedComponents }));
      eventHandlers?.onSelectionChange?.({
        objects: selectedObjects,
        components: selectedComponents,
        boundingBox: calculateSelectionBounds(selectedObjects)
      });
    });

    canvas.on('selection:updated', (opt) => {
      const selectedObjects = opt.selected || [];
      const selectedComponents = selectedObjects
        .filter((obj): obj is ComponentOverlay => 'componentId' in obj)
        .map(overlay => overlay.detection);
      
      setCanvasState(prev => ({ ...prev, selection: selectedComponents }));
      eventHandlers?.onSelectionChange?.({
        objects: selectedObjects,
        components: selectedComponents,
        boundingBox: calculateSelectionBounds(selectedObjects)
      });
    });

    canvas.on('selection:cleared', () => {
      setCanvasState(prev => ({ ...prev, selection: [] }));
      eventHandlers?.onSelectionChange?.({
        objects: [],
        components: [],
        boundingBox: { x: 0, y: 0, width: 0, height: 0 }
      });
    });

    // Object interaction events
    canvas.on('mouse:over', (opt) => {
      const target = opt.target;
      if (target && 'componentId' in target) {
        const overlay = target as ComponentOverlay;
        overlay.isHighlighted = true;
        overlay.set('stroke', '#3b82f6');
        overlay.set('strokeWidth', 2);
        canvas.requestRenderAll();
        eventHandlers?.onComponentHover?.(overlay.detection);
      }
    });

    canvas.on('mouse:out', (opt) => {
      const target = opt.target;
      if (target && 'componentId' in target) {
        const overlay = target as ComponentOverlay;
        overlay.isHighlighted = false;
        overlay.set('stroke', getConfidenceColor(overlay.confidence));
        overlay.set('strokeWidth', 1);
        canvas.requestRenderAll();
        eventHandlers?.onComponentHover?.(null);
      }
    });

    canvas.on('mouse:down', (opt) => {
      const target = opt.target;
      if (target && 'componentId' in target) {
        const overlay = target as ComponentOverlay;
        eventHandlers?.onComponentSelect?.(overlay.detection);
      } else if (!target) {
        const pointer = canvas.getPointer(opt.e);
        eventHandlers?.onCanvasClick?.(pointer);
      }
    });

    fabricCanvasRef.current = canvas;

    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [width, height, enableSelection, enableZoom, backgroundColor, performanceMode]);

  // Component overlay management
  const addComponentOverlay = useCallback((detection: ComponentDetection): ComponentOverlay => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) throw new Error('Canvas not initialized');

    const { boundingBox, confidence, type } = detection;
    const color = getConfidenceColor(confidence);
    
    // Create bounding box rectangle
    const rect = new fabric.Rect({
      left: boundingBox.x,
      top: boundingBox.y,
      width: boundingBox.width,
      height: boundingBox.height,
      fill: 'transparent',
      stroke: color,
      strokeWidth: 1,
      selectable: true,
      hoverCursor: 'pointer',
      moveCursor: 'pointer'
    });

    // Create label text
    const label = new fabric.Text(`${type} (${Math.round(confidence * 100)}%)`, {
      left: boundingBox.x,
      top: boundingBox.y - 20,
      fontSize: 12,
      fontFamily: 'Arial',
      fill: color,
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      selectable: false
    });

    // Create component overlay group
    const overlay = new fabric.Group([rect, label], {
      selectable: true,
      hoverCursor: 'pointer',
      moveCursor: 'pointer'
    }) as ComponentOverlay;

    // Add custom properties
    overlay.componentId = detection.id;
    overlay.detection = detection;
    overlay.confidence = confidence;
    overlay.isSelected = false;
    overlay.isHighlighted = false;

    canvas.add(overlay);
    overlayObjectsRef.current.set(detection.id, overlay);
    
    setCanvasState(prev => ({
      ...prev,
      overlayObjects: new Map(overlayObjectsRef.current),
      isDirty: true
    }));

    if (!performanceMode) {
      canvas.requestRenderAll();
    }

    return overlay;
  }, [performanceMode]);

  const removeComponentOverlay = useCallback((componentId: string) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const overlay = overlayObjectsRef.current.get(componentId);
    if (overlay) {
      canvas.remove(overlay);
      overlayObjectsRef.current.delete(componentId);
      
      setCanvasState(prev => ({
        ...prev,
        overlayObjects: new Map(overlayObjectsRef.current),
        isDirty: true
      }));

      if (!performanceMode) {
        canvas.requestRenderAll();
      }
    }
  }, [performanceMode]);

  const updateComponentOverlay = useCallback((componentId: string, updates: Partial<ComponentDetection>) => {
    const overlay = overlayObjectsRef.current.get(componentId);
    if (!overlay) return;

    // Update detection data
    overlay.detection = { ...overlay.detection, ...updates };
    
    // Update visual properties if confidence changed
    if (updates.confidence !== undefined) {
      overlay.confidence = updates.confidence;
      const color = getConfidenceColor(updates.confidence);
      const rect = overlay.getObjects()[0] as fabric.Rect;
      const label = overlay.getObjects()[1] as fabric.Text;
      
      rect.set('stroke', color);
      label.set('fill', color);
      label.set('text', `${overlay.detection.type} (${Math.round(updates.confidence * 100)}%)`);
    }

    if (!performanceMode) {
      fabricCanvasRef.current?.requestRenderAll();
    }
  }, [performanceMode]);

  const clearAllOverlays = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    overlayObjectsRef.current.forEach(overlay => {
      canvas.remove(overlay);
    });
    
    overlayObjectsRef.current.clear();
    
    setCanvasState(prev => ({
      ...prev,
      overlayObjects: new Map(),
      selection: [],
      isDirty: true
    }));

    if (!performanceMode) {
      canvas.requestRenderAll();
    }
  }, [performanceMode]);

  // Viewport controls
  const zoomTo = useCallback((zoom: number, center?: { x: number; y: number }) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const point = center || { x: canvas.width! / 2, y: canvas.height! / 2 };
    canvas.zoomToPoint(point, Math.max(0.1, Math.min(10, zoom)));
    
    setCanvasState(prev => ({ ...prev, zoom, isDirty: true }));
    eventHandlers?.onZoomChange?.(zoom);
  }, [eventHandlers]);

  const panTo = useCallback((offset: { x: number; y: number }) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const vpt = canvas.viewportTransform!;
    vpt[4] = offset.x;
    vpt[5] = offset.y;
    canvas.setViewportTransform(vpt);
    
    setCanvasState(prev => ({ ...prev, pan: offset, isDirty: true }));
    eventHandlers?.onPanChange?.(offset);
  }, [eventHandlers]);

  const fitToCanvas = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const objects = canvas.getObjects();
    if (objects.length === 0) return;

    const group = new fabric.Group(objects);
    const boundingRect = group.getBoundingRect();
    
    const scaleX = (canvas.width! * 0.9) / boundingRect.width;
    const scaleY = (canvas.height! * 0.9) / boundingRect.height;
    const scale = Math.min(scaleX, scaleY);
    
    const centerX = canvas.width! / 2;
    const centerY = canvas.height! / 2;
    const offsetX = centerX - (boundingRect.left + boundingRect.width / 2) * scale;
    const offsetY = centerY - (boundingRect.top + boundingRect.height / 2) * scale;
    
    canvas.setZoom(scale);
    canvas.absolutePan({ x: -offsetX, y: -offsetY });
    
    setCanvasState(prev => ({ 
      ...prev, 
      zoom: scale, 
      pan: { x: -offsetX, y: -offsetY },
      isDirty: true 
    }));
  }, []);

  const resetView = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    canvas.setZoom(1);
    canvas.absolutePan({ x: 0, y: 0 });
    
    setCanvasState(prev => ({ 
      ...prev, 
      zoom: 1, 
      pan: { x: 0, y: 0 },
      isDirty: true 
    }));
  }, []);

  // Selection management
  const selectComponent = useCallback((componentId: string) => {
    const canvas = fabricCanvasRef.current;
    const overlay = overlayObjectsRef.current.get(componentId);
    
    if (canvas && overlay) {
      canvas.setActiveObject(overlay);
      canvas.requestRenderAll();
    }
  }, []);

  const selectComponents = useCallback((componentIds: string[]) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const overlays = componentIds
      .map(id => overlayObjectsRef.current.get(id))
      .filter(overlay => overlay !== undefined) as ComponentOverlay[];
    
    if (overlays.length > 0) {
      const selection = new fabric.ActiveSelection(overlays, { canvas });
      canvas.setActiveObject(selection);
      canvas.requestRenderAll();
    }
  }, []);

  const clearSelection = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (canvas) {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
  }, []);

  // Performance monitoring
  const getPerformanceMetrics = useCallback((): CanvasPerformanceMetrics => {
    const canvas = fabricCanvasRef.current;
    return {
      ...performanceMetricsRef.current,
      objectCount: canvas?.getObjects().length || 0,
      lastUpdate: new Date()
    };
  }, []);

  const optimizeRendering = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Disable auto-rendering during bulk operations
    canvas.renderOnAddRemove = false;
    
    // Re-enable and render once
    setTimeout(() => {
      canvas.renderOnAddRemove = true;
      canvas.requestRenderAll();
    }, 0);
  }, []);

  return {
    fabricCanvas: fabricCanvasRef.current,
    canvasRef,
    canvasState,
    
    // Canvas operations
    addComponentOverlay,
    removeComponentOverlay,
    updateComponentOverlay,
    clearAllOverlays,
    
    // Viewport controls
    zoomTo,
    panTo,
    fitToCanvas,
    resetView,
    
    // Selection management
    selectComponent,
    selectComponents,
    clearSelection,
    
    // Performance monitoring
    getPerformanceMetrics,
    optimizeRendering
  };
};

// Helper functions
const getConfidenceColor = (confidence: number): string => {
  if (confidence > 0.85) return '#10b981'; // Green for high confidence
  if (confidence >= 0.70) return '#f59e0b'; // Yellow for medium confidence
  return '#ef4444'; // Red for low confidence
};

const calculateSelectionBounds = (objects: fabric.Object[]) => {
  if (objects.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  objects.forEach(obj => {
    const bounds = obj.getBoundingRect();
    minX = Math.min(minX, bounds.left);
    minY = Math.min(minY, bounds.top);
    maxX = Math.max(maxX, bounds.left + bounds.width);
    maxY = Math.max(maxY, bounds.top + bounds.height);
  });
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
};