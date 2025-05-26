import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { jest } from '@jest/globals';
import { ComponentSelectionOverlay } from '../../../components/pdf/ComponentSelectionOverlay';
import { ElectricalComponent } from '../../../types/electrical';

describe('ComponentSelectionOverlay', () => {
  const mockComponents: ElectricalComponent[] = [
    {
      id: 'comp-1',
      type: 'outlet',
      boundingBox: { x: 100, y: 100, width: 50, height: 30 },
      centerPoint: { x: 125, y: 115 },
      confidence: 0.95,
      properties: { voltage: '120V' },
      metadata: { source: 'auto_detection' }
    },
    {
      id: 'comp-2',
      type: 'switch',
      boundingBox: { x: 200, y: 150, width: 40, height: 40 },
      centerPoint: { x: 220, y: 170 },
      confidence: 0.88,
      properties: { type: 'single-pole' },
      metadata: { source: 'auto_detection' }
    }
  ];

  const defaultProps = {
    width: 800,
    height: 600,
    scale: 1,
    components: mockComponents,
    selectedComponents: [],
    onComponentSelect: jest.fn(),
    onSelectionClear: jest.fn(),
    selectionMode: 'single' as const,
    highlightColor: '#4CAF50',
    selectionColor: '#2196F3'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render SVG overlay with correct dimensions', () => {
      render(<ComponentSelectionOverlay {...defaultProps} />);
      
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '800');
      expect(svg).toHaveAttribute('height', '600');
    });

    it('should render components as interactive elements', () => {
      render(<ComponentSelectionOverlay {...defaultProps} />);
      
      const components = document.querySelectorAll('rect');
      expect(components).toHaveLength(mockComponents.length);
    });

    it('should show component labels on hover', () => {
      render(<ComponentSelectionOverlay {...defaultProps} />);
      
      const svg = document.querySelector('svg')!;
      
      // Simulate mouse move over first component
      fireEvent.mouseMove(svg, {
        clientX: 125, // Center of first component
        clientY: 115
      });

      // Component label should be visible
      const label = document.querySelector('text');
      expect(label).toBeInTheDocument();
    });
  });

  describe('Component Selection', () => {
    it('should select component on click in single mode', () => {
      const onComponentSelect = jest.fn();
      render(
        <ComponentSelectionOverlay 
          {...defaultProps} 
          onComponentSelect={onComponentSelect}
          selectionMode="single"
        />
      );
      
      const svg = document.querySelector('svg')!;
      
      // Click on first component
      fireEvent.mouseDown(svg, {
        clientX: 125,
        clientY: 115
      });

      expect(onComponentSelect).toHaveBeenCalledWith('comp-1', false);
    });

    it('should handle multiple selection in multiple mode', () => {
      const onComponentSelect = jest.fn();
      render(
        <ComponentSelectionOverlay 
          {...defaultProps} 
          onComponentSelect={onComponentSelect}
          selectionMode="multiple"
        />
      );
      
      const svg = document.querySelector('svg')!;
      
      // Click on first component with Ctrl
      fireEvent.mouseDown(svg, {
        clientX: 125,
        clientY: 115,
        ctrlKey: true
      });

      expect(onComponentSelect).toHaveBeenCalledWith('comp-1', true);
    });

    it('should clear selection when clicking empty area', () => {
      const onSelectionClear = jest.fn();
      render(
        <ComponentSelectionOverlay 
          {...defaultProps} 
          onSelectionClear={onSelectionClear}
        />
      );
      
      const svg = document.querySelector('svg')!;
      
      // Click on empty area
      fireEvent.mouseDown(svg, {
        clientX: 50,
        clientY: 50
      });

      expect(onSelectionClear).toHaveBeenCalled();
    });

    it('should handle area selection mode', () => {
      const onComponentSelect = jest.fn();
      render(
        <ComponentSelectionOverlay 
          {...defaultProps} 
          onComponentSelect={onComponentSelect}
          selectionMode="area"
        />
      );
      
      const svg = document.querySelector('svg')!;
      
      // Start drag selection
      fireEvent.mouseDown(svg, {
        clientX: 90,
        clientY: 90
      });

      fireEvent.mouseMove(svg, {
        clientX: 160,
        clientY: 140
      });

      fireEvent.mouseUp(svg);

      // Should select first component that intersects with selection area
      expect(onComponentSelect).toHaveBeenCalledWith('comp-1', true);
    });
  });

  describe('Visual Feedback', () => {
    it('should highlight selected components', () => {
      render(
        <ComponentSelectionOverlay 
          {...defaultProps} 
          selectedComponents={['comp-1']}
        />
      );
      
      const selectedRect = document.querySelector('rect[stroke="#2196F3"]');
      expect(selectedRect).toBeInTheDocument();
    });

    it('should show selection handles for selected components', () => {
      render(
        <ComponentSelectionOverlay 
          {...defaultProps} 
          selectedComponents={['comp-1']}
        />
      );
      
      const circles = document.querySelectorAll('circle');
      expect(circles.length).toBeGreaterThan(0); // Should have corner handles
    });

    it('should show selection box during area selection', () => {
      render(
        <ComponentSelectionOverlay 
          {...defaultProps} 
          selectionMode="area"
        />
      );
      
      const svg = document.querySelector('svg')!;
      
      // Start area selection
      fireEvent.mouseDown(svg, {
        clientX: 50,
        clientY: 50
      });

      fireEvent.mouseMove(svg, {
        clientX: 150,
        clientY: 150
      });

      // Selection box should be visible
      const selectionBox = document.querySelector('rect[stroke-dasharray="3,2"]');
      expect(selectionBox).toBeInTheDocument();
    });
  });

  describe('Scale Handling', () => {
    it('should adjust stroke width based on scale', () => {
      render(
        <ComponentSelectionOverlay 
          {...defaultProps} 
          scale={2}
          selectedComponents={['comp-1']}
        />
      );
      
      const selectedRect = document.querySelector('rect[stroke="#2196F3"]');
      expect(selectedRect).toHaveAttribute('stroke-width', '1'); // 2/2 = 1
    });

    it('should scale component coordinates correctly', () => {
      render(
        <ComponentSelectionOverlay 
          {...defaultProps} 
          scale={0.5}
        />
      );
      
      // Component should be rendered at scaled position
      const rects = document.querySelectorAll('rect');
      expect(rects.length).toBe(mockComponents.length);
    });
  });

  describe('Hover Effects', () => {
    it('should show hover state when mouse is over component', () => {
      render(<ComponentSelectionOverlay {...defaultProps} />);
      
      const svg = document.querySelector('svg')!;
      
      // Hover over first component
      fireEvent.mouseMove(svg, {
        clientX: 125,
        clientY: 115
      });

      // Should show hover highlight
      const hoverRect = document.querySelector('rect[stroke="#4CAF50"]');
      expect(hoverRect).toBeInTheDocument();
    });

    it('should clear hover state when mouse leaves', () => {
      render(<ComponentSelectionOverlay {...defaultProps} />);
      
      const svg = document.querySelector('svg')!;
      
      // Hover over component then leave
      fireEvent.mouseMove(svg, {
        clientX: 125,
        clientY: 115
      });

      fireEvent.mouseLeave(svg);

      // Hover highlight should be removed
      const hoverRect = document.querySelector('rect[stroke="#4CAF50"]');
      expect(hoverRect).not.toBeInTheDocument();
    });
  });

  describe('Component Types', () => {
    it('should display different component types correctly', () => {
      render(<ComponentSelectionOverlay {...defaultProps} />);
      
      // Both outlet and switch components should be rendered
      const rects = document.querySelectorAll('rect');
      expect(rects).toHaveLength(2);
    });

    it('should show component type in labels', () => {
      render(
        <ComponentSelectionOverlay 
          {...defaultProps} 
          selectedComponents={['comp-1']}
        />
      );
      
      const text = document.querySelector('text');
      expect(text?.textContent).toContain('outlet');
      expect(text?.textContent).toContain('comp-1');
    });
  });

  describe('Cursor States', () => {
    it('should show crosshair cursor in area selection mode', () => {
      render(
        <ComponentSelectionOverlay 
          {...defaultProps} 
          selectionMode="area"
        />
      );
      
      const svg = document.querySelector('svg')!;
      expect(svg.style.cursor).toBe('crosshair');
    });

    it('should show pointer cursor in other modes', () => {
      render(
        <ComponentSelectionOverlay 
          {...defaultProps} 
          selectionMode="single"
        />
      );
      
      const svg = document.querySelector('svg')!;
      expect(svg.style.cursor).toBe('pointer');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty components array', () => {
      render(
        <ComponentSelectionOverlay 
          {...defaultProps} 
          components={[]}
        />
      );
      
      const rects = document.querySelectorAll('rect');
      expect(rects).toHaveLength(0);
    });

    it('should handle components with invalid bounds', () => {
      const invalidComponents = [
        {
          ...mockComponents[0],
          boundingBox: { x: NaN, y: NaN, width: 0, height: 0 }
        }
      ];
      
      render(
        <ComponentSelectionOverlay 
          {...defaultProps} 
          components={invalidComponents}
        />
      );
      
      // Should not crash and should render something
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should handle very small scale values', () => {
      render(
        <ComponentSelectionOverlay 
          {...defaultProps} 
          scale={0.01}
        />
      );
      
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should handle very large scale values', () => {
      render(
        <ComponentSelectionOverlay 
          {...defaultProps} 
          scale={100}
        />
      );
      
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });
});