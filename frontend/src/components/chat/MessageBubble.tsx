import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip,
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
} from '@mui/icons-material';
import { ChatMessage } from '../../types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
  onAction: (messageId: string, action: 'copy' | 'retry' | 'delete') => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onAction
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isMenuOpen = Boolean(anchorEl);

  const isUser = message.type === 'user';
  const isAssistant = message.type === 'assistant';

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAction = (action: 'copy' | 'retry' | 'delete') => {
    handleMenuClose();
    onAction(message.id, action);
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      handleAction('copy');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

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

          {/* Message Text */}
          <Typography
            variant="body1"
            sx={{
              whiteSpace: 'pre-wrap',
              lineHeight: 1.4
            }}
          >
            {message.content}
          </Typography>

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