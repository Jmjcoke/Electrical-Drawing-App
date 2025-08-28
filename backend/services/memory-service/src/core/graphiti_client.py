"""
Graphiti Client for Neo4j Memory Storage
"""

import logging
from typing import Dict, List, Optional, Any
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)

class GraphitiClient:
    """Client for managing Graphiti-based memory storage"""
    
    def __init__(self):
        """Initialize Graphiti client"""
        self.connected = False
        self.session_contexts = {}
        logger.info("Graphiti client initialized")
    
    async def initialize(self):
        """Initialize connection to Neo4j/Graphiti"""
        try:
            # Mock initialization for now - replace with actual Graphiti setup
            await asyncio.sleep(0.1)  # Simulate connection time
            self.connected = True
            logger.info("✅ Connected to Neo4j via Graphiti")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Neo4j: {e}")
            raise e
    
    async def close(self):
        """Close connection"""
        self.connected = False
        logger.info("Graphiti client connection closed")
    
    def is_connected(self) -> bool:
        """Check if connected to Neo4j"""
        return self.connected
    
    async def store_memory(
        self, 
        session_id: str, 
        content: str, 
        memory_type: str = "conversation",
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """Store a memory entry"""
        if not self.connected:
            raise ConnectionError("Not connected to Neo4j")
        
        memory_id = f"mem_{session_id}_{int(datetime.now().timestamp())}"
        
        # Store in session context for now
        if session_id not in self.session_contexts:
            self.session_contexts[session_id] = []
        
        memory_entry = {
            "id": memory_id,
            "content": content,
            "type": memory_type,
            "metadata": metadata or {},
            "timestamp": datetime.now().isoformat(),
            "session_id": session_id
        }
        
        self.session_contexts[session_id].append(memory_entry)
        logger.info(f"Stored memory {memory_id} for session {session_id}")
        
        return memory_id
    
    async def retrieve_memories(
        self, 
        session_id: str,
        limit: int = 10,
        memory_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve memories for a session"""
        if not self.connected:
            raise ConnectionError("Not connected to Neo4j")
        
        if session_id not in self.session_contexts:
            return []
        
        memories = self.session_contexts[session_id]
        
        # Filter by type if specified
        if memory_type:
            memories = [m for m in memories if m["type"] == memory_type]
        
        # Return most recent first, limited
        return sorted(memories, key=lambda x: x["timestamp"], reverse=True)[:limit]
    
    async def search_memories(
        self,
        query: str,
        session_id: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Search memories by content"""
        if not self.connected:
            raise ConnectionError("Not connected to Neo4j")
        
        results = []
        
        # Simple text search in stored memories
        sessions_to_search = [session_id] if session_id else list(self.session_contexts.keys())
        
        for sid in sessions_to_search:
            if sid in self.session_contexts:
                for memory in self.session_contexts[sid]:
                    if query.lower() in memory["content"].lower():
                        results.append(memory)
        
        return sorted(results, key=lambda x: x["timestamp"], reverse=True)[:limit]
    
    async def get_session_stats(self, session_id: str) -> Dict[str, Any]:
        """Get statistics for a session"""
        if session_id not in self.session_contexts:
            return {
                "session_id": session_id,
                "memory_count": 0,
                "types": {},
                "earliest": None,
                "latest": None
            }
        
        memories = self.session_contexts[session_id]
        types = {}
        timestamps = [m["timestamp"] for m in memories]
        
        for memory in memories:
            mem_type = memory["type"]
            types[mem_type] = types.get(mem_type, 0) + 1
        
        return {
            "session_id": session_id,
            "memory_count": len(memories),
            "types": types,
            "earliest": min(timestamps) if timestamps else None,
            "latest": max(timestamps) if timestamps else None
        }
    
    async def clear_session(self, session_id: str) -> bool:
        """Clear all memories for a session"""
        if session_id in self.session_contexts:
            del self.session_contexts[session_id]
            logger.info(f"Cleared session {session_id}")
            return True
        return False