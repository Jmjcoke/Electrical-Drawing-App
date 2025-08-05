/**
 * PDF to Image Conversion Service
 * Handles high-resolution PDF to PNG conversion with monitoring, caching, and resource management
 */

import pdf2pic from 'pdf2pic';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import * as promClient from 'prom-client';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { ConversionResult, ConversionMetadata, CacheEntry, MetricsData } from '../types/api.types.js';
import { validationService, ValidationResult } from './validation.service.js';

// Prometheus metrics
const conversionDurationHistogram = new promClient.Histogram({
  name: 'pdf_conversion_duration_seconds',
  help: 'Time taken to convert PDF pages to images',
  labelNames: ['pages', 'file_size_mb', 'cache_hit'],
  buckets: [1, 5, 10, 30, 60, 120]
});

const conversionCounter = new promClient.Counter({
  name: 'pdf_conversion_total',
  help: 'Total number of PDF conversions attempted',
  labelNames: ['status', 'error_type', 'cache_hit']
});

const queueDepthGauge = new promClient.Gauge({
  name: 'pdf_conversion_queue_depth',
  help: 'Current number of PDFs in conversion queue'
});

const memoryUsageGauge = new promClient.Gauge({
  name: 'pdf_conversion_memory_usage_bytes',
  help: 'Memory usage during PDF conversion',
  labelNames: ['stage']
});

const cacheHitRateGauge = new promClient.Gauge({
  name: 'pdf_conversion_cache_hit_rate',
  help: 'Cache hit rate for PDF conversions'
});

export interface ConversionOptions {
  dpi?: number;
  format?: 'png' | 'jpg';
  quality?: number;
  outputDir?: string;
}

export interface ProcessingProgress {
  documentId: string;
  currentPage: number;
  totalPages: number;
  percentage: number;
  stage: 'starting' | 'converting' | 'storing' | 'complete' | 'error';
  estimatedTimeRemainingMs?: number;
}

export class PdfService {
  private redis: Redis;
  private baseStoragePath: string;
  private defaultOptions: Required<ConversionOptions>;
  private activeConversions = new Map<string, boolean>();
  private cacheStats = { hits: 0, misses: 0 };

  constructor(redisUrl: string, baseStoragePath: string) {
    this.redis = new Redis(redisUrl);
    this.baseStoragePath = baseStoragePath;
    this.defaultOptions = {
      dpi: 300,
      format: 'png',
      quality: 95,
      outputDir: ''
    };

    // Update cache hit rate every 30 seconds
    setInterval(() => {
      const total = this.cacheStats.hits + this.cacheStats.misses;
      if (total > 0) {
        cacheHitRateGauge.set(this.cacheStats.hits / total);
      }
    }, 30000);
  }

