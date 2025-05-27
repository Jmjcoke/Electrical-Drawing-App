"use client";

// Executive Dashboard - Story 5.3 Management Reporting & Analytics
// Executive-level business intelligence and strategic decision support

import React, { useState, useEffect, useMemo } from 'react';
import { useExecutiveMetrics } from '../../hooks/useExecutiveMetrics';
import { Card } from '../ui/Card';
import { Progress } from '../ui/Progress';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  Users,
  Clock,
  Target,
  AlertCircle,
  CheckCircle,
  BarChart3,
  PieChart,
  Calendar,
  FileText,
  Download,
  Filter,
  RefreshCw
} from 'lucide-react';

interface ExecutiveDashboardProps {
  organizationId?: string;
  timeframe?: 'month' | 'quarter' | 'year';
  autoRefresh?: boolean;
}

interface KPIMetric {
  id: string;
  title: string;
  value: number | string;
  previousValue?: number;
  target?: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  status: 'excellent' | 'good' | 'warning' | 'critical';
  description: string;
}

interface FinancialMetrics {
  totalRevenue: number;
  profitMargin: number;
  costPerProject: number;
  budgetVariance: number;
  cashFlow: number;
  revenueGrowth: number;
  projectROI: number;
}

interface OperationalMetrics {
  projectsCompleted: number;
  onTimeDelivery: number;
  qualityScore: number;
  resourceUtilization: number;
  productivityIndex: number;
  customerSatisfaction: number;
  safetyScore: number;
}

