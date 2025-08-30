# SharedStorageService Troubleshooting Guide

## Overview

This guide provides systematic troubleshooting procedures for common SharedStorageService issues. Each section includes diagnostic steps, resolution procedures, and preventive measures.

## Issue Classification

### Severity Levels
- **Critical**: Service unavailable, data corruption, security breaches
- **High**: Performance degradation, partial service failure
- **Medium**: Intermittent issues, warning alerts
- **Low**: Configuration warnings, optimization opportunities

### Issue Categories
- **Connectivity Issues**: Network, service mesh, authentication
- **Performance Issues**: Slow responses, high latency, resource exhaustion
- **Permission Issues**: Access denied, authorization failures
- **Data Issues**: File corruption, missing files, storage errors
- **Configuration Issues**: Invalid settings, environment problems

## Connectivity Issues

### Issue: Service Unreachable

**Symptoms:**
- HTTP 503 Service Unavailable
- Connection refused errors
- Timeout errors from client services

**Diagnostic Steps:**
```bash
# 1. Check service health
curl -v http://localhost:3000/health

# 2. Check service logs
docker-compose logs shared-storage-service | tail -50

# 3. Verify service is running
docker-compose ps shared-storage-service

# 4. Check network connectivity
telnet localhost 3000

# 5. Check firewall rules
sudo iptables -L | grep 3000
```

**Resolution Procedures:**

**Case 1: Service Not Running**
```bash
# Restart the service
docker-compose restart shared-storage-service

# Check startup logs
docker-compose logs -f shared-storage-service

# Verify health after restart
curl -f http://localhost:3000/health
```

**Case 2: Network Configuration Issue**
```bash
# Check Docker network
docker network ls
docker network inspect shared-storage-network

# Verify port mapping
docker port shared-storage-service

# Check service mesh configuration
kubectl get svc -n shared-storage
kubectl describe svc shared-storage-service -n shared-storage
```

**Case 3: Load Balancer Issues**
```bash
# Check load balancer health
curl -H "Host: api.company.com" http://load-balancer/health

# Verify upstream configuration
# Check nginx/haproxy configuration
cat /etc/nginx/sites-available/shared-storage

# Test direct service access
curl http://shared-storage-service.shared-storage.svc.cluster.local:3000/health
```

**Prevention:**
- Implement health check monitoring
- Configure proper restart policies
- Set up load balancer health checks
- Monitor network connectivity

### Issue: Circuit Breaker Tripped

**Symptoms:**
- HTTP 503 Service Unavailable (circuit open)
- Rapid error responses
- "Circuit breaker is open" in logs

**Diagnostic Steps:**
```bash
# 1. Check circuit breaker status
curl http://localhost:3000/health/detailed | jq '.checks.circuit_breaker'

# 2. Check recent error rates
curl http://localhost:3000/metrics | grep circuit_breaker

# 3. Review service logs for errors
docker-compose logs shared-storage-service | grep -i "circuit\|error" | tail -20

# 4. Check dependent service health
curl http://redis:6379/health  # If applicable
```

**Resolution Procedures:**

**Manual Circuit Breaker Reset**
```bash
# Reset circuit breaker via admin endpoint (if available)
curl -X POST http://localhost:3000/admin/circuit-breaker/reset \
  -H "Authorization: Bearer <admin-token>"

# Or restart the service
docker-compose restart shared-storage-service
```

**Identify Root Cause**
```bash
# Check Redis connectivity
docker-compose exec redis redis-cli ping

# Verify storage permissions
ls -la /opt/shared-storage
docker-compose exec shared-storage-service ls -la /app/storage

# Check for file system errors
docker-compose exec shared-storage-service df -h
docker-compose exec shared-storage-service du -sh /app/storage/*
```

**Configuration Adjustment**
```yaml
# Adjust circuit breaker settings in environment
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_RECOVERY_TIMEOUT=60000
CIRCUIT_BREAKER_MONITORING_WINDOW=120000
```

**Prevention:**
- Monitor error rates continuously
- Implement gradual recovery (half-open state)
- Configure appropriate thresholds
- Set up alerts for circuit breaker events

## Performance Issues

### Issue: High Latency

