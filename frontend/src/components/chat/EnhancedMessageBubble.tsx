/**
 * Enhanced MessageBubble with integrated highlighting support
 * Extends the original MessageBubble to include highlight integration and context awareness
 */

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Tooltip,
  Button,
  Collapse,
  useTheme,
  alpha,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  ContentCopy as CopyIcon,
  Refresh as RetryIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  SmartToy as BotIcon,
  Highlight as HighlightIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  AutoFixHigh as SuggestionIcon
} from '@mui/icons-material';
import { ChatMessage, ComponentSuggestion } from '../../types/chat';
import type { 
  ComponentHighlight, 
  HighlightReference 
} from '../../types/highlighting.types';
import { HighlightableText } from '../analysis/HighlightableText';

interface EnhancedMessageBubbleProps {
  message: ChatMessage;
  highlights?: ComponentHighlight[];
  highlightReferences?: HighlightReference[];
  suggestions?: ComponentSuggestion[];
  onAction: (messageId: string, action: 'copy' | 'retry' | 'delete') => void;
  onHighlightClick?: (highlightId: string) => void;
  onHighlightToggle?: (highlightId: string, visible: boolean) => void;
  onSuggestionAccept?: (suggestion: ComponentSuggestion) => void;
  onGenerateHighlights?: (messageId: string) => void;
  showHighlightIntegration?: boolean;
}

