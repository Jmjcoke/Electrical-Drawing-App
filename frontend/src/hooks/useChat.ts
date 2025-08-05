import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { 
  ChatMessage, 
  Query, 
  SessionState, 
  ChatUIState, 
  ChatWebSocketEvents,
  AnalysisResult 
} from '../types/chat';

interface UseChatOptions {
  sessionId: string;
  enabled?: boolean;
  autoConnect?: boolean;
}

interface UseChatReturn {
  messages: ChatMessage[];
  sessionState: SessionState;
  uiState: ChatUIState;
  isConnected: boolean;
  sendMessage: (message: string, type: 'component_identification' | 'general_question' | 'schematic_analysis') => void;
  handleMessageAction: (messageId: string, action: 'copy' | 'retry' | 'delete' | 'share' | 'bookmark') => void;
  connect: () => void;
  disconnect: () => void;
  clearMessages: () => void;
  retryConnection: () => void;
}

export const useChat = ({ 
  sessionId, 
  enabled = true, 
  autoConnect = true 
}: UseChatOptions): UseChatReturn => {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [uiState, setUiState] = useState<ChatUIState>({
    isTyping: false,
    connectionStatus: 'disconnected',
    messageActions: {
      showCopyFeedback: false
    }
  });

  // Fetch session state
  const { data: sessionState, isLoading: isSessionLoading } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: async (): Promise<SessionState> => {
      const response = await fetch(`/api/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch session');
      }
      const data = await response.json();
      return {
        sessionId: data.sessionId,
        uploadedFiles: data.uploadedFiles || [],
        currentQuery: data.currentQuery || '',
        queryHistory: data.queryHistory || []
      };
    },
    enabled: enabled && !!sessionId,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000 // Data is fresh for 10 seconds
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ 
      message, 
      type 
    }: { 
      message: string; 
      type: 'component_identification' | 'general_question' | 'schematic_analysis' 
    }) => {
      const response = await fetch(`/api/sessions/${sessionId}/queries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          queryText: message,
          queryType: type,
          documentIds: sessionState?.uploadedFiles.map(f => f.fileId) || []
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Optimistically add the query to local state
      const newQuery: Query = {
        id: data.queryId,
        text: data.queryText,
        type: data.queryType,
        timestamp: new Date(),
        documentIds: data.documentIds,
        responses: [],
        aggregatedResult: undefined
      };

      // Add user message
      const userMessage: ChatMessage = {
        id: `user-${data.queryId}`,
        type: 'user',
        content: data.queryText,
        timestamp: new Date(),
        query: newQuery
      };

      setMessages(prev => [...prev, userMessage]);

      // Start typing indicator
      setUiState(prev => ({ ...prev, isTyping: true }));

      // Emit WebSocket event to start processing
      if (socketRef.current?.connected) {
        socketRef.current.emit('start-query', {
          queryId: data.queryId,
          queryText: data.queryText,
          documentIds: data.documentIds
        });
      }

      // Invalidate session query to refresh
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
    },
    onError: (error) => {
      console.error('Failed to send message:', error);
      // Add error message
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  });

  // WebSocket connection management
  const connect = useCallback(() => {
    if (socketRef.current?.connected || !sessionId) {
      return;
    }

    setUiState(prev => ({ ...prev, connectionStatus: 'connecting' }));

    const socket = io({
      query: { sessionId },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    // Connection events
    socket.on('connect', () => {
      setUiState(prev => ({ ...prev, connectionStatus: 'connected' }));
      socket.emit('join-session', { sessionId });
    });

    socket.on('disconnect', () => {
      setUiState(prev => ({ ...prev, connectionStatus: 'disconnected', isTyping: false }));
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setUiState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
    });

    // Chat-specific events
    socket.on('query-progress', (data: { queryId: string; stage: string; progress: number }) => {
      setUiState(prev => ({ ...prev, isTyping: true }));
    });

    socket.on('query-response', (data: { queryId: string; response: AnalysisResult }) => {
      setUiState(prev => ({ ...prev, isTyping: false }));

      // Add assistant response message
      const assistantMessage: ChatMessage = {
        id: `assistant-${data.queryId}`,
        type: 'assistant',
        content: data.response.summary,
        timestamp: new Date(),
        query: {
          id: data.queryId,
          text: '',
          type: 'general_question',
          timestamp: new Date(),
          documentIds: [],
          responses: [],
          aggregatedResult: data.response
        }
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Refresh session data
      queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
    });

    socket.on('typing-indicator', (data: { sessionId: string; isTyping: boolean }) => {
      if (data.sessionId === sessionId) {
        setUiState(prev => ({ ...prev, isTyping: data.isTyping }));
      }
    });

    socket.on('session-updated', (data: { sessionId: string; queryHistory: Query[] }) => {
      if (data.sessionId === sessionId) {
        queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
      }
    });

    socketRef.current = socket;
  }, [sessionId, queryClient]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setUiState(prev => ({ ...prev, connectionStatus: 'disconnected', isTyping: false }));
    }
  }, []);

  const retryConnection = useCallback(() => {
    disconnect();
    setTimeout(connect, 1000);
  }, [disconnect, connect]);

  // Auto-connect when enabled and sessionId is available
  useEffect(() => {
    if (autoConnect && enabled && sessionId && !isSessionLoading) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, enabled, sessionId, isSessionLoading, connect, disconnect]);

  // Convert session query history to messages when session data changes
  useEffect(() => {
    if (sessionState?.queryHistory) {
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
            timestamp: new Date(query.timestamp.getTime() + 1000),
            query
          });
        }
      });

      // Only update if different to prevent unnecessary re-renders
      setMessages(prev => {
        if (prev.length !== convertedMessages.length) {
          return convertedMessages;
        }
        return prev;
      });
    }
  }, [sessionState?.queryHistory]);

  // Message action handlers
  const handleMessageAction = useCallback(async (
    messageId: string, 
    action: 'copy' | 'retry' | 'delete' | 'share' | 'bookmark'
  ) => {
    const message = messages.find(m => m.id === messageId);
    if (!message) return;

    switch (action) {
      case 'copy':
        try {
          await navigator.clipboard.writeText(message.content);
          setUiState(prev => ({
            ...prev,
            messageActions: { ...prev.messageActions, showCopyFeedback: true }
          }));
          setTimeout(() => {
            setUiState(prev => ({
              ...prev,
              messageActions: { ...prev.messageActions, showCopyFeedback: false }
            }));
          }, 2000);
        } catch (error) {
          console.error('Failed to copy to clipboard:', error);
        }
        break;

      case 'retry':
        if (message.type === 'user' && message.query) {
          sendMessageMutation.mutate({
            message: message.content,
            type: message.query.type
          });
        }
        break;

      case 'delete':
        setMessages(prev => prev.filter(m => m.id !== messageId));
        // TODO: Implement server-side deletion if needed
        break;

      case 'share':
        if (navigator.share) {
          try {
            await navigator.share({
              title: 'Chat Message',
              text: message.content
            });
          } catch (error) {
            // Fallback to clipboard
            await navigator.clipboard.writeText(message.content);
          }
        }
        break;

      case 'bookmark':
        // TODO: Implement bookmarking functionality
        console.log('Bookmark functionality not yet implemented');
        break;
    }
  }, [messages, sendMessageMutation]);

  const sendMessage = useCallback((
    message: string, 
    type: 'component_identification' | 'general_question' | 'schematic_analysis'
  ) => {
    sendMessageMutation.mutate({ message, type });
  }, [sendMessageMutation]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    sessionState: sessionState || {
      sessionId,
      uploadedFiles: [],
      currentQuery: '',
      queryHistory: []
    },
    uiState,
    isConnected: uiState.connectionStatus === 'connected',
    sendMessage,
    handleMessageAction,
    connect,
    disconnect,
    clearMessages,
    retryConnection
  };
};