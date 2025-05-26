"""
Feature Manager for Component Intelligence Service
Easily enable/disable advanced features for different deployment tiers
"""

import logging
from typing import Dict, Any, Optional
from enum import Enum

logger = logging.getLogger(__name__)

class DeploymentTier(Enum):
    """Deployment tiers with different feature sets"""
    MVP = "mvp"                    # Basic functionality only
    PROFESSIONAL = "professional"  # Advanced features enabled
    ENTERPRISE = "enterprise"      # All features + premium support

class FeatureManager:
    """Centralized feature management"""
    
    def __init__(self, tier: DeploymentTier = DeploymentTier.MVP):
        self.tier = tier
        self.enabled_features = self._get_features_for_tier(tier)
        self._feature_instances = {}
    
    def _get_features_for_tier(self, tier: DeploymentTier) -> Dict[str, bool]:
        """Get enabled features for deployment tier"""
        
        if tier == DeploymentTier.MVP:
            return {
                "basic_specifications": True,
                "simple_io_generation": True,
                "basic_tag_generation": True,
                "local_database": True,
                # Advanced features disabled for MVP
                "advanced_ml": False,
                "real_time_apis": False,
                "process_control": False,
                "predictive_maintenance": False,
                "simulation": False,
                "optimization": False,
                "professional_docs": False,
                "building_automation": False,
                "motor_control": False,
                "cybersecurity": False
            }
        
        elif tier == DeploymentTier.PROFESSIONAL:
            return {
                # All MVP features
                "basic_specifications": True,
                "simple_io_generation": True,
                "basic_tag_generation": True,
                "local_database": True,
                # Professional features
                "advanced_ml": True,
                "real_time_apis": True,
                "process_control": True,
                "professional_docs": True,
                "building_automation": True,
                "motor_control": True,
                # Enterprise features still disabled
                "predictive_maintenance": False,
                "simulation": False,
                "optimization": False,
                "cybersecurity": False
            }
        
        else:  # ENTERPRISE
            return {
                # All features enabled
                "basic_specifications": True,
                "simple_io_generation": True,
                "basic_tag_generation": True,
                "local_database": True,
                "advanced_ml": True,
                "real_time_apis": True,
                "process_control": True,
                "predictive_maintenance": True,
                "simulation": True,
                "optimization": True,
                "professional_docs": True,
                "building_automation": True,
                "motor_control": True,
                "cybersecurity": True
            }
    
    def is_enabled(self, feature_name: str) -> bool:
        """Check if a feature is enabled"""
        return self.enabled_features.get(feature_name, False)
    
    def get_feature_instance(self, feature_name: str) -> Optional[Any]:
        """Get instance of advanced feature if enabled"""
        
        if not self.is_enabled(feature_name):
            logger.warning(f"Feature '{feature_name}' not available in {self.tier.value} tier")
            return None
        
        # Lazy loading of feature instances
        if feature_name not in self._feature_instances:
            self._feature_instances[feature_name] = self._create_feature_instance(feature_name)
        
        return self._feature_instances[feature_name]
    
    def _create_feature_instance(self, feature_name: str) -> Optional[Any]:
        """Create instance of advanced feature"""
        
        try:
            if feature_name == "advanced_ml":
                from .advanced_features.ml_features import AdvancedRecognitionEngine
                return AdvancedRecognitionEngine()
            
            elif feature_name == "real_time_apis":
                from .advanced_features.api_integration_features import ManufacturerAPIManager
                return ManufacturerAPIManager()
            
            elif feature_name == "process_control":
                from .advanced_features.process_control_features import ProcessControlValidator
                return ProcessControlValidator()
            
            elif feature_name == "predictive_maintenance":
                from .advanced_features.predictive_maintenance_features import PredictiveMaintenanceEngine
                return PredictiveMaintenanceEngine()
            
            elif feature_name == "simulation":
                from .advanced_features.simulation_features import ControlSystemSimulator
                return ControlSystemSimulator()
            
            elif feature_name == "optimization":
                from .advanced_features.simulation_features import ControlSystemOptimizer
                return ControlSystemOptimizer()
            
            elif feature_name == "professional_docs":
                from .advanced_features.documentation_features import ControlSystemDocumentationGenerator
                return ControlSystemDocumentationGenerator()
            
            elif feature_name == "building_automation":
                from .advanced_features.building_automation_features import BuildingAutomationAnalyzer
                return BuildingAutomationAnalyzer()
            
            elif feature_name == "motor_control":
                from .advanced_features.motor_control_features import MotorControlSystemAnalyzer
                return MotorControlSystemAnalyzer()
            
            else:
                logger.warning(f"Unknown feature: {feature_name}")
                return None
                
        except ImportError as e:
            logger.error(f"Failed to import feature '{feature_name}': {e}")
            return None
    
    def upgrade_tier(self, new_tier: DeploymentTier):
        """Upgrade to a higher tier"""
        if new_tier.value > self.tier.value:
            self.tier = new_tier
            self.enabled_features = self._get_features_for_tier(new_tier)
            self._feature_instances.clear()  # Clear cache to reload with new features
            logger.info(f"Upgraded to {new_tier.value} tier")
        else:
            logger.warning(f"Cannot downgrade from {self.tier.value} to {new_tier.value}")
    
    def get_feature_summary(self) -> Dict[str, Any]:
        """Get summary of available features"""
        return {
            "deployment_tier": self.tier.value,
            "enabled_features": self.enabled_features,
            "feature_count": sum(1 for enabled in self.enabled_features.values() if enabled),
            "upgrade_available": self.tier != DeploymentTier.ENTERPRISE
        }

# Global feature manager instance
_feature_manager = None

def get_feature_manager(tier: DeploymentTier = DeploymentTier.MVP) -> FeatureManager:
    """Get global feature manager instance"""
    global _feature_manager
    
    if _feature_manager is None:
        _feature_manager = FeatureManager(tier)
    
    return _feature_manager

def set_deployment_tier(tier: DeploymentTier):
    """Set deployment tier globally"""
    global _feature_manager
    _feature_manager = FeatureManager(tier)
    logger.info(f"Set deployment tier to: {tier.value}")

# Convenience functions
def is_feature_enabled(feature_name: str) -> bool:
    """Check if feature is enabled in current tier"""
    return get_feature_manager().is_enabled(feature_name)

def get_advanced_feature(feature_name: str) -> Optional[Any]:
    """Get advanced feature instance if available"""
    return get_feature_manager().get_feature_instance(feature_name)

# Easy tier activation functions
def enable_mvp_features():
    """Enable MVP features only"""
    set_deployment_tier(DeploymentTier.MVP)

def enable_professional_features():
    """Enable Professional tier features"""
    set_deployment_tier(DeploymentTier.PROFESSIONAL)

def enable_enterprise_features():
    """Enable all Enterprise features"""
    set_deployment_tier(DeploymentTier.ENTERPRISE)