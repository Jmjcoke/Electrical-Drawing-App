import { useState, useCallback, useRef } from 'react';
import { uploadMultipleFiles } from '../services/api';
import { 
  validateSingleFile, 
  validateMultipleFiles, 
  formatValidationErrors,
  getSuggestions,
  type ValidationResult 
} from '../utils/fileValidation';
import type { 
  UploadResponse, 
  MultiFileUploadProgress, 
  UploadErrorCodes 
} from '../types/api';

interface FileWithId {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  validation?: ValidationResult;
  warnings?: string[];
}

interface UseMultiFileUploadState {
  files: FileWithId[];
  isUploading: boolean;
  progress: MultiFileUploadProgress | null;
  response: UploadResponse | null;
  error: string | null;
  warnings: string[];
  suggestions: string[];
}

interface UseMultiFileUploadOptions {
  maxFiles?: number;
  maxFileSize?: number;
  maxTotalSize?: number;
  allowedTypes?: string[];
  onUploadSuccess?: (response: UploadResponse) => void;
  onUploadError?: (error: string) => void;
  onProgressUpdate?: (progress: MultiFileUploadProgress) => void;
}

export const useMultiFileUpload = (options: UseMultiFileUploadOptions = {}) => {
  const {
    maxFiles = 3,
    maxFileSize = 10 * 1024 * 1024, // 10MB
    maxTotalSize = 30 * 1024 * 1024, // 30MB
    allowedTypes = ['application/pdf'],
    onUploadSuccess,
    onUploadError,
    onProgressUpdate
  } = options;

  const [state, setState] = useState<UseMultiFileUploadState>({
    files: [],
    isUploading: false,
    progress: null,
    response: null,
    error: null,
    warnings: [],
    suggestions: []
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const performEnhancedValidation = useCallback(async (files: File[]): Promise<{
    isValid: boolean;
    error: string | null;
    warnings: string[];
    suggestions: string[];
    filesWithValidation: { file: File; validation: ValidationResult }[];
  }> => {
    try {
      // Validate multiple files
      const multiValidation = await validateMultipleFiles(files, {
        maxFiles,
        maxFileSize,
        maxTotalSize,
        allowedTypes,
        checkMagicBytes: true,
        strictPdfValidation: true
      });

      const filesWithValidation: { file: File; validation: ValidationResult }[] = [];
      
      // Individual file validations for detailed error reporting
      for (const file of files) {
        const validation = await validateSingleFile(file, {
          maxFileSize,
          allowedTypes,
          checkMagicBytes: true,
          strictPdfValidation: true
        });
        filesWithValidation.push({ file, validation });
      }

      const allWarnings = [
        ...multiValidation.warnings,
        ...filesWithValidation.flatMap(fv => fv.validation.warnings)
      ];

      const suggestions = multiValidation.isValid 
        ? [] 
        : getSuggestions(formatValidationErrors(multiValidation));

      return {
        isValid: multiValidation.isValid,
        error: multiValidation.isValid ? null : formatValidationErrors(multiValidation),
        warnings: allWarnings,
        suggestions,
        filesWithValidation
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'Validation failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
        warnings: [],
        suggestions: ['Please try again', 'Contact support if the problem persists'],
        filesWithValidation: []
      };
    }
  }, [maxFiles, maxFileSize, maxTotalSize, allowedTypes]);

  const addFiles = useCallback(async (newFiles: File[]) => {
    const allFiles = [...state.files.map(f => f.file), ...newFiles];
    
    try {
      const validation = await performEnhancedValidation(allFiles);
      
      if (!validation.isValid) {
        setState(prev => ({
          ...prev,
          error: validation.error,
          warnings: validation.warnings,
          suggestions: validation.suggestions
        }));
        onUploadError?.(validation.error || 'Validation failed');
        return false;
      }

      const filesWithId: FileWithId[] = newFiles.map((file, index) => {
        const fileValidation = validation.filesWithValidation.find(fv => fv.file === file);
        return {
          id: `${Date.now()}-${index}`,
          file,
          status: 'pending' as const,
          validation: fileValidation?.validation,
          warnings: fileValidation?.validation.warnings
        };
      });

      setState(prev => ({
        ...prev,
        files: [...prev.files, ...filesWithId],
        error: null,
        warnings: validation.warnings,
        suggestions: []
      }));

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        suggestions: ['Please try again', 'Contact support if the problem persists']
      }));
      onUploadError?.(errorMessage);
      return false;
    }
  }, [state.files, performEnhancedValidation, onUploadError]);

  const removeFile = useCallback((fileId: string) => {
    setState(prev => ({
      ...prev,
      files: prev.files.filter(f => f.id !== fileId),
      error: null
    }));
  }, []);

  const clearFiles = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      files: [],
      isUploading: false,
      progress: null,
      response: null,
      error: null,
      warnings: [],
      suggestions: []
    });
  }, []);

  const uploadFiles = useCallback(async () => {
    if (state.files.length === 0) {
      return;
    }

    try {
      const validation = await performEnhancedValidation(state.files.map(f => f.file));
      if (!validation.isValid) {
        setState(prev => ({
          ...prev,
          error: validation.error,
          warnings: validation.warnings,
          suggestions: validation.suggestions
        }));
        onUploadError?.(validation.error || 'Validation failed');
        return;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Validation failed';
      setState(prev => ({ ...prev, error: errorMessage }));
      onUploadError?.(errorMessage);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setState(prev => ({
      ...prev,
      isUploading: true,
      progress: null,
      error: null,
      files: prev.files.map(f => ({ ...f, status: 'uploading' as const }))
    }));

    try {
      const response = await uploadMultipleFiles(
        state.files.map(f => f.file),
        (progress) => {
          setState(prev => ({
            ...prev,
            progress,
            files: prev.files.map((f, index) => ({
              ...f,
              status: progress.files[index]?.status || 'uploading'
            }))
          }));
          onProgressUpdate?.(progress);
        },
        abortController.signal
      );

      setState(prev => ({
        ...prev,
        isUploading: false,
        response,
        files: prev.files.map(f => ({ ...f, status: 'completed' as const }))
      }));

      onUploadSuccess?.(response);
    } catch (error) {
      if (abortController.signal.aborted) {
        setState(prev => ({
          ...prev,
          isUploading: false,
          progress: null,
          error: 'Upload cancelled',
          files: prev.files.map(f => ({ ...f, status: 'pending' as const }))
        }));
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed';
        setState(prev => ({
          ...prev,
          isUploading: false,
          progress: null,
          error: errorMessage,
          files: prev.files.map(f => ({ ...f, status: 'error' as const, error: errorMessage }))
        }));
        onUploadError?.(errorMessage);
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, [state.files, performEnhancedValidation, onUploadSuccess, onUploadError, onProgressUpdate]);

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const getTotalSize = useCallback(() => {
    return state.files.reduce((sum, f) => sum + f.file.size, 0);
  }, [state.files]);

  const getFileCount = useCallback(() => {
    return state.files.length;
  }, [state.files]);

  const canAddMoreFiles = useCallback(() => {
    return state.files.length < maxFiles;
  }, [state.files.length, maxFiles]);

  return {
    files: state.files,
    isUploading: state.isUploading,
    progress: state.progress,
    response: state.response,
    error: state.error,
    warnings: state.warnings,
    suggestions: state.suggestions,
    addFiles,
    removeFile,
    clearFiles,
    uploadFiles,
    cancelUpload,
    getTotalSize,
    getFileCount,
    canAddMoreFiles,
    maxFiles,
    maxFileSize,
    maxTotalSize
  };
};