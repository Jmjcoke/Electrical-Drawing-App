import { fileTypeFromBuffer } from 'file-type';
import { logger } from '../utils/logger.js';
class ValidationService {
    constructor() {
        this.MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        this.MIN_FILE_SIZE = 1024; // 1KB
        this.ALLOWED_MIME_TYPES = ['application/pdf'];
    }
    async validatePDF(file) {
        const errors = [];
        try {
            // Validate file size
            if (file.size > this.MAX_FILE_SIZE) {
                errors.push(`File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds maximum allowed size of 10MB`);
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
            // Validate PDF structure
            const structureValidation = this.validatePDFStructure(file.buffer);
            if (!structureValidation.isValid) {
                errors.push(structureValidation.error || 'Invalid PDF structure');
            }
            const result = {
                isValid: errors.length === 0,
                errors,
                fileInfo: {
                    size: file.size,
                    mimeType: file.mimetype,
                    detectedType: signatureValidation.detectedType
                }
            };
            if (result.isValid) {
                logger.info(`File validation passed: ${file.originalname}`);
            }
            else {
                logger.warn(`File validation failed: ${file.originalname}, errors: ${errors.join(', ')}`);
            }
            return result;
        }
        catch (error) {
            logger.error('File validation error:', error);
            return {
                isValid: false,
                errors: ['File validation failed due to internal error']
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
            const pdfHeader = buffer.slice(0, 4).toString();
            if (!pdfHeader.startsWith('%PDF')) {
                return {
                    isValid: false,
                    error: 'Missing PDF header'
                };
            }
            // Check for PDF trailer (should end with %%EOF)
            const lastBytes = buffer.slice(-10).toString();
            if (!lastBytes.includes('%%EOF')) {
                return {
                    isValid: false,
                    error: 'Invalid PDF trailer'
                };
            }
            // Basic check for required PDF objects
            const content = buffer.toString('binary');
            if (!content.includes('obj') || !content.includes('endobj')) {
                return {
                    isValid: false,
                    error: 'Missing required PDF objects'
                };
            }
            return { isValid: true };
        }
        catch (error) {
            return {
                isValid: false,
                error: 'Failed to validate PDF structure'
            };
        }
    }
}
export const validationService = new ValidationService();
//# sourceMappingURL=validation.service.js.map