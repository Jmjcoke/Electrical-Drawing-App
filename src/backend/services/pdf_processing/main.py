"""
PDF Processing Service for ELECTRICAL ORCHESTRATOR
Handles PDF upload, processing, and storage for electrical drawings
"""

import os
import uuid
import asyncio
import tempfile
import mimetypes
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import logging
import aiohttp

from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Form, status, BackgroundTasks
from fastapi.security import HTTPBearer
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, and_, or_, func
from pydantic import BaseModel, Field, validator
import boto3
from botocore.exceptions import ClientError
import PyPDF2
import fitz  # PyMuPDF for better PDF processing
import hashlib
import magic  # python-magic for file type detection
# Temporarily disable complex imports to get basic service running
# from pdf_analyzer import PDFAnalyzer
# from thumbnail_generator import ThumbnailGenerator
# from cloud_integration import perform_cloud_detection, generate_cloud_overlay_thumbnails, should_perform_cloud_detection, enhance_detection_results_with_metadata

# Import shared modules
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from shared.database.connection import get_database_session
from shared.database.models import (
    Drawing, Project, User, DrawingStatus, UserRole
)
from shared.logging.config import setup_logging

# Configure logging
setup_logging()
logger = logging.getLogger(__name__)

# Security
security = HTTPBearer()

# Configuration
ALLOWED_MIME_TYPES = ['application/pdf']
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
S3_BUCKET = os.getenv('S3_BUCKET', 'electrical-orchestrator-drawings')
S3_REGION = os.getenv('S3_REGION', 'us-east-1')
VIRUS_SCAN_ENABLED = os.getenv('VIRUS_SCAN_ENABLED', 'false').lower() == 'true'

# Initialize PDF analyzer and thumbnail generator
pdf_analyzer = PDFAnalyzer()
thumbnail_generator = ThumbnailGenerator(S3_BUCKET, S3_REGION)

# Pydantic models
class DrawingUploadResponse(BaseModel):
    id: str
    filename: str
    file_size: int
    page_count: Optional[int]
    status: str
    upload_url: Optional[str] = None
    processing_status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class DrawingMetadata(BaseModel):
    drawing_id: str
    cad_system: Optional[str] = None
    drawing_number: Optional[str] = None
    revision: Optional[str] = None
    title: Optional[str] = None
    scale: Optional[str] = None
    sheet_size: Optional[str] = None
    last_modified: Optional[datetime] = None

class ProcessingStatus(BaseModel):
    drawing_id: str
    status: DrawingStatus
    progress_percentage: int
    current_step: str
    error_message: Optional[str] = None
    processing_time: Optional[float] = None

# AWS S3 Client
def get_s3_client():
    """Get S3 client with configured credentials"""
    return boto3.client(
        's3',
        region_name=S3_REGION,
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
    )

# Authentication and Authorization
async def get_current_user(
    token: str = Depends(security),
    db: AsyncSession = Depends(get_database_session)
) -> User:
    """Verify token and return current user"""
    try:
        # Extract user ID from token (simplified)
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

async def check_project_access(
    project_id: str,
    user: User,
    db: AsyncSession
) -> bool:
    """Check if user has access to the project"""
    
    # Super admins have access to everything
    if user.role == UserRole.SYSTEM_ADMIN:
        return True
    
    # Check if project exists and user has access
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.team_members))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        return False
    
    # Project creator has access
    if project.created_by == user.id:
        return True
    
    # Check team membership
    for member in project.team_members:
        if member.user_id == user.id:
            return True
    
    # Project managers can access all projects
    if user.role in [UserRole.PROJECT_MANAGER, UserRole.ELECTRICAL_LEAD]:
        return True
    
    return False

# File validation functions
def validate_file_type(file_content: bytes, filename: str) -> bool:
    """Validate file type using magic numbers"""
    try:
        mime = magic.from_buffer(file_content, mime=True)
        return mime in ALLOWED_MIME_TYPES
    except Exception as e:
        logger.error(f"File type validation error: {e}")
        return False

