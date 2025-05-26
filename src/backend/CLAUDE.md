# Backend Services - Claude Code Configuration

## Overview

Backend for Electrical Orchestrator using Python microservices architecture with FastAPI, following BMAD Method development standards.

## BMAD Method Integration

### Backend Development Persona
Use the **Developer Agent** persona from BMAD Orchestrator for backend implementation:

```markdown
# Activate Developer Agent
I need to work on backend services. Please activate the Developer Agent persona optimized for Python/FastAPI development.
```

### Story Implementation Workflow
1. **Load Story**: Reference assigned story from `docs/stories/[epic].[story].story.md`
2. **Service Context**: Understand microservice architecture and dependencies
3. **Implementation**: Follow FastAPI patterns and async programming
4. **Testing**: Implement comprehensive test coverage (95%+)
5. **Documentation**: API documentation with OpenAPI/Swagger

## Architecture Overview

### Microservices Structure
```
src/backend/
├── gateway/                 # API Gateway (FastAPI)
├── services/               # Individual microservices
│   ├── auth/              # Authentication service
│   ├── component-intelligence/  # AI component recognition
│   ├── pdf-processing/    # PDF analysis and processing
│   ├── projects/          # Project management
│   └── [other-services]/  # Additional business services
├── shared/                # Shared utilities
│   ├── auth/             # Authentication helpers
│   ├── database/         # Database models and connection
│   ├── logging/          # Logging configuration
│   └── validation/       # Input validation
└── tests/                # Integration tests
```

### Technology Stack
- **Framework**: FastAPI with async/await
- **Database**: PostgreSQL with SQLAlchemy ORM
- **Caching**: Redis for session and data caching
- **Authentication**: JWT tokens with refresh rotation
- **Testing**: pytest with asyncio support
- **Documentation**: OpenAPI/Swagger auto-generation

## Development Commands

### Environment Setup
```bash
# Create virtual environment for service
cd src/backend/services/[service-name]
python -m venv venv
source venv/bin/activate  # Unix/Mac
# or
venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with appropriate values
```

### Service Development
```bash
# Start individual service
python main.py

# Start with auto-reload for development
uvicorn main:app --reload --host 0.0.0.0 --port 8001

# Start all services via Docker
cd src/backend
docker-compose up -d

# View service logs
docker-compose logs -f [service-name]
```

### Testing
```bash
# Run tests for specific service
cd src/backend/services/[service-name]
pytest

# Run with coverage
pytest --cov=. --cov-report=html

# Run integration tests
cd src/backend
pytest tests/

# Run specific test file
pytest tests/test_[service-name].py -v

# Run with debugging
pytest -s -vv tests/test_[service-name].py::test_function_name
```

## Code Standards & Patterns

### FastAPI Service Structure
```python
# main.py - Service entry point
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Service Name",
    description="Service description following BMAD standards",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint (required for all services)
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "service-name",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
```

### Database Integration
```python
# database.py - Database connection and models
from sqlalchemy import create_engine, Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

DATABASE_URL = "postgresql://user:password@localhost:5432/dbname"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class BaseModel(Base):
    __abstract__ = True
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

# Dependency for database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

### Async Error Handling
```python
# error_handlers.py - Standardized error handling
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)

