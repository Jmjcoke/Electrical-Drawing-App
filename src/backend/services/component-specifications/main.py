"""
Component Specifications Service

Provides comprehensive electrical component specifications database and API.
Supports manufacturers, part numbers, technical specifications, and compatibility data.
"""

from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
import asyncio
import logging
from datetime import datetime
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Component Specifications API",
    description="Electrical component specifications database and lookup service",
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

# Enums for component categorization
class ComponentCategory(str, Enum):
    BREAKER = "breaker"
    SWITCH = "switch"
    OUTLET = "outlet"
    LIGHT_FIXTURE = "light_fixture"
    MOTOR = "motor"
    TRANSFORMER = "transformer"
    PANEL = "panel"
    CONDUIT = "conduit"
    WIRE = "wire"
    JUNCTION_BOX = "junction_box"
    DISCONNECT = "disconnect"
    RELAY = "relay"
    CONTACTOR = "contactor"
    FUSE = "fuse"
    METER = "meter"
    SENSOR = "sensor"
    OTHER = "other"

class VoltageType(str, Enum):
    AC = "AC"
    DC = "DC"
    BOTH = "BOTH"

class MountingType(str, Enum):
    SURFACE = "surface"
    FLUSH = "flush"
    POLE = "pole"
    RACK = "rack"
    DIN_RAIL = "din_rail"
    PANEL = "panel"

# Pydantic models
class Dimensions(BaseModel):
    length: Optional[float] = Field(None, description="Length in inches")
    width: Optional[float] = Field(None, description="Width in inches")
    height: Optional[float] = Field(None, description="Height in inches")
    depth: Optional[float] = Field(None, description="Depth in inches")
    weight: Optional[float] = Field(None, description="Weight in pounds")

class ElectricalRatings(BaseModel):
    voltage_rating: Optional[float] = Field(None, description="Maximum voltage rating")
    current_rating: Optional[float] = Field(None, description="Current rating in amps")
    power_rating: Optional[float] = Field(None, description="Power rating in watts")
    voltage_type: Optional[VoltageType] = Field(None, description="AC/DC voltage type")
    frequency: Optional[float] = Field(None, description="Frequency in Hz")
    phases: Optional[int] = Field(None, description="Number of phases")
    short_circuit_rating: Optional[float] = Field(None, description="Short circuit rating")

class Compliance(BaseModel):
    ul_listed: bool = Field(False, description="UL Listed certification")
    nec_compliant: bool = Field(False, description="NEC compliant")
    nema_rating: Optional[str] = Field(None, description="NEMA rating (e.g., 3R, 4X)")
    ip_rating: Optional[str] = Field(None, description="IP rating (e.g., IP65)")
    ieee_standards: List[str] = Field(default_factory=list, description="IEEE standards compliance")
    iec_standards: List[str] = Field(default_factory=list, description="IEC standards compliance")

class Manufacturer(BaseModel):
    name: str = Field(..., description="Manufacturer name")
    brand: Optional[str] = Field(None, description="Brand name if different")
    website: Optional[str] = Field(None, description="Manufacturer website")
    support_phone: Optional[str] = Field(None, description="Support phone number")
    support_email: Optional[str] = Field(None, description="Support email")

