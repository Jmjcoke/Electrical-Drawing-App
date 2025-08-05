/**
 * Image Processor
 * 
 * Handles PDF to image conversion, image preprocessing, and quality assessment
 * for electrical symbol detection
 */

import sharp from 'sharp';
import { createCanvas } from 'canvas';
import { 
  ImageQuality, 
  ImageProcessingError,
  Point
} from '../../../../shared/types/symbol-detection.types';

export interface ImageProcessingOptions {
  enhanceContrast?: boolean;
  reduceNoise?: boolean;
  detectEdges?: boolean;
  normalizeResolution?: boolean;
  targetResolution?: number;
}

export interface CoordinateNormalizationResult {
  normalizedX: number;
  normalizedY: number;
  originalX: number;
  originalY: number;
  imageWidth: number;
  imageHeight: number;
}

export class ImageProcessor {
  private readonly DEFAULT_DPI = 300;

  /**
   * Convert PDF buffer to array of image buffers
   */
  async convertPdfToImages(
    pdfBuffer: Buffer,
    options: { dpi?: number; format?: 'png' | 'jpeg' } = {}
  ): Promise<Buffer[]> {
    try {
      const { dpi = this.DEFAULT_DPI, format = 'png' } = options;
      
      // For now, we'll use a placeholder implementation
      // In a real implementation, you would use pdf-poppler or similar library
      // Since pdf2pic or pdf-poppler aren't in the current dependencies,
      // we'll simulate PDF page conversion
      
      // This is a temporary implementation - in production you would use:
      // const pdf2pic = require('pdf2pic');
      // const convert = pdf2pic.fromBuffer(pdfBuffer, { density: dpi, format });
      // const pages = await convert.bulk(-1);
      
      // For now, return a single mock image page using the specified format
      const mockImageBuffer = await this.createMockPdfPage(800, 600, format);
      console.log(`Converting PDF with DPI: ${dpi}, Format: ${format}`);
      return [mockImageBuffer];
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ImageProcessingError(
        `Failed to convert PDF to images: ${errorMessage}`,
        { pdfSize: pdfBuffer.length }
      );
    }
  }

  /**
   * Preprocess image for better symbol detection
   */
  async preprocessImage(
    imageBuffer: Buffer, 
    options: ImageProcessingOptions = {}
  ): Promise<Buffer> {
    try {
      let image = sharp(imageBuffer);
      
      // Get image metadata
      const metadata = await image.metadata();
      const { width = 0, height = 0 } = metadata;

      // Normalize resolution if needed
      if (options.normalizeResolution) {
        const targetSize = options.targetResolution || 1024;
        if (width > targetSize || height > targetSize) {
          const scale = Math.min(targetSize / width, targetSize / height);
          image = image.resize(
            Math.round(width * scale),
            Math.round(height * scale),
            { fit: 'inside', withoutEnlargement: false }
          );
        }
      }

      // Enhance contrast
      if (options.enhanceContrast) {
        image = image.normalize({ lower: 1, upper: 99 });
      }

      // Reduce noise
      if (options.reduceNoise) {
        image = image.median(3);
      }

      // Convert to grayscale for better processing
      image = image.greyscale();

      // Edge detection preprocessing
      if (options.detectEdges) {
        image = image.convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
        });
      }

