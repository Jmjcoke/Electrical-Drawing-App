# Symbol Detection Engine - Deployment Guide

## Overview

The Symbol Detection Engine is a production-ready system that provides electrical symbol recognition capabilities for PDF drawings using computer vision and machine learning techniques.

## System Requirements

### Hardware Requirements
- **Minimum**: 2 CPU cores, 4GB RAM, 10GB storage
- **Recommended**: 4+ CPU cores, 8GB+ RAM, 50GB+ storage
- **Production**: 8+ CPU cores, 16GB+ RAM, 100GB+ storage
- **GPU**: Optional but recommended for ML inference acceleration

### Software Requirements
- Node.js 18+ LTS
- PostgreSQL 15+
- Redis 7.0+
- Docker (optional for containerization)

## Installation Guide

### 1. Dependencies Installation
```bash
# Install Node.js dependencies
npm install

# Install system dependencies (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install -y build-essential python3-dev pkg-config libcairo2-dev libjpeg-dev libgif-dev

# Install OpenCV dependencies
sudo apt-get install -y libopencv-dev
```

### 2. Database Setup
```bash
# Create PostgreSQL database
createdb electrical_analysis

# Run migrations
npm run migrate:up
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Configure required environment variables:
DATABASE_URL=postgresql://user:password@localhost:5432/electrical_analysis
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=your_openai_key
CLAUDE_API_KEY=your_claude_key
```

## Configuration

### Core Settings
- `SYMBOL_DETECTION_TIMEOUT`: Maximum processing time per document (default: 30000ms)
- `MAX_CONCURRENT_DETECTIONS`: Maximum simultaneous detection jobs (default: 5)
- `ENABLE_ML_CLASSIFICATION`: Enable ML-based classification (default: true)
- `PERFORMANCE_MONITORING`: Enable performance monitoring (default: true)

### Performance Tuning
- `OPENCV_THREAD_COUNT`: OpenCV processing threads (default: 4)
- `ML_BATCH_SIZE`: ML inference batch size (default: 8)
- `CACHE_SIZE_LIMIT`: Template cache size limit (default: 100)
- `MEMORY_OPTIMIZATION`: Enable memory optimization (default: true)

## API Endpoints

### Core Detection Endpoints
- `POST /api/sessions/{sessionId}/documents/{documentId}/detect-symbols` - Start detection
- `GET /api/sessions/{sessionId}/detection-results/{resultId}` - Get results
- `GET /api/sessions/{sessionId}/detection-results` - List all results
- `DELETE /api/sessions/{sessionId}/detection-results/{resultId}` - Delete results

### Management Endpoints
- `GET /api/symbol-library` - List available symbol types
- `GET /api/detection/status` - System status
- `GET /api/detection/metrics` - Performance metrics

## WebSocket Events

### Client to Server
- `start-symbol-detection` - Initiate detection job
- `cancel-symbol-detection` - Cancel running job

### Server to Client
- `symbol-detection-started` - Job started notification
- `symbol-detection-progress` - Real-time progress updates
- `symbol-detection-completed` - Job completion notification
- `symbol-detection-error` - Error notifications

## Performance Monitoring

### Key Metrics
- **Processing Time**: Average processing time per document
- **Accuracy Rate**: Symbol detection accuracy percentage
- **Memory Usage**: Peak memory consumption during processing
- **Error Rate**: Percentage of failed detection attempts
- **Queue Length**: Number of pending detection jobs

### Performance Targets
- **Processing Time**: <30 seconds per PDF page (AC #9)
- **Accuracy**: >90% on standard electrical symbols (AC #8)
- **Memory Usage**: <1GB peak per detection job
- **Error Rate**: <5% for valid input documents

## Production Deployment

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Health Checks
```bash
# System health endpoint
curl http://localhost:3000/api/health

# Detection service health
curl http://localhost:3000/api/detection/health
```

### Scaling Considerations
- Use Redis for session and cache management across instances
- Configure PostgreSQL connection pooling
- Implement horizontal scaling with load balancers
- Monitor memory usage for OpenCV operations
- Use CDN for static symbol library assets

## Security Considerations

### Input Validation
- File size limits enforced (max 50MB per PDF)
- File type validation (PDF only)
- Malware scanning recommended for production
- Rate limiting implemented per session

### Data Protection
- Detection results stored with session-based access control
- Automatic cleanup of expired detection data
- No persistent storage of uploaded PDF content
- Secure API key management required

## Troubleshooting

### Common Issues

#### High Memory Usage
- Reduce `ML_BATCH_SIZE` setting
- Enable `MEMORY_OPTIMIZATION` setting
- Monitor `CACHE_SIZE_LIMIT` setting
- Restart service if memory leaks detected

#### Slow Processing Times
- Increase `OPENCV_THREAD_COUNT` setting
- Verify GPU acceleration is available
- Check PostgreSQL query performance
- Monitor Redis cache hit rates

#### Detection Accuracy Issues
- Verify symbol library is properly loaded
- Check confidence thresholds in configuration
- Validate input PDF quality and resolution
- Review ML model inference settings

### Log Analysis
```bash
# View detection logs
tail -f logs/symbol-detection.log

# Check error logs
grep "ERROR" logs/symbol-detection.log

# Monitor performance logs
grep "PERFORMANCE" logs/symbol-detection.log
```

## Maintenance

### Regular Tasks
- Monitor database storage growth
- Clean up expired detection results
- Update symbol library templates
- Performance benchmark validation
- Security update application

### Backup Procedures
- Database backup: symbol detection results and library
- Configuration backup: environment settings
- Log rotation and archival
- Performance metrics retention

## Support and Monitoring

### Monitoring Tools
- Application metrics via `/api/detection/metrics`
- Health checks via `/api/detection/health`
- PostgreSQL monitoring for database performance
- Redis monitoring for cache performance

### Alerting Recommendations
- Processing time exceeding 30 seconds
- Error rate exceeding 5%
- Memory usage exceeding 80%
- Queue length exceeding 20 jobs
- Database connection failures

## Version Information

- **Engine Version**: 1.0.0
- **API Version**: v1
- **Database Schema Version**: 5
- **Supported Node.js**: 18+ LTS
- **Last Updated**: 2025-08-05