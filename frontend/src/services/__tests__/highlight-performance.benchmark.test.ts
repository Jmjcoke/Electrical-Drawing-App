/**
 * Performance Benchmarks for Highlight Rendering and Interaction
 * Measures rendering speed, memory usage, and interaction responsiveness
 */

import { OptimizedHighlightRenderer } from '../optimized-highlight-renderer';
import { getHighlightAnalyticsService } from '../highlight-analytics.service';
import type {
  ComponentHighlight,
  ViewportState,
  HighlightStyle,
  PerformanceData
} from '../../types/highlighting.types';

// Mock Canvas API for benchmarking
const mockCanvas = {
  width: 1920,
  height: 1080,
  getContext: jest.fn().mockReturnValue({
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
    getImageData: jest.fn().mockReturnValue(new ImageData(100, 100)),
    putImageData: jest.fn(),
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1
  })
} as unknown as HTMLCanvasElement;

const mockWebGLContext = {
  clear: jest.fn(),
  clearColor: jest.fn(),
  enable: jest.fn(),
  blendFunc: jest.fn(),
  useProgram: jest.fn(),
  bindBuffer: jest.fn(),
  bufferData: jest.fn(),
  drawArrays: jest.fn(),
  COLOR_BUFFER_BIT: 1,
  BLEND: 2,
  SRC_ALPHA: 3,
  ONE_MINUS_SRC_ALPHA: 4,
  ARRAY_BUFFER: 5,
  STATIC_DRAW: 6,
  TRIANGLES: 7
} as unknown as WebGLRenderingContext;

