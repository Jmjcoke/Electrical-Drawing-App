import asyncio
import numpy as np
import cv2
import json
import logging
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import networkx as nx
from collections import defaultdict
import re

from industrial_control_recognition import (
    IndustrialDeviceCategory,
    CommunicationProtocol,
    IndustrialRecognitionResult,
    IndustrialDeviceSpecification,
    ISASymbolRecognition,
    ControlLoopIdentification
)

logger = logging.getLogger(__name__)

class ControlSystemLevel(Enum):
    ENTERPRISE = "enterprise"          # Level 4: Enterprise/Business
    SUPERVISION = "supervision"        # Level 3: SCADA/HMI
    CONTROL = "control"               # Level 2: PLC/DCS/Controllers
    FIELD_CONTROL = "field_control"   # Level 1: Field Controllers/RTUs
    FIELD_DEVICE = "field_device"     # Level 0: Sensors/Actuators

class NetworkTopology(Enum):
    STAR = "star"
    RING = "ring"
    BUS = "bus"
    MESH = "mesh"
    TREE = "tree"
    HYBRID = "hybrid"

class RedundancyType(Enum):
    NONE = "none"
    COLD_STANDBY = "cold_standby"
    HOT_STANDBY = "hot_standby"
    LOAD_SHARING = "load_sharing"
    FAULT_TOLERANT = "fault_tolerant"

@dataclass
class ControlSystemHierarchy:
    level: ControlSystemLevel
    devices: List[str] = field(default_factory=list)
    connections: List[Tuple[str, str]] = field(default_factory=list)
    protocols: Set[CommunicationProtocol] = field(default_factory=set)
    redundancy: RedundancyType = RedundancyType.NONE

@dataclass
class NetworkSegment:
    segment_id: str
    protocol: CommunicationProtocol
    devices: List[str] = field(default_factory=list)
    topology: NetworkTopology = NetworkTopology.STAR
    redundancy: RedundancyType = RedundancyType.NONE
    bandwidth: Optional[str] = None
    max_devices: Optional[int] = None
    cable_type: Optional[str] = None
    distance_limits: Optional[Tuple[float, float]] = None  # (min, max) in meters

@dataclass
class IOSummary:
    digital_inputs: int = 0
    digital_outputs: int = 0
    analog_inputs: int = 0
    analog_outputs: int = 0
    spare_di: int = 0
    spare_do: int = 0
    spare_ai: int = 0
    spare_ao: int = 0
    total_capacity_di: int = 0
    total_capacity_do: int = 0
    total_capacity_ai: int = 0
    total_capacity_ao: int = 0

@dataclass
class ControlSystemArchitectureAnalysis:
    system_hierarchy: Dict[ControlSystemLevel, ControlSystemHierarchy]
    network_segments: List[NetworkSegment]
    io_summary: IOSummary
    control_loops: List[ControlLoopIdentification]
    safety_systems: List[Dict[str, Any]]
    performance_metrics: Dict[str, Any]
    recommendations: List[str]
    analysis_timestamp: datetime = field(default_factory=datetime.now)

