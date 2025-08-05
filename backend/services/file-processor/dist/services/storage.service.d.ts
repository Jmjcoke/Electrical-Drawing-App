import { CleanupJob } from '../types/api.types.js';
export interface StoredFile {
    fileId: string;
    path: string;
    originalName: string;
    size: number;
    storedAt: string;
    expiresAt: string;
}
export interface ConvertedImages {
    documentId: string;
    sessionId: string;
    imagePaths: string[];
    storedAt: Date;
    expiresAt: Date;
    totalSize: number;
}
declare class StorageService {
    private readonly UPLOAD_DIR;
    private readonly STORAGE_BASE;
    private readonly TEMP_FILE_EXPIRY_HOURS;
    private readonly DISK_SPACE_ALERT_THRESHOLD;
    private storedFiles;
    private convertedImages;
    private cleanupQueue;
    private redis;
    private cleanupInterval?;
    private cleanupTimeout?;
    constructor(redisUrl?: string);
    private ensureDirectories;
    /**
     * Setup Bull queue jobs for scheduled cleanup
     */
    private setupCleanupJobs;
    /**
     * Start monitoring storage usage
     */
    private startStorageMonitoring;
    /**
     * Store converted images with metadata
     */
    storeConvertedImages(documentId: string, sessionId: string, imagePaths: string[]): Promise<ConvertedImages>;
    /**
     * Get converted images for a document
     */
    getConvertedImages(documentId: string): Promise<ConvertedImages | null>;
    /**
     * Update storage usage metrics
     */
    private updateStorageMetrics;
    /**
     * Get total size of directory
     */
    private getDirectorySize;
    /**
     * Check disk space and alert if threshold exceeded
     */
    private checkDiskSpace;
    /**
     * Process hourly cleanup job
     */
    private processHourlyCleanup;
    /**
     * Process daily cleanup job
     */
    private processDailyCleanup;
    /**
     * Process weekly deep cleanup job
     */
    private processWeeklyCleanup;
    /**
     * Clean up orphaned converted images
     */
    private cleanupOrphanedImages;
    /**
     * Optimize storage by compressing old logs
     */
    private optimizeStorage;
    /**
     * Deep clean storage - rebuild indexes, vacuum databases
     */
    private deepCleanStorage;
    /**
     * Clean up all files for a specific session
     */
    cleanupSession(sessionId: string): Promise<CleanupJob>;
    storeTemporary(file: Express.Multer.File, fileId: string): Promise<StoredFile>;
    getFileInfo(fileId: string): Promise<StoredFile | null>;
    deleteFile(fileId: string): Promise<void>;
    private startCleanupScheduler;
    stopCleanupScheduler(): void;
    private cleanupExpiredFiles;
    /**
     * Get storage health status
     */
    getHealthStatus(): Promise<{
        status: string;
        metrics: Record<string, number>;
    }>;
    /**
     * Graceful shutdown
     */
    shutdown(): Promise<void>;
}
export declare const storageService: StorageService;
export {};
//# sourceMappingURL=storage.service.d.ts.map