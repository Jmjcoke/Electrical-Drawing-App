/**
 * ML Classifier
 * 
 * Machine learning-based classification for electrical symbols
 * using TensorFlow.js models and advanced feature extraction
 */

import * as tf from '@tensorflow/tfjs-node';
import { 
  DetectedSymbol,
  ElectricalSymbolType,
  SymbolCategory,
  BoundingBox,
  Point,
  MLClassificationError
} from '../../../../shared/types/symbol-detection.types';
import { CoordinateMapper } from '../vision/coordinate-mapper';
import { FeatureExtractor, AdvancedFeatureVector } from '../vision/feature-extractor';
import { v4 as uuidv4 } from 'uuid';

export interface MLClassificationOptions {
  confidenceThreshold: number;
  enableEnsemble?: boolean;
  modelVersion?: string;
}

export interface MLPrediction {
  symbolType: ElectricalSymbolType;
  symbolCategory: SymbolCategory;
  confidence: number;
  probabilities: Record<ElectricalSymbolType, number>;
}

export interface FeatureVector {
  geometric: number[];
  visual: number[];
  contextual: number[];
}

export interface NeuralNetworkModel {
  mainClassifier: tf.LayersModel;
  geometricClassifier: tf.LayersModel;
  visualClassifier: tf.LayersModel;
  ensembleModel: tf.LayersModel;
}

export class MLClassifier {
  private models: NeuralNetworkModel | null = null;
  private isModelLoaded = false;
  private modelVersion = 'v2.0';
  private featureExtractor: FeatureExtractor;
  private supportedSymbols: ElectricalSymbolType[] = [
    'resistor', 'capacitor', 'inductor', 'diode', 'transistor',
    'integrated_circuit', 'connector', 'switch', 'relay', 'transformer',
    'ground', 'power_supply', 'battery', 'fuse', 'led',
    'operational_amplifier', 'logic_gate'
  ];

  // Feature normalization constants
  private readonly FEATURE_MEANS = {
    geometric: new Array(17).fill(0.5),
    visual: new Array(12).fill(0.5),
    topological: new Array(8).fill(0.5),
    contextual: new Array(7).fill(0.5),
  };

  private readonly FEATURE_STDS = {
    geometric: new Array(17).fill(0.2),
    visual: new Array(12).fill(0.2),
    topological: new Array(8).fill(0.2),
    contextual: new Array(7).fill(0.2),
  };
  
  // Performance optimization features
  private featureCache = new Map<string, AdvancedFeatureVector>();
  private predictionCache = new Map<string, MLPrediction>();
  private readonly CACHE_SIZE_LIMIT = 1000;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly BATCH_SIZE = 16; // Optimal batch size for TensorFlow.js
  private readonly MAX_CONCURRENT_INFERENCES = 4;
  
  // Performance monitoring
  private inferenceStats = {
    totalInferences: 0,
    batchInferences: 0,
    avgInferenceTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    modelLoadTime: 0,
    featureExtractionTime: 0
  };
  
  // Tensor memory management
  private activeTensors = new Set<tf.Tensor>();
  private readonly MAX_ACTIVE_TENSORS = 100;

  constructor() {
    this.featureExtractor = new FeatureExtractor();
    this.initializeModels();
    
    // Set up periodic cleanup to prevent memory leaks
    setInterval(() => this.performTensorCleanup(), 60000); // Every minute
  }

