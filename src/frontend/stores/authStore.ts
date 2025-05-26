/**
 * Authentication Store for ELECTRICAL ORCHESTRATOR
 * Manages user authentication state, tokens, and role-based permissions
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// User role types as defined in PRD
export type UserRole = 
  | 'system_admin'
  | 'electrical_lead'
  | 'fco_lead'
  | 'project_manager'
  | 'foreman'
  | 'general_foreman'
  | 'superintendent'
  | 'electrician'
  | 'fco_technician';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  permissions: string[];
  fullName: string;
  company?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface AuthState {
  // State
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
  clearError: () => void;
  
  // Utility methods
  hasPermission: (permission: string) => boolean;
  hasRole: (role: UserRole) => boolean;
  isManagementRole: () => boolean;
  isExecutionRole: () => boolean;
}

// API client for authentication
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';

class AuthAPI {
  static async login(credentials: LoginCredentials): Promise<TokenResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    return response.json();
  }

  static async getProfile(token: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get profile');
    }

    return response.json();
  }

  static async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Token refresh failed');
    }

    return response.json();
  }

  static async logout(token: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.warn('Logout request failed, but continuing with local logout');
    }
  }
}

// Create the auth store with persistence
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Login action
      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });

        try {
          // Authenticate and get tokens
          const tokenResponse = await AuthAPI.login(credentials);
          
          // Get user profile
          const user = await AuthAPI.getProfile(tokenResponse.access_token);

          set({
            user,
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Login failed',
          });
          throw error;
        }
      },

      // Logout action
      logout: () => {
        const { accessToken } = get();
        
        // Call logout API (async, but don't wait)
        if (accessToken) {
          AuthAPI.logout(accessToken).catch(console.error);
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      // Refresh access token
      refreshAccessToken: async () => {
        const { refreshToken } = get();
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        try {
          const tokenResponse = await AuthAPI.refreshToken(refreshToken);
          
          set({
            accessToken: tokenResponse.access_token,
            // Keep existing refresh token unless new one provided
            refreshToken: tokenResponse.refresh_token || refreshToken,
            error: null,
          });
        } catch (error) {
          // Refresh failed, logout user
          get().logout();
          throw error;
        }
      },

      // Clear error
      clearError: () => set({ error: null }),

      // Utility: Check if user has specific permission
      hasPermission: (permission: string) => {
        const { user } = get();
        if (!user) return false;
        
        // System admin has all permissions
        if (user.permissions.includes('*')) return true;
        
        return user.permissions.includes(permission);
      },

      // Utility: Check if user has specific role
      hasRole: (role: UserRole) => {
        const { user } = get();
        return user?.role === role;
      },

      // Utility: Check if user has management role
      isManagementRole: () => {
        const { user } = get();
        if (!user) return false;
        
        const managementRoles: UserRole[] = [
          'electrical_lead',
          'fco_lead', 
          'project_manager',
          'foreman',
          'general_foreman',
          'superintendent'
        ];
        
        return managementRoles.includes(user.role);
      },

      // Utility: Check if user has execution role
      isExecutionRole: () => {
        const { user } = get();
        if (!user) return false;
        
        const executionRoles: UserRole[] = [
          'electrician',
          'fco_technician'
        ];
        
        return executionRoles.includes(user.role);
      },
    }),
    {
      name: 'electrical-orchestrator-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);