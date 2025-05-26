"""
Project Management Service for ELECTRICAL ORCHESTRATOR
Handles project creation, team management, and configuration
"""

from fastapi import FastAPI, HTTPException, Depends, Query, status
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, and_, or_, func
from typing import List, Optional
from datetime import datetime, date
import uuid
import logging

# Import shared modules
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from shared.database.connection import get_database_session
from shared.database.models import (
    Project, ProjectTeamMember, ProjectSettings, ProjectMilestone,
    User, ProjectStatus, ProjectPriority, ProjectType, 
    IndustrySector, FacilityType, UserRole
)
from shared.logging.config import setup_logging

# Configure logging
setup_logging()
logger = logging.getLogger(__name__)

# Security
security = HTTPBearer()

# Access Control Functions
async def get_current_user(
    token: str = Depends(security),
    db: AsyncSession = Depends(get_database_session)
) -> User:
    """Verify token and return current user"""
    # This is a simplified version - in production you'd verify JWT token
    # For now, assume token contains user ID
    try:
        # Extract user ID from token (simplified)
        user_id = token.credentials  # In real implementation, decode JWT
        
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled"
            )
        
        return user
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

async def check_project_access(
    project_id: str,
    user: User,
    required_permission: str,
    db: AsyncSession
) -> bool:
    """Check if user has required permission for project"""
    
    # Super admins have access to everything
    if user.role == UserRole.SUPER_ADMIN:
        return True
    
    # Get project with team members
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.team_members))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        return False
    
    # Project creator has full access
    if project.created_by == user.id:
        return True
    
    # Check if user is team member
    team_member = None
    for member in project.team_members:
        if member.user_id == user.id:
            team_member = member
            break
    
    if not team_member:
        # Check if user role allows organization-wide access
        if user.role in [UserRole.PROJECT_MANAGER] and required_permission in ['read']:
            return True
        return False
    
    # Define permission matrix
    permissions = {
        'read': [
            'PROJECT_MANAGER', 'LEAD_ENGINEER', 'SENIOR_ENGINEER', 
            'ENGINEER', 'PROJECT_MEMBER', 'CLIENT_REPRESENTATIVE', 'VIEWER'
        ],
        'write': [
            'PROJECT_MANAGER', 'LEAD_ENGINEER', 'SENIOR_ENGINEER', 'ENGINEER'
        ],
        'delete': ['PROJECT_MANAGER'],
        'manage_team': ['PROJECT_MANAGER', 'LEAD_ENGINEER'],
        'admin': ['PROJECT_MANAGER']
    }
    
    return team_member.role in permissions.get(required_permission, [])

async def require_project_access(
    project_id: str,
    permission: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
) -> User:
    """Dependency to require project access"""
    has_access = await check_project_access(project_id, user, permission, db)
    
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Insufficient permissions for project access"
        )
    
    return user

# Pydantic models for API
from pydantic import BaseModel, Field, validator
from typing import Dict, Any

class ProjectBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    client_name: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[datetime] = None
    target_completion_date: Optional[datetime] = None
    budget: Optional[float] = Field(None, ge=0)
    estimated_hours: Optional[float] = Field(None, ge=0)
    project_type: Optional[ProjectType] = ProjectType.BROWNFIELD
    industry_sector: Optional[IndustrySector] = IndustrySector.OIL_GAS
    facility_type: Optional[FacilityType] = None
    project_priority: ProjectPriority = ProjectPriority.MEDIUM
    contract_number: Optional[str] = None
    estimated_manhours: Optional[float] = Field(None, ge=0)
    project_manager_notes: Optional[str] = None

    @validator('target_completion_date')
    def validate_dates(cls, v, values):
        if v and values.get('start_date') and v < values['start_date']:
            raise ValueError('Target completion date must be after start date')
        return v

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(ProjectBase):
    name: Optional[str] = Field(None, min_length=3, max_length=200)
    project_priority: Optional[ProjectPriority] = None

