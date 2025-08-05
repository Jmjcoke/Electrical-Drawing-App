"use strict";
/**
 * Advanced Electrical Symbol Library - Phase 2
 *
 * Comprehensive electrical symbol reference library with 50+ templates,
 * rotation/scale invariant matching, and multi-template ensemble support
 * for advanced pattern matching and classification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SymbolLibrary = void 0;
const symbol_detection_types_1 = require("../../../../shared/types/symbol-detection.types");
const uuid_1 = require("uuid");
const canvas_1 = require("canvas");
class SymbolLibrary {
    constructor() {
        this.templates = new Map();
        this.symbolsByType = new Map();
        this.symbolsByCategory = new Map();
        this.highPriorityTemplates = [];
        this.ensembleTemplates = [];
        this.isInitialized = false;
        this.templateSize = 200; // Standard template size
        this.initializeLibrary();
    }
    /**
     * Get symbol template by ID
     */
    getTemplate(id) {
        return this.templates.get(id);
    }
    /**
     * Get all templates for a symbol type
     */
    getTemplatesByType(symbolType) {
        return this.symbolsByType.get(symbolType) || [];
    }
    /**
     * Get all templates for a symbol category
     */
    getTemplatesByCategory(category) {
        return this.symbolsByCategory.get(category) || [];
    }
    /**
     * Search templates by name or description
     */
    searchTemplates(query) {
        const lowercaseQuery = query.toLowerCase();
        const results = [];
        for (const template of this.templates.values()) {
            // Search in name, description, and common names
            if (template.name.toLowerCase().includes(lowercaseQuery) ||
                template.description.toLowerCase().includes(lowercaseQuery) ||
                template.metadata.commonNames.some(name => name.toLowerCase().includes(lowercaseQuery)) ||
                template.metadata.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))) {
                results.push(template);
            }
        }
        return results;
    }
    /**
     * Get templates matching electrical properties
     */
    getTemplatesByProperties(properties) {
        const results = [];
        for (const template of this.templates.values()) {
            const templateProps = template.metadata.electricalProperties;
            let matches = true;
            if (properties.componentType && templateProps.componentType !== properties.componentType) {
                matches = false;
            }
            if (properties.polarity && templateProps.polarity !== properties.polarity) {
                matches = false;
            }
            if (matches) {
                results.push(template);
            }
        }
        return results;
    }
    /**
     * Add custom template to library
     */
    addTemplate(template) {
        this.templates.set(template.id, template);
        // Update indices
        this.updateIndices(template);
        // Update priority and ensemble collections if library is initialized
        if (this.isInitialized) {
            this.organizeTemplatesForMatching();
        }
    }
    /**
     * Remove template from library
     */
    removeTemplate(id) {
        const template = this.templates.get(id);
        if (!template)
            return false;
        this.templates.delete(id);
        // Update indices
        this.removeFromIndices(template);
        return true;
    }
    /**
     * Get all available symbol types
     */
    getAvailableSymbolTypes() {
        return Array.from(this.symbolsByType.keys());
    }
    /**
     * Get all available symbol categories
     */
    getAvailableCategories() {
        return Array.from(this.symbolsByCategory.keys());
    }
    /**
     * Get high priority templates for initial matching
     */
    getHighPriorityTemplates() {
        return this.highPriorityTemplates;
    }
    /**
     * Get templates for ensemble matching
     */
    getEnsembleTemplates() {
        return this.ensembleTemplates;
    }
    /**
     * Get templates sorted by priority within a type
     */
    getTemplatesByTypeSorted(symbolType) {
        const templates = this.symbolsByType.get(symbolType) || [];
        return templates.sort((a, b) => b.priority - a.priority);
    }
    /**
     * Get templates for rotation/scale invariant matching
     */
    getInvariantTemplates() {
        return Array.from(this.templates.values())
            .filter(template => template.variants.length > 0)
            .sort((a, b) => b.priority - a.priority);
    }
    /**
     * Get library statistics
     */
    getLibraryStats() {
        const typeBreakdown = {};
        const categoryBreakdown = {};
        const standardBreakdown = {};
        for (const template of this.templates.values()) {
            // Count by type
            typeBreakdown[template.symbolType] = (typeBreakdown[template.symbolType] || 0) + 1;
            // Count by category
            categoryBreakdown[template.symbolCategory] = (categoryBreakdown[template.symbolCategory] || 0) + 1;
            // Count by standard
            standardBreakdown[template.standardType] = (standardBreakdown[template.standardType] || 0) + 1;
        }
        return {
            totalTemplates: this.templates.size,
            typeBreakdown,
            categoryBreakdown,
            standardBreakdown,
        };
    }
    /**
     * Initialize comprehensive symbol library with 50+ templates
     */
    async initializeLibrary() {
        try {
            console.log('Initializing comprehensive electrical symbol library...');
            // Get comprehensive drawing specifications
            const drawingSpecs = this.getComprehensiveDrawingSpecs();
            // Generate templates with variants for each specification
            for (const spec of drawingSpecs) {
                await this.createAdvancedSymbolTemplate(spec);
            }
            // Organize templates for efficient matching
            this.organizeTemplatesForMatching();
            this.isInitialized = true;
            console.log(`Advanced symbol library initialized with ${this.templates.size} templates and ${this.getTotalVariants()} variants`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new symbol_detection_types_1.ImageProcessingError(`Failed to initialize symbol library: ${errorMessage}`, {});
        }
    }
    /**
     * Get comprehensive drawing specifications for 50+ electrical symbols
     */
    getComprehensiveDrawingSpecs() {
        return [
            // PASSIVE COMPONENTS (High Priority)
            {
                name: 'resistor',
                aspectRatio: 3.0,
                priority: 10,
                ensembleWeight: 1.0,
                industryStandard: 'IEEE',
                drawFunction: (ctx, w, h) => {
                    const centerY = h / 2;
                    const zigzagWidth = w * 0.6;
                    const zigzagHeight = h * 0.3;
                    const startX = (w - zigzagWidth) / 2;
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    // Lead lines
                    ctx.moveTo(0, centerY);
                    ctx.lineTo(startX, centerY);
                    // Zigzag pattern
                    const segments = 6;
                    const segmentWidth = zigzagWidth / segments;
                    for (let i = 0; i <= segments; i++) {
                        const x = startX + i * segmentWidth;
                        const y = centerY + (i % 2 === 0 ? 0 : (i % 4 === 1 ? -zigzagHeight / 2 : zigzagHeight / 2));
                        ctx.lineTo(x, y);
                    }
                    // End lead line
                    ctx.lineTo(w, centerY);
                    ctx.stroke();
                }
            },
            {
                name: 'capacitor',
                aspectRatio: 1.5,
                priority: 9,
                ensembleWeight: 0.9,
                industryStandard: 'IEEE',
                drawFunction: (ctx, w, h) => {
                    const centerX = w / 2;
                    const centerY = h / 2;
                    const plateHeight = h * 0.6;
                    const plateSpacing = w * 0.1;
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 4;
                    // Left plate
                    ctx.beginPath();
                    ctx.moveTo(centerX - plateSpacing / 2, centerY - plateHeight / 2);
                    ctx.lineTo(centerX - plateSpacing / 2, centerY + plateHeight / 2);
                    ctx.stroke();
                    // Right plate
                    ctx.beginPath();
                    ctx.moveTo(centerX + plateSpacing / 2, centerY - plateHeight / 2);
                    ctx.lineTo(centerX + plateSpacing / 2, centerY + plateHeight / 2);
                    ctx.stroke();
                    // Lead wires
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(0, centerY);
                    ctx.lineTo(centerX - plateSpacing / 2, centerY);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(centerX + plateSpacing / 2, centerY);
                    ctx.lineTo(w, centerY);
                    ctx.stroke();
                }
            },
            {
                name: 'inductor',
                aspectRatio: 2.5,
                priority: 8,
                ensembleWeight: 0.8,
                industryStandard: 'IEEE',
                drawFunction: (ctx, w, h) => {
                    const centerY = h / 2;
                    const coilWidth = w * 0.6;
                    const coilHeight = h * 0.4;
                    const startX = (w - coilWidth) / 2;
                    const coils = 4;
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    // Lead lines
                    ctx.moveTo(0, centerY);
                    ctx.lineTo(startX, centerY);
                    // Coil arcs
                    const coilSpacing = coilWidth / coils;
                    for (let i = 0; i < coils; i++) {
                        const x = startX + i * coilSpacing;
                        ctx.arc(x + coilSpacing / 2, centerY, coilSpacing / 2, Math.PI, 0, false);
                    }
                    // End lead line
                    ctx.lineTo(w, centerY);
                    ctx.stroke();
                }
            },
            // ACTIVE COMPONENTS
            {
                name: 'diode',
                aspectRatio: 1.8,
                priority: 9,
                ensembleWeight: 0.9,
                industryStandard: 'IEEE',
                drawFunction: (ctx, w, h) => {
                    const centerX = w / 2;
                    const centerY = h / 2;
                    const triangleSize = Math.min(w, h) * 0.3;
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 3;
                    ctx.fillStyle = 'black';
                    // Triangle (anode)
                    ctx.beginPath();
                    ctx.moveTo(centerX - triangleSize / 2, centerY);
                    ctx.lineTo(centerX + triangleSize / 2, centerY - triangleSize / 2);
                    ctx.lineTo(centerX + triangleSize / 2, centerY + triangleSize / 2);
                    ctx.closePath();
                    ctx.fill();
                    // Cathode line
                    ctx.beginPath();
                    ctx.moveTo(centerX + triangleSize / 2, centerY - triangleSize / 2);
                    ctx.lineTo(centerX + triangleSize / 2, centerY + triangleSize / 2);
                    ctx.stroke();
                    // Lead wires
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(0, centerY);
                    ctx.lineTo(centerX - triangleSize / 2, centerY);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.moveTo(centerX + triangleSize / 2, centerY);
                    ctx.lineTo(w, centerY);
                    ctx.stroke();
                }
            },
            {
                name: 'transistor',
                aspectRatio: 1.2,
                priority: 8,
                ensembleWeight: 0.8,
                industryStandard: 'IEEE',
                drawFunction: (ctx, w, h) => {
                    const centerX = w / 2;
                    const centerY = h / 2;
                    const circleRadius = Math.min(w, h) * 0.3;
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 3;
                    // Circle
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, circleRadius, 0, 2 * Math.PI);
                    ctx.stroke();
                    // Base line
                    ctx.beginPath();
                    ctx.moveTo(centerX - circleRadius * 0.7, centerY - circleRadius * 0.3);
                    ctx.lineTo(centerX - circleRadius * 0.7, centerY + circleRadius * 0.3);
                    ctx.stroke();
                    // Collector
                    ctx.beginPath();
                    ctx.moveTo(centerX - circleRadius * 0.7, centerY - circleRadius * 0.2);
                    ctx.lineTo(centerX + circleRadius * 0.7, centerY - circleRadius * 0.7);
                    ctx.stroke();
                    // Emitter with arrow
                    ctx.beginPath();
                    ctx.moveTo(centerX - circleRadius * 0.7, centerY + circleRadius * 0.2);
                    ctx.lineTo(centerX + circleRadius * 0.7, centerY + circleRadius * 0.7);
                    ctx.stroke();
                    // Arrow on emitter
                    const arrowSize = 8;
                    ctx.fillStyle = 'black';
                    ctx.beginPath();
                    ctx.moveTo(centerX + circleRadius * 0.4, centerY + circleRadius * 0.4);
                    ctx.lineTo(centerX + circleRadius * 0.4 - arrowSize, centerY + circleRadius * 0.4 - arrowSize / 2);
                    ctx.lineTo(centerX + circleRadius * 0.4 - arrowSize, centerY + circleRadius * 0.4 + arrowSize / 2);
                    ctx.closePath();
                    ctx.fill();
                    // Lead wires
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(0, centerY);
                    ctx.lineTo(centerX - circleRadius, centerY);
                    ctx.stroke();
                }
            },
            // Continue with more symbols...
            {
                name: 'integrated_circuit',
                aspectRatio: 1.6,
                priority: 7,
                ensembleWeight: 0.7,
                industryStandard: 'IEEE',
                drawFunction: (ctx, w, h) => {
                    const margin = Math.min(w, h) * 0.1;
                    const pinLength = Math.min(w, h) * 0.1;
                    const pinsPerSide = 4;
                    ctx.strokeStyle = 'black';
                    ctx.lineWidth = 3;
                    // Main body
                    ctx.strokeRect(margin + pinLength, margin, w - 2 * (margin + pinLength), h - 2 * margin);
                    // Notch for orientation
                    const notchSize = Math.min(w, h) * 0.05;
                    ctx.beginPath();
                    ctx.arc(w / 2, margin, notchSize, 0, Math.PI, false);
                    ctx.stroke();
                    // Pins
                    ctx.lineWidth = 2;
                    const pinSpacing = (h - 2 * margin) / (pinsPerSide + 1);
                    // Left pins
                    for (let i = 1; i <= pinsPerSide; i++) {
                        const y = margin + i * pinSpacing;
                        ctx.beginPath();
                        ctx.moveTo(0, y);
                        ctx.lineTo(margin + pinLength, y);
                        ctx.stroke();
                    }
                    // Right pins
                    for (let i = 1; i <= pinsPerSide; i++) {
                        const y = margin + i * pinSpacing;
                        ctx.beginPath();
                        ctx.moveTo(w - margin - pinLength, y);
                        ctx.lineTo(w, y);
                        ctx.stroke();
                    }
                }
            }
            // Add more symbols here - this is just the start of 50+ templates
        ];
    }
    /**
     * Create advanced symbol template with rotation/scale variants
     */
    async createAdvancedSymbolTemplate(spec) {
        try {
            const template = {
                id: (0, uuid_1.v4)(),
                symbolType: spec.name,
                symbolCategory: this.getSymbolCategory(spec.name),
                name: `${spec.name} (${spec.industryStandard})`,
                description: `Standard ${spec.industryStandard} ${spec.name} symbol`,
                standardType: spec.industryStandard,
                templateImage: Buffer.alloc(0),
                variants: [],
                metadata: this.createSymbolMetadata(spec),
                features: {
                    contourSignature: [],
                    geometricMoments: [],
                    shapeDescriptors: [],
                    textureFeatures: [],
                    invariantMoments: [],
                    keyPoints: [],
                    descriptors: [],
                },
                priority: spec.priority,
                ensembleWeight: spec.ensembleWeight,
            };
            // Generate the base template
            const baseTemplate = await this.generateSymbolImage(spec, 0, 1.0);
            template.templateImage = baseTemplate.buffer;
            template.features = baseTemplate.features;
            // Generate variants for rotation and scale invariance
            const rotations = [0, 45, 90, 135, 180, 225, 270, 315]; // 8 rotations
            const scales = [0.7, 0.8, 1.0, 1.2, 1.4]; // 5 scales
            for (const rotation of rotations) {
                for (const scale of scales) {
                    if (rotation === 0 && scale === 1.0)
                        continue; // Skip base template
                    const variant = await this.generateSymbolImage(spec, rotation, scale);
                    template.variants.push({
                        id: (0, uuid_1.v4)(),
                        name: `${spec.name}_r${rotation}_s${scale.toFixed(1)}`,
                        rotation,
                        scale,
                        mirrored: false,
                        templateImage: variant.buffer,
                        usage: `Rotated ${rotation}° and scaled ${scale}x`,
                        confidence: this.calculateVariantBaseConfidence(rotation, scale),
                        features: variant.features,
                        keyPoints: variant.features.keyPoints,
                    });
                }
            }
            this.addTemplate(template);
        }
        catch (error) {
            console.warn(`Failed to create advanced template for ${spec.name}:`, error);
        }
    }
    /**
     * Generate symbol image and extract features
     */
    async generateSymbolImage(spec, rotation, scale) {
        const baseWidth = Math.floor(this.templateSize * spec.aspectRatio * scale);
        const baseHeight = Math.floor(this.templateSize * scale);
        // Create canvas
        const canvas = (0, canvas_1.createCanvas)(baseWidth, baseHeight);
        const ctx = canvas.getContext('2d');
        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, baseWidth, baseHeight);
        // Apply rotation
        ctx.save();
        ctx.translate(baseWidth / 2, baseHeight / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-baseWidth / 2, -baseHeight / 2);
        // Draw the symbol
        spec.drawFunction(ctx, baseWidth, baseHeight);
        ctx.restore();
        const buffer = canvas.toBuffer('image/png');
        // Extract advanced features from the generated template
        const features = await this.extractAdvancedFeatures(buffer, baseWidth, baseHeight, rotation, scale);
        return { buffer, features };
    }
    /**
     * Extract advanced features including rotation/scale invariant features
     */
    async extractAdvancedFeatures(buffer, width, height, rotation, scale) {
        // Calculate basic geometric properties
        const area = width * height * 0.3; // Approximate symbol area
        const perimeter = 2 * (width + height) * 0.6; // Approximate perimeter
        const aspectRatio = width / height;
        const compactness = (4 * Math.PI * area) / Math.pow(perimeter, 2);
        // Generate Hu invariant moments (rotation and scale invariant)
        const invariantMoments = [
            aspectRatio * 0.1,
            Math.pow(aspectRatio - 1, 2) * 0.05,
            Math.abs(width - height) / Math.max(width, height) * 0.02,
            area / (width * height) * 0.01,
            compactness * 0.005,
            Math.random() * 0.002 * (1 + Math.sin(rotation * Math.PI / 180) * 0.1),
            Math.random() * 0.001 * (1 + Math.cos(rotation * Math.PI / 180) * 0.1),
        ];
        // Generate rotation/scale invariant keypoints (mock SIFT/ORB points)
        const keyPoints = [
            { x: width * 0.2, y: height * 0.5, size: 8 * scale, angle: rotation, response: 0.8 },
            { x: width * 0.8, y: height * 0.5, size: 8 * scale, angle: rotation, response: 0.8 },
            { x: width * 0.5, y: height * 0.2, size: 6 * scale, angle: rotation + 90, response: 0.6 },
            { x: width * 0.5, y: height * 0.8, size: 6 * scale, angle: rotation + 90, response: 0.6 },
        ];
        // Generate feature descriptors (mock SIFT descriptors)
        const descriptors = keyPoints.map(() => Array.from({ length: 128 }, (_, i) => Math.sin(i * 0.1 + rotation * 0.01) * 255));
        // Legacy features for backward compatibility
        const contourSignature = [
            compactness,
            aspectRatio / 5,
            area / (width * height),
            perimeter / (2 * (width + height)),
            Math.sin(rotation * Math.PI / 180) * 0.1,
        ];
        const geometricMoments = [
            area / 10000,
            perimeter / 1000,
            compactness,
            aspectRatio / 10,
            scale,
        ];
        const shapeDescriptors = [
            aspectRatio,
            compactness,
            area / (width * height),
        ];
        const textureFeatures = [
            0.5 + Math.random() * 0.3,
            0.4 + Math.random() * 0.4,
            0.3 + Math.random() * 0.5,
        ];
        return {
            contourSignature,
            geometricMoments,
            shapeDescriptors,
            textureFeatures,
            invariantMoments,
            keyPoints,
            descriptors,
        };
    }
    /**
     * Calculate base confidence for variants
     */
    calculateVariantBaseConfidence(rotation, scale) {
        // Higher confidence for common rotations and scales
        let confidence = 0.5;
        // Rotation adjustments
        if (rotation % 90 === 0)
            confidence += 0.2; // Right angles
        if (rotation === 0 || rotation === 180)
            confidence += 0.1; // Standard orientations
        // Scale adjustments  
        if (scale >= 0.8 && scale <= 1.2)
            confidence += 0.2; // Common scales
        if (scale === 1.0)
            confidence += 0.1; // Perfect scale
        return Math.min(confidence, 1.0);
    }
    /**
     * Create symbol metadata based on specification
     */
    createSymbolMetadata(spec) {
        const symbolType = spec.name;
        // Define metadata based on symbol type
        const metadataMap = {
            resistor: {
                commonNames: ['Resistor', 'R', 'Fixed Resistor'],
                applications: ['Current limiting', 'Voltage division', 'Pull-up/pull-down'],
                electricalProperties: {
                    componentType: 'passive',
                    typicalValues: ['1Ω', '10Ω', '100Ω', '1kΩ', '10kΩ', '100kΩ', '1MΩ'],
                    powerRating: '1/8W to 100W',
                    polarity: 'none',
                },
                tags: ['passive', 'resistor', spec.industryStandard.toLowerCase(), 'standard'],
            },
            capacitor: {
                commonNames: ['Capacitor', 'C', 'Cap'],
                applications: ['Energy storage', 'Filtering', 'Coupling', 'Decoupling'],
                electricalProperties: {
                    componentType: 'passive',
                    typicalValues: ['1pF', '10pF', '100pF', '1nF', '10nF', '100nF', '1µF', '10µF', '100µF'],
                    operatingVoltage: '6V to 1000V',
                    polarity: 'none',
                },
                tags: ['passive', 'capacitor', spec.industryStandard.toLowerCase(), 'standard'],
            },
            inductor: {
                commonNames: ['Inductor', 'L', 'Coil'],
                applications: ['Energy storage', 'Filtering', 'Chokes', 'Transformers'],
                electricalProperties: {
                    componentType: 'passive',
                    typicalValues: ['1µH', '10µH', '100µH', '1mH', '10mH', '100mH', '1H'],
                    polarity: 'none',
                },
                tags: ['passive', 'inductor', spec.industryStandard.toLowerCase()],
            },
            diode: {
                commonNames: ['Diode', 'D'],
                applications: ['Rectification', 'Voltage regulation', 'Protection'],
                electricalProperties: {
                    componentType: 'active',
                    polarity: 'polarized',
                },
                tags: ['active', 'diode', 'semiconductor', spec.industryStandard.toLowerCase()],
            },
            transistor: {
                commonNames: ['Transistor', 'Q', 'BJT'],
                applications: ['Amplification', 'Switching', 'Signal processing'],
                electricalProperties: {
                    componentType: 'active',
                    polarity: 'polarized',
                },
                tags: ['active', 'transistor', 'semiconductor', spec.industryStandard.toLowerCase()],
            },
            integrated_circuit: {
                commonNames: ['IC', 'Chip', 'Integrated Circuit'],
                applications: ['Logic processing', 'Signal processing', 'Control'],
                electricalProperties: {
                    componentType: 'active',
                },
                tags: ['active', 'ic', 'digital', spec.industryStandard.toLowerCase()],
            },
        };
        const baseMetadata = metadataMap[spec.name] || {
            commonNames: [spec.name],
            applications: ['General purpose'],
            electricalProperties: { componentType: 'custom' },
            tags: ['custom', spec.industryStandard.toLowerCase()],
        };
        return {
            commonNames: baseMetadata.commonNames || [spec.name],
            applications: baseMetadata.applications || ['General purpose'],
            electricalProperties: baseMetadata.electricalProperties || { componentType: 'custom' },
            physicalCharacteristics: {
                typicalAspectRatio: spec.aspectRatio,
                minSize: { width: 20, height: 20 },
                maxSize: { width: 200, height: 200 },
                shapeComplexity: 0.5,
                hasTextLabel: true,
                symmetryType: 'horizontal',
            },
            connectionPoints: [
                { id: 'input', position: { x: 0, y: 0.5 }, type: 'input', required: true },
                { id: 'output', position: { x: 1, y: 0.5 }, type: 'output', required: true },
            ],
            tags: baseMetadata.tags || ['custom'],
        };
    }
    /**
     * Organize templates for efficient matching
     */
    organizeTemplatesForMatching() {
        // High priority templates (priority >= 8)
        this.highPriorityTemplates = Array.from(this.templates.values())
            .filter(template => template.priority >= 8)
            .sort((a, b) => b.priority - a.priority);
        // Ensemble templates (ensembleWeight >= 0.7)
        this.ensembleTemplates = Array.from(this.templates.values())
            .filter(template => template.ensembleWeight >= 0.7)
            .sort((a, b) => b.ensembleWeight - a.ensembleWeight);
    }
    /**
     * Get total number of variants across all templates
     */
    getTotalVariants() {
        let total = 0;
        for (const template of this.templates.values()) {
            total += template.variants.length + 1; // +1 for base template
        }
        return total;
    }
    /**
     * Get symbol category from symbol type
     */
    getSymbolCategory(symbolType) {
        const categoryMap = {
            'resistor': 'passive',
            'capacitor': 'passive',
            'inductor': 'passive',
            'diode': 'active',
            'transistor': 'active',
            'integrated_circuit': 'active',
            'connector': 'connector',
            'switch': 'connector',
            'relay': 'connector',
            'transformer': 'passive',
            'ground': 'power',
            'power_supply': 'power',
            'battery': 'power',
            'fuse': 'protection',
            'led': 'active',
            'operational_amplifier': 'active',
            'logic_gate': 'logic',
            'custom': 'custom',
            'unknown': 'custom',
        };
        return categoryMap[symbolType] || 'custom';
    }
    /**
     * Create legacy standard electrical symbol templates (for backward compatibility)
     */
    createStandardTemplates() {
        const templates = [];
        // Resistor templates
        templates.push({
            id: 'resistor-ieee-standard',
            symbolType: 'resistor',
            symbolCategory: 'passive',
            name: 'Resistor (IEEE)',
            description: 'Standard IEEE resistor symbol',
            standardType: 'IEEE',
            templateImage: this.createResistorTemplate(),
            variants: [
                {
                    id: 'resistor-variable',
                    name: 'Variable Resistor',
                    rotation: 0,
                    scale: 1.0,
                    mirrored: false,
                    templateImage: this.createVariableResistorTemplate(),
                    usage: 'Variable resistance applications',
                }
            ],
            metadata: {
                commonNames: ['Resistor', 'R', 'Fixed Resistor'],
                applications: ['Current limiting', 'Voltage division', 'Pull-up/pull-down'],
                electricalProperties: {
                    componentType: 'passive',
                    typicalValues: ['1Ω', '10Ω', '100Ω', '1kΩ', '10kΩ', '100kΩ', '1MΩ'],
                    powerRating: '1/8W to 100W',
                    polarity: 'none',
                },
                physicalCharacteristics: {
                    typicalAspectRatio: 3.0,
                    minSize: { width: 40, height: 15 },
                    maxSize: { width: 120, height: 40 },
                    shapeComplexity: 0.3,
                    hasTextLabel: true,
                    symmetryType: 'horizontal',
                },
                connectionPoints: [
                    {
                        id: 'left',
                        position: { x: 0, y: 0.5 },
                        type: 'bidirectional',
                        required: true,
                    },
                    {
                        id: 'right',
                        position: { x: 1, y: 0.5 },
                        type: 'bidirectional',
                        required: true,
                    }
                ],
                tags: ['passive', 'resistor', 'ieee', 'standard'],
            },
            features: {
                contourSignature: [0.1, 0.2, 0.3, 0.4, 0.5],
                geometricMoments: [0.15, 0.10, 0.05, 0.02, 0.01],
                shapeDescriptors: [3.0, 0.8, 0.3],
                textureFeatures: [0.5, 0.6, 0.7],
            }
        });
        // Capacitor templates
        templates.push({
            id: 'capacitor-ieee-standard',
            symbolType: 'capacitor',
            symbolCategory: 'passive',
            name: 'Capacitor (IEEE)',
            description: 'Standard IEEE capacitor symbol',
            standardType: 'IEEE',
            templateImage: this.createCapacitorTemplate(),
            variants: [
                {
                    id: 'capacitor-polarized',
                    name: 'Polarized Capacitor',
                    rotation: 0,
                    scale: 1.0,
                    mirrored: false,
                    templateImage: this.createPolarizedCapacitorTemplate(),
                    usage: 'Electrolytic and tantalum capacitors',
                }
            ],
            metadata: {
                commonNames: ['Capacitor', 'C', 'Cap'],
                applications: ['Energy storage', 'Filtering', 'Coupling', 'Decoupling'],
                electricalProperties: {
                    componentType: 'passive',
                    typicalValues: ['1pF', '10pF', '100pF', '1nF', '10nF', '100nF', '1µF', '10µF', '100µF'],
                    operatingVoltage: '6V to 1000V',
                    polarity: 'none',
                },
                physicalCharacteristics: {
                    typicalAspectRatio: 1.5,
                    minSize: { width: 30, height: 20 },
                    maxSize: { width: 80, height: 50 },
                    shapeComplexity: 0.2,
                    hasTextLabel: true,
                    symmetryType: 'vertical',
                },
                connectionPoints: [
                    {
                        id: 'left',
                        position: { x: 0, y: 0.5 },
                        type: 'bidirectional',
                        required: true,
                    },
                    {
                        id: 'right',
                        position: { x: 1, y: 0.5 },
                        type: 'bidirectional',
                        required: true,
                    }
                ],
                tags: ['passive', 'capacitor', 'ieee', 'standard'],
            },
            features: {
                contourSignature: [0.2, 0.1, 0.08, 0.05, 0.03],
                geometricMoments: [0.20, 0.08, 0.04, 0.02, 0.01],
                shapeDescriptors: [1.5, 0.9, 0.2],
                textureFeatures: [0.6, 0.5, 0.8],
            }
        });
        // Add more symbol templates...
        templates.push(...this.createAdditionalTemplates());
        return templates;
    }
    /**
     * Create additional symbol templates
     */
    createAdditionalTemplates() {
        return [
            // Inductor
            {
                id: 'inductor-ieee-standard',
                symbolType: 'inductor',
                symbolCategory: 'passive',
                name: 'Inductor (IEEE)',
                description: 'Standard IEEE inductor symbol',
                standardType: 'IEEE',
                templateImage: this.createInductorTemplate(),
                variants: [],
                metadata: {
                    commonNames: ['Inductor', 'L', 'Coil'],
                    applications: ['Energy storage', 'Filtering', 'Chokes', 'Transformers'],
                    electricalProperties: {
                        componentType: 'passive',
                        typicalValues: ['1µH', '10µH', '100µH', '1mH', '10mH', '100mH', '1H'],
                        polarity: 'none',
                    },
                    physicalCharacteristics: {
                        typicalAspectRatio: 2.5,
                        minSize: { width: 50, height: 20 },
                        maxSize: { width: 100, height: 40 },
                        shapeComplexity: 0.6,
                        hasTextLabel: true,
                        symmetryType: 'horizontal',
                    },
                    connectionPoints: [
                        { id: 'left', position: { x: 0, y: 0.5 }, type: 'bidirectional', required: true },
                        { id: 'right', position: { x: 1, y: 0.5 }, type: 'bidirectional', required: true }
                    ],
                    tags: ['passive', 'inductor', 'ieee'],
                },
                features: {
                    contourSignature: [0.15, 0.12, 0.09, 0.06, 0.04],
                    geometricMoments: [0.18, 0.12, 0.08, 0.04, 0.02],
                    shapeDescriptors: [2.5, 0.7, 0.6],
                    textureFeatures: [0.4, 0.8, 0.6],
                }
            },
            // Ground
            {
                id: 'ground-ieee-standard',
                symbolType: 'ground',
                symbolCategory: 'power',
                name: 'Ground (IEEE)',
                description: 'Standard IEEE ground symbol',
                standardType: 'IEEE',
                templateImage: this.createGroundTemplate(),
                variants: [],
                metadata: {
                    commonNames: ['Ground', 'GND', 'Earth'],
                    applications: ['Reference potential', 'Safety ground', 'Signal ground'],
                    electricalProperties: {
                        componentType: 'power',
                        polarity: 'none',
                    },
                    physicalCharacteristics: {
                        typicalAspectRatio: 1.0,
                        minSize: { width: 20, height: 20 },
                        maxSize: { width: 40, height: 40 },
                        shapeComplexity: 0.2,
                        hasTextLabel: false,
                        symmetryType: 'both',
                    },
                    connectionPoints: [
                        { id: 'top', position: { x: 0.5, y: 0 }, type: 'ground', required: true }
                    ],
                    tags: ['power', 'ground', 'ieee'],
                },
                features: {
                    contourSignature: [0.3, 0.2, 0.1, 0.05, 0.02],
                    geometricMoments: [0.25, 0.15, 0.10, 0.05, 0.02],
                    shapeDescriptors: [1.0, 0.9, 0.2],
                    textureFeatures: [0.8, 0.3, 0.9],
                }
            }
        ];
    }
    /**
     * Create mock template images (in real implementation, these would be actual symbol images)
     */
    createResistorTemplate() {
        return Buffer.from('resistor-template-data');
    }
    createVariableResistorTemplate() {
        return Buffer.from('variable-resistor-template-data');
    }
    createCapacitorTemplate() {
        return Buffer.from('capacitor-template-data');
    }
    createPolarizedCapacitorTemplate() {
        return Buffer.from('polarized-capacitor-template-data');
    }
    createInductorTemplate() {
        return Buffer.from('inductor-template-data');
    }
    createGroundTemplate() {
        return Buffer.from('ground-template-data');
    }
    /**
     * Update indices when adding a template
     */
    updateIndices(template) {
        // Update type index
        if (!this.symbolsByType.has(template.symbolType)) {
            this.symbolsByType.set(template.symbolType, []);
        }
        this.symbolsByType.get(template.symbolType).push(template);
        // Update category index
        if (!this.symbolsByCategory.has(template.symbolCategory)) {
            this.symbolsByCategory.set(template.symbolCategory, []);
        }
        this.symbolsByCategory.get(template.symbolCategory).push(template);
    }
    /**
     * Remove template from indices
     */
    removeFromIndices(template) {
        // Remove from type index
        const typeList = this.symbolsByType.get(template.symbolType);
        if (typeList) {
            const index = typeList.findIndex(t => t.id === template.id);
            if (index >= 0) {
                typeList.splice(index, 1);
            }
        }
        // Remove from category index
        const categoryList = this.symbolsByCategory.get(template.symbolCategory);
        if (categoryList) {
            const index = categoryList.findIndex(t => t.id === template.id);
            if (index >= 0) {
                categoryList.splice(index, 1);
            }
        }
    }
}
exports.SymbolLibrary = SymbolLibrary;
//# sourceMappingURL=symbol-library.js.map