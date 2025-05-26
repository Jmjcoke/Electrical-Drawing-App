import React, { useState, useEffect, useCallback, useRef } from 'react';
import { EnhancedPDFViewer } from './EnhancedPDFViewer';
import { ComponentSelectionOverlay } from './ComponentSelectionOverlay';
import { AnnotationToolbar } from './AnnotationToolbar';
import { AnnotationCanvas } from './AnnotationCanvas';
import { DrawingComparisonView } from './DrawingComparisonView';
import { MinimapNavigator } from './MinimapNavigator';
import { DocumentSearchInterface } from './DocumentSearchInterface';
import { MeasurementToolkit } from './MeasurementToolkit';
import { NavigationBookmarks } from './NavigationBookmarks';
import { RenderOptimizer } from './RenderOptimizer';
import { CacheManager } from './CacheManager';
import { MemoryManager } from './MemoryManager';
import { PerformanceMonitor } from './PerformanceMonitor';
import { CloudDetectionViewer } from './CloudDetectionViewer';
import { useComponentSelection } from '../hooks/useComponentSelection';
import { 
  PDFDocument, 
  ViewportState, 
  ElectricalComponent, 
  Annotation, 
  MeasurementResult,
  Bookmark,
  CloudDetectionResult 
} from '../../types';

interface PDFViewerIntegrationProps {
  documentId: string;
  documentUrl: string;
  initialPage?: number;
  enableCloudDetection?: boolean;
  enableCollaboration?: boolean;
  enablePerformanceOptimization?: boolean;
  onDocumentLoad?: (document: PDFDocument) => void;
  onError?: (error: Error) => void;
}

interface ViewerState {
  document: PDFDocument | null;
  currentPage: number;
  viewport: ViewportState;
  isLoading: boolean;
  error: string | null;
  activeMode: 'view' | 'annotate' | 'measure' | 'compare' | 'analyze';
  cloudDetectionResults: CloudDetectionResult[];
  annotations: Annotation[];
  measurements: MeasurementResult[];
  bookmarks: Bookmark[];
}

