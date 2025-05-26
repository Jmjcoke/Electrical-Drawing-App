"""
Historical Data Database
Story 4.1: Database layer for historical project data storage and retrieval
"""

from sqlalchemy import (
    create_engine, Column, String, Integer, Float, DateTime, Date, Boolean, 
    Text, JSON, ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime, date
import json
import logging
import asyncio
from contextlib import asynccontextmanager

from .data_models import (
    HistoricalProject, ImportJob, DataQualityReport, ProjectSearchFilters,
    ProjectSummary, ImportResult
)

logger = logging.getLogger(__name__)

# SQLAlchemy models
Base = declarative_base()

class DBHistoricalProject(Base):
    """Database model for historical projects"""
    __tablename__ = 'historical_projects'
    
    # Primary identification
    project_id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_name = Column(String, nullable=False, index=True)
    project_number = Column(String, index=True)
    client_name = Column(String, nullable=False, index=True)
    
    # Classification
    project_type = Column(String, nullable=False, index=True)
    industry_category = Column(String, nullable=False, index=True)
    complexity_level = Column(String, nullable=False, index=True)
    
    # Location
    country = Column(String, nullable=False, index=True)
    state_province = Column(String, nullable=False, index=True)
    city = Column(String, nullable=False)
    postal_code = Column(String)
    region = Column(String, index=True)
    coordinates = Column(JSON)  # {"lat": float, "lng": float}
    
    # Timeline
    planned_start_date = Column(Date, nullable=False, index=True)
    planned_end_date = Column(Date, nullable=False, index=True)
    actual_start_date = Column(Date, index=True)
    actual_end_date = Column(Date, index=True)
    
    # Financial data
    total_cost = Column(Float, nullable=False, index=True)
    labor_cost = Column(Float, nullable=False)
    material_cost = Column(Float, nullable=False)
    equipment_cost = Column(Float, default=0.0)
    overhead_cost = Column(Float, default=0.0)
    profit_margin = Column(Float)
    currency = Column(String, default='USD')
    cost_date = Column(DateTime, nullable=False)
    inflation_adjusted = Column(Boolean, default=False)
    
    # Status and progress
    status = Column(String, nullable=False, index=True)
    completion_percentage = Column(Float, default=0.0)
    
    # Quality metrics
    overall_quality_score = Column(String, nullable=False)
    rework_hours = Column(Float, default=0.0)
    defect_rate = Column(Float, default=0.0)
    safety_incidents = Column(Integer, default=0)
    client_satisfaction = Column(Float)
    nec_compliance_score = Column(Float)
    
    # Risk factors
    weather_delays = Column(Float, default=0.0)
    material_delays = Column(Float, default=0.0)
    permit_delays = Column(Float, default=0.0)
    change_orders = Column(Integer, default=0)
    change_order_impact = Column(Float, default=0.0)
    
    # Metadata
    description = Column(Text)
    tags = Column(ARRAY(String), default=[])
    lessons_learned = Column(Text)
    best_practices = Column(Text)
    custom_fields = Column(JSON)
    
    # Import metadata
    import_source = Column(String, nullable=False)
    import_date = Column(DateTime, default=datetime.now)
    import_job_id = Column(String, ForeignKey('import_jobs.job_id'))
    data_quality_score = Column(Float, nullable=False)
    
    # Relationships
    labor_hours = relationship("DBLaborHours", back_populates="project")
    materials = relationship("DBMaterialItem", back_populates="project")
    equipment = relationship("DBEquipmentUsage", back_populates="project")
    phases = relationship("DBProjectPhase", back_populates="project")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_project_search', 'project_type', 'industry_category', 'total_cost'),
        Index('idx_project_timeline', 'planned_start_date', 'planned_end_date'),
        Index('idx_project_location', 'country', 'state_province', 'region'),
        Index('idx_project_quality', 'data_quality_score', 'overall_quality_score'),
    )

class DBLaborHours(Base):
    """Database model for labor hours"""
    __tablename__ = 'labor_hours'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey('historical_projects.project_id'), nullable=False)
    
    role = Column(String, nullable=False)
    planned_hours = Column(Float, nullable=False)
    actual_hours = Column(Float, nullable=False)
    hourly_rate = Column(Float, nullable=False)
    overtime_hours = Column(Float, default=0.0)
    efficiency_factor = Column(Float)
    
    project = relationship("DBHistoricalProject", back_populates="labor_hours")
    
    __table_args__ = (
        Index('idx_labor_role', 'role', 'project_id'),
    )

