import { Request, Response, NextFunction } from 'express';
import { uploadController } from '../controllers/upload.controller';

// Mock the services
jest.mock('../services/validation.service');
jest.mock('../services/storage.service');
jest.mock('../services/file.service');

import { validationService } from '../services/validation.service';
import { storageService } from '../services/storage.service';
import { fileService } from '../services/file.service';

describe('UploadController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should successfully upload a valid PDF file', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024 * 1024, // 1MB
        buffer: Buffer.from('mock pdf content'),
        destination: '',
        filename: '',
        path: '',
        stream: {} as any
      };

      mockRequest.file = mockFile;

      // Mock service responses
      (validationService.validatePDF as jest.Mock).mockResolvedValue({
        isValid: true,
        errors: []
      });

      (storageService.storeTemporary as jest.Mock).mockResolvedValue({
        fileId: 'test-file-id',
        path: '/tmp/test-file-id_test.pdf'
      });

      (fileService.processFile as jest.Mock).mockResolvedValue({
        previewUrl: 'http://localhost:3001/preview/test-file-id'
      });

      await uploadController.uploadFile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          originalName: 'test.pdf',
          size: 1024 * 1024,
          mimeType: 'application/pdf'
        })
      );
    });

    it('should return 400 when no file is uploaded', async () => {
      mockRequest.file = undefined;

      await uploadController.uploadFile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'NO_FILE_UPLOADED',
            message: 'No file was uploaded'
          })
        })
      );
    });

    it('should return 400 when file validation fails', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 1024,
        buffer: Buffer.from('not a pdf'),
        destination: '',
        filename: '',
        path: '',
        stream: {} as any
      };

      mockRequest.file = mockFile;

      (validationService.validatePDF as jest.Mock).mockResolvedValue({
        isValid: false,
        errors: ['File type text/plain is not allowed. Only PDF files are accepted.']
      });

      await uploadController.uploadFile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'INVALID_FILE',
            message: 'File type text/plain is not allowed. Only PDF files are accepted.'
          })
        })
      );
    });

    it('should call next with error when an exception occurs', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'test.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024 * 1024,
        buffer: Buffer.from('mock pdf content'),
        destination: '',
        filename: '',
        path: '',
        stream: {} as any
      };

      mockRequest.file = mockFile;

      (validationService.validatePDF as jest.Mock).mockRejectedValue(
        new Error('Validation service error')
      );

      await uploadController.uploadFile(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Validation service error'
        })
      );
    });
  });

  describe('getUploadStatus', () => {
    it('should return file info when file exists', async () => {
      mockRequest.params = { fileId: 'test-file-id' };

      const mockFileInfo = {
        fileId: 'test-file-id',
        originalName: 'test.pdf',
        size: 1024 * 1024,
        storedAt: '2025-08-02T10:00:00.000Z'
      };

      (storageService.getFileInfo as jest.Mock).mockResolvedValue(mockFileInfo);

      await uploadController.getUploadStatus(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockFileInfo);
    });

    it('should return 404 when file does not exist', async () => {
      mockRequest.params = { fileId: 'nonexistent-file-id' };

      (storageService.getFileInfo as jest.Mock).mockResolvedValue(null);

      await uploadController.getUploadStatus(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'FILE_NOT_FOUND',
            message: 'File not found'
          })
        })
      );
    });
  });
});