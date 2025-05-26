import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Progress } from '../ui/Progress';
import { Separator } from '../ui/Separator';
import { 
  Network, 
  Cpu, 
  Monitor, 
  Settings, 
  Shield, 
  Zap,
  Activity,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Info,
  Layers,
  GitBranch,
  Server,
  Radio,
  Eye,
  TrendingUp,
  Database
} from 'lucide-react';

// Types for control system architecture
interface ControlSystemHierarchy {
  level: string;
  devices: string[];
  connections: Array<[string, string]>;
  protocols: string[];
  redundancy: string;
}

interface NetworkSegment {
  segment_id: string;
  protocol: string;
  devices: string[];
  topology: string;
  redundancy: string;
  bandwidth?: string;
  max_devices?: number;
  cable_type?: string;
  distance_limits?: [number, number];
}

interface IOSummary {
  digital_inputs: number;
  digital_outputs: number;
  analog_inputs: number;
  analog_outputs: number;
  spare_di: number;
  spare_do: number;
  spare_ai: number;
  spare_ao: number;
  total_capacity_di: number;
  total_capacity_do: number;
  total_capacity_ai: number;
  total_capacity_ao: number;
}

interface SafetySystem {
  system_id: string;
  primary_device?: string;
  device_category?: string;
  sil_rating?: string;
  redundancy: string;
  connected_devices: string[];
  safety_function: string;
  tag_number?: string;
  loop_identifier?: string;
  confidence?: number;
}

interface ControlSystemArchitectureAnalysis {
  system_hierarchy: Record<string, ControlSystemHierarchy>;
  network_segments: NetworkSegment[];
  io_summary: IOSummary;
  control_loops: Array<{
    loop_id: string;
    loop_type: string;
    components: string[];
    control_strategy?: string;
    setpoint?: number;
    process_variable?: string;
    controlled_variable?: string;
  }>;
  safety_systems: SafetySystem[];
  performance_metrics: {
    total_devices: number;
    devices_by_level: Record<string, number>;
    network_segments: number;
    protocols_used: string[];
    io_utilization: Record<string, number>;
    redundancy_coverage: number;
    safety_device_count: number;
    estimated_scan_time: number;
    network_bandwidth_utilization: Record<string, number>;
  };
  recommendations: string[];
  analysis_timestamp: string;
}

interface ControlSystemArchitectureViewerProps {
  analysis: ControlSystemArchitectureAnalysis;
  onDeviceSelect?: (deviceId: string) => void;
  onNetworkSegmentSelect?: (segmentId: string) => void;
  onSafetySystemSelect?: (systemId: string) => void;
}

