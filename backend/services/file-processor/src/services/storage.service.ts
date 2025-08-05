import fs from 'fs/promises';
import path from 'path';
import * as promClient from 'prom-client';
import Bull from 'bull';
import Redis from 'ioredis';
import { logger } from '../utils/logger.js';
import { CleanupJob } from '../types/api.types.js';

export interface StoredFile {
  fileId: string;
  path: string;
  originalName: string;
  size: number;
  storedAt: string;
  expiresAt: string;
}

export interface ConvertedImages {
  documentId: string;
  sessionId: string;
  imagePaths: string[];
  storedAt: Date;
  expiresAt: Date;
  totalSize: number;
}

// Metrics for storage monitoring
const storageUsageGauge = new promClient.Gauge({
  name: 'storage_usage_bytes',
  help: 'Current storage usage in bytes',
  labelNames: ['type'] // 'uploads', 'converted', 'cache'
});

const cleanupJobsCounter = new promClient.Counter({
  name: 'storage_cleanup_jobs_total',
  help: 'Total number of cleanup jobs executed',
  labelNames: ['status', 'type'] // status: success/error, type: scheduled/manual
});

const filesRemovedCounter = new promClient.Counter({
  name: 'storage_files_removed_total', 
  help: 'Total number of files removed by cleanup',
  labelNames: ['type'] // 'expired', 'orphaned', 'manual'
});

class StorageService {
  private readonly UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
  private readonly STORAGE_BASE = process.env.STORAGE_BASE || './backend/storage';
  private readonly TEMP_FILE_EXPIRY_HOURS = 24; // Files expire after 24 hours
  private readonly DISK_SPACE_ALERT_THRESHOLD = 0.8; // Alert when 80% full
  
  private storedFiles = new Map<string, StoredFile>(); // In-memory storage for demo
  private convertedImages = new Map<string, ConvertedImages>();
  private cleanupQueue: Bull.Queue;
  private redis: Redis;
  private cleanupInterval?: NodeJS.Timeout;
  private cleanupTimeout?: NodeJS.Timeout;

  constructor(redisUrl: string = 'redis://localhost:6379') {
    this.redis = new Redis(redisUrl);
    this.cleanupQueue = new Bull('storage cleanup', redisUrl);
    this.setupCleanupJobs();
    this.ensureDirectories();
    this.startCleanupScheduler();
    this.startStorageMonitoring();
  }

