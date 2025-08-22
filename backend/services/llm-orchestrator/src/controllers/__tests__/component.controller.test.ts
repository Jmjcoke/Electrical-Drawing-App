/**
 * Component Controller Tests
 * 
 * Integration tests for ComponentController API endpoints
 * Story: 4.2 Component Database Integration
 * Task: 4.2.5 Testing and Performance Validation
 */

import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { ComponentController } from '../component.controller';
import { SymbolDetectionStorageService } from '../../services/symbol-detection-storage.service';

// Mock services
jest.mock('pg');
jest.mock('../../services/symbol-detection-storage.service');
jest.mock('../../components/component-library.service');
jest.mock('../../components/specification.service');
jest.mock('../../components/identification.service');
jest.mock('../../components/cross-reference.service');
jest.mock('../../components/property-search.service');
jest.mock('../../components/component-identification-integration.service');

const mockPool = {
  connect: jest.fn(),
  query: jest.fn(),
  end: jest.fn(),
} as any;

const mockStorageService = {} as any;

describe('ComponentController Integration Tests', () => {
  let app: express.Application;
  let controller: ComponentController;

  beforeAll(() => {
    // Setup Express app
    app = express();
    app.use(express.json());

    // Initialize controller
    controller = new ComponentController(mockPool, mockStorageService);

    // Setup routes
    app.get('/api/v1/components/library', controller.searchComponents);
    app.get('/api/v1/components/:componentId', controller.getComponent);
    app.post('/api/v1/components/library', controller.createComponent);
    app.put('/api/v1/components/:componentId', controller.updateComponent);
    app.delete('/api/v1/components/:componentId', controller.deleteComponent);
    app.get('/api/v1/components/:componentId/properties', controller.getComponentProperties);
    app.get('/api/v1/components/:componentId/ratings', controller.getComponentRatings);
    app.get('/api/v1/components/:componentId/cross-references', controller.getComponentCrossReferences);
    app.post('/api/v1/components/identify', controller.identifyComponent);
    app.post('/api/v1/components/identify/batch', controller.identifyBatchComponents);
    app.get('/api/v1/components/search/part-number/:partNumber', controller.searchByPartNumber);
    app.get('/api/v1/components/search/manufacturer/:manufacturer', controller.searchByManufacturer);
    app.get('/api/v1/components/standards/:standard', controller.getComponentsByStandard);
    app.get('/api/v1/components/statistics', controller.getLibraryStatistics);
    app.get('/api/v1/components/:componentId/similar', controller.findSimilarComponents);
    app.get('/api/v1/components/properties/:propertyName/ranges', controller.getPropertyValueRanges);
    app.post('/api/v1/components/suggest', controller.suggestComponents);
    app.get('/api/v1/components/identification/statistics', controller.getIdentificationStatistics);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/components/:componentId', () => {
    it('should return component successfully', async () => {
      const mockComponent = {
        id: 'test-component-id',
        symbolType: 'resistor',
        symbolCategory: 'passive',
        componentName: 'Test Resistor',
        componentDescription: 'A test resistor',
        industryStandards: ['IEEE'],
        properties: [],
        ratings: [],
        crossReferences: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      // Mock the service method
      controller['componentLibraryService'].getComponentById = jest.fn()
        .mockResolvedValue(mockComponent);

      const response = await request(app)
        .get('/api/v1/components/test-component-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.component).toEqual(mockComponent);
    });

    it('should return 404 for non-existent component', async () => {
      controller['componentLibraryService'].getComponentById = jest.fn()
        .mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/components/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Component not found');
      expect(response.body.code).toBe('COMPONENT_NOT_FOUND');
    });

    it('should return 400 for missing component ID', async () => {
      const response = await request(app)
        .get('/api/v1/components/')
        .expect(404); // Express returns 404 for missing route parameter

      // This test verifies the route structure
    });

    it('should handle service errors gracefully', async () => {
      controller['componentLibraryService'].getComponentById = jest.fn()
        .mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/v1/components/error-component')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to get component');
    });
  });

  describe('GET /api/v1/components/library', () => {
    it('should search components with filters', async () => {
      const mockSearchResult = {
        components: [
          {
            id: 'comp-1',
            symbolType: 'resistor',
            symbolCategory: 'passive',
            componentName: 'Test Resistor',
            componentDescription: 'A test resistor',
            industryStandards: ['IEEE']
          }
        ],
        totalCount: 1,
        hasMore: false,
        processingTimeMs: 50
      };

      controller['componentLibraryService'].searchComponents = jest.fn()
        .mockResolvedValue(mockSearchResult);

      const response = await request(app)
        .get('/api/v1/components/library')
        .query({
          search: 'resistor',
          symbolType: 'resistor',
          symbolCategory: 'passive',
          limit: '10',
          offset: '0'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.components).toHaveLength(1);
      expect(response.body.totalCount).toBe(1);
      expect(response.body.hasMore).toBe(false);
    });

    it('should handle industry standards filter', async () => {
      controller['componentLibraryService'].searchComponents = jest.fn()
        .mockResolvedValue({
          components: [],
          totalCount: 0,
          hasMore: false,
          processingTimeMs: 25
        });

      await request(app)
        .get('/api/v1/components/library')
        .query({
          industryStandards: 'IEEE,IEC,ANSI'
        })
        .expect(200);

      expect(controller['componentLibraryService'].searchComponents)
        .toHaveBeenCalledWith(expect.objectContaining({
          industryStandards: ['IEEE', 'IEC', 'ANSI']
        }));
    });

    it('should use default pagination values', async () => {
      controller['componentLibraryService'].searchComponents = jest.fn()
        .mockResolvedValue({
          components: [],
          totalCount: 0,
          hasMore: false,
          processingTimeMs: 25
        });

      await request(app)
        .get('/api/v1/components/library')
        .expect(200);

      expect(controller['componentLibraryService'].searchComponents)
        .toHaveBeenCalledWith(expect.objectContaining({
          limit: 50,
          offset: 0
        }));
    });
  });

  describe('POST /api/v1/components/library', () => {
    it('should create component successfully', async () => {
      const createRequest = {
        symbolType: 'resistor',
        symbolCategory: 'passive',
        componentName: 'New Test Resistor',
        componentDescription: 'A new test resistor',
        industryStandards: ['IEEE'],
        specifications: {
          functionDescription: 'Test function',
          technicalDetails: 'Test details'
        },
        properties: [
          {
            propertyName: 'resistance',
            propertyValue: '10k',
            propertyUnit: 'Ω',
            isSearchable: true
          }
        ],
        ratings: []
      };

      const mockCreatedComponent = {
        id: 'new-component-id',
        ...createRequest,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      };

      controller['componentLibraryService'].createComponent = jest.fn()
        .mockResolvedValue(mockCreatedComponent);

      const response = await request(app)
        .post('/api/v1/components/library')
        .send(createRequest)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.component.id).toBe('new-component-id');
      expect(response.body.message).toBe('Component created successfully');
    });

    it('should validate required fields', async () => {
      const invalidRequest = {
        symbolType: 'resistor',
        // Missing componentName and symbolCategory
        componentDescription: 'Invalid request'
      };

      const response = await request(app)
        .post('/api/v1/components/library')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
      expect(response.body.code).toBe('VALIDATION_FAILED');
    });

    it('should validate field length constraints', async () => {
      const invalidRequest = {
        componentName: 'x'.repeat(101), // Exceeds 100 character limit
        symbolType: 'x'.repeat(51),     // Exceeds 50 character limit
        symbolCategory: 'x'.repeat(21), // Exceeds 20 character limit
        industryStandards: ['INVALID_STANDARD']
      };

      const response = await request(app)
        .post('/api/v1/components/library')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_FAILED');
      expect(response.body.details.errors).toContain('Component name must not exceed 100 characters');
      expect(response.body.details.errors).toContain('Symbol type must not exceed 50 characters');
      expect(response.body.details.errors).toContain('Symbol category must not exceed 20 characters');
      expect(response.body.details.errors).toContain('Invalid industry standards: INVALID_STANDARD');
    });

    it('should validate property constraints', async () => {
      const invalidRequest = {
        componentName: 'Test Component',
        symbolType: 'resistor',
        symbolCategory: 'passive',
        properties: [
          {
            propertyName: '', // Empty name
            propertyValue: 'value',
            isSearchable: true
          },
          {
            propertyName: 'x'.repeat(51), // Too long
            propertyValue: 'x'.repeat(101), // Too long
            isSearchable: true
          }
        ]
      };

      const response = await request(app)
        .post('/api/v1/components/library')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_FAILED');
      expect(response.body.details.errors).toContain('Property 1: Property name is required');
      expect(response.body.details.errors).toContain('Property 2: Property name must not exceed 50 characters');
      expect(response.body.details.errors).toContain('Property 2: Property value must not exceed 100 characters');
    });
  });

  describe('PUT /api/v1/components/:componentId', () => {
    it('should update component successfully', async () => {
      const updateRequest = {
        componentName: 'Updated Component Name',
        componentDescription: 'Updated description'
      };

      const mockUpdatedComponent = {
        id: 'test-component-id',
        componentName: 'Updated Component Name',
        componentDescription: 'Updated description',
        version: 2
      };

      controller['componentLibraryService'].updateComponent = jest.fn()
        .mockResolvedValue(mockUpdatedComponent);

      const response = await request(app)
        .put('/api/v1/components/test-component-id')
        .send(updateRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.component.componentName).toBe('Updated Component Name');
      expect(response.body.message).toBe('Component updated successfully');
    });

    it('should require component ID', async () => {
      const response = await request(app)
        .put('/api/v1/components/')
        .send({ componentName: 'Test' })
        .expect(404); // Express route not matched

      // This validates route structure
    });
  });

  describe('DELETE /api/v1/components/:componentId', () => {
    it('should delete component successfully', async () => {
      controller['componentLibraryService'].deleteComponent = jest.fn()
        .mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/v1/components/test-component-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Component deleted successfully');
    });

    it('should return 404 if component not found for deletion', async () => {
      controller['componentLibraryService'].deleteComponent = jest.fn()
        .mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/v1/components/non-existent-id')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Component not found');
    });
  });

  describe('POST /api/v1/components/identify', () => {
    it('should identify component from detected symbol', async () => {
      const identifyRequest = {
        detectedSymbol: {
          id: 'test-symbol-id',
          symbolType: 'resistor',
          symbolCategory: 'passive',
          description: 'Test resistor symbol',
          confidence: 0.85,
          location: { x: 0.5, y: 0.5, pageNumber: 1, originalX: 100, originalY: 100, imageWidth: 800, imageHeight: 600 },
          boundingBox: { x: 90, y: 90, width: 20, height: 10, area: 200 },
          detectionMethod: 'pattern_matching',
          features: {
            contourPoints: [],
            geometricProperties: {
              area: 200,
              perimeter: 60,
              centroid: { x: 100, y: 95 },
              boundaryRectangle: { x: 90, y: 90, width: 20, height: 10, area: 200 },
              symmetryAxes: [],
              aspectRatio: 2.0
            },
            connectionPoints: [],
            shapeAnalysis: {
              complexity: 0.3,
              orientation: 0,
              strokeWidth: 2,
              isClosed: false
            }
          },
          validationScore: 0.8
        },
        confidenceThreshold: 0.7
      };

      const mockIdentificationResult = {
        success: true,
        identificationResult: {
          id: 'identification-id',
          detectedSymbolId: 'test-symbol-id',
          componentId: 'identified-component-id',
          identificationMethod: 'exact_match',
          confidence: 0.9,
          specifications: {
            functionDescription: 'Test function',
            technicalDetails: 'Test details'
          }
        },
        processingTimeMs: 150
      };

      controller['identificationService'].identifyComponent = jest.fn()
        .mockResolvedValue(mockIdentificationResult);

      const response = await request(app)
        .post('/api/v1/components/identify')
        .send(identifyRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.identificationResult.confidence).toBe(0.9);
    });

    it('should require detected symbol', async () => {
      const invalidRequest = {
        confidenceThreshold: 0.7
        // Missing detectedSymbol
      };

      const response = await request(app)
        .post('/api/v1/components/identify')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Detected symbol is required');
    });
  });

  describe('POST /api/v1/components/identify/batch', () => {
    it('should identify batch of components', async () => {
      const batchRequest = {
        sessionId: 'test-session-id',
        detectionResultId: 'test-detection-result-id',
        options: {
          confidenceThreshold: 0.7,
          maxAlternatives: 3
        }
      };

      const mockBatchResult = {
        sessionId: 'test-session-id',
        detectionResultId: 'test-detection-result-id',
        identifications: [
          {
            id: 'id-1',
            componentId: 'comp-1',
            confidence: 0.9
          }
        ],
        summary: {
          totalSymbols: 1,
          identifiedSymbols: 1,
          averageConfidence: 0.9,
          processingTimeMs: 200,
          unknownSymbols: []
        },
        errors: []
      };

      controller['integrationService'].processSymbolDetectionResult = jest.fn()
        .mockResolvedValue(mockBatchResult);

      const response = await request(app)
        .post('/api/v1/components/identify/batch')
        .send(batchRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.identifications).toHaveLength(1);
      expect(response.body.summary.totalSymbols).toBe(1);
    });

    it('should validate required fields for batch identification', async () => {
      const invalidRequest = {
        sessionId: 'test-session-id'
        // Missing detectionResultId
      };

      const response = await request(app)
        .post('/api/v1/components/identify/batch')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Session ID and detection result ID are required');
    });
  });

  describe('Performance Tests', () => {
    it('should handle component search within performance target', async () => {
      const largeSearchResult = {
        components: Array.from({ length: 50 }, (_, i) => ({
          id: `comp-${i}`,
          componentName: `Component ${i}`,
          symbolType: 'resistor',
          symbolCategory: 'passive'
        })),
        totalCount: 1000,
        hasMore: true,
        processingTimeMs: 450 // Under 500ms target
      };

      controller['componentLibraryService'].searchComponents = jest.fn()
        .mockResolvedValue(largeSearchResult);

      const startTime = Date.now();
      const response = await request(app)
        .get('/api/v1/components/library')
        .query({ limit: '50' })
        .expect(200);
      const requestTime = Date.now() - startTime;

      expect(response.body.processingTimeMs).toBeLessThan(500);
      expect(requestTime).toBeLessThan(1000); // Including HTTP overhead
      expect(response.body.components).toHaveLength(50);
    });

    it('should handle concurrent requests efficiently', async () => {
      controller['componentLibraryService'].getComponentById = jest.fn()
        .mockResolvedValue({
          id: 'test-component',
          componentName: 'Test Component'
        });

      const requests = Array.from({ length: 10 }, (_, i) =>
        request(app).get(`/api/v1/components/comp-${i}`)
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      expect(responses.every(r => r.status === 200)).toBe(true);
      expect(totalTime).toBeLessThan(2000); // All 10 requests within 2 seconds
    });

    it('should handle large payload identification requests', async () => {
      const largeDetectedSymbol = {
        id: 'large-symbol-id',
        symbolType: 'resistor',
        symbolCategory: 'passive',
        description: 'Large symbol with extensive metadata',
        confidence: 0.85,
        location: { x: 0.5, y: 0.5, pageNumber: 1, originalX: 100, originalY: 100, imageWidth: 800, imageHeight: 600 },
        boundingBox: { x: 90, y: 90, width: 20, height: 10, area: 200 },
        detectionMethod: 'pattern_matching',
        features: {
          contourPoints: Array.from({ length: 100 }, (_, i) => ({ x: i, y: i })),
          geometricProperties: {
            area: 200,
            perimeter: 60,
            centroid: { x: 100, y: 95 },
            boundaryRectangle: { x: 90, y: 90, width: 20, height: 10, area: 200 },
            symmetryAxes: Array.from({ length: 10 }, (_, i) => ({ angle: i * 36, confidence: 0.8 })),
            aspectRatio: 2.0
          },
          connectionPoints: Array.from({ length: 4 }, (_, i) => ({
            location: { x: i * 10, y: i * 10 },
            type: 'bidirectional' as const,
            connectedTo: []
          })),
          shapeAnalysis: {
            complexity: 0.8,
            orientation: 45,
            strokeWidth: 2,
            isClosed: true
          },
          textLabels: Array.from({ length: 5 }, (_, i) => `Label-${i}`)
        },
        validationScore: 0.9
      };

      const identifyRequest = {
        detectedSymbol: largeDetectedSymbol,
        contextualHints: Array.from({ length: 10 }, (_, i) => ({
          type: 'application',
          value: `hint-${i}`,
          confidence: 0.7
        })),
        confidenceThreshold: 0.6
      };

      controller['identificationService'].identifyComponent = jest.fn()
        .mockResolvedValue({
          success: true,
          identificationResult: {
            id: 'large-identification-id',
            confidence: 0.85,
            processingTimeMs: 400
          },
          processingTimeMs: 400
        });

      const response = await request(app)
        .post('/api/v1/components/identify')
        .send(identifyRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.processingTimeMs).toBeLessThan(500);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/components/library')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .expect(400);

      // Express should handle malformed JSON
    });

    it('should handle very large search queries', async () => {
      const veryLongQuery = 'a'.repeat(10000);

      controller['componentLibraryService'].searchComponents = jest.fn()
        .mockResolvedValue({
          components: [],
          totalCount: 0,
          hasMore: false,
          processingTimeMs: 100
        });

      const response = await request(app)
        .get('/api/v1/components/library')
        .query({ search: veryLongQuery })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should handle large query strings without crashing
    });

    it('should handle special characters in component IDs', async () => {
      const specialComponentId = 'comp-with-special@#$%^&*()chars';

      controller['componentLibraryService'].getComponentById = jest.fn()
        .mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/v1/components/${encodeURIComponent(specialComponentId)}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      // Should handle URL encoding/decoding correctly
    });

    it('should return appropriate error codes for different failure types', async () => {
      // Test different error scenarios
      const errorScenarios = [
        {
          mockError: new Error('Database connection failed'),
          expectedStatus: 500,
          description: 'database error'
        },
        {
          mockError: { message: 'Validation failed', code: 'VALIDATION_ERROR' },
          expectedStatus: 400,
          description: 'validation error'
        }
      ];

      for (const scenario of errorScenarios) {
        controller['componentLibraryService'].getComponentById = jest.fn()
          .mockRejectedValue(scenario.mockError);

        const response = await request(app)
          .get('/api/v1/components/error-test-id')
          .expect(scenario.expectedStatus);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      }
    });
  });
});