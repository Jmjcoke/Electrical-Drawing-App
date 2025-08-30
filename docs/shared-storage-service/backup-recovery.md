# SharedStorageService Backup & Recovery Procedures

## Overview

This document provides comprehensive backup and recovery procedures for the SharedStorageService, ensuring data integrity, minimal downtime, and reliable disaster recovery capabilities.

## Backup Strategy

### Backup Types

#### 1. Full System Backup
**Scope**: Complete system state including:
- All session data and files
- Configuration files
- Metadata and indexes
- Redis data and configuration

**Frequency**: Weekly
**Retention**: 30 days
**Storage**: Off-site encrypted storage

#### 2. Incremental Backup
**Scope**: Changes since last full backup
- New and modified session files
- Updated metadata
- Configuration changes

**Frequency**: Daily
**Retention**: 7 days
**Storage**: Local and off-site

#### 3. Configuration Backup
**Scope**: All configuration files and settings
- `services.json`
- Environment variables
- Docker configurations
- Kubernetes manifests

**Frequency**: After each configuration change
**Retention**: 90 days
**Storage**: Git repository + local backup

#### 4. Metadata Backup
**Scope**: File metadata and indexes
- File checksums and integrity data
- Access patterns and statistics
- Session metadata

**Frequency**: Hourly
**Retention**: 24 hours
**Storage**: Redis + local files

### Automated Backup Implementation

#### Full System Backup Script
```bash
#!/bin/bash
# full-backup.sh

BACKUP_ROOT="/opt/shared-storage/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="shared-storage-full-$TIMESTAMP"
BACKUP_DIR="$BACKUP_ROOT/$BACKUP_NAME"

echo "=== SharedStorageService Full Backup ==="
echo "Timestamp: $TIMESTAMP"
echo "Backup Name: $BACKUP_NAME"

# Create backup directory
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/sessions"
mkdir -p "$BACKUP_DIR/config"
mkdir -p "$BACKUP_DIR/redis"
mkdir -p "$BACKUP_DIR/logs"

# Stop service for consistent backup (optional, for critical systems)
echo "Stopping SharedStorageService for consistent backup..."
docker-compose stop shared-storage-service

# Backup session data
echo "Backing up session data..."
cp -r /opt/shared-storage/sessions/* "$BACKUP_DIR/sessions/" 2>/dev/null || true

# Backup configuration
echo "Backing up configuration..."
cp /opt/shared-storage/config/* "$BACKUP_DIR/config/" 2>/dev/null || true
cp .env* "$BACKUP_DIR/config/" 2>/dev/null || true
cp docker-compose*.yml "$BACKUP_DIR/config/" 2>/dev/null || true

# Backup Redis data
echo "Backing up Redis data..."
docker-compose exec -T redis redis-cli save
cp /opt/shared-storage/redis/dump.rdb "$BACKUP_DIR/redis/" 2>/dev/null || \
docker-compose exec -T redis redis-cli --rdb "$BACKUP_DIR/redis/dump.rdb"

# Backup logs
echo "Backing up logs..."
cp -r /opt/shared-storage/logs/* "$BACKUP_DIR/logs/" 2>/dev/null || true

# Restart service
echo "Restarting SharedStorageService..."
docker-compose start shared-storage-service

# Create backup manifest
cat > "$BACKUP_DIR/manifest.txt" << EOF
SharedStorageService Full Backup
Timestamp: $TIMESTAMP
Backup Name: $BACKUP_NAME
Version: $(docker-compose exec -T shared-storage-service cat /app/package.json | grep '"version"' | cut -d'"' -f4)

Contents:
- Session Data: $(du -sh "$BACKUP_DIR/sessions" | cut -f1)
- Configuration: $(du -sh "$BACKUP_DIR/config" | cut -f1)
- Redis Data: $(du -sh "$BACKUP_DIR/redis" | cut -f1)
- Logs: $(du -sh "$BACKUP_DIR/logs" | cut -f1)

System Information:
- Hostname: $(hostname)
- OS: $(uname -s) $(uname -r)
- Docker Version: $(docker --version)
- Docker Compose Version: $(docker-compose --version)

Integrity Check:
EOF

# Calculate checksums for integrity verification
find "$BACKUP_DIR" -type f -exec sha256sum {} \; >> "$BACKUP_DIR/manifest.txt"

# Compress backup
echo "Compressing backup..."
cd "$BACKUP_ROOT"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"

# Encrypt backup (optional)
if [[ -n "$BACKUP_ENCRYPTION_KEY" ]]; then
  echo "Encrypting backup..."
  openssl enc -aes-256-cbc -salt -in "${BACKUP_NAME}.tar.gz" \
    -out "${BACKUP_NAME}.tar.gz.enc" -k "$BACKUP_ENCRYPTION_KEY"
  rm "${BACKUP_NAME}.tar.gz"
  BACKUP_FILE="${BACKUP_NAME}.tar.gz.enc"
else
  BACKUP_FILE="${BACKUP_NAME}.tar.gz"
fi

# Upload to remote storage
if [[ -n "$REMOTE_BACKUP_URL" ]]; then
  echo "Uploading to remote storage..."
  curl -X PUT -T "$BACKUP_FILE" "$REMOTE_BACKUP_URL/$BACKUP_FILE"
fi

# Cleanup local backup directory
rm -rf "$BACKUP_DIR"

# Update backup index
echo "$TIMESTAMP|$BACKUP_NAME|$BACKUP_FILE|$(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE")" >> "$BACKUP_ROOT/backup-index.txt"

echo "Full backup completed: $BACKUP_ROOT/$BACKUP_FILE"
echo "Backup size: $(du -sh "$BACKUP_ROOT/$BACKUP_FILE" | cut -f1)"
```

