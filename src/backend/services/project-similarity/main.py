"""
Similar Project Identification Service
Story 4.3: Intelligent project similarity analysis and benchmarking
"""

from fastapi import FastAPI, HTTPException, Query, Depends
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

# Import our similarity modules
from algorithms.similarity_engine import ProjectSimilarityEngine
from algorithms.pattern_matcher import ProjectPatternMatcher
from algorithms.performance_analyzer import HistoricalPerformanceAnalyzer
from algorithms.recommendation_engine import ProjectRecommendationEngine
from fingerprinting.project_fingerprinter import ProjectFingerprinter
from comparison.project_comparator import ProjectComparator
from data_models import (
    SimilarityRequest, SimilarityResult, ProjectFingerprint,
    ProjectComparison, PerformanceAnalysis, ProjectRecommendation
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title="Similar Project Identification Service",
    description="Intelligent project similarity analysis and benchmarking - Story 4.3",
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
similarity_engine = ProjectSimilarityEngine()
pattern_matcher = ProjectPatternMatcher()
performance_analyzer = HistoricalPerformanceAnalyzer()
recommendation_engine = ProjectRecommendationEngine()
project_fingerprinter = ProjectFingerprinter()
project_comparator = ProjectComparator()

# Request models
class QuickSimilarityRequest(BaseModel):
    """Quick similarity search for basic project characteristics"""
    project_type: str = Field(..., description="Type of project")
    industry_category: str = Field(..., description="Industry category")
    total_cost: Optional[float] = Field(None, description="Approximate total cost")
    location: Dict[str, str] = Field(..., description="Project location")
    complexity_level: str = Field("medium", description="Project complexity")
    timeline_months: Optional[float] = Field(None, description="Project timeline")
    limit: int = Field(10, description="Maximum number of results")
    similarity_threshold: float = Field(0.6, description="Minimum similarity score")

class DetailedSimilarityRequest(BaseModel):
    """Comprehensive similarity search with full project analysis"""
    project_id: Optional[str] = Field(None, description="Project ID if updating existing")
    project_name: str = Field(..., description="Project name")
    
    # Core project characteristics
    project_type: str = Field(..., description="Type of electrical project")
    industry_category: str = Field(..., description="Industry category")
    location: Dict[str, Any] = Field(..., description="Geographic location data")
    
    # Technical specifications
    total_cost: Optional[float] = Field(None, description="Total project cost")
    labor_hours: Optional[float] = Field(None, description="Estimated labor hours")
    complexity_score: Optional[float] = Field(None, description="Complexity score")
    
    # Project details
    components: List[Dict[str, Any]] = Field(default=[], description="Project components")
    circuits: List[Dict[str, Any]] = Field(default=[], description="Circuit information")
    specifications: Dict[str, Any] = Field(default={}, description="Technical specifications")
    
    # Timeline and constraints
    planned_duration: Optional[int] = Field(None, description="Planned duration in days")
    start_date: Optional[date] = Field(None, description="Project start date")
    end_date: Optional[date] = Field(None, description="Project end date")
    
    # Search parameters
    similarity_weights: Optional[Dict[str, float]] = Field(None, description="Custom similarity weights")
    exclude_projects: List[str] = Field(default=[], description="Project IDs to exclude")
    limit: int = Field(20, description="Maximum number of results")
    min_similarity: float = Field(0.5, description="Minimum similarity threshold")
    include_analysis: bool = Field(True, description="Include performance analysis")

class ProjectComparisonRequest(BaseModel):
    """Request for detailed project comparison"""
    target_project: Dict[str, Any] = Field(..., description="Target project for comparison")
    comparison_projects: List[str] = Field(..., description="IDs of projects to compare against")
    comparison_dimensions: List[str] = Field(
        default=["cost", "timeline", "complexity", "performance", "quality"],
        description="Dimensions to compare"
    )
    include_recommendations: bool = Field(True, description="Include improvement recommendations")

class BenchmarkRequest(BaseModel):
    """Request for project benchmarking analysis"""
    project_data: Dict[str, Any] = Field(..., description="Project to benchmark")
    benchmark_type: str = Field("industry", description="Type of benchmark: industry, regional, similar")
    time_period: Optional[Dict[str, date]] = Field(None, description="Time period for benchmark")
    anonymize_results: bool = Field(True, description="Anonymize competitive data")

class RecommendationRequest(BaseModel):
    """Request for project recommendations based on similar projects"""
    project_context: Dict[str, Any] = Field(..., description="Current project context")
    recommendation_types: List[str] = Field(
        default=["strategy", "risk_mitigation", "resource_optimization", "schedule"],
        description="Types of recommendations needed"
    )
    similar_project_count: int = Field(10, description="Number of similar projects to analyze")
    confidence_threshold: float = Field(0.7, description="Minimum confidence for recommendations")

# Response models
class APIResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    message: str
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())

