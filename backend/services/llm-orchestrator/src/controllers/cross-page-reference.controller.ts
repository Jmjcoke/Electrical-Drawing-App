/**
 * Cross-Page Reference Controller
 * 
 * API endpoints for cross-page reference operations including analysis,
 * navigation, and reference lookup functionality.
 * 
 * Story: 4.4 Cross-Reference Engine
 * Task: 4.4.2 Implement Cross-Page Navigation Integration
 */

import { Request, Response } from 'express';
import { Pool } from 'pg';
import { getErrorMessage } from '../utils/error-utils';
import { CrossPageReferenceDetector } from '../cross-reference/cross-page-detector';
import { ReferenceMatcherService } from '../cross-reference/reference-matcher.service';
import { ContinuationSymbolService } from '../cross-reference/continuation-symbol.service';
import { CrossPageNavigationService } from '../cross-reference/navigation.service';
import { MultiDocumentReferenceService } from '../cross-reference/multi-document-reference.service';
import { CrossPageReferenceRepository } from '../repositories/cross-page-reference.repository';
import { MultiDocumentReferenceRepository } from '../repositories/multi-document-reference.repository';
import {
  AnalyzeCrossPageReferencesRequest,
  AnalyzeCrossPageReferencesResponse,
  GetReferencesByDesignationRequest,
  GetReferencesByDesignationResponse,
  CreateNavigationLinkRequest,
  CreateNavigationLinkResponse,
  CrossPageNavigationRequest,
  CrossPageNavigationResponse,
  AnalyzeMultiDocumentReferencesRequest,
  AnalyzeMultiDocumentReferencesResponse,
  // GetProjectCrossReferenceMapRequest, // Used in request validation
  GetProjectCrossReferenceMapResponse,
  CreateDocumentRelationshipRequest,
  CreateDocumentRelationshipResponse,
  ValidateReferenceIntegrityRequest,
  ValidateReferenceIntegrityResponse,
  CreateCrossDocumentNavigationRequest,
  CreateCrossDocumentNavigationResponse,
  CrossPageReferenceError,
  CrossPageReferenceErrorCodes
} from '../../../../shared/types/cross-page-reference.types';

export class CrossPageReferenceController {
  private detector: CrossPageReferenceDetector;
  private referenceMatcher: ReferenceMatcherService;
  private continuationService: ContinuationSymbolService;
  private navigationService: CrossPageNavigationService;
  private multiDocumentService: MultiDocumentReferenceService;
  private repository: CrossPageReferenceRepository;
  private multiDocRepository: MultiDocumentReferenceRepository;

  constructor(database: Pool) {
    this.detector = new CrossPageReferenceDetector(database);
    this.referenceMatcher = new ReferenceMatcherService(database);
    this.continuationService = new ContinuationSymbolService(database);
    this.navigationService = new CrossPageNavigationService(database);
    this.multiDocumentService = new MultiDocumentReferenceService(database);
    this.repository = new CrossPageReferenceRepository(database);
    this.multiDocRepository = new MultiDocumentReferenceRepository(database);
  }

