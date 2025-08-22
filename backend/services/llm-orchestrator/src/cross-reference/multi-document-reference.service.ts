/**
 * Multi-Document Reference Service
 * 
 * Service for managing cross-document references, document relationships,
 * and reference integrity across multiple documents in a project.
 * 
 * Story: 4.4 Cross-Reference Engine
 * Task: 4.4.3 Build Multi-Document Reference System
 */

import { Pool } from 'pg';
import { CrossPageReferenceDetector } from './cross-page-detector';
import { ReferenceMatcherService } from './reference-matcher.service';
import { CrossPageReferenceRepository } from '../repositories/cross-page-reference.repository';
import { MultiDocumentReferenceRepository } from '../repositories/multi-document-reference.repository';
import {
  DocumentRelationship,
  DocumentRelationshipType,
  ProjectCrossReferenceMap,
  ReferenceIntegrityCheck,
  ReferenceIntegrityStatus,
  GlobalComponentRegistry,
  CrossDocumentNavigationLink,
  CrossPageReference,
  AnalyzeMultiDocumentReferencesRequest,
  AnalyzeMultiDocumentReferencesResponse,
  ValidateReferenceIntegrityRequest,
  ValidateReferenceIntegrityResponse,
  CrossPageReferenceError,
  CrossPageReferenceErrorCodes
} from '../../../../shared/types/cross-page-reference.types';

export class MultiDocumentReferenceService {
  private crossPageDetector: CrossPageReferenceDetector;
  private crossPageRepository: CrossPageReferenceRepository;
  private multiDocRepository: MultiDocumentReferenceRepository;

  constructor(database: Pool) {
    this.crossPageDetector = new CrossPageReferenceDetector(database);
    this.crossPageRepository = new CrossPageReferenceRepository(database);
    this.multiDocRepository = new MultiDocumentReferenceRepository(database);
  }

