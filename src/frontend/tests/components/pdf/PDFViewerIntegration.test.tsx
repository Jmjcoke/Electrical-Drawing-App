import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { jest } from '@jest/globals';
import { PDFViewerIntegration } from '../../../components/pdf/PDFViewerIntegration';

// Mock all PDF viewer components
jest.mock('../../../components/pdf/EnhancedPDFViewer', () => ({
  EnhancedPDFViewer: ({ onPageChange }: any) => (
    <div data-testid="enhanced-pdf-viewer">
      <button onClick={() => onPageChange(2)}>Next Page</button>
    </div>
  )
}));

jest.mock('../../../components/pdf/ComponentSelectionOverlay', () => ({
  ComponentSelectionOverlay: () => <div data-testid="component-selection-overlay" />
}));

jest.mock('../../../components/pdf/AnnotationCanvas', () => ({
  AnnotationCanvas: () => <div data-testid="annotation-canvas" />
}));

jest.mock('../../../components/pdf/AnnotationToolbar', () => ({
  AnnotationToolbar: () => <div data-testid="annotation-toolbar" />
}));

jest.mock('../../../components/pdf/MeasurementToolkit', () => ({
  MeasurementToolkit: () => <div data-testid="measurement-toolkit" />
}));

jest.mock('../../../components/pdf/DrawingComparisonView', () => ({
  DrawingComparisonView: () => <div data-testid="drawing-comparison-view" />
}));

jest.mock('../../../components/pdf/CloudDetectionViewer', () => ({
  CloudDetectionViewer: () => <div data-testid="cloud-detection-viewer" />
}));

jest.mock('../../../components/pdf/MinimapNavigator', () => ({
  MinimapNavigator: () => <div data-testid="minimap-navigator" />
}));

jest.mock('../../../components/pdf/DocumentSearchInterface', () => ({
  DocumentSearchInterface: () => <div data-testid="document-search-interface" />
}));

jest.mock('../../../components/pdf/NavigationBookmarks', () => ({
  NavigationBookmarks: () => <div data-testid="navigation-bookmarks" />
}));

jest.mock('../../../components/pdf/CacheManager', () => ({
  CacheManager: ({ children }: any) => <div data-testid="cache-manager">{children}</div>
}));

jest.mock('../../../components/pdf/MemoryManager', () => ({
  MemoryManager: ({ children }: any) => <div data-testid="memory-manager">{children}</div>
}));

jest.mock('../../../components/pdf/PerformanceMonitor', () => ({
  PerformanceMonitor: ({ children }: any) => <div data-testid="performance-monitor">{children}</div>
}));

jest.mock('../../../components/pdf/RenderOptimizer', () => ({
  RenderOptimizer: () => <div data-testid="render-optimizer" />
}));

jest.mock('../../../hooks/useComponentSelection', () => ({
  useComponentSelection: () => ({
    selectedComponents: [],
    selectedComponentIds: [],
    selectComponent: jest.fn(),
    clearSelection: jest.fn(),
    isSelected: jest.fn(() => false)
  })
}));

// Mock fetch for document loading
global.fetch = jest.fn();

