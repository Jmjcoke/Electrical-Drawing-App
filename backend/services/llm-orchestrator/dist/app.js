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
const dotenv_1 = __importDefault(require("dotenv"));
const analysis_controller_1 = require("./controllers/analysis.controller");
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3002;
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
// API Routes
// Image analysis routes
app.post('/api/v1/analysis/images', analysisController.analyzeImages);
app.get('/api/v1/analysis/status/:analysisId', analysisController.getAnalysisStatus);
app.get('/api/v1/analysis/templates', analysisController.listTemplates);
// NLP processing routes
app.post('/api/v1/nlp/process-query', analysisController.processQuery);
app.post('/api/v1/nlp/suggestions', analysisController.getSuggestions);
app.get('/api/v1/nlp/stats', analysisController.getNLPStats);
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
            'GET /api/v1/health',
        ]
    });
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
const gracefulShutdown = (signal) => {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
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
const server = app.listen(PORT, () => {
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