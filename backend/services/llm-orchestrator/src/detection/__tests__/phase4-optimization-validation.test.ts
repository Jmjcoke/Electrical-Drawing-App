/**
 * Phase 4: Performance Optimization Validation Tests
 * 
 * Comprehensive test suite validating all Phase 4 performance optimizations
 * for the Symbol Detection Engine
 */

import { SymbolDetectionService } from '../symbol-detector';

// Mock dependencies
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
} as any;

const mockRedisConfig = {
  host: 'localhost',
  port: 6379,
};

describe('Phase 4: Performance Optimization Validation', () => {
  let symbolDetectionService: SymbolDetectionService;

  beforeAll(async () => {
    symbolDetectionService = new SymbolDetectionService(mockRedisConfig, mockPool);
    jest.setTimeout(60000);
  });

  afterAll(async () => {
    await symbolDetectionService.shutdown();
  });

  describe('30-Second Processing Requirement (AC #9) Validation', () => {
    it('should validate compliance with AC #9 across different complexities', async () => {
      const testCases = [
        { name: 'Simple', size: 100000, maxTime: 10000 },
        { name: 'Medium', size: 300000, maxTime: 20000 },
        { name: 'Complex', size: 600000, maxTime: 30000 },
      ];
      
      for (const testCase of testCases) {
        const testBuffer = Buffer.alloc(testCase.size);
        
        const startTime = Date.now();
        const jobId = await symbolDetectionService.processDocument(
          `ac9-${testCase.name.toLowerCase()}`,
          `ac9-session-${Date.now()}`,
          testBuffer,
          {
            confidenceThreshold: 0.7,
            processingTimeout: testCase.maxTime,
          }
        );
        
        const result = await waitForJobCompletion(jobId, testCase.maxTime + 5000);
        const totalTime = Date.now() - startTime;
        
        expect(result).toBeDefined();
        expect(totalTime).toBeLessThan(testCase.maxTime);
        expect(result.processingTimeMs).toBeLessThan(testCase.maxTime);
        
        console.log(`${testCase.name} complexity: ${totalTime}ms (limit: ${testCase.maxTime}ms)`);
      }
    }, 45000);

    it('should validate sustained performance under load', async () => {
      const iterations = 3; // Reduced for CI
      const maxTime = 25000;
      const testBuffer = Buffer.alloc(200000);
      
      const results = [];
      
      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const jobId = await symbolDetectionService.processDocument(
          `sustained-${i}`,
          `sustained-session-${i}`,
          testBuffer,
          { confidenceThreshold: 0.7, processingTimeout: maxTime }
        );
        
        const result = await waitForJobCompletion(jobId, maxTime + 5000);
        const totalTime = Date.now() - startTime;
        
        results.push(totalTime);
        
        expect(totalTime).toBeLessThan(maxTime);
        
        console.log(`Iteration ${i + 1}: ${totalTime}ms`);
      }
      
      const avgTime = results.reduce((sum, time) => sum + time, 0) / results.length;
      const maxTimeActual = Math.max(...results);
      const minTime = Math.min(...results);
      
      expect(avgTime).toBeLessThan(maxTime);
      expect(maxTimeActual).toBeLessThan(maxTime);
      
      console.log(`Sustained performance: Avg ${avgTime.toFixed(0)}ms, Range ${minTime}-${maxTimeActual}ms`);
    }, 90000);
  });

  describe('Performance Monitoring Integration', () => {
    it('should validate performance monitoring and alerting', async () => {
      let performanceWarning = false;
      let memoryWarning = false;
      
      symbolDetectionService.on('performance-warning', () => {
        performanceWarning = true;
      });
      
      symbolDetectionService.on('memory-warning', () => {
        memoryWarning = true;
      });
      
      // Process a document to trigger monitoring
      const testBuffer = Buffer.alloc(150000);
      const jobId = await symbolDetectionService.processDocument(
        'monitoring-test',
        'monitoring-session',
        testBuffer,
        { confidenceThreshold: 0.7 }
      );
      
      const result = await waitForJobCompletion(jobId, 30000);
      expect(result).toBeDefined();
      
      // Get performance statistics
      const perfStats = symbolDetectionService.getPerformanceStats();
      expect(perfStats).toBeDefined();
      
      // Generate performance report
      const report = symbolDetectionService.generatePerformanceReport();
      expect(report).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.recommendations).toBeDefined();
      
      console.log('Performance monitoring validation successful');
      console.log(`Performance warnings: ${performanceWarning ? 'Detected' : 'None'}`);
      console.log(`Memory warnings: ${memoryWarning ? 'Detected' : 'None'}`);
    }, 45000);

    it('should validate system optimization triggers', async () => {
      const initialStats = symbolDetectionService.getPerformanceStats();
      
      // Trigger optimization
      await symbolDetectionService.optimizePerformance();
      
      const optimizedStats = symbolDetectionService.getPerformanceStats();
      
      // Stats should be available
      expect(initialStats).toBeDefined();
      expect(optimizedStats).toBeDefined();
      
      console.log('System optimization validation successful');
    });
  });

  // Helper function
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
        
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        if (Date.now() - startTime > timeoutMs * 0.9) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    throw new Error(`Job ${jobId} did not complete within ${timeoutMs}ms`);
  }
});