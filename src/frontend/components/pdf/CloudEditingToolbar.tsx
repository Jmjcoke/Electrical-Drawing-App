import React, { useState } from 'react';
import {
  MousePointer,
  Square,
  Circle,
  Edit3,
  Move,
  RotateCw,
  Trash2,
  Copy,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Grid,
  Layers,
  Settings
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Separator } from '../ui/Separator';
import { Badge } from '../ui/Badge';
import { Switch } from '../ui/Switch';
import { Slider } from '../ui/Slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/Popover';
import { cn } from '../../lib/utils';

export type EditTool = 
  | 'select' 
  | 'rectangle' 
  | 'circle' 
  | 'polygon' 
  | 'freehand' 
  | 'pan' 
  | 'zoom';

export type EditAction = 
  | 'copy' 
  | 'delete' 
  | 'undo' 
  | 'redo' 
  | 'rotate' 
  | 'duplicate';

interface CloudEditingToolbarProps {
  selectedTool: EditTool;
  onToolChange: (tool: EditTool) => void;
  onAction: (action: EditAction) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  showGrid: boolean;
  onToggleGrid: (show: boolean) => void;
  snapToGrid: boolean;
  onToggleSnap: (snap: boolean) => void;
  gridSize: number;
  onGridSizeChange: (size: number) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  className?: string;
}

export const CloudEditingToolbar: React.FC<CloudEditingToolbarProps> = ({
  selectedTool,
  onToolChange,
  onAction,
  zoom,
  onZoomChange,
  canUndo,
  canRedo,
  hasSelection,
  showGrid,
  onToggleGrid,
  snapToGrid,
  onToggleSnap,
  gridSize,
  onGridSizeChange,
  opacity,
  onOpacityChange,
  brushSize,
  onBrushSizeChange,
  className
}) => {
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const tools: Array<{ id: EditTool; icon: React.ReactNode; label: string; shortcut?: string }> = [
    { id: 'select', icon: <MousePointer className="h-4 w-4" />, label: 'Select', shortcut: 'V' },
    { id: 'rectangle', icon: <Square className="h-4 w-4" />, label: 'Rectangle', shortcut: 'R' },
    { id: 'circle', icon: <Circle className="h-4 w-4" />, label: 'Circle', shortcut: 'C' },
    { id: 'polygon', icon: <Edit3 className="h-4 w-4" />, label: 'Polygon', shortcut: 'P' },
    { id: 'freehand', icon: <Edit3 className="h-4 w-4" />, label: 'Freehand', shortcut: 'F' },
    { id: 'pan', icon: <Move className="h-4 w-4" />, label: 'Pan', shortcut: 'H' },
  ];

  const zoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5];

  const handleZoomSelect = (value: string) => {
    const zoomValue = parseFloat(value);
    onZoomChange(zoomValue);
  };

  const zoomIn = () => {
    const currentIndex = zoomLevels.findIndex(level => level >= zoom);
    const nextIndex = Math.min(currentIndex + 1, zoomLevels.length - 1);
    onZoomChange(zoomLevels[nextIndex]);
  };

  const zoomOut = () => {
    const currentIndex = zoomLevels.findIndex(level => level >= zoom);
    const prevIndex = Math.max(currentIndex - 1, 0);
    onZoomChange(zoomLevels[prevIndex]);
  };

  const resetZoom = () => onZoomChange(1);

  return (
    <div className={cn('flex items-center justify-between p-2 bg-white border-b shadow-sm', className)}>
      {/* Tool Selection */}
      <div className="flex items-center space-x-1">
        <div className="flex items-center border rounded-lg">
          {tools.map((tool) => (
            <Button
              key={tool.id}
              variant={selectedTool === tool.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onToolChange(tool.id)}
              title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
              className="rounded-none first:rounded-l-lg last:rounded-r-lg"
            >
              {tool.icon}
            </Button>
          ))}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Drawing Tools Settings */}
        {(selectedTool === 'freehand' || selectedTool === 'rectangle' || selectedTool === 'circle') && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Brush:</span>
            <Slider
              value={[brushSize]}
              onValueChange={([value]) => onBrushSizeChange(value)}
              min={1}
              max={20}
              step={1}
              className="w-20"
            />
            <span className="text-xs text-gray-500 min-w-[30px]">{brushSize}px</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-1">
        {/* Edit Actions */}
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAction('undo')}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAction('redo')}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Selection Actions */}
        {hasSelection && (
          <>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAction('copy')}
                title="Copy (Ctrl+C)"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAction('rotate')}
                title="Rotate"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAction('delete')}
                title="Delete (Del)"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Separator orientation="vertical" className="h-6" />
          </>
        )}

        {/* Zoom Controls */}
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomOut}
            disabled={zoom <= zoomLevels[0]}
            title="Zoom Out (-)"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <Select value={zoom.toString()} onValueChange={handleZoomSelect}>
            <SelectTrigger className="w-20 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {zoomLevels.map(level => (
                <SelectItem key={level} value={level.toString()}>
                  {Math.round(level * 100)}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="sm"
            onClick={zoomIn}
            disabled={zoom >= zoomLevels[zoomLevels.length - 1]}
            title="Zoom In (+)"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={resetZoom}
            title="Reset Zoom (Ctrl+0)"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* View Options */}
        <div className="flex items-center space-x-2">
          <Button
            variant={showGrid ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onToggleGrid(!showGrid)}
            title="Toggle Grid (G)"
          >
            <Grid className="h-4 w-4" />
          </Button>

          <Button
            variant={snapToGrid ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onToggleSnap(!snapToGrid)}
            title="Snap to Grid"
            disabled={!showGrid}
          >
            <Layers className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Advanced Settings */}
        <Popover open={showAdvancedSettings} onOpenChange={setShowAdvancedSettings}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              title="Advanced Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-3">Display Settings</h4>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Overlay Opacity: {Math.round(opacity * 100)}%
                    </label>
                    <Slider
                      value={[opacity]}
                      onValueChange={([value]) => onOpacityChange(value)}
                      min={0.1}
                      max={1}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  {showGrid && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Grid Size: {gridSize}px
                      </label>
                      <Slider
                        value={[gridSize]}
                        onValueChange={([value]) => onGridSizeChange(value)}
                        min={5}
                        max={50}
                        step={5}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-3">Grid Settings</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={showGrid}
                      onCheckedChange={onToggleGrid}
                    />
                    <label className="text-sm">Show grid</label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={snapToGrid}
                      onCheckedChange={onToggleSnap}
                      disabled={!showGrid}
                    />
                    <label className="text-sm">Snap to grid</label>
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Status Indicators */}
      <div className="flex items-center space-x-2">
        {snapToGrid && showGrid && (
          <Badge variant="outline" className="text-xs">
            Snap: {gridSize}px
          </Badge>
        )}
        
        <Badge variant="outline" className="text-xs">
          {Math.round(zoom * 100)}%
        </Badge>
        
        {selectedTool !== 'select' && selectedTool !== 'pan' && (
          <Badge variant="outline" className="text-xs">
            {tools.find(t => t.id === selectedTool)?.label}
          </Badge>
        )}
      </div>
    </div>
  );
};