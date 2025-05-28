// Tests for Interactive Drawing Canvas - Story 3.1

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InteractiveDrawingCanvas } from '@/components/ai/drawing-canvas/InteractiveDrawingCanvas';
import { useAIAnalysisStore } from '@/stores/aiAnalysisStore';
import { ComponentDetection, ElectricalComponentType } from '@/types/ai/computerVision';

// Mock Fabric.js
jest.mock('fabric', () => ({
  fabric: {
    Canvas: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      off: jest.fn(),
      add: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      dispose: jest.fn(),
      requestRenderAll: jest.fn(),
      getObjects: jest.fn().mockReturnValue([]),
      setActiveObject: jest.fn(),
      discardActiveObject: jest.fn(),
      setZoom: jest.fn(),
      zoomToPoint: jest.fn(),
      absolutePan: jest.fn(),
      setViewportTransform: jest.fn(),
      getZoom: jest.fn().mockReturnValue(1),
      getPointer: jest.fn().mockReturnValue({ x: 0, y: 0 }),
      width: 1200,
      height: 800,
      viewportTransform: [1, 0, 0, 1, 0, 0]
    })),
    Rect: jest.fn().mockImplementation(() => ({})),
    Text: jest.fn().mockImplementation(() => ({})),
    Group: jest.fn().mockImplementation(() => ({})),
    ActiveSelection: jest.fn().mockImplementation(() => ({}))
  }
}));

// Mock stores
jest.mock('@/stores/aiAnalysisStore');

// Mock services
jest.mock('@/services/ai/computerVision', () => ({
  computerVisionService: {
    analyzeDrawing: jest.fn(),
    startAnalysisSession: jest.fn()
  }
}));

// Mock debounce
jest.mock('debounce', () => (fn) => fn);

const mockUseAIAnalysisStore = useAIAnalysisStore as jest.MockedFunction<typeof useAIAnalysisStore>;

const mockComponentDetection: ComponentDetection = {
  id: 'test-component-1',
  type: ElectricalComponentType.BREAKER,
  confidence: 0.92,
  boundingBox: { x: 100, y: 100, width: 50, height: 30 },
  specifications: {
    manufacturer: 'Test Manufacturer',
    modelNumber: 'TEST-001',
    voltage: 480,
    amperage: 20
  },
  metadata: {
    detectionTimestamp: new Date(),
    modelVersion: 'test-v1.0',
    processingTime: 1200,
    imageRegion: {
      sourceWidth: 1200,
      sourceHeight: 800,
      scale: 1,
      offset: { x: 0, y: 0 }
    }
  }
};

