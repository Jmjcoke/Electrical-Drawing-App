"""
Comprehensive tests for Component Specifications Database and API
"""

import pytest
import asyncio
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import tempfile
import os

from main import app, components_db, ComponentSpecification, Manufacturer, ComponentCategory
from database import Base, ComponentDatabase
from data_loader import ComponentDataLoader

# Test configuration
TEST_DATABASE_URL = "sqlite:///./test_component_specifications.db"

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)

@pytest.fixture
def clean_database():
    """Clean database before each test"""
    components_db.clear()
    yield
    components_db.clear()

@pytest.fixture
def sample_component():
    """Create sample component for testing"""
    return ComponentSpecification(
        part_number="TEST-001",
        category=ComponentCategory.BREAKER,
        name="Test Circuit Breaker",
        manufacturer=Manufacturer(
            name="Test Manufacturer",
            brand="TestBrand"
        ),
        electrical_ratings={
            "voltage_rating": 120.0,
            "current_rating": 20.0,
            "voltage_type": "AC"
        },
        verified=True,
        confidence_score=1.0
    )

class TestComponentAPI:
    """Test Component API endpoints"""
    
    def test_health_check(self, client):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "component-specifications"
    
    def test_create_component(self, client, clean_database, sample_component):
        """Test creating a new component"""
        component_data = sample_component.dict()
        del component_data['id']  # Remove ID for creation
        
        response = client.post("/components", json=component_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["part_number"] == "TEST-001"
        assert data["name"] == "Test Circuit Breaker"
        assert "id" in data
    
    def test_create_duplicate_component(self, client, clean_database, sample_component):
        """Test creating component with duplicate part number"""
        # Add initial component
        components_db[sample_component.id] = sample_component
        
        component_data = sample_component.dict()
        del component_data['id']
        
        response = client.post("/components", json=component_data)
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"]
    
    def test_get_component_by_id(self, client, clean_database, sample_component):
        """Test getting component by ID"""
        components_db[sample_component.id] = sample_component
        
        response = client.get(f"/components/{sample_component.id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["id"] == sample_component.id
        assert data["part_number"] == "TEST-001"
    
    def test_get_component_not_found(self, client, clean_database):
        """Test getting non-existent component"""
        response = client.get("/components/non-existent-id")
        assert response.status_code == 404
    
    def test_get_component_by_part_number(self, client, clean_database, sample_component):
        """Test getting component by part number"""
        components_db[sample_component.id] = sample_component
        
        response = client.get("/components/part-number/TEST-001")
        assert response.status_code == 200
        
        data = response.json()
        assert data["part_number"] == "TEST-001"
    
    def test_search_components(self, client, clean_database, sample_component):
        """Test component search functionality"""
        components_db[sample_component.id] = sample_component
        
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
    
    def test_search_with_electrical_filters(self, client, clean_database, sample_component):
        """Test search with electrical rating filters"""
        components_db[sample_component.id] = sample_component
        
        search_data = {
            "voltage_min": 100.0,
            "voltage_max": 150.0,
            "current_min": 15.0,
            "current_max": 25.0
        }
        
        response = client.post("/components/search", json=search_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["total_count"] >= 1
        
        # Verify filter applied correctly
        component = data["components"][0]
        assert 100.0 <= component["electrical_ratings"]["voltage_rating"] <= 150.0
        assert 15.0 <= component["electrical_ratings"]["current_rating"] <= 25.0
    
    def test_update_component(self, client, clean_database, sample_component):
        """Test updating component"""
        components_db[sample_component.id] = sample_component
        
        update_data = sample_component.dict()
        update_data["name"] = "Updated Test Circuit Breaker"
        
        response = client.put(f"/components/{sample_component.id}", json=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "Updated Test Circuit Breaker"
    
    def test_delete_component(self, client, clean_database, sample_component):
        """Test deleting component"""
        components_db[sample_component.id] = sample_component
        
        response = client.delete(f"/components/{sample_component.id}")
        assert response.status_code == 200
        
        # Verify component is deleted
        response = client.get(f"/components/{sample_component.id}")
        assert response.status_code == 404
    
    def test_list_manufacturers(self, client, clean_database, sample_component):
        """Test listing manufacturers"""
        components_db[sample_component.id] = sample_component
        
        response = client.get("/manufacturers")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert "Test Manufacturer" in data
    
    def test_list_categories(self, client):
        """Test listing categories"""
        response = client.get("/categories")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert "breaker" in data
    
    def test_get_database_stats(self, client, clean_database, sample_component):
        """Test database statistics"""
        components_db[sample_component.id] = sample_component
        
        response = client.get("/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_components" in data
        assert "verified_components" in data
        assert "categories" in data
        assert "manufacturers" in data
        assert data["total_components"] >= 1
    
    def test_pagination(self, client, clean_database):
        """Test search result pagination"""
        # Create multiple test components
        for i in range(25):
            component = ComponentSpecification(
                part_number=f"PAGE-{i:03d}",
                category=ComponentCategory.BREAKER,
                name=f"Page Test Component {i}",
                manufacturer=Manufacturer(name="Page Test Manufacturer")
            )
            components_db[component.id] = component
        
        # Test first page
        response = client.get("/components?page=1&page_size=10")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["components"]) == 10
        assert data["page"] == 1
        assert data["page_size"] == 10
        assert data["has_next"] is True
        
        # Test second page
        response = client.get("/components?page=2&page_size=10")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data["components"]) == 10
        assert data["page"] == 2

class TestDataLoader:
    """Test component data loader"""
    
    def test_load_square_d_breakers(self):
        """Test loading Square D breaker data"""
        loader = ComponentDataLoader()
        components = loader.load_square_d_breakers()
        
        assert len(components) > 0
        
        # Verify component structure
        component = components[0]
        assert component.part_number.startswith("QO")
        assert component.category == ComponentCategory.BREAKER
        assert component.manufacturer.name == "Schneider Electric"
        assert component.electrical_ratings.voltage_rating is not None
        assert component.electrical_ratings.current_rating is not None
    
    def test_load_leviton_devices(self):
        """Test loading Leviton device data"""
        loader = ComponentDataLoader()
        components = loader.load_leviton_devices()
        
        assert len(components) > 0
        
        # Verify component structure
        component = components[0]
        assert component.manufacturer.name == "Leviton Manufacturing"
        assert component.category in [ComponentCategory.OUTLET, ComponentCategory.SWITCH]
    
    def test_load_all_manufacturers(self):
        """Test loading all manufacturer data"""
        loader = ComponentDataLoader()
        components = loader.load_all_manufacturers()
        
        assert len(components) > 10  # Should have multiple components
        
        # Verify we have different manufacturers
        manufacturers = set(comp.manufacturer.name for comp in components)
        assert len(manufacturers) > 1
        
        # Verify we have different categories
        categories = set(comp.category for comp in components)
        assert len(categories) > 1
    
    def test_export_to_json(self):
        """Test JSON export functionality"""
        loader = ComponentDataLoader()
        components = loader.load_square_d_breakers()
        
        with tempfile.TemporaryDirectory() as temp_dir:
            export_file = os.path.join(temp_dir, "test_export.json")
            loader.loaded_components = components
            loader.export_to_json(export_file)
            
            assert os.path.exists(export_file)
            
            # Verify file content
            import json
            with open(export_file, 'r') as f:
                data = json.load(f)
            
            assert "components" in data
            assert "total_components" in data
            assert data["total_components"] == len(components)

class TestSpecificationMatching:
    """Test specification matching algorithms"""
    
    def test_text_similarity_matching(self, clean_database):
        """Test text-based specification matching"""
        # Create components with different text features
        components = [
            ComponentSpecification(
                part_number="GFCI-001",
                name="GFCI Outlet with LED Indicator",
                category=ComponentCategory.OUTLET,
                manufacturer=Manufacturer(name="Test Mfg"),
                features=["GFCI protection", "LED indicator", "Weather resistant"]
            ),
            ComponentSpecification(
                part_number="STD-001", 
                name="Standard Duplex Outlet",
                category=ComponentCategory.OUTLET,
                manufacturer=Manufacturer(name="Test Mfg"),
                features=["Standard outlet", "Duplex design"]
            )
        ]
        
        for comp in components:
            components_db[comp.id] = comp
        
        # Test search for GFCI-related terms
        client = TestClient(app)
        search_data = {"query": "GFCI LED protection"}
        
        response = client.post("/components/search", json=search_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["total_count"] >= 1
        
        # GFCI component should rank higher due to better text match
        top_result = data["components"][0]
        assert "GFCI" in top_result["name"]
    
    def test_category_filtering(self, clean_database):
        """Test category-based filtering"""
        # Create components in different categories
        components = [
            ComponentSpecification(
                part_number="BRK-001",
                name="Test Breaker",
                category=ComponentCategory.BREAKER,
                manufacturer=Manufacturer(name="Test Mfg")
            ),
            ComponentSpecification(
                part_number="OUT-001",
                name="Test Outlet", 
                category=ComponentCategory.OUTLET,
                manufacturer=Manufacturer(name="Test Mfg")
            )
        ]
        
        for comp in components:
            components_db[comp.id] = comp
        
        client = TestClient(app)
        
        # Test breaker-only search
        search_data = {"category": "breaker"}
        response = client.post("/components/search", json=search_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should only return breaker components
        for component in data["components"]:
            assert component["category"] == "breaker"
    
    def test_electrical_rating_matching(self, clean_database):
        """Test electrical rating-based matching"""
        # Create components with different ratings
        components = [
            ComponentSpecification(
                part_number="120V-20A",
                name="120V 20A Component",
                category=ComponentCategory.BREAKER,
                manufacturer=Manufacturer(name="Test Mfg"),
                electrical_ratings={
                    "voltage_rating": 120.0,
                    "current_rating": 20.0
                }
            ),
            ComponentSpecification(
                part_number="240V-30A",
                name="240V 30A Component",
                category=ComponentCategory.BREAKER,
                manufacturer=Manufacturer(name="Test Mfg"),
                electrical_ratings={
                    "voltage_rating": 240.0,
                    "current_rating": 30.0
                }
            )
        ]
        
        for comp in components:
            components_db[comp.id] = comp
        
        client = TestClient(app)
        
        # Test voltage range search
        search_data = {
            "voltage_min": 200.0,
            "voltage_max": 300.0
        }
        response = client.post("/components/search", json=search_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should only return 240V component
        assert data["total_count"] == 1
        assert data["components"][0]["part_number"] == "240V-30A"

class TestPerformance:
    """Test API performance with larger datasets"""
    
    def test_large_dataset_search(self, clean_database):
        """Test search performance with large dataset"""
        import time
        
        # Create 1000 test components
        for i in range(1000):
            component = ComponentSpecification(
                part_number=f"PERF-{i:04d}",
                name=f"Performance Test Component {i}",
                category=ComponentCategory.BREAKER,
                manufacturer=Manufacturer(name=f"Manufacturer {i % 10}"),
                electrical_ratings={
                    "voltage_rating": 120.0 + (i % 5) * 60,
                    "current_rating": 15.0 + (i % 8) * 5
                }
            )
            components_db[component.id] = component
        
        client = TestClient(app)
        
        # Test search performance
        start_time = time.time()
        search_data = {"query": "Performance Test"}
        response = client.post("/components/search", json=search_data)
        search_time = time.time() - start_time
        
        assert response.status_code == 200
        assert search_time < 2.0  # Should complete within 2 seconds
        
        data = response.json()
        assert data["total_count"] == 1000
    
    def test_concurrent_requests(self, clean_database, sample_component):
        """Test handling concurrent API requests"""
        import threading
        import time
        
        components_db[sample_component.id] = sample_component
        client = TestClient(app)
        
        results = []
        errors = []
        
        def make_request():
            try:
                response = client.get(f"/components/{sample_component.id}")
                results.append(response.status_code)
            except Exception as e:
                errors.append(str(e))
        
        # Create 50 concurrent threads
        threads = []
        for _ in range(50):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
        
        # Start all threads
        start_time = time.time()
        for thread in threads:
            thread.start()
        
        # Wait for completion
        for thread in threads:
            thread.join()
        
        completion_time = time.time() - start_time
        
        # Verify results
        assert len(errors) == 0, f"Errors occurred: {errors}"
        assert len(results) == 50
        assert all(status == 200 for status in results)
        assert completion_time < 5.0  # Should complete within 5 seconds

if __name__ == "__main__":
    pytest.main([__file__, "-v"])