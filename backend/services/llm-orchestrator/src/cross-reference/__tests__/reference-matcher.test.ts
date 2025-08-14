/**
 * Reference Matcher Service Tests
 * 
 * Unit tests for the ReferenceMatcherService class.
 * Tests reference designation parsing, validation, and matching algorithms.
 * 
 * Story: 4.4 Cross-Reference Engine
 * Task: 4.4.1 Build Cross-Page Reference Detection System
 */

import { Pool } from 'pg';
import { ReferenceMatcherService } from '../reference-matcher.service';

// Mock database pool
const mockPool = {
  connect: jest.fn(),
  query: jest.fn(),
  end: jest.fn()
} as unknown as Pool;

const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

describe('ReferenceMatcherService', () => {
  let referenceMatcher: ReferenceMatcherService;

  beforeEach(() => {
    referenceMatcher = new ReferenceMatcherService(mockPool);
    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
    mockClient.query.mockClear();
    mockClient.release.mockClear();
  });

  describe('parseReferenceDesignation', () => {
    it('should parse standard resistor designation', () => {
      const result = referenceMatcher.parseReferenceDesignation('R1');
      
      expect(result.isValid).toBe(true);
      expect(result.componentType).toBe('resistor');
      expect(result.number).toBe(1);
      expect(result.normalizedDesignation).toBe('R1');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should parse capacitor designation with suffix', () => {
      const result = referenceMatcher.parseReferenceDesignation('C2A');
      
      expect(result.isValid).toBe(true);
      expect(result.componentType).toBe('capacitor');
      expect(result.number).toBe(2);
      expect(result.suffix).toBe('A');
      expect(result.normalizedDesignation).toBe('C2A');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should parse IC designation', () => {
      const result = referenceMatcher.parseReferenceDesignation('IC3');
      
      expect(result.isValid).toBe(true);
      expect(result.componentType).toBe('ic');
      expect(result.number).toBe(3);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should parse U designation as IC', () => {
      const result = referenceMatcher.parseReferenceDesignation('U4');
      
      expect(result.isValid).toBe(true);
      expect(result.componentType).toBe('ic');
      expect(result.number).toBe(4);
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should handle case insensitive parsing', () => {
      const result = referenceMatcher.parseReferenceDesignation('r5');
      
      expect(result.isValid).toBe(true);
      expect(result.componentType).toBe('resistor');
      expect(result.number).toBe(5);
      expect(result.normalizedDesignation).toBe('R5');
    });

    it('should parse complex designations', () => {
      const testCases = [
        { input: 'D1', expected: 'diode' },
        { input: 'Q2', expected: 'transistor' },
        { input: 'L3', expected: 'inductor' },
        { input: 'T4', expected: 'transformer' },
        { input: 'J5', expected: 'connector' },
        { input: 'S6', expected: 'switch' },
        { input: 'K7', expected: 'relay' },
        { input: 'F8', expected: 'fuse' },
        { input: 'TP9', expected: 'test_point' },
        { input: 'X10', expected: 'crystal' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = referenceMatcher.parseReferenceDesignation(input);
        expect(result.isValid).toBe(true);
        expect(result.componentType).toBe(expected);
      });
    });

    it('should handle unknown but valid patterns', () => {
      const result = referenceMatcher.parseReferenceDesignation('XYZ123');
      
      expect(result.isValid).toBe(true);
      expect(result.componentType).toBe('unknown');
      expect(result.number).toBe(123);
      expect(result.confidence).toBe(0.6); // Lower confidence for unknown types
    });

    it('should reject invalid designations', () => {
      const invalidCases = ['', '   ', '123', 'ABC', 'R', 'C-1'];
      
      invalidCases.forEach(invalid => {
        const result = referenceMatcher.parseReferenceDesignation(invalid);
        expect(result.isValid).toBe(false);
        expect(result.confidence).toBe(0);
      });
    });
  });

  describe('findMatchingDesignations', () => {
    it('should find exact matching designations', async () => {
      const mockMatches = [
        {
          component_id: 'comp1',
          reference_designation: 'R1',
          page_number: 2,
          document_id: 'doc1',
          location_x: 0.3,
          location_y: 0.4,
          confidence: 0.9,
          symbol_type: 'resistor'
        }
      ];

      mockClient.query.mockResolvedValueOnce({ rows: mockMatches });

      const result = await referenceMatcher.findMatchingDesignations('R1', 'doc1', 1);

      expect(result).toHaveLength(1);
      expect(result[0].designation).toBe('R1');
      expect(result[0].componentId).toBe('comp1');
      expect(result[0].pageNumber).toBe(2);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle partial matches when configured', async () => {
      referenceMatcher.updateConfig({ exactMatchOnly: false });

      const mockMatches = [
        {
          component_id: 'comp1',
          reference_designation: 'R1A',
          page_number: 2,
          document_id: 'doc1',
          location_x: 0.3,
          location_y: 0.4,
          confidence: 0.8,
          symbol_type: 'resistor'
        }
      ];

      mockClient.query.mockResolvedValueOnce({ rows: mockMatches });

      const result = await referenceMatcher.findMatchingDesignations('R1', 'doc1', 1);

      expect(result).toHaveLength(1);
      expect(result[0].designation).toBe('R1A');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should exclude specified page number', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await referenceMatcher.findMatchingDesignations('R1', 'doc1', 1);

      // Verify the query was called with exclude page parameter
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('AND cr.page_number != $'),
        ['doc1', '%R1%', 1] // Exact match for the parameters
      );
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should return empty array for invalid designations', async () => {
      const result = await referenceMatcher.findMatchingDesignations('invalid', 'doc1');

      expect(result).toHaveLength(0);
      expect(mockClient.query).not.toHaveBeenCalled();
    });
  });

  describe('validateReferenceConsistency', () => {
    it('should validate consistent references', async () => {
      const mockReferences = [
        {
          reference_designation: 'R1',
          component_id: 'comp1',
          page_number: 1,
          symbol_type: 'resistor',
          symbol_category: 'passive',
          confidence: 0.9
        },
        {
          reference_designation: 'R1',
          component_id: 'comp2',
          page_number: 2,
          symbol_type: 'resistor',
          symbol_category: 'passive',
          confidence: 0.85
        }
      ];

      mockClient.query.mockResolvedValueOnce({ rows: mockReferences });

      const result = await referenceMatcher.validateReferenceConsistency('doc1');

      expect(result).toHaveLength(1);
      expect(result[0].isValid).toBe(true);
      expect(result[0].validationErrors).toHaveLength(0);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should detect inconsistent symbol types', async () => {
      const mockReferences = [
        {
          reference_designation: 'R1',
          component_id: 'comp1',
          page_number: 1,
          symbol_type: 'resistor',
          symbol_category: 'passive',
          confidence: 0.9
        },
        {
          reference_designation: 'R1',
          component_id: 'comp2',
          page_number: 2,
          symbol_type: 'capacitor',
          symbol_category: 'passive',
          confidence: 0.85
        }
      ];

      mockClient.query.mockResolvedValueOnce({ rows: mockReferences });

      const result = await referenceMatcher.validateReferenceConsistency('doc1');

      expect(result).toHaveLength(1);
      expect(result[0].isValid).toBe(false);
      expect(result[0].validationErrors.length).toBeGreaterThan(0);
      expect(result[0].validationErrors[0]).toContain('Inconsistent symbol types');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should detect invalid designation formats', async () => {
      const mockReferences = [
        {
          reference_designation: 'InvalidDesignation',
          component_id: 'comp1',
          page_number: 1,
          symbol_type: 'resistor',
          symbol_category: 'passive',
          confidence: 0.9
        }
      ];

      mockClient.query.mockResolvedValueOnce({ rows: mockReferences });

      const result = await referenceMatcher.validateReferenceConsistency('doc1');

      expect(result).toHaveLength(1);
      expect(result[0].isValid).toBe(false);
      expect(result[0].validationErrors.length).toBeGreaterThan(0);
      expect(result[0].validationErrors[0]).toContain('Invalid designation format');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('detectReferenceConflicts', () => {
    it('should detect duplicate designation conflicts', async () => {
      const mockDuplicates = [
        {
          reference_designation: 'R1',
          symbol_types: ['resistor', 'capacitor'],
          symbol_categories: ['passive', 'passive'],
          component_ids: ['comp1', 'comp2'],
          count: 2
        }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: mockDuplicates }) // duplicates query
        .mockResolvedValueOnce({ rows: [] }) // missing targets query
        .mockResolvedValueOnce({ rows: [] }); // circular references query

      const result = await referenceMatcher.detectReferenceConflicts('doc1');

      expect(result).toHaveLength(1);
      expect(result[0].conflictType).toBe('duplicate_designation');
      expect(result[0].resolution).toBe('user_input_required');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should detect missing target references', async () => {
      const mockMissing = [
        {
          id: 'ref1',
          reference_designation: 'R1',
          source_component_id: 'comp1',
          target_page_number: 2,
          target_document_id: 'doc1'
        }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // duplicates query
        .mockResolvedValueOnce({ rows: mockMissing }) // missing targets query
        .mockResolvedValueOnce({ rows: [] }); // circular references query

      const result = await referenceMatcher.detectReferenceConflicts('doc1');

      expect(result).toHaveLength(1);
      expect(result[0].conflictType).toBe('missing_target');
      expect(result[0].resolution).toBe('auto_resolve');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should detect circular references', async () => {
      const mockCircular = [
        {
          id: 'ref1',
          source_component_id: 'comp1',
          target_component_id: 'comp2',
          reference_designation: 'R1',
          depth: 2,
          path: ['comp1', 'comp2']
        }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // duplicates query
        .mockResolvedValueOnce({ rows: [] }) // missing targets query
        .mockResolvedValueOnce({ rows: mockCircular }); // circular references query

      const result = await referenceMatcher.detectReferenceConflicts('doc1');

      expect(result).toHaveLength(1);
      expect(result[0].conflictType).toBe('circular_reference');
      expect(result[0].resolution).toBe('user_input_required');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('generateSuggestedDesignation', () => {
    it('should generate suggestions for resistors', () => {
      const existingDesignations = ['R1', 'R2', 'R4'];
      const suggestions = referenceMatcher.generateSuggestedDesignation(
        'resistor',
        existingDesignations
      );

      expect(suggestions).toContain('R3'); // First available number
      expect(suggestions).toContain('R5'); // Next number
      expect(suggestions.length).toBe(3);
    });

    it('should generate page-specific suggestions', () => {
      const existingDesignations = ['R1', 'R2'];
      const suggestions = referenceMatcher.generateSuggestedDesignation(
        'resistor',
        existingDesignations,
        2 // Page number 2
      );

      expect(suggestions).toContain('R3'); // Standard suggestion
      expect(suggestions.some(s => s.includes('2A'))).toBe(true); // Page-specific suggestion
    });

    it('should handle unknown component types', () => {
      const suggestions = referenceMatcher.generateSuggestedDesignation(
        'unknown_component',
        []
      );

      expect(suggestions).toContain('U1'); // Default prefix
      expect(suggestions.length).toBe(3);
    });

    it('should skip existing numbers', () => {
      const existingDesignations = ['C1', 'C2', 'C3', 'C5'];
      const suggestions = referenceMatcher.generateSuggestedDesignation(
        'capacitor',
        existingDesignations
      );

      expect(suggestions).toContain('C4'); // Available number
      expect(suggestions).not.toContain('C1'); // Existing number
      expect(suggestions).not.toContain('C2'); // Existing number
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      referenceMatcher.updateConfig({
        exactMatchOnly: true,
        minimumConfidence: 0.9
      });

      const patterns = referenceMatcher.getSupportedPatterns();
      expect(Object.keys(patterns).length).toBeGreaterThan(0);
    });

    it('should return supported patterns', () => {
      const patterns = referenceMatcher.getSupportedPatterns();
      
      expect(patterns.resistor).toBeDefined();
      expect(patterns.capacitor).toBeDefined();
      expect(patterns.inductor).toBeDefined();
      expect(patterns.diode).toBeDefined();
      expect(patterns.transistor).toBeDefined();
      expect(patterns.ic).toBeDefined();
    });
  });
});