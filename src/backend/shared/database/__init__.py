"""
Database package for ELECTRICAL ORCHESTRATOR
Handles imports and initialization
"""

# Import Base first to avoid circular imports
from .connection import Base, engine, AsyncSessionLocal, get_db, init_database, close_database

# Then import models after Base is available
from .models import *  # noqa: F401, F403

# Export commonly used items
__all__ = [
    'Base',
    'engine', 
    'AsyncSessionLocal',
    'get_db',
    'init_database',
    'close_database',
]