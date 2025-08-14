/**
 * Component Identification Service Tests
 * 
 * Unit tests for ComponentIdentificationService
 * Story: 4.2 Component Database Integration
 * Task: 4.2.5 Testing and Performance Validation
 */

import { Pool } from 'pg';
import { ComponentIdentificationService } from '../identification.service';
import { ComponentLibraryService } from '../component-library.service';
import { ComponentSpecificationService } from '../specification.service';
import {
  ComponentLookupRequest,
  ContextualHint,
  ComponentIdentificationError
} from '../../../../../shared/types/component-database.types';
import {
  DetectedSymbol,
  ElectricalSymbolType,
  SymbolCategory
} from '../../../../../shared/types/symbol-detection.types';

// Mock dependencies
jest.mock('../component-library.service');
jest.mock('../specification.service');
jest.mock('pg');
jest.mock('fuse.js');

const mockClient = {
  connect: jest.fn(),
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
} as any;

const mockComponentLibraryService = {
  getComponentById: jest.fn(),
  searchComponents: jest.fn(),
} as any;

const mockSpecificationService = {
  getSpecifications: jest.fn(),
} as any;

// Mock Fuse.js
const mockFuseSearch = jest.fn();
const MockFuse = jest.fn().mockImplementation(() => ({
  search: mockFuseSearch
}));

jest.mock('fuse.js', () => MockFuse);

