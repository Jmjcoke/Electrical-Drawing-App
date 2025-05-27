# Progress Tracking Database Configuration
# Following BMAD standards for database architecture

import os
import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.engine import URL
from sqlalchemy.pool import StaticPool
from contextlib import asynccontextmanager

from .data_models import Base

logger = logging.getLogger(__name__)

class DatabaseManager:
    """
    Database manager for progress tracking service
    Following BMAD patterns for database management
    """
    
    def __init__(self):
        self.engine = None
        self.session_factory = None
        self._setup_database()
    
    def _setup_database(self):
        """Setup database engine and session factory"""
        # Get database URL from environment
        database_url = os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://postgres:password@localhost:5432/electrical_orchestrator"
        )
        
        # Create async engine
        self.engine = create_async_engine(
            database_url,
            echo=os.getenv("SQL_DEBUG", "false").lower() == "true",
            pool_pre_ping=True,
            pool_size=20,
            max_overflow=0,
            pool_recycle=3600,  # 1 hour
        )
        
        # Create session factory
        self.session_factory = async_sessionmaker(
            bind=self.engine,
            class_=AsyncSession,
            expire_on_commit=False
        )
        
        logger.info("Database manager initialized")
    
    async def create_tables(self):
        """Create all database tables"""
        try:
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables created successfully")
        except Exception as e:
            logger.error(f"Error creating database tables: {e}")
            raise
    
    async def drop_tables(self):
        """Drop all database tables (for testing/development)"""
        try:
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
            logger.info("Database tables dropped successfully")
        except Exception as e:
            logger.error(f"Error dropping database tables: {e}")
            raise
    
    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get database session with proper cleanup"""
        async with self.session_factory() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    
    async def get_session_dependency(self) -> AsyncGenerator[AsyncSession, None]:
        """FastAPI dependency for database sessions"""
        async with self.get_session() as session:
            yield session
    
    async def close(self):
        """Close database connections"""
        if self.engine:
            await self.engine.dispose()
            logger.info("Database connections closed")

# Global database manager instance
db_manager = DatabaseManager()

# FastAPI dependency
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for database sessions"""
    async with db_manager.get_session() as session:
        yield session