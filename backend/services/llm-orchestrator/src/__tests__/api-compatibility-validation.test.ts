/**
 * API Compatibility Validation
 * 
 * Ensures that our OpenCV enhancements maintain full compatibility
 * with existing API contracts and don't break downstream consumers.
 */

import { ImageProcessor } from '../vision/image-processor';
import { PatternMatcher } from '../detection/pattern-matcher';
import { MLClassifier } from '../detection/ml-classifier';
import { createCanvas } from 'canvas';

describe('API Compatibility Validation', () => {
  let imageProcessor: ImageProcessor;
  let patternMatcher: PatternMatcher;
  let mlClassifier: MLClassifier;
  let mockImageBuffer: Buffer;
  let mockPdfBuffer: Buffer;

  beforeEach(() => {
    imageProcessor = new ImageProcessor();
    patternMatcher = new PatternMatcher();
    mlClassifier = new MLClassifier();
    
    // Create test buffers
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = 'black';
    ctx.fillRect(25, 25, 50, 50);
    mockImageBuffer = canvas.toBuffer('image/png');
    
    mockPdfBuffer = Buffer.from('%PDF-1.4 test content');
  });

  describe('ImageProcessor API Compatibility', () => {
    it('should maintain convertPdfToImages API contract', async () => {
      // Test original signature
      const result1 = await imageProcessor.convertPdfToImages(mockPdfBuffer);
      expect(Array.isArray(result1)).toBe(true);
      expect(result1.length).toBeGreaterThan(0);
      
      // Test with options
      const result2 = await imageProcessor.convertPdfToImages(mockPdfBuffer, {
        dpi: 150,
        format: 'jpeg'
      });
      expect(Array.isArray(result2)).toBe(true);
      expect(result2.length).toBeGreaterThan(0);
    });

    it('should maintain preprocessImage API contract', async () => {
      const result = await imageProcessor.preprocessImage(mockImageBuffer, {
        enhanceContrast: true,
        reduceNoise: true,
        detectEdges: true
      });
      
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should maintain assessImageQuality API contract', async () => {
      const quality = await imageProcessor.assessImageQuality(mockImageBuffer);
      
      expect(quality).toHaveProperty('resolution');
      expect(quality).toHaveProperty('clarity');
      expect(quality).toHaveProperty('contrast');
      expect(quality).toHaveProperty('noiseLevel');
      
      expect(typeof quality.resolution).toBe('number');
      expect(typeof quality.clarity).toBe('number');
      expect(typeof quality.contrast).toBe('number');
      expect(typeof quality.noiseLevel).toBe('number');
    });

    it('should maintain extractRegions API contract', async () => {
      const regions = [
        { x: 10, y: 10, width: 30, height: 30 },
        { x: 50, y: 50, width: 40, height: 40 }
      ];
      
      const result = await imageProcessor.extractRegions(mockImageBuffer, regions);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(regions.length);
      
      result.forEach(buffer => {
        expect(Buffer.isBuffer(buffer)).toBe(true);
      });
    });

    it('should maintain applyDetectionFilters API contract', async () => {
      const result = await imageProcessor.applyDetectionFilters(mockImageBuffer);
      
      expect(result).toHaveProperty('original');
      expect(result).toHaveProperty('edges');
      expect(result).toHaveProperty('morphological');
      expect(result).toHaveProperty('thresholded');
      
      expect(Buffer.isBuffer(result.original)).toBe(true);
      expect(Buffer.isBuffer(result.edges)).toBe(true);
      expect(Buffer.isBuffer(result.morphological)).toBe(true);
      expect(Buffer.isBuffer(result.thresholded)).toBe(true);
    });

    it('should maintain coordinate normalization API contract', () => {
      const normalized = imageProcessor.normalizeCoordinates(100, 200, 800, 600);
      
      expect(normalized).toHaveProperty('normalizedX');
      expect(normalized).toHaveProperty('normalizedY');
      expect(normalized).toHaveProperty('originalX');
      expect(normalized).toHaveProperty('originalY');
      expect(normalized).toHaveProperty('imageWidth');
      expect(normalized).toHaveProperty('imageHeight');
      
      expect(normalized.normalizedX).toBe(0.125);
      expect(normalized.normalizedY).toBe(1/3);
      expect(normalized.originalX).toBe(100);
      expect(normalized.originalY).toBe(200);
    });

    it('should maintain coordinate denormalization API contract', () => {
      const denormalized = imageProcessor.denormalizeCoordinates(0.125, 0.25, 800, 600);
      
      expect(denormalized).toHaveProperty('x');
      expect(denormalized).toHaveProperty('y');
      expect(denormalized.x).toBe(100);
      expect(denormalized.y).toBe(150);
    });
  });

  describe('PatternMatcher API Compatibility', () => {
    it('should maintain detectSymbols API contract', async () => {
      const options = {
        confidenceThreshold: 0.5,
        maxSymbols: 10,
        enableRotationInvariance: true,
        enableScaleInvariance: true
      };
      
      const result = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      expect(Array.isArray(result)).toBe(true);
      
      // Check that results follow expected structure
      result.forEach(symbol => {
        expect(symbol).toHaveProperty('id');
        expect(symbol).toHaveProperty('symbolType');
        expect(symbol).toHaveProperty('symbolCategory');
        expect(symbol).toHaveProperty('description');
        expect(symbol).toHaveProperty('confidence');
        expect(symbol).toHaveProperty('location');
        expect(symbol).toHaveProperty('boundingBox');
        expect(symbol).toHaveProperty('detectionMethod');
        expect(symbol).toHaveProperty('features');
        expect(symbol).toHaveProperty('validationScore');
        
        expect(typeof symbol.id).toBe('string');
        expect(typeof symbol.symbolType).toBe('string');
        expect(typeof symbol.symbolCategory).toBe('string');
        expect(typeof symbol.description).toBe('string');
        expect(typeof symbol.confidence).toBe('number');
        expect(typeof symbol.detectionMethod).toBe('string');
        expect(typeof symbol.validationScore).toBe('number');
      });
    });

    it('should maintain getAvailableTemplates API contract', () => {
      const templates = patternMatcher.getAvailableTemplates();
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      
      templates.forEach(template => {
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('symbolType');
        expect(template).toHaveProperty('symbolCategory');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('templateImage');
        expect(template).toHaveProperty('features');
        expect(template).toHaveProperty('variants');
        
        expect(typeof template.id).toBe('string');
        expect(typeof template.symbolType).toBe('string');
        expect(typeof template.symbolCategory).toBe('string');
        expect(typeof template.description).toBe('string');
        expect(Buffer.isBuffer(template.templateImage)).toBe(true);
        expect(Array.isArray(template.variants)).toBe(true);
      });
    });

    it('should maintain addTemplate API contract', () => {
      const customTemplate = {
        id: 'test-template',
        symbolType: 'custom' as const,
        symbolCategory: 'custom' as const,
        description: 'Test template',
        name: 'Test Template',
        standardType: 'Custom' as const,
        templateImage: Buffer.alloc(100),
        metadata: {
          commonNames: ['test'],
          applications: ['testing'],
          electricalProperties: {
            componentType: 'custom' as const
          },
          physicalCharacteristics: {
            typicalAspectRatio: 1.0,
            minSize: { width: 10, height: 10 },
            maxSize: { width: 100, height: 100 },
            shapeComplexity: 0.5,
            hasTextLabel: false,
            symmetryType: 'none' as const
          },
          connectionPoints: [],
          tags: ['test']
        },
        features: {
          contourSignature: [],
          geometricMoments: [],
          shapeDescriptors: [1.0, 0.8, 0.6],
          textureFeatures: [],
          invariantMoments: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
          keyPoints: [],
          descriptors: []
        },
        variants: [],
        priority: 1,
        ensembleWeight: 0.5
      };

      // Should not throw
      expect(() => patternMatcher.addTemplate(customTemplate)).not.toThrow();
      
      // Should be in templates list
      const templates = patternMatcher.getAvailableTemplates();
      const addedTemplate = templates.find(t => t.id === 'test-template');
      expect(addedTemplate).toBeDefined();
    });

    it('should maintain removeTemplate API contract', () => {
      const templates = patternMatcher.getAvailableTemplates();
      const originalCount = templates.length;
      
      if (originalCount > 0) {
        const templateId = templates[0].id;
        const removed = patternMatcher.removeTemplate(templateId);
        
        expect(typeof removed).toBe('boolean');
        expect(removed).toBe(true);
        
        const updatedTemplates = patternMatcher.getAvailableTemplates();
        expect(updatedTemplates.length).toBe(originalCount - 1);
      }
      
      // Removing non-existent template should return false
      const nonExistentRemoved = patternMatcher.removeTemplate('non-existent');
      expect(nonExistentRemoved).toBe(false);
    });
  });

  describe('MLClassifier API Compatibility', () => {
    it('should maintain classifySymbols API contract', async () => {
      const existingSymbols = await patternMatcher.detectSymbols(mockImageBuffer, {
        confidenceThreshold: 0.3,
        maxSymbols: 5
      });
      
      const result = await mlClassifier.classifySymbols(mockImageBuffer, existingSymbols);
      
      expect(Array.isArray(result)).toBe(true);
      
      // Should maintain symbol structure
      result.forEach(symbol => {
        expect(symbol).toHaveProperty('id');
        expect(symbol).toHaveProperty('symbolType');
        expect(symbol).toHaveProperty('symbolCategory');
        expect(symbol).toHaveProperty('confidence');
        expect(symbol).toHaveProperty('detectionMethod');
        
        // Enhanced symbols should have ml_classification or consensus method
        expect(['ml_classification', 'consensus', 'pattern_matching']).toContain(symbol.detectionMethod);
      });
    });

    it('should maintain getModelInfo API contract', () => {
      const modelInfo = mlClassifier.getModelInfo();
      
      expect(modelInfo).toHaveProperty('version');
      expect(modelInfo).toHaveProperty('supportedSymbols');
      expect(modelInfo).toHaveProperty('isLoaded');
      
      expect(typeof modelInfo.version).toBe('string');
      expect(Array.isArray(modelInfo.supportedSymbols)).toBe(true);
      expect(typeof modelInfo.isLoaded).toBe('boolean');
    });

    it('should maintain updateModel API contract', async () => {
      // Should not throw
      await expect(mlClassifier.updateModel('v2.0')).resolves.not.toThrow();
      
      const modelInfo = mlClassifier.getModelInfo();
      expect(modelInfo.version).toBe('v2.0');
    });
  });

  describe('Enhanced Features Backwards Compatibility', () => {
    it('should work with existing symbol detection workflows', async () => {
      // Simulate existing workflow
      const preprocessed = await imageProcessor.preprocessImage(mockImageBuffer, {
        enhanceContrast: true,
        reduceNoise: true
      });
      
      const symbols = await patternMatcher.detectSymbols(preprocessed, {
        confidenceThreshold: 0.4,
        maxSymbols: 10
      });
      
      const enhanced = await mlClassifier.classifySymbols(preprocessed, symbols);
      
      // Should complete without errors
      expect(Buffer.isBuffer(preprocessed)).toBe(true);
      expect(Array.isArray(symbols)).toBe(true);
      expect(Array.isArray(enhanced)).toBe(true);
    });

    it('should handle same input types as before', async () => {
      // Test with various buffer types
      const results = await Promise.all([
        imageProcessor.assessImageQuality(mockImageBuffer),
        patternMatcher.detectSymbols(mockImageBuffer, { confidenceThreshold: 0.5, maxSymbols: 5 }),
        mlClassifier.classifySymbols(mockImageBuffer, [])
      ]);
      
      results.forEach(result => {
        expect(result).toBeDefined();
      });
    });

    it('should maintain error handling behavior', async () => {
      const invalidBuffer = Buffer.from('invalid');
      
      // Should handle errors consistently with previous behavior
      await expect(imageProcessor.assessImageQuality(invalidBuffer))
        .rejects.toThrow();
      
      // These should handle gracefully like before
      const symbols = await patternMatcher.detectSymbols(invalidBuffer, {
        confidenceThreshold: 0.5,
        maxSymbols: 5
      });
      expect(Array.isArray(symbols)).toBe(true);
    });
  });

  describe('Performance Regression Prevention', () => {
    it('should not significantly degrade performance', async () => {
      const startTime = Date.now();
      
      // Run basic operations
      await imageProcessor.preprocessImage(mockImageBuffer);
      await patternMatcher.detectSymbols(mockImageBuffer, { confidenceThreshold: 0.5, maxSymbols: 3 });
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should complete within reasonable time (5 seconds for basic operations)
      expect(processingTime).toBeLessThan(5000);
    });

    it('should handle multiple concurrent calls like before', async () => {
      const concurrentCalls = Array(5).fill(null).map(() => 
        patternMatcher.detectSymbols(mockImageBuffer, { confidenceThreshold: 0.5, maxSymbols: 2 })
      );
      
      const results = await Promise.all(concurrentCalls);
      
      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });
  });

  describe('Data Structure Consistency', () => {
    it('should maintain expected symbol data structure', async () => {
      const symbols = await patternMatcher.detectSymbols(mockImageBuffer, {
        confidenceThreshold: 0.1,
        maxSymbols: 1
      });
      
      if (symbols.length > 0) {
        const symbol = symbols[0];
        
        // Core required fields
        expect(typeof symbol.id).toBe('string');
        expect(symbol.id).toMatch(/^[0-9a-f-]+$/); // UUID format
        
        // Symbol identification
        expect(typeof symbol.symbolType).toBe('string');
        expect(typeof symbol.symbolCategory).toBe('string');
        expect(typeof symbol.description).toBe('string');
        
        // Confidence and location
        expect(typeof symbol.confidence).toBe('number');
        expect(symbol.confidence).toBeGreaterThanOrEqual(0);
        expect(symbol.confidence).toBeLessThanOrEqual(1);
        
        // Location object structure
        expect(symbol.location).toHaveProperty('x');
        expect(symbol.location).toHaveProperty('y');
        expect(symbol.location).toHaveProperty('pageNumber');
        expect(typeof symbol.location.x).toBe('number');
        expect(typeof symbol.location.y).toBe('number');
        expect(typeof symbol.location.pageNumber).toBe('number');
        
        // Bounding box structure
        expect(symbol.boundingBox).toHaveProperty('x');
        expect(symbol.boundingBox).toHaveProperty('y');
        expect(symbol.boundingBox).toHaveProperty('width');
        expect(symbol.boundingBox).toHaveProperty('height');
        expect(symbol.boundingBox).toHaveProperty('area');
        
        // Features structure
        expect(symbol.features).toHaveProperty('geometricProperties');
        expect(symbol.features).toHaveProperty('shapeAnalysis');
        expect(symbol.features).toHaveProperty('contourPoints');
        expect(Array.isArray(symbol.features.contourPoints)).toBe(true);
      }
    });

    it('should maintain expected quality assessment structure', async () => {
      const quality = await imageProcessor.assessImageQuality(mockImageBuffer);
      
      // Required numeric properties
      expect(typeof quality.resolution).toBe('number');
      expect(typeof quality.clarity).toBe('number');
      expect(typeof quality.contrast).toBe('number');
      expect(typeof quality.noiseLevel).toBe('number');
      
      // Values should be normalized (0-1 range for most metrics)
      expect(quality.resolution).toBeGreaterThanOrEqual(0);
      expect(quality.clarity).toBeGreaterThanOrEqual(0);
      expect(quality.contrast).toBeGreaterThanOrEqual(0);
      expect(quality.noiseLevel).toBeGreaterThanOrEqual(0);
    });
  });
});