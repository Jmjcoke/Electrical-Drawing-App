// Server-side only configuration
// This file should only be imported in server components or API routes

export interface APIProvider {
  name: string;
  key: string | undefined;
  configured: boolean;
}

export interface APIConfig {
  openai: APIProvider;
  azureComputerVision: APIProvider & { endpoint?: string };
  googleCloudVision: APIProvider;
}

export const getAPIConfig = (): APIConfig => {
  // Only access process.env on server side
  if (typeof window !== 'undefined') {
    throw new Error('getAPIConfig can only be called on the server side');
  }

  return {
    openai: {
      name: 'OpenAI',
      key: process.env.OPENAI_API_KEY,
      configured: !!process.env.OPENAI_API_KEY,
    },
    azureComputerVision: {
      name: 'Azure Computer Vision',
      key: process.env.AZURE_COMPUTER_VISION_KEY,
      endpoint: process.env.AZURE_COMPUTER_VISION_ENDPOINT,
      configured: !!process.env.AZURE_COMPUTER_VISION_KEY && !!process.env.AZURE_COMPUTER_VISION_ENDPOINT,
    },
    googleCloudVision: {
      name: 'Google Cloud Vision',
      key: process.env.GOOGLE_CLOUD_VISION_API_KEY,
      configured: !!process.env.GOOGLE_CLOUD_VISION_API_KEY,
    },
  };
};

// Helper to mask API keys for display
export const maskAPIKey = (key: string | undefined): string => {
  if (!key) return 'Not configured';
  if (key.length < 8) return '***';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};