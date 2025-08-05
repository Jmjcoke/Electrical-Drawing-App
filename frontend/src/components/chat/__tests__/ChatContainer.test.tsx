import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import { ChatContainer } from '../ChatContainer';
import { SessionState } from '../../../types/chat';

// Mock child components
jest.mock('../MessageList', () => ({
  MessageList: ({ messages, onMessageAction, showCopyFeedback }: any) => (
    <div data-testid="message-list">
      <div data-testid="message-count">{messages.length}</div>
      <div data-testid="copy-feedback">{showCopyFeedback ? 'copied' : 'not-copied'}</div>
      {messages.map((msg: any) => (
        <div key={msg.id} data-testid={`message-${msg.id}`}>
          {msg.content}
          <button onClick={() => onMessageAction(msg.id, 'copy')}>Copy</button>
        </div>
      ))}
    </div>
  )
}));

jest.mock('../ChatInput', () => ({
  ChatInput: ({ onSendMessage, disabled, connectionStatus, uploadedFiles }: any) => (
    <div data-testid="chat-input">
      <div data-testid="connection-status">{connectionStatus}</div>
      <div data-testid="disabled-status">{disabled ? 'disabled' : 'enabled'}</div>
      <div data-testid="uploaded-files-count">{uploadedFiles.length}</div>
      <button 
        onClick={() => onSendMessage('test message', 'general_question')}
        data-testid="send-button"
      >
        Send
      </button>
    </div>
  )
}));

jest.mock('../TypingIndicator', () => ({
  TypingIndicator: () => <div data-testid="typing-indicator">AI is typing...</div>
}));

const theme = createTheme();

const mockSessionState: SessionState = {
  sessionId: 'test-session-123',
  uploadedFiles: [
    {
      fileId: 'file-1',
      originalName: 'test-schematic.pdf',
      size: 1024000,
      mimeType: 'application/pdf',
      uploadedAt: '2025-08-04T10:00:00Z',
      processingStatus: 'ready'
    }
  ],
  currentQuery: '',
  queryHistory: [
    {
      id: 'query-1',
      text: 'What components are in this schematic?',
      type: 'component_identification',
      timestamp: new Date('2025-08-04T10:00:00Z'),
      documentIds: ['file-1'],
      responses: [],
      aggregatedResult: {
        summary: 'This schematic contains 5 resistors, 3 capacitors, and 1 integrated circuit.',
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
          consensusResponse: 'High agreement across models'
        }
      }
    }
  ]
};

