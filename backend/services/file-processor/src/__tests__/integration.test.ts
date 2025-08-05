import request from 'supertest';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadController } from '../controllers/upload.controller';
import { errorHandler } from '../utils/errorHandler';

// Create test app
const createTestApp = () => {
  const app = express();
  
  // Configure multer for testing
  const storage = multer.memoryStorage();
  const upload = multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 3
    }
    // Note: fileFilter removed to allow partial success handling in controller
  });

  app.use(express.json());
  
  // Routes
  app.post('/upload', upload.single('file'), uploadController.uploadFile);
  app.post('/upload-multiple', upload.array('files', 3), uploadController.uploadMultipleFiles);
  app.get('/upload/:fileId/status', uploadController.getUploadStatus);
  
  // Error handling
  app.use(errorHandler);
  
  return app;
};

// Create test PDF buffer
const createTestPDF = (content: string = 'Test PDF Content'): Buffer => {
  // Create a properly sized PDF that meets the 1KB minimum requirement
  const pdfHeader = Buffer.from('%PDF-1.4\n');
  const pdfContent = Buffer.from(`1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length ${content.length + 20}
>>
stream
BT
/F1 12 Tf
100 700 Td
(${content}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000079 00000 n 
0000000173 00000 n 
0000000301 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
${400 + content.length}
`);
  
  // Add padding before the trailer to ensure the PDF is at least 1KB
  const minSize = 1024;
  const currentSize = pdfHeader.length + pdfContent.length;
  const pdfPadding = currentSize < minSize ? Buffer.alloc(minSize - currentSize - 6, ' ') : Buffer.alloc(0); // 6 for '%%EOF\n'
  const pdfTrailer = Buffer.from('%%EOF\n');
  const finalBuffer = Buffer.concat([pdfHeader, pdfContent, pdfPadding, pdfTrailer]);
  
  return finalBuffer;
};

