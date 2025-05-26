from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Tuple
import numpy as np
import cv2
import logging
import asyncio
import io
from PIL import Image
import json
from datetime import datetime

# Import our recognition modules
from enhanced_recognition import EnhancedComponentRecognition, ComponentCategory, RecognitionResult
from specification_intelligence import RealTimeSpecificationIntelligence, OverlayConfiguration
from industrial_control_recognition import (
    IndustrialControlRecognition, 
    IndustrialDeviceCategory, 
    IndustrialRecognitionResult,
    ISASymbolRecognition,
    ControlLoopIdentification
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Component Intelligence Service",
    description="Advanced component recognition and specification intelligence for electrical systems",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
component_recognition = None
specification_intelligence = None
industrial_recognition = None

# Pydantic models for API
class BoundingBox(BaseModel):
    x: int
    y: int
    width: int
    height: int

class ComponentRecognitionRequest(BaseModel):
    bounding_boxes: List[BoundingBox]
    enable_specification_lookup: bool = True
    enable_industrial_analysis: bool = True

class SpecificationOverlayRequest(BaseModel):
    component_id: str
    manufacturer: str
    model_number: str
    category: str
    show_specifications: bool = True
    show_compliance: bool = True
    show_pricing: bool = False
    show_availability: bool = True
    show_isa_symbol: bool = True
    show_control_loop: bool = True
    show_network_info: bool = True
    transparency: float = 0.95
    position: str = "auto"
    color_scheme: str = "default"

class IndustrialAnalysisRequest(BaseModel):
    bounding_boxes: List[BoundingBox]
    include_isa_symbols: bool = True
    include_control_loops: bool = True
    include_network_topology: bool = True

class ControlSystemArchitectureRequest(BaseModel):
    drawing_image_path: str
    analysis_scope: str = "full"  # "full", "power_only", "control_only"
    include_safety_systems: bool = True
    include_communication_networks: bool = True

# Response models
class ComponentRecognitionResponse(BaseModel):
    success: bool
    results: List[Dict[str, Any]]
    processing_time: float
    total_components: int

class SpecificationOverlayResponse(BaseModel):
    success: bool
    overlay_data: Dict[str, Any]
    specifications: Optional[Dict[str, Any]]
    validation_status: Optional[str]

class IndustrialAnalysisResponse(BaseModel):
    success: bool
    industrial_devices: List[Dict[str, Any]]
    isa_symbols: List[Dict[str, Any]]
    control_loops: List[Dict[str, Any]]
    network_topology: Dict[str, Any]
    processing_time: float

class ControlSystemArchitectureResponse(BaseModel):
    success: bool
    system_hierarchy: Dict[str, Any]
    communication_networks: List[Dict[str, Any]]
    io_summary: Dict[str, Any]
    control_loops: List[Dict[str, Any]]
    safety_systems: List[Dict[str, Any]]

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    global component_recognition, specification_intelligence, industrial_recognition
    
    logger.info("Initializing Component Intelligence Service...")
    
    try:
        # Initialize component recognition
        component_recognition = EnhancedComponentRecognition()
        logger.info("✓ Enhanced component recognition initialized")
        
        # Initialize specification intelligence
        specification_intelligence = RealTimeSpecificationIntelligence()
        await specification_intelligence.initialize()
        logger.info("✓ Real-time specification intelligence initialized")
        
        # Initialize industrial control recognition
        industrial_recognition = IndustrialControlRecognition()
        logger.info("✓ Industrial control recognition initialized")
        
        logger.info("Component Intelligence Service ready!")
        
    except Exception as e:
        logger.error(f"Failed to initialize service: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    global specification_intelligence
    
    logger.info("Shutting down Component Intelligence Service...")
    
    if specification_intelligence:
        await specification_intelligence.close()
    
    logger.info("Component Intelligence Service shutdown complete")

# Helper functions
def image_to_numpy(image_file: UploadFile) -> np.ndarray:
    """Convert uploaded image file to numpy array"""
    contents = image_file.file.read()
    image = Image.open(io.BytesIO(contents))
    
    # Convert to RGB if necessary
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Convert to numpy array
    image_array = np.array(image)
    
    # Convert RGB to BGR for OpenCV
    image_bgr = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
    
    return image_bgr

def bbox_to_tuple(bbox: BoundingBox) -> Tuple[int, int, int, int]:
    """Convert BoundingBox model to tuple"""
    return (bbox.x, bbox.y, bbox.width, bbox.height)

# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "services": {
            "component_recognition": component_recognition is not None,
            "specification_intelligence": specification_intelligence is not None,
            "industrial_recognition": industrial_recognition is not None
        }
    }

