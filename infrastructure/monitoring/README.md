# Shared Storage Service - Monitoring Stack

This directory contains a complete monitoring and observability stack for the Shared Storage Service, including dashboards, alerting, and metrics collection.

## 🏗️ Architecture

The monitoring stack consists of:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Dashboard and visualization platform
- **AlertManager**: Alert management and notification routing
- **Node Exporter**: System-level metrics collection
- **cAdvisor**: Container metrics collection
- **PushGateway**: Push-based metrics collection

## 📊 Dashboards

### 1. Shared Storage Overview (`shared-storage-overview.json`)
**Purpose**: Comprehensive monitoring dashboard for real-time operational visibility
**Key Metrics**:
- Service health status and KPIs
- Request rate and success rate trends
- Response time distribution (heatmap)
- Error analysis and top error types
- Cache performance metrics
- Circuit breaker status
- Resource utilization

### 2. Operational Dashboard (`shared-storage-operational.json`)
**Purpose**: Critical alerts and troubleshooting dashboard for on-call engineers
**Key Features**:
- Live alerts display
- System health status
- Recent error logs
- Top error types analysis
- Troubleshooting guide
- Quick action buttons

### 3. Business Metrics (`shared-storage-business.json`)
**Purpose**: Business KPIs and performance correlation analysis
**Key Metrics**:
- File access patterns over time
- Top accessed files
- Performance vs access correlation
- Business hours vs off-hours analysis
- Cost efficiency metrics
- User satisfaction scores
- Forecasting (next 24h usage)

### 4. Trends & Forecasting (`shared-storage-trends.json`)
**Purpose**: Historical trend analysis and capacity planning
**Key Features**:
- 7-day and 30-day usage trends
- Performance regression analysis
- Weekly usage patterns (heatmap)
- Forecasting models (next 7 days)
- Capacity planning recommendations
- Cost optimization analysis
- Anomaly detection

### 5. Real-Time Monitoring (`shared-storage-realtime.json`)
**Purpose**: Live metrics with 30-second refresh intervals
**Key Features**:
- Real-time operations/sec
- Live response time distribution
- Current cache performance
- Active connections monitoring
- Live logs stream
- Quick actions and status

## 🚨 Alerting System

### Alert Categories

#### Service Availability
- `SharedStorageServiceDown`: Service is unreachable
- `SharedStorageLowAvailability`: Availability below 99.5%

#### Performance
- `SharedStorageHighResponseTime`: P95 > 100ms for 2min
- `SharedStorageCriticalResponseTime`: P95 > 500ms for 1min
- `SharedStoragePerformanceRegression`: Response time increase >50ms

#### Errors
- `SharedStorageHighErrorRate`: Error rate >1/min for 2min
- `SharedStorageCriticalErrorRate`: Error rate >5/min for 1min

#### System Resources
- `SharedStorageLowCacheHitRate`: Cache hit rate <70% for 5min
- `SharedStorageHighConnectionPoolUtilization`: Pool >90% for 2min
- `SharedStorageLowDiskSpace`: Disk usage >85% for 5min
- `SharedStorageCriticalDiskSpace`: Disk usage >95% for 2min

#### Circuit Breaker
- `SharedStorageCircuitBreakerOpen`: Circuit breaker activated
- `SharedStorageHighQueueDepth`: Queue length >50 for 2min

### Alert Routing

Alerts are routed based on severity and impact:

