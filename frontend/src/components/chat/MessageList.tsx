import React, { useEffect, useRef, useMemo } from 'react';
import {
  Box,
  List,
  Typography,
  Fade,
  Snackbar,
  Alert,
} from '@mui/material';
import { MessageBubble } from './MessageBubble';
import { ChatMessage } from '../../types/chat';

interface MessageListProps {
  messages: ChatMessage[];
  onMessageAction: (messageId: string, action: 'copy' | 'retry' | 'delete') => void;
  showCopyFeedback: boolean;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  onMessageAction,
  showCopyFeedback
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: 'smooth',
      block: 'end'
    });
  }, [messages.length]);

  // Group messages by date for better organization
  const groupedMessages = useMemo(() => {
    const groups: { [key: string]: ChatMessage[] } = {};
    
    messages.forEach(message => {
      const dateKey = message.timestamp.toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });
    
    return groups;
  }, [messages]);

  // Format date for display
  const formatDateHeader = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString(undefined, { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }
  };

  if (messages.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
          textAlign: 'center'
        }}
      >
        <Box>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Start a Conversation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload a document and ask questions about electrical components, circuits, or diagrams.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <>
      <Box
        ref={listRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          scrollBehavior: 'smooth',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
          },
        }}
      >
        <List
          sx={{
            p: 1,
            pb: 2,
            '& .MuiListItem-root': {
              px: 0,
            }
          }}
        >
          {Object.entries(groupedMessages).map(([dateString, groupMessages]) => (
            <Box key={dateString}>
              {/* Date Header */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  my: 2
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    backgroundColor: 'background.paper',
                    px: 2,
                    py: 0.5,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    color: 'text.secondary'
                  }}
                >
                  {formatDateHeader(dateString)}
                </Typography>
              </Box>

              {/* Messages for this date */}
              {groupMessages.map((message) => (
                <Fade
                  key={message.id}
                  in={true}
                  timeout={300}
                >
                  <Box>
                    <MessageBubble
                      message={message}
                      onAction={onMessageAction}
                    />
                  </Box>
                </Fade>
              ))}
            </Box>
          ))}
          
          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </List>
      </Box>

      {/* Copy feedback snackbar */}
      <Snackbar
        open={showCopyFeedback}
        autoHideDuration={2000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled">
          Message copied to clipboard
        </Alert>
      </Snackbar>
    </>
  );
};