@app.post("/recognize-components", response_model=ComponentRecognitionResponse)
async def recognize_components(
    image: UploadFile = File(...),
    request_data: str = Form(...)
):
    """
    Recognize electrical components in the uploaded image
    """
    start_time = datetime.now()
    
    try:
        # Parse request data
        request = ComponentRecognitionRequest.parse_raw(request_data)
        
        # Convert image to numpy array
        image_array = image_to_numpy(image)
        
        # Convert bounding boxes to tuples
        bboxes = [bbox_to_tuple(bbox) for bbox in request.bounding_boxes]
        
        # Perform component recognition
        results = await component_recognition.batch_recognize_components(
            image_array, bboxes
        )
        
        # Convert results to serializable format
        serialized_results = []
        for result in results:
            result_dict = {
                "component_id": result.component_id,
                "category": result.category.value,
                "confidence": result.confidence,
                "confidence_level": result.confidence_level.value,
                "bounding_box": result.bounding_box,
                "recognition_timestamp": result.recognition_timestamp.isoformat(),
                "alternative_matches": result.alternative_matches,
                "visual_features": result.visual_features
            }
            
            # Add specifications if available
            if result.specifications:
                spec = result.specifications
                result_dict["specifications"] = {
                    "manufacturer": spec.manufacturer,
                    "model_number": spec.model_number,
                    "category": spec.category.value,
                    "voltage_rating": spec.voltage_rating,
                    "current_rating": spec.current_rating,
                    "power_rating": spec.power_rating,
                    "dimensions": spec.dimensions,
                    "certifications": spec.certifications,
                    "installation_notes": spec.installation_notes,
                    "datasheet_url": spec.datasheet_url,
                    "price_estimate": spec.price_estimate,
                    "availability": spec.availability
                }
            
            serialized_results.append(result_dict)
        
        # Perform industrial analysis if requested
        if request.enable_industrial_analysis:
            industrial_results = await industrial_recognition.batch_recognize_industrial_devices(
                image_array, bboxes
            )
            
            # Merge industrial results
            for i, industrial_result in enumerate(industrial_results):
                if i < len(serialized_results):
                    serialized_results[i]["industrial_analysis"] = {
                        "category": industrial_result.category.value,
                        "confidence": industrial_result.confidence,
                        "isa_symbol": {
                            "symbol_type": industrial_result.isa_symbol.symbol_type,
                            "isa_code": industrial_result.isa_symbol.isa_code,
                            "description": industrial_result.isa_symbol.description,
                            "tag_number": industrial_result.isa_symbol.tag_number,
                            "loop_identifier": industrial_result.isa_symbol.loop_identifier
                        } if industrial_result.isa_symbol else None,
                        "control_loop": {
                            "loop_id": industrial_result.control_loop.loop_id,
                            "loop_type": industrial_result.control_loop.loop_type,
                            "components": industrial_result.control_loop.components,
                            "control_strategy": industrial_result.control_loop.control_strategy
                        } if industrial_result.control_loop else None,
                        "network_connections": industrial_result.network_connections
                    }
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        return ComponentRecognitionResponse(
            success=True,
            results=serialized_results,
            processing_time=processing_time,
            total_components=len(serialized_results)
        )
        
    except Exception as e:
        logger.error(f"Error in component recognition: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/specification-overlay", response_model=SpecificationOverlayResponse)