class HierarchicalControlAnalyzer:
    def __init__(self):
        self.device_hierarchy_map = self._create_device_hierarchy_map()
        self.protocol_characteristics = self._create_protocol_characteristics()
        
    def _create_device_hierarchy_map(self) -> Dict[IndustrialDeviceCategory, ControlSystemLevel]:
        """Map device categories to control system levels"""
        return {
            # Level 4: Enterprise (typically not in electrical drawings)
            
            # Level 3: Supervision
            IndustrialDeviceCategory.HMI: ControlSystemLevel.SUPERVISION,
            IndustrialDeviceCategory.OPERATOR_INTERFACE: ControlSystemLevel.SUPERVISION,
            
            # Level 2: Control
            IndustrialDeviceCategory.PLC: ControlSystemLevel.CONTROL,
            IndustrialDeviceCategory.SAFETY_PLC: ControlSystemLevel.CONTROL,
            IndustrialDeviceCategory.BAS_CONTROLLER: ControlSystemLevel.CONTROL,
            
            # Level 1: Field Control
            IndustrialDeviceCategory.ROOM_CONTROLLER: ControlSystemLevel.FIELD_CONTROL,
            IndustrialDeviceCategory.VFD: ControlSystemLevel.FIELD_CONTROL,
            IndustrialDeviceCategory.MOTOR_STARTER: ControlSystemLevel.FIELD_CONTROL,
            IndustrialDeviceCategory.MCC_BUCKET: ControlSystemLevel.FIELD_CONTROL,
            
            # Level 0: Field Devices
            IndustrialDeviceCategory.PRESSURE_TRANSMITTER: ControlSystemLevel.FIELD_DEVICE,
            IndustrialDeviceCategory.TEMPERATURE_TRANSMITTER: ControlSystemLevel.FIELD_DEVICE,
            IndustrialDeviceCategory.FLOW_TRANSMITTER: ControlSystemLevel.FIELD_DEVICE,
            IndustrialDeviceCategory.LEVEL_TRANSMITTER: ControlSystemLevel.FIELD_DEVICE,
            IndustrialDeviceCategory.PROXIMITY_SENSOR: ControlSystemLevel.FIELD_DEVICE,
            IndustrialDeviceCategory.PHOTOELECTRIC_SENSOR: ControlSystemLevel.FIELD_DEVICE,
            IndustrialDeviceCategory.LIMIT_SWITCH: ControlSystemLevel.FIELD_DEVICE,
            IndustrialDeviceCategory.CONTROL_VALVE: ControlSystemLevel.FIELD_DEVICE,
            IndustrialDeviceCategory.SOLENOID_VALVE: ControlSystemLevel.FIELD_DEVICE,
            IndustrialDeviceCategory.PNEUMATIC_ACTUATOR: ControlSystemLevel.FIELD_DEVICE,
            IndustrialDeviceCategory.ELECTRIC_ACTUATOR: ControlSystemLevel.FIELD_DEVICE,
            IndustrialDeviceCategory.EMERGENCY_STOP: ControlSystemLevel.FIELD_DEVICE,
            IndustrialDeviceCategory.DAMPER_ACTUATOR: ControlSystemLevel.FIELD_DEVICE,
            IndustrialDeviceCategory.VAV_BOX: ControlSystemLevel.FIELD_DEVICE,
        }
    
    def _create_protocol_characteristics(self) -> Dict[CommunicationProtocol, Dict[str, Any]]:
        """Define characteristics of communication protocols"""
        return {
            CommunicationProtocol.ETHERNET_IP: {
                "level": [ControlSystemLevel.SUPERVISION, ControlSystemLevel.CONTROL],
                "topology": NetworkTopology.STAR,
                "max_devices": 65536,
                "bandwidth": "100Mbps/1Gbps",
                "distance_limit": 100,  # meters
                "redundancy_support": True,
                "real_time": True
            },
            CommunicationProtocol.PROFINET: {
                "level": [ControlSystemLevel.SUPERVISION, ControlSystemLevel.CONTROL],
                "topology": NetworkTopology.STAR,
                "max_devices": 65536,
                "bandwidth": "100Mbps",
                "distance_limit": 100,
                "redundancy_support": True,
                "real_time": True
            },
            CommunicationProtocol.MODBUS_TCP: {
                "level": [ControlSystemLevel.CONTROL, ControlSystemLevel.FIELD_CONTROL],
                "topology": NetworkTopology.STAR,
                "max_devices": 247,
                "bandwidth": "10/100Mbps",
                "distance_limit": 100,
                "redundancy_support": False,
                "real_time": False
            },
            CommunicationProtocol.MODBUS_RTU: {
                "level": [ControlSystemLevel.FIELD_CONTROL, ControlSystemLevel.FIELD_DEVICE],
                "topology": NetworkTopology.BUS,
                "max_devices": 247,
                "bandwidth": "9.6k-115.2kbps",
                "distance_limit": 1200,  # RS-485
                "redundancy_support": False,
                "real_time": False
            },
            CommunicationProtocol.DEVICENET: {
                "level": [ControlSystemLevel.FIELD_CONTROL, ControlSystemLevel.FIELD_DEVICE],
                "topology": NetworkTopology.BUS,
                "max_devices": 64,
                "bandwidth": "125k/250k/500kbps",
                "distance_limit": 500,
                "redundancy_support": False,
                "real_time": True
            },
            CommunicationProtocol.PROFIBUS: {
                "level": [ControlSystemLevel.CONTROL, ControlSystemLevel.FIELD_CONTROL],
                "topology": NetworkTopology.BUS,
                "max_devices": 127,
                "bandwidth": "9.6k-12Mbps",
                "distance_limit": 1200,
                "redundancy_support": True,
                "real_time": True
            },
            CommunicationProtocol.CONTROLNET: {
                "level": [ControlSystemLevel.SUPERVISION, ControlSystemLevel.CONTROL],
                "topology": NetworkTopology.BUS,
                "max_devices": 99,
                "bandwidth": "5Mbps",
                "distance_limit": 1000,
                "redundancy_support": True,
                "real_time": True
            },
            CommunicationProtocol.FOUNDATION_FIELDBUS: {
                "level": [ControlSystemLevel.FIELD_CONTROL, ControlSystemLevel.FIELD_DEVICE],
                "topology": NetworkTopology.BUS,
                "max_devices": 32,
                "bandwidth": "31.25kbps",
                "distance_limit": 1900,
                "redundancy_support": True,
                "real_time": True
            },
            CommunicationProtocol.HART: {
                "level": [ControlSystemLevel.FIELD_DEVICE],
                "topology": NetworkTopology.STAR,
                "max_devices": 1,  # Point-to-point
                "bandwidth": "1200bps",
                "distance_limit": 3000,
                "redundancy_support": False,
                "real_time": False
            },
            CommunicationProtocol.BACNET: {
                "level": [ControlSystemLevel.SUPERVISION, ControlSystemLevel.CONTROL],
                "topology": NetworkTopology.STAR,
                "max_devices": 65535,
                "bandwidth": "10/100Mbps",
                "distance_limit": 100,
                "redundancy_support": True,
                "real_time": False
            },
            CommunicationProtocol.LONWORKS: {
                "level": [ControlSystemLevel.CONTROL, ControlSystemLevel.FIELD_CONTROL],
                "topology": NetworkTopology.BUS,
                "max_devices": 32000,
                "bandwidth": "78k-1.25Mbps",
                "distance_limit": 2700,
                "redundancy_support": True,
                "real_time": True
            }
        }
    
    def analyze_hierarchy(self, devices: List[IndustrialRecognitionResult]) -> Dict[ControlSystemLevel, ControlSystemHierarchy]:
        """Analyze and organize devices into control system hierarchy"""
        hierarchy = {}
        
        # Initialize hierarchy levels
        for level in ControlSystemLevel:
            hierarchy[level] = ControlSystemHierarchy(level=level)
        
        # Classify devices by hierarchy level
        for device in devices:
            level = self.device_hierarchy_map.get(device.category, ControlSystemLevel.FIELD_DEVICE)
            hierarchy[level].devices.append(device.component_id)
            
            # Add communication protocols
            if device.specifications:
                for protocol in device.specifications.communication_protocols:
                    hierarchy[level].protocols.add(protocol)
        
        # Analyze connections and redundancy
        for level in ControlSystemLevel:
            hierarchy[level] = self._analyze_level_connections(hierarchy[level], devices)
            hierarchy[level] = self._analyze_level_redundancy(hierarchy[level], devices)
        
        return hierarchy
    
    def _analyze_level_connections(self, level_hierarchy: ControlSystemHierarchy, 
                                 devices: List[IndustrialRecognitionResult]) -> ControlSystemHierarchy:
        """Analyze connections within a hierarchy level"""
        level_devices = [d for d in devices if d.component_id in level_hierarchy.devices]
        
        # Analyze network connections
        for device in level_devices:
            for connection in device.network_connections:
                # Find connected device
                connected_device = next((d for d in devices if d.component_id == connection), None)
                if connected_device and connected_device.component_id in level_hierarchy.devices:
                    level_hierarchy.connections.append((device.component_id, connected_device.component_id))
        
        return level_hierarchy
    
    def _analyze_level_redundancy(self, level_hierarchy: ControlSystemHierarchy,
                                devices: List[IndustrialRecognitionResult]) -> ControlSystemHierarchy:
        """Analyze redundancy within a hierarchy level"""
        level_devices = [d for d in devices if d.component_id in level_hierarchy.devices]
        
        # Simple redundancy detection based on device count and type
        device_categories = defaultdict(int)
        for device in level_devices:
            device_categories[device.category] += 1
        
        # If we have multiple devices of the same critical type, assume redundancy
        critical_types = {
            IndustrialDeviceCategory.PLC,
            IndustrialDeviceCategory.SAFETY_PLC,
            IndustrialDeviceCategory.HMI
        }
        
        for category, count in device_categories.items():
            if category in critical_types and count > 1:
                level_hierarchy.redundancy = RedundancyType.HOT_STANDBY
                break
        
        return level_hierarchy

class NetworkTopologyAnalyzer:
    def __init__(self):
        self.protocol_analyzer = HierarchicalControlAnalyzer()
    
    def analyze_network_topology(self, devices: List[IndustrialRecognitionResult]) -> List[NetworkSegment]:
        """Analyze network topology and create network segments"""
        segments = []
        
        # Group devices by communication protocol
        protocol_groups = defaultdict(list)
        for device in devices:
            if device.specifications:
                for protocol in device.specifications.communication_protocols:
                    protocol_groups[protocol].append(device)
        
        # Create network segments for each protocol
        for protocol, protocol_devices in protocol_groups.items():
            segment = self._create_network_segment(protocol, protocol_devices)
            segments.append(segment)
        
        # Analyze inter-segment connections
        segments = self._analyze_inter_segment_connections(segments, devices)
        
        return segments
    
    def _create_network_segment(self, protocol: CommunicationProtocol, 
                              devices: List[IndustrialRecognitionResult]) -> NetworkSegment:
        """Create a network segment for a specific protocol"""
        segment_id = f"{protocol.value}_segment_{len(devices)}"
        
        # Get protocol characteristics
        protocol_chars = self.protocol_analyzer.protocol_characteristics.get(protocol, {})
        
        segment = NetworkSegment(
            segment_id=segment_id,
            protocol=protocol,
            devices=[device.component_id for device in devices],
            topology=protocol_chars.get("topology", NetworkTopology.STAR),
            bandwidth=protocol_chars.get("bandwidth"),
            max_devices=protocol_chars.get("max_devices"),
            distance_limits=(0, protocol_chars.get("distance_limit", 100))
        )
        
        # Analyze redundancy within segment
        segment.redundancy = self._analyze_segment_redundancy(devices, protocol_chars)
        
        return segment
    
    def _analyze_segment_redundancy(self, devices: List[IndustrialRecognitionResult], 
                                  protocol_chars: Dict[str, Any]) -> RedundancyType:
        """Analyze redundancy within a network segment"""
        if not protocol_chars.get("redundancy_support", False):
            return RedundancyType.NONE
        
        # Check for multiple communication paths
        network_connections = []
        for device in devices:
            network_connections.extend(device.network_connections)
        
        # Simple redundancy detection based on connection patterns
        if len(set(network_connections)) > len(devices):
            return RedundancyType.HOT_STANDBY
        
        return RedundancyType.NONE
    
    def _analyze_inter_segment_connections(self, segments: List[NetworkSegment],
                                         devices: List[IndustrialRecognitionResult]) -> List[NetworkSegment]:
        """Analyze connections between network segments"""
        # Create network graph
        G = nx.Graph()
        
        # Add devices as nodes
        for device in devices:
            G.add_node(device.component_id, category=device.category)
        
        # Add connections as edges
        for device in devices:
            for connection in device.network_connections:
                if G.has_node(connection):
                    G.add_edge(device.component_id, connection)
        
        # Analyze connectivity between segments
        for segment in segments:
            segment_devices = set(segment.devices)
            external_connections = []
            
            for device_id in segment.devices:
                if G.has_node(device_id):
                    neighbors = set(G.neighbors(device_id))
                    external_neighbors = neighbors - segment_devices
                    external_connections.extend(external_neighbors)
            
            # Store external connections for gateway/bridge identification
            segment.cable_type = "ethernet" if segment.protocol in [
                CommunicationProtocol.ETHERNET_IP,
                CommunicationProtocol.PROFINET,
                CommunicationProtocol.MODBUS_TCP
            ] else "serial"
        
        return segments

class IOSystemAnalyzer:
    def __init__(self):
        pass
    
    def analyze_io_system(self, devices: List[IndustrialRecognitionResult]) -> IOSummary:
        """Analyze I/O system and calculate capacity"""
        io_summary = IOSummary()
        
        for device in devices:
            if device.specifications:
                spec = device.specifications
                
                # Add actual I/O counts
                if spec.digital_inputs:
                    io_summary.digital_inputs += spec.digital_inputs
                    io_summary.total_capacity_di += spec.digital_inputs
                
                if spec.digital_outputs:
                    io_summary.digital_outputs += spec.digital_outputs
                    io_summary.total_capacity_do += spec.digital_outputs
                
                if spec.analog_inputs:
                    io_summary.analog_inputs += spec.analog_inputs
                    io_summary.total_capacity_ai += spec.analog_inputs
                
                if spec.analog_outputs:
                    io_summary.analog_outputs += spec.analog_outputs
                    io_summary.total_capacity_ao += spec.analog_outputs
        
        # Calculate spare capacity (assume 80% utilization for sizing)
        utilization_factor = 0.8
        
        io_summary.spare_di = max(0, int(io_summary.total_capacity_di * (1 - utilization_factor)))
        io_summary.spare_do = max(0, int(io_summary.total_capacity_do * (1 - utilization_factor)))
        io_summary.spare_ai = max(0, int(io_summary.total_capacity_ai * (1 - utilization_factor)))
        io_summary.spare_ao = max(0, int(io_summary.total_capacity_ao * (1 - utilization_factor)))
        
        return io_summary

