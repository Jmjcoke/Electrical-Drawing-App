import React, { useEffect, useRef, useCallback, useState } from 'react';
import { MemoryStats, ResourcePool, GCConfig, MemoryLeak } from '../../types/memory';

interface MemoryManagerProps {
  maxMemoryUsage: number; // in MB
  gcConfig: GCConfig;
  onMemoryStatsUpdate: (stats: MemoryStats) => void;
  onMemoryWarning: (warning: { type: string; message: string; severity: 'low' | 'medium' | 'high' }) => void;
  enableLeakDetection?: boolean;
  enableAutoCleanup?: boolean;
  children?: React.ReactNode;
}

interface ResourceReference {
  id: string;
  type: 'canvas' | 'image' | 'worker' | 'blob' | 'arraybuffer' | 'imagedata';
  size: number;
  created: number;
  lastAccessed: number;
  accessCount: number;
  isDisposed: boolean;
  cleanup?: () => void;
}

interface MemoryPool {
  canvases: Map<string, HTMLCanvasElement>;
  images: Map<string, HTMLImageElement>;
  workers: Map<string, Worker>;
  blobs: Map<string, Blob>;
  arrayBuffers: Map<string, ArrayBuffer>;
  imageData: Map<string, ImageData>;
}

export const MemoryManager: React.FC<MemoryManagerProps> = ({
  maxMemoryUsage,
  gcConfig,
  onMemoryStatsUpdate,
  onMemoryWarning,
  enableLeakDetection = true,
  enableAutoCleanup = true,
  children
}) => {
  const [memoryStats, setMemoryStats] = useState<MemoryStats>({
    totalAllocated: 0,
    totalUsed: 0,
    totalFreed: 0,
    activeReferences: 0,
    peakUsage: 0,
    gcCollections: 0,
    memoryLeaks: 0,
    fragmentationRatio: 0
  });

  const [resourcePool, setResourcePool] = useState<ResourcePool>({
    canvases: new Map(),
    images: new Map(),
    workers: new Map(),
    blobs: new Map(),
    arrayBuffers: new Map(),
    imageData: new Map()
  });

  const resourceReferences = useRef<Map<string, ResourceReference>>(new Map());
  const memoryPool = useRef<MemoryPool>({
    canvases: new Map(),
    images: new Map(),
    workers: new Map(),
    blobs: new Map(),
    arrayBuffers: new Map(),
    imageData: new Map()
  });

  const gcIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const leakDetectionRef = useRef<NodeJS.Timeout | null>(null);
  const memoryObserverRef = useRef<PerformanceObserver | null>(null);
  const lastGCTime = useRef<number>(Date.now());

  // Initialize memory monitoring
  useEffect(() => {
    setupMemoryMonitoring();
    setupGarbageCollection();
    
    if (enableLeakDetection) {
      setupLeakDetection();
    }

    return () => {
      cleanup();
    };
  }, []);

  const setupMemoryMonitoring = useCallback(() => {
    // Monitor memory usage with Performance Observer if available
    if ('PerformanceObserver' in window && 'memory' in performance) {
      try {
        memoryObserverRef.current = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (entry.entryType === 'measure') {
              updateMemoryStats();
            }
          });
        });
        
        memoryObserverRef.current.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('Performance Observer not supported:', error);
      }
    }

    // Fallback to periodic monitoring
    const interval = setInterval(updateMemoryStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const setupGarbageCollection = useCallback(() => {
    if (enableAutoCleanup) {
      gcIntervalRef.current = setInterval(() => {
        performGarbageCollection();
      }, gcConfig.interval || 30000); // Default 30 seconds
    }
  }, [enableAutoCleanup, gcConfig.interval]);

  const setupLeakDetection = useCallback(() => {
    leakDetectionRef.current = setInterval(() => {
      detectMemoryLeaks();
    }, 60000); // Check for leaks every minute
  }, []);

  const cleanup = useCallback(() => {
    if (gcIntervalRef.current) {
      clearInterval(gcIntervalRef.current);
    }
    
    if (leakDetectionRef.current) {
      clearInterval(leakDetectionRef.current);
    }
    
    if (memoryObserverRef.current) {
      memoryObserverRef.current.disconnect();
    }

    // Cleanup all resources
    disposeAllResources();
  }, []);

  const generateResourceId = useCallback((): string => {
    return `resource_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }, []);

  const estimateSize = useCallback((resource: any, type: string): number => {
    switch (type) {
      case 'canvas':
        const canvas = resource as HTMLCanvasElement;
        return canvas.width * canvas.height * 4; // RGBA bytes
      
      case 'image':
        const img = resource as HTMLImageElement;
        return (img.naturalWidth || img.width) * (img.naturalHeight || img.height) * 4;
      
      case 'arraybuffer':
        return (resource as ArrayBuffer).byteLength;
      
      case 'imagedata':
        const imageData = resource as ImageData;
        return imageData.width * imageData.height * 4;
      
      case 'blob':
        return (resource as Blob).size;
      
      case 'worker':
        return 1024 * 1024; // Estimate 1MB for worker
      
      default:
        return 1024; // Default 1KB estimate
    }
  }, []);

  const registerResource = useCallback((
    resource: any, 
    type: string, 
    cleanup?: () => void
  ): string => {
    const id = generateResourceId();
    const size = estimateSize(resource, type);
    const now = Date.now();
    
    const reference: ResourceReference = {
      id,
      type: type as any,
      size,
      created: now,
      lastAccessed: now,
      accessCount: 1,
      isDisposed: false,
      cleanup
    };

    resourceReferences.current.set(id, reference);
    
    // Add to appropriate pool
    switch (type) {
      case 'canvas':
        memoryPool.current.canvases.set(id, resource);
        break;
      case 'image':
        memoryPool.current.images.set(id, resource);
        break;
      case 'worker':
        memoryPool.current.workers.set(id, resource);
        break;
      case 'blob':
        memoryPool.current.blobs.set(id, resource);
        break;
      case 'arraybuffer':
        memoryPool.current.arrayBuffers.set(id, resource);
        break;
      case 'imagedata':
        memoryPool.current.imageData.set(id, resource);
        break;
    }

    updateMemoryStats();
    checkMemoryLimits();
    
    return id;
  }, [generateResourceId, estimateSize]);

  const accessResource = useCallback((id: string): any => {
    const reference = resourceReferences.current.get(id);
    if (!reference || reference.isDisposed) return null;

    reference.lastAccessed = Date.now();
    reference.accessCount++;

    // Get resource from appropriate pool
    switch (reference.type) {
      case 'canvas':
        return memoryPool.current.canvases.get(id);
      case 'image':
        return memoryPool.current.images.get(id);
      case 'worker':
        return memoryPool.current.workers.get(id);
      case 'blob':
        return memoryPool.current.blobs.get(id);
      case 'arraybuffer':
        return memoryPool.current.arrayBuffers.get(id);
      case 'imagedata':
        return memoryPool.current.imageData.get(id);
      default:
        return null;
    }
  }, []);

  const disposeResource = useCallback((id: string): boolean => {
    const reference = resourceReferences.current.get(id);
    if (!reference || reference.isDisposed) return false;

    // Run cleanup function if provided
    if (reference.cleanup) {
      try {
        reference.cleanup();
      } catch (error) {
        console.warn(`Cleanup failed for resource ${id}:`, error);
      }
    }

    // Remove from appropriate pool
    switch (reference.type) {
      case 'canvas':
        const canvas = memoryPool.current.canvases.get(id);
        if (canvas) {
          // Clear canvas to free memory
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
          canvas.width = 0;
          canvas.height = 0;
        }
        memoryPool.current.canvases.delete(id);
        break;
      
      case 'worker':
        const worker = memoryPool.current.workers.get(id);
        if (worker) {
          worker.terminate();
        }
        memoryPool.current.workers.delete(id);
        break;
      
      case 'image':
        const img = memoryPool.current.images.get(id);
        if (img) {
          img.src = '';
          img.removeAttribute('src');
        }
        memoryPool.current.images.delete(id);
        break;
      
      case 'blob':
        memoryPool.current.blobs.delete(id);
        break;
      
      case 'arraybuffer':
        memoryPool.current.arrayBuffers.delete(id);
        break;
      
      case 'imagedata':
        memoryPool.current.imageData.delete(id);
        break;
    }

    reference.isDisposed = true;
    resourceReferences.current.delete(id);
    
    updateMemoryStats();
    return true;
  }, []);

  const disposeAllResources = useCallback(() => {
    const ids = Array.from(resourceReferences.current.keys());
    ids.forEach(id => disposeResource(id));
  }, [disposeResource]);

  const createCanvas = useCallback((width: number, height: number): { canvas: HTMLCanvasElement; id: string } => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    const id = registerResource(canvas, 'canvas', () => {
      canvas.width = 0;
      canvas.height = 0;
    });
    
    return { canvas, id };
  }, [registerResource]);

  const createWorker = useCallback((scriptURL: string): { worker: Worker; id: string } => {
    const worker = new Worker(scriptURL);
    
    const id = registerResource(worker, 'worker', () => {
      worker.terminate();
    });
    
    return { worker, id };
  }, [registerResource]);

  const createImageData = useCallback((width: number, height: number): { imageData: ImageData; id: string } => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot create 2D context');
    
    const imageData = ctx.createImageData(width, height);
    
    const id = registerResource(imageData, 'imagedata');
    
    return { imageData, id };
  }, [registerResource]);

  const updateMemoryStats = useCallback(() => {
    const references = Array.from(resourceReferences.current.values());
    const activeReferences = references.filter(ref => !ref.isDisposed);
    
    const totalAllocated = references.reduce((sum, ref) => sum + ref.size, 0);
    const totalUsed = activeReferences.reduce((sum, ref) => sum + ref.size, 0);
    const totalFreed = totalAllocated - totalUsed;

    // Calculate fragmentation (simplified)
    const poolSizes = [
      memoryPool.current.canvases.size,
      memoryPool.current.images.size,
      memoryPool.current.workers.size,
      memoryPool.current.blobs.size,
      memoryPool.current.arrayBuffers.size,
      memoryPool.current.imageData.size
    ];
    
    const totalPools = poolSizes.reduce((sum, size) => sum + size, 0);
    const fragmentationRatio = totalPools > 0 ? activeReferences.length / totalPools : 0;

    const newStats: MemoryStats = {
      totalAllocated,
      totalUsed,
      totalFreed,
      activeReferences: activeReferences.length,
      peakUsage: Math.max(memoryStats.peakUsage, totalUsed),
      gcCollections: memoryStats.gcCollections,
      memoryLeaks: memoryStats.memoryLeaks,
      fragmentationRatio
    };

    setMemoryStats(newStats);
    onMemoryStatsUpdate(newStats);
  }, [memoryStats, onMemoryStatsUpdate]);

  const checkMemoryLimits = useCallback(() => {
    const maxBytes = maxMemoryUsage * 1024 * 1024;
    const currentUsage = memoryStats.totalUsed;
    const usageRatio = currentUsage / maxBytes;

    if (usageRatio > 0.9) {
      onMemoryWarning({
        type: 'high_usage',
        message: `Memory usage is ${(usageRatio * 100).toFixed(1)}% of limit`,
        severity: 'high'
      });
      
      // Force garbage collection
      performGarbageCollection();
    } else if (usageRatio > 0.7) {
      onMemoryWarning({
        type: 'moderate_usage',
        message: `Memory usage is ${(usageRatio * 100).toFixed(1)}% of limit`,
        severity: 'medium'
      });
    }
  }, [maxMemoryUsage, memoryStats.totalUsed, onMemoryWarning]);

  const performGarbageCollection = useCallback(() => {
    const now = Date.now();
    const timeSinceLastGC = now - lastGCTime.current;
    
    if (timeSinceLastGC < (gcConfig.minInterval || 10000)) {
      return; // Too soon since last GC
    }

    const references = Array.from(resourceReferences.current.values());
    const maxAge = gcConfig.maxAge || 300000; // 5 minutes default
    const maxIdleTime = gcConfig.maxIdleTime || 60000; // 1 minute default
    
    let collected = 0;

    // Collect old or idle resources
    references.forEach(ref => {
      if (ref.isDisposed) return;

      const age = now - ref.created;
      const idleTime = now - ref.lastAccessed;
      
      const shouldCollect = 
        age > maxAge || 
        idleTime > maxIdleTime ||
        (ref.accessCount === 1 && idleTime > 30000); // Unused resources

      if (shouldCollect) {
        disposeResource(ref.id);
        collected++;
      }
    });

    // Force browser GC if available
    if ('gc' in window && typeof (window as any).gc === 'function') {
      try {
        (window as any).gc();
      } catch (error) {
        // GC not available
      }
    }

    lastGCTime.current = now;
    setMemoryStats(prev => ({
      ...prev,
      gcCollections: prev.gcCollections + 1
    }));

    if (collected > 0) {
      console.log(`Garbage collection freed ${collected} resources`);
    }
  }, [gcConfig, disposeResource]);

  const detectMemoryLeaks = useCallback(() => {
    const now = Date.now();
    const references = Array.from(resourceReferences.current.values());
    
    // Look for resources that haven't been accessed in a very long time
    const suspiciousResources = references.filter(ref => {
      const idleTime = now - ref.lastAccessed;
      const age = now - ref.created;
      
      return !ref.isDisposed && 
             idleTime > 600000 && // 10 minutes idle
             age > 900000 && // 15 minutes old
             ref.accessCount < 5; // Low access count
    });

    if (suspiciousResources.length > 0) {
      setMemoryStats(prev => ({
        ...prev,
        memoryLeaks: prev.memoryLeaks + suspiciousResources.length
      }));

      onMemoryWarning({
        type: 'memory_leak',
        message: `Detected ${suspiciousResources.length} potential memory leaks`,
        severity: 'medium'
      });

      // Optionally auto-dispose suspected leaks
      if (gcConfig.autoDisposeSuspicious) {
        suspiciousResources.forEach(ref => {
          disposeResource(ref.id);
        });
      }
    }
  }, [gcConfig.autoDisposeSuspicious, disposeResource, onMemoryWarning]);

  const getMemoryReport = useCallback((): string => {
    const references = Array.from(resourceReferences.current.values());
    const activeRefs = references.filter(ref => !ref.isDisposed);
    
    const report = {
      timestamp: new Date().toISOString(),
      stats: memoryStats,
      breakdown: {
        canvas: activeRefs.filter(ref => ref.type === 'canvas').length,
        image: activeRefs.filter(ref => ref.type === 'image').length,
        worker: activeRefs.filter(ref => ref.type === 'worker').length,
        blob: activeRefs.filter(ref => ref.type === 'blob').length,
        arraybuffer: activeRefs.filter(ref => ref.type === 'arraybuffer').length,
        imagedata: activeRefs.filter(ref => ref.type === 'imagedata').length
      },
      largestResources: activeRefs
        .sort((a, b) => b.size - a.size)
        .slice(0, 10)
        .map(ref => ({
          id: ref.id,
          type: ref.type,
          size: ref.size,
          age: Date.now() - ref.created,
          accessCount: ref.accessCount
        }))
    };

    return JSON.stringify(report, null, 2);
  }, [memoryStats]);

  // Provide memory management context
  const memoryContext = {
    registerResource,
    accessResource,
    disposeResource,
    disposeAllResources,
    createCanvas,
    createWorker,
    createImageData,
    performGarbageCollection,
    stats: memoryStats,
    getMemoryReport
  };

  return (
    <MemoryContext.Provider value={memoryContext}>
      {children}
    </MemoryContext.Provider>
  );
};

// Memory context for child components
export const MemoryContext = React.createContext<{
  registerResource: (resource: any, type: string, cleanup?: () => void) => string;
  accessResource: (id: string) => any;
  disposeResource: (id: string) => boolean;
  disposeAllResources: () => void;
  createCanvas: (width: number, height: number) => { canvas: HTMLCanvasElement; id: string };
  createWorker: (scriptURL: string) => { worker: Worker; id: string };
  createImageData: (width: number, height: number) => { imageData: ImageData; id: string };
  performGarbageCollection: () => void;
  stats: MemoryStats;
  getMemoryReport: () => string;
} | null>(null);

// Hook for using memory manager
export const useMemory = () => {
  const context = React.useContext(MemoryContext);
  if (!context) {
    throw new Error('useMemory must be used within a MemoryManager');
  }
  return context;
};