  /**
   * Convert PDF to images with caching, monitoring, and progress tracking
   */
  async convertPdfToImages(
    documentId: string,
    sessionId: string,
    pdfBuffer: Buffer,
    originalFilename: string,
    options: ConversionOptions = {},
    progressCallback?: (progress: ProcessingProgress) => void
  ): Promise<ConversionResult> {
    const startTime = Date.now();
    const fileSizeMB = Math.round((pdfBuffer.length / (1024 * 1024)) * 100) / 100;
    const checksum = this.generateChecksum(pdfBuffer);
    
    memoryUsageGauge.labels('start').set(process.memoryUsage().heapUsed);
    queueDepthGauge.inc();

    try {
      // Validate PDF before processing
      const validationResult = await this.validatePdfBuffer(pdfBuffer, originalFilename);
      if (!validationResult.isValid) {
        throw new Error(`PDF validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Log validation warnings
      if (validationResult.warnings && validationResult.warnings.length > 0) {
        logger.warn('PDF validation warnings', {
          documentId,
          sessionId,
          warnings: validationResult.warnings
        });
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(documentId, checksum);
      const cached = await this.checkCache(cacheKey);
      
      if (cached) {
        this.cacheStats.hits++;
        const duration = (Date.now() - startTime) / 1000;
        
        conversionDurationHistogram
          .labels(cached.metadata.imageDimensions.length.toString(), fileSizeMB.toString(), 'true')
          .observe(duration);
        
        conversionCounter.labels('success', 'none', 'true').inc();
        
        logger.info('PDF conversion cache hit', {
          documentId,
          sessionId,
          checksum,
          imagePaths: cached.imagePaths.length
        });

        return {
          documentId,
          imagePaths: cached.imagePaths,
          metadata: {
            ...cached.metadata,
            cacheHit: true
          },
          success: true
        };
      }

      this.cacheStats.misses++;
      
      // Mark as active conversion
      this.activeConversions.set(documentId, true);

      // Merge options with defaults
      const conversionOptions = { ...this.defaultOptions, ...options };
      
      // Create output directory
      const outputDir = path.join(
        this.baseStoragePath,
        'sessions',
        sessionId,
        'converted',
        documentId
      );
      
      await fs.mkdir(outputDir, { recursive: true });

      // Progress callback for starting
      progressCallback?.({
        documentId,
        currentPage: 0,
        totalPages: 0,
        percentage: 0,
        stage: 'starting'
      });

      // Configure pdf2pic
      const convertOptions = {
        density: conversionOptions.dpi,
        saveFilename: 'page',
        savePath: outputDir,
        format: conversionOptions.format,
        width: undefined,
        height: undefined,
        quality: conversionOptions.quality
      };

      // Convert PDF to images with retry logic
      memoryUsageGauge.labels('converting').set(process.memoryUsage().heapUsed);
      
      const conversionStart = Date.now();
      let result;
      let conversionError = null;
      
      try {
        const convert = pdf2pic.fromBuffer(pdfBuffer, convertOptions);
        result = await convert.bulk(-1);
        
        if (!result || result.length === 0) {
          throw new Error('PDF conversion returned no results');
        }
      } catch (primaryError) {
        conversionError = primaryError;
        logger.warn('Primary PDF conversion failed, attempting fallback', {
          documentId,
          sessionId,
          error: primaryError instanceof Error ? primaryError.message : 'Unknown error'
        });
        
        // Try fallback conversion with different options
        result = await this.attemptFallbackConversion(pdfBuffer, convertOptions, documentId);
        
        if (!result || result.length === 0) {
          throw new Error(`PDF conversion failed: ${primaryError instanceof Error ? primaryError.message : 'Unknown error'}`);
        }
      }
      
      const conversionDuration = Date.now() - conversionStart;

      // Process results and get image information
      const imagePaths: string[] = [];
      const imageDimensions: Array<{ page: number; width: number; height: number; dpi: number }> = [];
      const imageFileSizes: number[] = [];

      for (let i = 0; i < result.length; i++) {
        const pageResult = result[i];
        
        progressCallback?.({
          documentId,
          currentPage: i + 1,
          totalPages: result.length,
          percentage: Math.round(((i + 1) / result.length) * 100),
          stage: 'converting',
          estimatedTimeRemainingMs: ((result.length - i - 1) * conversionDuration) / (i + 1)
        });

        if (pageResult.path) {
          imagePaths.push(pageResult.path);
          
          // Get file stats
          const stats = await fs.stat(pageResult.path);
          imageFileSizes.push(stats.size);
          
          // Store dimensions (pdf2pic doesn't provide dimensions directly)
          imageDimensions.push({
            page: i + 1,
            width: 0, // Would need image processing library to get actual dimensions
            height: 0,
            dpi: conversionOptions.dpi
          });
        }
      }

      memoryUsageGauge.labels('storing').set(process.memoryUsage().heapUsed);

      // Progress callback for storing
      progressCallback?.({
        documentId,
        currentPage: result.length,
        totalPages: result.length,
        percentage: 95,
        stage: 'storing'
      });

      // Create metadata
      const metadata: ConversionMetadata = {
        conversionDurationMs: conversionDuration,
        imageDimensions,
        totalFileSize: imageFileSizes.reduce((sum, size) => sum + size, 0),
        imageFileSizes,
        conversionTimestamp: new Date(),
        cacheHit: false
      };

      // Cache the result
      await this.cacheResult(cacheKey, {
        documentId,
        checksum,
        imagePaths,
        metadata,
        accessTimestamp: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

      // Record metrics
      const totalDuration = (Date.now() - startTime) / 1000;
      conversionDurationHistogram
        .labels(result.length.toString(), fileSizeMB.toString(), 'false')
        .observe(totalDuration);
      
      conversionCounter.labels('success', 'none', 'false').inc();

      // Progress callback for completion
      progressCallback?.({
        documentId,
        currentPage: result.length,
        totalPages: result.length,
        percentage: 100,
        stage: 'complete'
      });

      logger.info('PDF conversion completed successfully', {
        documentId,
        sessionId,
        pages: result.length,
        durationMs: conversionDuration,
        totalDurationMs: Date.now() - startTime,
        imagePaths: imagePaths.length,
        fileSizeMB,
        cacheHit: false
      });

      return {
        documentId,
        imagePaths,
        metadata,
        success: true
      };

    } catch (error) {
      const errorType = this.categorizeError(error);
      const duration = (Date.now() - startTime) / 1000;
      const recoverySuggestions = this.getRecoverySuggestions(errorType);
      
      conversionCounter.labels('error', errorType, 'false').inc();
      
      logger.error('PDF conversion failed', {
        documentId,
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType,
        durationMs: Date.now() - startTime,
        fileSizeMB,
        recoverySuggestions
      });

      progressCallback?.({
        documentId,
        currentPage: 0,
        totalPages: 0,
        percentage: 0,
        stage: 'error'
      });

      // Create detailed error message with recovery suggestions
      const errorMessage = error instanceof Error ? error.message : 'Unknown conversion error';
      const detailedError = recoverySuggestions.length > 0 
        ? `${errorMessage}. Suggestions: ${recoverySuggestions.join('; ')}`
        : errorMessage;

      return {
        documentId,
        imagePaths: [],
        metadata: {
          conversionDurationMs: Date.now() - startTime,
          imageDimensions: [],
          totalFileSize: 0,
          imageFileSizes: [],
          conversionTimestamp: new Date(),
          cacheHit: false
        },
        success: false,
        error: detailedError
      };
    } finally {
      this.activeConversions.delete(documentId);
      queueDepthGauge.dec();
      memoryUsageGauge.labels('cleanup').set(process.memoryUsage().heapUsed);
    }
  }

  /**
   * Check if conversion result exists in cache
   */
  private async checkCache(cacheKey: string): Promise<CacheEntry | null> {
    try {
      const cached = await this.redis.get(cacheKey);
      if (!cached) return null;

      const entry: CacheEntry = JSON.parse(cached);
      
      // Check if cache entry is expired
      if (new Date() > new Date(entry.expiresAt)) {
        await this.redis.del(cacheKey);
        return null;
      }

      // Update access timestamp
      entry.accessTimestamp = new Date();
      await this.redis.setex(cacheKey, 24 * 60 * 60, JSON.stringify(entry));

      return entry;
    } catch (error) {
      logger.warn('Cache check failed', { cacheKey, error });
      return null;
    }
  }

  /**
   * Cache conversion result
   */
  private async cacheResult(cacheKey: string, entry: CacheEntry): Promise<void> {
    try {
      await this.redis.setex(cacheKey, 24 * 60 * 60, JSON.stringify(entry));
      logger.debug('Cached conversion result', { 
        cacheKey, 
        documentId: entry.documentId,
        imagePaths: entry.imagePaths.length 
      });
    } catch (error) {
      logger.warn('Failed to cache result', { cacheKey, error });
    }
  }

  /**
   * Generate cache key from document ID and content checksum
   */
  private generateCacheKey(documentId: string, checksum: string): string {
    return `converted_image:${documentId}:${checksum}`;
  }

  /**
   * Generate SHA-256 checksum of PDF content
   */
  private generateChecksum(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }


  /**
   * Get conversion metrics for monitoring
   */
  getMetrics(): Record<string, number> {
    return {
      activeConversions: this.activeConversions.size,
      cacheHitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0,
      totalConversions: this.cacheStats.hits + this.cacheStats.misses
    };
  }

  /**
   * Clean up cached entries for expired sessions
   */
  async cleanupCache(sessionId: string): Promise<number> {
    let cleanedCount = 0;
    try {
      const pattern = `converted_image:*`;
      const keys = await this.redis.keys(pattern);
      
      for (const key of keys) {
        const cached = await this.redis.get(key);
        if (cached) {
          const entry: CacheEntry = JSON.parse(cached);
          // Check if any image path contains the session ID
          if (entry.imagePaths.some((path: string) => path.includes(sessionId))) {
            await this.redis.del(key);
            cleanedCount++;
          }
        }
      }
      
      logger.info('Cache cleanup completed', { sessionId, cleanedCount });
    } catch (error) {
      logger.error('Cache cleanup failed', { sessionId, error });
    }
    
    return cleanedCount;
  }

  /**
   * Health check for PDF service
   */
  async healthCheck(): Promise<{ status: string; metrics: Record<string, number> }> {
    try {
      await this.redis.ping();
      return {
        status: 'healthy',
        metrics: this.getMetrics()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        metrics: { error: 1 }
      };
    }
  }

  /**
   * Validate PDF buffer before conversion
   */
  private async validatePdfBuffer(pdfBuffer: Buffer, filename: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    try {
      // Quick validation first
      const isQuickValid = await validationService.quickValidate(pdfBuffer);
      if (!isQuickValid) {
        return {
          isValid: false,
          errors: ['Invalid PDF format'],
          warnings: []
        };
      }

      // Create mock file object for validation service
      const mockFile = {
        originalname: filename,
        buffer: pdfBuffer,
        size: pdfBuffer.length,
        mimetype: 'application/pdf'
      } as Express.Multer.File;

      const validationResult = await validationService.validatePDFWithFallback(mockFile);
      
      return {
        isValid: validationResult.isValid,
        errors: validationResult.errors || [],
        warnings: validationResult.warnings || []
      };
    } catch (error) {
      logger.error('PDF validation failed', { filename, error });
      return {
        isValid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: []
      };
    }
  }

  /**
   * Attempt fallback conversion with different settings
   */
  private async attemptFallbackConversion(
    pdfBuffer: Buffer, 
    originalOptions: any, 
    documentId: string
  ): Promise<any[]> {
    const fallbackStrategies = [
      // Strategy 1: Lower DPI
      { ...originalOptions, density: 150, quality: 85 },
      // Strategy 2: Different format
      { ...originalOptions, format: 'jpg', quality: 75 },
      // Strategy 3: Minimal options
      { density: 100, format: 'png', quality: 70 },
      // Strategy 4: Very low quality but should work
      { density: 72, format: 'jpg', quality: 50 }
    ];

    for (let i = 0; i < fallbackStrategies.length; i++) {
      const strategy = fallbackStrategies[i];
      
      try {
        logger.info(`Attempting fallback conversion strategy ${i + 1}`, {
          documentId,
          strategy: { density: strategy.density, format: strategy.format, quality: strategy.quality }
        });

        const convert = pdf2pic.fromBuffer(pdfBuffer, strategy);
        const result = await convert.bulk(-1);
        
        if (result && result.length > 0) {
          logger.info(`Fallback conversion strategy ${i + 1} succeeded`, {
            documentId,
            pages: result.length
          });
          return result;
        }
      } catch (error) {
        logger.warn(`Fallback conversion strategy ${i + 1} failed`, {
          documentId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        continue;
      }
    }

    // All fallback strategies failed
    throw new Error('All conversion strategies failed');
  }

  /**
   * Enhanced error categorization with more specific error types
   */
  private categorizeError(error: unknown): string {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    
    // PDF-specific errors
    if (message.includes('password') || message.includes('encrypted')) return 'pdf_encrypted';
    if (message.includes('corrupt') || message.includes('invalid')) return 'pdf_corrupt';
    if (message.includes('unsupported') || message.includes('format')) return 'pdf_unsupported';
    if (message.includes('page') && message.includes('not found')) return 'pdf_empty';
    
    // System errors
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('memory') || message.includes('heap')) return 'memory_error';
    if (message.includes('space') || message.includes('disk')) return 'disk_space';
    if (message.includes('permission') || message.includes('access')) return 'permission_error';
    
    // pdf2pic specific errors
    if (message.includes('poppler') || message.includes('pdftocairo')) return 'poppler_error';
    if (message.includes('buffer') || message.includes('data')) return 'buffer_error';
    
    return 'unknown';
  }

  /**
   * Create recovery suggestions based on error type
   */
  private getRecoverySuggestions(errorType: string): string[] {
    const suggestions: string[] = [];
    
    switch (errorType) {
      case 'pdf_encrypted':
        suggestions.push('Remove password protection from PDF');
        suggestions.push('Use an unencrypted version of the PDF');
        break;
      case 'pdf_corrupt':
        suggestions.push('Try re-saving the PDF from the original application');
        suggestions.push('Use PDF repair tools to fix corruption');
        suggestions.push('Re-upload the file if it was corrupted during transfer');
        break;
      case 'pdf_unsupported':
        suggestions.push('Save PDF in a more compatible format (PDF 1.4 or later)');
        suggestions.push('Flatten complex elements before conversion');
        break;
      case 'memory_error':
        suggestions.push('Try converting a smaller PDF or fewer pages');
        suggestions.push('Split large PDFs into smaller files');
        break;
      case 'timeout':
        suggestions.push('PDF is too complex - try simplifying the content');
        suggestions.push('Split into smaller files for faster processing');
        break;
      default:
        suggestions.push('Try re-uploading the file');
        suggestions.push('Ensure the PDF is not corrupted');
        suggestions.push('Contact support if the problem persists');
    }
    
    return suggestions;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down PDF service');
    await this.redis.quit();
  }
}