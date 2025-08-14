/**
 * Multi-Document Reference Repository Tests
 * 
 * Unit tests for multi-document reference repository operations including
 * document relationships, project maps, integrity checks, and navigation links.
 * 
 * Story: 4.4 Cross-Reference Engine
 * Task: 4.4.3 Build Multi-Document Reference System
 */

import { Pool } from 'pg';
import { MultiDocumentReferenceRepository } from '../multi-document-reference.repository';
import {
  DocumentRelationshipType,
  ReferenceIntegrityStatus,
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

describe('MultiDocumentReferenceRepository', () => {
  let repository: MultiDocumentReferenceRepository;

  // Sample test data
  const sampleProjectId = 'project-123';
  const sampleDocumentId1 = 'doc-1';
  const sampleDocumentId2 = 'doc-2';

  const sampleDocumentRelationshipRow = {
    id: 'rel-1',
    project_id: sampleProjectId,
    source_document_id: sampleDocumentId1,
    target_document_id: sampleDocumentId2,
    relationship_type: 'main_to_detail',
    relationship_strength: '0.85',
    reference_count: 5,
    last_updated: new Date(),
    created_at: new Date()
  };

  const sampleProjectMapRow = {
    id: 'map-1',
    project_id: sampleProjectId,
    project_name: 'Test Project',
    total_documents: 3,
    total_cross_references: 15,
    integration_status: 'completed',
    last_analysis_at: new Date(),
    error_message: null,
    created_at: new Date(),
    updated_at: new Date()
  };

  const sampleIntegrityCheckRow = {
    id: 'check-1',
    project_id: sampleProjectId,
    document_id: sampleDocumentId1,
    reference_designation: 'R1',
    integrity_status: 'duplicate',
    affected_documents: ['doc-1', 'doc-2'],
    last_checked_at: new Date(),
    resolution_status: 'unresolved',
    resolution_notes: null,
    created_at: new Date()
  };

  const sampleGlobalComponentRow = {
    id: 'gc-1',
    project_id: sampleProjectId,
    reference_designation: 'R1',
    component_type: 'resistor',
    primary_document_id: sampleDocumentId1,
    primary_page_number: 1,
    occurrence_count: 3,
    related_documents: ['doc-1', 'doc-2'],
    specifications: '{"resistance": "10kΩ"}',
    last_updated: new Date(),
    created_at: new Date()
  };

  const sampleNavigationLinkRow = {
    id: 'nav-1',
    cross_reference_id: 'ref-1',
    source_document_id: sampleDocumentId1,
    target_document_id: sampleDocumentId2,
    source_coordinates: '{"x": 100, "y": 100}',
    target_coordinates: '{"x": 200, "y": 200}',
    navigation_label: 'R1 Detail',
    link_type: 'detail',
    is_active: true,
    created_at: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockPool.connect.mockResolvedValue(mockClient);
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });

    repository = new MultiDocumentReferenceRepository(mockPool);
  });

  describe('createDocumentRelationship', () => {
    it('should create document relationship successfully', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [sampleDocumentRelationshipRow],
        rowCount: 1
      });

      const result = await repository.createDocumentRelationship(
        sampleProjectId,
        sampleDocumentId1,
        sampleDocumentId2,
        'main_to_detail' as DocumentRelationshipType
      );

      expect(result.id).toBe('rel-1');
      expect(result.relationshipType).toBe('main_to_detail');
      expect(result.relationshipStrength).toBe(0.85);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO electrical_analysis.document_relationships'),
        expect.arrayContaining([sampleProjectId, sampleDocumentId1, sampleDocumentId2, 'main_to_detail'])
      );
    });

    it('should handle database error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.createDocumentRelationship(
        sampleProjectId,
        sampleDocumentId1,
        sampleDocumentId2,
        'main_to_detail' as DocumentRelationshipType
      )).rejects.toThrow(CrossPageReferenceError);
    });
  });

  describe('getDocumentRelationshipsByProject', () => {
    it('should return document relationships for project', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [sampleDocumentRelationshipRow],
        rowCount: 1
      });

      const result = await repository.getDocumentRelationshipsByProject(sampleProjectId);

      expect(result).toHaveLength(1);
      expect(result[0].projectId).toBe(sampleProjectId);
      expect(result[0].relationshipType).toBe('main_to_detail');
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, project_id'),
        [sampleProjectId]
      );
    });

    it('should return empty array when no relationships found', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      const result = await repository.getDocumentRelationshipsByProject(sampleProjectId);

      expect(result).toHaveLength(0);
    });

    it('should handle database error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.getDocumentRelationshipsByProject(sampleProjectId))
        .rejects.toThrow(CrossPageReferenceError);
    });
  });

  describe('createOrUpdateProjectCrossReferenceMap', () => {
    it('should create project cross-reference map', async () => {
      // Mock document count query
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [sampleProjectMapRow], rowCount: 1 });

      const result = await repository.createOrUpdateProjectCrossReferenceMap(
        sampleProjectId,
        'Test Project'
      );

      expect(result.projectId).toBe(sampleProjectId);
      expect(result.projectName).toBe('Test Project');
      expect(result.totalDocuments).toBe(3);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO electrical_analysis.project_cross_reference_maps'),
        expect.arrayContaining([sampleProjectId, 'Test Project', 3])
      );
    });

    it('should update existing project map', async () => {
      // Mock document count query
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }], rowCount: 1 })
        .mockResolvedValueOnce({ 
          rows: [{ ...sampleProjectMapRow, total_documents: 5 }], 
          rowCount: 1 
        });

      const result = await repository.createOrUpdateProjectCrossReferenceMap(
        sampleProjectId,
        'Updated Project',
        5
      );

      expect(result.totalDocuments).toBe(5);
    });

    it('should handle database error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.createOrUpdateProjectCrossReferenceMap(sampleProjectId))
        .rejects.toThrow(CrossPageReferenceError);
    });
  });

  describe('getProjectCrossReferenceMap', () => {
    it('should return project cross-reference map', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [sampleProjectMapRow],
        rowCount: 1
      });

      const result = await repository.getProjectCrossReferenceMap(sampleProjectId);

      expect(result).not.toBeNull();
      expect(result!.projectId).toBe(sampleProjectId);
      expect(result!.integrationStatus).toBe('completed');
    });

    it('should return null when project map not found', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      const result = await repository.getProjectCrossReferenceMap(sampleProjectId);

      expect(result).toBeNull();
    });

    it('should handle database error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.getProjectCrossReferenceMap(sampleProjectId))
        .rejects.toThrow(CrossPageReferenceError);
    });
  });

  describe('updateProjectIntegrationStatus', () => {
    it('should update project integration status', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1
      });

      await repository.updateProjectIntegrationStatus(sampleProjectId, 'processing');

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE electrical_analysis.project_cross_reference_maps'),
        [sampleProjectId, 'processing', undefined]
      );
    });

    it('should update status with error message', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 1
      });

      await repository.updateProjectIntegrationStatus(
        sampleProjectId, 
        'error', 
        'Integration failed'
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE electrical_analysis.project_cross_reference_maps'),
        [sampleProjectId, 'error', 'Integration failed']
      );
    });

    it('should handle database error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.updateProjectIntegrationStatus(sampleProjectId, 'processing'))
        .rejects.toThrow(CrossPageReferenceError);
    });
  });

  describe('createReferenceIntegrityCheck', () => {
    it('should create reference integrity check', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [sampleIntegrityCheckRow],
        rowCount: 1
      });

      const result = await repository.createReferenceIntegrityCheck(
        sampleProjectId,
        sampleDocumentId1,
        'R1',
        'duplicate' as ReferenceIntegrityStatus,
        ['doc-1', 'doc-2']
      );

      expect(result.referenceDesignation).toBe('R1');
      expect(result.integrityStatus).toBe('duplicate');
      expect(result.affectedDocuments).toEqual(['doc-1', 'doc-2']);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO electrical_analysis.reference_integrity_checks'),
        expect.arrayContaining([sampleProjectId, sampleDocumentId1, 'R1', 'duplicate'])
      );
    });

    it('should handle database error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.createReferenceIntegrityCheck(
        sampleProjectId,
        sampleDocumentId1,
        'R1',
        'duplicate' as ReferenceIntegrityStatus
      )).rejects.toThrow(CrossPageReferenceError);
    });
  });

  describe('getReferenceIntegrityChecksByProject', () => {
    it('should return integrity checks for project', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [sampleIntegrityCheckRow],
        rowCount: 1
      });

      const result = await repository.getReferenceIntegrityChecksByProject(sampleProjectId);

      expect(result).toHaveLength(1);
      expect(result[0].referenceDesignation).toBe('R1');
      expect(result[0].integrityStatus).toBe('duplicate');
    });

    it('should filter unresolved checks only', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [sampleIntegrityCheckRow],
        rowCount: 1
      });

      await repository.getReferenceIntegrityChecksByProject(sampleProjectId, true);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("AND resolution_status = 'unresolved'"),
        [sampleProjectId]
      );
    });

    it('should handle database error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.getReferenceIntegrityChecksByProject(sampleProjectId))
        .rejects.toThrow(CrossPageReferenceError);
    });
  });

  describe('runReferenceIntegrityAnalysis', () => {
    it('should run reference integrity analysis', async () => {
      const analysisResults = [
        {
          designation: 'R1',
          status: 'duplicate',
          affected_docs: ['doc-1', 'doc-2'],
          issue_count: 2
        }
      ];

      mockClient.query.mockResolvedValueOnce({
        rows: analysisResults,
        rowCount: 1
      });

      const result = await repository.runReferenceIntegrityAnalysis(sampleProjectId);

      expect(result).toHaveLength(1);
      expect(result[0].designation).toBe('R1');
      expect(result[0].status).toBe('duplicate');
      expect(result[0].affectedDocs).toEqual(['doc-1', 'doc-2']);
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT * FROM check_reference_integrity($1)',
        [sampleProjectId]
      );
    });

    it('should handle database error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.runReferenceIntegrityAnalysis(sampleProjectId))
        .rejects.toThrow(CrossPageReferenceError);
    });
  });

  describe('getGlobalComponentRegistryByProject', () => {
    it('should return global component registry', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [sampleGlobalComponentRow],
        rowCount: 1
      });

      const result = await repository.getGlobalComponentRegistryByProject(sampleProjectId);

      expect(result).toHaveLength(1);
      expect(result[0].referenceDesignation).toBe('R1');
      expect(result[0].occurrenceCount).toBe(3);
      expect(result[0].specifications).toEqual({ resistance: '10kΩ' });
    });

    it('should handle empty registry', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      });

      const result = await repository.getGlobalComponentRegistryByProject(sampleProjectId);

      expect(result).toHaveLength(0);
    });

    it('should handle database error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.getGlobalComponentRegistryByProject(sampleProjectId))
        .rejects.toThrow(CrossPageReferenceError);
    });
  });

  describe('createCrossDocumentNavigationLink', () => {
    it('should create cross-document navigation link', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [sampleNavigationLinkRow],
        rowCount: 1
      });

      const result = await repository.createCrossDocumentNavigationLink(
        'ref-1',
        sampleDocumentId1,
        sampleDocumentId2,
        { x: 100, y: 100 },
        'R1 Detail',
        { x: 200, y: 200 },
        'detail'
      );

      expect(result.navigationLabel).toBe('R1 Detail');
      expect(result.linkType).toBe('detail');
      expect(result.sourceCoordinates).toEqual({ x: 100, y: 100 });
      expect(result.targetCoordinates).toEqual({ x: 200, y: 200 });
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO electrical_analysis.cross_document_navigation_links'),
        expect.arrayContaining([
          'ref-1',
          sampleDocumentId1,
          sampleDocumentId2,
          '{"x":100,"y":100}',
          '{"x":200,"y":200}',
          'R1 Detail',
          'detail'
        ])
      );
    });

    it('should handle database error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.createCrossDocumentNavigationLink(
        'ref-1',
        sampleDocumentId1,
        sampleDocumentId2,
        { x: 100, y: 100 },
        'R1 Detail'
      )).rejects.toThrow(CrossPageReferenceError);
    });
  });

  describe('getCrossDocumentNavigationLinksByProject', () => {
    it('should return cross-document navigation links', async () => {
      // Mock the join query result
      const joinedRow = {
        ...sampleNavigationLinkRow,
        // Would include joined document project_id from the query
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [joinedRow],
        rowCount: 1
      });

      const result = await repository.getCrossDocumentNavigationLinksByProject(sampleProjectId);

      expect(result).toHaveLength(1);
      expect(result[0].navigationLabel).toBe('R1 Detail');
      expect(result[0].isActive).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN electrical_analysis.documents d ON d.id = cdnl.source_document_id'),
        [sampleProjectId]
      );
    });

    it('should filter active links only', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [sampleNavigationLinkRow],
        rowCount: 1
      });

      await repository.getCrossDocumentNavigationLinksByProject(sampleProjectId, true);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('AND cdnl.is_active = true'),
        [sampleProjectId]
      );
    });

    it('should handle database error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.getCrossDocumentNavigationLinksByProject(sampleProjectId))
        .rejects.toThrow(CrossPageReferenceError);
    });
  });

  describe('cleanupMultiDocumentReferences', () => {
    it('should cleanup multi-document references', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ cleanup_multi_document_references: 5 }],
        rowCount: 1
      });

      const result = await repository.cleanupMultiDocumentReferences(sampleProjectId);

      expect(result).toBe(5);
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT cleanup_multi_document_references($1)',
        [sampleProjectId]
      );
    });

    it('should handle database error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(repository.cleanupMultiDocumentReferences(sampleProjectId))
        .rejects.toThrow(CrossPageReferenceError);
    });
  });

  describe('mapping methods', () => {
    it('should map document relationship row correctly', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [sampleDocumentRelationshipRow],
        rowCount: 1
      });

      const result = await repository.createDocumentRelationship(
        sampleProjectId,
        sampleDocumentId1,
        sampleDocumentId2,
        'main_to_detail' as DocumentRelationshipType
      );

      expect(result).toEqual({
        id: 'rel-1',
        projectId: sampleProjectId,
        sourceDocumentId: sampleDocumentId1,
        targetDocumentId: sampleDocumentId2,
        relationshipType: 'main_to_detail',
        relationshipStrength: 0.85,
        referenceCount: 5,
        lastUpdated: sampleDocumentRelationshipRow.last_updated,
        createdAt: sampleDocumentRelationshipRow.created_at
      });
    });

    it('should map project cross-reference map row correctly', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [sampleProjectMapRow], rowCount: 1 });

      const result = await repository.createOrUpdateProjectCrossReferenceMap(sampleProjectId);

      expect(result).toEqual({
        id: 'map-1',
        projectId: sampleProjectId,
        projectName: 'Test Project',
        totalDocuments: 3,
        totalCrossReferences: 15,
        integrationStatus: 'completed',
        lastAnalysisAt: sampleProjectMapRow.last_analysis_at,
        errorMessage: null,
        createdAt: sampleProjectMapRow.created_at,
        updatedAt: sampleProjectMapRow.updated_at
      });
    });

    it('should map reference integrity check row correctly', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [sampleIntegrityCheckRow],
        rowCount: 1
      });

      const result = await repository.createReferenceIntegrityCheck(
        sampleProjectId,
        sampleDocumentId1,
        'R1',
        'duplicate' as ReferenceIntegrityStatus
      );

      expect(result).toEqual({
        id: 'check-1',
        projectId: sampleProjectId,
        documentId: sampleDocumentId1,
        referenceDesignation: 'R1',
        integrityStatus: 'duplicate',
        affectedDocuments: ['doc-1', 'doc-2'],
        lastCheckedAt: sampleIntegrityCheckRow.last_checked_at,
        resolutionStatus: 'unresolved',
        resolutionNotes: null,
        createdAt: sampleIntegrityCheckRow.created_at
      });
    });

    it('should map global component registry row correctly', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [sampleGlobalComponentRow],
        rowCount: 1
      });

      const result = await repository.getGlobalComponentRegistryByProject(sampleProjectId);

      expect(result[0]).toEqual({
        id: 'gc-1',
        projectId: sampleProjectId,
        referenceDesignation: 'R1',
        componentType: 'resistor',
        primaryDocumentId: sampleDocumentId1,
        primaryPageNumber: 1,
        occurrenceCount: 3,
        relatedDocuments: ['doc-1', 'doc-2'],
        specifications: { resistance: '10kΩ' },
        lastUpdated: sampleGlobalComponentRow.last_updated,
        createdAt: sampleGlobalComponentRow.created_at
      });
    });

    it('should map cross-document navigation link row correctly', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [sampleNavigationLinkRow],
        rowCount: 1
      });

      const result = await repository.createCrossDocumentNavigationLink(
        'ref-1',
        sampleDocumentId1,
        sampleDocumentId2,
        { x: 100, y: 100 },
        'R1 Detail'
      );

      expect(result).toEqual({
        id: 'nav-1',
        crossReferenceId: 'ref-1',
        sourceDocumentId: sampleDocumentId1,
        targetDocumentId: sampleDocumentId2,
        sourceCoordinates: { x: 100, y: 100 },
        targetCoordinates: { x: 200, y: 200 },
        navigationLabel: 'R1 Detail',
        linkType: 'detail',
        isActive: true,
        createdAt: sampleNavigationLinkRow.created_at
      });
    });
  });

  describe('connection management', () => {
    it('should properly release database connections on success', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [sampleDocumentRelationshipRow],
        rowCount: 1
      });

      await repository.createDocumentRelationship(
        sampleProjectId,
        sampleDocumentId1,
        sampleDocumentId2,
        'main_to_detail' as DocumentRelationshipType
      );

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should properly release database connections on error', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database error'));

      try {
        await repository.createDocumentRelationship(
          sampleProjectId,
          sampleDocumentId1,
          sampleDocumentId2,
          'main_to_detail' as DocumentRelationshipType
        );
      } catch (error) {
        // Expected to throw
      }

      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});