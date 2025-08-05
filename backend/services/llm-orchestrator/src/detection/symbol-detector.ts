/**
 * Symbol Detection Service
 * 
 * Main orchestrator for electrical symbol detection using computer vision
 * and machine learning techniques
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import Queue from 'bull';
import { 
  SymbolDetectionResult, 
  DetectedSymbol, 
  DetectionJob, 
  DetectionJobResult,
  DetectionSettings,
  DetectionMetadata,
  SymbolDetectionError
} from '../../../../shared/types/symbol-detection.types';
import { ImageProcessor } from '../vision/image-processor';
import { PatternMatcher } from './pattern-matcher';
import { MLClassifier } from './ml-classifier';
import { ConfidenceScorer } from './confidence-scorer';
import { SymbolValidator } from './symbol-validator';

export class SymbolDetectionService extends EventEmitter {
  private imageProcessor: ImageProcessor;
  private patternMatcher: PatternMatcher;
  private mlClassifier: MLClassifier;
  private confidenceScorer: ConfidenceScorer;
  private symbolValidator: SymbolValidator;
  private detectionQueue: Queue.Queue;

  constructor(
    redisConfig: { host: string; port: number; password?: string }
  ) {
    super();
    
    this.imageProcessor = new ImageProcessor();
    this.patternMatcher = new PatternMatcher();
    this.mlClassifier = new MLClassifier();
    this.confidenceScorer = new ConfidenceScorer();
    this.symbolValidator = new SymbolValidator();
    
    // Initialize Bull queue for processing detection jobs
    this.detectionQueue = new Queue('symbol detection', {
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
   * Process a document for symbol detection
   */
  async processDocument(
    documentId: string,
    sessionId: string,
    pdfBuffer: Buffer,
    settings: Partial<DetectionSettings> = {}
  ): Promise<string> {
    try {
      const detectionSettings: DetectionSettings = {
        confidenceThreshold: settings.confidenceThreshold || 0.7,
        maxSymbolsPerPage: settings.maxSymbolsPerPage || 100,
        enableMLClassification: settings.enableMLClassification ?? true,
        enablePatternMatching: settings.enablePatternMatching ?? true,
        enableLLMValidation: settings.enableLLMValidation ?? false,
        processingTimeout: settings.processingTimeout || 30000,
      };

      // Convert PDF to images
      const images = await this.imageProcessor.convertPdfToImages(pdfBuffer);
      
      const jobPromises: Promise<string>[] = [];

      // Create detection jobs for each page
      for (let pageIndex = 0; pageIndex < images.length; pageIndex++) {
        const jobId = uuidv4();
        const job: DetectionJob = {
          id: jobId,
          documentId,
          sessionId,
          pageNumber: pageIndex + 1,
          imageBuffer: images[pageIndex],
          settings: detectionSettings,
          createdAt: new Date(),
          status: 'pending',
        };

        // Add job to queue
        const queueJob = await this.detectionQueue.add('detect-symbols', job, {
          jobId,
          timeout: detectionSettings.processingTimeout,
        });

        jobPromises.push(Promise.resolve(queueJob.id as string));
      }

      const jobIds = await Promise.all(jobPromises);
      
      // Emit detection started event with time estimate
      const estimatedTimePerPage = 5000; // 5 seconds per page estimate
      const estimatedTotalTime = images.length * estimatedTimePerPage;
      
      this.emit('detection-started', {
        documentId,
        sessionId,
        jobIds,
        totalPages: images.length,
        estimatedTime: estimatedTotalTime,
      });

      return jobIds[0]; // Return first job ID as primary identifier
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new SymbolDetectionError(
        `Failed to process document: ${errorMessage}`,
        'DOCUMENT_PROCESSING_ERROR',
        { documentId, sessionId, error: errorMessage }
      );
    }
  }

  /**
   * Process a single page for symbol detection
   */
  async processPage(job: DetectionJob): Promise<SymbolDetectionResult> {
    const startTime = Date.now();
    
    try {
      // Update job status
      job.status = 'processing';
      job.progressStage = 'Image preprocessing';
      job.progressPercent = 10;
      
      this.emit('detection-progress', {
        jobId: job.id,
        progress: job.progressPercent,
        stage: job.progressStage,
      });

      // Step 1: Image preprocessing and quality assessment
      const preprocessedImage = await this.imageProcessor.preprocessImage(
        job.imageBuffer,
        { enhanceContrast: true, reduceNoise: true, detectEdges: false }
      );

      const imageQuality = await this.imageProcessor.assessImageQuality(preprocessedImage);
      
      job.progressStage = 'Pattern matching';
      job.progressPercent = 30;
      this.emit('detection-progress', {
        jobId: job.id,
        progress: job.progressPercent,
        stage: job.progressStage,
      });

      // Step 2: Pattern matching detection
      let detectedSymbols: DetectedSymbol[] = [];
      const patternMatchingStartTime = Date.now();
      
      if (job.settings.enablePatternMatching) {
        const patternSymbols = await this.patternMatcher.detectSymbols(
          preprocessedImage,
          { 
            confidenceThreshold: job.settings.confidenceThreshold,
            maxSymbols: job.settings.maxSymbolsPerPage,
          }
        );
        detectedSymbols.push(...patternSymbols);
      }
      
      const patternMatchingTime = Date.now() - patternMatchingStartTime;

      job.progressStage = 'ML classification';
      job.progressPercent = 50;
      this.emit('detection-progress', {
        jobId: job.id,
        progress: job.progressPercent,
        stage: job.progressStage,
      });

      // Step 3: Machine learning classification
      const mlClassificationStartTime = Date.now();
      
      if (job.settings.enableMLClassification) {
        const mlSymbols = await this.mlClassifier.classifySymbols(
          preprocessedImage,
          detectedSymbols
        );
        
        // Merge ML results with pattern matching results
        detectedSymbols = this.mergeDetectionResults(detectedSymbols, mlSymbols);
      }
      
      const mlClassificationTime = Date.now() - mlClassificationStartTime;

      job.progressStage = 'Confidence scoring';
      job.progressPercent = 70;
      this.emit('detection-progress', {
        jobId: job.id,
        progress: job.progressPercent,
        stage: job.progressStage,
      });

      // Step 4: Confidence scoring and validation
      const validationStartTime = Date.now();
      
      for (let i = 0; i < detectedSymbols.length; i++) {
        const symbol = detectedSymbols[i];
        
        // Update progress for each symbol being processed
        const symbolProgress = 70 + Math.floor((i / detectedSymbols.length) * 15);
        job.progressPercent = symbolProgress;
        job.progressStage = `Validating symbol ${i + 1}/${detectedSymbols.length}: ${symbol.symbolType}`;
        
        this.emit('detection-progress', {
          jobId: job.id,
          progress: job.progressPercent,
          stage: job.progressStage,
          currentSymbol: symbol.symbolType,
        });
        
        // Calculate multi-factor confidence score
        symbol.confidence = await this.confidenceScorer.calculateConfidence(
          symbol,
          preprocessedImage,
          imageQuality
        );
        
        // Validate symbol using electrical engineering principles
        symbol.validationScore = await this.symbolValidator.validateSymbol(
          symbol,
          detectedSymbols,
          preprocessedImage
        );
      }
      
      const validationTime = Date.now() - validationStartTime;

      job.progressStage = 'Finalizing results';
      job.progressPercent = 90;
      this.emit('detection-progress', {
        jobId: job.id,
        progress: job.progressPercent,
        stage: job.progressStage,
      });

      // Step 5: Filter by confidence threshold and validate
      const filteredSymbols = detectedSymbols.filter(
        symbol => symbol.confidence >= job.settings.confidenceThreshold
      );

      // Apply false positive filtering
      const validatedSymbols = await this.symbolValidator.filterFalsePositives(
        filteredSymbols,
        preprocessedImage
      );

      const totalProcessingTime = Date.now() - startTime;

      // Create detection metadata
      const detectionMetadata: DetectionMetadata = {
        imageProcessingTime: Date.now() - startTime - patternMatchingTime - mlClassificationTime - validationTime,
        patternMatchingTime,
        mlClassificationTime,
        validationTime,
        totalProcessingTime,
        imageQuality,
        detectionSettings: job.settings,
      };

      // Calculate overall confidence
      const overallConfidence = validatedSymbols.length > 0
        ? validatedSymbols.reduce((sum, symbol) => sum + symbol.confidence, 0) / validatedSymbols.length
        : 0;

      // Create final result
      const result: SymbolDetectionResult = {
        id: uuidv4(),
        queryId: job.sessionId, // Using sessionId as queryId for now
        documentId: job.documentId,
        pageNumber: job.pageNumber,
        detectedSymbols: validatedSymbols,
        processingTimeMs: totalProcessingTime,
        overallConfidence,
        detectionMetadata,
        createdAt: new Date(),
      };

      job.status = 'completed';
      job.progressPercent = 100;
      
      this.emit('detection-completed', {
        jobId: job.id,
        result,
      });

      // Emit individual symbol detection events
      for (const symbol of validatedSymbols) {
        this.emit('symbol-detected', {
          symbol,
          totalFound: validatedSymbols.length,
        });
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      job.status = 'failed';
      
      this.emit('detection-error', {
        jobId: job.id,
        error: errorMessage,
        details: error,
      });

      throw new SymbolDetectionError(
        `Symbol detection failed for page ${job.pageNumber}: ${errorMessage}`,
        'DETECTION_PROCESSING_ERROR',
        { jobId: job.id, pageNumber: job.pageNumber, error: errorMessage }
      );
    }
  }

  /**
   * Merge pattern matching and ML classification results
   */
  private mergeDetectionResults(
    patternSymbols: DetectedSymbol[],
    mlSymbols: DetectedSymbol[]
  ): DetectedSymbol[] {
    const merged: DetectedSymbol[] = [...patternSymbols];
    
    // Add ML-only symbols that don't overlap with pattern matching
    for (const mlSymbol of mlSymbols) {
      const hasOverlap = patternSymbols.some(patternSymbol => 
        this.symbolsOverlap(patternSymbol, mlSymbol)
      );
      
      if (!hasOverlap) {
        merged.push(mlSymbol);
      } else {
        // Update existing symbol with ML classification data
        const overlappingIndex = patternSymbols.findIndex(patternSymbol =>
          this.symbolsOverlap(patternSymbol, mlSymbol)
        );
        
        if (overlappingIndex !== -1) {
          merged[overlappingIndex] = {
            ...merged[overlappingIndex],
            symbolType: mlSymbol.symbolType,
            symbolCategory: mlSymbol.symbolCategory,
            detectionMethod: 'consensus',
            confidence: Math.max(merged[overlappingIndex].confidence, mlSymbol.confidence),
          };
        }
      }
    }
    
    return merged;
  }

  /**
   * Check if two symbols overlap spatially
   */
  private symbolsOverlap(symbol1: DetectedSymbol, symbol2: DetectedSymbol): boolean {
    const box1 = symbol1.boundingBox;
    const box2 = symbol2.boundingBox;
    
    const overlapThreshold = 0.5; // 50% overlap threshold
    
    const intersectionArea = Math.max(0, 
      Math.min(box1.x + box1.width, box2.x + box2.width) - 
      Math.max(box1.x, box2.x)
    ) * Math.max(0,
      Math.min(box1.y + box1.height, box2.y + box2.height) - 
      Math.max(box1.y, box2.y)
    );
    
    const union = box1.area + box2.area - intersectionArea;
    const overlapRatio = union > 0 ? intersectionArea / union : 0;
    
    return overlapRatio > overlapThreshold;
  }

  /**
   * Setup Bull queue event handlers
   */
  private setupQueueHandlers(): void {
    this.detectionQueue.process('detect-symbols', async (job) => {
      const detectionJob = job.data as DetectionJob;
      return await this.processPage(detectionJob);
    });

    this.detectionQueue.on('completed', (job, result: SymbolDetectionResult) => {
      console.log(`Symbol detection job ${job.id} completed for page ${result.pageNumber}`);
    });

    this.detectionQueue.on('failed', (job, err) => {
      console.error(`Symbol detection job ${job.id} failed:`, err.message);
    });

    this.detectionQueue.on('stalled', (job) => {
      console.warn(`Symbol detection job ${job.id} stalled`);
    });
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<DetectionJobResult | null> {
    try {
      const job = await this.detectionQueue.getJob(jobId);
      if (!job) {
        return null;
      }

      const result: DetectionJobResult = {
        jobId,
        completedAt: new Date(),
      };

      if (job.finishedOn) {
        result.result = job.returnvalue as SymbolDetectionResult;
      } else if (job.failedReason) {
        result.error = job.failedReason;
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new SymbolDetectionError(
        `Failed to get job status: ${errorMessage}`,
        'JOB_STATUS_ERROR',
        { jobId }
      );
    }
  }

  /**
   * Cancel a detection job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.detectionQueue.getJob(jobId);
      if (job && !job.finishedOn) {
        await job.remove();
        return true;
      }
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new SymbolDetectionError(
        `Failed to cancel job: ${errorMessage}`,
        'JOB_CANCELLATION_ERROR',
        { jobId }
      );
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    return {
      waiting: await this.detectionQueue.getWaiting().then(jobs => jobs.length),
      active: await this.detectionQueue.getActive().then(jobs => jobs.length),
      completed: await this.detectionQueue.getCompleted().then(jobs => jobs.length),
      failed: await this.detectionQueue.getFailed().then(jobs => jobs.length),
    };
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    await this.detectionQueue.close();
    this.removeAllListeners();
  }
}