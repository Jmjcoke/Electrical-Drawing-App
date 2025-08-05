/**
 * Symbol Detection Repository
 * 
 * Database access layer for symbol detection results, jobs, and caching
 * Story: 4.1 Symbol Detection Engine  
 * Task: 4.1.4 Database Storage Integration
 */

import { Pool } from 'pg';
import { 
  SymbolDetectionResult, 
  DetectedSymbol, 
  DetectionJob,
  SymbolDetectionError 
} from '../../../../shared/types/symbol-detection.types';

export interface DetectionCacheEntry {
  id: string;
  documentHash: string;
  pageNumber: number;
  detectionSettingsHash: string;
  cachedResult: SymbolDetectionResult;
  hitCount: number;
  lastAccessed: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface DetectionMetric {
  id: string;
  detectionResultId: string;
  metricType: string;
  metricValue: number;
  metricUnit?: string;
  benchmarkComparison?: any;
  createdAt: Date;
}

export interface SymbolLibraryEntry {
  id: string;
  symbolType: string;
  symbolCategory: string;  
  symbolName: string;
  symbolDescription?: string;
  templateData?: Buffer;
  featureVector?: any;
  industryStandard?: string;
  version: number;
  createdAt: Date;
}

export class SymbolDetectionRepository {
  constructor(private db: Pool) {}

  /**
   * Store symbol detection results with all detected symbols
   */
  async saveDetectionResult(result: SymbolDetectionResult): Promise<string> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Insert main detection result
      const resultQuery = `
        INSERT INTO electrical_analysis.symbol_detection_results 
        (id, query_id, document_id, session_id, page_number, processing_time_ms, 
         overall_confidence, detection_metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;

      const sessionId = this.extractSessionFromQueryId(result.queryId);
      
      const resultValues = [
        result.id,
        result.queryId,
        result.documentId,
        sessionId,
        result.pageNumber,
        result.processingTimeMs,
        result.overallConfidence,
        JSON.stringify(result.detectionMetadata)
      ];

      const resultRes = await client.query(resultQuery, resultValues);
      const detectionResultId = resultRes.rows[0].id;

      // Insert all detected symbols
      for (const symbol of result.detectedSymbols) {
        const symbolQuery = `
          INSERT INTO electrical_analysis.detected_symbols
          (id, detection_result_id, symbol_type, symbol_category, description,
           confidence, location_x, location_y, original_x, original_y,
           image_width, image_height, bounding_box, symbol_features,
           detection_method, validation_score)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        `;

        const symbolValues = [
          symbol.id,
          detectionResultId,
          symbol.symbolType,
          symbol.symbolCategory,
          symbol.description,
          symbol.confidence,
          symbol.location.x,
          symbol.location.y,
          symbol.location.originalX,
          symbol.location.originalY,
          symbol.location.imageWidth,
          symbol.location.imageHeight,
          JSON.stringify(symbol.boundingBox),
          JSON.stringify(symbol.features),
          symbol.detectionMethod,
          symbol.validationScore
        ];

        await client.query(symbolQuery, symbolValues);
      }

      await client.query('COMMIT');
      return detectionResultId;

    } catch (error) {
      await client.query('ROLLBACK');
      throw new SymbolDetectionError(
        'Failed to save detection result',
        'DATABASE_SAVE_ERROR',
        { originalError: error, resultId: result.id }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Retrieve detection results by ID with all symbols
   */
  async getDetectionResult(resultId: string): Promise<SymbolDetectionResult | null> {
    try {
      // Get main detection result
      const resultQuery = `
        SELECT * FROM electrical_analysis.symbol_detection_results
        WHERE id = $1
      `;
      
      const resultRes = await this.db.query(resultQuery, [resultId]);
      if (resultRes.rows.length === 0) {
        return null;
      }

      const row = resultRes.rows[0];

      // Get all detected symbols for this result
      const symbolsQuery = `
        SELECT * FROM electrical_analysis.detected_symbols
        WHERE detection_result_id = $1
        ORDER BY confidence DESC
      `;

      const symbolsRes = await this.db.query(symbolsQuery, [resultId]);
      
      const detectedSymbols: DetectedSymbol[] = symbolsRes.rows.map(symbolRow => ({
        id: symbolRow.id,
        symbolType: symbolRow.symbol_type,
        symbolCategory: symbolRow.symbol_category,
        description: symbolRow.description,
        confidence: parseFloat(symbolRow.confidence),
        location: {
          x: parseFloat(symbolRow.location_x),
          y: parseFloat(symbolRow.location_y),
          pageNumber: row.page_number,
          originalX: symbolRow.original_x,
          originalY: symbolRow.original_y,
          imageWidth: symbolRow.image_width,
          imageHeight: symbolRow.image_height
        },
        boundingBox: symbolRow.bounding_box,
        detectionMethod: symbolRow.detection_method,
        features: symbolRow.symbol_features,
        validationScore: parseFloat(symbolRow.validation_score)
      }));

      return {
        id: row.id,
        queryId: row.query_id,
        documentId: row.document_id,
        pageNumber: row.page_number,
        detectedSymbols,
        processingTimeMs: row.processing_time_ms,
        overallConfidence: parseFloat(row.overall_confidence),
        detectionMetadata: row.detection_metadata,
        createdAt: row.created_at
      };

    } catch (error) {
      throw new SymbolDetectionError(
        'Failed to retrieve detection result',
        'DATABASE_FETCH_ERROR',
        { originalError: error, resultId }
      );
    }
  }

  /**
   * List detection results for a session with pagination
   */
  async listDetectionResults(
    sessionId: string, 
    limit: number = 20, 
    offset: number = 0
  ): Promise<{ results: SymbolDetectionResult[], total: number }> {
    try {
      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total FROM electrical_analysis.symbol_detection_results
        WHERE session_id = $1
      `;
      const countRes = await this.db.query(countQuery, [sessionId]);
      const total = parseInt(countRes.rows[0].total);

