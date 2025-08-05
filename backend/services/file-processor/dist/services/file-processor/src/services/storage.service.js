import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
class StorageService {
    constructor() {
        this.UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
        this.TEMP_FILE_EXPIRY_HOURS = 24; // Files expire after 24 hours
        this.storedFiles = new Map(); // In-memory storage for demo
        this.ensureUploadDirectory();
        this.startCleanupScheduler();
    }
    async ensureUploadDirectory() {
        try {
            await fs.access(this.UPLOAD_DIR);
        }
        catch {
            await fs.mkdir(this.UPLOAD_DIR, { recursive: true });
            logger.info(`Created upload directory: ${this.UPLOAD_DIR}`);
        }
    }
    async storeTemporary(file, fileId) {
        try {
            const fileName = `${fileId}_${file.originalname}`;
            const filePath = path.join(this.UPLOAD_DIR, fileName);
            // Write file to disk
            await fs.writeFile(filePath, file.buffer);
            const storedFile = {
                fileId,
                path: filePath,
                originalName: file.originalname,
                size: file.size,
                storedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + this.TEMP_FILE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()
            };
            // Store metadata in memory (in production, this would be in a database)
            this.storedFiles.set(fileId, storedFile);
            logger.info(`File stored temporarily: ${filePath}, expires: ${storedFile.expiresAt}`);
            return storedFile;
        }
        catch (error) {
            logger.error(`Failed to store file ${fileId}:`, error);
            throw new Error('Failed to store file');
        }
    }
    async getFileInfo(fileId) {
        return this.storedFiles.get(fileId) || null;
    }
    async deleteFile(fileId) {
        try {
            const storedFile = this.storedFiles.get(fileId);
            if (storedFile) {
                await fs.unlink(storedFile.path);
                this.storedFiles.delete(fileId);
                logger.info(`Deleted file: ${storedFile.path}`);
            }
        }
        catch (error) {
            logger.error(`Failed to delete file ${fileId}:`, error);
        }
    }
    startCleanupScheduler() {
        // Run cleanup every hour
        setInterval(() => {
            this.cleanupExpiredFiles();
        }, 60 * 60 * 1000);
        // Run initial cleanup after 1 minute
        setTimeout(() => {
            this.cleanupExpiredFiles();
        }, 60 * 1000);
    }
    async cleanupExpiredFiles() {
        const now = new Date();
        const expiredFiles = [];
        for (const [fileId, storedFile] of this.storedFiles.entries()) {
            if (new Date(storedFile.expiresAt) < now) {
                expiredFiles.push(fileId);
            }
        }
        for (const fileId of expiredFiles) {
            await this.deleteFile(fileId);
        }
        if (expiredFiles.length > 0) {
            logger.info(`Cleaned up ${expiredFiles.length} expired files`);
        }
    }
}
export const storageService = new StorageService();
//# sourceMappingURL=storage.service.js.map