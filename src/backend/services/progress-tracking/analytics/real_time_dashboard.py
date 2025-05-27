# Real-Time Dashboard Analytics - Story 5.2 Implementation
# High-performance real-time data processing and WebSocket streaming

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal
from typing import List, Optional, Dict, Any, Set
from dataclasses import dataclass, field, asdict
from enum import Enum
import statistics

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, text
from sqlalchemy.orm import selectinload
from fastapi import WebSocket, WebSocketDisconnect
import redis.asyncio as redis

from ..data_models import (
    HourLogTable, ProductivityMetricsTable, ComplianceCheckTable,
    TimeClockTable, RealTimeStatus
)

logger = logging.getLogger(__name__)

class AlertType(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class UpdateType(str, Enum):
    METRICS_UPDATE = "metrics_update"
    LIVE_UPDATE = "live_update"
    ALERT = "alert"
    FORECAST_UPDATE = "forecast_update"
    USER_ACTION = "user_action"

@dataclass
class RealTimeMetrics:
    """Real-time metrics data structure"""
    project_id: str
    timestamp: str
    
    # Core metrics
    total_hours: float
    productive_hours: float
    completed_tasks: int
    total_tasks: int
    active_users: int
    efficiency: float
    quality_score: float
    
    # Performance indicators
    on_time_performance: float
    budget_utilization: float
    productivity: float
    safety_score: float
    
    # Alert indicators
    critical_issues: int
    upcoming_deadlines: int
    
    # Team metrics
    team_size: int
    average_efficiency: float
    collaboration_score: float
    
    # Trends
    efficiency_trend: str
    quality_trend: str
    productivity_trend: str

@dataclass
class LiveUpdate:
    """Live activity update"""
    type: str
    user_id: str
    project_id: str
    message: str
    timestamp: str
    data: Dict[str, Any] = field(default_factory=dict)

@dataclass
class PerformanceForecast:
    """Project performance forecast"""
    completion_date: str
    completion_probability: float
    budget_overrun: float
    risk_factors: List[str]
    recommendations: List[str]
    confidence: float

class WebSocketManager:
    """Manage WebSocket connections for real-time updates"""
    
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self.user_connections: Dict[str, Set[WebSocket]] = {}
        
    async def connect(self, websocket: WebSocket, project_id: str, user_id: Optional[str] = None):
        """Add new WebSocket connection"""
        await websocket.accept()
        
        if project_id not in self.active_connections:
            self.active_connections[project_id] = set()
        self.active_connections[project_id].add(websocket)
        
        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = set()
            self.user_connections[user_id].add(websocket)
        
        logger.info(f"WebSocket connected for project {project_id}, user {user_id}")
    
    async def disconnect(self, websocket: WebSocket, project_id: str, user_id: Optional[str] = None):
        """Remove WebSocket connection"""
        if project_id in self.active_connections:
            self.active_connections[project_id].discard(websocket)
            if not self.active_connections[project_id]:
                del self.active_connections[project_id]
        
        if user_id and user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        
        logger.info(f"WebSocket disconnected for project {project_id}, user {user_id}")
    
    async def broadcast_to_project(self, project_id: str, message: Dict[str, Any]):
        """Broadcast message to all connections for a project"""
        if project_id in self.active_connections:
            disconnected = set()
            for websocket in self.active_connections[project_id]:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Error sending WebSocket message: {e}")
                    disconnected.add(websocket)
            
            # Remove disconnected websockets
            for websocket in disconnected:
                self.active_connections[project_id].discard(websocket)
    
    async def send_to_user(self, user_id: str, message: Dict[str, Any]):
        """Send message to specific user"""
        if user_id in self.user_connections:
            disconnected = set()
            for websocket in self.user_connections[user_id]:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Error sending WebSocket message to user: {e}")
                    disconnected.add(websocket)
            
            # Remove disconnected websockets
            for websocket in disconnected:
                self.user_connections[user_id].discard(websocket)

class RealTimeDashboardEngine:
    """
    Real-time dashboard analytics engine:
    - High-performance metric calculations
    - WebSocket streaming
    - Predictive analytics
    - Alert generation
    """
    
    def __init__(self, db_session: AsyncSession, redis_client: redis.Redis):
        self.db = db_session
        self.redis = redis_client
        self.websocket_manager = WebSocketManager()
        self.metric_cache = {}
        self.alert_cache = {}
        
    async def get_real_time_metrics(self, project_id: str, 
                                  timeframe: str = 'today') -> RealTimeMetrics:
        """
        Calculate real-time metrics for project dashboard
        
        Features:
        - High-performance calculations
        - Caching for frequent requests
        - Real-time data aggregation
        """
        try:
            cache_key = f"metrics:{project_id}:{timeframe}"
            
            # Check cache first
            cached_metrics = await self.redis.get(cache_key)
            if cached_metrics:
                cached_data = json.loads(cached_metrics)
                return RealTimeMetrics(**cached_data)
            
            # Calculate metrics from database
            metrics = await self._calculate_metrics(project_id, timeframe)
            
            # Cache results for 30 seconds
            await self.redis.setex(
                cache_key, 
                30, 
                json.dumps(asdict(metrics), default=str)
            )
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error getting real-time metrics: {e}")
            raise
    
    async def start_real_time_updates(self, project_id: str):
        """Start real-time metric updates for a project"""
        try:
            while True:
                # Calculate updated metrics
                metrics = await self.get_real_time_metrics(project_id)
                
                # Broadcast to connected clients
                await self.websocket_manager.broadcast_to_project(
                    project_id,
                    {
                        "type": UpdateType.METRICS_UPDATE.value,
                        "data": asdict(metrics)
                    }
                )
                
                # Check for alerts
                alerts = await self._check_real_time_alerts(project_id, metrics)
                for alert in alerts:
                    await self.websocket_manager.broadcast_to_project(
                        project_id,
                        {
                            "type": UpdateType.ALERT.value,
                            "data": alert
                        }
                    )
                
                # Wait before next update
                await asyncio.sleep(30)  # Update every 30 seconds
                
        except Exception as e:
            logger.error(f"Error in real-time updates: {e}")
    
    async def handle_websocket_connection(self, websocket: WebSocket, 
                                        project_id: str, 
                                        user_id: Optional[str] = None):
        """Handle WebSocket connection lifecycle"""
        await self.websocket_manager.connect(websocket, project_id, user_id)
        
        try:
            # Send initial data
            metrics = await self.get_real_time_metrics(project_id)
            await websocket.send_text(json.dumps({
                "type": UpdateType.METRICS_UPDATE.value,
                "data": asdict(metrics)
            }))
            
            # Handle incoming messages
            while True:
                try:
                    data = await websocket.receive_text()
                    message = json.loads(data)
                    
                    # Handle subscription requests
                    if message.get("action") == "subscribe":
                        # Client subscribing to updates
                        pass
                    elif message.get("action") == "unsubscribe":
                        # Client unsubscribing
                        break
                    
                except WebSocketDisconnect:
                    break
                except Exception as e:
                    logger.error(f"Error handling WebSocket message: {e}")
                    break
                    
        finally:
            await self.websocket_manager.disconnect(websocket, project_id, user_id)
    
    async def log_live_update(self, project_id: str, user_id: str, 
                            update_type: str, message: str, 
                            data: Optional[Dict[str, Any]] = None):
        """Log and broadcast live activity update"""
        try:
            update = LiveUpdate(
                type=update_type,
                user_id=user_id,
                project_id=project_id,
                message=message,
                timestamp=datetime.now(timezone.utc).isoformat(),
                data=data or {}
            )
            
            # Store in Redis for activity feed
            activity_key = f"activity:{project_id}"
            await self.redis.lpush(activity_key, json.dumps(asdict(update)))
            await self.redis.ltrim(activity_key, 0, 49)  # Keep last 50 updates
            await self.redis.expire(activity_key, 86400)  # Expire after 24 hours
            
            # Broadcast to connected clients
            await self.websocket_manager.broadcast_to_project(
                project_id,
                {
                    "type": UpdateType.LIVE_UPDATE.value,
                    "data": asdict(update)
                }
            )
            
        except Exception as e:
            logger.error(f"Error logging live update: {e}")
    
    async def generate_performance_forecast(self, project_id: str) -> PerformanceForecast:
        """
        Generate performance forecast using historical data and trends
        
        Features:
        - Completion date prediction
        - Budget overrun estimation
        - Risk factor identification
        - Actionable recommendations
        """
        try:
            # Get historical performance data
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
            
            result = await self.db.execute(
                select(HourLogTable)
                .where(
                    and_(
                        HourLogTable.project_id == project_id,
                        HourLogTable.start_time >= thirty_days_ago,
                        HourLogTable.status.in_(["completed", "approved"])
                    )
                )
                .order_by(HourLogTable.start_time)
            )
            historical_logs = result.scalars().all()
            
            if not historical_logs:
                return PerformanceForecast(
                    completion_date=(datetime.now() + timedelta(days=30)).isoformat(),
                    completion_probability=50.0,
                    budget_overrun=0.0,
                    risk_factors=["Insufficient historical data"],
                    recommendations=["Continue monitoring project progress"],
                    confidence=0.3
                )
            
            # Calculate trends
            daily_progress = await self._calculate_daily_progress(historical_logs)
            efficiency_trend = await self._calculate_efficiency_trend(historical_logs)
            quality_trend = await self._calculate_quality_trend(historical_logs)
            
            # Predict completion date
            current_progress = await self._get_current_progress(project_id)
            remaining_work = 100 - current_progress
            
            if efficiency_trend > 0:
                avg_daily_progress = statistics.mean([day['progress'] for day in daily_progress[-7:]])
                days_to_completion = remaining_work / max(avg_daily_progress, 0.1)
            else:
                days_to_completion = remaining_work / 1.0  # Conservative estimate
            
            completion_date = datetime.now() + timedelta(days=days_to_completion)
            
            # Calculate completion probability
            if efficiency_trend > 0.1:
                completion_probability = 90.0
            elif efficiency_trend > 0:
                completion_probability = 75.0
            elif efficiency_trend > -0.1:
                completion_probability = 60.0
            else:
                completion_probability = 40.0
            
            # Estimate budget overrun
            budget_utilization = await self._get_budget_utilization(project_id)
            if budget_utilization > current_progress:
                budget_overrun = (budget_utilization - current_progress) * 1.2  # Add buffer
            else:
                budget_overrun = 0.0
            
            # Identify risk factors
            risk_factors = []
            if efficiency_trend < -0.1:
                risk_factors.append("Declining efficiency trend")
            if quality_trend < -0.2:
                risk_factors.append("Quality score decreasing")
            if budget_overrun > 10:
                risk_factors.append("Budget overrun risk")
            if days_to_completion > 60:
                risk_factors.append("Extended timeline")
            
            # Generate recommendations
            recommendations = []
            if efficiency_trend < 0:
                recommendations.append("Review team productivity and remove blockers")
            if quality_trend < 0:
                recommendations.append("Implement quality improvement measures")
            if budget_overrun > 5:
                recommendations.append("Review budget allocation and cost controls")
            if not recommendations:
                recommendations.append("Continue current project management practices")
            
            # Calculate confidence based on data quality
            confidence = min(len(historical_logs) / 100, 1.0) * 0.8 + 0.2
            
            return PerformanceForecast(
                completion_date=completion_date.isoformat(),
                completion_probability=completion_probability,
                budget_overrun=budget_overrun,
                risk_factors=risk_factors,
                recommendations=recommendations,
                confidence=confidence
            )
            
        except Exception as e:
            logger.error(f"Error generating performance forecast: {e}")
            raise
    
    async def get_live_activity_feed(self, project_id: str, limit: int = 20) -> List[LiveUpdate]:
        """Get recent live activity updates"""
        try:
            activity_key = f"activity:{project_id}"
            updates = await self.redis.lrange(activity_key, 0, limit - 1)
            
            return [
                LiveUpdate(**json.loads(update))
                for update in updates
            ]
            
        except Exception as e:
            logger.error(f"Error getting activity feed: {e}")
            return []
    
    # Helper Methods
    
    async def _calculate_metrics(self, project_id: str, timeframe: str) -> RealTimeMetrics:
        """Calculate comprehensive real-time metrics"""
        # Determine time range
        now = datetime.now(timezone.utc)
        if timeframe == 'today':
            start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
        elif timeframe == 'week':
            start_time = now - timedelta(days=7)
        elif timeframe == 'month':
            start_time = now - timedelta(days=30)
        else:
            start_time = now - timedelta(days=1)
        
        # Get hour logs for period
        result = await self.db.execute(
            select(HourLogTable)
            .where(
                and_(
                    HourLogTable.project_id == project_id,
                    HourLogTable.start_time >= start_time,
                    HourLogTable.status.in_(["completed", "active", "approved"])
                )
            )
        )
        hour_logs = result.scalars().all()
        
        # Calculate basic metrics
        total_hours = sum(log.hours_worked or Decimal('0') for log in hour_logs)
        productive_hours = sum(
            (log.hours_worked or Decimal('0')) - (log.break_time or Decimal('0'))
            for log in hour_logs
        )
        
        completed_tasks = len([log for log in hour_logs if log.completion_percentage >= 100])
        total_tasks = len(hour_logs)
        
        # Get active users (users with activity in last hour)
        one_hour_ago = now - timedelta(hours=1)
        active_result = await self.db.execute(
            select(func.count(func.distinct(HourLogTable.user_id)))
            .where(
                and_(
                    HourLogTable.project_id == project_id,
                    HourLogTable.updated_at >= one_hour_ago
                )
            )
        )
        active_users = active_result.scalar() or 0
        
        # Calculate efficiency
        efficiency = float(productive_hours / total_hours) if total_hours > 0 else 0.0
        
        # Calculate quality score
        quality_ratings = [log.quality_rating for log in hour_logs if log.quality_rating]
        quality_score = statistics.mean(quality_ratings) if quality_ratings else 4.0
        
        # Get team size
        team_result = await self.db.execute(
            select(func.count(func.distinct(HourLogTable.user_id)))
            .where(HourLogTable.project_id == project_id)
        )
        team_size = team_result.scalar() or 1
        
        # Calculate performance indicators (simplified for demo)
        on_time_performance = 85.0  # Would calculate from actual deadline data
        budget_utilization = 70.0   # Would calculate from actual budget data
        productivity = efficiency * 100
        safety_score = 95.0         # Would calculate from safety metrics
        
        # Get critical issues and upcoming deadlines (simplified)
        critical_issues = 2  # Would query from actual issue tracking
        upcoming_deadlines = 3  # Would query from project schedule
        
        # Calculate trends (simplified)
        efficiency_trend = "stable"
        quality_trend = "improving" if quality_score > 4.0 else "stable"
        productivity_trend = "stable"
        
        return RealTimeMetrics(
            project_id=project_id,
            timestamp=now.isoformat(),
            total_hours=float(total_hours),
            productive_hours=float(productive_hours),
            completed_tasks=completed_tasks,
            total_tasks=total_tasks,
            active_users=active_users,
            efficiency=efficiency,
            quality_score=quality_score,
            on_time_performance=on_time_performance,
            budget_utilization=budget_utilization,
            productivity=productivity,
            safety_score=safety_score,
            critical_issues=critical_issues,
            upcoming_deadlines=upcoming_deadlines,
            team_size=team_size,
            average_efficiency=efficiency,  # Simplified
            collaboration_score=0.8,  # Simplified
            efficiency_trend=efficiency_trend,
            quality_trend=quality_trend,
            productivity_trend=productivity_trend
        )
    
    async def _check_real_time_alerts(self, project_id: str, 
                                    metrics: RealTimeMetrics) -> List[Dict[str, Any]]:
        """Check for real-time alerts based on current metrics"""
        alerts = []
        
        # Efficiency alert
        if metrics.efficiency < 0.6:
            alerts.append({
                "type": AlertType.WARNING.value,
                "title": "Low Efficiency Alert",
                "message": f"Project efficiency ({metrics.efficiency:.0%}) below target",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        
        # Quality alert
        if metrics.quality_score < 3.0:
            alerts.append({
                "type": AlertType.ERROR.value,
                "title": "Quality Concern",
                "message": f"Quality score ({metrics.quality_score:.1f}) needs attention",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        
        # Critical issues alert
        if metrics.critical_issues > 5:
            alerts.append({
                "type": AlertType.CRITICAL.value,
                "title": "Critical Issues",
                "message": f"{metrics.critical_issues} critical issues require immediate attention",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        
        return alerts
    
    async def _calculate_daily_progress(self, hour_logs: List[HourLogTable]) -> List[Dict[str, Any]]:
        """Calculate daily progress from hour logs"""
        daily_data = {}
        
        for log in hour_logs:
            day = log.start_time.date()
            if day not in daily_data:
                daily_data[day] = []
            daily_data[day].append(log)
        
        daily_progress = []
        for day, logs in daily_data.items():
            completed = len([log for log in logs if log.completion_percentage >= 100])
            total = len(logs)
            progress = (completed / total * 100) if total > 0 else 0
            
            daily_progress.append({
                'date': day.isoformat(),
                'progress': progress,
                'completed_tasks': completed,
                'total_tasks': total
            })
        
        return sorted(daily_progress, key=lambda x: x['date'])
    
    async def _calculate_efficiency_trend(self, hour_logs: List[HourLogTable]) -> float:
        """Calculate efficiency trend over time"""
        if len(hour_logs) < 10:
            return 0.0
        
        # Split into first and second half
        mid_point = len(hour_logs) // 2
        first_half = hour_logs[:mid_point]
        second_half = hour_logs[mid_point:]
        
        # Calculate efficiency for each half
        def calc_efficiency(logs):
            total = sum(log.hours_worked or Decimal('0') for log in logs)
            productive = sum(
                (log.hours_worked or Decimal('0')) - (log.break_time or Decimal('0'))
                for log in logs
            )
            return float(productive / total) if total > 0 else 0.0
        
        first_efficiency = calc_efficiency(first_half)
        second_efficiency = calc_efficiency(second_half)
        
        return second_efficiency - first_efficiency
    
    async def _calculate_quality_trend(self, hour_logs: List[HourLogTable]) -> float:
        """Calculate quality trend over time"""
        quality_logs = [log for log in hour_logs if log.quality_rating]
        
        if len(quality_logs) < 10:
            return 0.0
        
        # Split into first and second half
        mid_point = len(quality_logs) // 2
        first_half = quality_logs[:mid_point]
        second_half = quality_logs[mid_point:]
        
        first_quality = statistics.mean([log.quality_rating for log in first_half])
        second_quality = statistics.mean([log.quality_rating for log in second_half])
        
        return second_quality - first_quality
    
    async def _get_current_progress(self, project_id: str) -> float:
        """Get current project progress percentage"""
        # Simplified calculation - in production would use actual project data
        result = await self.db.execute(
            select(func.avg(HourLogTable.completion_percentage))
            .where(HourLogTable.project_id == project_id)
        )
        progress = result.scalar() or 0.0
        return float(progress)
    
    async def _get_budget_utilization(self, project_id: str) -> float:
        """Get current budget utilization percentage"""
        # Simplified calculation - in production would use actual budget data
        return 72.5  # Mock value