/**
 * Multi-Document Reference Service Tests
 * 
 * Comprehensive test suite for multi-document reference operations including
 * document relationship management, reference integrity checking, and 
 * cross-document navigation.
 * 
 * Story: 4.4 Cross-Reference Engine
 * Task: 4.4.3 Build Multi-Document Reference System
 */

import { Pool } from 'pg';
import { MultiDocumentReferenceService } from '../multi-document-reference.service';
import { MultiDocumentReferenceRepository } from '../../repositories/multi-document-reference.repository';
import { CrossPageReferenceRepository } from '../../repositories/cross-page-reference.repository';
import {
  DocumentRelationship,
  ProjectCrossReferenceMap,
  ReferenceIntegrityCheck,
  GlobalComponentRegistry,
  CrossDocumentNavigationLink,
  AnalyzeMultiDocumentReferencesRequest,
  ValidateReferenceIntegrityRequest,
  CrossPageReferenceError
} from '../../../../../shared/types/cross-page-reference.types';

// Mock the database pool
const mockPool: jest.Mocked<Pool> = {
  connect: jest.fn(),
  end: jest.fn(),
  query: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
  totalCount: 0,
  idleCount: 0,
  waitingCount: 0
} as any;

// Mock database client
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn()
};

describe('MultiDocumentReferenceService', () => {
  let service: MultiDocumentReferenceService;
  let multiDocRepository: jest.Mocked<MultiDocumentReferenceRepository>;

  // Sample test data
  const sampleProjectId = 'project-123';
  const sampleDocumentIds = ['doc-1', 'doc-2', 'doc-3'];
  const sampleSessionId = 'session-456';

  const sampleDocumentRelationship: DocumentRelationship = {
    id: 'rel-1',
    projectId: sampleProjectId,
    sourceDocumentId: 'doc-1',
    targetDocumentId: 'doc-2',
    relationshipType: 'main_to_detail',
    relationshipStrength: 0.85,
    referenceCount: 5,
    lastUpdated: new Date(),
    createdAt: new Date()
  };

  const sampleProjectMap: ProjectCrossReferenceMap = {
    id: 'map-1',
    projectId: sampleProjectId,
    projectName: 'Test Project',
    totalDocuments: 3,
    totalCrossReferences: 15,
    integrationStatus: 'completed',
    lastAnalysisAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const sampleGlobalComponent: GlobalComponentRegistry = {
    id: 'gc-1',
    projectId: sampleProjectId,
    referenceDesignation: 'R1',
    componentType: 'resistor',
    primaryDocumentId: 'doc-1',
    primaryPageNumber: 1,
    occurrenceCount: 3,
    relatedDocuments: ['doc-1', 'doc-2'],
    specifications: { resistance: '10kΩ' },
    lastUpdated: new Date(),
    createdAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPool.connect.mockResolvedValue(mockClient);
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

    service = new MultiDocumentReferenceService(mockPool);
    
    // Access private repositories for mocking
    multiDocRepository = (service as any).multiDocRepository;
  });

  describe('analyzeMultiDocumentReferences', () => {
    it('should successfully analyze multi-document references', async () => {
      // Setup mocks
      jest.spyOn(multiDocRepository, 'updateProjectIntegrationStatus').mockResolvedValue(undefined);
      jest.spyOn(multiDocRepository, 'createOrUpdateProjectCrossReferenceMap').mockResolvedValue(sampleProjectMap);
      jest.spyOn(multiDocRepository, 'getDocumentRelationshipsByProject').mockResolvedValue([sampleDocumentRelationship]);
      jest.spyOn(multiDocRepository, 'getGlobalComponentRegistryByProject').mockResolvedValue([sampleGlobalComponent]);

      // Mock cross-page detector methods
      const crossPageDetector = (service as any).crossPageDetector;
      jest.spyOn(crossPageDetector, 'detectCrossPageReferences').mockResolvedValue({
        sessionId: sampleSessionId,
        documentId: 'doc-1',
        detectedReferences: [],
        crossPageLinks: [],
        continuationSymbols: [],
        processingTime: 100,
        confidence: 0.9,
        timestamp: new Date()
      });

      const request: AnalyzeMultiDocumentReferencesRequest = {
        sessionId: sampleSessionId,
        projectId: sampleProjectId,
        documentIds: sampleDocumentIds,
        checkIntegrity: false
      };

      const result = await service.analyzeMultiDocumentReferences(request);

      expect(result.success).toBe(true);
      expect(result.projectId).toBe(sampleProjectId);
      expect(result.documentRelationships).toHaveLength(1);
      expect(result.globalComponents).toHaveLength(1);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.totalReferences).toBeGreaterThanOrEqual(0);

      // Verify project status updates
      expect(multiDocRepository.updateProjectIntegrationStatus).toHaveBeenCalledWith(
        sampleProjectId, 
        'processing'
      );
      expect(multiDocRepository.updateProjectIntegrationStatus).toHaveBeenCalledWith(
        sampleProjectId, 
        'completed'
      );
    });

    it('should handle analysis failure and update project status to error', async () => {
      // Setup failure scenario
      jest.spyOn(multiDocRepository, 'updateProjectIntegrationStatus').mockResolvedValue(undefined);
      const crossPageDetector = (service as any).crossPageDetector;
      jest.spyOn(crossPageDetector, 'detectCrossPageReferences').mockRejectedValue(
        new Error('Analysis failed')
      );

      const request: AnalyzeMultiDocumentReferencesRequest = {
        sessionId: sampleSessionId,
        projectId: sampleProjectId,
        documentIds: sampleDocumentIds
      };

      const result = await service.analyzeMultiDocumentReferences(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Analysis failed');
      expect(result.documentRelationships).toHaveLength(0);
      expect(result.globalComponents).toHaveLength(0);

      // Verify error status update
      expect(multiDocRepository.updateProjectIntegrationStatus).toHaveBeenCalledWith(
        sampleProjectId, 
        'error',
        'Analysis failed'
      );
    });

    it('should perform integrity checking when requested', async () => {
      // Setup mocks including integrity checks
      jest.spyOn(multiDocRepository, 'updateProjectIntegrationStatus').mockResolvedValue(undefined);
      jest.spyOn(multiDocRepository, 'createOrUpdateProjectCrossReferenceMap').mockResolvedValue(sampleProjectMap);
      jest.spyOn(multiDocRepository, 'getDocumentRelationshipsByProject').mockResolvedValue([]);
      jest.spyOn(multiDocRepository, 'getGlobalComponentRegistryByProject').mockResolvedValue([]);

      const sampleIntegrityCheck: ReferenceIntegrityCheck = {
        id: 'check-1',
        projectId: sampleProjectId,
        documentId: 'doc-1',
        referenceDesignation: 'R1',
        integrityStatus: 'duplicate',
        affectedDocuments: ['doc-1', 'doc-2'],
        lastCheckedAt: new Date(),
        resolutionStatus: 'unresolved',
        createdAt: new Date()
      };

      jest.spyOn(service, 'validateProjectReferenceIntegrity' as any).mockResolvedValue([sampleIntegrityCheck]);

      const crossPageDetector = (service as any).crossPageDetector;
      jest.spyOn(crossPageDetector, 'detectCrossPageReferences').mockResolvedValue({
        sessionId: sampleSessionId,
        documentId: 'doc-1',
        detectedReferences: [],
        crossPageLinks: [],
        continuationSymbols: [],
        processingTime: 100,
        confidence: 0.9,
        timestamp: new Date()
      });

      const request: AnalyzeMultiDocumentReferencesRequest = {
        sessionId: sampleSessionId,
        projectId: sampleProjectId,
        documentIds: sampleDocumentIds,
        checkIntegrity: true
      };

      const result = await service.analyzeMultiDocumentReferences(request);

      expect(result.success).toBe(true);
      expect(result.integrityChecks).toHaveLength(1);
      expect(result.integrityChecks[0].integrityStatus).toBe('duplicate');
    });
  });

  describe('detectDocumentRelationships', () => {
    it('should detect relationships between documents', async () => {
      // Setup mocks
      jest.spyOn(multiDocRepository, 'createOrUpdateProjectCrossReferenceMap').mockResolvedValue(sampleProjectMap);
      jest.spyOn(multiDocRepository, 'createDocumentRelationship').mockResolvedValue(sampleDocumentRelationship);
      
      // Mock getCrossDocumentReferences method
      jest.spyOn(service, 'getCrossDocumentReferences' as any).mockResolvedValue([
        {
          id: 'ref-1',
          referenceDesignation: 'R1',
          referenceType: 'detail_reference',
          confidence: 0.9,
          sourceComponentId: 'comp-1',
          targetComponentId: 'comp-2'
        }
      ]);

      const relationships = await service.detectDocumentRelationships(
        sampleProjectId, 
        sampleDocumentIds.slice(0, 2)
      );

      expect(relationships).toHaveLength(1);
      expect(relationships[0].relationshipType).toBe('main_to_detail');
      expect(multiDocRepository.createDocumentRelationship).toHaveBeenCalled();
    });

    it('should handle empty document relationships', async () => {
      jest.spyOn(multiDocRepository, 'createOrUpdateProjectCrossReferenceMap').mockResolvedValue(sampleProjectMap);
      jest.spyOn(service, 'getCrossDocumentReferences' as any).mockResolvedValue([]);

      const relationships = await service.detectDocumentRelationships(
        sampleProjectId, 
        sampleDocumentIds.slice(0, 2)
      );

      expect(relationships).toHaveLength(0);
      expect(multiDocRepository.createDocumentRelationship).not.toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      jest.spyOn(multiDocRepository, 'createOrUpdateProjectCrossReferenceMap')
        .mockRejectedValue(new Error('Database error'));

      await expect(service.detectDocumentRelationships(sampleProjectId, sampleDocumentIds))
        .rejects.toThrow(CrossPageReferenceError);
    });
  });

  describe('buildGlobalComponentRegistry', () => {
    it('should build global component registry', async () => {
      jest.spyOn(multiDocRepository, 'getGlobalComponentRegistryByProject')
        .mockResolvedValue([sampleGlobalComponent]);

      const registry = await service.buildGlobalComponentRegistry(sampleProjectId, sampleDocumentIds);

      expect(registry).toHaveLength(1);
      expect(registry[0].referenceDesignation).toBe('R1');
      expect(registry[0].occurrenceCount).toBe(3);
    });

    it('should handle empty registry', async () => {
      jest.spyOn(multiDocRepository, 'getGlobalComponentRegistryByProject').mockResolvedValue([]);

      const registry = await service.buildGlobalComponentRegistry(sampleProjectId, sampleDocumentIds);

      expect(registry).toHaveLength(0);
    });

    it('should throw error on database failure', async () => {
      jest.spyOn(multiDocRepository, 'getGlobalComponentRegistryByProject')
        .mockRejectedValue(new Error('Database error'));

      await expect(service.buildGlobalComponentRegistry(sampleProjectId, sampleDocumentIds))
        .rejects.toThrow(CrossPageReferenceError);
    });
  });

  describe('createCrossDocumentNavigationLinks', () => {
    it('should create navigation links for document relationships', async () => {
      const sampleNavLink: CrossDocumentNavigationLink = {
        id: 'nav-1',
        crossReferenceId: 'ref-1',
        sourceDocumentId: 'doc-1',
        targetDocumentId: 'doc-2',
        sourceCoordinates: { x: 100, y: 100 },
        targetCoordinates: { x: 200, y: 200 },
        navigationLabel: 'R1 (main_to_detail)',
        linkType: 'detail',
        isActive: true,
        createdAt: new Date()
      };

      // Setup mocks
      jest.spyOn(service, 'getCrossDocumentReferences' as any).mockResolvedValue([
        {
          id: 'ref-1',
          referenceDesignation: 'R1',
          referenceType: 'detail_reference',
          sourceComponentId: 'comp-1',
          targetComponentId: 'comp-2'
        }
      ]);
      
      jest.spyOn(service, 'getComponentCoordinates' as any).mockResolvedValue({ x: 100, y: 100 });
      jest.spyOn(multiDocRepository, 'createCrossDocumentNavigationLink').mockResolvedValue(sampleNavLink);

      const navigationLinks = await service.createCrossDocumentNavigationLinks(
        sampleProjectId,
        [sampleDocumentRelationship],
        [sampleGlobalComponent]
      );

      expect(navigationLinks).toHaveLength(1);
      expect(navigationLinks[0].linkType).toBe('detail');
      expect(multiDocRepository.createCrossDocumentNavigationLink).toHaveBeenCalled();
    });

    it('should handle empty relationships', async () => {
      const navigationLinks = await service.createCrossDocumentNavigationLinks(
        sampleProjectId,
        [],
        []
      );

      expect(navigationLinks).toHaveLength(0);
    });

    it('should throw error on navigation creation failure', async () => {
      jest.spyOn(service, 'getCrossDocumentReferences' as any).mockRejectedValue(
        new Error('Navigation error')
      );

      await expect(service.createCrossDocumentNavigationLinks(
        sampleProjectId,
        [sampleDocumentRelationship],
        []
      )).rejects.toThrow(CrossPageReferenceError);
    });
  });

  describe('validateReferenceIntegrity', () => {
    it('should validate reference integrity successfully', async () => {

      // Setup mocks
      jest.spyOn(service, 'getProjectDocumentIds' as any).mockResolvedValue(sampleDocumentIds);
      jest.spyOn(multiDocRepository, 'runReferenceIntegrityAnalysis').mockResolvedValue([
        { designation: 'R1', status: 'valid', affectedDocs: ['doc-1'], issueCount: 1 }
      ]);

      const request: ValidateReferenceIntegrityRequest = {
        sessionId: sampleSessionId,
        projectId: sampleProjectId,
        autoResolve: false
      };

      const result = await service.validateReferenceIntegrity(request);

      expect(result.success).toBe(true);
      expect(result.summary.totalChecked).toBe(1);
      expect(result.summary.validCount).toBe(1);
      expect(result.summary.issueCount).toBe(0);
    });

    it('should handle integrity issues with auto-resolution', async () => {
      // Setup mocks for failed integrity
      jest.spyOn(service, 'getProjectDocumentIds' as any).mockResolvedValue(sampleDocumentIds);
      jest.spyOn(multiDocRepository, 'runReferenceIntegrityAnalysis').mockResolvedValue([
        { designation: 'R1', status: 'duplicate', affectedDocs: ['doc-1', 'doc-2'], issueCount: 2 }
      ]);

      jest.spyOn(service, 'findPrimaryDocumentForDesignation' as any).mockResolvedValue('doc-1');
      jest.spyOn(multiDocRepository, 'createReferenceIntegrityCheck').mockResolvedValue({
        id: 'check-1',
        projectId: sampleProjectId,
        documentId: 'doc-1',
        referenceDesignation: 'R1',
        integrityStatus: 'duplicate',
        affectedDocuments: ['doc-1', 'doc-2'],
        lastCheckedAt: new Date(),
        resolutionStatus: 'unresolved',
        createdAt: new Date()
      });

      jest.spyOn(service, 'autoResolveIntegrityIssue' as any).mockResolvedValue(true);

      const request: ValidateReferenceIntegrityRequest = {
        sessionId: sampleSessionId,
        projectId: sampleProjectId,
        autoResolve: true
      };

      const result = await service.validateReferenceIntegrity(request);

      expect(result.success).toBe(true);
      expect(result.summary.issueCount).toBe(1);
      expect(result.summary.autoResolvedCount).toBe(1);
      expect(result.recommendedActions).toContain('Resolve 1 duplicate reference designations');
    });

    it('should handle validation errors gracefully', async () => {
      jest.spyOn(service, 'getProjectDocumentIds' as any).mockRejectedValue(
        new Error('Validation failed')
      );

      const request: ValidateReferenceIntegrityRequest = {
        sessionId: sampleSessionId,
        projectId: sampleProjectId
      };

      const result = await service.validateReferenceIntegrity(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation failed');
      expect(result.summary.totalChecked).toBe(0);
    });
  });

  describe('helper methods', () => {
    it('should determine correct relationship type', () => {
      const mockReferences = [
        { referenceType: 'detail_reference' },
        { referenceType: 'component_continuation' }
      ];

      const relationshipType = (service as any).determineRelationshipType(mockReferences);
      expect(relationshipType).toBe('main_to_detail');
    });

    it('should calculate relationship strength correctly', () => {
      const mockReferences = [
        { confidence: 0.8 },
        { confidence: 0.9 },
        { confidence: 0.7 }
      ];

      const strength = (service as any).calculateRelationshipStrength(mockReferences);
      expect(strength).toBeCloseTo(0.8); // (0.8 + 0.9 + 0.7) / 3 = 0.8
    });

    it('should generate appropriate navigation labels', () => {
      const mockCrossRef = {
        referenceDesignation: 'R1',
        referenceType: 'detail_reference'
      };

      const label = (service as any).generateNavigationLabel(mockCrossRef, 'main_to_detail');
      expect(label).toBe('R1 (main_to_detail)');
    });

    it('should determine correct link type', () => {
      expect((service as any).determineLinkType('main_to_detail')).toBe('detail');
      expect((service as any).determineLinkType('assembly_to_part')).toBe('assembly');
      expect((service as any).determineLinkType('continuation')).toBe('continuation');
      expect((service as any).determineLinkType('reference')).toBe('reference');
    });

    it('should generate integrity recommendations', () => {
      const mockIntegrityChecks: ReferenceIntegrityCheck[] = [
        {
          id: 'check-1',
          projectId: sampleProjectId,
          documentId: 'doc-1',
          referenceDesignation: 'R1',
          integrityStatus: 'duplicate',
          affectedDocuments: ['doc-1', 'doc-2'],
          lastCheckedAt: new Date(),
          resolutionStatus: 'unresolved',
          createdAt: new Date()
        },
        {
          id: 'check-2',
          projectId: sampleProjectId,
          documentId: 'doc-1',
          referenceDesignation: 'R2',
          integrityStatus: 'missing_target',
          affectedDocuments: ['doc-1'],
          lastCheckedAt: new Date(),
          resolutionStatus: 'unresolved',
          createdAt: new Date()
        }
      ];

      const recommendations = (service as any).generateIntegrityRecommendations(mockIntegrityChecks);
      
      expect(recommendations).toContain('Review 1 references with missing targets');
      expect(recommendations).toContain('Resolve 1 duplicate reference designations');
    });
  });

  describe('service integration methods', () => {
    it('should get project cross-reference map', async () => {
      jest.spyOn(multiDocRepository, 'getProjectCrossReferenceMap').mockResolvedValue(sampleProjectMap);

      const result = await service.getProjectCrossReferenceMap(sampleProjectId);

      expect(result).toEqual(sampleProjectMap);
      expect(multiDocRepository.getProjectCrossReferenceMap).toHaveBeenCalledWith(sampleProjectId);
    });

    it('should get cross-document navigation links', async () => {
      const sampleNavLinks: CrossDocumentNavigationLink[] = [{
        id: 'nav-1',
        crossReferenceId: 'ref-1',
        sourceDocumentId: 'doc-1',
        targetDocumentId: 'doc-2',
        sourceCoordinates: { x: 100, y: 100 },
        navigationLabel: 'Test Link',
        linkType: 'reference',
        isActive: true,
        createdAt: new Date()
      }];

      jest.spyOn(multiDocRepository, 'getCrossDocumentNavigationLinksByProject').mockResolvedValue(sampleNavLinks);

      const result = await service.getCrossDocumentNavigationLinks(sampleProjectId);

      expect(result).toEqual(sampleNavLinks);
      expect(multiDocRepository.getCrossDocumentNavigationLinksByProject).toHaveBeenCalledWith(sampleProjectId);
    });

    it('should cleanup multi-document references', async () => {
      jest.spyOn(multiDocRepository, 'cleanupMultiDocumentReferences').mockResolvedValue(5);

      const result = await service.cleanupMultiDocumentReferences(sampleProjectId);

      expect(result).toBe(5);
      expect(multiDocRepository.cleanupMultiDocumentReferences).toHaveBeenCalledWith(sampleProjectId);
    });
  });
});

// Run additional integration tests
describe('MultiDocumentReferenceService Integration Tests', () => {
  let service: MultiDocumentReferenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
    service = new MultiDocumentReferenceService(mockPool);
  });

  it('should handle complex multi-document analysis workflow', async () => {
    // This test would verify the complete workflow from analysis to navigation link creation
    // In a real scenario, this would use test database or more sophisticated mocking
    
    const request: AnalyzeMultiDocumentReferencesRequest = {
      sessionId: 'session-test',
      projectId: 'project-test',
      documentIds: ['doc-1', 'doc-2', 'doc-3'],
      checkIntegrity: true,
      matchingConfig: {
        exactMatchOnly: false,
        minimumConfidence: 0.7
      }
    };

    // Mock all the dependent operations
    const multiDocRepository = (service as any).multiDocRepository;
    jest.spyOn(multiDocRepository, 'updateProjectIntegrationStatus').mockResolvedValue(undefined);
    jest.spyOn(multiDocRepository, 'createOrUpdateProjectCrossReferenceMap').mockResolvedValue({
      id: 'map-1',
      projectId: request.projectId,
      totalDocuments: 3,
      totalCrossReferences: 0,
      integrationStatus: 'completed',
      createdAt: new Date(),
      updatedAt: new Date()
    } as ProjectCrossReferenceMap);

    const crossPageDetector = (service as any).crossPageDetector;
    jest.spyOn(crossPageDetector, 'detectCrossPageReferences').mockResolvedValue({
      sessionId: request.sessionId,
      documentId: 'doc-1',
      detectedReferences: [],
      crossPageLinks: [],
      continuationSymbols: [],
      processingTime: 100,
      confidence: 0.9,
      timestamp: new Date()
    });

    const result = await service.analyzeMultiDocumentReferences(request);

    expect(result.success).toBe(true);
    expect(result.projectId).toBe(request.projectId);
  });
});