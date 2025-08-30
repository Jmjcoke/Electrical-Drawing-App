"""
Memory Service - Main Application
FastAPI service for persistent memory storage using Neo4j Graphiti
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import logging
from contextlib import asynccontextmanager

from api.router import api_router
from api.dependencies import set_graphiti_client
from core.config import settings
from core.graphiti_client import GraphitiClient

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global Graphiti client instance
graphiti_client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global graphiti_client
    
    # Startup
    logger.info("Starting Memory Service...")
    try:
        graphiti_client = GraphitiClient()
        await graphiti_client.initialize()
        set_graphiti_client(graphiti_client)
        logger.info("✅ Graphiti client initialized successfully")
    except Exception as e:
        logger.error(f"❌ Failed to initialize Graphiti client: {e}")
        # Don't fail startup, but log the error
    
    yield
    
    # Shutdown
    logger.info("Shutting down Memory Service...")
    if graphiti_client:
        await graphiti_client.close()
        logger.info("✅ Graphiti client closed")

app = FastAPI(
    title="Memory Service",
    description="Persistent memory storage for electrical drawing analysis",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Memory Service",
        "version": "1.0.0",
        "status": "running",
        "endpoints": [
            "/health",
            "/api/v1/memory/store",
            "/api/v1/memory/retrieve",
            "/api/v1/memory/search",
            "/api/v1/monitoring/stats"
        ]
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    global graphiti_client
    
    health_status = {
        "status": "healthy",
        "timestamp": "2025-08-28T21:35:00Z",
        "services": {}
    }
    
    # Check Graphiti client
    if graphiti_client and graphiti_client.is_connected():
        health_status["services"]["graphiti"] = "connected"
        health_status["services"]["neo4j"] = "connected"
    else:
        health_status["services"]["graphiti"] = "disconnected"
        health_status["services"]["neo4j"] = "disconnected"
        health_status["status"] = "degraded"
    
    return health_status

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred",
                "timestamp": "2025-08-28T21:35:00Z"
            }
        }
    )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )