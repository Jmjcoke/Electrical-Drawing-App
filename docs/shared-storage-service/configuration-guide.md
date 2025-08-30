# SharedStorageService Configuration Guide

## Overview

This guide provides comprehensive information about configuring the SharedStorageService for different deployment scenarios. It covers environment variables, service configurations, performance tuning, and validation procedures.

## Environment Variables

### Core Configuration

| Variable | Default | Description | Required |
|----------|---------|-------------|----------|
| `NODE_ENV` | `development` | Runtime environment | Yes |
| `STORAGE_BASE` | `./backend/storage` | Base directory for file storage | Yes |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL | Yes |
| `SHARED_STORAGE_PORT` | `3000` | Service listening port | Yes |
| `LOG_LEVEL` | `info` | Logging level (error, warn, info, debug) | No |

### Service Mesh Configuration

| Variable | Default | Description | Required |
|----------|---------|-------------|----------|
| `SERVICE_MESH_ENABLED` | `false` | Enable service mesh integration | No |
| `SERVICE_NAME` | `shared-storage-service` | Service name for discovery | No |
| `SERVICE_VERSION` | `1.0.0` | Service version | No |
| `HEALTH_CHECK_INTERVAL` | `30000` | Health check interval (ms) | No |

### Security Configuration

| Variable | Default | Description | Required |
|----------|---------|-------------|----------|
| `JWT_SECRET` | - | Secret key for JWT tokens | Yes (production) |
| `API_KEY_EXPIRY` | `86400` | API key expiry time (seconds) | No |
| `ENCRYPTION_ENABLED` | `false` | Enable data encryption at rest | No |
| `TLS_CERT_PATH` | - | Path to TLS certificate | No |
| `TLS_KEY_PATH` | - | Path to TLS private key | No |

### Performance Configuration

| Variable | Default | Description | Required |
|----------|---------|-------------|----------|
| `MAX_CONCURRENT_REQUESTS` | `100` | Maximum concurrent requests | No |
| `REQUEST_TIMEOUT_MS` | `30000` | Request timeout (ms) | No |
| `CACHE_TTL_SECONDS` | `3600` | Cache time-to-live (seconds) | No |
| `CACHE_MAX_SIZE_MB` | `512` | Maximum cache size (MB) | No |
| `SESSION_CACHE_SIZE` | `10000` | Session cache size | No |
| `FILE_CACHE_SIZE` | `5000` | File metadata cache size | No |

### Monitoring Configuration

| Variable | Default | Description | Required |
|----------|---------|-------------|----------|
| `METRICS_ENABLED` | `true` | Enable Prometheus metrics | No |
| `METRICS_PORT` | `9090` | Metrics server port | No |
| `ALERT_WEBHOOK_URL` | - | Webhook URL for alerts | No |
| `LOG_TO_FILE` | `true` | Enable file logging | No |
| `LOG_MAX_SIZE` | `10m` | Maximum log file size | No |
| `LOG_MAX_FILES` | `5` | Maximum number of log files | No |

### Backup Configuration

| Variable | Default | Description | Required |
|----------|---------|-------------|----------|
| `BACKUP_ENABLED` | `true` | Enable automatic backups | No |
| `BACKUP_SCHEDULE` | `0 2 * * *` | Backup schedule (cron format) | No |
| `BACKUP_RETENTION_DAYS` | `30` | Backup retention period | No |
| `BACKUP_COMPRESSION` | `true` | Compress backups | No |
| `BACKUP_ENCRYPTION` | `false` | Encrypt backups | No |

## Service Configuration Files

### services.json

The `services.json` file defines the permissions and access patterns for each service that can access the SharedStorageService.

