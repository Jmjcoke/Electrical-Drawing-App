// Interactive Drawing Canvas with AI Overlays - Core component for Story 3.1

'use client';

import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useFabricCanvas } from '@/hooks/canvas/useFabricCanvas';
import { useAIAnalysisStore, useComponentDetectionsByConfidence } from '@/stores/aiAnalysisStore';
import { computerVisionService } from '@/services/ai/computerVision';
import { ComponentDetection, AnalysisOptions } from '@/types/ai/computerVision';
import { CanvasEventHandlers } from '@/types/canvas/fabricTypes';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Slider } from '@/components/ui/Slider';
import { Badge } from '@/components/ui/Badge';
import { AlertCircle, Zap, Eye, Settings, RotateCcw } from 'lucide-react';
import debounce from 'debounce';

interface InteractiveDrawingCanvasProps {
  drawingId: string;
  pdfUrl?: string;
  initialDetections?: ComponentDetection[];
  onComponentSelect?: (component: ComponentDetection) => void;
  onCanvasReady?: () => void;
  className?: string;
  width?: number;
  height?: number;
  enableRealTimeUpdates?: boolean;
  performanceMode?: boolean;
}

export const InteractiveDrawingCanvas: React.FC<InteractiveDrawingCanvasProps> = ({
  drawingId,
  pdfUrl,
  initialDetections = [],
  onComponentSelect,
  onCanvasReady,
  className,
  width = 1200,
  height = 800,
  enableRealTimeUpdates = true,
  performanceMode = false
}) => {
  // Store state
  const { 
    componentDetections,
    isProcessing,
    processingStage,
    confidence,
    confidenceThreshold,
    startAnalysis,
    clearAnalysis,
    setConfidenceThreshold
  } = useAIAnalysisStore();

  const filteredDetections = useComponentDetectionsByConfidence();

  // Local state
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Canvas event handlers
  const canvasEventHandlers: CanvasEventHandlers = useMemo(() => ({
    onComponentSelect: (component) => {
      console.log('Component selected:', component);
      onComponentSelect?.(component);
    },
    onComponentHover: (component) => {
      // Update hover state if needed
      console.log('Component hover:', component?.id);
    },
    onCanvasClick: (point) => {
      console.log('Canvas clicked at:', point);
    },
    onZoomChange: (zoom) => {
      console.log('Zoom changed to:', zoom);
    },
    onPanChange: (offset) => {
      console.log('Pan changed to:', offset);
    },
    onSelectionChange: (selection) => {
      console.log('Selection changed:', selection.components.length, 'components');
    }
  }), [onComponentSelect]);

  // Initialize Fabric.js canvas
  const {
    fabricCanvas,
    canvasRef,
    canvasState,
    addComponentOverlay,
    removeComponentOverlay,
    clearAllOverlays,
    zoomTo,
    panTo,
    fitToCanvas,
    resetView,
    selectComponent,
    clearSelection
  } = useFabricCanvas({
    width,
    height,
    enableSelection: true,
    enableZoom: true,
    backgroundColor: '#f8fafc',
    eventHandlers: canvasEventHandlers,
    performanceMode
  });

  // Initialize canvas and load PDF background
  useEffect(() => {
    if (fabricCanvas && !isCanvasReady) {
      setIsCanvasReady(true);
      onCanvasReady?.();

      // Load PDF as background if provided
      if (pdfUrl) {
        loadPDFBackground(pdfUrl);
      }

      // Load initial detections
      if (initialDetections.length > 0) {
        initialDetections.forEach(detection => {
          addComponentOverlay(detection);
        });
      }
    }
  }, [fabricCanvas, isCanvasReady, pdfUrl, initialDetections, addComponentOverlay, onCanvasReady]);

  // Update overlays when detections change
  useEffect(() => {
    if (!isCanvasReady || !fabricCanvas) return;

    // Clear existing overlays
    clearAllOverlays();

    // Add new overlays for filtered detections
    filteredDetections.forEach(detection => {
      try {
        addComponentOverlay(detection);
      } catch (error) {
        console.error('Error adding component overlay:', error);
      }
    });

    // Optimize rendering for performance
    if (performanceMode && filteredDetections.length > 50) {
      setTimeout(() => {
        fabricCanvas.requestRenderAll();
      }, 0);
    }
  }, [filteredDetections, isCanvasReady, fabricCanvas, clearAllOverlays, addComponentOverlay, performanceMode]);

  // Load PDF background
  const loadPDFBackground = useCallback(async (url: string) => {
    if (!fabricCanvas) return;

    try {
      // TODO: Implement PDF.js integration for background rendering
      console.log('Loading PDF background:', url);
      
      // Placeholder: Create a background rectangle
      const bgRect = new (window as any).fabric.Rect({
        left: 0,
        top: 0,
        width: width,
        height: height,
        fill: '#ffffff',
        stroke: '#e2e8f0',
        strokeWidth: 1,
        selectable: false,
        evented: false
      });
      
      fabricCanvas.add(bgRect);
      fabricCanvas.sendToBack(bgRect);
      fabricCanvas.requestRenderAll();
    } catch (error) {
      console.error('Error loading PDF background:', error);
      setAnalysisError('Failed to load drawing background');
    }
  }, [fabricCanvas, width, height]);

  // Start AI analysis
  const handleStartAnalysis = useCallback(async () => {
    if (!drawingId) return;

    try {
      setAnalysisError(null);
      
      const options: AnalysisOptions = {
        confidenceThreshold,
        includeText: true,
        enableCloudDetection: false,
        enableCircuitTracing: false
      };

      await startAnalysis(drawingId, options);
      
      // Start real-time analysis if enabled
      if (enableRealTimeUpdates) {
        // TODO: Initialize WebSocket connection for real-time updates
        console.log('Starting real-time updates for analysis');
      }
    } catch (error) {
      console.error('Analysis start error:', error);
      setAnalysisError(error instanceof Error ? error.message : 'Analysis failed');
    }
  }, [drawingId, confidenceThreshold, startAnalysis, enableRealTimeUpdates]);

  // Debounced confidence threshold change
  const debouncedThresholdChange = useMemo(
    () => debounce((threshold: number) => {
      setConfidenceThreshold(threshold);
    }, 300),
    [setConfidenceThreshold]
  );

  // Handle confidence threshold change
  const handleConfidenceChange = useCallback((values: number[]) => {
    debouncedThresholdChange(values[0]);
  }, [debouncedThresholdChange]);

  // Clear analysis and overlays
  const handleClearAnalysis = useCallback(() => {
    clearAnalysis();
    clearAllOverlays();
    setAnalysisError(null);
  }, [clearAnalysis, clearAllOverlays]);

  // Fit canvas to show all components
  const handleFitToComponents = useCallback(() => {
    if (filteredDetections.length > 0) {
      fitToCanvas();
    }
  }, [filteredDetections, fitToCanvas]);

  return (
    <div className={cn('flex flex-col space-y-4', className)}>
      {/* Canvas Controls */}
      {showControls && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-blue-600" />
                <span>AI Drawing Analysis</span>
              </span>
              <div className="flex items-center space-x-2">
                <Badge variant={isProcessing ? 'default' : 'secondary'}>
                  {isProcessing ? processingStage : 'Ready'}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowControls(false)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Analysis Controls */}
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <Button
                    onClick={handleStartAnalysis}
                    disabled={isProcessing || !drawingId}
                    size="sm"
                    className="flex-1"
                  >
                    {isProcessing ? 'Analyzing...' : 'Start Analysis'}
                  </Button>
                  <Button
                    onClick={handleClearAnalysis}
                    variant="outline"
                    size="sm"
                    disabled={isProcessing}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
                
                {analysisError && (
                  <div className="flex items-center space-x-2 text-red-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>{analysisError}</span>
                  </div>
                )}
              </div>

              {/* Confidence Threshold */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Confidence Threshold: {Math.round(confidenceThreshold * 100)}%
                </label>
                <Slider
                  value={[confidenceThreshold]}
                  onValueChange={handleConfidenceChange}
                  min={0.5}
                  max={0.95}
                  step={0.05}
                  className="w-full"
                />
              </div>

              {/* Detection Statistics */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Total Detections:</span>
                  <Badge variant="outline">{componentDetections.length}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Visible (>{Math.round(confidenceThreshold * 100)}%):</span>
                  <Badge variant="default">{filteredDetections.length}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Avg Confidence:</span>
                  <Badge variant="secondary">
                    {Math.round(confidence.overall * 100)}%
                  </Badge>
                </div>
              </div>
            </div>

            {/* Canvas Controls */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex space-x-2">
                <Button
                  onClick={handleFitToComponents}
                  variant="outline"
                  size="sm"
                  disabled={filteredDetections.length === 0}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Fit to Components
                </Button>
                <Button
                  onClick={resetView}
                  variant="outline"
                  size="sm"
                >
                  Reset View
                </Button>
                <Button
                  onClick={clearSelection}
                  variant="outline"
                  size="sm"
                >
                  Clear Selection
                </Button>
              </div>

              <div className="text-sm text-gray-500">
                Zoom: {Math.round(canvasState.zoom * 100)}% | 
                Objects: {canvasState.overlayObjects.size}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Minimized Controls */}
      {!showControls && (
        <div className="flex items-center justify-between p-2 bg-white border rounded-lg shadow-sm">
          <div className="flex items-center space-x-4">
            <Badge variant={isProcessing ? 'default' : 'secondary'}>
              {isProcessing ? processingStage : 'Ready'}
            </Badge>
            <span className="text-sm text-gray-600">
              {filteredDetections.length} components detected
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowControls(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Canvas Container */}
      <Card className="relative">
        <CardContent className="p-0">
          <div 
            className="relative overflow-hidden rounded-lg"
            style={{ width, height }}
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 cursor-default"
              style={{ 
                background: 'linear-gradient(45deg, #f8fafc 25%, transparent 25%), linear-gradient(-45deg, #f8fafc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f8fafc 75%), linear-gradient(-45deg, transparent 75%, #f8fafc 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
              }}
            />
            
            {/* Processing Overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <div className="text-sm font-medium">{processingStage}</div>
                  <div className="text-xs text-gray-600">
                    AI analysis in progress...
                  </div>
                </div>
              </div>
            )}

            {/* Canvas Ready Indicator */}
            {!isCanvasReady && (
              <div className="absolute inset-0 bg-gray-50 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <div className="text-sm text-gray-600">Loading canvas...</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Debug Info (Development only) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="text-xs text-gray-500 border rounded p-2">
          <summary>Debug Info</summary>
          <pre className="mt-2 whitespace-pre-wrap">
            {JSON.stringify({
              drawingId,
              isCanvasReady,
              isProcessing,
              processingStage,
              detectionsCount: componentDetections.length,
              filteredCount: filteredDetections.length,
              confidenceThreshold,
              canvasState: {
                zoom: canvasState.zoom,
                pan: canvasState.pan,
                overlayCount: canvasState.overlayObjects.size
              }
            }, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
};