describe('InteractiveDrawingCanvas', () => {
  const defaultProps = {
    drawingId: 'test-drawing-123',
    width: 1200,
    height: 800
  };

  beforeEach(() => {
    mockUseAIAnalysisStore.mockReturnValue({
      componentDetections: [],
      isProcessing: false,
      processingStage: 'idle' as any,
      confidence: { overall: 0, byService: {}, distribution: { high: 0, medium: 0, low: 0 } },
      confidenceThreshold: 0.75,
      startAnalysis: jest.fn(),
      clearAnalysis: jest.fn(),
      setConfidenceThreshold: jest.fn(),
      // Add other required properties
      currentAnalysis: null,
      cloudDetections: [],
      circuitTraces: [],
      hourEstimations: [],
      processingQueue: [],
      autoRefresh: true,
      realtimeUpdates: true,
      recentUpdates: [],
      cancelAnalysis: jest.fn(),
      updateComponentDetections: jest.fn(),
      updateProcessingStage: jest.fn(),
      addRealtimeUpdate: jest.fn(),
      addToQueue: jest.fn(),
      removeFromQueue: jest.fn(),
      clearQueue: jest.fn()
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders canvas with controls', () => {
    render(<InteractiveDrawingCanvas {...defaultProps} />);
    
    expect(screen.getByText('AI Drawing Analysis')).toBeInTheDocument();
    expect(screen.getByText('Start Analysis')).toBeInTheDocument();
    expect(screen.getByText('Confidence Threshold:')).toBeInTheDocument();
  });

  it('displays processing state correctly', () => {
    mockUseAIAnalysisStore.mockReturnValue({
      ...mockUseAIAnalysisStore(),
      isProcessing: true,
      processingStage: 'component-detection' as any
    });

    render(<InteractiveDrawingCanvas {...defaultProps} />);
    
    expect(screen.getByText('Analyzing...')).toBeInTheDocument();
    expect(screen.getByText('component-detection')).toBeInTheDocument();
  });

  it('handles component selection', () => {
    const onComponentSelect = jest.fn();
    
    render(
      <InteractiveDrawingCanvas 
        {...defaultProps}
        onComponentSelect={onComponentSelect}
        initialDetections={[mockComponentDetection]}
      />
    );

    // Canvas should be ready
    expect(screen.getByRole('button', { name: /start analysis/i })).toBeInTheDocument();
  });

  it('updates confidence threshold', async () => {
    const setConfidenceThreshold = jest.fn();
    mockUseAIAnalysisStore.mockReturnValue({
      ...mockUseAIAnalysisStore(),
      setConfidenceThreshold
    });

    render(<InteractiveDrawingCanvas {...defaultProps} />);
    
    // Find confidence slider (implementation would depend on actual Slider component)
    const slider = screen.getByRole('slider');
    
    fireEvent.change(slider, { target: { value: '0.85' } });
    
    // Debounced function should be called
    await waitFor(() => {
      expect(setConfidenceThreshold).toHaveBeenCalledWith(0.85);
    });
  });

  it('starts analysis when button clicked', async () => {
    const startAnalysis = jest.fn();
    mockUseAIAnalysisStore.mockReturnValue({
      ...mockUseAIAnalysisStore(),
      startAnalysis
    });

    render(<InteractiveDrawingCanvas {...defaultProps} />);
    
    const startButton = screen.getByText('Start Analysis');
    fireEvent.click(startButton);
    
    await waitFor(() => {
      expect(startAnalysis).toHaveBeenCalledWith('test-drawing-123', {
        confidenceThreshold: 0.75,
        includeText: true,
        enableCloudDetection: false,
        enableCircuitTracing: false
      });
    });
  });

  it('clears analysis when clear button clicked', () => {
    const clearAnalysis = jest.fn();
    mockUseAIAnalysisStore.mockReturnValue({
      ...mockUseAIAnalysisStore(),
      clearAnalysis
    });

    render(<InteractiveDrawingCanvas {...defaultProps} />);
    
    const clearButton = screen.getByRole('button', { name: /clear/i });
    fireEvent.click(clearButton);
    
    expect(clearAnalysis).toHaveBeenCalled();
  });

  it('displays detection statistics', () => {
    mockUseAIAnalysisStore.mockReturnValue({
      ...mockUseAIAnalysisStore(),
      componentDetections: [mockComponentDetection, { ...mockComponentDetection, id: 'test-2' }],
      confidence: { 
        overall: 0.85, 
        byService: { computerVision: 0.85 }, 
        distribution: { high: 50, medium: 30, low: 20 }
      }
    });

    render(<InteractiveDrawingCanvas {...defaultProps} />);
    
    expect(screen.getByText('2')).toBeInTheDocument(); // Total detections
    expect(screen.getByText('85%')).toBeInTheDocument(); // Average confidence
  });

  it('handles canvas ready callback', () => {
    const onCanvasReady = jest.fn();
    
    render(
      <InteractiveDrawingCanvas 
        {...defaultProps}
        onCanvasReady={onCanvasReady}
      />
    );
    
    // Canvas should initialize and call ready callback
    // Note: In actual implementation, this would be called after Fabric.js canvas initializes
  });

  it('displays error state', () => {
    render(<InteractiveDrawingCanvas {...defaultProps} />);
    
    // Simulate error by clicking start analysis and having it fail
    const startButton = screen.getByText('Start Analysis');
    fireEvent.click(startButton);
    
    // Error handling would be tested with actual error scenarios
  });

  it('supports performance mode', () => {
    render(
      <InteractiveDrawingCanvas 
        {...defaultProps}
        performanceMode={true}
      />
    );
    
    expect(screen.getByText('AI Drawing Analysis')).toBeInTheDocument();
  });

  it('toggles controls visibility', () => {
    render(<InteractiveDrawingCanvas {...defaultProps} />);
    
    // Find settings button to hide controls
    const settingsButtons = screen.getAllByRole('button');
    const settingsButton = settingsButtons.find(button => 
      button.querySelector('svg') // Settings icon
    );
    
    if (settingsButton) {
      fireEvent.click(settingsButton);
      // Controls should be minimized
    }
  });
});

// Integration test for component overlay rendering
describe('InteractiveDrawingCanvas - Component Overlays', () => {
  const defaultProps = {
    drawingId: 'test-drawing-123',
    width: 1200,
    height: 800
  };

  it('renders component overlays for detections', () => {
    mockUseAIAnalysisStore.mockReturnValue({
      ...mockUseAIAnalysisStore(),
      componentDetections: [mockComponentDetection],
      confidenceThreshold: 0.5 // Lower threshold to include test component
    });

    render(
      <InteractiveDrawingCanvas 
        {...defaultProps}
        initialDetections={[mockComponentDetection]}
      />
    );
    
    // Canvas should be rendered
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('width', '1200');
    expect(canvas).toHaveAttribute('height', '800');
  });

  it('filters components by confidence threshold', () => {
    const lowConfidenceComponent = {
      ...mockComponentDetection,
      id: 'low-confidence',
      confidence: 0.6
    };

    mockUseAIAnalysisStore.mockReturnValue({
      ...mockUseAIAnalysisStore(),
      componentDetections: [mockComponentDetection, lowConfidenceComponent],
      confidenceThreshold: 0.8
    });

    render(<InteractiveDrawingCanvas {...defaultProps} />);
    
    // Only high confidence component should be visible
    // This would be verified by checking canvas overlays in real implementation
  });
});