# Progress Tracking Service - Data Models
# Comprehensive data models for field hour logging and compliance

from sqlalchemy import Column, String, DateTime, Decimal, Integer, Boolean, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, date, time
from decimal import Decimal as PythonDecimal
from enum import Enum
import uuid

Base = declarative_base()

# Enums for consistent data types
class WorkType(str, Enum):
    INSTALLATION = "installation"
    MAINTENANCE = "maintenance"
    TROUBLESHOOTING = "troubleshooting"
    INSPECTION = "inspection"
    COMMISSIONING = "commissioning"
    REPAIR = "repair"
    TESTING = "testing"
    DOCUMENTATION = "documentation"

class EntryStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"

class VerificationMethod(str, Enum):
    MANUAL = "manual"
    GPS = "gps"
    BEACON = "beacon"
    NFC = "nfc"
    QR_CODE = "qr_code"
    FACIAL_RECOGNITION = "facial_recognition"

class ComplianceStatus(str, Enum):
    PASSED = "passed"
    FAILED = "failed"
    WARNING = "warning"
    PENDING = "pending"
    NOT_APPLICABLE = "not_applicable"

# SQLAlchemy Database Models
class HourLogTable(Base):
    """Database table for hour log entries"""
    __tablename__ = "hour_logs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    circuit_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    component_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    
    # Time tracking
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=True)
    hours_worked = Column(Decimal(precision=4, scale=2), nullable=True)
    break_time = Column(Decimal(precision=4, scale=2), default=0.0)
    overtime_hours = Column(Decimal(precision=4, scale=2), default=0.0)
    
    # Work details
    work_type = Column(String(50), nullable=False)
    work_description = Column(Text, nullable=False)
    completion_percentage = Column(Integer, default=0)
    quality_rating = Column(Integer, nullable=True)
    
    # Location and environmental
    gps_coordinates = Column(JSON, nullable=True)
    site_conditions = Column(Text, nullable=True)
    weather_conditions = Column(JSON, nullable=True)
    safety_notes = Column(Text, nullable=True)
    
    # Documentation
    photos = Column(ARRAY(String), default=[])
    voice_notes = Column(ARRAY(String), default=[])
    documents = Column(ARRAY(String), default=[])
    materials_used = Column(JSON, default=[])
    tools_used = Column(JSON, default=[])
    
    # Status and metadata
    status = Column(String(20), default="active", index=True)
    offline_entry = Column(Boolean, default=False)
    sync_timestamp = Column(DateTime(timezone=True), nullable=True)
    supervisor_approval = Column(Boolean, default=False)
    approval_timestamp = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(UUID(as_uuid=True), nullable=True)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(UUID(as_uuid=True), nullable=True)
    updated_by = Column(UUID(as_uuid=True), nullable=True)

class TimeClockTable(Base):
    """Database table for time clock entries"""
    __tablename__ = "time_clock_entries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    entry_type = Column(String(20), nullable=False)  # clock_in, clock_out, break_start, break_end
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Location and verification
    gps_coordinates = Column(JSON, nullable=True)
    verification_method = Column(String(20), default="manual")
    verification_data = Column(JSON, nullable=True)  # Additional verification info
    location_verified = Column(Boolean, default=False)
    
    # Notes and documentation
    notes = Column(Text, nullable=True)
    photo_verification = Column(String(255), nullable=True)
    supervisor_override = Column(Boolean, default=False)
    override_reason = Column(Text, nullable=True)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)

