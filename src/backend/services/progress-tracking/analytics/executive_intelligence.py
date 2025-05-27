# Executive Intelligence Engine - Story 5.3 Management Reporting & Analytics
# Executive-level business intelligence and strategic decision support

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass, field, asdict
from enum import Enum
import statistics
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.orm import selectinload

from ..data_models import (
    HourLogTable, ProductivityMetricsTable, ComplianceCheckTable,
    TimeClockTable
)

logger = logging.getLogger(__name__)

class MetricCategory(str, Enum):
    FINANCIAL = "financial"
    OPERATIONAL = "operational"
    STRATEGIC = "strategic"
    RISK = "risk"

class InsightPriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class TrendDirection(str, Enum):
    IMPROVING = "improving"
    DECLINING = "declining"
    STABLE = "stable"
    VOLATILE = "volatile"

@dataclass
class FinancialMetrics:
    """Executive financial performance metrics"""
    total_revenue: float
    profit_margin: float
    cost_per_project: float
    budget_variance: float
    cash_flow: float
    revenue_growth: float
    project_roi: float
    cost_per_hour: float
    billing_efficiency: float
    accounts_receivable: float
    gross_margin: float
    operating_margin: float

@dataclass
class OperationalMetrics:
    """Executive operational performance metrics"""
    projects_completed: int
    projects_in_progress: int
    on_time_delivery: float
    quality_score: float
    resource_utilization: float
    productivity_index: float
    customer_satisfaction: float
    safety_score: float
    team_efficiency: float
    rework_rate: float
    change_order_rate: float
    client_retention_rate: float

@dataclass
class StrategicMetrics:
    """Executive strategic performance metrics"""
    market_share: float
    competitive_position: float
    innovation_index: float
    employee_engagement: float
    skills_development: float
    technology_adoption: float
    sustainability_score: float
    risk_mitigation_score: float

@dataclass
class TrendData:
    """Time series trend data"""
    period: str
    value: float
    target: Optional[float] = None
    benchmark: Optional[float] = None

@dataclass
class BenchmarkData:
    """Industry and competitive benchmark data"""
    revenue: float
    profit_margin: float
    efficiency: float
    quality: float
    safety: float

@dataclass
class ForecastData:
    """Predictive forecast data"""
    period: str
    predicted: float
    confidence: float
    scenario: str  # optimistic, realistic, pessimistic

@dataclass
class ExecutiveInsight:
    """Strategic insight and recommendation"""
    id: str
    category: MetricCategory
    priority: InsightPriority
    title: str
    description: str
    recommendation: str
    impact: float  # 0-10 scale
    effort: float  # 0-10 scale
    timeline: str
    data: Optional[Dict[str, Any]] = None

@dataclass
class ExecutiveData:
    """Complete executive dashboard data"""
    financial: FinancialMetrics
    operational: OperationalMetrics
    strategic: StrategicMetrics
    trends: Dict[str, List[TrendData]]
    benchmarks: Dict[str, BenchmarkData]
    forecasts: Dict[str, List[ForecastData]]
    insights: List[ExecutiveInsight]
    last_updated: str

