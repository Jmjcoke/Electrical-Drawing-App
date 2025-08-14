/**
 * Export Controller
 * API endpoints for component export and reporting functionality
 * Implements Story 4.5 API requirements
 */

import { Request, Response, NextFunction } from 'express';
import { ComponentExportService } from '../export/component-export.service';
import { TemplateService } from '../export/template.service';
import { ExportRepository } from '../repositories/export.repository';
import { 
  ComponentExportRequest,
  ExportFormat,
  ComponentSortOption
} from '../../../../shared/types/nlp.types';
import * as fs from 'fs';
import * as path from 'path';
// import * as crypto from 'crypto'; // Reserved for future use

export class ExportController {
  constructor(
    private exportService: ComponentExportService,
    private templateService: TemplateService,
    private exportRepository: ExportRepository
  ) {}

  /**
   * POST /api/sessions/:sessionId/export/components
   * Generate component export report
   */
  async exportComponents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const {
        documentIds,
        exportFormat = 'pdf',
        includeReferences = false,
        includeVisualMap = false,
        templateId,
        includeTechnicalSpecs = true,
        includePartNumbers = false,
        includeConfidenceScores = false,
        groupByPage = false,
        sortBy = 'type',
        customBranding
      } = req.body;

      // Validate export format
      const validFormats: ExportFormat[] = ['pdf', 'csv', 'excel', 'json'];
      if (!validFormats.includes(exportFormat)) {
        res.status(400).json({
          error: 'Invalid export format',
          validFormats
        });
        return;
      }

      // Validate sort option
      const validSortOptions: ComponentSortOption[] = ['type', 'page', 'confidence', 'alphabetical'];
      if (!validSortOptions.includes(sortBy)) {
        res.status(400).json({
          error: 'Invalid sort option',
          validOptions: validSortOptions
        });
        return;
      }

      // Build export request
      const exportRequest: ComponentExportRequest = {
        sessionId,
        documentIds,
        exportFormat,
        includeReferences,
        includeVisualMap,
        templateId,
        customOptions: {
          includeTechnicalSpecs,
          includePartNumbers,
          includeConfidenceScores,
          groupByPage,
          sortBy,
          customBranding
        }
      };

      // Generate export
      const result = await this.exportService.exportComponents(exportRequest);

      if (result.success) {
        // Log export to history
        if (result.reportId) {
          await this.exportRepository.saveExportHistory({
            sessionId,
            reportId: result.reportId,
            exportFormat,
            fileSize: result.fileSize,
            generationTimeMs: result.generationTime,
            userIp: req.ip,
            success: true
          });
        }

        res.status(200).json({
          success: true,
          reportId: result.reportId,
          downloadUrl: `/api/sessions/${sessionId}/reports/${result.reportId}/download`,
          fileSize: result.fileSize,
          generationTime: result.generationTime
        });
      } else {
        // Log failed export (without reportId since it failed)
        // We'll skip logging failed exports without a reportId

        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/sessions/:sessionId/reports
   * Get all generated reports for session
   */
  async getSessionReports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      
      const reports = await this.exportService.listSessionReports(sessionId);
      
      res.status(200).json({
        sessionId,
        reportCount: reports.length,
        reports: reports.map(report => ({
          id: report.id,
          reportType: report.reportType,
          exportFormat: report.exportFormat,
          componentCount: report.componentCount,
          fileSize: report.fileSize,
          downloadCount: report.downloadCount,
          createdAt: report.createdAt,
          expiresAt: report.expiresAt,
          downloadUrl: `/api/sessions/${sessionId}/reports/${report.id}/download`
        }))
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/sessions/:sessionId/reports/:reportId
   * Get specific report details
   */
  async getReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId, reportId } = req.params;
      
      const report = await this.exportService.getReport(reportId);
      
      if (!report) {
        res.status(404).json({
          error: 'Report not found'
        });
        return;
      }

      // Verify session ID matches
      if (report.sessionId !== sessionId) {
        res.status(403).json({
          error: 'Report does not belong to this session'
        });
        return;
      }

      res.status(200).json(report);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/sessions/:sessionId/reports/:reportId/download
   * Download generated report file
   */
  async downloadReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId, reportId } = req.params;
      
      // Validate reportId format to prevent injection
      if (!this.isValidUUID(reportId)) {
        res.status(400).json({
          error: 'Invalid report ID format'
        });
        return;
      }
      
      const downloadInfo = await this.exportService.downloadReport(reportId);
      
      if (!downloadInfo) {
        res.status(404).json({
          error: 'Report file not found'
        });
        return;
      }

      // Validate file path to prevent directory traversal
      if (!this.isFilePathSafe(downloadInfo.filePath)) {
        res.status(403).json({
          error: 'File access denied for security reasons'
        });
        return;
      }

      // Verify file exists and get stats for size validation
      let fileStats;
      try {
        fileStats = await fs.promises.stat(downloadInfo.filePath);
      } catch (error) {
        res.status(404).json({
          error: 'Report file no longer exists'
        });
        return;
      }

      // Validate file size (max 50MB for security)
      const maxFileSize = 50 * 1024 * 1024; // 50MB
      if (fileStats.size > maxFileSize) {
        res.status(413).json({
          error: 'File too large to download',
          maxSize: '50MB'
        });
        return;
      }

      // Sanitize filename for safe download
      const safeFileName = this.sanitizeFileName(downloadInfo.fileName);
      
      // Set appropriate headers with additional security
      res.setHeader('Content-Type', downloadInfo.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
      res.setHeader('Content-Length', fileStats.size);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      
      // Stream file to response with error handling
      const fileStream = fs.createReadStream(downloadInfo.filePath);
      
      fileStream.on('error', (error) => {
        console.error('File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'File read error' });
        }
      });
      
      fileStream.pipe(res);
      
      // Log successful download
      console.log(`File downloaded: ${reportId} by ${req.ip}`);
      
    } catch (error) {
      console.error('Download error:', error);
      next(error);
    }
  }