def validate_pdf_structure(file_content: bytes) -> Dict[str, Any]:
    """Validate PDF structure and extract metadata"""
    try:
        # Use PyMuPDF for better PDF validation
        pdf_doc = fitz.open(stream=file_content, filetype="pdf")
        
        if pdf_doc.is_pdf:
            metadata = {
                'page_count': pdf_doc.page_count,
                'is_encrypted': pdf_doc.needs_pass,
                'metadata': pdf_doc.metadata,
                'is_valid': True,
                'file_size': len(file_content)
            }
            
            # Check if it's an electrical drawing (heuristics)
            electrical_keywords = [
                'electrical', 'circuit', 'wiring', 'schematic', 
                'panel', 'motor', 'control', 'instrument'
            ]
            
            title = metadata['metadata'].get('title', '').lower()
            subject = metadata['metadata'].get('subject', '').lower()
            
            is_electrical = any(keyword in title or keyword in subject 
                              for keyword in electrical_keywords)
            
            metadata['likely_electrical'] = is_electrical
            
            pdf_doc.close()
            return metadata
        else:
            return {'is_valid': False, 'error': 'Invalid PDF structure'}
            
    except Exception as e:
        logger.error(f"PDF validation error: {e}")
        return {'is_valid': False, 'error': str(e)}

async def scan_for_viruses(file_content: bytes, filename: str) -> bool:
    """Scan file for viruses using ClamAV (if enabled)"""
    if not VIRUS_SCAN_ENABLED:
        return True
    
    try:
        # In production, integrate with ClamAV
        # For now, basic checks
        
        # Check file size
        if len(file_content) > MAX_FILE_SIZE:
            return False
        
        # Basic signature checks for known malicious patterns
        malicious_patterns = [
            b'%PDF-/JavaScript',  # PDF with JavaScript
            b'/OpenAction',       # Auto-opening actions
            b'/Launch'            # File launching
        ]
        
        for pattern in malicious_patterns:
            if pattern in file_content:
                logger.warning(f"Potentially malicious pattern found in {filename}")
                return False
        
        return True
        
    except Exception as e:
        logger.error(f"Virus scanning error: {e}")
        return False

# Background processing functions
async def process_pdf_background(drawing_id: str, file_content: bytes, db: AsyncSession):
    """Background task to process uploaded PDF"""
    try:
        # Update status to processing
        result = await db.execute(
            select(Drawing).where(Drawing.id == drawing_id)
        )
        drawing = result.scalar_one_or_none()
        
        if not drawing:
            logger.error(f"Drawing {drawing_id} not found for processing")
            return
        
        drawing.status = DrawingStatus.PROCESSING
        drawing.processing_started_at = datetime.utcnow()
        await db.commit()
        
        # Comprehensive PDF analysis using enhanced analyzer
        analysis_results = pdf_analyzer.analyze_pdf(file_content, drawing.filename)
        
        if not analysis_results.get('is_valid'):
            drawing.status = DrawingStatus.FAILED
            drawing.processing_error = analysis_results.get('error', 'PDF analysis failed')
            drawing.processing_completed_at = datetime.utcnow()
            await db.commit()
            return
        
        # Update drawing with analysis results
        drawing.page_count = analysis_results.get('content_analysis', {}).get('page_count', 0)
        
        # Generate thumbnails for all pages
        thumbnail_results = thumbnail_generator.generate_page_thumbnails(
            file_content, str(drawing.id), drawing.filename
        )
        
        # Generate page navigation data
        navigation_data = thumbnail_generator.get_page_navigation_data(file_content)
        
        # Store comprehensive analysis results
        processing_results = {
            'analysis_results': analysis_results,
            'thumbnail_results': thumbnail_results,
            'navigation_data': navigation_data,
            'quality_score': analysis_results.get('quality_score', 0.0),
            'electrical_classification': analysis_results.get('electrical_classification', {}),
            'cad_system': analysis_results.get('cad_system', {}),
            'warnings': analysis_results.get('warnings', []),
            'cloud_detection_results': await perform_cloud_detection_if_applicable(
                file_content, drawing_id, analysis_results
            ),
            'processed_at': datetime.utcnow().isoformat()
        }
        
        # Mark as analyzed
        drawing.status = DrawingStatus.ANALYZED
        drawing.processing_completed_at = datetime.utcnow()
        drawing.component_detection_results = processing_results
        
        await db.commit()
        
        logger.info(f"Successfully processed drawing {drawing_id}")
        
    except Exception as e:
        logger.error(f"Error processing drawing {drawing_id}: {e}")
        
        # Update error status
        try:
            result = await db.execute(
                select(Drawing).where(Drawing.id == drawing_id)
            )
            drawing = result.scalar_one_or_none()
            
            if drawing:
                drawing.status = DrawingStatus.FAILED
                drawing.processing_error = str(e)
                drawing.processing_completed_at = datetime.utcnow()
                await db.commit()
        except Exception as db_error:
            logger.error(f"Failed to update error status: {db_error}")

