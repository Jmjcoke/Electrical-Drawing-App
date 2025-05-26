#!/bin/bash

# Cloud Detection Test Suite Runner
# Comprehensive testing script for cloud detection accuracy and performance

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="$TEST_DIR/test_results"
VENV_DIR="$TEST_DIR/venv"
REQUIREMENTS_FILE="$TEST_DIR/requirements.txt"

# Default test configuration
RUN_ACCURACY_TESTS=true
RUN_INTEGRATION_TESTS=true
RUN_PERFORMANCE_TESTS=true
QUICK_MODE=false
VERBOSE=false
GENERATE_REPORT=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --quick)
            QUICK_MODE=true
            shift
            ;;
        --accuracy-only)
            RUN_ACCURACY_TESTS=true
            RUN_INTEGRATION_TESTS=false
            RUN_PERFORMANCE_TESTS=false
            shift
            ;;
        --integration-only)
            RUN_ACCURACY_TESTS=false
            RUN_INTEGRATION_TESTS=true
            RUN_PERFORMANCE_TESTS=false
            shift
            ;;
        --performance-only)
            RUN_ACCURACY_TESTS=false
            RUN_INTEGRATION_TESTS=false
            RUN_PERFORMANCE_TESTS=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --no-report)
            GENERATE_REPORT=false
            shift
            ;;
        --output-dir)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --help|-h)
            echo "Cloud Detection Test Suite Runner"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --quick                Run quick validation tests only"
            echo "  --accuracy-only        Run accuracy tests only"
            echo "  --integration-only     Run integration tests only"
            echo "  --performance-only     Run performance tests only"
            echo "  --verbose, -v          Enable verbose output"
            echo "  --no-report           Skip report generation"
            echo "  --output-dir DIR      Specify output directory"
            echo "  --help, -h            Show this help message"
            echo ""
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Function to check dependencies
check_dependencies() {
    print_status "Checking dependencies..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is required but not installed"
        exit 1
    fi
    
    # Check pip
    if ! command -v pip3 &> /dev/null; then
        print_error "pip3 is required but not installed"
        exit 1
    fi
    
    print_success "Dependencies check passed"
}

# Function to setup virtual environment
setup_environment() {
    print_status "Setting up test environment..."
    
    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "$VENV_DIR" ]; then
        print_status "Creating virtual environment..."
        python3 -m venv "$VENV_DIR"
    fi
    
    # Activate virtual environment
    source "$VENV_DIR/bin/activate"
    
    # Install/upgrade requirements
    if [ -f "$REQUIREMENTS_FILE" ]; then
        print_status "Installing Python dependencies..."
        pip install -r "$REQUIREMENTS_FILE"
    else
        # Install essential packages
        print_status "Installing essential packages..."
        pip install pytest pytest-asyncio numpy opencv-python pillow psutil aiohttp
    fi
    
    print_success "Environment setup completed"
}

# Function to run pre-test checks
run_pre_test_checks() {
    print_status "Running pre-test system checks..."
    
    # Check available memory
    AVAILABLE_MEMORY=$(python3 -c "import psutil; print(psutil.virtual_memory().available // (1024*1024))")
    if [ "$AVAILABLE_MEMORY" -lt 2048 ]; then
        print_warning "Low available memory: ${AVAILABLE_MEMORY}MB (recommended: 2GB+)"
    fi
    
    # Check disk space
    AVAILABLE_DISK=$(df "$OUTPUT_DIR" | awk 'NR==2 {print $4}')
    if [ "$AVAILABLE_DISK" -lt 1000000 ]; then  # 1GB in KB
        print_warning "Low disk space available for test results"
    fi
    
    # Check if services are running (optional)
    if command -v curl &> /dev/null; then
        if curl -s http://localhost:8004/health &> /dev/null; then
            print_success "AI Vision service is running"
        else
            print_warning "AI Vision service not accessible (integration tests may fail)"
        fi
    fi
    
    print_success "Pre-test checks completed"
}

# Function to run accuracy tests
run_accuracy_tests() {
    print_status "Running accuracy tests..."
    
    local start_time=$(date +%s)
    
    if [ "$VERBOSE" = true ]; then
        python3 test_cloud_detection_accuracy.py --verbose
    else
        python3 test_cloud_detection_accuracy.py > "$OUTPUT_DIR/accuracy_tests.log" 2>&1
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ $? -eq 0 ]; then
        print_success "Accuracy tests completed in ${duration}s"
        return 0
    else
        print_error "Accuracy tests failed"
        return 1
    fi
}

# Function to run integration tests
run_integration_tests() {
    print_status "Running integration tests..."
    
    local start_time=$(date +%s)
    
    if [ "$VERBOSE" = true ]; then
        python3 test_integration_suite.py --verbose
    else
        python3 test_integration_suite.py > "$OUTPUT_DIR/integration_tests.log" 2>&1
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ $? -eq 0 ]; then
        print_success "Integration tests completed in ${duration}s"
        return 0
    else
        print_error "Integration tests failed"
        return 1
    fi
}

# Function to run performance tests
run_performance_tests() {
    print_status "Running performance benchmarks..."
    
    local start_time=$(date +%s)
    
    if [ "$VERBOSE" = true ]; then
        python3 test_performance_benchmarks.py --verbose
    else
        python3 test_performance_benchmarks.py > "$OUTPUT_DIR/performance_tests.log" 2>&1
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ $? -eq 0 ]; then
        print_success "Performance tests completed in ${duration}s"
        return 0
    else
        print_error "Performance tests failed"
        return 1
    fi
}

