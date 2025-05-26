import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Eye, 
  Edit, 
  Plus, 
  Minus, 
  RotateCcw, 
  Save, 
  Settings, 
  ZoomIn, 
  ZoomOut,
  Square,
  Circle,
  MousePointer,
  Trash2,
  Download
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Slider } from '../ui/Slider';
import { Switch } from '../ui/Switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Separator } from '../ui/Separator';
import { Alert, AlertDescription } from '../ui/Alert';
import { cn } from '../../lib/utils';

interface CloudArea {
  id: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  patternType: string;
  isManual: boolean;
  isActive: boolean;
}

interface CloudDetectionResult {
  drawingId: string;
  imageUrl: string;
  originalWidth: number;
  originalHeight: number;
  clouds: CloudArea[];
  detectionSettings: {
    sensitivity: number;
    cadSystem: string;
    visualizationMode: string;
  };
}

interface CloudDetectionViewerProps {
  result: CloudDetectionResult;
  onUpdate?: (clouds: CloudArea[]) => void;
  onSave?: (clouds: CloudArea[]) => void;
  className?: string;
}

type EditMode = 'view' | 'select' | 'add-rectangle' | 'add-circle' | 'add-polygon';

export const CloudDetectionViewer: React.FC<CloudDetectionViewerProps> = ({
  result,
  onUpdate,
  onSave,
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [clouds, setClouds] = useState<CloudArea[]>(result.clouds);
  const [selectedCloudId, setSelectedCloudId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<EditMode>('view');
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState<Partial<CloudArea> | null>(null);
  const [showConfidenceThreshold, setShowConfidenceThreshold] = useState(0.5);
  const [showOnlyManual, setShowOnlyManual] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load and draw the image and clouds
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Set canvas size
      canvas.width = img.width * zoom;
      canvas.height = img.height * zoom;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw image
      ctx.save();
      ctx.translate(panOffset.x, panOffset.y);
      ctx.scale(zoom, zoom);
      ctx.drawImage(img, 0, 0);
      ctx.restore();

      // Draw cloud overlays
      drawCloudOverlays(ctx, img.width, img.height);
    };
    img.src = result.imageUrl;
  }, [result.imageUrl, clouds, zoom, panOffset, showConfidenceThreshold, showOnlyManual, selectedCloudId]);

  const drawCloudOverlays = (ctx: CanvasRenderingContext2D, imgWidth: number, imgHeight: number) => {
    const filteredClouds = clouds.filter(cloud => {
      if (showOnlyManual && !cloud.isManual) return false;
      if (cloud.confidence < showConfidenceThreshold) return false;
      return true;
    });

    filteredClouds.forEach(cloud => {
      const { boundingBox, confidence, isManual, id } = cloud;
      const isSelected = selectedCloudId === id;

      ctx.save();
      ctx.translate(panOffset.x, panOffset.y);
      ctx.scale(zoom, zoom);

      // Calculate scaled coordinates
      const x = (boundingBox.x / result.originalWidth) * imgWidth;
      const y = (boundingBox.y / result.originalHeight) * imgHeight;
      const width = (boundingBox.width / result.originalWidth) * imgWidth;
      const height = (boundingBox.height / result.originalHeight) * imgHeight;

      // Set overlay style
      if (isManual) {
        ctx.strokeStyle = '#10b981'; // Green for manual
        ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
      } else {
        ctx.strokeStyle = isSelected ? '#3b82f6' : '#f59e0b'; // Blue if selected, amber for auto
        ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.1)';
      }

      ctx.lineWidth = isSelected ? 3 : 2;

      // Draw bounding box
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);

      // Draw confidence score if not manual
      if (!isManual && confidence !== undefined) {
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.fillText(`${Math.round(confidence * 100)}%`, x + 5, y + 15);
      }

      // Draw selection handles if selected
      if (isSelected && editMode === 'select') {
        const handleSize = 6;
        ctx.fillStyle = '#3b82f6';
        
        // Corner handles
        ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
        ctx.fillRect(x + width - handleSize/2, y - handleSize/2, handleSize, handleSize);
        ctx.fillRect(x - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
        ctx.fillRect(x + width - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
      }

      ctx.restore();
    });

    // Draw current drawing shape
    if (currentDrawing && isDrawing) {
      const { boundingBox } = currentDrawing;
      if (boundingBox) {
        ctx.save();
        ctx.translate(panOffset.x, panOffset.y);
        ctx.scale(zoom, zoom);

        const x = (boundingBox.x / result.originalWidth) * imgWidth;
        const y = (boundingBox.y / result.originalHeight) * imgHeight;
        const width = (boundingBox.width / result.originalWidth) * imgWidth;
        const height = (boundingBox.height / result.originalHeight) * imgHeight;

        ctx.strokeStyle = '#6366f1';
        ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        ctx.fillRect(x, y, width, height);
        ctx.strokeRect(x, y, width, height);

        ctx.restore();
      }
    }
  };

  const getMousePosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left - panOffset.x) / zoom) * (result.originalWidth / canvas.width * zoom);
    const y = ((e.clientY - rect.top - panOffset.y) / zoom) * (result.originalHeight / canvas.height * zoom);
    
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePosition(e);
    setLastMousePos(pos);

    if (editMode === 'select') {
      // Check if clicking on existing cloud
      const clickedCloud = clouds.find(cloud => {
        const { boundingBox } = cloud;
        return pos.x >= boundingBox.x && 
               pos.x <= boundingBox.x + boundingBox.width &&
               pos.y >= boundingBox.y && 
               pos.y <= boundingBox.y + boundingBox.height;
      });

      if (clickedCloud) {
        setSelectedCloudId(clickedCloud.id);
      } else {
        setSelectedCloudId(null);
      }
    } else if (editMode === 'add-rectangle' || editMode === 'add-circle') {
      // Start drawing new cloud
      setIsDrawing(true);
      setCurrentDrawing({
        id: `manual-${Date.now()}`,
        boundingBox: {
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0
        },
        confidence: 1.0,
        patternType: 'manual',
        isManual: true,
        isActive: true
      });
    } else if (editMode === 'view') {
      // Start panning
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePosition(e);

    if (isDrawing && currentDrawing) {
      // Update drawing dimensions
      const startX = currentDrawing.boundingBox!.x;
      const startY = currentDrawing.boundingBox!.y;
      
      setCurrentDrawing(prev => ({
        ...prev!,
        boundingBox: {
          x: Math.min(startX, pos.x),
          y: Math.min(startY, pos.y),
          width: Math.abs(pos.x - startX),
          height: Math.abs(pos.y - startY)
        }
      }));
    } else if (isDragging && editMode === 'view') {
      // Update pan offset
      const deltaX = pos.x - lastMousePos.x;
      const deltaY = pos.y - lastMousePos.y;
      
      setPanOffset(prev => ({
        x: prev.x + deltaX * zoom,
        y: prev.y + deltaY * zoom
      }));
    }

    setLastMousePos(pos);
  };

  const handleMouseUp = () => {
    if (isDrawing && currentDrawing && currentDrawing.boundingBox) {
      // Minimum size validation
      if (currentDrawing.boundingBox.width > 10 && currentDrawing.boundingBox.height > 10) {
        const newCloud: CloudArea = {
          ...currentDrawing as CloudArea
        };
        
        setClouds(prev => [...prev, newCloud]);
        setHasUnsavedChanges(true);
        onUpdate?.(clouds);
      }
      
      setIsDrawing(false);
      setCurrentDrawing(null);
    }
    
    setIsDragging(false);
  };

  const handleDeleteSelected = () => {
    if (selectedCloudId) {
      setClouds(prev => prev.filter(cloud => cloud.id !== selectedCloudId));
      setSelectedCloudId(null);
      setHasUnsavedChanges(true);
      onUpdate?.(clouds);
    }
  };

  const handleSave = () => {
    onSave?.(clouds);
    setHasUnsavedChanges(false);
  };

  const resetView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const zoomIn = () => setZoom(prev => Math.min(prev * 1.5, 5));
  const zoomOut = () => setZoom(prev => Math.max(prev / 1.5, 0.1));

  const getEditModeIcon = (mode: EditMode) => {
    switch (mode) {
      case 'view': return <MousePointer className="h-4 w-4" />;
      case 'select': return <MousePointer className="h-4 w-4" />;
      case 'add-rectangle': return <Square className="h-4 w-4" />;
      case 'add-circle': return <Circle className="h-4 w-4" />;
      default: return <MousePointer className="h-4 w-4" />;
    }
  };

  const cloudStats = {
    total: clouds.length,
    manual: clouds.filter(c => c.isManual).length,
    automatic: clouds.filter(c => !c.isManual).length,
    highConfidence: clouds.filter(c => c.confidence > 0.8).length
  };

  return (
    <div className={cn('grid grid-cols-1 lg:grid-cols-4 gap-6', className)}>
      {/* Main Canvas Area */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Cloud Detection Results</CardTitle>
              <div className="flex items-center space-x-2">
                {hasUnsavedChanges && (
                  <Badge variant="outline" className="text-amber-600">
                    Unsaved Changes
                  </Badge>
                )}
                <Badge variant="outline">
                  {cloudStats.total} clouds
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4 p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 border rounded">
                  <Button
                    variant={editMode === 'view' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setEditMode('view')}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={editMode === 'select' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setEditMode('select')}
                  >
                    <MousePointer className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={editMode === 'add-rectangle' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setEditMode('add-rectangle')}
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={editMode === 'add-circle' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setEditMode('add-circle')}
                  >
                    <Circle className="h-4 w-4" />
                  </Button>
                </div>

                <Separator orientation="vertical" className="h-6" />

                <div className="flex items-center space-x-1">
                  <Button variant="ghost" size="sm" onClick={zoomOut}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-mono min-w-[60px] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <Button variant="ghost" size="sm" onClick={zoomIn}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={resetView}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {selectedCloudId && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteSelected}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasUnsavedChanges}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>

            {/* Canvas Container */}
            <div 
              ref={containerRef}
              className="border rounded-lg overflow-auto bg-gray-100"
              style={{ height: '600px' }}
            >
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="cursor-crosshair"
                style={{
                  cursor: editMode === 'view' ? 'grab' : 
                         editMode === 'select' ? 'pointer' : 'crosshair'
                }}
              />
            </div>

            {/* Mode Instructions */}
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                {editMode === 'view' && "View mode: Drag to pan the image"}
                {editMode === 'select' && "Select mode: Click on cloud areas to select and edit them"}
                {editMode === 'add-rectangle' && "Add Rectangle: Click and drag to draw rectangular cloud areas"}
                {editMode === 'add-circle' && "Add Circle: Click and drag to draw circular cloud areas"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Panel */}
      <div className="space-y-6">
        {/* Cloud List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detected Clouds</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Statistics */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-gray-50 rounded">
                <span className="font-medium">Total:</span> {cloudStats.total}
              </div>
              <div className="p-2 bg-green-50 rounded">
                <span className="font-medium">Manual:</span> {cloudStats.manual}
              </div>
              <div className="p-2 bg-amber-50 rounded">
                <span className="font-medium">Auto:</span> {cloudStats.automatic}
              </div>
              <div className="p-2 bg-blue-50 rounded">
                <span className="font-medium">High Conf:</span> {cloudStats.highConfidence}
              </div>
            </div>

            <Separator />

            {/* Filters */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Confidence Threshold: {Math.round(showConfidenceThreshold * 100)}%
                </label>
                <Slider
                  value={[showConfidenceThreshold]}
                  onValueChange={([value]) => setShowConfidenceThreshold(value)}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={showOnlyManual}
                  onCheckedChange={setShowOnlyManual}
                />
                <label className="text-sm">Show only manual clouds</label>
              </div>
            </div>

            <Separator />

            {/* Cloud List */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {clouds
                .filter(cloud => {
                  if (showOnlyManual && !cloud.isManual) return false;
                  if (cloud.confidence < showConfidenceThreshold) return false;
                  return true;
                })
                .map((cloud, index) => (
                  <div
                    key={cloud.id}
                    onClick={() => setSelectedCloudId(cloud.id)}
                    className={cn(
                      'p-2 border rounded cursor-pointer transition-colors',
                      selectedCloudId === cloud.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Cloud #{index + 1}
                      </span>
                      <div className="flex items-center space-x-1">
                        {cloud.isManual ? (
                          <Badge variant="outline" className="text-green-600 text-xs">
                            Manual
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(cloud.confidence * 100)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {cloud.patternType} • {Math.round(cloud.boundingBox.width)}×{Math.round(cloud.boundingBox.height)}
                    </p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Export Options */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" size="sm" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Export Overlay Image
            </Button>
            <Button variant="outline" size="sm" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Export Cloud Data (JSON)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Unsaved Changes Warning */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-4 right-4 z-50">
          <Alert className="bg-amber-50 border-amber-200">
            <AlertDescription className="text-amber-800">
              You have unsaved changes. Don't forget to save your edits!
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
};