# SharedStorageService Performance Tuning Guide

## Overview

This guide provides comprehensive performance tuning methodologies, benchmarking procedures, optimization recommendations, and scaling guides for the SharedStorageService. It covers capacity planning, performance monitoring, and optimization strategies.

## Capacity Planning Methodology

### System Requirements Assessment

#### User Load Analysis
```typescript
interface LoadProfile {
  // Concurrent users
  concurrentUsers: number;

  // Request patterns
  requestsPerSecond: number;
  readWriteRatio: number; // 0.0 (read-only) to 1.0 (write-heavy)

  // Data characteristics
  averageFileSize: number; // bytes
  fileSizeDistribution: {
    small: number; // < 1MB
    medium: number; // 1-10MB
    large: number; // 10-100MB
    xlarge: number; // > 100MB
  };

  // Session patterns
  averageSessionDuration: number; // minutes
  peakConcurrentSessions: number;
  sessionDataVolume: number; // GB per session
}
```

#### Capacity Planning Calculator
```bash
#!/bin/bash
# capacity-planner.sh

echo "=== SharedStorageService Capacity Planning ==="

# Input parameters
read -p "Expected concurrent users: " CONCURRENT_USERS
read -p "Requests per second: " RPS
read -p "Read/write ratio (0.0-1.0): " RW_RATIO
read -p "Average file size (MB): " AVG_FILE_SIZE
read -p "Peak concurrent sessions: " PEAK_SESSIONS

# Calculate baseline requirements
READ_RPS=$((RPS * (100 - RW_RATIO * 100) / 100))
WRITE_RPS=$((RPS * (RW_RATIO * 100) / 100))

echo
echo "Calculated Load Profile:"
echo "Read RPS: $READ_RPS"
echo "Write RPS: $WRITE_RPS"
echo "Total RPS: $RPS"
echo

# CPU requirements (rough estimates)
CPU_CORES_READ=$((READ_RPS / 500))  # 500 read RPS per core
CPU_CORES_WRITE=$((WRITE_RPS / 200))  # 200 write RPS per core
TOTAL_CPU_CORES=$((CPU_CORES_READ + CPU_CORES_WRITE))

echo "CPU Requirements:"
echo "Read cores: $CPU_CORES_READ"
echo "Write cores: $CPU_CORES_WRITE"
echo "Total cores: $TOTAL_CPU_CORES"
echo

# Memory requirements
MEMORY_PER_CORE=2048  # MB per core
TOTAL_MEMORY=$((TOTAL_CPU_CORES * MEMORY_PER_CORE))

# Add cache memory
CACHE_SIZE=$((CONCURRENT_USERS * 50))  # 50MB cache per user
TOTAL_MEMORY=$((TOTAL_MEMORY + CACHE_SIZE))

echo "Memory Requirements:"
echo "Base memory: $((TOTAL_CPU_CORES * MEMORY_PER_CORE))MB"
echo "Cache memory: ${CACHE_SIZE}MB"
echo "Total memory: ${TOTAL_MEMORY}MB"
echo

# Storage requirements
DAILY_DATA_VOLUME=$((RPS * AVG_FILE_SIZE * 86400 / 1024 / 1024))  # GB per day
STORAGE_BUFFER=20  # 20% buffer
TOTAL_DAILY_STORAGE=$((DAILY_DATA_VOLUME * (100 + STORAGE_BUFFER) / 100))

echo "Storage Requirements:"
echo "Daily data volume: ${DAILY_DATA_VOLUME}GB"
echo "With buffer: ${TOTAL_DAILY_STORAGE}GB"
echo

# Network requirements
NETWORK_MBPS=$((RPS * AVG_FILE_SIZE * 8 / 1024 / 1024))  # Mbps

echo "Network Requirements:"
echo "Required bandwidth: ${NETWORK_MBPS}Mbps"
echo

echo "=== Recommendations ==="

# Instance type recommendations
if [[ $TOTAL_CPU_CORES -le 2 ]]; then
  echo "Recommended instance: t3.medium (2 vCPU, 4GB RAM)"
elif [[ $TOTAL_CPU_CORES -le 4 ]]; then
  echo "Recommended instance: t3.large (2 vCPU, 8GB RAM)"
elif [[ $TOTAL_CPU_CORES -le 8 ]]; then
  echo "Recommended instance: m5.xlarge (4 vCPU, 16GB RAM)"
elif [[ $TOTAL_CPU_CORES -le 16 ]]; then
  echo "Recommended instance: m5.2xlarge (8 vCPU, 32GB RAM)"
else
  echo "Recommended instance: m5.4xlarge (16 vCPU, 64GB RAM)"
fi

# Storage recommendations
if [[ $TOTAL_DAILY_STORAGE -le 100 ]]; then
  echo "Recommended storage: 500GB SSD"
elif [[ $TOTAL_DAILY_STORAGE -le 500 ]]; then
  echo "Recommended storage: 1TB SSD"
elif [[ $TOTAL_DAILY_STORAGE -le 1000 ]]; then
  echo "Recommended storage: 2TB SSD"
else
  echo "Recommended storage: Custom storage solution required"
fi
```

