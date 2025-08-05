/**
 * Simple Pattern Matcher Tests - Phase 2 Validation
 * 
 * Tests for core Phase 2 advanced pattern matching functionality
 */

import { PatternMatcherSimple, PatternMatchingOptions } from '../pattern-matcher-simple';
import { createCanvas } from 'canvas';

describe('PatternMatcherSimple - Phase 2 Advanced Features', () => {
  let patternMatcher: PatternMatcherSimple;
  let mockImageBuffer: Buffer;

  beforeEach(() => {
    patternMatcher = new PatternMatcherSimple();
    mockImageBuffer = createMockImageBuffer(800, 600);
  });

  describe('Core Advanced Pattern Matching', () => {
    test('should initialize with comprehensive template library', () => {
      const templates = patternMatcher.getAvailableTemplates();
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      
      // Verify key electrical symbol types are available
      const symbolTypes = templates.map((t: any) => t.symbolType);
      expect(symbolTypes).toContain('resistor');
      expect(symbolTypes).toContain('capacitor');
    });

    test('should perform basic pattern matching', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 10,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(options.maxSymbols);
      
      // Verify all results meet confidence threshold
      results.forEach(symbol => {
        expect(symbol.confidence).toBeGreaterThanOrEqual(options.confidenceThreshold);
        expect(symbol.confidence).toBeLessThanOrEqual(1);
        expect(symbol).toHaveProperty('symbolType');
        expect(symbol).toHaveProperty('symbolCategory');
        expect(symbol).toHaveProperty('detectionMethod');
      });
    });

    test('should perform rotation and scale invariant matching', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.4,
        maxSymbols: 15,
        enableRotationInvariance: true,
        enableScaleInvariance: true,
        enableHuMoments: true,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      
      // Should include various matching methods
      const matchingMethods = results.map(s => s.detectionMethod);
      expect(matchingMethods.length).toBeGreaterThan(0);
      
      // All results should meet confidence threshold
      results.forEach(symbol => {
        expect(symbol.confidence).toBeGreaterThanOrEqual(options.confidenceThreshold);
      });
    });

    test('should perform multi-template ensemble matching', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.3,
        maxSymbols: 20,
        enableEnsembleMatching: true,
        enableRotationInvariance: true,
        enableScaleInvariance: true,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      
      // Should include consensus/ensemble results
      const consensusMatches = results.filter(s => s.detectionMethod === 'consensus');
      expect(consensusMatches.length).toBeGreaterThan(0);
      
      // Verify detection methods variety
      const detectionMethods = new Set(results.map(s => s.detectionMethod));
      expect(detectionMethods.size).toBeGreaterThan(1);
    });

    test('should optimize performance with parallel processing', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 25,
        enableRotationInvariance: true,
        enableEnsembleMatching: true,
        parallelProcessing: true,
        batchSize: 5,
      };

      const startTime = Date.now();
      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      const processingTime = Date.now() - startTime;
      
      expect(results).toBeInstanceOf(Array);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(results.length).toBeLessThanOrEqual(options.maxSymbols);
    });

    test('should meet 30-second processing requirement', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.4,
        maxSymbols: 50,
        maxProcessingTime: 30000, // 30 seconds
        enableRotationInvariance: true,
        enableScaleInvariance: true,
        enableEnsembleMatching: true,
        enableHuMoments: true,
        parallelProcessing: true,
        adaptiveFiltering: true,
        earlyTermination: true,
        memoryOptimization: true,
      };

      const startTime = Date.now();
      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      const processingTime = Date.now() - startTime;
      
      expect(processingTime).toBeLessThan(30000); // Must complete within 30 seconds
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      
      console.log(`Advanced processing completed in ${processingTime}ms with ${results.length} symbols`);
    });

    test('should handle early termination optimization', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.3,
        maxSymbols: 5, // Small limit to trigger early termination
        earlyTermination: true,
        enableRotationInvariance: true,
        enableEnsembleMatching: true,
      };

      const startTime = Date.now();
      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      const processingTime = Date.now() - startTime;
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeLessThanOrEqual(options.maxSymbols);
      expect(processingTime).toBeLessThan(3000); // Should be fast due to early termination
    });

    test('should handle processing timeout gracefully', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.2,
        maxSymbols: 100,
        maxProcessingTime: 1000, // Very short timeout
        enableRotationInvariance: true,
        enableEnsembleMatching: true,
      };

      const startTime = Date.now();
      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      const processingTime = Date.now() - startTime;
      
      expect(processingTime).toBeLessThan(3000); // Should respect timeout
      expect(results).toBeInstanceOf(Array);
    });

    test('should provide comprehensive detection results', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.4,
        maxSymbols: 15,
        enableRotationInvariance: true,
        enableEnsembleMatching: true,
        enableHuMoments: true,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      expect(results.length).toBeGreaterThan(0);
      
      // Verify comprehensive result structure
      results.forEach(symbol => {
        expect(symbol).toHaveProperty('id');
        expect(symbol).toHaveProperty('symbolType');
        expect(symbol).toHaveProperty('symbolCategory');
        expect(symbol).toHaveProperty('confidence');
        expect(symbol).toHaveProperty('location');
        expect(symbol).toHaveProperty('boundingBox');
        expect(symbol).toHaveProperty('detectionMethod');
        expect(symbol).toHaveProperty('features');
        
        // Verify features structure
        expect(symbol.features).toHaveProperty('contourPoints');
        expect(symbol.features).toHaveProperty('geometricProperties');
        expect(symbol.features).toHaveProperty('shapeAnalysis');
        
        // Verify bounding box
        expect(symbol.boundingBox).toHaveProperty('x');
        expect(symbol.boundingBox).toHaveProperty('y');
        expect(symbol.boundingBox).toHaveProperty('width');
        expect(symbol.boundingBox).toHaveProperty('height');
        expect(symbol.boundingBox).toHaveProperty('area');
      });
    });

    test('should handle various symbol categories', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.3,
        maxSymbols: 30,
        enableRotationInvariance: true,
        enableEnsembleMatching: true,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should detect various symbol categories
      const categories = new Set(results.map(s => s.symbolCategory));
      expect(categories.size).toBeGreaterThan(0);
      
      // Verify valid categories
      const validCategories = ['passive', 'active', 'connector', 'power', 'protection', 'logic', 'custom'];
      results.forEach(symbol => {
        expect(validCategories).toContain(symbol.symbolCategory);
      });
    });
  });

  describe('Performance and Quality Validation', () => {
    test('should maintain high confidence averages', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.6, // High threshold
        maxSymbols: 20,
        enableRotationInvariance: true,
        enableEnsembleMatching: true,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      if (results.length > 0) {
        const avgConfidence = results.reduce((sum, s) => sum + s.confidence, 0) / results.length;
        expect(avgConfidence).toBeGreaterThan(0.65); // Should maintain high average
      }
    });

    test('should provide consistent results across multiple runs', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 10,
        enableRotationInvariance: true,
      };

      const results1 = await patternMatcher.detectSymbols(mockImageBuffer, options);
      const results2 = await patternMatcher.detectSymbols(mockImageBuffer, options);

      // Results should be reasonably consistent
      expect(results1.length).toBeGreaterThan(0);
      expect(results2.length).toBeGreaterThan(0);
      
      // Should have some overlap in symbol types detected
      const types1 = new Set(results1.map(s => s.symbolType));
      const types2 = new Set(results2.map(s => s.symbolType));
      const intersection = new Set([...types1].filter(x => types2.has(x)));
      
      if (types1.size > 0 && types2.size > 0) {
        expect(intersection.size).toBeGreaterThan(0);
      }
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
  
  // Draw mock electrical symbols
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 2;
  
  // Mock resistor (zigzag pattern)
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
  
  // Mock capacitor (parallel lines)
  ctx.beginPath();
  ctx.moveTo(300, 80);
  ctx.lineTo(300, 120);
  ctx.moveTo(320, 80);
  ctx.lineTo(320, 120);
  ctx.moveTo(250, 100);
  ctx.lineTo(300, 100);
  ctx.moveTo(320, 100);
  ctx.lineTo(370, 100);
  ctx.stroke();
  
  // Mock inductor (spiral/coil)
  ctx.beginPath();
  ctx.moveTo(400, 100);
  ctx.lineTo(420, 100);
  ctx.arc(430, 100, 10, Math.PI, 0, false);
  ctx.arc(450, 100, 10, Math.PI, 0, false);
  ctx.arc(470, 100, 10, Math.PI, 0, false);
  ctx.lineTo(490, 100);
  ctx.stroke();
  
  // Mock ground symbol
  ctx.beginPath();
  ctx.moveTo(550, 80);
  ctx.lineTo(550, 120);
  ctx.moveTo(540, 120);
  ctx.lineTo(560, 120);
  ctx.moveTo(545, 125);
  ctx.lineTo(555, 125);
  ctx.moveTo(548, 130);
  ctx.lineTo(552, 130);
  ctx.stroke();
  
  return canvas.toBuffer('image/png');
}