class ProductivityMetricsTable(Base):
    """Database table for productivity metrics"""
    __tablename__ = "productivity_metrics"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    date = Column(DateTime(timezone=True), nullable=False, index=True)
    
    # Time metrics
    total_hours = Column(Decimal(precision=4, scale=2), nullable=False)
    productive_hours = Column(Decimal(precision=4, scale=2), nullable=False)
    break_hours = Column(Decimal(precision=4, scale=2), default=0.0)
    overtime_hours = Column(Decimal(precision=4, scale=2), default=0.0)
    
    # Performance metrics
    efficiency_rating = Column(Decimal(precision=3, scale=2), nullable=True)
    quality_score = Column(Decimal(precision=3, scale=2), nullable=True)
    completed_tasks = Column(Integer, default=0)
    rework_hours = Column(Decimal(precision=4, scale=2), default=0.0)
    
    # Calculated metrics
    hourly_task_rate = Column(Decimal(precision=5, scale=2), nullable=True)
    quality_efficiency = Column(Decimal(precision=3, scale=2), nullable=True)
    cost_per_hour = Column(Decimal(precision=8, scale=2), nullable=True)
    
    # Environmental factors
    weather_impact = Column(JSON, nullable=True)
    site_difficulty_rating = Column(Integer, nullable=True)
    crew_size = Column(Integer, nullable=True)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    calculated_at = Column(DateTime(timezone=True), server_default=func.now())

