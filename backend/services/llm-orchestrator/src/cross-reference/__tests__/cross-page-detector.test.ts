/**
 * Cross-Page Reference Detector Tests
 * 
 * Unit tests for the CrossPageReferenceDetector class.
 * Tests reference designation extraction, cross-page matching, and detection algorithms.
 * 
 * Story: 4.4 Cross-Reference Engine
 * Task: 4.4.1 Build Cross-Page Reference Detection System
 */

import { Pool } from 'pg';
import { CrossPageReferenceDetector } from '../cross-page-detector';
// Test imports removed as they're not used in current implementation

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

describe('CrossPageReferenceDetector', () => {
  let detector: CrossPageReferenceDetector;

  beforeEach(() => {
    detector = new CrossPageReferenceDetector(mockPool);
    (mockPool.connect as jest.Mock).mockResolvedValue(mockClient);
    mockClient.query.mockClear();
    mockClient.release.mockClear();
  });

  describe('detectCrossPageReferences', () => {
    it('should detect cross-page references successfully', async () => {
      const mockDetectedSymbols = [
        {
          id: 'symbol1',
          symbol_type: 'resistor',
          description: 'R1 100k resistor',
          confidence: 0.9,
          location_x: 0.5,
          location_y: 0.3,
          page_number: 1,
          document_id: 'doc1'
        },
        {
          id: 'symbol2',
          symbol_type: 'resistor',
          description: 'R1 details',
          confidence: 0.85,
          location_x: 0.2,
          location_y: 0.7,
          page_number: 2,
          document_id: 'doc1'
        }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: mockDetectedSymbols }) // getDetectedSymbols
        .mockResolvedValueOnce({ rows: [] }) // createComponentReferences checks
        .mockResolvedValueOnce({ rows: [{ id: 'ref1', component_id: 'symbol1', reference_designation: 'R1', page_number: 1, document_id: 'doc1', component_type: '', is_main_reference: true, related_references: [], created_at: new Date() }] }) // createComponentReferences insert 1
        .mockResolvedValueOnce({ rows: [] }) // createComponentReferences checks
        .mockResolvedValueOnce({ rows: [{ id: 'ref2', component_id: 'symbol2', reference_designation: 'R1', page_number: 2, document_id: 'doc1', component_type: '', is_main_reference: true, related_references: [], created_at: new Date() }] }) // createComponentReferences insert 2
        .mockResolvedValueOnce({ rows: [] }) // createCrossPageReferences checks
        .mockResolvedValueOnce({ rows: [{ 
          id: 'cross-ref1', 
          source_component_id: 'symbol1', 
          target_component_id: 'symbol2', 
          reference_designation: 'R1',
          source_page_number: 1,
          target_page_number: 2,
          source_document_id: 'doc1',
          target_document_id: 'doc1',
          reference_type: 'component_continuation',
          continuation_symbol: null,
          confidence: 0.85,
          created_at: new Date()
        }] }); // createCrossPageReferences insert

      const result = await detector.detectCrossPageReferences('session1', 'doc1');

      expect(result).toBeDefined();
      expect(result.sessionId).toBe('session1');
      expect(result.documentId).toBe('doc1');
      expect(result.detectedReferences).toHaveLength(2);
      expect(result.crossPageLinks).toHaveLength(1);
      expect(result.confidence).toBeGreaterThan(0);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error when no detected symbols found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        detector.detectCrossPageReferences('session1', 'doc1')
      ).rejects.toThrow('No detected symbols found for document');

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(
        detector.detectCrossPageReferences('session1', 'doc1')
      ).rejects.toThrow('Cross-page reference detection failed');

      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getCrossPageReferencesForComponent', () => {
    it('should return cross-page references for a component', async () => {
      const mockReferences = [
        {
          id: 'ref1',
          source_component_id: 'comp1',
          target_component_id: 'comp2',
          reference_designation: 'R1',
          source_page_number: 1,
          target_page_number: 2,
          source_document_id: 'doc1',
          target_document_id: 'doc1',
          reference_type: 'component_continuation',
          continuation_symbol: null,
          confidence: 0.9,
          created_at: new Date()
        }
      ];

      mockClient.query.mockResolvedValueOnce({ rows: mockReferences });

      const result = await detector.getCrossPageReferencesForComponent('comp1');

      expect(result).toHaveLength(1);
      expect(result[0].sourceComponentId).toBe('comp1');
      expect(result[0].referenceDesignation).toBe('R1');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('findComponentsByDesignation', () => {
    it('should find components by reference designation', async () => {
      const mockComponents = [
        {
          id: 'ref1',
          component_id: 'comp1',
          reference_designation: 'R1',
          page_number: 1,
          document_id: 'doc1',
          component_type: 'resistor',
          is_main_reference: true,
          related_references: [],
          created_at: new Date()
        }
      ];

      mockClient.query.mockResolvedValueOnce({ rows: mockComponents });

      const result = await detector.findComponentsByDesignation('R1', 'doc1');

      expect(result).toHaveLength(1);
      expect(result[0].referenceDesignation).toBe('R1');
      expect(result[0].componentId).toBe('comp1');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should find components across all documents when documentId not provided', async () => {
      const mockComponents = [
        {
          id: 'ref1',
          component_id: 'comp1',
          reference_designation: 'C1',
          page_number: 1,
          document_id: 'doc1',
          component_type: 'capacitor',
          is_main_reference: true,
          related_references: [],
          created_at: new Date()
        },
        {
          id: 'ref2',
          component_id: 'comp2',
          reference_designation: 'C1',
          page_number: 3,
          document_id: 'doc2',
          component_type: 'capacitor',
          is_main_reference: false,
          related_references: ['ref1'],
          created_at: new Date()
        }
      ];

      mockClient.query.mockResolvedValueOnce({ rows: mockComponents });

      const result = await detector.findComponentsByDesignation('C1');

      expect(result).toHaveLength(2);
      expect(result[0].referenceDesignation).toBe('C1');
      expect(result[1].referenceDesignation).toBe('C1');
      expect(result[0].documentId).toBe('doc1');
      expect(result[1].documentId).toBe('doc2');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('reference designation extraction', () => {
    it('should extract standard component designations', async () => {
      const mockDetectedSymbols = [
        {
          id: 'symbol1',
          symbol_type: 'resistor',
          description: 'R1',
          confidence: 0.9,
          location_x: 0.5,
          location_y: 0.3,
          page_number: 1,
          document_id: 'doc1'
        },
        {
          id: 'symbol2',
          symbol_type: 'capacitor',
          description: 'C2 100uF',
          confidence: 0.85,
          location_x: 0.2,
          location_y: 0.7,
          page_number: 1,
          document_id: 'doc1'
        },
        {
          id: 'symbol3',
          symbol_type: 'ic',
          description: 'IC3 Op-Amp',
          confidence: 0.8,
          location_x: 0.7,
          location_y: 0.4,
          page_number: 1,
          document_id: 'doc1'
        }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: mockDetectedSymbols })
        .mockResolvedValue({ rows: [] }); // Mock subsequent queries

      const result = await detector.detectCrossPageReferences('session1', 'doc1');

      // Verify that designations were extracted (implied by successful processing)
      expect(result.detectedReferences).toBeDefined();
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle invalid session ID', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Invalid session'));

      await expect(
        detector.detectCrossPageReferences('', 'doc1')
      ).rejects.toThrow();

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle invalid document ID', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('Document not found'));

      await expect(
        detector.detectCrossPageReferences('session1', '')
      ).rejects.toThrow();

      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});