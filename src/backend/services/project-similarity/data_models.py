"""
Data Models for Similar Project Identification Service
Story 4.3: Comprehensive data models for project similarity and analysis
"""

from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any, Union
from datetime import datetime, date
from enum import Enum
import uuid

# Enums for standardized values
class SimilarityMethod(str, Enum):
    COSINE = "cosine"
    EUCLIDEAN = "euclidean"
    JACCARD = "jaccard"
    PEARSON = "pearson"
    MANHATTAN = "manhattan"
    WEIGHTED_ENSEMBLE = "weighted_ensemble"

class SimilarityContext(str, Enum):
    ESTIMATION_VALIDATION = "estimation_validation"
    RISK_ASSESSMENT = "risk_assessment"
    BEST_PRACTICES = "best_practices"
    BENCHMARKING = "benchmarking"
    GENERAL_REFERENCE = "general_reference"

class ProjectCategory(str, Enum):
    COMMERCIAL = "commercial"
    INDUSTRIAL = "industrial"
    RESIDENTIAL = "residential"
    INFRASTRUCTURE = "infrastructure"
    RENEWABLE = "renewable"
    RETROFIT = "retrofit"
    MAINTENANCE = "maintenance"

class IndustryCategory(str, Enum):
    OIL_GAS = "oil_gas"
    MANUFACTURING = "manufacturing"
    COMMERCIAL_BUILDING = "commercial_building"
    HEALTHCARE = "healthcare"
    EDUCATION = "education"
    TRANSPORTATION = "transportation"
    UTILITIES = "utilities"
    MINING = "mining"

class ComplexityLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class RecommendationType(str, Enum):
    STRATEGY = "strategy"
    RISK_MITIGATION = "risk_mitigation"
    RESOURCE_OPTIMIZATION = "resource_optimization"
    SCHEDULE = "schedule"
    QUALITY = "quality"
    COST_OPTIMIZATION = "cost_optimization"

# Core similarity models
class ProjectCharacteristics(BaseModel):
    """Core characteristics used for project fingerprinting"""
    
    # Basic project info
    project_type: ProjectCategory = Field(..., description="Type of project")
    industry_category: IndustryCategory = Field(..., description="Industry category")
    project_scale: str = Field(..., description="Project scale: small, medium, large, mega")
    
    # Financial characteristics
    total_cost: float = Field(..., description="Total project cost")
    cost_per_sqft: Optional[float] = Field(None, description="Cost per square foot")
    labor_percentage: float = Field(..., description="Labor cost as percentage of total")
    
    # Technical characteristics
    voltage_levels: List[str] = Field(default=[], description="Voltage levels involved")
    system_types: List[str] = Field(default=[], description="Types of electrical systems")
    component_count: int = Field(..., description="Estimated component count")
    installation_methods: List[str] = Field(default=[], description="Installation methods used")
    
    # Scope characteristics
    total_area: Optional[float] = Field(None, description="Total project area in sq ft")
    floor_count: Optional[int] = Field(None, description="Number of floors")
    zone_count: Optional[int] = Field(None, description="Number of electrical zones")
    
    # Timeline characteristics
    planned_duration: int = Field(..., description="Planned duration in days")
    seasonal_timing: str = Field(..., description="Season when project executed")
    schedule_pressure: str = Field("normal", description="Schedule pressure level")
    
    # Environmental characteristics
    climate_zone: str = Field(..., description="Climate zone")
    urban_rural: str = Field(..., description="Urban or rural setting")
    site_accessibility: str = Field("normal", description="Site accessibility level")
    
    # Complexity characteristics
    technical_complexity: float = Field(..., description="Technical complexity score (1-10)")
    coordination_complexity: float = Field(..., description="Coordination complexity score (1-10)")
    site_complexity: float = Field(..., description="Site complexity score (1-10)")
    integration_complexity: float = Field(..., description="Integration complexity score (1-10)")
    overall_complexity: float = Field(..., description="Overall complexity score (1-10)")