  /**
   * POST /api/sessions/:sessionId/export/preview
   * Generate export preview without file creation
   */
  async generatePreview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.params;
      const {
        documentIds,
        exportFormat = 'pdf',
        includeReferences = false,
        includeVisualMap = false,
        templateId,
        includeTechnicalSpecs = true,
        includePartNumbers = false,
        includeConfidenceScores = false,
        groupByPage = false,
        sortBy = 'type',
        customBranding
      } = req.body;

      const exportRequest: ComponentExportRequest = {
        sessionId,
        documentIds,
        exportFormat: exportFormat as ExportFormat,
        includeReferences,
        includeVisualMap,
        templateId,
        customOptions: {
          includeTechnicalSpecs,
          includePartNumbers,
          includeConfidenceScores,
          groupByPage,
          sortBy: sortBy as ComponentSortOption,
          customBranding
        }
      };

      const preview = await this.exportService.generatePreview(exportRequest);

      res.status(200).json({
        sessionId,
        exportFormat,
        preview
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/export/templates
   * Get available report templates
   */
  async getTemplates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { templateType } = req.query;
      
      const templates = await this.templateService.listTemplates(
        templateType as any
      );

      res.status(200).json({
        templateCount: templates.length,
        templates: templates.map(template => ({
          id: template.id,
          name: template.name,
          description: template.description,
          templateType: template.templateType,
          isDefault: template.isDefault,
          isSystem: template.isSystem,
          sections: template.sections,
          createdAt: template.createdAt,
          updatedAt: template.updatedAt
        }))
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/export/templates
   * Create custom report template
   */
  async createTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        name,
        description,
        templateType,
        layout,
        branding,
        sections,
        customFields
      } = req.body;

      // Validate required fields
      if (!name || !templateType || !layout || !sections) {
        res.status(400).json({
          error: 'Missing required fields: name, templateType, layout, sections'
        });
        return;
      }

      const template = await this.templateService.createTemplate({
        name,
        description,
        templateType,
        layout,
        branding,
        sections,
        customFields
      });

      res.status(201).json({
        success: true,
        templateId: template.id,
        template
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/export/formats
   * Get supported export formats and options
   */
  async getExportFormats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const formats = [
        {
          format: 'pdf',
          name: 'PDF Document',
          description: 'Portable Document Format with full formatting and images',
          mimeType: 'application/pdf',
          features: ['Full formatting', 'Images', 'Table of contents', 'Page numbers'],
          maxFileSize: '50MB',
          supportedOptions: ['includeVisualMap', 'includeTOC', 'customBranding']
        },
        {
          format: 'excel',
          name: 'Microsoft Excel',
          description: 'Spreadsheet with multiple sheets and formatting',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          features: ['Multiple sheets', 'Formulas', 'Charts', 'Filtering'],
          maxFileSize: '25MB',
          supportedOptions: ['groupByPage', 'includeCharts']
        },
        {
          format: 'csv',
          name: 'CSV File',
          description: 'Comma-separated values for data import',
          mimeType: 'text/csv',
          features: ['Simple format', 'Universal compatibility', 'Fast generation'],
          maxFileSize: '10MB',
          supportedOptions: ['delimiter', 'includeHeaders']
        },
        {
          format: 'json',
          name: 'JSON Data',
          description: 'Structured data format for API integration',
          mimeType: 'application/json',
          features: ['Structured data', 'API-friendly', 'Schema support'],
          maxFileSize: '20MB',
          supportedOptions: ['schemaVersion', 'minimal', 'pretty']
        }
      ];

      const sortOptions = [
        { value: 'type', label: 'Component Type', description: 'Sort by component type alphabetically' },
        { value: 'page', label: 'Page Number', description: 'Sort by page number and position' },
        { value: 'confidence', label: 'Confidence Score', description: 'Sort by detection confidence' },
        { value: 'alphabetical', label: 'Alphabetical', description: 'Sort by component description' }
      ];

      const reportTypes = [
        { value: 'component_list', label: 'Component List', description: 'Detailed list of all components' },
        { value: 'parts_order', label: 'Parts Order (BOM)', description: 'Bill of materials for ordering' },
        { value: 'technical_analysis', label: 'Technical Analysis', description: 'Comprehensive technical report' },
        { value: 'project_summary', label: 'Project Summary', description: 'High-level project overview' }
      ];

      res.status(200).json({
        formats,
        sortOptions,
        reportTypes,
        options: {
          includeTechnicalSpecs: { type: 'boolean', default: true, description: 'Include component specifications' },
          includePartNumbers: { type: 'boolean', default: false, description: 'Include part numbers and suppliers' },
          includeConfidenceScores: { type: 'boolean', default: false, description: 'Include detection confidence scores' },
          includeReferences: { type: 'boolean', default: false, description: 'Include cross-page references' },
          includeVisualMap: { type: 'boolean', default: false, description: 'Include visual component maps' },
          groupByPage: { type: 'boolean', default: false, description: 'Group components by page' }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/export/statistics
   * Get export statistics
   */
  async getExportStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sessionId } = req.query;
      
      const stats = await this.exportRepository.getReportStatistics(
        sessionId as string | undefined
      );

      res.status(200).json(stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/export/health
   * Get export system health status
   */
  async getExportHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const healthStatus = this.exportService.getHealthStatus();
      const metrics = this.exportService.getMetrics();
      
      res.status(200).json({
        health: healthStatus,
        metrics: {
          totalExports: metrics.totalExports,
          successRate: metrics.totalExports > 0 
            ? (metrics.successfulExports / metrics.totalExports * 100).toFixed(2) + '%'
            : 'N/A',
          averageProcessingTime: `${(metrics.averageProcessingTime / 1000).toFixed(2)}s`,
          concurrentExports: metrics.performanceStats.concurrentExports,
          memoryUsage: `${(metrics.memoryUsageStats.current / 1024 / 1024).toFixed(1)}MB`
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/export/metrics
   * Get detailed export metrics
   */
  async getExportMetrics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = this.exportService.getMetrics();
      const performanceReport = this.exportService.getPerformanceReport();
      const monitoringService = this.exportService.getMonitoringService();
      
      res.status(200).json({
        metrics,
        performanceReport,
        recentEvents: monitoringService.getRecentEvents(50),
        activeAlerts: monitoringService.getActiveAlerts(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/export/alerts/:alertId/resolve
   * Resolve an alert
   */
  async resolveAlert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { alertId } = req.params;
      const monitoringService = this.exportService.getMonitoringService();
      
      const resolved = monitoringService.resolveAlert(alertId);
      
      if (resolved) {
        res.status(200).json({
          success: true,
          message: 'Alert resolved successfully'
        });
      } else {
        res.status(404).json({
          error: 'Alert not found'
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Helper: Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate UUID format
   */
  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  /**
   * Validate file path is safe
   */
  private isFilePathSafe(filePath: string): boolean {
    try {
      const resolvedPath = path.resolve(filePath);
      const exportDir = process.env.EXPORT_DIR || '/tmp/electrical-exports';
      const resolvedExportDir = path.resolve(exportDir);
      
      // Check if file is within export directory
      if (!resolvedPath.startsWith(resolvedExportDir)) {
        console.error('File path outside export directory:', resolvedPath);
        return false;
      }
      
      // Check for path traversal attempts
      if (filePath.includes('..') || filePath.includes('~')) {
        console.error('Path traversal attempt detected:', filePath);
        return false;
      }
      
      // Check for null bytes
      if (filePath.includes('\0')) {
        console.error('Null byte in file path:', filePath);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('File path validation error:', error);
      return false;
    }
  }

  /**
   * Sanitize filename for safe download
   */
  private sanitizeFileName(fileName: string): string {
    // Remove dangerous characters and limit length
    const safe = fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 255);
    
    // Ensure it has a proper extension
    if (!safe.includes('.')) {
      return `${safe}.bin`;
    }
    
    return safe;
  }
}