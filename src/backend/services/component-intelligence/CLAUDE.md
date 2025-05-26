# Component Intelligence Service - Claude Code Configuration

## Service Overview

Advanced AI-powered component recognition and intelligence service for electrical systems, implementing Story 3.3: Instrument/Control Device Integration following BMAD Method standards.

## BMAD Method Context

### Service Domain
This service implements **Epic 3: Interactive Circuit Analysis & Component Intelligence**, specifically:
- **Story 3.1**: Component Specifications and Intelligence ✅ 
- **Story 3.2**: Circuit Tracing Functionality ✅
- **Story 3.3**: Instrument/Control Device Integration (In Progress)

### Current Implementation Status
- ✅ **Task 1**: Industrial Control Device Recognition
- ✅ **Task 2**: Control System Architecture Analysis  
- 🚧 **Task 3**: Process Control and Safety Systems (In Progress)
- ⏳ **Task 4**: Motor Control and Drive Systems
- ⏳ **Task 5**: Building Automation and Smart Systems
- ⏳ **Task 6**: Control System Documentation and Integration
- ⏳ **Task 7**: Advanced Control System Features

## Service Architecture

### Core Modules
```
src/backend/services/component-intelligence/
├── main.py                             # FastAPI service entry point
├── enhanced_recognition.py             # Base component recognition
├── specification_intelligence.py       # Real-time specifications
├── industrial_control_recognition.py   # Industrial device recognition  
├── control_system_architecture.py     # System architecture analysis
├── test_industrial_recognition.py     # Comprehensive test suite
├── requirements.txt                    # Dependencies
└── CLAUDE.md                          # This configuration file
```

### Key Capabilities
1. **Component Recognition**: ML-powered identification of 35+ electrical component types
2. **Industrial Control Analysis**: Specialized recognition for PLCs, HMIs, VFDs, sensors
3. **ISA Symbol Recognition**: Process control symbols with tag number extraction
4. **Control System Architecture**: Hierarchical analysis of control systems (5 levels)
5. **Network Topology Analysis**: Industrial protocol support (Ethernet/IP, PROFINET, etc.)
6. **Specification Intelligence**: Real-time manufacturer API integration
7. **Safety System Analysis**: SIL rating and safety function identification

## Development Workflow

### Working with BMAD Method
```markdown
# Activate appropriate BMAD persona for this service
I need to work on the Component Intelligence Service. Please activate the Developer Agent persona specialized for Python/FastAPI with machine learning capabilities.

Context: This is Story 3.3 implementation focusing on industrial control device recognition and analysis.
```

### Development Commands
```bash
# Environment setup
cd src/backend/services/component-intelligence
python -m venv venv
source venv/bin/activate  # Unix/Mac
pip install -r requirements.txt

# Development with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8001

# Testing
pytest                                    # Run all tests
pytest test_industrial_recognition.py    # Specific test file
pytest --cov=. --cov-report=html        # Coverage report

# ML Model Testing
python -c "import test_industrial_recognition; test_industrial_recognition.test_end_to_end_recognition()"
```

## Code Standards & Patterns

### Service Structure (FastAPI)
```python
# main.py - Service entry point following BMAD standards
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Tuple
import numpy as np
import cv2
import logging

# Import service modules
from enhanced_recognition import EnhancedComponentRecognition
from specification_intelligence import RealTimeSpecificationIntelligence  
from industrial_control_recognition import IndustrialControlRecognition
from control_system_architecture import ControlSystemArchitectureEngine

# Configure logging per BMAD standards
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Component Intelligence Service",
    description="Advanced component recognition and specification intelligence for electrical systems",
    version="1.0.0"
)

# Global service instances (initialized on startup)
component_recognition = None
specification_intelligence = None
industrial_recognition = None
architecture_engine = None

@app.on_event("startup")
async def startup_event():
    """Initialize all service components following BMAD principles"""
    global component_recognition, specification_intelligence, industrial_recognition, architecture_engine
    
    logger.info("Initializing Component Intelligence Service...")
    
    # Initialize recognition engines
    component_recognition = EnhancedComponentRecognition()
    specification_intelligence = RealTimeSpecificationIntelligence()
    await specification_intelligence.initialize()
    industrial_recognition = IndustrialControlRecognition()
    architecture_engine = ControlSystemArchitectureEngine()
    
    logger.info("Component Intelligence Service ready!")

@app.get("/health")
async def health_check():
    """Health check endpoint required by BMAD operational guidelines"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "services": {
            "component_recognition": component_recognition is not None,
            "specification_intelligence": specification_intelligence is not None,
            "industrial_recognition": industrial_recognition is not None,
            "architecture_engine": architecture_engine is not None
        }
    }
```