class ProjectFingerprint(BaseModel):
    """Comprehensive project fingerprint for similarity analysis"""
    fingerprint_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique fingerprint ID")
    project_id: Optional[str] = Field(None, description="Associated project ID")
    created_at: datetime = Field(default_factory=datetime.now, description="Fingerprint creation time")
    
    # Core project identification
    project_name: str = Field(..., description="Project name")
    project_type: ProjectCategory = Field(..., description="Project type")
    industry_category: IndustryCategory = Field(..., description="Industry category")
    
    # Feature categories
    technical_metrics: Dict[str, Any] = Field(default={}, description="Technical feature metrics")
    scope_metrics: Dict[str, Any] = Field(default={}, description="Scope feature metrics")
    cost_metrics: Dict[str, Any] = Field(default={}, description="Cost feature metrics")
    location_metrics: Dict[str, Any] = Field(default={}, description="Location feature metrics")
    timeline_metrics: Dict[str, Any] = Field(default={}, description="Timeline feature metrics")
    complexity_metrics: Dict[str, Any] = Field(default={}, description="Complexity feature metrics")
    
    # Feature vector for ML algorithms
    features: Dict[str, float] = Field(default={}, description="Normalized feature vector")
    feature_names: List[str] = Field(default=[], description="Feature names in order")
    
    # Fingerprint metadata
    fingerprint_version: str = Field("1.0", description="Fingerprint algorithm version")
    data_completeness: float = Field(..., description="Completeness of input data (0-1)")
    confidence_score: float = Field(..., description="Confidence in fingerprint accuracy")
    
    # Summary statistics
    summary_stats: Dict[str, Any] = Field(default={}, description="Summary statistics")
    
    @validator('data_completeness', 'confidence_score')
    def validate_scores(cls, v):
        if v < 0 or v > 1:
            raise ValueError('Scores must be between 0 and 1')
        return v

class SimilarityWeights(BaseModel):
    """Configurable weights for different similarity dimensions"""
    
    # Primary dimension weights
    technical_similarity: float = Field(0.25, description="Weight for technical similarity")
    scope_similarity: float = Field(0.20, description="Weight for scope similarity")
    cost_similarity: float = Field(0.15, description="Weight for cost similarity")
    location_similarity: float = Field(0.10, description="Weight for location similarity")
    timeline_similarity: float = Field(0.10, description="Weight for timeline similarity")
    complexity_similarity: float = Field(0.15, description="Weight for complexity similarity")
    industry_similarity: float = Field(0.05, description="Weight for industry similarity")
    
    # Context-specific adjustments
    context: Optional[SimilarityContext] = Field(None, description="Similarity context")
    
    @validator('*')
    def validate_weights(cls, v, field):
        if field.name != 'context' and (v < 0 or v > 1):
            raise ValueError(f'{field.name} weight must be between 0 and 1')
        return v
    
    def normalize_weights(self) -> 'SimilarityWeights':
        """Normalize weights to sum to 1.0"""
        total = (self.technical_similarity + self.scope_similarity + 
                self.cost_similarity + self.location_similarity + 
                self.timeline_similarity + self.complexity_similarity + 
                self.industry_similarity)
        
        if total > 0:
            factor = 1.0 / total
            return SimilarityWeights(
                technical_similarity=self.technical_similarity * factor,
                scope_similarity=self.scope_similarity * factor,
                cost_similarity=self.cost_similarity * factor,
                location_similarity=self.location_similarity * factor,
                timeline_similarity=self.timeline_similarity * factor,
                complexity_similarity=self.complexity_similarity * factor,
                industry_similarity=self.industry_similarity * factor,
                context=self.context
            )
        return self

class SimilarityScore(BaseModel):
    """Detailed similarity score breakdown"""
    overall_score: float = Field(..., description="Overall similarity score (0-1)")
    
    # Dimension-specific scores
    technical_score: float = Field(..., description="Technical similarity score")
    scope_score: float = Field(..., description="Scope similarity score")
    cost_score: float = Field(..., description="Cost similarity score")
    location_score: float = Field(..., description="Location similarity score")
    timeline_score: float = Field(..., description="Timeline similarity score")
    complexity_score: float = Field(..., description="Complexity similarity score")
    industry_score: float = Field(..., description="Industry similarity score")
    
    # Calculation metadata
    method_used: SimilarityMethod = Field(..., description="Similarity calculation method")
    weights_applied: SimilarityWeights = Field(..., description="Weights used in calculation")
    confidence: float = Field(..., description="Confidence in similarity score")
    
    @validator('*')
    def validate_scores(cls, v, field):
        if field.name.endswith('_score') or field.name == 'overall_score' or field.name == 'confidence':
            if v < 0 or v > 1:
                raise ValueError(f'{field.name} must be between 0 and 1')
        return v

