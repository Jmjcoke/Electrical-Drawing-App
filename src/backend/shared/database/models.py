"""
Database models for ELECTRICAL ORCHESTRATOR
Defines core entities: Users, Projects, Roles, and foundational tables
"""

import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, DateTime, Boolean, Text, ForeignKey, Integer, Float, Enum, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
import enum

from .connection import Base

# Enums for user roles and permissions
class UserRole(str, enum.Enum):
    SYSTEM_ADMIN = "system_admin"
    ELECTRICAL_LEAD = "electrical_lead"
    FCO_LEAD = "fco_lead"
    PROJECT_MANAGER = "project_manager"
    FOREMAN = "foreman"
    GENERAL_FOREMAN = "general_foreman"
    SUPERINTENDENT = "superintendent"
    ELECTRICIAN = "electrician"
    FCO_TECHNICIAN = "fco_technician"

class ProjectStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    ARCHIVED = "archived"

class ProjectPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class ProjectType(str, enum.Enum):
    BROWNFIELD = "brownfield"
    GREENFIELD = "greenfield"
    MAINTENANCE = "maintenance"
    UPGRADE = "upgrade"

class IndustrySector(str, enum.Enum):
    OIL_GAS = "oil_gas"
    MINING = "mining"
    INDUSTRIAL = "industrial"
    RENEWABLE = "renewable"

class FacilityType(str, enum.Enum):
    REFINERY = "refinery"
    PLATFORM = "platform"
    PLANT = "plant"
    TERMINAL = "terminal"
    WELLHEAD = "wellhead"

class DrawingStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    ANALYZED = "analyzed"
    FAILED = "failed"

# Base model with common fields
class BaseModel(Base):
    __abstract__ = True
    
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

# User management models
class User(BaseModel):
    __tablename__ = "users"
    
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Nullable for SSO users
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False, default=UserRole.ELECTRICIAN)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_sso_user: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    company: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    created_projects: Mapped[List["Project"]] = relationship(
        "Project", 
        back_populates="created_by_user",
        foreign_keys="Project.created_by"
    )
    assigned_projects: Mapped[List["ProjectTeamMember"]] = relationship(
        "ProjectTeamMember", 
        back_populates="user"
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship("AuditLog", back_populates="user")

# Project management models
class Project(BaseModel):
    __tablename__ = "projects"
    
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus), 
        nullable=False, 
        default=ProjectStatus.DRAFT
    )
    client_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    target_completion_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_completion_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    budget: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    estimated_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    actual_hours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Enhanced project metadata
    project_type: Mapped[Optional[ProjectType]] = mapped_column(
        Enum(ProjectType), 
        nullable=True,
        default=ProjectType.BROWNFIELD
    )
    industry_sector: Mapped[Optional[IndustrySector]] = mapped_column(
        Enum(IndustrySector),
        nullable=True,
        default=IndustrySector.OIL_GAS
    )
    facility_type: Mapped[Optional[FacilityType]] = mapped_column(
        Enum(FacilityType),
        nullable=True
    )
    project_priority: Mapped[ProjectPriority] = mapped_column(
        Enum(ProjectPriority),
        nullable=False,
        default=ProjectPriority.MEDIUM
    )
    contract_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    estimated_manhours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    actual_manhours: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    project_manager_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Foreign keys
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("users.id"), 
        nullable=False
    )
    
    # Relationships
    created_by_user: Mapped[User] = relationship(
        "User", 
        back_populates="created_projects",
        foreign_keys=[created_by]
    )
    team_members: Mapped[List["ProjectTeamMember"]] = relationship(
        "ProjectTeamMember", 
        back_populates="project",
        cascade="all, delete-orphan"
    )
    drawings: Mapped[List["Drawing"]] = relationship(
        "Drawing", 
        back_populates="project",
        cascade="all, delete-orphan"
    )
    settings: Mapped[Optional["ProjectSettings"]] = relationship(
        "ProjectSettings",
        uselist=False,
        cascade="all, delete-orphan"
    )
    milestones: Mapped[List["ProjectMilestone"]] = relationship(
        "ProjectMilestone",
        cascade="all, delete-orphan"
    )

class ProjectTeamMember(BaseModel):
    __tablename__ = "project_team_members"
    
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("projects.id"), 
        nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("users.id"), 
        nullable=False
    )
    role_in_project: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False)
    is_lead: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    assigned_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(), 
        nullable=False
    )
    
    # Relationships
    project: Mapped[Project] = relationship("Project", back_populates="team_members")
    user: Mapped[User] = relationship("User", back_populates="assigned_projects")

# Project settings and configuration
class ProjectSettings(BaseModel):
    __tablename__ = "project_settings"
    
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("projects.id"), 
        nullable=False,
        unique=True
    )
    
    # Drawing processing settings
    drawing_auto_processing: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    cloud_detection_sensitivity: Mapped[float] = mapped_column(Float, default=0.7, nullable=False)
    estimation_method: Mapped[str] = mapped_column(String(50), default="ml_model", nullable=False)
    
    # Notification preferences
    email_notifications: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notification_preferences: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Custom fields and configurations
    custom_fields: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    workflow_settings: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Relationships
    project: Mapped[Project] = relationship("Project")

# Project milestones and timeline tracking
class ProjectMilestone(BaseModel):
    __tablename__ = "project_milestones"
    
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("projects.id"), 
        nullable=False
    )
    
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    target_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    actual_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completion_percentage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    
    # Milestone metadata
    milestone_type: Mapped[str] = mapped_column(String(50), nullable=True)  # "design", "installation", "testing"
    dependencies: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Relationships
    project: Mapped[Project] = relationship("Project")

# Drawing and PDF processing models
class Drawing(BaseModel):
    __tablename__ = "drawings"
    
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    s3_key: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    s3_bucket: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[DrawingStatus] = mapped_column(
        Enum(DrawingStatus), 
        nullable=False, 
        default=DrawingStatus.UPLOADED
    )
    page_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    processing_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    processing_completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    processing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Analysis results (JSON fields)
    cloud_detection_results: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    component_detection_results: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    ocr_results: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Foreign keys
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("projects.id"), 
        nullable=False
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("users.id"), 
        nullable=False
    )
    
    # Relationships
    project: Mapped[Project] = relationship("Project", back_populates="drawings")
    uploaded_by_user: Mapped[User] = relationship("User")

# Audit logging
class AuditLog(BaseModel):
    __tablename__ = "audit_logs"
    
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("users.id"), 
        nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)  # IPv6 compatible
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Relationships
    user: Mapped[Optional[User]] = relationship("User", back_populates="audit_logs")

# System configuration
class SystemConfig(BaseModel):
    __tablename__ = "system_config"
    
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_sensitive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
# Session management for authentication
class UserSession(BaseModel):
    __tablename__ = "user_sessions"
    
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), 
        ForeignKey("users.id"), 
        nullable=False
    )
    session_token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    refresh_token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Relationships
    user: Mapped[User] = relationship("User")