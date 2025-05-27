# Compliance Monitor - Real-time compliance alerts and monitoring
# Story 5.1 compliance features for field hour logging

import asyncio
import logging
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal
from typing import List, Optional, Dict, Any, Set
from dataclasses import dataclass, field
from enum import Enum

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload

from ..data_models import (
    HourLogTable, ComplianceCheckTable, TimeClockTable,
    ComplianceStatus, ComplianceCheckResponse
)

logger = logging.getLogger(__name__)

class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class ComplianceRuleType(str, Enum):
    DOT_HOURS = "dot_hours"
    OSHA_SAFETY = "osha_safety"
    UNION_RULES = "union_rules"
    OVERTIME_LIMITS = "overtime_limits"
    BREAK_REQUIREMENTS = "break_requirements"
    LOCATION_VERIFICATION = "location_verification"
    DOCUMENTATION = "documentation"

@dataclass
class ComplianceAlert:
    """Real-time compliance alert"""
    id: str
    user_id: str
    project_id: str
    rule_type: ComplianceRuleType
    severity: AlertSeverity
    title: str
    message: str
    details: Dict[str, Any]
    action_required: bool
    deadline: Optional[datetime] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

@dataclass
class ComplianceViolation:
    """Compliance violation with resolution tracking"""
    violation_id: str
    rule_type: ComplianceRuleType
    severity: AlertSeverity
    description: str
    affected_entries: List[str]
    resolution_required: bool
    resolution_deadline: Optional[datetime] = None
    auto_fixable: bool = False