#### Incremental Backup Script
```bash
#!/bin/bash
# incremental-backup.sh

BACKUP_ROOT="/opt/shared-storage/backups"
LAST_BACKUP=$(ls -t "$BACKUP_ROOT"/*.tar.gz* | head -1 | xargs basename)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
INCREMENTAL_NAME="shared-storage-inc-$TIMESTAMP"
INCREMENTAL_DIR="$BACKUP_ROOT/$INCREMENTAL_NAME"

echo "=== SharedStorageService Incremental Backup ==="
echo "Timestamp: $TIMESTAMP"
echo "Last Full Backup: $LAST_BACKUP"

# Create incremental backup directory
mkdir -p "$INCREMENTAL_DIR/changes"

# Find changed files since last backup
LAST_BACKUP_TIME=$(stat -f%c "$BACKUP_ROOT/$LAST_BACKUP" 2>/dev/null || stat -c%Y "$BACKUP_ROOT/$LAST_BACKUP")
find /opt/shared-storage/sessions -type f -newer "$BACKUP_ROOT/$LAST_BACKUP" \
  -exec cp --parents {} "$INCREMENTAL_DIR/changes/" \;

# Backup configuration changes
find /opt/shared-storage/config -type f -newer "$BACKUP_ROOT/$LAST_BACKUP" \
  -exec cp --parents {} "$INCREMENTAL_DIR/changes/" \; 2>/dev/null || true

# Create incremental manifest
cat > "$INCREMENTAL_DIR/manifest.txt" << EOF
SharedStorageService Incremental Backup
Timestamp: $TIMESTAMP
Backup Name: $INCREMENTAL_NAME
Reference Backup: $LAST_BACKUP

Changed Files: $(find "$INCREMENTAL_DIR/changes" -type f | wc -l)
Total Size: $(du -sh "$INCREMENTAL_DIR/changes" | cut -f1)
EOF

# Compress incremental backup
cd "$BACKUP_ROOT"
tar -czf "${INCREMENTAL_NAME}.tar.gz" "$INCREMENTAL_NAME"

# Upload to remote storage
if [[ -n "$REMOTE_BACKUP_URL" ]]; then
  curl -X PUT -T "${INCREMENTAL_NAME}.tar.gz" "$REMOTE_BACKUP_URL/${INCREMENTAL_NAME}.tar.gz"
fi

# Cleanup
rm -rf "$INCREMENTAL_DIR"

# Update backup index
echo "$TIMESTAMP|$INCREMENTAL_NAME|${INCREMENTAL_NAME}.tar.gz|$(stat -f%z "${INCREMENTAL_NAME}.tar.gz" 2>/dev/null || stat -c%s "${INCREMENTAL_NAME}.tar.gz")|incremental" >> "$BACKUP_ROOT/backup-index.txt"

echo "Incremental backup completed: $BACKUP_ROOT/${INCREMENTAL_NAME}.tar.gz"
```