### Performance Benchmarking Procedures

#### Benchmarking Environment Setup
```bash
#!/bin/bash
# benchmark-setup.sh

echo "=== Performance Benchmarking Environment Setup ==="

# Create isolated benchmarking environment
BENCHMARK_DIR="/opt/shared-storage/benchmark"
mkdir -p "$BENCHMARK_DIR/data"
mkdir -p "$BENCHMARK_DIR/results"
mkdir -p "$BENCHMARK_DIR/logs"

# Generate test data
echo "Generating test data..."
TEST_FILES_COUNT=1000
TEST_FILE_SIZE_MB=10

for i in $(seq 1 $TEST_FILES_COUNT); do
  # Create test session directory
  session_id="bench-session-$(printf "%04d" $i)"
  mkdir -p "$BENCHMARK_DIR/data/$session_id"

  # Generate test file
  dd if=/dev/urandom of="$BENCHMARK_DIR/data/$session_id/test-file-$i.dat" \
     bs=1M count=$TEST_FILE_SIZE_MB 2>/dev/null

  # Create metadata
  cat > "$BENCHMARK_DIR/data/$session_id/metadata.json" << EOF
{
  "sessionId": "$session_id",
  "fileCount": 1,
  "totalSize": ${TEST_FILE_SIZE_MB}000000,
  "createdAt": "$(date -Iseconds)",
  "testData": true
}
EOF
done

echo "Benchmarking environment ready:"
echo "Test files: $TEST_FILES_COUNT"
echo "File size: ${TEST_FILE_SIZE_MB}MB each"
echo "Total data: $((TEST_FILES_COUNT * TEST_FILE_SIZE_MB))MB"
```

#### Load Testing Script
```bash
#!/bin/bash
# load-test.sh

CONCURRENT_USERS="${1:-10}"
DURATION="${2:-60}"
RAMP_UP="${3:-10}"

echo "=== SharedStorageService Load Test ==="
echo "Concurrent users: $CONCURRENT_USERS"
echo "Duration: ${DURATION}s"
echo "Ramp-up time: ${RAMP_UP}s"

# Start monitoring
MONITOR_PID=$(./start-monitoring.sh & echo $!)

# Run load test
echo "Starting load test..."

# Use hey for HTTP load testing
hey -n 10000 -c $CONCURRENT_USERS -q 10 -z ${DURATION}s \
  -m GET \
  -H "X-API-Key: benchmark-key" \
  "http://localhost:3000/sessions/bench-session-0001/permissions?service=file-processor" \
  > "$BENCHMARK_DIR/results/load-test-$(date +%Y%m%d_%H%M%S).txt"

# Stop monitoring
kill $MONITOR_PID

echo "Load test completed"
echo "Results saved to: $BENCHMARK_DIR/results/"
```

#### Monitoring Script for Benchmarks
```bash
#!/bin/bash
# start-monitoring.sh

RESULTS_DIR="$BENCHMARK_DIR/results/monitoring-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo "Starting performance monitoring..."

# System metrics
dstat -t -c -m -d -r -n --output "$RESULTS_DIR/system-metrics.csv" 1 &
DSTAT_PID=$!

# Application metrics
while true; do
  timestamp=$(date +%s)

  # Service health
  health=$(curl -s http://localhost:3000/health/detailed)

  # Extract key metrics
  cpu_percent=$(echo "$health" | jq -r '.system.cpu.percent // 0')
  memory_used=$(echo "$health" | jq -r '.system.memory.used // 0')
  disk_used_percent=$(echo "$health" | jq -r '.system.disk.used_percent // 0')

  # Request metrics
  requests_total=$(curl -s http://localhost:3000/metrics | grep 'http_requests_total' | awk '{print $2}')
  response_time=$(curl -s http://localhost:3000/metrics | grep 'http_request_duration_seconds' | awk '{print $2}')

  # Log metrics
  echo "$timestamp,$cpu_percent,$memory_used,$disk_used_percent,$requests_total,$response_time" >> "$RESULTS_DIR/app-metrics.csv"

  sleep 1
done
```

