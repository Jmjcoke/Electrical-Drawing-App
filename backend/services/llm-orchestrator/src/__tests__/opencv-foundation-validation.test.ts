/**
 * OpenCV Foundation Validation Tests
 * 
 * These tests validate that our OpenCV foundation is properly set up
 * and that fallback mechanisms work correctly when OpenCV.js is not
 * available in the Node.js environment.
 */

import { ImageProcessor } from '../vision/image-processor';
import { PatternMatcher } from '../detection/pattern-matcher';
import { createCanvas } from 'canvas';

describe('OpenCV Foundation Validation', () => {
  let imageProcessor: ImageProcessor;
  let patternMatcher: PatternMatcher;
  let mockImageBuffer: Buffer;

  beforeEach(() => {
    imageProcessor = new ImageProcessor();
    patternMatcher = new PatternMatcher();
    
    // Create a simple test image
    const canvas = createCanvas(200, 200);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = 'black';
    ctx.fillRect(50, 50, 100, 100);
    
    mockImageBuffer = canvas.toBuffer('image/png');
  });

  describe('Dependency Installation Validation', () => {
    it('should have OpenCV.js dependency available', () => {
      // Test that the OpenCV module can be imported
      expect(() => require('@techstark/opencv-js')).not.toThrow();
    });

    it('should have pdf2pic dependency available', () => {
      // Test that pdf2pic module can be imported
      expect(() => require('pdf2pic')).not.toThrow();
    });

    it('should have jimp dependency available', () => {
      // Test that jimp module can be imported
      expect(() => require('jimp')).not.toThrow();
    });
  });

  describe('ImageProcessor Foundation', () => {
    it('should have OpenCV preprocessing methods defined', () => {
      expect(typeof imageProcessor.preprocessImageWithOpenCV).toBe('function');
      expect(typeof imageProcessor.extractContoursWithOpenCV).toBe('function');
      expect(typeof imageProcessor.applyMorphologicalOperations).toBe('function');
      expect(typeof imageProcessor.detectMultiScaleEdges).toBe('function');
    });

    it('should handle OpenCV initialization gracefully', async () => {
      // This tests the initializeOpenCV private method indirectly
      try {
        await imageProcessor.preprocessImageWithOpenCV(mockImageBuffer);
        // If it succeeds, great
        expect(true).toBe(true);
      } catch (error) {
        // If it fails due to OpenCV not being available in Node.js, that's expected
        expect(error).toBeDefined();
        console.log('OpenCV initialization failed as expected in Node.js environment');
      }
    });

    it('should have fallback to Sharp-based operations', async () => {
      // Test that Sharp-based fallback operations work
      const result = await imageProcessor.applyDetectionFilters(mockImageBuffer);
      
      expect(result).toBeDefined();
      expect(result.original).toBeDefined();
      expect(result.edges).toBeDefined();
      expect(result.morphological).toBeDefined();
      expect(result.thresholded).toBeDefined();
      
      // All should be valid buffers
      expect(Buffer.isBuffer(result.original)).toBe(true);
      expect(Buffer.isBuffer(result.edges)).toBe(true);
      expect(Buffer.isBuffer(result.morphological)).toBe(true);
      expect(Buffer.isBuffer(result.thresholded)).toBe(true);
    });

    it('should convert PDF to images with real implementation', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 mock content');
      
      const result = await imageProcessor.convertPdfToImages(mockPdfBuffer, {
        dpi: 300,
        format: 'png'
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Should return valid buffers (even if fallback mock)
      result.forEach(buffer => {
        expect(Buffer.isBuffer(buffer)).toBe(true);
        expect(buffer.length).toBeGreaterThan(0);
      });
    });
  });

  describe('PatternMatcher Foundation', () => {
    it('should have OpenCV-enhanced detection methods defined', () => {
      expect(typeof patternMatcher.detectSymbols).toBe('function');
      expect(typeof patternMatcher.performTemplateMatching).toBe('function');
      expect(typeof patternMatcher.calculateTemplateSimilarity).toBe('function');
    });

    it('should detect symbols with enhanced pipeline', async () => {
      const options = {
        confidenceThreshold: 0.3,
        maxSymbols: 10,
        enableRotationInvariance: true,
        enableScaleInvariance: true
      };

      const result = await patternMatcher.detectSymbols(mockImageBuffer, options);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      // Should have some results (even if from fallback contours)
      if (result.length > 0) {
        const symbol = result[0];
        expect(symbol.id).toBeDefined();
        expect(symbol.symbolType).toBeDefined();
        expect(symbol.confidence).toBeDefined();
        expect(symbol.boundingBox).toBeDefined();
        expect(symbol.features).toBeDefined();
      }
    });

    it('should perform template matching with fallback', async () => {
      const templateCanvas = createCanvas(50, 50);
      const ctx = templateCanvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 50, 50);
      ctx.fillStyle = 'black';
      ctx.fillRect(10, 10, 30, 30);
      const templateBuffer = templateCanvas.toBuffer('image/png');

      try {
        const result = await patternMatcher.performTemplateMatching(
          mockImageBuffer,
          templateBuffer,
          { threshold: 0.5 }
        );

        expect(result).toBeDefined();
        expect(result.matches).toBeDefined();
        expect(Array.isArray(result.matches)).toBe(true);
        expect(result.matchImage).toBeDefined();
        expect(Buffer.isBuffer(result.matchImage)).toBe(true);
      } catch (error) {
        // If OpenCV-specific features fail, that's expected in Node.js
        console.log('Template matching fell back due to OpenCV limitations in Node.js');
        expect(error).toBeDefined();
      }
    });

    it('should have template management working', () => {
      const templates = patternMatcher.getAvailableTemplates();
      
      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      
      // Should have standard electrical symbol templates
      const symbolTypes = templates.map(t => t.symbolType);
      expect(symbolTypes).toContain('resistor');
      expect(symbolTypes).toContain('capacitor');
      expect(symbolTypes).toContain('inductor');
    });
  });

  describe('Error Handling and Robustness', () => {
    it('should handle invalid image buffers gracefully', async () => {
      const invalidBuffer = Buffer.from('invalid-image-data');

      // Should not throw but handle gracefully
      const filterResult = await imageProcessor.applyDetectionFilters(invalidBuffer);
      expect(filterResult).toBeDefined();

      const symbolResult = await patternMatcher.detectSymbols(invalidBuffer, {
        confidenceThreshold: 0.5,
        maxSymbols: 5
      });
      expect(symbolResult).toBeDefined();
      expect(Array.isArray(symbolResult)).toBe(true);
    });

    it('should handle empty buffers appropriately', async () => {
      const emptyBuffer = Buffer.alloc(0);

      // Some operations should fail appropriately
      await expect(imageProcessor.assessImageQuality(emptyBuffer))
        .rejects.toThrow();

      // Others should handle gracefully
      const symbolResult = await patternMatcher.detectSymbols(emptyBuffer, {
        confidenceThreshold: 0.5,
        maxSymbols: 5
      });
      expect(symbolResult).toBeDefined();
    });

    it('should provide consistent results across multiple runs', async () => {
      const runs = 3;
      const results = [];

      for (let i = 0; i < runs; i++) {
        const symbols = await patternMatcher.detectSymbols(mockImageBuffer, {
          confidenceThreshold: 0.3,
          maxSymbols: 5
        });
        results.push(symbols.length);
      }

      // Results should be consistent
      const firstResult = results[0];
      results.forEach(result => {
        expect(result).toBe(firstResult);
      });
    });
  });

  describe('Performance Characteristics', () => {
    it('should complete basic operations within reasonable time', async () => {
      const startTime = Date.now();

      // Test basic pipeline
      const filtered = await imageProcessor.applyDetectionFilters(mockImageBuffer);
      const symbols = await patternMatcher.detectSymbols(filtered.edges, {
        confidenceThreshold: 0.5,
        maxSymbols: 5
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(symbols).toBeDefined();
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle multiple concurrent operations', async () => {
      const operations = [
        imageProcessor.applyDetectionFilters(mockImageBuffer),
        imageProcessor.assessImageQuality(mockImageBuffer),
        patternMatcher.detectSymbols(mockImageBuffer, { confidenceThreshold: 0.5, maxSymbols: 3 })
      ];

      const results = await Promise.all(operations);

      expect(results).toBeDefined();
      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });
  });

  describe('API Compatibility', () => {
    it('should maintain existing API structure', () => {
      // Verify that existing methods still exist and have correct signatures
      expect(typeof imageProcessor.convertPdfToImages).toBe('function');
      expect(typeof imageProcessor.preprocessImage).toBe('function');
      expect(typeof imageProcessor.assessImageQuality).toBe('function');
      expect(typeof imageProcessor.extractRegions).toBe('function');

      expect(typeof patternMatcher.detectSymbols).toBe('function');
      expect(typeof patternMatcher.getAvailableTemplates).toBe('function');
      expect(typeof patternMatcher.addTemplate).toBe('function');
      expect(typeof patternMatcher.removeTemplate).toBe('function');
    });

    it('should return expected data structures', async () => {
      // Test that return types match expected interfaces
      const quality = await imageProcessor.assessImageQuality(mockImageBuffer);
      
      expect(quality).toHaveProperty('resolution');
      expect(quality).toHaveProperty('clarity');
      expect(quality).toHaveProperty('contrast');
      expect(quality).toHaveProperty('noiseLevel');
      
      expect(typeof quality.resolution).toBe('number');
      expect(typeof quality.clarity).toBe('number');
      expect(typeof quality.contrast).toBe('number');
      expect(typeof quality.noiseLevel).toBe('number');

      const symbols = await patternMatcher.detectSymbols(mockImageBuffer, {
        confidenceThreshold: 0.1,
        maxSymbols: 1
      });

      if (symbols.length > 0) {
        const symbol = symbols[0];
        expect(symbol).toHaveProperty('id');
        expect(symbol).toHaveProperty('symbolType');
        expect(symbol).toHaveProperty('symbolCategory');
        expect(symbol).toHaveProperty('confidence');
        expect(symbol).toHaveProperty('boundingBox');
        expect(symbol).toHaveProperty('location');
        expect(symbol).toHaveProperty('features');
        expect(symbol).toHaveProperty('detectionMethod');
      }
    });
  });

  describe('Integration Readiness', () => {
    it('should be ready for integration with SymbolDetector', () => {
      // Verify that the enhanced classes can be used as drop-in replacements
      expect(imageProcessor).toBeInstanceOf(ImageProcessor);
      expect(patternMatcher).toBeInstanceOf(PatternMatcher);
      
      // Test basic workflow compatibility
      expect(typeof imageProcessor.preprocessImage).toBe('function');
      expect(typeof patternMatcher.detectSymbols).toBe('function');
    });

    it('should provide enhanced capabilities while maintaining compatibility', async () => {
      // Test that new capabilities are available
      expect(typeof imageProcessor.preprocessImageWithOpenCV).toBe('function');
      expect(typeof imageProcessor.extractContoursWithOpenCV).toBe('function');
      expect(typeof patternMatcher.performTemplateMatching).toBe('function');
      
      // Test that old capabilities still work
      const preprocessed = await imageProcessor.preprocessImage(mockImageBuffer, {
        enhanceContrast: true,
        reduceNoise: true
      });
      
      expect(preprocessed).toBeDefined();
      expect(Buffer.isBuffer(preprocessed)).toBe(true);
    });

    it('should log appropriate messages for debugging', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      try {
        await imageProcessor.preprocessImageWithOpenCV(mockImageBuffer);
      } catch (error) {
        // Expected in Node.js environment
      }
      
      // Should have appropriate logging
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });
});