import { validationService } from '../services/validation.service';

describe('ValidationService', () => {
  const createMockFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => {
    // Create a mock PDF file buffer with proper PDF structure
    const pdfHeader = Buffer.from('%PDF-1.4\n');
    const pdfContent = Buffer.from('1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\n');
    const pdfTrailer = Buffer.from('%%EOF\n');
    const pdfBuffer = Buffer.concat([pdfHeader, pdfContent, pdfTrailer]);

    return {
      fieldname: 'file',
      originalname: 'test.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
      buffer: pdfBuffer,
      destination: '',
      filename: '',
      path: '',
      stream: {} as any,
      ...overrides
    };
  };

  describe('validatePDF', () => {
    it('should validate a correct PDF file', async () => {
      // Create a larger, more complete PDF buffer that meets the 1KB minimum
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
      // Add padding before the trailer to ensure the PDF is at least 1KB
      const minSize = 1024;
      const currentSize = pdfHeader.length + pdfContent.length;
      const pdfPadding = currentSize < minSize ? Buffer.alloc(minSize - currentSize - 6, ' ') : Buffer.alloc(0); // 6 for '%%EOF\n'
      const pdfTrailer = Buffer.from('%%EOF\n');
      const finalBuffer = Buffer.concat([pdfHeader, pdfContent, pdfPadding, pdfTrailer]);
      
      const file = createMockFile({
        buffer: finalBuffer,
        size: finalBuffer.length
      });
      
      const result = await validationService.validatePDF(file);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.fileInfo).toBeDefined();
      expect(result.fileInfo?.mimeType).toBe('application/pdf');
    });

    it('should reject files that are too large', async () => {
      const file = createMockFile({
        size: 11 * 1024 * 1024 // 11MB
      });
      
      const result = await validationService.validatePDF(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('exceeds maximum allowed size'))).toBe(true);
    });

    it('should reject files that are too small', async () => {
      const file = createMockFile({
        size: 500, // 500 bytes
        buffer: Buffer.from('small file')
      });
      
      const result = await validationService.validatePDF(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File is too small to be a valid PDF');
    });

    it('should reject non-PDF MIME types', async () => {
      const file = createMockFile({
        mimetype: 'text/plain'
      });
      
      const result = await validationService.validatePDF(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('not allowed'))).toBe(true);
    });

    it('should reject files without PDF header', async () => {
      const file = createMockFile({
        buffer: Buffer.from('This is not a PDF file content')
      });
      
      const result = await validationService.validatePDF(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing PDF header');
    });

    it('should reject files without proper PDF trailer', async () => {
      const invalidPdf = Buffer.from('%PDF-1.4\n1 0 obj\nendobj\n'); // Missing %%EOF
      const file = createMockFile({
        buffer: invalidPdf
      });
      
      const result = await validationService.validatePDF(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid PDF trailer');
    });
  });

  describe('validatePDFWithFallback', () => {
    it('should use fallback validation for structural issues', async () => {
      // Create PDF with missing structure but valid header and trailer
      const problematicPdf = Buffer.from('%PDF-1.4\n' + 'a'.repeat(1000) + '\n%%EOF');
      const file = createMockFile({
        buffer: problematicPdf,
        size: problematicPdf.length
      });
      
      const result = await validationService.validatePDFWithFallback(file);
      
      // Should pass with fallback validation and include warnings
      expect(result.isValid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('fallback') || w.includes('non-standard'))).toBe(true);
      expect(result.recommendations).toBeDefined();
    });

    it('should return primary validation if it passes', async () => {
      // Create a valid PDF that meets all criteria
      const validPdf = Buffer.from(`%PDF-1.4
1 0 obj
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
>>
endobj
xref
0 4
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000100 00000 n 
trailer
<<
/Size 4
/Root 1 0 R
>>
startxref
140
%%EOF`);
      
      const paddingSize = Math.max(0, 1024 - validPdf.length);
      const padding = Buffer.alloc(paddingSize, ' ');
      const finalPdf = Buffer.concat([validPdf, padding]);
      
      const file = createMockFile({
        buffer: finalPdf,
        size: finalPdf.length
      });
      
      const result = await validationService.validatePDFWithFallback(file);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.includes('fallback') || w.includes('non-standard'))).toBe(false);
    });

    it('should fail if both primary and fallback validation fail', async () => {
      const notAPdf = Buffer.from('This is definitely not a PDF file');
      const file = createMockFile({
        buffer: notAPdf,
        mimetype: 'text/plain'
      });
      
      const result = await validationService.validatePDFWithFallback(file);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getErrorDetails', () => {
    it('should categorize size limit errors', () => {
      const error = new Error('File size exceeds maximum allowed size');
      const details = validationService.getErrorDetails(error);
      
      expect(details.type).toBe('size_limit');
      expect(details.isRetryable).toBe(false);
      expect(details.suggestions.length).toBeGreaterThan(0);
      expect(details.suggestions.some(s => s.includes('compress'))).toBe(true);
    });

    it('should categorize encryption errors', () => {
      const error = new Error('PDF is password protected');
      const details = validationService.getErrorDetails(error);
      
      expect(details.type).toBe('encryption');
      expect(details.isRetryable).toBe(false);
      expect(details.suggestions.some(s => s.includes('password'))).toBe(true);
    });

    it('should categorize corruption errors', () => {
      const error = new Error('PDF structure is corrupted');
      const details = validationService.getErrorDetails(error);
      
      expect(details.type).toBe('corruption');
      expect(details.isRetryable).toBe(true);
      expect(details.suggestions.some(s => s.includes('re-upload'))).toBe(true);
    });

    it('should categorize format errors', () => {
      const error = new Error('Invalid file format detected');
      const details = validationService.getErrorDetails(error);
      
      expect(details.type).toBe('format');
      expect(details.isRetryable).toBe(false);
      expect(details.suggestions.some(s => s.includes('PDF'))).toBe(true);
    });

    it('should categorize unknown errors', () => {
      const error = new Error('Something completely unexpected happened');
      const details = validationService.getErrorDetails(error);
      
      expect(details.type).toBe('unknown');
      expect(details.isRetryable).toBe(true);
      expect(details.suggestions.some(s => s.includes('support'))).toBe(true);
    });

    it('should handle non-Error objects', () => {
      const error = 'String error message';
      const details = validationService.getErrorDetails(error);
      
      expect(details.type).toBe('unknown');
      expect(details.message).toBe('String error message');
    });
  });

  describe('fallbackValidation', () => {
    it('should reject non-PDF files', async () => {
      const notPdf = Buffer.from('Not a PDF file');
      const result = await validationService.fallbackValidation(notPdf);
      
      expect(result.canProceed).toBe(false);
      expect(result.warnings).toContain('Not a PDF file');
    });

    it('should reject files that are too small', async () => {
      const tinyPdf = Buffer.from('%PDF-1.4');
      const result = await validationService.fallbackValidation(tinyPdf);
      
      expect(result.canProceed).toBe(false);
      expect(result.warnings).toContain('File too small');
    });

    it('should allow PDFs with minimal structure', async () => {
      const minimalPdf = Buffer.alloc(1500, 0);
      minimalPdf.write('%PDF-1.4\n1 0 obj\nendobj\n', 0);
      
      const result = await validationService.fallbackValidation(minimalPdf);
      
      expect(result.canProceed).toBe(true);
      expect(result.warnings.some(w => w.includes('fallback'))).toBe(true);
    });
  });
});