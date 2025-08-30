# SharedStorageService Deployment Runbook

## Overview

This runbook provides step-by-step procedures for deploying the SharedStorageService in production environments. The SharedStorageService is a critical infrastructure component that provides cross-service file access for the Electrical Drawing Analysis Application.

## Prerequisites

### System Requirements
- **Operating System**: Ubuntu 20.04 LTS or CentOS 7+
- **Memory**: Minimum 4GB RAM, recommended 8GB+
- **Storage**: Minimum 100GB available disk space
- **Network**: Access to internal service mesh
- **Dependencies**: Node.js 18+, Redis 7.0+, Docker 20.10+

### Access Requirements
- SSH access to deployment servers
- Docker registry credentials
- Database administrative access
- Service mesh configuration access
- Monitoring system access (Prometheus/Grafana)

### Pre-deployment Checklist
- [ ] Environment configuration reviewed and approved
- [ ] Secrets management configured
- [ ] Database backups completed
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured
- [ ] Team notification channels tested

## Environment Configuration

### Development Environment
```bash
# Environment variables
export NODE_ENV=development
export STORAGE_BASE=/opt/shared-storage/dev
export REDIS_URL=redis://redis-dev:6379
export SHARED_STORAGE_PORT=3001
export SHARED_STORAGE_HOST=0.0.0.0
export LOG_LEVEL=debug

# Service configuration
export SERVICE_MESH_ENABLED=false
export HEALTH_CHECK_INTERVAL=30000
export METRICS_ENABLED=true
```

### Staging Environment
```bash
# Environment variables
export NODE_ENV=staging
export STORAGE_BASE=/opt/shared-storage/staging
export REDIS_URL=redis://redis-staging:6379
export SHARED_STORAGE_PORT=3000
export SHARED_STORAGE_HOST=0.0.0.0
export LOG_LEVEL=info

# Service configuration
export SERVICE_MESH_ENABLED=true
export HEALTH_CHECK_INTERVAL=15000
export METRICS_ENABLED=true
export ALERT_WEBHOOK_URL=https://alerts.staging.company.com/webhook
```

### Production Environment
```bash
# Environment variables
export NODE_ENV=production
export STORAGE_BASE=/opt/shared-storage/prod
export REDIS_URL=redis://redis-cluster:6379
export SHARED_STORAGE_PORT=3000
export SHARED_STORAGE_HOST=0.0.0.0
export LOG_LEVEL=warn

# Service configuration
export SERVICE_MESH_ENABLED=true
export HEALTH_CHECK_INTERVAL=10000
export METRICS_ENABLED=true
export ALERT_WEBHOOK_URL=https://alerts.company.com/webhook
export BACKUP_ENABLED=true
export BACKUP_SCHEDULE="0 2 * * *"
```

## Deployment Procedures

### Method 1: Docker Compose Deployment (Recommended)

#### Step 1: Prepare Deployment Directory
```bash
# Create deployment directory
sudo mkdir -p /opt/shared-storage
sudo chown -R sharedstorage:sharedstorage /opt/shared-storage

# Create required subdirectories
cd /opt/shared-storage
mkdir -p sessions temp logs backups config

# Set appropriate permissions
chmod 755 /opt/shared-storage
chmod 700 /opt/shared-storage/sessions
chmod 700 /opt/shared-storage/temp
chmod 755 /opt/shared-storage/logs
chmod 700 /opt/shared-storage/backups
```

#### Step 2: Create Docker Compose Configuration
```yaml
# docker-compose.yml
version: '3.8'
services:
  shared-storage-service:
    image: registry.company.com/shared-storage-service:${TAG}
    container_name: shared-storage-service
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - STORAGE_BASE=/app/storage
      - REDIS_URL=redis://redis:6379
      - SHARED_STORAGE_PORT=3000
      - LOG_LEVEL=warn
      - SERVICE_MESH_ENABLED=true
      - METRICS_ENABLED=true
    volumes:
      - ./storage:/app/storage
      - ./logs:/app/logs
      - ./config:/app/config:ro
    networks:
      - shared-storage-network
    depends_on:
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  redis:
    image: redis:7.0-alpine
    container_name: shared-storage-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    networks:
      - shared-storage-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  redis_data:

networks:
  shared-storage-network:
    driver: bridge
```

