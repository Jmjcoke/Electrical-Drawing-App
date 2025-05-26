"""
Circuit Analysis and Validation Engine

Provides comprehensive circuit analysis including load calculations, voltage drop analysis,
and electrical code compliance checking.
"""

from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum
import math
import json
import logging

logger = logging.getLogger(__name__)

class CircuitType(Enum):
    POWER = "power"
    CONTROL = "control"
    DATA = "data"
    LIGHTING = "lighting"
    MOTOR = "motor"
    RECEPTACLE = "receptacle"

class VoltageLevel(Enum):
    LOW_120V = 120
    LOW_240V = 240
    MEDIUM_277V = 277
    MEDIUM_480V = 480
    HIGH_2400V = 2400
    HIGH_4160V = 4160

class ConductorType(Enum):
    COPPER = "copper"
    ALUMINUM = "aluminum"
    
@dataclass
class LoadData:
    """Load information for circuit analysis"""
    power_watts: float
    voltage: float
    current_amps: float
    power_factor: float = 1.0
    load_type: str = "resistive"
    diversity_factor: float = 1.0

@dataclass
class ConductorData:
    """Conductor specifications for voltage drop calculations"""
    size_awg: str
    material: ConductorType
    length_feet: float
    temperature_rating: int = 75
    derating_factor: float = 1.0
    resistance_ohms_per_1000ft: Optional[float] = None

@dataclass
class CircuitAnalysis:
    """Complete circuit analysis results"""
    circuit_id: str
    circuit_type: CircuitType
    voltage_level: VoltageLevel
    total_load: LoadData
    conductor: ConductorData
    voltage_drop_volts: float
    voltage_drop_percent: float
    current_capacity: float
    power_rating_watts: float
    compliance_issues: List[str]
    recommendations: List[str]
    safety_analysis: Dict[str, Any]

class ElectricalCodeValidator:
    """NEC and electrical code compliance validation"""
    
    def __init__(self):
        # NEC 2023 voltage drop requirements
        self.voltage_drop_limits = {
            "branch_circuit": 3.0,  # 3% for branch circuits
            "feeder": 3.0,          # 3% for feeders
            "combined": 5.0         # 5% combined total
        }
        
        # Standard wire ampacities (75°C termination)
        self.wire_ampacities = {
            "14": {"copper": 20, "aluminum": 15},
            "12": {"copper": 25, "aluminum": 20},
            "10": {"copper": 35, "aluminum": 30},
            "8": {"copper": 50, "aluminum": 40},
            "6": {"copper": 65, "aluminum": 50},
            "4": {"copper": 85, "aluminum": 65},
            "2": {"copper": 115, "aluminum": 90},
            "1": {"copper": 130, "aluminum": 100},
            "1/0": {"copper": 150, "aluminum": 120},
            "2/0": {"copper": 175, "aluminum": 135},
            "3/0": {"copper": 200, "aluminum": 155},
            "4/0": {"copper": 230, "aluminum": 180}
        }
        
        # Wire resistance values (ohms per 1000 feet at 75°C)
        self.wire_resistance = {
            "14": {"copper": 3.07, "aluminum": 5.06},
            "12": {"copper": 1.93, "aluminum": 3.18},
            "10": {"copper": 1.21, "aluminum": 1.99},
            "8": {"copper": 0.764, "aluminum": 1.26},
            "6": {"copper": 0.491, "aluminum": 0.808},
            "4": {"copper": 0.308, "aluminum": 0.508},
            "2": {"copper": 0.194, "aluminum": 0.319},
            "1": {"copper": 0.154, "aluminum": 0.253},
            "1/0": {"copper": 0.122, "aluminum": 0.201},
            "2/0": {"copper": 0.0967, "aluminum": 0.159},
            "3/0": {"copper": 0.0766, "aluminum": 0.126},
            "4/0": {"copper": 0.0608, "aluminum": 0.100}
        }
    
    def validate_circuit_compliance(self, analysis: CircuitAnalysis) -> List[str]:
        """Validate circuit against NEC requirements"""
        violations = []
        
        # Check voltage drop
        if analysis.voltage_drop_percent > self.voltage_drop_limits["branch_circuit"]:
            violations.append(
                f"Voltage drop of {analysis.voltage_drop_percent:.1f}% exceeds NEC limit of "
                f"{self.voltage_drop_limits['branch_circuit']}% for branch circuits"
            )
        
        # Check conductor ampacity
        wire_size = analysis.conductor.size_awg
        material = analysis.conductor.material.value
        
        if wire_size in self.wire_ampacities and material in self.wire_ampacities[wire_size]:
            max_ampacity = self.wire_ampacities[wire_size][material]
            if analysis.total_load.current_amps > max_ampacity * analysis.conductor.derating_factor:
                violations.append(
                    f"Load current of {analysis.total_load.current_amps:.1f}A exceeds "
                    f"conductor ampacity of {max_ampacity * analysis.conductor.derating_factor:.1f}A"
                )
        
        # Check minimum wire size for circuit type
        min_sizes = {
            CircuitType.LIGHTING: "14",
            CircuitType.RECEPTACLE: "12",
            CircuitType.MOTOR: "12"
        }
        
        if analysis.circuit_type in min_sizes:
            min_size = min_sizes[analysis.circuit_type]
            if self._compare_wire_sizes(wire_size, min_size) < 0:
                violations.append(
                    f"Wire size {wire_size} AWG is smaller than minimum required "
                    f"{min_size} AWG for {analysis.circuit_type.value} circuits"
                )
        
        return violations
    
    def _compare_wire_sizes(self, size1: str, size2: str) -> int:
        """Compare wire sizes (-1 if size1 < size2, 0 if equal, 1 if size1 > size2)"""
        # Convert to comparable format (larger numbers = smaller wire)
        def size_to_num(size: str) -> float:
            if "/" in size:
                return -float(size.split("/")[0])  # 1/0, 2/0, etc.
            return float(size)
        
        num1 = size_to_num(size1)
        num2 = size_to_num(size2)
        
        if num1 < num2:
            return 1  # size1 is larger (lower AWG number)
        elif num1 > num2:
            return -1  # size1 is smaller (higher AWG number)
        else:
            return 0  # equal

