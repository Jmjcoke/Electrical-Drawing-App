import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'perf_hooks';
import {
  ISharedStorageService,
  SessionPathConfig,
  ServiceConfig,
  SharedStorageServiceError,
  SHARED_STORAGE_ERRORS,
  SharedStorageErrorCode,
} from '../types/shared-storage.types';
import { sharedStorageMetrics } from './shared-storage.metrics';
import { sharedStorageLogger } from './shared-storage.logger';
import { createSharedStoragePerformance } from './shared-storage.performance';
import { createSharedStorageCache } from './shared-storage.cache';
import { SharedStorageAlerts } from './shared-storage.alerts';
import { createSharedStorageErrors } from './shared-storage.errors';
import { createSharedStorageRetry } from './shared-storage.retry';
import { createCircuitBreakerService, CircuitBreakerService } from './circuit-breaker.service';
import { createConnectionPoolManager, ConnectionPoolManager } from './connection-pool.manager';
import { ConnectionPoolOptimizer } from './connection-pool.config';
import { createMetadataCacheManager, MetadataCacheManager } from './metadata-cache.manager';
import { createIntelligentCacheManager, IntelligentCacheManager } from './intelligent-cache.manager';
import { createPerformanceProfiler, PerformanceProfiler } from './performance-profiler';
import { createMemoryManager, MemoryManager } from './memory-manager';
import { createLoadTester, LoadTester } from './load-tester';
import { createResourceMonitor, ResourceMonitor } from './resource-monitor';
import { ErrorCorrelationService } from './error-correlation.service';
import { FallbackService } from './fallback.service';

/**
 * SharedStorageService provides cross-service file access for microservices
 * Maintains session isolation and security boundaries while enabling file sharing
 */
export class SharedStorageService implements ISharedStorageService {
  private readonly config: SessionPathConfig;
  private readonly logger: Console;
  private readonly performanceThreshold: number = 100; // 100ms performance requirement
  private performanceMonitor: any;
  private cache: any;
  private alerts?: SharedStorageAlerts;
  private errorTracker: any;
  private retryMechanism: any;
  private circuitBreaker: CircuitBreakerService;
  private connectionPool: ConnectionPoolManager;
  private metadataCache: MetadataCacheManager;
  private intelligentCache: IntelligentCacheManager;
  private performanceProfiler: PerformanceProfiler;
  private memoryManager: MemoryManager;
  private loadTester: LoadTester;
  private resourceMonitor: ResourceMonitor;
  private errorCorrelation: ErrorCorrelationService;
  private fallbackService: FallbackService;

  constructor(
    config: SessionPathConfig,
    logger: Console = console,
    alerts?: SharedStorageAlerts
  ) {
    this.config = config;
    this.logger = logger;
    this.alerts = alerts;
    this.validateConfig();
    this.initializeCircuitBreaker();
    this.initializeConnectionPool();
    this.initializeMetadataCache();
    this.initializeIntelligentCache();
    this.initializePerformanceProfiler();
    this.initializeMemoryManager();
    this.initializeLoadTester();
    this.initializeResourceMonitor();
    this.initializeErrorCorrelation();
    this.initializeFallbackService();
    this.initializePerformanceAndCache();
    this.initializeErrorTrackingAndRetry();
  }

    /**
   * Get session path for a specific service with permission validation
   */
  async getSessionPath(sessionId: string, service: string): Promise<string> {
    const operationKey = `getSessionPath_${service}`;

    return this.circuitBreaker.executeWithCircuitBreaker(
      operationKey,
      async () => {
        const startTime = performance.now();
        // Use performance monitoring if available
        const timer = this.performanceMonitor?.startOperation('getSessionPath', service, { sessionId });
        const operationId = `${service}_${sessionId}_${Date.now()}`;

        sharedStorageMetrics.startOperation(service, operationId);

        try {
          this.validateSessionId(sessionId);
          this.validateServiceName(service);

          // Log permission check
          await this.checkPermissions(sessionId, service);
          sharedStorageLogger.logPermissionCheck(sessionId, service, '', true, 'Session access authorized');

          const sessionPath = path.join(this.config.baseSessionPath, sessionId);

          // Verify session directory exists
          try {
            await fs.access(sessionPath);
          } catch {
            throw new SharedStorageServiceError(
              SHARED_STORAGE_ERRORS.SESSION_NOT_FOUND,
              `Session directory not found: ${sessionId}`,
              sessionId,
              service
            );
          }

          // End performance monitoring
          if (timer) {
            timer.end({ success: true, sessionPath });
          }

          return sessionPath;
        } catch (error) {
          // End performance monitoring with error
          if (timer) {
            timer.end({ success: false, error: error.message });
          }

          const duration = performance.now() - startTime;
          const errorType = error instanceof SharedStorageServiceError ? error.code : 'UNKNOWN_ERROR';
          sharedStorageMetrics.recordAccessMetrics('getSessionPath', service, duration, false, errorType);
          sharedStorageMetrics.endOperation(service, operationId);

          // Track error with comprehensive error tracking system
          if (this.errorTracker) {
            await this.errorTracker.trackError(error as Error, {
              sessionId,
              service,
              operation: 'getSessionPath'
            }, 'getSessionPath');
          }

          // Log error with structured logging
          sharedStorageLogger.logFileAccess('getSessionPath', sessionId, service, '', duration, false, error as Error, operationId);
          sharedStorageLogger.logError('getSessionPath', error, sessionId, service, undefined, operationId);

          this.logError('getSessionPath', error, sessionId, service);
          throw error;
        }
      },
      {
        context: { sessionId, service, operation: 'getSessionPath' },
        fallback: async () => {
          // Fallback: Return cached session path if available
          sharedStorageLogger.logInfo('Circuit breaker fallback: getSessionPath', { sessionId, service });
          throw new SharedStorageServiceError(
            SHARED_STORAGE_ERRORS.SERVICE_UNAVAILABLE,
            `Service temporarily unavailable for session path access: ${sessionId}`,
            sessionId,
            service
          );
        }
      }
    );
  }

