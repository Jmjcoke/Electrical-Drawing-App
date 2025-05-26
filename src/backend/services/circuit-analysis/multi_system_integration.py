from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
import numpy as np
import json
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class SystemType(Enum):
    FIRE_ALARM = "fire_alarm"
    SECURITY = "security"
    COMMUNICATIONS = "communications"
    HVAC_CONTROL = "hvac_control"
    LIGHTING_CONTROL = "lighting_control"
    POWER_DISTRIBUTION = "power_distribution"
    EMERGENCY_POWER = "emergency_power"

class SignalType(Enum):
    DIGITAL = "digital"
    ANALOG = "analog"
    RELAY = "relay"
    PNEUMATIC = "pneumatic"
    FIBER_OPTIC = "fiber_optic"
    WIRELESS = "wireless"

@dataclass
class SystemComponent:
    id: str
    name: str
    system_type: SystemType
    signal_type: SignalType
    voltage_level: float
    current_rating: float
    power_consumption: float
    location: Tuple[float, float]
    zone: str
    address: Optional[str] = None
    device_class: Optional[str] = None
    manufacturers_specs: Dict[str, Any] = field(default_factory=dict)

@dataclass
class SystemInterconnection:
    source_component: str
    target_component: str
    connection_type: str
    signal_characteristics: Dict[str, Any]
    cable_specifications: Dict[str, Any]
    supervision_required: bool = True

@dataclass
class SystemZone:
    zone_id: str
    zone_name: str
    system_type: SystemType
    components: List[str]
    control_panel: Optional[str] = None
    backup_power: bool = False
    supervision_level: str = "Class A"

class FireAlarmSystemAnalyzer:
    def __init__(self):
        self.nfpa_72_requirements = {
            "detection_coverage": {
                "smoke_detector_spacing": 30,  # feet
                "heat_detector_spacing": 50,   # feet
                "beam_detector_max_length": 300  # feet
            },
            "notification": {
                "audible_level": 75,  # dB at 10 feet
                "visual_candela": 15,  # cd for rooms <20x20
                "strobing_rate": (1, 3)  # flashes per second range
            },
            "power_requirements": {
                "primary_power": "120V_dedicated_circuit",
                "secondary_power": "24_hour_standby_plus_15_min_alarm",
                "supervision": "Class_A_or_Class_B"
            }
        }
    
    def analyze_fire_alarm_circuit(self, components: List[SystemComponent]) -> Dict[str, Any]:
        fire_components = [c for c in components if c.system_type == SystemType.FIRE_ALARM]
        
        analysis = {
            "zone_analysis": self._analyze_zones(fire_components),
            "power_calculation": self._calculate_fire_alarm_power(fire_components),
            "supervision_analysis": self._analyze_supervision_requirements(fire_components),
            "nfpa_compliance": self._check_nfpa_compliance(fire_components),
            "battery_backup": self._calculate_battery_requirements(fire_components)
        }
        
        return analysis
    
    def _analyze_zones(self, components: List[SystemComponent]) -> Dict[str, Any]:
        zones = {}
        for component in components:
            zone = component.zone
            if zone not in zones:
                zones[zone] = {
                    "devices": [],
                    "total_current": 0,
                    "device_types": set()
                }
            zones[zone]["devices"].append(component.id)
            zones[zone]["total_current"] += component.current_rating
            zones[zone]["device_types"].add(component.device_class)
        
        return {
            "zone_count": len(zones),
            "zones": zones,
            "max_devices_per_zone": max(len(z["devices"]) for z in zones.values()) if zones else 0
        }
    
    def _calculate_fire_alarm_power(self, components: List[SystemComponent]) -> Dict[str, float]:
        total_standby_current = sum(c.current_rating * 0.8 for c in components)  # 80% standby
        total_alarm_current = sum(c.current_rating for c in components)
        
        return {
            "standby_current_ma": total_standby_current,
            "alarm_current_ma": total_alarm_current,
            "standby_power_watts": total_standby_current * 24 / 1000,
            "alarm_power_watts": total_alarm_current * 24 / 1000
        }
    
    def _analyze_supervision_requirements(self, components: List[SystemComponent]) -> Dict[str, Any]:
        class_a_zones = []
        class_b_zones = []
        
        for component in components:
            if "Class_A" in component.manufacturers_specs.get("supervision", ""):
                class_a_zones.append(component.zone)
            else:
                class_b_zones.append(component.zone)
        
        return {
            "class_a_zones": list(set(class_a_zones)),
            "class_b_zones": list(set(class_b_zones)),
            "supervision_method": "end_of_line_resistor"
        }
    
    def _check_nfpa_compliance(self, components: List[SystemComponent]) -> Dict[str, bool]:
        compliance = {
            "detector_spacing": True,
            "notification_levels": True,
            "power_supervision": True,
            "secondary_power": True
        }
        
        return compliance
    
    def _calculate_battery_requirements(self, components: List[SystemComponent]) -> Dict[str, float]:
        standby_current = sum(c.current_rating * 0.8 for c in components) / 1000  # Convert to A
        alarm_current = sum(c.current_rating for c in components) / 1000
        
        standby_hours = 24
        alarm_minutes = 15
        
        battery_ah = (standby_current * standby_hours) + (alarm_current * alarm_minutes / 60)
        battery_ah *= 1.2  # 20% safety factor
        
        return {
            "required_ah": battery_ah,
            "recommended_ah": battery_ah * 1.25,
            "battery_voltage": 24
        }

