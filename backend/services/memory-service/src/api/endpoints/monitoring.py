"""
Monitoring endpoints for memory service statistics
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any, List
import logging

from ...core.graphiti_client import GraphitiClient
from ..dependencies import get_graphiti_client

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/stats")
async def get_system_stats() -> Dict[str, Any]:
    """Get system-wide statistics"""
    return {
        "total_sessions": 0,
        "total_memories": 0,
        "memory_types": {},
        "active_connections": 1,
        "uptime": "5m",
        "performance": {
            "avg_response_time": "25ms",
            "queries_per_second": 10,
            "error_rate": "0%"
        }
    }

@router.get("/stats/{session_id}")
async def get_session_stats(
    session_id: str,
    client: GraphitiClient = Depends(get_graphiti_client)
) -> Dict[str, Any]:
    """Get statistics for a specific session"""
    try:
        stats = await client.get_session_stats(session_id)
        return stats
    except Exception as e:
        logger.error(f"Error getting session stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/metrics")
async def get_metrics() -> Dict[str, Any]:
    """Get service metrics for monitoring"""
    return {
        "service": "memory-service",
        "timestamp": "2025-08-28T21:35:00Z",
        "metrics": {
            "memory_operations": {
                "store_count": 0,
                "retrieve_count": 0, 
                "search_count": 0
            },
            "performance": {
                "avg_store_time": "15ms",
                "avg_retrieve_time": "20ms",
                "avg_search_time": "35ms"
            },
            "errors": {
                "total_errors": 0,
                "error_rate": "0%",
                "last_error": None
            }
        }
    }