# FastAPI app
app = FastAPI(
    title="PDF Processing Service",
    description="PDF upload, processing, and storage for electrical drawings",
    version="1.0.0"
)

@app.post("/upload", response_model=DrawingUploadResponse)
async def upload_drawing(
    background_tasks: BackgroundTasks,
    project_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Upload a PDF drawing for processing"""
    
    # Validate project access
    has_access = await check_project_access(project_id, current_user, db)
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for this project"
        )
    
    # Validate file
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed"
        )
    
    # Read file content
    file_content = await file.read()
    file_size = len(file_content)
    
    # Validate file size
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    # Validate file type
    if not validate_file_type(file_content, file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only PDF files are allowed."
        )
    
    # Virus scan
    if not await scan_for_viruses(file_content, file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File failed security scan"
        )
    
    # Generate unique filename and S3 key
    file_hash = hashlib.sha256(file_content).hexdigest()[:16]
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    unique_filename = f"{timestamp}_{file_hash}_{file.filename}"
    s3_key = f"projects/{project_id}/drawings/{unique_filename}"
    
    try:
        # Upload to S3
        s3_client = get_s3_client()
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=file_content,
            ContentType='application/pdf',
            Metadata={
                'original_filename': file.filename,
                'uploaded_by': str(current_user.id),
                'project_id': project_id,
                'upload_timestamp': datetime.utcnow().isoformat()
            }
        )
        
        # Create database record
        drawing = Drawing(
            filename=unique_filename,
            original_filename=file.filename,
            file_size=file_size,
            mime_type='application/pdf',
            s3_key=s3_key,
            s3_bucket=S3_BUCKET,
            status=DrawingStatus.UPLOADED,
            project_id=project_id,
            uploaded_by=current_user.id
        )
        
        db.add(drawing)
        await db.commit()
        await db.refresh(drawing)
        
        # Start background processing
        background_tasks.add_task(
            process_pdf_background,
            str(drawing.id),
            file_content,
            db
        )
        
        logger.info(f"Drawing uploaded successfully: {drawing.id}")
        
        return DrawingUploadResponse(
            id=str(drawing.id),
            filename=drawing.filename,
            file_size=drawing.file_size,
            page_count=drawing.page_count,
            status=drawing.status,
            processing_status="queued",
            created_at=drawing.created_at
        )
        
    except ClientError as e:
        logger.error(f"S3 upload error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload file to storage"
        )
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Upload failed"
        )

@app.get("/drawings/{drawing_id}/status", response_model=ProcessingStatus)
async def get_processing_status(
    drawing_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Get processing status of a drawing"""
    
    result = await db.execute(
        select(Drawing)
        .options(selectinload(Drawing.project))
        .where(Drawing.id == drawing_id)
    )
    drawing = result.scalar_one_or_none()
    
    if not drawing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drawing not found"
        )
    
    # Check project access
    has_access = await check_project_access(str(drawing.project_id), current_user, db)
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for this drawing"
        )
    
    # Calculate progress
    progress_map = {
        DrawingStatus.UPLOADED: 10,
        DrawingStatus.PROCESSING: 50,
        DrawingStatus.ANALYZED: 100,
        DrawingStatus.FAILED: 0
    }
    
    progress = progress_map.get(drawing.status, 0)
    
    # Calculate processing time
    processing_time = None
    if drawing.processing_started_at and drawing.processing_completed_at:
        processing_time = (drawing.processing_completed_at - drawing.processing_started_at).total_seconds()
    
    return ProcessingStatus(
        drawing_id=str(drawing.id),
        status=drawing.status,
        progress_percentage=progress,
        current_step=drawing.status.value,
        error_message=drawing.processing_error,
        processing_time=processing_time
    )