#### Automated Backup Scheduler
```bash
#!/bin/bash
# backup-scheduler.sh

# Configuration
BACKUP_ROOT="/opt/shared-storage/backups"
LOG_FILE="/opt/shared-storage/logs/backup-scheduler.log"

# Logging function
log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') - $*" >> "$LOG_FILE"
}

# Weekly full backup (Sundays at 2 AM)
if [[ $(date +%u) -eq 7 && $(date +%H) -eq 02 && $(date +%M) -eq 00 ]]; then
  log "Starting weekly full backup"
  if ./full-backup.sh >> "$LOG_FILE" 2>&1; then
    log "Weekly full backup completed successfully"
  else
    log "ERROR: Weekly full backup failed"
    # Send alert
    curl -X POST -H "Content-Type: application/json" \
      -d '{"alert": "Weekly full backup failed", "severity": "high"}' \
      "$ALERT_WEBHOOK_URL" 2>/dev/null || true
  fi
fi

# Daily incremental backup (Monday-Saturday at 2 AM)
if [[ $(date +%u) -lt 7 && $(date +%H) -eq 02 && $(date +%M) -eq 00 ]]; then
  log "Starting daily incremental backup"
  if ./incremental-backup.sh >> "$LOG_FILE" 2>&1; then
    log "Daily incremental backup completed successfully"
  else
    log "ERROR: Daily incremental backup failed"
    # Send alert
    curl -X POST -H "Content-Type: application/json" \
      -d '{"alert": "Daily incremental backup failed", "severity": "medium"}' \
      "$ALERT_WEBHOOK_URL" 2>/dev/null || true
  fi
fi

# Hourly metadata backup
if [[ $(date +%M) -eq 00 ]]; then
  log "Starting hourly metadata backup"
  # Export Redis data
  docker-compose exec -T redis redis-cli --rdb /tmp/redis-metadata.rdb
  cp /tmp/redis-metadata.rdb "$BACKUP_ROOT/hourly/redis-metadata-$(date +%Y%m%d_%H%M%S).rdb"

  # Clean old hourly backups (keep last 24)
  ls -t "$BACKUP_ROOT/hourly/redis-metadata-"*.rdb | tail -n +25 | xargs rm -f 2>/dev/null || true

  log "Hourly metadata backup completed"
fi

# Configuration backup on changes
CONFIG_FILES="/opt/shared-storage/config/* .env* docker-compose*.yml"
for config_file in $CONFIG_FILES; do
  if [[ -f "$config_file" ]]; then
    last_backup=$(stat -f%c "$config_file" 2>/dev/null || stat -c%Y "$config_file")
    last_config_backup=$(stat -f%c "$BACKUP_ROOT/config/last-config-backup" 2>/dev/null || echo "0")

    if [[ $last_backup -gt $last_config_backup ]]; then
      log "Configuration change detected in $config_file"
      cp -r /opt/shared-storage/config "$BACKUP_ROOT/config/config-backup-$(date +%Y%m%d_%H%M%S)"
      touch "$BACKUP_ROOT/config/last-config-backup"
      log "Configuration backup completed"
    fi
  fi
done
```

## Point-in-Time Recovery Procedures

### Recovery Planning

#### Recovery Time Objective (RTO)
- **Critical Data**: < 15 minutes
- **Operational Data**: < 1 hour
- **Historical Data**: < 4 hours

#### Recovery Point Objective (RPO)
- **Critical Data**: < 5 minutes data loss
- **Operational Data**: < 1 hour data loss
- **Historical Data**: < 24 hours data loss

### Full System Recovery

