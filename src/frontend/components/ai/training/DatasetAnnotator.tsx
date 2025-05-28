'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
import {
  TrainingDataset,
  TrainingItem,
  Annotation,
  AnnotationType,
  ComponentAnnotation,
  SymbolAnnotation,
  LegendAnnotation,
} from '@/types/ai/trainingData';

interface DatasetAnnotatorProps {
  dataset: TrainingDataset;
  items: TrainingItem[];
  onAnnotationComplete?: (item: TrainingItem, annotations: Annotation[]) => void;
  className?: string;
}

export const DatasetAnnotator: React.FC<DatasetAnnotatorProps> = ({
  dataset,
  items,
  onAnnotationComplete,
  className,
}) => {
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedTool, setSelectedTool] = useState<AnnotationType>('component');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const currentItem = items[currentItemIndex];

  const handleToolSelect = (tool: AnnotationType) => {
    setSelectedTool(tool);
  };

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !imageRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Start drawing bounding box
    setIsDrawing(true);
    // Implementation would handle drawing logic
  }, []);

  const handleSaveAnnotations = () => {
    if (currentItem && onAnnotationComplete) {
      onAnnotationComplete(currentItem, annotations);
    }

    // Move to next item
    if (currentItemIndex < items.length - 1) {
      setCurrentItemIndex(currentItemIndex + 1);
      setAnnotations([]);
    }
  };

  const handleSkipItem = () => {
    if (currentItemIndex < items.length - 1) {
      setCurrentItemIndex(currentItemIndex + 1);
      setAnnotations([]);
    }
  };

  const getAnnotationColor = (type: AnnotationType) => {
    switch (type) {
      case 'component':
        return 'rgba(59, 130, 246, 0.5)'; // blue
      case 'symbol':
        return 'rgba(16, 185, 129, 0.5)'; // green
      case 'legend':
        return 'rgba(139, 92, 246, 0.5)'; // purple
      case 'connection':
        return 'rgba(251, 146, 60, 0.5)'; // orange
      default:
        return 'rgba(107, 114, 128, 0.5)'; // gray
    }
  };

  return (
    <div className={cn('dataset-annotator', className)}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Annotation Canvas */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Annotate: {currentItem?.filename || 'No item'}</span>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">
                    {currentItemIndex + 1} / {items.length}
                  </Badge>
                  <Badge
                    variant={annotations.length > 0 ? 'default' : 'secondary'}
                  >
                    {annotations.length} annotations
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Annotation Tools */}
              <div className="mb-4 flex items-center space-x-2">
                <Button
                  size="sm"
                  variant={selectedTool === 'component' ? 'default' : 'outline'}
                  onClick={() => handleToolSelect('component')}
                >
                  Component
                </Button>
                <Button
                  size="sm"
                  variant={selectedTool === 'symbol' ? 'default' : 'outline'}
                  onClick={() => handleToolSelect('symbol')}
                >
                  Symbol
                </Button>
                <Button
                  size="sm"
                  variant={selectedTool === 'legend' ? 'default' : 'outline'}
                  onClick={() => handleToolSelect('legend')}
                >
                  Legend
                </Button>
                <Button
                  size="sm"
                  variant={selectedTool === 'connection' ? 'default' : 'outline'}
                  onClick={() => handleToolSelect('connection')}
                >
                  Connection
                </Button>
                <div className="flex-1" />
                <Button size="sm" variant="ghost">
                  Undo
                </Button>
                <Button size="sm" variant="ghost">
                  Clear All
                </Button>
              </div>

              {/* Canvas Area */}
              <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                {currentItem ? (
                  <>
                    <img
                      ref={imageRef}
                      src={currentItem.imageUrl}
                      alt={currentItem.filename}
                      className="max-w-full h-auto"
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 cursor-crosshair"
                      onClick={handleCanvasClick}
                    />
                  </>
                ) : (
                  <div className="flex items-center justify-center h-96 text-gray-500">
                    No items to annotate
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={handleSkipItem}
                  disabled={currentItemIndex >= items.length - 1}
                >
                  Skip
                </Button>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentItemIndex(Math.max(0, currentItemIndex - 1))}
                    disabled={currentItemIndex === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={handleSaveAnnotations}
                    disabled={annotations.length === 0}
                  >
                    Save & Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Annotation Details Panel */}
        <div className="space-y-4">
          {/* Dataset Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dataset Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-600">Name:</span>
                  <span className="ml-2 font-medium">{dataset.name}</span>
                </div>
                <div>
                  <span className="text-gray-600">Category:</span>
                  <Badge variant="outline" className="ml-2">
                    {dataset.category}
                  </Badge>
                </div>
                <div>
                  <span className="text-gray-600">Standard:</span>
                  <span className="ml-2">{dataset.electricalStandard}</span>
                </div>
                <div>
                  <span className="text-gray-600">Progress:</span>
                  <div className="ml-2 mt-1">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${(dataset.annotatedCount / dataset.totalItems) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-600">
                      {dataset.annotatedCount} / {dataset.totalItems} annotated
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Annotations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Current Annotations</CardTitle>
            </CardHeader>
            <CardContent>
              {annotations.length > 0 ? (
                <div className="space-y-2">
                  {annotations.map((annotation, index) => (
                    <div
                      key={annotation.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded"
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{
                            backgroundColor: getAnnotationColor(annotation.type),
                          }}
                        />
                        <span className="text-sm">{annotation.type}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">
                  No annotations yet. Click on the image to start annotating.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Annotation Guidelines */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Guidelines</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="component" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="component">Components</TabsTrigger>
                  <TabsTrigger value="tips">Tips</TabsTrigger>
                </TabsList>
                <TabsContent value="component" className="mt-4">
                  <div className="space-y-2 text-sm">
                    <p>• Draw tight bounding boxes around components</p>
                    <p>• Include the entire component and labels</p>
                    <p>• For complex components, annotate sub-parts</p>
                    <p>• Use consistent labeling conventions</p>
                  </div>
                </TabsContent>
                <TabsContent value="tips" className="mt-4">
                  <div className="space-y-2 text-sm">
                    <p>• Zoom in for precise annotations</p>
                    <p>• Use keyboard shortcuts for efficiency</p>
                    <p>• Review annotations before saving</p>
                    <p>• Skip unclear or damaged images</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};