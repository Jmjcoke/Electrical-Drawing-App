import { fileTypeFromBuffer } from 'file-type';
import { logger } from '../utils/logger.js';
class ValidationService {
    constructor() {
        this.MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB (increased for electrical drawings)
        this.MIN_FILE_SIZE = 1024; // 1KB
        this.ALLOWED_MIME_TYPES = ['application/pdf'];
        this.MAX_PAGES = 20; // Maximum pages for conversion
    }
    async validatePDF(file) {
        const errors = [];
        const warnings = [];
        const recommendations = [];
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
                }
                else {
                    warnings.push(structureValidation.error || 'PDF structure warning');
                }
            }
            // Content analysis
            const contentAnalysis = this.analyzePDFContent(file.buffer);
            // Security validation
            const securityValidation = this.validateSecurity(file.buffer);
            if (securityValidation.isEncrypted && !securityValidation.allowConversion) {
                errors.push('PDF is password protected and cannot be converted');
            }
            else if (securityValidation.isEncrypted) {
                warnings.push('PDF is encrypted - conversion may fail or produce incomplete results');
                recommendations.push('Remove password protection for best conversion results');
            }
            // Page count validation
            if (contentAnalysis.estimatedPages > this.MAX_PAGES) {
                errors.push(`PDF has too many pages (${contentAnalysis.estimatedPages}). Maximum allowed: ${this.MAX_PAGES}`);
                recommendations.push('Consider splitting large PDFs into smaller files');
            }
            else if (contentAnalysis.estimatedPages > 10) {
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
            const result = {
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
            }
            else {
                logger.warn('PDF validation failed', {
                    filename: file.originalname,
                    errorsCount: errors.length,
                    errors: errors.join(', ')
                });
            }
            return result;
        }
        catch (error) {
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
    async validateFileSignature(buffer) {
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
        }
        catch (error) {
            return {
                isValid: false,
                error: 'Failed to validate file signature'
            };
        }
    }
    validatePDFStructure(buffer) {
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
                    error: 'PDF may be truncated - missing EOF marker',
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
        }
        catch (error) {
            return {
                isValid: false,
                error: 'Failed to validate PDF structure due to parsing error',
                isCorrupted: true
            };
        }
    }
    analyzePDFContent(buffer) {
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
            }
            else {
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
        }
        catch (error) {
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
    validateSecurity(buffer) {
        try {
            const content = buffer.toString('binary');
            // Check for encryption
            const hasEncrypt = content.includes('/Encrypt');
            const hasUserPassword = content.includes('/U');
            const hasOwnerPassword = content.includes('/O');
            const isEncrypted = hasEncrypt || hasUserPassword || hasOwnerPassword;
            // Check for suspicious content
            const securityWarnings = [];
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
        }
        catch (error) {
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
    async quickValidate(buffer) {
        try {
            const header = buffer.slice(0, 8).toString('ascii');
            return header.startsWith('%PDF') && buffer.length > 100;
        }
        catch {
            return false;
        }
    }
    /**
     * Fallback validation when primary validation fails
     */
    async fallbackValidation(buffer) {
        const warnings = [];
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
        }
        catch (error) {
            return {
                canProceed: false,
                warnings: [`Fallback validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
            };
        }
    }
}
export const validationService = new ValidationService();
//# sourceMappingURL=validation.service.js.map