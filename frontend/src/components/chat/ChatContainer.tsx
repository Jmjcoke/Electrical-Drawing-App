import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  useTheme,
  useMediaQuery,
  Container,
} from '@mui/material';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { ChatMessage, SessionState, ChatUIState } from '../../types/chat';

interface ChatContainerProps {
  sessionState: SessionState;
  onSendMessage: (message: string, type: 'component_identification' | 'general_question' | 'schematic_analysis') => void;
  onMessageAction: (messageId: string, action: 'copy' | 'retry' | 'delete') => void;
  isConnected: boolean;
  className?: string;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  sessionState,
  onSendMessage,
  onMessageAction,
  isConnected,
  className
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [uiState, setUiState] = useState<ChatUIState>({
    isTyping: false,
    connectionStatus: isConnected ? 'connected' : 'disconnected',
    messageActions: {
      showCopyFeedback: false
    }
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Convert query history to chat messages
  useEffect(() => {
    const convertedMessages: ChatMessage[] = [];
    
    sessionState.queryHistory.forEach((query) => {
      // Add user message
      convertedMessages.push({
        id: `user-${query.id}`,
        type: 'user',
        content: query.text,
        timestamp: query.timestamp,
        query
      });

      // Add assistant response if available
      if (query.aggregatedResult) {
        convertedMessages.push({
          id: `assistant-${query.id}`,
          type: 'assistant',
          content: query.aggregatedResult.summary,
          timestamp: new Date(query.timestamp.getTime() + 1000), // Slightly after user message
          query
        });
      }
    });

    setMessages(convertedMessages);
  }, [sessionState.queryHistory]);

  // Update connection status
  useEffect(() => {
    setUiState(prev => ({
      ...prev,
      connectionStatus: isConnected ? 'connected' : 'disconnected'
    }));
  }, [isConnected]);

  const handleSendMessage = useCallback((message: string, type: 'component_identification' | 'general_question' | 'schematic_analysis') => {
    // Optimistically add user message
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      type: 'user',
      content: message,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setUiState(prev => ({ ...prev, isTyping: true }));
    
    onSendMessage(message, type);
  }, [onSendMessage]);

  const handleMessageAction = useCallback((messageId: string, action: 'copy' | 'retry' | 'delete') => {
    if (action === 'copy') {
      setUiState(prev => ({
        ...prev,
        messageActions: {
          ...prev.messageActions,
          showCopyFeedback: true
        }
      }));
      
      // Hide copy feedback after 2 seconds
      setTimeout(() => {
        setUiState(prev => ({
          ...prev,
          messageActions: {
            ...prev.messageActions,
            showCopyFeedback: false
          }
        }));
      }, 2000);
    }
    
    onMessageAction(messageId, action);
  }, [onMessageAction]);

  // Handle typing indicator updates (would be connected to WebSocket)
  useEffect(() => {
    // This would be connected to WebSocket events in a real implementation
    // For now, we'll simulate typing based on query processing
    if (sessionState.currentQuery && uiState.isTyping) {
      const timer = setTimeout(() => {
        setUiState(prev => ({ ...prev, isTyping: false }));
      }, 5000); // Max 5 seconds typing indicator
      
      return () => clearTimeout(timer);
    }
  }, [sessionState.currentQuery, uiState.isTyping]);

  return (
    <Container
      maxWidth="lg"
      className={className}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        py: isMobile ? 1 : 2,
        px: isMobile ? 1 : 2
      }}
    >
      <Paper
        elevation={2}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: isMobile ? '500px' : '600px',
          maxHeight: '100vh',
          overflow: 'hidden',
          borderRadius: 2
        }}
      >
        {/* Chat Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: 'divider',
            backgroundColor: theme.palette.background.default
          }}
        >
          <Typography variant="h6" component="h1">
            Ask Questions About Your Drawings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {sessionState.uploadedFiles.length > 0 
              ? `${sessionState.uploadedFiles.length} document${sessionState.uploadedFiles.length > 1 ? 's' : ''} uploaded`
              : 'Upload a document to start asking questions'
            }
          </Typography>
        </Box>

        {/* Message List */}
        <Box
          sx={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <MessageList
            messages={messages}
            onMessageAction={handleMessageAction}
            showCopyFeedback={uiState.messageActions.showCopyFeedback}
          />
          
          {uiState.isTyping && (
            <Box sx={{ px: 2, pb: 1 }}>
              <TypingIndicator />
            </Box>
          )}
        </Box>

        {/* Chat Input */}
        <Box
          sx={{
            borderTop: 1,
            borderColor: 'divider',
            backgroundColor: theme.palette.background.paper
          }}
        >
          <ChatInput
            onSendMessage={handleSendMessage}
            disabled={!isConnected || sessionState.uploadedFiles.length === 0}
            connectionStatus={uiState.connectionStatus}
            queryHistory={sessionState.queryHistory}
            uploadedFiles={sessionState.uploadedFiles}
          />
        </Box>
      </Paper>
    </Container>
  );
};