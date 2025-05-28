/**
 * Server-side API Key Validator
 * 
 * This module provides server-side validation for API keys
 * and should never be imported in client-side code.
 */

import { getAPIConfig, APIKeyConfig } from '@/config/apiKeys';

export interface APIValidationResult {
  isValid: boolean;
  provider: string;
  error?: string;
  features?: string[];
  metadata?: Record<string, any>;
}

/**
 * Validate all configured API keys
 */
export async function validateConfiguredAPIKeys(): Promise<APIValidationResult[]> {
  const config = getAPIConfig();
  const results: APIValidationResult[] = [];

  // Validate OpenAI
  if (config.openai?.apiKey) {
    results.push(await validateOpenAIKey(config.openai.apiKey));
  }

  // Validate Computer Vision
  if (config.computerVision?.apiKey) {
    if (config.computerVision.provider === 'azure') {
      results.push(await validateAzureComputerVision(
        config.computerVision.apiKey,
        config.computerVision.endpoint
      ));
    } else if (config.computerVision.provider === 'google') {
      results.push(await validateGoogleCloudVision(config.computerVision.apiKey));
    }
  }

  // Validate Custom ML
  if (config.customML?.apiKey && config.customML.endpoint) {
    results.push(await validateCustomMLEndpoint(
      config.customML.endpoint,
      config.customML.apiKey
    ));
  }

  return results;
}

/**
 * Validate OpenAI API key
 */
async function validateOpenAIKey(apiKey: string): Promise<APIValidationResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const visionModels = data.data.filter((model: any) => 
        model.id.includes('vision') || model.id === 'gpt-4'
      );

      return {
        isValid: true,
        provider: 'openai',
        features: ['text-extraction', 'symbol-description', 'vision-analysis'],
        metadata: {
          availableModels: visionModels.map((m: any) => m.id),
        },
      };
    } else {
      const error = await response.text();
      return {
        isValid: false,
        provider: 'openai',
        error: `OpenAI API error: ${response.status}`,
      };
    }
  } catch (error) {
    return {
      isValid: false,
      provider: 'openai',
      error: `Failed to validate OpenAI key: ${error}`,
    };
  }
}

/**
 * Validate Azure Computer Vision API key
 */
async function validateAzureComputerVision(
  apiKey: string,
  endpoint?: string
): Promise<APIValidationResult> {
  if (!endpoint) {
    return {
      isValid: false,
      provider: 'azure',
      error: 'Azure endpoint URL is required',
    };
  }

  try {
    const response = await fetch(`${endpoint}/vision/v3.2/analyze?visualFeatures=Categories`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://via.placeholder.com/1x1', // Minimal test image
      }),
    });

    if (response.ok || response.status === 400) { // 400 is expected for invalid image
      return {
        isValid: true,
        provider: 'azure',
        features: ['symbol-detection', 'object-recognition', 'ocr', 'image-analysis'],
        metadata: {
          endpoint,
          region: endpoint.match(/https:\/\/([^.]+)/)?.[1],
        },
      };
    } else {
      return {
        isValid: false,
        provider: 'azure',
        error: `Azure API error: ${response.status}`,
      };
    }
  } catch (error) {
    return {
      isValid: false,
      provider: 'azure',
      error: `Failed to validate Azure key: ${error}`,
    };
  }
}

/**
 * Validate Google Cloud Vision API key
 */
async function validateGoogleCloudVision(apiKey: string): Promise<APIValidationResult> {
  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            image: {
              content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            },
            features: [{ type: 'LABEL_DETECTION', maxResults: 1 }],
          }],
        }),
      }
    );

    if (response.ok) {
      return {
        isValid: true,
        provider: 'google',
        features: ['symbol-detection', 'text-detection', 'object-localization'],
      };
    } else {
      const error = await response.json();
      return {
        isValid: false,
        provider: 'google',
        error: error.error?.message || 'Invalid API key',
      };
    }
  } catch (error) {
    return {
      isValid: false,
      provider: 'google',
      error: `Failed to validate Google key: ${error}`,
    };
  }
}

/**
 * Validate custom ML model endpoint
 */
async function validateCustomMLEndpoint(
  endpoint: string,
  apiKey: string
): Promise<APIValidationResult> {
  try {
    // Try to hit a health check endpoint
    const healthResponse = await fetch(`${endpoint}/health`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      return {
        isValid: true,
        provider: 'custom',
        features: ['custom-inference'],
        metadata: healthData,
      };
    }

    // Fallback: try to get model info
    const infoResponse = await fetch(`${endpoint}/info`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (infoResponse.ok) {
      return {
        isValid: true,
        provider: 'custom',
        features: ['custom-inference'],
      };
    }

    return {
      isValid: false,
      provider: 'custom',
      error: 'Unable to connect to custom ML endpoint',
    };
  } catch (error) {
    return {
      isValid: false,
      provider: 'custom',
      error: `Failed to validate custom endpoint: ${error}`,
    };
  }
}

/**
 * Get the best available provider based on validation results
 */
export function getBestAvailableProvider(
  validationResults: APIValidationResult[]
): string | null {
  const validProviders = validationResults.filter(r => r.isValid);
  
  // Priority order: OpenAI > Azure > Google > Custom
  const priorityOrder = ['openai', 'azure', 'google', 'custom'];
  
  for (const provider of priorityOrder) {
    if (validProviders.find(r => r.provider === provider)) {
      return provider;
    }
  }
  
  return null;
}