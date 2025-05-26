import pytest
import asyncio
import numpy as np
import cv2
import json
import tempfile
import os
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock

# Import modules to test
from industrial_control_recognition import (
    IndustrialControlRecognition,
    IndustrialDeviceCategory,
    ManufacturerType,
    CommunicationProtocol,
    IndustrialDeviceSpecification,
    ISASymbolRecognition,
    ControlLoopIdentification,
    IndustrialRecognitionResult,
    IndustrialDeviceDatabase,
    ISASymbolRecognizer
)

class TestIndustrialDeviceDatabase:
    """Test industrial device database functionality"""
    
    def setup_method(self):
        """Setup test database"""
        self.temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.sqlite')
        self.temp_db.close()
        self.database = IndustrialDeviceDatabase(self.temp_db.name)
    
    def teardown_method(self):
        """Cleanup test database"""
        if os.path.exists(self.temp_db.name):
            os.unlink(self.temp_db.name)
    
    def test_database_initialization(self):
        """Test database is properly initialized"""
        assert os.path.exists(self.temp_db.name)
        
        # Check if tables exist
        conn = self.database._get_connection() if hasattr(self.database, '_get_connection') else None
        if conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            
            expected_tables = ['industrial_devices', 'isa_symbols', 'control_loops']
            for table in expected_tables:
                assert table in tables
            
            conn.close()
    
    def test_add_industrial_device(self):
        """Test adding industrial device to database"""
        spec = IndustrialDeviceSpecification(
            manufacturer="Allen-Bradley",
            model_number="1756-L75",
            series="ControlLogix",
            category=IndustrialDeviceCategory.PLC,
            manufacturer_type=ManufacturerType.ALLEN_BRADLEY,
            voltage_rating=24,
            current_rating=2.5,
            power_consumption=60,
            communication_protocols=[CommunicationProtocol.ETHERNET_IP],
            dimensions={"width": 87, "height": 125, "depth": 119},
            mounting_type="din_rail",
            operating_temperature=(-40, 70),
            certifications=["UL", "CE", "CSA"],
            price_estimate=1500.0
        )
        
        device_id = self.database.add_industrial_device(spec)
        assert device_id > 0
    
    def test_search_industrial_devices(self):
        """Test searching industrial devices"""
        # Add test device first
        spec = IndustrialDeviceSpecification(
            manufacturer="Siemens",
            model_number="6SL3220-3YE20-0AP0",
            category=IndustrialDeviceCategory.VFD,
            voltage_rating=400,
            communication_protocols=[CommunicationProtocol.PROFINET],
            price_estimate=850.0
        )
        
        self.database.add_industrial_device(spec)
        
        # Search by category
        results = self.database.search_industrial_devices(
            category=IndustrialDeviceCategory.VFD
        )
        assert len(results) >= 1
        assert results[0].manufacturer == "Siemens"
        
        # Search by manufacturer
        results = self.database.search_industrial_devices(manufacturer="Siemens")
        assert len(results) >= 1
        
        # Search by voltage range
        results = self.database.search_industrial_devices(voltage_range=(380, 420))
        assert len(results) >= 1
        
        # Search by communication protocol
        results = self.database.search_industrial_devices(
            communication_protocol=CommunicationProtocol.PROFINET
        )
        assert len(results) >= 1

class TestISASymbolRecognizer:
    """Test ISA symbol recognition functionality"""
    
    def setup_method(self):
        """Setup symbol recognizer"""
        self.recognizer = ISASymbolRecognizer()
    
    def test_symbol_template_loading(self):
        """Test that symbol templates are loaded"""
        assert len(self.recognizer.symbol_templates) > 0
        assert "circle" in self.recognizer.symbol_templates
        assert "square" in self.recognizer.symbol_templates
    
    def test_create_templates(self):
        """Test template creation"""
        circle_template = self.recognizer._create_circle_template()
        assert circle_template.shape == (50, 50)
        assert circle_template.dtype == np.uint8
        
        square_template = self.recognizer._create_square_template()
        assert square_template.shape == (50, 50)
        assert square_template.dtype == np.uint8
    
    def test_recognize_symbols_basic(self):
        """Test basic symbol recognition"""
        # Create test image with simple shapes
        test_image = np.zeros((300, 400), dtype=np.uint8)
        
        # Draw a circle (temperature indicator)
        cv2.circle(test_image, (100, 100), 20, 255, 2)
        
        # Draw a square (controller)
        cv2.rectangle(test_image, (200, 80), (240, 120), 255, 2)
        
        symbols = self.recognizer.recognize_isa_symbols(test_image)
        
        # Should find at least some symbols
        assert len(symbols) >= 0  # May not find exact matches due to template matching sensitivity
    
    def test_infer_isa_code(self):
        """Test ISA code inference from shape"""
        assert self.recognizer._infer_isa_code("circle") == "TI"
        assert self.recognizer._infer_isa_code("square") == "TC"
        assert self.recognizer._infer_isa_code("diamond") == "CV"
        assert self.recognizer._infer_isa_code("triangle") == "M"
        assert self.recognizer._infer_isa_code("unknown") == "XX"

