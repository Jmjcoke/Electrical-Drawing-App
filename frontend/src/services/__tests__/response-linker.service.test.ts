/**
 * Unit tests for ResponseLinkerService
 * Tests component detection, location parsing, and highlight creation
 */

import { ResponseLinkerService, getResponseLinkerService } from '../response-linker.service';
import type { HighlightStyle } from '../../types/highlighting.types';

// Mock the coordinate mapper
jest.mock('../../utils/coordinate-mapper', () => ({
  parseLocationHints: jest.fn(),
  validateCoordinates: jest.fn(() => true)
}));

describe('ResponseLinkerService', () => {
  let service: ResponseLinkerService;
  const mockDefaultStyle: HighlightStyle = {
    color: '#2196F3',
    opacity: 0.8,
    strokeWidth: 2,
    strokeStyle: 'solid',
    fillOpacity: 0.2,
    zIndex: 1
  };

  beforeEach(() => {
    service = new ResponseLinkerService({
      confidenceThreshold: 0.3,
      maxHighlightsPerResponse: 5,
      defaultHighlightStyle: mockDefaultStyle
    });
    
    jest.clearAllMocks();
  });

  describe('component detection', () => {
    it('should detect resistor mentions', async () => {
      const text = 'The 1kΩ resistor R1 is located at coordinates 0.3, 0.5 in the circuit.';
      
      // Mock parseLocationHints to return coordinate hints
      const { parseLocationHints } = require('../../utils/coordinate-mapper');
      parseLocationHints.mockReturnValue([
        {
          type: 'coordinate',
          value: 'coordinates 0.3, 0.5',
          parsedValue: { x: 0.3, y: 0.5 },
          confidence: 0.9
        }
      ]);
      
      const highlights = await service.analyzeResponse(
        text,
        'response-1',
        'query-1',
        'session-1',
        1
      );
      
      expect(highlights.length).toBeGreaterThan(0);
      const resistorHighlight = highlights.find(h => h.componentId?.includes('resistor') || h.componentId?.includes('R1'));
      expect(resistorHighlight).toBeDefined();
      expect(resistorHighlight!.type).toBe('component');
      expect(resistorHighlight!.coordinates.x).toBe(0.3);
      expect(resistorHighlight!.coordinates.y).toBe(0.5);
      expect(resistorHighlight!.style.color).toBe('#FF9800'); // Resistor color
    });

    it('should detect multiple component types', async () => {
      const text = 'The circuit contains a 10µF capacitor C1, a 1kΩ resistor R1, and an LED D1.';
      
      const { parseLocationHints } = require('../../utils/coordinate-mapper');
      parseLocationHints.mockReturnValue([
        {
          type: 'relative',
          value: 'top-left',
          parsedValue: { reference: 'top-left' },
          confidence: 0.6
        }
      ]);
      
      const highlights = await service.analyzeResponse(
        text,
        'response-1',
        'query-1',
        'session-1',
        1
      );
      
      expect(highlights.length).toBeGreaterThan(0);
      
      // Should detect different component types
      const componentTypes = highlights.map(h => h.componentId);
      expect(componentTypes.some(id => id?.includes('capacitor') || id?.includes('C1'))).toBe(true);
      expect(componentTypes.some(id => id?.includes('resistor') || id?.includes('R1'))).toBe(true);
      expect(componentTypes.some(id => id?.includes('LED') || id?.includes('D1'))).toBe(true);
    });

    it('should filter out low confidence detections', async () => {
      const text = 'There might be some component somewhere in the circuit.';
      
      const { parseLocationHints } = require('../../utils/coordinate-mapper');
      parseLocationHints.mockReturnValue([]);
      
      const highlights = await service.analyzeResponse(
        text,
        'response-1',
        'query-1',
        'session-1',
        1
      );
      
      // Should filter out very generic mentions with low confidence
      expect(highlights.length).toBe(0);
    });

    it('should boost confidence for reference designators', async () => {
      const text = 'Check resistor R15 for proper operation.';
      
      const { parseLocationHints } = require('../../utils/coordinate-mapper');
      parseLocationHints.mockReturnValue([
        {
          type: 'relative',
          value: 'center',
          parsedValue: { reference: 'center' },
          confidence: 0.5
        }
      ]);
      
      const highlights = await service.analyzeResponse(
        text,
        'response-1',
        'query-1',
        'session-1',
        1
      );
      
      expect(highlights.length).toBeGreaterThan(0);
      // Reference designator should have higher confidence
      expect(highlights[0].isPersistent).toBe(true); // High confidence makes it persistent
    });

    it('should extract contextual clues', async () => {
      const text = 'The 2.2kΩ 1/4W resistor R10 operates at 5V and draws 2.3mA current.';
      
      const { parseLocationHints } = require('../../utils/coordinate-mapper');
      parseLocationHints.mockReturnValue([
        {
          type: 'coordinate',
          value: 'at 0.6, 0.4',
          parsedValue: { x: 0.6, y: 0.4 },
          confidence: 0.8
        }
      ]);
      
      const highlights = await service.analyzeResponse(
        text,
        'response-1',
        'query-1',
        'session-1',
        1
      );
      
      expect(highlights).toHaveLength(1);
      // Should have high confidence due to technical specifications
      expect(highlights[0].isPersistent).toBe(true);
    });
  });

  describe('location parsing', () => {
    it('should handle explicit coordinates', async () => {
      const text = 'The component is at position 0.25, 0.75.';
      
      const { parseLocationHints } = require('../../utils/coordinate-mapper');
      parseLocationHints.mockReturnValue([
        {
          type: 'coordinate',
          value: 'position 0.25, 0.75',
          parsedValue: { x: 0.25, y: 0.75 },
          confidence: 0.9
        }
      ]);
      
      const highlights = await service.analyzeResponse(
        text,
        'response-1',
        'query-1',
        'session-1',
        1
      );
      
      expect(highlights).toHaveLength(1);
      expect(highlights[0].coordinates.x).toBe(0.25);
      expect(highlights[0].coordinates.y).toBe(0.75);
    });

    it('should convert relative positions to coordinates', async () => {
      const text = 'The resistor is in the top-right corner.';
      
      const { parseLocationHints } = require('../../utils/coordinate-mapper');
      parseLocationHints.mockReturnValue([
        {
          type: 'relative',
          value: 'top-right corner',
          parsedValue: { reference: 'top-right' },
          confidence: 0.6
        }
      ]);
      
      const highlights = await service.analyzeResponse(
        text,
        'response-1',
        'query-1',
        'session-1',
        1
      );
      
      expect(highlights).toHaveLength(1);
      expect(highlights[0].coordinates.x).toBe(0.8); // top-right position
      expect(highlights[0].coordinates.y).toBe(0.2);
    });

    it('should handle pixel coordinates by normalizing', async () => {
      const text = 'The component is at (150, 200) pixels.';
      
      const { parseLocationHints } = require('../../utils/coordinate-mapper');
      parseLocationHints.mockReturnValue([
        {
          type: 'coordinate',
          value: 'at (150, 200)',
          parsedValue: { x: 150, y: 200 },
          confidence: 0.7
        }
      ]);
      
      const highlights = await service.analyzeResponse(
        text,
        'response-1',
        'query-1',
        'session-1',
        1
      );
      
      expect(highlights).toHaveLength(1);
      // Should normalize pixel coordinates
      expect(highlights[0].coordinates.x).toBe(0.15); // 150/1000
      expect(highlights[0].coordinates.y).toBe(0.2);  // 200/1000
    });
  });

  describe('highlight creation', () => {
    it('should create highlights with appropriate styling', async () => {
      const text = 'The blue LED D5 is bright.';
      
      const { parseLocationHints } = require('../../utils/coordinate-mapper');
      parseLocationHints.mockReturnValue([
        {
          type: 'coordinate',
          value: 'at 0.4, 0.6',
          parsedValue: { x: 0.4, y: 0.6 },
          confidence: 0.8
        }
      ]);
      
      const highlights = await service.analyzeResponse(
        text,
        'response-1',
        'query-1',
        'session-1',
        1
      );
      
      expect(highlights).toHaveLength(1);
      expect(highlights[0].style.color).toBe('#FFEB3B'); // LED color
      expect(highlights[0].style.animationType).toBe('glow'); // High confidence animation
      expect(highlights[0].isVisible).toBe(true);
      expect(highlights[0].responseId).toBe('response-1');
      expect(highlights[0].queryId).toBe('query-1');
      expect(highlights[0].sessionId).toBe('session-1');
    });

    it('should limit highlights per response', async () => {
      const text = 'R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 are all resistors.';
      
      const { parseLocationHints } = require('../../utils/coordinate-mapper');
      parseLocationHints.mockReturnValue([
        {
          type: 'relative',
          value: 'center',
          parsedValue: { reference: 'center' },
          confidence: 0.5
        }
      ]);
      
      const highlights = await service.analyzeResponse(
        text,
        'response-1',
        'query-1',
        'session-1',
        1
      );
      
      // Should be limited to maxHighlightsPerResponse (5)
      expect(highlights.length).toBeLessThanOrEqual(5);
    });

    it('should handle invalid coordinates gracefully', async () => {
      const text = 'The resistor is somewhere.';
      
      const { parseLocationHints, validateCoordinates } = require('../../utils/coordinate-mapper');
      parseLocationHints.mockReturnValue([]);
      validateCoordinates.mockReturnValue(false);
      
      const highlights = await service.analyzeResponse(
        text,
        'response-1',
        'query-1',
        'session-1',
        1
      );
      
      expect(highlights).toHaveLength(0);
    });
  });

  describe('highlight references', () => {
    it('should create highlight references for text linking', async () => {
      const text = 'The 1kΩ resistor R1 controls current flow.';
      
      const { parseLocationHints } = require('../../utils/coordinate-mapper');
      parseLocationHints.mockReturnValue([
        {
          type: 'coordinate',
          value: 'at 0.3, 0.4',
          parsedValue: { x: 0.3, y: 0.4 },
          confidence: 0.9
        }
      ]);
      
      const highlights = await service.analyzeResponse(
        text,
        'response-1',
        'query-1',
        'session-1',
        1
      );
      
      // Create references
      const mentions = [
        {
          componentType: 'resistor',
          description: '1kΩ resistor R1',
          mentionText: 'resistor',
          confidence: 0.8,
          startIndex: 8,
          endIndex: 16,
          contextualClues: ['1kΩ', 'R1']
        }
      ];
      
      const references = service.createHighlightReferences(highlights, text, mentions);
      
      expect(references).toHaveLength(1);
      expect(references[0].highlightId).toBe(highlights[0].id);
      expect(references[0].linkType).toBe('direct'); // High confidence
      expect(references[0].componentMention.componentType).toBe('resistor');
      expect(references[0].textPosition.start).toBe(8);
      expect(references[0].textPosition.end).toBe(16);
    });
  });

  describe('error handling', () => {
    it('should handle malformed text gracefully', async () => {
      const text = ''; // Empty text
      
      const highlights = await service.analyzeResponse(
        text,
        'response-1',
        'query-1',
        'session-1',
        1
      );
      
      expect(highlights).toHaveLength(0);
    });

    it('should handle service errors gracefully', async () => {
      const text = 'Valid text with resistor R1.';
      
      // Mock parseLocationHints to throw error
      const { parseLocationHints } = require('../../utils/coordinate-mapper');
      parseLocationHints.mockImplementation(() => {
        throw new Error('Parsing error');
      });
      
      const highlights = await service.analyzeResponse(
        text,
        'response-1',
        'query-1',
        'session-1',
        1
      );
      
      // Should return empty array on error
      expect(highlights).toHaveLength(0);
    });
  });

  describe('singleton service', () => {
    it('should return the same instance', () => {
      const service1 = getResponseLinkerService();
      const service2 = getResponseLinkerService();
      
      expect(service1).toBe(service2);
    });

    it('should use custom options on first call', () => {
      const customService = getResponseLinkerService({
        confidenceThreshold: 0.8,
        maxHighlightsPerResponse: 3
      });
      
      expect(customService).toBeInstanceOf(ResponseLinkerService);
    });
  });
});