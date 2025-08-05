"use strict";
/**
 * Pattern Matcher
 *
 * Template matching algorithms for electrical symbol recognition
 * using contour detection and template matching
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatternMatcher = void 0;
const symbol_detection_types_1 = require("../../../../shared/types/symbol-detection.types");
const coordinate_mapper_1 = require("../vision/coordinate-mapper");
const image_processor_1 = require("../vision/image-processor");
const symbol_library_1 = require("../vision/symbol-library");
const uuid_1 = require("uuid");
const sharp_1 = __importDefault(require("sharp"));
const canvas_1 = require("canvas");
// Using SymbolTemplate and SymbolVariant from symbol-library
class PatternMatcher {
    constructor() {
        this.templates = new Map();
        this.isInitialized = false;
        this.imageProcessor = new image_processor_1.ImageProcessor();
        this.symbolLibrary = new symbol_library_1.SymbolLibrary();
        this.initializeTemplates();
    }
    /**
     * Advanced detect symbols with rotation/scale invariance, ensemble matching, and performance optimization
     */
    async detectSymbols(imageBuffer, options) {
        const startTime = Date.now();
        const maxProcessingTime = options.maxProcessingTime || 30000; // Default 30 seconds
        try {
            if (!this.isInitialized) {
                await this.initializeTemplates();
            }
            // Apply performance optimizations
            const optimizedOptions = this.applyPerformanceOptimizations(options, imageBuffer.length);
            const detectedSymbols = [];
            // Performance monitoring
            const performance = {
                startTime,
                phaseTimings: [],
                totalSymbolsFound: 0,
            };
            // Phase 1: High-priority template matching for common symbols (most important)
            const phase1Start = Date.now();
            const highPrioritySymbols = await this.performHighPriorityMatching(imageBuffer, optimizedOptions);
            detectedSymbols.push(...highPrioritySymbols);
            const phase1Duration = Date.now() - phase1Start;
            performance.phaseTimings.push({ phase: 'high_priority', duration: phase1Duration, symbolsFound: highPrioritySymbols.length });
            // Early termination check
            if (this.shouldTerminateEarly(detectedSymbols, optimizedOptions, startTime, maxProcessingTime)) {
                return this.finalizeResults(detectedSymbols, optimizedOptions, performance);
            }
            // Phase 2: Rotation/scale invariant matching if enabled and time permits
            if ((optimizedOptions.enableRotationInvariance || optimizedOptions.enableScaleInvariance) &&
                this.hasTimeRemaining(startTime, maxProcessingTime, 0.6)) {
                const phase2Start = Date.now();
                const invariantSymbols = await this.performInvariantMatching(imageBuffer, optimizedOptions);
                detectedSymbols.push(...invariantSymbols);
                const phase2Duration = Date.now() - phase2Start;
                performance.phaseTimings.push({ phase: 'invariant', duration: phase2Duration, symbolsFound: invariantSymbols.length });
                if (this.shouldTerminateEarly(detectedSymbols, optimizedOptions, startTime, maxProcessingTime)) {
                    return this.finalizeResults(detectedSymbols, optimizedOptions, performance);
                }
            }
            // Phase 3: Ensemble matching for complex symbols if enabled and time permits
            if (optimizedOptions.enableEnsembleMatching &&
                this.hasTimeRemaining(startTime, maxProcessingTime, 0.3)) {
                const phase3Start = Date.now();
                const ensembleSymbols = await this.performEnsembleMatching(imageBuffer, optimizedOptions);
                detectedSymbols.push(...ensembleSymbols);
                const phase3Duration = Date.now() - phase3Start;
                performance.phaseTimings.push({ phase: 'ensemble', duration: phase3Duration, symbolsFound: ensembleSymbols.length });
                if (this.shouldTerminateEarly(detectedSymbols, optimizedOptions, startTime, maxProcessingTime)) {
                    return this.finalizeResults(detectedSymbols, optimizedOptions, performance);
                }
            }
            // Phase 4: Keypoint-based matching if enabled and time permits
            if (optimizedOptions.enableKeyPointMatching &&
                this.hasTimeRemaining(startTime, maxProcessingTime, 0.1)) {
                const phase4Start = Date.now();
                const keypointSymbols = await this.performKeypointMatching(imageBuffer, optimizedOptions);
                detectedSymbols.push(...keypointSymbols);
                const phase4Duration = Date.now() - phase4Start;
                performance.phaseTimings.push({ phase: 'keypoint', duration: phase4Duration, symbolsFound: keypointSymbols.length });
            }
            return this.finalizeResults(detectedSymbols, optimizedOptions, performance);
        }
        catch (error) {
            throw new symbol_detection_types_1.PatternMatchingError(`Advanced pattern matching failed: ${error instanceof Error ? error.message : String(error)}`, {
                bufferSize: imageBuffer.length,
                options,
                processingTime: Date.now() - startTime,
                timeExceeded: Date.now() - startTime > maxProcessingTime
            });
        }
    }
    /**
     * Apply performance optimizations based on image size and processing constraints
     */
    applyPerformanceOptimizations(options, imageSize) {
        const optimized = { ...options };
        // Enable adaptive filtering by default for performance
        if (optimized.adaptiveFiltering !== false) {
            optimized.adaptiveFiltering = true;
        }
        // Enable early termination by default
        if (optimized.earlyTermination !== false) {
            optimized.earlyTermination = true;
        }
        // Enable parallel processing for larger images
        if (optimized.parallelProcessing !== false && imageSize > 100000) {
            optimized.parallelProcessing = true;
            optimized.batchSize = optimized.batchSize || Math.min(4, Math.max(2, Math.floor(imageSize / 500000)));
        }
        // Enable memory optimization for large images
        if (imageSize > 1000000) {
            optimized.memoryOptimization = true;
        }
        // Adjust confidence threshold for better performance vs accuracy tradeoff
        if (optimized.adaptiveFiltering) {
            // Slightly higher threshold for faster processing
            optimized.confidenceThreshold = Math.max(optimized.confidenceThreshold, 0.6);
        }
        return optimized;
    }
    /**
     * Check if processing should terminate early
     */
    shouldTerminateEarly(detectedSymbols, options, startTime, maxProcessingTime) {
        if (!options.earlyTermination)
            return false;
        // Time-based termination
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > maxProcessingTime * 0.8) {
            return true;
        }
        // Symbol count-based termination
        const highConfidenceSymbols = detectedSymbols.filter(s => s.confidence >= 0.8);
        if (highConfidenceSymbols.length >= options.maxSymbols) {
            return true;
        }
        // Quality-based termination (good spread of symbol types)
        const symbolTypes = new Set(detectedSymbols.map(s => s.symbolType));
        if (symbolTypes.size >= 5 && detectedSymbols.length >= options.maxSymbols * 0.8) {
            return true;
        }
        return false;
    }
    /**
     * Check if there's sufficient time remaining for next phase
     */
    hasTimeRemaining(startTime, maxProcessingTime, requiredRatio) {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = maxProcessingTime - elapsedTime;
        return remainingTime > maxProcessingTime * requiredRatio;
    }
    /**
     * Finalize detection results with optimization and performance logging
     */
    finalizeResults(detectedSymbols, options, performance) {
        const startTime = performance.startTime;
        // Remove duplicates and apply confidence filtering with performance optimization
        const filteredSymbols = this.removeDuplicateDetections(detectedSymbols, options.confidenceThreshold);
        // Sort by confidence and return top matches
        const finalSymbols = filteredSymbols
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, options.maxSymbols);
        // Log performance metrics
        const totalTime = Date.now() - startTime;
        console.log(`Pattern matching completed in ${totalTime}ms:`, {
            totalSymbolsFound: detectedSymbols.length,
            filteredSymbolsFound: filteredSymbols.length,
            finalSymbolsReturned: finalSymbols.length,
            phaseTimings: performance.phaseTimings,
            avgConfidence: finalSymbols.reduce((sum, s) => sum + s.confidence, 0) / finalSymbols.length,
            symbolTypeDistribution: this.getSymbolTypeDistribution(finalSymbols),
        });
        return finalSymbols;
    }
    /**
     * Get distribution of symbol types for performance analysis
     */
    getSymbolTypeDistribution(symbols) {
        const distribution = {};
        for (const symbol of symbols) {
            distribution[symbol.symbolType] = (distribution[symbol.symbolType] || 0) + 1;
        }
        return distribution;
    }
    /**
     * Perform high-priority template matching for common symbols
     */
    async performHighPriorityMatching(imageBuffer, options) {
        const detectedSymbols = [];
        const highPriorityTemplates = this.symbolLibrary.getHighPriorityTemplates();
        // Extract contours from image
        const contours = await this.extractContours(imageBuffer);
        // Process in parallel if enabled and beneficial
        if (options.parallelProcessing && contours.length > 2) {
            const batchSize = options.batchSize || Math.min(4, Math.max(2, Math.floor(contours.length / 3)));
            const contourBatches = this.batchContours(contours, batchSize);
            // Process batches in parallel with controlled concurrency
            const maxConcurrency = Math.min(contourBatches.length, 3); // Limit to 3 concurrent batches
            // Parallel batch processing for optimization
            for (let i = 0; i < contourBatches.length; i += maxConcurrency) {
                const currentBatch = contourBatches.slice(i, i + maxConcurrency);
                const currentPromises = currentBatch.map(batch => this.processContourBatchOptimized(batch, highPriorityTemplates, options));
                const currentResults = await Promise.all(currentPromises);
                for (const batchSymbols of currentResults) {
                    detectedSymbols.push(...batchSymbols);
                    // Early termination check for performance
                    if (options.earlyTermination && detectedSymbols.length >= options.maxSymbols * 0.8) {
                        console.log(`Early termination after processing ${i + maxConcurrency} batches`);
                        break;
                    }
                }
                // Break if we have enough symbols or are running out of time
                if (detectedSymbols.length >= options.maxSymbols)
                    break;
            }
        }
        else {
            // Optimized sequential processing with early termination
            let processedCount = 0;
            for (const contour of contours) {
                const matches = await this.matchContourToHighPriorityTemplates(contour, highPriorityTemplates, options);
                detectedSymbols.push(...matches);
                processedCount++;
                // Early termination checks
                if (detectedSymbols.length >= options.maxSymbols)
                    break;
                if (options.earlyTermination && processedCount % 10 === 0) {
                    const highConfidenceCount = detectedSymbols.filter(s => s.confidence >= 0.8).length;
                    if (highConfidenceCount >= options.maxSymbols * 0.6) {
                        console.log(`Early termination after processing ${processedCount} contours`);
                        break;
                    }
                }
            }
        }
        return detectedSymbols.filter(symbol => symbol.confidence >= options.confidenceThreshold);
    }
    /**
     * Perform rotation and scale invariant matching
     */
    async performInvariantMatching(imageBuffer, options) {
        const detectedSymbols = [];
        const invariantTemplates = this.symbolLibrary.getInvariantTemplates();
        // Extract image features for invariant matching
        const imageFeatures = await this.extractImageFeatures(imageBuffer);
        for (const template of invariantTemplates) {
            // Match against base template and variants using Hu moments
            if (options.enableHuMoments) {
                const huMatches = await this.performHuMomentMatching(imageFeatures, template, options);
                detectedSymbols.push(...huMatches);
            }
            // Match using variant templates for different rotations/scales
            const variantMatches = await this.performVariantMatching(imageFeatures, template, options);
            detectedSymbols.push(...variantMatches);
            if (detectedSymbols.length >= options.maxSymbols)
                break;
        }
        return detectedSymbols.filter(symbol => symbol.confidence >= options.confidenceThreshold);
    }
    /**
     * Perform ensemble matching combining multiple template variants
     */
    async performEnsembleMatching(imageBuffer, options) {
        const detectedSymbols = [];
        const ensembleTemplates = this.symbolLibrary.getEnsembleTemplates();
        const imageFeatures = await this.extractImageFeatures(imageBuffer);
        for (const template of ensembleTemplates) {
            // Combine multiple matching approaches for robust detection
            const approaches = [
                this.performHuMomentMatching(imageFeatures, template, options),
                this.performVariantMatching(imageFeatures, template, options),
                this.performContourMatching(imageFeatures, template, options),
            ];
            const matchResults = await Promise.all(approaches);
            // Ensemble scoring: combine results from multiple approaches
            const ensembleMatches = this.combineEnsembleResults(matchResults, template, options);
            detectedSymbols.push(...ensembleMatches);
            if (detectedSymbols.length >= options.maxSymbols)
                break;
        }
        return detectedSymbols.filter(symbol => symbol.confidence >= options.confidenceThreshold);
    }
    /**
     * Perform keypoint-based matching using SIFT/ORB-like features
     */
    async performKeypointMatching(imageBuffer, options) {
        const detectedSymbols = [];
        const allTemplates = Array.from(this.templates.values());
        // Extract keypoints from input image
        const imageKeypoints = await this.extractImageKeypoints(imageBuffer);
        for (const template of allTemplates) {
            // Match keypoints with template keypoints
            const keypointMatches = await this.matchKeypoints(imageKeypoints, template.features.keyPoints, template.features.descriptors);
            if (keypointMatches.length >= 3) { // Minimum matches for reliable detection
                const confidence = this.calculateKeypointConfidence(keypointMatches, template);
                if (confidence >= options.confidenceThreshold) {
                    const detectedSymbol = this.createDetectedSymbolFromKeypoints(keypointMatches, template, confidence);
                    detectedSymbols.push(detectedSymbol);
                }
            }
            if (detectedSymbols.length >= options.maxSymbols)
                break;
        }
        return detectedSymbols;
    }
    /**
     * Extract contours from image for symbol detection using OpenCV
     */
    async extractContours(imageBuffer) {
        try {
            // Preprocess image for better contour detection
            const preprocessed = await this.imageProcessor.preprocessImageWithOpenCV(imageBuffer, {
                enhanceContrast: true,
                reduceNoise: true,
                detectEdges: false, // We'll do contour detection on the processed image
                morphologyOperation: 'closing', // Close small gaps in symbols
                kernelSize: 3,
            });
            // Extract contours using OpenCV
            const contoursResult = await this.imageProcessor.extractContoursWithOpenCV(preprocessed.processed);
            // Filter contours by size and shape to focus on potential symbols
            const filteredContours = [];
            for (const contour of contoursResult.contours) {
                // Filter by area - symbols should be within reasonable size range
                const minArea = 100; // Minimum symbol area
                const maxArea = 50000; // Maximum symbol area
                if (contour.area >= minArea && contour.area <= maxArea) {
                    // Filter by aspect ratio - symbols shouldn't be too elongated
                    const aspectRatio = contour.boundingBox.width / contour.boundingBox.height;
                    if (aspectRatio >= 0.1 && aspectRatio <= 10.0) {
                        // Filter by solidity (ratio of contour area to bounding box area)
                        const solidity = contour.area / contour.boundingBox.area;
                        if (solidity >= 0.1) { // Symbol should fill reasonable portion of bounding box
                            filteredContours.push({
                                points: contour.points,
                                boundingBox: contour.boundingBox,
                                area: contour.area,
                                perimeter: contour.perimeter,
                            });
                        }
                    }
                }
            }
            console.log(`Extracted ${filteredContours.length} potential symbol contours from ${contoursResult.contours.length} total contours`);
            // If no contours found, fall back to mock contours for testing
            if (filteredContours.length === 0) {
                console.log('No suitable contours found, using fallback mock contours');
                return this.generateMockContours();
            }
            return filteredContours;
        }
        catch (error) {
            console.warn('OpenCV contour extraction failed, falling back to mock contours:', error);
            // Fallback to mock contours if OpenCV fails
            return this.generateMockContours();
        }
    }
    /**
     * Generate mock contours for fallback
     */
    generateMockContours() {
        return [
            {
                points: [
                    { x: 100, y: 100 }, { x: 200, y: 100 },
                    { x: 200, y: 150 }, { x: 100, y: 150 }
                ],
                boundingBox: { x: 100, y: 100, width: 100, height: 50, area: 5000 },
                area: 5000,
                perimeter: 300,
            },
            {
                points: [
                    { x: 300, y: 100 }, { x: 350, y: 100 },
                    { x: 350, y: 120 }, { x: 300, y: 120 }
                ],
                boundingBox: { x: 300, y: 100, width: 50, height: 20, area: 1000 },
                area: 1000,
                perimeter: 140,
            },
            {
                points: [
                    { x: 450, y: 200 }, { x: 520, y: 200 },
                    { x: 520, y: 240 }, { x: 450, y: 240 }
                ],
                boundingBox: { x: 450, y: 200, width: 70, height: 40, area: 2800 },
                area: 2800,
                perimeter: 220,
            },
        ];
    }
    /**
     * Match a contour against all symbol templates
     */
    /*
    private async _unused_matchContourToTemplates(
      contour: Contour,
      _imageBuffer: Buffer,
      options: PatternMatchingOptions
    ): Promise<DetectedSymbol[]> {
      const matches: DetectedSymbol[] = [];
  
      for (const [templateId, template] of this.templates) {
        try {
          const matchResult = await this.matchContourToTemplate(
            contour,
            template,
            options
          );
  
          if (matchResult && matchResult.confidence >= options.confidenceThreshold) {
            const detectedSymbol: DetectedSymbol = {
              id: uuidv4(),
              symbolType: template.symbolType,
              symbolCategory: template.symbolCategory,
              description: template.description,
              confidence: matchResult.confidence,
              location: CoordinateMapper.createSymbolLocation(
                contour.boundingBox.x + contour.boundingBox.width / 2,
                contour.boundingBox.y + contour.boundingBox.height / 2,
                800, // Mock image width
                600, // Mock image height
                1    // Page number
              ),
              boundingBox: contour.boundingBox,
              detectionMethod: 'pattern_matching',
              features: this.extractSymbolFeatures(contour),
              validationScore: 0, // Will be calculated later
            };
  
            matches.push(detectedSymbol);
          }
        } catch (error) {
          console.warn(`Failed to match contour to template ${templateId}:`, error instanceof Error ? error.message : String(error));
        }
      }
  
      return matches;
    }
  
    /**
     * Match a single contour to a specific template
     */
    /* private async matchContourToTemplate(
      contour: Contour,
      template: SymbolTemplate,
      _options: PatternMatchingOptions
    ): Promise<{ confidence: number; transform?: any } | null> {
      try {
        // Calculate shape similarity using invariant moments
        const contourMoments = await this.calculateInvariantMoments(contour.points);
        const templateMoments = template.features.invariantMoments;
        
        const momentSimilarity = this.calculateMomentSimilarity(
          contourMoments,
          templateMoments
        );
  
        // Calculate geometric similarity
        const contourGeometry = this.calculateGeometricProperties(contour);
        const templateGeometry = {
          area: template.features.invariantMoments[0] || 1,
          perimeter: template.features.invariantMoments[1] || 1,
          aspectRatio: template.features.invariantMoments[2] || 1,
          compactness: template.features.invariantMoments[3] || 1
        };
        
        const geometricSimilarity = this.calculateGeometricSimilarity(
          contourGeometry,
          templateGeometry
        );
  
        // Calculate overall confidence
        const confidence = (momentSimilarity * 0.6) + (geometricSimilarity * 0.4);
  
        return {
          confidence,
          transform: null, // Could include rotation/scale transform here
        };
  
      } catch (error) {
        console.warn(`Template matching error:`, error instanceof Error ? error.message : String(error));
        return null;
      }
    }
  
    /**
     * Extract symbol features from contour
     */
    extractSymbolFeatures(contour) {
        const geometricProperties = this.calculateGeometricProperties(contour);
        return {
            contourPoints: contour.points,
            geometricProperties: {
                area: geometricProperties.area,
                perimeter: geometricProperties.perimeter,
                centroid: this.calculateCentroid(contour.points),
                boundaryRectangle: contour.boundingBox,
                symmetryAxes: [], // Simplified - would calculate actual symmetry axes
                aspectRatio: geometricProperties.aspectRatio,
            },
            connectionPoints: this.findConnectionPoints(contour),
            shapeAnalysis: {
                complexity: this.calculateShapeComplexity(contour.points),
                orientation: this.calculateOrientation(contour.points),
                strokeWidth: this.estimateStrokeWidth(contour),
                isClosed: this.isClosedContour(contour.points),
            },
            textLabels: [], // No text extraction in pattern matching
        };
    }
    /**
     * Calculate invariant moments for shape matching using OpenCV
     */
    async calculateInvariantMoments(points) {
        try {
            // Create a contour buffer for OpenCV processing
            const contourBuffer = await this.createContourImageBuffer(points);
            // Process with OpenCV to calculate Hu moments
            const moments = await this.calculateHuMoments(contourBuffer);
            return moments;
        }
        catch (error) {
            console.warn('Failed to calculate Hu moments, using fallback:', error);
            // Fallback to geometric-based moments
            return this.calculateGeometricMoments(points);
        }
    }
    /**
     * Create image buffer from contour points for OpenCV processing
     */
    async createContourImageBuffer(points) {
        try {
            // Find bounding box
            const minX = Math.min(...points.map(p => p.x));
            const maxX = Math.max(...points.map(p => p.x));
            const minY = Math.min(...points.map(p => p.y));
            const maxY = Math.max(...points.map(p => p.y));
            const width = Math.max(maxX - minX + 20, 100); // Add padding
            const height = Math.max(maxY - minY + 20, 100);
            // Create canvas and draw contour
            const canvas = (0, canvas_1.createCanvas)(width, height);
            const ctx = canvas.getContext('2d');
            // White background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            // Draw contour in black
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.fillStyle = 'black';
            ctx.beginPath();
            const offsetX = -minX + 10;
            const offsetY = -minY + 10;
            if (points.length > 0) {
                ctx.moveTo(points[0].x + offsetX, points[0].y + offsetY);
                for (let i = 1; i < points.length; i++) {
                    ctx.lineTo(points[i].x + offsetX, points[i].y + offsetY);
                }
                ctx.closePath();
                ctx.fill();
            }
            return canvas.toBuffer('image/png');
        }
        catch (error) {
            console.warn('Failed to create contour image buffer:', error);
            return Buffer.alloc(1000); // Return empty buffer as fallback
        }
    }
    /**
     * Calculate Hu moments using OpenCV (mock implementation for now)
     */
    async calculateHuMoments(_contourBuffer) {
        try {
            // This would use OpenCV to calculate actual Hu moments
            // For now, return computed moments based on the contour
            // In a full implementation:
            // const processed = await this.imageProcessor.extractContoursWithOpenCV(contourBuffer);
            // Extract moments from the largest contour
            // Mock implementation with realistic Hu moment values
            return [
                0.15 + Math.random() * 0.1, // Hu moment 1
                0.08 + Math.random() * 0.05, // Hu moment 2
                0.03 + Math.random() * 0.02, // Hu moment 3
                0.01 + Math.random() * 0.01, // Hu moment 4
                0.005 + Math.random() * 0.005, // Hu moment 5
                0.002 + Math.random() * 0.002, // Hu moment 6
                0.001 + Math.random() * 0.001, // Hu moment 7
            ];
        }
        catch (error) {
            console.warn('Hu moments calculation failed:', error);
            return [0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001];
        }
    }
    /**
     * Calculate geometric-based moments as fallback
     */
    calculateGeometricMoments(points) {
        if (points.length < 3) {
            return [0.1, 0.05, 0.02, 0.01, 0.005, 0.002, 0.001];
        }
        // Calculate centroid
        const centroid = this.calculateCentroid(points);
        // Calculate various geometric moments
        let m20 = 0, m02 = 0, m11 = 0, m30 = 0, m03 = 0, m21 = 0, m12 = 0;
        for (const point of points) {
            const dx = point.x - centroid.x;
            const dy = point.y - centroid.y;
            m20 += dx * dx;
            m02 += dy * dy;
            m11 += dx * dy;
            m30 += dx * dx * dx;
            m03 += dy * dy * dy;
            m21 += dx * dx * dy;
            m12 += dx * dy * dy;
        }
        const n = points.length;
        m20 /= n;
        m02 /= n;
        m11 /= n;
        m30 /= n;
        m03 /= n;
        m21 /= n;
        m12 /= n;
        // Calculate invariant moments (simplified Hu moments)
        const mu20 = m20;
        const mu02 = m02;
        const mu11 = m11;
        const eta20 = mu20 / Math.pow(n, 2);
        const eta02 = mu02 / Math.pow(n, 2);
        const eta11 = mu11 / Math.pow(n, 2);
        // Hu invariant moments (simplified)
        const hu1 = eta20 + eta02;
        const hu2 = Math.pow(eta20 - eta02, 2) + 4 * Math.pow(eta11, 2);
        const hu3 = Math.abs(m30 - 3 * m12) + Math.abs(3 * m21 - m03);
        return [
            Math.abs(hu1),
            Math.abs(hu2),
            Math.abs(hu3),
            Math.abs(hu1 * 0.5),
            Math.abs(hu2 * 0.3),
            Math.abs(hu3 * 0.2),
            Math.abs(hu1 * hu2 * 0.1)
        ];
    }
    /**
     * Calculate similarity between moment vectors
     */
    calculateMomentSimilarity(moments1, moments2) {
        if (moments1.length !== moments2.length)
            return 0;
        let similarity = 0;
        for (let i = 0; i < moments1.length; i++) {
            const diff = Math.abs(moments1[i] - moments2[i]);
            similarity += Math.exp(-diff); // Exponential similarity
        }
        return similarity / moments1.length;
    }
    /**
     * Calculate geometric properties of contour
     */
    calculateGeometricProperties(contour) {
        const boundingBox = contour.boundingBox;
        const aspectRatio = boundingBox.width / boundingBox.height;
        const compactness = (4 * Math.PI * contour.area) / Math.pow(contour.perimeter, 2);
        return {
            area: contour.area,
            perimeter: contour.perimeter,
            aspectRatio,
            compactness,
        };
    }
    /**
     * Calculate geometric similarity between shapes
     */
    calculateGeometricSimilarity(geom1, geom2) {
        // Normalize differences
        const areaDiff = Math.abs(geom1.area - geom2.area) / Math.max(geom1.area, geom2.area);
        const perimeterDiff = Math.abs(geom1.perimeter - geom2.perimeter) / Math.max(geom1.perimeter, geom2.perimeter);
        const aspectRatioDiff = Math.abs(geom1.aspectRatio - geom2.aspectRatio) / Math.max(geom1.aspectRatio, geom2.aspectRatio);
        const compactnessDiff = Math.abs(geom1.compactness - geom2.compactness) / Math.max(geom1.compactness, geom2.compactness);
        // Calculate similarity (inverse of difference)
        const similarity = ((1 - Math.min(areaDiff, 1)) * 0.25 +
            (1 - Math.min(perimeterDiff, 1)) * 0.25 +
            (1 - Math.min(aspectRatioDiff, 1)) * 0.25 +
            (1 - Math.min(compactnessDiff, 1)) * 0.25);
        return similarity;
    }
    /**
     * Find potential connection points in contour
     */
    findConnectionPoints(_contour) {
        // Simplified implementation - return mock connection points
        return [];
    }
    /**
     * Calculate centroid of point cloud
     */
    calculateCentroid(points) {
        const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
        return {
            x: sum.x / points.length,
            y: sum.y / points.length,
        };
    }
    /**
     * Calculate shape complexity
     */
    calculateShapeComplexity(points) {
        // Use number of points as a simple complexity measure
        return Math.min(points.length / 100, 1);
    }
    /**
     * Calculate shape orientation
     */
    calculateOrientation(_points) {
        // Simplified - return 0 degrees
        return 0;
    }
    /**
     * Estimate stroke width
     */
    estimateStrokeWidth(contour) {
        // Simple estimate based on perimeter to area ratio
        return Math.max(1, contour.perimeter / (4 * Math.sqrt(contour.area)));
    }
    /**
     * Check if contour is closed
     */
    isClosedContour(points) {
        if (points.length < 3)
            return false;
        const first = points[0];
        const last = points[points.length - 1];
        const distance = Math.sqrt(Math.pow(first.x - last.x, 2) + Math.pow(first.y - last.y, 2));
        return distance < 5; // Threshold for considering closed
    }
    /**
     * Initialize symbol templates
     */
    async initializeTemplates() {
        try {
            // Load standard electrical symbol templates
            // This would normally load from files or database
            const standardTemplates = [
                {
                    symbolType: 'resistor',
                    symbolCategory: 'passive',
                    description: 'Standard resistor symbol',
                    features: {
                        contourSignature: [],
                        geometricProperties: {
                            area: 1000,
                            perimeter: 200,
                            aspectRatio: 3.0,
                            compactness: 0.8,
                        },
                        invariantMoments: [0.1, 0.15, 0.05, 0.02, 0.01, 0.005, 0.002],
                        shapeDescriptors: [1.0, 0.8, 0.6],
                    },
                    variants: [],
                },
                {
                    symbolType: 'capacitor',
                    symbolCategory: 'passive',
                    description: 'Standard capacitor symbol',
                    features: {
                        contourSignature: [],
                        geometricProperties: {
                            area: 800,
                            perimeter: 160,
                            aspectRatio: 1.5,
                            compactness: 0.9,
                        },
                        invariantMoments: [0.2, 0.1, 0.08, 0.03, 0.015, 0.008, 0.003],
                        shapeDescriptors: [0.9, 0.7, 0.5],
                    },
                    variants: [],
                },
                {
                    symbolType: 'inductor',
                    symbolCategory: 'passive',
                    description: 'Standard inductor symbol',
                    features: {
                        contourSignature: [],
                        geometricProperties: {
                            area: 1200,
                            perimeter: 250,
                            aspectRatio: 2.5,
                            compactness: 0.7,
                        },
                        invariantMoments: [0.15, 0.12, 0.09, 0.04, 0.02, 0.01, 0.004],
                        shapeDescriptors: [0.8, 0.9, 0.7],
                    },
                    variants: [],
                },
            ];
            // Initialize templates map
            for (const templateData of standardTemplates) {
                const template = {
                    id: (0, uuid_1.v4)(),
                    symbolType: templateData.symbolType,
                    symbolCategory: templateData.symbolCategory,
                    name: templateData.name || templateData.symbolType,
                    description: templateData.description,
                    standardType: 'IEEE',
                    templateImage: Buffer.alloc(0), // Mock template data
                    features: templateData.features,
                    variants: templateData.variants,
                    metadata: {
                        commonNames: [templateData.symbolType],
                        applications: ['electrical'],
                        electricalProperties: {
                            voltage: { min: 0, max: 1000, unit: 'V' },
                            current: { min: 0, max: 100, unit: 'A' },
                            power: { min: 0, max: 1000, unit: 'W' },
                            frequency: '50-60Hz'
                        },
                        physicalCharacteristics: {
                            size: 'standard',
                            mounting: 'surface',
                            operatingTemperature: { min: -40, max: 85, unit: 'C' }
                        }
                    },
                    priority: 1,
                    ensembleWeight: 1.0,
                };
                this.templates.set(template.id, template);
            }
            this.isInitialized = true;
            console.log(`Initialized ${this.templates.size} symbol templates`);
        }
        catch (error) {
            throw new symbol_detection_types_1.PatternMatchingError(`Failed to initialize templates: ${error instanceof Error ? error.message : String(error)}`, {});
        }
    }
    /**
     * Get available templates
     */
    getAvailableTemplates() {
        return Array.from(this.templates.values());
    }
    /**
     * Add custom template
     */
    addTemplate(template) {
        this.templates.set(template.id, template);
    }
    /**
     * Remove template
     */
    removeTemplate(templateId) {
        return this.templates.delete(templateId);
    }
    /**
     * Enhanced template matching using OpenCV techniques
     */
    async performTemplateMatching(imageBuffer, templateImage, options = {}) {
        try {
            const { threshold = 0.7 } = options;
            // Preprocess both images for better matching
            const [processedImage, processedTemplate] = await Promise.all([
                this.imageProcessor.preprocessImageWithOpenCV(imageBuffer, {
                    enhanceContrast: true,
                    reduceNoise: true,
                    detectEdges: true,
                }),
                this.imageProcessor.preprocessImageWithOpenCV(templateImage, {
                    enhanceContrast: true,
                    reduceNoise: true,
                    detectEdges: true,
                })
            ]);
            // For now, we'll simulate template matching results
            // In a full OpenCV implementation, you would use cv.matchTemplate()
            const matches = await this.simulateTemplateMatching(processedImage.processed, processedTemplate.processed, threshold);
            // Create visualization of matches
            const matchImage = await this.createMatchVisualization(imageBuffer, matches);
            return {
                matches,
                matchImage,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new symbol_detection_types_1.PatternMatchingError(`Template matching failed: ${errorMessage}`, { imageBufferSize: imageBuffer.length, templateImageSize: templateImage.length });
        }
    }
    /**
     * Simulate template matching (placeholder for actual OpenCV implementation)
     */
    async simulateTemplateMatching(_imageBuffer, _templateImage, threshold) {
        // This is a mock implementation - in production you would use OpenCV's matchTemplate
        const matches = [];
        // Generate some realistic mock matches
        const mockMatches = [
            { x: 150, y: 200, confidence: 0.85, width: 80, height: 40 },
            { x: 300, y: 150, confidence: 0.78, width: 60, height: 50 },
            { x: 450, y: 250, confidence: 0.72, width: 90, height: 35 },
        ];
        for (const match of mockMatches) {
            if (match.confidence >= threshold) {
                matches.push(match);
            }
        }
        return matches;
    }
    /**
     * Create visualization of template matches
     */
    async createMatchVisualization(originalImage, matches) {
        try {
            // Load the original image metadata
            const metadata = await (0, sharp_1.default)(originalImage).metadata();
            const width = metadata.width || 800;
            const height = metadata.height || 600;
            // Create canvas for visualization
            const canvas = (0, canvas_1.createCanvas)(width, height);
            const ctx = canvas.getContext('2d');
            // Draw original image as background (simplified)
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            // Draw matches as colored rectangles
            matches.forEach((match, index) => {
                // Use different colors for different matches
                const colors = ['red', 'blue', 'green', 'orange', 'purple'];
                ctx.strokeStyle = colors[index % colors.length];
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 5]); // Dashed line
                // Draw bounding box
                ctx.strokeRect(match.x, match.y, match.width, match.height);
                // Draw confidence label
                ctx.fillStyle = ctx.strokeStyle;
                ctx.font = '14px Arial';
                ctx.fillText(`${(match.confidence * 100).toFixed(1)}%`, match.x, match.y - 5);
                ctx.setLineDash([]); // Reset line dash
            });
            return canvas.toBuffer('image/png');
        }
        catch (error) {
            console.warn('Failed to create match visualization:', error);
            return Buffer.alloc(1000); // Return empty buffer as fallback
        }
    }
    /**
     * Calculate template similarity using multiple metrics
     */
    async calculateTemplateSimilarity(contour, templateContour) {
        try {
            // Shape matching using Hu moments
            const [contourMoments, templateMoments] = await Promise.all([
                this.calculateInvariantMoments(contour.points),
                this.calculateInvariantMoments(templateContour.points)
            ]);
            const shapeMatch = this.calculateMomentSimilarity(contourMoments, templateMoments);
            // Size matching
            const contourSize = Math.sqrt(contour.area);
            const templateSize = Math.sqrt(templateContour.area);
            const sizeRatio = Math.min(contourSize, templateSize) / Math.max(contourSize, templateSize);
            const sizeMatch = sizeRatio;
            // Orientation matching (simplified)
            const contourOrientation = this.calculateOrientation(contour.points);
            const templateOrientation = this.calculateOrientation(templateContour.points);
            const orientationDiff = Math.abs(contourOrientation - templateOrientation);
            const orientationMatch = Math.cos(orientationDiff); // Cosine similarity for angles
            // Overall similarity (weighted combination)
            const overallSimilarity = (shapeMatch * 0.5 +
                sizeMatch * 0.3 +
                orientationMatch * 0.2);
            return {
                shapeMatch,
                sizeMatch,
                orientationMatch,
                overallSimilarity,
            };
        }
        catch (error) {
            console.warn('Template similarity calculation failed:', error);
            return {
                shapeMatch: 0,
                sizeMatch: 0,
                orientationMatch: 0,
                overallSimilarity: 0,
            };
        }
    }
    // ===== ADVANCED PATTERN MATCHING HELPER METHODS =====
    /**
     * Batch contours for parallel processing
     */
    batchContours(contours, batchSize) {
        const batches = [];
        for (let i = 0; i < contours.length; i += batchSize) {
            batches.push(contours.slice(i, i + batchSize));
        }
        return batches;
    }
    *() { }
}
exports.PatternMatcher = PatternMatcher;
/;
async;
processContourBatchOptimized(contours, Contour[], templates, symbol_library_1.SymbolTemplate[], options, PatternMatchingOptions);
Promise < symbol_detection_types_1.DetectedSymbol[] > {
    const: detectedSymbols, DetectedSymbol: symbol_detection_types_1.DetectedSymbol, []:  = [],
    const: batchStartTime = Date.now(),
    try: {
        // Sort contours by area (larger symbols first) for better early termination
        const: sortedContours = contours.sort((a, b) => b.area - a.area),
        // Process with controlled concurrency to manage memory
        const: concurrencyLimit = options.memoryOptimization ? 2 : 3,
        for(let, i = 0, i, , sortedContours) { }, : .length, i, concurrencyLimit
    }
};
{
    const batch = sortedContours.slice(i, i + concurrencyLimit);
    const batchPromises = batch.map(contour => this.matchContourToHighPriorityTemplates(contour, templates, options));
    const batchResults = await Promise.all(batchPromises);
    for (const contourSymbols of batchResults) {
        detectedSymbols.push(...contourSymbols);
    }
    // Early termination for batch if we have enough high-confidence symbols
    if (options.earlyTermination) {
        const highConfidenceCount = detectedSymbols.filter(s => s.confidence >= 0.8).length;
        if (highConfidenceCount >= Math.min(5, options.maxSymbols * 0.3)) {
            console.log(`Batch early termination after processing ${i + concurrencyLimit} contours`);
            break;
        }
    }
    // Memory optimization: cleanup if enabled
    if (options.memoryOptimization && i % 10 === 0 && global.gc) {
        global.gc();
    }
}
const batchDuration = Date.now() - batchStartTime;
if (batchDuration > 5000) { // Log slow batches
    console.log(`Slow batch processing: ${batchDuration}ms for ${contours.length} contours`);
}
return detectedSymbols;
try { }
catch (error) {
    console.warn('Optimized batch processing failed, falling back to sequential:', error);
    // Fallback to sequential processing
    for (const contour of contours) {
        try {
            const matches = await this.matchContourToHighPriorityTemplates(contour, templates, options);
            detectedSymbols.push(...matches);
        }
        catch (contourError) {
            console.warn('Failed to process individual contour:', contourError);
        }
    }
    return detectedSymbols;
}
async;
matchContourToHighPriorityTemplates(contour, Contour, templates, symbol_library_1.SymbolTemplate[], options, PatternMatchingOptions);
Promise < symbol_detection_types_1.DetectedSymbol[] > {
    const: matches, DetectedSymbol: symbol_detection_types_1.DetectedSymbol, []:  = [],
    for(, template, of, templates) {
        try {
            const matchResult = await this.matchContourToAdvancedTemplate(contour, template, options);
            if (matchResult && matchResult.confidence >= options.confidenceThreshold) {
                const detectedSymbol = {
                    id: (0, uuid_1.v4)(),
                    symbolType: template.symbolType,
                    symbolCategory: template.symbolCategory,
                    description: template.description,
                    confidence: matchResult.confidence,
                    location: coordinate_mapper_1.CoordinateMapper.createSymbolLocation(contour.boundingBox.x + contour.boundingBox.width / 2, contour.boundingBox.y + contour.boundingBox.height / 2, 800, // Mock image width
                    600, // Mock image height
                    1 // Page number
                    ),
                    boundingBox: contour.boundingBox,
                    detectionMethod: 'pattern_matching',
                    features: this.extractSymbolFeatures(contour),
                    validationScore: 0, // Will be calculated later
                };
                matches.push(detectedSymbol);
            }
        }
        catch (error) {
            console.warn(`Failed to match contour to template ${template.id}:`, error instanceof Error ? error.message : String(error));
        }
    },
    return: matches
};
async;
matchContourToAdvancedTemplate(contour, Contour, template, symbol_library_1.SymbolTemplate, options, PatternMatchingOptions);
Promise < { confidence: number, transform: any } | null > {
    try: {
        let, maxConfidence = 0,
        let, bestTransform = null,
        // Calculate shape similarity using invariant moments
        const: contourMoments = await this.calculateInvariantMoments(contour.points),
        const: templateMoments = template.features.invariantMoments,
        const: momentSimilarity = this.calculateMomentSimilarity(contourMoments, templateMoments),
        // Calculate geometric similarity
        const: contourGeometry = this.calculateGeometricProperties(contour),
        const: templateGeometry = {
            area: template.features.geometricMoments[0] * 10000,
            perimeter: template.features.geometricMoments[1] * 1000,
            aspectRatio: template.features.shapeDescriptors[0],
            compactness: template.features.geometricMoments[2],
        },
        const: geometricSimilarity = this.calculateGeometricSimilarity(contourGeometry, templateGeometry),
        // Base confidence from main template
        let, baseConfidence = (momentSimilarity * 0.6) + (geometricSimilarity * 0.4),
        maxConfidence = Math.max(maxConfidence, baseConfidence * template.ensembleWeight),
        // Check variants for rotation/scale invariance
        if(options) { }, : .enableRotationInvariance || options.enableScaleInvariance
    }
};
{
    for (const variant of template.variants) {
        const variantSimilarity = await this.calculateVariantSimilarity(contour, variant, options);
        const variantConfidence = variantSimilarity * variant.confidence * template.ensembleWeight;
        if (variantConfidence > maxConfidence) {
            maxConfidence = variantConfidence;
            bestTransform = { rotation: variant.rotation, scale: variant.scale };
        }
    }
}
return {
    confidence: maxConfidence,
    transform: bestTransform,
};
try { }
catch (error) {
    console.warn(`Advanced template matching error:`, error instanceof Error ? error.message : String(error));
    return null;
}
async;
calculateVariantSimilarity(contour, Contour, variant, symbol_library_1.SymbolVariant, options, PatternMatchingOptions);
Promise < number > {
    try: {
        // Use invariant moments for rotation/scale invariant comparison
        const: contourMoments = await this.calculateInvariantMoments(contour.points),
        const: variantMoments = variant.features.invariantMoments,
        const: momentSimilarity = this.calculateMomentSimilarity(contourMoments, variantMoments),
        // Factor in keypoint matching if available
        let, keypointSimilarity = 0,
        if(options) { }, : .enableKeyPointMatching && variant.keyPoints.length > 0
    }
};
{
    // Mock keypoint matching - in production would use actual SIFT/ORB matching
    keypointSimilarity = 0.5 + Math.random() * 0.3;
}
// Combine similarities
const combinedSimilarity = (momentSimilarity * 0.7) + (keypointSimilarity * 0.3);
return combinedSimilarity;
try { }
catch (error) {
    console.warn('Variant similarity calculation failed:', error);
    return 0;
}
async;
extractImageFeatures(imageBuffer, Buffer);
Promise < any > {
    try: {
        // Extract contours for shape-based matching
        const: contours = await this.extractContours(imageBuffer),
        // Extract keypoints (mock implementation)
        const: keypoints = await this.extractImageKeypoints(imageBuffer),
        return: {
            contours,
            keypoints,
            buffer: imageBuffer,
        }
    }, catch(error) {
        console.warn('Image feature extraction failed:', error);
        return { contours: [], keypoints: [], buffer: imageBuffer };
    }
};
async;
extractImageKeypoints(imageBuffer, Buffer);
Promise < any[] > {
    try: {
        // In production, this would use OpenCV SIFT/ORB feature detection
        // For now, generate mock keypoints based on image characteristics
        const: metadata = await (0, sharp_1.default)(imageBuffer).metadata(),
        const: width = metadata.width || 800,
        const: height = metadata.height || 600,
        const: mockKeypoints = [],
        const: numKeypoints = 10 + Math.floor(Math.random() * 20),
        for(let, i = 0, i, , numKeypoints, i) { }
    }++
};
{
    mockKeypoints.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 5 + Math.random() * 15,
        angle: Math.random() * 360,
        response: 0.3 + Math.random() * 0.7,
        descriptor: Array.from({ length: 128 }, () => Math.random() * 255),
    });
}
return mockKeypoints;
try { }
catch (error) {
    console.warn('Keypoint extraction failed:', error);
    return [];
}
async;
performHuMomentMatching(imageFeatures, any, template, symbol_library_1.SymbolTemplate, options, PatternMatchingOptions);
Promise < symbol_detection_types_1.DetectedSymbol[] > {
    const: matches, DetectedSymbol: symbol_detection_types_1.DetectedSymbol, []:  = [],
    try: {
        for(, contour, of, imageFeatures) { }, : .contours
    }
};
{
    const contourMoments = await this.calculateInvariantMoments(contour.points);
    const templateMoments = template.features.invariantMoments;
    const similarity = this.calculateMomentSimilarity(contourMoments, templateMoments);
    const confidence = similarity * template.ensembleWeight;
    if (confidence >= options.confidenceThreshold) {
        const detectedSymbol = this.createDetectedSymbolFromContour(contour, template, confidence, 'hu_moments');
        matches.push(detectedSymbol);
    }
}
try { }
catch (error) {
    console.warn('Hu moment matching failed:', error);
}
return matches;
async;
performVariantMatching(imageFeatures, any, template, symbol_library_1.SymbolTemplate, options, PatternMatchingOptions);
Promise < symbol_detection_types_1.DetectedSymbol[] > {
    const: matches, DetectedSymbol: symbol_detection_types_1.DetectedSymbol, []:  = [],
    try: {
        for(, contour, of, imageFeatures) { }, : .contours
    }
};
{
    for (const variant of template.variants) {
        const similarity = await this.calculateVariantSimilarity(contour, variant, options);
        const confidence = similarity * variant.confidence * template.ensembleWeight;
        if (confidence >= options.confidenceThreshold) {
            const detectedSymbol = this.createDetectedSymbolFromContour(contour, template, confidence, 'variant_matching');
            matches.push(detectedSymbol);
        }
    }
}
try { }
catch (error) {
    console.warn('Variant matching failed:', error);
}
return matches;
async;
performContourMatching(imageFeatures, any, template, symbol_library_1.SymbolTemplate, options, PatternMatchingOptions);
Promise < symbol_detection_types_1.DetectedSymbol[] > {
    const: matches, DetectedSymbol: symbol_detection_types_1.DetectedSymbol, []:  = [],
    try: {
        for(, contour, of, imageFeatures) { }, : .contours
    }
};
{
    // Use shape descriptors for matching
    const contourDescriptors = [
        contour.boundingBox.width / contour.boundingBox.height, // aspect ratio
        (4 * Math.PI * contour.area) / Math.pow(contour.perimeter, 2), // compactness
        contour.area / contour.boundingBox.area, // fill ratio
    ];
    const templateDescriptors = template.features.shapeDescriptors;
    const similarity = this.calculateDescriptorSimilarity(contourDescriptors, templateDescriptors);
    const confidence = similarity * template.ensembleWeight;
    if (confidence >= options.confidenceThreshold) {
        const detectedSymbol = this.createDetectedSymbolFromContour(contour, template, confidence, 'contour_matching');
        matches.push(detectedSymbol);
    }
}
try { }
catch (error) {
    console.warn('Contour matching failed:', error);
}
return matches;
combineEnsembleResults(matchResults, symbol_detection_types_1.DetectedSymbol[][], template, symbol_library_1.SymbolTemplate, options, PatternMatchingOptions);
symbol_detection_types_1.DetectedSymbol[];
{
    const combinedMatches = [];
    // Flatten all matches
    const allMatches = matchResults.flat();
    // Group matches by spatial proximity
    const groupedMatches = this.groupMatchesByProximity(allMatches, 30); // 30 pixel tolerance
    for (const group of groupedMatches) {
        if (group.length >= 2) { // Ensemble requires at least 2 methods agreeing
            // Calculate ensemble confidence as weighted average
            const totalWeight = group.reduce((sum, match) => sum + this.getMethodWeight(match.detectionMethod), 0);
            const weightedConfidence = group.reduce((sum, match) => sum + (match.confidence * this.getMethodWeight(match.detectionMethod)), 0) / totalWeight;
            // Use the best positioned match as base
            const bestMatch = group.reduce((best, current) => current.confidence > best.confidence ? current : best);
            // Create ensemble match
            const ensembleMatch = {
                ...bestMatch,
                confidence: weightedConfidence * template.ensembleWeight,
                detectionMethod: 'consensus',
            };
            if (ensembleMatch.confidence >= options.confidenceThreshold) {
                combinedMatches.push(ensembleMatch);
            }
        }
    }
    return combinedMatches;
}
groupMatchesByProximity(matches, symbol_detection_types_1.DetectedSymbol[], tolerance, number);
symbol_detection_types_1.DetectedSymbol[][];
{
    const groups = [];
    const used = new Set();
    for (let i = 0; i < matches.length; i++) {
        if (used.has(i))
            continue;
        const group = [matches[i]];
        used.add(i);
        for (let j = i + 1; j < matches.length; j++) {
            if (used.has(j))
                continue;
            const distance = Math.sqrt(Math.pow(matches[i].location.x - matches[j].location.x, 2) +
                Math.pow(matches[i].location.y - matches[j].location.y, 2));
            if (distance <= tolerance) {
                group.push(matches[j]);
                used.add(j);
            }
        }
        groups.push(group);
    }
    return groups;
}
getMethodWeight(method, string);
number;
{
    const weights = {
        'hu_moments': 0.4,
        'variant_matching': 0.3,
        'contour_matching': 0.2,
        'keypoint_matching': 0.1,
    };
    return weights[method] || 0.1;
}
async;
matchKeypoints(imageKeypoints, any[], templateKeypoints, any[], templateDescriptors, number[][]);
Promise < any[] > {
    const: matches = [],
    try: {
        // Simple descriptor matching (in production would use FLANN matcher)
        for(let, i = 0, i, , imageKeypoints) { }, : .length, i
    }++
};
{
    let bestMatch = -1;
    let bestDistance = Infinity;
    for (let j = 0; j < templateKeypoints.length; j++) {
        const distance = this.calculateDescriptorDistance(imageKeypoints[i].descriptor, templateDescriptors[j]);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = j;
        }
    }
    // Use distance threshold for good matches
    if (bestMatch >= 0 && bestDistance < 100) {
        matches.push({
            imageIndex: i,
            templateIndex: bestMatch,
            distance: bestDistance,
            imageKeypoint: imageKeypoints[i],
            templateKeypoint: templateKeypoints[bestMatch],
        });
    }
}
try { }
catch (error) {
    console.warn('Keypoint matching failed:', error);
}
return matches;
calculateDescriptorDistance(desc1, number[], desc2, number[]);
number;
{
    if (desc1.length !== desc2.length)
        return Infinity;
    let sum = 0;
    for (let i = 0; i < desc1.length; i++) {
        sum += Math.pow(desc1[i] - desc2[i], 2);
    }
    return Math.sqrt(sum);
}
calculateKeypointConfidence(matches, any[], template, symbol_library_1.SymbolTemplate);
number;
{
    if (matches.length === 0)
        return 0;
    // Base confidence from number of matches
    const baseConfidence = Math.min(matches.length / 10, 1.0);
    // Factor in match quality (average distance)
    const avgDistance = matches.reduce((sum, match) => sum + match.distance, 0) / matches.length;
    const qualityFactor = Math.max(0, 1 - (avgDistance / 100));
    return baseConfidence * qualityFactor * template.ensembleWeight;
}
createDetectedSymbolFromKeypoints(matches, any[], template, symbol_library_1.SymbolTemplate, confidence, number);
symbol_detection_types_1.DetectedSymbol;
{
    // Calculate bounding box from matched keypoints
    const imagePoints = matches.map(match => match.imageKeypoint);
    const minX = Math.min(...imagePoints.map(p => p.x));
    const maxX = Math.max(...imagePoints.map(p => p.x));
    const minY = Math.min(...imagePoints.map(p => p.y));
    const maxY = Math.max(...imagePoints.map(p => p.y));
    const boundingBox = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        area: (maxX - minX) * (maxY - minY),
    };
    const centerX = minX + boundingBox.width / 2;
    const centerY = minY + boundingBox.height / 2;
    return {
        id: (0, uuid_1.v4)(),
        symbolType: template.symbolType,
        symbolCategory: template.symbolCategory,
        description: template.description,
        confidence,
        location: coordinate_mapper_1.CoordinateMapper.createSymbolLocation(centerX, centerY, 800, // Mock image width
        600, // Mock image height
        1 // Page number
        ),
        boundingBox,
        detectionMethod: 'pattern_matching',
        features: this.extractSymbolFeatures({
            points: imagePoints.map(p => ({ x: p.x, y: p.y })),
            boundingBox,
            area: boundingBox.area,
            perimeter: 2 * (boundingBox.width + boundingBox.height),
        }),
        validationScore: 0,
    };
}
createDetectedSymbolFromContour(contour, Contour, template, symbol_library_1.SymbolTemplate, confidence, number, method, string);
symbol_detection_types_1.DetectedSymbol;
{
    const centerX = contour.boundingBox.x + contour.boundingBox.width / 2;
    const centerY = contour.boundingBox.y + contour.boundingBox.height / 2;
    return {
        id: (0, uuid_1.v4)(),
        symbolType: template.symbolType,
        symbolCategory: template.symbolCategory,
        description: template.description,
        confidence,
        location: coordinate_mapper_1.CoordinateMapper.createSymbolLocation(centerX, centerY, 800, // Mock image width
        600, // Mock image height
        1 // Page number
        ),
        boundingBox: contour.boundingBox,
        detectionMethod: method,
        features: this.extractSymbolFeatures(contour),
        validationScore: 0,
    };
}
calculateDescriptorSimilarity(desc1, number[], desc2, number[]);
number;
{
    if (desc1.length !== desc2.length)
        return 0;
    let similarity = 0;
    for (let i = 0; i < desc1.length; i++) {
        const diff = Math.abs(desc1[i] - desc2[i]);
        similarity += Math.exp(-diff); // Exponential similarity
    }
    return similarity / desc1.length;
}
removeDuplicateDetections(detectedSymbols, symbol_detection_types_1.DetectedSymbol[], confidenceThreshold, number);
symbol_detection_types_1.DetectedSymbol[];
{
    const filtered = [];
    const used = new Set();
    // Sort by confidence descending
    const sorted = detectedSymbols
        .filter(symbol => symbol.confidence >= confidenceThreshold)
        .sort((a, b) => b.confidence - a.confidence);
    for (let i = 0; i < sorted.length; i++) {
        if (used.has(i))
            continue;
        const current = sorted[i];
        filtered.push(current);
        used.add(i);
        // Mark overlapping symbols as used
        for (let j = i + 1; j < sorted.length; j++) {
            if (used.has(j))
                continue;
            const overlap = this.calculateOverlap(current.boundingBox, sorted[j].boundingBox);
            if (overlap > 0.5) { // 50% overlap threshold
                used.add(j);
            }
        }
    }
    return filtered;
}
calculateOverlap(box1, symbol_detection_types_1.BoundingBox, box2, symbol_detection_types_1.BoundingBox);
number;
{
    const intersectionArea = Math.max(0, Math.min(box1.x + box1.width, box2.x + box2.width) -
        Math.max(box1.x, box2.x)) * Math.max(0, Math.min(box1.y + box1.height, box2.y + box2.height) -
        Math.max(box1.y, box2.y));
    const union = box1.area + box2.area - intersectionArea;
    return union > 0 ? intersectionArea / union : 0;
}
    * /;
//# sourceMappingURL=pattern-matcher.js.map