#### Step 1: Assess Damage and Choose Recovery Point
```bash
#!/bin/bash
# assess-damage.sh

echo "=== Damage Assessment ==="
echo "Current system status:"

# Check service health
curl -s http://localhost:3000/health | jq .

# Check data integrity
find /opt/shared-storage/sessions -type f -exec sha256sum {} \; > /tmp/current-checksums.txt

# Compare with known good checksums
if [[ -f /opt/shared-storage/checksums/known-good.txt ]]; then
  echo "Comparing with known good checksums..."
  diff /tmp/current-checksums.txt /opt/shared-storage/checksums/known-good.txt | head -20
else
  echo "No known good checksums available for comparison"
fi

# List available backups
echo
echo "Available backups:"
ls -la /opt/shared-storage/backups/*.tar.gz* | tail -10

echo
echo "Choose recovery point:"
echo "1. Latest full backup"
echo "2. Latest incremental backup"
echo "3. Specific timestamp"
read -p "Enter choice (1-3): " choice

case $choice in
  1)
    RECOVERY_BACKUP=$(ls -t /opt/shared-storage/backups/shared-storage-full-*.tar.gz* | head -1)
    ;;
  2)
    RECOVERY_BACKUP=$(ls -t /opt/shared-storage/backups/shared-storage-inc-*.tar.gz* | head -1)
    ;;
  3)
    echo "Available timestamps:"
    ls /opt/shared-storage/backups/ | grep -E "(full|inc)-" | sed 's/.*-//' | sed 's/\.tar\.gz.*//' | sort -r
    read -p "Enter timestamp: " timestamp
    RECOVERY_BACKUP=$(ls /opt/shared-storage/backups/*$timestamp* | head -1)
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

echo "Selected recovery backup: $RECOVERY_BACKUP"
```

#### Step 2: Prepare Recovery Environment
```bash
#!/bin/bash
# prepare-recovery.sh

RECOVERY_BACKUP="$1"

if [[ -z "$RECOVERY_BACKUP" ]]; then
  echo "Usage: $0 <backup-file>"
  exit 1
fi

echo "=== Preparing Recovery Environment ==="

# Stop the service
echo "Stopping SharedStorageService..."
docker-compose stop shared-storage-service

# Create recovery directory
RECOVERY_DIR="/tmp/shared-storage-recovery"
mkdir -p "$RECOVERY_DIR"

# Extract backup
echo "Extracting backup..."
if [[ "$RECOVERY_BACKUP" == *.enc ]]; then
  # Decrypt if encrypted
  read -p "Enter decryption key: " -s DECRYPT_KEY
  echo
  openssl enc -d -aes-256-cbc -in "$RECOVERY_BACKUP" \
    -out "${RECOVERY_BACKUP%.enc}" -k "$DECRYPT_KEY"
  RECOVERY_BACKUP="${RECOVERY_BACKUP%.enc}"
fi

tar -xzf "$RECOVERY_BACKUP" -C "$RECOVERY_DIR"

# Verify backup integrity
echo "Verifying backup integrity..."
cd "$RECOVERY_DIR"
sha256sum -c manifest.txt 2>/dev/null | grep -v OK || echo "Some files failed integrity check"

echo "Recovery environment prepared at: $RECOVERY_DIR"
```

#### Step 3: Execute Recovery
```bash
#!/bin/bash
# execute-recovery.sh

RECOVERY_DIR="$1"

if [[ -z "$RECOVERY_DIR" ]]; then
  echo "Usage: $0 <recovery-directory>"
  exit 1
fi

echo "=== Executing Recovery ==="

# Backup current state (if recoverable)
CURRENT_BACKUP="/opt/shared-storage/pre-recovery-backup-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$CURRENT_BACKUP"
cp -r /opt/shared-storage/sessions "$CURRENT_BACKUP/" 2>/dev/null || true
cp -r /opt/shared-storage/config "$CURRENT_BACKUP/" 2>/dev/null || true

# Clear current data
echo "Clearing current data..."
rm -rf /opt/shared-storage/sessions/*
rm -rf /opt/shared-storage/temp/*

# Restore session data
echo "Restoring session data..."
cp -r "$RECOVERY_DIR/sessions/"* /opt/shared-storage/sessions/ 2>/dev/null || true

# Restore configuration
echo "Restoring configuration..."
cp -r "$RECOVERY_DIR/config/"* /opt/shared-storage/config/ 2>/dev/null || true

# Restore Redis data
echo "Restoring Redis data..."
if [[ -f "$RECOVERY_DIR/redis/dump.rdb" ]]; then
  docker-compose stop redis
  cp "$RECOVERY_DIR/redis/dump.rdb" /opt/shared-storage/redis/dump.rdb
  docker-compose start redis
fi

# Update file permissions
echo "Updating file permissions..."
chown -R sharedstorage:sharedstorage /opt/shared-storage/sessions
chown -R sharedstorage:sharedstorage /opt/shared-storage/config
chmod -R 755 /opt/shared-storage/sessions
chmod -R 644 /opt/shared-storage/config/*

echo "Recovery execution completed"
```

