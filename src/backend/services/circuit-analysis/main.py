"""
Circuit Analysis Service

AI-powered circuit detection and analysis engine for electrical drawings.
Identifies electrical paths, connections, and circuit topology.
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Tuple, Set
import cv2
import numpy as np
import asyncio
import logging
from datetime import datetime
import uuid
import networkx as nx
from sklearn.cluster import DBSCAN
from scipy.spatial.distance import euclidean
import json
import base64
from PIL import Image
import io

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Circuit Analysis API",
    description="AI-powered circuit detection and analysis for electrical drawings",
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

# Data models
class Point(BaseModel):
    x: float = Field(..., description="X coordinate (normalized 0-1)")
    y: float = Field(..., description="Y coordinate (normalized 0-1)")

class CircuitElement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str = Field(..., description="Element type (wire, junction, component, terminal)")
    points: List[Point] = Field(..., description="Points defining the element")
    connections: List[str] = Field(default_factory=list, description="Connected element IDs")
    properties: Dict[str, Any] = Field(default_factory=dict, description="Element properties")
    confidence: float = Field(..., description="Detection confidence (0-1)")

class CircuitPath(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    elements: List[str] = Field(..., description="Sequence of element IDs in path")
    start_point: Point = Field(..., description="Path start point")
    end_point: Point = Field(..., description="Path end point")
    circuit_type: str = Field(..., description="Circuit type (power, control, data, etc.)")
    voltage_level: Optional[float] = Field(None, description="Circuit voltage level")
    properties: Dict[str, Any] = Field(default_factory=dict, description="Path properties")

class CircuitNetwork(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    elements: List[CircuitElement] = Field(..., description="All circuit elements")
    paths: List[CircuitPath] = Field(..., description="Identified circuit paths")
    junctions: List[Point] = Field(..., description="Junction points")
    topology: Dict[str, Any] = Field(default_factory=dict, description="Network topology")
    analysis_time: float = Field(..., description="Analysis processing time")

class CircuitAnalysisRequest(BaseModel):
    image_data: str = Field(..., description="Base64 encoded image")
    analysis_options: Dict[str, Any] = Field(default_factory=dict, description="Analysis configuration")
    page_context: Optional[Dict[str, Any]] = Field(None, description="Multi-page context information")

class CircuitAnalysisResponse(BaseModel):
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    circuit_network: CircuitNetwork
    metadata: Dict[str, Any] = Field(default_factory=dict)

class CircuitDetector:
    """Advanced circuit detection using computer vision and machine learning"""
    
    def __init__(self):
        self.line_detector = cv2.createLineSegmentDetector()
        self.contour_detector = cv2.SimpleBlobDetector_create()
        self.junction_threshold = 10  # pixels
        self.min_line_length = 20
        self.max_line_gap = 5
        
    def detect_circuit_elements(self, image: np.ndarray) -> List[CircuitElement]:
        """Detect circuit elements including wires, junctions, and terminals"""
        elements = []
        
        # Preprocess image
        processed = self._preprocess_image(image)
        
        # Detect lines (wires)
        wire_elements = self._detect_wires(processed)
        elements.extend(wire_elements)
        
        # Detect junctions
        junction_elements = self._detect_junctions(processed, wire_elements)
        elements.extend(junction_elements)
        
        # Detect terminals and connection points
        terminal_elements = self._detect_terminals(processed)
        elements.extend(terminal_elements)
        
        return elements
    
    def _preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for circuit detection"""
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image
        
        # Enhance contrast
        enhanced = cv2.equalizeHist(gray)
        
        # Noise reduction
        denoised = cv2.fastNlMeansDenoising(enhanced)
        
        # Edge detection optimized for electrical drawings
        edges = cv2.Canny(denoised, 50, 150, apertureSize=3)
        
        return edges
    
    def _detect_wires(self, processed_image: np.ndarray) -> List[CircuitElement]:
        """Detect wire segments in the drawing"""
        wire_elements = []
        
        # Use HoughLinesP for line detection
        lines = cv2.HoughLinesP(
            processed_image,
            rho=1,
            theta=np.pi/180,
            threshold=50,
            minLineLength=self.min_line_length,
            maxLineGap=self.max_line_gap
        )
        
        if lines is not None:
            height, width = processed_image.shape
            
            for i, line in enumerate(lines):
                x1, y1, x2, y2 = line[0]
                
                # Normalize coordinates
                start_point = Point(x=x1/width, y=y1/height)
                end_point = Point(x=x2/width, y=y2/height)
                
                # Calculate line properties
                length = np.sqrt((x2-x1)**2 + (y2-y1)**2)
                angle = np.arctan2(y2-y1, x2-x1) * 180 / np.pi
                
                wire_element = CircuitElement(
                    type="wire",
                    points=[start_point, end_point],
                    properties={
                        "length": length,
                        "angle": angle,
                        "line_type": self._classify_line_type(angle)
                    },
                    confidence=0.8  # Basic confidence score
                )
                
                wire_elements.append(wire_element)
        
        return wire_elements
    
    def _detect_junctions(self, processed_image: np.ndarray, wire_elements: List[CircuitElement]) -> List[CircuitElement]:
        """Detect junction points where multiple wires connect"""
        junction_elements = []
        
        # Extract all wire endpoints
        endpoints = []
        for wire in wire_elements:
            if wire.type == "wire" and len(wire.points) >= 2:
                endpoints.extend(wire.points)
        
        if not endpoints:
            return junction_elements
        
        # Convert to pixel coordinates for clustering
        height, width = processed_image.shape
        pixel_points = np.array([[p.x * width, p.y * height] for p in endpoints])
        
        # Use DBSCAN clustering to find junction points
        clustering = DBSCAN(eps=self.junction_threshold, min_samples=3).fit(pixel_points)
        
        for cluster_id in set(clustering.labels_):
            if cluster_id == -1:  # Noise
                continue
                
            cluster_points = pixel_points[clustering.labels_ == cluster_id]
            
            # Calculate cluster center
            center_x = np.mean(cluster_points[:, 0]) / width
            center_y = np.mean(cluster_points[:, 1]) / height
            
            junction_element = CircuitElement(
                type="junction",
                points=[Point(x=center_x, y=center_y)],
                properties={
                    "connection_count": len(cluster_points),
                    "cluster_size": np.std(cluster_points, axis=0).tolist()
                },
                confidence=0.9
            )
            
            junction_elements.append(junction_element)
        
        return junction_elements
    
    def _detect_terminals(self, processed_image: np.ndarray) -> List[CircuitElement]:
        """Detect terminal points and connection symbols"""
        terminal_elements = []
        
        # Detect circular terminals using HoughCircles
        circles = cv2.HoughCircles(
            processed_image,
            cv2.HOUGH_GRADIENT,
            dp=1,
            minDist=20,
            param1=50,
            param2=30,
            minRadius=3,
            maxRadius=15
        )
        
        if circles is not None:
            height, width = processed_image.shape
            circles = np.round(circles[0, :]).astype("int")
            
            for (x, y, r) in circles:
                # Normalize coordinates
                norm_x = x / width
                norm_y = y / height
                
                terminal_element = CircuitElement(
                    type="terminal",
                    points=[Point(x=norm_x, y=norm_y)],
                    properties={
                        "radius": r,
                        "terminal_type": "circular"
                    },
                    confidence=0.7
                )
                
                terminal_elements.append(terminal_element)
        
        return terminal_elements
    
    def _classify_line_type(self, angle: float) -> str:
        """Classify line type based on angle"""
        # Normalize angle to 0-180 range
        normalized_angle = abs(angle) % 180
        
        if normalized_angle < 15 or normalized_angle > 165:
            return "horizontal"
        elif 75 < normalized_angle < 105:
            return "vertical"
        else:
            return "diagonal"

