"""
Historical Data Import Service
Story 4.1: Comprehensive historical project data import and management
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
import json
import logging
from datetime import datetime, timedelta
import asyncio
import uuid
from pathlib import Path

# Import our data import modules
from importers.multi_format_importer import MultiFormatImporter
from importers.legacy_system_connector import LegacySystemConnector
from validators.data_quality_engine import DataQualityEngine
from analyzers.project_classifier import ProjectClassifier
from analyzers.cost_analyzer import HistoricalCostAnalyzer
from data_models import HistoricalProject, ImportJob, DataQualityReport
from database import HistoricalDataDatabase

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="Historical Data Import Service",
    description="Comprehensive historical project data import and management - Story 4.1",
    version="1.0.0",
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global service instances
importer = MultiFormatImporter()
legacy_connector = LegacySystemConnector()
quality_engine = DataQualityEngine()
classifier = ProjectClassifier()
cost_analyzer = HistoricalCostAnalyzer()
database = HistoricalDataDatabase()

# Pydantic models for API
class FileImportRequest(BaseModel):
    import_name: str = Field(..., description="Name for this import job")
    file_format: str = Field(..., description="File format: excel, csv, json, xml")
    validation_rules: Dict[str, Any] = Field(default={}, description="Custom validation rules")
    classification_hints: Dict[str, Any] = Field(default={}, description="Hints for project classification")

class LegacySystemImportRequest(BaseModel):
    system_type: str = Field(..., description="Legacy system: accubid, conest, turbobid, etc.")
    connection_config: Dict[str, Any] = Field(..., description="Connection configuration")
    import_parameters: Dict[str, Any] = Field(default={}, description="Import parameters")

class DataQualityRequest(BaseModel):
    import_job_id: str = Field(..., description="Import job ID to analyze")
    quality_threshold: float = Field(default=0.95, description="Minimum quality threshold")
    auto_fix: bool = Field(default=True, description="Automatically fix issues where possible")

class ProjectQueryRequest(BaseModel):
    filters: Dict[str, Any] = Field(default={}, description="Query filters")
    date_range: Optional[Dict[str, str]] = Field(None, description="Date range filter")
    project_types: Optional[List[str]] = Field(None, description="Project types to include")
    cost_range: Optional[Dict[str, float]] = Field(None, description="Cost range filter")
    limit: int = Field(default=100, description="Maximum results to return")
    offset: int = Field(default=0, description="Results offset for pagination")

class HistoricalAnalysisRequest(BaseModel):
    analysis_type: str = Field(..., description="Type of analysis: cost_trends, productivity, regional")
    parameters: Dict[str, Any] = Field(default={}, description="Analysis parameters")
    time_period: Optional[Dict[str, str]] = Field(None, description="Time period for analysis")

# Response models
class APIResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    message: str
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())

class ImportJobResponse(BaseModel):
    success: bool
    job_id: str
    status: str
    message: str
    estimated_completion: Optional[str] = None

# Health check endpoint
@app.get("/health", response_model=APIResponse)
async def health_check():
    """Health check endpoint with service status"""
    try:
        # Check database connection
        db_status = await database.health_check()
        
        # Check import engine status
        import_status = await importer.health_check()
        
        return APIResponse(
            success=True,
            data={
                "status": "healthy",
                "service": "historical-data",
                "version": "1.0.0",
                "database_status": db_status,
                "import_engine_status": import_status,
                "active_imports": await get_active_import_count()
            },
            message="Historical Data Service is healthy and ready"
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")

# === FILE IMPORT ENDPOINTS ===

@app.post("/api/v1/import/file", response_model=ImportJobResponse)
async def import_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    request_data: str = None
):
    """Import historical data from uploaded file"""
    try:
        # Parse request data if provided
        import_request = FileImportRequest.parse_raw(request_data) if request_data else FileImportRequest(
            import_name=f"File import {datetime.now().strftime('%Y%m%d_%H%M%S')}",
            file_format="auto_detect"
        )
        
        # Create import job
        job_id = str(uuid.uuid4())
        
        # Save uploaded file
        file_path = await save_uploaded_file(file, job_id)
        
        # Start background import process
        background_tasks.add_task(
            process_file_import,
            job_id,
            file_path,
            import_request
        )
        
        # Estimate completion time based on file size
        file_size_mb = file.size / (1024 * 1024) if file.size else 1
        estimated_minutes = max(5, int(file_size_mb * 2))  # 2 minutes per MB, minimum 5 minutes
        estimated_completion = (datetime.now() + timedelta(minutes=estimated_minutes)).isoformat()
        
        return ImportJobResponse(
            success=True,
            job_id=job_id,
            status="started",
            message=f"File import started for {file.filename}",
            estimated_completion=estimated_completion
        )
        
    except Exception as e:
        logger.error(f"File import error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/import/legacy-system", response_model=ImportJobResponse)
async def import_legacy_system(
    background_tasks: BackgroundTasks,
    request: LegacySystemImportRequest
):
    """Import historical data from legacy system"""
    try:
        # Create import job
        job_id = str(uuid.uuid4())
        
        # Validate legacy system connection
        connection_valid = await legacy_connector.validate_connection(
            request.system_type,
            request.connection_config
        )
        
        if not connection_valid:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot connect to {request.system_type} system"
            )
        
        # Start background import process
        background_tasks.add_task(
            process_legacy_import,
            job_id,
            request
        )
        
        # Estimate completion time based on system type
        estimated_minutes = {
            "accubid": 30,
            "conest": 45,
            "turbobid": 25,
            "generic_erp": 60
        }.get(request.system_type, 40)
        
        estimated_completion = (datetime.now() + timedelta(minutes=estimated_minutes)).isoformat()
        
        return ImportJobResponse(
            success=True,
            job_id=job_id,
            status="started",
            message=f"Legacy system import started for {request.system_type}",
            estimated_completion=estimated_completion
        )
        
    except Exception as e:
        logger.error(f"Legacy system import error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === DATA QUALITY ENDPOINTS ===

@app.post("/api/v1/quality/analyze", response_model=APIResponse)
async def analyze_data_quality(request: DataQualityRequest):
    """Analyze data quality for imported projects"""
    try:
        # Get import job data
        import_job = await database.get_import_job(request.import_job_id)
        if not import_job:
            raise HTTPException(status_code=404, detail="Import job not found")
        
        # Run quality analysis
        quality_report = await quality_engine.analyze_import_job(
            request.import_job_id,
            threshold=request.quality_threshold,
            auto_fix=request.auto_fix
        )
        
        return APIResponse(
            success=True,
            data={
                "quality_report": quality_report.dict(),
                "overall_score": quality_report.overall_score,
                "issues_found": len(quality_report.issues),
                "auto_fixed": len(quality_report.auto_fixes),
                "manual_review_required": len(quality_report.manual_review_items)
            },
            message="Data quality analysis completed"
        )
        
    except Exception as e:
        logger.error(f"Data quality analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/quality/report/{import_job_id}", response_model=APIResponse)
async def get_quality_report(import_job_id: str):
    """Get detailed quality report for import job"""
    try:
        quality_report = await database.get_quality_report(import_job_id)
        if not quality_report:
            raise HTTPException(status_code=404, detail="Quality report not found")
        
        return APIResponse(
            success=True,
            data=quality_report,
            message="Quality report retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Quality report retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === PROJECT QUERY ENDPOINTS ===

@app.post("/api/v1/projects/search", response_model=APIResponse)
async def search_historical_projects(request: ProjectQueryRequest):
    """Search historical projects with advanced filtering"""
    try:
        # Build query from request
        query_results = await database.search_projects(
            filters=request.filters,
            date_range=request.date_range,
            project_types=request.project_types,
            cost_range=request.cost_range,
            limit=request.limit,
            offset=request.offset
        )
        
        return APIResponse(
            success=True,
            data={
                "projects": query_results["projects"],
                "total_count": query_results["total_count"],
                "filtered_count": query_results["filtered_count"],
                "pagination": {
                    "limit": request.limit,
                    "offset": request.offset,
                    "has_more": query_results["filtered_count"] > (request.offset + request.limit)
                }
            },
            message=f"Found {query_results['filtered_count']} matching projects"
        )
        
    except Exception as e:
        logger.error(f"Project search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/projects/{project_id}", response_model=APIResponse)
async def get_project_details(project_id: str):
    """Get detailed information for a specific historical project"""
    try:
        project = await database.get_project_by_id(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        return APIResponse(
            success=True,
            data=project.dict(),
            message="Project details retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Project details error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === ANALYSIS ENDPOINTS ===

@app.post("/api/v1/analysis/historical", response_model=APIResponse)
async def run_historical_analysis(request: HistoricalAnalysisRequest):
    """Run historical analysis on project data"""
    try:
        analysis_result = await cost_analyzer.run_analysis(
            analysis_type=request.analysis_type,
            parameters=request.parameters,
            time_period=request.time_period
        )
        
        return APIResponse(
            success=True,
            data=analysis_result,
            message=f"Historical {request.analysis_type} analysis completed"
        )
        
    except Exception as e:
        logger.error(f"Historical analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/analysis/trends", response_model=APIResponse)
async def get_cost_trends():
    """Get historical cost and productivity trends"""
    try:
        trends = await cost_analyzer.get_cost_trends()
        
        return APIResponse(
            success=True,
            data=trends,
            message="Cost trends retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Cost trends error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === JOB MONITORING ENDPOINTS ===

@app.get("/api/v1/jobs/{job_id}/status", response_model=APIResponse)
async def get_job_status(job_id: str):
    """Get status of import job"""
    try:
        job_status = await database.get_import_job_status(job_id)
        if not job_status:
            raise HTTPException(status_code=404, detail="Import job not found")
        
        return APIResponse(
            success=True,
            data=job_status,
            message="Job status retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Job status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/jobs/active", response_model=APIResponse)
async def get_active_jobs():
    """Get list of active import jobs"""
    try:
        active_jobs = await database.get_active_jobs()
        
        return APIResponse(
            success=True,
            data={
                "active_jobs": active_jobs,
                "total_active": len(active_jobs)
            },
            message="Active jobs retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Active jobs error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === UTILITY FUNCTIONS ===

async def save_uploaded_file(file: UploadFile, job_id: str) -> str:
    """Save uploaded file to storage"""
    upload_dir = Path("./uploads")
    upload_dir.mkdir(exist_ok=True)
    
    file_extension = Path(file.filename).suffix
    file_path = upload_dir / f"{job_id}{file_extension}"
    
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
    
    return str(file_path)

async def get_active_import_count() -> int:
    """Get count of active import jobs"""
    try:
        return await database.get_active_import_count()
    except:
        return 0

# === BACKGROUND TASKS ===

async def process_file_import(job_id: str, file_path: str, request: FileImportRequest):
    """Background task for file import processing"""
    try:
        logger.info(f"Starting file import job {job_id}")
        
        # Update job status
        await database.update_job_status(job_id, "processing", "File import in progress")
        
        # Import the file
        import_result = await importer.import_file(
            file_path=file_path,
            file_format=request.file_format,
            validation_rules=request.validation_rules
        )
        
        # Classify imported projects
        if import_result.projects:
            for project in import_result.projects:
                classification = await classifier.classify_project(project)
                project.classification = classification
        
        # Run quality analysis
        quality_report = await quality_engine.analyze_projects(import_result.projects)
        
        # Store results in database
        await database.store_import_results(job_id, import_result, quality_report)
        
        # Update job status
        await database.update_job_status(
            job_id, 
            "completed", 
            f"Successfully imported {len(import_result.projects)} projects"
        )
        
        logger.info(f"File import job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"File import job {job_id} failed: {e}")
        await database.update_job_status(job_id, "failed", str(e))

async def process_legacy_import(job_id: str, request: LegacySystemImportRequest):
    """Background task for legacy system import processing"""
    try:
        logger.info(f"Starting legacy system import job {job_id}")
        
        # Update job status
        await database.update_job_status(job_id, "processing", "Legacy system import in progress")
        
        # Connect to legacy system and import data
        import_result = await legacy_connector.import_data(
            system_type=request.system_type,
            connection_config=request.connection_config,
            import_parameters=request.import_parameters
        )
        
        # Classify imported projects
        if import_result.projects:
            for project in import_result.projects:
                classification = await classifier.classify_project(project)
                project.classification = classification
        
        # Run quality analysis
        quality_report = await quality_engine.analyze_projects(import_result.projects)
        
        # Store results in database
        await database.store_import_results(job_id, import_result, quality_report)
        
        # Update job status
        await database.update_job_status(
            job_id, 
            "completed", 
            f"Successfully imported {len(import_result.projects)} projects from {request.system_type}"
        )
        
        logger.info(f"Legacy system import job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Legacy system import job {job_id} failed: {e}")
        await database.update_job_status(job_id, "failed", str(e))

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting Historical Data Import Service...")
    
    try:
        # Initialize database
        await database.initialize()
        logger.info("✓ Database initialized")
        
        # Initialize import engine
        await importer.initialize()
        logger.info("✓ Import engine initialized")
        
        # Initialize legacy connectors
        await legacy_connector.initialize()
        logger.info("✓ Legacy system connectors initialized")
        
        # Initialize quality engine
        await quality_engine.initialize()
        logger.info("✓ Data quality engine initialized")
        
        # Initialize classifier
        await classifier.initialize()
        logger.info("✓ Project classifier initialized")
        
        # Initialize cost analyzer
        await cost_analyzer.initialize()
        logger.info("✓ Cost analyzer initialized")
        
        logger.info("Historical Data Import Service ready!")
        
    except Exception as e:
        logger.error(f"Failed to initialize service: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown"""
    logger.info("Shutting down Historical Data Import Service...")
    
    # Close database connections
    await database.close()
    
    # Clean up import engine
    await importer.close()
    
    # Close legacy connectors
    await legacy_connector.close()
    
    logger.info("Historical Data Import Service shutdown complete")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8007)
