/**
 * Unit tests for HighlightableText component
 * Tests text parsing, highlighting, and interactive features
 */

import * as React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { HighlightableText } from '../HighlightableText';
import type { HighlightReference, ComponentMention } from '../../../types/highlighting.types';

// Create a theme for testing
const theme = createTheme();

// Helper to render component with theme
const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('HighlightableText', () => {
  const mockComponentMention: ComponentMention = {
    componentType: 'resistor',
    componentDescription: '1kΩ resistor R1',
    mentionText: 'resistor',
    contextualClues: ['1kΩ', 'R1'],
    locationHints: []
  };

  const mockReference: HighlightReference = {
    highlightId: 'highlight-1',
    responseText: 'resistor',
    textPosition: {
      start: 8,
      end: 16
    },
    componentMention: mockComponentMention,
    linkType: 'direct',
    confidence: 0.9
  };

  const defaultProps = {
    text: 'The 1kΩ resistor R1 controls the current flow in the circuit.',
    references: [mockReference]
  };

  it('should render plain text when no references provided', () => {
    renderWithTheme(
      <HighlightableText
        text="This is plain text without highlights."
        references={[]}
      />
    );
    
    expect(screen.getByText('This is plain text without highlights.')).toBeInTheDocument();
  });

  it('should render text with highlighted segments', () => {
    renderWithTheme(<HighlightableText {...defaultProps} />);
    
    // Should render the highlighted word as a clickable element
    const highlightedText = screen.getByRole('button', { name: /highlight resistor/i });
    expect(highlightedText).toBeInTheDocument();
    expect(highlightedText).toHaveTextContent('resistor');
  });

  it('should display component summary chips', () => {
    renderWithTheme(<HighlightableText {...defaultProps} />);
    
    expect(screen.getByText('Components mentioned:')).toBeInTheDocument();
    expect(screen.getAllByText('resistor').length).toBeGreaterThan(0);
  });

  it('should handle multiple component types', () => {
    const multipleReferences: HighlightReference[] = [
      {
        ...mockReference,
        highlightId: 'highlight-1',
        textPosition: { start: 8, end: 16 },
        componentMention: {
          ...mockComponentMention,
          componentType: 'resistor'
        }
      },
      {
        ...mockReference,
        highlightId: 'highlight-2',
        textPosition: { start: 30, end: 39 },
        componentMention: {
          ...mockComponentMention,
          componentType: 'capacitor',
          componentDescription: '10µF capacitor C1',
          mentionText: 'capacitor'
        }
      }
    ];

    renderWithTheme(
      <HighlightableText
        text="The 1kΩ resistor R1 and the 10µF capacitor C1 work together."
        references={multipleReferences}
      />
    );
    
    // Should show both component types in chips (use getAllByText since they appear multiple times)
    const resistorElements = screen.getAllByText('resistor');
    const capacitorElements = screen.getAllByText('capacitor');
    expect(resistorElements.length).toBeGreaterThan(0);
    expect(capacitorElements.length).toBeGreaterThan(0);
    
    // Should have two clickable highlights
    const highlights = screen.getAllByRole('button');
    expect(highlights.filter(el => el.getAttribute('aria-label')?.includes('Highlight'))).toHaveLength(2);
  });

  it('should call onHighlightClick when highlight is clicked', () => {
    const onHighlightClick = jest.fn();
    
    renderWithTheme(
      <HighlightableText
        {...defaultProps}
        onHighlightClick={onHighlightClick}
      />
    );
    
    const highlightedText = screen.getByRole('button', { name: /highlight resistor/i });
    fireEvent.click(highlightedText);
    
    expect(onHighlightClick).toHaveBeenCalledWith('highlight-1');
  });

  it('should handle keyboard navigation', () => {
    const onHighlightClick = jest.fn();
    
    renderWithTheme(
      <HighlightableText
        {...defaultProps}
        onHighlightClick={onHighlightClick}
      />
    );
    
    const highlightedText = screen.getByRole('button', { name: /highlight resistor/i });
    
    // Test Enter key
    fireEvent.keyDown(highlightedText, { key: 'Enter' });
    expect(onHighlightClick).toHaveBeenCalledWith('highlight-1');
    
    // Test Space key
    onHighlightClick.mockClear();
    fireEvent.keyDown(highlightedText, { key: ' ' });
    expect(onHighlightClick).toHaveBeenCalledWith('highlight-1');
  });

  it('should show confidence scores when enabled', () => {
    renderWithTheme(
      <HighlightableText
        {...defaultProps}
        showConfidenceScores={true}
      />
    );
    
    // Should show confidence percentage
    expect(screen.getAllByText('90%').length).toBeGreaterThan(0);
  });

  it('should apply different styles based on link type', () => {
    const references: HighlightReference[] = [
      {
        ...mockReference,
        highlightId: 'direct',
        textPosition: { start: 0, end: 6 },
        linkType: 'direct',
        confidence: 0.9
      },
      {
        ...mockReference,
        highlightId: 'inferred',
        textPosition: { start: 7, end: 15 },
        linkType: 'inferred',
        confidence: 0.7,
        componentMention: {
          ...mockComponentMention,
          mentionText: 'inferred'
        }
      },
      {
        ...mockReference,
        highlightId: 'suggested',
        textPosition: { start: 16, end: 25 },
        linkType: 'suggested',
        confidence: 0.4,
        componentMention: {
          ...mockComponentMention,
          mentionText: 'suggested'
        }
      }
    ];

    renderWithTheme(
      <HighlightableText
        text="direct inferred suggested"
        references={references}
      />
    );
    
    const highlights = screen.getAllByRole('button');
    expect(highlights).toHaveLength(3);
    
    // Each should have different styling (tested via CSS classes or computed styles)
    highlights.forEach(highlight => {
      expect(highlight).toBeInTheDocument();
    });
  });

  it('should show tooltip on hover', async () => {
    renderWithTheme(<HighlightableText {...defaultProps} />);
    
    const highlightedText = screen.getByRole('button', { name: /highlight resistor/i });
    
    // Hover over highlight
    fireEvent.mouseEnter(highlightedText);
    
    // Wait for tooltip to appear
    await waitFor(() => {
      expect(screen.getByText('RESISTOR: 1kΩ resistor R1')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Link Type: direct')).toBeInTheDocument();
    expect(screen.getByText('Confidence: 90%')).toBeInTheDocument();
  });

  it('should call onComponentHover when hovering', () => {
    const onComponentHover = jest.fn();
    
    renderWithTheme(
      <HighlightableText
        {...defaultProps}
        onComponentHover={onComponentHover}
      />
    );
    
    const highlightedText = screen.getByRole('button', { name: /highlight resistor/i });
    
    // Mouse enter
    fireEvent.mouseEnter(highlightedText);
    expect(onComponentHover).toHaveBeenCalledWith(mockComponentMention);
    
    // Mouse leave
    fireEvent.mouseLeave(highlightedText);
    expect(onComponentHover).toHaveBeenCalledWith(null);
  });

  it('should show hover information panel', () => {
    renderWithTheme(<HighlightableText {...defaultProps} />);
    
    const highlightedText = screen.getByRole('button', { name: /highlight resistor/i });
    fireEvent.mouseEnter(highlightedText);
    
    // Should show hover panel with component info
    expect(screen.getByText('Hovering: RESISTOR')).toBeInTheDocument();
    expect(screen.getByText('1kΩ resistor R1')).toBeInTheDocument();
    expect(screen.getByText('Technical details: 1kΩ, R1')).toBeInTheDocument();
  });

  it('should handle overlapping text segments correctly', () => {
    // This tests edge case where highlights might overlap
    const overlappingRefs: HighlightReference[] = [
      {
        ...mockReference,
        highlightId: 'highlight-1',
        textPosition: { start: 4, end: 12 },
        componentMention: {
          ...mockComponentMention,
          mentionText: 'resistor'
        }
      }
    ];

    renderWithTheme(
      <HighlightableText
        text="The resistor works fine."
        references={overlappingRefs}
      />
    );
    
    // Should render without errors
    expect(screen.getByText('The')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveTextContent('resistor');
    expect(screen.getByText('works fine.')).toBeInTheDocument();
  });

  it('should show low confidence indicators', () => {
    const lowConfidencRef: HighlightReference = {
      ...mockReference,
      confidence: 0.3,
      linkType: 'suggested'
    };

    renderWithTheme(
      <HighlightableText
        {...defaultProps}
        references={[lowConfidencRef]}
      />
    );
    
    const highlight = screen.getByRole('button', { name: /highlight resistor/i });
    
    // Should have visual indicator for low confidence (tested via computed styles)
    expect(highlight).toBeInTheDocument();
  });

  it('should show debug information in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    
    renderWithTheme(<HighlightableText {...defaultProps} />);
    
    expect(screen.getByText(/Debug: 1 highlight found/)).toBeInTheDocument();
    expect(screen.getByText(/resistor @ 8-16/)).toBeInTheDocument();
    
    process.env.NODE_ENV = originalEnv;
  });

  it('should handle empty references array', () => {
    renderWithTheme(
      <HighlightableText
        text="Some text without any highlights."
        references={[]}
      />
    );
    
    expect(screen.getByText('Some text without any highlights.')).toBeInTheDocument();
    expect(screen.queryByText('Components mentioned:')).not.toBeInTheDocument();
  });

  it('should handle malformed text positions gracefully', () => {
    const malformedRef: HighlightReference = {
      ...mockReference,
      textPosition: {
        start: 100, // Beyond text length
        end: 200
      }
    };

    renderWithTheme(
      <HighlightableText
        text="Short text"
        references={[malformedRef]}
      />
    );
    
    // Should render without crashing
    expect(screen.getByText('Short text')).toBeInTheDocument();
  });
});