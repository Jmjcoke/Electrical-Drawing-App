import { fileTypeFromBuffer } from 'file-type';
import fs from 'fs/promises';
import { logger } from '../utils/logger.js';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo?: {
    size: number;
    mimeType: string;
    detectedType?: string;
  };
  metadata?: {
    hasImages: boolean;
    hasText: boolean;
    isEncrypted: boolean;
    isCorrupted: boolean;
    estimatedPages: number;
    version?: string;
    hasForm: boolean;
    hasAnnotations: boolean;
  };
  recommendations?: string[];
}

class ValidationService {
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (for electrical drawings)
  private readonly MIN_FILE_SIZE = 1024; // 1KB
  private readonly ALLOWED_MIME_TYPES = ['application/pdf'];
  private readonly MAX_PAGES = 20; // Maximum pages for conversion

  async validatePDF(file: Express.Multer.File): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    try {
      logger.info('Starting comprehensive PDF validation', { 
        filename: file.originalname, 
        size: file.size,
        mimetype: file.mimetype 
      });

      // Validate file size
      if (file.size > this.MAX_FILE_SIZE) {
        errors.push(`File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
      }

      if (file.size < this.MIN_FILE_SIZE) {
        errors.push('File is too small to be a valid PDF');
      }

      // Validate MIME type
      if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        errors.push(`File type ${file.mimetype} is not allowed. Only PDF files are accepted.`);
      }

      // Validate file signature (magic bytes)
      const signatureValidation = await this.validateFileSignature(file.buffer);
      if (!signatureValidation.isValid) {
        errors.push(signatureValidation.error || 'Invalid file signature');
      }

      // Enhanced PDF structure validation with metadata extraction
      const structureValidation = this.validatePDFStructure(file.buffer);
      if (!structureValidation.isValid) {
        if (structureValidation.isCorrupted) {
          errors.push(structureValidation.error || 'PDF structure is corrupted');
        } else {
          warnings.push(structureValidation.error || 'PDF structure warning');
        }
      }

      // Content analysis
      const contentAnalysis = this.analyzePDFContent(file.buffer);
      
      // Security validation
      const securityValidation = this.validateSecurity(file.buffer);
      if (securityValidation.isEncrypted && !securityValidation.allowConversion) {
        errors.push('PDF is password protected and cannot be converted');
      } else if (securityValidation.isEncrypted) {
        warnings.push('PDF is encrypted - conversion may fail or produce incomplete results');
        recommendations.push('Remove password protection for best conversion results');
      }

      // Page count validation
      if (contentAnalysis.estimatedPages > this.MAX_PAGES) {
        errors.push(`PDF has too many pages (${contentAnalysis.estimatedPages}). Maximum allowed: ${this.MAX_PAGES}`);
        recommendations.push('Consider splitting large PDFs into smaller files');
      } else if (contentAnalysis.estimatedPages > 10) {
        warnings.push('Large PDF may take longer to convert');
        recommendations.push('Large PDFs may take 30+ seconds to convert');
      }

      // Content warnings and recommendations
      if (!contentAnalysis.hasText && !contentAnalysis.hasImages) {
        warnings.push('PDF appears to contain no visible text or images');
        recommendations.push('Verify that the PDF contains the expected content');
      }

      if (contentAnalysis.hasForm) {
        warnings.push('PDF contains form fields - form data may not be visible in converted images');
        recommendations.push('Fill out forms before conversion or flatten the PDF');
      }

      if (contentAnalysis.hasAnnotations) {
        warnings.push('PDF contains annotations - annotations may not be visible in converted images');
        recommendations.push('Flatten annotations before conversion to ensure they appear in images');
      }

      const result: ValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        fileInfo: {
          size: file.size,
          mimeType: file.mimetype,
          detectedType: signatureValidation.detectedType
        },
        metadata: {
          hasImages: contentAnalysis.hasImages,
          hasText: contentAnalysis.hasText,
          isEncrypted: securityValidation.isEncrypted,
          isCorrupted: structureValidation.isCorrupted || false,
          estimatedPages: contentAnalysis.estimatedPages,
          version: contentAnalysis.version,
          hasForm: contentAnalysis.hasForm,
          hasAnnotations: contentAnalysis.hasAnnotations
        },
        recommendations
      };

      if (result.isValid) {
        logger.info('PDF validation passed', { 
          filename: file.originalname,
          pages: contentAnalysis.estimatedPages,
          hasWarnings: warnings.length > 0,
          warningsCount: warnings.length
        });
      } else {
        logger.warn('PDF validation failed', { 
          filename: file.originalname,
          errorsCount: errors.length,
          errors: errors.join(', ')
        });
      }

      return result;

    } catch (error) {
      logger.error('PDF validation failed with exception', { 
        filename: file.originalname, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return {
        isValid: false,
        errors: [`File validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        recommendations: ['Try re-uploading the file or ensure it is not corrupted']
      };
    }
  }