**Symptoms:**
- Response times > 500ms
- Client timeouts
- Performance degradation alerts

**Diagnostic Steps:**
```bash
# 1. Check response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/health

# 2. Monitor system resources
docker stats shared-storage-service

# 3. Check database performance
docker-compose exec redis redis-cli info stats

# 4. Analyze request patterns
curl http://localhost:3000/metrics | grep http_request_duration

# 5. Check for memory leaks
docker-compose exec shared-storage-service ps aux | grep node
```

**Resolution Procedures:**

**Resource Optimization**
```bash
# Increase container resources
docker-compose up -d --scale shared-storage-service=2

# Or adjust Kubernetes resources
kubectl patch deployment shared-storage-service -n shared-storage \
  --type='json' -p='[
    {"op": "replace", "path": "/spec/template/spec/containers/0/resources/limits/cpu", "value": "1000m"},
    {"op": "replace", "path": "/spec/template/spec/containers/0/resources/limits/memory", "value": "2Gi"}
  ]'
```

**Cache Configuration**
```bash
# Adjust cache settings
export CACHE_TTL_SECONDS=1800  # 30 minutes
export CACHE_MAX_SIZE_MB=512
export CACHE_COMPRESSION_ENABLED=true

# Restart service
docker-compose restart shared-storage-service
```

**Database Optimization**
```bash
# Redis configuration tuning
docker-compose exec redis redis-cli config set maxmemory 512mb
docker-compose exec redis redis-cli config set maxmemory-policy allkeys-lru

# Monitor Redis performance
docker-compose exec redis redis-cli info memory
```

**Prevention:**
- Implement performance monitoring
- Set up auto-scaling rules
- Configure appropriate cache settings
- Regular performance testing

### Issue: Memory Exhaustion

**Symptoms:**
- Out of memory errors
- Service restarts
- Performance degradation

**Diagnostic Steps:**
```bash
# 1. Check memory usage
docker stats shared-storage-service

# 2. Monitor application memory
curl http://localhost:3000/metrics | grep nodejs_heap

# 3. Check for memory leaks
docker-compose logs shared-storage-service | grep -i "heap\|memory\|gc"

# 4. Analyze heap dumps (if available)
docker-compose exec shared-storage-service node --inspect=0.0.0.0:9229
```

**Resolution Procedures:**

**Memory Limit Adjustment**
```bash
# Increase memory limits
export NODE_OPTIONS="--max-old-space-size=2048"

# Or set in docker-compose.yml
environment:
  - NODE_OPTIONS=--max-old-space-size=2048

# Restart service
docker-compose restart shared-storage-service
```

**Memory Leak Investigation**
```bash
# Enable heap profiling
export NODE_OPTIONS="--expose-gc --max-old-space-size=2048"

# Generate heap snapshot
docker-compose exec shared-storage-service node -e "process.memoryUsage()"

# Use memory monitoring tools
docker-compose exec shared-storage-service npm install -g clinic
docker-compose exec shared-storage-service clinic heapprofiler -- node app.js
```

**Cache Size Reduction**
```bash
# Reduce cache sizes
export CACHE_MAX_SIZE_MB=256
export SESSION_CACHE_SIZE=1000
export FILE_CACHE_SIZE=500

# Clear existing caches
docker-compose exec redis redis-cli flushall
```

**Prevention:**
- Implement memory monitoring
- Set appropriate memory limits
- Regular memory leak testing
- Configure garbage collection tuning

## Permission Issues

### Issue: Access Denied Errors

**Symptoms:**
- HTTP 403 Forbidden
- PERMISSION_DENIED error codes
- Service authorization failures

**Diagnostic Steps:**
```bash
# 1. Check service permissions
curl "http://localhost:3000/sessions/test-session/permissions?service=file-processor"

# 2. Verify service configuration
docker-compose exec shared-storage-service cat /app/config/services.json

# 3. Check authentication tokens
curl -H "Authorization: Bearer <token>" \
     "http://localhost:3000/sessions/test-session/permissions?service=file-processor"

# 4. Review authorization logs
docker-compose logs shared-storage-service | grep -i "permission\|auth" | tail -20
```

**Resolution Procedures:**

