/**
 * Accessible Highlight System
 * WCAG-compliant highlighting with screen reader support and keyboard navigation
 */

import * as React from 'react';
import { 
  useRef, 
  useEffect, 
  useCallback, 
  useState, 
  useMemo,
  KeyboardEvent
} from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Alert,
  Chip,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import type {
  ComponentHighlight,
  HighlightStyle
} from '../../types/highlighting.types';

interface AccessibleHighlightSystemProps {
  readonly highlights: ComponentHighlight[];
  readonly selectedHighlightId: string | null;
  readonly onHighlightSelect: (highlightId: string | null) => void;
  readonly onHighlightToggle: (highlightId: string, visible: boolean) => void;
  readonly onHighlightFocus: (highlightId: string) => void;
  readonly enableHighContrast?: boolean;
  readonly enableReducedMotion?: boolean;
  readonly announceChanges?: boolean;
  readonly className?: string;
}

interface HighlightDescriptor {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly position: string;
  readonly type: string;
  readonly isVisible: boolean;
  readonly colorDescription: string;
  readonly instructions: string;
}

interface NavigationState {
  readonly currentIndex: number;
  readonly totalCount: number;
  readonly navigationMode: 'list' | 'spatial';
}

export const AccessibleHighlightSystem: React.FC<AccessibleHighlightSystemProps> = React.memo((props) => {
  const {
    highlights,
    selectedHighlightId,
    onHighlightSelect,
    onHighlightToggle,
    onHighlightFocus,
    enableHighContrast = false,
    enableReducedMotion = false,
    announceChanges = true,
    className
  } = props;

  const [navigationState, setNavigationState] = useState<NavigationState>({
    currentIndex: -1,
    totalCount: 0,
    navigationMode: 'list'
  });
  
  const [announceText, setAnnounceText] = useState<string>('');
  const [focusedHighlightId, setFocusedHighlightId] = useState<string | null>(null);
  
  const listRef = useRef<HTMLUListElement>(null);
  const announcementRef = useRef<HTMLDivElement>(null);

  // Detect user preferences for accessibility
  const userPreferences = useMemo(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
    
    return {
      reducedMotion: enableReducedMotion || prefersReducedMotion,
      highContrast: enableHighContrast || prefersHighContrast
    };
  }, [enableHighContrast, enableReducedMotion]);

  // Create accessible highlight descriptors
  const highlightDescriptors = useMemo((): HighlightDescriptor[] => {
    return highlights.map((highlight, index) => ({
      id: highlight.id,
      title: highlight.componentId || `Highlight ${index + 1}`,
      description: createHighlightDescription(highlight),
      position: createPositionDescription(highlight),
      type: createTypeDescription(highlight.type),
      isVisible: highlight.isVisible,
      colorDescription: createColorDescription(highlight.style.color),
      instructions: createInteractionInstructions(highlight)
    }));
  }, [highlights]);

  // Update navigation state when highlights change
  useEffect(() => {
    setNavigationState(prev => ({
      ...prev,
      totalCount: highlightDescriptors.length,
      currentIndex: Math.min(prev.currentIndex, highlightDescriptors.length - 1)
    }));
  }, [highlightDescriptors.length]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const { key, ctrlKey } = event;

    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        navigateHighlight('next');
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        navigateHighlight('previous');
        break;
        
      case 'ArrowRight':
        if (navigationState.navigationMode === 'spatial') {
          event.preventDefault();
          navigateHighlightSpatial('right');
        }
        break;
        
      case 'ArrowLeft':
        if (navigationState.navigationMode === 'spatial') {
          event.preventDefault();
          navigateHighlightSpatial('left');
        }
        break;
        
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (navigationState.currentIndex >= 0) {
          const highlight = highlightDescriptors[navigationState.currentIndex];
          selectHighlight(highlight.id);
        }
        break;
        
      case 'v':
        if (ctrlKey) {
          event.preventDefault();
          toggleCurrentHighlightVisibility();
        }
        break;
        
      case 'm':
        if (ctrlKey) {
          event.preventDefault();
          toggleNavigationMode();
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        onHighlightSelect(null);
        announceToScreenReader('Selection cleared');
        break;
    }
  }, [
    navigationState, 
    highlightDescriptors, 
    navigateHighlight, 
    navigateHighlightSpatial, 
    selectHighlight, 
    toggleCurrentHighlightVisibility, 
    toggleNavigationMode, 
    onHighlightSelect, 
    announceToScreenReader
  ]);

  // Navigate to next/previous highlight
  const navigateHighlight = useCallback((direction: 'next' | 'previous') => {
    const visibleHighlights = highlightDescriptors.filter(h => h.isVisible);
    if (visibleHighlights.length === 0) return;

    const currentVisibleIndex = visibleHighlights.findIndex(h => h.id === focusedHighlightId);
    let newIndex: number;

    if (direction === 'next') {
      newIndex = currentVisibleIndex < visibleHighlights.length - 1 ? currentVisibleIndex + 1 : 0;
    } else {
      newIndex = currentVisibleIndex > 0 ? currentVisibleIndex - 1 : visibleHighlights.length - 1;
    }

    const newHighlight = visibleHighlights[newIndex];
    focusHighlight(newHighlight.id);
    
    setNavigationState(prev => ({
      ...prev,
      currentIndex: highlightDescriptors.findIndex(h => h.id === newHighlight.id)
    }));
  }, [highlightDescriptors, focusedHighlightId, focusHighlight]);

  // Navigate highlights spatially (by position)
  const navigateHighlightSpatial = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    if (navigationState.currentIndex < 0) return;

    const currentHighlight = highlights[navigationState.currentIndex];
    if (!currentHighlight) return;

    const visibleHighlights = highlights.filter(h => h.isVisible);
    const spatialNeighbor = findSpatialNeighbor(currentHighlight, visibleHighlights, direction);

    if (spatialNeighbor) {
      const newIndex = highlightDescriptors.findIndex(h => h.id === spatialNeighbor.id);
      setNavigationState(prev => ({ ...prev, currentIndex: newIndex }));
      focusHighlight(spatialNeighbor.id);
    }
  }, [navigationState.currentIndex, highlights, highlightDescriptors]);

  // Focus on a specific highlight
  const focusHighlight = useCallback((highlightId: string) => {
    setFocusedHighlightId(highlightId);
    onHighlightFocus(highlightId);
    
    const descriptor = highlightDescriptors.find(h => h.id === highlightId);
    if (descriptor) {
      announceToScreenReader(
        `Focused on ${descriptor.title}. ${descriptor.description}. ${descriptor.position}. ${descriptor.instructions}`
      );
    }
  }, [highlightDescriptors, onHighlightFocus, announceToScreenReader]);

  // Select a highlight
  const selectHighlight = useCallback((highlightId: string) => {
    onHighlightSelect(highlightId);
    
    const descriptor = highlightDescriptors.find(h => h.id === highlightId);
    if (descriptor) {
      announceToScreenReader(`Selected ${descriptor.title}. ${descriptor.description}`);
    }
  }, [highlightDescriptors, onHighlightSelect, announceToScreenReader]);

  // Toggle current highlight visibility
  const toggleCurrentHighlightVisibility = useCallback(() => {
    if (navigationState.currentIndex < 0) return;

    const highlight = highlightDescriptors[navigationState.currentIndex];
    if (highlight) {
      onHighlightToggle(highlight.id, !highlight.isVisible);
      announceToScreenReader(
        `${highlight.title} ${highlight.isVisible ? 'hidden' : 'shown'}`
      );
    }
  }, [navigationState.currentIndex, highlightDescriptors, onHighlightToggle, announceToScreenReader]);

  // Toggle navigation mode
  const toggleNavigationMode = useCallback(() => {
    const newMode = navigationState.navigationMode === 'list' ? 'spatial' : 'list';
    setNavigationState(prev => ({ ...prev, navigationMode: newMode }));
    announceToScreenReader(`Navigation mode changed to ${newMode}`);
  }, [navigationState.navigationMode, announceToScreenReader]);

  // Announce text to screen readers
  const announceToScreenReader = useCallback((text: string) => {
    if (!announceChanges) return;

    setAnnounceText(text);
    
    // Clear announcement after a short delay to allow for new announcements
    setTimeout(() => setAnnounceText(''), 1000);
  }, [announceChanges]);

  // Get WCAG-compliant colors
  const getAccessibleStyle = useCallback((style: HighlightStyle) => {
    if (!userPreferences.highContrast) return style;

    // High contrast color mappings
    const highContrastColors: Record<string, string> = {
      '#FF9800': '#000000', // Orange to Black
      '#4CAF50': '#000000', // Green to Black  
      '#2196F3': '#000000', // Blue to Black
      '#F44336': '#FFFFFF', // Red to White
      '#9C27B0': '#FFFFFF', // Purple to White
    };

    return {
      ...style,
      color: highContrastColors[style.color] || style.color,
      strokeWidth: Math.max(style.strokeWidth, 3), // Ensure minimum stroke width
      opacity: Math.max(style.opacity, 0.8) // Ensure minimum opacity
    };
  }, [userPreferences.highContrast]);

  // Handle click on highlight item
  const handleHighlightClick = useCallback((highlightId: string, index: number) => {
    setNavigationState(prev => ({ ...prev, currentIndex: index }));
    focusHighlight(highlightId);
    selectHighlight(highlightId);
  }, [focusHighlight, selectHighlight]);

  return (
    <Box 
      className={className}
      role="application"
      aria-label="Accessible Highlight System"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      sx={{
        outline: '2px solid transparent',
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2
        }
      }}
    >
      {/* Screen reader announcements */}
      <Box sx={visuallyHidden}>
        <div 
          ref={announcementRef}
          role="status" 
          aria-live="polite" 
          aria-atomic="true"
        >
          {announceText}
        </div>
      </Box>

      {/* Instructions */}
      <Alert 
        severity="info" 
        icon={<InfoIcon />}
        sx={{ mb: 2 }}
      >
        <Typography variant="body2">
          Use arrow keys to navigate highlights. Press Enter to select, Ctrl+V to toggle visibility, 
          Ctrl+M to switch navigation mode. {highlightDescriptors.length} highlights available, {' '}
          {highlightDescriptors.filter(h => h.isVisible).length} visible.
        </Typography>
      </Alert>

      {/* Navigation mode indicator */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Chip 
          label={`Mode: ${navigationState.navigationMode}`}
          size="small"
          color="primary"
          variant="outlined"
        />
        <Typography variant="caption" color="text.secondary">
          Press Ctrl+M to toggle
        </Typography>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Highlight list */}
      <List 
        ref={listRef}
        role="listbox"
        aria-label="Available highlights"
        aria-activedescendant={focusedHighlightId || undefined}
        sx={{ 
          maxHeight: 400, 
          overflow: 'auto',
          '& .MuiListItem-root': {
            transition: userPreferences.reducedMotion ? 'none' : 'background-color 0.2s ease',
          }
        }}
      >
        {highlightDescriptors.map((descriptor, index) => {
          const isSelected = selectedHighlightId === descriptor.id;
          const isFocused = focusedHighlightId === descriptor.id;
          
          return (
            <ListItem 
              key={descriptor.id}
              disablePadding
              sx={{
                bgcolor: isFocused ? 'action.focus' : 'transparent',
                border: isSelected ? '2px solid' : '2px solid transparent',
                borderColor: isSelected ? 'primary.main' : 'transparent',
                borderRadius: 1,
                mb: 0.5
              }}
            >
              <ListItemButton
                role="option"
                aria-selected={isSelected}
                aria-describedby={`highlight-desc-${descriptor.id}`}
                onClick={() => handleHighlightClick(descriptor.id, index)}
                sx={{
                  py: 1.5,
                  px: 2,
                  '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: -2
                  }
                }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2" component="span">
                        {descriptor.title}
                      </Typography>
                      <Chip 
                        label={descriptor.type} 
                        size="small" 
                        variant="outlined"
                        sx={{ 
                          fontSize: '0.7rem',
                          height: 20,
                          bgcolor: descriptor.isVisible ? 'transparent' : 'action.disabled'
                        }}
                      />
                      <Chip 
                        label={descriptor.colorDescription} 
                        size="small"
                        sx={{ 
                          fontSize: '0.7rem',
                          height: 20,
                          bgcolor: userPreferences.highContrast 
                            ? getAccessibleStyle({ color: descriptor.colorDescription } as HighlightStyle).color
                            : descriptor.colorDescription,
                          color: userPreferences.highContrast ? 'white' : 'inherit'
                        }}
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {descriptor.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {descriptor.position}
                      </Typography>
                    </Box>
                  }
                />
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title={descriptor.isVisible ? 'Hide highlight' : 'Show highlight'}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onHighlightToggle(descriptor.id, !descriptor.isVisible);
                      }}
                      aria-label={descriptor.isVisible ? 'Hide highlight' : 'Show highlight'}
                    >
                      {descriptor.isVisible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                    </IconButton>
                  </Tooltip>
                </Box>
              </ListItemButton>

              {/* Hidden description for screen readers */}
              <Box sx={visuallyHidden}>
                <div id={`highlight-desc-${descriptor.id}`}>
                  {descriptor.description}. {descriptor.position}. {descriptor.instructions}
                </div>
              </Box>
            </ListItem>
          );
        })}
      </List>
      
      {highlightDescriptors.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No highlights available
        </Typography>
      )}

      {/* Navigation help */}
      <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Keyboard shortcuts: ↑↓ Navigate • Enter/Space Select • Ctrl+V Toggle visibility • 
          Ctrl+M Switch mode • Esc Clear selection
          {navigationState.navigationMode === 'spatial' && ' • ←→ Spatial navigation'}
        </Typography>
      </Box>
    </Box>
  );
});

