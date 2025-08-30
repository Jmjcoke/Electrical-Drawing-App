import * as fs from 'fs/promises';
import * as path from 'path';
import { SharedStorageService, createSharedStorageService } from '../shared-storage.service';
import { 
  SessionPathConfig, 
  SharedStorageServiceError, 
  SHARED_STORAGE_ERRORS 
} from '../../types/shared-storage.types';

// Mock fs/promises
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('SharedStorageService', () => {
  let service: SharedStorageService;
  let mockConfig: SessionPathConfig;
  let mockLogger: jest.Mocked<Console>;

  const validSessionId = '123e4567-e89b-12d3-a456-426614174000';
  const validService = 'llm-orchestrator';
  const baseSessionPath = '/app/storage/sessions';

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger = {
      log: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfig = {
      baseSessionPath,
      serviceMap: {
        'file-processor': {
          name: 'file-processor',
          permissions: {
            canRead: true,
            canWrite: true,
            allowedSubPaths: ['*'],
          },
        },
        'llm-orchestrator': {
          name: 'llm-orchestrator',
          permissions: {
            canRead: true,
            canWrite: false,
            allowedSubPaths: ['converted_images', 'metadata'],
          },
        },
      },
    };

    service = new SharedStorageService(mockConfig, mockLogger);
  });

  describe('constructor', () => {
    it('should create service with valid config', () => {
      expect(service).toBeInstanceOf(SharedStorageService);
    });

    it('should throw error for missing baseSessionPath', () => {
      const invalidConfig = { ...mockConfig, baseSessionPath: '' };
      expect(() => new SharedStorageService(invalidConfig)).toThrow('BaseSessionPath is required');
    });

    it('should throw error for empty serviceMap', () => {
      const invalidConfig = { ...mockConfig, serviceMap: {} };
      expect(() => new SharedStorageService(invalidConfig)).toThrow('ServiceMap is required');
    });
  });

  describe('getSessionPath', () => {
    it('should return valid session path for authorized service', async () => {
      mockFs.access.mockResolvedValue(undefined);
      
      const result = await service.getSessionPath(validSessionId, validService);
      
      expect(result).toBe(path.join(baseSessionPath, validSessionId));
      expect(mockFs.access).toHaveBeenCalledWith(result);
    });

    it('should throw error for invalid session ID', async () => {
      await expect(service.getSessionPath('invalid-id', validService))
        .rejects.toThrow(SharedStorageServiceError);
    });

    it('should throw error for unauthorized service', async () => {
      await expect(service.getSessionPath(validSessionId, 'unauthorized-service'))
        .rejects.toThrow(SharedStorageServiceError);
    });

    it('should throw error for non-existent session', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));
      
      await expect(service.getSessionPath(validSessionId, validService))
        .rejects.toThrow(SharedStorageServiceError);
    });

    it('should validate session ID UUID format', async () => {
      const invalidUuid = 'not-a-uuid';
      
      await expect(service.getSessionPath(invalidUuid, validService))
        .rejects.toThrow('Invalid session ID format');
    });
  });

  describe('accessFile', () => {
    const testFilePath = 'converted_images/test.jpg';
    const mockFileBuffer = Buffer.from('test file content');

    beforeEach(() => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(mockFileBuffer);
    });

    it('should return file buffer for valid request', async () => {
      const result = await service.accessFile(validSessionId, testFilePath, validService);
      
      expect(result).toBe(mockFileBuffer);
      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.join(baseSessionPath, validSessionId, testFilePath)
      );
    });

    it('should throw error for path traversal attempt', async () => {
      const maliciousPath = '../../../etc/passwd';
      
      await expect(service.accessFile(validSessionId, maliciousPath, validService))
        .rejects.toThrow('Path traversal attempt detected');
    });

    it('should throw error for non-existent file', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFs.readFile.mockRejectedValue(error);
      
      await expect(service.accessFile(validSessionId, testFilePath, validService))
        .rejects.toThrow('File not found');
    });

    it('should validate file path for dangerous characters', async () => {
      const dangerousPath = 'test\0file.jpg';
      
      await expect(service.accessFile(validSessionId, dangerousPath, validService))
        .rejects.toThrow('Invalid filepath');
    });

    it('should handle general file access errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));
      
      await expect(service.accessFile(validSessionId, testFilePath, validService))
        .rejects.toThrow('File access error');
    });
  });

  describe('checkPermissions', () => {
    it('should return true for authorized service', async () => {
      const result = await service.checkPermissions(validSessionId, validService);
      expect(result).toBe(true);
    });

    it('should throw error for unauthorized service', async () => {
      await expect(service.checkPermissions(validSessionId, 'unknown-service'))
        .rejects.toThrow('Service not registered');
    });

    it('should throw error for service without read permissions', async () => {
      const noReadConfig = {
        ...mockConfig,
        serviceMap: {
          ...mockConfig.serviceMap,
          'test-service': {
            name: 'test-service',
            permissions: {
              canRead: false,
              canWrite: false,
              allowedSubPaths: [],
            },
          },
        },
      };
      
      const restrictedService = new SharedStorageService(noReadConfig, mockLogger);
      
      await expect(restrictedService.checkPermissions(validSessionId, 'test-service'))
        .rejects.toThrow('does not have read permissions');
    });

    it('should validate session patterns when configured', async () => {
      const patternConfig = {
        ...mockConfig,
        serviceMap: {
          ...mockConfig.serviceMap,
          'pattern-service': {
            name: 'pattern-service',
            permissions: {
              canRead: true,
              canWrite: false,
              allowedSubPaths: ['*'],
            },
            allowedSessionPatterns: ['^123.*'],
          },
        },
      };
      
      const patternService = new SharedStorageService(patternConfig, mockLogger);
      
      // Should succeed for matching pattern
      await expect(patternService.checkPermissions(validSessionId, 'pattern-service'))
        .resolves.toBe(true);
      
      // Should fail for non-matching pattern
      const nonMatchingSessionId = '456e7890-e89b-12d3-a456-426614174000';
      await expect(patternService.checkPermissions(nonMatchingSessionId, 'pattern-service'))
        .rejects.toThrow('not authorized for session pattern');
    });
  });

  describe('listFiles', () => {
    const mockDirents = [
      { name: 'file1.jpg', isFile: () => true },
      { name: 'file2.png', isFile: () => true },
      { name: 'subdir', isFile: () => false },
    ] as any[];

    beforeEach(() => {
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValue(mockDirents);
    });

    it('should return list of files in session directory', async () => {
      const result = await service.listFiles(validSessionId, '', validService);
      
      expect(result).toEqual(['file1.jpg', 'file2.png']);
      expect(mockFs.readdir).toHaveBeenCalledWith(
        path.join(baseSessionPath, validSessionId),
        { withFileTypes: true }
      );
    });

    it('should return files from subdirectory', async () => {
      const result = await service.listFiles(validSessionId, 'converted_images', validService);
      
      expect(result).toEqual(['converted_images/file1.jpg', 'converted_images/file2.png']);
      expect(mockFs.readdir).toHaveBeenCalledWith(
        path.join(baseSessionPath, validSessionId, 'converted_images'),
        { withFileTypes: true }
      );
    });

    it('should return empty array for non-existent directory', async () => {
      const error = new Error('Directory not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockFs.readdir.mockRejectedValue(error);
      
      const result = await service.listFiles(validSessionId, 'nonexistent', validService);
      
      expect(result).toEqual([]);
    });

    it('should prevent path traversal in subPath', async () => {
      await expect(service.listFiles(validSessionId, '../../../etc', validService))
        .rejects.toThrow('Invalid subpath');
    });
  });

  describe('fileExists', () => {
    const testFilePath = 'converted_images/test.jpg';

    it('should return true for existing file', async () => {
      mockFs.access.mockResolvedValueOnce(undefined); // Session path check
      mockFs.access.mockResolvedValueOnce(undefined); // File existence check
      
      const result = await service.fileExists(validSessionId, testFilePath, validService);
      
      expect(result).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      mockFs.access.mockResolvedValueOnce(undefined); // Session path check
      mockFs.access.mockRejectedValueOnce(new Error('ENOENT')); // File doesn't exist
      
      const result = await service.fileExists(validSessionId, testFilePath, validService);
      
      expect(result).toBe(false);
    });

    it('should return false for path traversal attempts', async () => {
      const result = await service.fileExists(validSessionId, '../../../etc/passwd', validService);
      
      expect(result).toBe(false);
    });

    it('should handle permission errors gracefully', async () => {
      await expect(service.fileExists(validSessionId, testFilePath, 'unauthorized-service'))
        .rejects.toThrow(SharedStorageServiceError);
    });
  });

  describe('performance logging', () => {
    it('should log performance warnings for slow operations', async () => {
      // Mock a slow operation
      mockFs.access.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 150))
      );
      
      await service.getSessionPath(validSessionId, validService);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('exceeded performance threshold'),
        expect.objectContaining({
          operation: 'getSessionPath',
          threshold: 100,
        })
      );
    });

    it('should log debug info for fast operations', async () => {
      mockFs.access.mockResolvedValue(undefined);
      
      await service.getSessionPath(validSessionId, validService);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('completed in'),
        expect.objectContaining({
          operation: 'getSessionPath',
        })
      );
    });
  });

  describe('createSharedStorageService factory', () => {
    it('should create service with default configuration', () => {
      const factoryService = createSharedStorageService('/test/path');
      
      expect(factoryService).toBeInstanceOf(SharedStorageService);
    });

    it('should accept custom logger', () => {
      const customLogger = console;
      const factoryService = createSharedStorageService('/test/path', customLogger);
      
      expect(factoryService).toBeInstanceOf(SharedStorageService);
    });
  });

  describe('error handling', () => {
    it('should create proper SharedStorageServiceError instances', () => {
      const error = new SharedStorageServiceError(
        SHARED_STORAGE_ERRORS.FILE_NOT_FOUND,
        'Test error',
        validSessionId,
        validService,
        'test.jpg'
      );
      
      expect(error.name).toBe('SharedStorageServiceError');
      expect(error.code).toBe(SHARED_STORAGE_ERRORS.FILE_NOT_FOUND);
      expect(error.sessionId).toBe(validSessionId);
      expect(error.service).toBe(validService);
      expect(error.filepath).toBe('test.jpg');
      
      const json = error.toJSON();
      expect(json.code).toBe(SHARED_STORAGE_ERRORS.FILE_NOT_FOUND);
      expect(json.timestamp).toBeDefined();
    });

    it('should log errors appropriately', async () => {
      mockFs.access.mockRejectedValue(new Error('Test error'));
      
      await expect(service.getSessionPath(validSessionId, validService))
        .rejects.toThrow();
      
      expect(mockLogger.error).toHaveBeenCalledWith(
        'SharedStorageService.getSessionPath error:',
        expect.objectContaining({
          operation: 'getSessionPath',
          error: expect.any(String),
          sessionId: validSessionId,
          service: validService,
        })
      );
    });
  });
});