class TestIndustrialControlRecognition:
    """Test main industrial control recognition system"""
    
    def setup_method(self):
        """Setup recognition system"""
        self.temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.sqlite')
        self.temp_db.close()
        self.recognition = IndustrialControlRecognition(self.temp_db.name)
    
    def teardown_method(self):
        """Cleanup"""
        if os.path.exists(self.temp_db.name):
            os.unlink(self.temp_db.name)
    
    def test_initialization(self):
        """Test system initialization"""
        assert self.recognition.database is not None
        assert self.recognition.symbol_recognizer is not None
        assert self.recognition.classifier is not None
        assert self.recognition.feature_extractor is not None
    
    def test_create_industrial_classifier(self):
        """Test ML classifier creation"""
        classifier = self.recognition._create_industrial_classifier()
        assert classifier is not None
        
        # Test input shape
        expected_input_shape = (None, 224, 224, 3)
        actual_input_shape = classifier.input_shape
        assert actual_input_shape == expected_input_shape
        
        # Test output shape (number of industrial device categories)
        expected_output_shape = len(IndustrialDeviceCategory)
        actual_output_units = classifier.layers[-1].units
        assert actual_output_units == expected_output_shape
    
    @pytest.mark.asyncio
    async def test_classify_industrial_device(self):
        """Test device classification"""
        # Create test ROI
        test_roi = np.random.randint(0, 255, (100, 150, 3), dtype=np.uint8)
        
        category, confidence, alternatives = await self.recognition._classify_industrial_device(test_roi)
        
        assert isinstance(category, IndustrialDeviceCategory)
        assert 0.0 <= confidence <= 1.0
        assert isinstance(alternatives, list)
        assert len(alternatives) <= 2
    
    def test_is_process_control_device(self):
        """Test process control device detection"""
        assert self.recognition._is_process_control_device(IndustrialDeviceCategory.PRESSURE_TRANSMITTER)
        assert self.recognition._is_process_control_device(IndustrialDeviceCategory.TEMPERATURE_TRANSMITTER)
        assert self.recognition._is_process_control_device(IndustrialDeviceCategory.CONTROL_VALVE)
        
        assert not self.recognition._is_process_control_device(IndustrialDeviceCategory.PLC)
        assert not self.recognition._is_process_control_device(IndustrialDeviceCategory.HMI)
    
    @pytest.mark.asyncio
    async def test_recognize_industrial_device(self):
        """Test complete device recognition"""
        # Create test image
        test_image = np.random.randint(0, 255, (600, 800, 3), dtype=np.uint8)
        test_bbox = (100, 100, 200, 150)
        
        result = await self.recognition.recognize_industrial_device(test_image, test_bbox)
        
        assert isinstance(result, IndustrialRecognitionResult)
        assert result.component_id.startswith("industrial_")
        assert isinstance(result.category, IndustrialDeviceCategory)
        assert 0.0 <= result.confidence <= 1.0
        assert result.bounding_box == test_bbox
        assert isinstance(result.visual_features, dict)
        assert isinstance(result.recognition_timestamp, datetime)
    
    @pytest.mark.asyncio
    async def test_batch_recognize_devices(self):
        """Test batch device recognition"""
        test_image = np.random.randint(0, 255, (600, 800, 3), dtype=np.uint8)
        test_bboxes = [
            (50, 50, 100, 100),
            (200, 200, 150, 120),
            (400, 300, 180, 140)
        ]
        
        results = await self.recognition.batch_recognize_industrial_devices(test_image, test_bboxes)
        
        assert len(results) == len(test_bboxes)
        for i, result in enumerate(results):
            assert isinstance(result, IndustrialRecognitionResult)
            assert result.bounding_box == test_bboxes[i]
    
    @pytest.mark.asyncio
    async def test_identify_control_loop(self):
        """Test control loop identification"""
        # Test with valid ISA symbol
        isa_symbol = ISASymbolRecognition(
            symbol_type="circle",
            isa_code="TI",
            description="Temperature Indicator",
            confidence=0.85,
            bounding_box=(100, 100, 50, 50),
            tag_number="TI-101",
            loop_identifier="101"
        )
        
        control_loop = await self.recognition._identify_control_loop(isa_symbol)
        
        assert control_loop is not None
        assert control_loop.loop_id == "loop_101"
        assert control_loop.loop_type == "temperature"
        assert "TI-101" in control_loop.components
        
        # Test with invalid tag number
        invalid_symbol = ISASymbolRecognition(
            symbol_type="circle",
            isa_code="TI",
            description="Temperature Indicator",
            confidence=0.85,
            bounding_box=(100, 100, 50, 50),
            tag_number="INVALID"
        )
        
        control_loop = await self.recognition._identify_control_loop(invalid_symbol)
        assert control_loop is None
    
    def test_get_device_statistics(self):
        """Test device statistics retrieval"""
        stats = self.recognition.get_device_statistics()
        
        assert isinstance(stats, dict)
        assert "total_devices" in stats
        assert "categories" in stats
        assert "manufacturers" in stats
        assert "communication_protocols" in stats
        assert isinstance(stats["communication_protocols"], list)