### Industrial Device Recognition Pattern
```python
# industrial_control_recognition.py - Core industrial recognition
from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
import tensorflow as tf
import cv2
import numpy as np

class IndustrialDeviceCategory(Enum):
    """Industrial device categories following ISA standards"""
    PLC = "plc"
    HMI = "hmi"
    VFD = "vfd"
    PRESSURE_TRANSMITTER = "pressure_transmitter"
    TEMPERATURE_TRANSMITTER = "temperature_transmitter"
    # ... additional categories

@dataclass
class IndustrialRecognitionResult:
    """Recognition result with comprehensive device information"""
    component_id: str
    category: IndustrialDeviceCategory
    confidence: float
    bounding_box: Tuple[int, int, int, int]
    specifications: Optional[IndustrialDeviceSpecification] = None
    isa_symbol: Optional[ISASymbolRecognition] = None
    control_loop: Optional[ControlLoopIdentification] = None
    visual_features: Dict[str, Any] = field(default_factory=dict)
    network_connections: List[str] = field(default_factory=list)

class IndustrialControlRecognition:
    """Main industrial control recognition engine"""
    
    def __init__(self, database_path: str = "industrial_devices.sqlite"):
        self.database = IndustrialDeviceDatabase(database_path)
        self.symbol_recognizer = ISASymbolRecognizer()
        self.classifier = self._create_industrial_classifier()
        
    async def recognize_industrial_device(self, 
                                        image: np.ndarray,
                                        bbox: Tuple[int, int, int, int]) -> IndustrialRecognitionResult:
        """Recognize industrial device with full context analysis"""
        # Implementation follows BMAD quality standards
        # Comprehensive error handling and logging
        # Performance optimization for real-time analysis
```

### Control System Architecture Analysis
```python
# control_system_architecture.py - System-level analysis
from enum import Enum
from dataclasses import dataclass, field
import networkx as nx

class ControlSystemLevel(Enum):
    """ISA-95 automation pyramid levels"""
    ENTERPRISE = "enterprise"      # Level 4: Business systems
    SUPERVISION = "supervision"    # Level 3: SCADA/HMI
    CONTROL = "control"           # Level 2: PLC/DCS
    FIELD_CONTROL = "field_control" # Level 1: Field controllers
    FIELD_DEVICE = "field_device"   # Level 0: Sensors/actuators

class ControlSystemArchitectureEngine:
    """Comprehensive control system architecture analysis"""
    
    def __init__(self):
        self.hierarchy_analyzer = HierarchicalControlAnalyzer()
        self.network_analyzer = NetworkTopologyAnalyzer()
        self.io_analyzer = IOSystemAnalyzer()
    
    async def analyze_control_system_architecture(self, 
                                                devices: List[IndustrialRecognitionResult],
                                                isa_symbols: List[ISASymbolRecognition],
                                                control_loops: List[ControlLoopIdentification]) -> ControlSystemArchitectureAnalysis:
        """Perform comprehensive system architecture analysis"""
        # Multi-level analysis following automation pyramid
        # Network topology mapping with protocol analysis
        # I/O capacity planning and utilization analysis
        # Safety system identification and SIL analysis
        # Performance metrics and optimization recommendations
```

## Testing Standards

