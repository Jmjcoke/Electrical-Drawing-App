import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import { ChatInput } from '../ChatInput';
import { Query, UploadedFile } from '../../../types/chat';

// Mock validation utilities
jest.mock('../../../utils/chatValidation', () => ({
  validateChatInput: jest.fn(() => ({
    isValid: true,
    errors: [],
    warnings: [],
    sanitizedContent: 'test message'
  })),
  generateSuggestions: jest.fn(() => [
    'Try: "What components are in this circuit?"',
    'Try: "Analyze the power consumption"'
  ]),
  formatChatValidationErrors: jest.fn(() => 'Validation error message')
}));

import { validateChatInput, formatChatValidationErrors } from '../../../utils/chatValidation';

const theme = createTheme();

const mockUploadedFiles: UploadedFile[] = [
  {
    fileId: 'file-1',
    originalName: 'test-schematic.pdf',
    size: 1024000,
    mimeType: 'application/pdf',
    uploadedAt: '2025-08-04T10:00:00Z',
    processingStatus: 'ready'
  }
];

const mockQueryHistory: Query[] = [
  {
    id: 'query-1',
    text: 'What components are in this schematic?',
    type: 'component_identification',
    timestamp: new Date('2025-08-04T10:00:00Z'),
    documentIds: ['file-1'],
    responses: []
  }
];