class SimilarityResponse(BaseModel):
    success: bool
    query_project: Dict[str, Any]
    similar_projects: List[Dict[str, Any]]
    similarity_metrics: Dict[str, Any]
    search_metadata: Dict[str, Any]
    recommendations: List[str]
    processing_time: float
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())

# Health check endpoint
@app.get("/health", response_model=APIResponse)
async def health_check():
    """Health check endpoint with similarity engine status"""
    try:
        # Check all service components
        engine_status = await similarity_engine.health_check()
        matcher_status = await pattern_matcher.health_check()
        
        return APIResponse(
            success=True,
            data={
                "status": "healthy",
                "service": "project-similarity",
                "version": "1.0.0",
                "engine_status": engine_status,
                "matcher_status": matcher_status,
                "indexed_projects": await get_indexed_project_count()
            },
            message="Similar Project Identification Service is healthy and ready"
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")

# === SIMILARITY SEARCH ENDPOINTS ===

@app.post("/api/v1/similarity/quick", response_model=SimilarityResponse)
async def quick_similarity_search(request: QuickSimilarityRequest):
    """Quick similarity search for basic project matching"""
    start_time = datetime.now()
    
    try:
        logger.info(f"Processing quick similarity search for {request.project_type}")
        
        # Create basic project fingerprint
        fingerprint = await project_fingerprinter.create_quick_fingerprint(
            project_type=request.project_type,
            industry=request.industry_category,
            location=request.location,
            cost=request.total_cost,
            complexity=request.complexity_level,
            timeline=request.timeline_months
        )
        
        # Find similar projects
        similar_projects = await similarity_engine.find_similar_projects(
            fingerprint=fingerprint,
            limit=request.limit,
            threshold=request.similarity_threshold,
            quick_mode=True
        )
        
        # Generate basic recommendations
        recommendations = await recommendation_engine.generate_quick_recommendations(
            target_fingerprint=fingerprint,
            similar_projects=similar_projects
        )
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        return SimilarityResponse(
            success=True,
            query_project={
                "type": request.project_type,
                "industry": request.industry_category,
                "location": request.location,
                "complexity": request.complexity_level
            },
            similar_projects=similar_projects,
            similarity_metrics={
                "search_type": "quick",
                "total_evaluated": await get_indexed_project_count(),
                "matches_found": len(similar_projects),
                "avg_similarity": np.mean([p['similarity_score'] for p in similar_projects]) if similar_projects else 0
            },
            search_metadata={
                "fingerprint_features": len(fingerprint.features),
                "similarity_threshold": request.similarity_threshold,
                "search_scope": "quick"
            },
            recommendations=recommendations,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Quick similarity search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/similarity/detailed", response_model=SimilarityResponse)
async def detailed_similarity_search(request: DetailedSimilarityRequest):
    """Comprehensive similarity search with full project analysis"""
    start_time = datetime.now()
    
    try:
        logger.info(f"Processing detailed similarity search for {request.project_name}")
        
        # Create comprehensive project fingerprint
        fingerprint = await project_fingerprinter.create_detailed_fingerprint(
            project_data=request.dict(),
            components=request.components,
            circuits=request.circuits,
            specifications=request.specifications
        )
        
        # Advanced similarity search
        similar_projects = await similarity_engine.find_similar_projects(
            fingerprint=fingerprint,
            limit=request.limit,
            threshold=request.min_similarity,
            weights=request.similarity_weights,
            exclude_ids=request.exclude_projects,
            detailed_mode=True
        )
        
        # Performance analysis if requested
        performance_analysis = None
        if request.include_analysis and similar_projects:
            performance_analysis = await performance_analyzer.analyze_similar_projects(
                target_project=request.dict(),
                similar_projects=similar_projects
            )
        
        # Generate comprehensive recommendations
        recommendations = await recommendation_engine.generate_detailed_recommendations(
            target_project=request.dict(),
            similar_projects=similar_projects,
            performance_analysis=performance_analysis
        )
        
        # Calculate advanced similarity metrics
        similarity_metrics = await similarity_engine.calculate_advanced_metrics(
            fingerprint, similar_projects
        )
        
        processing_time = (datetime.now() - start_time).total_seconds()
        
        return SimilarityResponse(
            success=True,
            query_project={
                "name": request.project_name,
                "type": request.project_type,
                "industry": request.industry_category,
                "location": request.location,
                "fingerprint": fingerprint.summary_stats
            },
            similar_projects=similar_projects,
            similarity_metrics=similarity_metrics,
            search_metadata={
                "fingerprint_features": len(fingerprint.features),
                "similarity_weights": request.similarity_weights or "default",
                "search_scope": "detailed",
                "performance_analysis": performance_analysis is not None
            },
            recommendations=recommendations,
            processing_time=processing_time
        )
        
    except Exception as e:
        logger.error(f"Detailed similarity search error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === PROJECT COMPARISON ENDPOINTS ===

@app.post("/api/v1/comparison/analyze", response_model=APIResponse)
async def analyze_project_comparison(request: ProjectComparisonRequest):
    """Comprehensive comparison analysis between projects"""
    try:
        logger.info(f"Analyzing comparison for {len(request.comparison_projects)} projects")
        
        # Perform detailed project comparison
        comparison_result = await project_comparator.compare_projects(
            target_project=request.target_project,
            comparison_project_ids=request.comparison_projects,
            dimensions=request.comparison_dimensions
        )
        
        # Generate recommendations if requested
        recommendations = []
        if request.include_recommendations:
            recommendations = await recommendation_engine.generate_comparison_recommendations(
                comparison_result
            )
        
        return APIResponse(
            success=True,
            data={
                "comparison_result": comparison_result.dict(),
                "recommendations": recommendations,
                "summary": {
                    "projects_compared": len(request.comparison_projects),
                    "dimensions_analyzed": len(request.comparison_dimensions),
                    "key_insights": comparison_result.key_insights
                }
            },
            message="Project comparison analysis completed"
        )
        
    except Exception as e:
        logger.error(f"Project comparison error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/benchmarking/analyze", response_model=APIResponse)
async def analyze_project_benchmark(request: BenchmarkRequest):
    """Benchmark project against industry/regional standards"""
    try:
        logger.info(f"Benchmarking project against {request.benchmark_type} standards")
        
        # Perform benchmarking analysis
        benchmark_result = await performance_analyzer.benchmark_project(
            project_data=request.project_data,
            benchmark_type=request.benchmark_type,
            time_period=request.time_period,
            anonymize=request.anonymize_results
        )
        
        return APIResponse(
            success=True,
            data=benchmark_result.dict(),
            message=f"Project benchmarking against {request.benchmark_type} completed"
        )
        
    except Exception as e:
        logger.error(f"Project benchmarking error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === RECOMMENDATION ENDPOINTS ===

@app.post("/api/v1/recommendations/generate", response_model=APIResponse)
async def generate_project_recommendations(request: RecommendationRequest):
    """Generate actionable recommendations based on similar projects"""
    try:
        logger.info(f"Generating {len(request.recommendation_types)} types of recommendations")
        
        # Find similar projects for context
        fingerprint = await project_fingerprinter.create_detailed_fingerprint(
            request.project_context
        )
        
        similar_projects = await similarity_engine.find_similar_projects(
            fingerprint=fingerprint,
            limit=request.similar_project_count,
            threshold=0.6
        )
        
        # Generate comprehensive recommendations
        recommendations = await recommendation_engine.generate_comprehensive_recommendations(
            project_context=request.project_context,
            similar_projects=similar_projects,
            recommendation_types=request.recommendation_types,
            confidence_threshold=request.confidence_threshold
        )
        
        return APIResponse(
            success=True,
            data={
                "recommendations": recommendations,
                "context": {
                    "similar_projects_analyzed": len(similar_projects),
                    "recommendation_types": request.recommendation_types,
                    "confidence_threshold": request.confidence_threshold
                }
            },
            message="Project recommendations generated successfully"
        )
        
    except Exception as e:
        logger.error(f"Recommendation generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === ANALYTICS ENDPOINTS ===

@app.get("/api/v1/analytics/similarity-trends", response_model=APIResponse)
async def get_similarity_trends(
    time_period: str = Query("1y", description="Time period: 3m, 6m, 1y, 2y"),
    project_type: Optional[str] = Query(None, description="Filter by project type"),
    industry: Optional[str] = Query(None, description="Filter by industry")
):
    """Get similarity search trends and patterns"""
    try:
        trends = await similarity_engine.get_similarity_trends(
            time_period=time_period,
            project_type=project_type,
            industry=industry
        )
        
        return APIResponse(
            success=True,
            data=trends,
            message="Similarity trends retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Similarity trends error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/analytics/performance-patterns", response_model=APIResponse)
async def get_performance_patterns(
    similarity_threshold: float = Query(0.8, description="Minimum similarity for pattern analysis")
):
    """Get performance patterns from similar project analysis"""
    try:
        patterns = await performance_analyzer.get_performance_patterns(
            similarity_threshold=similarity_threshold
        )
        
        return APIResponse(
            success=True,
            data=patterns,
            message="Performance patterns retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Performance patterns error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === PROJECT MANAGEMENT ENDPOINTS ===

@app.get("/api/v1/projects/{project_id}/similar", response_model=SimilarityResponse)
async def get_project_similar_projects(
    project_id: str,
    limit: int = Query(10, description="Maximum results"),
    threshold: float = Query(0.6, description="Similarity threshold")
):
    """Get similar projects for a specific project ID"""
    try:
        # Get project data
        project_data = await similarity_engine.get_project_data(project_id)
        if not project_data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Create fingerprint
        fingerprint = await project_fingerprinter.create_detailed_fingerprint(project_data)
        
        # Find similar projects
        similar_projects = await similarity_engine.find_similar_projects(
            fingerprint=fingerprint,
            limit=limit,
            threshold=threshold,
            exclude_ids=[project_id]
        )
        
        return SimilarityResponse(
            success=True,
            query_project=project_data,
            similar_projects=similar_projects,
            similarity_metrics=await similarity_engine.calculate_advanced_metrics(
                fingerprint, similar_projects
            ),
            search_metadata={
                "source_project_id": project_id,
                "search_type": "project_lookup"
            },
            recommendations=[],
            processing_time=0.0
        )
        
    except Exception as e:
        logger.error(f"Project similar projects error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# === UTILITY FUNCTIONS ===

async def get_indexed_project_count() -> int:
    """Get count of projects in similarity index"""
    try:
        return await similarity_engine.get_indexed_count()
    except:
        return 0

# Startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Initialize similarity services on startup"""
    logger.info("Starting Similar Project Identification Service...")
    
    try:
        # Initialize similarity engine
        await similarity_engine.initialize()
        logger.info("✓ Project Similarity Engine initialized")
        
        # Initialize pattern matcher
        await pattern_matcher.initialize()
        logger.info("✓ Project Pattern Matcher initialized")
        
        # Initialize performance analyzer
        await performance_analyzer.initialize()
        logger.info("✓ Historical Performance Analyzer initialized")
        
        # Initialize recommendation engine
        await recommendation_engine.initialize()
        logger.info("✓ Project Recommendation Engine initialized")
        
        # Initialize fingerprinter
        await project_fingerprinter.initialize()
        logger.info("✓ Project Fingerprinter initialized")
        
        # Initialize comparator
        await project_comparator.initialize()
        logger.info("✓ Project Comparator initialized")
        
        logger.info("Similar Project Identification Service ready!")
        
    except Exception as e:
        logger.error(f"Failed to initialize Similar Project Service: {e}")
        raise

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown"""
    logger.info("Shutting down Similar Project Identification Service...")
    
    # Close connections and clean up
    await similarity_engine.close()
    await pattern_matcher.close()
    await performance_analyzer.close()
    
    logger.info("Similar Project Identification Service shutdown complete")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8009)