**Service Configuration Update**
```json
// services.json
{
  "file-processor": {
    "name": "file-processor",
    "permissions": {
      "canRead": true,
      "canWrite": true,
      "allowedSubPaths": ["converted_images/", "metadata/", "temp/"]
    },
    "allowedSessionPatterns": ["*"]
  }
}
```

**JWT Token Validation**
```bash
# Verify token format
echo "<token>" | jq -R 'split(".") | .[1] | @base64d | fromjson'

# Check token expiry
curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/auth/verify

# Rotate expired tokens
curl -X POST http://localhost:3000/auth/refresh \
  -H "Authorization: Bearer <refresh-token>"
```

**Session Access Verification**
```bash
# Check session existence
curl "http://localhost:3000/sessions/test-session/permissions?service=file-processor"

# Verify session ownership
curl "http://localhost:3000/sessions/test-session/info"

# Check session permissions
ls -la /opt/shared-storage/sessions/test-session/
```

**Prevention:**
- Implement proper authentication
- Regular permission audits
- Token rotation policies
- Service registration validation

### Issue: Path Traversal Detected

**Symptoms:**
- HTTP 400 Bad Request
- PATH_TRAVERSAL_DETECTED error
- Security alerts

**Diagnostic Steps:**
```bash
# 1. Check request logs
docker-compose logs shared-storage-service | grep -i "traversal\|../\|path" | tail -10

# 2. Analyze suspicious requests
curl "http://localhost:3000/sessions/test-session/files/../../../etc/passwd"

# 3. Verify path validation
curl "http://localhost:3000/sessions/test-session/files/valid/path.txt"
```

**Resolution Procedures:**

**Path Validation Enhancement**
```typescript
// Enhanced path validation
function validatePath(filepath: string): boolean {
  // Remove path traversal attempts
  const normalized = path.normalize(filepath);

  // Check for suspicious patterns
  const suspicious = ['../', '..\\', '~', '$HOME'];

  return !suspicious.some(pattern => normalized.includes(pattern));
}
```

**Input Sanitization**
```bash
# Implement input validation middleware
export INPUT_VALIDATION_ENABLED=true
export PATH_TRAVERSAL_PROTECTION=true

# Restart service
docker-compose restart shared-storage-service
```

**Security Audit**
```bash
# Audit recent requests for suspicious patterns
docker-compose logs shared-storage-service | grep -E "\.\./|\.\.\\|~" | tail -20

# Check file system for unauthorized access
find /opt/shared-storage -type f -mtime -1 | head -10
```

**Prevention:**
- Implement strict input validation
- Use path normalization
- Regular security audits
- Monitor for suspicious patterns

## Data Issues

### Issue: File Not Found

**Symptoms:**
- HTTP 404 Not Found
- FILE_NOT_FOUND error codes
- Missing file errors

**Diagnostic Steps:**
```bash
# 1. Check file existence
curl "http://localhost:3000/sessions/test-session/files/document.pdf/exists?service=file-processor"

# 2. Verify file system
ls -la /opt/shared-storage/sessions/test-session/

# 3. Check file permissions
ls -la /opt/shared-storage/sessions/test-session/document.pdf

# 4. Review file access logs
docker-compose logs shared-storage-service | grep "document.pdf" | tail -10
```

**Resolution Procedures:**

**File Recovery**
```bash
# Check backup locations
ls -la /opt/shared-storage/backups/

# Restore from backup
cp /opt/shared-storage/backups/session-backup.tar.gz /tmp/
cd /tmp && tar -xzf session-backup.tar.gz
cp -r session-data/* /opt/shared-storage/sessions/
```

**Permission Correction**
```bash
# Fix file permissions
chown -R sharedstorage:sharedstorage /opt/shared-storage/sessions/test-session/
chmod 644 /opt/shared-storage/sessions/test-session/document.pdf

# Verify permissions
ls -la /opt/shared-storage/sessions/test-session/document.pdf
```

**File System Check**
```bash
# Check disk space
df -h /opt/shared-storage

# Check for file system errors
docker-compose exec shared-storage-service fsck -n /dev/sda1

# Verify file integrity
docker-compose exec shared-storage-service sha256sum /app/storage/sessions/test-session/document.pdf
```

