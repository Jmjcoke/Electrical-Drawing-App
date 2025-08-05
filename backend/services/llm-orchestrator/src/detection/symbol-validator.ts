/**
 * Symbol Validator
 * 
 * Validation system using electrical engineering principles
 * and false positive filtering for symbol detection
 */

import { 
  DetectedSymbol,
  ElectricalSymbolType,
  SymbolCategory,
  SymbolDetectionError
} from '../../../../shared/types/symbol-detection.types';
import { CoordinateMapper } from '../vision/coordinate-mapper';

export interface ValidationRule {
  name: string;
  description: string;
  validate: (symbol: DetectedSymbol, context: ValidationContext) => ValidationResult;
  severity: 'error' | 'warning' | 'info';
  category: 'electrical' | 'geometric' | 'contextual';
}

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  issues: string[];
  suggestions: string[];
}

export interface ValidationContext {
  allSymbols: DetectedSymbol[];
  imageBuffer: Buffer;
  imageWidth: number;
  imageHeight: number;
  pageNumber: number;
}

export interface CircuitValidationRules {
  minDistance: number;
  maxDistance: number;
  allowedConnections: Record<ElectricalSymbolType, ElectricalSymbolType[]>;
  forbiddenPlacements: Record<ElectricalSymbolType, SymbolCategory[]>;
}

export class SymbolValidator {
  private validationRules: ValidationRule[] = [];
  private circuitRules: CircuitValidationRules = {
    minDistance: 0,
    maxDistance: 0,
    allowedConnections: {} as Record<ElectricalSymbolType, ElectricalSymbolType[]>,
    forbiddenPlacements: {} as Record<ElectricalSymbolType, SymbolCategory[]>
  };

  constructor() {
    this.initializeValidationRules();
    this.initializeCircuitRules();
  }

  /**
   * Validate a symbol using electrical engineering principles
   */
  async validateSymbol(
    symbol: DetectedSymbol,
    allSymbols: DetectedSymbol[],
    imageBuffer: Buffer
  ): Promise<number> {
    try {
      const context: ValidationContext = {
        allSymbols,
        imageBuffer,
        imageWidth: 800, // Mock dimensions
        imageHeight: 600,
        pageNumber: symbol.location.pageNumber,
      };

      let totalScore = 1.0;
      let ruleCount = 0;

      // Apply all validation rules
      for (const rule of this.validationRules) {
        try {
          const result = rule.validate(symbol, context);
          
          if (rule.severity === 'error' && !result.isValid) {
            totalScore *= 0.5; // Significant penalty for errors
          } else if (rule.severity === 'warning' && !result.isValid) {
            totalScore *= 0.8; // Moderate penalty for warnings
          } else if (result.isValid) {
            totalScore *= result.confidence; // Apply confidence multiplier
          }
          
          ruleCount++;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.warn(`Validation rule '${rule.name}' failed:`, errorMessage);
        }
      }

      // Ensure score is in valid range
      return Math.max(0, Math.min(1, totalScore));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new SymbolDetectionError(
        `Symbol validation failed: ${errorMessage}`,
        'SYMBOL_VALIDATION_ERROR',
        { symbolId: symbol.id, symbolType: symbol.symbolType }
      );
    }
  }

  /**
   * Filter false positives from detected symbols
   */
  async filterFalsePositives(
    symbols: DetectedSymbol[],
    imageBuffer: Buffer
  ): Promise<DetectedSymbol[]> {
    try {
      const validatedSymbols: DetectedSymbol[] = [];

      for (const symbol of symbols) {
        const validationScore = await this.validateSymbol(symbol, symbols, imageBuffer);
        
        // Apply false positive filtering
        const isFalsePositive = await this.detectFalsePositive(symbol, symbols, imageBuffer);
        
        if (!isFalsePositive && validationScore > 0.3) {
          symbol.validationScore = validationScore;
          validatedSymbols.push(symbol);
        }
      }

      // Apply circuit-level validation
      return this.validateCircuitCoherence(validatedSymbols);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new SymbolDetectionError(
        `False positive filtering failed: ${errorMessage}`,
        'FALSE_POSITIVE_FILTERING_ERROR',
        { symbolsCount: symbols.length }
      );
    }
  }

