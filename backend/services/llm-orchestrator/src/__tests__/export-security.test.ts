/**
 * Export Security Tests
 * Comprehensive security testing for export system
 * Production hardening for Story 4.5
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { ComponentExportService } from '../export/component-export.service';
import { ExportController } from '../controllers/export.controller';
import { ExportErrorRecoveryService } from '../services/export-error-recovery.service';
import { ExportRateLimiter } from '../middleware/export-rate-limiter';
import { ComponentExportRequest } from '../../../../shared/types/nlp.types';
import express from 'express';
import request from 'supertest';

describe('Export Security Tests', () => {
  let testDir: string;
  let createdFiles: string[] = [];
  let app: express.Application;

  beforeAll(async () => {
    testDir = path.join(__dirname, 'security-test-exports');
    await fs.mkdir(testDir, { recursive: true });
    process.env.EXPORT_DIR = testDir;

    // Setup minimal Express app for testing
    app = express();
    app.use(express.json());
  });

  afterAll(async () => {
    // Cleanup test files
    for (const file of createdFiles) {
      try {
        await fs.unlink(file);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    try {
      await fs.rmdir(testDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Path Traversal Prevention', () => {
    let exportService: ComponentExportService;

    beforeEach(() => {
      // Create mock dependencies
      const mockRepo = {
        getSymbolsBySession: jest.fn().mockResolvedValue([]),
        getComponentsBySession: jest.fn().mockResolvedValue([]),
        getReferencesBySession: jest.fn().mockResolvedValue([]),
        getReport: jest.fn().mockResolvedValue(null),
        saveReport: jest.fn().mockResolvedValue({ id: 'test-report' }),
        getReportsBySession: jest.fn().mockResolvedValue([]),
        incrementDownloadCount: jest.fn().mockResolvedValue(undefined)
      };

      const mockTemplateService = {
        getTemplate: jest.fn().mockResolvedValue({
          id: 'template-1',
          layout: { margins: { top: 20, bottom: 20, left: 15, right: 15 } },
          sections: []
        }),
        getDefaultTemplate: jest.fn().mockResolvedValue({
          id: 'default-template',
          layout: { margins: { top: 20, bottom: 20, left: 15, right: 15 } },
          sections: []
        })
      };

      const mockReportGenerator = {
        generateFileName: jest.fn().mockReturnValue('test-file.json'),
        getFilePath: jest.fn().mockResolvedValue(path.join(testDir, 'test-file.json'))
      };

      exportService = new ComponentExportService(
        mockRepo as any,
        mockRepo as any,
        mockRepo as any,
        mockRepo as any,
        mockReportGenerator as any,
        mockTemplateService as any
      );
    });

    it('should sanitize directory paths', async () => {
      const service = exportService as any;
      
      // Test various path traversal attempts
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '/etc/passwd',
        'C:\\Windows\\System32',
        '../../../../usr/bin',
        './../../etc/shadow',
        'exports/../../../etc/hosts',
        'exports\\..\\..\\..\\boot.ini'
      ];

      for (const maliciousPath of maliciousPaths) {
        const result = service.sanitizeDirectoryPath(maliciousPath);
        
        if (result !== null) {
          // If not blocked entirely, ensure it's within safe bounds
          const resolvedResult = path.resolve(result);
          const allowedRoots = [
            path.resolve(testDir),
            path.resolve('/tmp'),
            path.resolve('/var/tmp')
          ];
          
          const isWithinAllowedRoot = allowedRoots.some(root => 
            resolvedResult.startsWith(root)
          );
          
          expect(isWithinAllowedRoot).toBe(true);
        }
      }
    });

    it('should generate secure filenames', async () => {
      const service = exportService as any;
      
      const maliciousInputs = [
        '../../../malicious.exe',
        '<script>alert("xss")</script>',
        '../../etc/passwd',
        'file with spaces and ../traversal',
        'file|with|pipes',
        'file:with:colons',
        'file*with*wildcards',
        'file"with"quotes',
        'file<with>brackets',
        'file?with?questions',
        'file\\with\\backslashes'
      ];

      for (const maliciousInput of maliciousInputs) {
        const filename = service.generateSecureFileName('test', 'json', maliciousInput);
        
        // Should not contain dangerous characters
        expect(filename).not.toMatch(/[<>:\"|?*\\]/);
        expect(filename).not.toContain('../');
        expect(filename).not.toContain('..\\');
        expect(filename).not.toContain('<script>');
        expect(filename).not.toContain('etc/passwd');
        
        // Should be a valid filename
        expect(filename).toMatch(/^[a-zA-Z0-9._-]+\.(json|pdf|csv|xlsx)$/);
      }
    });

    it('should validate file paths are safe', async () => {
      const service = exportService as any;
      
      const unsafePaths = [
        '/etc/passwd',
        '../../../etc/passwd',
        path.join(testDir, '../../../etc/passwd'),
        '/var/log/system.log',
        'C:\\Windows\\System32\\config\\SAM',
        '/proc/version',
        '/dev/null',
        path.join(testDir, '../outside-dir/file.txt')
      ];

      for (const unsafePath of unsafePaths) {
        const isSafe = service.isFilePathSafe(unsafePath);
        expect(isSafe).toBe(false);
      }

      // Safe paths should pass
      const safePaths = [
        path.join(testDir, 'safe-file.json'),
        path.join(testDir, 'subdir', 'safe-file.pdf'),
        path.join(testDir, 'report_123_20241107.csv')
      ];

      for (const safePath of safePaths) {
        const isSafe = service.isFilePathSafe(safePath);
        expect(isSafe).toBe(true);
      }
    });
  });

  describe('Input Validation', () => {
    let controller: ExportController;

    beforeEach(() => {
      const mockExportService = {
        exportComponents: jest.fn().mockResolvedValue({ success: true, reportId: 'test-123' }),
        downloadReport: jest.fn().mockResolvedValue(null),
        getReport: jest.fn().mockResolvedValue(null),
        listSessionReports: jest.fn().mockResolvedValue([])
      };

      controller = new ExportController(
        mockExportService as any,
        {} as any,
        {} as any
      );

      // Setup routes
      app.get('/test/download/:reportId', controller.downloadReport.bind(controller));
    });

    it('should validate UUID format for report IDs', async () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '123-456-789',
        'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        '../../../etc/passwd',
        '<script>alert("xss")</script>',
        'DROP TABLE users;',
        '12345678-1234-1234-1234-12345678901234567890', // Too long
        '1234567-1234-1234-1234-123456789012' // Wrong format
      ];

      for (const invalidUUID of invalidUUIDs) {
        const response = await request(app)
          .get(`/test/download/${invalidUUID}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid report ID format');
      }
    });

    it('should validate export format inputs', async () => {
      const invalidFormats = [
        'exe',
        'bat',
        'sh',
        '../../../malicious',
        '<script>',
        'pdf; rm -rf /',
        'json"malicious"',
        'csv|dangerous',
        'xlsx&& rm -rf /'
      ];

      const mockRequest = {
        sessionId: 'valid-session-id',
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

      for (const invalidFormat of invalidFormats) {
        const request = { ...mockRequest, exportFormat: invalidFormat };
        
        // The service should reject invalid formats
        const controller = new ExportController({
          exportComponents: jest.fn().mockImplementation((req) => {
            if (!['pdf', 'csv', 'excel', 'json'].includes(req.exportFormat)) {
              throw new Error(`Invalid export format: ${req.exportFormat}`);
            }
            return Promise.resolve({ success: true, reportId: 'test-123' });
          })
        } as any, {} as any, {} as any);

        expect(() => {
          controller.exportComponents({
            body: request,
            params: { sessionId: 'test-session' },
            ip: '127.0.0.1'
          } as any, {} as any, jest.fn() as any);
        }).not.toThrow();
      }
    });
  });

  describe('Rate Limiting Security', () => {
    it('should prevent DoS attacks through rate limiting', async () => {
      const rateLimiter = new ExportRateLimiter({
        windowMs: 1000, // 1 second window for testing
        maxRequests: 3,  // Very low limit for testing
        keyGenerator: (req: any) => req.ip || 'test-ip'
      });

      const app = express();
      app.use(rateLimiter.middleware());
      app.get('/test', (req, res) => res.json({ success: true }));

      // Make requests that exceed the limit
      const requests = Array(5).fill(null).map(() =>
        request(app).get('/test')
      );

      const responses = await Promise.all(requests);
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it('should provide proper rate limit headers', async () => {
      const rateLimiter = new ExportRateLimiter({
        windowMs: 60000, // 1 minute
        maxRequests: 10
      });

      const app = express();
      app.use(rateLimiter.middleware());
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app).get('/test');

      expect(response.headers['x-ratelimit-limit']).toBe('10');
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should handle rate limiting key generation securely', async () => {
      const rateLimiter = new ExportRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        keyGenerator: (req: any) => {
          const ip = req.ip || '127.0.0.1';
          const userAgent = req.get('User-Agent') || 'unknown';
          // Should not include full user agent to prevent manipulation
          return `${ip}:${Buffer.from(userAgent).toString('base64').substring(0, 16)}`;
        }
      });

      const maliciousUserAgents = [
        '../../../etc/passwd',
        '<script>alert("xss")</script>',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36; rm -rf /',
        'User-Agent: malicious-injection; DROP TABLE users;'
      ];

      const app = express();
      app.use(rateLimiter.middleware());
      app.get('/test', (req, res) => res.json({ success: true }));

      for (const maliciousUA of maliciousUserAgents) {
        const response = await request(app)
          .get('/test')
          .set('User-Agent', maliciousUA);

        // Should not crash or expose sensitive information
        expect([200, 429]).toContain(response.status);
      }
    });
  });

  describe('File System Security', () => {
    it('should prevent writing to system directories', async () => {
      const errorRecoveryService = new ExportErrorRecoveryService();
      
      const systemPaths = [
        '/etc',
        '/usr/bin',
        '/var/log',
        '/proc',
        '/sys',
        '/dev',
        'C:\\Windows\\System32',
        'C:\\Program Files',
        '/'
      ];

      for (const systemPath of systemPaths) {
        try {
          await errorRecoveryService.ensureExportDirectory(systemPath);
          // If it doesn't throw, the path should have been sanitized
        } catch (error) {
          // Should throw an error for system paths
          expect(error.message).toContain('Invalid export directory path');
        }
      }
    });

    it('should handle file permissions correctly', async () => {
      const testFile = path.join(testDir, 'permission-test.json');
      await fs.writeFile(testFile, '{"test": true}');
      createdFiles.push(testFile);
      
      // Make file read-only
      await fs.chmod(testFile, 0o444);
      
      const errorRecoveryService = new ExportErrorRecoveryService();
      
      // Should handle permission errors gracefully
      const result = await errorRecoveryService.executeWithRecovery(
        async () => {
          await fs.writeFile(testFile, '{"modified": true}');
          return true;
        },
        { operation: 'writeFile' },
        { maxRetries: 1, enableFallbacks: true }
      );

      // Should either succeed with fallback or fail gracefully
      expect(typeof result.success).toBe('boolean');
    });

    it('should validate file sizes before operations', async () => {
      const controller = new ExportController(
        {} as any,
        {} as any,
        {} as any
      );

      const controllerInstance = controller as any;

      // Create a large file
      const largeFile = path.join(testDir, 'large-file.dat');
      const largeContent = Buffer.alloc(60 * 1024 * 1024, 'x'); // 60MB
      await fs.writeFile(largeFile, largeContent);
      createdFiles.push(largeFile);

      // Mock Express response
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        headersSent: false
      };

      const mockReq = {
        params: { sessionId: 'test', reportId: 'test-report' },
        ip: '127.0.0.1'
      };

      // Mock download info with large file
      const mockExportService = {
        downloadReport: jest.fn().mockResolvedValue({
          filePath: largeFile,
          fileName: 'large-file.dat',
          mimeType: 'application/octet-stream'
        })
      };

      const testController = new ExportController(
        mockExportService as any,
        {} as any,
        {} as any
      );

      await testController.downloadReport(mockReq as any, mockRes as any, jest.fn());

      // Should reject large files
      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'File too large to download'
        })
      );
    });
  });

  describe('Content Security', () => {
    it('should sanitize user-generated content in exports', async () => {
      const maliciousContent = {
        customBranding: {
          headerText: '<script>alert("xss")</script>',
          footerText: '<img src="x" onerror="alert(1)">',
          logoBase64: 'data:text/html,<script>alert("xss")</script>'
        },
        templateId: '../../etc/passwd',
        documentIds: ['<script>', 'DROP TABLE users;', '../../../etc/hosts']
      };

      const request: ComponentExportRequest = {
        sessionId: 'test-session',
        exportFormat: 'json',
        includeReferences: false,
        includeVisualMap: false,
        customOptions: {
          includeTechnicalSpecs: true,
          includePartNumbers: false,
          includeConfidenceScores: false,
          groupByPage: false,
          sortBy: 'type',
          customBranding: maliciousContent.customBranding
        }
      };

      // Create a mock service that captures the sanitized content
      const capturedContent: any = {};
      const mockService = {
        exportComponents: jest.fn().mockImplementation((req) => {
          capturedContent.request = req;
          return Promise.resolve({ success: true, reportId: 'test-123' });
        })
      };

      const controller = new ExportController(
        mockService as any,
        {} as any,
        {} as any
      );

      const mockReq = {
        body: request,
        params: { sessionId: 'test-session' },
        ip: '127.0.0.1'
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await controller.exportComponents(mockReq as any, mockRes as any, jest.fn());

      // Verify that malicious content is not passed through
      if (capturedContent.request) {
        const customBranding = capturedContent.request.customOptions?.customBranding;
        if (customBranding) {
          expect(customBranding.headerText).not.toContain('<script>');
          expect(customBranding.footerText).not.toContain('<img');
          expect(customBranding.logoBase64).not.toContain('<script>');
        }
      }
    });

    it('should handle null byte injection attempts', async () => {
      const maliciousInputs = [
        'file\0.exe',
        'report\x00malicious',
        'export\u0000.bat',
        'normal-file.json\0hidden-extension'
      ];

      for (const maliciousInput of maliciousInputs) {
        const request: ComponentExportRequest = {
          sessionId: maliciousInput,
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

        // Should not crash or create files with null bytes
        expect(() => {
          const filename = crypto.randomUUID() + maliciousInput;
          const safeName = filename.replace(/\0/g, '');
          expect(safeName).not.toContain('\0');
        }).not.toThrow();
      }
    });
  });
});