### Performance Analysis and Reporting

#### Benchmark Results Analyzer
```bash
#!/bin/bash
# analyze-results.sh

RESULTS_FILE="$1"

if [[ -z "$RESULTS_FILE" ]]; then
  echo "Usage: $0 <results-file>"
  exit 1
fi

echo "=== Benchmark Results Analysis ==="

# Response time analysis
echo "Response Time Statistics:"
curl -s http://localhost:3000/metrics | grep http_request_duration | while read -r line; do
  metric=$(echo "$line" | cut -d' ' -f1)
  value=$(echo "$line" | cut -d' ' -f2)

  if [[ $metric == *"95"* ]]; then
    echo "P95: ${value}s"
  elif [[ $metric == *"99"* ]]; then
    echo "P99: ${value}s"
  elif [[ $metric == *"avg"* ]]; then
    echo "Average: ${value}s"
  fi
done

# Throughput analysis
echo
echo "Throughput Analysis:"
requests_per_second=$(curl -s http://localhost:3000/metrics | grep 'rate(http_requests_total' | awk '{print $2}')
echo "Requests/sec: $requests_per_second"

# Error rate analysis
echo
echo "Error Rate Analysis:"
error_rate=$(curl -s http://localhost:3000/metrics | grep 'rate(shared_storage_errors_total' | awk '{print $2}')
echo "Error rate: $error_rate"

# Resource utilization
echo
echo "Resource Utilization:"
docker stats --no-stream shared-storage-service --format "table {{.CPUPerc}}\t{{.MemUsage}}"

# Performance recommendations
echo
echo "=== Performance Recommendations ==="

# Response time recommendations
p95_time=$(curl -s http://localhost:3000/metrics | grep 'http_request_duration_seconds.*95' | awk '{print $2}')
if (( $(echo "$p95_time > 1.0" | bc -l) )); then
  echo "⚠️  High P95 response time detected"
  echo "   Recommendation: Consider increasing cache size or optimizing database queries"
fi

# CPU utilization recommendations
cpu_usage=$(docker stats --no-stream --format "{{.CPUPerc}}" shared-storage-service | sed 's/%//')
if (( $(echo "$cpu_usage > 80" | bc -l) )); then
  echo "⚠️  High CPU utilization detected"
  echo "   Recommendation: Consider horizontal scaling or optimizing CPU-intensive operations"
fi

# Memory utilization recommendations
mem_usage=$(docker stats --no-stream --format "{{.MemPerc}}" shared-storage-service | sed 's/%//')
if (( $(echo "$mem_usage > 85" | bc -l) )); then
  echo "⚠️  High memory utilization detected"
  echo "   Recommendation: Increase memory limits or optimize memory usage"
fi
```

## Optimization Recommendations

### Database Optimizations

#### Redis Configuration Tuning
```yaml
# redis.conf optimizations
maxmemory 512mb
maxmemory-policy allkeys-lru
tcp-keepalive 300
timeout 300
databases 16

# Connection pooling
tcp-backlog 511
maxclients 10000

# Performance tuning
save 900 1
save 300 10
save 60 10000

# Disable unnecessary features for performance
appendonly no
aof-rewrite-incremental-fsync yes
```

#### Query Optimization Strategies
```typescript
// Optimized service methods
export class OptimizedSharedStorageService {
  // Batch operations for multiple file access
  async batchGetSessionPaths(sessionIds: string[], service: string): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // Use Redis pipeline for batch operations
    const pipeline = this.redis.multi();

    sessionIds.forEach(sessionId => {
      const cacheKey = `session:${sessionId}:${service}`;
      pipeline.get(cacheKey);
    });

    const cachedResults = await pipeline.exec();

    // Process results and fetch missing data
    const missingSessions: string[] = [];

    cachedResults.forEach((result, index) => {
      const sessionId = sessionIds[index];
      if (result[1]) {
        results.set(sessionId, result[1]);
      } else {
        missingSessions.push(sessionId);
      }
    });

    // Batch fetch missing sessions
    if (missingSessions.length > 0) {
      const missingResults = await this.batchFetchSessionPaths(missingSessions, service);

      // Cache results and add to response
      missingResults.forEach((path, sessionId) => {
        results.set(sessionId, path);
        this.cache.set(`session:${sessionId}:${service}`, path, CACHE_TTL);
      });
    }

    return results;
  }

  // Connection pooling for database operations
  private async getConnection(): Promise<RedisConnection> {
    return this.connectionPool.acquire();
  }

  private releaseConnection(connection: RedisConnection): void {
    this.connectionPool.release(connection);
  }
}
```