      // Get paginated results
      const resultsQuery = `
        SELECT * FROM electrical_analysis.symbol_detection_results
        WHERE session_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const resultsRes = await this.db.query(resultsQuery, [sessionId, limit, offset]);
      
      // For each result, fetch its symbols (this could be optimized with a JOIN)
      const results: SymbolDetectionResult[] = [];
      for (const row of resultsRes.rows) {
        const result = await this.getDetectionResult(row.id);
        if (result) {
          results.push(result);
        }
      }

      return { results, total };

    } catch (error) {
      throw new SymbolDetectionError(
        'Failed to list detection results',
        'DATABASE_LIST_ERROR',
        { originalError: error, sessionId }
      );
    }
  }

  /**
   * Detection job management
   */
  async createDetectionJob(job: DetectionJob): Promise<string> {
    try {
      const query = `
        INSERT INTO electrical_analysis.detection_jobs
        (id, document_id, session_id, page_number, status, detection_settings)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;

      const values = [
        job.id,
        job.documentId,
        job.sessionId,
        job.pageNumber,
        job.status,
        JSON.stringify(job.settings)
      ];

      const result = await this.db.query(query, values);
      return result.rows[0].id;

    } catch (error) {
      throw new SymbolDetectionError(
        'Failed to create detection job',
        'DATABASE_JOB_CREATE_ERROR',
        { originalError: error, jobId: job.id }
      );
    }
  }

  /**
   * Update detection job status and progress
   */
  async updateDetectionJob(
    jobId: string, 
    updates: Partial<Pick<DetectionJob, 'status' | 'progressStage' | 'progressPercent'>>
  ): Promise<void> {
    try {
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.status !== undefined) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(updates.status);
        
        // Set timestamps based on status
        if (updates.status === 'processing') {
          setClauses.push(`started_at = NOW()`);
        } else if (['completed', 'failed', 'cancelled'].includes(updates.status)) {
          setClauses.push(`completed_at = NOW()`);
        }
      }

      if (updates.progressStage !== undefined) {
        setClauses.push(`progress_stage = $${paramIndex++}`);
        values.push(updates.progressStage);
      }

      if (updates.progressPercent !== undefined) {
        setClauses.push(`progress_percent = $${paramIndex++}`);
        values.push(updates.progressPercent);
      }

      if (setClauses.length === 0) return;

      const query = `
        UPDATE electrical_analysis.detection_jobs
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
      `;
      values.push(jobId);

      await this.db.query(query, values);

    } catch (error) {
      throw new SymbolDetectionError(
        'Failed to update detection job',
        'DATABASE_JOB_UPDATE_ERROR',
        { originalError: error, jobId }
      );
    }
  }

  /**
   * Get detection job by ID
   */
  async getDetectionJob(jobId: string): Promise<DetectionJob | null> {
    try {
      const query = `
        SELECT * FROM electrical_analysis.detection_jobs
        WHERE id = $1
      `;

      const result = await this.db.query(query, [jobId]);
      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        documentId: row.document_id,
        sessionId: row.session_id,
        pageNumber: row.page_number,
        imageBuffer: Buffer.alloc(0), // Not stored in DB
        settings: row.detection_settings,
        createdAt: row.created_at,
        status: row.status,
        progressStage: row.progress_stage,
        progressPercent: row.progress_percent
      };

    } catch (error) {
      throw new SymbolDetectionError(
        'Failed to get detection job',
        'DATABASE_JOB_FETCH_ERROR',
        { originalError: error, jobId }
      );
    }
  }

  /**
   * Cache management
   */
  async getCachedResult(
    documentHash: string, 
    pageNumber: number, 
    settingsHash: string
  ): Promise<SymbolDetectionResult | null> {
    try {
      const query = `
        UPDATE electrical_analysis.detection_cache
        SET hit_count = hit_count + 1, last_accessed = NOW()
        WHERE document_hash = $1 AND page_number = $2 AND detection_settings_hash = $3
          AND expires_at > NOW()
        RETURNING cached_result
      `;

      const result = await this.db.query(query, [documentHash, pageNumber, settingsHash]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].cached_result;

    } catch (error) {
      throw new SymbolDetectionError(
        'Failed to get cached result',
        'DATABASE_CACHE_FETCH_ERROR',
        { originalError: error, documentHash, pageNumber }
      );
    }
  }

  /**
   * Store detection result in cache
   */
  async cacheDetectionResult(
    documentHash: string,
    pageNumber: number,
    settingsHash: string,
    result: SymbolDetectionResult,
    expiresAt: Date
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO electrical_analysis.detection_cache
        (document_hash, page_number, detection_settings_hash, cached_result, expires_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (document_hash, page_number, detection_settings_hash)
        DO UPDATE SET
          cached_result = EXCLUDED.cached_result,
          expires_at = EXCLUDED.expires_at,
          hit_count = 0,
          last_accessed = NOW()
      `;

      const values = [
        documentHash,
        pageNumber,
        settingsHash,
        JSON.stringify(result),
        expiresAt
      ];

      await this.db.query(query, values);

    } catch (error) {
      throw new SymbolDetectionError(
        'Failed to cache detection result',
        'DATABASE_CACHE_STORE_ERROR',
        { originalError: error, documentHash, pageNumber }
      );
    }
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpiredCache(): Promise<number> {
    try {
      const result = await this.db.query('SELECT cleanup_expired_detection_cache()');
      return result.rows[0].cleanup_expired_detection_cache;
    } catch (error) {
      throw new SymbolDetectionError(
        'Failed to clean expired cache',
        'DATABASE_CACHE_CLEANUP_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Symbol library operations
   */
  async getSymbolLibraryEntries(
    symbolType?: string,
    symbolCategory?: string
  ): Promise<SymbolLibraryEntry[]> {
    try {
      let query = 'SELECT * FROM electrical_analysis.symbol_library';
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (symbolType) {
        conditions.push(`symbol_type = $${paramIndex++}`);
        values.push(symbolType);
      }

      if (symbolCategory) {
        conditions.push(`symbol_category = $${paramIndex++}`);
        values.push(symbolCategory);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY symbol_name';

      const result = await this.db.query(query, values);
      
      return result.rows.map(row => ({
        id: row.id,
        symbolType: row.symbol_type,
        symbolCategory: row.symbol_category,
        symbolName: row.symbol_name,
        symbolDescription: row.symbol_description,
        templateData: row.template_data,
        featureVector: row.feature_vector,
        industryStandard: row.industry_standard,
        version: row.version,
        createdAt: row.created_at
      }));

    } catch (error) {
      throw new SymbolDetectionError(
        'Failed to get symbol library entries',
        'DATABASE_LIBRARY_FETCH_ERROR',
        { originalError: error, symbolType, symbolCategory }
      );
    }
  }

  /**
   * Store detection performance metrics
   */
  async saveDetectionMetrics(
    detectionResultId: string,
    metrics: Array<{
      metricType: string;
      metricValue: number;
      metricUnit?: string;
      benchmarkComparison?: any;
    }>
  ): Promise<void> {
    try {
      const query = `
        INSERT INTO electrical_analysis.detection_metrics
        (detection_result_id, metric_type, metric_value, metric_unit, benchmark_comparison)
        VALUES ($1, $2, $3, $4, $5)
      `;

      for (const metric of metrics) {
        const values = [
          detectionResultId,
          metric.metricType,
          metric.metricValue,
          metric.metricUnit,
          metric.benchmarkComparison ? JSON.stringify(metric.benchmarkComparison) : null
        ];

        await this.db.query(query, values);
      }

    } catch (error) {
      throw new SymbolDetectionError(
        'Failed to save detection metrics',
        'DATABASE_METRICS_SAVE_ERROR',
        { originalError: error, detectionResultId }
      );
    }
  }

  /**
   * Delete detection results and associated data
   */
  async deleteDetectionResult(resultId: string): Promise<boolean> {
    try {
      const query = `
        DELETE FROM electrical_analysis.symbol_detection_results
        WHERE id = $1
      `;

      const result = await this.db.query(query, [resultId]);
      return (result.rowCount || 0) > 0;

    } catch (error) {
      throw new SymbolDetectionError(
        'Failed to delete detection result',
        'DATABASE_DELETE_ERROR',
        { originalError: error, resultId }
      );
    }
  }

  /**
   * Helper to extract session ID from query ID (if follows expected pattern)
   */
  private extractSessionFromQueryId(queryId: string): string {
    // If queryId follows pattern like "session-{sessionId}-query-{queryId}"
    // extract the session part, otherwise return the queryId as sessionId
    const match = queryId.match(/session-([^-]+)-/);
    return match ? match[1] : queryId;
  }
}