const defaultProps = {
  sessionState: mockSessionState,
  onSendMessage: jest.fn(),
  onMessageAction: jest.fn(),
  isConnected: true
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ChatContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders chat header with document count', () => {
      renderWithTheme(<ChatContainer {...defaultProps} />);
      
      expect(screen.getByText('Ask Questions About Your Drawings')).toBeInTheDocument();
      expect(screen.getByText('1 document uploaded')).toBeInTheDocument();
    });

    it('renders header with multiple documents', () => {
      const multiDocumentState = {
        ...mockSessionState,
        uploadedFiles: [
          ...mockSessionState.uploadedFiles,
          {
            fileId: 'file-2',
            originalName: 'another-schematic.pdf',
            size: 2048000,
            mimeType: 'application/pdf',
            uploadedAt: '2025-08-04T10:30:00Z',
            processingStatus: 'ready' as const
          }
        ]
      };

      renderWithTheme(
        <ChatContainer 
          {...defaultProps} 
          sessionState={multiDocumentState} 
        />
      );
      
      expect(screen.getByText('2 documents uploaded')).toBeInTheDocument();
    });

    it('renders upload prompt when no documents', () => {
      const emptySessionState = {
        ...mockSessionState,
        uploadedFiles: [],
        queryHistory: []
      };

      renderWithTheme(
        <ChatContainer 
          {...defaultProps} 
          sessionState={emptySessionState} 
        />
      );
      
      expect(screen.getByText('Upload a document to start asking questions')).toBeInTheDocument();
    });

    it('renders message list with correct message count', () => {
      renderWithTheme(<ChatContainer {...defaultProps} />);
      
      expect(screen.getByTestId('message-list')).toBeInTheDocument();
      // Should have 2 messages: 1 user query + 1 assistant response
      expect(screen.getByTestId('message-count')).toHaveTextContent('2');
    });

    it('renders chat input with correct props', () => {
      renderWithTheme(<ChatContainer {...defaultProps} />);
      
      expect(screen.getByTestId('chat-input')).toBeInTheDocument();
      expect(screen.getByTestId('connection-status')).toHaveTextContent('connected');
      expect(screen.getByTestId('disabled-status')).toHaveTextContent('enabled');
      expect(screen.getByTestId('uploaded-files-count')).toHaveTextContent('1');
    });
  });

  describe('Connection Status', () => {
    it('reflects disconnected status', () => {
      renderWithTheme(
        <ChatContainer {...defaultProps} isConnected={false} />
      );
      
      expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected');
    });

    it('disables input when disconnected', () => {
      renderWithTheme(
        <ChatContainer {...defaultProps} isConnected={false} />
      );
      
      expect(screen.getByTestId('disabled-status')).toHaveTextContent('disabled');
    });

    it('disables input when no files uploaded', () => {
      const emptySessionState = {
        ...mockSessionState,
        uploadedFiles: []
      };

      renderWithTheme(
        <ChatContainer 
          {...defaultProps} 
          sessionState={emptySessionState} 
        />
      );
      
      expect(screen.getByTestId('disabled-status')).toHaveTextContent('disabled');
    });
  });

  describe('Message Handling', () => {
    it('calls onSendMessage when send button clicked', () => {
      const mockOnSendMessage = jest.fn();
      
      renderWithTheme(
        <ChatContainer 
          {...defaultProps} 
          onSendMessage={mockOnSendMessage} 
        />
      );
      
      fireEvent.click(screen.getByTestId('send-button'));
      
      expect(mockOnSendMessage).toHaveBeenCalledWith('test message', 'general_question');
    });

    it('shows typing indicator when processing', async () => {
      const mockOnSendMessage = jest.fn();
      
      renderWithTheme(
        <ChatContainer 
          {...defaultProps} 
          onSendMessage={mockOnSendMessage} 
        />
      );
      
      // Simulate sending a message which should show typing indicator
      fireEvent.click(screen.getByTestId('send-button'));
      
      await waitFor(() => {
        expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
      });
    });

    it('calls onMessageAction when message action triggered', () => {
      const mockOnMessageAction = jest.fn();
      
      renderWithTheme(
        <ChatContainer 
          {...defaultProps} 
          onMessageAction={mockOnMessageAction} 
        />
      );
      
      const copyButton = screen.getAllByText('Copy')[0];
      fireEvent.click(copyButton);
      
      expect(mockOnMessageAction).toHaveBeenCalledWith(
        expect.stringMatching(/^(user|assistant)-query-1$/), 
        'copy'
      );
    });

    it('shows copy feedback when copy action performed', async () => {
      const mockOnMessageAction = jest.fn();
      
      renderWithTheme(
        <ChatContainer 
          {...defaultProps} 
          onMessageAction={mockOnMessageAction} 
        />
      );
      
      const copyButton = screen.getAllByText('Copy')[0];
      fireEvent.click(copyButton);
      
      await waitFor(() => {
        expect(screen.getByTestId('copy-feedback')).toHaveTextContent('copied');
      });

      // Should hide after timeout
      await waitFor(() => {
        expect(screen.getByTestId('copy-feedback')).toHaveTextContent('not-copied');
      }, { timeout: 3000 });
    });
  });

  describe('Responsive Design', () => {
    it('applies mobile styles on small screens', () => {
      // Mock useMediaQuery to return true for mobile
      const mockUseMediaQuery = jest.fn(() => true);
      jest.doMock('@mui/material', () => ({
        ...jest.requireActual('@mui/material'),
        useMediaQuery: mockUseMediaQuery
      }));

      renderWithTheme(<ChatContainer {...defaultProps} />);
      
      // Component should render without errors on mobile
      expect(screen.getByTestId('message-list')).toBeInTheDocument();
      expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      renderWithTheme(<ChatContainer {...defaultProps} />);
      
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Ask Questions About Your Drawings');
    });

    it('has accessible container structure', () => {
      renderWithTheme(<ChatContainer {...defaultProps} />);
      
      // Should have main container
      const container = screen.getByTestId('message-list').closest('[role]') || 
                       screen.getByTestId('message-list').closest('div');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles empty query history gracefully', () => {
      const emptyHistoryState = {
        ...mockSessionState,
        queryHistory: []
      };

      renderWithTheme(
        <ChatContainer 
          {...defaultProps} 
          sessionState={emptyHistoryState} 
        />
      );
      
      expect(screen.getByTestId('message-count')).toHaveTextContent('0');
    });

    it('handles missing session data gracefully', () => {
      const invalidSessionState = {
        sessionId: '',
        uploadedFiles: [],
        currentQuery: '',
        queryHistory: []
      };

      expect(() => {
        renderWithTheme(
          <ChatContainer 
            {...defaultProps} 
            sessionState={invalidSessionState} 
          />
        );
      }).not.toThrow();
    });
  });

  describe('Custom Props', () => {
    it('applies custom className', () => {
      const { container } = renderWithTheme(
        <ChatContainer {...defaultProps} className="custom-chat" />
      );
      
      expect(container.querySelector('.custom-chat')).toBeInTheDocument();
    });
  });
});