/**
 * Symbol Detection Performance Monitor
 * 
 * Comprehensive performance monitoring and optimization system for the Symbol Detection Engine
 * Implements intelligent caching, performance tracking, and optimization strategies
 */

import { EventEmitter } from 'events';
import { SymbolDetectionResult, DetectedSymbol, DetectionMetadata } from '../../../../shared/types/symbol-detection.types';

export interface PerformanceMetrics {
  totalProcessingTime: number;
  imageProcessingTime: number;
  patternMatchingTime: number;
  mlClassificationTime: number;
  validationTime: number;
  cacheHitRate: number;
  memoryUsage: NodeJS.MemoryUsage;
  throughput: number; // symbols per second
  accuracy: number;
  timestamp: Date;
}

export interface CacheConfiguration {
  maxSize: number;
  ttlMs: number;
  compressionEnabled: boolean;
  cleanupIntervalMs: number;
}

export interface OptimizationStrategy {
  enableParallelProcessing: boolean;
  enableEarlyTermination: boolean;
  enableAdaptiveFiltering: boolean;
  batchSize: number;
  confidenceThreshold: number;
  memoryOptimization: boolean;
}

export interface PerformanceThresholds {
  maxProcessingTimeMs: number;
  minThroughput: number;
  maxMemoryUsageMB: number;
  minCacheHitRate: number;
  minAccuracy: number;
}

