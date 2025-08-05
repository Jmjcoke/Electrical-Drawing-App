/**
 * Symbol Detection Controller
 *
 * RESTful API endpoints for electrical symbol detection operations
 */
import { Request, Response } from 'express';
import { SymbolDetectionService } from '../detection/symbol-detector';
export declare class SymbolDetectionController {
    private detectionService;
    constructor(detectionService: SymbolDetectionService);
    /**
     * POST /api/sessions/{sessionId}/documents/{documentId}/detect-symbols
     * Trigger symbol detection for a document
     */
    startDetection(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/sessions/{sessionId}/detection-results/{resultId}
     * Get a specific detection result by ID
     */
    getDetectionResult(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/sessions/{sessionId}/detection-results
     * List detection results with filtering and pagination
     */
    listDetectionResults(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/sessions/{sessionId}/detection-jobs/{jobId}/status
     * Get the status of a detection job
     */
    getJobStatus(req: Request, res: Response): Promise<void>;
    /**
     * DELETE /api/sessions/{sessionId}/detection-jobs/{jobId}
     * Cancel a detection job
     */
    cancelDetection(req: Request, res: Response): Promise<void>;
    /**
     * PUT /api/sessions/{sessionId}/detection-results/{resultId}/validate
     * Validate and update detection results
     */
    validateDetectionResult(req: Request, res: Response): Promise<void>;
    /**
     * DELETE /api/sessions/{sessionId}/detection-results/{resultId}
     * Delete a detection result
     */
    deleteDetectionResult(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/symbol-library
     * Get available symbol types and categories
     */
    getSymbolLibrary(_req: Request, res: Response): Promise<void>;
    /**
     * POST /api/symbol-library/validate
     * Validate a custom symbol against the library
     */
    validateCustomSymbol(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/detection-queue/stats
     * Get detection queue statistics
     */
    getQueueStatistics(_req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=symbol-detection.controller.d.ts.map