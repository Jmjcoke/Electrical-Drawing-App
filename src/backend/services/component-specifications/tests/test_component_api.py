"""
Tests for Component Specifications API
"""

import pytest
from fastapi.testclient import TestClient
from main import app, components_db, ComponentSpecification, Manufacturer, ComponentCategory

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_test_data():
    """Setup test data before each test"""
    # Clear the database
    components_db.clear()
    
    # Add test component
    test_component = ComponentSpecification(
        part_number="TEST-001",
        category=ComponentCategory.BREAKER,
        name="Test Circuit Breaker",
        manufacturer=Manufacturer(
            name="Test Manufacturer",
            brand="TestBrand"
        )
    )
    components_db[test_component.id] = test_component
    
    yield
    
    # Cleanup
    components_db.clear()

def test_health_check():
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_get_component_by_id():
    """Test getting component by ID"""
    component_id = list(components_db.keys())[0]
    response = client.get(f"/components/{component_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["part_number"] == "TEST-001"
    assert data["name"] == "Test Circuit Breaker"

def test_get_component_not_found():
    """Test getting non-existent component"""
    response = client.get("/components/non-existent-id")
    assert response.status_code == 404

def test_get_component_by_part_number():
    """Test getting component by part number"""
    response = client.get("/components/part-number/TEST-001")
    assert response.status_code == 200
    data = response.json()
    assert data["part_number"] == "TEST-001"

def test_get_component_by_part_number_case_insensitive():
    """Test getting component by part number (case insensitive)"""
    response = client.get("/components/part-number/test-001")
    assert response.status_code == 200
    data = response.json()
    assert data["part_number"] == "TEST-001"

def test_search_components():
    """Test component search"""
    search_data = {
        "query": "Test",
        "category": "breaker"
    }
    response = client.post("/components/search", json=search_data)
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] >= 1
    assert len(data["components"]) >= 1
    assert data["components"][0]["part_number"] == "TEST-001"

def test_search_components_no_results():
    """Test component search with no results"""
    search_data = {
        "query": "NonExistentComponent"
    }
    response = client.post("/components/search", json=search_data)
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 0
    assert len(data["components"]) == 0

def test_list_components():
    """Test listing components"""
    response = client.get("/components")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] >= 1
    assert len(data["components"]) >= 1

def test_list_components_with_filters():
    """Test listing components with filters"""
    response = client.get("/components?category=breaker")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] >= 1
    assert all(comp["category"] == "breaker" for comp in data["components"])

def test_create_component():
    """Test creating new component"""
    new_component = {
        "part_number": "NEW-001",
        "category": "switch",
        "name": "New Test Switch",
        "manufacturer": {
            "name": "New Manufacturer",
            "brand": "NewBrand"
        }
    }
    response = client.post("/components", json=new_component)
    assert response.status_code == 200
    data = response.json()
    assert data["part_number"] == "NEW-001"
    assert data["name"] == "New Test Switch"

def test_create_duplicate_component():
    """Test creating component with duplicate part number"""
    duplicate_component = {
        "part_number": "TEST-001",  # Already exists
        "category": "switch",
        "name": "Duplicate Component",
        "manufacturer": {
            "name": "Manufacturer",
            "brand": "Brand"
        }
    }
    response = client.post("/components", json=duplicate_component)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]

def test_update_component():
    """Test updating component"""
    component_id = list(components_db.keys())[0]
    update_data = {
        "part_number": "TEST-001",
        "category": "breaker",
        "name": "Updated Test Circuit Breaker",
        "manufacturer": {
            "name": "Updated Manufacturer",
            "brand": "UpdatedBrand"
        }
    }
    response = client.put(f"/components/{component_id}", json=update_data)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Test Circuit Breaker"
    assert data["manufacturer"]["name"] == "Updated Manufacturer"

def test_update_nonexistent_component():
    """Test updating non-existent component"""
    update_data = {
        "part_number": "NONEXISTENT",
        "category": "breaker",
        "name": "Non-existent Component",
        "manufacturer": {
            "name": "Manufacturer",
            "brand": "Brand"
        }
    }
    response = client.put("/components/nonexistent-id", json=update_data)
    assert response.status_code == 404

def test_delete_component():
    """Test deleting component"""
    component_id = list(components_db.keys())[0]
    response = client.delete(f"/components/{component_id}")
    assert response.status_code == 200
    assert "deleted successfully" in response.json()["message"]
    
    # Verify component is deleted
    response = client.get(f"/components/{component_id}")
    assert response.status_code == 404

def test_delete_nonexistent_component():
    """Test deleting non-existent component"""
    response = client.delete("/components/nonexistent-id")
    assert response.status_code == 404

def test_list_manufacturers():
    """Test listing manufacturers"""
    response = client.get("/manufacturers")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert "Test Manufacturer" in data

def test_list_categories():
    """Test listing categories"""
    response = client.get("/categories")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert "breaker" in data

def test_get_compatible_components():
    """Test getting compatible components"""
    component_id = list(components_db.keys())[0]
    response = client.get(f"/components/{component_id}/compatible")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_get_database_stats():
    """Test getting database statistics"""
    response = client.get("/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_components" in data
    assert "verified_components" in data
    assert "categories" in data
    assert "manufacturers" in data
    assert data["total_components"] >= 1

def test_pagination():
    """Test pagination in search results"""
    # Add more test components
    for i in range(5):
        test_component = ComponentSpecification(
            part_number=f"PAGE-{i:03d}",
            category=ComponentCategory.BREAKER,
            name=f"Page Test Component {i}",
            manufacturer=Manufacturer(
                name="Page Test Manufacturer",
                brand="PageBrand"
            )
        )
        components_db[test_component.id] = test_component
    
    # Test first page
    response = client.get("/components?page=1&page_size=3")
    assert response.status_code == 200
    data = response.json()
    assert len(data["components"]) <= 3
    assert data["page"] == 1
    assert data["page_size"] == 3
    
    # Test second page if there are enough components
    if data["has_next"]:
        response = client.get("/components?page=2&page_size=3")
        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2

def test_electrical_ratings_filter():
    """Test filtering by electrical ratings"""
    # Add component with specific ratings
    test_component = ComponentSpecification(
        part_number="RATING-001",
        category=ComponentCategory.BREAKER,
        name="High Voltage Breaker",
        manufacturer=Manufacturer(name="Test Mfg", brand="Test"),
        electrical_ratings={
            "voltage_rating": 480.0,
            "current_rating": 100.0
        }
    )
    components_db[test_component.id] = test_component
    
    # Search with voltage filter
    search_data = {
        "voltage_min": 400.0,
        "voltage_max": 500.0
    }
    response = client.post("/components/search", json=search_data)
    assert response.status_code == 200
    data = response.json()
    assert any(comp["part_number"] == "RATING-001" for comp in data["components"])

if __name__ == "__main__":
    pytest.main([__file__])