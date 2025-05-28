"""
Database connection management for ELECTRICAL ORCHESTRATOR
Handles PostgreSQL connections with async SQLAlchemy and connection pooling
"""

import os
import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool, QueuePool
import redis.asyncio as redis

logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/electrical_orchestrator")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Convert sync postgresql URL to async if needed
if DATABASE_URL.startswith("postgresql://"):
    ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
else:
    ASYNC_DATABASE_URL = DATABASE_URL

class Base(DeclarativeBase):
    """Base class for all database models"""
    pass

# Database engine configuration
def create_database_engine():
    """Create async database engine with appropriate configuration"""
    # Use NullPool for testing, QueuePool for production
    pool_class = NullPool if os.getenv("NODE_ENV") == "test" else QueuePool
    
    engine = create_async_engine(
        ASYNC_DATABASE_URL,
        echo=os.getenv("DATABASE_ECHO", "false").lower() == "true",
        future=True,
        poolclass=pool_class,
        pool_size=20 if pool_class == QueuePool else None,
        max_overflow=30 if pool_class == QueuePool else None,
        pool_pre_ping=True,
        pool_recycle=3600,  # Recycle connections after 1 hour
    )
    return engine

# Global engine and session factory
engine = create_database_engine()
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=True,
    autocommit=False,
)

# Redis connection
async def get_redis_client() -> redis.Redis:
    """Get Redis client with connection pooling"""
    return redis.from_url(
        REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        socket_connect_timeout=5,
        socket_timeout=5,
        retry_on_timeout=True,
        health_check_interval=30,
    )

# Database session dependency for FastAPI
async def get_database_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency function to get database session for FastAPI endpoints
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# Health check functions
async def check_database_health() -> dict:
    """Check database connectivity and return health status"""
    try:
        async with AsyncSessionLocal() as session:
            # Simple query to test connection
            from sqlalchemy import text
            result = await session.execute(text("SELECT 1"))
            result.fetchone()
            
            # Get some basic stats
            pool = engine.pool
            pool_status = {
                "size": pool.size() if hasattr(pool, 'size') else "N/A",
                "checked_in": pool.checkedin() if hasattr(pool, 'checkedin') else "N/A",
                "checked_out": pool.checkedout() if hasattr(pool, 'checkedout') else "N/A",
                "invalidated": pool.invalidated() if hasattr(pool, 'invalidated') else "N/A",
            }
            
            return {
                "status": "healthy",
                "database": "postgresql",
                "pool_status": pool_status,
            }
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {
            "status": "unhealthy",
            "database": "postgresql",
            "error": str(e),
        }

async def check_redis_health() -> dict:
    """Check Redis connectivity and return health status"""
    try:
        redis_client = await get_redis_client()
        
        # Test connection with ping
        await redis_client.ping()
        
        # Get some basic info
        info = await redis_client.info()
        
        await redis_client.close()
        
        return {
            "status": "healthy",
            "cache": "redis",
            "version": info.get("redis_version", "unknown"),
            "used_memory": info.get("used_memory_human", "unknown"),
            "connected_clients": info.get("connected_clients", "unknown"),
        }
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return {
            "status": "unhealthy",
            "cache": "redis",
            "error": str(e),
        }

# Database initialization
async def init_database():
    """Initialize database tables"""
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created/verified")

async def close_database():
    """Close database connections"""
    await engine.dispose()
    logger.info("Database connections closed")

# Dependency injection for database sessions
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Provide database session for request"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()