@app.get("/projects/{project_id}/drawings")
async def list_project_drawings(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """List all drawings for a project"""
    
    # Check project access
    has_access = await check_project_access(project_id, current_user, db)
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for this project"
        )
    
    result = await db.execute(
        select(Drawing)
        .where(Drawing.project_id == project_id)
        .order_by(Drawing.created_at.desc())
    )
    drawings = result.scalars().all()
    
    return {
        "project_id": project_id,
        "drawings": [
            DrawingUploadResponse(
                id=str(drawing.id),
                filename=drawing.filename,
                file_size=drawing.file_size,
                page_count=drawing.page_count,
                status=drawing.status,
                processing_status=drawing.status.value,
                created_at=drawing.created_at
            )
            for drawing in drawings
        ]
    }

@app.delete("/drawings/{drawing_id}")
async def delete_drawing(
    drawing_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Delete a drawing"""
    
    result = await db.execute(
        select(Drawing).where(Drawing.id == drawing_id)
    )
    drawing = result.scalar_one_or_none()
    
    if not drawing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drawing not found"
        )
    
    # Check project access
    has_access = await check_project_access(str(drawing.project_id), current_user, db)
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for this drawing"
        )
    
    try:
        # Delete from S3
        s3_client = get_s3_client()
        s3_client.delete_object(Bucket=drawing.s3_bucket, Key=drawing.s3_key)
        
        # Delete from database
        await db.delete(drawing)
        await db.commit()
        
        logger.info(f"Drawing deleted: {drawing_id}")
        
        # Clean up thumbnails
        cleanup_result = thumbnail_generator.cleanup_thumbnails(drawing_id)
        if not cleanup_result['success']:
            logger.warning(f"Failed to clean up thumbnails for {drawing_id}: {cleanup_result.get('error')}")
        
        return {"message": "Drawing deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting drawing {drawing_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete drawing"
        )

@app.get("/drawings/{drawing_id}/thumbnails")
async def get_drawing_thumbnails(
    drawing_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Get all thumbnails for a drawing"""
    
    result = await db.execute(
        select(Drawing).where(Drawing.id == drawing_id)
    )
    drawing = result.scalar_one_or_none()
    
    if not drawing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drawing not found"
        )
    
    # Check project access
    has_access = await check_project_access(str(drawing.project_id), current_user, db)
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for this drawing"
        )
    
    # Get processing results from database
    processing_results = drawing.component_detection_results or {}
    thumbnail_results = processing_results.get('thumbnail_results', {})
    
    if not thumbnail_results.get('success'):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thumbnails not available for this drawing"
        )
    
    return {
        "drawing_id": drawing_id,
        "thumbnails": thumbnail_results,
        "navigation_data": processing_results.get('navigation_data', {})
    }