class SimilarityResult(BaseModel):
    """Result of similarity analysis for a single project"""
    target_project_id: str = Field(..., description="ID of target project")
    similar_project_id: str = Field(..., description="ID of similar project")
    similar_project_name: str = Field(..., description="Name of similar project")
    
    # Similarity analysis
    similarity_score: SimilarityScore = Field(..., description="Detailed similarity scores")
    
    # Project summary for comparison
    project_summary: Dict[str, Any] = Field(..., description="Summary of similar project")
    
    # Similarity insights
    key_similarities: List[str] = Field(default=[], description="Key similarity factors")
    key_differences: List[str] = Field(default=[], description="Key differences")
    similarity_explanation: str = Field(..., description="Human-readable explanation")
    
    # Performance comparison
    performance_comparison: Optional[Dict[str, Any]] = Field(None, description="Performance metrics comparison")
    
    # Metadata
    calculation_date: datetime = Field(default_factory=datetime.now, description="When similarity calculated")
    data_sources: List[str] = Field(default=[], description="Data sources used")

class SimilarityMetrics(BaseModel):
    """Comprehensive similarity search metrics"""
    search_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique search ID")
    
    # Search parameters
    query_fingerprint: ProjectFingerprint = Field(..., description="Query project fingerprint")
    similarity_weights: SimilarityWeights = Field(..., description="Weights used")
    similarity_threshold: float = Field(..., description="Minimum similarity threshold")
    
    # Search results
    total_projects_evaluated: int = Field(..., description="Total projects in database")
    projects_meeting_threshold: int = Field(..., description="Projects meeting threshold")
    projects_returned: int = Field(..., description="Projects returned to user")
    
    # Quality metrics
    average_similarity: float = Field(..., description="Average similarity of results")
    similarity_distribution: Dict[str, int] = Field(default={}, description="Distribution by similarity ranges")
    search_quality_score: float = Field(..., description="Overall search quality (0-1)")
    
    # Performance metrics
    search_time_ms: float = Field(..., description="Search time in milliseconds")
    cache_hit_rate: float = Field(0.0, description="Cache hit rate for this search")
    
    # Search metadata
    search_timestamp: datetime = Field(default_factory=datetime.now, description="Search timestamp")
    algorithm_version: str = Field("1.0", description="Similarity algorithm version")

class ProjectComparison(BaseModel):
    """Detailed comparison between projects"""
    comparison_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique comparison ID")
    
    # Projects being compared
    target_project: Dict[str, Any] = Field(..., description="Target project data")
    comparison_projects: List[Dict[str, Any]] = Field(..., description="Projects being compared against")
    
    # Comparison dimensions
    dimensions_analyzed: List[str] = Field(..., description="Dimensions included in comparison")
    
    # Comparison results
    similarity_matrix: Dict[str, Dict[str, float]] = Field(..., description="Pairwise similarity scores")
    
    # Detailed analysis
    cost_comparison: Dict[str, Any] = Field(default={}, description="Cost comparison analysis")
    timeline_comparison: Dict[str, Any] = Field(default={}, description="Timeline comparison analysis")
    performance_comparison: Dict[str, Any] = Field(default={}, description="Performance comparison analysis")
    quality_comparison: Dict[str, Any] = Field(default={}, description="Quality comparison analysis")
    
    # Insights and recommendations
    key_insights: List[str] = Field(default=[], description="Key insights from comparison")
    performance_gaps: List[Dict[str, Any]] = Field(default=[], description="Identified performance gaps")
    improvement_opportunities: List[str] = Field(default=[], description="Improvement opportunities")
    
    # Statistical analysis
    statistical_significance: Dict[str, float] = Field(default={}, description="Statistical significance of differences")
    confidence_intervals: Dict[str, Dict[str, float]] = Field(default={}, description="Confidence intervals for metrics")
    
    # Metadata
    comparison_date: datetime = Field(default_factory=datetime.now, description="Comparison date")
    analysis_method: str = Field("comprehensive", description="Analysis method used")

class PerformanceAnalysis(BaseModel):
    """Analysis of performance patterns in similar projects"""
    analysis_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique analysis ID")
    
    # Analysis scope
    projects_analyzed: int = Field(..., description="Number of projects analyzed")
    similarity_threshold: float = Field(..., description="Similarity threshold used")
    time_period: Optional[Dict[str, date]] = Field(None, description="Time period analyzed")
    
    # Performance patterns
    success_patterns: List[Dict[str, Any]] = Field(default=[], description="Identified success patterns")
    failure_patterns: List[Dict[str, Any]] = Field(default=[], description="Identified failure patterns")
    risk_indicators: List[Dict[str, Any]] = Field(default=[], description="Early risk indicators")
    
    # Statistical analysis
    performance_statistics: Dict[str, Any] = Field(default={}, description="Performance statistics")
    correlation_analysis: Dict[str, float] = Field(default={}, description="Factor correlation analysis")
    trend_analysis: Dict[str, Any] = Field(default={}, description="Performance trend analysis")
    
    # Best practices
    best_practices: List[Dict[str, Any]] = Field(default=[], description="Identified best practices")
    lessons_learned: List[str] = Field(default=[], description="Key lessons learned")
    
    # Predictive insights
    success_probability: Optional[float] = Field(None, description="Predicted success probability")
    risk_assessment: Dict[str, Any] = Field(default={}, description="Risk assessment")
    
    # Metadata
    analysis_date: datetime = Field(default_factory=datetime.now, description="Analysis date")
    confidence_level: float = Field(0.95, description="Statistical confidence level")
    
    @validator('success_probability')
    def validate_probability(cls, v):
        if v is not None and (v < 0 or v > 1):
            raise ValueError('Success probability must be between 0 and 1')
        return v