```json
{
  "file-processor": {
    "name": "file-processor",
    "permissions": {
      "canRead": true,
      "canWrite": true,
      "allowedSubPaths": [
        "converted_images/",
        "metadata/",
        "temp/"
      ]
    },
    "allowedSessionPatterns": [
      "^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"
    ],
    "rateLimit": {
      "requestsPerMinute": 1000,
      "burstLimit": 100
    }
  },
  "llm-orchestrator": {
    "name": "llm-orchestrator",
    "permissions": {
      "canRead": true,
      "canWrite": false,
      "allowedSubPaths": [
        "converted_images/",
        "metadata/"
      ]
    },
    "allowedSessionPatterns": ["*"],
    "rateLimit": {
      "requestsPerMinute": 500,
      "burstLimit": 50
    }
  },
  "response-aggregator": {
    "name": "response-aggregator",
    "permissions": {
      "canRead": true,
      "canWrite": false,
      "allowedSubPaths": [
        "converted_images/"
      ]
    },
    "rateLimit": {
      "requestsPerMinute": 200,
      "burstLimit": 20
    }
  }
}
```

### Service Configuration Schema

```typescript
interface ServiceConfig {
  name: string;
  permissions: {
    canRead: boolean;
    canWrite: boolean;
    allowedSubPaths: string[];
  };
  allowedSessionPatterns?: string[];
  rateLimit?: {
    requestsPerMinute: number;
    burstLimit: number;
  };
  metadata?: {
    description?: string;
    owner?: string;
    contact?: string;
  };
}
```

## Environment-Specific Configurations

### Development Environment

**File: `.env.development`**
```bash
# Core Configuration
NODE_ENV=development
STORAGE_BASE=./backend/storage
REDIS_URL=redis://localhost:6379
SHARED_STORAGE_PORT=3000

# Development Settings
LOG_LEVEL=debug
SERVICE_MESH_ENABLED=false
HEALTH_CHECK_INTERVAL=10000

# Security (relaxed for development)
JWT_SECRET=dev-secret-key-not-for-production
API_KEY_EXPIRY=604800

# Performance (lower limits for development)
MAX_CONCURRENT_REQUESTS=50
REQUEST_TIMEOUT_MS=60000
CACHE_TTL_SECONDS=300

# Monitoring (detailed for development)
METRICS_ENABLED=true
METRICS_PORT=9090
LOG_TO_FILE=true

# Backup (disabled for development)
BACKUP_ENABLED=false
```

**services.json for Development**
```json
{
  "file-processor": {
    "name": "file-processor",
    "permissions": {
      "canRead": true,
      "canWrite": true,
      "allowedSubPaths": ["*"]
    },
    "allowedSessionPatterns": ["*"],
    "rateLimit": {
      "requestsPerMinute": 10000,
      "burstLimit": 1000
    }
  },
  "llm-orchestrator": {
    "name": "llm-orchestrator",
    "permissions": {
      "canRead": true,
      "canWrite": true,
      "allowedSubPaths": ["*"]
    },
    "rateLimit": {
      "requestsPerMinute": 5000,
      "burstLimit": 500
    }
  },
  "response-aggregator": {
    "name": "response-aggregator",
    "permissions": {
      "canRead": true,
      "canWrite": true,
      "allowedSubPaths": ["*"]
    }
  }
}
```

### Staging Environment

**File: `.env.staging`**
```bash
# Core Configuration
NODE_ENV=staging
STORAGE_BASE=/opt/shared-storage/staging
REDIS_URL=redis://redis-staging:6379
SHARED_STORAGE_PORT=3000

# Staging Settings
LOG_LEVEL=info
SERVICE_MESH_ENABLED=true
HEALTH_CHECK_INTERVAL=15000

# Security
JWT_SECRET=${JWT_SECRET_STAGING}
API_KEY_EXPIRY=86400

# Performance
MAX_CONCURRENT_REQUESTS=200
REQUEST_TIMEOUT_MS=45000
CACHE_TTL_SECONDS=1800

# Monitoring
METRICS_ENABLED=true
ALERT_WEBHOOK_URL=https://alerts.staging.company.com/webhook
LOG_TO_FILE=true
LOG_MAX_SIZE=50m

# Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE="0 */6 * * *"
BACKUP_RETENTION_DAYS=7
```