#### Step 4: Validate Recovery
```bash
#!/bin/bash
# validate-recovery.sh

echo "=== Validating Recovery ==="

# Start service
echo "Starting SharedStorageService..."
docker-compose start shared-storage-service

# Wait for service to be ready
echo "Waiting for service readiness..."
for i in {1..30}; do
  if curl -s http://localhost:3000/health | jq -r '.status' | grep -q "healthy"; then
    echo "Service is healthy"
    break
  fi
  echo "Waiting... ($i/30)"
  sleep 10
done

# Test basic functionality
echo "Testing basic functionality..."
curl -s "http://localhost:3000/sessions/test-session/permissions?service=file-processor" | jq .

# Verify data integrity
echo "Verifying data integrity..."
find /opt/shared-storage/sessions -type f -exec sha256sum {} \; > /tmp/recovery-checksums.txt

# Compare with backup checksums
if [[ -f /tmp/backup-manifest.txt ]]; then
  echo "Comparing checksums..."
  # Extract checksums from manifest and compare
  grep "sha256" /tmp/backup-manifest.txt | while read -r expected filepath; do
    actual=$(sha256sum "$filepath" | cut -d' ' -f1)
    if [[ "$expected" != "$actual" ]]; then
      echo "CHECKSUM MISMATCH: $filepath"
    fi
  done
fi

# Test service endpoints
echo "Testing service endpoints..."
ENDPOINTS=(
  "/health"
  "/health/detailed"
  "/health/ready"
  "/health/live"
  "/metrics"
)

for endpoint in "${ENDPOINTS[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$endpoint")
  if [[ "$status" != "200" ]]; then
    echo "FAILED: $endpoint returned status $status"
  else
    echo "OK: $endpoint"
  fi
done

echo "Recovery validation completed"
```

### Incremental Recovery

#### Selective File Recovery
```bash
#!/bin/bash
# selective-recovery.sh

INCREMENTAL_BACKUP="$1"
TARGET_FILES="$2"

if [[ -z "$INCREMENTAL_BACKUP" || -z "$TARGET_FILES" ]]; then
  echo "Usage: $0 <incremental-backup> <target-files>"
  echo "Example: $0 shared-storage-inc-20240127.tar.gz 'session-123/*.pdf'"
  exit 1
fi

echo "=== Selective File Recovery ==="

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Extract incremental backup
tar -xzf "/opt/shared-storage/backups/$INCREMENTAL_BACKUP"

# Find and restore specific files
echo "Restoring files matching: $TARGET_FILES"
find . -path "./$TARGET_FILES" -exec cp --parents {} /opt/shared-storage/sessions/ \;

# Update permissions
chown -R sharedstorage:sharedstorage /opt/shared-storage/sessions
chmod -R 755 /opt/shared-storage/sessions

# Cleanup
cd /
rm -rf "$TEMP_DIR"

echo "Selective recovery completed"
```

### Disaster Recovery

#### Multi-Site Recovery Plan
```bash
#!/bin/bash
# disaster-recovery.sh

PRIMARY_SITE="us-west-2"
SECONDARY_SITE="us-east-1"
RECOVERY_SITE="$SECONDARY_SITE"

echo "=== Disaster Recovery Plan Execution ==="

# Phase 1: Assessment
echo "Phase 1: Damage Assessment"
curl -s "http://shared-storage.$PRIMARY_SITE.company.com/health" || echo "Primary site unreachable"

# Phase 2: Failover
echo "Phase 2: Initiating Failover"
kubectl config use-context "$RECOVERY_SITE"

# Scale up recovery site
kubectl scale deployment shared-storage-service --replicas=3 -n shared-storage

# Update DNS/load balancer
aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch '{
    "Changes": [{
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "shared-storage.company.com",
        "Type": "CNAME",
        "TTL": 60,
        "ResourceRecords": [{"Value": "shared-storage.'"$RECOVERY_SITE"'.company.com"}]
      }
    }]
  }'

# Phase 3: Data Synchronization
echo "Phase 3: Data Synchronization"
LATEST_BACKUP=$(aws s3 ls s3://shared-storage-backups/ | sort | tail -1 | awk '{print $4}')
aws s3 cp "s3://shared-storage-backups/$LATEST_BACKUP" /tmp/
./execute-recovery.sh /tmp/shared-storage-recovery

# Phase 4: Validation
echo "Phase 4: Recovery Validation"
./validate-recovery.sh

# Phase 5: Service Restoration
echo "Phase 5: Service Restoration"
kubectl rollout status deployment/shared-storage-service -n shared-storage

echo "Disaster recovery completed"
```

