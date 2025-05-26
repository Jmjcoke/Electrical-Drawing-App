"""
Circuit Documentation and Reporting Generator

Generates comprehensive circuit documentation including schedules, load summaries,
and analysis reports.
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime
import json
import csv
import io
from pathlib import Path
import logging
from jinja2 import Environment, FileSystemLoader
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
import xlsxwriter
from circuit_validation import CircuitAnalysis, CircuitType, VoltageLevel

logger = logging.getLogger(__name__)

@dataclass
class ProjectInfo:
    """Project information for documentation"""
    name: str
    number: str
    location: str
    engineer: str
    contractor: str
    date: str
    revision: str = "1.0"
    description: str = ""

@dataclass
class PanelSchedule:
    """Electrical panel schedule data"""
    panel_id: str
    panel_type: str
    main_breaker_size: int
    voltage: str
    phases: int
    circuits: List[Dict[str, Any]]
    total_load_kva: float
    connected_load_kva: float
    demand_load_kva: float

class CircuitDocumentationGenerator:
    """Generates various types of circuit documentation"""
    
    def __init__(self, template_dir: Optional[str] = None):
        self.template_dir = template_dir or "templates"
        self.jinja_env = Environment(loader=FileSystemLoader(self.template_dir))
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Setup custom styles for PDF generation"""
        self.styles.add(ParagraphStyle(
            name='CircuitTitle',
            parent=self.styles['Heading1'],
            fontSize=16,
            spaceAfter=12,
            alignment=TA_CENTER
        ))
        
        self.styles.add(ParagraphStyle(
            name='CircuitHeading',
            parent=self.styles['Heading2'],
            fontSize=12,
            spaceAfter=6,
            textColor=colors.darkblue
        ))
        
        self.styles.add(ParagraphStyle(
            name='CircuitBody',
            parent=self.styles['Normal'],
            fontSize=10,
            spaceAfter=6
        ))
    
    def generate_circuit_schedule(
        self,
        circuits: List[CircuitAnalysis],
        panel_info: PanelSchedule,
        project_info: ProjectInfo,
        output_format: str = "pdf"
    ) -> bytes:
        """Generate electrical panel schedule"""
        
        if output_format.lower() == "pdf":
            return self._generate_schedule_pdf(circuits, panel_info, project_info)
        elif output_format.lower() == "excel":
            return self._generate_schedule_excel(circuits, panel_info, project_info)
        elif output_format.lower() == "csv":
            return self._generate_schedule_csv(circuits, panel_info, project_info)
        else:
            raise ValueError(f"Unsupported output format: {output_format}")
    
    def _generate_schedule_pdf(
        self, 
        circuits: List[CircuitAnalysis],
        panel_info: PanelSchedule,
        project_info: ProjectInfo
    ) -> bytes:
        """Generate PDF panel schedule"""
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        
        # Title
        title = Paragraph(f"ELECTRICAL PANEL SCHEDULE - {panel_info.panel_id}", self.styles['CircuitTitle'])
        story.append(title)
        story.append(Spacer(1, 12))
        
        # Project information
        project_data = [
            ["Project:", project_info.name, "Project No.:", project_info.number],
            ["Location:", project_info.location, "Date:", project_info.date],
            ["Engineer:", project_info.engineer, "Revision:", project_info.revision],
            ["Contractor:", project_info.contractor, "Panel Type:", panel_info.panel_type]
        ]
        
        project_table = Table(project_data, colWidths=[1*inch, 2.5*inch, 1*inch, 1.5*inch])
        project_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black)
        ]))
        story.append(project_table)
        story.append(Spacer(1, 12))
        
        # Panel information
        panel_data = [
            ["Main Breaker:", f"{panel_info.main_breaker_size}A", "Voltage:", panel_info.voltage],
            ["Phases:", str(panel_info.phases), "Connected Load:", f"{panel_info.connected_load_kva:.1f} kVA"],
            ["Total Circuits:", str(len(circuits)), "Demand Load:", f"{panel_info.demand_load_kva:.1f} kVA"]
        ]
        
        panel_table = Table(panel_data, colWidths=[1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch])
        panel_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BACKGROUND', (0, 0), (-1, -1), colors.lightgrey),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black)
        ]))
        story.append(panel_table)
        story.append(Spacer(1, 12))
        
        # Circuit schedule
        circuit_headers = [
            "Ckt", "Description", "Load\n(VA)", "Breaker\n(A)", "Wire\nSize", 
            "Voltage\nDrop (%)", "Notes"
        ]
        
        circuit_data = [circuit_headers]
        
        for i, circuit in enumerate(circuits, 1):
            notes = []
            if circuit.compliance_issues:
                notes.append("⚠ Compliance")
            if circuit.safety_analysis.get("hazard_level") == "high":
                notes.append("⚠ High Risk")
            
            circuit_data.append([
                str(i),
                circuit.circuit_id,
                f"{circuit.total_load.power_watts:.0f}",
                f"{circuit.current_capacity:.0f}",
                circuit.conductor.size_awg,
                f"{circuit.voltage_drop_percent:.1f}",
                " ".join(notes)
            ])
        
        circuit_table = Table(circuit_data, colWidths=[0.5*inch, 2*inch, 0.8*inch, 0.8*inch, 0.8*inch, 0.8*inch, 1.3*inch])
        circuit_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 8),
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold')
        ]))
        story.append(circuit_table)
        
        # Load summary
        story.append(Spacer(1, 20))
        summary_title = Paragraph("LOAD SUMMARY", self.styles['CircuitHeading'])
        story.append(summary_title)
        
        load_summary_data = [
            ["Circuit Type", "Connected Load (VA)", "Demand Factor", "Demand Load (VA)"],
            ["Lighting", f"{self._calculate_type_load(circuits, CircuitType.LIGHTING):.0f}", "100%", f"{self._calculate_type_load(circuits, CircuitType.LIGHTING):.0f}"],
            ["Receptacles", f"{self._calculate_type_load(circuits, CircuitType.RECEPTACLE):.0f}", "100%", f"{self._calculate_type_load(circuits, CircuitType.RECEPTACLE):.0f}"],
            ["Motors", f"{self._calculate_type_load(circuits, CircuitType.MOTOR):.0f}", "125%", f"{self._calculate_type_load(circuits, CircuitType.MOTOR) * 1.25:.0f}"],
            ["Total", f"{sum(c.total_load.power_watts for c in circuits):.0f}", "-", f"{panel_info.demand_load_kva * 1000:.0f}"]
        ]
        
        load_summary_table = Table(load_summary_data, colWidths=[2*inch, 1.5*inch, 1*inch, 1.5*inch])
        load_summary_table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
            ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black)
        ]))
        story.append(load_summary_table)
        
        doc.build(story)
        buffer.seek(0)
        return buffer.read()
    
    def _generate_schedule_excel(
        self,
        circuits: List[CircuitAnalysis],
        panel_info: PanelSchedule,
        project_info: ProjectInfo
    ) -> bytes:
        """Generate Excel panel schedule"""
        
        buffer = io.BytesIO()
        
        with xlsxwriter.Workbook(buffer, {'in_memory': True}) as workbook:
            worksheet = workbook.add_worksheet('Panel Schedule')
            
            # Formats
            title_format = workbook.add_format({
                'bold': True, 'font_size': 16, 'align': 'center',
                'valign': 'vcenter', 'bg_color': '#366092', 'font_color': 'white'
            })
            header_format = workbook.add_format({
                'bold': True, 'bg_color': '#D7E4BC', 'border': 1,
                'align': 'center', 'valign': 'vcenter'
            })
            data_format = workbook.add_format({'border': 1, 'align': 'center'})
            
            row = 0
            
            # Title
            worksheet.merge_range(row, 0, row, 6, f'ELECTRICAL PANEL SCHEDULE - {panel_info.panel_id}', title_format)
            row += 2
            
            # Project information
            project_headers = ['Project:', 'Location:', 'Engineer:', 'Date:']
            project_values = [project_info.name, project_info.location, project_info.engineer, project_info.date]
            
            for i, (header, value) in enumerate(zip(project_headers, project_values)):
                worksheet.write(row + i, 0, header, header_format)
                worksheet.write(row + i, 1, value, data_format)
            
            row += len(project_headers) + 1
            
            # Circuit schedule headers
            headers = ['Circuit', 'Description', 'Load (VA)', 'Breaker (A)', 'Wire Size', 'Voltage Drop (%)', 'Notes']
            for col, header in enumerate(headers):
                worksheet.write(row, col, header, header_format)
            row += 1
            
            # Circuit data
            for i, circuit in enumerate(circuits, 1):
                notes = []
                if circuit.compliance_issues:
                    notes.append("Compliance Issues")
                if circuit.safety_analysis.get("hazard_level") == "high":
                    notes.append("High Risk")
                
                data = [
                    i,
                    circuit.circuit_id,
                    circuit.total_load.power_watts,
                    circuit.current_capacity,
                    circuit.conductor.size_awg,
                    circuit.voltage_drop_percent,
                    "; ".join(notes)
                ]
                
                for col, value in enumerate(data):
                    worksheet.write(row, col, value, data_format)
                row += 1
            
            # Auto-adjust column widths
            for col in range(len(headers)):
                worksheet.set_column(col, col, 15)
        
        buffer.seek(0)
        return buffer.read()
    
    def _generate_schedule_csv(
        self,
        circuits: List[CircuitAnalysis],
        panel_info: PanelSchedule,
        project_info: ProjectInfo
    ) -> bytes:
        """Generate CSV panel schedule"""
        
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        
        # Project information
        writer.writerow([f"Panel Schedule - {panel_info.panel_id}"])
        writer.writerow([])
        writer.writerow(["Project:", project_info.name])
        writer.writerow(["Location:", project_info.location])
        writer.writerow(["Engineer:", project_info.engineer])
        writer.writerow(["Date:", project_info.date])
        writer.writerow([])
        
        # Circuit schedule
        writer.writerow(["Circuit", "Description", "Load (VA)", "Breaker (A)", "Wire Size", "Voltage Drop (%)", "Notes"])
        
        for i, circuit in enumerate(circuits, 1):
            notes = []
            if circuit.compliance_issues:
                notes.append("Compliance Issues")
            if circuit.safety_analysis.get("hazard_level") == "high":
                notes.append("High Risk")
            
            writer.writerow([
                i,
                circuit.circuit_id,
                circuit.total_load.power_watts,
                circuit.current_capacity,
                circuit.conductor.size_awg,
                f"{circuit.voltage_drop_percent:.1f}",
                "; ".join(notes)
            ])
        
        return buffer.getvalue().encode('utf-8')
    
    def generate_load_analysis_report(
        self,
        circuits: List[CircuitAnalysis],
        project_info: ProjectInfo,
        output_format: str = "pdf"
    ) -> bytes:
        """Generate comprehensive load analysis report"""
        
        if output_format.lower() == "pdf":
            return self._generate_load_report_pdf(circuits, project_info)
        else:
            raise ValueError(f"Unsupported output format: {output_format}")
    
    def _generate_load_report_pdf(
        self,
        circuits: List[CircuitAnalysis],
        project_info: ProjectInfo
    ) -> bytes:
        """Generate PDF load analysis report"""
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        story = []
        
        # Title page
        title = Paragraph("ELECTRICAL LOAD ANALYSIS REPORT", self.styles['CircuitTitle'])
        story.append(title)
        story.append(Spacer(1, 30))
        
        # Project information
        project_text = f"""
        <b>Project:</b> {project_info.name}<br/>
        <b>Location:</b> {project_info.location}<br/>
        <b>Engineer:</b> {project_info.engineer}<br/>
        <b>Date:</b> {project_info.date}<br/>
        <b>Report Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M')}
        """
        story.append(Paragraph(project_text, self.styles['CircuitBody']))
        story.append(PageBreak())
        
        # Executive summary
        story.append(Paragraph("EXECUTIVE SUMMARY", self.styles['CircuitHeading']))
        
        total_load = sum(c.total_load.power_watts for c in circuits)
        total_circuits = len(circuits)
        compliance_issues = sum(len(c.compliance_issues) for c in circuits)
        high_risk_circuits = sum(1 for c in circuits if c.safety_analysis.get("hazard_level") == "high")
        
        summary_text = f"""
        This report presents a comprehensive analysis of {total_circuits} electrical circuits 
        with a total connected load of {total_load:,.0f} watts ({total_load/1000:.1f} kW).
        <br/><br/>
        <b>Key Findings:</b><br/>
        • Total Circuits Analyzed: {total_circuits}<br/>
        • Total Connected Load: {total_load/1000:.1f} kW<br/>
        • Compliance Issues Identified: {compliance_issues}<br/>
        • High Risk Circuits: {high_risk_circuits}<br/>
        • Average Voltage Drop: {sum(c.voltage_drop_percent for c in circuits)/len(circuits):.1f}%
        """
        story.append(Paragraph(summary_text, self.styles['CircuitBody']))
        story.append(Spacer(1, 20))
        
        # Detailed analysis for each circuit
        story.append(Paragraph("DETAILED CIRCUIT ANALYSIS", self.styles['CircuitHeading']))
        
        for circuit in circuits:
            story.append(self._generate_circuit_detail_section(circuit))
            story.append(Spacer(1, 15))
        
        doc.build(story)
        buffer.seek(0)
        return buffer.read()
    
    def _generate_circuit_detail_section(self, circuit: CircuitAnalysis) -> Table:
        """Generate detailed section for a single circuit"""
        
        data = [
            ["Circuit ID", circuit.circuit_id],
            ["Circuit Type", circuit.circuit_type.value.title()],
            ["Voltage Level", f"{circuit.voltage_level.value}V"],
            ["Connected Load", f"{circuit.total_load.power_watts:.0f}W"],
            ["Load Current", f"{circuit.total_load.current_amps:.1f}A"],
            ["Conductor", f"{circuit.conductor.size_awg} AWG {circuit.conductor.material.value}"],
            ["Conductor Length", f"{circuit.conductor.length_feet:.0f} ft"],
            ["Voltage Drop", f"{circuit.voltage_drop_volts:.1f}V ({circuit.voltage_drop_percent:.1f}%)"],
            ["Current Capacity", f"{circuit.current_capacity:.0f}A"],
            ["Safety Level", circuit.safety_analysis.get("hazard_level", "unknown").title()]
        ]
        
        # Add compliance issues
        if circuit.compliance_issues:
            data.append(["Compliance Issues", "; ".join(circuit.compliance_issues)])
        
        # Add recommendations
        if circuit.recommendations:
            data.append(["Recommendations", "; ".join(circuit.recommendations)])
        
        table = Table(data, colWidths=[2*inch, 4*inch])
        table.setStyle(TableStyle([
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black)
        ]))
        
        return table
    
    def _calculate_type_load(self, circuits: List[CircuitAnalysis], circuit_type: CircuitType) -> float:
        """Calculate total load for specific circuit type"""
        return sum(
            circuit.total_load.power_watts 
            for circuit in circuits 
            if circuit.circuit_type == circuit_type
        )
    
    def generate_compliance_report(
        self,
        circuits: List[CircuitAnalysis],
        project_info: ProjectInfo
    ) -> bytes:
        """Generate NEC compliance report"""
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        story = []
        
        # Title
        title = Paragraph("NEC COMPLIANCE REPORT", self.styles['CircuitTitle'])
        story.append(title)
        story.append(Spacer(1, 20))
        
        # Project information
        project_text = f"""
        <b>Project:</b> {project_info.name}<br/>
        <b>Date:</b> {datetime.now().strftime('%Y-%m-%d')}<br/>
        <b>NEC Edition:</b> 2023
        """
        story.append(Paragraph(project_text, self.styles['CircuitBody']))
        story.append(Spacer(1, 20))
        
        # Compliance summary
        total_circuits = len(circuits)
        compliant_circuits = len([c for c in circuits if not c.compliance_issues])
        compliance_rate = (compliant_circuits / total_circuits * 100) if total_circuits > 0 else 0
        
        summary_text = f"""
        <b>COMPLIANCE SUMMARY</b><br/>
        Total Circuits: {total_circuits}<br/>
        Compliant Circuits: {compliant_circuits}<br/>
        Compliance Rate: {compliance_rate:.1f}%<br/>
        """
        story.append(Paragraph(summary_text, self.styles['CircuitBody']))
        story.append(Spacer(1, 15))
        
        # Non-compliant circuits
        non_compliant = [c for c in circuits if c.compliance_issues]
        if non_compliant:
            story.append(Paragraph("NON-COMPLIANT CIRCUITS", self.styles['CircuitHeading']))
            
            for circuit in non_compliant:
                circuit_text = f"""
                <b>Circuit {circuit.circuit_id}:</b><br/>
                {'; '.join(circuit.compliance_issues)}
                """
                story.append(Paragraph(circuit_text, self.styles['CircuitBody']))
                story.append(Spacer(1, 10))
        
        doc.build(story)
        buffer.seek(0)
        return buffer.read()