  private async validateFileSignature(buffer: Buffer): Promise<{ isValid: boolean; error?: string; detectedType?: string }> {
    try {
      const fileType = await fileTypeFromBuffer(buffer);
      
      if (!fileType) {
        return {
          isValid: false,
          error: 'Could not determine file type'
        };
      }

      if (fileType.mime !== 'application/pdf') {
        return {
          isValid: false,
          error: `File appears to be ${fileType.mime}, not a PDF`,
          detectedType: fileType.mime
        };
      }

      return {
        isValid: true,
        detectedType: fileType.mime
      };

    } catch (error) {
      return {
        isValid: false,
        error: 'Failed to validate file signature'
      };
    }
  }

  private validatePDFStructure(buffer: Buffer): { isValid: boolean; error?: string; isCorrupted?: boolean } {
    try {
      // Check for PDF header
      const pdfHeader = buffer.slice(0, 8).toString('ascii');
      if (!pdfHeader.startsWith('%PDF')) {
        return {
          isValid: false,
          error: 'Missing PDF header',
          isCorrupted: true
        };
      }

      // Check for PDF trailer (should end with %%EOF)
      const lastBytes = buffer.slice(-100).toString('ascii');
      if (!lastBytes.includes('%%EOF')) {
        return {
          isValid: false,
          error: 'Invalid PDF trailer',
          isCorrupted: true
        };
      }

      // Enhanced check for required PDF objects
      const content = buffer.toString('binary');
      
      // Check for essential PDF structure
      const hasXref = content.includes('xref');
      const hasTrailer = content.includes('trailer');
      const hasStartxref = content.includes('startxref');
      const hasObjects = content.includes('obj') && content.includes('endobj');
      
      if (!hasObjects) {
        return {
          isValid: false,
          error: 'Missing required PDF objects',
          isCorrupted: true
        };
      }

      if (!hasXref || !hasTrailer || !hasStartxref) {
        return {
          isValid: false,
          error: 'PDF structure is corrupted - missing essential components',
          isCorrupted: true
        };
      }

      return { isValid: true };

    } catch (error) {
      return {
        isValid: false,
        error: 'Failed to validate PDF structure due to parsing error',
        isCorrupted: true
      };
    }
  }