  /**
   * Detect if a symbol is likely a false positive
   */
  private async detectFalsePositive(
    symbol: DetectedSymbol,
    allSymbols: DetectedSymbol[],
    imageBuffer: Buffer
  ): Promise<boolean> {
    try {
      // Check for common false positive patterns
      
      // 1. Extremely small symbols (likely noise)
      if (symbol.boundingBox.area < 50) {
        return true;
      }

      // 2. Symbols with very low confidence
      if (symbol.confidence < 0.2) {
        return true;
      }

      // 3. Symbols at image edges (often partial/cut-off)
      if (this.isAtImageEdge(symbol)) {
        return true;
      }

      // 4. Overlapping symbols with much lower confidence
      const overlappingSymbols = this.findOverlappingSymbols(symbol, allSymbols);
      for (const other of overlappingSymbols) {
        if (other.confidence > symbol.confidence * 2) {
          return true; // This symbol is likely a false positive
        }
      }

      // 5. Symbols with inconsistent geometric properties
      if (this.hasInconsistentGeometry(symbol)) {
        return true;
      }

      // 6. Text or annotation misclassified as symbols
      if (await this.isLikelyText(symbol, imageBuffer)) {
        return true;
      }

      return false;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('False positive detection failed:', errorMessage);
      return false; // Conservative approach - don't filter if uncertain
    }
  }

  /**
   * Check if symbol is at image edge
   */
  private isAtImageEdge(symbol: DetectedSymbol): boolean {
    const margin = 0.05; // 5% margin from edge
    const location = symbol.location;
    
    return (
      location.x < margin || 
      location.x > (1 - margin) || 
      location.y < margin || 
      location.y > (1 - margin)
    );
  }

  /**
   * Find symbols that overlap with the given symbol
   */
  private findOverlappingSymbols(
    symbol: DetectedSymbol, 
    allSymbols: DetectedSymbol[]
  ): DetectedSymbol[] {
    return allSymbols.filter(other => {
      if (other.id === symbol.id) return false;
      
      const iou = CoordinateMapper.calculateIoU(symbol.boundingBox, other.boundingBox);
      return iou > 0.3; // 30% overlap threshold
    });
  }

  /**
   * Check for inconsistent geometric properties
   */
  private hasInconsistentGeometry(symbol: DetectedSymbol): boolean {
    if (!symbol.features) return false;

    const geom = symbol.features.geometricProperties;
    const bbox = symbol.boundingBox;

    // Check if calculated area is wildly different from bounding box area
    const areaRatio = geom.area / bbox.area;
    if (areaRatio < 0.1 || areaRatio > 2.0) {
      return true;
    }

    // Check for impossible aspect ratios
    if (geom.aspectRatio < 0.05 || geom.aspectRatio > 20) {
      return true;
    }

    return false;
  }

  /**
   * Check if symbol is likely misclassified text
   */
  private async isLikelyText(symbol: DetectedSymbol, _imageBuffer: Buffer): Promise<boolean> {
    try {
      // Heuristics for text detection:
      
      // 1. Very high aspect ratio (text is often wide and short)
      if (symbol.features?.geometricProperties.aspectRatio > 5) {
        return true;
      }

      // 2. Multiple small rectangles in a row (likely text characters)
      if (symbol.boundingBox.height < 20 && symbol.boundingBox.width > 100) {
        return true;
      }

      // 3. Low complexity for the size (text has consistent strokes)
      if (symbol.features?.shapeAnalysis.complexity < 0.2 && symbol.boundingBox.area > 1000) {
        return true;
      }

      return false;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('Text detection failed:', errorMessage);
      return false;
    }
  }

  /**
   * Validate circuit coherence across all symbols
   */
  private validateCircuitCoherence(symbols: DetectedSymbol[]): DetectedSymbol[] {
    if (symbols.length < 2) return symbols;

    const validatedSymbols: DetectedSymbol[] = [];

    for (const symbol of symbols) {
      let isCoherent = true;

      // Check spatial relationships with other symbols
      const nearbySymbols = this.findNearbySymbols(symbol, symbols);
      
      for (const nearby of nearbySymbols) {
        // Check if this combination makes electrical sense
        if (!this.isValidSymbolCombination(symbol, nearby)) {
          isCoherent = false;
          break;
        }
      }

      // Check for electrical circuit rules
      if (isCoherent && !this.violatesCircuitRules(symbol, symbols)) {
        validatedSymbols.push(symbol);
      }
    }

    return validatedSymbols;
  }

