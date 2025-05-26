import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Point, BoundingBox } from '../../types/electrical';
import { ViewportState, MinimapSettings } from '../../types/navigation';

interface MinimapNavigatorProps {
  documentImage: HTMLCanvasElement | ImageData;
  viewport: ViewportState;
  onViewportChange: (viewport: ViewportState) => void;
  documentBounds: BoundingBox;
  annotations?: any[];
  components?: any[];
  isVisible: boolean;
  onToggleVisibility: () => void;
  settings: MinimapSettings;
  onSettingsChange: (settings: Partial<MinimapSettings>) => void;
}

interface MinimapLayer {
  id: string;
  name: string;
  isVisible: boolean;
  color: string;
  opacity: number;
  renderFunction: (ctx: CanvasRenderingContext2D, scale: number) => void;
}

export const MinimapNavigator: React.FC<MinimapNavigatorProps> = ({
  documentImage,
  viewport,
  onViewportChange,
  documentBounds,
  annotations = [],
  components = [],
  isVisible,
  onToggleVisibility,
  settings,
  onSettingsChange
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [minimapScale, setMinimapScale] = useState(1);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [layers, setLayers] = useState<MinimapLayer[]>([]);

  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const minimapSize = { width: 300, height: 200 };

  // Calculate scale to fit document in minimap
  useEffect(() => {
    const scaleX = minimapSize.width / documentBounds.width;
    const scaleY = minimapSize.height / documentBounds.height;
    setMinimapScale(Math.min(scaleX, scaleY) * 0.9); // 0.9 for padding
  }, [documentBounds, minimapSize]);

  // Initialize minimap layers
  useEffect(() => {
    const defaultLayers: MinimapLayer[] = [
      {
        id: 'annotations',
        name: 'Annotations',
        isVisible: settings.showAnnotations,
        color: '#FF6B6B',
        opacity: 0.8,
        renderFunction: renderAnnotations
      },
      {
        id: 'components',
        name: 'Components',
        isVisible: settings.showComponents,
        color: '#4ECDC4',
        opacity: 0.7,
        renderFunction: renderComponents
      },
      {
        id: 'viewport',
        name: 'Viewport',
        isVisible: true,
        color: '#0099FF',
        opacity: 1.0,
        renderFunction: renderViewport
      }
    ];
    setLayers(defaultLayers);
  }, [settings, annotations, components]);

  const getMinimapPoint = useCallback((documentPoint: Point): Point => {
    return {
      x: (documentPoint.x - documentBounds.x) * minimapScale,
      y: (documentPoint.y - documentBounds.y) * minimapScale
    };
  }, [documentBounds, minimapScale]);

  const getDocumentPoint = useCallback((minimapPoint: Point): Point => {
    return {
      x: minimapPoint.x / minimapScale + documentBounds.x,
      y: minimapPoint.y / minimapScale + documentBounds.y
    };
  }, [documentBounds, minimapScale]);

  const renderDocument = useCallback(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw document background
    ctx.fillStyle = settings.backgroundColor || '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw document image if available
    if (documentImage) {
      ctx.save();
      ctx.scale(minimapScale, minimapScale);
      
      if (documentImage instanceof HTMLCanvasElement) {
        ctx.drawImage(documentImage, 0, 0);
      } else {
        // Handle ImageData
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = documentImage.width;
        tempCanvas.height = documentImage.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.putImageData(documentImage, 0, 0);
          ctx.drawImage(tempCanvas, 0, 0);
        }
      }
      
      ctx.restore();
    }

    // Draw document border
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 
      documentBounds.width * minimapScale, 
      documentBounds.height * minimapScale
    );
  }, [documentImage, minimapScale, documentBounds, settings]);

  const renderAnnotations = useCallback((ctx: CanvasRenderingContext2D, scale: number) => {
    annotations.forEach(annotation => {
      if (!annotation.boundingBox) return;

      const minimapBox = getMinimapPoint({
        x: annotation.boundingBox.x,
        y: annotation.boundingBox.y
      });

      ctx.fillStyle = '#FF6B6B';
      ctx.globalAlpha = 0.6;
      ctx.fillRect(
        minimapBox.x,
        minimapBox.y,
        annotation.boundingBox.width * scale,
        annotation.boundingBox.height * scale
      );
      ctx.globalAlpha = 1.0;

      // Add annotation indicator
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(minimapBox.x - 1, minimapBox.y - 1, 3, 3);
    });
  }, [annotations, getMinimapPoint]);

  const renderComponents = useCallback((ctx: CanvasRenderingContext2D, scale: number) => {
    components.forEach(component => {
      if (!component.boundingBox) return;

      const minimapPoint = getMinimapPoint(component.centerPoint);
      
      // Different shapes for different component types
      ctx.fillStyle = component.type === 'outlet' ? '#00FF00' : 
                     component.type === 'switch' ? '#FFFF00' :
                     component.type === 'light_fixture' ? '#FFA500' : '#4ECDC4';
      
      ctx.globalAlpha = 0.8;
      
      if (component.type === 'outlet') {
        ctx.fillRect(minimapPoint.x - 2, minimapPoint.y - 1, 4, 2);
      } else if (component.type === 'switch') {
        ctx.fillRect(minimapPoint.x - 1.5, minimapPoint.y - 1.5, 3, 3);
      } else {
        ctx.beginPath();
        ctx.arc(minimapPoint.x, minimapPoint.y, 2, 0, 2 * Math.PI);
        ctx.fill();
      }
      
      ctx.globalAlpha = 1.0;
    });
  }, [components, getMinimapPoint]);

  const renderViewport = useCallback((ctx: CanvasRenderingContext2D, scale: number) => {
    // Calculate visible viewport area in document coordinates
    const viewportWidth = minimapSize.width / viewport.scale;
    const viewportHeight = minimapSize.height / viewport.scale;
    
    const viewportInDoc = {
      x: -viewport.offsetX / viewport.scale,
      y: -viewport.offsetY / viewport.scale,
      width: viewportWidth,
      height: viewportHeight
    };

    const minimapViewport = {
      x: (viewportInDoc.x - documentBounds.x) * minimapScale,
      y: (viewportInDoc.y - documentBounds.y) * minimapScale,
      width: viewportInDoc.width * minimapScale,
      height: viewportInDoc.height * minimapScale
    };

    // Draw viewport rectangle
    ctx.strokeStyle = '#0099FF';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      minimapViewport.x,
      minimapViewport.y,
      minimapViewport.width,
      minimapViewport.height
    );

    // Fill with semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 153, 255, 0.1)';
    ctx.fillRect(
      minimapViewport.x,
      minimapViewport.y,
      minimapViewport.width,
      minimapViewport.height
    );

    // Draw corner handles for resizing
    const handleSize = 6;
    ctx.fillStyle = '#0099FF';
    
    // Top-left handle
    ctx.fillRect(
      minimapViewport.x - handleSize / 2,
      minimapViewport.y - handleSize / 2,
      handleSize,
      handleSize
    );
    
    // Bottom-right handle
    ctx.fillRect(
      minimapViewport.x + minimapViewport.width - handleSize / 2,
      minimapViewport.y + minimapViewport.height - handleSize / 2,
      handleSize,
      handleSize
    );
  }, [viewport, documentBounds, minimapScale, minimapSize]);

  const renderOverlays = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render each visible layer
    layers.forEach(layer => {
      if (layer.isVisible) {
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        layer.renderFunction(ctx, minimapScale);
        ctx.restore();
      }
    });
  }, [layers, minimapScale]);

  // Re-render when dependencies change
  useEffect(() => {
    renderDocument();
  }, [renderDocument]);

  useEffect(() => {
    renderOverlays();
  }, [renderOverlays]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    setIsDragging(true);
    setDragStart(clickPoint);

    // Convert to document coordinates and center viewport on click point
    const docPoint = getDocumentPoint(clickPoint);
    const newViewport = {
      ...viewport,
      offsetX: -(docPoint.x - documentBounds.x) * viewport.scale + minimapSize.width / 2,
      offsetY: -(docPoint.y - documentBounds.y) * viewport.scale + minimapSize.height / 2
    };

    onViewportChange(newViewport);
  }, [viewport, getDocumentPoint, documentBounds, onViewportChange]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const currentPoint = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };

    if (isDragging) {
      const deltaX = currentPoint.x - dragStart.x;
      const deltaY = currentPoint.y - dragStart.y;

      const newViewport = {
        ...viewport,
        offsetX: viewport.offsetX + deltaX * viewport.scale,
        offsetY: viewport.offsetY + deltaY * viewport.scale
      };

      onViewportChange(newViewport);
      setDragStart(currentPoint);
    } else {
      // Check for hover over elements
      const docPoint = getDocumentPoint(currentPoint);
      
      // Check components
      const hoveredComponent = components.find(comp => {
        const distance = Math.sqrt(
          Math.pow(comp.centerPoint.x - docPoint.x, 2) +
          Math.pow(comp.centerPoint.y - docPoint.y, 2)
        );
        return distance < 10; // 10 pixel tolerance
      });

      setHoveredElement(hoveredComponent ? `component-${hoveredComponent.id}` : null);
    }
  }, [isDragging, dragStart, viewport, onViewportChange, getDocumentPoint, components]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, viewport.scale * zoomFactor));
    
    onViewportChange({
      ...viewport,
      scale: newScale
    });
  }, [viewport, onViewportChange]);

  const zoomToFit = useCallback(() => {
    const scaleX = minimapSize.width / documentBounds.width;
    const scaleY = minimapSize.height / documentBounds.height;
    const fitScale = Math.min(scaleX, scaleY) * 0.8;

    onViewportChange({
      scale: fitScale,
      offsetX: (minimapSize.width - documentBounds.width * fitScale) / 2,
      offsetY: (minimapSize.height - documentBounds.height * fitScale) / 2,
      rotation: 0
    });
  }, [documentBounds, onViewportChange]);

  const toggleLayer = useCallback((layerId: string) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId 
        ? { ...layer, isVisible: !layer.isVisible }
        : layer
    ));
  }, []);

  if (!isVisible) {
    return (
      <button 
        onClick={onToggleVisibility}
        className="minimap-toggle collapsed"
        title="Show minimap"
      >
        🗺️
      </button>
    );
  }

  return (
    <div className="minimap-navigator" ref={containerRef}>
      {/* Minimap Header */}
      <div className="minimap-header">
        <h4 className="minimap-title">Navigation</h4>
        <div className="minimap-controls">
          <button onClick={zoomToFit} className="fit-btn" title="Zoom to fit">
            ⌂
          </button>
          <button onClick={onToggleVisibility} className="close-btn" title="Hide minimap">
            ✕
          </button>
        </div>
      </div>

      {/* Minimap Canvas Container */}
      <div 
        className="minimap-canvas-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <canvas
          ref={minimapCanvasRef}
          width={minimapSize.width}
          height={minimapSize.height}
          className="minimap-canvas background"
        />
        <canvas
          ref={overlayCanvasRef}
          width={minimapSize.width}
          height={minimapSize.height}
          className="minimap-canvas overlay"
        />
        
        {/* Hover tooltip */}
        {hoveredElement && (
          <div className="minimap-tooltip">
            {hoveredElement.replace('-', ' ').toUpperCase()}
          </div>
        )}
      </div>

      {/* Layer Controls */}
      <div className="minimap-layers">
        <h5>Layers</h5>
        <div className="layer-list">
          {layers.map(layer => (
            <div key={layer.id} className="layer-item">
              <label className="layer-checkbox">
                <input
                  type="checkbox"
                  checked={layer.isVisible}
                  onChange={() => toggleLayer(layer.id)}
                />
                <span 
                  className="layer-color"
                  style={{ backgroundColor: layer.color }}
                />
                <span className="layer-name">{layer.name}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={layer.opacity}
                onChange={(e) => {
                  const newOpacity = parseFloat(e.target.value);
                  setLayers(prev => prev.map(l => 
                    l.id === layer.id ? { ...l, opacity: newOpacity } : l
                  ));
                }}
                className="opacity-slider"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Minimap Info */}
      <div className="minimap-info">
        <div className="info-row">
          <span>Scale:</span>
          <span>{(viewport.scale * 100).toFixed(0)}%</span>
        </div>
        <div className="info-row">
          <span>Position:</span>
          <span>({(-viewport.offsetX / viewport.scale).toFixed(0)}, {(-viewport.offsetY / viewport.scale).toFixed(0)})</span>
        </div>
        <div className="info-row">
          <span>Components:</span>
          <span>{components.length}</span>
        </div>
        <div className="info-row">
          <span>Annotations:</span>
          <span>{annotations.length}</span>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="quick-navigation">
        <h5>Quick Navigate</h5>
        <div className="nav-buttons">
          <button 
            onClick={() => onViewportChange({ ...viewport, offsetX: 0, offsetY: 0 })}
            className="nav-btn"
          >
            🏠 Origin
          </button>
          <button 
            onClick={() => {
              if (components.length > 0) {
                const firstComponent = components[0];
                const docPoint = firstComponent.centerPoint;
                onViewportChange({
                  ...viewport,
                  offsetX: -docPoint.x * viewport.scale + minimapSize.width / 2,
                  offsetY: -docPoint.y * viewport.scale + minimapSize.height / 2
                });
              }
            }}
            className="nav-btn"
            disabled={components.length === 0}
          >
            ⚡ First Component
          </button>
          <button 
            onClick={() => {
              if (annotations.length > 0) {
                const firstAnnotation = annotations[0];
                if (firstAnnotation.position) {
                  onViewportChange({
                    ...viewport,
                    offsetX: -firstAnnotation.position.x * viewport.scale + minimapSize.width / 2,
                    offsetY: -firstAnnotation.position.y * viewport.scale + minimapSize.height / 2
                  });
                }
              }
            }}
            className="nav-btn"
            disabled={annotations.length === 0}
          >
            📝 First Annotation
          </button>
        </div>
      </div>
    </div>
  );
};