#### Step 3: Configure Environment File
```bash
# .env.production
NODE_ENV=production
STORAGE_BASE=/opt/shared-storage
REDIS_URL=redis://localhost:6379
SHARED_STORAGE_PORT=3000
LOG_LEVEL=warn

# Service Mesh Configuration
SERVICE_MESH_ENABLED=true
SERVICE_NAME=shared-storage-service
SERVICE_VERSION=1.0.0

# Security Configuration
JWT_SECRET=your-256-bit-secret-here
API_KEY_EXPIRY=86400

# Monitoring Configuration
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=10000
ALERT_WEBHOOK_URL=https://alerts.company.com/webhook

# Backup Configuration
BACKUP_ENABLED=true
BACKUP_SCHEDULE="0 2 * * *"
BACKUP_RETENTION_DAYS=30

# Performance Configuration
MAX_CONCURRENT_REQUESTS=100
REQUEST_TIMEOUT_MS=30000
CACHE_TTL_SECONDS=3600
```

#### Step 4: Deploy the Service
```bash
# Pull latest images
docker-compose pull

# Start services
docker-compose up -d

# Verify deployment
docker-compose ps
docker-compose logs shared-storage-service
```

#### Step 5: Verify Deployment Health
```bash
# Check service health
curl -f http://localhost:3000/health

# Check detailed health
curl -f http://localhost:3000/health/detailed

# Check metrics endpoint
curl -f http://localhost:3000/metrics

# Verify logs
docker-compose logs -f shared-storage-service
```

### Method 2: Kubernetes Deployment

#### Step 1: Create Namespace
```bash
kubectl create namespace shared-storage
```

#### Step 2: Create ConfigMaps and Secrets
```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: shared-storage-config
  namespace: shared-storage
data:
  NODE_ENV: "production"
  SHARED_STORAGE_PORT: "3000"
  LOG_LEVEL: "warn"
  SERVICE_MESH_ENABLED: "true"
  METRICS_ENABLED: "true"
  HEALTH_CHECK_INTERVAL: "10000"
  BACKUP_ENABLED: "true"
  BACKUP_SCHEDULE: "0 2 * * *"
  BACKUP_RETENTION_DAYS: "30"
  MAX_CONCURRENT_REQUESTS: "100"
  REQUEST_TIMEOUT_MS: "30000"
  CACHE_TTL_SECONDS: "3600"
```

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: shared-storage-secrets
  namespace: shared-storage
type: Opaque
data:
  JWT_SECRET: <base64-encoded-jwt-secret>
  REDIS_PASSWORD: <base64-encoded-redis-password>
  API_KEY: <base64-encoded-api-key>
```

#### Step 3: Create Persistent Volume Claims
```yaml
# pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shared-storage-data
  namespace: shared-storage
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: fast-ssd

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shared-storage-backups
  namespace: shared-storage
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 200Gi
  storageClassName: standard
```

#### Step 4: Deploy Redis
```yaml
# redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shared-storage-redis
  namespace: shared-storage
spec:
  replicas: 1
  selector:
    matchLabels:
      app: shared-storage-redis
  template:
    metadata:
      labels:
        app: shared-storage-redis
    spec:
      containers:
      - name: redis
        image: redis:7.0-alpine
        ports:
        - containerPort: 6379
        command: ["redis-server", "--appendonly", "yes"]
        volumeMounts:
        - name: redis-data
          mountPath: /data
        livenessProbe:
          exec:
            command: ["redis-cli", "ping"]
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command: ["redis-cli", "ping"]
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: redis-data
        persistentVolumeClaim:
          claimName: shared-storage-redis-data