# Function to run comprehensive test suite
run_comprehensive_tests() {
    print_status "Running comprehensive test suite..."
    
    local args=""
    
    if [ "$RUN_ACCURACY_TESTS" = false ] && [ "$RUN_INTEGRATION_TESTS" = true ] && [ "$RUN_PERFORMANCE_TESTS" = false ]; then
        args="--integration-only"
    elif [ "$RUN_ACCURACY_TESTS" = false ] && [ "$RUN_INTEGRATION_TESTS" = false ] && [ "$RUN_PERFORMANCE_TESTS" = true ]; then
        args="--performance-only"
    elif [ "$RUN_ACCURACY_TESTS" = true ] && [ "$RUN_INTEGRATION_TESTS" = false ] && [ "$RUN_PERFORMANCE_TESTS" = false ]; then
        args="--accuracy-only"
    fi
    
    args="$args --output-dir $OUTPUT_DIR"
    
    if [ "$VERBOSE" = true ]; then
        python3 test_runner.py $args
    else
        python3 test_runner.py $args > "$OUTPUT_DIR/comprehensive_tests.log" 2>&1
    fi
    
    return $?
}

# Function to run quick validation
run_quick_validation() {
    print_status "Running quick validation tests..."
    
    if [ "$VERBOSE" = true ]; then
        python3 test_runner.py --quick --output-dir "$OUTPUT_DIR"
    else
        python3 test_runner.py --quick --output-dir "$OUTPUT_DIR" > "$OUTPUT_DIR/quick_validation.log" 2>&1
    fi
    
    return $?
}

# Function to generate test report
generate_test_report() {
    if [ "$GENERATE_REPORT" = false ]; then
        return 0
    fi
    
    print_status "Generating test report..."
    
    # Find the most recent test results
    LATEST_RESULTS=$(ls -t "$OUTPUT_DIR"/test_results_*.json 2>/dev/null | head -1)
    
    if [ -n "$LATEST_RESULTS" ]; then
        # Generate HTML report (if available)
        if command -v python3 &> /dev/null; then
            python3 -c "
import json
import sys
from pathlib import Path

try:
    with open('$LATEST_RESULTS') as f:
        results = json.load(f)
    
    summary = results.get('summary', {})
    
    print('\\n' + '='*60)
    print('CLOUD DETECTION TEST SUMMARY')
    print('='*60)
    print(f'Overall Status: {summary.get(\"overall_status\", \"UNKNOWN\")}')
    print(f'Deployment Readiness: {summary.get(\"deployment_readiness\", \"UNKNOWN\")}')
    
    coverage = summary.get('test_coverage', {})
    print(f'Total Tests: {coverage.get(\"total_tests\", 0)}')
    
    quality = summary.get('quality_assessment', {})
    if quality:
        print(f'Average F1-Score: {quality.get(\"average_f1_score\", 0):.3f}')
    
    perf = summary.get('performance_metrics', {})
    if perf:
        if 'average_processing_time' in perf:
            print(f'Average Processing Time: {perf[\"average_processing_time\"]:.3f}s')
        if 'average_memory_usage' in perf:
            print(f'Average Memory Usage: {perf[\"average_memory_usage\"]:.1f}MB')
    
    recommendations = summary.get('recommendations', [])
    if recommendations:
        print('\\nRecommendations:')
        for i, rec in enumerate(recommendations[:3], 1):
            print(f'  {i}. {rec}')
    
    print('='*60)
    
except Exception as e:
    print(f'Error generating report: {e}', file=sys.stderr)
    sys.exit(1)
"
        else
            print_warning "Python not available for report generation"
        fi
    else
        print_warning "No test results found for report generation"
    fi
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up..."
    
    # Deactivate virtual environment if active
    if [ -n "$VIRTUAL_ENV" ]; then
        deactivate 2>/dev/null || true
    fi
    
    print_success "Cleanup completed"
}

# Main execution
main() {
    local overall_start_time=$(date +%s)
    local test_failures=0
    
    print_status "Starting Cloud Detection Test Suite"
    print_status "Configuration:"
    print_status "  Quick Mode: $QUICK_MODE"
    print_status "  Accuracy Tests: $RUN_ACCURACY_TESTS"
    print_status "  Integration Tests: $RUN_INTEGRATION_TESTS"
    print_status "  Performance Tests: $RUN_PERFORMANCE_TESTS"
    print_status "  Output Directory: $OUTPUT_DIR"
    
    # Setup
    check_dependencies
    setup_environment
    run_pre_test_checks
    
    # Change to test directory
    cd "$TEST_DIR"
    
    # Activate virtual environment
    source "$VENV_DIR/bin/activate"
    
    # Run tests based on mode
    if [ "$QUICK_MODE" = true ]; then
        if ! run_quick_validation; then
            test_failures=$((test_failures + 1))
        fi
    else
        if ! run_comprehensive_tests; then
            test_failures=$((test_failures + 1))
        fi
    fi
    
    # Generate report
    generate_test_report
    
    # Calculate total time
    local overall_end_time=$(date +%s)
    local total_duration=$((overall_end_time - overall_start_time))
    
    # Final status
    print_status "Test suite completed in ${total_duration}s"
    
    if [ $test_failures -eq 0 ]; then
        print_success "All tests passed successfully!"
        print_status "Results saved to: $OUTPUT_DIR"
    else
        print_error "Some tests failed ($test_failures failures)"
        print_status "Check logs in: $OUTPUT_DIR"
        exit 1
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Run main function
main "$@"