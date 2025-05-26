import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Eye, 
  Edit, 
  Settings, 
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Alert, AlertDescription } from '../ui/Alert';
import { Progress } from '../ui/Progress';
import { CloudManualEditor } from './CloudManualEditor';
import { CloudDetectionViewer } from './CloudDetectionViewer';
import { cn } from '../../lib/utils';

interface CloudDetectionStatus {
  status: 'not_started' | 'running' | 'completed' | 'failed' | 'manual_edit';
  progress: number;
  message?: string;
  error?: string;
  results?: CloudDetectionResult;
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
  metadata: {
    processingTime: number;
    totalClouds: number;
    confidence: number;
    lastModified: string;
  };
}

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

interface PDFCloudDetectionIntegrationProps {
  drawingId: string;
  imageUrl: string;
  projectId: string;
  onResultsUpdate?: (results: CloudDetectionResult) => void;
  autoDetectOnMount?: boolean;
  className?: string;
}

export const PDFCloudDetectionIntegration: React.FC<PDFCloudDetectionIntegrationProps> = ({
  drawingId,
  imageUrl,
  projectId,
  onResultsUpdate,
  autoDetectOnMount = false,
  className
}) => {
  const [detectionStatus, setDetectionStatus] = useState<CloudDetectionStatus>({
    status: 'not_started',
    progress: 0
  });
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [detectionSettings, setDetectionSettings] = useState({
    sensitivity: 0.7,
    cadSystem: 'generic',
    visualizationMode: 'standard'
  });

  useEffect(() => {
    if (autoDetectOnMount) {
      handleStartDetection();
    }
  }, [autoDetectOnMount]);

  const handleStartDetection = async () => {
    setDetectionStatus({
      status: 'running',
      progress: 0,
      message: 'Initializing cloud detection...'
    });

    try {
      // Call cloud detection API
      const response = await fetch(`/api/ai-vision/detect-clouds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          drawingId,
          imageUrl,
          settings: detectionSettings
        })
      });

      if (!response.ok) {
        throw new Error(`Detection failed: ${response.statusText}`);
      }

      // Start polling for results
      const { taskId } = await response.json();
      pollDetectionStatus(taskId);

    } catch (error) {
      setDetectionStatus({
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  };

  const pollDetectionStatus = async (taskId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/ai-vision/detection-status/${taskId}`);
        const data = await response.json();

        setDetectionStatus(prev => ({
          ...prev,
          progress: data.progress || 0,
          message: data.message || 'Processing...'
        }));

        if (data.status === 'completed') {
          clearInterval(pollInterval);
          
          const results: CloudDetectionResult = {
            drawingId,
            imageUrl,
            originalWidth: data.results.originalWidth,
            originalHeight: data.results.originalHeight,
            clouds: data.results.clouds,
            detectionSettings,
            metadata: {
              processingTime: data.results.processingTime,
              totalClouds: data.results.clouds.length,
              confidence: data.results.averageConfidence,
              lastModified: new Date().toISOString()
            }
          };

          setDetectionStatus({
            status: 'completed',
            progress: 100,
            results
          });

          onResultsUpdate?.(results);
        } else if (data.status === 'failed') {
          clearInterval(pollInterval);
          setDetectionStatus({
            status: 'failed',
            progress: 0,
            error: data.error || 'Detection failed'
          });
        }
      } catch (error) {
        clearInterval(pollInterval);
        setDetectionStatus({
          status: 'failed',
          progress: 0,
          error: 'Failed to check detection status'
        });
      }
    }, 2000);

    // Cleanup timeout
    setTimeout(() => {
      clearInterval(pollInterval);
      if (detectionStatus.status === 'running') {
        setDetectionStatus({
          status: 'failed',
          progress: 0,
          error: 'Detection timeout'
        });
      }
    }, 300000); // 5 minute timeout
  };

  const handleSaveManualEdits = async (clouds: CloudArea[]) => {
    try {
      const response = await fetch(`/api/ai-vision/save-cloud-edits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          drawingId,
          clouds
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save changes');
      }

      // Update results with edited clouds
      if (detectionStatus.results) {
        const updatedResults = {
          ...detectionStatus.results,
          clouds,
          metadata: {
            ...detectionStatus.results.metadata,
            lastModified: new Date().toISOString(),
            totalClouds: clouds.length
          }
        };

        setDetectionStatus(prev => ({
          ...prev,
          results: updatedResults
        }));

        onResultsUpdate?.(updatedResults);
      }
    } catch (error) {
      throw error; // Let the editor component handle the error
    }
  };

  const handleRetryDetection = () => {
    setDetectionStatus({
      status: 'not_started',
      progress: 0
    });
  };

  const handleExportResults = () => {
    if (!detectionStatus.results) return;

    const exportData = {
      drawingId,
      projectId,
      ...detectionStatus.results,
      exportedAt: new Date().toISOString()
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

  const getStatusIcon = () => {
    switch (detectionStatus.status) {
      case 'not_started': return <Zap className="h-5 w-5" />;
      case 'running': return <RefreshCw className="h-5 w-5 animate-spin" />;
      case 'completed': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'failed': return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'manual_edit': return <Edit className="h-5 w-5 text-blue-600" />;
      default: return <Clock className="h-5 w-5" />;
    }
  };

  const getStatusMessage = () => {
    switch (detectionStatus.status) {
      case 'not_started': return 'Ready to detect cloud areas';
      case 'running': return detectionStatus.message || 'Processing image...';
      case 'completed': return `Found ${detectionStatus.results?.metadata.totalClouds} cloud areas`;
      case 'failed': return detectionStatus.error || 'Detection failed';
      case 'manual_edit': return 'Manual editing mode';
      default: return 'Unknown status';
    }
  };

  if (isManualEditing && detectionStatus.results) {
    return (
      <div className={cn('space-y-4', className)}>
        <CloudManualEditor
          drawingId={drawingId}
          detectionResult={detectionStatus.results}
          onSave={handleSaveManualEdits}
          onClose={() => setIsManualEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Detection Control Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              {getStatusIcon()}
              <span>Cloud Detection</span>
            </CardTitle>
            
            <div className="flex items-center space-x-2">
              {detectionStatus.status === 'completed' && (
                <>
                  <Badge variant="outline" className="text-green-600">
                    {detectionStatus.results?.metadata.totalClouds} clouds
                  </Badge>
                  <Badge variant="outline">
                    {Math.round((detectionStatus.results?.metadata.confidence || 0) * 100)}% confidence
                  </Badge>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Status Message */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">{getStatusMessage()}</span>
              {detectionStatus.status === 'running' && (
                <div className="flex-1">
                  <Progress value={detectionStatus.progress} className="h-2" />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              {detectionStatus.status === 'not_started' && (
                <Button onClick={handleStartDetection}>
                  <Zap className="h-4 w-4 mr-2" />
                  Start Detection
                </Button>
              )}

              {detectionStatus.status === 'failed' && (
                <Button onClick={handleRetryDetection}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry Detection
                </Button>
              )}

              {detectionStatus.status === 'completed' && (
                <>
                  <Button onClick={() => setIsManualEditing(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Results
                  </Button>
                  
                  <Button variant="outline" onClick={handleRetryDetection}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Re-detect
                  </Button>

                  <Button variant="outline" onClick={handleExportResults}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </>
              )}

              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>

            {/* Error Display */}
            {detectionStatus.status === 'failed' && detectionStatus.error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {detectionStatus.error}
                </AlertDescription>
              </Alert>
            )}

            {/* Processing Info */}
            {detectionStatus.status === 'running' && (
              <Alert>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  Cloud detection is analyzing your drawing. This typically takes 30-60 seconds.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Viewer */}
      {detectionStatus.status === 'completed' && detectionStatus.results && (
        <CloudDetectionViewer
          result={detectionStatus.results}
          onUpdate={(clouds) => {
            if (detectionStatus.results) {
              const updatedResults = {
                ...detectionStatus.results,
                clouds
              };
              setDetectionStatus(prev => ({
                ...prev,
                results: updatedResults
              }));
            }
          }}
        />
      )}
    </div>
  );
};