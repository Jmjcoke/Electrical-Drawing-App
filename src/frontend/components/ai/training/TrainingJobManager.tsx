'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
import {
  TrainingJob,
  TrainingJobStatus,
  ModelType,
  TrainingMetrics,
} from '@/types/ai/trainingData';
import {
  Play,
  Pause,
  StopCircle,
  Download,
  ChevronRight,
  Clock,
  Cpu,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

interface TrainingJobManagerProps {
  jobs: TrainingJob[];
  onStartJob?: (jobId: string) => void;
  onStopJob?: (jobId: string) => void;
  onDeployModel?: (jobId: string) => void;
  className?: string;
}

export const TrainingJobManager: React.FC<TrainingJobManagerProps> = ({
  jobs,
  onStartJob,
  onStopJob,
  onDeployModel,
  className,
}) => {
  const [selectedJob, setSelectedJob] = useState<TrainingJob | null>(
    jobs.length > 0 ? jobs[0] : null
  );

  const getStatusColor = (status: TrainingJobStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'training':
        return 'bg-blue-500';
      case 'failed':
        return 'bg-red-500';
      case 'queued':
        return 'bg-yellow-500';
      case 'cancelled':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: TrainingJobStatus) => {
    switch (status) {
      case 'training':
        return <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />;
      case 'completed':
        return <div className="text-white">✓</div>;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-white" />;
      default:
        return null;
    }
  };

  const formatDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = end.getTime() - start.getTime();
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className={cn('training-job-manager', className)}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Job List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Training Jobs</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    className={cn(
                      'p-4 cursor-pointer hover:bg-gray-50 transition-colors',
                      selectedJob?.id === job.id && 'bg-blue-50'
                    )}
                    onClick={() => setSelectedJob(job)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{job.name}</h4>
                        <p className="text-xs text-gray-600 mt-1">
                          {job.modelType} • {job.datasetIds.length} datasets
                        </p>
                        <div className="flex items-center mt-2 space-x-2">
                          <div
                            className={cn(
                              'h-2 w-2 rounded-full',
                              getStatusColor(job.status)
                            )}
                          />
                          <span className="text-xs text-gray-600">
                            {job.status}
                          </span>
                          {job.progress && (
                            <span className="text-xs text-gray-600">
                              • {job.progress}%
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400 mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Job Details */}
        <div className="lg:col-span-2">
          {selectedJob ? (
            <div className="space-y-4">
              {/* Job Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedJob.name}</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        Created {new Date(selectedJob.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          'flex items-center space-x-1',
                          selectedJob.status === 'training' && 'animate-pulse'
                        )}
                      >
                        <div
                          className={cn(
                            'h-2 w-2 rounded-full',
                            getStatusColor(selectedJob.status)
                          )}
                        />
                        <span>{selectedJob.status}</span>
                      </Badge>
                      {selectedJob.status === 'queued' && (
                        <Button
                          size="sm"
                          onClick={() => onStartJob?.(selectedJob.id)}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Start
                        </Button>
                      )}
                      {selectedJob.status === 'training' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onStopJob?.(selectedJob.id)}
                        >
                          <StopCircle className="h-4 w-4 mr-1" />
                          Stop
                        </Button>
                      )}
                      {selectedJob.status === 'completed' && (
                        <Button
                          size="sm"
                          onClick={() => onDeployModel?.(selectedJob.id)}
                        >
                          Deploy Model
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Progress Bar */}
                  {selectedJob.progress !== undefined && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Progress</span>
                        <span className="text-sm font-medium">
                          {selectedJob.progress}%
                        </span>
                      </div>
                      <Progress value={selectedJob.progress} className="h-2" />
                    </div>
                  )}

                  {/* Job Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Model Type:</span>
                      <p className="font-medium">{selectedJob.modelType}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Duration:</span>
                      <p className="font-medium">
                        {formatDuration(selectedJob.startedAt || selectedJob.createdAt, selectedJob.completedAt)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Datasets:</span>
                      <p className="font-medium">{selectedJob.datasetIds.length}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Parameters:</span>
                      <p className="font-medium">
                        {Object.keys(selectedJob.parameters).length} configured
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Training Metrics */}
              {selectedJob.metrics && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Training Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="performance" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="performance">Performance</TabsTrigger>
                        <TabsTrigger value="accuracy">Accuracy</TabsTrigger>
                        <TabsTrigger value="logs">Logs</TabsTrigger>
                      </TabsList>

                      <TabsContent value="performance" className="mt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Loss</span>
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            </div>
                            <p className="text-2xl font-semibold mt-2">
                              {selectedJob.metrics.loss.toFixed(4)}
                            </p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Accuracy</span>
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            </div>
                            <p className="text-2xl font-semibold mt-2">
                              {(selectedJob.metrics.accuracy * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Precision</span>
                              <TrendingUp className="h-4 w-4 text-blue-500" />
                            </div>
                            <p className="text-2xl font-semibold mt-2">
                              {(selectedJob.metrics.precision * 100).toFixed(1)}%
                            </p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Recall</span>
                              <TrendingUp className="h-4 w-4 text-blue-500" />
                            </div>
                            <p className="text-2xl font-semibold mt-2">
                              {(selectedJob.metrics.recall * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="accuracy" className="mt-4">
                        <div className="space-y-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-600">
                                Training Accuracy
                              </span>
                              <span className="text-sm font-medium">
                                {(selectedJob.metrics.accuracy * 100).toFixed(1)}%
                              </span>
                            </div>
                            <Progress
                              value={selectedJob.metrics.accuracy * 100}
                              className="h-2"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-gray-600">
                                Validation Accuracy
                              </span>
                              <span className="text-sm font-medium">
                                {(selectedJob.metrics.validationAccuracy * 100).toFixed(1)}%
                              </span>
                            </div>
                            <Progress
                              value={selectedJob.metrics.validationAccuracy * 100}
                              className="h-2"
                            />
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="logs" className="mt-4">
                        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                          <div>2024-01-20 10:15:32 - Starting training job...</div>
                          <div>2024-01-20 10:15:33 - Loading datasets...</div>
                          <div>2024-01-20 10:15:45 - Datasets loaded: 3 datasets, 1,250 samples</div>
                          <div>2024-01-20 10:15:46 - Initializing model architecture...</div>
                          <div>2024-01-20 10:15:50 - Starting training loop...</div>
                          <div>2024-01-20 10:16:15 - Epoch 1/50 - Loss: 0.8234, Accuracy: 0.7512</div>
                          <div>2024-01-20 10:16:45 - Epoch 2/50 - Loss: 0.6123, Accuracy: 0.8234</div>
                          <div className="text-green-400">
                            2024-01-20 10:17:15 - Epoch 3/50 - Loss: 0.4532, Accuracy: 0.8756
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}

              {/* Model Output */}
              {selectedJob.status === 'completed' && selectedJob.modelOutputPath && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Model Output</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-sm">Trained Model</p>
                          <p className="text-xs text-gray-600 mt-1">
                            {selectedJob.modelOutputPath}
                          </p>
                        </div>
                        <Button size="sm" variant="outline">
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button className="flex-1" onClick={() => onDeployModel?.(selectedJob.id)}>
                          Deploy to Production
                        </Button>
                        <Button variant="outline" className="flex-1">
                          Test Model
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent>
                <p className="text-gray-500">Select a training job to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};