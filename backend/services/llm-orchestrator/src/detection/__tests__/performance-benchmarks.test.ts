/**
 * Symbol Detection Performance Benchmarks
 * 
 * Comprehensive performance testing to validate 30-second processing requirement (AC: 9)
 */

import { SymbolDetectionService } from '../symbol-detector';
import { DetectionSettings } from '../../../../../shared/types/symbol-detection.types';

// Mock Redis configuration
const mockRedisConfig = {
  host: 'localhost',
  port: 6379,
};

interface PerformanceMetrics {
  processingTimeMs: number;
  symbolsDetected: number;
  confidence: number;
  throughput: number; // symbols per second
}

interface BenchmarkResult {
  testName: string;
  metrics: PerformanceMetrics;
  passed: boolean;
  details: string;
}

describe('Symbol Detection Performance Benchmarks', () => {
  let symbolDetectionService: SymbolDetectionService;
  let mockPdfBuffers: { [key: string]: Buffer };

  beforeAll(async () => {
    symbolDetectionService = new SymbolDetectionService(mockRedisConfig);
    
    // Create various mock PDF buffers for different test scenarios
    mockPdfBuffers = {
      small: Buffer.from('small-pdf-content'.repeat(100)),
      medium: Buffer.from('medium-pdf-content'.repeat(1000)),
      large: Buffer.from('large-pdf-content'.repeat(10000)),
      complex: Buffer.from('complex-electrical-drawing'.repeat(5000)),
    };
  });

  afterAll(async () => {
    await symbolDetectionService.shutdown();
  });

  describe('AC 9: Processing Time Under 30 Seconds', () => {
    it('should process small PDF within 30 seconds', async () => {
      const result = await runPerformanceBenchmark(
        'Small PDF Processing',
        mockPdfBuffers.small,
        {
          confidenceThreshold: 0.7,
          maxSymbolsPerPage: 50,
          processingTimeout: 30000,
        }
      );

      expect(result.passed).toBe(true);
      expect(result.metrics.processingTimeMs).toBeLessThan(30000);
      
      console.log(`Small PDF: ${result.metrics.processingTimeMs}ms, ${result.metrics.symbolsDetected} symbols`);
    }, 35000);

    it('should process medium PDF within 30 seconds', async () => {
      const result = await runPerformanceBenchmark(
        'Medium PDF Processing',
        mockPdfBuffers.medium,
        {
          confidenceThreshold: 0.7,
          maxSymbolsPerPage: 100,
          processingTimeout: 30000,
        }
      );

      expect(result.passed).toBe(true);
      expect(result.metrics.processingTimeMs).toBeLessThan(30000);
      
      console.log(`Medium PDF: ${result.metrics.processingTimeMs}ms, ${result.metrics.symbolsDetected} symbols`);
    }, 35000);

    it('should process large PDF within 30 seconds', async () => {
      const result = await runPerformanceBenchmark(
        'Large PDF Processing',
        mockPdfBuffers.large,
        {
          confidenceThreshold: 0.6,
          maxSymbolsPerPage: 200,
          processingTimeout: 30000,
        }
      );

      expect(result.passed).toBe(true);
      expect(result.metrics.processingTimeMs).toBeLessThan(30000);
      
      console.log(`Large PDF: ${result.metrics.processingTimeMs}ms, ${result.metrics.symbolsDetected} symbols`);
    }, 35000);

    it('should process complex electrical drawing within 30 seconds', async () => {
      const result = await runPerformanceBenchmark(
        'Complex Electrical Drawing',
        mockPdfBuffers.complex,
        {
          confidenceThreshold: 0.8,
          maxSymbolsPerPage: 150,
          enableMLClassification: true,
          enablePatternMatching: true,
          processingTimeout: 30000,
        }
      );

      expect(result.passed).toBe(true);
      expect(result.metrics.processingTimeMs).toBeLessThan(30000);
      
      console.log(`Complex Drawing: ${result.metrics.processingTimeMs}ms, ${result.metrics.symbolsDetected} symbols`);
    }, 35000);
  });

  describe('Performance Optimization Validation', () => {
    it('should show improved performance with parallel processing', async () => {
      // Test sequential processing
      const sequentialStart = Date.now();
      for (let i = 0; i < 3; i++) {
        const jobId = await symbolDetectionService.processDocument(
          `seq-doc-${i}`,
          `seq-session-${i}`,
          mockPdfBuffers.medium
        );
        await waitForJobCompletion(jobId, 35000);
      }
      const sequentialTime = Date.now() - sequentialStart;

      // Test parallel processing
      const parallelStart = Date.now();
      const parallelJobs = [];
      for (let i = 0; i < 3; i++) {
        parallelJobs.push(
          symbolDetectionService.processDocument(
            `par-doc-${i}`,
            `par-session-${i}`,
            mockPdfBuffers.medium
          )
        );
      }
      const jobIds = await Promise.all(parallelJobs);
      await Promise.all(jobIds.map(jobId => waitForJobCompletion(jobId, 35000)));
      const parallelTime = Date.now() - parallelStart;

      // Parallel should be faster than sequential (allowing some overhead)
      expect(parallelTime).toBeLessThan(sequentialTime * 0.8);
      
      console.log(`Sequential: ${sequentialTime}ms, Parallel: ${parallelTime}ms`);
      console.log(`Performance improvement: ${((sequentialTime - parallelTime) / sequentialTime * 100).toFixed(1)}%`);
    }, 120000); // 2 minute timeout for this comprehensive test

    it('should handle high concurrency without significant degradation', async () => {
      const concurrentJobs = 10;
      const startTime = Date.now();
      
      const jobPromises = [];
      for (let i = 0; i < concurrentJobs; i++) {
        jobPromises.push(
          symbolDetectionService.processDocument(
            `concurrent-doc-${i}`,
            `concurrent-session-${i}`,
            mockPdfBuffers.small,
            { processingTimeout: 30000 }
          )
        );
      }

      const jobIds = await Promise.all(jobPromises);
      const results = await Promise.all(
        jobIds.map(jobId => waitForJobCompletion(jobId, 35000))
      );

      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / concurrentJobs;

      // Each job should still complete within reasonable time
      expect(averageTime).toBeLessThan(30000);
      
      // Verify all results are valid
      for (const result of results) {
        expect(result).toBeDefined();
        expect(result?.processingTimeMs).toBeGreaterThan(0);
        expect(result?.processingTimeMs).toBeLessThan(30000);
      }

      console.log(`${concurrentJobs} concurrent jobs: Total ${totalTime}ms, Average ${averageTime.toFixed(0)}ms per job`);
    }, 60000);
  });

  describe('Memory and Resource Usage', () => {
    it('should not cause memory leaks during extended processing', async () => {
      const initialMemory = process.memoryUsage();
      
      // Process multiple documents to test memory usage
      for (let i = 0; i < 5; i++) {
        const jobId = await symbolDetectionService.processDocument(
          `memory-test-${i}`,
          `memory-session-${i}`,
          mockPdfBuffers.medium
        );
        await waitForJobCompletion(jobId, 35000);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    }, 180000); // 3 minute timeout

    it('should handle queue cleanup properly', async () => {
      const initialStats = await symbolDetectionService.getQueueStats();
      
      // Add several jobs
      const jobIds = [];
      for (let i = 0; i < 3; i++) {
        const jobId = await symbolDetectionService.processDocument(
          `cleanup-test-${i}`,
          `cleanup-session-${i}`,
          mockPdfBuffers.small
        );
        jobIds.push(jobId);
      }

      // Wait for completion
      await Promise.all(jobIds.map(jobId => waitForJobCompletion(jobId, 35000)));

      // Check final stats
      const finalStats = await symbolDetectionService.getQueueStats();
      
      // Completed jobs should be tracked
      expect(finalStats.completed).toBeGreaterThanOrEqual(initialStats.completed + 3);
      
      console.log(`Queue stats - Initial: ${JSON.stringify(initialStats)}, Final: ${JSON.stringify(finalStats)}`);
    }, 60000);
  });

  describe('Performance Regression Tests', () => {
    it('should meet minimum throughput requirements', async () => {
      const testCases = [
        { name: 'Low complexity', buffer: mockPdfBuffers.small, expectedMinThroughput: 1 },
        { name: 'Medium complexity', buffer: mockPdfBuffers.medium, expectedMinThroughput: 0.5 },
        { name: 'High complexity', buffer: mockPdfBuffers.large, expectedMinThroughput: 0.2 },
      ];

      for (const testCase of testCases) {
        const result = await runPerformanceBenchmark(
          testCase.name,
          testCase.buffer,
          { processingTimeout: 30000 }
        );

        expect(result.passed).toBe(true);
        expect(result.metrics.throughput).toBeGreaterThanOrEqual(testCase.expectedMinThroughput);
        
        console.log(`${testCase.name}: ${result.metrics.throughput.toFixed(2)} symbols/sec`);
      }
    }, 120000);

    it('should provide consistent performance across runs', async () => {
      const runs = 3;
      const results = [];

      for (let i = 0; i < runs; i++) {
        const result = await runPerformanceBenchmark(
          `Consistency Test Run ${i + 1}`,
          mockPdfBuffers.medium,
          { processingTimeout: 30000 }
        );
        results.push(result.metrics.processingTimeMs);
      }

      // Calculate coefficient of variation (should be < 0.3 for consistent performance)
      const mean = results.reduce((sum, time) => sum + time, 0) / results.length;
      const variance = results.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / results.length;
      const standardDeviation = Math.sqrt(variance);
      const coefficientOfVariation = standardDeviation / mean;

      expect(coefficientOfVariation).toBeLessThan(0.3);
      
      console.log(`Performance consistency: Mean ${mean.toFixed(0)}ms, CV ${(coefficientOfVariation * 100).toFixed(1)}%`);
    }, 120000);
  });

  // Helper function to run performance benchmark
  async function runPerformanceBenchmark(
    testName: string,
    pdfBuffer: Buffer,
    settings: Partial<DetectionSettings> = {}
  ): Promise<BenchmarkResult> {
    const startTime = Date.now();
    
    try {
      const jobId = await symbolDetectionService.processDocument(
        `benchmark-doc-${Date.now()}`,
        `benchmark-session-${Date.now()}`,
        pdfBuffer,
        settings
      );

      const result = await waitForJobCompletion(jobId, (settings.processingTimeout || 30000) + 5000);
      const processingTimeMs = Date.now() - startTime;
      
      if (!result) {
        return {
          testName,
          metrics: { processingTimeMs, symbolsDetected: 0, confidence: 0, throughput: 0 },
          passed: false,
          details: 'Job did not complete',
        };
      }

      const metrics: PerformanceMetrics = {
        processingTimeMs: result.processingTimeMs,
        symbolsDetected: result.detectedSymbols.length,
        confidence: result.overallConfidence,
        throughput: result.detectedSymbols.length / (result.processingTimeMs / 1000),
      };

      const passed = metrics.processingTimeMs < (settings.processingTimeout || 30000);

      return {
        testName,
        metrics,
        passed,
        details: passed ? 'Performance target met' : 'Exceeded processing time limit',
      };

    } catch (error) {
      return {
        testName,
        metrics: { processingTimeMs: Date.now() - startTime, symbolsDetected: 0, confidence: 0, throughput: 0 },
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // Helper function to wait for job completion
  async function waitForJobCompletion(jobId: string, timeoutMs: number) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const jobResult = await symbolDetectionService.getJobStatus(jobId);
      
      if (jobResult?.result) {
        return jobResult.result;
      }
      
      if (jobResult?.error) {
        throw new Error(`Job failed: ${jobResult.error}`);
      }
      
      // Wait 200ms before checking again (less frequent for performance tests)
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
  }
});