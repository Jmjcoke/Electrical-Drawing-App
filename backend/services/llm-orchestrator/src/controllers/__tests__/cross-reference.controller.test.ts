/**
 * Cross-Page Reference Controller Tests
 * 
 * Unit tests for the CrossPageReferenceController API endpoints.
 * Tests all cross-page reference operations including analysis and navigation.
 * 
 * Story: 4.4 Cross-Reference Engine
 * Task: 4.4.2 Implement Cross-Page Navigation Integration
 */

import { Request, Response } from 'express';
import { Pool } from 'pg';
import { CrossPageReferenceController } from '../cross-page-reference.controller';
import {
  CrossPageDetectionResult,
  CrossPageNavigationResponse,
  AnalyzeCrossPageReferencesResponse
} from '../../../../../shared/types/cross-page-reference.types';

// Mock dependencies
jest.mock('../cross-reference/cross-page-detector');
jest.mock('../cross-reference/reference-matcher.service');
jest.mock('../cross-reference/continuation-symbol.service');
jest.mock('../cross-reference/navigation.service');
jest.mock('../repositories/cross-page-reference.repository');

// Mock database pool
const mockPool = {
  connect: jest.fn(),
  query: jest.fn(),
  end: jest.fn()
} as unknown as Pool;

describe('CrossPageReferenceController', () => {
  let controller: CrossPageReferenceController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new CrossPageReferenceController(mockPool);
    
    mockRequest = {
      params: {},
      query: {},
      body: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeCrossPageReferences', () => {
    it('should analyze cross-page references successfully', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123' };
      mockRequest.body = { documentId: 'doc123' };

      const mockDetectionResult: CrossPageDetectionResult = {
        sessionId: 'session123',
        documentId: 'doc123',
        detectedReferences: [],
        crossPageLinks: [],
        continuationSymbols: [],
        processingTime: 100,
        confidence: 0.9,
        timestamp: new Date()
      };

      // Mock detector.detectCrossPageReferences
      (controller as any).detector.detectCrossPageReferences = jest.fn()
        .mockResolvedValue(mockDetectionResult);
      
      // Mock referenceMatcher.detectReferenceConflicts  
      (controller as any).referenceMatcher.detectReferenceConflicts = jest.fn()
        .mockResolvedValue([]);

      // Act
      await controller.analyzeCrossPageReferences(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          detectionResult: mockDetectionResult,
          conflicts: [],
          processingTime: expect.any(Number)
        })
      );
    });

    it('should return 400 when documentId is missing', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123' };
      mockRequest.body = {}; // Missing documentId

      // Act
      await controller.analyzeCrossPageReferences(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Document ID is required'
        })
      );
    });

    it('should handle detector errors gracefully', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123' };
      mockRequest.body = { documentId: 'doc123' };

      (controller as any).detector.detectCrossPageReferences = jest.fn()
        .mockRejectedValue(new Error('Detection failed'));

      // Act
      await controller.analyzeCrossPageReferences(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Detection failed'
        })
      );
    });
  });

  describe('getCrossPageReferences', () => {
    it('should get cross-page references successfully', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123' };
      mockRequest.query = { documentId: 'doc123' };

      const mockReferences = [
        {
          id: 'ref1',
          sourceComponentId: 'comp1',
          targetComponentId: 'comp2',
          referenceDesignation: 'R1',
          sourcePageNumber: 1,
          targetPageNumber: 2,
          sourceDocumentId: 'doc123',
          targetDocumentId: 'doc123',
          referenceType: 'component_continuation' as const,
          confidence: 0.9,
          createdAt: new Date()
        }
      ];

      (controller as any).repository.getCrossPageReferencesByDocument = jest.fn()
        .mockResolvedValue(mockReferences);

      // Act
      await controller.getCrossPageReferences(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        crossPageReferences: mockReferences,
        total: 1
      });
    });

    it('should return 400 when documentId is missing', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123' };
      mockRequest.query = {}; // Missing documentId

      // Act
      await controller.getCrossPageReferences(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Document ID is required'
      });
    });
  });

  describe('getReferencesByDesignation', () => {
    it('should find references by designation successfully', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123', designation: 'R1' };
      mockRequest.query = { documentId: 'doc123' };

      const mockComponentRefs = [
        {
          componentId: 'comp1',
          referenceDesignation: 'R1',
          pageNumber: 1,
          documentId: 'doc123',
          componentType: 'resistor',
          isMainReference: true,
          relatedReferences: []
        }
      ];

      const mockCrossPageLinks = [
        {
          id: 'ref1',
          sourceComponentId: 'comp1',
          targetComponentId: 'comp2',
          referenceDesignation: 'R1',
          sourcePageNumber: 1,
          targetPageNumber: 2,
          sourceDocumentId: 'doc123',
          targetDocumentId: 'doc123',
          referenceType: 'component_continuation' as const,
          confidence: 0.9,
          createdAt: new Date()
        }
      ];

      (controller as any).detector.findComponentsByDesignation = jest.fn()
        .mockResolvedValue(mockComponentRefs);
      
      (controller as any).repository.getCrossPageReferencesByDesignation = jest.fn()
        .mockResolvedValue(mockCrossPageLinks);
        
      (controller as any).navigationService.getNavigationLinksForPage = jest.fn()
        .mockResolvedValue([]);

      // Act
      await controller.getReferencesByDesignation(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          references: mockComponentRefs,
          crossPageLinks: mockCrossPageLinks,
          navigationLinks: []
        })
      );
    });
  });

  describe('getNavigationLink', () => {
    it('should get navigation link successfully', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123', referenceId: 'ref1' };
      mockRequest.query = { fromPage: '1', toPage: '2', documentId: 'doc123' };

      const mockNavigationResponse: CrossPageNavigationResponse = {
        success: true,
        navigationLink: {
          referenceId: 'ref1',
          sourceCoordinates: { x: 0.1, y: 0.2 },
          targetCoordinates: { x: 0.3, y: 0.4 },
          navigationLabel: 'R1 → Page 2',
          isActive: true
        }
      };

      (controller as any).navigationService.navigateToReference = jest.fn()
        .mockResolvedValue(mockNavigationResponse);

      // Act
      await controller.getNavigationLink(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockNavigationResponse);
    });

    it('should return 400 when required query params are missing', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123', referenceId: 'ref1' };
      mockRequest.query = { fromPage: '1' }; // Missing toPage and documentId

      // Act
      await controller.getNavigationLink(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'fromPage, toPage, and documentId are required'
        })
      );
    });
  });

  describe('createNavigationLink', () => {
    it('should create navigation link successfully', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123' };
      mockRequest.body = {
        referenceId: 'ref1',
        sourceCoordinates: { x: 0.1, y: 0.2 }
      };

      (controller as any).navigationService.activateNavigationLink = jest.fn()
        .mockReturnValue(true);
        
      (controller as any).navigationService.getActiveNavigationLinks = jest.fn()
        .mockReturnValue([
          {
            referenceId: 'ref1',
            sourceCoordinates: { x: 0.1, y: 0.2 },
            navigationLabel: 'Test Link',
            isActive: true
          }
        ]);

      // Act
      await controller.createNavigationLink(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          navigationLink: expect.objectContaining({
            referenceId: 'ref1',
            isActive: true
          })
        })
      );
    });

    it('should return 400 when required fields are missing', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123' };
      mockRequest.body = {}; // Missing required fields

      // Act
      await controller.createNavigationLink(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Reference ID and source coordinates are required'
        })
      );
    });
  });

  describe('getCrossPageReferenceStats', () => {
    it('should get statistics successfully', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123' };
      mockRequest.query = { documentId: 'doc123' };

      const mockStats = {
        totalReferences: 10,
        byReferenceType: { component_continuation: 5, detail_reference: 3, schematic_reference: 2 },
        byPagePairs: { '1-2': 4, '2-3': 3, '1-3': 3 },
        averageConfidence: 0.85,
        uniqueDesignations: 8
      };

      (controller as any).repository.getCrossPageReferenceStats = jest.fn()
        .mockResolvedValue(mockStats);

      // Act
      await controller.getCrossPageReferenceStats(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        sessionId: 'session123',
        documentId: 'doc123',
        statistics: mockStats
      });
    });
  });

  describe('validateReferenceConsistency', () => {
    it('should validate reference consistency successfully', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123' };
      mockRequest.body = { documentId: 'doc123' };

      const mockValidationResults = [
        {
          isValid: true,
          validationErrors: [],
          suggestions: [],
          confidenceScore: 0.9
        }
      ];

      const mockConflicts = [];

      (controller as any).referenceMatcher.validateReferenceConsistency = jest.fn()
        .mockResolvedValue(mockValidationResults);
        
      (controller as any).referenceMatcher.detectReferenceConflicts = jest.fn()
        .mockResolvedValue(mockConflicts);

      // Act
      await controller.validateReferenceConsistency(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        sessionId: 'session123',
        documentId: 'doc123',
        validationResults: mockValidationResults,
        conflicts: mockConflicts,
        totalIssues: 0
      });
    });

    it('should return 400 when documentId is missing', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123' };
      mockRequest.body = {}; // Missing documentId

      // Act
      await controller.validateReferenceConsistency(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Document ID is required'
      });
    });
  });

  describe('deleteCrossPageReference', () => {
    it('should delete cross-page reference successfully', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123', referenceId: 'ref1' };

      (controller as any).repository.deleteCrossPageReference = jest.fn()
        .mockResolvedValue(true);
        
      (controller as any).navigationService.deactivateNavigationLink = jest.fn()
        .mockReturnValue(true);

      // Act
      await controller.deleteCrossPageReference(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Cross-page reference deleted successfully'
      });
    });

    it('should return 404 when reference not found', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123', referenceId: 'ref1' };

      (controller as any).repository.deleteCrossPageReference = jest.fn()
        .mockResolvedValue(false);

      // Act
      await controller.deleteCrossPageReference(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Cross-page reference not found'
      });
    });
  });

  describe('cleanupOrphanedReferences', () => {
    it('should cleanup orphaned references successfully', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123' };
      mockRequest.body = { documentId: 'doc123' };

      (controller as any).repository.cleanupOrphanedReferences = jest.fn()
        .mockResolvedValue(5);

      // Act
      await controller.cleanupOrphanedReferences(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        sessionId: 'session123',
        documentId: 'doc123',
        deletedCount: 5,
        message: 'Cleaned up 5 orphaned references'
      });
    });
  });

  describe('getContinuationSymbols', () => {
    it('should get continuation symbols successfully', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123' };
      mockRequest.query = { documentId: 'doc123' };

      const mockContinuationSymbols = [
        {
          symbolType: 'arrow_right',
          componentId: 'comp1',
          pageNumber: 1,
          coordinates: { x: 0.5, y: 0.3 },
          confidence: 0.9
        }
      ];

      const mockStats = {
        totalSymbols: 1,
        byType: { arrow_right: 1 },
        byPage: { 1: 1 },
        averageConfidence: 0.9,
        crossPagePairs: 0
      };

      (controller as any).continuationService.detectContinuationSymbols = jest.fn()
        .mockResolvedValue(mockContinuationSymbols);
        
      (controller as any).continuationService.getContinuationSymbolStats = jest.fn()
        .mockResolvedValue(mockStats);

      // Act
      await controller.getContinuationSymbols(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        sessionId: 'session123',
        documentId: 'doc123',
        continuationSymbols: mockContinuationSymbols,
        statistics: mockStats
      });
    });

    it('should return 400 when documentId is missing', async () => {
      // Arrange
      mockRequest.params = { sessionId: 'session123' };
      mockRequest.query = {}; // Missing documentId

      // Act
      await controller.getContinuationSymbols(
        mockRequest as Request,
        mockResponse as Response
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Document ID is required'
      });
    });
  });
});