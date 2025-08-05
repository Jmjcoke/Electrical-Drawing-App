/**
 * HighlightableText component for clickable response text with highlight triggers
 * Enables interactive text-to-highlight mapping and component mention highlighting
 */

import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { Typography, Box, Chip, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import type {
  HighlightReference,
  ComponentMention
} from '../../types/highlighting.types';

interface HighlightableTextProps {
  readonly text: string;
  readonly references: HighlightReference[];
  readonly onHighlightClick?: (highlightId: string) => void;
  readonly onComponentHover?: (mention: ComponentMention | null) => void;
  readonly showConfidenceScores?: boolean;
  readonly className?: string;
}

interface TextSegment {
  readonly text: string;
  readonly type: 'text' | 'highlight';
  readonly reference?: HighlightReference;
  readonly startIndex: number;
  readonly endIndex: number;
}

// Styled components for different highlight types
const HighlightSpan = styled('span')<{ 
  linkType: 'direct' | 'inferred' | 'suggested';
  confidence: number;
}>(({ theme, linkType, confidence }) => ({
  cursor: 'pointer',
  borderRadius: theme.spacing(0.5),
  padding: theme.spacing(0.25, 0.5),
  margin: theme.spacing(0, 0.25),
  display: 'inline-block',
  transition: 'all 0.2s ease-in-out',
  position: 'relative',
  
  // Color coding based on link type and confidence
  ...(linkType === 'direct' && {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    fontWeight: 600,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
      transform: 'scale(1.05)',
      boxShadow: theme.shadows[4]
    }
  }),
  
  ...(linkType === 'inferred' && {
    backgroundColor: theme.palette.secondary.main,
    color: theme.palette.secondary.contrastText,
    fontWeight: 500,
    '&:hover': {
      backgroundColor: theme.palette.secondary.dark,
      transform: 'scale(1.05)',
      boxShadow: theme.shadows[3]
    }
  }),
  
  ...(linkType === 'suggested' && {
    backgroundColor: theme.palette.grey[200],
    color: theme.palette.text.primary,
    fontStyle: 'italic',
    border: `1px dashed ${theme.palette.grey[400]}`,
    '&:hover': {
      backgroundColor: theme.palette.grey[300],
      borderStyle: 'solid',
      boxShadow: theme.shadows[2]
    }
  }),
  
  // Opacity based on confidence
  opacity: Math.max(0.6, confidence),
  
  // Add visual indicator for low confidence
  ...(confidence < 0.5 && {
    '&::after': {
      content: '"?"',
      position: 'absolute',
      top: -4,
      right: -4,
      fontSize: '0.7em',
      backgroundColor: theme.palette.warning.main,
      color: theme.palette.warning.contrastText,
      borderRadius: '50%',
      width: 12,
      height: 12,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold'
    }
  })
}));

const ComponentChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'componentType'
})<{ componentType: string }>(({ theme, componentType }) => {
  // Color mapping for different component types
  const colorMap: Record<string, string> = {
    resistor: theme.palette.warning.main,
    capacitor: theme.palette.success.main,
    inductor: theme.palette.secondary.main,
    diode: theme.palette.error.main,
    transistor: theme.palette.primary.main,
    ic: theme.palette.info.main,
    connector: '#795548',
    switch: '#E91E63',
    led: '#FFC107',
    battery: '#4CAF50',
    ground: '#424242',
    wire: '#9E9E9E'
  };
  
  return {
    margin: theme.spacing(0.25),
    backgroundColor: colorMap[componentType] || theme.palette.grey[400],
    color: theme.palette.getContrastText(colorMap[componentType] || theme.palette.grey[400]),
    fontSize: '0.75rem',
    height: 20,
    '&:hover': {
      transform: 'scale(1.1)',
      boxShadow: theme.shadows[4]
    }
  };
});

