import React, { useState } from 'react';
import {
  Monitor,
  Settings,
  Zap,
  Target,
  Palette,
  Layers,
  Download,
  Copy,
  Star,
  Info
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Alert, AlertDescription } from '../ui/Alert';
import { cn } from '../../lib/utils';

interface CADSystemPreset {
  id: string;
  name: string;
  cadSystem: 'autocad' | 'microstation' | 'solidworks' | 'generic';
  version: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  configuration: {
    sensitivity: number;
    confidenceThreshold: number;
    colorThresholds: {
      red: number;
      green: number;
      blue: number;
      alpha: number;
    };
    shapeParameters: {
      minArea: number;
      maxArea: number;
      aspectRatioTolerance: number;
      edgeSmoothing: number;
    };
    textureFilters: {
      gaussianBlur: number;
      contrastEnhancement: number;
      edgeDetection: boolean;
      noiseReduction: number;
    };
    visualizationMode: string;
  };
  optimizedFor: string[];
  accuracy: number;
  performance: 'high' | 'medium' | 'low';
  isRecommended?: boolean;
  lastUpdated: string;
}

interface CADSystemPresetsProps {
  onPresetSelect?: (preset: CADSystemPreset) => void;
  onPresetApply?: (preset: CADSystemPreset) => void;
  onPresetCustomize?: (preset: CADSystemPreset) => void;
  selectedPresetId?: string;
  className?: string;
}

