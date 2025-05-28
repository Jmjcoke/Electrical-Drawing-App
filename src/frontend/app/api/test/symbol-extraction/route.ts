import { NextRequest, NextResponse } from 'next/server';
import { getAPIConfig } from '@/config/apiKeys';

// Mock symbol extraction for testing without actual API calls
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const options = formData.get('options') ? 
      JSON.parse(formData.get('options') as string) : {};

    // Check API configuration
    const apiConfig = getAPIConfig();
    const availableProviders = [];

    if (apiConfig.openai.configured) availableProviders.push('openai');
    if (apiConfig.azureComputerVision.configured) availableProviders.push('azure');
    if (apiConfig.googleCloudVision.configured) availableProviders.push('google');

    if (availableProviders.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No AI providers configured. Please add API keys in settings.',
      }, { status: 400 });
    }

    // Simulate job creation
    const jobId = `test-${Date.now()}`;

    // Mock response
    const mockJob = {
      jobId,
      status: 'processing',
      progress: {
        current: 0,
        total: 100,
        stage: 'uploading',
      },
      startedAt: new Date().toISOString(),
      filename: file.name,
      provider: availableProviders[0],
    };

    // Simulate processing stages
    setTimeout(() => {
      // This would normally be handled by WebSocket
      console.log('Processing stages for job:', jobId);
    }, 1000);

    return NextResponse.json({
      success: true,
      data: mockJob,
    });
  } catch (error) {
    console.error('Test symbol extraction error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// Mock job status endpoint
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({
      success: false,
      error: 'Job ID required',
    }, { status: 400 });
  }

  // Mock completed job with extracted symbols
  const mockJob = {
    jobId,
    status: 'completed',
    progress: {
      current: 100,
      total: 100,
      stage: 'validation',
    },
    startedAt: new Date(Date.now() - 120000).toISOString(),
    completedAt: new Date().toISOString(),
    results: {
      extractedSymbols: [
        {
          id: `${jobId}-sym-1`,
          imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          boundingBox: {
            page: 1,
            x: 100,
            y: 150,
            width: 80,
            height: 80,
          },
          description: 'Circuit Breaker - 3 Pole, 20A',
          symbolCode: 'CB-3P-20A',
          category: 'Protection Devices',
          electricalStandard: 'NEC',
          confidence: 0.94,
          ocrConfidence: 0.91,
          extractionMethod: 'ml',
          verified: false,
        },
        {
          id: `${jobId}-sym-2`,
          imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          boundingBox: {
            page: 1,
            x: 200,
            y: 150,
            width: 80,
            height: 80,
          },
          description: 'Motor - Three Phase, 10HP',
          symbolCode: 'M-3PH-10HP',
          category: 'Motors',
          electricalStandard: 'NEC',
          confidence: 0.89,
          ocrConfidence: 0.87,
          extractionMethod: 'ml',
          verified: false,
        },
        {
          id: `${jobId}-sym-3`,
          imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
          boundingBox: {
            page: 2,
            x: 100,
            y: 250,
            width: 80,
            height: 80,
          },
          description: 'Transformer - Step Down, 480V to 120V',
          symbolCode: 'XFMR-SD-480-120',
          category: 'Power Distribution',
          electricalStandard: 'NEC',
          confidence: 0.92,
          ocrConfidence: 0.95,
          extractionMethod: 'ml',
          verified: false,
        },
      ],
      statistics: {
        totalPages: 3,
        totalSymbols: 45,
        symbolsByCategory: {
          'Protection Devices': 12,
          'Motors': 8,
          'Power Distribution': 10,
          'Switches': 9,
          'Other': 6,
        },
        averageConfidence: 0.91,
      },
    },
  };

  return NextResponse.json({
    success: true,
    data: mockJob,
  });
}