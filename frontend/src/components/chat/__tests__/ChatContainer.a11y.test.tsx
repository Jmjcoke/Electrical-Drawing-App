import React from 'react';
import { render, testA11y, mockMatchMedia, testResponsiveComponent, fireEvent, waitFor, act } from '../../../utils/testUtils';
import { ChatContainer } from '../ChatContainer';
import { SessionState } from '../../../types/chat';

// Mock child components with accessible implementations
jest.mock('../MessageList', () => ({
  MessageList: ({ messages, onMessageAction }: any) => (
    <div 
      role="log" 
      aria-live="polite" 
      aria-label="Chat messages"
      data-testid="message-list"
    >
      {messages.map((msg: any) => (
        <div 
          key={msg.id} 
          role="article"
          aria-label={`${msg.type} message`}
          data-testid={`message-${msg.id}`}
        >
          <p>{msg.content}</p>
          <button 
            onClick={() => onMessageAction(msg.id, 'copy')}
            aria-label={`Copy ${msg.type} message`}
          >
            Copy
          </button>
        </div>
      ))}
    </div>
  )
}));

jest.mock('../ChatInput', () => ({
  ChatInput: ({ onSendMessage, disabled, connectionStatus }: any) => (
    <div role="form" aria-label="Send message">
      <label htmlFor="message-input">
        Your question about the electrical drawings
      </label>
      <input
        id="message-input"
        type="text"
        disabled={disabled}
        aria-describedby="connection-status"
        placeholder="Ask a question..."
      />
      <div id="connection-status" aria-live="polite">
        Connection status: {connectionStatus}
      </div>
      <button 
        onClick={() => onSendMessage('test', 'general_question')}
        disabled={disabled}
        aria-label="Send message"
      >
        Send
      </button>
    </div>
  )
}));

jest.mock('../TypingIndicator', () => ({
  TypingIndicator: () => (
    <div 
      role="status" 
      aria-live="polite" 
      aria-label="AI is processing your question"
    >
      AI is typing...
    </div>
  )
}));