  private analyzePDFContent(buffer: Buffer): {
    hasImages: boolean;
    hasText: boolean;
    estimatedPages: number;
    version?: string;
    hasForm: boolean;
    hasAnnotations: boolean;
  } {
    try {
      const content = buffer.toString('binary');
      const header = buffer.slice(0, 8).toString('ascii');
      
      // Extract PDF version
      const versionMatch = header.match(/%PDF-(\d+\.\d+)/);
      const version = versionMatch ? versionMatch[1] : undefined;
      
      // Check for text content
      const hasText = content.includes('/Font') || 
                      content.includes('BT') || 
                      content.includes('ET') ||
                      content.includes('/Text');
      
      // Check for images
      const hasImages = content.includes('/Image') || 
                        content.includes('/XObject') ||
                        content.includes('/DCTDecode') ||
                        content.includes('/FlateDecode');
      
      // Estimate page count
      let estimatedPages = 0;
      const pageMatches = content.match(/\/Type\s*\/Page[^s]/g);
      if (pageMatches) {
        estimatedPages = pageMatches.length;
      } else {
        // Fallback: count page references
        const pageRefMatches = content.match(/\/Count\s+(\d+)/g);
        if (pageRefMatches && pageRefMatches.length > 0) {
          const counts = pageRefMatches.map(match => {
            const countMatch = match.match(/\/Count\s+(\d+)/);
            return countMatch ? parseInt(countMatch[1]) : 0;
          });
          estimatedPages = Math.max(...counts);
        }
      }
      
      // If still no pages found, assume at least 1
      if (estimatedPages === 0) {
        estimatedPages = 1;
      }
      
      // Check for form fields
      const hasForm = content.includes('/AcroForm') || 
                      content.includes('/Field') ||
                      content.includes('/Widget');
      
      // Check for annotations
      const hasAnnotations = content.includes('/Annot') || 
                            content.includes('/Highlight') ||
                            content.includes('/Text') ||
                            content.includes('/FreeText');
      
      return {
        hasImages,
        hasText,
        estimatedPages,
        version,
        hasForm,
        hasAnnotations
      };
    } catch (error) {
      logger.warn('Failed to analyze PDF content', { error });
      return {
        hasImages: false,
        hasText: false,
        estimatedPages: 1,
        hasForm: false,
        hasAnnotations: false
      };
    }
  }

  private validateSecurity(buffer: Buffer): {
    isEncrypted: boolean;
    allowConversion: boolean;
    securityWarnings: string[];
  } {
    try {
      const content = buffer.toString('binary');
      
      // Check for encryption
      const hasEncrypt = content.includes('/Encrypt');
      const hasUserPassword = content.includes('/U');
      const hasOwnerPassword = content.includes('/O');
      const isEncrypted = hasEncrypt || hasUserPassword || hasOwnerPassword;
      
      // Check for suspicious content
      const securityWarnings: string[] = [];
      const suspiciousPatterns = [
        '/JavaScript',
        '/JS',
        '/Launch',
        '/SubmitForm',
        '/ImportData',
        '/GoToE',
        '/GoToR'
      ];

      for (const pattern of suspiciousPatterns) {
        if (content.includes(pattern)) {
          securityWarnings.push(`PDF contains potentially unsafe content: ${pattern}`);
        }
      }
      
      // For now, we'll attempt conversion even on encrypted PDFs
      // pdf2pic may handle some encrypted PDFs automatically
      const allowConversion = true;
      
      return {
        isEncrypted,
        allowConversion,
        securityWarnings
      };
    } catch (error) {
      logger.warn('Failed to validate PDF security', { error });
      return {
        isEncrypted: false,
        allowConversion: true,
        securityWarnings: []
      };
    }
  }

  /**
   * Quick validation for basic format check
   */
  async quickValidate(buffer: Buffer): Promise<boolean> {
    try {
      const header = buffer.slice(0, 8).toString('ascii');
      return header.startsWith('%PDF') && buffer.length > 100;
    } catch {
      return false;
    }
  }

