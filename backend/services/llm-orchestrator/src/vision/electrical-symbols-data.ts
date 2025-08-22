/**
 * Electrical Symbols Data
 * 
 * Real electrical symbol definitions with geometric properties
 * and pattern matching templates
 */

import { ElectricalSymbolType, SymbolCategory } from '../../../../shared/types/symbol-detection.types';

export interface ElectricalSymbolDefinition {
  type: ElectricalSymbolType;
  category: SymbolCategory;
  name: string;
  description: string;
  geometricProperties: {
    aspectRatio: { min: number; max: number };
    area: { min: number; max: number }; // Normalized area
    perimeter: { min: number; max: number }; // Normalized perimeter
    circularity: { min: number; max: number }; // 4π * area / perimeter²
    solidity: { min: number; max: number }; // area / convex hull area
    complexity: { min: number; max: number }; // Contour complexity
  };
  linePatterns: {
    horizontal: number; // Expected number of horizontal lines
    vertical: number; // Expected number of vertical lines
    diagonal: number; // Expected number of diagonal lines
    curved: boolean; // Has curved elements
    zigzag: boolean; // Has zigzag pattern (resistor)
  };
  huMomentRanges: {
    hu1: { min: number; max: number };
    hu2: { min: number; max: number };
    hu3: { min: number; max: number };
    hu4: { min: number; max: number };
    hu5: { min: number; max: number };
    hu6: { min: number; max: number };
    hu7: { min: number; max: number };
  };
  connectionPoints: number; // Number of connection points
  svgTemplate?: string; // SVG representation for template generation
}

