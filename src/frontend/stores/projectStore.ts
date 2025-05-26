import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Project, ProjectCreate, ProjectUpdate, User } from '../types/api';

export interface ProjectFilters {
  status?: string;
  industry_sector?: string;
  project_type?: string;
  priority?: string;
  search?: string;
  created_by?: string;
}

export interface ProjectState {
  projects: Project[];
  selectedProject: Project | null;
  isLoading: boolean;
  error: string | null;
  filters: ProjectFilters;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProjectActions {
  fetchProjects: (filters?: ProjectFilters, page?: number, limit?: number) => Promise<void>;
  createProject: (projectData: ProjectCreate) => Promise<Project>;
  updateProject: (id: string, projectData: ProjectUpdate) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  selectProject: (project: Project | null) => void;
  addTeamMember: (projectId: string, userId: string, role: string) => Promise<void>;
  removeTeamMember: (projectId: string, userId: string) => Promise<void>;
  updateTeamMemberRole: (projectId: string, userId: string, role: string) => Promise<void>;
  setFilters: (filters: Partial<ProjectFilters>) => void;
  clearFilters: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

const initialState: ProjectState = {
  projects: [],
  selectedProject: null,
  isLoading: false,
  error: null,
  filters: {},
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  },
};

export const useProjectStore = create<ProjectState & ProjectActions>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        ...initialState,

        fetchProjects: async (filters = {}, page = 1, limit = 20) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const params = new URLSearchParams({
              page: page.toString(),
              limit: limit.toString(),
              ...filters,
            });

            const response = await fetch(`/api/gateway/projects?${params}`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json',
              },
            });

            if (!response.ok) {
              throw new Error(`Failed to fetch projects: ${response.statusText}`);
            }

            const data = await response.json();

            set((state) => {
              state.projects = data.items;
              state.pagination = {
                page: data.page,
                limit: data.limit,
                total: data.total,
                totalPages: data.total_pages,
              };
              state.filters = filters;
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Failed to fetch projects';
              state.isLoading = false;
            });
          }
        },

        createProject: async (projectData: ProjectCreate) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await fetch('/api/gateway/projects', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(projectData),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.detail || `Failed to create project: ${response.statusText}`);
            }

            const newProject = await response.json();

            set((state) => {
              state.projects.unshift(newProject);
              state.isLoading = false;
            });

            return newProject;
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Failed to create project';
              state.isLoading = false;
            });
            throw error;
          }
        },

        updateProject: async (id: string, projectData: ProjectUpdate) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await fetch(`/api/gateway/projects/${id}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(projectData),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.detail || `Failed to update project: ${response.statusText}`);
            }

            const updatedProject = await response.json();

            set((state) => {
              const index = state.projects.findIndex(p => p.id === id);
              if (index !== -1) {
                state.projects[index] = updatedProject;
              }
              if (state.selectedProject?.id === id) {
                state.selectedProject = updatedProject;
              }
              state.isLoading = false;
            });

            return updatedProject;
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Failed to update project';
              state.isLoading = false;
            });
            throw error;
          }
        },

        deleteProject: async (id: string) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await fetch(`/api/gateway/projects/${id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
              },
            });

            if (!response.ok) {
              throw new Error(`Failed to delete project: ${response.statusText}`);
            }

            set((state) => {
              state.projects = state.projects.filter(p => p.id !== id);
              if (state.selectedProject?.id === id) {
                state.selectedProject = null;
              }
              state.isLoading = false;
            });
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Failed to delete project';
              state.isLoading = false;
            });
            throw error;
          }
        },

        selectProject: (project: Project | null) => {
          set((state) => {
            state.selectedProject = project;
          });
        },

        addTeamMember: async (projectId: string, userId: string, role: string) => {
          try {
            const response = await fetch(`/api/gateway/projects/${projectId}/team`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ user_id: userId, role }),
            });

            if (!response.ok) {
              throw new Error(`Failed to add team member: ${response.statusText}`);
            }

            await get().fetchProjects(get().filters, get().pagination.page, get().pagination.limit);
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Failed to add team member';
            });
            throw error;
          }
        },

        removeTeamMember: async (projectId: string, userId: string) => {
          try {
            const response = await fetch(`/api/gateway/projects/${projectId}/team/${userId}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
              },
            });

            if (!response.ok) {
              throw new Error(`Failed to remove team member: ${response.statusText}`);
            }

            await get().fetchProjects(get().filters, get().pagination.page, get().pagination.limit);
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Failed to remove team member';
            });
            throw error;
          }
        },

        updateTeamMemberRole: async (projectId: string, userId: string, role: string) => {
          try {
            const response = await fetch(`/api/gateway/projects/${projectId}/team/${userId}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ role }),
            });

            if (!response.ok) {
              throw new Error(`Failed to update team member role: ${response.statusText}`);
            }

            await get().fetchProjects(get().filters, get().pagination.page, get().pagination.limit);
          } catch (error) {
            set((state) => {
              state.error = error instanceof Error ? error.message : 'Failed to update team member role';
            });
            throw error;
          }
        },

        setFilters: (filters: Partial<ProjectFilters>) => {
          set((state) => {
            state.filters = { ...state.filters, ...filters };
          });
        },

        clearFilters: () => {
          set((state) => {
            state.filters = {};
          });
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
      name: 'project-store',
    }
  )
);