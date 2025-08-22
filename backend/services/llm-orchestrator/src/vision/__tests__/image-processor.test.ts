/**
 * Comprehensive Unit Tests for Image Processor
 * Validates computer vision algorithms and image processing pipeline
 * Coverage Target: 80%+ for AC #1 (Computer vision pipeline)
 */

import { ImageProcessor } from '../image-processor';
import cv from '@u4/opencv4nodejs';
import * as fs from 'fs';
import * as path from 'path';
import { ImageQuality } from '../../../../../shared/types/symbol-detection.types';

// Mock dependencies
jest.mock('@u4/opencv4nodejs');
jest.mock('fs');
jest.mock('sharp');

describe('ImageProcessor - Computer Vision Tests', () => {
  let imageProcessor: ImageProcessor;
  let mockMat: any;
  let mockContours: any[];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize processor
    imageProcessor = new ImageProcessor();

    // Setup OpenCV Mat mock
    mockMat = {
      rows: 1080,
      cols: 1920,
      channels: 3,
      type: cv.CV_8UC3,
      cvtColor: jest.fn().mockReturnThis(),
      bilateralFilter: jest.fn().mockReturnThis(),
      gaussianBlur: jest.fn().mockReturnThis(),
      threshold: jest.fn().mockReturnThis(),
      adaptiveThreshold: jest.fn().mockReturnThis(),
      morphologyEx: jest.fn().mockReturnThis(),
      canny: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis(),
      normalize: jest.fn().mockReturnThis(),
      convertTo: jest.fn().mockReturnThis(),
      findContours: jest.fn(),
      drawContours: jest.fn(),
      release: jest.fn(),
      copy: jest.fn().mockReturnThis(),
      getRegion: jest.fn().mockReturnThis(),
      getData: jest.fn().mockReturnValue(Buffer.from('image-data')),
      empty: false,
      sizes: [1080, 1920]
    };

    // Setup contours mock
    mockContours = [
      {
        area: 2500,
        arcLength: jest.fn().mockReturnValue(200),
        boundingRect: jest.fn().mockReturnValue({ x: 100, y: 100, width: 50, height: 50 }),
        moments: jest.fn().mockReturnValue({ m00: 2500, m10: 250000, m01: 250000 }),
        isConvex: jest.fn().mockReturnValue(true),
        approxPolyDP: jest.fn().mockReturnValue({ rows: 4 })
      },
      {
        area: 3600,
        arcLength: jest.fn().mockReturnValue(240),
        boundingRect: jest.fn().mockReturnValue({ x: 200, y: 200, width: 60, height: 60 }),
        moments: jest.fn().mockReturnValue({ m00: 3600, m10: 720000, m01: 720000 }),
        isConvex: jest.fn().mockReturnValue(false),
        approxPolyDP: jest.fn().mockReturnValue({ rows: 8 })
      }
    ];

    mockMat.findContours.mockReturnValue({ contours: mockContours });

    // Mock cv functions
    (cv.imread as jest.Mock) = jest.fn().mockReturnValue(mockMat);
    (cv.imwrite as jest.Mock) = jest.fn().mockReturnValue(true);
    (cv.Mat as any) = jest.fn().mockImplementation(() => mockMat);
    (cv.getStructuringElement as jest.Mock) = jest.fn().mockReturnValue(mockMat);
  });

  describe('1. Image Preprocessing Pipeline (AC #1)', () => {
    it('should preprocess image successfully', async () => {
      const imagePath = '/test/input.png';
      const result = await imageProcessor.preprocessImage(imagePath);

      expect(result).toBeDefined();
      expect(result.processedImagePath).toContain('processed');
      expect(result.originalDimensions).toEqual({ width: 1920, height: 1080 });
      expect(result.enhancementApplied).toBe(true);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.quality).toBeDefined();
    });

    it('should apply noise reduction', async () => {
      await imageProcessor.preprocessImage('/test.png');

      // Verify bilateral filter was applied for noise reduction
      expect(mockMat.bilateralFilter).toHaveBeenCalled();
      expect(mockMat.gaussianBlur).toHaveBeenCalled();
    });

    it('should apply contrast enhancement', async () => {
      await imageProcessor.preprocessImage('/test.png');

      // Verify histogram equalization/CLAHE
      expect(mockMat.normalize).toHaveBeenCalled();
      expect(mockMat.convertTo).toHaveBeenCalled();
    });

    it('should perform edge detection', async () => {
      await imageProcessor.preprocessImage('/test.png');

      // Verify Canny edge detection
      expect(mockMat.canny).toHaveBeenCalled();
    });

    it('should handle different image formats', async () => {
      const formats = ['.png', '.jpg', '.jpeg', '.bmp', '.tiff'];
      
      for (const format of formats) {
        const result = await imageProcessor.preprocessImage(`/test${format}`);
        expect(result).toBeDefined();
        expect(result.processedImagePath).toBeDefined();
      }
    });

    it('should optimize resolution for processing', async () => {
      // Test with high-resolution image
      const highResMat = {
        ...mockMat,
        rows: 4320,
        cols: 7680,
        sizes: [4320, 7680]
      };
      (cv.imread as jest.Mock).mockReturnValueOnce(highResMat);

      await imageProcessor.preprocessImage('/high-res.png');

      // Should resize for optimal processing
      expect(highResMat.resize).toHaveBeenCalled();
    });

    it('should handle corrupted images gracefully', async () => {
      (cv.imread as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Invalid image format');
      });

      await expect(
        imageProcessor.preprocessImage('/corrupted.png')
      ).rejects.toThrow('Failed to preprocess image');
    });

    it('should calculate image quality metrics', async () => {
      const result = await imageProcessor.preprocessImage('/test.png');

      expect(result.quality).toBeDefined();
      expect(result.quality?.resolution).toBeGreaterThan(0);
      expect(result.quality?.clarity).toBeGreaterThanOrEqual(0);
      expect(result.quality?.clarity).toBeLessThanOrEqual(1);
      expect(result.quality?.contrast).toBeGreaterThanOrEqual(0);
      expect(result.quality?.contrast).toBeLessThanOrEqual(1);
      expect(result.quality?.noiseLevel).toBeGreaterThanOrEqual(0);
      expect(result.quality?.noiseLevel).toBeLessThanOrEqual(1);
    });

    it('should detect and correct image skew', async () => {
      // Mock skewed image
      const skewedMat = {
        ...mockMat,
        warpAffine: jest.fn().mockReturnThis()
      };
      (cv.imread as jest.Mock).mockReturnValueOnce(skewedMat);

      const result = await imageProcessor.preprocessImage('/skewed.png');

      expect(result.quality?.skewAngle).toBeDefined();
      // If significant skew, correction should be applied
      if (Math.abs(result.quality?.skewAngle || 0) > 1) {
        expect(skewedMat.warpAffine).toHaveBeenCalled();
      }
    });
  });

  describe('2. Region Extraction Tests', () => {
    it('should extract regions of interest', async () => {
      const regions = await imageProcessor.extractRegions(mockMat);

      expect(regions).toBeDefined();
      expect(regions.length).toBeGreaterThan(0);
      expect(regions[0]).toHaveProperty('id');
      expect(regions[0]).toHaveProperty('boundingBox');
      expect(regions[0]).toHaveProperty('confidence');
      expect(regions[0]).toHaveProperty('imageData');
    });

    it('should filter regions by minimum area', async () => {
      const regions = await imageProcessor.extractRegions(mockMat, { minArea: 3000 });

      // Only regions with area >= 3000 should be included
      expect(regions.every(r => r.boundingBox.area >= 3000)).toBe(true);
    });

    it('should filter regions by aspect ratio', async () => {
      const regions = await imageProcessor.extractRegions(mockMat, {
        minAspectRatio: 0.8,
        maxAspectRatio: 1.2
      });

      regions.forEach(region => {
        const aspectRatio = region.boundingBox.width / region.boundingBox.height;
        expect(aspectRatio).toBeGreaterThanOrEqual(0.8);
        expect(aspectRatio).toBeLessThanOrEqual(1.2);
      });
    });

    it('should extract region image data', async () => {
      const regions = await imageProcessor.extractRegions(mockMat);

      regions.forEach(region => {
        expect(region.imageData).toBeDefined();
        expect(Buffer.isBuffer(region.imageData)).toBe(true);
        expect(region.imageData.length).toBeGreaterThan(0);
      });
    });

    it('should handle overlapping regions', async () => {
      // Add overlapping contours
      const overlappingContours = [
        {
          ...mockContours[0],
          boundingRect: jest.fn().mockReturnValue({ x: 100, y: 100, width: 50, height: 50 })
        },
        {
          ...mockContours[0],
          boundingRect: jest.fn().mockReturnValue({ x: 105, y: 105, width: 45, height: 45 })
        }
      ];
      mockMat.findContours.mockReturnValueOnce({ contours: overlappingContours });

      const regions = await imageProcessor.extractRegions(mockMat);

      // Should merge or filter overlapping regions
      expect(regions.length).toBeLessThan(overlappingContours.length);
    });

    it('should calculate region confidence scores', async () => {
      const regions = await imageProcessor.extractRegions(mockMat);

      regions.forEach(region => {
        expect(region.confidence).toBeDefined();
        expect(region.confidence).toBeGreaterThan(0);
        expect(region.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('3. Advanced Image Processing Tests', () => {
    it('should apply morphological operations', async () => {
      await imageProcessor.preprocessImage('/test.png');

      // Verify morphological operations for cleaning
      expect(mockMat.morphologyEx).toHaveBeenCalled();
      expect(cv.getStructuringElement).toHaveBeenCalled();
    });

    it('should perform adaptive thresholding', async () => {
      await imageProcessor.preprocessImage('/test.png');

      // Verify adaptive threshold for varying lighting
      expect(mockMat.adaptiveThreshold).toHaveBeenCalled();
    });

    it('should handle multi-channel images', async () => {
      const rgbMat = { ...mockMat, channels: 3 };
      const grayMat = { ...mockMat, channels: 1 };
      
      (cv.imread as jest.Mock)
        .mockReturnValueOnce(rgbMat)
        .mockReturnValueOnce(grayMat);

      // Process RGB image
      const rgbResult = await imageProcessor.preprocessImage('/rgb.png');
      expect(rgbResult).toBeDefined();
      expect(rgbMat.cvtColor).toHaveBeenCalled(); // Convert to grayscale

      // Process grayscale image
      const grayResult = await imageProcessor.preprocessImage('/gray.png');
      expect(grayResult).toBeDefined();
    });

    it('should detect and enhance line drawings', async () => {
      const result = await imageProcessor.preprocessImage('/schematic.png');

      // Should apply specific enhancements for technical drawings
      expect(mockMat.threshold).toHaveBeenCalled();
      expect(mockMat.morphologyEx).toHaveBeenCalled();
    });
  });

  describe('4. Performance Optimization Tests', () => {
    it('should cache processed images', async () => {
      const imagePath = '/test.png';
      
      // First call
      const result1 = await imageProcessor.preprocessImage(imagePath);
      
      // Second call - should use cache
      const result2 = await imageProcessor.preprocessImage(imagePath);
      
      expect(result2.processedImagePath).toBe(result1.processedImagePath);
      expect(cv.imread).toHaveBeenCalledTimes(1); // Only read once
    });

    it('should handle batch processing efficiently', async () => {
      const images = ['/img1.png', '/img2.png', '/img3.png'];
      
      const startTime = Date.now();
      const results = await Promise.all(
        images.map(img => imageProcessor.preprocessImage(img))
      );
      const processingTime = Date.now() - startTime;

      expect(results).toHaveLength(3);
      expect(processingTime).toBeLessThan(3000); // Should process in parallel
    });

    it('should release memory after processing', async () => {
      await imageProcessor.preprocessImage('/test.png');
      
      // Verify Mat objects are released
      expect(mockMat.release).toHaveBeenCalled();
    });

    it('should optimize memory for large images', async () => {
      const largeMat = {
        ...mockMat,
        rows: 10000,
        cols: 10000,
        total: jest.fn().mockReturnValue(100000000)
      };
      (cv.imread as jest.Mock).mockReturnValueOnce(largeMat);

      await imageProcessor.preprocessImage('/large.png');

      // Should process in chunks or resize
      expect(largeMat.resize).toHaveBeenCalled();
    });
  });

  describe('5. Error Handling and Edge Cases', () => {
    it('should handle missing files', async () => {
      (fs.existsSync as jest.Mock) = jest.fn().mockReturnValue(false);

      await expect(
        imageProcessor.preprocessImage('/missing.png')
      ).rejects.toThrow('Image file not found');
    });

    it('should handle empty images', async () => {
      const emptyMat = {
        ...mockMat,
        empty: true,
        rows: 0,
        cols: 0
      };
      (cv.imread as jest.Mock).mockReturnValueOnce(emptyMat);

      await expect(
        imageProcessor.preprocessImage('/empty.png')
      ).rejects.toThrow('Invalid image dimensions');
    });

    it('should handle extremely small images', async () => {
      const tinyMat = {
        ...mockMat,
        rows: 10,
        cols: 10,
        sizes: [10, 10]
      };
      (cv.imread as jest.Mock).mockReturnValueOnce(tinyMat);

      const result = await imageProcessor.preprocessImage('/tiny.png');
      
      // Should still process but may upscale
      expect(result).toBeDefined();
      expect(result.quality?.resolution).toBeLessThan(100);
    });

    it('should handle processing timeouts', async () => {
      // Mock slow processing
      mockMat.bilateralFilter.mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 60000));
      });

      const timeoutPromise = imageProcessor.preprocessImage('/slow.png');
      
      // Should timeout after reasonable time
      await expect(Promise.race([
        timeoutPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ])).rejects.toThrow('Timeout');
    });
  });

  describe('6. Feature Extraction Tests', () => {
    it('should extract Hough lines for circuit detection', async () => {
      const houghLines = jest.fn().mockReturnValue([
        { rho: 100, theta: Math.PI / 2 },
        { rho: 200, theta: 0 }
      ]);
      mockMat.houghLines = houghLines;

      const features = await imageProcessor.extractFeatures(mockMat);

      expect(features.lines).toBeDefined();
      expect(features.lines.length).toBeGreaterThan(0);
      expect(houghLines).toHaveBeenCalled();
    });

    it('should extract circles for component detection', async () => {
      const houghCircles = jest.fn().mockReturnValue([
        { x: 100, y: 100, radius: 25 },
        { x: 200, y: 200, radius: 30 }
      ]);
      mockMat.houghCircles = houghCircles;

      const features = await imageProcessor.extractFeatures(mockMat);

      expect(features.circles).toBeDefined();
      expect(features.circles.length).toBeGreaterThan(0);
      expect(houghCircles).toHaveBeenCalled();
    });

    it('should detect corners for junction points', async () => {
      const goodFeaturesToTrack = jest.fn().mockReturnValue([
        { x: 50, y: 50 },
        { x: 150, y: 150 }
      ]);
      mockMat.goodFeaturesToTrack = goodFeaturesToTrack;

      const features = await imageProcessor.extractFeatures(mockMat);

      expect(features.corners).toBeDefined();
      expect(features.corners.length).toBeGreaterThan(0);
      expect(goodFeaturesToTrack).toHaveBeenCalled();
    });
  });

  describe('7. Integration with Symbol Detection Pipeline', () => {
    it('should prepare images for pattern matching', async () => {
      const result = await imageProcessor.prepareForPatternMatching('/test.png');

      expect(result).toBeDefined();
      expect(result.templateReady).toBe(true);
      expect(result.normalizedImage).toBeDefined();
    });

    it('should prepare images for ML classification', async () => {
      const result = await imageProcessor.prepareForMLClassification('/test.png');

      expect(result).toBeDefined();
      expect(result.tensorReady).toBe(true);
      expect(result.dimensions).toEqual({ width: 224, height: 224 }); // Standard ML input size
      expect(result.normalized).toBe(true);
    });

    it('should extract symbol-specific features', async () => {
      const regions = await imageProcessor.extractRegions(mockMat);
      
      for (const region of regions) {
        const features = await imageProcessor.extractSymbolFeatures(region);
        
        expect(features).toBeDefined();
        expect(features.shapeDescriptor).toBeDefined();
        expect(features.huMoments).toBeDefined();
        expect(features.contourSignature).toBeDefined();
      }
    });
  });

  describe('8. Quality Assessment Tests', () => {
    it('should assess image quality accurately', async () => {
      const quality = await imageProcessor.assessImageQuality(mockMat);

      expect(quality).toBeDefined();
      expect(quality.resolution).toBe(1920 * 1080);
      expect(quality.clarity).toBeGreaterThanOrEqual(0);
      expect(quality.clarity).toBeLessThanOrEqual(1);
      expect(quality.contrast).toBeGreaterThanOrEqual(0);
      expect(quality.contrast).toBeLessThanOrEqual(1);
      expect(quality.noiseLevel).toBeGreaterThanOrEqual(0);
      expect(quality.noiseLevel).toBeLessThanOrEqual(1);
    });

    it('should detect low quality images', async () => {
      // Mock low quality metrics
      const lowQualityMat = {
        ...mockMat,
        mean: jest.fn().mockReturnValue([50, 50, 50, 0]), // Low contrast
        stddev: jest.fn().mockReturnValue([10, 10, 10, 0]) // Low variance
      };
      
      const quality = await imageProcessor.assessImageQuality(lowQualityMat);
      
      expect(quality.clarity).toBeLessThan(0.5);
      expect(quality.contrast).toBeLessThan(0.5);
    });

    it('should detect hand-drawn content', async () => {
      // Mock hand-drawn characteristics
      const handDrawnMat = {
        ...mockMat,
        canny: jest.fn().mockImplementation(() => {
          const edgeMat = { ...mockMat };
          edgeMat.countNonZero = jest.fn().mockReturnValue(5000); // Irregular edges
          return edgeMat;
        })
      };

      const result = await imageProcessor.detectHandDrawn(handDrawnMat);
      
      expect(result.isHandDrawn).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('9. Coordinate Mapping Tests', () => {
    it('should map image coordinates to normalized space', async () => {
      const normalized = imageProcessor.normalizeCoordinates(
        500, 300, 1920, 1080
      );

      expect(normalized.x).toBeCloseTo(0.26, 2);
      expect(normalized.y).toBeCloseTo(0.28, 2);
    });

    it('should handle coordinate transformations', async () => {
      const transform = {
        scale: 2.0,
        rotation: 45,
        translation: { x: 100, y: 50 }
      };

      const transformed = imageProcessor.transformCoordinates(
        100, 100, transform
      );

      expect(transformed).toBeDefined();
      expect(transformed.x).not.toBe(100);
      expect(transformed.y).not.toBe(100);
    });
  });

  describe('10. Cleanup and Resource Management', () => {
    it('should cleanup temporary files', async () => {
      const unlinkSync = jest.spyOn(fs, 'unlinkSync').mockImplementation();
      
      await imageProcessor.preprocessImage('/test.png');
      await imageProcessor.cleanup();

      expect(unlinkSync).toHaveBeenCalled();
    });

    it('should clear cache on cleanup', async () => {
      await imageProcessor.preprocessImage('/test1.png');
      await imageProcessor.preprocessImage('/test2.png');
      
      await imageProcessor.cleanup();
      
      // Cache should be cleared
      const cacheSize = imageProcessor.getCacheSize();
      expect(cacheSize).toBe(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Should not throw
      await expect(imageProcessor.cleanup()).resolves.not.toThrow();
    });
  });
});