export const ELECTRICAL_SYMBOLS: ElectricalSymbolDefinition[] = [
  {
    type: 'resistor',
    category: 'passive',
    name: 'Resistor',
    description: 'Fixed resistor with zigzag pattern',
    geometricProperties: {
      aspectRatio: { min: 2.0, max: 5.0 },
      area: { min: 0.01, max: 0.05 },
      perimeter: { min: 0.3, max: 0.8 },
      circularity: { min: 0.1, max: 0.3 },
      solidity: { min: 0.4, max: 0.7 },
      complexity: { min: 1.5, max: 3.0 }
    },
    linePatterns: {
      horizontal: 2,
      vertical: 0,
      diagonal: 6, // Zigzag pattern
      curved: false,
      zigzag: true
    },
    huMomentRanges: {
      hu1: { min: 0.15, max: 0.25 },
      hu2: { min: 0.002, max: 0.008 },
      hu3: { min: 0.0001, max: 0.0005 },
      hu4: { min: 0.00001, max: 0.00005 },
      hu5: { min: -0.000001, max: 0.000001 },
      hu6: { min: -0.00001, max: 0.00001 },
      hu7: { min: -0.000001, max: 0.000001 }
    },
    connectionPoints: 2,
    svgTemplate: '<path d="M0,10 L10,10 L15,0 L20,20 L25,0 L30,20 L35,0 L40,20 L45,10 L55,10" stroke="black" stroke-width="2" fill="none"/>'
  },
  {
    type: 'capacitor',
    category: 'passive',
    name: 'Capacitor',
    description: 'Fixed capacitor with parallel plates',
    geometricProperties: {
      aspectRatio: { min: 0.8, max: 1.5 },
      area: { min: 0.008, max: 0.04 },
      perimeter: { min: 0.2, max: 0.6 },
      circularity: { min: 0.2, max: 0.5 },
      solidity: { min: 0.6, max: 0.9 },
      complexity: { min: 1.0, max: 1.5 }
    },
    linePatterns: {
      horizontal: 2,
      vertical: 2, // Two parallel plates
      diagonal: 0,
      curved: false,
      zigzag: false
    },
    huMomentRanges: {
      hu1: { min: 0.18, max: 0.22 },
      hu2: { min: 0.001, max: 0.005 },
      hu3: { min: 0.0001, max: 0.0004 },
      hu4: { min: 0.00001, max: 0.00004 },
      hu5: { min: -0.000001, max: 0.000001 },
      hu6: { min: -0.00001, max: 0.00001 },
      hu7: { min: -0.000001, max: 0.000001 }
    },
    connectionPoints: 2,
    svgTemplate: '<g><line x1="0" y1="10" x2="20" y2="10" stroke="black" stroke-width="2"/><line x1="20" y1="0" x2="20" y2="20" stroke="black" stroke-width="2"/><line x1="25" y1="0" x2="25" y2="20" stroke="black" stroke-width="2"/><line x1="25" y1="10" x2="45" y2="10" stroke="black" stroke-width="2"/></g>'
  },
  {
    type: 'inductor',
    category: 'passive',
    name: 'Inductor',
    description: 'Inductor with coil pattern',
    geometricProperties: {
      aspectRatio: { min: 2.0, max: 4.0 },
      area: { min: 0.01, max: 0.05 },
      perimeter: { min: 0.4, max: 1.0 },
      circularity: { min: 0.15, max: 0.35 },
      solidity: { min: 0.5, max: 0.8 },
      complexity: { min: 2.0, max: 4.0 }
    },
    linePatterns: {
      horizontal: 2,
      vertical: 0,
      diagonal: 0,
      curved: true, // Coil curves
      zigzag: false
    },
    huMomentRanges: {
      hu1: { min: 0.16, max: 0.24 },
      hu2: { min: 0.003, max: 0.009 },
      hu3: { min: 0.0002, max: 0.0006 },
      hu4: { min: 0.00002, max: 0.00006 },
      hu5: { min: -0.000002, max: 0.000002 },
      hu6: { min: -0.00002, max: 0.00002 },
      hu7: { min: -0.000002, max: 0.000002 }
    },
    connectionPoints: 2,
    svgTemplate: '<path d="M0,10 L10,10 Q15,5 20,10 T30,10 T40,10 T50,10 L60,10" stroke="black" stroke-width="2" fill="none"/>'
  },
  {
    type: 'diode',
    category: 'active',
    name: 'Diode',
    description: 'Standard diode with triangle and bar',
    geometricProperties: {
      aspectRatio: { min: 1.0, max: 2.0 },
      area: { min: 0.005, max: 0.03 },
      perimeter: { min: 0.2, max: 0.5 },
      circularity: { min: 0.3, max: 0.6 },
      solidity: { min: 0.7, max: 0.95 },
      complexity: { min: 1.2, max: 2.0 }
    },
    linePatterns: {
      horizontal: 2,
      vertical: 1, // Cathode bar
      diagonal: 2, // Triangle sides
      curved: false,
      zigzag: false
    },
    huMomentRanges: {
      hu1: { min: 0.17, max: 0.21 },
      hu2: { min: 0.002, max: 0.006 },
      hu3: { min: 0.0001, max: 0.0003 },
      hu4: { min: 0.00001, max: 0.00003 },
      hu5: { min: -0.000001, max: 0.000001 },
      hu6: { min: -0.00001, max: 0.00001 },
      hu7: { min: -0.000001, max: 0.000001 }
    },
    connectionPoints: 2,
    svgTemplate: '<g><line x1="0" y1="10" x2="15" y2="10" stroke="black" stroke-width="2"/><polygon points="15,5 15,15 25,10" stroke="black" stroke-width="2" fill="none"/><line x1="25" y1="5" x2="25" y2="15" stroke="black" stroke-width="2"/><line x1="25" y1="10" x2="40" y2="10" stroke="black" stroke-width="2"/></g>'
  },
  {
    type: 'transistor',
    category: 'active',
    name: 'NPN Transistor',
    description: 'NPN bipolar junction transistor',
    geometricProperties: {
      aspectRatio: { min: 0.8, max: 1.3 },
      area: { min: 0.02, max: 0.08 },
      perimeter: { min: 0.4, max: 1.0 },
      circularity: { min: 0.4, max: 0.7 },
      solidity: { min: 0.6, max: 0.85 },
      complexity: { min: 2.0, max: 3.5 }
    },
    linePatterns: {
      horizontal: 1, // Base line
      vertical: 1, // Collector-emitter line
      diagonal: 2, // Collector and emitter connections
      curved: true, // Circle for transistor body
      zigzag: false
    },
    huMomentRanges: {
      hu1: { min: 0.19, max: 0.25 },
      hu2: { min: 0.004, max: 0.01 },
      hu3: { min: 0.0003, max: 0.0008 },
      hu4: { min: 0.00003, max: 0.00008 },
      hu5: { min: -0.000003, max: 0.000003 },
      hu6: { min: -0.00003, max: 0.00003 },
      hu7: { min: -0.000003, max: 0.000003 }
    },
    connectionPoints: 3,
    svgTemplate: '<g><circle cx="20" cy="20" r="15" stroke="black" stroke-width="2" fill="none"/><line x1="5" y1="20" x2="15" y2="20" stroke="black" stroke-width="2"/><line x1="15" y1="10" x2="15" y2="30" stroke="black" stroke-width="2"/><line x1="15" y1="15" x2="30" y2="5" stroke="black" stroke-width="2"/><line x1="15" y1="25" x2="30" y2="35" stroke="black" stroke-width="2"/><polygon points="27,33 30,35 25,36" fill="black"/></g>'
  },
  {
    type: 'ground',
    category: 'power',
    name: 'Ground',
    description: 'Electrical ground symbol',
    geometricProperties: {
      aspectRatio: { min: 0.8, max: 1.5 },
      area: { min: 0.003, max: 0.02 },
      perimeter: { min: 0.15, max: 0.4 },
      circularity: { min: 0.1, max: 0.3 },
      solidity: { min: 0.3, max: 0.6 },
      complexity: { min: 1.0, max: 1.8 }
    },
    linePatterns: {
      horizontal: 3, // Three horizontal lines of decreasing length
      vertical: 1, // Connection line
      diagonal: 0,
      curved: false,
      zigzag: false
    },
    huMomentRanges: {
      hu1: { min: 0.14, max: 0.18 },
      hu2: { min: 0.001, max: 0.004 },
      hu3: { min: 0.00005, max: 0.0002 },
      hu4: { min: 0.000005, max: 0.00002 },
      hu5: { min: -0.0000005, max: 0.0000005 },
      hu6: { min: -0.000005, max: 0.000005 },
      hu7: { min: -0.0000005, max: 0.0000005 }
    },
    connectionPoints: 1,
    svgTemplate: '<g><line x1="20" y1="0" x2="20" y2="15" stroke="black" stroke-width="2"/><line x1="10" y1="15" x2="30" y2="15" stroke="black" stroke-width="2"/><line x1="13" y1="20" x2="27" y2="20" stroke="black" stroke-width="2"/><line x1="16" y1="25" x2="24" y2="25" stroke="black" stroke-width="2"/></g>'
  },
  {
    type: 'battery',
    category: 'power',
    name: 'Battery',
    description: 'DC voltage source battery',
    geometricProperties: {
      aspectRatio: { min: 0.6, max: 1.2 },
      area: { min: 0.005, max: 0.03 },
      perimeter: { min: 0.2, max: 0.5 },
      circularity: { min: 0.15, max: 0.35 },
      solidity: { min: 0.4, max: 0.7 },
      complexity: { min: 1.0, max: 1.5 }
    },
    linePatterns: {
      horizontal: 2, // Connection lines
      vertical: 4, // Two pairs of plates
      diagonal: 0,
      curved: false,
      zigzag: false
    },
    huMomentRanges: {
      hu1: { min: 0.16, max: 0.20 },
      hu2: { min: 0.001, max: 0.004 },
      hu3: { min: 0.00008, max: 0.0003 },
      hu4: { min: 0.000008, max: 0.00003 },
      hu5: { min: -0.0000008, max: 0.0000008 },
      hu6: { min: -0.000008, max: 0.000008 },
      hu7: { min: -0.0000008, max: 0.0000008 }
    },
    connectionPoints: 2,
    svgTemplate: '<g><line x1="0" y1="15" x2="15" y2="15" stroke="black" stroke-width="2"/><line x1="15" y1="5" x2="15" y2="25" stroke="black" stroke-width="2"/><line x1="20" y1="10" x2="20" y2="20" stroke="black" stroke-width="1"/><line x1="25" y1="5" x2="25" y2="25" stroke="black" stroke-width="2"/><line x1="30" y1="10" x2="30" y2="20" stroke="black" stroke-width="1"/><line x1="30" y1="15" x2="45" y2="15" stroke="black" stroke-width="2"/></g>'
  },
  {
    type: 'switch',
    category: 'connector',
    name: 'Switch',
    description: 'Single pole single throw switch',
    geometricProperties: {
      aspectRatio: { min: 1.5, max: 3.0 },
      area: { min: 0.004, max: 0.025 },
      perimeter: { min: 0.2, max: 0.5 },
      circularity: { min: 0.1, max: 0.25 },
      solidity: { min: 0.3, max: 0.6 },
      complexity: { min: 1.2, max: 2.0 }
    },
    linePatterns: {
      horizontal: 1, // Main connection line
      vertical: 0,
      diagonal: 1, // Switch lever
      curved: false,
      zigzag: false
    },
    huMomentRanges: {
      hu1: { min: 0.15, max: 0.19 },
      hu2: { min: 0.002, max: 0.006 },
      hu3: { min: 0.0001, max: 0.0004 },
      hu4: { min: 0.00001, max: 0.00004 },
      hu5: { min: -0.000001, max: 0.000001 },
      hu6: { min: -0.00001, max: 0.00001 },
      hu7: { min: -0.000001, max: 0.000001 }
    },
    connectionPoints: 2,
    svgTemplate: '<g><line x1="0" y1="15" x2="15" y2="15" stroke="black" stroke-width="2"/><circle cx="15" cy="15" r="2" fill="black"/><line x1="15" y1="15" x2="30" y2="5" stroke="black" stroke-width="2"/><circle cx="35" cy="15" r="2" fill="black"/><line x1="35" y1="15" x2="50" y2="15" stroke="black" stroke-width="2"/></g>'
  },
  {
    type: 'transformer',
    category: 'passive',
    name: 'Transformer',
    description: 'Two-winding transformer',
    geometricProperties: {
      aspectRatio: { min: 0.8, max: 1.3 },
      area: { min: 0.02, max: 0.1 },
      perimeter: { min: 0.5, max: 1.5 },
      circularity: { min: 0.2, max: 0.4 },
      solidity: { min: 0.5, max: 0.75 },
      complexity: { min: 3.0, max: 5.0 }
    },
    linePatterns: {
      horizontal: 4, // Connection lines
      vertical: 2, // Core lines
      diagonal: 0,
      curved: true, // Coil windings
      zigzag: false
    },
    huMomentRanges: {
      hu1: { min: 0.20, max: 0.28 },
      hu2: { min: 0.005, max: 0.015 },
      hu3: { min: 0.0004, max: 0.001 },
      hu4: { min: 0.00004, max: 0.0001 },
      hu5: { min: -0.000004, max: 0.000004 },
      hu6: { min: -0.00004, max: 0.00004 },
      hu7: { min: -0.000004, max: 0.000004 }
    },
    connectionPoints: 4,
    svgTemplate: '<g><path d="M10,10 Q15,5 20,10 T30,10 T40,10" stroke="black" stroke-width="2" fill="none"/><path d="M10,30 Q15,25 20,30 T30,30 T40,30" stroke="black" stroke-width="2" fill="none"/><line x1="25" y1="15" x2="25" y2="25" stroke="black" stroke-width="2"/><line x1="27" y1="15" x2="27" y2="25" stroke="black" stroke-width="2"/></g>'
  },
  {
    type: 'operational_amplifier',
    category: 'active',
    name: 'Op-Amp',
    description: 'Operational amplifier',
    geometricProperties: {
      aspectRatio: { min: 0.7, max: 1.2 },
      area: { min: 0.01, max: 0.06 },
      perimeter: { min: 0.3, max: 0.8 },
      circularity: { min: 0.4, max: 0.6 },
      solidity: { min: 0.8, max: 0.95 },
      complexity: { min: 1.3, max: 2.0 }
    },
    linePatterns: {
      horizontal: 3, // Input and output lines
      vertical: 0,
      diagonal: 2, // Triangle sides
      curved: false,
      zigzag: false
    },
    huMomentRanges: {
      hu1: { min: 0.18, max: 0.23 },
      hu2: { min: 0.003, max: 0.008 },
      hu3: { min: 0.0002, max: 0.0006 },
      hu4: { min: 0.00002, max: 0.00006 },
      hu5: { min: -0.000002, max: 0.000002 },
      hu6: { min: -0.00002, max: 0.00002 },
      hu7: { min: -0.000002, max: 0.000002 }
    },
    connectionPoints: 5, // +input, -input, output, +V, -V
    svgTemplate: '<g><polygon points="10,5 10,35 40,20" stroke="black" stroke-width="2" fill="none"/><line x1="0" y1="15" x2="10" y2="15" stroke="black" stroke-width="2"/><line x1="0" y1="25" x2="10" y2="25" stroke="black" stroke-width="2"/><line x1="40" y1="20" x2="50" y2="20" stroke="black" stroke-width="2"/><text x="13" y="18" font-size="8">+</text><text x="13" y="28" font-size="8">-</text></g>'
  },
  {
    type: 'led',
    category: 'active',
    name: 'LED',
    description: 'Light-emitting diode',
    geometricProperties: {
      aspectRatio: { min: 1.0, max: 2.0 },
      area: { min: 0.006, max: 0.035 },
      perimeter: { min: 0.25, max: 0.6 },
      circularity: { min: 0.3, max: 0.55 },
      solidity: { min: 0.65, max: 0.9 },
      complexity: { min: 1.5, max: 2.5 }
    },
    linePatterns: {
      horizontal: 2,
      vertical: 1,
      diagonal: 4, // Triangle plus light arrows
      curved: false,
      zigzag: false
    },
    huMomentRanges: {
      hu1: { min: 0.17, max: 0.22 },
      hu2: { min: 0.002, max: 0.007 },
      hu3: { min: 0.0001, max: 0.0004 },
      hu4: { min: 0.00001, max: 0.00004 },
      hu5: { min: -0.000001, max: 0.000001 },
      hu6: { min: -0.00001, max: 0.00001 },
      hu7: { min: -0.000001, max: 0.000001 }
    },
    connectionPoints: 2,
    svgTemplate: '<g><line x1="0" y1="20" x2="15" y2="20" stroke="black" stroke-width="2"/><polygon points="15,15 15,25 25,20" stroke="black" stroke-width="2" fill="none"/><line x1="25" y1="15" x2="25" y2="25" stroke="black" stroke-width="2"/><line x1="25" y1="20" x2="40" y2="20" stroke="black" stroke-width="2"/><path d="M20,10 L25,5 M23,7 L25,5 L23,7" stroke="black" stroke-width="1" marker-end="url(#arrow)"/><path d="M25,10 L30,5 M28,7 L30,5 L28,7" stroke="black" stroke-width="1" marker-end="url(#arrow)"/></g>'
  },
  {
    type: 'fuse',
    category: 'protection',
    name: 'Fuse',
    description: 'Electrical fuse',
    geometricProperties: {
      aspectRatio: { min: 2.0, max: 4.0 },
      area: { min: 0.004, max: 0.02 },
      perimeter: { min: 0.25, max: 0.6 },
      circularity: { min: 0.2, max: 0.4 },
      solidity: { min: 0.7, max: 0.9 },
      complexity: { min: 1.0, max: 1.5 }
    },
    linePatterns: {
      horizontal: 3, // Connection lines and fuse element
      vertical: 2, // Box sides
      diagonal: 0,
      curved: false,
      zigzag: false
    },
    huMomentRanges: {
      hu1: { min: 0.16, max: 0.20 },
      hu2: { min: 0.001, max: 0.004 },
      hu3: { min: 0.00008, max: 0.0003 },
      hu4: { min: 0.000008, max: 0.00003 },
      hu5: { min: -0.0000008, max: 0.0000008 },
      hu6: { min: -0.000008, max: 0.000008 },
      hu7: { min: -0.0000008, max: 0.0000008 }
    },
    connectionPoints: 2,
    svgTemplate: '<g><line x1="0" y1="10" x2="10" y2="10" stroke="black" stroke-width="2"/><rect x="10" y="5" width="20" height="10" stroke="black" stroke-width="2" fill="none"/><line x1="15" y1="10" x2="25" y2="10" stroke="black" stroke-width="1"/><line x1="30" y1="10" x2="40" y2="10" stroke="black" stroke-width="2"/></g>'
  }
];

