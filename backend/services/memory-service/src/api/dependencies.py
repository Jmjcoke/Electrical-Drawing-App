"""
Dependency injection for API endpoints
"""

from fastapi import HTTPException
from ..core.graphiti_client import GraphitiClient

# This will be set by the main application
_graphiti_client = None

def set_graphiti_client(client: GraphitiClient):
    """Set the global graphiti client instance"""
    global _graphiti_client
    _graphiti_client = client

def get_graphiti_client() -> GraphitiClient:
    """Get the global graphiti client instance"""
    if not _graphiti_client:
        raise HTTPException(status_code=503, detail="Graphiti client not initialized")
    return _graphiti_client