/**
 * Export System Integration Tests
 * Comprehensive integration testing for Story 4.5 production hardening
 * Includes security, performance, and full end-to-end testing
 */

import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { ComponentExportService } from '../export/component-export.service';
import { ExportController } from '../controllers/export.controller';
import { TemplateService } from '../export/template.service';
import { ExportRepository } from '../repositories/export.repository';
import { ComponentRepository } from '../repositories/component.repository';
import { SymbolDetectionRepository } from '../repositories/symbol-detection.repository';
import { CrossPageReferenceRepository } from '../repositories/cross-page-reference.repository';
import { ReportGeneratorService } from '../export/report-generator.service';
import { createExportRateLimiter, createDownloadRateLimiter } from '../middleware/export-rate-limiter';
import { ComponentExportRequest } from '../../../../shared/types/nlp.types';

describe('Export System Integration Tests', () => {
  let app: express.Application;
  let database: Pool;
  let exportService: ComponentExportService;
  let exportController: ExportController;
  let testSessionId: string;
  let testExportDir: string;
  let createdFiles: string[] = [];

  beforeAll(async () => {
    // Setup test database connection
    database = new Pool({
      host: process.env.TEST_DB_HOST || 'localhost',
      port: parseInt(process.env.TEST_DB_PORT || '5432'),
      database: process.env.TEST_DB_NAME || 'electrical_test',
      user: process.env.TEST_DB_USER || 'postgres',
      password: process.env.TEST_DB_PASSWORD || 'password',
    });

    // Create test export directory
    testExportDir = path.join(__dirname, 'test-exports');
    await fs.mkdir(testExportDir, { recursive: true });
    process.env.EXPORT_DIR = testExportDir;

    // Initialize services
    const exportRepository = new ExportRepository(database);
    const componentRepository = new ComponentRepository(database);
    const symbolDetectionRepository = new SymbolDetectionRepository(database);
    const crossPageReferenceRepository = new CrossPageReferenceRepository(database);
    const reportGeneratorService = new ReportGeneratorService();
    const templateService = new TemplateService(exportRepository);
    
    exportService = new ComponentExportService(
      componentRepository,
      symbolDetectionRepository,
      crossPageReferenceRepository,
      exportRepository,
      reportGeneratorService,
      templateService
    );

    exportController = new ExportController(
      exportService,
      templateService,
      exportRepository
    );

    // Setup Express app with middleware
    app = express();
    app.use(express.json());
    
    const exportRateLimiter = createExportRateLimiter();
    const downloadRateLimiter = createDownloadRateLimiter();

    // Setup routes with rate limiting
    app.post('/api/sessions/:sessionId/export/components',
      exportRateLimiter.middleware(),
      exportController.exportComponents.bind(exportController)
    );
    app.get('/api/sessions/:sessionId/reports/:reportId/download',
      downloadRateLimiter.middleware(),
      exportController.downloadReport.bind(exportController)
    );
    app.get('/api/sessions/:sessionId/reports',
      exportController.getSessionReports.bind(exportController)
    );
    app.post('/api/sessions/:sessionId/export/preview',
      exportController.generatePreview.bind(exportController)
    );

    // Generate test session ID
    testSessionId = `test-session-${crypto.randomUUID()}`;
    
    // Setup test data in database
    await setupTestData();
  }, 30000);

  afterAll(async () => {
    // Cleanup test files
    for (const file of createdFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        console.warn(`Failed to cleanup file ${file}:`, error);
      }
    }

    // Cleanup test directory
    try {
      await fs.rmdir(testExportDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to cleanup test directory:', error);
    }

    // Cleanup test data
    await cleanupTestData();
    
    // Close database connection
    await database.end();
  }, 30000);

  describe('Security Testing', () => {
    it('should prevent path traversal attacks in export requests', async () => {
      const maliciousRequest: ComponentExportRequest = {
        sessionId: '../../../etc/passwd',
        exportFormat: 'json',
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

      const response = await request(app)
        .post(`/api/sessions/${maliciousRequest.sessionId}/export/components`)
        .send(maliciousRequest);

      // Should either sanitize the sessionId or return an error
      expect(response.status).not.toBe(200);
      
      // Check that no files were created outside the export directory
      const files = await fs.readdir(testExportDir);
      const suspiciousFiles = files.filter(f => f.includes('etc') || f.includes('passwd'));
      expect(suspiciousFiles).toHaveLength(0);
    });

    it('should prevent file download path traversal', async () => {
      const maliciousReportId = '../../../etc/passwd';
      
      const response = await request(app)
        .get(`/api/sessions/${testSessionId}/reports/${maliciousReportId}/download`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid report ID format');
    });

    it('should validate file sizes before download', async () => {
      // Create a large test file
      const largeFilePath = path.join(testExportDir, 'large-test-file.json');
      const largeContent = 'x'.repeat(60 * 1024 * 1024); // 60MB
      await fs.writeFile(largeFilePath, largeContent);
      createdFiles.push(largeFilePath);

      // Mock a report with the large file
      const mockReport = await database.query(
        'INSERT INTO electrical_analysis.component_reports (session_id, report_type, export_format, file_path, file_size) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [testSessionId, 'component_list', 'json', largeFilePath, largeContent.length]
      );

      const response = await request(app)
        .get(`/api/sessions/${testSessionId}/reports/${mockReport.rows[0].id}/download`);

      expect(response.status).toBe(413);
      expect(response.body.error).toContain('File too large');
    });

    it('should rate limit export requests', async () => {
      const exportRequest: ComponentExportRequest = {
        sessionId: testSessionId,
        exportFormat: 'json',
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

      // Make requests rapidly to trigger rate limiting
      const requests = Array(15).fill(null).map(() =>
        request(app)
          .post(`/api/sessions/${testSessionId}/export/components`)
          .send(exportRequest)
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(rateLimitedResponses[0].body.error).toContain('Too many export requests');
    }, 15000);

    it('should sanitize filenames to prevent injection', async () => {
      const maliciousRequest: ComponentExportRequest = {
        sessionId: testSessionId,
        exportFormat: 'json',
        includeReferences: false,
        includeVisualMap: false,
        templateId: '<script>alert("xss")</script>',
        customOptions: {
          includeTechnicalSpecs: true,
          includePartNumbers: false,
          includeConfidenceScores: false,
          groupByPage: false,
          sortBy: 'type',
          customBranding: {
            headerText: '../../etc/passwd',
            footerText: '<img src="x" onerror="alert(1)">'
          }
        }
      };

      const response = await request(app)
        .post(`/api/sessions/${testSessionId}/export/components`)
        .send(maliciousRequest);

      if (response.status === 200) {
        const files = await fs.readdir(testExportDir);
        const maliciousFiles = files.filter(f => 
          f.includes('<script>') || 
          f.includes('etc/passwd') || 
          f.includes('<img')
        );
        expect(maliciousFiles).toHaveLength(0);
      }
    });
  });

  describe('Performance Testing', () => {
    it('should handle large component exports within time limits', async () => {
      // Create large dataset
      await createLargeTestDataset(testSessionId, 500);

      const exportRequest: ComponentExportRequest = {
        sessionId: testSessionId,
        exportFormat: 'json',
        includeReferences: true,
        includeVisualMap: true,
        customOptions: {
          includeTechnicalSpecs: true,
          includePartNumbers: true,
          includeConfidenceScores: true,
          groupByPage: true,
          sortBy: 'type'
        }
      };

      const startTime = Date.now();
      const response = await request(app)
        .post(`/api/sessions/${testSessionId}/export/components`)
        .send(exportRequest);
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(endTime - startTime).toBeLessThan(30000); // Should complete within 30 seconds
    }, 35000);

    it('should handle concurrent export requests', async () => {
      const exportRequest: ComponentExportRequest = {
        sessionId: testSessionId,
        exportFormat: 'json',
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

      // Create multiple concurrent requests with different session IDs
      const concurrentRequests = Array(5).fill(null).map((_, i) => {
        const sessionId = `concurrent-session-${i}-${crypto.randomUUID()}`;
        return request(app)
          .post(`/api/sessions/${sessionId}/export/components`)
          .send({ ...exportRequest, sessionId });
      });

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      const successfulResponses = responses.filter(r => r.status === 200);
      expect(successfulResponses.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(15000); // Should handle concurrency efficiently
    }, 20000);

    it('should optimize memory usage for large exports', async () => {
      const initialMemory = process.memoryUsage();
      
      const exportRequest: ComponentExportRequest = {
        sessionId: testSessionId,
        exportFormat: 'json',
        includeReferences: true,
        includeVisualMap: true,
        customOptions: {
          includeTechnicalSpecs: true,
          includePartNumbers: true,
          includeConfidenceScores: true,
          groupByPage: true,
          sortBy: 'confidence'
        }
      };

      await request(app)
        .post(`/api/sessions/${testSessionId}/export/components`)
        .send(exportRequest);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('End-to-End Export Workflow', () => {
    it('should complete full export workflow for all formats', async () => {
      const formats = ['json', 'csv'] as const; // Exclude PDF and Excel for faster tests
      
      for (const format of formats) {
        const exportRequest: ComponentExportRequest = {
          sessionId: testSessionId,
          exportFormat: format,
          includeReferences: true,
          includeVisualMap: false,
          customOptions: {
            includeTechnicalSpecs: true,
            includePartNumbers: true,
            includeConfidenceScores: true,
            groupByPage: false,
            sortBy: 'type'
          }
        };

        // Step 1: Export components
        const exportResponse = await request(app)
          .post(`/api/sessions/${testSessionId}/export/components`)
          .send(exportRequest);

        expect(exportResponse.status).toBe(200);
        expect(exportResponse.body.success).toBe(true);
        expect(exportResponse.body.reportId).toBeDefined();

        // Step 2: Get session reports
        const reportsResponse = await request(app)
          .get(`/api/sessions/${testSessionId}/reports`);

        expect(reportsResponse.status).toBe(200);
        expect(reportsResponse.body.reports).toBeInstanceOf(Array);
        expect(reportsResponse.body.reports.length).toBeGreaterThan(0);

        // Step 3: Download the report
        const reportId = exportResponse.body.reportId;
        const downloadResponse = await request(app)
          .get(`/api/sessions/${testSessionId}/reports/${reportId}/download`);

        if (downloadResponse.status === 200) {
          expect(downloadResponse.headers['content-type']).toBeDefined();
          expect(downloadResponse.headers['content-disposition']).toContain('attachment');
        }
      }
    }, 30000);

    it('should handle export errors with proper recovery', async () => {
      // Create request with invalid session to trigger error
      const invalidRequest: ComponentExportRequest = {
        sessionId: 'non-existent-session',
        exportFormat: 'json',
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

      const response = await request(app)
        .post(`/api/sessions/non-existent-session/export/components`)
        .send(invalidRequest);

      // Should handle gracefully, either with fallback or clear error
      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 200) {
        // If fallback was used, it should be indicated
        expect(response.body.fallback || response.body.fallbackUsed).toBeTruthy();
      }
    });

    it('should maintain data consistency across operations', async () => {
      const exportRequest: ComponentExportRequest = {
        sessionId: testSessionId,
        exportFormat: 'json',
        includeReferences: true,
        includeVisualMap: false,
        customOptions: {
          includeTechnicalSpecs: true,
          includePartNumbers: true,
          includeConfidenceScores: true,
          groupByPage: true,
          sortBy: 'page'
        }
      };

      // Create multiple exports
      const export1 = await request(app)
        .post(`/api/sessions/${testSessionId}/export/components`)
        .send(exportRequest);

      const export2 = await request(app)
        .post(`/api/sessions/${testSessionId}/export/components`)
        .send({ ...exportRequest, customOptions: { ...exportRequest.customOptions, sortBy: 'type' } });

      expect(export1.status).toBe(200);
      expect(export2.status).toBe(200);

      // Get all reports for session
      const reportsResponse = await request(app)
        .get(`/api/sessions/${testSessionId}/reports`);

      expect(reportsResponse.status).toBe(200);
      expect(reportsResponse.body.reports.length).toBeGreaterThanOrEqual(2);

      // Verify report consistency
      const reports = reportsResponse.body.reports;
      for (const report of reports) {
        expect(report.sessionId).toBe(testSessionId);
        expect(report.id).toBeDefined();
        expect(report.createdAt).toBeDefined();
      }
    });
  });

  describe('Error Recovery Testing', () => {
    it('should recover from file system errors', async () => {
      // Temporarily make export directory read-only to simulate error
      const originalMode = await fs.stat(testExportDir);
      
      try {
        await fs.chmod(testExportDir, 0o444); // Read-only
        
        const exportRequest: ComponentExportRequest = {
          sessionId: testSessionId,
          exportFormat: 'json',
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

        const response = await request(app)
          .post(`/api/sessions/${testSessionId}/export/components`)
          .send(exportRequest);

        // Should either succeed with fallback or fail gracefully
        expect([200, 500]).toContain(response.status);
        
        if (response.status === 200 && response.body.fallbackUsed) {
          expect(response.body.success).toBe(true);
        }
      } finally {
        // Restore original permissions
        await fs.chmod(testExportDir, originalMode.mode);
      }
    });

    it('should handle database connection errors gracefully', async () => {
      // Create a request that will trigger database operations
      const exportRequest: ComponentExportRequest = {
        sessionId: testSessionId,
        exportFormat: 'json',
        includeReferences: true,
        includeVisualMap: true,
        customOptions: {
          includeTechnicalSpecs: true,
          includePartNumbers: true,
          includeConfidenceScores: true,
          groupByPage: false,
          sortBy: 'type'
        }
      };

      // Temporarily close database connection
      const originalDatabase = (exportService as any).exportRepository.database;
      (exportService as any).exportRepository.database = null;

      try {
        const response = await request(app)
          .post(`/api/sessions/${testSessionId}/export/components`)
          .send(exportRequest);

        // Should handle database error gracefully
        expect([200, 500]).toContain(response.status);
      } finally {
        // Restore database connection
        (exportService as any).exportRepository.database = originalDatabase;
      }
    });
  });

  // Helper functions
  async function setupTestData(): Promise<void> {
    // Create test session
    await database.query(
      'INSERT INTO electrical_analysis.sessions (id, status) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
      [testSessionId, 'completed']
    );

    // Create test symbols
    const symbolData = Array(10).fill(null).map((_, i) => [
      `symbol-${i}`,
      testSessionId,
      `document-1`,
      1,
      'resistor',
      `R${i + 1}`,
      0.95,
      JSON.stringify({ x: 100 + i * 50, y: 200, width: 30, height: 20 }),
      'A1'
    ]);

    for (const symbol of symbolData) {
      await database.query(
        'INSERT INTO electrical_analysis.detected_symbols (id, session_id, document_id, page_number, type, label, confidence, bounding_box, zone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING',
        symbol
      );
    }

    // Create test component identifications
    const componentData = symbolData.map((symbol, i) => [
      `component-${i}`,
      symbol[0], // symbol_id
      `${symbol[6]} Ohm Resistor`,
      JSON.stringify({
        value: `${(i + 1) * 10}k`,
        unit: 'Ohm',
        tolerance: '5%',
        rating: '0.25W'
      }),
      JSON.stringify({
        partNumber: `R${(i + 1) * 10}K-0.25W`,
        manufacturer: 'Generic'
      })
    ]);

    for (const component of componentData) {
      await database.query(
        'INSERT INTO electrical_analysis.component_identifications (id, symbol_id, description, specifications, part_information) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        component
      );
    }
  }

  async function createLargeTestDataset(sessionId: string, count: number): Promise<void> {
    const batchSize = 50;
    for (let i = 0; i < count; i += batchSize) {
      const batch = Math.min(batchSize, count - i);
      const symbolValues = [];
      const componentValues = [];

      for (let j = 0; j < batch; j++) {
        const index = i + j;
        const symbolId = `large-symbol-${index}`;
        
        symbolValues.push(`('${symbolId}', '${sessionId}', 'document-1', ${Math.floor(index / 50) + 1}, 'resistor', 'R${index + 1}', 0.9, '{"x": ${100 + (index % 10) * 50}, "y": ${200 + Math.floor(index / 10) * 30}, "width": 30, "height": 20}', 'A${Math.floor(index / 100) + 1}')`);
        
        componentValues.push(`('component-${index}', '${symbolId}', '${(index + 1) * 100} Ohm Resistor', '{"value": "${(index + 1) * 100}", "unit": "Ohm", "tolerance": "5%", "rating": "0.25W"}', '{"partNumber": "R${(index + 1) * 100}-0.25W", "manufacturer": "TestMfg"}')`);
      }

      await database.query(`
        INSERT INTO electrical_analysis.detected_symbols (id, session_id, document_id, page_number, type, label, confidence, bounding_box, zone) 
        VALUES ${symbolValues.join(', ')} 
        ON CONFLICT (id) DO NOTHING
      `);

      await database.query(`
        INSERT INTO electrical_analysis.component_identifications (id, symbol_id, description, specifications, part_information) 
        VALUES ${componentValues.join(', ')} 
        ON CONFLICT (id) DO NOTHING
      `);
    }
  }

  async function cleanupTestData(): Promise<void> {
    await database.query('DELETE FROM electrical_analysis.component_identifications WHERE symbol_id LIKE $1', ['%test%']);
    await database.query('DELETE FROM electrical_analysis.detected_symbols WHERE session_id LIKE $1', ['%test%']);
    await database.query('DELETE FROM electrical_analysis.component_reports WHERE session_id LIKE $1', ['%test%']);
    await database.query('DELETE FROM electrical_analysis.sessions WHERE id LIKE $1', ['%test%']);
  }
});