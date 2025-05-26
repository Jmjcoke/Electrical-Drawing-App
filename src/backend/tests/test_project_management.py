"""
Comprehensive test suite for Project Management Service
Tests project creation, team management, access control, and CRUD operations
"""

import pytest
import asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import Mock, patch
import uuid
from datetime import datetime, timedelta

# Import the app and dependencies
from services.projects.main import app, get_current_user, get_database_session
from shared.database.models import (
    Project, User, ProjectTeamMember, ProjectSettings,
    ProjectStatus, ProjectPriority, ProjectType, 
    IndustrySector, FacilityType, UserRole
)
from shared.database.connection import Base

# Test database configuration
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_projects.db"

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def test_engine():
    """Create test database engine"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=True,
        future=True
    )
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine
    
    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()

@pytest.fixture
async def test_session(test_engine):
    """Create test database session"""
    async_session = sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        yield session
        await session.rollback()

@pytest.fixture
async def test_users(test_session):
    """Create test users with different roles"""
    users = {
        'super_admin': User(
            id=str(uuid.uuid4()),
            email='admin@test.com',
            full_name='Super Admin',
            role=UserRole.SUPER_ADMIN,
            is_active=True
        ),
        'project_manager': User(
            id=str(uuid.uuid4()),
            email='pm@test.com',
            full_name='Project Manager',
            role=UserRole.PROJECT_MANAGER,
            is_active=True
        ),
        'lead_engineer': User(
            id=str(uuid.uuid4()),
            email='lead@test.com',
            full_name='Lead Engineer',
            role=UserRole.LEAD_ENGINEER,
            is_active=True
        ),
        'engineer': User(
            id=str(uuid.uuid4()),
            email='engineer@test.com',
            full_name='Engineer',
            role=UserRole.ENGINEER,
            is_active=True
        ),
        'viewer': User(
            id=str(uuid.uuid4()),
            email='viewer@test.com',
            full_name='Viewer',
            role=UserRole.VIEWER,
            is_active=True
        )
    }
    
    for user in users.values():
        test_session.add(user)
    
    await test_session.commit()
    return users

@pytest.fixture
async def test_client(test_session):
    """Create test client with mocked dependencies"""
    
    # Mock the database session dependency
    app.dependency_overrides[get_database_session] = lambda: test_session
    
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client
    
    # Clean up overrides
    app.dependency_overrides.clear()

def create_auth_override(user: User):
    """Create auth dependency override for specific user"""
    def override():
        return user
    return override

class TestProjectCreation:
    """Test project creation functionality"""
    
    @pytest.mark.asyncio
    async def test_create_project_success(self, test_client, test_users, test_session):
        """Test successful project creation"""
        pm_user = test_users['project_manager']
        app.dependency_overrides[get_current_user] = create_auth_override(pm_user)
        
        project_data = {
            "name": "Test Brownfield Project",
            "description": "Test project for oil & gas facility",
            "project_type": "BROWNFIELD",
            "industry_sector": "OIL_GAS",
            "facility_type": "OFFSHORE_PLATFORM",
            "priority": "HIGH",
            "start_date": "2024-01-01T00:00:00",
            "end_date": "2024-12-31T00:00:00",
            "budget": 1000000.0,
            "location": "Gulf of Mexico",
            "client_name": "Test Oil Company",
            "settings": {
                "estimation_methodology": "HISTORICAL",
                "accuracy_target": "PRELIMINARY",
                "currency": "USD",
                "labor_rates_region": "Gulf Coast",
                "safety_factor": 0.15,
                "contingency_percentage": 20.0
            }
        }
        
        response = await test_client.post("/projects", json=project_data)
        
        assert response.status_code == 201
        result = response.json()
        assert result["name"] == "Test Brownfield Project"
        assert result["project_type"] == "BROWNFIELD"
        assert result["created_by"] == pm_user.id
        assert result["status"] == "PLANNING"
    
    @pytest.mark.asyncio
    async def test_create_project_insufficient_permissions(self, test_client, test_users):
        """Test project creation with insufficient permissions"""
        viewer_user = test_users['viewer']
        app.dependency_overrides[get_current_user] = create_auth_override(viewer_user)
        
        project_data = {
            "name": "Test Project",
            "description": "Should fail",
            "settings": {
                "estimation_methodology": "HISTORICAL",
                "accuracy_target": "PRELIMINARY",
                "currency": "USD",
                "labor_rates_region": "Gulf Coast",
                "safety_factor": 0.15,
                "contingency_percentage": 20.0
            }
        }
        
        response = await test_client.post("/projects", json=project_data)
        
        assert response.status_code == 403
        assert "Insufficient permissions" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_create_project_duplicate_name(self, test_client, test_users, test_session):
        """Test project creation with duplicate name"""
        pm_user = test_users['project_manager']
        app.dependency_overrides[get_current_user] = create_auth_override(pm_user)
        
        # Create first project
        existing_project = Project(
            name="Duplicate Project",
            description="First project",
            created_by=pm_user.id,
            status=ProjectStatus.PLANNING
        )
        test_session.add(existing_project)
        await test_session.commit()
        
        # Try to create second project with same name
        project_data = {
            "name": "Duplicate Project",
            "description": "Should fail",
            "settings": {
                "estimation_methodology": "HISTORICAL",
                "accuracy_target": "PRELIMINARY",
                "currency": "USD",
                "labor_rates_region": "Gulf Coast",
                "safety_factor": 0.15,
                "contingency_percentage": 20.0
            }
        }
        
        response = await test_client.post("/projects", json=project_data)
        
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]

class TestProjectAccess:
    """Test project access control"""
    
    @pytest.fixture
    async def sample_project(self, test_users, test_session):
        """Create a sample project with team members"""
        pm_user = test_users['project_manager']
        engineer_user = test_users['engineer']
        
        project = Project(
            name="Access Control Test Project",
            description="Testing access control",
            created_by=pm_user.id,
            status=ProjectStatus.ACTIVE,
            priority=ProjectPriority.HIGH
        )
        test_session.add(project)
        await test_session.flush()
        
        # Add engineer as team member
        team_member = ProjectTeamMember(
            project_id=project.id,
            user_id=engineer_user.id,
            role='ENGINEER',
            added_at=datetime.utcnow()
        )
        test_session.add(team_member)
        
        await test_session.commit()
        return project
    
    @pytest.mark.asyncio
    async def test_project_owner_access(self, test_client, test_users, sample_project):
        """Test project owner has full access"""
        pm_user = test_users['project_manager']
        app.dependency_overrides[get_current_user] = create_auth_override(pm_user)
        
        response = await test_client.get(f"/projects/{sample_project.id}")
        
        assert response.status_code == 200
        result = response.json()
        assert result["id"] == sample_project.id
    
    @pytest.mark.asyncio
    async def test_team_member_access(self, test_client, test_users, sample_project):
        """Test team member has read access"""
        engineer_user = test_users['engineer']
        app.dependency_overrides[get_current_user] = create_auth_override(engineer_user)
        
        response = await test_client.get(f"/projects/{sample_project.id}")
        
        assert response.status_code == 200
        result = response.json()
        assert result["id"] == sample_project.id
    
    @pytest.mark.asyncio
    async def test_non_member_no_access(self, test_client, test_users, sample_project):
        """Test non-team member has no access"""
        viewer_user = test_users['viewer']
        app.dependency_overrides[get_current_user] = create_auth_override(viewer_user)
        
        response = await test_client.get(f"/projects/{sample_project.id}")
        
        assert response.status_code == 403
        assert "Insufficient permissions" in response.json()["detail"]
    
    @pytest.mark.asyncio
    async def test_super_admin_access(self, test_client, test_users, sample_project):
        """Test super admin has access to all projects"""
        admin_user = test_users['super_admin']
        app.dependency_overrides[get_current_user] = create_auth_override(admin_user)
        
        response = await test_client.get(f"/projects/{sample_project.id}")
        
        assert response.status_code == 200
        result = response.json()
        assert result["id"] == sample_project.id

class TestProjectListing:
    """Test project listing with access control"""
    
    @pytest.fixture
    async def multiple_projects(self, test_users, test_session):
        """Create multiple projects for testing"""
        pm_user = test_users['project_manager']
        engineer_user = test_users['engineer']
        
        projects = []
        
        # Project 1: PM is owner
        project1 = Project(
            name="PM Project 1",
            description="Project owned by PM",
            created_by=pm_user.id,
            status=ProjectStatus.ACTIVE,
            project_type=ProjectType.BROWNFIELD
        )
        test_session.add(project1)
        projects.append(project1)
        
        # Project 2: Engineer is owner
        project2 = Project(
            name="Engineer Project",
            description="Project owned by Engineer",
            created_by=engineer_user.id,
            status=ProjectStatus.PLANNING,
            project_type=ProjectType.GREENFIELD
        )
        test_session.add(project2)
        projects.append(project2)
        
        await test_session.flush()
        
        # Project 3: PM is owner, Engineer is team member
        project3 = Project(
            name="Collaborative Project",
            description="Project with team members",
            created_by=pm_user.id,
            status=ProjectStatus.ACTIVE,
            project_type=ProjectType.RETROFIT
        )
        test_session.add(project3)
        await test_session.flush()
        
        team_member = ProjectTeamMember(
            project_id=project3.id,
            user_id=engineer_user.id,
            role='ENGINEER',
            added_at=datetime.utcnow()
        )
        test_session.add(team_member)
        projects.append(project3)
        
        await test_session.commit()
        return projects
    
    @pytest.mark.asyncio
    async def test_list_projects_pm_sees_all(self, test_client, test_users, multiple_projects):
        """Test project manager sees all projects"""
        pm_user = test_users['project_manager']
        app.dependency_overrides[get_current_user] = create_auth_override(pm_user)
        
        response = await test_client.get("/projects")
        
        assert response.status_code == 200
        result = response.json()
        assert result["total"] >= 3  # Should see all projects
    
    @pytest.mark.asyncio
    async def test_list_projects_engineer_sees_relevant(self, test_client, test_users, multiple_projects):
        """Test engineer sees only relevant projects"""
        engineer_user = test_users['engineer']
        app.dependency_overrides[get_current_user] = create_auth_override(engineer_user)
        
        response = await test_client.get("/projects")
        
        assert response.status_code == 200
        result = response.json()
        # Engineer should see: own project + collaborative project
        assert result["total"] >= 2
    
    @pytest.mark.asyncio
    async def test_list_projects_with_filters(self, test_client, test_users, multiple_projects):
        """Test project listing with filters"""
        pm_user = test_users['project_manager']
        app.dependency_overrides[get_current_user] = create_auth_override(pm_user)
        
        # Filter by project type
        response = await test_client.get("/projects?project_type=BROWNFIELD")
        
        assert response.status_code == 200
        result = response.json()
        assert result["total"] >= 1
        
        # Filter by status
        response = await test_client.get("/projects?status=ACTIVE")
        
        assert response.status_code == 200
        result = response.json()
        assert result["total"] >= 2

class TestFormValidation:
    """Test comprehensive form validation"""
    
    @pytest.mark.asyncio
    async def test_project_name_validation(self, test_client, test_users):
        """Test project name validation"""
        pm_user = test_users['project_manager']
        app.dependency_overrides[get_current_user] = create_auth_override(pm_user)
        
        # Test empty name
        project_data = {
            "name": "",
            "description": "Test",
            "settings": {
                "estimation_methodology": "HISTORICAL",
                "accuracy_target": "PRELIMINARY",
                "currency": "USD",
                "labor_rates_region": "Gulf Coast",
                "safety_factor": 0.15,
                "contingency_percentage": 20.0
            }
        }
        
        response = await test_client.post("/projects", json=project_data)
        assert response.status_code == 422
        
        # Test name too long
        project_data["name"] = "x" * 201
        response = await test_client.post("/projects", json=project_data)
        assert response.status_code == 422
    
    @pytest.mark.asyncio
    async def test_settings_validation(self, test_client, test_users):
        """Test project settings validation"""
        pm_user = test_users['project_manager']
        app.dependency_overrides[get_current_user] = create_auth_override(pm_user)
        
        # Test invalid safety factor
        project_data = {
            "name": "Test Project",
            "description": "Test",
            "settings": {
                "estimation_methodology": "HISTORICAL",
                "accuracy_target": "PRELIMINARY",
                "currency": "USD",
                "labor_rates_region": "Gulf Coast",
                "safety_factor": 1.5,  # Invalid: > 1.0
                "contingency_percentage": 20.0
            }
        }
        
        response = await test_client.post("/projects", json=project_data)
        assert response.status_code == 422
        
        # Test invalid contingency percentage
        project_data["settings"]["safety_factor"] = 0.15
        project_data["settings"]["contingency_percentage"] = 150.0  # Invalid: > 100
        
        response = await test_client.post("/projects", json=project_data)
        assert response.status_code == 422

class TestDefinitionOfDone:
    """Validate all Definition of Done criteria"""
    
    @pytest.mark.asyncio
    async def test_dod_project_creation_flow(self, test_client, test_users):
        """Test complete project creation flow meets DoD"""
        pm_user = test_users['project_manager']
        app.dependency_overrides[get_current_user] = create_auth_override(pm_user)
        
        # ✓ Users can create projects with required metadata
        project_data = {
            "name": "DoD Test Project",
            "description": "Complete project creation flow test",
            "project_type": "BROWNFIELD",
            "industry_sector": "OIL_GAS",
            "facility_type": "OFFSHORE_PLATFORM",
            "priority": "HIGH",
            "start_date": "2024-01-01T00:00:00",
            "end_date": "2024-12-31T00:00:00",
            "budget": 1000000.0,
            "location": "Gulf of Mexico",
            "client_name": "Test Oil Company",
            "settings": {
                "estimation_methodology": "HISTORICAL",
                "accuracy_target": "PRELIMINARY",
                "currency": "USD",
                "labor_rates_region": "Gulf Coast",
                "safety_factor": 0.15,
                "contingency_percentage": 20.0
            }
        }
        
        create_response = await test_client.post("/projects", json=project_data)
        assert create_response.status_code == 201
        
        project = create_response.json()
        project_id = project["id"]
        
        # ✓ Project configurations are properly stored
        assert project["settings"] is not None
        assert project["project_type"] == "BROWNFIELD"
        assert project["industry_sector"] == "OIL_GAS"
        
        # ✓ Project listing works with filtering
        list_response = await test_client.get("/projects?project_type=BROWNFIELD")
        assert list_response.status_code == 200
        projects = list_response.json()
        assert any(p["id"] == project_id for p in projects["projects"])
        
        # ✓ Form validation prevents invalid data
        invalid_data = project_data.copy()
        invalid_data["name"] = ""  # Invalid empty name
        
        invalid_response = await test_client.post("/projects", json=invalid_data)
        assert invalid_response.status_code == 422
        
        # ✓ Role-based access control is enforced
        viewer_user = test_users['viewer']
        app.dependency_overrides[get_current_user] = create_auth_override(viewer_user)
        
        # Viewer should not be able to create projects
        viewer_response = await test_client.post("/projects", json=project_data)
        assert viewer_response.status_code == 403
        
        # Viewer should not be able to access projects they're not part of
        view_response = await test_client.get(f"/projects/{project_id}")
        assert view_response.status_code == 403
        
        print("✅ All Definition of Done criteria validated successfully!")

if __name__ == "__main__":
    pytest.main([__file__, "-v"])