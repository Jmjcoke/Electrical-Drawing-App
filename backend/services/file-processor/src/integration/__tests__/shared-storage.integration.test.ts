import * as fs from 'fs/promises';
import * as path from 'path';
import { FileProcessorStorageIntegration } from '../shared-storage.integration';

describe('FileProcessorStorageIntegration Tests', () => {
  let integration: FileProcessorStorageIntegration;
  let tempDir: string;
  let mockLogger: any;

  const testSessionId = '123e4567-e89b-12d3-a456-426614174000';
  const testDocumentId = 'test-document-001';

  beforeAll(async () => {
    // Create temporary directory structure
    tempDir = path.join(__dirname, 'temp-fp-integration-tests');
    const sessionPath = path.join(tempDir, testSessionId);
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(sessionPath, { recursive: true });

    // Set environment variable to use temp directory
    process.env.STORAGE_BASE = tempDir;
  });

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    integration = new FileProcessorStorageIntegration();
  });

  afterAll(async () => {
    // Clean up
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
    delete process.env.STORAGE_BASE;
  });

  describe('Session Registration', () => {
    it('should register session access successfully', async () => {
      const imagePaths = [
        path.join(tempDir, testSessionId, 'converted_images', 'page-1.png'),
        path.join(tempDir, testSessionId, 'converted_images', 'page-2.png'),
      ];

      await integration.registerSessionAccess(testSessionId, testDocumentId, imagePaths);

      // Verify converted_images directory was created
      const convertedImagesDir = path.join(tempDir, testSessionId, 'converted_images');
      const stats = await fs.stat(convertedImagesDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should validate session ID format', async () => {
      const invalidSessionId = 'invalid-session-id';
      const imagePaths = ['test.png'];

      await expect(
        integration.registerSessionAccess(invalidSessionId, testDocumentId, imagePaths)
      ).rejects.toThrow('Invalid session ID format');
    });

    it('should handle non-existent session directory', async () => {
      const nonExistentSessionId = '999e9999-e99b-99d9-a999-999999999999';
      const imagePaths = ['test.png'];

      await expect(
        integration.registerSessionAccess(nonExistentSessionId, testDocumentId, imagePaths)
      ).rejects.toThrow();
    });
  });

  describe('Metadata Storage', () => {
    beforeEach(async () => {
      // Ensure session directory exists
      const sessionPath = path.join(tempDir, testSessionId);
      await fs.mkdir(sessionPath, { recursive: true });
    });

    it('should store conversion metadata correctly', async () => {
      const imagePaths = [
        path.join(tempDir, testSessionId, 'converted_images', 'page-1.png'),
        path.join(tempDir, testSessionId, 'converted_images', 'page-2.png'),
      ];
      const metadata = { totalSize: 1024, expiresAt: new Date() };

      await integration.storeConversionMetadata(
        testSessionId,
        testDocumentId,
        imagePaths,
        metadata
      );

      // Verify metadata file was created
      const metadataFile = path.join(tempDir, testSessionId, 'metadata', `${testDocumentId}.json`);
      const content = await fs.readFile(metadataFile, 'utf-8');
      const storedMetadata = JSON.parse(content);

      expect(storedMetadata.documentId).toBe(testDocumentId);
      expect(storedMetadata.sessionId).toBe(testSessionId);
      expect(storedMetadata.imageCount).toBe(2);
      expect(storedMetadata.service).toBe('file-processor');
      expect(storedMetadata.totalSize).toBe(1024);
    });

    it('should retrieve conversion metadata correctly', async () => {
      // First store metadata
      const imagePaths = ['page-1.png', 'page-2.png'];
      const originalMetadata = { totalSize: 2048 };

      await integration.storeConversionMetadata(
        testSessionId,
        testDocumentId,
        imagePaths,
        originalMetadata
      );

      // Then retrieve it
      const retrievedMetadata = await integration.getConversionMetadata(
        testSessionId,
        testDocumentId
      );

      expect(retrievedMetadata).toBeDefined();
      expect(retrievedMetadata.documentId).toBe(testDocumentId);
      expect(retrievedMetadata.totalSize).toBe(2048);
    });

    it('should return null for non-existent metadata', async () => {
      const result = await integration.getConversionMetadata(
        testSessionId,
        'non-existent-document'
      );

      expect(result).toBeNull();
    });
  });

  describe('File Listing', () => {
    beforeEach(async () => {
      // Create test structure with files
      const sessionPath = path.join(tempDir, testSessionId);
      const convertedImagesDir = path.join(sessionPath, 'converted_images');
      await fs.mkdir(convertedImagesDir, { recursive: true });

      // Create test image files
      await fs.writeFile(path.join(convertedImagesDir, 'page-1.png'), 'fake-png-data-1');
      await fs.writeFile(path.join(convertedImagesDir, 'page-2.jpg'), 'fake-jpg-data-2');
      await fs.writeFile(path.join(convertedImagesDir, 'page-3.gif'), 'fake-gif-data-3');
      await fs.writeFile(path.join(convertedImagesDir, 'readme.txt'), 'not-an-image');
    });

    it('should list converted images correctly', async () => {
      const images = await integration.listConvertedImages(testSessionId);

      expect(images).toContain('page-1.png');
      expect(images).toContain('page-2.jpg');
      expect(images).toContain('page-3.gif');
      expect(images).not.toContain('readme.txt');
      expect(images.length).toBe(3);
    });

    it('should return empty array for non-existent directory', async () => {
      const nonExistentSessionId = '999e9999-e99b-99d9-a999-999999999999';
      const images = await integration.listConvertedImages(nonExistentSessionId);

      expect(images).toEqual([]);
    });
  });

  describe('Access Validation', () => {
    it('should validate access for existing session', async () => {
      // Create session directory
      const sessionPath = path.join(tempDir, testSessionId);
      await fs.mkdir(sessionPath, { recursive: true });

      const hasAccess = await integration.validateAccess(testSessionId);
      expect(hasAccess).toBe(true);
    });

    it('should fail validation for non-existent session', async () => {
      const nonExistentSessionId = '999e9999-e99b-99d9-a999-999999999999';
      const hasAccess = await integration.validateAccess(nonExistentSessionId);

      expect(hasAccess).toBe(false);
    });
  });

  describe('Access Manifest', () => {
    beforeEach(async () => {
      // Set up session with converted images
      const sessionPath = path.join(tempDir, testSessionId);
      const convertedImagesDir = path.join(sessionPath, 'converted_images');
      const metadataDir = path.join(sessionPath, 'metadata');

      await fs.mkdir(convertedImagesDir, { recursive: true });
      await fs.mkdir(metadataDir, { recursive: true });

      // Create test files
      await fs.writeFile(path.join(convertedImagesDir, 'page-1.png'), 'data1');
      await fs.writeFile(path.join(convertedImagesDir, 'page-2.png'), 'data2');
      await fs.writeFile(path.join(metadataDir, 'doc1.json'), '{}');
      await fs.writeFile(path.join(metadataDir, 'doc2.json'), '{}');
    });

    it('should create access manifest successfully', async () => {
      await integration.createAccessManifest(testSessionId);

      // Verify manifest file was created
      const manifestPath = path.join(tempDir, testSessionId, '.shared-access.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      expect(manifest.sessionId).toBe(testSessionId);
      expect(manifest.provider).toBe('file-processor');
      expect(manifest.availableServices).toContain('llm-orchestrator');
      expect(manifest.contents.convertedImages).toBe(2);
      expect(manifest.contents.metadataFiles).toBe(2);
      expect(manifest.version).toBe('1.0');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when storage is accessible', async () => {
      const health = await integration.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details.canAccess).toBe(true);
      expect(health.details.canWrite).toBe(true);
      expect(health.details.baseSessionPath).toBe(tempDir);
    });

    it('should handle health check errors gracefully', async () => {
      // Create integration with non-existent path
      const originalEnv = process.env.STORAGE_BASE;
      process.env.STORAGE_BASE = '/non/existent/path';
      
      const badIntegration = new FileProcessorStorageIntegration();
      const health = await badIntegration.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.details.error).toBeDefined();

      // Restore environment
      process.env.STORAGE_BASE = originalEnv;
    });
  });

  describe('Integration with Storage Service', () => {
    it('should provide session directory path', async () => {
      // Create session directory
      const sessionPath = path.join(tempDir, testSessionId);
      await fs.mkdir(sessionPath, { recursive: true });

      const retrievedPath = await integration.getSessionDirectory(testSessionId);
      expect(retrievedPath).toBe(sessionPath);
    });

    it('should get base session path', () => {
      const basePath = integration.getBaseSessionPath();
      expect(basePath).toBe(tempDir);
    });
  });
});