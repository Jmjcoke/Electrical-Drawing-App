/**
 * Performance Validation Tests for AC #9: 30-Second Processing Requirement
 * 
 * Comprehensive validation of the Symbol Detection Engine's performance optimizations
 * to ensure compliance with the 30-second processing time requirement
 */

import { SymbolDetectionService } from '../symbol-detector';
import { SymbolDetectionPerformanceMonitor } from '../monitoring/symbol-detection-performance.monitor';
import { DetectionSettings } from '../../../../../shared/types/symbol-detection.types';
import { Pool } from 'pg';

// Mock database pool
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
} as unknown as Pool;

// Mock Redis configuration
const mockRedisConfig = {
  host: 'localhost',
  port: 6379,
};

interface PerformanceTestCase {
  name: string;
  description: string;
  bufferSize: number; // Size of mock PDF buffer
  expectedComplexity: 'low' | 'medium' | 'high' | 'extreme';
  maxAllowedTime: number; // Maximum allowed processing time in ms
  minSymbolsExpected: number;
  minAccuracy: number;
}

const PERFORMANCE_TEST_CASES: PerformanceTestCase[] = [
  {
    name: 'Small Simple Diagram',
    description: 'Simple electrical circuit with 5-10 basic symbols',
    bufferSize: 50000, // 50KB
    expectedComplexity: 'low',
    maxAllowedTime: 5000, // 5 seconds
    minSymbolsExpected: 3,
    minAccuracy: 0.9,
  },
  {
    name: 'Medium Complex Circuit',
    description: 'Moderate complexity circuit with 15-25 symbols',
    bufferSize: 200000, // 200KB
    expectedComplexity: 'medium',
    maxAllowedTime: 15000, // 15 seconds
    minSymbolsExpected: 8,
    minAccuracy: 0.85,
  },
  {
    name: 'Large Industrial Schematic',
    description: 'Complex industrial schematic with 30-50 symbols',
    bufferSize: 500000, // 500KB
    expectedComplexity: 'high',
    maxAllowedTime: 25000, // 25 seconds
    minSymbolsExpected: 15,
    minAccuracy: 0.8,
  },
  {
    name: 'Maximum Complexity Test',
    description: 'Extremely complex multi-page schematic with 50+ symbols',
    bufferSize: 1000000, // 1MB
    expectedComplexity: 'extreme',
    maxAllowedTime: 30000, // 30 seconds (AC #9 limit)
    minSymbolsExpected: 25,
    minAccuracy: 0.75,
  },
];

