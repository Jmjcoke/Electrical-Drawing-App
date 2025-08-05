import fs from 'fs/promises';
import { logger } from '../utils/logger.js';
class FileService {
    async processFile(filePath, originalFile) {
        try {
            logger.info(`Processing file: ${filePath}`);
            // Extract basic metadata
            const stats = await fs.stat(filePath);
            const fileInfo = {
                path: filePath,
                metadata: {
                    size: stats.size,
                    processedAt: new Date().toISOString()
                }
            };
            // TODO: In future stories, add PDF page count extraction
            // TODO: In future stories, add preview image generation
            // TODO: In future stories, add PDF-to-image conversion for LLM processing
            logger.info(`File processing completed: ${filePath}`);
            return fileInfo;
        }
        catch (error) {
            logger.error(`File processing failed for ${filePath}:`, error);
            throw new Error('File processing failed');
        }
    }
    async cleanupFile(filePath) {
        try {
            await fs.unlink(filePath);
            logger.info(`Cleaned up file: ${filePath}`);
        }
        catch (error) {
            logger.error(`Failed to cleanup file ${filePath}:`, error);
            // Don't throw error for cleanup failures
        }
    }
}
export const fileService = new FileService();
//# sourceMappingURL=file.service.js.map