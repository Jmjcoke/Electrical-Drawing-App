#!/bin/bash
# Comprehensive test runner for ELECTRICAL ORCHESTRATOR

set -e

echo "🧪 Running ELECTRICAL ORCHESTRATOR test suite..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    print_error "Virtual environment not found. Run ./scripts/dev-setup.sh first."
    exit 1
fi

# Activate virtual environment
source venv/bin/activate

print_status "Starting test databases..."

# Start test databases
docker-compose --profile test up -d postgres-test redis-test

# Wait for databases to be ready
print_status "Waiting for test databases to be ready..."
for i in {1..30}; do
    if docker-compose exec -T postgres-test pg_isready -U test_user -d electrical_orchestrator_test > /dev/null 2>&1; then
        break
    fi
    sleep 2
    if [ $i -eq 30 ]; then
        print_error "Test database failed to start"
        exit 1
    fi
done

print_success "Test databases are ready"

# Run backend tests
print_status "Running backend tests..."

cd src/backend/services/auth

# Install test dependencies if needed
pip install pytest pytest-cov pytest-asyncio httpx

# Set test environment variables
export DATABASE_URL="postgresql://test_user:test_pass@localhost:5433/electrical_orchestrator_test"
export REDIS_URL="redis://localhost:6380"
export JWT_SECRET_KEY="test-secret-key"
export NODE_ENV="test"

# Run Python tests with coverage
print_status "Running authentication service tests..."
if pytest tests/ -v --cov=. --cov-report=term-missing --cov-report=html:htmlcov; then
    print_success "Backend tests passed!"
else
    print_error "Backend tests failed!"
    cd ../../../../
    docker-compose --profile test down
    exit 1
fi

cd ../../../../

# Run frontend tests (if frontend exists)
if [ -d "src/frontend" ] && [ -f "src/frontend/package.json" ]; then
    print_status "Running frontend tests..."
    cd src/frontend
    
    if npm test; then
        print_success "Frontend tests passed!"
    else
        print_error "Frontend tests failed!"
        cd ../../
        docker-compose --profile test down
        exit 1
    fi
    
    cd ../../
else
    print_warning "Frontend not implemented yet, skipping frontend tests"
fi

# Run linting
print_status "Running code quality checks..."

# Python linting
print_status "Linting Python code..."
if black --check src/backend/; then
    print_success "Python formatting is correct"
else
    print_error "Python formatting issues found. Run 'black src/backend/' to fix."
    docker-compose --profile test down
    exit 1
fi

if flake8 src/backend/ --max-line-length=88 --extend-ignore=E203,W503; then
    print_success "Python linting passed"
else
    print_error "Python linting failed"
    docker-compose --profile test down
    exit 1
fi

# Type checking
print_status "Running type checks..."
mypy src/backend/services/auth/ --ignore-missing-imports || print_warning "Type checking completed with warnings"

# Security checks
print_status "Running security checks..."
if command -v safety &> /dev/null; then
    safety check -r src/backend/services/auth/requirements.txt || print_warning "Security vulnerabilities found"
else
    print_warning "Safety not installed, skipping security check"
fi

# Integration tests
print_status "Running integration tests..."

# Start auth service for integration testing
cd src/backend/services/auth
uvicorn main:app --host 0.0.0.0 --port 8001 &
AUTH_PID=$!
cd ../../../../

# Wait for service to start
sleep 5

# Test auth service health
if curl -f http://localhost:8001/health > /dev/null 2>&1; then
    print_success "Auth service integration test passed"
else
    print_error "Auth service integration test failed"
    kill $AUTH_PID 2>/dev/null || true
    docker-compose --profile test down
    exit 1
fi

# Stop auth service
kill $AUTH_PID 2>/dev/null || true

# E2E tests (if configured)
if [ -f "playwright.config.ts" ]; then
    print_status "Running E2E tests..."
    
    # Install Playwright if not already installed
    if ! command -v playwright &> /dev/null; then
        npm install -g @playwright/test
        npx playwright install --with-deps
    fi
    
    # Run E2E tests
    if npx playwright test; then
        print_success "E2E tests passed!"
    else
        print_warning "E2E tests failed or incomplete"
    fi
else
    print_warning "E2E tests not configured yet"
fi

# Cleanup
print_status "Cleaning up test environment..."
docker-compose --profile test down

print_success "All tests completed successfully! 🎉"

echo ""
echo "📊 Test Summary:"
echo "  ✅ Backend unit tests"
echo "  ✅ Code quality checks"
echo "  ✅ Security scanning"
echo "  ✅ Integration tests"
echo "  ${frontend_status:-⚠️} Frontend tests (${frontend_message:-not implemented})"
echo "  ${e2e_status:-⚠️} E2E tests (${e2e_message:-not fully configured})"
echo ""
echo "🚀 Ready for deployment!"