- **Critical**: Slack (#shared-storage-critical) + PagerDuty + Email
- **Warning**: Slack (#shared-storage-alerts) + Email
- **Business Impact**: Slack (#business-impact) + Email

## 🛠️ Quick Start

### Prerequisites
- Docker and Docker Compose
- At least 4GB RAM available
- Ports 3000, 9090, 9093, 9100, 8080, 9091 available

### Setup

1. **Clone and navigate to the monitoring directory**:
```bash
cd infrastructure/monitoring
```

2. **Configure environment variables**:
```bash
cp .env.example .env
# Edit .env with your actual configuration
```

3. **Start the monitoring stack**:
```bash
./setup-monitoring.sh
```

Or use individual commands:
```bash
# Start services
./setup-monitoring.sh start

# Check status
./setup-monitoring.sh status

# View logs
./setup-monitoring.sh logs

# Stop services
./setup-monitoring.sh stop
```

### Access URLs

After starting the stack:
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **AlertManager**: http://localhost:9093

## 📈 Key Metrics

### Application Metrics
```
shared_storage_operations_total{operation="read|write|delete", status="success|error"}
shared_storage_operation_duration_bucket{le="0.1|0.5|1.0|2.0|5.0"}
shared_storage_errors_total{category="permission_denied|file_not_found|..."}
shared_storage_cache_hits_total / shared_storage_cache_misses_total
shared_storage_circuit_breaker_state{operation="...", state="0|1|2"}
```

### System Metrics
```
shared_storage_active_connections
shared_storage_operation_queue_length
shared_storage_cpu_usage_percent
shared_storage_memory_usage_percent
shared_storage_disk_usage_percent
```

### Business Metrics
```
shared_storage_file_access_total{file_type="pdf|png|jpg|..."}
shared_storage_user_satisfaction_score
shared_storage_business_impact_score
```

## 🔧 Configuration

### Grafana
- **Admin Password**: Set via `GRAFANA_ADMIN_PASSWORD` environment variable
- **Provisioning**: Automatic dashboard and datasource provisioning
- **Themes**: Light/dark mode support
- **Plugins**: Pie chart and world map plugins included

### Prometheus
- **Retention**: 30 days by default (configurable)
- **Scrape Interval**: 15s for services, 30s for dynamic discovery
- **Alert Rules**: Comprehensive rule set included
- **Service Discovery**: File-based and static configuration

### AlertManager
- **Routing**: Severity and service-based routing
- **Integrations**: Slack, PagerDuty, Email
- **Templates**: Customizable alert message templates
- **Grouping**: Alert grouping by service and severity

## 📚 API Endpoints

### Shared Storage Service Metrics
```
GET /metrics          # Prometheus metrics endpoint
GET /health          # Health check endpoint
GET /health/detailed # Detailed health information
POST /cache/clear    # Clear cache (admin)
POST /circuit-breaker/reset  # Reset circuit breakers (admin)
```

### Monitoring Stack APIs
```
GET /api/v1/query    # Prometheus query API
GET /api/dashboards  # Grafana dashboards API
POST /api/alerts     # AlertManager alerts API
```

## 🔍 Troubleshooting

### Common Issues

1. **Grafana dashboards not loading**
   - Check datasource configuration
   - Verify Prometheus connectivity
   - Review Grafana logs: `docker logs shared-storage-grafana`

2. **Missing metrics**
   - Ensure Shared Storage Service is running
   - Check Prometheus targets: http://localhost:9090/targets
   - Verify metrics endpoint accessibility

3. **Alerts not firing**
   - Review alert rules in `prometheus/alert_rules.yml`
   - Check AlertManager configuration
   - Verify threshold values

4. **High memory usage**
   - Adjust Prometheus retention period
   - Increase Docker memory limits
   - Optimize Grafana dashboard queries

### Debug Commands

```bash
# Check service health
curl http://localhost:3001/health

# Query Prometheus
curl "http://localhost:9090/api/v1/query?query=up"

# Check Grafana health
curl http://localhost:3000/api/health

# View alert rules
curl http://localhost:9090/api/v1/rules
```

## 📊 Custom Dashboards

### Creating New Dashboards

1. Use Grafana UI to create dashboard
2. Export JSON from Grafana
3. Save to `grafana/dashboards/` directory
4. Update `grafana/provisioning/dashboards/shared-storage.yml` if needed

### Dashboard Variables

Common variables used across dashboards:
- `$service`: Service name filter
- `$operation`: Operation type filter
- `$time_range`: Time range selector
- `$percentile`: Percentile selector (50, 95, 99)

## 🚀 Production Deployment

### Security Considerations
1. **Change default passwords**
2. **Enable SSL/TLS**
3. **Configure authentication**
4. **Set up proper network segmentation**
5. **Implement backup strategies**

### Scaling Considerations
1. **Prometheus**: Use federation for multi-region
2. **Grafana**: Configure high availability
3. **AlertManager**: Set up clustering
4. **Storage**: Configure persistent volumes

### Backup Strategy
1. **Grafana**: Backup dashboards and datasources
2. **Prometheus**: Configure WAL and data backup
3. **AlertManager**: Backup configuration and silence state

## 📞 Support

For issues and questions:
1. Check the troubleshooting section above
2. Review service logs: `docker-compose logs`
3. Check monitoring stack status: `./setup-monitoring.sh status`
4. Consult the runbooks in `/docs/runbooks/`

## 🤝 Contributing

To add new dashboards or alerts:
1. Create dashboard JSON in `grafana/dashboards/`
2. Add alert rules to `prometheus/alert_rules.yml`
3. Update this README with new features
4. Test in development environment
5. Submit pull request with documentation

---

*This monitoring stack provides enterprise-grade observability for the Shared Storage Service, enabling proactive monitoring, rapid troubleshooting, and data-driven optimization decisions.*
