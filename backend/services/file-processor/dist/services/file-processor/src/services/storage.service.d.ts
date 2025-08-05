export interface StoredFile {
    fileId: string;
    path: string;
    originalName: string;
    size: number;
    storedAt: string;
    expiresAt: string;
}
declare class StorageService {
    private readonly UPLOAD_DIR;
    private readonly TEMP_FILE_EXPIRY_HOURS;
    private storedFiles;
    constructor();
    private ensureUploadDirectory;
    storeTemporary(file: Express.Multer.File, fileId: string): Promise<StoredFile>;
    getFileInfo(fileId: string): Promise<StoredFile | null>;
    deleteFile(fileId: string): Promise<void>;
    private startCleanupScheduler;
    private cleanupExpiredFiles;
}
export declare const storageService: StorageService;
export {};
//# sourceMappingURL=storage.service.d.ts.map