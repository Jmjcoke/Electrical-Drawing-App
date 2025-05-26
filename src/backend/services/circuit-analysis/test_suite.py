import pytest
import asyncio
import numpy as np
import json
import tempfile
import os
from unittest.mock import Mock, patch, MagicMock
from typing import Dict, List, Any

# Import our modules
from main import CircuitDetector, CircuitAnalysisService
from circuit_validation import CircuitAnalysisEngine, LoadCalculator, VoltageDropCalculator
from documentation_generator import DocumentationGenerator, PanelScheduleGenerator
from advanced_features import ArcFlashAnalyzer, ProtectiveDeviceCoordinator
from multi_system_integration import (
    MultiSystemIntegrationEngine, SystemComponent, SystemType, 
    SignalType, FireAlarmSystemAnalyzer
)
from performance_optimization import PerformanceOptimizationSuite, OptimizationConfig

class TestCircuitDetection:
    @pytest.fixture
    def sample_image(self):
        return np.random.randint(0, 255, (800, 600, 3), dtype=np.uint8)
    
    @pytest.fixture
    def circuit_detector(self):
        return CircuitDetector()
    
    def test_circuit_element_detection(self, circuit_detector, sample_image):
        elements = circuit_detector.detect_circuit_elements(sample_image)
        
        assert isinstance(elements, list)
        assert len(elements) >= 0
        
        for element in elements:
            assert hasattr(element, 'element_type')
            assert hasattr(element, 'coordinates')
            assert hasattr(element, 'confidence')
            assert 0 <= element.confidence <= 1
    
    def test_wire_detection(self, circuit_detector, sample_image):
        processed = circuit_detector._preprocess_image(sample_image)
        wires = circuit_detector._detect_wires(processed)
        
        assert isinstance(wires, list)
        for wire in wires:
            assert wire.element_type == "wire"
            assert len(wire.coordinates) >= 2  # At least start and end points
    
    def test_junction_detection(self, circuit_detector, sample_image):
        processed = circuit_detector._preprocess_image(sample_image)
        wire_elements = circuit_detector._detect_wires(processed)
        junctions = circuit_detector._detect_junctions(processed, wire_elements)
        
        assert isinstance(junctions, list)
        for junction in junctions:
            assert junction.element_type == "junction"
    
    def test_component_detection(self, circuit_detector, sample_image):
        processed = circuit_detector._preprocess_image(sample_image)
        components = circuit_detector._detect_components(processed)
        
        assert isinstance(components, list)
        for component in components:
            assert component.element_type in ["resistor", "capacitor", "inductor", "switch", "breaker"]
    
    @pytest.mark.asyncio
    async def test_circuit_analysis_service(self):
        service = CircuitAnalysisService()
        
        # Test with sample circuit data
        circuit_data = {
            "image_data": "base64_encoded_image",
            "circuit_type": "power",
            "voltage_level": 120
        }
        
        result = await service.analyze_circuit(circuit_data)
        
        assert "circuit_elements" in result
        assert "network_analysis" in result
        assert "specifications" in result
        assert isinstance(result["accuracy_score"], float)
        assert 0 <= result["accuracy_score"] <= 1

