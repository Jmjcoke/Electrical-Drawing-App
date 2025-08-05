/**
 * ResponseLinker service for associating text responses with drawing locations
 * Handles location parsing, component mention detection, and multi-component highlighting
 */

import type {
  ComponentHighlight,
  HighlightReference,
  ComponentMention,
  LocationHint,
  HighlightCoordinates,
  HighlightStyle
} from '../types/highlighting.types';
import { parseLocationHints, validateCoordinates } from '../utils/coordinate-mapper';

interface ResponseLinkingOptions {
  readonly confidenceThreshold: number;
  readonly maxHighlightsPerResponse: number;
  readonly defaultHighlightStyle: HighlightStyle;
  readonly componentTypeColors: Record<string, string>;
}

interface ComponentDetectionResult {
  readonly componentType: string;
  readonly description: string;
  readonly mentionText: string;
  readonly confidence: number;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly contextualClues: string[];
}

interface LocationExtractionResult {
  readonly coordinates: HighlightCoordinates | null;
  readonly confidence: number;
  readonly source: 'explicit' | 'inferred' | 'contextual';
  readonly rawText: string;
}

export class ResponseLinkerService {
  private readonly options: ResponseLinkingOptions;
  private readonly componentPatterns: Map<string, RegExp[]>;
  private readonly locationPatterns: RegExp[];

  constructor(options: Partial<ResponseLinkingOptions> = {}) {
    this.options = {
      confidenceThreshold: 0.4,
      maxHighlightsPerResponse: 10,
      defaultHighlightStyle: {
        color: '#2196F3',
        opacity: 0.8,
        strokeWidth: 2,
        strokeStyle: 'solid',
        fillOpacity: 0.2,
        zIndex: 1
      },
      componentTypeColors: {
        resistor: '#FF9800',
        capacitor: '#4CAF50',
        inductor: '#9C27B0',
        diode: '#F44336',
        transistor: '#3F51B5',
        ic: '#607D8B',
        connector: '#795548',
        switch: '#E91E63',
        led: '#FFEB3B',
        battery: '#8BC34A',
        ground: '#424242',
        wire: '#9E9E9E',
        component: '#2196F3' // Default
      },
      ...options
    };

    this.componentPatterns = this.initializeComponentPatterns();
    this.locationPatterns = this.initializeLocationPatterns();
  }

  /**
   * Initialize regex patterns for component detection
   */
  private initializeComponentPatterns(): Map<string, RegExp[]> {
    const patterns = new Map<string, RegExp[]>();

    patterns.set('resistor', [
      /\b(?:resistor|resistance|ohm|Ω|R\d+)\b/gi,
      /\b\d+\s*(?:ohm|Ω|k\s*ohm|M\s*ohm)\b/gi
    ]);

    patterns.set('capacitor', [
      /\b(?:capacitor|capacitance|farad|F|C\d+)\b/gi,
      /\b\d+\s*(?:farad|F|µF|nF|pF|uF)\b/gi
    ]);

    patterns.set('inductor', [
      /\b(?:inductor|inductance|henry|H|L\d+|coil)\b/gi,
      /\b\d+\s*(?:henry|H|mH|µH|uH)\b/gi
    ]);

    patterns.set('diode', [
      /\b(?:diode|LED|D\d+|rectifier)\b/gi,
      /\b(?:light[\s-]?emitting[\s-]?diode)\b/gi
    ]);

    patterns.set('transistor', [
      /\b(?:transistor|BJT|FET|MOSFET|Q\d+|T\d+)\b/gi,
      /\b(?:bipolar|field[\s-]?effect)\b/gi
    ]);

    patterns.set('ic', [
      /\b(?:IC|integrated[\s-]?circuit|chip|U\d+|microcontroller|processor)\b/gi,
      /\b(?:op[\s-]?amp|operational[\s-]?amplifier)\b/gi
    ]);

    patterns.set('connector', [
      /\b(?:connector|terminal|pin|header|socket|J\d+|P\d+)\b/gi,
      /\b(?:input|output|port)\b/gi
    ]);

    patterns.set('switch', [
      /\b(?:switch|button|SW\d+|S\d+)\b/gi,
      /\b(?:momentary|toggle|push[\s-]?button)\b/gi
    ]);

    patterns.set('battery', [
      /\b(?:battery|cell|power[\s-]?supply|V\d+|VCC|VDD)\b/gi,
      /\b\d+V\b/gi
    ]);

    patterns.set('ground', [
      /\b(?:ground|GND|earth|chassis)\b/gi
    ]);

    patterns.set('wire', [
      /\b(?:wire|connection|trace|line|path|net)\b/gi
    ]);

    return patterns;
  }

