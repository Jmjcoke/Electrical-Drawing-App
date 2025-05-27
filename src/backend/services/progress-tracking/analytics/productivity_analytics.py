# Productivity Analytics Engine - Story 5.1 Advanced Analytics
# Real-time productivity analysis and reporting for field operations

import asyncio
import logging
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal
from typing import List, Optional, Dict, Any, Tuple
import statistics
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.orm import selectinload

from ..data_models import (
    HourLogTable, ProductivityMetricsTable, ComplianceCheckTable,
    ProductivitySummary, ComplianceSummary, RealTimeStatus
)

logger = logging.getLogger(__name__)

@dataclass
class TrendAnalysis:
    """Trend analysis result"""
    metric: str
    current_value: float
    previous_value: float
    change_percentage: float
    trend_direction: str  # "improving", "declining", "stable"
    confidence: float

@dataclass
class BenchmarkComparison:
    """Benchmark comparison result"""
    metric: str
    user_value: float
    team_average: float
    project_average: float
    industry_benchmark: float
    percentile_ranking: float

@dataclass
class PerformanceInsight:
    """Performance insight and recommendation"""
    category: str  # "efficiency", "quality", "safety", "time_management"
    insight: str
    recommendation: str
    priority: str  # "high", "medium", "low"
    impact_potential: str  # "high", "medium", "low"

