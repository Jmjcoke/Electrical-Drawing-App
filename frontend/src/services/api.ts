import axios, { AxiosError } from 'axios';
import type { 
  UploadResponse, 
  SingleUploadResponse, 
  ErrorResponse, 
  UploadProgress, 
  MultiFileUploadProgress, 
  FileUploadProgress 
} from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds timeout for uploads
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ErrorResponse>) => {
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error.message);
    }
    throw new Error(error.message || 'An unexpected error occurred');
  }
);

export const uploadFile = async (
  file: File,
  onProgress?: (progress: UploadProgress) => void,
  signal?: AbortSignal
): Promise<SingleUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await apiClient.post<SingleUploadResponse>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress: UploadProgress = {
            loaded: progressEvent.loaded,
            total: progressEvent.total,
            percentage: Math.round((progressEvent.loaded * 100) / progressEvent.total)
          };
          onProgress(progress);
        }
      },
    });

    return response.data;
  } catch (error) {
    if (axios.isCancel(error)) {
      throw new Error('Upload cancelled');
    }
    throw error;
  }
};

export const uploadMultipleFiles = async (
  files: File[],
  onProgress?: (progress: MultiFileUploadProgress) => void,
  signal?: AbortSignal
): Promise<UploadResponse> => {
  const formData = new FormData();
  
  // Append all files to form data
  files.forEach((file, index) => {
    formData.append('files', file);
  });

  // Initialize progress tracking
  const fileProgressMap = new Map<string, FileUploadProgress>();
  files.forEach((file, index) => {
    const fileId = `file-${index}`;
    fileProgressMap.set(fileId, {
      fileId,
      fileName: file.name,
      loaded: 0,
      total: file.size,
      percentage: 0,
      status: 'pending'
    });
  });

  const updateProgress = (loaded: number, total: number) => {
    if (!onProgress) return;

    // Calculate overall progress
    const overallProgress: UploadProgress = {
      loaded,
      total,
      percentage: Math.round((loaded * 100) / total)
    };

    // Update file statuses based on overall progress
    let distributedLoaded = loaded;
    const fileProgresses: FileUploadProgress[] = [];
    
    files.forEach((file, index) => {
      const fileId = `file-${index}`;
      const existingProgress = fileProgressMap.get(fileId)!;
      
      let fileLoaded = 0;
      let status: FileUploadProgress['status'] = 'pending';
      
      if (distributedLoaded > 0) {
        fileLoaded = Math.min(distributedLoaded, file.size);
        distributedLoaded -= fileLoaded;
        status = fileLoaded === file.size ? 'completed' : 'uploading';
      }
      
      const updatedProgress: FileUploadProgress = {
        ...existingProgress,
        loaded: fileLoaded,
        percentage: Math.round((fileLoaded * 100) / file.size),
        status
      };
      
      fileProgressMap.set(fileId, updatedProgress);
      fileProgresses.push(updatedProgress);
    });

    const completedCount = fileProgresses.filter(fp => fp.status === 'completed').length;

    const multiProgress: MultiFileUploadProgress = {
      files: fileProgresses,
      overall: overallProgress,
      completedCount,
      totalCount: files.length
    };

    onProgress(multiProgress);
  };

  try {
    const response = await apiClient.post<UploadResponse>('/upload-multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          updateProgress(progressEvent.loaded, progressEvent.total);
        }
      },
    });

    return response.data;
  } catch (error) {
    if (axios.isCancel(error)) {
      throw new Error('Upload cancelled');
    }
    throw error;
  }
};

export default apiClient;