  /**
   * Initialize regex patterns for location detection
   */
  private initializeLocationPatterns(): RegExp[] {
    return [
      // Explicit coordinates
      /(?:at|coordinates?|position|located)\s*(?:at)?\s*\(?(\d+\.?\d*),?\s*(\d+\.?\d*)\)?/gi,
      
      // Grid references
      /(?:at|in)\s*(?:grid\s*)?(?:cell|position|location)\s*([A-Z]\d+|\d+[A-Z])/gi,
      
      // Relative positions
      /\b(?:top|bottom|center|middle|left|right|upper|lower)[-\s]?(?:left|right|center|middle)?\b/gi,
      
      // Proximity references
      /\b(?:near|next\s+to|beside|above|below|left\s+of|right\s+of|adjacent\s+to)\s+(?:the\s+)?(\w+)/gi,
      
      // Directional references
      /\b(?:north|south|east|west|northeast|northwest|southeast|southwest)\s*(?:of|from)?\b/gi,
      
      // Distance references
      /\b(?:\d+\s*(?:mm|cm|inch|inches?|px|pixels?))\s*(?:from|away\s+from|to\s+the\s+(?:left|right|above|below))/gi
    ];
  }

  /**
   * Analyze response text to extract component mentions and locations
   */
  async analyzeResponse(
    responseText: string,
    responseId: string,
    queryId: string,
    sessionId: string,
    pageNumber: number = 1
  ): Promise<ComponentHighlight[]> {
    try {
      // Detect component mentions
      const componentMentions = this.detectComponentMentions(responseText);
      
      // Extract location information
      const locationHints = parseLocationHints(responseText);
      
      // Create highlights from component mentions
      const highlights: ComponentHighlight[] = [];
      
      for (const mention of componentMentions) {
        if (mention.confidence < this.options.confidenceThreshold) continue;
        if (highlights.length >= this.options.maxHighlightsPerResponse) break;
        
        // Find best location for this component
        const location = this.findBestLocation(mention, locationHints, responseText);
        
        if (location.coordinates && validateCoordinates(location.coordinates)) {
          const highlight = this.createHighlightFromMention(
            mention,
            location,
            responseId,
            queryId,
            sessionId,
            responseText,
            pageNumber
          );
          
          highlights.push(highlight);
        }
      }
      
      return highlights;
    } catch (error) {
      console.error('Failed to analyze response:', error);
      return [];
    }
  }

  /**
   * Detect component mentions in response text
   */
  private detectComponentMentions(text: string): ComponentDetectionResult[] {
    const mentions: ComponentDetectionResult[] = [];
    
    for (const [componentType, patterns] of this.componentPatterns.entries()) {
      for (const pattern of patterns) {
        let match;
        pattern.lastIndex = 0; // Reset regex state
        
        while ((match = pattern.exec(text)) !== null) {
          const mentionText = match[0];
          const startIndex = match.index;
          const endIndex = match.index + mentionText.length;
          
          // Extract contextual clues around the mention
          const contextStart = Math.max(0, startIndex - 50);
          const contextEnd = Math.min(text.length, endIndex + 50);
          const context = text.substring(contextStart, contextEnd);
          const contextualClues = this.extractContextualClues(context);
          
          // Calculate confidence based on pattern strength and context
          const confidence = this.calculateMentionConfidence(
            mentionText,
            contextualClues,
            componentType
          );
          
          mentions.push({
            componentType,
            description: this.generateComponentDescription(mentionText, contextualClues),
            mentionText,
            confidence,
            startIndex,
            endIndex,
            contextualClues
          });
        }
      }
    }
    
    // Remove overlapping mentions, keeping the highest confidence
    return this.deduplicateMentions(mentions);
  }

