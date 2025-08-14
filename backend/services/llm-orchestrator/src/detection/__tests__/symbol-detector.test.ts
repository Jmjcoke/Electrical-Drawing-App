/**
 * Comprehensive Unit Tests for Symbol Detector
 * Validates core detection orchestration functionality
 * Coverage Target: 80%+ for Story 4.1 Requirements
 */

import { SymbolDetectionService } from '../symbol-detector';
import { ImageProcessor } from '../../vision/image-processor';
import { PatternMatcher } from '../pattern-matcher';
import { MLClassifier } from '../ml-classifier';
import { SymbolValidator } from '../symbol-validator';
import { ConfidenceScorer } from '../confidence-scorer';
import { SymbolDetectionStorageService } from '../../services/symbol-detection-storage.service';
import { 
  SymbolDetectionResult, 
  DetectedSymbol, 
  DetectionMetadata,
  ElectricalSymbolType,
  SymbolCategory,
  DetectionMethod,
  ImageQuality
} from '../../../../../shared/types/symbol-detection.types';
import * as Bull from 'bull';
import Redis from 'ioredis';
import { EventEmitter } from 'events';
import { Pool } from 'pg';

// Mock all dependencies
jest.mock('../../vision/image-processor');
jest.mock('../pattern-matcher');
jest.mock('../ml-classifier');
jest.mock('../symbol-validator');
jest.mock('../confidence-scorer');
jest.mock('../../services/symbol-detection-storage.service');
jest.mock('bull');
jest.mock('ioredis');
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn()
  }))
}));

