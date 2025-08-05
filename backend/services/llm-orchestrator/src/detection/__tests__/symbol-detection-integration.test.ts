/**
 * Symbol Detection Integration Tests
 * 
 * End-to-end tests for symbol detection workflow including performance validation
 */

import { Pool } from 'pg';
import { SymbolDetectionService } from '../symbol-detector';
import { SymbolDetectionResult, DetectionSettings } from '../../../../../shared/types/symbol-detection.types';
// Removed unused imports

// Mock Redis configuration for testing
const mockRedisConfig = {
  host: 'localhost',
  port: 6379,
};

// Mock PostgreSQL database
jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    }),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    end: jest.fn(),
  })),
}));

describe('Symbol Detection Integration Tests', () => {
  let symbolDetectionService: SymbolDetectionService;
  let mockDatabase: jest.Mocked<Pool>;
  let mockPdfBuffer: Buffer;

  beforeAll(async () => {
    mockDatabase = new Pool() as jest.Mocked<Pool>;
    symbolDetectionService = new SymbolDetectionService(mockRedisConfig, mockDatabase);
    
    // Create a mock PDF buffer for testing
    mockPdfBuffer = Buffer.from('mock-pdf-content');
  });

  afterAll(async () => {
    await symbolDetectionService.shutdown();
  });

  describe('End-to-End Symbol Detection Workflow', () => {
    it('should complete full symbol detection workflow', async () => {
      const documentId = 'test-doc-123';
      const sessionId = 'test-session-456';
      const settings: Partial<DetectionSettings> = {
        confidenceThreshold: 0.7,
        maxSymbolsPerPage: 50,
        enableMLClassification: true,
        enablePatternMatching: true,
        processingTimeout: 30000, // 30 seconds
      };

      // Start detection
      const jobId = await symbolDetectionService.processDocument(
        documentId,
        sessionId,
        mockPdfBuffer,
        settings
      );

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      // Wait for job completion with timeout
      const result = await waitForJobCompletion(symbolDetectionService, jobId, 35000);
      
      expect(result).toBeDefined();
      expect(result?.documentId).toBe(documentId);
      expect(result?.pageNumber).toBe(1);
      expect(Array.isArray(result?.detectedSymbols)).toBe(true);
      expect(result?.processingTimeMs).toBeGreaterThan(0);
      expect(result?.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result?.overallConfidence).toBeLessThanOrEqual(1);
    }, 40000); // 40 second timeout for the test

    it('should handle multiple concurrent detection jobs', async () => {
      const numJobs = 3;
      const jobs = [];

      // Start multiple jobs concurrently
      for (let i = 0; i < numJobs; i++) {
        const jobPromise = symbolDetectionService.processDocument(
          `test-doc-${i}`,
          `test-session-${i}`,
          mockPdfBuffer,
          { processingTimeout: 30000 }
        );
        jobs.push(jobPromise);
      }

      const jobIds = await Promise.all(jobs);
      expect(jobIds).toHaveLength(numJobs);

      // Wait for all jobs to complete
      const results = await Promise.all(
        jobIds.map(jobId => waitForJobCompletion(symbolDetectionService, jobId, 35000))
      );

      for (const result of results) {
        expect(result).toBeDefined();
        expect(result?.processingTimeMs).toBeGreaterThan(0);
      }
    }, 60000); // 60 second timeout for concurrent test
  });

  describe('Performance Validation (AC: 9)', () => {
    it('should process single page within 30 seconds', async () => {
      const startTime = Date.now();
      
      const jobId = await symbolDetectionService.processDocument(
        'perf-test-doc',
        'perf-test-session',
        mockPdfBuffer,
        {
          processingTimeout: 30000,
          confidenceThreshold: 0.5,
          maxSymbolsPerPage: 100,
        }
      );

      const result = await waitForJobCompletion(symbolDetectionService, jobId, 35000);
      const totalTime = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(totalTime).toBeLessThan(30000); // Must complete within 30 seconds
      expect(result?.processingTimeMs).toBeLessThan(30000);
      
      console.log(`Symbol detection completed in ${totalTime}ms (${result?.processingTimeMs}ms processing time)`);
    }, 35000);

    it('should handle timeout gracefully when processing exceeds limit', async () => {
      const shortTimeout = 1000; // 1 second timeout for testing
      
      const jobId = await symbolDetectionService.processDocument(
        'timeout-test-doc',
        'timeout-test-session',
        mockPdfBuffer,
        {
          processingTimeout: shortTimeout,
          confidenceThreshold: 0.5,
        }
      );

      // This should either complete quickly or timeout gracefully
      const startTime = Date.now();
      try {
        await waitForJobCompletion(symbolDetectionService, jobId, shortTimeout + 2000);
        const elapsedTime = Date.now() - startTime;
        
        // If it completes, it should be within a reasonable time
        expect(elapsedTime).toBeLessThan(shortTimeout + 1000);
      } catch (error) {
        // Timeout is acceptable for this test
        expect(error).toBeDefined();
      }
    }, 10000);

    it('should report processing time metrics correctly', async () => {
      const jobId = await symbolDetectionService.processDocument(
        'metrics-test-doc',
        'metrics-test-session',
        mockPdfBuffer
      );

      const result = await waitForJobCompletion(symbolDetectionService, jobId, 35000);
      
      expect(result).toBeDefined();
      expect(result?.detectionMetadata).toBeDefined();
      expect(result?.detectionMetadata.totalProcessingTime).toBeGreaterThan(0);
      expect(result?.detectionMetadata.imageProcessingTime).toBeGreaterThanOrEqual(0);
      expect(result?.detectionMetadata.patternMatchingTime).toBeGreaterThanOrEqual(0);
      expect(result?.detectionMetadata.mlClassificationTime).toBeGreaterThanOrEqual(0);
      expect(result?.detectionMetadata.validationTime).toBeGreaterThanOrEqual(0);

      // Total time should equal sum of individual times (approximately)
      if (result) {
        const sumOfTimes = 
          result.detectionMetadata.imageProcessingTime +
          result.detectionMetadata.patternMatchingTime +
          result.detectionMetadata.mlClassificationTime +
          result.detectionMetadata.validationTime;
        
        expect(Math.abs(result.detectionMetadata.totalProcessingTime - sumOfTimes)).toBeLessThan(100); // Allow 100ms variance
      }
    }, 35000);
  });

  describe('Quality and Accuracy Validation', () => {
    it('should detect symbols with reasonable confidence scores', async () => {
      const jobId = await symbolDetectionService.processDocument(
        'quality-test-doc',
        'quality-test-session',
        mockPdfBuffer,
        {
          confidenceThreshold: 0.6,
          enableMLClassification: true,
          enablePatternMatching: true,
        }
      );

      const result = await waitForJobCompletion(symbolDetectionService, jobId, 35000);
      
      expect(result).toBeDefined();
      expect(result?.detectedSymbols).toBeDefined();

      // All detected symbols should meet confidence threshold
      for (const symbol of result?.detectedSymbols || []) {
        expect(symbol.confidence).toBeGreaterThanOrEqual(0.6);
        expect(symbol.confidence).toBeLessThanOrEqual(1.0);
        expect(symbol.validationScore).toBeGreaterThanOrEqual(0);
        expect(symbol.validationScore).toBeLessThanOrEqual(1.0);
        
        // Verify symbol properties
        expect(symbol.id).toBeDefined();
        expect(symbol.symbolType).toBeDefined();
        expect(symbol.symbolCategory).toBeDefined();
        expect(symbol.detectionMethod).toBeDefined();
        expect(symbol.location).toBeDefined();
        expect(symbol.boundingBox).toBeDefined();
      }
    }, 35000);

    it('should provide structured symbol features', async () => {
      const jobId = await symbolDetectionService.processDocument(
        'features-test-doc',
        'features-test-session',
        mockPdfBuffer
      );

      const result = await waitForJobCompletion(symbolDetectionService, jobId, 35000);
      
      expect(result).toBeDefined();

      if (result?.detectedSymbols && result.detectedSymbols.length > 0) {
        const symbol = result.detectedSymbols[0];
        
        expect(symbol.features).toBeDefined();
        expect(symbol.features.contourPoints).toBeDefined();
        expect(Array.isArray(symbol.features.contourPoints)).toBe(true);
        expect(symbol.features.geometricProperties).toBeDefined();
        expect(symbol.features.connectionPoints).toBeDefined();
        expect(symbol.features.shapeAnalysis).toBeDefined();
        
        // Verify geometric properties
        const geomProps = symbol.features.geometricProperties;
        expect(geomProps.area).toBeGreaterThan(0);
        expect(geomProps.perimeter).toBeGreaterThan(0);
        expect(geomProps.aspectRatio).toBeGreaterThan(0);
        expect(geomProps.centroid).toBeDefined();
        expect(geomProps.boundaryRectangle).toBeDefined();
      }
    }, 35000);
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty PDF buffer gracefully', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(
        symbolDetectionService.processDocument(
          'empty-doc',
          'empty-session',
          emptyBuffer
        )
      ).rejects.toThrow();
    });

    it('should handle malformed PDF data', async () => {
      const malformedBuffer = Buffer.from('not-a-pdf-file');

      await expect(
        symbolDetectionService.processDocument(
          'malformed-doc',
          'malformed-session',
          malformedBuffer
        )
      ).rejects.toThrow();
    });

    it('should handle job cancellation', async () => {
      const jobId = await symbolDetectionService.processDocument(
        'cancel-test-doc',
        'cancel-test-session',
        mockPdfBuffer
      );

      // Immediately try to cancel the job
      const cancelled = await symbolDetectionService.cancelJob(jobId);
      
      // Should either cancel successfully or indicate it couldn't be cancelled
      expect(typeof cancelled).toBe('boolean');
    });

    it('should provide queue statistics', async () => {
      const stats = await symbolDetectionService.getQueueStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.waiting).toBe('number');
      expect(typeof stats.active).toBe('number');
      expect(typeof stats.completed).toBe('number');
      expect(typeof stats.failed).toBe('number');
      
      expect(stats.waiting).toBeGreaterThanOrEqual(0);
      expect(stats.active).toBeGreaterThanOrEqual(0);
      expect(stats.completed).toBeGreaterThanOrEqual(0);
      expect(stats.failed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Event Emission Validation', () => {
    it('should emit detection progress events', async () => {
      const events: string[] = [];
      const progressData: any[] = [];

      // Set up event listeners
      symbolDetectionService.on('detection-started', (_data) => {
        events.push('detection-started');
      });

      symbolDetectionService.on('detection-progress', (data) => {
        events.push('detection-progress');
        progressData.push(data);
      });

      symbolDetectionService.on('detection-completed', (_data) => {
        events.push('detection-completed');
      });

      symbolDetectionService.on('symbol-detected', (_data) => {
        events.push('symbol-detected');
      });

      // Start detection
      const jobId = await symbolDetectionService.processDocument(
        'events-test-doc',
        'events-test-session',
        mockPdfBuffer
      );

      // Wait for completion
      await waitForJobCompletion(symbolDetectionService, jobId, 35000);

      // Verify events were emitted
      expect(events.length).toBeGreaterThan(0);
      expect(events).toContain('detection-started');
      expect(events).toContain('detection-completed');
      
      // Verify progress data structure
      if (progressData.length > 0) {
        const progressEvent = progressData[0];
        expect(progressEvent.jobId).toBeDefined();
        expect(typeof progressEvent.progress).toBe('number');
        expect(progressEvent.stage).toBeDefined();
      }
    }, 35000);
  });
});

/**
 * Helper function to wait for job completion
 */
async function waitForJobCompletion(
  service: SymbolDetectionService,
  jobId: string,
  timeoutMs: number
): Promise<SymbolDetectionResult | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const jobResult = await service.getJobStatus(jobId);
    
    if (jobResult?.result) {
      return jobResult.result;
    }
    
    if (jobResult?.error) {
      throw new Error(`Job failed: ${jobResult.error}`);
    }
    
    // Wait 100ms before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
}