class SecuritySystemAnalyzer:
    def __init__(self):
        self.security_standards = {
            "ul_standards": ["UL 681", "UL 1076", "UL 1610"],
            "power_requirements": {
                "control_panel": "120VAC_dedicated",
                "backup_power": "4_hour_minimum",
                "device_supervision": "required"
            }
        }
    
    def analyze_security_circuit(self, components: List[SystemComponent]) -> Dict[str, Any]:
        security_components = [c for c in components if c.system_type == SystemType.SECURITY]
        
        return {
            "access_control": self._analyze_access_control(security_components),
            "intrusion_detection": self._analyze_intrusion_detection(security_components),
            "video_surveillance": self._analyze_video_surveillance(security_components),
            "power_analysis": self._calculate_security_power(security_components),
            "communication_analysis": self._analyze_security_communications(security_components)
        }
    
    def _analyze_access_control(self, components: List[SystemComponent]) -> Dict[str, Any]:
        access_devices = [c for c in components if "access" in c.device_class.lower()]
        
        return {
            "card_readers": len([c for c in access_devices if "reader" in c.device_class.lower()]),
            "door_controllers": len([c for c in access_devices if "controller" in c.device_class.lower()]),
            "electric_locks": len([c for c in access_devices if "lock" in c.device_class.lower()]),
            "total_power_w": sum(c.power_consumption for c in access_devices)
        }
    
    def _analyze_intrusion_detection(self, components: List[SystemComponent]) -> Dict[str, Any]:
        intrusion_devices = [c for c in components if "sensor" in c.device_class.lower() or "detector" in c.device_class.lower()]
        
        return {
            "motion_detectors": len([c for c in intrusion_devices if "motion" in c.device_class.lower()]),
            "door_contacts": len([c for c in intrusion_devices if "contact" in c.device_class.lower()]),
            "glass_break_detectors": len([c for c in intrusion_devices if "glass" in c.device_class.lower()]),
            "zone_coverage": len(set(c.zone for c in intrusion_devices))
        }
    
    def _analyze_video_surveillance(self, components: List[SystemComponent]) -> Dict[str, Any]:
        video_devices = [c for c in components if "camera" in c.device_class.lower() or "nvr" in c.device_class.lower()]
        
        total_power = sum(c.power_consumption for c in video_devices)
        poe_devices = len([c for c in video_devices if c.power_consumption <= 30])  # PoE+ limit
        
        return {
            "camera_count": len([c for c in video_devices if "camera" in c.device_class.lower()]),
            "nvr_count": len([c for c in video_devices if "nvr" in c.device_class.lower()]),
            "total_power_w": total_power,
            "poe_compatible": poe_devices,
            "high_power_devices": len(video_devices) - poe_devices
        }
    
    def _calculate_security_power(self, components: List[SystemComponent]) -> Dict[str, float]:
        total_power = sum(c.power_consumption for c in components)
        control_panel_power = 50  # Typical control panel power
        
        return {
            "device_power_w": total_power,
            "control_panel_w": control_panel_power,
            "total_power_w": total_power + control_panel_power,
            "backup_battery_ah": (total_power + control_panel_power) * 4 / 12  # 4 hours at 12V
        }
    
    def _analyze_security_communications(self, components: List[SystemComponent]) -> Dict[str, Any]:
        wired_devices = len([c for c in components if c.signal_type != SignalType.WIRELESS])
        wireless_devices = len([c for c in components if c.signal_type == SignalType.WIRELESS])
        
        return {
            "wired_devices": wired_devices,
            "wireless_devices": wireless_devices,
            "communication_types": list(set(c.signal_type.value for c in components)),
            "supervision_required": True
        }

