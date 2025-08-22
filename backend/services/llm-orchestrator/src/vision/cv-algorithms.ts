/**
 * Computer Vision Algorithms Module
 * 
 * Real implementation of computer vision algorithms for electrical symbol detection
 * using Jimp, Sharp, and Canvas for image processing
 */

import Jimp from 'jimp';
// import sharp from 'sharp';
// import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from 'canvas';
// import * as tf from '@tensorflow/tfjs-node';
import { 
  Point,
  BoundingBox,
  ImageProcessingError
} from '../../../../shared/types/symbol-detection.types';

export interface Contour {
  points: Point[];
  area: number;
  perimeter: number;
  boundingBox: BoundingBox;
  moments: ImageMoments;
  huMoments?: number[];
}

export interface ImageMoments {
  m00: number;  // Area
  m10: number;  // First moment in x
  m01: number;  // First moment in y
  m20: number;  // Second moment in x
  m02: number;  // Second moment in y
  m11: number;  // Cross moment
  m30: number;  // Third moment in x
  m03: number;  // Third moment in y
  m21: number;  // Mixed third moment
  m12: number;  // Mixed third moment
  centroid: Point;
}

export interface EdgeDetectionResult {
  edges: Buffer;
  gradientMagnitude: number[][];
  gradientDirection: number[][];
  width: number;
  height: number;
}

export interface TemplateMatchResult {
  location: Point;
  score: number;
  boundingBox: BoundingBox;
  method: string;
}

export class ComputerVisionAlgorithms {
  