class DBMaterialItem(Base):
    """Database model for material items"""
    __tablename__ = 'material_items'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey('historical_projects.project_id'), nullable=False)
    
    description = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, nullable=False)
    unit_cost = Column(Float, nullable=False)
    total_cost = Column(Float, nullable=False)
    supplier = Column(String)
    category = Column(String, index=True)
    specification = Column(Text)
    
    project = relationship("DBHistoricalProject", back_populates="materials")

class DBEquipmentUsage(Base):
    """Database model for equipment usage"""
    __tablename__ = 'equipment_usage'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey('historical_projects.project_id'), nullable=False)
    
    equipment_type = Column(String, nullable=False, index=True)
    description = Column(String, nullable=False)
    usage_hours = Column(Float, nullable=False)
    rental_rate = Column(Float)
    total_cost = Column(Float, nullable=False)
    efficiency_impact = Column(Float)
    
    project = relationship("DBHistoricalProject", back_populates="equipment")

class DBProjectPhase(Base):
    """Database model for project phases"""
    __tablename__ = 'project_phases'
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String, ForeignKey('historical_projects.project_id'), nullable=False)
    
    phase_name = Column(String, nullable=False)
    planned_start = Column(Date, nullable=False)
    planned_end = Column(Date, nullable=False)
    actual_start = Column(Date)
    actual_end = Column(Date)
    status = Column(String, nullable=False)
    completion_percentage = Column(Float, default=0.0)
    
    project = relationship("DBHistoricalProject", back_populates="phases")

class DBImportJob(Base):
    """Database model for import jobs"""
    __tablename__ = 'import_jobs'
    
    job_id = Column(String, primary_key=True)
    job_name = Column(String, nullable=False)
    import_type = Column(String, nullable=False)
    source_info = Column(JSON)
    
    # Status
    status = Column(String, default='pending')
    progress_percentage = Column(Float, default=0.0)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    
    # Results
    projects_imported = Column(Integer, default=0)
    errors_count = Column(Integer, default=0)
    warnings_count = Column(Integer, default=0)
    error_details = Column(ARRAY(String), default=[])
    warning_details = Column(ARRAY(String), default=[])
    
    # Metadata
    created_by = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

class DBDataQualityReport(Base):
    """Database model for data quality reports"""
    __tablename__ = 'data_quality_reports'
    
    report_id = Column(String, primary_key=True)
    import_job_id = Column(String, ForeignKey('import_jobs.job_id'), nullable=False)
    
    overall_score = Column(Float, nullable=False)
    projects_analyzed = Column(Integer, nullable=False)
    
    completeness_score = Column(Float, nullable=False)
    accuracy_score = Column(Float, nullable=False)
    consistency_score = Column(Float, nullable=False)
    validity_score = Column(Float, nullable=False)
    
    issues = Column(JSON)  # Serialized list of issues
    auto_fixes = Column(ARRAY(String), default=[])
    manual_review_items = Column(ARRAY(String), default=[])
    recommendations = Column(ARRAY(String), default=[])
    
    analysis_date = Column(DateTime, default=datetime.now)
    analysis_duration = Column(Float)