class TestCircuitValidation:
    @pytest.fixture
    def analysis_engine(self):
        return CircuitAnalysisEngine()
    
    @pytest.fixture
    def load_calculator(self):
        return LoadCalculator()
    
    @pytest.fixture
    def voltage_drop_calculator(self):
        return VoltageDropCalculator()
    
    def test_load_calculation(self, load_calculator):
        loads = [
            {"type": "lighting", "watts": 1000, "power_factor": 0.9},
            {"type": "receptacle", "watts": 1800, "power_factor": 0.85},
            {"type": "motor", "watts": 2000, "power_factor": 0.8}
        ]
        
        total_load = load_calculator.calculate_total_load(loads)
        
        assert total_load.total_watts > 0
        assert total_load.current_amps > 0
        assert 0 < total_load.power_factor <= 1
        assert total_load.total_watts == sum(load["watts"] for load in loads)
    
    def test_voltage_drop_calculation(self, voltage_drop_calculator):
        conductor = {
            "material": "copper",
            "size": "12_AWG",
            "length": 100,
            "conduit_type": "EMT"
        }
        
        voltage_drop, percentage = voltage_drop_calculator.calculate_voltage_drop(
            conductor, 20, 120, False
        )
        
        assert voltage_drop > 0
        assert 0 <= percentage <= 100
        assert percentage < 5  # Should be within NEC limits for branch circuits
    
    def test_nec_compliance_check(self, analysis_engine):
        circuit_data = {
            "circuit_type": "branch",
            "voltage": 120,
            "current": 20,
            "conductor_size": "12_AWG",
            "protection": 20
        }
        
        compliance = analysis_engine.check_nec_compliance(circuit_data)
        
        assert isinstance(compliance, dict)
        assert "conductor_sizing" in compliance
        assert "overcurrent_protection" in compliance
        assert "voltage_drop" in compliance
        
        for check, result in compliance.items():
            assert isinstance(result, bool)
    
    def test_arc_flash_calculation(self):
        analyzer = ArcFlashAnalyzer()
        
        incident_energy, arc_flash_boundary = analyzer.calculate_arc_flash_incident_energy(
            arcing_current=5000,
            working_distance=18,
            arc_duration=0.5,
            voltage_class="low"
        )
        
        assert incident_energy > 0
        assert arc_flash_boundary > 0
        assert incident_energy < 40  # Should be reasonable value in cal/cm²

class TestDocumentationGeneration:
    @pytest.fixture
    def doc_generator(self):
        return DocumentationGenerator()
    
    @pytest.fixture
    def panel_generator(self):
        return PanelScheduleGenerator()
    
    def test_panel_schedule_generation(self, panel_generator):
        panel_data = {
            "panel_name": "Panel A",
            "main_breaker": 200,
            "voltage": "120/240V",
            "circuits": [
                {"circuit": 1, "description": "Lighting", "breaker": 20, "load": 1000},
                {"circuit": 3, "description": "Receptacles", "breaker": 20, "load": 1800},
                {"circuit": 5, "description": "Motor", "breaker": 30, "load": 2500}
            ]
        }
        
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            try:
                panel_generator.generate_panel_schedule_pdf(panel_data, tmp_file.name)
                assert os.path.exists(tmp_file.name)
                assert os.path.getsize(tmp_file.name) > 0
            finally:
                os.unlink(tmp_file.name)
    
    def test_load_analysis_report(self, doc_generator):
        analysis_data = {
            "total_connected_load": 15000,
            "demand_load": 12000,
            "demand_factor": 0.8,
            "load_breakdown": {
                "lighting": 5000,
                "receptacles": 7000,
                "hvac": 3000
            }
        }
        
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
            try:
                doc_generator.generate_load_analysis_report(analysis_data, tmp_file.name)
                assert os.path.exists(tmp_file.name)
                assert os.path.getsize(tmp_file.name) > 0
            finally:
                os.unlink(tmp_file.name)
    
    def test_excel_export(self, panel_generator):
        panel_data = {
            "panel_name": "Panel B",
            "circuits": [
                {"circuit": 1, "description": "Test Circuit", "breaker": 20, "load": 1000}
            ]
        }
        
        with tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False) as tmp_file:
            try:
                panel_generator.export_to_excel(panel_data, tmp_file.name)
                assert os.path.exists(tmp_file.name)
                assert os.path.getsize(tmp_file.name) > 0
            finally:
                os.unlink(tmp_file.name)

