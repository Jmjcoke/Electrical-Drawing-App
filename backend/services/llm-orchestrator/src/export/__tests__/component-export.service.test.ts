/**
 * Component Export Service Tests
 * Tests for the core export functionality of Story 4.5
 */

import { ComponentExportService, ExportResult } from '../component-export.service';
import { ComponentRepository } from '../../repositories/component.repository';
import { SymbolDetectionRepository } from '../../repositories/symbol-detection.repository';
import { CrossPageReferenceRepository } from '../../repositories/cross-page-reference.repository';
import { ExportRepository } from '../../repositories/export.repository';
import { ReportGeneratorService } from '../report-generator.service';
import { TemplateService } from '../template.service';
import {
  ComponentExportRequest,
  ComponentReport,
  ComponentReportItem,
  ExportOptions
} from '../../../../shared/types/nlp.types';

// Mock all dependencies
jest.mock('../../repositories/component.repository');
jest.mock('../../repositories/symbol-detection.repository');
jest.mock('../../repositories/cross-page-reference.repository');
jest.mock('../../repositories/export.repository');
jest.mock('../report-generator.service');
jest.mock('../template.service');
jest.mock('fs/promises');

describe('ComponentExportService', () => {
  let service: ComponentExportService;
  let mockComponentRepository: jest.Mocked<ComponentRepository>;
  let mockSymbolRepository: jest.Mocked<SymbolDetectionRepository>;
  let mockCrossPageRepository: jest.Mocked<CrossPageReferenceRepository>;
  let mockExportRepository: jest.Mocked<ExportRepository>;
  let mockReportGenerator: jest.Mocked<ReportGeneratorService>;
  let mockTemplateService: jest.Mocked<TemplateService>;

  beforeEach(() => {
    // Create mock instances
    mockComponentRepository = new ComponentRepository(null as any) as jest.Mocked<ComponentRepository>;
    mockSymbolRepository = new SymbolDetectionRepository(null as any) as jest.Mocked<SymbolDetectionRepository>;
    mockCrossPageRepository = new CrossPageReferenceRepository(null as any) as jest.Mocked<CrossPageReferenceRepository>;
    mockExportRepository = new ExportRepository(null as any) as jest.Mocked<ExportRepository>;
    mockReportGenerator = new ReportGeneratorService() as jest.Mocked<ReportGeneratorService>;
    mockTemplateService = new TemplateService(mockExportRepository) as jest.Mocked<TemplateService>;

    // Initialize service with mocked dependencies
    service = new ComponentExportService(
      mockComponentRepository,
      mockSymbolRepository,
      mockCrossPageRepository,
      mockExportRepository,
      mockReportGenerator,
      mockTemplateService
    );
  });

  describe('exportComponents', () => {
    const mockRequest: ComponentExportRequest = {
      sessionId: 'test-session-123',
      documentIds: ['doc-1', 'doc-2'],
      exportFormat: 'pdf',
      includeReferences: true,
      includeVisualMap: false,
      templateId: 'template-123',
      customOptions: {
        includeTechnicalSpecs: true,
        includePartNumbers: false,
        includeConfidenceScores: false,
        groupByPage: false,
        sortBy: 'type'
      }
    };

    const mockSymbols = [
      {
        id: 'symbol-1',
        documentId: 'doc-1',
        pageNumber: 1,
        type: 'resistor',
        label: 'R1',
        confidence: 0.95,
        boundingBox: { x: 100, y: 200, width: 50, height: 30 },
        zone: 'A1'
      }
    ];

    const mockComponents = [
      {
        symbolId: 'symbol-1',
        description: '10k Ohm Resistor',
        specifications: {
          value: '10k',
          unit: 'Ohm',
          tolerance: '5%',
          rating: '0.25W'
        },
        partInformation: {
          partNumber: 'R10K-0.25W',
          manufacturer: 'Generic'
        }
      }
    ];

    const mockTemplate = {
      id: 'template-123',
      name: 'Standard PDF Template',
      templateType: 'component_list',
      layout: {
        orientation: 'portrait',
        pageSize: 'A4',
        margins: { top: 20, bottom: 20, left: 15, right: 15 },
        includePageNumbers: true,
        includeTOC: false
      }
    };

    it('should successfully export components to PDF', async () => {
      // Setup mocks
      mockSymbolRepository.getSymbolsBySession.mockResolvedValue(mockSymbols);
      mockComponentRepository.getComponentsBySession.mockResolvedValue(mockComponents);
      mockCrossPageRepository.getReferencesBySession.mockResolvedValue([]);
      mockTemplateService.getTemplate.mockResolvedValue(mockTemplate as any);
      mockExportRepository.saveReport.mockResolvedValue({
        id: 'report-123',
        sessionId: 'test-session-123'
      } as any);

      // Mock file system operations
      const fs = require('fs/promises');
      fs.stat.mockResolvedValue({ size: 1024 });
      fs.mkdir.mockResolvedValue(undefined);

      // Execute
      const result = await service.exportComponents(mockRequest);

      // Verify
      expect(result.success).toBe(true);
      expect(result.reportId).toBeDefined();
      expect(mockSymbolRepository.getSymbolsBySession).toHaveBeenCalledWith(
        'test-session-123',
        ['doc-1', 'doc-2']
      );
      expect(mockComponentRepository.getComponentsBySession).toHaveBeenCalledWith(
        'test-session-123',
        ['doc-1', 'doc-2']
      );
    });

    it('should handle export failure gracefully', async () => {
      // Setup mocks to throw error
      mockSymbolRepository.getSymbolsBySession.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Execute
      const result = await service.exportComponents(mockRequest);

      // Verify
      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(result.generationTime).toBeDefined();
    });

    it('should apply sorting options correctly', async () => {
      const components: ComponentReportItem[] = [
        {
          id: '1',
          type: 'capacitor',
          description: 'Cap 100uF',
          location: { pageNumber: 2, documentId: 'doc-1', coordinates: { x: 0, y: 100 } },
          confidence: 0.8
        } as any,
        {
          id: '2',
          type: 'resistor',
          description: 'Res 10k',
          location: { pageNumber: 1, documentId: 'doc-1', coordinates: { x: 0, y: 50 } },
          confidence: 0.95
        } as any,
        {
          id: '3',
          type: 'inductor',
          description: 'Ind 100mH',
          location: { pageNumber: 1, documentId: 'doc-1', coordinates: { x: 0, y: 200 } },
          confidence: 0.85
        } as any
      ];

      mockSymbolRepository.getSymbolsBySession.mockResolvedValue([]);
      mockComponentRepository.getComponentsBySession.mockResolvedValue([]);
      
      // Test sort by type
      const requestByType = { ...mockRequest, customOptions: { ...mockRequest.customOptions, sortBy: 'type' as any } };
      await service.exportComponents(requestByType);

      // Test sort by page
      const requestByPage = { ...mockRequest, customOptions: { ...mockRequest.customOptions, sortBy: 'page' as any } };
      await service.exportComponents(requestByPage);

      // Test sort by confidence
      const requestByConfidence = { ...mockRequest, customOptions: { ...mockRequest.customOptions, sortBy: 'confidence' as any } };
      await service.exportComponents(requestByConfidence);

      expect(mockExportRepository.saveReport).toHaveBeenCalled();
    });
  });

  describe('generatePreview', () => {
    it('should generate preview without creating file', async () => {
      const mockRequest: ComponentExportRequest = {
        sessionId: 'test-session-123',
        exportFormat: 'csv',
        includeReferences: false,
        includeVisualMap: false,
        customOptions: {
          includeTechnicalSpecs: true,
          includePartNumbers: false,
          includeConfidenceScores: false,
          groupByPage: false,
          sortBy: 'type'
        }
      };

      const mockSymbols = Array(20).fill(null).map((_, i) => ({
        id: `symbol-${i}`,
        type: 'resistor',
        confidence: 0.9
      }));

      mockSymbolRepository.getSymbolsBySession.mockResolvedValue(mockSymbols);
      mockComponentRepository.getComponentsBySession.mockResolvedValue([]);

      const preview = await service.generatePreview(mockRequest);

      expect(preview.componentCount).toBe(20);
      expect(preview.components.length).toBe(10); // Preview returns first 10
      expect(preview.estimatedSize).toBeGreaterThan(0);
    });
  });

  describe('downloadReport', () => {
    it('should return download information for existing report', async () => {
      mockExportRepository.getReport.mockResolvedValue({
        id: 'report-123',
        filePath: '/tmp/exports/report.pdf',
        exportFormat: 'pdf'
      } as any);

      mockExportRepository.incrementDownloadCount.mockResolvedValue(undefined);

      const result = await service.downloadReport('report-123');

      expect(result).not.toBeNull();
      expect(result?.fileName).toBe('report.pdf');
      expect(result?.mimeType).toBe('application/pdf');
      expect(mockExportRepository.incrementDownloadCount).toHaveBeenCalledWith('report-123');
    });

    it('should return null for non-existent report', async () => {
      mockExportRepository.getReport.mockResolvedValue(null);

      const result = await service.downloadReport('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('cleanupExpiredReports', () => {
    it('should delete expired report files', async () => {
      const expiredReports = [
        { id: 'report-1', filePath: '/tmp/report1.pdf' },
        { id: 'report-2', filePath: '/tmp/report2.csv' }
      ];

      mockExportRepository.getExpiredReports.mockResolvedValue(expiredReports as any);
      mockExportRepository.deleteReport.mockResolvedValue(undefined);

      const fs = require('fs/promises');
      fs.unlink.mockResolvedValue(undefined);

      const deletedCount = await service.cleanupExpiredReports();

      expect(deletedCount).toBe(2);
      expect(fs.unlink).toHaveBeenCalledTimes(2);
      expect(mockExportRepository.deleteReport).toHaveBeenCalledTimes(2);
    });

    it('should handle file deletion errors gracefully', async () => {
      const expiredReports = [
        { id: 'report-1', filePath: '/tmp/report1.pdf' }
      ];

      mockExportRepository.getExpiredReports.mockResolvedValue(expiredReports as any);

      const fs = require('fs/promises');
      fs.unlink.mockRejectedValue(new Error('File not found'));

      const deletedCount = await service.cleanupExpiredReports();

      expect(deletedCount).toBe(0);
    });
  });
});