/**
 * Reference Matcher Service
 * 
 * Handles reference designation matching and parsing for electrical components.
 * Supports standard electrical component designation patterns (R1, C2, IC3, etc.).
 * 
 * Story: 4.4 Cross-Reference Engine
 * Task: 4.4.1 Build Cross-Page Reference Detection System
 */

import { Pool } from 'pg';
import {
  ReferenceDesignationMatch,
  ReferenceMatchingConfig,
  ReferenceValidationResult,
  ReferenceConflictResolution,
  CrossPageReferenceError,
  CrossPageReferenceErrorCodes
} from '../../../../shared/types/cross-page-reference.types';

export class ReferenceMatcherService {
  private db: Pool;
  private config: ReferenceMatchingConfig;

  // Standard electrical component designation patterns
  private readonly DESIGNATION_PATTERNS = {
    // Basic passive components
    resistor: /^R(\d+)([A-Z]?)$/i,
    capacitor: /^C(\d+)([A-Z]?)$/i,
    inductor: /^L(\d+)([A-Z]?)$/i,
    
    // Active components
    diode: /^D(\d+)([A-Z]?)$/i,
    transistor: /^Q(\d+)([A-Z]?)$/i,
    ic: /^(IC|U)(\d+)([A-Z]?)$/i,
    op_amp: /^(OP|OA)(\d+)([A-Z]?)$/i,
    
    // Logic components
    gate: /^(G|GATE)(\d+)([A-Z]?)$/i,
    flip_flop: /^(FF|U)(\d+)([A-Z]?)$/i,
    
    // Power components
    transformer: /^T(\d+)([A-Z]?)$/i,
    battery: /^(BT|BAT)(\d+)([A-Z]?)$/i,
    power_supply: /^(PS|PWR)(\d+)([A-Z]?)$/i,
    voltage_regulator: /^(VR|REG)(\d+)([A-Z]?)$/i,
    
    // Connectors and mechanical
    connector: /^(J|CON|CONN)(\d+)([A-Z]?)$/i,
    switch: /^S(\d+)([A-Z]?)$/i,
    relay: /^K(\d+)([A-Z]?)$/i,
    fuse: /^F(\d+)([A-Z]?)$/i,
    
    // Test and measurement
    test_point: /^TP(\d+)([A-Z]?)$/i,
    jumper: /^(JP|JMP)(\d+)([A-Z]?)$/i,
    
    // Special designations
    ground: /^(GND|GROUND)(\d+)?([A-Z]?)$/i,
    power: /^(VCC|VDD|VEE|VSS)(\d+)?([A-Z]?)$/i,
    signal: /^(SIG|SIGNAL)(\d+)([A-Z]?)$/i,
    
    // Crystal and timing
    crystal: /^(X|XTAL|Y)(\d+)([A-Z]?)$/i,
    oscillator: /^(OSC|XO)(\d+)([A-Z]?)$/i,
    
    // Filters and networks
    filter: /^(FL|FIL)(\d+)([A-Z]?)$/i,
    network: /^(N|NET)(\d+)([A-Z]?)$/i,
    ferrite_bead: /^(FB|BEAD)(\d+)([A-Z]?)$/i,
    
    // Variable components
    potentiometer: /^(RV|POT|VR)(\d+)([A-Z]?)$/i,
    variable_capacitor: /^(CV|VC)(\d+)([A-Z]?)$/i,
    
    // Protection devices
    tvs_diode: /^(TVS|D)(\d+)([A-Z]?)$/i,
    varistor: /^(MOV|VDR)(\d+)([A-Z]?)$/i,
    
    // Assembly and mechanical
    assembly: /^A(\d+)([A-Z]?)$/i,
    mechanical: /^M(\d+)([A-Z]?)$/i,
    mounting: /^(MH|MOUNT)(\d+)([A-Z]?)$/i
  };

  constructor(database: Pool, config?: Partial<ReferenceMatchingConfig>) {
    this.db = database;
    this.config = {
      exactMatchOnly: false,
      caseInsensitive: true,
      allowPartialMatches: true,
      minimumConfidence: 0.7,
      supportedDesignationPatterns: Object.keys(this.DESIGNATION_PATTERNS),
      ...config
    };
  }

