/**
 * Conversion utilities for PDF processing and metadata management
 */

import { logger } from './logger.js';
import { ConversionMetadata, ConversionResult } from '../types/api.types.js';

export interface DatabaseDocument {
  id: string;
  sessionId: string;
  filename: string;
  originalFilename: string;
  fileSize: number;
  contentType: string;
  uploadTimestamp: Date;
  processingStatus: 'uploaded' | 'processing' | 'ready' | 'error';
  filePath: string;
  imagePaths?: string[];
  pageCount?: number;
  processingMetadata?: ConversionMetadata;
  checksum: string;
}

/**
 * In-memory document storage for demo purposes
 * In production, this would be replaced with PostgreSQL database operations
 */
class DocumentDatabase {
  private documents = new Map<string, DatabaseDocument>();

  /**
   * Create or update document record
   */
  async upsertDocument(document: DatabaseDocument): Promise<void> {
    try {
      this.documents.set(document.id, {
        ...document,
        uploadTimestamp: new Date(document.uploadTimestamp)
      });

      logger.info('Document upserted in database', {
        documentId: document.id,
        sessionId: document.sessionId,
        status: document.processingStatus,
        imagePaths: document.imagePaths?.length || 0
      });
    } catch (error) {
      logger.error('Failed to upsert document', { documentId: document.id, error });
      throw new Error('Database upsert failed');
    }
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<DatabaseDocument | null> {
    try {
      const document = this.documents.get(documentId);
      return document || null;
    } catch (error) {
      logger.error('Failed to get document', { documentId, error });
      return null;
    }
  }

  /**
   * Get all documents for a session
   */
  async getDocumentsBySession(sessionId: string): Promise<DatabaseDocument[]> {
    try {
      const sessionDocuments: DatabaseDocument[] = [];
      
      for (const document of this.documents.values()) {
        if (document.sessionId === sessionId) {
          sessionDocuments.push(document);
        }
      }

      return sessionDocuments;
    } catch (error) {
      logger.error('Failed to get documents by session', { sessionId, error });
      return [];
    }
  }

  /**
   * Update document processing status
   */
  async updateProcessingStatus(
    documentId: string,
    status: 'uploaded' | 'processing' | 'ready' | 'error',
    conversionResult?: ConversionResult
  ): Promise<void> {
    try {
      const document = this.documents.get(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      document.processingStatus = status;
      
      if (conversionResult) {
        document.imagePaths = conversionResult.imagePaths;
        document.pageCount = conversionResult.imagePaths.length;
        document.processingMetadata = conversionResult.metadata;
      }

      this.documents.set(documentId, document);

      logger.info('Document processing status updated', {
        documentId,
        status,
        imagePaths: document.imagePaths?.length || 0,
        conversionSuccess: conversionResult?.success
      });
    } catch (error) {
      logger.error('Failed to update processing status', { documentId, status, error });
      throw error;
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    try {
      const deleted = this.documents.delete(documentId);
      
      if (deleted) {
        logger.info('Document deleted from database', { documentId });
      }
      
      return deleted;
    } catch (error) {
      logger.error('Failed to delete document', { documentId, error });
      return false;
    }
  }

  /**
   * Clean up documents for expired session
   */
  async cleanupSessionDocuments(sessionId: string): Promise<number> {
    try {
      let cleanedCount = 0;
      const documentsToDelete: string[] = [];

      for (const [documentId, document] of this.documents.entries()) {
        if (document.sessionId === sessionId) {
          documentsToDelete.push(documentId);
        }
      }

      for (const documentId of documentsToDelete) {
        if (await this.deleteDocument(documentId)) {
          cleanedCount++;
        }
      }

      logger.info('Session documents cleaned up', { sessionId, cleanedCount });
      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup session documents', { sessionId, error });
      return 0;
    }
  }

  /**
   * Get conversion metrics for monitoring
   */
  async getConversionMetrics(): Promise<{
    totalDocuments: number;
    processingDocuments: number;
    readyDocuments: number;
    errorDocuments: number;
    averageConversionTime: number;
  }> {
    try {
      const documents = Array.from(this.documents.values());
      const totalDocuments = documents.length;
      
      const processingDocuments = documents.filter(d => d.processingStatus === 'processing').length;
      const readyDocuments = documents.filter(d => d.processingStatus === 'ready').length;
      const errorDocuments = documents.filter(d => d.processingStatus === 'error').length;
      
      const conversionTimes = documents
        .filter(d => d.processingMetadata?.conversionDurationMs)
        .map(d => d.processingMetadata!.conversionDurationMs);
      
      const averageConversionTime = conversionTimes.length > 0
        ? conversionTimes.reduce((sum, time) => sum + time, 0) / conversionTimes.length
        : 0;

      return {
        totalDocuments,
        processingDocuments,
        readyDocuments,
        errorDocuments,
        averageConversionTime
      };
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
   * Health check for database
   */
  async healthCheck(): Promise<{ status: string; documentsCount: number }> {
    try {
      return {
        status: 'healthy',
        documentsCount: this.documents.size
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        documentsCount: 0
      };
    }
  }
}

export const documentDatabase = new DocumentDatabase();

/**
 * Utility functions for conversion metadata
 */
export class ConversionUtils {
  /**
   * Validate conversion result
   */
  static validateConversionResult(result: ConversionResult): boolean {
    if (!result.documentId || !result.metadata) {
      return false;
    }

    if (result.success && (!result.imagePaths || result.imagePaths.length === 0)) {
      return false;
    }

    return true;
  }

  /**
   * Calculate conversion metrics
   */
  static calculateMetrics(results: ConversionResult[]): {
    successRate: number;
    averageDuration: number;
    averagePageCount: number;
    totalImagesGenerated: number;
  } {
    const successfulResults = results.filter(r => r.success);
    const successRate = results.length > 0 ? successfulResults.length / results.length : 0;
    
    const durations = results.map(r => r.metadata.conversionDurationMs);
    const averageDuration = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;

    const pageCounts = successfulResults.map(r => r.imagePaths.length);
    const averagePageCount = pageCounts.length > 0
      ? pageCounts.reduce((sum, p) => sum + p, 0) / pageCounts.length
      : 0;

    const totalImagesGenerated = successfulResults.reduce((sum, r) => sum + r.imagePaths.length, 0);

    return {
      successRate,
      averageDuration,
      averagePageCount,
      totalImagesGenerated
    };
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
  }

  /**
   * Format duration for display
   */
  static formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    }
    
    const seconds = Math.round(milliseconds / 1000 * 100) / 100;
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round((seconds % 60) * 100) / 100;
    return `${minutes}m ${remainingSeconds}s`;
  }
}