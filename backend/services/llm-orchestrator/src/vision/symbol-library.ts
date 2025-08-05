/**
 * Symbol Library
 * 
 * Electrical symbol reference library with templates and metadata
 * for pattern matching and classification
 */

import { 
  ElectricalSymbolType,
  SymbolCategory,
  ImageProcessingError
} from '../../../../shared/types/symbol-detection.types';

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
}

export interface SymbolVariant {
  id: string;
  name: string;
  rotation: number;
  scale: number;
  mirrored: boolean;
  templateImage: Buffer;
  usage: string;
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
  minSize: { width: number; height: number };
  maxSize: { width: number; height: number };
  shapeComplexity: number;
  hasTextLabel: boolean;
  symmetryType: 'none' | 'horizontal' | 'vertical' | 'both' | 'radial';
}

export interface ConnectionPoint {
  id: string;
  position: { x: number; y: number }; // Normalized coordinates
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
}

export class SymbolLibrary {
  private templates: Map<string, SymbolTemplate> = new Map();
  private symbolsByType: Map<ElectricalSymbolType, SymbolTemplate[]> = new Map();
  private symbolsByCategory: Map<SymbolCategory, SymbolTemplate[]> = new Map();
  private isInitialized = false;

  constructor() {
    this.initializeLibrary();
  }

  /**
   * Get symbol template by ID
   */
  getTemplate(id: string): SymbolTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * Get all templates for a symbol type
   */
  getTemplatesByType(symbolType: ElectricalSymbolType): SymbolTemplate[] {
    return this.symbolsByType.get(symbolType) || [];
  }

  /**
   * Get all templates for a symbol category
   */
  getTemplatesByCategory(category: SymbolCategory): SymbolTemplate[] {
    return this.symbolsByCategory.get(category) || [];
  }

  /**
   * Search templates by name or description
   */
  searchTemplates(query: string): SymbolTemplate[] {
    const lowercaseQuery = query.toLowerCase();
    const results: SymbolTemplate[] = [];

    for (const template of this.templates.values()) {
      // Search in name, description, and common names
      if (
        template.name.toLowerCase().includes(lowercaseQuery) ||
        template.description.toLowerCase().includes(lowercaseQuery) ||
        template.metadata.commonNames.some(name => 
          name.toLowerCase().includes(lowercaseQuery)
        ) ||
        template.metadata.tags.some(tag => 
          tag.toLowerCase().includes(lowercaseQuery)
        )
      ) {
        results.push(template);
      }
    }

    return results;
  }

  /**
   * Get templates matching electrical properties
   */
  getTemplatesByProperties(properties: Partial<ElectricalProperties>): SymbolTemplate[] {
    const results: SymbolTemplate[] = [];

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
  addTemplate(template: SymbolTemplate): void {
    this.templates.set(template.id, template);
    
    // Update indices
    this.updateIndices(template);
  }

  /**
   * Remove template from library
   */
  removeTemplate(id: string): boolean {
    const template = this.templates.get(id);
    if (!template) return false;

    this.templates.delete(id);
    
    // Update indices
    this.removeFromIndices(template);
    
    return true;
  }

  /**
   * Get all available symbol types
   */
  getAvailableSymbolTypes(): ElectricalSymbolType[] {
    return Array.from(this.symbolsByType.keys());
  }

  /**
   * Get all available symbol categories
   */
  getAvailableCategories(): SymbolCategory[] {
    return Array.from(this.symbolsByCategory.keys());
  }

  /**
   * Get library statistics
   */
  getLibraryStats(): {
    totalTemplates: number;
    typeBreakdown: Record<ElectricalSymbolType, number>;
    categoryBreakdown: Record<SymbolCategory, number>;
    standardBreakdown: Record<string, number>;
  } {
    const typeBreakdown: Record<ElectricalSymbolType, number> = {} as any;
    const categoryBreakdown: Record<SymbolCategory, number> = {} as any;
    const standardBreakdown: Record<string, number> = {};

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
   * Initialize symbol library with standard templates
   */
  private async initializeLibrary(): Promise<void> {
    try {
      // Load standard electrical symbol templates
      const standardTemplates = this.createStandardTemplates();
      
      for (const template of standardTemplates) {
        this.addTemplate(template);
      }

      this.isInitialized = true;
      console.log(`Symbol library initialized with ${this.templates.size} templates`);

    } catch (error) {
      throw new ImageProcessingError(
        `Failed to initialize symbol library: ${error.message}`,
        {}
      );
    }
  }

  /**
   * Create standard electrical symbol templates
   */
  private createStandardTemplates(): SymbolTemplate[] {
    const templates: SymbolTemplate[] = [];

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
  private createAdditionalTemplates(): SymbolTemplate[] {
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
  private createResistorTemplate(): Buffer {
    return Buffer.from('resistor-template-data');
  }

  private createVariableResistorTemplate(): Buffer {
    return Buffer.from('variable-resistor-template-data');
  }

  private createCapacitorTemplate(): Buffer {
    return Buffer.from('capacitor-template-data');
  }

  private createPolarizedCapacitorTemplate(): Buffer {
    return Buffer.from('polarized-capacitor-template-data');
  }

  private createInductorTemplate(): Buffer {
    return Buffer.from('inductor-template-data');
  }

  private createGroundTemplate(): Buffer {
    return Buffer.from('ground-template-data');
  }

  /**
   * Update indices when adding a template
   */
  private updateIndices(template: SymbolTemplate): void {
    // Update type index
    if (!this.symbolsByType.has(template.symbolType)) {
      this.symbolsByType.set(template.symbolType, []);
    }
    this.symbolsByType.get(template.symbolType)!.push(template);

    // Update category index
    if (!this.symbolsByCategory.has(template.symbolCategory)) {
      this.symbolsByCategory.set(template.symbolCategory, []);
    }
    this.symbolsByCategory.get(template.symbolCategory)!.push(template);
  }

  /**
   * Remove template from indices
   */
  private removeFromIndices(template: SymbolTemplate): void {
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