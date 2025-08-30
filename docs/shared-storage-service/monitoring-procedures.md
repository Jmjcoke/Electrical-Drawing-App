# SharedStorageService Monitoring Procedures

## Overview

This document outlines comprehensive monitoring procedures for the SharedStorageService, including alert response procedures, dashboard interpretation, monitoring threshold configuration, log analysis procedures, and performance baseline establishment.

## Monitoring Architecture

### Metrics Collection

The SharedStorageService exposes metrics in Prometheus format at `/metrics` endpoint:

```prometheus
# HELP shared_storage_operations_total Total number of storage operations
# TYPE shared_storage_operations_total counter
shared_storage_operations_total{operation="getSessionPath",service="file-processor"} 150

# HELP shared_storage_operation_duration_seconds Operation duration histogram
# TYPE shared_storage_operation_duration_seconds histogram
shared_storage_operation_duration_seconds_bucket{operation="accessFile",le="0.1"} 140
shared_storage_operation_duration_seconds_bucket{operation="accessFile",le="0.5"} 145

# HELP shared_storage_errors_total Total number of errors by type
# TYPE shared_storage_errors_total counter
shared_storage_errors_total{error_type="PERMISSION_DENIED"} 5

# HELP shared_storage_cache_hit_ratio Cache hit ratio percentage
# TYPE shared_storage_cache_hit_ratio gauge
shared_storage_cache_hit_ratio{cache_type="session"} 0.85
```

### Health Check Endpoints

#### Basic Health Check (`/health`)
```json
{
  "status": "healthy",
  "timestamp": "2024-01-27T10:30:00.000Z",
  "service": "shared-storage-service",
  "version": "1.0.0"
}
```

#### Detailed Health Check (`/health/detailed`)
```json
{
  "status": "healthy",
  "timestamp": "2024-01-27T10:30:00.000Z",
  "service": "shared-storage-service",
  "version": "1.0.0",
  "checks": {
    "filesystem": {
      "status": "healthy",
      "timestamp": "2024-01-27T10:30:00.000Z",
      "details": {
        "totalSpace": "100GB",
        "usedSpace": "25GB",
        "availableSpace": "75GB"
      }
    },
    "permissions": {
      "status": "healthy",
      "timestamp": "2024-01-27T10:30:00.000Z",
      "details": {
        "configValid": true,
        "servicesConfigured": 3
      }
    },
    "sessions": {
      "status": "healthy",
      "timestamp": "2024-01-27T10:30:00.000Z",
      "details": {
        "activeSessions": 15,
        "totalSessions": 150,
        "averageSessionSize": "2.3MB"
      }
    }
  }
}
```

#### Readiness Check (`/health/ready`)
```json
{
  "status": "ready",
  "ready": true,
  "timestamp": "2024-01-27T10:30:00.000Z",
  "checks": [
    {
      "name": "filesystem",
      "status": "ready"
    },
    {
      "name": "redis",
      "status": "ready"
    }
  ]
}
```

#### Liveness Check (`/health/live`)
```json
{
  "status": "alive",
  "alive": true,
  "timestamp": "2024-01-27T10:30:00.000Z"
}
```

## Alert Response Procedures

### Critical Alerts (P0)

#### Alert: SharedStorageServiceDown
**Severity**: Critical
**Description**: Service is completely unavailable

**Response Procedure**:
1. **Immediate Assessment** (0-2 minutes)
   ```bash
   # Check service status
   docker-compose ps shared-storage-service

   # Check logs for crash information
   docker-compose logs --tail=50 shared-storage-service

   # Verify system resources
   docker stats shared-storage-service
   ```

2. **Service Restart** (2-5 minutes)
   ```bash
   # Attempt service restart
   docker-compose restart shared-storage-service

   # Monitor startup logs
   docker-compose logs -f shared-storage-service
   ```

3. **Dependency Check** (3-5 minutes)
   ```bash
   # Check Redis connectivity
   docker-compose exec redis redis-cli ping

   # Verify storage mount
   docker-compose exec shared-storage-service ls -la /app/storage

   # Check network connectivity
   docker-compose exec shared-storage-service curl -f http://redis:6379
   ```