class ProductivityAnalyticsEngine:
    """
    Advanced analytics engine for productivity analysis:
    - Real-time performance calculations
    - Trend analysis and forecasting
    - Benchmark comparisons
    - Actionable insights and recommendations
    """
    
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.benchmark_data = self._load_benchmark_data()
        self.industry_standards = self._load_industry_standards()
    
    def _load_benchmark_data(self) -> Dict[str, Any]:
        """Load benchmark data for comparisons"""
        return {
            "efficiency": {
                "excellent": 0.90,
                "good": 0.75,
                "average": 0.60,
                "below_average": 0.45
            },
            "quality": {
                "excellent": 4.5,
                "good": 4.0,
                "average": 3.5,
                "below_average": 3.0
            },
            "productivity": {
                "tasks_per_hour": {
                    "excellent": 1.2,
                    "good": 1.0,
                    "average": 0.8,
                    "below_average": 0.6
                }
            }
        }
    
    def _load_industry_standards(self) -> Dict[str, Any]:
        """Load industry standards and regulations"""
        return {
            "electrical_contracting": {
                "average_efficiency": 0.72,
                "average_quality": 3.8,
                "typical_overtime_rate": 0.15,
                "standard_break_ratio": 0.12
            },
            "safety_requirements": {
                "incident_rate_target": 0.0,
                "near_miss_reporting_rate": 0.05,
                "safety_meeting_frequency": "weekly"
            }
        }
    
    async def calculate_real_time_metrics(self, user_id: str, 
                                        project_id: str,
                                        current_date: date = None) -> Dict[str, Any]:
        """
        Calculate real-time productivity metrics for immediate feedback
        
        Returns comprehensive metrics for dashboards and mobile apps
        """
        try:
            if current_date is None:
                current_date = date.today()
            
            # Get today's hour logs
            start_of_day = datetime.combine(current_date, datetime.min.time())
            end_of_day = datetime.combine(current_date, datetime.max.time())
            
            result = await self.db.execute(
                select(HourLogTable)
                .where(
                    and_(
                        HourLogTable.user_id == user_id,
                        HourLogTable.project_id == project_id,
                        HourLogTable.start_time >= start_of_day,
                        HourLogTable.start_time <= end_of_day,
                        HourLogTable.status.in_(["completed", "active", "approved"])
                    )
                )
            )
            hour_logs = result.scalars().all()
            
            # Calculate basic metrics
            total_hours = sum(log.hours_worked or Decimal('0') for log in hour_logs)
            break_hours = sum(log.break_time or Decimal('0') for log in hour_logs)
            productive_hours = total_hours - break_hours
            
            # Active session detection
            active_sessions = [log for log in hour_logs if log.status == "active"]
            current_session_duration = Decimal('0')
            if active_sessions:
                session = active_sessions[0]
                duration = datetime.now(timezone.utc) - session.start_time
                current_session_duration = Decimal(str(duration.total_seconds() / 3600))
            
            # Quality metrics
            quality_ratings = [log.quality_rating for log in hour_logs if log.quality_rating]
            average_quality = statistics.mean(quality_ratings) if quality_ratings else None
            
            # Completion metrics
            completed_tasks = len([log for log in hour_logs if log.completion_percentage >= 100])
            total_tasks = len(hour_logs)
            completion_rate = (completed_tasks / total_tasks) if total_tasks > 0 else 0
            
            # Efficiency calculation
            if total_hours > 0:
                efficiency = float(productive_hours / total_hours)
            else:
                efficiency = 0.0
            
            # Overtime detection
            overtime_threshold = Decimal('8')
            overtime_hours = max(total_hours - overtime_threshold, Decimal('0'))
            
            # Safety metrics
            safety_notes_count = len([log for log in hour_logs if log.safety_notes])
            
            return {
                "user_id": user_id,
                "project_id": project_id,
                "date": current_date.isoformat(),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                
                # Time metrics
                "total_hours": float(total_hours),
                "productive_hours": float(productive_hours),
                "break_hours": float(break_hours),
                "overtime_hours": float(overtime_hours),
                "current_session_duration": float(current_session_duration),
                
                # Performance metrics
                "efficiency": efficiency,
                "quality_average": average_quality,
                "completion_rate": completion_rate,
                "completed_tasks": completed_tasks,
                "total_tasks": total_tasks,
                
                # Status indicators
                "has_active_session": len(active_sessions) > 0,
                "overtime_alert": overtime_hours > 0,
                "efficiency_status": self._get_efficiency_status(efficiency),
                "quality_status": self._get_quality_status(average_quality),
                
                # Safety metrics
                "safety_notes_documented": safety_notes_count,
                "safety_compliance": safety_notes_count / max(total_tasks, 1),
                
                # Benchmarks
                "efficiency_benchmark": self.benchmark_data["efficiency"]["average"],
                "quality_benchmark": self.benchmark_data["quality"]["average"],
                
                # Recommendations
                "immediate_recommendations": await self._generate_immediate_recommendations(
                    efficiency, average_quality, overtime_hours, len(active_sessions)
                )
            }
            
        except Exception as e:
            logger.error(f"Error calculating real-time metrics: {e}")
            raise
    
    async def generate_productivity_report(self, user_id: str,
                                         start_date: date,
                                         end_date: date) -> Dict[str, Any]:
        """
        Generate comprehensive productivity report for specified period
        
        Features:
        - Detailed time analysis
        - Quality trends
        - Efficiency patterns
        - Benchmark comparisons
        - Actionable insights
        """
        try:
            # Get hour logs for period
            start_datetime = datetime.combine(start_date, datetime.min.time())
            end_datetime = datetime.combine(end_date, datetime.max.time())
            
            result = await self.db.execute(
                select(HourLogTable)
                .where(
                    and_(
                        HourLogTable.user_id == user_id,
                        HourLogTable.start_time >= start_datetime,
                        HourLogTable.start_time <= end_datetime,
                        HourLogTable.status.in_(["completed", "approved"])
                    )
                )
                .order_by(HourLogTable.start_time)
            )
            hour_logs = result.scalars().all()
            
            if not hour_logs:
                return self._empty_productivity_report(user_id, start_date, end_date)
            
            # Calculate aggregated metrics
            total_hours = sum(log.hours_worked or Decimal('0') for log in hour_logs)
            productive_hours = sum(
                (log.hours_worked or Decimal('0')) - (log.break_time or Decimal('0'))
                for log in hour_logs
            )
            
            # Daily breakdown
            daily_metrics = await self._calculate_daily_metrics(hour_logs)
            
            # Quality analysis
            quality_analysis = await self._analyze_quality_trends(hour_logs)
            
            # Efficiency patterns
            efficiency_patterns = await self._analyze_efficiency_patterns(hour_logs)
            
            # Benchmark comparisons
            benchmarks = await self._calculate_benchmark_comparisons(
                user_id, hour_logs, start_date, end_date
            )
            
            # Trend analysis
            trends = await self._calculate_trend_analysis(user_id, start_date, end_date)
            
            # Performance insights
            insights = await self._generate_performance_insights(
                hour_logs, daily_metrics, quality_analysis, efficiency_patterns
            )
            
            return {
                "user_id": user_id,
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "total_days": (end_date - start_date).days + 1
                },
                "generated_at": datetime.now(timezone.utc).isoformat(),
                
                # Summary metrics
                "summary": {
                    "total_hours": float(total_hours),
                    "productive_hours": float(productive_hours),
                    "average_daily_hours": float(total_hours) / len(daily_metrics),
                    "total_sessions": len(hour_logs),
                    "completed_tasks": len([log for log in hour_logs if log.completion_percentage >= 100]),
                    "average_efficiency": efficiency_patterns["overall_efficiency"],
                    "average_quality": quality_analysis["overall_average"],
                    "overtime_hours": sum(d["overtime_hours"] for d in daily_metrics),
                    "safety_incidents": len([log for log in hour_logs if log.safety_notes])
                },
                
                # Detailed analysis
                "daily_metrics": daily_metrics,
                "quality_analysis": quality_analysis,
                "efficiency_patterns": efficiency_patterns,
                "benchmarks": benchmarks,
                "trends": trends,
                "insights": insights,
                
                # Performance scoring
                "performance_score": await self._calculate_performance_score(hour_logs),
                "improvement_areas": await self._identify_improvement_areas(hour_logs, benchmarks),
                "strengths": await self._identify_strengths(hour_logs, benchmarks)
            }
            
        except Exception as e:
            logger.error(f"Error generating productivity report: {e}")
            raise
    
    async def get_team_analytics(self, project_id: str,
                               start_date: date,
                               end_date: date) -> Dict[str, Any]:
        """
        Generate team-level analytics and comparisons
        
        Features:
        - Team performance overview
        - Individual comparisons
        - Resource allocation analysis
        - Collaboration metrics
        """
        try:
            # Get all hour logs for project and period
            start_datetime = datetime.combine(start_date, datetime.min.time())
            end_datetime = datetime.combine(end_date, datetime.max.time())
            
            result = await self.db.execute(
                select(HourLogTable)
                .where(
                    and_(
                        HourLogTable.project_id == project_id,
                        HourLogTable.start_time >= start_datetime,
                        HourLogTable.start_time <= end_datetime,
                        HourLogTable.status.in_(["completed", "approved"])
                    )
                )
            )
            hour_logs = result.scalars().all()
            
            if not hour_logs:
                return {"error": "No data available for specified period"}
            
            # Group by user
            user_logs = {}
            for log in hour_logs:
                user_id = str(log.user_id)
                if user_id not in user_logs:
                    user_logs[user_id] = []
                user_logs[user_id].append(log)
            
            # Calculate team metrics
            team_summary = {
                "total_team_hours": sum(log.hours_worked or Decimal('0') for log in hour_logs),
                "team_members": len(user_logs),
                "total_sessions": len(hour_logs),
                "average_team_efficiency": 0.0,
                "average_team_quality": 0.0,
                "total_completed_tasks": len([log for log in hour_logs if log.completion_percentage >= 100])
            }
            
            # Individual performance analysis
            individual_performance = []
            efficiency_values = []
            quality_values = []
            
            for user_id, logs in user_logs.items():
                user_hours = sum(log.hours_worked or Decimal('0') for log in logs)
                user_productive = sum(
                    (log.hours_worked or Decimal('0')) - (log.break_time or Decimal('0'))
                    for log in logs
                )
                user_efficiency = float(user_productive / user_hours) if user_hours > 0 else 0
                
                quality_ratings = [log.quality_rating for log in logs if log.quality_rating]
                user_quality = statistics.mean(quality_ratings) if quality_ratings else 0
                
                efficiency_values.append(user_efficiency)
                quality_values.append(user_quality)
                
                individual_performance.append({
                    "user_id": user_id,
                    "total_hours": float(user_hours),
                    "sessions": len(logs),
                    "efficiency": user_efficiency,
                    "quality_rating": user_quality,
                    "completed_tasks": len([log for log in logs if log.completion_percentage >= 100]),
                    "overtime_hours": float(max(user_hours - Decimal('40'), Decimal('0'))),
                    "safety_documentation": len([log for log in logs if log.safety_notes])
                })
            
            # Team averages
            team_summary["average_team_efficiency"] = statistics.mean(efficiency_values) if efficiency_values else 0
            team_summary["average_team_quality"] = statistics.mean(quality_values) if quality_values else 0
            
            # Performance distribution
            performance_distribution = {
                "efficiency": {
                    "high_performers": len([e for e in efficiency_values if e >= 0.8]),
                    "average_performers": len([e for e in efficiency_values if 0.6 <= e < 0.8]),
                    "low_performers": len([e for e in efficiency_values if e < 0.6])
                },
                "quality": {
                    "high_quality": len([q for q in quality_values if q >= 4.0]),
                    "average_quality": len([q for q in quality_values if 3.0 <= q < 4.0]),
                    "needs_improvement": len([q for q in quality_values if q < 3.0])
                }
            }
            
            # Resource allocation analysis
            resource_allocation = await self._analyze_resource_allocation(user_logs)
            
            # Collaboration metrics
            collaboration_metrics = await self._analyze_collaboration_patterns(hour_logs)
            
            return {
                "project_id": project_id,
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat()
                },
                "generated_at": datetime.now(timezone.utc).isoformat(),
                
                "team_summary": team_summary,
                "individual_performance": individual_performance,
                "performance_distribution": performance_distribution,
                "resource_allocation": resource_allocation,
                "collaboration_metrics": collaboration_metrics,
                
                # Rankings and comparisons
                "top_performers": sorted(
                    individual_performance,
                    key=lambda x: x["efficiency"] * x["quality_rating"],
                    reverse=True
                )[:5],
                
                "improvement_opportunities": [
                    perf for perf in individual_performance
                    if perf["efficiency"] < 0.6 or perf["quality_rating"] < 3.0
                ]
            }
            
        except Exception as e:
            logger.error(f"Error generating team analytics: {e}")
            raise
    
    # Helper Methods
    
    def _get_efficiency_status(self, efficiency: float) -> str:
        """Get efficiency status category"""
        if efficiency >= 0.85:
            return "excellent"
        elif efficiency >= 0.70:
            return "good"
        elif efficiency >= 0.55:
            return "average"
        else:
            return "needs_improvement"
    
    def _get_quality_status(self, quality: Optional[float]) -> str:
        """Get quality status category"""
        if quality is None:
            return "not_rated"
        elif quality >= 4.5:
            return "excellent"
        elif quality >= 4.0:
            return "good"
        elif quality >= 3.5:
            return "average"
        else:
            return "needs_improvement"
    
    async def _generate_immediate_recommendations(self, efficiency: float,
                                                quality: Optional[float],
                                                overtime_hours: Decimal,
                                                active_sessions: int) -> List[str]:
        """Generate immediate actionable recommendations"""
        recommendations = []
        
        if efficiency < 0.60:
            recommendations.append("Consider time management techniques to improve efficiency")
        
        if quality and quality < 3.0:
            recommendations.append("Focus on quality improvement - take time for proper work")
        
        if overtime_hours > 4:
            recommendations.append("Monitor fatigue levels - consider break or shift change")
        
        if active_sessions > 0 and overtime_hours > 2:
            recommendations.append("Long session detected - ensure adequate breaks")
        
        if not recommendations:
            recommendations.append("Keep up the good work - performance is on track")
        
        return recommendations
    
    def _empty_productivity_report(self, user_id: str, start_date: date, end_date: date) -> Dict[str, Any]:
        """Return empty report structure when no data available"""
        return {
            "user_id": user_id,
            "period": {
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "summary": {
                "total_hours": 0.0,
                "productive_hours": 0.0,
                "average_daily_hours": 0.0,
                "total_sessions": 0,
                "completed_tasks": 0
            },
            "message": "No productivity data available for the specified period"
        }
    
    async def _calculate_daily_metrics(self, hour_logs: List[HourLogTable]) -> List[Dict[str, Any]]:
        """Calculate daily breakdown of metrics"""
        daily_data = {}
        
        for log in hour_logs:
            day = log.start_time.date()
            if day not in daily_data:
                daily_data[day] = []
            daily_data[day].append(log)
        
        daily_metrics = []
        for day, logs in daily_data.items():
            day_hours = sum(log.hours_worked or Decimal('0') for log in logs)
            day_productive = sum(
                (log.hours_worked or Decimal('0')) - (log.break_time or Decimal('0'))
                for log in logs
            )
            
            quality_ratings = [log.quality_rating for log in logs if log.quality_rating]
            day_quality = statistics.mean(quality_ratings) if quality_ratings else None
            
            daily_metrics.append({
                "date": day.isoformat(),
                "total_hours": float(day_hours),
                "productive_hours": float(day_productive),
                "sessions": len(logs),
                "efficiency": float(day_productive / day_hours) if day_hours > 0 else 0,
                "quality_average": day_quality,
                "completed_tasks": len([log for log in logs if log.completion_percentage >= 100]),
                "overtime_hours": float(max(day_hours - Decimal('8'), Decimal('0')))
            })
        
        return sorted(daily_metrics, key=lambda x: x["date"])
    
    async def _analyze_quality_trends(self, hour_logs: List[HourLogTable]) -> Dict[str, Any]:
        """Analyze quality rating trends over time"""
        quality_ratings = [
            (log.start_time.date(), log.quality_rating)
            for log in hour_logs
            if log.quality_rating
        ]
        
        if not quality_ratings:
            return {"overall_average": 0.0, "trend": "no_data", "distribution": {}}
        
        ratings_only = [rating for _, rating in quality_ratings]
        overall_average = statistics.mean(ratings_only)
        
        # Distribution analysis
        distribution = {
            "excellent": len([r for r in ratings_only if r >= 4.5]),
            "good": len([r for r in ratings_only if 4.0 <= r < 4.5]),
            "average": len([r for r in ratings_only if 3.5 <= r < 4.0]),
            "below_average": len([r for r in ratings_only if r < 3.5])
        }
        
        # Simple trend calculation (first half vs second half)
        mid_point = len(ratings_only) // 2
        if mid_point > 0:
            first_half_avg = statistics.mean(ratings_only[:mid_point])
            second_half_avg = statistics.mean(ratings_only[mid_point:])
            
            if second_half_avg > first_half_avg + 0.2:
                trend = "improving"
            elif second_half_avg < first_half_avg - 0.2:
                trend = "declining"
            else:
                trend = "stable"
        else:
            trend = "insufficient_data"
        
        return {
            "overall_average": overall_average,
            "trend": trend,
            "distribution": distribution,
            "total_ratings": len(ratings_only),
            "highest_rating": max(ratings_only),
            "lowest_rating": min(ratings_only)
        }
    
    async def _analyze_efficiency_patterns(self, hour_logs: List[HourLogTable]) -> Dict[str, Any]:
        """Analyze efficiency patterns and trends"""
        efficiency_data = []
        
        for log in hour_logs:
            if log.hours_worked and log.hours_worked > 0:
                productive = (log.hours_worked or Decimal('0')) - (log.break_time or Decimal('0'))
                efficiency = float(productive / log.hours_worked)
                efficiency_data.append(efficiency)
        
        if not efficiency_data:
            return {"overall_efficiency": 0.0, "patterns": {}}
        
        overall_efficiency = statistics.mean(efficiency_data)
        
        # Time-based patterns (morning vs afternoon efficiency)
        morning_efficiency = []
        afternoon_efficiency = []
        
        for log in hour_logs:
            if log.hours_worked and log.hours_worked > 0:
                productive = (log.hours_worked or Decimal('0')) - (log.break_time or Decimal('0'))
                efficiency = float(productive / log.hours_worked)
                
                hour = log.start_time.hour
                if hour < 12:
                    morning_efficiency.append(efficiency)
                else:
                    afternoon_efficiency.append(efficiency)
        
        patterns = {
            "morning_average": statistics.mean(morning_efficiency) if morning_efficiency else 0,
            "afternoon_average": statistics.mean(afternoon_efficiency) if afternoon_efficiency else 0,
            "peak_performance_time": "morning" if (
                statistics.mean(morning_efficiency) if morning_efficiency else 0
            ) > (
                statistics.mean(afternoon_efficiency) if afternoon_efficiency else 0
            ) else "afternoon"
        }
        
        return {
            "overall_efficiency": overall_efficiency,
            "patterns": patterns,
            "efficiency_variance": statistics.stdev(efficiency_data) if len(efficiency_data) > 1 else 0,
            "consistency_score": 1 - (statistics.stdev(efficiency_data) if len(efficiency_data) > 1 else 0)
        }
    
    async def _calculate_benchmark_comparisons(self, user_id: str,
                                             hour_logs: List[HourLogTable],
                                             start_date: date,
                                             end_date: date) -> Dict[str, Any]:
        """Calculate benchmark comparisons against team and industry"""
        # In production, these would be calculated from actual team/project data
        user_metrics = await self._calculate_user_metrics(hour_logs)
        
        return {
            "efficiency": {
                "user_value": user_metrics["efficiency"],
                "team_average": 0.75,  # Mock data
                "project_average": 0.72,
                "industry_benchmark": 0.70,
                "percentile": self._calculate_percentile(user_metrics["efficiency"], 0.70)
            },
            "quality": {
                "user_value": user_metrics["quality"],
                "team_average": 3.8,
                "project_average": 3.7,
                "industry_benchmark": 3.6,
                "percentile": self._calculate_percentile(user_metrics["quality"], 3.6)
            },
            "productivity": {
                "user_value": user_metrics["tasks_per_hour"],
                "team_average": 0.9,
                "project_average": 0.85,
                "industry_benchmark": 0.8,
                "percentile": self._calculate_percentile(user_metrics["tasks_per_hour"], 0.8)
            }
        }
    
    async def _calculate_user_metrics(self, hour_logs: List[HourLogTable]) -> Dict[str, float]:
        """Calculate core user metrics from hour logs"""
        if not hour_logs:
            return {"efficiency": 0.0, "quality": 0.0, "tasks_per_hour": 0.0}
        
        # Efficiency
        total_hours = sum(log.hours_worked or Decimal('0') for log in hour_logs)
        productive_hours = sum(
            (log.hours_worked or Decimal('0')) - (log.break_time or Decimal('0'))
            for log in hour_logs
        )
        efficiency = float(productive_hours / total_hours) if total_hours > 0 else 0.0
        
        # Quality
        quality_ratings = [log.quality_rating for log in hour_logs if log.quality_rating]
        quality = statistics.mean(quality_ratings) if quality_ratings else 0.0
        
        # Tasks per hour
        completed_tasks = len([log for log in hour_logs if log.completion_percentage >= 100])
        tasks_per_hour = completed_tasks / float(total_hours) if total_hours > 0 else 0.0
        
        return {
            "efficiency": efficiency,
            "quality": quality,
            "tasks_per_hour": tasks_per_hour
        }
    
    def _calculate_percentile(self, user_value: float, benchmark: float) -> float:
        """Calculate user's percentile ranking against benchmark"""
        if benchmark == 0:
            return 50.0
        
        ratio = user_value / benchmark
        if ratio >= 1.2:
            return 95.0
        elif ratio >= 1.1:
            return 85.0
        elif ratio >= 1.0:
            return 75.0
        elif ratio >= 0.9:
            return 60.0
        elif ratio >= 0.8:
            return 40.0
        elif ratio >= 0.7:
            return 25.0
        else:
            return 15.0
    
    async def _calculate_trend_analysis(self, user_id: str,
                                      start_date: date,
                                      end_date: date) -> Dict[str, str]:
        """Calculate trend analysis for key metrics"""
        # Simplified trend analysis - in production, compare with previous periods
        return {
            "efficiency_trend": "stable",
            "quality_trend": "improving",
            "productivity_trend": "stable",
            "safety_trend": "improving"
        }
    
    async def _generate_performance_insights(self, hour_logs: List[HourLogTable],
                                           daily_metrics: List[Dict[str, Any]],
                                           quality_analysis: Dict[str, Any],
                                           efficiency_patterns: Dict[str, Any]) -> List[PerformanceInsight]:
        """Generate actionable performance insights"""
        insights = []
        
        # Efficiency insights
        if efficiency_patterns["overall_efficiency"] < 0.7:
            insights.append(PerformanceInsight(
                category="efficiency",
                insight="Efficiency is below optimal levels",
                recommendation="Consider time management training or workflow optimization",
                priority="high",
                impact_potential="high"
            ))
        
        # Quality insights
        if quality_analysis["overall_average"] < 3.5:
            insights.append(PerformanceInsight(
                category="quality",
                insight="Quality ratings indicate room for improvement",
                recommendation="Focus on quality processes and double-checking work",
                priority="high",
                impact_potential="medium"
            ))
        
        # Time management insights
        overtime_days = len([d for d in daily_metrics if d["overtime_hours"] > 0])
        if overtime_days > len(daily_metrics) * 0.5:
            insights.append(PerformanceInsight(
                category="time_management",
                insight="Frequent overtime may indicate workload or efficiency issues",
                recommendation="Review task allocation and identify workflow bottlenecks",
                priority="medium",
                impact_potential="high"
            ))
        
        return insights
    
    async def _calculate_performance_score(self, hour_logs: List[HourLogTable]) -> Dict[str, Any]:
        """Calculate overall performance score"""
        metrics = await self._calculate_user_metrics(hour_logs)
        
        # Weighted scoring
        efficiency_score = min(metrics["efficiency"] / 0.85 * 100, 100)
        quality_score = min(metrics["quality"] / 5.0 * 100, 100) if metrics["quality"] > 0 else 50
        productivity_score = min(metrics["tasks_per_hour"] / 1.0 * 100, 100)
        
        overall_score = (efficiency_score * 0.4 + quality_score * 0.4 + productivity_score * 0.2)
        
        return {
            "overall_score": round(overall_score, 1),
            "efficiency_score": round(efficiency_score, 1),
            "quality_score": round(quality_score, 1),
            "productivity_score": round(productivity_score, 1),
            "grade": self._get_performance_grade(overall_score)
        }
    
    def _get_performance_grade(self, score: float) -> str:
        """Convert performance score to letter grade"""
        if score >= 90:
            return "A"
        elif score >= 80:
            return "B"
        elif score >= 70:
            return "C"
        elif score >= 60:
            return "D"
        else:
            return "F"
    
    async def _identify_improvement_areas(self, hour_logs: List[HourLogTable],
                                        benchmarks: Dict[str, Any]) -> List[str]:
        """Identify specific areas for improvement"""
        areas = []
        
        if benchmarks["efficiency"]["percentile"] < 50:
            areas.append("Time management and workflow efficiency")
        
        if benchmarks["quality"]["percentile"] < 50:
            areas.append("Work quality and attention to detail")
        
        if benchmarks["productivity"]["percentile"] < 50:
            areas.append("Task completion speed and productivity")
        
        return areas
    
    async def _identify_strengths(self, hour_logs: List[HourLogTable],
                                benchmarks: Dict[str, Any]) -> List[str]:
        """Identify performance strengths"""
        strengths = []
        
        if benchmarks["efficiency"]["percentile"] >= 75:
            strengths.append("Excellent time management and efficiency")
        
        if benchmarks["quality"]["percentile"] >= 75:
            strengths.append("High-quality work and attention to detail")
        
        if benchmarks["productivity"]["percentile"] >= 75:
            strengths.append("Strong task completion and productivity")
        
        # Safety documentation
        safety_docs = len([log for log in hour_logs if log.safety_notes])
        if safety_docs / len(hour_logs) > 0.8:
            strengths.append("Excellent safety documentation habits")
        
        return strengths
    
    async def _analyze_resource_allocation(self, user_logs: Dict[str, List[HourLogTable]]) -> Dict[str, Any]:
        """Analyze resource allocation across team members"""
        total_hours = sum(
            sum(log.hours_worked or Decimal('0') for log in logs)
            for logs in user_logs.values()
        )
        
        allocation = {}
        for user_id, logs in user_logs.items():
            user_hours = sum(log.hours_worked or Decimal('0') for log in logs)
            allocation[user_id] = {
                "hours": float(user_hours),
                "percentage": float(user_hours / total_hours * 100) if total_hours > 0 else 0,
                "sessions": len(logs)
            }
        
        return {
            "total_team_hours": float(total_hours),
            "team_size": len(user_logs),
            "average_hours_per_person": float(total_hours / len(user_logs)) if user_logs else 0,
            "allocation_by_user": allocation,
            "workload_balance": self._assess_workload_balance(allocation)
        }
    
    def _assess_workload_balance(self, allocation: Dict[str, Dict[str, Any]]) -> str:
        """Assess workload balance across team"""
        if not allocation:
            return "no_data"
        
        percentages = [user["percentage"] for user in allocation.values()]
        std_dev = statistics.stdev(percentages) if len(percentages) > 1 else 0
        
        if std_dev < 10:
            return "well_balanced"
        elif std_dev < 20:
            return "moderately_balanced"
        else:
            return "imbalanced"
    
    async def _analyze_collaboration_patterns(self, hour_logs: List[HourLogTable]) -> Dict[str, Any]:
        """Analyze collaboration patterns within the team"""
        # Group by circuits and components to identify collaboration
        circuit_workers = {}
        component_workers = {}
        
        for log in hour_logs:
            if log.circuit_id:
                circuit_id = str(log.circuit_id)
                if circuit_id not in circuit_workers:
                    circuit_workers[circuit_id] = set()
                circuit_workers[circuit_id].add(str(log.user_id))
            
            if log.component_id:
                component_id = str(log.component_id)
                if component_id not in component_workers:
                    component_workers[component_id] = set()
                component_workers[component_id].add(str(log.user_id))
        
        # Calculate collaboration metrics
        collaborative_circuits = sum(1 for workers in circuit_workers.values() if len(workers) > 1)
        collaborative_components = sum(1 for workers in component_workers.values() if len(workers) > 1)
        
        return {
            "total_circuits": len(circuit_workers),
            "collaborative_circuits": collaborative_circuits,
            "collaboration_rate": collaborative_circuits / len(circuit_workers) if circuit_workers else 0,
            "total_components": len(component_workers),
            "collaborative_components": collaborative_components,
            "average_workers_per_circuit": sum(len(workers) for workers in circuit_workers.values()) / len(circuit_workers) if circuit_workers else 0,
            "teamwork_score": (collaborative_circuits + collaborative_components) / (len(circuit_workers) + len(component_workers)) if (circuit_workers or component_workers) else 0
        }