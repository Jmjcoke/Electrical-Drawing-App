import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { User } from '../types/api';

export interface UserState {
  currentUser: User | null;
  users: User[];
  isLoading: boolean;
  error: string | null;
}

export interface UserActions {
  setCurrentUser: (user: User | null) => void;
  fetchUsers: () => Promise<void>;
  fetchCurrentUser: () => Promise<void>;
  updateProfile: (userData: Partial<User>) => Promise<User>;
  setError: (error: string | null) => void;
  clearError: () => void;
}

const initialState: UserState = {
  currentUser: null,
  users: [],
  isLoading: false,
  error: null,
};

export const useUserStore = create<UserState & UserActions>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        ...initialState,

        setCurrentUser: (user: User | null) => {
          set((state) => {
            state.currentUser = user;
          });
        },

        fetchUsers: async () => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await fetch('/api/gateway/users', {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json',
              },
            });

            if (!response.ok) {
              throw new Error(`Failed to fetch users: ${response.statusText}`);
            }

            const users = await response.json();

            set((state) => {
              state.users = users;
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Failed to fetch users';
              state.isLoading = false;
            });
          }
        },

        fetchCurrentUser: async () => {
          const token = localStorage.getItem('access_token');
          if (!token) {
            set((state) => {
              state.currentUser = null;
            });
            return;
          }

          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await fetch('/api/gateway/auth/me', {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            });

            if (!response.ok) {
              if (response.status === 401) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                set((state) => {
                  state.currentUser = null;
                });
                return;
              }
              throw new Error(`Failed to fetch current user: ${response.statusText}`);
            }

            const user = await response.json();

            set((state) => {
              state.currentUser = user;
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Failed to fetch current user';
              state.isLoading = false;
            });
          }
        },

        updateProfile: async (userData: Partial<User>) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await fetch('/api/gateway/auth/profile', {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(userData),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.detail || `Failed to update profile: ${response.statusText}`);
            }

            const updatedUser = await response.json();

            set((state) => {
              state.currentUser = updatedUser;
              state.isLoading = false;
            });

            return updatedUser;
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Failed to update profile';
              state.isLoading = false;
            });
            throw error;
          }
        },

        setError: (error: string | null) => {
          set((state) => {
            state.error = error;
          });
        },

        clearError: () => {
          set((state) => {
            state.error = null;
          });
        },
      }))
    ),
    {
      name: 'user-store',
    }
  )
);