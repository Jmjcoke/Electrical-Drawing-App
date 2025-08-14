/**
 * Comprehensive Unit Tests for Feature Extractor
 * Validates feature extraction algorithms for symbol analysis
 * Coverage Target: 80%+ for computer vision feature extraction
 */

import { FeatureExtractor } from '../feature-extractor';
import cv from '@u4/opencv4nodejs';
import { 
  DetectedSymbol,
  SymbolFeatures,
  GeometricProperties,
  ConnectionPoint,
  ShapeAnalysis
} from '../../../../../shared/types/symbol-detection.types';

// Mock OpenCV
jest.mock('@u4/opencv4nodejs');

describe('FeatureExtractor - Feature Extraction Tests', () => {
  let featureExtractor: FeatureExtractor;
  let mockMat: any;
  let mockContour: any;
  let mockSymbol: DetectedSymbol;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize extractor
    featureExtractor = new FeatureExtractor();

    // Setup mock Mat
    mockMat = {
      rows: 100,
      cols: 100,
      channels: 1,
      type: cv.CV_8UC1,
      at: jest.fn().mockReturnValue(255),
      getMat: jest.fn().mockReturnThis(),
      getDataAsArray: jest.fn().mockReturnValue(Array(100).fill(Array(100).fill(255))),
      moments: jest.fn().mockReturnValue({
        m00: 2500,
        m10: 125000,
        m01: 125000,
        m11: 6250000,
        m20: 8333333,
        m02: 8333333,
        mu20: 208333,
        mu11: 0,
        mu02: 208333,
        nu20: 0.0333,
        nu11: 0,
        nu02: 0.0333
      }),
      huMoments: jest.fn().mockReturnValue([
        0.166, 0.0027, 0.00013, 0.000017,
        2.9e-10, 5.7e-7, -3.1e-10
      ]),
      minAreaRect: jest.fn().mockReturnValue({
        center: { x: 50, y: 50 },
        size: { width: 60, height: 40 },
        angle: 15
      }),
      convexHull: jest.fn().mockReturnValue({
        getPoints: jest.fn().mockReturnValue([
          { x: 10, y: 10 },
          { x: 90, y: 10 },
          { x: 90, y: 90 },
          { x: 10, y: 90 }
        ])
      }),
      fitEllipse: jest.fn().mockReturnValue({
        center: { x: 50, y: 50 },
        size: { width: 70, height: 50 },
        angle: 0
      }),
      release: jest.fn()
    };

    // Setup mock contour
    mockContour = {
      area: 2500,
      arcLength: jest.fn().mockReturnValue(200),
      boundingRect: jest.fn().mockReturnValue({ 
        x: 20, y: 20, width: 60, height: 60 
      }),
      moments: jest.fn().mockReturnValue(mockMat.moments()),
      isConvex: jest.fn().mockReturnValue(false),
      approxPolyDP: jest.fn().mockReturnValue({
        rows: 4,
        getPoints: jest.fn().mockReturnValue([
          { x: 20, y: 20 },
          { x: 80, y: 20 },
          { x: 80, y: 80 },
          { x: 20, y: 80 }
        ])
      }),
      fitEllipse: mockMat.fitEllipse,
      minAreaRect: mockMat.minAreaRect,
      convexHull: mockMat.convexHull
    };

    // Setup mock symbol
    mockSymbol = {
      id: 'symbol-1',
      symbolType: 'resistor',
      symbolCategory: 'passive',
      description: 'Test resistor',
      confidence: 0.9,
      location: {
        x: 0.5,
        y: 0.5,
        pageNumber: 1,
        originalX: 50,
        originalY: 50,
        imageWidth: 1920,
        imageHeight: 1080
      },
      boundingBox: {
        x: 20,
        y: 20,
        width: 60,
        height: 60,
        area: 3600
      },
      detectionMethod: 'pattern_matching',
      features: {} as SymbolFeatures,
      validationScore: 0.85
    };

    // Mock cv functions
    (cv.imread as jest.Mock) = jest.fn().mockReturnValue(mockMat);
    (cv.findContours as jest.Mock) = jest.fn().mockReturnValue({
      contours: [mockContour]
    });
  });

  describe('1. Contour Feature Extraction', () => {
    it('should extract contour points correctly', async () => {
      const features = await featureExtractor.extractContourFeatures(mockContour);

      expect(features.contourPoints).toBeDefined();
      expect(features.contourPoints.length).toBeGreaterThan(0);
      expect(features.contourPoints[0]).toHaveProperty('x');
      expect(features.contourPoints[0]).toHaveProperty('y');
    });

    it('should calculate contour properties', async () => {
      const features = await featureExtractor.extractContourFeatures(mockContour);

      expect(features.area).toBe(2500);
      expect(features.perimeter).toBe(200);
      expect(features.circularity).toBeDefined();
      expect(features.circularity).toBeGreaterThan(0);
      expect(features.circularity).toBeLessThanOrEqual(1);
    });

    it('should approximate polygon shapes', async () => {
      const features = await featureExtractor.extractContourFeatures(mockContour);

      expect(features.approxVertices).toBe(4);
      expect(features.shapeType).toBeDefined();
      expect(['rectangle', 'square', 'triangle', 'circle', 'polygon'].includes(features.shapeType)).toBe(true);
    });

    it('should detect convexity', async () => {
      // Test convex shape
      mockContour.isConvex.mockReturnValueOnce(true);
      const convexFeatures = await featureExtractor.extractContourFeatures(mockContour);
      expect(convexFeatures.isConvex).toBe(true);

      // Test concave shape
      mockContour.isConvex.mockReturnValueOnce(false);
      const concaveFeatures = await featureExtractor.extractContourFeatures(mockContour);
      expect(concaveFeatures.isConvex).toBe(false);
    });

    it('should calculate solidity', async () => {
      const features = await featureExtractor.extractContourFeatures(mockContour);

      expect(features.solidity).toBeDefined();
      expect(features.solidity).toBeGreaterThan(0);
      expect(features.solidity).toBeLessThanOrEqual(1);
    });
  });

  describe('2. Geometric Properties Extraction', () => {
    it('should extract geometric properties', async () => {
      const properties = await featureExtractor.extractGeometricProperties(mockSymbol, mockMat);

      expect(properties).toBeDefined();
      expect(properties.area).toBeGreaterThan(0);
      expect(properties.perimeter).toBeGreaterThan(0);
      expect(properties.centroid).toBeDefined();
      expect(properties.centroid.x).toBe(50);
      expect(properties.centroid.y).toBe(50);
    });

    it('should calculate bounding rectangle', async () => {
      const properties = await featureExtractor.extractGeometricProperties(mockSymbol, mockMat);

      expect(properties.boundaryRectangle).toBeDefined();
      expect(properties.boundaryRectangle.x).toBe(20);
      expect(properties.boundaryRectangle.y).toBe(20);
      expect(properties.boundaryRectangle.width).toBe(60);
      expect(properties.boundaryRectangle.height).toBe(60);
    });

    it('should calculate aspect ratio', async () => {
      const properties = await featureExtractor.extractGeometricProperties(mockSymbol, mockMat);

      expect(properties.aspectRatio).toBeDefined();
      expect(properties.aspectRatio).toBe(1); // Square shape
    });

    it('should detect symmetry axes', async () => {
      const properties = await featureExtractor.extractGeometricProperties(mockSymbol, mockMat);

      expect(properties.symmetryAxes).toBeDefined();
      expect(Array.isArray(properties.symmetryAxes)).toBe(true);
      
      // For a square/rectangle, should detect vertical and horizontal symmetry
      const hasVerticalSymmetry = properties.symmetryAxes.some(
        axis => axis.type === 'vertical'
      );
      const hasHorizontalSymmetry = properties.symmetryAxes.some(
        axis => axis.type === 'horizontal'
      );
      
      expect(hasVerticalSymmetry || hasHorizontalSymmetry).toBe(true);
    });

    it('should calculate minimum enclosing circle', async () => {
      const properties = await featureExtractor.extractGeometricProperties(mockSymbol, mockMat);

      expect(properties.enclosingCircle).toBeDefined();
      expect(properties.enclosingCircle.center).toBeDefined();
      expect(properties.enclosingCircle.radius).toBeGreaterThan(0);
    });

    it('should fit ellipse to shape', async () => {
      const properties = await featureExtractor.extractGeometricProperties(mockSymbol, mockMat);

      expect(properties.fittedEllipse).toBeDefined();
      expect(properties.fittedEllipse.center).toBeDefined();
      expect(properties.fittedEllipse.majorAxis).toBeGreaterThan(0);
      expect(properties.fittedEllipse.minorAxis).toBeGreaterThan(0);
      expect(properties.fittedEllipse.angle).toBeDefined();
    });
  });

  describe('3. Connection Point Detection', () => {
    it('should detect connection points', async () => {
      const connectionPoints = await featureExtractor.detectConnectionPoints(mockSymbol, mockMat);

      expect(connectionPoints).toBeDefined();
      expect(Array.isArray(connectionPoints)).toBe(true);
      expect(connectionPoints.length).toBeGreaterThan(0);
    });

    it('should classify connection point types', async () => {
      const connectionPoints = await featureExtractor.detectConnectionPoints(mockSymbol, mockMat);

      connectionPoints.forEach(point => {
        expect(point.type).toBeDefined();
        expect(['input', 'output', 'bidirectional', 'ground'].includes(point.type)).toBe(true);
      });
    });

    it('should detect terminal points for resistor', async () => {
      mockSymbol.symbolType = 'resistor';
      const connectionPoints = await featureExtractor.detectConnectionPoints(mockSymbol, mockMat);

      // Resistor should have exactly 2 terminals
      expect(connectionPoints).toHaveLength(2);
      expect(connectionPoints.every(p => p.type === 'bidirectional')).toBe(true);
    });

    it('should detect terminals for transistor', async () => {
      mockSymbol.symbolType = 'transistor';
      const connectionPoints = await featureExtractor.detectConnectionPoints(mockSymbol, mockMat);

      // Transistor should have 3 terminals (base, collector, emitter)
      expect(connectionPoints.length).toBeGreaterThanOrEqual(3);
    });

    it('should detect ground connection', async () => {
      mockSymbol.symbolType = 'ground';
      const connectionPoints = await featureExtractor.detectConnectionPoints(mockSymbol, mockMat);

      expect(connectionPoints.some(p => p.type === 'ground')).toBe(true);
    });

    it('should calculate connection point confidence', async () => {
      const connectionPoints = await featureExtractor.detectConnectionPoints(mockSymbol, mockMat);

      connectionPoints.forEach(point => {
        expect(point.confidence).toBeDefined();
        expect(point.confidence).toBeGreaterThan(0);
        expect(point.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('4. Shape Analysis', () => {
    it('should analyze shape complexity', async () => {
      const analysis = await featureExtractor.analyzeShape(mockContour, mockMat);

      expect(analysis.complexity).toBeDefined();
      expect(analysis.complexity).toBeGreaterThanOrEqual(0);
      expect(analysis.complexity).toBeLessThanOrEqual(1);
    });

    it('should measure shape symmetry', async () => {
      const analysis = await featureExtractor.analyzeShape(mockContour, mockMat);

      expect(analysis.symmetry).toBeDefined();
      expect(analysis.symmetry).toBeGreaterThanOrEqual(0);
      expect(analysis.symmetry).toBeLessThanOrEqual(1);
    });

    it('should calculate shape regularity', async () => {
      const analysis = await featureExtractor.analyzeShape(mockContour, mockMat);

      expect(analysis.regularity).toBeDefined();
      expect(analysis.regularity).toBeGreaterThanOrEqual(0);
      expect(analysis.regularity).toBeLessThanOrEqual(1);
    });

    it('should detect shape patterns', async () => {
      const analysis = await featureExtractor.analyzeShape(mockContour, mockMat);

      expect(analysis.patterns).toBeDefined();
      expect(Array.isArray(analysis.patterns)).toBe(true);
      
      // Check for common patterns
      const validPatterns = ['zigzag', 'coil', 'box', 'triangle', 'circle', 'line'];
      analysis.patterns.forEach(pattern => {
        expect(validPatterns.includes(pattern)).toBe(true);
      });
    });

    it('should calculate compactness', async () => {
      const analysis = await featureExtractor.analyzeShape(mockContour, mockMat);

      expect(analysis.compactness).toBeDefined();
      expect(analysis.compactness).toBeGreaterThan(0);
      // Compactness = perimeter^2 / (4 * PI * area)
      // For a circle, compactness = 1
      expect(analysis.compactness).toBeGreaterThanOrEqual(1);
    });
  });

  describe('5. Hu Moments Calculation', () => {
    it('should calculate Hu moments', async () => {
      const huMoments = await featureExtractor.calculateHuMoments(mockContour);

      expect(huMoments).toBeDefined();
      expect(huMoments).toHaveLength(7);
      huMoments.forEach(moment => {
        expect(typeof moment).toBe('number');
        expect(isFinite(moment)).toBe(true);
      });
    });

    it('should normalize Hu moments', async () => {
      const huMoments = await featureExtractor.calculateHuMoments(mockContour);
      
      // Hu moments should be scale, rotation, and translation invariant
      // Check that values are in reasonable range (log scale)
      huMoments.forEach(moment => {
        const logMoment = -Math.sign(moment) * Math.log10(Math.abs(moment) + 1e-10);
        expect(Math.abs(logMoment)).toBeLessThan(20);
      });
    });

    it('should handle different shapes differently', async () => {
      // Circle contour
      const circleContour = {
        ...mockContour,
        approxPolyDP: jest.fn().mockReturnValue({ rows: 20 })
      };
      const circleMoments = await featureExtractor.calculateHuMoments(circleContour);

      // Rectangle contour
      const rectContour = {
        ...mockContour,
        approxPolyDP: jest.fn().mockReturnValue({ rows: 4 })
      };
      const rectMoments = await featureExtractor.calculateHuMoments(rectContour);

      // Moments should be different for different shapes
      expect(circleMoments[0]).not.toBeCloseTo(rectMoments[0], 2);
    });
  });

  describe('6. Texture and Pattern Features', () => {
    it('should extract texture features', async () => {
      const features = await featureExtractor.extractTextureFeatures(mockMat);

      expect(features).toBeDefined();
      expect(features.contrast).toBeDefined();
      expect(features.homogeneity).toBeDefined();
      expect(features.energy).toBeDefined();
      expect(features.correlation).toBeDefined();
    });

    it('should calculate local binary patterns', async () => {
      const lbp = await featureExtractor.calculateLBP(mockMat);

      expect(lbp).toBeDefined();
      expect(lbp.histogram).toBeDefined();
      expect(lbp.histogram).toHaveLength(256);
      expect(lbp.uniformPatterns).toBeDefined();
    });

    it('should detect line patterns', async () => {
      const patterns = await featureExtractor.detectLinePatterns(mockMat);

      expect(patterns).toBeDefined();
      expect(patterns.horizontal).toBeDefined();
      expect(patterns.vertical).toBeDefined();
      expect(patterns.diagonal).toBeDefined();
      expect(patterns.curved).toBeDefined();
    });
  });

  describe('7. Symbol-Specific Features', () => {
    it('should extract resistor-specific features', async () => {
      mockSymbol.symbolType = 'resistor';
      const features = await featureExtractor.extractSymbolSpecificFeatures(mockSymbol, mockMat);

      expect(features.zigzagCount).toBeDefined();
      expect(features.zigzagAmplitude).toBeDefined();
      expect(features.terminalSeparation).toBeDefined();
    });

    it('should extract capacitor-specific features', async () => {
      mockSymbol.symbolType = 'capacitor';
      const features = await featureExtractor.extractSymbolSpecificFeatures(mockSymbol, mockMat);

      expect(features.plateSeparation).toBeDefined();
      expect(features.plateParallelism).toBeDefined();
      expect(features.isPolarized).toBeDefined();
    });

    it('should extract inductor-specific features', async () => {
      mockSymbol.symbolType = 'inductor';
      const features = await featureExtractor.extractSymbolSpecificFeatures(mockSymbol, mockMat);

      expect(features.coilCount).toBeDefined();
      expect(features.coilSpacing).toBeDefined();
      expect(features.hasCore).toBeDefined();
    });

    it('should extract transistor-specific features', async () => {
      mockSymbol.symbolType = 'transistor';
      const features = await featureExtractor.extractSymbolSpecificFeatures(mockSymbol, mockMat);

      expect(features.transistorType).toBeDefined();
      expect(['npn', 'pnp', 'fet', 'mosfet'].includes(features.transistorType)).toBe(true);
      expect(features.hasArrow).toBeDefined();
      expect(features.terminalConfiguration).toBeDefined();
    });

    it('should extract IC-specific features', async () => {
      mockSymbol.symbolType = 'integrated_circuit';
      const features = await featureExtractor.extractSymbolSpecificFeatures(mockSymbol, mockMat);

      expect(features.pinCount).toBeDefined();
      expect(features.packageType).toBeDefined();
      expect(features.pinConfiguration).toBeDefined();
    });
  });

  describe('8. Feature Normalization and Scaling', () => {
    it('should normalize feature vectors', async () => {
      const features = await featureExtractor.extractContourFeatures(mockContour);
      const normalized = featureExtractor.normalizeFeatures(features);

      // Check all numeric features are normalized to [0, 1]
      Object.values(normalized).forEach(value => {
        if (typeof value === 'number') {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      });
    });

    it('should create feature vectors for ML', async () => {
      const features = await featureExtractor.extractAllFeatures(mockSymbol, mockMat);
      const vector = featureExtractor.createFeatureVector(features);

      expect(vector).toBeDefined();
      expect(Array.isArray(vector)).toBe(true);
      expect(vector.length).toBeGreaterThan(0);
      expect(vector.every(v => typeof v === 'number')).toBe(true);
    });

    it('should handle missing features gracefully', async () => {
      const incompleteFeatures = {
        area: 100,
        perimeter: undefined,
        centroid: null
      };

      const vector = featureExtractor.createFeatureVector(incompleteFeatures as any);
      
      expect(vector).toBeDefined();
      expect(vector.includes(NaN)).toBe(false);
      expect(vector.includes(undefined)).toBe(false);
    });
  });

  describe('9. Performance Optimization', () => {
    it('should cache computed features', async () => {
      const features1 = await featureExtractor.extractAllFeatures(mockSymbol, mockMat);
      const features2 = await featureExtractor.extractAllFeatures(mockSymbol, mockMat);

      // Should return cached result
      expect(features2).toEqual(features1);
      expect(mockContour.moments).toHaveBeenCalledTimes(1); // Called only once
    });

    it('should handle batch feature extraction', async () => {
      const symbols = Array.from({ length: 10 }, (_, i) => ({
        ...mockSymbol,
        id: `symbol-${i}`
      }));

      const startTime = Date.now();
      const features = await Promise.all(
        symbols.map(s => featureExtractor.extractAllFeatures(s, mockMat))
      );
      const processingTime = Date.now() - startTime;

      expect(features).toHaveLength(10);
      expect(processingTime).toBeLessThan(1000); // Should be fast
    });
  });

  describe('10. Error Handling', () => {
    it('should handle invalid contours', async () => {
      const invalidContour = null;
      
      await expect(
        featureExtractor.extractContourFeatures(invalidContour as any)
      ).rejects.toThrow('Invalid contour');
    });

    it('should handle empty images', async () => {
      const emptyMat = {
        ...mockMat,
        rows: 0,
        cols: 0,
        empty: true
      };

      await expect(
        featureExtractor.extractGeometricProperties(mockSymbol, emptyMat)
      ).rejects.toThrow('Empty image');
    });

    it('should handle computation failures gracefully', async () => {
      mockContour.moments.mockImplementationOnce(() => {
        throw new Error('Moments calculation failed');
      });

      const features = await featureExtractor.extractContourFeatures(mockContour);
      
      // Should return partial features or defaults
      expect(features).toBeDefined();
      expect(features.area).toBe(2500); // From contour.area
    });
  });
});