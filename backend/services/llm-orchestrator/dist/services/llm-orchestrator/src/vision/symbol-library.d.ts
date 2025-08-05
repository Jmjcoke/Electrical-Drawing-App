/**
 * Advanced Electrical Symbol Library - Phase 2
 *
 * Comprehensive electrical symbol reference library with 50+ templates,
 * rotation/scale invariant matching, and multi-template ensemble support
 * for advanced pattern matching and classification
 */
import { ElectricalSymbolType, SymbolCategory } from '../../../../shared/types/symbol-detection.types';
export interface SymbolTemplate {
    id: string;
    symbolType: ElectricalSymbolType;
    symbolCategory: SymbolCategory;
    name: string;
    description: string;
    standardType: 'IEEE' | 'IEC' | 'ANSI' | 'JIS' | 'Custom';
    templateImage: Buffer;
    variants: SymbolVariant[];
    metadata: SymbolMetadata;
    features: SymbolFeatures;
    priority: number;
    ensembleWeight: number;
}
export interface SymbolVariant {
    id: string;
    name: string;
    rotation: number;
    scale: number;
    mirrored: boolean;
    templateImage: Buffer;
    usage: string;
    confidence: number;
    features: SymbolFeatures;
    keyPoints: KeyPoint[];
}
export interface SymbolMetadata {
    commonNames: string[];
    applications: string[];
    electricalProperties: ElectricalProperties;
    physicalCharacteristics: PhysicalCharacteristics;
    connectionPoints: ConnectionPoint[];
    tags: string[];
}
export interface ElectricalProperties {
    componentType: 'passive' | 'active' | 'connector' | 'power' | 'protection' | 'logic';
    typicalValues?: string[];
    operatingVoltage?: string;
    powerRating?: string;
    frequency?: string;
    polarity?: 'none' | 'polarized' | 'bidirectional';
}
export interface PhysicalCharacteristics {
    typicalAspectRatio: number;
    minSize: {
        width: number;
        height: number;
    };
    maxSize: {
        width: number;
        height: number;
    };
    shapeComplexity: number;
    hasTextLabel: boolean;
    symmetryType: 'none' | 'horizontal' | 'vertical' | 'both' | 'radial';
}
export interface ConnectionPoint {
    id: string;
    position: {
        x: number;
        y: number;
    };
    type: 'input' | 'output' | 'bidirectional' | 'ground' | 'power';
    required: boolean;
    label?: string;
}
export interface SymbolFeatures {
    contourSignature: number[];
    geometricMoments: number[];
    shapeDescriptors: number[];
    textureFeatures: number[];
    colorProfile?: number[];
    invariantMoments: number[];
    keyPoints: KeyPoint[];
    descriptors: number[][];
}
export interface KeyPoint {
    x: number;
    y: number;
    size: number;
    angle: number;
    response: number;
}
export interface DrawingSpec {
    name: string;
    drawFunction: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
    aspectRatio: number;
    priority: number;
    ensembleWeight: number;
    industryStandard: 'IEEE' | 'IEC' | 'ANSI' | 'JIS';
}
export declare class SymbolLibrary {
    private templates;
    private symbolsByType;
    private symbolsByCategory;
    private highPriorityTemplates;
    private ensembleTemplates;
    private isInitialized;
    private templateSize;
    constructor();
    /**
     * Get symbol template by ID
     */
    getTemplate(id: string): SymbolTemplate | undefined;
    /**
     * Get all templates for a symbol type
     */
    getTemplatesByType(symbolType: ElectricalSymbolType): SymbolTemplate[];
    /**
     * Get all templates for a symbol category
     */
    getTemplatesByCategory(category: SymbolCategory): SymbolTemplate[];
    /**
     * Search templates by name or description
     */
    searchTemplates(query: string): SymbolTemplate[];
    /**
     * Get templates matching electrical properties
     */
    getTemplatesByProperties(properties: Partial<ElectricalProperties>): SymbolTemplate[];
    /**
     * Add custom template to library
     */
    addTemplate(template: SymbolTemplate): void;
    /**
     * Remove template from library
     */
    removeTemplate(id: string): boolean;
    /**
     * Get all available symbol types
     */
    getAvailableSymbolTypes(): ElectricalSymbolType[];
    /**
     * Get all available symbol categories
     */
    getAvailableCategories(): SymbolCategory[];
    /**
     * Get high priority templates for initial matching
     */
    getHighPriorityTemplates(): SymbolTemplate[];
    /**
     * Get templates for ensemble matching
     */
    getEnsembleTemplates(): SymbolTemplate[];
    /**
     * Get templates sorted by priority within a type
     */
    getTemplatesByTypeSorted(symbolType: ElectricalSymbolType): SymbolTemplate[];
    /**
     * Get templates for rotation/scale invariant matching
     */
    getInvariantTemplates(): SymbolTemplate[];
    /**
     * Get library statistics
     */
    getLibraryStats(): {
        totalTemplates: number;
        typeBreakdown: Record<ElectricalSymbolType, number>;
        categoryBreakdown: Record<SymbolCategory, number>;
        standardBreakdown: Record<string, number>;
    };
    /**
     * Initialize comprehensive symbol library with 50+ templates
     */
    private initializeLibrary;
    /**
     * Get comprehensive drawing specifications for 50+ electrical symbols
     */
    private getComprehensiveDrawingSpecs;
    /**
     * Create advanced symbol template with rotation/scale variants
     */
    private createAdvancedSymbolTemplate;
    /**
     * Generate symbol image and extract features
     */
    private generateSymbolImage;
    /**
     * Extract advanced features including rotation/scale invariant features
     */
    private extractAdvancedFeatures;
    /**
     * Calculate base confidence for variants
     */
    private calculateVariantBaseConfidence;
    /**
     * Create symbol metadata based on specification
     */
    private createSymbolMetadata;
    /**
     * Organize templates for efficient matching
     */
    private organizeTemplatesForMatching;
    /**
     * Get total number of variants across all templates
     */
    private getTotalVariants;
    /**
     * Get symbol category from symbol type
     */
    private getSymbolCategory;
    /**
     * Create legacy standard electrical symbol templates (for backward compatibility)
     */
    private createStandardTemplates;
    /**
     * Create additional symbol templates
     */
    private createAdditionalTemplates;
    /**
     * Create mock template images (in real implementation, these would be actual symbol images)
     */
    private createResistorTemplate;
    private createVariableResistorTemplate;
    private createCapacitorTemplate;
    private createPolarizedCapacitorTemplate;
    private createInductorTemplate;
    private createGroundTemplate;
    /**
     * Update indices when adding a template
     */
    private updateIndices;
    /**
     * Remove template from indices
     */
    private removeFromIndices;
}
//# sourceMappingURL=symbol-library.d.ts.map