**Prevention:**
- Implement regular backups
- Monitor disk space
- Set up file integrity checks
- Configure proper permissions

### Issue: Corrupted Files

**Symptoms:**
- File read errors
- Checksum mismatches
- Data corruption alerts

**Diagnostic Steps:**
```bash
# 1. Check file integrity
curl "http://localhost:3000/sessions/test-session/files/document.pdf/checksum?service=file-processor"

# 2. Verify file size
ls -la /opt/shared-storage/sessions/test-session/document.pdf

# 3. Check for corruption patterns
file /opt/shared-storage/sessions/test-session/document.pdf

# 4. Review corruption logs
docker-compose logs shared-storage-service | grep -i "corrupt\|checksum" | tail -10
```

**Resolution Procedures:**

**File Integrity Verification**
```bash
# Calculate and compare checksums
original_checksum=$(cat /opt/shared-storage/checksums/document.pdf.sha256)
current_checksum=$(sha256sum /opt/shared-storage/sessions/test-session/document.pdf | cut -d' ' -f1)

if [[ "$original_checksum" != "$current_checksum" ]]; then
  echo "File corrupted, restoring from backup"
  cp /opt/shared-storage/backups/document.pdf.backup /opt/shared-storage/sessions/test-session/document.pdf
fi
```

**Data Recovery Process**
```bash
# Restore from backup
cp /opt/shared-storage/backups/daily-backup.tar.gz /tmp/
cd /tmp && tar -xzf daily-backup.tar.gz

# Compare and merge changes
rsync -av --compare-dest=/tmp/backup-data/ /opt/shared-storage/sessions/

# Verify recovery
curl "http://localhost:3000/sessions/test-session/files/document.pdf/exists?service=file-processor"
```

**Corruption Prevention**
```bash
# Enable integrity checking
export FILE_INTEGRITY_CHECK_ENABLED=true
export CHECKSUM_VERIFICATION=true

# Restart service
docker-compose restart shared-storage-service
```

**Prevention:**
- Implement checksum verification
- Regular integrity checks
- Redundant storage
- Corruption monitoring

## Configuration Issues

### Issue: Invalid Configuration

**Symptoms:**
- Service startup failures
- Configuration errors in logs
- Service instability

**Diagnostic Steps:**
```bash
# 1. Check configuration files
docker-compose exec shared-storage-service cat /app/config/services.json

# 2. Validate configuration syntax
docker-compose exec shared-storage-service node -e "console.log(JSON.parse(require('fs').readFileSync('/app/config/services.json', 'utf8')))"

# 3. Check environment variables
docker-compose exec shared-storage-service env | grep -E "(STORAGE|REDIS|LOG)"

# 4. Review configuration logs
docker-compose logs shared-storage-service | grep -i "config\|invalid" | tail -10
```

**Resolution Procedures:**

**Configuration Validation**
```bash
#!/bin/bash
# config-validator.sh

echo "Validating SharedStorageService configuration..."

# Check required environment variables
required_vars=("STORAGE_BASE" "REDIS_URL" "SHARED_STORAGE_PORT")
for var in "${required_vars[@]}"; do
  if [[ -z "${!var}" ]]; then
    echo "ERROR: Missing required environment variable: $var"
    exit 1
  fi
done

# Validate JSON configuration
if ! jq . /app/config/services.json >/dev/null 2>&1; then
  echo "ERROR: Invalid JSON in services.json"
  exit 1
fi

# Check storage directory
if [[ ! -d "$STORAGE_BASE" ]]; then
  echo "ERROR: Storage directory does not exist: $STORAGE_BASE"
  exit 1
fi

echo "Configuration validation passed!"
```

**Configuration Correction**
```json
// Corrected services.json
{
  "file-processor": {
    "name": "file-processor",
    "permissions": {
      "canRead": true,
      "canWrite": true,
      "allowedSubPaths": ["converted_images/", "metadata/"]
    },
    "allowedSessionPatterns": ["^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$"]
  },
  "llm-orchestrator": {
    "name": "llm-orchestrator",
    "permissions": {
      "canRead": true,
      "canWrite": false,
      "allowedSubPaths": ["converted_images/"]
    }
  }
}
```