```

#### Step 5: Deploy SharedStorageService
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shared-storage-service
  namespace: shared-storage
spec:
  replicas: 3
  selector:
    matchLabels:
      app: shared-storage-service
  template:
    metadata:
      labels:
        app: shared-storage-service
    spec:
      containers:
      - name: shared-storage
        image: registry.company.com/shared-storage-service:v1.0.0
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: shared-storage-config
        - secretRef:
            name: shared-storage-secrets
        env:
        - name: REDIS_URL
          value: "redis://shared-storage-redis:6379"
        - name: STORAGE_BASE
          value: "/app/storage"
        volumeMounts:
        - name: shared-storage-data
          mountPath: /app/storage
        - name: shared-storage-logs
          mountPath: /app/logs
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
      volumes:
      - name: shared-storage-data
        persistentVolumeClaim:
          claimName: shared-storage-data
      - name: shared-storage-logs
        emptyDir: {}
```

#### Step 6: Create Service
```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: shared-storage-service
  namespace: shared-storage
spec:
  selector:
    app: shared-storage-service
  ports:
  - port: 3000
    targetPort: 3000
  type: ClusterIP
```

#### Step 7: Deploy to Kubernetes
```bash
# Apply configurations
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
kubectl apply -f pvc.yaml
kubectl apply -f redis-deployment.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml

# Wait for deployment
kubectl rollout status deployment/shared-storage-service -n shared-storage

# Verify deployment
kubectl get pods -n shared-storage
kubectl logs -l app=shared-storage-service -n shared-storage
```

## Rollback Procedures

### Docker Compose Rollback
```bash
# Stop current deployment
docker-compose down

# Pull previous version
export TAG=v0.9.0
docker-compose pull

# Start previous version
docker-compose up -d

# Verify rollback
docker-compose ps
curl -f http://localhost:3000/health
```

### Kubernetes Rollback
```bash
# Rollback to previous revision
kubectl rollout undo deployment/shared-storage-service -n shared-storage

# Or rollback to specific revision
kubectl rollout undo deployment/shared-storage-service --to-revision=2 -n shared-storage

# Wait for rollback to complete
kubectl rollout status deployment/shared-storage-service -n shared-storage

# Verify rollback
kubectl get pods -n shared-storage
kubectl logs -l app=shared-storage-service -n shared-storage
```

## Scaling Procedures

### Horizontal Scaling (Docker Compose)
```bash
# Scale the service
docker-compose up -d --scale shared-storage-service=3

# Verify scaling
docker-compose ps
docker stats
```

### Horizontal Scaling (Kubernetes)
```bash
# Scale deployment
kubectl scale deployment shared-storage-service --replicas=5 -n shared-storage

# Or update deployment spec
kubectl patch deployment shared-storage-service -n shared-storage -p '{"spec":{"replicas":5}}'

# Verify scaling
kubectl get pods -n shared-storage
kubectl describe hpa shared-storage-service -n shared-storage
```

### Vertical Scaling (Resource Adjustment)
```yaml
# Update resource limits
kubectl patch deployment shared-storage-service -n shared-storage --type='json' -p='[
  {"op": "replace", "path": "/spec/template/spec/containers/0/resources/limits/memory", "value": "2Gi"},
  {"op": "replace", "path": "/spec/template/spec/containers/0/resources/limits/cpu", "value": "1000m"}
]'

# Restart pods to apply changes
kubectl rollout restart deployment/shared-storage-service -n shared-storage
```

## Blue-Green Deployment Strategy

### Setup Blue Environment
```bash
# Create blue environment
kubectl create namespace shared-storage-blue

# Deploy blue version
kubectl apply -f k8s/blue/ -n shared-storage-blue

# Wait for blue deployment
kubectl rollout status deployment/shared-storage-service -n shared-storage-blue
```

