/**
 * Real-Time Component Specification Overlay
 * 
 * Provides hover and click-based specification tooltips and contextual displays
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { 
  ZapIcon, 
  InfoIcon, 
  XIcon,
  PinIcon,
  CompareIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ExternalLinkIcon
} from 'lucide-react';
import { ComponentSpecification } from '@/services/api/componentSpecifications';
import { ComponentDetection } from '@/services/api/componentRecognition';

interface OverlayPosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

interface ComponentSpecificationOverlayProps {
  isVisible: boolean;
  position: OverlayPosition;
  component: ComponentSpecification | null;
  detection?: ComponentDetection;
  mode: 'hover' | 'click' | 'pinned';
  onClose?: () => void;
  onPin?: () => void;
  onCompare?: (component: ComponentSpecification) => void;
  onViewDetails?: (component: ComponentSpecification) => void;
  containerRef?: React.RefObject<HTMLElement>;
  className?: string;
}

interface TooltipContent {
  title: string;
  subtitle: string;
  quickSpecs: Array<{ label: string; value: string; unit?: string; highlight?: boolean }>;
  warnings: string[];
  confidence?: number;
}

const ComponentSpecificationOverlay: React.FC<ComponentSpecificationOverlayProps> = ({
  isVisible,
  position,
  component,
  detection,
  mode,
  onClose,
  onPin,
  onCompare,
  onViewDetails,
  containerRef,
  className = ''
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const [isAnimating, setIsAnimating] = useState(false);

  // Calculate tooltip content
  const tooltipContent = useMemo((): TooltipContent | null => {
    if (!component) return null;

    const quickSpecs = [];
    
    // Electrical ratings (most important)
    if (component.electrical_ratings.voltage_rating) {
      quickSpecs.push({
        label: 'Voltage',
        value: component.electrical_ratings.voltage_rating.toString(),
        unit: 'V',
        highlight: true
      });
    }
    
    if (component.electrical_ratings.current_rating) {
      quickSpecs.push({
        label: 'Current',
        value: component.electrical_ratings.current_rating.toString(),
        unit: 'A',
        highlight: true
      });
    }

    // Physical info
    if (component.dimensions.length && component.dimensions.width && component.dimensions.height) {
      quickSpecs.push({
        label: 'Size',
        value: `${component.dimensions.length}×${component.dimensions.width}×${component.dimensions.height}`,
        unit: 'in'
      });
    }

    // Compliance
    if (component.compliance.nema_rating) {
      quickSpecs.push({
        label: 'NEMA',
        value: component.compliance.nema_rating
      });
    }

    // Generate warnings
    const warnings = [];
    if (!component.compliance.ul_listed) {
      warnings.push('Not UL Listed');
    }
    if (!component.verified) {
      warnings.push('Unverified specifications');
    }
    if (component.confidence_score < 0.8) {
      warnings.push('Low confidence match');
    }

    return {
      title: component.name,
      subtitle: `${component.manufacturer.brand || component.manufacturer.name} • ${component.part_number}`,
      quickSpecs: quickSpecs.slice(0, 4), // Limit to 4 items for tooltip
      warnings,
      confidence: detection?.confidence
    };
  }, [component, detection]);

  // Position adjustment to keep overlay in viewport
  useEffect(() => {
    if (!isVisible || !overlayRef.current || !containerRef?.current) {
      setAdjustedPosition(position);
      return;
    }

    const overlay = overlayRef.current;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();

    let newX = position.x;
    let newY = position.y;

    // Adjust horizontal position
    if (newX + overlayRect.width > containerRect.width) {
      newX = containerRect.width - overlayRect.width - 10;
    }
    if (newX < 10) {
      newX = 10;
    }

    // Adjust vertical position
    if (newY + overlayRect.height > containerRect.height) {
      newY = position.y - overlayRect.height - 10;
    }
    if (newY < 10) {
      newY = 10;
    }

    setAdjustedPosition({ x: newX, y: newY });
  }, [isVisible, position, containerRef]);

  // Animation effects
  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  // Handle outside clicks for pinned mode
  useEffect(() => {
    if (mode !== 'pinned') return;

    const handleClickOutside = (event: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(event.target as Node)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mode, onClose]);

  const renderQuickSpecs = () => {
    if (!tooltipContent?.quickSpecs.length) return null;

    return (
      <div className="grid grid-cols-2 gap-2 mt-3">
        {tooltipContent.quickSpecs.map((spec, index) => (
          <div 
            key={index} 
            className={`text-xs p-2 rounded-md ${
              spec.highlight 
                ? 'bg-blue-50 border border-blue-200' 
                : 'bg-gray-50'
            }`}
          >
            <div className="text-gray-600 font-medium">{spec.label}</div>
            <div className={`font-semibold ${spec.highlight ? 'text-blue-700' : 'text-gray-900'}`}>
              {spec.value}{spec.unit ? ` ${spec.unit}` : ''}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderWarnings = () => {
    if (!tooltipContent?.warnings.length) return null;

    return (
      <div className="mt-3 space-y-1">
        {tooltipContent.warnings.map((warning, index) => (
          <div key={index} className="flex items-center gap-2 text-xs text-orange-600">
            <AlertTriangleIcon className="w-3 h-3 flex-shrink-0" />
            {warning}
          </div>
        ))}
      </div>
    );
  };

  const renderConfidence = () => {
    if (!tooltipContent?.confidence) return null;

    const confidencePercent = Math.round(tooltipContent.confidence * 100);
    const confidenceColor = confidencePercent >= 80 ? 'text-green-600' : 
                          confidencePercent >= 60 ? 'text-yellow-600' : 'text-red-600';

    return (
      <div className="flex items-center gap-2 mt-2 text-xs">
        <span className="text-gray-600">Detection confidence:</span>
        <span className={`font-semibold ${confidenceColor}`}>
          {confidencePercent}%
        </span>
      </div>
    );
  };

  const renderActions = () => {
    if (mode === 'hover') return null;

    return (
      <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-200">
        {mode === 'click' && onPin && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onPin}
            className="h-6 px-2 text-xs"
          >
            <PinIcon className="w-3 h-3 mr-1" />
            Pin
          </Button>
        )}
        
        {onCompare && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => component && onCompare(component)}
            className="h-6 px-2 text-xs"
          >
            <CompareIcon className="w-3 h-3 mr-1" />
            Compare
          </Button>
        )}
        
        {onViewDetails && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => component && onViewDetails(component)}
            className="h-6 px-2 text-xs"
          >
            <ExternalLinkIcon className="w-3 h-3 mr-1" />
            Details
          </Button>
        )}

        {mode === 'pinned' && onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 px-2 text-xs ml-auto"
          >
            <XIcon className="w-3 h-3" />
          </Button>
        )}
      </div>
    );
  };

  const renderTooltipContent = () => {
    if (!tooltipContent) {
      return (
        <div className="text-center text-gray-500 p-4">
          <InfoIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <div className="text-sm">No specification data available</div>
        </div>
      );
    }

    return (
      <>
        {/* Header */}
        <div className="mb-3">
          <h3 className="font-semibold text-sm text-gray-900 leading-tight">
            {tooltipContent.title}
          </h3>
          <p className="text-xs text-gray-600 mt-1">
            {tooltipContent.subtitle}
          </p>
          
          {/* Verification badge */}
          <div className="flex items-center gap-2 mt-2">
            <Badge 
              variant={component?.verified ? 'default' : 'secondary'}
              className="text-xs"
            >
              {component?.verified ? 'Verified' : 'Unverified'}
            </Badge>
            
            {component?.compliance.ul_listed && (
              <Badge variant="outline" className="text-xs">
                UL Listed
              </Badge>
            )}
          </div>
        </div>

        {/* Quick specifications */}
        {renderQuickSpecs()}

        {/* Confidence score */}
        {renderConfidence()}

        {/* Warnings */}
        {renderWarnings()}

        {/* Actions */}
        {renderActions()}
      </>
    );
  };

  if (!isVisible || !component) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    left: adjustedPosition.x,
    top: adjustedPosition.y,
    zIndex: 1000,
    maxWidth: mode === 'hover' ? '280px' : '320px',
    transform: isAnimating ? 'scale(0.95)' : 'scale(1)',
    opacity: isAnimating ? 0.8 : 1,
    transition: 'all 0.2s ease-out'
  };

  const overlayElement = (
    <div
      ref={overlayRef}
      style={overlayStyle}
      className={`${className}`}
    >
      <Card className={`
        shadow-lg border-2 
        ${mode === 'pinned' ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}
        ${mode === 'hover' ? 'pointer-events-none' : ''}
      `}>
        <CardContent className="p-4">
          {renderTooltipContent()}
        </CardContent>
      </Card>
    </div>
  );

  // Render in portal if container ref is provided
  if (containerRef?.current) {
    return createPortal(overlayElement, containerRef.current);
  }

  return overlayElement;
};

