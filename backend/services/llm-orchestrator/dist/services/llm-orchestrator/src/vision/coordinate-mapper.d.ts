/**
 * Coordinate Mapper
 *
 * Handles coordinate normalization and transformation for PDF symbol locations
 * across different PDF scales and resolutions
 */
import { Point, BoundingBox, SymbolLocation } from '../../../../shared/types/symbol-detection.types';
export interface CoordinateTransform {
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
    rotation: number;
}
export interface ViewportInfo {
    width: number;
    height: number;
    scale: number;
    offsetX: number;
    offsetY: number;
}
export declare class CoordinateMapper {
    /**
     * Normalize pixel coordinates to relative coordinates (0-1 range)
     */
    static normalizeCoordinates(pixelX: number, pixelY: number, imageWidth: number, imageHeight: number): {
        x: number;
        y: number;
    };
    /**
     * Convert normalized coordinates back to pixel coordinates
     */
    static denormalizeCoordinates(normalizedX: number, normalizedY: number, imageWidth: number, imageHeight: number): Point;
    /**
     * Create SymbolLocation from pixel coordinates
     */
    static createSymbolLocation(pixelX: number, pixelY: number, imageWidth: number, imageHeight: number, pageNumber: number): SymbolLocation;
    /**
     * Transform bounding box coordinates with scaling and offset
     */
    static transformBoundingBox(boundingBox: BoundingBox, transform: CoordinateTransform): BoundingBox;
    /**
     * Calculate transform between two coordinate systems
     */
    static calculateTransform(sourceViewport: ViewportInfo, targetViewport: ViewportInfo): CoordinateTransform;
    /**
     * Convert coordinates between different PDF scales
     */
    static convertBetweenScales(coordinates: Point, fromScale: number, toScale: number): Point;
    /**
     * Check if a point is within a bounding box
     */
    static isPointInBoundingBox(point: Point, boundingBox: BoundingBox): boolean;
    /**
     * Calculate distance between two points
     */
    static calculateDistance(point1: Point, point2: Point): number;
    /**
     * Calculate intersection area between two bounding boxes
     */
    static calculateIntersectionArea(box1: BoundingBox, box2: BoundingBox): number;
    /**
     * Calculate Intersection over Union (IoU) for two bounding boxes
     */
    static calculateIoU(box1: BoundingBox, box2: BoundingBox): number;
    /**
     * Rotate a point around the origin
     */
    static rotatePoint(x: number, y: number, angle: number): Point;
    /**
     * Get center point of a bounding box
     */
    static getBoundingBoxCenter(boundingBox: BoundingBox): Point;
    /**
     * Expand bounding box by a margin
     */
    static expandBoundingBox(boundingBox: BoundingBox, margin: number, imageWidth?: number, imageHeight?: number): BoundingBox;
    /**
     * Merge overlapping bounding boxes
     */
    static mergeBoundingBoxes(boxes: BoundingBox[], overlapThreshold?: number): BoundingBox[];
    /**
     * Validate coordinate values
     */
    static validateCoordinates(point: Point, imageWidth: number, imageHeight: number): boolean;
    /**
     * Validate bounding box
     */
    static validateBoundingBox(box: BoundingBox, imageWidth?: number, imageHeight?: number): boolean;
}
//# sourceMappingURL=coordinate-mapper.d.ts.map