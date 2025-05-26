"""
Advanced Circuit Analysis Features

Implements fault analysis, arc flash studies, and protective device coordination.
"""

from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum
import math
import numpy as np
from circuit_validation import CircuitAnalysis, VoltageLevel

@dataclass
class FaultCurrentAnalysis:
    """Fault current analysis results"""
    available_fault_current_amps: float
    x_over_r_ratio: float
    fault_clearing_time_cycles: float
    arc_flash_boundary_inches: float
    incident_energy_cal_cm2: float
    hazard_risk_category: int
    ppe_requirements: List[str]

@dataclass
class ProtectiveDevice:
    """Protective device information"""
    device_type: str  # "breaker", "fuse", "relay"
    rating_amps: float
    interrupting_rating_amps: float
    time_current_curve: str
    instantaneous_trip: Optional[float] = None
    short_time_pickup: Optional[float] = None

class FaultAnalysisEngine:
    """Advanced fault current and arc flash analysis"""
    
    def __init__(self):
        # IEEE 1584-2018 arc flash calculation constants
        self.ieee_constants = {
            "k1": 0.792,  # For VCB and VCBB configurations
            "k2": 0.555,
            "cf": 1.5,    # Calculation factor for equipment other than transformers
        }
    
    def calculate_fault_current(
        self,
        source_impedance: complex,
        circuit_impedance: complex,
        voltage: float
    ) -> Tuple[float, float]:
        """Calculate available fault current and X/R ratio"""
        
        total_impedance = source_impedance + circuit_impedance
        fault_current = voltage / abs(total_impedance)
        
        # Calculate X/R ratio
        x_over_r = total_impedance.imag / total_impedance.real if total_impedance.real != 0 else float('inf')
        
        return fault_current, x_over_r
    
    def calculate_arc_flash_incident_energy(
        self,
        arcing_current: float,
        working_distance: float,
        arc_duration: float,
        voltage_class: str = "low"  # "low" (<1kV) or "medium" (1-15kV)
    ) -> Tuple[float, float]:
        """Calculate arc flash incident energy using IEEE 1584-2018"""
        
        if voltage_class == "low":
            # Low voltage arc flash calculation (IEEE 1584-2018)
            log_ia = self.ieee_constants["k1"] + self.ieee_constants["k2"] * math.log10(arcing_current) + 0.0011 * 0.5  # Gap = 0.5"
            incident_energy = 4.184 * self.ieee_constants["cf"] * (10**log_ia) * (arc_duration/1000) * (610**1.081) / (working_distance**1.081)
        else:
            # Medium voltage calculation (simplified)
            incident_energy = 5.271 * arcing_current * arc_duration * (610/working_distance)**1.081
        
        # Arc flash boundary (distance where incident energy = 1.2 cal/cm²)
        arc_flash_boundary = 610 * ((4.184 * self.ieee_constants["cf"] * (10**log_ia) * (arc_duration/1000)) / 1.2)**(1/1.081)
        
        return incident_energy, arc_flash_boundary
    
    def determine_ppe_category(self, incident_energy: float) -> Tuple[int, List[str]]:
        """Determine PPE category and requirements based on incident energy"""
        
        if incident_energy < 1.2:
            category = 0
            ppe = ["Safety glasses", "Hard hat", "Leather gloves"]
        elif incident_energy < 4:
            category = 1
            ppe = ["Arc-rated shirt and pants", "Arc-rated face shield", "Leather gloves", "Hard hat"]
        elif incident_energy < 8:
            category = 2
            ppe = ["Arc-rated shirt and pants", "Arc-rated flash suit hood", "Leather gloves", "Hard hat"]
        elif incident_energy < 25:
            category = 3
            ppe = ["Arc-rated flash suit", "Arc-rated flash suit hood", "Leather gloves", "Hard hat"]
        else:
            category = 4
            ppe = ["Arc-rated flash suit", "Arc-rated flash suit hood", "Leather gloves", "Hard hat", "Special analysis required"]
        
        return category, ppe
    
    def analyze_fault_conditions(
        self,
        circuit: CircuitAnalysis,
        source_fault_current: float,
        protective_device: ProtectiveDevice,
        working_distance: float = 18  # inches
    ) -> FaultCurrentAnalysis:
        """Perform comprehensive fault analysis"""
        
        # Simplified fault current calculation
        # In practice, this would use detailed impedance calculations
        voltage = circuit.voltage_level.value
        
        # Estimate circuit impedance based on conductor
        conductor_resistance = 0.1  # Simplified - would use actual values
        conductor_reactance = 0.05
        circuit_impedance = complex(conductor_resistance, conductor_reactance)
        
        # Assume source impedance
        source_impedance = complex(0.01, 0.02)
        
        fault_current, x_over_r = self.calculate_fault_current(
            source_impedance, circuit_impedance, voltage
        )
        
        # Estimate arcing current (typically 50-80% of fault current)
        arcing_current = fault_current * 0.7
        
        # Estimate arc duration based on protective device
        arc_duration = self._estimate_arc_duration(fault_current, protective_device)
        
        # Calculate incident energy
        incident_energy, arc_flash_boundary = self.calculate_arc_flash_incident_energy(
            arcing_current, working_distance, arc_duration
        )
        
        # Determine PPE requirements
        ppe_category, ppe_requirements = self.determine_ppe_category(incident_energy)
        
        return FaultCurrentAnalysis(
            available_fault_current_amps=fault_current,
            x_over_r_ratio=x_over_r,
            fault_clearing_time_cycles=arc_duration / 16.67,  # Convert ms to cycles (60Hz)
            arc_flash_boundary_inches=arc_flash_boundary,
            incident_energy_cal_cm2=incident_energy,
            hazard_risk_category=ppe_category,
            ppe_requirements=ppe_requirements
        )
    
    def _estimate_arc_duration(self, fault_current: float, device: ProtectiveDevice) -> float:
        """Estimate arc duration based on protective device characteristics"""
        
        # Simplified time-current curve estimation
        if device.device_type == "breaker":
            if fault_current > device.rating_amps * 10:
                return 83  # 5 cycles at 60Hz = 83ms (instantaneous)
            else:
                return 167  # 10 cycles = 167ms
        elif device.device_type == "fuse":
            # Fuses are generally faster
            return 50  # 3 cycles = 50ms
        else:
            return 167  # Default assumption