  private async ensureDirectories(): Promise<void> {
    const directories = [
      this.UPLOAD_DIR,
      path.join(this.STORAGE_BASE, 'sessions'),
      path.join(this.STORAGE_BASE, 'temp'),
      path.join(this.STORAGE_BASE, 'logs')
    ];

    for (const dir of directories) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    }
  }

  /**
   * Setup Bull queue jobs for scheduled cleanup
   */
  private setupCleanupJobs(): void {
    // Hourly cleanup job
    this.cleanupQueue.add('hourly-cleanup', {}, {
      repeat: { cron: '0 * * * *' }, // Every hour
      removeOnComplete: 10,
      removeOnFail: 5
    });

    // Daily cleanup job
    this.cleanupQueue.add('daily-cleanup', {}, {
      repeat: { cron: '0 2 * * *' }, // 2 AM daily
      removeOnComplete: 5,
      removeOnFail: 2
    });

    // Weekly deep cleanup
    this.cleanupQueue.add('weekly-cleanup', {}, {
      repeat: { cron: '0 3 * * 0' }, // 3 AM Sunday
      removeOnComplete: 2,
      removeOnFail: 1
    });

    // Process cleanup jobs
    this.cleanupQueue.process('hourly-cleanup', this.processHourlyCleanup.bind(this));
    this.cleanupQueue.process('daily-cleanup', this.processDailyCleanup.bind(this));
    this.cleanupQueue.process('weekly-cleanup', this.processWeeklyCleanup.bind(this));
  }

  /**
   * Start monitoring storage usage
   */
  private startStorageMonitoring(): void {
    setInterval(async () => {
      await this.updateStorageMetrics();
      await this.checkDiskSpace();
    }, 60000); // Every minute
  }

  /**
   * Store converted images with metadata
   */
  async storeConvertedImages(
    documentId: string,
    sessionId: string,
    imagePaths: string[]
  ): Promise<ConvertedImages> {
    try {
      let totalSize = 0;
      for (const imagePath of imagePaths) {
        const stats = await fs.stat(imagePath);
        totalSize += stats.size;
      }

      const convertedImages: ConvertedImages = {
        documentId,
        sessionId,
        imagePaths,
        storedAt: new Date(),
        expiresAt: new Date(Date.now() + this.TEMP_FILE_EXPIRY_HOURS * 60 * 60 * 1000),
        totalSize
      };

      this.convertedImages.set(documentId, convertedImages);
      
      logger.info('Stored converted images', {
        documentId,
        sessionId,
        imageCount: imagePaths.length,
        totalSize
      });

      return convertedImages;
    } catch (error) {
      logger.error('Failed to store converted images', { documentId, sessionId, error });
      throw new Error('Failed to store converted images metadata');
    }
  }

  /**
   * Get converted images for a document
   */
  async getConvertedImages(documentId: string): Promise<ConvertedImages | null> {
    return this.convertedImages.get(documentId) || null;
  }

  /**
   * Update storage usage metrics
   */
  private async updateStorageMetrics(): Promise<void> {
    try {
      const uploadsSize = await this.getDirectorySize(this.UPLOAD_DIR);
      const convertedSize = await this.getDirectorySize(path.join(this.STORAGE_BASE, 'sessions'));
      
      storageUsageGauge.labels('uploads').set(uploadsSize);
      storageUsageGauge.labels('converted').set(convertedSize);
    } catch (error) {
      logger.warn('Failed to update storage metrics', { error });
    }
  }

  /**
   * Get total size of directory
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      for (const file of files) {
        const filePath = path.join(dirPath, file.name);
        if (file.isDirectory()) {
          totalSize += await this.getDirectorySize(filePath);
        } else {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
    }
    return totalSize;
  }

  /**
   * Check disk space and alert if threshold exceeded
   */
  private async checkDiskSpace(): Promise<void> {
    try {
      const stats = await fs.statfs(this.STORAGE_BASE);
      const usedPercent = (stats.bavail / stats.blocks);
      
      if (usedPercent > this.DISK_SPACE_ALERT_THRESHOLD) {
        logger.warn('Disk space threshold exceeded', {
          usedPercent: Math.round(usedPercent * 100),
          threshold: Math.round(this.DISK_SPACE_ALERT_THRESHOLD * 100)
        });
      }
    } catch (error) {
      logger.warn('Failed to check disk space', { error });
    }
  }

  /**
   * Process hourly cleanup job
   */
  private async processHourlyCleanup(): Promise<void> {
    const startTime = Date.now();
    let filesRemoved = 0;
    
    try {
      // Clean expired files
      filesRemoved += await this.cleanupExpiredFiles();
      
      cleanupJobsCounter.labels('success', 'scheduled').inc();
      logger.info('Hourly cleanup completed', { 
        filesRemoved, 
        durationMs: Date.now() - startTime 
      });
    } catch (error) {
      cleanupJobsCounter.labels('error', 'scheduled').inc();
      logger.error('Hourly cleanup failed', { error });
    }
  }

  /**
   * Process daily cleanup job
   */
  private async processDailyCleanup(): Promise<void> {
    const startTime = Date.now();
    let filesRemoved = 0;
    
    try {
      // Clean expired files
      filesRemoved += await this.cleanupExpiredFiles();
      
      // Clean orphaned converted images
      filesRemoved += await this.cleanupOrphanedImages();
      
      // Optimize storage (compress logs, etc.)
      await this.optimizeStorage();
      
      cleanupJobsCounter.labels('success', 'scheduled').inc();
      logger.info('Daily cleanup completed', { 
        filesRemoved, 
        durationMs: Date.now() - startTime 
      });
    } catch (error) {
      cleanupJobsCounter.labels('error', 'scheduled').inc();
      logger.error('Daily cleanup failed', { error });
    }
  }

  /**
   * Process weekly deep cleanup job
   */
  private async processWeeklyCleanup(): Promise<void> {
    const startTime = Date.now();
    let filesRemoved = 0;
    
    try {
      // All daily cleanup tasks
      filesRemoved += await this.cleanupExpiredFiles();
      filesRemoved += await this.cleanupOrphanedImages();
      await this.optimizeStorage();
      
      // Deep clean: rebuild indexes, vacuum databases, etc.
      await this.deepCleanStorage();
      
      cleanupJobsCounter.labels('success', 'scheduled').inc();
      logger.info('Weekly deep cleanup completed', { 
        filesRemoved, 
        durationMs: Date.now() - startTime 
      });
    } catch (error) {
      cleanupJobsCounter.labels('error', 'scheduled').inc();
      logger.error('Weekly cleanup failed', { error });
    }
  }

  /**
   * Clean up orphaned converted images
   */
  private async cleanupOrphanedImages(): Promise<number> {
    let removedCount = 0;
    const sessionsDir = path.join(this.STORAGE_BASE, 'sessions');
    
    try {
      const sessionDirs = await fs.readdir(sessionsDir, { withFileTypes: true });
      
      for (const sessionDir of sessionDirs) {
        if (sessionDir.isDirectory()) {
          const convertedDir = path.join(sessionsDir, sessionDir.name, 'converted');
          
          try {
            const documentDirs = await fs.readdir(convertedDir, { withFileTypes: true });
            
            for (const documentDir of documentDirs) {
              if (documentDir.isDirectory()) {
                const documentPath = path.join(convertedDir, documentDir.name);
                const metadata = this.convertedImages.get(documentDir.name);
                
                // Remove if expired or no metadata
                if (!metadata || new Date() > metadata.expiresAt) {
                  await fs.rm(documentPath, { recursive: true, force: true });
                  this.convertedImages.delete(documentDir.name);
                  removedCount++;
                  filesRemovedCounter.labels('orphaned').inc();
                }
              }
            }
          } catch (error) {
            // Converted directory might not exist
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to cleanup orphaned images', { error });
    }
    
    return removedCount;
  }

  /**
   * Optimize storage by compressing old logs
   */
  private async optimizeStorage(): Promise<void> {
    // This would compress old log files, optimize database indexes, etc.
    logger.info('Storage optimization completed');
  }

  /**
   * Deep clean storage - rebuild indexes, vacuum databases
   */
  private async deepCleanStorage(): Promise<void> {
    // This would perform database maintenance, rebuild search indexes, etc.
    logger.info('Deep storage cleanup completed');
  }

  /**
   * Clean up all files for a specific session
   */
  async cleanupSession(sessionId: string): Promise<CleanupJob> {
    const startTime = Date.now();
    const job: CleanupJob = {
      sessionId,
      documentIds: [],
      scheduledAt: new Date(),
      filesRemoved: 0,
      cacheEntriesRemoved: 0
    };

    try {
      // Remove session directory and all contents
      const sessionDir = path.join(this.STORAGE_BASE, 'sessions', sessionId);
      
      try {
        await fs.rm(sessionDir, { recursive: true, force: true });
        job.filesRemoved++;
      } catch (error) {
        // Directory might not exist
      }

      // Remove from memory maps
      for (const [documentId, convertedImages] of this.convertedImages.entries()) {
        if (convertedImages.sessionId === sessionId) {
          this.convertedImages.delete(documentId);
          job.documentIds.push(documentId);
        }
      }

      // Remove uploaded files for this session
      for (const [fileId, storedFile] of this.storedFiles.entries()) {
        if (storedFile.path.includes(sessionId)) {
          await this.deleteFile(fileId);
          job.filesRemoved++;
        }
      }

      job.completedAt = new Date();
      
      logger.info('Session cleanup completed', {
        sessionId,
        filesRemoved: job.filesRemoved,
        documentIds: job.documentIds.length,
        durationMs: Date.now() - startTime
      });

    } catch (error) {
      logger.error('Session cleanup failed', { sessionId, error });
      throw error;
    }

    return job;
  }

  async storeTemporary(file: Express.Multer.File, fileId: string): Promise<StoredFile> {
    try {
      const fileName = `${fileId}_${file.originalname}`;
      const filePath = path.join(this.UPLOAD_DIR, fileName);

      // Write file to disk
      await fs.writeFile(filePath, file.buffer);

      const storedFile: StoredFile = {
        fileId,
        path: filePath,
        originalName: file.originalname,
        size: file.size,
        storedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.TEMP_FILE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()
      };

      // Store metadata in memory (in production, this would be in a database)
      this.storedFiles.set(fileId, storedFile);

      logger.info(`File stored temporarily: ${filePath}, expires: ${storedFile.expiresAt}`);
      return storedFile;

    } catch (error) {
      logger.error(`Failed to store file ${fileId}:`, error);
      throw new Error('Failed to store file');
    }
  }

  async getFileInfo(fileId: string): Promise<StoredFile | null> {
    return this.storedFiles.get(fileId) || null;
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      const storedFile = this.storedFiles.get(fileId);
      if (storedFile) {
        await fs.unlink(storedFile.path);
        this.storedFiles.delete(fileId);
        logger.info(`Deleted file: ${storedFile.path}`);
      }
    } catch (error) {
      logger.error(`Failed to delete file ${fileId}:`, error);
    }
  }

  private startCleanupScheduler(): void {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredFiles();
    }, 60 * 60 * 1000);

    // Run initial cleanup after 1 minute
    this.cleanupTimeout = setTimeout(() => {
      this.cleanupExpiredFiles();
    }, 60 * 1000);
  }

  public stopCleanupScheduler(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    if (this.cleanupTimeout) {
      clearTimeout(this.cleanupTimeout);
      this.cleanupTimeout = undefined;
    }
  }

  private async cleanupExpiredFiles(): Promise<number> {
    const now = new Date();
    const expiredFiles: string[] = [];

    for (const [fileId, storedFile] of this.storedFiles.entries()) {
      if (new Date(storedFile.expiresAt) < now) {
        expiredFiles.push(fileId);
      }
    }

    for (const fileId of expiredFiles) {
      await this.deleteFile(fileId);
      filesRemovedCounter.labels('expired').inc();
    }

    if (expiredFiles.length > 0) {
      logger.info(`Cleaned up ${expiredFiles.length} expired files`);
    }

    return expiredFiles.length;
  }

  /**
   * Get storage health status
   */
  async getHealthStatus(): Promise<{ status: string; metrics: Record<string, number> }> {
    try {
      const uploadsSize = await this.getDirectorySize(this.UPLOAD_DIR);
      const convertedSize = await this.getDirectorySize(path.join(this.STORAGE_BASE, 'sessions'));
      
      return {
        status: 'healthy',
        metrics: {
          uploadsSize,
          convertedSize,
          activeFiles: this.storedFiles.size,
          activeConversions: this.convertedImages.size
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        metrics: { error: 1 }
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down storage service');
    
    this.stopCleanupScheduler();
    await this.cleanupQueue.close();
    await this.redis.quit();
    
    logger.info('Storage service shutdown complete');
  }
}

export const storageService = new StorageService();