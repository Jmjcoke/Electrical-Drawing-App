import asyncio
import json
import logging
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import numpy as np
import sqlite3
import aiohttp
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class BASDeviceCategory(Enum):
    """Building Automation System device categories"""
    BAS_CONTROLLER = "bas_controller"
    VAV_CONTROLLER = "vav_controller"  # Variable Air Volume
    AHU_CONTROLLER = "ahu_controller"  # Air Handling Unit
    CHILLER_CONTROLLER = "chiller_controller"
    BOILER_CONTROLLER = "boiler_controller"
    LIGHTING_CONTROLLER = "lighting_controller"
    HVAC_SENSOR = "hvac_sensor"
    OCCUPANCY_SENSOR = "occupancy_sensor"
    TEMPERATURE_SENSOR = "temperature_sensor"
    HUMIDITY_SENSOR = "humidity_sensor"
    PRESSURE_SENSOR = "pressure_sensor"
    CO2_SENSOR = "co2_sensor"
    LIGHT_SENSOR = "light_sensor"
    SMART_THERMOSTAT = "smart_thermostat"
    SMART_SWITCH = "smart_switch"
    SMART_OUTLET = "smart_outlet"
    ENERGY_METER = "energy_meter"
    POWER_METER = "power_meter"
    IOT_GATEWAY = "iot_gateway"

class BASProtocol(Enum):
    """Building automation communication protocols"""
    BACNET = "bacnet"
    MODBUS = "modbus"
    LONWORKS = "lonworks"
    KNXEIB = "knx_eib"
    ZIGBEE = "zigbee"
    ZWAVE = "zwave"
    WIFI = "wifi"
    BLUETOOTH = "bluetooth"
    ETHERNET_IP = "ethernet_ip"
    MQTT = "mqtt"
    COAP = "coap"
    LORA = "lora"
    THREAD = "thread"
    MATTER = "matter"

class SmartBuildingZone(Enum):
    """Smart building zone types"""
    OFFICE_SPACE = "office_space"
    CONFERENCE_ROOM = "conference_room"
    LABORATORY = "laboratory"
    WAREHOUSE = "warehouse"
    RETAIL_SPACE = "retail_space"
    CLASSROOM = "classroom"
    AUDITORIUM = "auditorium"
    CAFETERIA = "cafeteria"
    LOBBY = "lobby"
    CORRIDOR = "corridor"
    RESTROOM = "restroom"
    MECHANICAL_ROOM = "mechanical_room"
    ELECTRICAL_ROOM = "electrical_room"

class EnergyManagementStrategy(Enum):
    """Energy management strategies"""
    DEMAND_RESPONSE = "demand_response"
    LOAD_SHEDDING = "load_shedding"
    PEAK_SHAVING = "peak_shaving"
    OPTIMAL_START_STOP = "optimal_start_stop"
    ECONOMIZER_CONTROL = "economizer_control"
    DAYLIGHT_HARVESTING = "daylight_harvesting"
    OCCUPANCY_BASED = "occupancy_based"
    PREDICTIVE_CONTROL = "predictive_control"

@dataclass
class BASDeviceSpecification:
    """Building automation device specification"""
    device_category: BASDeviceCategory
    manufacturer: str
    model_number: str
    communication_protocols: List[BASProtocol]
    power_supply: Dict[str, Any]
    input_output_points: Dict[str, int]
    environmental_ratings: Dict[str, Any]
    processing_capability: Dict[str, Any] = field(default_factory=dict)
    wireless_capabilities: List[str] = field(default_factory=list)
    integration_features: List[str] = field(default_factory=list)
    cybersecurity_features: List[str] = field(default_factory=list)

@dataclass
class SmartBuildingSystem:
    """Comprehensive smart building system configuration"""
    system_id: str
    building_zones: List[SmartBuildingZone]
    bas_devices: List[BASDeviceSpecification]
    network_topology: Dict[str, Any]
    energy_management: List[EnergyManagementStrategy]
    integration_points: Dict[str, Any] = field(default_factory=dict)
    performance_metrics: Dict[str, Any] = field(default_factory=dict)
    sustainability_features: List[str] = field(default_factory=list)

@dataclass
class IoTDeviceProfile:
    """IoT device profile for smart building integration"""
    device_id: str
    device_type: str
    communication_protocol: BASProtocol
    data_points: List[str]
    update_frequency: int  # seconds
    power_consumption: float  # watts
    battery_life: Optional[int] = None  # hours
    edge_computing: bool = False
    ai_capabilities: List[str] = field(default_factory=list)
    interoperability: List[str] = field(default_factory=list)