export const EnhancedMessageBubble: React.FC<EnhancedMessageBubbleProps> = ({
  message,
  highlights = [],
  highlightReferences = [],
  suggestions = [],
  onAction,
  onHighlightClick,
  onHighlightToggle,
  onSuggestionAccept,
  onGenerateHighlights,
  showHighlightIntegration = true
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showHighlights, setShowHighlights] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const isMenuOpen = Boolean(anchorEl);

  const isUser = message.type === 'user';
  const isAssistant = message.type === 'assistant';

  // Get highlights related to this message
  const messageHighlights = useMemo(() => {
    if (!message.query?.id) return [];
    return highlights.filter(h => 
      h.responseId === message.query?.id || h.queryId === message.query?.id
    );
  }, [highlights, message.query?.id]);

  // Get references for this message content
  const messageReferences = useMemo(() => {
    return highlightReferences.filter(ref => 
      ref.responseText === message.content || 
      message.content.includes(ref.responseText)
    );
  }, [highlightReferences, message.content]);

  // Filter suggestions relevant to this message
  const relevantSuggestions = useMemo(() => {
    if (!isAssistant) return [];
    return suggestions.filter(s => s.confidence >= 0.5);
  }, [suggestions, isAssistant]);

  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleAction = useCallback((action: 'copy' | 'retry' | 'delete') => {
    handleMenuClose();
    onAction(message.id, action);
  }, [handleMenuClose, onAction, message.id]);

  const handleCopyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      handleAction('copy');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, [message.content, handleAction]);

  const handleHighlightClick = useCallback((highlightId: string) => {
    onHighlightClick?.(highlightId);
  }, [onHighlightClick]);

  const handleHighlightToggle = useCallback((highlightId: string, visible: boolean) => {
    onHighlightToggle?.(highlightId, visible);
  }, [onHighlightToggle]);

  const handleSuggestionAccept = useCallback((suggestion: ComponentSuggestion) => {
    onSuggestionAccept?.(suggestion);
  }, [onSuggestionAccept]);

  const handleGenerateHighlights = useCallback(() => {
    onGenerateHighlights?.(message.id);
  }, [onGenerateHighlights, message.id]);

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getQueryTypeLabel = (type?: string) => {
    switch (type) {
      case 'component_identification':
        return 'Component ID';
      case 'general_question':
        return 'General';
      case 'schematic_analysis':
        return 'Analysis';
      default:
        return '';
    }
  };

  const getSuggestionSourceLabel = (source: string) => {
    switch (source) {
      case 'history': return 'History';
      case 'context': return 'Context';
      case 'semantic': return 'AI Analysis';
      default: return 'System';
    }
  };

  const renderHighlightableContent = () => {
    if (isAssistant && messageReferences.length > 0) {
      return (
        <HighlightableText
          text={message.content}
          references={messageReferences}
          onHighlightClick={handleHighlightClick}
          showConfidenceScores={false}
        />
      );
    }

    return (
      <Typography
        variant="body1"
        sx={{
          whiteSpace: 'pre-wrap',
          lineHeight: 1.4
        }}
      >
        {message.content}
      </Typography>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        mb: 2,
        px: 1,
        '&:hover .message-actions': {
          opacity: 1,
        }
      }}
    >
      {/* Avatar */}
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: isUser ? theme.palette.primary.main : theme.palette.secondary.main,
          color: 'white',
          mx: 1,
          flexShrink: 0
        }}
      >
        {isUser ? <PersonIcon /> : <BotIcon />}
      </Box>

      {/* Message Content */}
      <Box
        sx={{
          maxWidth: '70%',
          minWidth: '120px',
        }}
      >
        {/* Message Bubble */}
        <Box
          sx={{
            bgcolor: isUser 
              ? theme.palette.primary.main 
              : theme.palette.background.paper,
            color: isUser 
              ? theme.palette.primary.contrastText 
              : theme.palette.text.primary,
            borderRadius: 2,
            p: 2,
            border: !isUser ? '1px solid' : 'none',
            borderColor: !isUser ? theme.palette.divider : 'transparent',
            boxShadow: theme.shadows[1],
            position: 'relative',
            wordWrap: 'break-word',
            '&::before': isUser ? {
              content: '""',
              position: 'absolute',
              top: '10px',
              right: '-6px',
              width: 0,
              height: 0,
              borderLeft: `6px solid ${theme.palette.primary.main}`,
              borderTop: '6px solid transparent',
              borderBottom: '6px solid transparent',
            } : {
              content: '""',
              position: 'absolute',
              top: '10px',
              left: '-6px',
              width: 0,
              height: 0,
              borderRight: `6px solid ${theme.palette.background.paper}`,
              borderTop: '6px solid transparent',
              borderBottom: '6px solid transparent',
            }
          }}
        >
          {/* Query Type Chip for user messages */}
          {isUser && message.query?.type && (
            <Chip
              label={getQueryTypeLabel(message.query.type)}
              size="small"
              variant="outlined"
              sx={{
                mb: 1,
                height: 20,
                fontSize: '0.7rem',
                borderColor: alpha(theme.palette.primary.contrastText, 0.3),
                color: theme.palette.primary.contrastText,
                '& .MuiChip-label': {
                  px: 1
                }
              }}
            />
          )}

          {/* Message Text with Highlighting Integration */}
          {renderHighlightableContent()}

          {/* Confidence Score for assistant messages */}
          {isAssistant && message.query?.aggregatedResult?.confidence && (
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Confidence: {Math.round(message.query.aggregatedResult.confidence.overall * 100)}%
              </Typography>
            </Box>
          )}

          {/* Error indicator */}
          {message.error && (
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.error.main,
                mt: 1,
                display: 'block',
                fontStyle: 'italic'
              }}
            >
              Error: {message.error}
            </Typography>
          )}
        </Box>

        {/* Highlight Integration Panel */}
        {showHighlightIntegration && isAssistant && (
          <Box sx={{ mt: 1 }}>
            {/* Highlight Actions */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              {messageHighlights.length > 0 && (
                <Button
                  size="small"
                  startIcon={showHighlights ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  endIcon={<Chip label={messageHighlights.length} size="small" />}
                  onClick={() => setShowHighlights(!showHighlights)}
                  variant="outlined"
                  sx={{ fontSize: '0.75rem', py: 0.25 }}
                >
                  Highlights
                </Button>
              )}

              {relevantSuggestions.length > 0 && (
                <Button
                  size="small"
                  startIcon={<SuggestionIcon />}
                  endIcon={<Chip label={relevantSuggestions.length} size="small" />}
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  variant="outlined"
                  color="secondary"
                  sx={{ fontSize: '0.75rem', py: 0.25 }}
                >
                  Suggestions
                </Button>
              )}

              {messageHighlights.length === 0 && onGenerateHighlights && (
                <Button
                  size="small"
                  startIcon={<HighlightIcon />}
                  onClick={handleGenerateHighlights}
                  variant="outlined"
                  color="success"
                  sx={{ fontSize: '0.75rem', py: 0.25 }}
                >
                  Generate Highlights
                </Button>
              )}
            </Box>

            {/* Highlights List */}
            <Collapse in={showHighlights}>
              <Box sx={{ 
                bgcolor: alpha(theme.palette.background.paper, 0.7),
                borderRadius: 1,
                p: 1,
                mb: 1
              }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Related Highlights ({messageHighlights.length})
                </Typography>
                
                {messageHighlights.map((highlight) => (
                  <Box
                    key={highlight.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 0.5,
                      px: 1,
                      borderRadius: 0.5,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.action.hover, 0.5)
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          bgcolor: highlight.style.color
                        }}
                      />
                      <Typography variant="caption">
                        {highlight.componentId || `Highlight ${highlight.id.slice(-4)}`}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title={highlight.isVisible ? 'Hide' : 'Show'}>
                        <IconButton
                          size="small"
                          onClick={() => handleHighlightToggle(highlight.id, !highlight.isVisible)}
                        >
                          {highlight.isVisible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Focus on highlight">
                        <IconButton
                          size="small"
                          onClick={() => handleHighlightClick(highlight.id)}
                        >
                          <HighlightIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Collapse>

            {/* Suggestions List */}
            <Collapse in={showSuggestions}>
              <Box sx={{ 
                bgcolor: alpha(theme.palette.secondary.light, 0.1),
                borderRadius: 1,
                p: 1,
                mb: 1
              }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  AI Suggestions ({relevantSuggestions.length})
                </Typography>
                
                {relevantSuggestions.map((suggestion, index) => (
                  <Box
                    key={`${suggestion.componentId}-${index}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 0.5,
                      px: 1,
                      borderRadius: 0.5,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.action.hover, 0.5)
                      }
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="caption" fontWeight="medium">
                        {suggestion.componentId}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {getSuggestionSourceLabel(suggestion.source)} • {Math.round(suggestion.confidence * 100)}%
                      </Typography>
                    </Box>
                    
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleSuggestionAccept(suggestion)}
                      sx={{ fontSize: '0.7rem', py: 0.25, px: 1 }}
                    >
                      Apply
                    </Button>
                  </Box>
                ))}
              </Box>
            </Collapse>
          </Box>
        )}

        {/* Message Footer */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            mt: 0.5,
            px: 1
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mr: 1 }}
          >
            {formatTime(message.timestamp)}
          </Typography>

          {/* Actions Menu */}
          <Box
            className="message-actions"
            sx={{
              opacity: 0,
              transition: 'opacity 0.2s ease-in-out'
            }}
          >
            <IconButton
              size="small"
              onClick={handleMenuOpen}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  bgcolor: alpha(theme.palette.text.primary, 0.04)
                }
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Box>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleMenuClose}
        transformOrigin={{
          vertical: 'top',
          horizontal: isUser ? 'right' : 'left',
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: isUser ? 'right' : 'left',
        }}
      >
        <MenuItem onClick={handleCopyToClipboard}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy</ListItemText>
        </MenuItem>
        
        {isUser && (
          <MenuItem onClick={() => handleAction('retry')}>
            <ListItemIcon>
              <RetryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Retry</ListItemText>
          </MenuItem>
        )}

        {isAssistant && onGenerateHighlights && (
          <MenuItem onClick={handleGenerateHighlights}>
            <ListItemIcon>
              <HighlightIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Generate Highlights</ListItemText>
          </MenuItem>
        )}
        
        <MenuItem 
          onClick={() => handleAction('delete')}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

EnhancedMessageBubble.displayName = 'EnhancedMessageBubble';