  /**
   * Fallback validation when primary validation fails
   */
  async fallbackValidation(buffer: Buffer): Promise<{ canProceed: boolean; warnings: string[] }> {
    const warnings: string[] = [];
    
    try {
      // Basic header check
      if (!buffer.slice(0, 4).toString().startsWith('%PDF')) {
        return { canProceed: false, warnings: ['Not a PDF file'] };
      }
      
      // Size check
      if (buffer.length < 1000) {
        return { canProceed: false, warnings: ['File too small'] };
      }
      
      // Try to find any PDF objects
      const content = buffer.toString('binary');
      if (!content.includes('obj')) {
        warnings.push('PDF structure may be unusual - conversion may fail');
      }
      
      warnings.push('Using fallback validation - some features may not work correctly');
      
      return { canProceed: true, warnings };
    } catch (error) {
      return { 
        canProceed: false, 
        warnings: [`Fallback validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      };
    }
  }

  /**
   * Validate PDF with robust error handling and fallback strategies
   */
  async validatePDFWithFallback(file: Express.Multer.File): Promise<ValidationResult> {
    try {
      // Try primary validation first
      const primaryResult = await this.validatePDF(file);
      
      // If primary validation passes or has only warnings, return it
      if (primaryResult.isValid || primaryResult.errors.length === 0) {
        return primaryResult;
      }
      
      // If primary validation fails with structural issues but the file might still be convertible
      const structuralErrors = primaryResult.errors.filter(error => 
        error.includes('structure') || 
        error.includes('corrupted') || 
        error.includes('trailer') ||
        error.includes('header') ||
        error.includes('objects') ||
        error.includes('PDF structure')
      );
      
      // Also allow fallback if the file is reasonably sized and has PDF signature
      const hasBasicPdfStructure = primaryResult.errors.some(error => 
        !error.includes('size') && 
        !error.includes('MIME') && 
        !error.includes('type') &&
        !error.includes('encrypted')
      );
      
      if ((structuralErrors.length > 0 && primaryResult.errors.length === structuralErrors.length) || 
          (hasBasicPdfStructure && primaryResult.errors.length <= 2)) {
        // Try fallback validation
        const fallbackResult = await this.fallbackValidation(file.buffer);
        
        if (fallbackResult.canProceed) {
          logger.info('Using fallback validation for potentially convertible PDF', {
            filename: file.originalname,
            primaryErrors: primaryResult.errors,
            fallbackWarnings: fallbackResult.warnings
          });
          
          return {
            isValid: true,
            errors: [],
            warnings: [
              ...primaryResult.warnings,
              ...fallbackResult.warnings,
              'PDF structure is non-standard but may still be convertible'
            ],
            fileInfo: primaryResult.fileInfo,
            metadata: primaryResult.metadata,
            recommendations: [
              'Conversion may fail or produce unexpected results',
              'Consider re-saving the PDF in a standard format',
              ...primaryResult.recommendations || []
            ]
          };
        }
      }
      
      // Return original validation result if fallback also fails
      return primaryResult;
      
    } catch (error) {
      logger.error('PDF validation with fallback failed', { 
        filename: file.originalname, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      
      return {
        isValid: false,
        errors: [`Validation system error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
        recommendations: ['Contact support if this error persists']
      };
    }
  }

  /**
   * Get detailed error information for debugging
   */
  getErrorDetails(error: unknown): {
    type: string;
    message: string;
    isRetryable: boolean;
    suggestions: string[];
  } {
    const message = error instanceof Error ? error.message : String(error);
    
    // Categorize errors
    if (message.includes('exceeds maximum') || message.includes('too large')) {
      return {
        type: 'size_limit',
        message,
        isRetryable: false,
        suggestions: [
          'Reduce the file size by compressing the PDF',
          'Split large PDFs into smaller files',
          'Remove unnecessary images or content'
        ]
      };
    }
    
    if (message.includes('encrypted') || message.includes('password')) {
      return {
        type: 'encryption',
        message,
        isRetryable: false,
        suggestions: [
          'Remove password protection from the PDF',
          'Save as an unencrypted version',
          'Use the original document before encryption'
        ]
      };
    }
    
    if (message.includes('corrupted') || message.includes('structure')) {
      return {
        type: 'corruption',
        message,
        isRetryable: true,
        suggestions: [
          'Try re-uploading the file',
          'Re-save the PDF from the original application',
          'Use PDF repair tools if available',
          'Check if the file was completely downloaded'
        ]
      };
    }
    
    if (message.includes('format') || message.includes('type')) {
      return {
        type: 'format',
        message,
        isRetryable: false,
        suggestions: [
          'Ensure the file is a valid PDF',
          'Convert the file to PDF format',
          'Check the file extension matches the content'
        ]
      };
    }
    
    return {
      type: 'unknown',
      message,
      isRetryable: true,
      suggestions: [
        'Try re-uploading the file',
        'Ensure the file is not corrupted',
        'Contact support if the problem persists'
      ]
    };
  }
}

export const validationService = new ValidationService();