class ComplianceMonitor:
    """
    Real-time compliance monitoring system:
    - DOT hours regulations
    - OSHA safety requirements
    - Union rule compliance
    - Location verification
    - Documentation standards
    """
    
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.compliance_rules = self._load_compliance_rules()
        self.alert_handlers = {}
        self.active_alerts = {}
        self.violation_cache = {}
    
    def _load_compliance_rules(self) -> Dict[str, Dict[str, Any]]:
        """Load comprehensive compliance rules and regulations"""
        return {
            "dot_hours": {
                "max_daily_driving": 11,
                "max_daily_duty": 14,
                "max_weekly_duty": 60,
                "required_rest_period": 10,  # hours
                "max_continuous_driving": 8,
                "required_break_after_8_hours": 0.5
            },
            "osha_safety": {
                "fall_protection_height": 6,  # feet
                "confined_space_monitoring": True,
                "lockout_tagout_required": True,
                "ppe_documentation": True,
                "incident_reporting_window": 24,  # hours
                "safety_meeting_frequency": 7  # days
            },
            "union_rules": {
                "overtime_threshold": 8,  # hours per day
                "double_time_threshold": 12,  # hours per day
                "meal_break_required": True,
                "meal_break_window": 5,  # hours maximum before break
                "minimum_rest_between_shifts": 8,  # hours
                "weekend_overtime_multiplier": 1.5
            },
            "location_verification": {
                "gps_tolerance_meters": 100,
                "verification_required": True,
                "geofence_monitoring": True,
                "suspicious_location_threshold": 3  # violations
            },
            "documentation": {
                "safety_notes_required_threshold": 8,  # hours
                "quality_rating_required": True,
                "photo_documentation_required": False,
                "work_description_min_length": 10
            }
        }
    
    async def monitor_real_time_compliance(self, user_id: str, 
                                         entry_data: Dict[str, Any]) -> List[ComplianceAlert]:
        """
        Real-time compliance monitoring for active work sessions
        
        Monitors:
        - DOT hours compliance
        - OSHA safety requirements
        - Break time violations
        - Location verification
        """
        alerts = []
        
        try:
            # Check DOT hours compliance
            dot_alerts = await self._check_dot_hours_compliance(user_id, entry_data)
            alerts.extend(dot_alerts)
            
            # Check OSHA safety compliance
            safety_alerts = await self._check_safety_compliance(user_id, entry_data)
            alerts.extend(safety_alerts)
            
            # Check union rule compliance
            union_alerts = await self._check_union_compliance(user_id, entry_data)
            alerts.extend(union_alerts)
            
            # Check location verification
            location_alerts = await self._check_location_compliance(user_id, entry_data)
            alerts.extend(location_alerts)
            
            # Check documentation requirements
            doc_alerts = await self._check_documentation_compliance(user_id, entry_data)
            alerts.extend(doc_alerts)
            
            # Store alerts for tracking
            for alert in alerts:
                await self._store_compliance_alert(alert)
            
            return alerts
            
        except Exception as e:
            logger.error(f"Error in real-time compliance monitoring: {e}")
            return []
    
    async def run_daily_compliance_audit(self, project_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Run comprehensive daily compliance audit
        
        Features:
        - Full DOT hours audit
        - Safety compliance review
        - Union rule violations
        - Documentation gaps
        - Trend analysis
        """
        try:
            audit_date = date.today()
            start_datetime = datetime.combine(audit_date, datetime.min.time())
            end_datetime = datetime.combine(audit_date, datetime.max.time())
            
            # Get all hour logs for the day
            query = select(HourLogTable).where(
                and_(
                    HourLogTable.start_time >= start_datetime,
                    HourLogTable.start_time <= end_datetime,
                    HourLogTable.status.in_(["completed", "active", "approved"])
                )
            )
            
            if project_id:
                query = query.where(HourLogTable.project_id == project_id)
            
            result = await self.db.execute(query)
            hour_logs = result.scalars().all()
            
            audit_results = {
                "audit_date": audit_date.isoformat(),
                "total_entries_audited": len(hour_logs),
                "violations_found": 0,
                "critical_violations": 0,
                "warnings_issued": 0,
                "compliance_rate": 0.0,
                "violations_by_type": {},
                "violations_by_user": {},
                "recommendations": []
            }
            
            all_violations = []
            
            # Audit each user's compliance
            user_logs = {}
            for log in hour_logs:
                user_id = str(log.user_id)
                if user_id not in user_logs:
                    user_logs[user_id] = []
                user_logs[user_id].append(log)
            
            for user_id, logs in user_logs.items():
                user_violations = await self._audit_user_compliance(user_id, logs, audit_date)
                all_violations.extend(user_violations)
                
                if user_violations:
                    audit_results["violations_by_user"][user_id] = len(user_violations)
            
            # Categorize violations
            for violation in all_violations:
                rule_type = violation.rule_type.value
                if rule_type not in audit_results["violations_by_type"]:
                    audit_results["violations_by_type"][rule_type] = 0
                audit_results["violations_by_type"][rule_type] += 1
                
                if violation.severity == AlertSeverity.CRITICAL:
                    audit_results["critical_violations"] += 1
                elif violation.severity == AlertSeverity.WARNING:
                    audit_results["warnings_issued"] += 1
            
            audit_results["violations_found"] = len(all_violations)
            
            # Calculate compliance rate
            total_checks = len(hour_logs) * 5  # Assume 5 compliance checks per entry
            passed_checks = total_checks - len(all_violations)
            audit_results["compliance_rate"] = passed_checks / total_checks if total_checks > 0 else 1.0
            
            # Generate recommendations
            audit_results["recommendations"] = await self._generate_compliance_recommendations(
                all_violations, audit_results["violations_by_type"]
            )
            
            logger.info(f"Daily compliance audit completed: {audit_results['compliance_rate']:.2%} compliance rate")
            
            return audit_results
            
        except Exception as e:
            logger.error(f"Error in daily compliance audit: {e}")
            raise
    
    async def get_compliance_dashboard(self, user_id: Optional[str] = None,
                                     project_id: Optional[str] = None,
                                     days_back: int = 7) -> Dict[str, Any]:
        """
        Generate compliance dashboard data
        
        Features:
        - Compliance trends
        - Active violations
        - Risk indicators
        - Performance metrics
        """
        try:
            end_date = date.today()
            start_date = end_date - timedelta(days=days_back)
            
            # Get compliance checks for period
            query = select(ComplianceCheckTable).where(
                and_(
                    ComplianceCheckTable.created_at >= datetime.combine(start_date, datetime.min.time()),
                    ComplianceCheckTable.created_at <= datetime.combine(end_date, datetime.max.time())
                )
            )
            
            if user_id:
                query = query.where(ComplianceCheckTable.user_id == user_id)
            if project_id:
                query = query.where(ComplianceCheckTable.project_id == project_id)
            
            result = await self.db.execute(query)
            compliance_checks = result.scalars().all()
            
            dashboard = {
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "days": days_back
                },
                "summary": {
                    "total_checks": len(compliance_checks),
                    "passed": len([c for c in compliance_checks if c.status == ComplianceStatus.PASSED.value]),
                    "failed": len([c for c in compliance_checks if c.status == ComplianceStatus.FAILED.value]),
                    "warnings": len([c for c in compliance_checks if c.status == ComplianceStatus.WARNING.value]),
                    "pending": len([c for c in compliance_checks if c.status == ComplianceStatus.PENDING.value])
                },
                "compliance_rate": 0.0,
                "trends": {},
                "active_violations": [],
                "risk_indicators": {},
                "improvement_areas": []
            }
            
            # Calculate compliance rate
            total_decisive = dashboard["summary"]["passed"] + dashboard["summary"]["failed"]
            if total_decisive > 0:
                dashboard["compliance_rate"] = dashboard["summary"]["passed"] / total_decisive
            
            # Get daily trends
            dashboard["trends"] = await self._calculate_compliance_trends(
                compliance_checks, start_date, end_date
            )
            
            # Get active violations
            dashboard["active_violations"] = await self._get_active_violations(user_id, project_id)
            
            # Calculate risk indicators
            dashboard["risk_indicators"] = await self._calculate_risk_indicators(
                compliance_checks, user_id, project_id
            )
            
            # Identify improvement areas
            dashboard["improvement_areas"] = await self._identify_improvement_areas(
                compliance_checks
            )
            
            return dashboard
            
        except Exception as e:
            logger.error(f"Error generating compliance dashboard: {e}")
            raise
    
    # Specific Compliance Checkers
    
    async def _check_dot_hours_compliance(self, user_id: str, 
                                        entry_data: Dict[str, Any]) -> List[ComplianceAlert]:
        """Check DOT hours of service compliance"""
        alerts = []
        
        try:
            # Get recent hour logs for user
            seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
            result = await self.db.execute(
                select(HourLogTable)
                .where(
                    and_(
                        HourLogTable.user_id == user_id,
                        HourLogTable.start_time >= seven_days_ago,
                        HourLogTable.status.in_(["completed", "approved"])
                    )
                )
                .order_by(HourLogTable.start_time.desc())
            )
            recent_logs = result.scalars().all()
            
            # Check daily hours limit
            today = date.today()
            today_logs = [log for log in recent_logs if log.start_time.date() == today]
            today_hours = sum(log.hours_worked or Decimal('0') for log in today_logs)
            
            if today_hours > self.compliance_rules["dot_hours"]["max_daily_duty"]:
                alerts.append(ComplianceAlert(
                    id=f"dot_daily_{user_id}_{today}",
                    user_id=user_id,
                    project_id=entry_data.get("project_id", ""),
                    rule_type=ComplianceRuleType.DOT_HOURS,
                    severity=AlertSeverity.CRITICAL,
                    title="DOT Daily Hours Exceeded",
                    message=f"Daily duty hours ({today_hours}) exceed DOT limit of {self.compliance_rules['dot_hours']['max_daily_duty']}",
                    details={"daily_hours": float(today_hours), "limit": self.compliance_rules["dot_hours"]["max_daily_duty"]},
                    action_required=True,
                    deadline=datetime.combine(today, datetime.max.time())
                ))
            
            # Check weekly hours limit
            week_start = today - timedelta(days=today.weekday())
            week_logs = [log for log in recent_logs if log.start_time.date() >= week_start]
            week_hours = sum(log.hours_worked or Decimal('0') for log in week_logs)
            
            if week_hours > self.compliance_rules["dot_hours"]["max_weekly_duty"]:
                alerts.append(ComplianceAlert(
                    id=f"dot_weekly_{user_id}_{week_start}",
                    user_id=user_id,
                    project_id=entry_data.get("project_id", ""),
                    rule_type=ComplianceRuleType.DOT_HOURS,
                    severity=AlertSeverity.CRITICAL,
                    title="DOT Weekly Hours Exceeded",
                    message=f"Weekly duty hours ({week_hours}) exceed DOT limit of {self.compliance_rules['dot_hours']['max_weekly_duty']}",
                    details={"weekly_hours": float(week_hours), "limit": self.compliance_rules["dot_hours"]["max_weekly_duty"]},
                    action_required=True
                ))
            
            # Check for required rest period
            if len(recent_logs) >= 2:
                last_shift_end = recent_logs[1].end_time
                current_shift_start = datetime.fromisoformat(entry_data.get("start_time", datetime.now().isoformat()))
                
                if last_shift_end and current_shift_start:
                    rest_period = (current_shift_start - last_shift_end).total_seconds() / 3600
                    required_rest = self.compliance_rules["dot_hours"]["required_rest_period"]
                    
                    if rest_period < required_rest:
                        alerts.append(ComplianceAlert(
                            id=f"dot_rest_{user_id}_{current_shift_start.date()}",
                            user_id=user_id,
                            project_id=entry_data.get("project_id", ""),
                            rule_type=ComplianceRuleType.DOT_HOURS,
                            severity=AlertSeverity.ERROR,
                            title="Insufficient Rest Period",
                            message=f"Rest period ({rest_period:.1f}h) below DOT requirement of {required_rest}h",
                            details={"rest_hours": rest_period, "required_rest": required_rest},
                            action_required=True
                        ))
            
        except Exception as e:
            logger.error(f"Error checking DOT hours compliance: {e}")
        
        return alerts
    
    async def _check_safety_compliance(self, user_id: str, 
                                     entry_data: Dict[str, Any]) -> List[ComplianceAlert]:
        """Check OSHA safety compliance"""
        alerts = []
        
        try:
            hours_worked = entry_data.get("hours_worked", 0)
            safety_notes = entry_data.get("safety_notes", "")
            
            # Check for safety documentation requirement
            if (hours_worked > self.compliance_rules["documentation"]["safety_notes_required_threshold"] 
                and not safety_notes):
                alerts.append(ComplianceAlert(
                    id=f"safety_doc_{user_id}_{datetime.now().date()}",
                    user_id=user_id,
                    project_id=entry_data.get("project_id", ""),
                    rule_type=ComplianceRuleType.OSHA_SAFETY,
                    severity=AlertSeverity.WARNING,
                    title="Safety Documentation Required",
                    message=f"Safety notes required for shifts over {self.compliance_rules['documentation']['safety_notes_required_threshold']} hours",
                    details={"hours_worked": hours_worked, "threshold": self.compliance_rules["documentation"]["safety_notes_required_threshold"]},
                    action_required=True
                ))
            
            # Check for incident reporting if safety notes mention incidents
            if safety_notes and any(keyword in safety_notes.lower() for keyword in ["incident", "injury", "accident", "near miss"]):
                alerts.append(ComplianceAlert(
                    id=f"incident_report_{user_id}_{datetime.now().timestamp()}",
                    user_id=user_id,
                    project_id=entry_data.get("project_id", ""),
                    rule_type=ComplianceRuleType.OSHA_SAFETY,
                    severity=AlertSeverity.CRITICAL,
                    title="Incident Reporting Required",
                    message="Safety incident detected in notes - formal incident report required within 24 hours",
                    details={"safety_notes": safety_notes},
                    action_required=True,
                    deadline=datetime.now(timezone.utc) + timedelta(hours=24)
                ))
        
        except Exception as e:
            logger.error(f"Error checking safety compliance: {e}")
        
        return alerts
    
    async def _check_union_compliance(self, user_id: str, 
                                    entry_data: Dict[str, Any]) -> List[ComplianceAlert]:
        """Check union rule compliance"""
        alerts = []
        
        try:
            hours_worked = entry_data.get("hours_worked", 0)
            
            # Check overtime threshold
            overtime_threshold = self.compliance_rules["union_rules"]["overtime_threshold"]
            if hours_worked > overtime_threshold:
                overtime_hours = hours_worked - overtime_threshold
                alerts.append(ComplianceAlert(
                    id=f"union_overtime_{user_id}_{datetime.now().date()}",
                    user_id=user_id,
                    project_id=entry_data.get("project_id", ""),
                    rule_type=ComplianceRuleType.UNION_RULES,
                    severity=AlertSeverity.INFO,
                    title="Overtime Hours Detected",
                    message=f"Overtime rate applies to {overtime_hours} hours (over {overtime_threshold}h threshold)",
                    details={"overtime_hours": overtime_hours, "threshold": overtime_threshold},
                    action_required=False
                ))
            
            # Check double time threshold
            double_time_threshold = self.compliance_rules["union_rules"]["double_time_threshold"]
            if hours_worked > double_time_threshold:
                double_time_hours = hours_worked - double_time_threshold
                alerts.append(ComplianceAlert(
                    id=f"union_double_time_{user_id}_{datetime.now().date()}",
                    user_id=user_id,
                    project_id=entry_data.get("project_id", ""),
                    rule_type=ComplianceRuleType.UNION_RULES,
                    severity=AlertSeverity.WARNING,
                    title="Double Time Hours Detected",
                    message=f"Double time rate applies to {double_time_hours} hours (over {double_time_threshold}h threshold)",
                    details={"double_time_hours": double_time_hours, "threshold": double_time_threshold},
                    action_required=False
                ))
        
        except Exception as e:
            logger.error(f"Error checking union compliance: {e}")
        
        return alerts
    
    async def _check_location_compliance(self, user_id: str, 
                                       entry_data: Dict[str, Any]) -> List[ComplianceAlert]:
        """Check GPS location verification compliance"""
        alerts = []
        
        try:
            gps_coordinates = entry_data.get("gps_coordinates")
            project_id = entry_data.get("project_id")
            
            if not gps_coordinates and self.compliance_rules["location_verification"]["verification_required"]:
                alerts.append(ComplianceAlert(
                    id=f"location_missing_{user_id}_{datetime.now().timestamp()}",
                    user_id=user_id,
                    project_id=project_id or "",
                    rule_type=ComplianceRuleType.LOCATION_VERIFICATION,
                    severity=AlertSeverity.WARNING,
                    title="Location Verification Missing",
                    message="GPS location not provided - location verification required for compliance",
                    details={"verification_required": True},
                    action_required=True
                ))
            
            # In production: check if GPS coordinates are within project geofence
            # For now, we'll simulate a basic check
            if gps_coordinates:
                # Mock geofence validation
                is_valid_location = True  # Would implement actual geofence checking
                
                if not is_valid_location:
                    alerts.append(ComplianceAlert(
                        id=f"location_invalid_{user_id}_{datetime.now().timestamp()}",
                        user_id=user_id,
                        project_id=project_id or "",
                        rule_type=ComplianceRuleType.LOCATION_VERIFICATION,
                        severity=AlertSeverity.ERROR,
                        title="Location Outside Project Area",
                        message="GPS location is outside authorized project area",
                        details={"coordinates": gps_coordinates, "project_id": project_id},
                        action_required=True
                    ))
        
        except Exception as e:
            logger.error(f"Error checking location compliance: {e}")
        
        return alerts
    
    async def _check_documentation_compliance(self, user_id: str, 
                                            entry_data: Dict[str, Any]) -> List[ComplianceAlert]:
        """Check documentation requirements compliance"""
        alerts = []
        
        try:
            work_description = entry_data.get("work_description", "")
            quality_rating = entry_data.get("quality_rating")
            
            # Check work description length
            min_length = self.compliance_rules["documentation"]["work_description_min_length"]
            if len(work_description) < min_length:
                alerts.append(ComplianceAlert(
                    id=f"doc_description_{user_id}_{datetime.now().timestamp()}",
                    user_id=user_id,
                    project_id=entry_data.get("project_id", ""),
                    rule_type=ComplianceRuleType.DOCUMENTATION,
                    severity=AlertSeverity.WARNING,
                    title="Insufficient Work Description",
                    message=f"Work description too short (minimum {min_length} characters required)",
                    details={"current_length": len(work_description), "minimum_length": min_length},
                    action_required=True
                ))
            
            # Check quality rating requirement
            if (self.compliance_rules["documentation"]["quality_rating_required"] 
                and quality_rating is None):
                alerts.append(ComplianceAlert(
                    id=f"doc_quality_{user_id}_{datetime.now().timestamp()}",
                    user_id=user_id,
                    project_id=entry_data.get("project_id", ""),
                    rule_type=ComplianceRuleType.DOCUMENTATION,
                    severity=AlertSeverity.INFO,
                    title="Quality Rating Missing",
                    message="Quality self-assessment rating recommended for complete documentation",
                    details={"quality_rating_required": True},
                    action_required=False
                ))
        
        except Exception as e:
            logger.error(f"Error checking documentation compliance: {e}")
        
        return alerts
    
    # Helper Methods
    
    async def _store_compliance_alert(self, alert: ComplianceAlert):
        """Store compliance alert in database for tracking"""
        try:
            compliance_check = ComplianceCheckTable(
                id=alert.id,
                entry_id=alert.id,  # In production, link to specific entry
                user_id=alert.user_id,
                project_id=alert.project_id,
                check_type=alert.rule_type.value,
                status=ComplianceStatus.WARNING.value if alert.severity == AlertSeverity.WARNING else ComplianceStatus.FAILED.value,
                severity=alert.severity.value,
                details=alert.message,
                recommendation=alert.details.get("recommendation", ""),
                auto_validated=False
            )
            
            self.db.add(compliance_check)
            await self.db.commit()
            
        except Exception as e:
            logger.error(f"Error storing compliance alert: {e}")
    
    async def _audit_user_compliance(self, user_id: str, 
                                   logs: List[HourLogTable], 
                                   audit_date: date) -> List[ComplianceViolation]:
        """Audit a single user's compliance for the day"""
        violations = []
        
        # Check for documentation violations
        for log in logs:
            if log.hours_worked and log.hours_worked > 8 and not log.safety_notes:
                violations.append(ComplianceViolation(
                    violation_id=f"safety_doc_{log.id}",
                    rule_type=ComplianceRuleType.OSHA_SAFETY,
                    severity=AlertSeverity.WARNING,
                    description="Missing safety documentation for extended shift",
                    affected_entries=[str(log.id)],
                    resolution_required=True,
                    auto_fixable=False
                ))
        
        # Check for overtime violations
        total_hours = sum(log.hours_worked or Decimal('0') for log in logs)
        if total_hours > 14:  # DOT daily limit
            violations.append(ComplianceViolation(
                violation_id=f"dot_daily_{user_id}_{audit_date}",
                rule_type=ComplianceRuleType.DOT_HOURS,
                severity=AlertSeverity.CRITICAL,
                description=f"Daily hours ({total_hours}) exceed DOT limit",
                affected_entries=[str(log.id) for log in logs],
                resolution_required=True,
                resolution_deadline=datetime.combine(audit_date, datetime.max.time()),
                auto_fixable=False
            ))
        
        return violations
    
    async def _generate_compliance_recommendations(self, violations: List[ComplianceViolation],
                                                 violations_by_type: Dict[str, int]) -> List[str]:
        """Generate actionable compliance recommendations"""
        recommendations = []
        
        if violations_by_type.get("dot_hours", 0) > 0:
            recommendations.append("Implement better shift scheduling to prevent DOT violations")
        
        if violations_by_type.get("osha_safety", 0) > 0:
            recommendations.append("Improve safety documentation training and reminders")
        
        if violations_by_type.get("documentation", 0) > 0:
            recommendations.append("Enhance work description templates and quality controls")
        
        if violations_by_type.get("location_verification", 0) > 0:
            recommendations.append("Ensure GPS location capture is working properly")
        
        if not recommendations:
            recommendations.append("Compliance performance is excellent - maintain current practices")
        
        return recommendations
    
    async def _calculate_compliance_trends(self, compliance_checks: List[ComplianceCheckTable],
                                         start_date: date, end_date: date) -> Dict[str, Any]:
        """Calculate compliance trends over the period"""
        # Group checks by date
        daily_compliance = {}
        current_date = start_date
        
        while current_date <= end_date:
            daily_checks = [
                check for check in compliance_checks
                if check.created_at.date() == current_date
            ]
            
            total_checks = len(daily_checks)
            passed_checks = len([c for c in daily_checks if c.status == ComplianceStatus.PASSED.value])
            
            daily_compliance[current_date.isoformat()] = {
                "total_checks": total_checks,
                "passed_checks": passed_checks,
                "compliance_rate": passed_checks / total_checks if total_checks > 0 else 1.0
            }
            
            current_date += timedelta(days=1)
        
        return {"daily_compliance": daily_compliance}
    
    async def _get_active_violations(self, user_id: Optional[str],
                                   project_id: Optional[str]) -> List[Dict[str, Any]]:
        """Get currently active compliance violations"""
        query = select(ComplianceCheckTable).where(
            and_(
                ComplianceCheckTable.status.in([ComplianceStatus.FAILED.value, ComplianceStatus.WARNING.value]),
                ComplianceCheckTable.resolved == False
            )
        )
        
        if user_id:
            query = query.where(ComplianceCheckTable.user_id == user_id)
        if project_id:
            query = query.where(ComplianceCheckTable.project_id == project_id)
        
        result = await self.db.execute(query)
        violations = result.scalars().all()
        
        return [
            {
                "id": str(violation.id),
                "user_id": str(violation.user_id),
                "check_type": violation.check_type,
                "severity": violation.severity,
                "details": violation.details,
                "created_at": violation.created_at.isoformat()
            }
            for violation in violations
        ]
    
    async def _calculate_risk_indicators(self, compliance_checks: List[ComplianceCheckTable],
                                       user_id: Optional[str],
                                       project_id: Optional[str]) -> Dict[str, Any]:
        """Calculate compliance risk indicators"""
        total_checks = len(compliance_checks)
        if total_checks == 0:
            return {"risk_level": "unknown", "risk_factors": []}
        
        failed_checks = len([c for c in compliance_checks if c.status == ComplianceStatus.FAILED.value])
        warning_checks = len([c for c in compliance_checks if c.status == ComplianceStatus.WARNING.value])
        
        risk_score = (failed_checks * 2 + warning_checks) / total_checks
        
        if risk_score > 0.3:
            risk_level = "high"
        elif risk_score > 0.15:
            risk_level = "medium"
        elif risk_score > 0.05:
            risk_level = "low"
        else:
            risk_level = "minimal"
        
        # Identify risk factors
        risk_factors = []
        check_types = {}
        for check in compliance_checks:
            if check.status in [ComplianceStatus.FAILED.value, ComplianceStatus.WARNING.value]:
                check_types[check.check_type] = check_types.get(check.check_type, 0) + 1
        
        for check_type, count in check_types.items():
            if count > 2:  # More than 2 violations of same type
                risk_factors.append(f"Recurring {check_type} violations")
        
        return {
            "risk_level": risk_level,
            "risk_score": risk_score,
            "risk_factors": risk_factors,
            "total_violations": failed_checks + warning_checks,
            "violation_rate": (failed_checks + warning_checks) / total_checks
        }
    
    async def _identify_improvement_areas(self, compliance_checks: List[ComplianceCheckTable]) -> List[str]:
        """Identify areas for compliance improvement"""
        improvement_areas = []
        
        # Count violations by type
        violation_counts = {}
        for check in compliance_checks:
            if check.status in [ComplianceStatus.FAILED.value, ComplianceStatus.WARNING.value]:
                violation_counts[check.check_type] = violation_counts.get(check.check_type, 0) + 1
        
        # Identify top violation types
        sorted_violations = sorted(violation_counts.items(), key=lambda x: x[1], reverse=True)
        
        for check_type, count in sorted_violations[:3]:  # Top 3 problem areas
            if count >= 2:
                improvement_areas.append(f"Improve {check_type.replace('_', ' ')} compliance")
        
        return improvement_areas