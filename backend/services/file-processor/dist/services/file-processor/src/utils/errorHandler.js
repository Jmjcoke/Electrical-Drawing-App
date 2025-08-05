import { logger } from './logger.js';
export const errorHandler = (error, req, res, next) => {
    // Log error
    logger.error('Request error:', {
        message: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query
    });
    // Default error values
    let statusCode = error.statusCode || 500;
    let errorCode = error.code || 'INTERNAL_SERVER_ERROR';
    let message = error.message || 'An unexpected error occurred';
    // Handle specific error types
    if (error.message?.includes('File too large')) {
        statusCode = 413;
        errorCode = 'FILE_TOO_LARGE';
        message = 'File size exceeds the maximum allowed limit of 10MB';
    }
    else if (error.message?.includes('Only PDF files are allowed')) {
        statusCode = 400;
        errorCode = 'INVALID_FILE_TYPE';
        message = 'Only PDF files are allowed';
    }
    else if (error.message?.includes('Unexpected field')) {
        statusCode = 400;
        errorCode = 'INVALID_REQUEST';
        message = 'Invalid file field name. Use "file" as the field name.';
    }
    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        message = 'Internal server error';
    }
    const errorResponse = {
        error: {
            code: errorCode,
            message: message,
            timestamp: new Date().toISOString()
        }
    };
    res.status(statusCode).json(errorResponse);
};
//# sourceMappingURL=errorHandler.js.map