describe('ComponentIdentificationService', () => {
  let service: ComponentIdentificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.release.mockResolvedValue(undefined);
    
    service = new ComponentIdentificationService(
      mockPool,
      mockComponentLibraryService,
      mockSpecificationService
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const createMockDetectedSymbol = (overrides: Partial<DetectedSymbol> = {}): DetectedSymbol => ({
    id: 'test-symbol-id',
    symbolType: 'resistor' as ElectricalSymbolType,
    symbolCategory: 'passive' as SymbolCategory,
    description: 'Test resistor symbol',
    confidence: 0.85,
    location: {
      x: 0.5,
      y: 0.5,
      pageNumber: 1,
      originalX: 100,
      originalY: 100,
      imageWidth: 800,
      imageHeight: 600
    },
    boundingBox: {
      x: 90,
      y: 90,
      width: 20,
      height: 10,
      area: 200
    },
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
      },
      textLabels: ['10kΩ']
    },
    validationScore: 0.8,
    ...overrides
  });

  const createMockComponent = (overrides: any = {}) => ({
    id: 'test-component-id',
    symbolType: 'resistor' as ElectricalSymbolType,
    symbolCategory: 'passive' as SymbolCategory,
    componentName: 'Test Resistor',
    componentDescription: 'A test resistor component',
    industryStandards: ['IEEE', 'IEC'],
    specifications: {
      id: 'spec-id',
      componentId: 'test-component-id',
      functionDescription: 'Provides electrical resistance',
      technicalDetails: 'Carbon film construction',
      createdAt: new Date()
    },
    properties: [
      {
        id: 'prop-1',
        componentId: 'test-component-id',
        propertyName: 'resistance',
        propertyValue: '10k',
        propertyUnit: 'Ω',
        isSearchable: true,
        createdAt: new Date()
      }
    ],
    ratings: [
      {
        id: 'rating-1',
        componentId: 'test-component-id',
        ratingType: 'power',
        nominalValue: 0.25,
        unit: 'W',
        createdAt: new Date()
      }
    ],
    crossReferences: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    version: 1,
    ...overrides
  });

  describe('identifyComponent', () => {
    it('should successfully identify a component with high confidence', async () => {
      const mockSymbol = createMockDetectedSymbol();
      const mockComponent = createMockComponent();

      const lookupRequest: ComponentLookupRequest = {
        detectedSymbol: mockSymbol,
        confidenceThreshold: 0.7,
        maxResults: 5
      };

      // Mock exact matches
      mockComponentLibraryService.searchComponents.mockResolvedValueOnce({
        components: [mockComponent],
        totalCount: 1
      });

      // Mock fuzzy search (empty for this test)
      mockFuseSearch.mockReturnValueOnce([]);

      // Mock property matches (empty for this test)
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      // Mock component retrieval
      mockComponentLibraryService.getComponentById.mockResolvedValueOnce(mockComponent);

      // Mock identification result storage
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'identification-id', created_at: new Date() }]
      });

      const response = await service.identifyComponent(lookupRequest);

      expect(response.success).toBe(true);
      expect(response.identificationResult).toBeDefined();
      expect(response.identificationResult.componentId).toBe('test-component-id');
      expect(response.identificationResult.confidence).toBeGreaterThan(0.7);
    });

    it('should handle unknown symbols gracefully', async () => {
      const mockSymbol = createMockDetectedSymbol({
        symbolType: 'unknown' as ElectricalSymbolType
      });

      const lookupRequest: ComponentLookupRequest = {
        detectedSymbol: mockSymbol,
        confidenceThreshold: 0.7
      };

      // Mock all searches returning empty results
      mockComponentLibraryService.searchComponents.mockResolvedValueOnce({
        components: [],
        totalCount: 0
      });
      mockFuseSearch.mockReturnValueOnce([]);
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const response = await service.identifyComponent(lookupRequest);

      expect(response.success).toBe(false);
      expect(response.error).toBe('No matching components found in database');
      expect(response.identificationResult.componentId).toBe('');
    });

    it('should use contextual hints to improve identification', async () => {
      const mockSymbol = createMockDetectedSymbol();
      const mockComponent = createMockComponent();

      const contextualHints: ContextualHint[] = [
        {
          type: 'voltage_level',
          value: '5',
          confidence: 0.8
        },
        {
          type: 'circuit_type',
          value: 'analog',
          confidence: 0.7
        }
      ];

      const lookupRequest: ComponentLookupRequest = {
        detectedSymbol: mockSymbol,
        contextualHints,
        confidenceThreshold: 0.5
      };

      mockComponentLibraryService.searchComponents.mockResolvedValueOnce({
        components: [mockComponent],
        totalCount: 1
      });
      mockFuseSearch.mockReturnValueOnce([]);
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockComponentLibraryService.getComponentById.mockResolvedValueOnce(mockComponent);
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'identification-id', created_at: new Date() }]
      });

      const response = await service.identifyComponent(lookupRequest);

      expect(response.success).toBe(true);
      // Contextual hints should improve confidence score
      expect(response.identificationResult.confidence).toBeGreaterThan(0.5);
    });

    it('should handle text label matching', async () => {
      const mockSymbol = createMockDetectedSymbol({
        features: {
          ...createMockDetectedSymbol().features,
          textLabels: ['10kΩ', 'R1']
        }
      });

      const mockComponent = createMockComponent({
        properties: [
          {
            id: 'prop-1',
            componentId: 'test-component-id',
            propertyName: 'resistance',
            propertyValue: '10k',
            propertyUnit: 'Ω',
            isSearchable: true,
            createdAt: new Date()
          }
        ]
      });

      const lookupRequest: ComponentLookupRequest = {
        detectedSymbol: mockSymbol
      };

      mockComponentLibraryService.searchComponents.mockResolvedValueOnce({
        components: [mockComponent],
        totalCount: 1
      });
      mockFuseSearch.mockReturnValueOnce([]);
      // Mock property matching query
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'test-component-id' }]
      });
      mockComponentLibraryService.getComponentById.mockResolvedValueOnce(mockComponent);
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'identification-id', created_at: new Date() }]
      });

      const response = await service.identifyComponent(lookupRequest);

      expect(response.success).toBe(true);
      expect(response.identificationResult.confidence).toBeGreaterThan(0.6);
    });

    it('should respect confidence threshold', async () => {
      const mockSymbol = createMockDetectedSymbol({
        confidence: 0.3 // Low confidence symbol
      });

      const mockComponent = createMockComponent();

      const lookupRequest: ComponentLookupRequest = {
        detectedSymbol: mockSymbol,
        confidenceThreshold: 0.8 // High threshold
      };

      mockComponentLibraryService.searchComponents.mockResolvedValueOnce({
        components: [mockComponent],
        totalCount: 1
      });
      mockFuseSearch.mockReturnValueOnce([]);
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const response = await service.identifyComponent(lookupRequest);

      expect(response.success).toBe(false);
      expect(response.error).toContain('confidence threshold');
    });

    it('should provide alternative matches', async () => {
      const mockSymbol = createMockDetectedSymbol();
      const primaryComponent = createMockComponent();
      const alternativeComponent = createMockComponent({
        id: 'alt-component-id',
        componentName: 'Alternative Resistor'
      });

      const lookupRequest: ComponentLookupRequest = {
        detectedSymbol: mockSymbol,
        maxResults: 2
      };

      mockComponentLibraryService.searchComponents.mockResolvedValueOnce({
        components: [primaryComponent, alternativeComponent],
        totalCount: 2
      });
      mockFuseSearch.mockReturnValueOnce([]);
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockComponentLibraryService.getComponentById.mockResolvedValueOnce(primaryComponent);
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'identification-id', created_at: new Date() }]
      });

      const response = await service.identifyComponent(lookupRequest);

      expect(response.success).toBe(true);
      expect(response.identificationResult.alternativeMatches).toBeDefined();
      expect(response.identificationResult.alternativeMatches!.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Tests', () => {
    it('should complete identification within 500ms target', async () => {
      const mockSymbol = createMockDetectedSymbol();
      const mockComponent = createMockComponent();

      const lookupRequest: ComponentLookupRequest = {
        detectedSymbol: mockSymbol
      };

      // Mock fast responses
      mockComponentLibraryService.searchComponents.mockResolvedValueOnce({
        components: [mockComponent],
        totalCount: 1
      });
      mockFuseSearch.mockReturnValueOnce([]);
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockComponentLibraryService.getComponentById.mockResolvedValueOnce(mockComponent);
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'identification-id', created_at: new Date() }]
      });

      const startTime = Date.now();
      const response = await service.identifyComponent(lookupRequest);
      const processingTime = Date.now() - startTime;

      expect(response.success).toBe(true);
      expect(response.processingTimeMs).toBeLessThan(500);
      expect(processingTime).toBeLessThan(500);
    });

    it('should handle concurrent identifications efficiently', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        detectedSymbol: createMockDetectedSymbol({
          id: `symbol-${i}`
        })
      }));

      // Mock responses for all requests
      mockComponentLibraryService.searchComponents.mockResolvedValue({
        components: [createMockComponent()],
        totalCount: 1
      });
      mockFuseSearch.mockReturnValue([]);
      mockClient.query
        .mockResolvedValue({ rows: [] }) // Property matching
        .mockResolvedValue({ rows: [{ id: 'identification-id', created_at: new Date() }] }); // Storage
      mockComponentLibraryService.getComponentById.mockResolvedValue(createMockComponent());

      const startTime = Date.now();
      const results = await Promise.all(
        requests.map(req => service.identifyComponent(req))
      );
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(5);
      expect(results.every(r => r.success)).toBe(true);
      expect(totalTime).toBeLessThan(2000); // Should complete 5 concurrent requests within 2 seconds
    });

    it('should handle large component library efficiently', async () => {
      const mockSymbol = createMockDetectedSymbol();
      
      // Mock large component library
      const largeComponentList = Array.from({ length: 1000 }, (_, i) => 
        createMockComponent({ id: `comp-${i}` })
      );

      const lookupRequest: ComponentLookupRequest = {
        detectedSymbol: mockSymbol
      };

      mockComponentLibraryService.searchComponents.mockResolvedValueOnce({
        components: largeComponentList.slice(0, 20), // Return first 20 matches
        totalCount: 1000
      });

      // Mock Fuse.js with large dataset - should still be fast
      mockFuseSearch.mockReturnValueOnce([]);
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockComponentLibraryService.getComponentById.mockResolvedValueOnce(largeComponentList[0]);
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'identification-id', created_at: new Date() }]
      });

      const startTime = Date.now();
      const response = await service.identifyComponent(lookupRequest);
      const processingTime = Date.now() - startTime;

      expect(response.success).toBe(true);
      expect(processingTime).toBeLessThan(1000); // Should handle large library within 1 second
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockSymbol = createMockDetectedSymbol();
      const lookupRequest: ComponentLookupRequest = {
        detectedSymbol: mockSymbol
      };

      const dbError = new Error('Database connection failed');
      mockComponentLibraryService.searchComponents.mockRejectedValueOnce(dbError);

      const response = await service.identifyComponent(lookupRequest);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.identificationResult.specifications.functionDescription)
        .toContain('Identification failed');
    });

    it('should handle missing symbol data', async () => {
      const invalidSymbol = {
        ...createMockDetectedSymbol(),
        symbolType: undefined,
        symbolCategory: undefined
      } as any;

      const lookupRequest: ComponentLookupRequest = {
        detectedSymbol: invalidSymbol
      };

      // The service should handle invalid input gracefully
      mockComponentLibraryService.searchComponents.mockResolvedValueOnce({
        components: [],
        totalCount: 0
      });
      mockFuseSearch.mockReturnValueOnce([]);
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const response = await service.identifyComponent(lookupRequest);

      expect(response.success).toBe(false);
    });

    it('should handle invalid contextual hints', async () => {
      const mockSymbol = createMockDetectedSymbol();
      const invalidHints: ContextualHint[] = [
        {
          type: 'invalid_type' as any,
          value: 'invalid_value',
          confidence: -1 // Invalid confidence
        }
      ];

      const lookupRequest: ComponentLookupRequest = {
        detectedSymbol: mockSymbol,
        contextualHints: invalidHints
      };

      mockComponentLibraryService.searchComponents.mockResolvedValueOnce({
        components: [createMockComponent()],
        totalCount: 1
      });
      mockFuseSearch.mockReturnValueOnce([]);
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockComponentLibraryService.getComponentById.mockResolvedValueOnce(createMockComponent());
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'identification-id', created_at: new Date() }]
      });

      // Should not throw error, but handle gracefully
      const response = await service.identifyComponent(lookupRequest);

      expect(response).toBeDefined();
      // Invalid hints should not crash the system
    });
  });

  describe('Edge Cases', () => {
    it('should handle symbols with no text labels', async () => {
      const mockSymbol = createMockDetectedSymbol({
        features: {
          ...createMockDetectedSymbol().features,
          textLabels: []
        }
      });

      const lookupRequest: ComponentLookupRequest = {
        detectedSymbol: mockSymbol
      };

      mockComponentLibraryService.searchComponents.mockResolvedValueOnce({
        components: [createMockComponent()],
        totalCount: 1
      });
      mockFuseSearch.mockReturnValueOnce([]);
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockComponentLibraryService.getComponentById.mockResolvedValueOnce(createMockComponent());
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'identification-id', created_at: new Date() }]
      });

      const response = await service.identifyComponent(lookupRequest);

      expect(response.success).toBe(true);
      // Should still work without text labels, relying on symbol type/category
    });

    it('should handle very low confidence symbols', async () => {
      const mockSymbol = createMockDetectedSymbol({
        confidence: 0.1 // Very low confidence
      });

      const lookupRequest: ComponentLookupRequest = {
        detectedSymbol: mockSymbol,
        confidenceThreshold: 0.05 // Very low threshold
      };

      mockComponentLibraryService.searchComponents.mockResolvedValueOnce({
        components: [createMockComponent()],
        totalCount: 1
      });
      mockFuseSearch.mockReturnValueOnce([]);
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockComponentLibraryService.getComponentById.mockResolvedValueOnce(createMockComponent());
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'identification-id', created_at: new Date() }]
      });

      const response = await service.identifyComponent(lookupRequest);

      expect(response.success).toBe(true);
      expect(response.identificationResult.confidence).toBeLessThan(0.5);
    });

    it('should handle custom symbol categories', async () => {
      const mockSymbol = createMockDetectedSymbol({
        symbolType: 'custom' as ElectricalSymbolType,
        symbolCategory: 'custom' as SymbolCategory
      });

      const lookupRequest: ComponentLookupRequest = {
        detectedSymbol: mockSymbol
      };

      mockComponentLibraryService.searchComponents.mockResolvedValueOnce({
        components: [],
        totalCount: 0
      });
      mockFuseSearch.mockReturnValueOnce([]);
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const response = await service.identifyComponent(lookupRequest);

      expect(response.success).toBe(false);
      expect(response.identificationResult.specifications.functionDescription)
        .toContain('Unknown component');
    });
  });
});