class ProjectResponse(ProjectBase):
    id: uuid.UUID
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime
    created_by: uuid.UUID
    actual_completion_date: Optional[datetime] = None
    actual_hours: Optional[float] = None
    actual_manhours: Optional[float] = None
    
    class Config:
        from_attributes = True

class TeamMemberBase(BaseModel):
    user_id: uuid.UUID
    role_in_project: UserRole
    is_lead: bool = False

class TeamMemberCreate(TeamMemberBase):
    pass

class TeamMemberUpdate(BaseModel):
    role_in_project: Optional[UserRole] = None
    is_lead: Optional[bool] = None

class TeamMemberResponse(TeamMemberBase):
    id: uuid.UUID
    project_id: uuid.UUID
    assigned_date: datetime
    user_name: str
    user_email: str
    
    class Config:
        from_attributes = True

class ProjectSettingsBase(BaseModel):
    drawing_auto_processing: bool = True
    cloud_detection_sensitivity: float = Field(0.7, ge=0.0, le=1.0)
    estimation_method: str = "ml_model"
    email_notifications: bool = True
    notification_preferences: Optional[Dict[str, Any]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    workflow_settings: Optional[Dict[str, Any]] = None

class ProjectSettingsResponse(ProjectSettingsBase):
    id: uuid.UUID
    project_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class MilestoneBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    target_date: datetime
    milestone_type: Optional[str] = None
    dependencies: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None

class MilestoneCreate(MilestoneBase):
    pass

class MilestoneUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    target_date: Optional[datetime] = None
    actual_date: Optional[datetime] = None
    is_completed: Optional[bool] = None
    completion_percentage: Optional[float] = Field(None, ge=0.0, le=100.0)
    milestone_type: Optional[str] = None
    dependencies: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None

class MilestoneResponse(MilestoneBase):
    id: uuid.UUID
    project_id: uuid.UUID
    actual_date: Optional[datetime] = None
    is_completed: bool
    completion_percentage: float
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ProjectListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int
    page: int
    page_size: int
    pages: int

# FastAPI app
app = FastAPI(
    title="Project Management Service",
    description="Project creation, team management, and configuration",
    version="1.0.0"
)

# Authentication dependency (already defined above)

# Project CRUD operations
@app.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Create a new project"""
    
    # Check if project name already exists
    existing = await db.execute(
        select(Project).where(Project.name == project_data.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project with this name already exists"
        )
    
    # Check user permissions for project creation
    if current_user.role not in [UserRole.SUPER_ADMIN, UserRole.PROJECT_MANAGER, UserRole.LEAD_ENGINEER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create projects"
        )
    
    # Create project
    project = Project(
        **project_data.dict(),
        created_by=current_user.id,
        status=ProjectStatus.PLANNING
    )
    db.add(project)
    await db.flush()
    
    # Create default project settings
    settings = ProjectSettings(project_id=project.id)
    db.add(settings)
    
    await db.commit()
    await db.refresh(project)
    
    logger.info(f"Created project: {project.name}", extra={
        "project_id": str(project.id),
        "user_id": str(current_user.id)
    })
    
    return project

@app.get("/projects", response_model=ProjectListResponse)
async def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[ProjectStatus] = None,
    priority: Optional[ProjectPriority] = None,
    project_type: Optional[ProjectType] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """List projects with filtering and pagination"""
    
    # Build query with access control
    query = select(Project).options(selectinload(Project.team_members))
    
    # Apply access control filters
    access_conditions = []
    
    if current_user.role == UserRole.SUPER_ADMIN:
        # Super admins see all projects
        pass
    elif current_user.role == UserRole.PROJECT_MANAGER:
        # Project managers see all projects in organization
        pass
    else:
        # Other users see only projects they created or are team members of
        access_conditions.extend([
            Project.created_by == current_user.id,
            Project.team_members.any(ProjectTeamMember.user_id == current_user.id)
        ])
    
    # Apply filters
    conditions = []
    if status:
        conditions.append(Project.status == status)
    if priority:
        conditions.append(Project.project_priority == priority)
    if project_type:
        conditions.append(Project.project_type == project_type)
    if search:
        search_term = f"%{search}%"
        conditions.append(
            or_(
                Project.name.ilike(search_term),
                Project.description.ilike(search_term),
                Project.client_name.ilike(search_term),
                Project.location.ilike(search_term)
            )
        )
    
    # Combine access control and filter conditions
    all_conditions = []
    
    if access_conditions:
        all_conditions.append(or_(*access_conditions))
    
    if conditions:
        all_conditions.extend(conditions)
    
    if all_conditions:
        query = query.where(and_(*all_conditions))
    
    # Get total count
    count_query = select(func.count(Project.id)).where(query.whereclause)
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    # Apply pagination
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Project.updated_at.desc())
    
    result = await db.execute(query)
    projects = result.scalars().all()
    
    pages = (total + page_size - 1) // page_size
    
    return ProjectListResponse(
        projects=projects,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages
    )

@app.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Get project by ID"""
    
    # Check access permission
    await require_project_access(project_id, 'read', current_user, db)
    
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.team_members))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return project

