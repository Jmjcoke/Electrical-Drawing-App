import asyncio
import json
import logging
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import numpy as np
import sqlite3
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class MotorControlDeviceCategory(Enum):
    """Motor control device categories"""
    VFD = "vfd"  # Variable Frequency Drive
    SOFT_STARTER = "soft_starter"
    DOL_STARTER = "dol_starter"  # Direct-On-Line
    STAR_DELTA_STARTER = "star_delta_starter"
    MOTOR_CONTACTOR = "motor_contactor"
    OVERLOAD_RELAY = "overload_relay"
    MOTOR_PROTECTION_RELAY = "motor_protection_relay"
    MOTOR_DISCONNECT = "motor_disconnect"
    MCC_BUCKET = "mcc_bucket"  # Motor Control Center bucket
    MOTOR = "motor"
    SERVO_DRIVE = "servo_drive"
    STEPPER_DRIVE = "stepper_drive"

class VFDControlMethod(Enum):
    """VFD control methods"""
    V_HZ_CONTROL = "v_hz_control"  # Voltage/Frequency
    VECTOR_CONTROL = "vector_control"  # Field Oriented Control
    DTC = "dtc"  # Direct Torque Control
    SERVO_CONTROL = "servo_control"

class MotorType(Enum):
    """Motor types for control system analysis"""
    AC_INDUCTION = "ac_induction"
    AC_SYNCHRONOUS = "ac_synchronous"
    DC_BRUSHED = "dc_brushed"
    DC_BRUSHLESS = "dc_brushless"
    SERVO_MOTOR = "servo_motor"
    STEPPER_MOTOR = "stepper_motor"
    LINEAR_MOTOR = "linear_motor"

class MCCConfiguration(Enum):
    """Motor Control Center configurations"""
    FIXED_BUCKET = "fixed_bucket"
    DRAWOUT_BUCKET = "drawout_bucket"
    COMBINATION_STARTER = "combination_starter"
    FEEDER_BUCKET = "feeder_bucket"

@dataclass
class MotorSpecification:
    """Comprehensive motor specifications"""
    motor_type: MotorType
    rated_power: float  # HP or kW
    rated_voltage: float  # Volts
    rated_current: float  # Amps
    rated_frequency: float  # Hz
    rated_speed: float  # RPM
    poles: int
    efficiency_class: Optional[str] = None  # IE1, IE2, IE3, IE4
    insulation_class: Optional[str] = None  # Class A, B, F, H
    enclosure_type: Optional[str] = None  # TEFC, ODP, TENV
    duty_cycle: Optional[str] = None  # S1, S2, S3, etc.
    starting_method: Optional[str] = None
    application_data: Dict[str, Any] = field(default_factory=dict)

@dataclass
class VFDSpecification:
    """Variable Frequency Drive specifications"""
    control_method: VFDControlMethod
    power_rating: float  # HP or kW
    input_voltage: float  # Volts
    output_voltage: float  # Volts
    input_frequency: float  # Hz
    output_frequency_range: Tuple[float, float]  # Min, Max Hz
    efficiency: Optional[float] = None  # Percentage
    thd_current: Optional[float] = None  # Total Harmonic Distortion
    overload_capacity: Optional[float] = None  # Percentage for 1 minute
    braking_capability: Optional[str] = None  # Dynamic, regenerative
    communication_protocols: List[str] = field(default_factory=list)
    protection_features: List[str] = field(default_factory=list)
    cooling_method: Optional[str] = None  # Air, liquid

@dataclass
class MCCBucketSpecification:
    """Motor Control Center bucket specifications"""
    bucket_size: str  # Size designation (A, B, C, D, etc.)
    configuration: MCCConfiguration
    voltage_rating: float
    current_rating: float
    short_circuit_rating: float  # SCCR
    starter_type: str
    motor_rating: float  # HP
    control_voltage: float
    auxiliary_contacts: int
    space_units: int  # Physical space in units
    depth: float  # Inches
    components: List[str] = field(default_factory=list)
    protection_devices: List[str] = field(default_factory=list)