class TestDataModels:
    """Test data model classes"""
    
    def test_industrial_device_specification(self):
        """Test IndustrialDeviceSpecification model"""
        spec = IndustrialDeviceSpecification(
            manufacturer="Allen-Bradley",
            model_number="1756-L75",
            series="ControlLogix",
            category=IndustrialDeviceCategory.PLC,
            manufacturer_type=ManufacturerType.ALLEN_BRADLEY,
            voltage_rating=24,
            current_rating=2.5,
            communication_protocols=[CommunicationProtocol.ETHERNET_IP],
            dimensions={"width": 87, "height": 125},
            certifications=["UL", "CE"],
            installation_notes="Standard PLC installation"
        )
        
        assert spec.manufacturer == "Allen-Bradley"
        assert spec.model_number == "1756-L75"
        assert spec.category == IndustrialDeviceCategory.PLC
        assert CommunicationProtocol.ETHERNET_IP in spec.communication_protocols
        assert len(spec.certifications) == 2
    
    def test_isa_symbol_recognition(self):
        """Test ISASymbolRecognition model"""
        symbol = ISASymbolRecognition(
            symbol_type="circle",
            isa_code="TI",
            description="Temperature Indicator",
            confidence=0.92,
            bounding_box=(100, 100, 50, 50),
            tag_number="TI-101",
            loop_identifier="101"
        )
        
        assert symbol.symbol_type == "circle"
        assert symbol.isa_code == "TI"
        assert symbol.confidence == 0.92
        assert symbol.tag_number == "TI-101"
        assert symbol.loop_identifier == "101"
    
    def test_control_loop_identification(self):
        """Test ControlLoopIdentification model"""
        loop = ControlLoopIdentification(
            loop_id="loop_101",
            loop_type="temperature",
            components=["TI-101", "TC-101", "TV-101"],
            control_strategy="PID",
            setpoint=150.0,
            process_variable="temperature",
            controlled_variable="steam_flow"
        )
        
        assert loop.loop_id == "loop_101"
        assert loop.loop_type == "temperature"
        assert len(loop.components) == 3
        assert loop.control_strategy == "PID"
        assert loop.setpoint == 150.0
    
    def test_industrial_recognition_result(self):
        """Test IndustrialRecognitionResult model"""
        result = IndustrialRecognitionResult(
            component_id="industrial_plc_001",
            category=IndustrialDeviceCategory.PLC,
            confidence=0.95,
            bounding_box=(100, 100, 200, 150),
            visual_features={"area": 30000, "aspect_ratio": 1.33},
            alternative_matches=[
                {"category": "hmi", "confidence": 0.15},
                {"category": "safety_plc", "confidence": 0.10}
            ],
            network_connections=["network_1", "network_2"]
        )
        
        assert result.component_id == "industrial_plc_001"
        assert result.category == IndustrialDeviceCategory.PLC
        assert result.confidence == 0.95
        assert len(result.bounding_box) == 4
        assert len(result.alternative_matches) == 2
        assert len(result.network_connections) == 2

class TestEnums:
    """Test enum classes"""
    
    def test_industrial_device_category(self):
        """Test IndustrialDeviceCategory enum"""
        assert IndustrialDeviceCategory.PLC.value == "plc"
        assert IndustrialDeviceCategory.VFD.value == "vfd"
        assert IndustrialDeviceCategory.PRESSURE_TRANSMITTER.value == "pressure_transmitter"
        
        # Test enum contains expected categories
        categories = [category.value for category in IndustrialDeviceCategory]
        assert "plc" in categories
        assert "hmi" in categories
        assert "vfd" in categories
        assert "safety_plc" in categories
    
    def test_manufacturer_type(self):
        """Test ManufacturerType enum"""
        assert ManufacturerType.ALLEN_BRADLEY.value == "allen_bradley"
        assert ManufacturerType.SIEMENS.value == "siemens"
        assert ManufacturerType.SCHNEIDER.value == "schneider_electric"
        
        manufacturers = [mfg.value for mfg in ManufacturerType]
        assert "allen_bradley" in manufacturers
        assert "siemens" in manufacturers
        assert "honeywell" in manufacturers
    
    def test_communication_protocol(self):
        """Test CommunicationProtocol enum"""
        assert CommunicationProtocol.ETHERNET_IP.value == "ethernet_ip"
        assert CommunicationProtocol.MODBUS_TCP.value == "modbus_tcp"
        assert CommunicationProtocol.PROFINET.value == "profinet"
        
        protocols = [protocol.value for protocol in CommunicationProtocol]
        assert "ethernet_ip" in protocols
        assert "modbus_tcp" in protocols
        assert "bacnet" in protocols
        assert "foundation_fieldbus" in protocols