const defaultProps = {
  onSendMessage: jest.fn(),
  disabled: false,
  connectionStatus: 'connected' as const,
  queryHistory: mockQueryHistory,
  uploadedFiles: mockUploadedFiles
};

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('ChatInput', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all main components', () => {
      renderWithTheme(<ChatInput {...defaultProps} />);
      
      expect(screen.getByLabelText('Question Type')).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /ask a question/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    });

    it('shows connection status indicator', () => {
      renderWithTheme(<ChatInput {...defaultProps} />);
      
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('displays uploaded file indicators', () => {
      renderWithTheme(<ChatInput {...defaultProps} />);
      
      expect(screen.getByText('test-schematic.pdf')).toBeInTheDocument();
    });

    it('shows multiple file indicator when more than 3 files', () => {
      const manyFiles = Array.from({ length: 5 }, (_, i) => ({
        ...mockUploadedFiles[0],
        fileId: `file-${i + 1}`,
        originalName: `file-${i + 1}.pdf`
      }));

      renderWithTheme(
        <ChatInput {...defaultProps} uploadedFiles={manyFiles} />
      );
      
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });
  });

  describe('Input Functionality', () => {
    it('accepts text input', async () => {
      renderWithTheme(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('combobox', { name: /ask a question/i });
      await user.type(input, 'What is this component?');
      
      expect(input).toHaveValue('What is this component?');
    });

    it('sends message on form submit', async () => {
      const mockOnSendMessage = jest.fn();
      renderWithTheme(
        <ChatInput {...defaultProps} onSendMessage={mockOnSendMessage} />
      );
      
      const input = screen.getByRole('combobox', { name: /ask a question/i });
      const sendButton = screen.getByRole('button', { name: /send message/i });
      
      await user.type(input, 'Test message');
      await user.click(sendButton);
      
      expect(mockOnSendMessage).toHaveBeenCalledWith('test message', 'general_question');
    });

    it('sends message on Enter key', async () => {
      const mockOnSendMessage = jest.fn();
      renderWithTheme(
        <ChatInput {...defaultProps} onSendMessage={mockOnSendMessage} />
      );
      
      const input = screen.getByRole('combobox', { name: /ask a question/i });
      await user.type(input, 'Test message{enter}');
      
      expect(mockOnSendMessage).toHaveBeenCalledWith('test message', 'general_question');
    });

    it('does not send on Shift+Enter', async () => {
      const mockOnSendMessage = jest.fn();
      renderWithTheme(
        <ChatInput {...defaultProps} onSendMessage={mockOnSendMessage} />
      );
      
      const input = screen.getByRole('combobox', { name: /ask a question/i });
      await user.type(input, 'Test message{shift}{enter}');
      
      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it('clears input after sending', async () => {
      const mockOnSendMessage = jest.fn();
      renderWithTheme(
        <ChatInput {...defaultProps} onSendMessage={mockOnSendMessage} />
      );
      
      const input = screen.getByRole('combobox', { name: /ask a question/i });
      await user.type(input, 'Test message');
      await user.click(screen.getByRole('button', { name: /send message/i }));
      
      expect(input).toHaveValue('');
    });
  });

  describe('Query Type Selection', () => {
    it('allows changing query type', async () => {
      renderWithTheme(<ChatInput {...defaultProps} />);
      
      const select = screen.getByLabelText('Question Type');
      await user.click(select);
      
      const option = screen.getByText('Component Identification');
      await user.click(option);
      
      expect(select).toHaveTextContent('Component Identification');
    });

    it('auto-detects query type from autocomplete selection', async () => {
      renderWithTheme(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('combobox', { name: /ask a question/i });
      await user.type(input, 'identify');
      
      // Simulate autocomplete selection
      const option = await screen.findByText(/identify all resistors/i);
      await user.click(option);
      
      const select = screen.getByLabelText('Question Type');
      expect(select).toHaveTextContent('Component Identification');
    });
  });

  describe('Validation', () => {
    it('shows validation errors', async () => {
      (validateChatInput as jest.Mock).mockReturnValue({
        isValid: false,
        errors: ['Message is too short'],
        warnings: [],
        sanitizedContent: ''
      });

      (formatChatValidationErrors as jest.Mock).mockReturnValue('Message is too short');

      const mockOnSendMessage = jest.fn();
      renderWithTheme(
        <ChatInput {...defaultProps} onSendMessage={mockOnSendMessage} />
      );
      
      const input = screen.getByRole('combobox', { name: /ask a question/i });
      const sendButton = screen.getByRole('button', { name: /send message/i });
      
      await user.type(input, 'x'); // Short message
      await user.click(sendButton);
      
      expect(screen.getByText('Message is too short')).toBeInTheDocument();
      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });

    it('clears validation errors when typing', async () => {
      (validateChatInput as jest.Mock).mockReturnValue({
        isValid: false,
        errors: ['Message is too short'],
        warnings: [],
        sanitizedContent: ''
      });

      (formatChatValidationErrors as jest.Mock).mockReturnValue('Message is too short');

      renderWithTheme(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('combobox', { name: /ask a question/i });
      
      // Trigger validation error
      await user.type(input, 'x');
      fireEvent.submit(input.closest('form')!);
      
      expect(screen.getByText('Message is too short')).toBeInTheDocument();
      
      // Start typing again
      await user.type(input, ' more text');
      
      expect(screen.queryByText('Message is too short')).not.toBeInTheDocument();
    });

    it('shows suggestions for short inputs', async () => {
      renderWithTheme(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('combobox', { name: /ask a question/i });
      await user.type(input, 'what');
      
      await waitFor(() => {
        expect(screen.getByText('Need help with your question?')).toBeInTheDocument();
      });
    });

    it('uses sanitized content when sending', async () => {
      (validateChatInput as jest.Mock).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        sanitizedContent: 'sanitized message'
      });

      const mockOnSendMessage = jest.fn();
      renderWithTheme(
        <ChatInput {...defaultProps} onSendMessage={mockOnSendMessage} />
      );
      
      const input = screen.getByRole('combobox', { name: /ask a question/i });
      await user.type(input, '<script>alert("xss")</script>test');
      await user.click(screen.getByRole('button', { name: /send message/i }));
      
      expect(mockOnSendMessage).toHaveBeenCalledWith('sanitized message', 'general_question');
    });
  });

  describe('Disabled States', () => {
    it('disables input when disabled prop is true', () => {
      renderWithTheme(<ChatInput {...defaultProps} disabled={true} />);
      
      const input = screen.getByRole('combobox', { name: /ask a question/i });
      const sendButton = screen.getByRole('button', { name: /send message/i });
      
      expect(input).toBeDisabled();
      expect(sendButton).toBeDisabled();
    });

    it('shows appropriate placeholder when no files uploaded', () => {
      renderWithTheme(
        <ChatInput {...defaultProps} uploadedFiles={[]} />
      );
      
      expect(screen.getByPlaceholderText(/upload a document to start/i)).toBeInTheDocument();
    });

    it('disables send button for empty input', () => {
      renderWithTheme(<ChatInput {...defaultProps} />);
      
      const sendButton = screen.getByRole('button', { name: /send message/i });
      expect(sendButton).toBeDisabled();
    });
  });

  describe('Connection Status', () => {
    it('shows disconnected status', () => {
      renderWithTheme(
        <ChatInput {...defaultProps} connectionStatus="disconnected" />
      );
      
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('shows connecting status', () => {
      renderWithTheme(
        <ChatInput {...defaultProps} connectionStatus="connecting" />
      );
      
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });
  });

  describe('Autocomplete', () => {
    it('shows autocomplete options', async () => {
      renderWithTheme(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('combobox', { name: /ask a question/i });
      await user.click(input);
      
      // Should show suggested questions
      expect(screen.getByText('Suggested Questions')).toBeInTheDocument();
      expect(screen.getByText('Recent Questions')).toBeInTheDocument();
    });

    it('filters options based on input', async () => {
      renderWithTheme(<ChatInput {...defaultProps} />);
      
      const input = screen.getByRole('combobox', { name: /ask a question/i });
      await user.type(input, 'component');
      
      // Should show filtered options
      expect(screen.getByText(/components/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      renderWithTheme(<ChatInput {...defaultProps} />);
      
      expect(screen.getByLabelText('Question Type')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send message/i })).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      renderWithTheme(<ChatInput {...defaultProps} />);
      
      const select = screen.getByLabelText('Question Type');
      const input = screen.getByRole('combobox', { name: /ask a question/i });
      const sendButton = screen.getByRole('button', { name: /send message/i });
      
      // Tab through elements
      await user.tab();
      expect(select).toHaveFocus();
      
      await user.tab();
      expect(input).toHaveFocus();
      
      await user.type(input, 'test message');
      await user.tab();
      expect(sendButton).toHaveFocus();
    });

    it('has accessible error announcements', async () => {
      (validateChatInput as jest.Mock).mockReturnValue({
        isValid: false,
        errors: ['Message is required'],
        warnings: [],
        sanitizedContent: ''
      });

      (formatChatValidationErrors as jest.Mock).mockReturnValue('Message is required');

      renderWithTheme(<ChatInput {...defaultProps} />);
      
      const sendButton = screen.getByRole('button', { name: /send message/i });
      await user.click(sendButton);
      
      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveTextContent('Message is required');
    });
  });

  describe('Responsive Design', () => {
    it('adapts layout for mobile screens', () => {
      // Mock useMediaQuery for mobile
      const mockUseMediaQuery = jest.fn(() => true);
      jest.doMock('@mui/material', () => ({
        ...jest.requireActual('@mui/material'),
        useMediaQuery: mockUseMediaQuery
      }));

      renderWithTheme(<ChatInput {...defaultProps} />);
      
      // Should render without errors on mobile
      expect(screen.getByRole('combobox', { name: /ask a question/i })).toBeInTheDocument();
    });
  });

  describe('Character Limits', () => {
    it('validates message length', async () => {
      (validateChatInput as jest.Mock).mockReturnValue({
        isValid: false,
        errors: ['Message is too long'],
        warnings: [],
        sanitizedContent: ''
      });

      const mockOnSendMessage = jest.fn();
      renderWithTheme(
        <ChatInput {...defaultProps} onSendMessage={mockOnSendMessage} />
      );
      
      const input = screen.getByRole('combobox', { name: /ask a question/i });
      const longMessage = 'x'.repeat(2001); // Exceeds 2000 char limit
      
      await user.type(input, longMessage);
      await user.click(screen.getByRole('button', { name: /send message/i }));
      
      expect(validateChatInput).toHaveBeenCalledWith(
        longMessage,
        expect.objectContaining({ maxLength: 2000 })
      );
      expect(mockOnSendMessage).not.toHaveBeenCalled();
    });
  });
});