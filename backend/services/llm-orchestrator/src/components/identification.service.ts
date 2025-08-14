/**
 * Component Identification Service
 * 
 * Handles symbol-to-component mapping and identification using multiple
 * matching algorithms with confidence scoring.
 * 
 * Story: 4.2 Component Database Integration
 * Task: 4.2.3 Build Component Identification Pipeline
 */

import { Pool } from 'pg';
import Fuse from 'fuse.js';
import {
  DetectedSymbol,
  ElectricalSymbolType
} from '../../../../shared/types/symbol-detection.types';
import {
  ComponentIdentificationResult,
  ComponentMatch,
  MatchDetails,
  PropertyMatch,
  ContextualFactor,
  ComponentLibraryEntry,
  IdentificationMethod,
  ComponentIdentificationError,
  ContextualHint,
  ComponentLookupRequest,
  ComponentLookupResponse
} from '../../../../shared/types/component-database.types';
import { ComponentLibraryService } from './component-library.service';
import { ComponentSpecificationService } from './specification.service';

export class ComponentIdentificationService {
  private db: Pool;
  private componentLibraryService: ComponentLibraryService;
  // private specificationService: ComponentSpecificationService; // Reserved for future use
  private fuseInstance: Fuse<ComponentLibraryEntry> | null = null;
  private lastFuseUpdate = 0;
  private readonly FUSE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  constructor(
    database: Pool,
    componentLibraryService: ComponentLibraryService,
    specificationService: ComponentSpecificationService
  ) {
    this.db = database;
    this.componentLibraryService = componentLibraryService;
    this.specificationService = specificationService;
  }