const ControlSystemArchitectureViewer: React.FC<ControlSystemArchitectureViewerProps> = ({
  analysis,
  onDeviceSelect,
  onNetworkSegmentSelect,
  onSafetySystemSelect
}) => {
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'network' | 'io' | 'safety' | 'performance'>('hierarchy');
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  // Hierarchy level icons and colors
  const getLevelIcon = (level: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      'enterprise': Database,
      'supervision': Monitor,
      'control': Cpu,
      'field_control': Settings,
      'field_device': Radio
    };
    return iconMap[level] || Settings;
  };

  const getLevelColor = (level: string) => {
    const colorMap: Record<string, string> = {
      'enterprise': 'bg-purple-500',
      'supervision': 'bg-blue-500',
      'control': 'bg-green-500',
      'field_control': 'bg-yellow-500',
      'field_device': 'bg-gray-500'
    };
    return colorMap[level] || 'bg-gray-500';
  };

  // Protocol formatting
  const formatProtocol = (protocol: string) => {
    return protocol.replace(/_/g, '/').toUpperCase();
  };

  // Redundancy status color
  const getRedundancyColor = (redundancy: string) => {
    switch (redundancy) {
      case 'hot_standby': return 'text-green-600';
      case 'cold_standby': return 'text-yellow-600';
      case 'fault_tolerant': return 'text-blue-600';
      case 'load_sharing': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  // SIL rating color
  const getSILColor = (silRating: string) => {
    switch (silRating) {
      case 'SIL 1': return 'bg-green-500';
      case 'SIL 2': return 'bg-yellow-500';
      case 'SIL 3': return 'bg-orange-500';
      case 'SIL 4': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Calculate utilization percentage
  const getUtilization = (used: number, total: number) => {
    return total > 0 ? (used / total) * 100 : 0;
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    if (percentage >= 50) return 'bg-blue-500';
    return 'bg-green-500';
  };

  // Memoized calculations
  const totalIOPoints = useMemo(() => {
    return analysis.io_summary.digital_inputs + 
           analysis.io_summary.digital_outputs + 
           analysis.io_summary.analog_inputs + 
           analysis.io_summary.analog_outputs;
  }, [analysis.io_summary]);

  const networkProtocolStats = useMemo(() => {
    const stats: Record<string, number> = {};
    analysis.network_segments.forEach(segment => {
      stats[segment.protocol] = (stats[segment.protocol] || 0) + segment.devices.length;
    });
    return stats;
  }, [analysis.network_segments]);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Control System Architecture Analysis
            </CardTitle>
            <Badge variant="outline">
              {analysis.performance_metrics.total_devices} Devices
            </Badge>
          </div>
          <p className="text-sm text-gray-600">
            Analysis completed on {new Date(analysis.analysis_timestamp).toLocaleString()}
          </p>
        </CardHeader>
      </Card>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'hierarchy', label: 'System Hierarchy', icon: Layers },
          { id: 'network', label: 'Network Topology', icon: Network },
          { id: 'io', label: 'I/O Summary', icon: GitBranch },
          { id: 'safety', label: 'Safety Systems', icon: Shield },
          { id: 'performance', label: 'Performance', icon: BarChart3 }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'hierarchy' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5" />
                Control System Hierarchy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(analysis.system_hierarchy)
                  .filter(([_, hierarchy]) => hierarchy.devices.length > 0)
                  .map(([level, hierarchy]) => {
                    const LevelIcon = getLevelIcon(level);
                    return (
                      <div key={level} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${getLevelColor(level)} text-white`}>
                              <LevelIcon className="w-4 h-4" />
                            </div>
                            <div>
                              <h3 className="font-semibold capitalize">
                                {level.replace('_', ' ')} Level
                              </h3>
                              <p className="text-sm text-gray-600">
                                {hierarchy.devices.length} devices
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {hierarchy.redundancy !== 'none' && (
                              <Badge variant="outline" className={getRedundancyColor(hierarchy.redundancy)}>
                                {hierarchy.redundancy.replace('_', ' ')}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Protocols */}
                        {hierarchy.protocols.length > 0 && (
                          <div className="mb-3">
                            <p className="text-sm font-medium mb-2">Communication Protocols:</p>
                            <div className="flex flex-wrap gap-1">
                              {hierarchy.protocols.map(protocol => (
                                <Badge key={protocol} variant="outline" className="text-xs">
                                  {formatProtocol(protocol)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Devices */}
                        <div>
                          <p className="text-sm font-medium mb-2">Devices:</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {hierarchy.devices.map(deviceId => (
                              <button
                                key={deviceId}
                                onClick={() => onDeviceSelect?.(deviceId)}
                                className="text-left p-2 text-sm bg-gray-50 rounded border hover:bg-gray-100 transition-colors"
                              >
                                {deviceId}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Connections */}
                        {hierarchy.connections.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium mb-2">Internal Connections:</p>
                            <div className="text-sm text-gray-600">
                              {hierarchy.connections.length} connection(s)
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'network' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="w-5 h-5" />
                Network Topology Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Network Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Network className="w-4 h-4 text-blue-600" />
                      <span className="font-medium">Segments</span>
                    </div>
                    <div className="text-2xl font-bold text-blue-600">
                      {analysis.network_segments.length}
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="w-4 h-4 text-green-600" />
                      <span className="font-medium">Protocols</span>
                    </div>
                    <div className="text-2xl font-bold text-green-600">
                      {analysis.performance_metrics.protocols_used.length}
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-purple-600" />
                      <span className="font-medium">Redundancy</span>
                    </div>
                    <div className="text-2xl font-bold text-purple-600">
                      {(analysis.performance_metrics.redundancy_coverage * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>

                {/* Network Segments */}
                <div className="space-y-4">
                  {analysis.network_segments.map(segment => (
                    <div key={segment.segment_id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Network className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{formatProtocol(segment.protocol)}</h3>
                            <p className="text-sm text-gray-600">
                              {segment.devices.length} devices • {segment.topology} topology
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {segment.redundancy !== 'none' && (
                            <Badge variant="outline" className="text-green-600">
                              Redundant
                            </Badge>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onNetworkSegmentSelect?.(segment.segment_id)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Network Properties:</p>
                          <div className="space-y-1 text-sm">
                            {segment.bandwidth && (
                              <div className="flex justify-between">
                                <span>Bandwidth:</span>
                                <span className="font-medium">{segment.bandwidth}</span>
                              </div>
                            )}
                            {segment.max_devices && (
                              <div className="flex justify-between">
                                <span>Max Devices:</span>
                                <span className="font-medium">{segment.max_devices}</span>
                              </div>
                            )}
                            {segment.cable_type && (
                              <div className="flex justify-between">
                                <span>Cable Type:</span>
                                <span className="font-medium capitalize">{segment.cable_type}</span>
                              </div>
                            )}
                            {segment.distance_limits && (
                              <div className="flex justify-between">
                                <span>Distance Limit:</span>
                                <span className="font-medium">{segment.distance_limits[1]}m</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium mb-2">Connected Devices:</p>
                          <div className="max-h-32 overflow-y-auto">
                            <div className="grid grid-cols-1 gap-1">
                              {segment.devices.slice(0, 8).map(deviceId => (
                                <button
                                  key={deviceId}
                                  onClick={() => onDeviceSelect?.(deviceId)}
                                  className="text-left text-xs p-1 bg-gray-50 rounded hover:bg-gray-100"
                                >
                                  {deviceId}
                                </button>
                              ))}
                              {segment.devices.length > 8 && (
                                <div className="text-xs text-gray-500 p-1">
                                  +{segment.devices.length - 8} more devices
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Protocol Statistics */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Protocol Distribution</h3>
                  <div className="space-y-2">
                    {Object.entries(networkProtocolStats).map(([protocol, deviceCount]) => (
                      <div key={protocol} className="flex items-center justify-between">
                        <span className="text-sm">{formatProtocol(protocol)}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{
                                width: `${(deviceCount / analysis.performance_metrics.total_devices) * 100}%`
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium w-8">{deviceCount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'io' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                I/O System Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* I/O Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {analysis.io_summary.digital_inputs}
                    </div>
                    <div className="text-sm text-gray-600">Digital Inputs</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {analysis.io_summary.digital_outputs}
                    </div>
                    <div className="text-sm text-gray-600">Digital Outputs</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {analysis.io_summary.analog_inputs}
                    </div>
                    <div className="text-sm text-gray-600">Analog Inputs</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {analysis.io_summary.analog_outputs}
                    </div>
                    <div className="text-sm text-gray-600">Analog Outputs</div>
                  </div>
                </div>

                {/* Utilization Analysis */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-4">I/O Utilization</h3>
                  <div className="space-y-4">
                    {[
                      { 
                        label: 'Digital Inputs', 
                        used: analysis.io_summary.digital_inputs, 
                        total: analysis.io_summary.total_capacity_di,
                        spare: analysis.io_summary.spare_di
                      },
                      { 
                        label: 'Digital Outputs', 
                        used: analysis.io_summary.digital_outputs, 
                        total: analysis.io_summary.total_capacity_do,
                        spare: analysis.io_summary.spare_do
                      },
                      { 
                        label: 'Analog Inputs', 
                        used: analysis.io_summary.analog_inputs, 
                        total: analysis.io_summary.total_capacity_ai,
                        spare: analysis.io_summary.spare_ai
                      },
                      { 
                        label: 'Analog Outputs', 
                        used: analysis.io_summary.analog_outputs, 
                        total: analysis.io_summary.total_capacity_ao,
                        spare: analysis.io_summary.spare_ao
                      }
                    ].map(io => {
                      const utilization = getUtilization(io.used, io.total);
                      return (
                        <div key={io.label} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">{io.label}</span>
                            <span className="text-sm text-gray-600">
                              {io.used}/{io.total} ({utilization.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getUtilizationColor(utilization)}`}
                              style={{ width: `${Math.min(utilization, 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Used: {io.used}</span>
                            <span>Spare: {io.spare}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* I/O Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3">Total I/O Points</h4>
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      {totalIOPoints}
                    </div>
                    <div className="text-sm text-gray-600">
                      Combined analog and digital I/O
                    </div>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-3">Estimated Scan Time</h4>
                    <div className="text-3xl font-bold text-green-600 mb-2">
                      {analysis.performance_metrics.estimated_scan_time.toFixed(1)}
                      <span className="text-lg text-gray-600 ml-1">ms</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      System response time
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'safety' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Safety Systems Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Safety Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-red-600" />
                      <span className="font-medium">Safety Systems</span>
                    </div>
                    <div className="text-2xl font-bold text-red-600">
                      {analysis.safety_systems.length}
                    </div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-orange-600" />
                      <span className="font-medium">Safety Devices</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-600">
                      {analysis.performance_metrics.safety_device_count}
                    </div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-4 h-4 text-yellow-600" />
                      <span className="font-medium">SIL Rated</span>
                    </div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {analysis.safety_systems.filter(s => s.sil_rating).length}
                    </div>
                  </div>
                </div>

                {/* Safety Systems List */}
                {analysis.safety_systems.length > 0 ? (
                  <div className="space-y-4">
                    {analysis.safety_systems.map(safetySystem => (
                      <div key={safetySystem.system_id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-100 rounded-lg">
                              <Shield className="w-4 h-4 text-red-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{safetySystem.system_id}</h3>
                              <p className="text-sm text-gray-600 capitalize">
                                {safetySystem.safety_function.replace('_', ' ')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {safetySystem.sil_rating && (
                              <Badge className={`text-white ${getSILColor(safetySystem.sil_rating)}`}>
                                {safetySystem.sil_rating}
                              </Badge>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onSafetySystemSelect?.(safetySystem.system_id)}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Details
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium mb-2">System Properties:</p>
                            <div className="space-y-1 text-sm">
                              {safetySystem.primary_device && (
                                <div className="flex justify-between">
                                  <span>Primary Device:</span>
                                  <span className="font-medium">{safetySystem.primary_device}</span>
                                </div>
                              )}
                              {safetySystem.device_category && (
                                <div className="flex justify-between">
                                  <span>Category:</span>
                                  <span className="font-medium capitalize">
                                    {safetySystem.device_category.replace('_', ' ')}
                                  </span>
                                </div>
                              )}
                              {safetySystem.tag_number && (
                                <div className="flex justify-between">
                                  <span>Tag Number:</span>
                                  <span className="font-medium font-mono">{safetySystem.tag_number}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span>Redundancy:</span>
                                <span className={`font-medium capitalize ${getRedundancyColor(safetySystem.redundancy)}`}>
                                  {safetySystem.redundancy.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-medium mb-2">Connected Devices:</p>
                            <div className="max-h-24 overflow-y-auto">
                              {safetySystem.connected_devices.length > 0 ? (
                                <div className="space-y-1">
                                  {safetySystem.connected_devices.map(deviceId => (
                                    <button
                                      key={deviceId}
                                      onClick={() => onDeviceSelect?.(deviceId)}
                                      className="text-left text-xs p-1 bg-gray-50 rounded hover:bg-gray-100 w-full"
                                    >
                                      {deviceId}
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-500">No connected devices</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No safety systems detected in this analysis</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Performance Metrics & Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {analysis.performance_metrics.total_devices}
                    </div>
                    <div className="text-sm text-gray-600">Total Devices</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {analysis.performance_metrics.network_segments}
                    </div>
                    <div className="text-sm text-gray-600">Network Segments</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {(analysis.performance_metrics.redundancy_coverage * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm text-gray-600">Redundancy Coverage</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {analysis.performance_metrics.estimated_scan_time.toFixed(1)}ms
                    </div>
                    <div className="text-sm text-gray-600">Scan Time</div>
                  </div>
                </div>

                {/* Device Distribution */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-4">Device Distribution by Level</h3>
                  <div className="space-y-3">
                    {Object.entries(analysis.performance_metrics.devices_by_level).map(([level, count]) => (
                      <div key={level} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {React.createElement(getLevelIcon(level), { className: "w-4 h-4" })}
                          <span className="capitalize">{level.replace('_', ' ')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${getLevelColor(level)}`}
                              style={{
                                width: `${(count / analysis.performance_metrics.total_devices) * 100}%`
                              }}
                            />
                          </div>
                          <span className="font-medium w-8">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    System Recommendations
                  </h3>
                  {analysis.recommendations.length > 0 ? (
                    <div className="space-y-3">
                      {analysis.recommendations.map((recommendation, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                          <Info className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-gray-700">{recommendation}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                      <p>No recommendations - system appears well configured</p>
                    </div>
                  )}
                </div>

                {/* Protocol Usage */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-4">Communication Protocols in Use</h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.performance_metrics.protocols_used.map(protocol => (
                      <Badge key={protocol} variant="outline" className="text-sm">
                        {formatProtocol(protocol)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ControlSystemArchitectureViewer;