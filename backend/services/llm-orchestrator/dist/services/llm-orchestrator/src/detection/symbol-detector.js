"use strict";
/**
 * Symbol Detection Service
 *
 * Main orchestrator for electrical symbol detection using computer vision
 * and machine learning techniques
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SymbolDetectionService = void 0;
const events_1 = require("events");
const uuid_1 = require("uuid");
const bull_1 = __importDefault(require("bull"));
const symbol_detection_types_1 = require("../../../../shared/types/symbol-detection.types");
const image_processor_1 = require("../vision/image-processor");
const pattern_matcher_1 = require("./pattern-matcher");
const ml_classifier_1 = require("./ml-classifier");
const confidence_scorer_1 = require("./confidence-scorer");
const symbol_validator_1 = require("./symbol-validator");
const symbol_detection_storage_service_1 = require("../services/symbol-detection-storage.service");
class SymbolDetectionService extends events_1.EventEmitter {
    constructor(redisConfig, database) {
        super();
        this.imageProcessor = new image_processor_1.ImageProcessor();
        this.patternMatcher = new pattern_matcher_1.PatternMatcher();
        this.mlClassifier = new ml_classifier_1.MLClassifier();
        this.confidenceScorer = new confidence_scorer_1.ConfidenceScorer();
        this.symbolValidator = new symbol_validator_1.SymbolValidator();
        this.storageService = new symbol_detection_storage_service_1.SymbolDetectionStorageService(database);
        // Initialize Bull queue for processing detection jobs
        this.detectionQueue = new bull_1.default('symbol detection', {
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
     * Process a document for symbol detection with caching support
     */
    async processDocument(documentId, sessionId, pdfBuffer, settings = {}) {
        try {
            const detectionSettings = {
                confidenceThreshold: settings.confidenceThreshold || 0.7,
                maxSymbolsPerPage: settings.maxSymbolsPerPage || 100,
                enableMLClassification: settings.enableMLClassification ?? true,
                enablePatternMatching: settings.enablePatternMatching ?? true,
                enableLLMValidation: settings.enableLLMValidation ?? false,
                processingTimeout: settings.processingTimeout || 30000,
            };
            // Convert PDF to images
            const images = await this.imageProcessor.convertPdfToImages(pdfBuffer);
            const jobPromises = [];
            const cachedResults = [];
            // Check cache for each page and create jobs for non-cached pages
            for (let pageIndex = 0; pageIndex < images.length; pageIndex++) {
                const pageNumber = pageIndex + 1;
                const imageBuffer = images[pageIndex];
                // Check if result is cached
                const cachedResult = await this.storageService.getCachedDetectionResult(imageBuffer, pageNumber, detectionSettings);
                if (cachedResult) {
                    cachedResults.push(cachedResult);
                    console.log(`Using cached result for page ${pageNumber} of document ${documentId}`);
                    // Emit cached result immediately
                    this.emit('detection-completed', {
                        jobId: `cached-${pageNumber}`,
                        result: cachedResult,
                    });
                    continue;
                }
                // Create database job record
                const jobId = await this.storageService.createDetectionJob(documentId, sessionId, pageNumber, detectionSettings, imageBuffer);
                const job = {
                    id: jobId,
                    documentId,
                    sessionId,
                    pageNumber,
                    imageBuffer,
                    settings: detectionSettings,
                    createdAt: new Date(),
                    status: 'pending',
                };
                // Add job to processing queue
                const queueJob = await this.detectionQueue.add('detect-symbols', job, {
                    jobId,
                    timeout: detectionSettings.processingTimeout,
                });
                jobPromises.push(Promise.resolve(queueJob.id));
            }
            const jobIds = await Promise.all(jobPromises);
            // Calculate time estimate (adjust for cached results)
            const uncachedPages = images.length - cachedResults.length;
            const estimatedTimePerPage = 5000; // 5 seconds per page estimate
            const estimatedTotalTime = uncachedPages * estimatedTimePerPage;
            this.emit('detection-started', {
                documentId,
                sessionId,
                jobIds,
                totalPages: images.length,
                cachedPages: cachedResults.length,
                estimatedTime: estimatedTotalTime,
            });
            return jobIds.length > 0 ? jobIds[0] : `cached-all-${documentId}`; // Return first job ID or cache indicator
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new symbol_detection_types_1.SymbolDetectionError(`Failed to process document: ${errorMessage}`, 'DOCUMENT_PROCESSING_ERROR', { documentId, sessionId, error: errorMessage });
        }
    }
    /**
     * Process a single page for symbol detection with database integration
     */
    async processPage(job) {
        const startTime = Date.now();
        try {
            // Update job status in database
            await this.storageService.updateJobProgress(job.id, 'processing', 'Image preprocessing', 10);
            job.status = 'processing';
            job.progressStage = 'Image preprocessing';
            job.progressPercent = 10;
            this.emit('detection-progress', {
                jobId: job.id,
                progress: job.progressPercent,
                stage: job.progressStage,
            });
            // Step 1: Image preprocessing and quality assessment
            const preprocessedImage = await this.imageProcessor.preprocessImage(job.imageBuffer, { enhanceContrast: true, reduceNoise: true, detectEdges: false });
            const imageQuality = await this.imageProcessor.assessImageQuality(preprocessedImage);
            // Update progress in database
            await this.storageService.updateJobProgress(job.id, 'processing', 'Pattern matching', 30);
            job.progressStage = 'Pattern matching';
            job.progressPercent = 30;
            this.emit('detection-progress', {
                jobId: job.id,
                progress: job.progressPercent,
                stage: job.progressStage,
            });
            // Step 2: Pattern matching detection
            let detectedSymbols = [];
            const patternMatchingStartTime = Date.now();
            if (job.settings.enablePatternMatching) {
                const patternSymbols = await this.patternMatcher.detectSymbols(preprocessedImage, {
                    confidenceThreshold: job.settings.confidenceThreshold,
                    maxSymbols: job.settings.maxSymbolsPerPage,
                });
                detectedSymbols.push(...patternSymbols);
            }
            const patternMatchingTime = Date.now() - patternMatchingStartTime;
            // Update progress in database
            await this.storageService.updateJobProgress(job.id, 'processing', 'ML classification', 50);
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
                const mlSymbols = await this.mlClassifier.classifySymbols(preprocessedImage, detectedSymbols);
                // Merge ML results with pattern matching results
                detectedSymbols = this.mergeDetectionResults(detectedSymbols, mlSymbols);
            }
            const mlClassificationTime = Date.now() - mlClassificationStartTime;
            // Update progress in database
            await this.storageService.updateJobProgress(job.id, 'processing', 'Confidence scoring', 70);
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
                // Update database progress every 5 symbols to avoid too many DB calls
                if (i % 5 === 0 || i === detectedSymbols.length - 1) {
                    await this.storageService.updateJobProgress(job.id, 'processing', job.progressStage, symbolProgress);
                }
                this.emit('detection-progress', {
                    jobId: job.id,
                    progress: job.progressPercent,
                    stage: job.progressStage,
                    currentSymbol: symbol.symbolType,
                });
                // Calculate multi-factor confidence score
                symbol.confidence = await this.confidenceScorer.calculateConfidence(symbol, preprocessedImage, imageQuality);
                // Validate symbol using electrical engineering principles
                symbol.validationScore = await this.symbolValidator.validateSymbol(symbol, detectedSymbols, preprocessedImage);
            }
            const validationTime = Date.now() - validationStartTime;
            // Update progress in database
            await this.storageService.updateJobProgress(job.id, 'processing', 'Finalizing results', 90);
            job.progressStage = 'Finalizing results';
            job.progressPercent = 90;
            this.emit('detection-progress', {
                jobId: job.id,
                progress: job.progressPercent,
                stage: job.progressStage,
            });
            // Step 5: Filter by confidence threshold and validate
            const filteredSymbols = detectedSymbols.filter(symbol => symbol.confidence >= job.settings.confidenceThreshold);
            // Apply false positive filtering
            const validatedSymbols = await this.symbolValidator.filterFalsePositives(filteredSymbols, preprocessedImage);
            const totalProcessingTime = Date.now() - startTime;
            // Create detection metadata
            const detectionMetadata = {
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
            const result = {
                id: (0, uuid_1.v4)(),
                queryId: job.sessionId, // Using sessionId as queryId for now
                documentId: job.documentId,
                pageNumber: job.pageNumber,
                detectedSymbols: validatedSymbols,
                processingTimeMs: totalProcessingTime,
                overallConfidence,
                detectionMetadata,
                createdAt: new Date(),
            };
            // Store result in database with caching
            const { resultId, cached } = await this.storageService.storeDetectionResult(result, job.imageBuffer, job.settings);
            // Update job as completed
            await this.storageService.updateJobProgress(job.id, 'completed', 'Detection completed', 100);
            job.status = 'completed';
            job.progressPercent = 100;
            this.emit('detection-completed', {
                jobId: job.id,
                result,
                cached,
                storedResultId: resultId,
            });
            // Emit individual symbol detection events
            for (const symbol of validatedSymbols) {
                this.emit('symbol-detected', {
                    symbol,
                    totalFound: validatedSymbols.length,
                });
            }
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Update job status in database
            try {
                await this.storageService.updateJobProgress(job.id, 'failed');
            }
            catch (dbError) {
                console.error('Failed to update job status in database:', dbError);
            }
            job.status = 'failed';
            this.emit('detection-error', {
                jobId: job.id,
                error: errorMessage,
                details: error,
            });
            throw new symbol_detection_types_1.SymbolDetectionError(`Symbol detection failed for page ${job.pageNumber}: ${errorMessage}`, 'DETECTION_PROCESSING_ERROR', { jobId: job.id, pageNumber: job.pageNumber, error: errorMessage });
        }
    }
    /**
     * Merge pattern matching and ML classification results
     */
    mergeDetectionResults(patternSymbols, mlSymbols) {
        const merged = [...patternSymbols];
        // Add ML-only symbols that don't overlap with pattern matching
        for (const mlSymbol of mlSymbols) {
            const hasOverlap = patternSymbols.some(patternSymbol => this.symbolsOverlap(patternSymbol, mlSymbol));
            if (!hasOverlap) {
                merged.push(mlSymbol);
            }
            else {
                // Update existing symbol with ML classification data
                const overlappingIndex = patternSymbols.findIndex(patternSymbol => this.symbolsOverlap(patternSymbol, mlSymbol));
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
    symbolsOverlap(symbol1, symbol2) {
        const box1 = symbol1.boundingBox;
        const box2 = symbol2.boundingBox;
        const overlapThreshold = 0.5; // 50% overlap threshold
        const intersectionArea = Math.max(0, Math.min(box1.x + box1.width, box2.x + box2.width) -
            Math.max(box1.x, box2.x)) * Math.max(0, Math.min(box1.y + box1.height, box2.y + box2.height) -
            Math.max(box1.y, box2.y));
        const union = box1.area + box2.area - intersectionArea;
        const overlapRatio = union > 0 ? intersectionArea / union : 0;
        return overlapRatio > overlapThreshold;
    }
    /**
     * Setup Bull queue event handlers
     */
    setupQueueHandlers() {
        this.detectionQueue.process('detect-symbols', async (job) => {
            const detectionJob = job.data;
            return await this.processPage(detectionJob);
        });
        this.detectionQueue.on('completed', (job, result) => {
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
    async getJobStatus(jobId) {
        try {
            const job = await this.detectionQueue.getJob(jobId);
            if (!job) {
                return null;
            }
            const result = {
                jobId,
                completedAt: new Date(),
            };
            if (job.finishedOn) {
                result.result = job.returnvalue;
            }
            else if (job.failedReason) {
                result.error = job.failedReason;
            }
            return result;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new symbol_detection_types_1.SymbolDetectionError(`Failed to get job status: ${errorMessage}`, 'JOB_STATUS_ERROR', { jobId });
        }
    }
    /**
     * Cancel a detection job
     */
    async cancelJob(jobId) {
        try {
            const job = await this.detectionQueue.getJob(jobId);
            if (job && !job.finishedOn) {
                await job.remove();
                return true;
            }
            return false;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new symbol_detection_types_1.SymbolDetectionError(`Failed to cancel job: ${errorMessage}`, 'JOB_CANCELLATION_ERROR', { jobId });
        }
    }
    /**
     * Get queue statistics
     */
    async getQueueStats() {
        return {
            waiting: await this.detectionQueue.getWaiting().then(jobs => jobs.length),
            active: await this.detectionQueue.getActive().then(jobs => jobs.length),
            completed: await this.detectionQueue.getCompleted().then(jobs => jobs.length),
            failed: await this.detectionQueue.getFailed().then(jobs => jobs.length),
        };
    }
    /**
     * Get stored detection result by ID
     */
    async getDetectionResult(resultId) {
        return await this.storageService.getDetectionResult(resultId);
    }
    /**
     * List detection results for a session
     */
    async listSessionDetectionResults(sessionId, options = {}) {
        return await this.storageService.listSessionDetectionResults(sessionId, options);
    }
    /**
     * Validate a detected symbol against the symbol library
     */
    async validateDetectedSymbol(symbol) {
        return await this.storageService.validateDetectedSymbol(symbol);
    }
    /**
     * Get symbol library entries
     */
    async getSymbolLibrary(filters = {}) {
        return await this.storageService.getSymbolLibrary(filters);
    }
    /**
     * Delete a detection result
     */
    async deleteDetectionResult(resultId) {
        return await this.storageService.deleteDetectionResult(resultId);
    }
    /**
     * Get comprehensive storage statistics
     */
    async getStorageStatistics() {
        return await this.storageService.getStorageStatistics();
    }
    /**
     * Perform cache and data cleanup
     */
    async performCleanup() {
        return await this.storageService.performCleanup();
    }
    /**
     * Clean up resources
     */
    async shutdown() {
        await this.detectionQueue.close();
        await this.storageService.shutdown();
        this.removeAllListeners();
    }
}
exports.SymbolDetectionService = SymbolDetectionService;
//# sourceMappingURL=symbol-detector.js.map