"""
Memory endpoints for storing and retrieving conversation context
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
import logging

from ..models.memory_models import (
    MemoryStoreRequest, 
    MemoryStoreResponse,
    MemoryRetrieveResponse,
    MemorySearchRequest,
    MemorySearchResponse
)
from core.graphiti_client import GraphitiClient
from ..dependencies import get_graphiti_client

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/store", response_model=MemoryStoreResponse)
async def store_memory(
    request: MemoryStoreRequest,
    client: GraphitiClient = Depends(get_graphiti_client)
):
    """Store a memory entry"""
    try:
        memory_id = await client.store_memory(
            session_id=request.session_id,
            content=request.content,
            memory_type=request.memory_type,
            metadata=request.metadata
        )
        
        return MemoryStoreResponse(
            success=True,
            memory_id=memory_id,
            message="Memory stored successfully"
        )
    
    except Exception as e:
        logger.error(f"Error storing memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/retrieve/{session_id}", response_model=MemoryRetrieveResponse)
async def retrieve_memories(
    session_id: str,
    limit: int = 10,
    memory_type: Optional[str] = None,
    client: GraphitiClient = Depends(get_graphiti_client)
):
    """Retrieve memories for a session"""
    try:
        memories = await client.retrieve_memories(
            session_id=session_id,
            limit=limit,
            memory_type=memory_type
        )
        
        return MemoryRetrieveResponse(
            success=True,
            memories=memories,
            count=len(memories),
            session_id=session_id
        )
    
    except Exception as e:
        logger.error(f"Error retrieving memories: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/search", response_model=MemorySearchResponse)
async def search_memories(
    request: MemorySearchRequest,
    client: GraphitiClient = Depends(get_graphiti_client)
):
    """Search memories by content"""
    try:
        results = await client.search_memories(
            query=request.query,
            session_id=request.session_id,
            limit=request.limit
        )
        
        return MemorySearchResponse(
            success=True,
            results=results,
            count=len(results),
            query=request.query
        )
    
    except Exception as e:
        logger.error(f"Error searching memories: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/session/{session_id}")
async def clear_session(
    session_id: str,
    client: GraphitiClient = Depends(get_graphiti_client)
):
    """Clear all memories for a session"""
    try:
        success = await client.clear_session(session_id)
        
        return {
            "success": success,
            "message": f"Session {session_id} cleared" if success else f"Session {session_id} not found"
        }
    
    except Exception as e:
        logger.error(f"Error clearing session: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Initialize global client when module loads
async def init_client():
    global graphiti_client
    if not graphiti_client:
        graphiti_client = GraphitiClient()
        await graphiti_client.initialize()