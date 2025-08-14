/**
 * Symbol Detection Controller
 * 
 * RESTful API endpoints for electrical symbol detection operations
 */

import { Request, Response } from 'express';
import { 
  DetectedSymbol,
  DetectionSettings,
  SymbolDetectionError 
} from '../../../../shared/types/symbol-detection.types';
import { SymbolDetectionService } from '../detection/symbol-detector';
import { RealSymbolDetectionService } from '../detection/symbol-detector-real';

interface DetectionJobResponse {
  success: boolean;
  jobId: string;
  message: string;
  estimatedTime?: number;
  totalPages?: number;
}

interface DetectionResultsQuery {
  sessionId?: string;
  documentId?: string;
  pageNumber?: number;
  symbolType?: string;
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

// Union type for both service implementations
type SymbolDetectionServiceType = SymbolDetectionService | RealSymbolDetectionService;

export class SymbolDetectionController {
  private detectionService: SymbolDetectionServiceType;

  constructor(detectionService: SymbolDetectionServiceType) {
    this.detectionService = detectionService;
    
    // Bind methods to preserve 'this' context
    this.startDetection = this.startDetection.bind(this);
    this.getDetectionResult = this.getDetectionResult.bind(this);
    this.listDetectionResults = this.listDetectionResults.bind(this);
    this.getJobStatus = this.getJobStatus.bind(this);
    this.cancelDetection = this.cancelDetection.bind(this);
    this.validateDetectionResult = this.validateDetectionResult.bind(this);
    this.deleteDetectionResult = this.deleteDetectionResult.bind(this);
    this.getSymbolLibrary = this.getSymbolLibrary.bind(this);
    this.validateCustomSymbol = this.validateCustomSymbol.bind(this);
    this.getQueueStatistics = this.getQueueStatistics.bind(this);
  }

  /**
   * POST /api/sessions/{sessionId}/documents/{documentId}/detect-symbols
   * Trigger symbol detection for a document
   */
  async startDetection(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, documentId } = req.params;
      const { settings } = req.body as { settings?: Partial<DetectionSettings> };

