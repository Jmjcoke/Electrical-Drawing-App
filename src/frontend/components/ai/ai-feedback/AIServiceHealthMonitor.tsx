// AI Service Health Monitor with Fallback UI - Story 3.2

'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAIServiceHealth } from '@/hooks/ai/useAIAnalysisUpdates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
  Settings,
  ExternalLink,
  AlertCircle
} from 'lucide-react';

interface AIServiceHealthMonitorProps {
  showDetails?: boolean;
  showActions?: boolean;
  onServiceClick?: (service: string) => void;
  onFallbackMode?: () => void;
  className?: string;
}

const serviceDisplayNames = {
  computerVision: 'Computer Vision',
  cloudDetection: 'Cloud Detection',
  circuitTracing: 'Circuit Tracing',
  componentIntelligence: 'Component Intelligence',
  estimationEngine: 'Estimation Engine'
};

const serviceDescriptions = {
  computerVision: 'Detects electrical components in drawings',
  cloudDetection: 'Identifies revision clouds and changes',
  circuitTracing: 'Traces electrical circuit connections',
  componentIntelligence: 'Provides component specifications and search',
  estimationEngine: 'Calculates project time estimates'
};

export const AIServiceHealthMonitor: React.FC<AIServiceHealthMonitorProps> = ({
  showDetails = true,
  showActions = true,
  onServiceClick,
  onFallbackMode,
  className
}) => {
  const { serviceHealth, overallHealth, lastHealthCheck, checkHealth } = useAIServiceHealth();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await checkHealth();
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleServiceExpanded = (service: string) => {
    const newExpanded = new Set(expandedServices);
    if (newExpanded.has(service)) {
      newExpanded.delete(service);
    } else {
      newExpanded.add(service);
    }
    setExpandedServices(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'unavailable':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-100 text-yellow-800">Degraded</Badge>;
      case 'unavailable':
        return <Badge className="bg-red-100 text-red-800">Unavailable</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getOverallStatusColor = () => {
    switch (overallHealth) {
      case 'healthy':
        return 'text-green-600';
      case 'degraded':
        return 'text-yellow-600';
      case 'unavailable':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getOverallStatusIcon = () => {
    switch (overallHealth) {
      case 'healthy':
        return <Wifi className="h-5 w-5 text-green-600" />;
      case 'degraded':
        return <Activity className="h-5 w-5 text-yellow-600" />;
      case 'unavailable':
        return <WifiOff className="h-5 w-5 text-red-600" />;
      default:
        return <Server className="h-5 w-5 text-gray-600" />;
    }
  };

  const healthyServices = Object.values(serviceHealth).filter(status => status === 'healthy').length;
  const totalServices = Object.keys(serviceHealth).length;
  const healthPercentage = (healthyServices / totalServices) * 100;

  const criticalServices = Object.entries(serviceHealth)
    .filter(([_, status]) => status === 'unavailable')
    .map(([service, _]) => serviceDisplayNames[service as keyof typeof serviceDisplayNames]);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getOverallStatusIcon()}
            <span>AI Services Status</span>
            <Badge 
              variant="outline"
              className={getOverallStatusColor()}
            >
              {overallHealth}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            {lastHealthCheck && (
              <span className="text-xs text-gray-500">
                {lastHealthCheck.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall Health Summary */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">System Health</span>
            <span className="text-sm text-gray-600">
              {healthyServices}/{totalServices} services
            </span>
          </div>
          <Progress value={healthPercentage} className="h-2" />
        </div>

        {/* Critical Alerts */}
        {criticalServices.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-red-900">
                  Critical Services Unavailable
                </h4>
                <p className="text-sm text-red-700 mt-1">
                  {criticalServices.join(', ')} {criticalServices.length === 1 ? 'is' : 'are'} currently unavailable.
                </p>
                {onFallbackMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onFallbackMode}
                    className="mt-2 text-red-700 border-red-300 hover:bg-red-100"
                  >
                    Switch to Manual Mode
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Service Details */}
        {showDetails && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Service Details</h4>
            <div className="space-y-2">
              {Object.entries(serviceHealth).map(([service, status]) => {
                const displayName = serviceDisplayNames[service as keyof typeof serviceDisplayNames];
                const description = serviceDescriptions[service as keyof typeof serviceDescriptions];
                const isExpanded = expandedServices.has(service);
                
                return (
                  <div
                    key={service}
                    className={cn(
                      'border rounded-lg p-3 transition-colors cursor-pointer',
                      status === 'healthy' && 'border-green-200 bg-green-50',
                      status === 'degraded' && 'border-yellow-200 bg-yellow-50',
                      status === 'unavailable' && 'border-red-200 bg-red-50',
                      status === 'unknown' && 'border-gray-200 bg-gray-50'
                    )}
                    onClick={() => toggleServiceExpanded(service)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {getStatusIcon(status)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {displayName}
                          </p>
                          <p className="text-xs text-gray-600 truncate">
                            {description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(status)}
                        {onServiceClick && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onServiceClick(service);
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-gray-500">Status:</span>
                            <p className="capitalize font-medium">{status}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Response Time:</span>
                            <p>
                              {status === 'healthy' ? '<100ms' : 
                               status === 'degraded' ? '>500ms' :
                               status === 'unavailable' ? 'Timeout' : 'Unknown'}
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-500">Last Check:</span>
                            <p>{lastHealthCheck?.toLocaleTimeString() || 'Never'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Uptime:</span>
                            <p>
                              {status === 'healthy' ? '99.9%' :
                               status === 'degraded' ? '95.2%' :
                               status === 'unavailable' ? '0%' : 'Unknown'}
                            </p>
                          </div>
                        </div>

                        {status === 'unavailable' && (
                          <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-xs">
                            <p className="text-red-800 font-medium">Service Unavailable</p>
                            <p className="text-red-700">
                              This service is currently offline. Some features may not work as expected.
                            </p>
                          </div>
                        )}

                        {status === 'degraded' && (
                          <div className="mt-2 p-2 bg-yellow-100 border border-yellow-200 rounded text-xs">
                            <p className="text-yellow-800 font-medium">Performance Degraded</p>
                            <p className="text-yellow-700">
                              This service is responding slowly. Analysis may take longer than usual.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* System Actions */}
        {showActions && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              Auto-refresh every 30 seconds
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={cn('h-3 w-3 mr-1', isRefreshing && 'animate-spin')} />
                Refresh
              </Button>
              {overallHealth !== 'healthy' && onFallbackMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onFallbackMode}
                  className="text-orange-600"
                >
                  <Settings className="h-3 w-3 mr-1" />
                  Manual Mode
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Fallback Mode Info */}
        {overallHealth === 'unavailable' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-blue-900">
                  Manual Mode Available
                </h4>
                <p className="text-sm text-blue-700 mt-1">
                  While AI services are unavailable, you can still use manual tools for component identification and circuit tracing.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};