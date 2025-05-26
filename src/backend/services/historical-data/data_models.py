"""
Data Models for Historical Project Data
Story 4.1: Comprehensive data models for historical electrical projects
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
    MAINTENANCE = "maintenance"
    RETROFIT = "retrofit"
    NEW_CONSTRUCTION = "new_construction"

class ProjectStatus(str, Enum):
    PLANNING = "planning"
    DESIGN = "design"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"

class IndustryCategory(str, Enum):
    OIL_GAS = "oil_gas"
    MANUFACTURING = "manufacturing"
    POWER_GENERATION = "power_generation"
    CHEMICAL_PROCESS = "chemical_process"
    COMMERCIAL_BUILDING = "commercial_building"
    HEALTHCARE = "healthcare"
    EDUCATION = "education"
    RETAIL = "retail"
    TRANSPORTATION = "transportation"
    MINING = "mining"

class ProjectComplexity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class LaborRole(str, Enum):
    ELECTRICAL_LEAD = "electrical_lead"
    ELECTRICIAN = "electrician"
    FCO_LEAD = "fco_lead"
    FCO_TECH = "fco_tech"
    FOREMAN = "foreman"
    GENERAL_FOREMAN = "general_foreman"
    SUPERINTENDENT = "superintendent"
    HELPER = "helper"
    APPRENTICE = "apprentice"

class QualityScore(str, Enum):
    EXCELLENT = "excellent"  # 95-100%
    GOOD = "good"           # 85-94%
    FAIR = "fair"           # 70-84%
    POOR = "poor"           # <70%

# Core data models
class LocationData(BaseModel):
    """Geographic location information"""
    country: str = Field(..., description="Country name")
    state_province: str = Field(..., description="State or province")
    city: str = Field(..., description="City name")
    postal_code: Optional[str] = Field(None, description="Postal/ZIP code")
    coordinates: Optional[Dict[str, float]] = Field(None, description="Latitude/longitude")
    region: Optional[str] = Field(None, description="Regional designation")
    timezone: Optional[str] = Field(None, description="Timezone")

class CostData(BaseModel):
    """Project cost information"""
    total_cost: float = Field(..., description="Total project cost")
    labor_cost: float = Field(..., description="Total labor cost")
    material_cost: float = Field(..., description="Total material cost")
    equipment_cost: float = Field(0.0, description="Equipment rental/purchase cost")
    overhead_cost: float = Field(0.0, description="Overhead cost")
    profit_margin: Optional[float] = Field(None, description="Profit margin percentage")
    currency: str = Field("USD", description="Currency code")
    cost_date: datetime = Field(..., description="Date of cost calculation")
    inflation_adjusted: bool = Field(False, description="Whether costs are inflation adjusted")
    
    @validator('total_cost', 'labor_cost', 'material_cost')
    def costs_must_be_positive(cls, v):
        if v < 0:
            raise ValueError('Costs must be positive')
        return v

class LaborHours(BaseModel):
    """Labor hours by role"""
    role: LaborRole = Field(..., description="Labor role")
    planned_hours: float = Field(..., description="Originally planned hours")
    actual_hours: float = Field(..., description="Actual hours worked")
    hourly_rate: float = Field(..., description="Hourly rate for this role")
    overtime_hours: float = Field(0.0, description="Overtime hours worked")
    efficiency_factor: Optional[float] = Field(None, description="Efficiency factor (actual/planned)")
    
    @validator('planned_hours', 'actual_hours')
    def hours_must_be_positive(cls, v):
        if v < 0:
            raise ValueError('Hours must be positive')
        return v

class MaterialItem(BaseModel):
    """Individual material item"""
    description: str = Field(..., description="Material description")
    quantity: float = Field(..., description="Quantity used")
    unit: str = Field(..., description="Unit of measurement")
    unit_cost: float = Field(..., description="Cost per unit")
    total_cost: float = Field(..., description="Total cost for this item")
    supplier: Optional[str] = Field(None, description="Material supplier")
    category: Optional[str] = Field(None, description="Material category")
    specification: Optional[str] = Field(None, description="Technical specification")

class EquipmentUsage(BaseModel):
    """Equipment usage information"""
    equipment_type: str = Field(..., description="Type of equipment")
    description: str = Field(..., description="Equipment description")
    usage_hours: float = Field(..., description="Hours of usage")
    rental_rate: Optional[float] = Field(None, description="Hourly rental rate")
    total_cost: float = Field(..., description="Total equipment cost")
    efficiency_impact: Optional[float] = Field(None, description="Impact on labor efficiency")

class ProjectPhase(BaseModel):
    """Individual project phase"""
    phase_name: str = Field(..., description="Name of the phase")
    planned_start: date = Field(..., description="Planned start date")
    planned_end: date = Field(..., description="Planned end date")
    actual_start: Optional[date] = Field(None, description="Actual start date")
    actual_end: Optional[date] = Field(None, description="Actual end date")
    labor_hours: List[LaborHours] = Field(default=[], description="Labor hours for this phase")
    materials: List[MaterialItem] = Field(default=[], description="Materials used in this phase")
    equipment: List[EquipmentUsage] = Field(default=[], description="Equipment used in this phase")
    status: ProjectStatus = Field(..., description="Phase status")
    completion_percentage: float = Field(0.0, description="Completion percentage")
    
    @validator('completion_percentage')
    def completion_must_be_valid(cls, v):
        if v < 0 or v > 100:
            raise ValueError('Completion percentage must be between 0 and 100')
        return v

class QualityMetrics(BaseModel):
    """Project quality and performance metrics"""
    overall_quality_score: QualityScore = Field(..., description="Overall quality assessment")
    rework_hours: float = Field(0.0, description="Hours spent on rework")
    defect_rate: float = Field(0.0, description="Defect rate percentage")
    safety_incidents: int = Field(0, description="Number of safety incidents")
    client_satisfaction: Optional[float] = Field(None, description="Client satisfaction score (1-10)")
    nec_compliance_score: Optional[float] = Field(None, description="NEC compliance score")
    inspection_pass_rate: Optional[float] = Field(None, description="Inspection pass rate percentage")

class RiskFactors(BaseModel):
    """Project risk factors and issues"""
    weather_delays: float = Field(0.0, description="Days lost to weather")
    material_delays: float = Field(0.0, description="Days lost to material delays")
    permit_delays: float = Field(0.0, description="Days lost to permit issues")
    change_orders: int = Field(0, description="Number of change orders")
    change_order_impact: float = Field(0.0, description="Cost impact of change orders")
    site_conditions: Optional[str] = Field(None, description="Challenging site conditions")
    coordination_issues: Optional[str] = Field(None, description="Coordination challenges")

class ProjectClassification(BaseModel):
    """ML-based project classification"""
    primary_type: ProjectType = Field(..., description="Primary project type")
    industry_category: IndustryCategory = Field(..., description="Industry category")
    complexity_level: ProjectComplexity = Field(..., description="Complexity assessment")
    similar_projects: List[str] = Field(default=[], description="IDs of similar historical projects")
    confidence_score: float = Field(..., description="Classification confidence (0-1)")
    tags: List[str] = Field(default=[], description="Descriptive tags")
    characteristics: Dict[str, Any] = Field(default={}, description="Key project characteristics")

class HistoricalProject(BaseModel):
    """Complete historical project model"""
    # Core identification
    project_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique project identifier")
    project_name: str = Field(..., description="Project name")
    project_number: Optional[str] = Field(None, description="Client/internal project number")
    client_name: str = Field(..., description="Client name")
    
    # Classification and metadata
    classification: ProjectClassification = Field(..., description="Project classification")
    location: LocationData = Field(..., description="Project location")
    description: str = Field(..., description="Project description")
    
    # Timeline
    planned_start_date: date = Field(..., description="Planned start date")
    planned_end_date: date = Field(..., description="Planned end date")
    actual_start_date: Optional[date] = Field(None, description="Actual start date")
    actual_end_date: Optional[date] = Field(None, description="Actual end date")
    
    # Financial information
    cost_data: CostData = Field(..., description="Project cost information")
    
    # Labor and resources
    total_labor_hours: List[LaborHours] = Field(default=[], description="Total labor hours by role")
    phases: List[ProjectPhase] = Field(default=[], description="Project phases")
    
    # Materials and equipment
    materials: List[MaterialItem] = Field(default=[], description="Materials used")
    equipment: List[EquipmentUsage] = Field(default=[], description="Equipment used")
    
    # Performance metrics
    quality_metrics: QualityMetrics = Field(..., description="Quality and performance metrics")
    risk_factors: RiskFactors = Field(..., description="Risk factors and issues")
    
    # Status and progress
    status: ProjectStatus = Field(..., description="Current project status")
    completion_percentage: float = Field(0.0, description="Overall completion percentage")
    
    # Import metadata
    import_source: str = Field(..., description="Source of this data (file, system, manual)")
    import_date: datetime = Field(default_factory=datetime.now, description="Date imported")
    data_quality_score: float = Field(..., description="Data quality score (0-1)")
    
    # Additional metadata
    lessons_learned: Optional[str] = Field(None, description="Lessons learned from project")
    best_practices: Optional[str] = Field(None, description="Best practices identified")
    custom_fields: Dict[str, Any] = Field(default={}, description="Custom project fields")
    
    @validator('completion_percentage')
    def completion_must_be_valid(cls, v):
        if v < 0 or v > 100:
            raise ValueError('Completion percentage must be between 0 and 100')
        return v
    
    @validator('data_quality_score')
    def quality_score_must_be_valid(cls, v):
        if v < 0 or v > 1:
            raise ValueError('Data quality score must be between 0 and 1')
        return v

# Import job models
class ImportJob(BaseModel):
    """Import job tracking"""
    job_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique job identifier")
    job_name: str = Field(..., description="Human-readable job name")
    import_type: str = Field(..., description="Type of import: file, legacy_system, manual")
    source_info: Dict[str, Any] = Field(..., description="Information about data source")
    
    # Status tracking
    status: str = Field("pending", description="Job status")
    progress_percentage: float = Field(0.0, description="Progress percentage")
    start_time: Optional[datetime] = Field(None, description="Job start time")
    end_time: Optional[datetime] = Field(None, description="Job end time")
    
    # Results
    projects_imported: int = Field(0, description="Number of projects imported")
    errors_count: int = Field(0, description="Number of errors encountered")
    warnings_count: int = Field(0, description="Number of warnings")
    
    # Error details
    error_details: List[str] = Field(default=[], description="Detailed error messages")
    warning_details: List[str] = Field(default=[], description="Warning messages")
    
    # Metadata
    created_by: str = Field(..., description="User who created the job")
    created_at: datetime = Field(default_factory=datetime.now, description="Job creation time")
    updated_at: datetime = Field(default_factory=datetime.now, description="Last update time")

class DataQualityIssue(BaseModel):
    """Individual data quality issue"""
    issue_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique issue identifier")
    severity: str = Field(..., description="Issue severity: error, warning, info")
    category: str = Field(..., description="Issue category")
    description: str = Field(..., description="Issue description")
    field_name: Optional[str] = Field(None, description="Field with the issue")
    current_value: Optional[str] = Field(None, description="Current value")
    suggested_value: Optional[str] = Field(None, description="Suggested correction")
    auto_fixable: bool = Field(False, description="Whether issue can be automatically fixed")
    project_id: Optional[str] = Field(None, description="Affected project ID")

class DataQualityReport(BaseModel):
    """Data quality analysis report"""
    report_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique report identifier")
    import_job_id: str = Field(..., description="Related import job ID")
    
    # Overall metrics
    overall_score: float = Field(..., description="Overall quality score (0-1)")
    projects_analyzed: int = Field(..., description="Number of projects analyzed")
    
    # Issue summary
    issues: List[DataQualityIssue] = Field(default=[], description="Quality issues found")
    auto_fixes: List[str] = Field(default=[], description="Issues automatically fixed")
    manual_review_items: List[str] = Field(default=[], description="Items requiring manual review")
    
    # Detailed metrics
    completeness_score: float = Field(..., description="Data completeness score")
    accuracy_score: float = Field(..., description="Data accuracy score")
    consistency_score: float = Field(..., description="Data consistency score")
    validity_score: float = Field(..., description="Data validity score")
    
    # Recommendations
    recommendations: List[str] = Field(default=[], description="Improvement recommendations")
    
    # Metadata
    analysis_date: datetime = Field(default_factory=datetime.now, description="Analysis date")
    analysis_duration: Optional[float] = Field(None, description="Analysis duration in seconds")

# Search and query models
class ProjectSearchFilters(BaseModel):
    """Search filters for historical projects"""
    project_types: Optional[List[ProjectType]] = Field(None, description="Project types to include")
    industry_categories: Optional[List[IndustryCategory]] = Field(None, description="Industry categories")
    complexity_levels: Optional[List[ProjectComplexity]] = Field(None, description="Complexity levels")
    
    # Date ranges
    start_date_range: Optional[Dict[str, date]] = Field(None, description="Start date range")
    end_date_range: Optional[Dict[str, date]] = Field(None, description="End date range")
    
    # Cost ranges
    total_cost_range: Optional[Dict[str, float]] = Field(None, description="Total cost range")
    labor_cost_range: Optional[Dict[str, float]] = Field(None, description="Labor cost range")
    
    # Location filters
    countries: Optional[List[str]] = Field(None, description="Countries to include")
    states_provinces: Optional[List[str]] = Field(None, description="States/provinces to include")
    regions: Optional[List[str]] = Field(None, description="Regions to include")
    
    # Quality filters
    min_quality_score: Optional[float] = Field(None, description="Minimum data quality score")
    min_completion_percentage: Optional[float] = Field(None, description="Minimum completion percentage")
    
    # Text search
    search_text: Optional[str] = Field(None, description="Text to search in project descriptions")
    
    # Tags and characteristics
    required_tags: Optional[List[str]] = Field(None, description="Tags that must be present")
    excluded_tags: Optional[List[str]] = Field(None, description="Tags to exclude")

class ProjectSummary(BaseModel):
    """Summary view of historical project for search results"""
    project_id: str
    project_name: str
    client_name: str
    project_type: ProjectType
    industry_category: IndustryCategory
    complexity_level: ProjectComplexity
    location: LocationData
    total_cost: float
    duration_days: Optional[int]
    status: ProjectStatus
    completion_percentage: float
    data_quality_score: float
    import_date: datetime
    
# Export and reporting models
class ExportRequest(BaseModel):
    """Request for data export"""
    export_format: str = Field(..., description="Export format: csv, excel, json, pdf")
    project_ids: Optional[List[str]] = Field(None, description="Specific projects to export")
    filters: Optional[ProjectSearchFilters] = Field(None, description="Filters for export")
    include_detailed_data: bool = Field(True, description="Include detailed project data")
    include_phases: bool = Field(True, description="Include phase information")
    include_materials: bool = Field(True, description="Include material details")
    include_labor: bool = Field(True, description="Include labor details")
    
class AnalyticsRequest(BaseModel):
    """Request for analytics and reporting"""
    analysis_type: str = Field(..., description="Type of analysis")
    time_period: Optional[Dict[str, date]] = Field(None, description="Time period for analysis")
    grouping: Optional[List[str]] = Field(None, description="Grouping dimensions")
    metrics: List[str] = Field(..., description="Metrics to calculate")
    filters: Optional[ProjectSearchFilters] = Field(None, description="Filters for analysis")
    
# API response models
class ImportResult(BaseModel):
    """Result of import operation"""
    success: bool
    projects: List[HistoricalProject]
    summary: Dict[str, Any]
    warnings: List[str] = Field(default=[])
    errors: List[str] = Field(default=[])
    processing_time: float
    
class SearchResult(BaseModel):
    """Result of project search"""
    projects: List[ProjectSummary]
    total_count: int
    filtered_count: int
    facets: Dict[str, Any] = Field(default={})
    search_time: float