class ProtectiveDeviceCoordinator:
    """Analyzes and optimizes protective device coordination"""
    
    def __init__(self):
        self.coordination_margin = 0.3  # 300ms minimum coordination margin
    
    def analyze_coordination(
        self,
        upstream_device: ProtectiveDevice,
        downstream_device: ProtectiveDevice,
        fault_current: float
    ) -> Dict[str, Any]:
        """Analyze coordination between upstream and downstream devices"""
        
        upstream_time = self._calculate_operating_time(upstream_device, fault_current)
        downstream_time = self._calculate_operating_time(downstream_device, fault_current)
        
        coordination_margin = upstream_time - downstream_time
        is_coordinated = coordination_margin >= self.coordination_margin
        
        return {
            "is_coordinated": is_coordinated,
            "coordination_margin": coordination_margin,
            "upstream_time": upstream_time,
            "downstream_time": downstream_time,
            "recommendations": self._generate_coordination_recommendations(
                upstream_device, downstream_device, coordination_margin
            )
        }
    
    def _calculate_operating_time(self, device: ProtectiveDevice, current: float) -> float:
        """Calculate device operating time for given current"""
        
        # Simplified time-current calculation
        # In practice, this would use actual device curves
        
        if device.device_type == "breaker":
            pickup = device.rating_amps
            if current > pickup * 10:
                return 0.083  # Instantaneous (5 cycles)
            else:
                return 0.5 + (pickup / current) * 2  # Simplified inverse curve
        
        elif device.device_type == "fuse":
            # Fuse time-current relationship (simplified)
            melting_ratio = current / device.rating_amps
            if melting_ratio > 10:
                return 0.05
            else:
                return 1.0 / (melting_ratio ** 2)
        
        return 1.0  # Default
    
    def _generate_coordination_recommendations(
        self,
        upstream: ProtectiveDevice,
        downstream: ProtectiveDevice,
        margin: float
    ) -> List[str]:
        """Generate recommendations for improving coordination"""
        
        recommendations = []
        
        if margin < self.coordination_margin:
            recommendations.append(
                f"Coordination margin of {margin:.3f}s is below minimum {self.coordination_margin}s"
            )
            
            if upstream.device_type == "breaker" and upstream.short_time_pickup:
                recommendations.append("Consider adjusting upstream breaker short-time pickup")
            
            recommendations.append("Consider using time-delay fuses for upstream protection")
            recommendations.append("Verify time-current curves for proper coordination")
        
        return recommendations