      return await image.png().toBuffer();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ImageProcessingError(
        `Failed to preprocess image: ${errorMessage}`,
        { bufferSize: imageBuffer.length }
      );
    }
  }

  /**
   * Assess image quality for detection reliability
   */
  async assessImageQuality(imageBuffer: Buffer): Promise<ImageQuality> {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      const stats = await image.stats();

      // Calculate resolution quality
      const resolution = Math.sqrt((metadata.width || 0) * (metadata.height || 0));
      const resolutionScore = Math.min(resolution / 1000, 1); // Normalize to 0-1

      // Calculate clarity based on image statistics
      const clarity = this.calculateClarity(stats);

      // Calculate contrast based on standard deviation
      const contrast = this.calculateContrast(stats);

      // Estimate noise level
      const noiseLevel = this.estimateNoiseLevel(stats);

      // Detect skew angle (simplified implementation)
      const skewAngle = await this.detectSkewAngle(imageBuffer);

      const quality: ImageQuality = {
        resolution: resolutionScore,
        clarity,
        contrast,
        noiseLevel,
      };
      
      if (skewAngle !== undefined) {
        quality.skewAngle = skewAngle;
      }
      
      return quality;

    } catch (error) {
      throw new ImageProcessingError(
        `Failed to assess image quality: ${error instanceof Error ? error.message : String(error)}`,
        { bufferSize: imageBuffer.length }
      );
    }
  }

  /**
   * Normalize coordinates from pixel to relative coordinates (0-1)
   */
  normalizeCoordinates(
    pixelX: number,
    pixelY: number,
    imageWidth: number,
    imageHeight: number
  ): CoordinateNormalizationResult {
    return {
      normalizedX: Math.max(0, Math.min(1, pixelX / imageWidth)),
      normalizedY: Math.max(0, Math.min(1, pixelY / imageHeight)),
      originalX: pixelX,
      originalY: pixelY,
      imageWidth,
      imageHeight,
    };
  }

  /**
   * Convert normalized coordinates back to pixel coordinates
   */
  denormalizeCoordinates(
    normalizedX: number,
    normalizedY: number,
    imageWidth: number,
    imageHeight: number
  ): Point {
    return {
      x: Math.round(normalizedX * imageWidth),
      y: Math.round(normalizedY * imageHeight),
    };
  }

  /**
   * Extract regions of interest from image based on bounding boxes
   */
  async extractRegions(
    imageBuffer: Buffer,
    regions: { x: number; y: number; width: number; height: number }[]
  ): Promise<Buffer[]> {
    try {
      const extractedRegions: Buffer[] = [];
      
      for (const region of regions) {
        const extractedBuffer = await sharp(imageBuffer)
          .extract({
            left: Math.max(0, Math.round(region.x)),
            top: Math.max(0, Math.round(region.y)),
            width: Math.max(1, Math.round(region.width)),
            height: Math.max(1, Math.round(region.height)),
          })
          .png()
          .toBuffer();

        extractedRegions.push(extractedBuffer);
      }

      return extractedRegions;

    } catch (error) {
      throw new ImageProcessingError(
        `Failed to extract regions: ${error instanceof Error ? error.message : String(error)}`,
        { regions: regions.length }
      );
    }
  }

  /**
   * Apply image filters for better symbol detection
   */
  async applyDetectionFilters(imageBuffer: Buffer): Promise<{
    original: Buffer;
    edges: Buffer;
    morphological: Buffer;
    thresholded: Buffer;
  }> {
    try {
      const original = imageBuffer;

      // Edge detection filter
      const edges = await sharp(imageBuffer)
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
        })
        .png()
        .toBuffer();

      // Morphological operations (dilation/erosion)
      const morphological = await sharp(imageBuffer)
        .convolve({
          width: 3,
          height: 3,
          kernel: [0, 1, 0, 1, 1, 1, 0, 1, 0],
        })
        .png()
        .toBuffer();

      // Threshold for binary image
      const thresholded = await sharp(imageBuffer)
        .threshold(128)
        .png()
        .toBuffer();

      return {
        original,
        edges,
        morphological,
        thresholded,
      };

    } catch (error) {
      throw new ImageProcessingError(
        `Failed to apply detection filters: ${error instanceof Error ? error.message : String(error)}`,
        { bufferSize: imageBuffer.length }
      );
    }
  }

  /**
   * Create mock PDF page for testing
   */
  private async createMockPdfPage(width: number, height: number, format: 'png' | 'jpeg' = 'png'): Promise<Buffer> {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    // Draw some mock electrical symbols
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;

    // Draw a resistor symbol
    ctx.beginPath();
    ctx.moveTo(100, 100);
    ctx.lineTo(120, 100);
    ctx.lineTo(130, 80);
    ctx.lineTo(150, 120);
    ctx.lineTo(170, 80);
    ctx.lineTo(190, 120);
    ctx.lineTo(200, 100);
    ctx.lineTo(220, 100);
    ctx.stroke();

    // Draw a capacitor symbol
    ctx.beginPath();
    ctx.moveTo(300, 100);
    ctx.lineTo(320, 100);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(320, 80);
    ctx.lineTo(320, 120);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(330, 80);
    ctx.lineTo(330, 120);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(330, 100);
    ctx.lineTo(350, 100);
    ctx.stroke();

    if (format === 'jpeg') {
      return canvas.toBuffer('image/jpeg');
    } else {
      return canvas.toBuffer('image/png');
    }
  }

  /**
   * Calculate image clarity based on statistics
   */
  private calculateClarity(stats: sharp.Stats): number {
    // Use entropy or variance as a measure of clarity
    // Higher variance typically indicates more detail/clarity
    const channel = stats.channels[0]; // Use first channel for grayscale
    
    // Calculate variance from mean and other available properties
    // Since std is not available, use min/max range as an approximation
    const range = channel.max - channel.min;
    const variance = range * range;
    
    // Normalize variance to 0-1 range (approximate)
    return Math.min(variance / 65536, 1); // 256^2 for 8-bit range
  }

  /**
   * Calculate image contrast based on statistics
   */
  private calculateContrast(stats: sharp.Stats): number {
    const channel = stats.channels[0];
    const range = channel.max - channel.min;
    
    // Normalize range to 0-1
    return range / 255;
  }

  /**
   * Estimate noise level in image
   */
  private estimateNoiseLevel(stats: sharp.Stats): number {
    const channel = stats.channels[0];
    
    // Use range as approximation for noise estimate
    // Higher range can indicate more variation/noise
    const range = channel.max - channel.min;
    const noiseEstimate = range / 255;
    
    // Return normalized noise estimate
    return Math.min(noiseEstimate, 1);
  }

  /**
   * Detect document skew angle (simplified implementation)
   */
  private async detectSkewAngle(_imageBuffer: Buffer): Promise<number | undefined> {
    try {
      // This is a simplified implementation
      // In a full implementation, you would use Hough transform or similar
      // For now, return undefined (no skew detected)
      return undefined;

    } catch (error) {
      // Return undefined if skew detection fails
      return undefined;
    }
  }
}