import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import { logger } from '../utils/logger.js';
import { PdfService } from './pdf.service.js';
import { storageService } from './storage.service.js';
import { webSocketService } from './websocket.service.js';
import { documentDatabase, DatabaseDocument } from '../utils/conversion.js';
import { ConversionResult, ConversionProgress } from '../types/api.types.js';

export interface ProcessedFileInfo {
  path: string;
  previewUrl?: string;
  imagePaths?: string[];
  conversionResult?: ConversionResult;
  metadata: {
    pages?: number;
    size: number;
    processedAt: string;
    conversionDurationMs?: number;
    imageDimensions?: Array<{
      page: number;
      width: number;
      height: number;
      dpi: number;
    }>;
  };
}

class FileService {
  private pdfService: PdfService;

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const baseStoragePath = process.env.STORAGE_BASE || './backend/storage';
    this.pdfService = new PdfService(redisUrl, baseStoragePath);
  }

  async processFile(
    filePath: string, 
    originalFile: Express.Multer.File,
    sessionId: string,
    documentId: string,
    progressCallback?: (progress: ConversionProgress) => void
  ): Promise<ProcessedFileInfo> {
    try {
      logger.info(`Processing file: ${filePath}`, { sessionId, documentId });

      // Extract basic metadata
      const stats = await fs.stat(filePath);
      const pdfBuffer = await fs.readFile(filePath);
      const checksum = createHash('sha256').update(pdfBuffer).digest('hex');
      
      // Create initial database record
      const document: DatabaseDocument = {
        id: documentId,
        sessionId,
        filename: `${documentId}_${originalFile.originalname}`,
        originalFilename: originalFile.originalname,
        fileSize: stats.size,
        contentType: originalFile.mimetype,
        uploadTimestamp: new Date(),
        processingStatus: 'uploaded',
        filePath,
        checksum
      };

      await documentDatabase.upsertDocument(document);
      
      const fileInfo: ProcessedFileInfo = {
        path: filePath,
        metadata: {
          size: stats.size,
          processedAt: new Date().toISOString()
        }
      };

      // If it's a PDF, perform conversion to images
      if (originalFile.mimetype === 'application/pdf') {
        logger.info('Starting PDF to image conversion', { documentId, sessionId });
        
        // Update status to processing
        await documentDatabase.updateProcessingStatus(documentId, 'processing');
        
        // Create progress callback that broadcasts to WebSocket
        const webSocketProgressCallback = (progress: ConversionProgress) => {
          // Broadcast to WebSocket clients
          webSocketService.broadcastConversionProgress(sessionId, progress);
          
          // Call original callback if provided
          if (progressCallback) {
            progressCallback(progress);
          }
        };

        // Convert PDF to images with progress tracking
        const conversionResult = await this.pdfService.convertPdfToImages(
          documentId,
          sessionId,
          pdfBuffer,
          originalFile.originalname,
          { dpi: 300, format: 'png', quality: 95 },
          webSocketProgressCallback
        );

        if (conversionResult.success) {
          // Store converted images metadata
          await storageService.storeConvertedImages(
            documentId,
            sessionId,
            conversionResult.imagePaths
          );

          // Update database with conversion results
          await documentDatabase.updateProcessingStatus(documentId, 'ready', conversionResult);

          // Update file info with conversion results
          fileInfo.imagePaths = conversionResult.imagePaths;
          fileInfo.conversionResult = conversionResult;
          fileInfo.metadata.pages = conversionResult.imagePaths.length;
          fileInfo.metadata.conversionDurationMs = conversionResult.metadata.conversionDurationMs;
          fileInfo.metadata.imageDimensions = conversionResult.metadata.imageDimensions;

          // Broadcast conversion completion via WebSocket
          webSocketService.broadcastConversionComplete(sessionId, {
            documentId,
            imagePaths: conversionResult.imagePaths,
            success: true,
            durationMs: conversionResult.metadata.conversionDurationMs,
            pageCount: conversionResult.imagePaths.length
          });

          logger.info('PDF conversion completed successfully', {
            documentId,
            sessionId,
            pages: conversionResult.imagePaths.length,
            durationMs: conversionResult.metadata.conversionDurationMs
          });
        } else {
          // Update database with error status
          await documentDatabase.updateProcessingStatus(documentId, 'error', conversionResult);
          
          // Broadcast conversion error via WebSocket
          webSocketService.broadcastConversionError(sessionId, {
            documentId,
            error: conversionResult.error || 'PDF conversion failed',
            retryable: true
          });
          
          logger.error('PDF conversion failed', {
            documentId,
            sessionId,
            error: conversionResult.error
          });
          
          // Still return file info but mark conversion as failed
          fileInfo.conversionResult = conversionResult;
        }
      } else {
        // For non-PDF files, mark as ready
        await documentDatabase.updateProcessingStatus(documentId, 'ready');
      }

      logger.info(`File processing completed: ${filePath}`, { sessionId, documentId });
      return fileInfo;

    } catch (error) {
      logger.error(`File processing failed for ${filePath}:`, error, { sessionId, documentId });
      
      // Update database with error status
      try {
        await documentDatabase.updateProcessingStatus(documentId, 'error');
      } catch (dbError) {
        logger.error('Failed to update error status in database', { documentId, dbError });
      }
      
      throw new Error('File processing failed');
    }
  }

  /**
   * Get converted images for a document
   */
  async getConvertedImages(documentId: string): Promise<string[]> {
    try {
      const document = await documentDatabase.getDocument(documentId);
      return document?.imagePaths || [];
    } catch (error) {
      logger.error('Failed to get converted images', { documentId, error });
      return [];
    }
  }

  /**
   * Get processing status for a document
   */
  async getProcessingStatus(documentId: string): Promise<{
    status: 'uploaded' | 'processing' | 'ready' | 'error';
    progress?: number;
    imagePaths?: string[];
    error?: string;
    metadata?: {
      pages?: number;
      conversionDurationMs?: number;
      fileSize?: number;
    };
  }> {
    try {
      const document = await documentDatabase.getDocument(documentId);
      
      if (!document) {
        return {
          status: 'error',
          error: 'Document not found'
        };
      }
      
      const progress = document.processingStatus === 'ready' ? 100 :
                      document.processingStatus === 'processing' ? 50 :
                      document.processingStatus === 'uploaded' ? 10 : 0;

      return {
        status: document.processingStatus,
        progress,
        imagePaths: document.imagePaths,
        metadata: {
          pages: document.pageCount,
          conversionDurationMs: document.processingMetadata?.conversionDurationMs,
          fileSize: document.fileSize
        }
      };
    } catch (error) {
      logger.error('Failed to get processing status', { documentId, error });
      return {
        status: 'error',
        error: 'Failed to get processing status'
      };
    }
  }

  /**
   * Get documents for a session
   */
  async getSessionDocuments(sessionId: string): Promise<DatabaseDocument[]> {
    try {
      return await documentDatabase.getDocumentsBySession(sessionId);
    } catch (error) {
      logger.error('Failed to get session documents', { sessionId, error });
      return [];
    }
  }

  /**
   * Get conversion metrics
   */
  async getConversionMetrics(): Promise<{
    totalDocuments: number;
    processingDocuments: number;
    readyDocuments: number;
    errorDocuments: number;
    averageConversionTime: number;
  }> {
    try {
      return await documentDatabase.getConversionMetrics();
    } catch (error) {
      logger.error('Failed to get conversion metrics', { error });
      return {
        totalDocuments: 0,
        processingDocuments: 0,
        readyDocuments: 0,
        errorDocuments: 0,
        averageConversionTime: 0
      };
    }
  }

  /**
   * Clean up session files and database records
   */
  async cleanupSession(sessionId: string): Promise<number> {
    try {
      return await documentDatabase.cleanupSessionDocuments(sessionId);
    } catch (error) {
      logger.error('Failed to cleanup session', { sessionId, error });
      return 0;
    }
  }

  async cleanupFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.info(`Cleaned up file: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to cleanup file ${filePath}:`, error);
      // Don't throw error for cleanup failures
    }
  }
}

export const fileService = new FileService();