class ComponentSpecification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique component ID")
    part_number: str = Field(..., description="Manufacturer part number")
    model_number: Optional[str] = Field(None, description="Model number if different from part number")
    category: ComponentCategory = Field(..., description="Component category")
    name: str = Field(..., description="Component name/description")
    manufacturer: Manufacturer = Field(..., description="Manufacturer information")
    
    # Technical specifications
    electrical_ratings: ElectricalRatings = Field(default_factory=ElectricalRatings)
    dimensions: Dimensions = Field(default_factory=Dimensions)
    mounting_type: Optional[MountingType] = Field(None, description="Mounting type")
    operating_temperature: Optional[Dict[str, float]] = Field(None, description="Operating temp range")
    compliance: Compliance = Field(default_factory=Compliance)
    
    # Additional specifications
    features: List[str] = Field(default_factory=list, description="Key features")
    applications: List[str] = Field(default_factory=list, description="Typical applications")
    compatible_parts: List[str] = Field(default_factory=list, description="Compatible part numbers")
    replacement_parts: List[str] = Field(default_factory=list, description="Replacement options")
    
    # Documentation
    datasheet_url: Optional[str] = Field(None, description="Datasheet PDF URL")
    installation_guide_url: Optional[str] = Field(None, description="Installation guide URL")
    manual_url: Optional[str] = Field(None, description="User manual URL")
    cad_files: List[str] = Field(default_factory=list, description="CAD file URLs")
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    verified: bool = Field(False, description="Specification verified by expert")
    confidence_score: float = Field(1.0, description="Specification confidence (0-1)")

class ComponentSearchRequest(BaseModel):
    query: Optional[str] = Field(None, description="Text search query")
    category: Optional[ComponentCategory] = Field(None, description="Filter by category")
    manufacturer: Optional[str] = Field(None, description="Filter by manufacturer")
    voltage_min: Optional[float] = Field(None, description="Minimum voltage rating")
    voltage_max: Optional[float] = Field(None, description="Maximum voltage rating")
    current_min: Optional[float] = Field(None, description="Minimum current rating")
    current_max: Optional[float] = Field(None, description="Maximum current rating")
    nema_rating: Optional[str] = Field(None, description="NEMA rating filter")
    ul_listed_only: bool = Field(False, description="Only UL listed components")

class ComponentSearchResponse(BaseModel):
    components: List[ComponentSpecification]
    total_count: int
    page: int
    page_size: int
    has_next: bool

# In-memory database (in production, this would be a proper database)
components_db: Dict[str, ComponentSpecification] = {}

# Sample data initialization
def initialize_sample_data():
    """Initialize the database with sample electrical component specifications"""
    sample_components = [
        ComponentSpecification(
            part_number="QO120",
            category=ComponentCategory.BREAKER,
            name="Square D QO 20A Single Pole Circuit Breaker",
            manufacturer=Manufacturer(
                name="Schneider Electric",
                brand="Square D",
                website="https://www.se.com",
                support_phone="1-888-778-2733"
            ),
            electrical_ratings=ElectricalRatings(
                voltage_rating=120.0,
                current_rating=20.0,
                voltage_type=VoltageType.AC,
                frequency=60.0,
                phases=1,
                short_circuit_rating=10000.0
            ),
            dimensions=Dimensions(
                length=1.0,
                width=0.75,
                height=2.875,
                weight=0.25
            ),
            mounting_type=MountingType.PANEL,
            operating_temperature={"min": -40.0, "max": 60.0},
            compliance=Compliance(
                ul_listed=True,
                nec_compliant=True,
                nema_rating="1",
                ieee_standards=["C37.13"]
            ),
            features=["Thermal-magnetic trip", "QO load center compatible", "Plug-on design"],
            applications=["Residential panels", "Commercial lighting", "Small motor protection"],
            datasheet_url="https://www.se.com/ww/en/download/document/QO120_datasheet",
            verified=True,
            confidence_score=1.0
        ),
        ComponentSpecification(
            part_number="5261-W",
            category=ComponentCategory.OUTLET,
            name="Leviton 15A GFCI Duplex Receptacle",
            manufacturer=Manufacturer(
                name="Leviton Manufacturing",
                brand="Leviton",
                website="https://www.leviton.com",
                support_phone="1-800-323-8920"
            ),
            electrical_ratings=ElectricalRatings(
                voltage_rating=125.0,
                current_rating=15.0,
                voltage_type=VoltageType.AC,
                frequency=60.0,
                phases=1
            ),
            dimensions=Dimensions(
                length=4.2,
                width=1.69,
                height=1.4,
                weight=0.5
            ),
            mounting_type=MountingType.FLUSH,
            compliance=Compliance(
                ul_listed=True,
                nec_compliant=True,
                nema_rating="5-15R"
            ),
            features=["GFCI protection", "LED indicator", "Weather resistant", "Tamper resistant"],
            applications=["Bathrooms", "Kitchens", "Outdoor locations", "Wet locations"],
            verified=True,
            confidence_score=1.0
        ),
        ComponentSpecification(
            part_number="NEMA4X101006",
            category=ComponentCategory.JUNCTION_BOX,
            name="Hoffman A-1008CH Junction Box",
            manufacturer=Manufacturer(
                name="Hoffman Enclosures",
                brand="Hoffman",
                website="https://www.hoffmanonline.com"
            ),
            dimensions=Dimensions(
                length=10.0,
                width=10.0,
                height=6.0,
                weight=8.5
            ),
            mounting_type=MountingType.SURFACE,
            compliance=Compliance(
                ul_listed=True,
                nema_rating="4X",
                ip_rating="IP66"
            ),
            features=["Stainless steel", "Corrosion resistant", "Hinged cover", "Continuous hinge"],
            applications=["Outdoor installations", "Corrosive environments", "Food processing"],
            verified=True,
            confidence_score=1.0
        )
    ]
    
    for component in sample_components:
        components_db[component.id] = component
    
    logger.info(f"Initialized database with {len(sample_components)} sample components")

