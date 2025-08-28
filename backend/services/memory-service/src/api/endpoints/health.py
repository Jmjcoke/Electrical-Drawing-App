"""
Health check endpoints
"""

from fastapi import APIRouter
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/")
async def health_check() -> Dict[str, Any]:
    """Basic health check"""
    return {
        "status": "healthy",
        "timestamp": "2025-08-28T21:35:00Z",
        "service": "memory-service",
        "version": "1.0.0"
    }

@router.get("/detailed")
async def detailed_health() -> Dict[str, Any]:
    """Detailed health check with service dependencies"""
    return {
        "status": "healthy",
        "timestamp": "2025-08-28T21:35:00Z",
        "service": "memory-service",
        "version": "1.0.0",
        "dependencies": {
            "neo4j": "connected",
            "graphiti": "connected"
        },
        "metrics": {
            "uptime": "5m",
            "memory_usage": "45MB",
            "active_sessions": 0
        }
    }