class ProjectRecommendation(BaseModel):
    """Actionable recommendation based on similar project analysis"""
    recommendation_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique recommendation ID")
    
    # Recommendation details
    recommendation_type: RecommendationType = Field(..., description="Type of recommendation")
    title: str = Field(..., description="Recommendation title")
    description: str = Field(..., description="Detailed recommendation description")
    
    # Supporting evidence
    supporting_projects: List[str] = Field(..., description="IDs of projects supporting this recommendation")
    evidence_strength: float = Field(..., description="Strength of supporting evidence (0-1)")
    confidence_score: float = Field(..., description="Confidence in recommendation (0-1)")
    
    # Implementation guidance
    action_items: List[str] = Field(default=[], description="Specific action items")
    implementation_effort: str = Field(..., description="Implementation effort: low, medium, high")
    expected_impact: str = Field(..., description="Expected impact: low, medium, high")
    
    # Risk and timeline
    implementation_risks: List[str] = Field(default=[], description="Implementation risks")
    estimated_timeline: Optional[str] = Field(None, description="Estimated implementation timeline")
    resource_requirements: List[str] = Field(default=[], description="Required resources")
    
    # Success metrics
    success_criteria: List[str] = Field(default=[], description="Success measurement criteria")
    expected_outcomes: List[str] = Field(default=[], description="Expected outcomes")
    
    # Metadata
    generated_date: datetime = Field(default_factory=datetime.now, description="Recommendation generation date")
    source_analysis: str = Field(..., description="Source analysis that generated recommendation")
    priority_score: float = Field(..., description="Priority score for implementation (0-1)")
    
    @validator('evidence_strength', 'confidence_score', 'priority_score')
    def validate_scores(cls, v):
        if v < 0 or v > 1:
            raise ValueError('Scores must be between 0 and 1')
        return v

class BenchmarkResult(BaseModel):
    """Result of project benchmarking analysis"""
    benchmark_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique benchmark ID")
    
    # Benchmark parameters
    target_project: Dict[str, Any] = Field(..., description="Project being benchmarked")
    benchmark_type: str = Field(..., description="Type of benchmark")
    comparison_pool: int = Field(..., description="Number of projects in comparison pool")
    
    # Benchmark results
    percentile_rankings: Dict[str, float] = Field(..., description="Percentile rankings by metric")
    benchmark_metrics: Dict[str, Any] = Field(..., description="Benchmark metric values")
    
    # Performance comparison
    above_benchmark: List[str] = Field(default=[], description="Metrics above benchmark")
    below_benchmark: List[str] = Field(default=[], description="Metrics below benchmark")
    
    # Industry context
    industry_averages: Dict[str, float] = Field(default={}, description="Industry average values")
    regional_context: Optional[Dict[str, Any]] = Field(None, description="Regional comparison context")
    
    # Insights
    key_strengths: List[str] = Field(default=[], description="Identified strengths")
    improvement_areas: List[str] = Field(default=[], description="Areas for improvement")
    competitive_position: str = Field(..., description="Overall competitive position")
    
    # Metadata
    benchmark_date: datetime = Field(default_factory=datetime.now, description="Benchmark date")
    data_anonymized: bool = Field(True, description="Whether competitive data is anonymized")
    confidence_level: float = Field(0.95, description="Statistical confidence level")

