"""
FastAPI Gateway Service for ELECTRICAL ORCHESTRATOR
Central API gateway handling authentication, routing, and service coordination
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import httpx
import time
import uuid

# Import shared modules
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from shared.database.connection import (
    init_database, 
    close_database, 
    check_database_health, 
    check_redis_health
)
from shared.logging.config import setup_logging

# Configure logging
setup_logging()
logger = logging.getLogger(__name__)

# Service URLs
SERVICE_URLS = {
    "auth": os.getenv("AUTH_SERVICE_URL", "http://auth-service:8001"),
    "pdf": os.getenv("PDF_SERVICE_URL", "http://pdf-service:8002"),
    "ai": os.getenv("AI_SERVICE_URL", "http://ai-service:8003"),
    "estimation": os.getenv("ESTIMATION_SERVICE_URL", "http://estimation-service:8004"),
    "tracking": os.getenv("TRACKING_SERVICE_URL", "http://tracking-service:8005"),
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting ELECTRICAL ORCHESTRATOR Gateway Service")
    
    try:
        await init_database()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down ELECTRICAL ORCHESTRATOR Gateway Service")
    await close_database()

# Create FastAPI application
app = FastAPI(
    title="ELECTRICAL ORCHESTRATOR - API Gateway",
    description="Central API gateway for the AI-powered electrical estimation platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Add trusted host middleware for production
if os.getenv("NODE_ENV") == "production":
    app.add_middleware(
        TrustedHostMiddleware, 
        allowed_hosts=os.getenv("ALLOWED_HOSTS", "localhost").split(",")
    )

# Request ID middleware
@app.middleware("http")
async def add_request_id(request: Request, call_next):
    """Add unique request ID to each request"""
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    
    # Add to headers for downstream services
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    
    return response

# Logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests with timing information"""
    start_time = time.time()
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    logger.info(
        f"Request started: {request.method} {request.url.path}",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "client_ip": request.client.host if request.client else "unknown"
        }
    )
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    logger.info(
        f"Request completed: {response.status_code} in {process_time:.3f}s",
        extra={
            "request_id": request_id,
            "status_code": response.status_code,
            "process_time": process_time
        }
    )
    
    return response

# HTTP client for service communication
async def get_http_client():
    """Get HTTP client for service communication"""
    return httpx.AsyncClient(timeout=30.0)

# Service proxy function
async def proxy_to_service(
    service_name: str, 
    path: str, 
    method: str = "GET", 
    data: dict = None,
    headers: dict = None,
    params: dict = None
):
    """Proxy requests to downstream services"""
    service_url = SERVICE_URLS.get(service_name)
    if not service_url:
        raise HTTPException(status_code=404, detail=f"Service {service_name} not found")
    
    url = f"{service_url}{path}"
    request_headers = headers or {}
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.request(
                method=method,
                url=url,
                json=data,
                headers=request_headers,
                params=params,
                timeout=30.0
            )
            
            return JSONResponse(
                content=response.json() if response.content else {},
                status_code=response.status_code,
                headers=dict(response.headers)
            )
            
        except httpx.TimeoutException:
            logger.error(f"Timeout calling {service_name} service at {url}")
            raise HTTPException(status_code=504, detail="Service timeout")
        except httpx.ConnectError:
            logger.error(f"Connection error to {service_name} service at {url}")
            raise HTTPException(status_code=503, detail="Service unavailable")
        except Exception as e:
            logger.error(f"Error calling {service_name} service: {e}")
            raise HTTPException(status_code=500, detail="Internal service error")

# Health check endpoints
@app.get("/health")
async def health_check():
    """Basic health check"""
    return {
        "status": "healthy",
        "service": "gateway",
        "version": "1.0.0",
        "timestamp": time.time()
    }

@app.get("/health/detailed")
async def detailed_health_check():
    """Detailed health check including dependencies"""
    database_health = await check_database_health()
    redis_health = await check_redis_health()
    
    # Check downstream services
    service_health = {}
    async with httpx.AsyncClient(timeout=5.0) as client:
        for service_name, service_url in SERVICE_URLS.items():
            try:
                response = await client.get(f"{service_url}/health")
                service_health[service_name] = {
                    "status": "healthy" if response.status_code == 200 else "unhealthy",
                    "response_time": response.elapsed.total_seconds()
                }
            except Exception as e:
                service_health[service_name] = {
                    "status": "unhealthy",
                    "error": str(e)
                }
    
    overall_status = "healthy"
    if (database_health["status"] != "healthy" or 
        redis_health["status"] != "healthy" or
        any(service["status"] != "healthy" for service in service_health.values())):
        overall_status = "degraded"
    
    return {
        "status": overall_status,
        "service": "gateway",
        "version": "1.0.0",
        "timestamp": time.time(),
        "dependencies": {
            "database": database_health,
            "redis": redis_health,
            "services": service_health
        }
    }

# Authentication routes (proxy to auth service)
@app.post("/auth/login")
async def login(request: Request):
    """Proxy login request to auth service"""
    body = await request.json()
    return await proxy_to_service("auth", "/auth/login", "POST", body)

@app.post("/auth/refresh")
async def refresh_token(request: Request):
    """Proxy token refresh to auth service"""
    body = await request.json()
    return await proxy_to_service("auth", "/auth/refresh", "POST", body)

@app.get("/auth/profile")
async def get_profile(request: Request):
    """Proxy profile request to auth service"""
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("auth", "/auth/profile", "GET", headers=headers)

@app.post("/auth/logout")
async def logout(request: Request):
    """Proxy logout request to auth service"""
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("auth", "/auth/logout", "POST", headers=headers)

# Project management routes (placeholder for future implementation)
@app.get("/api/v1/projects")
async def list_projects():
    """List projects (placeholder)"""
    return {"projects": [], "message": "Project service not yet implemented"}

@app.post("/api/v1/projects")
async def create_project(request: Request):
    """Create project (placeholder)"""
    return {"message": "Project creation not yet implemented"}

# PDF processing routes (placeholder for future implementation)  
@app.post("/api/v1/pdf/upload")
async def upload_pdf():
    """Upload PDF (placeholder)"""
    return {"message": "PDF processing service not yet implemented"}

# Circuit analysis routes (placeholder for future implementation)
@app.post("/api/v1/circuits/trace")
async def trace_circuit():
    """Trace circuit (placeholder)"""
    return {"message": "Circuit analysis service not yet implemented"}

# Estimation routes (placeholder for future implementation)
@app.post("/api/v1/estimates/generate")
async def generate_estimate():
    """Generate estimate (placeholder)"""
    return {"message": "Estimation service not yet implemented"}

# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions with proper logging"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    logger.warning(
        f"HTTP exception: {exc.status_code} - {exc.detail}",
        extra={
            "request_id": request_id,
            "status_code": exc.status_code,
            "path": request.url.path,
            "method": request.method
        }
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "request_id": request_id
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    request_id = getattr(request.state, 'request_id', 'unknown')
    
    logger.error(
        f"Unhandled exception: {str(exc)}",
        extra={
            "request_id": request_id,
            "path": request.url.path,
            "method": request.method,
            "exception": str(exc)
        },
        exc_info=True
    )
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "status_code": 500,
            "request_id": request_id
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)