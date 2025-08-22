/**
 * Multi-Document Reference Repository
 * 
 * Data access layer for multi-document reference operations.
 * Handles database interactions for document relationships, project-level references,
 * integrity checking, and cross-document navigation.
 * 
 * Story: 4.4 Cross-Reference Engine
 * Task: 4.4.3 Build Multi-Document Reference System
 */

import { Pool } from 'pg';
import { getErrorMessage } from '../utils/error-utils';
import {
  DocumentRelationship,
  DocumentRelationshipType,
  ProjectCrossReferenceMap,
  ReferenceIntegrityCheck,
  ReferenceIntegrityStatus,
  GlobalComponentRegistry,
  CrossDocumentNavigationLink,
  CrossPageReferenceError,
  CrossPageReferenceErrorCodes
} from '../../../../shared/types/cross-page-reference.types';

export class MultiDocumentReferenceRepository {
  private db: Pool;

  constructor(database: Pool) {
    this.db = database;
  }

  /**
   * Create document relationship
   */
  async createDocumentRelationship(
    projectId: string,
    sourceDocumentId: string,
    targetDocumentId: string,
    relationshipType: DocumentRelationshipType,
    relationshipStrength: number = 0.8
  ): Promise<DocumentRelationship> {
    const client = await this.db.connect();
    
    try {
      const query = `
        INSERT INTO electrical_analysis.document_relationships
        (project_id, source_document_id, target_document_id, relationship_type, relationship_strength)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (project_id, source_document_id, target_document_id, relationship_type)
        DO UPDATE SET relationship_strength = $5, last_updated = NOW()
        RETURNING id, project_id, source_document_id, target_document_id,
                  relationship_type, relationship_strength, reference_count,
                  last_updated, created_at
      `;

      const result = await client.query(query, [
        projectId,
        sourceDocumentId,
        targetDocumentId,
        relationshipType,
        relationshipStrength
      ]);

      return this.mapRowToDocumentRelationship(result.rows[0]);

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to create document relationship: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { projectId, sourceDocumentId, targetDocumentId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get document relationships for project
   */
  async getDocumentRelationshipsByProject(projectId: string): Promise<DocumentRelationship[]> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT id, project_id, source_document_id, target_document_id,
               relationship_type, relationship_strength, reference_count,
               last_updated, created_at
        FROM electrical_analysis.document_relationships
        WHERE project_id = $1
        ORDER BY relationship_strength DESC, reference_count DESC
      `;

      const result = await client.query(query, [projectId]);
      
      return result.rows.map(row => this.mapRowToDocumentRelationship(row));

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to get document relationships: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { projectId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Create or update project cross-reference map
   */
  async createOrUpdateProjectCrossReferenceMap(
    projectId: string,
    projectName?: string,
    totalDocuments?: number
  ): Promise<ProjectCrossReferenceMap> {
    const client = await this.db.connect();
    
    try {
      // Get total documents count if not provided
      const documentCount = totalDocuments ?? await this.getDocumentCountForProject(projectId, client);

      const query = `
        INSERT INTO electrical_analysis.project_cross_reference_maps
        (project_id, project_name, total_documents, integration_status)
        VALUES ($1, $2, $3, 'pending')
        ON CONFLICT (project_id)
        DO UPDATE SET 
          project_name = COALESCE($2, project_cross_reference_maps.project_name),
          total_documents = $3,
          integration_status = 'pending',
          updated_at = NOW()
        RETURNING id, project_id, project_name, total_documents, total_cross_references,
                  integration_status, last_analysis_at, error_message, created_at, updated_at
      `;

      const result = await client.query(query, [projectId, projectName, documentCount]);
      
      return this.mapRowToProjectCrossReferenceMap(result.rows[0]);

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to create/update project cross-reference map: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { projectId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get project cross-reference map
   */
  async getProjectCrossReferenceMap(projectId: string): Promise<ProjectCrossReferenceMap | null> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT id, project_id, project_name, total_documents, total_cross_references,
               integration_status, last_analysis_at, error_message, created_at, updated_at
        FROM electrical_analysis.project_cross_reference_maps
        WHERE project_id = $1
      `;

      const result = await client.query(query, [projectId]);
      
      return result.rows.length > 0 
        ? this.mapRowToProjectCrossReferenceMap(result.rows[0])
        : null;

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to get project cross-reference map: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { projectId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update project integration status
   */
  async updateProjectIntegrationStatus(
    projectId: string,
    status: 'pending' | 'processing' | 'completed' | 'error',
    errorMessage?: string
  ): Promise<void> {
    const client = await this.db.connect();
    
    try {
      const query = `
        UPDATE electrical_analysis.project_cross_reference_maps
        SET integration_status = $2,
            error_message = $3,
            last_analysis_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE last_analysis_at END,
            updated_at = NOW()
        WHERE project_id = $1
      `;

      await client.query(query, [projectId, status, errorMessage]);

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to update project integration status: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { projectId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Create reference integrity check
   */
  async createReferenceIntegrityCheck(
    projectId: string,
    documentId: string,
    referenceDesignation: string,
    integrityStatus: ReferenceIntegrityStatus,
    affectedDocuments: string[] = []
  ): Promise<ReferenceIntegrityCheck> {
    const client = await this.db.connect();
    
    try {
      const query = `
        INSERT INTO electrical_analysis.reference_integrity_checks
        (project_id, document_id, reference_designation, integrity_status, affected_documents)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, project_id, document_id, reference_designation, integrity_status,
                  affected_documents, last_checked_at, resolution_status, resolution_notes, created_at
      `;

      const result = await client.query(query, [
        projectId,
        documentId,
        referenceDesignation,
        integrityStatus,
        affectedDocuments
      ]);

      return this.mapRowToReferenceIntegrityCheck(result.rows[0]);

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to create reference integrity check: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { projectId, documentId, referenceDesignation, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get reference integrity checks for project
   */
  async getReferenceIntegrityChecksByProject(
    projectId: string,
    unresolvedOnly: boolean = false
  ): Promise<ReferenceIntegrityCheck[]> {
    const client = await this.db.connect();
    
    try {
      let query = `
        SELECT id, project_id, document_id, reference_designation, integrity_status,
               affected_documents, last_checked_at, resolution_status, resolution_notes, created_at
        FROM electrical_analysis.reference_integrity_checks
        WHERE project_id = $1
      `;
      
      const params: any[] = [projectId];
      
      if (unresolvedOnly) {
        query += ` AND resolution_status = 'unresolved'`;
      }
      
      query += ` ORDER BY integrity_status, created_at DESC`;

      const result = await client.query(query, params);
      
      return result.rows.map(row => this.mapRowToReferenceIntegrityCheck(row));

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to get reference integrity checks: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { projectId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Run reference integrity analysis using stored procedure
   */
  async runReferenceIntegrityAnalysis(projectId: string): Promise<{
    designation: string;
    status: ReferenceIntegrityStatus;
    affectedDocs: string[];
    issueCount: number;
  }[]> {
    const client = await this.db.connect();
    
    try {
      const query = `SELECT * FROM check_reference_integrity($1)`;
      const result = await client.query(query, [projectId]);
      
      return result.rows.map(row => ({
        designation: row.designation,
        status: row.status as ReferenceIntegrityStatus,
        affectedDocs: row.affected_docs || [],
        issueCount: row.issue_count
      }));

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to run reference integrity analysis: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { projectId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get global component registry for project
   */
  async getGlobalComponentRegistryByProject(projectId: string): Promise<GlobalComponentRegistry[]> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT id, project_id, reference_designation, component_type,
               primary_document_id, primary_page_number, occurrence_count,
               related_documents, specifications, last_updated, created_at
        FROM electrical_analysis.global_component_registry
        WHERE project_id = $1
        ORDER BY reference_designation
      `;

      const result = await client.query(query, [projectId]);
      
      return result.rows.map(row => this.mapRowToGlobalComponentRegistry(row));

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to get global component registry: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { projectId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Create cross-document navigation link
   */
  async createCrossDocumentNavigationLink(
    crossReferenceId: string,
    sourceDocumentId: string,
    targetDocumentId: string,
    sourceCoordinates: { x: number; y: number },
    navigationLabel: string,
    targetCoordinates?: { x: number; y: number },
    linkType: 'reference' | 'detail' | 'continuation' | 'assembly' = 'reference'
  ): Promise<CrossDocumentNavigationLink> {
    const client = await this.db.connect();
    
    try {
      const query = `
        INSERT INTO electrical_analysis.cross_document_navigation_links
        (cross_reference_id, source_document_id, target_document_id,
         source_coordinates, target_coordinates, navigation_label, link_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, cross_reference_id, source_document_id, target_document_id,
                  source_coordinates, target_coordinates, navigation_label, link_type,
                  is_active, created_at
      `;

      const result = await client.query(query, [
        crossReferenceId,
        sourceDocumentId,
        targetDocumentId,
        JSON.stringify(sourceCoordinates),
        targetCoordinates ? JSON.stringify(targetCoordinates) : null,
        navigationLabel,
        linkType
      ]);

      return this.mapRowToCrossDocumentNavigationLink(result.rows[0]);

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to create cross-document navigation link: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { crossReferenceId, sourceDocumentId, targetDocumentId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get cross-document navigation links for project
   */
  async getCrossDocumentNavigationLinksByProject(
    projectId: string,
    activeOnly: boolean = true
  ): Promise<CrossDocumentNavigationLink[]> {
    const client = await this.db.connect();
    
    try {
      let query = `
        SELECT cdnl.id, cdnl.cross_reference_id, cdnl.source_document_id, cdnl.target_document_id,
               cdnl.source_coordinates, cdnl.target_coordinates, cdnl.navigation_label, cdnl.link_type,
               cdnl.is_active, cdnl.created_at
        FROM electrical_analysis.cross_document_navigation_links cdnl
        JOIN electrical_analysis.documents d ON d.id = cdnl.source_document_id
        WHERE d.project_id = $1
      `;
      
      const params: any[] = [projectId];
      
      if (activeOnly) {
        query += ` AND cdnl.is_active = true`;
      }
      
      query += ` ORDER BY cdnl.created_at DESC`;

      const result = await client.query(query, params);
      
      return result.rows.map(row => this.mapRowToCrossDocumentNavigationLink(row));

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to get cross-document navigation links: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { projectId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Clean up multi-document references for project
   */
  async cleanupMultiDocumentReferences(projectId: string): Promise<number> {
    const client = await this.db.connect();
    
    try {
      const query = `SELECT cleanup_multi_document_references($1)`;
      const result = await client.query(query, [projectId]);
      
      return result.rows[0].cleanup_multi_document_references;

    } catch (error) {
      throw new CrossPageReferenceError(
        `Failed to cleanup multi-document references: ${getErrorMessage(error)}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { projectId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get document count for project (helper)
   */
  private async getDocumentCountForProject(projectId: string, client: any): Promise<number> {
    const query = `SELECT COUNT(*) as count FROM electrical_analysis.documents WHERE project_id = $1`;
    const result = await client.query(query, [projectId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Map database row to DocumentRelationship
   */
  private mapRowToDocumentRelationship(row: any): DocumentRelationship {
    return {
      id: row.id,
      projectId: row.project_id,
      sourceDocumentId: row.source_document_id,
      targetDocumentId: row.target_document_id,
      relationshipType: row.relationship_type,
      relationshipStrength: parseFloat(row.relationship_strength),
      referenceCount: row.reference_count,
      lastUpdated: row.last_updated,
      createdAt: row.created_at
    };
  }

  /**
   * Map database row to ProjectCrossReferenceMap
   */
  private mapRowToProjectCrossReferenceMap(row: any): ProjectCrossReferenceMap {
    return {
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      totalDocuments: row.total_documents,
      totalCrossReferences: row.total_cross_references,
      integrationStatus: row.integration_status,
      lastAnalysisAt: row.last_analysis_at,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Map database row to ReferenceIntegrityCheck
   */
  private mapRowToReferenceIntegrityCheck(row: any): ReferenceIntegrityCheck {
    return {
      id: row.id,
      projectId: row.project_id,
      documentId: row.document_id,
      referenceDesignation: row.reference_designation,
      integrityStatus: row.integrity_status,
      affectedDocuments: row.affected_documents || [],
      lastCheckedAt: row.last_checked_at,
      resolutionStatus: row.resolution_status,
      resolutionNotes: row.resolution_notes,
      createdAt: row.created_at
    };
  }

  /**
   * Map database row to GlobalComponentRegistry
   */
  private mapRowToGlobalComponentRegistry(row: any): GlobalComponentRegistry {
    return {
      id: row.id,
      projectId: row.project_id,
      referenceDesignation: row.reference_designation,
      componentType: row.component_type,
      primaryDocumentId: row.primary_document_id,
      primaryPageNumber: row.primary_page_number,
      occurrenceCount: row.occurrence_count,
      relatedDocuments: row.related_documents || [],
      specifications: row.specifications || {},
      lastUpdated: row.last_updated,
      createdAt: row.created_at
    };
  }

  /**
   * Map database row to CrossDocumentNavigationLink
   */
  private mapRowToCrossDocumentNavigationLink(row: any): CrossDocumentNavigationLink {
    return {
      id: row.id,
      crossReferenceId: row.cross_reference_id,
      sourceDocumentId: row.source_document_id,
      targetDocumentId: row.target_document_id,
      sourceCoordinates: JSON.parse(row.source_coordinates),
      targetCoordinates: row.target_coordinates ? JSON.parse(row.target_coordinates) : undefined,
      navigationLabel: row.navigation_label,
      linkType: row.link_type,
      isActive: row.is_active,
      createdAt: row.created_at
    };
  }
}