### Caching Optimizations

#### Multi-Level Caching Strategy
```typescript
interface CacheConfiguration {
  // L1: In-memory cache (fastest)
  l1Cache: {
    maxSize: number; // 100MB
    ttl: number; // 5 minutes
    evictionPolicy: 'LRU';
  };

  // L2: Redis cache (distributed)
  l2Cache: {
    host: string;
    port: number;
    ttl: number; // 30 minutes
    maxMemory: string; // 512MB
  };

  // L3: Disk cache (persistent)
  l3Cache: {
    path: string;
    maxSize: number; // 2GB
    ttl: number; // 24 hours
  };
}

class MultiLevelCache {
  constructor(private config: CacheConfiguration) {
    this.l1Cache = new Map();
    this.l2Cache = new Redis(config.l2Cache);
    this.l3Cache = new DiskCache(config.l3Cache);
  }

  async get(key: string): Promise<any> {
    // Check L1 cache first
    let value = this.l1Cache.get(key);
    if (value) {
      this.metrics.record('l1_hit');
      return value;
    }

    // Check L2 cache
    value = await this.l2Cache.get(key);
    if (value) {
      this.metrics.record('l2_hit');
      // Populate L1 cache
      this.l1Cache.set(key, value);
      return value;
    }

    // Check L3 cache
    value = await this.l3Cache.get(key);
    if (value) {
      this.metrics.record('l3_hit');
      // Populate L1 and L2 caches
      this.l1Cache.set(key, value);
      await this.l2Cache.set(key, value, this.config.l2Cache.ttl);
      return value;
    }

    this.metrics.record('cache_miss');
    return null;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    // Set in all cache levels
    this.l1Cache.set(key, value);
    await this.l2Cache.set(key, value, ttl || this.config.l2Cache.ttl);
    await this.l3Cache.set(key, value, ttl || this.config.l3Cache.ttl);
  }
}
```

#### Cache Warming Strategy
```bash
#!/bin/bash
# cache-warmer.sh

echo "=== Cache Warming Process ==="

# Warm up frequently accessed sessions
echo "Warming up session caches..."
SESSION_COUNT=100

for i in $(seq 1 $SESSION_COUNT); do
  session_id="session-$(printf "%03d" $i)"

  # Pre-load session path
  curl -s "http://localhost:3000/sessions/$session_id/path?service=file-processor" >/dev/null

  # Pre-load file list
  curl -s "http://localhost:3000/sessions/$session_id/files?service=file-processor" >/dev/null

  echo -n "."
done

echo
echo "Cache warming completed for $SESSION_COUNT sessions"

# Warm up metadata caches
echo "Warming up metadata caches..."
curl -s "http://localhost:3000/health/detailed" >/dev/null

echo "Cache warming process completed"
```

### Network Optimizations

#### Connection Pooling Configuration
```typescript
interface ConnectionPoolConfig {
  // Pool size
  minConnections: number;
  maxConnections: number;
  acquireTimeoutMillis: number;
  idleTimeoutMillis: number;

  // Health checks
  healthCheckInterval: number;
  healthCheckTimeout: number;

  // Retry configuration
  retryCount: number;
  retryDelay: number;
}

class OptimizedConnectionPool {
  private pool: Pool<RedisConnection>;

  constructor(private config: ConnectionPoolConfig) {
    this.pool = genericPool.createPool({
      create: this.createConnection.bind(this),
      destroy: this.destroyConnection.bind(this),
      validate: this.validateConnection.bind(this)
    }, {
      min: config.minConnections,
      max: config.maxConnections,
      acquireTimeoutMillis: config.acquireTimeoutMillis,
      idleTimeoutMillis: config.idleTimeoutMillis,
      evictionRunIntervalMillis: config.healthCheckInterval
    });
  }

  private async createConnection(): Promise<RedisConnection> {
    const connection = new RedisConnection(this.redisConfig);

    // Set connection options for performance
    connection.setTimeout(this.config.healthCheckTimeout);
    connection.setKeepAlive(true);
    connection.setTcpNoDelay(true);

    return connection;
  }

  private async validateConnection(connection: RedisConnection): Promise<boolean> {
    try {
      await connection.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getConnection(): Promise<RedisConnection> {
    return this.pool.acquire();
  }

  releaseConnection(connection: RedisConnection): void {
    this.pool.release(connection);
  }
}
```

