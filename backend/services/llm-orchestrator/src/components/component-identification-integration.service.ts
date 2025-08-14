/**
 * Component Identification Integration Service
 * 
 * Integrates symbol detection results with component identification pipeline.
 * Handles the complete flow from detected symbols to component specifications.
 * 
 * Story: 4.2 Component Database Integration
 * Task: 4.2.3 Build Component Identification Pipeline
 */

import { Pool } from 'pg';
import {
  DetectedSymbol,
  // SymbolDetectionResult // Not directly used
} from '../../../../shared/types/symbol-detection.types';
import {
  ComponentIdentificationResult,
  ComponentLookupRequest,
  // ComponentLookupResponse, // Not directly used
  // ComponentMatch, // Not directly used
  ContextualHint,
  ComponentIdentificationError
} from '../../../../shared/types/component-database.types';
import { ComponentLibraryService } from './component-library.service';
import { ComponentSpecificationService } from './specification.service';
import { ComponentIdentificationService } from './identification.service';
import { SymbolDetectionStorageService } from '../services/symbol-detection-storage.service';

export interface ComponentIdentificationPipelineConfig {
  enableBatchProcessing: boolean;
  maxConcurrentIdentifications: number;
  confidenceThreshold: number;
  enableContextualHints: boolean;
  cacheResults: boolean;
  performanceTargetMs: number; // <500ms as per AC 12
}

export interface ComponentIdentificationBatchRequest {
  sessionId: string;
  detectionResultId: string;
  contextualHints?: ContextualHint[];
  options?: {
    confidenceThreshold?: number;
    maxAlternatives?: number;
    enableFallback?: boolean;
  };
}

export interface ComponentIdentificationBatchResponse {
  sessionId: string;
  detectionResultId: string;
  identifications: ComponentIdentificationResult[];
  summary: {
    totalSymbols: number;
    identifiedSymbols: number;
    averageConfidence: number;
    processingTimeMs: number;
    unknownSymbols: DetectedSymbol[];
  };
  errors: {
    symbolId: string;
    error: string;
  }[];
}

export class ComponentIdentificationIntegrationService {
  private db: Pool;
  private componentLibraryService: ComponentLibraryService;
  // private specificationService: ComponentSpecificationService; // Not used in current implementation
  private identificationService: ComponentIdentificationService;
  private symbolDetectionService: SymbolDetectionStorageService;
  private config: ComponentIdentificationPipelineConfig;

  // Performance tracking
  private identificationCache = new Map<string, ComponentIdentificationResult>();
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  constructor(
    database: Pool,
    componentLibraryService: ComponentLibraryService,
    _specificationService: ComponentSpecificationService, // Unused but kept for interface compatibility
    identificationService: ComponentIdentificationService,
    symbolDetectionService: SymbolDetectionStorageService,
    config: Partial<ComponentIdentificationPipelineConfig> = {}
  ) {
    this.db = database;
    this.componentLibraryService = componentLibraryService;
    // this.specificationService = specificationService; // Not used in current implementation
    this.identificationService = identificationService;
    this.symbolDetectionService = symbolDetectionService;
    
    this.config = {
      enableBatchProcessing: true,
      maxConcurrentIdentifications: 10,
      confidenceThreshold: 0.5,
      enableContextualHints: true,
      cacheResults: true,
      performanceTargetMs: 500,
      ...config
    };
  }

