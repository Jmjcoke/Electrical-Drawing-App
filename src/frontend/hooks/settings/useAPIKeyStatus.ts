import { useQuery } from '@tanstack/react-query';

interface APIKeyStatus {
  providers: {
    openai: { configured: boolean };
    azureComputerVision: { configured: boolean };
    googleCloudVision: { configured: boolean };
  };
}

export const useAPIKeyStatus = () => {
  return useQuery<APIKeyStatus>({
    queryKey: ['api-key-status'],
    queryFn: async () => {
      // For now, check environment variables on client side
      // In production, this should be a server API call
      return {
        providers: {
          openai: {
            configured: !!process.env.NEXT_PUBLIC_OPENAI_CONFIGURED,
          },
          azureComputerVision: {
            configured: !!process.env.NEXT_PUBLIC_AZURE_CV_CONFIGURED,
          },
          googleCloudVision: {
            configured: !!process.env.NEXT_PUBLIC_GOOGLE_CV_CONFIGURED,
          },
        },
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};