class CircuitAnalyzer:
    """Analyzes circuit topology and creates network graph"""
    
    def __init__(self):
        self.connection_threshold = 0.02  # Normalized distance threshold for connections
        
    def analyze_circuit_network(self, elements: List[CircuitElement]) -> CircuitNetwork:
        """Analyze circuit elements and create network topology"""
        start_time = datetime.now()
        
        # Build connection graph
        self._build_connections(elements)
        
        # Create network graph
        graph = self._create_network_graph(elements)
        
        # Identify circuit paths
        paths = self._identify_circuit_paths(graph, elements)
        
        # Extract junctions
        junctions = [
            element.points[0] for element in elements 
            if element.type == "junction"
        ]
        
        # Calculate topology metrics
        topology = self._calculate_topology_metrics(graph, elements)
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        return CircuitNetwork(
            elements=elements,
            paths=paths,
            junctions=junctions,
            topology=topology,
            analysis_time=processing_time
        )
    
    def _build_connections(self, elements: List[CircuitElement]) -> None:
        """Build connections between circuit elements"""
        for i, element1 in enumerate(elements):
            for j, element2 in enumerate(elements[i+1:], i+1):
                if self._are_connected(element1, element2):
                    element1.connections.append(element2.id)
                    element2.connections.append(element1.id)
    
    def _are_connected(self, element1: CircuitElement, element2: CircuitElement) -> bool:
        """Determine if two elements are connected"""
        # Check all point combinations for proximity
        for p1 in element1.points:
            for p2 in element2.points:
                distance = np.sqrt((p1.x - p2.x)**2 + (p1.y - p2.y)**2)
                if distance < self.connection_threshold:
                    return True
        return False
    
    def _create_network_graph(self, elements: List[CircuitElement]) -> nx.Graph:
        """Create NetworkX graph from circuit elements"""
        graph = nx.Graph()
        
        # Add nodes
        for element in elements:
            graph.add_node(element.id, element=element)
        
        # Add edges
        for element in elements:
            for connection_id in element.connections:
                graph.add_edge(element.id, connection_id)
        
        return graph
    
    def _identify_circuit_paths(self, graph: nx.Graph, elements: List[CircuitElement]) -> List[CircuitPath]:
        """Identify continuous circuit paths"""
        paths = []
        element_dict = {e.id: e for e in elements}
        
        # Find terminal nodes (start/end points)
        terminal_nodes = [
            node for node, degree in graph.degree() 
            if degree == 1 or element_dict[node].type == "terminal"
        ]
        
        # Find paths between terminals
        for i, start_node in enumerate(terminal_nodes):
            for end_node in terminal_nodes[i+1:]:
                try:
                    path_nodes = nx.shortest_path(graph, start_node, end_node)
                    if len(path_nodes) > 1:
                        path = self._create_circuit_path(path_nodes, element_dict)
                        paths.append(path)
                except nx.NetworkXNoPath:
                    continue
        
        return paths
    
    def _create_circuit_path(self, path_nodes: List[str], element_dict: Dict[str, CircuitElement]) -> CircuitPath:
        """Create CircuitPath from sequence of nodes"""
        start_element = element_dict[path_nodes[0]]
        end_element = element_dict[path_nodes[-1]]
        
        # Determine circuit type based on elements in path
        circuit_type = self._determine_circuit_type(path_nodes, element_dict)
        
        return CircuitPath(
            elements=path_nodes,
            start_point=start_element.points[0],
            end_point=end_element.points[-1] if end_element.points else end_element.points[0],
            circuit_type=circuit_type,
            properties={
                "length": len(path_nodes),
                "complexity": self._calculate_path_complexity(path_nodes, element_dict)
            }
        )
    
    def _determine_circuit_type(self, path_nodes: List[str], element_dict: Dict[str, CircuitElement]) -> str:
        """Determine circuit type from path elements"""
        # Simple heuristic - can be enhanced with ML
        wire_types = [element_dict[node].properties.get("line_type", "unknown") for node in path_nodes]
        
        if "horizontal" in wire_types and "vertical" in wire_types:
            return "power"
        elif all(t == "horizontal" for t in wire_types):
            return "control"
        else:
            return "unknown"
    
    def _calculate_path_complexity(self, path_nodes: List[str], element_dict: Dict[str, CircuitElement]) -> float:
        """Calculate complexity score for circuit path"""
        # Factor in number of elements, junctions, and direction changes
        junction_count = sum(1 for node in path_nodes if element_dict[node].type == "junction")
        direction_changes = self._count_direction_changes(path_nodes, element_dict)
        
        return (len(path_nodes) * 0.1) + (junction_count * 0.5) + (direction_changes * 0.3)
    
    def _count_direction_changes(self, path_nodes: List[str], element_dict: Dict[str, CircuitElement]) -> int:
        """Count direction changes in path"""
        changes = 0
        prev_angle = None
        
        for node in path_nodes:
            element = element_dict[node]
            if element.type == "wire":
                angle = element.properties.get("angle", 0)
                if prev_angle is not None and abs(angle - prev_angle) > 30:
                    changes += 1
                prev_angle = angle
        
        return changes
    
    def _calculate_topology_metrics(self, graph: nx.Graph, elements: List[CircuitElement]) -> Dict[str, Any]:
        """Calculate network topology metrics"""
        return {
            "node_count": graph.number_of_nodes(),
            "edge_count": graph.number_of_edges(),
            "density": nx.density(graph),
            "connected_components": nx.number_connected_components(graph),
            "average_clustering": nx.average_clustering(graph),
            "diameter": nx.diameter(graph) if nx.is_connected(graph) else None,
            "element_type_distribution": self._get_element_distribution(elements)
        }
    
    def _get_element_distribution(self, elements: List[CircuitElement]) -> Dict[str, int]:
        """Get distribution of element types"""
        distribution = {}
        for element in elements:
            distribution[element.type] = distribution.get(element.type, 0) + 1
        return distribution