  /**
   * Perform Canny edge detection using Sobel operators
   */
  async detectEdges(
    imageBuffer: Buffer,
    lowThreshold: number = 50,
    highThreshold: number = 150
  ): Promise<EdgeDetectionResult> {
    try {
      const image = await Jimp.read(imageBuffer);
      const width = image.bitmap.width;
      const height = image.bitmap.height;
      
      // Convert to grayscale
      image.greyscale();
      
      // Apply Gaussian blur to reduce noise
      image.blur(2);
      
      // Calculate gradients using Sobel operators
      const gradientMagnitude: number[][] = [];
      const gradientDirection: number[][] = [];
      
      // Sobel operators
      const sobelX = [
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1]
      ];
      
      const sobelY = [
        [-1, -2, -1],
        [0, 0, 0],
        [1, 2, 1]
      ];
      
      // Apply Sobel operators
      for (let y = 1; y < height - 1; y++) {
        gradientMagnitude[y] = [];
        gradientDirection[y] = [];
        
        for (let x = 1; x < width - 1; x++) {
          let gx = 0, gy = 0;
          
          // Convolve with Sobel kernels
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const pixel = Jimp.intToRGBA(image.getPixelColor(x + kx, y + ky));
              const intensity = pixel.r; // Already grayscale
              
              gx += intensity * sobelX[ky + 1][kx + 1];
              gy += intensity * sobelY[ky + 1][kx + 1];
            }
          }
          
          const magnitude = Math.sqrt(gx * gx + gy * gy);
          const direction = Math.atan2(gy, gx);
          
          gradientMagnitude[y][x] = magnitude;
          gradientDirection[y][x] = direction;
        }
      }
      
      // Non-maximum suppression
      const suppressed = this.nonMaximumSuppression(gradientMagnitude, gradientDirection, width, height);
      
      // Double threshold and edge tracking by hysteresis
      const edges = this.doubleThresholdAndHysteresis(suppressed, lowThreshold, highThreshold, width, height);
      
      // Convert edge map to buffer
      const edgeImage = new Jimp(width, height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const value = edges[y] && edges[y][x] ? 255 : 0;
          const color = Jimp.rgbaToInt(value, value, value, 255);
          edgeImage.setPixelColor(color, x, y);
        }
      }
      
      const edgeBuffer = await edgeImage.getBufferAsync(Jimp.MIME_PNG);
      
      return {
        edges: edgeBuffer,
        gradientMagnitude,
        gradientDirection,
        width,
        height
      };
      
    } catch (error) {
      throw new ImageProcessingError(
        `Edge detection failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Non-maximum suppression for edge thinning
   */
  private nonMaximumSuppression(
    magnitude: number[][],
    direction: number[][],
    width: number,
    height: number
  ): number[][] {
    const suppressed: number[][] = Array(height).fill(null).map(() => Array(width).fill(0));
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (!magnitude[y] || !direction[y]) continue;
        
        const angle = direction[y][x] * 180 / Math.PI;
        const mag = magnitude[y][x];
        
        let q = 0, r = 0;
        
        // Determine neighbors to check based on gradient direction
        if ((angle >= -22.5 && angle <= 22.5) || (angle >= 157.5 || angle <= -157.5)) {
          // Horizontal edge
          q = magnitude[y][x - 1] || 0;
          r = magnitude[y][x + 1] || 0;
        } else if ((angle >= 22.5 && angle <= 67.5) || (angle >= -157.5 && angle <= -112.5)) {
          // Diagonal /
          q = magnitude[y - 1]?.[x + 1] || 0;
          r = magnitude[y + 1]?.[x - 1] || 0;
        } else if ((angle >= 67.5 && angle <= 112.5) || (angle >= -112.5 && angle <= -67.5)) {
          // Vertical edge
          q = magnitude[y - 1]?.[x] || 0;
          r = magnitude[y + 1]?.[x] || 0;
        } else {
          // Diagonal \
          q = magnitude[y - 1]?.[x - 1] || 0;
          r = magnitude[y + 1]?.[x + 1] || 0;
        }
        
        // Keep only if it's a local maximum
        if (mag >= q && mag >= r) {
          suppressed[y][x] = mag;
        }
      }
    }
    
    return suppressed;
  }
  
  /**
   * Double threshold and edge tracking by hysteresis
   */
  private doubleThresholdAndHysteresis(
    suppressed: number[][],
    lowThreshold: number,
    highThreshold: number,
    width: number,
    height: number
  ): boolean[][] {
    const edges: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
    const visited: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
    
    // Helper function for depth-first search
    const trackEdge = (y: number, x: number): void => {
      if (y < 0 || y >= height || x < 0 || x >= width || visited[y][x]) {
        return;
      }
      
      visited[y][x] = true;
      
      if (suppressed[y][x] >= lowThreshold) {
        edges[y][x] = true;
        
        // Check 8-connected neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dy === 0 && dx === 0) continue;
            trackEdge(y + dy, x + dx);
          }
        }
      }
    };
    
    // Start edge tracking from strong edges
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (suppressed[y][x] >= highThreshold && !visited[y][x]) {
          trackEdge(y, x);
        }
      }
    }
    
    return edges;
  }
  
  /**
   * Extract contours from edge image using contour tracing algorithm
   */
  async extractContours(edgeBuffer: Buffer, minArea: number = 50): Promise<Contour[]> {
    try {
      const image = await Jimp.read(edgeBuffer);
      const width = image.bitmap.width;
      const height = image.bitmap.height;
      
      // Create binary image from edges
      const binary: boolean[][] = [];
      for (let y = 0; y < height; y++) {
        binary[y] = [];
        for (let x = 0; x < width; x++) {
          const pixel = Jimp.intToRGBA(image.getPixelColor(x, y));
          binary[y][x] = pixel.r > 128; // Threshold for binary
        }
      }
      
      // Find contours using Moore neighborhood tracing
      const contours: Contour[] = [];
      const visited: boolean[][] = Array(height).fill(null).map(() => Array(width).fill(false));
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (binary[y][x] && !visited[y][x]) {
            const contour = this.traceContour(binary, visited, x, y, width, height);
            
            if (contour.area >= minArea) {
              // Calculate moments and Hu moments
              contour.moments = this.calculateMoments(contour.points);
              contour.huMoments = this.calculateHuMoments(contour.moments);
              contours.push(contour);
            }
          }
        }
      }
      
      return contours;
      
    } catch (error) {
      throw new ImageProcessingError(
        `Contour extraction failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Trace a single contour using Moore neighborhood algorithm
   */
  private traceContour(
    binary: boolean[][],
    visited: boolean[][],
    startX: number,
    startY: number,
    width: number,
    height: number
  ): Contour {
    const points: Point[] = [];
    const directions = [
      { dx: 1, dy: 0 },   // Right
      { dx: 1, dy: 1 },   // Right-Down
      { dx: 0, dy: 1 },   // Down
      { dx: -1, dy: 1 },  // Left-Down
      { dx: -1, dy: 0 },  // Left
      { dx: -1, dy: -1 }, // Left-Up
      { dx: 0, dy: -1 },  // Up
      { dx: 1, dy: -1 }   // Right-Up
    ];
    
    let x = startX, y = startY;
    let dir = 0; // Start direction
    const maxIterations = width * height;
    let iterations = 0;
    
    do {
      points.push({ x, y });
      visited[y][x] = true;
      
      // Find next contour point
      let found = false;
      for (let i = 0; i < 8; i++) {
        const checkDir = (dir + i) % 8;
        const nx = x + directions[checkDir].dx;
        const ny = y + directions[checkDir].dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height && binary[ny][nx]) {
          x = nx;
          y = ny;
          dir = (checkDir + 6) % 8; // Update search direction
          found = true;
          break;
        }
      }
      
      if (!found) break;
      iterations++;
      
    } while ((x !== startX || y !== startY) && iterations < maxIterations);
    
    // Calculate contour properties
    const area = this.calculateContourArea(points);
    const perimeter = this.calculatePerimeter(points);
    const boundingBox = this.calculateBoundingBox(points);
    
    return {
      points,
      area,
      perimeter,
      boundingBox,
      moments: {} as ImageMoments // Will be calculated later
    };
  }
  
  /**
   * Calculate contour area using Shoelace formula
   */
  private calculateContourArea(points: Point[]): number {
    if (points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    
    return Math.abs(area / 2);
  }
  
  /**
   * Calculate contour perimeter
   */
  private calculatePerimeter(points: Point[]): number {
    if (points.length < 2) return 0;
    
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      const dx = points[j].x - points[i].x;
      const dy = points[j].y - points[i].y;
      perimeter += Math.sqrt(dx * dx + dy * dy);
    }
    
    return perimeter;
  }
  
  /**
   * Calculate bounding box for contour
   */
  private calculateBoundingBox(points: Point[]): BoundingBox {
    if (points.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0, area: 0 };
    }
    
    let minX = points[0].x, maxX = points[0].x;
    let minY = points[0].y, maxY = points[0].y;
    
    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    return {
      x: minX,
      y: minY,
      width,
      height,
      area: width * height
    };
  }
  
  /**
   * Calculate image moments for shape analysis
   */
  private calculateMoments(points: Point[]): ImageMoments {
    const n = points.length;
    if (n === 0) {
      return {
        m00: 0, m10: 0, m01: 0, m20: 0, m02: 0,
        m11: 0, m30: 0, m03: 0, m21: 0, m12: 0,
        centroid: { x: 0, y: 0 }
      };
    }
    
    let m00 = 0, m10 = 0, m01 = 0, m20 = 0, m02 = 0;
    let m11 = 0, m30 = 0, m03 = 0, m21 = 0, m12 = 0;
    
    // Calculate raw moments
    for (const point of points) {
      const x = point.x;
      const y = point.y;
      
      m00 += 1;
      m10 += x;
      m01 += y;
      m20 += x * x;
      m02 += y * y;
      m11 += x * y;
      m30 += x * x * x;
      m03 += y * y * y;
      m21 += x * x * y;
      m12 += x * y * y;
    }
    
    // Calculate centroid
    const centroid = {
      x: m10 / m00,
      y: m01 / m00
    };
    
    return {
      m00, m10, m01, m20, m02,
      m11, m30, m03, m21, m12,
      centroid
    };
  }
  
  /**
   * Calculate Hu invariant moments for rotation/scale invariant matching
   */
  private calculateHuMoments(moments: ImageMoments): number[] {
    const { m00, m10, m01, m20, m02, m11, m30, m03, m21, m12, centroid } = moments;
    
    // Calculate central moments
    const mu20 = m20 - centroid.x * m10;
    const mu02 = m02 - centroid.y * m01;
    const mu11 = m11 - centroid.x * m01;
    const mu30 = m30 - 3 * centroid.x * m20 + 2 * centroid.x * centroid.x * m10;
    const mu03 = m03 - 3 * centroid.y * m02 + 2 * centroid.y * centroid.y * m01;
    const mu21 = m21 - 2 * centroid.x * m11 - centroid.y * m20 + 2 * centroid.x * centroid.x * m01;
    const mu12 = m12 - 2 * centroid.y * m11 - centroid.x * m02 + 2 * centroid.y * centroid.y * m10;
    
    // Normalize central moments
    const norm = Math.pow(m00, 2);
    const nu20 = mu20 / norm;
    const nu02 = mu02 / norm;
    const nu11 = mu11 / norm;
    const nu30 = mu30 / Math.pow(m00, 2.5);
    const nu03 = mu03 / Math.pow(m00, 2.5);
    const nu21 = mu21 / Math.pow(m00, 2.5);
    const nu12 = mu12 / Math.pow(m00, 2.5);
    
    // Calculate 7 Hu invariant moments
    const hu1 = nu20 + nu02;
    const hu2 = Math.pow(nu20 - nu02, 2) + 4 * Math.pow(nu11, 2);
    const hu3 = Math.pow(nu30 - 3 * nu12, 2) + Math.pow(3 * nu21 - nu03, 2);
    const hu4 = Math.pow(nu30 + nu12, 2) + Math.pow(nu21 + nu03, 2);
    const hu5 = (nu30 - 3 * nu12) * (nu30 + nu12) * (Math.pow(nu30 + nu12, 2) - 3 * Math.pow(nu21 + nu03, 2)) +
                (3 * nu21 - nu03) * (nu21 + nu03) * (3 * Math.pow(nu30 + nu12, 2) - Math.pow(nu21 + nu03, 2));
    const hu6 = (nu20 - nu02) * (Math.pow(nu30 + nu12, 2) - Math.pow(nu21 + nu03, 2)) +
                4 * nu11 * (nu30 + nu12) * (nu21 + nu03);
    const hu7 = (3 * nu21 - nu03) * (nu30 + nu12) * (Math.pow(nu30 + nu12, 2) - 3 * Math.pow(nu21 + nu03, 2)) -
                (nu30 - 3 * nu12) * (nu21 + nu03) * (3 * Math.pow(nu30 + nu12, 2) - Math.pow(nu21 + nu03, 2));
    
    return [hu1, hu2, hu3, hu4, hu5, hu6, hu7];
  }
  
  /**
   * Template matching using normalized cross-correlation
   */
  async matchTemplate(
    sourceBuffer: Buffer,
    templateBuffer: Buffer,
    threshold: number = 0.7
  ): Promise<TemplateMatchResult[]> {
    try {
      const sourceImage = await Jimp.read(sourceBuffer);
      const templateImage = await Jimp.read(templateBuffer);
      
      const sourceWidth = sourceImage.bitmap.width;
      const sourceHeight = sourceImage.bitmap.height;
      const templateWidth = templateImage.bitmap.width;
      const templateHeight = templateImage.bitmap.height;
      
      // Convert to grayscale for faster processing
      sourceImage.greyscale();
      templateImage.greyscale();
      
      const results: TemplateMatchResult[] = [];
      
      // Slide template over source image
      for (let y = 0; y <= sourceHeight - templateHeight; y += 2) { // Step by 2 for speed
        for (let x = 0; x <= sourceWidth - templateWidth; x += 2) {
          const score = this.calculateNCC(
            sourceImage,
            templateImage,
            x, y,
            templateWidth,
            templateHeight
          );
          
          if (score >= threshold) {
            results.push({
              location: { x, y },
              score,
              boundingBox: {
                x,
                y,
                width: templateWidth,
                height: templateHeight,
                area: templateWidth * templateHeight
              },
              method: 'NCC'
            });
          }
        }
      }
      
      // Non-maximum suppression to remove overlapping detections
      return this.nonMaxSuppression(results);
      
    } catch (error) {
      throw new ImageProcessingError(
        `Template matching failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Calculate Normalized Cross-Correlation
   */
  private calculateNCC(
    source: Jimp,
    template: Jimp,
    offsetX: number,
    offsetY: number,
    width: number,
    height: number
  ): number {
    let sumSource = 0, sumTemplate = 0;
    let sumSourceSq = 0, sumTemplateSq = 0;
    let sumProduct = 0;
    let count = 0;
    
    // Calculate sums for NCC formula
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const sourcePixel = Jimp.intToRGBA(source.getPixelColor(offsetX + x, offsetY + y));
        const templatePixel = Jimp.intToRGBA(template.getPixelColor(x, y));
        
        const sourceVal = sourcePixel.r; // Grayscale value
        const templateVal = templatePixel.r;
        
        sumSource += sourceVal;
        sumTemplate += templateVal;
        sumSourceSq += sourceVal * sourceVal;
        sumTemplateSq += templateVal * templateVal;
        sumProduct += sourceVal * templateVal;
        count++;
      }
    }
    
    if (count === 0) return 0;
    
    // Calculate means
    const meanSource = sumSource / count;
    const meanTemplate = sumTemplate / count;
    
    // Calculate normalized cross-correlation
    const numerator = sumProduct - count * meanSource * meanTemplate;
    const denominator = Math.sqrt(
      (sumSourceSq - count * meanSource * meanSource) *
      (sumTemplateSq - count * meanTemplate * meanTemplate)
    );
    
    if (denominator === 0) return 0;
    
    return numerator / denominator;
  }
  
  /**
   * Non-maximum suppression for template matching results
   */
  private nonMaxSuppression(
    results: TemplateMatchResult[],
    overlapThreshold: number = 0.3
  ): TemplateMatchResult[] {
    if (results.length === 0) return [];
    
    // Sort by score in descending order
    results.sort((a, b) => b.score - a.score);
    
    const selected: TemplateMatchResult[] = [];
    const suppressed = new Set<number>();
    
    for (let i = 0; i < results.length; i++) {
      if (suppressed.has(i)) continue;
      
      const current = results[i];
      selected.push(current);
      
      // Suppress overlapping detections
      for (let j = i + 1; j < results.length; j++) {
        if (suppressed.has(j)) continue;
        
        const overlap = this.calculateIoU(current.boundingBox, results[j].boundingBox);
        if (overlap > overlapThreshold) {
          suppressed.add(j);
        }
      }
    }
    
    return selected;
  }
  
  /**
   * Calculate Intersection over Union (IoU) for two bounding boxes
   */
  private calculateIoU(box1: BoundingBox, box2: BoundingBox): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);
    
    if (x2 < x1 || y2 < y1) return 0;
    
    const intersection = (x2 - x1) * (y2 - y1);
    const union = box1.area + box2.area - intersection;
    
    return intersection / union;
  }
  
  /**
   * Hough Transform for line detection
   */
  async detectLines(
    edgeBuffer: Buffer,
    threshold: number = 50
  ): Promise<Array<{ rho: number; theta: number; votes: number }>> {
    try {
      const image = await Jimp.read(edgeBuffer);
      const width = image.bitmap.width;
      const height = image.bitmap.height;
      
      // Hough space parameters
      const maxRho = Math.sqrt(width * width + height * height);
      const rhoStep = 1;
      const thetaStep = Math.PI / 180; // 1 degree
      const numRho = Math.ceil(2 * maxRho / rhoStep);
      const numTheta = Math.ceil(Math.PI / thetaStep);
      
      // Initialize accumulator
      const accumulator: number[][] = Array(numRho).fill(null).map(() => Array(numTheta).fill(0));
      
      // Vote in Hough space
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pixel = Jimp.intToRGBA(image.getPixelColor(x, y));
          
          if (pixel.r > 128) { // Edge pixel
            for (let thetaIdx = 0; thetaIdx < numTheta; thetaIdx++) {
              const theta = thetaIdx * thetaStep;
              const rho = x * Math.cos(theta) + y * Math.sin(theta);
              const rhoIdx = Math.floor((rho + maxRho) / rhoStep);
              
              if (rhoIdx >= 0 && rhoIdx < numRho) {
                accumulator[rhoIdx][thetaIdx]++;
              }
            }
          }
        }
      }
      
      // Find peaks in accumulator
      const lines: Array<{ rho: number; theta: number; votes: number }> = [];
      
      for (let rhoIdx = 0; rhoIdx < numRho; rhoIdx++) {
        for (let thetaIdx = 0; thetaIdx < numTheta; thetaIdx++) {
          const votes = accumulator[rhoIdx][thetaIdx];
          
          if (votes >= threshold) {
            const rho = rhoIdx * rhoStep - maxRho;
            const theta = thetaIdx * thetaStep;
            
            lines.push({ rho, theta, votes });
          }
        }
      }
      
      // Sort by votes
      lines.sort((a, b) => b.votes - a.votes);
      
      return lines;
      
    } catch (error) {
      throw new ImageProcessingError(
        `Line detection failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export default ComputerVisionAlgorithms;