const CAD_SYSTEM_PRESETS: CADSystemPreset[] = [
  {
    id: 'autocad-2024',
    name: 'AutoCAD 2024 Electrical',
    cadSystem: 'autocad',
    version: '2024',
    description: 'Optimized for AutoCAD 2024 electrical drawings with standard revision clouds and markup patterns',
    icon: <Monitor className="h-6 w-6" />,
    features: [
      'Standard revision cloud detection',
      'Red markup recognition',
      'Layer-based filtering',
      'Block reference handling',
      'Polyline cloud support'
    ],
    configuration: {
      sensitivity: 0.75,
      confidenceThreshold: 0.65,
      colorThresholds: { red: 0.85, green: 0.3, blue: 0.3, alpha: 0.7 },
      shapeParameters: { minArea: 150, maxArea: 25000, aspectRatioTolerance: 0.3, edgeSmoothing: 2.0 },
      textureFilters: { gaussianBlur: 1.5, contrastEnhancement: 1.2, edgeDetection: true, noiseReduction: 0.8 },
      visualizationMode: 'standard'
    },
    optimizedFor: [
      'Electrical schematics',
      'Panel layouts',
      'Wiring diagrams',
      'Control circuits'
    ],
    accuracy: 92,
    performance: 'high',
    isRecommended: true,
    lastUpdated: '2024-03-15'
  },
  {
    id: 'autocad-legacy',
    name: 'AutoCAD Legacy (2018-2023)',
    cadSystem: 'autocad',
    version: 'Legacy',
    description: 'Compatible with older AutoCAD versions, handles various cloud styles and legacy markup methods',
    icon: <Monitor className="h-6 w-6" />,
    features: [
      'Multi-version compatibility',
      'Variable cloud styles',
      'Text-based revisions',
      'Hatch pattern recognition',
      'Legacy format support'
    ],
    configuration: {
      sensitivity: 0.8,
      confidenceThreshold: 0.6,
      colorThresholds: { red: 0.75, green: 0.4, blue: 0.4, alpha: 0.6 },
      shapeParameters: { minArea: 200, maxArea: 30000, aspectRatioTolerance: 0.4, edgeSmoothing: 2.5 },
      textureFilters: { gaussianBlur: 1.8, contrastEnhancement: 1.3, edgeDetection: true, noiseReduction: 1.0 },
      visualizationMode: 'outline'
    },
    optimizedFor: [
      'Legacy drawings',
      'Mixed format files',
      'Converted documents',
      'Archive drawings'
    ],
    accuracy: 87,
    performance: 'medium',
    lastUpdated: '2024-02-20'
  },
  {
    id: 'microstation-v8i',
    name: 'MicroStation V8i Connect',
    cadSystem: 'microstation',
    version: 'V8i',
    description: 'Configured for MicroStation V8i electrical designs with cell-based clouds and reference handling',
    icon: <Target className="h-6 w-6" />,
    features: [
      'Cell library integration',
      'Reference file support',
      'Level-based filtering',
      'Fence tool detection',
      'Custom line styles'
    ],
    configuration: {
      sensitivity: 0.7,
      confidenceThreshold: 0.68,
      colorThresholds: { red: 0.9, green: 0.2, blue: 0.2, alpha: 0.8 },
      shapeParameters: { minArea: 180, maxArea: 28000, aspectRatioTolerance: 0.35, edgeSmoothing: 1.8 },
      textureFilters: { gaussianBlur: 1.2, contrastEnhancement: 1.25, edgeDetection: true, noiseReduction: 0.7 },
      visualizationMode: 'contour'
    },
    optimizedFor: [
      'Power distribution',
      'Substation designs',
      'Cable routing',
      'Equipment layouts'
    ],
    accuracy: 89,
    performance: 'high',
    lastUpdated: '2024-03-10'
  },
  {
    id: 'microstation-connect',
    name: 'MicroStation CONNECT Edition',
    cadSystem: 'microstation',
    version: 'CONNECT',
    description: 'Latest MicroStation features with enhanced cloud detection and markup tools',
    icon: <Target className="h-6 w-6" />,
    features: [
      'Enhanced markup tools',
      'Parametric cells',
      'Cloud workflow',
      'Digital signatures',
      'i-model support'
    ],
    configuration: {
      sensitivity: 0.72,
      confidenceThreshold: 0.7,
      colorThresholds: { red: 0.88, green: 0.25, blue: 0.25, alpha: 0.75 },
      shapeParameters: { minArea: 160, maxArea: 26000, aspectRatioTolerance: 0.32, edgeSmoothing: 1.9 },
      textureFilters: { gaussianBlur: 1.3, contrastEnhancement: 1.28, edgeDetection: true, noiseReduction: 0.75 },
      visualizationMode: 'pattern_specific'
    },
    optimizedFor: [
      'Modern electrical designs',
      'BIM integration',
      'Collaborative workflows',
      'Standards compliance'
    ],
    accuracy: 91,
    performance: 'high',
    isRecommended: true,
    lastUpdated: '2024-03-18'
  },
  {
    id: 'solidworks-electrical',
    name: 'SolidWorks Electrical Professional',
    cadSystem: 'solidworks',
    version: '2024',
    description: 'Specialized for SolidWorks Electrical schematics with symbol libraries and intelligent components',
    icon: <Layers className="h-6 w-6" />,
    features: [
      'Symbol-based detection',
      'Component intelligence',
      'Wire routing awareness',
      'Project integration',
      'Standards libraries'
    ],
    configuration: {
      sensitivity: 0.78,
      confidenceThreshold: 0.72,
      colorThresholds: { red: 0.7, green: 0.45, blue: 0.45, alpha: 0.65 },
      shapeParameters: { minArea: 120, maxArea: 22000, aspectRatioTolerance: 0.45, edgeSmoothing: 2.2 },
      textureFilters: { gaussianBlur: 1.6, contrastEnhancement: 1.15, edgeDetection: false, noiseReduction: 0.9 },
      visualizationMode: 'heatmap'
    },
    optimizedFor: [
      'Schematic designs',
      'Panel builder',
      'Cable/harness',
      'PLC integration'
    ],
    accuracy: 88,
    performance: 'medium',
    lastUpdated: '2024-03-12'
  },
  {
    id: 'solidworks-premium',
    name: 'SolidWorks Premium CAD',
    cadSystem: 'solidworks',
    version: 'Premium',
    description: 'General SolidWorks CAD with electrical add-ins and custom markup styles',
    icon: <Layers className="h-6 w-6" />,
    features: [
      'CAD integration',
      'Custom annotations',
      'Assembly markup',
      'Revision control',
      'Drawing templates'
    ],
    configuration: {
      sensitivity: 0.82,
      confidenceThreshold: 0.68,
      colorThresholds: { red: 0.65, green: 0.5, blue: 0.5, alpha: 0.6 },
      shapeParameters: { minArea: 100, maxArea: 20000, aspectRatioTolerance: 0.5, edgeSmoothing: 2.5 },
      textureFilters: { gaussianBlur: 1.9, contrastEnhancement: 1.1, edgeDetection: false, noiseReduction: 1.1 },
      visualizationMode: 'standard'
    },
    optimizedFor: [
      'Mechanical drawings',
      'Assembly views',
      'Detail drawings',
      'Engineering notes'
    ],
    accuracy: 85,
    performance: 'medium',
    lastUpdated: '2024-02-28'
  },
  {
    id: 'generic-high-performance',
    name: 'Generic High Performance',
    cadSystem: 'generic',
    version: 'Universal',
    description: 'Universal preset for maximum detection capability across all CAD systems and formats',
    icon: <Zap className="h-6 w-6" />,
    features: [
      'Multi-format support',
      'Adaptive algorithms',
      'High sensitivity',
      'Broad compatibility',
      'Format agnostic'
    ],
    configuration: {
      sensitivity: 0.9,
      confidenceThreshold: 0.45,
      colorThresholds: { red: 0.6, green: 0.6, blue: 0.6, alpha: 0.5 },
      shapeParameters: { minArea: 80, maxArea: 40000, aspectRatioTolerance: 0.6, edgeSmoothing: 3.0 },
      textureFilters: { gaussianBlur: 2.0, contrastEnhancement: 1.4, edgeDetection: true, noiseReduction: 1.2 },
      visualizationMode: 'heatmap'
    },
    optimizedFor: [
      'Unknown formats',
      'Mixed documents',
      'Scanned drawings',
      'Low quality images'
    ],
    accuracy: 78,
    performance: 'low',
    lastUpdated: '2024-03-01'
  },
  {
    id: 'generic-balanced',
    name: 'Generic Balanced',
    cadSystem: 'generic',
    version: 'Universal',
    description: 'Balanced preset offering good performance and accuracy for most electrical drawing types',
    icon: <Settings className="h-6 w-6" />,
    features: [
      'Balanced approach',
      'Good performance',
      'Standard accuracy',
      'Wide compatibility',
      'Reliable results'
    ],
    configuration: {
      sensitivity: 0.65,
      confidenceThreshold: 0.6,
      colorThresholds: { red: 0.8, green: 0.35, blue: 0.35, alpha: 0.7 },
      shapeParameters: { minArea: 150, maxArea: 25000, aspectRatioTolerance: 0.35, edgeSmoothing: 2.0 },
      textureFilters: { gaussianBlur: 1.5, contrastEnhancement: 1.2, edgeDetection: true, noiseReduction: 0.8 },
      visualizationMode: 'standard'
    },
    optimizedFor: [
      'General use',
      'Standard drawings',
      'Mixed workflows',
      'Default choice'
    ],
    accuracy: 83,
    performance: 'high',
    isRecommended: true,
    lastUpdated: '2024-03-05'
  }
];