// Hook for managing overlay state
export const useComponentSpecificationOverlay = () => {
  const [overlay, setOverlay] = useState<{
    isVisible: boolean;
    position: OverlayPosition;
    component: ComponentSpecification | null;
    detection?: ComponentDetection;
    mode: 'hover' | 'click' | 'pinned';
  }>({
    isVisible: false,
    position: { x: 0, y: 0 },
    component: null,
    mode: 'hover'
  });

  const showOverlay = useCallback((
    component: ComponentSpecification,
    position: OverlayPosition,
    mode: 'hover' | 'click' | 'pinned' = 'hover',
    detection?: ComponentDetection
  ) => {
    setOverlay({
      isVisible: true,
      position,
      component,
      detection,
      mode
    });
  }, []);

  const hideOverlay = useCallback(() => {
    setOverlay(prev => ({ ...prev, isVisible: false }));
  }, []);

  const pinOverlay = useCallback(() => {
    setOverlay(prev => ({ ...prev, mode: 'pinned' }));
  }, []);

  const updatePosition = useCallback((position: OverlayPosition) => {
    setOverlay(prev => ({ ...prev, position }));
  }, []);

  return {
    overlay,
    showOverlay,
    hideOverlay,
    pinOverlay,
    updatePosition
  };
};

// Component for comparing multiple specifications
interface ComponentComparisonOverlayProps {
  components: ComponentSpecification[];
  position: OverlayPosition;
  isVisible: boolean;
  onClose?: () => void;
  containerRef?: React.RefObject<HTMLElement>;
}