class ComplianceCheckTable(Base):
    """Database table for compliance checks"""
    __tablename__ = "compliance_checks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entry_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    project_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    check_type = Column(String(50), nullable=False, index=True)
    status = Column(String(20), nullable=False, index=True)
    severity = Column(String(20), default="info")  # info, warning, error, critical
    
    details = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=True)
    auto_validated = Column(Boolean, default=True)
    
    # Resolution tracking
    resolved = Column(Boolean, default=False)
    resolution_notes = Column(Text, nullable=True)
    resolved_by = Column(UUID(as_uuid=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Audit fields
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(UUID(as_uuid=True), nullable=True)

# Pydantic Response Models
class HourLogResponse(BaseModel):
    """Response model for hour log entries"""
    id: str
    user_id: str
    project_id: str
    circuit_id: Optional[str] = None
    component_id: Optional[str] = None
    
    # Time tracking
    start_time: datetime
    end_time: Optional[datetime] = None
    hours_worked: Optional[PythonDecimal] = None
    break_time: Optional[PythonDecimal] = None
    
    # Work details
    work_type: WorkType
    work_description: str
    completion_percentage: int = 0
    quality_rating: Optional[int] = None
    
    # Location and compliance
    gps_coordinates: Optional[Dict[str, float]] = None
    site_conditions: Optional[str] = None
    safety_notes: Optional[str] = None
    
    # Documentation
    photos: List[str] = []
    voice_notes: List[str] = []
    materials_used: List[Dict[str, Any]] = []
    
    # Status and metadata
    status: EntryStatus
    offline_entry: bool = False
    sync_timestamp: Optional[datetime] = None
    supervisor_approval: bool = False
    
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class HourLogCreate(BaseModel):
    """Create model for hour log entries"""
    user_id: str
    project_id: str
    circuit_id: Optional[str] = None
    component_id: Optional[str] = None
    
    # Time tracking
    start_time: datetime
    end_time: Optional[datetime] = None
    hours_worked: Optional[PythonDecimal] = None
    break_time: Optional[PythonDecimal] = Field(default=PythonDecimal('0'))
    
    # Work details
    work_type: WorkType
    work_description: str
    completion_percentage: int = Field(default=0, ge=0, le=100)
    quality_rating: Optional[int] = Field(None, ge=1, le=5)
    
    # Location and compliance
    gps_coordinates: Optional[Dict[str, float]] = None
    site_conditions: Optional[str] = None
    safety_notes: Optional[str] = None
    
    # Documentation
    materials_used: List[Dict[str, Any]] = []
    tools_used: List[Dict[str, Any]] = []
    
    @validator('hours_worked')
    def validate_hours(cls, v):
        if v is not None and (v < 0 or v > 24):
            raise ValueError('Hours worked must be between 0 and 24')
        return v
    
    @validator('gps_coordinates')
    def validate_gps(cls, v):
        if v is not None:
            required_keys = {'latitude', 'longitude'}
            if not required_keys.issubset(v.keys()):
                raise ValueError('GPS coordinates must include latitude and longitude')
            if not (-90 <= v['latitude'] <= 90):
                raise ValueError('Latitude must be between -90 and 90')
            if not (-180 <= v['longitude'] <= 180):
                raise ValueError('Longitude must be between -180 and 180')
        return v

class TimeClockResponse(BaseModel):
    """Response model for time clock entries"""
    id: str
    user_id: str
    project_id: str
    entry_type: str
    timestamp: datetime
    gps_coordinates: Optional[Dict[str, float]] = None
    verification_method: VerificationMethod
    location_verified: bool = False
    notes: Optional[str] = None
    photo_verification: Optional[str] = None
    
    created_at: datetime
    
    class Config:
        from_attributes = True

class ProductivityMetricsResponse(BaseModel):
    """Response model for productivity metrics"""
    id: str
    user_id: str
    project_id: str
    date: datetime
    
    # Time metrics
    total_hours: PythonDecimal
    productive_hours: PythonDecimal
    break_hours: PythonDecimal = PythonDecimal('0')
    overtime_hours: PythonDecimal = PythonDecimal('0')
    
    # Performance metrics
    efficiency_rating: Optional[float] = None
    quality_score: Optional[float] = None
    completed_tasks: int = 0
    rework_hours: PythonDecimal = PythonDecimal('0')
    
    # Calculated metrics
    hourly_task_rate: Optional[float] = None
    quality_efficiency: Optional[float] = None
    cost_per_hour: Optional[PythonDecimal] = None
    
    created_at: datetime
    
    class Config:
        from_attributes = True

class ComplianceCheckResponse(BaseModel):
    """Response model for compliance checks"""
    id: str
    entry_id: str
    user_id: str
    project_id: str
    check_type: str
    status: ComplianceStatus
    severity: str
    details: str
    recommendation: Optional[str] = None
    auto_validated: bool = True
    resolved: bool = False
    resolution_notes: Optional[str] = None
    
    created_at: datetime
    
    class Config:
        from_attributes = True

# API Request Models
class WorkSessionStart(BaseModel):
    """Request model for starting work session"""
    user_id: str
    project_id: str
    circuit_id: Optional[str] = None
    component_id: Optional[str] = None
    gps_coordinates: Optional[Dict[str, float]] = None
    work_type: WorkType = WorkType.INSTALLATION
    initial_notes: Optional[str] = None

class WorkSessionEnd(BaseModel):
    """Request model for ending work session"""
    user_id: str
    work_description: str
    completion_percentage: int = Field(default=100, ge=0, le=100)
    quality_rating: Optional[int] = Field(None, ge=1, le=5)
    final_notes: Optional[str] = None
    materials_used: List[Dict[str, Any]] = []
    safety_incidents: List[Dict[str, Any]] = []

class OfflineSyncRequest(BaseModel):
    """Request model for offline sync"""
    entries: List[HourLogCreate]
    device_id: str
    sync_timestamp: datetime
    conflict_resolution: str = "server_wins"  # server_wins, client_wins, merge

class TimeClockEntry(BaseModel):
    """Request model for time clock operations"""
    user_id: str
    project_id: str
    entry_type: str  # clock_in, clock_out, break_start, break_end
    gps_coordinates: Optional[Dict[str, float]] = None
    verification_method: VerificationMethod = VerificationMethod.MANUAL
    notes: Optional[str] = None

# Analytics and Reporting Models
class ProductivitySummary(BaseModel):
    """Summary productivity metrics"""
    user_id: str
    period_start: date
    period_end: date
    
    total_hours: PythonDecimal
    productive_hours: PythonDecimal
    efficiency_average: float
    quality_average: float
    tasks_completed: int
    
    trends: Dict[str, str]  # efficiency_trend, quality_trend, etc.
    benchmarks: Dict[str, float]  # comparisons to team/project averages
    recommendations: List[str]

class ComplianceSummary(BaseModel):
    """Summary compliance metrics"""
    user_id: str
    project_id: str
    period_start: date
    period_end: date
    
    total_checks: int
    passed_checks: int
    failed_checks: int
    warnings: int
    
    compliance_rate: float
    critical_issues: List[Dict[str, Any]]
    recommendations: List[str]

class RealTimeStatus(BaseModel):
    """Real-time status for dashboards"""
    project_id: str
    active_users: int
    total_hours_today: PythonDecimal
    completion_rate: float
    quality_average: float
    
    active_sessions: List[Dict[str, Any]]
    recent_completions: List[Dict[str, Any]]
    alerts: List[Dict[str, Any]]
    
    last_updated: datetime