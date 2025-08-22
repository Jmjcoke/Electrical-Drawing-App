/**
 * PDF Export Handler
 * Generates PDF reports from component data
 * Implements Story 4.5 requirements for PDF export format
 */

import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import {
  ComponentReport,
  ReportTemplate,
  ExportOptions,
  ComponentReportItem,
  BrandingOptions
} from '../../../../shared/types/nlp.types';
import { ReportGeneratorService } from '../report-generator.service';

export class PdfExportHandler {
  private reportGenerator: ReportGeneratorService;
  private exportDirectory: string;

  constructor() {
    this.reportGenerator = new ReportGeneratorService();
    this.exportDirectory = process.env.EXPORT_DIR || '/tmp/electrical-exports';
  }

  /**
   * Generate PDF report
   */
  public async generateReport(
    report: ComponentReport,
    template: ReportTemplate,
    options: ExportOptions,
    secureFilePath?: string
  ): Promise<string> {
    let filePath: string;
    
    if (secureFilePath) {
      // Use the provided secure file path
      filePath = secureFilePath;
    } else {
      // Generate file path (legacy method)
      const fileName = this.reportGenerator.generateFileName(
        report.reportType,
        'pdf',
        report.sessionId
      );
      filePath = await this.reportGenerator.getFilePath(fileName);
    }

    // Generate report data
    const reportData = await this.reportGenerator.generateReportData(
      report,
      template,
      options
    );

    // Create PDF document
    const doc = new PDFDocument({
      size: this.getPageSize(template.layout.pageSize),
      margins: {
        top: template.layout.margins.top * 2.83465, // Convert mm to points
        bottom: template.layout.margins.bottom * 2.83465,
        left: template.layout.margins.left * 2.83465,
        right: template.layout.margins.right * 2.83465
      },
      layout: template.layout.orientation
    });

    // Pipe to file
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Apply branding
    this.applyBranding(doc, reportData.branding);

    // Add header
    this.addHeader(doc, reportData);

    // Add table of contents if enabled
    if (template.layout.includeTOC) {
      this.addTableOfContents(doc, reportData.sections);
    }

    // Process each section
    for (const section of reportData.sections) {
      await this.addSection(doc, section, options);
    }

    // Add page numbers if enabled
    if (template.layout.includePageNumbers) {
      this.addPageNumbers(doc);
    }

    // Finalize PDF
    doc.end();

    // Wait for stream to finish
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    return filePath;
  }

  /**
   * Get PDFKit page size
   */
  private getPageSize(size: 'A4' | 'Letter' | 'Legal'): [number, number] | string {
    const sizes = {
      'A4': 'A4',
      'Letter': 'LETTER',
      'Legal': 'LEGAL'
    };
    return sizes[size] || 'A4';
  }

  /**
   * Apply branding to PDF
   */
  private applyBranding(doc: PDFDocument.PDFDocument, branding: BrandingOptions): void {
    if (!branding) return;

    // Set font if specified
    if (branding.fontFamily) {
      try {
        // Use built-in fonts or register custom fonts
        const fontMap: Record<string, string> = {
          'Helvetica': 'Helvetica',
          'Times': 'Times-Roman',
          'Courier': 'Courier'
        };
        doc.font(fontMap[branding.fontFamily] || 'Helvetica');
      } catch (error) {
        console.warn('Font not available, using default');
        doc.font('Helvetica');
      }
    }

    // Note: Logo would be added in header section
  }

  /**
   * Add header to PDF
   */
  private addHeader(doc: PDFDocument.PDFDocument, reportData: any): void {
    const startY = doc.y;

    // Add logo if provided
    if (reportData.branding?.logoBase64) {
      try {
        const logoBuffer = Buffer.from(reportData.branding.logoBase64, 'base64');
        doc.image(logoBuffer, 50, startY, { width: 100 });
        doc.moveDown();
      } catch (error) {
        console.warn('Failed to add logo:', error);
      }
    }

    // Add title
    doc.fontSize(24)
       .fillColor(reportData.branding?.primaryColor || '#000000')
       .text(reportData.title, { align: 'center' });

    // Add subtitle
    if (reportData.subtitle) {
      doc.fontSize(14)
         .fillColor('#666666')
         .text(reportData.subtitle, { align: 'center' });
    }

    // Add generation date
    doc.fontSize(10)
       .fillColor('#999999')
       .text(`Generated: ${new Date(reportData.generatedDate).toLocaleString()}`, { align: 'center' });

    doc.moveDown(2);

    // Add separator line
    doc.moveTo(50, doc.y)
       .lineTo(doc.page.width - 50, doc.y)
       .stroke(reportData.branding?.secondaryColor || '#cccccc');

    doc.moveDown();
  }