### Comprehensive Test Coverage
```python
# test_industrial_recognition.py - Full test suite
import pytest
import asyncio
import numpy as np
import tempfile
import os

class TestIndustrialDeviceDatabase:
    """Test industrial device database functionality"""
    
    def setup_method(self):
        self.temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.sqlite')
        self.temp_db.close()
        self.database = IndustrialDeviceDatabase(self.temp_db.name)
    
    def test_add_industrial_device(self):
        """Test adding devices with comprehensive specifications"""
        spec = IndustrialDeviceSpecification(
            manufacturer="Allen-Bradley",
            model_number="1756-L75",
            category=IndustrialDeviceCategory.PLC,
            voltage_rating=24,
            communication_protocols=[CommunicationProtocol.ETHERNET_IP]
        )
        device_id = self.database.add_industrial_device(spec)
        assert device_id > 0

class TestIndustrialControlRecognition:
    """Test complete recognition workflow"""
    
    @pytest.mark.asyncio
    async def test_recognize_industrial_device(self):
        """Test device recognition with real image data"""
        recognition = IndustrialControlRecognition()
        test_image = np.random.randint(0, 255, (600, 800, 3), dtype=np.uint8)
        test_bbox = (100, 100, 200, 150)
        
        result = await recognition.recognize_industrial_device(test_image, test_bbox)
        
        assert isinstance(result, IndustrialRecognitionResult)
        assert result.component_id.startswith("industrial_")
        assert 0.0 <= result.confidence <= 1.0

# Performance tests
class TestPerformance:
    """Performance benchmarks per BMAD quality standards"""
    
    @pytest.mark.asyncio
    async def test_recognition_performance(self):
        """Ensure recognition completes within acceptable time"""
        recognition = IndustrialControlRecognition()
        test_image = np.random.randint(0, 255, (600, 800, 3), dtype=np.uint8)
        
        start_time = datetime.now()
        result = await recognition.recognize_industrial_device(test_image, (100, 100, 200, 150))
        processing_time = (datetime.now() - start_time).total_seconds()
        
        assert processing_time < 5.0  # 5 second SLA
        assert result is not None
```

## API Endpoints

### Recognition Endpoints
```python
@app.post("/recognize-components", response_model=ComponentRecognitionResponse)
async def recognize_components(
    image: UploadFile = File(...),
    request_data: str = Form(...)
):
    """
    Recognize electrical components with optional industrial analysis
    
    Implements Story 3.3 requirements:
    - Multi-category component recognition
    - Industrial device specialization
    - Real-time specification lookup
    - Performance optimization
    """
    try:
        request = ComponentRecognitionRequest.parse_raw(request_data)
        image_array = image_to_numpy(image)
        bboxes = [bbox_to_tuple(bbox) for bbox in request.bounding_boxes]
        
        # Standard component recognition
        results = await component_recognition.batch_recognize_components(image_array, bboxes)
        
        # Industrial analysis if requested
        if request.enable_industrial_analysis:
            industrial_results = await industrial_recognition.batch_recognize_industrial_devices(image_array, bboxes)
            # Merge results with industrial analysis
            
        return ComponentRecognitionResponse(
            success=True,
            results=serialized_results,
            processing_time=processing_time,
            total_components=len(results)
        )
    except Exception as e:
        logger.error(f"Recognition error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/industrial-analysis", response_model=IndustrialAnalysisResponse)
async def analyze_industrial_systems(
    image: UploadFile = File(...),
    request_data: str = Form(...)
):
    """
    Comprehensive industrial control system analysis
    
    Features:
    - Industrial device recognition (25+ categories)
    - ISA symbol identification with tag numbers
    - Control loop analysis and documentation
    - Network topology mapping
    - Safety system identification
    """
    # Implementation per BMAD operational guidelines
    # Comprehensive error handling and validation
    # Performance monitoring and metrics collection
```

## Machine Learning Models

### Model Management
```python
# Enhanced recognition with ML models
class MLComponentClassifier:
    """ML-based component classification following BMAD standards"""
    
    def __init__(self, model_path: Optional[str] = None):
        self.model = None
        self.class_names = [category.value for category in IndustrialDeviceCategory]
        
        if model_path and tf.io.gfile.exists(model_path):
            self.model = tf.keras.models.load_model(model_path)
        else:
            self._create_default_model()
    
    def _create_default_model(self):
        """Create CNN model optimized for industrial devices"""
        self.model = tf.keras.Sequential([
            tf.keras.layers.Conv2D(32, (3, 3), activation='relu', input_shape=(224, 224, 3)),
            tf.keras.layers.MaxPooling2D((2, 2)),
            tf.keras.layers.Conv2D(64, (3, 3), activation='relu'),
            tf.keras.layers.MaxPooling2D((2, 2)),
            tf.keras.layers.Conv2D(128, (3, 3), activation='relu'),
            tf.keras.layers.MaxPooling2D((2, 2)),
            tf.keras.layers.Conv2D(128, (3, 3), activation='relu'),
            tf.keras.layers.Flatten(),
            tf.keras.layers.Dense(128, activation='relu'),
            tf.keras.layers.Dropout(0.5),
            tf.keras.layers.Dense(len(self.class_names), activation='softmax')
        ])
        
        self.model.compile(
            optimizer='adam',
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )
```

## Database Integration

### Industrial Device Database
```python
# Comprehensive device database with specifications
class IndustrialDeviceDatabase:
    """SQLite database for industrial device specifications"""
    
    def __init__(self, db_path: str = "industrial_devices.sqlite"):
        self.db_path = db_path
        self._init_database()
        
    def _init_database(self):
        """Initialize database with comprehensive schema"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Industrial devices table with full specifications
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS industrial_devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                manufacturer TEXT NOT NULL,
                model_number TEXT NOT NULL,
                series TEXT,
                category TEXT NOT NULL,
                voltage_rating REAL,
                current_rating REAL,
                communication_protocols TEXT,
                dimensions TEXT,
                certifications TEXT,
                -- Additional industrial-specific fields
                digital_inputs INTEGER,
                analog_inputs INTEGER,
                measurement_range_min REAL,
                measurement_range_max REAL,
                sil_rating TEXT,
                hazardous_area_rating TEXT,
                -- Metadata
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # ISA symbols table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS isa_symbols (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol_type TEXT NOT NULL,
                isa_code TEXT NOT NULL,
                description TEXT,
                category TEXT
            )
        """)
        
        conn.commit()
        conn.close()
```

## Performance Optimization

### Caching Strategy
```python
# Redis caching for performance optimization
import redis
from functools import lru_cache

class PerformanceOptimizer:
    """Performance optimization following BMAD standards"""
    
    def __init__(self):
        self.redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)
        self.recognition_cache = {}
    
    @lru_cache(maxsize=1000)
    def _get_image_hash(self, image_bytes: bytes) -> str:
        """Cache key generation for image recognition"""
        return hashlib.md5(image_bytes).hexdigest()
    
    async def cached_recognition(self, image: np.ndarray, bbox: Tuple[int, int, int, int]):
        """Cache recognition results for performance"""
        cache_key = f"recognition:{self._get_image_hash(image.tobytes())}:{bbox}"
        
        # Check cache first
        cached_result = self.redis_client.get(cache_key)
        if cached_result:
            return json.loads(cached_result)
        
        # Perform recognition and cache result
        result = await self.recognize_component(image, bbox)
        self.redis_client.setex(cache_key, 3600, json.dumps(result, default=str))
        
        return result
```

## Integration Points

### Frontend Integration
```python
# API responses optimized for frontend consumption
class IndustrialAnalysisResponse(BaseModel):
    """Response model for frontend integration"""
    success: bool
    industrial_devices: List[Dict[str, Any]]
    isa_symbols: List[Dict[str, Any]]
    control_loops: List[Dict[str, Any]]
    network_topology: Dict[str, Any]
    processing_time: float
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "industrial_devices": [
                    {
                        "component_id": "industrial_plc_001",
                        "category": "plc",
                        "confidence": 0.95,
                        "specifications": {
                            "manufacturer": "Allen-Bradley",
                            "model_number": "1756-L75"
                        }
                    }
                ],
                "processing_time": 2.5
            }
        }
```

## Monitoring & Observability

### Metrics Collection
```python
# Service metrics for monitoring
class ServiceMetrics:
    """Comprehensive metrics collection per BMAD standards"""
    
    def __init__(self):
        self.recognition_count = 0
        self.total_processing_time = 0.0
        self.accuracy_scores = []
    
    def record_recognition(self, processing_time: float, confidence: float):
        """Record recognition metrics"""
        self.recognition_count += 1
        self.total_processing_time += processing_time
        self.accuracy_scores.append(confidence)
    
    def get_performance_metrics(self) -> Dict[str, Any]:
        """Generate performance report"""
        return {
            "total_recognitions": self.recognition_count,
            "average_processing_time": self.total_processing_time / max(self.recognition_count, 1),
            "average_confidence": np.mean(self.accuracy_scores) if self.accuracy_scores else 0.0,
            "recognition_rate": self.recognition_count / 3600  # per hour
        }
```

This service configuration provides comprehensive guidance for developing the Component Intelligence Service following BMAD Method principles with advanced AI/ML capabilities and Claude Code best practices.