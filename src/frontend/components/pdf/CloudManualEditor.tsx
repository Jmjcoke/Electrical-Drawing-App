import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Save, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle, 
  Upload,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Alert, AlertDescription } from '../ui/Alert';
import { Progress } from '../ui/Progress';
import { CloudDetectionViewer } from './CloudDetectionViewer';
import { CloudEditingToolbar, EditTool, EditAction } from './CloudEditingToolbar';
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

interface DetectionResult {
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
  metadata: {
    processingTime: number;
    totalClouds: number;
    confidence: number;
    lastModified: string;
  };
}

interface EditState {
  clouds: CloudArea[];
  history: CloudArea[][];
  historyIndex: number;
  hasUnsavedChanges: boolean;
}

interface CloudManualEditorProps {
  drawingId: string;
  detectionResult?: DetectionResult;
  onSave?: (clouds: CloudArea[]) => Promise<void>;
  onClose?: () => void;
  readOnly?: boolean;
  className?: string;
}

export const CloudManualEditor: React.FC<CloudManualEditorProps> = ({
  drawingId,
  detectionResult,
  onSave,
  onClose,
  readOnly = false,
  className
}) => {
  const [editState, setEditState] = useState<EditState>({
    clouds: detectionResult?.clouds || [],
    history: [detectionResult?.clouds || []],
    historyIndex: 0,
    hasUnsavedChanges: false
  });

  const [selectedTool, setSelectedTool] = useState<EditTool>('select');
  const [zoom, setZoom] = useState(1);
  const [selectedCloudIds, setSelectedCloudIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [gridSize, setGridSize] = useState(20);
  const [opacity, setOpacity] = useState(0.7);
  const [brushSize, setBrushSize] = useState(3);
  const [showOriginalOverlay, setShowOriginalOverlay] = useState(true);

  // Initialize edit state when detection result changes
  useEffect(() => {
    if (detectionResult) {
      setEditState({
        clouds: detectionResult.clouds,
        history: [detectionResult.clouds],
        historyIndex: 0,
        hasUnsavedChanges: false
      });
    }
  }, [detectionResult]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (readOnly) return;

      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v': setSelectedTool('select'); break;
          case 'r': setSelectedTool('rectangle'); break;
          case 'c': setSelectedTool('circle'); break;
          case 'p': setSelectedTool('polygon'); break;
          case 'f': setSelectedTool('freehand'); break;
          case 'h': setSelectedTool('pan'); break;
          case 'g': setShowGrid(prev => !prev); break;
          case 'delete':
          case 'backspace':
            if (selectedCloudIds.length > 0) {
              handleAction('delete');
            }
            break;
        }
      }

      // Action shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              handleAction('redo');
            } else {
              handleAction('undo');
            }
            break;
          case 'y':
            e.preventDefault();
            handleAction('redo');
            break;
          case 'c':
            if (selectedCloudIds.length > 0) {
              e.preventDefault();
              handleAction('copy');
            }
            break;
          case 's':
            e.preventDefault();
            handleSave();
            break;
          case '0':
            e.preventDefault();
            setZoom(1);
            break;
        }
      }

      // Zoom shortcuts
      if (!e.ctrlKey && !e.metaKey) {
        switch (e.key) {
          case '+':
          case '=':
            setZoom(prev => Math.min(prev * 1.2, 5));
            break;
          case '-':
            setZoom(prev => Math.max(prev / 1.2, 0.1));
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedCloudIds, readOnly]);

  const addToHistory = (newClouds: CloudArea[]) => {
    setEditState(prev => {
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push([...newClouds]);
      
      return {
        clouds: newClouds,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        hasUnsavedChanges: true
      };
    });
  };

  const handleCloudsUpdate = (newClouds: CloudArea[]) => {
    if (readOnly) return;
    addToHistory(newClouds);
  };

  const handleAction = (action: EditAction) => {
    if (readOnly) return;

    switch (action) {
      case 'undo':
        setEditState(prev => {
          if (prev.historyIndex > 0) {
            const newIndex = prev.historyIndex - 1;
            return {
              ...prev,
              clouds: prev.history[newIndex],
              historyIndex: newIndex,
              hasUnsavedChanges: newIndex !== 0
            };
          }
          return prev;
        });
        break;

      case 'redo':
        setEditState(prev => {
          if (prev.historyIndex < prev.history.length - 1) {
            const newIndex = prev.historyIndex + 1;
            return {
              ...prev,
              clouds: prev.history[newIndex],
              historyIndex: newIndex,
              hasUnsavedChanges: true
            };
          }
          return prev;
        });
        break;

      case 'delete':
        if (selectedCloudIds.length > 0) {
          const newClouds = editState.clouds.filter(
            cloud => !selectedCloudIds.includes(cloud.id)
          );
          addToHistory(newClouds);
          setSelectedCloudIds([]);
        }
        break;

      case 'copy':
        if (selectedCloudIds.length > 0) {
          const selectedClouds = editState.clouds.filter(
            cloud => selectedCloudIds.includes(cloud.id)
          );
          
          const duplicatedClouds = selectedClouds.map(cloud => ({
            ...cloud,
            id: `${cloud.id}-copy-${Date.now()}`,
            boundingBox: {
              ...cloud.boundingBox,
              x: cloud.boundingBox.x + 20,
              y: cloud.boundingBox.y + 20
            }
          }));

          const newClouds = [...editState.clouds, ...duplicatedClouds];
          addToHistory(newClouds);
          setSelectedCloudIds(duplicatedClouds.map(c => c.id));
        }
        break;

      case 'rotate':
        // Implement rotation logic if needed
        break;
    }
  };

  const handleSave = async () => {
    if (!onSave || isSaving || readOnly) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave(editState.clouds);
      setEditState(prev => ({ ...prev, hasUnsavedChanges: false }));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (readOnly) return;
    
    if (detectionResult) {
      setEditState({
        clouds: detectionResult.clouds,
        history: [detectionResult.clouds],
        historyIndex: 0,
        hasUnsavedChanges: false
      });
      setSelectedCloudIds([]);
    }
  };

  const exportData = () => {
    const exportData = {
      drawingId,
      clouds: editState.clouds,
      metadata: {
        exportedAt: new Date().toISOString(),
        totalClouds: editState.clouds.length,
        manualClouds: editState.clouds.filter(c => c.isManual).length,
        automaticClouds: editState.clouds.filter(c => !c.isManual).length
      }
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloud-detection-${drawingId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const canUndo = editState.historyIndex > 0;
  const canRedo = editState.historyIndex < editState.history.length - 1;
  const hasSelection = selectedCloudIds.length > 0;

  const cloudStats = {
    total: editState.clouds.length,
    manual: editState.clouds.filter(c => c.isManual).length,
    automatic: editState.clouds.filter(c => !c.isManual).length,
    selected: selectedCloudIds.length
  };

  if (!detectionResult) {
    return (
      <div className={cn('flex items-center justify-center h-96', className)}>
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Detection Results</h3>
          <p className="text-gray-600">Please run cloud detection first to edit results.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cloud Detection Editor</CardTitle>
              <div className="flex items-center space-x-4 mt-2">
                <Badge variant="outline">
                  {cloudStats.total} clouds total
                </Badge>
                <Badge variant="outline" className="text-green-600">
                  {cloudStats.manual} manual
                </Badge>
                <Badge variant="outline" className="text-blue-600">
                  {cloudStats.automatic} automatic
                </Badge>
                {hasSelection && (
                  <Badge variant="default">
                    {cloudStats.selected} selected
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {editState.hasUnsavedChanges && (
                <Badge variant="outline" className="text-amber-600">
                  Unsaved Changes
                </Badge>
              )}

              {!readOnly && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    disabled={!editState.hasUnsavedChanges}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset
                  </Button>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSave}
                    disabled={!editState.hasUnsavedChanges || isSaving}
                  >
                    {isSaving ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                        Saving...
                      </div>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={exportData}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>

              {onClose && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                >
                  Close
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Save Error Alert */}
      {saveError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {saveError}
          </AlertDescription>
        </Alert>
      )}

      {/* Saving Progress */}
      {isSaving && (
        <Alert>
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
            <span>Saving cloud detection changes...</span>
          </div>
          <Progress value={undefined} className="mt-2" />
        </Alert>
      )}

      {/* Toolbar */}
      {!readOnly && (
        <CloudEditingToolbar
          selectedTool={selectedTool}
          onToolChange={setSelectedTool}
          onAction={handleAction}
          zoom={zoom}
          onZoomChange={setZoom}
          canUndo={canUndo}
          canRedo={canRedo}
          hasSelection={hasSelection}
          showGrid={showGrid}
          onToggleGrid={setShowGrid}
          snapToGrid={snapToGrid}
          onToggleSnap={setSnapToGrid}
          gridSize={gridSize}
          onGridSizeChange={setGridSize}
          opacity={opacity}
          onOpacityChange={setOpacity}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
        />
      )}

      {/* Main Editor */}
      <CloudDetectionViewer
        result={{
          ...detectionResult,
          clouds: editState.clouds
        }}
        onUpdate={handleCloudsUpdate}
        onSave={onSave}
      />

      {/* Footer Info */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center space-x-4">
              <span>Detection Confidence: {Math.round(detectionResult.metadata.confidence * 100)}%</span>
              <span>Processing Time: {detectionResult.metadata.processingTime}s</span>
              <span>Last Modified: {new Date(detectionResult.metadata.lastModified).toLocaleString()}</span>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOriginalOverlay(!showOriginalOverlay)}
              >
                {showOriginalOverlay ? (
                  <Eye className="h-4 w-4 mr-1" />
                ) : (
                  <EyeOff className="h-4 w-4 mr-1" />
                )}
                Original Overlay
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};