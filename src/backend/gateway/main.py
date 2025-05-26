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
    "projects": os.getenv("PROJECTS_SERVICE_URL", "http://projects-service:8002"),
    "pdf": os.getenv("PDF_SERVICE_URL", "http://pdf-service:8003"),
    "ai": os.getenv("AI_SERVICE_URL", "http://ai-service:8004"),
    "ai_vision": os.getenv("AI_VISION_SERVICE_URL", "http://ai-vision-service:8004"),
    "estimation": os.getenv("ESTIMATION_SERVICE_URL", "http://estimation-service:8005"),
    "tracking": os.getenv("TRACKING_SERVICE_URL", "http://tracking-service:8006"),
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

# Project management routes
@app.get("/api/v1/projects")
async def list_projects(request: Request):
    """List projects with filtering and pagination"""
    headers = {"Authorization": request.headers.get("Authorization", "")}
    params = dict(request.query_params)
    return await proxy_to_service("projects", "/projects", "GET", headers=headers, params=params)

@app.post("/api/v1/projects")
async def create_project(request: Request):
    """Create new project"""
    body = await request.json()
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("projects", "/projects", "POST", body, headers)

@app.get("/api/v1/projects/{project_id}")
async def get_project(project_id: str, request: Request):
    """Get project by ID"""
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("projects", f"/projects/{project_id}", "GET", headers=headers)

@app.put("/api/v1/projects/{project_id}")
async def update_project(project_id: str, request: Request):
    """Update project"""
    body = await request.json()
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("projects", f"/projects/{project_id}", "PUT", body, headers)

@app.delete("/api/v1/projects/{project_id}")
async def archive_project(project_id: str, request: Request):
    """Archive project"""
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("projects", f"/projects/{project_id}", "DELETE", headers=headers)

# Team management routes
@app.get("/api/v1/projects/{project_id}/team")
async def get_project_team(project_id: str, request: Request):
    """Get project team members"""
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("projects", f"/projects/{project_id}/team", "GET", headers=headers)

@app.post("/api/v1/projects/{project_id}/team")
async def add_team_member(project_id: str, request: Request):
    """Add team member to project"""
    body = await request.json()
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("projects", f"/projects/{project_id}/team", "POST", body, headers)

# PDF processing routes
@app.post("/api/v1/pdf/upload")
async def upload_pdf(request: Request):
    """Upload PDF drawing for processing"""
    # Handle multipart form data differently
    headers = {"Authorization": request.headers.get("Authorization", "")}
    
    # For file uploads, we need to stream the request body
    try:
        # Get the raw request body and headers for file upload
        body = await request.body()
        content_type = request.headers.get("content-type", "")
        
        if content_type:
            headers["content-type"] = content_type
        
        # Stream upload to PDF service
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{SERVICE_URLS['pdf']}/upload",
                content=body,
                headers=headers,
                timeout=60.0  # Longer timeout for file uploads
            )
            
            return JSONResponse(
                content=response.json() if response.content else {},
                status_code=response.status_code
            )
            
    except Exception as e:
        logger.error(f"PDF upload error: {e}")
        raise HTTPException(status_code=500, detail="Upload failed")

@app.get("/api/v1/pdf/drawings/{drawing_id}/status")
async def get_drawing_status(drawing_id: str, request: Request):
    """Get PDF processing status"""
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("pdf", f"/drawings/{drawing_id}/status", "GET", headers=headers)

@app.get("/api/v1/projects/{project_id}/drawings")
async def list_project_drawings(project_id: str, request: Request):
    """List drawings for a project"""
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("pdf", f"/projects/{project_id}/drawings", "GET", headers=headers)

@app.delete("/api/v1/pdf/drawings/{drawing_id}")
async def delete_drawing(drawing_id: str, request: Request):
    """Delete a drawing"""
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("pdf", f"/drawings/{drawing_id}", "DELETE", headers=headers)

@app.get("/api/v1/pdf/drawings/{drawing_id}/thumbnails")
async def get_drawing_thumbnails(drawing_id: str, request: Request):
    """Get all thumbnails for a drawing"""
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("pdf", f"/drawings/{drawing_id}/thumbnails", "GET", headers=headers)

