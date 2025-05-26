import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Minimize,
  ChevronLeft,
  ChevronRight,
  Grid,
  Layers,
  Search,
  BookmarkPlus,
  Download,
  Settings,
  Ruler,
  Map
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Slider } from '../ui/Slider';
import { Switch } from '../ui/Switch';
import { cn } from '../../lib/utils';

interface PDFViewerProps {
  pdfUrl: string;
  drawingId: string;
  title?: string;
  onPageChange?: (pageNumber: number) => void;
  onZoomChange?: (zoom: number) => void;
  onError?: (error: Error) => void;
  cloudDetectionResults?: any[];
  annotations?: any[];
  className?: string;
}

interface ViewState {
  currentPage: number;
  totalPages: number;
  zoom: number;
  rotation: number;
  fitMode: 'width' | 'page' | 'actual';
  showGrid: boolean;
  showLayers: boolean;
  showMinimap: boolean;
}

interface PDFDocument {
  numPages: number;
  getPage: (pageNum: number) => Promise<PDFPage>;
}

interface PDFPage {
  getViewport: (params: { scale: number; rotation?: number }) => PDFViewport;
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: PDFViewport }) => PDFRenderTask;
  getTextContent: () => Promise<any>;
}

interface PDFViewport {
  width: number;
  height: number;
  transform: number[];
}

interface PDFRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

export const EnhancedPDFViewer: React.FC<PDFViewerProps> = ({
  pdfUrl,
  drawingId,
  title,
  onPageChange,
  onZoomChange,
  onError,
  cloudDetectionResults = [],
  annotations = [],
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [viewState, setViewState] = useState<ViewState>({
    currentPage: 1,
    totalPages: 0,
    zoom: 1.0,
    rotation: 0,
    fitMode: 'width',
    showGrid: false,
    showLayers: true,
    showMinimap: false
  });

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocument | null>(null);
  const [currentRenderTask, setCurrentRenderTask] = useState<PDFRenderTask | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);

  // PDF.js loading and initialization
  useEffect(() => {
    loadPDF();
    return () => {
      // Cleanup render task on unmount
      if (currentRenderTask) {
        currentRenderTask.cancel();
      }
    };
  }, [pdfUrl]);

  // Re-render when view state changes
  useEffect(() => {
    if (pdfDocument && !isRendering) {
      renderCurrentPage();
    }
  }, [viewState.currentPage, viewState.zoom, viewState.rotation, pdfDocument]);

  const loadPDF = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Dynamic import of PDF.js
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set worker path
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

      const loadingTask = pdfjsLib.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;

      setPdfDocument(pdf);
      setViewState(prev => ({
        ...prev,
        totalPages: pdf.numPages
      }));

      setIsLoading(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load PDF');
      setError(error.message);
      onError?.(error);
      setIsLoading(false);
    }
  };

  const renderCurrentPage = async () => {
    if (!pdfDocument || !canvasRef.current || isRendering) return;

    setIsRendering(true);

    try {
      // Cancel previous render task
      if (currentRenderTask) {
        currentRenderTask.cancel();
      }

      const page = await pdfDocument.getPage(viewState.currentPage);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Canvas context not available');
      }

      // Calculate viewport
      const viewport = page.getViewport({ 
        scale: viewState.zoom,
        rotation: viewState.rotation 
      });

      // Set canvas dimensions
      const devicePixelRatio = window.devicePixelRatio || 1;
      canvas.width = viewport.width * devicePixelRatio;
      canvas.height = viewport.height * devicePixelRatio;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      // Scale context for high DPI displays
      context.scale(devicePixelRatio, devicePixelRatio);

      // Clear canvas
      context.clearRect(0, 0, viewport.width, viewport.height);

      // Render page
      const renderTask = page.render({
        canvasContext: context,
        viewport: viewport
      });

      setCurrentRenderTask(renderTask);
      await renderTask.promise;

      // Render overlays (grid, cloud detection, annotations)
      await renderOverlays(context, viewport);

      // Update minimap if enabled
      if (viewState.showMinimap) {
        renderMinimap(page, viewport);
      }

      setCurrentRenderTask(null);
      setIsRendering(false);

    } catch (err) {
      if (err instanceof Error && err.name !== 'RenderingCancelledException') {
        console.error('Error rendering page:', err);
        setError(err.message);
      }
      setIsRendering(false);
    }
  };

  const renderOverlays = async (context: CanvasRenderingContext2D, viewport: PDFViewport) => {
    // Render grid if enabled
    if (viewState.showGrid) {
      renderGrid(context, viewport);
    }

    // Render cloud detection results
    if (cloudDetectionResults.length > 0) {
      renderCloudDetection(context, viewport);
    }

    // Render annotations
    if (annotations.length > 0) {
      renderAnnotations(context, viewport);
    }
  };

  const renderGrid = (context: CanvasRenderingContext2D, viewport: PDFViewport) => {
    const gridSize = 50 * viewState.zoom;
    
    context.save();
    context.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    context.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= viewport.width; x += gridSize) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, viewport.height);
      context.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= viewport.height; y += gridSize) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(viewport.width, y);
      context.stroke();
    }

    context.restore();
  };

  const renderCloudDetection = (context: CanvasRenderingContext2D, viewport: PDFViewport) => {
    context.save();
    
    cloudDetectionResults.forEach(cloud => {
      if (cloud.pageNumber === viewState.currentPage) {
        const { boundingBox, confidence, isManual } = cloud;
        
        // Scale coordinates to current viewport
        const x = boundingBox.x * viewState.zoom;
        const y = boundingBox.y * viewState.zoom;
        const width = boundingBox.width * viewState.zoom;
        const height = boundingBox.height * viewState.zoom;

        // Set style based on cloud type
        if (isManual) {
          context.strokeStyle = 'rgba(16, 185, 129, 0.8)'; // Green for manual
          context.fillStyle = 'rgba(16, 185, 129, 0.1)';
        } else {
          context.strokeStyle = 'rgba(245, 158, 11, 0.8)'; // Amber for auto
          context.fillStyle = 'rgba(245, 158, 11, 0.1)';
        }

        context.lineWidth = 2;

        // Draw cloud overlay
        context.fillRect(x, y, width, height);
        context.strokeRect(x, y, width, height);

        // Draw confidence score for auto-detected clouds
        if (!isManual && confidence !== undefined) {
          context.fillStyle = 'rgba(0, 0, 0, 0.8)';
          context.font = `${12 * viewState.zoom}px Arial`;
          context.fillText(`${Math.round(confidence * 100)}%`, x + 5, y + 15);
        }
      }
    });

    context.restore();
  };

  const renderAnnotations = (context: CanvasRenderingContext2D, viewport: PDFViewport) => {
    context.save();

    annotations.forEach(annotation => {
      if (annotation.pageNumber === viewState.currentPage) {
        // Render based on annotation type
        switch (annotation.type) {
          case 'rectangle':
            renderRectangleAnnotation(context, annotation);
            break;
          case 'text':
            renderTextAnnotation(context, annotation);
            break;
          case 'arrow':
            renderArrowAnnotation(context, annotation);
            break;
          default:
            break;
        }
      }
    });

    context.restore();
  };

  const renderRectangleAnnotation = (context: CanvasRenderingContext2D, annotation: any) => {
    const { x, y, width, height, color, lineWidth } = annotation;
    
    context.strokeStyle = color || 'red';
    context.lineWidth = (lineWidth || 2) * viewState.zoom;
    context.strokeRect(
      x * viewState.zoom,
      y * viewState.zoom,
      width * viewState.zoom,
      height * viewState.zoom
    );
  };

  const renderTextAnnotation = (context: CanvasRenderingContext2D, annotation: any) => {
    const { x, y, text, fontSize, color } = annotation;
    
    context.fillStyle = color || 'red';
    context.font = `${(fontSize || 12) * viewState.zoom}px Arial`;
    context.fillText(text, x * viewState.zoom, y * viewState.zoom);
  };

  const renderArrowAnnotation = (context: CanvasRenderingContext2D, annotation: any) => {
    const { startX, startY, endX, endY, color, lineWidth } = annotation;
    
    context.strokeStyle = color || 'red';
    context.lineWidth = (lineWidth || 2) * viewState.zoom;
    
    // Draw line
    context.beginPath();
    context.moveTo(startX * viewState.zoom, startY * viewState.zoom);
    context.lineTo(endX * viewState.zoom, endY * viewState.zoom);
    context.stroke();
    
    // Draw arrowhead
    const angle = Math.atan2(endY - startY, endX - startX);
    const arrowLength = 15 * viewState.zoom;
    const arrowAngle = Math.PI / 6;
    
    context.beginPath();
    context.moveTo(endX * viewState.zoom, endY * viewState.zoom);
    context.lineTo(
      endX * viewState.zoom - arrowLength * Math.cos(angle - arrowAngle),
      endY * viewState.zoom - arrowLength * Math.sin(angle - arrowAngle)
    );
    context.moveTo(endX * viewState.zoom, endY * viewState.zoom);
    context.lineTo(
      endX * viewState.zoom - arrowLength * Math.cos(angle + arrowAngle),
      endY * viewState.zoom - arrowLength * Math.sin(angle + arrowAngle)
    );
    context.stroke();
  };

  const renderMinimap = async (page: PDFPage, viewport: PDFViewport) => {
    if (!minimapCanvasRef.current) return;

    const minimapCanvas = minimapCanvasRef.current;
    const minimapContext = minimapCanvas.getContext('2d');
    
    if (!minimapContext) return;

    // Minimap scale (smaller version)
    const minimapScale = 0.15;
    const minimapViewport = page.getViewport({ scale: minimapScale });
    
    minimapCanvas.width = minimapViewport.width;
    minimapCanvas.height = minimapViewport.height;
    
    // Render page to minimap
    const minimapRenderTask = page.render({
      canvasContext: minimapContext,
      viewport: minimapViewport
    });
    
    await minimapRenderTask.promise;
    
    // Draw viewport indicator
    const viewportX = 0; // Calculate based on scroll position
    const viewportY = 0;
    const viewportWidth = minimapViewport.width * (1 / viewState.zoom);
    const viewportHeight = minimapViewport.height * (1 / viewState.zoom);
    
    minimapContext.strokeStyle = 'red';
    minimapContext.lineWidth = 2;
    minimapContext.strokeRect(viewportX, viewportY, viewportWidth, viewportHeight);
  };

  // Navigation handlers
  const handlePreviousPage = () => {
    if (viewState.currentPage > 1) {
      const newPage = viewState.currentPage - 1;
      setViewState(prev => ({ ...prev, currentPage: newPage }));
      onPageChange?.(newPage);
    }
  };

  const handleNextPage = () => {
    if (viewState.currentPage < viewState.totalPages) {
      const newPage = viewState.currentPage + 1;
      setViewState(prev => ({ ...prev, currentPage: newPage }));
      onPageChange?.(newPage);
    }
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(viewState.zoom * 1.25, 5.0);
    setViewState(prev => ({ ...prev, zoom: newZoom }));
    onZoomChange?.(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(viewState.zoom / 1.25, 0.1);
    setViewState(prev => ({ ...prev, zoom: newZoom }));
    onZoomChange?.(newZoom);
  };

  const handleFitToWidth = () => {
    // Calculate zoom to fit width
    if (containerRef.current && canvasRef.current) {
      const containerWidth = containerRef.current.clientWidth - 40; // padding
      const canvasWidth = canvasRef.current.width / (window.devicePixelRatio || 1);
      const newZoom = containerWidth / canvasWidth;
      setViewState(prev => ({ ...prev, zoom: newZoom, fitMode: 'width' }));
      onZoomChange?.(newZoom);
    }
  };

  const handleFitToPage = () => {
    // Calculate zoom to fit entire page
    if (containerRef.current && canvasRef.current) {
      const containerWidth = containerRef.current.clientWidth - 40;
      const containerHeight = containerRef.current.clientHeight - 100;
      const canvasWidth = canvasRef.current.width / (window.devicePixelRatio || 1);
      const canvasHeight = canvasRef.current.height / (window.devicePixelRatio || 1);
      
      const scaleX = containerWidth / canvasWidth;
      const scaleY = containerHeight / canvasHeight;
      const newZoom = Math.min(scaleX, scaleY);
      
      setViewState(prev => ({ ...prev, zoom: newZoom, fitMode: 'page' }));
      onZoomChange?.(newZoom);
    }
  };

  const handleActualSize = () => {
    setViewState(prev => ({ ...prev, zoom: 1.0, fitMode: 'actual' }));
    onZoomChange?.(1.0);
  };

  const handleRotate = () => {
    const newRotation = (viewState.rotation + 90) % 360;
    setViewState(prev => ({ ...prev, rotation: newRotation }));
  };

  const handleAddBookmark = () => {
    const bookmark = {
      id: Date.now().toString(),
      page: viewState.currentPage,
      zoom: viewState.zoom,
      name: `Page ${viewState.currentPage}`,
      timestamp: new Date().toISOString()
    };
    setBookmarks(prev => [...prev, bookmark]);
  };

  const handleGoToBookmark = (bookmark: any) => {
    setViewState(prev => ({
      ...prev,
      currentPage: bookmark.page,
      zoom: bookmark.zoom
    }));
    onPageChange?.(bookmark.page);
    onZoomChange?.(bookmark.zoom);
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center h-96', className)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex items-center justify-center h-96', className)}>
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to Load PDF</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadPDF}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full bg-gray-100', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-white border-b shadow-sm">
        <div className="flex items-center space-x-2">
          {/* Navigation */}
          <div className="flex items-center space-x-1 border rounded">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePreviousPage}
              disabled={viewState.currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <div className="px-3 py-1 text-sm">
              <input
                type="number"
                value={viewState.currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value);
                  if (page >= 1 && page <= viewState.totalPages) {
                    setViewState(prev => ({ ...prev, currentPage: page }));
                    onPageChange?.(page);
                  }
                }}
                className="w-12 text-center border-none outline-none"
                min={1}
                max={viewState.totalPages}
              />
              <span className="text-gray-500"> / {viewState.totalPages}</span>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextPage}
              disabled={viewState.currentPage >= viewState.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-1 border rounded">
            <Button variant="ghost" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            
            <div className="px-2 text-sm min-w-[60px] text-center">
              {Math.round(viewState.zoom * 100)}%
            </div>
            
            <Button variant="ghost" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* Fit Controls */}
          <div className="flex items-center space-x-1 border rounded">
            <Button
              variant={viewState.fitMode === 'width' ? 'default' : 'ghost'}
              size="sm"
              onClick={handleFitToWidth}
              title="Fit to Width"
            >
              <Maximize className="h-4 w-4" />
            </Button>
            
            <Button
              variant={viewState.fitMode === 'page' ? 'default' : 'ghost'}
              size="sm"
              onClick={handleFitToPage}
              title="Fit to Page"
            >
              <Minimize className="h-4 w-4" />
            </Button>
            
            <Button
              variant={viewState.fitMode === 'actual' ? 'default' : 'ghost'}
              size="sm"
              onClick={handleActualSize}
              title="Actual Size"
            >
              100%
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={handleRotate} title="Rotate">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          {title && <h3 className="text-sm font-medium text-gray-700">{title}</h3>}
          
          <Badge variant="outline">
            Drawing ID: {drawingId}
          </Badge>
        </div>

        <div className="flex items-center space-x-1">
          <Button
            variant={viewState.showGrid ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewState(prev => ({ ...prev, showGrid: !prev.showGrid }))}
            title="Toggle Grid"
          >
            <Grid className="h-4 w-4" />
          </Button>

          <Button
            variant={viewState.showLayers ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewState(prev => ({ ...prev, showLayers: !prev.showLayers }))}
            title="Toggle Layers"
          >
            <Layers className="h-4 w-4" />
          </Button>

          <Button
            variant={viewState.showMinimap ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewState(prev => ({ ...prev, showMinimap: !prev.showMinimap }))}
            title="Toggle Minimap"
          >
            <Map className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="sm" onClick={handleAddBookmark} title="Add Bookmark">
            <BookmarkPlus className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="sm" title="Measurement Tool">
            <Ruler className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="sm" title="Search">
            <Search className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="sm" title="Settings">
            <Settings className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="sm" title="Download">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Viewer Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* PDF Canvas Container */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto bg-gray-200 p-4"
        >
          <div className="flex justify-center">
            <div className="relative bg-white shadow-lg">
              <canvas
                ref={canvasRef}
                className="block"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
              
              {isRendering && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Minimap */}
        {viewState.showMinimap && (
          <div className="w-64 bg-white border-l p-4">
            <h4 className="text-sm font-medium mb-2">Overview</h4>
            <div className="border rounded">
              <canvas
                ref={minimapCanvasRef}
                className="block w-full h-auto"
                style={{ maxWidth: '100%' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t text-xs text-gray-600">
        <div className="flex items-center space-x-4">
          <span>Page {viewState.currentPage} of {viewState.totalPages}</span>
          <span>Zoom: {Math.round(viewState.zoom * 100)}%</span>
          {cloudDetectionResults.length > 0 && (
            <span>{cloudDetectionResults.filter(c => c.pageNumber === viewState.currentPage).length} clouds detected</span>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <span>Drawing: {drawingId}</span>
          {bookmarks.length > 0 && (
            <span>{bookmarks.length} bookmarks</span>
          )}
        </div>
      </div>
    </div>
  );
};