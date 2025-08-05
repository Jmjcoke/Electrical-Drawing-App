import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useChat } from '../useChat';
import { chatAPI } from '../../services/chat';

// Mock socket.io-client
const mockSocket = {
  connected: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

jest.mock('socket.io-client', () => {
  return {
    io: jest.fn(() => mockSocket)
  };
});

// Mock chat API
jest.mock('../../services/chat', () => ({
  chatAPI: {
    getSession: jest.fn(),
    sendQuery: jest.fn(),
  }
}));

const mockSessionData = {
  sessionId: 'test-session-123',
  uploadedFiles: [
    {
      fileId: 'file-1',
      originalName: 'test-schematic.pdf',
      size: 1024000,
      mimeType: 'application/pdf',
      uploadedAt: '2025-08-04T10:00:00Z',
      processingStatus: 'ready' as const
    }
  ],
  queryHistory: [
    {
      id: 'query-1',
      text: 'What components are in this schematic?',
      type: 'component_identification' as const,
      timestamp: new Date('2025-08-04T10:00:00Z'),
      documentIds: ['file-1'],
      responses: [],
      aggregatedResult: {
        summary: 'This schematic contains resistors and capacitors.',
        components: [],
        confidence: {
          overall: 0.85,
          agreement: 0.9,
          completeness: 0.8,
          consistency: 0.85,
          factors: {
            modelConsensus: 0.9,
            responseQuality: 0.8,
            logicalConsistency: 0.85,
            coverage: 0.8,
            uncertainty: 0.15
          }
        },
        consensus: {
          agreementLevel: 0.9,
          conflictingResponses: [],
          consensusResponse: 'High agreement'
        }
      }
    }
  ],
  createdAt: '2025-08-04T09:00:00Z',
  expiresAt: '2025-08-04T18:00:00Z'
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0
      }
    }
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useChat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket.connected = false;
    (chatAPI.getSession as jest.Mock).mockResolvedValue(mockSessionData);
  });

  describe('Initialization', () => {
    it('initializes with default state', () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'test-session' }),
        { wrapper: createWrapper() }
      );

      expect(result.current.messages).toEqual([]);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.uiState.connectionStatus).toBe('disconnected');
    });

    it('fetches session data when sessionId provided', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'test-session' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(chatAPI.getSession).toHaveBeenCalledWith('test-session');
      });

      await waitFor(() => {
        expect(result.current.sessionState.sessionId).toBe('test-session-123');
      });
    });

    it('converts query history to messages', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'test-session' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2); // User + Assistant message
      });

      const [userMessage, assistantMessage] = result.current.messages;
      
      expect(userMessage.type).toBe('user');
      expect(userMessage.content).toBe('What components are in this schematic?');
      
      expect(assistantMessage.type).toBe('assistant');
      expect(assistantMessage.content).toBe('This schematic contains resistors and capacitors.');
    });
  });

  describe('WebSocket Connection', () => {
    it('connects WebSocket when autoConnect is true', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'test-session', autoConnect: true }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.sessionState.sessionId).toBe('test-session-123');
      });

      act(() => {
        result.current.connect();
      });

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('query-response', expect.any(Function));
    });

    it('updates connection status on connect', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'test-session' }),
        { wrapper: createWrapper() }
      );

      act(() => {
        result.current.connect();
      });

      // Simulate WebSocket connect event
      const connectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];

      act(() => {
        mockSocket.connected = true;
        connectHandler?.();
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.uiState.connectionStatus).toBe('connected');
    });

    it('updates connection status on disconnect', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'test-session' }),
        { wrapper: createWrapper() }
      );

      act(() => {
        result.current.connect();
      });

      // Simulate disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];

      act(() => {
        mockSocket.connected = false;
        disconnectHandler?.();
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.uiState.connectionStatus).toBe('disconnected');
    });

    it('handles query response events', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'test-session' }),
        { wrapper: createWrapper() }
      );

      act(() => {
        result.current.connect();
      });

      const queryResponseHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'query-response'
      )?.[1];

      const mockResponse = {
        queryId: 'new-query-1',
        response: {
          summary: 'New analysis result',
          components: [],
          confidence: { overall: 0.9 },
          consensus: { agreementLevel: 0.95 }
        }
      };

      act(() => {
        queryResponseHandler?.(mockResponse);
      });

      await waitFor(() => {
        const lastMessage = result.current.messages[result.current.messages.length - 1];
        expect(lastMessage.content).toBe('New analysis result');
        expect(lastMessage.type).toBe('assistant');
      });
    });
  });

  describe('Message Sending', () => {
    it('adds optimistic user message when sending', async () => {
      (chatAPI.getSession as jest.Mock).mockResolvedValue(mockSessionData);
      
      const { result } = renderHook(
        () => useChat({ sessionId: 'test-session' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.sessionState.sessionId).toBe('test-session-123');
      });

      const initialMessageCount = result.current.messages.length;

      act(() => {
        result.current.sendMessage('New test question', 'general_question');
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(initialMessageCount + 1);
      });

      const newMessage = result.current.messages[result.current.messages.length - 1];
      expect(newMessage.type).toBe('user');
      expect(newMessage.content).toBe('New test question');
    });

    it('shows typing indicator when sending message', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'test-session' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.sessionState.sessionId).toBe('test-session-123');
      });

      act(() => {
        result.current.sendMessage('Test question', 'general_question');
      });

      await waitFor(() => {
        expect(result.current.uiState.isTyping).toBe(true);
      });
    });

    it('emits WebSocket start-query event when connected', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'test-session' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.sessionState.sessionId).toBe('test-session-123');
      });

      act(() => {
        result.current.connect();
        mockSocket.connected = true;
      });

      act(() => {
        result.current.sendMessage('Test question', 'general_question');
      });

      await waitFor(() => {
        expect(mockSocket.emit).toHaveBeenCalledWith('start-query', 
          expect.objectContaining({
            queryText: 'Test question'
          })
        );
      });
    });
  });

  describe('Message Actions', () => {
    it('handles copy action', async () => {
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined)
        }
      });

      const { result } = renderHook(
        () => useChat({ sessionId: 'test-session' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });

      const messageId = result.current.messages[0].id;

      act(() => {
        result.current.handleMessageAction(messageId, 'copy');
      });

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          result.current.messages[0].content
        );
      });

      await waitFor(() => {
        expect(result.current.uiState.messageActions.showCopyFeedback).toBe(true);
      });
    });

    it('handles retry action for user messages', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'test-session' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });

      const userMessage = result.current.messages.find(m => m.type === 'user');
      const initialMessageCount = result.current.messages.length;

      act(() => {
        result.current.handleMessageAction(userMessage!.id, 'retry');
      });

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(initialMessageCount + 1);
      });
    });

    it('handles delete action', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'test-session' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });

      const messageId = result.current.messages[0].id;
      const initialMessageCount = result.current.messages.length;

      act(() => {
        result.current.handleMessageAction(messageId, 'delete');
      });

      expect(result.current.messages).toHaveLength(initialMessageCount - 1);
      expect(result.current.messages.find(m => m.id === messageId)).toBeUndefined();
    });
  });

  describe('Session Management', () => {
    it('handles session fetch errors', async () => {
      (chatAPI.getSession as jest.Mock).mockRejectedValue(new Error('Session not found'));

      const { result } = renderHook(
        () => useChat({ sessionId: 'invalid-session' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.sessionState.sessionId).toBe('invalid-session');
        expect(result.current.sessionState.uploadedFiles).toEqual([]);
      });
    });

    it('provides default session state when no sessionId', () => {
      const { result } = renderHook(
        () => useChat({}),
        { wrapper: createWrapper() }
      );

      expect(result.current.sessionState.sessionId).toBe('');
      expect(result.current.sessionState.uploadedFiles).toEqual([]);
      expect(result.current.sessionState.queryHistory).toEqual([]);
    });
  });

  describe('Cleanup', () => {
    it('disconnects WebSocket on unmount', () => {
      const { unmount } = renderHook(
        () => useChat({ sessionId: 'test-session', autoConnect: true }),
        { wrapper: createWrapper() }
      );

      unmount();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('clears messages when clearMessages called', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'test-session' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });

      act(() => {
        result.current.clearMessages();
      });

      expect(result.current.messages).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('handles WebSocket connection errors', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'test-session' }),
        { wrapper: createWrapper() }
      );

      act(() => {
        result.current.connect();
      });

      const errorHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect_error'
      )?.[1];

      act(() => {
        errorHandler?.(new Error('Connection failed'));
      });

      expect(result.current.uiState.connectionStatus).toBe('disconnected');
    });

    it('adds error message when send fails', async () => {
      // Mock API to reject
      const mockError = new Error('Send failed');
      (fetch as jest.Mock) = jest.fn().mockRejectedValue(mockError);

      const { result } = renderHook(
        () => useChat({ sessionId: 'test-session' }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.sessionState.sessionId).toBe('test-session-123');
      });

      const initialMessageCount = result.current.messages.length;

      act(() => {
        result.current.sendMessage('Test question', 'general_question');
      });

      await waitFor(() => {
        const messages = result.current.messages;
        const errorMessage = messages.find(m => m.error);
        expect(errorMessage).toBeTruthy();
        expect(errorMessage?.content).toContain('error processing your message');
      });
    });
  });

  describe('Connection Retry', () => {
    it('provides retry connection functionality', async () => {
      const { result } = renderHook(
        () => useChat({ sessionId: 'test-session' }),
        { wrapper: createWrapper() }
      );

      act(() => {
        result.current.retryConnection();
      });

      // Should disconnect first
      expect(mockSocket.disconnect).toHaveBeenCalled();
      
      // Then reconnect after timeout
      await waitFor(() => {
        expect(mockSocket.on).toHaveBeenCalled();
      }, { timeout: 2000 });
    });
  });
});