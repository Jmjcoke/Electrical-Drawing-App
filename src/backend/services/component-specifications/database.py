"""
Database models and utilities for component specifications service.
In production, this would connect to PostgreSQL or similar database.
"""

from typing import Dict, List, Optional, Any
from sqlalchemy import create_engine, Column, String, Float, Boolean, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
import json
import os

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./component_specifications.db")

# SQLAlchemy setup
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ComponentSpecificationDB(Base):
    """SQLAlchemy model for component specifications"""
    __tablename__ = "component_specifications"
    
    id = Column(String, primary_key=True, index=True)
    part_number = Column(String, unique=True, index=True, nullable=False)
    model_number = Column(String, nullable=True)
    category = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    
    # Manufacturer info (stored as JSON)
    manufacturer = Column(JSON, nullable=False)
    
    # Technical specifications (stored as JSON)
    electrical_ratings = Column(JSON, nullable=True)
    dimensions = Column(JSON, nullable=True)
    mounting_type = Column(String, nullable=True)
    operating_temperature = Column(JSON, nullable=True)
    compliance = Column(JSON, nullable=True)
    
    # Additional data (stored as JSON arrays)
    features = Column(JSON, nullable=True)
    applications = Column(JSON, nullable=True)
    compatible_parts = Column(JSON, nullable=True)
    replacement_parts = Column(JSON, nullable=True)
    
    # Documentation URLs
    datasheet_url = Column(String, nullable=True)
    installation_guide_url = Column(String, nullable=True)
    manual_url = Column(String, nullable=True)
    cad_files = Column(JSON, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    verified = Column(Boolean, default=False)
    confidence_score = Column(Float, default=1.0)

class ManufacturerDB(Base):
    """SQLAlchemy model for manufacturers"""
    __tablename__ = "manufacturers"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    brand = Column(String, nullable=True)
    website = Column(String, nullable=True)
    support_phone = Column(String, nullable=True)
    support_email = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

def create_tables():
    """Create database tables"""
    Base.metadata.create_all(bind=engine)

def get_db() -> Session:
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class ComponentDatabase:
    """Component database operations"""
    
    def __init__(self):
        create_tables()
    
    def create_component(self, db: Session, component_data: Dict[str, Any]) -> ComponentSpecificationDB:
        """Create a new component specification"""
        db_component = ComponentSpecificationDB(**component_data)
        db.add(db_component)
        db.commit()
        db.refresh(db_component)
        return db_component
    
    def get_component(self, db: Session, component_id: str) -> Optional[ComponentSpecificationDB]:
        """Get component by ID"""
        return db.query(ComponentSpecificationDB).filter(ComponentSpecificationDB.id == component_id).first()
    
    def get_component_by_part_number(self, db: Session, part_number: str) -> Optional[ComponentSpecificationDB]:
        """Get component by part number"""
        return db.query(ComponentSpecificationDB).filter(
            ComponentSpecificationDB.part_number.ilike(f"%{part_number}%")
        ).first()
    
    def search_components(
        self, 
        db: Session, 
        filters: Dict[str, Any], 
        page: int = 1, 
        page_size: int = 20
    ) -> tuple[List[ComponentSpecificationDB], int]:
        """Search components with filters and pagination"""
        query = db.query(ComponentSpecificationDB)
        
        # Apply filters
        if filters.get("query"):
            search_term = f"%{filters['query']}%"
            query = query.filter(
                ComponentSpecificationDB.name.ilike(search_term) |
                ComponentSpecificationDB.part_number.ilike(search_term)
            )
        
        if filters.get("category"):
            query = query.filter(ComponentSpecificationDB.category == filters["category"])
        
        if filters.get("manufacturer"):
            # Search in JSON manufacturer field
            query = query.filter(
                ComponentSpecificationDB.manufacturer.op('->>')('name').ilike(f"%{filters['manufacturer']}%")
            )
        
        if filters.get("verified_only"):
            query = query.filter(ComponentSpecificationDB.verified == True)
        
        # Get total count
        total_count = query.count()
        
        # Apply pagination
        offset = (page - 1) * page_size
        components = query.offset(offset).limit(page_size).all()
        
        return components, total_count
    
    def update_component(self, db: Session, component_id: str, update_data: Dict[str, Any]) -> Optional[ComponentSpecificationDB]:
        """Update component specification"""
        db_component = self.get_component(db, component_id)
        if db_component:
            for key, value in update_data.items():
                setattr(db_component, key, value)
            db_component.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(db_component)
        return db_component
    
    def delete_component(self, db: Session, component_id: str) -> bool:
        """Delete component specification"""
        db_component = self.get_component(db, component_id)
        if db_component:
            db.delete(db_component)
            db.commit()
            return True
        return False
    
    def get_manufacturers(self, db: Session) -> List[str]:
        """Get list of all manufacturers"""
        manufacturers = db.query(ComponentSpecificationDB.manufacturer).distinct().all()
        return [json.loads(m[0])["name"] for m in manufacturers if m[0]]
    
    def get_categories(self, db: Session) -> List[str]:
        """Get list of all categories"""
        categories = db.query(ComponentSpecificationDB.category).distinct().all()
        return [cat[0] for cat in categories]
    
    def get_compatible_components(self, db: Session, component_id: str) -> List[ComponentSpecificationDB]:
        """Get components compatible with specified component"""
        component = self.get_component(db, component_id)
        if not component:
            return []
        
        # Find components that list this component's part number in their compatible_parts
        compatible = db.query(ComponentSpecificationDB).filter(
            ComponentSpecificationDB.compatible_parts.op('@>')([component.part_number])
        ).all()
        
        return compatible

# Initialize database instance
component_db = ComponentDatabase()