# Initialize components
circuit_detector = CircuitDetector()
circuit_analyzer = CircuitAnalyzer()

@app.on_event("startup")
async def startup_event():
    """Initialize the service on startup"""
    logger.info("Circuit Analysis service started")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "circuit-analysis"}

@app.post("/analyze", response_model=CircuitAnalysisResponse)
async def analyze_circuit(request: CircuitAnalysisRequest):
    """Analyze electrical circuits in drawing image"""
    try:
        # Decode base64 image
        image_data = base64.b64decode(request.image_data)
        image = Image.open(io.BytesIO(image_data))
        image_np = np.array(image)
        
        # Convert PIL to OpenCV format
        if len(image_np.shape) == 3:
            image_cv = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
        else:
            image_cv = image_np
        
        # Detect circuit elements
        elements = circuit_detector.detect_circuit_elements(image_cv)
        
        # Analyze circuit network
        circuit_network = circuit_analyzer.analyze_circuit_network(elements)
        
        return CircuitAnalysisResponse(
            circuit_network=circuit_network,
            metadata={
                "image_size": f"{image.width}x{image.height}",
                "analysis_options": request.analysis_options,
                "elements_detected": len(elements),
                "paths_identified": len(circuit_network.paths)
            }
        )
        
    except Exception as e:
        logger.error(f"Error in circuit analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/trace-path")