### Test Blue Environment
```bash
# Test blue environment health
kubectl port-forward -n shared-storage-blue svc/shared-storage-service 3000:3000

# Run integration tests against blue environment
curl -f http://localhost:3000/health
# ... run test suite ...
```

### Switch Traffic to Blue
```bash
# Update ingress/service to point to blue environment
kubectl patch svc shared-storage-service -n shared-storage \
  -p '{"spec":{"selector":{"app":"shared-storage-service","environment":"blue"}}}'

# Or update ingress
kubectl patch ingress shared-storage-ingress \
  -p '{"spec":{"rules":[{"host":"api.company.com","http":{"paths":[{"path":"/api/v1/shared-storage","pathType":"Prefix","backend":{"service":{"name":"shared-storage-service","port":{"number":3000}}}}]}}]}}'
```

### Rollback to Green (if needed)
```bash
# Switch back to green environment
kubectl patch svc shared-storage-service -n shared-storage \
  -p '{"spec":{"selector":{"app":"shared-storage-service","environment":"green"}}}'
```

## Configuration Validation

### Pre-deployment Validation
```bash
#!/bin/bash
# config-validation.sh

echo "Validating SharedStorageService configuration..."

# Check environment variables
required_vars=("STORAGE_BASE" "REDIS_URL" "SHARED_STORAGE_PORT")
for var in "${required_vars[@]}"; do
  if [[ -z "${!var}" ]]; then
    echo "ERROR: Required environment variable $var is not set"
    exit 1
  fi
done

# Validate storage directory
if [[ ! -d "$STORAGE_BASE" ]]; then
  echo "ERROR: Storage base directory $STORAGE_BASE does not exist"
  exit 1
fi

# Check permissions
if [[ ! -w "$STORAGE_BASE" ]]; then
  echo "ERROR: No write permission for storage directory $STORAGE_BASE"
  exit 1
fi

# Validate Redis connection
if ! redis-cli -u "$REDIS_URL" ping &>/dev/null; then
  echo "ERROR: Cannot connect to Redis at $REDIS_URL"
  exit 1
fi

echo "Configuration validation passed!"
```

### Runtime Configuration Validation
```bash
#!/bin/bash
# runtime-validation.sh

echo "Validating SharedStorageService runtime configuration..."

# Test health endpoints
health_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
if [[ "$health_status" != "200" ]]; then
  echo "ERROR: Health check failed with status $health_status"
  exit 1
fi

# Test detailed health
detailed_health=$(curl -s http://localhost:3000/health/detailed | jq -r '.status')
if [[ "$detailed_health" != "healthy" ]]; then
  echo "ERROR: Detailed health check failed: $detailed_health"
  exit 1
fi

# Test metrics endpoint
metrics_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/metrics)
if [[ "$metrics_status" != "200" ]]; then
  echo "ERROR: Metrics endpoint failed with status $metrics_status"
  exit 1
fi

echo "Runtime validation passed!"
```

## Monitoring and Alerting Setup

### Prometheus Configuration
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'shared-storage-service'
    static_configs:
      - targets: ['shared-storage-service:3000']
    scrape_interval: 15s
    metrics_path: '/metrics'
