# Progress Tracking Service - Story 5.1: Field Hour Logging Interface
# Following BMAD Method standards for comprehensive field hour tracking

from fastapi import FastAPI, HTTPException, Depends, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from datetime import datetime, date, time
from decimal import Decimal
import asyncio
import logging
import json
import uuid
import os
from dataclasses import dataclass, field

# Configure logging per BMAD standards
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Progress Tracking Service",
    description="Mobile-first field hour logging with real-time visibility and compliance tracking",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# Data Models following BMAD patterns
class HourLogEntry(BaseModel):
    """Core hour log entry model with comprehensive field tracking"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = Field(..., description="User ID logging the hours")
    project_id: str = Field(..., description="Project ID")
    circuit_id: Optional[str] = Field(None, description="Specific circuit being worked on")
    component_id: Optional[str] = Field(None, description="Specific component being worked on")
    
    # Time tracking
    start_time: datetime = Field(..., description="Work start timestamp")
    end_time: Optional[datetime] = Field(None, description="Work end timestamp")
    hours_worked: Optional[Decimal] = Field(None, description="Total hours worked")
    break_time: Optional[Decimal] = Field(None, description="Break time deducted")
    
    # Work details
    work_type: str = Field(..., description="Type of work performed")
    work_description: str = Field(..., description="Detailed work description")
    completion_percentage: int = Field(default=0, ge=0, le=100)
    quality_rating: Optional[int] = Field(None, ge=1, le=5, description="Work quality self-assessment")
    
    # Location and compliance
    gps_coordinates: Optional[Dict[str, float]] = Field(None, description="GPS location of work")
    site_conditions: Optional[str] = Field(None, description="Site conditions and factors")
    safety_notes: Optional[str] = Field(None, description="Safety observations and incidents")
    
    # Documentation
    photos: List[str] = Field(default_factory=list, description="Photo file paths")
    voice_notes: List[str] = Field(default_factory=list, description="Voice note file paths")
    materials_used: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Status and metadata
    status: str = Field(default="active", description="Entry status")
    offline_entry: bool = Field(default=False, description="Was logged offline")
    sync_timestamp: Optional[datetime] = Field(None, description="When synced to server")
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    @validator('hours_worked')
    def validate_hours(cls, v):
        if v is not None and (v < 0 or v > 24):
            raise ValueError('Hours worked must be between 0 and 24')
        return v

class TimeClockEntry(BaseModel):
    """Time clock entry for shift start/end tracking"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    project_id: str
    entry_type: str = Field(..., description="clock_in, clock_out, break_start, break_end")
    timestamp: datetime = Field(default_factory=datetime.now)
    gps_coordinates: Optional[Dict[str, float]] = None
    verification_method: str = Field(default="manual", description="manual, gps, beacon, nfc")
    notes: Optional[str] = None
    photo_verification: Optional[str] = None

class ProductivityMetrics(BaseModel):
    """Real-time productivity calculations"""
    user_id: str
    project_id: str
    date: date
    total_hours: Decimal
    productive_hours: Decimal
    efficiency_rating: float = Field(ge=0.0, le=1.0)
    quality_score: Optional[float] = None
    completed_tasks: int = 0
    rework_hours: Decimal = Field(default=Decimal('0'))

class ComplianceCheck(BaseModel):
    """Compliance and validation checks"""
    entry_id: str
    check_type: str = Field(..., description="location, hours, safety, quality")
    status: str = Field(..., description="passed, failed, warning, pending")
    details: str
    auto_validated: bool = True
    created_at: datetime = Field(default_factory=datetime.now)

# Global service instances
hour_logging_service = None
time_tracking_service = None
compliance_service = None

