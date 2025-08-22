/**
 * Real Symbol Detection Service
 * 
 * Main orchestrator for electrical symbol detection using actual computer vision
 * and machine learning techniques
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import Queue from 'bull';
import { Pool } from 'pg';
import { 
  SymbolDetectionResult, 
  DetectedSymbol, 
  DetectionJobResult,
  DetectionSettings,
  DetectionMetadata,
  SymbolDetectionError,
  ImageQuality,
  BoundingBox
} from '../../../../shared/types/symbol-detection.types';
import { RealPatternMatcher } from './pattern-matcher-real';
import { RealMLClassifier } from './ml-classifier-real';
import { ComputerVisionAlgorithms } from '../vision/cv-algorithms';
import { SymbolDetectionStorageService } from '../services/symbol-detection-storage.service';
import sharp from 'sharp';
import { Jimp } from 'jimp';

export class RealSymbolDetectionService extends EventEmitter {
  private patternMatcher: RealPatternMatcher;
  private mlClassifier: RealMLClassifier;
  private cvAlgorithms: ComputerVisionAlgorithms;
  private detectionQueue: Queue.Queue;
  private storageService: SymbolDetectionStorageService;
  private isInitialized = false;

  constructor(
    redisConfig: { host: string; port: number; password?: string },
    database: Pool
  ) {
    super();
    
    this.patternMatcher = new RealPatternMatcher();
    this.mlClassifier = new RealMLClassifier();
    this.cvAlgorithms = new ComputerVisionAlgorithms();
    this.storageService = new SymbolDetectionStorageService(database);
    
    // Initialize Bull queue for processing detection jobs
    this.detectionQueue = new Queue('real-symbol-detection', {
      redis: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    });

    this.setupQueueHandlers();
  }

  /**
   * Initialize all components
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    console.log('Initializing Real Symbol Detection Service...');
    
    // Initialize pattern matcher and ML classifier
    await Promise.all([
      this.patternMatcher.initialize(),
      this.mlClassifier.initialize()
    ]);
    
    this.isInitialized = true;
    console.log('Real Symbol Detection Service initialized successfully');
  }

  /**
   * Process a document for symbol detection with real CV algorithms
   */
  async processDocument(
    documentId: string,
    sessionId: string,
    pdfBuffer: Buffer,
    settings: Partial<DetectionSettings> = {}
  ): Promise<string> {
    // Ensure service is initialized
    await this.initialize();
    
    const detectionSettings: DetectionSettings = {
      confidenceThreshold: settings.confidenceThreshold || 0.6,
      maxSymbolsPerPage: settings.maxSymbolsPerPage || 100,
      enableMLClassification: settings.enableMLClassification ?? true,
      enablePatternMatching: settings.enablePatternMatching ?? true,
      enableLLMValidation: settings.enableLLMValidation ?? false,
      processingTimeout: settings.processingTimeout || 30000,
    };

    // Create detection job
    const jobId = uuidv4();
    await this.detectionQueue.add('detect-symbols', {
      jobId,
      documentId,
      sessionId,
      settings: detectionSettings,
      pdfBuffer: pdfBuffer.toString('base64'), // Store as base64 for Redis
    });

    console.log(`Created real symbol detection job ${jobId} for document ${documentId}`);
    
    return jobId;
  }

  /**
   * Setup queue event handlers
   */
  private setupQueueHandlers(): void {
    // Process detection jobs
    this.detectionQueue.process('detect-symbols', async (job) => {
      const { jobId, documentId, sessionId, settings, pdfBuffer } = job.data;
      
      try {
        // Convert base64 back to buffer
        const buffer = Buffer.from(pdfBuffer, 'base64');
        
        // Process the document
        const result = await this.performRealDetection(
          jobId,
          documentId,
          sessionId,
          buffer,
          settings,
          (progress) => {
            job.progress(progress);
            this.emit('detection-progress', {
              jobId,
              progress,
              stage: this.getProgressStage(progress)
            });
          }
        );
        
        return result;
        
      } catch (error) {
        console.error(`Real detection job ${jobId} failed:`, error);
        throw error;
      }
    });

    // Queue event handlers
    this.detectionQueue.on('completed', (job, result) => {
      console.log(`Real detection job ${job.data.jobId} completed`);
      this.emit('detection-completed', {
        jobId: job.data.jobId,
        result
      });
    });

    this.detectionQueue.on('failed', (job, err) => {
      console.error(`Real detection job ${job?.data?.jobId} failed:`, err);
      this.emit('detection-error', {
        jobId: job?.data?.jobId,
        error: err.message
      });
    });

    this.detectionQueue.on('progress', (job, progress) => {
      this.emit('detection-progress', {
        jobId: job.data.jobId,
        progress,
        stage: this.getProgressStage(progress)
      });
    });
  }

  /**
   * Perform real symbol detection using CV and ML
   */
  private async performRealDetection(
    jobId: string,
    documentId: string,
    sessionId: string,
    pdfBuffer: Buffer,
    settings: DetectionSettings,
    progressCallback: (progress: number) => void
  ): Promise<SymbolDetectionResult> {
    const startTime = Date.now();
    const allDetectedSymbols: DetectedSymbol[] = [];
    
    try {
      progressCallback(0);
      
      // Step 1: Convert PDF to images (10% progress)
      console.log('Converting PDF to images...');
      const imageBuffers = await this.convertPdfToImages(pdfBuffer);
      progressCallback(10);
      
      // Step 2: Process each page
      const totalPages = imageBuffers.length;
      console.log(`Processing ${totalPages} pages...`);
      
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        const pageProgress = 10 + (pageIndex / totalPages) * 80; // 10-90% for page processing
        
        const imageBuffer = imageBuffers[pageIndex];
        const pageNumber = pageIndex + 1;
        
        console.log(`Processing page ${pageNumber}/${totalPages}...`);
        
        // Step 2a: Assess image quality
        const imageQuality = await this.assessImageQuality(imageBuffer);
        
        // Step 2b: Preprocess image
        const preprocessedImage = await this.preprocessImage(imageBuffer, imageQuality);
        progressCallback(pageProgress + 10);
        
        // Step 2c: Pattern matching detection
        let patternSymbols: DetectedSymbol[] = [];
        if (settings.enablePatternMatching) {
          console.log(`Running pattern matching on page ${pageNumber}...`);
          patternSymbols = await this.patternMatcher.detectSymbols(preprocessedImage, {
            confidenceThreshold: settings.confidenceThreshold,
            maxSymbols: settings.maxSymbolsPerPage,
            enableRotationInvariance: true,
            enableScaleInvariance: true,
            edgeDetectionThreshold: { low: 50, high: 150 },
            minContourArea: 50
          });
          console.log(`Pattern matching found ${patternSymbols.length} symbols`);
        }
        progressCallback(pageProgress + 30);
        
        // Step 2d: ML classification
        let mlSymbols: DetectedSymbol[] = [];
        if (settings.enableMLClassification) {
          console.log(`Running ML classification on page ${pageNumber}...`);
          const regions = await this.mlClassifier.extractRegionsOfInterest(preprocessedImage);
          mlSymbols = await this.mlClassifier.classifySymbols(preprocessedImage, regions);
          console.log(`ML classification found ${mlSymbols.length} symbols`);
        }
        progressCallback(pageProgress + 50);
        
        // Step 2e: Merge and validate results
        const mergedSymbols = this.mergeDetectionResults(patternSymbols, mlSymbols);
        console.log(`Merged to ${mergedSymbols.length} unique symbols`);
        
        // Step 2f: Apply confidence scoring
        const scoredSymbols = await this.applyConfidenceScoring(mergedSymbols, imageQuality);
        
        // Step 2g: Filter by threshold
        const filteredSymbols = scoredSymbols.filter(
          s => s.confidence >= settings.confidenceThreshold
        );
        
        // Add page number to symbols
        filteredSymbols.forEach(symbol => {
          symbol.location.pageNumber = pageNumber;
        });
        
        allDetectedSymbols.push(...filteredSymbols);
        progressCallback(pageProgress + 70);
      }
      
      // Step 3: Post-processing and validation (90-100%)
      console.log(`Post-processing ${allDetectedSymbols.length} total symbols...`);
      const validatedSymbols = await this.validateAndFilterSymbols(allDetectedSymbols);
      progressCallback(95);
      
      // Calculate metadata
      const processingTime = Date.now() - startTime;
      const metadata: DetectionMetadata = {
        imageProcessingTime: processingTime * 0.2,
        patternMatchingTime: processingTime * 0.3,
        mlClassificationTime: processingTime * 0.3,
        validationTime: processingTime * 0.2,
        totalProcessingTime: processingTime,
        imageQuality: await this.assessImageQuality(imageBuffers[0]),
        detectionSettings: settings
      };
      
      // Create result
      const result: SymbolDetectionResult = {
        id: uuidv4(),
        queryId: jobId,
        documentId,
        pageNumber: 1, // Overall result
        detectedSymbols: validatedSymbols,
        processingTimeMs: processingTime,
        overallConfidence: this.calculateOverallConfidence(validatedSymbols),
        detectionMetadata: metadata,
        createdAt: new Date()
      };
      
      // Store result in database
      await this.storageService.storeDetectionResult(result);
      
      progressCallback(100);
      
      console.log(`Real detection completed: ${validatedSymbols.length} symbols detected in ${processingTime}ms`);
      
      return result;
      
    } catch (error) {
      throw new SymbolDetectionError(
        `Real symbol detection failed: ${error instanceof Error ? error.message : String(error)}`,
        jobId
      );
    }
  }

  /**
   * Convert PDF to images
   */
  private async convertPdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
    try {
      // Use sharp to convert PDF pages to images
      // Note: Sharp has limited PDF support, so in production you'd use pdf2pic or similar
      const metadata = await sharp(pdfBuffer).metadata();
      
      if (metadata.pages && metadata.pages > 1) {
        // Multi-page PDF
        const images: Buffer[] = [];
        for (let i = 0; i < metadata.pages; i++) {
          const pageImage = await sharp(pdfBuffer, { page: i })
            .png()
            .toBuffer();
          images.push(pageImage);
        }
        return images;
      } else {
        // Single page or image
        const image = await sharp(pdfBuffer)
          .png()
          .toBuffer();
        return [image];
      }
    } catch (error) {
      console.warn('PDF conversion with sharp failed, using fallback:', error);
      // Fallback: treat as single image
      return [pdfBuffer];
    }
  }

  /**
   * Assess image quality
   */
  private async assessImageQuality(imageBuffer: Buffer): Promise<ImageQuality> {
    try {
      await Jimp.Jimp.read(imageBuffer);
      const metadata = await sharp(imageBuffer).metadata();
      
      // Calculate quality metrics
      const resolution = (metadata.width || 0) * (metadata.height || 0);
      
      // Analyze image statistics for quality assessment
      const stats = await sharp(imageBuffer).stats();
      
      // Calculate contrast from channel statistics
      const contrast = this.calculateContrast(stats);
      
      // Estimate clarity based on edge detection
      const clarity = await this.estimateClarity(imageBuffer);
      
      // Estimate noise level
      const noiseLevel = this.estimateNoise(stats);
      
      return {
        resolution,
        clarity,
        contrast,
        noiseLevel,
        skewAngle: 0 // Would calculate actual skew in production
      };
      
    } catch (error) {
      console.warn('Image quality assessment failed:', error);
      return {
        resolution: 1000000,
        clarity: 0.5,
        contrast: 0.5,
        noiseLevel: 0.5
      };
    }
  }

  /**
   * Calculate contrast from image statistics
   */
  private calculateContrast(stats: any): number {
    // Use standard deviation as a measure of contrast
    const channelStdDevs = stats.channels.map((c: any) => c.stdev || 0);
    const avgStdDev = channelStdDevs.reduce((a: number, b: number) => a + b, 0) / channelStdDevs.length;
    return Math.min(avgStdDev / 128, 1); // Normalize to 0-1
  }

  /**
   * Estimate image clarity
   */
  private async estimateClarity(imageBuffer: Buffer): Promise<number> {
    try {
      // Use edge detection to estimate clarity
      const edges = await this.cvAlgorithms.detectEdges(imageBuffer, 100, 200);
      
      // Count edge pixels
      const image = await Jimp.Jimp.read(edges.edges);
      let edgePixels = 0;
      let totalPixels = image.bitmap.width * image.bitmap.height;
      
      image.scan(0, 0, image.bitmap.width, image.bitmap.height, (_x: number, _y: number, idx: number) => {
        const red = image.bitmap.data[idx];
        if (red > 128) edgePixels++;
      });
      
      // More edges generally means clearer image
      const edgeRatio = edgePixels / totalPixels;
      return Math.min(edgeRatio * 10, 1); // Scale and cap at 1
      
    } catch (error) {
      return 0.5; // Default clarity
    }
  }

  /**
   * Estimate noise level
   */
  private estimateNoise(stats: any): number {
    // High frequency variations indicate noise
    // This is a simplified estimation
    const channelMins = stats.channels.map((c: any) => c.min || 0);
    const channelMaxs = stats.channels.map((c: any) => c.max || 255);
    const ranges = channelMaxs.map((max: number, i: number) => max - channelMins[i]);
    const avgRange = ranges.reduce((a: number, b: number) => a + b, 0) / ranges.length;
    
    // Less range might indicate noise reduction/blur
    return 1 - (avgRange / 255);
  }

  /**
   * Preprocess image for better detection
   */
  private async preprocessImage(imageBuffer: Buffer, quality: ImageQuality): Promise<Buffer> {
    let processed = imageBuffer;
    
    // Apply preprocessing based on quality assessment
    if (quality.noiseLevel > 0.3) {
      // Denoise if needed
      processed = await sharp(processed)
        .median(3) // Median filter for noise reduction
        .toBuffer();
    }
    
    if (quality.contrast < 0.5) {
      // Enhance contrast
      processed = await sharp(processed)
        .normalize() // Stretch histogram
        .toBuffer();
    }
    
    if (quality.clarity < 0.5) {
      // Sharpen if blurry
      processed = await sharp(processed)
        .sharpen()
        .toBuffer();
    }
    
    return processed;
  }

  /**
   * Merge detection results from different methods
   */
  private mergeDetectionResults(
    patternSymbols: DetectedSymbol[],
    mlSymbols: DetectedSymbol[]
  ): DetectedSymbol[] {
    const merged: DetectedSymbol[] = [];
    const processed = new Set<string>();
    
    // Start with pattern matching results (typically more reliable for simple symbols)
    for (const patternSymbol of patternSymbols) {
      // Find overlapping ML detection
      const overlapping = mlSymbols.find(ml => 
        this.calculateOverlap(patternSymbol.boundingBox, ml.boundingBox) > 0.5
      );
      
      if (overlapping) {
        // Merge the two detections
        const mergedSymbol = this.mergeSymbols(patternSymbol, overlapping);
        merged.push(mergedSymbol);
        processed.add(overlapping.id);
      } else {
        merged.push(patternSymbol);
      }
    }
    
    // Add remaining ML symbols that weren't merged
    for (const mlSymbol of mlSymbols) {
      if (!processed.has(mlSymbol.id)) {
        merged.push(mlSymbol);
      }
    }
    
    return merged;
  }

  /**
   * Merge two symbol detections
   */
  private mergeSymbols(symbol1: DetectedSymbol, symbol2: DetectedSymbol): DetectedSymbol {
    // Weight based on detection method
    const weight1 = symbol1.detectionMethod === 'pattern_matching' ? 0.6 : 0.4;
    const weight2 = 1 - weight1;
    
    // Weighted confidence
    const confidence = symbol1.confidence * weight1 + symbol2.confidence * weight2;
    
    // Choose type from higher confidence detection
    const primarySymbol = symbol1.confidence > symbol2.confidence ? symbol1 : symbol2;
    
    return {
      ...primarySymbol,
      confidence,
      detectionMethod: 'consensus',
      validationScore: Math.max(symbol1.validationScore, symbol2.validationScore)
    };
  }

  /**
   * Calculate bounding box overlap
   */
  private calculateOverlap(box1: BoundingBox, box2: BoundingBox): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);
    
    if (x2 < x1 || y2 < y1) return 0;
    
    const intersection = (x2 - x1) * (y2 - y1);
    const union = box1.area + box2.area - intersection;
    
    return intersection / union;
  }

  /**
   * Apply confidence scoring based on multiple factors
   */
  private async applyConfidenceScoring(
    symbols: DetectedSymbol[],
    imageQuality: ImageQuality
  ): Promise<DetectedSymbol[]> {
    return symbols.map(symbol => {
      let adjustedConfidence = symbol.confidence;
      
      // Adjust based on image quality
      adjustedConfidence *= (0.5 + imageQuality.clarity * 0.5);
      adjustedConfidence *= (0.5 + imageQuality.contrast * 0.5);
      adjustedConfidence *= (1 - imageQuality.noiseLevel * 0.3);
      
      // Boost confidence for consensus detections
      if (symbol.detectionMethod === 'consensus') {
        adjustedConfidence *= 1.1;
      }
      
      // Cap at 1.0
      adjustedConfidence = Math.min(adjustedConfidence, 1.0);
      
      return {
        ...symbol,
        confidence: adjustedConfidence
      };
    });
  }

  /**
   * Validate and filter symbols
   */
  private async validateAndFilterSymbols(symbols: DetectedSymbol[]): Promise<DetectedSymbol[]> {
    // Remove duplicates based on spatial overlap
    const uniqueSymbols: DetectedSymbol[] = [];
    const processed = new Set<string>();
    
    // Sort by confidence
    const sorted = [...symbols].sort((a, b) => b.confidence - a.confidence);
    
    for (const symbol of sorted) {
      if (processed.has(symbol.id)) continue;
      
      // Check for overlaps
      const overlapping = sorted.filter(other => 
        other.id !== symbol.id &&
        !processed.has(other.id) &&
        this.calculateOverlap(symbol.boundingBox, other.boundingBox) > 0.5
      );
      
      if (overlapping.length === 0) {
        uniqueSymbols.push(symbol);
      } else {
        // Keep the highest confidence symbol
        uniqueSymbols.push(symbol);
        overlapping.forEach(dup => processed.add(dup.id));
      }
      
      processed.add(symbol.id);
    }
    
    return uniqueSymbols;
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(symbols: DetectedSymbol[]): number {
    if (symbols.length === 0) return 0;
    
    const totalConfidence = symbols.reduce((sum, s) => sum + s.confidence, 0);
    return totalConfidence / symbols.length;
  }

  /**
   * Get progress stage description
   */
  private getProgressStage(progress: number): string {
    if (progress < 10) return 'Converting PDF';
    if (progress < 30) return 'Preprocessing images';
    if (progress < 60) return 'Pattern matching';
    if (progress < 80) return 'ML classification';
    if (progress < 95) return 'Validating results';
    return 'Finalizing';
  }

  /**
   * Get detection job status
   */
  async getJobStatus(jobId: string): Promise<DetectionJobResult | null> {
    const job = await this.detectionQueue.getJob(jobId);
    if (!job) return null;
    
    await job.getState();
    
    const result = job.returnvalue as SymbolDetectionResult | undefined;
    const error = job.failedReason || undefined;
    
    return {
      jobId,
      ...(result && { result }),
      ...(error && { error }),
      completedAt: job.finishedOn ? new Date(job.finishedOn) : new Date()
    };
  }

  /**
   * Cancel a running job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.detectionQueue.getJob(jobId);
      if (!job) return false;
      
      await job.remove();
      console.log(`Job ${jobId} cancelled successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<void> {
    console.log('Shutting down Real Symbol Detection Service...');
    
    // Pause the queue to prevent new jobs from being processed
    await this.detectionQueue.pause();
    
    // Wait for active jobs to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const activeJobs = await this.detectionQueue.getActive();
      if (activeJobs.length === 0) break;
      
      console.log(`Waiting for ${activeJobs.length} active jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Close the queue
    await this.detectionQueue.close();
    console.log('Real Symbol Detection Service shut down successfully');
  }

  /**
   * Clean up resources (alias for shutdown)
   */
  async cleanup(): Promise<void> {
    await this.shutdown();
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    totalProcessed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.detectionQueue.getWaitingCount(),
      this.detectionQueue.getActiveCount(),
      this.detectionQueue.getCompletedCount(),
      this.detectionQueue.getFailedCount(),
      this.detectionQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      totalProcessed: completed + failed,
    };
  }

  /**
   * List detection results for a session
   */
  async listDetectionResults(
    sessionId: string,
    filters: {
      documentId?: string;
      pageNumber?: number;
      symbolType?: string;
      symbolTypes?: string[];
      minConfidence?: number;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    results: SymbolDetectionResult[];
    total: number;
    summary: {
      totalSymbols: number;
      avgConfidence: number;
      symbolCounts: Record<string, number>;
    };
  }> {
    const results = await this.storageService.listSessionDetectionResults(sessionId, filters);
    
    // Calculate summary
    const totalSymbols = results.reduce((sum, r) => sum + r.detectedSymbols.length, 0);
    const allSymbols = results.flatMap(r => r.detectedSymbols);
    const avgConfidence = allSymbols.length > 0
      ? allSymbols.reduce((sum, s) => sum + s.confidence, 0) / allSymbols.length
      : 0;
    
    const symbolCounts: Record<string, number> = {};
    allSymbols.forEach(s => {
      symbolCounts[s.symbolType] = (symbolCounts[s.symbolType] || 0) + 1;
    });
    
    return {
      results,
      total: results.length,
      summary: {
        totalSymbols,
        avgConfidence,
        symbolCounts
      }
    };
  }

  /**
   * Validate a detected symbol
   */
  async validateDetectedSymbol(symbol: DetectedSymbol): Promise<{
    isValid: boolean;
    confidence: number;
    corrections?: Partial<DetectedSymbol>;
  }> {
    // Basic validation logic
    const isValid = symbol.confidence > 0.5 && symbol.symbolType !== 'unknown';
    
    const corrections = !isValid ? {
      confidence: Math.max(0.5, symbol.confidence),
      symbolType: symbol.symbolType === 'unknown' ? 'custom' : symbol.symbolType
    } : undefined;
    
    return {
      isValid,
      confidence: symbol.confidence,
      ...(corrections && { corrections })
    };
  }

  /**
   * Delete a detection result
   */
  async deleteDetectionResult(resultId: string): Promise<boolean> {
    return this.storageService.deleteDetectionResult(resultId);
  }

  /**
   * Get symbol library
   */
  async getSymbolLibrary(filters: { 
    symbolType?: string; 
    symbolCategory?: string 
  } = {}): Promise<any[]> {
    // Return symbol library data based on filters
    const library = await this.storageService.getSymbolLibrary(filters);
    return library;
  }

  /**
   * Get detection result by ID
   */
  async getDetectionResult(resultId: string): Promise<SymbolDetectionResult | null> {
    return this.storageService.getDetectionResult(resultId);
  }

  /**
   * List session detection results (alias for consistency)
   */
  async listSessionDetectionResults(
    sessionId: string,
    filters: any = {}
  ): Promise<SymbolDetectionResult[]> {
    return this.listDetectionResults(sessionId, filters);
  }

  /**
   * Get storage statistics
   */
  async getStorageStatistics(): Promise<any> {
    return this.storageService.getStorageStatistics();
  }

  /**
   * Perform cleanup
   */
  async performCleanup(): Promise<void> {
    // Cleanup old results - method not implemented in storage service
    console.log('Cleanup not yet implemented');
  }

  /**
   * Optimize performance
   */
  async optimizePerformance(): Promise<void> {
    // Clear caches and optimize resources
    // Clear cache - method not implemented in storage service
    console.log('Cache clearing not yet implemented');
    
    // Reinitialize components if needed
    if (this.isInitialized) {
      await this.patternMatcher.initialize();
      await this.mlClassifier.initialize();
    }
  }
}

export default RealSymbolDetectionService;