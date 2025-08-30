# Docker Deployment Guide - Electrical Drawing Analysis App

This guide covers deploying the Electrical Drawing Analysis App with Docker, including the SharedStorageService for cross-service file access.

## Architecture Overview

The application consists of multiple microservices that communicate via shared volumes:

- **File Processor Service** (Port 3001): Handles PDF uploads and converts to images
- **LLM Orchestrator Service** (Port 3002): Manages AI model interactions and analysis  
- **Memory Service** (Port 8002): Handles context storage and retrieval via Neo4j
- **Supporting Services**: PostgreSQL, Redis, Neo4j

### Shared Storage Architecture

The key innovation is the **SharedStorageService** that enables cross-service file access:

- File Processor writes converted images to shared volume: `shared_sessions:/app/storage/sessions`
- LLM Orchestrator reads from the same volume (read-only): `shared_sessions:/app/storage/sessions:ro`
- Performance requirement: <100ms cross-service access time
- Security: UUID-based session isolation maintained

## Prerequisites

1. **Docker & Docker Compose**
   ```bash
   docker --version  # 20.10+
   docker-compose --version  # 2.0+
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

3. **API Keys Required**
   - OpenAI API Key
   - Claude API Key (optional)
   - Gemini API Key (optional)

## Quick Start

### 1. Production Deployment

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### 2. Development Deployment

```bash
# Start with development overrides
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Access development tools:
# - Redis Commander: http://localhost:8081
# - Adminer (Database): http://localhost:8080
```

## Service Endpoints

| Service | URL | Health Check |
|---------|-----|--------------|
| File Processor | http://localhost:3001 | http://localhost:3001/health |
| LLM Orchestrator | http://localhost:3002 | http://localhost:3002/api/v1/health |
| Memory Service | http://localhost:8002 | http://localhost:8002/health |
| Neo4j Browser | http://localhost:7474 | N/A |
| Redis Commander (dev) | http://localhost:8081 | N/A |
| Adminer (dev) | http://localhost:8080 | N/A |

## Shared Volume Configuration

### Key Volume: `shared_sessions`

This volume enables cross-service file access:

```yaml
volumes:
  shared_sessions:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ${PWD}/backend/services/file-processor/backend/storage/sessions
```

### Service Volume Mounts

**File Processor (Read/Write)**:
```yaml
volumes:
  - shared_sessions:/app/storage/sessions
```

**LLM Orchestrator (Read-Only)**:
```yaml
volumes:
  - shared_sessions:/app/storage/sessions:ro
```

## Testing Cross-Service File Access

### 1. Upload a PDF

```bash
curl -X POST \
  http://localhost:3001/api/upload \
  -F "file=@test-document.pdf" \
  -H "Content-Type: multipart/form-data"
```

Response includes `sessionId` and `documentId`.

### 2. Verify File Processing

```bash
# Check file processor created the session
docker exec electrical_file_processor ls -la /app/storage/sessions/

# Verify converted images exist
docker exec electrical_file_processor ls -la /app/storage/sessions/{sessionId}/converted_images/
```

### 3. Test Cross-Service Access

```bash
# Request analysis from LLM orchestrator
curl -X POST \
  http://localhost:3002/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "{sessionId}",
    "documentId": "{documentId}",
    "prompt": "Describe the electrical components in this drawing"
  }'
```

### 4. Monitor Performance

```bash
# Check health endpoints for shared storage status
curl http://localhost:3001/health | jq '.sharedStorage'
curl http://localhost:3002/api/v1/health | jq '.sharedStorage'
```

## Development Workflow

### Hot Reload Setup

Development mode enables hot reloading:

```bash
# Start development environment
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Make code changes - services will auto-restart
```

### Debugging

```bash
# View specific service logs
docker-compose logs -f file-processor
docker-compose logs -f llm-orchestrator

# Access container for debugging
docker exec -it electrical_file_processor sh
docker exec -it electrical_llm_orchestrator sh

# Check shared volume contents
docker exec -it electrical_file_processor ls -la /app/storage/sessions/
```

## Monitoring & Health Checks

### Built-in Health Checks

All services include health checks:

```bash
# Overall system health
docker-compose ps

# Detailed health status
curl http://localhost:3001/health
curl http://localhost:3002/api/v1/health
curl http://localhost:8002/health
```

### Performance Monitoring

SharedStorageService includes performance monitoring:

- **Target**: <100ms cross-service file access
- **Monitoring**: Automatic logging of slow operations
- **Alerts**: Warning logs when threshold exceeded

### Storage Monitoring

```bash
# Check shared volume usage
docker system df -v

# Monitor session directory size
docker exec electrical_file_processor du -sh /app/storage/sessions/
```

## Troubleshooting

### Common Issues

1. **Volume Permission Errors**
   ```bash
   # Fix permissions
   sudo chown -R 1001:1001 backend/services/file-processor/backend/storage/
   sudo chown -R 1001:1001 backend/services/file-processor/uploads/
   ```

2. **Cross-Service Access Failing**
   ```bash
   # Check volume mounts
   docker inspect electrical_file_processor | jq '.[0].Mounts'
   docker inspect electrical_llm_orchestrator | jq '.[0].Mounts'
   
   # Verify shared volume
   docker volume inspect electrical-drawing-app_shared_sessions
   ```

3. **Memory Issues**
   ```bash
   # Increase container memory limits in docker-compose.yml
   deploy:
     resources:
       limits:
         memory: 2G
   ```

### Health Check Failures

```bash
# Check service logs
docker-compose logs [service-name]

# Restart specific service
docker-compose restart [service-name]

# Rebuild and restart
docker-compose up -d --build [service-name]
```

## Production Considerations

### Security

1. **Environment Variables**
   - Store sensitive data in `.env` file (not in git)
   - Use Docker secrets for production deployment
   
2. **Volume Security**
   - LLM orchestrator has read-only access to shared storage
   - UUID session isolation prevents cross-session access
   
3. **Network Security**
   - Services communicate on isolated Docker network
   - External access only through defined ports

### Scalability

1. **Horizontal Scaling**
   ```bash
   # Scale LLM orchestrator for high load
   docker-compose up -d --scale llm-orchestrator=3
   ```

2. **Resource Allocation**
   - Adjust memory limits based on usage patterns
   - Monitor CPU and memory usage with `docker stats`

3. **Storage Management**
   - Implement regular cleanup of expired sessions
   - Monitor disk space usage

### Backup & Recovery

```bash
# Backup volumes
docker run --rm -v electrical-drawing-app_shared_sessions:/data -v $(pwd):/backup alpine tar czf /backup/sessions-backup.tar.gz -C /data .

# Restore volumes  
docker run --rm -v electrical-drawing-app_shared_sessions:/data -v $(pwd):/backup alpine tar xzf /backup/sessions-backup.tar.gz -C /data
```

## Performance Tuning

### Optimize for Cross-Service Access

1. **SSD Storage**: Use fast storage for shared volumes
2. **Memory**: Increase container memory for better caching
3. **Network**: Use bridge networks for optimal container communication

### Monitor Key Metrics

- Cross-service file access time (<100ms target)
- Session directory size and growth
- Container memory and CPU usage
- Docker volume I/O performance

## Support

For issues with Docker deployment:

1. Check service health endpoints first
2. Review container logs for errors  
3. Verify environment configuration
4. Test cross-service file access manually
5. Monitor shared volume permissions and usage