  /**
   * Process complete symbol detection result for component identification
   */
  async processSymbolDetectionResult(request: ComponentIdentificationBatchRequest): Promise<ComponentIdentificationBatchResponse> {
    const startTime = Date.now();
    
    try {
      // Get symbol detection result
      const detectionResult = await this.symbolDetectionService.getDetectionResult(request.detectionResultId);
      
      if (!detectionResult) {
        throw new ComponentIdentificationError('Symbol detection result not found');
      }

      const identifications: ComponentIdentificationResult[] = [];
      const errors: { symbolId: string; error: string }[] = [];
      const unknownSymbols: DetectedSymbol[] = [];

      // Process symbols based on configuration
      if (this.config.enableBatchProcessing) {
        const results = await this.processBatch(
          detectionResult.detectedSymbols,
          request.contextualHints,
          request.options
        );
        identifications.push(...results.identifications);
        errors.push(...results.errors);
        unknownSymbols.push(...results.unknownSymbols);
      } else {
        // Sequential processing
        for (const symbol of detectionResult.detectedSymbols) {
          try {
            const identification = await this.identifySymbol(symbol, request.contextualHints, request.options);
            if (identification) {
              identifications.push(identification);
            } else {
              unknownSymbols.push(symbol);
            }
          } catch (error) {
            errors.push({
              symbolId: symbol.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      const processingTime = Date.now() - startTime;
      
      // Performance warning if over target
      if (processingTime > this.config.performanceTargetMs) {
        console.warn(`Component identification took ${processingTime}ms, target is ${this.config.performanceTargetMs}ms`);
      }

      // Calculate summary
      const totalConfidence = identifications.reduce((sum, id) => sum + id.confidence, 0);
      const averageConfidence = identifications.length > 0 ? totalConfidence / identifications.length : 0;

      return {
        sessionId: request.sessionId,
        detectionResultId: request.detectionResultId,
        identifications,
        summary: {
          totalSymbols: detectionResult.detectedSymbols.length,
          identifiedSymbols: identifications.length,
          averageConfidence,
          processingTimeMs: processingTime,
          unknownSymbols
        },
        errors
      };

    } catch (error) {
      throw new ComponentIdentificationError(
        `Failed to process symbol detection result: ${error instanceof Error ? error.message : String(error)}`,
        { request, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Identify single symbol with caching and error handling
   */
  async identifySymbol(
    symbol: DetectedSymbol,
    contextualHints?: ContextualHint[],
    options?: {
      confidenceThreshold?: number;
      maxAlternatives?: number;
      enableFallback?: boolean;
    }
  ): Promise<ComponentIdentificationResult | null> {
    try {
      // Check cache if enabled
      if (this.config.cacheResults) {
        const cacheKey = this.generateCacheKey(symbol, contextualHints, options);
        const cached = this.identificationCache.get(cacheKey);
        if (cached) {
          return cached;
        }
      }

      // Apply contextual hints if enabled
      let enhancedHints = contextualHints || [];
      if (this.config.enableContextualHints) {
        enhancedHints = await this.generateContextualHints(symbol, contextualHints);
      }

      // Create identification request
      const lookupRequest: ComponentLookupRequest = {
        detectedSymbol: symbol,
        contextualHints: enhancedHints,
        confidenceThreshold: options?.confidenceThreshold || this.config.confidenceThreshold,
        maxResults: options?.maxAlternatives || 5
      };

      // Perform identification
      const response = await this.identificationService.identifyComponent(lookupRequest);

      if (!response.success) {
        // Try fallback strategies if enabled
        if (options?.enableFallback !== false) {
          const fallbackResult = await this.attemptFallbackIdentification(symbol);
          if (fallbackResult) {
            // Cache result
            if (this.config.cacheResults) {
              const cacheKey = this.generateCacheKey(symbol, contextualHints, options);
              this.identificationCache.set(cacheKey, fallbackResult);
              // Clean cache periodically
              setTimeout(() => this.identificationCache.delete(cacheKey), this.CACHE_TTL);
            }
            return fallbackResult;
          }
        }
        
        return null; // Could not identify
      }

      const identificationResult = response.identificationResult;

      // Cache successful result
      if (this.config.cacheResults) {
        const cacheKey = this.generateCacheKey(symbol, contextualHints, options);
        this.identificationCache.set(cacheKey, identificationResult);
        setTimeout(() => this.identificationCache.delete(cacheKey), this.CACHE_TTL);
      }

      return identificationResult;

    } catch (error) {
      throw new ComponentIdentificationError(
        `Failed to identify symbol: ${error instanceof Error ? error.message : String(error)}`,
        { symbolId: symbol.id, symbolType: symbol.symbolType, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Process multiple symbols concurrently
   */
  private async processBatch(
    symbols: DetectedSymbol[],
    contextualHints?: ContextualHint[],
    options?: { confidenceThreshold?: number; maxAlternatives?: number; enableFallback?: boolean }
  ): Promise<{
    identifications: ComponentIdentificationResult[];
    errors: { symbolId: string; error: string }[];
    unknownSymbols: DetectedSymbol[];
  }> {
    const identifications: ComponentIdentificationResult[] = [];
    const errors: { symbolId: string; error: string }[] = [];
    const unknownSymbols: DetectedSymbol[] = [];

    // Process in batches to respect concurrency limits
    for (let i = 0; i < symbols.length; i += this.config.maxConcurrentIdentifications) {
      const batch = symbols.slice(i, i + this.config.maxConcurrentIdentifications);
      
      const batchPromises = batch.map(async (symbol) => {
        try {
          const result = await this.identifySymbol(symbol, contextualHints, options);
          return { symbol, result, error: null };
        } catch (error) {
          return { symbol, result: null, error: error instanceof Error ? error.message : String(error) };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      batchResults.forEach(({ symbol, result, error }) => {
        if (error) {
          errors.push({ symbolId: symbol.id, error });
        } else if (result) {
          identifications.push(result);
        } else {
          unknownSymbols.push(symbol);
        }
      });
    }

    return { identifications, errors, unknownSymbols };
  }

  /**
   * Generate contextual hints from symbol and surrounding context
   */
  private async generateContextualHints(
    symbol: DetectedSymbol,
    existingHints?: ContextualHint[]
  ): Promise<ContextualHint[]> {
    const hints: ContextualHint[] = [...(existingHints || [])];

    try {
      // Extract hints from text labels
      if (symbol.features.textLabels && symbol.features.textLabels.length > 0) {
        for (const label of symbol.features.textLabels) {
          // Voltage level detection
          const voltageMatch = label.match(/(\d+\.?\d*)\s*[vV]/i);
          if (voltageMatch) {
            hints.push({
              type: 'voltage_level',
              value: voltageMatch[1],
              confidence: 0.8
            });
          }

          // Frequency detection
          const freqMatch = label.match(/(\d+\.?\d*)\s*([kKmMgG]?)([hH]z)/i);
          if (freqMatch) {
            hints.push({
              type: 'frequency_range',
              value: `${freqMatch[1]}${freqMatch[2]}Hz`,
              confidence: 0.7
            });
          }
        }
      }

      // Geometric hints
      const aspectRatio = symbol.features.geometricProperties.aspectRatio;
      if (aspectRatio > 3) {
        hints.push({
          type: 'circuit_type',
          value: 'wire_connection',
          confidence: 0.6
        });
      } else if (aspectRatio < 0.5) {
        hints.push({
          type: 'circuit_type',
          value: 'compact_component',
          confidence: 0.6
        });
      }

      // Position-based hints (could be enhanced with circuit topology analysis)
      if (symbol.location.y < 0.2) {
        hints.push({
          type: 'application',
          value: 'power_supply',
          confidence: 0.5
        });
      } else if (symbol.location.y > 0.8) {
        hints.push({
          type: 'application',
          value: 'ground_reference',
          confidence: 0.5
        });
      }

    } catch (error) {
      console.warn('Failed to generate contextual hints:', error);
    }

    return hints;
  }

  /**
   * Fallback identification strategies for unknown symbols
   */
  private async attemptFallbackIdentification(symbol: DetectedSymbol): Promise<ComponentIdentificationResult | null> {
    try {
      // Strategy 1: Generic component based on category
      if (symbol.symbolCategory !== 'custom') {
        const genericComponents = await this.componentLibraryService.searchComponents({
          symbolCategory: symbol.symbolCategory,
          limit: 1
        });

        if (genericComponents.components.length > 0) {
          const genericComponent = genericComponents.components[0];
          
          return {
            id: '',
            detectedSymbolId: symbol.id,
            componentId: genericComponent.id,
            identificationMethod: 'ml_classification',
            confidence: 0.3, // Low confidence for fallback
            matchDetails: {
              symbolSimilarity: 0.3,
              categoryMatch: true,
              propertyMatches: [],
              industryStandardCompliance: genericComponent.industryStandards.length > 0,
              contextualFactors: [{
                factor: 'fallback_strategy',
                value: 'generic_category_match',
                influence: -0.2
              }]
            },
            specifications: genericComponent.specifications || {
              id: '',
              componentId: genericComponent.id,
              functionDescription: `Generic ${symbol.symbolCategory} component - manual verification required`,
              technicalDetails: 'Fallback identification based on symbol category',
              createdAt: new Date()
            },
            properties: genericComponent.properties,
            ratings: genericComponent.ratings,
            alternativeMatches: [],
            createdAt: new Date()
          };
        }
      }

      // Strategy 2: Unknown component placeholder
      return {
        id: '',
        detectedSymbolId: symbol.id,
        componentId: '',
        identificationMethod: 'ml_classification',
        confidence: 0.1, // Very low confidence
        matchDetails: {
          symbolSimilarity: 0,
          categoryMatch: false,
          propertyMatches: [],
          industryStandardCompliance: false,
          contextualFactors: [{
            factor: 'fallback_strategy',
            value: 'unknown_component_placeholder',
            influence: -0.5
          }]
        },
        specifications: {
          id: '',
          componentId: '',
          functionDescription: 'Unknown electrical component - requires manual identification',
          technicalDetails: `Detected as ${symbol.symbolType} in ${symbol.symbolCategory} category with ${symbol.confidence} confidence`,
          createdAt: new Date()
        },
        properties: [],
        ratings: [],
        alternativeMatches: [],
        createdAt: new Date()
      };

    } catch (error) {
      console.warn('Fallback identification failed:', error);
      return null;
    }
  }

  /**
   * Generate cache key for identification results
   */
  private generateCacheKey(
    symbol: DetectedSymbol,
    contextualHints?: ContextualHint[],
    options?: any
  ): string {
    const keyData = {
      symbolId: symbol.id,
      symbolType: symbol.symbolType,
      symbolCategory: symbol.symbolCategory,
      confidence: symbol.confidence,
      hints: contextualHints?.map(h => `${h.type}:${h.value}:${h.confidence}`).join('|') || '',
      options: JSON.stringify(options || {})
    };

    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  /**
   * Get identification statistics for session
   */
  async getIdentificationStatistics(sessionId: string): Promise<{
    totalSymbols: number;
    identifiedSymbols: number;
    averageConfidence: number;
    identificationsByCategory: Record<string, number>;
    identificationsByMethod: Record<string, number>;
    unknownSymbolTypes: string[];
  }> {
    const client = await this.db.connect();
    try {
      // Get all identifications for session through detection results
      const query = `
        SELECT 
          ci.identification_method, ci.confidence,
          ds.symbol_type, ds.symbol_category,
          sdr.session_id
        FROM electrical_analysis.component_identifications ci
        JOIN electrical_analysis.detected_symbols ds ON ci.detected_symbol_id = ds.id
        JOIN electrical_analysis.symbol_detection_results sdr ON ds.detection_result_id = sdr.id
        WHERE sdr.session_id = $1
      `;

      const result = await client.query(query, [sessionId]);
      const identifications = result.rows;

      const totalSymbols = identifications.length;
      const identificationsByCategory: Record<string, number> = {};
      const identificationsByMethod: Record<string, number> = {};
      let totalConfidence = 0;

      identifications.forEach(row => {
        const category = row.symbol_category;
        const method = row.identification_method;
        const confidence = parseFloat(row.confidence);

        identificationsByCategory[category] = (identificationsByCategory[category] || 0) + 1;
        identificationsByMethod[method] = (identificationsByMethod[method] || 0) + 1;
        totalConfidence += confidence;
      });

      const averageConfidence = totalSymbols > 0 ? totalConfidence / totalSymbols : 0;

      // Get unknown symbol types (symbols without identifications)
      const unknownQuery = `
        SELECT DISTINCT ds.symbol_type
        FROM electrical_analysis.detected_symbols ds
        JOIN electrical_analysis.symbol_detection_results sdr ON ds.detection_result_id = sdr.id
        LEFT JOIN electrical_analysis.component_identifications ci ON ds.id = ci.detected_symbol_id
        WHERE sdr.session_id = $1 AND ci.id IS NULL
      `;

      const unknownResult = await client.query(unknownQuery, [sessionId]);
      const unknownSymbolTypes = unknownResult.rows.map(row => row.symbol_type);

      return {
        totalSymbols,
        identifiedSymbols: totalSymbols,
        averageConfidence,
        identificationsByCategory,
        identificationsByMethod,
        unknownSymbolTypes
      };

    } catch (error) {
      throw new ComponentIdentificationError(
        `Failed to get identification statistics: ${error instanceof Error ? error.message : String(error)}`,
        { sessionId, error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Clear identification cache
   */
  clearCache(): void {
    this.identificationCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics(): { size: number; hitRate?: number } {
    return {
      size: this.identificationCache.size
    };
  }
}