4. **Escalation** (5+ minutes)
   - Notify SRE team
   - Check infrastructure alerts
   - Consider failover procedures

**Recovery Verification**:
```bash
# Verify all health endpoints
curl -f http://localhost:3000/health
curl -f http://localhost:3000/health/detailed
curl -f http://localhost:3000/health/ready
curl -f http://localhost:3000/health/live

# Test core functionality
curl "http://localhost:3000/sessions/test-session/permissions?service=file-processor"
```

#### Alert: SharedStorageDataCorruption
**Severity**: Critical
**Description**: File integrity check failures detected

**Response Procedure**:
1. **Isolate Affected Data** (0-5 minutes)
   ```bash
   # Identify corrupted files
   docker-compose logs shared-storage-service | grep -i "corrupt\|checksum" | tail -20

   # Quarantine affected sessions
   mkdir -p /opt/shared-storage/quarantine
   mv /opt/shared-storage/sessions/corrupted-session-* /opt/shared-storage/quarantine/
   ```

2. **Data Recovery** (5-15 minutes)
   ```bash
   # Restore from backup
   ls -la /opt/shared-storage/backups/
   tar -xzf /opt/shared-storage/backups/latest-backup.tar.gz -C /tmp/

   # Verify backup integrity
   find /tmp/backup-data -type f -exec sha256sum {} \; > /tmp/backup-checksums.txt

   # Selective restore
   rsync -av --checksum /tmp/backup-data/ /opt/shared-storage/sessions/
   ```

3. **Integrity Verification** (10-20 minutes)
   ```bash
   # Run integrity check on all files
   find /opt/shared-storage/sessions -type f -exec sha256sum {} \; > /opt/shared-storage/current-checksums.txt

   # Compare with known good checksums
   diff /opt/shared-storage/known-good-checksums.txt /opt/shared-storage/current-checksums.txt
   ```

### High Priority Alerts (P1)

#### Alert: SharedStorageHighErrorRate
**Severity**: High
**Description**: Error rate exceeds 10% for 5+ minutes

**Response Procedure**:
1. **Error Analysis** (0-5 minutes)
   ```bash
   # Check error metrics
   curl http://localhost:3000/metrics | grep errors

   # Analyze recent logs
   docker-compose logs shared-storage-service --since "5m" | grep -i error

   # Check error distribution by type
   docker-compose logs shared-storage-service | grep -o "ERROR.*:" | sort | uniq -c | sort -nr
   ```

2. **Root Cause Identification** (5-15 minutes)
   ```bash
   # Check system resources
   docker stats shared-storage-service

   # Verify Redis performance
   docker-compose exec redis redis-cli info stats

   # Check disk space
   df -h /opt/shared-storage

   # Analyze request patterns
   docker-compose logs shared-storage-service | grep "GET\|POST" | head -50
   ```

3. **Mitigation Actions** (10-30 minutes)
   ```bash
   # Scale service if needed
   docker-compose up -d --scale shared-storage-service=2

   # Clear caches if memory pressure
   docker-compose exec redis redis-cli flushall

   # Restart service if configuration issue
   docker-compose restart shared-storage-service
   ```

#### Alert: SharedStorageDiskSpaceLow
**Severity**: High
**Description**: Disk usage exceeds 80%

**Response Procedure**:
1. **Disk Usage Assessment** (0-5 minutes)
   ```bash
   # Check disk usage
   df -h /opt/shared-storage

   # Analyze storage distribution
   du -sh /opt/shared-storage/sessions/*
   du -sh /opt/shared-storage/temp/*
   du -sh /opt/shared-storage/logs/*
   ```

2. **Cleanup Actions** (5-15 minutes)
   ```bash
   # Remove expired temporary files
   find /opt/shared-storage/temp -type f -mtime +1 -delete

   # Clean old log files
   find /opt/shared-storage/logs -name "*.log" -mtime +7 -delete

   # Remove orphaned sessions
   # (Custom cleanup script)
   ./cleanup-orphaned-sessions.sh
   ```