  /**
   * Find symbols near the given symbol
   */
  private findNearbySymbols(
    symbol: DetectedSymbol, 
    allSymbols: DetectedSymbol[]
  ): DetectedSymbol[] {
    const maxDistance = 100; // pixels
    const symbolCenter = CoordinateMapper.getBoundingBoxCenter(symbol.boundingBox);

    return allSymbols.filter(other => {
      if (other.id === symbol.id) return false;
      
      const otherCenter = CoordinateMapper.getBoundingBoxCenter(other.boundingBox);
      const distance = CoordinateMapper.calculateDistance(symbolCenter, otherCenter);
      
      return distance <= maxDistance;
    });
  }

  /**
   * Check if two symbols can validly appear together
   */
  private isValidSymbolCombination(
    symbol1: DetectedSymbol, 
    symbol2: DetectedSymbol
  ): boolean {
    // Check allowed connections
    const allowedConnections = this.circuitRules.allowedConnections[symbol1.symbolType] || [];
    
    if (allowedConnections.length > 0 && !allowedConnections.includes(symbol2.symbolType)) {
      return false;
    }

    // Check forbidden placements
    const forbiddenCategories = this.circuitRules.forbiddenPlacements[symbol1.symbolType] || [];
    
    if (forbiddenCategories.includes(symbol2.symbolCategory)) {
      return false;
    }

    return true;
  }