  /**
   * Identify component from detected symbol using multiple matching methods
   */
  async identifyComponent(request: ComponentLookupRequest): Promise<ComponentLookupResponse> {
    const startTime = Date.now();
    
    try {
      const { detectedSymbol, contextualHints, confidenceThreshold = 0.5, maxResults = 5 } = request;

      // Get candidate components using multiple identification methods
      const candidates = await this.getCandidateComponents(detectedSymbol);

      if (candidates.length === 0) {
        return {
          identificationResult: await this.createUnknownComponentResult(detectedSymbol),
          processingTimeMs: Date.now() - startTime,
          success: false,
          error: 'No matching components found in database'
        };
      }

      // Score and rank candidates
      const scoredCandidates = await this.scoreAndRankCandidates(
        detectedSymbol,
        candidates,
        contextualHints
      );

      // Filter by confidence threshold
      const validCandidates = scoredCandidates.filter(
        candidate => candidate.confidence >= confidenceThreshold
      ).slice(0, maxResults);

      if (validCandidates.length === 0) {
        return {
          identificationResult: await this.createLowConfidenceResult(detectedSymbol, scoredCandidates[0]),
          processingTimeMs: Date.now() - startTime,
          success: false,
          error: `No components found above confidence threshold ${confidenceThreshold}`
        };
      }

      const bestMatch = validCandidates[0];
      const alternativeMatches = validCandidates.slice(1);

      // Create identification result
      const identificationResult = await this.createIdentificationResult(
        detectedSymbol,
        bestMatch,
        alternativeMatches
      );

      // Store identification result in database
      await this.storeIdentificationResult(identificationResult);

      return {
        identificationResult,
        processingTimeMs: Date.now() - startTime,
        success: true
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        identificationResult: await this.createErrorResult(
          request.detectedSymbol, 
          error instanceof Error ? error : new Error(errorMessage)
        ),
        processingTimeMs: Date.now() - startTime,
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get candidate components using multiple identification methods
   */
  private async getCandidateComponents(detectedSymbol: DetectedSymbol): Promise<ComponentLibraryEntry[]> {
    const candidates = new Map<string, ComponentLibraryEntry>();

    // Method 1: Exact symbol type and category match
    const exactMatches = await this.getExactMatches(detectedSymbol);
    exactMatches.forEach(component => candidates.set(component.id, component));

    // Method 2: Fuzzy search on component names and descriptions
    const fuzzyMatches = await this.getFuzzyMatches(detectedSymbol);
    fuzzyMatches.forEach(component => candidates.set(component.id, component));

    // Method 3: Property-based matching (if symbol has text labels or measurable properties)
    const propertyMatches = await this.getPropertyMatches(detectedSymbol);
    propertyMatches.forEach(component => candidates.set(component.id, component));

    return Array.from(candidates.values());
  }

  /**
   * Get exact matches based on symbol type and category
   */
  private async getExactMatches(detectedSymbol: DetectedSymbol): Promise<ComponentLibraryEntry[]> {
    const searchRequest = {
      symbolType: detectedSymbol.symbolType,
      symbolCategory: detectedSymbol.symbolCategory,
      limit: 20
    };

    const result = await this.componentLibraryService.searchComponents(searchRequest);
    return result.components;
  }

  /**
   * Get fuzzy matches using Fuse.js for flexible text matching
   */
  private async getFuzzyMatches(detectedSymbol: DetectedSymbol): Promise<ComponentLibraryEntry[]> {
    await this.ensureFuseInstance();
    
    if (!this.fuseInstance) {
      return [];
    }

    // Create search query from symbol information
    const searchQuery = [
      detectedSymbol.symbolType,
      detectedSymbol.description,
      ...(detectedSymbol.features.textLabels || [])
    ].filter(Boolean).join(' ');

    if (!searchQuery) {
      return [];
    }

    const fuseResults = this.fuseInstance.search(searchQuery, { limit: 10 });
    return fuseResults.map(result => result.item);
  }

  /**
   * Get matches based on component properties (e.g., value labels from symbols)
   */
  private async getPropertyMatches(detectedSymbol: DetectedSymbol): Promise<ComponentLibraryEntry[]> {
    const textLabels = detectedSymbol.features.textLabels || [];
    
    if (textLabels.length === 0) {
      return [];
    }

    // Extract potential property values from text labels
    const potentialValues = textLabels
      .map(label => this.extractComponentValue(label))
      .filter(value => value !== null);

    if (potentialValues.length === 0) {
      return [];
    }

    const client = await this.db.connect();
    try {
      const valueConditions = potentialValues.map((_, index) => {
        return `cp.property_value ILIKE $${index + 1}`;
      }).join(' OR ');

      const query = `
        SELECT DISTINCT cl.*
        FROM electrical_analysis.component_library cl
        JOIN electrical_analysis.component_properties cp ON cl.id = cp.component_id
        WHERE cp.is_searchable = true AND (${valueConditions})
        ORDER BY cl.component_name
        LIMIT 15
      `;

      const params = potentialValues.map(value => `%${value}%`);
      const result = await client.query(query, params);

      const components: ComponentLibraryEntry[] = [];
      for (const row of result.rows) {
        const component = await this.componentLibraryService.getComponentById(row.id);
        if (component) {
          components.push(component);
        }
      }

      return components;

    } catch (error) {
      console.warn('Error in property matching:', error);
      return [];
    } finally {
      client.release();
    }
  }

  /**
   * Score and rank candidate components
   */
  private async scoreAndRankCandidates(
    detectedSymbol: DetectedSymbol,
    candidates: ComponentLibraryEntry[],
    contextualHints?: ContextualHint[]
  ): Promise<ComponentMatch[]> {
    const scoredCandidates: ComponentMatch[] = [];

    for (const candidate of candidates) {
      const score = await this.calculateComponentScore(detectedSymbol, candidate, contextualHints);
      
      scoredCandidates.push({
        componentId: candidate.id,
        componentName: candidate.componentName,
        confidence: score.totalScore,
        matchReason: score.primaryReason,
        specifications: candidate.specifications!,
        keyProperties: candidate.properties.filter(p => p.isSearchable).slice(0, 5)
      });
    }

    // Sort by confidence score (descending)
    return scoredCandidates.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate component matching score
   */
  private async calculateComponentScore(
    detectedSymbol: DetectedSymbol,
    candidate: ComponentLibraryEntry,
    contextualHints?: ContextualHint[]
  ): Promise<{ totalScore: number; primaryReason: string; details: MatchDetails }> {
    let totalScore = 0;
    let primaryReason = '';
    const propertyMatches: PropertyMatch[] = [];
    const contextualFactors: ContextualFactor[] = [];

    // Base score for symbol type match (0.0-0.4)
    let symbolSimilarity = 0;
    if (candidate.symbolType === detectedSymbol.symbolType) {
      symbolSimilarity = 0.4;
      primaryReason = 'Exact symbol type match';
    } else if (this.isCompatibleSymbolType(detectedSymbol.symbolType, candidate.symbolType)) {
      symbolSimilarity = 0.2;
      primaryReason = 'Compatible symbol type';
    }
    totalScore += symbolSimilarity;

    // Category match bonus (0.0-0.2)
    const categoryMatch = candidate.symbolCategory === detectedSymbol.symbolCategory;
    if (categoryMatch) {
      totalScore += 0.2;
      if (!primaryReason) primaryReason = 'Category match';
    }

    // Text label matching (0.0-0.3)
    const textLabels = detectedSymbol.features.textLabels || [];
    if (textLabels.length > 0) {
      const textScore = this.calculateTextMatchScore(textLabels, candidate);
      totalScore += textScore * 0.3;
      
      if (textScore > 0.5 && !primaryReason) {
        primaryReason = 'Text label match';
      }
    }

    // Contextual hints bonus (0.0-0.1)
    if (contextualHints && contextualHints.length > 0) {
      const contextScore = this.calculateContextualScore(contextualHints, candidate);
      totalScore += contextScore * 0.1;
      
      contextualFactors.push({
        factor: 'contextual_hints',
        value: `Applied ${contextualHints.length} hints`,
        influence: contextScore
      });
    }

    // Ensure score is between 0 and 1
    totalScore = Math.max(0, Math.min(1, totalScore));

    if (!primaryReason) {
      primaryReason = 'Partial match';
    }

    const matchDetails: MatchDetails = {
      symbolSimilarity,
      categoryMatch,
      propertyMatches,
      industryStandardCompliance: this.checkIndustryStandardCompliance(detectedSymbol, candidate),
      contextualFactors
    };

    return { totalScore, primaryReason, details: matchDetails };
  }

  /**
   * Calculate text matching score using string similarity
   */
  private calculateTextMatchScore(textLabels: string[], candidate: ComponentLibraryEntry): number {
    let maxScore = 0;
    
    // Check against component name
    for (const label of textLabels) {
      const nameScore = this.calculateStringSimilarity(label.toLowerCase(), candidate.componentName.toLowerCase());
      maxScore = Math.max(maxScore, nameScore);
    }

    // Check against searchable properties
    for (const property of candidate.properties.filter(p => p.isSearchable)) {
      for (const label of textLabels) {
        const propScore = this.calculateStringSimilarity(label.toLowerCase(), property.propertyValue.toLowerCase());
        maxScore = Math.max(maxScore, propScore);
      }
    }

    return maxScore;
  }

  /**
   * Calculate contextual matching score
   */
  private calculateContextualScore(hints: ContextualHint[], candidate: ComponentLibraryEntry): number {
    let contextScore = 0;
    let totalWeight = 0;

    for (const hint of hints) {
      let hintScore = 0;
      
      switch (hint.type) {
        case 'voltage_level':
          hintScore = this.matchVoltageHint(hint.value, candidate);
          break;
        case 'circuit_type':
          hintScore = this.matchCircuitTypeHint(hint.value, candidate);
          break;
        case 'frequency_range':
          hintScore = this.matchFrequencyHint(hint.value, candidate);
          break;
        case 'application':
          hintScore = this.matchApplicationHint(hint.value, candidate);
          break;
      }

      contextScore += hintScore * hint.confidence;
      totalWeight += hint.confidence;
    }

    return totalWeight > 0 ? contextScore / totalWeight : 0;
  }

  /**
   * Check if two symbol types are compatible
   */
  private isCompatibleSymbolType(detected: ElectricalSymbolType, candidate: ElectricalSymbolType): boolean {
    const compatibilityMap: Record<ElectricalSymbolType, ElectricalSymbolType[]> = {
      'resistor': ['resistor'],
      'capacitor': ['capacitor'],
      'inductor': ['inductor', 'transformer'],
      'diode': ['diode', 'led'],
      'transistor': ['transistor'],
      'integrated_circuit': ['integrated_circuit', 'operational_amplifier'],
      'operational_amplifier': ['operational_amplifier', 'integrated_circuit'],
      'logic_gate': ['logic_gate', 'integrated_circuit'],
      'connector': ['connector'],
      'switch': ['switch', 'relay'],
      'relay': ['relay', 'switch'],
      'transformer': ['transformer', 'inductor'],
      'ground': ['ground'],
      'power_supply': ['power_supply', 'battery'],
      'battery': ['battery', 'power_supply'],
      'fuse': ['fuse'],
      'led': ['led', 'diode'],
      'custom': ['custom'],
      'unknown': []
    };

    return compatibilityMap[detected]?.includes(candidate) || false;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));

    for (let i = 0; i <= len1; i++) matrix[0][i] = i;
    for (let j = 0; j <= len2; j++) matrix[j][0] = j;

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,
          matrix[j][i - 1] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }

    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    return (maxLen - distance) / maxLen;
  }

  /**
   * Extract component value from text label (e.g., "10kΩ", "100µF")
   */
  private extractComponentValue(label: string): string | null {
    // Common patterns for component values
    const patterns = [
      /(\d+\.?\d*)\s*([kKmMµuUnNpP]?)([ΩΩFHVAWΩωΩ]|ohm|farad|henry|volt|amp|watt)/i,
      /(\d+\.?\d*)\s*([kKmMµuUnNpP])/,
      /(\d+\.?\d*)/
    ];

    for (const pattern of patterns) {
      const match = label.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }

    return null;
  }

  /**
   * Voltage level hint matching
   */
  private matchVoltageHint(voltageHint: string, candidate: ComponentLibraryEntry): number {
    const voltageRating = candidate.ratings.find(r => r.ratingType === 'voltage');
    if (!voltageRating) return 0;

    const hintVoltage = parseFloat(voltageHint);
    if (isNaN(hintVoltage)) return 0;

    const maxVoltage = voltageRating.maxValue || voltageRating.nominalValue;
    if (!maxVoltage) return 0;

    // Component should handle the voltage with some safety margin
    return hintVoltage <= maxVoltage * 0.8 ? 1 : 0;
  }

  /**
   * Circuit type hint matching
   */
  private matchCircuitTypeHint(circuitType: string, candidate: ComponentLibraryEntry): number {
    const description = candidate.componentDescription.toLowerCase();
    const circuitTypeLower = circuitType.toLowerCase();
    
    if (description.includes(circuitTypeLower)) {
      return 1;
    }

    // Check for related terms
    const relatedTerms: Record<string, string[]> = {
      'analog': ['linear', 'continuous'],
      'digital': ['logic', 'switching'],
      'power': ['supply', 'regulator', 'converter'],
      'rf': ['radio', 'frequency', 'microwave'],
      'audio': ['sound', 'amplifier']
    };

    const related = relatedTerms[circuitTypeLower] || [];
    return related.some(term => description.includes(term)) ? 0.5 : 0;
  }

  /**
   * Frequency range hint matching
   */
  private matchFrequencyHint(_frequencyHint: string, _candidate: ComponentLibraryEntry): number {
    // This would need more sophisticated frequency range matching
    // For now, return a basic score
    return 0.5;
  }

  /**
   * Application hint matching
   */
  private matchApplicationHint(application: string, candidate: ComponentLibraryEntry): number {
    const description = candidate.componentDescription.toLowerCase();
    return description.includes(application.toLowerCase()) ? 1 : 0;
  }

  /**
   * Check industry standard compliance
   */
  private checkIndustryStandardCompliance(_detectedSymbol: DetectedSymbol, candidate: ComponentLibraryEntry): boolean {
    // For now, assume compliance if candidate has any industry standards
    return candidate.industryStandards.length > 0;
  }

  /**
   * Ensure Fuse.js instance is initialized and up-to-date
   */
  private async ensureFuseInstance(): Promise<void> {
    const now = Date.now();
    
    if (this.fuseInstance && now - this.lastFuseUpdate < this.FUSE_CACHE_TTL) {
      return;
    }

    try {
      const allComponentsResult = await this.componentLibraryService.searchComponents({ limit: 1000 });
      const allComponents = allComponentsResult.components;

      const fuseOptions = {
        keys: ['componentName', 'componentDescription', 'properties.propertyValue'],
        threshold: 0.3,
        includeScore: true
      };

      this.fuseInstance = new Fuse(allComponents, fuseOptions);
      this.lastFuseUpdate = now;

    } catch (error) {
      console.error('Failed to initialize Fuse.js instance:', error);
      this.fuseInstance = null;
    }
  }

  /**
   * Create identification result object
   */
  private async createIdentificationResult(
    detectedSymbol: DetectedSymbol,
    bestMatch: ComponentMatch,
    alternativeMatches: ComponentMatch[]
  ): Promise<ComponentIdentificationResult> {
    const component = await this.componentLibraryService.getComponentById(bestMatch.componentId);
    if (!component || !component.specifications) {
      throw new ComponentIdentificationError('Best match component not found or incomplete');
    }

    return {
      id: '', // Will be set when stored
      detectedSymbolId: detectedSymbol.id,
      componentId: bestMatch.componentId,
      identificationMethod: this.determineIdentificationMethod(bestMatch),
      confidence: bestMatch.confidence,
      matchDetails: {
        symbolSimilarity: bestMatch.confidence,
        categoryMatch: true,
        propertyMatches: [],
        industryStandardCompliance: component.industryStandards.length > 0,
        contextualFactors: []
      },
      specifications: component.specifications,
      properties: component.properties,
      ratings: component.ratings,
      alternativeMatches: alternativeMatches,
      createdAt: new Date()
    };
  }

  /**
   * Determine identification method based on match characteristics
   */
  private determineIdentificationMethod(match: ComponentMatch): IdentificationMethod {
    if (match.confidence >= 0.9) {
      return 'exact_match';
    } else if (match.confidence >= 0.7) {
      return 'fuzzy_match';
    } else if (match.matchReason.includes('property') || match.matchReason.includes('text')) {
      return 'property_match';
    } else {
      return 'ml_classification';
    }
  }

  /**
   * Store identification result in database
   */
  private async storeIdentificationResult(result: ComponentIdentificationResult): Promise<void> {
    const client = await this.db.connect();
    try {
      const query = `
        INSERT INTO electrical_analysis.component_identifications
        (detected_symbol_id, component_id, identification_method, confidence,
         match_details, alternative_matches)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at
      `;

      const queryResult = await client.query(query, [
        result.detectedSymbolId,
        result.componentId,
        result.identificationMethod,
        result.confidence,
        result.matchDetails,
        result.alternativeMatches
      ]);

      result.id = queryResult.rows[0].id;
      result.createdAt = queryResult.rows[0].created_at;

    } catch (error) {
      throw new ComponentIdentificationError(
        `Failed to store identification result: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { result, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Create result for unknown components
   */
  private async createUnknownComponentResult(detectedSymbol: DetectedSymbol): Promise<ComponentIdentificationResult> {
    return {
      id: '',
      detectedSymbolId: detectedSymbol.id,
      componentId: '',
      identificationMethod: 'ml_classification',
      confidence: 0,
      matchDetails: {
        symbolSimilarity: 0,
        categoryMatch: false,
        propertyMatches: [],
        industryStandardCompliance: false,
        contextualFactors: []
      },
      specifications: {
        id: '',
        componentId: '',
        functionDescription: 'Unknown component - manual identification required',
        technicalDetails: 'No technical details available',
        createdAt: new Date()
      },
      properties: [],
      ratings: [],
      alternativeMatches: [],
      createdAt: new Date()
    };
  }

  /**
   * Create result for low confidence matches
   */
  private async createLowConfidenceResult(
    detectedSymbol: DetectedSymbol,
    bestAttempt: ComponentMatch
  ): Promise<ComponentIdentificationResult> {
    const component = await this.componentLibraryService.getComponentById(bestAttempt.componentId);
    
    return {
      id: '',
      detectedSymbolId: detectedSymbol.id,
      componentId: bestAttempt.componentId,
      identificationMethod: 'ml_classification',
      confidence: bestAttempt.confidence,
      matchDetails: {
        symbolSimilarity: bestAttempt.confidence,
        categoryMatch: false,
        propertyMatches: [],
        industryStandardCompliance: false,
        contextualFactors: []
      },
      specifications: component?.specifications || {
        id: '',
        componentId: bestAttempt.componentId,
        functionDescription: 'Low confidence identification - verification recommended',
        technicalDetails: 'Component match found but confidence is below threshold',
        createdAt: new Date()
      },
      properties: component?.properties || [],
      ratings: component?.ratings || [],
      alternativeMatches: [],
      createdAt: new Date()
    };
  }

  /**
   * Create error result
   */
  private async createErrorResult(detectedSymbol: DetectedSymbol, error: Error): Promise<ComponentIdentificationResult> {
    return {
      id: '',
      detectedSymbolId: detectedSymbol.id,
      componentId: '',
      identificationMethod: 'ml_classification',
      confidence: 0,
      matchDetails: {
        symbolSimilarity: 0,
        categoryMatch: false,
        propertyMatches: [],
        industryStandardCompliance: false,
        contextualFactors: [{
          factor: 'error',
          value: error.message,
          influence: -1
        }]
      },
      specifications: {
        id: '',
        componentId: '',
        functionDescription: `Identification failed: ${error.message}`,
        technicalDetails: 'Error occurred during component identification process',
        createdAt: new Date()
      },
      properties: [],
      ratings: [],
      alternativeMatches: [],
      createdAt: new Date()
    };
  }
}