/**
 * Integration tests for OpenCV functionality across the entire pipeline
 */

import { ImageProcessor } from '../vision/image-processor';
import { PatternMatcher } from '../detection/pattern-matcher';
import { MLClassifier } from '../detection/ml-classifier';
import { SymbolDetector } from '../detection/symbol-detector';
import { createCanvas } from 'canvas';

describe('OpenCV Integration Tests', () => {
  let imageProcessor: ImageProcessor;
  let patternMatcher: PatternMatcher;
  let mlClassifier: MLClassifier;
  let symbolDetector: SymbolDetector;
  let mockPdfBuffer: Buffer;
  let mockComplexDrawing: Buffer;

  beforeAll(async () => {
    imageProcessor = new ImageProcessor();
    patternMatcher = new PatternMatcher();
    mlClassifier = new MLClassifier();
    symbolDetector = new SymbolDetector();
  });

  beforeEach(() => {
    // Create mock PDF buffer
    mockPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n');

    // Create a complex electrical drawing mockup
    const canvas = createCanvas(800, 600);
    const ctx = canvas.getContext('2d');
    
    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 800, 600);
    
    // Grid lines (typical in electrical drawings)
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 800; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 600);
      ctx.stroke();
    }
    for (let y = 0; y <= 600; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(800, y);
      ctx.stroke();
    }
    
    // Electrical symbols
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    
    // Resistor at (100, 150)
    ctx.beginPath();
    ctx.moveTo(80, 150);
    ctx.lineTo(100, 150);
    ctx.lineTo(110, 130);
    ctx.lineTo(130, 170);
    ctx.lineTo(150, 130);
    ctx.lineTo(170, 170);
    ctx.lineTo(180, 150);
    ctx.lineTo(200, 150);
    ctx.stroke();
    
    // Capacitor at (300, 150)
    ctx.beginPath();
    ctx.moveTo(280, 150);
    ctx.lineTo(295, 150);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(295, 130);
    ctx.lineTo(295, 170);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(305, 130);
    ctx.lineTo(305, 170);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(305, 150);
    ctx.lineTo(320, 150);
    ctx.stroke();
    
    // Inductor at (500, 150)
    ctx.beginPath();
    ctx.moveTo(480, 150);
    ctx.lineTo(490, 150);
    // Draw coil
    for (let i = 0; i < 4; i++) {
      ctx.arc(495 + i * 10, 150, 5, Math.PI, 0);
    }
    ctx.moveTo(535, 150);
    ctx.lineTo(545, 150);
    ctx.stroke();
    
    // Ground symbol at (150, 300)
    ctx.beginPath();
    ctx.moveTo(150, 280);
    ctx.lineTo(150, 300);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(140, 300);
    ctx.lineTo(160, 300);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(145, 305);
    ctx.lineTo(155, 305);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(147, 310);
    ctx.lineTo(153, 310);
    ctx.stroke();
    
    // IC at (400, 300)
    ctx.beginPath();
    ctx.rect(370, 280, 60, 40);
    ctx.stroke();
    // IC pins
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(365, 285 + i * 10);
      ctx.lineTo(370, 285 + i * 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(430, 285 + i * 10);
      ctx.lineTo(435, 285 + i * 10);
      ctx.stroke();
    }
    
    // Connection lines
    ctx.beginPath();
    ctx.moveTo(200, 150);
    ctx.lineTo(280, 150);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(320, 150);
    ctx.lineTo(480, 150);
    ctx.stroke();
    
    mockComplexDrawing = canvas.toBuffer('image/png');
  });

  describe('End-to-End PDF Processing Pipeline', () => {
    it('should process PDF through complete OpenCV pipeline', async () => {
      // Step 1: Convert PDF to images
      const images = await imageProcessor.convertPdfToImages(mockPdfBuffer, {
        dpi: 300,
        format: 'png'
      });

      expect(images).toBeDefined();
      expect(images.length).toBeGreaterThan(0);

      // Step 2: Preprocess images with OpenCV
      const preprocessed = await imageProcessor.preprocessImageWithOpenCV(images[0], {
        enhanceContrast: true,
        reduceNoise: true,
        detectEdges: false, // We'll detect symbols, not just edges
        morphologyOperation: 'closing',
        kernelSize: 3
      });

      expect(preprocessed).toBeDefined();
      expect(preprocessed.processed).toBeDefined();
      expect(preprocessed.edges).toBeDefined();
      expect(preprocessed.morphological).toBeDefined();
      expect(preprocessed.denoised).toBeDefined();

      // Step 3: Apply detection filters
      const filtered = await imageProcessor.applyDetectionFilters(preprocessed.processed);

      expect(filtered).toBeDefined();
      expect(filtered.edges).toBeDefined();
      expect(filtered.morphological).toBeDefined();
      expect(filtered.thresholded).toBeDefined();

      // Step 4: Detect symbols using pattern matching
      const patternSymbols = await patternMatcher.detectSymbols(filtered.thresholded, {
        confidenceThreshold: 0.3,
        maxSymbols: 20,
        enableRotationInvariance: true,
        enableScaleInvariance: true
      });

      expect(patternSymbols).toBeDefined();
      expect(Array.isArray(patternSymbols)).toBe(true);

      // Step 5: Enhance with ML classification
      const mlSymbols = await mlClassifier.classifySymbols(filtered.processed, patternSymbols);

      expect(mlSymbols).toBeDefined();
      expect(Array.isArray(mlSymbols)).toBe(true);

      console.log(`Pipeline processed PDF with ${images.length} pages and detected ${mlSymbols.length} symbols`);
    });

    it('should handle pipeline errors gracefully', async () => {
      const invalidPdfBuffer = Buffer.from('invalid-pdf-data');

      // Should not throw but handle gracefully
      const images = await imageProcessor.convertPdfToImages(invalidPdfBuffer);
      expect(images).toBeDefined();

      // Continue with processing even with fallback images
      const preprocessed = await imageProcessor.preprocessImageWithOpenCV(images[0]);
      expect(preprocessed).toBeDefined();
    });
  });

  describe('Complex Drawing Analysis', () => {
    it('should analyze complex electrical drawing end-to-end', async () => {
      // Step 1: Assess image quality
      const quality = await imageProcessor.assessImageQuality(mockComplexDrawing);

      expect(quality).toBeDefined();
      expect(quality.resolution).toBeGreaterThan(0);
      expect(quality.clarity).toBeGreaterThan(0);
      expect(quality.contrast).toBeGreaterThan(0);

      console.log('Image quality assessment:', quality);

      // Step 2: Apply advanced preprocessing
      const preprocessed = await imageProcessor.preprocessImageWithOpenCV(mockComplexDrawing, {
        enhanceContrast: true,
        reduceNoise: true,
        detectEdges: false,
        morphologyOperation: 'closing',
        kernelSize: 3,
        gaussianKernelSize: 5,
        bilateralD: 9
      });

      expect(preprocessed).toBeDefined();

      // Step 3: Extract contours
      const contours = await imageProcessor.extractContoursWithOpenCV(preprocessed.processed);

      expect(contours).toBeDefined();
      expect(contours.contours).toBeDefined();
      expect(contours.contours.length).toBeGreaterThan(0);

      console.log(`Extracted ${contours.contours.length} contours from complex drawing`);

      // Step 4: Multi-scale edge detection
      const edges = await imageProcessor.detectMultiScaleEdges(mockComplexDrawing);

      expect(edges).toBeDefined();
      expect(edges.canny).toBeDefined();
      expect(edges.sobel).toBeDefined();
      expect(edges.laplacian).toBeDefined();
      expect(edges.combined).toBeDefined();

      // Step 5: Pattern matching with multiple methods
      const patternSymbols = await patternMatcher.detectSymbols(preprocessed.processed, {
        confidenceThreshold: 0.2,
        maxSymbols: 50,
        enableRotationInvariance: true,
        enableScaleInvariance: true
      });

      expect(patternSymbols.length).toBeGreaterThan(0);

      // Step 6: ML enhancement
      const mlSymbols = await mlClassifier.classifySymbols(preprocessed.processed, patternSymbols);

      expect(mlSymbols.length).toBeGreaterThan(0);

      // Step 7: Template matching validation
      const templates = patternMatcher.getAvailableTemplates();
      if (templates.length > 0 && mlSymbols.length > 0) {
        const templateBuffer = await imageProcessor.extractRegions(
          mockComplexDrawing,
          [mlSymbols[0].boundingBox]
        );

        if (templateBuffer.length > 0) {
          const matchResult = await patternMatcher.performTemplateMatching(
            mockComplexDrawing,
            templateBuffer[0],
            { threshold: 0.5 }
          );

          expect(matchResult).toBeDefined();
          expect(matchResult.matches).toBeDefined();
        }
      }

      console.log(`Final analysis found ${mlSymbols.length} symbols in complex drawing`);
    });

    it('should provide comprehensive symbol features', async () => {
      const symbols = await patternMatcher.detectSymbols(mockComplexDrawing, {
        confidenceThreshold: 0.1,
        maxSymbols: 10
      });

      if (symbols.length > 0) {
        const symbol = symbols[0];
        
        // Validate comprehensive features
        expect(symbol.features).toBeDefined();
        expect(symbol.features.geometricProperties).toBeDefined();
        expect(symbol.features.shapeAnalysis).toBeDefined();
        expect(symbol.features.contourPoints).toBeDefined();
        expect(symbol.features.connectionPoints).toBeDefined();
        
        // Geometric properties
        const geom = symbol.features.geometricProperties;
        expect(geom.area).toBeGreaterThan(0);
        expect(geom.perimeter).toBeGreaterThan(0);
        expect(geom.aspectRatio).toBeGreaterThan(0);
        expect(geom.centroid).toBeDefined();
        expect(geom.boundaryRectangle).toBeDefined();
        
        // Shape analysis
        const shape = symbol.features.shapeAnalysis;
        expect(shape.complexity).toBeGreaterThanOrEqual(0);
        expect(shape.complexity).toBeLessThanOrEqual(1);
        expect(shape.orientation).toBeDefined();
        expect(shape.strokeWidth).toBeGreaterThan(0);
        expect(typeof shape.isClosed).toBe('boolean');
        
        console.log('Symbol features analysis:', {
          area: geom.area,
          perimeter: geom.perimeter,
          aspectRatio: geom.aspectRatio,
          complexity: shape.complexity,
          strokeWidth: shape.strokeWidth
        });
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should process multiple images efficiently', async () => {
      const images = [mockComplexDrawing, mockComplexDrawing, mockComplexDrawing];
      const startTime = Date.now();

      const results = await Promise.all(images.map(async (image) => {
        const preprocessed = await imageProcessor.preprocessImageWithOpenCV(image, {
          enhanceContrast: true,
          reduceNoise: true
        });

        const symbols = await patternMatcher.detectSymbols(preprocessed.processed, {
          confidenceThreshold: 0.3,
          maxSymbols: 10
        });

        return symbols;
      }));

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(results.length).toBe(3);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });

      console.log(`Processed ${images.length} images in ${processingTime}ms`);

      // Should complete within reasonable time (20 seconds for 3 images)
      expect(processingTime).toBeLessThan(20000);
    });

    it('should handle memory efficiently with large images', async () => {
      // Create a larger image for memory testing
      const largeCanvas = createCanvas(1600, 1200);
      const ctx = largeCanvas.getContext('2d');
      
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 1600, 1200);
      
      // Add some complex content
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * 1500 + 50;
        const y = Math.random() * 1100 + 50;
        
        ctx.beginPath();
        ctx.arc(x, y, 20, 0, 2 * Math.PI);
        ctx.stroke();
      }
      
      const largeImage = largeCanvas.toBuffer('image/png');
      
      const startMemory = process.memoryUsage();
      
      const preprocessed = await imageProcessor.preprocessImageWithOpenCV(largeImage, {
        enhanceContrast: true,
        reduceNoise: true
      });

      const symbols = await patternMatcher.detectSymbols(preprocessed.processed, {
        confidenceThreshold: 0.5,
        maxSymbols: 5
      });

      const endMemory = process.memoryUsage();
      
      expect(symbols).toBeDefined();
      
      const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
      
      // Memory increase should be reasonable (less than 500MB)
      expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024);
    });
  });

  describe('Error Recovery and Robustness', () => {
    it('should recover from OpenCV failures', async () => {
      const corruptedImage = Buffer.from('corrupted-image-data');

      // Should not throw but use fallback mechanisms
      const preprocessed = await imageProcessor.preprocessImageWithOpenCV(corruptedImage);
      expect(preprocessed).toBeDefined();

      const symbols = await patternMatcher.detectSymbols(corruptedImage, {
        confidenceThreshold: 0.5,
        maxSymbols: 5
      });
      expect(symbols).toBeDefined();
    });

    it('should handle partial processing failures', async () => {
      // Test with edge case: very small image
      const tinyCanvas = createCanvas(10, 10);
      const ctx = tinyCanvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 10, 10);
      ctx.fillStyle = 'black';
      ctx.fillRect(2, 2, 6, 6);
      
      const tinyImage = tinyCanvas.toBuffer('image/png');

      const preprocessed = await imageProcessor.preprocessImageWithOpenCV(tinyImage);
      expect(preprocessed).toBeDefined();

      const symbols = await patternMatcher.detectSymbols(tinyImage, {
        confidenceThreshold: 0.1,
        maxSymbols: 1
      });
      expect(symbols).toBeDefined();
    });

    it('should maintain consistency across multiple runs', async () => {
      const runs = 3;
      const results = [];

      for (let i = 0; i < runs; i++) {
        const symbols = await patternMatcher.detectSymbols(mockComplexDrawing, {
          confidenceThreshold: 0.3,
          maxSymbols: 10
        });
        results.push(symbols.length);
      }

      // Results should be consistent (same number of symbols detected)
      const firstResult = results[0];
      results.forEach(result => {
        expect(result).toBe(firstResult);
      });
    });
  });

  describe('Integration with Symbol Detection Service', () => {
    it('should integrate with full symbol detection workflow', async () => {
      // This tests the integration with the main SymbolDetector service
      const detectionResult = await symbolDetector.detectSymbols(mockComplexDrawing, {
        confidenceThreshold: 0.3,
        maxSymbols: 20,
        methods: ['pattern_matching', 'ml_classification'],
        enableOpenCV: true // This would be a new option to enable OpenCV processing
      });

      expect(detectionResult).toBeDefined();
      expect(detectionResult.symbols).toBeDefined();
      expect(Array.isArray(detectionResult.symbols)).toBe(true);
      expect(detectionResult.processingTime).toBeDefined();
      expect(detectionResult.confidence).toBeDefined();
      
      if (detectionResult.symbols.length > 0) {
        detectionResult.symbols.forEach(symbol => {
          expect(symbol.detectionMethod).toBeDefined();
          expect(['pattern_matching', 'ml_classification', 'consensus']).toContain(symbol.detectionMethod);
        });
      }

      console.log(`Full symbol detection found ${detectionResult.symbols.length} symbols with confidence ${detectionResult.confidence}`);
    });
  });
});