import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  symbolExtractionService,
  SymbolExtractionRequest,
  SymbolExtractionJob,
  ExtractedSymbol,
} from '@/services/ai/symbolExtractionService';
import { useAPIKeyStatus } from '@/hooks/useAPIKeyStatus';

interface UseSymbolExtractionOptions {
  onExtractionComplete?: (job: SymbolExtractionJob) => void;
  onSymbolExtracted?: (symbol: ExtractedSymbol) => void;
  autoSubscribe?: boolean;
}

export const useSymbolExtraction = (options: UseSymbolExtractionOptions = {}) => {
  const queryClient = useQueryClient();
  const apiKeyStatus = useAPIKeyStatus();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [extractedSymbols, setExtractedSymbols] = useState<ExtractedSymbol[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Start extraction mutation
  const startExtraction = useMutation({
    mutationFn: (request: SymbolExtractionRequest) => {
      // Check API key configuration before starting
      if (!apiKeyStatus.configured) {
        return Promise.reject(new Error('API keys not configured'));
      }
      return symbolExtractionService.startExtraction(request);
    },
    onSuccess: (response) => {
      if (response.success && response.data) {
        setActiveJobId(response.data.jobId);
        toast.success('Symbol extraction started');
        
        // Invalidate job queries to refresh the list
        queryClient.invalidateQueries({ queryKey: ['symbol-extraction-jobs'] });
      } else {
        toast.error(response.error || 'Failed to start extraction');
      }
    },
    onError: (error) => {
      if (error.message === 'API keys not configured') {
        toast.error('Please configure API keys in settings before extracting symbols');
      } else {
        toast.error('Failed to start extraction');
      }
      console.error('Extraction error:', error);
    },
  });

  // Poll for job status
  const { data: jobStatus, isLoading: isJobLoading } = useQuery({
    queryKey: ['symbol-extraction-job', activeJobId],
    queryFn: () => symbolExtractionService.getJobStatus(activeJobId!),
    enabled: !!activeJobId && !isSubscribed,
    refetchInterval: (data) => {
      // Stop polling if job is completed or failed
      if (data?.data?.status === 'completed' || data?.data?.status === 'failed') {
        return false;
      }
      return 2000; // Poll every 2 seconds
    },
  });

  // WebSocket subscription for real-time updates
  useEffect(() => {
    if (!activeJobId || !options.autoSubscribe || isSubscribed) return;

    const unsubscribe = symbolExtractionService.subscribeToJob(activeJobId, {
      onProgress: (progress) => {
        // Update job status in query cache
        queryClient.setQueryData(
          ['symbol-extraction-job', activeJobId],
          (oldData: any) => ({
            ...oldData,
            data: {
              ...oldData?.data,
              progress,
            },
          })
        );
      },
      onSymbolExtracted: (symbol) => {
        setExtractedSymbols((prev) => [...prev, symbol]);
        options.onSymbolExtracted?.(symbol);
      },
      onComplete: (job) => {
        setIsSubscribed(false);
        options.onExtractionComplete?.(job);
        
        // Update cache with final job data
        queryClient.setQueryData(['symbol-extraction-job', activeJobId], {
          success: true,
          data: job,
        });
        
        toast.success(`Extraction complete: ${job.results?.totalSymbols} symbols found`);
      },
      onError: (error) => {
        setIsSubscribed(false);
        toast.error(`Extraction failed: ${error}`);
      },
    });

    setIsSubscribed(true);

    return () => {
      unsubscribe();
      setIsSubscribed(false);
    };
  }, [activeJobId, options, queryClient, isSubscribed]);

  // Verify symbol mutation
  const verifySymbol = useMutation({
    mutationFn: ({ symbolId, corrections }: {
      symbolId: string;
      corrections: Partial<ExtractedSymbol>;
    }) => symbolExtractionService.verifySymbol(symbolId, corrections),
    onSuccess: (response) => {
      if (response.success) {
        toast.success('Symbol verified');
        
        // Update local state
        setExtractedSymbols((prev) =>
          prev.map((symbol) =>
            symbol.id === response.data?.id ? response.data : symbol
          )
        );
      }
    },
  });

  // Prepare training data mutation
  const prepareTrainingData = useMutation({
    mutationFn: (symbols: ExtractedSymbol[]) =>
      symbolExtractionService.prepareTrainingData({
        symbols,
        format: 'yolo',
        augmentations: {
          rotation: true,
          scaling: true,
          noise: false,
          lighting: true,
        },
        splitRatio: {
          train: 0.7,
          validation: 0.2,
          test: 0.1,
        },
      }),
    onSuccess: (response) => {
      if (response.success && response.data) {
        toast.success('Training data prepared successfully');
        window.open(response.data.downloadUrl, '_blank');
      }
    },
  });

  // Find similar symbols
  const findSimilarSymbols = useCallback(
    async (imageData: string, limit?: number) => {
      const response = await symbolExtractionService.findSimilarSymbols(
        imageData,
        limit
      );
      return response.success ? response.data : [];
    },
    []
  );

  // Reset extraction state
  const resetExtraction = useCallback(() => {
    setActiveJobId(null);
    setExtractedSymbols([]);
    setIsSubscribed(false);
  }, []);

  // Get current job progress
  const currentProgress = jobStatus?.data?.progress || null;
  const isExtracting = activeJobId !== null && 
    jobStatus?.data?.status !== 'completed' && 
    jobStatus?.data?.status !== 'failed';

  return {
    // State
    activeJobId,
    extractedSymbols,
    currentProgress,
    isExtracting,
    jobStatus: jobStatus?.data,
    apiKeyStatus,

    // Actions
    startExtraction: startExtraction.mutate,
    verifySymbol: verifySymbol.mutate,
    prepareTrainingData: prepareTrainingData.mutate,
    findSimilarSymbols,
    resetExtraction,

    // Loading states
    isStarting: startExtraction.isPending,
    isVerifying: verifySymbol.isPending,
    isPreparing: prepareTrainingData.isPending,
    isJobLoading,
  };
};