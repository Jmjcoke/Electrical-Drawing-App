/**
 * Symbol Detection Service Tests
 */

import { SymbolDetectionService } from '../symbol-detector';
import { DetectionSettings } from '../../../../../shared/types/symbol-detection.types';

describe('SymbolDetectionService', () => {
  let symbolDetectionService: SymbolDetectionService;
  const mockRedisConfig = {
    host: 'localhost',
    port: 6379,
  };

  beforeEach(() => {
    symbolDetectionService = new SymbolDetectionService(mockRedisConfig);
  });

  afterEach(async () => {
    await symbolDetectionService.shutdown();
  });

  describe('processDocument', () => {
    it('should process a PDF document for symbol detection', async () => {
      const mockPdfBuffer = Buffer.from('mock-pdf-data');
      const documentId = 'test-doc-1';
      const sessionId = 'test-session-1';
      const settings: Partial<DetectionSettings> = {
        confidenceThreshold: 0.7,
        maxSymbolsPerPage: 50,
      };

      const jobId = await symbolDetectionService.processDocument(
        documentId,
        sessionId,
        mockPdfBuffer,
        settings
      );

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');
    });

    it('should handle empty PDF buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const documentId = 'test-doc-2';
      const sessionId = 'test-session-2';

      await expect(
        symbolDetectionService.processDocument(documentId, sessionId, emptyBuffer)
      ).rejects.toThrow();
    });
  });

  describe('getJobStatus', () => {
    it('should return null for non-existent job', async () => {
      const nonExistentJobId = 'non-existent-job';
      
      const result = await symbolDetectionService.getJobStatus(nonExistentJobId);
      
      expect(result).toBeNull();
    });
  });

  describe('getQueueStats', () => {
    it('should return queue statistics', async () => {
      const stats = await symbolDetectionService.getQueueStats();
      
      expect(stats).toHaveProperty('waiting');
      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      expect(typeof stats.waiting).toBe('number');
      expect(typeof stats.active).toBe('number');
      expect(typeof stats.completed).toBe('number');
      expect(typeof stats.failed).toBe('number');
    });
  });

  describe('cancelJob', () => {
    it('should return false for non-existent job', async () => {
      const nonExistentJobId = 'non-existent-job';
      
      const result = await symbolDetectionService.cancelJob(nonExistentJobId);
      
      expect(result).toBe(false);
    });
  });

  describe('event handling', () => {
    it('should emit detection-started event', (done) => {
      symbolDetectionService.on('detection-started', (data) => {
        expect(data).toHaveProperty('documentId');
        expect(data).toHaveProperty('sessionId');
        expect(data).toHaveProperty('jobIds');
        expect(data).toHaveProperty('totalPages');
        done();
      });

      // Trigger event emission
      symbolDetectionService.emit('detection-started', {
        documentId: 'test-doc',
        sessionId: 'test-session',
        jobIds: ['job-1'],
        totalPages: 1,
      });
    });
  });
});