@app.on_event("startup")
async def startup_event():
    """Initialize the service on startup"""
    initialize_sample_data()
    logger.info("Component Specifications service started")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "component-specifications"}

@app.get("/components/{component_id}", response_model=ComponentSpecification)
async def get_component(component_id: str):
    """Get a specific component by ID"""
    if component_id not in components_db:
        raise HTTPException(status_code=404, detail="Component not found")
    return components_db[component_id]

@app.get("/components/part-number/{part_number}", response_model=ComponentSpecification)
async def get_component_by_part_number(part_number: str):
    """Get a component by part number"""
    for component in components_db.values():
        if component.part_number.upper() == part_number.upper():
            return component
    raise HTTPException(status_code=404, detail="Component not found")

@app.post("/components/search", response_model=ComponentSearchResponse)
async def search_components(
    search_request: ComponentSearchRequest,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page")
):
    """Search components with filters"""
    filtered_components = list(components_db.values())
    
    # Apply filters
    if search_request.query:
        query_lower = search_request.query.lower()
        filtered_components = [
            c for c in filtered_components
            if (query_lower in c.name.lower() or 
                query_lower in c.part_number.lower() or
                query_lower in c.manufacturer.name.lower() or
                any(query_lower in feature.lower() for feature in c.features))
        ]
    
    if search_request.category:
        filtered_components = [c for c in filtered_components if c.category == search_request.category]
    
    if search_request.manufacturer:
        manufacturer_lower = search_request.manufacturer.lower()
        filtered_components = [
            c for c in filtered_components
            if manufacturer_lower in c.manufacturer.name.lower()
        ]
    
    if search_request.voltage_min:
        filtered_components = [
            c for c in filtered_components
            if c.electrical_ratings.voltage_rating and c.electrical_ratings.voltage_rating >= search_request.voltage_min
        ]
    
    if search_request.voltage_max:
        filtered_components = [
            c for c in filtered_components
            if c.electrical_ratings.voltage_rating and c.electrical_ratings.voltage_rating <= search_request.voltage_max
        ]
    
    if search_request.current_min:
        filtered_components = [
            c for c in filtered_components
            if c.electrical_ratings.current_rating and c.electrical_ratings.current_rating >= search_request.current_min
        ]
    
    if search_request.current_max:
        filtered_components = [
            c for c in filtered_components
            if c.electrical_ratings.current_rating and c.electrical_ratings.current_rating <= search_request.current_max
        ]
    
    if search_request.nema_rating:
        filtered_components = [
            c for c in filtered_components
            if c.compliance.nema_rating == search_request.nema_rating
        ]
    
    if search_request.ul_listed_only:
        filtered_components = [c for c in filtered_components if c.compliance.ul_listed]
    
    # Pagination
    total_count = len(filtered_components)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_components = filtered_components[start_idx:end_idx]
    
    return ComponentSearchResponse(
        components=paginated_components,
        total_count=total_count,
        page=page,
        page_size=page_size,
        has_next=end_idx < total_count
    )

