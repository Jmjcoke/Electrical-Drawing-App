import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Separator } from '../ui/Separator';
import { Progress } from '../ui/Progress';
import { Switch } from '../ui/Switch';
import { Select } from '../ui/Select';
import { 
  Settings, 
  Zap, 
  Cpu, 
  Radio, 
  Thermometer,
  Gauge,
  Activity,
  Shield,
  Network,
  AlertTriangle,
  CheckCircle,
  Info,
  ExternalLink,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';

// Types for industrial control devices
interface IndustrialDeviceSpecification {
  manufacturer: string;
  model_number: string;
  series?: string;
  category: string;
  voltage_rating?: number;
  current_rating?: number;
  power_consumption?: number;
  supply_voltage_range?: [number, number];
  digital_inputs?: number;
  digital_outputs?: number;
  analog_inputs?: number;
  analog_outputs?: number;
  communication_protocols: string[];
  network_ports?: number;
  serial_ports?: number;
  dimensions: Record<string, number>;
  mounting_type?: string;
  operating_temperature?: [number, number];
  ip_rating?: string;
  measurement_range?: [number, number];
  accuracy?: number;
  resolution?: number;
  units?: string;
  motor_hp_range?: [number, number];
  speed_range?: [number, number];
  torque_rating?: number;
  certifications: string[];
  hazardous_area_rating?: string;
  sil_rating?: string;
  datasheet_url?: string;
  manual_url?: string;
  wiring_diagram_url?: string;
  installation_notes: string;
  price_estimate?: number;
  availability: string;
  replacement_parts: string[];
  end_of_life?: string;
}

interface ISASymbolRecognition {
  symbol_type: string;
  isa_code: string;
  description: string;
  confidence: number;
  tag_number?: string;
  loop_identifier?: string;
}

interface ControlLoopIdentification {
  loop_id: string;
  loop_type: string;
  components: string[];
  control_strategy?: string;
  setpoint?: number;
  process_variable?: string;
  controlled_variable?: string;
}

interface IndustrialRecognitionResult {
  component_id: string;
  category: string;
  confidence: number;
  bounding_box: [number, number, number, number];
  specifications?: IndustrialDeviceSpecification;
  isa_symbol?: ISASymbolRecognition;
  control_loop?: ControlLoopIdentification;
  visual_features: Record<string, any>;
  recognition_timestamp: string;
  alternative_matches: Array<{
    category: string;
    confidence: number;
  }>;
  network_connections: string[];
}

interface IndustrialControlOverlayProps {
  result: IndustrialRecognitionResult;
  position: { x: number; y: number };
  onClose: () => void;
  onNavigateToDatasheet?: (url: string) => void;
  onShowAlternatives?: (alternatives: Array<{ category: string; confidence: number }>) => void;
  onTraceConnections?: (componentId: string) => void;
  isVisible: boolean;
}

interface OverlayConfiguration {
  showSpecifications: boolean;
  showCompliance: boolean;
  showPricing: boolean;
  showAvailability: boolean;
  showISASymbol: boolean;
  showControlLoop: boolean;
  showNetworkInfo: boolean;
  transparency: number;
  position: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  colorScheme: 'default' | 'high_contrast' | 'dark' | 'light';
}

const defaultConfig: OverlayConfiguration = {
  showSpecifications: true,
  showCompliance: true,
  showPricing: false,
  showAvailability: true,
  showISASymbol: true,
  showControlLoop: true,
  showNetworkInfo: true,
  transparency: 0.95,
  position: 'auto',
  colorScheme: 'default'
};

const IndustrialControlOverlay: React.FC<IndustrialControlOverlayProps> = ({
  result,
  position,
  onClose,
  onNavigateToDatasheet,
  onShowAlternatives,
  onTraceConnections,
  isVisible
}) => {
  const [config, setConfig] = useState<OverlayConfiguration>(defaultConfig);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  // Get category icon
  const getCategoryIcon = (category: string) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      'plc': Cpu,
      'hmi': Activity,
      'vfd': Zap,
      'pressure_transmitter': Gauge,
      'temperature_transmitter': Thermometer,
      'flow_transmitter': Activity,
      'control_valve': Settings,
      'ethernet_switch': Network,
      'safety_plc': Shield,
      'motor_starter': Zap,
      'bas_controller': Radio
    };
    
    const IconComponent = iconMap[category] || Settings;
    return <IconComponent className="w-4 h-4" />;
  };

  // Get confidence level color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.95) return 'bg-emerald-500';
    if (confidence >= 0.85) return 'bg-blue-500';
    if (confidence >= 0.70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Get validation status color
  const getValidationColor = (status: string) => {
    switch (status) {
      case 'valid': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  // Format category display name
  const formatCategory = (category: string) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Format protocol display name
  const formatProtocol = (protocol: string) => {
    return protocol.replace(/_/g, '/').toUpperCase();
  };

  if (!isVisible) return null;

  const spec = result.specifications;
  const isaSymbol = result.isa_symbol;
  const controlLoop = result.control_loop;

  return (
    <div 
      className="absolute z-50 max-w-md bg-white rounded-lg shadow-xl border border-gray-200"
      style={{ 
        left: position.x, 
        top: position.y,
        opacity: config.transparency 
      }}
    >
      {/* Header */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getCategoryIcon(result.category)}
            <CardTitle className="text-lg font-semibold">
              {formatCategory(result.category)}
            </CardTitle>
            <Badge 
              variant="secondary" 
              className={`${getConfidenceColor(result.confidence)} text-white`}
            >
              {(result.confidence * 100).toFixed(1)}%
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfig(!showConfig)}
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              ×
            </Button>
          </div>
        </div>

        {/* Manufacturer and Model */}
        {spec && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">{spec.manufacturer}</span>
            <span>•</span>
            <span>{spec.model_number}</span>
            {spec.series && (
              <>
                <span>•</span>
                <span className="text-blue-600">{spec.series}</span>
              </>
            )}
          </div>
        )}

        {/* ISA Symbol */}
        {config.showISASymbol && isaSymbol && (
          <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
            <Badge variant="outline" className="bg-blue-100">
              {isaSymbol.isa_code}
            </Badge>
            {isaSymbol.tag_number && (
              <span className="text-sm font-mono">{isaSymbol.tag_number}</span>
            )}
            <span className="text-sm text-gray-600">{isaSymbol.description}</span>
          </div>
        )}
      </CardHeader>

      {/* Configuration Panel */}
      {showConfig && (
        <CardContent className="pt-0 pb-3 border-t bg-gray-50">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between">
                <label>Specifications</label>
                <Switch 
                  checked={config.showSpecifications}
                  onCheckedChange={(checked) => setConfig({...config, showSpecifications: checked})}
                />
              </div>
              <div className="flex items-center justify-between">
                <label>ISA Symbol</label>
                <Switch 
                  checked={config.showISASymbol}
                  onCheckedChange={(checked) => setConfig({...config, showISASymbol: checked})}
                />
              </div>
              <div className="flex items-center justify-between">
                <label>Control Loop</label>
                <Switch 
                  checked={config.showControlLoop}
                  onCheckedChange={(checked) => setConfig({...config, showControlLoop: checked})}
                />
              </div>
              <div className="flex items-center justify-between">
                <label>Network Info</label>
                <Switch 
                  checked={config.showNetworkInfo}
                  onCheckedChange={(checked) => setConfig({...config, showNetworkInfo: checked})}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-sm">Transparency:</label>
              <Progress 
                value={config.transparency * 100} 
                className="flex-1 h-2"
                onChange={(value) => setConfig({...config, transparency: value / 100})}
              />
            </div>
          </div>
        </CardContent>
      )}

      {isExpanded && (
        <CardContent className="pt-0">
          {/* Electrical Specifications */}
          {config.showSpecifications && spec && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {spec.voltage_rating && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Voltage:</span>
                    <span className="font-medium">{spec.voltage_rating}V</span>
                  </div>
                )}
                {spec.current_rating && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Current:</span>
                    <span className="font-medium">{spec.current_rating}A</span>
                  </div>
                )}
                {spec.power_consumption && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Power:</span>
                    <span className="font-medium">{spec.power_consumption}W</span>
                  </div>
                )}
                {spec.ip_rating && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">IP Rating:</span>
                    <span className="font-medium">{spec.ip_rating}</span>
                  </div>
                )}
              </div>

              {/* I/O Configuration */}
              {(spec.digital_inputs || spec.digital_outputs || spec.analog_inputs || spec.analog_outputs) && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">I/O Configuration</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {spec.digital_inputs && (
                      <div className="flex justify-between">
                        <span>Digital In:</span>
                        <span>{spec.digital_inputs}</span>
                      </div>
                    )}
                    {spec.digital_outputs && (
                      <div className="flex justify-between">
                        <span>Digital Out:</span>
                        <span>{spec.digital_outputs}</span>
                      </div>
                    )}
                    {spec.analog_inputs && (
                      <div className="flex justify-between">
                        <span>Analog In:</span>
                        <span>{spec.analog_inputs}</span>
                      </div>
                    )}
                    {spec.analog_outputs && (
                      <div className="flex justify-between">
                        <span>Analog Out:</span>
                        <span>{spec.analog_outputs}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Process Specifications */}
              {(spec.measurement_range || spec.accuracy || spec.units) && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Process Specifications</h4>
                  <div className="grid grid-cols-1 gap-1 text-xs">
                    {spec.measurement_range && (
                      <div className="flex justify-between">
                        <span>Range:</span>
                        <span>{spec.measurement_range[0]} - {spec.measurement_range[1]} {spec.units}</span>
                      </div>
                    )}
                    {spec.accuracy && (
                      <div className="flex justify-between">
                        <span>Accuracy:</span>
                        <span>±{spec.accuracy}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Motor Control Specifications */}
              {(spec.motor_hp_range || spec.speed_range) && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Motor Control</h4>
                  <div className="grid grid-cols-1 gap-1 text-xs">
                    {spec.motor_hp_range && (
                      <div className="flex justify-between">
                        <span>HP Range:</span>
                        <span>{spec.motor_hp_range[0]} - {spec.motor_hp_range[1]} HP</span>
                      </div>
                    )}
                    {spec.speed_range && (
                      <div className="flex justify-between">
                        <span>Speed Range:</span>
                        <span>{spec.speed_range[0]} - {spec.speed_range[1]} RPM</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator />
            </div>
          )}

          {/* Communication Protocols */}
          {config.showNetworkInfo && spec && spec.communication_protocols.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-1">
                <Network className="w-4 h-4" />
                Communication
              </h4>
              <div className="flex flex-wrap gap-1">
                {spec.communication_protocols.map((protocol, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {formatProtocol(protocol)}
                  </Badge>
                ))}
              </div>
              {(spec.network_ports || spec.serial_ports) && (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {spec.network_ports && (
                    <div className="flex justify-between">
                      <span>Network Ports:</span>
                      <span>{spec.network_ports}</span>
                    </div>
                  )}
                  {spec.serial_ports && (
                    <div className="flex justify-between">
                      <span>Serial Ports:</span>
                      <span>{spec.serial_ports}</span>
                    </div>
                  )}
                </div>
              )}
              <Separator />
            </div>
          )}

          {/* Control Loop Information */}
          {config.showControlLoop && controlLoop && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-1">
                <Activity className="w-4 h-4" />
                Control Loop
              </h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Loop ID:</span>
                  <span className="font-mono">{controlLoop.loop_id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="capitalize">{controlLoop.loop_type}</span>
                </div>
                {controlLoop.control_strategy && (
                  <div className="flex justify-between">
                    <span>Strategy:</span>
                    <span>{controlLoop.control_strategy}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Components:</span>
                  <span>{controlLoop.components.length}</span>
                </div>
              </div>
              <Separator />
            </div>
          )}

          {/* Compliance and Safety */}
          {config.showCompliance && spec && (spec.certifications.length > 0 || spec.sil_rating || spec.hazardous_area_rating) && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-1">
                <Shield className="w-4 h-4" />
                Compliance & Safety
              </h4>
              
              {spec.certifications.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {spec.certifications.map((cert, index) => (
                    <Badge key={index} variant="outline" className="text-xs bg-green-50">
                      {cert}
                    </Badge>
                  ))}
                </div>
              )}
              
              <div className="grid grid-cols-1 gap-1 text-xs">
                {spec.sil_rating && (
                  <div className="flex justify-between">
                    <span>SIL Rating:</span>
                    <span className="font-medium text-orange-600">{spec.sil_rating}</span>
                  </div>
                )}
                {spec.hazardous_area_rating && (
                  <div className="flex justify-between">
                    <span>Hazardous Area:</span>
                    <span className="font-medium text-red-600">{spec.hazardous_area_rating}</span>
                  </div>
                )}
              </div>
              <Separator />
            </div>
          )}

          {/* Availability and Pricing */}
          {(config.showAvailability || config.showPricing) && spec && (
            <div className="space-y-2">
              {config.showAvailability && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Availability:</span>
                  <Badge variant={spec.availability === 'in_stock' ? 'default' : 'secondary'}>
                    {spec.availability.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>
              )}
              
              {config.showPricing && spec.price_estimate && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Est. Price:</span>
                  <span className="font-medium">${spec.price_estimate.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mt-4">
            {spec?.datasheet_url && onNavigateToDatasheet && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateToDatasheet(spec.datasheet_url!)}
                className="text-xs"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Datasheet
              </Button>
            )}
            
            {spec?.manual_url && onNavigateToDatasheet && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateToDatasheet(spec.manual_url!)}
                className="text-xs"
              >
                <Download className="w-3 h-3 mr-1" />
                Manual
              </Button>
            )}
            
            {result.alternative_matches.length > 0 && onShowAlternatives && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onShowAlternatives(result.alternative_matches)}
                className="text-xs"
              >
                <Info className="w-3 h-3 mr-1" />
                Alternatives
              </Button>
            )}
            
            {result.network_connections.length > 0 && onTraceConnections && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onTraceConnections(result.component_id)}
                className="text-xs"
              >
                <Network className="w-3 h-3 mr-1" />
                Trace
              </Button>
            )}
          </div>

          {/* Alternative Matches */}
          {result.alternative_matches.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <h5 className="text-xs font-medium text-gray-600 mb-2">Alternative Matches:</h5>
              <div className="space-y-1">
                {result.alternative_matches.slice(0, 2).map((alt, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span>{formatCategory(alt.category)}</span>
                    <span className="text-gray-500">{(alt.confidence * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </div>
  );
};

export default IndustrialControlOverlay;