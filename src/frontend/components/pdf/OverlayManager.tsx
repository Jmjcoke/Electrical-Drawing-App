import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DrawingLayer, LayerSettings, OverlayConfig, BlendMode } from '../../types/overlay';
import { Point, BoundingBox } from '../../types/electrical';

interface OverlayManagerProps {
  layers: DrawingLayer[];
  onLayersChange: (layers: DrawingLayer[]) => void;
  canvasWidth: number;
  canvasHeight: number;
  scale: number;
  offset: Point;
  onRender: (canvas: HTMLCanvasElement) => void;
}

interface LayerOperation {
  type: 'add' | 'remove' | 'reorder' | 'update';
  layerId: string;
  data?: any;
  timestamp: number;
}

export const OverlayManager: React.FC<OverlayManagerProps> = ({
  layers,
  onLayersChange,
  canvasWidth,
  canvasHeight,
  scale,
  offset,
  onRender
}) => {
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [layerHistory, setLayerHistory] = useState<LayerOperation[]>([]);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [previewMode, setPreviewMode] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const blendModes: { value: BlendMode; label: string }[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'multiply', label: 'Multiply' },
    { value: 'screen', label: 'Screen' },
    { value: 'overlay', label: 'Overlay' },
    { value: 'soft-light', label: 'Soft Light' },
    { value: 'hard-light', label: 'Hard Light' },
    { value: 'color-dodge', label: 'Color Dodge' },
    { value: 'color-burn', label: 'Color Burn' },
    { value: 'difference', label: 'Difference' },
    { value: 'exclusion', label: 'Exclusion' }
  ];

  const addToHistory = useCallback((operation: LayerOperation) => {
    setLayerHistory(prev => [...prev.slice(-49), operation]); // Keep last 50 operations
  }, []);

  const addLayer = useCallback((drawingData: any, name?: string) => {
    const newLayer: DrawingLayer = {
      id: `layer_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: name || `Layer ${layers.length + 1}`,
      isVisible: true,
      opacity: 1.0,
      blendMode: 'normal',
      drawingData,
      bounds: { x: 0, y: 0, width: canvasWidth, height: canvasHeight },
      zIndex: layers.length,
      isLocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updatedLayers = [...layers, newLayer];
    onLayersChange(updatedLayers);
    
    addToHistory({
      type: 'add',
      layerId: newLayer.id,
      data: newLayer,
      timestamp: Date.now()
    });
  }, [layers, canvasWidth, canvasHeight, onLayersChange, addToHistory]);

  const removeLayer = useCallback((layerId: string) => {
    const layerToRemove = layers.find(l => l.id === layerId);
    if (!layerToRemove) return;

    const updatedLayers = layers.filter(l => l.id !== layerId);
    onLayersChange(updatedLayers);
    
    addToHistory({
      type: 'remove',
      layerId,
      data: layerToRemove,
      timestamp: Date.now()
    });

    if (selectedLayerId === layerId) {
      setSelectedLayerId(null);
    }
  }, [layers, onLayersChange, addToHistory, selectedLayerId]);

  const updateLayer = useCallback((layerId: string, updates: Partial<DrawingLayer>) => {
    const layerIndex = layers.findIndex(l => l.id === layerId);
    if (layerIndex === -1) return;

    const oldLayer = layers[layerIndex];
    const updatedLayer = {
      ...oldLayer,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const updatedLayers = [...layers];
    updatedLayers[layerIndex] = updatedLayer;
    onLayersChange(updatedLayers);

    addToHistory({
      type: 'update',
      layerId,
      data: { old: oldLayer, new: updatedLayer },
      timestamp: Date.now()
    });
  }, [layers, onLayersChange, addToHistory]);

  const reorderLayer = useCallback((layerId: string, newZIndex: number) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    const reorderedLayers = layers.map(l => {
      if (l.id === layerId) {
        return { ...l, zIndex: newZIndex };
      } else if (l.zIndex >= newZIndex && l.id !== layerId) {
        return { ...l, zIndex: l.zIndex + 1 };
      }
      return l;
    }).sort((a, b) => a.zIndex - b.zIndex);

    onLayersChange(reorderedLayers);

    addToHistory({
      type: 'reorder',
      layerId,
      data: { oldZIndex: layer.zIndex, newZIndex },
      timestamp: Date.now()
    });
  }, [layers, onLayersChange, addToHistory]);

  const duplicateLayer = useCallback((layerId: string) => {
    const layerToDuplicate = layers.find(l => l.id === layerId);
    if (!layerToDuplicate) return;

    const duplicatedLayer: DrawingLayer = {
      ...layerToDuplicate,
      id: `layer_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: `${layerToDuplicate.name} Copy`,
      zIndex: layers.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updatedLayers = [...layers, duplicatedLayer];
    onLayersChange(updatedLayers);

    addToHistory({
      type: 'add',
      layerId: duplicatedLayer.id,
      data: duplicatedLayer,
      timestamp: Date.now()
    });
  }, [layers, onLayersChange, addToHistory]);

  const mergeVisibleLayers = useCallback(() => {
    const visibleLayers = layers.filter(l => l.isVisible).sort((a, b) => a.zIndex - b.zIndex);
    if (visibleLayers.length < 2) return;

    // Create merged layer canvas
    const mergedCanvas = document.createElement('canvas');
    mergedCanvas.width = canvasWidth;
    mergedCanvas.height = canvasHeight;
    const ctx = mergedCanvas.getContext('2d');
    if (!ctx) return;

    // Render all visible layers onto merged canvas
    visibleLayers.forEach(layer => {
      const layerCanvas = layerCanvasRefs.current.get(layer.id);
      if (layerCanvas) {
        ctx.globalAlpha = layer.opacity;
        ctx.globalCompositeOperation = layer.blendMode;
        ctx.drawImage(layerCanvas, 0, 0);
      }
    });

    // Create new merged layer
    const mergedLayer: DrawingLayer = {
      id: `merged_${Date.now()}`,
      name: 'Merged Layer',
      isVisible: true,
      opacity: 1.0,
      blendMode: 'normal',
      drawingData: mergedCanvas.toDataURL(),
      bounds: { x: 0, y: 0, width: canvasWidth, height: canvasHeight },
      zIndex: 0,
      isLocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Remove original visible layers and add merged layer
    const nonVisibleLayers = layers.filter(l => !l.isVisible);
    onLayersChange([mergedLayer, ...nonVisibleLayers]);
  }, [layers, canvasWidth, canvasHeight, onLayersChange]);

  const renderLayers = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.save();

    // Apply scale and offset
    ctx.scale(scale, scale);
    ctx.translate(offset.x, offset.y);

    // Sort layers by z-index and render visible ones
    const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);
    
    sortedLayers.forEach(layer => {
      if (!layer.isVisible && !previewMode) return;

      const layerCanvas = layerCanvasRefs.current.get(layer.id);
      if (!layerCanvas) return;

      ctx.save();
      
      // Apply layer transformations
      ctx.globalAlpha = layer.opacity * (layer.isVisible ? 1 : 0.3);
      ctx.globalCompositeOperation = layer.blendMode;
      
      // Apply layer bounds
      ctx.drawImage(
        layerCanvas,
        layer.bounds.x,
        layer.bounds.y,
        layer.bounds.width,
        layer.bounds.height
      );

      // Draw selection border if selected
      if (selectedLayerId === layer.id) {
        ctx.strokeStyle = '#0099FF';
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([5 / scale, 5 / scale]);
        ctx.strokeRect(layer.bounds.x, layer.bounds.y, layer.bounds.width, layer.bounds.height);
      }

      ctx.restore();
    });

    ctx.restore();
    onRender(canvas);
  }, [layers, scale, offset, canvasWidth, canvasHeight, selectedLayerId, previewMode, onRender]);

  // Re-render when layers or settings change
  useEffect(() => {
    renderLayers();
  }, [renderLayers]);

  const handleDragStart = useCallback((event: React.MouseEvent, layerId: string) => {
    if (layers.find(l => l.id === layerId)?.isLocked) return;
    
    setIsDragging(layerId);
    const rect = event.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  }, [layers]);

  const handleDragMove = useCallback((event: React.MouseEvent) => {
    if (!isDragging) return;

    const layer = layers.find(l => l.id === isDragging);
    if (!layer) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const newX = (event.clientX - rect.left - dragOffset.x) / scale - offset.x;
    const newY = (event.clientY - rect.top - dragOffset.y) / scale - offset.y;

    updateLayer(isDragging, {
      bounds: {
        ...layer.bounds,
        x: newX,
        y: newY
      }
    });
  }, [isDragging, layers, dragOffset, scale, offset, updateLayer]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(null);
    setDragOffset({ x: 0, y: 0 });
  }, []);

  const exportLayers = useCallback((format: 'json' | 'png') => {
    if (format === 'json') {
      const exportData = {
        layers: layers.map(layer => ({
          ...layer,
          drawingData: typeof layer.drawingData === 'string' ? layer.drawingData : '[Binary Data]'
        })),
        settings: {
          canvasWidth,
          canvasHeight,
          scale,
          offset
        },
        exportedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `overlay_layers_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (format === 'png') {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.toBlob(blob => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `overlay_export_${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(url);
          }
        });
      }
    }
  }, [layers, canvasWidth, canvasHeight, scale, offset]);

  return (
    <div className="overlay-manager">
      {/* Layer Controls */}
      <div className="layer-controls">
        <div className="control-buttons">
          <button onClick={() => addLayer(null)} className="add-layer-btn">
            ➕ Add Layer
          </button>
          <button 
            onClick={() => selectedLayerId && duplicateLayer(selectedLayerId)}
            disabled={!selectedLayerId}
            className="duplicate-layer-btn"
          >
            📋 Duplicate
          </button>
          <button onClick={mergeVisibleLayers} className="merge-layers-btn">
            🔗 Merge Visible
          </button>
          <button 
            onClick={() => setPreviewMode(!previewMode)}
            className={`preview-mode-btn ${previewMode ? 'active' : ''}`}
          >
            👁️ Preview All
          </button>
        </div>

        <div className="export-controls">
          <button onClick={() => exportLayers('json')} className="export-btn">
            📄 Export JSON
          </button>
          <button onClick={() => exportLayers('png')} className="export-btn">
            🖼️ Export PNG
          </button>
        </div>
      </div>

      {/* Layer List */}
      <div className="layer-list">
        <h3>Layers ({layers.length})</h3>
        <div className="layers">
          {[...layers].sort((a, b) => b.zIndex - a.zIndex).map(layer => (
            <div
              key={layer.id}
              className={`layer-item ${selectedLayerId === layer.id ? 'selected' : ''} ${layer.isLocked ? 'locked' : ''}`}
              onClick={() => setSelectedLayerId(layer.id)}
              onMouseDown={(e) => handleDragStart(e, layer.id)}
            >
              <div className="layer-header">
                <div className="layer-visibility">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateLayer(layer.id, { isVisible: !layer.isVisible });
                    }}
                    className={`visibility-btn ${layer.isVisible ? 'visible' : 'hidden'}`}
                  >
                    {layer.isVisible ? '👁️' : '🚫'}
                  </button>
                </div>
                
                <div className="layer-info">
                  <input
                    type="text"
                    value={layer.name}
                    onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
                    className="layer-name"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span className="layer-index">#{layer.zIndex}</span>
                </div>

                <div className="layer-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateLayer(layer.id, { isLocked: !layer.isLocked });
                    }}
                    className={`lock-btn ${layer.isLocked ? 'locked' : 'unlocked'}`}
                  >
                    {layer.isLocked ? '🔒' : '🔓'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLayer(layer.id);
                    }}
                    className="delete-btn"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="layer-settings">
                <div className="setting-row">
                  <label>Opacity:</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={layer.opacity}
                    onChange={(e) => updateLayer(layer.id, { opacity: parseFloat(e.target.value) })}
                    className="opacity-slider"
                  />
                  <span className="opacity-value">{(layer.opacity * 100).toFixed(0)}%</span>
                </div>

                <div className="setting-row">
                  <label>Blend Mode:</label>
                  <select
                    value={layer.blendMode}
                    onChange={(e) => updateLayer(layer.id, { blendMode: e.target.value as BlendMode })}
                    className="blend-select"
                  >
                    {blendModes.map(mode => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="setting-row">
                  <label>Z-Index:</label>
                  <input
                    type="number"
                    value={layer.zIndex}
                    onChange={(e) => reorderLayer(layer.id, parseInt(e.target.value))}
                    className="zindex-input"
                    min="0"
                  />
                </div>
              </div>

              <div className="layer-thumbnail">
                <canvas
                  ref={(canvas) => {
                    if (canvas) {
                      layerCanvasRefs.current.set(layer.id, canvas);
                    }
                  }}
                  width={80}
                  height={60}
                  className="thumbnail-canvas"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Canvas */}
      <div className="overlay-canvas-container">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          onMouseMove={handleDragMove}
          onMouseUp={handleDragEnd}
          className="overlay-canvas"
        />
      </div>

      {/* Layer Properties Panel */}
      {selectedLayerId && (
        <div className="layer-properties">
          <h4>Layer Properties</h4>
          {(() => {
            const layer = layers.find(l => l.id === selectedLayerId);
            if (!layer) return null;

            return (
              <div className="properties-content">
                <div className="property-group">
                  <h5>Transform</h5>
                  <div className="property-row">
                    <label>X:</label>
                    <input
                      type="number"
                      value={layer.bounds.x.toFixed(1)}
                      onChange={(e) => updateLayer(layer.id, {
                        bounds: { ...layer.bounds, x: parseFloat(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="property-row">
                    <label>Y:</label>
                    <input
                      type="number"
                      value={layer.bounds.y.toFixed(1)}
                      onChange={(e) => updateLayer(layer.id, {
                        bounds: { ...layer.bounds, y: parseFloat(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="property-row">
                    <label>Width:</label>
                    <input
                      type="number"
                      value={layer.bounds.width.toFixed(1)}
                      onChange={(e) => updateLayer(layer.id, {
                        bounds: { ...layer.bounds, width: parseFloat(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="property-row">
                    <label>Height:</label>
                    <input
                      type="number"
                      value={layer.bounds.height.toFixed(1)}
                      onChange={(e) => updateLayer(layer.id, {
                        bounds: { ...layer.bounds, height: parseFloat(e.target.value) }
                      })}
                    />
                  </div>
                </div>

                <div className="property-group">
                  <h5>Information</h5>
                  <div className="info-row">
                    <span>Created:</span>
                    <span>{new Date(layer.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="info-row">
                    <span>Updated:</span>
                    <span>{new Date(layer.updatedAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};