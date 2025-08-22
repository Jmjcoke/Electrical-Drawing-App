/**
 * Cross-Page Reference Repository
 * 
 * Data access layer for cross-page reference operations.
 * Handles database interactions for cross-page references, component references,
 * and related data operations.
 * 
 * Story: 4.4 Cross-Reference Engine
 * Task: 4.4.1 Build Cross-Page Reference Detection System
 */

import { Pool } from 'pg';
import { getErrorMessage } from '../utils/error-utils';
import {
  CrossPageReference,
  ComponentReference,
  CrossPageReferenceType,
  CrossPageReferenceError,
  CrossPageReferenceErrorCodes
} from '../../../../shared/types/cross-page-reference.types';

export class CrossPageReferenceRepository {
  private db: Pool;

  constructor(database: Pool) {
    this.db = database;
  }

  /**
   * Create a new cross-page reference
   */
  async createCrossPageReference(
    sourceComponentId: string,
    targetComponentId: string | undefined,
    referenceDesignation: string,
    sourcePageNumber: number,
    targetPageNumber: number,
    sourceDocumentId: string,
    targetDocumentId: string | undefined,
    referenceType: CrossPageReferenceType,
    continuationSymbol?: string,
    confidence?: number
  ): Promise<CrossPageReference> {
    const client = await this.db.connect();
    
    try {
      const query = `
        INSERT INTO electrical_analysis.cross_page_references
        (source_component_id, target_component_id, reference_designation,
         source_page_number, target_page_number, source_document_id, target_document_id,
         reference_type, continuation_symbol, confidence)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, source_component_id, target_component_id, reference_designation,
                  source_page_number, target_page_number, source_document_id, target_document_id,
                  reference_type, continuation_symbol, confidence, created_at
      `;

      const result = await client.query(query, [
        sourceComponentId,
        targetComponentId,
        referenceDesignation,
        sourcePageNumber,
        targetPageNumber,
        sourceDocumentId,
        targetDocumentId,
        referenceType,
        continuationSymbol,
        confidence || 0.8
      ]);

      return this.mapRowToCrossPageReference(result.rows[0]);

    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new CrossPageReferenceError(
          'Cross-page reference already exists',
          CrossPageReferenceErrorCodes.DATABASE_ERROR
        );
      }
      
      throw new CrossPageReferenceError(
        `Failed to create cross-page reference: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { sourceComponentId, targetComponentId, referenceDesignation, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get cross-page reference by ID
   */
  async getCrossPageReferenceById(id: string): Promise<CrossPageReference | null> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT id, source_component_id, target_component_id, reference_designation,
               source_page_number, target_page_number, source_document_id, target_document_id,
               reference_type, continuation_symbol, confidence, created_at
        FROM electrical_analysis.cross_page_references
        WHERE id = $1
      `;

      const result = await client.query(query, [id]);
      
      return result.rows.length > 0 ? this.mapRowToCrossPageReference(result.rows[0]) : null;

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to get cross-page reference: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { id, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get all cross-page references for a document
   */
  async getCrossPageReferencesByDocument(
    documentId: string,
    pageNumbers?: number[]
  ): Promise<CrossPageReference[]> {
    const client = await this.db.connect();
    
    try {
      let query = `
        SELECT id, source_component_id, target_component_id, reference_designation,
               source_page_number, target_page_number, source_document_id, target_document_id,
               reference_type, continuation_symbol, confidence, created_at
        FROM electrical_analysis.cross_page_references
        WHERE source_document_id = $1
      `;
      
      const params: any[] = [documentId];
      
      if (pageNumbers && pageNumbers.length > 0) {
        query += ` AND (source_page_number = ANY($2) OR target_page_number = ANY($2))`;
        params.push(pageNumbers);
      }
      
      query += ` ORDER BY reference_designation, source_page_number`;

      const result = await client.query(query, params);
      
      return result.rows.map(row => this.mapRowToCrossPageReference(row));

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to get cross-page references by document: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { documentId, pageNumbers, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get cross-page references by designation
   */
  async getCrossPageReferencesByDesignation(
    designation: string,
    documentId?: string
  ): Promise<CrossPageReference[]> {
    const client = await this.db.connect();
    
    try {
      let query = `
        SELECT id, source_component_id, target_component_id, reference_designation,
               source_page_number, target_page_number, source_document_id, target_document_id,
               reference_type, continuation_symbol, confidence, created_at
        FROM electrical_analysis.cross_page_references
        WHERE reference_designation = $1
      `;
      
      const params: any[] = [designation];
      
      if (documentId) {
        query += ` AND source_document_id = $2`;
        params.push(documentId);
      }
      
      query += ` ORDER BY source_page_number`;

      const result = await client.query(query, params);
      
      return result.rows.map(row => this.mapRowToCrossPageReference(row));

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to get cross-page references by designation: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { designation, documentId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Create a component reference
   */
  async createComponentReference(
    componentId: string,
    referenceDesignation: string,
    pageNumber: number,
    documentId: string,
    componentType?: string,
    isMainReference: boolean = false,
    relatedReferences: string[] = []
  ): Promise<ComponentReference> {
    const client = await this.db.connect();
    
    try {
      const query = `
        INSERT INTO electrical_analysis.component_references
        (component_id, reference_designation, page_number, document_id,
         component_type, is_main_reference, related_references)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, component_id, reference_designation, page_number, document_id,
                  component_type, is_main_reference, related_references, created_at
      `;

      const result = await client.query(query, [
        componentId,
        referenceDesignation,
        pageNumber,
        documentId,
        componentType,
        isMainReference,
        relatedReferences
      ]);

      return this.mapRowToComponentReference(result.rows[0]);

    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new CrossPageReferenceError(
          'Component reference already exists',
          CrossPageReferenceErrorCodes.DATABASE_ERROR
        );
      }
      
      throw new CrossPageReferenceError(
        `Failed to create component reference: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { componentId, referenceDesignation, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get component references by designation
   */
  async getComponentReferencesByDesignation(
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
      
      return result.rows.map(row => this.mapRowToComponentReference(row));

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to get component references by designation: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { designation, documentId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get component references for a document
   */
  async getComponentReferencesByDocument(
    documentId: string,
    pageNumbers?: number[]
  ): Promise<ComponentReference[]> {
    const client = await this.db.connect();
    
    try {
      let query = `
        SELECT id, component_id, reference_designation, page_number, document_id,
               component_type, is_main_reference, related_references, created_at
        FROM electrical_analysis.component_references
        WHERE document_id = $1
      `;
      
      const params: any[] = [documentId];
      
      if (pageNumbers && pageNumbers.length > 0) {
        query += ` AND page_number = ANY($2)`;
        params.push(pageNumbers);
      }
      
      query += ` ORDER BY page_number, reference_designation`;

      const result = await client.query(query, params);
      
      return result.rows.map(row => this.mapRowToComponentReference(row));

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to get component references by document: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { documentId, pageNumbers, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update component reference related references
   */
  async updateComponentReferenceRelatedReferences(
    componentId: string,
    relatedReferences: string[]
  ): Promise<boolean> {
    const client = await this.db.connect();
    
    try {
      const query = `
        UPDATE electrical_analysis.component_references
        SET related_references = $2
        WHERE component_id = $1
      `;

      const result = await client.query(query, [componentId, relatedReferences]);
      
      return result.rowCount > 0;

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to update component reference related references: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { componentId, relatedReferences, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Delete cross-page reference
   */
  async deleteCrossPageReference(id: string): Promise<boolean> {
    const client = await this.db.connect();
    
    try {
      const query = `
        DELETE FROM electrical_analysis.cross_page_references
        WHERE id = $1
      `;

      const result = await client.query(query, [id]);
      
      return result.rowCount > 0;

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to delete cross-page reference: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { id, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Delete component reference
   */
  async deleteComponentReference(componentId: string): Promise<boolean> {
    const client = await this.db.connect();
    
    try {
      const query = `
        DELETE FROM electrical_analysis.component_references
        WHERE component_id = $1
      `;

      const result = await client.query(query, [componentId]);
      
      return result.rowCount > 0;

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to delete component reference: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { componentId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get cross-page reference statistics
   */
  async getCrossPageReferenceStats(documentId?: string): Promise<{
    totalReferences: number;
    byReferenceType: Record<CrossPageReferenceType, number>;
    byPagePairs: Record<string, number>;
    averageConfidence: number;
    uniqueDesignations: number;
  }> {
    const client = await this.db.connect();
    
    try {
      let whereClause = '';
      const params: any[] = [];
      
      if (documentId) {
        whereClause = 'WHERE source_document_id = $1';
        params.push(documentId);
      }

      const query = `
        SELECT reference_type, source_page_number, target_page_number,
               reference_designation, confidence, COUNT(*) as count
        FROM electrical_analysis.cross_page_references
        ${whereClause}
        GROUP BY reference_type, source_page_number, target_page_number,
                 reference_designation, confidence
      `;

      const result = await client.query(query, params);
      
      const stats = {
        totalReferences: 0,
        byReferenceType: {} as Record<CrossPageReferenceType, number>,
        byPagePairs: {} as Record<string, number>,
        averageConfidence: 0,
        uniqueDesignations: 0
      };

      const designations = new Set<string>();
      let totalConfidence = 0;

      for (const row of result.rows) {
        const count = parseInt(row.count);
        stats.totalReferences += count;
        
        const refType = row.reference_type as CrossPageReferenceType;
        stats.byReferenceType[refType] = (stats.byReferenceType[refType] || 0) + count;
        
        const pagePair = `${row.source_page_number}-${row.target_page_number}`;
        stats.byPagePairs[pagePair] = (stats.byPagePairs[pagePair] || 0) + count;
        
        designations.add(row.reference_designation);
        totalConfidence += parseFloat(row.confidence) * count;
      }

      stats.uniqueDesignations = designations.size;
      stats.averageConfidence = stats.totalReferences > 0 
        ? totalConfidence / stats.totalReferences 
        : 0;

      return stats;

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to get cross-page reference statistics: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { documentId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Clean up orphaned references
   */
  async cleanupOrphanedReferences(documentId?: string): Promise<number> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Use the stored procedure if documentId is not provided
      if (!documentId) {
        const result = await client.query('SELECT cleanup_orphaned_references()');
        await client.query('COMMIT');
        return result.rows[0].cleanup_orphaned_references;
      }

      // Manual cleanup for specific document
      let deletedCount = 0;

      // Clean up component_references where the referenced component no longer exists
      const componentRefsQuery = `
        DELETE FROM electrical_analysis.component_references cr
        WHERE cr.document_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM electrical_analysis.detected_symbols ds 
          WHERE ds.id = cr.component_id
        )
      `;
      
      const componentResult = await client.query(componentRefsQuery, [documentId]);
      deletedCount += componentResult.rowCount;

      // Clean up cross_page_references where source or target components no longer exist
      const crossRefsQuery = `
        DELETE FROM electrical_analysis.cross_page_references cpr
        WHERE cpr.source_document_id = $1
        AND (
          NOT EXISTS (
            SELECT 1 FROM electrical_analysis.detected_symbols ds 
            WHERE ds.id = cpr.source_component_id
          ) OR (
            cpr.target_component_id IS NOT NULL AND NOT EXISTS (
              SELECT 1 FROM electrical_analysis.detected_symbols ds 
              WHERE ds.id = cpr.target_component_id
            )
          )
        )
      `;
      
      const crossResult = await client.query(crossRefsQuery, [documentId]);
      deletedCount += crossResult.rowCount;

      await client.query('COMMIT');
      return deletedCount;

    } catch (error) {
      await client.query('ROLLBACK');
      throw new CrossPageReferenceError(
        `Failed to cleanup orphaned references: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { documentId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to CrossPageReference
   */
  private mapRowToCrossPageReference(row: any): CrossPageReference {
    return {
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
      confidence: parseFloat(row.confidence),
      createdAt: row.created_at
    };
  }

  /**
   * Map database row to ComponentReference
   */
  private mapRowToComponentReference(row: any): ComponentReference {
    return {
      componentId: row.component_id,
      referenceDesignation: row.reference_designation,
      pageNumber: row.page_number,
      documentId: row.document_id,
      componentType: row.component_type || '',
      isMainReference: row.is_main_reference,
      relatedReferences: row.related_references || []
    };
  }

  /**
   * Get cross-page references by session for export
   */
  async getReferencesBySession(sessionId: string, documentIds?: string[]): Promise<CrossPageReference[]> {
    try {
      let query = `
        SELECT cpr.*
        FROM electrical_analysis.cross_page_references cpr
        JOIN electrical_analysis.detected_symbols ds ON cpr.source_component_id = ds.id
        JOIN electrical_analysis.symbol_detection_results sdr ON ds.detection_result_id = sdr.id
        WHERE sdr.session_id = $1
      `;

      const params: any[] = [sessionId];

      if (documentIds && documentIds.length > 0) {
        query += ` AND cpr.source_document_id = ANY($2)`;
        params.push(documentIds);
      }

      query += ` ORDER BY cpr.source_page_number, cpr.target_page_number`;

      const result = await this.db.query(query, params);

      return result.rows.map(row => this.mapRowToCrossPageReference(row));
    } catch (error) {
      throw new CrossPageReferenceError(
        'Failed to get references by session',
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { originalError: error, sessionId }
      );
    }
  }
}