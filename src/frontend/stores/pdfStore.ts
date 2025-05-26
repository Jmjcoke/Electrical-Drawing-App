import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface Drawing {
  id: string;
  filename: string;
  file_size: number;
  page_count: number | null;
  status: 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'FAILED';
  processing_status: string;
  created_at: string;
}

export interface ProcessingStatus {
  drawing_id: string;
  status: 'UPLOADED' | 'PROCESSING' | 'ANALYZED' | 'FAILED';
  progress_percentage: number;
  current_step: string;
  error_message?: string;
  processing_time?: number;
}

export interface ThumbnailInfo {
  url: string;
  key: string;
  size: string;
  file_size: number;
}

export interface PageThumbnails {
  small: ThumbnailInfo;
  medium: ThumbnailInfo;
  large: ThumbnailInfo;
}

export interface DrawingThumbnails {
  drawing_id: string;
  thumbnails: {
    success: boolean;
    pages: Array<{
      page_number: number;
      thumbnails: PageThumbnails;
    }>;
    thumbnail_urls: Record<string, PageThumbnails>;
    overview_thumbnail?: {
      url: string;
      key: string;
    };
  };
  navigation_data: {
    total_pages: number;
    pages: Array<{
      page_number: number;
      title?: string;
      dimensions: {
        width: number;
        height: number;
        orientation: string;
      };
    }>;
  };
}

export interface PDFState {
  drawings: Drawing[];
  selectedDrawing: Drawing | null;
  thumbnails: Record<string, DrawingThumbnails>;
  isLoading: boolean;
  error: string | null;
  uploadProgress: Record<string, number>;
}

export interface PDFActions {
  // Drawing management
  fetchProjectDrawings: (projectId: string) => Promise<{ success: boolean; data?: Drawing[]; error?: string }>;
  uploadPDF: (projectId: string, file: File) => Promise<{ success: boolean; data?: Drawing; error?: string }>;
  deleteDrawing: (drawingId: string) => Promise<{ success: boolean; error?: string }>;
  
  // Processing status
  getProcessingStatus: (drawingId: string) => Promise<{ success: boolean; data?: ProcessingStatus; error?: string }>;
  
  // Thumbnails and pages
  getDrawingThumbnails: (drawingId: string) => Promise<{ success: boolean; data?: DrawingThumbnails; error?: string }>;
  getPageThumbnail: (drawingId: string, pageNumber: number, size?: string) => Promise<{ success: boolean; data?: ThumbnailInfo; error?: string }>;
  
  // State management
  setSelectedDrawing: (drawing: Drawing | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  updateDrawingStatus: (drawingId: string, status: ProcessingStatus) => void;
}

const initialState: PDFState = {
  drawings: [],
  selectedDrawing: null,
  thumbnails: {},
  isLoading: false,
  error: null,
  uploadProgress: {},
};

export const usePDFStore = create<PDFState & PDFActions>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        ...initialState,

        fetchProjectDrawings: async (projectId: string) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await fetch(`/api/v1/projects/${projectId}/drawings`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json',
              },
            });

            if (!response.ok) {
              throw new Error(`Failed to fetch drawings: ${response.statusText}`);
            }

            const data = await response.json();

            set((state) => {
              state.drawings = data.drawings || [];
              state.isLoading = false;
            });

            return { success: true, data: data.drawings || [] };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch drawings';
            
            set((state) => {
              state.error = errorMessage;
              state.isLoading = false;
            });

            return { success: false, error: errorMessage };
          }
        },

        uploadPDF: async (projectId: string, file: File) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('project_id', projectId);

            const response = await fetch('/api/v1/pdf/upload', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
              },
              body: formData,
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.detail || `Upload failed: ${response.statusText}`);
            }

            const newDrawing = await response.json();

            set((state) => {
              state.drawings.unshift(newDrawing);
              state.isLoading = false;
            });

            return { success: true, data: newDrawing };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Upload failed';
            
            set((state) => {
              state.error = errorMessage;
              state.isLoading = false;
            });

            return { success: false, error: errorMessage };
          }
        },

        deleteDrawing: async (drawingId: string) => {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const response = await fetch(`/api/v1/pdf/drawings/${drawingId}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
              },
            });

            if (!response.ok) {
              throw new Error(`Failed to delete drawing: ${response.statusText}`);
            }

            set((state) => {
              state.drawings = state.drawings.filter(d => d.id !== drawingId);
              
              if (state.selectedDrawing?.id === drawingId) {
                state.selectedDrawing = null;
              }
              
              // Remove thumbnails from cache
              delete state.thumbnails[drawingId];
              
              state.isLoading = false;
            });

            return { success: true };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete drawing';
            
            set((state) => {
              state.error = errorMessage;
              state.isLoading = false;
            });

            return { success: false, error: errorMessage };
          }
        },

        getProcessingStatus: async (drawingId: string) => {
          try {
            const response = await fetch(`/api/v1/pdf/drawings/${drawingId}/status`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json',
              },
            });

            if (!response.ok) {
              throw new Error(`Failed to get processing status: ${response.statusText}`);
            }

            const status = await response.json();

            // Update drawing status in store
            set((state) => {
              const drawing = state.drawings.find(d => d.id === drawingId);
              if (drawing) {
                drawing.status = status.status;
                drawing.processing_status = status.current_step;
              }
            });

            return { success: true, data: status };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to get processing status';
            return { success: false, error: errorMessage };
          }
        },

        getDrawingThumbnails: async (drawingId: string) => {
          try {
            // Check cache first
            const cached = get().thumbnails[drawingId];
            if (cached) {
              return { success: true, data: cached };
            }

            const response = await fetch(`/api/v1/pdf/drawings/${drawingId}/thumbnails`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json',
              },
            });

            if (!response.ok) {
              throw new Error(`Failed to get thumbnails: ${response.statusText}`);
            }

            const thumbnailData = await response.json();

            // Cache thumbnails
            set((state) => {
              state.thumbnails[drawingId] = thumbnailData;
            });

            return { success: true, data: thumbnailData };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to get thumbnails';
            return { success: false, error: errorMessage };
          }
        },

        getPageThumbnail: async (drawingId: string, pageNumber: number, size: string = 'medium') => {
          try {
            const response = await fetch(
              `/api/v1/pdf/drawings/${drawingId}/pages/${pageNumber}/thumbnail?size=${size}`,
              {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (!response.ok) {
              throw new Error(`Failed to get page thumbnail: ${response.statusText}`);
            }

            const thumbnailData = await response.json();

            return { success: true, data: thumbnailData.thumbnail };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to get page thumbnail';
            return { success: false, error: errorMessage };
          }
        },

        setSelectedDrawing: (drawing: Drawing | null) => {
          set((state) => {
            state.selectedDrawing = drawing;
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

        updateDrawingStatus: (drawingId: string, status: ProcessingStatus) => {
          set((state) => {
            const drawing = state.drawings.find(d => d.id === drawingId);
            if (drawing) {
              drawing.status = status.status;
              drawing.processing_status = status.current_step;
            }
          });
        },
      }))
    ),
    {
      name: 'pdf-store',
    }
  )
);