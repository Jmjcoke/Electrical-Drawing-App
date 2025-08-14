/**
 * Stream Export Service
 * Implements streaming-based export processing for large datasets
 * Performance optimization for Story 4.5 production hardening
 */

import { Transform, Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';
import * as fs from 'fs';
import * as path from 'path';
import { ComponentReportItem, ExportFormat } from '../../../../shared/types/nlp.types';

export interface StreamExportOptions {
  chunkSize: number;
  maxMemoryUsage: number; // in bytes
  enableCompression: boolean;
  format: ExportFormat;
  outputPath: string;
}

export interface StreamProcessingResult {
  success: boolean;
  processedCount: number;
  totalSize: number;
  processingTime: number;
  memoryUsage: {
    peak: number;
    average: number;
    final: number;
  };
  error?: string;
}

/**
 * Component Data Stream
 * Readable stream that yields component data in chunks
 */
export class ComponentDataStream extends Readable {
  private components: ComponentReportItem[];
  private currentIndex: number = 0;
  private chunkSize: number;

  constructor(components: ComponentReportItem[], chunkSize: number = 100) {
    super({ objectMode: true });
    this.components = components;
    this.chunkSize = chunkSize;
  }

  _read(): void {
    if (this.currentIndex >= this.components.length) {
      this.push(null); // End of stream
      return;
    }

    const chunk = this.components.slice(
      this.currentIndex,
      this.currentIndex + this.chunkSize
    );

    this.currentIndex += this.chunkSize;
    this.push(chunk);
  }
}

/**
 * Component Processing Transform
 * Transform stream that processes component data chunks
 */
export class ComponentProcessingTransform extends Transform {
  private processedCount: number = 0;
  private options: StreamExportOptions;

  constructor(options: StreamExportOptions) {
    super({ objectMode: true });
    this.options = options;
  }

  _transform(chunk: ComponentReportItem[], _encoding: string, callback: Function): void {
    try {
      const processedChunk = this.processComponentChunk(chunk);
      this.processedCount += chunk.length;

      // Emit progress event
      this.emit('progress', {
        processedCount: this.processedCount,
        chunkSize: chunk.length,
        memoryUsage: process.memoryUsage()
      });

      callback(null, processedChunk);
    } catch (error) {
      callback(error);
    }
  }

  private processComponentChunk(components: ComponentReportItem[]): any {
    switch (this.options.format) {
      case 'json':
        return this.processJsonChunk(components);
      case 'csv':
        return this.processCsvChunk(components);
      case 'excel':
        return this.processExcelChunk(components);
      default:
        return components;
    }
  }

  private processJsonChunk(components: ComponentReportItem[]): string {
    // For JSON streaming, we need to handle array structure
    if (this.processedCount === 0) {
      // First chunk - start JSON array
      return '{"components":[' + components.map(c => JSON.stringify(c)).join(',');
    } else {
      // Subsequent chunks - continue array
      return ',' + components.map(c => JSON.stringify(c)).join(',');
    }
  }

  private processCsvChunk(components: ComponentReportItem[]): string {
    let csvContent = '';
    
    // Add header only for first chunk
    if (this.processedCount === 0) {
      csvContent += 'ID,Type,Description,Page,Zone,Confidence\n';
    }

    for (const component of components) {
      const row = [
        this.escapeCsvValue(component.id),
        this.escapeCsvValue(component.type),
        this.escapeCsvValue(component.description),
        component.location.pageNumber,
        this.escapeCsvValue(component.location.zone || ''),
        component.confidence.toFixed(3)
      ];
      csvContent += row.join(',') + '\n';
    }

    return csvContent;
  }

  private processExcelChunk(components: ComponentReportItem[]): any {
    // For Excel, return structured data that can be processed by Excel handler
    return components.map(component => ({
      ID: component.id,
      Type: component.type,
      Description: component.description,
      Page: component.location.pageNumber,
      Zone: component.location.zone || '',
      Confidence: component.confidence
    }));
  }

  private escapeCsvValue(value: string): string {
    if (typeof value !== 'string') return String(value);
    
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  getProcessedCount(): number {
    return this.processedCount;
  }
}

/**
 * Memory Monitor Transform
 * Monitors memory usage and can trigger backpressure
 */
export class MemoryMonitorTransform extends Transform {
  private maxMemoryUsage: number;
  private memoryReadings: number[] = [];

  constructor(maxMemoryUsage: number = 500 * 1024 * 1024) { // 500MB default
    super({ objectMode: true });
    this.maxMemoryUsage = maxMemoryUsage;
  }

  _transform(chunk: any, _encoding: string, callback: Function): void {
    const memUsage = process.memoryUsage();
    this.memoryReadings.push(memUsage.heapUsed);

    // Emit memory warning if approaching limit
    if (memUsage.heapUsed > this.maxMemoryUsage * 0.8) {
      this.emit('memoryWarning', {
        current: memUsage.heapUsed,
        max: this.maxMemoryUsage,
        percentage: (memUsage.heapUsed / this.maxMemoryUsage) * 100
      });
    }

    // Apply backpressure if memory limit exceeded
    if (memUsage.heapUsed > this.maxMemoryUsage) {
      this.emit('memoryLimitExceeded', memUsage);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Delay to allow memory cleanup
      setTimeout(() => {
        callback(null, chunk);
      }, 100);
    } else {
      callback(null, chunk);
    }
  }

  getMemoryStats() {
    if (this.memoryReadings.length === 0) {
      return { peak: 0, average: 0, current: 0 };
    }

    return {
      peak: Math.max(...this.memoryReadings),
      average: this.memoryReadings.reduce((a, b) => a + b, 0) / this.memoryReadings.length,
      current: this.memoryReadings[this.memoryReadings.length - 1]
    };
  }
}

/**
 * File Writing Stream
 * Writable stream that handles different export formats
 */
export class FileWritingStream extends Writable {
  private outputPath: string;
  private fileStream: fs.WriteStream;
  private format: ExportFormat;
  private totalSize: number = 0;
  private isFirstChunk: boolean = true;

  constructor(outputPath: string, format: ExportFormat) {
    super({ objectMode: true });
    this.outputPath = outputPath;
    this.format = format;
    this.fileStream = fs.createWriteStream(outputPath);
  }

  _write(chunk: any, _encoding: string, callback: Function): void {
    try {
      let output: string;

      if (this.format === 'json') {
        output = chunk;
        // Close JSON array at the end
        if (!chunk || chunk === null) {
          output = ']}';
        }
      } else if (this.format === 'csv') {
        output = chunk;
      } else {
        output = JSON.stringify(chunk);
      }

      this.totalSize += Buffer.byteLength(output);
      this.fileStream.write(output, callback);
      this.isFirstChunk = false;
    } catch (error) {
      callback(error);
    }
  }

  _final(callback: Function): void {
    // Finalize JSON structure if needed
    if (this.format === 'json' && !this.isFirstChunk) {
      this.fileStream.write(']}', callback);
    } else {
      callback();
    }
  }

  _destroy(_error: Error | null, callback: Function): void {
    this.fileStream.end(callback);
  }

  getTotalSize(): number {
    return this.totalSize;
  }
}

/**
 * Stream Export Service
 * Main service class for streaming export operations
 */
export class StreamExportService {
  
  /**
   * Process large component dataset using streaming
   */
  async processLargeExport(
    components: ComponentReportItem[],
    options: StreamExportOptions
  ): Promise<StreamProcessingResult> {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();

    try {
      // Create stream pipeline
      const dataStream = new ComponentDataStream(components, options.chunkSize);
      const processingTransform = new ComponentProcessingTransform(options);
      const memoryMonitor = new MemoryMonitorTransform(options.maxMemoryUsage);
      const fileWriter = new FileWritingStream(options.outputPath, options.format);

      // Set up event listeners
      const memoryReadings: number[] = [];
      let memoryWarnings = 0;

      processingTransform.on('progress', (progress) => {
        console.log(`Processed ${progress.processedCount} components, chunk size: ${progress.chunkSize}`);
        memoryReadings.push(progress.memoryUsage.heapUsed);
      });

      memoryMonitor.on('memoryWarning', (warning) => {
        console.warn(`Memory warning: ${(warning.percentage).toFixed(1)}% (${(warning.current / 1024 / 1024).toFixed(1)}MB)`);
        memoryWarnings++;
      });

      memoryMonitor.on('memoryLimitExceeded', (memUsage) => {
        console.error(`Memory limit exceeded: ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)}MB`);
      });

      // Execute streaming pipeline
      await pipeline(
        dataStream,
        processingTransform,
        memoryMonitor,
        fileWriter
      );

      const endTime = Date.now();
      const finalMemory = process.memoryUsage();

      return {
        success: true,
        processedCount: processingTransform.getProcessedCount(),
        totalSize: fileWriter.getTotalSize(),
        processingTime: endTime - startTime,
        memoryUsage: {
          peak: Math.max(...memoryReadings),
          average: memoryReadings.reduce((a, b) => a + b, 0) / memoryReadings.length,
          final: finalMemory.heapUsed
        }
      };

    } catch (error) {
      const endTime = Date.now();
      const finalMemory = process.memoryUsage();

      return {
        success: false,
        processedCount: 0,
        totalSize: 0,
        processingTime: endTime - startTime,
        memoryUsage: {
          peak: finalMemory.heapUsed,
          average: finalMemory.heapUsed,
          final: finalMemory.heapUsed
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Estimate memory requirements for export
   */
  estimateMemoryRequirements(
    componentCount: number,
    format: ExportFormat,
    includeSpecs: boolean = true
  ): {
    estimated: number;
    recommended: number;
    chunkSize: number;
  } {
    // Base size per component (in bytes)
    const baseSize = 200;
    const specSize = includeSpecs ? 300 : 0;
    const formatMultiplier = {
      'json': 1.5,
      'csv': 0.8,
      'excel': 2.0,
      'pdf': 3.0
    };

    const estimatedSize = componentCount * (baseSize + specSize) * formatMultiplier[format];
    const recommended = Math.max(estimatedSize * 2, 100 * 1024 * 1024); // At least 100MB
    const chunkSize = Math.min(Math.max(Math.floor(50000 / (baseSize + specSize)), 10), 1000);

    return {
      estimated: estimatedSize,
      recommended,
      chunkSize
    };
  }

  /**
   * Check if streaming should be used based on dataset size
   */
  shouldUseStreaming(
    componentCount: number,
    format: ExportFormat,
    availableMemory: number = 500 * 1024 * 1024 // 500MB
  ): boolean {
    const requirements = this.estimateMemoryRequirements(componentCount, format);
    return requirements.estimated > availableMemory * 0.7; // Use streaming if estimated > 70% of available
  }

  /**
   * Create optimal streaming options
   */
  createOptimalStreamingOptions(
    componentCount: number,
    format: ExportFormat,
    outputPath: string,
    maxMemory?: number
  ): StreamExportOptions {
    const memoryLimit = maxMemory || 500 * 1024 * 1024; // 500MB default
    const requirements = this.estimateMemoryRequirements(componentCount, format);

    return {
      chunkSize: requirements.chunkSize,
      maxMemoryUsage: memoryLimit,
      enableCompression: componentCount > 1000,
      format,
      outputPath
    };
  }

  /**
   * Validate streaming prerequisites
   */
  async validateStreamingSetup(options: StreamExportOptions): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check output directory exists and is writable
    const outputDir = path.dirname(options.outputPath);
    try {
      await fs.promises.access(outputDir, fs.constants.W_OK);
    } catch (error) {
      issues.push(`Output directory not writable: ${outputDir}`);
    }

    // Check available disk space (simplified check)
    try {
      const stats = await fs.promises.stat(outputDir);
      // This is a simplified check - in production, use a proper disk space library
    } catch (error) {
      issues.push(`Cannot access output directory: ${outputDir}`);
    }

    // Check memory limits are reasonable
    if (options.maxMemoryUsage < 50 * 1024 * 1024) { // Less than 50MB
      issues.push('Maximum memory usage too low, minimum 50MB required');
    }

    if (options.chunkSize < 1 || options.chunkSize > 10000) {
      issues.push('Chunk size should be between 1 and 10,000');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

/**
 * Utility functions for stream-based exports
 */
export class StreamExportUtils {
  
  /**
   * Monitor system resources during streaming
   */
  static createResourceMonitor(intervalMs: number = 5000): NodeJS.Timer {
    return setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      console.log(`Resource Monitor - Memory: ${(memUsage.heapUsed / 1024 / 1024).toFixed(1)}MB, CPU: ${(cpuUsage.user / 1000).toFixed(1)}ms user`);
    }, intervalMs);
  }

  /**
   * Create backpressure-aware transform stream
   */
  static createBackpressureTransform(
    processFn: (chunk: any) => any,
    options: { highWaterMark?: number; objectMode?: boolean } = {}
  ): Transform {
    return new Transform({
      objectMode: options.objectMode || true,
      highWaterMark: options.highWaterMark || 16,
      transform(chunk: any, _encoding: string, callback: Function) {
        try {
          const result = processFn(chunk);
          // Add slight delay to prevent overwhelming downstream
          setImmediate(() => callback(null, result));
        } catch (error) {
          callback(error);
        }
      }
    });
  }

  /**
   * Calculate optimal streaming parameters
   */
  static calculateStreamingParams(
    totalItems: number,
    targetMemoryUsage: number,
    itemSizeBytes: number
  ): {
    chunkSize: number;
    concurrency: number;
    bufferSize: number;
  } {
    const maxChunkSize = Math.floor(targetMemoryUsage / itemSizeBytes / 4); // Use 1/4 of target memory per chunk
    const optimalChunkSize = Math.min(Math.max(maxChunkSize, 10), 1000);
    const concurrency = Math.min(Math.max(Math.floor(totalItems / optimalChunkSize / 10), 1), 4);
    const bufferSize = optimalChunkSize * 2;

    return {
      chunkSize: optimalChunkSize,
      concurrency,
      bufferSize
    };
  }
}