  /**
   * Add table of contents
   */
  private addTableOfContents(doc: PDFDocument.PDFDocument, sections: any[]): void {
    doc.addPage();
    
    doc.fontSize(18)
       .fillColor('#000000')
       .text('Table of Contents', { align: 'center' });
    
    doc.moveDown();

    let tocIndex = 1;
    for (const section of sections) {
      const sectionName = this.getSectionName(section.type);
      
      doc.fontSize(12)
         .fillColor('#000000')
         .text(`${tocIndex}. ${sectionName}`, 100);
      
      tocIndex++;
    }

    doc.addPage();
  }

  /**
   * Add section to PDF
   */
  private async addSection(
    doc: PDFDocument.PDFDocument,
    section: any,
    options: ExportOptions
  ): Promise<void> {
    switch (section.type) {
      case 'header':
        this.addHeaderSection(doc, section.content);
        break;
      
      case 'summary':
        this.addSummarySection(doc, section.content);
        break;
      
      case 'component_list':
        this.addComponentListSection(doc, section.content, options);
        break;
      
      case 'visual_map':
        await this.addVisualMapSection(doc, section.content);
        break;
      
      case 'cross_references':
        this.addCrossReferencesSection(doc, section.content);
        break;
      
      case 'footer':
        this.addFooterSection(doc, section.content);
        break;
    }
  }

  /**
   * Add header section
   */
  private addHeaderSection(doc: PDFDocument.PDFDocument, content: any): void {
    doc.fontSize(14)
       .fillColor('#000000')
       .text('Report Information', { underline: true });
    
    doc.moveDown();

    for (const [key, value] of Object.entries(content)) {
      doc.fontSize(10)
         .fillColor('#000000')
         .text(`${this.formatKey(key)}: `, { continued: true })
         .fillColor('#666666')
         .text(String(value));
    }

    doc.moveDown();
  }

  /**
   * Add summary section
   */
  private addSummarySection(doc: PDFDocument.PDFDocument, content: any): void {
    doc.fontSize(14)
       .fillColor('#000000')
       .text('Component Summary', { underline: true });
    
    doc.moveDown();

    // Add summary statistics
    doc.fontSize(10);
    
    if (content.totalComponents !== undefined) {
      doc.text(`Total Components: ${content.totalComponents}`);
    }
    
    if (content.totalPages !== undefined) {
      doc.text(`Total Pages: ${content.totalPages}`);
    }
    
    if (content.averageConfidence) {
      doc.text(`Average Confidence: ${content.averageConfidence}`);
    }
    
    if (content.processingTime) {
      doc.text(`Processing Time: ${content.processingTime}`);
    }

    // Add components by type
    if (content.componentsByType && content.componentsByType.length > 0) {
      doc.moveDown();
      doc.fontSize(12)
         .fillColor('#000000')
         .text('Components by Type:', { underline: true });
      
      doc.fontSize(10);
      for (const typeInfo of content.componentsByType) {
        doc.text(`  • ${typeInfo.type}: ${typeInfo.count}`);
      }
    }

    // Add statistics
    if (content.statistics) {
      doc.moveDown();
      doc.fontSize(12)
         .fillColor('#000000')
         .text('Statistics:', { underline: true });
      
      doc.fontSize(10);
      for (const [key, value] of Object.entries(content.statistics)) {
        doc.text(`  • ${this.formatKey(key)}: ${value}`);
      }
    }

    doc.moveDown();
  }

