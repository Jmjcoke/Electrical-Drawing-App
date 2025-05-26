import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PerformanceMetrics, PerformanceAlert, PerformanceBenchmark, ResourceTiming } from '../../types/performance';

interface PerformanceMonitorProps {
  isEnabled: boolean;
  alertThresholds: {
    fps: number;
    memoryUsage: number;
    renderTime: number;
    responseTime: number;
  };
  onAlert: (alert: PerformanceAlert) => void;
  onMetricsUpdate: (metrics: PerformanceMetrics) => void;
  sampleInterval?: number;
  maxSamples?: number;
  children?: React.ReactNode;
}

interface PerformanceSample {
  timestamp: number;
  fps: number;
  frameTime: number;
  memoryUsage: number;
  renderTime: number;
  userTiming: ResourceTiming[];
  navigationTiming: any;
}

interface BenchmarkResult {
  name: string;
  score: number;
  details: Record<string, number>;
  timestamp: number;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  isEnabled,
  alertThresholds,
  onAlert,
  onMetricsUpdate,
  sampleInterval = 1000,
  maxSamples = 100,
  children
}) => {
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    averageFrameTime: 16.67,
    memoryUsage: 0,
    renderTime: 0,
    userInteractionDelay: 0,
    resourceLoadTime: 0,
    cacheHitRate: 0,
    networkLatency: 0,
    timestamp: Date.now()
  });

  const [performanceSamples, setPerformanceSamples] = useState<PerformanceSample[]>([]);
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const frameTimesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const animationFrameRef = useRef<number | null>(null);
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const performanceObserverRef = useRef<PerformanceObserver | null>(null);
  const userTimingRef = useRef<Map<string, number>>(new Map());

  // Initialize performance monitoring
  useEffect(() => {
    if (isEnabled) {
      startMonitoring();
    } else {
      stopMonitoring();
    }

    return () => {
      stopMonitoring();
    };
  }, [isEnabled]);

  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    setIsMonitoring(true);
    setupFrameRateMonitoring();
    setupPerformanceObserver();
    setupMemoryMonitoring();
    setupUserTimingMonitoring();

    monitoringIntervalRef.current = setInterval(() => {
      collectMetrics();
    }, sampleInterval);
  }, [isMonitoring, sampleInterval]);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
    }

    if (performanceObserverRef.current) {
      performanceObserverRef.current.disconnect();
    }
  }, []);

  const setupFrameRateMonitoring = useCallback(() => {
    const measureFrame = () => {
      const currentTime = performance.now();
      const frameTime = currentTime - lastFrameTimeRef.current;
      
      frameTimesRef.current.push(frameTime);
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      lastFrameTimeRef.current = currentTime;
      
      if (isMonitoring) {
        animationFrameRef.current = requestAnimationFrame(measureFrame);
      }
    };

    animationFrameRef.current = requestAnimationFrame(measureFrame);
  }, [isMonitoring]);

  const setupPerformanceObserver = useCallback(() => {
    if (!('PerformanceObserver' in window)) return;

    try {
      performanceObserverRef.current = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        
        entries.forEach(entry => {
          switch (entry.entryType) {
            case 'paint':
              if (entry.name === 'first-contentful-paint') {
                console.log(`FCP: ${entry.startTime}ms`);
              }
              break;
            
            case 'largest-contentful-paint':
              console.log(`LCP: ${entry.startTime}ms`);
              break;
            
            case 'layout-shift':
              console.log(`CLS: ${(entry as any).value}`);
              break;
            
            case 'longtask':
              console.log(`Long task: ${entry.duration}ms`);
              if (entry.duration > 50) {
                onAlert({
                  type: 'long_task',
                  severity: entry.duration > 100 ? 'high' : 'medium',
                  message: `Long task detected: ${entry.duration.toFixed(1)}ms`,
                  timestamp: Date.now(),
                  value: entry.duration
                });
              }
              break;

            case 'resource':
              const resourceEntry = entry as PerformanceResourceTiming;
              if (resourceEntry.duration > 1000) {
                onAlert({
                  type: 'slow_resource',
                  severity: 'medium',
                  message: `Slow resource load: ${resourceEntry.name} (${resourceEntry.duration.toFixed(1)}ms)`,
                  timestamp: Date.now(),
                  value: resourceEntry.duration
                });
              }
              break;
          }
        });
      });

      performanceObserverRef.current.observe({
        entryTypes: ['paint', 'largest-contentful-paint', 'layout-shift', 'longtask', 'resource', 'measure']
      });
    } catch (error) {
      console.warn('Performance Observer setup failed:', error);
    }
  }, [onAlert]);

  const setupMemoryMonitoring = useCallback(() => {
    // Monitor memory usage if available
    if ('memory' in performance) {
      const checkMemory = () => {
        const memory = (performance as any).memory;
        const memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
        
        if (memoryUsage > alertThresholds.memoryUsage) {
          onAlert({
            type: 'high_memory',
            severity: memoryUsage > alertThresholds.memoryUsage * 1.5 ? 'high' : 'medium',
            message: `High memory usage: ${memoryUsage.toFixed(1)}MB`,
            timestamp: Date.now(),
            value: memoryUsage
          });
        }
      };

      const memoryInterval = setInterval(checkMemory, 5000);
      return () => clearInterval(memoryInterval);
    }
  }, [alertThresholds.memoryUsage, onAlert]);

  const setupUserTimingMonitoring = useCallback(() => {
    // Override performance.mark and performance.measure to track custom timing
    const originalMark = performance.mark.bind(performance);
    const originalMeasure = performance.measure.bind(performance);

    performance.mark = function(markName: string, markOptions?: PerformanceMarkOptions) {
      userTimingRef.current.set(markName, performance.now());
      return originalMark(markName, markOptions);
    };

    performance.measure = function(measureName: string, startOrMeasureOptions?: string | PerformanceMeasureOptions, endMark?: string) {
      const result = originalMeasure(measureName, startOrMeasureOptions, endMark);
      
      // Track render time specifically
      if (measureName.includes('render')) {
        const entry = performance.getEntriesByName(measureName, 'measure')[0];
        if (entry && entry.duration > alertThresholds.renderTime) {
          onAlert({
            type: 'slow_render',
            severity: entry.duration > alertThresholds.renderTime * 2 ? 'high' : 'medium',
            message: `Slow render: ${measureName} (${entry.duration.toFixed(1)}ms)`,
            timestamp: Date.now(),
            value: entry.duration
          });
        }
      }
      
      return result;
    };
  }, [alertThresholds.renderTime, onAlert]);

  const collectMetrics = useCallback(() => {
    const now = performance.now();
    
    // Calculate FPS
    const validFrameTimes = frameTimesRef.current.filter(time => time > 0 && time < 1000);
    const averageFrameTime = validFrameTimes.length > 0 
      ? validFrameTimes.reduce((sum, time) => sum + time, 0) / validFrameTimes.length
      : 16.67;
    const fps = 1000 / averageFrameTime;

    // Get memory usage
    let memoryUsage = 0;
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      memoryUsage = memory.usedJSHeapSize / 1024 / 1024; // MB
    }

    // Get navigation timing
    const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const resourceLoadTime = navigationTiming ? navigationTiming.loadEventEnd - navigationTiming.navigationStart : 0;

    // Get user timing entries
    const userTimingEntries = performance.getEntriesByType('measure') as PerformanceMeasure[];
    const renderTimeEntries = userTimingEntries.filter(entry => entry.name.includes('render'));
    const renderTime = renderTimeEntries.length > 0 
      ? renderTimeEntries[renderTimeEntries.length - 1].duration 
      : 0;

    // Get user interaction delay (from last input to next frame)
    const eventTimingEntries = performance.getEntriesByType('event') as any[];
    const userInteractionDelay = eventTimingEntries.length > 0
      ? eventTimingEntries[eventTimingEntries.length - 1].processingEnd - eventTimingEntries[eventTimingEntries.length - 1].startTime
      : 0;

    const metrics: PerformanceMetrics = {
      fps: Math.round(fps * 10) / 10,
      averageFrameTime: Math.round(averageFrameTime * 100) / 100,
      memoryUsage: Math.round(memoryUsage * 100) / 100,
      renderTime: Math.round(renderTime * 100) / 100,
      userInteractionDelay: Math.round(userInteractionDelay * 100) / 100,
      resourceLoadTime: Math.round(resourceLoadTime * 100) / 100,
      cacheHitRate: 0, // This would be provided by cache manager
      networkLatency: 0, // This would be measured separately
      timestamp: Date.now()
    };

    // Create sample
    const sample: PerformanceSample = {
      timestamp: now,
      fps: metrics.fps,
      frameTime: averageFrameTime,
      memoryUsage: metrics.memoryUsage,
      renderTime: metrics.renderTime,
      userTiming: userTimingEntries.map(entry => ({
        name: entry.name,
        duration: entry.duration,
        startTime: entry.startTime
      })),
      navigationTiming: navigationTiming
    };

    // Update samples
    setPerformanceSamples(prev => {
      const newSamples = [...prev, sample];
      return newSamples.slice(-maxSamples);
    });

    setPerformanceMetrics(metrics);
    onMetricsUpdate(metrics);

    // Check for alerts
    checkPerformanceAlerts(metrics);
  }, [maxSamples, onMetricsUpdate]);

  const checkPerformanceAlerts = useCallback((metrics: PerformanceMetrics) => {
    // FPS alert
    if (metrics.fps < alertThresholds.fps) {
      onAlert({
        type: 'low_fps',
        severity: metrics.fps < alertThresholds.fps * 0.5 ? 'high' : 'medium',
        message: `Low FPS: ${metrics.fps.toFixed(1)}`,
        timestamp: Date.now(),
        value: metrics.fps
      });
    }

    // Memory alert
    if (metrics.memoryUsage > alertThresholds.memoryUsage) {
      onAlert({
        type: 'high_memory',
        severity: metrics.memoryUsage > alertThresholds.memoryUsage * 1.5 ? 'high' : 'medium',
        message: `High memory usage: ${metrics.memoryUsage.toFixed(1)}MB`,
        timestamp: Date.now(),
        value: metrics.memoryUsage
      });
    }

    // Render time alert
    if (metrics.renderTime > alertThresholds.renderTime) {
      onAlert({
        type: 'slow_render',
        severity: metrics.renderTime > alertThresholds.renderTime * 2 ? 'high' : 'medium',
        message: `Slow render: ${metrics.renderTime.toFixed(1)}ms`,
        timestamp: Date.now(),
        value: metrics.renderTime
      });
    }

    // User interaction delay alert
    if (metrics.userInteractionDelay > alertThresholds.responseTime) {
      onAlert({
        type: 'slow_interaction',
        severity: metrics.userInteractionDelay > alertThresholds.responseTime * 2 ? 'high' : 'medium',
        message: `Slow interaction: ${metrics.userInteractionDelay.toFixed(1)}ms`,
        timestamp: Date.now(),
        value: metrics.userInteractionDelay
      });
    }
  }, [alertThresholds, onAlert]);

  const runBenchmark = useCallback(async (name: string, testFunction: () => Promise<void> | void): Promise<BenchmarkResult> => {
    const startTime = performance.now();
    performance.mark(`${name}-start`);

    let memoryBefore = 0;
    if ('memory' in performance) {
      memoryBefore = (performance as any).memory.usedJSHeapSize;
    }

    try {
      await testFunction();
    } catch (error) {
      console.error(`Benchmark ${name} failed:`, error);
    }

    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);

    const endTime = performance.now();
    let memoryAfter = 0;
    if ('memory' in performance) {
      memoryAfter = (performance as any).memory.usedJSHeapSize;
    }

    const duration = endTime - startTime;
    const memoryDelta = memoryAfter - memoryBefore;

    const result: BenchmarkResult = {
      name,
      score: Math.round(1000 / duration), // Higher is better
      details: {
        duration,
        memoryDelta: memoryDelta / 1024 / 1024, // MB
        fps: frameTimesRef.current.length > 0 ? 1000 / (frameTimesRef.current.reduce((sum, time) => sum + time, 0) / frameTimesRef.current.length) : 0
      },
      timestamp: Date.now()
    };

    setBenchmarkResults(prev => [...prev, result]);
    return result;
  }, []);

  const getPerformanceReport = useCallback((): string => {
    const recentSamples = performanceSamples.slice(-10);
    const avgMetrics = recentSamples.reduce((acc, sample) => ({
      fps: acc.fps + sample.fps,
      frameTime: acc.frameTime + sample.frameTime,
      memoryUsage: acc.memoryUsage + sample.memoryUsage,
      renderTime: acc.renderTime + sample.renderTime
    }), { fps: 0, frameTime: 0, memoryUsage: 0, renderTime: 0 });

    if (recentSamples.length > 0) {
      avgMetrics.fps /= recentSamples.length;
      avgMetrics.frameTime /= recentSamples.length;
      avgMetrics.memoryUsage /= recentSamples.length;
      avgMetrics.renderTime /= recentSamples.length;
    }

    const report = {
      timestamp: new Date().toISOString(),
      current: performanceMetrics,
      averages: avgMetrics,
      benchmarks: benchmarkResults.slice(-5),
      browserInfo: {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        memory: 'memory' in performance ? (performance as any).memory : null
      },
      recommendations: generateRecommendations()
    };

    return JSON.stringify(report, null, 2);
  }, [performanceMetrics, performanceSamples, benchmarkResults]);

  const generateRecommendations = useCallback((): string[] => {
    const recommendations: string[] = [];

    if (performanceMetrics.fps < 30) {
      recommendations.push('Consider reducing visual complexity or enabling performance optimizations');
    }

    if (performanceMetrics.memoryUsage > 100) {
      recommendations.push('High memory usage detected. Consider enabling garbage collection or reducing cache size');
    }

    if (performanceMetrics.renderTime > 16) {
      recommendations.push('Render time is high. Consider enabling level-of-detail rendering or tile-based rendering');
    }

    if (performanceMetrics.userInteractionDelay > 100) {
      recommendations.push('User interaction is sluggish. Consider optimizing event handlers or reducing computational load');
    }

    return recommendations;
  }, [performanceMetrics]);

  const exportMetrics = useCallback((format: 'json' | 'csv' = 'json') => {
    if (format === 'json') {
      const blob = new Blob([getPerformanceReport()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance_report_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // CSV export
      const headers = ['timestamp', 'fps', 'frameTime', 'memoryUsage', 'renderTime'];
      const csvContent = [
        headers.join(','),
        ...performanceSamples.map(sample => 
          [sample.timestamp, sample.fps, sample.frameTime, sample.memoryUsage, sample.renderTime].join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance_data_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [getPerformanceReport, performanceSamples]);

  // Provide performance context
  const performanceContext = {
    metrics: performanceMetrics,
    samples: performanceSamples,
    benchmarks: benchmarkResults,
    isMonitoring,
    runBenchmark,
    getPerformanceReport,
    exportMetrics,
    startMonitoring,
    stopMonitoring
  };

  return (
    <PerformanceContext.Provider value={performanceContext}>
      {children}
    </PerformanceContext.Provider>
  );
};

// Performance context for child components
export const PerformanceContext = React.createContext<{
  metrics: PerformanceMetrics;
  samples: PerformanceSample[];
  benchmarks: BenchmarkResult[];
  isMonitoring: boolean;
  runBenchmark: (name: string, testFunction: () => Promise<void> | void) => Promise<BenchmarkResult>;
  getPerformanceReport: () => string;
  exportMetrics: (format?: 'json' | 'csv') => void;
  startMonitoring: () => void;
  stopMonitoring: () => void;
} | null>(null);

// Hook for using performance monitor
export const usePerformance = () => {
  const context = React.useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformance must be used within a PerformanceMonitor');
  }
  return context;
};