3. **Capacity Planning** (15-30 minutes)
   ```bash
   # Monitor growth trends
   du -sh /opt/shared-storage/sessions | sort -hr | head -10

   # Check backup sizes
   ls -lah /opt/shared-storage/backups/

   # Evaluate scaling options
   df -h /
   ```

### Medium Priority Alerts (P2)

#### Alert: SharedStorageHighLatency
**Severity**: Medium
**Description**: P95 latency exceeds 1 second for 5+ minutes

**Response Procedure**:
1. **Latency Analysis** (0-10 minutes)
   ```bash
   # Check current latency metrics
   curl http://localhost:3000/metrics | grep http_request_duration

   # Analyze slow requests
   docker-compose logs shared-storage-service | grep "duration\|latency" | tail -20

   # Check system load
   uptime
   docker stats shared-storage-service
   ```

2. **Performance Tuning** (10-30 minutes)
   ```bash
   # Adjust cache settings
   export CACHE_TTL_SECONDS=1800
   export CACHE_MAX_SIZE_MB=1024

   # Optimize connection pool
   export REDIS_CONNECTION_POOL_SIZE=20

   # Restart with new settings
   docker-compose restart shared-storage-service
   ```

#### Alert: SharedStorageCircuitBreakerOpen
**Severity**: Medium
**Description**: Circuit breaker has opened

**Response Procedure**:
1. **Circuit Breaker Assessment** (0-5 minutes)
   ```bash
   # Check circuit breaker status
   curl http://localhost:3000/health/detailed | jq '.checks.circuit_breaker'

   # Review error patterns
   docker-compose logs shared-storage-service | grep -i "circuit" | tail -10
   ```

2. **Dependency Analysis** (5-15 minutes)
   ```bash
   # Check Redis health
   docker-compose exec redis redis-cli info

   # Verify network connectivity
   docker-compose exec shared-storage-service ping redis

   # Check disk I/O performance
   iostat -x 1 5
   ```

3. **Gradual Recovery** (15-30 minutes)
   ```bash
   # Monitor recovery attempts
   docker-compose logs -f shared-storage-service | grep -i "circuit\|half-open\|closed"

   # Adjust circuit breaker settings if needed
   export CIRCUIT_BREAKER_FAILURE_THRESHOLD=10
   export CIRCUIT_BREAKER_RECOVERY_TIMEOUT=120000
   ```

## Dashboard Interpretation Guide

### Main Service Dashboard

#### Key Metrics to Monitor

**Request Rate and Success**
```prometheus
# Request rate per second
rate(http_requests_total[5m])

# Success rate percentage
rate(http_requests_total{status=~"2.."}[5m]) / rate(http_requests_total[5m]) * 100
```

**Response Time Analysis**
```prometheus
# P50, P95, P99 response times
histogram_quantile(0.5, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

**Error Analysis**
```prometheus
# Error rate by status code
rate(http_requests_total{status=~"4.."}[5m])  # Client errors
rate(http_requests_total{status=~"5.."}[5m])  # Server errors

# Error rate by type
rate(shared_storage_errors_total[5m])
```

#### Resource Utilization

**Memory Usage**
```prometheus
# Heap usage
nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes * 100

