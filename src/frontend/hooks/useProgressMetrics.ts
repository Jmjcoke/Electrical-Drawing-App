// Progress Metrics Hook - Story 5.2 Real-Time Progress Dashboard
// Custom hook for fetching and managing progress metrics data

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ProgressMetrics {
  projectId: string;
  timestamp: string;
  
  // Time metrics
  totalHours: number;
  productiveHours: number;
  overtimeHours: number;
  
  // Task metrics
  completedTasks: number;
  totalTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  
  // Team metrics
  activeUsers: number;
  totalTeamMembers: number;
  averageEfficiency: number;
  
  // Performance metrics
  efficiency: number;
  qualityScore: number;
  productivityIndex: number;
  onTimePerformance: number;
  budgetUtilization: number;
  
  // Safety and compliance
  safetyScore: number;
  complianceRate: number;
  criticalIssues: number;
  
  // Schedule metrics
  upcomingDeadlines: number;
  delayedTasks: number;
  milestoneProgress: number;
  
  // Financial metrics
  budgetSpent: number;
  budgetRemaining: number;
  costPerHour: number;
  
  // Trends (comparison with previous period)
  trends: {
    efficiency: 'up' | 'down' | 'stable';
    quality: 'up' | 'down' | 'stable';
    productivity: 'up' | 'down' | 'stable';
    safety: 'up' | 'down' | 'stable';
  };
}

interface ProgressMetricsFilters {
  timeframe: 'today' | 'week' | 'month' | 'quarter';
  userId?: string;
  circuitId?: string;
  workType?: string;
  includeInactive?: boolean;
}

interface UseProgressMetricsOptions {
  enabled?: boolean;
  refetchInterval?: number;
  onError?: (error: Error) => void;
  onSuccess?: (data: ProgressMetrics) => void;
}

interface UseProgressMetricsReturn {
  progressData: ProgressMetrics | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateFilters: (filters: Partial<ProgressMetricsFilters>) => void;
  exportData: () => Promise<Blob>;
  filters: ProgressMetricsFilters;
}

export const useProgressMetrics = (
  projectId: string,
  initialTimeframe: 'today' | 'week' | 'month' | 'quarter' = 'today',
  options: UseProgressMetricsOptions = {}
): UseProgressMetricsReturn => {
  const {
    enabled = true,
    refetchInterval = 30000, // 30 seconds
    onError,
    onSuccess
  } = options;

  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ProgressMetricsFilters>({
    timeframe: initialTimeframe,
    includeInactive: false
  });

  // Main query for progress metrics
  const {
    data: progressData,
    isLoading,
    error,
    refetch: queryRefetch
  } = useQuery({
    queryKey: ['progressMetrics', projectId, filters],
    queryFn: async (): Promise<ProgressMetrics> => {
      const searchParams = new URLSearchParams({
        timeframe: filters.timeframe,
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.circuitId && { circuitId: filters.circuitId }),
        ...(filters.workType && { workType: filters.workType }),
        includeInactive: filters.includeInactive?.toString() || 'false'
      });

      const response = await fetch(
        `/api/v1/analytics/progress/${projectId}?${searchParams}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch progress metrics: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: enabled && !!projectId,
    refetchInterval: refetchInterval,
    staleTime: 10000, // 10 seconds
    onSuccess: (data) => {
      onSuccess?.(data);
    },
    onError: (error) => {
      console.error('Error fetching progress metrics:', error);
      onError?.(error as Error);
    }
  });

  // Mutation for updating metrics (manual refresh)
  const updateMetricsMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetch(`/api/v1/analytics/progress/${projectId}/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to update progress metrics');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch progress metrics
      queryClient.invalidateQueries({ queryKey: ['progressMetrics', projectId] });
    },
    onError: (error) => {
      console.error('Error updating progress metrics:', error);
      onError?.(error as Error);
    }
  });

  // Export data mutation
  const exportDataMutation = useMutation({
    mutationFn: async (): Promise<Blob> => {
      const searchParams = new URLSearchParams({
        timeframe: filters.timeframe,
        format: 'excel',
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.circuitId && { circuitId: filters.circuitId }),
        ...(filters.workType && { workType: filters.workType })
      });

      const response = await fetch(
        `/api/v1/analytics/progress/${projectId}/export?${searchParams}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to export progress data');
      }

      return response.blob();
    },
    onError: (error) => {
      console.error('Error exporting progress data:', error);
      onError?.(error as Error);
    }
  });

  // Update filters function
  const updateFilters = useCallback((newFilters: Partial<ProgressMetricsFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
  }, []);

  // Manual refetch function
  const refetch = useCallback(async () => {
    try {
      await updateMetricsMutation.mutateAsync(projectId);
    } catch (error) {
      // Try regular refetch if mutation fails
      await queryRefetch();
    }
  }, [projectId, updateMetricsMutation, queryRefetch]);

  // Export data function
  const exportData = useCallback(async (): Promise<Blob> => {
    return exportDataMutation.mutateAsync();
  }, [exportDataMutation]);

  // Cache management for real-time updates
  useEffect(() => {
    // Set up query invalidation for real-time updates
    const handleVisibilityChange = () => {
      if (!document.hidden && enabled) {
        queryClient.invalidateQueries({ queryKey: ['progressMetrics', projectId] });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [projectId, enabled, queryClient]);

  return {
    progressData: progressData || null,
    isLoading: isLoading || updateMetricsMutation.isPending,
    error: error || updateMetricsMutation.error,
    refetch,
    updateFilters,
    exportData,
    filters
  };
};

// Helper hook for real-time metric updates via WebSocket
export const useRealTimeProgressUpdates = (
  projectId: string,
  onUpdate?: (metrics: ProgressMetrics) => void
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // WebSocket connection for real-time updates
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}/api/v1/websocket/progress/${projectId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to progress metrics WebSocket');
      // Subscribe to updates
      ws.send(JSON.stringify({
        action: 'subscribe',
        type: 'progress_metrics'
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'progress_update') {
          // Update cache with new data
          queryClient.setQueryData(['progressMetrics', projectId], data.metrics);
          onUpdate?.(data.metrics);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('Disconnected from progress metrics WebSocket');
    };

    return () => {
      ws.close();
    };
  }, [projectId, queryClient, onUpdate]);
};

// Hook for historical progress trends
export const useProgressTrends = (
  projectId: string,
  timeRange: 'week' | 'month' | 'quarter' | 'year' = 'month'
) => {
  return useQuery({
    queryKey: ['progressTrends', projectId, timeRange],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/analytics/progress/${projectId}/trends?range=${timeRange}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch progress trends');
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000 // 5 minutes
  });
};

// Hook for project forecasting
export const useProjectForecast = (projectId: string) => {
  return useQuery({
    queryKey: ['projectForecast', projectId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/analytics/forecast/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch project forecast');
      }

      return response.json();
    },
    staleTime: 15 * 60 * 1000, // 15 minutes
    refetchInterval: 15 * 60 * 1000 // 15 minutes
  });
};