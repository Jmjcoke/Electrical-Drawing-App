export interface ProcessedFileInfo {
    path: string;
    previewUrl?: string;
    metadata: {
        pages?: number;
        size: number;
        processedAt: string;
    };
}
declare class FileService {
    processFile(filePath: string, originalFile: Express.Multer.File): Promise<ProcessedFileInfo>;
    cleanupFile(filePath: string): Promise<void>;
}
export declare const fileService: FileService;
export {};
//# sourceMappingURL=file.service.d.ts.map