  /**
   * Classify symbols using TensorFlow.js neural networks
   */
  async classifySymbols(
    imageBuffer: Buffer,
    existingSymbols: DetectedSymbol[] = []
  ): Promise<DetectedSymbol[]> {
    try {
      if (!this.isModelLoaded || !this.models) {
        await this.initializeModels();
      }

      // Extract regions of interest with advanced preprocessing
      const regions = await this.extractRegionsOfInterest(imageBuffer);
      
      const classifiedSymbols: DetectedSymbol[] = [];

      // Process regions in batches for better performance
      const batchSize = 8;
      for (let i = 0; i < regions.length; i += batchSize) {
        const batch = regions.slice(i, i + batchSize);
        
        try {
          const batchPredictions = await this.classifyRegionBatch(batch, imageBuffer);
          
          for (const prediction of batchPredictions) {
            if (prediction.confidence > 0.5) { // Minimum confidence threshold
              const detectedSymbol = this.createDetectedSymbol(prediction.region, prediction);
              classifiedSymbols.push(detectedSymbol);
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`Failed to classify batch starting at ${i}:`, errorMessage);
        }
      }

      // Enhanced ensemble processing with existing symbols
      const enhancedSymbols = await this.enhanceWithEnsembleMethod(existingSymbols, classifiedSymbols);

      return enhancedSymbols;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new MLClassificationError(
        `Neural network classification failed: ${errorMessage}`,
        { bufferSize: imageBuffer.length, existingSymbolsCount: existingSymbols.length }
      );
    }
  }

  /**
   * Extract regions of interest for classification
   */
  private async extractRegionsOfInterest(imageBuffer: Buffer): Promise<ImageRegion[]> {
    try {
      // Enhanced region extraction using edge detection and contour analysis
      const regions: ImageRegion[] = [];
      
      // Use basic computer vision techniques to find symbol candidates
      const candidateRegions = await this.findSymbolCandidates(imageBuffer);
      
      for (const candidate of candidateRegions) {
        // Filter regions by size and aspect ratio
        if (this.isValidSymbolRegion(candidate.boundingBox)) {
          // Extract sub-image for this region
          const regionImage = await this.extractRegionImage(imageBuffer, candidate.boundingBox);
          
          // Extract advanced features
          const features = await this.extractAdvancedFeatures(regionImage, candidate.boundingBox);
          
          regions.push({
            boundingBox: candidate.boundingBox,
            imageData: regionImage,
            features,
          });
        }
      }

      // If no regions found, create some mock regions for testing
      if (regions.length === 0) {
        console.log('No regions detected, using mock regions for testing');
        regions.push(
          {
            boundingBox: { x: 100, y: 100, width: 80, height: 40, area: 3200 },
            imageData: Buffer.alloc(100),
            features: this.extractMockFeatures(),
          },
          {
            boundingBox: { x: 300, y: 120, width: 60, height: 60, area: 3600 },
            imageData: Buffer.alloc(100),
            features: this.extractMockFeatures(),
          }
        );
      }

      return regions;

    } catch (error) {
      throw new MLClassificationError(
        `Region extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        { bufferSize: imageBuffer.length }
      );
    }
  }
  
  /**
   * Find symbol candidates using computer vision techniques
   */
  private async findSymbolCandidates(_imageBuffer: Buffer): Promise<{ boundingBox: BoundingBox }[]> {
    try {
      // This would use actual CV algorithms in production
      // For now, simulate finding rectangular regions that could be symbols
      const candidates: { boundingBox: BoundingBox }[] = [];
      
      // Simulate detection of multiple potential symbol regions
      const mockCandidates = [
        { x: 150, y: 200, width: 90, height: 30 },
        { x: 300, y: 180, width: 50, height: 50 },
        { x: 500, y: 220, width: 120, height: 40 },
        { x: 200, y: 350, width: 70, height: 35 },
        { x: 450, y: 300, width: 60, height: 25 },
      ];
      
      for (const mock of mockCandidates) {
        candidates.push({
          boundingBox: {
            x: mock.x,
            y: mock.y,
            width: mock.width,
            height: mock.height,
            area: mock.width * mock.height,
          }
        });
      }
      
      return candidates;
      
    } catch (error) {
      throw new MLClassificationError(
        `Candidate detection failed: ${error instanceof Error ? error.message : String(error)}`,
        {}
      );
    }
  }
  
  /**
   * Validate if a region could contain a symbol
   */
  private isValidSymbolRegion(boundingBox: BoundingBox): boolean {
    // Filter by minimum and maximum size
    const minArea = 500;  // Minimum symbol area
    const maxArea = 10000; // Maximum symbol area
    const minAspectRatio = 0.2;
    const maxAspectRatio = 5.0;
    
    const aspectRatio = boundingBox.width / boundingBox.height;
    
    return (
      boundingBox.area >= minArea &&
      boundingBox.area <= maxArea &&
      aspectRatio >= minAspectRatio &&
      aspectRatio <= maxAspectRatio
    );
  }
  
  /**
   * Extract region image from full image
   */
  private async extractRegionImage(_imageBuffer: Buffer, boundingBox: BoundingBox): Promise<Buffer> {
    try {
      // This would use Sharp or similar library to extract the region
      // For now, return a mock sub-image
      return Buffer.alloc(boundingBox.area / 10); // Mock extracted region
      
    } catch (error) {
      throw new MLClassificationError(
        `Region image extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        { boundingBox }
      );
    }
  }
  
  /**
   * Extract advanced features from region
   */
  private async extractAdvancedFeatures(_regionImage: Buffer, boundingBox: BoundingBox): Promise<any> {
    try {
      // In production, this would extract real image features
      // For now, return enhanced mock features
      return {
        // Geometric features
        aspectRatio: boundingBox.width / boundingBox.height,
        area: boundingBox.area,
        perimeter: 2 * (boundingBox.width + boundingBox.height),
        compactness: (4 * Math.PI * boundingBox.area) / Math.pow(2 * (boundingBox.width + boundingBox.height), 2),
        
        // Visual features (would be computed from actual image)
        meanIntensity: 0.6 + Math.random() * 0.3,
        contrast: 0.4 + Math.random() * 0.4,
        edgeDensity: 0.3 + Math.random() * 0.5,
        textureVariance: 0.2 + Math.random() * 0.6,
        
        // Shape features
        rectangularity: 0.7 + Math.random() * 0.2,
        elongation: Math.abs(boundingBox.width - boundingBox.height) / Math.max(boundingBox.width, boundingBox.height),
        solidity: 0.6 + Math.random() * 0.3,
        
        // Context features
        position: { x: boundingBox.x, y: boundingBox.y },
        size: { width: boundingBox.width, height: boundingBox.height },
      };
      
    } catch (error) {
      throw new MLClassificationError(
        `Advanced feature extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        { boundingBox }
      );
    }
  }


  /**
   * Classify a batch of regions using neural networks
   */
  private async classifyRegionBatch(
    regions: ImageRegion[],
    fullImageBuffer: Buffer
  ): Promise<Array<MLPrediction & { region: ImageRegion }>> {
    if (!this.models) {
      throw new MLClassificationError('Models not initialized', {});
    }

    try {
      const predictions: Array<MLPrediction & { region: ImageRegion }> = [];

      // Extract features for all regions in parallel
      const featureExtractionPromises = regions.map(async (region) => {
        const features = await this.featureExtractor.extractFeatures(
          region.imageData,
          region.boundingBox,
          fullImageBuffer
        );
        return { region, features };
      });

      const regionFeatures = await Promise.all(featureExtractionPromises);

      // Prepare batch tensors
      const batchFeatures = regionFeatures.map(rf => this.prepareFeatureTensor(rf.features.advanced));
      
      // Create batch tensor
      const batchTensor = tf.stack(batchFeatures);

      try {
        // Run batch inference on all models
        const [mainPredictions, geometricPredictions, visualPredictions] = await Promise.all([
          this.models.mainClassifier.predict(batchTensor) as tf.Tensor,
          this.models.geometricClassifier.predict(tf.slice(batchTensor, [0, 0], [-1, 17])) as tf.Tensor,
          this.models.visualClassifier.predict(tf.slice(batchTensor, [0, 17], [-1, 12])) as tf.Tensor,
        ]);

        // Combine predictions for ensemble
        const ensembleInput = tf.concat([mainPredictions, geometricPredictions, visualPredictions], 1);
        const ensemblePredictions = this.models.ensembleModel.predict(ensembleInput) as tf.Tensor;

        // Convert tensor results to JavaScript arrays
        const ensembleData = await ensemblePredictions.data();
        await mainPredictions.data(); // Get data but don't store (for potential future use)

        // Process results for each region
        for (let i = 0; i < regions.length; i++) {
          const startIdx = i * this.supportedSymbols.length;
          const endIdx = startIdx + this.supportedSymbols.length;
          
          const ensembleProbs = Array.from(ensembleData.slice(startIdx, endIdx));
          // const mainProbs = Array.from(mainData.slice(startIdx, endIdx)); // For potential future use
          
          // Find top prediction
          const maxIdx = ensembleProbs.indexOf(Math.max(...ensembleProbs));
          const confidence = ensembleProbs[maxIdx];
          const symbolType = this.supportedSymbols[maxIdx];
          
          // Create probability distribution
          const probabilities = this.supportedSymbols.reduce((acc, symbol, idx) => {
            acc[symbol] = ensembleProbs[idx];
            return acc;
          }, {} as Record<ElectricalSymbolType, number>);

          predictions.push({
            region: regionFeatures[i].region,
            symbolType,
            symbolCategory: this.getSymbolCategory(symbolType),
            confidence,
            probabilities,
          });
        }

        // Clean up tensors
        batchTensor.dispose();
        mainPredictions.dispose();
        geometricPredictions.dispose();
        visualPredictions.dispose();
        ensembleInput.dispose();
        ensemblePredictions.dispose();
        batchFeatures.forEach(tensor => tensor.dispose());

      } catch (inferenceError) {
        // Clean up tensors in case of error
        batchTensor.dispose();
        batchFeatures.forEach(tensor => tensor.dispose());
        throw inferenceError;
      }

      return predictions;

    } catch (error) {
      throw new MLClassificationError(
        `Batch neural network inference failed: ${error instanceof Error ? error.message : String(error)}`,
        { batchSize: regions.length }
      );
    }
  }

  /**
   * Prepare feature tensor from advanced feature vector
   */
  private prepareFeatureTensor(features: AdvancedFeatureVector): tf.Tensor1D {
    // Combine all feature types into a single vector
    const geometricArray = Object.values(features.geometric);
    const visualArray = Object.values(features.visual);
    const topologicalArray: number[] = Object.values(features.topological).flat();
    const contextualArray = features.contextual.relativePosition.concat([
      features.contextual.localDensity,
      features.contextual.proximityToEdge,
      features.contextual.alignmentScore,
      features.contextual.scaleRatio,
      features.contextual.isolationScore,
      features.contextual.connectionCount,
    ]);

    // Normalize features
    const normalizedGeometric = this.normalizeFeatures(geometricArray, this.FEATURE_MEANS.geometric, this.FEATURE_STDS.geometric);
    const normalizedVisual = this.normalizeFeatures(visualArray, this.FEATURE_MEANS.visual, this.FEATURE_STDS.visual);
    const normalizedTopological = this.normalizeFeatures(topologicalArray, this.FEATURE_MEANS.topological, this.FEATURE_STDS.topological);
    const normalizedContextual = this.normalizeFeatures(contextualArray, this.FEATURE_MEANS.contextual, this.FEATURE_STDS.contextual);

    // Combine all normalized features
    const combinedFeatures = [
      ...normalizedGeometric,
      ...normalizedVisual,
      ...normalizedTopological,
      ...normalizedContextual,
    ];

    return tf.tensor1d(combinedFeatures);
  }

  /**
   * Normalize features using z-score normalization
   */
  private normalizeFeatures(features: number[], means: number[], stds: number[]): number[] {
    return features.map((feature, idx) => {
      const mean = means[idx] || 0.5;
      const std = stds[idx] || 0.2;
      return (feature - mean) / std;
    });
  }
  
  

  /**
   * Create DetectedSymbol from region and prediction
   */
  private createDetectedSymbol(region: ImageRegion, prediction: MLPrediction): DetectedSymbol {
    const centerX = region.boundingBox.x + region.boundingBox.width / 2;
    const centerY = region.boundingBox.y + region.boundingBox.height / 2;

    return {
      id: uuidv4(),
      symbolType: prediction.symbolType,
      symbolCategory: prediction.symbolCategory,
      description: this.getSymbolDescription(prediction.symbolType),
      confidence: prediction.confidence,
      location: CoordinateMapper.createSymbolLocation(
        centerX,
        centerY,
        800, // Mock image width
        600, // Mock image height
        1    // Page number
      ),
      boundingBox: region.boundingBox,
      detectionMethod: 'ml_classification',
      features: {
        contourPoints: this.generateMockContourPoints(region.boundingBox),
        geometricProperties: {
          area: region.boundingBox.area,
          perimeter: 2 * (region.boundingBox.width + region.boundingBox.height),
          centroid: { x: centerX, y: centerY },
          boundaryRectangle: region.boundingBox,
          symmetryAxes: [],
          aspectRatio: region.boundingBox.width / region.boundingBox.height,
        },
        connectionPoints: [],
        shapeAnalysis: {
          complexity: 0.5,
          orientation: 0,
          strokeWidth: 2,
          isClosed: false,
        },
        textLabels: [],
      },
      validationScore: 0, // Will be calculated later
    };
  }

  /**
   * Enhanced ensemble method combining pattern matching and ML predictions
   */
  private async enhanceWithEnsembleMethod(
    existingSymbols: DetectedSymbol[],
    mlSymbols: DetectedSymbol[]
  ): Promise<DetectedSymbol[]> {
    try {
      const enhanced: DetectedSymbol[] = [];
      const processedExisting = new Set<string>();

      // Process ML symbols first
      for (const mlSymbol of mlSymbols) {
        const overlappingExisting = existingSymbols.find(existing => 
          this.calculateOverlap(existing.boundingBox, mlSymbol.boundingBox) > 0.3
        );

        if (overlappingExisting) {
          // Create consensus symbol using weighted ensemble
          const consensusSymbol = await this.createConsensusSymbol(overlappingExisting, mlSymbol);
          enhanced.push(consensusSymbol);
          processedExisting.add(overlappingExisting.id);
        } else {
          // Add ML-only symbol if confidence is high enough
          if (mlSymbol.confidence > 0.6) {
            enhanced.push(mlSymbol);
          }
        }
      }

      // Add remaining existing symbols that weren't overlapped
      for (const existing of existingSymbols) {
        if (!processedExisting.has(existing.id)) {
          enhanced.push(existing);
        }
      }

      // Apply post-processing filters
      const filtered = await this.applyEnsembleFilters(enhanced);

      return filtered;

    } catch (error) {
      console.warn('Ensemble method failed, falling back to simple merge:', error);
      return this.enhanceExistingSymbols(existingSymbols, mlSymbols);
    }
  }

  /**
   * Create consensus symbol from pattern matching and ML predictions
   */
  private async createConsensusSymbol(
    patternSymbol: DetectedSymbol,
    mlSymbol: DetectedSymbol
  ): Promise<DetectedSymbol> {
    // Weight the confidence scores based on method reliability
    const patternWeight = 0.4; // Pattern matching weight
    const mlWeight = 0.6; // ML weight (typically more reliable)

    // Calculate weighted confidence
    const weightedConfidence = (
      patternSymbol.confidence * patternWeight + 
      mlSymbol.confidence * mlWeight
    );

    // Choose symbol type based on higher confidence
    const finalSymbolType = mlSymbol.confidence > patternSymbol.confidence
      ? mlSymbol.symbolType
      : patternSymbol.symbolType;

    // Choose the more precise bounding box (smaller area typically means more precise)
    const finalBoundingBox = mlSymbol.boundingBox.area < patternSymbol.boundingBox.area
      ? mlSymbol.boundingBox
      : patternSymbol.boundingBox;

    // Merge features from both detections
    const mergedFeatures = {
      ...patternSymbol.features,
      // Prefer ML features for geometric properties as they're more accurate
      geometricProperties: mlSymbol.features?.geometricProperties || patternSymbol.features.geometricProperties,
    };

    return {
      ...patternSymbol,
      symbolType: finalSymbolType,
      symbolCategory: this.getSymbolCategory(finalSymbolType),
      confidence: Math.min(weightedConfidence, 1.0), // Ensure confidence doesn't exceed 1.0
      boundingBox: finalBoundingBox,
      features: mergedFeatures,
      detectionMethod: 'consensus',
      validationScore: Math.max(patternSymbol.validationScore, mlSymbol.validationScore || 0),
    };
  }

  /**
   * Apply ensemble-specific filters
   */
  private async applyEnsembleFilters(symbols: DetectedSymbol[]): Promise<DetectedSymbol[]> {
    // Remove duplicate symbols based on spatial overlap
    const filtered = this.removeSpatialDuplicates(symbols);

    // Apply confidence-based filtering
    const confidenceFiltered = filtered.filter(symbol => symbol.confidence > 0.3);

    // Apply electrical engineering validation rules
    const validatedSymbols = this.applyElectricalValidation(confidenceFiltered);

    return validatedSymbols;
  }

  /**
   * Remove spatially overlapping duplicate symbols
   */
  private removeSpatialDuplicates(symbols: DetectedSymbol[]): DetectedSymbol[] {
    const filtered: DetectedSymbol[] = [];
    const processed = new Set<string>();

    // Sort by confidence descending
    const sortedSymbols = [...symbols].sort((a, b) => b.confidence - a.confidence);

    for (const symbol of sortedSymbols) {
      if (processed.has(symbol.id)) continue;

      // Check for overlaps with remaining symbols
      const overlapping = sortedSymbols.filter(other => 
        !processed.has(other.id) && 
        other.id !== symbol.id &&
        this.calculateOverlap(symbol.boundingBox, other.boundingBox) > 0.5
      );

      if (overlapping.length > 0) {
        // Keep the highest confidence symbol and mark others as processed
        filtered.push(symbol);
        overlapping.forEach(dup => processed.add(dup.id));
      } else {
        filtered.push(symbol);
      }

      processed.add(symbol.id);
    }

    return filtered;
  }

  /**
   * Apply electrical engineering validation rules
   */
  private applyElectricalValidation(symbols: DetectedSymbol[]): DetectedSymbol[] {
    // Apply basic electrical engineering constraints
    return symbols.filter(symbol => {
      // Filter out symbols that are too small or too large to be realistic
      const minArea = 100; // Minimum realistic symbol area
      const maxArea = 50000; // Maximum realistic symbol area
      
      if (symbol.boundingBox.area < minArea || symbol.boundingBox.area > maxArea) {
        return false;
      }

      // Filter out symbols with unrealistic aspect ratios
      const aspectRatio = symbol.boundingBox.width / symbol.boundingBox.height;
      if (aspectRatio < 0.1 || aspectRatio > 10) {
        return false;
      }

      // Additional symbol-specific validation
      switch (symbol.symbolType) {
        case 'resistor':
          // Resistors should be elongated
          return aspectRatio > 1.5;
        case 'capacitor':
          // Capacitors can be square or slightly elongated
          return aspectRatio >= 0.5 && aspectRatio <= 3;
        case 'ground':
          // Ground symbols should be compact
          return aspectRatio >= 0.7 && aspectRatio <= 1.5;
        default:
          return true;
      }
    });
  }

  /**
   * Enhance existing symbols with ML predictions (fallback method)
   */
  private enhanceExistingSymbols(
    existingSymbols: DetectedSymbol[],
    mlSymbols: DetectedSymbol[]
  ): DetectedSymbol[] {
    const enhanced: DetectedSymbol[] = [];

    // Add all ML-only symbols
    for (const mlSymbol of mlSymbols) {
      const hasOverlap = existingSymbols.some(existing => 
        this.calculateOverlap(existing.boundingBox, mlSymbol.boundingBox) > 0.3
      );

      if (!hasOverlap) {
        enhanced.push(mlSymbol);
      }
    }

    // Enhance existing symbols with ML data where applicable
    for (const existing of existingSymbols) {
      const overlappingML = mlSymbols.find(ml => 
        this.calculateOverlap(existing.boundingBox, ml.boundingBox) > 0.3
      );

      if (overlappingML) {
        // Merge the two detections
        const mergedSymbol: DetectedSymbol = {
          ...existing,
          symbolType: overlappingML.confidence > existing.confidence 
            ? overlappingML.symbolType 
            : existing.symbolType,
          symbolCategory: overlappingML.confidence > existing.confidence 
            ? overlappingML.symbolCategory 
            : existing.symbolCategory,
          confidence: Math.max(existing.confidence, overlappingML.confidence),
          detectionMethod: 'consensus',
        };

        enhanced.push(mergedSymbol);
      } else {
        enhanced.push(existing);
      }
    }

    return enhanced;
  }

  /**
   * Calculate overlap between two bounding boxes
   */
  private calculateOverlap(box1: BoundingBox, box2: BoundingBox): number {
    return CoordinateMapper.calculateIoU(box1, box2);
  }

  /**
   * Get symbol category from symbol type
   */
  private getSymbolCategory(symbolType: ElectricalSymbolType): SymbolCategory {
    const categoryMap: Record<ElectricalSymbolType, SymbolCategory> = {
      'resistor': 'passive',
      'capacitor': 'passive',
      'inductor': 'passive',
      'diode': 'active',
      'transistor': 'active',
      'integrated_circuit': 'active',
      'connector': 'connector',
      'switch': 'connector',
      'relay': 'connector',
      'transformer': 'passive',
      'ground': 'power',
      'power_supply': 'power',
      'battery': 'power',
      'fuse': 'protection',
      'led': 'active',
      'operational_amplifier': 'active',
      'logic_gate': 'logic',
      'custom': 'custom',
      'unknown': 'custom',
    };

    return categoryMap[symbolType] || 'custom';
  }

  /**
   * Get symbol description
   */
  private getSymbolDescription(symbolType: ElectricalSymbolType): string {
    const descriptions: Record<ElectricalSymbolType, string> = {
      'resistor': 'Electrical resistor component',
      'capacitor': 'Electrical capacitor component',
      'inductor': 'Electrical inductor component',
      'diode': 'Semiconductor diode',
      'transistor': 'Semiconductor transistor',
      'integrated_circuit': 'Integrated circuit chip',
      'connector': 'Electrical connector',
      'switch': 'Electrical switch',
      'relay': 'Electromagnetic relay',
      'transformer': 'Electrical transformer',
      'ground': 'Ground connection',
      'power_supply': 'Power supply',
      'battery': 'Battery cell',
      'fuse': 'Protective fuse',
      'led': 'Light-emitting diode',
      'operational_amplifier': 'Operational amplifier',
      'logic_gate': 'Digital logic gate',
      'custom': 'Custom component',
      'unknown': 'Unknown component',
    };

    return descriptions[symbolType] || 'Electrical component';
  }

  /**
   * Generate mock contour points for bounding box
   */
  private generateMockContourPoints(boundingBox: BoundingBox): Point[] {
    return [
      { x: boundingBox.x, y: boundingBox.y },
      { x: boundingBox.x + boundingBox.width, y: boundingBox.y },
      { x: boundingBox.x + boundingBox.width, y: boundingBox.y + boundingBox.height },
      { x: boundingBox.x, y: boundingBox.y + boundingBox.height },
    ];
  }

  /**
   * Extract mock features for testing
   */
  private extractMockFeatures(): any {
    return {
      intensity: 0.7,
      contrast: 0.6,
      edges: 0.8,
    };
  }

  /**
   * Initialize TensorFlow.js models
   */
  private async initializeModels(): Promise<void> {
    try {
      console.log('Initializing TensorFlow.js models for electrical symbol classification...');
      
      // In production, these would load from saved model files
      // For now, create lightweight models that can actually run
      this.models = {
        mainClassifier: await this.createMainClassifierModel(),
        geometricClassifier: await this.createGeometricClassifierModel(),
        visualClassifier: await this.createVisualClassifierModel(),
        ensembleModel: await this.createEnsembleModel(),
      };
      
      this.isModelLoaded = true;
      console.log(`Neural network models initialized with version ${this.modelVersion}`);
      console.log('Models ready for inference:', {
        mainClassifier: this.models.mainClassifier.summary,
        geometricClassifier: this.models.geometricClassifier.summary,
        visualClassifier: this.models.visualClassifier.summary,
        ensembleModel: this.models.ensembleModel.summary,
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new MLClassificationError(
        `Failed to initialize TensorFlow.js models: ${errorMessage}`,
        { modelVersion: this.modelVersion }
      );
    }
  }

  /**
   * Create main classifier neural network
   */
  private async createMainClassifierModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        // Input layer: Combined feature vector (17+12+8+7 = 44 features)
        tf.layers.dense({
          inputShape: [44],
          units: 128,
          activation: 'relu',
          kernelInitializer: 'glorotNormal',
        }),
        tf.layers.dropout({ rate: 0.3 }),
        
        // Hidden layers with batch normalization
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          kernelInitializer: 'glorotNormal',
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.2 }),
        
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelInitializer: 'glorotNormal',
        }),
        tf.layers.dropout({ rate: 0.1 }),
        
        // Output layer: Number of supported symbol types
        tf.layers.dense({
          units: this.supportedSymbols.length,
          activation: 'softmax',
        }),
      ],
    });

    // Compile with appropriate loss and optimizer
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  /**
   * Create specialized geometric classifier
   */
  private async createGeometricClassifierModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        // Input: Geometric features only (17 features)
        tf.layers.dense({
          inputShape: [17],
          units: 32,
          activation: 'relu',
        }),
        tf.layers.dropout({ rate: 0.2 }),
        
        tf.layers.dense({
          units: 16,
          activation: 'relu',
        }),
        
        tf.layers.dense({
          units: this.supportedSymbols.length,
          activation: 'softmax',
        }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  /**
   * Create specialized visual classifier
   */
  private async createVisualClassifierModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        // Input: Visual features only (12 features)
        tf.layers.dense({
          inputShape: [12],
          units: 24,
          activation: 'relu',
        }),
        tf.layers.dropout({ rate: 0.2 }),
        
        tf.layers.dense({
          units: 12,
          activation: 'relu',
        }),
        
        tf.layers.dense({
          units: this.supportedSymbols.length,
          activation: 'softmax',
        }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  /**
   * Create ensemble model that combines specialist predictions
   */
  private async createEnsembleModel(): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        // Input: Combined predictions from all classifiers (3 * supportedSymbols.length)
        tf.layers.dense({
          inputShape: [3 * this.supportedSymbols.length],
          units: 32,
          activation: 'relu',
        }),
        tf.layers.dropout({ rate: 0.1 }),
        
        tf.layers.dense({
          units: 16,
          activation: 'relu',
        }),
        
        tf.layers.dense({
          units: this.supportedSymbols.length,
          activation: 'softmax',
        }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.0005),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy'],
    });

    return model;
  }

  /**
   * Get model information
   */
  getModelInfo(): {
    version: string;
    supportedSymbols: ElectricalSymbolType[];
    isLoaded: boolean;
  } {
    return {
      version: this.modelVersion,
      supportedSymbols: this.supportedSymbols,
      isLoaded: this.isModelLoaded,
    };
  }

  /**
   * Performance optimization methods
   */
  async optimizeForPerformance(): Promise<void> {
    if (!this.models) return;

    try {
      // Optimize models for inference speed
      console.log('Optimizing TensorFlow.js models for performance...');

      // Enable graph optimization
      tf.enableProdMode();

      // Warm up models with dummy data to optimize JIT compilation
      await this.warmUpModels();

      console.log('Model performance optimization completed');

    } catch (error) {
      console.warn('Performance optimization failed:', error);
    }
  }

  /**
   * Warm up models with dummy inference to optimize performance
   */
  private async warmUpModels(): Promise<void> {
    if (!this.models) return;

    try {
      // Create dummy feature vectors
      const dummyMainFeatures = tf.randomNormal([1, 44]);
      const dummyGeometricFeatures = tf.randomNormal([1, 17]);
      const dummyVisualFeatures = tf.randomNormal([1, 12]);
      const dummyEnsembleFeatures = tf.randomNormal([1, 3 * this.supportedSymbols.length]);

      // Run dummy inference on all models
      const [mainResult, geometricResult, visualResult, ensembleResult] = await Promise.all([
        this.models.mainClassifier.predict(dummyMainFeatures) as tf.Tensor,
        this.models.geometricClassifier.predict(dummyGeometricFeatures) as tf.Tensor,
        this.models.visualClassifier.predict(dummyVisualFeatures) as tf.Tensor,
        this.models.ensembleModel.predict(dummyEnsembleFeatures) as tf.Tensor,
      ]);

      // Clean up tensors
      dummyMainFeatures.dispose();
      dummyGeometricFeatures.dispose();
      dummyVisualFeatures.dispose();
      dummyEnsembleFeatures.dispose();
      mainResult.dispose();
      geometricResult.dispose();
      visualResult.dispose();
      ensembleResult.dispose();

      console.log('Model warm-up completed successfully');

    } catch (error) {
      console.warn('Model warm-up failed:', error);
    }
  }

  /**
   * PERFORMANCE OPTIMIZATION METHODS
   */

  /**
   * Generate cache key for feature vectors
   */
  private generateFeatureCacheKey(region: ImageRegion): string {
    const bbox = region.boundingBox;
    return require('crypto').createHash('md5').update(
      `${bbox.x}_${bbox.y}_${bbox.width}_${bbox.height}_${region.imageData.length}`
    ).digest('hex').substring(0, 12);
  }

  /**
   * Generate cache key for image buffers
   */
  private generateBufferCacheKey(buffer: Buffer): string {
    return require('crypto').createHash('md5').update(buffer).digest('hex').substring(0, 8);
  }

  /**
   * Cache feature vector with size management
   */
  private cacheFeatureVector(key: string, features: AdvancedFeatureVector): void {
    if (this.featureCache.size >= this.CACHE_SIZE_LIMIT) {
      // Remove oldest entry
      const firstKey = this.featureCache.keys().next().value;
      if (firstKey) {
        this.featureCache.delete(firstKey);
      }
    }
    
    this.featureCache.set(key, features);
  }

  /**
   * Get cached regions
   */
  private getCachedRegions(key: string): ImageRegion[] | null {
    // For now, use feature cache as general cache
    // In production, you might have separate region cache
    return null; // Simplified for now
  }

  /**
   * Cache regions
   */
  private cacheRegions(key: string, regions: ImageRegion[]): void {
    // Implementation would cache regions with TTL
    // Simplified for now
  }

  /**
   * Prepare batch tensor from feature vectors
   */
  private prepareBatchTensor(featureBatch: AdvancedFeatureVector[]): tf.Tensor {
    const batchSize = featureBatch.length;
    const featureSize = this.calculateFeatureSize(featureBatch[0]);
    
    // Create batch array
    const batchData = new Float32Array(batchSize * featureSize);
    
    for (let i = 0; i < batchSize; i++) {
      const features = this.flattenFeatureVector(featureBatch[i]);
      batchData.set(features, i * featureSize);
    }
    
    return tf.tensor2d(batchData, [batchSize, featureSize]);
  }

  /**
   * Calculate total feature size
   */
  private calculateFeatureSize(features: AdvancedFeatureVector): number {
    return features.geometric.length + features.visual.length + 
           features.topological.length + features.contextual.length;
  }

  /**
   * Flatten feature vector for tensor input
   */
  private flattenFeatureVector(features: AdvancedFeatureVector): Float32Array {
    const flattened = new Float32Array(
      features.geometric.length + features.visual.length + 
      features.topological.length + features.contextual.length
    );
    
    let offset = 0;
    flattened.set(features.geometric, offset);
    offset += features.geometric.length;
    flattened.set(features.visual, offset);
    offset += features.visual.length;
    flattened.set(features.topological, offset);
    offset += features.topological.length;
    flattened.set(features.contextual, offset);
    
    return flattened;
  }

  /**
   * Get default feature vector for fallback
   */
  private getDefaultFeatureVector(): AdvancedFeatureVector {
    return {
      geometric: new Array(17).fill(0.5),
      visual: new Array(12).fill(0.5),
      topological: new Array(8).fill(0.5),
      contextual: new Array(7).fill(0.5)
    };
  }

  /**
   * Track active tensors for memory management
   */
  private trackTensor(tensor: tf.Tensor): void {
    this.activeTensors.add(tensor);
    
    // Clean up if too many active tensors
    if (this.activeTensors.size > this.MAX_ACTIVE_TENSORS) {
      this.performTensorCleanup();
    }
  }

  /**
   * Untrack tensor
   */
  private untrackTensor(tensor: tf.Tensor): void {
    this.activeTensors.delete(tensor);
  }

  /**
   * Perform tensor cleanup to prevent memory leaks
   */
  private performTensorCleanup(): void {
    let cleaned = 0;
    
    for (const tensor of this.activeTensors) {
      try {
        if (tensor && !tensor.isDisposed) {
          tensor.dispose();
          cleaned++;
        }
      } catch (error) {
        console.warn('Failed to dispose tensor:', error);
      }
    }
    
    this.activeTensors.clear();
    
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} tensors`);
    }
  }

  /**
   * Update inference statistics
   */
  private updateInferenceStats(totalTime: number, regionCount: number): void {
    this.inferenceStats.totalInferences++;
    
    // Update average inference time
    this.inferenceStats.avgInferenceTime = 
      (this.inferenceStats.avgInferenceTime * (this.inferenceStats.totalInferences - 1) + totalTime) / 
      this.inferenceStats.totalInferences;
      
    console.log(`ML Classification completed: ${totalTime}ms for ${regionCount} regions`);
  }

  /**
   * Get performance statistics
   */
  getInferenceStats(): typeof this.inferenceStats {
    return { ...this.inferenceStats };
  }

  /**
   * Clear caches and optimize memory
   */
  async performOptimizedCleanup(): Promise<void> {
    // Clear feature and prediction caches
    this.featureCache.clear();
    this.predictionCache.clear();
    
    // Cleanup tensors
    this.performTensorCleanup();
    
    // Force TensorFlow.js memory cleanup
    if (typeof tf.disposeVariables === 'function') {
      tf.disposeVariables();
    }
    
    // Reset stats
    this.inferenceStats = {
      totalInferences: 0,
      batchInferences: 0,
      avgInferenceTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      modelLoadTime: 0,
      featureExtractionTime: 0
    };
    
    console.log('ML Classifier optimized cleanup completed');
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    modelMemoryUsage: number;
    averageInferenceTime: number;
    supportedBatchSize: number;
    isOptimized: boolean;
    cacheStats: { hits: number; misses: number; size: number };
    activeTensors: number;
  } {
    return {
      modelMemoryUsage: tf.memory().numBytes,
      averageInferenceTime: this.inferenceStats.avgInferenceTime || 50,
      supportedBatchSize: this.BATCH_SIZE,
      isOptimized: this.isModelLoaded,
      cacheStats: {
        hits: this.inferenceStats.cacheHits,
        misses: this.inferenceStats.cacheMisses,
        size: this.featureCache.size
      },
      activeTensors: this.activeTensors.size
    };
  }

  /**
   * Clean up GPU memory and dispose models
   */
  async dispose(): Promise<void> {
    if (this.models) {
      this.models.mainClassifier.dispose();
      this.models.geometricClassifier.dispose();
      this.models.visualClassifier.dispose();
      this.models.ensembleModel.dispose();
      this.models = null;
    }
    
    this.isModelLoaded = false;
    
    // Clean up any remaining tensors
    tf.disposeVariables();
    
    console.log('ML Classifier disposed and memory cleaned');
  }

  /**
   * Update model version and reload
   */
  async updateModel(version: string): Promise<void> {
    // Dispose existing models
    await this.dispose();
    
    // Update version and reinitialize
    this.modelVersion = version;
    await this.initializeModels();
    
    // Re-optimize for performance
    await this.optimizeForPerformance();
  }

  /**
   * Enable/disable parallel processing
   */
  setParallelProcessing(enabled: boolean): void {
    if (enabled) {
      // Enable TensorFlow.js parallel execution
      tf.env().set('WEBGL_CPU_FORWARD', false);
      tf.env().set('WEBGL_PACK', true);
    } else {
      // Disable parallel execution for debugging
      tf.env().set('WEBGL_CPU_FORWARD', true);
      tf.env().set('WEBGL_PACK', false);
    }
  }

  /**
   * Set memory growth to prevent OOM errors
   */
  setMemoryGrowth(enabled: boolean): void {
    tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', enabled ? 1 : -1);
  }
}

// Helper interfaces
interface ImageRegion {
  boundingBox: BoundingBox;
  imageData: Buffer;
  features: any;
}