  /**
   * Access file from session directory with security validation
   */
  async accessFile(sessionId: string, filepath: string, service: string): Promise<Buffer> {
    const operationKey = `accessFile_${service}`;

    return this.circuitBreaker.executeWithCircuitBreaker(
      operationKey,
      async () => {
        const startTime = performance.now();
        const operationId = `${service}_${sessionId}_${Date.now()}`;

        sharedStorageMetrics.startOperation(service, operationId);

        // Start performance profiling
        this.performanceProfiler.startOperation(operationId, 'accessFile', {
          sessionId,
          filepath,
          service,
        });

        let pooledConnection: any = null;

        try {
          this.validateSessionId(sessionId);
          this.validateServiceName(service);
          this.validateFilePath(filepath);

          await this.checkPermissions(sessionId, service);

          // Acquire connection from pool for file access
          pooledConnection = await this.connectionPool.acquire();

          // Get session path directly to avoid recursive call overhead
          const sessionPath = path.join(this.config.baseSessionPath, sessionId);

          // Verify session directory exists
          try {
            await fs.access(sessionPath);
          } catch {
            throw new SharedStorageServiceError(
              SHARED_STORAGE_ERRORS.SESSION_NOT_FOUND,
              `Session directory not found: ${sessionId}`,
              sessionId,
              service
            );
          }
          const fullFilePath = path.resolve(sessionPath, filepath);
          const normalizedSessionPath = path.resolve(sessionPath);

          // Prevent path traversal attacks using path.resolve for more robust checking
          if (!fullFilePath.startsWith(normalizedSessionPath + path.sep) && fullFilePath !== normalizedSessionPath) {
            throw new SharedStorageServiceError(
              SHARED_STORAGE_ERRORS.PATH_TRAVERSAL_DETECTED,
              `Path traversal attempt detected: ${filepath}`,
              sessionId,
              service,
              filepath
            );
          }

          try {
            const fileBuffer = await fs.readFile(fullFilePath);
            const duration = performance.now() - startTime;
            sharedStorageMetrics.recordAccessMetrics('accessFile', service, duration, true);
            sharedStorageMetrics.endOperation(service, operationId);

            // Cache file for future access if intelligent caching decides it's beneficial
            try {
              await this.intelligentCache.cacheFile(sessionId, filepath, fileBuffer);
            } catch (cacheError) {
              // Don't fail the operation if caching fails
              sharedStorageLogger.logError('intelligentCache', cacheError as Error, sessionId, service, filepath, operationId);
            }

            this.logPerformance('accessFile', startTime, sessionId, service);

            // End performance profiling with success
            this.performanceProfiler.endOperation(
              operationId,
              'accessFile',
              sessionId,
              service,
              true, // success
              undefined, // no error
              fileBuffer.length // file size
            );

            return fileBuffer;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
              throw new SharedStorageServiceError(
                SHARED_STORAGE_ERRORS.FILE_NOT_FOUND,
                `File not found: ${filepath}`,
                sessionId,
                service,
                filepath
              );
            }
            throw new SharedStorageServiceError(
              SHARED_STORAGE_ERRORS.FILE_ACCESS_ERROR,
              `File access error: ${(error as Error).message}`,
              sessionId,
              service,
              filepath
            );
          }
        } catch (error) {
          const duration = performance.now() - startTime;
          const errorType = error instanceof SharedStorageServiceError ? error.code : 'UNKNOWN_ERROR';
          sharedStorageMetrics.recordAccessMetrics('accessFile', service, duration, false, errorType);
          sharedStorageMetrics.endOperation(service, operationId);

          this.logError('accessFile', error, sessionId, service, filepath);

          // End performance profiling with failure
          this.performanceProfiler.endOperation(
            operationId,
            'accessFile',
            sessionId,
            service,
            false, // failure
            errorType
          );

          throw error;
        } finally {
          // Always release connection back to pool
          if (pooledConnection) {
            try {
              await this.connectionPool.release(pooledConnection);
            } catch (releaseError) {
              sharedStorageLogger.logError('connectionRelease', releaseError as Error, sessionId, service, filepath, operationId);
            }
          }
        }
      },
      {
        context: { sessionId, service, operation: 'accessFile', filepath },
        fallback: async () => {
          // Fallback: Try to get file from intelligent cache
          try {
            sharedStorageLogger.logInfo('Circuit breaker fallback: trying intelligent cache', { sessionId, service, filepath });
            const cachedFile = await this.intelligentCache.getCachedFile(sessionId, filepath);
            if (cachedFile) {
              return cachedFile;
            }
          } catch (cacheError) {
            sharedStorageLogger.logError('Intelligent cache fallback failed', cacheError as Error, sessionId, service, filepath);
          }

          throw new SharedStorageServiceError(
            SHARED_STORAGE_ERRORS.SERVICE_UNAVAILABLE,
            `Service temporarily unavailable for file access: ${filepath}`,
            sessionId,
            service,
            filepath
          );
        }
      }
    );
  }

  /**
   * Check service permissions for session access
   */
  async checkPermissions(sessionId: string, service: string): Promise<boolean> {
    try {
      this.validateSessionId(sessionId);
      this.validateServiceName(service);

      const serviceConfig = this.config.serviceMap[service];
      if (!serviceConfig) {
        throw new SharedStorageServiceError(
          SHARED_STORAGE_ERRORS.SERVICE_UNAUTHORIZED,
          `Service not registered: ${service}`,
          sessionId,
          service
        );
      }

      // Check if service has read permissions
      if (!serviceConfig.permissions.canRead) {
        sharedStorageLogger.logSecurityEvent('unauthorized_access', {
          sessionId,
          service,
          reason: 'insufficient_permissions',
          requiredPermission: 'canRead'
        });

        throw new SharedStorageServiceError(
          SHARED_STORAGE_ERRORS.PERMISSION_DENIED,
          `Service ${service} does not have read permissions`,
          sessionId,
          service
        );
      }

      // Check session pattern restrictions if configured
      if (serviceConfig.allowedSessionPatterns?.length) {
        const matchesPattern = serviceConfig.allowedSessionPatterns.some(pattern => {
          return new RegExp(pattern).test(sessionId);
        });

        if (!matchesPattern) {
          sharedStorageLogger.logSecurityEvent('unauthorized_access', {
            sessionId,
            service,
            reason: 'pattern_mismatch',
            allowedPatterns: serviceConfig.allowedSessionPatterns
          });

          throw new SharedStorageServiceError(
            SHARED_STORAGE_ERRORS.PERMISSION_DENIED,
            `Service ${service} not authorized for session pattern`,
            sessionId,
            service
          );
        }
      }

      return true;
    } catch (error) {
      if (error instanceof SharedStorageServiceError) {
        throw error;
      }
      throw new SharedStorageServiceError(
        SHARED_STORAGE_ERRORS.PERMISSION_DENIED,
        `Permission check failed: ${(error as Error).message}`,
        sessionId,
        service
      );
    }
  }

  /**
   * List files in session directory
   */
  async listFiles(sessionId: string, subPath: string = '', service: string): Promise<string[]> {
    const startTime = performance.now();
    
    try {
      this.validateSessionId(sessionId);
      this.validateServiceName(service);
      
      await this.checkPermissions(sessionId, service);
      
      const sessionPath = await this.getSessionPath(sessionId, service);
      const targetPath = subPath ? path.resolve(sessionPath, subPath) : path.resolve(sessionPath);
      const normalizedSessionPath = path.resolve(sessionPath);
      
      // Security: ensure target path is within session directory using path.resolve
      if (!targetPath.startsWith(normalizedSessionPath + path.sep) && targetPath !== normalizedSessionPath) {
        throw new SharedStorageServiceError(
          SHARED_STORAGE_ERRORS.PATH_TRAVERSAL_DETECTED,
          `Invalid subpath: ${subPath}`,
          sessionId,
          service
        );
      }

      try {
        const files = await fs.readdir(targetPath, { withFileTypes: true });
        const fileNames = files
          .filter(dirent => dirent.isFile())
          .map(dirent => subPath ? path.join(subPath, dirent.name) : dirent.name);
        
        this.logPerformance('listFiles', startTime, sessionId, service);
        return fileNames;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return []; // Return empty array if directory doesn't exist
        }
        throw new SharedStorageServiceError(
          SHARED_STORAGE_ERRORS.FILE_ACCESS_ERROR,
          `Directory listing error: ${(error as Error).message}`,
          sessionId,
          service
        );
      }
    } catch (error) {
      this.logError('listFiles', error, sessionId, service);
      throw error;
    }
  }

  /**
   * Check if file exists in session
   */
  async fileExists(sessionId: string, filepath: string, service: string): Promise<boolean> {
    try {
      this.validateSessionId(sessionId);
      this.validateServiceName(service);
      this.validateFilePath(filepath);

      await this.checkPermissions(sessionId, service);

      // Try cache first for better performance
      const cachedMetadata = await this.metadataCache.getMetadata(sessionId, filepath);
      if (cachedMetadata) {
        return true; // If we have cached metadata, file exists
      }

      // Fallback to filesystem check
      const sessionPath = await this.getSessionPath(sessionId, service);
      const fullFilePath = path.resolve(sessionPath, filepath);
      const normalizedSessionPath = path.resolve(sessionPath);

      // Prevent path traversal using path.resolve for more robust checking
      if (!fullFilePath.startsWith(normalizedSessionPath + path.sep) && fullFilePath !== normalizedSessionPath) {
        return false;
      }

      try {
        await fs.access(fullFilePath);
        return true;
      } catch {
        return false;
      }
    } catch (error) {
      if (error instanceof SharedStorageServiceError) {
        throw error;
      }
      return false;
    }
  }

  /**
   * Initialize connection pool for Docker volume access
   */
  private initializeConnectionPool(): void {
    // Get optimal configuration based on load testing analysis
    const optimizationResult = ConnectionPoolOptimizer.analyzeLoadTestResults([]);

    this.connectionPool = createConnectionPoolManager(optimizationResult.recommendedConfig);

    // Set up connection pool event handlers
    this.connectionPool.on('connectionCreated', (connectionId: string) => {
      sharedStorageLogger.logInfo('Connection pool: connection created', { connectionId });
    });

    this.connectionPool.on('connectionDestroyed', (connectionId: string) => {
      sharedStorageLogger.logInfo('Connection pool: connection destroyed', { connectionId });
    });

    this.connectionPool.on('connectionUnhealthy', (connectionId: string) => {
      sharedStorageLogger.logError('Connection pool: connection unhealthy', undefined, undefined, undefined, undefined);
    });

    this.connectionPool.on('connectionRecovered', (connectionId: string) => {
      sharedStorageLogger.logInfo('Connection pool: connection recovered', { connectionId });
    });

    this.connectionPool.on('poolInitialized', (data: { initialConnections: number }) => {
      sharedStorageLogger.logInfo('Connection pool initialized', {
        initialConnections: data.initialConnections,
        maxConnections: optimizationResult.recommendedConfig.maxConnections,
        performanceScore: optimizationResult.performanceScore,
        costEfficiency: optimizationResult.costEfficiency,
      });
    });

    sharedStorageLogger.logInfo('Connection pool initialized', {
      maxConnections: optimizationResult.recommendedConfig.maxConnections,
      minConnections: optimizationResult.recommendedConfig.minConnections,
      recommendations: optimizationResult.recommendations,
    });
  }

  /**
   * Initialize metadata cache for file information
   */
  private initializeMetadataCache(): void {
    this.metadataCache = createMetadataCacheManager({
      redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
      defaultTTL: 3600, // 1 hour
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
      maxEntries: 10000,
      evictionPolicy: 'LRU',
      compressionThreshold: 1024, // 1KB
      warmingBatchSize: 10,
      healthCheckInterval: 30000, // 30 seconds
      cachePrefix: 'shared_storage_metadata',
    });

    // Set up metadata cache event handlers
    this.metadataCache.on('cacheHit', (data: any) => {
      sharedStorageLogger.logInfo('Metadata cache hit', data);
    });

    this.metadataCache.on('cacheMiss', (data: any) => {
      sharedStorageLogger.logInfo('Metadata cache miss', data);
    });

    this.metadataCache.on('metadataCached', (data: any) => {
      sharedStorageLogger.logInfo('Metadata cached', data);
    });

    this.metadataCache.on('cacheInvalidated', (data: any) => {
      sharedStorageLogger.logInfo('Cache invalidated', data);
    });

    this.metadataCache.on('sessionInvalidated', (data: any) => {
      sharedStorageLogger.logInfo('Session cache invalidated', data);
    });

    this.metadataCache.on('cacheWarmed', (data: any) => {
      sharedStorageLogger.logInfo('Cache warmed', data);
    });

    this.metadataCache.on('entriesEvicted', (data: any) => {
      sharedStorageLogger.logInfo('Cache entries evicted', data);
    });

    sharedStorageLogger.logInfo('Metadata cache initialized');
  }

  /**
   * Initialize intelligent file cache for performance optimization
   */
  private initializeIntelligentCache(): void {
    this.intelligentCache = createIntelligentCacheManager({
      redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
      maxFileSize: 1024 * 1024, // 1MB
      minFileSize: 1024, // 1KB
      compressionThreshold: 4096, // 4KB
      maxMemoryUsage: 500 * 1024 * 1024, // 500MB
      defaultTTL: 3600, // 1 hour
      accessPatternWindow: 24, // 24 hours
      popularityThreshold: 0.3, // 30% popularity threshold
      cachePrefix: 'shared_storage_intelligent',
      healthCheckInterval: 30000, // 30 seconds
    });

    // Set up intelligent cache event handlers
    this.intelligentCache.on('fileCached', (data: any) => {
      sharedStorageLogger.logInfo('Intelligent cache: file cached', data);
    });

    this.intelligentCache.on('cacheHit', (data: any) => {
      sharedStorageLogger.logInfo('Intelligent cache: cache hit', data);
    });

    this.intelligentCache.on('cacheMiss', (data: any) => {
      sharedStorageLogger.logInfo('Intelligent cache: cache miss', data);
    });

    this.intelligentCache.on('fileNotCached', (data: any) => {
      sharedStorageLogger.logInfo('Intelligent cache: file not cached', data);
    });

    this.intelligentCache.on('cachePreloaded', (data: any) => {
      sharedStorageLogger.logInfo('Intelligent cache: cache preloaded', data);
    });

    this.intelligentCache.on('cacheInvalidated', (data: any) => {
      sharedStorageLogger.logInfo('Intelligent cache: cache invalidated', data);
    });

    sharedStorageLogger.logInfo('Intelligent file cache initialized');
  }

  /**
   * Initialize performance profiler for monitoring and alerting
   */
  private initializePerformanceProfiler(): void {
    this.performanceProfiler = createPerformanceProfiler({
      redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
      enableRedisStorage: true,
      sampleRate: 0.2, // Sample 20% of operations for performance monitoring
      retentionPeriod: 24, // 24 hours
      dashboardUpdateInterval: 30, // 30 seconds
      bottleneckDetectionInterval: 5, // 5 minutes
      regressionCheckInterval: 1, // 1 hour
      alertCooldownPeriod: 10, // 10 minutes
    });

    // Set up performance profiler event handlers
    this.performanceProfiler.on('performanceAlert', (alert: any) => {
      sharedStorageLogger.logWarn('Performance Alert', alert);

      // Send alert through SharedStorageAlerts if available
      if (this.alerts) {
        this.alerts.alertPerformanceIssue(alert).catch(error => {
          sharedStorageLogger.logError('alertPerformanceIssue', error as Error);
        });
      }
    });

    this.performanceProfiler.on('bottlenecksDetected', (bottlenecks: any[]) => {
      sharedStorageLogger.logWarn('Performance Bottlenecks Detected', { count: bottlenecks.length, bottlenecks });

      if (this.alerts) {
        bottlenecks.forEach(bottleneck => {
          this.alerts!.alertBottleneck(bottleneck).catch(error => {
            sharedStorageLogger.logError('alertBottleneck', error as Error);
          });
        });
      }
    });

    this.performanceProfiler.on('regressionsDetected', (regressions: any[]) => {
      sharedStorageLogger.logWarn('Performance Regressions Detected', { count: regressions.length, regressions });

      if (this.alerts) {
        regressions.forEach(regression => {
          this.alerts!.alertPerformanceRegression(regression).catch(error => {
            sharedStorageLogger.logError('alertPerformanceRegression', error as Error);
          });
        });
      }
    });

    this.performanceProfiler.on('dashboardUpdate', (dashboard: any) => {
      // Log summary metrics periodically
      const criticalMetrics = {
        operationCount: Object.keys(dashboard.operations).length,
        systemMemoryUsage: dashboard.systemMetrics.memoryUsage.heapUsed / dashboard.systemMetrics.memoryUsage.heapTotal,
        activeAlerts: dashboard.alerts.activeBottlenecks.length + dashboard.alerts.recentRegressions.length,
      };

      if (criticalMetrics.activeAlerts > 0 || criticalMetrics.systemMemoryUsage > 0.8) {
        sharedStorageLogger.logWarn('Performance Dashboard Summary', criticalMetrics);
      } else {
        sharedStorageLogger.logInfo('Performance Dashboard Update', criticalMetrics);
      }
    });

    sharedStorageLogger.logInfo('Performance profiler initialized');
  }

  /**
   * Initialize memory manager for efficient resource usage
   */
  private initializeMemoryManager(): void {
    this.memoryManager = createMemoryManager({
      redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
      maxHeapSize: 1024 * 1024 * 1024, // 1GB
      memoryPressureThresholds: {
        medium: 0.7,
        high: 0.85,
        critical: 0.95,
      },
      streamChunkSize: 64 * 1024, // 64KB chunks
      maxConcurrentStreams: 10,
      gcInterval: 300, // 5 minutes
      memoryCheckInterval: 60, // 1 minute
      leakDetectionWindow: 6, // 6 hours
      cacheEvictionBatchSize: 100,
      enableCompression: true,
      compressionThreshold: 1024 * 1024, // 1MB
    });

    // Set up memory manager event handlers
    this.memoryManager.on('memoryPressure', (data: any) => {
      sharedStorageLogger.logWarn('Memory pressure detected', data);

      // Send alert through SharedStorageAlerts if available
      if (this.alerts) {
        this.alerts.alertMemoryPressure(data).catch(error => {
          sharedStorageLogger.logError('alertMemoryPressure', error as Error);
        });
      }

      // Trigger cache eviction under high memory pressure
      if (data.level === 'high' || data.level === 'critical') {
        this.triggerCacheEviction().catch(error => {
          sharedStorageLogger.logError('triggerCacheEviction', error as Error);
        });
      }
    });

    this.memoryManager.on('streamCompleted', (session: any) => {
      sharedStorageLogger.logInfo('Stream completed', {
        sessionId: session.sessionId,
        filepath: session.filepath,
        size: session.size,
        processed: session.processed,
        duration: performance.now() - session.startTime,
      });
    });

    this.memoryManager.on('streamError', (data: any) => {
      sharedStorageLogger.logError('Stream error', data.error, data.session.sessionId, data.session.service, data.session.filepath);
    });

    this.memoryManager.on('gcOptimizationComplete', (result: any) => {
      sharedStorageLogger.logInfo('GC optimization completed', {
        memoryFreed: result.memoryFreed,
        timeSpent: result.timeSpent,
        efficiency: result.efficiency,
        recommendations: result.recommendations,
      });
    });

    this.memoryManager.on('idleStreamsCleaned', (count: number) => {
      sharedStorageLogger.logInfo('Idle streams cleaned up', { count });
    });

    sharedStorageLogger.logInfo('Memory manager initialized');
  }

  /**
   * Initialize load tester for performance validation
   */
  private initializeLoadTester(): void {
    this.loadTester = createLoadTester({
      redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
      resultsRetention: 24, // 24 hours
      maxConcurrentOperations: 50,
      enableRealTimeMonitoring: true,
      monitoringInterval: 5, // 5 seconds
      benchmarkHistorySize: 10,
      regressionThreshold: 15, // 15%
      reportFormats: ['json', 'html', 'csv'],
    });

    // Set up load tester event handlers
    this.loadTester.on('testStarted', (data: any) => {
      sharedStorageLogger.logInfo('Load test started', { scenario: data.scenario, executionId: data.executionId });
    });

    this.loadTester.on('testCompleted', (data: any) => {
      sharedStorageLogger.logInfo('Load test completed', {
        scenario: data.result.scenario,
        executionId: data.executionId,
        duration: data.result.duration,
        throughput: data.result.throughput,
        avgLatency: data.result.latency.avg,
        errorRate: data.result.errorRate,
      });
    });

    this.loadTester.on('testFailed', (data: any) => {
      sharedStorageLogger.logError('Load test failed', data.error, undefined, undefined, undefined, data.executionId);
    });

    sharedStorageLogger.logInfo('Load tester initialized');
  }

  /**
   * Initialize resource monitor for system health monitoring
   */
  private initializeResourceMonitor(): void {
    this.resourceMonitor = createResourceMonitor({
      redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
      monitoringInterval: 30, // 30 seconds
      retentionPeriod: 24, // 24 hours
      predictionEnabled: true,
      predictionInterval: 15, // 15 minutes
      alertCooldownPeriod: 5, // 5 minutes
      enableDetailedMetrics: true,
    });

    // Set up resource monitor event handlers
    this.resourceMonitor.on('resourceAlert', (alert: any) => {
      sharedStorageLogger.logWarn('Resource Alert', alert);

      // Send alert through SharedStorageAlerts if available
      if (this.alerts) {
        this.alerts.alertResourceUsage(alert).catch(error => {
          sharedStorageLogger.logError('alertResourceUsage', error as Error);
        });
      }
    });

    this.resourceMonitor.on('metricsCollected', (stats: any) => {
      // Log summary of resource usage periodically
      const criticalResources = [];
      if (stats.cpu.usage > 80) criticalResources.push(`CPU: ${stats.cpu.usage.toFixed(1)}%`);
      if (stats.memory.usage > 85) criticalResources.push(`Memory: ${stats.memory.usage.toFixed(1)}%`);
      if (stats.filesystem.usage > 90) criticalResources.push(`Disk: ${stats.filesystem.usage.toFixed(1)}%`);

      if (criticalResources.length > 0) {
        sharedStorageLogger.logWarn('High Resource Usage Detected', { resources: criticalResources });
      }
    });

    this.resourceMonitor.on('predictionsGenerated', (predictions: any[]) => {
      const criticalPredictions = predictions.filter(p =>
        p.projectedThresholdBreach && p.projectedThresholdBreach.severity === 'critical'
      );

      if (criticalPredictions.length > 0) {
        sharedStorageLogger.logWarn('Critical Resource Usage Predicted', {
          predictions: criticalPredictions.map(p => ({
            resource: p.resourceType,
            timeToBreach: p.projectedThresholdBreach.timeToBreach,
            trend: p.trend,
          })),
        });
      }
    });

    sharedStorageLogger.logInfo('Resource monitor initialized');
  }

  /**
   * Initialize performance monitoring and caching
   */
  private initializePerformanceAndCache(): void {
    // Initialize performance monitoring if alerts are provided
    if (this.alerts) {
      this.performanceMonitor = createSharedStoragePerformance(this.alerts);
    }

    // Initialize caching
    this.cache = createSharedStorageCache({
      maxCacheSize: 50 * 1024 * 1024, // 50MB cache
      cacheTTL: 5 * 60 * 1000, // 5 minutes TTL
      maxMetadataCacheSize: 500 // 500 metadata entries
    });

    sharedStorageLogger.logInfo('Performance monitoring and caching initialized', {
      hasPerformanceMonitor: !!this.performanceMonitor,
      hasCache: !!this.cache,
      hasAlerts: !!this.alerts
    });
  }

  /**
   * Initialize error tracking and retry mechanisms
   */
  private initializeErrorTrackingAndRetry(): void {
    // Initialize error tracking if alerts are provided
    if (this.alerts) {
      this.errorTracker = createSharedStorageErrors(this.alerts);
    }

    // Initialize retry mechanism
    this.retryMechanism = createSharedStorageRetry();

    sharedStorageLogger.logInfo('Error tracking and retry mechanisms initialized', {
      hasErrorTracker: !!this.errorTracker,
      hasRetryMechanism: !!this.retryMechanism,
      hasAlerts: !!this.alerts
    });
  }

  // Private validation methods
  private validateConfig(): void {
    if (!this.config.baseSessionPath) {
      throw new Error('BaseSessionPath is required in SharedStorageService config');
    }

    if (!this.config.serviceMap || Object.keys(this.config.serviceMap).length === 0) {
      throw new Error('ServiceMap is required in SharedStorageService config');
    }
  }

  /**
   * Initialize circuit breaker service for resilience
   */
  private initializeCircuitBreaker(): void {
    this.circuitBreaker = createCircuitBreakerService({
      failureThreshold: 5,
      recoveryTimeout: 30000, // 30 seconds
      monitoringPeriod: 60000, // 1 minute
      successThreshold: 3,
      timeout: 10000, // 10 second operation timeout
      healthCheckInterval: 15000, // 15 seconds
    });

    // Set up circuit breaker event handlers
    this.circuitBreaker.on('circuitOpened', (data) => {
      sharedStorageLogger.logWarn('Circuit breaker opened', {
        operationKey: data.operationKey,
        failureCount: data.breaker.failureCount,
        lastError: data.lastError
      });

      // Send alert if alerts are configured
      if (this.alerts) {
        this.alerts.alertCircuitBreakerOpen(data.operationKey, data.breaker.failureCount);
      }
    });

    this.circuitBreaker.on('circuitClosed', (data) => {
      sharedStorageLogger.logInfo('Circuit breaker closed', {
        operationKey: data.operationKey
      });

      if (this.alerts) {
        this.alerts.alertCircuitBreakerClosed(data.operationKey);
      }
    });

    this.circuitBreaker.on('circuitRecoveryAttempt', (data) => {
      sharedStorageLogger.logInfo('Circuit breaker recovery attempt', {
        operationKey: data.operationKey
      });
    });

    sharedStorageLogger.logInfo('Circuit breaker service initialized');
  }

  /**
   * Initialize error correlation service for distributed tracing and root cause analysis
   */
  private initializeErrorCorrelation(): void {
    this.errorCorrelation = new ErrorCorrelationService();

    // Set up error correlation event handlers
    this.errorCorrelation.on('errorRecorded', (data) => {
      sharedStorageLogger.logInfo('Error recorded in trace', {
        traceId: data.traceId,
        spanId: data.spanId,
        service: data.service,
        error: data.error,
        event: 'error_recorded_in_trace'
      });
    });

    this.errorCorrelation.on('correlationCompleted', (data) => {
      sharedStorageLogger.logInfo('Error correlation completed', {
        correlationId: data.correlationId,
        errorCount: data.errorCount,
        correlationsFound: data.correlationsFound,
        severity: data.severity,
        event: 'correlation_completed'
      });
    });

    this.errorCorrelation.on('incidentCreated', (incident) => {
      sharedStorageLogger.logInfo('Incident created from correlations', {
        incidentId: incident.incidentId,
        title: incident.title,
        severity: incident.severity,
        affectedServices: incident.affectedServices.length,
        event: 'incident_created'
      });

      // Send alert if alerts are configured
      if (this.alerts) {
        this.alerts.alertIncidentCreated(incident.incidentId, incident.title, incident.severity);
      }
    });

    sharedStorageLogger.logInfo('Error correlation service initialized');
  }

  /**
   * Initialize fallback service for graceful degradation
   */
  private initializeFallbackService(): void {
    this.fallbackService = new FallbackService();

    // Set up fallback service event handlers
    this.fallbackService.on('fallbackTriggered', (data) => {
      sharedStorageLogger.logInfo('Fallback strategy triggered', {
        operationId: data.operationId,
        operationType: data.operationType,
        level: data.level,
        strategy: data.strategy,
        reason: data.reason,
        event: 'fallback_triggered'
      });
    });

    this.fallbackService.on('fallbackSucceeded', (data) => {
      sharedStorageLogger.logInfo('Fallback strategy succeeded', {
        operationId: data.operationId,
        operationType: data.operationType,
        level: data.level,
        strategy: data.strategy,
        duration: data.duration,
        event: 'fallback_succeeded'
      });
    });

    this.fallbackService.on('fallbackFailed', (data) => {
      sharedStorageLogger.logInfo('All fallback strategies failed', {
        operationId: data.operationId,
        operationType: data.operationType,
        lastLevel: data.lastLevel,
        finalError: data.finalError,
        event: 'fallback_failed'
      });
    });

    sharedStorageLogger.logInfo('Fallback service initialized');
  }

  private validateSessionId(sessionId: string): void {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new SharedStorageServiceError(
        SHARED_STORAGE_ERRORS.INVALID_SESSION_ID,
        'Session ID must be a non-empty string'
      );
    }

    // UUID validation pattern
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(sessionId)) {
      throw new SharedStorageServiceError(
        SHARED_STORAGE_ERRORS.INVALID_SESSION_ID,
        `Invalid session ID format: ${sessionId}`
      );
    }
  }

  private validateServiceName(service: string): void {
    if (!service || typeof service !== 'string') {
      throw new SharedStorageServiceError(
        SHARED_STORAGE_ERRORS.INVALID_SERVICE_NAME,
        'Service name must be a non-empty string'
      );
    }

    // Service name pattern validation (alphanumeric, hyphens, underscores)
    const servicePattern = /^[a-zA-Z0-9_-]+$/;
    if (!servicePattern.test(service)) {
      throw new SharedStorageServiceError(
        SHARED_STORAGE_ERRORS.INVALID_SERVICE_NAME,
        `Invalid service name format: ${service}`
      );
    }
  }

  private validateFilePath(filepath: string): void {
    if (!filepath || typeof filepath !== 'string') {
      throw new SharedStorageServiceError(
        SHARED_STORAGE_ERRORS.FILE_ACCESS_ERROR,
        'Filepath must be a non-empty string'
      );
    }

    // Prevent path traversal attempts
    if (filepath.includes('..') || filepath.startsWith('/') || filepath.includes('\0')) {
      sharedStorageLogger.logSecurityEvent('path_traversal_attempt', {
        filepath,
        reason: 'path_traversal_detected',
        indicators: {
          containsDots: filepath.includes('..'),
          startsWithSlash: filepath.startsWith('/'),
          containsNull: filepath.includes('\0')
        }
      });

      throw new SharedStorageServiceError(
        SHARED_STORAGE_ERRORS.PATH_TRAVERSAL_DETECTED,
        `Invalid filepath: ${filepath}`
      );
    }
  }

  private logPerformance(operation: string, startTime: number, sessionId?: string, service?: string): void {
    const duration = performance.now() - startTime;
    if (duration > this.performanceThreshold) {
      this.logger.warn(`SharedStorageService.${operation} exceeded performance threshold: ${duration.toFixed(2)}ms`, {
        operation,
        duration,
        sessionId,
        service,
        threshold: this.performanceThreshold,
      });
    } else {
      this.logger.debug(`SharedStorageService.${operation} completed in ${duration.toFixed(2)}ms`, {
        operation,
        duration,
        sessionId,
        service,
      });
    }
  }

  private logError(operation: string, error: unknown, sessionId?: string, service?: string, filepath?: string): void {
    this.logger.error(`SharedStorageService.${operation} error:`, {
      operation,
      error: error instanceof Error ? error.message : String(error),
      sessionId,
      service,
      filepath,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get connection pool statistics for monitoring
   */
  getConnectionPoolStats() {
    return this.connectionPool.getStats();
  }

  /**
   * Get metadata cache statistics for monitoring
   */
  async getMetadataCacheStats() {
    return await this.metadataCache.getStats();
  }

  /**
   * Invalidate cache for specific file or entire session
   */
  async invalidateCache(sessionId: string, filepath?: string): Promise<void> {
    await this.metadataCache.invalidate(sessionId, filepath);
  }

  /**
   * Warm cache with frequently accessed files
   */
  async warmCache(sessionId: string, patterns?: string[], maxFiles?: number): Promise<void> {
    await this.metadataCache.warmCache({
      sessionId,
      patterns,
      priority: 'medium',
      maxFiles,
    });
  }

  /**
   * Preload intelligent cache with predicted access patterns
   */
  async preloadIntelligentCache(sessionId: string, patterns?: string[]): Promise<void> {
    await this.intelligentCache.preloadCache(sessionId, patterns);
  }

  /**
   * Get intelligent cache statistics
   */
  async getIntelligentCacheStats(): Promise<any> {
    return await this.intelligentCache.getCacheStats();
  }

  /**
   * Validate cache consistency for a specific file
   */
  async validateCacheConsistency(sessionId: string, filepath: string): Promise<boolean> {
    return await this.intelligentCache.validateCacheConsistency(sessionId, filepath);
  }

  /**
   * Invalidate intelligent cache for specific file or entire session
   */
  async invalidateIntelligentCache(sessionId: string, filepath?: string): Promise<void> {
    if (filepath) {
      await this.intelligentCache.invalidateFile(sessionId, filepath);
    } else {
      // For session-wide invalidation, we need to get all cached files and invalidate them
      const stats = await this.intelligentCache.getCacheStats();
      // This would need to be implemented based on the cache stats
      sharedStorageLogger.logInfo('Session-wide intelligent cache invalidation requested', { sessionId });
    }
  }

  /**
   * Get performance statistics for monitoring and debugging
   */
  getPerformanceStats(operation?: string, service?: string): any {
    if (operation && service) {
      return this.performanceProfiler.getOperationStats(operation, service);
    }
    return this.performanceProfiler.getAllStats();
  }

  /**
   * Get real-time performance dashboard data
   */
  async getPerformanceDashboard(): Promise<any> {
    return await this.performanceProfiler.getDashboardData();
  }

  /**
   * Manually trigger bottleneck detection
   */
  async checkForBottlenecks(): Promise<any[]> {
    return await this.performanceProfiler.detectBottlenecks();
  }

  /**
   * Manually check for performance regressions
   */
  async checkForRegressions(): Promise<any[]> {
    return await this.performanceProfiler.checkPerformanceRegressions();
  }

  /**
   * Clear old performance data
   */
  async clearOldPerformanceData(): Promise<void> {
    await this.performanceProfiler.clearOldData();
  }

  /**
   * Get current performance thresholds
   */
  getPerformanceThresholds(): any {
    return (this.performanceProfiler as any).config.thresholds;
  }

  /**
   * Get comprehensive memory statistics
   */
  async getMemoryStats(): Promise<any> {
    return await this.memoryManager.getMemoryStats();
  }

  /**
   * Get memory usage trends
   */
  getMemoryTrends(hours: number = 24): any[] {
    return this.memoryManager.getMemoryTrends(hours);
  }

  /**
   * Detect memory leaks
   */
  async detectMemoryLeaks(): Promise<any> {
    return await this.memoryManager.detectMemoryLeaks();
  }

  /**
   * Get active stream sessions
   */
  getActiveStreams(): any[] {
    return this.memoryManager.getActiveStreams();
  }

  /**
   * Create memory-efficient read stream for large files
   */
  async createEfficientReadStream(sessionId: string, filepath: string, service: string, options?: any): Promise<any> {
    return await this.memoryManager.createReadStream(sessionId, filepath, service, options);
  }

  /**
   * Create memory-efficient write stream for large files
   */
  async createEfficientWriteStream(sessionId: string, filepath: string, service: string, options?: any): Promise<any> {
    return await this.memoryManager.createWriteStream(sessionId, filepath, service, options);
  }

  /**
   * Trigger garbage collection optimization
   */
  async optimizeGarbageCollection(): Promise<any> {
    return await this.memoryManager['optimizeGarbageCollection']();
  }

  /**
   * Trigger cache eviction to reduce memory pressure
   */
  private async triggerCacheEviction(): Promise<void> {
    // Evict entries from intelligent cache first
    await this.intelligentCache.invalidateFile('all_sessions', 'all_files');

    // Clear old metadata cache entries
    await this.metadataCache.invalidate('all_sessions', 'all_files');

    sharedStorageLogger.logInfo('Cache eviction completed for memory pressure relief');
  }

  /**
   * Cleanup idle resources
   */
  async cleanupIdleResources(maxIdleTime: number = 300000): Promise<number> {
    const streamsCleaned = await this.memoryManager.cleanupIdleStreams(maxIdleTime);
    return streamsCleaned;
  }

  /**
   * Run a load test scenario
   */
  async runLoadTest(scenario: any): Promise<any> {
    return await this.loadTester.executeLoadTest(scenario);
  }

  /**
   * Get load test history for a scenario
   */
  getLoadTestHistory(scenarioName: string): any[] {
    return this.loadTester.getTestHistory(scenarioName);
  }

  /**
   * Get active load tests
   */
  getActiveLoadTests(): string[] {
    return this.loadTester.getActiveTests();
  }

  /**
   * Cancel a running load test
   */
  async cancelLoadTest(executionId: string): Promise<void> {
    await this.loadTester.cancelTest(executionId);
  }

  /**
   * Generate performance comparison report
   */
  async generatePerformanceComparison(scenarioName: string): Promise<any> {
    return await this.loadTester.generateComparisonReport(scenarioName);
  }

  /**
   * Check for performance regressions
   */
  async checkPerformanceRegressions(scenarioName: string): Promise<any[]> {
    return await this.loadTester.checkPerformanceRegressions(scenarioName);
  }

  /**
   * Get comprehensive performance report
   */
  async getPerformanceReport(): Promise<any> {
    const [memoryStats, performanceDashboard, leakAnalysis] = await Promise.all([
      this.getMemoryStats(),
      this.getPerformanceDashboard(),
      this.detectMemoryLeaks(),
    ]);

    return {
      timestamp: Date.now(),
      memory: memoryStats,
      performance: performanceDashboard,
      leaks: leakAnalysis,
      activeTests: this.getActiveLoadTests(),
      recommendations: this.generatePerformanceRecommendations(performanceDashboard, leakAnalysis),
    };
  }

  /**
   * Generate performance recommendations
   */
  private generatePerformanceRecommendations(dashboard: any, leakAnalysis: any): string[] {
    const recommendations: string[] = [];

    // Memory recommendations
    if (leakAnalysis.detected) {
      recommendations.push(`Memory leak detected: ${leakAnalysis.description}`);
      recommendations.push(...leakAnalysis.recommendations);
    }

    // Performance recommendations
    if (dashboard.operations) {
      for (const [operationKey, operationData] of Object.entries(dashboard.operations)) {
        const op = operationData as any;
        if (op.avgDuration > 100) {
          recommendations.push(`High latency in ${operationKey}: ${op.avgDuration.toFixed(2)}ms - consider optimization`);
        }
        if (op.errorRate > 0.05) {
          recommendations.push(`High error rate in ${operationKey}: ${(op.errorRate * 100).toFixed(1)}% - investigate errors`);
        }
      }
    }

    // Bottleneck recommendations
    if (dashboard.alerts?.activeBottlenecks?.length > 0) {
      recommendations.push('Active performance bottlenecks detected - review system resources');
    }

    return recommendations;
  }

  /**
   * Run automated performance validation
   */
  async validatePerformanceRequirements(): Promise<any> {
    const report = await this.getPerformanceReport();
    const validations: any[] = [];

    // Validate <100ms requirement
    const criticalOperations = Object.entries(report.performance.operations || {}).filter(([_, op]: [string, any]) => {
      return op.avgDuration > 100;
    });

    validations.push({
      requirement: '<100ms average latency',
      passed: criticalOperations.length === 0,
      details: criticalOperations.length > 0
        ? `Found ${criticalOperations.length} operations exceeding 100ms`
        : 'All operations meet latency requirement',
      violations: criticalOperations.map(([key, op]: [string, any]) => ({
        operation: key,
        latency: op.avgDuration,
        deviation: ((op.avgDuration - 100) / 100 * 100).toFixed(1) + '%',
      })),
    });

    // Validate error rate
    const highErrorOperations = Object.entries(report.performance.operations || {}).filter(([_, op]: [string, any]) => {
      return op.errorRate > 0.05;
    });

    validations.push({
      requirement: '<5% error rate',
      passed: highErrorOperations.length === 0,
      details: highErrorOperations.length > 0
        ? `Found ${highErrorOperations.length} operations with high error rates`
        : 'All operations meet error rate requirement',
      violations: highErrorOperations.map(([key, op]: [string, any]) => ({
        operation: key,
        errorRate: (op.errorRate * 100).toFixed(1) + '%',
      })),
    });

    // Validate memory usage
    validations.push({
      requirement: '<85% memory usage',
      passed: report.memory.pressureLevel !== 'critical',
      details: report.memory.pressureLevel === 'critical'
        ? 'Memory usage is critical'
        : `Memory pressure: ${report.memory.pressureLevel}`,
      currentUsage: (report.memory.heapUsed / (1024 * 1024 * 1024)).toFixed(2) + 'GB',
    });

    // Overall assessment
    const passedValidations = validations.filter(v => v.passed).length;
    const totalValidations = validations.length;

    return {
      timestamp: Date.now(),
      overall: {
        passed: passedValidations === totalValidations,
        score: (passedValidations / totalValidations * 100).toFixed(1) + '%',
        summary: `${passedValidations}/${totalValidations} requirements met`,
      },
      validations,
      report,
    };
  }

  /**
   * Get current resource usage statistics
   */
  async getResourceStats(): Promise<any> {
    return await this.resourceMonitor.getCurrentStats();
  }

  /**
   * Get resource usage history for a specific resource type
   */
  getResourceHistory(resourceType: string, hours: number = 24): any[] {
    // Map string to ResourceType enum
    const resourceTypeMap: { [key: string]: any } = {
      'cpu': require('./resource-monitor').ResourceType.CPU,
      'memory': require('./resource-monitor').ResourceType.MEMORY,
      'disk_io': require('./resource-monitor').ResourceType.DISK_IO,
      'network_io': require('./resource-monitor').ResourceType.NETWORK_IO,
      'filesystem': require('./resource-monitor').ResourceType.FILESYSTEM,
      'cache': require('./resource-monitor').ResourceType.CACHE,
      'database': require('./resource-monitor').ResourceType.DATABASE,
    };

    const mappedType = resourceTypeMap[resourceType.toLowerCase()];
    if (!mappedType) {
      throw new Error(`Unknown resource type: ${resourceType}`);
    }

    return this.resourceMonitor.getResourceHistory(mappedType, hours);
  }

  /**
   * Get active resource alerts
   */
  getActiveResourceAlerts(): any[] {
    return this.resourceMonitor.getActiveAlerts();
  }

  /**
   * Get resource usage predictions
   */
  async getResourcePredictions(): Promise<any[]> {
    return await this.resourceMonitor.getPredictions();
  }

  /**
   * Get resource optimization recommendations
   */
  async getResourceOptimizationRecommendations(): Promise<any[]> {
    return await this.resourceMonitor.getOptimizationRecommendations();
  }

  /**
   * Get comprehensive resource dashboard data
   */
  async getResourceDashboard(): Promise<any> {
    return await this.resourceMonitor.getDashboardData();
  }

  /**
   * Get combined system health report
   */
  async getSystemHealthReport(): Promise<any> {
    const [resourceStats, performanceReport, memoryStats, loadTestHistory] = await Promise.all([
      this.getResourceStats(),
      this.getPerformanceReport(),
      this.getMemoryStats(),
      Promise.resolve(this.getLoadTestHistory('performance-validation')),
    ]);

    // Calculate overall system health score
    let healthScore = 100;

    // Resource usage impact
    if (resourceStats.cpu.usage > 80) healthScore -= 15;
    if (resourceStats.memory.usage > 85) healthScore -= 20;
    if (resourceStats.filesystem.usage > 90) healthScore -= 25;

    // Performance impact
    if (performanceReport.memory.pressureLevel === 'critical') healthScore -= 20;
    const criticalOperations = Object.values(performanceReport.performance.operations || {}).filter((op: any) => op.avgDuration > 100);
    healthScore -= criticalOperations.length * 5;

    // Recent load test impact
    const recentTests = loadTestHistory.slice(-5);
    const failedTests = recentTests.filter((test: any) => test.errorRate > 0.05);
    healthScore -= failedTests.length * 10;

    // Active alerts impact
    const activeAlerts = this.getActiveResourceAlerts();
    healthScore -= activeAlerts.length * 10;

    return {
      timestamp: Date.now(),
      overallHealth: {
        score: Math.max(0, healthScore),
        status: healthScore > 80 ? 'healthy' : healthScore > 60 ? 'warning' : 'critical',
        trend: this.calculateHealthTrend(),
      },
      resources: resourceStats,
      performance: performanceReport,
      memory: memoryStats,
      recentLoadTests: recentTests.slice(-3),
      activeAlerts: activeAlerts,
      recommendations: [
        ...performanceReport.recommendations,
        ...await this.getResourceOptimizationRecommendations(),
      ],
    };
  }

  /**
   * Calculate health trend based on recent data
   */
  private calculateHealthTrend(): 'improving' | 'degrading' | 'stable' {
    // Simplified trend calculation - in production this would use historical data
    return 'stable';
  }

  /**
   * Trigger manual resource optimization
   */
  async optimizeResources(): Promise<any> {
    const recommendations = await this.getResourceOptimizationRecommendations();
    const optimizations: any[] = [];

    // Execute automated optimizations
    for (const rec of recommendations) {
      if (rec.automated) {
        try {
          switch (rec.resourceType) {
            case 'memory':
              await this.optimizeGarbageCollection();
              optimizations.push({
                resourceType: rec.resourceType,
                action: 'Garbage collection optimized',
                success: true,
              });
              break;
            case 'cache':
              await this.triggerCacheEviction();
              optimizations.push({
                resourceType: rec.resourceType,
                action: 'Cache eviction triggered',
                success: true,
              });
              break;
            case 'filesystem':
              await this.cleanupIdleResources();
              optimizations.push({
                resourceType: rec.resourceType,
                action: 'Idle resources cleaned up',
                success: true,
              });
              break;
          }
        } catch (error) {
          optimizations.push({
            resourceType: rec.resourceType,
            action: rec.recommendation,
            success: false,
            error: (error as Error).message,
          });
        }
      }
    }

    return {
      timestamp: Date.now(),
      optimizations,
      manualRecommendations: recommendations.filter(r => !r.automated),
    };
  }

  /**
   * Get resource usage thresholds
   */
  getResourceThresholds(): any {
    return (this.resourceMonitor as any).config.thresholds;
  }

  /**
   * Update resource usage thresholds
   */
  updateResourceThresholds(updates: any): void {
    const config = (this.resourceMonitor as any).config;
    config.thresholds = { ...config.thresholds, ...updates };
    sharedStorageLogger.logInfo('Resource thresholds updated', { updates });
  }

  /**
   * Get circuit breaker status for all operations
   */
  getCircuitBreakerStatus(): Record<string, any> {
    return this.circuitBreaker.getAllBreakerStatuses();
  }

  /**
   * Get circuit breaker metrics for monitoring
   */
  getCircuitBreakerMetrics(operationKey?: string): any {
    return this.circuitBreaker.getBreakerMetrics(operationKey);
  }

  /**
   * Manually reset a circuit breaker
   */
  resetCircuitBreaker(operationKey: string): boolean {
    return this.circuitBreaker.resetBreaker(operationKey);
  }

  /**
   * Force a circuit breaker open (for testing)
   */
  forceCircuitBreakerOpen(operationKey: string): boolean {
    return this.circuitBreaker.forceOpen(operationKey);
  }

  /**
   * Configure circuit breaker settings
   */
  configureCircuitBreaker(operationKey: string, config: any): void {
    this.circuitBreaker.configureBreaker(operationKey, config);
  }

  /**
   * Get comprehensive resilience report
   */
  async getResilienceReport(): Promise<any> {
    const circuitBreakerMetrics = this.circuitBreaker.getBreakerMetrics();
    const errorStats = this.errorTracker?.getErrorStats() || {};
    const retryStats = this.retryMechanism?.getRetryStats() || {};

    return {
      timestamp: new Date().toISOString(),
      circuitBreakers: circuitBreakerMetrics,
      errorTracking: errorStats,
      retryMechanism: retryStats,
      overallHealth: this.calculateResilienceHealth(circuitBreakerMetrics, errorStats, retryStats)
    };
  }

  /**
   * Calculate overall resilience health score
   */
  private calculateResilienceHealth(
    circuitBreakerMetrics: any,
    errorStats: any,
    retryStats: any
  ): any {
    let healthScore = 100;

    // Circuit breaker health impact
    if (circuitBreakerMetrics.healthScore !== undefined) {
      healthScore -= (100 - circuitBreakerMetrics.healthScore) * 0.3;
    }

    // Error rate impact
    if (errorStats.recoveryRate !== undefined) {
      const errorImpact = (1 - errorStats.recoveryRate) * 20;
      healthScore -= errorImpact;
    }

    // Retry success impact
    if (retryStats.successfulRetries !== undefined && retryStats.totalRetries !== undefined) {
      const retrySuccessRate = retryStats.totalRetries > 0
        ? (retryStats.successfulRetries / retryStats.totalRetries) * 100
        : 100;
      const retryImpact = (100 - retrySuccessRate) * 0.2;
      healthScore -= retryImpact;
    }

    const clampedScore = Math.max(0, Math.min(100, healthScore));

    return {
      score: Math.round(clampedScore),
      status: clampedScore > 80 ? 'healthy' :
              clampedScore > 60 ? 'degraded' :
              clampedScore > 30 ? 'unhealthy' : 'critical',
      factors: {
        circuitBreakerHealth: circuitBreakerMetrics.healthScore || 100,
        errorRecoveryRate: errorStats.recoveryRate || 1,
        retrySuccessRate: retryStats.totalRetries > 0
          ? (retryStats.successfulRetries / retryStats.totalRetries)
          : 1
      }
    };
  }

  /**
   * Cleanup resources when service is being destroyed
   */
  async cleanup(): Promise<void> {
    try {
      this.circuitBreaker.cleanup();
      this.errorCorrelation.cleanup();
      this.fallbackService.cleanup();
      await Promise.all([
        this.connectionPool.close(),
        this.metadataCache.close(),
        this.intelligentCache.close(),
        this.performanceProfiler.close(),
        this.memoryManager.close(),
        this.loadTester.close(),
        this.resourceMonitor.close(),
      ]);
      sharedStorageLogger.logInfo('SharedStorageService cleanup completed');
    } catch (error) {
      sharedStorageLogger.logError('cleanup', error as Error);
    }
  }
}

/**
 * Factory function to create SharedStorageService with default configuration
 */
  export function createSharedStorageService(
    baseSessionPath: string,
    logger?: Console
  ): SharedStorageService {
    const config: SessionPathConfig = {
      baseSessionPath,
      serviceMap: {
        'file-processor': {
          name: 'file-processor',
          permissions: {
            canRead: true,
            canWrite: true,
            allowedSubPaths: ['*'],
          },
        },
        'llm-orchestrator': {
          name: 'llm-orchestrator',
          permissions: {
            canRead: true,
            canWrite: false,
            allowedSubPaths: ['converted_images', 'metadata'],
          },
        },
      },
    };

    return new SharedStorageService(config, logger);
  }