AccessibleHighlightSystem.displayName = 'AccessibleHighlightSystem';

// Helper functions for accessibility

function createHighlightDescription(highlight: ComponentHighlight): string {
  const baseDesc = highlight.componentId || 'Unnamed highlight';
  const typeDesc = highlight.type === 'component' ? 'Component highlight' : 
                   highlight.type === 'area' ? 'Area highlight' : 'Connection highlight';
  
  return `${baseDesc}. ${typeDesc}`;
}

function createPositionDescription(highlight: ComponentHighlight): string {
  const coords = highlight.coordinates;
  const x = Math.round(coords.x * 100);
  const y = Math.round(coords.y * 100);
  
  const horizontalPos = x < 33 ? 'left' : x > 66 ? 'right' : 'center';
  const verticalPos = y < 33 ? 'top' : y > 66 ? 'bottom' : 'middle';
  
  return `Located at ${horizontalPos} ${verticalPos} of drawing, coordinates ${x}%, ${y}%`;
}

function createTypeDescription(type: string): string {
  switch (type) {
    case 'component': return 'Component';
    case 'area': return 'Area';
    case 'connection': return 'Connection';
    case 'annotation': return 'Note';
    default: return 'Highlight';
  }
}

function createColorDescription(color: string): string {
  const colorNames: Record<string, string> = {
    '#FF9800': 'Orange',
    '#4CAF50': 'Green',
    '#2196F3': 'Blue',
    '#F44336': 'Red',
    '#9C27B0': 'Purple',
    '#FF5722': 'Deep Orange',
    '#607D8B': 'Blue Gray',
    '#795548': 'Brown',
    '#E91E63': 'Pink',
    '#3F51B5': 'Indigo'
  };
  
  return colorNames[color] || color;
}

