import { NextRequest, NextResponse } from 'next/server';
import { withAPIKeyCheck } from '@/middleware/apiKeyMiddleware';
import { getAPIConfig } from '@/config/apiKeys';

/**
 * POST /api/symbols/extract
 * Start symbol extraction process
 */
export const POST = withAPIKeyCheck(
  async (request: NextRequest) => {
    try {
      // Get form data
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const optionsStr = formData.get('options') as string;
      const providersStr = formData.get('providers') as string;
      
      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        );
      }
      
      const options = optionsStr ? JSON.parse(optionsStr) : {};
      const availableProviders = providersStr ? JSON.parse(providersStr) : [];
      
      // Get API configuration
      const config = getAPIConfig();
      
      // Forward to backend service with appropriate headers
      const backendFormData = new FormData();
      backendFormData.append('file', file);
      backendFormData.append('options', JSON.stringify(options));
      
      // Add provider-specific headers based on configuration
      const headers: Record<string, string> = {
        'Authorization': request.headers.get('Authorization') || '',
      };
      
      if (config.openai?.apiKey) {
        headers['X-OpenAI-API-Key'] = config.openai.apiKey;
        headers['X-OpenAI-Model'] = config.openai.model || 'gpt-4-vision-preview';
      }
      
      if (config.computerVision?.apiKey) {
        headers['X-CV-Provider'] = config.computerVision.provider;
        headers['X-CV-API-Key'] = config.computerVision.apiKey;
        if (config.computerVision.endpoint) {
          headers['X-CV-Endpoint'] = config.computerVision.endpoint;
        }
      }
      
      if (config.customML?.apiKey) {
        headers['X-Custom-ML-Endpoint'] = config.customML.endpoint;
        headers['X-Custom-ML-API-Key'] = config.customML.apiKey;
      }
      
      // Forward request to backend
      const backendUrl = process.env.AI_ANALYSIS_SERVICE_URL || 'http://localhost:8002';
      const response = await fetch(`${backendUrl}/api/v1/symbols/extract`, {
        method: 'POST',
        headers,
        body: backendFormData,
      });
      
      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json(
          { error: `Backend error: ${error}` },
          { status: response.status }
        );
      }
      
      const data = await response.json();
      return NextResponse.json(data);
      
    } catch (error) {
      console.error('Symbol extraction error:', error);
      return NextResponse.json(
        { error: 'Failed to process extraction request' },
        { status: 500 }
      );
    }
  },
  {
    // At least one provider must be configured
    requiredProviders: [],
  }
);