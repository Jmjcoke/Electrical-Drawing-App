// AI Analysis Dashboard - Real-time Analysis Interface Integration

import React, { Suspense } from 'react';
import { InteractiveDrawingCanvas } from '@/components/ai/drawing-canvas/InteractiveDrawingCanvas';
import { AnalysisProgressIndicator } from '@/components/ai/ai-feedback/AnalysisProgressIndicator';
import { ConfidenceThresholdControls } from '@/components/ai/ai-feedback/ConfidenceThresholdControls';
import { AIProcessingQueue } from '@/components/ai/ai-feedback/AIProcessingQueue';
import { AIServiceHealthMonitor } from '@/components/ai/ai-feedback/AIServiceHealthMonitor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { 
  Brain,
  Activity,
  Settings,
  Share,
  Download,
  ArrowLeft,
  Layers,
  Zap,
  BarChart3
} from 'lucide-react';

interface AIAnalysisDashboardProps {
  params: {
    id: string;
  };
}

export default function AIAnalysisDashboard({ params }: AIAnalysisDashboardProps) {
  const { id: analysisId } = params;
  const [selectedComponent, setSelectedComponent] = React.useState<any>(null);
  const [showFallbackMode, setShowFallbackMode] = React.useState(false);

  // Handle component selection from canvas
  const handleComponentSelect = React.useCallback((component: any) => {
    setSelectedComponent(component);
  }, []);

  // Handle canvas ready state
  const handleCanvasReady = React.useCallback(() => {
    console.log('AI analysis canvas ready for analysis:', analysisId);
  }, [analysisId]);

  // Handle fallback mode activation
  const handleFallbackMode = React.useCallback(() => {
    setShowFallbackMode(true);
    console.log('Switching to manual mode due to AI service issues');
  }, []);

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
                <h1 className="text-xl font-semibold flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                  <span>AI Analysis Dashboard</span>
                </h1>
                <p className="text-sm text-gray-600">Analysis ID: {analysisId}</p>
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
        {/* Top Row - Progress and Health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <AnalysisProgressIndicator
              analysisId={analysisId}
              showDetails={true}
              showConnectionStatus={true}
            />
          </div>
          <div>
            <AIServiceHealthMonitor
              showDetails={false}
              showActions={true}
              onFallbackMode={handleFallbackMode}
            />
          </div>
        </div>

        {/* Main Analysis Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
          {/* Canvas Area */}
          <div className="lg:col-span-3">
            {showFallbackMode ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Activity className="h-12 w-12 mx-auto mb-3 text-orange-500" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Manual Mode Active</h3>
                  <p className="text-gray-600 mb-4">
                    AI services are currently unavailable. You can still view and manually analyze drawings.
                  </p>
                  <Button onClick={() => setShowFallbackMode(false)}>
                    Retry AI Analysis
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Suspense fallback={
                <Card>
                  <CardContent className="p-6 text-center">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p>Loading AI analysis interface...</p>
                  </CardContent>
                </Card>
              }>
                <InteractiveDrawingCanvas
                  drawingId={analysisId}
                  onComponentSelect={handleComponentSelect}
                  onCanvasReady={handleCanvasReady}
                  width={1200}
                  height={700}
                  enableRealTimeUpdates={true}
                  performanceMode={false}
                  className="w-full"
                />
              </Suspense>
            )}
          </div>

          {/* Controls Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Confidence Controls */}
            <ConfidenceThresholdControls
              showPreview={true}
              showPresets={true}
              showImpactAnalysis={true}
            />

            {/* Selected Component Details */}
            {selectedComponent ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Component Details</span>
                    <Badge variant="secondary">
                      {Math.round(selectedComponent.confidence * 100)}%
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-sm mb-2">Type</h4>
                    <p className="text-sm text-gray-600 capitalize">
                      {selectedComponent.type.replace('_', ' ')}
                    </p>
                  </div>
                  
                  {selectedComponent.specifications && (
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Specifications</h4>
                      <div className="space-y-1 text-sm">
                        {selectedComponent.specifications.voltage && (
                          <div className="flex justify-between">
                            <span>Voltage:</span>
                            <span>{selectedComponent.specifications.voltage}V</span>
                          </div>
                        )}
                        {selectedComponent.specifications.amperage && (
                          <div className="flex justify-between">
                            <span>Amperage:</span>
                            <span>{selectedComponent.specifications.amperage}A</span>
                          </div>
                        )}
                        {selectedComponent.specifications.manufacturer && (
                          <div className="flex justify-between">
                            <span>Manufacturer:</span>
                            <span className="text-right max-w-20 truncate">
                              {selectedComponent.specifications.manufacturer}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      <Layers className="h-3 w-3 mr-1" />
                      Trace
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      <BarChart3 className="h-3 w-3 mr-1" />
                      Specs
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-gray-500">
                  <Zap className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Select a component to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Bottom Tabs */}
        <Tabs defaultValue="queue" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="queue">Processing Queue</TabsTrigger>
            <TabsTrigger value="health">Service Health</TabsTrigger>
            <TabsTrigger value="updates">Live Updates</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="queue" className="mt-4">
            <AIProcessingQueue
              showControls={true}
              maxDisplayItems={5}
              onJobSelect={(jobId) => console.log('Selected job:', jobId)}
            />
          </TabsContent>
          
          <TabsContent value="health" className="mt-4">
            <AIServiceHealthMonitor
              showDetails={true}
              showActions={true}
              onServiceClick={(service) => console.log('Service clicked:', service)}
              onFallbackMode={handleFallbackMode}
            />
          </TabsContent>
          
          <TabsContent value="updates" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Real-time Updates</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Live analysis updates and WebSocket connection details will appear here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Analysis Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Analysis Options</h4>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="text-sm">Enable component detection</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="text-sm">Enable cloud detection</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Enable circuit tracing</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Enable estimation</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold text-sm mb-2">Performance</h4>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" defaultChecked />
                      <span className="text-sm">Enable real-time updates</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" className="rounded" />
                      <span className="text-sm">Performance mode</span>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}