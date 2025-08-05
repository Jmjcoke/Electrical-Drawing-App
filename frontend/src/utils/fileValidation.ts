/**
 * Enhanced file validation utilities for PDF uploads
 * Provides comprehensive validation including magic bytes checking and advanced error handling
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileInfo?: {
    actualType: string;
    estimatedPages?: number;
    isEncrypted: boolean;
  };
}

export interface ValidationOptions {
  maxFileSize?: number;
  maxTotalSize?: number;
  maxFiles?: number;
  allowedTypes?: string[];
  checkMagicBytes?: boolean;
  strictPdfValidation?: boolean;
}

// PDF magic bytes (header signatures)
const PDF_MAGIC_BYTES = [
  [0x25, 0x50, 0x44, 0x46], // %PDF
];

// Other common file type signatures for better error messages
const FILE_SIGNATURES = {
  JPEG: [0xFF, 0xD8, 0xFF],
  PNG: [0x89, 0x50, 0x4E, 0x47],
  GIF: [0x47, 0x49, 0x46],
  ZIP: [0x50, 0x4B, 0x03, 0x04],
  DOC: [0xD0, 0xCF, 0x11, 0xE0],
  DOCX: [0x50, 0x4B, 0x03, 0x04], // ZIP-based
};

/**
 * Read the first few bytes of a file to check its signature
 */
const readFileHeader = (file: File): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      resolve(new Uint8Array(arrayBuffer.slice(0, 16)));
    };
    reader.onerror = () => reject(new Error('Failed to read file header'));
    reader.readAsArrayBuffer(file.slice(0, 16));
  });
};

/**
 * Check if file header matches PDF magic bytes
 */
const matchesPdfSignature = (header: Uint8Array): boolean => {
  for (const signature of PDF_MAGIC_BYTES) {
    if (signature.every((byte, index) => header[index] === byte)) {
      return true;
    }
  }
  return false;
};

/**
 * Detect actual file type based on magic bytes
 */
const detectFileType = (header: Uint8Array): string => {
  if (matchesPdfSignature(header)) return 'application/pdf';
  
  for (const [type, signature] of Object.entries(FILE_SIGNATURES)) {
    if (signature.every((byte, index) => header[index] === byte)) {
      return type.toLowerCase();
    }
  }
  
  return 'unknown';
};

/**
 * Enhanced PDF structure validation
 */
const validatePdfStructure = async (file: File): Promise<{ isValid: boolean; isEncrypted: boolean; estimatedPages?: number }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      
      // Check for PDF version declaration
      const hasVersionDeclaration = /^%PDF-\d\.\d/.test(text);
      
      // Check for end of file marker
      const hasEOFMarker = text.includes('%%EOF');
      
      // Check for encryption
      const isEncrypted = text.includes('/Encrypt') || text.includes('/Filter/Standard');
      
      // Estimate page count (rough approximation)
      const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
      const estimatedPages = pageMatches ? pageMatches.length : undefined;
      
      const isValid = hasVersionDeclaration && hasEOFMarker;
      
      resolve({ isValid, isEncrypted, estimatedPages });
    };
    reader.onerror = () => resolve({ isValid: false, isEncrypted: false });
    reader.readAsText(file.slice(0, Math.min(file.size, 100000))); // Read first 100KB
  });
};

/**
 * Validate a single file with comprehensive checks
 */