interface StrategicInsight {
  category: 'opportunity' | 'risk' | 'trend' | 'recommendation';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  urgency: 'immediate' | 'near_term' | 'long_term';
  data?: any;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  organizationId,
  timeframe = 'quarter',
  autoRefresh = true
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);
  const [selectedFilters, setSelectedFilters] = useState({
    division: 'all',
    region: 'all',
    projectType: 'all'
  });

  const {
    executiveData,
    isLoading,
    error,
    refetch,
    exportReport
  } = useExecutiveMetrics(organizationId, selectedTimeframe, {
    enabled: true,
    refetchInterval: autoRefresh ? 300000 : 0 // 5 minutes
  });

  // Calculate KPI metrics
  const kpiMetrics = useMemo((): KPIMetric[] => {
    if (!executiveData) return [];

    return [
      {
        id: 'revenue',
        title: 'Total Revenue',
        value: `$${(executiveData.financial.totalRevenue / 1000000).toFixed(1)}M`,
        previousValue: executiveData.financial.totalRevenue * 0.92,
        target: executiveData.financial.totalRevenue * 1.1,
        unit: 'millions',
        trend: executiveData.financial.revenueGrowth > 0 ? 'up' : 'down',
        status: executiveData.financial.revenueGrowth > 0.1 ? 'excellent' : 'good',
        description: `${executiveData.financial.revenueGrowth > 0 ? '+' : ''}${(executiveData.financial.revenueGrowth * 100).toFixed(1)}% vs previous period`
      },
      {
        id: 'profit_margin',
        title: 'Profit Margin',
        value: `${executiveData.financial.profitMargin.toFixed(1)}%`,
        target: 15,
        unit: 'percentage',
        trend: executiveData.financial.profitMargin > 12 ? 'up' : 'down',
        status: executiveData.financial.profitMargin > 15 ? 'excellent' : 
                executiveData.financial.profitMargin > 12 ? 'good' : 'warning',
        description: 'Industry target: 15%'
      },
      {
        id: 'on_time_delivery',
        title: 'On-Time Delivery',
        value: `${executiveData.operational.onTimeDelivery.toFixed(1)}%`,
        target: 90,
        unit: 'percentage',
        trend: executiveData.operational.onTimeDelivery > 85 ? 'up' : 'down',
        status: executiveData.operational.onTimeDelivery > 90 ? 'excellent' : 
                executiveData.operational.onTimeDelivery > 80 ? 'good' : 'warning',
        description: 'Target: 90%'
      },
      {
        id: 'customer_satisfaction',
        title: 'Customer Satisfaction',
        value: `${executiveData.operational.customerSatisfaction.toFixed(1)}/5.0`,
        target: 4.5,
        unit: 'rating',
        trend: executiveData.operational.customerSatisfaction > 4.0 ? 'up' : 'down',
        status: executiveData.operational.customerSatisfaction > 4.5 ? 'excellent' : 
                executiveData.operational.customerSatisfaction > 4.0 ? 'good' : 'warning',
        description: 'Target: 4.5/5.0'
      },
      {
        id: 'resource_utilization',
        title: 'Resource Utilization',
        value: `${executiveData.operational.resourceUtilization.toFixed(1)}%`,
        target: 85,
        unit: 'percentage',
        trend: executiveData.operational.resourceUtilization > 80 ? 'up' : 'down',
        status: executiveData.operational.resourceUtilization > 85 ? 'excellent' : 
                executiveData.operational.resourceUtilization > 75 ? 'good' : 'warning',
        description: 'Optimal: 80-90%'
      },
      {
        id: 'safety_score',
        title: 'Safety Score',
        value: `${executiveData.operational.safetyScore.toFixed(1)}%`,
        target: 98,
        unit: 'percentage',
        trend: executiveData.operational.safetyScore > 95 ? 'up' : 'down',
        status: executiveData.operational.safetyScore > 98 ? 'excellent' : 
                executiveData.operational.safetyScore > 95 ? 'good' : 'critical',
        description: 'Zero-incident target'
      }
    ];
  }, [executiveData]);

  const strategicInsights = useMemo((): StrategicInsight[] => {
    if (!executiveData) return [];

    const insights: StrategicInsight[] = [];

    // Revenue opportunity
    if (executiveData.financial.revenueGrowth > 0.15) {
      insights.push({
        category: 'opportunity',
        title: 'Strong Revenue Growth',
        description: 'Revenue growth exceeds industry average. Consider expanding capacity or entering new markets.',
        impact: 'high',
        urgency: 'near_term'
      });
    }

    // Profitability concern
    if (executiveData.financial.profitMargin < 10) {
      insights.push({
        category: 'risk',
        title: 'Profit Margin Below Target',
        description: 'Profit margins below industry standard. Review cost structure and pricing strategy.',
        impact: 'high',
        urgency: 'immediate'
      });
    }

    // Operational efficiency
    if (executiveData.operational.resourceUtilization > 90) {
      insights.push({
        category: 'risk',
        title: 'Resource Over-Utilization',
        description: 'Teams may be overextended. Consider hiring or workload rebalancing.',
        impact: 'medium',
        urgency: 'near_term'
      });
    }

    // Quality excellence
    if (executiveData.operational.qualityScore > 4.5 && executiveData.operational.customerSatisfaction > 4.5) {
      insights.push({
        category: 'opportunity',
        title: 'Premium Service Positioning',
        description: 'Exceptional quality scores enable premium pricing and competitive differentiation.',
        impact: 'high',
        urgency: 'near_term'
      });
    }

    // Safety leadership
    if (executiveData.operational.safetyScore > 98) {
      insights.push({
        category: 'opportunity',
        title: 'Industry Safety Leadership',
        description: 'Superior safety performance can be leveraged for competitive advantage and insurance savings.',
        impact: 'medium',
        urgency: 'long_term'
      });
    }

    return insights;
  }, [executiveData]);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="h-32 animate-pulse bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Dashboard</h3>
        <p className="text-gray-600 mb-4">Unable to load executive metrics</p>
        <Button onClick={() => refetch()}>Retry</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Executive Dashboard</h1>
          <p className="text-gray-600">Strategic insights and business intelligence</p>
        </div>
        
        <div className="flex items-center space-x-3 mt-4 sm:mt-0">
          <Select
            value={selectedTimeframe}
            onValueChange={(value) => setSelectedTimeframe(value as typeof selectedTimeframe)}
          >
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </Select>
          
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          <Button onClick={() => exportReport()}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpiMetrics.map((metric) => (
          <Card key={metric.id} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600">{metric.title}</h3>
              <div className="flex items-center space-x-1">
                {metric.trend === 'up' ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : metric.trend === 'down' ? (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                ) : (
                  <div className="w-4 h-4" />
                )}
                <Badge 
                  variant={
                    metric.status === 'excellent' ? 'success' :
                    metric.status === 'good' ? 'default' :
                    metric.status === 'warning' ? 'warning' : 'destructive'
                  }
                >
                  {metric.status}
                </Badge>
              </div>
            </div>
            
            <div className="mb-2">
              <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
              <div className="text-sm text-gray-600">{metric.description}</div>
            </div>
            
            {metric.target && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-600">Target</span>
                  <span className="font-medium">{metric.target}{metric.unit === 'percentage' ? '%' : metric.unit === 'rating' ? '/5.0' : ''}</span>
                </div>
                <Progress 
                  value={
                    metric.unit === 'percentage' ? 
                    (parseFloat(metric.value.toString()) / metric.target) * 100 :
                    metric.unit === 'rating' ?
                    (parseFloat(metric.value.toString().split('/')[0]) / metric.target) * 100 :
                    75 // Simplified for non-percentage metrics
                  } 
                  className="h-2"
                />
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Financial Performance</h3>
            <DollarSign className="h-6 w-6 text-green-600" />
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-green-800">Total Revenue</div>
                <div className="text-2xl font-bold text-green-900">
                  ${(executiveData?.financial.totalRevenue / 1000000).toFixed(1)}M
                </div>
              </div>
              <div className="text-sm text-green-600">
                +{(executiveData?.financial.revenueGrowth * 100).toFixed(1)}%
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  {executiveData?.financial.profitMargin.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Profit Margin</div>
              </div>
              
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">
                  ${(executiveData?.financial.costPerProject / 1000).toFixed(0)}K
                </div>
                <div className="text-sm text-gray-600">Cost/Project</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600">Budget Variance</span>
              <span className={`text-sm font-bold ${
                (executiveData?.financial.budgetVariance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {(executiveData?.financial.budgetVariance || 0) >= 0 ? '+' : ''}
                {((executiveData?.financial.budgetVariance || 0) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </Card>

        {/* Operational Performance */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Operational Excellence</h3>
            <Target className="h-6 w-6 text-blue-600" />
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-900">
                  {executiveData?.operational.projectsCompleted}
                </div>
                <div className="text-sm text-blue-600">Projects Completed</div>
              </div>
              
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-900">
                  {executiveData?.operational.onTimeDelivery.toFixed(1)}%
                </div>
                <div className="text-sm text-blue-600">On-Time Delivery</div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-600">Quality Score</span>
                  <span className="text-sm font-bold text-gray-900">
                    {executiveData?.operational.qualityScore.toFixed(1)}/5.0
                  </span>
                </div>
                <Progress value={(executiveData?.operational.qualityScore || 0) * 20} className="h-2" />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-600">Resource Utilization</span>
                  <span className="text-sm font-bold text-gray-900">
                    {executiveData?.operational.resourceUtilization.toFixed(1)}%
                  </span>
                </div>
                <Progress value={executiveData?.operational.resourceUtilization || 0} className="h-2" />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-600">Safety Score</span>
                  <span className="text-sm font-bold text-gray-900">
                    {executiveData?.operational.safetyScore.toFixed(1)}%
                  </span>
                </div>
                <Progress value={executiveData?.operational.safetyScore || 0} className="h-2" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Strategic Insights */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Strategic Insights</h3>
          <BarChart3 className="h-6 w-6 text-purple-600" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {strategicInsights.map((insight, index) => (
            <div key={index} className={`p-4 rounded-lg border-l-4 ${
              insight.category === 'opportunity' ? 'bg-green-50 border-green-400' :
              insight.category === 'risk' ? 'bg-red-50 border-red-400' :
              insight.category === 'trend' ? 'bg-blue-50 border-blue-400' :
              'bg-yellow-50 border-yellow-400'
            }`}>
              <div className="flex items-start justify-between mb-2">
                <h4 className={`font-semibold ${
                  insight.category === 'opportunity' ? 'text-green-800' :
                  insight.category === 'risk' ? 'text-red-800' :
                  insight.category === 'trend' ? 'text-blue-800' :
                  'text-yellow-800'
                }`}>
                  {insight.title}
                </h4>
                <div className="flex space-x-1">
                  <Badge variant={insight.impact === 'high' ? 'destructive' : insight.impact === 'medium' ? 'warning' : 'default'}>
                    {insight.impact} impact
                  </Badge>
                  <Badge variant="outline">
                    {insight.urgency}
                  </Badge>
                </div>
              </div>
              <p className={`text-sm ${
                insight.category === 'opportunity' ? 'text-green-700' :
                insight.category === 'risk' ? 'text-red-700' :
                insight.category === 'trend' ? 'text-blue-700' :
                'text-yellow-700'
              }`}>
                {insight.description}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Button variant="outline" className="h-auto p-4">
          <div className="text-center">
            <FileText className="h-6 w-6 mx-auto mb-2" />
            <div className="text-sm font-medium">Detailed Reports</div>
          </div>
        </Button>
        
        <Button variant="outline" className="h-auto p-4">
          <div className="text-center">
            <Calendar className="h-6 w-6 mx-auto mb-2" />
            <div className="text-sm font-medium">Schedule Review</div>
          </div>
        </Button>
        
        <Button variant="outline" className="h-auto p-4">
          <div className="text-center">
            <Users className="h-6 w-6 mx-auto mb-2" />
            <div className="text-sm font-medium">Team Performance</div>
          </div>
        </Button>
        
        <Button variant="outline" className="h-auto p-4">
          <div className="text-center">
            <PieChart className="h-6 w-6 mx-auto mb-2" />
            <div className="text-sm font-medium">Analytics</div>
          </div>
        </Button>
      </div>
    </div>
  );
};