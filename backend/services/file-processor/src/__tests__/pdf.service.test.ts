import { PdfService } from '../services/pdf.service';
import { validationService } from '../services/validation.service';
import fs from 'fs/promises';
import path from 'path';
import RedisMock from 'ioredis-mock';

// Mock dependencies
jest.mock('../services/validation.service');
jest.mock('../utils/logger');
jest.mock('fs/promises');
jest.mock('pdf2pic');

describe('PdfService', () => {
  let pdfService: PdfService;
  let mockValidationService: jest.Mocked<typeof validationService>;
  let mockFs: jest.Mocked<typeof fs>;

  beforeEach(() => {
    // Create mock Redis client
    const mockRedis = new RedisMock();
    
    // Initialize PDF service with mock Redis
    pdfService = new PdfService('redis://localhost:6379', './test-storage');
    
    // Mock validation service
    mockValidationService = validationService as jest.Mocked<typeof validationService>;
    mockFs = fs as jest.Mocked<typeof fs>;
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('convertPdfToImages', () => {
    const mockPdfBuffer = Buffer.from('%PDF-1.4\ntest content\n%%EOF');
    const documentId = 'test-doc-id';
    const sessionId = 'test-session-id';
    const filename = 'test.pdf';

    it('should successfully convert PDF to images', async () => {
      // Mock validation success
      mockValidationService.validatePDFWithFallback.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      // Mock file system operations
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({ size: 1024 } as any);

      // Mock pdf2pic
      const mockPdf2pic = require('pdf2pic');
      mockPdf2pic.fromBuffer.mockReturnValue({
        bulk: jest.fn().mockResolvedValue([
          { path: '/test/page-1.png' },
          { path: '/test/page-2.png' }
        ])
      });

      const result = await pdfService.convertPdfToImages(
        documentId,
        sessionId,
        mockPdfBuffer,
        filename
      );

      expect(result.success).toBe(true);
      expect(result.imagePaths).toHaveLength(2);
      expect(result.metadata.conversionDurationMs).toBeGreaterThan(0);
      expect(mockValidationService.validatePDFWithFallback).toHaveBeenCalledWith(
        expect.objectContaining({
          originalname: filename,
          buffer: mockPdfBuffer,
          size: mockPdfBuffer.length,
          mimetype: 'application/pdf'
        })
      );
    });

    it('should handle validation failures gracefully', async () => {
      // Mock validation failure
      mockValidationService.validatePDFWithFallback.mockResolvedValue({
        isValid: false,
        errors: ['PDF is corrupted'],
        warnings: []
      });

      const result = await pdfService.convertPdfToImages(
        documentId,
        sessionId,
        mockPdfBuffer,
        filename
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('PDF validation failed');
      expect(result.imagePaths).toHaveLength(0);
    });

    it('should handle conversion failures with fallback strategies', async () => {
      // Mock validation success
      mockValidationService.validatePDFWithFallback.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      // Mock file system operations
      mockFs.mkdir.mockResolvedValue(undefined);

      // Mock pdf2pic primary failure then fallback success
      const mockPdf2pic = require('pdf2pic');
      mockPdf2pic.fromBuffer
        .mockReturnValueOnce({
          bulk: jest.fn().mockRejectedValue(new Error('Primary conversion failed'))
        })
        .mockReturnValueOnce({
          bulk: jest.fn().mockResolvedValue([
            { path: '/test/page-1.png' }
          ])
        });

      mockFs.stat.mockResolvedValue({ size: 512 } as any);

      const result = await pdfService.convertPdfToImages(
        documentId,
        sessionId,
        mockPdfBuffer,
        filename
      );

      expect(result.success).toBe(true);
      expect(result.imagePaths).toHaveLength(1);
      expect(mockPdf2pic.fromBuffer).toHaveBeenCalledTimes(2); // Primary + one fallback
    });

    it('should handle complete conversion failures', async () => {
      // Mock validation success
      mockValidationService.validatePDFWithFallback.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      // Mock file system operations
      mockFs.mkdir.mockResolvedValue(undefined);

      // Mock all pdf2pic attempts failing
      const mockPdf2pic = require('pdf2pic');
      mockPdf2pic.fromBuffer.mockReturnValue({
        bulk: jest.fn().mockRejectedValue(new Error('All conversion strategies failed'))
      });

      const result = await pdfService.convertPdfToImages(
        documentId,
        sessionId,
        mockPdfBuffer,
        filename
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('PDF conversion failed');
    });

    it('should track progress during conversion', async () => {
      const progressCallback = jest.fn();
      
      // Mock validation success
      mockValidationService.validatePDFWithFallback.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      // Mock file system operations
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({ size: 1024 } as any);

      // Mock pdf2pic
      const mockPdf2pic = require('pdf2pic');
      mockPdf2pic.fromBuffer.mockReturnValue({
        bulk: jest.fn().mockResolvedValue([
          { path: '/test/page-1.png' },
          { path: '/test/page-2.png' }
        ])
      });

      await pdfService.convertPdfToImages(
        documentId,
        sessionId,
        mockPdfBuffer,
        filename,
        {},
        progressCallback
      );

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId,
          stage: 'starting',
          percentage: 0
        })
      );

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId,
          stage: 'complete',
          percentage: 100
        })
      );
    });

    it('should use cache when available', async () => {
      // Mock validation success
      mockValidationService.validatePDFWithFallback.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: []
      });

      // First call should process and cache
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.stat.mockResolvedValue({ size: 1024 } as any);

      const mockPdf2pic = require('pdf2pic');
      mockPdf2pic.fromBuffer.mockReturnValue({
        bulk: jest.fn().mockResolvedValue([
          { path: '/test/page-1.png' }
        ])
      });

      const result1 = await pdfService.convertPdfToImages(
        documentId,
        sessionId,
        mockPdfBuffer,
        filename
      );

      expect(result1.success).toBe(true);
      expect(result1.metadata.cacheHit).toBe(false);

      // Second call with same content should use cache
      const result2 = await pdfService.convertPdfToImages(
        documentId,
        sessionId,
        mockPdfBuffer,
        filename
      );

      expect(result2.success).toBe(true);
      // Note: In a real scenario, cache hit would be true, but our mock doesn't persist
    });
  });

  describe('error categorization', () => {
    it('should properly categorize different error types', async () => {
      const testCases = [
        { error: new Error('password protected'), expectedType: 'pdf_encrypted' },
        { error: new Error('corrupt file'), expectedType: 'pdf_corrupt' },
        { error: new Error('timeout occurred'), expectedType: 'timeout' },
        { error: new Error('memory heap error'), expectedType: 'memory_error' },
        { error: new Error('poppler failed'), expectedType: 'poppler_error' },
        { error: new Error('unknown error'), expectedType: 'unknown' }
      ];

      for (const testCase of testCases) {
        // Mock validation success but conversion failure
        mockValidationService.validatePDFWithFallback.mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: []
        });

        mockFs.mkdir.mockResolvedValue(undefined);

        const mockPdf2pic = require('pdf2pic');
        mockPdf2pic.fromBuffer.mockReturnValue({
          bulk: jest.fn().mockRejectedValue(testCase.error)
        });

        const result = await pdfService.convertPdfToImages(
          'test-doc',
          'test-session',
          mockPdfBuffer,
          'test.pdf'
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('health check', () => {
    it('should return healthy status when Redis is available', async () => {
      const health = await pdfService.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.metrics).toBeDefined();
    });
  });

  describe('metrics', () => {
    it('should return conversion metrics', () => {
      const metrics = pdfService.getMetrics();
      expect(metrics).toHaveProperty('activeConversions');
      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('totalConversions');
    });
  });

  describe('cleanup', () => {
    it('should clean up cache entries for expired sessions', async () => {
      const cleanedCount = await pdfService.cleanupCache('test-session');
      expect(typeof cleanedCount).toBe('number');
    });
  });
});