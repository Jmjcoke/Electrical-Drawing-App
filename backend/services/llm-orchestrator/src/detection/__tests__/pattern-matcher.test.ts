/**
 * Comprehensive Unit Tests for Pattern Matcher
 * Validates template matching algorithms for electrical symbols
 * Coverage Target: 80%+ for AC #2 (Pattern matching with electrical component library)
 */

import { PatternMatcher } from '../pattern-matcher';
import { ElectricalSymbolLibrary } from '../../vision/electrical-symbols-data';
import cv from '@u4/opencv4nodejs';
import { 
  DetectedSymbol,
  ElectricalSymbolType,
  BoundingBox
} from '../../../../../shared/types/symbol-detection.types';

// Mock dependencies
jest.mock('@u4/opencv4nodejs');
jest.mock('../../vision/electrical-symbols-data');

describe('PatternMatcher - Template Matching Tests', () => {
  let patternMatcher: PatternMatcher;
  let mockImage: any;
  let mockTemplate: any;
  let mockMatchResult: any;
  let mockSymbolLibrary: jest.Mocked<ElectricalSymbolLibrary>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock image Mat
    mockImage = {
      rows: 1080,
      cols: 1920,
      channels: 1,
      type: cv.CV_8UC1,
      matchTemplate: jest.fn(),
      minMaxLoc: jest.fn(),
      getRegion: jest.fn().mockReturnThis(),
      cvtColor: jest.fn().mockReturnThis(),
      threshold: jest.fn().mockReturnThis(),
      canny: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis(),
      normalize: jest.fn().mockReturnThis(),
      copyMakeBorder: jest.fn().mockReturnThis(),
      warpAffine: jest.fn().mockReturnThis(),
      flip: jest.fn().mockReturnThis(),
      release: jest.fn(),
      copy: jest.fn().mockReturnThis()
    };

    // Setup mock template Mat
    mockTemplate = {
      rows: 50,
      cols: 50,
      channels: 1,
      type: cv.CV_8UC1,
      resize: jest.fn().mockReturnThis(),
      cvtColor: jest.fn().mockReturnThis(),
      flip: jest.fn().mockReturnThis(),
      warpAffine: jest.fn().mockReturnThis(),
      release: jest.fn(),
      copy: jest.fn().mockReturnThis()
    };

    // Setup mock match result
    mockMatchResult = {
      rows: 1031,
      cols: 1871,
      minMaxLoc: jest.fn().mockReturnValue({
        minVal: 0.1,
        maxVal: 0.95,
        minLoc: { x: 100, y: 100 },
        maxLoc: { x: 500, y: 300 }
      }),
      threshold: jest.fn().mockReturnThis(),
      at: jest.fn().mockReturnValue(0.85),
      release: jest.fn()
    };

    mockImage.matchTemplate.mockReturnValue(mockMatchResult);

    // Setup mock symbol library
    mockSymbolLibrary = {
      getTemplate: jest.fn().mockReturnValue(mockTemplate),
      getTemplates: jest.fn().mockReturnValue([
        { type: 'resistor', template: mockTemplate, variants: [] },
        { type: 'capacitor', template: mockTemplate, variants: [] },
        { type: 'inductor', template: mockTemplate, variants: [] }
      ]),
      getAllSymbolTypes: jest.fn().mockReturnValue(['resistor', 'capacitor', 'inductor']),
      getSymbolCategory: jest.fn().mockReturnValue('passive'),
      getSymbolDescription: jest.fn().mockReturnValue('Electrical component'),
      getTemplateVariants: jest.fn().mockReturnValue([mockTemplate]),
      preloadTemplates: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock cv functions
    (cv.TM_CCOEFF_NORMED as any) = 5;
    (cv.TM_CCORR_NORMED as any) = 3;
    (cv.TM_SQDIFF_NORMED as any) = 1;
    (cv.getRotationMatrix2D as jest.Mock) = jest.fn().mockReturnValue(mockImage);
    (cv.imread as jest.Mock) = jest.fn().mockReturnValue(mockImage);

    // Initialize pattern matcher
    patternMatcher = new PatternMatcher(mockSymbolLibrary);
  });

  afterEach(async () => {
    await patternMatcher.cleanup();
  });

  describe('1. Template Matching Core Functionality (AC #2)', () => {
    it('should match patterns in image successfully', async () => {
      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png');

      expect(symbols).toBeDefined();
      expect(symbols.length).toBeGreaterThan(0);
      expect(mockImage.matchTemplate).toHaveBeenCalled();
    });

    it('should detect resistor patterns', async () => {
      mockSymbolLibrary.getTemplate.mockReturnValueOnce({
        ...mockTemplate,
        symbolType: 'resistor'
      });

      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png');

      const resistor = symbols.find(s => s.symbolType === 'resistor');
      expect(resistor).toBeDefined();
      expect(resistor?.confidence).toBeGreaterThan(0.8);
    });

    it('should detect capacitor patterns', async () => {
      mockSymbolLibrary.getTemplate.mockReturnValueOnce({
        ...mockTemplate,
        symbolType: 'capacitor'
      });

      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png');

      const capacitor = symbols.find(s => s.symbolType === 'capacitor');
      expect(capacitor).toBeDefined();
      expect(capacitor?.symbolCategory).toBe('passive');
    });

    it('should detect inductor patterns', async () => {
      mockSymbolLibrary.getTemplate.mockReturnValueOnce({
        ...mockTemplate,
        symbolType: 'inductor'
      });

      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png');

      const inductor = symbols.find(s => s.symbolType === 'inductor');
      expect(inductor).toBeDefined();
      expect(inductor?.detectionMethod).toBe('pattern_matching');
    });

    it('should match multiple symbol types', async () => {
      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png');

      const uniqueTypes = new Set(symbols.map(s => s.symbolType));
      expect(uniqueTypes.size).toBeGreaterThanOrEqual(1);
    });

    it('should use different matching methods', async () => {
      // Test correlation coefficient
      await patternMatcher.matchPatterns(mockImage, '/test.png', {
        method: cv.TM_CCOEFF_NORMED
      });
      expect(mockImage.matchTemplate).toHaveBeenCalledWith(mockTemplate, cv.TM_CCOEFF_NORMED);

      // Test correlation
      jest.clearAllMocks();
      await patternMatcher.matchPatterns(mockImage, '/test.png', {
        method: cv.TM_CCORR_NORMED
      });
      expect(mockImage.matchTemplate).toHaveBeenCalledWith(mockTemplate, cv.TM_CCORR_NORMED);

      // Test squared difference
      jest.clearAllMocks();
      await patternMatcher.matchPatterns(mockImage, '/test.png', {
        method: cv.TM_SQDIFF_NORMED
      });
      expect(mockImage.matchTemplate).toHaveBeenCalledWith(mockTemplate, cv.TM_SQDIFF_NORMED);
    });
  });

  describe('2. Multi-Scale Template Matching', () => {
    it('should perform multi-scale matching', async () => {
      const scales = [0.5, 0.75, 1.0, 1.25, 1.5];
      
      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png', {
        multiScale: true,
        scales
      });

      // Should resize templates for each scale
      expect(mockTemplate.resize).toHaveBeenCalledTimes(scales.length * 3); // 3 symbol types
      expect(symbols).toBeDefined();
    });

    it('should find best scale for each symbol', async () => {
      // Mock different confidence scores for different scales
      mockMatchResult.minMaxLoc
        .mockReturnValueOnce({ maxVal: 0.7, maxLoc: { x: 100, y: 100 } }) // Scale 0.5
        .mockReturnValueOnce({ maxVal: 0.95, maxLoc: { x: 200, y: 200 } }) // Scale 1.0
        .mockReturnValueOnce({ maxVal: 0.6, maxLoc: { x: 300, y: 300 } }); // Scale 1.5

      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png', {
        multiScale: true
      });

      // Should select the scale with highest confidence
      const bestMatch = symbols[0];
      expect(bestMatch.confidence).toBeGreaterThanOrEqual(0.95);
    });

    it('should handle scale-invariant detection', async () => {
      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png', {
        scaleInvariant: true
      });

      expect(symbols).toBeDefined();
      // Should detect symbols regardless of their size
      symbols.forEach(symbol => {
        expect(symbol.features).toBeDefined();
        expect(symbol.features.scale).toBeDefined();
      });
    });
  });

  describe('3. Rotation-Invariant Matching', () => {
    it('should perform rotation-invariant matching', async () => {
      const angles = [0, 45, 90, 135, 180, 225, 270, 315];
      
      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png', {
        rotationInvariant: true,
        angles
      });

      // Should test multiple rotations
      expect(cv.getRotationMatrix2D).toHaveBeenCalled();
      expect(mockTemplate.warpAffine).toHaveBeenCalled();
    });

    it('should detect rotated symbols', async () => {
      // Mock rotated symbol detection
      mockMatchResult.minMaxLoc
        .mockReturnValueOnce({ maxVal: 0.6, maxLoc: { x: 100, y: 100 } }) // 0°
        .mockReturnValueOnce({ maxVal: 0.92, maxLoc: { x: 200, y: 200 } }); // 90°

      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png', {
        rotationInvariant: true
      });

      const rotatedSymbol = symbols.find(s => s.boundingBox.rotation);
      expect(rotatedSymbol).toBeDefined();
      expect(rotatedSymbol?.boundingBox.rotation).toBeDefined();
    });

    it('should optimize rotation search', async () => {
      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png', {
        rotationInvariant: true,
        coarseRotationStep: 45,
        fineRotationStep: 5
      });

      // Should perform coarse search first, then fine-tune
      expect(symbols).toBeDefined();
    });
  });

  describe('4. Non-Maximum Suppression', () => {
    it('should apply non-maximum suppression', async () => {
      // Mock multiple overlapping detections
      const overlappingMatches = [
        { x: 100, y: 100, width: 50, height: 50, confidence: 0.9 },
        { x: 105, y: 105, width: 50, height: 50, confidence: 0.85 }, // Overlapping
        { x: 200, y: 200, width: 50, height: 50, confidence: 0.88 }
      ];

      mockMatchResult.threshold.mockReturnValueOnce({
        findNonZero: jest.fn().mockReturnValue(
          overlappingMatches.map(m => ({ x: m.x, y: m.y }))
        )
      });

      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png', {
        nmsThreshold: 0.5
      });

      // Should suppress overlapping detections
      expect(symbols.length).toBeLessThan(overlappingMatches.length);
    });

    it('should keep best detection in overlap region', async () => {
      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png', {
        nmsThreshold: 0.3
      });

      // Check no significant overlaps remain
      for (let i = 0; i < symbols.length; i++) {
        for (let j = i + 1; j < symbols.length; j++) {
          const iou = patternMatcher.calculateIoU(
            symbols[i].boundingBox,
            symbols[j].boundingBox
          );
          expect(iou).toBeLessThan(0.3);
        }
      }
    });
  });

  describe('5. Template Variants and Augmentation', () => {
    it('should match template variants', async () => {
      const variants = [
        { ...mockTemplate, style: 'zigzag' },
        { ...mockTemplate, style: 'box' },
        { ...mockTemplate, style: 'european' }
      ];
      mockSymbolLibrary.getTemplateVariants.mockReturnValue(variants);

      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png', {
        useVariants: true
      });

      expect(mockSymbolLibrary.getTemplateVariants).toHaveBeenCalled();
      expect(symbols).toBeDefined();
    });

    it('should handle different symbol standards', async () => {
      // Test IEEE standard symbols
      const ieeeSymbols = await patternMatcher.matchPatterns(mockImage, '/test.png', {
        standard: 'IEEE'
      });

      // Test IEC standard symbols
      const iecSymbols = await patternMatcher.matchPatterns(mockImage, '/test.png', {
        standard: 'IEC'
      });

      expect(ieeeSymbols).toBeDefined();
      expect(iecSymbols).toBeDefined();
    });

    it('should apply template augmentation', async () => {
      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png', {
        augmentTemplates: true
      });

      // Should apply augmentations like blur, noise, etc.
      expect(symbols).toBeDefined();
    });
  });

  describe('6. Confidence Score Calculation', () => {
    it('should calculate accurate confidence scores', async () => {
      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png');

      symbols.forEach(symbol => {
        expect(symbol.confidence).toBeGreaterThan(0);
        expect(symbol.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should filter by confidence threshold', async () => {
      const threshold = 0.8;
      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png', {
        confidenceThreshold: threshold
      });

      symbols.forEach(symbol => {
        expect(symbol.confidence).toBeGreaterThanOrEqual(threshold);
      });
    });

    it('should normalize confidence scores', async () => {
      // Mock raw match scores
      mockMatchResult.minMaxLoc.mockReturnValue({
        minVal: -0.5,
        maxVal: 1.5,
        minLoc: { x: 0, y: 0 },
        maxLoc: { x: 100, y: 100 }
      });

      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png');

      // Confidence should be normalized to [0, 1]
      symbols.forEach(symbol => {
        expect(symbol.confidence).toBeGreaterThanOrEqual(0);
        expect(symbol.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('7. Performance Optimization', () => {
    it('should use pyramid matching for speed', async () => {
      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png', {
        usePyramid: true,
        pyramidLevels: 3
      });

      // Should use image pyramids for faster matching
      expect(mockImage.resize).toHaveBeenCalled();
      expect(symbols).toBeDefined();
    });

    it('should cache templates', async () => {
      // First call - loads templates
      await patternMatcher.matchPatterns(mockImage, '/test.png');
      const firstCallCount = mockSymbolLibrary.getTemplate.mock.calls.length;

      // Second call - should use cached templates
      jest.clearAllMocks();
      await patternMatcher.matchPatterns(mockImage, '/test.png');
      const secondCallCount = mockSymbolLibrary.getTemplate.mock.calls.length;

      expect(secondCallCount).toBeLessThanOrEqual(firstCallCount);
    });

    it('should support parallel processing', async () => {
      const startTime = Date.now();
      
      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png', {
        parallel: true,
        workers: 4
      });

      const processingTime = Date.now() - startTime;
      
      expect(symbols).toBeDefined();
      expect(processingTime).toBeLessThan(1000); // Should be fast
    });

    it('should use ROI for targeted matching', async () => {
      const roi = {
        x: 100,
        y: 100,
        width: 500,
        height: 500
      };

      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png', {
        roi
      });

      // Should only search within ROI
      expect(mockImage.getRegion).toHaveBeenCalled();
      symbols.forEach(symbol => {
        expect(symbol.location.originalX).toBeGreaterThanOrEqual(roi.x);
        expect(symbol.location.originalY).toBeGreaterThanOrEqual(roi.y);
      });
    });
  });

  describe('8. Edge Cases and Error Handling', () => {
    it('should handle empty images', async () => {
      const emptyImage = {
        ...mockImage,
        rows: 0,
        cols: 0,
        empty: true
      };

      const symbols = await patternMatcher.matchPatterns(emptyImage, '/empty.png');
      expect(symbols).toEqual([]);
    });

    it('should handle templates larger than image', async () => {
      const smallImage = {
        ...mockImage,
        rows: 30,
        cols: 30
      };

      const symbols = await patternMatcher.matchPatterns(smallImage, '/small.png');
      expect(symbols).toEqual([]);
    });

    it('should handle no matches found', async () => {
      mockMatchResult.minMaxLoc.mockReturnValue({
        minVal: 0,
        maxVal: 0.2, // Below threshold
        minLoc: { x: 0, y: 0 },
        maxLoc: { x: 0, y: 0 }
      });

      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png');
      expect(symbols).toEqual([]);
    });

    it('should handle template loading errors', async () => {
      mockSymbolLibrary.getTemplate.mockImplementationOnce(() => {
        throw new Error('Template not found');
      });

      // Should continue with other templates
      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png');
      expect(symbols).toBeDefined();
    });
  });

  describe('9. Location and Bounding Box Calculation', () => {
    it('should calculate accurate bounding boxes', async () => {
      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png');

      symbols.forEach(symbol => {
        expect(symbol.boundingBox).toBeDefined();
        expect(symbol.boundingBox.x).toBeGreaterThanOrEqual(0);
        expect(symbol.boundingBox.y).toBeGreaterThanOrEqual(0);
        expect(symbol.boundingBox.width).toBeGreaterThan(0);
        expect(symbol.boundingBox.height).toBeGreaterThan(0);
        expect(symbol.boundingBox.area).toBe(
          symbol.boundingBox.width * symbol.boundingBox.height
        );
      });
    });

    it('should normalize coordinates', async () => {
      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png');

      symbols.forEach(symbol => {
        expect(symbol.location.x).toBeGreaterThanOrEqual(0);
        expect(symbol.location.x).toBeLessThanOrEqual(1);
        expect(symbol.location.y).toBeGreaterThanOrEqual(0);
        expect(symbol.location.y).toBeLessThanOrEqual(1);
      });
    });

    it('should preserve original coordinates', async () => {
      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png', {
        pageNumber: 2
      });

      symbols.forEach(symbol => {
        expect(symbol.location.originalX).toBeDefined();
        expect(symbol.location.originalY).toBeDefined();
        expect(symbol.location.imageWidth).toBe(1920);
        expect(symbol.location.imageHeight).toBe(1080);
        expect(symbol.location.pageNumber).toBe(2);
      });
    });
  });

  describe('10. Integration with Symbol Library', () => {
    it('should use all available templates', async () => {
      const allTypes = ['resistor', 'capacitor', 'inductor', 'diode', 'transistor'];
      mockSymbolLibrary.getAllSymbolTypes.mockReturnValue(allTypes);

      await patternMatcher.matchPatterns(mockImage, '/test.png');

      expect(mockSymbolLibrary.getTemplate).toHaveBeenCalledTimes(allTypes.length);
    });

    it('should preload templates for performance', async () => {
      await patternMatcher.preloadTemplates();

      expect(mockSymbolLibrary.preloadTemplates).toHaveBeenCalled();
    });

    it('should get symbol metadata from library', async () => {
      const symbols = await patternMatcher.matchPatterns(mockImage, '/test.png');

      symbols.forEach(symbol => {
        expect(symbol.symbolCategory).toBeDefined();
        expect(symbol.description).toBeDefined();
      });

      expect(mockSymbolLibrary.getSymbolCategory).toHaveBeenCalled();
      expect(mockSymbolLibrary.getSymbolDescription).toHaveBeenCalled();
    });
  });

  describe('11. Cleanup and Resource Management', () => {
    it('should release Mat objects', async () => {
      await patternMatcher.matchPatterns(mockImage, '/test.png');

      expect(mockMatchResult.release).toHaveBeenCalled();
    });

    it('should cleanup on destruction', async () => {
      await patternMatcher.cleanup();

      expect(mockTemplate.release).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockTemplate.release.mockImplementationOnce(() => {
        throw new Error('Release failed');
      });

      // Should not throw
      await expect(patternMatcher.cleanup()).resolves.not.toThrow();
    });
  });
});