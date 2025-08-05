import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import uploadRoutes from './routes/index.js';
import { errorHandler } from './utils/errorHandler.js';
import { logger } from './utils/logger.js';
import { webSocketService } from './services/websocket.service.js';
import { storageService } from './services/storage.service.js';
dotenv.config();
const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;
// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Routes
app.use('/api/v1', uploadRoutes);
// Health check endpoint with service status
app.get('/health', async (req, res) => {
    try {
        const webSocketHealth = webSocketService.healthCheck();
        const storageHealth = await storageService.getHealthStatus();
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            services: {
                websocket: webSocketHealth,
                storage: storageHealth
            }
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: 'Health check failed'
        });
    }
});
// Error handling middleware
app.use(errorHandler);
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: {
            code: 'NOT_FOUND',
            message: 'Endpoint not found',
            timestamp: new Date().toISOString()
        }
    });
});
// Initialize WebSocket service
webSocketService.initialize(httpServer);
// Graceful shutdown handling
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await webSocketService.shutdown();
    await storageService.shutdown();
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await webSocketService.shutdown();
    await storageService.shutdown();
    process.exit(0);
});
httpServer.listen(PORT, () => {
    logger.info(`File processor service with WebSocket listening on port ${PORT}`);
});
export default app;
//# sourceMappingURL=app.js.map