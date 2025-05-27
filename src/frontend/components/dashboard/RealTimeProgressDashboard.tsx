"use client";

// Real-Time Progress Dashboard - Story 5.2 Implementation
// Live visualization, KPIs, and predictive forecasting for project management

import React, { useState, useEffect, useMemo } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useProgressMetrics } from '../../hooks/useProgressMetrics';
import { Card } from '../ui/Card';
import { Progress } from '../ui/Progress';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { 
  Users, 
  Clock, 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Activity,
  Calendar,
  DollarSign,
  Zap
} from 'lucide-react';

interface RealTimeProgressDashboardProps {
  projectId: string;
  timeframe?: 'today' | 'week' | 'month';
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface ProgressMetrics {
  projectId: string;
  timestamp: string;
  totalHours: number;
  completedTasks: number;
  totalTasks: number;
  activeUsers: number;
  efficiency: number;
  qualityScore: number;
  onTimePerformance: number;
  budgetUtilization: number;
  criticalIssues: number;
  upcomingDeadlines: number;
  productivity: number;
  safetyScore: number;
}

interface LiveUpdate {
  type: 'task_completed' | 'user_joined' | 'user_left' | 'alert' | 'milestone';
  data: any;
  timestamp: string;
}

interface ForecastData {
  completionDate: string;
  completionProbability: number;
  budgetOverrun: number;
  riskFactors: string[];
  recommendations: string[];
}

export const RealTimeProgressDashboard: React.FC<RealTimeProgressDashboardProps> = ({
  projectId,
  timeframe = 'today',
  autoRefresh = true,
  refreshInterval = 30000
}) => {
  const [metrics, setMetrics] = useState<ProgressMetrics | null>(null);
  const [liveUpdates, setLiveUpdates] = useState<LiveUpdate[]>([]);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);

  // WebSocket connection for real-time updates
  const { 
    isConnected, 
    lastMessage, 
    sendMessage 
  } = useWebSocket(`/api/v1/websocket/progress/${projectId}`);

  // Custom hook for progress metrics
  const {
    progressData,
    isLoading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics
  } = useProgressMetrics(projectId, selectedTimeframe);