@app.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Update project"""
    
    # Check write access permission
    await require_project_access(project_id, 'write', current_user, db)
    
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Update fields
    update_data = project_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    
    await db.commit()
    await db.refresh(project)
    
    logger.info(f"Updated project: {project.name}", extra={
        "project_id": str(project.id),
        "user_id": str(current_user["user_id"])
    })
    
    return project

@app.delete("/projects/{project_id}")
async def archive_project(
    project_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Archive project (soft delete)"""
    
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    project.status = ProjectStatus.ARCHIVED
    await db.commit()
    
    logger.info(f"Archived project: {project.name}", extra={
        "project_id": str(project.id),
        "user_id": str(current_user["user_id"])
    })
    
    return {"message": "Project archived successfully"}

# Team management endpoints
@app.get("/projects/{project_id}/team", response_model=List[TeamMemberResponse])
async def get_project_team(
    project_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Get project team members"""
    
    result = await db.execute(
        select(ProjectTeamMember, User).
        join(User, ProjectTeamMember.user_id == User.id).
        where(ProjectTeamMember.project_id == project_id)
    )
    
    team_members = []
    for team_member, user in result.all():
        team_members.append(TeamMemberResponse(
            id=team_member.id,
            project_id=team_member.project_id,
            user_id=team_member.user_id,
            role_in_project=team_member.role_in_project,
            is_lead=team_member.is_lead,
            assigned_date=team_member.assigned_date,
            user_name=user.full_name,
            user_email=user.email
        ))
    
    return team_members

@app.post("/projects/{project_id}/team", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_team_member(
    project_id: uuid.UUID,
    member_data: TeamMemberCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Add team member to project"""
    
    # Check if project exists
    project_result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    if not project_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Check if user exists
    user_result = await db.execute(
        select(User).where(User.id == member_data.user_id)
    )
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if user is already a team member
    existing_result = await db.execute(
        select(ProjectTeamMember).where(
            and_(
                ProjectTeamMember.project_id == project_id,
                ProjectTeamMember.user_id == member_data.user_id
            )
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a team member"
        )
    
    # Create team member
    team_member = ProjectTeamMember(
        project_id=project_id,
        **member_data.dict()
    )
    db.add(team_member)
    await db.commit()
    await db.refresh(team_member)
    
    return TeamMemberResponse(
        id=team_member.id,
        project_id=team_member.project_id,
        user_id=team_member.user_id,
        role_in_project=team_member.role_in_project,
        is_lead=team_member.is_lead,
        assigned_date=team_member.assigned_date,
        user_name=user.full_name,
        user_email=user.email
    )

# Health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "projects"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)