  /**
   * Parse and validate a reference designation
   */
  parseReferenceDesignation(designation: string): {
    isValid: boolean;
    componentType?: string;
    number?: number;
    suffix?: string;
    normalizedDesignation?: string;
    confidence: number;
  } {
    const trimmed = designation.trim();
    
    if (!trimmed) {
      return { isValid: false, confidence: 0 };
    }

    const normalized = this.config.caseInsensitive ? trimmed.toUpperCase() : trimmed;

    // Try to match against known patterns
    for (const [componentType, pattern] of Object.entries(this.DESIGNATION_PATTERNS)) {
      const match = normalized.match(pattern);
      
      if (match) {
        // For patterns like /^C(\d+)([A-Z]?)$/i, number is in match[1], suffix in match[2]
        // For patterns like /^(IC|U)(\d+)([A-Z]?)$/i, number is in match[2], suffix in match[3]
        let number: number;
        let suffix: string;
        
        if (match[1] && /^\d+$/.test(match[1])) {
          // Pattern: /^C(\d+)([A-Z]?)$/i - number in match[1]
          number = parseInt(match[1], 10);
          suffix = match[2] || '';
        } else if (match[2] && /^\d+$/.test(match[2])) {
          // Pattern: /^(IC|U)(\d+)([A-Z]?)$/i - number in match[2]
          number = parseInt(match[2], 10);
          suffix = match[3] || '';
        } else {
          // Fallback: try to find number in any capture group
          number = parseInt(match.find(m => m && /^\d+$/.test(m)) || '0', 10);
          suffix = match[match.length - 1] || '';
        }
        
        return {
          isValid: true,
          componentType,
          number,
          suffix,
          normalizedDesignation: normalized,
          confidence: 0.95
        };
      }
    }

    // Try fallback patterns for unknown designations
    const fallbackPattern = /^([A-Z]+)(\d+)([A-Z]?)$/i;
    const fallbackMatch = normalized.match(fallbackPattern);
    
    if (fallbackMatch) {
      const number = parseInt(fallbackMatch[2], 10);
      const suffix = fallbackMatch[3] || '';
      
      return {
        isValid: true,
        componentType: 'unknown',
        number,
        suffix,
        normalizedDesignation: normalized,
        confidence: 0.6
      };
    }

    return { isValid: false, confidence: 0 };
  }

