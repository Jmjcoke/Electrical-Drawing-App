"""
AI-Powered Man-Hour Estimation Service
Story 4.2: Revolutionary AI-powered estimation engine for electrical projects
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
import json
import logging
from datetime import datetime, date
import asyncio
import uuid
import numpy as np
from pathlib import Path

# Import our estimation modules
from algorithms.estimation_engine import AIEstimationEngine
from algorithms.complexity_analyzer import ProjectComplexityAnalyzer
from algorithms.productivity_modeler import LaborProductivityModeler
from ml_models.neural_estimator import NeuralEstimationModel
from ml_models.ensemble_predictor import EnsemblePredictor
from historical_analysis.pattern_analyzer import HistoricalPatternAnalyzer
from validation.estimate_validator import EstimateValidator
from data_models import (
    EstimationRequest, EstimationResult, ProjectComplexity,
    LaborEstimate, ComponentEstimate, EstimationConfidence
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="AI-Powered Estimation Engine",
    description="Revolutionary AI-powered man-hour estimation for electrical projects - Story 4.2",
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
estimation_engine = AIEstimationEngine()
complexity_analyzer = ProjectComplexityAnalyzer()
productivity_modeler = LaborProductivityModeler()
neural_model = NeuralEstimationModel()
ensemble_predictor = EnsemblePredictor()
pattern_analyzer = HistoricalPatternAnalyzer()
estimate_validator = EstimateValidator()

# Request/Response models
class QuickEstimateRequest(BaseModel):
    """Quick estimation request for preliminary estimates"""
    project_type: str = Field(..., description="Type of project")
    total_area: Optional[float] = Field(None, description="Total project area in sq ft")
    voltage_level: str = Field(..., description="Primary voltage level")
    component_count: Optional[int] = Field(None, description="Estimated component count")
    complexity_level: str = Field("medium", description="Project complexity: low, medium, high")
    location: Dict[str, str] = Field(..., description="Project location information")
    timeline_months: Optional[float] = Field(None, description="Project timeline in months")

class DetailedEstimateRequest(BaseModel):
    """Detailed estimation request with full project data"""
    project_id: str = Field(..., description="Unique project identifier")
    project_name: str = Field(..., description="Project name")
    client_name: str = Field(..., description="Client name")
    
    # Project characteristics
    project_type: str = Field(..., description="Type of electrical project")
    industry_category: str = Field(..., description="Industry category")
    location: Dict[str, Any] = Field(..., description="Project location with geographic data")
    
    # Technical specifications
    drawings: List[Dict[str, Any]] = Field(default=[], description="Project drawings and PDFs")
    specifications: Dict[str, Any] = Field(default={}, description="Technical specifications")
    components: List[Dict[str, Any]] = Field(default=[], description="Identified electrical components")
    circuits: List[Dict[str, Any]] = Field(default=[], description="Circuit information")
    
    # Project constraints
    timeline: Dict[str, Any] = Field(..., description="Project timeline information")
    budget_constraints: Optional[Dict[str, float]] = Field(None, description="Budget constraints")
    site_conditions: Dict[str, Any] = Field(default={}, description="Site condition factors")
    
    # Estimation preferences
    confidence_level: float = Field(0.80, description="Desired confidence level (0.5-0.95)")
    include_contingency: bool = Field(True, description="Include contingency in estimates")
    breakdown_level: str = Field("component", description="Level of detail: component, assembly, phase")
    
    @validator('confidence_level')
    def validate_confidence(cls, v):
        if v < 0.5 or v > 0.95:
            raise ValueError('Confidence level must be between 0.5 and 0.95')
        return v

class ComponentEstimateRequest(BaseModel):
    """Component-level estimation request"""
    components: List[Dict[str, Any]] = Field(..., description="List of components to estimate")
    installation_method: Optional[str] = Field(None, description="Preferred installation method")
    crew_composition: Optional[Dict[str, int]] = Field(None, description="Crew composition")
    site_factors: Dict[str, Any] = Field(default={}, description="Site-specific factors")

class EstimationUpdateRequest(BaseModel):
    """Request to update existing estimate"""
    estimation_id: str = Field(..., description="Existing estimation ID")
    updates: Dict[str, Any] = Field(..., description="Updates to apply")
    recalculate: bool = Field(True, description="Whether to recalculate the estimate")

class EstimationValidationRequest(BaseModel):
    """Request to validate estimate against actual data"""
    estimation_id: str = Field(..., description="Estimation to validate")
    actual_hours: Dict[str, float] = Field(..., description="Actual hours by labor type")
    actual_costs: Dict[str, float] = Field(..., description="Actual costs")
    completion_date: date = Field(..., description="Actual completion date")
    notes: Optional[str] = Field(None, description="Validation notes")

# Response models
class APIResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    message: str
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())

class EstimationResponse(BaseModel):
    success: bool
    estimation_id: str
    estimate: Dict[str, Any]
    confidence: Dict[str, float]
    breakdown: Dict[str, Any]
    recommendations: List[str]
    processing_time: float
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())

# Health check endpoint
@app.get("/health", response_model=APIResponse)
async def health_check():
    """Health check endpoint with AI model status"""
    try:
        # Check all service components
        engine_status = await estimation_engine.health_check()
        model_status = await neural_model.health_check()
        
        return APIResponse(
            success=True,
            data={
                "status": "healthy",
                "service": "ai-estimation-engine",
                "version": "1.0.0",
                "engine_status": engine_status,
                "model_status": model_status,
                "models_loaded": await get_loaded_models_count()
            },
            message="AI Estimation Engine is healthy and ready"
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")

# === ESTIMATION ENDPOINTS ===

@app.post("/api/v1/estimate/quick", response_model=EstimationResponse)
async def quick_estimate(request: QuickEstimateRequest):
    """Generate quick preliminary estimate for project planning"""
    start_time = datetime.now()
    
    try:
        logger.info(f"Processing quick estimate for {request.project_type}")
        
        # Analyze project complexity
        complexity = await complexity_analyzer.analyze_quick(
            project_type=request.project_type,
            area=request.total_area,
            voltage_level=request.voltage_level,
            complexity_level=request.complexity_level
        )
        
        # Generate quick estimate
        estimate = await estimation_engine.quick_estimate(
            request=request,
            complexity=complexity
        )
        
        # Calculate confidence metrics
        confidence = await estimate_validator.calculate_quick_confidence(estimate, complexity)
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        return EstimationResponse(
            success=True,
            estimation_id=str(uuid.uuid4()),
            estimate=estimate.dict(),
            confidence=confidence,
            breakdown=estimate.breakdown,
            recommendations=estimate.recommendations,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Quick estimation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/estimate/detailed", response_model=EstimationResponse)
async def detailed_estimate(request: DetailedEstimateRequest):
    """Generate comprehensive detailed estimate with AI analysis"""
    start_time = datetime.now()
    
    try:
        logger.info(f"Processing detailed estimate for project {request.project_name}")
        
        # Comprehensive complexity analysis
        complexity = await complexity_analyzer.analyze_detailed(
            project_data=request.dict(),
            drawings=request.drawings,
            specifications=request.specifications,
            components=request.components
        )
        
        # Productivity modeling
        productivity_factors = await productivity_modeler.analyze_project(
            location=request.location,
            timeline=request.timeline,
            site_conditions=request.site_conditions,
            complexity=complexity
        )
        
        # Generate AI-powered estimate
        estimate = await estimation_engine.detailed_estimate(
            request=request,
            complexity=complexity,
            productivity_factors=productivity_factors
        )
        
        # Validate and calibrate estimate
        validated_estimate = await estimate_validator.validate_and_calibrate(
            estimate=estimate,
            project_data=request.dict(),
            confidence_level=request.confidence_level
        )
        
        # Find similar historical projects for comparison
        similar_projects = await pattern_analyzer.find_similar_projects(
            project_characteristics=complexity.characteristics,
            limit=5
        )
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        return EstimationResponse(
            success=True,
            estimation_id=validated_estimate.estimation_id,
            estimate=validated_estimate.dict(),
            confidence=validated_estimate.confidence_metrics,
            breakdown=validated_estimate.breakdown,
            recommendations=validated_estimate.recommendations + 
                          [f"Similar project: {p['name']} ({p['accuracy']:.1%} match)" for p in similar_projects],
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Detailed estimation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/estimate/component-level", response_model=EstimationResponse)
async def component_level_estimate(request: ComponentEstimateRequest):
    """Generate component-level estimates with installation analysis"""
    start_time = datetime.now()
    
    try:
        logger.info(f"Processing component-level estimate for {len(request.components)} components")
        
        # Analyze each component
        component_estimates = []
        for component in request.components:
            # Get component complexity
            comp_complexity = await complexity_analyzer.analyze_component(
                component=component,
                installation_method=request.installation_method,
                site_factors=request.site_factors
            )
            
            # Generate component estimate
            comp_estimate = await estimation_engine.estimate_component(
                component=component,
                complexity=comp_complexity,
                crew_composition=request.crew_composition
            )
            
            component_estimates.append(comp_estimate)
        
        # Aggregate estimates
        total_estimate = await estimation_engine.aggregate_component_estimates(
            component_estimates=component_estimates,
            site_factors=request.site_factors
        )
        
        # Calculate confidence
        confidence = await estimate_validator.calculate_component_confidence(
            component_estimates, total_estimate
        )
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        return EstimationResponse(
            success=True,
            estimation_id=str(uuid.uuid4()),
            estimate=total_estimate.dict(),
            confidence=confidence,
            breakdown={
                "components": [ce.dict() for ce in component_estimates],
                "totals": total_estimate.totals
            },
            recommendations=total_estimate.recommendations,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Component estimation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === REAL-TIME ESTIMATION ENDPOINTS ===

@app.put("/api/v1/estimate/{estimation_id}/update", response_model=EstimationResponse)
async def update_estimate(estimation_id: str, request: EstimationUpdateRequest):
    """Update existing estimate with new information"""
    try:
        logger.info(f"Updating estimate {estimation_id}")
        
        # Get existing estimate
        existing_estimate = await estimation_engine.get_estimate(estimation_id)
        if not existing_estimate:
            raise HTTPException(status_code=404, detail="Estimate not found")
        
        # Apply updates
        updated_estimate = await estimation_engine.update_estimate(
            existing_estimate=existing_estimate,
            updates=request.updates,
            recalculate=request.recalculate
        )
        
        # Recalculate confidence if needed
        if request.recalculate:
            confidence = await estimate_validator.recalculate_confidence(updated_estimate)
            updated_estimate.confidence_metrics = confidence
        
        return EstimationResponse(
            success=True,
            estimation_id=estimation_id,
            estimate=updated_estimate.dict(),
            confidence=updated_estimate.confidence_metrics,
            breakdown=updated_estimate.breakdown,
            recommendations=updated_estimate.recommendations,
            processing_time=0.0  # Minimal processing for updates
        )
        
    except Exception as e:
        logger.error(f"Estimate update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/estimate/{estimation_id}", response_model=APIResponse)
async def get_estimate(estimation_id: str):
    """Retrieve existing estimate by ID"""
    try:
        estimate = await estimation_engine.get_estimate(estimation_id)
        if not estimate:
            raise HTTPException(status_code=404, detail="Estimate not found")
        
        return APIResponse(
            success=True,
            data=estimate.dict(),
            message="Estimate retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Estimate retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === VALIDATION AND LEARNING ENDPOINTS ===

@app.post("/api/v1/estimate/validate", response_model=APIResponse)
async def validate_estimate(request: EstimationValidationRequest):
    """Validate estimate against actual project performance"""
    try:
        logger.info(f"Validating estimate {request.estimation_id}")
        
        # Perform validation analysis
        validation_result = await estimate_validator.validate_against_actual(
            estimation_id=request.estimation_id,
            actual_hours=request.actual_hours,
            actual_costs=request.actual_costs,
            completion_date=request.completion_date,
            notes=request.notes
        )
        
        # Update model learning
        await neural_model.update_with_validation(validation_result)
        
        return APIResponse(
            success=True,
            data=validation_result.dict(),
            message="Estimate validation completed and models updated"
        )
        
    except Exception as e:
        logger.error(f"Estimate validation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === ANALYTICS AND REPORTING ENDPOINTS ===

@app.get("/api/v1/analytics/accuracy", response_model=APIResponse)
async def get_estimation_accuracy():
    """Get estimation accuracy metrics and trends"""
    try:
        accuracy_metrics = await estimate_validator.get_accuracy_metrics()
        
        return APIResponse(
            success=True,
            data=accuracy_metrics,
            message="Accuracy metrics retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Accuracy metrics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/analytics/model-performance", response_model=APIResponse)
async def get_model_performance():
    """Get AI model performance metrics"""
    try:
        performance_metrics = await neural_model.get_performance_metrics()
        ensemble_metrics = await ensemble_predictor.get_performance_metrics()
        
        return APIResponse(
            success=True,
            data={
                "neural_model": performance_metrics,
                "ensemble_model": ensemble_metrics,
                "combined_performance": await estimation_engine.get_combined_performance()
            },
            message="Model performance metrics retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Model performance error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/analytics/productivity-trends", response_model=APIResponse)
async def get_productivity_trends(
    project_type: Optional[str] = Query(None, description="Filter by project type"),
    time_period: Optional[str] = Query("1y", description="Time period: 3m, 6m, 1y, 2y"),
    region: Optional[str] = Query(None, description="Filter by region")
):
    """Get labor productivity trends and analysis"""
    try:
        trends = await productivity_modeler.get_productivity_trends(
            project_type=project_type,
            time_period=time_period,
            region=region
        )
        
        return APIResponse(
            success=True,
            data=trends,
            message="Productivity trends retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Productivity trends error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === MODEL MANAGEMENT ENDPOINTS ===

@app.post("/api/v1/models/retrain", response_model=APIResponse)
async def retrain_models(background_tasks: BackgroundTasks):
    """Trigger model retraining with latest data"""
    try:
        # Start background retraining
        background_tasks.add_task(perform_model_retraining)
        
        return APIResponse(
            success=True,
            data={"status": "retraining_started"},
            message="Model retraining started in background"
        )
        
    except Exception as e:
        logger.error(f"Model retraining error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/models/status", response_model=APIResponse)
async def get_model_status():
    """Get current status of all AI models"""
    try:
        status = {
            "neural_estimator": await neural_model.get_status(),
            "ensemble_predictor": await ensemble_predictor.get_status(),
            "complexity_analyzer": await complexity_analyzer.get_status(),
            "productivity_modeler": await productivity_modeler.get_status()
        }
        
        return APIResponse(
            success=True,
            data=status,
            message="Model status retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Model status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === UTILITY FUNCTIONS ===

async def get_loaded_models_count() -> int:
    """Get count of loaded AI models"""
    try:
        count = 0
        if await neural_model.is_loaded():
            count += 1
        if await ensemble_predictor.is_loaded():
            count += 1
        return count
    except:
        return 0

async def perform_model_retraining():
    """Background task for model retraining"""
    try:
        logger.info("Starting model retraining...")
        
        # Retrain neural model
        await neural_model.retrain()
        
        # Retrain ensemble predictor
        await ensemble_predictor.retrain()
        
        # Update complexity analyzer
        await complexity_analyzer.update_models()
        
        logger.info("Model retraining completed successfully")
        
    except Exception as e:
        logger.error(f"Model retraining failed: {e}")

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize AI estimation services on startup"""
    logger.info("Starting AI-Powered Estimation Engine...")
    
    try:
        # Initialize core estimation engine
        await estimation_engine.initialize()
        logger.info("✓ AI Estimation Engine initialized")
        
        # Initialize complexity analyzer
        await complexity_analyzer.initialize()
        logger.info("✓ Project Complexity Analyzer initialized")
        
        # Initialize productivity modeler
        await productivity_modeler.initialize()
        logger.info("✓ Labor Productivity Modeler initialized")
        
        # Load AI models
        await neural_model.load_models()
        logger.info("✓ Neural Estimation Model loaded")
        
        await ensemble_predictor.load_models()
        logger.info("✓ Ensemble Predictor loaded")
        
        # Initialize pattern analyzer
        await pattern_analyzer.initialize()
        logger.info("✓ Historical Pattern Analyzer initialized")
        
        # Initialize validator
        await estimate_validator.initialize()
        logger.info("✓ Estimate Validator initialized")
        
        logger.info("AI-Powered Estimation Engine ready!")
        
    except Exception as e:
        logger.error(f"Failed to initialize AI Estimation Engine: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown"""
    logger.info("Shutting down AI-Powered Estimation Engine...")
    
    # Save any pending model state
    await neural_model.save_state()
    await ensemble_predictor.save_state()
    
    # Close connections
    await estimation_engine.close()
    await pattern_analyzer.close()
    
    logger.info("AI-Powered Estimation Engine shutdown complete")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8008)
