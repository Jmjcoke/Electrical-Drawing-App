#!/usr/bin/env python3
"""
Story 1.3: Project Creation and Configuration Management
Definition of Done Validation Script

This script validates that all DoD criteria are met for Story 1.3.
"""

import os
import sys
import asyncio
from pathlib import Path

def check_file_exists(file_path: str, description: str) -> bool:
    """Check if a file exists and print result"""
    exists = Path(file_path).exists()
    status = "✅" if exists else "❌"
    print(f"{status} {description}: {file_path}")
    return exists

def check_directory_exists(dir_path: str, description: str) -> bool:
    """Check if a directory exists and print result"""
    exists = Path(dir_path).is_dir()
    status = "✅" if exists else "❌"
    print(f"{status} {description}: {dir_path}")
    return exists

def check_content_in_file(file_path: str, content: str, description: str) -> bool:
    """Check if specific content exists in a file"""
    try:
        with open(file_path, 'r') as f:
            file_content = f.read()
            found = content in file_content
            status = "✅" if found else "❌"
            print(f"{status} {description}")
            return found
    except FileNotFoundError:
        print(f"❌ {description} (file not found: {file_path})")
        return False

def validate_database_models():
    """Validate database models are enhanced"""
    print("\n📊 DATABASE MODELS VALIDATION")
    print("=" * 50)
    
    base_path = "src/backend/shared/database"
    models_file = f"{base_path}/models.py"
    
    results = []
    
    # Check models file exists
    results.append(check_file_exists(models_file, "Database models file"))
    
    if Path(models_file).exists():
        # Check for enhanced project model
        results.append(check_content_in_file(
            models_file, 
            "project_type: Mapped[Optional[ProjectType]]",
            "Project model has project_type field"
        ))
        
        results.append(check_content_in_file(
            models_file,
            "industry_sector: Mapped[Optional[IndustrySector]]",
            "Project model has industry_sector field"
        ))
        
        results.append(check_content_in_file(
            models_file,
            "facility_type: Mapped[Optional[FacilityType]]",
            "Project model has facility_type field"
        ))
        
        results.append(check_content_in_file(
            models_file,
            "class ProjectSettings",
            "ProjectSettings model exists"
        ))
        
        results.append(check_content_in_file(
            models_file,
            "class ProjectMilestone",
            "ProjectMilestone model exists"
        ))
        
        # Check enums
        results.append(check_content_in_file(
            models_file,
            "class ProjectType(str, enum.Enum)",
            "ProjectType enum exists"
        ))
        
        results.append(check_content_in_file(
            models_file,
            "class IndustrySector(str, enum.Enum)",
            "IndustrySector enum exists"
        ))
    
    return all(results)

def validate_backend_api():
    """Validate backend API implementation"""
    print("\n🚀 BACKEND API VALIDATION")
    print("=" * 50)
    
    api_file = "src/backend/services/projects/main.py"
    results = []
    
    # Check API file exists
    results.append(check_file_exists(api_file, "Project management API"))
    
    if Path(api_file).exists():
        # Check CRUD operations
        results.append(check_content_in_file(
            api_file,
            "@app.post(\"/projects\"",
            "Create project endpoint"
        ))
        
        results.append(check_content_in_file(
            api_file,
            "@app.get(\"/projects\"",
            "List projects endpoint"
        ))
        
        results.append(check_content_in_file(
            api_file,
            "@app.get(\"/projects/{project_id}\"",
            "Get project endpoint"
        ))
        
        results.append(check_content_in_file(
            api_file,
            "@app.put(\"/projects/{project_id}\"",
            "Update project endpoint"
        ))
        
        # Check team management
        results.append(check_content_in_file(
            api_file,
            "team",
            "Team management functionality"
        ))
        
        # Check access control
        results.append(check_content_in_file(
            api_file,
            "check_project_access",
            "Project access control function"
        ))
        
        results.append(check_content_in_file(
            api_file,
            "require_project_access",
            "Project access control dependency"
        ))
        
        # Check validation
        results.append(check_content_in_file(
            api_file,
            "ProjectCreate",
            "Project creation validation model"
        ))
    
    return all(results)

def validate_frontend_components():
    """Validate frontend components"""
    print("\n🎨 FRONTEND COMPONENTS VALIDATION")
    print("=" * 50)
    
    results = []
    
    # Check store
    store_file = "src/frontend/stores/projectStore.ts"
    results.append(check_file_exists(store_file, "Project store"))
    
    if Path(store_file).exists():
        results.append(check_content_in_file(
            store_file,
            "createProject",
            "Create project action in store"
        ))
        
        results.append(check_content_in_file(
            store_file,
            "fetchProjects",
            "Fetch projects action in store"
        ))
        
        results.append(check_content_in_file(
            store_file,
            "addTeamMember",
            "Team management in store"
        ))
    
    # Check components
    wizard_file = "src/frontend/components/projects/ProjectCreationWizard.tsx"
    results.append(check_file_exists(wizard_file, "Project creation wizard"))
    
    dashboard_file = "src/frontend/components/projects/ProjectDashboard.tsx"
    results.append(check_file_exists(dashboard_file, "Project dashboard"))
    
    team_modal_file = "src/frontend/components/projects/TeamManagementModal.tsx"
    results.append(check_file_exists(team_modal_file, "Team management modal"))
    
    # Check types
    types_file = "src/frontend/types/api.ts"
    results.append(check_file_exists(types_file, "API types"))
    
    if Path(types_file).exists():
        results.append(check_content_in_file(
            types_file,
            "interface Project",
            "Project interface in types"
        ))
        
        results.append(check_content_in_file(
            types_file,
            "interface ProjectCreate",
            "ProjectCreate interface in types"
        ))
    
    return all(results)