@app.get("/drawings/{drawing_id}/pages")
async def get_drawing_pages(
    drawing_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Get page information and navigation data for a drawing"""
    
    result = await db.execute(
        select(Drawing).where(Drawing.id == drawing_id)
    )
    drawing = result.scalar_one_or_none()
    
    if not drawing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drawing not found"
        )
    
    # Check project access
    has_access = await check_project_access(str(drawing.project_id), current_user, db)
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for this drawing"
        )
    
    # Get processing results
    processing_results = drawing.component_detection_results or {}
    navigation_data = processing_results.get('navigation_data', {})
    
    return {
        "drawing_id": drawing_id,
        "total_pages": drawing.page_count or 0,
        "navigation_data": navigation_data,
        "processing_status": drawing.status
    }

@app.get("/drawings/{drawing_id}/pages/{page_number}/thumbnail")
async def get_page_thumbnail(
    drawing_id: str,
    page_number: int,
    size: str = "medium",  # small, medium, large
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_database_session)
):
    """Get a specific page thumbnail"""
    
    result = await db.execute(
        select(Drawing).where(Drawing.id == drawing_id)
    )
    drawing = result.scalar_one_or_none()
    
    if not drawing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Drawing not found"
        )
    
    # Check project access
    has_access = await check_project_access(str(drawing.project_id), current_user, db)
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for this drawing"
        )
    
    # Validate page number
    if page_number < 1 or page_number > (drawing.page_count or 0):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid page number. Drawing has {drawing.page_count} pages."
        )
    
    # Validate size
    if size not in ["small", "medium", "large"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Size must be one of: small, medium, large"
        )
    
    # Get thumbnail information
    processing_results = drawing.component_detection_results or {}
    thumbnail_results = processing_results.get('thumbnail_results', {})
    
    if not thumbnail_results.get('success'):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Thumbnails not available for this drawing"
        )
    
    # Find the specific page thumbnail
    page_key = f"page_{page_number}"
    thumbnail_urls = thumbnail_results.get('thumbnail_urls', {})
    
    if page_key not in thumbnail_urls:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Thumbnail not found for page {page_number}"
        )
    
    page_thumbnails = thumbnail_urls[page_key]
    if size not in page_thumbnails:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Thumbnail size '{size}' not available for page {page_number}"
        )
    
    return {
        "drawing_id": drawing_id,
        "page_number": page_number,
        "size": size,
        "thumbnail": page_thumbnails[size]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)

async def perform_cloud_detection_if_applicable(file_content: bytes, drawing_id: str, analysis_results: Dict[str, Any]) -> Dict[str, Any]:
    """
    Wrapper function to conditionally perform cloud detection based on file characteristics.
    """
    try:
        cad_system_info = analysis_results.get("cad_system", {})
        
        if should_perform_cloud_detection(cad_system_info, len(file_content)):
            logger.info(f"Performing cloud detection for drawing {drawing_id}")
            cloud_results = await perform_cloud_detection(file_content, drawing_id, cad_system_info)
            
            # Generate overlay thumbnails if clouds were detected
            if cloud_results.get("clouds_detected", 0) > 0:
                overlay_results = await generate_cloud_overlay_thumbnails(drawing_id, cloud_results)
                cloud_results["overlay_thumbnails"] = overlay_results
            
            # Enhance results with additional metadata
            enhanced_results = enhance_detection_results_with_metadata(
                cloud_results, analysis_results, 0.0  # Processing time will be calculated separately
            )
            
            return enhanced_results
        else:
            logger.info(f"Skipping cloud detection for drawing {drawing_id}: not applicable")
            return {
                "detection_status": "skipped",
                "reason": "file_size_or_classification_criteria_not_met",
                "clouds_detected": 0,
                "clouds": [],
                "overlay_available": False,
                "detected_at": datetime.utcnow().isoformat()
            }
    except Exception as e:
        logger.error(f"Error in cloud detection wrapper for drawing {drawing_id}: {e}")
        return {
            "detection_status": "error",
            "error": str(e),
            "clouds_detected": 0,
            "clouds": [],
            "overlay_available": False,
            "detected_at": datetime.utcnow().isoformat()
        }

# Cloud detection API endpoints
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
    
    # Check project access
    has_access = await check_project_access(str(drawing.project_id), current_user, db)
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for this drawing"
        )
    
    # Get cloud detection results from processing data
    processing_results = drawing.component_detection_results or {}
    cloud_results = processing_results.get('cloud_detection_results', {})
    
    return {
        "drawing_id": drawing_id,
        "detection_status": cloud_results.get('detection_status', 'not_processed'),
        "clouds_detected": cloud_results.get('clouds_detected', 0),
        "clouds": cloud_results.get('clouds', []),
        "detection_confidence": cloud_results.get('detection_confidence', 0.0),
        "cad_system_used": cloud_results.get('cad_system_used', 'unknown'),
        "overlay_available": cloud_results.get('overlay_available', False),
        "detection_metadata": cloud_results.get('detection_metadata', {}),
        "quality_assessment": cloud_results.get('quality_assessment', {})
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "pdf-processing",
        "version": "1.0.0",
        "cloud_detection_integration": "enabled",
        "timestamp": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)