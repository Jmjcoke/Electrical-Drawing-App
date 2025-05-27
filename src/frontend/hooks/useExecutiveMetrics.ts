// Executive Metrics Hook - Story 5.3 Management Reporting & Analytics
// Custom hook for executive-level business intelligence and strategic metrics

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface FinancialMetrics {
  totalRevenue: number;
  profitMargin: number;
  costPerProject: number;
  budgetVariance: number;
  cashFlow: number;
  revenueGrowth: number;
  projectROI: number;
  costPerHour: number;
  billingEfficiency: number;
  accountsReceivable: number;
  grossMargin: number;
  operatingMargin: number;
}

interface OperationalMetrics {
  projectsCompleted: number;
  projectsInProgress: number;
  onTimeDelivery: number;
  qualityScore: number;
  resourceUtilization: number;
  productivityIndex: number;
  customerSatisfaction: number;
  safetyScore: number;
  teamEfficiency: number;
  reworkRate: number;
  changeOrderRate: number;
  clientRetentionRate: number;
}

interface StrategicMetrics {
  marketShare: number;
  competitivePosition: number;
  innovationIndex: number;
  employeeEngagement: number;
  skillsDevelopment: number;
  technologyAdoption: number;
  sustainabilityScore: number;
  riskMitigationScore: number;
}

interface ExecutiveData {
  financial: FinancialMetrics;
  operational: OperationalMetrics;
  strategic: StrategicMetrics;
  trends: {
    revenue: TrendData[];
    profitability: TrendData[];
    efficiency: TrendData[];
    quality: TrendData[];
    safety: TrendData[];
  };
  benchmarks: {
    industry: BenchmarkData;
    region: BenchmarkData;
    company: BenchmarkData;
  };
  forecasts: {
    revenue: ForecastData;
    projects: ForecastData;
    resources: ForecastData;
  };
  insights: ExecutiveInsight[];
  lastUpdated: string;
}

interface TrendData {
  period: string;
  value: number;
  target?: number;
  benchmark?: number;
}

interface BenchmarkData {
  revenue: number;
  profitMargin: number;
  efficiency: number;
  quality: number;
  safety: number;
}

interface ForecastData {
  period: string;
  predicted: number;
  confidence: number;
  scenario: 'optimistic' | 'realistic' | 'pessimistic';
}

interface ExecutiveInsight {
  id: string;
  category: 'financial' | 'operational' | 'strategic' | 'risk';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation: string;
  impact: number;
  effort: number;
  timeline: string;
  data?: any;
}

interface ExecutiveFilters {
  timeframe: 'month' | 'quarter' | 'year';
  division?: string;
  region?: string;
  projectType?: string;
  clientType?: string;
  includeBenchmarks?: boolean;
  includeForecasts?: boolean;
}

interface UseExecutiveMetricsOptions {
  enabled?: boolean;
  refetchInterval?: number;
  onError?: (error: Error) => void;
  onSuccess?: (data: ExecutiveData) => void;
}

interface UseExecutiveMetricsReturn {
  executiveData: ExecutiveData | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateFilters: (filters: Partial<ExecutiveFilters>) => void;
  exportReport: (format?: 'pdf' | 'excel' | 'powerpoint') => Promise<Blob>;
  scheduleReport: (schedule: ReportSchedule) => Promise<void>;
  filters: ExecutiveFilters;
}

interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  recipients: string[];
  format: 'pdf' | 'excel' | 'powerpoint';
  includeInsights: boolean;
  includeBenchmarks: boolean;
}