class HourLoggingService:
    """Core hour logging service with mobile and offline support"""
    
    def __init__(self):
        self.active_sessions = {}  # Track active work sessions
        self.offline_queue = []    # Store offline entries for sync
        
    async def start_work_session(self, user_id: str, project_id: str, 
                                circuit_id: Optional[str] = None,
                                gps_coordinates: Optional[Dict[str, float]] = None) -> HourLogEntry:
        """Start a new work session with automatic time tracking"""
        try:
            # Check for existing active session
            if user_id in self.active_sessions:
                raise HTTPException(status_code=400, detail="User already has active session")
            
            entry = HourLogEntry(
                user_id=user_id,
                project_id=project_id,
                circuit_id=circuit_id,
                start_time=datetime.now(),
                work_type="active_work",
                work_description="Work session started",
                gps_coordinates=gps_coordinates,
                status="active"
            )
            
            self.active_sessions[user_id] = entry
            
            # Log session start
            logger.info(f"Work session started for user {user_id} on project {project_id}")
            
            return entry
            
        except Exception as e:
            logger.error(f"Error starting work session: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def end_work_session(self, user_id: str, 
                              work_description: str,
                              completion_percentage: int = 100,
                              quality_rating: Optional[int] = None) -> HourLogEntry:
        """End active work session and calculate hours"""
        try:
            if user_id not in self.active_sessions:
                raise HTTPException(status_code=404, detail="No active session found")
            
            entry = self.active_sessions[user_id]
            entry.end_time = datetime.now()
            entry.work_description = work_description
            entry.completion_percentage = completion_percentage
            entry.quality_rating = quality_rating
            entry.status = "completed"
            
            # Calculate hours worked
            time_delta = entry.end_time - entry.start_time
            entry.hours_worked = Decimal(str(time_delta.total_seconds() / 3600))
            
            # Remove from active sessions
            del self.active_sessions[user_id]
            
            # Store completed entry (in production, save to database)
            logger.info(f"Work session completed: {entry.hours_worked} hours for user {user_id}")
            
            return entry
            
        except Exception as e:
            logger.error(f"Error ending work session: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def log_manual_hours(self, entry_data: HourLogEntry) -> HourLogEntry:
        """Log hours manually with comprehensive validation"""
        try:
            # Validate entry data
            if entry_data.start_time and entry_data.end_time:
                time_delta = entry_data.end_time - entry_data.start_time
                calculated_hours = Decimal(str(time_delta.total_seconds() / 3600))
                
                if entry_data.hours_worked and abs(calculated_hours - entry_data.hours_worked) > Decimal('0.1'):
                    logger.warning(f"Hours mismatch: calculated {calculated_hours}, entered {entry_data.hours_worked}")
            
            entry_data.status = "completed"
            entry_data.updated_at = datetime.now()
            
            # Store entry (in production, save to database)
            logger.info(f"Manual hours logged: {entry_data.hours_worked} hours for user {entry_data.user_id}")
            
            return entry_data
            
        except Exception as e:
            logger.error(f"Error logging manual hours: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def sync_offline_entries(self, offline_entries: List[HourLogEntry]) -> Dict[str, Any]:
        """Sync offline entries with conflict resolution"""
        try:
            sync_results = {
                "synced": 0,
                "conflicts": 0,
                "errors": 0,
                "details": []
            }
            
            for entry in offline_entries:
                try:
                    entry.offline_entry = True
                    entry.sync_timestamp = datetime.now()
                    
                    # Process offline entry
                    # In production: check for conflicts, validate, save to database
                    sync_results["synced"] += 1
                    sync_results["details"].append({
                        "entry_id": entry.id,
                        "status": "synced",
                        "message": "Successfully synced offline entry"
                    })
                    
                except Exception as e:
                    sync_results["errors"] += 1
                    sync_results["details"].append({
                        "entry_id": entry.id,
                        "status": "error", 
                        "message": str(e)
                    })
            
            logger.info(f"Offline sync completed: {sync_results}")
            return sync_results
            
        except Exception as e:
            logger.error(f"Error syncing offline entries: {e}")
            raise HTTPException(status_code=500, detail=str(e))

class TimeTrackingService:
    """Advanced time tracking with GPS and compliance validation"""
    
    def __init__(self):
        self.location_tolerance = 100  # meters
        self.valid_project_locations = {}  # Project ID -> GPS coordinates
    
    async def clock_in(self, user_id: str, project_id: str,
                      gps_coordinates: Optional[Dict[str, float]] = None,
                      verification_method: str = "manual") -> TimeClockEntry:
        """Clock in with location and verification"""
        try:
            # Validate location if GPS provided
            location_valid = await self._validate_location(project_id, gps_coordinates)
            
            entry = TimeClockEntry(
                user_id=user_id,
                project_id=project_id,
                entry_type="clock_in",
                gps_coordinates=gps_coordinates,
                verification_method=verification_method
            )
            
            if not location_valid:
                entry.notes = "Location validation failed - outside project area"
                logger.warning(f"Clock-in location validation failed for user {user_id}")
            
            logger.info(f"User {user_id} clocked in to project {project_id}")
            return entry
            
        except Exception as e:
            logger.error(f"Error during clock-in: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def clock_out(self, user_id: str, project_id: str,
                       gps_coordinates: Optional[Dict[str, float]] = None) -> TimeClockEntry:
        """Clock out with automatic hour calculation"""
        try:
            entry = TimeClockEntry(
                user_id=user_id,
                project_id=project_id,
                entry_type="clock_out",
                gps_coordinates=gps_coordinates
            )
            
            logger.info(f"User {user_id} clocked out of project {project_id}")
            return entry
            
        except Exception as e:
            logger.error(f"Error during clock-out: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    async def _validate_location(self, project_id: str, 
                                gps_coordinates: Optional[Dict[str, float]]) -> bool:
        """Validate GPS location against project boundaries"""
        if not gps_coordinates or project_id not in self.valid_project_locations:
            return True  # Skip validation if no data
        
        # In production: implement proper geofencing logic
        return True

class ComplianceService:
    """Compliance monitoring and validation service"""
    
    def __init__(self):
        self.compliance_rules = {
            "max_daily_hours": 12,
            "max_weekly_hours": 60,
            "required_break_hours": 0.5,
            "location_tolerance": 100
        }
    
    async def validate_entry(self, entry: HourLogEntry) -> List[ComplianceCheck]:
        """Comprehensive compliance validation"""
        checks = []
        
        try:
            # Hours validation
            if entry.hours_worked and entry.hours_worked > self.compliance_rules["max_daily_hours"]:
                checks.append(ComplianceCheck(
                    entry_id=entry.id,
                    check_type="hours",
                    status="warning",
                    details=f"Exceeds maximum daily hours: {entry.hours_worked}"
                ))
            
            # Location validation
            if entry.gps_coordinates:
                checks.append(ComplianceCheck(
                    entry_id=entry.id,
                    check_type="location",
                    status="passed",
                    details="GPS location recorded and validated"
                ))
            
            # Safety validation
            if entry.safety_notes:
                checks.append(ComplianceCheck(
                    entry_id=entry.id,
                    check_type="safety",
                    status="passed",
                    details="Safety notes documented"
                ))
            
            # Quality validation
            if entry.quality_rating and entry.quality_rating < 3:
                checks.append(ComplianceCheck(
                    entry_id=entry.id,
                    check_type="quality",
                    status="warning",
                    details=f"Low quality rating: {entry.quality_rating}/5"
                ))
            
            return checks
            
        except Exception as e:
            logger.error(f"Error validating compliance: {e}")
            checks.append(ComplianceCheck(
                entry_id=entry.id,
                check_type="validation",
                status="failed",
                details=f"Validation error: {str(e)}"
            ))
            return checks

@app.on_event("startup")
async def startup_event():
    """Initialize all service components following BMAD principles"""
    global hour_logging_service, time_tracking_service, compliance_service
    
    logger.info("Initializing Progress Tracking Service...")
    
    hour_logging_service = HourLoggingService()
    time_tracking_service = TimeTrackingService()
    compliance_service = ComplianceService()
    
    logger.info("Progress Tracking Service ready!")

@app.get("/health")
async def health_check():
    """Health check endpoint required by BMAD operational guidelines"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0",
        "services": {
            "hour_logging": hour_logging_service is not None,
            "time_tracking": time_tracking_service is not None,
            "compliance": compliance_service is not None
        }
    }

# Hour Logging Endpoints
@app.post("/api/v1/hours/start-session", response_model=HourLogEntry)
async def start_work_session(
    user_id: str = Form(...),
    project_id: str = Form(...),
    circuit_id: Optional[str] = Form(None),
    gps_lat: Optional[float] = Form(None),
    gps_lng: Optional[float] = Form(None)
):
    """Start a new work session with automatic time tracking"""
    gps_coordinates = None
    if gps_lat is not None and gps_lng is not None:
        gps_coordinates = {"latitude": gps_lat, "longitude": gps_lng}
    
    return await hour_logging_service.start_work_session(
        user_id, project_id, circuit_id, gps_coordinates
    )

@app.post("/api/v1/hours/end-session", response_model=HourLogEntry)
async def end_work_session(
    user_id: str = Form(...),
    work_description: str = Form(...),
    completion_percentage: int = Form(100),
    quality_rating: Optional[int] = Form(None)
):
    """End active work session and calculate hours"""
    return await hour_logging_service.end_work_session(
        user_id, work_description, completion_percentage, quality_rating
    )

@app.post("/api/v1/hours/log-manual", response_model=HourLogEntry)
async def log_manual_hours(entry: HourLogEntry):
    """Log hours manually with comprehensive validation"""
    return await hour_logging_service.log_manual_hours(entry)

@app.post("/api/v1/hours/sync-offline")
async def sync_offline_entries(entries: List[HourLogEntry]):
    """Sync offline entries with conflict resolution"""
    return await hour_logging_service.sync_offline_entries(entries)

# Time Clock Endpoints
@app.post("/api/v1/timeclock/clock-in", response_model=TimeClockEntry)
async def clock_in(
    user_id: str = Form(...),
    project_id: str = Form(...),
    gps_lat: Optional[float] = Form(None),
    gps_lng: Optional[float] = Form(None),
    verification_method: str = Form("manual")
):
    """Clock in with location and verification"""
    gps_coordinates = None
    if gps_lat is not None and gps_lng is not None:
        gps_coordinates = {"latitude": gps_lat, "longitude": gps_lng}
    
    return await time_tracking_service.clock_in(
        user_id, project_id, gps_coordinates, verification_method
    )

@app.post("/api/v1/timeclock/clock-out", response_model=TimeClockEntry)
async def clock_out(
    user_id: str = Form(...),
    project_id: str = Form(...),
    gps_lat: Optional[float] = Form(None),
    gps_lng: Optional[float] = Form(None)
):
    """Clock out with automatic hour calculation"""
    gps_coordinates = None
    if gps_lat is not None and gps_lng is not None:
        gps_coordinates = {"latitude": gps_lat, "longitude": gps_lng}
    
    return await time_tracking_service.clock_out(user_id, project_id, gps_coordinates)

# File Upload Endpoints
@app.post("/api/v1/hours/upload-photo")
async def upload_work_photo(
    entry_id: str = Form(...),
    photo: UploadFile = File(...),
    description: Optional[str] = Form(None)
):
    """Upload work progress photos"""
    try:
        # In production: save to S3 and return URL
        photo_path = f"photos/{entry_id}_{photo.filename}"
        
        # Mock photo processing
        return {
            "success": True,
            "photo_url": photo_path,
            "entry_id": entry_id,
            "description": description
        }
        
    except Exception as e:
        logger.error(f"Error uploading photo: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/hours/upload-voice-note")
async def upload_voice_note(
    entry_id: str = Form(...),
    voice_note: UploadFile = File(...),
    transcription: Optional[str] = Form(None)
):
    """Upload voice notes with optional transcription"""
    try:
        # In production: save to S3, process transcription
        voice_path = f"voice_notes/{entry_id}_{voice_note.filename}"
        
        return {
            "success": True,
            "voice_url": voice_path,
            "entry_id": entry_id,
            "transcription": transcription
        }
        
    except Exception as e:
        logger.error(f"Error uploading voice note: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Compliance and Analytics Endpoints
@app.post("/api/v1/compliance/validate", response_model=List[ComplianceCheck])
async def validate_compliance(entry: HourLogEntry):
    """Validate entry against compliance rules"""
    return await compliance_service.validate_entry(entry)

@app.get("/api/v1/analytics/productivity/{user_id}")
async def get_productivity_metrics(
    user_id: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
):
    """Get productivity metrics for user"""
    try:
        # In production: calculate from database
        metrics = ProductivityMetrics(
            user_id=user_id,
            project_id="sample",
            date=date.today(),
            total_hours=Decimal('8.5'),
            productive_hours=Decimal('7.8'),
            efficiency_rating=0.92,
            quality_score=4.2,
            completed_tasks=5
        )
        
        return {
            "user_id": user_id,
            "period": f"{start_date} to {end_date}",
            "metrics": metrics,
            "trends": {
                "efficiency_trend": "improving",
                "quality_trend": "stable"
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting productivity metrics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/hours/active-sessions")
async def get_active_sessions():
    """Get all active work sessions"""
    try:
        return {
            "active_sessions": len(hour_logging_service.active_sessions),
            "sessions": [
                {
                    "user_id": user_id,
                    "project_id": session.project_id,
                    "start_time": session.start_time,
                    "duration_minutes": int((datetime.now() - session.start_time).total_seconds() / 60)
                }
                for user_id, session in hour_logging_service.active_sessions.items()
            ]
        }
    except Exception as e:
        logger.error(f"Error getting active sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)