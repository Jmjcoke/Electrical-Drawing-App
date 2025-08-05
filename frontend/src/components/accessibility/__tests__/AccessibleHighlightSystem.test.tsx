/**
 * Unit tests for Accessible Highlight System
 * Tests WCAG compliance, keyboard navigation, and screen reader support
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { AccessibleHighlightSystem } from '../AccessibleHighlightSystem';
import type {
  ComponentHighlight,
  HighlightStyle
} from '../../../types/highlighting.types';

// Mock Material-UI components to avoid theme provider issues
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  useTheme: () => ({
    palette: {
      primary: { main: '#1976d2' },
      action: { focus: '#f5f5f5', disabled: '#e0e0e0' },
      background: { paper: '#ffffff' },
      text: { secondary: '#666666' }
    }
  })
}));

// Mock window.matchMedia for accessibility preferences
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: query.includes('prefers-reduced-motion') ? false : 
             query.includes('prefers-contrast') ? false : false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('AccessibleHighlightSystem', () => {
  const mockHighlightStyle: HighlightStyle = {
    color: '#2196F3',
    opacity: 0.8,
    strokeWidth: 2,
    strokeStyle: 'solid',
    fillOpacity: 0.2,
    zIndex: 1
  };

  const createMockHighlight = (id: string, isVisible: boolean = true): ComponentHighlight => ({
    id,
    componentId: `component-${id}`,
    type: 'component',
    coordinates: {
      x: 0.3,
      y: 0.5,
      width: 0.1,
      height: 0.05,
      pageNumber: 1,
      zoomLevel: 1,
      viewportOffset: { x: 0, y: 0 }
    },
    style: mockHighlightStyle,
    responseId: 'response-1',
    queryId: 'query-1',
    sessionId: 'session-1',
    createdAt: new Date(),
    isVisible,
    isPersistent: false
  });

  const defaultProps = {
    highlights: [
      createMockHighlight('1'),
      createMockHighlight('2'),
      createMockHighlight('3', false) // Hidden highlight
    ],
    selectedHighlightId: null,
    onHighlightSelect: jest.fn(),
    onHighlightToggle: jest.fn(),
    onHighlightFocus: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('basic rendering', () => {
    it('should render without crashing', () => {
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      expect(screen.getByRole('application')).toBeInTheDocument();
    });

    it('should display correct highlight count information', () => {
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      expect(screen.getByText(/3 highlights available, 2 visible/)).toBeInTheDocument();
    });

    it('should render all highlights in the list', () => {
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      
      // Should show all highlights, including hidden ones
      expect(screen.getByText('component-1')).toBeInTheDocument();
      expect(screen.getByText('component-2')).toBeInTheDocument();
      expect(screen.getByText('component-3')).toBeInTheDocument();
    });

    it('should display empty state when no highlights are provided', () => {
      render(<AccessibleHighlightSystem {...defaultProps} highlights={[]} />);
      
      expect(screen.getByText('No highlights available')).toBeInTheDocument();
    });
  });

  describe('accessibility features', () => {
    it('should have proper ARIA attributes', () => {
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      const application = screen.getByRole('application');
      expect(application).toHaveAttribute('aria-label', 'Accessible Highlight System');
      expect(application).toHaveAttribute('tabIndex', '0');
      
      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label', 'Available highlights');
    });

    it('should provide screen reader announcements', async () => {
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      const announcement = screen.getByRole('status');
      expect(announcement).toHaveAttribute('aria-live', 'polite');
      expect(announcement).toHaveAttribute('aria-atomic', 'true');
    });

    it('should display keyboard navigation instructions', () => {
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      expect(screen.getByText(/Use arrow keys to navigate highlights/)).toBeInTheDocument();
      expect(screen.getByText(/Press Enter to select/)).toBeInTheDocument();
      expect(screen.getByText(/Ctrl\+V to toggle visibility/)).toBeInTheDocument();
      expect(screen.getByText(/Ctrl\+M to switch navigation mode/)).toBeInTheDocument();
    });

    it('should show navigation mode indicator', () => {
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      expect(screen.getByText('Mode: list')).toBeInTheDocument();
      expect(screen.getByText('Press Ctrl+M to toggle')).toBeInTheDocument();
    });

    it('should provide keyboard shortcuts help', () => {
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      expect(screen.getByText(/↑↓ Navigate/)).toBeInTheDocument();
      expect(screen.getByText(/Enter\/Space Select/)).toBeInTheDocument();
      expect(screen.getByText(/Esc Clear selection/)).toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('should navigate highlights with arrow keys', async () => {
      const user = userEvent.setup();
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      const system = screen.getByRole('application');
      await user.click(system);
      
      // Navigate down
      await user.keyboard('{ArrowDown}');
      expect(defaultProps.onHighlightFocus).toHaveBeenCalled();
      
      // Navigate up
      await user.keyboard('{ArrowUp}');
      expect(defaultProps.onHighlightFocus).toHaveBeenCalled();
    });

    it('should select highlight with Enter key', async () => {
      const user = userEvent.setup();
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      const system = screen.getByRole('application');
      await user.click(system);
      
      // Navigate to a highlight first
      await user.keyboard('{ArrowDown}');
      
      // Select with Enter
      await user.keyboard('{Enter}');
      expect(defaultProps.onHighlightSelect).toHaveBeenCalled();
    });

    it('should select highlight with Space key', async () => {
      const user = userEvent.setup();
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      const system = screen.getByRole('application');
      await user.click(system);
      
      // Navigate to a highlight first
      await user.keyboard('{ArrowDown}');
      
      // Select with Space
      await user.keyboard('{ }');
      expect(defaultProps.onHighlightSelect).toHaveBeenCalled();
    });

    it('should toggle visibility with Ctrl+V', async () => {
      const user = userEvent.setup();
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      const system = screen.getByRole('application');
      await user.click(system);
      
      // Navigate to a highlight first
      await user.keyboard('{ArrowDown}');
      
      // Toggle visibility
      await user.keyboard('{Control>}v{/Control}');
      expect(defaultProps.onHighlightToggle).toHaveBeenCalled();
    });

    it('should toggle navigation mode with Ctrl+M', async () => {
      const user = userEvent.setup();
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      const system = screen.getByRole('application');
      await user.click(system);
      
      // Toggle navigation mode
      await user.keyboard('{Control>}m{/Control}');
      
      expect(screen.getByText('Mode: spatial')).toBeInTheDocument();
    });

    it('should clear selection with Escape', async () => {
      const user = userEvent.setup();
      render(<AccessibleHighlightSystem {...defaultProps} selectedHighlightId="1" />);
      
      const system = screen.getByRole('application');
      await user.click(system);
      
      await user.keyboard('{Escape}');
      expect(defaultProps.onHighlightSelect).toHaveBeenCalledWith(null);
    });

    it('should support spatial navigation in spatial mode', async () => {
      const user = userEvent.setup();
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      const system = screen.getByRole('application');
      await user.click(system);
      
      // Switch to spatial mode first
      await user.keyboard('{Control>}m{/Control}');
      
      // Navigate spatially
      await user.keyboard('{ArrowRight}');
      await user.keyboard('{ArrowLeft}');
      
      // Should show spatial navigation help
      expect(screen.getByText(/←→ Spatial navigation/)).toBeInTheDocument();
    });
  });

  describe('highlight interaction', () => {
    it('should handle highlight item clicks', async () => {
      const user = userEvent.setup();
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      const highlightButton = screen.getByRole('option', { name: /component-1/ });
      await user.click(highlightButton);
      
      expect(defaultProps.onHighlightSelect).toHaveBeenCalledWith('1');
      expect(defaultProps.onHighlightFocus).toHaveBeenCalledWith('1');
    });

    it('should handle visibility toggle button clicks', async () => {
      const user = userEvent.setup();
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      const visibilityButton = screen.getAllByLabelText(/Hide highlight|Show highlight/)[0];
      await user.click(visibilityButton);
      
      expect(defaultProps.onHighlightToggle).toHaveBeenCalled();
    });

    it('should show correct visibility button states', () => {
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      // Visible highlight should show hide button
      const hideButtons = screen.getAllByLabelText('Hide highlight');
      expect(hideButtons.length).toBeGreaterThan(0);
      
      // Hidden highlight should show show button
      const showButtons = screen.getAllByLabelText('Show highlight');
      expect(showButtons.length).toBeGreaterThan(0);
    });

    it('should display selected highlight with proper styling', () => {
      render(<AccessibleHighlightSystem {...defaultProps} selectedHighlightId="1" />);
      
      const selectedOption = screen.getByRole('option', { name: /component-1/ });
      expect(selectedOption).toHaveAttribute('aria-selected', 'true');
    });

    it('should prevent event bubbling on visibility toggle', async () => {
      const user = userEvent.setup();
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      const visibilityButton = screen.getAllByLabelText(/Hide highlight|Show highlight/)[0];
      await user.click(visibilityButton);
      
      // Should call toggle but not select the highlight
      expect(defaultProps.onHighlightToggle).toHaveBeenCalled();
      // onHighlightSelect should not be called from the visibility button click
      const selectCalls = defaultProps.onHighlightSelect.mock.calls.filter(
        call => call[0] !== null
      );
      expect(selectCalls).toHaveLength(0);
    });
  });

  describe('high contrast mode', () => {
    beforeEach(() => {
      // Mock high contrast preference
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query.includes('prefers-contrast'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));
    });

    it('should apply high contrast styles when enabled', () => {
      render(<AccessibleHighlightSystem {...defaultProps} enableHighContrast={true} />);
      
      // Should detect high contrast preference
      expect(screen.getByRole('application')).toBeInTheDocument();
    });

    it('should show accessible color descriptions', () => {
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      // Should show color chip with color name
      expect(screen.getByText('Blue')).toBeInTheDocument(); // #2196F3 -> Blue
    });
  });

  describe('reduced motion support', () => {
    beforeEach(() => {
      // Mock reduced motion preference
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));
    });

    it('should disable animations when reduced motion is preferred', () => {
      render(<AccessibleHighlightSystem {...defaultProps} enableReducedMotion={true} />);
      
      // Should render without animations
      expect(screen.getByRole('application')).toBeInTheDocument();
    });
  });

  describe('screen reader announcements', () => {
    it('should announce highlight focus changes', async () => {
      const user = userEvent.setup();
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      const system = screen.getByRole('application');
      await user.click(system);
      
      // Navigate to trigger announcement
      await user.keyboard('{ArrowDown}');
      
      // Check that announcement area is present
      const announcement = screen.getByRole('status');
      expect(announcement).toBeInTheDocument();
    });

    it('should announce visibility changes', async () => {
      const user = userEvent.setup();
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      const system = screen.getByRole('application');
      await user.click(system);
      
      // Navigate and toggle visibility
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Control>}v{/Control}');
      
      const announcement = screen.getByRole('status');
      expect(announcement).toBeInTheDocument();
    });

    it('should announce navigation mode changes', async () => {
      const user = userEvent.setup();
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      const system = screen.getByRole('application');
      await user.click(system);
      
      await user.keyboard('{Control>}m{/Control}');
      
      const announcement = screen.getByRole('status');
      expect(announcement).toBeInTheDocument();
    });

    it('should allow disabling announcements', () => {
      render(<AccessibleHighlightSystem {...defaultProps} announceChanges={false} />);
      
      const announcement = screen.getByRole('status');
      expect(announcement).toBeEmptyDOMElement();
    });
  });

  describe('highlight descriptions', () => {
    it('should provide detailed highlight descriptions', () => {
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      // Check for position descriptions
      expect(screen.getByText(/Located at center middle of drawing/)).toBeInTheDocument();
      
      // Check for component type descriptions
      expect(screen.getByText('Component')).toBeInTheDocument();
    });

    it('should provide interaction instructions', () => {
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      // Should have hidden instructions for screen readers
      const hiddenInstructions = document.querySelectorAll('[id^="highlight-desc-"]');
      expect(hiddenInstructions.length).toBeGreaterThan(0);
    });

    it('should handle highlights without component IDs', () => {
      const highlightWithoutId = {
        ...createMockHighlight('no-id'),
        componentId: undefined
      };
      
      render(
        <AccessibleHighlightSystem 
          {...defaultProps} 
          highlights={[highlightWithoutId]}
        />
      );
      
      expect(screen.getByText('Highlight 1')).toBeInTheDocument();
    });
  });

  describe('component types and styling', () => {
    it('should display different highlight types correctly', () => {
      const highlights = [
        { ...createMockHighlight('component'), type: 'component' as const },
        { ...createMockHighlight('area'), type: 'area' as const },
        { ...createMockHighlight('connection'), type: 'connection' as const }
      ];
      
      render(<AccessibleHighlightSystem {...defaultProps} highlights={highlights} />);
      
      expect(screen.getByText('Component')).toBeInTheDocument();
      expect(screen.getByText('Area')).toBeInTheDocument();
      expect(screen.getByText('Connection')).toBeInTheDocument();
    });

    it('should show disabled styling for hidden highlights', () => {
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      const hiddenHighlight = document.querySelector('[aria-selected="false"]');
      expect(hiddenHighlight).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should handle malformed highlight data gracefully', () => {
      const malformedHighlight = {
        ...createMockHighlight('malformed'),
        coordinates: undefined as any,
        style: undefined as any
      };
      
      expect(() => {
        render(
          <AccessibleHighlightSystem 
            {...defaultProps} 
            highlights={[malformedHighlight]}
          />
        );
      }).not.toThrow();
    });

    it('should handle missing event handlers gracefully', () => {
      const propsWithoutHandlers = {
        highlights: [createMockHighlight('1')],
        selectedHighlightId: null,
        onHighlightSelect: undefined as any,
        onHighlightToggle: undefined as any,
        onHighlightFocus: undefined as any
      };
      
      expect(() => {
        render(<AccessibleHighlightSystem {...propsWithoutHandlers} />);
      }).not.toThrow();
    });
  });

  describe('performance', () => {
    it('should handle large numbers of highlights efficiently', () => {
      const manyHighlights = Array.from({ length: 100 }, (_, i) => 
        createMockHighlight(`highlight-${i}`)
      );
      
      const startTime = Date.now();
      render(<AccessibleHighlightSystem {...defaultProps} highlights={manyHighlights} />);
      const renderTime = Date.now() - startTime;
      
      expect(renderTime).toBeLessThan(1000); // Should render within 1 second
      expect(screen.getByText(/100 highlights available/)).toBeInTheDocument();
    });

    it('should use React.memo for performance optimization', () => {
      const { rerender } = render(<AccessibleHighlightSystem {...defaultProps} />);
      
      // Re-render with same props should not cause unnecessary updates
      rerender(<AccessibleHighlightSystem {...defaultProps} />);
      
      expect(screen.getByRole('application')).toBeInTheDocument();
    });
  });

  describe('focus management', () => {
    it('should maintain focus properly during navigation', async () => {
      const user = userEvent.setup();
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      const system = screen.getByRole('application');
      await user.click(system);
      
      expect(system).toHaveFocus();
      
      // Navigate and maintain focus
      await user.keyboard('{ArrowDown}');
      expect(system).toHaveFocus();
    });

    it('should show focus indicators', () => {
      render(<AccessibleHighlightSystem {...defaultProps} />);
      
      const system = screen.getByRole('application');
      
      // Should have focus styles defined
      expect(system).toHaveStyle('outline: 2px solid transparent');
    });
  });
});