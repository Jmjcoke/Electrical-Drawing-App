import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  ContentCopy as CopyIcon,
  Refresh as RetryIcon,
  Delete as DeleteIcon,
  Share as ShareIcon,
  Bookmark as BookmarkIcon,
} from '@mui/icons-material';

interface MessageActionsProps {
  messageId: string;
  messageContent: string;
  messageType: 'user' | 'assistant';
  onAction: (messageId: string, action: 'copy' | 'retry' | 'delete' | 'share' | 'bookmark') => void;
  disabled?: boolean;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
  messageId,
  messageContent,
  messageType,
  onAction,
  disabled = false
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const isMenuOpen = Boolean(anchorEl);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (disabled) return;
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAction = async (action: 'copy' | 'retry' | 'delete' | 'share' | 'bookmark') => {
    handleMenuClose();
    
    if (action === 'delete') {
      setDeleteDialogOpen(true);
      return;
    }

    if (action === 'copy') {
      try {
        await navigator.clipboard.writeText(messageContent);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    }

    onAction(messageId, action);
  };

  const handleDeleteConfirm = () => {
    setDeleteDialogOpen(false);
    onAction(messageId, 'delete');
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const isUser = messageType === 'user';

  return (
    <>
      <Tooltip title="Message actions" placement="top">
        <IconButton
          size="small"
          onClick={handleMenuOpen}
          disabled={disabled}
          sx={{
            color: 'text.secondary',
            opacity: 0.7,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              opacity: 1,
              bgcolor: alpha(theme.palette.text.primary, 0.04),
              transform: 'scale(1.1)'
            },
            '&:disabled': {
              opacity: 0.3
            }
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>

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
        PaperProps={{
          sx: {
            minWidth: 160,
            boxShadow: theme.shadows[8],
            '& .MuiMenuItem-root': {
              px: 2,
              py: 1,
              borderRadius: 1,
              mx: 0.5,
              mb: 0.5,
              '&:last-child': {
                mb: 0
              }
            }
          }
        }}
      >
        {/* Copy */}
        <MenuItem onClick={() => handleAction('copy')}>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy message</ListItemText>
        </MenuItem>

        {/* Retry (only for user messages) */}
        {isUser && (
          <MenuItem onClick={() => handleAction('retry')}>
            <ListItemIcon>
              <RetryIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Ask again</ListItemText>
          </MenuItem>
        )}

        {/* Share */}
        <MenuItem onClick={() => handleAction('share')}>
          <ListItemIcon>
            <ShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Share</ListItemText>
        </MenuItem>

        {/* Bookmark (only for assistant messages) */}
        {!isUser && (
          <MenuItem onClick={() => handleAction('bookmark')}>
            <ListItemIcon>
              <BookmarkIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Bookmark</ListItemText>
          </MenuItem>
        )}

        {/* Delete */}
        <MenuItem 
          onClick={() => handleAction('delete')}
          sx={{ 
            color: 'error.main',
            '&:hover': {
              bgcolor: alpha(theme.palette.error.main, 0.08)
            }
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Message</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this message? This action cannot be undone.
          </Typography>
          <Box
            sx={{
              mt: 2,
              p: 2,
              bgcolor: 'background.default',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Typography
              variant="body2"
              sx={{
                maxHeight: 100,
                overflow: 'auto',
                whiteSpace: 'pre-wrap'
              }}
            >
              {messageContent.length > 200 
                ? `${messageContent.substring(0, 200)}...` 
                : messageContent
              }
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};