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
declare class ValidationService {
    private readonly MAX_FILE_SIZE;
    private readonly MIN_FILE_SIZE;
    private readonly ALLOWED_MIME_TYPES;
    private readonly MAX_PAGES;
    validatePDF(file: Express.Multer.File): Promise<ValidationResult>;
    private validateFileSignature;
    private validatePDFStructure;
    private analyzePDFContent;
    private validateSecurity;
    /**
     * Quick validation for basic format check
     */
    quickValidate(buffer: Buffer): Promise<boolean>;
    /**
     * Fallback validation when primary validation fails
     */
    fallbackValidation(buffer: Buffer): Promise<{
        canProceed: boolean;
        warnings: string[];
    }>;
}
export declare const validationService: ValidationService;
export {};
//# sourceMappingURL=validation.service.d.ts.map