@app.get("/components", response_model=ComponentSearchResponse)
async def list_components(
    category: Optional[ComponentCategory] = Query(None, description="Filter by category"),
    manufacturer: Optional[str] = Query(None, description="Filter by manufacturer"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page")
):
    """List components with optional filters"""
    search_request = ComponentSearchRequest(
        category=category,
        manufacturer=manufacturer
    )
    return await search_components(search_request, page, page_size)

@app.post("/components", response_model=ComponentSpecification)
async def create_component(component: ComponentSpecification):
    """Create a new component specification"""
    # Check if part number already exists
    for existing_component in components_db.values():
        if existing_component.part_number.upper() == component.part_number.upper():
            raise HTTPException(
                status_code=400, 
                detail=f"Component with part number {component.part_number} already exists"
            )
    
    component.updated_at = datetime.utcnow()
    components_db[component.id] = component
    logger.info(f"Created new component: {component.part_number}")
    return component

@app.put("/components/{component_id}", response_model=ComponentSpecification)
async def update_component(component_id: str, component_update: ComponentSpecification):
    """Update a component specification"""
    if component_id not in components_db:
        raise HTTPException(status_code=404, detail="Component not found")
    
    component_update.id = component_id
    component_update.updated_at = datetime.utcnow()
    components_db[component_id] = component_update
    logger.info(f"Updated component: {component_id}")
    return component_update

@app.delete("/components/{component_id}")
async def delete_component(component_id: str):
    """Delete a component specification"""
    if component_id not in components_db:
        raise HTTPException(status_code=404, detail="Component not found")
    
    deleted_component = components_db.pop(component_id)
    logger.info(f"Deleted component: {deleted_component.part_number}")
    return {"message": "Component deleted successfully"}

@app.get("/manufacturers", response_model=List[str])
async def list_manufacturers():
    """Get list of all manufacturers"""
    manufacturers = set()
    for component in components_db.values():
        manufacturers.add(component.manufacturer.name)
    return sorted(list(manufacturers))

@app.get("/categories", response_model=List[ComponentCategory])
async def list_categories():
    """Get list of all component categories"""
    return list(ComponentCategory)

@app.get("/components/{component_id}/compatible", response_model=List[ComponentSpecification])
async def get_compatible_components(component_id: str):
    """Get components compatible with the specified component"""
    if component_id not in components_db:
        raise HTTPException(status_code=404, detail="Component not found")
    
    component = components_db[component_id]
    compatible_components = []
    
    for other_component in components_db.values():
        if (other_component.id != component_id and 
            component.part_number in other_component.compatible_parts):
            compatible_components.append(other_component)
    
    return compatible_components

@app.get("/stats")
async def get_database_stats():
    """Get database statistics"""
    total_components = len(components_db)
    categories_count = {}
    manufacturers_count = {}
    verified_count = 0
    
    for component in components_db.values():
        # Count by category
        category = component.category.value
        categories_count[category] = categories_count.get(category, 0) + 1
        
        # Count by manufacturer
        manufacturer = component.manufacturer.name
        manufacturers_count[manufacturer] = manufacturers_count.get(manufacturer, 0) + 1
        
        # Count verified
        if component.verified:
            verified_count += 1
    
    return {
        "total_components": total_components,
        "verified_components": verified_count,
        "verification_rate": verified_count / total_components if total_components > 0 else 0,
        "categories": categories_count,
        "manufacturers": manufacturers_count,
        "top_manufacturers": sorted(manufacturers_count.items(), key=lambda x: x[1], reverse=True)[:10]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)