  /**
   * Add component list section
   */
  private addComponentListSection(
    doc: PDFDocument.PDFDocument,
    components: any[],
    options: ExportOptions
  ): void {
    doc.addPage();
    
    doc.fontSize(14)
       .fillColor('#000000')
       .text('Component List', { underline: true });
    
    doc.moveDown();

    // Create table header
    const columns = this.getComponentColumns(components[0], options);
    
    // Draw table header
    doc.fontSize(10)
       .fillColor('#000000');
    
    let x = 50;
    for (const column of columns) {
      doc.text(column.header, x, doc.y, { width: column.width, align: 'left' });
      x += column.width;
    }
    
    doc.moveDown();
    
    // Draw separator line
    doc.moveTo(50, doc.y)
       .lineTo(doc.page.width - 50, doc.y)
       .stroke('#cccccc');
    
    doc.moveDown(0.5);

    // Add component rows
    for (const component of components) {
      // Check if we need a new page
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
        
        // Redraw header on new page
        x = 50;
        for (const column of columns) {
          doc.text(column.header, x, doc.y, { width: column.width, align: 'left' });
          x += column.width;
        }
        doc.moveDown();
        doc.moveTo(50, doc.y)
           .lineTo(doc.page.width - 50, doc.y)
           .stroke('#cccccc');
        doc.moveDown(0.5);
      }

      // Draw component row
      x = 50;
      doc.fontSize(9)
         .fillColor('#333333');
      
      for (const column of columns) {
        const value = this.getComponentValue(component, column.key);
        doc.text(String(value || ''), x, doc.y, { width: column.width, align: 'left' });
        x += column.width;
      }
      
      doc.moveDown(0.5);
    }
  }

  /**
   * Add visual map section
   */
  private async addVisualMapSection(doc: PDFDocument.PDFDocument, maps: any[]): Promise<void> {
    if (!maps || maps.length === 0) return;

    doc.addPage();
    
    doc.fontSize(14)
       .fillColor('#000000')
       .text('Component Location Maps', { underline: true });
    
    doc.moveDown();

    for (const map of maps) {
      doc.fontSize(12)
         .fillColor('#000000')
         .text(`Page ${map.pageNumber} - ${map.componentCount} components`);
      
      doc.fontSize(10)
         .fillColor('#666666')
         .text(`Dimensions: ${map.dimensions}`);
      
      // In a real implementation, we would render the actual visual map here
      // For now, we'll just list the components
      if (map.components && map.components.length > 0) {
        doc.moveDown();
        doc.fontSize(9);
        for (const marker of map.components) {
          doc.text(`  • ${marker.label} at ${marker.position}`);
        }
      }
      
      doc.moveDown();
    }
  }

  /**
   * Add cross references section
   */
  private addCrossReferencesSection(doc: PDFDocument.PDFDocument, references: any[]): void {
    if (!references || references.length === 0) return;

    doc.addPage();
    
    doc.fontSize(14)
       .fillColor('#000000')
       .text('Cross-Page References', { underline: true });
    
    doc.moveDown();

    doc.fontSize(10);
    
    for (const ref of references) {
      doc.text(`• ${ref.sourceComponent} (Page ${ref.sourcePage}) → ${ref.targetComponent} (Page ${ref.targetPage})`);
      doc.fontSize(9)
         .fillColor('#666666')
         .text(`  Type: ${ref.referenceType}${ref.confidence ? `, Confidence: ${ref.confidence}` : ''}`);
      doc.fontSize(10)
         .fillColor('#000000');
    }
    
    doc.moveDown();
  }

  /**
   * Add footer section
   */
  private addFooterSection(doc: PDFDocument.PDFDocument, content: any): void {
    // Add to bottom of last page
    const bottomY = doc.page.height - 100;
    
    doc.y = bottomY;
    
    // Draw separator line
    doc.moveTo(50, doc.y)
       .lineTo(doc.page.width - 50, doc.y)
       .stroke('#cccccc');
    
    doc.moveDown(0.5);
    
    doc.fontSize(8)
       .fillColor('#666666');
    
    if (content.generationTime) {
      doc.text(`Generation Time: ${content.generationTime}`);
    }
    
    if (content.exportVersion) {
      doc.text(`Export Version: ${content.exportVersion}`);
    }
    
    if (content.disclaimer) {
      doc.moveDown(0.5);
      doc.text(content.disclaimer, { align: 'center' });
    }
  }

  /**
   * Add page numbers
   */
  private addPageNumbers(doc: PDFDocument.PDFDocument): void {
    const range = doc.bufferedPageRange();
    
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      
      const pageNumber = `Page ${i + 1} of ${range.count}`;
      
      doc.fontSize(8)
         .fillColor('#999999')
         .text(
           pageNumber,
           50,
           doc.page.height - 50,
           { align: 'center' }
         );
    }
  }

  /**
   * Get component columns for table
   */
  private getComponentColumns(sample: any, options: ExportOptions): any[] {
    const columns = [
      { key: 'type', header: 'Type', width: 80 },
      { key: 'description', header: 'Description', width: 150 },
      { key: 'page', header: 'Page', width: 50 },
      { key: 'zone', header: 'Zone', width: 50 }
    ];

    if (options.includeTechnicalSpecs && sample.specifications) {
      columns.push({ key: 'specifications', header: 'Specifications', width: 120 });
    }

    if (options.includePartNumbers && sample.partNumber) {
      columns.push({ key: 'partNumber', header: 'Part #', width: 80 });
    }

    if (options.includeConfidenceScores && sample.confidence) {
      columns.push({ key: 'confidence', header: 'Confidence', width: 60 });
    }

    return columns;
  }

  /**
   * Get component value for column
   */
  private getComponentValue(component: any, key: string): any {
    return component[key] || '';
  }

  /**
   * Format key for display
   */
  private formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Get section name for TOC
   */
  private getSectionName(type: string): string {
    const names: Record<string, string> = {
      'header': 'Report Information',
      'summary': 'Component Summary',
      'component_list': 'Component List',
      'visual_map': 'Visual Maps',
      'cross_references': 'Cross References',
      'footer': 'Report Footer'
    };
    return names[type] || type;
  }
}