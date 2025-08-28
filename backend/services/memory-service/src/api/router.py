"""
API Router for Memory Service
"""

from fastapi import APIRouter
from .endpoints import memory, health, monitoring

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(memory.router, prefix="/memory", tags=["memory"])
api_router.include_router(health.router, prefix="/health", tags=["health"]) 
api_router.include_router(monitoring.router, prefix="/monitoring", tags=["monitoring"])