### Production Environment

**File: `.env.production`**
```bash
# Core Configuration
NODE_ENV=production
STORAGE_BASE=/opt/shared-storage/prod
REDIS_URL=redis://redis-cluster:6379
SHARED_STORAGE_PORT=3000

# Production Settings
LOG_LEVEL=warn
SERVICE_MESH_ENABLED=true
HEALTH_CHECK_INTERVAL=10000

# Security
JWT_SECRET=${JWT_SECRET_PRODUCTION}
API_KEY_EXPIRY=3600
ENCRYPTION_ENABLED=true

# Performance
MAX_CONCURRENT_REQUESTS=1000
REQUEST_TIMEOUT_MS=30000
CACHE_TTL_SECONDS=3600
CACHE_MAX_SIZE_MB=2048

# Monitoring
METRICS_ENABLED=true
ALERT_WEBHOOK_URL=https://alerts.company.com/webhook
LOG_TO_FILE=true
LOG_MAX_SIZE=100m
LOG_MAX_FILES=10

# Backup
BACKUP_ENABLED=true
BACKUP_SCHEDULE="0 2 * * *"
BACKUP_RETENTION_DAYS=30
BACKUP_COMPRESSION=true
BACKUP_ENCRYPTION=true
```

## Configuration Profiles

### High-Availability Profile

**Use Case**: Production deployments requiring high availability
```yaml
# docker-compose.ha.yml
version: '3.8'
services:
  shared-storage-service:
    image: registry.company.com/shared-storage-service:latest
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    environment:
      - MAX_CONCURRENT_REQUESTS=500
      - CACHE_MAX_SIZE_MB=1024
      - BACKUP_ENABLED=true
      - SERVICE_MESH_ENABLED=true
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

### High-Performance Profile

**Use Case**: High-throughput scenarios with large file operations
```yaml
# docker-compose.performance.yml
version: '3.8'
services:
  shared-storage-service:
    image: registry.company.com/shared-storage-service:latest
    environment:
      - MAX_CONCURRENT_REQUESTS=2000
      - REQUEST_TIMEOUT_MS=60000
      - CACHE_MAX_SIZE_MB=4096
      - SESSION_CACHE_SIZE=50000
      - FILE_CACHE_SIZE=25000
      - REDIS_CONNECTION_POOL_SIZE=20
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
        reservations:
          cpus: '2.0'
          memory: 4G
```

### Resource-Constrained Profile

**Use Case**: Deployments with limited resources
```yaml
# docker-compose.constrained.yml
version: '3.8'
services:
  shared-storage-service:
    image: registry.company.com/shared-storage-service:latest
    environment:
      - MAX_CONCURRENT_REQUESTS=25
      - CACHE_MAX_SIZE_MB=128
      - SESSION_CACHE_SIZE=1000
      - FILE_CACHE_SIZE=500
      - REQUEST_TIMEOUT_MS=45000
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

## Configuration Validation

### Pre-deployment Validation Script