@dataclass
class MotorControlAnalysisResult:
    """Comprehensive motor control system analysis result"""
    component_id: str
    device_category: MotorControlDeviceCategory
    confidence: float
    bounding_box: Tuple[int, int, int, int]
    motor_spec: Optional[MotorSpecification] = None
    vfd_spec: Optional[VFDSpecification] = None
    mcc_spec: Optional[MCCBucketSpecification] = None
    control_wiring: Dict[str, Any] = field(default_factory=dict)
    power_calculations: Dict[str, Any] = field(default_factory=dict)
    efficiency_analysis: Dict[str, Any] = field(default_factory=dict)
    protection_coordination: Dict[str, Any] = field(default_factory=dict)

class MotorControlDatabase:
    """Database for motor control device specifications"""
    
    def __init__(self, db_path: str = "motor_control.sqlite"):
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        """Initialize motor control database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Motors table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS motors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                manufacturer TEXT NOT NULL,
                model_number TEXT NOT NULL,
                motor_type TEXT NOT NULL,
                rated_power REAL NOT NULL,
                rated_voltage REAL NOT NULL,
                rated_current REAL NOT NULL,
                rated_frequency REAL NOT NULL,
                rated_speed REAL NOT NULL,
                poles INTEGER NOT NULL,
                efficiency_class TEXT,
                insulation_class TEXT,
                enclosure_type TEXT,
                duty_cycle TEXT,
                starting_torque REAL,
                breakdown_torque REAL,
                full_load_torque REAL,
                service_factor REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # VFDs table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vfds (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                manufacturer TEXT NOT NULL,
                model_number TEXT NOT NULL,
                series TEXT,
                control_method TEXT NOT NULL,
                power_rating REAL NOT NULL,
                input_voltage REAL NOT NULL,
                output_voltage REAL NOT NULL,
                input_frequency REAL NOT NULL,
                max_output_frequency REAL NOT NULL,
                efficiency REAL,
                thd_current REAL,
                overload_capacity REAL,
                braking_capability TEXT,
                communication_protocols TEXT,
                protection_features TEXT,
                cooling_method TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # MCC Buckets table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS mcc_buckets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                manufacturer TEXT NOT NULL,
                model_number TEXT NOT NULL,
                bucket_size TEXT NOT NULL,
                configuration TEXT NOT NULL,
                voltage_rating REAL NOT NULL,
                current_rating REAL NOT NULL,
                short_circuit_rating REAL NOT NULL,
                starter_type TEXT NOT NULL,
                motor_rating REAL NOT NULL,
                control_voltage REAL,
                auxiliary_contacts INTEGER,
                space_units INTEGER,
                depth REAL,
                components TEXT,
                protection_devices TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        conn.close()
        
        # Populate with sample data
        self._populate_sample_data()
    
    def _populate_sample_data(self):
        """Populate database with sample motor control data"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Sample motors
        sample_motors = [
            ("Baldor", "EM3770T", "ac_induction", 10.0, 460, 12.8, 60, 1765, 4, "IE3", "F", "TEFC", "S1"),
            ("WEG", "00318ET3E", "ac_induction", 3.0, 208, 8.8, 60, 1745, 4, "IE2", "F", "TEFC", "S1"),
            ("Siemens", "1LE1001-1CB23-4AA4", "ac_induction", 5.0, 480, 6.9, 60, 1760, 4, "IE3", "F", "TEFC", "S1"),
            ("ABB", "M3BP112M4", "ac_induction", 4.0, 400, 8.4, 50, 1455, 4, "IE3", "F", "TEFC", "S1")
        ]
        
        for motor in sample_motors:
            cursor.execute("""
                INSERT INTO motors (manufacturer, model_number, motor_type, rated_power, 
                                  rated_voltage, rated_current, rated_frequency, rated_speed, 
                                  poles, efficiency_class, insulation_class, enclosure_type, duty_cycle)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, motor)
        
        # Sample VFDs
        sample_vfds = [
            ("Allen-Bradley", "PowerFlex 525", "525", "vector_control", 10.0, 480, 480, 60, 120, 97.5, 3.0, 150, "dynamic"),
            ("Siemens", "SINAMICS G120", "G120", "vector_control", 5.0, 400, 400, 50, 100, 96.8, 3.5, 150, "dynamic"),
            ("Schneider", "Altivar 312", "ATV312", "v_hz_control", 3.0, 480, 480, 60, 100, 95.5, 4.0, 110, "dynamic"),
            ("ABB", "ACS580", "ACS580", "dtc", 7.5, 480, 480, 60, 120, 97.0, 3.2, 150, "regenerative")
        ]
        
        for vfd in sample_vfds:
            cursor.execute("""
                INSERT INTO vfds (manufacturer, model_number, series, control_method, power_rating,
                                input_voltage, output_voltage, input_frequency, max_output_frequency,
                                efficiency, thd_current, overload_capacity, braking_capability)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, vfd)
        
        # Sample MCC Buckets
        sample_mcc = [
            ("Eaton", "Freedom 2100", "C", "combination_starter", 480, 30, 65000, "FVNR", 10.0, 120, 2, 12, 20.0),
            ("Square D", "Model 6", "B", "combination_starter", 480, 18, 65000, "RVAT", 5.0, 120, 1, 8, 16.0),
            ("GE", "Spectra Series", "D", "combination_starter", 480, 50, 65000, "FVNR", 20.0, 120, 3, 18, 24.0),
            ("Siemens", "SIVACON 8PS", "C", "drawout_bucket", 400, 32, 50000, "RVSS", 7.5, 110, 2, 10, 18.0)
        ]
        
        for mcc in sample_mcc:
            cursor.execute("""
                INSERT INTO mcc_buckets (manufacturer, model_number, bucket_size, configuration,
                                       voltage_rating, current_rating, short_circuit_rating,
                                       starter_type, motor_rating, control_voltage, auxiliary_contacts,
                                       space_units, depth)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, mcc)
        
        conn.commit()
        conn.close()
    
    def get_motor_by_rating(self, power_rating: float, voltage: float) -> Optional[Dict[str, Any]]:
        """Get motor specification by power and voltage rating"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM motors 
            WHERE rated_power >= ? AND rated_power <= ? 
            AND rated_voltage = ?
            ORDER BY ABS(rated_power - ?) LIMIT 1
        """, (power_rating * 0.9, power_rating * 1.1, voltage, power_rating))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            columns = [description[0] for description in cursor.description]
            return dict(zip(columns, result))
        return None
    
    def get_vfd_by_rating(self, power_rating: float, voltage: float) -> Optional[Dict[str, Any]]:
        """Get VFD specification by power and voltage rating"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM vfds 
            WHERE power_rating >= ? AND power_rating <= ?
            AND input_voltage = ?
            ORDER BY ABS(power_rating - ?) LIMIT 1
        """, (power_rating * 0.9, power_rating * 1.1, voltage, power_rating))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            columns = [description[0] for description in cursor.description]
            return dict(zip(columns, result))
        return None

class MotorControlSystemAnalyzer:
    """Advanced motor control system analysis engine"""
    
    def __init__(self, database_path: str = "motor_control.sqlite"):
        self.database = MotorControlDatabase(database_path)
        self.power_calculator = MotorPowerCalculator()
        self.efficiency_analyzer = MotorEfficiencyAnalyzer()
        self.protection_coordinator = ProtectionCoordinator()
    
    async def analyze_motor_control_system(self, 
                                         image: np.ndarray,
                                         bbox: Tuple[int, int, int, int],
                                         device_category: MotorControlDeviceCategory) -> MotorControlAnalysisResult:
        """Comprehensive motor control system analysis"""
        
        component_id = f"motor_control_{device_category.value}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        result = MotorControlAnalysisResult(
            component_id=component_id,
            device_category=device_category,
            confidence=0.85,  # Default confidence
            bounding_box=bbox
        )
        
        # Analyze based on device category
        if device_category == MotorControlDeviceCategory.VFD:
            await self._analyze_vfd(result, image, bbox)
        elif device_category == MotorControlDeviceCategory.MOTOR:
            await self._analyze_motor(result, image, bbox)
        elif device_category == MotorControlDeviceCategory.MCC_BUCKET:
            await self._analyze_mcc_bucket(result, image, bbox)
        else:
            await self._analyze_generic_motor_control(result, image, bbox)
        
        # Perform power calculations
        result.power_calculations = self.power_calculator.calculate_motor_power_requirements(result)
        
        # Analyze efficiency
        result.efficiency_analysis = self.efficiency_analyzer.analyze_system_efficiency(result)
        
        # Protection coordination
        result.protection_coordination = self.protection_coordinator.analyze_protection_scheme(result)
        
        return result
    
    async def _analyze_vfd(self, result: MotorControlAnalysisResult, image: np.ndarray, bbox: Tuple[int, int, int, int]):
        """Analyze Variable Frequency Drive"""
        # Extract power rating from image analysis (OCR/ML)
        power_rating = await self._extract_power_rating_from_image(image, bbox)
        voltage_rating = await self._extract_voltage_rating_from_image(image, bbox)
        
        # Get VFD specification from database
        vfd_data = self.database.get_vfd_by_rating(power_rating or 5.0, voltage_rating or 480)
        
        if vfd_data:
            result.vfd_spec = VFDSpecification(
                control_method=VFDControlMethod(vfd_data.get('control_method', 'vector_control')),
                power_rating=vfd_data['power_rating'],
                input_voltage=vfd_data['input_voltage'],
                output_voltage=vfd_data['output_voltage'],
                input_frequency=vfd_data['input_frequency'],
                output_frequency_range=(0, vfd_data['max_output_frequency']),
                efficiency=vfd_data.get('efficiency'),
                thd_current=vfd_data.get('thd_current'),
                overload_capacity=vfd_data.get('overload_capacity'),
                braking_capability=vfd_data.get('braking_capability'),
                communication_protocols=self._parse_protocols(vfd_data.get('communication_protocols', '')),
                protection_features=self._parse_features(vfd_data.get('protection_features', ''))
            )
    
    async def _analyze_motor(self, result: MotorControlAnalysisResult, image: np.ndarray, bbox: Tuple[int, int, int, int]):
        """Analyze electric motor"""
        # Extract motor specifications from nameplate
        power_rating = await self._extract_power_rating_from_image(image, bbox)
        voltage_rating = await self._extract_voltage_rating_from_image(image, bbox)
        
        # Get motor specification from database
        motor_data = self.database.get_motor_by_rating(power_rating or 5.0, voltage_rating or 460)
        
        if motor_data:
            result.motor_spec = MotorSpecification(
                motor_type=MotorType(motor_data.get('motor_type', 'ac_induction')),
                rated_power=motor_data['rated_power'],
                rated_voltage=motor_data['rated_voltage'],
                rated_current=motor_data['rated_current'],
                rated_frequency=motor_data['rated_frequency'],
                rated_speed=motor_data['rated_speed'],
                poles=motor_data['poles'],
                efficiency_class=motor_data.get('efficiency_class'),
                insulation_class=motor_data.get('insulation_class'),
                enclosure_type=motor_data.get('enclosure_type'),
                duty_cycle=motor_data.get('duty_cycle')
            )
    
    async def _analyze_mcc_bucket(self, result: MotorControlAnalysisResult, image: np.ndarray, bbox: Tuple[int, int, int, int]):
        """Analyze Motor Control Center bucket"""
        # Extract MCC specifications
        current_rating = await self._extract_current_rating_from_image(image, bbox)
        voltage_rating = await self._extract_voltage_rating_from_image(image, bbox)
        
        # Estimate motor rating from current
        motor_rating = (current_rating * voltage_rating * 1.732) / 746 if current_rating and voltage_rating else 10.0
        
        result.mcc_spec = MCCBucketSpecification(
            bucket_size="C",  # Default size
            configuration=MCCConfiguration.COMBINATION_STARTER,
            voltage_rating=voltage_rating or 480,
            current_rating=current_rating or 30,
            short_circuit_rating=65000,  # Default SCCR
            starter_type="FVNR",  # Full Voltage Non-Reversing
            motor_rating=motor_rating,
            control_voltage=120,
            auxiliary_contacts=2,
            space_units=12,
            depth=20.0,
            components=["Contactor", "Overload Relay", "Disconnect Switch"],
            protection_devices=["Overload Protection", "Short Circuit Protection"]
        )
    
    async def _analyze_generic_motor_control(self, result: MotorControlAnalysisResult, image: np.ndarray, bbox: Tuple[int, int, int, int]):
        """Analyze generic motor control device"""
        # Basic analysis for other motor control devices
        result.power_calculations = {"estimated_power": 5.0, "voltage": 480}
    
    async def _extract_power_rating_from_image(self, image: np.ndarray, bbox: Tuple[int, int, int, int]) -> Optional[float]:
        """Extract power rating from image using OCR/ML"""
        # Placeholder for OCR/ML implementation
        # In real implementation, this would use OCR to read nameplate
        return 5.0  # Default value
    
    async def _extract_voltage_rating_from_image(self, image: np.ndarray, bbox: Tuple[int, int, int, int]) -> Optional[float]:
        """Extract voltage rating from image using OCR/ML"""
        # Placeholder for OCR/ML implementation
        return 480.0  # Default value
    
    async def _extract_current_rating_from_image(self, image: np.ndarray, bbox: Tuple[int, int, int, int]) -> Optional[float]:
        """Extract current rating from image using OCR/ML"""
        # Placeholder for OCR/ML implementation
        return 30.0  # Default value
    
    def _parse_protocols(self, protocol_string: str) -> List[str]:
        """Parse communication protocols from database string"""
        if not protocol_string:
            return ["Modbus", "Ethernet/IP"]  # Default protocols
        return [p.strip() for p in protocol_string.split(',')]
    
    def _parse_features(self, features_string: str) -> List[str]:
        """Parse protection features from database string"""
        if not features_string:
            return ["Overcurrent", "Overvoltage", "Undervoltage", "Phase Loss"]  # Default features
        return [f.strip() for f in features_string.split(',')]

class MotorPowerCalculator:
    """Motor power calculations and analysis"""
    
    def calculate_motor_power_requirements(self, result: MotorControlAnalysisResult) -> Dict[str, Any]:
        """Calculate comprehensive motor power requirements"""
        calculations = {}
        
        if result.motor_spec:
            motor = result.motor_spec
            
            # Basic power calculations
            calculations.update({
                "rated_power_hp": motor.rated_power,
                "rated_power_kw": motor.rated_power * 0.746,
                "rated_current": motor.rated_current,
                "full_load_torque": self._calculate_full_load_torque(motor),
                "starting_current": motor.rated_current * 6.0,  # Typical starting current
                "power_factor": 0.85,  # Typical for induction motors
                "slip": self._calculate_slip(motor)
            })
            
            # Efficiency calculations
            if motor.efficiency_class:
                calculations["efficiency"] = self._get_efficiency_by_class(motor.efficiency_class, motor.rated_power)
            
            # Load calculations
            calculations.update({
                "25_percent_load": self._calculate_part_load_performance(motor, 0.25),
                "50_percent_load": self._calculate_part_load_performance(motor, 0.50),
                "75_percent_load": self._calculate_part_load_performance(motor, 0.75),
                "100_percent_load": self._calculate_part_load_performance(motor, 1.00)
            })
        
        if result.vfd_spec:
            vfd = result.vfd_spec
            calculations.update({
                "vfd_efficiency": vfd.efficiency,
                "vfd_power_loss": self._calculate_vfd_losses(vfd),
                "harmonic_distortion": vfd.thd_current,
                "energy_savings": self._calculate_vfd_energy_savings(vfd)
            })
        
        return calculations
    
    def _calculate_full_load_torque(self, motor: MotorSpecification) -> float:
        """Calculate full load torque in lb-ft"""
        return (motor.rated_power * 5252) / motor.rated_speed
    
    def _calculate_slip(self, motor: MotorSpecification) -> float:
        """Calculate motor slip percentage"""
        synchronous_speed = (120 * motor.rated_frequency) / motor.poles
        return ((synchronous_speed - motor.rated_speed) / synchronous_speed) * 100
    
    def _get_efficiency_by_class(self, efficiency_class: str, power_hp: float) -> float:
        """Get efficiency by IE class and power rating"""
        efficiency_table = {
            "IE1": {1: 82.5, 3: 86.5, 5: 88.5, 10: 89.5, 25: 91.7, 50: 93.0},
            "IE2": {1: 85.5, 3: 89.5, 5: 91.7, 10: 92.4, 25: 93.6, 50: 94.5},
            "IE3": {1: 87.5, 3: 91.7, 5: 93.0, 10: 94.1, 25: 95.0, 50: 95.8},
            "IE4": {1: 90.2, 3: 94.1, 5: 95.4, 10: 96.2, 25: 96.8, 50: 97.4}
        }
        
        if efficiency_class in efficiency_table:
            # Find closest power rating
            powers = list(efficiency_table[efficiency_class].keys())
            closest_power = min(powers, key=lambda x: abs(x - power_hp))
            return efficiency_table[efficiency_class][closest_power]
        
        return 90.0  # Default efficiency
    
    def _calculate_part_load_performance(self, motor: MotorSpecification, load_factor: float) -> Dict[str, float]:
        """Calculate motor performance at partial load"""
        full_load_efficiency = self._get_efficiency_by_class(motor.efficiency_class or "IE2", motor.rated_power)
        
        # Efficiency curve approximation
        if load_factor < 0.5:
            efficiency = full_load_efficiency * (0.85 + 0.15 * load_factor * 2)
        else:
            efficiency = full_load_efficiency * (0.98 + 0.02 * (1 - load_factor))
        
        return {
            "load_factor": load_factor,
            "efficiency": efficiency,
            "power_input_kw": (motor.rated_power * 0.746 * load_factor) / (efficiency / 100),
            "current": motor.rated_current * load_factor * 0.9,  # Approximate current
            "power_factor": 0.85 * (0.7 + 0.3 * load_factor)  # Approximate power factor
        }
    
    def _calculate_vfd_losses(self, vfd: VFDSpecification) -> Dict[str, float]:
        """Calculate VFD power losses"""
        total_loss_percent = 100 - (vfd.efficiency or 95)
        input_power_kw = vfd.power_rating * 0.746
        
        return {
            "total_loss_percent": total_loss_percent,
            "total_loss_kw": input_power_kw * (total_loss_percent / 100),
            "switching_losses": input_power_kw * 0.015,  # Approximate
            "conduction_losses": input_power_kw * 0.010  # Approximate
        }
    
    def _calculate_vfd_energy_savings(self, vfd: VFDSpecification) -> Dict[str, float]:
        """Calculate potential energy savings with VFD"""
        # Typical savings for different applications
        return {
            "fan_application_savings": 50,  # Percent at 80% speed
            "pump_application_savings": 45,  # Percent at 80% speed
            "compressor_savings": 25,  # Percent typical
            "conveyor_savings": 15  # Percent typical
        }

class MotorEfficiencyAnalyzer:
    """Motor efficiency analysis and optimization"""
    
    def analyze_system_efficiency(self, result: MotorControlAnalysisResult) -> Dict[str, Any]:
        """Comprehensive system efficiency analysis"""
        analysis = {}
        
        if result.motor_spec and result.power_calculations:
            motor = result.motor_spec
            power_calc = result.power_calculations
            
            # Overall system efficiency
            motor_efficiency = power_calc.get("efficiency", 90)
            
            if result.vfd_spec:
                vfd_efficiency = result.vfd_spec.efficiency or 95
                system_efficiency = (motor_efficiency * vfd_efficiency) / 100
            else:
                system_efficiency = motor_efficiency
            
            analysis.update({
                "motor_efficiency": motor_efficiency,
                "vfd_efficiency": result.vfd_spec.efficiency if result.vfd_spec else None,
                "system_efficiency": system_efficiency,
                "efficiency_class": motor.efficiency_class,
                "improvement_recommendations": self._get_efficiency_recommendations(motor, result.vfd_spec)
            })
            
            # Energy cost analysis
            analysis["energy_cost_analysis"] = self._calculate_energy_costs(power_calc, system_efficiency)
            
            # Environmental impact
            analysis["environmental_impact"] = self._calculate_environmental_impact(power_calc)
        
        return analysis
    
    def _get_efficiency_recommendations(self, motor: MotorSpecification, vfd: Optional[VFDSpecification]) -> List[str]:
        """Generate efficiency improvement recommendations"""
        recommendations = []
        
        if motor.efficiency_class in ["IE1", "IE2"]:
            recommendations.append("Consider upgrading to IE3 or IE4 premium efficiency motor")
        
        if not vfd and motor.rated_power > 5:
            recommendations.append("Consider VFD installation for variable load applications")
        
        if motor.rated_power > 1:
            recommendations.append("Implement motor monitoring for optimal performance")
        
        recommendations.extend([
            "Regular maintenance to maintain efficiency",
            "Proper motor sizing to avoid oversizing losses",
            "Power factor correction if needed"
        ])
        
        return recommendations
    
    def _calculate_energy_costs(self, power_calc: Dict[str, Any], efficiency: float) -> Dict[str, float]:
        """Calculate annual energy costs"""
        rated_power_kw = power_calc.get("rated_power_kw", 3.73)
        
        # Assumptions
        operating_hours = 4000  # hours per year
        electricity_rate = 0.12  # $/kWh
        load_factor = 0.75  # 75% average load
        
        annual_energy_kwh = rated_power_kw * operating_hours * load_factor * (100/efficiency)
        annual_cost = annual_energy_kwh * electricity_rate
        
        return {
            "annual_energy_kwh": annual_energy_kwh,
            "annual_cost_usd": annual_cost,
            "monthly_cost_usd": annual_cost / 12,
            "cost_per_hour_usd": annual_cost / operating_hours
        }
    
    def _calculate_environmental_impact(self, power_calc: Dict[str, Any]) -> Dict[str, float]:
        """Calculate environmental impact"""
        annual_energy_kwh = power_calc.get("rated_power_kw", 3.73) * 4000 * 0.75
        
        # CO2 emissions factor (lbs CO2 per kWh) - US average
        co2_factor = 0.92
        
        return {
            "annual_co2_lbs": annual_energy_kwh * co2_factor,
            "annual_co2_tons": (annual_energy_kwh * co2_factor) / 2000,
            "equivalent_cars": (annual_energy_kwh * co2_factor) / 10000  # Approximate
        }

class ProtectionCoordinator:
    """Motor protection coordination analysis"""
    
    def analyze_protection_scheme(self, result: MotorControlAnalysisResult) -> Dict[str, Any]:
        """Analyze motor protection coordination"""
        protection = {}
        
        if result.motor_spec:
            motor = result.motor_spec
            
            # Overload protection
            protection["overload_protection"] = self._calculate_overload_settings(motor)
            
            # Short circuit protection
            protection["short_circuit_protection"] = self._calculate_short_circuit_protection(motor)
            
            # Ground fault protection
            protection["ground_fault_protection"] = self._calculate_ground_fault_protection(motor)
            
            # Phase protection
            protection["phase_protection"] = {
                "phase_loss_protection": True,
                "phase_reversal_protection": True,
                "phase_unbalance_threshold": 2.0  # Percent voltage unbalance
            }
        
        if result.vfd_spec:
            protection["vfd_protection"] = self._get_vfd_protection_features(result.vfd_spec)
        
        return protection
    
    def _calculate_overload_settings(self, motor: MotorSpecification) -> Dict[str, Any]:
        """Calculate overload relay settings"""
        service_factor = 1.15  # Typical service factor
        
        return {
            "fla_setting": motor.rated_current,
            "trip_class": "Class 10" if motor.rated_power <= 1500 else "Class 20",
            "service_factor": service_factor,
            "maximum_setting": motor.rated_current * service_factor,
            "minimum_setting": motor.rated_current * 0.85
        }
    
    def _calculate_short_circuit_protection(self, motor: MotorSpecification) -> Dict[str, Any]:
        """Calculate short circuit protection settings"""
        # NEC Table 430.52 guidelines
        if motor.motor_type == MotorType.AC_INDUCTION:
            if motor.rated_current <= 9:
                multiplier = 300  # Percent of FLA for fuses
            else:
                multiplier = 175  # Percent of FLA for circuit breakers
        else:
            multiplier = 150  # Conservative setting
        
        return {
            "protection_type": "Circuit Breaker" if motor.rated_current > 9 else "Fuse",
            "rating_percent_fla": multiplier,
            "rating_amps": motor.rated_current * (multiplier / 100),
            "coordination_required": motor.rated_power > 5
        }
    
    def _calculate_ground_fault_protection(self, motor: MotorSpecification) -> Dict[str, Any]:
        """Calculate ground fault protection settings"""
        return {
            "required": motor.rated_voltage > 150,
            "pickup_amps": motor.rated_current * 0.1,  # 10% of FLA typical
            "time_delay": "0.1 seconds",
            "type": "Zero sequence CT" if motor.rated_power > 10 else "Residual"
        }
    
    def _get_vfd_protection_features(self, vfd: VFDSpecification) -> Dict[str, Any]:
        """Get VFD built-in protection features"""
        return {
            "built_in_overload": True,
            "short_circuit_protection": True,
            "ground_fault_protection": True,
            "overvoltage_protection": True,
            "undervoltage_protection": True,
            "phase_loss_protection": True,
            "motor_thermistor_input": True,
            "stall_protection": True,
            "features": vfd.protection_features
        }

# Testing functions
async def test_motor_control_analysis():
    """Test motor control system analysis"""
    analyzer = MotorControlSystemAnalyzer()
    
    # Test VFD analysis
    print("Testing VFD Analysis:")
    test_image = np.random.randint(0, 255, (600, 800, 3), dtype=np.uint8)
    test_bbox = (100, 100, 300, 200)
    
    vfd_result = await analyzer.analyze_motor_control_system(
        test_image, test_bbox, MotorControlDeviceCategory.VFD
    )
    
    print(f"VFD Component ID: {vfd_result.component_id}")
    print(f"VFD Confidence: {vfd_result.confidence}")
    if vfd_result.vfd_spec:
        print(f"VFD Power Rating: {vfd_result.vfd_spec.power_rating} HP")
        print(f"VFD Control Method: {vfd_result.vfd_spec.control_method.value}")
        print(f"VFD Efficiency: {vfd_result.vfd_spec.efficiency}%")
    
    # Test motor analysis
    print("\nTesting Motor Analysis:")
    motor_result = await analyzer.analyze_motor_control_system(
        test_image, test_bbox, MotorControlDeviceCategory.MOTOR
    )
    
    print(f"Motor Component ID: {motor_result.component_id}")
    if motor_result.motor_spec:
        print(f"Motor Power: {motor_result.motor_spec.rated_power} HP")
        print(f"Motor Type: {motor_result.motor_spec.motor_type.value}")
        print(f"Motor Efficiency Class: {motor_result.motor_spec.efficiency_class}")
    
    # Test MCC bucket analysis
    print("\nTesting MCC Bucket Analysis:")
    mcc_result = await analyzer.analyze_motor_control_system(
        test_image, test_bbox, MotorControlDeviceCategory.MCC_BUCKET
    )
    
    print(f"MCC Component ID: {mcc_result.component_id}")
    if mcc_result.mcc_spec:
        print(f"MCC Bucket Size: {mcc_result.mcc_spec.bucket_size}")
        print(f"MCC Motor Rating: {mcc_result.mcc_spec.motor_rating} HP")
        print(f"MCC Configuration: {mcc_result.mcc_spec.configuration.value}")
    
    print(f"\nPower Calculations: {json.dumps(vfd_result.power_calculations, indent=2)}")
    print(f"\nEfficiency Analysis: {json.dumps(vfd_result.efficiency_analysis, indent=2)}")

if __name__ == "__main__":
    asyncio.run(test_motor_control_analysis())