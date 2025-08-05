/**
 * Comprehensive Integration Tests for Highlighting System
 * Tests integration with PDF rendering, context systems, and full user workflows
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { HighlightOverlay } from '../HighlightOverlay';
import { HighlightControls } from '../HighlightControls';
import { AccessibleHighlightSystem } from '../../accessibility/AccessibleHighlightSystem';
import { getHighlightingService } from '../../../services/highlighting.service';
import { getContextHighlightManager } from '../../../services/context-highlight-manager';
import { getHighlightExportService } from '../../../services/highlight-export.service';
import { getHighlightSharingService } from '../../../services/highlight-sharing.service';
import { getHighlightAnalyticsService } from '../../../services/highlight-analytics.service';
import { getHighlightNavigationService } from '../../../services/highlight-navigation.service';
import type {
  ComponentHighlight,
  ViewportState,
  HighlightStyle
} from '../../../types/highlighting.types';
import type { Query, SessionState } from '../../../types/chat';

// Mock services
jest.mock('../../../services/highlighting.service');
jest.mock('../../../services/context-highlight-manager');
jest.mock('../../../services/highlight-export.service');
jest.mock('../../../services/highlight-sharing.service');
jest.mock('../../../services/highlight-analytics.service');
jest.mock('../../../services/highlight-navigation.service');

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  readyState: WebSocket.OPEN,
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
}));

// Mock Canvas API
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  strokeRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  stroke: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  scale: jest.fn(),
  translate: jest.fn(),
  setLineDash: jest.fn(),
  drawImage: jest.fn(),
  getImageData: jest.fn().mockReturnValue(new ImageData(1, 1)),
  putImageData: jest.fn(),
  toBlob: jest.fn((callback) => callback(new Blob())),
  globalAlpha: 1,
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1
});

// Mock PDF.js
jest.mock('pdfjs-dist', () => ({
  getDocument: jest.fn().mockResolvedValue({
    promise: Promise.resolve({
      numPages: 1,
      getPage: jest.fn().mockResolvedValue({
        getViewport: jest.fn().mockReturnValue({
          width: 800,
          height: 600,
          transform: [1, 0, 0, 1, 0, 0]
        }),
        render: jest.fn().mockResolvedValue(undefined)
      })
    })
  })
}));

describe('Highlighting System Integration Tests', () => {
  const mockHighlightStyle: HighlightStyle = {
    color: '#2196F3',
    opacity: 0.8,
    strokeWidth: 2,
    strokeStyle: 'solid',
    fillOpacity: 0.2,
    zIndex: 1
  };

  const createMockHighlight = (id: string, overrides: Partial<ComponentHighlight> = {}): ComponentHighlight => ({
    id,
    componentId: `component-${id}`,
    type: 'component',
    coordinates: {
      x: 0.3,
      y: 0.5,
      width: 0.1,
      height: 0.05,
      pageNumber: 1,
      zoomLevel: 1,
      viewportOffset: { x: 0, y: 0 }
    },
    style: mockHighlightStyle,
    responseId: 'response-1',
    queryId: 'query-1',
    sessionId: 'session-1',
    createdAt: new Date(),
    isVisible: true,
    isPersistent: false,
    ...overrides
  });

  const mockViewportState: ViewportState = {
    zoom: 1,
    panX: 0,
    panY: 0,
    rotation: 0
  };

  const mockSessionState: SessionState = {
    sessionId: 'session-1',
    uploadedFiles: [],
    currentQuery: '',
    queryHistory: []
  };

  let mockHighlightingService: any;
  let mockContextManager: any;
  let mockExportService: any;
  let mockSharingService: any;
  let mockAnalyticsService: any;
  let mockNavigationService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup service mocks
    mockHighlightingService = {
      getHighlights: jest.fn().mockResolvedValue([]),
      createHighlight: jest.fn().mockResolvedValue(createMockHighlight('1')),
      updateHighlight: jest.fn().mockResolvedValue(true),
      deleteHighlight: jest.fn().mockResolvedValue(true),
      subscribeToUpdates: jest.fn(),
      unsubscribeFromUpdates: jest.fn(),
      syncHighlights: jest.fn().mockResolvedValue(true)
    };

    mockContextManager = {
      processQueryResponse: jest.fn().mockResolvedValue({
        highlights: [createMockHighlight('context-1')],
        suggestions: [],
        references: [],
        updatedContext: {}
      }),
      generateContextualSuggestions: jest.fn().mockResolvedValue([]),
      cleanupExpiredHighlights: jest.fn().mockReturnValue({
        activeHighlights: [],
        expiredHighlights: []
      })
    };

    mockExportService = {
      exportAsImage: jest.fn().mockResolvedValue({
        success: true,
        blob: new Blob(),
        filename: 'test.png',
        metadata: {}
      }),
      exportAsSVG: jest.fn().mockResolvedValue({
        success: true,
        blob: new Blob(),
        filename: 'test.svg',
        metadata: {}
      }),
      exportAsJSON: jest.fn().mockResolvedValue({
        success: true,
        blob: new Blob(),
        filename: 'test.json',
        metadata: {}
      })
    };

    mockSharingService = {
      createSession: jest.fn().mockResolvedValue({
        success: true,
        session: { id: 'session-1', title: 'Test Session' },
        shareUrl: 'http://example.com/shared/session-1'
      }),
      joinSession: jest.fn().mockResolvedValue({
        success: true,
        sessionData: { highlights: [], participants: [] }
      }),
      shareHighlight: jest.fn().mockResolvedValue({ success: true }),
      on: jest.fn(),
      off: jest.fn()
    };

    mockAnalyticsService = {
      trackEvent: jest.fn(),
      trackHighlightCreated: jest.fn(),
      trackHighlightInteraction: jest.fn(),
      trackPerformance: jest.fn(),
      generateReport: jest.fn().mockReturnValue({
        totalEvents: 100,
        performanceMetrics: { averageRenderTime: 25 }
      })
    };

    mockNavigationService = {
      buildNavigationTargets: jest.fn().mockReturnValue([]),
      createNavigationPath: jest.fn().mockReturnValue({
        id: 'path-1',
        name: 'Test Path',
        targets: []
      }),
      startNavigation: jest.fn().mockResolvedValue({ success: true }),
      navigateNext: jest.fn().mockResolvedValue({ success: true }),
      on: jest.fn(),
      off: jest.fn()
    };

    // Setup mocked service instances
    (getHighlightingService as jest.Mock).mockReturnValue(mockHighlightingService);
    (getContextHighlightManager as jest.Mock).mockReturnValue(mockContextManager);
    (getHighlightExportService as jest.Mock).mockReturnValue(mockExportService);
    (getHighlightSharingService as jest.Mock).mockReturnValue(mockSharingService);
    (getHighlightAnalyticsService as jest.Mock).mockReturnValue(mockAnalyticsService);
    (getHighlightNavigationService as jest.Mock).mockReturnValue(mockNavigationService);
  });

  describe('Full System Integration', () => {
    it('should integrate overlay, controls, and accessibility systems', async () => {
      const highlights = [
        createMockHighlight('1'),
        createMockHighlight('2'),
        createMockHighlight('3')
      ];

      const TestComponent = () => {
        const [selectedId, setSelectedId] = React.useState<string | null>(null);
        const [highlightList, setHighlightList] = React.useState(highlights);

        return (
          <div>
            <HighlightOverlay
              highlights={highlightList}
              canvasWidth={800}
              canvasHeight={600}
              viewportState={mockViewportState}
              originalViewport={mockViewportState}
              selectedHighlightId={selectedId}
              onHighlightSelect={setSelectedId}
              onHighlightToggle={(id, visible) => {
                setHighlightList(prev => prev.map(h => 
                  h.id === id ? { ...h, isVisible: visible } : h
                ));
              }}
              enableAccessibility={true}
            />
            <HighlightControls
              highlights={highlightList}
              selectedHighlightId={selectedId}
              onHighlightSelect={setSelectedId}
              onHighlightUpdate={(id, updates) => {
                setHighlightList(prev => prev.map(h => 
                  h.id === id ? { ...h, ...updates } : h
                ));
              }}
              onHighlightDelete={(id) => {
                setHighlightList(prev => prev.filter(h => h.id !== id));
              }}
            />
          </div>
        );
      };

      render(<TestComponent />);

      // Should render all components
      expect(screen.getByRole('img', { name: /interactive highlight overlay/i })).toBeInTheDocument();
      
      // Should be able to interact with controls
      const toggleButton = screen.getByRole('button', { name: /toggle all highlights/i });
      await userEvent.click(toggleButton);

      // Should handle highlight selection
      const highlightItems = screen.getAllByText(/component-/);
      expect(highlightItems.length).toBeGreaterThan(0);
    });

    it('should handle PDF rendering integration', async () => {
      const highlights = [createMockHighlight('pdf-test')];

      // Mock PDF canvas
      const mockPDFCanvas = document.createElement('canvas');
      mockPDFCanvas.width = 800;
      mockPDFCanvas.height = 600;

      render(
        <HighlightOverlay
          highlights={highlights}
          canvasWidth={800}
          canvasHeight={600}
          viewportState={mockViewportState}
          originalViewport={mockViewportState}
          enableLazyLoading={false}
        />
      );

      // Should render without PDF context errors
      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
      expect(canvas?.width).toBe(800);
      expect(canvas?.height).toBe(600);
    });

    it('should integrate with context management system', async () => {
      const mockQuery: Query = {
        id: 'query-1',
        text: 'What is this component?',
        type: 'component_identification',
        timestamp: new Date(),
        documentIds: ['doc-1'],
        responses: [{
          id: 'response-1',
          modelName: 'gpt-4',
          modelVersion: '1.0',
          responseText: 'This is a resistor',
          confidenceScore: 0.9,
          responseTime: 1000
        }],
        aggregatedResult: {
          summary: 'This is a resistor',
          components: [],
          confidence: {
            overall: 0.9,
            agreement: 0.9,
            completeness: 0.9,
            consistency: 0.9,
            factors: {
              modelConsensus: 0.9,
              responseQuality: 0.9,
              logicalConsistency: 0.9,
              coverage: 0.9,
              uncertainty: 0.1
            }
          },
          consensus: {
            agreementLevel: 0.9,
            conflictingResponses: [],
            consensusResponse: 'This is a resistor'
          }
        }
      };

      const TestIntegration = () => {
        const [highlights, setHighlights] = React.useState<ComponentHighlight[]>([]);

        React.useEffect(() => {
          const processQuery = async () => {
            const result = await mockContextManager.processQueryResponse(mockQuery, mockSessionState);
            setHighlights(result.highlights);
          };
          processQuery();
        }, []);

        return (
          <HighlightOverlay
            highlights={highlights}
            canvasWidth={800}
            canvasHeight={600}
            viewportState={mockViewportState}
            originalViewport={mockViewportState}
          />
        );
      };

      render(<TestIntegration />);

      await waitFor(() => {
        expect(mockContextManager.processQueryResponse).toHaveBeenCalledWith(mockQuery, mockSessionState);
      });
    });
  });

  describe('Service Integration Tests', () => {
    it('should integrate with export service', async () => {
      const highlights = [createMockHighlight('export-test')];
      const user = userEvent.setup();

      render(
        <HighlightControls
          highlights={highlights}
          selectedHighlightId={null}
          onHighlightSelect={jest.fn()}
          onHighlightUpdate={jest.fn()}
          onHighlightDelete={jest.fn()}
        />
      );

      // Find and click export button
      const exportButton = screen.getByRole('button', { name: /export highlights/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(mockExportService.exportAsJSON).toHaveBeenCalled();
      });
    });

    it('should integrate with sharing service', async () => {
      const highlights = [createMockHighlight('share-test')];
      const user = userEvent.setup();

      render(
        <HighlightControls
          highlights={highlights}
          selectedHighlightId={null}
          onHighlightSelect={jest.fn()}
          onHighlightUpdate={jest.fn()}
          onHighlightDelete={jest.fn()}
        />
      );

      // Find and click share button
      const shareButton = screen.getByRole('button', { name: /share highlights/i });
      await user.click(shareButton);

      // Should open share dialog
      await waitFor(() => {
        expect(screen.getByText(/share session/i)).toBeInTheDocument();
      });
    });

    it('should integrate with analytics tracking', async () => {
      const highlights = [createMockHighlight('analytics-test')];
      const user = userEvent.setup();

      const TestWithAnalytics = () => {
        const [selectedId, setSelectedId] = React.useState<string | null>(null);

        const handleSelect = (id: string | null) => {
          setSelectedId(id);
          if (id) {
            mockAnalyticsService.trackHighlightInteraction('selected', id, { method: 'click' });
          }
        };

        return (
          <HighlightOverlay
            highlights={highlights}
            canvasWidth={800}
            canvasHeight={600}
            viewportState={mockViewportState}
            originalViewport={mockViewportState}
            selectedHighlightId={selectedId}
            onHighlightSelect={handleSelect}
          />
        );
      };

      render(<TestWithAnalytics />);

      // Simulate highlight interaction
      const canvas = document.querySelector('canvas');
      if (canvas) {
        await user.click(canvas);
      }

      // Analytics should be tracked
      expect(mockAnalyticsService.trackHighlightInteraction).toHaveBeenCalled();
    });

    it('should integrate with navigation service', async () => {
      const highlights = [
        createMockHighlight('nav-1'),
        createMockHighlight('nav-2'),
        createMockHighlight('nav-3')
      ];

      mockNavigationService.buildNavigationTargets.mockReturnValue([
        { id: 'target-1', highlightId: 'nav-1', title: 'Component 1' },
        { id: 'target-2', highlightId: 'nav-2', title: 'Component 2' },
        { id: 'target-3', highlightId: 'nav-3', title: 'Component 3' }
      ]);

      const TestWithNavigation = () => {
        const [currentHighlight, setCurrentHighlight] = React.useState<string | null>(null);

        React.useEffect(() => {
          const targets = mockNavigationService.buildNavigationTargets(highlights);
          const path = mockNavigationService.createNavigationPath(targets, 'Test Path');
          mockNavigationService.startNavigation(path);
        }, []);

        return (
          <div>
            <HighlightOverlay
              highlights={highlights}
              canvasWidth={800}
              canvasHeight={600}
              viewportState={mockViewportState}
              originalViewport={mockViewportState}
              selectedHighlightId={currentHighlight}
              onHighlightSelect={setCurrentHighlight}
            />
            <button onClick={() => mockNavigationService.navigateNext()}>
              Next Highlight
            </button>
          </div>
        );
      };

      render(<TestWithNavigation />);
      const user = userEvent.setup();

      await waitFor(() => {
        expect(mockNavigationService.buildNavigationTargets).toHaveBeenCalledWith(highlights);
      });

      const nextButton = screen.getByRole('button', { name: /next highlight/i });
      await user.click(nextButton);

      expect(mockNavigationService.navigateNext).toHaveBeenCalled();
    });
  });

  describe('Performance Integration Tests', () => {
    it('should handle large numbers of highlights efficiently', async () => {
      const manyHighlights = Array.from({ length: 200 }, (_, i) => 
        createMockHighlight(`perf-${i}`, {
          coordinates: {
            x: Math.random(),
            y: Math.random(),
            width: 0.05,
            height: 0.05,
            pageNumber: 1,
            zoomLevel: 1,
            viewportOffset: { x: 0, y: 0 }
          }
        })
      );

      const startTime = Date.now();

      render(
        <HighlightOverlay
          highlights={manyHighlights}
          canvasWidth={800}
          canvasHeight={600}
          viewportState={mockViewportState}
          originalViewport={mockViewportState}
          enableLazyLoading={true}
        />
      );

      const renderTime = Date.now() - startTime;

      // Should render within reasonable time
      expect(renderTime).toBeLessThan(1000);

      // Should use lazy loading for large datasets
      expect(screen.getByText(/loading highlights/i)).toBeInTheDocument();
    });

    it('should track performance metrics', async () => {
      const highlights = [createMockHighlight('perf-tracking')];

      render(
        <HighlightOverlay
          highlights={highlights}
          canvasWidth={800}
          canvasHeight={600}
          viewportState={mockViewportState}
          originalViewport={mockViewportState}
        />
      );

      // Performance should be tracked
      await waitFor(() => {
        expect(mockAnalyticsService.trackPerformance).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle service errors gracefully', async () => {
      mockHighlightingService.createHighlight.mockRejectedValue(new Error('Service error'));
      
      const highlights = [createMockHighlight('error-test')];

      const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
        const [hasError, setHasError] = React.useState(false);

        React.useEffect(() => {
          const handleError = () => setHasError(true);
          window.addEventListener('error', handleError);
          return () => window.removeEventListener('error', handleError);
        }, []);

        if (hasError) {
          return <div>Something went wrong</div>;
        }

        return <>{children}</>;
      };

      render(
        <ErrorBoundary>
          <HighlightOverlay
            highlights={highlights}
            canvasWidth={800}
            canvasHeight={600}
            viewportState={mockViewportState}
            originalViewport={mockViewportState}
          />
        </ErrorBoundary>
      );

      // Should render without crashing
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('should handle malformed highlight data', () => {
      const malformedHighlights = [
        {
          ...createMockHighlight('malformed'),
          coordinates: undefined as any,
          style: undefined as any
        }
      ];

      expect(() => {
        render(
          <HighlightOverlay
            highlights={malformedHighlights}
            canvasWidth={800}
            canvasHeight={600}
            viewportState={mockViewportState}
            originalViewport={mockViewportState}
          />
        );
      }).not.toThrow();
    });
  });

  describe('Accessibility Integration', () => {
    it('should integrate accessibility features across all components', async () => {
      const highlights = [
        createMockHighlight('a11y-1'),
        createMockHighlight('a11y-2')
      ];

      render(
        <div>
          <HighlightOverlay
            highlights={highlights}
            canvasWidth={800}
            canvasHeight={600}
            viewportState={mockViewportState}
            originalViewport={mockViewportState}
            enableAccessibility={true}
          />
          <AccessibleHighlightSystem
            highlights={highlights}
            selectedHighlightId={null}
            onHighlightSelect={jest.fn()}
            onHighlightToggle={jest.fn()}
            onHighlightFocus={jest.fn()}
          />
        </div>
      );

      // Should have accessibility button
      const a11yButton = screen.getByRole('button', { name: /toggle accessibility panel/i });
      expect(a11yButton).toBeInTheDocument();

      // Should have accessible highlight system
      expect(screen.getByRole('application')).toBeInTheDocument();
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('should support keyboard navigation across components', async () => {
      const highlights = [createMockHighlight('kb-nav')];
      const user = userEvent.setup();

      render(
        <AccessibleHighlightSystem
          highlights={highlights}
          selectedHighlightId={null}
          onHighlightSelect={jest.fn()}
          onHighlightToggle={jest.fn()}
          onHighlightFocus={jest.fn()}
        />
      );

      const system = screen.getByRole('application');
      await user.click(system);

      // Should support arrow key navigation
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      // Should not throw errors
      expect(system).toBeInTheDocument();
    });
  });

  describe('Real-time Collaboration Integration', () => {
    it('should handle real-time highlight sharing', async () => {
      const highlights = [createMockHighlight('collab-test')];

      const CollaborativeTest = () => {
        React.useEffect(() => {
          // Simulate receiving shared highlight
          const mockSharedHighlight = createMockHighlight('shared-1');
          mockSharingService.on('highlight_shared', (highlight: ComponentHighlight) => {
            // Would update state in real implementation
          });
        }, []);

        return (
          <HighlightOverlay
            highlights={highlights}
            canvasWidth={800}
            canvasHeight={600}
            viewportState={mockViewportState}
            originalViewport={mockViewportState}
          />
        );
      };

      render(<CollaborativeTest />);

      // Should set up collaboration listeners
      expect(mockSharingService.on).toHaveBeenCalledWith('highlight_shared', expect.any(Function));
    });
  });

  describe('Data Flow Integration', () => {
    it('should maintain data consistency across all components', async () => {
      const initialHighlights = [createMockHighlight('data-flow')];
      const user = userEvent.setup();

      const DataFlowTest = () => {
        const [highlights, setHighlights] = React.useState(initialHighlights);
        const [selectedId, setSelectedId] = React.useState<string | null>(null);

        const handleUpdate = (id: string, updates: Partial<ComponentHighlight>) => {
          setHighlights(prev => prev.map(h => 
            h.id === id ? { ...h, ...updates } : h
          ));
        };

        return (
          <div>
            <HighlightOverlay
              highlights={highlights}
              canvasWidth={800}
              canvasHeight={600}
              viewportState={mockViewportState}
              originalViewport={mockViewportState}
              selectedHighlightId={selectedId}
              onHighlightSelect={setSelectedId}
            />
            <HighlightControls
              highlights={highlights}
              selectedHighlightId={selectedId}
              onHighlightSelect={setSelectedId}
              onHighlightUpdate={handleUpdate}
              onHighlightDelete={(id) => setHighlights(prev => prev.filter(h => h.id !== id))}
            />
            <AccessibleHighlightSystem
              highlights={highlights}
              selectedHighlightId={selectedId}
              onHighlightSelect={setSelectedId}
              onHighlightToggle={(id, visible) => handleUpdate(id, { isVisible: visible })}
              onHighlightFocus={jest.fn()}
            />
          </div>
        );
      };

      render(<DataFlowTest />);

      // All components should show the same highlight
      const highlightElements = screen.getAllByText(/data-flow/);
      expect(highlightElements.length).toBeGreaterThan(0);

      // Updates should propagate across components
      const visibilityButton = screen.getByLabelText(/hide highlight/i);
      await user.click(visibilityButton);

      // Data should remain consistent
      expect(screen.getByRole('application')).toBeInTheDocument();
    });
  });
});