async def get_specification_overlay(request: SpecificationOverlayRequest):
    """
    Get real-time specification overlay data for a component
    """
    try:
        # Get real-time specification
        spec = await specification_intelligence.get_real_time_specification(
            manufacturer=request.manufacturer,
            model_number=request.model_number,
            component_id=request.component_id,
            category=request.category
        )
        
        # Create overlay configuration
        config = OverlayConfiguration(
            show_specifications=request.show_specifications,
            show_compliance=request.show_compliance,
            show_pricing=request.show_pricing,
            show_availability=request.show_availability,
            transparency=request.transparency,
            position=request.position,
            color_scheme=request.color_scheme
        )
        
        # Generate overlay data
        overlay_data = specification_intelligence.create_specification_overlay(spec, config)
        
        # Add industrial-specific overlay data if applicable
        if request.show_isa_symbol or request.show_control_loop or request.show_network_info:
            # This would be enhanced to include ISA symbol and control loop data
            overlay_data["industrial_data"] = {
                "show_isa_symbol": request.show_isa_symbol,
                "show_control_loop": request.show_control_loop,
                "show_network_info": request.show_network_info
            }
        
        return SpecificationOverlayResponse(
            success=True,
            overlay_data=overlay_data,
            specifications={
                "manufacturer": spec.manufacturer,
                "model_number": spec.model_number,
                "category": spec.category,
                "source": spec.source.value,
                "last_updated": spec.last_updated.isoformat()
            },
            validation_status=spec.validation.status.value if spec.validation else None
        )
        
    except Exception as e:
        logger.error(f"Error generating specification overlay: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/industrial-analysis", response_model=IndustrialAnalysisResponse)