async def trace_circuit_path(
    request_id: str,
    start_point: Point,
    end_point: Optional[Point] = None,
    circuit_network_id: Optional[str] = None
):
    """Trace specific circuit path between points"""
    try:
        # This would integrate with stored circuit networks
        # For now, return a placeholder response
        
        return {
            "path_id": str(uuid.uuid4()),
            "start_point": start_point,
            "end_point": end_point,
            "elements": [],  # Would contain actual path elements
            "properties": {
                "voltage": None,
                "current_capacity": None,
                "circuit_type": "unknown"
            }
        }
        
    except Exception as e:
        logger.error(f"Error in path tracing: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/network/{network_id}")
async def get_circuit_network(network_id: str):
    """Get stored circuit network by ID"""
    # This would retrieve from database
    raise HTTPException(status_code=404, detail="Network not found")

@app.get("/stats")
async def get_analysis_stats():
    """Get circuit analysis statistics"""
    return {
        "service_status": "operational",
        "detection_algorithms": {
            "wire_detection": "HoughLinesP",
            "junction_detection": "DBSCAN clustering",
            "terminal_detection": "HoughCircles"
        },
        "analysis_capabilities": {
            "circuit_types": ["power", "control", "data", "unknown"],
            "topology_metrics": ["density", "clustering", "connectivity"],
            "path_analysis": True
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)