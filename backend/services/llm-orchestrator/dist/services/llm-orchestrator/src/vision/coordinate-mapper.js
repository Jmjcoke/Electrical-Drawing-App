"use strict";
/**
 * Coordinate Mapper
 *
 * Handles coordinate normalization and transformation for PDF symbol locations
 * across different PDF scales and resolutions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoordinateMapper = void 0;
const symbol_detection_types_1 = require("../../../../shared/types/symbol-detection.types");
class CoordinateMapper {
    /**
     * Normalize pixel coordinates to relative coordinates (0-1 range)
     */
    static normalizeCoordinates(pixelX, pixelY, imageWidth, imageHeight) {
        if (imageWidth <= 0 || imageHeight <= 0) {
            throw new symbol_detection_types_1.ImageProcessingError('Invalid image dimensions for coordinate normalization', { imageWidth, imageHeight });
        }
        return {
            x: Math.max(0, Math.min(1, pixelX / imageWidth)),
            y: Math.max(0, Math.min(1, pixelY / imageHeight)),
        };
    }
    /**
     * Convert normalized coordinates back to pixel coordinates
     */
    static denormalizeCoordinates(normalizedX, normalizedY, imageWidth, imageHeight) {
        if (imageWidth <= 0 || imageHeight <= 0) {
            throw new symbol_detection_types_1.ImageProcessingError('Invalid image dimensions for coordinate denormalization', { imageWidth, imageHeight });
        }
        return {
            x: Math.round(Math.max(0, Math.min(imageWidth, normalizedX * imageWidth))),
            y: Math.round(Math.max(0, Math.min(imageHeight, normalizedY * imageHeight))),
        };
    }
    /**
     * Create SymbolLocation from pixel coordinates
     */
    static createSymbolLocation(pixelX, pixelY, imageWidth, imageHeight, pageNumber) {
        const normalized = this.normalizeCoordinates(pixelX, pixelY, imageWidth, imageHeight);
        return {
            x: normalized.x,
            y: normalized.y,
            pageNumber,
            originalX: pixelX,
            originalY: pixelY,
            imageWidth,
            imageHeight,
        };
    }
    /**
     * Transform bounding box coordinates with scaling and offset
     */
    static transformBoundingBox(boundingBox, transform) {
        // Apply rotation if needed
        let { x, y, width, height } = boundingBox;
        if (transform.rotation !== 0) {
            const rotatedCoords = this.rotatePoint(x + width / 2, y + height / 2, transform.rotation);
            x = rotatedCoords.x - width / 2;
            y = rotatedCoords.y - height / 2;
        }
        // Apply scaling and offset
        const transformedX = (x * transform.scaleX) + transform.offsetX;
        const transformedY = (y * transform.scaleY) + transform.offsetY;
        const transformedWidth = width * transform.scaleX;
        const transformedHeight = height * transform.scaleY;
        const result = {
            x: transformedX,
            y: transformedY,
            width: transformedWidth,
            height: transformedHeight,
            area: transformedWidth * transformedHeight,
        };
        // Only set rotation if it has a meaningful value
        const finalRotation = boundingBox.rotation
            ? boundingBox.rotation + transform.rotation
            : transform.rotation;
        if (finalRotation !== 0) {
            result.rotation = finalRotation;
        }
        return result;
    }
    /**
     * Calculate transform between two coordinate systems
     */
    static calculateTransform(sourceViewport, targetViewport) {
        return {
            scaleX: targetViewport.width / sourceViewport.width,
            scaleY: targetViewport.height / sourceViewport.height,
            offsetX: targetViewport.offsetX - (sourceViewport.offsetX * targetViewport.width / sourceViewport.width),
            offsetY: targetViewport.offsetY - (sourceViewport.offsetY * targetViewport.height / sourceViewport.height),
            rotation: 0, // Default to no rotation
        };
    }
    /**
     * Convert coordinates between different PDF scales
     */
    static convertBetweenScales(coordinates, fromScale, toScale) {
        if (fromScale <= 0 || toScale <= 0) {
            throw new symbol_detection_types_1.ImageProcessingError('Invalid scale values for coordinate conversion', { fromScale, toScale });
        }
        const scaleFactor = toScale / fromScale;
        return {
            x: coordinates.x * scaleFactor,
            y: coordinates.y * scaleFactor,
        };
    }
    /**
     * Check if a point is within a bounding box
     */
    static isPointInBoundingBox(point, boundingBox) {
        return (point.x >= boundingBox.x &&
            point.x <= boundingBox.x + boundingBox.width &&
            point.y >= boundingBox.y &&
            point.y <= boundingBox.y + boundingBox.height);
    }
    /**
     * Calculate distance between two points
     */
    static calculateDistance(point1, point2) {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    /**
     * Calculate intersection area between two bounding boxes
     */
    static calculateIntersectionArea(box1, box2) {
        const left = Math.max(box1.x, box2.x);
        const right = Math.min(box1.x + box1.width, box2.x + box2.width);
        const top = Math.max(box1.y, box2.y);
        const bottom = Math.min(box1.y + box1.height, box2.y + box2.height);
        if (left >= right || top >= bottom) {
            return 0; // No intersection
        }
        return (right - left) * (bottom - top);
    }
    /**
     * Calculate Intersection over Union (IoU) for two bounding boxes
     */
    static calculateIoU(box1, box2) {
        const intersectionArea = this.calculateIntersectionArea(box1, box2);
        const unionArea = box1.area + box2.area - intersectionArea;
        return unionArea > 0 ? intersectionArea / unionArea : 0;
    }
    /**
     * Rotate a point around the origin
     */
    static rotatePoint(x, y, angle) {
        const radians = angle * Math.PI / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        return {
            x: x * cos - y * sin,
            y: x * sin + y * cos,
        };
    }
    /**
     * Get center point of a bounding box
     */
    static getBoundingBoxCenter(boundingBox) {
        return {
            x: boundingBox.x + boundingBox.width / 2,
            y: boundingBox.y + boundingBox.height / 2,
        };
    }
    /**
     * Expand bounding box by a margin
     */
    static expandBoundingBox(boundingBox, margin, imageWidth, imageHeight) {
        const expandedBox = {
            x: boundingBox.x - margin,
            y: boundingBox.y - margin,
            width: boundingBox.width + (margin * 2),
            height: boundingBox.height + (margin * 2),
            area: (boundingBox.width + (margin * 2)) * (boundingBox.height + (margin * 2)),
        };
        // Only set rotation if it exists
        if (boundingBox.rotation !== undefined) {
            expandedBox.rotation = boundingBox.rotation;
        }
        // Clamp to image boundaries if provided
        if (imageWidth !== undefined && imageHeight !== undefined) {
            expandedBox.x = Math.max(0, expandedBox.x);
            expandedBox.y = Math.max(0, expandedBox.y);
            expandedBox.width = Math.min(expandedBox.width, imageWidth - expandedBox.x);
            expandedBox.height = Math.min(expandedBox.height, imageHeight - expandedBox.y);
            expandedBox.area = expandedBox.width * expandedBox.height;
        }
        return expandedBox;
    }
    /**
     * Merge overlapping bounding boxes
     */
    static mergeBoundingBoxes(boxes, overlapThreshold = 0.3) {
        if (boxes.length <= 1)
            return boxes;
        const merged = [];
        const used = new Set();
        for (let i = 0; i < boxes.length; i++) {
            if (used.has(i))
                continue;
            let currentBox = boxes[i];
            used.add(i);
            // Find overlapping boxes
            for (let j = i + 1; j < boxes.length; j++) {
                if (used.has(j))
                    continue;
                const iou = this.calculateIoU(currentBox, boxes[j]);
                if (iou > overlapThreshold) {
                    // Merge boxes
                    const minX = Math.min(currentBox.x, boxes[j].x);
                    const minY = Math.min(currentBox.y, boxes[j].y);
                    const maxX = Math.max(currentBox.x + currentBox.width, boxes[j].x + boxes[j].width);
                    const maxY = Math.max(currentBox.y + currentBox.height, boxes[j].y + boxes[j].height);
                    const mergedBox = {
                        x: minX,
                        y: minY,
                        width: maxX - minX,
                        height: maxY - minY,
                        area: (maxX - minX) * (maxY - minY),
                    };
                    // Keep original rotation if it exists
                    if (currentBox.rotation !== undefined) {
                        mergedBox.rotation = currentBox.rotation;
                    }
                    currentBox = mergedBox;
                    used.add(j);
                }
            }
            merged.push(currentBox);
        }
        return merged;
    }
    /**
     * Validate coordinate values
     */
    static validateCoordinates(point, imageWidth, imageHeight) {
        return (point.x >= 0 &&
            point.x <= imageWidth &&
            point.y >= 0 &&
            point.y <= imageHeight &&
            !isNaN(point.x) &&
            !isNaN(point.y));
    }
    /**
     * Validate bounding box
     */
    static validateBoundingBox(box, imageWidth, imageHeight) {
        if (box.width <= 0 || box.height <= 0 || isNaN(box.x) || isNaN(box.y)) {
            return false;
        }
        if (imageWidth !== undefined && imageHeight !== undefined) {
            return (box.x >= 0 &&
                box.y >= 0 &&
                box.x + box.width <= imageWidth &&
                box.y + box.height <= imageHeight);
        }
        return true;
    }
}
exports.CoordinateMapper = CoordinateMapper;
//# sourceMappingURL=coordinate-mapper.js.map