export const PDFViewerIntegration: React.FC<PDFViewerIntegrationProps> = ({
  documentId,
  documentUrl,
  initialPage = 1,
  enableCloudDetection = true,
  enableCollaboration = true,
  enablePerformanceOptimization = true,
  onDocumentLoad,
  onError
}) => {
  const [viewerState, setViewerState] = useState<ViewerState>({
    document: null,
    currentPage: initialPage,
    viewport: {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      rotation: 0
    },
    isLoading: true,
    error: null,
    activeMode: 'view',
    cloudDetectionResults: [],
    annotations: [],
    measurements: [],
    bookmarks: []
  });

  const [components, setComponents] = useState<ElectricalComponent[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>({});
  const [isMinimapVisible, setIsMinimapVisible] = useState(true);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isMeasurementVisible, setIsMeasurementVisible] = useState(false);
  const [isBookmarksVisible, setIsBookmarksVisible] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Component selection hook
  const {
    selectedComponents,
    selectedComponentIds,
    selectComponent,
    clearSelection,
    isSelected
  } = useComponentSelection({
    components,
    onSelectionChange: (selected) => {
      console.log('Selection changed:', selected);
    }
  });

  // Initialize document loading
  useEffect(() => {
    loadDocument();
  }, [documentUrl]);

  // Initialize cloud detection when enabled
  useEffect(() => {
    if (enableCloudDetection && viewerState.document) {
      initializeCloudDetection();
    }
  }, [enableCloudDetection, viewerState.document]);

  const loadDocument = useCallback(async () => {
    try {
      setViewerState(prev => ({ ...prev, isLoading: true, error: null }));

      // Simulate document loading (in real app, use PDF.js)
      const response = await fetch(documentUrl);
      if (!response.ok) {
        throw new Error(`Failed to load document: ${response.statusText}`);
      }

      const documentData = await response.blob();
      const document: PDFDocument = {
        id: documentId,
        url: documentUrl,
        name: documentUrl.split('/').pop() || 'document.pdf',
        pageCount: 10, // This would come from PDF.js
        metadata: {
          title: 'Electrical Drawing',
          subject: 'Electrical System Design',
          creator: 'CAD System',
          creationDate: new Date().toISOString()
        },
        thumbnail: null,
        size: documentData.size
      };

      setViewerState(prev => ({
        ...prev,
        document,
        isLoading: false,
        currentPage: Math.min(initialPage, document.pageCount)
      }));

      onDocumentLoad?.(document);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setViewerState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [documentUrl, documentId, initialPage, onDocumentLoad, onError]);

  const initializeCloudDetection = useCallback(async () => {
    if (!viewerState.document) return;

    try {
      // Integrate with existing cloud detection service
      const response = await fetch(`/api/documents/${documentId}/cloud-detection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pageNumber: viewerState.currentPage,
          detectionSettings: {
            sensitivity: 0.8,
            minSize: 10,
            maxSize: 1000
          }
        })
      });

      if (response.ok) {
        const results = await response.json();
        setViewerState(prev => ({
          ...prev,
          cloudDetectionResults: results.detections || []
        }));
      }
    } catch (error) {
      console.error('Cloud detection initialization failed:', error);
    }
  }, [documentId, viewerState.document, viewerState.currentPage]);

  const handleViewportChange = useCallback((newViewport: ViewportState) => {
    setViewerState(prev => ({
      ...prev,
      viewport: newViewport
    }));
  }, []);

  const handlePageChange = useCallback((pageNumber: number) => {
    if (!viewerState.document) return;
    
    const validPageNumber = Math.max(1, Math.min(pageNumber, viewerState.document.pageCount));
    setViewerState(prev => ({
      ...prev,
      currentPage: validPageNumber
    }));

    // Reinitialize cloud detection for new page
    if (enableCloudDetection) {
      initializeCloudDetection();
    }
  }, [viewerState.document, enableCloudDetection, initializeCloudDetection]);

  const handleModeChange = useCallback((mode: ViewerState['activeMode']) => {
    setViewerState(prev => ({ ...prev, activeMode: mode }));
    
    // Close other panels when switching modes
    if (mode !== 'measure') setIsMeasurementVisible(false);
    if (mode !== 'view') setIsSearchVisible(false);
  }, []);

  const handleAnnotationAdd = useCallback((annotation: Annotation) => {
    setViewerState(prev => ({
      ...prev,
      annotations: [...prev.annotations, annotation]
    }));
  }, []);

  const handleAnnotationUpdate = useCallback((id: string, updates: Partial<Annotation>) => {
    setViewerState(prev => ({
      ...prev,
      annotations: prev.annotations.map(ann => 
        ann.id === id ? { ...ann, ...updates } : ann
      )
    }));
  }, []);

  const handleAnnotationDelete = useCallback((id: string) => {
    setViewerState(prev => ({
      ...prev,
      annotations: prev.annotations.filter(ann => ann.id !== id)
    }));
  }, []);

  const handleMeasurementAdd = useCallback((measurement: MeasurementResult) => {
    setViewerState(prev => ({
      ...prev,
      measurements: [...prev.measurements, measurement]
    }));
  }, []);

  const handleBookmarkAdd = useCallback((bookmark: Bookmark) => {
    setViewerState(prev => ({
      ...prev,
      bookmarks: [...prev.bookmarks, bookmark]
    }));
  }, []);

  const handleComponentsDetected = useCallback((detectedComponents: ElectricalComponent[]) => {
    setComponents(detectedComponents);
  }, []);

  const handlePerformanceUpdate = useCallback((metrics: any) => {
    setPerformanceMetrics(metrics);
  }, []);

  const handleSearchResultNavigation = useCallback((result: any) => {
    // Navigate to search result location
    if (result.location) {
      const newViewport: ViewportState = {
        ...viewerState.viewport,
        offsetX: -result.location.x * viewerState.viewport.scale + 400,
        offsetY: -result.location.y * viewerState.viewport.scale + 300,
        scale: Math.max(1, viewerState.viewport.scale)
      };
      handleViewportChange(newViewport);
    }
  }, [viewerState.viewport, handleViewportChange]);

  const renderModeContent = useCallback(() => {
    const commonProps = {
      viewport: viewerState.viewport,
      onViewportChange: handleViewportChange,
      components,
      annotations: viewerState.annotations,
      canvas: canvasRef.current
    };

    switch (viewerState.activeMode) {
      case 'view':
        return (
          <>
            <EnhancedPDFViewer
              documentUrl={documentUrl}
              currentPage={viewerState.currentPage}
              onPageChange={handlePageChange}
              {...commonProps}
            />
            <ComponentSelectionOverlay
              width={800}
              height={600}
              scale={viewerState.viewport.scale}
              components={components}
              selectedComponents={selectedComponentIds}
              onComponentSelect={selectComponent}
              onSelectionClear={clearSelection}
              selectionMode="multiple"
            />
          </>
        );

      case 'annotate':
        return (
          <>
            <EnhancedPDFViewer
              documentUrl={documentUrl}
              currentPage={viewerState.currentPage}
              onPageChange={handlePageChange}
              {...commonProps}
            />
            <AnnotationCanvas
              width={800}
              height={600}
              scale={viewerState.viewport.scale}
              activeTool="select"
              annotationStyle={{
                strokeColor: '#FF0000',
                fillColor: '#FF0000',
                strokeWidth: 2,
                fillOpacity: 0.1,
                fontSize: 14
              }}
              annotations={viewerState.annotations}
              onAnnotationAdd={handleAnnotationAdd}
              onAnnotationUpdate={handleAnnotationUpdate}
              onAnnotationDelete={handleAnnotationDelete}
              measurementUnit="ft"
              onAnnotationSelect={() => {}}
            />
            <AnnotationToolbar
              activeTool="select"
              onToolChange={() => {}}
              annotationStyle={{
                strokeColor: '#FF0000',
                fillColor: '#FF0000',
                strokeWidth: 2,
                fillOpacity: 0.1,
                fontSize: 14
              }}
              onStyleChange={() => {}}
              measurementUnit="ft"
              onMeasurementUnitChange={() => {}}
              onUndo={() => {}}
              onRedo={() => {}}
              onClear={() => {}}
              onSave={() => {}}
              onLoad={() => {}}
              canUndo={false}
              canRedo={false}
              isCollaborative={enableCollaboration}
            />
          </>
        );

      case 'measure':
        return (
          <>
            <EnhancedPDFViewer
              documentUrl={documentUrl}
              currentPage={viewerState.currentPage}
              onPageChange={handlePageChange}
              {...commonProps}
            />
            <MeasurementToolkit
              canvas={canvasRef.current}
              scale={viewerState.viewport.scale}
              offset={{ x: viewerState.viewport.offsetX, y: viewerState.viewport.offsetY }}
              calibration={{ isCalibrated: false, pixelsPerUnit: 1, unit: 'px' }}
              onCalibrationChange={() => {}}
              measurements={viewerState.measurements}
              onMeasurementsChange={(measurements) => 
                setViewerState(prev => ({ ...prev, measurements }))
              }
              activeTool="distance"
              onToolChange={() => {}}
              isVisible={isMeasurementVisible}
              onToggleVisibility={() => setIsMeasurementVisible(!isMeasurementVisible)}
              defaultUnit="ft"
              onUnitChange={() => {}}
            />
          </>
        );

      case 'compare':
        return (
          <DrawingComparisonView
            primaryDrawing={{
              id: documentId,
              name: viewerState.document?.name || 'Primary',
              version: '1.0',
              imageData: null
            }}
            secondaryDrawing={{
              id: documentId + '_v2',
              name: 'Secondary',
              version: '2.0', 
              imageData: null
            }}
            comparisonMode="side-by-side"
            onModeChange={() => {}}
            settings={{
              primaryOpacity: 1,
              secondaryOpacity: 0.5,
              blendMode: 'normal'
            }}
            onSettingsChange={() => {}}
            onDifferenceDetected={() => {}}
          />
        );

      case 'analyze':
        return (
          <CloudDetectionViewer
            documentId={documentId}
            pageNumber={viewerState.currentPage}
            cloudDetectionResults={viewerState.cloudDetectionResults}
            onResultsUpdate={(results) => 
              setViewerState(prev => ({ ...prev, cloudDetectionResults: results }))
            }
            settings={{
              sensitivity: 0.8,
              minSize: 10,
              maxSize: 1000,
              showConfidence: true,
              highlightColor: '#FF0000'
            }}
            onSettingsChange={() => {}}
          />
        );

      default:
        return null;
    }
  }, [
    viewerState,
    documentUrl,
    documentId,
    components,
    selectedComponentIds,
    enableCollaboration,
    isMeasurementVisible,
    handleViewportChange,
    handlePageChange,
    selectComponent,
    clearSelection,
    handleAnnotationAdd,
    handleAnnotationUpdate,
    handleAnnotationDelete
  ]);

  if (viewerState.isLoading) {
    return (
      <div className="pdf-viewer-loading">
        <div className="loading-spinner" />
        <p>Loading document...</p>
      </div>
    );
  }

  if (viewerState.error) {
    return (
      <div className="pdf-viewer-error">
        <h3>Error Loading Document</h3>
        <p>{viewerState.error}</p>
        <button onClick={loadDocument}>Retry</button>
      </div>
    );
  }

  return (
    <div className="pdf-viewer-integration" ref={containerRef}>
      {/* Performance Optimization Layer */}
      {enablePerformanceOptimization && (
        <>
          <CacheManager
            maxCacheSize={100}
            cachePolicy={{
              evictionStrategy: 'lru',
              maxEntrySize: 10 * 1024 * 1024,
              compressionEnabled: true
            }}
            onCacheStatsUpdate={() => {}}
          >
            <MemoryManager
              maxMemoryUsage={500}
              gcConfig={{
                interval: 30000,
                maxAge: 300000,
                maxIdleTime: 60000,
                autoDisposeSuspicious: true
              }}
              onMemoryStatsUpdate={() => {}}
              onMemoryWarning={() => {}}
            >
              <PerformanceMonitor
                isEnabled={true}
                alertThresholds={{
                  fps: 30,
                  memoryUsage: 400,
                  renderTime: 50,
                  responseTime: 100
                }}
                onAlert={() => {}}
                onMetricsUpdate={handlePerformanceUpdate}
              >
                <RenderOptimizer
                  canvas={canvasRef.current}
                  viewport={viewerState.viewport}
                  documentBounds={{ x: 0, y: 0, width: 1000, height: 1000 }}
                  layers={[]}
                  settings={{
                    enableTileRendering: true,
                    enableLOD: true,
                    enableContinuousRendering: false,
                    cullingPadding: 100,
                    tileRefreshInterval: 5000,
                    showPerformanceOverlay: false,
                    showSettingsPanel: false
                  }}
                  onSettingsChange={() => {}}
                  onPerformanceUpdate={handlePerformanceUpdate}
                />
              </PerformanceMonitor>
            </MemoryManager>
          </CacheManager>
        </>
      )}

      {/* Main Viewer Area */}
      <div className="pdf-viewer-main">
        {/* Mode Toolbar */}
        <div className="pdf-viewer-toolbar">
          <div className="mode-buttons">
            <button
              className={viewerState.activeMode === 'view' ? 'active' : ''}
              onClick={() => handleModeChange('view')}
            >
              👁️ View
            </button>
            <button
              className={viewerState.activeMode === 'annotate' ? 'active' : ''}
              onClick={() => handleModeChange('annotate')}
            >
              ✏️ Annotate
            </button>
            <button
              className={viewerState.activeMode === 'measure' ? 'active' : ''}
              onClick={() => handleModeChange('measure')}
            >
              📏 Measure
            </button>
            <button
              className={viewerState.activeMode === 'compare' ? 'active' : ''}
              onClick={() => handleModeChange('compare')}
            >
              ⚖️ Compare
            </button>
            <button
              className={viewerState.activeMode === 'analyze' ? 'active' : ''}
              onClick={() => handleModeChange('analyze')}
            >
              🔍 Analyze
            </button>
          </div>

          <div className="utility-buttons">
            <button onClick={() => setIsSearchVisible(!isSearchVisible)}>
              🔍 Search
            </button>
            <button onClick={() => setIsMinimapVisible(!isMinimapVisible)}>
              🗺️ Minimap
            </button>
            <button onClick={() => setIsBookmarksVisible(!isBookmarksVisible)}>
              🔖 Bookmarks
            </button>
          </div>
        </div>

        {/* Canvas Container */}
        <div className="pdf-viewer-canvas-container">
          <canvas ref={canvasRef} />
          {renderModeContent()}
        </div>
      </div>

      {/* Side Panels */}
      <div className="pdf-viewer-panels">
        {/* Minimap */}
        <MinimapNavigator
          documentImage={canvasRef.current}
          viewport={viewerState.viewport}
          onViewportChange={handleViewportChange}
          documentBounds={{ x: 0, y: 0, width: 1000, height: 1000 }}
          annotations={viewerState.annotations}
          components={components}
          isVisible={isMinimapVisible}
          onToggleVisibility={() => setIsMinimapVisible(!isMinimapVisible)}
          settings={{ showAnnotations: true, showComponents: true, backgroundColor: '#FFFFFF' }}
          onSettingsChange={() => {}}
        />

        {/* Search Interface */}
        <DocumentSearchInterface
          components={components}
          annotations={viewerState.annotations}
          onNavigateToResult={handleSearchResultNavigation}
          onHighlightResults={() => {}}
          onClearHighlights={() => {}}
          isVisible={isSearchVisible}
          onToggleVisibility={() => setIsSearchVisible(!isSearchVisible)}
          documentBounds={{ x: 0, y: 0, width: 1000, height: 1000 }}
        />

        {/* Bookmarks */}
        <NavigationBookmarks
          viewport={viewerState.viewport}
          onViewportChange={handleViewportChange}
          documentBounds={{ x: 0, y: 0, width: 1000, height: 1000 }}
          bookmarks={viewerState.bookmarks}
          onBookmarksChange={(bookmarks) => 
            setViewerState(prev => ({ ...prev, bookmarks }))
          }
          folders={[]}
          onFoldersChange={() => {}}
          isVisible={isBookmarksVisible}
          onToggleVisibility={() => setIsBookmarksVisible(!isBookmarksVisible)}
          currentDocumentId={documentId}
        />
      </div>

      {/* Status Bar */}
      <div className="pdf-viewer-status">
        <div className="document-info">
          <span>Page {viewerState.currentPage} of {viewerState.document?.pageCount}</span>
          <span>Zoom: {(viewerState.viewport.scale * 100).toFixed(0)}%</span>
          <span>Mode: {viewerState.activeMode}</span>
        </div>
        <div className="performance-info">
          <span>FPS: {performanceMetrics.frameRate?.toFixed(1) || 'N/A'}</span>
          <span>Memory: {(performanceMetrics.memoryUsage || 0).toFixed(1)}MB</span>
          <span>Components: {components.length}</span>
          <span>Annotations: {viewerState.annotations.length}</span>
        </div>
      </div>
    </div>
  );
};