/**
 * Get symbol definition by type
 */
export function getSymbolDefinition(type: ElectricalSymbolType): ElectricalSymbolDefinition | undefined {
  return ELECTRICAL_SYMBOLS.find(symbol => symbol.type === type);
}

/**
 * Get symbols by category
 */
export function getSymbolsByCategory(category: SymbolCategory): ElectricalSymbolDefinition[] {
  return ELECTRICAL_SYMBOLS.filter(symbol => symbol.category === category);
}

/**
 * Match symbol based on geometric properties
 */
export function matchSymbolByGeometry(
  aspectRatio: number,
  circularity: number,
  solidity: number,
  complexity: number
): ElectricalSymbolType[] {
  const matches: ElectricalSymbolType[] = [];
  
  for (const symbol of ELECTRICAL_SYMBOLS) {
    const geo = symbol.geometricProperties;
    
    if (aspectRatio >= geo.aspectRatio.min && aspectRatio <= geo.aspectRatio.max &&
        circularity >= geo.circularity.min && circularity <= geo.circularity.max &&
        solidity >= geo.solidity.min && solidity <= geo.solidity.max &&
        complexity >= geo.complexity.min && complexity <= geo.complexity.max) {
      matches.push(symbol.type);
    }
  }
  
  return matches;
}

