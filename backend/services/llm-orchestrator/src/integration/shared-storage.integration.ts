import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * LLM Orchestrator integration with SharedStorageService
 * Provides cross-service access to file processor session data
 */
export class LLMOrchestratorStorageIntegration {
  private readonly baseSessionPath: string;
  private readonly logger: any; // Using any to avoid logger type issues

  constructor(logger?: any) {
    this.baseSessionPath = process.env.STORAGE_BASE 
      ? path.join(process.env.STORAGE_BASE, 'sessions')
      : './backend/storage/sessions';
    
    this.logger = logger || console;
    
    this.logger.info('LLM orchestrator shared storage integration initialized', {
      baseSessionPath: this.baseSessionPath
    });
  }

  /**
   * Access converted images from file processor session
   * Implements cross-service file access with performance monitoring
   */
  async accessConvertedImages(sessionId: string, documentId?: string): Promise<string[]> {
    const startTime = Date.now();
    
    try {
      // Validate session ID format (UUID)
      this.validateSessionId(sessionId);

      const sessionPath = path.join(this.baseSessionPath, sessionId);
      const convertedImagesDir = path.join(sessionPath, 'converted_images');

      // Check if converted images directory exists
      try {
        await fs.access(convertedImagesDir);
      } catch (error) {
        throw new Error(`Converted images directory not found for session ${sessionId}`);
      }

      // List all image files
      const files = await fs.readdir(convertedImagesDir, { withFileTypes: true });
      const imageFiles = files
        .filter(dirent => dirent.isFile())
        .filter(dirent => this.isImageFile(dirent.name))
        .map(dirent => path.join(convertedImagesDir, dirent.name));

      const duration = Date.now() - startTime;
      
      // Check performance requirement (<100ms)
      if (duration > 100) {
        this.logger.warn('Cross-service file access exceeded performance threshold', {
          sessionId,
          documentId,
          duration,
          threshold: 100,
          imageCount: imageFiles.length
        });
      } else {
        this.logger.debug('Cross-service file access completed successfully', {
          sessionId,
          documentId,
          duration,
          imageCount: imageFiles.length
        });
      }

      return imageFiles;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to access converted images', {
        sessionId,
        documentId,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Access a specific image file from session
   */
  async accessImageFile(sessionId: string, filename: string): Promise<Buffer> {
    const startTime = Date.now();
    
    try {
      this.validateSessionId(sessionId);
      this.validateFileName(filename);

      const sessionPath = path.join(this.baseSessionPath, sessionId);
      const imagePath = path.join(sessionPath, 'converted_images', filename);
      
      // Security: Ensure the resolved path is within the session directory
      if (!imagePath.startsWith(sessionPath)) {
        throw new Error(`Path traversal detected: ${filename}`);
      }

      // Check if file exists
      try {
        await fs.access(imagePath);
      } catch (error) {
        throw new Error(`Image file not found: ${filename}`);
      }

      // Read and return file buffer
      const imageBuffer = await fs.readFile(imagePath);
      
      const duration = Date.now() - startTime;
      
      // Performance monitoring
      if (duration > 100) {
        this.logger.warn('Image file access exceeded performance threshold', {
          sessionId,
          filename,
          duration,
          threshold: 100,
          size: imageBuffer.length
        });
      }

      return imageBuffer;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Failed to access image file', {
        sessionId,
        filename,
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get conversion metadata for a document
   */
  async getConversionMetadata(sessionId: string, documentId: string): Promise<any> {
    try {
      this.validateSessionId(sessionId);

      const metadataFile = path.join(
        this.baseSessionPath, 
        sessionId, 
        'metadata', 
        `${documentId}.json`
      );

      try {
        const content = await fs.readFile(metadataFile, 'utf-8');
        const metadata = JSON.parse(content);
        
        this.logger.debug('Retrieved conversion metadata', {
          sessionId,
          documentId,
          imageCount: metadata.imageCount
        });

        return metadata;
      } catch (error) {
        throw new Error(`Conversion metadata not found for document ${documentId}`);
      }
    } catch (error) {
      this.logger.error('Failed to get conversion metadata', {
        sessionId,
        documentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Check if session has converted images available
   */
  async hasConvertedImages(sessionId: string): Promise<boolean> {
    try {
      this.validateSessionId(sessionId);

      const sessionPath = path.join(this.baseSessionPath, sessionId);
      const convertedImagesDir = path.join(sessionPath, 'converted_images');
      
      // Check if directory exists and has files
      try {
        const files = await fs.readdir(convertedImagesDir);
        const imageFiles = files.filter(file => this.isImageFile(file));
        return imageFiles.length > 0;
      } catch (error) {
        return false;
      }
    } catch (error) {
      this.logger.warn('Failed to check for converted images', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get shared access manifest from session
   */
  async getAccessManifest(sessionId: string): Promise<any | null> {
    try {
      this.validateSessionId(sessionId);

      const manifestPath = path.join(
        this.baseSessionPath, 
        sessionId, 
        '.shared-access.json'
      );

      try {
        const content = await fs.readFile(manifestPath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        // Manifest might not exist - this is optional
        return null;
      }
    } catch (error) {
      this.logger.warn('Failed to get access manifest', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * List available sessions that have converted images
   */
  async listAvailableSessions(): Promise<string[]> {
    try {
      const sessions = await fs.readdir(this.baseSessionPath, { withFileTypes: true });
      const availableSessions: string[] = [];

      for (const session of sessions) {
        if (session.isDirectory() && this.isValidSessionId(session.name)) {
          const hasImages = await this.hasConvertedImages(session.name);
          if (hasImages) {
            availableSessions.push(session.name);
          }
        }
      }

      this.logger.debug('Listed available sessions', {
        totalSessions: sessions.length,
        availableSessions: availableSessions.length
      });

      return availableSessions;
    } catch (error) {
      this.logger.error('Failed to list available sessions', {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Validate session access permissions
   * Implements service-level permission checking
   */
  async validateSessionAccess(sessionId: string): Promise<boolean> {
    try {
      this.validateSessionId(sessionId);

      // Check if session directory exists
      const sessionPath = path.join(this.baseSessionPath, sessionId);
      await fs.access(sessionPath);

      // Check if manifest allows llm-orchestrator access
      const manifest = await this.getAccessManifest(sessionId);
      if (manifest && manifest.availableServices) {
        return manifest.availableServices.includes('llm-orchestrator');
      }

      // Fallback: check if converted images exist (basic permission check)
      return await this.hasConvertedImages(sessionId);
    } catch (error) {
      this.logger.warn('Session access validation failed', {
        sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Health check for shared storage integration
   */
  async healthCheck(): Promise<{ status: string; details: Record<string, any> }> {
    try {
      // Check if base session path exists
      await fs.access(this.baseSessionPath);
      
      // Check available sessions
      const availableSessions = await this.listAvailableSessions();

      return {
        status: 'healthy',
        details: {
          baseSessionPath: this.baseSessionPath,
          canAccess: true,
          availableSessions: availableSessions.length,
          integrationVersion: '1.0',
          service: 'llm-orchestrator'
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          baseSessionPath: this.baseSessionPath,
          service: 'llm-orchestrator',
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }

  // Private validation methods
  private validateSessionId(sessionId: string): void {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Session ID must be a non-empty string');
    }

    if (!this.isValidSessionId(sessionId)) {
      throw new Error(`Invalid session ID format: ${sessionId}`);
    }
  }

  private isValidSessionId(sessionId: string): boolean {
    // UUID validation pattern
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidPattern.test(sessionId);
  }

  private validateFileName(filename: string): void {
    if (!filename || typeof filename !== 'string') {
      throw new Error('Filename must be a non-empty string');
    }

    // Prevent path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new Error(`Invalid filename: ${filename}`);
    }
  }

  private isImageFile(filename: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff'];
    const ext = path.extname(filename).toLowerCase();
    return imageExtensions.includes(ext);
  }

  /**
   * Get base session path
   */
  getBaseSessionPath(): string {
    return this.baseSessionPath;
  }
}

// Export singleton instance for use in LLM orchestrator service
export const llmOrchestratorStorageIntegration = new LLMOrchestratorStorageIntegration();