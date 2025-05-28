// Confidence Threshold Controls with Real-time Preview - Story 3.2

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useAIAnalysisStore, useComponentDetectionsByConfidence, useConfidenceMetrics } from '@/stores/aiAnalysisStore';
import { Slider } from '@/components/ui/Slider';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Eye,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import debounce from 'debounce';

interface ConfidenceThresholdControlsProps {
  onThresholdChange?: (threshold: number) => void;
  showPreview?: boolean;
  showPresets?: boolean;
  showImpactAnalysis?: boolean;
  className?: string;
}

const confidencePresets = [
  {
    name: 'Conservative',
    value: 0.90,
    description: 'High precision, fewer detections',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle
  },
  {
    name: 'Balanced',
    value: 0.75,
    description: 'Good balance of precision and recall',
    color: 'bg-blue-100 text-blue-800',
    icon: Target
  },
  {
    name: 'Aggressive',
    value: 0.60,
    description: 'More detections, review carefully',
    color: 'bg-yellow-100 text-yellow-800',
    icon: AlertTriangle
  }
];

export const ConfidenceThresholdControls: React.FC<ConfidenceThresholdControlsProps> = ({
  onThresholdChange,
  showPreview = true,
  showPresets = true,
  showImpactAnalysis = true,
  className
}) => {
  const {
    confidenceThreshold,
    setConfidenceThreshold,
    componentDetections
  } = useAIAnalysisStore();

  const filteredDetections = useComponentDetectionsByConfidence();
  const confidenceMetrics = useConfidenceMetrics();

  // Local state for real-time preview
  const [previewThreshold, setPreviewThreshold] = useState(confidenceThreshold);
  const [isAdjusting, setIsAdjusting] = useState(false);

  // Debounced threshold update
  const debouncedUpdate = useMemo(
    () => debounce((threshold: number) => {
      setConfidenceThreshold(threshold);
      onThresholdChange?.(threshold);
      setIsAdjusting(false);
    }, 300),
    [setConfidenceThreshold, onThresholdChange]
  );

  // Handle slider change with preview
  const handleSliderChange = useCallback((values: number[]) => {
    const newThreshold = values[0];
    setPreviewThreshold(newThreshold);
    setIsAdjusting(true);
    debouncedUpdate(newThreshold);
  }, [debouncedUpdate]);

  // Apply preset threshold
  const applyPreset = useCallback((preset: typeof confidencePresets[0]) => {
    setPreviewThreshold(preset.value);
    setConfidenceThreshold(preset.value);
    onThresholdChange?.(preset.value);
    setIsAdjusting(false);
  }, [setConfidenceThreshold, onThresholdChange]);

  // Calculate impact of threshold change
  const calculateImpact = useCallback((threshold: number) => {
    const currentCount = filteredDetections.length;
    const newCount = componentDetections.filter(d => d.confidence >= threshold).length;
    const change = newCount - currentCount;
    
    return {
      newCount,
      change,
      changePercent: currentCount > 0 ? (change / currentCount) * 100 : 0
    };
  }, [componentDetections, filteredDetections]);

  // Get confidence distribution for threshold
  const getDistributionForThreshold = useCallback((threshold: number) => {
    const filtered = componentDetections.filter(d => d.confidence >= threshold);
    const total = filtered.length;
    
    if (total === 0) {
      return { high: 0, medium: 0, low: 0 };
    }
    
    const high = filtered.filter(d => d.confidence > 0.85).length;
    const medium = filtered.filter(d => d.confidence >= 0.70 && d.confidence <= 0.85).length;
    const low = filtered.filter(d => d.confidence < 0.70).length;
    
    return {
      high: (high / total) * 100,
      medium: (medium / total) * 100,
      low: (low / total) * 100
    };
  }, [componentDetections]);

  const currentThreshold = isAdjusting ? previewThreshold : confidenceThreshold;
  const impact = calculateImpact(currentThreshold);
  const distribution = getDistributionForThreshold(currentThreshold);

  const getThresholdColor = (threshold: number) => {
    if (threshold >= 0.85) return 'text-green-600';
    if (threshold >= 0.70) return 'text-blue-600';
    return 'text-orange-600';
  };

  const getThresholdBgColor = (threshold: number) => {
    if (threshold >= 0.85) return 'bg-green-100';
    if (threshold >= 0.70) return 'bg-blue-100';
    return 'bg-orange-100';
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center space-x-2">
          <Target className="h-5 w-5 text-blue-600" />
          <span>Confidence Threshold</span>
          <Badge 
            variant="secondary"
            className={cn(
              getThresholdColor(currentThreshold),
              getThresholdBgColor(currentThreshold)
            )}
          >
            {Math.round(currentThreshold * 100)}%
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Threshold Slider */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium">
              Detection Threshold
            </label>
            <div className="flex items-center space-x-2">
              {isAdjusting && (
                <span className="text-xs text-gray-500">Adjusting...</span>
              )}
              <span className={cn('text-sm font-medium', getThresholdColor(currentThreshold))}>
                {Math.round(currentThreshold * 100)}%
              </span>
            </div>
          </div>
          
          <Slider
            value={[currentThreshold]}
            onValueChange={handleSliderChange}
            min={0.5}
            max={0.95}
            step={0.05}
            className="w-full"
          />
          
          <div className="flex justify-between text-xs text-gray-500">
            <span>50% (Aggressive)</span>
            <span>75% (Balanced)</span>
            <span>95% (Conservative)</span>
          </div>
        </div>

        {/* Preset Buttons */}
        {showPresets && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Quick Presets</h4>
            <div className="grid grid-cols-3 gap-2">
              {confidencePresets.map((preset) => {
                const Icon = preset.icon;
                const isActive = Math.abs(currentThreshold - preset.value) < 0.01;
                
                return (
                  <Button
                    key={preset.name}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      'flex flex-col items-center space-y-1 h-auto py-3',
                      isActive && 'ring-2 ring-blue-500'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{preset.name}</span>
                    <span className="text-xs text-gray-500">
                      {Math.round(preset.value * 100)}%
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Impact Preview */}
        {showPreview && componentDetections.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center space-x-2">
              <Eye className="h-4 w-4" />
              <span>Detection Preview</span>
            </h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Visible Components</span>
                  <div className="flex items-center space-x-1">
                    {impact.change !== 0 && (
                      <>
                        {impact.change > 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-600" />
                        )}
                        <span className={cn(
                          'text-xs',
                          impact.change > 0 ? 'text-green-600' : 'text-red-600'
                        )}>
                          {impact.change > 0 ? '+' : ''}{impact.change}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {impact.newCount}
                </div>
                <div className="text-xs text-gray-500">
                  of {componentDetections.length} total
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm text-gray-600">Average Confidence</span>
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(confidenceMetrics.overall * 100)}%
                </div>
                <div className="text-xs text-gray-500">
                  Current detections
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Impact Analysis */}
        {showImpactAnalysis && componentDetections.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Confidence Distribution</span>
            </h4>
            
            <div className="space-y-2">
              {/* High Confidence */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">High (&gt;85%)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${distribution.high}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-600 w-8">
                    {Math.round(distribution.high)}%
                  </span>
                </div>
              </div>

              {/* Medium Confidence */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-sm">Medium (70-85%)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${distribution.medium}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-600 w-8">
                    {Math.round(distribution.medium)}%
                  </span>
                </div>
              </div>

              {/* Low Confidence */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-sm">Low (&lt;70%)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${distribution.low}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-600 w-8">
                    {Math.round(distribution.low)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <h5 className="text-xs font-semibold text-gray-700 mb-1">Recommendation</h5>
              <p className="text-xs text-gray-600">
                {currentThreshold >= 0.85 ? (
                  'Conservative setting ensures high precision but may miss some components. Good for final reviews.'
                ) : currentThreshold >= 0.70 ? (
                  'Balanced setting provides good mix of precision and recall. Recommended for most analyses.'
                ) : (
                  'Aggressive setting captures more components but requires careful review. Use for comprehensive detection.'
                )}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};