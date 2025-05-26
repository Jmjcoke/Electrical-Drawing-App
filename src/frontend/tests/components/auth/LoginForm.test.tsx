/**
 * Unit tests for LoginForm component
 * Tests user interactions, form validation, and authentication flow
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import { useAuthStore } from '@/stores/authStore';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock auth store
jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

// Mock fetch for API calls
global.fetch = jest.fn();

describe('LoginForm', () => {
  const mockPush = jest.fn();
  const mockLogin = jest.fn();
  const mockClearError = jest.fn();

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup router mock
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });

    // Setup auth store mock
    (useAuthStore as jest.Mock).mockReturnValue({
      login: mockLogin,
      isLoading: false,
      error: null,
      clearError: mockClearError,
    });
  });

  describe('Rendering', () => {
    it('renders login form with all required elements', () => {
      render(<LoginForm />);

      // Check for main elements
      expect(screen.getByText('ELECTRICAL ORCHESTRATOR')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      
      // Check for SSO options
      expect(screen.getByText('SAML SSO')).toBeInTheDocument();
      expect(screen.getByText('LDAP')).toBeInTheDocument();
      
      // Check for demo credentials
      expect(screen.getByText('Demo Credentials:')).toBeInTheDocument();
    });

    it('renders error message when error exists', () => {
      (useAuthStore as jest.Mock).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: 'Invalid credentials',
        clearError: mockClearError,
      });

      render(<LoginForm />);

      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });

    it('shows loading state when authentication is in progress', () => {
      (useAuthStore as jest.Mock).mockReturnValue({
        login: mockLogin,
        isLoading: true,
        error: null,
        clearError: mockClearError,
      });

      render(<LoginForm />);

      expect(screen.getByText('Signing in...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    });
  });

  describe('Form Interactions', () => {
    it('updates input values when user types', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const usernameInput = screen.getByPlaceholderText('Username');
      const passwordInput = screen.getByPlaceholderText('Password');

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'testpass');

      expect(usernameInput).toHaveValue('testuser');
      expect(passwordInput).toHaveValue('testpass');
    });

    it('toggles password visibility when eye icon is clicked', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const passwordInput = screen.getByPlaceholderText('Password');
      const toggleButton = screen.getByRole('button', { name: '' }); // Eye icon button

      // Password should be hidden initially
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Click to show password
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');

      // Click to hide password again
      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('clears error when user starts typing', async () => {
      const user = userEvent.setup();
      (useAuthStore as jest.Mock).mockReturnValue({
        login: mockLogin,
        isLoading: false,
        error: 'Previous error',
        clearError: mockClearError,
      });

      render(<LoginForm />);

      const usernameInput = screen.getByPlaceholderText('Username');
      await user.type(usernameInput, 'a');

      expect(mockClearError).toHaveBeenCalled();
    });
  });

  describe('Form Submission', () => {
    it('prevents submission with empty fields', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      
      // Button should be disabled when fields are empty
      expect(submitButton).toBeDisabled();

      // Try to submit empty form
      await user.click(submitButton);
      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('submits form with valid credentials', async () => {
      const user = userEvent.setup();
      const onSuccess = jest.fn();
      mockLogin.mockResolvedValue(undefined);

      render(<LoginForm onSuccess={onSuccess} redirectTo="/custom" />);

      // Fill form
      await user.type(screen.getByPlaceholderText('Username'), 'testuser');
      await user.type(screen.getByPlaceholderText('Password'), 'testpass');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      expect(submitButton).not.toBeDisabled();
      
      await user.click(submitButton);

      // Verify login was called with correct credentials
      expect(mockLogin).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'testpass',
      });

      // Wait for async operations
      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith('/custom');
      });
    });

    it('handles login failure gracefully', async () => {
      const user = userEvent.setup();
      const loginError = new Error('Login failed');
      mockLogin.mockRejectedValue(loginError);

      render(<LoginForm />);

      // Fill and submit form
      await user.type(screen.getByPlaceholderText('Username'), 'testuser');
      await user.type(screen.getByPlaceholderText('Password'), 'wrongpass');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(mockLogin).toHaveBeenCalled();
      // Error should be handled by the store, not component
    });
  });

  describe('SSO Integration', () => {
    it('shows alert for SAML SSO (not implemented)', async () => {
      const user = userEvent.setup();
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      render(<LoginForm />);

      await user.click(screen.getByText('SAML SSO'));

      expect(alertSpy).toHaveBeenCalledWith('SAML login not yet implemented');
      
      alertSpy.mockRestore();
    });

    it('shows alert for LDAP login (not implemented)', async () => {
      const user = userEvent.setup();
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      render(<LoginForm />);

      await user.click(screen.getByText('LDAP'));

      expect(alertSpy).toHaveBeenCalledWith('LDAP login not yet implemented');
      
      alertSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels and accessibility attributes', () => {
      render(<LoginForm />);

      const usernameInput = screen.getByPlaceholderText('Username');
      const passwordInput = screen.getByPlaceholderText('Password');

      // Check for proper labeling
      expect(usernameInput).toHaveAttribute('id', 'username');
      expect(passwordInput).toHaveAttribute('id', 'password');
      
      // Check for required attributes
      expect(usernameInput).toBeRequired();
      expect(passwordInput).toBeRequired();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const usernameInput = screen.getByPlaceholderText('Username');
      const passwordInput = screen.getByPlaceholderText('Password');
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Tab through form elements
      await user.tab();
      expect(usernameInput).toHaveFocus();

      await user.tab();
      expect(passwordInput).toHaveFocus();

      await user.tab();
      // Password toggle button should be focused
      
      await user.tab();
      expect(submitButton).toHaveFocus();
    });
  });

  describe('Integration with Auth Store', () => {
    it('uses auth store state correctly', () => {
      const storeState = {
        login: mockLogin,
        isLoading: true,
        error: 'Test error',
        clearError: mockClearError,
      };

      (useAuthStore as jest.Mock).mockReturnValue(storeState);

      render(<LoginForm />);

      // Verify component reflects store state
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });
  });
});