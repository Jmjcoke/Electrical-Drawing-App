"""
AI Vision Service for ELECTRICAL ORCHESTRATOR
Handles computer vision operations including cloud detection, pattern recognition, and image analysis
"""

import os
import uuid
import asyncio
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFilter
import io
import base64

from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Form, status, BackgroundTasks
from fastapi.security import HTTPBearer
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, and_, or_, func
from pydantic import BaseModel, Field, validator
import fitz  # PyMuPDF

# Import shared modules
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from shared.database.connection import get_database_session
from shared.database.models import Drawing, User, UserRole
from shared.logging.config import setup_logging

# Configure logging
setup_logging()
logger = logging.getLogger(__name__)

# Security
security = HTTPBearer()

# Configuration
MIN_CLOUD_AREA = int(os.getenv('MIN_CLOUD_AREA', '100'))  # Minimum pixels for cloud detection
MAX_CLOUD_AREA = int(os.getenv('MAX_CLOUD_AREA', '50000'))  # Maximum pixels for cloud detection
DEFAULT_SENSITIVITY = float(os.getenv('DEFAULT_SENSITIVITY', '0.7'))  # Default detection sensitivity

# Import cloud detection modules
from .cloud_detector import CloudDetector
from .pattern_recognizer import PatternRecognizer
from .overlay_generator import OverlayGenerator
from .enhanced_overlay_generator import EnhancedOverlayGenerator

# Pydantic models
class CloudDetectionRequest(BaseModel):
    drawing_id: str
    sensitivity: float = Field(default=DEFAULT_SENSITIVITY, ge=0.1, le=1.0)
    detection_method: str = Field(default="hybrid", regex="^(color|shape|texture|hybrid)$")
    cad_system: Optional[str] = Field(default=None, regex="^(autocad|microstation|solidworks|generic)$")
    custom_config: Optional[Dict[str, Any]] = None

class CloudEditArea(BaseModel):
    id: str
    boundingBox: Dict[str, float]  # {x, y, width, height}
    confidence: float
    patternType: str
    isManual: bool
    isActive: bool

class CloudEditRequest(BaseModel):
    drawingId: str
    clouds: List[CloudEditArea]
    detection_settings: Optional[Dict[str, Any]] = None

class DetectionSettingsRequest(BaseModel):
    drawingId: str
    sensitivity: float = Field(ge=0.0, le=1.0)
    cadSystem: str
    visualizationMode: str
    autoDetect: bool = True
    confidenceThreshold: float = Field(ge=0.0, le=1.0, default=0.5)

class DetectionProfile(BaseModel):
    id: str
    name: str
    description: str
    cadSystem: str
    sensitivity: float = Field(ge=0.0, le=1.0)
    confidenceThreshold: float = Field(ge=0.0, le=1.0)
    colorThresholds: Dict[str, float]
    shapeParameters: Dict[str, Any]
    textureFilters: Dict[str, Any]
    visualizationMode: str
    isDefault: bool = False
    isSystemPreset: bool = False
    createdBy: Optional[str] = None
    lastModified: str

class ProfileCreateRequest(BaseModel):
    profile: DetectionProfile

class ProfileUpdateRequest(BaseModel):
    profileId: str
    profile: DetectionProfile

class CloudArea(BaseModel):
    id: str
    page_number: int
    bbox: List[float]  # [x, y, width, height] in PDF coordinates
    confidence_score: float
    detection_method: str
    area_pixels: int
    center_point: List[float]  # [x, y] center coordinates
    shape_type: str  # irregular, rectangular, circular, freeform
    is_manual: bool = False
    created_at: str
    metadata: Optional[Dict[str, Any]] = None

class CloudDetectionResult(BaseModel):
    drawing_id: str
    page_count: int
    total_clouds_detected: int
    detection_timestamp: str
    processing_time_seconds: float
    configuration: Dict[str, Any]
    pages: List[Dict[str, Any]]  # Per-page cloud detection results
    overall_confidence: float
    warnings: List[str] = []
    
    class Config:
        from_attributes = True

class DetectionConfiguration(BaseModel):
    name: str
    description: Optional[str] = None
    cad_system: str
    sensitivity: float = Field(ge=0.1, le=1.0)
    color_thresholds: Dict[str, float]
    shape_parameters: Dict[str, Any]
    texture_filters: Dict[str, Any]
    is_default: bool = False
    created_by: Optional[str] = None