@app.get("/api/v1/pdf/drawings/{drawing_id}/pages")
async def get_drawing_pages(drawing_id: str, request: Request):
    """Get page information and navigation data"""
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("pdf", f"/drawings/{drawing_id}/pages", "GET", headers=headers)

@app.get("/api/v1/pdf/drawings/{drawing_id}/pages/{page_number}/thumbnail")
async def get_page_thumbnail(drawing_id: str, page_number: int, request: Request):
    """Get a specific page thumbnail"""
    headers = {"Authorization": request.headers.get("Authorization", "")}
    params = dict(request.query_params)  # Include size parameter
    return await proxy_to_service("pdf", f"/drawings/{drawing_id}/pages/{page_number}/thumbnail", "GET", headers=headers, params=params)

# AI Vision / Cloud Detection routes
@app.post("/api/v1/ai/detect-clouds")
async def detect_clouds(request: Request):
    """Detect cloud areas in electrical drawings"""
    body = await request.json()
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("ai_vision", "/detect-clouds", "POST", body, headers)

@app.get("/api/v1/ai/detection-status/{task_id}")
async def get_detection_status(task_id: str, request: Request):
    """Get cloud detection task status"""
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("ai_vision", f"/detection-status/{task_id}", "GET", headers=headers)

@app.get("/api/v1/ai/drawings/{drawing_id}/clouds")
async def get_cloud_detection_results(drawing_id: str, request: Request):
    """Get cloud detection results for a drawing"""
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("ai_vision", f"/drawings/{drawing_id}/clouds", "GET", headers=headers)

@app.post("/api/v1/ai/save-cloud-edits")
async def save_cloud_edits(request: Request):
    """Save manual cloud area edits"""
    body = await request.json()
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("ai_vision", "/save-cloud-edits", "POST", body, headers)

@app.post("/api/v1/ai/generate-enhanced-overlay")
async def generate_enhanced_overlay(request: Request):
    """Generate enhanced overlay with cloud detection results"""
    body = await request.body()
    headers = {"Authorization": request.headers.get("Authorization", "")}
    headers["Content-Type"] = request.headers.get("Content-Type", "application/x-www-form-urlencoded")
    return await proxy_to_service("ai_vision", "/generate-enhanced-overlay", "POST", body, headers)

@app.post("/api/v1/ai/update-detection-settings")
async def update_detection_settings(request: Request):
    """Update cloud detection configuration settings"""
    body = await request.json()
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("ai_vision", "/update-detection-settings", "POST", body, headers)

@app.get("/api/v1/drawings/{drawing_id}/clouds")
async def get_drawing_cloud_results(drawing_id: str, request: Request):
    """Get cloud detection results from PDF processing service"""
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("pdf", f"/drawings/{drawing_id}/clouds", "GET", headers=headers)

# Detection Profile Management routes
@app.get("/api/v1/ai/detection-profiles")
async def get_detection_profiles(request: Request):
    """Get all available detection profiles"""
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("ai_vision", "/detection-profiles", "GET", headers=headers)

@app.post("/api/v1/ai/detection-profiles")
async def create_detection_profile(request: Request):
    """Create a new detection profile"""
    body = await request.json()
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("ai_vision", "/detection-profiles", "POST", body, headers)

@app.put("/api/v1/ai/detection-profiles/{profile_id}")
async def update_detection_profile(profile_id: str, request: Request):
    """Update an existing detection profile"""
    body = await request.json()
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("ai_vision", f"/detection-profiles/{profile_id}", "PUT", body, headers)

@app.delete("/api/v1/ai/detection-profiles/{profile_id}")
async def delete_detection_profile(profile_id: str, request: Request):
    """Delete a detection profile"""
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("ai_vision", f"/detection-profiles/{profile_id}", "DELETE", headers=headers)

@app.post("/api/v1/ai/detection-profiles/{profile_id}/apply")
async def apply_detection_profile(profile_id: str, request: Request):
    """Apply a detection profile to a specific drawing"""
    body = await request.json()
    headers = {"Authorization": request.headers.get("Authorization", "")}
    return await proxy_to_service("ai_vision", f"/detection-profiles/{profile_id}/apply", "POST", body, headers)
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