class ControlSystemArchitectureEngine:
    def __init__(self):
        self.hierarchy_analyzer = HierarchicalControlAnalyzer()
        self.network_analyzer = NetworkTopologyAnalyzer()
        self.io_analyzer = IOSystemAnalyzer()
    
    async def analyze_control_system_architecture(self, 
                                                devices: List[IndustrialRecognitionResult],
                                                isa_symbols: List[ISASymbolRecognition],
                                                control_loops: List[ControlLoopIdentification]) -> ControlSystemArchitectureAnalysis:
        """Perform comprehensive control system architecture analysis"""
        
        # Analyze system hierarchy
        system_hierarchy = self.hierarchy_analyzer.analyze_hierarchy(devices)
        
        # Analyze network topology
        network_segments = self.network_analyzer.analyze_network_topology(devices)
        
        # Analyze I/O system
        io_summary = self.io_analyzer.analyze_io_system(devices)
        
        # Analyze safety systems
        safety_systems = self._analyze_safety_systems(devices, isa_symbols)
        
        # Calculate performance metrics
        performance_metrics = self._calculate_performance_metrics(devices, network_segments, io_summary)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(system_hierarchy, network_segments, io_summary, safety_systems)
        
        return ControlSystemArchitectureAnalysis(
            system_hierarchy=system_hierarchy,
            network_segments=network_segments,
            io_summary=io_summary,
            control_loops=control_loops,
            safety_systems=safety_systems,
            performance_metrics=performance_metrics,
            recommendations=recommendations
        )
    
    def _analyze_safety_systems(self, devices: List[IndustrialRecognitionResult],
                               isa_symbols: List[ISASymbolRecognition]) -> List[Dict[str, Any]]:
        """Analyze safety systems and SIL requirements"""
        safety_systems = []
        
        # Find safety-related devices
        safety_device_categories = {
            IndustrialDeviceCategory.SAFETY_PLC,
            IndustrialDeviceCategory.EMERGENCY_STOP,
            IndustrialDeviceCategory.SAFETY_RELAY,
            IndustrialDeviceCategory.LIGHT_CURTAIN,
            IndustrialDeviceCategory.SAFETY_SCANNER
        }
        
        safety_devices = [d for d in devices if d.category in safety_device_categories]
        
        # Group safety devices into systems
        for device in safety_devices:
            safety_system = {
                "system_id": f"safety_system_{device.component_id}",
                "primary_device": device.component_id,
                "device_category": device.category.value,
                "sil_rating": None,
                "redundancy": RedundancyType.NONE.value,
                "connected_devices": device.network_connections,
                "safety_function": self._determine_safety_function(device.category)
            }
            
            # Extract SIL rating if available
            if device.specifications and device.specifications.sil_rating:
                safety_system["sil_rating"] = device.specifications.sil_rating
            
            safety_systems.append(safety_system)
        
        # Analyze safety loops from ISA symbols
        safety_symbols = [s for s in isa_symbols if "ESS" in s.isa_code or "SIS" in s.isa_code]
        for symbol in safety_symbols:
            safety_system = {
                "system_id": f"safety_loop_{symbol.tag_number or symbol.isa_code}",
                "safety_function": "emergency_shutdown" if "ESS" in symbol.isa_code else "safety_instrumented",
                "tag_number": symbol.tag_number,
                "loop_identifier": symbol.loop_identifier,
                "confidence": symbol.confidence
            }
            safety_systems.append(safety_system)
        
        return safety_systems
    
    def _determine_safety_function(self, category: IndustrialDeviceCategory) -> str:
        """Determine safety function based on device category"""
        safety_functions = {
            IndustrialDeviceCategory.SAFETY_PLC: "safety_logic",
            IndustrialDeviceCategory.EMERGENCY_STOP: "emergency_stop",
            IndustrialDeviceCategory.SAFETY_RELAY: "safety_monitoring",
            IndustrialDeviceCategory.LIGHT_CURTAIN: "access_protection",
            IndustrialDeviceCategory.SAFETY_SCANNER: "area_monitoring"
        }
        return safety_functions.get(category, "unknown")
    
    def _calculate_performance_metrics(self, devices: List[IndustrialRecognitionResult],
                                     network_segments: List[NetworkSegment],
                                     io_summary: IOSummary) -> Dict[str, Any]:
        """Calculate system performance metrics"""
        metrics = {
            "total_devices": len(devices),
            "devices_by_level": {},
            "network_segments": len(network_segments),
            "protocols_used": [],
            "io_utilization": {},
            "redundancy_coverage": 0.0,
            "safety_device_count": 0,
            "estimated_scan_time": 0.0,
            "network_bandwidth_utilization": {}
        }
        
        # Count devices by hierarchy level
        hierarchy_analyzer = HierarchicalControlAnalyzer()
        for device in devices:
            level = hierarchy_analyzer.device_hierarchy_map.get(device.category, ControlSystemLevel.FIELD_DEVICE)
            level_name = level.value
            metrics["devices_by_level"][level_name] = metrics["devices_by_level"].get(level_name, 0) + 1
        
        # Collect protocols used
        protocols = set()
        for segment in network_segments:
            protocols.add(segment.protocol.value)
        metrics["protocols_used"] = list(protocols)
        
        # Calculate I/O utilization
        if io_summary.total_capacity_di > 0:
            metrics["io_utilization"]["digital_inputs"] = io_summary.digital_inputs / io_summary.total_capacity_di
        if io_summary.total_capacity_do > 0:
            metrics["io_utilization"]["digital_outputs"] = io_summary.digital_outputs / io_summary.total_capacity_do
        if io_summary.total_capacity_ai > 0:
            metrics["io_utilization"]["analog_inputs"] = io_summary.analog_inputs / io_summary.total_capacity_ai
        if io_summary.total_capacity_ao > 0:
            metrics["io_utilization"]["analog_outputs"] = io_summary.analog_outputs / io_summary.total_capacity_ao
        
        # Count safety devices
        safety_categories = {
            IndustrialDeviceCategory.SAFETY_PLC,
            IndustrialDeviceCategory.EMERGENCY_STOP,
            IndustrialDeviceCategory.SAFETY_RELAY
        }
        metrics["safety_device_count"] = sum(1 for d in devices if d.category in safety_categories)
        
        # Estimate scan time (simplified calculation)
        total_io_points = io_summary.digital_inputs + io_summary.digital_outputs + \
                         io_summary.analog_inputs + io_summary.analog_outputs
        metrics["estimated_scan_time"] = max(10.0, total_io_points * 0.1)  # ms
        
        # Calculate redundancy coverage
        redundant_segments = sum(1 for s in network_segments if s.redundancy != RedundancyType.NONE)
        if network_segments:
            metrics["redundancy_coverage"] = redundant_segments / len(network_segments)
        
        return metrics
    
    def _generate_recommendations(self, 
                                system_hierarchy: Dict[ControlSystemLevel, ControlSystemHierarchy],
                                network_segments: List[NetworkSegment],
                                io_summary: IOSummary,
                                safety_systems: List[Dict[str, Any]]) -> List[str]:
        """Generate system recommendations"""
        recommendations = []
        
        # Hierarchy recommendations
        control_devices = len(system_hierarchy[ControlSystemLevel.CONTROL].devices)
        if control_devices == 0:
            recommendations.append("No control devices (PLCs) detected. Consider adding primary control system.")
        elif control_devices == 1:
            recommendations.append("Single control device detected. Consider redundant controller for critical applications.")
        
        # Network recommendations
        ethernet_segments = [s for s in network_segments if s.protocol in [
            CommunicationProtocol.ETHERNET_IP, CommunicationProtocol.PROFINET, CommunicationProtocol.MODBUS_TCP
        ]]
        
        if not ethernet_segments:
            recommendations.append("No Ethernet-based networks detected. Consider upgrading to Ethernet for better performance.")
        
        # Check for network segmentation
        if len(network_segments) == 1 and len(network_segments[0].devices) > 50:
            recommendations.append("Large single network segment detected. Consider network segmentation for better performance.")
        
        # I/O recommendations
        total_io = io_summary.digital_inputs + io_summary.digital_outputs + \
                  io_summary.analog_inputs + io_summary.analog_outputs
        
        if total_io > 500:
            recommendations.append("High I/O count detected. Consider distributed I/O architecture.")
        
        # Spare capacity recommendations
        if io_summary.spare_di < io_summary.digital_inputs * 0.2:
            recommendations.append("Low spare digital input capacity. Consider additional I/O modules.")
        
        if io_summary.spare_do < io_summary.digital_outputs * 0.2:
            recommendations.append("Low spare digital output capacity. Consider additional I/O modules.")
        
        # Safety system recommendations
        if not safety_systems:
            recommendations.append("No safety systems detected. Review safety requirements and consider adding safety devices.")
        else:
            sil_rated_systems = [s for s in safety_systems if s.get("sil_rating")]
            if not sil_rated_systems:
                recommendations.append("Safety systems detected but no SIL ratings found. Verify safety integrity levels.")
        
        # Redundancy recommendations
        redundant_segments = [s for s in network_segments if s.redundancy != RedundancyType.NONE]
        if len(redundant_segments) < len(network_segments) * 0.5:
            recommendations.append("Limited network redundancy detected. Consider redundant communication paths for critical systems.")
        
        return recommendations

