import { renderHook, act } from '@testing-library/react';
import { useMultiFileUpload } from '../useMultiFileUpload';
import { uploadMultipleFiles } from '../../services/api';
import type { UploadResponse, MultiFileUploadProgress } from '../../types/api';

// Mock the API service
jest.mock('../../services/api', () => ({
  uploadMultipleFiles: jest.fn()
}));

const mockUploadMultipleFiles = uploadMultipleFiles as jest.MockedFunction<typeof uploadMultipleFiles>;

// Helper function to create mock files
const createMockFile = (name: string, size: number, type: string = 'application/pdf'): File => {
  const file = new File(['mock content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('useMultiFileUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useMultiFileUpload());

      expect(result.current.files).toEqual([]);
      expect(result.current.isUploading).toBe(false);
      expect(result.current.progress).toBeNull();
      expect(result.current.response).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.getFileCount()).toBe(0);
      expect(result.current.getTotalSize()).toBe(0);
      expect(result.current.canAddMoreFiles()).toBe(true);
    });

    it('should use custom options', () => {
      const { result } = renderHook(() => useMultiFileUpload({
        maxFiles: 5,
        maxFileSize: 20 * 1024 * 1024
      }));

      expect(result.current.maxFiles).toBe(5);
      expect(result.current.maxFileSize).toBe(20 * 1024 * 1024);
    });
  });

  describe('File Management', () => {
    it('should add valid files', async () => {
      const { result } = renderHook(() => useMultiFileUpload());
      const mockFile = createMockFile('test.pdf', 5 * 1024 * 1024);

      await act(async () => {
        const success = await result.current.addFiles([mockFile]);
        expect(success).toBe(true);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].file.name).toBe('test.pdf');
      expect(result.current.files[0].status).toBe('pending');
      expect(result.current.getFileCount()).toBe(1);
      expect(result.current.getTotalSize()).toBe(5 * 1024 * 1024);
    });

    it('should reject files exceeding max count', async () => {
      const { result } = renderHook(() => useMultiFileUpload({ maxFiles: 2 }));
      const files = [
        createMockFile('file1.pdf', 1024 * 1024),
        createMockFile('file2.pdf', 1024 * 1024),
        createMockFile('file3.pdf', 1024 * 1024)
      ];

      await act(async () => {
        const success = await result.current.addFiles(files);
        expect(success).toBe(false);
      });

      expect(result.current.files).toHaveLength(0);
      expect(result.current.error).toContain('Too many files');
    });

    it('should reject files exceeding max file size', async () => {
      const { result } = renderHook(() => useMultiFileUpload());
      const largeFile = createMockFile('large.pdf', 15 * 1024 * 1024); // 15MB

      await act(async () => {
        const success = await result.current.addFiles([largeFile]);
        expect(success).toBe(false);
      });

      expect(result.current.files).toHaveLength(0);
      expect(result.current.error).toContain('File size must be under');
    });

    it('should reject files exceeding total size limit', () => {
      const { result } = renderHook(() => useMultiFileUpload());
      const files = [
        createMockFile('file1.pdf', 15 * 1024 * 1024),
        createMockFile('file2.pdf', 15 * 1024 * 1024),
        createMockFile('file3.pdf', 5 * 1024 * 1024)
      ];

      act(() => {
        const success = result.current.addFiles(files);
        expect(success).toBe(false);
      });

      expect(result.current.files).toHaveLength(0);
      expect(result.current.error).toContain('Total file size must be under');
    });

    it('should reject invalid file types', () => {
      const { result } = renderHook(() => useMultiFileUpload());
      const invalidFile = createMockFile('document.txt', 1024 * 1024, 'text/plain');

      act(() => {
        const success = result.current.addFiles([invalidFile]);
        expect(success).toBe(false);
      });

      expect(result.current.files).toHaveLength(0);
      expect(result.current.error).toContain('Invalid file type');
    });

    it('should reject very small files', () => {
      const { result } = renderHook(() => useMultiFileUpload());
      const tinyFile = createMockFile('tiny.pdf', 500); // 500 bytes

      act(() => {
        const success = result.current.addFiles([tinyFile]);
        expect(success).toBe(false);
      });

      expect(result.current.files).toHaveLength(0);
      expect(result.current.error).toContain('too small');
    });

    it('should remove files by ID', () => {
      const { result } = renderHook(() => useMultiFileUpload());
      const files = [
        createMockFile('file1.pdf', 1024 * 1024),
        createMockFile('file2.pdf', 2 * 1024 * 1024)
      ];

      act(() => {
        result.current.addFiles(files);
      });

      expect(result.current.files).toHaveLength(2);

      act(() => {
        result.current.removeFile(result.current.files[0].id);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].file.name).toBe('file2.pdf');
    });

    it('should clear all files', () => {
      const { result } = renderHook(() => useMultiFileUpload());
      const files = [
        createMockFile('file1.pdf', 1024 * 1024),
        createMockFile('file2.pdf', 2 * 1024 * 1024)
      ];

      act(() => {
        result.current.addFiles(files);
      });

      expect(result.current.files).toHaveLength(2);

      act(() => {
        result.current.clearFiles();
      });

      expect(result.current.files).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });

    it('should check if more files can be added', () => {
      const { result } = renderHook(() => useMultiFileUpload({ maxFiles: 2 }));
      
      expect(result.current.canAddMoreFiles()).toBe(true);

      act(() => {
        result.current.addFiles([createMockFile('file1.pdf', 1024 * 1024)]);
      });

      expect(result.current.canAddMoreFiles()).toBe(true);

      act(() => {
        result.current.addFiles([createMockFile('file2.pdf', 1024 * 1024)]);
      });

      expect(result.current.canAddMoreFiles()).toBe(false);
    });
  });

  describe('Upload Process', () => {
    it('should upload files successfully', async () => {
      const mockResponse: UploadResponse = {
        success: true,
        files: [
          {
            fileId: 'file-1',
            originalName: 'test.pdf',
            size: 1024 * 1024,
            mimeType: 'application/pdf',
            uploadedAt: new Date().toISOString(),
            processingStatus: 'ready'
          }
        ],
        totalSize: 1024 * 1024,
        sessionId: 'session-123'
      };

      mockUploadMultipleFiles.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useMultiFileUpload());
      const mockFile = createMockFile('test.pdf', 1024 * 1024);

      act(() => {
        result.current.addFiles([mockFile]);
      });

      await act(async () => {
        await result.current.uploadFiles();
      });

      expect(result.current.isUploading).toBe(false);
      expect(result.current.response).toEqual(mockResponse);
      expect(result.current.files[0].status).toBe('completed');
      expect(mockUploadMultipleFiles).toHaveBeenCalledWith(
        [mockFile],
        expect.any(Function),
        expect.any(AbortSignal)
      );
    });

    it('should handle upload errors', async () => {
      const error = new Error('Upload failed');
      mockUploadMultipleFiles.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useMultiFileUpload());
      const mockFile = createMockFile('test.pdf', 1024 * 1024);

      act(() => {
        result.current.addFiles([mockFile]);
      });

      await act(async () => {
        await result.current.uploadFiles();
      });

      expect(result.current.isUploading).toBe(false);
      expect(result.current.error).toBe('Upload failed');
      expect(result.current.files[0].status).toBe('error');
    });

    it('should handle upload cancellation', async () => {
      // Create a promise that we can control
      let rejectUpload: ((reason?: any) => void) | undefined;
      const uploadPromise = new Promise<UploadResponse>((_, reject) => {
        rejectUpload = reject;
      });

      mockUploadMultipleFiles.mockReturnValueOnce(uploadPromise);

      const { result } = renderHook(() => useMultiFileUpload());
      const mockFile = createMockFile('test.pdf', 1024 * 1024);

      act(() => {
        result.current.addFiles([mockFile]);
      });

      // Start upload
      act(() => {
        result.current.uploadFiles();
      });

      expect(result.current.isUploading).toBe(true);

      // Cancel upload
      act(() => {
        result.current.cancelUpload();
      });

      // Simulate abort signal
      const abortError = new Error('Upload cancelled');
      abortError.name = 'AbortError';
      rejectUpload?.(abortError);

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0)); // Wait for state updates
      });

      expect(result.current.isUploading).toBe(false);
      expect(result.current.error).toBe('Upload cancelled');
    });

    it('should not upload when no files are selected', async () => {
      const { result } = renderHook(() => useMultiFileUpload());

      await act(async () => {
        await result.current.uploadFiles();
      });

      expect(mockUploadMultipleFiles).not.toHaveBeenCalled();
    });

    it('should call progress callback during upload', async () => {
      const onProgressUpdate = jest.fn();
      const mockResponse: UploadResponse = {
        success: true,
        files: [],
        totalSize: 0,
        sessionId: 'session-123'
      };

      mockUploadMultipleFiles.mockImplementationOnce(
        (files, onProgress) => {
          // Simulate progress callback
          if (onProgress) {
            const progress: MultiFileUploadProgress = {
              files: [{
                fileId: 'file-1',
                fileName: 'test.pdf',
                loaded: 512 * 1024,
                total: 1024 * 1024,
                percentage: 50,
                status: 'uploading'
              }],
              overall: {
                loaded: 512 * 1024,
                total: 1024 * 1024,
                percentage: 50
              },
              completedCount: 0,
              totalCount: 1
            };
            onProgress(progress);
          }
          return Promise.resolve(mockResponse);
        }
      );

      const { result } = renderHook(() => useMultiFileUpload({ onProgressUpdate }));
      const mockFile = createMockFile('test.pdf', 1024 * 1024);

      act(() => {
        result.current.addFiles([mockFile]);
      });

      await act(async () => {
        await result.current.uploadFiles();
      });

      expect(onProgressUpdate).toHaveBeenCalled();
    });
  });

  describe('Callbacks', () => {
    it('should call onUploadSuccess callback', async () => {
      const onUploadSuccess = jest.fn();
      const mockResponse: UploadResponse = {
        success: true,
        files: [],
        totalSize: 0,
        sessionId: 'session-123'
      };

      mockUploadMultipleFiles.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useMultiFileUpload({ onUploadSuccess }));
      const mockFile = createMockFile('test.pdf', 1024 * 1024);

      act(() => {
        result.current.addFiles([mockFile]);
      });

      await act(async () => {
        await result.current.uploadFiles();
      });

      expect(onUploadSuccess).toHaveBeenCalledWith(mockResponse);
    });

    it('should call onUploadError callback', async () => {
      const onUploadError = jest.fn();
      const error = new Error('Upload failed');

      mockUploadMultipleFiles.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useMultiFileUpload({ onUploadError }));
      const mockFile = createMockFile('test.pdf', 1024 * 1024);

      act(() => {
        result.current.addFiles([mockFile]);
      });

      await act(async () => {
        await result.current.uploadFiles();
      });

      expect(onUploadError).toHaveBeenCalledWith('Upload failed');
    });

    it('should call onUploadError for validation errors', () => {
      const onUploadError = jest.fn();
      const { result } = renderHook(() => useMultiFileUpload({ onUploadError }));
      const invalidFile = createMockFile('test.txt', 1024 * 1024, 'text/plain');

      act(() => {
        result.current.addFiles([invalidFile]);
      });

      expect(onUploadError).toHaveBeenCalledWith(expect.stringContaining('Invalid file type'));
    });
  });
});