  /**
   * Check if symbol violates circuit rules
   */
  private violatesCircuitRules(symbol: DetectedSymbol, allSymbols: DetectedSymbol[]): boolean {
    // Check for duplicate incompatible symbols
    const sameTypeSymbols = allSymbols.filter(s => 
      s.symbolType === symbol.symbolType && s.id !== symbol.id
    );

    // Some symbols shouldn't appear multiple times in close proximity
    const uniqueSymbols = ['power_supply', 'ground'];
    if (uniqueSymbols.includes(symbol.symbolType) && sameTypeSymbols.length > 0) {
      // Check if they're too close
      const symbolCenter = CoordinateMapper.getBoundingBoxCenter(symbol.boundingBox);
      
      for (const other of sameTypeSymbols) {
        const otherCenter = CoordinateMapper.getBoundingBoxCenter(other.boundingBox);
        const distance = CoordinateMapper.calculateDistance(symbolCenter, otherCenter);
        
        if (distance < 50) { // Too close for unique symbols
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Initialize validation rules
   */
  private initializeValidationRules(): void {
    this.validationRules = [
      {
        name: 'geometricConsistency',
        description: 'Check geometric consistency of symbol',
        severity: 'error',
        category: 'geometric',
        validate: (symbol, _context) => {
          const isValid = !this.hasInconsistentGeometry(symbol);
          return {
            isValid,
            confidence: isValid ? 1.0 : 0.3,
            issues: isValid ? [] : ['Inconsistent geometric properties'],
            suggestions: isValid ? [] : ['Review symbol detection parameters'],
          };
        },
      },
      {
        name: 'sizeValidation',
        description: 'Validate symbol size is reasonable',
        severity: 'warning',
        category: 'geometric',
        validate: (symbol, _context) => {
          const area = symbol.boundingBox.area;
          const isValid = area >= 50 && area <= 50000;
          return {
            isValid,
            confidence: isValid ? 1.0 : 0.6,
            issues: isValid ? [] : ['Symbol size outside expected range'],
            suggestions: isValid ? [] : ['Check image resolution and symbol scaling'],
          };
        },
      },
      {
        name: 'edgeDistance',
        description: 'Check distance from image edges',
        severity: 'warning',
        category: 'contextual',
        validate: (symbol, _context) => {
          const isAtEdge = this.isAtImageEdge(symbol);
          return {
            isValid: !isAtEdge,
            confidence: isAtEdge ? 0.7 : 1.0,
            issues: isAtEdge ? ['Symbol near image edge'] : [],
            suggestions: isAtEdge ? ['Verify symbol is not cut off'] : [],
          };
        },
      },
      {
        name: 'symbolOverlap',
        description: 'Check for excessive overlap with other symbols',
        severity: 'error',
        category: 'contextual',
        validate: (symbol, _context) => {
          const overlapping = this.findOverlappingSymbols(symbol, _context.allSymbols);
          const hasExcessiveOverlap = overlapping.some(other => {
            const iou = CoordinateMapper.calculateIoU(symbol.boundingBox, other.boundingBox);
            return iou > 0.8; // 80% overlap is excessive
          });
          
          return {
            isValid: !hasExcessiveOverlap,
            confidence: hasExcessiveOverlap ? 0.2 : 1.0,
            issues: hasExcessiveOverlap ? ['Excessive overlap with other symbols'] : [],
            suggestions: hasExcessiveOverlap ? ['Review detection parameters'] : [],
          };
        },
      },
      {
        name: 'electricalContext',
        description: 'Validate electrical context and connections',
        severity: 'info',
        category: 'electrical',
        validate: (symbol, _context) => {
          const nearbySymbols = this.findNearbySymbols(symbol, _context.allSymbols);
          const hasElectricalContext = nearbySymbols.length > 0;
          
          return {
            isValid: true, // Always valid, just affects confidence
            confidence: hasElectricalContext ? 1.0 : 0.8,
            issues: [],
            suggestions: hasElectricalContext ? [] : ['Isolated symbol - verify placement'],
          };
        },
      },
    ];
  }

  /**
   * Initialize circuit validation rules
   */
  private initializeCircuitRules(): void {
    this.circuitRules = {
      minDistance: 10,
      maxDistance: 200,
      allowedConnections: {
        'resistor': ['capacitor', 'inductor', 'diode', 'transistor', 'ground', 'power_supply'],
        'capacitor': ['resistor', 'inductor', 'diode', 'transistor', 'ground', 'power_supply'],
        'inductor': ['resistor', 'capacitor', 'diode', 'transistor', 'ground', 'power_supply'],
        'diode': ['resistor', 'capacitor', 'inductor', 'transistor', 'ground', 'power_supply'],
        'transistor': ['resistor', 'capacitor', 'inductor', 'diode', 'ground', 'power_supply'],
        'integrated_circuit': ['resistor', 'capacitor', 'inductor', 'diode', 'transistor', 'connector', 'ground', 'power_supply'],
        'connector': ['resistor', 'capacitor', 'inductor', 'diode', 'transistor', 'integrated_circuit'],
        'ground': ['resistor', 'capacitor', 'inductor', 'diode', 'transistor', 'integrated_circuit', 'power_supply'],
        'power_supply': ['resistor', 'capacitor', 'inductor', 'diode', 'transistor', 'integrated_circuit', 'ground'],
        'switch': ['resistor', 'capacitor', 'inductor', 'diode', 'transistor', 'power_supply'],
        'relay': ['resistor', 'capacitor', 'inductor', 'diode', 'transistor', 'power_supply'],
        'transformer': ['resistor', 'capacitor', 'inductor', 'diode', 'power_supply', 'ground'],
        'battery': ['resistor', 'capacitor', 'inductor', 'diode', 'transistor', 'ground'],
        'fuse': ['resistor', 'capacitor', 'inductor', 'diode', 'transistor', 'power_supply'],
        'led': ['resistor', 'diode', 'transistor', 'power_supply', 'ground'],
        'operational_amplifier': ['resistor', 'capacitor', 'inductor', 'diode', 'transistor', 'power_supply', 'ground'],
        'logic_gate': ['resistor', 'capacitor', 'diode', 'transistor', 'power_supply', 'ground'],
        'custom': [], // No restrictions for custom symbols
        'unknown': [], // No restrictions for unknown symbols
      },
      forbiddenPlacements: {
        'resistor': [],
        'capacitor': [],
        'inductor': [],
        'diode': [],
        'transistor': [],
        'integrated_circuit': [],
        'connector': [],
        'switch': [],
        'relay': [],
        'transformer': [],
        'ground': [], // Ground can be placed anywhere
        'power_supply': ['power'], // Don't place multiple power supplies close together
        'battery': ['power'], // Don't place near other power sources
        'fuse': [],
        'led': [],
        'operational_amplifier': [],
        'logic_gate': [],
        'custom': [],
        'unknown': [],
      },
    };
  }

  /**
   * Get validation statistics
   */
  getValidationStats(symbols: DetectedSymbol[]): {
    totalSymbols: number;
    validatedSymbols: number;
    averageValidationScore: number;
    ruleViolations: number;
  } {
    const validatedSymbols = symbols.filter(s => s.validationScore > 0.5);
    const averageScore = symbols.length > 0 
      ? symbols.reduce((sum, s) => sum + (s.validationScore || 0), 0) / symbols.length 
      : 0;
    
    return {
      totalSymbols: symbols.length,
      validatedSymbols: validatedSymbols.length,
      averageValidationScore: averageScore,
      ruleViolations: symbols.length - validatedSymbols.length,
    };
  }
}