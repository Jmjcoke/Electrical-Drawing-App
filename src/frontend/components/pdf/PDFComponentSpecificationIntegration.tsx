/**
 * PDF Component Specification Integration
 * 
 * Integrates component specifications with the existing PDF viewer infrastructure
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { 
  ZapIcon, 
  SearchIcon, 
  LayersIcon,
  InfoIcon,
  SettingsIcon,
  ListIcon,
  GridIcon,
  SidebarIcon,
  EyeIcon,
  EyeOffIcon
} from 'lucide-react';

// Import existing PDF components
import ComponentInformationPanel from '@/components/electrical/ComponentInformationPanel';
import ComponentSpecificationOverlay, { useComponentSpecificationOverlay } from '@/components/electrical/ComponentSpecificationOverlay';
import ComponentSearchPanel from '@/components/electrical/ComponentSearchPanel';

// Import API services
import { ComponentSpecification, componentSpecificationsAPI } from '@/services/api/componentSpecifications';
import { ComponentDetection, componentRecognitionAPI } from '@/services/api/componentRecognition';

interface PDFComponentSpecificationIntegrationProps {
  // PDF Viewer props
  pdfCanvas: HTMLCanvasElement | null;
  currentPage: number;
  scale: number;
  
  // Detected components from existing cloud detection
  detectedComponents?: Array<{
    id: string;
    boundingBox: { x: number; y: number; width: number; height: number };
    category?: string;
    confidence: number;
    metadata?: any;
  }>;
  
  // Integration callbacks
  onComponentHighlight?: (componentId: string, highlight: boolean) => void;
  onComponentSelect?: (componentId: string) => void;
  onViewModeChange?: (mode: 'specifications' | 'annotations' | 'comparison') => void;
  
  className?: string;
}

interface ComponentWithSpecification {
  detection: ComponentDetection;
  specification?: ComponentSpecification;
  isLoading: boolean;
  error?: string;
}

const PDFComponentSpecificationIntegration: React.FC<PDFComponentSpecificationIntegrationProps> = ({
  pdfCanvas,
  currentPage,
  scale,
  detectedComponents = [],
  onComponentHighlight,
  onComponentSelect,
  onViewModeChange,
  className = ''
}) => {
  // State management
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'overlay'>('overlay');
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<ComponentSpecification | null>(null);
  const [componentsWithSpecs, setComponentsWithSpecs] = useState<ComponentWithSpecification[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStats, setProcessingStats] = useState({
    total: 0,
    processed: 0,
    matched: 0
  });

  // Layout state
  const [layoutConfig, setLayoutConfig] = useState({
    showOverlays: true,
    showInformationPanel: true,
    showSearchPanel: false,
    autoRecognition: true,
    overlayMode: 'hover' as 'hover' | 'click' | 'always'
  });

  // Refs
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  
  // Overlay management
  const {
    overlay,
    showOverlay,
    hideOverlay,
    pinOverlay,
    updatePosition
  } = useComponentSpecificationOverlay();

  // Initialize component recognition when detected components change
  useEffect(() => {
    if (detectedComponents.length > 0 && layoutConfig.autoRecognition) {
      processDetectedComponents();
    }
  }, [detectedComponents, currentPage, layoutConfig.autoRecognition]);

  const processDetectedComponents = async () => {
    if (!pdfCanvas || detectedComponents.length === 0) return;

    setIsProcessing(true);
    setProcessingStats({
      total: detectedComponents.length,
      processed: 0,
      matched: 0
    });

    const results: ComponentWithSpecification[] = [];

    for (const [index, detected] of detectedComponents.entries()) {
      try {
        // Convert detected component to ComponentDetection format
        const detection: ComponentDetection = {
          id: detected.id,
          category: detected.category || 'other',
          confidence: detected.confidence,
          bounding_box: detected.boundingBox,
          visual_features: {},
          metadata: detected.metadata
        };

        // Create initial result
        const componentWithSpec: ComponentWithSpecification = {
          detection,
          isLoading: true
        };
        
        results[index] = componentWithSpec;
        setComponentsWithSpecs([...results]);

        // Try to get specification for the component region
        const specification = await getSpecificationForDetection(detection);
        
        // Update result
        componentWithSpec.specification = specification;
        componentWithSpec.isLoading = false;
        
        setComponentsWithSpecs([...results]);
        setProcessingStats(prev => ({
          ...prev,
          processed: prev.processed + 1,
          matched: prev.matched + (specification ? 1 : 0)
        }));

      } catch (error) {
        console.error(`Failed to process component ${detected.id}:`, error);
        results[index] = {
          detection: {
            id: detected.id,
            category: detected.category || 'other',
            confidence: detected.confidence,
            bounding_box: detected.boundingBox,
            visual_features: {}
          },
          isLoading: false,
          error: error instanceof Error ? error.message : 'Processing failed'
        };
        setComponentsWithSpecs([...results]);
        setProcessingStats(prev => ({ ...prev, processed: prev.processed + 1 }));
      }
    }

    setIsProcessing(false);
  };

  const getSpecificationForDetection = async (
    detection: ComponentDetection
  ): Promise<ComponentSpecification | undefined> => {
    if (!pdfCanvas) return undefined;

    try {
      // Extract component region from PDF canvas
      const regionCanvas = extractComponentRegion(detection.bounding_box);
      
      // Use component recognition API to identify the component
      const recognitionResult = await componentRecognitionAPI.recognizeFromCanvas(regionCanvas, {
        enhance_ocr: true,
        match_specifications: true,
        confidence_threshold: 0.3
      });

      // Return the best match
      if (recognitionResult.detected_components.length > 0) {
        const bestMatch = recognitionResult.detected_components[0];
        return bestMatch.specifications;
      }

      // Fallback: try to search by category
      if (detection.category && detection.category !== 'other') {
        const searchResults = await componentSpecificationsAPI.searchComponents({
          category: detection.category as any
        }, 1, 5);
        
        return searchResults.components[0];
      }

    } catch (error) {
      console.error('Failed to get specification for detection:', error);
    }

    return undefined;
  };

  const extractComponentRegion = (boundingBox: { x: number; y: number; width: number; height: number }): HTMLCanvasElement => {
    if (!pdfCanvas) throw new Error('PDF canvas not available');

    const regionCanvas = document.createElement('canvas');
    const ctx = regionCanvas.getContext('2d')!;
    
    // Calculate absolute coordinates
    const x = boundingBox.x * pdfCanvas.width;
    const y = boundingBox.y * pdfCanvas.height;
    const width = boundingBox.width * pdfCanvas.width;
    const height = boundingBox.height * pdfCanvas.height;
    
    // Set region canvas size
    regionCanvas.width = width;
    regionCanvas.height = height;
    
    // Extract region
    ctx.drawImage(
      pdfCanvas,
      x, y, width, height,
      0, 0, width, height
    );
    
    return regionCanvas;
  };

  // Event handlers for PDF interaction
  const handlePDFClick = useCallback((event: MouseEvent) => {
    if (!pdfCanvas || !layoutConfig.showOverlays) return;

    const rect = pdfCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    // Find component at click position
    const clickedComponent = componentsWithSpecs.find(comp => {
      const bbox = comp.detection.bounding_box;
      return x >= bbox.x && x <= bbox.x + bbox.width &&
             y >= bbox.y && y <= bbox.y + bbox.height;
    });

    if (clickedComponent?.specification) {
      setSelectedComponent(clickedComponent.specification);
      
      if (layoutConfig.overlayMode === 'click') {
        showOverlay(
          clickedComponent.specification,
          { x: event.clientX, y: event.clientY },
          'click',
          clickedComponent.detection
        );
      }
      
      onComponentSelect?.(clickedComponent.detection.id);
    }
  }, [pdfCanvas, componentsWithSpecs, layoutConfig, showOverlay, onComponentSelect]);

  const handlePDFHover = useCallback((event: MouseEvent) => {
    if (!pdfCanvas || !layoutConfig.showOverlays || layoutConfig.overlayMode !== 'hover') return;

    const rect = pdfCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    // Find component at hover position
    const hoveredComponent = componentsWithSpecs.find(comp => {
      const bbox = comp.detection.bounding_box;
      return x >= bbox.x && x <= bbox.x + bbox.width &&
             y >= bbox.y && y <= bbox.y + bbox.height;
    });

    if (hoveredComponent?.specification) {
      showOverlay(
        hoveredComponent.specification,
        { x: event.clientX, y: event.clientY },
        'hover',
        hoveredComponent.detection
      );
      
      onComponentHighlight?.(hoveredComponent.detection.id, true);
    } else {
      hideOverlay();
      // Clear highlights
      componentsWithSpecs.forEach(comp => {
        onComponentHighlight?.(comp.detection.id, false);
      });
    }
  }, [pdfCanvas, componentsWithSpecs, layoutConfig, showOverlay, hideOverlay, onComponentHighlight]);

  // Attach PDF interaction events
  useEffect(() => {
    if (!pdfCanvas) return;

    pdfCanvas.addEventListener('click', handlePDFClick);
    pdfCanvas.addEventListener('mousemove', handlePDFHover);
    pdfCanvas.addEventListener('mouseleave', hideOverlay);

    return () => {
      pdfCanvas.removeEventListener('click', handlePDFClick);
      pdfCanvas.removeEventListener('mousemove', handlePDFHover);
      pdfCanvas.removeEventListener('mouseleave', hideOverlay);
    };
  }, [pdfCanvas, handlePDFClick, handlePDFHover, hideOverlay]);

  // Component list rendering
  const renderComponentsList = () => {
    if (componentsWithSpecs.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <ZapIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>No components detected on this page</p>
          {!layoutConfig.autoRecognition && (
            <Button
              variant="outline"
              size="sm"
              onClick={processDetectedComponents}
              className="mt-2"
            >
              Process Components
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {componentsWithSpecs.map((comp, index) => (
          <Card
            key={comp.detection.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedComponent?.id === comp.specification?.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => {
              if (comp.specification) {
                setSelectedComponent(comp.specification);
                onComponentSelect?.(comp.detection.id);
              }
            }}
          >
            <CardContent className="p-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {comp.detection.category}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(comp.detection.confidence * 100)}%
                    </Badge>
                  </div>
                  
                  {comp.isLoading ? (
                    <div className="text-sm text-gray-500">Processing...</div>
                  ) : comp.error ? (
                    <div className="text-sm text-red-500">{comp.error}</div>
                  ) : comp.specification ? (
                    <>
                      <div className="font-medium text-sm">{comp.specification.name}</div>
                      <div className="text-xs text-gray-600">
                        {comp.specification.manufacturer.brand || comp.specification.manufacturer.name} • 
                        {comp.specification.part_number}
                      </div>
                      
                      {/* Quick specs */}
                      <div className="flex gap-3 mt-2 text-xs">
                        {comp.specification.electrical_ratings.voltage_rating && (
                          <span className="text-gray-600">
                            {comp.specification.electrical_ratings.voltage_rating}V
                          </span>
                        )}
                        {comp.specification.electrical_ratings.current_rating && (
                          <span className="text-gray-600">
                            {comp.specification.electrical_ratings.current_rating}A
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500">No specification found</div>
                  )}
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onComponentHighlight?.(comp.detection.id, true);
                    setTimeout(() => onComponentHighlight?.(comp.detection.id, false), 2000);
                  }}
                  className="h-6 w-6 p-0"
                >
                  <EyeIcon className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const renderProcessingStats = () => {
    if (!isProcessing && processingStats.total === 0) return null;

    return (
      <Card className="mb-4">
        <CardContent className="p-3">
          <div className="flex justify-between items-center text-sm">
            <span>Component Processing</span>
            <span>{processingStats.processed}/{processingStats.total}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(processingStats.processed / processingStats.total) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>Specifications matched: {processingStats.matched}</span>
            {isProcessing && <span>Processing...</span>}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderControls = () => (
    <div className="flex items-center gap-2 mb-4">
      <Button
        variant={layoutConfig.showInformationPanel ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setLayoutConfig(prev => ({ 
          ...prev, 
          showInformationPanel: !prev.showInformationPanel 
        }))}
      >
        <InfoIcon className="w-4 h-4" />
      </Button>
      
      <Button
        variant={layoutConfig.showSearchPanel ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setLayoutConfig(prev => ({ 
          ...prev, 
          showSearchPanel: !prev.showSearchPanel 
        }))}
      >
        <SearchIcon className="w-4 h-4" />
      </Button>
      
      <Button
        variant={layoutConfig.showOverlays ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setLayoutConfig(prev => ({ 
          ...prev, 
          showOverlays: !prev.showOverlays 
        }))}
      >
        <LayersIcon className="w-4 h-4" />
      </Button>

      <div className="ml-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsPanelVisible(!isPanelVisible)}
        >
          {isPanelVisible ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );

  return (
    <div className={`flex h-full ${className}`}>
      {/* Main PDF Area with Overlays */}
      <div className="flex-1 relative" ref={pdfContainerRef}>
        {/* PDF Canvas renders here (managed by parent) */}
        
        {/* Component Specification Overlays */}
        {layoutConfig.showOverlays && (
          <ComponentSpecificationOverlay
            isVisible={overlay.isVisible}
            position={overlay.position}
            component={overlay.component}
            detection={overlay.detection}
            mode={overlay.mode}
            onClose={hideOverlay}
            onPin={pinOverlay}
            onViewDetails={(component) => setSelectedComponent(component)}
            containerRef={pdfContainerRef}
          />
        )}
      </div>

      {/* Side Panel */}
      {isPanelVisible && (
        <div className="w-96 border-l border-gray-200 bg-white flex flex-col">
          {/* Panel Header */}
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold mb-2">Component Intelligence</h2>
            {renderControls()}
            {renderProcessingStats()}
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-hidden">
            {layoutConfig.showSearchPanel ? (
              <ComponentSearchPanel
                onComponentSelect={(component) => {
                  setSelectedComponent(component);
                  setLayoutConfig(prev => ({ ...prev, showInformationPanel: true }));
                }}
                className="h-full"
              />
            ) : (
              <div className="h-full flex flex-col">
                {/* Components List */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Detected Components</h3>
                    <Badge variant="secondary">
                      {componentsWithSpecs.length}
                    </Badge>
                  </div>
                  {renderComponentsList()}
                </div>

                {/* Component Information Panel */}
                {layoutConfig.showInformationPanel && selectedComponent && (
                  <div className="border-t border-gray-200 max-h-96 overflow-y-auto">
                    <ComponentInformationPanel
                      component={selectedComponent}
                      onDownloadDatasheet={(url) => window.open(url, '_blank')}
                      className="p-4"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFComponentSpecificationIntegration;