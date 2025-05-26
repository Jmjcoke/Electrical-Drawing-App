# ML Features - Advanced Package
# Advanced machine learning recognition capabilities

from .process_control_features import (
    RealTimeSpecificationIntelligence,
    SpecificationValidator
)

# Aliases for easier access
AdvancedRecognitionEngine = RealTimeSpecificationIntelligence
IntelligentClassifier = SpecificationValidator

__all__ = [
    'AdvancedRecognitionEngine',
    'IntelligentClassifier'
]