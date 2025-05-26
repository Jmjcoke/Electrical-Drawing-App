import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Annotation, AnnotationTool, AnnotationStyle, Point, MeasurementUnit } from '../../types/annotations';

interface AnnotationCanvasProps {
  width: number;
  height: number;
  scale: number;
  activeTool: AnnotationTool;
  annotationStyle: AnnotationStyle;
  annotations: Annotation[];
  onAnnotationAdd: (annotation: Annotation) => void;
  onAnnotationUpdate: (id: string, updates: Partial<Annotation>) => void;
  onAnnotationDelete: (id: string) => void;
  measurementUnit: MeasurementUnit;
  isReadOnly?: boolean;
  selectedAnnotationId?: string;
  onAnnotationSelect: (id: string | null) => void;
}

interface DrawingState {
  isDrawing: boolean;
  startPoint: Point | null;
  currentPoint: Point | null;
  tempAnnotation: Annotation | null;
  textInput: string;
  isEditing: boolean;
}

export const AnnotationCanvas: React.FC<AnnotationCanvasProps> = ({
  width,
  height,
  scale,
  activeTool,
  annotationStyle,
  annotations,
  onAnnotationAdd,
  onAnnotationUpdate,
  onAnnotationDelete,
  measurementUnit,
  isReadOnly = false,
  selectedAnnotationId,
  onAnnotationSelect
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    startPoint: null,
    currentPoint: null,
    tempAnnotation: null,
    textInput: '',
    isEditing: false
  });

  const getMousePosition = useCallback((event: React.MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale
    };
  }, [scale]);

  const generateId = useCallback((): string => {
    return `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const calculateDistance = useCallback((p1: Point, p2: Point): number => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }, []);

  const formatMeasurement = useCallback((pixels: number): string => {
    const value = pixels; // In real app, convert based on scale
    return `${value.toFixed(2)} ${measurementUnit}`;
  }, [measurementUnit]);

  const createAnnotation = useCallback((
    type: AnnotationTool,
    startPoint: Point,
    endPoint: Point,
    additionalData?: any
  ): Annotation => {
    const id = generateId();
    const timestamp = new Date().toISOString();
    
    const baseAnnotation: Annotation = {
      id,
      type,
      points: [startPoint, endPoint],
      style: { ...annotationStyle },
      createdAt: timestamp,
      updatedAt: timestamp,
      authorId: 'current-user', // In real app, get from auth
      authorName: 'Current User'
    };

    switch (type) {
      case 'text':
        return {
          ...baseAnnotation,
          text: additionalData?.text || 'New Text',
          position: startPoint
        };
      
      case 'rectangle':
        return {
          ...baseAnnotation,
          bounds: {
            x: Math.min(startPoint.x, endPoint.x),
            y: Math.min(startPoint.y, endPoint.y),
            width: Math.abs(endPoint.x - startPoint.x),
            height: Math.abs(endPoint.y - startPoint.y)
          }
        };
      
      case 'circle':
        const radius = calculateDistance(startPoint, endPoint);
        return {
          ...baseAnnotation,
          center: startPoint,
          radius
        };
      
      case 'arrow':
      case 'line':
        return {
          ...baseAnnotation,
          startPoint,
          endPoint
        };
      
      case 'measurement':
        const distance = calculateDistance(startPoint, endPoint);
        return {
          ...baseAnnotation,
          startPoint,
          endPoint,
          measurement: {
            distance,
            unit: measurementUnit,
            displayText: formatMeasurement(distance)
          }
        };
      
      case 'freehand':
        return {
          ...baseAnnotation,
          points: additionalData?.points || [startPoint, endPoint],
          smoothed: true
        };
      
      case 'callout':
        return {
          ...baseAnnotation,
          text: additionalData?.text || 'Callout',
          position: startPoint,
          leaderPoint: endPoint
        };
      
      default:
        return baseAnnotation;
    }
  }, [annotationStyle, generateId, calculateDistance, formatMeasurement, measurementUnit]);

  const drawAnnotation = useCallback((
    ctx: CanvasRenderingContext2D,
    annotation: Annotation,
    isSelected = false,
    isTemp = false
  ) => {
    ctx.save();
    
    const style = annotation.style;
    ctx.strokeStyle = style.strokeColor;
    ctx.fillStyle = style.fillColor;
    ctx.lineWidth = style.strokeWidth;
    ctx.globalAlpha = isTemp ? 0.7 : 1;
    ctx.font = `${style.fontSize}px Arial`;
    
    if (style.lineDash) {
      ctx.setLineDash(style.lineDash);
    }

    if (isSelected) {
      ctx.shadowColor = '#0099FF';
      ctx.shadowBlur = 5;
    }

    switch (annotation.type) {
      case 'text':
        if (annotation.text && annotation.position) {
          ctx.fillStyle = style.strokeColor;
          ctx.fillText(annotation.text, annotation.position.x, annotation.position.y);
        }
        break;
      
      case 'rectangle':
        if (annotation.bounds) {
          const { x, y, width, height } = annotation.bounds;
          if (style.fillOpacity > 0) {
            ctx.globalAlpha = style.fillOpacity;
            ctx.fillRect(x, y, width, height);
            ctx.globalAlpha = 1;
          }
          ctx.strokeRect(x, y, width, height);
        }
        break;
      
      case 'circle':
        if (annotation.center && annotation.radius) {
          ctx.beginPath();
          ctx.arc(annotation.center.x, annotation.center.y, annotation.radius, 0, 2 * Math.PI);
          if (style.fillOpacity > 0) {
            ctx.globalAlpha = style.fillOpacity;
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          ctx.stroke();
        }
        break;
      
      case 'line':
        if (annotation.startPoint && annotation.endPoint) {
          ctx.beginPath();
          ctx.moveTo(annotation.startPoint.x, annotation.startPoint.y);
          ctx.lineTo(annotation.endPoint.x, annotation.endPoint.y);
          ctx.stroke();
        }
        break;
      
      case 'arrow':
        if (annotation.startPoint && annotation.endPoint) {
          const { startPoint, endPoint } = annotation;
          const headLength = 10;
          const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
          
          // Draw line
          ctx.beginPath();
          ctx.moveTo(startPoint.x, startPoint.y);
          ctx.lineTo(endPoint.x, endPoint.y);
          ctx.stroke();
          
          // Draw arrowhead
          ctx.beginPath();
          ctx.moveTo(endPoint.x, endPoint.y);
          ctx.lineTo(
            endPoint.x - headLength * Math.cos(angle - Math.PI / 6),
            endPoint.y - headLength * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(endPoint.x, endPoint.y);
          ctx.lineTo(
            endPoint.x - headLength * Math.cos(angle + Math.PI / 6),
            endPoint.y - headLength * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
        }
        break;
      
      case 'measurement':
        if (annotation.startPoint && annotation.endPoint && annotation.measurement) {
          const { startPoint, endPoint } = annotation;
          
          // Draw measurement line
          ctx.beginPath();
          ctx.moveTo(startPoint.x, startPoint.y);
          ctx.lineTo(endPoint.x, endPoint.y);
          ctx.stroke();
          
          // Draw measurement text
          const midX = (startPoint.x + endPoint.x) / 2;
          const midY = (startPoint.y + endPoint.y) / 2;
          ctx.fillStyle = style.strokeColor;
          ctx.fillText(annotation.measurement.displayText, midX, midY - 5);
          
          // Draw end markers
          const markerSize = 3;
          ctx.fillRect(startPoint.x - markerSize, startPoint.y - markerSize, markerSize * 2, markerSize * 2);
          ctx.fillRect(endPoint.x - markerSize, endPoint.y - markerSize, markerSize * 2, markerSize * 2);
        }
        break;
      
      case 'freehand':
        if (annotation.points && annotation.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
          for (let i = 1; i < annotation.points.length; i++) {
            ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
          }
          ctx.stroke();
        }
        break;
      
      case 'callout':
        if (annotation.text && annotation.position && annotation.leaderPoint) {
          // Draw leader line
          ctx.beginPath();
          ctx.moveTo(annotation.position.x, annotation.position.y);
          ctx.lineTo(annotation.leaderPoint.x, annotation.leaderPoint.y);
          ctx.stroke();
          
          // Draw text background
          const textMetrics = ctx.measureText(annotation.text);
          const padding = 4;
          ctx.fillStyle = 'white';
          ctx.fillRect(
            annotation.position.x - padding,
            annotation.position.y - style.fontSize - padding,
            textMetrics.width + padding * 2,
            style.fontSize + padding * 2
          );
          ctx.strokeRect(
            annotation.position.x - padding,
            annotation.position.y - style.fontSize - padding,
            textMetrics.width + padding * 2,
            style.fontSize + padding * 2
          );
          
          // Draw text
          ctx.fillStyle = style.strokeColor;
          ctx.fillText(annotation.text, annotation.position.x, annotation.position.y);
        }
        break;
    }
    
    ctx.restore();
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.scale(scale, scale);

    // Draw all annotations
    annotations.forEach(annotation => {
      const isSelected = annotation.id === selectedAnnotationId;
      drawAnnotation(ctx, annotation, isSelected);
    });

    // Draw temporary annotation while drawing
    if (drawingState.tempAnnotation) {
      drawAnnotation(ctx, drawingState.tempAnnotation, false, true);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [width, height, scale, annotations, selectedAnnotationId, drawingState.tempAnnotation, drawAnnotation]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (isReadOnly || activeTool === 'select' || activeTool === 'pan') return;

    const point = getMousePosition(event);
    
    setDrawingState(prev => ({
      ...prev,
      isDrawing: true,
      startPoint: point,
      currentPoint: point
    }));

    if (activeTool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        const annotation = createAnnotation('text', point, point, { text });
        onAnnotationAdd(annotation);
      }
    }
  }, [isReadOnly, activeTool, getMousePosition, createAnnotation, onAnnotationAdd]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!drawingState.isDrawing || !drawingState.startPoint || isReadOnly) return;

    const currentPoint = getMousePosition(event);
    
    if (activeTool !== 'freehand') {
      const tempAnnotation = createAnnotation(
        activeTool,
        drawingState.startPoint,
        currentPoint
      );
      
      setDrawingState(prev => ({
        ...prev,
        currentPoint,
        tempAnnotation
      }));
    } else {
      // For freehand, add points to the current annotation
      setDrawingState(prev => {
        if (prev.tempAnnotation && prev.tempAnnotation.points) {
          const updatedAnnotation = {
            ...prev.tempAnnotation,
            points: [...prev.tempAnnotation.points, currentPoint]
          };
          return {
            ...prev,
            currentPoint,
            tempAnnotation: updatedAnnotation
          };
        }
        return { ...prev, currentPoint };
      });
    }
  }, [drawingState.isDrawing, drawingState.startPoint, isReadOnly, getMousePosition, activeTool, createAnnotation]);

  const handleMouseUp = useCallback(() => {
    if (!drawingState.isDrawing || !drawingState.startPoint || !drawingState.currentPoint) return;

    if (activeTool === 'callout') {
      const text = prompt('Enter callout text:');
      if (text) {
        const annotation = createAnnotation(
          'callout',
          drawingState.startPoint,
          drawingState.currentPoint,
          { text }
        );
        onAnnotationAdd(annotation);
      }
    } else if (drawingState.tempAnnotation) {
      onAnnotationAdd(drawingState.tempAnnotation);
    }

    setDrawingState({
      isDrawing: false,
      startPoint: null,
      currentPoint: null,
      tempAnnotation: null,
      textInput: '',
      isEditing: false
    });
  }, [drawingState, activeTool, createAnnotation, onAnnotationAdd]);

  const handleClick = useCallback((event: React.MouseEvent) => {
    if (activeTool !== 'select') return;

    const point = getMousePosition(event);
    let clickedAnnotation: Annotation | null = null;

    // Find annotation at click point (simplified hit testing)
    for (const annotation of annotations) {
      if (annotation.bounds) {
        const { x, y, width, height } = annotation.bounds;
        if (point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height) {
          clickedAnnotation = annotation;
          break;
        }
      } else if (annotation.position) {
        const distance = calculateDistance(point, annotation.position);
        if (distance < 20) {
          clickedAnnotation = annotation;
          break;
        }
      }
    }

    onAnnotationSelect(clickedAnnotation ? clickedAnnotation.id : null);
  }, [activeTool, getMousePosition, annotations, calculateDistance, onAnnotationSelect]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' && selectedAnnotationId) {
        onAnnotationDelete(selectedAnnotationId);
        onAnnotationSelect(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAnnotationId, onAnnotationDelete, onAnnotationSelect]);

  return (
    <div className="annotation-canvas-container" ref={overlayRef}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: isReadOnly ? 'none' : 'all',
          cursor: activeTool === 'pan' ? 'grab' : activeTool === 'select' ? 'pointer' : 'crosshair'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      />
    </div>
  );
};