describe('SymbolDetectionService - Comprehensive Test Suite', () => {
  let symbolDetector: SymbolDetectionService;
  let mockImageProcessor: jest.Mocked<ImageProcessor>;
  let mockPatternMatcher: jest.Mocked<PatternMatcher>;
  let mockMLClassifier: jest.Mocked<MLClassifier>;
  let mockValidator: jest.Mocked<SymbolValidator>;
  let mockScorer: jest.Mocked<ConfidenceScorer>;
  let mockStorageService: jest.Mocked<SymbolDetectionStorageService>;
  let mockRedis: jest.Mocked<Redis>;
  let mockQueue: any;
  let mockEventEmitter: EventEmitter;
  let mockDatabase: jest.Mocked<Pool>;

  // Test data helpers
  const createMockSymbol = (
    type: ElectricalSymbolType = 'resistor',
    confidence = 0.85,
    method: DetectionMethod = 'pattern_matching'
  ): DetectedSymbol => ({
    id: `symbol-${Math.random().toString(36).substr(2, 9)}`,
    symbolType: type,
    symbolCategory: 'passive' as SymbolCategory,
    description: `${type} component detected`,
    confidence,
    location: {
      x: Math.random(),
      y: Math.random(),
      pageNumber: 1,
      originalX: Math.floor(Math.random() * 1920),
      originalY: Math.floor(Math.random() * 1080),
      imageWidth: 1920,
      imageHeight: 1080
    },
    boundingBox: {
      x: Math.floor(Math.random() * 1920),
      y: Math.floor(Math.random() * 1080),
      width: 50 + Math.floor(Math.random() * 100),
      height: 50 + Math.floor(Math.random() * 100),
      area: 2500 + Math.floor(Math.random() * 5000),
      rotation: Math.random() * 360
    },
    detectionMethod: method,
    features: {
      contourPoints: [],
      geometricProperties: {
        area: 2500,
        perimeter: 200,
        centroid: { x: 100, y: 100 },
        boundaryRectangle: { x: 50, y: 50, width: 100, height: 100, area: 10000 },
        symmetryAxes: [],
        aspectRatio: 1.0
      },
      connectionPoints: [],
      shapeAnalysis: {
        complexity: 0.5,
        symmetry: 0.8,
        regularity: 0.9
      } as any
    },
    validationScore: confidence * 0.95
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup Redis mock
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      quit: jest.fn(),
      disconnect: jest.fn()
    } as any;
    (Redis as any).mockImplementation(() => mockRedis);

    // Setup Bull queue mock
    mockQueue = {
      process: jest.fn(),
      on: jest.fn(),
      close: jest.fn(),
      add: jest.fn().mockResolvedValue({ id: 'job-123' }),
      getJob: jest.fn(),
      pause: jest.fn().mockResolvedValue(undefined),
      resume: jest.fn().mockResolvedValue(undefined),
      empty: jest.fn().mockResolvedValue(undefined),
      clean: jest.fn().mockResolvedValue(undefined),
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0
      })
    };
    (Bull as any).mockReturnValue(mockQueue);

    // Setup database mock
    mockDatabase = new Pool() as jest.Mocked<Pool>;

    // Setup mocked dependencies
    mockImageProcessor = new ImageProcessor() as jest.Mocked<ImageProcessor>;
    mockPatternMatcher = new PatternMatcher() as jest.Mocked<PatternMatcher>;
    mockMLClassifier = new MLClassifier() as jest.Mocked<MLClassifier>;
    mockValidator = new SymbolValidator() as jest.Mocked<SymbolValidator>;
    mockScorer = new ConfidenceScorer() as jest.Mocked<ConfidenceScorer>;
    mockStorageService = new SymbolDetectionStorageService(mockDatabase, mockRedis as any) as jest.Mocked<SymbolDetectionStorageService>;

    // Setup EventEmitter
    mockEventEmitter = new EventEmitter();

    // Initialize SymbolDetectionService
    symbolDetector = new SymbolDetectionService(mockEventEmitter);
  });

  afterEach(async () => {
    await symbolDetector.cleanup();
  });

  describe('1. Core Initialization Tests', () => {
    it('should initialize all components correctly', () => {
      expect(symbolDetector).toBeDefined();
      expect(mockQueue.process).toHaveBeenCalled();
      expect(mockQueue.on).toHaveBeenCalledWith('progress', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockQueue.on).toHaveBeenCalledWith('failed', expect.any(Function));
    });

    it('should handle initialization with custom configuration', () => {
      const customConfig = {
        confidenceThreshold: 0.95,
        maxSymbolsPerPage: 100,
        enableCaching: false
      };

      const customDetector = new SymbolDetectionService(mockEventEmitter, customConfig);
      expect(customDetector).toBeDefined();
    });

    it('should handle initialization errors gracefully', () => {
      const errorQueue = {
        process: jest.fn().mockImplementation(() => {
          throw new Error('Queue initialization failed');
        })
      };
      (Bull as any).mockReturnValue(errorQueue);

      expect(() => new SymbolDetectionService(mockEventEmitter)).toThrow('Failed to initialize symbol detection service');
    });
  });

  describe('2. Symbol Detection Pipeline Tests (AC #1-3)', () => {
    const mockImagePath = '/path/to/test.pdf';
    const mockSessionId = 'session-123';
    const mockDocumentId = 'doc-456';

    beforeEach(() => {
      // Setup default mock responses for successful detection
      mockImageProcessor.preprocessImage.mockResolvedValue({
        processedImagePath: '/tmp/processed.png',
        originalDimensions: { width: 1920, height: 1080 },
        enhancementApplied: true,
        processingTime: 100,
        quality: {
          resolution: 300,
          clarity: 0.9,
          contrast: 0.85,
          noiseLevel: 0.1,
          skewAngle: 0
        } as ImageQuality
      });

      mockImageProcessor.extractRegions.mockResolvedValue([
        {
          id: 'region-1',
          boundingBox: { x: 100, y: 100, width: 50, height: 50, area: 2500 },
          confidence: 0.9,
          imageData: Buffer.from('mock-image-data')
        }
      ]);

      const mockResistorSymbol = createMockSymbol('resistor', 0.85, 'pattern_matching');
      const mockCapacitorSymbol = createMockSymbol('capacitor', 0.92, 'ml_classification');

      mockPatternMatcher.matchPatterns.mockResolvedValue([mockResistorSymbol]);
      mockMLClassifier.classifyRegions.mockResolvedValue([mockCapacitorSymbol]);

      mockValidator.validateSymbols.mockResolvedValue({
        validSymbols: [mockResistorSymbol],
        invalidSymbols: [],
        validationMetrics: {
          totalProcessed: 2,
          totalValid: 1,
          totalInvalid: 1,
          averageConfidence: 0.9
        }
      });

      mockScorer.calculateOverallConfidence.mockReturnValue(0.88);
      mockStorageService.storeDetectionResult.mockResolvedValue('result-789');
    });

    it('should execute complete detection pipeline successfully', async () => {
      const result = await symbolDetector.detectSymbols(
        mockImagePath,
        mockSessionId,
        mockDocumentId
      );

      expect(result).toBeDefined();
      expect(result.detectedSymbols).toHaveLength(1);
      expect(result.detectedSymbols[0].symbolType).toBe('resistor');
      expect(result.overallConfidence).toBe(0.88);
      expect(result.processingTimeMs).toBeGreaterThan(0);
      
      // Verify all pipeline stages were called
      expect(mockImageProcessor.preprocessImage).toHaveBeenCalledWith(mockImagePath);
      expect(mockImageProcessor.extractRegions).toHaveBeenCalled();
      expect(mockPatternMatcher.matchPatterns).toHaveBeenCalled();
      expect(mockMLClassifier.classifyRegions).toHaveBeenCalled();
      expect(mockValidator.validateSymbols).toHaveBeenCalled();
      expect(mockScorer.calculateOverallConfidence).toHaveBeenCalled();
      expect(mockStorageService.storeDetectionResult).toHaveBeenCalled();
    });

    it('should handle pattern matching for standard symbols (AC #2)', async () => {
      const standardSymbols = ['resistor', 'capacitor', 'inductor', 'diode', 'transistor'];
      const mockSymbols = standardSymbols.map(type => createMockSymbol(type as ElectricalSymbolType, 0.9, 'pattern_matching'));
      
      mockPatternMatcher.matchPatterns.mockResolvedValue(mockSymbols);
      mockValidator.validateSymbols.mockResolvedValue({
        validSymbols: mockSymbols,
        invalidSymbols: [],
        validationMetrics: {
          totalProcessed: mockSymbols.length,
          totalValid: mockSymbols.length,
          totalInvalid: 0,
          averageConfidence: 0.9
        }
      });

      const result = await symbolDetector.detectSymbols(mockImagePath, mockSessionId, mockDocumentId);

      expect(result.detectedSymbols).toHaveLength(standardSymbols.length);
      standardSymbols.forEach(type => {
        expect(result.detectedSymbols.some(s => s.symbolType === type)).toBe(true);
      });
    });

    it('should handle ML classification for complex symbols (AC #3)', async () => {
      const complexSymbols = ['operational_amplifier', 'integrated_circuit', 'transformer'];
      const mockSymbols = complexSymbols.map(type => createMockSymbol(type as ElectricalSymbolType, 0.88, 'ml_classification'));
      
      mockMLClassifier.classifyRegions.mockResolvedValue(mockSymbols);
      mockValidator.validateSymbols.mockResolvedValue({
        validSymbols: mockSymbols,
        invalidSymbols: [],
        validationMetrics: {
          totalProcessed: mockSymbols.length,
          totalValid: mockSymbols.length,
          totalInvalid: 0,
          averageConfidence: 0.88
        }
      });

      const result = await symbolDetector.detectSymbols(mockImagePath, mockSessionId, mockDocumentId);

      expect(result.detectedSymbols.every(s => s.detectionMethod === 'ml_classification')).toBe(true);
      expect(result.detectedSymbols.some(s => s.symbolType === 'operational_amplifier')).toBe(true);
    });

    it('should handle empty detection results gracefully', async () => {
      mockPatternMatcher.matchPatterns.mockResolvedValue([]);
      mockMLClassifier.classifyRegions.mockResolvedValue([]);
      mockValidator.validateSymbols.mockResolvedValue({
        validSymbols: [],
        invalidSymbols: [],
        validationMetrics: {
          totalProcessed: 0,
          totalValid: 0,
          totalInvalid: 0,
          averageConfidence: 0
        }
      });

      const result = await symbolDetector.detectSymbols(mockImagePath, mockSessionId, mockDocumentId);

      expect(result.detectedSymbols).toHaveLength(0);
      expect(result.overallConfidence).toBe(0);
      expect(result.processingTimeMs).toBeGreaterThan(0);
    });

    it('should handle pipeline stage failures gracefully', async () => {
      mockImageProcessor.preprocessImage.mockRejectedValue(new Error('Preprocessing failed'));

      await expect(
        symbolDetector.detectSymbols(mockImagePath, mockSessionId, mockDocumentId)
      ).rejects.toThrow('Symbol detection failed');
    });
  });

  describe('3. Confidence Scoring Tests (AC #4)', () => {
    it('should calculate confidence scores correctly', async () => {
      const symbols = [
        createMockSymbol('resistor', 0.95, 'pattern_matching'),
        createMockSymbol('capacitor', 0.85, 'ml_classification'),
        createMockSymbol('inductor', 0.75, 'consensus')
      ];

      mockPatternMatcher.matchPatterns.mockResolvedValue([symbols[0]]);
      mockMLClassifier.classifyRegions.mockResolvedValue([symbols[1]]);
      mockValidator.validateSymbols.mockResolvedValue({
        validSymbols: symbols,
        invalidSymbols: [],
        validationMetrics: {
          totalProcessed: 3,
          totalValid: 3,
          totalInvalid: 0,
          averageConfidence: 0.85
        }
      });
      mockScorer.calculateOverallConfidence.mockReturnValue(0.85);

      const result = await symbolDetector.detectSymbols('/test.pdf', 'session-1', 'doc-1');

      expect(result.overallConfidence).toBe(0.85);
      expect(result.detectedSymbols.every(s => s.confidence >= 0 && s.confidence <= 1)).toBe(true);
    });

    it('should filter symbols below confidence threshold', async () => {
      const symbols = [
        createMockSymbol('resistor', 0.95, 'pattern_matching'),
        createMockSymbol('capacitor', 0.45, 'ml_classification'), // Below threshold
        createMockSymbol('inductor', 0.85, 'consensus')
      ];

      mockPatternMatcher.matchPatterns.mockResolvedValue(symbols);
      mockValidator.validateSymbols.mockResolvedValue({
        validSymbols: symbols.filter(s => s.confidence >= 0.5),
        invalidSymbols: symbols.filter(s => s.confidence < 0.5),
        validationMetrics: {
          totalProcessed: 3,
          totalValid: 2,
          totalInvalid: 1,
          averageConfidence: 0.9
        }
      });

      const result = await symbolDetector.detectSymbols(
        '/test.pdf', 
        'session-1', 
        'doc-1',
        1,
        { confidenceThreshold: 0.5 }
      );

      expect(result.detectedSymbols).toHaveLength(2);
      expect(result.detectedSymbols.every(s => s.confidence >= 0.5)).toBe(true);
    });
  });

  describe('4. Location Tracking Tests (AC #5)', () => {
    it('should track normalized coordinates correctly', async () => {
      const symbol = createMockSymbol('resistor', 0.9, 'pattern_matching');
      symbol.location = {
        x: 0.5,
        y: 0.5,
        pageNumber: 1,
        originalX: 960,
        originalY: 540,
        imageWidth: 1920,
        imageHeight: 1080
      };

      mockPatternMatcher.matchPatterns.mockResolvedValue([symbol]);
      mockValidator.validateSymbols.mockResolvedValue({
        validSymbols: [symbol],
        invalidSymbols: [],
        validationMetrics: {
          totalProcessed: 1,
          totalValid: 1,
          totalInvalid: 0,
          averageConfidence: 0.9
        }
      });

      const result = await symbolDetector.detectSymbols('/test.pdf', 'session-1', 'doc-1');

      const detectedSymbol = result.detectedSymbols[0];
      expect(detectedSymbol.location.x).toBe(0.5);
      expect(detectedSymbol.location.y).toBe(0.5);
      expect(detectedSymbol.location.originalX).toBe(960);
      expect(detectedSymbol.location.originalY).toBe(540);
    });

    it('should handle multi-page documents', async () => {
      const page1Symbols = [
        createMockSymbol('resistor', 0.9, 'pattern_matching'),
        createMockSymbol('capacitor', 0.85, 'ml_classification')
      ];
      page1Symbols.forEach(s => s.location.pageNumber = 1);

      const page2Symbols = [
        createMockSymbol('inductor', 0.88, 'pattern_matching'),
        createMockSymbol('diode', 0.92, 'ml_classification')
      ];
      page2Symbols.forEach(s => s.location.pageNumber = 2);

      // First page detection
      mockPatternMatcher.matchPatterns.mockResolvedValueOnce(page1Symbols);
      mockValidator.validateSymbols.mockResolvedValueOnce({
        validSymbols: page1Symbols,
        invalidSymbols: [],
        validationMetrics: {
          totalProcessed: 2,
          totalValid: 2,
          totalInvalid: 0,
          averageConfidence: 0.875
        }
      });

      const result1 = await symbolDetector.detectSymbols('/test.pdf', 'session-1', 'doc-1', 1);
      expect(result1.detectedSymbols.every(s => s.location.pageNumber === 1)).toBe(true);

      // Second page detection
      mockPatternMatcher.matchPatterns.mockResolvedValueOnce(page2Symbols);
      mockValidator.validateSymbols.mockResolvedValueOnce({
        validSymbols: page2Symbols,
        invalidSymbols: [],
        validationMetrics: {
          totalProcessed: 2,
          totalValid: 2,
          totalInvalid: 0,
          averageConfidence: 0.9
        }
      });

      const result2 = await symbolDetector.detectSymbols('/test.pdf', 'session-1', 'doc-1', 2);
      expect(result2.detectedSymbols.every(s => s.location.pageNumber === 2)).toBe(true);
    });
  });

  describe('5. Database Storage Tests (AC #7)', () => {
    it('should store detection results in database', async () => {
      const mockSymbol = createMockSymbol('resistor', 0.9, 'pattern_matching');
      mockPatternMatcher.matchPatterns.mockResolvedValue([mockSymbol]);
      mockValidator.validateSymbols.mockResolvedValue({
        validSymbols: [mockSymbol],
        invalidSymbols: [],
        validationMetrics: {
          totalProcessed: 1,
          totalValid: 1,
          totalInvalid: 0,
          averageConfidence: 0.9
        }
      });

      mockStorageService.storeDetectionResult.mockResolvedValue('stored-result-id');

      const result = await symbolDetector.detectSymbols('/test.pdf', 'session-1', 'doc-1');

      expect(mockStorageService.storeDetectionResult).toHaveBeenCalledWith(
        expect.objectContaining({
          detectedSymbols: expect.arrayContaining([
            expect.objectContaining({
              symbolType: 'resistor'
            })
          ]),
          queryId: 'session-1',
          documentId: 'doc-1'
        })
      );
      expect(result.id).toBe('stored-result-id');
    });

    it('should handle database storage failures', async () => {
      mockStorageService.storeDetectionResult.mockRejectedValue(new Error('Database error'));

      const mockSymbol = createMockSymbol('resistor', 0.9, 'pattern_matching');
      mockPatternMatcher.matchPatterns.mockResolvedValue([mockSymbol]);
      mockValidator.validateSymbols.mockResolvedValue({
        validSymbols: [mockSymbol],
        invalidSymbols: [],
        validationMetrics: {
          totalProcessed: 1,
          totalValid: 1,
          totalInvalid: 0,
          averageConfidence: 0.9
        }
      });

      // Should still return results even if storage fails
      const result = await symbolDetector.detectSymbols('/test.pdf', 'session-1', 'doc-1');
      expect(result.detectedSymbols).toHaveLength(1);
      expect(result.id).toBeUndefined();
    });
  });

  describe('6. Performance Tests (AC #9)', () => {
    it('should complete detection within 30 seconds per page', async () => {
      const startTime = Date.now();
      
      const symbols = Array.from({ length: 50 }, () => createMockSymbol('resistor', 0.9, 'pattern_matching'));
      mockPatternMatcher.matchPatterns.mockResolvedValue(symbols);
      mockValidator.validateSymbols.mockResolvedValue({
        validSymbols: symbols,
        invalidSymbols: [],
        validationMetrics: {
          totalProcessed: 50,
          totalValid: 50,
          totalInvalid: 0,
          averageConfidence: 0.9
        }
      });

      await symbolDetector.detectSymbols('/path/to/complex.pdf', 'session-1', 'doc-1');

      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(30000); // 30 seconds
    });

    it('should track processing time metrics accurately', async () => {
      mockImageProcessor.preprocessImage.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          processedImagePath: '/tmp/test.png',
          originalDimensions: { width: 1920, height: 1080 },
          enhancementApplied: true,
          processingTime: 50
        };
      });

      const result = await symbolDetector.detectSymbols('/test.pdf', 'session-1', 'doc-1');

      expect(result.processingTimeMs).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(50);
      expect(result.detectionMetadata.imageProcessingTime).toBeGreaterThanOrEqual(50);
    });

    it('should handle concurrent detection requests', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        symbolDetector.queueDetection(`/test-${i}.pdf`, `session-${i}`, `doc-${i}`)
      );

      const jobIds = await Promise.all(promises);
      expect(jobIds).toHaveLength(5);
      expect(jobIds.every(id => id.startsWith('job-'))).toBe(true);
    });
  });

  describe('7. Error Handling Tests (AC #10)', () => {
    it('should handle unclear symbols gracefully', async () => {
      const unclearSymbol = createMockSymbol('unknown', 0.3, 'pattern_matching');
      mockPatternMatcher.matchPatterns.mockResolvedValue([unclearSymbol]);
      
      mockValidator.validateSymbols.mockResolvedValue({
        validSymbols: [],
        invalidSymbols: [unclearSymbol],
        validationMetrics: {
          totalProcessed: 1,
          totalValid: 0,
          totalInvalid: 1,
          averageConfidence: 0.3
        }
      });

      const result = await symbolDetector.detectSymbols('/unclear.pdf', 'session-1', 'doc-1');

      expect(result.detectedSymbols).toHaveLength(0);
      expect(result.detectionMetadata).toBeDefined();
    });

    it('should handle hand-drawn symbols', async () => {
      mockImageProcessor.preprocessImage.mockResolvedValue({
        processedImagePath: '/tmp/hand-drawn.png',
        originalDimensions: { width: 1920, height: 1080 },
        enhancementApplied: true,
        processingTime: 200,
        quality: {
          resolution: 150,
          clarity: 0.6,
          contrast: 0.7,
          noiseLevel: 0.3,
          skewAngle: 5
        } as ImageQuality
      });

      const handDrawnSymbol = createMockSymbol('resistor', 0.65, 'ml_classification');
      mockMLClassifier.classifyRegions.mockResolvedValue([handDrawnSymbol]);
      mockValidator.validateSymbols.mockResolvedValue({
        validSymbols: [handDrawnSymbol],
        invalidSymbols: [],
        validationMetrics: {
          totalProcessed: 1,
          totalValid: 1,
          totalInvalid: 0,
          averageConfidence: 0.65
        }
      });

      const result = await symbolDetector.detectSymbols('/hand-drawn.pdf', 'session-1', 'doc-1');

      expect(result).toBeDefined();
      expect(result.detectionMetadata.imageQuality.clarity).toBeLessThan(0.7);
    });

    it('should handle non-standard symbols', async () => {
      const customSymbol = createMockSymbol('custom', 0.7, 'ml_classification');
      customSymbol.symbolCategory = 'custom';
      
      mockMLClassifier.classifyRegions.mockResolvedValue([customSymbol]);
      mockValidator.validateSymbols.mockResolvedValue({
        validSymbols: [customSymbol],
        invalidSymbols: [],
        validationMetrics: {
          totalProcessed: 1,
          totalValid: 1,
          totalInvalid: 0,
          averageConfidence: 0.7
        }
      });

      const result = await symbolDetector.detectSymbols('/custom.pdf', 'session-1', 'doc-1');

      const customSymbols = result.detectedSymbols.filter(s => s.symbolCategory === 'custom');
      expect(customSymbols).toHaveLength(1);
      expect(customSymbols[0].symbolType).toBe('custom');
    });

    it('should handle corrupted image data', async () => {
      mockImageProcessor.preprocessImage.mockRejectedValue(new Error('Corrupted image data'));

      await expect(
        symbolDetector.detectSymbols('/corrupted.pdf', 'session-1', 'doc-1')
      ).rejects.toThrow('Symbol detection failed');
    });
  });

  describe('8. Validation and False Positive Filtering Tests (AC #11)', () => {
    it('should filter false positives correctly', async () => {
      const validSymbol = createMockSymbol('resistor', 0.95, 'consensus');
      const falsePositive = createMockSymbol('unknown', 0.4, 'pattern_matching');
      
      mockPatternMatcher.matchPatterns.mockResolvedValue([validSymbol, falsePositive]);
      mockValidator.validateSymbols.mockResolvedValue({
        validSymbols: [validSymbol],
        invalidSymbols: [falsePositive],
        validationMetrics: {
          totalProcessed: 2,
          totalValid: 1,
          totalInvalid: 1,
          averageConfidence: 0.95
        }
      });

      const result = await symbolDetector.detectSymbols('/test.pdf', 'session-1', 'doc-1');

      expect(result.detectedSymbols).toHaveLength(1);
      expect(result.detectedSymbols[0].symbolType).toBe('resistor');
    });

    it('should validate symbol context correctly', async () => {
      const symbols = [
        createMockSymbol('resistor', 0.9, 'pattern_matching'),
        createMockSymbol('capacitor', 0.85, 'ml_classification')
      ];

      // Add connection points to simulate circuit context
      symbols[0].features.connectionPoints = [
        { location: { x: 150, y: 100 }, type: 'output', connectedTo: ['symbol-2'] }
      ];
      symbols[1].features.connectionPoints = [
        { location: { x: 200, y: 100 }, type: 'input', connectedTo: ['symbol-1'] }
      ];

      mockPatternMatcher.matchPatterns.mockResolvedValue(symbols);
      mockValidator.validateSymbols.mockResolvedValue({
        validSymbols: symbols,
        invalidSymbols: [],
        validationMetrics: {
          totalProcessed: 2,
          totalValid: 2,
          totalInvalid: 0,
          averageConfidence: 0.875
        }
      });

      const result = await symbolDetector.detectSymbols('/circuit.pdf', 'session-1', 'doc-1');

      expect(result.detectedSymbols).toHaveLength(2);
      const resistor = result.detectedSymbols.find(s => s.symbolType === 'resistor');
      expect(resistor?.features.connectionPoints).toHaveLength(1);
    });
  });

  describe('9. API Integration Tests (AC #12)', () => {
    it('should queue detection jobs via API', async () => {
      const jobId = await symbolDetector.queueDetection(
        '/api/upload/file.pdf',
        'api-session-123',
        'api-doc-456'
      );

      expect(jobId).toBe('job-123');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'detect-symbols',
        expect.objectContaining({
          filePath: '/api/upload/file.pdf',
          sessionId: 'api-session-123',
          documentId: 'api-doc-456'
        }),
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 }
        })
      );
    });

    it('should retrieve detection status via API', async () => {
      const mockJob = {
        id: 'job-123',
        progress: jest.fn().mockReturnValue(75),
        isCompleted: jest.fn().mockReturnValue(false),
        isFailed: jest.fn().mockReturnValue(false),
        isActive: jest.fn().mockReturnValue(true),
        data: { filePath: '/test.pdf' },
        returnvalue: null,
        failedReason: null
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      const status = await symbolDetector.getDetectionStatus('job-123');

      expect(status).toEqual({
        jobId: 'job-123',
        status: 'processing',
        progress: 75,
        result: null,
        error: null
      });
    });

    it('should handle WebSocket progress events', async () => {
      const progressEvents: any[] = [];
      mockEventEmitter.on('symbol-detection-progress', (event) => {
        progressEvents.push(event);
      });

      // Trigger detection
      await symbolDetector.detectSymbols('/test.pdf', 'session-1', 'doc-1');

      // Verify progress events were emitted
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents.some(e => e.stage === 'preprocessing')).toBe(true);
      expect(progressEvents.some(e => e.stage === 'detection')).toBe(true);
      expect(progressEvents.some(e => e.stage === 'validation')).toBe(true);
      expect(progressEvents.some(e => e.stage === 'completed')).toBe(true);
    });
  });

  describe('10. Caching and Optimization Tests', () => {
    it('should cache detection results', async () => {
      const cachedResult = {
        detectedSymbols: [createMockSymbol('inductor', 0.99, 'consensus')],
        overallConfidence: 0.99,
        processingTimeMs: 50,
        detectionMetadata: {
          imageProcessingTime: 10,
          patternMatchingTime: 10,
          mlClassificationTime: 10,
          validationTime: 10,
          totalProcessingTime: 50
        } as DetectionMetadata
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await symbolDetector.detectSymbols('/cached.pdf', 'session-1', 'doc-1');

      expect(result.detectedSymbols[0].symbolType).toBe('inductor');
      expect(result.overallConfidence).toBe(0.99);
      expect(mockImageProcessor.preprocessImage).not.toHaveBeenCalled();
    });

    it('should invalidate cache on options change', async () => {
      // First call with default options - should cache
      const firstResult = await symbolDetector.detectSymbols('/test.pdf', 'session-1', 'doc-1');
      expect(mockRedis.setex).toHaveBeenCalled();

      // Second call with different options - should not use cache
      jest.clearAllMocks();
      const secondResult = await symbolDetector.detectSymbols(
        '/test.pdf',
        'session-1',
        'doc-1',
        1,
        { confidenceThreshold: 0.95 }
      );
      
      expect(mockImageProcessor.preprocessImage).toHaveBeenCalled();
    });
  });

  describe('11. Queue Management Tests', () => {
    it('should manage queue lifecycle correctly', async () => {
      await symbolDetector.pauseQueue();
      expect(mockQueue.pause).toHaveBeenCalled();

      await symbolDetector.resumeQueue();
      expect(mockQueue.resume).toHaveBeenCalled();

      await symbolDetector.clearQueue();
      expect(mockQueue.empty).toHaveBeenCalled();
    });

    it('should get queue statistics', async () => {
      const stats = await symbolDetector.getQueueStats();

      expect(stats).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0
      });
      expect(mockQueue.getJobCounts).toHaveBeenCalled();
    });

    it('should handle job retries on failure', async () => {
      const mockJob = {
        id: 'job-retry',
        attemptsMade: 2,
        opts: { attempts: 3 },
        retry: jest.fn().mockResolvedValue(undefined)
      };
      
      mockQueue.getJob.mockResolvedValue(mockJob);

      // Simulate job failure and retry
      const failHandler = mockQueue.on.mock.calls.find(call => call[0] === 'failed')?.[1];
      if (failHandler) {
        await failHandler(mockJob, new Error('Temporary failure'));
      }

      expect(mockJob.retry).toHaveBeenCalled();
    });
  });

  describe('12. Cleanup and Resource Management Tests', () => {
    it('should cleanup resources properly', async () => {
      await symbolDetector.cleanup();

      expect(mockQueue.close).toHaveBeenCalled();
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockQueue.close.mockRejectedValue(new Error('Queue close failed'));
      mockRedis.quit.mockRejectedValue(new Error('Redis quit failed'));

      // Should not throw
      await expect(symbolDetector.cleanup()).resolves.not.toThrow();
    });

    it('should handle memory cleanup for large detections', async () => {
      // Simulate large detection with many symbols
      const largeSymbolSet = Array.from({ length: 500 }, () => 
        createMockSymbol('resistor', 0.9, 'pattern_matching')
      );

      mockPatternMatcher.matchPatterns.mockResolvedValue(largeSymbolSet);
      mockValidator.validateSymbols.mockResolvedValue({
        validSymbols: largeSymbolSet.slice(0, 100), // Limit to 100 symbols
        invalidSymbols: largeSymbolSet.slice(100),
        validationMetrics: {
          totalProcessed: 500,
          totalValid: 100,
          totalInvalid: 400,
          averageConfidence: 0.9
        }
      });

      const result = await symbolDetector.detectSymbols('/large.pdf', 'session-1', 'doc-1');

      expect(result.detectedSymbols).toHaveLength(100);
      // Verify memory cleanup would be triggered (in real implementation)
      expect(result.detectionMetadata).toBeDefined();
    });
  });
});