class HistoricalDataDatabase:
    """Database interface for historical data"""
    
    def __init__(self, database_url: str = "postgresql://user:password@localhost/electrical_orchestrator"):
        self.database_url = database_url
        self.engine = None
        self.SessionLocal = None
        self.initialized = False
    
    async def initialize(self):
        """Initialize database connection and create tables"""
        logger.info("Initializing Historical Data Database...")
        
        # Create engine
        self.engine = create_engine(
            self.database_url,
            pool_size=20,
            max_overflow=30,
            pool_pre_ping=True,
            echo=False  # Set to True for SQL debugging
        )
        
        # Create session factory
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        
        # Create tables
        Base.metadata.create_all(bind=self.engine)
        
        self.initialized = True
        logger.info("✓ Historical Data Database initialized")
    
    async def health_check(self) -> Dict[str, Any]:
        """Database health check"""
        try:
            with self.SessionLocal() as session:
                # Simple query to test connection
                result = session.execute("SELECT 1")
                return {
                    "status": "healthy",
                    "connection": "active",
                    "tables_created": True
                }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    @asynccontextmanager
    async def get_session(self):
        """Get database session context manager"""
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
    
    async def store_import_results(self, 
                                  job_id: str, 
                                  import_result: ImportResult, 
                                  quality_report: DataQualityReport):
        """Store import results in database"""
        async with self.get_session() as session:
            # Store projects
            for project in import_result.projects:
                db_project = self._project_to_db_model(project, job_id)
                session.add(db_project)
                
                # Store related data
                for labor_hour in project.total_labor_hours:
                    db_labor = self._labor_hours_to_db_model(labor_hour, project.project_id)
                    session.add(db_labor)
                
                for material in project.materials:
                    db_material = self._material_to_db_model(material, project.project_id)
                    session.add(db_material)
                
                for equipment in project.equipment:
                    db_equipment = self._equipment_to_db_model(equipment, project.project_id)
                    session.add(db_equipment)
                
                for phase in project.phases:
                    db_phase = self._phase_to_db_model(phase, project.project_id)
                    session.add(db_phase)
            
            # Store quality report
            db_quality_report = DBDataQualityReport(
                report_id=quality_report.report_id,
                import_job_id=job_id,
                overall_score=quality_report.overall_score,
                projects_analyzed=quality_report.projects_analyzed,
                completeness_score=quality_report.completeness_score,
                accuracy_score=quality_report.accuracy_score,
                consistency_score=quality_report.consistency_score,
                validity_score=quality_report.validity_score,
                issues=[issue.dict() for issue in quality_report.issues],
                auto_fixes=quality_report.auto_fixes,
                manual_review_items=quality_report.manual_review_items,
                recommendations=quality_report.recommendations,
                analysis_duration=quality_report.analysis_duration
            )
            session.add(db_quality_report)
    
    async def search_projects(self, 
                             filters: Dict[str, Any],
                             date_range: Optional[Dict[str, str]] = None,
                             project_types: Optional[List[str]] = None,
                             cost_range: Optional[Dict[str, float]] = None,
                             limit: int = 100,
                             offset: int = 0) -> Dict[str, Any]:
        """Search historical projects with filters"""
        async with self.get_session() as session:
            query = session.query(DBHistoricalProject)
            
            # Apply filters
            if project_types:
                query = query.filter(DBHistoricalProject.project_type.in_(project_types))
            
            if date_range:
                if 'start' in date_range:
                    query = query.filter(DBHistoricalProject.planned_start_date >= date_range['start'])
                if 'end' in date_range:
                    query = query.filter(DBHistoricalProject.planned_end_date <= date_range['end'])
            
            if cost_range:
                if 'min' in cost_range:
                    query = query.filter(DBHistoricalProject.total_cost >= cost_range['min'])
                if 'max' in cost_range:
                    query = query.filter(DBHistoricalProject.total_cost <= cost_range['max'])
            
            # Apply additional filters from filters dict
            for field, value in filters.items():
                if hasattr(DBHistoricalProject, field):
                    if isinstance(value, list):
                        query = query.filter(getattr(DBHistoricalProject, field).in_(value))
                    else:
                        query = query.filter(getattr(DBHistoricalProject, field) == value)
            
            # Get total count
            total_count = query.count()
            
            # Apply pagination
            projects = query.offset(offset).limit(limit).all()
            
            # Convert to ProjectSummary objects
            project_summaries = [
                ProjectSummary(
                    project_id=p.project_id,
                    project_name=p.project_name,
                    client_name=p.client_name,
                    project_type=p.project_type,
                    industry_category=p.industry_category,
                    complexity_level=p.complexity_level,
                    location={
                        "country": p.country,
                        "state_province": p.state_province,
                        "city": p.city,
                        "postal_code": p.postal_code,
                        "region": p.region
                    },
                    total_cost=p.total_cost,
                    duration_days=(p.actual_end_date - p.actual_start_date).days if p.actual_end_date and p.actual_start_date else None,
                    status=p.status,
                    completion_percentage=p.completion_percentage,
                    data_quality_score=p.data_quality_score,
                    import_date=p.import_date
                )
                for p in projects
            ]
            
            return {
                "projects": [p.dict() for p in project_summaries],
                "total_count": total_count,
                "filtered_count": len(projects)
            }
    
    async def get_project_by_id(self, project_id: str) -> Optional[HistoricalProject]:
        """Get project by ID"""
        async with self.get_session() as session:
            db_project = session.query(DBHistoricalProject).filter(
                DBHistoricalProject.project_id == project_id
            ).first()
            
            if not db_project:
                return None
            
            return self._db_model_to_project(db_project)
    
    async def get_import_job(self, job_id: str) -> Optional[ImportJob]:
        """Get import job by ID"""
        async with self.get_session() as session:
            db_job = session.query(DBImportJob).filter(
                DBImportJob.job_id == job_id
            ).first()
            
            if not db_job:
                return None
            
            return ImportJob(
                job_id=db_job.job_id,
                job_name=db_job.job_name,
                import_type=db_job.import_type,
                source_info=db_job.source_info,
                status=db_job.status,
                progress_percentage=db_job.progress_percentage,
                start_time=db_job.start_time,
                end_time=db_job.end_time,
                projects_imported=db_job.projects_imported,
                errors_count=db_job.errors_count,
                warnings_count=db_job.warnings_count,
                error_details=db_job.error_details,
                warning_details=db_job.warning_details,
                created_by=db_job.created_by,
                created_at=db_job.created_at,
                updated_at=db_job.updated_at
            )
    
    async def update_job_status(self, job_id: str, status: str, message: str = None):
        """Update import job status"""
        async with self.get_session() as session:
            db_job = session.query(DBImportJob).filter(
                DBImportJob.job_id == job_id
            ).first()
            
            if db_job:
                db_job.status = status
                db_job.updated_at = datetime.now()
                
                if status == "processing" and not db_job.start_time:
                    db_job.start_time = datetime.now()
                elif status in ["completed", "failed"]:
                    db_job.end_time = datetime.now()
                
                if message and status == "failed":
                    if not db_job.error_details:
                        db_job.error_details = []
                    db_job.error_details.append(message)
    
    async def get_active_import_count(self) -> int:
        """Get count of active import jobs"""
        async with self.get_session() as session:
            return session.query(DBImportJob).filter(
                DBImportJob.status.in_(['pending', 'processing'])
            ).count()
    
    async def get_active_jobs(self) -> List[Dict[str, Any]]:
        """Get list of active import jobs"""
        async with self.get_session() as session:
            jobs = session.query(DBImportJob).filter(
                DBImportJob.status.in_(['pending', 'processing'])
            ).all()
            
            return [
                {
                    "job_id": job.job_id,
                    "job_name": job.job_name,
                    "status": job.status,
                    "progress_percentage": job.progress_percentage,
                    "start_time": job.start_time.isoformat() if job.start_time else None,
                    "created_at": job.created_at.isoformat()
                }
                for job in jobs
            ]
    
    async def get_import_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get import job status"""
        job = await self.get_import_job(job_id)
        if not job:
            return None
        
        return {
            "job_id": job.job_id,
            "status": job.status,
            "progress_percentage": job.progress_percentage,
            "projects_imported": job.projects_imported,
            "errors_count": job.errors_count,
            "warnings_count": job.warnings_count,
            "start_time": job.start_time.isoformat() if job.start_time else None,
            "end_time": job.end_time.isoformat() if job.end_time else None,
            "duration": (job.end_time - job.start_time).total_seconds() if job.end_time and job.start_time else None
        }
    
    async def get_quality_report(self, import_job_id: str) -> Optional[Dict[str, Any]]:
        """Get quality report for import job"""
        async with self.get_session() as session:
            db_report = session.query(DBDataQualityReport).filter(
                DBDataQualityReport.import_job_id == import_job_id
            ).first()
            
            if not db_report:
                return None
            
            return {
                "report_id": db_report.report_id,
                "overall_score": db_report.overall_score,
                "projects_analyzed": db_report.projects_analyzed,
                "completeness_score": db_report.completeness_score,
                "accuracy_score": db_report.accuracy_score,
                "consistency_score": db_report.consistency_score,
                "validity_score": db_report.validity_score,
                "issues": db_report.issues,
                "auto_fixes": db_report.auto_fixes,
                "manual_review_items": db_report.manual_review_items,
                "recommendations": db_report.recommendations,
                "analysis_date": db_report.analysis_date.isoformat(),
                "analysis_duration": db_report.analysis_duration
            }
    
    def _project_to_db_model(self, project: HistoricalProject, job_id: str) -> DBHistoricalProject:
        """Convert HistoricalProject to database model"""
        return DBHistoricalProject(
            project_id=project.project_id,
            project_name=project.project_name,
            project_number=project.project_number,
            client_name=project.client_name,
            project_type=project.classification.primary_type.value,
            industry_category=project.classification.industry_category.value,
            complexity_level=project.classification.complexity_level.value,
            country=project.location.country,
            state_province=project.location.state_province,
            city=project.location.city,
            postal_code=project.location.postal_code,
            region=project.location.region,
            coordinates=project.location.coordinates,
            planned_start_date=project.planned_start_date,
            planned_end_date=project.planned_end_date,
            actual_start_date=project.actual_start_date,
            actual_end_date=project.actual_end_date,
            total_cost=project.cost_data.total_cost,
            labor_cost=project.cost_data.labor_cost,
            material_cost=project.cost_data.material_cost,
            equipment_cost=project.cost_data.equipment_cost,
            overhead_cost=project.cost_data.overhead_cost,
            profit_margin=project.cost_data.profit_margin,
            currency=project.cost_data.currency,
            cost_date=project.cost_data.cost_date,
            inflation_adjusted=project.cost_data.inflation_adjusted,
            status=project.status.value,
            completion_percentage=project.completion_percentage,
            overall_quality_score=project.quality_metrics.overall_quality_score.value,
            rework_hours=project.quality_metrics.rework_hours,
            defect_rate=project.quality_metrics.defect_rate,
            safety_incidents=project.quality_metrics.safety_incidents,
            client_satisfaction=project.quality_metrics.client_satisfaction,
            nec_compliance_score=project.quality_metrics.nec_compliance_score,
            weather_delays=project.risk_factors.weather_delays,
            material_delays=project.risk_factors.material_delays,
            permit_delays=project.risk_factors.permit_delays,
            change_orders=project.risk_factors.change_orders,
            change_order_impact=project.risk_factors.change_order_impact,
            description=project.description,
            tags=project.classification.tags,
            lessons_learned=project.lessons_learned,
            best_practices=project.best_practices,
            custom_fields=project.custom_fields,
            import_source=project.import_source,
            import_date=project.import_date,
            import_job_id=job_id,
            data_quality_score=project.data_quality_score
        )
    
    def _labor_hours_to_db_model(self, labor_hour, project_id: str) -> DBLaborHours:
        """Convert LaborHours to database model"""
        return DBLaborHours(
            project_id=project_id,
            role=labor_hour.role.value,
            planned_hours=labor_hour.planned_hours,
            actual_hours=labor_hour.actual_hours,
            hourly_rate=labor_hour.hourly_rate,
            overtime_hours=labor_hour.overtime_hours,
            efficiency_factor=labor_hour.efficiency_factor
        )
    
    def _material_to_db_model(self, material, project_id: str) -> DBMaterialItem:
        """Convert MaterialItem to database model"""
        return DBMaterialItem(
            project_id=project_id,
            description=material.description,
            quantity=material.quantity,
            unit=material.unit,
            unit_cost=material.unit_cost,
            total_cost=material.total_cost,
            supplier=material.supplier,
            category=material.category,
            specification=material.specification
        )
    
    def _equipment_to_db_model(self, equipment, project_id: str) -> DBEquipmentUsage:
        """Convert EquipmentUsage to database model"""
        return DBEquipmentUsage(
            project_id=project_id,
            equipment_type=equipment.equipment_type,
            description=equipment.description,
            usage_hours=equipment.usage_hours,
            rental_rate=equipment.rental_rate,
            total_cost=equipment.total_cost,
            efficiency_impact=equipment.efficiency_impact
        )
    
    def _phase_to_db_model(self, phase, project_id: str) -> DBProjectPhase:
        """Convert ProjectPhase to database model"""
        return DBProjectPhase(
            project_id=project_id,
            phase_name=phase.phase_name,
            planned_start=phase.planned_start,
            planned_end=phase.planned_end,
            actual_start=phase.actual_start,
            actual_end=phase.actual_end,
            status=phase.status.value,
            completion_percentage=phase.completion_percentage
        )
    
    def _db_model_to_project(self, db_project: DBHistoricalProject) -> HistoricalProject:
        """Convert database model to HistoricalProject"""
        # This is a complex conversion - implement as needed
        # For now, return a basic implementation
        pass
    
    async def close(self):
        """Close database connections"""
        if self.engine:
            self.engine.dispose()
        logger.info("Historical Data Database connections closed")
