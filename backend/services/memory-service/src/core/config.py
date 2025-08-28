"""
Configuration settings for Memory Service
"""

import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application settings"""
    
    # Server settings
    port: int = int(os.getenv("PORT", 8002))
    host: str = os.getenv("HOST", "0.0.0.0")
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    
    # CORS settings
    allowed_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://localhost:3002",
        "http://localhost:3003"
    ]
    
    # Neo4j/Graphiti settings
    neo4j_uri: str = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    neo4j_username: str = os.getenv("NEO4J_USERNAME", "neo4j")
    neo4j_password: str = os.getenv("NEO4J_PASSWORD", "memory123")
    
    # Graphiti settings
    graphiti_model: str = os.getenv("GRAPHITI_MODEL", "gpt-4")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    
    # Memory settings
    max_memory_entries: int = int(os.getenv("MAX_MEMORY_ENTRIES", 10000))
    memory_retention_days: int = int(os.getenv("MEMORY_RETENTION_DAYS", 30))
    
    # Performance settings
    connection_pool_size: int = int(os.getenv("CONNECTION_POOL_SIZE", 10))
    query_timeout: int = int(os.getenv("QUERY_TIMEOUT", 30))
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Global settings instance
settings = Settings()