      // Validate required parameters
      if (!sessionId || !documentId) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: sessionId and documentId'
        });
        return;
      }

      // Check if file was uploaded
      if (!req.file || !req.file.buffer) {
        res.status(400).json({
          success: false,
          error: 'PDF file is required'
        });
        return;
      }

      // Validate PDF file type
      if (req.file.mimetype !== 'application/pdf') {
        res.status(400).json({
          success: false,
          error: 'Only PDF files are supported'
        });
        return;
      }

      // Start detection process
      const jobId = await this.detectionService.processDocument(
        documentId,
        sessionId,
        req.file.buffer,
        settings
      );

      // Get queue statistics for estimated time
      const queueStats = await this.detectionService.getQueueStats();
      const estimatedTime = (queueStats.waiting + 1) * 5000; // 5 seconds per job estimate

      const response: DetectionJobResponse = {
        success: true,
        jobId,
        message: 'Symbol detection started successfully',
        estimatedTime,
      };

      res.status(202).json(response);

    } catch (error) {
      console.error('Symbol detection start error:', error);
      
      if (error instanceof SymbolDetectionError) {
        res.status(400).json({
          success: false,
          error: error.message,
          code: error.code,
          details: error.details
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error during symbol detection initialization'
        });
      }
    }
  }

  /**
   * GET /api/sessions/{sessionId}/detection-results/{resultId}
   * Get a specific detection result by ID
   */
  async getDetectionResult(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, resultId } = req.params;

      // Validate required parameters
      if (!sessionId || !resultId) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: sessionId and resultId'
        });
        return;
      }

      // Get job status and result
      const jobResult = await this.detectionService.getJobStatus(resultId);

      if (!jobResult) {
        res.status(404).json({
          success: false,
          error: 'Detection result not found'
        });
        return;
      }

      if (jobResult.error) {
        res.status(400).json({
          success: false,
          error: 'Detection job failed',
          details: jobResult.error
        });
        return;
      }

      if (!jobResult.result) {
        res.status(202).json({
          success: true,
          message: 'Detection job is still processing',
          jobId: resultId,
          completedAt: jobResult.completedAt
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: jobResult.result
      });

    } catch (error) {
      console.error('Get detection result error:', error);
      
      if (error instanceof SymbolDetectionError) {
        res.status(400).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error retrieving detection result'
        });
      }
    }
  }

  /**
   * GET /api/sessions/{sessionId}/detection-results
   * List detection results with filtering and pagination
   */
  async listDetectionResults(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const query = req.query as unknown as DetectionResultsQuery;

      // Validate required parameters
      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameter: sessionId'
        });
        return;
      }

      // Parse query parameters with proper types
      const limit = query.limit ? parseInt(query.limit.toString()) : 10;
      const offset = query.offset ? parseInt(query.offset.toString()) : 0;
      const pageNumber = query.pageNumber ? parseInt(query.pageNumber.toString()) : undefined;
      const minConfidence = query.minConfidence ? parseFloat(query.minConfidence.toString()) : undefined;

      // Query database for detection results using the service's method
      const results = await this.detectionService.listDetectionResults(sessionId, {
        limit,
        offset,
        minConfidence,
        symbolTypes: query.symbolType ? [query.symbolType] : undefined,
      });
      
      res.status(200).json({
        success: true,
        data: {
          results: results.results,
          pagination: {
            total: results.total,
            limit,
            offset,
            hasMore: offset + limit < results.total
          },
          summary: results.summary,
          filters: {
            sessionId,
            documentId: query.documentId,
            pageNumber,
            symbolType: query.symbolType,
            minConfidence
          }
        }
      });

    } catch (error) {
      console.error('List detection results error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error listing detection results'
      });
    }
  }

  /**
   * GET /api/sessions/{sessionId}/detection-jobs/{jobId}/status
   * Get the status of a detection job
   */
  async getJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, jobId } = req.params;

      // Validate required parameters
      if (!sessionId || !jobId) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: sessionId and jobId'
        });
        return;
      }

      const jobResult = await this.detectionService.getJobStatus(jobId);

      if (!jobResult) {
        res.status(404).json({
          success: false,
          error: 'Detection job not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          jobId,
          status: jobResult.error ? 'failed' : (jobResult.result ? 'completed' : 'processing'),
          completedAt: jobResult.completedAt,
          result: jobResult.result,
          error: jobResult.error
        }
      });

    } catch (error) {
      console.error('Get job status error:', error);
      
      if (error instanceof SymbolDetectionError) {
        res.status(400).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error getting job status'
        });
      }
    }
  }

  /**
   * DELETE /api/sessions/{sessionId}/detection-jobs/{jobId}
   * Cancel a detection job
   */
  async cancelDetection(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, jobId } = req.params;

      // Validate required parameters
      if (!sessionId || !jobId) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: sessionId and jobId'
        });
        return;
      }

      const cancelled = await this.detectionService.cancelJob(jobId);

      if (!cancelled) {
        res.status(400).json({
          success: false,
          error: 'Job cannot be cancelled (not found or already completed)'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Detection job cancelled successfully',
        jobId
      });

    } catch (error) {
      console.error('Cancel detection job error:', error);
      
      if (error instanceof SymbolDetectionError) {
        res.status(400).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error cancelling detection job'
        });
      }
    }
  }

  /**
   * PUT /api/sessions/{sessionId}/detection-results/{resultId}/validate
   * Validate and update detection results
   */
  async validateDetectionResult(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, resultId } = req.params;
      const { corrections } = req.body as { corrections: Partial<DetectedSymbol>[] };

      // Validate required parameters
      if (!sessionId || !resultId) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: sessionId and resultId'
        });
        return;
      }

      // Update the database with user corrections
      const validationResult = await this.detectionService.validateDetectedSymbol({
        id: resultId,
        ...corrections,
      } as any);
      
      res.status(200).json({
        success: true,
        message: 'Detection result validation updated',
        data: {
          resultId,
          corrections: corrections || [],
          validationResult,
          validatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Validate detection result error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error validating detection result'
      });
    }
  }

  /**
   * DELETE /api/sessions/{sessionId}/detection-results/{resultId}
   * Delete a detection result
   */
  async deleteDetectionResult(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, resultId } = req.params;

      // Validate required parameters
      if (!sessionId || !resultId) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: sessionId and resultId'
        });
        return;
      }

      // Delete from the database
      const deleted = await this.detectionService.deleteDetectionResult(resultId);
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Detection result not found or already deleted'
        });
        return;
      }
      
      res.status(200).json({
        success: true,
        message: 'Detection result deleted successfully',
        resultId,
        deletedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('Delete detection result error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error deleting detection result'
      });
    }
  }

  /**
   * GET /api/symbol-library
   * Get available symbol types and categories
   */
  async getSymbolLibrary(req: Request, res: Response): Promise<void> {
    try {
      // Query actual symbol library from database
      const filters = req.query as { symbolType?: string; symbolCategory?: string };
      const libraryEntries = await this.detectionService.getSymbolLibrary(filters);
      
      // Also provide the available types and categories
      const symbolLibrary = {
        entries: libraryEntries,
        symbolTypes: [
          'resistor', 'capacitor', 'inductor', 'diode', 'transistor',
          'integrated_circuit', 'connector', 'switch', 'relay', 'transformer',
          'ground', 'power_supply', 'battery', 'fuse', 'led',
          'operational_amplifier', 'logic_gate', 'custom', 'unknown'
        ],
        symbolCategories: [
          'passive', 'active', 'connector', 'power', 'protection', 'logic', 'custom'
        ],
        detectionMethods: [
          'pattern_matching', 'ml_classification', 'llm_analysis', 'consensus'
        ]
      };

      res.status(200).json({
        success: true,
        data: symbolLibrary
      });

    } catch (error) {
      console.error('Get symbol library error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error retrieving symbol library'
      });
    }
  }

  /**
   * POST /api/symbol-library/validate
   * Validate a custom symbol against the library
   */
  async validateCustomSymbol(req: Request, res: Response): Promise<void> {
    try {
      const { symbolData, symbolType, symbolCategory } = req.body;

      // Validate required parameters
      if (!symbolData || !symbolType || !symbolCategory) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: symbolData, symbolType, symbolCategory'
        });
        return;
      }

      // Validate against the symbol library database
      const symbolLibrary = await this.detectionService.getSymbolLibrary({
        symbolType,
        symbolCategory,
      });
      
      // Check if symbol type exists in library
      const matchedSymbol = symbolLibrary.find(
        (lib: any) => lib.symbolType === symbolType && lib.symbolCategory === symbolCategory
      );
      
      res.status(200).json({
        success: true,
        message: 'Symbol validation completed',
        data: {
          isValid: !!matchedSymbol,
          confidence: matchedSymbol ? 0.95 : 0.0,
          matchedTemplate: matchedSymbol?.symbolName || null,
          suggestions: !matchedSymbol ? symbolLibrary.slice(0, 3).map((s: any) => s.symbolName) : [],
          validatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Validate custom symbol error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error validating custom symbol'
      });
    }
  }

  /**
   * GET /api/detection-queue/stats
   * Get detection queue statistics
   */
  async getQueueStatistics(_req: Request, res: Response): Promise<void> {
    try {
      const queueStats = await this.detectionService.getQueueStats();

      res.status(200).json({
        success: true,
        data: {
          queue: queueStats,
          estimatedWaitTime: queueStats.waiting * 5000, // 5 seconds per job
          averageProcessingTime: 5000,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Get queue statistics error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error retrieving queue statistics'
      });
    }
  }
}