**Environment Variable Fix**
```bash
# Correct environment variables
export STORAGE_BASE=/opt/shared-storage
export REDIS_URL=redis://redis:6379
export SHARED_STORAGE_PORT=3000
export LOG_LEVEL=info

# Restart service with corrected config
docker-compose restart shared-storage-service
```

**Prevention:**
- Implement configuration validation
- Use configuration management tools
- Regular configuration audits
- Automated testing of configurations

## Automated Troubleshooting Tools

### Diagnostic Script
```bash
#!/bin/bash
# shared-storage-diagnostics.sh

echo "=== SharedStorageService Diagnostics ==="
echo "Timestamp: $(date)"
echo

echo "1. Service Health Check"
curl -s http://localhost:3000/health | jq .
echo

echo "2. Resource Usage"
docker stats --no-stream shared-storage-service
echo

echo "3. Recent Errors"
docker-compose logs --tail=10 shared-storage-service | grep -i error
echo

echo "4. Configuration Validation"
docker-compose exec -T shared-storage-service node -e "
const config = require('./config/services.json');
console.log('Configuration loaded successfully');
console.log('Services:', Object.keys(config).length);
"
echo

echo "5. Storage Status"
df -h /opt/shared-storage
echo

echo "=== Diagnostics Complete ==="
```

### Automated Recovery Script
```bash
#!/bin/bash
# shared-storage-recovery.sh

echo "Starting SharedStorageService recovery process..."

# 1. Check if service is running
if ! docker-compose ps shared-storage-service | grep -q "Up"; then
  echo "Service is down, attempting restart..."
  docker-compose restart shared-storage-service
  sleep 10
fi

# 2. Verify health
health=$(curl -s http://localhost:3000/health | jq -r '.status')
if [[ "$health" != "healthy" ]]; then
  echo "Service not healthy, checking detailed status..."
  curl -s http://localhost:3000/health/detailed | jq '.checks'
fi

# 3. Check resources
memory_usage=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" shared-storage-service | tail -1)
echo "Resource usage: $memory_usage"

# 4. Clear caches if memory high
mem_percent=$(docker stats --no-stream --format "{{.MemPerc}}" shared-storage-service | sed 's/%//')
if (( $(echo "$mem_percent > 80" | bc -l) )); then
  echo "High memory usage detected, clearing caches..."
  docker-compose exec redis redis-cli flushall
fi

echo "Recovery process completed"
```

## Monitoring Integration

### Alert Configuration
```yaml
# Prometheus alerting rules
groups:
  - name: shared-storage-alerts
    rules:
      - alert: SharedStorageServiceDown
        expr: up{job="shared-storage-service"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "SharedStorageService is down"

      - alert: SharedStorageHighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency in SharedStorageService"

      - alert: SharedStorageHighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate in SharedStorageService"
```

### Log Aggregation
```yaml
# Filebeat configuration
filebeat.inputs:
  - type: docker
    containers:
      ids: ["shared-storage-service"]
    processors:
      - add_docker_metadata:
          host: "unix:///var/run/docker.sock"
    fields:
      service: shared-storage-service
      environment: production

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
  index: "shared-storage-service-%{+yyyy.MM.dd}"
```

## Contact Information

### Support Teams
- **Primary**: DevOps Team (devops@company.com)
- **Secondary**: Platform Team (platform@company.com)
- **Escalation**: SRE Team (sre@company.com)

### Communication Channels
- **Chat**: #shared-storage-support
- **Email**: alerts@company.com
- **Phone**: +1-555-SUPPORT (780-6787)

### Escalation Matrix
1. **L1**: Initial diagnosis and basic fixes (DevOps)
2. **L2**: Complex issues requiring code changes (Platform)
3. **L3**: Critical incidents requiring immediate attention (SRE)

## References

- [API Reference](./api-reference.md)
- [Configuration Guide](./configuration-guide.md)
- [Monitoring Procedures](./monitoring-procedures.md)
- [Deployment Runbook](./deployment-runbook.md)
- [Architecture Documentation](../../../../docs/architecture/7-security-architecture-and-compliance-framework.md)