# Example usage and testing
async def test_control_system_architecture():
    """Test control system architecture analysis"""
    
    # Create mock industrial devices
    from industrial_control_recognition import IndustrialRecognitionResult, IndustrialDeviceCategory
    
    devices = [
        IndustrialRecognitionResult(
            component_id="plc_001",
            category=IndustrialDeviceCategory.PLC,
            confidence=0.95,
            bounding_box=(100, 100, 200, 150),
            network_connections=["hmi_001", "vfd_001"]
        ),
        IndustrialRecognitionResult(
            component_id="hmi_001",
            category=IndustrialDeviceCategory.HMI,
            confidence=0.92,
            bounding_box=(300, 100, 180, 120),
            network_connections=["plc_001"]
        ),
        IndustrialRecognitionResult(
            component_id="vfd_001",
            category=IndustrialDeviceCategory.VFD,
            confidence=0.88,
            bounding_box=(500, 200, 150, 200),
            network_connections=["plc_001"]
        )
    ]
    
    # Create architecture engine
    architecture_engine = ControlSystemArchitectureEngine()
    
    # Perform analysis
    analysis = await architecture_engine.analyze_control_system_architecture(
        devices=devices,
        isa_symbols=[],
        control_loops=[]
    )
    
    print("Control System Architecture Analysis:")
    print(f"Total devices: {analysis.performance_metrics['total_devices']}")
    print(f"Network segments: {len(analysis.network_segments)}")
    print(f"Recommendations: {len(analysis.recommendations)}")
    
    for level, hierarchy in analysis.system_hierarchy.items():
        if hierarchy.devices:
            print(f"{level.value}: {len(hierarchy.devices)} devices")
    
    for recommendation in analysis.recommendations:
        print(f"- {recommendation}")

if __name__ == "__main__":
    asyncio.run(test_control_system_architecture())