@dataclass
class BASAnalysisResult:
    """Building automation system analysis result"""
    component_id: str
    device_category: BASDeviceCategory
    confidence: float
    bounding_box: Tuple[int, int, int, int]
    bas_specification: Optional[BASDeviceSpecification] = None
    smart_building_integration: Optional[Dict[str, Any]] = None
    iot_profile: Optional[IoTDeviceProfile] = None
    energy_efficiency: Dict[str, Any] = field(default_factory=dict)
    automation_capabilities: List[str] = field(default_factory=list)
    interoperability_analysis: Dict[str, Any] = field(default_factory=dict)

class BASDeviceDatabase:
    """Database for building automation devices"""
    
    def __init__(self, db_path: str = "bas_devices.sqlite"):
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        """Initialize BAS device database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # BAS Controllers table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bas_controllers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                manufacturer TEXT NOT NULL,
                model_number TEXT NOT NULL,
                device_category TEXT NOT NULL,
                communication_protocols TEXT NOT NULL,
                digital_inputs INTEGER,
                digital_outputs INTEGER,
                analog_inputs INTEGER,
                analog_outputs INTEGER,
                power_supply_voltage REAL,
                power_consumption REAL,
                operating_temp_min REAL,
                operating_temp_max REAL,
                processing_power TEXT,
                memory_capacity TEXT,
                wireless_support TEXT,
                cybersecurity_features TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Smart Sensors table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS smart_sensors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                manufacturer TEXT NOT NULL,
                model_number TEXT NOT NULL,
                sensor_type TEXT NOT NULL,
                measurement_range TEXT,
                accuracy REAL,
                resolution REAL,
                communication_protocol TEXT NOT NULL,
                power_source TEXT,
                battery_life INTEGER,
                wireless_range REAL,
                iot_platform_support TEXT,
                ai_edge_processing BOOLEAN,
                environmental_rating TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # IoT Gateways table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS iot_gateways (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                manufacturer TEXT NOT NULL,
                model_number TEXT NOT NULL,
                supported_protocols TEXT NOT NULL,
                device_capacity INTEGER,
                processing_power TEXT,
                memory_capacity TEXT,
                storage_capacity TEXT,
                network_interfaces TEXT,
                edge_computing BOOLEAN,
                ai_capabilities TEXT,
                security_features TEXT,
                power_consumption REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
        conn.close()
        
        # Populate with sample data
        self._populate_sample_data()
    
    def _populate_sample_data(self):
        """Populate database with sample BAS device data"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Sample BAS Controllers
        sample_controllers = [
            ("Johnson Controls", "FX-PCV1516", "bas_controller", "BACnet,Modbus", 16, 16, 8, 8, 24, 15, -40, 70, "ARM Cortex", "256MB", "WiFi,Zigbee", "TLS,VPN"),
            ("Siemens", "PXC36-E.D", "ahu_controller", "BACnet,KNX", 12, 12, 6, 6, 24, 12, -30, 55, "ARM9", "128MB", "WiFi", "TLS,SSH"),
            ("Honeywell", "W7760C", "vav_controller", "BACnet,Modbus", 8, 8, 4, 4, 24, 8, -20, 60, "ARM Cortex-M", "64MB", "BACnet/IP", "Encryption"),
            ("Schneider Electric", "TAC Vista", "chiller_controller", "BACnet,LonWorks", 20, 20, 10, 10, 24, 25, -10, 60, "Intel Atom", "512MB", "Ethernet", "TLS,Firewall")
        ]
        
        for controller in sample_controllers:
            cursor.execute("""
                INSERT INTO bas_controllers (manufacturer, model_number, device_category, 
                                           communication_protocols, digital_inputs, digital_outputs,
                                           analog_inputs, analog_outputs, power_supply_voltage,
                                           power_consumption, operating_temp_min, operating_temp_max,
                                           processing_power, memory_capacity, wireless_support,
                                           cybersecurity_features)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, controller)
        
        # Sample Smart Sensors
        sample_sensors = [
            ("Belimo", "22RTD-S", "temperature_sensor", "-40 to 120°C", 0.1, 0.01, "Zigbee", "Battery", 8760, 100, "AWS,Azure", True, "IP65"),
            ("Siemens", "QPA2002", "pressure_sensor", "0-10 bar", 0.25, 0.01, "BACnet", "24VDC", None, None, "Desigo", False, "IP54"),
            ("Johnson Controls", "HT-9000", "humidity_sensor", "0-100% RH", 2.0, 0.1, "WiFi", "Battery", 4380, 50, "Metasys", True, "IP40"),
            ("Honeywell", "C7232A1024", "co2_sensor", "0-2000 ppm", 50, 1, "BACnet", "24VAC", None, None, "Niagara", False, "IP30")
        ]
        
        for sensor in sample_sensors:
            cursor.execute("""
                INSERT INTO smart_sensors (manufacturer, model_number, sensor_type, measurement_range,
                                         accuracy, resolution, communication_protocol, power_source,
                                         battery_life, wireless_range, iot_platform_support,
                                         ai_edge_processing, environmental_rating)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, sensor)
        
        # Sample IoT Gateways
        sample_gateways = [
            ("Cisco", "IE-4000-4GC", "BACnet,Modbus,MQTT,CoAP", 1000, "ARM Cortex-A9", "1GB", "8GB", "4x Ethernet", True, "Machine Learning", "Firewall,VPN,TLS", 25),
            ("Dell", "Edge Gateway 3000", "WiFi,Zigbee,BLE,LoRa", 500, "Intel Atom", "4GB", "32GB", "WiFi,Ethernet,LTE", True, "AI Inference", "TPM,Secure Boot", 15),
            ("HPE", "Edgeline EL300", "MQTT,CoAP,HTTP,Modbus", 2000, "Intel Xeon", "8GB", "128GB", "Ethernet,WiFi", True, "Deep Learning", "Encryption,PKI", 45),
            ("Advantech", "WISE-4000", "BACnet,Modbus,SNMP", 200, "ARM Cortex-A8", "512MB", "4GB", "Ethernet,WiFi", False, "Rule Engine", "HTTPS,SSH", 12)
        ]
        
        for gateway in sample_gateways:
            cursor.execute("""
                INSERT INTO iot_gateways (manufacturer, model_number, supported_protocols, device_capacity,
                                        processing_power, memory_capacity, storage_capacity, network_interfaces,
                                        edge_computing, ai_capabilities, security_features, power_consumption)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, gateway)
        
        conn.commit()
        conn.close()
    
    def get_bas_controller_by_category(self, category: str) -> Optional[Dict[str, Any]]:
        """Get BAS controller by device category"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM bas_controllers 
            WHERE device_category = ?
            ORDER BY RANDOM() LIMIT 1
        """, (category,))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            columns = [description[0] for description in cursor.description]
            return dict(zip(columns, result))
        return None
    
    def get_smart_sensor_by_type(self, sensor_type: str) -> Optional[Dict[str, Any]]:
        """Get smart sensor by sensor type"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM smart_sensors 
            WHERE sensor_type = ?
            ORDER BY RANDOM() LIMIT 1
        """, (sensor_type,))
        
        result = cursor.fetchone()
        conn.close()
        
        if result:
            columns = [description[0] for description in cursor.description]
            return dict(zip(columns, result))
        return None

class BuildingAutomationAnalyzer:
    """Advanced building automation system analyzer"""
    
    def __init__(self, database_path: str = "bas_devices.sqlite"):
        self.database = BASDeviceDatabase(database_path)
        self.energy_analyzer = EnergyEfficiencyAnalyzer()
        self.integration_analyzer = SystemIntegrationAnalyzer()
        self.iot_manager = IoTDeviceManager()
    
    async def analyze_bas_device(self, 
                                image: np.ndarray,
                                bbox: Tuple[int, int, int, int],
                                device_category: BASDeviceCategory) -> BASAnalysisResult:
        """Comprehensive BAS device analysis"""
        
        component_id = f"bas_{device_category.value}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        result = BASAnalysisResult(
            component_id=component_id,
            device_category=device_category,
            confidence=0.87,  # Default confidence
            bounding_box=bbox
        )
        
        # Analyze based on device category
        if device_category in [BASDeviceCategory.BAS_CONTROLLER, BASDeviceCategory.VAV_CONTROLLER, 
                              BASDeviceCategory.AHU_CONTROLLER]:
            await self._analyze_bas_controller(result, image, bbox)
        elif device_category in [BASDeviceCategory.TEMPERATURE_SENSOR, BASDeviceCategory.HUMIDITY_SENSOR,
                                BASDeviceCategory.CO2_SENSOR]:
            await self._analyze_smart_sensor(result, image, bbox)
        elif device_category == BASDeviceCategory.IOT_GATEWAY:
            await self._analyze_iot_gateway(result, image, bbox)
        else:
            await self._analyze_generic_bas_device(result, image, bbox)
        
        # Perform energy efficiency analysis
        result.energy_efficiency = self.energy_analyzer.analyze_device_efficiency(result)
        
        # Analyze system integration capabilities
        result.interoperability_analysis = self.integration_analyzer.analyze_interoperability(result)
        
        # Generate IoT profile if applicable
        if self._is_iot_device(device_category):
            result.iot_profile = await self.iot_manager.create_iot_profile(result)
        
        return result
    
    async def _analyze_bas_controller(self, result: BASAnalysisResult, image: np.ndarray, bbox: Tuple[int, int, int, int]):
        """Analyze BAS controller device"""
        controller_data = self.database.get_bas_controller_by_category(result.device_category.value)
        
        if controller_data:
            result.bas_specification = BASDeviceSpecification(
                device_category=result.device_category,
                manufacturer=controller_data['manufacturer'],
                model_number=controller_data['model_number'],
                communication_protocols=self._parse_protocols(controller_data['communication_protocols']),
                power_supply={
                    "voltage": controller_data['power_supply_voltage'],
                    "consumption": controller_data['power_consumption']
                },
                input_output_points={
                    "digital_inputs": controller_data['digital_inputs'],
                    "digital_outputs": controller_data['digital_outputs'],
                    "analog_inputs": controller_data['analog_inputs'],
                    "analog_outputs": controller_data['analog_outputs']
                },
                environmental_ratings={
                    "operating_temp_min": controller_data['operating_temp_min'],
                    "operating_temp_max": controller_data['operating_temp_max']
                },
                processing_capability={
                    "processor": controller_data['processing_power'],
                    "memory": controller_data['memory_capacity']
                },
                wireless_capabilities=self._parse_wireless(controller_data['wireless_support']),
                cybersecurity_features=self._parse_security(controller_data['cybersecurity_features'])
            )
        
        # Analyze automation capabilities
        result.automation_capabilities = self._get_automation_capabilities(result.device_category)
    
    async def _analyze_smart_sensor(self, result: BASAnalysisResult, image: np.ndarray, bbox: Tuple[int, int, int, int]):
        """Analyze smart sensor device"""
        sensor_data = self.database.get_smart_sensor_by_type(result.device_category.value)
        
        if sensor_data:
            protocols = [BASProtocol(sensor_data['communication_protocol'].lower())]
            
            result.bas_specification = BASDeviceSpecification(
                device_category=result.device_category,
                manufacturer=sensor_data['manufacturer'],
                model_number=sensor_data['model_number'],
                communication_protocols=protocols,
                power_supply={
                    "type": sensor_data['power_source'],
                    "battery_life": sensor_data['battery_life']
                },
                input_output_points={
                    "measurement_points": 1,
                    "accuracy": sensor_data['accuracy'],
                    "resolution": sensor_data['resolution']
                },
                environmental_ratings={
                    "rating": sensor_data['environmental_rating'],
                    "measurement_range": sensor_data['measurement_range']
                },
                wireless_capabilities=[protocols[0].value] if sensor_data['wireless_range'] else [],
                integration_features=self._parse_platforms(sensor_data['iot_platform_support'])
            )
    
    async def _analyze_iot_gateway(self, result: BASAnalysisResult, image: np.ndarray, bbox: Tuple[int, int, int, int]):
        """Analyze IoT gateway device"""
        # For now, use generic IoT gateway analysis
        result.bas_specification = BASDeviceSpecification(
            device_category=result.device_category,
            manufacturer="Generic",
            model_number="IoT-GW-001",
            communication_protocols=[BASProtocol.WIFI, BASProtocol.ZIGBEE, BASProtocol.MQTT],
            power_supply={"voltage": 24, "consumption": 20},
            input_output_points={"device_capacity": 500},
            environmental_ratings={"operating_temp_min": 0, "operating_temp_max": 50},
            processing_capability={"edge_computing": True, "ai_inference": True},
            integration_features=["Multi-protocol", "Edge AI", "Cloud Connectivity"]
        )
    
    async def _analyze_generic_bas_device(self, result: BASAnalysisResult, image: np.ndarray, bbox: Tuple[int, int, int, int]):
        """Analyze generic BAS device"""
        result.bas_specification = BASDeviceSpecification(
            device_category=result.device_category,
            manufacturer="Generic",
            model_number="BAS-001",
            communication_protocols=[BASProtocol.BACNET],
            power_supply={"voltage": 24, "consumption": 5},
            input_output_points={"points": 4},
            environmental_ratings={"operating_temp_min": 0, "operating_temp_max": 50}
        )
    
    def _parse_protocols(self, protocol_string: str) -> List[BASProtocol]:
        """Parse communication protocols from database string"""
        if not protocol_string:
            return [BASProtocol.BACNET]
        
        protocols = []
        for p in protocol_string.split(','):
            try:
                protocols.append(BASProtocol(p.strip().lower()))
            except ValueError:
                continue
        return protocols or [BASProtocol.BACNET]
    
    def _parse_wireless(self, wireless_string: str) -> List[str]:
        """Parse wireless capabilities"""
        if not wireless_string:
            return []
        return [w.strip() for w in wireless_string.split(',')]
    
    def _parse_security(self, security_string: str) -> List[str]:
        """Parse security features"""
        if not security_string:
            return ["Basic Authentication"]
        return [s.strip() for s in security_string.split(',')]
    
    def _parse_platforms(self, platform_string: str) -> List[str]:
        """Parse IoT platform support"""
        if not platform_string:
            return []
        return [p.strip() for p in platform_string.split(',')]
    
    def _get_automation_capabilities(self, device_category: BASDeviceCategory) -> List[str]:
        """Get automation capabilities by device category"""
        capabilities_map = {
            BASDeviceCategory.BAS_CONTROLLER: [
                "Scheduling", "Trending", "Alarming", "Energy Management",
                "Demand Response", "Fault Detection"
            ],
            BASDeviceCategory.VAV_CONTROLLER: [
                "Variable Air Volume Control", "Temperature Control", 
                "Occupancy-based Control", "Energy Optimization"
            ],
            BASDeviceCategory.AHU_CONTROLLER: [
                "Air Handling Unit Control", "Economizer Control",
                "Filter Monitoring", "Energy Recovery"
            ],
            BASDeviceCategory.LIGHTING_CONTROLLER: [
                "Daylight Harvesting", "Occupancy Control",
                "Scene Control", "Energy Monitoring"
            ]
        }
        return capabilities_map.get(device_category, ["Basic Control"])
    
    def _is_iot_device(self, device_category: BASDeviceCategory) -> bool:
        """Check if device category is an IoT device"""
        iot_categories = [
            BASDeviceCategory.SMART_THERMOSTAT,
            BASDeviceCategory.SMART_SWITCH,
            BASDeviceCategory.SMART_OUTLET,
            BASDeviceCategory.OCCUPANCY_SENSOR,
            BASDeviceCategory.ENERGY_METER
        ]
        return device_category in iot_categories

class EnergyEfficiencyAnalyzer:
    """Energy efficiency analysis for BAS devices"""
    
    def analyze_device_efficiency(self, result: BASAnalysisResult) -> Dict[str, Any]:
        """Analyze energy efficiency of BAS device"""
        efficiency_analysis = {}
        
        if result.bas_specification:
            spec = result.bas_specification
            
            # Power consumption analysis
            power_consumption = spec.power_supply.get("consumption", 10)
            efficiency_analysis.update({
                "power_consumption_watts": power_consumption,
                "annual_energy_kwh": self._calculate_annual_energy(power_consumption),
                "energy_cost_annual": self._calculate_energy_cost(power_consumption),
                "efficiency_rating": self._get_efficiency_rating(result.device_category, power_consumption)
            })
            
            # Smart features that improve efficiency
            efficiency_analysis["energy_saving_features"] = self._get_energy_saving_features(result.device_category)
            
            # Potential savings analysis
            efficiency_analysis["potential_savings"] = self._calculate_potential_savings(result)
        
        return efficiency_analysis
    
    def _calculate_annual_energy(self, power_watts: float) -> float:
        """Calculate annual energy consumption in kWh"""
        hours_per_year = 8760
        return (power_watts * hours_per_year) / 1000
    
    def _calculate_energy_cost(self, power_watts: float) -> float:
        """Calculate annual energy cost in USD"""
        annual_kwh = self._calculate_annual_energy(power_watts)
        electricity_rate = 0.12  # USD per kWh
        return annual_kwh * electricity_rate
    
    def _get_efficiency_rating(self, device_category: BASDeviceCategory, power_watts: float) -> str:
        """Get energy efficiency rating"""
        # Define efficiency thresholds by device category
        thresholds = {
            BASDeviceCategory.BAS_CONTROLLER: {"excellent": 10, "good": 20, "fair": 30},
            BASDeviceCategory.SMART_SENSOR: {"excellent": 2, "good": 5, "fair": 10},
            BASDeviceCategory.IOT_GATEWAY: {"excellent": 15, "good": 25, "fair": 40}
        }
        
        threshold = thresholds.get(device_category, {"excellent": 10, "good": 20, "fair": 30})
        
        if power_watts <= threshold["excellent"]:
            return "Excellent"
        elif power_watts <= threshold["good"]:
            return "Good"
        elif power_watts <= threshold["fair"]:
            return "Fair"
        else:
            return "Poor"
    
    def _get_energy_saving_features(self, device_category: BASDeviceCategory) -> List[str]:
        """Get energy saving features by device category"""
        features_map = {
            BASDeviceCategory.BAS_CONTROLLER: [
                "Optimal Start/Stop", "Demand-based Control", "Load Shedding",
                "Energy Monitoring", "Peak Demand Management"
            ],
            BASDeviceCategory.LIGHTING_CONTROLLER: [
                "Daylight Harvesting", "Occupancy Sensing", "Dimming Control",
                "Scheduling", "Energy Reporting"
            ],
            BASDeviceCategory.SMART_THERMOSTAT: [
                "Learning Algorithms", "Geofencing", "Weather Compensation",
                "Occupancy Detection", "Energy Reports"
            ]
        }
        return features_map.get(device_category, ["Basic Energy Management"])
    
    def _calculate_potential_savings(self, result: BASAnalysisResult) -> Dict[str, float]:
        """Calculate potential energy savings"""
        baseline_consumption = 1000  # kWh baseline
        
        savings_factors = {
            BASDeviceCategory.BAS_CONTROLLER: 0.25,  # 25% savings
            BASDeviceCategory.LIGHTING_CONTROLLER: 0.35,  # 35% savings
            BASDeviceCategory.SMART_THERMOSTAT: 0.20,  # 20% savings
            BASDeviceCategory.OCCUPANCY_SENSOR: 0.15   # 15% savings
        }
        
        factor = savings_factors.get(result.device_category, 0.10)
        annual_savings_kwh = baseline_consumption * factor
        annual_cost_savings = annual_savings_kwh * 0.12
        
        return {
            "annual_savings_kwh": annual_savings_kwh,
            "annual_cost_savings_usd": annual_cost_savings,
            "payback_period_years": 2.5,  # Typical payback
            "lifetime_savings_usd": annual_cost_savings * 10  # 10-year lifetime
        }

class SystemIntegrationAnalyzer:
    """System integration and interoperability analysis"""
    
    def analyze_interoperability(self, result: BASAnalysisResult) -> Dict[str, Any]:
        """Analyze system interoperability"""
        analysis = {}
        
        if result.bas_specification:
            spec = result.bas_specification
            
            # Protocol compatibility analysis
            analysis["protocol_compatibility"] = self._analyze_protocol_compatibility(spec.communication_protocols)
            
            # Integration complexity
            analysis["integration_complexity"] = self._assess_integration_complexity(spec)
            
            # Compatibility with major BAS platforms
            analysis["platform_compatibility"] = self._assess_platform_compatibility(spec)
            
            # Cybersecurity assessment
            analysis["cybersecurity_assessment"] = self._assess_cybersecurity(spec)
            
            # Future-proofing analysis
            analysis["future_proofing"] = self._assess_future_proofing(spec)
        
        return analysis
    
    def _analyze_protocol_compatibility(self, protocols: List[BASProtocol]) -> Dict[str, Any]:
        """Analyze communication protocol compatibility"""
        protocol_scores = {
            BASProtocol.BACNET: {"score": 10, "adoption": "Very High", "interoperability": "Excellent"},
            BASProtocol.MODBUS: {"score": 9, "adoption": "High", "interoperability": "Very Good"},
            BASProtocol.MQTT: {"score": 8, "adoption": "High", "interoperability": "Good"},
            BASProtocol.ZIGBEE: {"score": 7, "adoption": "Medium", "interoperability": "Good"},
            BASProtocol.WIFI: {"score": 8, "adoption": "Very High", "interoperability": "Good"},
            BASProtocol.MATTER: {"score": 9, "adoption": "Growing", "interoperability": "Excellent"}
        }
        
        analysis = {
            "supported_protocols": [p.value for p in protocols],
            "compatibility_score": sum(protocol_scores.get(p, {"score": 5})["score"] for p in protocols) / len(protocols),
            "protocol_details": {p.value: protocol_scores.get(p, {"score": 5, "adoption": "Unknown", "interoperability": "Unknown"}) for p in protocols}
        }
        
        return analysis
    
    def _assess_integration_complexity(self, spec: BASDeviceSpecification) -> Dict[str, Any]:
        """Assess integration complexity"""
        complexity_factors = {
            "protocol_count": len(spec.communication_protocols),
            "wireless_support": len(spec.wireless_capabilities) > 0,
            "processing_capability": bool(spec.processing_capability),
            "security_features": len(spec.cybersecurity_features)
        }
        
        # Calculate complexity score (1-10, where 1 is simple, 10 is complex)
        score = 3  # Base complexity
        if complexity_factors["protocol_count"] > 2:
            score += 2
        if complexity_factors["wireless_support"]:
            score += 1
        if complexity_factors["processing_capability"]:
            score += 2
        if complexity_factors["security_features"] > 2:
            score += 2
        
        complexity_level = "Low" if score <= 4 else "Medium" if score <= 7 else "High"
        
        return {
            "complexity_score": min(score, 10),
            "complexity_level": complexity_level,
            "factors": complexity_factors,
            "integration_time_estimate": f"{score * 2}-{score * 4} hours"
        }
    
    def _assess_platform_compatibility(self, spec: BASDeviceSpecification) -> Dict[str, bool]:
        """Assess compatibility with major BAS platforms"""
        bacnet_support = BASProtocol.BACNET in spec.communication_protocols
        modbus_support = BASProtocol.MODBUS in spec.communication_protocols
        
        return {
            "johnson_controls_metasys": bacnet_support,
            "honeywell_webs": bacnet_support,
            "siemens_desigo": bacnet_support or modbus_support,
            "schneider_ecostruxure": bacnet_support or modbus_support,
            "trane_tracer": bacnet_support,
            "carrier_i_vu": bacnet_support,
            "generic_bacnet": bacnet_support,
            "generic_modbus": modbus_support
        }
    
    def _assess_cybersecurity(self, spec: BASDeviceSpecification) -> Dict[str, Any]:
        """Assess cybersecurity features"""
        security_features = spec.cybersecurity_features
        
        basic_security = any(feature.lower() in ["tls", "encryption", "https"] for feature in security_features)
        advanced_security = any(feature.lower() in ["vpn", "firewall", "pki"] for feature in security_features)
        
        if advanced_security:
            security_level = "High"
            security_score = 9
        elif basic_security:
            security_level = "Medium"
            security_score = 6
        else:
            security_level = "Low"
            security_score = 3
        
        return {
            "security_level": security_level,
            "security_score": security_score,
            "features": security_features,
            "recommendations": self._get_security_recommendations(security_level)
        }
    
    def _assess_future_proofing(self, spec: BASDeviceSpecification) -> Dict[str, Any]:
        """Assess future-proofing capabilities"""
        future_ready_protocols = [BASProtocol.MATTER, BASProtocol.MQTT, BASProtocol.WIFI]
        edge_computing = spec.processing_capability.get("edge_computing", False)
        ai_capabilities = "ai" in str(spec.processing_capability).lower()
        
        future_score = 5  # Base score
        if any(p in spec.communication_protocols for p in future_ready_protocols):
            future_score += 2
        if edge_computing:
            future_score += 2
        if ai_capabilities:
            future_score += 1
        
        return {
            "future_proofing_score": min(future_score, 10),
            "future_ready_protocols": len([p for p in spec.communication_protocols if p in future_ready_protocols]),
            "edge_computing_support": edge_computing,
            "ai_capabilities": ai_capabilities,
            "upgrade_potential": "High" if future_score >= 8 else "Medium" if future_score >= 6 else "Low"
        }
    
    def _get_security_recommendations(self, security_level: str) -> List[str]:
        """Get security recommendations based on current level"""
        recommendations = {
            "Low": [
                "Implement TLS encryption for all communications",
                "Use strong authentication mechanisms",
                "Regular security updates and patches",
                "Network segmentation for BAS devices"
            ],
            "Medium": [
                "Implement VPN for remote access",
                "Deploy network monitoring and intrusion detection",
                "Regular security audits",
                "Backup and disaster recovery plans"
            ],
            "High": [
                "Maintain current security posture",
                "Regular penetration testing",
                "Zero-trust architecture implementation",
                "Continuous security monitoring"
            ]
        }
        return recommendations.get(security_level, [])

class IoTDeviceManager:
    """IoT device management and profiling"""
    
    async def create_iot_profile(self, result: BASAnalysisResult) -> IoTDeviceProfile:
        """Create IoT device profile"""
        if not result.bas_specification:
            return None
        
        spec = result.bas_specification
        
        # Determine primary communication protocol
        primary_protocol = spec.communication_protocols[0] if spec.communication_protocols else BASProtocol.WIFI
        
        # Generate data points based on device category
        data_points = self._get_data_points(result.device_category)
        
        # Estimate update frequency
        update_frequency = self._get_update_frequency(result.device_category)
        
        # Estimate power consumption
        power_consumption = spec.power_supply.get("consumption", 5.0)
        
        profile = IoTDeviceProfile(
            device_id=result.component_id,
            device_type=result.device_category.value,
            communication_protocol=primary_protocol,
            data_points=data_points,
            update_frequency=update_frequency,
            power_consumption=power_consumption,
            battery_life=spec.power_supply.get("battery_life"),
            edge_computing=spec.processing_capability.get("edge_computing", False),
            ai_capabilities=self._get_ai_capabilities(spec),
            interoperability=self._get_interoperability_features(spec)
        )
        
        return profile
    
    def _get_data_points(self, device_category: BASDeviceCategory) -> List[str]:
        """Get data points by device category"""
        data_points_map = {
            BASDeviceCategory.TEMPERATURE_SENSOR: ["temperature", "timestamp", "battery_level"],
            BASDeviceCategory.HUMIDITY_SENSOR: ["humidity", "temperature", "timestamp", "battery_level"],
            BASDeviceCategory.CO2_SENSOR: ["co2_level", "temperature", "humidity", "timestamp"],
            BASDeviceCategory.OCCUPANCY_SENSOR: ["occupancy", "light_level", "timestamp", "battery_level"],
            BASDeviceCategory.ENERGY_METER: ["power", "energy", "voltage", "current", "timestamp"],
            BASDeviceCategory.SMART_THERMOSTAT: ["temperature", "setpoint", "humidity", "mode", "schedule"]
        }
        return data_points_map.get(device_category, ["status", "timestamp"])
    
    def _get_update_frequency(self, device_category: BASDeviceCategory) -> int:
        """Get update frequency in seconds"""
        frequency_map = {
            BASDeviceCategory.TEMPERATURE_SENSOR: 300,  # 5 minutes
            BASDeviceCategory.HUMIDITY_SENSOR: 300,     # 5 minutes
            BASDeviceCategory.CO2_SENSOR: 60,           # 1 minute
            BASDeviceCategory.OCCUPANCY_SENSOR: 30,     # 30 seconds
            BASDeviceCategory.ENERGY_METER: 15,         # 15 seconds
            BASDeviceCategory.SMART_THERMOSTAT: 120     # 2 minutes
        }
        return frequency_map.get(device_category, 300)
    
    def _get_ai_capabilities(self, spec: BASDeviceSpecification) -> List[str]:
        """Get AI capabilities from specification"""
        ai_capabilities = []
        
        if spec.processing_capability.get("ai_inference"):
            ai_capabilities.append("Edge AI Inference")
        
        if spec.processing_capability.get("machine_learning"):
            ai_capabilities.append("Machine Learning")
        
        if "predictive" in str(spec.integration_features).lower():
            ai_capabilities.append("Predictive Analytics")
        
        return ai_capabilities
    
    def _get_interoperability_features(self, spec: BASDeviceSpecification) -> List[str]:
        """Get interoperability features"""
        features = []
        
        if len(spec.communication_protocols) > 1:
            features.append("Multi-protocol Support")
        
        if BASProtocol.MATTER in spec.communication_protocols:
            features.append("Matter Compatible")
        
        if spec.integration_features:
            features.extend(spec.integration_features)
        
        return features

# Testing functions
async def test_building_automation_analysis():
    """Test building automation system analysis"""
    analyzer = BuildingAutomationAnalyzer()
    
    print("Testing BAS Controller Analysis:")
    test_image = np.random.randint(0, 255, (600, 800, 3), dtype=np.uint8)
    test_bbox = (100, 100, 300, 200)
    
    # Test BAS controller
    controller_result = await analyzer.analyze_bas_device(
        test_image, test_bbox, BASDeviceCategory.BAS_CONTROLLER
    )
    
    print(f"Controller Component ID: {controller_result.component_id}")
    print(f"Controller Confidence: {controller_result.confidence}")
    if controller_result.bas_specification:
        print(f"Manufacturer: {controller_result.bas_specification.manufacturer}")
        print(f"Protocols: {[p.value for p in controller_result.bas_specification.communication_protocols]}")
        print(f"I/O Points: {controller_result.bas_specification.input_output_points}")
    
    # Test smart sensor
    print("\nTesting Smart Sensor Analysis:")
    sensor_result = await analyzer.analyze_bas_device(
        test_image, test_bbox, BASDeviceCategory.TEMPERATURE_SENSOR
    )
    
    print(f"Sensor Component ID: {sensor_result.component_id}")
    if sensor_result.iot_profile:
        print(f"IoT Device Type: {sensor_result.iot_profile.device_type}")
        print(f"Communication Protocol: {sensor_result.iot_profile.communication_protocol.value}")
        print(f"Data Points: {sensor_result.iot_profile.data_points}")
        print(f"Update Frequency: {sensor_result.iot_profile.update_frequency} seconds")
    
    print(f"\nEnergy Efficiency: {json.dumps(controller_result.energy_efficiency, indent=2)}")
    print(f"\nInteroperability: {json.dumps(controller_result.interoperability_analysis, indent=2)}")

if __name__ == "__main__":
    asyncio.run(test_building_automation_analysis())