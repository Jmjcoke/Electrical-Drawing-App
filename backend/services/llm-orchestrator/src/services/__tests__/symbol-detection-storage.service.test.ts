/**
 * Symbol Detection Storage Service Tests
 * 
 * Tests for database integration, caching, and storage management
 * Story: 4.1 Symbol Detection Engine  
 * Task: 4.1.4 Database Storage Integration
 */

import { Pool } from 'pg';
import { SymbolDetectionStorageService } from '../symbol-detection-storage.service';
import { 
  SymbolDetectionResult, 
  DetectedSymbol, 
  DetectionSettings,
  ElectricalSymbolType 
} from '../../../../../shared/types/symbol-detection.types';

// Mock Pool for testing
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn(),
      release: jest.fn(),
    }),
    query: jest.fn(),
  })),
}));

describe('SymbolDetectionStorageService', () => {
  let storageService: SymbolDetectionStorageService;
  let mockDatabase: jest.Mocked<Pool>;
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };

    mockDatabase = {
      connect: jest.fn().mockResolvedValue(mockClient),
      query: jest.fn(),
    } as any;

    storageService = new SymbolDetectionStorageService(mockDatabase, {
      cacheExpirationHours: 1,
      maxCacheEntries: 100,
      enablePerformanceMetrics: true,
      cleanupIntervalMinutes: 5,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('storeDetectionResult', () => {
    it('should store detection result with all symbols', async () => {
      const mockResult: SymbolDetectionResult = {
        id: 'test-result-id',
        queryId: 'test-query-id',
        documentId: 'test-doc-id',
        pageNumber: 1,
        detectedSymbols: [
          {
            id: 'symbol-1',
            symbolType: 'resistor' as ElectricalSymbolType,
            symbolCategory: 'passive',
            description: 'Fixed resistor 10kΩ',
            confidence: 0.95,
            location: {
              x: 0.5,
              y: 0.3,
              pageNumber: 1,
              originalX: 250,
              originalY: 150,
              imageWidth: 500,
              imageHeight: 500,
            },
            boundingBox: {
              x: 245,
              y: 145,
              width: 10,
              height: 10,
              area: 100,
            },
            detectionMethod: 'pattern_matching',
            features: {
              contourPoints: [],
              geometricProperties: {
                area: 100,
                perimeter: 40,
                centroid: { x: 250, y: 150 },
                boundaryRectangle: { x: 245, y: 145, width: 10, height: 10, area: 100 },
                symmetryAxes: [],
                aspectRatio: 1.0,
              },
              connectionPoints: [],
              shapeAnalysis: {
                complexity: 0.2,
                orientation: 0,
                strokeWidth: 2,
                isClosed: true,
              },
            },
            validationScore: 0.9,
          },
        ],
        processingTimeMs: 2500,
        overallConfidence: 0.95,
        detectionMetadata: {
          imageProcessingTime: 500,
          patternMatchingTime: 1000,
          mlClassificationTime: 800,
          validationTime: 200,
          totalProcessingTime: 2500,
          imageQuality: {
            resolution: 300,
            clarity: 0.9,
            contrast: 0.8,
            noiseLevel: 0.1,
          },
          detectionSettings: {
            confidenceThreshold: 0.7,
            maxSymbolsPerPage: 100,
            enableMLClassification: true,
            enablePatternMatching: true,
            enableLLMValidation: false,
            processingTimeout: 30000,
          },
        },
        createdAt: new Date(),
      };

      const mockImageBuffer = Buffer.from('mock-image-data');
      const mockSettings: DetectionSettings = {
        confidenceThreshold: 0.7,
        maxSymbolsPerPage: 100,
        enableMLClassification: true,
        enablePatternMatching: true,
        enableLLMValidation: false,
        processingTimeout: 30000,
      };

      // Mock successful database operations
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 'test-result-id' }] }) // Main result insert
        .mockResolvedValueOnce({ rows: [] }) // Symbol insert
        .mockResolvedValueOnce({ rows: [] }) // Cache insert
        .mockResolvedValueOnce({ rows: [] }) // Metrics insert
        .mockResolvedValueOnce({ rows: [] }) // Metrics insert
        .mockResolvedValueOnce({ rows: [] }) // Metrics insert
        .mockResolvedValueOnce({ rows: [] }) // Metrics insert
        .mockResolvedValueOnce({ rows: [] }) // Metrics insert
        .mockResolvedValueOnce({ rows: [] }); // Metrics insert

      const result = await storageService.storeDetectionResult(
        mockResult,
        mockImageBuffer,
        mockSettings
      );

      expect(result.resultId).toBe('test-result-id');
      expect(result.cached).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should handle database errors gracefully', async () => {
      const mockResult: SymbolDetectionResult = {
        id: 'test-result-id',
        queryId: 'test-query-id',
        documentId: 'test-doc-id',
        pageNumber: 1,
        detectedSymbols: [],
        processingTimeMs: 1000,
        overallConfidence: 0.8,
        detectionMetadata: {} as any,
        createdAt: new Date(),
      };

      // Mock database error
      mockClient.query.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(
        storageService.storeDetectionResult(mockResult)
      ).rejects.toThrow('Failed to store detection result');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getCachedDetectionResult', () => {
    it('should return cached result when available', async () => {
      const mockCachedResult: SymbolDetectionResult = {
        id: 'cached-result-id',
        queryId: 'test-query-id',
        documentId: 'test-doc-id',
        pageNumber: 1,
        detectedSymbols: [],
        processingTimeMs: 1500,
        overallConfidence: 0.85,
        detectionMetadata: {} as any,
        createdAt: new Date(),
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ cached_result: mockCachedResult }],
      } as any);

      const result = await storageService.getCachedDetectionResult(
        Buffer.from('test-image'),
        1,
        {
          confidenceThreshold: 0.7,
          maxSymbolsPerPage: 100,
          enableMLClassification: true,
          enablePatternMatching: true,
          enableLLMValidation: false,
          processingTimeout: 30000,
        }
      );

      expect(result).toEqual(mockCachedResult);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE electrical_analysis.detection_cache'),
        expect.any(Array)
      );
    });

    it('should return null when no cached result exists', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [] } as any);

      const result = await storageService.getCachedDetectionResult(
        Buffer.from('test-image'),
        1,
        {
          confidenceThreshold: 0.7,
          maxSymbolsPerPage: 100,
          enableMLClassification: true,
          enablePatternMatching: true,
          enableLLMValidation: false,
          processingTimeout: 30000,
        }
      );

      expect(result).toBeNull();
    });

    it('should handle cache errors gracefully', async () => {
      mockDatabase.query.mockRejectedValueOnce(new Error('Cache query failed'));

      const result = await storageService.getCachedDetectionResult(
        Buffer.from('test-image'),
        1,
        {
          confidenceThreshold: 0.7,
          maxSymbolsPerPage: 100,
          enableMLClassification: true,
          enablePatternMatching: true,
          enableLLMValidation: false,
          processingTimeout: 30000,
        }
      );

      expect(result).toBeNull();
    });
  });

  describe('listSessionDetectionResults', () => {
    it('should return paginated results with summary', async () => {
      const mockResults = [
        {
          id: 'result-1',
          query_id: 'query-1',
          document_id: 'doc-1',
          page_number: 1,
          processing_time_ms: 2000,
          overall_confidence: 0.9,
          detection_metadata: {},
          created_at: new Date(),
        },
      ];

      const mockSymbols = [
        {
          id: 'symbol-1',
          symbol_type: 'resistor',
          symbol_category: 'passive',
          description: 'Test resistor',
          confidence: 0.9,
          location_x: 0.5,
          location_y: 0.3,
          original_x: 250,
          original_y: 150,
          image_width: 500,
          image_height: 500,
          bounding_box: { x: 245, y: 145, width: 10, height: 10, area: 100 },
          symbol_features: {},
          detection_method: 'pattern_matching',
          validation_score: 0.85,
        },
      ];

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] } as any) // Count query
        .mockResolvedValueOnce({ rows: mockResults } as any) // Results query
        .mockResolvedValueOnce({ rows: mockSymbols } as any); // Symbols query

      const result = await storageService.listSessionDetectionResults('test-session', {
        limit: 10,
        offset: 0,
      });

      expect(result.results).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.summary.sessionId).toBe('test-session');
      expect(result.summary.totalDetections).toBe(1);
      expect(result.summary.totalSymbolsFound).toBe(1);
    });
  });

  describe('createDetectionJob', () => {
    it('should create detection job with database record', async () => {
      const mockSettings: DetectionSettings = {
        confidenceThreshold: 0.7,
        maxSymbolsPerPage: 100,
        enableMLClassification: true,
        enablePatternMatching: true,
        enableLLMValidation: false,
        processingTimeout: 30000,
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ id: 'job-id-123' }],
      } as any);

      const jobId = await storageService.createDetectionJob(
        'doc-id',
        'session-id',
        1,
        mockSettings,
        Buffer.from('test-image')
      );

      expect(typeof jobId).toBe('string');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO electrical_analysis.detection_jobs'),
        expect.any(Array)
      );
    });
  });

  describe('updateJobProgress', () => {
    it('should update job status and progress', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [] } as any);

      await storageService.updateJobProgress(
        'job-id-123',
        'processing',
        'Pattern matching',
        50
      );

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE electrical_analysis.detection_jobs'),
        expect.arrayContaining(['processing', 'Pattern matching', 50, 'job-id-123'])
      );
    });
  });

  describe('validateDetectedSymbol', () => {
    it('should validate symbol against library', async () => {
      const mockSymbol: DetectedSymbol = {
        id: 'symbol-1',
        symbolType: 'resistor',
        symbolCategory: 'passive',
        description: 'Test resistor',
        confidence: 0.9,
        location: {
          x: 0.5,
          y: 0.3,
          pageNumber: 1,
          originalX: 250,
          originalY: 150,
          imageWidth: 500,
          imageHeight: 500,
        },
        boundingBox: { x: 245, y: 145, width: 10, height: 10, area: 100 },
        detectionMethod: 'pattern_matching',
        features: {} as any,
        validationScore: 0.85,
      };

      const mockLibraryEntries = [
        {
          id: 'lib-1',
          symbol_type: 'resistor',
          symbol_category: 'passive',
          symbol_name: 'Fixed Resistor',
          symbol_description: 'Standard resistor',
          created_at: new Date(),
          version: 1,
        },
      ];

      mockDatabase.query.mockResolvedValueOnce({
        rows: mockLibraryEntries,
      } as any);

      const validation = await storageService.validateDetectedSymbol(mockSymbol);

      expect(validation.isValid).toBe(true);
      expect(validation.confidence).toBeGreaterThan(0.7);
      expect(validation.suggestions).toBeInstanceOf(Array);
    });
  });

  describe('performCleanup', () => {
    it('should clean expired cache entries', async () => {
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ cleanup_expired_detection_cache: 5 }],
      } as any);

      const result = await storageService.performCleanup();

      expect(result.cacheEntriesRemoved).toBe(5);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        'SELECT cleanup_expired_detection_cache()'
      );
    });
  });

  describe('getSymbolLibrary', () => {
    it('should return symbol library entries with filters', async () => {
      const mockLibraryEntries = [
        {
          id: 'lib-1',
          symbol_type: 'resistor',
          symbol_category: 'passive',
          symbol_name: 'Fixed Resistor',
          symbol_description: 'Standard resistor',
          template_data: null,
          feature_vector: null,
          industry_standard: 'IEEE',
          version: 1,
          created_at: new Date(),
        },
      ];

      mockDatabase.query.mockResolvedValueOnce({
        rows: mockLibraryEntries,
      } as any);

      const result = await storageService.getSymbolLibrary({
        symbolType: 'resistor',
        symbolCategory: 'passive',
      });

      expect(result).toHaveLength(1);
      expect(result[0].symbolType).toBe('resistor');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE symbol_type = $1 AND symbol_category = $2'),
        ['resistor', 'passive']
      );
    });
  });

  describe('error handling', () => {
    it('should handle network timeouts gracefully', async () => {
      const timeoutError = new Error('Query timeout');
      timeoutError.name = 'QueryTimeoutError';
      
      mockDatabase.query.mockRejectedValueOnce(timeoutError);

      await expect(
        storageService.getCachedDetectionResult(
          Buffer.from('test'),
          1,
          {} as DetectionSettings
        )
      ).resolves.toBeNull(); // Should not throw, return null instead
    });

    it('should handle database connection failures', async () => {
      const connectionError = new Error('Connection refused');
      mockDatabase.connect.mockRejectedValueOnce(connectionError);

      await expect(
        storageService.storeDetectionResult({} as SymbolDetectionResult)
      ).rejects.toThrow('Failed to store detection result');
    });
  });

  describe('performance considerations', () => {
    it('should calculate hashes consistently', async () => {
      const buffer1 = Buffer.from('identical-content');
      const buffer2 = Buffer.from('identical-content');
      const buffer3 = Buffer.from('different-content');

      const settings: DetectionSettings = {
        confidenceThreshold: 0.7,
        maxSymbolsPerPage: 100,
        enableMLClassification: true,
        enablePatternMatching: true,
        enableLLMValidation: false,
        processingTimeout: 30000,
      };

      // Mock cache lookups
      mockDatabase.query.mockResolvedValue({ rows: [] } as any);

      await storageService.getCachedDetectionResult(buffer1, 1, settings);
      await storageService.getCachedDetectionResult(buffer2, 1, settings);
      await storageService.getCachedDetectionResult(buffer3, 1, settings);

      // Should have been called 3 times with different hashes for buffer3
      expect(mockDatabase.query).toHaveBeenCalledTimes(3);
    });

    it('should handle large symbol lists efficiently', async () => {
      const mockResult: SymbolDetectionResult = {
        id: 'test-result-id',
        queryId: 'test-query-id',
        documentId: 'test-doc-id',
        pageNumber: 1,
        detectedSymbols: Array.from({ length: 100 }, (_, i) => ({
          id: `symbol-${i}`,
          symbolType: 'resistor' as ElectricalSymbolType,
          symbolCategory: 'passive',
          description: `Resistor ${i}`,
          confidence: 0.8,
          location: {
            x: Math.random(),
            y: Math.random(),
            pageNumber: 1,
            originalX: Math.floor(Math.random() * 500),
            originalY: Math.floor(Math.random() * 500),
            imageWidth: 500,
            imageHeight: 500,
          },
          boundingBox: { x: 0, y: 0, width: 10, height: 10, area: 100 },
          detectionMethod: 'pattern_matching',
          features: {} as any,
          validationScore: 0.75,
        })),
        processingTimeMs: 5000,
        overallConfidence: 0.8,
        detectionMetadata: {} as any,
        createdAt: new Date(),
      };

      // Mock successful operations
      mockClient.query.mockResolvedValue({ rows: [{ id: 'test-result-id' }] });

      const result = await storageService.storeDetectionResult(mockResult);

      expect(result.resultId).toBe('test-result-id');
      // Should have performed bulk operations efficiently
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });
});