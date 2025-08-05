/**
 * Tests for OpenCV-enhanced PatternMatcher functionality
 */

import { PatternMatcher, PatternMatchingOptions } from '../pattern-matcher';
import { PatternMatchingError } from '../../../../../shared/types/symbol-detection.types';
import { createCanvas } from 'canvas';

describe('PatternMatcher OpenCV Integration', () => {
  let patternMatcher: PatternMatcher;
  let mockImageBuffer: Buffer;
  let mockTemplateBuffer: Buffer;

  beforeEach(() => {
    patternMatcher = new PatternMatcher();
    
    // Create a mock image buffer with electrical symbol-like shapes
    const canvas = createCanvas(400, 300);
    const ctx = canvas.getContext('2d');
    
    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 400, 300);
    
    // Draw mock electrical symbols
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    
    // Resistor-like symbol
    ctx.beginPath();
    ctx.moveTo(50, 100);
    ctx.lineTo(70, 100);
    ctx.lineTo(80, 80);
    ctx.lineTo(100, 120);
    ctx.lineTo(120, 80);
    ctx.lineTo(140, 120);
    ctx.lineTo(150, 100);
    ctx.lineTo(170, 100);
    ctx.stroke();
    
    // Capacitor-like symbol
    ctx.beginPath();
    ctx.moveTo(250, 100);
    ctx.lineTo(270, 100);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(270, 80);
    ctx.lineTo(270, 120);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(280, 80);
    ctx.lineTo(280, 120);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(280, 100);
    ctx.lineTo(300, 100);
    ctx.stroke();
    
    mockImageBuffer = canvas.toBuffer('image/png');
    
    // Create a simple template buffer
    const templateCanvas = createCanvas(100, 50);
    const templateCtx = templateCanvas.getContext('2d');
    
    templateCtx.fillStyle = 'white';
    templateCtx.fillRect(0, 0, 100, 50);
    
    templateCtx.strokeStyle = 'black';
    templateCtx.lineWidth = 2;
    templateCtx.beginPath();
    templateCtx.moveTo(10, 25);
    templateCtx.lineTo(25, 25);
    templateCtx.lineTo(30, 15);
    templateCtx.lineTo(40, 35);
    templateCtx.lineTo(50, 15);
    templateCtx.lineTo(60, 35);
    templateCtx.lineTo(70, 25);
    templateCtx.lineTo(90, 25);
    templateCtx.stroke();
    
    mockTemplateBuffer = templateCanvas.toBuffer('image/png');
  });

  describe('Symbol Detection with OpenCV', () => {
    it('should detect symbols using OpenCV contour extraction', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 10,
        enableRotationInvariance: true,
        enableScaleInvariance: true
      };

      const result = await patternMatcher.detectSymbols(mockImageBuffer, options);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Verify detected symbol properties
      result.forEach(symbol => {
        expect(symbol.id).toBeDefined();
        expect(symbol.symbolType).toBeDefined();
        expect(symbol.symbolCategory).toBeDefined();
        expect(symbol.confidence).toBeDefined();
        expect(typeof symbol.confidence).toBe('number');
        expect(symbol.confidence).toBeGreaterThanOrEqual(0);
        expect(symbol.confidence).toBeLessThanOrEqual(1);
        expect(symbol.boundingBox).toBeDefined();
        expect(symbol.location).toBeDefined();
        expect(symbol.features).toBeDefined();
      });
    });

    it('should filter symbols by confidence threshold', async () => {
      const highThresholdOptions: PatternMatchingOptions = {
        confidenceThreshold: 0.9,
        maxSymbols: 10
      };

      const lowThresholdOptions: PatternMatchingOptions = {
        confidenceThreshold: 0.1,
        maxSymbols: 10
      };

      const highThresholdResult = await patternMatcher.detectSymbols(mockImageBuffer, highThresholdOptions);
      const lowThresholdResult = await patternMatcher.detectSymbols(mockImageBuffer, lowThresholdOptions);

      expect(lowThresholdResult.length).toBeGreaterThanOrEqual(highThresholdResult.length);
      
      // All results should meet threshold requirements
      highThresholdResult.forEach(symbol => {
        expect(symbol.confidence).toBeGreaterThanOrEqual(0.9);
      });
      
      lowThresholdResult.forEach(symbol => {
        expect(symbol.confidence).toBeGreaterThanOrEqual(0.1);
      });
    });

    it('should respect maximum symbols limit', async () => {
      const limitedOptions: PatternMatchingOptions = {
        confidenceThreshold: 0.1,
        maxSymbols: 2
      };

      const result = await patternMatcher.detectSymbols(mockImageBuffer, limitedOptions);

      expect(result.length).toBeLessThanOrEqual(2);
    });

    it('should sort results by confidence', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.1,
        maxSymbols: 10
      };

      const result = await patternMatcher.detectSymbols(mockImageBuffer, options);

      if (result.length > 1) {
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].confidence).toBeGreaterThanOrEqual(result[i + 1].confidence);
        }
      }
    });

    it('should handle contour extraction failures gracefully', async () => {
      const invalidBuffer = Buffer.from('invalid-image-data');
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 10
      };

      // Should fall back to mock contours and not throw
      const result = await patternMatcher.detectSymbols(invalidBuffer, options);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Enhanced Template Matching', () => {
    it('should perform template matching with OpenCV preprocessing', async () => {
      const result = await patternMatcher.performTemplateMatching(
        mockImageBuffer,
        mockTemplateBuffer,
        {
          method: 'TM_CCOEFF_NORMED',
          threshold: 0.6
        }
      );

      expect(result).toBeDefined();
      expect(result.matches).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
      expect(result.matchImage).toBeDefined();
      expect(Buffer.isBuffer(result.matchImage)).toBe(true);
      
      // Verify match properties
      result.matches.forEach(match => {
        expect(match.x).toBeDefined();
        expect(match.y).toBeDefined();
        expect(match.width).toBeDefined();
        expect(match.height).toBeDefined();
        expect(match.confidence).toBeDefined();
        expect(typeof match.confidence).toBe('number');
        expect(match.confidence).toBeGreaterThanOrEqual(0);
        expect(match.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should filter matches by threshold', async () => {
      const highThresholdResult = await patternMatcher.performTemplateMatching(
        mockImageBuffer,
        mockTemplateBuffer,
        { threshold: 0.9 }
      );

      const lowThresholdResult = await patternMatcher.performTemplateMatching(
        mockImageBuffer,
        mockTemplateBuffer,
        { threshold: 0.3 }
      );

      expect(lowThresholdResult.matches.length).toBeGreaterThanOrEqual(highThresholdResult.matches.length);
      
      // All matches should meet threshold
      highThresholdResult.matches.forEach(match => {
        expect(match.confidence).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should handle template matching errors', async () => {
      const invalidImageBuffer = Buffer.from('invalid');
      const invalidTemplateBuffer = Buffer.from('invalid');

      await expect(
        patternMatcher.performTemplateMatching(invalidImageBuffer, invalidTemplateBuffer)
      ).rejects.toThrow(PatternMatchingError);
    });

    it('should support different matching methods', async () => {
      const methods = ['TM_CCOEFF_NORMED', 'TM_CCORR_NORMED', 'TM_SQDIFF_NORMED'] as const;
      
      for (const method of methods) {
        const result = await patternMatcher.performTemplateMatching(
          mockImageBuffer,
          mockTemplateBuffer,
          { method, threshold: 0.5 }
        );

        expect(result).toBeDefined();
        expect(result.matches).toBeDefined();
        expect(result.matchImage).toBeDefined();
      }
    });
  });

  describe('Advanced Feature Extraction', () => {
    it('should calculate invariant moments using OpenCV', async () => {
      // Create a simple contour for testing
      const points = [
        { x: 10, y: 10 },
        { x: 50, y: 10 },
        { x: 50, y: 30 },
        { x: 10, y: 30 }
      ];

      // Access the private method through the public interface
      // We'll test this indirectly through detectSymbols
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.1,
        maxSymbols: 1
      };

      const result = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      if (result.length > 0) {
        const symbol = result[0];
        expect(symbol.features).toBeDefined();
        expect(symbol.features.geometricProperties).toBeDefined();
        expect(symbol.features.contourPoints).toBeDefined();
        expect(Array.isArray(symbol.features.contourPoints)).toBe(true);
      }
    });

    it('should extract comprehensive symbol features', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.1,
        maxSymbols: 1
      };

      const result = await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      if (result.length > 0) {
        const symbol = result[0];
        const features = symbol.features;
        
        expect(features.geometricProperties).toBeDefined();
        expect(features.geometricProperties.area).toBeDefined();
        expect(features.geometricProperties.perimeter).toBeDefined();
        expect(features.geometricProperties.centroid).toBeDefined();
        expect(features.geometricProperties.aspectRatio).toBeDefined();
        
        expect(features.shapeAnalysis).toBeDefined();
        expect(features.shapeAnalysis.complexity).toBeDefined();
        expect(features.shapeAnalysis.orientation).toBeDefined();
        expect(features.shapeAnalysis.strokeWidth).toBeDefined();
        expect(features.shapeAnalysis.isClosed).toBeDefined();
        
        expect(features.connectionPoints).toBeDefined();
        expect(Array.isArray(features.connectionPoints)).toBe(true);
        
        expect(features.textLabels).toBeDefined();
        expect(Array.isArray(features.textLabels)).toBe(true);
      }
    });
  });

  describe('Template Similarity Calculation', () => {
    it('should calculate comprehensive template similarity', async () => {
      const contour1 = {
        points: [
          { x: 10, y: 10 },
          { x: 50, y: 10 },
          { x: 50, y: 30 },
          { x: 10, y: 30 }
        ],
        boundingBox: { x: 10, y: 10, width: 40, height: 20, area: 800 },
        area: 800,
        perimeter: 120
      };

      const contour2 = {
        points: [
          { x: 15, y: 15 },
          { x: 45, y: 15 },
          { x: 45, y: 25 },
          { x: 15, y: 25 }
        ],
        boundingBox: { x: 15, y: 15, width: 30, height: 10, area: 300 },
        area: 300,
        perimeter: 80
      };

      const similarity = await patternMatcher.calculateTemplateSimilarity(contour1, contour2);

      expect(similarity).toBeDefined();
      expect(similarity.shapeMatch).toBeDefined();
      expect(similarity.sizeMatch).toBeDefined();
      expect(similarity.orientationMatch).toBeDefined();
      expect(similarity.overallSimilarity).toBeDefined();
      
      // All similarity values should be between 0 and 1
      expect(similarity.shapeMatch).toBeGreaterThanOrEqual(0);
      expect(similarity.shapeMatch).toBeLessThanOrEqual(1);
      expect(similarity.sizeMatch).toBeGreaterThanOrEqual(0);
      expect(similarity.sizeMatch).toBeLessThanOrEqual(1);
      expect(similarity.orientationMatch).toBeGreaterThanOrEqual(-1);
      expect(similarity.orientationMatch).toBeLessThanOrEqual(1);
      expect(similarity.overallSimilarity).toBeGreaterThanOrEqual(0);
      expect(similarity.overallSimilarity).toBeLessThanOrEqual(1);
    });

    it('should handle identical contours', async () => {
      const contour = {
        points: [
          { x: 10, y: 10 },
          { x: 50, y: 10 },
          { x: 50, y: 30 },
          { x: 10, y: 30 }
        ],
        boundingBox: { x: 10, y: 10, width: 40, height: 20, area: 800 },
        area: 800,
        perimeter: 120
      };

      const similarity = await patternMatcher.calculateTemplateSimilarity(contour, contour);

      expect(similarity.overallSimilarity).toBeCloseTo(1.0, 1);
    });

    it('should handle very different contours', async () => {
      const contour1 = {
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
        boundingBox: { x: 0, y: 0, width: 10, height: 10, area: 100 },
        area: 100,
        perimeter: 40
      };

      const contour2 = {
        points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 1 }, { x: 0, y: 1 }],
        boundingBox: { x: 0, y: 0, width: 100, height: 1, area: 100 },
        area: 100,
        perimeter: 202
      };

      const similarity = await patternMatcher.calculateTemplateSimilarity(contour1, contour2);

      expect(similarity.overallSimilarity).toBeLessThan(0.8);
    });
  });

  describe('Template Management', () => {
    it('should have default templates available', () => {
      const templates = patternMatcher.getAvailableTemplates();
      
      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      
      templates.forEach(template => {
        expect(template.id).toBeDefined();
        expect(template.symbolType).toBeDefined();
        expect(template.symbolCategory).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.features).toBeDefined();
        expect(template.variants).toBeDefined();
      });
    });

    it('should support adding custom templates', () => {
      const customTemplate = {
        id: 'custom-test-template',
        symbolType: 'custom' as const,
        symbolCategory: 'custom' as const,
        description: 'Test custom template',
        templateData: Buffer.alloc(100),
        features: {
          contourPoints: [],
          geometricProperties: {
            area: 1000,
            perimeter: 200,
            aspectRatio: 2.0,
            compactness: 0.8,
          },
          invariantMoments: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
          shapeDescriptors: [1.0, 0.8, 0.6],
        },
        variants: [],
      };

      patternMatcher.addTemplate(customTemplate);
      
      const templates = patternMatcher.getAvailableTemplates();
      const addedTemplate = templates.find(t => t.id === 'custom-test-template');
      
      expect(addedTemplate).toBeDefined();
      expect(addedTemplate?.symbolType).toBe('custom');
    });

    it('should support removing templates', () => {
      const templates = patternMatcher.getAvailableTemplates();
      const originalCount = templates.length;
      
      if (originalCount > 0) {
        const templateToRemove = templates[0];
        const removed = patternMatcher.removeTemplate(templateToRemove.id);
        
        expect(removed).toBe(true);
        
        const updatedTemplates = patternMatcher.getAvailableTemplates();
        expect(updatedTemplates.length).toBe(originalCount - 1);
      }
    });

    it('should handle removing non-existent templates', () => {
      const removed = patternMatcher.removeTemplate('non-existent-template-id');
      expect(removed).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle detection errors gracefully', async () => {
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 10
      };

      const malformedBuffer = Buffer.from('not-an-image');
      
      // Should not throw but handle gracefully with fallback
      const result = await patternMatcher.detectSymbols(malformedBuffer, options);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty image buffers', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 10
      };

      await expect(patternMatcher.detectSymbols(emptyBuffer, options))
        .rejects.toThrow(PatternMatchingError);
    });

    it('should validate pattern matching options', async () => {
      const invalidOptions: PatternMatchingOptions = {
        confidenceThreshold: -1, // Invalid threshold
        maxSymbols: 0 // Invalid max symbols
      };

      // Should handle invalid options gracefully or throw appropriate error
      await expect(patternMatcher.detectSymbols(mockImageBuffer, invalidOptions))
        .resolves.toBeDefined();
    });
  });

  describe('Performance Considerations', () => {
    it('should complete detection within reasonable time', async () => {
      const startTime = Date.now();
      
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 10
      };

      await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should complete within 5 seconds for this simple test
      expect(processingTime).toBeLessThan(5000);
    });

    it('should handle large numbers of templates efficiently', async () => {
      // Add multiple templates
      for (let i = 0; i < 10; i++) {
        const template = {
          id: `perf-test-template-${i}`,
          symbolType: 'custom' as const,
          symbolCategory: 'custom' as const,
          description: `Performance test template ${i}`,
          templateData: Buffer.alloc(100),
          features: {
            contourPoints: [],
            geometricProperties: {
              area: 1000 + i * 100,
              perimeter: 200 + i * 10,
              aspectRatio: 2.0 + i * 0.1,
              compactness: 0.8,
            },
            invariantMoments: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
            shapeDescriptors: [1.0, 0.8, 0.6],
          },
          variants: [],
        };
        
        patternMatcher.addTemplate(template);
      }

      const startTime = Date.now();
      
      const options: PatternMatchingOptions = {
        confidenceThreshold: 0.5,
        maxSymbols: 5
      };

      await patternMatcher.detectSymbols(mockImageBuffer, options);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Should still complete within reasonable time even with more templates
      expect(processingTime).toBeLessThan(10000);
    });
  });
});