```bash
#!/bin/bash
# config-validation.sh

echo "=== SharedStorageService Configuration Validation ==="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Validation functions
validate_env_var() {
  local var_name=$1
  local var_value=$2
  local required=${3:-false}

  if [[ -z "$var_value" ]]; then
    if [[ "$required" == "true" ]]; then
      echo -e "${RED}ERROR: Required environment variable $var_name is not set${NC}"
      return 1
    else
      echo -e "${YELLOW}WARNING: Optional environment variable $var_name is not set${NC}"
      return 0
    fi
  fi
  echo -e "${GREEN}✓ $var_name = $var_value${NC}"
  return 0
}

validate_directory() {
  local dir_path=$1
  local dir_name=$2

  if [[ ! -d "$dir_path" ]]; then
    echo -e "${RED}ERROR: Directory $dir_name does not exist: $dir_path${NC}"
    return 1
  fi

  if [[ ! -w "$dir_path" ]]; then
    echo -e "${RED}ERROR: Directory $dir_name is not writable: $dir_path${NC}"
    return 1
  fi

  echo -e "${GREEN}✓ Directory $dir_name exists and is writable: $dir_path${NC}"
  return 0
}

validate_json_file() {
  local file_path=$1
  local file_name=$2

  if [[ ! -f "$file_path" ]]; then
    echo -e "${RED}ERROR: Configuration file $file_name does not exist: $file_path${NC}"
    return 1
  fi

  if ! jq . "$file_path" >/dev/null 2>&1; then
    echo -e "${RED}ERROR: Configuration file $file_name contains invalid JSON: $file_path${NC}"
    return 1
  fi

  echo -e "${GREEN}✓ Configuration file $file_name is valid JSON: $file_path${NC}"
  return 0
}

# Main validation
errors=0

echo "1. Environment Variables"
echo "-----------------------"

# Required environment variables
validate_env_var "NODE_ENV" "$NODE_ENV" true || ((errors++))
validate_env_var "STORAGE_BASE" "$STORAGE_BASE" true || ((errors++))
validate_env_var "REDIS_URL" "$REDIS_URL" true || ((errors++))
validate_env_var "SHARED_STORAGE_PORT" "$SHARED_STORAGE_PORT" true || ((errors++))

# Optional environment variables
validate_env_var "LOG_LEVEL" "$LOG_LEVEL" false
validate_env_var "MAX_CONCURRENT_REQUESTS" "$MAX_CONCURRENT_REQUESTS" false
validate_env_var "CACHE_TTL_SECONDS" "$CACHE_TTL_SECONDS" false

echo
echo "2. Directory Structure"
echo "----------------------"

validate_directory "$STORAGE_BASE" "STORAGE_BASE" || ((errors++))
validate_directory "$STORAGE_BASE/sessions" "sessions" || ((errors++))
validate_directory "$STORAGE_BASE/temp" "temp" || ((errors++))
validate_directory "$STORAGE_BASE/logs" "logs" || ((errors++))

echo
echo "3. Configuration Files"
echo "-----------------------"

validate_json_file "/app/config/services.json" "services.json" || ((errors++))

echo
echo "4. Service Dependencies"
echo "------------------------"

# Test Redis connectivity
if command -v redis-cli >/dev/null 2>&1; then
  if redis-cli -u "$REDIS_URL" ping >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis connection successful${NC}"
  else
    echo -e "${RED}ERROR: Cannot connect to Redis at $REDIS_URL${NC}"
    ((errors++))
  fi
else
  echo -e "${YELLOW}WARNING: redis-cli not available for connectivity test${NC}"
fi

echo
echo "5. Security Configuration"
echo "--------------------------"

# Check JWT secret length
if [[ -n "$JWT_SECRET" ]]; then
  if [[ ${#JWT_SECRET} -lt 32 ]]; then
    echo -e "${YELLOW}WARNING: JWT_SECRET is shorter than recommended (32 characters)${NC}"
  else
    echo -e "${GREEN}✓ JWT_SECRET length is adequate${NC}"
  fi
else
  echo -e "${RED}ERROR: JWT_SECRET is required for production${NC}"
  ((errors++))
fi

echo
echo "=== Validation Summary ==="

if [[ $errors -eq 0 ]]; then
  echo -e "${GREEN}✓ All validations passed! Configuration is ready for deployment.${NC}"
  exit 0
else
  echo -e "${RED}✗ $errors validation errors found. Please fix before deployment.${NC}"
  exit 1
fi
```

### Runtime Configuration Validation