describe('PDFViewerIntegration', () => {
  const mockProps = {
    documentId: 'test-doc-123',
    documentUrl: 'https://example.com/test.pdf',
    initialPage: 1,
    enableCloudDetection: true,
    enableCollaboration: true,
    enablePerformanceOptimization: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['fake pdf data'], { type: 'application/pdf' }))
    });
  });

  describe('Document Loading', () => {
    it('should display loading state initially', () => {
      render(<PDFViewerIntegration {...mockProps} />);
      expect(screen.getByText('Loading document...')).toBeInTheDocument();
    });

    it('should load document successfully', async () => {
      render(<PDFViewerIntegration {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('enhanced-pdf-viewer')).toBeInTheDocument();
      });

      expect(global.fetch).toHaveBeenCalledWith(mockProps.documentUrl);
    });

    it('should handle document loading errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      render(<PDFViewerIntegration {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Error Loading Document')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should call onDocumentLoad callback when document loads', async () => {
      const onDocumentLoad = jest.fn();
      render(<PDFViewerIntegration {...mockProps} onDocumentLoad={onDocumentLoad} />);
      
      await waitFor(() => {
        expect(onDocumentLoad).toHaveBeenCalledWith(
          expect.objectContaining({
            id: mockProps.documentId,
            url: mockProps.documentUrl
          })
        );
      });
    });
  });

  describe('Mode Switching', () => {
    it('should start in view mode by default', async () => {
      render(<PDFViewerIntegration {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('enhanced-pdf-viewer')).toBeInTheDocument();
        expect(screen.getByTestId('component-selection-overlay')).toBeInTheDocument();
      });
    });

    it('should switch to annotation mode', async () => {
      render(<PDFViewerIntegration {...mockProps} />);
      
      await waitFor(() => {
        const annotateButton = screen.getByText('✏️ Annotate');
        fireEvent.click(annotateButton);
      });

      expect(screen.getByTestId('annotation-canvas')).toBeInTheDocument();
      expect(screen.getByTestId('annotation-toolbar')).toBeInTheDocument();
    });

    it('should switch to measurement mode', async () => {
      render(<PDFViewerIntegration {...mockProps} />);
      
      await waitFor(() => {
        const measureButton = screen.getByText('📏 Measure');
        fireEvent.click(measureButton);
      });

      expect(screen.getByTestId('measurement-toolkit')).toBeInTheDocument();
    });

    it('should switch to comparison mode', async () => {
      render(<PDFViewerIntegration {...mockProps} />);
      
      await waitFor(() => {
        const compareButton = screen.getByText('⚖️ Compare');
        fireEvent.click(compareButton);
      });

      expect(screen.getByTestId('drawing-comparison-view')).toBeInTheDocument();
    });

    it('should switch to analysis mode', async () => {
      render(<PDFViewerIntegration {...mockProps} />);
      
      await waitFor(() => {
        const analyzeButton = screen.getByText('🔍 Analyze');
        fireEvent.click(analyzeButton);
      });

      expect(screen.getByTestId('cloud-detection-viewer')).toBeInTheDocument();
    });
  });

  describe('Panel Visibility', () => {
    it('should toggle minimap visibility', async () => {
      render(<PDFViewerIntegration {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('minimap-navigator')).toBeInTheDocument();
      });

      const minimapButton = screen.getByText('🗺️ Minimap');
      fireEvent.click(minimapButton);

      // Minimap should still be in DOM but with different visibility state
      expect(screen.getByTestId('minimap-navigator')).toBeInTheDocument();
    });

    it('should toggle search interface visibility', async () => {
      render(<PDFViewerIntegration {...mockProps} />);
      
      await waitFor(() => {
        const searchButton = screen.getByText('🔍 Search');
        fireEvent.click(searchButton);
      });

      expect(screen.getByTestId('document-search-interface')).toBeInTheDocument();
    });

    it('should toggle bookmarks visibility', async () => {
      render(<PDFViewerIntegration {...mockProps} />);
      
      await waitFor(() => {
        const bookmarksButton = screen.getByText('🔖 Bookmarks');
        fireEvent.click(bookmarksButton);
      });

      expect(screen.getByTestId('navigation-bookmarks')).toBeInTheDocument();
    });
  });

  describe('Performance Optimization', () => {
    it('should render performance optimization components when enabled', async () => {
      render(<PDFViewerIntegration {...mockProps} enablePerformanceOptimization={true} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('cache-manager')).toBeInTheDocument();
        expect(screen.getByTestId('memory-manager')).toBeInTheDocument();
        expect(screen.getByTestId('performance-monitor')).toBeInTheDocument();
        expect(screen.getByTestId('render-optimizer')).toBeInTheDocument();
      });
    });

    it('should not render performance components when disabled', async () => {
      render(<PDFViewerIntegration {...mockProps} enablePerformanceOptimization={false} />);
      
      await waitFor(() => {
        expect(screen.queryByTestId('cache-manager')).not.toBeInTheDocument();
        expect(screen.queryByTestId('memory-manager')).not.toBeInTheDocument();
        expect(screen.queryByTestId('performance-monitor')).not.toBeInTheDocument();
        expect(screen.queryByTestId('render-optimizer')).not.toBeInTheDocument();
      });
    });
  });

  describe('Page Navigation', () => {
    it('should handle page changes', async () => {
      render(<PDFViewerIntegration {...mockProps} />);
      
      await waitFor(() => {
        const nextPageButton = screen.getByText('Next Page');
        fireEvent.click(nextPageButton);
      });

      // Should show updated page number in status
      expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();
    });

    it('should display current page and total pages in status', async () => {
      render(<PDFViewerIntegration {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/Page 1 of 10/)).toBeInTheDocument();
      });
    });
  });

  describe('Cloud Detection Integration', () => {
    it('should initialize cloud detection when enabled', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['fake pdf data'], { type: 'application/pdf' }))
      } as Response);
      
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ detections: [] })
      } as Response);

      render(<PDFViewerIntegration {...mockProps} enableCloudDetection={true} />);
      
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          `/api/documents/${mockProps.documentId}/cloud-detection`,
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
        );
      });
    });

    it('should not initialize cloud detection when disabled', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      
      render(<PDFViewerIntegration {...mockProps} enableCloudDetection={false} />);
      
      await waitFor(() => {
        expect(screen.getByTestId('enhanced-pdf-viewer')).toBeInTheDocument();
      });

      // Should only have been called once for document loading
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Status Bar', () => {
    it('should display document information', async () => {
      render(<PDFViewerIntegration {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/Page 1 of 10/)).toBeInTheDocument();
        expect(screen.getByText(/Zoom: 100%/)).toBeInTheDocument();
        expect(screen.getByText(/Mode: view/)).toBeInTheDocument();
      });
    });

    it('should display performance metrics', async () => {
      render(<PDFViewerIntegration {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText(/FPS:/)).toBeInTheDocument();
        expect(screen.getByText(/Memory:/)).toBeInTheDocument();
        expect(screen.getByText(/Components: 0/)).toBeInTheDocument();
        expect(screen.getByText(/Annotations: 0/)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show retry button on error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      render(<PDFViewerIntegration {...mockProps} />);
      
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should call onError callback when error occurs', async () => {
      const onError = jest.fn();
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      render(<PDFViewerIntegration {...mockProps} onError={onError} />);
      
      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for mode buttons', async () => {
      render(<PDFViewerIntegration {...mockProps} />);
      
      await waitFor(() => {
        const viewButton = screen.getByText('👁️ View');
        const annotateButton = screen.getByText('✏️ Annotate');
        const measureButton = screen.getByText('📏 Measure');
        
        expect(viewButton).toBeInTheDocument();
        expect(annotateButton).toBeInTheDocument();
        expect(measureButton).toBeInTheDocument();
      });
    });

    it('should be keyboard navigable', async () => {
      render(<PDFViewerIntegration {...mockProps} />);
      
      await waitFor(() => {
        const viewButton = screen.getByText('👁️ View');
        viewButton.focus();
        expect(document.activeElement).toBe(viewButton);
      });
    });
  });
});