export const CADSystemPresets: React.FC<CADSystemPresetsProps> = ({
  onPresetSelect,
  onPresetApply,
  onPresetCustomize,
  selectedPresetId,
  className
}) => {
  const [selectedCadSystem, setSelectedCadSystem] = useState<string>('all');
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const filteredPresets = selectedCadSystem === 'all' 
    ? CAD_SYSTEM_PRESETS 
    : CAD_SYSTEM_PRESETS.filter(preset => preset.cadSystem === selectedCadSystem);

  const cadSystems = [
    { value: 'all', label: 'All Systems' },
    { value: 'autocad', label: 'AutoCAD' },
    { value: 'microstation', label: 'MicroStation' },
    { value: 'solidworks', label: 'SolidWorks' },
    { value: 'generic', label: 'Generic' }
  ];

  const handlePresetClick = (preset: CADSystemPreset) => {
    onPresetSelect?.(preset);
  };

  const getPerformanceColor = (performance: string) => {
    switch (performance) {
      case 'high': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getCadSystemColor = (system: string) => {
    switch (system) {
      case 'autocad': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'microstation': return 'bg-green-100 text-green-800 border-green-200';
      case 'solidworks': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 90) return 'text-green-600';
    if (accuracy >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Monitor className="h-5 w-5" />
            <span>CAD System Presets</span>
            <Badge variant="outline">{filteredPresets.length} presets</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <label className="text-sm font-medium">Filter by CAD System:</label>
            <select
              value={selectedCadSystem}
              onChange={(e) => setSelectedCadSystem(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              {cadSystems.map(system => (
                <option key={system.value} value={system.value}>
                  {system.label}
                </option>
              ))}
            </select>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              These presets are optimized for specific CAD systems and drawing types. 
              Select a preset that matches your workflow for best results.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Preset Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredPresets.map(preset => (
          <Card
            key={preset.id}
            className={cn(
              'cursor-pointer transition-all hover:shadow-lg',
              selectedPresetId === preset.id && 'ring-2 ring-blue-500 bg-blue-50',
              preset.isRecommended && 'border-green-300 bg-green-50'
            )}
            onClick={() => handlePresetClick(preset)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className={cn('p-2 rounded-lg', getCadSystemColor(preset.cadSystem))}>
                    {preset.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg flex items-center space-x-2">
                      <span>{preset.name}</span>
                      {preset.isRecommended && (
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                      )}
                    </h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge className={getCadSystemColor(preset.cadSystem)}>
                        {preset.cadSystem.toUpperCase()} {preset.version}
                      </Badge>
                      <Badge className={getPerformanceColor(preset.performance)}>
                        {preset.performance.toUpperCase()} PERF
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className={cn('text-2xl font-bold', getAccuracyColor(preset.accuracy))}>
                    {preset.accuracy}%
                  </div>
                  <div className="text-xs text-gray-500">Accuracy</div>
                </div>
              </div>

              <p className="text-sm text-gray-600 mt-2">{preset.description}</p>
            </CardHeader>

            <CardContent>
              {/* Configuration Summary */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="text-center p-2 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600">Sensitivity</div>
                  <div className="font-semibold">{Math.round(preset.configuration.sensitivity * 100)}%</div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded">
                  <div className="text-xs text-gray-600">Confidence</div>
                  <div className="font-semibold">{Math.round(preset.configuration.confidenceThreshold * 100)}%</div>
                </div>
              </div>

              {/* Features */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Key Features:</h4>
                <div className="space-y-1">
                  {preset.features.slice(0, 3).map((feature, index) => (
                    <div key={index} className="text-xs text-gray-600 flex items-center">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2" />
                      {feature}
                    </div>
                  ))}
                  {preset.features.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{preset.features.length - 3} more features
                    </div>
                  )}
                </div>
              </div>

              {/* Optimized For */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Optimized For:</h4>
                <div className="flex flex-wrap gap-1">
                  {preset.optimizedFor.map((item, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2 pt-2 border-t">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPresetApply?.(preset);
                  }}
                >
                  Apply Preset
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPresetCustomize?.(preset);
                  }}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Customize
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDetails(showDetails === preset.id ? null : preset.id);
                  }}
                >
                  <Info className="h-4 w-4 mr-1" />
                  Details
                </Button>
              </div>

              {/* Detailed Configuration */}
              {showDetails === preset.id && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Detailed Configuration:</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="font-medium">Color Thresholds:</span>
                      <div className="ml-2">
                        Red: {(preset.configuration.colorThresholds.red * 100).toFixed(0)}%<br/>
                        Alpha: {(preset.configuration.colorThresholds.alpha * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Shape Parameters:</span>
                      <div className="ml-2">
                        Min Area: {preset.configuration.shapeParameters.minArea}px<br/>
                        Max Area: {preset.configuration.shapeParameters.maxArea}px
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Texture Filters:</span>
                      <div className="ml-2">
                        Blur: {preset.configuration.textureFilters.gaussianBlur}<br/>
                        Contrast: {preset.configuration.textureFilters.contrastEnhancement}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Visualization:</span>
                      <div className="ml-2 capitalize">
                        {preset.configuration.visualizationMode.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-500">
                    Last updated: {new Date(preset.lastUpdated).toLocaleDateString()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* No Results */}
      {filteredPresets.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No presets found</h3>
            <p className="text-gray-600">
              No presets are available for the selected CAD system.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};