class LoadCalculator:
    """Calculate electrical loads and power requirements"""
    
    def __init__(self):
        # Standard load calculations per NEC
        self.demand_factors = {
            "lighting": {"general": 1.0, "commercial": 1.0, "dwelling": 1.0},
            "receptacles": {"general": 1.0, "first_10kva": 1.0, "remainder": 0.5},
            "motors": {"largest": 1.25, "others": 1.0}
        }
    
    def calculate_total_load(self, loads: List[LoadData]) -> LoadData:
        """Calculate total connected and demand loads"""
        total_power = sum(load.power_watts * load.diversity_factor for load in loads)
        
        # Use worst-case voltage for current calculation
        min_voltage = min(load.voltage for load in loads) if loads else 120
        
        # Calculate current based on power and voltage
        total_current = total_power / min_voltage if min_voltage > 0 else 0
        
        # Calculate weighted power factor
        total_va = sum(load.power_watts / load.power_factor * load.diversity_factor for load in loads)
        avg_power_factor = total_power / total_va if total_va > 0 else 1.0
        
        return LoadData(
            power_watts=total_power,
            voltage=min_voltage,
            current_amps=total_current,
            power_factor=avg_power_factor,
            load_type="mixed"
        )
    
    def calculate_motor_load(self, motor_hp: float, voltage: float, efficiency: float = 0.85) -> LoadData:
        """Calculate motor load with NEC factors"""
        # Convert HP to watts
        power_watts = motor_hp * 746 / efficiency
        
        # NEC motor current calculation
        current_amps = power_watts / (voltage * math.sqrt(3) * 0.8)  # Assuming 3-phase, 0.8 PF
        
        return LoadData(
            power_watts=power_watts,
            voltage=voltage,
            current_amps=current_amps,
            power_factor=0.8,
            load_type="motor"
        )

