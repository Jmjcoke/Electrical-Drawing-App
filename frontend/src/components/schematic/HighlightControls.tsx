/**
 * HighlightControls component for managing highlight visibility, customization, and interactions
 * Provides UI controls for highlight management and user preferences
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Switch,
  Slider,
  Button,
  IconButton,
  Chip,
  Tooltip,
  Collapse,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemIcon,
  Badge
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Clear,
  Save,
  Download,
  Upload,
  ExpandMore,
  ExpandLess,
  Delete
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import type {
  ComponentHighlight,
  HighlightGroup,
  HighlightStyle
} from '../../types/highlighting.types';

interface HighlightControlsProps {
  readonly highlights: ComponentHighlight[];
  readonly highlightGroups: HighlightGroup[];
  readonly selectedHighlight: string | null;
  readonly globalOpacity: number;
  readonly showHighlights: boolean;
  readonly onToggleHighlights: (show: boolean) => void;
  readonly onToggleHighlight: (highlightId: string, visible: boolean) => void;
  readonly onToggleGroup: (groupId: string, visible: boolean) => void;
  readonly onSelectHighlight: (highlightId: string | null) => void;
  readonly onDeleteHighlight: (highlightId: string) => void;
  readonly onUpdateHighlightStyle: (highlightId: string, style: Partial<HighlightStyle>) => void;
  readonly onGlobalOpacityChange: (opacity: number) => void;
  readonly onClearAllHighlights: () => void;
  readonly onExportHighlights?: () => void;
  readonly onImportHighlights?: (highlights: ComponentHighlight[]) => void;
  readonly className?: string;
}

interface ComponentTypeStats {
  readonly type: string;
  readonly count: number;
  readonly visible: number;
  readonly color: string;
}

// Styled components
const ControlsContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  minWidth: 300,
  maxWidth: 400,
  maxHeight: '80vh',
  overflow: 'auto',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.spacing(1),
  boxShadow: theme.shadows[4]
}));

const StatsChip = styled(Chip)<{ componenttype: string }>(({ theme, componenttype }) => {
  const colorMap: Record<string, string> = {
    resistor: '#FF9800',
    capacitor: '#4CAF50',
    inductor: '#9C27B0',
    diode: '#F44336',
    transistor: '#3F51B5',
    ic: '#607D8B',
    connector: '#795548',
    switch: '#E91E63',
    led: '#FFEB3B',
    battery: '#8BC34A',
    ground: '#424242',
    wire: '#9E9E9E',
    component: '#2196F3'
  };
  
  return {
    backgroundColor: colorMap[componenttype] || colorMap.component,
    color: theme.palette.getContrastText(colorMap[componenttype] || colorMap.component),
    fontWeight: 600,
    margin: theme.spacing(0.25),
    '&:hover': {
      transform: 'scale(1.05)',
      boxShadow: theme.shadows[2]
    }
  };
});

const ColorSwatch = styled(Box)<{ color: string }>(({ color }) => ({
  width: 20,
  height: 20,
  borderRadius: '50%',
  backgroundColor: color,
  border: '2px solid #fff',
  boxShadow: '0 0 0 1px rgba(0,0,0,0.1)',
  cursor: 'pointer',
  display: 'inline-block',
  margin: '0 4px',
  '&:hover': {
    transform: 'scale(1.2)',
    boxShadow: '0 0 0 2px rgba(0,0,0,0.3)'
  }
}));

export const HighlightControls: React.FC<HighlightControlsProps> = React.memo(({
  highlights,
  highlightGroups,
  selectedHighlight,
  globalOpacity,
  showHighlights,
  onToggleHighlights,
  onToggleHighlight,
  onToggleGroup,
  onSelectHighlight,
  onDeleteHighlight,
  onUpdateHighlightStyle,
  onGlobalOpacityChange,
  onClearAllHighlights,
  onExportHighlights,
  onImportHighlights,
  className
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));
  const [filterType, setFilterType] = useState<string>('all');

  // Calculate component type statistics
  const componentStats = useMemo((): ComponentTypeStats[] => {
    const statsMap = new Map<string, ComponentTypeStats>();
    
    highlights.forEach(highlight => {
      const type = highlight.componentId?.split(' ')[0]?.toLowerCase() || 'component';
      const existing = statsMap.get(type) || {
        type,
        count: 0,
        visible: 0,
        color: highlight.style.color
      };
      
      statsMap.set(type, {
        ...existing,
        count: existing.count + 1,
        visible: existing.visible + (highlight.isVisible ? 1 : 0)
      });
    });
    
    return Array.from(statsMap.values()).sort((a, b) => b.count - a.count);
  }, [highlights]);

  // Filter highlights based on selected type
  const filteredHighlights = useMemo(() => {
    if (filterType === 'all') return highlights;
    return highlights.filter(h => 
      h.componentId?.toLowerCase().includes(filterType.toLowerCase())
    );
  }, [highlights, filterType]);

  // Handle section expansion
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }, []);

  // Handle highlight style updates
  const updateHighlightColor = useCallback((highlightId: string, color: string) => {
    onUpdateHighlightStyle(highlightId, { color });
  }, [onUpdateHighlightStyle]);

  const updateHighlightOpacity = useCallback((highlightId: string, opacity: number) => {
    onUpdateHighlightStyle(highlightId, { opacity });
  }, [onUpdateHighlightStyle]);

  // Predefined color palette
  const colorPalette = [
    '#FF9800', '#4CAF50', '#2196F3', '#F44336', '#9C27B0',
    '#FF5722', '#607D8B', '#795548', '#E91E63', '#3F51B5'
  ];

  return (
    <ControlsContainer className={className}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" component="h2">
          Highlight Controls
        </Typography>
        <Box>
          <Tooltip title="Export highlights">
            <IconButton size="small" onClick={onExportHighlights} disabled={!onExportHighlights}>
              <Download />
            </IconButton>
          </Tooltip>
          <Tooltip title="Clear all highlights">
            <IconButton 
              size="small" 
              onClick={onClearAllHighlights}
              disabled={highlights.length === 0}
            >
              <Clear />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Global Controls */}
      <Box mb={3}>
        <FormControlLabel
          control={
            <Switch
              checked={showHighlights}
              onChange={(e) => onToggleHighlights(e.target.checked)}
              color="primary"
            />
          }
          label={`Show Highlights (${highlights.filter(h => h.isVisible).length}/${highlights.length})`}
        />
        
        {showHighlights && (
          <Box mt={2}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              Global Opacity: {Math.round(globalOpacity * 100)}%
            </Typography>
            <Slider
              value={globalOpacity}
              onChange={(_, value) => onGlobalOpacityChange(value as number)}
              min={0.1}
              max={1}
              step={0.1}
              size="small"
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
            />
          </Box>
        )}
      </Box>

      <Divider />

      {/* Component Statistics */}
      <Box mt={2} mb={2}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          onClick={() => toggleSection('overview')}
          sx={{ cursor: 'pointer' }}
        >
          <Typography variant="subtitle2">
            Component Overview
          </Typography>
          {expandedSections.has('overview') ? <ExpandLess /> : <ExpandMore />}
        </Box>
        
        <Collapse in={expandedSections.has('overview')}>
          <Box mt={1} display="flex" flexWrap="wrap" gap={0.5}>
            {componentStats.map(stat => (
              <Badge
                key={stat.type}
                badgeContent={`${stat.visible}/${stat.count}`}
                color={stat.visible === stat.count ? 'success' : 'warning'}
                max={999}
              >
                <StatsChip
                  componenttype={stat.type}
                  label={stat.type}
                  size="small"
                  onClick={() => setFilterType(stat.type)}
                  variant={filterType === stat.type ? 'filled' : 'outlined'}
                />
              </Badge>
            ))}
            {componentStats.length > 0 && (
              <Chip
                label="All"
                size="small"
                onClick={() => setFilterType('all')}
                variant={filterType === 'all' ? 'filled' : 'outlined'}
                color="primary"
              />
            )}
          </Box>
        </Collapse>
      </Box>

      <Divider />

      {/* Individual Highlights */}
      <Box mt={2}>
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          onClick={() => toggleSection('highlights')}
          sx={{ cursor: 'pointer' }}
        >
          <Typography variant="subtitle2">
            Individual Highlights ({filteredHighlights.length})
          </Typography>
          {expandedSections.has('highlights') ? <ExpandLess /> : <ExpandMore />}
        </Box>
        
        <Collapse in={expandedSections.has('highlights')}>
          <List dense>
            {filteredHighlights.map((highlight) => (
              <ListItem
                key={highlight.id}
                selected={selectedHighlight === highlight.id}
                onClick={() => onSelectHighlight(
                  selectedHighlight === highlight.id ? null : highlight.id
                )}
                sx={{ 
                  borderRadius: 1,
                  mb: 0.5,
                  border: selectedHighlight === highlight.id ? '2px solid' : '1px solid transparent',
                  borderColor: selectedHighlight === highlight.id ? 'primary.main' : 'transparent'
                }}
              >
                <ListItemIcon>
                  <ColorSwatch color={highlight.style.color} />
                </ListItemIcon>
                
                <ListItemText
                  primary={highlight.componentId || `Highlight ${highlight.id.slice(-4)}`}
                  secondary={`${highlight.type} • ${Math.round(highlight.style.opacity * 100)}% opacity`}
                  primaryTypographyProps={{
                    variant: 'body2',
                    noWrap: true
                  }}
                  secondaryTypographyProps={{
                    variant: 'caption'
                  }}
                />
                
                <ListItemSecondaryAction>
                  <Tooltip title={highlight.isVisible ? 'Hide' : 'Show'}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleHighlight(highlight.id, !highlight.isVisible);
                      }}
                    >
                      {highlight.isVisible ? <Visibility /> : <VisibilityOff />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteHighlight(highlight.id);
                      }}
                    >
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
            
            {filteredHighlights.length === 0 && (
              <ListItem>
                <ListItemText
                  primary="No highlights"
                  secondary={filterType === 'all' ? 'Create highlights by interacting with responses' : `No ${filterType} components found`}
                  primaryTypographyProps={{ color: 'textSecondary' }}
                  secondaryTypographyProps={{ color: 'textSecondary' }}
                />
              </ListItem>
            )}
          </List>
        </Collapse>
      </Box>

      {/* Selected Highlight Customization */}
      {selectedHighlight && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Customize Selected Highlight
            </Typography>
            
            {(() => {
              const highlight = highlights.find(h => h.id === selectedHighlight);
              if (!highlight) return null;
              
              return (
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Color Palette
                  </Typography>
                  <Box display="flex" flexWrap="wrap" mb={2}>
                    {colorPalette.map(color => (
                      <ColorSwatch
                        key={color}
                        color={color}
                        onClick={() => updateHighlightColor(highlight.id, color)}
                        sx={{
                          border: highlight.style.color === color ? '3px solid #000' : '2px solid #fff'
                        }}
                      />
                    ))}
                  </Box>
                  
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Opacity: {Math.round(highlight.style.opacity * 100)}%
                  </Typography>
                  <Slider
                    value={highlight.style.opacity}
                    onChange={(_, value) => updateHighlightOpacity(highlight.id, value as number)}
                    min={0.1}
                    max={1}
                    step={0.1}
                    size="small"
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
                  />
                </Box>
              );
            })()}
          </Box>
        </>
      )}

      {/* Highlight Groups */}
      {highlightGroups.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Box>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              onClick={() => toggleSection('groups')}
              sx={{ cursor: 'pointer' }}
            >
              <Typography variant="subtitle2">
                Highlight Groups ({highlightGroups.length})
              </Typography>
              {expandedSections.has('groups') ? <ExpandLess /> : <ExpandMore />}
            </Box>
            
            <Collapse in={expandedSections.has('groups')}>
              <List dense>
                {highlightGroups.map((group) => (
                  <ListItem key={group.id}>
                    <ListItemIcon>
                      <ColorSwatch color={group.color} />
                    </ListItemIcon>
                    
                    <ListItemText
                      primary={group.name}
                      secondary={`${group.highlightIds.length} highlights`}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                    
                    <ListItemSecondaryAction>
                      <Tooltip title={group.isVisible ? 'Hide Group' : 'Show Group'}>
                        <IconButton
                          size="small"
                          onClick={() => onToggleGroup(group.id, !group.isVisible)}
                        >
                          {group.isVisible ? <Visibility /> : <VisibilityOff />}
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </Box>
        </>
      )}

      {/* Footer Actions */}
      <Box mt={3} display="flex" justifyContent="space-between" gap={1}>
        <Button
          size="small"
          startIcon={<Save />}
          onClick={onExportHighlights}
          disabled={!onExportHighlights || highlights.length === 0}
          variant="outlined"
        >
          Save
        </Button>
        <Button
          size="small"
          startIcon={<Upload />}
          disabled={!onImportHighlights}
          variant="outlined"
          onClick={() => {
            // Trigger file input for import
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file && onImportHighlights) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const highlights = JSON.parse(event.target?.result as string);
                    onImportHighlights(highlights);
                  } catch (error) {
                    console.error('Failed to import highlights:', error);
                  }
                };
                reader.readAsText(file);
              }
            };
            input.click();
          }}
        >
          Load
        </Button>
      </Box>
    </ControlsContainer>
  );
});

HighlightControls.displayName = 'HighlightControls';