## Data Integrity Verification

### Automated Integrity Checks
```bash
#!/bin/bash
# integrity-check.sh

echo "=== Data Integrity Verification ==="

# Configuration integrity
echo "Checking configuration integrity..."
for config_file in /opt/shared-storage/config/*; do
  if [[ -f "$config_file" ]]; then
    if ! jq . "$config_file" >/dev/null 2>&1; then
      echo "ERROR: Invalid JSON in $config_file"
      exit 1
    fi
  fi
done

# File system integrity
echo "Checking file system integrity..."
find /opt/shared-storage/sessions -type f | while read -r file; do
  # Check file readability
  if ! head -c 1 "$file" >/dev/null 2>&1; then
    echo "ERROR: Unreadable file: $file"
  fi

  # Check file size is reasonable
  size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file")
  if [[ $size -gt 1073741824 ]]; then  # 1GB
    echo "WARNING: Large file detected: $file (${size} bytes)"
  fi
done

# Metadata integrity
echo "Checking metadata integrity..."
if ! docker-compose exec -T redis redis-cli ping >/dev/null 2>&1; then
  echo "ERROR: Redis connection failed"
  exit 1
fi

# Session integrity
echo "Checking session integrity..."
for session_dir in /opt/shared-storage/sessions/*/; do
  session_id=$(basename "$session_dir")

  # Validate session ID format
  if ! [[ $session_id =~ ^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$ ]]; then
    echo "ERROR: Invalid session ID format: $session_id"
  fi

  # Check for required metadata
  if [[ ! -f "$session_dir/.shared-access.json" ]]; then
    echo "WARNING: Missing access manifest for session: $session_id"
  fi
done

echo "Integrity check completed"
```

### Checksum Management
```bash
#!/bin/bash
# checksum-manager.sh

CHECKSUM_DIR="/opt/shared-storage/checksums"

# Generate checksums for all files
echo "Generating file checksums..."
mkdir -p "$CHECKSUM_DIR"
find /opt/shared-storage/sessions -type f -exec sha256sum {} \; > "$CHECKSUM_DIR/current.txt"

# Compare with previous checksums
if [[ -f "$CHECKSUM_DIR/previous.txt" ]]; then
  echo "Comparing checksums..."
  diff "$CHECKSUM_DIR/previous.txt" "$CHECKSUM_DIR/current.txt" || echo "Checksum differences found"
fi

# Rotate checksum files
cp "$CHECKSUM_DIR/current.txt" "$CHECKSUM_DIR/previous.txt"

# Archive old checksums
find "$CHECKSUM_DIR" -name "*.txt" -mtime +30 -exec gzip {} \;

echo "Checksum management completed"
```

## Backup Testing and Validation

### Backup Validation Tests
```bash
#!/bin/bash
# backup-validation.sh

BACKUP_FILE="$1"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: $0 <backup-file>"
  exit 1
fi

echo "=== Backup Validation Test ==="

# Create test environment
TEST_DIR="/tmp/backup-test-$(date +%s)"
mkdir -p "$TEST_DIR"

# Extract backup
echo "Extracting backup for validation..."
tar -tzf "$BACKUP_FILE" > "$TEST_DIR/backup-contents.txt"

# Verify backup structure
echo "Verifying backup structure..."
REQUIRED_DIRS=("sessions" "config" "redis" "logs")
for dir in "${REQUIRED_DIRS[@]}"; do
  if ! grep -q "^$dir/" "$TEST_DIR/backup-contents.txt"; then
    echo "ERROR: Missing required directory: $dir"
  fi
done

# Test configuration validity
echo "Testing configuration validity..."
tar -xzf "$BACKUP_FILE" -C "$TEST_DIR" config/ 2>/dev/null || true
for config_file in "$TEST_DIR"/config/*; do
  if [[ -f "$config_file" && "$config_file" == *.json ]]; then
    if ! jq . "$config_file" >/dev/null 2>&1; then
      echo "ERROR: Invalid JSON in backup: $config_file"
    fi
  fi
done

# Test data integrity
echo "Testing data integrity..."
tar -xzf "$BACKUP_FILE" -C "$TEST_DIR" manifest.txt 2>/dev/null || true
if [[ -f "$TEST_DIR/manifest.txt" ]]; then
  echo "Verifying file checksums..."
  # Extract checksums and verify against extracted files
  grep "sha256" "$TEST_DIR/manifest.txt" | while read -r expected filepath; do
    # Extract the file
    tar -xzf "$BACKUP_FILE" -C "$TEST_DIR" "$filepath" 2>/dev/null || true
    if [[ -f "$TEST_DIR/$filepath" ]]; then
      actual=$(sha256sum "$TEST_DIR/$filepath" | cut -d' ' -f1)
      if [[ "$expected" != "$actual" ]]; then
        echo "CHECKSUM MISMATCH: $filepath"
      fi
    fi
  done
fi

# Cleanup
rm -rf "$TEST_DIR"

echo "Backup validation completed"
```