  /**
   * Analyze multi-document references for a project
   * Implements subtask: Extend cross-page system to work across multiple document files
   */
  async analyzeMultiDocumentReferences(
    request: AnalyzeMultiDocumentReferencesRequest
  ): Promise<AnalyzeMultiDocumentReferencesResponse> {
    const startTime = Date.now();

    try {
      // Initialize or update project cross-reference map
      await this.multiDocRepository.updateProjectIntegrationStatus(
        request.projectId,
        'processing'
      );

      // Analyze each document individually first
      const documentAnalysisResults = await Promise.all(
        request.documentIds.map(documentId =>
          this.analyzeDocumentForCrossReferences(
            request.sessionId,
            documentId,
            request.matchingConfig
          )
        )
      );

      // Detect cross-document relationships
      const documentRelationships = await this.detectDocumentRelationships(
        request.projectId,
        request.documentIds
      );

      // Build global component registry
      const globalComponents = await this.buildGlobalComponentRegistry(
        request.projectId,
        request.documentIds
      );

      // Create cross-document navigation links
      const crossDocumentNavigation = await this.createCrossDocumentNavigationLinks(
        request.projectId,
        documentRelationships,
        globalComponents
      );

      // Run integrity checks if requested
      let integrityChecks: ReferenceIntegrityCheck[] = [];
      if (request.checkIntegrity) {
        integrityChecks = await this.validateProjectReferenceIntegrity(
          request.projectId,
          request.documentIds
        );
      }

      // Update project integration status
      await this.multiDocRepository.updateProjectIntegrationStatus(
        request.projectId,
        'completed'
      );

      const processingTime = Date.now() - startTime;
      const totalReferences = documentAnalysisResults.reduce(
        (sum, result) => sum + result.crossPageLinks.length,
        0
      );

      return {
        success: true,
        projectId: request.projectId,
        documentRelationships,
        globalComponents,
        integrityChecks,
        crossDocumentNavigation,
        processingTime,
        totalReferences
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Update project status to error
      await this.multiDocRepository.updateProjectIntegrationStatus(
        request.projectId,
        'error',
        errorMessage
      );

      const processingTime = Date.now() - startTime;

      return {
        success: false,
        projectId: request.projectId,
        documentRelationships: [],
        globalComponents: [],
        integrityChecks: [],
        crossDocumentNavigation: [],
        processingTime,
        totalReferences: 0,
        error: errorMessage || 'Multi-document analysis failed'
      };
    }
  }

  /**
   * Detect relationships between documents
   * Implements subtask: Add document relationship management for project-level references
   */
  async detectDocumentRelationships(
    projectId: string,
    documentIds: string[]
  ): Promise<DocumentRelationship[]> {
    const relationships: DocumentRelationship[] = [];

    try {
      // Create or update project map
      await this.multiDocRepository.createOrUpdateProjectCrossReferenceMap(
        projectId,
        undefined,
        documentIds.length
      );

      // Analyze pairs of documents for relationships
      for (let i = 0; i < documentIds.length; i++) {
        for (let j = i + 1; j < documentIds.length; j++) {
          const sourceDocId = documentIds[i];
          const targetDocId = documentIds[j];

          // Get cross-page references between these documents
          const crossReferences = await this.getCrossDocumentReferences(
            sourceDocId,
            targetDocId
          );

          if (crossReferences.length > 0) {
            // Determine relationship type based on reference patterns
            const relationshipType = this.determineRelationshipType(crossReferences);
            const relationshipStrength = this.calculateRelationshipStrength(crossReferences);

            // Create document relationship
            const relationship = await this.multiDocRepository.createDocumentRelationship(
              projectId,
              sourceDocId,
              targetDocId,
              relationshipType,
              relationshipStrength
            );

            relationships.push(relationship);

            // Also create the reverse relationship if it makes sense
            if (this.shouldCreateReverseRelationship(relationshipType)) {
              const reverseType = this.getReverseRelationshipType(relationshipType);
              const reverseRelationship = await this.multiDocRepository.createDocumentRelationship(
                projectId,
                targetDocId,
                sourceDocId,
                reverseType,
                relationshipStrength
              );

              relationships.push(reverseRelationship);
            }
          }
        }
      }

      return relationships;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CrossPageReferenceError(
        `Failed to detect document relationships: ${errorMessage}`,
        CrossPageReferenceErrorCodes.MULTI_DOCUMENT_SYNC_FAILED,
        { projectId, documentIds, error: errorMessage }
      );
    }
  }

  /**
   * Build global component registry for project
   * Implements subtask: Create document-level reference tracking and storage
   */
  async buildGlobalComponentRegistry(
    projectId: string,
    documentIds: string[]
  ): Promise<GlobalComponentRegistry[]> {
    try {
      // The global component registry is automatically maintained by database triggers
      // when component_references are created. Here we just retrieve the results.
      return await this.multiDocRepository.getGlobalComponentRegistryByProject(projectId);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CrossPageReferenceError(
        `Failed to build global component registry: ${errorMessage}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { projectId, documentIds, error: errorMessage }
      );
    }
  }

  /**
   * Create cross-document navigation links
   * Implements subtask: Implement cross-document navigation and linking
   */
  async createCrossDocumentNavigationLinks(
    projectId: string,
    documentRelationships: DocumentRelationship[],
    _globalComponents: GlobalComponentRegistry[]
  ): Promise<CrossDocumentNavigationLink[]> {
    const navigationLinks: CrossDocumentNavigationLink[] = [];

    try {
      // Create navigation links for each document relationship
      for (const relationship of documentRelationships) {
        // Get cross-page references for this relationship
        const crossReferences = await this.getCrossDocumentReferences(
          relationship.sourceDocumentId,
          relationship.targetDocumentId
        );

        for (const crossRef of crossReferences) {
          // Get source component coordinates (mock for now - would come from symbol detection)
          const sourceCoordinates = await this.getComponentCoordinates(
            crossRef.sourceComponentId
          );

          // Get target component coordinates if available
          const targetCoordinates = crossRef.targetComponentId
            ? await this.getComponentCoordinates(crossRef.targetComponentId)
            : undefined;

          const navigationLabel = this.generateNavigationLabel(
            crossRef,
            relationship.relationshipType
          );

          const linkType = this.determineLinkType(relationship.relationshipType);

          const navigationLink = await this.multiDocRepository.createCrossDocumentNavigationLink(
            crossRef.id,
            relationship.sourceDocumentId,
            relationship.targetDocumentId,
            sourceCoordinates,
            navigationLabel,
            targetCoordinates,
            linkType
          );

          navigationLinks.push(navigationLink);
        }
      }

      return navigationLinks;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CrossPageReferenceError(
        `Failed to create cross-document navigation links: ${errorMessage}`,
        CrossPageReferenceErrorCodes.NAVIGATION_FAILED,
        { projectId, error: errorMessage }
      );
    }
  }

  /**
   * Validate reference integrity across documents
   * Implements subtask: Build reference integrity checking across document changes
   */
  async validateReferenceIntegrity(
    request: ValidateReferenceIntegrityRequest
  ): Promise<ValidateReferenceIntegrityResponse> {
    const startTime = Date.now();

    try {
      const _documentIds = request.documentIds || await this.getProjectDocumentIds(request.projectId);

      // Run integrity analysis using stored procedure
      const analysisResults = await this.multiDocRepository.runReferenceIntegrityAnalysis(
        request.projectId
      );

      // Create integrity check records
      const integrityChecks: ReferenceIntegrityCheck[] = [];
      let autoResolvedCount = 0;

      for (const result of analysisResults) {
        if (result.status !== 'valid') {
          // Find primary document for this designation
          const primaryDocumentId = await this.findPrimaryDocumentForDesignation(
            request.projectId,
            result.designation
          );

          // Create integrity check record
          const integrityCheck = await this.multiDocRepository.createReferenceIntegrityCheck(
            request.projectId,
            primaryDocumentId,
            result.designation,
            result.status,
            result.affectedDocs
          );

          integrityChecks.push(integrityCheck);

          // Attempt auto-resolution if requested
          if (request.autoResolve && this.canAutoResolve(result.status)) {
            const resolved = await this.autoResolveIntegrityIssue(
              integrityCheck,
              request.projectId
            );
            if (resolved) {
              autoResolvedCount++;
            }
          }
        }
      }

      // Generate recommendations
      const recommendedActions = this.generateIntegrityRecommendations(integrityChecks);

      const processingTime = Date.now() - startTime;
      const summary = {
        totalChecked: analysisResults.length,
        validCount: analysisResults.filter(r => r.status === 'valid').length,
        issueCount: integrityChecks.length,
        autoResolvedCount
      };

      return {
        success: true,
        projectId: request.projectId,
        integrityChecks,
        summary,
        recommendedActions,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      return {
        success: false,
        projectId: request.projectId,
        integrityChecks: [],
        summary: {
          totalChecked: 0,
          validCount: 0,
          issueCount: 0,
          autoResolvedCount: 0
        },
        recommendedActions: [],
        processingTime,
        error: error instanceof Error ? error.message : 'Reference integrity validation failed'
      };
    }
  }

  /**
   * Get project cross-reference map
   */
  async getProjectCrossReferenceMap(projectId: string): Promise<ProjectCrossReferenceMap | null> {
    return await this.multiDocRepository.getProjectCrossReferenceMap(projectId);
  }

  /**
   * Get cross-document navigation links for project
   */
  async getCrossDocumentNavigationLinks(projectId: string): Promise<CrossDocumentNavigationLink[]> {
    return await this.multiDocRepository.getCrossDocumentNavigationLinksByProject(projectId);
  }

  /**
   * Clean up multi-document references
   */
  async cleanupMultiDocumentReferences(projectId: string): Promise<number> {
    return await this.multiDocRepository.cleanupMultiDocumentReferences(projectId);
  }

  // Private helper methods

  private async analyzeDocumentForCrossReferences(
    sessionId: string,
    documentId: string,
    _matchingConfig?: any
  ) {
    return await this.crossPageDetector.detectCrossPageReferences(
      sessionId,
      documentId,
      undefined
    );
  }

  private async getCrossDocumentReferences(
    sourceDocumentId: string,
    targetDocumentId: string
  ): Promise<CrossPageReference[]> {
    const sourceRefs = await this.crossPageRepository.getCrossPageReferencesByDocument(sourceDocumentId);
    return sourceRefs.filter(ref => 
      ref.targetDocumentId === targetDocumentId
    );
  }

  private determineRelationshipType(crossReferences: CrossPageReference[]): DocumentRelationshipType {
    // Analyze reference patterns to determine relationship type
    const referenceTypes = crossReferences.map(ref => ref.referenceType);
    
    if (referenceTypes.includes('assembly_reference')) {
      return 'assembly_to_part';
    } else if (referenceTypes.includes('detail_reference')) {
      return 'main_to_detail';
    } else if (referenceTypes.includes('component_continuation')) {
      return 'continuation';
    } else if (referenceTypes.includes('schematic_reference')) {
      return 'schematic_to_layout';
    } else {
      return 'reference';
    }
  }

  private calculateRelationshipStrength(crossReferences: CrossPageReference[]): number {
    // Calculate relationship strength based on number and confidence of references
    if (crossReferences.length === 0) return 0;
    
    const totalConfidence = crossReferences.reduce((sum, ref) => sum + ref.confidence, 0);
    const avgConfidence = totalConfidence / crossReferences.length;
    const volumeBonus = Math.min(crossReferences.length / 10, 0.2); // Up to 20% bonus for volume
    
    return Math.min(avgConfidence + volumeBonus, 1.0);
  }

  private shouldCreateReverseRelationship(relationshipType: DocumentRelationshipType): boolean {
    return relationshipType === 'continuation' || relationshipType === 'reference';
  }

  private getReverseRelationshipType(relationshipType: DocumentRelationshipType): DocumentRelationshipType {
    switch (relationshipType) {
      case 'main_to_detail': return 'reference';
      case 'assembly_to_part': return 'reference';
      case 'schematic_to_layout': return 'reference';
      case 'continuation': return 'continuation';
      case 'reference': return 'reference';
      case 'parent_child': return 'reference';
      default: return 'reference';
    }
  }

  private async getComponentCoordinates(_componentId: string): Promise<{ x: number; y: number }> {
    // Mock implementation - in real system would query symbol detection results
    return { x: 100, y: 100 };
  }

  private generateNavigationLabel(
    crossRef: CrossPageReference,
    relationshipType: DocumentRelationshipType
  ): string {
    return `${crossRef.referenceDesignation} (${relationshipType})`;
  }

  private determineLinkType(relationshipType: DocumentRelationshipType): 'reference' | 'detail' | 'continuation' | 'assembly' {
    switch (relationshipType) {
      case 'main_to_detail': return 'detail';
      case 'assembly_to_part': return 'assembly';
      case 'continuation': return 'continuation';
      default: return 'reference';
    }
  }

  private async validateProjectReferenceIntegrity(
    projectId: string,
    _documentIds: string[]
  ): Promise<ReferenceIntegrityCheck[]> {
    const analysisResults = await this.multiDocRepository.runReferenceIntegrityAnalysis(projectId);
    const integrityChecks: ReferenceIntegrityCheck[] = [];

    for (const result of analysisResults) {
      if (result.status !== 'valid') {
        const primaryDocumentId = await this.findPrimaryDocumentForDesignation(
          projectId,
          result.designation
        );

        const integrityCheck = await this.multiDocRepository.createReferenceIntegrityCheck(
          projectId,
          primaryDocumentId,
          result.designation,
          result.status,
          result.affectedDocs
        );

        integrityChecks.push(integrityCheck);
      }
    }

    return integrityChecks;
  }

  private async getProjectDocumentIds(_projectId: string): Promise<string[]> {
    // Mock implementation - would query documents table
    return [];
  }

  private async findPrimaryDocumentForDesignation(
    _projectId: string,
    _designation: string
  ): Promise<string> {
    // Mock implementation - would find the document where this component is primarily defined
    return 'mock-document-id';
  }

  private canAutoResolve(status: ReferenceIntegrityStatus): boolean {
    return status === 'orphaned' || status === 'duplicate';
  }

  private async autoResolveIntegrityIssue(
    _integrityCheck: ReferenceIntegrityCheck,
    _projectId: string
  ): Promise<boolean> {
    // Mock implementation - would implement auto-resolution logic
    return false;
  }

  private generateIntegrityRecommendations(integrityChecks: ReferenceIntegrityCheck[]): string[] {
    const recommendations: string[] = [];

    const statusCounts = integrityChecks.reduce((acc, check) => {
      acc[check.integrityStatus] = (acc[check.integrityStatus] || 0) + 1;
      return acc;
    }, {} as Record<ReferenceIntegrityStatus, number>);

    Object.entries(statusCounts).forEach(([status, count]) => {
      switch (status as ReferenceIntegrityStatus) {
        case 'missing_target':
          recommendations.push(`Review ${count} references with missing targets`);
          break;
        case 'duplicate':
          recommendations.push(`Resolve ${count} duplicate reference designations`);
          break;
        case 'orphaned':
          recommendations.push(`Clean up ${count} orphaned references`);
          break;
        case 'circular':
          recommendations.push(`Fix ${count} circular reference dependencies`);
          break;
      }
    });

    return recommendations;
  }
}