  /**
   * POST /api/sessions/{sessionId}/cross-references/analyze
   * Analyze cross-page references for a document
   */
  async analyzeCrossPageReferences(req: Request, res: Response): Promise<void> {
    try {
      // const { sessionId } = req.params; // Reserved for future use
      const requestBody = req.body as AnalyzeCrossPageReferencesRequest;

      if (!requestBody.documentId) {
        res.status(400).json({
          success: false,
          error: 'Document ID is required',
          processingTime: 0,
          conflicts: []
        } as AnalyzeCrossPageReferencesResponse);
        return;
      }

      const startTime = Date.now();

      // Run cross-page reference detection
      const detectionResult = await this.detector.detectCrossPageReferences(
        req.params.sessionId, // Use from params directly
        requestBody.documentId,
        requestBody.pageNumbers
      );

      // Detect reference conflicts
      const conflicts = await this.referenceMatcher.detectReferenceConflicts(
        requestBody.documentId
      );

      const processingTime = Date.now() - startTime;

      const response: AnalyzeCrossPageReferencesResponse = {
        success: true,
        detectionResult,
        conflicts,
        processingTime
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Cross-page reference analysis failed:', error);
      
      const response: AnalyzeCrossPageReferencesResponse = {
        success: false,
        error: getErrorMessage(error) || 'Cross-page reference analysis failed',
        processingTime: Date.now(),
        conflicts: []
      };

      const statusCode = error instanceof CrossPageReferenceError 
        ? this.getStatusCodeForError(error.code) 
        : 500;

      res.status(statusCode).json(response);
    }
  }

  /**
   * GET /api/sessions/{sessionId}/cross-references
   * Get all cross-page references for a session
   */
  async getCrossPageReferences(req: Request, res: Response): Promise<void> {
    try {
      // const { sessionId } = req.params; // Reserved for future use
      const { documentId, pageNumbers } = req.query;

      if (!documentId) {
        res.status(400).json({
          success: false,
          error: 'Document ID is required'
        });
        return;
      }

      const pageNumbersArray = pageNumbers 
        ? (pageNumbers as string).split(',').map(Number) 
        : undefined;

      const crossPageReferences = await this.repository.getCrossPageReferencesByDocument(
        documentId as string,
        pageNumbersArray
      );

      res.status(200).json({
        success: true,
        crossPageReferences,
        total: crossPageReferences.length
      });

    } catch (error) {
      console.error('Failed to get cross-page references:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error) || 'Failed to get cross-page references'
      });
    }
  }

  /**
   * GET /api/sessions/{sessionId}/components/{componentId}/references
   * Get cross-page references for a specific component
   */
  async getComponentCrossPageReferences(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, componentId } = req.params;

      const crossPageReferences = await this.detector.getCrossPageReferencesForComponent(
        componentId
      );

