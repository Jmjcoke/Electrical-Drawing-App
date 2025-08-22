/**
 * Cross-Page Reference Detector
 * 
 * Detects component references across pages by analyzing reference designations,
 * continuation symbols, and component relationships in electrical drawings.
 * 
 * Story: 4.4 Cross-Reference Engine
 * Task: 4.4.1 Build Cross-Page Reference Detection System
 */

import { Pool } from 'pg';
import {
  CrossPageReference,
  ComponentReference,
  ContinuationSymbolDetection,
  CrossPageDetectionResult,
  ReferenceDesignationMatch,
  CrossPageReferenceType,
  CrossPageReferenceError,
  CrossPageReferenceErrorCodes
} from '../../../../shared/types/cross-page-reference.types';

export class CrossPageReferenceDetector {
  private db: Pool;

  constructor(database: Pool) {
    this.db = database;
  }

  /**
   * Detect cross-page references for a document
   */
  async detectCrossPageReferences(
    sessionId: string,
    documentId: string,
    pageNumbers?: number[]
  ): Promise<CrossPageDetectionResult> {
    const startTime = Date.now();
    const client = await this.db.connect();

    try {
      // Get all detected symbols for the document
      const detectedSymbols = await this.getDetectedSymbols(client, documentId, pageNumbers);
      
      if (detectedSymbols.length === 0) {
        throw new CrossPageReferenceError(
          'No detected symbols found for document',
          CrossPageReferenceErrorCodes.REFERENCE_NOT_FOUND
        );
      }

      // Extract reference designations from symbols
      const referenceDesignations = await this.extractReferenceDesignations(detectedSymbols);
      
      // Find cross-page matches
      const crossPageMatches = await this.findCrossPageMatches(referenceDesignations);
      
      // Detect continuation symbols
      const continuationSymbols = await this.detectContinuationSymbols(detectedSymbols);
      
      // Create component references
      const componentReferences = await this.createComponentReferences(client, referenceDesignations, documentId);
      
      // Create cross-page reference records
      const crossPageLinks = await this.createCrossPageReferences(client, crossPageMatches, documentId);
      
      const processingTime = Date.now() - startTime;
      const confidence = this.calculateOverallConfidence(crossPageLinks, continuationSymbols);

      const result: CrossPageDetectionResult = {
        sessionId,
        documentId,
        detectedReferences: componentReferences,
        crossPageLinks,
        continuationSymbols,
        processingTime,
        confidence,
        timestamp: new Date()
      };

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new CrossPageReferenceError(
        `Cross-page reference detection failed: ${errorMessage}`,
        CrossPageReferenceErrorCodes.DETECTION_FAILED,
        { sessionId, documentId, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get detected symbols from database
   */
  private async getDetectedSymbols(client: any, documentId: string, pageNumbers?: number[]) {
    let query = `
      SELECT ds.id, ds.symbol_type, ds.symbol_category, ds.description, ds.confidence,
             ds.location_x, ds.location_y, ds.bounding_box, sdr.page_number,
             sdr.document_id
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
    return result.rows;
  }

  /**
   * Extract reference designations from detected symbols
   */
  private async extractReferenceDesignations(detectedSymbols: any[]): Promise<ReferenceDesignationMatch[]> {
    const referencePatterns = [
      // Standard component patterns
      /^([RCLUQ])(\d+)$/i,        // R1, C2, L3, U4, Q5
      /^(IC|OP|TR)(\d+)$/i,       // IC1, OP2, TR3
      /^([DJKSW])(\d+)$/i,        // D1, J2, K3, S4, W5
      /^(VR|RV)(\d+)$/i,          // VR1, RV2 (variable resistors)
      /^(FB|FL)(\d+)$/i,          // FB1, FL2 (ferrite beads, filters)
      /^(TP|GND)(\d+)?$/i,        // TP1, GND (test points, ground)
      /^([XYTV])(\d+)$/i,         // X1, Y2, T3, V4 (crystal, transformer, voltage)
      /^(PWR|VCC|VDD)(\d+)?$/i,   // Power supply designations
    ];

    const designations: ReferenceDesignationMatch[] = [];

    for (const symbol of detectedSymbols) {
      // Try to extract designation from description or symbol_type
      const textToAnalyze = [symbol.description, symbol.symbol_type].filter(Boolean).join(' ');
      
      for (const pattern of referencePatterns) {
        const match = textToAnalyze.match(pattern);
        if (match) {
          const designation = match[0].toUpperCase();
          
          designations.push({
            designation,
            componentId: symbol.id,
            pageNumber: symbol.page_number,
            documentId: symbol.document_id,
            confidence: symbol.confidence,
            location: {
              x: parseFloat(symbol.location_x),
              y: parseFloat(symbol.location_y)
            }
          });
          break; // Use first match
        }
      }
    }

    return designations;
  }

  /**
   * Find cross-page matches for reference designations
   */
  private async findCrossPageMatches(referenceDesignations: ReferenceDesignationMatch[]): Promise<{
    sourceMatch: ReferenceDesignationMatch;
    targetMatch: ReferenceDesignationMatch;
    referenceType: CrossPageReferenceType;
    confidence: number;
  }[]> {
    const matches: any[] = [];
    
    // Group by designation
    const designationGroups = new Map<string, ReferenceDesignationMatch[]>();
    
    for (const ref of referenceDesignations) {
      if (!designationGroups.has(ref.designation)) {
        designationGroups.set(ref.designation, []);
      }
      designationGroups.get(ref.designation)!.push(ref);
    }

    // Find cross-page matches
    for (const [designation, refs] of designationGroups) {
      if (refs.length > 1) {
        // Multiple instances of same designation - potential cross-page references
        for (let i = 0; i < refs.length; i++) {
          for (let j = i + 1; j < refs.length; j++) {
            const ref1 = refs[i];
            const ref2 = refs[j];
            
            if (ref1.pageNumber !== ref2.pageNumber) {
              // Cross-page match found
              const referenceType = this.determineReferenceType(designation);
              const confidence = Math.min(ref1.confidence, ref2.confidence);
              
              matches.push({
                sourceMatch: ref1,
                targetMatch: ref2,
                referenceType,
                confidence
              });
            }
          }
        }
      }
    }

    return matches;
  }

  /**
   * Determine reference type based on designation pattern
   */
  private determineReferenceType(designation: string): CrossPageReferenceType {
    const type = designation.charAt(0).toUpperCase();
    
    switch (type) {
      case 'R':
      case 'C':
      case 'L':
        return 'component_continuation';
      case 'U':
      case 'I':
        return 'detail_reference';
      case 'J':
      case 'P':
        return 'part_reference';
      case 'A':
      case 'M':
        return 'assembly_reference';
      default:
        return 'schematic_reference';
    }
  }

  /**
   * Detect continuation symbols (arrows, connectors, etc.)
   */
  private async detectContinuationSymbols(detectedSymbols: any[]): Promise<ContinuationSymbolDetection[]> {
    const continuationSymbols: ContinuationSymbolDetection[] = [];
    
    // Look for symbols that typically indicate continuation
    const continuationTypes = [
      'arrow',
      'connector',
      'terminal',
      'continuation_marker',
      'page_connector',
      'off_page_connector'
    ];

    for (const symbol of detectedSymbols) {
      const symbolType = symbol.symbol_type.toLowerCase();
      
      if (continuationTypes.some(type => symbolType.includes(type))) {
        continuationSymbols.push({
          symbolType: symbol.symbol_type,
          componentId: symbol.id,
          pageNumber: symbol.page_number,
          coordinates: {
            x: parseFloat(symbol.location_x),
            y: parseFloat(symbol.location_y)
          },
          confidence: symbol.confidence
        });
      }
    }

    return continuationSymbols;
  }

  /**
   * Create component reference records in database
   */
  private async createComponentReferences(
    client: any,
    referenceDesignations: ReferenceDesignationMatch[],
    documentId: string
  ): Promise<ComponentReference[]> {
    const componentReferences: ComponentReference[] = [];

    for (const ref of referenceDesignations) {
      try {
        // Check if reference already exists
        const existingQuery = `
          SELECT id FROM electrical_analysis.component_references
          WHERE component_id = $1 AND reference_designation = $2 AND document_id = $3
        `;
        
        const existingResult = await client.query(existingQuery, [
          ref.componentId,
          ref.designation,
          documentId
        ]);

        if (existingResult.rows.length === 0) {
          // Insert new component reference
          const insertQuery = `
            INSERT INTO electrical_analysis.component_references
            (component_id, reference_designation, page_number, document_id, is_main_reference)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, component_id, reference_designation, page_number, document_id,
                      component_type, is_main_reference, related_references, created_at
          `;

          const insertResult = await client.query(insertQuery, [
            ref.componentId,
            ref.designation,
            ref.pageNumber,
            documentId,
            true // Assume main reference for now
          ]);

          const row = insertResult.rows[0];
          componentReferences.push({
            componentId: row.component_id,
            referenceDesignation: row.reference_designation,
            pageNumber: row.page_number,
            documentId: row.document_id,
            componentType: row.component_type || '',
            isMainReference: row.is_main_reference,
            relatedReferences: row.related_references || []
          });
        }
      } catch (error) {
        console.error(`Failed to create component reference for ${ref.designation}:`, error);
      }
    }

    return componentReferences;
  }

  /**
   * Create cross-page reference records in database
   */
  private async createCrossPageReferences(
    client: any,
    crossPageMatches: any[],
    documentId: string
  ): Promise<CrossPageReference[]> {
    const crossPageLinks: CrossPageReference[] = [];

    for (const match of crossPageMatches) {
      try {
        // Check if cross-page reference already exists
        const existingQuery = `
          SELECT id FROM electrical_analysis.cross_page_references
          WHERE source_component_id = $1 AND target_component_id = $2 
            AND reference_designation = $3
        `;
        
        const existingResult = await client.query(existingQuery, [
          match.sourceMatch.componentId,
          match.targetMatch.componentId,
          match.sourceMatch.designation
        ]);

        if (existingResult.rows.length === 0) {
          // Insert new cross-page reference
          const insertQuery = `
            INSERT INTO electrical_analysis.cross_page_references
            (source_component_id, target_component_id, reference_designation,
             source_page_number, target_page_number, source_document_id, target_document_id,
             reference_type, confidence)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, source_component_id, target_component_id, reference_designation,
                      source_page_number, target_page_number, source_document_id, target_document_id,
                      reference_type, continuation_symbol, confidence, created_at
          `;

          const insertResult = await client.query(insertQuery, [
            match.sourceMatch.componentId,
            match.targetMatch.componentId,
            match.sourceMatch.designation,
            match.sourceMatch.pageNumber,
            match.targetMatch.pageNumber,
            documentId,
            documentId,
            match.referenceType,
            match.confidence
          ]);

          const row = insertResult.rows[0];
          crossPageLinks.push({
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
      } catch (error) {
        console.error(`Failed to create cross-page reference for ${match.sourceMatch.designation}:`, error);
      }
    }

    return crossPageLinks;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(
    crossPageLinks: CrossPageReference[],
    continuationSymbols: ContinuationSymbolDetection[]
  ): number {
    if (crossPageLinks.length === 0 && continuationSymbols.length === 0) {
      return 0;
    }

    let totalConfidence = 0;
    let count = 0;

    // Add cross-page link confidences
    for (const link of crossPageLinks) {
      totalConfidence += link.confidence;
      count++;
    }

    // Add continuation symbol confidences
    for (const symbol of continuationSymbols) {
      totalConfidence += symbol.confidence;
      count++;
    }

    return count > 0 ? totalConfidence / count : 0;
  }

  /**
   * Get cross-page references for a specific component
   */
  async getCrossPageReferencesForComponent(componentId: string): Promise<CrossPageReference[]> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT id, source_component_id, target_component_id, reference_designation,
               source_page_number, target_page_number, source_document_id, target_document_id,
               reference_type, continuation_symbol, confidence, created_at
        FROM electrical_analysis.cross_page_references
        WHERE source_component_id = $1 OR target_component_id = $1
        ORDER BY reference_designation, source_page_number
      `;

      const result = await client.query(query, [componentId]);

      return result.rows.map(row => ({
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
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new CrossPageReferenceError(
        `Failed to get cross-page references for component: ${errorMessage}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { componentId, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Find components by reference designation
   */
  async findComponentsByDesignation(
    designation: string,
    documentId?: string
  ): Promise<ComponentReference[]> {
    const client = await this.db.connect();
    
    try {
      let query = `
        SELECT id, component_id, reference_designation, page_number, document_id,
               component_type, is_main_reference, related_references, created_at
        FROM electrical_analysis.component_references
        WHERE reference_designation = $1
      `;
      
      const params: any[] = [designation];
      
      if (documentId) {
        query += ` AND document_id = $2`;
        params.push(documentId);
      }
      
      query += ` ORDER BY page_number`;

      const result = await client.query(query, params);

      return result.rows.map(row => ({
        componentId: row.component_id,
        referenceDesignation: row.reference_designation,
        pageNumber: row.page_number,
        documentId: row.document_id,
        componentType: row.component_type || '',
        isMainReference: row.is_main_reference,
        relatedReferences: row.related_references || []
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new CrossPageReferenceError(
        `Failed to find components by designation: ${errorMessage}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { designation, documentId, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }
}