# Request and response aggregation models
class SimilaritySearchRequest(BaseModel):
    """Comprehensive similarity search request"""
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique request ID")
    
    # Search parameters
    target_project: Dict[str, Any] = Field(..., description="Target project for similarity search")
    similarity_context: SimilarityContext = Field(..., description="Context for similarity search")
    similarity_weights: Optional[SimilarityWeights] = Field(None, description="Custom similarity weights")
    
    # Search constraints
    similarity_threshold: float = Field(0.6, description="Minimum similarity threshold")
    max_results: int = Field(20, description="Maximum number of results")
    exclude_projects: List[str] = Field(default=[], description="Project IDs to exclude")
    
    # Analysis options
    include_performance_analysis: bool = Field(True, description="Include performance analysis")
    include_recommendations: bool = Field(True, description="Include recommendations")
    detailed_breakdown: bool = Field(False, description="Include detailed similarity breakdown")
    
    # Request metadata
    requester_id: Optional[str] = Field(None, description="ID of requesting user")
    request_timestamp: datetime = Field(default_factory=datetime.now, description="Request timestamp")

class SimilaritySearchResponse(BaseModel):
    """Comprehensive similarity search response"""
    request_id: str = Field(..., description="Original request ID")
    
    # Search results
    similar_projects: List[SimilarityResult] = Field(..., description="Similar projects found")
    similarity_metrics: SimilarityMetrics = Field(..., description="Search metrics")
    
    # Analysis results
    performance_analysis: Optional[PerformanceAnalysis] = Field(None, description="Performance analysis")
    recommendations: List[ProjectRecommendation] = Field(default=[], description="Generated recommendations")
    
    # Search metadata
    search_summary: Dict[str, Any] = Field(..., description="Search summary statistics")
    processing_time: float = Field(..., description="Total processing time in seconds")
    response_timestamp: datetime = Field(default_factory=datetime.now, description="Response timestamp")
    
    # Quality indicators
    result_quality_score: float = Field(..., description="Quality score for results (0-1)")
    confidence_level: float = Field(..., description="Overall confidence in results (0-1)")

# Analytics and reporting models
class SimilarityAnalytics(BaseModel):
    """Analytics for similarity search patterns and performance"""
    analytics_period: Dict[str, date] = Field(..., description="Analytics time period")
    
    # Usage analytics
    total_searches: int = Field(..., description="Total similarity searches")
    unique_users: int = Field(..., description="Unique users performing searches")
    search_patterns: Dict[str, Any] = Field(default={}, description="Search pattern analysis")
    
    # Performance analytics
    average_search_time: float = Field(..., description="Average search time in seconds")
    cache_hit_rate: float = Field(..., description="Overall cache hit rate")
    search_quality_trends: List[Dict[str, Any]] = Field(default=[], description="Search quality over time")
    
    # User behavior analytics
    popular_similarity_contexts: Dict[str, int] = Field(default={}, description="Popular search contexts")
    common_similarity_thresholds: List[float] = Field(default=[], description="Commonly used thresholds")
    recommendation_adoption_rate: float = Field(..., description="Rate of recommendation adoption")
    
    # Business impact
    estimated_time_saved: float = Field(..., description="Estimated time saved in hours")
    decision_support_metrics: Dict[str, Any] = Field(default={}, description="Decision support impact")
    
    # Quality metrics
    user_satisfaction_score: float = Field(..., description="User satisfaction score (0-1)")
    accuracy_metrics: Dict[str, float] = Field(default={}, description="Accuracy metrics")
    
    @validator('user_satisfaction_score')
    def validate_satisfaction(cls, v):
        if v < 0 or v > 1:
            raise ValueError('Satisfaction score must be between 0 and 1')
        return v

# Validation and configuration models
class SimilarityConfiguration(BaseModel):
    """Configuration for similarity engine"""
    
    # Algorithm settings
    default_similarity_method: SimilarityMethod = Field(SimilarityMethod.WEIGHTED_ENSEMBLE, description="Default similarity method")
    default_weights: SimilarityWeights = Field(default_factory=SimilarityWeights, description="Default similarity weights")
    
    # Performance settings
    cache_ttl_seconds: int = Field(3600, description="Cache TTL in seconds")
    max_concurrent_searches: int = Field(10, description="Maximum concurrent searches")
    search_timeout_seconds: int = Field(30, description="Search timeout in seconds")
    
    # Quality settings
    min_data_completeness: float = Field(0.7, description="Minimum data completeness for search")
    min_similarity_confidence: float = Field(0.5, description="Minimum similarity confidence")
    
    # Feature engineering settings
    feature_normalization_method: str = Field("standard", description="Feature normalization method")
    outlier_detection_enabled: bool = Field(True, description="Enable outlier detection")
    
    # Analytics settings
    enable_search_analytics: bool = Field(True, description="Enable search analytics")
    analytics_retention_days: int = Field(90, description="Analytics data retention period")
    
    @validator('min_data_completeness', 'min_similarity_confidence')
    def validate_thresholds(cls, v):
        if v < 0 or v > 1:
            raise ValueError('Thresholds must be between 0 and 1')
        return v
