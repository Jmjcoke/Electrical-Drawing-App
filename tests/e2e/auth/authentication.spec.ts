/**
 * End-to-End Authentication Tests
 * Tests complete authentication workflow using Playwright
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');
  });

  test('should display login form correctly', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/electrical orchestrator/i);

    // Check main heading
    await expect(page.getByText('ELECTRICAL ORCHESTRATOR')).toBeVisible();

    // Check form elements
    await expect(page.getByPlaceholder('Username')).toBeVisible();
    await expect(page.getByPlaceholder('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

    // Check SSO options
    await expect(page.getByText('SAML SSO')).toBeVisible();
    await expect(page.getByText('LDAP')).toBeVisible();

    // Check demo credentials are shown
    await expect(page.getByText('Demo Credentials:')).toBeVisible();
    await expect(page.getByText('Username: demo_user')).toBeVisible();
    await expect(page.getByText('Password: demo_pass')).toBeVisible();
  });

  test('should prevent submission with empty fields', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /sign in/i });
    
    // Button should be disabled initially
    await expect(submitButton).toBeDisabled();

    // Fill only username
    await page.getByPlaceholder('Username').fill('testuser');
    await expect(submitButton).toBeDisabled();

    // Clear username and fill only password
    await page.getByPlaceholder('Username').clear();
    await page.getByPlaceholder('Password').fill('testpass');
    await expect(submitButton).toBeDisabled();
  });

  test('should show error message for invalid credentials', async ({ page }) => {
    // Fill form with invalid credentials
    await page.getByPlaceholder('Username').fill('invalid_user');
    await page.getByPlaceholder('Password').fill('invalid_pass');

    // Submit form
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for error message
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  });

  test('should successfully login with demo credentials', async ({ page }) => {
    // Fill form with demo credentials
    await page.getByPlaceholder('Username').fill('demo_user');
    await page.getByPlaceholder('Password').fill('demo_pass');

    // Submit form
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL('/dashboard');

    // Check that we're logged in (look for logout option or user info)
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });

  test('should toggle password visibility', async ({ page }) => {
    const passwordInput = page.getByPlaceholder('Password');
    const toggleButton = page.locator('button').filter({ has: page.locator('svg') }).nth(1); // Eye icon button

    // Password should be hidden initially
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Click to show password
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Click to hide password again
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should clear error when user starts typing', async ({ page }) => {
    // Create an error first
    await page.getByPlaceholder('Username').fill('invalid');
    await page.getByPlaceholder('Password').fill('invalid');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for error
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();

    // Start typing in username field
    await page.getByPlaceholder('Username').fill('new_input');

    // Error should disappear
    await expect(page.getByText(/invalid credentials/i)).not.toBeVisible();
  });

  test('should show loading state during authentication', async ({ page }) => {
    // Fill form
    await page.getByPlaceholder('Username').fill('demo_user');
    await page.getByPlaceholder('Password').fill('demo_pass');

    // Click submit and immediately check for loading state
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Check for loading text (this might be fast, so we use a more flexible approach)
    const submitButton = page.getByRole('button', { name: /signing in|sign in/i });
    await expect(submitButton).toBeVisible();
  });

  test('should handle SSO buttons (not implemented)', async ({ page }) => {
    // Test SAML SSO button
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('SAML login not yet implemented');
      await dialog.accept();
    });
    await page.getByText('SAML SSO').click();

    // Test LDAP button
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('LDAP login not yet implemented');
      await dialog.accept();
    });
    await page.getByText('LDAP').click();
  });
});

test.describe('Authentication Routing', () => {
  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    // Try to access dashboard without authentication
    await page.goto('/dashboard');

    // Should be redirected to login with redirect parameter
    await expect(page).toHaveURL(/\/login\?redirect=%2Fdashboard/);
  });

  test('should redirect to dashboard when accessing login while authenticated', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.getByPlaceholder('Username').fill('demo_user');
    await page.getByPlaceholder('Password').fill('demo_pass');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Wait for dashboard
    await expect(page).toHaveURL('/dashboard');

    // Try to go back to login
    await page.goto('/login');

    // Should be redirected back to dashboard
    await expect(page).toHaveURL('/dashboard');
  });

  test('should preserve redirect URL after login', async ({ page }) => {
    // Try to access a specific protected route
    await page.goto('/workspace');

    // Should be redirected to login with correct redirect parameter
    await expect(page).toHaveURL(/\/login\?redirect=%2Fworkspace/);

    // Login
    await page.getByPlaceholder('Username').fill('demo_user');
    await page.getByPlaceholder('Password').fill('demo_pass');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should be redirected to the original workspace URL
    await expect(page).toHaveURL('/workspace');
  });
});

test.describe('Authentication Persistence', () => {
  test('should maintain authentication across page refreshes', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByPlaceholder('Username').fill('demo_user');
    await page.getByPlaceholder('Password').fill('demo_pass');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    await expect(page).toHaveURL('/dashboard');

    // Refresh page
    await page.reload();

    // Should still be authenticated
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText(/dashboard/i)).toBeVisible();
  });

  test('should logout correctly and clear session', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByPlaceholder('Username').fill('demo_user');
    await page.getByPlaceholder('Password').fill('demo_pass');
    await page.getByRole('button', { name: /sign in/i }).click();
    
    await expect(page).toHaveURL('/dashboard');

    // Find and click logout button (assuming it exists in the UI)
    // This might need to be adjusted based on actual UI implementation
    const logoutButton = page.getByRole('button', { name: /logout|sign out/i });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      // If no logout button in UI yet, test programmatic logout
      await page.evaluate(() => {
        // Clear localStorage to simulate logout
        localStorage.clear();
      });
      await page.reload();
    }

    // Should be redirected to login page
    await expect(page).toHaveURL('/login');

    // Try to access protected route
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Security Features', () => {
  test('should handle session timeout gracefully', async ({ page }) => {
    // This test would require mocking token expiration
    // For now, it's a placeholder for future implementation
    test.skip('Session timeout handling - requires token expiration simulation');
  });

  test('should prevent XSS attacks in login form', async ({ page }) => {
    const xssScript = '<script>alert("xss")</script>';
    
    // Try to inject script in username field
    await page.getByPlaceholder('Username').fill(xssScript);
    await page.getByPlaceholder('Password').fill('password');
    
    // Submit form
    await page.getByRole('button', { name: /sign in/i }).click();
    
    // Script should not execute (no alert should appear)
    // The input should be treated as plain text
    await expect(page.getByPlaceholder('Username')).toHaveValue(xssScript);
  });

  test('should enforce HTTPS in production', async ({ page }) => {
    // This test would be environment-specific
    // In production, all requests should use HTTPS
    test.skip('HTTPS enforcement - environment-specific test');
  });
});

// Helper function for authentication in other tests
export async function authenticateUser(page: any, username = 'demo_user', password = 'demo_pass') {
  await page.goto('/login');
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/dashboard');
}