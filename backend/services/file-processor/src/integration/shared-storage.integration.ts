import * as path from 'path';
import * as fs from 'fs/promises';
import { logger } from '../utils/logger.js';

/**
 * File Processor integration with SharedStorageService
 * Provides cross-service access registration and metadata management
 */
export class FileProcessorStorageIntegration {
  private readonly baseSessionPath: string;

  constructor() {
    this.baseSessionPath = process.env.STORAGE_BASE 
      ? path.join(process.env.STORAGE_BASE, 'sessions')
      : './backend/storage/sessions';
    
    logger.info('File processor shared storage integration initialized', {
      baseSessionPath: this.baseSessionPath
    });
  }

  /**
   * Register file processor session for cross-service access
   * Called after PDF conversion is complete
   */
  async registerSessionAccess(sessionId: string, documentId: string, imagePaths: string[]): Promise<void> {
    try {
      // Validate session ID format (UUID)
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(sessionId)) {
        throw new Error(`Invalid session ID format: ${sessionId}`);
      }

      // Ensure session directory exists
      const sessionPath = path.join(this.baseSessionPath, sessionId);
      await fs.access(sessionPath);
      
      // Create converted_images directory if it doesn't exist
      const convertedImagesDir = path.join(sessionPath, 'converted_images');
      await fs.mkdir(convertedImagesDir, { recursive: true });

      logger.info('Registered session for cross-service access', {
        sessionId,
        documentId,
        imageCount: imagePaths.length,
        convertedImagesDir
      });

    } catch (error) {
      logger.error('Failed to register session access', {
        sessionId,
        documentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Validate that file processor can access its own sessions
   * Used for health checks
   */
  async validateAccess(sessionId: string): Promise<boolean> {
    try {
      const sessionPath = path.join(this.baseSessionPath, sessionId);
      await fs.access(sessionPath);
      return true;
    } catch (error) {
      logger.warn('File processor access validation failed', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * List converted images available for cross-service access
   */
  async listConvertedImages(sessionId: string): Promise<string[]> {
    try {
      const convertedImagesDir = path.join(this.baseSessionPath, sessionId, 'converted_images');
      
      try {
        const files = await fs.readdir(convertedImagesDir, { withFileTypes: true });
        return files
          .filter(dirent => dirent.isFile())
          .map(dirent => dirent.name);
      } catch (error) {
        // Directory might not exist yet
        return [];
      }
    } catch (error) {
      logger.error('Failed to list converted images', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Store metadata about converted images for cross-service access
   * Integrates with existing storage patterns
   */
  async storeConversionMetadata(
    sessionId: string,
    documentId: string,
    imagePaths: string[],
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const sessionPath = path.join(this.baseSessionPath, sessionId);
      const metadataPath = path.join(sessionPath, 'metadata');
      
      // Ensure metadata directory exists
      await fs.mkdir(metadataPath, { recursive: true });
      
      // Store conversion metadata with relative paths for portability
      const conversionMetadata = {
        documentId,
        sessionId,
        imagePaths: imagePaths.map(imagePath => path.relative(sessionPath, imagePath)),
        convertedAt: new Date().toISOString(),
        imageCount: imagePaths.length,
        version: '1.0',
        service: 'file-processor',
        ...metadata
      };

      const metadataFile = path.join(metadataPath, `${documentId}.json`);
      await fs.writeFile(metadataFile, JSON.stringify(conversionMetadata, null, 2), 'utf-8');

      logger.info('Stored conversion metadata for cross-service access', {
        sessionId,
        documentId,
        metadataFile,
        imageCount: imagePaths.length
      });

    } catch (error) {
      logger.error('Failed to store conversion metadata', {
        sessionId,
        documentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get conversion metadata for a document
   */
  async getConversionMetadata(sessionId: string, documentId: string): Promise<any | null> {
    try {
      const metadataFile = path.join(this.baseSessionPath, sessionId, 'metadata', `${documentId}.json`);
      const content = await fs.readFile(metadataFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // File might not exist
      return null;
    }
  }

  /**
   * Get session directory path (backward compatibility method)
   */
  async getSessionDirectory(sessionId: string): Promise<string> {
    const sessionPath = path.join(this.baseSessionPath, sessionId);
    
    // Validate session exists
    await fs.access(sessionPath);
    
    return sessionPath;
  }

  /**
   * Create shared access manifest for cross-service discovery
   * This file helps other services discover available sessions and their contents
   */
  async createAccessManifest(sessionId: string): Promise<void> {
    try {
      const sessionPath = path.join(this.baseSessionPath, sessionId);
      const manifestPath = path.join(sessionPath, '.shared-access.json');
      
      // Get list of available files and metadata
      const convertedImages = await this.listConvertedImages(sessionId);
      const metadataDir = path.join(sessionPath, 'metadata');
      
      let metadataFiles: string[] = [];
      try {
        const files = await fs.readdir(metadataDir);
        metadataFiles = files.filter(file => file.endsWith('.json'));
      } catch {
        // Metadata directory might not exist
      }

      const manifest = {
        sessionId,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        version: '1.0',
        provider: 'file-processor',
        availableServices: ['llm-orchestrator'],
        contents: {
          convertedImages: convertedImages.length,
          metadataFiles: metadataFiles.length,
          directories: ['converted_images', 'metadata']
        }
      };

      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

      logger.debug('Created shared access manifest', {
        sessionId,
        convertedImages: convertedImages.length,
        metadataFiles: metadataFiles.length
      });

    } catch (error) {
      logger.warn('Failed to create access manifest', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw - this is not critical for functionality
    }
  }

  /**
   * Health check for shared storage integration
   */
  async healthCheck(): Promise<{ status: string; details: Record<string, any> }> {
    try {
      // Check if base session path exists and is accessible
      await fs.access(this.baseSessionPath);
      
      // Check if we can create a test directory
      const testDir = path.join(this.baseSessionPath, '.health-check');
      await fs.mkdir(testDir, { recursive: true });
      await fs.rmdir(testDir);

      return {
        status: 'healthy',
        details: {
          baseSessionPath: this.baseSessionPath,
          canAccess: true,
          canWrite: true,
          integrationVersion: '1.0'
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          baseSessionPath: this.baseSessionPath,
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  /**
   * Get base session path
   */
  getBaseSessionPath(): string {
    return this.baseSessionPath;
  }
}

// Export singleton instance for use in file processor service
export const fileProcessorStorageIntegration = new FileProcessorStorageIntegration();