/**
 * Match symbol based on Hu moments
 */
export function matchSymbolByHuMoments(huMoments: number[]): Array<{ type: ElectricalSymbolType; score: number }> {
  const matches: Array<{ type: ElectricalSymbolType; score: number }> = [];
  
  if (huMoments.length < 7) return matches;
  
  for (const symbol of ELECTRICAL_SYMBOLS) {
    let score = 0;
    let validMoments = 0;
    
    // Check each Hu moment
    const ranges = symbol.huMomentRanges;
    const moments = [
      { value: huMoments[0], range: ranges.hu1 },
      { value: huMoments[1], range: ranges.hu2 },
      { value: huMoments[2], range: ranges.hu3 },
      { value: huMoments[3], range: ranges.hu4 },
      { value: huMoments[4], range: ranges.hu5 },
      { value: huMoments[5], range: ranges.hu6 },
      { value: huMoments[6], range: ranges.hu7 }
    ];
    
    for (const moment of moments) {
      if (moment.value >= moment.range.min && moment.value <= moment.range.max) {
        // Calculate how centered the value is in the range
        const center = (moment.range.min + moment.range.max) / 2;
        const deviation = Math.abs(moment.value - center);
        const maxDeviation = (moment.range.max - moment.range.min) / 2;
        const normalizedScore = 1 - (deviation / maxDeviation);
        score += normalizedScore;
        validMoments++;
      }
    }
    
    if (validMoments >= 4) { // At least 4 moments should match
      matches.push({
        type: symbol.type,
        score: score / 7 // Normalize to 0-1
      });
    }
  }
  
  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);
  
  return matches;
}

/**
 * Get high-priority symbols for detection (most common)
 */
export function getHighPrioritySymbols(): ElectricalSymbolType[] {
  return ['resistor', 'capacitor', 'inductor', 'diode', 'transistor', 'ground', 'switch'];
}

/**
 * Get symbol complexity level
 */
export function getSymbolComplexity(type: ElectricalSymbolType): 'simple' | 'medium' | 'complex' {
  const symbol = getSymbolDefinition(type);
  if (!symbol) return 'medium';
  
  const complexity = symbol.geometricProperties.complexity.max;
  if (complexity < 1.5) return 'simple';
  if (complexity < 3.0) return 'medium';
  return 'complex';
}