export const HighlightableText: React.FC<HighlightableTextProps> = React.memo(({
  text,
  references,
  onHighlightClick,
  onComponentHover,
  showConfidenceScores = false,
  className
}) => {
  const [hoveredReference, setHoveredReference] = useState<HighlightReference | null>(null);
  
  // Parse text into segments with highlight information
  const textSegments = useMemo((): TextSegment[] => {
    if (references.length === 0) {
      return [{
        text,
        type: 'text',
        startIndex: 0,
        endIndex: text.length
      }];
    }
    
    // Sort references by position
    const sortedRefs = [...references].sort((a, b) => 
      a.textPosition.start - b.textPosition.start
    );
    
    const segments: TextSegment[] = [];
    let currentIndex = 0;
    
    for (const reference of sortedRefs) {
      // Add text before highlight
      if (currentIndex < reference.textPosition.start) {
        segments.push({
          text: text.substring(currentIndex, reference.textPosition.start),
          type: 'text',
          startIndex: currentIndex,
          endIndex: reference.textPosition.start
        });
      }
      
      // Add highlight segment
      segments.push({
        text: text.substring(reference.textPosition.start, reference.textPosition.end),
        type: 'highlight',
        reference,
        startIndex: reference.textPosition.start,
        endIndex: reference.textPosition.end
      });
      
      currentIndex = reference.textPosition.end;
    }
    
    // Add remaining text
    if (currentIndex < text.length) {
      segments.push({
        text: text.substring(currentIndex),
        type: 'text',
        startIndex: currentIndex,
        endIndex: text.length
      });
    }
    
    return segments;
  }, [text, references]);
  
  // Get unique component types for summary chips
  const componentTypes = useMemo(() => {
    const types = new Set<string>();
    references.forEach(ref => types.add(ref.componentMention.componentType));
    return Array.from(types);
  }, [references]);
  
  // Handle highlight click
  const handleHighlightClick = useCallback((reference: HighlightReference) => {
    onHighlightClick?.(reference.highlightId);
  }, [onHighlightClick]);
  
  // Handle component hover
  const handleComponentHover = useCallback((reference: HighlightReference | null) => {
    setHoveredReference(reference);
    onComponentHover?.(reference?.componentMention || null);
  }, [onComponentHover]);
  
  // Generate tooltip content for highlights
  const getTooltipContent = useCallback((reference: HighlightReference) => {
    const { componentMention, confidence, linkType } = reference;
    
    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          {componentMention.componentType.toUpperCase()}: {componentMention.componentDescription}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Link Type: {linkType}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Confidence: {Math.round(confidence * 100)}%
        </Typography>
        {componentMention.contextualClues.length > 0 && (
          <>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              Context: {componentMention.contextualClues.join(', ')}
            </Typography>
          </>
        )}
      </Box>
    );
  }, []);
  
  return (
    <Box className={className}>
      {/* Component summary chips */}
      {componentTypes.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          <Typography variant="caption" color="textSecondary" sx={{ mr: 1, alignSelf: 'center' }}>
            Components mentioned:
          </Typography>
          {componentTypes.map(type => (
            <ComponentChip
              key={type}
              componentType={type}
              label={type}
              size="small"
              variant="filled"
            />
          ))}
        </Box>
      )}
      
      {/* Main text with highlights */}
      <Typography variant="body1" component="div" sx={{ lineHeight: 1.8 }}>
        {textSegments.map((segment, index) => {
          if (segment.type === 'text') {
            return (
              <span key={index}>
                {segment.text}
              </span>
            );
          }
          
          // Highlight segment
          const { reference } = segment;
          if (!reference) return <span key={index}>{segment.text}</span>;
          
          return (
            <Tooltip
              key={index}
              title={getTooltipContent(reference)}
              arrow
              placement="top"
              enterDelay={300}
            >
              <HighlightSpan
                linkType={reference.linkType}
                confidence={reference.confidence}
                onClick={() => handleHighlightClick(reference)}
                onMouseEnter={() => handleComponentHover(reference)}
                onMouseLeave={() => handleComponentHover(null)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleHighlightClick(reference);
                  }
                }}
                aria-label={`Highlight ${reference.componentMention.componentType}: ${reference.componentMention.componentDescription}`}
              >
                {segment.text}
                {showConfidenceScores && (
                  <Typography
                    component="sup"
                    variant="caption"
                    sx={{ 
                      fontSize: '0.6em',
                      opacity: 0.7,
                      ml: 0.25,
                      fontWeight: 'normal'
                    }}
                  >
                    {Math.round(reference.confidence * 100)}%
                  </Typography>
                )}
              </HighlightSpan>
            </Tooltip>
          );
        })}
      </Typography>
      
      {/* Hover information panel */}
      {hoveredReference && (
        <Box
          sx={{
            mt: 2,
            p: 2,
            backgroundColor: 'action.hover',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Typography variant="subtitle2" gutterBottom>
            Hovering: {hoveredReference.componentMention.componentType.toUpperCase()}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {hoveredReference.componentMention.componentDescription}
          </Typography>
          {hoveredReference.componentMention.contextualClues.length > 0 && (
            <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
              Technical details: {hoveredReference.componentMention.contextualClues.join(', ')}
            </Typography>
          )}
        </Box>
      )}
      
      {/* Debug information (development only) */}
      {process.env.NODE_ENV === 'development' && references.length > 0 && (
        <Box sx={{ mt: 2, p: 1, backgroundColor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="caption" color="textSecondary">
            Debug: {references.length} highlight{references.length !== 1 ? 's' : ''} found
          </Typography>
          {references.map((ref, index) => (
            <Typography key={index} variant="caption" display="block" color="textSecondary">
              {index + 1}. {ref.componentMention.componentType} @ {ref.textPosition.start}-{ref.textPosition.end} 
              (confidence: {Math.round(ref.confidence * 100)}%, type: {ref.linkType})
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
});

HighlightableText.displayName = 'HighlightableText';