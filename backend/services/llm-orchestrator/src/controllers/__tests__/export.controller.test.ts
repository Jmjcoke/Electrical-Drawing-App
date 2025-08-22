/**
 * Export Controller Tests
 * Tests for export API endpoints - Story 4.5
 */

import { Request, Response, NextFunction } from 'express';
import { ExportController } from '../export.controller';
import { ComponentExportService } from '../../export/component-export.service';
import { TemplateService } from '../../export/template.service';
import { ExportRepository } from '../../repositories/export.repository';

// Mock dependencies
jest.mock('../../export/component-export.service');
jest.mock('../../export/template.service');
jest.mock('../../repositories/export.repository');
jest.mock('fs');

describe('ExportController', () => {
  let controller: ExportController;
  let mockExportService: jest.Mocked<ComponentExportService>;
  let mockTemplateService: jest.Mocked<TemplateService>;
  let mockExportRepository: jest.Mocked<ExportRepository>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Create mock instances
    mockExportService = new ComponentExportService(
      null as any,
      null as any,
      null as any,
      null as any,
      null as any,
      null as any
    ) as jest.Mocked<ComponentExportService>;
    
    mockTemplateService = new TemplateService(null as any) as jest.Mocked<TemplateService>;
    mockExportRepository = new ExportRepository(null as any) as jest.Mocked<ExportRepository>;

    // Initialize controller
    controller = new ExportController(
      mockExportService,
      mockTemplateService,
      mockExportRepository
    );

    // Setup request/response mocks
    mockRequest = {
      params: {},
      body: {},
      query: {},
      ip: '127.0.0.1'
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      pipe: jest.fn()
    };

    mockNext = jest.fn();
  });

  describe('POST /api/sessions/:sessionId/export/components', () => {
    it('should successfully export components', async () => {
      mockRequest.params = { sessionId: 'session-123' };
      mockRequest.body = {
        exportFormat: 'pdf',
        includeReferences: true,
        includeVisualMap: false,
        sortBy: 'type'
      };

      const exportResult = {
        success: true,
        reportId: 'report-123',
        filePath: '/tmp/report.pdf',
        fileSize: 1024,
        generationTime: 500
      };

      mockExportService.exportComponents.mockResolvedValue(exportResult);
      mockExportRepository.saveExportHistory.mockResolvedValue({} as any);

      await controller.exportComponents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        reportId: 'report-123',
        downloadUrl: '/api/sessions/session-123/reports/report-123/download',
        fileSize: 1024,
        generationTime: 500
      });
    });

    it('should handle invalid export format', async () => {
      mockRequest.params = { sessionId: 'session-123' };
      mockRequest.body = {
        exportFormat: 'invalid'
      };

      await controller.exportComponents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid export format',
        validFormats: ['pdf', 'csv', 'excel', 'json']
      });
    });

    it('should handle export failure', async () => {
      mockRequest.params = { sessionId: 'session-123' };
      mockRequest.body = {
        exportFormat: 'pdf'
      };

      const exportResult = {
        success: false,
        error: 'Export failed',
        generationTime: 100
      };

      mockExportService.exportComponents.mockResolvedValue(exportResult);
      mockExportRepository.saveExportHistory.mockResolvedValue({} as any);

      await controller.exportComponents(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Export failed'
      });
    });
  });

  describe('GET /api/sessions/:sessionId/reports', () => {
    it('should list all session reports', async () => {
      mockRequest.params = { sessionId: 'session-123' };

      const reports = [
        {
          id: 'report-1',
          reportType: 'component_list',
          exportFormat: 'pdf',
          componentCount: 50,
          fileSize: 2048,
          downloadCount: 3,
          createdAt: new Date(),
          expiresAt: null
        }
      ];

      mockExportService.listSessionReports.mockResolvedValue(reports as any);

      await controller.getSessionReports(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-123',
          reportCount: 1,
          reports: expect.arrayContaining([
            expect.objectContaining({
              id: 'report-1',
              downloadUrl: '/api/sessions/session-123/reports/report-1/download'
            })
          ])
        })
      );
    });
  });

  describe('GET /api/sessions/:sessionId/reports/:reportId/download', () => {
    it('should download report file', async () => {
      mockRequest.params = {
        sessionId: 'session-123',
        reportId: 'report-123'
      };

      const downloadInfo = {
        filePath: '/tmp/report.pdf',
        fileName: 'report.pdf',
        mimeType: 'application/pdf'
      };

      mockExportService.downloadReport.mockResolvedValue(downloadInfo);

      const fs = require('fs');
      const mockStream = {
        pipe: jest.fn()
      };
      fs.createReadStream = jest.fn().mockReturnValue(mockStream);
      fs.promises = {
        access: jest.fn().mockResolvedValue(undefined)
      };

      await controller.downloadReport(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="report.pdf"'
      );
      expect(mockStream.pipe).toHaveBeenCalledWith(mockResponse);
    });

    it('should handle missing report file', async () => {
      mockRequest.params = {
        sessionId: 'session-123',
        reportId: 'report-123'
      };

      mockExportService.downloadReport.mockResolvedValue(null);

      await controller.downloadReport(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Report file not found'
      });
    });
  });

  describe('POST /api/sessions/:sessionId/export/preview', () => {
    it('should generate export preview', async () => {
      mockRequest.params = { sessionId: 'session-123' };
      mockRequest.body = {
        exportFormat: 'csv',
        sortBy: 'page'
      };

      const preview = {
        componentCount: 25,
        pageCount: 3,
        estimatedSize: 5000,
        components: []
      };

      mockExportService.generatePreview.mockResolvedValue(preview);

      await controller.generatePreview(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        sessionId: 'session-123',
        exportFormat: 'csv',
        preview
      });
    });
  });

  describe('GET /api/export/templates', () => {
    it('should list available templates', async () => {
      mockRequest.query = { templateType: 'component_list' };

      const templates = [
        {
          id: 'template-1',
          name: 'Standard Template',
          description: 'Default component list template',
          templateType: 'component_list',
          isDefault: true,
          isSystem: true,
          sections: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockTemplateService.listTemplates.mockResolvedValue(templates as any);

      await controller.getTemplates(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockTemplateService.listTemplates).toHaveBeenCalledWith('component_list');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          templateCount: 1,
          templates: expect.arrayContaining([
            expect.objectContaining({
              id: 'template-1',
              name: 'Standard Template'
            })
          ])
        })
      );
    });
  });

  describe('POST /api/export/templates', () => {
    it('should create custom template', async () => {
      mockRequest.body = {
        name: 'Custom Template',
        description: 'My custom template',
        templateType: 'component_list',
        layout: {
          orientation: 'portrait',
          pageSize: 'A4',
          margins: { top: 20, bottom: 20, left: 20, right: 20 },
          includePageNumbers: true,
          includeTOC: false
        },
        sections: [
          { id: 'header', name: 'Header', type: 'header', enabled: true, order: 1 }
        ]
      };

      const createdTemplate = {
        id: 'template-new',
        ...mockRequest.body
      };

      mockTemplateService.createTemplate.mockResolvedValue(createdTemplate as any);

      await controller.createTemplate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        templateId: 'template-new',
        template: createdTemplate
      });
    });

    it('should validate required fields', async () => {
      mockRequest.body = {
        name: 'Custom Template'
        // Missing required fields
      };

      await controller.createTemplate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Missing required fields: name, templateType, layout, sections'
      });
    });
  });

  describe('GET /api/export/formats', () => {
    it('should return supported export formats', async () => {
      await controller.getExportFormats(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          formats: expect.arrayContaining([
            expect.objectContaining({
              format: 'pdf',
              name: 'PDF Document'
            }),
            expect.objectContaining({
              format: 'csv',
              name: 'CSV File'
            })
          ]),
          sortOptions: expect.any(Array),
          reportTypes: expect.any(Array),
          options: expect.any(Object)
        })
      );
    });
  });

  describe('GET /api/export/statistics', () => {
    it('should return export statistics', async () => {
      mockRequest.query = { sessionId: 'session-123' };

      const stats = {
        totalReports: 10,
        totalDownloads: 25,
        averageGenerationTime: 750,
        formatBreakdown: {
          pdf: 5,
          csv: 3,
          excel: 2,
          json: 0
        },
        typeBreakdown: {
          component_list: 6,
          parts_order: 2,
          technical_analysis: 1,
          project_summary: 1
        }
      };

      mockExportRepository.getReportStatistics.mockResolvedValue(stats as any);

      await controller.getExportStatistics(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockExportRepository.getReportStatistics).toHaveBeenCalledWith('session-123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(stats);
    });
  });
});