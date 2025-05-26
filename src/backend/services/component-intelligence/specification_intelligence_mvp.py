import asyncio
import json
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import sqlite3

logger = logging.getLogger(__name__)

# Import feature manager for easy tier management
try:
    from .feature_manager import get_feature_manager, is_feature_enabled, get_advanced_feature
except ImportError:
    # Handle direct execution
    from feature_manager import get_feature_manager, is_feature_enabled, get_advanced_feature

class SpecificationSource(Enum):
    LOCAL_DATABASE = "local_database"
    USER_INPUT = "user_input"
    CACHED = "cached"

class ValidationStatus(Enum):
    VALID = "valid"
    WARNING = "warning"
    ERROR = "error"
    UNKNOWN = "unknown"

@dataclass
class BasicSpecification:
    """Simplified specification for MVP"""
    component_id: str
    manufacturer: str
    model_number: str
    category: str
    basic_specs: Dict[str, Any]
    source: SpecificationSource
    last_updated: datetime
    notes: Optional[str] = None

@dataclass
class SimpleIOPoint:
    """Simplified I/O point for MVP"""
    tag_number: str
    description: str
    io_type: str  # AI, AO, DI, DO
    signal_type: str
    controller: str

class MVPSpecificationDatabase:
    """Lightweight database for MVP specifications"""
    
    def __init__(self, db_path: str = "mvp_specifications.sqlite"):
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        """Initialize simple MVP database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Simple specifications table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS specifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                component_id TEXT UNIQUE NOT NULL,
                manufacturer TEXT NOT NULL,
                model_number TEXT NOT NULL,
                category TEXT NOT NULL,
                voltage_rating REAL,
                current_rating REAL,
                power_rating REAL,
                signal_type TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        conn.close()
        
        # Add sample data
        self._add_sample_data()
    
    def _add_sample_data(self):
        """Add basic sample specifications"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        sample_specs = [
            ("XMTR-001", "Rosemount", "3051S", "pressure_transmitter", 24, 0.02, 5, "4-20mA", "Pressure transmitter"),
            ("VLV-001", "Fisher", "ED Series", "control_valve", 24, 0.5, 8, "4-20mA", "Control valve"),
            ("MTR-001", "Baldor", "EM3770T", "motor", 480, 12.8, 7460, "3-Phase", "AC Motor 10HP"),
            ("PLC-001", "Allen-Bradley", "CompactLogix", "plc", 120, 2, 50, "Ethernet", "Main controller")
        ]
        
        for spec in sample_specs:
            cursor.execute("""
                INSERT OR IGNORE INTO specifications 
                (component_id, manufacturer, model_number, category, voltage_rating, 
                 current_rating, power_rating, signal_type, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, spec)
        
        conn.commit()
        conn.close()
    
    def get_specification(self, manufacturer: str, model_number: str) -> Optional[Dict[str, Any]]:
        """Get basic specification from database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM specifications 
            WHERE manufacturer = ? AND model_number = ?
            LIMIT 1
        """, (manufacturer, model_number))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            columns = [description[0] for description in cursor.description]
            return dict(zip(columns, result))
        return None
    
    def add_specification(self, spec_data: Dict[str, Any]) -> int:
        """Add new specification to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO specifications 
            (component_id, manufacturer, model_number, category, voltage_rating,
             current_rating, power_rating, signal_type, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            spec_data.get("component_id"),
            spec_data.get("manufacturer"),
            spec_data.get("model_number"),
            spec_data.get("category"),
            spec_data.get("voltage_rating"),
            spec_data.get("current_rating"),
            spec_data.get("power_rating"),
            spec_data.get("signal_type"),
            spec_data.get("notes")
        ))
        
        spec_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return spec_id