export const validateSingleFile = async (
  file: File, 
  options: ValidationOptions = {}
): Promise<ValidationResult> => {
  const {
    maxFileSize = 10 * 1024 * 1024, // 10MB
    allowedTypes = ['application/pdf'],
    checkMagicBytes = true,
    strictPdfValidation = true
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];
  let fileInfo: ValidationResult['fileInfo'];

  // Basic file checks
  if (!file) {
    errors.push('No file provided');
    return { isValid: false, errors, warnings };
  }

  if (!file.name) {
    errors.push('File must have a name');
  }

  if (file.size === 0) {
    errors.push('File appears to be empty');
    return { isValid: false, errors, warnings };
  }

  if (file.size < 1024) {
    errors.push('File is too small to be a valid PDF (minimum 1KB)');
  }

  if (file.size > maxFileSize) {
    errors.push(
      `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed size (${(maxFileSize / 1024 / 1024).toFixed(1)}MB)`
    );
  }

  // MIME type check
  if (!allowedTypes.includes(file.type)) {
    errors.push(`File type "${file.type}" is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }

  // File extension check
  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.pdf')) {
    errors.push('File must have a .pdf extension');
  }

  // Advanced validation for PDF files
  if (checkMagicBytes && file.type === 'application/pdf') {
    try {
      const header = await readFileHeader(file);
      const actualType = detectFileType(header);
      
      fileInfo = {
        actualType,
        isEncrypted: false
      };

      if (actualType !== 'application/pdf') {
        errors.push(
          `File appears to be ${actualType} but has PDF extension. Please ensure the file is a valid PDF.`
        );
      }

      // Detailed PDF validation
      if (strictPdfValidation && actualType === 'application/pdf') {
        const pdfValidation = await validatePdfStructure(file);
        fileInfo.isEncrypted = pdfValidation.isEncrypted;
        fileInfo.estimatedPages = pdfValidation.estimatedPages;

        if (!pdfValidation.isValid) {
          errors.push('PDF file appears to be corrupted or invalid');
        }

        if (pdfValidation.isEncrypted) {
          warnings.push('PDF file is encrypted - some features may not work correctly');
        }

        if (pdfValidation.estimatedPages && pdfValidation.estimatedPages > 50) {
          warnings.push(`PDF has many pages (${pdfValidation.estimatedPages}) - processing may take longer`);
        }
      }
    } catch (error) {
      warnings.push('Could not perform advanced file validation');
    }
  }

  // File name validation
  if (file.name.length > 255) {
    errors.push('File name is too long (maximum 255 characters)');
  }

  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(file.name)) {
    errors.push('File name contains invalid characters');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    fileInfo
  };
};

/**
 * Validate multiple files including cross-file validation
 */
export const validateMultipleFiles = async (
  files: File[],
  options: ValidationOptions = {}
): Promise<ValidationResult> => {
  const {
    maxFiles = 3,
    maxTotalSize = 30 * 1024 * 1024, // 30MB
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file count
  if (files.length === 0) {
    errors.push('No files provided');
    return { isValid: false, errors, warnings };
  }

  if (files.length > maxFiles) {
    errors.push(`Too many files (${files.length}). Maximum ${maxFiles} files allowed.`);
  }

  // Check total size
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > maxTotalSize) {
    errors.push(
      `Total file size (${(totalSize / 1024 / 1024).toFixed(1)}MB) exceeds maximum (${(maxTotalSize / 1024 / 1024).toFixed(1)}MB)`
    );
  }

  // Check for duplicate file names
  const fileNames = files.map(f => f.name.toLowerCase());
  const duplicates = fileNames.filter((name, index) => fileNames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate file names detected: ${[...new Set(duplicates)].join(', ')}`);
  }

  // Validate each file individually
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const validation = await validateSingleFile(file, options);
    
    if (!validation.isValid) {
      validation.errors.forEach(error => {
        errors.push(`File "${file.name}": ${error}`);
      });
    }

    validation.warnings.forEach(warning => {
      warnings.push(`File "${file.name}": ${warning}`);
    });
  }

  // Additional multi-file warnings
  if (files.length === maxFiles) {
    warnings.push('Maximum file limit reached - cannot add more files');
  }

  if (totalSize > maxTotalSize * 0.8) {
    warnings.push('Approaching total size limit - consider smaller files');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Format validation errors for user display
 */
export const formatValidationErrors = (validation: ValidationResult): string => {
  if (validation.isValid) {
    return '';
  }

  const errorCount = validation.errors.length;
  const warningCount = validation.warnings.length;

  let message = '';

  if (errorCount > 0) {
    message += `${errorCount} error${errorCount > 1 ? 's' : ''} found:\n`;
    validation.errors.forEach((error, index) => {
      message += `${index + 1}. ${error}\n`;
    });
  }

  if (warningCount > 0) {
    if (message) message += '\n';
    message += `${warningCount} warning${warningCount > 1 ? 's' : ''}:\n`;
    validation.warnings.forEach((warning, index) => {
      message += `${index + 1}. ${warning}\n`;
    });
  }

  return message.trim();
};

/**
 * Check if error is a known validation error type
 */
export const getErrorCategory = (error: string): 'size' | 'type' | 'count' | 'corruption' | 'permission' | 'network' | 'unknown' => {
  const lowerError = error.toLowerCase();
  
  if (lowerError.includes('size') || lowerError.includes('mb') || lowerError.includes('large')) {
    return 'size';
  }
  if (lowerError.includes('type') || lowerError.includes('format') || lowerError.includes('extension')) {
    return 'type';
  }
  if (lowerError.includes('many') || lowerError.includes('count') || lowerError.includes('limit')) {
    return 'count';
  }
  if (lowerError.includes('corrupt') || lowerError.includes('invalid') || lowerError.includes('damaged')) {
    return 'corruption';
  }
  if (lowerError.includes('permission') || lowerError.includes('access') || lowerError.includes('forbidden')) {
    return 'permission';
  }
  if (lowerError.includes('network') || lowerError.includes('connection') || lowerError.includes('timeout')) {
    return 'network';
  }
  
  return 'unknown';
};

/**
 * Suggest fixes for common validation errors
 */
export const getSuggestions = (error: string): string[] => {
  const category = getErrorCategory(error);
  const suggestions: string[] = [];

  switch (category) {
    case 'size':
      suggestions.push('Try compressing the PDF file');
      suggestions.push('Split large documents into smaller files');
      suggestions.push('Remove high-resolution images if possible');
      break;
    case 'type':
      suggestions.push('Ensure the file is saved as a PDF');
      suggestions.push('Try converting the file to PDF format');
      suggestions.push('Check that the file extension is .pdf');
      break;
    case 'count':
      suggestions.push(`Remove some files (maximum ${3} allowed)`);
      suggestions.push('Upload files in separate batches');
      break;
    case 'corruption':
      suggestions.push('Try opening the file in a PDF viewer first');
      suggestions.push('Re-save or re-export the file');
      suggestions.push('Create a new PDF from the original source');
      break;
    case 'network':
      suggestions.push('Check your internet connection');
      suggestions.push('Try uploading again');
      suggestions.push('Try uploading fewer files at once');
      break;
    default:
      suggestions.push('Please try again');
      suggestions.push('Contact support if the problem persists');
  }

  return suggestions;
};