describe('Performance Validation: AC #9 - 30-Second Processing Requirement', () => {
  let symbolDetectionService: SymbolDetectionService;
  let performanceMonitor: SymbolDetectionPerformanceMonitor;

  beforeAll(async () => {
    symbolDetectionService = new SymbolDetectionService(mockRedisConfig, mockPool);
    performanceMonitor = new SymbolDetectionPerformanceMonitor();
    
    // Warm up the system
    await warmUpSystem();
  });

  afterAll(async () => {
    await symbolDetectionService.shutdown();
    await performanceMonitor.performComprehensiveCleanup();
  });

  describe('AC #9 Compliance Tests', () => {
    test.each(PERFORMANCE_TEST_CASES)(
      'should process $name within $maxAllowedTime ms',
      async (testCase) => {
        const { name, description, bufferSize, maxAllowedTime, minSymbolsExpected, minAccuracy } = testCase;
        
        console.log(`\nTesting: ${name}`);
        console.log(`Description: ${description}`);
        console.log(`Expected max time: ${maxAllowedTime}ms`);
        
        // Create mock PDF buffer
        const mockPdfBuffer = createMockPdfBuffer(bufferSize, testCase.expectedComplexity);
        
        // Configure settings for optimal performance
        const optimizedSettings: Partial<DetectionSettings> = {
          confidenceThreshold: 0.7,
          maxSymbolsPerPage: testCase.expectedComplexity === 'extreme' ? 200 : 100,
          enableMLClassification: true,
          enablePatternMatching: true,
          enableLLMValidation: false, // Disable for performance
          processingTimeout: maxAllowedTime,
        };
        
        const startTime = Date.now();
        
        // Process the document
        const jobId = await symbolDetectionService.processDocument(
          `perf-test-${Date.now()}`,
          `perf-session-${Date.now()}`,
          mockPdfBuffer,
          optimizedSettings
        );
        
        // Wait for completion
        const result = await waitForJobCompletion(jobId, maxAllowedTime + 5000);
        const totalTime = Date.now() - startTime;
        
        // Validate performance requirements
        expect(result).toBeDefined();
        expect(totalTime).toBeLessThan(maxAllowedTime);
        
        // Validate result quality
        expect(result.detectedSymbols.length).toBeGreaterThanOrEqual(minSymbolsExpected);
        expect(result.overallConfidence).toBeGreaterThanOrEqual(minAccuracy);
        expect(result.processingTimeMs).toBeLessThan(maxAllowedTime);
        
        // Log performance metrics
        console.log(`✓ Completed in ${totalTime}ms (limit: ${maxAllowedTime}ms)`);
        console.log(`✓ Found ${result.detectedSymbols.length} symbols (min: ${minSymbolsExpected})`);
        console.log(`✓ Accuracy: ${(result.overallConfidence * 100).toFixed(1)}% (min: ${(minAccuracy * 100).toFixed(1)}%)`);
        
        // Track performance
        performanceMonitor.trackProcessing(
          `perf-test-${Date.now()}`,
          `perf-session-${Date.now()}`,
          result.detectionMetadata,
          result
        );
      },
      45000 // 45 second test timeout
    );
  });

  describe('Performance Optimization Validation', () => {
    it('should demonstrate performance improvement with optimizations enabled', async () => {
      const testBuffer = createMockPdfBuffer(300000, 'medium');
      
      // Test without optimizations
      const basicSettings: Partial<DetectionSettings> = {
        confidenceThreshold: 0.5,
        maxSymbolsPerPage: 50,
        enableMLClassification: true,
        enablePatternMatching: true,
        processingTimeout: 30000,
      };
      
      const basicStartTime = Date.now();
      const basicJobId = await symbolDetectionService.processDocument(
        'basic-test',
        'basic-session',
        testBuffer,
        basicSettings
      );
      const basicResult = await waitForJobCompletion(basicJobId, 35000);
      const basicTime = Date.now() - basicStartTime;
      
      // Test with optimizations
      const optimizedSettings: Partial<DetectionSettings> = {
        confidenceThreshold: 0.7, // Higher threshold for faster processing
        maxSymbolsPerPage: 100,
        enableMLClassification: true,
        enablePatternMatching: true,
        processingTimeout: 25000, // More aggressive timeout
      };
      
      const optimizedStartTime = Date.now();
      const optimizedJobId = await symbolDetectionService.processDocument(
        'optimized-test',
        'optimized-session',
        testBuffer,
        optimizedSettings
      );
      const optimizedResult = await waitForJobCompletion(optimizedJobId, 30000);
      const optimizedTime = Date.now() - optimizedStartTime;
      
      // Validate that optimizations provide improvement
      expect(optimizedTime).toBeLessThanOrEqual(basicTime);
      expect(optimizedResult.detectedSymbols.length).toBeGreaterThanOrEqual(basicResult.detectedSymbols.length * 0.8);
      
      console.log(`Basic processing: ${basicTime}ms`);
      console.log(`Optimized processing: ${optimizedTime}ms`);
      console.log(`Performance improvement: ${((basicTime - optimizedTime) / basicTime * 100).toFixed(1)}%`);
    }, 120000);

    it('should maintain performance under concurrent load', async () => {
      const concurrentJobs = 5;
      const testBuffer = createMockPdfBuffer(150000, 'medium');
      
      const settings: Partial<DetectionSettings> = {
        confidenceThreshold: 0.7,
        maxSymbolsPerPage: 75,
        processingTimeout: 25000,
      };
      
      const startTime = Date.now();
      
      // Launch concurrent jobs
      const jobPromises = Array.from({ length: concurrentJobs }, (_, i) =>
        symbolDetectionService.processDocument(
          `concurrent-test-${i}`,
          `concurrent-session-${i}`,
          testBuffer,
          settings
        )
      );
      
      const jobIds = await Promise.all(jobPromises);
      
      // Wait for all jobs to complete
      const resultPromises = jobIds.map(jobId => 
        waitForJobCompletion(jobId, 35000)
      );
      
      const results = await Promise.all(resultPromises);
      const totalTime = Date.now() - startTime;
      
      // Validate concurrent performance
      expect(results).toHaveLength(concurrentJobs);
      
      // Each job should complete within reasonable time
      for (const result of results) {
        expect(result).toBeDefined();
        expect(result.processingTimeMs).toBeLessThan(30000);
        expect(result.detectedSymbols.length).toBeGreaterThan(0);
      }
      
      // Average time per job should be reasonable
      const avgTimePerJob = totalTime / concurrentJobs;
      expect(avgTimePerJob).toBeLessThan(35000);
      
      console.log(`Concurrent processing: ${concurrentJobs} jobs in ${totalTime}ms`);
      console.log(`Average time per job: ${avgTimePerJob.toFixed(0)}ms`);
    }, 180000);
  });

  describe('Memory and Resource Management', () => {
    it('should maintain stable memory usage during extended processing', async () => {
      const initialMemory = process.memoryUsage();
      const iterations = 10;
      const testBuffer = createMockPdfBuffer(100000, 'low');
      
      const settings: Partial<DetectionSettings> = {
        confidenceThreshold: 0.75,
        processingTimeout: 20000,
      };
      
      console.log(`Initial memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      
      // Process multiple documents sequentially
      for (let i = 0; i < iterations; i++) {
        const jobId = await symbolDetectionService.processDocument(
          `memory-test-${i}`,
          `memory-session-${i}`,
          testBuffer,
          settings
        );
        
        const result = await waitForJobCompletion(jobId, 25000);
        expect(result).toBeDefined();
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Log memory usage every few iterations
        if (i % 3 === 0) {
          const currentMemory = process.memoryUsage();
          console.log(`Iteration ${i}: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        }
      }
      
      // Trigger system optimization
      await symbolDetectionService.optimizePerformance();
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;
      
      console.log(`Final memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB`);
      
      // Memory increase should be reasonable (less than 200MB)
      expect(memoryIncreaseMB).toBeLessThan(200);
    }, 300000);
  });

  describe('Performance Regression Prevention', () => {
    it('should not regress below baseline performance metrics', async () => {
      const testBuffer = createMockPdfBuffer(200000, 'medium');
      
      // Baseline performance expectations
      const baselineExpectations = {
        maxProcessingTime: 20000, // 20 seconds
        minThroughput: 0.5, // symbols per second
        minAccuracy: 0.8, // 80%
        maxMemoryIncrease: 100, // 100MB
      };
      
      const initialMemory = process.memoryUsage().heapUsed;
      const startTime = Date.now();
      
      const jobId = await symbolDetectionService.processDocument(
        'baseline-test',
        'baseline-session',
        testBuffer,
        {
          confidenceThreshold: 0.7,
          processingTimeout: baselineExpectations.maxProcessingTime,
        }
      );
      
      const result = await waitForJobCompletion(jobId, baselineExpectations.maxProcessingTime + 5000);
      const totalTime = Date.now() - startTime;
      const finalMemory = process.memoryUsage().heapUsed;
      
      // Calculate metrics
      const throughput = result.detectedSymbols.length / (totalTime / 1000);
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
      
      // Validate against baseline
      expect(totalTime).toBeLessThan(baselineExpectations.maxProcessingTime);
      expect(throughput).toBeGreaterThanOrEqual(baselineExpectations.minThroughput);
      expect(result.overallConfidence).toBeGreaterThanOrEqual(baselineExpectations.minAccuracy);
      expect(memoryIncrease).toBeLessThan(baselineExpectations.maxMemoryIncrease);
      
      // Log metrics for regression tracking
      console.log('Baseline Performance Metrics:');
      console.log(`  Processing Time: ${totalTime}ms (limit: ${baselineExpectations.maxProcessingTime}ms)`);
      console.log(`  Throughput: ${throughput.toFixed(2)} symbols/sec (min: ${baselineExpectations.minThroughput})`);
      console.log(`  Accuracy: ${(result.overallConfidence * 100).toFixed(1)}% (min: ${baselineExpectations.minAccuracy * 100}%)`);
      console.log(`  Memory Increase: ${memoryIncrease.toFixed(2)}MB (max: ${baselineExpectations.maxMemoryIncrease}MB)`);
    }, 60000);
  });

  // Helper functions
  async function warmUpSystem(): Promise<void> {
    console.log('Warming up Symbol Detection Engine...');
    
    const warmupBuffer = createMockPdfBuffer(50000, 'low');
    
    try {
      const jobId = await symbolDetectionService.processDocument(
        'warmup-test',
        'warmup-session',
        warmupBuffer,
        { confidenceThreshold: 0.8, processingTimeout: 15000 }
      );
      
      await waitForJobCompletion(jobId, 20000);
      console.log('System warm-up completed');
    } catch (error) {
      console.warn('System warm-up failed, continuing with tests:', error);
    }
  }

  function createMockPdfBuffer(size: number, complexity: 'low' | 'medium' | 'high' | 'extreme'): Buffer {
    // Create a buffer that simulates different PDF complexities
    const buffer = Buffer.alloc(size);
    
    // Fill with mock PDF content based on complexity
    const patterns = {
      low: [0x25, 0x50, 0x44, 0x46], // %PDF
      medium: [0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34], // %PDF-1.4
      high: [0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37], // %PDF-1.7
      extreme: [0x25, 0x50, 0x44, 0x46, 0x2D, 0x32, 0x2E, 0x30], // %PDF-2.0
    };
    
    const pattern = patterns[complexity];
    
    // Fill buffer with repeating pattern
    for (let i = 0; i < size; i++) {
      buffer[i] = pattern[i % pattern.length];
    }
    
    return buffer;
  }

  async function waitForJobCompletion(jobId: string, timeoutMs: number) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const jobResult = await symbolDetectionService.getJobStatus(jobId);
        
        if (jobResult?.result) {
          return jobResult.result;
        }
        
        if (jobResult?.error) {
          throw new Error(`Job failed: ${jobResult.error}`);
        }
        
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        if (Date.now() - startTime > timeoutMs * 0.9) {
          throw error;
        }
        // Continue waiting for transient errors
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
  }
});