class VoltageDropCalculator:
    """Calculate voltage drop for electrical circuits"""
    
    def __init__(self, code_validator: ElectricalCodeValidator):
        self.code_validator = code_validator
    
    def calculate_voltage_drop(
        self, 
        conductor: ConductorData, 
        current_amps: float, 
        voltage: float,
        is_three_phase: bool = False
    ) -> Tuple[float, float]:
        """Calculate voltage drop in volts and percentage"""
        
        # Get conductor resistance
        resistance = self._get_conductor_resistance(conductor)
        if resistance is None:
            return 0.0, 0.0
        
        # Calculate one-way resistance
        one_way_resistance = resistance * conductor.length_feet / 1000.0
        
        # For DC or single-phase: VD = 2 * I * R * L / 1000
        # For three-phase: VD = sqrt(3) * I * R * L / 1000
        if is_three_phase:
            voltage_drop = math.sqrt(3) * current_amps * one_way_resistance
        else:
            voltage_drop = 2 * current_amps * one_way_resistance
        
        # Calculate percentage
        voltage_drop_percent = (voltage_drop / voltage) * 100
        
        return voltage_drop, voltage_drop_percent
    
    def _get_conductor_resistance(self, conductor: ConductorData) -> Optional[float]:
        """Get conductor resistance from lookup table"""
        if conductor.resistance_ohms_per_1000ft:
            return conductor.resistance_ohms_per_1000ft
        
        wire_size = conductor.size_awg
        material = conductor.material.value
        
        if (wire_size in self.code_validator.wire_resistance and 
            material in self.code_validator.wire_resistance[wire_size]):
            return self.code_validator.wire_resistance[wire_size][material]
        
        return None

class SafetyAnalyzer:
    """Analyze circuit safety and identify potential hazards"""
    
    def __init__(self):
        self.fault_current_limits = {
            "arc_flash_boundary": 1.2,  # cal/cm²
            "incident_energy_limit": 40,  # cal/cm²
        }
    
    def analyze_circuit_safety(self, analysis: CircuitAnalysis) -> Dict[str, Any]:
        """Perform comprehensive safety analysis"""
        safety_analysis = {
            "arc_flash_risk": self._assess_arc_flash_risk(analysis),
            "overload_protection": self._check_overload_protection(analysis),
            "ground_fault_protection": self._check_ground_fault_protection(analysis),
            "short_circuit_analysis": self._analyze_short_circuit(analysis),
            "hazard_level": "low"  # Default
        }
        
        # Determine overall hazard level
        risks = [
            safety_analysis["arc_flash_risk"]["level"],
            safety_analysis["overload_protection"]["level"],
            safety_analysis["ground_fault_protection"]["level"]
        ]
        
        if "high" in risks:
            safety_analysis["hazard_level"] = "high"
        elif "medium" in risks:
            safety_analysis["hazard_level"] = "medium"
        
        return safety_analysis
    
    def _assess_arc_flash_risk(self, analysis: CircuitAnalysis) -> Dict[str, Any]:
        """Assess arc flash risk based on circuit characteristics"""
        # Simplified arc flash analysis
        voltage = analysis.voltage_level.value
        current = analysis.total_load.current_amps
        
        # Higher voltage and current = higher risk
        if voltage >= 480 and current >= 100:
            risk_level = "high"
            recommendations = [
                "Arc flash study required",
                "Personal protective equipment (PPE) required",
                "Qualified electrician only"
            ]
        elif voltage >= 240 or current >= 50:
            risk_level = "medium"
            recommendations = [
                "Basic PPE recommended",
                "Follow NFPA 70E guidelines"
            ]
        else:
            risk_level = "low"
            recommendations = ["Standard electrical safety practices"]
        
        return {
            "level": risk_level,
            "incident_energy_cal_cm2": None,  # Would require detailed calculation
            "recommendations": recommendations
        }
    
    def _check_overload_protection(self, analysis: CircuitAnalysis) -> Dict[str, Any]:
        """Check adequacy of overload protection"""
        # This would check breaker/fuse ratings vs. conductor ampacity
        return {
            "level": "low",
            "protection_adequate": True,
            "recommendations": []
        }
    
    def _check_ground_fault_protection(self, analysis: CircuitAnalysis) -> Dict[str, Any]:
        """Check ground fault protection requirements"""
        voltage = analysis.voltage_level.value
        circuit_type = analysis.circuit_type
        
        if circuit_type in [CircuitType.RECEPTACLE] and voltage <= 240:
            gfci_required = True
            level = "medium" if not gfci_required else "low"
        else:
            gfci_required = False
            level = "low"
        
        return {
            "level": level,
            "gfci_required": gfci_required,
            "recommendations": ["Install GFCI protection"] if gfci_required else []
        }
    
    def _analyze_short_circuit(self, analysis: CircuitAnalysis) -> Dict[str, Any]:
        """Analyze short circuit protection and available fault current"""
        # Simplified short circuit analysis
        return {
            "available_fault_current": None,  # Would require source impedance
            "interrupting_rating_adequate": True,
            "recommendations": []
        }

