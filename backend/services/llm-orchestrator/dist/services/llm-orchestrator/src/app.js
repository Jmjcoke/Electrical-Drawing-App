"use strict";
/**
 * LLM Orchestrator Service - Main Application
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const multer_1 = __importDefault(require("multer"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const pg_1 = require("pg");
const analysis_controller_1 = require("./controllers/analysis.controller");
const context_chat_controller_1 = require("./controllers/context-chat.controller");
const symbol_detection_controller_1 = require("./controllers/symbol-detection.controller");
const symbol_detector_1 = require("./detection/symbol-detector");
const context_websocket_service_1 = require("./websocket/context-websocket.service");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const PORT = process.env.PORT || 3002;
// Initialize Socket.io
const io = new socket_io_1.Server(server, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});
// Initialize context WebSocket service
context_websocket_service_1.contextWebSocketService.initialize(io);
// Configure multer for file uploads
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        }
        else {
            cb(new Error('Only PDF files are allowed'));
        }
    },
});
// Initialize Database Connection
const database = new pg_1.Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'electrical_analysis',
    password: process.env.DB_PASSWORD || 'password',
    port: parseInt(process.env.DB_PORT || '5432'),
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
    connectionTimeoutMillis: 2000, // How long to wait when connecting a client
});
// Test database connection
database.connect()
    .then(client => {
    console.log('✅ Database connected successfully');
    client.release();
})
    .catch(err => {
    console.error('❌ Database connection failed:', err);
    process.exit(1);
});
// Initialize Symbol Detection Service with database
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
};
const symbolDetectionService = new symbol_detector_1.SymbolDetectionService(redisConfig, database);
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
}));
// Compression middleware
app.use((0, compression_1.default)());
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Global rate limiting (backup protection)
const globalRateLimit = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: {
        error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests from this IP, please try again later.',
            timestamp: new Date().toISOString(),
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(globalRateLimit);
// Request logging middleware
app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
    next();
});
// Initialize controllers
const analysisController = new analysis_controller_1.AnalysisController();
const contextChatController = new context_chat_controller_1.ContextChatController();
const symbolDetectionController = new symbol_detection_controller_1.SymbolDetectionController(symbolDetectionService);
// API Routes
// Image analysis routes
app.post('/api/v1/analysis/images', analysisController.analyzeImages);
app.get('/api/v1/analysis/status/:analysisId', analysisController.getAnalysisStatus);
app.get('/api/v1/analysis/templates', analysisController.listTemplates);
// NLP processing routes
app.post('/api/v1/nlp/process-query', analysisController.processQuery);
app.post('/api/v1/nlp/suggestions', analysisController.getSuggestions);
app.get('/api/v1/nlp/stats', analysisController.getNLPStats);
// Context-aware chat routes
app.post('/api/v1/context/chat', contextChatController.processChatQuery);
app.post('/api/v1/context/suggestions', contextChatController.getContextualSuggestions);
app.get('/api/v1/context/history/:sessionId', contextChatController.getConversationHistory);
app.delete('/api/v1/context/reset/:sessionId', contextChatController.resetConversationContext);
app.get('/api/v1/context/health/:sessionId?', contextChatController.getContextHealth);
// Symbol Detection routes
app.post('/api/v1/sessions/:sessionId/documents/:documentId/detect-symbols', upload.single('pdf'), symbolDetectionController.startDetection);
app.get('/api/v1/sessions/:sessionId/detection-results/:resultId', symbolDetectionController.getDetectionResult);
app.get('/api/v1/sessions/:sessionId/detection-results', symbolDetectionController.listDetectionResults);
app.get('/api/v1/sessions/:sessionId/detection-jobs/:jobId/status', symbolDetectionController.getJobStatus);
app.delete('/api/v1/sessions/:sessionId/detection-jobs/:jobId', symbolDetectionController.cancelDetection);
app.put('/api/v1/sessions/:sessionId/detection-results/:resultId/validate', symbolDetectionController.validateDetectionResult);
app.delete('/api/v1/sessions/:sessionId/detection-results/:resultId', symbolDetectionController.deleteDetectionResult);
app.get('/api/v1/symbol-library', symbolDetectionController.getSymbolLibrary);
app.post('/api/v1/symbol-library/validate', symbolDetectionController.validateCustomSymbol);
app.get('/api/v1/detection-queue/stats', symbolDetectionController.getQueueStatistics);
// System health
app.get('/api/v1/health', analysisController.healthCheck);
// Root endpoint
app.get('/', (_req, res) => {
    res.json({
        service: 'LLM Orchestrator',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        endpoints: [
            'POST /api/v1/analysis/images',
            'GET /api/v1/analysis/status/:analysisId',
            'GET /api/v1/analysis/templates',
            'POST /api/v1/nlp/process-query',
            'POST /api/v1/nlp/suggestions',
            'GET /api/v1/nlp/stats',
            'POST /api/v1/context/chat',
            'POST /api/v1/context/suggestions',
            'GET /api/v1/context/history/:sessionId',
            'DELETE /api/v1/context/reset/:sessionId',
            'GET /api/v1/context/health/:sessionId?',
            'POST /api/v1/sessions/:sessionId/documents/:documentId/detect-symbols',
            'GET /api/v1/sessions/:sessionId/detection-results/:resultId',
            'GET /api/v1/sessions/:sessionId/detection-results',
            'GET /api/v1/sessions/:sessionId/detection-jobs/:jobId/status',
            'DELETE /api/v1/sessions/:sessionId/detection-jobs/:jobId',
            'PUT /api/v1/sessions/:sessionId/detection-results/:resultId/validate',
            'DELETE /api/v1/sessions/:sessionId/detection-results/:resultId',
            'GET /api/v1/symbol-library',
            'POST /api/v1/symbol-library/validate',
            'GET /api/v1/detection-queue/stats',
            'GET /api/v1/health',
        ]
    });
});
// Setup WebSocket event handlers for symbol detection
io.on('connection', (socket) => {
    console.log('Client connected for symbol detection:', socket.id);
    // Handle symbol detection WebSocket events
    socket.on('start-symbol-detection', async (data) => {
        try {
            console.log('Symbol detection started via WebSocket:', data);
            // This would typically be handled through the REST API
            // WebSocket is primarily used for progress updates
            socket.emit('symbol-detection-error', {
                jobId: 'websocket-not-supported',
                error: 'Symbol detection must be started via REST API, WebSocket used for progress updates only'
            });
        }
        catch (error) {
            console.error('WebSocket symbol detection error:', error);
            socket.emit('symbol-detection-error', {
                jobId: data.sessionId,
                error: 'Failed to start symbol detection'
            });
        }
    });
    socket.on('cancel-symbol-detection', async (data) => {
        try {
            console.log('Symbol detection cancellation requested via WebSocket:', data);
            const cancelled = await symbolDetectionService.cancelJob(data.detectionJobId);
            if (cancelled) {
                socket.emit('symbol-detection-error', {
                    jobId: data.detectionJobId,
                    error: 'Detection cancelled by user'
                });
            }
        }
        catch (error) {
            console.error('WebSocket symbol detection cancellation error:', error);
            socket.emit('symbol-detection-error', {
                jobId: data.detectionJobId,
                error: 'Failed to cancel symbol detection'
            });
        }
    });
    socket.on('disconnect', () => {
        console.log('Client disconnected from symbol detection:', socket.id);
    });
});
// Forward symbol detection service events to WebSocket clients
symbolDetectionService.on('detection-started', (data) => {
    io.emit('symbol-detection-started', {
        jobId: data.jobIds[0],
        estimatedTime: data.estimatedTime
    });
});
symbolDetectionService.on('detection-progress', (data) => {
    io.emit('symbol-detection-progress', data);
});
symbolDetectionService.on('detection-completed', (data) => {
    io.emit('symbol-detection-completed', data);
});
symbolDetectionService.on('detection-error', (data) => {
    io.emit('symbol-detection-error', data);
});
symbolDetectionService.on('symbol-detected', (data) => {
    io.emit('symbol-detected', data);
});
// Error handling middleware
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((error, _req, res, _next) => {
    console.error('Error:', error);
    // Handle specific error types
    if (error.name === 'ProviderError') {
        const providerError = error;
        res.status(providerError.code === 'RATE_LIMITED' ? 429 : 500).json({
            error: {
                code: providerError.code,
                message: providerError.message,
                provider: providerError.provider,
                retryable: providerError.retryable,
                timestamp: new Date().toISOString(),
            }
        });
        return;
    }
    if (error.name === 'CircuitBreakerError') {
        res.status(503).json({
            error: {
                code: 'SERVICE_UNAVAILABLE',
                message: 'LLM service is temporarily unavailable. Please try again later.',
                timestamp: new Date().toISOString(),
            }
        });
        return;
    }
    if (error.name === 'RateLimitExceededError') {
        const rateLimitError = error;
        res.status(429).json({
            error: {
                code: 'RATE_LIMITED',
                message: error.message,
                retryAfter: rateLimitError.rateLimitInfo.retryAfter,
                timestamp: new Date().toISOString(),
            }
        });
        return;
    }
    // Validation errors
    if (error.message.includes('required') || error.message.includes('must be')) {
        res.status(400).json({
            error: {
                code: 'VALIDATION_ERROR',
                message: error.message,
                timestamp: new Date().toISOString(),
            }
        });
        return;
    }
    // Default error response
    res.status(500).json({
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred',
            timestamp: new Date().toISOString(),
        }
    });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.originalUrl} not found`,
            timestamp: new Date().toISOString(),
        }
    });
});
// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
    // Shutdown context WebSocket service first
    await context_websocket_service_1.contextWebSocketService.shutdown();
    // Shutdown symbol detection service
    await symbolDetectionService.shutdown();
    // Close database connections
    await database.end();
    console.log('Database connections closed.');
    server.close(() => {
        console.log('HTTP server closed.');
        // Close any other connections (Redis, databases, etc.)
        // TODO: Add cleanup for circuit breakers, rate limiters, etc.
        process.exit(0);
    });
    // Force close after 30 seconds
    setTimeout(() => {
        console.log('Forcing shutdown after 30 seconds...');
        process.exit(1);
    }, 30000);
};
// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
// Start server
server.listen(PORT, () => {
    console.log(`🚀 LLM Orchestrator service running on port ${PORT}`);
    console.log(`📚 API Documentation available at http://localhost:${PORT}/`);
    console.log(`🏥 Health check available at http://localhost:${PORT}/api/v1/health`);
    // Validate required environment variables
    if (!process.env.OPENAI_API_KEY) {
        console.warn('⚠️  WARNING: OPENAI_API_KEY environment variable not set!');
    }
});
exports.default = app;
//# sourceMappingURL=app.js.map