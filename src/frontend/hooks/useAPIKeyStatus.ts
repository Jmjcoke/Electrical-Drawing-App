import { useState, useEffect } from 'react';

interface APIKeyStatus {
  loading: boolean;
  configured: boolean;
  providers: string[];
  features: string[];
  error?: string;
}

export function useAPIKeyStatus() {
  const [status, setStatus] = useState<APIKeyStatus>({
    loading: true,
    configured: false,
    providers: [],
    features: [],
  });

  useEffect(() => {
    checkAPIKeyStatus();
  }, []);

  const checkAPIKeyStatus = async () => {
    try {
      const response = await fetch('/api/settings/api-keys');
      
      if (response.ok) {
        const data = await response.json();
        const { openai, computerVision, customML, availableFeatures } = data.status;
        
        const providers: string[] = [];
        if (openai.configured) providers.push('openai');
        if (computerVision.configured) providers.push(computerVision.provider);
        if (customML.configured) providers.push('custom');
        
        setStatus({
          loading: false,
          configured: providers.length > 0,
          providers,
          features: availableFeatures || [],
        });
      } else {
        setStatus({
          loading: false,
          configured: false,
          providers: [],
          features: [],
          error: 'Failed to fetch API key status',
        });
      }
    } catch (error) {
      setStatus({
        loading: false,
        configured: false,
        providers: [],
        features: [],
        error: 'Failed to check API key configuration',
      });
    }
  };

  const refresh = () => {
    setStatus(prev => ({ ...prev, loading: true }));
    checkAPIKeyStatus();
  };

  return {
    ...status,
    refresh,
  };
}