# Advanced Features Package
# All premium/enterprise features are organized here for easy activation

__version__ = "1.0.0"
__author__ = "BMAD Development Team"

# Feature availability map
AVAILABLE_FEATURES = {
    "process_control_validation": True,
    "predictive_maintenance": True,
    "control_system_simulation": True,
    "motor_control_analysis": True,
    "building_automation": True,
    "professional_documentation": True,
    "ml_recognition_engine": True,
    "manufacturer_api_integration": True,
    "optimization_algorithms": True,
    "cybersecurity_assessment": True
}

# Easy imports for feature activation
from .process_control_features import ProcessControlValidator, ProcessControlSpecification
from .predictive_maintenance_features import PredictiveMaintenanceEngine, PerformanceMetrics
from .simulation_features import ControlSystemSimulator, OptimizationEngine
from .motor_control_features import MotorControlSystemAnalyzer, VFDAnalyzer
from .building_automation_features import BuildingAutomationAnalyzer, IoTDeviceManager
from .documentation_features import DocumentationGenerator, ProfessionalExporter
from .ml_features import AdvancedRecognitionEngine, IntelligentClassifier
from .api_integration_features import ManufacturerAPIManager, RealTimeDataService

__all__ = [
    'ProcessControlValidator',
    'PredictiveMaintenanceEngine', 
    'ControlSystemSimulator',
    'MotorControlSystemAnalyzer',
    'BuildingAutomationAnalyzer',
    'DocumentationGenerator',
    'AdvancedRecognitionEngine',
    'ManufacturerAPIManager',
    'AVAILABLE_FEATURES'
]