#!/bin/bash

# Shared Storage Service - Monitoring Stack Setup Script
# This script sets up a complete monitoring stack with Prometheus, Grafana, and AlertManager

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MONITORING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${MONITORING_DIR}/../.." && pwd)"
DOCKER_COMPOSE_FILE="${MONITORING_DIR}/docker-compose.monitoring.yml"

# Default values
GRAFANA_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-"admin"}
PROMETHEUS_RETENTION=${PROMETHEUS_RETENTION:-"30d"}

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    log_success "Dependencies check passed"
}

create_directories() {
    log_info "Creating necessary directories..."

    mkdir -p "${MONITORING_DIR}/grafana/provisioning/datasources"
    mkdir -p "${MONITORING_DIR}/grafana/provisioning/dashboards"
    mkdir -p "${MONITORING_DIR}/grafana/dashboards"
    mkdir -p "${MONITORING_DIR}/prometheus"
    mkdir -p "${MONITORING_DIR}/alertmanager"

    log_success "Directories created"
}

create_datasource_config() {
    log_info "Creating Grafana datasource configuration..."

    cat > "${MONITORING_DIR}/grafana/provisioning/datasources/prometheus.yml" << EOF
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true

  - name: AlertManager
    type: alertmanager
    access: proxy
    url: http://alertmanager:9093
    editable: true
EOF

    log_success "Grafana datasource configuration created"
}

create_env_file() {
    log_info "Creating environment configuration..."

    cat > "${MONITORING_DIR}/.env" << EOF
# Grafana Configuration
GRAFANA_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}

# Prometheus Configuration
PROMETHEUS_RETENTION=${PROMETHEUS_RETENTION}

# AlertManager Configuration
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-""}
PAGERDUTY_SERVICE_KEY=${PAGERDUTY_SERVICE_KEY:-""}
SMTP_USERNAME=${SMTP_USERNAME:-""}
SMTP_PASSWORD=${SMTP_PASSWORD:-""}

# Shared Storage Service Configuration
SHARED_STORAGE_SERVICE_URL=${SHARED_STORAGE_SERVICE_URL:-"http://shared-storage-service:3001"}
EOF

    log_success "Environment configuration created"
    log_warning "Please update the .env file with your actual configuration values"
}

validate_shared_storage_service() {
    log_info "Validating Shared Storage Service connectivity..."

    if [ -n "${SHARED_STORAGE_SERVICE_URL}" ]; then
        if curl -f -s "${SHARED_STORAGE_SERVICE_URL}/health" > /dev/null 2>&1; then
            log_success "Shared Storage Service is accessible"
        else
            log_warning "Shared Storage Service is not accessible at ${SHARED_STORAGE_SERVICE_URL}"
            log_warning "Make sure the service is running and accessible"
        fi
    else
        log_warning "SHARED_STORAGE_SERVICE_URL not set, skipping validation"
    fi
}

start_monitoring_stack() {
    log_info "Starting monitoring stack..."

    cd "${MONITORING_DIR}"

    # Create external network if it doesn't exist
    if ! docker network ls | grep -q "shared-storage-network"; then
        log_info "Creating shared-storage-network..."
        docker network create shared-storage-network
    fi

    # Start the monitoring stack
    docker-compose -f docker-compose.monitoring.yml up -d

    log_success "Monitoring stack started"
}

wait_for_services() {
    log_info "Waiting for services to be ready..."

    # Wait for Prometheus
    log_info "Waiting for Prometheus..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if curl -f -s http://localhost:9090/-/ready > /dev/null 2>&1; then
            log_success "Prometheus is ready"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done

    if [ $timeout -le 0 ]; then
        log_warning "Prometheus did not become ready within expected time"
    fi

    # Wait for Grafana
    log_info "Waiting for Grafana..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if curl -f -s http://localhost:3000/api/health > /dev/null 2>&1; then
            log_success "Grafana is ready"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done

    if [ $timeout -le 0 ]; then
        log_warning "Grafana did not become ready within expected time"
    fi
}

display_service_urls() {
    log_info "Monitoring stack is now running!"
    echo ""
    echo "Service URLs:"
    echo "  📊 Grafana:        http://localhost:3000 (admin/${GRAFANA_ADMIN_PASSWORD})"
    echo "  📈 Prometheus:     http://localhost:9090"
    echo "  🚨 AlertManager:   http://localhost:9093"
    echo "  📊 Node Exporter:  http://localhost:9100"
    echo "  📦 cAdvisor:       http://localhost:8080"
    echo "  📤 PushGateway:    http://localhost:9091"
    echo ""
    echo "Shared Storage Dashboards:"
    echo "  📊 Overview:       http://localhost:3000/d/shared-storage-overview"
    echo "  🔧 Operational:    http://localhost:3000/d/shared-storage-operational"
    echo "  💼 Business:       http://localhost:3000/d/shared-storage-business"
    echo "  📈 Trends:         http://localhost:3000/d/shared-storage-trends"
    echo "  ⚡ Real-Time:      http://localhost:3000/d/shared-storage-realtime"
}

show_next_steps() {
    echo ""
    log_info "Next steps:"
    echo "1. Update the .env file with your actual configuration values"
    echo "2. Configure Slack webhooks and PagerDuty integration in AlertManager"
    echo "3. Review and customize alert rules in prometheus/alert_rules.yml"
    echo "4. Set up proper authentication and security for Grafana"
    echo "5. Configure backup and retention policies for Prometheus data"
    echo ""
    echo "Useful commands:"
    echo "  # View logs"
    echo "  docker-compose -f docker-compose.monitoring.yml logs -f"
    echo ""
    echo "  # Stop monitoring stack"
    echo "  docker-compose -f docker-compose.monitoring.yml down"
    echo ""
    echo "  # Restart monitoring stack"
    echo "  docker-compose -f docker-compose.monitoring.yml restart"
}

main() {
    echo "🚀 Shared Storage Service - Monitoring Stack Setup"
    echo "=================================================="

    check_dependencies
    create_directories
    create_datasource_config
    create_env_file
    validate_shared_storage_service
    start_monitoring_stack
    wait_for_services
    display_service_urls
    show_next_steps

    log_success "Monitoring stack setup completed successfully! 🎉"
}

# Handle command line arguments
case "${1:-}" in
    "start")
        log_info "Starting monitoring stack..."
        cd "${MONITORING_DIR}"
        start_monitoring_stack
        wait_for_services
        display_service_urls
        ;;
    "stop")
        log_info "Stopping monitoring stack..."
        cd "${MONITORING_DIR}"
        docker-compose -f docker-compose.monitoring.yml down
        log_success "Monitoring stack stopped"
        ;;
    "restart")
        log_info "Restarting monitoring stack..."
        cd "${MONITORING_DIR}"
        docker-compose -f docker-compose.monitoring.yml restart
        log_success "Monitoring stack restarted"
        ;;
    "status")
        log_info "Checking monitoring stack status..."
        cd "${MONITORING_DIR}"
        docker-compose -f docker-compose.monitoring.yml ps
        ;;
    "logs")
        log_info "Showing monitoring stack logs..."
        cd "${MONITORING_DIR}"
        docker-compose -f docker-compose.monitoring.yml logs -f
        ;;
    "clean")
        log_warning "This will remove all monitoring data and containers. Are you sure? (y/N)"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            log_info "Cleaning up monitoring stack..."
            cd "${MONITORING_DIR}"
            docker-compose -f docker-compose.monitoring.yml down -v
            docker system prune -f
            log_success "Monitoring stack cleaned up"
        fi
        ;;
    *)
        main
        ;;
esac