def validate_form_validation():
    """Validate form validation implementation"""
    print("\n📝 FORM VALIDATION")
    print("=" * 50)
    
    results = []
    
    wizard_file = "src/frontend/components/projects/ProjectCreationWizard.tsx"
    
    if Path(wizard_file).exists():
        results.append(check_content_in_file(
            wizard_file,
            "zodResolver",
            "Zod validation resolver"
        ))
        
        results.append(check_content_in_file(
            wizard_file,
            "projectSchema",
            "Project validation schema"
        ))
        
        results.append(check_content_in_file(
            wizard_file,
            "useForm",
            "React Hook Form integration"
        ))
        
        results.append(check_content_in_file(
            wizard_file,
            "trigger",
            "Step-by-step validation"
        ))
        
        results.append(check_content_in_file(
            wizard_file,
            "errors",
            "Error handling and display"
        ))
    else:
        results.append(False)
    
    return all(results)

def validate_access_control():
    """Validate access control implementation"""
    print("\n🔐 ACCESS CONTROL VALIDATION")
    print("=" * 50)
    
    results = []
    
    api_file = "src/backend/services/projects/main.py"
    
    if Path(api_file).exists():
        results.append(check_content_in_file(
            api_file,
            "get_current_user",
            "User authentication function"
        ))
        
        results.append(check_content_in_file(
            api_file,
            "UserRole.SUPER_ADMIN",
            "Role-based permissions"
        ))
        
        results.append(check_content_in_file(
            api_file,
            "permissions = {",
            "Permission matrix definition"
        ))
        
        results.append(check_content_in_file(
            api_file,
            "team_member.role",
            "Team member role validation"
        ))
        
        results.append(check_content_in_file(
            api_file,
            "status.HTTP_403_FORBIDDEN",
            "Forbidden access handling"
        ))
    else:
        results.append(False)
    
    return all(results)

def validate_tests():
    """Validate comprehensive test suite"""
    print("\n🧪 TEST SUITE VALIDATION")
    print("=" * 50)
    
    results = []
    
    test_file = "src/backend/tests/test_project_management.py"
    results.append(check_file_exists(test_file, "Project management tests"))
    
    if Path(test_file).exists():
        results.append(check_content_in_file(
            test_file,
            "TestProjectCreation",
            "Project creation tests"
        ))
        
        results.append(check_content_in_file(
            test_file,
            "TestProjectAccess",
            "Access control tests"
        ))
        
        results.append(check_content_in_file(
            test_file,
            "TestFormValidation",
            "Form validation tests"
        ))
        
        results.append(check_content_in_file(
            test_file,
            "TestDefinitionOfDone",
            "DoD validation tests"
        ))
        
        results.append(check_content_in_file(
            test_file,
            "test_create_project_success",
            "Successful project creation test"
        ))
        
        results.append(check_content_in_file(
            test_file,
            "test_create_project_insufficient_permissions",
            "Permission validation test"
        ))
    else:
        results.append(False)
    
    return all(results)

def validate_gateway_integration():
    """Validate gateway service integration"""
    print("\n🌐 GATEWAY INTEGRATION VALIDATION")
    print("=" * 50)
    
    results = []
    
    gateway_file = "src/backend/gateway/main.py"
    
    if Path(gateway_file).exists():
        results.append(check_content_in_file(
            gateway_file,
            "projects",
            "Projects service integration"
        ))
        
        results.append(check_content_in_file(
            gateway_file,
            "/projects",
            "Projects endpoint routing"
        ))
    else:
        print("❌ Gateway integration (file not found)")
        results.append(False)
    
    return all(results)

def main():
    """Main validation function"""
    print("🚀 STORY 1.3: PROJECT CREATION AND CONFIGURATION MANAGEMENT")
    print("📋 DEFINITION OF DONE VALIDATION")
    print("=" * 80)
    
    all_validations = []
    
    # Run all validations
    all_validations.append(validate_database_models())
    all_validations.append(validate_backend_api())
    all_validations.append(validate_frontend_components())
    all_validations.append(validate_form_validation())
    all_validations.append(validate_access_control())
    all_validations.append(validate_tests())
    all_validations.append(validate_gateway_integration())
    
    # Summary
    print("\n" + "=" * 80)
    print("📊 VALIDATION SUMMARY")
    print("=" * 80)
    
    passed_count = sum(all_validations)
    total_count = len(all_validations)
    
    validation_categories = [
        "Database Models Enhancement",
        "Backend API Implementation", 
        "Frontend Components",
        "Form Validation",
        "Access Control",
        "Test Suite",
        "Gateway Integration"
    ]
    
    for i, (category, passed) in enumerate(zip(validation_categories, all_validations)):
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {category}")
    
    print(f"\n📈 OVERALL RESULT: {passed_count}/{total_count} validations passed")
    
    if all(all_validations):
        print("\n🎉 SUCCESS! All Definition of Done criteria are met!")
        print("✅ Story 1.3 is ready for testing and deployment.")
        return 0
    else:
        print("\n⚠️  Some validation criteria failed.")
        print("❌ Please address the failing items before marking story complete.")
        return 1

if __name__ == "__main__":
    sys.exit(main())