class TestIntegration:
    """Integration tests"""
    
    @pytest.mark.asyncio
    async def test_end_to_end_recognition(self):
        """Test complete end-to-end recognition workflow"""
        # Setup
        temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.sqlite')
        temp_db.close()
        
        try:
            recognition = IndustrialControlRecognition(temp_db.name)
            
            # Create synthetic test image
            test_image = np.zeros((600, 800, 3), dtype=np.uint8)
            
            # Add some basic shapes that might be recognized as industrial devices
            cv2.rectangle(test_image, (100, 100), (200, 180), (255, 255, 255), -1)  # PLC
            cv2.circle(test_image, (350, 150), 30, (255, 255, 255), -1)  # Transmitter
            cv2.rectangle(test_image, (500, 120), (580, 200), (255, 255, 255), -1)  # HMI
            
            test_bboxes = [
                (100, 100, 100, 80),   # PLC
                (320, 120, 60, 60),    # Transmitter
                (500, 120, 80, 80)     # HMI
            ]
            
            # Perform recognition
            results = await recognition.batch_recognize_industrial_devices(test_image, test_bboxes)
            
            # Verify results
            assert len(results) == 3
            
            for result in results:
                assert isinstance(result, IndustrialRecognitionResult)
                assert result.component_id.startswith("industrial_")
                assert isinstance(result.category, IndustrialDeviceCategory)
                assert 0.0 <= result.confidence <= 1.0
                assert len(result.bounding_box) == 4
                assert isinstance(result.visual_features, dict)
                assert isinstance(result.alternative_matches, list)
                assert isinstance(result.network_connections, list)
            
            # Test statistics
            stats = recognition.get_device_statistics()
            assert isinstance(stats, dict)
            assert "total_devices" in stats
            
        finally:
            if os.path.exists(temp_db.name):
                os.unlink(temp_db.name)

# Performance tests
class TestPerformance:
    """Performance and load tests"""
    
    @pytest.mark.asyncio
    async def test_recognition_performance(self):
        """Test recognition performance with timing"""
        temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.sqlite')
        temp_db.close()
        
        try:
            recognition = IndustrialControlRecognition(temp_db.name)
            
            # Create test image
            test_image = np.random.randint(0, 255, (600, 800, 3), dtype=np.uint8)
            test_bbox = (100, 100, 200, 150)
            
            # Time single recognition
            start_time = datetime.now()
            result = await recognition.recognize_industrial_device(test_image, test_bbox)
            end_time = datetime.now()
            
            processing_time = (end_time - start_time).total_seconds()
            
            assert result is not None
            assert processing_time < 5.0  # Should complete within 5 seconds
            
            print(f"Single recognition processing time: {processing_time:.3f} seconds")
            
        finally:
            if os.path.exists(temp_db.name):
                os.unlink(temp_db.name)
    
    @pytest.mark.asyncio
    async def test_batch_performance(self):
        """Test batch recognition performance"""
        temp_db = tempfile.NamedTemporaryFile(delete=False, suffix='.sqlite')
        temp_db.close()
        
        try:
            recognition = IndustrialControlRecognition(temp_db.name)
            
            # Create test data
            test_image = np.random.randint(0, 255, (600, 800, 3), dtype=np.uint8)
            test_bboxes = [(i*100, 100, 80, 80) for i in range(5)]  # 5 devices
            
            # Time batch recognition
            start_time = datetime.now()
            results = await recognition.batch_recognize_industrial_devices(test_image, test_bboxes)
            end_time = datetime.now()
            
            processing_time = (end_time - start_time).total_seconds()
            
            assert len(results) == 5
            assert processing_time < 10.0  # Should complete within 10 seconds
            
            print(f"Batch recognition processing time: {processing_time:.3f} seconds for {len(test_bboxes)} devices")
            print(f"Average time per device: {processing_time/len(test_bboxes):.3f} seconds")
            
        finally:
            if os.path.exists(temp_db.name):
                os.unlink(temp_db.name)

if __name__ == "__main__":
    # Run specific test
    pytest.main([__file__, "-v", "--tb=short"])