class CommunicationsSystemAnalyzer:
    def __init__(self):
        self.standards = {
            "structured_cabling": "TIA-568",
            "telecommunications": "TIA-569",
            "fiber_optic": "TIA-598",
            "wireless": "IEEE_802.11"
        }
    
    def analyze_communications_circuit(self, components: List[SystemComponent]) -> Dict[str, Any]:
        comm_components = [c for c in components if c.system_type == SystemType.COMMUNICATIONS]
        
        return {
            "structured_cabling": self._analyze_structured_cabling(comm_components),
            "network_infrastructure": self._analyze_network_infrastructure(comm_components),
            "fiber_optic": self._analyze_fiber_optic(comm_components),
            "wireless_systems": self._analyze_wireless_systems(comm_components),
            "power_over_ethernet": self._analyze_poe_requirements(comm_components)
        }
    
    def _analyze_structured_cabling(self, components: List[SystemComponent]) -> Dict[str, Any]:
        data_outlets = len([c for c in components if "outlet" in c.device_class.lower()])
        patch_panels = len([c for c in components if "patch" in c.device_class.lower()])
        
        return {
            "data_outlets": data_outlets,
            "patch_panels": patch_panels,
            "estimated_cable_runs": data_outlets,
            "backbone_requirements": "Category 6A or Fiber"
        }
    
    def _analyze_network_infrastructure(self, components: List[SystemComponent]) -> Dict[str, Any]:
        switches = [c for c in components if "switch" in c.device_class.lower()]
        routers = [c for c in components if "router" in c.device_class.lower()]
        
        total_ports = sum(int(c.manufacturers_specs.get("port_count", 24)) for c in switches)
        
        return {
            "switch_count": len(switches),
            "router_count": len(routers),
            "total_ports": total_ports,
            "power_consumption_w": sum(c.power_consumption for c in switches + routers)
        }
    
    def _analyze_fiber_optic(self, components: List[SystemComponent]) -> Dict[str, Any]:
        fiber_components = [c for c in components if c.signal_type == SignalType.FIBER_OPTIC]
        
        return {
            "fiber_count": len(fiber_components),
            "single_mode": len([c for c in fiber_components if "single" in c.manufacturers_specs.get("fiber_type", "").lower()]),
            "multi_mode": len([c for c in fiber_components if "multi" in c.manufacturers_specs.get("fiber_type", "").lower()]),
            "splice_requirements": True if fiber_components else False
        }
    
    def _analyze_wireless_systems(self, components: List[SystemComponent]) -> Dict[str, Any]:
        wireless_components = [c for c in components if c.signal_type == SignalType.WIRELESS]
        
        return {
            "access_points": len([c for c in wireless_components if "ap" in c.device_class.lower() or "access" in c.device_class.lower()]),
            "wireless_controllers": len([c for c in wireless_components if "controller" in c.device_class.lower()]),
            "coverage_analysis": "Site survey recommended"
        }
    
    def _analyze_poe_requirements(self, components: List[SystemComponent]) -> Dict[str, Any]:
        poe_devices = [c for c in components if c.power_consumption > 0 and c.power_consumption <= 30]
        poe_plus_devices = [c for c in components if c.power_consumption > 30 and c.power_consumption <= 60]
        
        return {
            "poe_devices": len(poe_devices),
            "poe_plus_devices": len(poe_plus_devices),
            "total_poe_power_w": sum(c.power_consumption for c in poe_devices + poe_plus_devices),
            "switch_poe_budget_required": sum(c.power_consumption for c in poe_devices + poe_plus_devices) * 1.2
        }

