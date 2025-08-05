/**
 * Symbol Detection Repository Integration Tests
 * 
 * Tests for database operations and data persistence
 * Story: 4.1 Symbol Detection Engine  
 * Task: 4.1.4 Database Storage Integration
 */

import { Pool } from 'pg';
import { SymbolDetectionRepository } from '../symbol-detection.repository';
import { 
  SymbolDetectionResult, 
  DetectionJob,
  ElectricalSymbolType 
} from '../../../../../shared/types/symbol-detection.types';

// Mock Pool for testing
jest.mock('pg');

describe('SymbolDetectionRepository', () => {
  let repository: SymbolDetectionRepository;
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

    repository = new SymbolDetectionRepository(mockDatabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('saveDetectionResult', () => {
    it('should save detection result with transaction rollback on error', async () => {
      const mockResult: SymbolDetectionResult = {
        id: 'test-result-id',
        queryId: 'session-123-query-456',
        documentId: 'test-doc-id',
        pageNumber: 1,
        detectedSymbols: [
          {
            id: 'symbol-1',
            symbolType: 'resistor' as ElectricalSymbolType,
            symbolCategory: 'passive',
            description: 'Fixed resistor',
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

      // Mock successful insert operations
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'test-result-id' }] }) // Main result insert
        .mockResolvedValueOnce({ rows: [] }) // Symbol insert
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await repository.saveDetectionResult(mockResult);

      expect(result).toBe('test-result-id');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO electrical_analysis.symbol_detection_results'),
        expect.arrayContaining([
          'test-result-id',
          'session-123-query-456',
          'test-doc-id',
          '123', // Extracted session ID
          1,
          2500,
          0.95,
          expect.any(String), // JSON metadata
        ])
      );
    });

    it('should rollback transaction on error', async () => {
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
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Database constraint violation')) // Insert error
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(repository.saveDetectionResult(mockResult)).rejects.toThrow(
        'Failed to save detection result'
      );

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('getDetectionResult', () => {
    it('should retrieve detection result with all symbols', async () => {
      const mockResultRow = {
        id: 'test-result-id',
        query_id: 'test-query-id',
        document_id: 'test-doc-id',
        page_number: 1,
        processing_time_ms: 2500,
        overall_confidence: '0.95',
        detection_metadata: {
          imageProcessingTime: 500,
          patternMatchingTime: 1000,
          mlClassificationTime: 800,
          validationTime: 200,
          totalProcessingTime: 2500,
        },
        created_at: new Date(),
      };

      const mockSymbolRows = [
        {
          id: 'symbol-1',
          symbol_type: 'resistor',
          symbol_category: 'passive',
          description: 'Fixed resistor',
          confidence: '0.95',
          location_x: '0.5',
          location_y: '0.3',
          original_x: 250,
          original_y: 150,
          image_width: 500,
          image_height: 500,
          bounding_box: { x: 245, y: 145, width: 10, height: 10, area: 100 },
          symbol_features: { complexity: 0.2 },
          detection_method: 'pattern_matching',
          validation_score: '0.9',
        },
      ];

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [mockResultRow] }) // Main result query
        .mockResolvedValueOnce({ rows: mockSymbolRows }); // Symbols query

      const result = await repository.getDetectionResult('test-result-id');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('test-result-id');
      expect(result!.detectedSymbols).toHaveLength(1);
      expect(result!.detectedSymbols[0].symbolType).toBe('resistor');
      expect(result!.detectedSymbols[0].confidence).toBe(0.95);
    });

    it('should return null when result not found', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.getDetectionResult('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('listDetectionResults', () => {
    it('should return paginated results with total count', async () => {
      const mockCountResult = { rows: [{ total: '5' }] };
      const mockResultsRows = [
        {
          id: 'result-1',
          query_id: 'query-1',
          document_id: 'doc-1',
          page_number: 1,
          processing_time_ms: 2000,
          overall_confidence: '0.9',
          detection_metadata: {},
          created_at: new Date(),
        },
        {
          id: 'result-2',
          query_id: 'query-2',
          document_id: 'doc-2',
          page_number: 1,
          processing_time_ms: 1500,
          overall_confidence: '0.85',
          detection_metadata: {},
          created_at: new Date(),
        },
      ];

      mockDatabase.query
        .mockResolvedValueOnce(mockCountResult) // Count query
        .mockResolvedValueOnce({ rows: mockResultsRows }) // Results query
        .mockResolvedValueOnce({ rows: [] }) // Symbols for result-1
        .mockResolvedValueOnce({ rows: [] }); // Symbols for result-2

      const result = await repository.listDetectionResults('session-123', 10, 0);

      expect(result.total).toBe(5);
      expect(result.results).toHaveLength(2);
    });
  });

  describe('createDetectionJob', () => {
    it('should create detection job with all required fields', async () => {
      const mockJob: DetectionJob = {
        id: 'job-123',
        documentId: 'doc-123',
        sessionId: 'session-123',
        pageNumber: 1,
        imageBuffer: Buffer.from('test-image'),
        settings: {
          confidenceThreshold: 0.7,
          maxSymbolsPerPage: 100,
          enableMLClassification: true,
          enablePatternMatching: true,
          enableLLMValidation: false,
          processingTimeout: 30000,
        },
        createdAt: new Date(),
        status: 'pending',
      };

      mockDatabase.query.mockResolvedValueOnce({ rows: [{ id: 'job-123' }] });

      const result = await repository.createDetectionJob(mockJob);

      expect(result).toBe('job-123');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO electrical_analysis.detection_jobs'),
        [
          'job-123',
          'doc-123',
          'session-123',
          1,
          'pending',
          expect.any(String), // JSON settings
        ]
      );
    });
  });

  describe('updateDetectionJob', () => {
    it('should update job status and progress', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      await repository.updateDetectionJob('job-123', {
        status: 'processing',
        progressStage: 'Pattern matching',
        progressPercent: 50,
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE electrical_analysis.detection_jobs'),
        expect.arrayContaining(['processing', 'Pattern matching', 50, 'job-123'])
      );
    });

    it('should set appropriate timestamps based on status', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      await repository.updateDetectionJob('job-123', { status: 'completed' });

      const call = mockDatabase.query.mock.calls[0];
      expect(call[0]).toContain('completed_at = NOW()');
    });

    it('should handle empty updates gracefully', async () => {
      await repository.updateDetectionJob('job-123', {});

      expect(mockDatabase.query).not.toHaveBeenCalled();
    });
  });

  describe('cacheDetectionResult', () => {
    it('should cache result with expiration', async () => {
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

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      await repository.cacheDetectionResult(
        'document-hash-123',
        1,
        'settings-hash-456',
        mockResult,
        expiresAt
      );

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO electrical_analysis.detection_cache'),
        [
          'document-hash-123',
          1,
          'settings-hash-456',
          expect.any(String), // JSON result
          expiresAt,
        ]
      );
    });

    it('should handle cache conflicts with ON CONFLICT clause', async () => {
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

      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      await repository.cacheDetectionResult(
        'document-hash-123',
        1,
        'settings-hash-456',
        mockResult,
        new Date()
      );

      const call = mockDatabase.query.mock.calls[0];
      expect(call[0]).toContain('ON CONFLICT');
      expect(call[0]).toContain('DO UPDATE SET');
    });
  });

  describe('getCachedResult', () => {
    it('should return cached result and update hit count', async () => {
      const mockCachedResult = {
        id: 'cached-result-id',
        queryId: 'test-query-id',
        documentId: 'test-doc-id',
        pageNumber: 1,
        detectedSymbols: [],
        processingTimeMs: 1000,
        overallConfidence: 0.8,
        detectionMetadata: {},
        createdAt: new Date(),
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ cached_result: mockCachedResult }],
      });

      const result = await repository.getCachedResult(
        'document-hash-123',
        1,
        'settings-hash-456'
      );

      expect(result).toEqual(mockCachedResult);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE electrical_analysis.detection_cache'),
        ['document-hash-123', 1, 'settings-hash-456']
      );
    });

    it('should return null for expired cache entries', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rows: [] });

      const result = await repository.getCachedResult(
        'document-hash-123',
        1,
        'settings-hash-456'
      );

      expect(result).toBeNull();
    });
  });

  describe('getSymbolLibraryEntries', () => {
    it('should return all entries when no filters applied', async () => {
      const mockEntries = [
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

      mockDatabase.query.mockResolvedValueOnce({ rows: mockEntries });

      const result = await repository.getSymbolLibraryEntries();

      expect(result).toHaveLength(1);
      expect(result[0].symbolType).toBe('resistor');
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM electrical_analysis.symbol_library'),
        []
      );
    });

    it('should apply filters when provided', async () => {
      const mockEntries = [
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

      mockDatabase.query.mockResolvedValueOnce({ rows: mockEntries });

      const result = await repository.getSymbolLibraryEntries('resistor', 'passive');

      expect(result).toHaveLength(1);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE symbol_type = $1 AND symbol_category = $2'),
        ['resistor', 'passive']
      );
    });
  });

  describe('saveDetectionMetrics', () => {
    it('should save multiple metrics for a detection result', async () => {
      const metrics = [
        {
          metricType: 'processing_time',
          metricValue: 2500,
          metricUnit: 'ms',
        },
        {
          metricType: 'symbols_detected',
          metricValue: 5,
          metricUnit: 'count',
        },
      ];

      mockDatabase.query.mockResolvedValue({ rows: [] });

      await repository.saveDetectionMetrics('result-123', metrics);

      expect(mockDatabase.query).toHaveBeenCalledTimes(2);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO electrical_analysis.detection_metrics'),
        ['result-123', 'processing_time', 2500, 'ms', null]
      );
    });
  });

  describe('cleanExpiredCache', () => {
    it('should return number of cleaned entries', async () => {
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ cleanup_expired_detection_cache: 10 }],
      });

      const result = await repository.cleanExpiredCache();

      expect(result).toBe(10);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        'SELECT cleanup_expired_detection_cache()'
      );
    });
  });

  describe('deleteDetectionResult', () => {
    it('should delete result and return true when successful', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await repository.deleteDetectionResult('result-123');

      expect(result).toBe(true);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM electrical_analysis.symbol_detection_results'),
        ['result-123']
      );
    });

    it('should return false when no rows deleted', async () => {
      mockDatabase.query.mockResolvedValueOnce({ rowCount: 0 });

      const result = await repository.deleteDetectionResult('nonexistent-id');

      expect(result).toBe(false);
    });
  });

  describe('extractSessionFromQueryId', () => {
    it('should extract session ID from formatted query ID', async () => {
      const mockResult: SymbolDetectionResult = {
        id: 'test-result-id',
        queryId: 'session-abc123-query-def456',
        documentId: 'test-doc-id',
        pageNumber: 1,
        detectedSymbols: [],
        processingTimeMs: 1000,
        overallConfidence: 0.8,
        detectionMetadata: {} as any,
        createdAt: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'test-result-id' }] }) // Insert
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await repository.saveDetectionResult(mockResult);

      // Verify that session ID was extracted correctly
      const insertCall = mockClient.query.mock.calls.find((call: any) =>
        call[0].includes('INSERT INTO electrical_analysis.symbol_detection_results')
      );
      expect(insertCall[1]).toContain('abc123'); // Extracted session ID
    });

    it('should use full query ID when pattern does not match', async () => {
      const mockResult: SymbolDetectionResult = {
        id: 'test-result-id',
        queryId: 'simple-query-id',
        documentId: 'test-doc-id',
        pageNumber: 1,
        detectedSymbols: [],
        processingTimeMs: 1000,
        overallConfidence: 0.8,
        detectionMetadata: {} as any,
        createdAt: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'test-result-id' }] }) // Insert
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await repository.saveDetectionResult(mockResult);

      // Verify that full query ID was used as session ID
      const insertCall = mockClient.query.mock.calls.find((call: any) =>
        call[0].includes('INSERT INTO electrical_analysis.symbol_detection_results')
      );
      expect(insertCall[1]).toContain('simple-query-id');
    });
  });
});