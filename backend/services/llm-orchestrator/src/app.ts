/**
 * LLM Orchestrator Service - Main Application
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { AnalysisController } from './controllers/analysis.controller';
import { ContextChatController } from './controllers/context-chat.controller';
import { contextWebSocketService } from './websocket/context-websocket.service';

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
      'GET /api/v1/health',
    ]
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