/**
 * Component Library Service Tests
 * 
 * Unit tests for ComponentLibraryService
 * Story: 4.2 Component Database Integration
 * Task: 4.2.5 Testing and Performance Validation
 */

import { Pool } from 'pg';
import { ComponentLibraryService } from '../component-library.service';
import {
  ComponentLibraryCreateRequest,
  ComponentLibraryUpdateRequest,
  ComponentSearchRequest,
  ElectricalSymbolType,
  SymbolCategory,
  IndustryStandard
} from '../../../../../shared/types/component-database.types';

// Mock pg Pool
jest.mock('pg');

const mockClient = {
  connect: jest.fn(),
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn().mockResolvedValue(mockClient),
  query: jest.fn(),
  end: jest.fn(),
};

describe('ComponentLibraryService', () => {
  let service: ComponentLibraryService;
  let pool: Pool;

  beforeEach(() => {
    jest.clearAllMocks();
    pool = mockPool as any;
    service = new ComponentLibraryService(pool);
    
    // Reset mock client
    mockClient.connect.mockResolvedValue(mockClient);
    mockClient.release.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('getComponentById', () => {
    it('should return component with all related data', async () => {
      const componentId = 'test-component-id';
      const mockComponentData = {
        id: componentId,
        symbol_type: 'resistor',
        symbol_category: 'passive',
        component_name: 'Test Resistor',
        component_description: 'Test resistor description',
        industry_standards: ['IEEE', 'IEC'],
        symbol_pattern_data: null,
        created_at: new Date(),
        updated_at: new Date(),
        version: 1
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockComponentData] }) // Component query
        .mockResolvedValueOnce({ rows: [] }) // Specifications query
        .mockResolvedValueOnce({ rows: [] }) // Properties query
        .mockResolvedValueOnce({ rows: [] }) // Ratings query
        .mockResolvedValueOnce({ rows: [] }); // Cross references query

      const result = await service.getComponentById(componentId);

      expect(result).toBeDefined();
      expect(result?.id).toBe(componentId);
      expect(result?.symbolType).toBe('resistor');
      expect(result?.symbolCategory).toBe('passive');
      expect(result?.componentName).toBe('Test Resistor');
      expect(mockClient.query).toHaveBeenCalledTimes(5);
    });

    it('should return null if component not found', async () => {
      const componentId = 'non-existent-id';
      
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getComponentById(componentId);

      expect(result).toBeNull();
      expect(mockClient.query).toHaveBeenCalledTimes(1);
    });

    it('should throw error on database failure', async () => {
      const componentId = 'test-id';
      const dbError = new Error('Database connection failed');
      
      mockClient.query.mockRejectedValueOnce(dbError);

      await expect(service.getComponentById(componentId))
        .rejects.toThrow('Failed to get component by ID');
    });
  });

  describe('searchComponents', () => {
    it('should search components with basic filters', async () => {
      const searchRequest: ComponentSearchRequest = {
        query: 'resistor',
        symbolType: 'resistor' as ElectricalSymbolType,
        limit: 10,
        offset: 0
      };

      const mockSearchResult = {
        rows: [
          {
            id: 'comp-1',
            symbol_type: 'resistor',
            symbol_category: 'passive',
            component_name: 'Carbon Film Resistor',
            component_description: 'Standard carbon film resistor',
            industry_standards: ['IEEE'],
            created_at: new Date(),
            updated_at: new Date(),
            version: 1
          }
        ]
      };

      // Mock count query and search query
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '1' }] }) // Count query
        .mockResolvedValueOnce(mockSearchResult); // Search query

      // Mock getComponentById for detailed data
      service.getComponentById = jest.fn().mockResolvedValueOnce({
        id: 'comp-1',
        symbolType: 'resistor',
        symbolCategory: 'passive',
        componentName: 'Carbon Film Resistor',
        componentDescription: 'Standard carbon film resistor',
        industryStandards: ['IEEE'],
        properties: [],
        ratings: [],
        crossReferences: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      });

      const result = await service.searchComponents(searchRequest);

      expect(result).toBeDefined();
      expect(result.components).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.components[0].componentName).toBe('Carbon Film Resistor');
    });

    it('should handle empty search results', async () => {
      const searchRequest: ComponentSearchRequest = {
        query: 'nonexistent',
        limit: 10,
        offset: 0
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] }) // Count query
        .mockResolvedValueOnce({ rows: [] }); // Search query

      const result = await service.searchComponents(searchRequest);

      expect(result.components).toHaveLength(0);
      expect(result.totalCount).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it('should handle pagination correctly', async () => {
      const searchRequest: ComponentSearchRequest = {
        limit: 5,
        offset: 10
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '25' }] }) // Count query
        .mockResolvedValueOnce({ rows: [] }); // Search query

      const result = await service.searchComponents(searchRequest);

      expect(result.totalCount).toBe(25);
      expect(result.hasMore).toBe(true); // 10 + 5 < 25
    });

    it('should measure processing time', async () => {
      const searchRequest: ComponentSearchRequest = { limit: 1 };

      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.searchComponents(searchRequest);

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.processingTimeMs).toBe('number');
    });
  });

  describe('createComponent', () => {
    it('should create component successfully', async () => {
      const createRequest: ComponentLibraryCreateRequest = {
        symbolType: 'resistor' as ElectricalSymbolType,
        symbolCategory: 'passive' as SymbolCategory,
        componentName: 'New Test Resistor',
        componentDescription: 'A new test resistor',
        industryStandards: ['IEEE'] as IndustryStandard[],
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
        ratings: [
          {
            ratingType: 'power',
            nominalValue: 0.25,
            unit: 'W'
          }
        ]
      };

      const mockComponentId = 'new-component-id';

      // Mock transaction queries
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: mockComponentId, created_at: new Date(), updated_at: new Date(), version: 1 }] }) // Component insert
        .mockResolvedValueOnce(undefined) // Specifications insert
        .mockResolvedValueOnce(undefined) // Properties insert
        .mockResolvedValueOnce(undefined) // Ratings insert
        .mockResolvedValueOnce(undefined); // COMMIT

      // Mock getComponentById for return value
      service.getComponentById = jest.fn().mockResolvedValueOnce({
        id: mockComponentId,
        symbolType: 'resistor',
        symbolCategory: 'passive',
        componentName: 'New Test Resistor',
        componentDescription: 'A new test resistor',
        industryStandards: ['IEEE'],
        properties: createRequest.properties,
        ratings: createRequest.ratings,
        crossReferences: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1
      });

      const result = await service.createComponent(createRequest);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockComponentId);
      expect(result.componentName).toBe('New Test Resistor');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should rollback transaction on error', async () => {
      const createRequest: ComponentLibraryCreateRequest = {
        symbolType: 'resistor' as ElectricalSymbolType,
        symbolCategory: 'passive' as SymbolCategory,
        componentName: 'Failed Component',
        componentDescription: 'This will fail',
        industryStandards: []
      };

      const dbError = new Error('Insert failed');

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(dbError); // Component insert fails

      await expect(service.createComponent(createRequest))
        .rejects.toThrow('Failed to create component');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('updateComponent', () => {
    it('should update component successfully', async () => {
      const updateRequest: ComponentLibraryUpdateRequest = {
        componentId: 'test-component-id',
        updates: {
          componentName: 'Updated Component Name',
          componentDescription: 'Updated description'
        }
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [{ version: 2 }] }) // Version update
        .mockResolvedValueOnce({ rowCount: 1 }) // Component update
        .mockResolvedValueOnce(undefined); // COMMIT

      // Mock getComponentById for return value
      service.getComponentById = jest.fn().mockResolvedValueOnce({
        id: 'test-component-id',
        componentName: 'Updated Component Name',
        componentDescription: 'Updated description',
        version: 2
      });

      const result = await service.updateComponent(updateRequest);

      expect(result).toBeDefined();
      expect(result.componentName).toBe('Updated Component Name');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should throw error if component not found', async () => {
      const updateRequest: ComponentLibraryUpdateRequest = {
        componentId: 'non-existent-id',
        updates: { componentName: 'New Name' }
      };

      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Version update returns no rows

      await expect(service.updateComponent(updateRequest))
        .rejects.toThrow('Component not found');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('deleteComponent', () => {
    it('should delete component successfully', async () => {
      const componentId = 'test-component-id';

      mockClient.query.mockResolvedValueOnce({ rowCount: 1 });

      const result = await service.deleteComponent(componentId);

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM'),
        [componentId]
      );
    });

    it('should return false if component not found', async () => {
      const componentId = 'non-existent-id';

      mockClient.query.mockResolvedValueOnce({ rowCount: 0 });

      const result = await service.deleteComponent(componentId);

      expect(result).toBe(false);
    });
  });

  describe('getLibraryStatistics', () => {
    it('should return library statistics', async () => {
      const mockStats = {
        totalComponents: 100,
        componentsByCategory: { passive: 60, active: 40 },
        componentsByStandard: { IEEE: 80, IEC: 70 }
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '100' }] }) // Total components
        .mockResolvedValueOnce({ // By category
          rows: [
            { symbol_category: 'passive', count: '60' },
            { symbol_category: 'active', count: '40' }
          ]
        })
        .mockResolvedValueOnce({ // By standard
          rows: [
            { standard: 'IEEE', count: '80' },
            { standard: 'IEC', count: '70' }
          ]
        });

      const result = await service.getLibraryStatistics();

      expect(result.totalComponents).toBe(100);
      expect(result.componentsByCategory.passive).toBe(60);
      expect(result.componentsByCategory.active).toBe(40);
      expect(result.componentsByStandard.IEEE).toBe(80);
      expect(result.componentsByStandard.IEC).toBe(70);
    });
  });

  describe('Performance Tests', () => {
    it('should handle large component search within time limit', async () => {
      const searchRequest: ComponentSearchRequest = {
        query: 'resistor',
        limit: 100
      };

      // Simulate large dataset
      const mockComponents = Array.from({ length: 100 }, (_, i) => ({
        id: `comp-${i}`,
        symbol_type: 'resistor',
        symbol_category: 'passive',
        component_name: `Resistor ${i}`,
        component_description: `Description ${i}`,
        industry_standards: ['IEEE'],
        created_at: new Date(),
        updated_at: new Date(),
        version: 1
      }));

      mockClient.query
        .mockResolvedValueOnce({ rows: [{ total: '100' }] })
        .mockResolvedValueOnce({ rows: mockComponents });

      // Mock getComponentById to return quickly
      service.getComponentById = jest.fn().mockImplementation((id) => 
        Promise.resolve({
          id,
          symbolType: 'resistor',
          symbolCategory: 'passive',
          componentName: 'Test Component',
          componentDescription: 'Test Description',
          industryStandards: ['IEEE'],
          properties: [],
          ratings: [],
          crossReferences: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1
        })
      );

      const startTime = Date.now();
      const result = await service.searchComponents(searchRequest);
      const processingTime = Date.now() - startTime;

      expect(result.components).toHaveLength(100);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent requests efficiently', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        query: `component-${i}`,
        limit: 10
      }));

      mockClient.query
        .mockResolvedValue({ rows: [{ total: '1' }] }) // Count queries
        .mockResolvedValue({ rows: [] }); // Search queries

      const startTime = Date.now();
      const results = await Promise.all(
        requests.map(req => service.searchComponents(req))
      );
      const processingTime = Date.now() - startTime;

      expect(results).toHaveLength(10);
      expect(processingTime).toBeLessThan(10000); // Should handle 10 concurrent requests within 10 seconds
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      const connectionError = new Error('Connection timeout');
      mockPool.connect.mockRejectedValueOnce(connectionError);

      await expect(service.getComponentById('test-id'))
        .rejects.toThrow('Failed to get component by ID');
    });

    it('should handle invalid input gracefully', async () => {
      await expect(service.getComponentById(''))
        .rejects.toThrow();

      await expect(service.searchComponents({ limit: -1 }))
        .rejects.toThrow();
    });

    it('should handle SQL injection attempts', async () => {
      const maliciousId = "'; DROP TABLE components; --";

      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getComponentById(maliciousId);

      expect(result).toBeNull();
      // Ensure the malicious input was passed as parameter, not concatenated
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE cl.id = $1'),
        [maliciousId]
      );
    });
  });
});