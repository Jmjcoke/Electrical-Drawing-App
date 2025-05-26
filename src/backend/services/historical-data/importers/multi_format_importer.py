"""
Multi-Format Import Engine
Story 4.1 Task 1: Support for Excel, CSV, JSON, XML, and database formats
"""

import pandas as pd
import json
import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional, Union
import logging
import asyncio
from pathlib import Path
from datetime import datetime, date
import numpy as np
from sqlalchemy import create_engine
import xlsxwriter
from openpyxl import load_workbook

from ..data_models import (
    HistoricalProject, ImportResult, ProjectType, IndustryCategory, 
    ProjectComplexity, ProjectStatus, LocationData, CostData, 
    LaborHours, LaborRole, ProjectClassification, QualityMetrics,
    RiskFactors, QualityScore
)

logger = logging.getLogger(__name__)

class MultiFormatImporter:
    """High-performance importer supporting multiple file formats"""
    
    def __init__(self):
        self.supported_formats = {
            'excel': ['.xlsx', '.xls'],
            'csv': ['.csv'],
            'json': ['.json'],
            'xml': ['.xml'],
            'database': ['postgresql', 'mysql', 'sqlite', 'sqlserver']
        }
        
        # Standard field mappings for common formats
        self.field_mappings = {
            'project_name': ['project_name', 'name', 'project', 'job_name', 'job_number'],
            'client_name': ['client', 'customer', 'client_name', 'customer_name', 'owner'],
            'total_cost': ['total_cost', 'cost', 'total', 'project_cost', 'final_cost'],
            'labor_cost': ['labor_cost', 'labor', 'labor_total', 'manpower_cost'],
            'material_cost': ['material_cost', 'materials', 'material_total', 'parts_cost'],
            'start_date': ['start_date', 'project_start', 'begin_date', 'commenced'],
            'end_date': ['end_date', 'project_end', 'completion_date', 'finished']
        }
        
        self.initialized = False
    
    async def initialize(self):
        """Initialize the import engine"""
        logger.info("Initializing Multi-Format Import Engine...")
        self.initialized = True
        logger.info("✓ Multi-Format Import Engine initialized")
    
    async def health_check(self) -> Dict[str, Any]:
        """Health check for import engine"""
        return {
            "status": "healthy" if self.initialized else "not_initialized",
            "supported_formats": list(self.supported_formats.keys()),
            "total_extensions": sum(len(exts) for exts in self.supported_formats.values())
        }
    
    async def import_file(self, 
                         file_path: str, 
                         file_format: str = "auto_detect",
                         validation_rules: Dict[str, Any] = None,
                         custom_mappings: Dict[str, str] = None) -> ImportResult:
        """Import historical data from file"""
        start_time = datetime.now()
        
        try:
            logger.info(f"Starting import of {file_path}")
            
            # Auto-detect format if needed
            if file_format == "auto_detect":
                file_format = self._detect_file_format(file_path)
            
            # Import based on format
            if file_format == "excel":
                projects = await self._import_excel(file_path, validation_rules, custom_mappings)
            elif file_format == "csv":
                projects = await self._import_csv(file_path, validation_rules, custom_mappings)
            elif file_format == "json":
                projects = await self._import_json(file_path, validation_rules, custom_mappings)
            elif file_format == "xml":
                projects = await self._import_xml(file_path, validation_rules, custom_mappings)
            else:
                raise ValueError(f"Unsupported file format: {file_format}")
            
            processing_time = (datetime.now() - start_time).total_seconds()
            
            result = ImportResult(
                success=True,
                projects=projects,
                summary={
                    "total_projects": len(projects),
                    "file_format": file_format,
                    "processing_time": processing_time,
                    "file_path": file_path
                },
                processing_time=processing_time
            )
            
            logger.info(f"Successfully imported {len(projects)} projects in {processing_time:.2f} seconds")
            return result
            
        except Exception as e:
            logger.error(f"Import failed for {file_path}: {e}")
            processing_time = (datetime.now() - start_time).total_seconds()
            
            return ImportResult(
                success=False,
                projects=[],
                summary={"error": str(e)},
                errors=[str(e)],
                processing_time=processing_time
            )
    
    def _detect_file_format(self, file_path: str) -> str:
        """Auto-detect file format from extension"""
        path = Path(file_path)
        extension = path.suffix.lower()
        
        for format_name, extensions in self.supported_formats.items():
            if extension in extensions:
                return format_name
        
        raise ValueError(f"Unsupported file extension: {extension}")
    
    async def _import_excel(self, 
                           file_path: str, 
                           validation_rules: Dict[str, Any] = None,
                           custom_mappings: Dict[str, str] = None) -> List[HistoricalProject]:
        """Import data from Excel file"""
        logger.info(f"Importing Excel file: {file_path}")
        
        # Read Excel file with multiple sheets
        excel_file = pd.ExcelFile(file_path)
        projects = []
        
        for sheet_name in excel_file.sheet_names:
            logger.info(f"Processing sheet: {sheet_name}")
            
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            
            # Skip empty sheets
            if df.empty:
                continue
            
            # Process each row as a project
            sheet_projects = await self._process_dataframe(df, custom_mappings, validation_rules)
            projects.extend(sheet_projects)
        
        return projects
    
    async def _import_csv(self, 
                         file_path: str,
                         validation_rules: Dict[str, Any] = None,
                         custom_mappings: Dict[str, str] = None) -> List[HistoricalProject]:
        """Import data from CSV file"""
        logger.info(f"Importing CSV file: {file_path}")
        
        # Try different encodings
        encodings = ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']
        df = None
        
        for encoding in encodings:
            try:
                df = pd.read_csv(file_path, encoding=encoding)
                break
            except UnicodeDecodeError:
                continue
        
        if df is None:
            raise ValueError(f"Could not read CSV file with any supported encoding")
        
        return await self._process_dataframe(df, custom_mappings, validation_rules)
    
    async def _import_json(self, 
                          file_path: str,
                          validation_rules: Dict[str, Any] = None,
                          custom_mappings: Dict[str, str] = None) -> List[HistoricalProject]:
        """Import data from JSON file"""
        logger.info(f"Importing JSON file: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        projects = []
        
        # Handle different JSON structures
        if isinstance(data, list):
            # Array of projects
            for project_data in data:
                project = await self._create_project_from_dict(project_data, custom_mappings)
                if project:
                    projects.append(project)
        elif isinstance(data, dict):
            if 'projects' in data:
                # Wrapped in projects key
                for project_data in data['projects']:
                    project = await self._create_project_from_dict(project_data, custom_mappings)
                    if project:
                        projects.append(project)
            else:
                # Single project
                project = await self._create_project_from_dict(data, custom_mappings)
                if project:
                    projects.append(project)
        
        return projects
    
    async def _import_xml(self, 
                         file_path: str,
                         validation_rules: Dict[str, Any] = None,
                         custom_mappings: Dict[str, str] = None) -> List[HistoricalProject]:
        """Import data from XML file"""
        logger.info(f"Importing XML file: {file_path}")
        
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        projects = []
        
        # Find project elements (common patterns)
        project_elements = (
            root.findall('.//project') or 
            root.findall('.//Project') or 
            root.findall('.//item') or
            root.findall('.//record')
        )
        
        for element in project_elements:
            project_data = self._xml_element_to_dict(element)
            project = await self._create_project_from_dict(project_data, custom_mappings)
            if project:
                projects.append(project)
        
        return projects
    
    def _xml_element_to_dict(self, element) -> Dict[str, Any]:
        """Convert XML element to dictionary"""
        result = {}
        
        # Add attributes
        result.update(element.attrib)
        
        # Add text content
        if element.text and element.text.strip():
            result['_text'] = element.text.strip()
        
        # Add child elements
        for child in element:
            child_data = self._xml_element_to_dict(child)
            if child.tag in result:
                # Multiple children with same tag - convert to list
                if not isinstance(result[child.tag], list):
                    result[child.tag] = [result[child.tag]]
                result[child.tag].append(child_data)
            else:
                result[child.tag] = child_data
        
        return result
    
    async def _process_dataframe(self, 
                                df: pd.DataFrame,
                                custom_mappings: Dict[str, str] = None,
                                validation_rules: Dict[str, Any] = None) -> List[HistoricalProject]:
        """Process pandas DataFrame into historical projects"""
        projects = []
        
        # Clean column names
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_')
        
        # Apply custom mappings if provided
        if custom_mappings:
            df = df.rename(columns=custom_mappings)
        
        for index, row in df.iterrows():
            try:
                project_data = row.to_dict()
                project = await self._create_project_from_dict(project_data, custom_mappings)
                if project:
                    projects.append(project)
            except Exception as e:
                logger.warning(f"Failed to process row {index}: {e}")
                continue
        
        return projects
    
    async def _create_project_from_dict(self, 
                                       data: Dict[str, Any],
                                       custom_mappings: Dict[str, str] = None) -> Optional[HistoricalProject]:
        """Create HistoricalProject from dictionary data"""
        try:
            # Map fields using standard mappings
            mapped_data = self._map_fields(data, custom_mappings)
            
            # Extract required fields with defaults
            project_name = mapped_data.get('project_name', f"Project {datetime.now().strftime('%Y%m%d_%H%M%S')}")
            client_name = mapped_data.get('client_name', 'Unknown Client')
            
            # Parse dates
            start_date = self._parse_date(mapped_data.get('start_date', datetime.now().date()))
            end_date = self._parse_date(mapped_data.get('end_date', datetime.now().date()))
            
            # Parse costs
            total_cost = self._parse_float(mapped_data.get('total_cost', 0.0))
            labor_cost = self._parse_float(mapped_data.get('labor_cost', 0.0))
            material_cost = self._parse_float(mapped_data.get('material_cost', 0.0))
            
            # Create location data
            location = LocationData(
                country=mapped_data.get('country', 'USA'),
                state_province=mapped_data.get('state', 'Unknown'),
                city=mapped_data.get('city', 'Unknown'),
                postal_code=mapped_data.get('postal_code'),
                region=mapped_data.get('region')
            )
            
            # Create cost data
            cost_data = CostData(
                total_cost=total_cost,
                labor_cost=labor_cost,
                material_cost=material_cost,
                equipment_cost=self._parse_float(mapped_data.get('equipment_cost', 0.0)),
                overhead_cost=self._parse_float(mapped_data.get('overhead_cost', 0.0)),
                currency=mapped_data.get('currency', 'USD'),
                cost_date=datetime.now(),
                inflation_adjusted=mapped_data.get('inflation_adjusted', False)
            )
            
            # Create classification
            classification = ProjectClassification(
                primary_type=self._parse_enum(mapped_data.get('project_type'), ProjectType, ProjectType.COMMERCIAL),
                industry_category=self._parse_enum(mapped_data.get('industry'), IndustryCategory, IndustryCategory.COMMERCIAL_BUILDING),
                complexity_level=self._parse_enum(mapped_data.get('complexity'), ProjectComplexity, ProjectComplexity.MEDIUM),
                confidence_score=0.8,  # Default confidence for imported data
                tags=self._parse_tags(mapped_data.get('tags', ''))
            )
            
            # Create quality metrics
            quality_metrics = QualityMetrics(
                overall_quality_score=self._parse_enum(mapped_data.get('quality'), QualityScore, QualityScore.GOOD),
                rework_hours=self._parse_float(mapped_data.get('rework_hours', 0.0)),
                defect_rate=self._parse_float(mapped_data.get('defect_rate', 0.0)),
                safety_incidents=self._parse_int(mapped_data.get('safety_incidents', 0)),
                client_satisfaction=self._parse_float(mapped_data.get('client_satisfaction')),
                nec_compliance_score=self._parse_float(mapped_data.get('nec_compliance'))
            )
            
            # Create risk factors
            risk_factors = RiskFactors(
                weather_delays=self._parse_float(mapped_data.get('weather_delays', 0.0)),
                material_delays=self._parse_float(mapped_data.get('material_delays', 0.0)),
                permit_delays=self._parse_float(mapped_data.get('permit_delays', 0.0)),
                change_orders=self._parse_int(mapped_data.get('change_orders', 0)),
                change_order_impact=self._parse_float(mapped_data.get('change_order_impact', 0.0))
            )
            
            # Create labor hours if data is available
            labor_hours = []
            if 'total_hours' in mapped_data:
                labor_hours.append(LaborHours(
                    role=LaborRole.ELECTRICIAN,
                    planned_hours=self._parse_float(mapped_data.get('planned_hours', mapped_data['total_hours'])),
                    actual_hours=self._parse_float(mapped_data['total_hours']),
                    hourly_rate=self._parse_float(mapped_data.get('hourly_rate', 50.0)),
                    overtime_hours=self._parse_float(mapped_data.get('overtime_hours', 0.0))
                ))
            
            # Create the project
            project = HistoricalProject(
                project_name=project_name,
                client_name=client_name,
                project_number=mapped_data.get('project_number'),
                classification=classification,
                location=location,
                description=mapped_data.get('description', f"Imported project: {project_name}"),
                planned_start_date=start_date,
                planned_end_date=end_date,
                actual_start_date=self._parse_date(mapped_data.get('actual_start_date')),
                actual_end_date=self._parse_date(mapped_data.get('actual_end_date')),
                cost_data=cost_data,
                total_labor_hours=labor_hours,
                quality_metrics=quality_metrics,
                risk_factors=risk_factors,
                status=self._parse_enum(mapped_data.get('status'), ProjectStatus, ProjectStatus.COMPLETED),
                completion_percentage=self._parse_float(mapped_data.get('completion_percentage', 100.0)),
                import_source="file_import",
                data_quality_score=0.8,  # Default quality score
                custom_fields={
                    k: v for k, v in mapped_data.items() 
                    if k not in self._get_standard_fields()
                }
            )
            
            return project
            
        except Exception as e:
            logger.error(f"Failed to create project from data: {e}")
            logger.debug(f"Problem data: {data}")
            return None
    
    def _map_fields(self, data: Dict[str, Any], custom_mappings: Dict[str, str] = None) -> Dict[str, Any]:
        """Map field names using standard and custom mappings"""
        mapped = {}
        
        # Apply custom mappings first
        if custom_mappings:
            for target_field, source_field in custom_mappings.items():
                if source_field in data:
                    mapped[target_field] = data[source_field]
        
        # Apply standard field mappings
        for target_field, possible_sources in self.field_mappings.items():
            if target_field not in mapped:  # Don't override custom mappings
                for source_field in possible_sources:
                    if source_field in data:
                        mapped[target_field] = data[source_field]
                        break
        
        # Include all other fields as-is
        for field, value in data.items():
            if field not in mapped:
                mapped[field] = value
        
        return mapped
    
    def _parse_date(self, value: Any) -> Optional[date]:
        """Parse date from various formats"""
        if value is None or pd.isna(value):
            return None
        
        if isinstance(value, date):
            return value
        
        if isinstance(value, datetime):
            return value.date()
        
        if isinstance(value, str):
            # Try common date formats
            formats = ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S']
            for fmt in formats:
                try:
                    return datetime.strptime(value, fmt).date()
                except ValueError:
                    continue
        
        return None
    
    def _parse_float(self, value: Any) -> float:
        """Parse float from various formats"""
        if value is None or pd.isna(value):
            return 0.0
        
        if isinstance(value, (int, float)):
            return float(value)
        
        if isinstance(value, str):
            # Remove currency symbols and commas
            cleaned = value.replace('$', '').replace(',', '').strip()
            try:
                return float(cleaned)
            except ValueError:
                return 0.0
        
        return 0.0
    
    def _parse_int(self, value: Any) -> int:
        """Parse integer from various formats"""
        if value is None or pd.isna(value):
            return 0
        
        if isinstance(value, int):
            return value
        
        if isinstance(value, float):
            return int(value)
        
        if isinstance(value, str):
            try:
                return int(float(value))
            except ValueError:
                return 0
        
        return 0
    
    def _parse_enum(self, value: Any, enum_class, default):
        """Parse enum value"""
        if value is None:
            return default
        
        if isinstance(value, enum_class):
            return value
        
        if isinstance(value, str):
            value = value.lower().replace(' ', '_')
            for enum_value in enum_class:
                if enum_value.value == value:
                    return enum_value
        
        return default
    
    def _parse_tags(self, value: Any) -> List[str]:
        """Parse tags from string or list"""
        if value is None or pd.isna(value):
            return []
        
        if isinstance(value, list):
            return [str(tag).strip() for tag in value]
        
        if isinstance(value, str):
            # Split on common separators
            separators = [',', ';', '|', '\n']
            for sep in separators:
                if sep in value:
                    return [tag.strip() for tag in value.split(sep) if tag.strip()]
            
            # Single tag
            return [value.strip()] if value.strip() else []
        
        return []
    
    def _get_standard_fields(self) -> set:
        """Get set of standard field names"""
        return {
            'project_name', 'client_name', 'project_number', 'description',
            'start_date', 'end_date', 'actual_start_date', 'actual_end_date',
            'total_cost', 'labor_cost', 'material_cost', 'equipment_cost',
            'project_type', 'industry', 'complexity', 'status',
            'country', 'state', 'city', 'postal_code', 'region',
            'total_hours', 'planned_hours', 'overtime_hours', 'hourly_rate',
            'quality', 'rework_hours', 'defect_rate', 'safety_incidents',
            'weather_delays', 'material_delays', 'permit_delays'
        }
    
    async def close(self):
        """Clean up resources"""
        logger.info("Closing Multi-Format Import Engine")
        self.initialized = False

# Example usage
if __name__ == "__main__":
    async def test_import():
        importer = MultiFormatImporter()
        await importer.initialize()
        
        # Test CSV import
        result = await importer.import_file("test_projects.csv")
        print(f"Imported {len(result.projects)} projects")
        
        await importer.close()
    
    asyncio.run(test_import())
