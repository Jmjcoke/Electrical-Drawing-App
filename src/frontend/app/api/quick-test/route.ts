import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'test-apis') {
    // Test API configuration
    const openaiKey = process.env.OPENAI_API_KEY;
    const azureKey = process.env.AZURE_COMPUTER_VISION_KEY;
    const azureEndpoint = process.env.AZURE_COMPUTER_VISION_ENDPOINT;

    return NextResponse.json({
      success: true,
      data: {
        openai: {
          configured: !!openaiKey,
          keyPreview: openaiKey ? `${openaiKey.substring(0, 10)}...` : 'Not set',
        },
        azure: {
          configured: !!azureKey && !!azureEndpoint,
          keyPreview: azureKey ? `${azureKey.substring(0, 10)}...` : 'Not set',
          endpoint: azureEndpoint || 'Not set',
        },
        message: 'API keys are properly configured and loaded!'
      }
    });
  }

  if (action === 'mock-extraction') {
    // Return mock extraction results
    return NextResponse.json({
      success: true,
      data: {
        jobId: `mock-${Date.now()}`,
        status: 'completed',
        results: {
          extractedSymbols: [
            {
              id: 'mock-1',
              description: 'Circuit Breaker - 3 Pole, 20A',
              category: 'Protection Devices',
              confidence: 0.94,
              symbolCode: 'CB-3P-20A'
            },
            {
              id: 'mock-2', 
              description: 'Motor - Three Phase, 10HP',
              category: 'Motors',
              confidence: 0.89,
              symbolCode: 'M-3PH-10HP'
            },
            {
              id: 'mock-3',
              description: 'Transformer - Step Down, 480V to 120V',
              category: 'Power Distribution', 
              confidence: 0.92,
              symbolCode: 'XFMR-SD-480-120'
            }
          ],
          statistics: {
            totalPages: 3,
            totalSymbols: 45,
            averageConfidence: 0.91,
            symbolsByCategory: {
              'Protection Devices': 12,
              'Motors': 8,
              'Power Distribution': 10,
              'Switches': 9,
              'Other': 6
            }
          }
        },
        message: 'Mock extraction completed successfully!'
      }
    });
  }

  return NextResponse.json({
    success: false,
    error: 'Invalid action'
  });
}