  /**
   * Find matching reference designations across pages
   */
  async findMatchingDesignations(
    designation: string,
    documentId: string,
    excludePageNumber?: number
  ): Promise<ReferenceDesignationMatch[]> {
    const client = await this.db.connect();
    
    try {
      const parsedRef = this.parseReferenceDesignation(designation);
      
      if (!parsedRef.isValid || parsedRef.confidence < this.config.minimumConfidence) {
        return [];
      }

      let query = `
        SELECT cr.component_id, cr.reference_designation, cr.page_number, cr.document_id,
               ds.location_x, ds.location_y, ds.confidence, ds.symbol_type
        FROM electrical_analysis.component_references cr
        JOIN electrical_analysis.detected_symbols ds ON cr.component_id = ds.id
        WHERE cr.document_id = $1
      `;
      
      const params: any[] = [documentId];
      let paramIndex = 2;

      if (this.config.exactMatchOnly) {
        query += ` AND cr.reference_designation = $${paramIndex}`;
        params.push(parsedRef.normalizedDesignation);
      } else {
        query += ` AND cr.reference_designation ILIKE $${paramIndex}`;
        params.push(`%${parsedRef.normalizedDesignation}%`);
      }
      paramIndex++;

      if (excludePageNumber !== undefined) {
        query += ` AND cr.page_number != $${paramIndex}`;
        params.push(excludePageNumber);
        paramIndex++;
      }

      query += ` ORDER BY cr.page_number, cr.reference_designation`;

      const result = await client.query(query, params);

      return result.rows.map(row => ({
        designation: row.reference_designation,
        componentId: row.component_id,
        pageNumber: row.page_number,
        documentId: row.document_id,
        confidence: Math.min(parseFloat(row.confidence), parsedRef.confidence),
        location: {
          x: parseFloat(row.location_x),
          y: parseFloat(row.location_y)
        }
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new CrossPageReferenceError(
        `Failed to find matching designations: ${errorMessage}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { designation, documentId, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Validate reference designation consistency
   */
  async validateReferenceConsistency(
    documentId: string
  ): Promise<ReferenceValidationResult[]> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT cr.reference_designation, cr.component_id, cr.page_number,
               ds.symbol_type, ds.symbol_category, ds.confidence
        FROM electrical_analysis.component_references cr
        JOIN electrical_analysis.detected_symbols ds ON cr.component_id = ds.id
        WHERE cr.document_id = $1
        ORDER BY cr.reference_designation, cr.page_number
      `;

      const result = await client.query(query, [documentId]);
      const references = result.rows;

      const validationResults: ReferenceValidationResult[] = [];
      const designationGroups = new Map<string, any[]>();

      // Group references by designation
      for (const ref of references) {
        if (!designationGroups.has(ref.reference_designation)) {
          designationGroups.set(ref.reference_designation, []);
        }
        designationGroups.get(ref.reference_designation)!.push(ref);
      }

      // Validate each group
      for (const [designation, refs] of designationGroups) {
        const parsedRef = this.parseReferenceDesignation(designation);
        const validationErrors: string[] = [];
        const suggestions: string[] = [];

        // Check if designation is valid
        if (!parsedRef.isValid) {
          validationErrors.push(`Invalid designation format: ${designation}`);
          suggestions.push('Use standard electrical component designation format (e.g., R1, C2, IC3)');
        }

        // Check for consistency across instances
        if (refs.length > 1) {
          const symbolTypes = new Set(refs.map(r => r.symbol_type));
          const symbolCategories = new Set(refs.map(r => r.symbol_category));
          
          if (symbolTypes.size > 1) {
            validationErrors.push(`Inconsistent symbol types for ${designation}: ${Array.from(symbolTypes).join(', ')}`);
            suggestions.push('Ensure all instances of the same designation use the same symbol type');
          }
          
          if (symbolCategories.size > 1) {
            validationErrors.push(`Inconsistent symbol categories for ${designation}: ${Array.from(symbolCategories).join(', ')}`);
            suggestions.push('Ensure all instances of the same designation use the same symbol category');
          }
        }

        // Calculate confidence score
        const avgConfidence = refs.reduce((sum, r) => sum + parseFloat(r.confidence), 0) / refs.length;
        const confidenceScore = Math.min(avgConfidence, parsedRef.confidence);

        validationResults.push({
          isValid: validationErrors.length === 0,
          validationErrors,
          suggestions,
          confidenceScore
        });
      }

      return validationResults;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new CrossPageReferenceError(
        `Failed to validate reference consistency: ${errorMessage}`,
        CrossPageReferenceErrorCodes.VALIDATION_FAILED,
        { documentId, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Detect and resolve reference conflicts
   */
  async detectReferenceConflicts(
    documentId: string
  ): Promise<ReferenceConflictResolution[]> {
    const client = await this.db.connect();
    
    try {
      const conflicts: ReferenceConflictResolution[] = [];

      // Check for duplicate designations with different component types
      const duplicateQuery = `
        SELECT cr.reference_designation, 
               array_agg(DISTINCT ds.symbol_type) as symbol_types,
               array_agg(DISTINCT ds.symbol_category) as symbol_categories,
               array_agg(cr.component_id) as component_ids,
               count(*) as count
        FROM electrical_analysis.component_references cr
        JOIN electrical_analysis.detected_symbols ds ON cr.component_id = ds.id
        WHERE cr.document_id = $1
        GROUP BY cr.reference_designation
        HAVING count(*) > 1 AND count(DISTINCT ds.symbol_type) > 1
      `;

      const duplicateResult = await client.query(duplicateQuery, [documentId]);
      
      for (const row of duplicateResult.rows) {
        conflicts.push({
          conflictType: 'duplicate_designation',
          conflictDescription: `Reference designation ${row.reference_designation} used for different component types: ${row.symbol_types.join(', ')}`,
          affectedReferences: row.component_ids,
          resolution: 'user_input_required',
          resolutionData: {
            designation: row.reference_designation,
            symbolTypes: row.symbol_types,
            symbolCategories: row.symbol_categories,
            suggestedAction: 'Rename one of the components with a unique designation'
          }
        });
      }

      // Check for missing target references in cross-page links
      const missingTargetQuery = `
        SELECT cpr.id, cpr.reference_designation, cpr.source_component_id, 
               cpr.target_page_number, cpr.target_document_id
        FROM electrical_analysis.cross_page_references cpr
        LEFT JOIN electrical_analysis.component_references cr 
          ON cpr.reference_designation = cr.reference_designation 
          AND cpr.target_page_number = cr.page_number
          AND cpr.target_document_id = cr.document_id
        WHERE cpr.source_document_id = $1 AND cr.id IS NULL
      `;

      const missingTargetResult = await client.query(missingTargetQuery, [documentId]);
      
      for (const row of missingTargetResult.rows) {
        conflicts.push({
          conflictType: 'missing_target',
          conflictDescription: `Cross-page reference ${row.reference_designation} points to page ${row.target_page_number} but no matching component found`,
          affectedReferences: [row.id],
          resolution: 'auto_resolve',
          resolutionData: {
            action: 'remove_orphaned_reference',
            referenceId: row.id
          }
        });
      }

      // Check for circular references
      const circularQuery = `
        WITH RECURSIVE circular_refs AS (
          SELECT cpr1.id, cpr1.source_component_id, cpr1.target_component_id, 
                 cpr1.reference_designation, 1 as depth,
                 ARRAY[cpr1.source_component_id] as path
          FROM electrical_analysis.cross_page_references cpr1
          WHERE source_document_id = $1
          
          UNION ALL
          
          SELECT cpr2.id, cpr2.source_component_id, cpr2.target_component_id,
                 cpr2.reference_designation, cr.depth + 1,
                 cr.path || cpr2.source_component_id
          FROM electrical_analysis.cross_page_references cpr2
          JOIN circular_refs cr ON cpr2.source_component_id = cr.target_component_id
          WHERE cr.depth < 10 AND NOT (cpr2.source_component_id = ANY(cr.path))
        )
        SELECT * FROM circular_refs 
        WHERE target_component_id = ANY(path) AND depth > 1
      `;

      const circularResult = await client.query(circularQuery, [documentId]);
      
      for (const row of circularResult.rows) {
        conflicts.push({
          conflictType: 'circular_reference',
          conflictDescription: `Circular reference detected in designation ${row.reference_designation}`,
          affectedReferences: [row.id],
          resolution: 'user_input_required',
          resolutionData: {
            path: row.path,
            depth: row.depth
          }
        });
      }

      return conflicts;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new CrossPageReferenceError(
        `Failed to detect reference conflicts: ${errorMessage}`,
        CrossPageReferenceErrorCodes.CONFLICT_RESOLUTION_FAILED,
        { documentId, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Generate suggested reference designations
   */
  generateSuggestedDesignation(
    componentType: string,
    existingDesignations: string[],
    pageNumber?: number
  ): string[] {
    const suggestions: string[] = [];
    const componentTypeMap: Record<string, string> = {
      'resistor': 'R',
      'capacitor': 'C',
      'inductor': 'L',
      'diode': 'D',
      'transistor': 'Q',
      'ic': 'U',
      'op_amp': 'OP',
      'transformer': 'T',
      'connector': 'J',
      'switch': 'S',
      'relay': 'K',
      'fuse': 'F',
      'test_point': 'TP',
      'crystal': 'X',
      'battery': 'BT'
    };

    const prefix = componentTypeMap[componentType.toLowerCase()] || 'U';
    const existingNumbers = new Set<number>();

    // Extract existing numbers for this component type
    for (const designation of existingDesignations) {
      const parsed = this.parseReferenceDesignation(designation);
      if (parsed.isValid && designation.startsWith(prefix)) {
        if (parsed.number) {
          existingNumbers.add(parsed.number);
        }
      }
    }

    // Generate suggestions
    let nextNumber = 1;
    for (let i = 0; i < 5; i++) {
      while (existingNumbers.has(nextNumber)) {
        nextNumber++;
      }
      
      suggestions.push(`${prefix}${nextNumber}`);
      
      // Add page-specific suggestion if page number provided
      if (pageNumber && pageNumber > 1) {
        suggestions.push(`${prefix}${pageNumber}${String.fromCharCode(65 + i)}`); // R2A, R2B, etc.
      }
      
      nextNumber++;
    }

    return suggestions.slice(0, 3); // Return top 3 suggestions
  }

  /**
   * Update reference matcher configuration
   */
  updateConfig(newConfig: Partial<ReferenceMatchingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get supported designation patterns
   */
  getSupportedPatterns(): Record<string, RegExp> {
    return { ...this.DESIGNATION_PATTERNS };
  }
}