export const useExecutiveMetrics = (
  organizationId?: string,
  initialTimeframe: 'month' | 'quarter' | 'year' = 'quarter',
  options: UseExecutiveMetricsOptions = {}
): UseExecutiveMetricsReturn => {
  const {
    enabled = true,
    refetchInterval = 300000, // 5 minutes
    onError,
    onSuccess
  } = options;

  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ExecutiveFilters>({
    timeframe: initialTimeframe,
    includeBenchmarks: true,
    includeForecasts: true
  });

  // Main query for executive metrics
  const {
    data: executiveData,
    isLoading,
    error,
    refetch: queryRefetch
  } = useQuery({
    queryKey: ['executiveMetrics', organizationId, filters],
    queryFn: async (): Promise<ExecutiveData> => {
      const searchParams = new URLSearchParams({
        timeframe: filters.timeframe,
        ...(filters.division && { division: filters.division }),
        ...(filters.region && { region: filters.region }),
        ...(filters.projectType && { projectType: filters.projectType }),
        ...(filters.clientType && { clientType: filters.clientType }),
        includeBenchmarks: filters.includeBenchmarks?.toString() || 'true',
        includeForecasts: filters.includeForecasts?.toString() || 'true'
      });

      const endpoint = organizationId 
        ? `/api/v1/executive/metrics/${organizationId}?${searchParams}`
        : `/api/v1/executive/metrics?${searchParams}`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch executive metrics: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: enabled,
    refetchInterval: refetchInterval,
    staleTime: 60000, // 1 minute
    onSuccess: (data) => {
      onSuccess?.(data);
    },
    onError: (error) => {
      console.error('Error fetching executive metrics:', error);
      onError?.(error as Error);
    }
  });

  // Mutation for manual refresh
  const refreshMetricsMutation = useMutation({
    mutationFn: async () => {
      const endpoint = organizationId 
        ? `/api/v1/executive/metrics/${organizationId}/refresh`
        : `/api/v1/executive/metrics/refresh`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to refresh executive metrics');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['executiveMetrics'] });
    },
    onError: (error) => {
      console.error('Error refreshing executive metrics:', error);
      onError?.(error as Error);
    }
  });

  // Export report mutation
  const exportReportMutation = useMutation({
    mutationFn: async (format: 'pdf' | 'excel' | 'powerpoint' = 'pdf'): Promise<Blob> => {
      const searchParams = new URLSearchParams({
        timeframe: filters.timeframe,
        format: format,
        ...(filters.division && { division: filters.division }),
        ...(filters.region && { region: filters.region }),
        ...(filters.projectType && { projectType: filters.projectType }),
        includeBenchmarks: 'true',
        includeInsights: 'true'
      });

      const endpoint = organizationId 
        ? `/api/v1/executive/reports/${organizationId}/export?${searchParams}`
        : `/api/v1/executive/reports/export?${searchParams}`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export executive report');
      }

      return response.blob();
    },
    onError: (error) => {
      console.error('Error exporting executive report:', error);
      onError?.(error as Error);
    }
  });

  // Schedule report mutation
  const scheduleReportMutation = useMutation({
    mutationFn: async (schedule: ReportSchedule) => {
      const endpoint = organizationId 
        ? `/api/v1/executive/reports/${organizationId}/schedule`
        : `/api/v1/executive/reports/schedule`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...schedule,
          filters: filters
        })
      });

      if (!response.ok) {
        throw new Error('Failed to schedule executive report');
      }

      return response.json();
    },
    onError: (error) => {
      console.error('Error scheduling executive report:', error);
      onError?.(error as Error);
    }
  });

  // Update filters function
  const updateFilters = useCallback((newFilters: Partial<ExecutiveFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters
    }));
  }, []);

  // Manual refetch function
  const refetch = useCallback(async () => {
    try {
      await refreshMetricsMutation.mutateAsync();
    } catch (error) {
      // Try regular refetch if mutation fails
      await queryRefetch();
    }
  }, [refreshMetricsMutation, queryRefetch]);

  // Export report function
  const exportReport = useCallback(async (format: 'pdf' | 'excel' | 'powerpoint' = 'pdf'): Promise<Blob> => {
    return exportReportMutation.mutateAsync(format);
  }, [exportReportMutation]);

  // Schedule report function
  const scheduleReport = useCallback(async (schedule: ReportSchedule): Promise<void> => {
    await scheduleReportMutation.mutateAsync(schedule);
  }, [scheduleReportMutation]);

  return {
    executiveData: executiveData || null,
    isLoading: isLoading || refreshMetricsMutation.isPending,
    error: error || refreshMetricsMutation.error,
    refetch,
    updateFilters,
    exportReport,
    scheduleReport,
    filters
  };
};

// Hook for historical executive trends
export const useExecutiveTrends = (
  organizationId?: string,
  timeRange: 'year' | 'quarter' | 'month' = 'year',
  metrics: string[] = ['revenue', 'profitability', 'efficiency']
) => {
  return useQuery({
    queryKey: ['executiveTrends', organizationId, timeRange, metrics],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        range: timeRange,
        metrics: metrics.join(',')
      });

      const endpoint = organizationId 
        ? `/api/v1/executive/trends/${organizationId}?${searchParams}`
        : `/api/v1/executive/trends?${searchParams}`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch executive trends');
      }

      return response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 10 * 60 * 1000 // 10 minutes
  });
};

// Hook for competitive benchmarking
export const useCompetitiveBenchmarks = (
  organizationId?: string,
  industry?: string,
  region?: string
) => {
  return useQuery({
    queryKey: ['competitiveBenchmarks', organizationId, industry, region],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        ...(industry && { industry }),
        ...(region && { region })
      });

      const endpoint = organizationId 
        ? `/api/v1/executive/benchmarks/${organizationId}?${searchParams}`
        : `/api/v1/executive/benchmarks?${searchParams}`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch competitive benchmarks');
      }

      return response.json();
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: 60 * 60 * 1000 // 1 hour
  });
};

// Hook for strategic recommendations
export const useStrategicRecommendations = (
  organizationId?: string,
  focusAreas?: string[]
) => {
  return useQuery({
    queryKey: ['strategicRecommendations', organizationId, focusAreas],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        ...(focusAreas && { focusAreas: focusAreas.join(',') })
      });

      const endpoint = organizationId 
        ? `/api/v1/executive/recommendations/${organizationId}?${searchParams}`
        : `/api/v1/executive/recommendations?${searchParams}`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch strategic recommendations');
      }

      return response.json();
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    refetchInterval: 30 * 60 * 1000 // 30 minutes
  });
};

// Hook for real-time alerts
export const useExecutiveAlerts = (
  organizationId?: string,
  severity?: 'critical' | 'high' | 'medium' | 'low'
) => {
  return useQuery({
    queryKey: ['executiveAlerts', organizationId, severity],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        ...(severity && { severity })
      });

      const endpoint = organizationId 
        ? `/api/v1/executive/alerts/${organizationId}?${searchParams}`
        : `/api/v1/executive/alerts?${searchParams}`;

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch executive alerts');
      }

      return response.json();
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 60000 // 1 minute
  });
};