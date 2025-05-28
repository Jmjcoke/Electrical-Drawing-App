'use client';

import React from 'react';
import { TrainingJobManager } from '@/components/ai/training/TrainingJobManager';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import {
  TrainingJob,
  TrainingJobStatus,
  ModelType,
  TrainingMetrics,
} from '@/types/ai/trainingData';

// Mock data - replace with actual API calls
const mockJobs: TrainingJob[] = [
  {
    id: '1',
    name: 'Component Detection Model v2.1',
    modelType: 'component_detection' as ModelType,
    status: 'training' as TrainingJobStatus,
    progress: 67,
    datasetIds: ['1', '2', '3'],
    parameters: {
      epochs: 50,
      batchSize: 32,
      learningRate: 0.001,
      optimizer: 'adam',
    },
    metrics: {
      accuracy: 0.8234,
      loss: 0.4532,
      precision: 0.8156,
      recall: 0.8312,
      f1Score: 0.8233,
      validationAccuracy: 0.8012,
      validationLoss: 0.4821,
    } as TrainingMetrics,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    startedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
    createdBy: 'user123',
  },
  {
    id: '2',
    name: 'Symbol Recognition Model v1.0',
    modelType: 'symbol_recognition' as ModelType,
    status: 'completed' as TrainingJobStatus,
    progress: 100,
    datasetIds: ['4', '5'],
    parameters: {
      epochs: 30,
      batchSize: 16,
      learningRate: 0.0005,
      optimizer: 'sgd',
    },
    metrics: {
      accuracy: 0.9123,
      loss: 0.2341,
      precision: 0.9087,
      recall: 0.9156,
      f1Score: 0.9121,
      validationAccuracy: 0.8956,
      validationLoss: 0.2567,
    } as TrainingMetrics,
    modelOutputPath: '/models/symbol-recognition-v1.0.h5',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    startedAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
    createdBy: 'user123',
  },
  {
    id: '3',
    name: 'Circuit Tracing Model v3.0',
    modelType: 'circuit_tracing' as ModelType,
    status: 'queued' as TrainingJobStatus,
    datasetIds: ['6', '7', '8'],
    parameters: {
      epochs: 100,
      batchSize: 64,
      learningRate: 0.001,
      optimizer: 'adam',
    },
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    createdBy: 'user123',
  },
  {
    id: '4',
    name: 'Component Detection Model v2.0',
    modelType: 'component_detection' as ModelType,
    status: 'failed' as TrainingJobStatus,
    progress: 23,
    datasetIds: ['1', '2'],
    parameters: {
      epochs: 50,
      batchSize: 128,
      learningRate: 0.01,
      optimizer: 'adam',
    },
    error: 'Out of memory: Batch size too large for available GPU memory',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(),
    completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
    createdBy: 'user123',
  },
];

export default function TrainingJobsPage() {
  const handleStartJob = (jobId: string) => {
    console.log('Starting job:', jobId);
    // API call to start training job
  };

  const handleStopJob = (jobId: string) => {
    console.log('Stopping job:', jobId);
    // API call to stop training job
  };

  const handleDeployModel = (jobId: string) => {
    console.log('Deploying model from job:', jobId);
    // API call to deploy model
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Training Jobs</h1>
          <p className="text-gray-600 mt-2">
            Manage and monitor AI model training jobs
          </p>
        </div>
        <a href="/training/start">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Training Job
          </Button>
        </a>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Jobs</p>
              <p className="text-2xl font-semibold mt-1">
                {mockJobs.filter(j => j.status === 'training').length}
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-semibold mt-1">
                {mockJobs.filter(j => j.status === 'completed').length}
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <div className="text-green-600 text-2xl">✓</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Queued</p>
              <p className="text-2xl font-semibold mt-1">
                {mockJobs.filter(j => j.status === 'queued').length}
              </p>
            </div>
            <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <div className="text-yellow-600 text-xl">⏱</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Failed</p>
              <p className="text-2xl font-semibold mt-1">
                {mockJobs.filter(j => j.status === 'failed').length}
              </p>
            </div>
            <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
              <div className="text-red-600 text-xl">!</div>
            </div>
          </div>
        </div>
      </div>

      {/* Training Job Manager */}
      <TrainingJobManager
        jobs={mockJobs}
        onStartJob={handleStartJob}
        onStopJob={handleStopJob}
        onDeployModel={handleDeployModel}
      />
    </div>
  );
}