```bash
#!/bin/bash
# runtime-config-check.sh

echo "=== Runtime Configuration Check ==="

# Check if service is running
if ! curl -s http://localhost:3000/health >/dev/null; then
  echo "ERROR: Service is not responding on port $SHARED_STORAGE_PORT"
  exit 1
fi

# Validate service configuration
health_response=$(curl -s http://localhost:3000/health/detailed)
status=$(echo "$health_response" | jq -r '.status')

if [[ "$status" != "healthy" ]]; then
  echo "ERROR: Service health check failed: $status"
  echo "Details: $health_response"
  exit 1
fi

echo "✓ Service is healthy and responding correctly"

# Validate configuration endpoint (if available)
config_response=$(curl -s http://localhost:3000/admin/config 2>/dev/null || echo "{}")
if [[ "$config_response" != "{}" ]]; then
  echo "✓ Configuration endpoint is accessible"
else
  echo "WARNING: Configuration endpoint not available or not accessible"
fi

echo "=== Runtime Check Complete ==="
```

## Parameter Tuning Guide

### Performance Tuning

#### Memory Configuration

```bash
# For high-memory systems (16GB+ RAM)
export CACHE_MAX_SIZE_MB=4096
export SESSION_CACHE_SIZE=50000
export FILE_CACHE_SIZE=25000
export NODE_OPTIONS="--max-old-space-size=8192"

# For low-memory systems (4GB RAM)
export CACHE_MAX_SIZE_MB=256
export SESSION_CACHE_SIZE=5000
export FILE_CACHE_SIZE=2500
export NODE_OPTIONS="--max-old-space-size=2048"
```

#### Connection Pool Tuning

```bash
# For high-throughput scenarios
export REDIS_CONNECTION_POOL_SIZE=20
export MAX_CONCURRENT_REQUESTS=1000
export REQUEST_TIMEOUT_MS=30000

# For low-throughput scenarios
export REDIS_CONNECTION_POOL_SIZE=5
export MAX_CONCURRENT_REQUESTS=100
export REQUEST_TIMEOUT_MS=60000
```

### Scaling Parameters

#### Horizontal Scaling Configuration

