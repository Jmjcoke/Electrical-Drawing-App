/**
 * Types and interfaces for the Fallback Service
 */

export interface FallbackServiceConfig {
  maxCacheEntries: number;
  defaultCacheTTL: number;
  cacheCleanupInterval: number;
  primaryOperationTimeout: number;
  enableBackgroundRevalidation: boolean;
  fallbackHierarchyMaxDepth: number;
}

export interface FallbackOperationContext {
  operationType: string;
  cacheKey?: string;
  correlationId?: string;
  enableCaching?: boolean;
  cacheTTL?: number;
  disabledFallbackLevels?: number[];
  minPriority?: 'low' | 'medium' | 'high';
  path?: string;
  basePath?: string;
  sessionId?: string;
  filename?: string;
  id?: string;
  metadata?: Record<string, any>;
}

export interface FallbackLevel {
  level: number;
  strategy: FallbackStrategy;
  description: string;
  timeout: number;
  priority: 'low' | 'medium' | 'high';
  config?: Record<string, any>;
}

export interface FallbackCacheEntry {
  key: string;
  data: any;
  timestamp: number;
  ttl: number;
  operationType: string;
  correlationId?: string;
  accessCount?: number;
  lastAccessed?: number;
}

export interface FallbackResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  fallbackLevel: number | null;
  executionTime: number;
  operationId: string;
  cached: boolean;
  degraded?: boolean;
}

export interface FallbackStatistics {
  operationType: string;
  totalFallbacks: number;
  successfulFallbacks: number;
  levelUsage: Map<number, LevelUsageStats>;
  lastUpdated: number;
  successRate?: number;
  averageFallbackTime?: number;
}

export interface LevelUsageStats {
  attempts: number;
  successes: number;
}

export interface FallbackEventData {
  operationId: string;
  operationType: string;
  fallbackLevel: number;
  strategy: string;
  executionTime: number;
  correlationId?: string;
  error?: string;
}

export type FallbackStrategy =
  | 'cache_read_through'
  | 'local_cache_fallback'
  | 'stale_while_revalidate'
  | 'degraded_mode'
  | 'alternative_path_resolution'
  | 'degraded_path_access'
  | 'backup_metadata_store'
  | 'minimal_metadata_response'
  | 'distributed_cache_fallback'
  | 'external_service_fallback';

export interface FallbackHierarchy {
  operationType: string;
  levels: FallbackLevel[];
  lastModified: number;
  version: string;
}

export interface CacheInvalidationRequest {
  operationType?: string;
  cacheKey?: string;
  pattern?: string;
  correlationId?: string;
}

export interface FallbackHealthStatus {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  cacheSize: number;
  cacheHitRate: number;
  totalFallbacks: number;
  successfulFallbacks: number;
  averageResponseTime: number;
  lastCleanup: number;
}

/**
 * Default configuration for the fallback service
 */
export const defaultFallbackConfig: FallbackServiceConfig = {
  maxCacheEntries: 10000,
  defaultCacheTTL: 300000, // 5 minutes
  cacheCleanupInterval: 60000, // 1 minute
  primaryOperationTimeout: 10000, // 10 seconds
  enableBackgroundRevalidation: true,
  fallbackHierarchyMaxDepth: 5
};
