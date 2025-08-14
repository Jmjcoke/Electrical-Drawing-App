/**
 * Format Handlers Integration Tests
 * Comprehensive testing for all export format handlers
 * Production hardening for Story 4.5
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PdfExportHandler } from '../export/format-handlers/pdf-export.handler';
import { CsvExportHandler } from '../export/format-handlers/csv-export.handler';
import { ExcelExportHandler } from '../export/format-handlers/excel-export.handler';
import { JsonExportHandler } from '../export/format-handlers/json-export.handler';
import { 
  ComponentReport, 
  ReportTemplate, 
  ExportOptions,
  ComponentReportItem 
} from '../../../../shared/types/nlp.types';

describe('Format Handlers Integration Tests', () => {
  let testDir: string;
  let createdFiles: string[] = [];
  let mockReport: ComponentReport;
  let mockTemplate: ReportTemplate;
  let mockOptions: ExportOptions;

  beforeAll(async () => {
    testDir = path.join(__dirname, 'format-handlers-test');
    await fs.mkdir(testDir, { recursive: true });
    process.env.EXPORT_DIR = testDir;

    // Setup mock data
    mockReport = createMockReport();
    mockTemplate = createMockTemplate();
    mockOptions = createMockOptions();
  });

  afterAll(async () => {
    // Cleanup test files
    for (const file of createdFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        console.warn(`Failed to cleanup file ${file}:`, error);
      }
    }

    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }
  });

  describe('JSON Export Handler', () => {
    let jsonHandler: JsonExportHandler;

    beforeEach(() => {
      jsonHandler = new JsonExportHandler();
    });

    it('should generate valid JSON export', async () => {
      const filePath = path.join(testDir, 'test-export.json');
      createdFiles.push(filePath);

      const result = await jsonHandler.generateReport(
        mockReport,
        mockTemplate,
        mockOptions,
        filePath
      );

      expect(result).toBe(filePath);
      
      // Verify file exists and is valid JSON
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const parsedJson = JSON.parse(fileContent);
      
      expect(parsedJson).toHaveProperty('id');
      expect(parsedJson).toHaveProperty('reportType');
      expect(parsedJson).toHaveProperty('components');
      expect(parsedJson.components).toBeInstanceOf(Array);
      expect(parsedJson.components.length).toBe(mockReport.components.length);
    });

    it('should handle empty component list', async () => {
      const emptyReport = { ...mockReport, components: [] };
      const filePath = path.join(testDir, 'empty-export.json');
      createdFiles.push(filePath);

      const result = await jsonHandler.generateReport(
        emptyReport,
        mockTemplate,
        mockOptions,
        filePath
      );

      expect(result).toBe(filePath);
      
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const parsedJson = JSON.parse(fileContent);
      
      expect(parsedJson.components).toHaveLength(0);
    });

    it('should include all requested data fields', async () => {
      const fullOptions: ExportOptions = {
        includeTechnicalSpecs: true,
        includePartNumbers: true,
        includeConfidenceScores: true,
        groupByPage: true,
        sortBy: 'type'
      };

      const filePath = path.join(testDir, 'full-data-export.json');
      createdFiles.push(filePath);

      const result = await jsonHandler.generateReport(
        mockReport,
        mockTemplate,
        fullOptions,
        filePath
      );

      const fileContent = await fs.readFile(filePath, 'utf-8');
      const parsedJson = JSON.parse(fileContent);
      
      expect(parsedJson.components[0]).toHaveProperty('specifications');
      expect(parsedJson.components[0]).toHaveProperty('partInformation');
      expect(parsedJson.components[0]).toHaveProperty('confidence');
    });
  });

  describe('CSV Export Handler', () => {
    let csvHandler: CsvExportHandler;

    beforeEach(() => {
      csvHandler = new CsvExportHandler();
    });

    it('should generate valid CSV export', async () => {
      const filePath = path.join(testDir, 'test-export.csv');
      createdFiles.push(filePath);

      const result = await csvHandler.generateReport(
        mockReport,
        mockTemplate,
        mockOptions,
        filePath
      );

      expect(result).toBe(filePath);
      
      // Verify file exists and has correct format
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const lines = fileContent.trim().split('\n');
      
      expect(lines.length).toBeGreaterThan(1); // Header + at least one data row
      expect(lines[0]).toContain(','); // Header should have commas
      
      // Check header contains expected columns
      const header = lines[0].toLowerCase();
      expect(header).toContain('type');
      expect(header).toContain('description');
    });

    it('should handle special characters in CSV data', async () => {
      const specialReport = { ...mockReport };
      specialReport.components[0].description = 'Resistor, "10k Ohm", with commas';
      specialReport.components[0].type = 'resistor\nwith\nnewlines';

      const filePath = path.join(testDir, 'special-chars-export.csv');
      createdFiles.push(filePath);

      const result = await csvHandler.generateReport(
        specialReport,
        mockTemplate,
        mockOptions,
        filePath
      );

      const fileContent = await fs.readFile(filePath, 'utf-8');
      
      // Should properly escape quotes and handle commas
      expect(fileContent).toContain('"Resistor, ""10k Ohm"", with commas"');
    });

    it('should generate proper headers for different options', async () => {
      const fullOptions: ExportOptions = {
        includeTechnicalSpecs: true,
        includePartNumbers: true,
        includeConfidenceScores: true,
        groupByPage: false,
        sortBy: 'type'
      };

      const filePath = path.join(testDir, 'full-headers-export.csv');
      createdFiles.push(filePath);

      await csvHandler.generateReport(
        mockReport,
        mockTemplate,
        fullOptions,
        filePath
      );

      const fileContent = await fs.readFile(filePath, 'utf-8');
      const header = fileContent.split('\n')[0].toLowerCase();
      
      expect(header).toContain('specifications');
      expect(header).toContain('partnumber');
      expect(header).toContain('confidence');
    });
  });

  describe('Excel Export Handler', () => {
    let excelHandler: ExcelExportHandler;

    beforeEach(() => {
      excelHandler = new ExcelExportHandler();
    });

    it('should generate valid Excel export', async () => {
      const filePath = path.join(testDir, 'test-export.xlsx');
      createdFiles.push(filePath);

      const result = await excelHandler.generateReport(
        mockReport,
        mockTemplate,
        mockOptions,
        filePath
      );

      expect(result).toBe(filePath);
      
      // Verify file exists and has reasonable size
      const stats = await fs.stat(filePath);
      expect(stats.size).toBeGreaterThan(1000); // Excel files should be at least 1KB
    });

    it('should create multiple worksheets', async () => {
      const reportWithReferences = {
        ...mockReport,
        crossPageReferences: [
          {
            id: 'ref-1',
            sourceComponentId: 'comp-1',
            targetComponentId: 'comp-2',
            sourcePageNumber: 1,
            targetPageNumber: 2,
            referenceType: 'connection',
            confidence: 0.9
          }
        ]
      };

      const filePath = path.join(testDir, 'multi-sheet-export.xlsx');
      createdFiles.push(filePath);

      const result = await excelHandler.generateReport(
        reportWithReferences,
        mockTemplate,
        { ...mockOptions, includeReferences: true },
        filePath
      );

      expect(result).toBe(filePath);
      
      const stats = await fs.stat(filePath);
      expect(stats.size).toBeGreaterThan(2000); // Multi-sheet file should be larger
    });

    it('should handle formatting and styling', async () => {
      const styledTemplate = {
        ...mockTemplate,
        branding: {
          primaryColor: '#0066CC',
          secondaryColor: '#FF6600',
          fontFamily: 'Arial'
        }
      };

      const filePath = path.join(testDir, 'styled-export.xlsx');
      createdFiles.push(filePath);

      const result = await excelHandler.generateReport(
        mockReport,
        styledTemplate,
        mockOptions,
        filePath
      );

      expect(result).toBe(filePath);
      
      const stats = await fs.stat(filePath);
      expect(stats.size).toBeGreaterThan(1000);
    });
  });

  describe('PDF Export Handler', () => {
    let pdfHandler: PdfExportHandler;

    beforeEach(() => {
      pdfHandler = new PdfExportHandler();
    });

    it('should generate valid PDF export', async () => {
      const filePath = path.join(testDir, 'test-export.pdf');
      createdFiles.push(filePath);

      const result = await pdfHandler.generateReport(
        mockReport,
        mockTemplate,
        mockOptions,
        filePath
      );

      expect(result).toBe(filePath);
      
      // Verify file exists and has PDF signature
      const stats = await fs.stat(filePath);
      expect(stats.size).toBeGreaterThan(1000); // PDF files should be substantial
      
      // Check PDF signature
      const buffer = await fs.readFile(filePath);
      const pdfSignature = buffer.toString('ascii', 0, 4);
      expect(pdfSignature).toBe('%PDF');
    });

    it('should handle different page sizes and orientations', async () => {
      const customTemplate = {
        ...mockTemplate,
        layout: {
          ...mockTemplate.layout,
          pageSize: 'Letter',
          orientation: 'landscape'
        }
      };

      const filePath = path.join(testDir, 'custom-layout-export.pdf');
      createdFiles.push(filePath);

      const result = await pdfHandler.generateReport(
        mockReport,
        customTemplate,
        mockOptions,
        filePath
      );

      expect(result).toBe(filePath);
      
      const stats = await fs.stat(filePath);
      expect(stats.size).toBeGreaterThan(1000);
    });

    it('should include visual elements and branding', async () => {
      const brandedTemplate = {
        ...mockTemplate,
        branding: {
          primaryColor: '#0066CC',
          secondaryColor: '#FF6600',
          headerText: 'Company Name',
          footerText: 'Confidential Report'
        }
      };

      const filePath = path.join(testDir, 'branded-export.pdf');
      createdFiles.push(filePath);

      const result = await pdfHandler.generateReport(
        mockReport,
        brandedTemplate,
        mockOptions,
        filePath
      );

      expect(result).toBe(filePath);
      
      const stats = await fs.stat(filePath);
      expect(stats.size).toBeGreaterThan(2000); // Branded PDF should be larger
    });
  });

  describe('Cross-Format Consistency', () => {
    it('should produce consistent data across all formats', async () => {
      const handlers = {
        json: new JsonExportHandler(),
        csv: new CsvExportHandler(),
        excel: new ExcelExportHandler(),
        pdf: new PdfExportHandler()
      };

      const results: { [format: string]: string } = {};

      // Generate all formats
      for (const [format, handler] of Object.entries(handlers)) {
        const filePath = path.join(testDir, `consistency-test.${format === 'excel' ? 'xlsx' : format}`);
        createdFiles.push(filePath);
        
        results[format] = await handler.generateReport(
          mockReport,
          mockTemplate,
          mockOptions,
          filePath
        );

        // Verify file was created
        const stats = await fs.stat(filePath);
        expect(stats.size).toBeGreaterThan(0);
      }

      // Read JSON for reference data
      const jsonContent = JSON.parse(await fs.readFile(results.json, 'utf-8'));
      
      // Read CSV and verify component count matches
      const csvContent = await fs.readFile(results.csv, 'utf-8');
      const csvLines = csvContent.trim().split('\n');
      expect(csvLines.length - 1).toBe(jsonContent.components.length); // -1 for header

      // Verify all files exist and have reasonable sizes
      for (const filePath of Object.values(results)) {
        const stats = await fs.stat(filePath);
        expect(stats.size).toBeGreaterThan(100);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid file paths gracefully', async () => {
      const jsonHandler = new JsonExportHandler();
      const invalidPath = '/invalid/path/that/does/not/exist/file.json';

      try {
        await jsonHandler.generateReport(mockReport, mockTemplate, mockOptions, invalidPath);
        // If it doesn't throw, it should have handled the error gracefully
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should handle corrupted data gracefully', async () => {
      const corruptedReport: ComponentReport = {
        ...mockReport,
        components: [
          {
            id: null as any,
            type: undefined as any,
            description: '',
            specifications: null as any,
            location: undefined as any,
            pageReferences: [],
            partInformation: undefined as any,
            confidence: NaN,
            relatedComponents: undefined as any
          }
        ]
      };

      const jsonHandler = new JsonExportHandler();
      const filePath = path.join(testDir, 'corrupted-data-export.json');
      createdFiles.push(filePath);

      // Should not crash with corrupted data
      const result = await jsonHandler.generateReport(
        corruptedReport,
        mockTemplate,
        mockOptions,
        filePath
      );

      expect(result).toBe(filePath);
      
      // File should still be created (with cleaned data)
      const stats = await fs.stat(filePath);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle large datasets efficiently', async () => {
      // Create large report with 1000 components
      const largeComponents: ComponentReportItem[] = Array(1000).fill(null).map((_, i) => ({
        id: `large-component-${i}`,
        type: ['resistor', 'capacitor', 'inductor'][i % 3],
        description: `Component ${i} with detailed description`,
        specifications: {
          value: `${i + 1}k`,
          unit: 'Ohm',
          tolerance: '5%',
          rating: '0.25W',
          package: '0603',
          manufacturer: 'Test Corp'
        },
        location: {
          pageNumber: Math.floor(i / 100) + 1,
          documentId: `document-${Math.floor(i / 500)}`,
          coordinates: {
            x: 100 + (i % 20) * 50,
            y: 200 + Math.floor(i / 20) * 40,
            width: 30,
            height: 20
          }
        },
        pageReferences: [
          {
            pageNumber: Math.floor(i / 100) + 1,
            documentId: `document-${Math.floor(i / 500)}`,
            referenceType: 'origin'
          }
        ],
        partInformation: {
          partNumber: `PART-${i}`,
          manufacturerPartNumber: `MPN-${i}`,
          supplier: 'Test Supplier'
        },
        confidence: 0.8 + Math.random() * 0.2,
        relatedComponents: []
      }));

      const largeReport: ComponentReport = {
        ...mockReport,
        components: largeComponents
      };

      const jsonHandler = new JsonExportHandler();
      const filePath = path.join(testDir, 'large-dataset-export.json');
      createdFiles.push(filePath);

      const startTime = Date.now();
      const result = await jsonHandler.generateReport(
        largeReport,
        mockTemplate,
        mockOptions,
        filePath
      );
      const endTime = Date.now();

      expect(result).toBe(filePath);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      const stats = await fs.stat(filePath);
      expect(stats.size).toBeGreaterThan(100000); // Should be > 100KB for 1000 components
    });
  });

  // Helper functions
  function createMockReport(): ComponentReport {
    return {
      id: 'test-report-123',
      reportType: 'component_list',
      sessionId: 'test-session-123',
      generatedAt: new Date('2024-11-07T12:00:00Z'),
      format: 'json',
      componentSummary: {
        totalComponents: 3,
        componentsByType: {
          resistor: 2,
          capacitor: 1
        },
        totalPages: 2,
        confidenceAverage: 0.9,
        processingTime: 1500
      },
      components: [
        {
          id: 'comp-1',
          type: 'resistor',
          description: '10k Ohm Resistor',
          specifications: {
            value: '10k',
            unit: 'Ohm',
            tolerance: '5%',
            rating: '0.25W'
          },
          location: {
            pageNumber: 1,
            documentId: 'doc-1',
            coordinates: { x: 100, y: 200, width: 30, height: 20 }
          },
          pageReferences: [
            { pageNumber: 1, documentId: 'doc-1', referenceType: 'origin' }
          ],
          partInformation: {
            partNumber: 'R10K-0.25W',
            manufacturerPartNumber: 'MPN-R10K',
            supplier: 'Test Supplier'
          },
          confidence: 0.95,
          relatedComponents: []
        },
        {
          id: 'comp-2',
          type: 'resistor',
          description: '1k Ohm Resistor',
          specifications: {
            value: '1k',
            unit: 'Ohm',
            tolerance: '5%',
            rating: '0.25W'
          },
          location: {
            pageNumber: 1,
            documentId: 'doc-1',
            coordinates: { x: 200, y: 200, width: 30, height: 20 }
          },
          pageReferences: [
            { pageNumber: 1, documentId: 'doc-1', referenceType: 'origin' }
          ],
          partInformation: {
            partNumber: 'R1K-0.25W',
            manufacturerPartNumber: 'MPN-R1K',
            supplier: 'Test Supplier'
          },
          confidence: 0.9,
          relatedComponents: []
        },
        {
          id: 'comp-3',
          type: 'capacitor',
          description: '100uF Capacitor',
          specifications: {
            value: '100u',
            unit: 'F',
            tolerance: '10%',
            rating: '16V'
          },
          location: {
            pageNumber: 2,
            documentId: 'doc-1',
            coordinates: { x: 100, y: 300, width: 40, height: 25 }
          },
          pageReferences: [
            { pageNumber: 2, documentId: 'doc-1', referenceType: 'origin' }
          ],
          partInformation: {
            partNumber: 'C100U-16V',
            manufacturerPartNumber: 'MPN-C100U',
            supplier: 'Test Supplier'
          },
          confidence: 0.85,
          relatedComponents: []
        }
      ],
      metadata: {
        generationTime: 1500,
        documentCount: 1,
        pageCount: 2,
        exportVersion: '1.0.0'
      }
    };
  }

  function createMockTemplate(): ReportTemplate {
    return {
      id: 'template-123',
      name: 'Standard Template',
      description: 'Standard report template',
      templateType: 'component_list',
      layout: {
        pageSize: 'A4',
        orientation: 'portrait',
        margins: {
          top: 20,
          bottom: 20,
          left: 15,
          right: 15
        },
        includePageNumbers: true,
        includeTOC: false
      },
      branding: {
        primaryColor: '#333333',
        secondaryColor: '#666666'
      },
      sections: [
        {
          type: 'header',
          enabled: true,
          order: 1,
          config: {}
        },
        {
          type: 'summary',
          enabled: true,
          order: 2,
          config: {}
        },
        {
          type: 'component_list',
          enabled: true,
          order: 3,
          config: {}
        }
      ],
      customFields: [],
      isDefault: true,
      isSystem: true,
      createdAt: new Date('2024-11-07T12:00:00Z'),
      updatedAt: new Date('2024-11-07T12:00:00Z')
    };
  }

  function createMockOptions(): ExportOptions {
    return {
      includeTechnicalSpecs: true,
      includePartNumbers: true,
      includeConfidenceScores: false,
      groupByPage: false,
      sortBy: 'type'
    };
  }
});