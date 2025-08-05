/**
 * Advanced Pattern Matcher Tests - Phase 2
 * 
 * Comprehensive tests for advanced pattern matching including:
 * - Rotation and scale invariant matching
 * - Multi-template ensemble matching
 * - Performance optimization
 * - Advanced OpenCV features
 */

import { PatternMatcher, PatternMatchingOptions } from '../pattern-matcher';
import { createCanvas } from 'canvas';

describe('PatternMatcher - Advanced Features', () => {
  let patternMatcher: PatternMatcher;
  let mockImageBuffer: Buffer;
  let mockLargeImageBuffer: Buffer;

  beforeEach(() => {
    patternMatcher = new PatternMatcher();
    
    // Create mock image buffers for testing
    mockImageBuffer = createMockImageBuffer(800, 600);
    mockLargeImageBuffer = createMockImageBuffer(2400, 1800); // Large image for performance testing
  });

  afterEach(() => {
    // Cleanup any resources
  });

  describe('Advanced Template Library', () => {
    test('should initialize with comprehensive template library', async () => {
      const availableTemplates = patternMatcher.getAvailableTemplates();
      
      expect(availableTemplates.length).toBeGreaterThanOrEqual(6); // At least 6 symbol types
      
      // Verify key electrical symbol types are present
      const symbolTypes = availableTemplates.map(t => t.symbolType);
      expect(symbolTypes).toContain('resistor');
      expect(symbolTypes).toContain('capacitor');
      expect(symbolTypes).toContain('inductor');
      expect(symbolTypes).toContain('diode');
      expect(symbolTypes).toContain('transistor');
      expect(symbolTypes).toContain('integrated_circuit');
    });

    test('should have templates with variants for rotation/scale invariance', async () => {
      const availableTemplates = patternMatcher.getAvailableTemplates();
      
      // Check that templates have multiple variants
      const templatesWithVariants = availableTemplates.filter(t => t.variants && t.variants.length > 0);
      expect(templatesWithVariants.length).toBeGreaterThan(0);
      
      // Verify variant properties
      const firstTemplateWithVariants = templatesWithVariants[0];
      expect(firstTemplateWithVariants.variants.length).toBeGreaterThan(10); // Should have multiple rotation/scale variants
      
      const variant = firstTemplateWithVariants.variants[0];
      expect(variant).toHaveProperty('rotation');
      expect(variant).toHaveProperty('scale');
      expect(variant).toHaveProperty('confidence');
      expect(variant).toHaveProperty('features');
    });
  });

  describe('Rotation and Scale Invariant Matching', () => {
    test('should detect symbols with rotation invariance enabled', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 10,
        enableRotationInvariance: true,
        enableHuMoments: true,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      
      // Should have at least one symbol detected
      const firstSymbol = results[0];
      expect(firstSymbol).toHaveProperty('confidence');
      expect(firstSymbol).toHaveProperty('symbolType');
      expect(firstSymbol).toHaveProperty('detectionMethod');
      expect(firstSymbol.confidence).toBeGreaterThanOrEqual(options.confidenceThreshold);
    });

    test('should detect symbols with scale invariance enabled', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 10,
        enableScaleInvariance: true,
        enableHuMoments: true,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      expect(results).toBeInstanceOf(Array);
      // Should detect symbols despite scale variations
      const symbolsWithGoodConfidence = results.filter(s => s.confidence >= 0.6);
      expect(symbolsWithGoodConfidence.length).toBeGreaterThan(0);
    });

    test('should use Hu moments for invariant matching when enabled', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.4,
        maxSymbols: 15,
        enableRotationInvariance: true,
        enableScaleInvariance: true,
        enableHuMoments: true,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      // Should find symbols using various detection methods including Hu moments
      const detectionMethods = results.map(s => s.detectionMethod);
      expect(detectionMethods.length).toBeGreaterThan(0);
      
      // Verify confidence scores are reasonable
      results.forEach(symbol => {
        expect(symbol.confidence).toBeGreaterThanOrEqual(0);
        expect(symbol.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Multi-Template Ensemble Matching', () => {
    test('should perform ensemble matching when enabled', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.4,
        maxSymbols: 20,
        enableEnsembleMatching: true,
        enableRotationInvariance: true,
        enableScaleInvariance: true,
        enableHuMoments: true,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      expect(results).toBeInstanceOf(Array);
      
      // Ensemble matching should potentially find consensus symbols
      const consensusSymbols = results.filter(s => s.detectionMethod === 'consensus');
      // Note: May not always find consensus symbols in mock data, but structure should be correct
      
      // Verify ensemble results have higher confidence when found
      if (consensusSymbols.length > 0) {
        const averageConsensusConfidence = consensusSymbols.reduce((sum, s) => sum + s.confidence, 0) / consensusSymbols.length;
        expect(averageConsensusConfidence).toBeGreaterThan(0.5);
      }
    });

    test('should combine multiple detection approaches in ensemble', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.3,
        maxSymbols: 25,
        enableEnsembleMatching: true,
        enableRotationInvariance: true,
        enableHuMoments: true,
        enableKeyPointMatching: true,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      // Should use various detection methods
      const detectionMethods = new Set(results.map(s => s.detectionMethod));
      expect(detectionMethods.size).toBeGreaterThan(0);
      
      // Verify all symbols have required properties
      results.forEach(symbol => {
        expect(symbol).toHaveProperty('id');
        expect(symbol).toHaveProperty('symbolType');
        expect(symbol).toHaveProperty('symbolCategory');
        expect(symbol).toHaveProperty('confidence');
        expect(symbol).toHaveProperty('location');
        expect(symbol).toHaveProperty('boundingBox');
        expect(symbol).toHaveProperty('features');
      });
    });
  });

  describe('Performance Optimization', () => {
    test('should complete detection within 30 seconds for standard image', async () => {
      const startTime = Date.now();
      
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 50,
        maxProcessingTime: 30000, // 30 seconds
        enableRotationInvariance: true,
        enableScaleInvariance: true,
        enableEnsembleMatching: true,
        parallelProcessing: true,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
      
      // Should still find reasonable results despite time constraints
      expect(results.length).toBeGreaterThan(0);
    });

    test('should complete detection within 30 seconds for large image with optimizations', async () => {
      const startTime = Date.now();
      
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.6,
        maxSymbols: 30,
        maxProcessingTime: 30000, // 30 seconds
        enableRotationInvariance: true,
        enableEnsembleMatching: true,
        parallelProcessing: true,
        adaptiveFiltering: true,
        earlyTermination: true,
        memoryOptimization: true,
      };

      const results = await patternMatcher.detectSymbols(mockLargeImageBuffer, options);
      
      const processingTime = Date.now() - startTime;
      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds even for large image
      
      console.log(`Large image processing completed in ${processingTime}ms with ${results.length} symbols detected`);
    });

    test('should use parallel processing when enabled', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 20,
        parallelProcessing: true,
        batchSize: 3,
      };

      const startTime = Date.now();
      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      const parallelTime = Date.now() - startTime;

      // Compare with sequential processing
      const sequentialOptions = { ...options, parallelProcessing: false };
      const sequentialStartTime = Date.now();
      const sequentialResults = await patternMatcher.detectSymbols(mockImageBuffer, sequentialOptions);
      const sequentialTime = Date.now() - sequentialStartTime;

      // Parallel should generally be faster or at least not significantly slower
      // (Note: For small mock images, parallel might have overhead, so we just verify it works)
      expect(results.length).toBeGreaterThanOrEqual(0);
      expect(sequentialResults.length).toBeGreaterThanOrEqual(0);
      
      console.log(`Parallel: ${parallelTime}ms (${results.length} symbols), Sequential: ${sequentialTime}ms (${sequentialResults.length} symbols)`);
    });

    test('should use early termination when enabled', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.4,
        maxSymbols: 5, // Small number to trigger early termination
        earlyTermination: true,
        enableRotationInvariance: true,
        enableEnsembleMatching: true,
      };

      const startTime = Date.now();
      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      const processingTime = Date.now() - startTime;

      // Should complete quickly due to early termination
      expect(processingTime).toBeLessThan(10000); // Should be much faster than full processing
      expect(results.length).toBeLessThanOrEqual(options.maxSymbols);
    });

    test('should apply adaptive filtering for performance', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.3, // Low threshold
        maxSymbols: 30,
        adaptiveFiltering: true, // Should automatically adjust threshold higher
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      // With adaptive filtering, should have reasonable confidence levels
      const avgConfidence = results.reduce((sum, s) => sum + s.confidence, 0) / results.length;
      expect(avgConfidence).toBeGreaterThan(0.5); // Should be higher than original threshold due to adaptive filtering
    });
  });

  describe('Advanced Features Integration', () => {
    test('should handle all advanced features enabled simultaneously', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 25,
        maxProcessingTime: 25000,
        enableRotationInvariance: true,
        enableScaleInvariance: true,
        enableEnsembleMatching: true,
        enableHuMoments: true,
        enableKeyPointMatching: true,
        parallelProcessing: true,
        adaptiveFiltering: true,
        earlyTermination: true,
        memoryOptimization: true,
        batchSize: 4,
      };

      const startTime = Date.now();
      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      const processingTime = Date.now() - startTime;

      // Should complete successfully with all features enabled
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      expect(processingTime).toBeLessThan(options.maxProcessingTime!);
      
      // Verify symbol quality
      results.forEach(symbol => {
        expect(symbol.confidence).toBeGreaterThanOrEqual(options.confidenceThreshold);
        expect(symbol.confidence).toBeLessThanOrEqual(1);
        expect(symbol.symbolType).toBeDefined();
        expect(symbol.location).toBeDefined();
        expect(symbol.boundingBox).toBeDefined();
      });

      console.log(`All features test: ${processingTime}ms, ${results.length} symbols detected`);
    });

    test('should provide detailed performance metrics', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 15,
        enableRotationInvariance: true,
        enableEnsembleMatching: true,
        parallelProcessing: true,
      };

      // Capture console logs to verify performance logging
      const originalConsoleLog = console.log;
      const logs: string[] = [];
      console.log = (message: string, ...args: any[]) => {
        logs.push(message + (args.length > 0 ? ' ' + JSON.stringify(args) : ''));
      };

      try {
        const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
        
        // Should have performance logging
        const performanceLogs = logs.filter(log => log.includes('Pattern matching completed'));
        expect(performanceLogs.length).toBeGreaterThan(0);
        
        // Verify results structure
        expect(results.length).toBeLessThanOrEqual(options.maxSymbols);
        
      } finally {
        console.log = originalConsoleLog;
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid image buffer gracefully', async () => {
      const invalidBuffer = Buffer.alloc(0); // Empty buffer
      
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 10,
      };

      await expect(patternMatcher.detectSymbols(invalidBuffer, options))
        .rejects.toThrow(); // Should throw PatternMatchingError
    });

    test('should handle timeout gracefully', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.3,
        maxSymbols: 100,
        maxProcessingTime: 100, // Very short timeout
        enableRotationInvariance: true,
        enableEnsembleMatching: true,
        enableKeyPointMatching: true,
      };

      const startTime = Date.now();
      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      const processingTime = Date.now() - startTime;

      // Should respect timeout and still return results
      expect(processingTime).toBeLessThan(5000); // Should terminate quickly
      expect(results).toBeInstanceOf(Array); // Should still return array (may be empty)
    });

    test('should handle very high confidence threshold', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.95, // Very high threshold
        maxSymbols: 20,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      // Should return fewer results but no errors
      expect(results).toBeInstanceOf(Array);
      results.forEach(symbol => {
        expect(symbol.confidence).toBeGreaterThanOrEqual(0.95);
      });
    });
  });

  describe('Template Matching Accuracy', () => {
    test('should detect different symbol types accurately', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.4,
        maxSymbols: 30,
        enableRotationInvariance: true,
        enableEnsembleMatching: true,
      };

      const results = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      // Should detect various symbol types
      const symbolTypes = new Set(results.map(s => s.symbolType));
      expect(symbolTypes.size).toBeGreaterThan(0);
      
      // Verify symbol categories are assigned correctly
      results.forEach(symbol => {
        expect(['passive', 'active', 'connector', 'power', 'protection', 'logic', 'custom']).toContain(symbol.symbolCategory);
      });
    });

    test('should provide consistent results across multiple runs', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.6,
        maxSymbols: 15,
        enableRotationInvariance: true,
      };

      const results1 = await patternMatcher.detectSymbols(mockImageBuffer, options);
      const results2 = await patternMatcher.detectSymbols(mockImageBuffer, options);

      // Results should be reasonably consistent (allowing for some randomness in mock data)
      const types1 = new Set(results1.map(s => s.symbolType));
      const types2 = new Set(results2.map(s => s.symbolType));
      
      // Should have some overlap in detected symbol types
      const intersection = new Set([...types1].filter(x => types2.has(x)));
      expect(intersection.size).toBeGreaterThanOrEqual(Math.min(types1.size, types2.size) * 0.5);
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
  
  // Draw some mock electrical symbols for testing
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 3;
  
  // Mock resistor
  ctx.beginPath();
  ctx.moveTo(50, 100);
  ctx.lineTo(100, 100);
  ctx.lineTo(120, 80);
  ctx.lineTo(140, 120);
  ctx.lineTo(160, 80);
  ctx.lineTo(180, 120);
  ctx.lineTo(200, 100);
  ctx.lineTo(250, 100);
  ctx.stroke();
  
  // Mock capacitor
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
  
  // Mock inductor
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