export const ComponentComparisonOverlay: React.FC<ComponentComparisonOverlayProps> = ({
  components,
  position,
  isVisible,
  onClose,
  containerRef
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  if (!isVisible || components.length === 0) return null;

  const comparisonFields = [
    { key: 'voltage_rating', label: 'Voltage', unit: 'V', path: ['electrical_ratings', 'voltage_rating'] },
    { key: 'current_rating', label: 'Current', unit: 'A', path: ['electrical_ratings', 'current_rating'] },
    { key: 'power_rating', label: 'Power', unit: 'W', path: ['electrical_ratings', 'power_rating'] },
    { key: 'nema_rating', label: 'NEMA', path: ['compliance', 'nema_rating'] },
    { key: 'ul_listed', label: 'UL Listed', path: ['compliance', 'ul_listed'] },
  ];

  const getValue = (component: ComponentSpecification, path: string[]) => {
    return path.reduce((obj: any, key) => obj?.[key], component);
  };

  const overlayElement = (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 1001,
        maxWidth: '400px'
      }}
    >
      <Card className="shadow-xl border-2 border-blue-300 bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-sm">
            <span>Component Comparison</span>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} className="h-4 w-4 p-0">
                <XIcon className="w-3 h-3" />
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 text-gray-600">Specification</th>
                  {components.map((component, index) => (
                    <th key={index} className="text-left p-2 text-gray-900 min-w-24">
                      <div className="truncate">{component.part_number}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonFields.map((field) => (
                  <tr key={field.key} className="border-b border-gray-100">
                    <td className="p-2 text-gray-600 font-medium">{field.label}</td>
                    {components.map((component, index) => {
                      const value = getValue(component, field.path);
                      return (
                        <td key={index} className="p-2">
                          {typeof value === 'boolean' ? (
                            value ? (
                              <CheckCircleIcon className="w-4 h-4 text-green-500" />
                            ) : (
                              <XIcon className="w-4 h-4 text-red-500" />
                            )
                          ) : (
                            <span>{value || 'N/A'}{field.unit ? ` ${field.unit}` : ''}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (containerRef?.current) {
    return createPortal(overlayElement, containerRef.current);
  }

  return overlayElement;
};

export default ComponentSpecificationOverlay;