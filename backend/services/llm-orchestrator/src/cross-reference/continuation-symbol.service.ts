/**
 * Continuation Symbol Service
 * 
 * Detects and handles continuation symbols that indicate components spanning multiple pages.
 * Identifies arrows, connectors, off-page references, and other symbols used to show
 * component relationships across schematic pages.
 * 
 * Story: 4.4 Cross-Reference Engine
 * Task: 4.4.1 Build Cross-Page Reference Detection System
 */

import { Pool } from 'pg';
import {
  ContinuationSymbolDetection,
  CrossPageReference,
  CrossPageReferenceType,
  CrossPageReferenceError,
  CrossPageReferenceErrorCodes
} from '../../../../shared/types/cross-page-reference.types';

export class ContinuationSymbolService {
  private db: Pool;

  // Patterns for continuation symbol recognition
  private readonly CONTINUATION_PATTERNS = {
    // Directional arrows
    arrow_right: /arrow.*right|right.*arrow|→|>>/i,
    arrow_left: /arrow.*left|left.*arrow|←|<</i,
    arrow_up: /arrow.*up|up.*arrow|↑|\^/i,
    arrow_down: /arrow.*down|down.*arrow|↓/i,
    
    // Off-page connectors
    off_page: /off.*page|page.*off|offpage/i,
    page_connector: /page.*connect|connect.*page/i,
    to_page: /to.*page|page.*\d+/i,
    from_page: /from.*page|page.*reference/i,
    
    // Connection symbols
    connector: /connect|conn|terminal|term/i,
    junction: /junction|join|node/i,
    continuation: /continue|cont|continued/i,
    
    // Line continuation
    line_break: /break|split|divide/i,
    line_continuation: /line.*cont|cont.*line/i,
    
    // Reference markers
    reference_marker: /ref|reference|marker/i,
    detail_marker: /detail|dtl/i,
    see_page: /see.*page|refer.*page/i,
    
    // Special symbols
    bubble: /bubble|circle|oval/i,
    diamond: /diamond|rhomb/i,
    pentagon: /pentagon|five.*side/i,
    
    // Text-based indicators
    continued_text: /continued|cont'd|see.*sheet|next.*sheet/i,
    sheet_reference: /sheet.*\d+|sh\d+|\(\d+\)/i
  };

  // Symbol confidence scoring weights
  private readonly SYMBOL_WEIGHTS = {
    off_page: 0.95,
    page_connector: 0.9,
    arrow_right: 0.85,
    arrow_left: 0.85,
    to_page: 0.8,
    from_page: 0.8,
    continuation: 0.75,
    connector: 0.7,
    see_page: 0.7,
    continued_text: 0.65,
    sheet_reference: 0.6,
    arrow_up: 0.5,
    arrow_down: 0.5,
    reference_marker: 0.5,
    detail_marker: 0.45,
    junction: 0.4,
    line_break: 0.35,
    line_continuation: 0.3,
    bubble: 0.25,
    diamond: 0.2,
    pentagon: 0.15
  };

  constructor(database: Pool) {
    this.db = database;
  }