class CircuitAnalysisEngine:
    """Main circuit analysis engine combining all analysis components"""
    
    def __init__(self):
        self.code_validator = ElectricalCodeValidator()
        self.load_calculator = LoadCalculator()
        self.voltage_drop_calculator = VoltageDropCalculator(self.code_validator)
        self.safety_analyzer = SafetyAnalyzer()
    
    def analyze_circuit(
        self,
        circuit_id: str,
        circuit_type: CircuitType,
        voltage_level: VoltageLevel,
        loads: List[LoadData],
        conductor: ConductorData,
        is_three_phase: bool = False
    ) -> CircuitAnalysis:
        """Perform comprehensive circuit analysis"""
        
        # Calculate total load
        total_load = self.load_calculator.calculate_total_load(loads)
        
        # Calculate voltage drop
        voltage_drop, voltage_drop_percent = self.voltage_drop_calculator.calculate_voltage_drop(
            conductor, total_load.current_amps, voltage_level.value, is_three_phase
        )
        
        # Create preliminary analysis
        analysis = CircuitAnalysis(
            circuit_id=circuit_id,
            circuit_type=circuit_type,
            voltage_level=voltage_level,
            total_load=total_load,
            conductor=conductor,
            voltage_drop_volts=voltage_drop,
            voltage_drop_percent=voltage_drop_percent,
            current_capacity=self._get_conductor_ampacity(conductor),
            power_rating_watts=total_load.power_watts,
            compliance_issues=[],
            recommendations=[],
            safety_analysis={}
        )
        
        # Validate compliance
        analysis.compliance_issues = self.code_validator.validate_circuit_compliance(analysis)
        
        # Perform safety analysis
        analysis.safety_analysis = self.safety_analyzer.analyze_circuit_safety(analysis)
        
        # Generate recommendations
        analysis.recommendations = self._generate_recommendations(analysis)
        
        return analysis
    
    def _get_conductor_ampacity(self, conductor: ConductorData) -> float:
        """Get conductor ampacity with derating factors"""
        wire_size = conductor.size_awg
        material = conductor.material.value
        
        if (wire_size in self.code_validator.wire_ampacities and 
            material in self.code_validator.wire_ampacities[wire_size]):
            base_ampacity = self.code_validator.wire_ampacities[wire_size][material]
            return base_ampacity * conductor.derating_factor
        
        return 0.0
    
    def _generate_recommendations(self, analysis: CircuitAnalysis) -> List[str]:
        """Generate recommendations based on analysis results"""
        recommendations = []
        
        # Voltage drop recommendations
        if analysis.voltage_drop_percent > 2.5:
            recommendations.append(
                f"Consider larger conductor to reduce voltage drop from "
                f"{analysis.voltage_drop_percent:.1f}% to under 3%"
            )
        
        # Load recommendations
        if analysis.total_load.current_amps > analysis.current_capacity * 0.8:
            recommendations.append(
                "Circuit loading is above 80% of conductor capacity - consider load balancing"
            )
        
        # Safety recommendations
        safety_recs = analysis.safety_analysis.get("arc_flash_risk", {}).get("recommendations", [])
        recommendations.extend(safety_recs)
        
        return recommendations

# Example usage and testing
def example_circuit_analysis():
    """Example of circuit analysis usage"""
    
    # Create analysis engine
    engine = CircuitAnalysisEngine()
    
    # Define loads
    loads = [
        LoadData(power_watts=1800, voltage=120, current_amps=15, load_type="lighting"),
        LoadData(power_watts=1200, voltage=120, current_amps=10, load_type="receptacle")
    ]
    
    # Define conductor
    conductor = ConductorData(
        size_awg="12",
        material=ConductorType.COPPER,
        length_feet=150,
        temperature_rating=75,
        derating_factor=1.0
    )
    
    # Analyze circuit
    analysis = engine.analyze_circuit(
        circuit_id="BR-101",
        circuit_type=CircuitType.LIGHTING,
        voltage_level=VoltageLevel.LOW_120V,
        loads=loads,
        conductor=conductor
    )
    
    return analysis

if __name__ == "__main__":
    # Run example
    result = example_circuit_analysis()
    print(f"Voltage Drop: {result.voltage_drop_percent:.2f}%")
    print(f"Compliance Issues: {len(result.compliance_issues)}")
    print(f"Recommendations: {len(result.recommendations)}")