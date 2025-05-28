import { NextRequest, NextResponse } from 'next/server';
import { getAPIConfig, maskAPIKey } from '@/config/apiKeys';

export async function GET(request: NextRequest) {
  try {
    const config = getAPIConfig();
    
    // Return masked configuration status
    const status = {
      providers: {
        openai: {
          configured: config.openai.configured,
          maskedKey: maskAPIKey(config.openai.key),
        },
        azureComputerVision: {
          configured: config.azureComputerVision.configured,
          maskedKey: maskAPIKey(config.azureComputerVision.key),
          hasEndpoint: !!config.azureComputerVision.endpoint,
        },
        googleCloudVision: {
          configured: config.googleCloudVision.configured,
          maskedKey: maskAPIKey(config.googleCloudVision.key),
        },
      },
    };
    
    return NextResponse.json(status);
  } catch (error) {
    console.error('API keys status error:', error);
    return NextResponse.json(
      { error: 'Failed to get API key status' },
      { status: 500 }
    );
  }
}