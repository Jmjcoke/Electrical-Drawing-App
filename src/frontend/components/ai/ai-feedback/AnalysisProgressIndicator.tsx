// Analysis Progress Indicator with Real-time Updates - Story 3.2

'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useAIAnalysisStore, useAnalysisProgress } from '@/stores/aiAnalysisStore';
import { useAIAnalysisUpdates } from '@/hooks/ai/useAIAnalysisUpdates';
import { AnalysisStage } from '@/types/ai/computerVision';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { 
  CheckCircle, 
  Circle, 
  AlertCircle, 
  Loader2, 
  Wifi, 
  WifiOff,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';

interface AnalysisProgressIndicatorProps {
  analysisId?: string;
  showDetails?: boolean;
  showConnectionStatus?: boolean;
  className?: string;
}

const stageInfo = {
  [AnalysisStage.IDLE]: {
    label: 'Ready',
    description: 'Waiting to start analysis',
    color: 'text-gray-500',
    bgColor: 'bg-gray-100'
  },
  [AnalysisStage.PREPROCESSING]: {
    label: 'Preprocessing',
    description: 'Preparing drawing for analysis',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100'
  },
  [AnalysisStage.COMPONENT_DETECTION]: {
    label: 'Detecting Components',
    description: 'AI identifying electrical components',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100'
  },
  [AnalysisStage.CLOUD_DETECTION]: {
    label: 'Finding Changes',
    description: 'Detecting revision clouds and changes',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100'
  },
  [AnalysisStage.CIRCUIT_ANALYSIS]: {
    label: 'Analyzing Circuits',
    description: 'Tracing electrical connections',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100'
  },
  [AnalysisStage.ESTIMATION]: {
    label: 'Estimating Hours',
    description: 'Calculating project estimates',
    color: 'text-green-600',
    bgColor: 'bg-green-100'
  },
  [AnalysisStage.COMPLETE]: {
    label: 'Complete',
    description: 'Analysis finished successfully',
    color: 'text-green-600',
    bgColor: 'bg-green-100'
  },
  [AnalysisStage.ERROR]: {
    label: 'Error',
    description: 'Analysis encountered an error',
    color: 'text-red-600',
    bgColor: 'bg-red-100'
  }
};

export const AnalysisProgressIndicator: React.FC<AnalysisProgressIndicatorProps> = ({
  analysisId,
  showDetails = true,
  showConnectionStatus = true,
  className
}) => {
  const { currentStage, overallProgress, isProcessing, stageProgress } = useAnalysisProgress();
  const { currentAnalysis } = useAIAnalysisStore();
  const { connectionStatus, isConnected, latency, updates, reconnect } = useAIAnalysisUpdates({
    analysisId: analysisId || currentAnalysis?.id,
    enabled: true,
    autoConnect: true
  });

  const currentStageInfo = stageInfo[currentStage] || stageInfo[AnalysisStage.IDLE];
  const currentStageProgress = stageProgress[currentStage] || 0;

  // Get recent updates for display
  const recentUpdates = updates.slice(0, 3);

  const renderStageIcon = (stage: AnalysisStage, isActive: boolean, isComplete: boolean) => {
    if (stage === AnalysisStage.ERROR) {
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
    
    if (isComplete) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    
    if (isActive) {
      return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
    }
    
    return <Circle className="h-4 w-4 text-gray-400" />;
  };

  const getStageStatus = (stage: AnalysisStage): 'pending' | 'active' | 'complete' | 'error' => {
    if (stage === AnalysisStage.ERROR && currentStage === AnalysisStage.ERROR) {
      return 'error';
    }
    
    if (stage === currentStage) {
      return 'active';
    }
    
    // Determine if stage is complete based on current progress
    const stageOrder = [
      AnalysisStage.PREPROCESSING,
      AnalysisStage.COMPONENT_DETECTION,
      AnalysisStage.CLOUD_DETECTION,
      AnalysisStage.CIRCUIT_ANALYSIS,
      AnalysisStage.ESTIMATION,
      AnalysisStage.COMPLETE
    ];
    
    const currentIndex = stageOrder.indexOf(currentStage);
    const stageIndex = stageOrder.indexOf(stage);
    
    return stageIndex < currentIndex ? 'complete' : 'pending';
  };

  const renderConnectionStatus = () => {
    if (!showConnectionStatus) return null;

    return (
      <div className="flex items-center space-x-2 text-sm">
        {isConnected ? (
          <>
            <Wifi className="h-4 w-4 text-green-600" />
            <span className="text-green-600">Connected</span>
            {latency > 0 && (
              <span className="text-gray-500">({latency}ms)</span>
            )}
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-red-600" />
            <span className="text-red-600">{connectionStatus}</span>
            {connectionStatus === 'error' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={reconnect}
                className="h-6 px-2"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center space-x-2">
            <div className={cn(
              'w-3 h-3 rounded-full',
              isProcessing ? 'bg-blue-600 animate-pulse' : 
              currentStage === AnalysisStage.COMPLETE ? 'bg-green-600' :
              currentStage === AnalysisStage.ERROR ? 'bg-red-600' : 'bg-gray-400'
            )} />
            <span>AI Analysis Progress</span>
          </div>
          
          <div className="flex items-center space-x-3">
            {renderConnectionStatus()}
            <Badge 
              variant={isProcessing ? 'default' : 'secondary'}
              className={cn(
                currentStageInfo.color,
                currentStageInfo.bgColor
              )}
            >
              {currentStageInfo.label}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{Math.round(overallProgress)}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>

        {/* Current Stage Progress */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{currentStageInfo.label}</span>
              <span>{Math.round(currentStageProgress)}%</span>
            </div>
            <Progress value={currentStageProgress} className="h-1" />
            <p className="text-xs text-gray-600">{currentStageInfo.description}</p>
          </div>
        )}

        {/* Stage Details */}
        {showDetails && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Analysis Stages</h4>
            <div className="space-y-2">
              {Object.entries(stageInfo)
                .filter(([stage]) => stage !== AnalysisStage.IDLE && stage !== AnalysisStage.ERROR)
                .map(([stage, info]) => {
                  const stageEnum = stage as AnalysisStage;
                  const status = getStageStatus(stageEnum);
                  const progress = stageProgress[stageEnum] || 0;
                  
                  return (
                    <div
                      key={stage}
                      className={cn(
                        'flex items-center space-x-3 p-2 rounded-lg transition-colors',
                        status === 'active' && 'bg-blue-50 border border-blue-200',
                        status === 'complete' && 'bg-green-50',
                        status === 'pending' && 'bg-gray-50'
                      )}
                    >
                      {renderStageIcon(stageEnum, status === 'active', status === 'complete')}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            'text-sm font-medium',
                            status === 'active' && 'text-blue-900',
                            status === 'complete' && 'text-green-900',
                            status === 'pending' && 'text-gray-700'
                          )}>
                            {info.label}
                          </span>
                          {status === 'active' && progress > 0 && (
                            <span className="text-xs text-blue-600">
                              {Math.round(progress)}%
                            </span>
                          )}
                        </div>
                        {status === 'active' && progress > 0 && (
                          <div className="mt-1">
                            <Progress value={progress} className="h-1" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Recent Updates */}
        {recentUpdates.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Recent Updates</h4>
            <div className="space-y-1">
              {recentUpdates.map((update, index) => (
                <div key={index} className="text-xs text-gray-600 flex items-center justify-between">
                  <span className="truncate">
                    {update.type.replace(/-/g, ' ').replace(/_/g, ' ')}
                  </span>
                  <span className="text-gray-400 ml-2">
                    {update.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {currentStage === AnalysisStage.ERROR && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-900">Analysis Failed</span>
            </div>
            <p className="text-xs text-red-700 mt-1">
              An error occurred during analysis. Please try again or contact support.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};