      res.status(200).json({
        success: true,
        componentId,
        crossPageReferences,
        total: crossPageReferences.length
      });

    } catch (error) {
      console.error('Failed to get component cross-page references:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error) || 'Failed to get component cross-page references'
      });
    }
  }

  /**
   * GET /api/sessions/{sessionId}/references/{designation}
   * Find components by reference designation
   */
  async getReferencesByDesignation(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, designation } = req.params;
      const { documentId, includeRelated = 'false' } = req.query;

      const requestData: GetReferencesByDesignationRequest = {
        designation,
        documentId: documentId as string,
        includeRelated: includeRelated === 'true'
      };

      // Get component references
      const references = await this.detector.findComponentsByDesignation(
        designation,
        requestData.documentId
      );

      // Get cross-page links
      const crossPageLinks = await this.repository.getCrossPageReferencesByDesignation(
        designation,
        requestData.documentId
      );

      // Get navigation links
      const navigationLinks = requestData.documentId 
        ? await this.navigationService.getNavigationLinksForPage(
            requestData.documentId, 
            references.length > 0 ? references[0].pageNumber : 1
          )
        : [];

      const response: GetReferencesByDesignationResponse = {
        success: true,
        references,
        crossPageLinks,
        navigationLinks
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Failed to get references by designation:', error);
      
      const response: GetReferencesByDesignationResponse = {
        success: false,
        references: [],
        crossPageLinks: [],
        navigationLinks: [],
        error: getErrorMessage(error) || 'Failed to get references by designation'
      };

      res.status(500).json(response);
    }
  }

  /**
   * GET /api/sessions/{sessionId}/navigation/{referenceId}
   * Get navigation link for cross-page reference
   */
  async getNavigationLink(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, referenceId } = req.params;
      const { fromPage, toPage, documentId } = req.query;

      if (!fromPage || !toPage || !documentId) {
        res.status(400).json({
          success: false,
          navigationLink: {},
          error: 'fromPage, toPage, and documentId are required'
        } as CrossPageNavigationResponse);
        return;
      }

      const navigationRequest: CrossPageNavigationRequest = {
        referenceId,
        fromPage: parseInt(fromPage as string),
        toPage: parseInt(toPage as string),
        documentId: documentId as string
      };

      const navigationResponse = await this.navigationService.navigateToReference(
        navigationRequest
      );

      res.status(200).json(navigationResponse);

    } catch (error) {
      console.error('Failed to get navigation link:', error);
      
      const response: CrossPageNavigationResponse = {
        success: false,
        navigationLink: {} as any,
        error: getErrorMessage(error) || 'Failed to get navigation link'
      };

      res.status(500).json(response);
    }
  }

  /**
   * POST /api/sessions/{sessionId}/navigation/links
   * Create navigation link
   */
  async createNavigationLink(req: Request, res: Response): Promise<void> {
    try {
      // const { sessionId } = req.params; // Reserved for future use
      const requestBody = req.body as CreateNavigationLinkRequest;

      if (!requestBody.referenceId || !requestBody.sourceCoordinates) {
        res.status(400).json({
          success: false,
          error: 'Reference ID and source coordinates are required'
        } as CreateNavigationLinkResponse);
        return;
      }

      // For now, we'll just activate the navigation link
      // In a full implementation, this might create custom navigation links
      const success = this.navigationService.activateNavigationLink(requestBody.referenceId);

      if (success) {
        const activeLinks = this.navigationService.getActiveNavigationLinks();
        const navigationLink = activeLinks.find(link => link.referenceId === requestBody.referenceId);

        res.status(200).json({
          success: true,
          navigationLink: navigationLink || {
            referenceId: requestBody.referenceId,
            sourceCoordinates: requestBody.sourceCoordinates,
            targetCoordinates: requestBody.targetCoordinates,
            navigationLabel: requestBody.navigationLabel || 'Custom Navigation Link',
            isActive: true
          }
        } as CreateNavigationLinkResponse);
      } else {
        res.status(404).json({
          success: false,
          error: 'Reference not found'
        } as CreateNavigationLinkResponse);
      }

    } catch (error) {
      console.error('Failed to create navigation link:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error) || 'Failed to create navigation link'
      } as CreateNavigationLinkResponse);
    }
  }

  /**
   * GET /api/sessions/{sessionId}/documents/{documentId}/references
   * Get cross-document references
   */
  async getCrossDocumentReferences(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, documentId } = req.params;

      // Get cross-page references where target document is different
      const crossDocumentReferences = await this.repository.getCrossPageReferencesByDocument(
        documentId
      );

      const filteredReferences = crossDocumentReferences.filter(ref => 
        ref.targetDocumentId && ref.targetDocumentId !== ref.sourceDocumentId
      );

      res.status(200).json({
        success: true,
        documentId,
        crossDocumentReferences: filteredReferences,
        total: filteredReferences.length
      });

    } catch (error) {
      console.error('Failed to get cross-document references:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error) || 'Failed to get cross-document references'
      });
    }
  }

  /**
   * GET /api/sessions/{sessionId}/cross-references/stats
   * Get cross-page reference statistics
   */
  async getCrossPageReferenceStats(req: Request, res: Response): Promise<void> {
    try {
      // const { sessionId } = req.params; // Reserved for future use
      const { documentId } = req.query;

      const stats = await this.repository.getCrossPageReferenceStats(
        documentId as string
      );

      res.status(200).json({
        success: true,
        documentId: documentId || 'all',
        statistics: stats
      });

    } catch (error) {
      console.error('Failed to get cross-page reference statistics:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error) || 'Failed to get cross-page reference statistics'
      });
    }
  }

  /**
   * POST /api/sessions/{sessionId}/cross-references/validate
   * Validate reference consistency
   */
  async validateReferenceConsistency(req: Request, res: Response): Promise<void> {
    try {
      // const { sessionId } = req.params; // Reserved for future use
      const { documentId } = req.body;

      if (!documentId) {
        res.status(400).json({
          success: false,
          error: 'Document ID is required'
        });
        return;
      }

      const validationResults = await this.referenceMatcher.validateReferenceConsistency(
        documentId
      );

      const conflicts = await this.referenceMatcher.detectReferenceConflicts(
        documentId
      );

      res.status(200).json({
        success: true,
        documentId,
        validationResults,
        conflicts,
        totalIssues: validationResults.filter(r => !r.isValid).length + conflicts.length
      });

    } catch (error) {
      console.error('Failed to validate reference consistency:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error) || 'Failed to validate reference consistency'
      });
    }
  }

  /**
   * DELETE /api/sessions/{sessionId}/cross-references/{referenceId}
   * Delete a cross-page reference
   */
  async deleteCrossPageReference(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, referenceId } = req.params;

      const deleted = await this.repository.deleteCrossPageReference(referenceId);

      if (deleted) {
        // Also deactivate any navigation links
        this.navigationService.deactivateNavigationLink(referenceId);

        res.status(200).json({
          success: true,
          message: 'Cross-page reference deleted successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Cross-page reference not found'
        });
      }

    } catch (error) {
      console.error('Failed to delete cross-page reference:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error) || 'Failed to delete cross-page reference'
      });
    }
  }

  /**
   * POST /api/sessions/{sessionId}/cross-references/cleanup
   * Clean up orphaned references
   */
  async cleanupOrphanedReferences(req: Request, res: Response): Promise<void> {
    try {
      // const { sessionId } = req.params; // Reserved for future use
      const { documentId } = req.body;

      const deletedCount = await this.repository.cleanupOrphanedReferences(documentId);

      res.status(200).json({
        success: true,
        documentId: documentId || 'all',
        deletedCount,
        message: `Cleaned up ${deletedCount} orphaned references`
      });

    } catch (error) {
      console.error('Failed to cleanup orphaned references:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error) || 'Failed to cleanup orphaned references'
      });
    }
  }

  /**
   * GET /api/sessions/{sessionId}/continuation-symbols
   * Get continuation symbols for a document
   */
  async getContinuationSymbols(req: Request, res: Response): Promise<void> {
    try {
      // const { sessionId } = req.params; // Reserved for future use
      const { documentId, pageNumbers } = req.query;

      if (!documentId) {
        res.status(400).json({
          success: false,
          error: 'Document ID is required'
        });
        return;
      }

      const pageNumbersArray = pageNumbers 
        ? (pageNumbers as string).split(',').map(Number) 
        : undefined;

      const continuationSymbols = await this.continuationService.detectContinuationSymbols(
        documentId as string,
        pageNumbersArray
      );

      const stats = await this.continuationService.getContinuationSymbolStats(
        documentId as string
      );

      res.status(200).json({
        success: true,
        documentId,
        continuationSymbols,
        statistics: stats
      });

    } catch (error) {
      console.error('Failed to get continuation symbols:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error) || 'Failed to get continuation symbols'
      });
    }
  }

  /**
   * POST /api/sessions/{sessionId}/multi-document/analyze
   * Analyze multi-document references for a project
   */
  async analyzeMultiDocumentReferences(req: Request, res: Response): Promise<void> {
    try {
      // const { sessionId } = req.params; // Reserved for future use
      const requestBody = req.body as AnalyzeMultiDocumentReferencesRequest;

      if (!requestBody.projectId || !requestBody.documentIds || requestBody.documentIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Project ID and document IDs are required',
          projectId: requestBody.projectId || '',
          documentRelationships: [],
          globalComponents: [],
          integrityChecks: [],
          crossDocumentNavigation: [],
          processingTime: 0,
          totalReferences: 0
        } as AnalyzeMultiDocumentReferencesResponse);
        return;
      }

      const response = await this.multiDocumentService.analyzeMultiDocumentReferences({
        ...requestBody,
        sessionId
      });

      res.status(200).json(response);

    } catch (error) {
      console.error('Multi-document reference analysis failed:', error);
      
      const response: AnalyzeMultiDocumentReferencesResponse = {
        success: false,
        error: getErrorMessage(error) || 'Multi-document reference analysis failed',
        projectId: req.body.projectId || '',
        documentRelationships: [],
        globalComponents: [],
        integrityChecks: [],
        crossDocumentNavigation: [],
        processingTime: 0,
        totalReferences: 0
      };

      const statusCode = error instanceof CrossPageReferenceError 
        ? this.getStatusCodeForError(error.code) 
        : 500;

      res.status(statusCode).json(response);
    }
  }

  /**
   * GET /api/sessions/{sessionId}/projects/{projectId}/cross-reference-map
   * Get project cross-reference map
   */
  async getProjectCrossReferenceMap(req: Request, res: Response): Promise<void> {
    try {
      const { projectId } = req.params;
      const { includeDetails = 'false' } = req.query;

      const projectMap = await this.multiDocumentService.getProjectCrossReferenceMap(projectId);

      if (!projectMap) {
        res.status(404).json({
          success: false,
          error: 'Project cross-reference map not found'
        } as GetProjectCrossReferenceMapResponse);
        return;
      }

      const documentRelationships = await this.multiDocRepository.getDocumentRelationshipsByProject(projectId);
      
      let globalComponents = undefined;
      if (includeDetails === 'true') {
        globalComponents = await this.multiDocRepository.getGlobalComponentRegistryByProject(projectId);
      }

      const integrityChecks = await this.multiDocRepository.getReferenceIntegrityChecksByProject(projectId, true);

      const response: GetProjectCrossReferenceMapResponse = {
        success: true,
        projectMap,
        documentRelationships,
        globalComponents,
        integrityStatus: {
          totalChecks: integrityChecks.length,
          validReferences: 0, // Would be calculated
          issueCount: integrityChecks.filter(check => check.resolutionStatus === 'unresolved').length,
          lastCheckAt: projectMap.lastAnalysisAt
        }
      };

      res.status(200).json(response);

    } catch (error) {
      console.error('Failed to get project cross-reference map:', error);
      
      const response: GetProjectCrossReferenceMapResponse = {
        success: false,
        projectMap: {} as any,
        documentRelationships: [],
        integrityStatus: {
          totalChecks: 0,
          validReferences: 0,
          issueCount: 0
        },
        error: getErrorMessage(error) || 'Failed to get project cross-reference map'
      };

      res.status(500).json(response);
    }
  }

  /**
   * POST /api/sessions/{sessionId}/document-relationships
   * Create document relationship
   */
  async createDocumentRelationship(req: Request, res: Response): Promise<void> {
    try {
      // const { sessionId } = req.params; // Reserved for future use
      const requestBody = req.body as CreateDocumentRelationshipRequest;
      const { projectId } = req.query;

      if (!requestBody.sourceDocumentId || !requestBody.targetDocumentId || !requestBody.relationshipType || !projectId) {
        res.status(400).json({
          success: false,
          error: 'Source document ID, target document ID, relationship type, and project ID are required'
        } as CreateDocumentRelationshipResponse);
        return;
      }

      const documentRelationship = await this.multiDocRepository.createDocumentRelationship(
        projectId as string,
        requestBody.sourceDocumentId,
        requestBody.targetDocumentId,
        requestBody.relationshipType,
        requestBody.relationshipStrength
      );

      res.status(200).json({
        success: true,
        documentRelationship
      } as CreateDocumentRelationshipResponse);

    } catch (error) {
      console.error('Failed to create document relationship:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error) || 'Failed to create document relationship'
      } as CreateDocumentRelationshipResponse);
    }
  }

  /**
   * POST /api/sessions/{sessionId}/projects/{projectId}/validate-integrity
   * Validate reference integrity across project documents
   */
  async validateReferenceIntegrity(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, projectId } = req.params;
      const { documentIds, autoResolve = false } = req.body;

      const requestData: ValidateReferenceIntegrityRequest = {
        projectId,
        documentIds,
        autoResolve
      };

      const response = await this.multiDocumentService.validateReferenceIntegrity(requestData);

      res.status(200).json(response);

    } catch (error) {
      console.error('Failed to validate reference integrity:', error);
      
      const response: ValidateReferenceIntegrityResponse = {
        success: false,
        projectId: req.params.projectId,
        integrityChecks: [],
        summary: {
          totalChecked: 0,
          validCount: 0,
          issueCount: 0,
          autoResolvedCount: 0
        },
        recommendedActions: [],
        processingTime: 0,
        error: getErrorMessage(error) || 'Failed to validate reference integrity'
      };

      res.status(500).json(response);
    }
  }

  /**
   * POST /api/sessions/{sessionId}/cross-document-navigation
   * Create cross-document navigation link
   */
  async createCrossDocumentNavigationLink(req: Request, res: Response): Promise<void> {
    try {
      // const { sessionId } = req.params; // Reserved for future use
      const requestBody = req.body as CreateCrossDocumentNavigationRequest;

      if (!requestBody.crossReferenceId || !requestBody.sourceDocumentId || 
          !requestBody.targetDocumentId || !requestBody.navigationLabel) {
        res.status(400).json({
          success: false,
          error: 'Cross-reference ID, source document ID, target document ID, and navigation label are required'
        } as CreateCrossDocumentNavigationResponse);
        return;
      }

      const navigationLink = await this.multiDocRepository.createCrossDocumentNavigationLink(
        requestBody.crossReferenceId,
        requestBody.sourceDocumentId,
        requestBody.targetDocumentId,
        requestBody.sourceCoordinates,
        requestBody.navigationLabel,
        requestBody.targetCoordinates,
        requestBody.linkType
      );

      res.status(200).json({
        success: true,
        navigationLink
      } as CreateCrossDocumentNavigationResponse);

    } catch (error) {
      console.error('Failed to create cross-document navigation link:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error) || 'Failed to create cross-document navigation link'
      } as CreateCrossDocumentNavigationResponse);
    }
  }

  /**
   * GET /api/sessions/{sessionId}/projects/{projectId}/cross-document-navigation
   * Get cross-document navigation links for project
   */
  async getCrossDocumentNavigationLinks(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, projectId } = req.params;
      const { activeOnly = 'true' } = req.query;

      const navigationLinks = await this.multiDocRepository.getCrossDocumentNavigationLinksByProject(
        projectId,
        activeOnly === 'true'
      );

      res.status(200).json({
        success: true,
        projectId,
        navigationLinks,
        total: navigationLinks.length
      });

    } catch (error) {
      console.error('Failed to get cross-document navigation links:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error) || 'Failed to get cross-document navigation links'
      });
    }
  }

  /**
   * POST /api/sessions/{sessionId}/projects/{projectId}/cleanup-multi-document
   * Clean up orphaned multi-document references
   */
  async cleanupMultiDocumentReferences(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, projectId } = req.params;

      const deletedCount = await this.multiDocumentService.cleanupMultiDocumentReferences(projectId);

      res.status(200).json({
        success: true,
        projectId,
        deletedCount,
        message: `Cleaned up ${deletedCount} orphaned multi-document references`
      });

    } catch (error) {
      console.error('Failed to cleanup multi-document references:', error);
      res.status(500).json({
        success: false,
        error: getErrorMessage(error) || 'Failed to cleanup multi-document references'
      });
    }
  }

  /**
   * GET HTTP status code for CrossPageReferenceError
   */
  private getStatusCodeForError(errorCode: CrossPageReferenceErrorCodes): number {
    const statusCodes: Record<CrossPageReferenceErrorCodes, number> = {
      [CrossPageReferenceErrorCodes.DETECTION_FAILED]: 500,
      [CrossPageReferenceErrorCodes.INVALID_DESIGNATION]: 400,
      [CrossPageReferenceErrorCodes.REFERENCE_NOT_FOUND]: 404,
      [CrossPageReferenceErrorCodes.NAVIGATION_FAILED]: 500,
      [CrossPageReferenceErrorCodes.CONFLICT_RESOLUTION_FAILED]: 422,
      [CrossPageReferenceErrorCodes.MULTI_DOCUMENT_SYNC_FAILED]: 500,
      [CrossPageReferenceErrorCodes.VALIDATION_FAILED]: 422,
      [CrossPageReferenceErrorCodes.DATABASE_ERROR]: 500,
      [CrossPageReferenceErrorCodes.INSUFFICIENT_CONFIDENCE]: 422,
      [CrossPageReferenceErrorCodes.PAGE_NOT_FOUND]: 404
    };

    return statusCodes[errorCode] || 500;
  }
}