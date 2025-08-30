/**
 * LLM Orchestrator Service - Main Application
 */

// Setup module aliases for runtime
import 'module-alias/register';
import * as moduleAlias from 'module-alias';

moduleAlias.addAlias('@', __dirname);
moduleAlias.addAlias('@/types', __dirname + '/../shared/types');

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Pool } from 'pg';
import { AnalysisController } from './controllers/analysis.controller';
import { ContextChatController } from './controllers/context-chat.controller';
import { ComponentController } from './controllers/component.controller';
import { ExportController } from './controllers/export.controller';
import { ComponentExportService } from './export/component-export.service';
import { TemplateService } from './export/template.service';
import { ReportGeneratorService } from './export/report-generator.service';
import { ExportRepository } from './repositories/export.repository';
import { ComponentRepository } from './repositories/component.repository';
import { CrossPageReferenceRepository } from './repositories/cross-page-reference.repository';
import { contextWebSocketService } from './websocket/context-websocket.service';
import { 
  createExportRateLimiter, 
  createDownloadRateLimiter, 
  createPreviewRateLimiter, 
  createTemplateRateLimiter 
} from './middleware/export-rate-limiter';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3002;

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Initialize context WebSocket service
contextWebSocketService.initialize(io);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Initialize Database Connection
const database = new Pool({
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


// Initialize repositories for export service
const exportRepository = new ExportRepository(database);
const componentRepository = new ComponentRepository(database);
const crossPageReferenceRepository = new CrossPageReferenceRepository(database);

// Initialize export services
const reportGeneratorService = new ReportGeneratorService();
const templateService = new TemplateService(exportRepository);
const componentExportService = new ComponentExportService(
  componentRepository,
  crossPageReferenceRepository,
  exportRepository,
  reportGeneratorService,
  templateService
);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

// Compression middleware
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limiting (backup protection)
const globalRateLimit = rateLimit({
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
const analysisController = new AnalysisController();
const contextChatController = new ContextChatController();
const componentController = new ComponentController(database);
const exportController = new ExportController(
  componentExportService,
  templateService,
  exportRepository
);

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

// Enhanced context chat routes with spatial awareness

// Component Database routes
app.get('/api/v1/components/library', componentController.searchComponents);
app.get('/api/v1/components/:componentId', componentController.getComponent);
app.post('/api/v1/components/library', componentController.createComponent);
app.put('/api/v1/components/:componentId', componentController.updateComponent);
app.delete('/api/v1/components/:componentId', componentController.deleteComponent);
app.get('/api/v1/components/:componentId/properties', componentController.getComponentProperties);
app.get('/api/v1/components/:componentId/ratings', componentController.getComponentRatings);
app.get('/api/v1/components/:componentId/cross-references', componentController.getComponentCrossReferences);
app.post('/api/v1/components/identify', componentController.identifyComponent);
app.post('/api/v1/components/identify/batch', componentController.identifyBatchComponents);
app.get('/api/v1/components/search/part-number/:partNumber', componentController.searchByPartNumber);
app.get('/api/v1/components/search/manufacturer/:manufacturer', componentController.searchByManufacturer);
app.get('/api/v1/components/standards/:standard', componentController.getComponentsByStandard);
app.get('/api/v1/components/statistics', componentController.getLibraryStatistics);
app.get('/api/v1/components/:componentId/similar', componentController.findSimilarComponents);
app.get('/api/v1/components/properties/:propertyName/ranges', componentController.getPropertyValueRanges);
app.post('/api/v1/components/suggest', componentController.suggestComponents);
app.get('/api/v1/components/identification/statistics', componentController.getIdentificationStatistics);

// Initialize export rate limiters
const exportRateLimiter = createExportRateLimiter();
const downloadRateLimiter = createDownloadRateLimiter();
const previewRateLimiter = createPreviewRateLimiter();
const templateRateLimiter = createTemplateRateLimiter();

// Export and Reporting routes with rate limiting
app.post('/api/sessions/:sessionId/export/components', 
  exportRateLimiter.middleware(),
  exportController.exportComponents.bind(exportController));
app.get('/api/sessions/:sessionId/reports', 
  exportController.getSessionReports.bind(exportController));
app.get('/api/sessions/:sessionId/reports/:reportId', 
  exportController.getReport.bind(exportController));
app.get('/api/sessions/:sessionId/reports/:reportId/download', 
  downloadRateLimiter.middleware(),
  exportController.downloadReport.bind(exportController));
app.post('/api/sessions/:sessionId/export/preview', 
  previewRateLimiter.middleware(),
  exportController.generatePreview.bind(exportController));
app.get('/api/export/templates', 
  templateRateLimiter.middleware(),
  exportController.getTemplates.bind(exportController));
app.post('/api/export/templates', 
  templateRateLimiter.middleware(),
  exportController.createTemplate.bind(exportController));
app.get('/api/export/formats', 
  exportController.getExportFormats.bind(exportController));
app.get('/api/export/statistics', 
  exportController.getExportStatistics.bind(exportController));
app.get('/api/export/health',
  exportController.getExportHealth.bind(exportController));
app.get('/api/export/metrics',
  exportController.getExportMetrics.bind(exportController));
app.post('/api/export/alerts/:alertId/resolve',
  exportController.resolveAlert.bind(exportController));

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
      'GET /api/v1/components/library',
      'GET /api/v1/components/:componentId',
      'POST /api/v1/components/library',
      'PUT /api/v1/components/:componentId',
      'DELETE /api/v1/components/:componentId',
      'GET /api/v1/components/:componentId/properties',
      'GET /api/v1/components/:componentId/ratings',
      'GET /api/v1/components/:componentId/cross-references',
      'POST /api/v1/components/identify',
      'POST /api/v1/components/identify/batch',
      'GET /api/v1/components/search/part-number/:partNumber',
      'GET /api/v1/components/search/manufacturer/:manufacturer',
      'GET /api/v1/components/standards/:standard',
      'GET /api/v1/components/statistics',
      'GET /api/v1/components/:componentId/similar',
      'GET /api/v1/components/properties/:propertyName/ranges',
      'POST /api/v1/components/suggest',
      'GET /api/v1/components/identification/statistics',
      'POST /api/sessions/:sessionId/export/components',
      'GET /api/sessions/:sessionId/reports',
      'GET /api/sessions/:sessionId/reports/:reportId',
      'GET /api/sessions/:sessionId/reports/:reportId/download',
      'POST /api/sessions/:sessionId/export/preview',
      'GET /api/export/templates',
      'POST /api/export/templates',
      'GET /api/export/formats',
      'GET /api/export/statistics',
      'GET /api/v1/health',
    ]
  });
});

// Setup WebSocket event handlers
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});


// Error handling middleware
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', error);

  // Handle specific error types
  if (error.name === 'ProviderError') {
    const providerError = error as any;
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
    const rateLimitError = error as any;
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
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  
  // Shutdown context WebSocket service first
  await contextWebSocketService.shutdown();
  
  
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

export default app;