import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import uploadRoutes from './routes/index.js';
import { errorHandler } from './utils/errorHandler.js';
import { logger } from './utils/logger.js';
dotenv.config();
const app = express();
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
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
app.listen(PORT, () => {
    logger.info(`File processor service listening on port ${PORT}`);
});
export default app;
//# sourceMappingURL=app.js.map