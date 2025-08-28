"""
Pydantic models for memory service API
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class MemoryStoreRequest(BaseModel):
    """Request model for storing memory"""
    session_id: str = Field(..., description="Session identifier")
    content: str = Field(..., description="Memory content to store")
    memory_type: str = Field(default="conversation", description="Type of memory")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional metadata")

class MemoryStoreResponse(BaseModel):
    """Response model for memory storage"""
    success: bool
    memory_id: str
    message: str

class MemoryRetrieveResponse(BaseModel):
    """Response model for memory retrieval"""
    success: bool
    memories: List[Dict[str, Any]]
    count: int
    session_id: str

class MemorySearchRequest(BaseModel):
    """Request model for memory search"""
    query: str = Field(..., description="Search query")
    session_id: Optional[str] = Field(default=None, description="Optional session filter")
    limit: int = Field(default=10, description="Maximum results to return")

class MemorySearchResponse(BaseModel):
    """Response model for memory search"""
    success: bool
    results: List[Dict[str, Any]]
    count: int
    query: str

class SessionStatsResponse(BaseModel):
    """Response model for session statistics"""
    session_id: str
    memory_count: int
    types: Dict[str, int]
    earliest: Optional[str]
    latest: Optional[str]

class HealthResponse(BaseModel):
    """Response model for health checks"""
    status: str
    timestamp: str
    service: str
    version: str
    dependencies: Optional[Dict[str, str]] = None
    metrics: Optional[Dict[str, Any]] = None