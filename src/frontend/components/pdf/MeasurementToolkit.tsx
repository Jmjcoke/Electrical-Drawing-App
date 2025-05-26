import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Point, BoundingBox } from '../../types/electrical';
import { MeasurementTool, MeasurementResult, CalibrationData, MeasurementUnit } from '../../types/measurement';

interface MeasurementToolkitProps {
  canvas: HTMLCanvasElement | null;
  scale: number;
  offset: Point;
  calibration: CalibrationData;
  onCalibrationChange: (calibration: CalibrationData) => void;
  measurements: MeasurementResult[];
  onMeasurementsChange: (measurements: MeasurementResult[]) => void;
  activeTool: MeasurementTool;
  onToolChange: (tool: MeasurementTool) => void;
  isVisible: boolean;
  onToggleVisibility: () => void;
  defaultUnit: MeasurementUnit;
  onUnitChange: (unit: MeasurementUnit) => void;
}

interface DrawingState {
  isDrawing: boolean;
  startPoint: Point | null;
  currentPoint: Point | null;
  points: Point[];
}

interface CalibrationState {
  isCalibrating: boolean;
  calibrationLine: { start: Point; end: Point } | null;
  knownDistance: number;
  knownUnit: MeasurementUnit;
}

export const MeasurementToolkit: React.FC<MeasurementToolkitProps> = ({
  canvas,
  scale,
  offset,
  calibration,
  onCalibrationChange,
  measurements,
  onMeasurementsChange,
  activeTool,
  onToolChange,
  isVisible,
  onToggleVisibility,
  defaultUnit,
  onUnitChange
}) => {
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    startPoint: null,
    currentPoint: null,
    points: []
  });

  const [calibrationState, setCalibrationState] = useState<CalibrationState>({
    isCalibrating: false,
    calibrationLine: null,
    knownDistance: 0,
    knownUnit: 'ft'
  });

  const [selectedMeasurementId, setSelectedMeasurementId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [precision, setPrecision] = useState(2);

  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const measurementTools: { tool: MeasurementTool; label: string; icon: string }[] = [
    { tool: 'distance', label: 'Distance', icon: '📏' },
    { tool: 'area', label: 'Area', icon: '📐' },
    { tool: 'perimeter', label: 'Perimeter', icon: '⭕' },
    { tool: 'angle', label: 'Angle', icon: '📐' },
    { tool: 'radius', label: 'Radius', icon: '⚪' },
    { tool: 'calibrate', label: 'Calibrate', icon: '🎯' }
  ];

  const units: { value: MeasurementUnit; label: string; factor: number }[] = [
    { value: 'px', label: 'Pixels', factor: 1 },
    { value: 'in', label: 'Inches', factor: 1 },
    { value: 'ft', label: 'Feet', factor: 12 },
    { value: 'mm', label: 'Millimeters', factor: 0.03937 },
    { value: 'cm', label: 'Centimeters', factor: 0.3937 },
    { value: 'm', label: 'Meters', factor: 39.37 }
  ];

  const convertPixelsToUnit = useCallback((pixels: number, unit: MeasurementUnit = defaultUnit): number => {
    if (!calibration.pixelsPerUnit || calibration.unit === 'px') {
      return pixels;
    }

    // Convert to base unit (inches)
    const baseValue = pixels / calibration.pixelsPerUnit;
    
    // Convert to target unit
    const targetUnit = units.find(u => u.value === unit);
    const calibrationUnit = units.find(u => u.value === calibration.unit);
    
    if (!targetUnit || !calibrationUnit) return pixels;
    
    return (baseValue * calibrationUnit.factor) / targetUnit.factor;
  }, [calibration, defaultUnit]);

  const calculateDistance = useCallback((p1: Point, p2: Point): number => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const calculateArea = useCallback((points: Point[]): number => {
    if (points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
  }, []);

  const calculatePerimeter = useCallback((points: Point[]): number => {
    if (points.length < 2) return 0;
    
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
      const next = (i + 1) % points.length;
      perimeter += calculateDistance(points[i], points[next]);
    }
    return perimeter;
  }, [calculateDistance]);

  const calculateAngle = useCallback((p1: Point, vertex: Point, p2: Point): number => {
    const angle1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
    const angle2 = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
    let angle = angle2 - angle1;
    
    if (angle < 0) angle += 2 * Math.PI;
    if (angle > Math.PI) angle = 2 * Math.PI - angle;
    
    return (angle * 180) / Math.PI;
  }, []);

  const getCanvasPoint = useCallback((event: React.MouseEvent): Point => {
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left - offset.x) / scale,
      y: (event.clientY - rect.top - offset.y) / scale
    };
  }, [canvas, scale, offset]);

  const generateMeasurementId = useCallback((): string => {
    return `measurement_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }, []);

  const addMeasurement = useCallback((measurement: Omit<MeasurementResult, 'id' | 'timestamp'>): void => {
    const newMeasurement: MeasurementResult = {
      ...measurement,
      id: generateMeasurementId(),
      timestamp: new Date().toISOString()
    };
    
    onMeasurementsChange([...measurements, newMeasurement]);
  }, [measurements, onMeasurementsChange, generateMeasurementId]);

  const deleteMeasurement = useCallback((id: string): void => {
    onMeasurementsChange(measurements.filter(m => m.id !== id));
    if (selectedMeasurementId === id) {
      setSelectedMeasurementId(null);
    }
  }, [measurements, onMeasurementsChange, selectedMeasurementId]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (activeTool === 'calibrate') {
      const point = getCanvasPoint(event);
      setCalibrationState(prev => ({
        ...prev,
        isCalibrating: true,
        calibrationLine: { start: point, end: point }
      }));
      return;
    }

    const point = getCanvasPoint(event);
    
    setDrawingState({
      isDrawing: true,
      startPoint: point,
      currentPoint: point,
      points: [point]
    });
  }, [activeTool, getCanvasPoint]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const currentPoint = getCanvasPoint(event);

    if (calibrationState.isCalibrating && calibrationState.calibrationLine) {
      setCalibrationState(prev => ({
        ...prev,
        calibrationLine: prev.calibrationLine ? {
          ...prev.calibrationLine,
          end: currentPoint
        } : null
      }));
      return;
    }

    if (!drawingState.isDrawing) return;

    if (activeTool === 'area' || activeTool === 'perimeter') {
      // For polygon tools, add points on click
      setDrawingState(prev => ({
        ...prev,
        currentPoint
      }));
    } else {
      setDrawingState(prev => ({
        ...prev,
        currentPoint
      }));
    }
  }, [drawingState.isDrawing, calibrationState.isCalibrating, activeTool, getCanvasPoint]);

  const handleMouseUp = useCallback(() => {
    if (calibrationState.isCalibrating && calibrationState.calibrationLine) {
      // Show calibration dialog
      return;
    }

    if (!drawingState.isDrawing || !drawingState.startPoint || !drawingState.currentPoint) return;

    const { startPoint, currentPoint, points } = drawingState;

    switch (activeTool) {
      case 'distance':
        const distance = calculateDistance(startPoint, currentPoint);
        addMeasurement({
          type: 'distance',
          value: convertPixelsToUnit(distance),
          unit: defaultUnit,
          points: [startPoint, currentPoint],
          displayText: `${convertPixelsToUnit(distance).toFixed(precision)} ${defaultUnit}`,
          pixelValue: distance
        });
        break;

      case 'radius':
        const radius = calculateDistance(startPoint, currentPoint);
        addMeasurement({
          type: 'radius',
          value: convertPixelsToUnit(radius),
          unit: defaultUnit,
          points: [startPoint, currentPoint],
          displayText: `R = ${convertPixelsToUnit(radius).toFixed(precision)} ${defaultUnit}`,
          pixelValue: radius,
          center: startPoint
        });
        break;
    }

    setDrawingState({
      isDrawing: false,
      startPoint: null,
      currentPoint: null,
      points: []
    });
  }, [
    drawingState, 
    calibrationState, 
    activeTool, 
    calculateDistance, 
    convertPixelsToUnit, 
    defaultUnit, 
    precision, 
    addMeasurement
  ]);

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    if (activeTool === 'area' || activeTool === 'perimeter') {
      const { points } = drawingState;
      if (points.length >= 3) {
        if (activeTool === 'area') {
          const area = calculateArea(points);
          addMeasurement({
            type: 'area',
            value: convertPixelsToUnit(area),
            unit: `${defaultUnit}²`,
            points,
            displayText: `${convertPixelsToUnit(area).toFixed(precision)} ${defaultUnit}²`,
            pixelValue: area
          });
        } else {
          const perimeter = calculatePerimeter(points);
          addMeasurement({
            type: 'perimeter',
            value: convertPixelsToUnit(perimeter),
            unit: defaultUnit,
            points,
            displayText: `${convertPixelsToUnit(perimeter).toFixed(precision)} ${defaultUnit}`,
            pixelValue: perimeter
          });
        }
      }
      
      setDrawingState({
        isDrawing: false,
        startPoint: null,
        currentPoint: null,
        points: []
      });
    }
  }, [activeTool, drawingState, calculateArea, calculatePerimeter, convertPixelsToUnit, defaultUnit, precision, addMeasurement]);

  const handleClick = useCallback((event: React.MouseEvent) => {
    if (activeTool === 'area' || activeTool === 'perimeter') {
      const point = getCanvasPoint(event);
      setDrawingState(prev => ({
        ...prev,
        points: [...prev.points, point]
      }));
    }
  }, [activeTool, getCanvasPoint]);

  const completeCalibration = useCallback(() => {
    if (!calibrationState.calibrationLine || calibrationState.knownDistance <= 0) return;

    const pixelDistance = calculateDistance(
      calibrationState.calibrationLine.start,
      calibrationState.calibrationLine.end
    );

    const pixelsPerUnit = pixelDistance / calibrationState.knownDistance;

    onCalibrationChange({
      pixelsPerUnit,
      unit: calibrationState.knownUnit,
      isCalibrated: true
    });

    setCalibrationState({
      isCalibrating: false,
      calibrationLine: null,
      knownDistance: 0,
      knownUnit: 'ft'
    });

    onToolChange('distance');
  }, [calibrationState, calculateDistance, onCalibrationChange, onToolChange]);

  const renderMeasurements = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;

    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    ctx.save();

    // Apply transformations
    ctx.scale(scale, scale);
    ctx.translate(offset.x, offset.y);

    measurements.forEach(measurement => {
      const isSelected = measurement.id === selectedMeasurementId;
      
      ctx.strokeStyle = isSelected ? '#FF6B6B' : '#0099FF';
      ctx.fillStyle = isSelected ? '#FF6B6B' : '#0099FF';
      ctx.lineWidth = isSelected ? 3 : 2;

      switch (measurement.type) {
        case 'distance':
          if (measurement.points.length >= 2) {
            const [start, end] = measurement.points;
            
            // Draw line
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
            
            // Draw endpoints
            ctx.fillRect(start.x - 3, start.y - 3, 6, 6);
            ctx.fillRect(end.x - 3, end.y - 3, 6, 6);
            
            // Draw label
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            ctx.fillText(measurement.displayText, midX, midY - 10);
          }
          break;

        case 'area':
          if (measurement.points.length >= 3) {
            ctx.beginPath();
            ctx.moveTo(measurement.points[0].x, measurement.points[0].y);
            measurement.points.slice(1).forEach(point => {
              ctx.lineTo(point.x, point.y);
            });
            ctx.closePath();
            ctx.stroke();
            
            // Fill with transparency
            ctx.globalAlpha = 0.2;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            
            // Draw centroid label
            const centroidX = measurement.points.reduce((sum, p) => sum + p.x, 0) / measurement.points.length;
            const centroidY = measurement.points.reduce((sum, p) => sum + p.y, 0) / measurement.points.length;
            ctx.fillText(measurement.displayText, centroidX, centroidY);
          }
          break;

        case 'radius':
          if (measurement.center && measurement.points.length >= 2) {
            const radius = calculateDistance(measurement.center, measurement.points[1]);
            
            // Draw circle
            ctx.beginPath();
            ctx.arc(measurement.center.x, measurement.center.y, radius, 0, 2 * Math.PI);
            ctx.stroke();
            
            // Draw radius line
            ctx.beginPath();
            ctx.moveTo(measurement.center.x, measurement.center.y);
            ctx.lineTo(measurement.points[1].x, measurement.points[1].y);
            ctx.stroke();
            
            // Draw center point
            ctx.fillRect(measurement.center.x - 3, measurement.center.y - 3, 6, 6);
            
            // Draw label
            const labelX = measurement.center.x + radius / 2;
            const labelY = measurement.center.y - 10;
            ctx.fillText(measurement.displayText, labelX, labelY);
          }
          break;
      }
    });

    // Draw current drawing state
    if (drawingState.isDrawing && drawingState.startPoint && drawingState.currentPoint) {
      ctx.strokeStyle = '#FFA500';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      switch (activeTool) {
        case 'distance':
        case 'radius':
          ctx.beginPath();
          ctx.moveTo(drawingState.startPoint.x, drawingState.startPoint.y);
          ctx.lineTo(drawingState.currentPoint.x, drawingState.currentPoint.y);
          ctx.stroke();
          break;

        case 'area':
        case 'perimeter':
          if (drawingState.points.length > 1) {
            ctx.beginPath();
            ctx.moveTo(drawingState.points[0].x, drawingState.points[0].y);
            drawingState.points.slice(1).forEach(point => {
              ctx.lineTo(point.x, point.y);
            });
            if (drawingState.currentPoint) {
              ctx.lineTo(drawingState.currentPoint.x, drawingState.currentPoint.y);
            }
            ctx.stroke();
          }
          break;
      }
    }

    // Draw calibration line
    if (calibrationState.isCalibrating && calibrationState.calibrationLine) {
      ctx.strokeStyle = '#FF0000';
      ctx.lineWidth = 3;
      ctx.setLineDash([]);
      
      const { start, end } = calibrationState.calibrationLine;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      
      // Draw endpoints
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(start.x - 4, start.y - 4, 8, 8);
      ctx.fillRect(end.x - 4, end.y - 4, 8, 8);
    }

    ctx.restore();
  }, [
    measurements, 
    selectedMeasurementId, 
    scale, 
    offset, 
    drawingState, 
    calibrationState, 
    activeTool, 
    calculateDistance
  ]);

  useEffect(() => {
    renderMeasurements();
  }, [renderMeasurements]);

  const formatMeasurement = useCallback((measurement: MeasurementResult): string => {
    return `${measurement.value.toFixed(precision)} ${measurement.unit}`;
  }, [precision]);

  if (!isVisible) {
    return (
      <button 
        onClick={onToggleVisibility}
        className="measurement-toggle collapsed"
        title="Show measurement tools"
      >
        📏
      </button>
    );
  }

  return (
    <div className="measurement-toolkit">
      {/* Overlay Canvas */}
      <canvas
        ref={overlayCanvasRef}
        width={canvas?.width || 800}
        height={canvas?.height || 600}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 10
        }}
      />

      {/* Measurement Controls */}
      <div className="measurement-controls">
        <div className="controls-header">
          <h4>Measurement Tools</h4>
          <button onClick={onToggleVisibility} className="close-btn">✕</button>
        </div>

        {/* Tool Selection */}
        <div className="tool-selection">
          <h5>Tools</h5>
          <div className="tool-buttons">
            {measurementTools.map(({ tool, label, icon }) => (
              <button
                key={tool}
                className={`tool-btn ${activeTool === tool ? 'active' : ''}`}
                onClick={() => onToolChange(tool)}
                title={label}
              >
                <span className="tool-icon">{icon}</span>
                <span className="tool-label">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Unit Selection */}
        <div className="unit-selection">
          <h5>Units</h5>
          <select
            value={defaultUnit}
            onChange={(e) => onUnitChange(e.target.value as MeasurementUnit)}
            className="unit-select"
          >
            {units.map(unit => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
          
          <div className="precision-control">
            <label>Precision:</label>
            <input
              type="number"
              min="0"
              max="6"
              value={precision}
              onChange={(e) => setPrecision(parseInt(e.target.value))}
              className="precision-input"
            />
          </div>
        </div>

        {/* Calibration Status */}
        <div className="calibration-status">
          <h5>Calibration</h5>
          {calibration.isCalibrated ? (
            <div className="calibrated">
              <span className="status-indicator">✅ Calibrated</span>
              <div className="calibration-info">
                {calibration.pixelsPerUnit?.toFixed(2)} px/{calibration.unit}
              </div>
            </div>
          ) : (
            <div className="not-calibrated">
              <span className="status-indicator">❌ Not Calibrated</span>
              <p>Use calibrate tool to set scale</p>
            </div>
          )}
        </div>

        {/* Calibration Dialog */}
        {calibrationState.isCalibrating && calibrationState.calibrationLine && (
          <div className="calibration-dialog">
            <h5>Set Known Distance</h5>
            <div className="calibration-inputs">
              <input
                type="number"
                step="0.1"
                value={calibrationState.knownDistance}
                onChange={(e) => setCalibrationState(prev => ({
                  ...prev,
                  knownDistance: parseFloat(e.target.value)
                }))}
                placeholder="Enter known distance"
                className="distance-input"
              />
              <select
                value={calibrationState.knownUnit}
                onChange={(e) => setCalibrationState(prev => ({
                  ...prev,
                  knownUnit: e.target.value as MeasurementUnit
                }))}
                className="unit-select"
              >
                {units.filter(u => u.value !== 'px').map(unit => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="calibration-actions">
              <button onClick={completeCalibration} className="confirm-btn">
                Set Calibration
              </button>
              <button 
                onClick={() => setCalibrationState(prev => ({ ...prev, isCalibrating: false }))}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Measurements List */}
        <div className="measurements-list">
          <h5>Measurements ({measurements.length})</h5>
          {measurements.length > 0 ? (
            <div className="measurement-items">
              {measurements.map(measurement => (
                <div
                  key={measurement.id}
                  className={`measurement-item ${selectedMeasurementId === measurement.id ? 'selected' : ''}`}
                  onClick={() => setSelectedMeasurementId(
                    selectedMeasurementId === measurement.id ? null : measurement.id
                  )}
                >
                  <div className="measurement-header">
                    <span className="measurement-type">{measurement.type}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMeasurement(measurement.id);
                      }}
                      className="delete-btn"
                    >
                      🗑️
                    </button>
                  </div>
                  <div className="measurement-value">
                    {formatMeasurement(measurement)}
                  </div>
                  <div className="measurement-time">
                    {new Date(measurement.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-measurements">
              <p>No measurements yet</p>
              <p>Select a tool and start measuring</p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <button
            onClick={() => onMeasurementsChange([])}
            disabled={measurements.length === 0}
            className="clear-all-btn"
          >
            Clear All
          </button>
          <button
            onClick={() => {
              const data = {
                measurements,
                calibration,
                exportedAt: new Date().toISOString()
              };
              const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json'
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `measurements_${Date.now()}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            disabled={measurements.length === 0}
            className="export-btn"
          >
            Export
          </button>
        </div>
      </div>

      {/* Event Handlers */}
      <div
        className="measurement-overlay"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: activeTool === 'calibrate' ? 'crosshair' : 'default',
          pointerEvents: activeTool !== 'distance' && activeTool !== 'area' && 
                        activeTool !== 'perimeter' && activeTool !== 'angle' && 
                        activeTool !== 'radius' && activeTool !== 'calibrate' ? 'none' : 'all'
        }}
      />
    </div>
  );
};