#### HTTP/2 and Keep-Alive Configuration
```javascript
// Server configuration for HTTP/2
const serverConfig = {
  // HTTP/2 settings
  allowHTTP1: true,
  maxConcurrentStreams: 100,
  maxFrameSize: 16384,
  maxHeaderListSize: 32768,

  // Keep-alive settings
  keepAlive: true,
  keepAliveTimeout: 65000,
  maxKeepAliveRequests: 1000,

  // Compression
  compression: {
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      return /text|json|javascript|css/.test(res.getHeader('Content-Type'));
    }
  }
};

// Apply configuration
const server = http2.createServer(serverConfig, app);
```

## Horizontal and Vertical Scaling Procedures

### Horizontal Scaling

#### Auto-Scaling Configuration
```yaml
# Kubernetes HPA for horizontal scaling
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
  maxReplicas: 20
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
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: 100
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
        max: 4
```

#### Load Balancer Configuration
```yaml
# AWS ALB configuration
resource "aws_lb" "shared-storage-service" {
  name               = "shared-storage-service-lb"
  internal           = true
  load_balancer_type = "application"
  security_groups    = [aws_security_group.lb_sg.id]
  subnets            = aws_subnet.private.*.id

  enable_deletion_protection = true

  tags = {
    Environment = "production"
    Application = "shared-storage-service"
  }
}

resource "aws_lb_target_group" "shared-storage-service" {
  name     = "shared-storage-service-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    path                = "/health"
    matcher             = "200"
  }
}

resource "aws_lb_listener" "shared-storage-service" {
  load_balancer_arn = aws_lb.shared-storage-service.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.shared-storage-service.arn
  }
}
```

### Vertical Scaling

#### Instance Type Selection Guide
```typescript
interface InstanceRecommendation {
  workloadType: 'light' | 'medium' | 'heavy' | 'extreme';
  instanceType: string;
  vCPUs: number;
  memoryGB: number;
  networkMbps: number;
  storageGB: number;
  costPerHour: number;
}

const instanceRecommendations: InstanceRecommendation[] = [
  {
    workloadType: 'light',
    instanceType: 't3.medium',
    vCPUs: 2,
    memoryGB: 4,
    networkMbps: 5000,
    storageGB: 100,
    costPerHour: 0.0416
  },
  {
    workloadType: 'medium',
    instanceType: 'm5.large',
    vCPUs: 2,
    memoryGB: 8,
    networkMbps: 10000,
    storageGB: 200,
    costPerHour: 0.096
  },
  {
    workloadType: 'heavy',
    instanceType: 'm5.xlarge',
    vCPUs: 4,
    memoryGB: 16,
    networkMbps: 12500,
    storageGB: 500,
    costPerHour: 0.192
  },
  {
    workloadType: 'extreme',
    instanceType: 'm5.2xlarge',
    vCPUs: 8,
    memoryGB: 32,
    networkMbps: 12500,
    storageGB: 1000,
    costPerHour: 0.384
  }
];
```