class MVPSpecificationService:
    """MVP version of specification intelligence service"""
    
    def __init__(self):
        self.database = MVPSpecificationDatabase()
        
        # Lazy loading of advanced features
        self._advanced_validator = None
        self._ml_engine = None
        self._api_client = None
    
    async def get_component_specification(self, 
                                        manufacturer: str,
                                        model_number: str,
                                        component_id: str,
                                        category: str) -> BasicSpecification:
        """Get component specification - MVP version"""
        
        # Try local database first
        spec_data = self.database.get_specification(manufacturer, model_number)
        
        if spec_data:
            return BasicSpecification(
                component_id=component_id,
                manufacturer=spec_data["manufacturer"],
                model_number=spec_data["model_number"],
                category=spec_data["category"],
                basic_specs={
                    "voltage_rating": spec_data.get("voltage_rating"),
                    "current_rating": spec_data.get("current_rating"),
                    "power_rating": spec_data.get("power_rating"),
                    "signal_type": spec_data.get("signal_type")
                },
                source=SpecificationSource.LOCAL_DATABASE,
                last_updated=datetime.now(),
                notes=spec_data.get("notes")
            )
        else:
            # Return basic default specification
            return self._create_default_specification(manufacturer, model_number, component_id, category)
    
    def _create_default_specification(self, manufacturer: str, model_number: str, 
                                    component_id: str, category: str) -> BasicSpecification:
        """Create default specification when not found"""
        
        # Simple defaults based on category
        category_defaults = {
            "pressure_transmitter": {"voltage_rating": 24, "signal_type": "4-20mA", "power_rating": 5},
            "temperature_transmitter": {"voltage_rating": 24, "signal_type": "4-20mA", "power_rating": 5},
            "control_valve": {"voltage_rating": 24, "signal_type": "4-20mA", "power_rating": 8},
            "motor": {"voltage_rating": 480, "signal_type": "3-Phase", "power_rating": 5000},
            "plc": {"voltage_rating": 120, "signal_type": "Ethernet", "power_rating": 50}
        }
        
        defaults = category_defaults.get(category, {"voltage_rating": 24, "signal_type": "Unknown", "power_rating": 10})
        
        return BasicSpecification(
            component_id=component_id,
            manufacturer=manufacturer,
            model_number=model_number,
            category=category,
            basic_specs=defaults,
            source=SpecificationSource.LOCAL_DATABASE,
            last_updated=datetime.now(),
            notes="Default specification - requires verification"
        )
    
    def generate_simple_io_list(self, components: List[Dict[str, Any]]) -> List[SimpleIOPoint]:
        """Generate simple I/O list for MVP"""
        io_points = []
        
        for component in components:
            category = component.get("category", "")
            tag_base = component.get("tag", f"DEV-{len(io_points)+1:03d}")
            
            if "transmitter" in category:
                io_points.append(SimpleIOPoint(
                    tag_number=f"{tag_base}-AI",
                    description=f"{component.get('description', 'Transmitter')} - Analog Input",
                    io_type="AI",
                    signal_type="4-20mA",
                    controller="PLC-001"
                ))
            
            elif "valve" in category:
                io_points.append(SimpleIOPoint(
                    tag_number=f"{tag_base}-AO",
                    description=f"{component.get('description', 'Valve')} - Analog Output",
                    io_type="AO",
                    signal_type="4-20mA",
                    controller="PLC-001"
                ))
            
            elif "motor" in category:
                io_points.extend([
                    SimpleIOPoint(
                        tag_number=f"{tag_base}-START",
                        description=f"{component.get('description', 'Motor')} - Start",
                        io_type="DO",
                        signal_type="24VDC",
                        controller="PLC-001"
                    ),
                    SimpleIOPoint(
                        tag_number=f"{tag_base}-RUN",
                        description=f"{component.get('description', 'Motor')} - Running Status",
                        io_type="DI",
                        signal_type="24VDC",
                        controller="PLC-001"
                    )
                ])
        
        return io_points
    
    def create_simple_overlay_data(self, spec: BasicSpecification) -> Dict[str, Any]:
        """Create simple overlay data for MVP"""
        return {
            "component_id": spec.component_id,
            "manufacturer": spec.manufacturer,
            "model_number": spec.model_number,
            "category": spec.category.replace("_", " ").title(),
            "specifications": {
                "voltage": f"{spec.basic_specs.get('voltage_rating', 'N/A')}V",
                "signal": spec.basic_specs.get('signal_type', 'Unknown'),
                "power": f"{spec.basic_specs.get('power_rating', 'N/A')}W"
            },
            "source": spec.source.value,
            "notes": spec.notes or "No additional notes"
        }
    
    # Methods to access advanced features when available
    def get_advanced_specification(self, manufacturer: str, model_number: str, 
                                 component_id: str, category: str) -> Optional[Any]:
        """Get advanced specification if ML features are enabled"""
        if is_feature_enabled("advanced_ml"):
            ml_engine = get_advanced_feature("advanced_ml")
            if ml_engine:
                return ml_engine.get_real_time_specification(manufacturer, model_number, component_id, category)
        return None
    
    def get_process_control_analysis(self, spec_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Get process control analysis if enabled"""
        if is_feature_enabled("process_control"):
            validator = get_advanced_feature("process_control")
            if validator:
                # Return process control analysis
                return {"process_control_available": True, "validator": "loaded"}
        return None
    
    def get_predictive_maintenance(self, component_id: str, sensor_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Get predictive maintenance analysis if enabled"""
        if is_feature_enabled("predictive_maintenance"):
            pm_engine = get_advanced_feature("predictive_maintenance")
            if pm_engine:
                # Return predictive maintenance analysis
                return {"predictive_maintenance_available": True, "engine": "loaded"}
        return None

class MVPTagGenerator:
    """Simple tag generator for MVP"""
    
    def __init__(self):
        self.tag_counters = {}
    
    def generate_tag(self, category: str, area: str = "") -> str:
        """Generate simple tag number"""
        
        # Simple tag prefixes
        tag_prefixes = {
            "pressure_transmitter": "PT",
            "temperature_transmitter": "TT",
            "flow_transmitter": "FT",
            "level_transmitter": "LT",
            "control_valve": "PV",
            "motor": "MTR",
            "plc": "PLC"
        }
        
        prefix = tag_prefixes.get(category, "DEV")
        
        # Increment counter
        if prefix not in self.tag_counters:
            self.tag_counters[prefix] = 0
        self.tag_counters[prefix] += 1
        
        return f"{area}{prefix}-{self.tag_counters[prefix]:03d}"

# FastAPI endpoints for MVP
class MVPSpecificationAPI:
    """MVP API endpoints"""
    
    def __init__(self):
        self.service = MVPSpecificationService()
        self.tag_generator = MVPTagGenerator()
    
    async def get_component_specs(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """MVP endpoint for getting component specifications"""
        
        manufacturer = request_data.get("manufacturer", "Unknown")
        model_number = request_data.get("model_number", "Unknown")
        component_id = request_data.get("component_id", "COMP-001")
        category = request_data.get("category", "sensor")
        
        # Get specification
        spec = await self.service.get_component_specification(
            manufacturer, model_number, component_id, category
        )
        
        # Create overlay data
        overlay_data = self.service.create_simple_overlay_data(spec)
        
        return {
            "success": True,
            "specification": {
                "component_id": spec.component_id,
                "manufacturer": spec.manufacturer,
                "model_number": spec.model_number,
                "category": spec.category,
                "basic_specs": spec.basic_specs,
                "source": spec.source.value,
                "notes": spec.notes
            },
            "overlay_data": overlay_data,
            "mvp_version": True,
            "advanced_features_available": self._check_advanced_features()
        }
    
    async def generate_io_list(self, components: List[Dict[str, Any]]) -> Dict[str, Any]:
        """MVP endpoint for generating I/O list"""
        
        io_points = self.service.generate_simple_io_list(components)
        
        return {
            "success": True,
            "io_points": [
                {
                    "tag_number": point.tag_number,
                    "description": point.description,
                    "io_type": point.io_type,
                    "signal_type": point.signal_type,
                    "controller": point.controller
                }
                for point in io_points
            ],
            "total_points": len(io_points),
            "mvp_version": True
        }
    
    def _check_advanced_features(self) -> Dict[str, bool]:
        """Check which advanced features are available"""
        return get_feature_manager().get_feature_summary()["enabled_features"]

# Testing function
async def test_mvp_specification_service():
    """Test MVP specification service"""
    print("Testing MVP Specification Service:")
    
    api = MVPSpecificationAPI()
    
    # Test component specification
    request_data = {
        "manufacturer": "Rosemount",
        "model_number": "3051S",
        "component_id": "PT-001",
        "category": "pressure_transmitter"
    }
    
    result = await api.get_component_specs(request_data)
    print(f"Specification Result: {json.dumps(result, indent=2)}")
    
    # Test I/O list generation
    sample_components = [
        {"category": "pressure_transmitter", "tag": "PT-001", "description": "Inlet Pressure"},
        {"category": "control_valve", "tag": "PV-001", "description": "Flow Control Valve"},
        {"category": "motor", "tag": "MTR-001", "description": "Feed Pump Motor"}
    ]
    
    io_result = await api.generate_io_list(sample_components)
    print(f"\nI/O List Result: {json.dumps(io_result, indent=2)}")
    
    # Show current tier and available upgrades
    feature_manager = get_feature_manager()
    feature_summary = feature_manager.get_feature_summary()
    
    print(f"\nCurrent Deployment Tier: {feature_summary['deployment_tier'].upper()}")
    print(f"Enabled Features: {feature_summary['feature_count']}")
    print(f"Upgrade Available: {feature_summary['upgrade_available']}")
    
    print(f"\nTo upgrade to Professional tier:")
    print(f"from .feature_manager import enable_professional_features")
    print(f"enable_professional_features()")
    
    print(f"\nTo upgrade to Enterprise tier:")
    print(f"from .feature_manager import enable_enterprise_features") 
    print(f"enable_enterprise_features()")
    
    # Demonstrate easy upgrade
    print(f"\n--- Demonstrating Professional Tier Upgrade ---")
    try:
        from .feature_manager import enable_professional_features
    except ImportError:
        from feature_manager import enable_professional_features
    enable_professional_features()
    
    updated_summary = get_feature_manager().get_feature_summary()
    print(f"New Tier: {updated_summary['deployment_tier'].upper()}")
    print(f"New Feature Count: {updated_summary['feature_count']}")
    print(f"Advanced ML Available: {is_feature_enabled('advanced_ml')}")
    print(f"Process Control Available: {is_feature_enabled('process_control')}")

if __name__ == "__main__":
    asyncio.run(test_mvp_specification_service())