class CircuitRedundancyAnalyzer:
    """Analyzes circuit redundancy and backup paths"""
    
    def analyze_redundancy(
        self,
        primary_circuit: CircuitAnalysis,
        backup_circuits: List[CircuitAnalysis]
    ) -> Dict[str, Any]:
        """Analyze redundancy and backup capabilities"""
        
        total_backup_capacity = sum(c.current_capacity for c in backup_circuits)
        primary_load = primary_circuit.total_load.current_amps
        
        redundancy_factor = total_backup_capacity / primary_load if primary_load > 0 else 0
        
        return {
            "has_redundancy": redundancy_factor >= 1.0,
            "redundancy_factor": redundancy_factor,
            "backup_capacity": total_backup_capacity,
            "primary_load": primary_load,
            "recommendations": self._generate_redundancy_recommendations(redundancy_factor)
        }
    
    def _generate_redundancy_recommendations(self, factor: float) -> List[str]:
        """Generate redundancy recommendations"""
        
        recommendations = []
        
        if factor < 1.0:
            recommendations.append("Insufficient backup capacity for full redundancy")
            recommendations.append("Consider adding additional backup circuits")
        elif factor < 1.25:
            recommendations.append("Marginal backup capacity - consider 25% safety margin")
        else:
            recommendations.append("Adequate backup capacity available")
        
        return recommendations

class GroundFaultAnalyzer:
    """Analyzes grounding systems and ground fault protection"""
    
    def analyze_grounding_system(
        self,
        circuit: CircuitAnalysis,
        ground_resistance_ohms: float
    ) -> Dict[str, Any]:
        """Analyze grounding system effectiveness"""
        
        # Ground fault current calculation
        voltage = circuit.voltage_level.value
        ground_fault_current = voltage / ground_resistance_ohms
        
        # NEC requirements for ground fault protection
        gfci_required = self._determine_gfci_requirements(circuit)
        egcp_required = ground_fault_current > 30  # Ground fault protection required
        
        return {
            "ground_resistance_ohms": ground_resistance_ohms,
            "ground_fault_current": ground_fault_current,
            "gfci_required": gfci_required,
            "egcp_required": egcp_required,
            "grounding_adequate": ground_resistance_ohms <= 25,  # NEC limit
            "recommendations": self._generate_grounding_recommendations(
                ground_resistance_ohms, gfci_required, egcp_required
            )
        }
    
    def _determine_gfci_requirements(self, circuit: CircuitAnalysis) -> bool:
        """Determine if GFCI protection is required"""
        
        # Simplified GFCI requirements based on circuit type and voltage
        voltage = circuit.voltage_level.value
        
        if voltage <= 150 and circuit.circuit_type.value in ["receptacle"]:
            return True
        
        return False
    
    def _generate_grounding_recommendations(
        self,
        resistance: float,
        gfci_required: bool,
        egcp_required: bool
    ) -> List[str]:
        """Generate grounding system recommendations"""
        
        recommendations = []
        
        if resistance > 25:
            recommendations.append("Ground resistance exceeds NEC limit of 25 ohms")
            recommendations.append("Install additional ground rods or improve grounding system")
        
        if gfci_required:
            recommendations.append("GFCI protection required for this circuit")
        
        if egcp_required:
            recommendations.append("Equipment ground fault protection recommended")
        
        return recommendations

# Integration class for all advanced features
class AdvancedCircuitAnalyzer:
    """Main class integrating all advanced circuit analysis features"""
    
    def __init__(self):
        self.fault_analyzer = FaultAnalysisEngine()
        self.device_coordinator = ProtectiveDeviceCoordinator()
        self.redundancy_analyzer = CircuitRedundancyAnalyzer()
        self.ground_analyzer = GroundFaultAnalyzer()
    
    def perform_advanced_analysis(
        self,
        circuit: CircuitAnalysis,
        protective_device: ProtectiveDevice,
        source_fault_current: float = 10000,
        ground_resistance: float = 5.0,
        backup_circuits: Optional[List[CircuitAnalysis]] = None
    ) -> Dict[str, Any]:
        """Perform comprehensive advanced circuit analysis"""
        
        results = {}
        
        # Fault analysis
        results["fault_analysis"] = self.fault_analyzer.analyze_fault_conditions(
            circuit, source_fault_current, protective_device
        )
        
        # Redundancy analysis
        if backup_circuits:
            results["redundancy_analysis"] = self.redundancy_analyzer.analyze_redundancy(
                circuit, backup_circuits
            )
        
        # Grounding analysis
        results["grounding_analysis"] = self.ground_analyzer.analyze_grounding_system(
            circuit, ground_resistance
        )
        
        # Overall risk assessment
        results["overall_risk"] = self._assess_overall_risk(results)
        
        return results
    
    def _assess_overall_risk(self, analysis_results: Dict[str, Any]) -> Dict[str, Any]:
        """Assess overall circuit risk based on all analyses"""
        
        risk_factors = []
        
        # Check fault analysis
        fault_analysis = analysis_results.get("fault_analysis")
        if fault_analysis and fault_analysis.hazard_risk_category >= 2:
            risk_factors.append("High arc flash hazard")
        
        # Check grounding
        grounding = analysis_results.get("grounding_analysis")
        if grounding and not grounding["grounding_adequate"]:
            risk_factors.append("Inadequate grounding system")
        
        # Check redundancy
        redundancy = analysis_results.get("redundancy_analysis")
        if redundancy and not redundancy["has_redundancy"]:
            risk_factors.append("No backup power available")
        
        # Determine overall risk level
        if len(risk_factors) >= 2:
            risk_level = "high"
        elif len(risk_factors) == 1:
            risk_level = "medium"
        else:
            risk_level = "low"
        
        return {
            "risk_level": risk_level,
            "risk_factors": risk_factors,
            "recommendations": [
                "Address high-priority risk factors first",
                "Consider professional arc flash study for high-risk circuits",
                "Implement regular testing and maintenance program"
            ]
        }

# Example usage
def example_advanced_analysis():
    """Example of advanced circuit analysis"""
    from circuit_validation import (
        CircuitAnalysis, CircuitType, VoltageLevel, LoadData, ConductorData, ConductorType
    )
    
    # Create sample circuit
    circuit = CircuitAnalysis(
        circuit_id="HVAC-1",
        circuit_type=CircuitType.MOTOR,
        voltage_level=VoltageLevel.MEDIUM_480V,
        total_load=LoadData(power_watts=15000, voltage=480, current_amps=25),
        conductor=ConductorData(size_awg="8", material=ConductorType.COPPER, length_feet=200),
        voltage_drop_volts=12.0,
        voltage_drop_percent=2.5,
        current_capacity=50,
        power_rating_watts=15000,
        compliance_issues=[],
        recommendations=[],
        safety_analysis={}
    )
    
    # Create protective device
    device = ProtectiveDevice(
        device_type="breaker",
        rating_amps=30,
        interrupting_rating_amps=25000,
        time_current_curve="standard"
    )
    
    # Perform advanced analysis
    analyzer = AdvancedCircuitAnalyzer()
    results = analyzer.perform_advanced_analysis(
        circuit=circuit,
        protective_device=device,
        source_fault_current=15000,
        ground_resistance=3.0
    )
    
    return results

if __name__ == "__main__":
    # Run example
    results = example_advanced_analysis()
    print(f"Overall risk level: {results['overall_risk']['risk_level']}")
    print(f"Arc flash category: {results['fault_analysis'].hazard_risk_category}")
    print(f"Ground resistance adequate: {results['grounding_analysis']['grounding_adequate']}")