  // Handle real-time WebSocket updates
  useEffect(() => {
    if (lastMessage) {
      try {
        const update = JSON.parse(lastMessage.data);
        
        if (update.type === 'metrics_update') {
          setMetrics(update.data);
        } else if (update.type === 'live_update') {
          setLiveUpdates(prev => [update.data, ...prev.slice(0, 9)]); // Keep last 10 updates
        } else if (update.type === 'forecast_update') {
          setForecast(update.data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage]);

  // Initialize dashboard data
  useEffect(() => {
    const initializeDashboard = async () => {
      setIsLoading(true);
      try {
        // Subscribe to real-time updates
        if (isConnected) {
          sendMessage(JSON.stringify({
            action: 'subscribe',
            projectId,
            timeframe: selectedTimeframe
          }));
        }

        // Load initial metrics if available from hook
        if (progressData) {
          setMetrics(progressData);
        }

        // Load forecast data
        const forecastResponse = await fetch(`/api/v1/analytics/forecast/${projectId}`);
        if (forecastResponse.ok) {
          const forecastData = await forecastResponse.json();
          setForecast(forecastData);
        }

      } catch (error) {
        console.error('Error initializing dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeDashboard();
  }, [projectId, selectedTimeframe, isConnected, progressData]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && !isConnected) {
      const interval = setInterval(() => {
        refetchMetrics();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, isConnected, refetchMetrics]);

  // Calculate derived metrics
  const derivedMetrics = useMemo(() => {
    if (!metrics) return null;

    return {
      completionRate: (metrics.completedTasks / Math.max(metrics.totalTasks, 1)) * 100,
      hoursPerTask: metrics.totalHours / Math.max(metrics.completedTasks, 1),
      efficiencyStatus: metrics.efficiency >= 0.8 ? 'excellent' : metrics.efficiency >= 0.6 ? 'good' : 'needs-improvement',
      qualityStatus: metrics.qualityScore >= 4.0 ? 'excellent' : metrics.qualityScore >= 3.0 ? 'good' : 'needs-improvement',
      riskLevel: metrics.criticalIssues > 5 ? 'high' : metrics.criticalIssues > 2 ? 'medium' : 'low'
    };
  }, [metrics]);

  if (isLoading || metricsLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="h-32 animate-pulse bg-gray-200" />
        ))}
      </div>
    );
  }

  if (metricsError) {
    return (
      <Card className="p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Dashboard</h3>
        <p className="text-gray-600 mb-4">Unable to load progress metrics</p>
        <Button onClick={() => refetchMetrics()}>Retry</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header with timeframe selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Real-Time Progress Dashboard</h1>
          <p className="text-gray-600">
            Live project metrics and performance indicators
          </p>
        </div>
        
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
          
          <div className="flex rounded-lg border border-gray-200">
            {(['today', 'week', 'month'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedTimeframe(period)}
                className={`px-3 py-1 text-sm font-medium capitalize transition-colors ${
                  selectedTimeframe === period
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Active Users */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">{metrics?.activeUsers || 0}</p>
              <p className="text-sm text-green-600 mt-1">
                <TrendingUp className="inline h-4 w-4 mr-1" />
                +2 from yesterday
              </p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        {/* Task Completion Rate */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">Completion Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {derivedMetrics?.completionRate.toFixed(1)}%
              </p>
              <Progress 
                value={derivedMetrics?.completionRate || 0} 
                className="mt-2" 
              />
            </div>
            <Target className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        {/* Total Hours */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Hours</p>
              <p className="text-2xl font-bold text-gray-900">{metrics?.totalHours || 0}</p>
              <p className="text-sm text-gray-600 mt-1">
                {derivedMetrics?.hoursPerTask.toFixed(1)} hrs/task
              </p>
            </div>
            <Clock className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        {/* Efficiency Score */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Efficiency</p>
              <p className="text-2xl font-bold text-gray-900">
                {((metrics?.efficiency || 0) * 100).toFixed(0)}%
              </p>
              <Badge 
                variant={
                  derivedMetrics?.efficiencyStatus === 'excellent' ? 'success' :
                  derivedMetrics?.efficiencyStatus === 'good' ? 'warning' : 'destructive'
                }
                className="mt-1"
              >
                {derivedMetrics?.efficiencyStatus}
              </Badge>
            </div>
            <Zap className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>
      </div>

      {/* Performance Charts and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Real-Time Activity Feed */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Live Activity</h3>
            <Activity className="h-5 w-5 text-gray-600" />
          </div>
          
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {liveUpdates.length > 0 ? (
              liveUpdates.map((update, index) => (
                <div key={index} className="flex items-start space-x-3 p-2 rounded-lg bg-gray-50">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    update.type === 'task_completed' ? 'bg-green-400' :
                    update.type === 'alert' ? 'bg-red-400' :
                    update.type === 'milestone' ? 'bg-blue-400' : 'bg-gray-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{update.data.message}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(update.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No recent activity
              </p>
            )}
          </div>
        </Card>

        {/* Quality and Safety Metrics */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quality & Safety</h3>
          
          <div className="space-y-4">
            {/* Quality Score */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Quality Score</span>
                <span className="text-sm font-bold text-gray-900">
                  {metrics?.qualityScore.toFixed(1)}/5.0
                </span>
              </div>
              <Progress value={(metrics?.qualityScore || 0) * 20} className="h-2" />
            </div>

            {/* Safety Score */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Safety Score</span>
                <span className="text-sm font-bold text-gray-900">
                  {metrics?.safetyScore || 95}%
                </span>
              </div>
              <Progress value={metrics?.safetyScore || 95} className="h-2" />
            </div>

            {/* Critical Issues */}
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="text-sm font-medium text-red-800">Critical Issues</span>
              </div>
              <Badge variant="destructive">
                {metrics?.criticalIssues || 0}
              </Badge>
            </div>

            {/* Upcoming Deadlines */}
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Due Soon</span>
              </div>
              <Badge variant="warning">
                {metrics?.upcomingDeadlines || 0}
              </Badge>
            </div>
          </div>
        </Card>

        {/* Project Forecast */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Forecast</h3>
          
          {forecast ? (
            <div className="space-y-4">
              {/* Completion Prediction */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Completion Date</span>
                  <span className="text-sm font-bold text-gray-900">
                    {new Date(forecast.completionDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Probability</span>
                  <span className="text-sm font-bold text-green-600">
                    {forecast.completionProbability}%
                  </span>
                </div>
              </div>

              {/* Budget Status */}
              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Budget Status</span>
                  </div>
                  <span className={`text-sm font-bold ${
                    forecast.budgetOverrun > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {forecast.budgetOverrun > 0 ? '+' : ''}{forecast.budgetOverrun}%
                  </span>
                </div>
              </div>

              {/* Risk Factors */}
              {forecast.riskFactors.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Risk Factors</h4>
                  <div className="space-y-1">
                    {forecast.riskFactors.slice(0, 3).map((risk, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                        <span className="text-xs text-gray-600">{risk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {forecast.recommendations.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Recommendations</h4>
                  <div className="space-y-1">
                    {forecast.recommendations.slice(0, 2).map((rec, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                        <span className="text-xs text-gray-600">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Generating forecast...</p>
            </div>
          )}
        </Card>
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* On-Time Performance */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Summary</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">On-Time Performance</span>
              <span className="text-lg font-bold text-gray-900">
                {metrics?.onTimePerformance || 0}%
              </span>
            </div>
            <Progress value={metrics?.onTimePerformance || 0} />

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Budget Utilization</span>
              <span className="text-lg font-bold text-gray-900">
                {metrics?.budgetUtilization || 0}%
              </span>
            </div>
            <Progress value={metrics?.budgetUtilization || 0} />

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Productivity Index</span>
              <span className="text-lg font-bold text-gray-900">
                {((metrics?.productivity || 0) * 100).toFixed(0)}%
              </span>
            </div>
            <Progress value={(metrics?.productivity || 0) * 100} />
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-auto p-4">
              <div className="text-center">
                <Users className="h-6 w-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Team Status</div>
              </div>
            </Button>
            
            <Button variant="outline" className="h-auto p-4">
              <div className="text-center">
                <Calendar className="h-6 w-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Schedule</div>
              </div>
            </Button>
            
            <Button variant="outline" className="h-auto p-4">
              <div className="text-center">
                <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Issues</div>
              </div>
            </Button>
            
            <Button variant="outline" className="h-auto p-4">
              <div className="text-center">
                <TrendingUp className="h-6 w-6 mx-auto mb-2" />
                <div className="text-sm font-medium">Reports</div>
              </div>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};