import React, { useEffect, useRef, useCallback, useState } from 'react';
import { CacheEntry, CachePolicy, CacheStats, TileData } from '../../types/cache';
import { BoundingBox, Point } from '../../types/electrical';

interface CacheManagerProps {
  maxCacheSize: number; // in MB
  cachePolicy: CachePolicy;
  onCacheStatsUpdate: (stats: CacheStats) => void;
  enablePersistentCache?: boolean;
  enablePreloading?: boolean;
  children?: React.ReactNode;
}

interface CacheConfig {
  maxMemoryUsage: number;
  maxEntries: number;
  ttl: number; // Time to live in milliseconds
  compressionEnabled: boolean;
  persistentStorageEnabled: boolean;
  preloadingEnabled: boolean;
}

export const CacheManager: React.FC<CacheManagerProps> = ({
  maxCacheSize,
  cachePolicy,
  onCacheStatsUpdate,
  enablePersistentCache = true,
  enablePreloading = true,
  children
}) => {
  const [cache, setCache] = useState<Map<string, CacheEntry>>(new Map());
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    totalEntries: 0,
    memoryUsage: 0,
    hitRate: 0,
    missRate: 0,
    totalRequests: 0,
    totalHits: 0,
    totalMisses: 0,
    averageLoadTime: 0,
    compressionRatio: 1.0
  });
  
  const [preloadQueue, setPreloadQueue] = useState<string[]>([]);
  const [isPreloading, setIsPreloading] = useState(false);
  
  const cacheConfig = useRef<CacheConfig>({
    maxMemoryUsage: maxCacheSize * 1024 * 1024, // Convert MB to bytes
    maxEntries: 1000,
    ttl: 30 * 60 * 1000, // 30 minutes
    compressionEnabled: true,
    persistentStorageEnabled: enablePersistentCache,
    preloadingEnabled: enablePreloading
  });

  const compressionWorkerRef = useRef<Worker | null>(null);
  const preloadWorkerRef = useRef<Worker | null>(null);

  // Initialize compression worker
  useEffect(() => {
    if (cacheConfig.current.compressionEnabled) {
      const workerCode = `
        self.onmessage = function(e) {
          const { type, data, id } = e.data;
          
          if (type === 'compress') {
            try {
              // Simple compression simulation (in real app, use proper compression)
              const compressed = JSON.stringify(data);
              const compressionRatio = compressed.length / JSON.stringify(data).length;
              
              self.postMessage({
                type: 'compressed',
                id,
                data: compressed,
                compressionRatio
              });
            } catch (error) {
              self.postMessage({
                type: 'error',
                id,
                error: error.message
              });
            }
          } else if (type === 'decompress') {
            try {
              const decompressed = JSON.parse(data);
              self.postMessage({
                type: 'decompressed',
                id,
                data: decompressed
              });
            } catch (error) {
              self.postMessage({
                type: 'error',
                id,
                error: error.message
              });
            }
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      compressionWorkerRef.current = new Worker(URL.createObjectURL(blob));
    }

    return () => {
      if (compressionWorkerRef.current) {
        compressionWorkerRef.current.terminate();
      }
    };
  }, []);

  // Initialize preload worker
  useEffect(() => {
    if (cacheConfig.current.preloadingEnabled) {
      const workerCode = `
        self.onmessage = function(e) {
          const { type, urls } = e.data;
          
          if (type === 'preload') {
            const promises = urls.map(url => 
              fetch(url).then(response => response.blob())
            );
            
            Promise.allSettled(promises).then(results => {
              const successful = results.filter(r => r.status === 'fulfilled').length;
              self.postMessage({
                type: 'preload_complete',
                successful,
                total: urls.length
              });
            });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      preloadWorkerRef.current = new Worker(URL.createObjectURL(blob));
    }

    return () => {
      if (preloadWorkerRef.current) {
        preloadWorkerRef.current.terminate();
      }
    };
  }, []);

  // Load cache from persistent storage on mount
  useEffect(() => {
    if (cacheConfig.current.persistentStorageEnabled) {
      loadPersistentCache();
    }
  }, []);

  // Save cache to persistent storage periodically
  useEffect(() => {
    if (cacheConfig.current.persistentStorageEnabled) {
      const interval = setInterval(savePersistentCache, 60000); // Save every minute
      return () => clearInterval(interval);
    }
  }, [cache]);

  const loadPersistentCache = useCallback(async () => {
    try {
      const cacheData = localStorage.getItem('pdfViewer_cache');
      if (cacheData) {
        const parsed = JSON.parse(cacheData);
        const restoredCache = new Map<string, CacheEntry>();
        
        Object.entries(parsed).forEach(([key, entry]: [string, any]) => {
          // Check if entry is still valid
          if (Date.now() - entry.timestamp < cacheConfig.current.ttl) {
            restoredCache.set(key, entry as CacheEntry);
          }
        });
        
        setCache(restoredCache);
        updateCacheStats(restoredCache);
      }
    } catch (error) {
      console.error('Failed to load persistent cache:', error);
    }
  }, []);

  const savePersistentCache = useCallback(async () => {
    try {
      const cacheObject: Record<string, CacheEntry> = {};
      cache.forEach((entry, key) => {
        // Only save if not expired
        if (Date.now() - entry.timestamp < cacheConfig.current.ttl) {
          cacheObject[key] = entry;
        }
      });
      
      localStorage.setItem('pdfViewer_cache', JSON.stringify(cacheObject));
    } catch (error) {
      console.error('Failed to save persistent cache:', error);
    }
  }, [cache]);

  const generateCacheKey = useCallback((type: string, params: any): string => {
    const paramString = JSON.stringify(params, Object.keys(params).sort());
    return `${type}_${btoa(paramString).replace(/[^a-zA-Z0-9]/g, '')}`;
  }, []);

  const calculateMemoryUsage = useCallback((data: any): number => {
    // Estimate memory usage based on data size
    const jsonString = JSON.stringify(data);
    return jsonString.length * 2; // Rough estimate for UTF-16 strings
  }, []);

  const isExpired = useCallback((entry: CacheEntry): boolean => {
    return Date.now() - entry.timestamp > cacheConfig.current.ttl;
  }, []);

  const shouldEvict = useCallback((entry: CacheEntry): boolean => {
    switch (cachePolicy.evictionStrategy) {
      case 'lru':
        return true; // Will be handled by LRU sorting
      case 'lfu':
        return entry.accessCount < 5; // Arbitrary threshold
      case 'ttl':
        return isExpired(entry);
      case 'size':
        return entry.memoryUsage > cachePolicy.maxEntrySize;
      default:
        return false;
    }
  }, [cachePolicy, isExpired]);

  const evictEntries = useCallback((cache: Map<string, CacheEntry>): Map<string, CacheEntry> => {
    const entries = Array.from(cache.entries());
    const currentMemoryUsage = entries.reduce((sum, [, entry]) => sum + entry.memoryUsage, 0);
    
    if (currentMemoryUsage <= cacheConfig.current.maxMemoryUsage && 
        entries.length <= cacheConfig.current.maxEntries) {
      return cache;
    }

    // Sort entries based on eviction strategy
    let sortedEntries: [string, CacheEntry][];
    
    switch (cachePolicy.evictionStrategy) {
      case 'lru':
        sortedEntries = entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        break;
      case 'lfu':
        sortedEntries = entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
        break;
      case 'ttl':
        sortedEntries = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        break;
      case 'size':
        sortedEntries = entries.sort((a, b) => b[1].memoryUsage - a[1].memoryUsage);
        break;
      default:
        sortedEntries = entries;
    }

    const newCache = new Map<string, CacheEntry>();
    let newMemoryUsage = 0;
    let entryCount = 0;

    // Keep entries until we hit limits
    for (const [key, entry] of sortedEntries.reverse()) {
      if (newMemoryUsage + entry.memoryUsage <= cacheConfig.current.maxMemoryUsage &&
          entryCount < cacheConfig.current.maxEntries &&
          !isExpired(entry)) {
        newCache.set(key, entry);
        newMemoryUsage += entry.memoryUsage;
        entryCount++;
      }
    }

    return newCache;
  }, [cachePolicy, isExpired]);

  const updateCacheStats = useCallback((cache: Map<string, CacheEntry>) => {
    const entries = Array.from(cache.values());
    const memoryUsage = entries.reduce((sum, entry) => sum + entry.memoryUsage, 0);
    
    setCacheStats(prev => {
      const totalRequests = prev.totalRequests;
      const hitRate = totalRequests > 0 ? prev.totalHits / totalRequests : 0;
      const missRate = totalRequests > 0 ? prev.totalMisses / totalRequests : 0;
      
      const stats: CacheStats = {
        totalEntries: entries.length,
        memoryUsage,
        hitRate,
        missRate,
        totalRequests,
        totalHits: prev.totalHits,
        totalMisses: prev.totalMisses,
        averageLoadTime: prev.averageLoadTime,
        compressionRatio: prev.compressionRatio
      };
      
      onCacheStatsUpdate(stats);
      return stats;
    });
  }, [onCacheStatsUpdate]);

  const get = useCallback(async (key: string): Promise<any | null> => {
    const startTime = performance.now();
    
    setCacheStats(prev => ({
      ...prev,
      totalRequests: prev.totalRequests + 1
    }));

    const entry = cache.get(key);
    
    if (entry && !isExpired(entry)) {
      // Cache hit
      entry.lastAccessed = Date.now();
      entry.accessCount++;
      
      setCache(prev => new Map(prev.set(key, entry)));
      
      setCacheStats(prev => ({
        ...prev,
        totalHits: prev.totalHits + 1,
        averageLoadTime: (prev.averageLoadTime + (performance.now() - startTime)) / 2
      }));

      // Decompress if needed
      if (entry.isCompressed && compressionWorkerRef.current) {
        return new Promise((resolve) => {
          const messageHandler = (e: MessageEvent) => {
            if (e.data.id === key && e.data.type === 'decompressed') {
              compressionWorkerRef.current?.removeEventListener('message', messageHandler);
              resolve(e.data.data);
            }
          };
          
          compressionWorkerRef.current.addEventListener('message', messageHandler);
          compressionWorkerRef.current.postMessage({
            type: 'decompress',
            id: key,
            data: entry.data
          });
        });
      }

      return entry.data;
    } else {
      // Cache miss
      setCacheStats(prev => ({
        ...prev,
        totalMisses: prev.totalMisses + 1
      }));
      return null;
    }
  }, [cache, isExpired]);

  const set = useCallback(async (key: string, data: any, options: {
    priority?: number;
    ttl?: number;
    compress?: boolean;
  } = {}): Promise<void> => {
    const memoryUsage = calculateMemoryUsage(data);
    const timestamp = Date.now();
    const ttl = options.ttl || cacheConfig.current.ttl;
    
    let finalData = data;
    let isCompressed = false;
    let compressionRatio = 1.0;

    // Compress if enabled and beneficial
    if (options.compress !== false && 
        cacheConfig.current.compressionEnabled && 
        memoryUsage > 1024 && // Only compress larger items
        compressionWorkerRef.current) {
      
      try {
        const compressed = await new Promise<{ data: any; compressionRatio: number }>((resolve, reject) => {
          const messageHandler = (e: MessageEvent) => {
            if (e.data.id === key) {
              compressionWorkerRef.current?.removeEventListener('message', messageHandler);
              if (e.data.type === 'compressed') {
                resolve({
                  data: e.data.data,
                  compressionRatio: e.data.compressionRatio
                });
              } else if (e.data.type === 'error') {
                reject(new Error(e.data.error));
              }
            }
          };
          
          compressionWorkerRef.current!.addEventListener('message', messageHandler);
          compressionWorkerRef.current!.postMessage({
            type: 'compress',
            id: key,
            data
          });
        });

        if (compressed.compressionRatio < 0.8) { // Only use if good compression
          finalData = compressed.data;
          isCompressed = true;
          compressionRatio = compressed.compressionRatio;
          
          setCacheStats(prev => ({
            ...prev,
            compressionRatio: (prev.compressionRatio + compressionRatio) / 2
          }));
        }
      } catch (error) {
        console.warn('Compression failed, storing uncompressed:', error);
      }
    }

    const entry: CacheEntry = {
      key,
      data: finalData,
      timestamp,
      lastAccessed: timestamp,
      accessCount: 1,
      memoryUsage: isCompressed ? memoryUsage * compressionRatio : memoryUsage,
      isCompressed,
      priority: options.priority || 1,
      ttl
    };

    setCache(prev => {
      const newCache = new Map(prev);
      newCache.set(key, entry);
      
      // Evict if necessary
      const evictedCache = evictEntries(newCache);
      updateCacheStats(evictedCache);
      
      return evictedCache;
    });
  }, [calculateMemoryUsage, evictEntries, updateCacheStats]);

  const remove = useCallback((key: string): boolean => {
    setCache(prev => {
      const newCache = new Map(prev);
      const deleted = newCache.delete(key);
      updateCacheStats(newCache);
      return newCache;
    });
    
    return cache.has(key);
  }, [cache, updateCacheStats]);

  const clear = useCallback((): void => {
    setCache(new Map());
    setCacheStats({
      totalEntries: 0,
      memoryUsage: 0,
      hitRate: 0,
      missRate: 0,
      totalRequests: 0,
      totalHits: 0,
      totalMisses: 0,
      averageLoadTime: 0,
      compressionRatio: 1.0
    });
  }, []);

  const preload = useCallback(async (keys: string[], dataProvider: (key: string) => Promise<any>): Promise<void> => {
    if (!cacheConfig.current.preloadingEnabled || isPreloading) return;

    setIsPreloading(true);
    setPreloadQueue(keys);

    try {
      for (const key of keys) {
        if (!cache.has(key)) {
          try {
            const data = await dataProvider(key);
            await set(key, data, { priority: 0.5 }); // Lower priority for preloaded items
          } catch (error) {
            console.warn(`Failed to preload ${key}:`, error);
          }
        }
      }
    } finally {
      setIsPreloading(false);
      setPreloadQueue([]);
    }
  }, [cache, set, isPreloading]);

  const invalidate = useCallback((pattern: string | RegExp): number => {
    let removed = 0;
    
    setCache(prev => {
      const newCache = new Map(prev);
      
      for (const key of newCache.keys()) {
        const matches = typeof pattern === 'string' 
          ? key.includes(pattern)
          : pattern.test(key);
          
        if (matches) {
          newCache.delete(key);
          removed++;
        }
      }
      
      updateCacheStats(newCache);
      return newCache;
    });
    
    return removed;
  }, [updateCacheStats]);

  const prefetch = useCallback(async (bounds: BoundingBox, tileSize: number, dataProvider: (tileKey: string) => Promise<TileData>): Promise<void> => {
    if (!cacheConfig.current.preloadingEnabled) return;

    const tilesX = Math.ceil(bounds.width / tileSize);
    const tilesY = Math.ceil(bounds.height / tileSize);
    const prefetchKeys: string[] = [];

    // Generate tile keys around the viewport
    for (let y = -1; y <= tilesY; y++) {
      for (let x = -1; x <= tilesX; x++) {
        if (x >= 0 && x < tilesX && y >= 0 && y < tilesY) continue; // Skip visible tiles
        
        const tileKey = generateCacheKey('tile', { x, y, bounds, tileSize });
        prefetchKeys.push(tileKey);
      }
    }

    // Preload surrounding tiles
    await preload(prefetchKeys, async (key) => {
      const params = JSON.parse(atob(key.replace('tile_', '')));
      return await dataProvider(key);
    });
  }, [generateCacheKey, preload]);

  // Cleanup expired entries periodically
  useEffect(() => {
    const cleanup = () => {
      setCache(prev => {
        const newCache = new Map<string, CacheEntry>();
        
        prev.forEach((entry, key) => {
          if (!isExpired(entry)) {
            newCache.set(key, entry);
          }
        });
        
        updateCacheStats(newCache);
        return newCache;
      });
    };

    const interval = setInterval(cleanup, 60000); // Cleanup every minute
    return () => clearInterval(interval);
  }, [isExpired, updateCacheStats]);

  // Provide cache context
  const cacheContext = {
    get,
    set,
    remove,
    clear,
    preload,
    invalidate,
    prefetch,
    generateCacheKey,
    stats: cacheStats,
    isPreloading
  };

  return (
    <CacheContext.Provider value={cacheContext}>
      {children}
    </CacheContext.Provider>
  );
};

// Cache context for child components
export const CacheContext = React.createContext<{
  get: (key: string) => Promise<any | null>;
  set: (key: string, data: any, options?: any) => Promise<void>;
  remove: (key: string) => boolean;
  clear: () => void;
  preload: (keys: string[], dataProvider: (key: string) => Promise<any>) => Promise<void>;
  invalidate: (pattern: string | RegExp) => number;
  prefetch: (bounds: BoundingBox, tileSize: number, dataProvider: (tileKey: string) => Promise<TileData>) => Promise<void>;
  generateCacheKey: (type: string, params: any) => string;
  stats: CacheStats;
  isPreloading: boolean;
} | null>(null);

// Hook for using cache
export const useCache = () => {
  const context = React.useContext(CacheContext);
  if (!context) {
    throw new Error('useCache must be used within a CacheManager');
  }
  return context;
};