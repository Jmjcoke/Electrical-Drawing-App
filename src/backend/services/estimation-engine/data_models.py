"""
Data Models for AI-Powered Estimation Engine
Story 4.2: Comprehensive data models for estimation and analysis
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, date
from enum import Enum
import uuid

# Enums for standardized values
class ProjectType(str, Enum):
    COMMERCIAL = "commercial"
    INDUSTRIAL = "industrial"
    RESIDENTIAL = "residential"
    INFRASTRUCTURE = "infrastructure"
    RENEWABLE = "renewable"
    RETROFIT = "retrofit"
    MAINTENANCE = "maintenance"
    NEW_CONSTRUCTION = "new_construction"

class ComplexityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class LaborRole(str, Enum):
    ELECTRICAL_LEAD = "electrical_lead"
    JOURNEYMAN_ELECTRICIAN = "journeyman_electrician"
    ELECTRICIAN = "electrician"
    APPRENTICE = "apprentice"
    FCO_LEAD = "fco_lead"
    FCO_TECHNICIAN = "fco_technician"
    FOREMAN = "foreman"
    GENERAL_FOREMAN = "general_foreman"
    HELPER = "helper"
    SPECIALTY_TECH = "specialty_tech"

class EstimationMethod(str, Enum):
    NEURAL_NETWORK = "neural_network"
    ENSEMBLE = "ensemble"
    HISTORICAL_AVERAGE = "historical_average"
    COMPONENT_BASED = "component_based"
    HYBRID = "hybrid"

class InstallationMethod(str, Enum):
    SURFACE_MOUNT = "surface_mount"
    EMBEDDED = "embedded"
    CONDUIT = "conduit"
    CABLE_TRAY = "cable_tray"
    UNDERGROUND = "underground"
    OVERHEAD = "overhead"
    SPECIALTY = "specialty"

class ConfidenceLevel(str, Enum):
    VERY_HIGH = "very_high"  # 95%+
    HIGH = "high"           # 85-94%
    MEDIUM = "medium"       # 70-84%
    LOW = "low"             # 50-69%
    VERY_LOW = "very_low"   # <50%

# Core estimation models
class ComponentSpecification(BaseModel):
    """Detailed component specification for estimation"""
    component_id: str = Field(..., description="Unique component identifier")
    component_type: str = Field(..., description="Type of electrical component")
    manufacturer: Optional[str] = Field(None, description="Component manufacturer")
    model_number: Optional[str] = Field(None, description="Model number")
    specifications: Dict[str, Any] = Field(default={}, description="Technical specifications")
    quantity: int = Field(..., description="Quantity required")
    location: Optional[str] = Field(None, description="Installation location")
    installation_height: Optional[float] = Field(None, description="Installation height in feet")
    access_difficulty: ComplexityLevel = Field(ComplexityLevel.MEDIUM, description="Access difficulty")
    special_requirements: List[str] = Field(default=[], description="Special installation requirements")

class InstallationFactors(BaseModel):
    """Factors affecting installation complexity and time"""
    access_difficulty: float = Field(1.0, description="Access difficulty multiplier")
    height_factor: float = Field(1.0, description="Height-based difficulty multiplier")
    space_constraints: float = Field(1.0, description="Space constraint multiplier")
    coordination_complexity: float = Field(1.0, description="Multi-trade coordination factor")
    safety_requirements: float = Field(1.0, description="Additional safety requirement factor")
    environmental_conditions: float = Field(1.0, description="Environmental condition factor")
    existing_system_integration: float = Field(1.0, description="Integration with existing systems")
    
    @validator('*')
    def validate_positive(cls, v):
        if v < 0.1:
            raise ValueError('Factors must be positive')
        return v

class LaborEstimate(BaseModel):
    """Labor estimate for specific role and task"""
    role: LaborRole = Field(..., description="Labor role")
    base_hours: float = Field(..., description="Base hours without modifiers")
    adjusted_hours: float = Field(..., description="Hours after applying all factors")
    hourly_rate: float = Field(..., description="Hourly rate for this role")
    total_cost: float = Field(..., description="Total labor cost")
    
    # Factors applied
    complexity_factor: float = Field(1.0, description="Complexity adjustment factor")
    productivity_factor: float = Field(1.0, description="Productivity adjustment factor")
    site_factor: float = Field(1.0, description="Site condition factor")
    schedule_factor: float = Field(1.0, description="Schedule pressure factor")
    
    # Breakdown details
    task_breakdown: List[Dict[str, Any]] = Field(default=[], description="Detailed task breakdown")
    assumptions: List[str] = Field(default=[], description="Estimation assumptions")
    
    @validator('base_hours', 'adjusted_hours', 'hourly_rate', 'total_cost')
    def validate_positive_values(cls, v):
        if v < 0:
            raise ValueError('Values must be non-negative')
        return v

class ComponentEstimate(BaseModel):
    """Complete estimate for a single component"""
    component: ComponentSpecification = Field(..., description="Component being estimated")
    installation_method: InstallationMethod = Field(..., description="Installation method")
    installation_factors: InstallationFactors = Field(..., description="Installation complexity factors")
    
    # Labor estimates by role
    labor_estimates: List[LaborEstimate] = Field(..., description="Labor estimates by role")
    total_labor_hours: float = Field(..., description="Total labor hours")
    total_labor_cost: float = Field(..., description="Total labor cost")
    
    # Material and equipment
    material_cost: float = Field(0.0, description="Material cost for this component")
    equipment_cost: float = Field(0.0, description="Equipment/tool cost")
    total_cost: float = Field(..., description="Total cost including labor, material, equipment")
    
    # Estimation metadata
    estimation_method: EstimationMethod = Field(..., description="Method used for estimation")
    confidence_level: ConfidenceLevel = Field(..., description="Confidence in this estimate")
    confidence_score: float = Field(..., description="Numerical confidence score (0-1)")
    
    # Risk and contingency
    risk_factors: List[str] = Field(default=[], description="Identified risk factors")
    recommended_contingency: float = Field(0.1, description="Recommended contingency percentage")
    
    @validator('confidence_score')
    def validate_confidence(cls, v):
        if v < 0 or v > 1:
            raise ValueError('Confidence score must be between 0 and 1')
        return v

class ProjectComplexity(BaseModel):
    """Comprehensive project complexity analysis"""
    overall_complexity: ComplexityLevel = Field(..., description="Overall project complexity")
    complexity_score: float = Field(..., description="Numerical complexity score (0-10)")
    
    # Complexity dimensions
    technical_complexity: float = Field(..., description="Technical difficulty score")
    schedule_complexity: float = Field(..., description="Schedule challenge score")
    coordination_complexity: float = Field(..., description="Multi-trade coordination score")
    site_complexity: float = Field(..., description="Site condition challenge score")
    integration_complexity: float = Field(..., description="System integration challenge score")
    
    # Detailed factors
    voltage_levels: List[str] = Field(default=[], description="Voltage levels involved")
    system_types: List[str] = Field(default=[], description="Types of electrical systems")
    special_requirements: List[str] = Field(default=[], description="Special installation requirements")
    environmental_challenges: List[str] = Field(default=[], description="Environmental challenges")
    
    # AI-generated insights
    complexity_drivers: List[str] = Field(default=[], description="Primary complexity drivers")
    risk_areas: List[str] = Field(default=[], description="High-risk areas identified")
    recommendations: List[str] = Field(default=[], description="Complexity mitigation recommendations")
    
    # Comparison metrics
    percentile_rank: Optional[float] = Field(None, description="Complexity percentile vs historical projects")
    similar_project_count: int = Field(0, description="Count of similar complexity projects")
    
    @validator('complexity_score')
    def validate_complexity_score(cls, v):
        if v < 0 or v > 10:
            raise ValueError('Complexity score must be between 0 and 10')
        return v

class ProductivityFactors(BaseModel):
    """Labor productivity factors affecting estimation"""
    base_productivity: float = Field(1.0, description="Base productivity factor")
    
    # Environmental factors
    weather_factor: float = Field(1.0, description="Weather impact on productivity")
    seasonal_factor: float = Field(1.0, description="Seasonal productivity variation")
    
    # Crew and experience factors
    crew_experience_factor: float = Field(1.0, description="Crew experience impact")
    crew_size_factor: float = Field(1.0, description="Crew size efficiency factor")
    learning_curve_factor: float = Field(1.0, description="Learning curve improvement")
    
    # Site and project factors
    site_access_factor: float = Field(1.0, description="Site access impact")
    work_area_factor: float = Field(1.0, description="Working area constraints")
    coordination_factor: float = Field(1.0, description="Multi-trade coordination impact")
    
    # Schedule and quality factors
    schedule_pressure_factor: float = Field(1.0, description="Schedule pressure impact")
    quality_requirements_factor: float = Field(1.0, description="Quality requirements impact")
    rework_factor: float = Field(1.0, description="Expected rework factor")
    
    # Regional factors
    regional_productivity: float = Field(1.0, description="Regional productivity variation")
    labor_availability: float = Field(1.0, description="Labor availability impact")
    
    # Overall productivity
    combined_factor: float = Field(..., description="Combined productivity factor")
    confidence: float = Field(..., description="Confidence in productivity estimate")
    
    # Supporting data
    historical_basis: List[str] = Field(default=[], description="Historical data sources")
    adjustments_applied: List[str] = Field(default=[], description="Adjustments applied")

class EstimationConfidence(BaseModel):
    """Confidence metrics for estimation accuracy"""
    overall_confidence: float = Field(..., description="Overall confidence score (0-1)")
    confidence_level: ConfidenceLevel = Field(..., description="Categorical confidence level")
    
    # Component confidence scores
    labor_confidence: float = Field(..., description="Confidence in labor estimates")
    material_confidence: float = Field(..., description="Confidence in material estimates")
    schedule_confidence: float = Field(..., description="Confidence in schedule estimates")
    cost_confidence: float = Field(..., description="Confidence in cost estimates")
    
    # Confidence intervals
    labor_hours_range: Dict[str, float] = Field(..., description="Labor hours confidence interval")
    cost_range: Dict[str, float] = Field(..., description="Cost confidence interval")
    schedule_range: Dict[str, float] = Field(..., description="Schedule confidence interval")
    
    # Factors affecting confidence
    data_quality_score: float = Field(..., description="Quality of input data")
    historical_similarity: float = Field(..., description="Similarity to historical projects")
    complexity_familiarity: float = Field(..., description="Familiarity with project complexity")
    
    # Risk assessment
    risk_level: str = Field(..., description="Overall risk level")
    major_risks: List[str] = Field(default=[], description="Major risk factors")
    contingency_recommendation: float = Field(..., description="Recommended contingency percentage")
    
    @validator('*')
    def validate_confidence_scores(cls, v, field):
        if field.name.endswith('_confidence') or field.name == 'overall_confidence':
            if v < 0 or v > 1:
                raise ValueError(f'{field.name} must be between 0 and 1')
        return v

class EstimationResult(BaseModel):
    """Complete estimation result"""
    estimation_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique estimation ID")
    project_id: Optional[str] = Field(None, description="Associated project ID")
    
    # Request information
    request_type: str = Field(..., description="Type of estimation request")
    estimation_date: datetime = Field(default_factory=datetime.now, description="Estimation timestamp")
    
    # Project summary
    project_name: str = Field(..., description="Project name")
    project_type: ProjectType = Field(..., description="Project type")
    complexity: ProjectComplexity = Field(..., description="Project complexity analysis")
    
    # Estimation results
    total_labor_hours: float = Field(..., description="Total estimated labor hours")
    total_labor_cost: float = Field(..., description="Total estimated labor cost")
    total_material_cost: float = Field(0.0, description="Total estimated material cost")
    total_equipment_cost: float = Field(0.0, description="Total estimated equipment cost")
    total_project_cost: float = Field(..., description="Total estimated project cost")
    
    # Labor breakdown
    labor_by_role: Dict[str, LaborEstimate] = Field(..., description="Labor estimates by role")
    labor_by_phase: List[Dict[str, Any]] = Field(default=[], description="Labor estimates by project phase")
    
    # Component breakdown
    component_estimates: List[ComponentEstimate] = Field(default=[], description="Component-level estimates")
    assembly_estimates: List[Dict[str, Any]] = Field(default=[], description="Assembly-level estimates")
    
    # Schedule estimates
    estimated_duration_days: float = Field(..., description="Estimated project duration in days")
    critical_path_items: List[str] = Field(default=[], description="Critical path components")
    
    # Confidence and risk
    confidence_metrics: EstimationConfidence = Field(..., description="Confidence analysis")
    productivity_factors: ProductivityFactors = Field(..., description="Productivity analysis")
    
    # Methodology and sources
    estimation_method: EstimationMethod = Field(..., description="Primary estimation method used")
    methods_used: List[str] = Field(default=[], description="All methods used in estimation")
    data_sources: List[str] = Field(default=[], description="Data sources used")
    
    # Recommendations and insights
    recommendations: List[str] = Field(default=[], description="Estimation recommendations")
    assumptions: List[str] = Field(default=[], description="Key assumptions made")
    risks_identified: List[str] = Field(default=[], description="Risks identified during estimation")
    
    # Comparison and benchmarking
    similar_projects: List[Dict[str, Any]] = Field(default=[], description="Similar historical projects")
    industry_benchmarks: Optional[Dict[str, float]] = Field(None, description="Industry benchmark comparison")
    
    # Quality metrics
    estimation_quality_score: float = Field(..., description="Quality score for this estimation")
    completeness_score: float = Field(..., description="Data completeness score")
    
    # Breakdown for detailed analysis
    breakdown: Dict[str, Any] = Field(default={}, description="Detailed cost and hour breakdown")
    
    # Metadata
    created_by: Optional[str] = Field(None, description="User who created the estimate")
    last_updated: datetime = Field(default_factory=datetime.now, description="Last update timestamp")
    version: int = Field(1, description="Estimate version number")
    
    @validator('total_project_cost')
    def validate_total_cost(cls, v, values):
        # Ensure total cost is sum of components
        labor_cost = values.get('total_labor_cost', 0)
        material_cost = values.get('total_material_cost', 0)
        equipment_cost = values.get('total_equipment_cost', 0)
        
        expected_total = labor_cost + material_cost + equipment_cost
        if abs(v - expected_total) > (expected_total * 0.01):  # 1% tolerance
            logger.warning(f"Total cost {v} doesn't match component sum {expected_total}")
        
        return v

# Request models
class EstimationRequest(BaseModel):
    """Base estimation request"""
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique request ID")
    request_type: str = Field(..., description="Type of estimation request")
    requester: Optional[str] = Field(None, description="User making the request")
    
    # Project basic information
    project_name: str = Field(..., description="Project name")
    project_type: ProjectType = Field(..., description="Project type")
    description: Optional[str] = Field(None, description="Project description")
    
    # Estimation preferences
    confidence_level: float = Field(0.80, description="Desired confidence level")
    detail_level: str = Field("standard", description="Level of detail required")
    include_risk_analysis: bool = Field(True, description="Include risk analysis")
    include_alternatives: bool = Field(False, description="Include alternative approaches")
    
    # Timeline
    requested_completion: Optional[datetime] = Field(None, description="When estimate is needed")
    
    @validator('confidence_level')
    def validate_confidence(cls, v):
        if v < 0.5 or v > 0.95:
            raise ValueError('Confidence level must be between 0.5 and 0.95')
        return v

# Validation and learning models
class EstimationValidation(BaseModel):
    """Validation of estimate against actual performance"""
    validation_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique validation ID")
    estimation_id: str = Field(..., description="Estimation being validated")
    
    # Actual vs estimated
    estimated_hours: Dict[str, float] = Field(..., description="Original estimated hours by role")
    actual_hours: Dict[str, float] = Field(..., description="Actual hours by role")
    
    estimated_cost: float = Field(..., description="Original estimated cost")
    actual_cost: float = Field(..., description="Actual project cost")
    
    estimated_duration: float = Field(..., description="Original estimated duration")
    actual_duration: float = Field(..., description="Actual project duration")
    
    # Variance analysis
    hour_variance_by_role: Dict[str, float] = Field(..., description="Hour variance by role")
    cost_variance: float = Field(..., description="Overall cost variance")
    schedule_variance: float = Field(..., description="Schedule variance")
    
    # Overall accuracy
    overall_accuracy: float = Field(..., description="Overall estimation accuracy")
    
    # Lessons learned
    accuracy_factors: List[str] = Field(default=[], description="Factors affecting accuracy")
    improvement_suggestions: List[str] = Field(default=[], description="Suggestions for improvement")
    
    # Validation metadata
    validation_date: datetime = Field(default_factory=datetime.now, description="Validation date")
    validated_by: Optional[str] = Field(None, description="User who performed validation")
    notes: Optional[str] = Field(None, description="Validation notes")

# Analysis and reporting models
class EstimationAnalytics(BaseModel):
    """Analytics and metrics for estimation performance"""
    analysis_period: Dict[str, date] = Field(..., description="Analysis time period")
    
    # Overall metrics
    total_estimates: int = Field(..., description="Total estimates in period")
    total_validations: int = Field(..., description="Total validations completed")
    
    # Accuracy metrics
    average_accuracy: float = Field(..., description="Average estimation accuracy")
    accuracy_by_project_type: Dict[str, float] = Field(..., description="Accuracy by project type")
    accuracy_by_complexity: Dict[str, float] = Field(..., description="Accuracy by complexity level")
    
    # Trend analysis
    accuracy_trend: List[Dict[str, Any]] = Field(..., description="Accuracy trend over time")
    improvement_rate: float = Field(..., description="Rate of accuracy improvement")
    
    # Performance by method
    method_performance: Dict[str, Dict[str, float]] = Field(..., description="Performance by estimation method")
    
    # Bias analysis
    systematic_bias: Dict[str, float] = Field(..., description="Systematic bias by category")
    bias_correction_applied: bool = Field(False, description="Whether bias correction is applied")
    
    # Recommendations
    improvement_recommendations: List[str] = Field(default=[], description="Improvement recommendations")
    
class ModelPerformance(BaseModel):
    """AI model performance metrics"""
    model_name: str = Field(..., description="Name of the AI model")
    model_version: str = Field(..., description="Model version")
    
    # Training metrics
    training_accuracy: float = Field(..., description="Training set accuracy")
    validation_accuracy: float = Field(..., description="Validation set accuracy")
    test_accuracy: float = Field(..., description="Test set accuracy")
    
    # Real-world performance
    production_accuracy: float = Field(..., description="Production accuracy")
    prediction_count: int = Field(..., description="Number of predictions made")
    
    # Model health
    last_training_date: datetime = Field(..., description="Last training date")
    next_training_scheduled: Optional[datetime] = Field(None, description="Next scheduled training")
    
    # Performance trends
    accuracy_trend: List[Dict[str, Any]] = Field(..., description="Accuracy trend over time")
    degradation_detected: bool = Field(False, description="Whether performance degradation detected")
    
    # Feature importance
    feature_importance: Dict[str, float] = Field(default={}, description="Feature importance scores")
    
    # Recommendations
    retraining_recommended: bool = Field(False, description="Whether retraining is recommended")
    performance_notes: List[str] = Field(default=[], description="Performance analysis notes")

import logging
logger = logging.getLogger(__name__)
