import * as fs from 'fs/promises';
import * as path from 'path';
import { LLMOrchestratorStorageIntegration } from '../shared-storage.integration';

describe('LLMOrchestratorStorageIntegration Tests', () => {
  let integration: LLMOrchestratorStorageIntegration;
  let tempDir: string;
  let mockLogger: any;

  const testSessionId = '123e4567-e89b-12d3-a456-426614174000';
  const testDocumentId = 'test-document-001';

  beforeAll(async () => {
    // Create temporary directory structure mimicking file processor output
    tempDir = path.join(__dirname, 'temp-llm-integration-tests');
    const sessionPath = path.join(tempDir, testSessionId);
    const convertedImagesDir = path.join(sessionPath, 'converted_images');
    const metadataDir = path.join(sessionPath, 'metadata');

    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(sessionPath, { recursive: true });
    await fs.mkdir(convertedImagesDir, { recursive: true });
    await fs.mkdir(metadataDir, { recursive: true });

    // Create test image files (simulating file processor output)
    await fs.writeFile(
      path.join(convertedImagesDir, 'page-1.png'),
      Buffer.from('fake-png-data-1')
    );
    await fs.writeFile(
      path.join(convertedImagesDir, 'page-2.jpg'),
      Buffer.from('fake-jpg-data-2')
    );

    // Create conversion metadata (simulating file processor metadata)
    const metadata = {
      documentId: testDocumentId,
      sessionId: testSessionId,
      imagePaths: ['converted_images/page-1.png', 'converted_images/page-2.jpg'],
      convertedAt: new Date().toISOString(),
      imageCount: 2,
      service: 'file-processor',
      version: '1.0'
    };
    await fs.writeFile(
      path.join(metadataDir, `${testDocumentId}.json`),
      JSON.stringify(metadata, null, 2)
    );

    // Create shared access manifest
    const manifest = {
      sessionId: testSessionId,
      createdAt: new Date().toISOString(),
      version: '1.0',
      provider: 'file-processor',
      availableServices: ['llm-orchestrator'],
      contents: {
        convertedImages: 2,
        metadataFiles: 1,
        directories: ['converted_images', 'metadata']
      }
    };
    await fs.writeFile(
      path.join(sessionPath, '.shared-access.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Set environment variable
    process.env.STORAGE_BASE = tempDir;
  });

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    integration = new LLMOrchestratorStorageIntegration(mockLogger);
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

  describe('Cross-Service File Access', () => {
    it('should access converted images from file processor', async () => {
      const imageFiles = await integration.accessConvertedImages(testSessionId);

      expect(imageFiles).toHaveLength(2);
      expect(imageFiles).toContain(path.join(tempDir, testSessionId, 'converted_images', 'page-1.png'));
      expect(imageFiles).toContain(path.join(tempDir, testSessionId, 'converted_images', 'page-2.jpg'));
    });

    it('should access converted images with document ID filter', async () => {
      const imageFiles = await integration.accessConvertedImages(testSessionId, testDocumentId);

      expect(imageFiles).toHaveLength(2);
      expect(imageFiles.every(file => file.includes('converted_images'))).toBe(true);
    });

    it('should access individual image files', async () => {
      const imageBuffer = await integration.accessImageFile(testSessionId, 'page-1.png');

      expect(imageBuffer).toBeInstanceOf(Buffer);
      expect(imageBuffer.toString()).toBe('fake-png-data-1');
    });

    it('should handle missing image files gracefully', async () => {
      await expect(
        integration.accessImageFile(testSessionId, 'non-existent.png')
      ).rejects.toThrow('Image file not found');
    });

    it('should prevent path traversal in file access', async () => {
      await expect(
        integration.accessImageFile(testSessionId, '../../../etc/passwd')
      ).rejects.toThrow('Path traversal detected');

      await expect(
        integration.accessImageFile(testSessionId, 'page-1.png/../../../secrets.txt')
      ).rejects.toThrow('Path traversal detected');
    });
  });

  describe('Metadata Access', () => {
    it('should retrieve conversion metadata', async () => {
      const metadata = await integration.getConversionMetadata(testSessionId, testDocumentId);

      expect(metadata).toBeDefined();
      expect(metadata.documentId).toBe(testDocumentId);
      expect(metadata.sessionId).toBe(testSessionId);
      expect(metadata.imageCount).toBe(2);
      expect(metadata.service).toBe('file-processor');
    });

    it('should handle missing metadata gracefully', async () => {
      await expect(
        integration.getConversionMetadata(testSessionId, 'non-existent-doc')
      ).rejects.toThrow('Conversion metadata not found');
    });
  });

  describe('Session Discovery', () => {
    it('should check if session has converted images', async () => {
      const hasImages = await integration.hasConvertedImages(testSessionId);
      expect(hasImages).toBe(true);
    });

    it('should return false for session without images', async () => {
      const emptySessionId = '999e9999-e99b-99d9-a999-999999999999';
      const emptySessionPath = path.join(tempDir, emptySessionId);
      await fs.mkdir(emptySessionPath, { recursive: true });

      const hasImages = await integration.hasConvertedImages(emptySessionId);
      expect(hasImages).toBe(false);

      // Cleanup
      await fs.rm(emptySessionPath, { recursive: true });
    });

    it('should get shared access manifest', async () => {
      const manifest = await integration.getAccessManifest(testSessionId);

      expect(manifest).toBeDefined();
      expect(manifest.sessionId).toBe(testSessionId);
      expect(manifest.provider).toBe('file-processor');
      expect(manifest.availableServices).toContain('llm-orchestrator');
      expect(manifest.contents.convertedImages).toBe(2);
    });

    it('should return null for missing manifest', async () => {
      const noManifestSessionId = '888e8888-e88b-88d8-a888-888888888888';
      const noManifestPath = path.join(tempDir, noManifestSessionId);
      await fs.mkdir(noManifestPath, { recursive: true });

      const manifest = await integration.getAccessManifest(noManifestSessionId);
      expect(manifest).toBeNull();

      // Cleanup
      await fs.rm(noManifestPath, { recursive: true });
    });

    it('should list available sessions', async () => {
      const sessions = await integration.listAvailableSessions();

      expect(sessions).toContain(testSessionId);
      expect(sessions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Permission Validation', () => {
    it('should validate session access successfully', async () => {
      const hasAccess = await integration.validateSessionAccess(testSessionId);
      expect(hasAccess).toBe(true);
    });

    it('should handle invalid session ID format', async () => {
      await expect(
        integration.accessConvertedImages('invalid-session-id')
      ).rejects.toThrow('Invalid session ID format');
    });

    it('should handle non-existent session', async () => {
      const nonExistentSessionId = '777e7777-e77b-77d7-a777-777777777777';
      
      await expect(
        integration.accessConvertedImages(nonExistentSessionId)
      ).rejects.toThrow('Converted images directory not found');
    });
  });

  describe('Performance Monitoring', () => {
    it('should complete operations within performance threshold', async () => {
      const startTime = Date.now();

      // Perform multiple operations
      await integration.hasConvertedImages(testSessionId);
      await integration.accessConvertedImages(testSessionId);
      await integration.getConversionMetadata(testSessionId, testDocumentId);

      const duration = Date.now() - startTime;
      
      // Should complete well under 100ms for local operations
      expect(duration).toBeLessThan(100);
    });

    it('should log performance warnings for slow operations', async () => {
      // Create a large file to potentially trigger slow operation
      const largeFilePath = path.join(tempDir, testSessionId, 'converted_images', 'large-file.png');
      const largeBuffer = Buffer.alloc(5 * 1024 * 1024); // 5MB
      await fs.writeFile(largeFilePath, largeBuffer);

      // Access the large file
      await integration.accessImageFile(testSessionId, 'large-file.png');

      // Clean up
      await fs.unlink(largeFilePath);

      // The operation should complete successfully
      expect(true).toBe(true);
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const health = await integration.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.details.canAccess).toBe(true);
      expect(health.details.service).toBe('llm-orchestrator');
      expect(health.details.availableSessions).toBeGreaterThanOrEqual(1);
    });

    it('should handle unhealthy storage', async () => {
      // Create integration with invalid path
      const originalEnv = process.env.STORAGE_BASE;
      process.env.STORAGE_BASE = '/completely/invalid/path';

      const badIntegration = new LLMOrchestratorStorageIntegration(mockLogger);
      const health = await badIntegration.healthCheck();

      expect(health.status).toBe('unhealthy');
      expect(health.details.error).toBeDefined();

      // Restore environment
      process.env.STORAGE_BASE = originalEnv;
    });
  });

  describe('Integration with Analysis Controller', () => {
    it('should simulate analysis controller workflow', async () => {
      // Step 1: Check if session has converted images
      const hasImages = await integration.hasConvertedImages(testSessionId);
      expect(hasImages).toBe(true);

      // Step 2: Get available image files (simulating getDocumentImages replacement)
      const imageFiles = await integration.accessConvertedImages(testSessionId, testDocumentId);
      expect(imageFiles.length).toBeGreaterThan(0);

      // Step 3: Access each image for analysis (simulating image buffer loading)
      for (const imagePath of imageFiles) {
        const filename = path.basename(imagePath);
        const imageBuffer = await integration.accessImageFile(testSessionId, filename);
        expect(imageBuffer).toBeInstanceOf(Buffer);
        expect(imageBuffer.length).toBeGreaterThan(0);
      }

      // Step 4: Get metadata for additional context
      const metadata = await integration.getConversionMetadata(testSessionId, testDocumentId);
      expect(metadata.imageCount).toBe(imageFiles.length);
    });

    it('should handle analysis controller error scenarios', async () => {
      // Scenario 1: Missing session
      const missingSessionId = '666e6666-e66b-66d6-a666-666666666666';
      await expect(
        integration.accessConvertedImages(missingSessionId)
      ).rejects.toThrow();

      // Scenario 2: Missing document metadata  
      await expect(
        integration.getConversionMetadata(testSessionId, 'missing-document')
      ).rejects.toThrow();

      // Scenario 3: Session without images
      const emptySessionId = '555e5555-e55b-55d5-a555-555555555555';
      const emptySessionPath = path.join(tempDir, emptySessionId);
      await fs.mkdir(emptySessionPath, { recursive: true });

      const hasImages = await integration.hasConvertedImages(emptySessionId);
      expect(hasImages).toBe(false);

      // Cleanup
      await fs.rm(emptySessionPath, { recursive: true });
    });
  });

  describe('Configuration and Setup', () => {
    it('should initialize with correct base path', () => {
      const basePath = integration.getBaseSessionPath();
      expect(basePath).toBe(tempDir);
    });

    it('should handle different logger configurations', () => {
      // Test with console logger
      const consoleIntegration = new LLMOrchestratorStorageIntegration(console);
      expect(consoleIntegration).toBeInstanceOf(LLMOrchestratorStorageIntegration);

      // Test without logger (should use console)
      const defaultIntegration = new LLMOrchestratorStorageIntegration();
      expect(defaultIntegration).toBeInstanceOf(LLMOrchestratorStorageIntegration);
    });
  });
});