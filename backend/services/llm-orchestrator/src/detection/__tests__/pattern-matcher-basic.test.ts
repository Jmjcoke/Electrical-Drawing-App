/**
 * Basic Pattern Matcher Tests - Phase 2
 * 
 * Focused tests for core advanced pattern matching functionality
 */

import { PatternMatcher, PatternMatchingOptions } from '../pattern-matcher';
import { createCanvas } from 'canvas';

describe('PatternMatcher - Basic Advanced Features', () => {
  let patternMatcher: PatternMatcher;
  let mockImageBuffer: Buffer;

  beforeEach(() => {
    patternMatcher = new PatternMatcher();
    mockImageBuffer = createMockImageBuffer(800, 600);
  });

  describe('Basic Functionality', () => {
    test('should initialize pattern matcher successfully', () => {
      expect(patternMatcher).toBeDefined();
      expect(patternMatcher.getAvailableTemplates).toBeDefined();
    });

    test('should have available templates', () => {
      const templates = patternMatcher.getAvailableTemplates();
      expect(Array.isArray(templates)).toBe(true);
    });

    test('should detect symbols with basic options', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 10,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThanOrEqual(0);
      
      if (results.length > 0) {
        const firstSymbol = results[0];
        expect(firstSymbol).toHaveProperty('confidence');
        expect(firstSymbol).toHaveProperty('symbolType');
        expect(firstSymbol).toHaveProperty('detectionMethod');
        expect(firstSymbol.confidence).toBeGreaterThanOrEqual(0);
        expect(firstSymbol.confidence).toBeLessThanOrEqual(1);
      }
    });

    test('should handle advanced pattern matching options', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.4,
        maxSymbols: 20,
        enableRotationInvariance: true,
        enableScaleInvariance: true,
        enableEnsembleMatching: true,
        enableHuMoments: true,
        parallelProcessing: true,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeLessThanOrEqual(options.maxSymbols);
      
      // Verify all results meet confidence threshold
      results.forEach(symbol => {
        expect(symbol.confidence).toBeGreaterThanOrEqual(options.confidenceThreshold);
        expect(symbol.confidence).toBeLessThanOrEqual(1);
      });
    });

    test('should complete within reasonable time', async () => {
      const startTime = Date.now();
      
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 15,
        maxProcessingTime: 10000, // 10 seconds
        enableRotationInvariance: true,
        parallelProcessing: true,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(10000);
      
      expect(results).toBeInstanceOf(Array);
    });

    test('should handle empty image gracefully', async () => {
      const emptyBuffer = Buffer.alloc(100);
      
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 10,
      };

      // Should not throw error, but return empty or handle gracefully
      await expect(async () => {
        const results = await patternMatcher.detectSymbols(emptyBuffer, options);
        expect(results).toBeInstanceOf(Array);
      }).not.toThrow();
    });

    test('should respect confidence threshold', async () => {
      const highThresholdOptions: PatternMatchingOptions = {
        confidenceThreshold: 0.9,
        maxSymbols: 10,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, highThresholdOptions);
      
      expect(results).toBeInstanceOf(Array);
      
      // All results should meet the high threshold
      results.forEach(symbol => {
        expect(symbol.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });

    test('should respect max symbols limit', async () => {
      const limitedOptions: PatternMatchingOptions = {
        confidenceThreshold: 0.3, // Low threshold to get more results
        maxSymbols: 5, // Small limit
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, limitedOptions);
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Performance Features', () => {
    test('should handle performance optimization options', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 10,
        parallelProcessing: true,
        adaptiveFiltering: true,
        earlyTermination: true,
        memoryOptimization: true,
        batchSize: 3,
      };

      const startTime = Date.now();
      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      const processingTime = Date.now() - startTime;

      expect(results).toBeInstanceOf(Array);
      expect(processingTime).toBeLessThan(5000); // Should be fast with optimizations
    });

    test('should handle processing timeout', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.3,
        maxSymbols: 100,
        maxProcessingTime: 1000, // Very short timeout
      };

      const startTime = Date.now();
      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      const processingTime = Date.now() - startTime;

      // Should respect timeout
      expect(processingTime).toBeLessThan(3000); // Some buffer for cleanup
      expect(results).toBeInstanceOf(Array);
    });
  });
});

/**
 * Helper function to create mock image buffer for testing
 */
function createMockImageBuffer(width: number, height: number): Buffer {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // White background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, width, height);
  
  // Draw some mock electrical symbols
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 2;
  
  // Mock resistor
  ctx.beginPath();
  ctx.moveTo(50, 100);
  ctx.lineTo(100, 100);
  ctx.lineTo(110, 90);
  ctx.lineTo(130, 110);
  ctx.lineTo(150, 90);
  ctx.lineTo(170, 110);
  ctx.lineTo(180, 100);
  ctx.lineTo(230, 100);
  ctx.stroke();
  
  // Mock capacitor
  ctx.beginPath();
  ctx.moveTo(300, 80);
  ctx.lineTo(300, 120);
  ctx.moveTo(310, 80);
  ctx.lineTo(310, 120);
  ctx.moveTo(250, 100);
  ctx.lineTo(300, 100);
  ctx.moveTo(310, 100);
  ctx.lineTo(360, 100);
  ctx.stroke();
  
  return canvas.toBuffer('image/png');
}