```

### Grafana Dashboard Setup
```json
{
  "dashboard": {
    "title": "SharedStorageService Overview",
    "tags": ["shared-storage", "microservices"],
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(shared_storage_operations_total[5m])",
            "legendFormat": "{{operation}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(shared_storage_errors_total[5m])",
            "legendFormat": "{{error_type}}"
          }
        ]
      },
      {
        "title": "Storage Usage",
        "type": "bargauge",
        "targets": [
          {
            "expr": "shared_storage_disk_usage_bytes / shared_storage_disk_total_bytes * 100",
            "legendFormat": "Disk Usage %"
          }
        ]
      }
    ]
  }
}
```

### Alerting Rules
```yaml
# alerting-rules.yml
groups:
  - name: shared-storage-service
    rules:
      - alert: SharedStorageServiceDown
        expr: up{job="shared-storage-service"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "SharedStorageService is down"
          description: "SharedStorageService has been down for more than 5 minutes"

      - alert: SharedStorageHighErrorRate
        expr: rate(shared_storage_errors_total[5m]) / rate(shared_storage_operations_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate in SharedStorageService"
          description: "Error rate is above 10% for the last 5 minutes"

      - alert: SharedStorageDiskSpaceLow
        expr: shared_storage_disk_usage_bytes / shared_storage_disk_total_bytes > 0.8
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low disk space in SharedStorageService"
          description: "Disk usage is above 80%"
```

## Post-Deployment Verification

### Functional Testing
```bash
#!/bin/bash
# functional-tests.sh

echo "Running SharedStorageService functional tests..."

# Test service registration
session_id=$(uuidgen)
service="file-processor"

# Test session path retrieval
response=$(curl -s -X GET "http://localhost:3000/sessions/$session_id/path?service=$service")
if [[ $(echo "$response" | jq -r '.sessionId') != "$session_id" ]]; then
  echo "ERROR: Session path test failed"
  exit 1
fi

# Test permission check
response=$(curl -s -X GET "http://localhost:3000/sessions/$session_id/permissions?service=$service")
if [[ $(echo "$response" | jq -r '.hasPermission') != "true" ]]; then
  echo "ERROR: Permission check test failed"
  exit 1
fi

echo "Functional tests passed!"
```

### Load Testing
```bash
#!/bin/bash
# load-test.sh

echo "Running SharedStorageService load tests..."

# Install hey for load testing
# go install github.com/rakyll/hey@latest

# Test health endpoint
hey -n 1000 -c 10 http://localhost:3000/health

# Test core functionality
hey -n 500 -c 5 "http://localhost:3000/sessions/test-session-id/permissions?service=file-processor"

echo "Load tests completed!"
```

## Troubleshooting Common Issues

### Service Won't Start
```bash
# Check logs
docker-compose logs shared-storage-service

# Check environment variables
docker-compose exec shared-storage-service env

# Check storage permissions
ls -la /opt/shared-storage
```

### Redis Connection Issues
```bash
# Test Redis connectivity
docker-compose exec redis redis-cli ping

# Check Redis logs
docker-compose logs redis

# Verify Redis URL in environment
docker-compose exec shared-storage-service echo $REDIS_URL
```

### Permission Denied Errors
```bash
# Check service configuration
docker-compose exec shared-storage-service cat /app/config/services.json

# Verify service permissions
curl -s "http://localhost:3000/sessions/test-session/permissions?service=file-processor" | jq
```

## Contact Information

### Deployment Team
- **Lead DevOps Engineer**: John Smith (john.smith@company.com)
- **Platform Engineer**: Sarah Johnson (sarah.johnson@company.com)
- **Site Reliability Engineer**: Mike Wilson (mike.wilson@company.com)

### On-Call Schedule
- **Primary**: +1-555-0101 (DevOps Team)
- **Secondary**: +1-555-0102 (Platform Team)
- **Escalation**: +1-555-0000 (VP Engineering)

### Communication Channels
- **Slack**: #shared-storage-deployments
- **Email**: devops-alerts@company.com
- **PagerDuty**: SharedStorageService Service

## References

- [SharedStorageService API Documentation](./api-reference.md)
- [SharedStorageService Troubleshooting Guide](./troubleshooting-guide.md)
- [SharedStorageService Configuration Guide](./configuration-guide.md)
- [Docker Deployment Documentation](../../../../DOCKER_DEPLOYMENT.md)
- [Architecture Documentation](../../../../docs/architecture/6-deployment-architecture-and-infrastructure.md)
