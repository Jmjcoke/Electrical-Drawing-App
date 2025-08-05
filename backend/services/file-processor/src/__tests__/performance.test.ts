import request from 'supertest';
import express from 'express';
import multer from 'multer';
import { uploadController } from '../controllers/upload.controller.js';
import { errorHandler } from '../utils/errorHandler.js';

// Create test app for performance testing
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
  });

  app.use(express.json());
  
  // Routes
  app.post('/upload', upload.single('file'), uploadController.uploadFile);
  app.post('/upload-multiple', upload.array('files', 3), uploadController.uploadMultipleFiles);
  
  // Error handling
  app.use(errorHandler);
  
  return app;
};

// Create test PDF buffer with specified size
const createTestPDF = (sizeMB: number = 10): Buffer => {
  // Create a PDF that's close to the specified size but under the 10MB limit
  const maxSizeMB = Math.min(sizeMB, 9.5); // Keep under 10MB limit
  const pdfHeader = Buffer.from('%PDF-1.4\n');
  const pdfTrailer = Buffer.from('%%EOF\n');
  
  // Create base PDF structure
  const basePdfContent = Buffer.from(`1 0 obj
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
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Hello World) Tj
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
398
`);
  
  // Calculate how much padding we need
  const targetSize = maxSizeMB * 1024 * 1024;
  const currentSize = pdfHeader.length + basePdfContent.length + pdfTrailer.length;
  const paddingSize = Math.max(0, targetSize - currentSize - 6); // 6 for trailer
  
  const padding = Buffer.alloc(paddingSize, ' ');
  
  return Buffer.concat([pdfHeader, basePdfContent, padding, pdfTrailer]);
};

describe('File Upload Performance Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('AC7: 60-Second Upload Requirement', () => {
    it('should complete maximum load upload (3 files, 30MB total) within 60 seconds', async () => {
      // Create 3 files of 9.5MB each (28.5MB total - under the 30MB limit)
      const testPDF = createTestPDF(9.5);
      
      console.log(`Created test PDF of size: ${(testPDF.length / 1024 / 1024).toFixed(2)} MB`);
      
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/upload-multiple')
        .attach('files', testPDF, 'file-1.pdf')
        .attach('files', testPDF, 'file-2.pdf')  
        .attach('files', testPDF, 'file-3.pdf')
        .expect(200);
      
      const endTime = Date.now();
      const uploadTime = (endTime - startTime) / 1000; // Convert to seconds
      
      console.log(`Upload completed in ${uploadTime.toFixed(2)} seconds`);
      console.log(`Total data processed: ${(response.body.totalSize / 1024 / 1024).toFixed(2)} MB`);
      
      // Verify upload completed within 60 seconds
      expect(uploadTime).toBeLessThan(60);
      
      // Verify all files were processed successfully
      expect(response.body.success).toBe(true);
      expect(response.body.files).toHaveLength(3);
      expect(response.body.totalSize).toBe(testPDF.length * 3);
      
      // Verify all files are marked as ready
      response.body.files.forEach((file: any) => {
        expect(file.processingStatus).toBe('ready');
      });
    }, 70000); // Test timeout of 70 seconds to allow for 60-second requirement + buffer

    it('should handle concurrent single file uploads within performance limits', async () => {
      // Test 10 concurrent uploads of 5MB files
      const testPDF = createTestPDF(5);
      const concurrentUploads = 10;
      
      const startTime = Date.now();
      
      const uploadPromises = Array.from({ length: concurrentUploads }, (_, i) =>
        request(app)
          .post('/upload')
          .attach('file', testPDF, `concurrent-${i}.pdf`)
      );
      
      const responses = await Promise.all(uploadPromises);
      
      const endTime = Date.now();
      const uploadTime = (endTime - startTime) / 1000;
      
      console.log(`${concurrentUploads} concurrent uploads completed in ${uploadTime.toFixed(2)} seconds`);
      
      // Verify all uploads completed within reasonable time (should be much faster than 60s)
      expect(uploadTime).toBeLessThan(30);
      
      // Verify all uploads succeeded
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.originalName).toBe(`concurrent-${index}.pdf`);
      });
    }, 40000); // Test timeout of 40 seconds

    it('should maintain consistent performance across multiple sequential uploads', async () => {
      // Test sequential uploads to verify no performance degradation
      const testPDF = createTestPDF(8); // 8MB files
      const uploadCount = 5;
      const uploadTimes: number[] = [];
      
      for (let i = 0; i < uploadCount; i++) {
        const startTime = Date.now();
        
        const response = await request(app)
          .post('/upload')
          .attach('file', testPDF, `sequential-${i}.pdf`)
          .expect(200);
        
        const endTime = Date.now();
        const uploadTime = (endTime - startTime) / 1000;
        uploadTimes.push(uploadTime);
        
        expect(response.body.success).toBe(true);
      }
      
      const avgTime = uploadTimes.reduce((sum, time) => sum + time, 0) / uploadTimes.length;
      const maxTime = Math.max(...uploadTimes);
      
      console.log(`Sequential uploads - Average: ${avgTime.toFixed(2)}s, Max: ${maxTime.toFixed(2)}s`);
      
      // Verify consistent performance - no single upload should take more than 20 seconds
      expect(maxTime).toBeLessThan(20);
      
      // Verify no significant performance degradation across uploads
      const firstUploadTime = uploadTimes[0];
      const lastUploadTime = uploadTimes[uploadTimes.length - 1];
      const performanceDegradation = (lastUploadTime - firstUploadTime) / firstUploadTime;
      
      // Allow up to 50% performance degradation (should be much less in practice)
      expect(performanceDegradation).toBeLessThan(0.5);
    }, 60000); // Test timeout of 60 seconds
  });

  describe('Performance Monitoring', () => {
    it('should provide performance metrics for uploads', async () => {
      const testPDF = createTestPDF(5); // 5MB file
      
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/upload')
        .attach('file', testPDF, 'metrics-test.pdf')
        .expect(200);
      
      const endTime = Date.now();
      const uploadTime = endTime - startTime;
      
      // Calculate performance metrics
      const fileSizeMB = testPDF.length / (1024 * 1024);
      const throughputMBps = fileSizeMB / (uploadTime / 1000);
      
      console.log(`Performance Metrics:
        - File Size: ${fileSizeMB.toFixed(2)} MB
        - Upload Time: ${uploadTime} ms
        - Throughput: ${throughputMBps.toFixed(2)} MB/s`);
      
      // Verify minimum throughput (should process at least 1 MB/s)
      expect(throughputMBps).toBeGreaterThan(1);
      
      // Verify upload was successful
      expect(response.body.success).toBe(true);
      expect(response.body.size).toBe(testPDF.length);
    });
  });
});