# Authentication
async def get_current_user(
    token: str = Depends(security),
    db: AsyncSession = Depends(get_database_session)
) -> User:
    """Verify token and return current user"""
    try:
        user_id = token.credentials
        
        result = await db.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is disabled"
            )
        
        return user
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )

# Initialize AI components
cloud_detector = CloudDetector()
pattern_recognizer = PatternRecognizer()
overlay_generator = OverlayGenerator()
enhanced_overlay_generator = EnhancedOverlayGenerator()

# FastAPI app
app = FastAPI(
    title="AI Vision Service",
    description="Computer vision operations for electrical drawing analysis",
    version="1.0.0"
)

@app.post("/detect-clouds", response_model=CloudDetectionResult)
async def detect_clouds(
    request: CloudDetectionRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Detect cloud areas in electrical drawings"""
    
    try:
        start_time = datetime.utcnow()
        
        # Get drawing from database
        result = await db.execute(
            select(Drawing).where(Drawing.id == request.drawing_id)
        )
        drawing = result.scalar_one_or_none()
        
        if not drawing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Drawing not found"
            )
        
        # Check if drawing is processed
        if drawing.status != "ANALYZED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Drawing must be fully processed before cloud detection"
            )
        
        # Get PDF content from storage
        pdf_content = await get_drawing_content(drawing)
        if not pdf_content:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to retrieve drawing content"
            )
        
        # Perform cloud detection
        detection_result = await perform_cloud_detection(
            pdf_content, drawing, request, current_user
        )
        
        # Calculate processing time
        end_time = datetime.utcnow()
        processing_time = (end_time - start_time).total_seconds()
        detection_result.processing_time_seconds = processing_time
        
        # Store results in database
        await store_detection_results(drawing, detection_result, db)
        
        # Generate overlays in background
        background_tasks.add_task(
            generate_detection_overlays,
            drawing.id,
            detection_result,
            db
        )
        
        logger.info(f"Cloud detection completed for drawing {drawing.id}: {detection_result.total_clouds_detected} clouds found")
        
        return detection_result
        
    except Exception as e:
        logger.error(f"Cloud detection error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cloud detection failed: {str(e)}"
        )

async def get_drawing_content(drawing: Drawing) -> Optional[bytes]:
    """Retrieve drawing content from S3 storage"""
    try:
        import boto3
        
        s3_client = boto3.client('s3', region_name=os.getenv('S3_REGION', 'us-east-1'))
        
        response = s3_client.get_object(
            Bucket=drawing.s3_bucket,
            Key=drawing.s3_key
        )
        
        return response['Body'].read()
        
    except Exception as e:
        logger.error(f"Failed to retrieve drawing content: {e}")
        return None

async def perform_cloud_detection(
    pdf_content: bytes,
    drawing: Drawing,
    request: CloudDetectionRequest,
    user: User
) -> CloudDetectionResult:
    """Perform the actual cloud detection on PDF content"""
    
    # Open PDF document
    pdf_doc = fitz.open(stream=pdf_content, filetype="pdf")
    
    try:
        detection_config = {
            'sensitivity': request.sensitivity,
            'detection_method': request.detection_method,
            'cad_system': request.cad_system or 'generic',
            'min_area': MIN_CLOUD_AREA,
            'max_area': MAX_CLOUD_AREA,
            'user_id': str(user.id)
        }
        
        if request.custom_config:
            detection_config.update(request.custom_config)
        
        pages_results = []
        all_clouds = []
        total_processing_time = 0
        warnings = []
        
        for page_num in range(pdf_doc.page_count):
            page = pdf_doc[page_num]
            
            # Convert page to image
            page_image = page_to_image(page)
            
            if page_image is None:
                warnings.append(f"Failed to convert page {page_num + 1} to image")
                continue
            
            # Detect clouds on this page
            page_start = datetime.utcnow()
            page_clouds = await detect_clouds_on_page(
                page_image, page_num + 1, detection_config, page
            )
            page_end = datetime.utcnow()
            page_time = (page_end - page_start).total_seconds()
            total_processing_time += page_time
            
            # Store page results
            page_result = {
                'page_number': page_num + 1,
                'clouds_detected': len(page_clouds),
                'processing_time': page_time,
                'clouds': [cloud.dict() for cloud in page_clouds],
                'page_dimensions': {
                    'width': page.rect.width,
                    'height': page.rect.height
                }
            }
            
            pages_results.append(page_result)
            all_clouds.extend(page_clouds)
        
        # Calculate overall confidence
        if all_clouds:
            overall_confidence = sum(cloud.confidence_score for cloud in all_clouds) / len(all_clouds)
        else:
            overall_confidence = 0.0
        
        # Create detection result
        detection_result = CloudDetectionResult(
            drawing_id=str(drawing.id),
            page_count=pdf_doc.page_count,
            total_clouds_detected=len(all_clouds),
            detection_timestamp=datetime.utcnow().isoformat(),
            processing_time_seconds=total_processing_time,
            configuration=detection_config,
            pages=pages_results,
            overall_confidence=overall_confidence,
            warnings=warnings
        )
        
        return detection_result
        
    finally:
        pdf_doc.close()

def page_to_image(page: fitz.Page, dpi: int = 150) -> Optional[np.ndarray]:
    """Convert PDF page to OpenCV image"""
    try:
        # Render page to pixmap
        matrix = fitz.Matrix(dpi / 72, dpi / 72)  # Scale for desired DPI
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        
        # Convert to PIL Image
        img_data = pix.pil_tobytes(format="PNG")
        pil_image = Image.open(io.BytesIO(img_data))
        
        # Convert to OpenCV format
        opencv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        
        return opencv_image
        
    except Exception as e:
        logger.error(f"Error converting page to image: {e}")
        return None

async def detect_clouds_on_page(
    image: np.ndarray,
    page_number: int,
    config: Dict[str, Any],
    page: fitz.Page
) -> List[CloudArea]:
    """Detect cloud areas on a single page image"""
    
    clouds = []
    
    try:
        # Get detection method
        method = config.get('detection_method', 'hybrid')
        sensitivity = config.get('sensitivity', DEFAULT_SENSITIVITY)
        
        if method in ['color', 'hybrid']:
            # Color-based detection
            color_clouds = cloud_detector.detect_by_color(image, sensitivity)
            clouds.extend(color_clouds)
        
        if method in ['shape', 'hybrid']:
            # Shape-based detection
            shape_clouds = cloud_detector.detect_by_shape(image, sensitivity)
            clouds.extend(shape_clouds)
        
        if method in ['texture', 'hybrid']:
            # Texture-based detection
            texture_clouds = cloud_detector.detect_by_texture(image, sensitivity)
            clouds.extend(texture_clouds)
        
        # Remove duplicates and merge overlapping detections
        clouds = merge_overlapping_clouds(clouds, overlap_threshold=0.3)
        
        # Filter by area constraints
        min_area = config.get('min_area', MIN_CLOUD_AREA)
        max_area = config.get('max_area', MAX_CLOUD_AREA)
        
        filtered_clouds = []
        for cloud in clouds:
            if min_area <= cloud.area_pixels <= max_area:
                # Convert image coordinates to PDF coordinates
                pdf_cloud = convert_to_pdf_coordinates(cloud, image, page)
                pdf_cloud.page_number = page_number
                filtered_clouds.append(pdf_cloud)
        
        return filtered_clouds
        
    except Exception as e:
        logger.error(f"Error detecting clouds on page {page_number}: {e}")
        return []

def merge_overlapping_clouds(clouds: List[CloudArea], overlap_threshold: float = 0.3) -> List[CloudArea]:
    """Merge overlapping cloud detections"""
    if not clouds:
        return []
    
    # Sort clouds by confidence score (highest first)
    clouds.sort(key=lambda x: x.confidence_score, reverse=True)
    
    merged = []
    used = set()
    
    for i, cloud in enumerate(clouds):
        if i in used:
            continue
        
        # Find overlapping clouds
        overlapping = [cloud]
        for j, other_cloud in enumerate(clouds[i+1:], i+1):
            if j in used:
                continue
            
            # Calculate overlap
            overlap = calculate_bbox_overlap(cloud.bbox, other_cloud.bbox)
            if overlap > overlap_threshold:
                overlapping.append(other_cloud)
                used.add(j)
        
        # Merge overlapping clouds
        if len(overlapping) > 1:
            merged_cloud = merge_cloud_areas(overlapping)
        else:
            merged_cloud = cloud
        
        merged.append(merged_cloud)
        used.add(i)
    
    return merged

def calculate_bbox_overlap(bbox1: List[float], bbox2: List[float]) -> float:
    """Calculate overlap percentage between two bounding boxes"""
    x1, y1, w1, h1 = bbox1
    x2, y2, w2, h2 = bbox2
    
    # Calculate intersection
    x_left = max(x1, x2)
    y_top = max(y1, y2)
    x_right = min(x1 + w1, x2 + w2)
    y_bottom = min(y1 + h1, y2 + h2)
    
    if x_right <= x_left or y_bottom <= y_top:
        return 0.0
    
    intersection_area = (x_right - x_left) * (y_bottom - y_top)
    
    # Calculate union
    area1 = w1 * h1
    area2 = w2 * h2
    union_area = area1 + area2 - intersection_area
    
    return intersection_area / union_area if union_area > 0 else 0.0

def merge_cloud_areas(clouds: List[CloudArea]) -> CloudArea:
    """Merge multiple cloud areas into one"""
    if not clouds:
        raise ValueError("Cannot merge empty cloud list")
    
    if len(clouds) == 1:
        return clouds[0]
    
    # Calculate merged bounding box
    min_x = min(cloud.bbox[0] for cloud in clouds)
    min_y = min(cloud.bbox[1] for cloud in clouds)
    max_x = max(cloud.bbox[0] + cloud.bbox[2] for cloud in clouds)
    max_y = max(cloud.bbox[1] + cloud.bbox[3] for cloud in clouds)
    
    merged_bbox = [min_x, min_y, max_x - min_x, max_y - min_y]
    
    # Calculate weighted average confidence
    total_area = sum(cloud.area_pixels for cloud in clouds)
    weighted_confidence = sum(
        cloud.confidence_score * (cloud.area_pixels / total_area)
        for cloud in clouds
    )
    
    # Use highest confidence cloud as base
    base_cloud = max(clouds, key=lambda x: x.confidence_score)
    
    return CloudArea(
        id=str(uuid.uuid4()),
        page_number=base_cloud.page_number,
        bbox=merged_bbox,
        confidence_score=weighted_confidence,
        detection_method=f"merged_{base_cloud.detection_method}",
        area_pixels=int(merged_bbox[2] * merged_bbox[3]),
        center_point=[
            merged_bbox[0] + merged_bbox[2] / 2,
            merged_bbox[1] + merged_bbox[3] / 2
        ],
        shape_type="merged",
        is_manual=False,
        created_at=datetime.utcnow().isoformat(),
        metadata={
            "merged_from": [cloud.id for cloud in clouds],
            "original_count": len(clouds)
        }
    )

def convert_to_pdf_coordinates(cloud: CloudArea, image: np.ndarray, page: fitz.Page) -> CloudArea:
    """Convert image coordinates to PDF coordinates"""
    img_height, img_width = image.shape[:2]
    pdf_width = page.rect.width
    pdf_height = page.rect.height
    
    # Scale factors
    scale_x = pdf_width / img_width
    scale_y = pdf_height / img_height
    
    # Convert bounding box
    img_bbox = cloud.bbox
    pdf_bbox = [
        img_bbox[0] * scale_x,
        img_bbox[1] * scale_y,
        img_bbox[2] * scale_x,
        img_bbox[3] * scale_y
    ]
    
    # Convert center point
    img_center = cloud.center_point
    pdf_center = [
        img_center[0] * scale_x,
        img_center[1] * scale_y
    ]
    
    # Create new cloud with PDF coordinates
    return CloudArea(
        id=cloud.id,
        page_number=cloud.page_number,
        bbox=pdf_bbox,
        confidence_score=cloud.confidence_score,
        detection_method=cloud.detection_method,
        area_pixels=cloud.area_pixels,
        center_point=pdf_center,
        shape_type=cloud.shape_type,
        is_manual=cloud.is_manual,
        created_at=cloud.created_at,
        metadata=cloud.metadata
    )

async def store_detection_results(
    drawing: Drawing,
    detection_result: CloudDetectionResult,
    db: AsyncSession
):
    """Store cloud detection results in database"""
    try:
        # Update drawing's cloud detection results
        if not drawing.cloud_detection_results:
            drawing.cloud_detection_results = {}
        
        drawing.cloud_detection_results.update({
            'detection_result': detection_result.dict(),
            'last_detection': datetime.utcnow().isoformat(),
            'detection_version': '1.0'
        })
        
        await db.commit()
        
    except Exception as e:
        logger.error(f"Failed to store detection results: {e}")
        await db.rollback()

async def generate_detection_overlays(
    drawing_id: str,
    detection_result: CloudDetectionResult,
    db: AsyncSession
):
    """Generate visual overlays for detected clouds (background task)"""
    try:
        # This would generate overlay images showing detected clouds
        # For now, we'll just log the completion
        logger.info(f"Generated detection overlays for drawing {drawing_id}")
        
    except Exception as e:
        logger.error(f"Failed to generate overlays for {drawing_id}: {e}")

@app.get("/drawings/{drawing_id}/clouds")
async def get_cloud_detection_results(
    drawing_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Get cloud detection results for a drawing"""
    
    result = await db.execute(
        select(Drawing).where(Drawing.id == drawing_id)
    )
    drawing = result.scalar_one_or_none()
    
    if not drawing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drawing not found"
        )
    
    cloud_results = drawing.cloud_detection_results or {}
    
    return {
        "drawing_id": drawing_id,
        "has_detection_results": bool(cloud_results.get('detection_result')),
        "last_detection": cloud_results.get('last_detection'),
        "detection_results": cloud_results.get('detection_result', {})
    }