class ServiceException(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

async def service_exception_handler(request: Request, exc: ServiceException):
    logger.error(f"Service error: {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message}
    )

async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unexpected error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
```

### Pydantic Models & Validation
```python
# models.py - Request/Response models
from pydantic import BaseModel, Field, validator
from typing import List, Optional
from datetime import datetime
import uuid

class CreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    
    @validator('name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError('Name cannot be empty')
        return v.strip()

class UpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)

class Response(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
```

### Authentication Integration
```python
# auth.py - Authentication helpers
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import redis

security = HTTPBearer()
redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Check if token is blacklisted
    if redis_client.get(f"blacklist:{token}"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked"
        )
    
    return user_id
```

## Service-Specific Patterns

### Component Intelligence Service
```python
# component_recognition.py
import tensorflow as tf
import numpy as np
from typing import Dict, List, Tuple
import asyncio

class ComponentRecognitionService:
    def __init__(self):
        self.model = tf.keras.models.load_model('model.h5')
        
    async def recognize_components(self, image: np.ndarray, 
                                 bboxes: List[Tuple[int, int, int, int]]) -> List[Dict]:
        """Recognize electrical components in image regions"""
        results = []
        
        for bbox in bboxes:
            try:
                # Extract region of interest
                x, y, w, h = bbox
                roi = image[y:y+h, x:x+w]
                
                # Preprocess for model
                processed = self._preprocess_image(roi)
                
                # Run inference
                prediction = self.model.predict(processed)
                
                # Parse results
                result = self._parse_prediction(prediction, bbox)
                results.append(result)
                
            except Exception as e:
                logger.error(f"Error recognizing component at {bbox}: {e}")
                continue
        
        return results
    
    def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        # Implementation details
        pass
    
    def _parse_prediction(self, prediction: np.ndarray, bbox: Tuple) -> Dict:
        # Implementation details
        pass
```

### PDF Processing Service
```python
# pdf_processor.py
import asyncio
from pathlib import Path
import fitz  # PyMuPDF
from typing import Dict, List

class PDFProcessingService:
    async def process_pdf(self, pdf_path: Path) -> Dict:
        """Process PDF and extract information"""
        try:
            doc = fitz.open(pdf_path)
            
            results = {
                "page_count": len(doc),
                "pages": [],
                "metadata": doc.metadata
            }
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                page_data = await self._process_page(page, page_num)
                results["pages"].append(page_data)
            
            doc.close()
            return results
            
        except Exception as e:
            logger.error(f"Error processing PDF {pdf_path}: {e}")
            raise ServiceException(f"Failed to process PDF: {str(e)}")
    
    async def _process_page(self, page, page_num: int) -> Dict:
        """Process individual PDF page"""
        # Extract text
        text = page.get_text()
        
        # Extract images
        image_list = page.get_images()
        
        # Extract drawings/vectors
        drawings = page.get_drawings()
        
        return {
            "page_number": page_num,
            "text": text,
            "image_count": len(image_list),
            "drawing_count": len(drawings),
            "bbox": page.rect
        }
```

## Testing Standards

### Unit Tests
```python
# test_service.py
import pytest
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch

from main import app

client = TestClient(app)

class TestServiceEndpoints:
    """Test service endpoints following BMAD standards"""
    
    def test_health_check(self):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
    
    @pytest.mark.asyncio
    async def test_async_endpoint(self):
        """Test async endpoint functionality"""
        # Mock dependencies
        with patch('service.dependency') as mock_dep:
            mock_dep.return_value = "expected_value"
            
            response = client.post("/endpoint", json={"test": "data"})
            assert response.status_code == 200
    
    def test_error_handling(self):
        """Test error handling and responses"""
        response = client.post("/endpoint", json={"invalid": "data"})
        assert response.status_code == 400
        assert "detail" in response.json()

# Fixtures for testing
@pytest.fixture
def mock_database():
    """Mock database for testing"""
    pass

@pytest.fixture
def sample_data():
    """Sample data for tests"""
    return {"test": "data"}
```

### Integration Tests
```python
# test_integration.py
import pytest
import asyncio
import aiohttp
from testcontainers.postgres import PostgresContainer
from testcontainers.redis import RedisContainer

class TestServiceIntegration:
    """Integration tests with real database"""
    
    @pytest.fixture(scope="class")
    def postgres_container(self):
        with PostgresContainer("postgres:13") as postgres:
            yield postgres
    
    @pytest.fixture(scope="class") 
    def redis_container(self):
        with RedisContainer("redis:6") as redis:
            yield redis
    
    @pytest.mark.asyncio
    async def test_end_to_end_workflow(self, postgres_container, redis_container):
        """Test complete service workflow"""
        # Setup test environment
        db_url = postgres_container.get_connection_url()
        redis_url = redis_container.get_connection_url()
        
        # Run end-to-end test
        async with aiohttp.ClientSession() as session:
            # Test workflow steps
            pass
```

## Docker Configuration

### Service Dockerfile
```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user
RUN adduser --disabled-password --gecos '' appuser
RUN chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Start application
CMD ["python", "main.py"]
```

### Docker Compose for Development
```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:13
    environment:
      POSTGRES_DB: electrical_orchestrator
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6-alpine
    ports:
      - "6379:6379"

  gateway:
    build: ./gateway
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/electrical_orchestrator
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  auth-service:
    build: ./services/auth
    ports:
      - "8001:8001"
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/electrical_orchestrator
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
```

## Logging & Monitoring

### Structured Logging
```python
# logging_config.py
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "service": "service-name",
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        
        return json.dumps(log_entry)

# Configure logging
def setup_logging():
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    logger.addHandler(handler)
    
    return logger
```

## Performance Optimization

### Database Optimization
```python
# Async database operations
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import selectinload

# Connection pooling
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=0,
    pool_pre_ping=True
)

# Optimized queries with eager loading
async def get_items_with_relations(db: AsyncSession):
    result = await db.execute(
        select(Item)
        .options(selectinload(Item.relations))
        .where(Item.active == True)
    )
    return result.scalars().all()
```

### Caching Strategy
```python
# Redis caching decorator
import functools
import json
import redis

redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)

def cache_result(expiration: int = 300):
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Create cache key
            cache_key = f"{func.__name__}:{hash(str(args) + str(kwargs))}"
            
            # Try to get from cache
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            redis_client.setex(cache_key, expiration, json.dumps(result, default=str))
            
            return result
        return wrapper
    return decorator
```

## Security Best Practices

### Input Validation
```python
# Comprehensive input validation
from pydantic import BaseModel, validator, Field
import re

class SecureInput(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., regex=r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    
    @validator('name')
    def validate_name(cls, v):
        # Sanitize input
        if re.search(r'[<>"\']', v):
            raise ValueError('Name contains invalid characters')
        return v.strip()
    
    @validator('*')
    def no_null_bytes(cls, v):
        if isinstance(v, str) and '\x00' in v:
            raise ValueError('Null bytes not allowed')
        return v
```

### Rate Limiting
```python
# Rate limiting middleware
from fastapi import Request, HTTPException
from collections import defaultdict
import time

class RateLimiter:
    def __init__(self, max_requests: int = 100, window: int = 60):
        self.max_requests = max_requests
        self.window = window
        self.requests = defaultdict(list)
    
    def is_allowed(self, identifier: str) -> bool:
        now = time.time()
        requests = self.requests[identifier]
        
        # Remove old requests
        requests[:] = [req_time for req_time in requests if now - req_time < self.window]
        
        if len(requests) >= self.max_requests:
            return False
        
        requests.append(now)
        return True

rate_limiter = RateLimiter()

async def rate_limit_middleware(request: Request, call_next):
    client_ip = request.client.host
    
    if not rate_limiter.is_allowed(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    response = await call_next(request)
    return response
```

This backend configuration provides comprehensive guidance for developing Python microservices following BMAD Method principles with Claude Code best practices.