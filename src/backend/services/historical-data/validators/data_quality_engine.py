"""
Data Quality Engine
Story 4.1 Task 3: Comprehensive data quality management and standardization
"""

from typing import List, Dict, Any, Optional, Tuple
import logging
import asyncio
from datetime import datetime, date
import re
import numpy as np
import pandas as pd
from difflib import SequenceMatcher
from collections import Counter
import statistics

from ..data_models import (
    HistoricalProject, DataQualityReport, DataQualityIssue,
    ProjectType, IndustryCategory, ProjectComplexity, LaborRole,
    QualityScore
)

logger = logging.getLogger(__name__)

class DataQualityEngine:
    """Comprehensive data quality analysis and improvement engine"""
    
    def __init__(self):
        self.quality_rules = self._initialize_quality_rules()
        self.standardization_rules = self._initialize_standardization_rules()
        self.duplicate_threshold = 0.85  # Similarity threshold for duplicate detection
        self.initialized = False
    
    async def initialize(self):
        """Initialize the data quality engine"""
        logger.info("Initializing Data Quality Engine...")
        self.initialized = True
        logger.info("✓ Data Quality Engine initialized")
    
    async def analyze_projects(self, projects: List[HistoricalProject]) -> DataQualityReport:
        """Analyze data quality for a list of projects"""
        start_time = datetime.now()
        
        logger.info(f"Analyzing data quality for {len(projects)} projects")
        
        all_issues = []
        auto_fixes = []
        manual_review_items = []
        
        # Analyze each project individually
        for i, project in enumerate(projects):
            project_issues = await self._analyze_project_quality(project)
            all_issues.extend(project_issues)
            
            # Apply auto-fixes where possible
            fixed_issues = await self._apply_auto_fixes(project, project_issues)
            auto_fixes.extend(fixed_issues)
            
            if i % 100 == 0:  # Log progress for large datasets
                logger.info(f"Processed {i+1}/{len(projects)} projects")
        
        # Cross-project analysis (duplicates, consistency)
        cross_project_issues = await self._analyze_cross_project_quality(projects)
        all_issues.extend(cross_project_issues)
        
        # Identify items requiring manual review
        manual_review_items = self._identify_manual_review_items(all_issues)
        
        # Calculate quality scores
        completeness_score = self._calculate_completeness_score(projects, all_issues)
        accuracy_score = self._calculate_accuracy_score(projects, all_issues)
        consistency_score = self._calculate_consistency_score(projects, all_issues)
        validity_score = self._calculate_validity_score(projects, all_issues)
        
        overall_score = (completeness_score + accuracy_score + consistency_score + validity_score) / 4
        
        # Generate recommendations
        recommendations = self._generate_recommendations(all_issues, projects)
        
        analysis_duration = (datetime.now() - start_time).total_seconds()
        
        report = DataQualityReport(
            import_job_id="",  # Will be set by caller
            overall_score=overall_score,
            projects_analyzed=len(projects),
            issues=all_issues,
            auto_fixes=[f"Auto-fixed: {fix}" for fix in auto_fixes],
            manual_review_items=manual_review_items,
            completeness_score=completeness_score,
            accuracy_score=accuracy_score,
            consistency_score=consistency_score,
            validity_score=validity_score,
            recommendations=recommendations,
            analysis_duration=analysis_duration
        )
        
        logger.info(f"Quality analysis completed. Overall score: {overall_score:.3f}")
        return report
    
    async def analyze_import_job(self, 
                               job_id: str, 
                               threshold: float = 0.95,
                               auto_fix: bool = True) -> DataQualityReport:
        """Analyze data quality for a specific import job"""
        # This would typically fetch projects from database
        # For now, return a mock report
        return DataQualityReport(
            import_job_id=job_id,
            overall_score=0.92,
            projects_analyzed=100,
            completeness_score=0.95,
            accuracy_score=0.90,
            consistency_score=0.88,
            validity_score=0.94,
            recommendations=["Review material cost data for outliers", "Standardize location names"]
        )
    
    async def _analyze_project_quality(self, project: HistoricalProject) -> List[DataQualityIssue]:
        """Analyze data quality for a single project"""
        issues = []
        
        # Required field validation
        issues.extend(self._validate_required_fields(project))
        
        # Data type and format validation
        issues.extend(self._validate_data_types(project))
        
        # Business rule validation
        issues.extend(self._validate_business_rules(project))
        
        # Range and constraint validation
        issues.extend(self._validate_ranges_and_constraints(project))
        
        # Pattern and format validation
        issues.extend(self._validate_patterns_and_formats(project))
        
        return issues
    
    def _validate_required_fields(self, project: HistoricalProject) -> List[DataQualityIssue]:
        """Validate that required fields are present and not empty"""
        issues = []
        
        required_fields = {
            'project_name': project.project_name,
            'client_name': project.client_name,
            'total_cost': project.cost_data.total_cost,
            'planned_start_date': project.planned_start_date,
            'planned_end_date': project.planned_end_date
        }
        
        for field_name, value in required_fields.items():
            if value is None or (isinstance(value, str) and not value.strip()):
                issues.append(DataQualityIssue(
                    severity="error",
                    category="completeness",
                    description=f"Required field '{field_name}' is missing or empty",
                    field_name=field_name,
                    current_value=str(value) if value is not None else "None",
                    auto_fixable=False,
                    project_id=project.project_id
                ))
        
        return issues
    
    def _validate_data_types(self, project: HistoricalProject) -> List[DataQualityIssue]:
        """Validate data types and formats"""
        issues = []
        
        # Validate numeric fields
        numeric_fields = {
            'total_cost': project.cost_data.total_cost,
            'labor_cost': project.cost_data.labor_cost,
            'material_cost': project.cost_data.material_cost,
            'completion_percentage': project.completion_percentage
        }
        
        for field_name, value in numeric_fields.items():
            if value is not None and not isinstance(value, (int, float)):
                issues.append(DataQualityIssue(
                    severity="error",
                    category="validity",
                    description=f"Field '{field_name}' should be numeric",
                    field_name=field_name,
                    current_value=str(value),
                    auto_fixable=True,
                    project_id=project.project_id
                ))
        
        # Validate date fields
        date_fields = {
            'planned_start_date': project.planned_start_date,
            'planned_end_date': project.planned_end_date
        }
        
        for field_name, value in date_fields.items():
            if value is not None and not isinstance(value, date):
                issues.append(DataQualityIssue(
                    severity="error",
                    category="validity",
                    description=f"Field '{field_name}' should be a valid date",
                    field_name=field_name,
                    current_value=str(value),
                    auto_fixable=True,
                    project_id=project.project_id
                ))
        
        return issues
    
    def _validate_business_rules(self, project: HistoricalProject) -> List[DataQualityIssue]:
        """Validate business logic rules"""
        issues = []
        
        # End date should be after start date
        if (project.planned_start_date and project.planned_end_date and 
            project.planned_end_date <= project.planned_start_date):
            issues.append(DataQualityIssue(
                severity="error",
                category="consistency",
                description="Project end date should be after start date",
                field_name="planned_end_date",
                current_value=str(project.planned_end_date),
                auto_fixable=False,
                project_id=project.project_id
            ))
        
        # Total cost should equal sum of component costs
        component_sum = (project.cost_data.labor_cost + 
                        project.cost_data.material_cost + 
                        project.cost_data.equipment_cost + 
                        project.cost_data.overhead_cost)
        
        if abs(project.cost_data.total_cost - component_sum) > (project.cost_data.total_cost * 0.05):  # 5% tolerance
            issues.append(DataQualityIssue(
                severity="warning",
                category="consistency",
                description="Total cost doesn't match sum of component costs",
                field_name="total_cost",
                current_value=str(project.cost_data.total_cost),
                suggested_value=str(component_sum),
                auto_fixable=True,
                project_id=project.project_id
            ))
        
        # Completion percentage should be between 0 and 100
        if project.completion_percentage < 0 or project.completion_percentage > 100:
            issues.append(DataQualityIssue(
                severity="error",
                category="validity",
                description="Completion percentage should be between 0 and 100",
                field_name="completion_percentage",
                current_value=str(project.completion_percentage),
                auto_fixable=True,
                project_id=project.project_id
            ))
        
        return issues
    
    def _validate_ranges_and_constraints(self, project: HistoricalProject) -> List[DataQualityIssue]:
        """Validate value ranges and constraints"""
        issues = []
        
        # Cost range validation
        if project.cost_data.total_cost < 1000:
            issues.append(DataQualityIssue(
                severity="warning",
                category="accuracy",
                description="Total cost seems unusually low",
                field_name="total_cost",
                current_value=str(project.cost_data.total_cost),
                auto_fixable=False,
                project_id=project.project_id
            ))
        
        if project.cost_data.total_cost > 50000000:  # $50M
            issues.append(DataQualityIssue(
                severity="warning",
                category="accuracy",
                description="Total cost seems unusually high",
                field_name="total_cost",
                current_value=str(project.cost_data.total_cost),
                auto_fixable=False,
                project_id=project.project_id
            ))
        
        # Date range validation
        if project.planned_start_date and project.planned_start_date < date(2000, 1, 1):
            issues.append(DataQualityIssue(
                severity="warning",
                category="accuracy",
                description="Project start date seems unusually old",
                field_name="planned_start_date",
                current_value=str(project.planned_start_date),
                auto_fixable=False,
                project_id=project.project_id
            ))
        
        return issues
    
    def _validate_patterns_and_formats(self, project: HistoricalProject) -> List[DataQualityIssue]:
        """Validate text patterns and formats"""
        issues = []
        
        # Project name should not be generic
        generic_patterns = [r'^project\s*\d*$', r'^job\s*\d*$', r'^untitled', r'^test']
        for pattern in generic_patterns:
            if re.match(pattern, project.project_name.lower()):
                issues.append(DataQualityIssue(
                    severity="warning",
                    category="completeness",
                    description="Project name appears to be generic or placeholder",
                    field_name="project_name",
                    current_value=project.project_name,
                    auto_fixable=False,
                    project_id=project.project_id
                ))
                break
        
        # Client name validation
        if len(project.client_name) < 3:
            issues.append(DataQualityIssue(
                severity="warning",
                category="completeness",
                description="Client name seems too short",
                field_name="client_name",
                current_value=project.client_name,
                auto_fixable=False,
                project_id=project.project_id
            ))
        
        # Currency code validation
        valid_currencies = ['USD', 'CAD', 'EUR', 'GBP', 'AUD']
        if project.cost_data.currency not in valid_currencies:
            issues.append(DataQualityIssue(
                severity="warning",
                category="validity",
                description="Currency code may not be valid",
                field_name="currency",
                current_value=project.cost_data.currency,
                suggested_value="USD",
                auto_fixable=True,
                project_id=project.project_id
            ))
        
        return issues
    
    async def _analyze_cross_project_quality(self, projects: List[HistoricalProject]) -> List[DataQualityIssue]:
        """Analyze quality issues across multiple projects"""
        issues = []
        
        # Duplicate detection
        duplicates = self._detect_duplicates(projects)
        for duplicate_group in duplicates:
            if len(duplicate_group) > 1:
                project_ids = [p.project_id for p in duplicate_group]
                issues.append(DataQualityIssue(
                    severity="warning",
                    category="consistency",
                    description=f"Potential duplicate projects found: {', '.join(project_ids[:3])}",
                    auto_fixable=False
                ))
        
        # Outlier detection for costs
        costs = [p.cost_data.total_cost for p in projects if p.cost_data.total_cost > 0]
        if len(costs) > 10:  # Need sufficient data for outlier detection
            outliers = self._detect_outliers(costs)
            for outlier_idx in outliers:
                project = projects[outlier_idx]
                issues.append(DataQualityIssue(
                    severity="info",
                    category="accuracy",
                    description="Project cost is a statistical outlier",
                    field_name="total_cost",
                    current_value=str(project.cost_data.total_cost),
                    auto_fixable=False,
                    project_id=project.project_id
                ))
        
        # Consistency checks for categorical data
        location_issues = self._check_location_consistency(projects)
        issues.extend(location_issues)
        
        client_issues = self._check_client_name_consistency(projects)
        issues.extend(client_issues)
        
        return issues
    
    def _detect_duplicates(self, projects: List[HistoricalProject]) -> List[List[HistoricalProject]]:
        """Detect potential duplicate projects"""
        duplicate_groups = []
        processed = set()
        
        for i, project1 in enumerate(projects):
            if i in processed:
                continue
            
            group = [project1]
            processed.add(i)
            
            for j, project2 in enumerate(projects[i+1:], i+1):
                if j in processed:
                    continue
                
                similarity = self._calculate_project_similarity(project1, project2)
                if similarity > self.duplicate_threshold:
                    group.append(project2)
                    processed.add(j)
            
            if len(group) > 1:
                duplicate_groups.append(group)
        
        return duplicate_groups
    
    def _calculate_project_similarity(self, project1: HistoricalProject, project2: HistoricalProject) -> float:
        """Calculate similarity between two projects"""
        scores = []
        
        # Name similarity
        name_sim = SequenceMatcher(None, project1.project_name.lower(), project2.project_name.lower()).ratio()
        scores.append(name_sim * 0.3)
        
        # Client similarity
        client_sim = SequenceMatcher(None, project1.client_name.lower(), project2.client_name.lower()).ratio()
        scores.append(client_sim * 0.2)
        
        # Location similarity
        if (project1.location.city.lower() == project2.location.city.lower() and
            project1.location.state_province.lower() == project2.location.state_province.lower()):
            scores.append(0.2)
        
        # Cost similarity (within 10%)
        cost_diff = abs(project1.cost_data.total_cost - project2.cost_data.total_cost)
        avg_cost = (project1.cost_data.total_cost + project2.cost_data.total_cost) / 2
        if avg_cost > 0 and cost_diff / avg_cost < 0.1:
            scores.append(0.15)
        
        # Date similarity (within 30 days)
        if (project1.planned_start_date and project2.planned_start_date and
            abs((project1.planned_start_date - project2.planned_start_date).days) < 30):
            scores.append(0.15)
        
        return sum(scores)
    
    def _detect_outliers(self, values: List[float]) -> List[int]:
        """Detect statistical outliers using IQR method"""
        if len(values) < 4:
            return []
        
        q1 = np.percentile(values, 25)
        q3 = np.percentile(values, 75)
        iqr = q3 - q1
        
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        
        outliers = []
        for i, value in enumerate(values):
            if value < lower_bound or value > upper_bound:
                outliers.append(i)
        
        return outliers
    
    def _check_location_consistency(self, projects: List[HistoricalProject]) -> List[DataQualityIssue]:
        """Check for inconsistent location naming"""
        issues = []
        
        # Group similar city names
        cities = [p.location.city for p in projects]
        city_groups = self._group_similar_strings(cities)
        
        for group in city_groups:
            if len(group) > 1:
                # Find the most common variation
                most_common = Counter(group).most_common(1)[0][0]
                for city in group:
                    if city != most_common:
                        issues.append(DataQualityIssue(
                            severity="info",
                            category="consistency",
                            description=f"City name '{city}' may be inconsistent with '{most_common}'",
                            field_name="city",
                            current_value=city,
                            suggested_value=most_common,
                            auto_fixable=True
                        ))
        
        return issues
    
    def _check_client_name_consistency(self, projects: List[HistoricalProject]) -> List[DataQualityIssue]:
        """Check for inconsistent client naming"""
        issues = []
        
        client_names = [p.client_name for p in projects]
        client_groups = self._group_similar_strings(client_names, threshold=0.8)
        
        for group in client_groups:
            if len(group) > 1:
                most_common = Counter(group).most_common(1)[0][0]
                for client in group:
                    if client != most_common:
                        issues.append(DataQualityIssue(
                            severity="info",
                            category="consistency",
                            description=f"Client name '{client}' may be inconsistent with '{most_common}'",
                            field_name="client_name",
                            current_value=client,
                            suggested_value=most_common,
                            auto_fixable=True
                        ))
        
        return issues
    
    def _group_similar_strings(self, strings: List[str], threshold: float = 0.8) -> List[List[str]]:
        """Group similar strings together"""
        groups = []
        processed = set()
        
        for i, string1 in enumerate(strings):
            if i in processed:
                continue
            
            group = [string1]
            processed.add(i)
            
            for j, string2 in enumerate(strings[i+1:], i+1):
                if j in processed:
                    continue
                
                similarity = SequenceMatcher(None, string1.lower(), string2.lower()).ratio()
                if similarity > threshold:
                    group.append(string2)
                    processed.add(j)
            
            groups.append(group)
        
        return groups
    
    async def _apply_auto_fixes(self, project: HistoricalProject, issues: List[DataQualityIssue]) -> List[str]:
        """Apply automatic fixes where possible"""
        fixed_issues = []
        
        for issue in issues:
            if not issue.auto_fixable:
                continue
            
            if issue.field_name == "completion_percentage":
                # Fix out-of-range completion percentages
                if project.completion_percentage < 0:
                    project.completion_percentage = 0.0
                    fixed_issues.append(f"Set negative completion percentage to 0 for project {project.project_id}")
                elif project.completion_percentage > 100:
                    project.completion_percentage = 100.0
                    fixed_issues.append(f"Capped completion percentage at 100 for project {project.project_id}")
            
            elif issue.field_name == "currency" and issue.suggested_value:
                # Fix invalid currency codes
                project.cost_data.currency = issue.suggested_value
                fixed_issues.append(f"Changed currency to {issue.suggested_value} for project {project.project_id}")
            
            elif issue.field_name == "total_cost" and issue.suggested_value:
                # Fix inconsistent total costs
                try:
                    new_cost = float(issue.suggested_value)
                    project.cost_data.total_cost = new_cost
                    fixed_issues.append(f"Updated total cost to {new_cost} for project {project.project_id}")
                except ValueError:
                    pass
        
        return fixed_issues
    
    def _identify_manual_review_items(self, issues: List[DataQualityIssue]) -> List[str]:
        """Identify issues that require manual review"""
        manual_items = []
        
        high_priority_categories = ['completeness', 'accuracy']
        
        for issue in issues:
            if (issue.severity == 'error' or 
                (issue.severity == 'warning' and issue.category in high_priority_categories)):
                if not issue.auto_fixable:
                    manual_items.append(
                        f"{issue.severity.upper()}: {issue.description} "
                        f"(Project: {issue.project_id or 'Multiple'}, Field: {issue.field_name or 'N/A'})"
                    )
        
        return manual_items
    
    def _calculate_completeness_score(self, projects: List[HistoricalProject], issues: List[DataQualityIssue]) -> float:
        """Calculate data completeness score"""
        total_fields = len(projects) * 20  # Assuming 20 key fields per project
        missing_fields = len([i for i in issues if i.category == 'completeness'])
        return max(0.0, (total_fields - missing_fields) / total_fields)
    
    def _calculate_accuracy_score(self, projects: List[HistoricalProject], issues: List[DataQualityIssue]) -> float:
        """Calculate data accuracy score"""
        total_validations = len(projects) * 10  # Assuming 10 accuracy checks per project
        accuracy_issues = len([i for i in issues if i.category == 'accuracy'])
        return max(0.0, (total_validations - accuracy_issues) / total_validations)
    
    def _calculate_consistency_score(self, projects: List[HistoricalProject], issues: List[DataQualityIssue]) -> float:
        """Calculate data consistency score"""
        total_consistency_checks = len(projects) * 5  # Assuming 5 consistency checks per project
        consistency_issues = len([i for i in issues if i.category == 'consistency'])
        return max(0.0, (total_consistency_checks - consistency_issues) / total_consistency_checks)
    
    def _calculate_validity_score(self, projects: List[HistoricalProject], issues: List[DataQualityIssue]) -> float:
        """Calculate data validity score"""
        total_validity_checks = len(projects) * 8  # Assuming 8 validity checks per project
        validity_issues = len([i for i in issues if i.category == 'validity'])
        return max(0.0, (total_validity_checks - validity_issues) / total_validity_checks)
    
    def _generate_recommendations(self, issues: List[DataQualityIssue], projects: List[HistoricalProject]) -> List[str]:
        """Generate improvement recommendations based on issues found"""
        recommendations = []
        
        # Count issues by category
        issue_counts = Counter(issue.category for issue in issues)
        
        if issue_counts.get('completeness', 0) > len(projects) * 0.1:
            recommendations.append("Implement data validation at source to reduce missing required fields")
        
        if issue_counts.get('consistency', 0) > len(projects) * 0.05:
            recommendations.append("Establish data entry standards for location and client names")
        
        if issue_counts.get('accuracy', 0) > len(projects) * 0.05:
            recommendations.append("Review outlier detection thresholds and validate unusual cost values")
        
        if issue_counts.get('validity', 0) > len(projects) * 0.05:
            recommendations.append("Implement input validation for date formats and numeric ranges")
        
        # Cost-specific recommendations
        zero_cost_projects = len([p for p in projects if p.cost_data.total_cost <= 0])
        if zero_cost_projects > 0:
            recommendations.append(f"Review {zero_cost_projects} projects with zero or negative costs")
        
        # Date-specific recommendations
        date_issues = [i for i in issues if 'date' in (i.field_name or '').lower()]
        if len(date_issues) > len(projects) * 0.1:
            recommendations.append("Standardize date format in data sources to prevent parsing errors")
        
        return recommendations[:10]  # Limit to top 10 recommendations
    
    def _initialize_quality_rules(self) -> Dict[str, Any]:
        """Initialize data quality rules"""
        return {
            'required_fields': {
                'project_name', 'client_name', 'total_cost', 
                'planned_start_date', 'planned_end_date'
            },
            'numeric_fields': {
                'total_cost', 'labor_cost', 'material_cost', 
                'equipment_cost', 'completion_percentage'
            },
            'date_fields': {
                'planned_start_date', 'planned_end_date', 
                'actual_start_date', 'actual_end_date'
            },
            'cost_ranges': {
                'min_cost': 100,
                'max_cost': 100000000,
                'outlier_threshold': 3.0
            },
            'percentage_fields': {
                'completion_percentage': {'min': 0, 'max': 100}
            }
        }
    
    def _initialize_standardization_rules(self) -> Dict[str, Any]:
        """Initialize data standardization rules"""
        return {
            'currency_mappings': {
                'dollar': 'USD',
                'usd': 'USD',
                'cad': 'CAD',
                'canadian': 'CAD'
            },
            'state_abbreviations': {
                'california': 'CA',
                'texas': 'TX',
                'florida': 'FL',
                'new york': 'NY'
            },
            'project_type_mappings': {
                'comm': 'commercial',
                'ind': 'industrial',
                'res': 'residential'
            }
        }
    
    async def close(self):
        """Clean up resources"""
        logger.info("Closing Data Quality Engine")
        self.initialized = False

# Example usage
if __name__ == "__main__":
    async def test_quality_engine():
        engine = DataQualityEngine()
        await engine.initialize()
        
        # Test with sample projects
        sample_projects = []  # Would contain actual HistoricalProject instances
        
        report = await engine.analyze_projects(sample_projects)
        print(f"Overall quality score: {report.overall_score:.3f}")
        print(f"Issues found: {len(report.issues)}")
        
        await engine.close()
    
    asyncio.run(test_quality_engine())