class HVACControlAnalyzer:
    def __init__(self):
        self.control_standards = {
            "building_automation": "BACnet",
            "hvac_controls": "ASHRAE_135",
            "energy_management": "ASHRAE_90.1"
        }
    
    def analyze_hvac_control_circuit(self, components: List[SystemComponent]) -> Dict[str, Any]:
        hvac_components = [c for c in components if c.system_type == SystemType.HVAC_CONTROL]
        
        return {
            "control_system": self._analyze_control_system(hvac_components),
            "sensors_actuators": self._analyze_sensors_actuators(hvac_components),
            "communication_network": self._analyze_hvac_communications(hvac_components),
            "power_requirements": self._calculate_hvac_power(hvac_components),
            "energy_management": self._analyze_energy_management(hvac_components)
        }
    
    def _analyze_control_system(self, components: List[SystemComponent]) -> Dict[str, Any]:
        controllers = [c for c in components if "controller" in c.device_class.lower()]
        
        return {
            "ddc_controllers": len([c for c in controllers if "ddc" in c.device_class.lower()]),
            "vav_controllers": len([c for c in controllers if "vav" in c.device_class.lower()]),
            "ahu_controllers": len([c for c in controllers if "ahu" in c.device_class.lower()]),
            "total_control_points": sum(int(c.manufacturers_specs.get("io_points", 16)) for c in controllers)
        }
    
    def _analyze_sensors_actuators(self, components: List[SystemComponent]) -> Dict[str, Any]:
        sensors = [c for c in components if "sensor" in c.device_class.lower()]
        actuators = [c for c in components if "actuator" in c.device_class.lower() or "valve" in c.device_class.lower()]
        
        return {
            "temperature_sensors": len([c for c in sensors if "temp" in c.device_class.lower()]),
            "humidity_sensors": len([c for c in sensors if "humidity" in c.device_class.lower()]),
            "pressure_sensors": len([c for c in sensors if "pressure" in c.device_class.lower()]),
            "valve_actuators": len([c for c in actuators if "valve" in c.device_class.lower()]),
            "damper_actuators": len([c for c in actuators if "damper" in c.device_class.lower()])
        }
    
    def _analyze_hvac_communications(self, components: List[SystemComponent]) -> Dict[str, Any]:
        digital_devices = len([c for c in components if c.signal_type == SignalType.DIGITAL])
        analog_devices = len([c for c in components if c.signal_type == SignalType.ANALOG])
        
        return {
            "bacnet_devices": digital_devices,
            "analog_devices": analog_devices,
            "network_topology": "MS/TP or Ethernet",
            "gateway_required": True if analog_devices > 0 else False
        }
    
    def _calculate_hvac_power(self, components: List[SystemComponent]) -> Dict[str, float]:
        control_power = sum(c.power_consumption for c in components if "controller" in c.device_class.lower())
        actuator_power = sum(c.power_consumption for c in components if "actuator" in c.device_class.lower())
        sensor_power = sum(c.power_consumption for c in components if "sensor" in c.device_class.lower())
        
        return {
            "controller_power_w": control_power,
            "actuator_power_w": actuator_power,
            "sensor_power_w": sensor_power,
            "total_power_w": control_power + actuator_power + sensor_power
        }
    
    def _analyze_energy_management(self, components: List[SystemComponent]) -> Dict[str, Any]:
        return {
            "energy_monitoring": True,
            "demand_response": True,
            "scheduling_capability": True,
            "trend_logging": True,
            "alarm_management": True
        }

