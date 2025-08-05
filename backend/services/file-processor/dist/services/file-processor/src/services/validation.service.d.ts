export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    fileInfo?: {
        size: number;
        mimeType: string;
        detectedType?: string;
    };
}
declare class ValidationService {
    private readonly MAX_FILE_SIZE;
    private readonly MIN_FILE_SIZE;
    private readonly ALLOWED_MIME_TYPES;
    validatePDF(file: Express.Multer.File): Promise<ValidationResult>;
    private validateFileSignature;
    private validatePDFStructure;
}
export declare const validationService: ValidationService;
export {};
//# sourceMappingURL=validation.service.d.ts.map