# Cache hit ratio
shared_storage_cache_hit_ratio
```

**CPU Usage**
```prometheus
# CPU utilization
rate(process_cpu_user_seconds_total[5m]) * 100
```

**Storage Usage**
```prometheus
# Disk usage percentage
(1 - node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100

# File system I/O
rate(node_disk_io_time_seconds_total[5m])
```

### Operational Dashboards

#### Service Health Dashboard

**Health Status Indicators**
- **Overall Health**: Aggregated status from all health checks
- **Subsystem Health**: Individual component status (filesystem, Redis, network)
- **Dependency Health**: External service connectivity status

**Key Panels**
```json
{
  "title": "Service Health Overview",
  "panels": [
    {
      "title": "Overall Health Status",
      "type": "stat",
      "targets": [
        {
          "expr": "up{job='shared-storage-service'}",
          "legendFormat": "Service Status"
        }
      ]
    },
    {
      "title": "Health Check Details",
      "type": "table",
      "targets": [
        {
          "expr": "shared_storage_health_check_status",
          "legendFormat": "{{check_name}}"
        }
      ]
    }
  ]
}
```

#### Performance Dashboard

**Latency Monitoring**
```json
{
  "title": "Request Latency",
  "type": "graph",
  "targets": [
    {
      "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
      "legendFormat": "P95 Latency"
    },
    {
      "expr": "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))",
      "legendFormat": "P99 Latency"
    }
  ]
}
```

**Throughput Monitoring**
```json
{
  "title": "Request Throughput",
  "type": "graph",
  "targets": [
    {
      "expr": "rate(http_requests_total[5m])",
      "legendFormat": "Requests/sec"
    },
    {
      "expr": "rate(shared_storage_operations_total[5m])",
      "legendFormat": "Operations/sec"
    }
  ]
}
```

#### Error Dashboard

**Error Rate Monitoring**
```json
{
  "title": "Error Rate Analysis",
  "type": "graph",
  "targets": [
    {
      "expr": "rate(shared_storage_errors_total[5m])",
      "legendFormat": "{{error_type}}"
    }
  ]
}
```

**Error Distribution**
```json
{
  "title": "Error Distribution",
  "type": "piechart",
  "targets": [
    {
      "expr": "sum(rate(shared_storage_errors_total[1h])) by (error_type)",
      "legendFormat": "{{error_type}}"
    }
  ]
}
```

### Custom Dashboards

#### Cache Performance Dashboard
```json
{
  "title": "Cache Performance",
  "panels": [
    {
      "title": "Cache Hit Ratio",
      "type": "gauge",
      "targets": [
        {
          "expr": "shared_storage_cache_hit_ratio * 100",
          "legendFormat": "Hit Ratio %"
        }
      ]
    },
    {
      "title": "Cache Size vs Capacity",
      "type": "bargauge",
      "targets": [
        {
          "expr": "shared_storage_cache_size_bytes / shared_storage_cache_max_size_bytes * 100",
          "legendFormat": "Cache Usage %"
        }
      ]
    }
  ]
}
```

#### Storage Dashboard
```json
{
  "title": "Storage Utilization",
  "panels": [
    {
      "title": "Disk Usage",
      "type": "bargauge",
      "targets": [
        {
          "expr": "(1 - node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100",
          "legendFormat": "Disk Usage %"
        }
      ]
    },
    {
      "title": "Session Distribution",
      "type": "table",
      "targets": [
        {
          "expr": "shared_storage_session_count",
          "legendFormat": "Active Sessions"
        }
      ]
    }
  ]
}
```

## Monitoring Threshold Configuration

### Prometheus Alert Rules

#### Critical Thresholds
```yaml
groups:
  - name: shared-storage-service-critical
    rules:
      - alert: SharedStorageServiceDown
        expr: up{job="shared-storage-service"} == 0
        for: 2m
        labels:
          severity: critical
          priority: p0
        annotations:
          summary: "SharedStorageService is down"
          description: "SharedStorageService has been down for more than 2 minutes"
          runbook_url: "./troubleshooting-guide.md#alert-sharedstorageservicedown"

      - alert: SharedStorageDataCorruption
        expr: rate(shared_storage_corruption_errors_total[5m]) > 0
        for: 1m
        labels:
          severity: critical
          priority: p0
        annotations:
          summary: "Data corruption detected"
          description: "File integrity check failures detected"
          runbook_url: "./troubleshooting-guide.md#alert-sharedstoragedatacorruption"
```

#### High Priority Thresholds
```yaml
  - name: shared-storage-service-high
    rules:
      - alert: SharedStorageHighErrorRate
        expr: rate(shared_storage_errors_total[5m]) / rate(shared_storage_operations_total[5m]) > 0.1
        for: 5m
        labels:
          severity: high
          priority: p1
        annotations:
          summary: "High error rate detected"
          description: "Error rate exceeds 10% for 5+ minutes"
          runbook_url: "./monitoring-procedures.md#alert-sharedstoragehigherorrate"

      - alert: SharedStorageDiskSpaceLow
        expr: (1 - node_filesystem_avail_bytes{mountpoint="/opt/shared-storage"} / node_filesystem_size_bytes{mountpoint="/opt/shared-storage"}) > 0.8
        for: 10m
        labels:
          severity: high
          priority: p1
        annotations:
          summary: "Low disk space"
          description: "Disk usage exceeds 80%"
          runbook_url: "./monitoring-procedures.md#alert-sharedstoragediskspacelow"
```

#### Medium Priority Thresholds
```yaml
  - name: shared-storage-service-medium
    rules:
      - alert: SharedStorageHighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: medium
          priority: p2
        annotations:
          summary: "High request latency"
          description: "P95 latency exceeds 1 second for 5+ minutes"
          runbook_url: "./monitoring-procedures.md#alert-sharedstoragehighlatency"

      - alert: SharedStorageCircuitBreakerOpen
        expr: shared_storage_circuit_breaker_state == 1
        for: 2m
        labels:
          severity: medium
          priority: p2
        annotations:
          summary: "Circuit breaker opened"
          description: "Circuit breaker has opened due to failures"
          runbook_url: "./monitoring-procedures.md#alert-sharedstorageCircuitBreakerOpen"
```

#### Warning Thresholds
```yaml
  - name: shared-storage-service-warning
    rules:
      - alert: SharedStorageMemoryUsageHigh
        expr: (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) > 0.85
        for: 5m
        labels:
          severity: warning
          priority: p3
        annotations:
          summary: "High memory usage"
          description: "Memory usage exceeds 85%"

      - alert: SharedStorageCacheMissRateHigh
        expr: (1 - shared_storage_cache_hit_ratio) > 0.3
        for: 10m
        labels:
          severity: warning
          priority: p3
        annotations:
          summary: "High cache miss rate"
          description: "Cache miss rate exceeds 30%"
```

### Dynamic Thresholds

#### Adaptive Alerting
```yaml
# Adaptive thresholds based on historical data
- alert: SharedStorageAnomalousLatency
  expr: |
    rate(http_request_duration_seconds_sum[5m]) /
    rate(http_request_duration_seconds_count[5m]) >
    2 * avg_over_time(
      rate(http_request_duration_seconds_sum[1h]) /
      rate(http_request_duration_seconds_count[1h])[24h:1h]
    )
  for: 5m
  labels:
    severity: medium
  annotations:
    summary: "Anomalous latency detected"
    description: "Request latency is 2x higher than 24h average"
```

#### Seasonal Adjustments
```yaml
# Business hours vs off-hours thresholds
- alert: SharedStorageHighLoadBusinessHours
  expr: |
    rate(http_requests_total[5m]) > 1000
    and hour() >= 9 and hour() <= 17
  for: 5m
  labels:
    severity: info
  annotations:
    summary: "High load during business hours"
    description: "Normal business hour traffic pattern"

- alert: SharedStorageHighLoadOffHours
  expr: |
    rate(http_requests_total[5m]) > 500
    and (hour() < 9 or hour() > 17)
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High load outside business hours"
    description: "Unexpected traffic outside normal hours"
```

## Log Analysis Procedures

### Log Collection and Aggregation

#### Log Levels and Formats
```json
// Structured log entry
{
  "timestamp": "2024-01-27T10:30:00.000Z",
  "level": "info",
  "service": "shared-storage-service",
  "operation": "getSessionPath",
  "sessionId": "123e4567-e89b-12d3-a456-426614174000",
  "service": "file-processor",
  "duration": 45,
  "status": "success",
  "metadata": {
    "cache_hit": true,
    "path": "/opt/shared-storage/sessions/123e4567-e89b-12d3-a456-426614174000"
  }
}
```

#### Log Analysis Commands

**Error Analysis**
```bash
# Find all errors in last hour
docker-compose logs shared-storage-service --since "1h" | grep -i error

# Count errors by type
docker-compose logs shared-storage-service | grep "ERROR" | grep -o "ERROR.*:" | sort | uniq -c | sort -nr

# Find errors related to specific session
docker-compose logs shared-storage-service | grep "session-123" | grep -i error
```

**Performance Analysis**
```bash
# Find slow operations (>500ms)
docker-compose logs shared-storage-service | grep -E "duration.*[5-9][0-9][0-9]|[0-9]{4,}"

# Analyze operation patterns
docker-compose logs shared-storage-service | grep "operation=" | sed 's/.*operation="\([^"]*\)".*/\1/' | sort | uniq -c | sort -nr

# Find cache misses
docker-compose logs shared-storage-service | grep "cache_hit=false"
```

**Security Analysis**
```bash
# Find permission denied attempts
docker-compose logs shared-storage-service | grep "PERMISSION_DENIED"

# Find path traversal attempts
docker-compose logs shared-storage-service | grep -E "\.\./|\.\.\\|~"

# Analyze access patterns by service
docker-compose logs shared-storage-service | grep "service=" | sed 's/.*service="\([^"]*\)".*/\1/' | sort | uniq -c | sort -nr
```

### Automated Log Analysis

#### Log Analysis Script
```bash
#!/bin/bash
# log-analysis.sh

echo "=== SharedStorageService Log Analysis ==="
echo "Analysis Period: $(date -d '1 hour ago' '+%Y-%m-%d %H:%M:%S') to $(date '+%Y-%m-%d %H:%M:%S')"
echo

# Get logs from last hour
LOGS=$(docker-compose logs shared-storage-service --since "1h" 2>&1)

echo "1. Error Summary"
echo "----------------"
echo "$LOGS" | grep -i error | wc -l
echo

echo "2. Top Error Types"
echo "------------------"
echo "$LOGS" | grep -i error | grep -o "ERROR.*:" | sort | uniq -c | sort -nr | head -10
echo

echo "3. Performance Issues"
echo "---------------------"
echo "$LOGS" | grep -E "duration.*[5-9][0-9][0-9]|[0-9]{4,}" | wc -l
echo "Slow operations detected"
echo

echo "4. Cache Performance"
echo "-------------------"
CACHE_HITS=$(echo "$LOGS" | grep "cache_hit=true" | wc -l)
CACHE_MISSES=$(echo "$LOGS" | grep "cache_hit=false" | wc -l)
TOTAL_CACHE_REQUESTS=$((CACHE_HITS + CACHE_MISSES))

if [[ $TOTAL_CACHE_REQUESTS -gt 0 ]]; then
  CACHE_HIT_RATIO=$((CACHE_HITS * 100 / TOTAL_CACHE_REQUESTS))
  echo "Cache hit ratio: $CACHE_HIT_RATIO%"
else
  echo "No cache requests found"
fi
echo

echo "5. Top Requested Operations"
echo "---------------------------"
echo "$LOGS" | grep "operation=" | sed 's/.*operation="\([^"]*\)".*/\1/' | sort | uniq -c | sort -nr | head -10
echo

echo "6. Service Usage"
echo "----------------"
echo "$LOGS" | grep "service=" | sed 's/.*service="\([^"]*\)".*/\1/' | sort | uniq -c | sort -nr
echo

echo "7. Recent Security Events"
echo "-------------------------"
echo "$LOGS" | grep -E "PERMISSION_DENIED|PATH_TRAVERSAL" | tail -5
echo

echo "=== Analysis Complete ==="
```

### Log Retention and Rotation

```bash
#!/bin/bash
# log-rotation.sh

LOG_DIR="/opt/shared-storage/logs"
RETENTION_DAYS=30
MAX_LOG_SIZE="100M"

echo "=== Log Rotation Process ==="

# Rotate current logs if they exceed size limit
for log_file in "$LOG_DIR"/*.log; do
  if [[ -f "$log_file" ]]; then
    size=$(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file" 2>/dev/null)
    if [[ $size -gt $(numfmt --from=iec $MAX_LOG_SIZE) ]]; then
      timestamp=$(date +%Y%m%d_%H%M%S)
      mv "$log_file" "${log_file}.${timestamp}"
      echo "Rotated $log_file"
    fi
  fi
done

# Compress old rotated logs
find "$LOG_DIR" -name "*.log.*" -mtime +1 -exec gzip {} \;

# Remove logs older than retention period
find "$LOG_DIR" -name "*.log.gz" -mtime +$RETENTION_DAYS -delete
find "$LOG_DIR" -name "*.log.*" -mtime +$RETENTION_DAYS -delete

echo "Log rotation completed"
```

## Performance Baseline Establishment

### Baseline Data Collection

#### Automated Baseline Script
```bash
#!/bin/bash
# establish-baseline.sh

BASELINE_DIR="/opt/shared-storage/baselines"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=== Establishing Performance Baseline ==="
echo "Timestamp: $TIMESTAMP"

# Create baseline directory
mkdir -p "$BASELINE_DIR/$TIMESTAMP"

# Collect system metrics
echo "Collecting system metrics..."
{
  echo "=== System Information ==="
  uname -a
  echo

  echo "=== CPU Information ==="
  nproc
  cat /proc/cpuinfo | grep "model name" | head -1
  echo

  echo "=== Memory Information ==="
  free -h
  echo

  echo "=== Disk Information ==="
  df -h /opt/shared-storage
  echo

  echo "=== Network Information ==="
  ip addr show | grep -E "inet|link" | head -10
} > "$BASELINE_DIR/$TIMESTAMP/system-info.txt"

# Collect service metrics
echo "Collecting service metrics..."
curl -s http://localhost:3000/metrics > "$BASELINE_DIR/$TIMESTAMP/metrics.txt"
curl -s http://localhost:3000/health/detailed > "$BASELINE_DIR/$TIMESTAMP/health.txt"

# Run performance tests
echo "Running performance tests..."
{
  echo "=== Load Test Results ==="
  # Simulate load test
  for i in {1..10}; do
    start=$(date +%s%N)
    curl -s "http://localhost:3000/sessions/test-session/permissions?service=file-processor" >/dev/null
    end=$(date +%s%N)
    duration=$(( (end - start) / 1000000 ))
    echo "Request $i: ${duration}ms"
  done
} > "$BASELINE_DIR/$TIMESTAMP/performance-test.txt"

# Create baseline summary
{
  echo "=== Performance Baseline Summary ==="
  echo "Date: $TIMESTAMP"
  echo
  echo "System Resources:"
  echo "- CPU Cores: $(nproc)"
  echo "- Memory: $(free -h | grep "^Mem:" | awk '{print $2}')"
  echo "- Storage: $(df -h /opt/shared-storage | tail -1 | awk '{print $2}')"
  echo
  echo "Service Configuration:"
  echo "- Max Concurrent Requests: ${MAX_CONCURRENT_REQUESTS:-100}"
  echo "- Cache TTL: ${CACHE_TTL_SECONDS:-3600}s"
  echo "- Cache Size: ${CACHE_MAX_SIZE_MB:-512}MB"
  echo
  echo "Average Response Time (baseline): $(cat "$BASELINE_DIR/$TIMESTAMP/performance-test.txt" | grep "ms" | awk '{sum += $3} END {print sum/NR "ms"}')"
} > "$BASELINE_DIR/$TIMESTAMP/baseline-summary.txt"

echo "Baseline established: $BASELINE_DIR/$TIMESTAMP"
echo "Summary:"
cat "$BASELINE_DIR/$TIMESTAMP/baseline-summary.txt"
```

### Baseline Comparison Script

```bash
#!/bin/bash
# compare-baseline.sh

CURRENT_BASELINE=$(ls -t /opt/shared-storage/baselines | head -1)
PREVIOUS_BASELINE=$(ls -t /opt/shared-storage/baselines | head -2 | tail -1)

if [[ -z "$PREVIOUS_BASELINE" ]]; then
  echo "No previous baseline found for comparison"
  exit 1
fi

echo "=== Baseline Comparison ==="
echo "Current: $CURRENT_BASELINE"
echo "Previous: $PREVIOUS_BASELINE"
echo

# Compare system resources
echo "System Resource Changes:"
echo "CPU Cores: $(diff /opt/shared-storage/baselines/$PREVIOUS_BASELINE/system-info.txt /opt/shared-storage/baselines/$CURRENT_BASELINE/system-info.txt | grep -E "model name|nproc" || echo "No changes")"

# Compare performance metrics
echo
echo "Performance Changes:"
PREV_AVG=$(grep "Average Response Time" /opt/shared-storage/baselines/$PREVIOUS_BASELINE/baseline-summary.txt | awk '{print $4}')
CURR_AVG=$(grep "Average Response Time" /opt/shared-storage/baselines/$CURRENT_BASELINE/baseline-summary.txt | awk '{print $4}')

if [[ -n "$PREV_AVG" && -n "$CURR_AVG" ]]; then
  CHANGE=$(echo "scale=2; ($CURR_AVG - $PREV_AVG) / $PREV_AVG * 100" | bc)
  echo "Response Time Change: ${CHANGE}%"
fi

# Compare error rates
echo
echo "Error Rate Comparison:"
PREV_ERRORS=$(grep -c "ERROR" /opt/shared-storage/baselines/$PREVIOUS_BASELINE/metrics.txt 2>/dev/null || echo "0")
CURR_ERRORS=$(grep -c "ERROR" /opt/shared-storage/baselines/$CURRENT_BASELINE/metrics.txt 2>/dev/null || echo "0")

if [[ "$PREV_ERRORS" != "0" ]]; then
  ERROR_CHANGE=$(echo "scale=2; ($CURR_ERRORS - $PREV_ERRORS) / $PREV_ERRORS * 100" | bc)
  echo "Error Rate Change: ${ERROR_CHANGE}%"
fi
```

### Baseline Monitoring

#### Baseline Deviation Alerts
```yaml
# Baseline deviation alerts
- alert: SharedStoragePerformanceDegradation
  expr: |
    rate(http_request_duration_seconds_sum[5m]) /
    rate(http_request_duration_seconds_count[5m]) >
    1.5 * shared_storage_baseline_response_time
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Performance degradation detected"
    description: "Response time 50% above baseline"

- alert: SharedStorageErrorRateIncrease
  expr: |
    rate(shared_storage_errors_total[5m]) >
    2 * shared_storage_baseline_error_rate
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Error rate increase detected"
    description: "Error rate doubled from baseline"
```

## Incident Response Integration

### PagerDuty Integration

#### Service Configuration
```json
{
  "name": "SharedStorageService",
  "description": "Cross-service file access service",
  "escalation_policy": "backend-services-policy",
  "alert_creation": "create_alerts_and_incidents",
  "incident_urgency_rule": {
    "type": "use_support_hours",
    "during_support_hours": {
      "type": "constant",
      "urgency": "high"
    },
    "outside_support_hours": {
      "type": "constant",
      "urgency": "low"
    }
  }
}
```

#### Alert Routing Rules
```yaml
# Route alerts to appropriate teams
routing_rules:
  - match:
      severity: critical
    actions:
      - route_to: sre-team
      - create_incident: true
      - notify: on-call-engineer

  - match:
      severity: high
    actions:
      - route_to: backend-team
      - create_incident: true
      - notify: team-lead

  - match:
      severity: medium
    actions:
      - route_to: devops-team
      - create_incident: false
      - notify: slack-channel
```

## References

- [API Reference](./api-reference.md)
- [Troubleshooting Guide](./troubleshooting-guide.md)
- [Configuration Guide](./configuration-guide.md)
- [Deployment Runbook](./deployment-runbook.md)
- [Architecture Documentation](../../../../docs/architecture/8-monitoring-and-observability-strategy.md)