async def analyze_industrial_systems(
    image: UploadFile = File(...),
    request_data: str = Form(...)
):
    """
    Perform comprehensive industrial control system analysis
    """
    start_time = datetime.now()
    
    try:
        # Parse request data
        request = IndustrialAnalysisRequest.parse_raw(request_data)
        
        # Convert image to numpy array
        image_array = image_to_numpy(image)
        
        # Convert bounding boxes to tuples
        bboxes = [bbox_to_tuple(bbox) for bbox in request.bounding_boxes]
        
        # Perform industrial device recognition
        industrial_results = await industrial_recognition.batch_recognize_industrial_devices(
            image_array, bboxes
        )
        
        # Extract ISA symbols if requested
        isa_symbols = []
        if request.include_isa_symbols:
            symbol_results = industrial_recognition.symbol_recognizer.recognize_isa_symbols(image_array)
            isa_symbols = [
                {
                    "symbol_type": symbol.symbol_type,
                    "isa_code": symbol.isa_code,
                    "description": symbol.description,
                    "confidence": symbol.confidence,
                    "bounding_box": symbol.bounding_box,
                    "tag_number": symbol.tag_number,
                    "loop_identifier": symbol.loop_identifier
                }
                for symbol in symbol_results
            ]
        
        # Extract control loops
        control_loops = []
        if request.include_control_loops:
            for result in industrial_results:
                if result.control_loop:
                    control_loops.append({
                        "loop_id": result.control_loop.loop_id,
                        "loop_type": result.control_loop.loop_type,
                        "components": result.control_loop.components,
                        "control_strategy": result.control_loop.control_strategy,
                        "setpoint": result.control_loop.setpoint,
                        "process_variable": result.control_loop.process_variable,
                        "controlled_variable": result.control_loop.controlled_variable
                    })
        
        # Analyze network topology
        network_topology = {}
        if request.include_network_topology:
            # Analyze communication networks
            protocols = set()
            devices_by_protocol = {}
            
            for result in industrial_results:
                if result.specifications:
                    for protocol in result.specifications.communication_protocols:
                        protocol_name = protocol.value
                        protocols.add(protocol_name)
                        
                        if protocol_name not in devices_by_protocol:
                            devices_by_protocol[protocol_name] = []
                        
                        devices_by_protocol[protocol_name].append({
                            "component_id": result.component_id,
                            "category": result.category.value,
                            "network_connections": result.network_connections
                        })
            
            network_topology = {
                "protocols": list(protocols),
                "devices_by_protocol": devices_by_protocol,
                "total_networked_devices": sum(len(devices) for devices in devices_by_protocol.values())
            }
        
        # Serialize industrial device results
        serialized_devices = []
        for result in industrial_results:
            device_dict = {
                "component_id": result.component_id,
                "category": result.category.value,
                "confidence": result.confidence,
                "bounding_box": result.bounding_box,
                "recognition_timestamp": result.recognition_timestamp.isoformat(),
                "alternative_matches": result.alternative_matches,
                "network_connections": result.network_connections
            }
            
            # Add specifications if available
            if result.specifications:
                spec = result.specifications
                device_dict["specifications"] = {
                    "manufacturer": spec.manufacturer,
                    "model_number": spec.model_number,
                    "series": spec.series,
                    "category": spec.category.value,
                    "voltage_rating": spec.voltage_rating,
                    "current_rating": spec.current_rating,
                    "power_consumption": spec.power_consumption,
                    "digital_inputs": spec.digital_inputs,
                    "digital_outputs": spec.digital_outputs,
                    "analog_inputs": spec.analog_inputs,
                    "analog_outputs": spec.analog_outputs,
                    "communication_protocols": [p.value for p in spec.communication_protocols],
                    "network_ports": spec.network_ports,
                    "serial_ports": spec.serial_ports,
                    "mounting_type": spec.mounting_type,
                    "operating_temperature": spec.operating_temperature,
                    "ip_rating": spec.ip_rating,
                    "measurement_range": spec.measurement_range,
                    "accuracy": spec.accuracy,
                    "units": spec.units,
                    "motor_hp_range": spec.motor_hp_range,
                    "speed_range": spec.speed_range,
                    "certifications": spec.certifications,
                    "hazardous_area_rating": spec.hazardous_area_rating,
                    "sil_rating": spec.sil_rating,
                    "datasheet_url": spec.datasheet_url,
                    "manual_url": spec.manual_url,
                    "price_estimate": spec.price_estimate,
                    "availability": spec.availability
                }
            
            serialized_devices.append(device_dict)
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        return IndustrialAnalysisResponse(
            success=True,
            industrial_devices=serialized_devices,
            isa_symbols=isa_symbols,
            control_loops=control_loops,
            network_topology=network_topology,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Error in industrial analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/control-system-architecture", response_model=ControlSystemArchitectureResponse)
async def analyze_control_system_architecture(
    image: UploadFile = File(...),
    request_data: str = Form(...)
):
    """
    Analyze complete control system architecture from drawings
    """
    try:
        # Parse request data
        request = ControlSystemArchitectureRequest.parse_raw(request_data)
        
        # Convert image to numpy array
        image_array = image_to_numpy(image)
        
        # This would implement comprehensive control system architecture analysis
        # For now, return a structured response with mock data
        
        system_hierarchy = {
            "supervision_level": {
                "hmi_systems": [],
                "scada_systems": [],
                "historian_systems": []
            },
            "control_level": {
                "plc_systems": [],
                "dcs_systems": [],
                "safety_systems": []
            },
            "field_level": {
                "sensors": [],
                "actuators": [],
                "field_devices": []
            }
        }
        
        communication_networks = [
            {
                "network_type": "ethernet_ip",
                "devices": [],
                "topology": "star",
                "redundancy": "single"
            }
        ]
        
        io_summary = {
            "total_digital_inputs": 0,
            "total_digital_outputs": 0,
            "total_analog_inputs": 0,
            "total_analog_outputs": 0,
            "spare_capacity": {
                "digital_inputs": 0,
                "digital_outputs": 0,
                "analog_inputs": 0,
                "analog_outputs": 0
            }
        }
        
        control_loops = []
        safety_systems = []
        
        return ControlSystemArchitectureResponse(
            success=True,
            system_hierarchy=system_hierarchy,
            communication_networks=communication_networks,
            io_summary=io_summary,
            control_loops=control_loops,
            safety_systems=safety_systems
        )
        
    except Exception as e:
        logger.error(f"Error in control system architecture analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/statistics")
async def get_service_statistics():
    """
    Get service statistics and performance metrics
    """
    try:
        stats = {
            "component_recognition": component_recognition.get_recognition_statistics() if component_recognition else {},
            "industrial_recognition": industrial_recognition.get_device_statistics() if industrial_recognition else {},
            "specification_intelligence": {
                "cache_enabled": True,
                "manufacturer_apis": ["square_d", "siemens", "eaton", "leviton", "cooper"]
            }
        }
        
        return {
            "success": True,
            "statistics": stats,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Run the service
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)