class ExecutiveIntelligenceEngine:
    """
    Executive-level business intelligence engine:
    - Strategic KPI calculation and analysis
    - Predictive analytics and forecasting
    - Competitive benchmarking
    - Actionable insights generation
    - Board-ready reporting
    """
    
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.benchmark_data = self._load_benchmark_data()
        self.strategic_weights = self._load_strategic_weights()
        
    def _load_benchmark_data(self) -> Dict[str, Any]:
        """Load industry benchmark data"""
        return {
            "electrical_contracting": {
                "profit_margin": 12.5,
                "revenue_growth": 8.2,
                "on_time_delivery": 87.3,
                "quality_score": 4.1,
                "safety_score": 94.2,
                "resource_utilization": 78.5,
                "customer_satisfaction": 4.3,
                "employee_turnover": 15.2
            },
            "construction_industry": {
                "profit_margin": 10.8,
                "revenue_growth": 6.5,
                "on_time_delivery": 82.1,
                "quality_score": 3.9,
                "safety_score": 91.8,
                "resource_utilization": 75.2
            },
            "regional_average": {
                "profit_margin": 11.2,
                "revenue_growth": 7.1,
                "on_time_delivery": 84.7,
                "quality_score": 4.0,
                "safety_score": 92.5
            }
        }
    
    def _load_strategic_weights(self) -> Dict[str, float]:
        """Load strategic metric weights for scoring"""
        return {
            "financial_weight": 0.35,
            "operational_weight": 0.40,
            "strategic_weight": 0.25,
            "safety_multiplier": 1.5,  # Safety gets extra weight
            "quality_multiplier": 1.3,  # Quality is critical
            "growth_multiplier": 1.2   # Growth is important
        }
    
    async def generate_executive_dashboard(self, organization_id: Optional[str] = None,
                                         timeframe: str = 'quarter',
                                         include_benchmarks: bool = True,
                                         include_forecasts: bool = True) -> ExecutiveData:
        """
        Generate comprehensive executive dashboard
        
        Features:
        - Financial performance analysis
        - Operational excellence metrics
        - Strategic positioning assessment
        - Predictive analytics and forecasting
        - Competitive benchmarking
        - Actionable insights generation
        """
        try:
            # Calculate time boundaries
            end_date = datetime.now(timezone.utc)
            if timeframe == 'month':
                start_date = end_date - timedelta(days=30)
            elif timeframe == 'quarter':
                start_date = end_date - timedelta(days=90)
            elif timeframe == 'year':
                start_date = end_date - timedelta(days=365)
            else:
                start_date = end_date - timedelta(days=90)
            
            # Calculate core metrics
            financial_metrics = await self._calculate_financial_metrics(
                organization_id, start_date, end_date
            )
            
            operational_metrics = await self._calculate_operational_metrics(
                organization_id, start_date, end_date
            )
            
            strategic_metrics = await self._calculate_strategic_metrics(
                organization_id, start_date, end_date
            )
            
            # Generate trends
            trends = await self._calculate_trend_analysis(
                organization_id, start_date, end_date
            )
            
            # Generate benchmarks
            benchmarks = {}
            if include_benchmarks:
                benchmarks = await self._generate_benchmark_analysis(
                    financial_metrics, operational_metrics, strategic_metrics
                )
            
            # Generate forecasts
            forecasts = {}
            if include_forecasts:
                forecasts = await self._generate_forecasts(
                    organization_id, financial_metrics, operational_metrics
                )
            
            # Generate strategic insights
            insights = await self._generate_strategic_insights(
                financial_metrics, operational_metrics, strategic_metrics,
                trends, benchmarks
            )
            
            return ExecutiveData(
                financial=financial_metrics,
                operational=operational_metrics,
                strategic=strategic_metrics,
                trends=trends,
                benchmarks=benchmarks,
                forecasts=forecasts,
                insights=insights,
                last_updated=datetime.now(timezone.utc).isoformat()
            )
            
        except Exception as e:
            logger.error(f"Error generating executive dashboard: {e}")
            raise
    
    async def _calculate_financial_metrics(self, organization_id: Optional[str],
                                         start_date: datetime,
                                         end_date: datetime) -> FinancialMetrics:
        """Calculate comprehensive financial performance metrics"""
        try:
            # Get project and hour data
            base_query = select(HourLogTable).where(
                and_(
                    HourLogTable.start_time >= start_date,
                    HourLogTable.start_time <= end_date,
                    HourLogTable.status.in_(["completed", "approved"])
                )
            )
            
            if organization_id:
                # In production, would filter by organization
                pass
            
            result = await self.db.execute(base_query)
            hour_logs = result.scalars().all()
            
            # Calculate basic financial metrics
            total_hours = sum(log.hours_worked or Decimal('0') for log in hour_logs)
            
            # Mock financial calculations (in production, integrate with accounting system)
            # These would come from actual financial data integration
            estimated_hourly_rate = Decimal('125.00')  # Average billable rate
            total_revenue = float(total_hours * estimated_hourly_rate)
            
            # Calculate costs (simplified)
            labor_cost_rate = Decimal('85.00')  # Average cost per hour
            total_labor_cost = float(total_hours * labor_cost_rate)
            overhead_rate = 0.25  # 25% overhead
            total_cost = total_labor_cost * (1 + overhead_rate)
            
            profit = total_revenue - total_cost
            profit_margin = (profit / total_revenue * 100) if total_revenue > 0 else 0
            
            # Calculate other metrics
            project_count = len(set(log.project_id for log in hour_logs))
            cost_per_project = total_cost / max(project_count, 1)
            cost_per_hour = total_cost / float(total_hours) if total_hours > 0 else 0
            
            # Calculate growth (mock - would use historical data)
            previous_period_revenue = total_revenue * 0.92  # Mock 8% growth
            revenue_growth = (total_revenue - previous_period_revenue) / previous_period_revenue
            
            # Calculate efficiency metrics
            billable_hours = sum(
                log.hours_worked or Decimal('0') for log in hour_logs 
                if log.completion_percentage >= 100
            )
            billing_efficiency = float(billable_hours / total_hours) if total_hours > 0 else 0
            
            return FinancialMetrics(
                total_revenue=total_revenue,
                profit_margin=profit_margin,
                cost_per_project=cost_per_project,
                budget_variance=0.05,  # Mock 5% positive variance
                cash_flow=profit * 0.8,  # Mock cash flow
                revenue_growth=revenue_growth,
                project_roi=25.5,  # Mock ROI
                cost_per_hour=cost_per_hour,
                billing_efficiency=billing_efficiency,
                accounts_receivable=total_revenue * 0.15,  # Mock AR
                gross_margin=profit_margin + 10,  # Mock gross margin
                operating_margin=profit_margin - 3  # Mock operating margin
            )
            
        except Exception as e:
            logger.error(f"Error calculating financial metrics: {e}")
            raise
    
    async def _calculate_operational_metrics(self, organization_id: Optional[str],
                                           start_date: datetime,
                                           end_date: datetime) -> OperationalMetrics:
        """Calculate comprehensive operational performance metrics"""
        try:
            # Get operational data
            result = await self.db.execute(
                select(HourLogTable).where(
                    and_(
                        HourLogTable.start_time >= start_date,
                        HourLogTable.start_time <= end_date,
                        HourLogTable.status.in_(["completed", "approved"])
                    )
                )
            )
            hour_logs = result.scalars().all()
            
            # Calculate project metrics
            projects = set(log.project_id for log in hour_logs)
            projects_completed = len([p for p in projects])  # Simplified
            projects_in_progress = max(int(projects_completed * 0.3), 1)  # Mock
            
            # Calculate delivery performance
            completed_tasks = len([log for log in hour_logs if log.completion_percentage >= 100])
            total_tasks = len(hour_logs)
            on_time_delivery = 87.5  # Mock - would calculate from actual deadlines
            
            # Calculate quality metrics
            quality_ratings = [log.quality_rating for log in hour_logs if log.quality_rating]
            quality_score = statistics.mean(quality_ratings) if quality_ratings else 4.0
            
            # Calculate resource utilization
            total_hours = sum(log.hours_worked or Decimal('0') for log in hour_logs)
            productive_hours = sum(
                (log.hours_worked or Decimal('0')) - (log.break_time or Decimal('0'))
                for log in hour_logs
            )
            resource_utilization = float(productive_hours / total_hours * 100) if total_hours > 0 else 0
            
            # Calculate productivity index
            productivity_index = (completed_tasks / float(total_hours)) * 100 if total_hours > 0 else 0
            
            # Calculate team efficiency
            team_efficiency = resource_utilization * (quality_score / 5.0)
            
            # Mock additional metrics (would calculate from actual data)
            customer_satisfaction = 4.2
            safety_score = 96.5
            rework_rate = 3.2
            change_order_rate = 8.5
            client_retention_rate = 92.0
            
            return OperationalMetrics(
                projects_completed=projects_completed,
                projects_in_progress=projects_in_progress,
                on_time_delivery=on_time_delivery,
                quality_score=quality_score,
                resource_utilization=resource_utilization,
                productivity_index=productivity_index,
                customer_satisfaction=customer_satisfaction,
                safety_score=safety_score,
                team_efficiency=team_efficiency,
                rework_rate=rework_rate,
                change_order_rate=change_order_rate,
                client_retention_rate=client_retention_rate
            )
            
        except Exception as e:
            logger.error(f"Error calculating operational metrics: {e}")
            raise
    
    async def _calculate_strategic_metrics(self, organization_id: Optional[str],
                                         start_date: datetime,
                                         end_date: datetime) -> StrategicMetrics:
        """Calculate strategic positioning and future-focused metrics"""
        try:
            # Strategic metrics are typically calculated from broader business data
            # For demonstration, using mock values that would come from:
            # - Market research data
            # - Employee surveys
            # - Technology assessments
            # - Competitive analysis
            
            return StrategicMetrics(
                market_share=15.2,  # From market research
                competitive_position=3.8,  # From competitive analysis (1-5 scale)
                innovation_index=72.5,  # From technology adoption metrics
                employee_engagement=78.3,  # From employee surveys
                skills_development=82.1,  # From training and certification data
                technology_adoption=85.6,  # From IT systems analysis
                sustainability_score=69.4,  # From environmental impact assessment
                risk_mitigation_score=91.2  # From risk management analysis
            )
            
        except Exception as e:
            logger.error(f"Error calculating strategic metrics: {e}")
            raise
    
    async def _calculate_trend_analysis(self, organization_id: Optional[str],
                                      start_date: datetime,
                                      end_date: datetime) -> Dict[str, List[TrendData]]:
        """Calculate historical trends for key metrics"""
        try:
            # Calculate trends over the past 12 months
            trends = {}
            
            # Revenue trend (mock data - would calculate from actual historical data)
            revenue_trend = []
            base_revenue = 1000000
            for i in range(12):
                month_date = start_date + timedelta(days=30 * i)
                # Mock revenue growth with some variance
                revenue = base_revenue * (1 + (i * 0.08 / 12) + np.random.normal(0, 0.02))
                revenue_trend.append(TrendData(
                    period=month_date.strftime('%Y-%m'),
                    value=revenue,
                    target=base_revenue * 1.1,
                    benchmark=base_revenue * 1.05
                ))
            trends['revenue'] = revenue_trend
            
            # Profitability trend
            profitability_trend = []
            base_margin = 12.0
            for i in range(12):
                month_date = start_date + timedelta(days=30 * i)
                margin = base_margin + (i * 0.5 / 12) + np.random.normal(0, 0.5)
                profitability_trend.append(TrendData(
                    period=month_date.strftime('%Y-%m'),
                    value=margin,
                    target=15.0,
                    benchmark=12.5
                ))
            trends['profitability'] = profitability_trend
            
            # Efficiency trend
            efficiency_trend = []
            base_efficiency = 75.0
            for i in range(12):
                month_date = start_date + timedelta(days=30 * i)
                efficiency = base_efficiency + (i * 2.0 / 12) + np.random.normal(0, 1.0)
                efficiency_trend.append(TrendData(
                    period=month_date.strftime('%Y-%m'),
                    value=efficiency,
                    target=85.0,
                    benchmark=78.5
                ))
            trends['efficiency'] = efficiency_trend
            
            # Quality trend
            quality_trend = []
            base_quality = 3.8
            for i in range(12):
                month_date = start_date + timedelta(days=30 * i)
                quality = base_quality + (i * 0.3 / 12) + np.random.normal(0, 0.1)
                quality_trend.append(TrendData(
                    period=month_date.strftime('%Y-%m'),
                    value=quality,
                    target=4.5,
                    benchmark=4.1
                ))
            trends['quality'] = quality_trend
            
            # Safety trend
            safety_trend = []
            base_safety = 94.0
            for i in range(12):
                month_date = start_date + timedelta(days=30 * i)
                safety = base_safety + (i * 1.0 / 12) + np.random.normal(0, 0.5)
                safety_trend.append(TrendData(
                    period=month_date.strftime('%Y-%m'),
                    value=safety,
                    target=98.0,
                    benchmark=94.2
                ))
            trends['safety'] = safety_trend
            
            return trends
            
        except Exception as e:
            logger.error(f"Error calculating trend analysis: {e}")
            raise
    
    async def _generate_benchmark_analysis(self, financial: FinancialMetrics,
                                         operational: OperationalMetrics,
                                         strategic: StrategicMetrics) -> Dict[str, BenchmarkData]:
        """Generate competitive benchmark analysis"""
        try:
            # Industry benchmarks
            industry_benchmarks = BenchmarkData(
                revenue=self.benchmark_data["electrical_contracting"]["revenue_growth"],
                profit_margin=self.benchmark_data["electrical_contracting"]["profit_margin"],
                efficiency=self.benchmark_data["electrical_contracting"]["resource_utilization"],
                quality=self.benchmark_data["electrical_contracting"]["quality_score"],
                safety=self.benchmark_data["electrical_contracting"]["safety_score"]
            )
            
            # Regional benchmarks
            regional_benchmarks = BenchmarkData(
                revenue=self.benchmark_data["regional_average"]["revenue_growth"],
                profit_margin=self.benchmark_data["regional_average"]["profit_margin"],
                efficiency=75.0,  # Mock regional efficiency
                quality=self.benchmark_data["regional_average"]["quality_score"],
                safety=self.benchmark_data["regional_average"]["safety_score"]
            )
            
            # Company historical benchmarks (mock)
            company_benchmarks = BenchmarkData(
                revenue=financial.revenue_growth * 0.9,  # 10% below current
                profit_margin=financial.profit_margin * 0.95,  # 5% below current
                efficiency=operational.resource_utilization * 0.9,
                quality=operational.quality_score * 0.95,
                safety=operational.safety_score * 0.98
            )
            
            return {
                "industry": industry_benchmarks,
                "region": regional_benchmarks,
                "company": company_benchmarks
            }
            
        except Exception as e:
            logger.error(f"Error generating benchmark analysis: {e}")
            raise
    
    async def _generate_forecasts(self, organization_id: Optional[str],
                                financial: FinancialMetrics,
                                operational: OperationalMetrics) -> Dict[str, List[ForecastData]]:
        """Generate predictive forecasts"""
        try:
            forecasts = {}
            
            # Revenue forecast (next 12 months)
            revenue_forecast = []
            current_revenue = financial.total_revenue
            growth_rate = financial.revenue_growth
            
            for i in range(1, 13):
                month_date = datetime.now() + timedelta(days=30 * i)
                
                # Realistic scenario
                realistic_revenue = current_revenue * (1 + growth_rate * i / 12)
                revenue_forecast.append(ForecastData(
                    period=month_date.strftime('%Y-%m'),
                    predicted=realistic_revenue,
                    confidence=max(0.9 - i * 0.05, 0.5),  # Decreasing confidence
                    scenario='realistic'
                ))
                
                # Optimistic scenario
                optimistic_revenue = realistic_revenue * 1.2
                revenue_forecast.append(ForecastData(
                    period=month_date.strftime('%Y-%m'),
                    predicted=optimistic_revenue,
                    confidence=max(0.7 - i * 0.05, 0.3),
                    scenario='optimistic'
                ))
                
                # Pessimistic scenario
                pessimistic_revenue = realistic_revenue * 0.8
                revenue_forecast.append(ForecastData(
                    period=month_date.strftime('%Y-%m'),
                    predicted=pessimistic_revenue,
                    confidence=max(0.8 - i * 0.05, 0.4),
                    scenario='pessimistic'
                ))
            
            forecasts['revenue'] = revenue_forecast
            
            # Project forecast
            projects_forecast = []
            current_projects = operational.projects_completed
            
            for i in range(1, 13):
                month_date = datetime.now() + timedelta(days=30 * i)
                predicted_projects = current_projects * (1 + 0.1 * i / 12)  # 10% annual growth
                
                projects_forecast.append(ForecastData(
                    period=month_date.strftime('%Y-%m'),
                    predicted=predicted_projects,
                    confidence=max(0.85 - i * 0.04, 0.5),
                    scenario='realistic'
                ))
            
            forecasts['projects'] = projects_forecast
            
            # Resource forecast
            resources_forecast = []
            current_utilization = operational.resource_utilization
            
            for i in range(1, 13):
                month_date = datetime.now() + timedelta(days=30 * i)
                predicted_utilization = min(current_utilization + i * 0.5, 95.0)  # Cap at 95%
                
                resources_forecast.append(ForecastData(
                    period=month_date.strftime('%Y-%m'),
                    predicted=predicted_utilization,
                    confidence=max(0.9 - i * 0.03, 0.6),
                    scenario='realistic'
                ))
            
            forecasts['resources'] = resources_forecast
            
            return forecasts
            
        except Exception as e:
            logger.error(f"Error generating forecasts: {e}")
            raise
    
    async def _generate_strategic_insights(self, financial: FinancialMetrics,
                                         operational: OperationalMetrics,
                                         strategic: StrategicMetrics,
                                         trends: Dict[str, List[TrendData]],
                                         benchmarks: Dict[str, BenchmarkData]) -> List[ExecutiveInsight]:
        """Generate actionable strategic insights and recommendations"""
        try:
            insights = []
            
            # Financial insights
            if financial.profit_margin < 10:
                insights.append(ExecutiveInsight(
                    id="profit_margin_low",
                    category=MetricCategory.FINANCIAL,
                    priority=InsightPriority.CRITICAL,
                    title="Profit Margin Below Industry Standard",
                    description=f"Current profit margin of {financial.profit_margin:.1f}% is below the industry benchmark of 12.5%",
                    recommendation="Review pricing strategy, optimize cost structure, and improve project efficiency",
                    impact=9.0,
                    effort=7.0,
                    timeline="3-6 months"
                ))
            
            # Revenue growth opportunity
            if financial.revenue_growth > 0.15:
                insights.append(ExecutiveInsight(
                    id="revenue_growth_opportunity",
                    category=MetricCategory.FINANCIAL,
                    priority=InsightPriority.HIGH,
                    title="Strong Revenue Growth Momentum",
                    description=f"Revenue growth of {financial.revenue_growth*100:.1f}% exceeds industry average",
                    recommendation="Consider expanding capacity, entering new markets, or acquiring competitors",
                    impact=8.5,
                    effort=8.0,
                    timeline="6-12 months"
                ))
            
            # Operational excellence
            if operational.resource_utilization > 90:
                insights.append(ExecutiveInsight(
                    id="resource_over_utilization",
                    category=MetricCategory.OPERATIONAL,
                    priority=InsightPriority.HIGH,
                    title="Resource Over-Utilization Risk",
                    description=f"Resource utilization of {operational.resource_utilization:.1f}% may lead to burnout",
                    recommendation="Increase hiring, improve workflow automation, or redistribute workload",
                    impact=7.5,
                    effort=6.0,
                    timeline="2-4 months"
                ))
            
            # Quality leadership
            if operational.quality_score > 4.5 and operational.customer_satisfaction > 4.5:
                insights.append(ExecutiveInsight(
                    id="quality_leadership",
                    category=MetricCategory.STRATEGIC,
                    priority=InsightPriority.MEDIUM,
                    title="Premium Service Positioning Opportunity",
                    description="Exceptional quality scores enable premium pricing strategy",
                    recommendation="Develop premium service tiers and target high-value clients",
                    impact=8.0,
                    effort=5.0,
                    timeline="3-6 months"
                ))
            
            # Safety excellence
            if operational.safety_score > 98:
                insights.append(ExecutiveInsight(
                    id="safety_leadership",
                    category=MetricCategory.STRATEGIC,
                    priority=InsightPriority.MEDIUM,
                    title="Industry Safety Leadership",
                    description="Superior safety performance can be leveraged competitively",
                    recommendation="Market safety leadership, pursue safety certifications, negotiate better insurance rates",
                    impact=6.5,
                    effort=4.0,
                    timeline="6-12 months"
                ))
            
            # Technology adoption
            if strategic.technology_adoption < 70:
                insights.append(ExecutiveInsight(
                    id="technology_gap",
                    category=MetricCategory.STRATEGIC,
                    priority=InsightPriority.HIGH,
                    title="Technology Adoption Gap",
                    description="Technology adoption below industry leaders may impact competitiveness",
                    recommendation="Accelerate digital transformation, invest in automation, upskill workforce",
                    impact=8.5,
                    effort=9.0,
                    timeline="12-18 months"
                ))
            
            # Market share growth
            if strategic.market_share < 20 and financial.revenue_growth > 0.1:
                insights.append(ExecutiveInsight(
                    id="market_share_opportunity",
                    category=MetricCategory.STRATEGIC,
                    priority=InsightPriority.MEDIUM,
                    title="Market Share Expansion Opportunity",
                    description="Strong growth with room for market share expansion",
                    recommendation="Increase marketing investment, expand service offerings, consider strategic acquisitions",
                    impact=7.0,
                    effort=7.5,
                    timeline="12-24 months"
                ))
            
            return sorted(insights, key=lambda x: x.impact * (10 - x.effort), reverse=True)
            
        except Exception as e:
            logger.error(f"Error generating strategic insights: {e}")
            raise
    
    async def generate_board_report(self, organization_id: Optional[str] = None,
                                  timeframe: str = 'quarter') -> Dict[str, Any]:
        """Generate executive board report"""
        try:
            dashboard_data = await self.generate_executive_dashboard(
                organization_id, timeframe, True, True
            )
            
            # Create board-level summary
            board_report = {
                "executive_summary": {
                    "revenue": dashboard_data.financial.total_revenue,
                    "profit_margin": dashboard_data.financial.profit_margin,
                    "revenue_growth": dashboard_data.financial.revenue_growth,
                    "projects_completed": dashboard_data.operational.projects_completed,
                    "customer_satisfaction": dashboard_data.operational.customer_satisfaction,
                    "safety_score": dashboard_data.operational.safety_score
                },
                "key_achievements": [
                    insight.title for insight in dashboard_data.insights 
                    if insight.category == MetricCategory.STRATEGIC and insight.impact > 7.0
                ],
                "critical_issues": [
                    insight.title for insight in dashboard_data.insights
                    if insight.priority == InsightPriority.CRITICAL
                ],
                "strategic_recommendations": [
                    {
                        "title": insight.title,
                        "recommendation": insight.recommendation,
                        "impact": insight.impact,
                        "timeline": insight.timeline
                    }
                    for insight in dashboard_data.insights
                    if insight.priority in [InsightPriority.CRITICAL, InsightPriority.HIGH]
                ],
                "financial_highlights": asdict(dashboard_data.financial),
                "operational_highlights": asdict(dashboard_data.operational),
                "competitive_position": asdict(dashboard_data.benchmarks.get("industry", {})),
                "future_outlook": {
                    "revenue_forecast": dashboard_data.forecasts.get("revenue", [])[:3],
                    "key_risks": [
                        insight.description for insight in dashboard_data.insights
                        if insight.category == MetricCategory.RISK
                    ],
                    "growth_opportunities": [
                        insight.description for insight in dashboard_data.insights
                        if "opportunity" in insight.title.lower()
                    ]
                }
            }
            
            return board_report
            
        except Exception as e:
            logger.error(f"Error generating board report: {e}")
            raise