describe('File Upload Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('Single File Upload', () => {
    it('should successfully upload a valid PDF file', async () => {
      const testPDF = createTestPDF('Single file test content');
      
      const response = await request(app)
        .post('/upload')
        .attach('file', testPDF, 'test-document.pdf')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        originalName: 'test-document.pdf',
        mimeType: 'application/pdf'
      });
      
      expect(response.body.fileId).toBeDefined();
      expect(response.body.uploadedAt).toBeDefined();
      expect(response.body.size).toBeGreaterThan(0);
    });

    it('should reject non-PDF files', async () => {
      const textFile = Buffer.from('This is not a PDF file');
      
      const response = await request(app)
        .post('/upload')
        .attach('file', textFile, 'test-document.txt')
        .expect(400);

      expect(response.body.error).toMatchObject({
        code: 'INVALID_FILE',
        message: expect.stringContaining('not allowed'),
        timestamp: expect.any(String)
      });
    });

    it('should reject files that are too large', async () => {
      // Create a large buffer (11MB)
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024, 'x');
      
      const response = await request(app)
        .post('/upload')
        .attach('file', largeBuffer, 'large-file.pdf')
        .expect(413);

      expect(response.body.error).toBeDefined();
    });

    it('should handle missing file', async () => {
      const response = await request(app)
        .post('/upload')
        .expect(400);

      expect(response.body.error).toMatchObject({
        code: 'NO_FILE_UPLOADED',
        message: 'No file was uploaded',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Multiple File Upload', () => {
    it('should successfully upload multiple valid PDF files', async () => {
      const testPDF1 = createTestPDF('First document content');
      const testPDF2 = createTestPDF('Second document content');
      
      const response = await request(app)
        .post('/upload-multiple')
        .attach('files', testPDF1, 'document-1.pdf')
        .attach('files', testPDF2, 'document-2.pdf')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        totalSize: expect.any(Number),
        sessionId: expect.any(String)
      });
      
      expect(response.body.files).toHaveLength(2);
      expect(response.body.files[0]).toMatchObject({
        fileId: expect.any(String),
        originalName: 'document-1.pdf',
        mimeType: 'application/pdf',
        processingStatus: 'ready'
      });
      expect(response.body.files[1]).toMatchObject({
        fileId: expect.any(String),
        originalName: 'document-2.pdf',
        mimeType: 'application/pdf',
        processingStatus: 'ready'
      });
    });

    it('should reject when uploading too many files', async () => {
      const testPDF = createTestPDF('Test content');
      
      const response = await request(app)
        .post('/upload-multiple')
        .attach('files', testPDF, 'doc-1.pdf')
        .attach('files', testPDF, 'doc-2.pdf')
        .attach('files', testPDF, 'doc-3.pdf')
        .attach('files', testPDF, 'doc-4.pdf') // 4th file should be rejected
        .expect(400);

      expect(response.body.error).toMatchObject({
        code: 'TOO_MANY_FILES',
        message: 'Maximum 3 files allowed per upload',
        timestamp: expect.any(String)
      });
    });

    it('should reject when total size exceeds limit', async () => {
      // Create 3 files of 11MB each (33MB total > 30MB limit)
      const largePDF = Buffer.alloc(11 * 1024 * 1024, 'x');
      // Add minimal PDF structure to make it valid
      const validLargePDF = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        largePDF,
        Buffer.from('\n%%EOF')
      ]);
      
      const response = await request(app)
        .post('/upload-multiple')
        .attach('files', validLargePDF, 'large-1.pdf')
        .attach('files', validLargePDF, 'large-2.pdf')
        .attach('files', validLargePDF, 'large-3.pdf')
        .expect(413); // Multer returns 413 for file size limit

      expect(response.body.error).toMatchObject({
        code: 'FILE_TOO_LARGE',
        message: expect.stringContaining('File size exceeds'),
        timestamp: expect.any(String)
      });
    });

    it('should handle mixed valid/invalid files gracefully', async () => {
      const validPDF = createTestPDF('Valid content');
      const invalidFile = Buffer.from('Invalid content');
      
      const response = await request(app)
        .post('/upload-multiple')
        .attach('files', validPDF, 'valid.pdf')
        .attach('files', invalidFile, 'invalid.txt')
        .expect(200); // Some files succeeded

      expect(response.body.success).toBe(true);
      expect(response.body.files).toHaveLength(2);
      
      // Check that one file succeeded and one failed
      const statuses = response.body.files.map((f: any) => f.processingStatus);
      expect(statuses).toContain('ready');
      expect(statuses).toContain('error');
    });

    it('should handle empty file array', async () => {
      const response = await request(app)
        .post('/upload-multiple')
        .expect(400);

      expect(response.body.error).toMatchObject({
        code: 'NO_FILES_UPLOADED',
        message: 'No files were uploaded',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Upload Status Endpoint', () => {
    it('should return 400 for missing file ID', async () => {
      const response = await request(app)
        .get('/upload/ /status') // Space as fileId - will be treated as empty
        .expect(400);

      expect(response.body.error).toMatchObject({
        code: 'MISSING_FILE_ID',
        message: 'File ID is required',
        timestamp: expect.any(String)
      });
    });

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .get('/upload/non-existent-id/status')
        .expect(404);

      expect(response.body.error).toMatchObject({
        code: 'FILE_NOT_FOUND',
        message: 'File not found',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed multipart data', async () => {
      const response = await request(app)
        .post('/upload')
        .set('Content-Type', 'multipart/form-data')
        .send('malformed data')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should provide consistent error format', async () => {
      const response = await request(app)
        .post('/upload')
        .expect(400);

      expect(response.body).toMatchObject({
        error: {
          code: expect.any(String),
          message: expect.any(String),
          timestamp: expect.any(String)
        }
      });
    });
  });

  describe('Content-Type Validation', () => {
    it('should accept PDF files with correct MIME type', async () => {
      const testPDF = createTestPDF('Content type test');
      
      const response = await request(app)
        .post('/upload')
        .attach('file', testPDF, {
          filename: 'test.pdf',
          contentType: 'application/pdf'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject files with incorrect MIME type even with PDF extension', async () => {
      const textContent = Buffer.from('This is actually text content');
      
      const response = await request(app)
        .post('/upload')
        .attach('file', textContent, {
          filename: 'fake.pdf',
          contentType: 'text/plain'
        })
        .expect(400);

      expect(response.body.error.message).toContain('not allowed');
    });
  });

  describe('Concurrent Upload Handling', () => {
    it('should handle multiple concurrent uploads', async () => {
      const testPDF = createTestPDF('Concurrent test');
      
      const uploadPromises = Array.from({ length: 3 }, (_, i) =>
        request(app)
          .post('/upload')
          .attach('file', testPDF, `concurrent-${i}.pdf`)
      );

      const responses = await Promise.all(uploadPromises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Ensure all uploads got unique file IDs
      const fileIds = responses.map(r => r.body.fileId);
      const uniqueIds = new Set(fileIds);
      expect(uniqueIds.size).toBe(3);
    });
  });
});