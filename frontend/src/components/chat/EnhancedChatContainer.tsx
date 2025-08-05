/**
 * Enhanced ChatContainer with integrated highlighting and context management
 * Extends the original ChatContainer to include highlight synchronization and suggestions
 */

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  useTheme,
  useMediaQuery,
  Container,
  Alert,
  Snackbar,
} from '@mui/material';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { EnhancedMessageBubble } from './EnhancedMessageBubble';
import { ChatMessage, SessionState, ChatUIState, ComponentSuggestion } from '../../types/chat';
import type { 
  ComponentHighlight, 
  HighlightReference 
} from '../../types/highlighting.types';
import { getContextHighlightManager } from '../../services/context-highlight-manager';
import { getHighlightingService } from '../../services/highlighting.service';

interface EnhancedChatContainerProps {
  sessionState: SessionState;
  highlights: ComponentHighlight[];
  highlightReferences: HighlightReference[];
  onSendMessage: (message: string, type: 'component_identification' | 'general_question' | 'schematic_analysis') => void;
  onMessageAction: (messageId: string, action: 'copy' | 'retry' | 'delete') => void;
  onHighlightUpdate: (highlights: ComponentHighlight[]) => void;
  onHighlightClick: (highlightId: string) => void;
  onHighlightToggle: (highlightId: string, visible: boolean) => void;
  isConnected: boolean;
  className?: string;
}