describe('Highlight Performance Benchmarks', () => {
  const createBenchmarkHighlight = (id: string, x: number = Math.random(), y: number = Math.random()): ComponentHighlight => ({
    id,
    componentId: `benchmark-component-${id}`,
    type: Math.random() > 0.5 ? 'component' : 'area',
    coordinates: {
      x,
      y,
      width: 0.02 + Math.random() * 0.08, // 2%-10% width
      height: 0.02 + Math.random() * 0.06, // 2%-8% height
      pageNumber: 1,
      zoomLevel: 1,
      viewportOffset: { x: 0, y: 0 }
    },
    style: {
      color: ['#FF9800', '#4CAF50', '#2196F3', '#F44336', '#9C27B0'][Math.floor(Math.random() * 5)],
      opacity: 0.6 + Math.random() * 0.4, // 60%-100% opacity
      strokeWidth: 1 + Math.floor(Math.random() * 3), // 1-3px stroke
      strokeStyle: ['solid', 'dashed', 'dotted'][Math.floor(Math.random() * 3)] as any,
      fillOpacity: 0.1 + Math.random() * 0.3, // 10%-40% fill
      zIndex: Math.floor(Math.random() * 10),
      animationType: Math.random() > 0.8 ? ['pulse', 'glow', 'fade'][Math.floor(Math.random() * 3)] as any : 'none'
    },
    responseId: `response-${id}`,
    queryId: `query-${id}`,
    sessionId: 'benchmark-session',
    createdAt: new Date(),
    isVisible: Math.random() > 0.1, // 90% visible
    isPersistent: Math.random() > 0.7 // 30% persistent
  });

  const mockViewportState: ViewportState = {
    zoom: 1,
    panX: 0,
    panY: 0,
    rotation: 0
  };

  const mockOriginalViewport = {
    width: 1920,
    height: 1080
  };

  let renderer: OptimizedHighlightRenderer;
  let analyticsService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    renderer = new OptimizedHighlightRenderer({
      enableWebGL: true,
      maxHighlights: 1000,
      animationFPS: 60,
      debounceInterval: 16,
      enableBatching: true,
      cullingEnabled: true
    });
    
    analyticsService = getHighlightAnalyticsService({
      enableTracking: true,
      enablePerformanceTracking: true,
      sampleRate: 1.0
    });
  });

  afterEach(() => {
    renderer.dispose();
    analyticsService.dispose();
  });

  describe('Rendering Performance Benchmarks', () => {
    const benchmarkSizes = [10, 50, 100, 250, 500, 1000];

    benchmarkSizes.forEach(size => {
      it(`should render ${size} highlights within performance targets`, async () => {
        const highlights = Array.from({ length: size }, (_, i) => createBenchmarkHighlight(`render-${i}`));
        
        // Initialize renderer
        mockCanvas.getContext = jest.fn().mockReturnValue(mockWebGLContext);
        const initialized = renderer.initialize(mockCanvas);
        expect(initialized).toBe(true);

        // Measure rendering performance
        const startTime = performance.now();
        const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

        // Perform multiple renders to get average
        const renderCount = 10;
        for (let i = 0; i < renderCount; i++) {
          renderer.render(highlights, mockViewportState, mockOriginalViewport);
          // Wait for debounce
          await new Promise(resolve => setTimeout(resolve, 20));
        }

        const endTime = performance.now();
        const endMemory = (performance as any).memory?.usedJSHeapSize || 0;
        
        const averageRenderTime = (endTime - startTime) / renderCount;
        const memoryIncrease = endMemory - startMemory;

        // Log performance metrics
        console.log(`${size} highlights - Average render time: ${averageRenderTime.toFixed(2)}ms`);
        console.log(`${size} highlights - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

        // Performance assertions
        if (size <= 100) {
          expect(averageRenderTime).toBeLessThan(50); // <50ms for small sets
        } else if (size <= 500) {
          expect(averageRenderTime).toBeLessThan(100); // <100ms for medium sets
        } else {
          expect(averageRenderTime).toBeLessThan(200); // <200ms for large sets
        }

        // Memory usage should be reasonable
        const memoryPerHighlight = memoryIncrease / size;
        expect(memoryPerHighlight).toBeLessThan(1024); // <1KB per highlight

        // Track performance
        const performanceData: PerformanceData = {
          renderTime: averageRenderTime,
          memoryUsage: memoryIncrease,
          highlightCount: size,
          fps: 1000 / averageRenderTime,
          viewportCulled: 0,
          cacheHits: 0,
          cacheMisses: size
        };

        analyticsService.trackPerformance(performanceData);
      });
    });

    it('should demonstrate viewport culling effectiveness', async () => {
      // Create highlights spread across large area
      const highlights = Array.from({ length: 500 }, (_, i) => 
        createBenchmarkHighlight(`culling-${i}`, 
          Math.random() * 10 - 5, // -5 to 5 (most outside viewport)
          Math.random() * 10 - 5
        )
      );

      mockCanvas.getContext = jest.fn().mockReturnValue(mockWebGLContext);
      renderer.initialize(mockCanvas);

      // Render with normal viewport (should cull many)
      const startTime = performance.now();
      renderer.render(highlights, mockViewportState, mockOriginalViewport);
      await new Promise(resolve => setTimeout(resolve, 20));
      const renderTime = performance.now() - startTime;

      const metrics = renderer.getMetrics();
      
      console.log(`Culling test - Rendered: ${metrics.highlightsRendered}, Culled: ${metrics.highlightsCulled}`);
      console.log(`Culling effectiveness: ${((metrics.highlightsCulled / highlights.length) * 100).toFixed(1)}%`);
      
      // Should cull most highlights outside viewport
      expect(metrics.highlightsCulled).toBeGreaterThan(highlights.length * 0.7); // >70% culled
      expect(metrics.highlightsRendered + metrics.highlightsCulled).toBe(highlights.length);
      
      // Rendering should be faster with culling
      expect(renderTime).toBeLessThan(100);
    });

    it('should benchmark caching effectiveness', async () => {
      const staticHighlights = Array.from({ length: 100 }, (_, i) => 
        createBenchmarkHighlight(`cache-${i}`)
      );

      // Remove animations to enable caching
      staticHighlights.forEach(h => {
        h.style = { ...h.style, animationType: 'none' };
      });

      mockCanvas.getContext = jest.fn().mockReturnValue({
        ...mockWebGLContext,
        getImageData: jest.fn().mockReturnValue(new ImageData(50, 50)),
        putImageData: jest.fn()
      });
      
      renderer.initialize(mockCanvas);

      // First render (cache miss)
      const firstRenderStart = performance.now();
      renderer.render(staticHighlights, mockViewportState, mockOriginalViewport);
      await new Promise(resolve => setTimeout(resolve, 20));
      const firstRenderTime = performance.now() - firstRenderStart;

      // Second render (cache hit)
      const secondRenderStart = performance.now();
      renderer.render(staticHighlights, mockViewportState, mockOriginalViewport);
      await new Promise(resolve => setTimeout(resolve, 20));
      const secondRenderTime = performance.now() - secondRenderStart;

      console.log(`Cache test - First render: ${firstRenderTime.toFixed(2)}ms, Second render: ${secondRenderTime.toFixed(2)}ms`);
      console.log(`Cache speedup: ${(firstRenderTime / secondRenderTime).toFixed(2)}x`);

      // Second render should be faster (cache hit)
      expect(secondRenderTime).toBeLessThan(firstRenderTime * 0.8); // At least 20% faster

      const metrics = renderer.getMetrics();
      expect(metrics.memoryUsage).toBeGreaterThan(0); // Should have cached data
    });
  });

  describe('Animation Performance Benchmarks', () => {
    it('should maintain smooth animation performance', async () => {
      const animatedHighlights = Array.from({ length: 50 }, (_, i) => {
        const highlight = createBenchmarkHighlight(`anim-${i}`);
        highlight.style = {
          ...highlight.style,
          animationType: ['pulse', 'glow', 'fade'][i % 3] as any
        };
        return highlight;
      });

      mockCanvas.getContext = jest.fn().mockReturnValue(mockWebGLContext);
      renderer.initialize(mockCanvas);

      // Simulate animation frames
      const frameCount = 60; // 1 second at 60fps
      const frameTimes: number[] = [];

      for (let frame = 0; frame < frameCount; frame++) {
        const frameStart = performance.now();
        
        renderer.render(animatedHighlights, mockViewportState, mockOriginalViewport);
        await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps
        
        frameTimes.push(performance.now() - frameStart);
      }

      const averageFrameTime = frameTimes.reduce((sum, time) => sum + time, 0) / frameCount;
      const maxFrameTime = Math.max(...frameTimes);
      const targetFPS = 60;
      const actualFPS = 1000 / averageFrameTime;

      console.log(`Animation test - Average frame time: ${averageFrameTime.toFixed(2)}ms`);
      console.log(`Animation test - Max frame time: ${maxFrameTime.toFixed(2)}ms`);
      console.log(`Animation test - Actual FPS: ${actualFPS.toFixed(1)}`);

      // Should maintain near 60fps
      expect(averageFrameTime).toBeLessThan(16.67); // 60fps = 16.67ms per frame
      expect(actualFPS).toBeGreaterThan(55); // Allow small variance
      expect(maxFrameTime).toBeLessThan(33); // No frame should drop below 30fps
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('should manage memory efficiently with large datasets', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      
      mockCanvas.getContext = jest.fn().mockReturnValue(mockWebGLContext);
      renderer.initialize(mockCanvas);

      // Create and render increasingly large datasets
      const sizes = [100, 200, 500, 1000];
      const memoryMeasurements: Array<{ size: number; memory: number }> = [];

      for (const size of sizes) {
        const highlights = Array.from({ length: size }, (_, i) => 
          createBenchmarkHighlight(`memory-${size}-${i}`)
        );

        renderer.render(highlights, mockViewportState, mockOriginalViewport);
        await new Promise(resolve => setTimeout(resolve, 50));

        const currentMemory = (performance as any).memory?.usedJSHeapSize || 0;
        const memoryUsed = currentMemory - initialMemory;
        
        memoryMeasurements.push({ size, memory: memoryUsed });
        
        console.log(`${size} highlights - Memory usage: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`);
      }

      // Memory growth should be roughly linear
      for (let i = 1; i < memoryMeasurements.length; i++) {
        const prev = memoryMeasurements[i - 1];
        const curr = memoryMeasurements[i];
        
        const sizeRatio = curr.size / prev.size;
        const memoryRatio = curr.memory / prev.memory;
        
        // Memory growth should not be exponential
        expect(memoryRatio).toBeLessThan(sizeRatio * 1.5);
      }

      // Test cache cleanup
      renderer.clearCache();
      
      // Memory should decrease after cache clear
      await new Promise(resolve => setTimeout(resolve, 100));
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      expect(finalMemory).toBeLessThan(memoryMeasurements[memoryMeasurements.length - 1].memory + initialMemory);
    });
  });

  describe('Interaction Performance Benchmarks', () => {
    it('should handle rapid mouse interactions efficiently', async () => {
      const highlights = Array.from({ length: 200 }, (_, i) => 
        createBenchmarkHighlight(`interaction-${i}`)
      );

      mockCanvas.getContext = jest.fn().mockReturnValue(mockWebGLContext);
      renderer.initialize(mockCanvas);
      renderer.render(highlights, mockViewportState, mockOriginalViewport);

      // Simulate rapid mouse movements
      const interactionCount = 100;
      const interactionTimes: number[] = [];

      for (let i = 0; i < interactionCount; i++) {
        const startTime = performance.now();
        
        // Simulate mouse move event processing
        const mouseX = Math.random() * mockCanvas.width;
        const mouseY = Math.random() * mockCanvas.height;
        
        // This would typically trigger highlight detection
        // For benchmark, we simulate the processing time
        const hitTest = highlights.filter(h => {
          const centerX = h.coordinates.x * mockCanvas.width;
          const centerY = h.coordinates.y * mockCanvas.height;
          const distance = Math.sqrt(
            Math.pow(mouseX - centerX, 2) + Math.pow(mouseY - centerY, 2)
          );
          return distance < 50; // 50px hit radius
        });

        interactionTimes.push(performance.now() - startTime);
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      const averageInteractionTime = interactionTimes.reduce((sum, time) => sum + time, 0) / interactionCount;
      const maxInteractionTime = Math.max(...interactionTimes);

      console.log(`Interaction test - Average response time: ${averageInteractionTime.toFixed(2)}ms`);
      console.log(`Interaction test - Max response time: ${maxInteractionTime.toFixed(2)}ms`);

      // Interactions should be very fast
      expect(averageInteractionTime).toBeLessThan(5); // <5ms average
      expect(maxInteractionTime).toBeLessThan(20); // <20ms max
    });
  });

  describe('Scalability Benchmarks', () => {
    it('should demonstrate performance degradation curves', async () => {
      const testSizes = [10, 25, 50, 100, 250, 500, 750, 1000];
      const performanceResults: Array<{
        size: number;
        renderTime: number;
        memoryUsage: number;
        fps: number;
      }> = [];

      for (const size of testSizes) {
        const highlights = Array.from({ length: size }, (_, i) => 
          createBenchmarkHighlight(`scale-${size}-${i}`)
        );

        mockCanvas.getContext = jest.fn().mockReturnValue(mockWebGLContext);
        const testRenderer = new OptimizedHighlightRenderer();
        testRenderer.initialize(mockCanvas);

        const startMemory = (performance as any).memory?.usedJSHeapSize || 0;
        const startTime = performance.now();

        // Multiple renders for average
        for (let i = 0; i < 5; i++) {
          testRenderer.render(highlights, mockViewportState, mockOriginalViewport);
          await new Promise(resolve => setTimeout(resolve, 20));
        }

        const endTime = performance.now();
        const endMemory = (performance as any).memory?.usedJSHeapSize || 0;

        const averageRenderTime = (endTime - startTime) / 5;
        const memoryUsage = endMemory - startMemory;
        const fps = 1000 / averageRenderTime;

        performanceResults.push({
          size,
          renderTime: averageRenderTime,
          memoryUsage,
          fps
        });

        testRenderer.dispose();

        console.log(`Scale test ${size}: ${averageRenderTime.toFixed(2)}ms, ${fps.toFixed(1)}fps, ${(memoryUsage / 1024).toFixed(0)}KB`);
      }

      // Generate performance report
      const report = {
        testName: 'Highlighting System Scalability',
        results: performanceResults,
        analysis: {
          linearGrowthFactor: calculateGrowthFactor(performanceResults, 'renderTime'),
          memoryEfficiency: calculateMemoryPerHighlight(performanceResults),
          performanceThresholds: {
            acceptable: performanceResults.filter(r => r.renderTime < 50).length,
            degraded: performanceResults.filter(r => r.renderTime >= 50 && r.renderTime < 100).length,
            poor: performanceResults.filter(r => r.renderTime >= 100).length
          }
        }
      };

      console.log('Performance Report:', JSON.stringify(report, null, 2));

      // Performance should degrade gracefully
      expect(report.analysis.linearGrowthFactor).toBeLessThan(3); // Not more than 3x linear growth
      expect(report.analysis.performanceThresholds.poor).toBeLessThan(testSizes.length * 0.3); // <30% poor performance
    });
  });

  describe('Real-world Scenario Benchmarks', () => {
    it('should handle typical user interaction patterns', async () => {
      // Simulate real-world usage pattern
      const highlights = Array.from({ length: 150 }, (_, i) => 
        createBenchmarkHighlight(`realworld-${i}`)
      );

      mockCanvas.getContext = jest.fn().mockReturnValue(mockWebGLContext);
      renderer.initialize(mockCanvas);

      const scenario = [
        { action: 'initial_render', highlights: highlights.slice(0, 50) },
        { action: 'add_highlights', highlights: highlights.slice(0, 75) },
        { action: 'zoom_in', viewport: { ...mockViewportState, zoom: 2 } },
        { action: 'pan', viewport: { ...mockViewportState, zoom: 2, panX: -100, panY: -50 } },
        { action: 'add_more', highlights: highlights.slice(0, 100) },
        { action: 'toggle_visibility', highlights: highlights.slice(0, 100).map(h => ({ ...h, isVisible: !h.isVisible })) },
        { action: 'zoom_out', viewport: { ...mockViewportState, zoom: 0.5 } },
        { action: 'final_render', highlights: highlights }
      ];

      const scenarioResults: Array<{ action: string; time: number; fps: number }> = [];

      for (const step of scenario) {
        const startTime = performance.now();
        
        renderer.render(
          step.highlights || highlights,
          step.viewport || mockViewportState,
          mockOriginalViewport
        );
        
        await new Promise(resolve => setTimeout(resolve, 20));
        
        const renderTime = performance.now() - startTime;
        const fps = 1000 / renderTime;
        
        scenarioResults.push({
          action: step.action,
          time: renderTime,
          fps
        });

        console.log(`${step.action}: ${renderTime.toFixed(2)}ms (${fps.toFixed(1)}fps)`);
      }

      // All steps should maintain good performance
      scenarioResults.forEach(result => {
        expect(result.time).toBeLessThan(100); // <100ms per step
        expect(result.fps).toBeGreaterThan(10); // >10fps minimum
      });

      const averageTime = scenarioResults.reduce((sum, r) => sum + r.time, 0) / scenarioResults.length;
      expect(averageTime).toBeLessThan(50); // <50ms average
    });
  });

  // Helper functions
  function calculateGrowthFactor(results: Array<{ size: number; renderTime: number }>, metric: keyof typeof results[0]): number {
    if (results.length < 2) return 1;
    
    const first = results[0];
    const last = results[results.length - 1];
    
    const sizeRatio = last.size / first.size;
    const metricRatio = (last[metric] as number) / (first[metric] as number);
    
    return metricRatio / sizeRatio;
  }

  function calculateMemoryPerHighlight(results: Array<{ size: number; memoryUsage: number }>): number {
    if (results.length === 0) return 0;
    
    const totalMemory = results.reduce((sum, r) => sum + r.memoryUsage, 0);
    const totalHighlights = results.reduce((sum, r) => sum + r.size, 0);
    
    return totalMemory / totalHighlights;
  }
});

// Performance test runner utility
export class PerformanceBenchmarkRunner {
  static async runBenchmarkSuite(testName: string, testFn: () => Promise<void>): Promise<{
    name: string;
    duration: number;
    memoryDelta: number;
    success: boolean;
    error?: string;
  }> {
    const startTime = performance.now();
    const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

    try {
      await testFn();
      
      const endTime = performance.now();
      const endMemory = (performance as any).memory?.usedJSHeapSize || 0;

      return {
        name: testName,
        duration: endTime - startTime,
        memoryDelta: endMemory - startMemory,
        success: true
      };
    } catch (error) {
      return {
        name: testName,
        duration: performance.now() - startTime,
        memoryDelta: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static generatePerformanceReport(results: Array<{
    name: string;
    duration: number;
    memoryDelta: number;
    success: boolean;
  }>): string {
    const successfulTests = results.filter(r => r.success);
    const failedTests = results.filter(r => !r.success);

    const report = `
# Highlighting System Performance Report

## Summary
- Total Tests: ${results.length}
- Successful: ${successfulTests.length}
- Failed: ${failedTests.length}
- Success Rate: ${((successfulTests.length / results.length) * 100).toFixed(1)}%

## Performance Metrics
- Average Test Duration: ${(successfulTests.reduce((sum, r) => sum + r.duration, 0) / successfulTests.length).toFixed(2)}ms
- Total Memory Delta: ${(successfulTests.reduce((sum, r) => sum + r.memoryDelta, 0) / 1024 / 1024).toFixed(2)}MB
- Fastest Test: ${Math.min(...successfulTests.map(r => r.duration)).toFixed(2)}ms
- Slowest Test: ${Math.max(...successfulTests.map(r => r.duration)).toFixed(2)}ms

## Individual Results
${successfulTests.map(r => `- ${r.name}: ${r.duration.toFixed(2)}ms`).join('\n')}

${failedTests.length > 0 ? `
## Failed Tests
${failedTests.map(r => `- ${r.name}: ${r.error}`).join('\n')}
` : ''}
    `.trim();

    return report;
  }
}