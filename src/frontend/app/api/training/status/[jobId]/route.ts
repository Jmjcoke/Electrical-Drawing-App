import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    // In production, this would query your database for the actual job status
    // For now, we'll simulate a completed training job with realistic metrics

    const mockTrainingJob = {
      id: jobId,
      name: 'Component Detection Model v1.0',
      modelType: 'component_detection',
      status: 'completed',
      progress: 100,
      datasetIds: ['extracted-symbols-1', 'manufacturer-legends-1'],
      parameters: {
        epochs: 50,
        batchSize: 32,
        learningRate: 0.001,
        optimizer: 'adam',
        dataAugmentation: true,
        validationSplit: 0.2
      },
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      startedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
      createdBy: 'user',
      
      // Training metrics (realistic values for electrical symbol detection)
      metrics: {
        accuracy: 0.924,
        loss: 0.231,
        precision: 0.918,
        recall: 0.931,
        f1Score: 0.924,
        validationAccuracy: 0.891,
        validationLoss: 0.287,
        
        // Per-class metrics
        classMetrics: {
          'circuit_breaker': { precision: 0.95, recall: 0.92, f1: 0.93 },
          'motor': { precision: 0.89, recall: 0.94, f1: 0.91 },
          'transformer': { precision: 0.91, recall: 0.88, f1: 0.89 },
          'switch': { precision: 0.93, recall: 0.90, f1: 0.91 },
          'fuse': { precision: 0.87, recall: 0.89, f1: 0.88 }
        },
        
        // Training history
        epochHistory: [
          { epoch: 1, loss: 2.341, accuracy: 0.423, valLoss: 2.187, valAccuracy: 0.451 },
          { epoch: 10, loss: 1.234, accuracy: 0.672, valLoss: 1.298, valAccuracy: 0.634 },
          { epoch: 20, loss: 0.678, accuracy: 0.789, valLoss: 0.734, valAccuracy: 0.756 },
          { epoch: 30, loss: 0.445, accuracy: 0.834, valLoss: 0.523, valAccuracy: 0.812 },
          { epoch: 40, loss: 0.312, accuracy: 0.887, valLoss: 0.398, valAccuracy: 0.856 },
          { epoch: 50, loss: 0.231, accuracy: 0.924, valLoss: 0.287, valAccuracy: 0.891 }
        ]
      },
      
      // Model output
      modelOutputPath: `/models/${jobId}/electrical-symbols-detector-v1.0.h5`,
      modelSize: '15.2 MB',
      trainingDataSize: '2,847 images',
      
      // Training stages
      stages: [
        { name: 'data_preparation', status: 'completed', progress: 100, completedAt: new Date(Date.now() - 24 * 60 * 1000).toISOString() },
        { name: 'model_initialization', status: 'completed', progress: 100, completedAt: new Date(Date.now() - 23 * 60 * 1000).toISOString() },
        { name: 'training', status: 'completed', progress: 100, completedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString() },
        { name: 'validation', status: 'completed', progress: 100, completedAt: new Date(Date.now() - 6 * 60 * 1000).toISOString() },
        { name: 'model_export', status: 'completed', progress: 100, completedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() }
      ],
      
      // Training logs (last few entries)
      logs: [
        { timestamp: new Date(Date.now() - 6 * 60 * 1000).toISOString(), level: 'info', message: 'Validation complete - Accuracy: 89.1%' },
        { timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), level: 'info', message: 'Model export started' },
        { timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), level: 'success', message: 'Training completed successfully!' },
        { timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), level: 'info', message: 'Model saved to: /models/electrical-symbols-detector-v1.0.h5' }
      ]
    };

    return NextResponse.json({
      success: true,
      data: mockTrainingJob
    });

  } catch (error) {
    console.error('Training status error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}