### Recovery Testing
```bash
#!/bin/bash
# recovery-test.sh

echo "=== Recovery Testing ==="

# Create test data
TEST_SESSION="test-recovery-$(date +%s)"
mkdir -p "/opt/shared-storage/sessions/$TEST_SESSION"
echo "Test file content" > "/opt/shared-storage/sessions/$TEST_SESSION/test.txt"

# Create backup
echo "Creating test backup..."
BACKUP_FILE="/tmp/test-backup-$(date +%s).tar.gz"
tar -czf "$BACKUP_FILE" -C /opt/shared-storage sessions/"$TEST_SESSION"

# Remove test data
rm -rf "/opt/shared-storage/sessions/$TEST_SESSION"

# Test recovery
echo "Testing recovery..."
RECOVERY_DIR="/tmp/recovery-test-$(date +%s)"
mkdir -p "$RECOVERY_DIR"
tar -xzf "$BACKUP_FILE" -C "$RECOVERY_DIR"

# Verify recovery
if [[ -f "$RECOVERY_DIR/sessions/$TEST_SESSION/test.txt" ]]; then
  content=$(cat "$RECOVERY_DIR/sessions/$TEST_SESSION/test.txt")
  if [[ "$content" == "Test file content" ]]; then
    echo "SUCCESS: Recovery test passed"
  else
    echo "ERROR: Recovered content mismatch"
  fi
else
  echo "ERROR: Test file not recovered"
fi

# Cleanup
rm -rf "$RECOVERY_DIR" "$BACKUP_FILE"

echo "Recovery test completed"
```

### Scheduled Backup Testing
```bash
#!/bin/bash
# backup-test-scheduler.sh

# Configuration
TEST_INTERVAL="7 days"
LAST_TEST_FILE="/opt/shared-storage/backups/.last-recovery-test"

# Check if test is due
if [[ -f "$LAST_TEST_FILE" ]]; then
  last_test=$(cat "$LAST_TEST_FILE")
  days_since_test=$(( ($(date +%s) - $(date -d "$last_test" +%s)) / 86400 ))

  if [[ $days_since_test -lt 7 ]]; then
    echo "Recovery test not due yet ($days_since_test days since last test)"
    exit 0
  fi
fi

echo "=== Scheduled Recovery Test ==="

# Find latest backup
LATEST_BACKUP=$(ls -t /opt/shared-storage/backups/shared-storage-*.tar.gz* | head -1)

if [[ -z "$LATEST_BACKUP" ]]; then
  echo "ERROR: No backup found for testing"
  exit 1
fi

echo "Testing backup: $LATEST_BACKUP"

# Run backup validation
if ./backup-validation.sh "$LATEST_BACKUP"; then
  echo "Backup validation passed"
else
  echo "ERROR: Backup validation failed"
  # Send alert
  curl -X POST -H "Content-Type: application/json" \
    -d '{"alert": "Backup validation failed", "severity": "high", "backup": "'"$LATEST_BACKUP"'"}' \
    "$ALERT_WEBHOOK_URL"
  exit 1
fi

# Update last test timestamp
date > "$LAST_TEST_FILE"

echo "Scheduled recovery test completed successfully"
```

## References

- [API Reference](./api-reference.md)
- [Deployment Runbook](./deployment-runbook.md)
- [Troubleshooting Guide](./troubleshooting-guide.md)
- [Configuration Guide](./configuration-guide.md)
- [Architecture Documentation](../../../../docs/architecture/6-deployment-architecture-and-infrastructure.md)