```yaml
# Kubernetes HPA configuration
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: shared-storage-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: shared-storage-service
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### Vertical Scaling Guidelines

| Workload Type | CPU Request | CPU Limit | Memory Request | Memory Limit |
|---------------|-------------|-----------|----------------|--------------|
| Light | 250m | 500m | 256Mi | 512Mi |
| Medium | 500m | 1000m | 512Mi | 1Gi |
| Heavy | 1000m | 2000m | 1Gi | 2Gi |
| Extreme | 2000m | 4000m | 2Gi | 4Gi |

### Monitoring Thresholds

#### Alert Thresholds

```yaml
# Prometheus alert rules
groups:
  - name: shared-storage-service
    rules:
      - alert: HighMemoryUsage
        expr: (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) > 0.85
        for: 5m
        labels:
          severity: warning

      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning

      - alert: HighErrorRate
        expr: rate(shared_storage_errors_total[5m]) / rate(shared_storage_operations_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
```

## Configuration Backup and Restore

### Backup Configuration

```bash
#!/bin/bash
# backup-config.sh

BACKUP_DIR="/opt/shared-storage/backups/config"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "Creating configuration backup..."

# Create backup directory
mkdir -p "$BACKUP_DIR/$TIMESTAMP"

# Backup environment files
cp .env* "$BACKUP_DIR/$TIMESTAMP/" 2>/dev/null || true

# Backup configuration files
cp -r config/* "$BACKUP_DIR/$TIMESTAMP/" 2>/dev/null || true

# Backup Docker Compose files
cp docker-compose*.yml "$BACKUP_DIR/$TIMESTAMP/" 2>/dev/null || true

# Create archive
cd "$BACKUP_DIR"
tar -czf "config-backup-$TIMESTAMP.tar.gz" "$TIMESTAMP"

# Clean up old backups
find "$BACKUP_DIR" -name "config-backup-*.tar.gz" -mtime +30 -delete

echo "Configuration backup completed: $BACKUP_DIR/config-backup-$TIMESTAMP.tar.gz"
```

### Restore Configuration

```bash
#!/bin/bash
# restore-config.sh

BACKUP_FILE="$1"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <backup-file>"
  exit 1
fi

echo "Restoring configuration from $BACKUP_FILE..."

# Create temporary directory
TEMP_DIR=$(mktemp -d)

# Extract backup
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Stop service before restore
docker-compose down

# Restore configuration files
cp -r "$TEMP_DIR"/*/* . 2>/dev/null || true

# Clean up
rm -rf "$TEMP_DIR"

# Validate configuration
./config-validation.sh

if [[ $? -eq 0 ]]; then
  echo "Configuration restored successfully"
  echo "Starting service..."
  docker-compose up -d
else
  echo "Configuration validation failed. Please check restored files."
  exit 1
fi
```

## Configuration Change Management

### Change Validation Process

```bash
#!/bin/bash
# config-change-validation.sh

echo "=== Configuration Change Validation ==="

# 1. Backup current configuration
./backup-config.sh

# 2. Apply changes
echo "Applying configuration changes..."

# 3. Validate new configuration
./config-validation.sh

if [[ $? -ne 0 ]]; then
  echo "Configuration validation failed. Rolling back..."
  ./restore-config.sh "$(ls -t /opt/shared-storage/backups/config/config-backup-*.tar.gz | head -1)"
  exit 1
fi

# 4. Test service with new configuration
echo "Testing service with new configuration..."

# Restart service
docker-compose restart shared-storage-service

# Wait for service to be ready
sleep 30

# Run health checks
curl -f http://localhost:3000/health
curl -f http://localhost:3000/health/detailed

echo "Configuration change validation completed successfully"
```

### Configuration Audit Logging

```bash
#!/bin/bash
# config-audit.sh

CONFIG_CHANGE_LOG="/opt/shared-storage/logs/config-changes.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
USER="${USER:-system}"

echo "=== Configuration Change Audit ===" >> "$CONFIG_CHANGE_LOG"
echo "Timestamp: $TIMESTAMP" >> "$CONFIG_CHANGE_LOG"
echo "User: $USER" >> "$CONFIG_CHANGE_LOG"
echo "Changes:" >> "$CONFIG_CHANGE_LOG"

# Log environment variable changes
git diff HEAD~1 -- .env* >> "$CONFIG_CHANGE_LOG" 2>/dev/null || echo "No .env changes detected" >> "$CONFIG_CHANGE_LOG"

# Log configuration file changes
git diff HEAD~1 -- config/ >> "$CONFIG_CHANGE_LOG" 2>/dev/null || echo "No config changes detected" >> "$CONFIG_CHANGE_LOG"

echo "---" >> "$CONFIG_CHANGE_LOG"
```

## Best Practices

### Security Best Practices

1. **Never commit secrets** to version control
2. **Use strong JWT secrets** (minimum 256 bits)
3. **Rotate API keys regularly** in production
4. **Enable encryption** for sensitive data
5. **Use TLS** in production environments
6. **Implement proper access controls** and rate limiting

### Performance Best Practices

1. **Monitor resource usage** continuously
2. **Configure appropriate cache sizes** based on available memory
3. **Use connection pooling** for database connections
4. **Implement request timeouts** to prevent hanging requests
5. **Configure circuit breakers** for resilient operation
6. **Use horizontal scaling** when vertical scaling is insufficient

### Operational Best Practices

1. **Validate configuration** before deployment
2. **Test configuration changes** in staging first
3. **Maintain configuration backups** regularly
4. **Document configuration changes** and their rationale
5. **Implement configuration drift detection**
6. **Use configuration management tools** for consistency

## References

- [API Reference](./api-reference.md)
- [Deployment Runbook](./deployment-runbook.md)
- [Troubleshooting Guide](./troubleshooting-guide.md)
- [Monitoring Procedures](./monitoring-procedures.md)
- [Architecture Documentation](../../../../docs/architecture/7-security-architecture-and-compliance-framework.md)
