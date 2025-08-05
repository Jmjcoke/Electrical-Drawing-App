import express from 'express';
import multer from 'multer';
import { uploadController } from '../controllers/upload.controller.js';

const router = express.Router();

// Configure multer for single file uploads
const uploadSingle = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 1 // Only allow 1 file
  },
  fileFilter: (req, file, cb) => {
    // Basic file type check (will be validated more thoroughly server-side)
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Configure multer for multi-file uploads
const uploadMultiple = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 3, // Allow up to 3 files
    fieldSize: 30 * 1024 * 1024 // 30MB total limit
  },
  fileFilter: (req, file, cb) => {
    // Basic file type check (will be validated more thoroughly server-side)
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Single file upload endpoint
router.post('/upload', uploadSingle.single('file'), uploadController.uploadFile.bind(uploadController));

// Multi-file upload endpoint
router.post('/upload-multiple', uploadMultiple.array('files'), uploadController.uploadMultipleFiles.bind(uploadController));

// Get upload status
router.get('/upload/:fileId', uploadController.getUploadStatus.bind(uploadController));

// Get converted images for a document
router.get('/sessions/:sessionId/documents/:documentId/images', uploadController.getConvertedImages.bind(uploadController));

export default router;