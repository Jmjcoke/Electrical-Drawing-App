/**
 * Symbol Detection Controller Tests
 * 
 * Comprehensive test suite for symbol detection API endpoints
 */

import { Request, Response } from 'express';
import { SymbolDetectionController } from '../symbol-detection.controller';
import { SymbolDetectionService } from '../../detection/symbol-detector';
import {
  SymbolDetectionResult,
  DetectionJobResult,
  SymbolDetectionError
} from '../../../../../shared/types/symbol-detection.types';

// Mock the SymbolDetectionService
jest.mock('../../detection/symbol-detector');

describe('SymbolDetectionController', () => {
  let controller: SymbolDetectionController;
  let mockDetectionService: jest.Mocked<SymbolDetectionService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    // Create mock service
    mockDetectionService = {
      processDocument: jest.fn(),
      getJobStatus: jest.fn(),
      cancelJob: jest.fn(),
      getQueueStats: jest.fn(),
      shutdown: jest.fn(),
    } as unknown as jest.Mocked<SymbolDetectionService>;

    // Create controller instance
    controller = new SymbolDetectionController(mockDetectionService);

    // Create mock Express request and response objects
    mockRequest = {
      params: {},
      body: {},
      query: {},
      file: undefined,
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startDetection', () => {
    beforeEach(() => {
      mockRequest.params = { sessionId: 'session-123', documentId: 'doc-456' };
      mockRequest.file = {
        buffer: Buffer.from('fake-pdf-content'),
        mimetype: 'application/pdf',
        originalname: 'test.pdf',
        size: 1024,
      } as Express.Multer.File;
    });

    it('should successfully start symbol detection', async () => {
      const jobId = 'job-789';
      const queueStats = { waiting: 2, active: 1, completed: 10, failed: 1 };
      
      mockDetectionService.processDocument.mockResolvedValue(jobId);
      mockDetectionService.getQueueStats.mockResolvedValue(queueStats);

      await controller.startDetection(mockRequest as Request, mockResponse as Response);

      expect(mockDetectionService.processDocument).toHaveBeenCalledWith(
        'doc-456',
        'session-123',
        expect.any(Buffer),
        undefined
      );
      expect(mockResponse.status).toHaveBeenCalledWith(202);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        jobId,
        message: 'Symbol detection started successfully',
        estimatedTime: 15000, // (2 + 1) * 5000
      });
    });

    it('should pass detection settings to the service', async () => {
      const settings = {
        confidenceThreshold: 0.8,
        maxSymbolsPerPage: 50,
        enableMLClassification: false,
      };
      mockRequest.body = { settings };

      const jobId = 'job-789';
      mockDetectionService.processDocument.mockResolvedValue(jobId);
      mockDetectionService.getQueueStats.mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 });

      await controller.startDetection(mockRequest as Request, mockResponse as Response);

      expect(mockDetectionService.processDocument).toHaveBeenCalledWith(
        'doc-456',
        'session-123',
        expect.any(Buffer),
        settings
      );
    });

    it('should return 400 for missing sessionId', async () => {
      mockRequest.params = { documentId: 'doc-456' };

      await controller.startDetection(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required parameters: sessionId and documentId'
      });
    });

    it('should return 400 for missing documentId', async () => {
      mockRequest.params = { sessionId: 'session-123' };

      await controller.startDetection(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required parameters: sessionId and documentId'
      });
    });

    it('should return 400 for missing PDF file', async () => {
      mockRequest.file = undefined;

      await controller.startDetection(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'PDF file is required'
      });
    });

    it('should return 400 for invalid file type', async () => {
      mockRequest.file = {
        buffer: Buffer.from('fake-content'),
        mimetype: 'image/jpeg',
        originalname: 'test.jpg',
        size: 1024,
      } as Express.Multer.File;

      await controller.startDetection(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Only PDF files are supported'
      });
    });

    it('should handle SymbolDetectionError', async () => {
      const error = new SymbolDetectionError('Test error', 'TEST_ERROR', { detail: 'test' });
      mockDetectionService.processDocument.mockRejectedValue(error);

      await controller.startDetection(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Test error',
        code: 'TEST_ERROR',
        details: { detail: 'test' }
      });
    });

    it('should handle generic errors', async () => {
      const error = new Error('Generic error');
      mockDetectionService.processDocument.mockRejectedValue(error);

      await controller.startDetection(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error during symbol detection initialization'
      });
    });
  });

  describe('getDetectionResult', () => {
    beforeEach(() => {
      mockRequest.params = { sessionId: 'session-123', resultId: 'result-456' };
    });

    it('should return detection result when job is completed', async () => {
      const mockResult: SymbolDetectionResult = {
        id: 'result-456',
        queryId: 'session-123',
        documentId: 'doc-789',
        pageNumber: 1,
        detectedSymbols: [],
        processingTimeMs: 5000,
        overallConfidence: 0.85,
        detectionMetadata: {} as any,
        createdAt: new Date(),
      };

      const jobResult: DetectionJobResult = {
        jobId: 'result-456',
        result: mockResult,
        completedAt: new Date(),
      };

      mockDetectionService.getJobStatus.mockResolvedValue(jobResult);

      await controller.getDetectionResult(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult
      });
    });

    it('should return 202 when job is still processing', async () => {
      const jobResult: DetectionJobResult = {
        jobId: 'result-456',
        completedAt: new Date(),
      };

      mockDetectionService.getJobStatus.mockResolvedValue(jobResult);

      await controller.getDetectionResult(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(202);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Detection job is still processing',
        jobId: 'result-456',
        completedAt: jobResult.completedAt
      });
    });

    it('should return 400 when job failed', async () => {
      const jobResult: DetectionJobResult = {
        jobId: 'result-456',
        error: 'Detection failed',
        completedAt: new Date(),
      };

      mockDetectionService.getJobStatus.mockResolvedValue(jobResult);

      await controller.getDetectionResult(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Detection job failed',
        details: 'Detection failed'
      });
    });

    it('should return 404 when job not found', async () => {
      mockDetectionService.getJobStatus.mockResolvedValue(null);

      await controller.getDetectionResult(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Detection result not found'
      });
    });

    it('should return 400 for missing parameters', async () => {
      mockRequest.params = { sessionId: 'session-123' };

      await controller.getDetectionResult(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required parameters: sessionId and resultId'
      });
    });
  });

  describe('listDetectionResults', () => {
    beforeEach(() => {
      mockRequest.params = { sessionId: 'session-123' };
      mockRequest.query = {
        documentId: 'doc-456',
        limit: '10',
        offset: '0',
      };
    });

    it('should return placeholder response for database integration pending', async () => {
      await controller.listDetectionResults(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Database integration pending - returning placeholder response',
        data: {
          results: [],
          pagination: {
            total: 0,
            limit: 10,
            offset: 0,
            hasMore: false
          },
          filters: {
            sessionId: 'session-123',
            documentId: 'doc-456',
            pageNumber: undefined,
            symbolType: undefined,
            minConfidence: undefined
          }
        }
      });
    });

    it('should return 400 for missing sessionId', async () => {
      mockRequest.params = {};

      await controller.listDetectionResults(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required parameter: sessionId'
      });
    });
  });

  describe('getJobStatus', () => {
    beforeEach(() => {
      mockRequest.params = { sessionId: 'session-123', jobId: 'job-456' };
    });

    it('should return job status when job exists', async () => {
      const jobResult: DetectionJobResult = {
        jobId: 'job-456',
        result: {} as SymbolDetectionResult,
        completedAt: new Date(),
      };

      mockDetectionService.getJobStatus.mockResolvedValue(jobResult);

      await controller.getJobStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          jobId: 'job-456',
          status: 'completed',
          completedAt: jobResult.completedAt,
          result: jobResult.result,
          error: undefined
        }
      });
    });

    it('should return 404 when job not found', async () => {
      mockDetectionService.getJobStatus.mockResolvedValue(null);

      await controller.getJobStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Detection job not found'
      });
    });
  });

  describe('cancelDetection', () => {
    beforeEach(() => {
      mockRequest.params = { sessionId: 'session-123', jobId: 'job-456' };
    });

    it('should successfully cancel job', async () => {
      mockDetectionService.cancelJob.mockResolvedValue(true);

      await controller.cancelDetection(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Detection job cancelled successfully',
        jobId: 'job-456'
      });
    });

    it('should return 400 when job cannot be cancelled', async () => {
      mockDetectionService.cancelJob.mockResolvedValue(false);

      await controller.cancelDetection(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Job cannot be cancelled (not found or already completed)'
      });
    });
  });

  describe('getSymbolLibrary', () => {
    it('should return symbol library information', async () => {
      await controller.getSymbolLibrary(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          symbolTypes: expect.arrayContaining(['resistor', 'capacitor', 'inductor']),
          symbolCategories: expect.arrayContaining(['passive', 'active', 'connector']),
          detectionMethods: expect.arrayContaining(['pattern_matching', 'ml_classification'])
        }
      });
    });
  });

  describe('validateCustomSymbol', () => {
    beforeEach(() => {
      mockRequest.body = {
        symbolData: { /* symbol data */ },
        symbolType: 'resistor',
        symbolCategory: 'passive'
      };
    });

    it('should return validation result', async () => {
      await controller.validateCustomSymbol(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Symbol library integration pending - validation request acknowledged',
        data: {
          isValid: true,
          confidence: 0.85,
          matchedTemplate: 'resistor',
          suggestions: [],
          validatedAt: expect.any(String)
        }
      });
    });

    it('should return 400 for missing parameters', async () => {
      mockRequest.body = { symbolType: 'resistor' };

      await controller.validateCustomSymbol(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required parameters: symbolData, symbolType, symbolCategory'
      });
    });
  });

  describe('getQueueStatistics', () => {
    it('should return queue statistics', async () => {
      const queueStats = { waiting: 5, active: 2, completed: 100, failed: 3 };
      mockDetectionService.getQueueStats.mockResolvedValue(queueStats);

      await controller.getQueueStatistics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          queue: queueStats,
          estimatedWaitTime: 25000, // 5 * 5000
          averageProcessingTime: 5000,
          timestamp: expect.any(String)
        }
      });
    });
  });
});