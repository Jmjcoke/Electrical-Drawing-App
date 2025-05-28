'use client';

import React, { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { AlertCircle, Play, Square, RefreshCw } from 'lucide-react';

interface TrainingJob {
  id: string;
  name: string;
  modelType: 'component_detection' | 'circuit_analysis' | 'symbol_recognition';
  status: 'initializing' | 'running' | 'completed' | 'failed' | 'stopped';
  progress: number;
  startTime: string;
  estimatedTimeRemaining?: string;
  stages: TrainingStage[];
  metrics?: TrainingMetrics;
  datasetIds: string[];
  parameters: TrainingParameters;
}

interface TrainingStage {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime?: string;
  endTime?: string;
  logs?: string[];
}

interface TrainingMetrics {
  accuracy: number;
  loss: number;
  precision: number;
  recall: number;
  f1Score: number;
  classMetrics: Record<string, { precision: number; recall: number; f1: number }>;
}

interface TrainingParameters {
  epochs: number;
  batchSize: number;
  learningRate: number;
  validationSplit: number;
  augmentDataset: boolean;
  modelArchitecture: string;
}

interface StartTrainingRequest {
  datasetIds: string[];
  modelType: string;
  parameters: TrainingParameters;
}

export const AITrainingInterface: React.FC = () => {
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [modelType, setModelType] = useState<string>('component_detection');
  const [parameters, setParameters] = useState<TrainingParameters>({
    epochs: 100,
    batchSize: 32,
    learningRate: 0.001,
    validationSplit: 0.2,
    augmentDataset: true,
    modelArchitecture: 'yolov8n'
  });
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Available datasets query
  const { data: datasetsResponse, isLoading: datasetsLoading } = useQuery({
    queryKey: ['training-datasets'],
    queryFn: async () => {
      const response = await fetch('/api/training/datasets');
      if (!response.ok) throw new Error('Failed to fetch datasets');
      return response.json();
    }
  });

  const datasets = datasetsResponse?.data || [];

  // Active training job status
  const { data: activeJob, refetch: refetchJobStatus } = useQuery({
    queryKey: ['training-status', activeJobId],
    queryFn: async () => {
      if (!activeJobId) return null;
      const response = await fetch(`/api/training/status/${activeJobId}`);
      if (!response.ok) throw new Error('Failed to fetch job status');
      return response.json();
    },
    enabled: !!activeJobId,
    refetchInterval: 2000,
  });

  // Start training mutation
  const startTrainingMutation = useMutation({
    mutationFn: async (request: StartTrainingRequest) => {
      const response = await fetch('/api/training/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error('Failed to start training');
      return response.json();
    },
    onSuccess: (data) => {
      setActiveJobId(data.id);
    },
  });

  // Stop training mutation
  const stopTrainingMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`/api/training/stop/${jobId}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to stop training');
      return response.json();
    },
    onSuccess: () => {
      refetchJobStatus();
    },
  });

  const handleStartTraining = useCallback(() => {
    if (selectedDatasets.length === 0) return;
    
    startTrainingMutation.mutate({
      datasetIds: selectedDatasets,
      modelType,
      parameters,
    });
  }, [selectedDatasets, modelType, parameters, startTrainingMutation]);

  const handleStopTraining = useCallback(() => {
    if (activeJobId) {
      stopTrainingMutation.mutate(activeJobId);
    }
  }, [activeJobId, stopTrainingMutation]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'running': return 'bg-blue-500';
      case 'failed': return 'bg-red-500';
      case 'stopped': return 'bg-gray-500';
      default: return 'bg-yellow-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Training Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>AI Model Training Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Dataset Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Training Datasets</label>
            {datasetsLoading ? (
              <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {datasets.map((dataset: any) => (
                <div
                  key={dataset.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedDatasets.includes(dataset.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    setSelectedDatasets(prev =>
                      prev.includes(dataset.id)
                        ? prev.filter(id => id !== dataset.id)
                        : [...prev, dataset.id]
                    );
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{dataset.name}</h4>
                      <p className="text-sm text-gray-600">{dataset.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {dataset.itemCount} items • {dataset.type}
                      </p>
                    </div>
                    <Badge variant={dataset.status === 'ready' ? 'default' : 'secondary'}>
                      {dataset.status}
                    </Badge>
                  </div>
                </div>
                ))}
              </div>
            )}
          </div>

          {/* Model Type Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Model Type</label>
            <select
              value={modelType}
              onChange={(e) => setModelType(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="component_detection">Component Detection</option>
              <option value="circuit_analysis">Circuit Analysis</option>
              <option value="symbol_recognition">Symbol Recognition</option>
            </select>
          </div>

          {/* Training Parameters */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Epochs</label>
              <input
                type="number"
                value={parameters.epochs}
                onChange={(e) => setParameters(prev => ({ ...prev, epochs: parseInt(e.target.value) }))}
                className="w-full p-2 border border-gray-300 rounded-md"
                min="10"
                max="1000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Batch Size</label>
              <input
                type="number"
                value={parameters.batchSize}
                onChange={(e) => setParameters(prev => ({ ...prev, batchSize: parseInt(e.target.value) }))}
                className="w-full p-2 border border-gray-300 rounded-md"
                min="1"
                max="128"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Learning Rate</label>
              <input
                type="number"
                value={parameters.learningRate}
                onChange={(e) => setParameters(prev => ({ ...prev, learningRate: parseFloat(e.target.value) }))}
                className="w-full p-2 border border-gray-300 rounded-md"
                min="0.0001"
                max="0.1"
                step="0.0001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Validation Split</label>
              <input
                type="number"
                value={parameters.validationSplit}
                onChange={(e) => setParameters(prev => ({ ...prev, validationSplit: parseFloat(e.target.value) }))}
                className="w-full p-2 border border-gray-300 rounded-md"
                min="0.1"
                max="0.5"
                step="0.05"
              />
            </div>
          </div>

          {/* Advanced Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="augment"
                checked={parameters.augmentDataset}
                onChange={(e) => setParameters(prev => ({ ...prev, augmentDataset: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="augment" className="text-sm">Data Augmentation</label>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Model Architecture</label>
              <select
                value={parameters.modelArchitecture}
                onChange={(e) => setParameters(prev => ({ ...prev, modelArchitecture: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="yolov8n">YOLOv8 Nano (Fast)</option>
                <option value="yolov8s">YOLOv8 Small</option>
                <option value="yolov8m">YOLOv8 Medium</option>
                <option value="yolov8l">YOLOv8 Large (Accurate)</option>
              </select>
            </div>
          </div>

          {/* Start Training Button */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {selectedDatasets.length} dataset(s) selected
            </div>
            <Button
              onClick={handleStartTraining}
              disabled={selectedDatasets.length === 0 || startTrainingMutation.isPending || !!activeJob}
              className="flex items-center space-x-2"
            >
              <Play className="w-4 h-4" />
              <span>
                {startTrainingMutation.isPending ? 'Starting...' : 'Start Training'}
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Training Job */}
      {activeJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Training Progress: {activeJob.name}</span>
              <div className="flex items-center space-x-2">
                <Badge className={getStatusColor(activeJob.status)} variant="secondary">
                  {activeJob.status}
                </Badge>
                {activeJob.status === 'running' && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleStopTraining}
                    disabled={stopTrainingMutation.isPending}
                  >
                    <Square className="w-4 h-4 mr-1" />
                    Stop
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => refetchJobStatus()}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Progress */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm text-gray-600">{activeJob.progress}%</span>
              </div>
              <Progress value={activeJob.progress} className="w-full" />
              {activeJob.estimatedTimeRemaining && (
                <p className="text-xs text-gray-500 mt-1">
                  Estimated time remaining: {activeJob.estimatedTimeRemaining}
                </p>
              )}
            </div>

            {/* Training Stages */}
            <div>
              <h4 className="text-sm font-medium mb-3">Training Stages</h4>
              <div className="space-y-3">
                {activeJob.stages.map((stage, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(stage.status)}`} />
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium capitalize">
                          {stage.name.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-500">{stage.progress}%</span>
                      </div>
                      {stage.status === 'running' && (
                        <Progress value={stage.progress} className="w-full h-1" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          
            {/* Training Metrics */}
            {activeJob.metrics && (
              <div>
                <h4 className="text-sm font-medium mb-3">Current Metrics</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">
                      {(activeJob.metrics.accuracy * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600">Accuracy</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">
                      {activeJob.metrics.loss.toFixed(3)}
                    </div>
                    <div className="text-xs text-gray-600">Loss</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">
                      {(activeJob.metrics.precision * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600">Precision</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-orange-600">
                      {(activeJob.metrics.recall * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600">Recall</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-600">
                      {(activeJob.metrics.f1Score * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-600">F1 Score</div>
                  </div>
                </div>
              </div>
            )}

            {/* Class-specific Metrics */}
            {activeJob.metrics?.classMetrics && (
              <div>
                <h4 className="text-sm font-medium mb-3">Class Performance</h4>
                <div className="space-y-2">
                  {Object.entries(activeJob.metrics.classMetrics).map(([className, metrics]) => (
                    <div key={className} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium capitalize">
                        {className.replace('_', ' ')}
                      </span>
                      <div className="flex space-x-4 text-xs">
                        <span>P: {(metrics.precision * 100).toFixed(0)}%</span>
                        <span>R: {(metrics.recall * 100).toFixed(0)}%</span>
                        <span>F1: {(metrics.f1 * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Training History */}
      <Card>
        <CardHeader>
          <CardTitle>Training History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600">
            Previous training jobs will appear here. Feature coming soon.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};