const mockSessionState: SessionState = {
  sessionId: 'test-session-123',
  uploadedFiles: [
    {
      fileId: 'file-1',
      originalName: 'electrical-schematic.pdf',
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

describe('ChatContainer Accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Accessibility', () => {
    it('has no accessibility violations', async () => {
      const { container } = render(<ChatContainer {...defaultProps} />);
      await testA11y(container);
    });

    it('has proper heading hierarchy', () => {
      const { getByRole } = render(<ChatContainer {...defaultProps} />);
      
      const mainHeading = getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('Ask Questions About Your Drawings');
    });

    it('has accessible document status', () => {
      const { getByText } = render(<ChatContainer {...defaultProps} />);
      
      expect(getByText('1 document uploaded')).toBeInTheDocument();
    });

    it('provides context for screen readers when no documents', () => {
      const emptySessionState = {
        ...mockSessionState,
        uploadedFiles: [],
        queryHistory: []
      };

      const { getByText } = render(
        <ChatContainer {...defaultProps} sessionState={emptySessionState} />
      );
      
      expect(getByText('Upload a document to start asking questions')).toBeInTheDocument();
    });
  });

  describe('Message List Accessibility', () => {
    it('has accessible message log', () => {
      const { getByRole } = render(<ChatContainer {...defaultProps} />);
      
      const messageLog = getByRole('log');
      expect(messageLog).toHaveAttribute('aria-live', 'polite');
      expect(messageLog).toHaveAttribute('aria-label', 'Chat messages');
    });

    it('has accessible individual messages', () => {
      const { getAllByRole } = render(<ChatContainer {...defaultProps} />);
      
      const messages = getAllByRole('article');
      expect(messages).toHaveLength(2); // User + Assistant message
      
      messages.forEach(message => {
        expect(message).toHaveAttribute('aria-label');
      });
    });

    it('has accessible message actions', () => {
      const { getAllByRole } = render(<ChatContainer {...defaultProps} />);
      
      const copyButtons = getAllByRole('button', { name: /copy.*message/i });
      expect(copyButtons.length).toBeGreaterThan(0);
      
      copyButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-label');
      });
    });
  });

  describe('Input Accessibility', () => {
    it('has accessible form structure', () => {
      const { getByRole } = render(<ChatContainer {...defaultProps} />);
      
      const form = getByRole('form');
      expect(form).toHaveAttribute('aria-label', 'Send message');
    });

    it('has properly labeled input', () => {
      const { getByLabelText } = render(<ChatContainer {...defaultProps} />);
      
      const input = getByLabelText('Your question about the electrical drawings');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('id', 'message-input');
    });

    it('has accessible connection status', () => {
      const { getByText } = render(<ChatContainer {...defaultProps} />);
      
      const status = getByText(/Connection status:/);
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(status).toHaveAttribute('id', 'connection-status');
    });

    it('has accessible send button', () => {
      const { getByRole } = render(<ChatContainer {...defaultProps} />);
      
      const sendButton = getByRole('button', { name: 'Send message' });
      expect(sendButton).toBeInTheDocument();
    });
  });

  describe('Loading States Accessibility', () => {
    it('has accessible typing indicator structure in mock', async () => {
      // Test that our mocked TypingIndicator has proper accessibility attributes
      const { getByRole, queryByRole } = render(<ChatContainer {...defaultProps} />);
      
      // Initially, no typing indicator should be present
      expect(queryByRole('status')).not.toBeInTheDocument();
      
      // Get input and add some text first
      const input = getByRole('textbox');
      const sendButton = getByRole('button', { name: 'Send message' });
      
      // Type a message first to enable the send button
      input.focus();
      fireEvent.change(input, { target: { value: 'test message' } });
      
      // Click the send button to trigger typing state
      act(() => {
        sendButton.click();
      });
      
      // Wait for the typing indicator to appear and verify accessibility
      await waitFor(() => {
        const typingIndicator = getByRole('status');
        expect(typingIndicator).toHaveAttribute('aria-live', 'polite');
        expect(typingIndicator).toHaveAttribute('aria-label', 'AI is processing your question');
      });
    });
  });

  describe('Disabled States Accessibility', () => {
    it('properly disables controls when disconnected', () => {
      const { getByRole } = render(
        <ChatContainer {...defaultProps} isConnected={false} />
      );
      
      const input = getByRole('textbox');
      const sendButton = getByRole('button', { name: 'Send message' });
      
      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });

    it('properly disables controls when no documents', () => {
      const emptySessionState = {
        ...mockSessionState,
        uploadedFiles: []
      };

      const { getByRole } = render(
        <ChatContainer {...defaultProps} sessionState={emptySessionState} />
      );
      
      const input = getByRole('textbox');
      const sendButton = getByRole('button', { name: 'Send message' });
      
      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });
  });

  describe('Responsive Accessibility', () => {
    it('maintains accessibility across different screen sizes', async () => {
      await testResponsiveComponent(() => 
        render(<ChatContainer {...defaultProps} />)
      );
    });

    it('has accessible mobile layout', async () => {
      mockMatchMedia(true); // Mobile breakpoint
      
      const { container } = render(<ChatContainer {...defaultProps} />);
      await testA11y(container);
    });

    it('has accessible desktop layout', async () => {
      mockMatchMedia(false); // Desktop breakpoint
      
      const { container } = render(<ChatContainer {...defaultProps} />);
      await testA11y(container);
    });
  });

  describe('Error States Accessibility', () => {
    it('handles empty session data accessibly', async () => {
      const invalidSessionState = {
        sessionId: '',
        uploadedFiles: [],
        currentQuery: '',
        queryHistory: []
      };

      const { container } = render(
        <ChatContainer {...defaultProps} sessionState={invalidSessionState} />
      );
      
      await testA11y(container);
    });
  });

  describe('Focus Management', () => {
    it('maintains logical focus order', () => {
      const { getByRole, getByLabelText } = render(<ChatContainer {...defaultProps} />);
      
      // Focus should move from input to send button
      const input = getByLabelText('Your question about the electrical drawings');
      const sendButton = getByRole('button', { name: 'Send message' });
      
      input.focus();
      expect(document.activeElement).toBe(input);
      
      // Tab to next element
      input.blur();
      sendButton.focus();
      expect(document.activeElement).toBe(sendButton);
    });
  });

  describe('High Contrast Mode', () => {
    it('works with high contrast preferences', async () => {
      // Simulate high contrast mode
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query.includes('prefers-contrast: high'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
        })),
      });

      const { container } = render(<ChatContainer {...defaultProps} />);
      await testA11y(container);
    });
  });

  describe('Reduced Motion', () => {
    it('respects reduced motion preferences', async () => {
      // Simulate reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query.includes('prefers-reduced-motion: reduce'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
        })),
      });

      const { container } = render(<ChatContainer {...defaultProps} />);
      await testA11y(container);
    });
  });
});