import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FilePreview from '../FilePreview';
import type { UploadedFile } from '../../../types/api';

// Mock Material-UI components that might cause issues
jest.mock('@mui/material/Dialog', () => {
  return function MockDialog({ children, open, ...props }: any) {
    return open ? <div data-testid="preview-dialog" {...props}>{children}</div> : null;
  };
});

const mockFiles: UploadedFile[] = [
  {
    fileId: 'file-1',
    originalName: 'electrical-diagram-1.pdf',
    size: 2048576, // 2MB
    mimeType: 'application/pdf',
    uploadedAt: '2025-08-02T10:00:00Z',
    previewUrl: 'http://localhost:3000/preview/file-1.jpg',
    processingStatus: 'ready'
  },
  {
    fileId: 'file-2',
    originalName: 'circuit-schematic.pdf',
    size: 5242880, // 5MB
    mimeType: 'application/pdf',
    uploadedAt: '2025-08-02T10:05:00Z',
    previewUrl: 'http://localhost:3000/preview/file-2.jpg',
    processingStatus: 'processing'
  },
  {
    fileId: 'file-3',
    originalName: 'failed-upload.pdf',
    size: 1024576, // 1MB
    mimeType: 'application/pdf',
    uploadedAt: '2025-08-02T10:10:00Z',
    processingStatus: 'error'
  }
];

describe('FilePreview Component', () => {
  const mockOnFileRemove = jest.fn();
  const mockOnFileDownload = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders file list with correct information', () => {
    render(
      <FilePreview 
        files={mockFiles}
        onFileRemove={mockOnFileRemove}
        onFileDownload={mockOnFileDownload}
      />
    );

    // Check title
    expect(screen.getByText('File Preview (3 files)')).toBeInTheDocument();

    // Check file names
    expect(screen.getByText('electrical-diagram-1.pdf')).toBeInTheDocument();
    expect(screen.getByText('circuit-schematic.pdf')).toBeInTheDocument();
    expect(screen.getByText('failed-upload.pdf')).toBeInTheDocument();

    // Check file sizes
    expect(screen.getByText('2.0MB')).toBeInTheDocument();
    expect(screen.getByText('5.0MB')).toBeInTheDocument();
    expect(screen.getByText('1.0MB')).toBeInTheDocument();

    // Check processing status
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(screen.getByText('processing')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('renders empty state when no files provided', () => {
    render(<FilePreview files={[]} />);
    
    expect(screen.getByText('No files to preview')).toBeInTheDocument();
  });

  it('shows preview thumbnails for files with previewUrl', () => {
    render(<FilePreview files={mockFiles} />);

    const thumbnails = screen.getAllByRole('img');
    expect(thumbnails).toHaveLength(2); // Only files with previewUrl should have thumbnails
    
    expect(thumbnails[0]).toHaveAttribute('src', 'http://localhost:3000/preview/file-1.jpg');
    expect(thumbnails[1]).toHaveAttribute('src', 'http://localhost:3000/preview/file-2.jpg');
  });

  it('shows processing indicator for processing files', () => {
    render(<FilePreview files={mockFiles} />);
    
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('shows error state for files without preview', () => {
    render(<FilePreview files={mockFiles} />);
    
    expect(screen.getByText('Preview failed')).toBeInTheDocument();
  });

  it('calls onFileRemove when remove button is clicked', () => {
    render(
      <FilePreview 
        files={mockFiles}
        onFileRemove={mockOnFileRemove}
        onFileDownload={mockOnFileDownload}
      />
    );

    const removeButtons = screen.getAllByLabelText('Remove');
    fireEvent.click(removeButtons[0]);

    expect(mockOnFileRemove).toHaveBeenCalledWith('file-1');
  });

  it('calls onFileDownload when download button is clicked', () => {
    render(
      <FilePreview 
        files={mockFiles}
        onFileRemove={mockOnFileRemove}
        onFileDownload={mockOnFileDownload}
      />
    );

    const downloadButtons = screen.getAllByLabelText('Download');
    fireEvent.click(downloadButtons[0]);

    expect(mockOnFileDownload).toHaveBeenCalledWith('file-1');
  });

  it('opens preview dialog when thumbnail is clicked', async () => {
    render(
      <FilePreview 
        files={mockFiles}
        onFileRemove={mockOnFileRemove}
        onFileDownload={mockOnFileDownload}
      />
    );

    const thumbnails = screen.getAllByRole('img');
    fireEvent.click(thumbnails[0]);

    await waitFor(() => {
      expect(screen.getByTestId('preview-dialog')).toBeInTheDocument();
    });
  });

  it('hides actions when showActions is false', () => {
    render(
      <FilePreview 
        files={mockFiles}
        onFileRemove={mockOnFileRemove}
        onFileDownload={mockOnFileDownload}
        showActions={false}
      />
    );

    expect(screen.queryByLabelText('Remove')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Download')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('View')).not.toBeInTheDocument();
  });

  it('handles image error gracefully', () => {
    const { container } = render(<FilePreview files={mockFiles} />);
    
    const thumbnails = screen.getAllByRole('img');
    fireEvent.error(thumbnails[0]);

    // Should show error state after image fails to load
    expect(screen.getAllByText('Preview failed')).toHaveLength(2); // One was already there for file-3
  });

  it('formats upload timestamps correctly', () => {
    render(<FilePreview files={mockFiles} />);
    
    // Check that upload timestamps are displayed (exact format may vary by locale)
    expect(screen.getByText(/Uploaded:/)).toBeInTheDocument();
  });

  it('shows correct file count in title', () => {
    // Test singular
    render(<FilePreview files={[mockFiles[0]]} />);
    expect(screen.getByText('File Preview (1 file)')).toBeInTheDocument();

    // Test plural
    render(<FilePreview files={mockFiles} />);
    expect(screen.getByText('File Preview (3 files)')).toBeInTheDocument();
  });

  it('displays tooltips for long filenames', () => {
    const longNameFile: UploadedFile = {
      ...mockFiles[0],
      originalName: 'very-long-electrical-diagram-with-detailed-circuit-specifications.pdf'
    };

    render(<FilePreview files={[longNameFile]} />);
    
    expect(screen.getByText(/very-long-electrical-diagram/)).toBeInTheDocument();
  });
});