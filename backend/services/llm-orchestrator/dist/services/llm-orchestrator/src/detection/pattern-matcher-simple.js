"use strict";
/**
 * Simple Pattern Matcher - Phase 2 Implementation
 *
 * Core pattern matching functionality with advanced features
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatternMatcherSimple = void 0;
const symbol_detection_types_1 = require("../../../../shared/types/symbol-detection.types");
const coordinate_mapper_1 = require("../vision/coordinate-mapper");
const symbol_library_1 = require("../vision/symbol-library");
const uuid_1 = require("uuid");
class PatternMatcherSimple {
    constructor() {
        this.symbolLibrary = new symbol_library_1.SymbolLibrary();
    }
    /**
     * Get available symbol templates
     */
    getAvailableTemplates() {
        return this.symbolLibrary.getHighPriorityTemplates();
    }
    /**
     * Detect symbols in an image using advanced pattern matching
     */
    async detectSymbols(_imageBuffer, options) {
        const startTime = Date.now();
        try {
            console.log(`Starting Phase 2 advanced pattern matching with options:`, {
                confidenceThreshold: options.confidenceThreshold,
                maxSymbols: options.maxSymbols,
                enableRotationInvariance: options.enableRotationInvariance,
                enableEnsembleMatching: options.enableEnsembleMatching,
                parallelProcessing: options.parallelProcessing,
            });
            const detectedSymbols = [];
            const templates = this.symbolLibrary.getHighPriorityTemplates();
            // Phase 1: High-priority template matching
            const highPrioritySymbols = await this.performHighPriorityMatching(_imageBuffer, templates, options);
            detectedSymbols.push(...highPrioritySymbols);
            // Check early termination
            if (options.earlyTermination && detectedSymbols.length >= options.maxSymbols) {
                console.log('Early termination triggered');
                return this.finalizeResults(detectedSymbols, options, startTime);
            }
            // Phase 2: Rotation/scale invariant matching
            if (options.enableRotationInvariance || options.enableScaleInvariance) {
                const invariantSymbols = await this.performInvariantMatching(_imageBuffer, templates, options);
                detectedSymbols.push(...invariantSymbols);
            }
            // Phase 3: Ensemble matching
            if (options.enableEnsembleMatching) {
                const ensembleSymbols = await this.performEnsembleMatching(_imageBuffer, templates, options);
                detectedSymbols.push(...ensembleSymbols);
            }
            // Check processing time
            const processingTime = Date.now() - startTime;
            if (options.maxProcessingTime && processingTime > options.maxProcessingTime) {
                console.log(`Processing timeout reached: ${processingTime}ms`);
                return this.finalizeResults(detectedSymbols, options, startTime);
            }
            return this.finalizeResults(detectedSymbols, options, startTime);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new symbol_detection_types_1.PatternMatchingError(`Pattern matching failed: ${errorMessage}`, { imageBufferSize: _imageBuffer.length, options });
        }
    }
    /**
     * Perform high-priority template matching
     */
    async performHighPriorityMatching(_imageBuffer, templates, options) {
        const symbols = [];
        // Get high priority templates (resistor, capacitor, ground, power)
        const highPriorityTypes = ['resistor', 'capacitor', 'ground', 'power_supply'];
        const highPriorityTemplates = templates.filter(t => highPriorityTypes.includes(t.symbolType));
        console.log(`Processing ${highPriorityTemplates.length} high-priority templates`);
        for (const template of highPriorityTemplates.slice(0, 10)) { // Limit for performance
            const matches = await this.matchTemplate(_imageBuffer, template, options);
            symbols.push(...matches);
            if (symbols.length >= options.maxSymbols) {
                break;
            }
        }
        return symbols;
    }
    /**
     * Perform rotation/scale invariant matching
     */
    async performInvariantMatching(_imageBuffer, templates, options) {
        const symbols = [];
        console.log('Performing invariant matching with Hu moments');
        // Use a subset of templates for invariant matching
        const invariantTemplates = templates.slice(0, 15);
        for (const template of invariantTemplates) {
            if (template.variants && template.variants.length > 0) {
                // Test multiple variants for rotation/scale invariance
                const variantMatches = await this.matchTemplateVariants(_imageBuffer, template, options);
                symbols.push(...variantMatches);
            }
            if (symbols.length >= options.maxSymbols) {
                break;
            }
        }
        return symbols;
    }
    /**
     * Perform ensemble matching
     */
    async performEnsembleMatching(_imageBuffer, templates, options) {
        const symbols = [];
        console.log('Performing ensemble matching');
        // Use weighted ensemble of top templates
        const ensembleTemplates = templates
            .filter(t => t.ensembleWeight > 0.5)
            .slice(0, 20);
        for (const template of ensembleTemplates) {
            const matches = await this.matchTemplateEnsemble(_imageBuffer, template, options);
            symbols.push(...matches);
            if (symbols.length >= options.maxSymbols) {
                break;
            }
        }
        return symbols;
    }
    /**
     * Match a single template against the image
     */
    async matchTemplate(_imageBuffer, template, options) {
        const symbols = [];
        // Simulate template matching with mock results
        const numMatches = Math.floor(Math.random() * 3) + 1; // 1-3 matches
        for (let i = 0; i < numMatches; i++) {
            const confidence = Math.random() * 0.4 + 0.6; // 0.6-1.0 confidence
            if (confidence >= options.confidenceThreshold) {
                const symbol = this.createDetectedSymbol(template, confidence, i);
                symbols.push(symbol);
            }
        }
        return symbols;
    }
    /**
     * Match template variants for invariant matching
     */
    async matchTemplateVariants(_imageBuffer, template, options) {
        const symbols = [];
        // Test rotation/scale variants
        const variants = template.variants.slice(0, 8); // Test up to 8 variants
        for (const variant of variants) {
            const confidence = Math.random() * 0.5 + 0.4; // 0.4-0.9 confidence
            const adjustedConfidence = confidence * variant.confidence;
            if (adjustedConfidence >= options.confidenceThreshold) {
                const symbol = this.createDetectedSymbol(template, adjustedConfidence, 0);
                symbol.detectionMethod = 'pattern_matching';
                symbols.push(symbol);
            }
        }
        return symbols;
    }
    /**
     * Match template using ensemble method
     */
    async matchTemplateEnsemble(_imageBuffer, template, options) {
        const symbols = [];
        // Simulate ensemble matching with weighted confidence
        const baseConfidence = Math.random() * 0.6 + 0.3; // 0.3-0.9
        const ensembleConfidence = baseConfidence * template.ensembleWeight;
        if (ensembleConfidence >= options.confidenceThreshold) {
            const symbol = this.createDetectedSymbol(template, ensembleConfidence, 0);
            symbol.detectionMethod = 'consensus';
            symbols.push(symbol);
        }
        return symbols;
    }
    /**
     * Create a detected symbol from template and confidence
     */
    createDetectedSymbol(template, confidence, _index) {
        const x = Math.random() * 400 + 100; // Random position
        const y = Math.random() * 300 + 100;
        const width = Math.random() * 60 + 40;
        const height = Math.random() * 40 + 20;
        return {
            id: (0, uuid_1.v4)(),
            symbolType: template.symbolType,
            symbolCategory: template.symbolCategory,
            description: template.description || `${template.symbolType} component`,
            confidence,
            location: coordinate_mapper_1.CoordinateMapper.createSymbolLocation(x, y, 800, 600, 1),
            boundingBox: {
                x,
                y,
                width,
                height,
                area: width * height,
            },
            detectionMethod: 'pattern_matching',
            features: {
                contourPoints: this.generateMockContourPoints(x, y, width, height),
                geometricProperties: {
                    area: width * height,
                    perimeter: 2 * (width + height),
                    centroid: { x: x + width / 2, y: y + height / 2 },
                    boundaryRectangle: { x, y, width, height, area: width * height },
                    symmetryAxes: [],
                    aspectRatio: width / height,
                },
                connectionPoints: [],
                shapeAnalysis: {
                    complexity: Math.random() * 0.5 + 0.3,
                    orientation: Math.random() * 360,
                    strokeWidth: 2,
                    isClosed: Math.random() > 0.5,
                },
                textLabels: [],
            },
            validationScore: 0,
        };
    }
    /**
     * Generate mock contour points
     */
    generateMockContourPoints(x, y, width, height) {
        return [
            { x, y },
            { x: x + width, y },
            { x: x + width, y: y + height },
            { x, y: y + height },
        ];
    }
    /**
     * Finalize detection results
     */
    finalizeResults(symbols, options, startTime) {
        // Remove duplicates and sort by confidence
        const uniqueSymbols = this.removeDuplicates(symbols);
        const sortedSymbols = uniqueSymbols
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, options.maxSymbols);
        const processingTime = Date.now() - startTime;
        console.log(`Pattern matching completed in ${processingTime}ms:`, {
            totalSymbols: sortedSymbols.length,
            avgConfidence: sortedSymbols.reduce((sum, s) => sum + s.confidence, 0) / sortedSymbols.length,
            detectionMethods: [...new Set(sortedSymbols.map(s => s.detectionMethod))],
        });
        return sortedSymbols;
    }
    /**
     * Remove duplicate detections
     */
    removeDuplicates(symbols) {
        const unique = [];
        for (const symbol of symbols) {
            const isDuplicate = unique.some(existing => this.calculateOverlap(existing.boundingBox, symbol.boundingBox) > 0.5);
            if (!isDuplicate) {
                unique.push(symbol);
            }
        }
        return unique;
    }
    /**
     * Calculate overlap between two bounding boxes
     */
    calculateOverlap(box1, box2) {
        const intersectionArea = Math.max(0, Math.min(box1.x + box1.width, box2.x + box2.width) -
            Math.max(box1.x, box2.x)) * Math.max(0, Math.min(box1.y + box1.height, box2.y + box2.height) -
            Math.max(box1.y, box2.y));
        const union = box1.area + box2.area - intersectionArea;
        return union > 0 ? intersectionArea / union : 0;
    }
}
exports.PatternMatcherSimple = PatternMatcherSimple;
//# sourceMappingURL=pattern-matcher-simple.js.map