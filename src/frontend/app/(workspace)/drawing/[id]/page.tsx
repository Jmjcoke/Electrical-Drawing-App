// Drawing Workspace Page - Integrating AI Interactive Canvas

import React, { Suspense } from 'react';
import { InteractiveDrawingCanvas } from '@/components/ai/drawing-canvas/InteractiveDrawingCanvas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { 
  FileText, 
  Zap, 
  Settings, 
  Share, 
  Download,
  ArrowLeft 
} from 'lucide-react';

interface DrawingWorkspacePageProps {
  params: {
    id: string;
  };
}

// Component for displaying selected component details
const ComponentDetailsPanel = ({ selectedComponent }: { selectedComponent: any }) => {
  if (!selectedComponent) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          <Zap className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p>Select a component to view details</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{selectedComponent.type}</span>
          <Badge variant="secondary">
            {Math.round(selectedComponent.confidence * 100)}% confidence
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold text-sm mb-2">Specifications</h4>
          <div className="space-y-1 text-sm">
            {selectedComponent.specifications?.voltage && (
              <div className="flex justify-between">
                <span>Voltage:</span>
                <span>{selectedComponent.specifications.voltage}V</span>
              </div>
            )}
            {selectedComponent.specifications?.amperage && (
              <div className="flex justify-between">
                <span>Amperage:</span>
                <span>{selectedComponent.specifications.amperage}A</span>
              </div>
            )}
            {selectedComponent.specifications?.manufacturer && (
              <div className="flex justify-between">
                <span>Manufacturer:</span>
                <span>{selectedComponent.specifications.manufacturer}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-sm mb-2">Location</h4>
          <div className="text-sm text-gray-600">
            Position: ({selectedComponent.boundingBox.x}, {selectedComponent.boundingBox.y})
            <br />
            Size: {selectedComponent.boundingBox.width} × {selectedComponent.boundingBox.height}
          </div>
        </div>

        <div className="flex space-x-2">
          <Button size="sm" variant="outline" className="flex-1">
            Trace Circuit
          </Button>
          <Button size="sm" variant="outline" className="flex-1">
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Loading skeleton for the canvas
const CanvasLoadingSkeleton = () => (
  <Card>
    <CardContent className="p-0">
      <div className="w-full h-[600px] bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-sm text-gray-500">Loading drawing canvas...</div>
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function DrawingWorkspacePage({ params }: DrawingWorkspacePageProps) {
  const { id: drawingId } = params;
  const [selectedComponent, setSelectedComponent] = React.useState<any>(null);

  // Handle component selection from canvas
  const handleComponentSelect = React.useCallback((component: any) => {
    setSelectedComponent(component);
  }, []);

  // Handle canvas ready state
  const handleCanvasReady = React.useCallback(() => {
    console.log('Drawing canvas is ready for drawing:', drawingId);
  }, [drawingId]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Project
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Electrical Drawing Analysis</h1>
                <p className="text-sm text-gray-600">Drawing ID: {drawingId}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm">
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Canvas Area */}
          <div className="lg:col-span-3">
            <Suspense fallback={<CanvasLoadingSkeleton />}>
              <InteractiveDrawingCanvas
                drawingId={drawingId}
                onComponentSelect={handleComponentSelect}
                onCanvasReady={handleCanvasReady}
                width={1200}
                height={800}
                enableRealTimeUpdates={true}
                performanceMode={false}
                className="w-full"
              />
            </Suspense>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Component Details */}
            <ComponentDetailsPanel selectedComponent={selectedComponent} />

            {/* Analysis Tools */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Analysis Tools</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Zap className="h-4 w-4 mr-2" />
                  Estimate Hours
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Settings className="h-4 w-4 mr-2" />
                  Detection Settings
                </Button>
              </CardContent>
            </Card>

            {/* Project Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Project Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Project:</span>
                  <span className="font-medium">Industrial Plant #3</span>
                </div>
                <div className="flex justify-between">
                  <span>Sheet:</span>
                  <span className="font-medium">E-001</span>
                </div>
                <div className="flex justify-between">
                  <span>Revision:</span>
                  <span className="font-medium">Rev C</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Modified:</span>
                  <span className="font-medium">2 hours ago</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bottom Panel with Tabs */}
        <div className="mt-6">
          <Tabs defaultValue="components" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="components">Components</TabsTrigger>
              <TabsTrigger value="circuits">Circuits</TabsTrigger>
              <TabsTrigger value="clouds">Changes</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="components" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <div className="text-center text-gray-500">
                    <p>Component list will appear here when analysis is complete.</p>
                    <p className="text-sm mt-1">Start AI analysis to detect electrical components.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="circuits" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <div className="text-center text-gray-500">
                    <p>Circuit tracing results will appear here.</p>
                    <p className="text-sm mt-1">Select a component and trace its circuit connections.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="clouds" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <div className="text-center text-gray-500">
                    <p>Change detection and cloud markup will appear here.</p>
                    <p className="text-sm mt-1">AI will identify new work and revisions.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="history" className="mt-4">
              <Card>
                <CardContent className="p-6">
                  <div className="text-center text-gray-500">
                    <p>Analysis history and version tracking.</p>
                    <p className="text-sm mt-1">View previous analysis results and changes.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}