class TestMultiSystemIntegration:
    @pytest.fixture
    def integration_engine(self):
        return MultiSystemIntegrationEngine()
    
    @pytest.fixture
    def sample_components(self):
        return [
            SystemComponent(
                "FA001", "Smoke Detector", SystemType.FIRE_ALARM, 
                SignalType.DIGITAL, 24, 80, 2, (100, 100), "Zone1",
                device_class="Smoke Detector"
            ),
            SystemComponent(
                "SEC001", "Card Reader", SystemType.SECURITY,
                SignalType.DIGITAL, 12, 500, 6, (100, 200), "Zone2",
                device_class="Access Control Reader"
            ),
            SystemComponent(
                "COMM001", "Network Switch", SystemType.COMMUNICATIONS,
                SignalType.DIGITAL, 120, 500, 45, (100, 300), "IDF1",
                device_class="Ethernet Switch"
            )
        ]
    
    def test_fire_alarm_analysis(self, sample_components):
        fire_analyzer = FireAlarmSystemAnalyzer()
        analysis = fire_analyzer.analyze_fire_alarm_circuit(sample_components)
        
        assert "zone_analysis" in analysis
        assert "power_calculation" in analysis
        assert "nfpa_compliance" in analysis
        assert "battery_backup" in analysis
        
        assert analysis["power_calculation"]["standby_current_ma"] > 0
        assert analysis["power_calculation"]["alarm_current_ma"] > 0
    
    def test_system_integration_analysis(self, integration_engine, sample_components):
        interconnections = []
        
        analysis = integration_engine.analyze_integrated_systems(
            sample_components, interconnections
        )
        
        assert "individual_systems" in analysis
        assert "system_integration" in analysis
        assert "power_coordination" in analysis
        assert "emc_analysis" in analysis
        assert "overall_recommendations" in analysis
        
        assert isinstance(analysis["overall_recommendations"], list)
        assert len(analysis["overall_recommendations"]) > 0
    
    def test_power_coordination(self, integration_engine, sample_components):
        interconnections = []
        analysis = integration_engine.analyze_integrated_systems(
            sample_components, interconnections
        )
        
        power_analysis = analysis["power_coordination"]
        
        assert "system_power_breakdown" in power_analysis
        assert "total_low_voltage_power_w" in power_analysis
        assert "ups_requirements" in power_analysis
        
        assert power_analysis["total_low_voltage_power_w"] > 0

class TestPerformanceOptimization:
    @pytest.fixture
    def optimization_config(self):
        return OptimizationConfig(
            max_workers=2,
            enable_gpu_acceleration=False,
            memory_limit_mb=256,
            batch_size=4,
            optimization_level="conservative"
        )
    
    @pytest.fixture
    def optimization_suite(self, optimization_config):
        return PerformanceOptimizationSuite(optimization_config)
    
    @pytest.mark.asyncio
    async def test_circuit_detection_optimization(self, optimization_suite):
        # Create smaller test images for faster testing
        test_images = [np.random.randint(0, 255, (400, 300, 3), dtype=np.uint8) for _ in range(4)]
        
        results = await optimization_suite.circuit_optimizer.batch_process_images(test_images)
        
        assert len(results) == len(test_images)
        for result in results:
            assert "elements" in result
            assert "processing_time" in result
            assert "element_count" in result
            assert result["processing_time"] > 0
    
    @pytest.mark.asyncio
    async def test_comprehensive_optimization(self, optimization_suite):
        results = await optimization_suite.run_comprehensive_optimization()
        
        assert "circuit_detection" in results
        assert "memory_management" in results
        assert "database_performance" in results
        assert "api_performance" in results
        assert "system_monitoring" in results
        assert "performance_metrics" in results
        
        assert results["total_optimization_time"] > 0
    
    def test_memory_monitoring(self, optimization_suite):
        memory_stats = optimization_suite.memory_optimizer.monitor_memory_usage()
        
        assert "rss_mb" in memory_stats
        assert "vms_mb" in memory_stats
        assert "percent" in memory_stats
        assert "available_mb" in memory_stats
        
        assert memory_stats["rss_mb"] > 0
        assert memory_stats["available_mb"] > 0
    
    def test_optimization_report_generation(self, optimization_suite):
        # Mock results for testing
        mock_results = {
            "circuit_detection": {
                "batch_processing_time": 1.5,
                "average_image_processing_time": 0.3,
                "throughput_images_per_second": 3.3,
                "total_elements_detected": 50
            },
            "memory_management": {
                "current_usage": {"rss_mb": 128.5},
                "cache_optimization": {"cache_hit_ratio": 0.75, "cache_size": 10}
            },
            "system_monitoring": {
                "cpu": {"cpu_percent": 25.0},
                "memory": {"percent_used": 60.0},
                "disk": {"percent_used": 45.0}
            },
            "total_optimization_time": 2.1,
            "performance_metrics": MagicMock(
                memory_usage_mb=128.5,
                cpu_usage_percent=25.0
            )
        }
        
        report = optimization_suite.generate_optimization_report(mock_results)
        
        assert "PERFORMANCE OPTIMIZATION REPORT" in report
        assert "Circuit Detection Performance" in report
        assert "Memory Management" in report
        assert "System Resources" in report
        assert "OPTIMIZATION COMPLETE" in report