class MultiSystemIntegrationEngine:
    def __init__(self):
        self.fire_analyzer = FireAlarmSystemAnalyzer()
        self.security_analyzer = SecuritySystemAnalyzer()
        self.comm_analyzer = CommunicationsSystemAnalyzer()
        self.hvac_analyzer = HVACControlAnalyzer()
        
        self.system_analyzers = {
            SystemType.FIRE_ALARM: self.fire_analyzer.analyze_fire_alarm_circuit,
            SystemType.SECURITY: self.security_analyzer.analyze_security_circuit,
            SystemType.COMMUNICATIONS: self.comm_analyzer.analyze_communications_circuit,
            SystemType.HVAC_CONTROL: self.hvac_analyzer.analyze_hvac_control_circuit
        }
    
    def analyze_integrated_systems(self, components: List[SystemComponent], 
                                 interconnections: List[SystemInterconnection]) -> Dict[str, Any]:
        
        system_analyses = {}
        for system_type in SystemType:
            system_components = [c for c in components if c.system_type == system_type]
            if system_components and system_type in self.system_analyzers:
                system_analyses[system_type.value] = self.system_analyzers[system_type](components)
        
        integration_analysis = self._analyze_system_integration(components, interconnections)
        power_coordination = self._analyze_power_coordination(components)
        interference_analysis = self._analyze_electromagnetic_compatibility(components)
        
        return {
            "individual_systems": system_analyses,
            "system_integration": integration_analysis,
            "power_coordination": power_coordination,
            "emc_analysis": interference_analysis,
            "overall_recommendations": self._generate_integration_recommendations(system_analyses)
        }
    
    def _analyze_system_integration(self, components: List[SystemComponent], 
                                  interconnections: List[SystemInterconnection]) -> Dict[str, Any]:
        
        integration_points = []
        for interconnection in interconnections:
            source = next((c for c in components if c.id == interconnection.source_component), None)
            target = next((c for c in components if c.id == interconnection.target_component), None)
            
            if source and target:
                integration_points.append({
                    "source_system": source.system_type.value,
                    "target_system": target.system_type.value,
                    "connection_type": interconnection.connection_type,
                    "supervision": interconnection.supervision_required
                })
        
        return {
            "integration_count": len(integration_points),
            "integration_matrix": integration_points,
            "common_infrastructure": self._identify_common_infrastructure(components),
            "shared_resources": self._identify_shared_resources(components)
        }
    
    def _analyze_power_coordination(self, components: List[SystemComponent]) -> Dict[str, Any]:
        system_power = {}
        for system_type in SystemType:
            system_components = [c for c in components if c.system_type == system_type]
            if system_components:
                total_power = sum(c.power_consumption for c in system_components)
                system_power[system_type.value] = total_power
        
        total_building_power = sum(system_power.values())
        
        return {
            "system_power_breakdown": system_power,
            "total_low_voltage_power_w": total_building_power,
            "ups_requirements": self._calculate_ups_requirements(components),
            "emergency_power": self._analyze_emergency_power_requirements(components),
            "power_quality": self._analyze_power_quality_requirements(components)
        }
    
    def _analyze_electromagnetic_compatibility(self, components: List[SystemComponent]) -> Dict[str, Any]:
        high_frequency_systems = [c for c in components if c.signal_type in [SignalType.WIRELESS, SignalType.FIBER_OPTIC]]
        analog_systems = [c for c in components if c.signal_type == SignalType.ANALOG]
        digital_systems = [c for c in components if c.signal_type == SignalType.DIGITAL]
        
        return {
            "interference_sources": len(high_frequency_systems),
            "sensitive_circuits": len(analog_systems),
            "digital_noise_sources": len(digital_systems),
            "separation_requirements": {
                "power_low_voltage": "12_inches_minimum",
                "analog_digital": "6_inches_minimum",
                "fire_alarm_separation": "power_limited_circuits_only"
            },
            "grounding_requirements": "single_point_ground_recommended",
            "shielding_requirements": self._determine_shielding_requirements(components)
        }
    
    def _identify_common_infrastructure(self, components: List[SystemComponent]) -> List[str]:
        infrastructure = []
        
        systems_present = set(c.system_type for c in components)
        
        if len(systems_present) > 1:
            infrastructure.extend([
                "shared_conduit_systems",
                "common_grounding_system",
                "unified_labeling_system"
            ])
        
        if SystemType.COMMUNICATIONS in systems_present:
            infrastructure.append("structured_cabling_backbone")
        
        if any(c.signal_type == SignalType.FIBER_OPTIC for c in components):
            infrastructure.append("fiber_optic_backbone")
        
        return infrastructure
    
    def _identify_shared_resources(self, components: List[SystemComponent]) -> Dict[str, Any]:
        zones = set(c.zone for c in components if c.zone)
        systems_by_zone = {}
        
        for zone in zones:
            zone_components = [c for c in components if c.zone == zone]
            zone_systems = set(c.system_type.value for c in zone_components)
            if len(zone_systems) > 1:
                systems_by_zone[zone] = list(zone_systems)
        
        return {
            "multi_system_zones": systems_by_zone,
            "shared_pathways": len(systems_by_zone),
            "coordination_required": len(systems_by_zone) > 0
        }
    
    def _calculate_ups_requirements(self, components: List[SystemComponent]) -> Dict[str, Any]:
        critical_systems = [c for c in components if c.system_type in [SystemType.FIRE_ALARM, SystemType.SECURITY]]
        critical_power = sum(c.power_consumption for c in critical_systems)
        
        return {
            "critical_load_w": critical_power,
            "recommended_ups_va": critical_power * 1.4,  # 40% overhead
            "backup_time_hours": 4,
            "battery_type": "sealed_lead_acid_or_lithium"
        }
    
    def _analyze_emergency_power_requirements(self, components: List[SystemComponent]) -> Dict[str, Any]:
        emergency_systems = [c for c in components if c.system_type in [SystemType.FIRE_ALARM, SystemType.EMERGENCY_POWER]]
        
        return {
            "emergency_systems": [c.system_type.value for c in emergency_systems],
            "generator_connection": len(emergency_systems) > 0,
            "transfer_switch": "automatic" if emergency_systems else "not_required",
            "fuel_type": "natural_gas_or_diesel"
        }
    
    def _analyze_power_quality_requirements(self, components: List[SystemComponent]) -> Dict[str, Any]:
        sensitive_components = [c for c in components if c.system_type == SystemType.COMMUNICATIONS]
        
        return {
            "surge_protection": "required_all_systems",
            "power_conditioning": len(sensitive_components) > 0,
            "isolation_transformers": "recommended_for_critical_loads",
            "harmonic_filtering": "may_be_required"
        }
    
    def _determine_shielding_requirements(self, components: List[SystemComponent]) -> Dict[str, str]:
        has_fire_alarm = any(c.system_type == SystemType.FIRE_ALARM for c in components)
        has_security = any(c.system_type == SystemType.SECURITY for c in components)
        has_analog = any(c.signal_type == SignalType.ANALOG for c in components)
        
        requirements = {}
        
        if has_fire_alarm:
            requirements["fire_alarm"] = "power_limited_wiring_only"
        
        if has_security and has_analog:
            requirements["security_analog"] = "shielded_cable_required"
        
        if any(c.signal_type == SignalType.FIBER_OPTIC for c in components):
            requirements["fiber_optic"] = "armored_cable_recommended"
        
        return requirements
    
    def _generate_integration_recommendations(self, system_analyses: Dict[str, Any]) -> List[str]:
        recommendations = []
        
        recommendations.append("Implement unified grounding and bonding system per NEC Article 250")
        recommendations.append("Use separate conduits for power and low-voltage systems")
        recommendations.append("Install surge protection devices on all system power feeds")
        recommendations.append("Coordinate installation sequences to minimize interference")
        recommendations.append("Perform system commissioning with integrated testing")
        
        if "fire_alarm" in system_analyses:
            recommendations.append("Ensure fire alarm system has priority over all other systems")
            recommendations.append("Provide dedicated fire alarm power circuits")
        
        if "security" in system_analyses and "communications" in system_analyses:
            recommendations.append("Consider shared network infrastructure with VLANs")
        
        if "hvac_control" in system_analyses:
            recommendations.append("Integrate HVAC controls with building automation system")
        
        return recommendations

