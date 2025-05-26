#!/bin/bash
# Development Environment Setup Script for ELECTRICAL ORCHESTRATOR

set -e

echo "🔧 Setting up ELECTRICAL ORCHESTRATOR development environment..."

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

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker Desktop first."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not available. Please ensure Docker Desktop is properly installed."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18.x or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version must be 18.x or higher. Current version: $(node -v)"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is not installed. Please install Python 3.11 or higher."
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
if ! python3 -c "import sys; exit(0 if sys.version_info >= (3, 11) else 1)"; then
    print_error "Python version must be 3.11 or higher. Current version: $PYTHON_VERSION"
    exit 1
fi

print_status "Creating environment files..."

# Create .env.local if it doesn't exist
if [ ! -f .env.local ]; then
    cp .env.example .env.local
    print_success "Created .env.local from .env.example"
    print_warning "Please review and update .env.local with your specific configuration"
else
    print_status ".env.local already exists"
fi

# Create .env.test for testing
if [ ! -f .env.test ]; then
    cat > .env.test << 'EOF'
# Test Environment Configuration
NODE_ENV=test
DATABASE_URL=postgresql://test_user:test_pass@localhost:5433/electrical_orchestrator_test
REDIS_URL=redis://localhost:6380
JWT_SECRET_KEY=test-jwt-secret-key-for-testing-only
MOCK_AWS_SERVICES=true
MOCK_SAML_PROVIDER=true
MOCK_LDAP_SERVER=true
LOG_LEVEL=debug
EOF
    print_success "Created .env.test for testing environment"
fi

print_status "Setting up Python virtual environment..."

# Create Python virtual environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
    print_success "Created Python virtual environment"
else
    print_status "Python virtual environment already exists"
fi

# Activate virtual environment and install dependencies
print_status "Installing Python dependencies..."
source venv/bin/activate

# Install backend dependencies
if [ -f "src/backend/services/auth/requirements.txt" ]; then
    pip install -r src/backend/services/auth/requirements.txt
    print_success "Installed authentication service dependencies"
fi

# Install common development dependencies
pip install black flake8 mypy pytest pytest-cov pytest-asyncio httpx
print_success "Installed Python development dependencies"

print_status "Setting up frontend dependencies..."

# Check if frontend directory exists and has package.json
if [ -d "src/frontend" ] && [ -f "src/frontend/package.json" ]; then
    cd src/frontend
    npm install
    print_success "Installed frontend dependencies"
    cd ../..
else
    print_status "Frontend not yet initialized - will be set up in subsequent tasks"
fi

print_status "Setting up Git hooks..."

# Create pre-commit hook
mkdir -p .git/hooks
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook for ELECTRICAL ORCHESTRATOR

echo "Running pre-commit checks..."

# Check Python formatting
if [ -d "src/backend" ]; then
    echo "Checking Python code formatting..."
    source venv/bin/activate
    black --check src/backend/ || (echo "Python formatting failed. Run 'black src/backend/' to fix." && exit 1)
    flake8 src/backend/ || (echo "Python linting failed." && exit 1)
fi

# Check frontend formatting (if frontend exists)
if [ -d "src/frontend" ] && [ -f "src/frontend/package.json" ]; then
    echo "Checking frontend code formatting..."
    cd src/frontend
    npm run lint || (echo "Frontend linting failed." && exit 1)
    cd ../..
fi

echo "Pre-commit checks passed!"
EOF

chmod +x .git/hooks/pre-commit
print_success "Created Git pre-commit hook"

print_status "Validating Docker setup..."

# Test Docker by running hello-world
if docker run --rm hello-world > /dev/null 2>&1; then
    print_success "Docker is working correctly"
else
    print_error "Docker is not working properly. Please check your Docker installation."
    exit 1
fi

# Create docker network if it doesn't exist
if ! docker network ls | grep -q electrical-orchestrator; then
    docker network create electrical-orchestrator
    print_success "Created Docker network: electrical-orchestrator"
fi

print_status "Setting up development databases..."

# Start PostgreSQL and Redis for development
if docker-compose -f docker-compose.yml up -d postgres redis; then
    print_success "Started development databases (PostgreSQL and Redis)"
    
    # Wait for PostgreSQL to be ready
    print_status "Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if docker-compose exec postgres pg_isready -U postgres > /dev/null 2>&1; then
            print_success "PostgreSQL is ready"
            break
        fi
        sleep 2
        if [ $i -eq 30 ]; then
            print_error "PostgreSQL failed to start within 60 seconds"
            exit 1
        fi
    done
else
    print_warning "Could not start databases with docker-compose. Will be set up later."
fi

print_success "Development environment setup completed!"

echo ""
echo "🚀 Next steps:"
echo "1. Review and update .env.local with your configuration"
echo "2. Run 'source venv/bin/activate' to activate Python environment"
echo "3. Run 'docker-compose up' to start all services"
echo "4. Access the application at http://localhost:3000"
echo ""
echo "📖 Development commands:"
echo "  - Start all services: docker-compose up"
echo "  - Run tests: ./scripts/test.sh"
echo "  - Deploy: ./scripts/deploy.sh"
echo ""
echo "Happy coding! 🎉"