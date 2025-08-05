import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FileUpload from '../FileUpload';
import type { UploadResponse } from '../../../types/api';

// Mock the API service
jest.mock('../../../services/api', () => ({
  uploadFile: jest.fn(),
  uploadMultipleFiles: jest.fn()
}));

import { uploadMultipleFiles } from '../../../services/api';

const mockUploadMultipleFiles = uploadMultipleFiles as jest.MockedFunction<typeof uploadMultipleFiles>;

// Helper function to create mock files
const createMockFile = (name: string, size: number, type: string = 'application/pdf'): File => {
  const file = new File(['mock content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('FileUpload Component', () => {
  const mockOnUploadSuccess = jest.fn();
  const mockOnUploadError = jest.fn();
  const mockOnProgressUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Multi-File Mode (Default)', () => {
    it('renders multi-file upload interface correctly', () => {
      render(
        <FileUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      expect(screen.getByText('Upload PDF Files')).toBeInTheDocument();
      expect(screen.getByText('Click here or drag and drop your PDF files')).toBeInTheDocument();
      expect(screen.getByText('Maximum 3 files, 10MB each, 30MB total')).toBeInTheDocument();
    });

    it('allows multiple file selection', async () => {
      render(
        <FileUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const fileInput = screen.getByRole('button', { hidden: true });
      const files = [
        createMockFile('file1.pdf', 1024 * 1024),
        createMockFile('file2.pdf', 2 * 1024 * 1024)
      ];

      fireEvent.change(fileInput, { target: { files } });

      await waitFor(() => {
        expect(screen.getByText('file1.pdf')).toBeInTheDocument();
        expect(screen.getByText('file2.pdf')).toBeInTheDocument();
        expect(screen.getByText('Selected Files (2/3)')).toBeInTheDocument();
      });
    });

    it('shows file count indicator and total size', async () => {
      render(
        <FileUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const fileInput = screen.getByRole('button', { hidden: true });
      const files = [
        createMockFile('file1.pdf', 2 * 1024 * 1024),
        createMockFile('file2.pdf', 3 * 1024 * 1024)
      ];

      fireEvent.change(fileInput, { target: { files } });

      await waitFor(() => {
        expect(screen.getByText('Selected Files (2/3)')).toBeInTheDocument();
        expect(screen.getByText('Total size: 5.0MB / 30MB')).toBeInTheDocument();
      });
    });

    it('allows individual file removal', async () => {
      render(
        <FileUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const fileInput = screen.getByRole('button', { hidden: true });
      const files = [
        createMockFile('file1.pdf', 1024 * 1024),
        createMockFile('file2.pdf', 2 * 1024 * 1024)
      ];

      fireEvent.change(fileInput, { target: { files } });

      await waitFor(() => {
        expect(screen.getByText('file1.pdf')).toBeInTheDocument();
        expect(screen.getByText('file2.pdf')).toBeInTheDocument();
      });

      // Find and click the first delete button
      const deleteButtons = screen.getAllByRole('button', { name: '' });
      const deleteButton = deleteButtons.find(button => 
        button.querySelector('svg[data-testid="DeleteIcon"]')
      );
      
      if (deleteButton) {
        fireEvent.click(deleteButton);
      }

      await waitFor(() => {
        expect(screen.queryByText('file1.pdf')).not.toBeInTheDocument();
        expect(screen.getByText('file2.pdf')).toBeInTheDocument();
        expect(screen.getByText('Selected Files (1/3)')).toBeInTheDocument();
      });
    });

    it('shows upload controls when files are selected', async () => {
      render(
        <FileUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const fileInput = screen.getByRole('button', { hidden: true });
      const files = [createMockFile('file1.pdf', 1024 * 1024)];

      fireEvent.change(fileInput, { target: { files } });

      await waitFor(() => {
        expect(screen.getByText('Upload 1 File')).toBeInTheDocument();
        expect(screen.getByText('Clear All')).toBeInTheDocument();
      });
    });

    it('updates upload button text based on file count', async () => {
      render(
        <FileUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const fileInput = screen.getByRole('button', { hidden: true });

      // Add one file
      fireEvent.change(fileInput, { 
        target: { files: [createMockFile('file1.pdf', 1024 * 1024)] } 
      });

      await waitFor(() => {
        expect(screen.getByText('Upload 1 File')).toBeInTheDocument();
      });

      // Add two more files
      fireEvent.change(fileInput, { 
        target: { files: [
          createMockFile('file2.pdf', 1024 * 1024),
          createMockFile('file3.pdf', 1024 * 1024)
        ] } 
      });

      await waitFor(() => {
        expect(screen.getByText('Upload 3 Files')).toBeInTheDocument();
      });
    });

    it('handles successful multi-file upload', async () => {
      const mockResponse: UploadResponse = {
        success: true,
        files: [
          {
            fileId: 'file-1',
            originalName: 'file1.pdf',
            size: 1024 * 1024,
            mimeType: 'application/pdf',
            uploadedAt: new Date().toISOString(),
            processingStatus: 'ready'
          },
          {
            fileId: 'file-2',
            originalName: 'file2.pdf',
            size: 2 * 1024 * 1024,
            mimeType: 'application/pdf',
            uploadedAt: new Date().toISOString(),
            processingStatus: 'ready'
          }
        ],
        totalSize: 3 * 1024 * 1024,
        sessionId: 'session-123'
      };

      mockUploadMultipleFiles.mockResolvedValueOnce(mockResponse);

      render(
        <FileUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const fileInput = screen.getByRole('button', { hidden: true });
      const files = [
        createMockFile('file1.pdf', 1024 * 1024),
        createMockFile('file2.pdf', 2 * 1024 * 1024)
      ];

      fireEvent.change(fileInput, { target: { files } });

      await waitFor(() => {
        expect(screen.getByText('Upload 2 Files')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Upload 2 Files'));

      await waitFor(() => {
        expect(screen.getByText('Upload Successful!')).toBeInTheDocument();
        expect(screen.getByText('2 files uploaded successfully')).toBeInTheDocument();
        expect(screen.getByText('Files are ready for analysis')).toBeInTheDocument();
      });

      expect(mockOnUploadSuccess).toHaveBeenCalledWith(mockResponse);
    });

    it('shows error for too many files', async () => {
      render(
        <FileUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
          maxFiles={2}
        />
      );

      const fileInput = screen.getByRole('button', { hidden: true });
      const files = [
        createMockFile('file1.pdf', 1024 * 1024),
        createMockFile('file2.pdf', 1024 * 1024),
        createMockFile('file3.pdf', 1024 * 1024)
      ];

      fireEvent.change(fileInput, { target: { files } });

      await waitFor(() => {
        expect(screen.getByText(/Too many files/)).toBeInTheDocument();
      });

      expect(mockOnUploadError).toHaveBeenCalledWith(expect.stringContaining('Too many files'));
    });

    it('shows error for invalid file types', async () => {
      render(
        <FileUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const fileInput = screen.getByRole('button', { hidden: true });
      const file = createMockFile('document.txt', 1024 * 1024, 'text/plain');

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/Invalid file type/)).toBeInTheDocument();
      });

      expect(mockOnUploadError).toHaveBeenCalledWith(expect.stringContaining('Invalid file type'));
    });

    it('shows error for files exceeding size limits', async () => {
      render(
        <FileUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const fileInput = screen.getByRole('button', { hidden: true });
      const largeFile = createMockFile('large.pdf', 15 * 1024 * 1024); // 15MB

      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(screen.getByText(/File size must be under/)).toBeInTheDocument();
      });

      expect(mockOnUploadError).toHaveBeenCalledWith(expect.stringContaining('File size must be under'));
    });

    it('shows error for total size exceeding limit', async () => {
      render(
        <FileUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const fileInput = screen.getByRole('button', { hidden: true });
      const files = [
        createMockFile('file1.pdf', 15 * 1024 * 1024),
        createMockFile('file2.pdf', 20 * 1024 * 1024) // Total 35MB > 30MB limit
      ];

      fireEvent.change(fileInput, { target: { files } });

      await waitFor(() => {
        expect(screen.getByText(/Total file size must be under/)).toBeInTheDocument();
      });

      expect(mockOnUploadError).toHaveBeenCalledWith(expect.stringContaining('Total file size must be under'));
    });

    it('handles upload errors', async () => {
      mockUploadMultipleFiles.mockRejectedValueOnce(new Error('Upload failed'));

      render(
        <FileUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const fileInput = screen.getByRole('button', { hidden: true });
      const file = createMockFile('test.pdf', 1024 * 1024);

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText('Upload 1 File')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Upload 1 File'));

      await waitFor(() => {
        expect(screen.getByText('Upload failed')).toBeInTheDocument();
      });

      expect(mockOnUploadError).toHaveBeenCalledWith('Upload failed');
    });

    it('can clear all files', async () => {
      render(
        <FileUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const fileInput = screen.getByRole('button', { hidden: true });
      const files = [
        createMockFile('file1.pdf', 1024 * 1024),
        createMockFile('file2.pdf', 2 * 1024 * 1024)
      ];

      fireEvent.change(fileInput, { target: { files } });

      await waitFor(() => {
        expect(screen.getByText('Selected Files (2/3)')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Clear All'));

      await waitFor(() => {
        expect(screen.queryByText('Selected Files')).not.toBeInTheDocument();
        expect(screen.getByText('Upload PDF Files')).toBeInTheDocument();
      });
    });

    it('can be disabled', () => {
      render(
        <FileUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
          disabled={true}
        />
      );

      const fileInput = screen.getByRole('button', { hidden: true });
      expect(fileInput).toBeDisabled();
    });

    it('shows "add more files" state when not at max capacity', async () => {
      render(
        <FileUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const fileInput = screen.getByRole('button', { hidden: true });
      const files = [createMockFile('file1.pdf', 1024 * 1024)];

      fireEvent.change(fileInput, { target: { files } });

      await waitFor(() => {
        expect(screen.getByText('Add More Files')).toBeInTheDocument();
        expect(screen.getByText('You can add 2 more files')).toBeInTheDocument();
      });
    });

    it('shows max files reached state', async () => {
      render(
        <FileUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
        />
      );

      const fileInput = screen.getByRole('button', { hidden: true });
      const files = [
        createMockFile('file1.pdf', 1024 * 1024),
        createMockFile('file2.pdf', 1024 * 1024),
        createMockFile('file3.pdf', 1024 * 1024)
      ];

      fireEvent.change(fileInput, { target: { files } });

      await waitFor(() => {
        expect(screen.getByText('3/3 Files Selected')).toBeInTheDocument();
        expect(screen.getByText('Maximum files reached')).toBeInTheDocument();
      });
    });
  });

  describe('Single File Mode', () => {
    it('works in single file mode when multiFile is false', async () => {
      render(
        <FileUpload
          onUploadSuccess={mockOnUploadSuccess}
          onUploadError={mockOnUploadError}
          multiFile={false}
        />
      );

      const fileInput = screen.getByRole('button', { hidden: true });
      const files = [
        createMockFile('file1.pdf', 1024 * 1024),
        createMockFile('file2.pdf', 1024 * 1024) // Only first should be used
      ];

      fireEvent.change(fileInput, { target: { files } });

      await waitFor(() => {
        expect(screen.getByText('file1.pdf')).toBeInTheDocument();
        expect(screen.queryByText('file2.pdf')).not.toBeInTheDocument();
        expect(screen.getByText('Selected Files (1/3)')).toBeInTheDocument();
      });
    });
  });
});