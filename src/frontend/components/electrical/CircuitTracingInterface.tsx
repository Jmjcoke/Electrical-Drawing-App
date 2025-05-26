/**
 * Interactive Circuit Tracing Interface
 * 
 * Enables click-to-trace functionality with visual path highlighting and circuit analysis
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { 
  ZapIcon, 
  RouteIcon,
  PlayIcon,
  PauseIcon,
  SquareIcon,
  SettingsIcon,
  EyeIcon,
  EyeOffIcon,
  FilterIcon,
  InfoIcon,
  AlertTriangleIcon,
  CheckCircleIcon
} from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface CircuitElement {
  id: string;
  type: 'wire' | 'junction' | 'terminal' | 'component';
  points: Point[];
  connections: string[];
  properties: Record<string, any>;
  confidence: number;
}

interface CircuitPath {
  id: string;
  elements: string[];
  start_point: Point;
  end_point: Point;
  circuit_type: string;
  voltage_level?: number;
  properties: Record<string, any>;
}

interface CircuitNetwork {
  id: string;
  elements: CircuitElement[];
  paths: CircuitPath[];
  junctions: Point[];
  topology: Record<string, any>;
  analysis_time: number;
}

interface TracingState {
  isActive: boolean;
  mode: 'single' | 'multi' | 'continuous';
  startPoint?: Point;
  endPoint?: Point;
  activePaths: string[];
  highlightedElements: Set<string>;
}

interface CircuitTracingInterfaceProps {
  canvas: HTMLCanvasElement | null;
  circuitNetwork?: CircuitNetwork;
  onPathTrace?: (pathId: string, elements: CircuitElement[]) => void;
  onElementSelect?: (elementId: string) => void;
  className?: string;
}

const CircuitTracingInterface: React.FC<CircuitTracingInterfaceProps> = ({
  canvas,
  circuitNetwork,
  onPathTrace,
  onElementSelect,
  className = ''
}) => {
  // State management
  const [tracingState, setTracingState] = useState<TracingState>({
    isActive: false,
    mode: 'single',
    activePaths: [],
    highlightedElements: new Set()
  });

  const [visualization, setVisualization] = useState({
    showJunctions: true,
    showTerminals: true,
    showWires: true,
    showLabels: true,
    colorByType: true,
    animateTracing: true
  });

  const [selectedElement, setSelectedElement] = useState<CircuitElement | null>(null);
  const [traceResults, setTraceResults] = useState<{
    path?: CircuitPath;
    analysis?: Record<string, any>;
    warnings?: string[];
  }>({});

  // Refs
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Colors for different circuit types
  const circuitColors = useMemo(() => ({
    power: '#ff4444',
    control: '#4444ff',
    data: '#44ff44',
    ground: '#ffaa00',
    unknown: '#888888'
  }), []);

  // Initialize overlay canvas
  useEffect(() => {
    if (!canvas || !overlayCanvasRef.current) return;

    const overlay = overlayCanvasRef.current;
    overlay.width = canvas.width;
    overlay.height = canvas.height;
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.pointerEvents = tracingState.isActive ? 'auto' : 'none';

    // Position overlay over main canvas
    const canvasRect = canvas.getBoundingClientRect();
    overlay.style.width = `${canvasRect.width}px`;
    overlay.style.height = `${canvasRect.height}px`;

  }, [canvas, tracingState.isActive]);

  // Render circuit network on overlay
  useEffect(() => {
    if (!overlayCanvasRef.current || !circuitNetwork) return;

    renderCircuitNetwork();
  }, [circuitNetwork, visualization, tracingState.highlightedElements]);

  const renderCircuitNetwork = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay || !circuitNetwork) return;

    const ctx = overlay.getContext('2d')!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    // Set up rendering context
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#666666';
    ctx.fillStyle = '#666666';

    // Render wires
    if (visualization.showWires) {
      circuitNetwork.elements
        .filter(element => element.type === 'wire')
        .forEach(wire => renderWire(ctx, wire, overlay.width, overlay.height));
    }

    // Render junctions
    if (visualization.showJunctions) {
      circuitNetwork.elements
        .filter(element => element.type === 'junction')
        .forEach(junction => renderJunction(ctx, junction, overlay.width, overlay.height));
    }

    // Render terminals
    if (visualization.showTerminals) {
      circuitNetwork.elements
        .filter(element => element.type === 'terminal')
        .forEach(terminal => renderTerminal(ctx, terminal, overlay.width, overlay.height));
    }

    // Render highlighted paths
    tracingState.activePaths.forEach(pathId => {
      const path = circuitNetwork.paths.find(p => p.id === pathId);
      if (path) {
        renderHighlightedPath(ctx, path, overlay.width, overlay.height);
      }
    });

  }, [circuitNetwork, visualization, tracingState]);

  const renderWire = (ctx: CanvasRenderingContext2D, wire: CircuitElement, width: number, height: number) => {
    if (wire.points.length < 2) return;

    const isHighlighted = tracingState.highlightedElements.has(wire.id);
    
    ctx.beginPath();
    ctx.strokeStyle = isHighlighted ? '#ff6600' : (visualization.colorByType ? '#444444' : '#666666');
    ctx.lineWidth = isHighlighted ? 4 : 2;

    // Draw line segments
    ctx.moveTo(wire.points[0].x * width, wire.points[0].y * height);
    for (let i = 1; i < wire.points.length; i++) {
      ctx.lineTo(wire.points[i].x * width, wire.points[i].y * height);
    }
    ctx.stroke();

    // Add wire labels if enabled
    if (visualization.showLabels && isHighlighted) {
      const midPoint = wire.points[Math.floor(wire.points.length / 2)];
      ctx.fillStyle = '#333333';
      ctx.font = '12px Arial';
      ctx.fillText(
        `Wire ${wire.id.slice(0, 8)}`,
        midPoint.x * width + 5,
        midPoint.y * height - 5
      );
    }
  };

  const renderJunction = (ctx: CanvasRenderingContext2D, junction: CircuitElement, width: number, height: number) => {
    if (junction.points.length === 0) return;

    const point = junction.points[0];
    const x = point.x * width;
    const y = point.y * height;
    const isHighlighted = tracingState.highlightedElements.has(junction.id);

    ctx.beginPath();
    ctx.arc(x, y, isHighlighted ? 8 : 5, 0, 2 * Math.PI);
    ctx.fillStyle = isHighlighted ? '#ff6600' : '#ff4444';
    ctx.fill();
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Junction label
    if (visualization.showLabels) {
      ctx.fillStyle = '#333333';
      ctx.font = '10px Arial';
      ctx.fillText(`J${junction.properties.connection_count || '?'}`, x + 10, y - 10);
    }
  };

  const renderTerminal = (ctx: CanvasRenderingContext2D, terminal: CircuitElement, width: number, height: number) => {
    if (terminal.points.length === 0) return;

    const point = terminal.points[0];
    const x = point.x * width;
    const y = point.y * height;
    const isHighlighted = tracingState.highlightedElements.has(terminal.id);

    ctx.beginPath();
    ctx.rect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = isHighlighted ? '#ff6600' : '#4444ff';
    ctx.fill();
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  const renderHighlightedPath = (ctx: CanvasRenderingContext2D, path: CircuitPath, width: number, height: number) => {
    const color = circuitColors[path.circuit_type as keyof typeof circuitColors] || circuitColors.unknown;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.7;

    // Animate path highlighting if enabled
    if (visualization.animateTracing) {
      // This would implement animated path tracing
      // For now, just render static highlight
    }

    // Draw path outline
    path.elements.forEach(elementId => {
      const element = circuitNetwork?.elements.find(e => e.id === elementId);
      if (element && element.type === 'wire' && element.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(element.points[0].x * width, element.points[0].y * height);
        for (let i = 1; i < element.points.length; i++) {
          ctx.lineTo(element.points[i].x * width, element.points[i].y * height);
        }
        ctx.stroke();
      }
    });

    ctx.globalAlpha = 1.0;
  };

  // Handle canvas clicks for tracing
  const handleCanvasClick = useCallback((event: MouseEvent) => {
    if (!tracingState.isActive || !canvas || !overlayCanvasRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const clickPoint: Point = { x, y };

    // Find nearest circuit element
    const nearestElement = findNearestElement(clickPoint);
    
    if (nearestElement) {
      if (!tracingState.startPoint) {
        // Set start point
        setTracingState(prev => ({
          ...prev,
          startPoint: clickPoint,
          highlightedElements: new Set([nearestElement.id])
        }));
        setSelectedElement(nearestElement);
      } else {
        // Set end point and trace path
        setTracingState(prev => ({
          ...prev,
          endPoint: clickPoint
        }));
        
        traceCircuitPath(tracingState.startPoint!, clickPoint, nearestElement);
      }
    }
  }, [tracingState, canvas, circuitNetwork]);

  const findNearestElement = (clickPoint: Point): CircuitElement | null => {
    if (!circuitNetwork) return null;

    let nearest: CircuitElement | null = null;
    let minDistance = Infinity;

    circuitNetwork.elements.forEach(element => {
      element.points.forEach(point => {
        const distance = Math.sqrt(
          Math.pow(point.x - clickPoint.x, 2) + Math.pow(point.y - clickPoint.y, 2)
        );
        
        if (distance < minDistance && distance < 0.02) { // 2% of image size
          minDistance = distance;
          nearest = element;
        }
      });
    });

    return nearest;
  };

  const traceCircuitPath = async (startPoint: Point, endPoint: Point, endElement: CircuitElement) => {
    try {
      // This would call the circuit analysis API to trace the path
      // For now, simulate path tracing
      
      const mockPath: CircuitPath = {
        id: `path-${Date.now()}`,
        elements: [selectedElement?.id || '', endElement.id],
        start_point: startPoint,
        end_point: endPoint,
        circuit_type: 'power',
        voltage_level: 120,
        properties: {
          length: Math.sqrt(Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2)),
          complexity: 1.0
        }
      };

      setTraceResults({
        path: mockPath,
        analysis: {
          voltage_drop: 2.4,
          current_capacity: 20,
          power_rating: 2400,
          circuit_length: mockPath.properties.length * 100 // Convert to feet
        },
        warnings: []
      });

      setTracingState(prev => ({
        ...prev,
        activePaths: [...prev.activePaths, mockPath.id],
        highlightedElements: new Set([...prev.highlightedElements, endElement.id])
      }));

      onPathTrace?.(mockPath.id, [selectedElement!, endElement]);

    } catch (error) {
      console.error('Error tracing circuit path:', error);
      setTraceResults({
        warnings: ['Failed to trace circuit path. Please try again.']
      });
    }
  };

  // Attach event listeners
  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay || !tracingState.isActive) return;

    overlay.addEventListener('click', handleCanvasClick);
    
    return () => {
      overlay.removeEventListener('click', handleCanvasClick);
    };
  }, [handleCanvasClick, tracingState.isActive]);

  const startTracing = (mode: 'single' | 'multi' | 'continuous') => {
    setTracingState({
      isActive: true,
      mode,
      activePaths: [],
      highlightedElements: new Set()
    });
    setSelectedElement(null);
    setTraceResults({});
  };

  const stopTracing = () => {
    setTracingState(prev => ({
      ...prev,
      isActive: false,
      startPoint: undefined,
      endPoint: undefined
    }));
  };

  const clearTraces = () => {
    setTracingState(prev => ({
      ...prev,
      activePaths: [],
      highlightedElements: new Set(),
      startPoint: undefined,
      endPoint: undefined
    }));
    setTraceResults({});
  };

  const renderTraceControls = () => (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <RouteIcon className="w-4 h-4" />
          Circuit Tracing Controls
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant={tracingState.isActive ? 'default' : 'outline'}
            size="sm"
            onClick={() => tracingState.isActive ? stopTracing() : startTracing('single')}
          >
            {tracingState.isActive ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
            {tracingState.isActive ? 'Stop' : 'Start'} Tracing
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={clearTraces}
            disabled={tracingState.activePaths.length === 0}
          >
            <SquareIcon className="w-4 h-4" />
            Clear Traces
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Button
            variant={tracingState.mode === 'single' ? 'default' : 'outline'}
            size="sm"
            onClick={() => startTracing('single')}
            className="text-xs"
          >
            Single Path
          </Button>
          <Button
            variant={tracingState.mode === 'multi' ? 'default' : 'outline'}
            size="sm"
            onClick={() => startTracing('multi')}
            className="text-xs"
          >
            Multi Path
          </Button>
          <Button
            variant={tracingState.mode === 'continuous' ? 'default' : 'outline'}
            size="sm"
            onClick={() => startTracing('continuous')}
            className="text-xs"
          >
            Continuous
          </Button>
        </div>

        {tracingState.isActive && !tracingState.startPoint && (
          <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
            Click on a circuit element to start tracing
          </div>
        )}

        {tracingState.isActive && tracingState.startPoint && !tracingState.endPoint && (
          <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded">
            Click on another element to complete the trace
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderVisualizationControls = () => (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <EyeIcon className="w-4 h-4" />
          Visualization Options
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Object.entries(visualization).map(([key, value]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => setVisualization(prev => ({
                  ...prev,
                  [key]: e.target.checked
                }))}
                className="rounded border-gray-300"
              />
              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const renderTraceResults = () => {
    if (!traceResults.path && !traceResults.warnings?.length) return null;

    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <InfoIcon className="w-4 h-4" />
            Trace Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {traceResults.warnings?.map((warning, index) => (
            <div key={index} className="flex items-center gap-2 text-sm text-orange-600 mb-2">
              <AlertTriangleIcon className="w-4 h-4" />
              {warning}
            </div>
          ))}

          {traceResults.path && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {traceResults.path.circuit_type.toUpperCase()}
                </Badge>
                {traceResults.path.voltage_level && (
                  <Badge variant="secondary">
                    {traceResults.path.voltage_level}V
                  </Badge>
                )}
              </div>

              {traceResults.analysis && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>Voltage Drop: {traceResults.analysis.voltage_drop}V</div>
                  <div>Current: {traceResults.analysis.current_capacity}A</div>
                  <div>Power: {traceResults.analysis.power_rating}W</div>
                  <div>Length: {traceResults.analysis.circuit_length?.toFixed(1)}ft</div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className={className}>
      {/* Overlay canvas for circuit visualization */}
      <canvas
        ref={overlayCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: tracingState.isActive ? 'auto' : 'none',
          cursor: tracingState.isActive ? 'crosshair' : 'default'
        }}
      />

      {/* Controls and results panel */}
      <div className="absolute top-4 right-4 w-80 space-y-4">
        {renderTraceControls()}
        {renderVisualizationControls()}
        {renderTraceResults()}

        {/* Circuit network stats */}
        {circuitNetwork && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Network Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>Elements: {circuitNetwork.elements.length}</div>
                <div>Paths: {circuitNetwork.paths.length}</div>
                <div>Junctions: {circuitNetwork.junctions.length}</div>
                <div>Analysis: {circuitNetwork.analysis_time.toFixed(2)}s</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CircuitTracingInterface;