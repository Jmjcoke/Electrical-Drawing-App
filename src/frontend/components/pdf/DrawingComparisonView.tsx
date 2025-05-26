import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ComparisonMode, DrawingDocument, ComparisonSettings, ViewSyncState } from '../../types/comparison';
import { Point, BoundingBox } from '../../types/electrical';

interface DrawingComparisonViewProps {
  primaryDrawing: DrawingDocument;
  secondaryDrawing: DrawingDocument;
  comparisonMode: ComparisonMode;
  onModeChange: (mode: ComparisonMode) => void;
  settings: ComparisonSettings;
  onSettingsChange: (settings: Partial<ComparisonSettings>) => void;
  onDifferenceDetected: (differences: DifferenceRegion[]) => void;
}

interface DifferenceRegion {
  id: string;
  type: 'added' | 'removed' | 'modified';
  boundingBox: BoundingBox;
  confidence: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface ViewportState {
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
}

export const DrawingComparisonView: React.FC<DrawingComparisonViewProps> = ({
  primaryDrawing,
  secondaryDrawing,
  comparisonMode,
  onModeChange,
  settings,
  onSettingsChange,
  onDifferenceDetected
}) => {
  const [syncState, setSyncState] = useState<ViewSyncState>({
    isEnabled: true,
    syncZoom: true,
    syncPan: true,
    syncRotation: false
  });

  const [primaryViewport, setPrimaryViewport] = useState<ViewportState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    rotation: 0
  });

  const [secondaryViewport, setSecondaryViewport] = useState<ViewportState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    rotation: 0
  });

  const [detectedDifferences, setDetectedDifferences] = useState<DifferenceRegion[]>([]);
  const [selectedDifference, setSelectedDifference] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const primaryCanvasRef = useRef<HTMLCanvasElement>(null);
  const secondaryCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const comparisonModes: { value: ComparisonMode; label: string; icon: string }[] = [
    { value: 'side-by-side', label: 'Side by Side', icon: '⫸' },
    { value: 'overlay', label: 'Overlay', icon: '⧉' },
    { value: 'split-view', label: 'Split View', icon: '◫' },
    { value: 'difference', label: 'Differences', icon: '△' },
    { value: 'animation', label: 'Animation', icon: '⟲' }
  ];

  const updateViewport = useCallback((
    viewport: ViewportState,
    isPrimary: boolean,
    forceSync = false
  ) => {
    if (isPrimary) {
      setPrimaryViewport(viewport);
      if ((syncState.isEnabled || forceSync) && syncState.syncZoom) {
        setSecondaryViewport(prev => ({ ...prev, scale: viewport.scale }));
      }
      if ((syncState.isEnabled || forceSync) && syncState.syncPan) {
        setSecondaryViewport(prev => ({ ...prev, offsetX: viewport.offsetX, offsetY: viewport.offsetY }));
      }
      if ((syncState.isEnabled || forceSync) && syncState.syncRotation) {
        setSecondaryViewport(prev => ({ ...prev, rotation: viewport.rotation }));
      }
    } else {
      setSecondaryViewport(viewport);
      if ((syncState.isEnabled || forceSync) && syncState.syncZoom) {
        setPrimaryViewport(prev => ({ ...prev, scale: viewport.scale }));
      }
      if ((syncState.isEnabled || forceSync) && syncState.syncPan) {
        setPrimaryViewport(prev => ({ ...prev, offsetX: viewport.offsetX, offsetY: viewport.offsetY }));
      }
      if ((syncState.isEnabled || forceSync) && syncState.syncRotation) {
        setPrimaryViewport(prev => ({ ...prev, rotation: viewport.rotation }));
      }
    }
  }, [syncState]);

  const detectDifferences = useCallback(async () => {
    setIsAnalyzing(true);
    
    try {
      // Simulate difference detection algorithm
      const mockDifferences: DifferenceRegion[] = [
        {
          id: 'diff_1',
          type: 'added',
          boundingBox: { x: 150, y: 200, width: 50, height: 30 },
          confidence: 0.95,
          description: 'New electrical outlet added',
          severity: 'medium'
        },
        {
          id: 'diff_2',
          type: 'removed',
          boundingBox: { x: 300, y: 150, width: 40, height: 40 },
          confidence: 0.88,
          description: 'Junction box removed',
          severity: 'high'
        },
        {
          id: 'diff_3',
          type: 'modified',
          boundingBox: { x: 450, y: 300, width: 60, height: 25 },
          confidence: 0.75,
          description: 'Switch configuration changed',
          severity: 'low'
        }
      ];

      setDetectedDifferences(mockDifferences);
      onDifferenceDetected(mockDifferences);
    } catch (error) {
      console.error('Error detecting differences:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [onDifferenceDetected]);

  const navigateToDifference = useCallback((difference: DifferenceRegion) => {
    const { boundingBox } = difference;
    const centerX = boundingBox.x + boundingBox.width / 2;
    const centerY = boundingBox.y + boundingBox.height / 2;

    const newViewport: ViewportState = {
      scale: 2.0,
      offsetX: -centerX * 2.0 + 400, // Center in view
      offsetY: -centerY * 2.0 + 300,
      rotation: 0
    };

    updateViewport(newViewport, true, true);
    setSelectedDifference(difference.id);
  }, [updateViewport]);

  const renderPrimaryDrawing = useCallback(() => {
    const canvas = primaryCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    
    // Apply viewport transformations
    ctx.scale(primaryViewport.scale, primaryViewport.scale);
    ctx.translate(primaryViewport.offsetX, primaryViewport.offsetY);
    ctx.rotate(primaryViewport.rotation * Math.PI / 180);

    // Draw primary drawing content
    if (primaryDrawing.imageData) {
      ctx.drawImage(primaryDrawing.imageData, 0, 0);
    }

    // Highlight differences if in difference mode
    if (comparisonMode === 'difference') {
      detectedDifferences.forEach(diff => {
        if (diff.type === 'added' || diff.type === 'modified') {
          ctx.strokeStyle = diff.type === 'added' ? '#00FF00' : '#FFA500';
          ctx.lineWidth = 3 / primaryViewport.scale;
          ctx.strokeRect(diff.boundingBox.x, diff.boundingBox.y, diff.boundingBox.width, diff.boundingBox.height);
          
          if (diff.id === selectedDifference) {
            ctx.fillStyle = diff.type === 'added' ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 165, 0, 0.2)';
            ctx.fillRect(diff.boundingBox.x, diff.boundingBox.y, diff.boundingBox.width, diff.boundingBox.height);
          }
        }
      });
    }

    ctx.restore();
  }, [primaryDrawing, primaryViewport, comparisonMode, detectedDifferences, selectedDifference]);

  const renderSecondaryDrawing = useCallback(() => {
    const canvas = secondaryCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    
    // Apply viewport transformations
    ctx.scale(secondaryViewport.scale, secondaryViewport.scale);
    ctx.translate(secondaryViewport.offsetX, secondaryViewport.offsetY);
    ctx.rotate(secondaryViewport.rotation * Math.PI / 180);

    // Draw secondary drawing content
    if (secondaryDrawing.imageData) {
      ctx.drawImage(secondaryDrawing.imageData, 0, 0);
    }

    // Highlight differences if in difference mode
    if (comparisonMode === 'difference') {
      detectedDifferences.forEach(diff => {
        if (diff.type === 'removed' || diff.type === 'modified') {
          ctx.strokeStyle = diff.type === 'removed' ? '#FF0000' : '#FFA500';
          ctx.lineWidth = 3 / secondaryViewport.scale;
          ctx.strokeRect(diff.boundingBox.x, diff.boundingBox.y, diff.boundingBox.width, diff.boundingBox.height);
          
          if (diff.id === selectedDifference) {
            ctx.fillStyle = diff.type === 'removed' ? 'rgba(255, 0, 0, 0.2)' : 'rgba(255, 165, 0, 0.2)';
            ctx.fillRect(diff.boundingBox.x, diff.boundingBox.y, diff.boundingBox.width, diff.boundingBox.height);
          }
        }
      });
    }

    ctx.restore();
  }, [secondaryDrawing, secondaryViewport, comparisonMode, detectedDifferences, selectedDifference]);

  const renderOverlay = useCallback(() => {
    if (comparisonMode !== 'overlay') return;

    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    
    // Apply viewport transformations
    ctx.scale(primaryViewport.scale, primaryViewport.scale);
    ctx.translate(primaryViewport.offsetX, primaryViewport.offsetY);
    ctx.rotate(primaryViewport.rotation * Math.PI / 180);

    // Draw primary drawing with transparency
    if (primaryDrawing.imageData) {
      ctx.globalAlpha = settings.primaryOpacity;
      ctx.drawImage(primaryDrawing.imageData, 0, 0);
    }

    // Draw secondary drawing with transparency and blend mode
    if (secondaryDrawing.imageData) {
      ctx.globalAlpha = settings.secondaryOpacity;
      ctx.globalCompositeOperation = settings.blendMode || 'multiply';
      ctx.drawImage(secondaryDrawing.imageData, 0, 0);
    }

    ctx.restore();
  }, [comparisonMode, primaryDrawing, secondaryDrawing, primaryViewport, settings]);

  // Re-render when viewports or settings change
  useEffect(() => {
    renderPrimaryDrawing();
  }, [renderPrimaryDrawing]);

  useEffect(() => {
    renderSecondaryDrawing();
  }, [renderSecondaryDrawing]);

  useEffect(() => {
    renderOverlay();
  }, [renderOverlay]);

  const handleWheel = useCallback((event: React.WheelEvent, isPrimary: boolean) => {
    event.preventDefault();
    
    const currentViewport = isPrimary ? primaryViewport : secondaryViewport;
    const deltaScale = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, currentViewport.scale * deltaScale));
    
    updateViewport({
      ...currentViewport,
      scale: newScale
    }, isPrimary);
  }, [primaryViewport, secondaryViewport, updateViewport]);

  return (
    <div className="drawing-comparison-view">
      {/* Comparison Controls */}
      <div className="comparison-controls">
        <div className="mode-selector">
          <label>Comparison Mode:</label>
          <div className="mode-buttons">
            {comparisonModes.map(mode => (
              <button
                key={mode.value}
                className={`mode-btn ${comparisonMode === mode.value ? 'active' : ''}`}
                onClick={() => onModeChange(mode.value)}
                title={mode.label}
              >
                <span className="mode-icon">{mode.icon}</span>
                <span className="mode-label">{mode.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sync-controls">
          <label>
            <input
              type="checkbox"
              checked={syncState.isEnabled}
              onChange={(e) => setSyncState(prev => ({ ...prev, isEnabled: e.target.checked }))}
            />
            Sync Views
          </label>
          {syncState.isEnabled && (
            <div className="sync-options">
              <label>
                <input
                  type="checkbox"
                  checked={syncState.syncZoom}
                  onChange={(e) => setSyncState(prev => ({ ...prev, syncZoom: e.target.checked }))}
                />
                Zoom
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={syncState.syncPan}
                  onChange={(e) => setSyncState(prev => ({ ...prev, syncPan: e.target.checked }))}
                />
                Pan
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={syncState.syncRotation}
                  onChange={(e) => setSyncState(prev => ({ ...prev, syncRotation: e.target.checked }))}
                />
                Rotation
              </label>
            </div>
          )}
        </div>

        {comparisonMode === 'overlay' && (
          <div className="overlay-controls">
            <div className="opacity-control">
              <label>Primary Opacity:</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.primaryOpacity}
                onChange={(e) => onSettingsChange({ primaryOpacity: parseFloat(e.target.value) })}
              />
              <span>{(settings.primaryOpacity * 100).toFixed(0)}%</span>
            </div>
            <div className="opacity-control">
              <label>Secondary Opacity:</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.secondaryOpacity}
                onChange={(e) => onSettingsChange({ secondaryOpacity: parseFloat(e.target.value) })}
              />
              <span>{(settings.secondaryOpacity * 100).toFixed(0)}%</span>
            </div>
            <div className="blend-control">
              <label>Blend Mode:</label>
              <select
                value={settings.blendMode}
                onChange={(e) => onSettingsChange({ blendMode: e.target.value as any })}
              >
                <option value="normal">Normal</option>
                <option value="multiply">Multiply</option>
                <option value="screen">Screen</option>
                <option value="overlay">Overlay</option>
                <option value="difference">Difference</option>
              </select>
            </div>
          </div>
        )}

        <div className="analysis-controls">
          <button
            onClick={detectDifferences}
            disabled={isAnalyzing}
            className="analyze-btn"
          >
            {isAnalyzing ? 'Analyzing...' : 'Detect Differences'}
          </button>
        </div>
      </div>

      {/* Comparison View Area */}
      <div className={`comparison-content mode-${comparisonMode}`}>
        {comparisonMode === 'side-by-side' && (
          <div className="side-by-side-view">
            <div className="drawing-panel primary">
              <div className="panel-header">
                <h3>{primaryDrawing.name}</h3>
                <span className="version">v{primaryDrawing.version}</span>
              </div>
              <canvas
                ref={primaryCanvasRef}
                width={800}
                height={600}
                onWheel={(e) => handleWheel(e, true)}
                className="drawing-canvas"
              />
            </div>
            <div className="drawing-panel secondary">
              <div className="panel-header">
                <h3>{secondaryDrawing.name}</h3>
                <span className="version">v{secondaryDrawing.version}</span>
              </div>
              <canvas
                ref={secondaryCanvasRef}
                width={800}
                height={600}
                onWheel={(e) => handleWheel(e, false)}
                className="drawing-canvas"
              />
            </div>
          </div>
        )}

        {comparisonMode === 'overlay' && (
          <div className="overlay-view">
            <div className="overlay-header">
              <h3>Overlay Comparison</h3>
              <div className="legend">
                <span className="legend-item primary">
                  <div className="color-indicator" style={{ backgroundColor: '#0066CC', opacity: settings.primaryOpacity }} />
                  {primaryDrawing.name}
                </span>
                <span className="legend-item secondary">
                  <div className="color-indicator" style={{ backgroundColor: '#CC6600', opacity: settings.secondaryOpacity }} />
                  {secondaryDrawing.name}
                </span>
              </div>
            </div>
            <canvas
              ref={overlayCanvasRef}
              width={1600}
              height={600}
              onWheel={(e) => handleWheel(e, true)}
              className="overlay-canvas"
            />
          </div>
        )}

        {comparisonMode === 'difference' && (
          <div className="difference-view">
            <div className="differences-panel">
              <h3>Detected Differences ({detectedDifferences.length})</h3>
              <div className="differences-list">
                {detectedDifferences.map(diff => (
                  <div
                    key={diff.id}
                    className={`difference-item ${diff.type} ${selectedDifference === diff.id ? 'selected' : ''}`}
                    onClick={() => navigateToDifference(diff)}
                  >
                    <div className="diff-header">
                      <span className={`diff-type type-${diff.type}`}>
                        {diff.type.toUpperCase()}
                      </span>
                      <span className={`diff-severity severity-${diff.severity}`}>
                        {diff.severity}
                      </span>
                    </div>
                    <div className="diff-description">{diff.description}</div>
                    <div className="diff-confidence">
                      Confidence: {(diff.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="difference-drawings">
              <div className="drawing-panel primary">
                <h4>Primary Drawing</h4>
                <canvas
                  ref={primaryCanvasRef}
                  width={600}
                  height={450}
                  className="drawing-canvas"
                />
              </div>
              <div className="drawing-panel secondary">
                <h4>Secondary Drawing</h4>
                <canvas
                  ref={secondaryCanvasRef}
                  width={600}
                  height={450}
                  className="drawing-canvas"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="comparison-status">
        <div className="viewport-info">
          <span>Zoom: {(primaryViewport.scale * 100).toFixed(0)}%</span>
          <span>Pan: ({primaryViewport.offsetX.toFixed(0)}, {primaryViewport.offsetY.toFixed(0)})</span>
          {syncState.isEnabled && <span className="sync-indicator">🔗 Synced</span>}
        </div>
        <div className="analysis-info">
          {detectedDifferences.length > 0 && (
            <span>{detectedDifferences.length} differences found</span>
          )}
          {isAnalyzing && <span>Analyzing drawings...</span>}
        </div>
      </div>
    </div>
  );
};