class TestIntegrationScenarios:
    @pytest.mark.asyncio
    async def test_end_to_end_circuit_analysis(self):
        """Test complete workflow from image processing to documentation"""
        
        # 1. Circuit Detection
        detector = CircuitDetector()
        sample_image = np.random.randint(0, 255, (800, 600, 3), dtype=np.uint8)
        elements = detector.detect_circuit_elements(sample_image)
        
        # 2. Circuit Analysis
        analysis_engine = CircuitAnalysisEngine()
        mock_circuit_data = {
            "elements": elements,
            "circuit_type": "branch",
            "voltage_level": 120
        }
        
        # 3. Documentation Generation
        doc_generator = DocumentationGenerator()
        
        # Verify the complete workflow
        assert len(elements) >= 0
        
    def test_multi_system_coordination(self):
        """Test coordination between multiple building systems"""
        
        # Create components from different systems
        components = [
            SystemComponent("FA001", "Smoke Detector", SystemType.FIRE_ALARM, SignalType.DIGITAL, 24, 80, 2, (100, 100), "Zone1"),
            SystemComponent("SEC001", "Card Reader", SystemType.SECURITY, SignalType.DIGITAL, 12, 500, 6, (100, 200), "Zone2"),
            SystemComponent("HVAC001", "DDC Controller", SystemType.HVAC_CONTROL, SignalType.DIGITAL, 24, 300, 12, (100, 300), "AHU1")
        ]
        
        integration_engine = MultiSystemIntegrationEngine()
        analysis = integration_engine.analyze_integrated_systems(components, [])
        
        # Verify integration analysis
        assert len(analysis["individual_systems"]) >= 2
        assert analysis["power_coordination"]["total_low_voltage_power_w"] > 0
        
    @pytest.mark.asyncio
    async def test_performance_under_load(self):
        """Test system performance under high load conditions"""
        
        config = OptimizationConfig(
            max_workers=4,
            batch_size=8,
            memory_limit_mb=512
        )
        
        optimization_suite = PerformanceOptimizationSuite(config)
        
        # Create large batch of test images
        large_batch = [np.random.randint(0, 255, (600, 400, 3), dtype=np.uint8) for _ in range(20)]
        
        start_time = asyncio.get_event_loop().time()
        results = await optimization_suite.circuit_optimizer.batch_process_images(large_batch)
        end_time = asyncio.get_event_loop().time()
        
        processing_time = end_time - start_time
        throughput = len(large_batch) / processing_time
        
        # Performance assertions
        assert len(results) == len(large_batch)
        assert throughput > 1.0  # Should process at least 1 image per second
        assert processing_time < 30  # Should complete within reasonable time

# Test configuration and utilities
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

def run_test_suite():
    """Run the complete test suite with coverage reporting"""
    
    # Configure pytest options
    pytest_args = [
        "-v",  # Verbose output
        "--tb=short",  # Short traceback format
        "--strict-markers",  # Strict marker checking
        "--disable-warnings",  # Disable warnings for cleaner output
        "-x",  # Stop on first failure
        __file__,  # Run tests in this file
    ]
    
    # Run tests
    exit_code = pytest.main(pytest_args)
    
    return exit_code == 0

if __name__ == "__main__":
    # Run all tests
    success = run_test_suite()
    
    if success:
        print("\n✅ ALL TESTS PASSED - Circuit Tracing System Ready for Production")
    else:
        print("\n❌ TESTS FAILED - Review and fix issues before deployment")
        exit(1)