#### Vertical Scaling Script
```bash
#!/bin/bash
# vertical-scale.sh

TARGET_INSTANCE_TYPE="$1"

if [[ -z "$TARGET_INSTANCE_TYPE" ]]; then
  echo "Usage: $0 <instance-type>"
  echo "Example: $0 m5.xlarge"
  exit 1
fi

echo "=== Vertical Scaling to $TARGET_INSTANCE_TYPE ==="

# Get current instance information
CURRENT_INSTANCE=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
CURRENT_TYPE=$(aws ec2 describe-instances --instance-ids $CURRENT_INSTANCE --query 'Reservations[0].Instances[0].InstanceType' --output text)

echo "Current instance: $CURRENT_INSTANCE ($CURRENT_TYPE)"
echo "Target instance type: $TARGET_INSTANCE_TYPE"

# Create AMI of current instance
AMI_NAME="shared-storage-service-$(date +%Y%m%d-%H%M%S)"
echo "Creating AMI: $AMI_NAME"

AMI_ID=$(aws ec2 create-image \
  --instance-id $CURRENT_INSTANCE \
  --name $AMI_NAME \
  --description "SharedStorageService backup before scaling" \
  --no-reboot \
  --query 'ImageId' \
  --output text)

echo "Created AMI: $AMI_ID"

# Wait for AMI to be available
echo "Waiting for AMI to be available..."
aws ec2 wait image-available --image-ids $AMI_ID

# Stop current instance
echo "Stopping current instance..."
aws ec2 stop-instances --instance-ids $CURRENT_INSTANCE
aws ec2 wait instance-stopped --instance-ids $CURRENT_INSTANCE

# Change instance type
echo "Changing instance type..."
aws ec2 modify-instance-attribute \
  --instance-id $CURRENT_INSTANCE \
  --instance-type "{\"Value\": \"$TARGET_INSTANCE_TYPE\"}"

# Start instance
echo "Starting instance with new type..."
aws ec2 start-instances --instance-ids $CURRENT_INSTANCE
aws ec2 wait instance-running --instance-ids $CURRENT_INSTANCE

# Wait for services to be healthy
echo "Waiting for services to be healthy..."
for i in {1..30}; do
  if curl -s http://localhost:3000/health | grep -q "healthy"; then
    echo "Services are healthy"
    break
  fi
  echo "Waiting... ($i/30)"
  sleep 30
done

# Verify new instance type
NEW_TYPE=$(aws ec2 describe-instances --instance-ids $CURRENT_INSTANCE --query 'Reservations[0].Instances[0].InstanceType' --output text)
echo "Instance successfully scaled to: $NEW_TYPE"

# Clean up old AMI (keep for 7 days)
echo "Scheduling AMI cleanup in 7 days..."
echo "aws ec2 deregister-image --image-id $AMI_ID" | at "now + 7 days"
```

## Performance Regression Detection

### Regression Detection System
```bash
#!/bin/bash
# regression-detector.sh

echo "=== Performance Regression Detection ==="

# Configuration
BASELINE_FILE="/opt/shared-storage/baselines/current-baseline.json"
REGRESSION_THRESHOLD=0.1  # 10% degradation threshold
MONITORING_WINDOW=300   # 5 minutes

# Collect current performance metrics
echo "Collecting current performance metrics..."

CURRENT_METRICS=$(cat <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "response_time_p95": $(curl -s http://localhost:3000/metrics | grep 'http_request_duration_seconds.*95' | awk '{print $2}'),
  "requests_per_second": $(curl -s http://localhost:3000/metrics | grep 'rate(http_requests_total' | awk '{print $2}'),
  "error_rate": $(curl -s http://localhost:3000/metrics | grep 'rate(shared_storage_errors_total' | awk '{print $2}'),
  "cpu_usage": $(docker stats --no-stream --format "{{.CPUPerc}}" shared-storage-service | sed 's/%//'),
  "memory_usage": $(docker stats --no-stream --format "{{.MemPerc}}" shared-storage-service | sed 's/%//')
}
EOF
)

# Load baseline metrics
if [[ ! -f "$BASELINE_FILE" ]]; then
  echo "No baseline found. Creating initial baseline..."
  echo "$CURRENT_METRICS" > "$BASELINE_FILE"
  echo "Initial baseline created"
  exit 0
fi

BASELINE_METRICS=$(cat "$BASELINE_FILE")

# Compare metrics
echo "Comparing with baseline..."

BASELINE_P95=$(echo "$BASELINE_METRICS" | jq -r '.response_time_p95')
CURRENT_P95=$(echo "$CURRENT_METRICS" | jq -r '.response_time_p95')

if [[ -n "$BASELINE_P95" && -n "$CURRENT_P95" && "$BASELINE_P95" != "null" ]]; then
  DEGRADATION=$((CURRENT_P95 - BASELINE_P95))
  RELATIVE_DEGRADATION=$(echo "scale=4; $DEGRADATION / $BASELINE_P95" | bc)

  echo "Response time regression: ${RELATIVE_DEGRADATION}"

  if (( $(echo "$RELATIVE_DEGRADATION > $REGRESSION_THRESHOLD" | bc -l) )); then
    echo "🚨 PERFORMANCE REGRESSION DETECTED!"
    echo "Response time increased by $(echo "scale=2; $RELATIVE_DEGRADATION * 100" | bc)%"

    # Send alert
    curl -X POST -H "Content-Type: application/json" \
      -d "{
        \"alert\": \"Performance regression detected\",
        \"severity\": \"high\",
        \"details\": {
          \"metric\": \"response_time_p95\",
          \"baseline\": $BASELINE_P95,
          \"current\": $CURRENT_P95,
          \"degradation\": ${RELATIVE_DEGRADATION}
        }
      }" \
      "$ALERT_WEBHOOK_URL"

    # Update baseline if this is a legitimate change
    read -p "Update baseline with current values? (y/n): " update_baseline
    if [[ "$update_baseline" == "y" ]]; then
      echo "$CURRENT_METRICS" > "$BASELINE_FILE"
      echo "Baseline updated"
    fi
  else
    echo "✅ No significant performance regression detected"
  fi
else
  echo "Unable to compare response time metrics"
fi

# Save current metrics for historical analysis
echo "$CURRENT_METRICS" >> "/opt/shared-storage/logs/performance-history-$(date +%Y%m%d).json"
```