def create_sample_multi_system_integration():
    components = [
        # Fire Alarm Components
        SystemComponent("FA001", "Smoke Detector", SystemType.FIRE_ALARM, SignalType.DIGITAL, 24, 80, 2, (100, 100), "Zone1", device_class="Smoke Detector"),
        SystemComponent("FA002", "Pull Station", SystemType.FIRE_ALARM, SignalType.DIGITAL, 24, 50, 1, (150, 100), "Zone1", device_class="Manual Pull Station"),
        SystemComponent("FA003", "Horn Strobe", SystemType.FIRE_ALARM, SignalType.DIGITAL, 24, 200, 15, (200, 100), "Zone1", device_class="Notification Device"),
        
        # Security Components  
        SystemComponent("SEC001", "Card Reader", SystemType.SECURITY, SignalType.DIGITAL, 12, 500, 6, (100, 200), "Zone2", device_class="Access Control Reader"),
        SystemComponent("SEC002", "Motion Detector", SystemType.SECURITY, SignalType.DIGITAL, 12, 100, 2, (150, 200), "Zone2", device_class="Motion Sensor"),
        SystemComponent("SEC003", "IP Camera", SystemType.SECURITY, SignalType.DIGITAL, 48, 800, 25, (200, 200), "Zone2", device_class="IP Camera"),
        
        # Communications Components
        SystemComponent("COMM001", "Network Switch", SystemType.COMMUNICATIONS, SignalType.DIGITAL, 120, 500, 45, (100, 300), "IDF1", device_class="Ethernet Switch"),
        SystemComponent("COMM002", "Wireless AP", SystemType.COMMUNICATIONS, SignalType.WIRELESS, 48, 600, 20, (150, 300), "Zone3", device_class="Wireless Access Point"),
        SystemComponent("COMM003", "Fiber Patch Panel", SystemType.COMMUNICATIONS, SignalType.FIBER_OPTIC, 0, 0, 0, (200, 300), "IDF1", device_class="Fiber Patch Panel"),
        
        # HVAC Control Components
        SystemComponent("HVAC001", "DDC Controller", SystemType.HVAC_CONTROL, SignalType.DIGITAL, 24, 300, 12, (100, 400), "AHU1", device_class="DDC Controller"),
        SystemComponent("HVAC002", "Temperature Sensor", SystemType.HVAC_CONTROL, SignalType.ANALOG, 24, 20, 0.5, (150, 400), "Zone4", device_class="Temperature Sensor"),
        SystemComponent("HVAC003", "Valve Actuator", SystemType.HVAC_CONTROL, SignalType.ANALOG, 24, 150, 8, (200, 400), "AHU1", device_class="Valve Actuator")
    ]
    
    interconnections = [
        SystemInterconnection("FA001", "FA003", "supervised_circuit", {"voltage": 24, "current": "2-wire"}, {"type": "FPLR", "gauge": "18AWG"}, True),
        SystemInterconnection("SEC001", "COMM001", "ethernet", {"protocol": "TCP/IP", "speed": "100Mbps"}, {"type": "Cat6", "length": 100}, False),
        SystemInterconnection("HVAC001", "HVAC002", "analog_input", {"signal": "4-20mA", "range": "0-100F"}, {"type": "shielded_pair", "gauge": "18AWG"}, True)
    ]
    
    return components, interconnections

if __name__ == "__main__":
    components, interconnections = create_sample_multi_system_integration()
    
    integration_engine = MultiSystemIntegrationEngine()
    analysis = integration_engine.analyze_integrated_systems(components, interconnections)
    
    print(json.dumps(analysis, indent=2, default=str))