function createInteractionInstructions(highlight: ComponentHighlight): string {
  return `Press Enter to select this ${highlight.type}. Press Ctrl+V to ${highlight.isVisible ? 'hide' : 'show'}.`;
}

function findSpatialNeighbor(
  currentHighlight: ComponentHighlight,
  highlights: ComponentHighlight[],
  direction: 'left' | 'right' | 'up' | 'down'
): ComponentHighlight | null {
  const current = currentHighlight.coordinates;
  let bestNeighbor: ComponentHighlight | null = null;
  let bestDistance = Infinity;

  for (const highlight of highlights) {
    if (highlight.id === currentHighlight.id) continue;
    
    const coords = highlight.coordinates;
    let isInDirection = false;
    let distance = 0;

    switch (direction) {
      case 'left':
        isInDirection = coords.x < current.x;
        distance = current.x - coords.x + Math.abs(coords.y - current.y);
        break;
      case 'right':
        isInDirection = coords.x > current.x;
        distance = coords.x - current.x + Math.abs(coords.y - current.y);
        break;
      case 'up':
        isInDirection = coords.y < current.y;
        distance = current.y - coords.y + Math.abs(coords.x - current.x);
        break;
      case 'down':
        isInDirection = coords.y > current.y;
        distance = coords.y - current.y + Math.abs(coords.x - current.x);
        break;
    }

    if (isInDirection && distance < bestDistance) {
      bestDistance = distance;
      bestNeighbor = highlight;
    }
  }

  return bestNeighbor;
}