### Automated Performance Testing
```bash
#!/bin/bash
# automated-performance-test.sh

echo "=== Automated Performance Testing ==="

# Configuration
TEST_DURATION=300  # 5 minutes
CONCURRENT_USERS=50
REPORT_DIR="/opt/shared-storage/reports/performance"

mkdir -p "$REPORT_DIR"

# Run performance test
echo "Running performance test..."
hey -n 10000 -c $CONCURRENT_USERS -q 10 -z ${TEST_DURATION}s \
  -m GET \
  -H "X-API-Key: performance-test-key" \
  "http://localhost:3000/sessions/test-session/permissions?service=file-processor" \
  > "$REPORT_DIR/test-results-$(date +%Y%m%d_%H%M%S).txt"

# Analyze results
echo "Analyzing results..."
RESPONSE_TIME=$(grep "response time" "$REPORT_DIR/test-results-"* | tail -1 | awk '{print $4}')
REQUESTS_PER_SECOND=$(grep "requests/sec" "$REPORT_DIR/test-results-"* | tail -1 | awk '{print $1}')

echo "Performance Test Results:"
echo "Response Time: ${RESPONSE_TIME}ms"
echo "Requests/sec: $REQUESTS_PER_SECOND"

# Compare with baseline
BASELINE_RESPONSE_TIME=$(cat /opt/shared-storage/baselines/current-baseline.json | jq -r '.response_time_p95')
BASELINE_RPS=$(cat /opt/shared-storage/baselines/current-baseline.json | jq -r '.requests_per_second')

if [[ -n "$BASELINE_RESPONSE_TIME" ]]; then
  RESPONSE_DEGRADATION=$(echo "scale=4; ($RESPONSE_TIME - $BASELINE_RESPONSE_TIME) / $BASELINE_RESPONSE_TIME" | bc)
  echo "Response time change: $(echo "scale=2; $RESPONSE_DEGRADATION * 100" | bc)%"
fi

# Generate report
cat > "$REPORT_DIR/performance-report-$(date +%Y%m%d_%H%M%S).md" << EOF
# Performance Test Report

## Test Configuration
- Duration: ${TEST_DURATION}s
- Concurrent Users: $CONCURRENT_USERS
- Target: SharedStorageService

## Results
- Response Time: ${RESPONSE_TIME}ms
- Requests/sec: $REQUESTS_PER_SECOND

## Baseline Comparison
- Baseline Response Time: ${BASELINE_RESPONSE_TIME}ms
- Baseline RPS: ${BASELINE_RPS}

## Recommendations
$(if (( $(echo "$RESPONSE_DEGRADATION > 0.1" | bc -l) )); then
  echo "- Response time degradation detected. Consider performance optimization."
else
  echo "- Performance within acceptable limits."
fi)
EOF

echo "Performance test completed. Report generated."
```

## References

- [API Reference](./api-reference.md)
- [Configuration Guide](./configuration-guide.md)
- [Monitoring Procedures](./monitoring-procedures.md)
- [Troubleshooting Guide](./troubleshooting-guide.md)
- [Architecture Documentation](../../../../docs/architecture/9-performance-and-scalability-considerations.md)