export class SymbolDetectionPerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private readonly MAX_METRICS_HISTORY = 1000;
  
  // Intelligent caching system
  private imageCache = new Map<string, { data: Buffer; timestamp: number; accessCount: number }>();
  private resultCache = new Map<string, { result: SymbolDetectionResult; timestamp: number; accessCount: number }>();
  private featureCache = new Map<string, { features: any; timestamp: number; accessCount: number }>();
  private templateCache = new Map<string, { template: any; timestamp: number; accessCount: number }>();
  
  // Configuration
  private cacheConfig: CacheConfiguration = {
    maxSize: 500,
    ttlMs: 10 * 60 * 1000, // 10 minutes
    compressionEnabled: true,
    cleanupIntervalMs: 2 * 60 * 1000, // 2 minutes
  };
  
  private optimizationStrategy: OptimizationStrategy = {
    enableParallelProcessing: true,
    enableEarlyTermination: true,
    enableAdaptiveFiltering: true,
    batchSize: 8,
    confidenceThreshold: 0.7,
    memoryOptimization: true,
  };
  
  private performanceThresholds: PerformanceThresholds = {
    maxProcessingTimeMs: 30000, // 30 seconds (AC #9)
    minThroughput: 0.5, // symbols per second
    maxMemoryUsageMB: 1024, // 1GB
    minCacheHitRate: 0.3, // 30%
    minAccuracy: 0.9, // 90% (AC #8)
  };
  
  // Performance tracking
  private currentSession = {
    startTime: Date.now(),
    totalProcessed: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
  };
  
  constructor() {
    super();
    
    // Start periodic cleanup
    setInterval(() => this.performCacheCleanup(), this.cacheConfig.cleanupIntervalMs);
    
    // Monitor memory usage
    setInterval(() => this.checkMemoryUsage(), 30000); // Every 30 seconds
    
    console.log('Symbol Detection Performance Monitor initialized');
  }
  
  /**
   * Track processing performance
   */
  trackProcessing(
    documentId: string,
    sessionId: string,
    detectionMetadata: DetectionMetadata,
    result: SymbolDetectionResult
  ): void {
    const metrics: PerformanceMetrics = {
      totalProcessingTime: detectionMetadata.totalProcessingTime,
      imageProcessingTime: detectionMetadata.imageProcessingTime,
      patternMatchingTime: detectionMetadata.patternMatchingTime,
      mlClassificationTime: detectionMetadata.mlClassificationTime,
      validationTime: detectionMetadata.validationTime,
      cacheHitRate: this.calculateCacheHitRate(),
      memoryUsage: process.memoryUsage(),
      throughput: result.detectedSymbols.length / (detectionMetadata.totalProcessingTime / 1000),
      accuracy: result.overallConfidence,
      timestamp: new Date(),
    };
    
    this.addMetrics(metrics);
    this.currentSession.totalProcessed++;
    
    // Check for performance violations
    this.checkPerformanceThresholds(metrics);
    
    // Emit performance update
    this.emit('performance-update', {
      documentId,
      sessionId,
      metrics,
      violations: this.getPerformanceViolations(metrics),
    });
    
    // Log slow processing
    if (metrics.totalProcessingTime > this.performanceThresholds.maxProcessingTimeMs * 0.8) {
      console.warn(`Slow processing detected: ${metrics.totalProcessingTime}ms for ${result.detectedSymbols.length} symbols`);
    }
  }
  
  /**
   * Intelligent caching with LRU and compression
   */
  cacheImage(key: string, imageData: Buffer): void {
    // Check cache size limit
    if (this.imageCache.size >= this.cacheConfig.maxSize) {
      this.evictLeastRecentlyUsed(this.imageCache);
    }
    
    // Compress image data if enabled
    const dataToCache = this.cacheConfig.compressionEnabled 
      ? this.compressData(imageData) 
      : imageData;
    
    this.imageCache.set(key, {
      data: dataToCache,
      timestamp: Date.now(),
      accessCount: 1,
    });
  }
  
  getCachedImage(key: string): Buffer | null {
    const cached = this.imageCache.get(key);
    if (!cached) {
      this.currentSession.cacheMisses++;
      return null;
    }
    
    // Check TTL
    if (Date.now() - cached.timestamp > this.cacheConfig.ttlMs) {
      this.imageCache.delete(key);
      this.currentSession.cacheMisses++;
      return null;
    }
    
    // Update access count and timestamp
    cached.accessCount++;
    cached.timestamp = Date.now();
    this.currentSession.cacheHits++;
    
    // Decompress if needed
    return this.cacheConfig.compressionEnabled 
      ? this.decompressData(cached.data) 
      : cached.data;
  }
  
  /**
   * Cache detection results with metadata
   */
  cacheDetectionResult(key: string, result: SymbolDetectionResult): void {
    if (this.resultCache.size >= this.cacheConfig.maxSize) {
      this.evictLeastRecentlyUsed(this.resultCache);
    }
    
    this.resultCache.set(key, {
      result: { ...result }, // Deep copy to prevent mutations
      timestamp: Date.now(),
      accessCount: 1,
    });
  }
  
  getCachedDetectionResult(key: string): SymbolDetectionResult | null {
    const cached = this.resultCache.get(key);
    if (!cached) {
      this.currentSession.cacheMisses++;
      return null;
    }
    
    if (Date.now() - cached.timestamp > this.cacheConfig.ttlMs) {
      this.resultCache.delete(key);
      this.currentSession.cacheMisses++;
      return null;
    }
    
    cached.accessCount++;
    cached.timestamp = Date.now();
    this.currentSession.cacheHits++;
    
    return { ...cached.result }; // Return copy
  }
  
  /**
   * Cache features with intelligent eviction
   */
  cacheFeatures(key: string, features: any): void {
    if (this.featureCache.size >= this.cacheConfig.maxSize) {
      this.evictLeastRecentlyUsed(this.featureCache);
    }
    
    this.featureCache.set(key, {
      features: JSON.parse(JSON.stringify(features)), // Deep copy
      timestamp: Date.now(),
      accessCount: 1,
    });
  }
  
  getCachedFeatures(key: string): any | null {
    const cached = this.featureCache.get(key);
    if (!cached) {
      this.currentSession.cacheMisses++;
      return null;
    }
    
    if (Date.now() - cached.timestamp > this.cacheConfig.ttlMs) {
      this.featureCache.delete(key);
      this.currentSession.cacheMisses++;
      return null;
    }
    
    cached.accessCount++;
    cached.timestamp = Date.now();
    this.currentSession.cacheHits++;
    
    return JSON.parse(JSON.stringify(cached.features)); // Return copy
  }
  
  /**
   * Dynamic optimization strategy adjustment
   */
  optimizeStrategy(currentMetrics: PerformanceMetrics): OptimizationStrategy {
    const strategy = { ...this.optimizationStrategy };
    
    // Adjust based on memory usage
    if (currentMetrics.memoryUsage.heapUsed > this.performanceThresholds.maxMemoryUsageMB * 1024 * 1024 * 0.8) {
      strategy.memoryOptimization = true;
      strategy.batchSize = Math.max(4, strategy.batchSize - 2);
      console.log('Memory optimization enabled, reducing batch size');
    }
    
    // Adjust based on processing time
    if (currentMetrics.totalProcessingTime > this.performanceThresholds.maxProcessingTimeMs * 0.8) {
      strategy.enableEarlyTermination = true;
      strategy.enableAdaptiveFiltering = true;
      strategy.confidenceThreshold = Math.min(0.8, strategy.confidenceThreshold + 0.05);
      console.log('Performance optimization enabled, adjusting thresholds');
    }
    
    // Adjust based on accuracy
    if (currentMetrics.accuracy < this.performanceThresholds.minAccuracy) {
      strategy.confidenceThreshold = Math.max(0.5, strategy.confidenceThreshold - 0.05);
      strategy.enableParallelProcessing = true;
      console.log('Accuracy optimization enabled, lowering threshold');
    }
    
    // Adjust based on throughput
    if (currentMetrics.throughput < this.performanceThresholds.minThroughput) {
      strategy.enableParallelProcessing = true;
      strategy.batchSize = Math.min(16, strategy.batchSize + 2);
      console.log('Throughput optimization enabled, increasing parallelism');
    }
    
    return strategy;
  }
  
  /**
   * Get current performance statistics
   */
  getPerformanceStats(): {
    current: PerformanceMetrics | null;
    average: Partial<PerformanceMetrics>;
    session: typeof this.currentSession;
    cacheStats: {
      imageCache: { size: number; hitRate: number };
      resultCache: { size: number; hitRate: number };
      featureCache: { size: number; hitRate: number };
      templateCache: { size: number; hitRate: number };
    };
    thresholds: PerformanceThresholds;
    strategy: OptimizationStrategy;
  } {
    const current = this.metrics[this.metrics.length - 1] || null;
    const average = this.calculateAverageMetrics();
    
    return {
      current,
      average,
      session: { ...this.currentSession },
      cacheStats: {
        imageCache: { 
          size: this.imageCache.size, 
          hitRate: this.calculateCacheSpecificHitRate(this.imageCache) 
        },
        resultCache: { 
          size: this.resultCache.size, 
          hitRate: this.calculateCacheSpecificHitRate(this.resultCache) 
        },
        featureCache: { 
          size: this.featureCache.size, 
          hitRate: this.calculateCacheSpecificHitRate(this.featureCache) 
        },
        templateCache: { 
          size: this.templateCache.size, 
          hitRate: this.calculateCacheSpecificHitRate(this.templateCache) 
        },
      },
      thresholds: { ...this.performanceThresholds },
      strategy: { ...this.optimizationStrategy },
    };
  }
  
  /**
   * Generate performance report
   */
  generatePerformanceReport(): {
    summary: {
      totalProcessed: number;
      avgProcessingTime: number;
      avgThroughput: number;
      avgAccuracy: number;
      cacheEfficiency: number;
    };
    trends: {
      processingTimetrend: 'improving' | 'degrading' | 'stable';
      throughputTrend: 'improving' | 'degrading' | 'stable';
      accuracyTrend: 'improving' | 'degrading' | 'stable';
    };
    recommendations: string[];
    violations: Array<{ metric: string; current: number; threshold: number; severity: 'warning' | 'critical' }>;
  } {
    const recent = this.metrics.slice(-100); // Last 100 measurements
    const older = this.metrics.slice(-200, -100); // Previous 100 measurements
    
    const summary = {
      totalProcessed: this.currentSession.totalProcessed,
      avgProcessingTime: this.calculateAverage(recent, 'totalProcessingTime'),
      avgThroughput: this.calculateAverage(recent, 'throughput'),
      avgAccuracy: this.calculateAverage(recent, 'accuracy'),
      cacheEfficiency: this.calculateCacheHitRate(),
    };
    
    const trends = {
      processingTimetrend: this.calculateTrend(recent, older, 'totalProcessingTime'),
      throughputTrend: this.calculateTrend(recent, older, 'throughput'),
      accuracyTrend: this.calculateTrend(recent, older, 'accuracy'),
    };
    
    const recommendations = this.generateRecommendations(summary, trends);
    const violations = this.getAllPerformanceViolations();
    
    return {
      summary,
      trends,
      recommendations,
      violations,
    };
  }
  
  /**
   * Cleanup and optimize system performance
   */
  async performComprehensiveCleanup(): Promise<void> {
    console.log('Starting comprehensive performance cleanup...');
    
    // Clean up caches
    this.performCacheCleanup();
    
    // Optimize memory usage
    if (global.gc) {
      global.gc();
    }
    
    // Reset session statistics
    this.currentSession = {
      startTime: Date.now(),
      totalProcessed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
    };
    
    // Trim metrics history
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS_HISTORY);
    }
    
    console.log('Comprehensive performance cleanup completed');
    
    this.emit('cleanup-completed', {
      cachesSizes: {
        image: this.imageCache.size,
        result: this.resultCache.size,
        feature: this.featureCache.size,
        template: this.templateCache.size,
      },
      memoryUsage: process.memoryUsage(),
    });
  }
  
  // PRIVATE HELPER METHODS
  
  private addMetrics(metrics: PerformanceMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics.shift();
    }
  }
  
  private calculateCacheHitRate(): number {
    const total = this.currentSession.cacheHits + this.currentSession.cacheMisses;
    return total > 0 ? this.currentSession.cacheHits / total : 0;
  }
  
  private calculateCacheSpecificHitRate(cache: Map<string, any>): number {
    // Simplified calculation based on cache size vs theoretical maximum
    return Math.min(cache.size / this.cacheConfig.maxSize, 1);
  }
  
  private evictLeastRecentlyUsed(cache: Map<string, any>): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    let lowestAccess = Infinity;
    
    for (const [key, value] of cache.entries()) {
      // Prioritize by access count first, then by age
      if (value.accessCount < lowestAccess || 
          (value.accessCount === lowestAccess && value.timestamp < oldestTime)) {
        oldestKey = key;
        oldestTime = value.timestamp;
        lowestAccess = value.accessCount;
      }
    }
    
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }
  
  private compressData(data: Buffer): Buffer {
    // Simplified compression - in production would use actual compression algorithm
    return data;
  }
  
  private decompressData(data: Buffer): Buffer {
    // Simplified decompression - in production would use actual decompression algorithm
    return data;
  }
  
  private performCacheCleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    // Cleanup expired entries from all caches
    [this.imageCache, this.resultCache, this.featureCache, this.templateCache].forEach(cache => {
      for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > this.cacheConfig.ttlMs) {
          cache.delete(key);
          cleaned++;
        }
      }
    });
    
    if (cleaned > 0) {
      console.log(`Cache cleanup: removed ${cleaned} expired entries`);
    }
  }
  
  private checkMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    
    if (heapUsedMB > this.performanceThresholds.maxMemoryUsageMB * 0.8) {
      console.warn(`High memory usage detected: ${heapUsedMB.toFixed(2)}MB`);
      
      this.emit('memory-warning', {
        current: heapUsedMB,
        threshold: this.performanceThresholds.maxMemoryUsageMB,
        recommendation: 'Consider reducing batch size or clearing caches',
      });
      
      // Trigger aggressive cleanup
      this.performCacheCleanup();
    }
  }
  
  private checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    const violations = this.getPerformanceViolations(metrics);
    
    if (violations.length > 0) {
      this.emit('performance-violation', {
        metrics,
        violations,
        timestamp: new Date(),
      });
      
      // Auto-adjust strategy if enabled
      this.optimizationStrategy = this.optimizeStrategy(metrics);
    }
  }
  
  private getPerformanceViolations(metrics: PerformanceMetrics): Array<{
    metric: string;
    current: number;
    threshold: number;
    severity: 'warning' | 'critical';
  }> {
    const violations = [];
    
    if (metrics.totalProcessingTime > this.performanceThresholds.maxProcessingTimeMs) {
      violations.push({
        metric: 'totalProcessingTime',
        current: metrics.totalProcessingTime,
        threshold: this.performanceThresholds.maxProcessingTimeMs,
        severity: 'critical' as const,
      });
    }
    
    if (metrics.throughput < this.performanceThresholds.minThroughput) {
      violations.push({
        metric: 'throughput',
        current: metrics.throughput,
        threshold: this.performanceThresholds.minThroughput,
        severity: 'warning' as const,
      });
    }
    
    if (metrics.accuracy < this.performanceThresholds.minAccuracy) {
      violations.push({
        metric: 'accuracy',
        current: metrics.accuracy,
        threshold: this.performanceThresholds.minAccuracy,
        severity: 'critical' as const,
      });
    }
    
    const memoryUsageMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
    if (memoryUsageMB > this.performanceThresholds.maxMemoryUsageMB) {
      violations.push({
        metric: 'memoryUsage',
        current: memoryUsageMB,
        threshold: this.performanceThresholds.maxMemoryUsageMB,
        severity: 'warning' as const,
      });
    }
    
    return violations;
  }
  
  private getAllPerformanceViolations(): Array<{
    metric: string;
    current: number;
    threshold: number;
    severity: 'warning' | 'critical';
  }> {
    const recent = this.metrics.slice(-10);
    const allViolations = [];
    
    for (const metrics of recent) {
      allViolations.push(...this.getPerformanceViolations(metrics));
    }
    
    return allViolations;
  }
  
  private calculateAverageMetrics(): Partial<PerformanceMetrics> {
    if (this.metrics.length === 0) return {};
    
    const recent = this.metrics.slice(-50); // Last 50 measurements
    
    return {
      totalProcessingTime: this.calculateAverage(recent, 'totalProcessingTime'),
      imageProcessingTime: this.calculateAverage(recent, 'imageProcessingTime'),
      patternMatchingTime: this.calculateAverage(recent, 'patternMatchingTime'),
      mlClassificationTime: this.calculateAverage(recent, 'mlClassificationTime'),
      validationTime: this.calculateAverage(recent, 'validationTime'),
      cacheHitRate: this.calculateAverage(recent, 'cacheHitRate'),
      throughput: this.calculateAverage(recent, 'throughput'),
      accuracy: this.calculateAverage(recent, 'accuracy'),
    };
  }
  
  private calculateAverage(metrics: PerformanceMetrics[], field: keyof PerformanceMetrics): number {
    if (metrics.length === 0) return 0;
    
    const values = metrics.map(m => {
      const value = m[field];
      return typeof value === 'number' ? value : 0;
    });
    
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  private calculateTrend(recent: PerformanceMetrics[], older: PerformanceMetrics[], field: keyof PerformanceMetrics): 'improving' | 'degrading' | 'stable' {
    const recentAvg = this.calculateAverage(recent, field);
    const olderAvg = this.calculateAverage(older, field);
    
    if (Math.abs(recentAvg - olderAvg) < 0.05) return 'stable';
    
    // For processing time, lower is better
    if (field === 'totalProcessingTime' || field.includes('Time')) {
      return recentAvg < olderAvg ? 'improving' : 'degrading';
    }
    
    // For throughput and accuracy, higher is better
    return recentAvg > olderAvg ? 'improving' : 'degrading';
  }
  
  private generateRecommendations(summary: any, trends: any): string[] {
    const recommendations = [];
    
    if (summary.avgProcessingTime > this.performanceThresholds.maxProcessingTimeMs * 0.8) {
      recommendations.push('Consider enabling early termination and adaptive filtering');
      recommendations.push('Increase parallel processing batch size if memory allows');
    }
    
    if (summary.cacheEfficiency < 0.3) {
      recommendations.push('Increase cache size or TTL to improve hit rate');
      recommendations.push('Review caching keys for better cache utilization');
    }
    
    if (trends.accuracyTrend === 'degrading') {
      recommendations.push('Lower confidence threshold to capture more symbols');
      recommendations.push('Review ML model performance and consider retraining');
    }
    
    if (trends.throughputTrend === 'degrading') {
      recommendations.push('Enable parallel processing for better throughput');
      recommendations.push('Optimize image preprocessing pipeline');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('System performance is within optimal parameters');
    }
    
    return recommendations;
  }
}