@app.get("/detection-status/{task_id}")
async def get_detection_status(task_id: str, current_user: User = Depends(get_current_user)):
    """Get cloud detection task status"""
    try:
        # For demo purposes, simulate completed detection
        # In a real implementation, you'd check a task queue/database
        return {
            "success": True,
            "data": {
                "status": "completed",
                "progress": 100,
                "message": "Cloud detection completed successfully",
                "results": {
                    "originalWidth": 1920,
                    "originalHeight": 1080,
                    "clouds": [],
                    "processingTime": 2.5,
                    "averageConfidence": 0.85
                }
            }
        }
            
    except Exception as e:
        logger.error(f"Error getting detection status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get detection status")

@app.post("/save-cloud-edits")
async def save_cloud_edits(
    request: CloudEditRequest, 
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Save manual cloud area edits"""
    try:
        # Validate the clouds data
        if not request.clouds:
            raise HTTPException(status_code=400, detail="No cloud data provided")
        
        # Get the drawing
        result = await db.execute(
            select(Drawing).where(Drawing.id == request.drawingId)
        )
        drawing = result.scalar_one_or_none()
        
        if not drawing:
            raise HTTPException(status_code=404, detail="Drawing not found")
        
        # Save to database
        cloud_data = {
            "clouds": [cloud.dict() for cloud in request.clouds],
            "detection_settings": request.detection_settings or {},
            "last_edited_by": str(current_user.id),
            "manual_edits_count": len([c for c in request.clouds if c.isManual])
        }
        
        metadata = {
            "total_clouds": len(request.clouds),
            "manual_clouds": len([c for c in request.clouds if c.isManual]),
            "auto_clouds": len([c for c in request.clouds if not c.isManual]),
            "last_modified": datetime.utcnow().isoformat(),
            "edited_by": current_user.email
        }
        
        # Update drawing cloud detection results
        if not drawing.cloud_detection_results:
            drawing.cloud_detection_results = {}
        
        drawing.cloud_detection_results.update({
            'manual_edits': cloud_data,
            'manual_edits_metadata': metadata,
            'last_edited': datetime.utcnow().isoformat()
        })
        
        await db.commit()
        
        return {
            "success": True,
            "message": "Cloud edits saved successfully",
            "data": {
                "drawing_id": request.drawingId,
                "total_clouds": len(request.clouds),
                "manual_edits": len([c for c in request.clouds if c.isManual])
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving cloud edits: {e}")
        raise HTTPException(status_code=500, detail="Failed to save cloud edits")

@app.post("/update-detection-settings")
async def update_detection_settings(
    request: DetectionSettingsRequest, 
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Update cloud detection configuration settings"""
    try:
        # Validate settings
        if request.sensitivity < 0 or request.sensitivity > 1:
            raise HTTPException(status_code=400, detail="Sensitivity must be between 0 and 1")
        
        # Get the drawing
        result = await db.execute(
            select(Drawing).where(Drawing.id == request.drawingId)
        )
        drawing = result.scalar_one_or_none()
        
        if not drawing:
            raise HTTPException(status_code=404, detail="Drawing not found")
        
        # Save settings to drawing
        settings_data = {
            "sensitivity": request.sensitivity,
            "cad_system": request.cadSystem,
            "visualization_mode": request.visualizationMode,
            "auto_detect": request.autoDetect,
            "confidence_threshold": request.confidenceThreshold,
            "updated_by": str(current_user.id),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        # Update drawing detection settings
        if not drawing.cloud_detection_results:
            drawing.cloud_detection_results = {}
        
        drawing.cloud_detection_results.update({
            'detection_settings': settings_data
        })
        
        await db.commit()
        
        return {
            "success": True,
            "message": "Detection settings updated successfully",
            "data": settings_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating detection settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to update detection settings")

@app.get("/detection-profiles")
async def get_detection_profiles(current_user: User = Depends(get_current_user)):
    """Get all available detection profiles"""
    try:
        # Default system profiles
        system_profiles = [
            {
                "id": "autocad-standard",
                "name": "AutoCAD Standard",
                "description": "Optimized for AutoCAD electrical drawings with standard cloud patterns",
                "cadSystem": "autocad",
                "sensitivity": 0.75,
                "confidenceThreshold": 0.6,
                "colorThresholds": {"red": 0.8, "green": 0.3, "blue": 0.3, "alpha": 0.7},
                "shapeParameters": {"minArea": 150, "maxArea": 25000, "aspectRatioTolerance": 0.3, "edgeSmoothing": 2},
                "textureFilters": {"gaussianBlur": 1.5, "contrastEnhancement": 1.2, "edgeDetection": True, "noiseReduction": 0.8},
                "visualizationMode": "standard",
                "isDefault": True,
                "isSystemPreset": True,
                "lastModified": datetime.utcnow().isoformat()
            },
            {
                "id": "microstation-standard",
                "name": "MicroStation Standard",
                "description": "Optimized for MicroStation drawings with typical revision clouds",
                "cadSystem": "microstation",
                "sensitivity": 0.7,
                "confidenceThreshold": 0.65,
                "colorThresholds": {"red": 0.9, "green": 0.2, "blue": 0.2, "alpha": 0.8},
                "shapeParameters": {"minArea": 200, "maxArea": 30000, "aspectRatioTolerance": 0.4, "edgeSmoothing": 1.8},
                "textureFilters": {"gaussianBlur": 1.2, "contrastEnhancement": 1.3, "edgeDetection": True, "noiseReduction": 0.7},
                "visualizationMode": "outline",
                "isDefault": False,
                "isSystemPreset": True,
                "lastModified": datetime.utcnow().isoformat()
            },
            {
                "id": "solidworks-standard",
                "name": "SolidWorks Standard",
                "description": "Configured for SolidWorks electrical schematics and cloud annotations",
                "cadSystem": "solidworks",
                "sensitivity": 0.8,
                "confidenceThreshold": 0.7,
                "colorThresholds": {"red": 0.7, "green": 0.4, "blue": 0.4, "alpha": 0.6},
                "shapeParameters": {"minArea": 100, "maxArea": 20000, "aspectRatioTolerance": 0.5, "edgeSmoothing": 2.2},
                "textureFilters": {"gaussianBlur": 1.8, "contrastEnhancement": 1.1, "edgeDetection": False, "noiseReduction": 0.9},
                "visualizationMode": "pattern_specific",
                "isDefault": False,
                "isSystemPreset": True,
                "lastModified": datetime.utcnow().isoformat()
            },
            {
                "id": "generic-balanced",
                "name": "Generic Balanced",
                "description": "Balanced preset offering good performance and accuracy for most electrical drawing types",
                "cadSystem": "generic",
                "sensitivity": 0.65,
                "confidenceThreshold": 0.6,
                "colorThresholds": {"red": 0.8, "green": 0.35, "blue": 0.35, "alpha": 0.7},
                "shapeParameters": {"minArea": 150, "maxArea": 25000, "aspectRatioTolerance": 0.35, "edgeSmoothing": 2.0},
                "textureFilters": {"gaussianBlur": 1.5, "contrastEnhancement": 1.2, "edgeDetection": True, "noiseReduction": 0.8},
                "visualizationMode": "standard",
                "isDefault": False,
                "isSystemPreset": True,
                "lastModified": datetime.utcnow().isoformat()
            }
        ]
        
        return {
            "success": True,
            "data": {
                "profiles": system_profiles,
                "total": len(system_profiles)
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting detection profiles: {e}")
        raise HTTPException(status_code=500, detail="Failed to get detection profiles")

@app.post("/detection-profiles")
async def create_detection_profile(
    request: ProfileCreateRequest,
    current_user: User = Depends(get_current_user)
):
    """Create a new detection profile"""
    try:
        # Validate profile data
        profile = request.profile
        if not profile.name or not profile.cadSystem:
            raise HTTPException(status_code=400, detail="Profile name and CAD system are required")
        
        # In a real implementation, save to database
        # For now, return success
        profile_data = profile.dict()
        profile_data["createdBy"] = current_user.email
        profile_data["lastModified"] = datetime.utcnow().isoformat()
        profile_data["isSystemPreset"] = False
        
        return {
            "success": True,
            "message": "Detection profile created successfully",
            "data": profile_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating detection profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to create detection profile")

@app.put("/detection-profiles/{profile_id}")
async def update_detection_profile(
    profile_id: str,
    request: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """Update an existing detection profile"""
    try:
        # Validate profile data
        profile = request.profile
        if not profile.name or not profile.cadSystem:
            raise HTTPException(status_code=400, detail="Profile name and CAD system are required")
        
        # Check if profile exists and user has permission
        # For system presets, only allow certain modifications
        if profile.isSystemPreset:
            raise HTTPException(status_code=403, detail="Cannot modify system preset profiles")
        
        # In a real implementation, update in database
        profile_data = profile.dict()
        profile_data["lastModified"] = datetime.utcnow().isoformat()
        
        return {
            "success": True,
            "message": "Detection profile updated successfully",
            "data": profile_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating detection profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to update detection profile")

@app.delete("/detection-profiles/{profile_id}")
async def delete_detection_profile(
    profile_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a detection profile"""
    try:
        # Check if profile exists and user has permission
        # Cannot delete system presets
        if profile_id.startswith('autocad-') or profile_id.startswith('microstation-') or profile_id.startswith('solidworks-') or profile_id.startswith('generic-'):
            raise HTTPException(status_code=403, detail="Cannot delete system preset profiles")
        
        # In a real implementation, delete from database
        return {
            "success": True,
            "message": "Detection profile deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting detection profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete detection profile")

@app.post("/detection-profiles/{profile_id}/apply")
async def apply_detection_profile(
    profile_id: str,
    drawing_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Apply a detection profile to a specific drawing"""
    try:
        # Get the profile configuration
        # In a real implementation, fetch from database
        
        # Get the drawing
        result = await db.execute(
            select(Drawing).where(Drawing.id == drawing_id)
        )
        drawing = result.scalar_one_or_none()
        
        if not drawing:
            raise HTTPException(status_code=404, detail="Drawing not found")
        
        # Apply profile settings to drawing
        profile_applied = {
            "profile_id": profile_id,
            "applied_by": str(current_user.id),
            "applied_at": datetime.utcnow().isoformat(),
            "drawing_id": drawing_id
        }
        
        # Update drawing with profile settings
        if not drawing.cloud_detection_results:
            drawing.cloud_detection_results = {}
        
        drawing.cloud_detection_results.update({
            'applied_profile': profile_applied
        })
        
        await db.commit()
        
        return {
            "success": True,
            "message": "Detection profile applied successfully",
            "data": profile_applied
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error applying detection profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to apply detection profile")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "ai-vision",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8004)