# Example usage
def example_documentation_generation():
    """Example of documentation generation"""
    from circuit_validation import (
        CircuitAnalysis, CircuitType, VoltageLevel, LoadData, ConductorData, ConductorType
    )
    
    # Create sample project info
    project_info = ProjectInfo(
        name="Office Building Renovation",
        number="2024-001",
        location="123 Main Street, Anytown, USA",
        engineer="John Smith, PE",
        contractor="ABC Electrical",
        date="2024-01-15"
    )
    
    # Create sample panel info
    panel_info = PanelSchedule(
        panel_id="LP-1",
        panel_type="42-circuit panel",
        main_breaker_size=225,
        voltage="120/208V, 3-phase",
        phases=3,
        circuits=[],
        total_load_kva=45.0,
        connected_load_kva=38.5,
        demand_load_kva=42.0
    )
    
    # Create sample circuits (would normally come from circuit analysis)
    circuits = []  # Add sample CircuitAnalysis objects here
    
    # Generate documentation
    generator = CircuitDocumentationGenerator()
    
    # Generate panel schedule
    pdf_schedule = generator.generate_circuit_schedule(circuits, panel_info, project_info, "pdf")
    
    # Generate load analysis report
    load_report = generator.generate_load_analysis_report(circuits, project_info, "pdf")
    
    # Generate compliance report
    compliance_report = generator.generate_compliance_report(circuits, project_info)
    
    return pdf_schedule, load_report, compliance_report

if __name__ == "__main__":
    # Run example
    schedule, load_report, compliance = example_documentation_generation()
    print(f"Generated schedule: {len(schedule)} bytes")
    print(f"Generated load report: {len(load_report)} bytes")
    print(f"Generated compliance report: {len(compliance)} bytes")