  /**
   * Extract contextual clues from surrounding text
   */
  private extractContextualClues(context: string): string[] {
    const clues: string[] = [];
    
    // Technical specifications
    const specPatterns = [
      /\b\d+\s*(?:ohm|Ω|farad|F|henry|H|volt|V|amp|A|watt|W|MHz|kHz|Hz)\b/gi,
      /\b\d+\s*(?:µF|nF|pF|µH|mH|kΩ|MΩ|mA|µA)\b/gi
    ];
    
    for (const pattern of specPatterns) {
      const matches = context.match(pattern);
      if (matches) {
        clues.push(...matches);
      }
    }
    
    // Reference designators
    const refPatterns = [
      /\b[RCLDQUTIJPSW]\d+\b/gi,
      /\b(?:IC|U)\d+\b/gi
    ];
    
    for (const pattern of refPatterns) {
      const matches = context.match(pattern);
      if (matches) {
        clues.push(...matches);
      }
    }
    
    return [...new Set(clues)]; // Remove duplicates
  }

  /**
   * Calculate confidence score for component mention
   */
  private calculateMentionConfidence(
    mentionText: string,
    contextualClues: string[],
    _componentType: string
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Boost confidence for specific patterns
    if (mentionText.match(/\b[RCLDQUTIJPSW]\d+\b/i)) {
      confidence += 0.3; // Reference designator
    }
    
    if (contextualClues.length > 0) {
      confidence += Math.min(0.2, contextualClues.length * 0.05);
    }
    
    // Boost for technical specifications
    const hasSpecs = contextualClues.some(clue => 
      clue.match(/\d+\s*(?:ohm|farad|henry|volt|amp|watt|Hz)/i)
    );
    if (hasSpecs) {
      confidence += 0.2;
    }
    
    // Penalize very generic terms
    if (mentionText.toLowerCase() === 'component') {
      confidence -= 0.2;
    }
    
    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Generate descriptive text for component
   */
  private generateComponentDescription(
    mentionText: string,
    contextualClues: string[]
  ): string {
    const specs = contextualClues.filter(clue => 
      clue.match(/\d+\s*(?:ohm|farad|henry|volt|amp|watt|Hz)/i)
    );
    
    if (specs.length > 0) {
      return `${mentionText} (${specs.join(', ')})`;
    }
    
    return mentionText;
  }

  /**
   * Remove overlapping mentions, keeping highest confidence
   */
  private deduplicateMentions(mentions: ComponentDetectionResult[]): ComponentDetectionResult[] {
    const sorted = mentions.sort((a, b) => b.confidence - a.confidence);
    const result: ComponentDetectionResult[] = [];
    
    for (const mention of sorted) {
      const overlaps = result.some(existing => 
        this.rangesOverlap(
          [mention.startIndex, mention.endIndex],
          [existing.startIndex, existing.endIndex]
        )
      );
      
      if (!overlaps) {
        result.push(mention);
      }
    }
    
    return result.sort((a, b) => a.startIndex - b.startIndex);
  }

  /**
   * Check if two ranges overlap
   */
  private rangesOverlap(range1: [number, number], range2: [number, number]): boolean {
    return range1[0] < range2[1] && range2[0] < range1[1];
  }

  /**
   * Find best location for component mention
   */
  private findBestLocation(
    mention: ComponentDetectionResult,
    locationHints: LocationHint[],
    _fullText: string
  ): LocationExtractionResult {
    // Look for explicit coordinates first
    for (const hint of locationHints) {
      if (hint.type === 'coordinate' && hint.parsedValue?.x !== undefined && hint.parsedValue?.y !== undefined) {
        const coordinates: HighlightCoordinates = {
          x: hint.parsedValue.x > 1 ? hint.parsedValue.x / 1000 : hint.parsedValue.x, // Normalize if needed
          y: hint.parsedValue.y > 1 ? hint.parsedValue.y / 1000 : hint.parsedValue.y,
          width: 0.05,
          height: 0.05,
          pageNumber: 1,
          zoomLevel: 1,
          viewportOffset: { x: 0, y: 0 }
        };
        
        return {
          coordinates,
          confidence: hint.confidence,
          source: 'explicit',
          rawText: hint.value
        };
      }
    }
    
    // Try relative positioning
    for (const hint of locationHints) {
      if (hint.type === 'relative' && hint.parsedValue?.reference) {
        const coordinates = this.convertRelativeToCoordinates(hint.parsedValue.reference);
        if (coordinates) {
          return {
            coordinates,
            confidence: hint.confidence * 0.8, // Lower confidence for relative
            source: 'inferred',
            rawText: hint.value
          };
        }
      }
    }
    
    // Default location if no hints found
    return {
      coordinates: null,
      confidence: 0,
      source: 'contextual',
      rawText: ''
    };
  }

  /**
   * Convert relative position to coordinates
   */
  private convertRelativeToCoordinates(reference: string): HighlightCoordinates | null {
    const positionMap: Record<string, { x: number; y: number }> = {
      'top-left': { x: 0.2, y: 0.2 },
      'top-center': { x: 0.5, y: 0.2 },
      'top-right': { x: 0.8, y: 0.2 },
      'center-left': { x: 0.2, y: 0.5 },
      'center': { x: 0.5, y: 0.5 },
      'center-right': { x: 0.8, y: 0.5 },
      'bottom-left': { x: 0.2, y: 0.8 },
      'bottom-center': { x: 0.5, y: 0.8 },
      'bottom-right': { x: 0.8, y: 0.8 },
      'left': { x: 0.2, y: 0.5 },
      'right': { x: 0.8, y: 0.5 },
      'top': { x: 0.5, y: 0.2 },
      'bottom': { x: 0.5, y: 0.8 }
    };
    
    const position = positionMap[reference.toLowerCase()];
    if (!position) return null;
    
    return {
      x: position.x,
      y: position.y,
      width: 0.05,
      height: 0.05,
      pageNumber: 1,
      zoomLevel: 1,
      viewportOffset: { x: 0, y: 0 }
    };
  }

  /**
   * Create highlight from component mention and location
   */
  private createHighlightFromMention(
    mention: ComponentDetectionResult,
    location: LocationExtractionResult,
    responseId: string,
    queryId: string,
    sessionId: string,
    _responseText: string,
    _pageNumber: number
  ): ComponentHighlight {
    const componentColor = this.options.componentTypeColors[mention.componentType] || 
                          this.options.componentTypeColors.component;
    
    const style: HighlightStyle = {
      ...this.options.defaultHighlightStyle,
      color: componentColor,
      animationType: location.confidence > 0.8 ? 'glow' : 'none'
    };
    
    return {
      id: `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      componentId: mention.mentionText,
      type: 'component',
      coordinates: location.coordinates!,
      style,
      responseId,
      queryId,
      sessionId,
      createdAt: new Date(),
      isVisible: true,
      isPersistent: mention.confidence > 0.7
    };
  }

  /**
   * Create highlight references for text-to-visual linking
   */
  createHighlightReferences(
    highlights: ComponentHighlight[],
    responseText: string,
    mentions: ComponentDetectionResult[]
  ): HighlightReference[] {
    const references: HighlightReference[] = [];
    
    for (let i = 0; i < highlights.length && i < mentions.length; i++) {
      const highlight = highlights[i];
      const mention = mentions[i];
      
      const componentMention: ComponentMention = {
        componentType: mention.componentType,
        componentDescription: mention.description,
        mentionText: mention.mentionText,
        contextualClues: mention.contextualClues,
        locationHints: []
      };
      
      const reference: HighlightReference = {
        highlightId: highlight.id,
        responseText: responseText.substring(mention.startIndex, mention.endIndex),
        textPosition: {
          start: mention.startIndex,
          end: mention.endIndex
        },
        componentMention,
        linkType: mention.confidence > 0.8 ? 'direct' : 
                 mention.confidence > 0.6 ? 'inferred' : 'suggested',
        confidence: mention.confidence
      };
      
      references.push(reference);
    }
    
    return references;
  }
}

// Singleton instance for global use
let responseLinkerService: ResponseLinkerService | null = null;

export function getResponseLinkerService(options?: Partial<ResponseLinkingOptions>): ResponseLinkerService {
  if (!responseLinkerService) {
    responseLinkerService = new ResponseLinkerService(options);
  }
  return responseLinkerService;
}