  /**
   * Detect continuation symbols in detected components
   */
  async detectContinuationSymbols(
    documentId: string,
    pageNumbers?: number[]
  ): Promise<ContinuationSymbolDetection[]> {
    const client = await this.db.connect();
    
    try {
      let query = `
        SELECT ds.id, ds.symbol_type, ds.symbol_category, ds.description,
               ds.location_x, ds.location_y, ds.bounding_box, ds.confidence,
               sdr.page_number, sdr.document_id
        FROM electrical_analysis.detected_symbols ds
        JOIN electrical_analysis.symbol_detection_results sdr ON ds.detection_result_id = sdr.id
        WHERE sdr.document_id = $1
      `;
      
      const params: any[] = [documentId];
      
      if (pageNumbers && pageNumbers.length > 0) {
        query += ` AND sdr.page_number = ANY($2)`;
        params.push(pageNumbers);
      }
      
      query += ` ORDER BY sdr.page_number, ds.location_y, ds.location_x`;

      const result = await client.query(query, params);
      const detectedSymbols = result.rows;

      const continuationSymbols: ContinuationSymbolDetection[] = [];

      for (const symbol of detectedSymbols) {
        const continuationMatch = this.analyzeContinuationSymbol(symbol);
        
        if (continuationMatch) {
          continuationSymbols.push({
            symbolType: continuationMatch.symbolType,
            componentId: symbol.id,
            pageNumber: symbol.page_number,
            coordinates: {
              x: parseFloat(symbol.location_x),
              y: parseFloat(symbol.location_y)
            },
            confidence: continuationMatch.confidence
          });
        }
      }

      return continuationSymbols;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CrossPageReferenceError(
        `Failed to detect continuation symbols: ${errorMessage}`,
        CrossPageReferenceErrorCodes.DETECTION_FAILED,
        { documentId, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Analyze a symbol to determine if it's a continuation symbol
   */
  private analyzeContinuationSymbol(symbol: any): {
    symbolType: string;
    confidence: number;
  } | null {
    const textToAnalyze = [
      symbol.symbol_type,
      symbol.symbol_category,
      symbol.description
    ].filter(text => text && typeof text === 'string').join(' ').toLowerCase();

    let bestMatch: { symbolType: string; confidence: number } | null = null;
    let highestScore = 0;

    // Test against all patterns
    for (const [patternName, pattern] of Object.entries(this.CONTINUATION_PATTERNS)) {
      if (pattern.test(textToAnalyze)) {
        const baseScore = this.SYMBOL_WEIGHTS[patternName as keyof typeof this.SYMBOL_WEIGHTS] || 0.1;
        
        // Apply confidence modifiers based on original symbol confidence
        const modifiedScore = baseScore * parseFloat(symbol.confidence);
        
        if (modifiedScore > highestScore) {
          highestScore = modifiedScore;
          bestMatch = {
            symbolType: patternName,
            confidence: modifiedScore
          };
        }
      }
    }

    // Additional context-based scoring
    if (bestMatch) {
      bestMatch.confidence = this.applyContextualScoring(bestMatch, symbol);
    }

    return bestMatch && bestMatch.confidence > 0.3 ? bestMatch : null;
  }

  /**
   * Apply contextual scoring based on symbol properties
   */
  private applyContextualScoring(
    match: { symbolType: string; confidence: number },
    symbol: any
  ): number {
    let adjustedConfidence = match.confidence;

    // Parse bounding box if available
    let boundingBox: any = null;
    try {
      if (symbol.bounding_box) {
        boundingBox = typeof symbol.bounding_box === 'string' 
          ? JSON.parse(symbol.bounding_box) 
          : symbol.bounding_box;
      }
    } catch (error) {
      // Ignore parsing errors
    }

    // Size-based adjustments
    if (boundingBox) {
      const area = (boundingBox.width || 0) * (boundingBox.height || 0);
      
      // Small symbols are more likely to be continuation markers
      if (area < 100) {
        adjustedConfidence *= 1.1;
      } else if (area > 1000) {
        adjustedConfidence *= 0.9;
      }
      
      // Aspect ratio considerations
      const aspectRatio = (boundingBox.width || 1) / (boundingBox.height || 1);
      
      // Horizontal arrows/connectors
      if (match.symbolType.includes('arrow_right') || match.symbolType.includes('arrow_left')) {
        if (aspectRatio > 1.5) {
          adjustedConfidence *= 1.2;
        }
      }
      
      // Vertical arrows
      if (match.symbolType.includes('arrow_up') || match.symbolType.includes('arrow_down')) {
        if (aspectRatio < 0.7) {
          adjustedConfidence *= 1.2;
        }
      }
    }

    // Position-based adjustments
    const x = parseFloat(symbol.location_x);
    const y = parseFloat(symbol.location_y);

    // Symbols near page edges are more likely to be continuation symbols
    if (x < 0.1 || x > 0.9 || y < 0.1 || y > 0.9) {
      adjustedConfidence *= 1.15;
    }

    // Symbol category adjustments
    if (symbol.symbol_category) {
      const category = symbol.symbol_category.toLowerCase();
      
      if (category.includes('connector') || category.includes('terminal')) {
        adjustedConfidence *= 1.1;
      } else if (category.includes('passive') || category.includes('active')) {
        adjustedConfidence *= 0.8; // Less likely to be continuation symbols
      }
    }

    return Math.min(1.0, adjustedConfidence);
  }

  /**
   * Find related continuation symbols across pages
   */
  async findRelatedContinuationSymbols(
    continuationSymbol: ContinuationSymbolDetection,
    documentId: string
  ): Promise<ContinuationSymbolDetection[]> {
    const client = await this.db.connect();
    
    try {
      // Look for symbols on other pages that might be related
      const query = `
        SELECT ds.id, ds.symbol_type, ds.symbol_category, ds.description,
               ds.location_x, ds.location_y, ds.confidence, sdr.page_number
        FROM electrical_analysis.detected_symbols ds
        JOIN electrical_analysis.symbol_detection_results sdr ON ds.detection_result_id = sdr.id
        WHERE sdr.document_id = $1 AND sdr.page_number != $2
        ORDER BY sdr.page_number, ds.location_y, ds.location_x
      `;

      const result = await client.query(query, [documentId, continuationSymbol.pageNumber]);
      const candidateSymbols = result.rows;

      const relatedSymbols: ContinuationSymbolDetection[] = [];

      for (const candidate of candidateSymbols) {
        const match = this.analyzeContinuationSymbol(candidate);
        
        if (match && this.isSymbolPairRelated(continuationSymbol, match, candidate)) {
          relatedSymbols.push({
            symbolType: match.symbolType,
            componentId: candidate.id,
            pageNumber: candidate.page_number,
            coordinates: {
              x: parseFloat(candidate.location_x),
              y: parseFloat(candidate.location_y)
            },
            confidence: match.confidence
          });
        }
      }

      return relatedSymbols.sort((a, b) => b.confidence - a.confidence);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CrossPageReferenceError(
        `Failed to find related continuation symbols: ${errorMessage}`,
        CrossPageReferenceErrorCodes.DETECTION_FAILED,
        { continuationSymbol, documentId, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Determine if two continuation symbols are related
   */
  private isSymbolPairRelated(
    symbol1: ContinuationSymbolDetection,
    match2: { symbolType: string; confidence: number },
    symbol2Data: any
  ): boolean {
    // Complementary symbol types
    const complementaryPairs = [
      ['arrow_right', 'arrow_left'],
      ['to_page', 'from_page'],
      ['off_page', 'page_connector'],
      ['continuation', 'continued_text']
    ];

    for (const [type1, type2] of complementaryPairs) {
      if ((symbol1.symbolType === type1 && match2.symbolType === type2) ||
          (symbol1.symbolType === type2 && match2.symbolType === type1)) {
        return true;
      }
    }

    // Similar positions (relative to page)
    const x1 = symbol1.coordinates.x;
    const y1 = symbol1.coordinates.y;
    const x2 = parseFloat(symbol2Data.location_x);
    const y2 = parseFloat(symbol2Data.location_y);

    // Check if symbols are in similar positions on their respective pages
    const xDiff = Math.abs(x1 - x2);
    const yDiff = Math.abs(y1 - y2);

    if (xDiff < 0.1 && yDiff < 0.2) { // Similar vertical alignment, close horizontal
      return true;
    }

    // Same symbol types with high confidence
    if (symbol1.symbolType === match2.symbolType && 
        symbol1.confidence > 0.7 && match2.confidence > 0.7) {
      return true;
    }

    return false;
  }

  /**
   * Create cross-page references from continuation symbols
   */
  async createCrossPageReferencesFromContinuation(
    continuationSymbols: ContinuationSymbolDetection[],
    documentId: string
  ): Promise<CrossPageReference[]> {
    const client = await this.db.connect();
    
    try {
      const crossPageReferences: CrossPageReference[] = [];

      // Group symbols by type and find pairs
      const symbolGroups = new Map<string, ContinuationSymbolDetection[]>();
      
      for (const symbol of continuationSymbols) {
        if (!symbolGroups.has(symbol.symbolType)) {
          symbolGroups.set(symbol.symbolType, []);
        }
        symbolGroups.get(symbol.symbolType)!.push(symbol);
      }

      // Find related symbols across pages
      for (const symbol of continuationSymbols) {
        const relatedSymbols = await this.findRelatedContinuationSymbols(symbol, documentId);
        
        for (const related of relatedSymbols) {
          // Avoid duplicate pairs
          const existingPair = crossPageReferences.find(ref => 
            (ref.sourceComponentId === symbol.componentId && ref.targetComponentId === related.componentId) ||
            (ref.sourceComponentId === related.componentId && ref.targetComponentId === symbol.componentId)
          );

          if (!existingPair) {
            const referenceType = this.determineContinuationReferenceType(symbol, related);
            const confidence = Math.min(symbol.confidence, related.confidence);

            // Create database record
            const insertQuery = `
              INSERT INTO electrical_analysis.cross_page_references
              (source_component_id, target_component_id, reference_designation,
               source_page_number, target_page_number, source_document_id, target_document_id,
               reference_type, continuation_symbol, confidence)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              RETURNING id, source_component_id, target_component_id, reference_designation,
                        source_page_number, target_page_number, source_document_id, target_document_id,
                        reference_type, continuation_symbol, confidence, created_at
            `;

            const result = await client.query(insertQuery, [
              symbol.componentId,
              related.componentId,
              `CONT_${symbol.symbolType.toUpperCase()}`,
              symbol.pageNumber,
              related.pageNumber,
              documentId,
              documentId,
              referenceType,
              symbol.symbolType,
              confidence
            ]);

            const row = result.rows[0];
            crossPageReferences.push({
              id: row.id,
              sourceComponentId: row.source_component_id,
              targetComponentId: row.target_component_id,
              referenceDesignation: row.reference_designation,
              sourcePageNumber: row.source_page_number,
              targetPageNumber: row.target_page_number,
              sourceDocumentId: row.source_document_id,
              targetDocumentId: row.target_document_id,
              referenceType: row.reference_type,
              continuationSymbol: row.continuation_symbol,
              confidence: row.confidence,
              createdAt: row.created_at
            });
          }
        }
      }

      return crossPageReferences;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CrossPageReferenceError(
        `Failed to create cross-page references from continuation symbols: ${errorMessage}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { documentId, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Determine reference type for continuation symbol pairs
   */
  private determineContinuationReferenceType(
    symbol1: ContinuationSymbolDetection,
    symbol2: ContinuationSymbolDetection
  ): CrossPageReferenceType {
    const type1 = symbol1.symbolType;
    const type2 = symbol2.symbolType;

    // Off-page connectors indicate component continuation
    if (type1.includes('off_page') || type2.includes('off_page') ||
        type1.includes('page_connector') || type2.includes('page_connector')) {
      return 'component_continuation';
    }

    // Detail markers indicate detail references
    if (type1.includes('detail') || type2.includes('detail')) {
      return 'detail_reference';
    }

    // Reference markers indicate schematic references
    if (type1.includes('reference') || type2.includes('reference') ||
        type1.includes('see_page') || type2.includes('see_page')) {
      return 'schematic_reference';
    }

    // Arrows typically indicate component continuation
    if (type1.includes('arrow') || type2.includes('arrow')) {
      return 'component_continuation';
    }

    // Default to schematic reference
    return 'schematic_reference';
  }

  /**
   * Get continuation symbol statistics
   */
  async getContinuationSymbolStats(documentId: string): Promise<{
    totalSymbols: number;
    byType: Record<string, number>;
    byPage: Record<number, number>;
    averageConfidence: number;
    crossPagePairs: number;
  }> {
    const continuationSymbols = await this.detectContinuationSymbols(documentId);
    
    const stats = {
      totalSymbols: continuationSymbols.length,
      byType: {} as Record<string, number>,
      byPage: {} as Record<number, number>,
      averageConfidence: 0,
      crossPagePairs: 0
    };

    // Count by type
    for (const symbol of continuationSymbols) {
      stats.byType[symbol.symbolType] = (stats.byType[symbol.symbolType] || 0) + 1;
      stats.byPage[symbol.pageNumber] = (stats.byPage[symbol.pageNumber] || 0) + 1;
    }

    // Calculate average confidence
    if (continuationSymbols.length > 0) {
      const totalConfidence = continuationSymbols.reduce((sum, symbol) => sum + symbol.confidence, 0);
      stats.averageConfidence = totalConfidence / continuationSymbols.length;
    }

    // Count cross-page pairs
    for (const symbol of continuationSymbols) {
      const related = await this.findRelatedContinuationSymbols(symbol, documentId);
      stats.crossPagePairs += related.length;
    }
    
    // Avoid double counting pairs
    stats.crossPagePairs = Math.floor(stats.crossPagePairs / 2);

    return stats;
  }
}