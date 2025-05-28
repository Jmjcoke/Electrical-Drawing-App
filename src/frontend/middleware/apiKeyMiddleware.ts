import { NextRequest, NextResponse } from 'next/server';
import { getAPIConfig } from '@/config/apiKeys';

export interface APIKeyMiddlewareOptions {
  requiredProviders?: string[];
  requiredFeatures?: string[];
}

/**
 * Middleware to check API key configuration for protected API routes
 */
export async function withAPIKeyCheck(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: APIKeyMiddlewareOptions = {}
) {
  return async (request: NextRequest) => {
    try {
      const config = getAPIConfig();
      
      // Check if any API keys are configured
      const hasOpenAI = !!config.openai?.apiKey;
      const hasComputerVision = !!config.computerVision?.apiKey;
      const hasCustomML = !!config.customML?.apiKey;
      
      if (!hasOpenAI && !hasComputerVision && !hasCustomML) {
        return NextResponse.json(
          {
            error: 'No API keys configured',
            message: 'Please configure at least one AI provider API key',
            code: 'API_KEYS_NOT_CONFIGURED',
          },
          { status: 503 }
        );
      }
      
      // Check required providers
      if (options.requiredProviders && options.requiredProviders.length > 0) {
        const configuredProviders: string[] = [];
        if (hasOpenAI) configuredProviders.push('openai');
        if (hasComputerVision) configuredProviders.push(config.computerVision!.provider);
        if (hasCustomML) configuredProviders.push('custom');
        
        const missingProviders = options.requiredProviders.filter(
          provider => !configuredProviders.includes(provider)
        );
        
        if (missingProviders.length > 0) {
          return NextResponse.json(
            {
              error: 'Required providers not configured',
              message: `The following providers are required: ${missingProviders.join(', ')}`,
              code: 'REQUIRED_PROVIDERS_MISSING',
              missingProviders,
            },
            { status: 503 }
          );
        }
      }
      
      // Add API configuration to request headers for downstream use
      const headers = new Headers(request.headers);
      headers.set('X-AI-Providers', JSON.stringify({
        openai: hasOpenAI,
        computerVision: hasComputerVision ? config.computerVision!.provider : null,
        customML: hasCustomML,
      }));
      
      // Create a new request with updated headers
      const modifiedRequest = new NextRequest(request, { headers });
      
      // Call the actual handler
      return handler(modifiedRequest);
    } catch (error) {
      console.error('API key middleware error:', error);
      return NextResponse.json(
        {
          error: 'Internal server error',
          message: 'Failed to check API key configuration',
          code: 'MIDDLEWARE_ERROR',
        },
        { status: 500 }
      );
    }
  };
}