export const EnhancedChatContainer: React.FC<EnhancedChatContainerProps> = ({
  sessionState,
  highlights,
  highlightReferences,
  onSendMessage,
  onMessageAction,
  onHighlightUpdate,
  onHighlightClick,
  onHighlightToggle,
  isConnected,
  className
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const contextManager = getContextHighlightManager();
  
  const [uiState, setUiState] = useState<ChatUIState>({
    isTyping: false,
    connectionStatus: isConnected ? 'connected' : 'disconnected',
    messageActions: {
      showCopyFeedback: false
    }
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<ComponentSuggestion[]>([]);
  const [notification, setNotification] = useState<{
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  } | null>(null);

  // Convert query history to chat messages with highlight integration
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

  // Process new queries for highlight integration
  useEffect(() => {
    const processLatestQuery = async () => {
      const latestQuery = sessionState.queryHistory[sessionState.queryHistory.length - 1];
      if (!latestQuery?.aggregatedResult) return;

      try {
        const result = await contextManager.processQueryResponse(latestQuery, sessionState);
        
        // Update highlights
        if (result.highlights.length > 0) {
          const updatedHighlights = contextManager.updateHighlightPersistence(
            result.highlights,
            latestQuery,
            sessionState.highlightContext
          );
          onHighlightUpdate([...highlights, ...updatedHighlights]);
        }

        // Update suggestions
        setSuggestions(result.suggestions);

        // Show notification if highlights were generated
        if (result.highlights.length > 0) {
          setNotification({
            message: `Generated ${result.highlights.length} highlight${result.highlights.length !== 1 ? 's' : ''} from response`,
            severity: 'success'
          });
        }
      } catch (error) {
        console.error('Error processing query highlights:', error);
        setNotification({
          message: 'Error generating highlights from response',
          severity: 'warning'
        });
      }
    };

    processLatestQuery();
  }, [sessionState.queryHistory, sessionState, contextManager, highlights, onHighlightUpdate]);

  // Clean up expired highlights periodically
  useEffect(() => {
    const cleanup = () => {
      if (!sessionState.highlightContext) return;

      const { activeHighlights, expiredHighlights } = contextManager.cleanupExpiredHighlights(
        highlights,
        sessionState.highlightContext
      );

      if (expiredHighlights.length > 0) {
        onHighlightUpdate(activeHighlights);
        setNotification({
          message: `Cleaned up ${expiredHighlights.length} expired highlight${expiredHighlights.length !== 1 ? 's' : ''}`,
          severity: 'info'
        });
      }
    };

    const interval = setInterval(cleanup, 60000); // Clean up every minute
    return () => clearInterval(interval);
  }, [highlights, sessionState.highlightContext, contextManager, onHighlightUpdate]);

  const handleSendMessage = useCallback(async (
    message: string, 
    type: 'component_identification' | 'general_question' | 'schematic_analysis'
  ) => {
    // Optimistically add user message
    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      type: 'user',
      content: message,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setUiState(prev => ({ ...prev, isTyping: true }));
    
    // Generate contextual suggestions for the new query
    try {
      const currentSuggestions = await contextManager.generateContextualSuggestions(
        {
          id: userMessage.id,
          text: message,
          type,
          timestamp: new Date(),
          documentIds: sessionState.uploadedFiles.map(f => f.id),
          responses: []
        },
        highlights,
        sessionState.highlightContext
      );
      setSuggestions(currentSuggestions);
    } catch (error) {
      console.error('Error generating suggestions:', error);
    }
    
    onSendMessage(message, type);
  }, [onSendMessage, sessionState.uploadedFiles, contextManager, highlights, sessionState.highlightContext]);

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

  const handleGenerateHighlights = useCallback(async (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (!message?.query) return;

    try {
      setNotification({
        message: 'Generating highlights...',
        severity: 'info'
      });

      const result = await contextManager.processQueryResponse(message.query, sessionState);
      
      if (result.highlights.length > 0) {
        const updatedHighlights = contextManager.updateHighlightPersistence(
          result.highlights,
          message.query,
          sessionState.highlightContext
        );
        onHighlightUpdate([...highlights, ...updatedHighlights]);
        
        setNotification({
          message: `Generated ${result.highlights.length} highlight${result.highlights.length !== 1 ? 's' : ''}`,
          severity: 'success'
        });
      } else {
        setNotification({
          message: 'No highlights could be generated from this response',
          severity: 'info'
        });
      }
    } catch (error) {
      console.error('Error generating highlights:', error);
      setNotification({
        message: 'Error generating highlights',
        severity: 'error'
      });
    }
  }, [messages, contextManager, sessionState, highlights, onHighlightUpdate]);

  const handleSuggestionAccept = useCallback(async (suggestion: ComponentSuggestion) => {
    try {
      // Create a highlight from the suggestion
      const newHighlight: ComponentHighlight = {
        id: `suggestion-${Date.now()}`,
        componentId: suggestion.componentId,
        type: 'component',
        coordinates: {
          x: 0.5, // Default position - would be improved with actual location data
          y: 0.5,
          width: 0.1,
          height: 0.1,
          pageNumber: 1,
          zoomLevel: 1,
          viewportOffset: { x: 0, y: 0 }
        },
        style: {
          color: '#2196F3',
          opacity: 0.7,
          strokeWidth: 2,
          strokeStyle: 'solid',
          fillOpacity: 0.2,
          zIndex: 1
        },
        responseId: suggestion.componentId,
        queryId: suggestion.componentId,
        sessionId: sessionState.sessionId,
        createdAt: new Date(),
        isVisible: true,
        isPersistent: suggestion.confidence > 0.8
      };

      onHighlightUpdate([...highlights, newHighlight]);
      
      setNotification({
        message: `Applied suggestion: ${suggestion.componentId}`,
        severity: 'success'
      });

      // Remove the accepted suggestion from the list
      setSuggestions(prev => prev.filter(s => s.componentId !== suggestion.componentId));
    } catch (error) {
      console.error('Error accepting suggestion:', error);
      setNotification({
        message: 'Error applying suggestion',
        severity: 'error'
      });
    }
  }, [highlights, onHighlightUpdate, sessionState.sessionId]);

  // Handle typing indicator updates
  useEffect(() => {
    if (sessionState.currentQuery && uiState.isTyping) {
      const timer = setTimeout(() => {
        setUiState(prev => ({ ...prev, isTyping: false }));
      }, 5000); // Max 5 seconds typing indicator
      
      return () => clearTimeout(timer);
    }
  }, [sessionState.currentQuery, uiState.isTyping]);

  const handleCloseNotification = useCallback(() => {
    setNotification(null);
  }, []);

  // Custom message renderer that uses EnhancedMessageBubble
  const renderMessage = useCallback((message: ChatMessage, _index: number) => {
    const messageHighlights = highlights.filter(h => 
      h.responseId === message.query?.id || h.queryId === message.query?.id
    );
    
    const messageReferences = highlightReferences.filter(ref => 
      ref.responseText === message.content || 
      message.content.includes(ref.responseText)
    );

    return (
      <EnhancedMessageBubble
        key={message.id}
        message={message}
        highlights={messageHighlights}
        highlightReferences={messageReferences}
        suggestions={suggestions}
        onAction={handleMessageAction}
        onHighlightClick={onHighlightClick}
        onHighlightToggle={onHighlightToggle}
        onSuggestionAccept={handleSuggestionAccept}
        onGenerateHighlights={handleGenerateHighlights}
        showHighlightIntegration={true}
      />
    );
  }, [
    highlights,
    highlightReferences,
    suggestions,
    handleMessageAction,
    onHighlightClick,
    onHighlightToggle,
    handleSuggestionAccept,
    handleGenerateHighlights
  ]);

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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              {sessionState.uploadedFiles.length > 0 
                ? `${sessionState.uploadedFiles.length} document${sessionState.uploadedFiles.length > 1 ? 's' : ''} uploaded`
                : 'Upload a document to start asking questions'
              }
            </Typography>
            
            {highlights.length > 0 && (
              <Typography variant="body2" color="primary">
                {highlights.filter(h => h.isVisible).length}/{highlights.length} highlights active
              </Typography>
            )}
            
            {suggestions.length > 0 && (
              <Typography variant="body2" color="secondary">
                {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
              </Typography>
            )}
          </Box>
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
          <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
            {messages.map(renderMessage)}
          </Box>
          
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

      {/* Notification Snackbar */}
      <Snackbar
        open={!!notification}
        autoHideDuration={4000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {notification && (
          <Alert 
            onClose={handleCloseNotification} 
            severity={notification.severity}
            variant="filled"
          >
            {notification.message}
          </Alert>
        )}
      </Snackbar>
    </Container>
  );
};

EnhancedChatContainer.displayName = 'EnhancedChatContainer';