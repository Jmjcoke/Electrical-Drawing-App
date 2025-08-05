import { v4 as uuidv4 } from 'uuid';
import { fileService } from '../services/file.service.js';
import { validationService } from '../services/validation.service.js';
import { storageService } from '../services/storage.service.js';
import { logger } from '../utils/logger.js';
export class UploadController {
    async uploadFile(req, res, next) {
        try {
            // Check if file was uploaded
            if (!req.file) {
                res.status(400).json({
                    error: {
                        code: 'NO_FILE_UPLOADED',
                        message: 'No file was uploaded',
                        timestamp: new Date().toISOString()
                    }
                });
                return;
            }
            const file = req.file;
            const fileId = uuidv4();
            logger.info(`Processing upload for file: ${file.originalname}, size: ${file.size}`);
            // Validate file
            const validationResult = await validationService.validatePDF(file);
            if (!validationResult.isValid) {
                res.status(400).json({
                    error: {
                        code: 'INVALID_FILE',
                        message: validationResult.errors.join(', '),
                        timestamp: new Date().toISOString()
                    }
                });
                return;
            }
            // Store file temporarily
            const storedFile = await storageService.storeTemporary(file, fileId);
            // Generate session ID for single upload
            const sessionId = uuidv4();
            // Process file (extract metadata, create preview, and convert PDF to images)
            const fileInfo = await fileService.processFile(storedFile.path, file, sessionId, fileId);
            const response = {
                success: true,
                fileId: fileId,
                originalName: file.originalname,
                size: file.size,
                mimeType: file.mimetype,
                uploadedAt: new Date().toISOString(),
                previewUrl: fileInfo.previewUrl
            };
            logger.info(`Upload successful for file: ${file.originalname}, fileId: ${fileId}`);
            res.status(200).json(response);
        }
        catch (error) {
            logger.error('Upload failed:', error);
            next(error);
        }
    }
    async uploadMultipleFiles(req, res, next) {
        try {
            // Check if files were uploaded
            if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
                res.status(400).json({
                    error: {
                        code: 'NO_FILES_UPLOADED',
                        message: 'No files were uploaded',
                        timestamp: new Date().toISOString()
                    }
                });
                return;
            }
            const files = req.files;
            const sessionId = req.session?.id || uuidv4(); // Use session ID or generate one
            // Validate file count
            if (files.length > 3) {
                res.status(400).json({
                    error: {
                        code: 'TOO_MANY_FILES',
                        message: 'Maximum 3 files allowed per upload',
                        timestamp: new Date().toISOString()
                    }
                });
                return;
            }
            // Validate total size
            const totalSize = files.reduce((sum, file) => sum + file.size, 0);
            const maxTotalSize = 30 * 1024 * 1024; // 30MB
            if (totalSize > maxTotalSize) {
                res.status(400).json({
                    error: {
                        code: 'TOTAL_SIZE_EXCEEDED',
                        message: `Total file size exceeds maximum of ${maxTotalSize / 1024 / 1024}MB`,
                        timestamp: new Date().toISOString()
                    }
                });
                return;
            }
            logger.info(`Processing multi-file upload: ${files.length} files, total size: ${totalSize}`);
            // Process all files concurrently
            const uploadPromises = files.map(async (file) => {
                const fileId = uuidv4();
                try {
                    // Validate file
                    const validationResult = await validationService.validatePDF(file);
                    if (!validationResult.isValid) {
                        throw new Error(`Validation failed for ${file.originalname}: ${validationResult.errors.join(', ')}`);
                    }
                    // Store file temporarily
                    const storedFile = await storageService.storeTemporary(file, fileId);
                    // Process file (extract metadata, create preview, and convert PDF to images)
                    const fileInfo = await fileService.processFile(storedFile.path, file, sessionId, fileId);
                    const uploadedFile = {
                        fileId: fileId,
                        originalName: file.originalname,
                        size: file.size,
                        mimeType: file.mimetype,
                        uploadedAt: new Date().toISOString(),
                        previewUrl: fileInfo.previewUrl,
                        imagePaths: fileInfo.imagePaths,
                        processingStatus: fileInfo.conversionResult?.success ? 'ready' : 'error',
                        conversionStatus: fileInfo.conversionResult?.success ? 'completed' :
                            fileInfo.conversionResult ? 'failed' : 'pending',
                        conversionDurationMs: fileInfo.metadata.conversionDurationMs,
                        pageCount: fileInfo.metadata.pages
                    };
                    logger.info(`File processed successfully: ${file.originalname}, fileId: ${fileId}`);
                    return uploadedFile;
                }
                catch (error) {
                    logger.error(`Failed to process file ${file.originalname}:`, error);
                    // Return error file info
                    const uploadedFile = {
                        fileId: fileId,
                        originalName: file.originalname,
                        size: file.size,
                        mimeType: file.mimetype,
                        uploadedAt: new Date().toISOString(),
                        processingStatus: 'error'
                    };
                    return uploadedFile;
                }
            });
            // Wait for all uploads to complete
            const uploadedFiles = await Promise.all(uploadPromises);
            // Check if any files failed
            const failedFiles = uploadedFiles.filter((file) => file.processingStatus === 'error');
            if (failedFiles.length === uploadedFiles.length) {
                // All files failed
                res.status(400).json({
                    error: {
                        code: 'UPLOAD_FAILED',
                        message: 'All files failed to upload',
                        details: { failedFiles: failedFiles.map((f) => f.originalName) },
                        timestamp: new Date().toISOString()
                    }
                });
                return;
            }
            const response = {
                success: true,
                files: uploadedFiles,
                totalSize: totalSize,
                sessionId: sessionId
            };
            if (failedFiles.length > 0) {
                logger.warn(`Partial upload failure: ${failedFiles.length}/${uploadedFiles.length} files failed`);
                // Could set a different status code for partial failures if needed
            }
            logger.info(`Multi-file upload successful: ${uploadedFiles.length - failedFiles.length}/${uploadedFiles.length} files uploaded`);
            res.status(200).json(response);
        }
        catch (error) {
            logger.error('Multi-file upload failed:', error);
            next(error);
        }
    }
    async getUploadStatus(req, res, next) {
        try {
            const { fileId } = req.params;
            if (!fileId || fileId.trim() === '') {
                res.status(400).json({
                    error: {
                        code: 'MISSING_FILE_ID',
                        message: 'File ID is required',
                        timestamp: new Date().toISOString()
                    }
                });
                return;
            }
            const fileInfo = await storageService.getFileInfo(fileId);
            if (!fileInfo) {
                res.status(404).json({
                    error: {
                        code: 'FILE_NOT_FOUND',
                        message: 'File not found',
                        timestamp: new Date().toISOString()
                    }
                });
                return;
            }
            // Get processing status including conversion info
            const processingStatus = await fileService.getProcessingStatus(fileId);
            res.status(200).json({
                ...fileInfo,
                ...processingStatus
            });
        }
        catch (error) {
            logger.error('Failed to get upload status:', error);
            next(error);
        }
    }
    async getConvertedImages(req, res, next) {
        try {
            const { sessionId, documentId } = req.params;
            if (!sessionId || !documentId) {
                res.status(400).json({
                    error: {
                        code: 'MISSING_PARAMETERS',
                        message: 'Session ID and Document ID are required',
                        timestamp: new Date().toISOString()
                    }
                });
                return;
            }
            const imagePaths = await fileService.getConvertedImages(documentId);
            const convertedImages = await storageService.getConvertedImages(documentId);
            if (!convertedImages || imagePaths.length === 0) {
                res.status(404).json({
                    error: {
                        code: 'IMAGES_NOT_FOUND',
                        message: 'Converted images not found for this document',
                        timestamp: new Date().toISOString()
                    }
                });
                return;
            }
            // Create response with image URLs and metadata
            const response = {
                documentId,
                sessionId,
                images: imagePaths.map((imagePath, index) => ({
                    page: index + 1,
                    path: imagePath,
                    url: `/api/v1/sessions/${sessionId}/documents/${documentId}/images/${index + 1}`,
                    dimensions: {
                        width: 0, // Would need image processing library
                        height: 0,
                        dpi: 300
                    }
                })),
                metadata: {
                    conversionTimestamp: convertedImages.storedAt,
                    totalSize: convertedImages.totalSize,
                    pageCount: imagePaths.length
                }
            };
            res.status(200).json(response);
        }
        catch (error) {
            logger.error('Failed to get converted images:', error);
            next(error);
        }
    }
}
export const uploadController = new UploadController();
//# sourceMappingURL=upload.controller.js.map