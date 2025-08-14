/**
 * Report Generator Service
 * Handles report generation and formatting for different export types
 * Implements Story 4.5 requirements for multi-format report generation
 */

import {
  ComponentReport,
  ReportTemplate,
  ExportOptions,
  ComponentReportItem,
  ReportSection,
  BrandingOptions,
  ComponentSummary
} from '../../../../shared/types/nlp.types';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface GeneratedSection {
  type: string;
  content: string | any;
  order: number;
}

export interface ReportData {
  title: string;
  subtitle?: string;
  generatedDate: string;
  sections: GeneratedSection[];
  branding: BrandingOptions;
  metadata: Record<string, any>;
}

export class ReportGeneratorService {
  private exportDirectory: string;

  constructor() {
    this.exportDirectory = process.env.EXPORT_DIR || '/tmp/electrical-exports';
  }

  /**
   * Generate formatted report data from component report
   */
  public async generateReportData(
    report: ComponentReport,
    template: ReportTemplate,
    options: ExportOptions
  ): Promise<ReportData> {
    const sections: GeneratedSection[] = [];

    // Process each template section
    for (const section of template.sections.filter(s => s.enabled)) {
      const sectionContent = await this.generateSection(
        section,
        report,
        options
      );
      
      if (sectionContent) {
        sections.push({
          type: section.type,
          content: sectionContent,
          order: section.order
        });
      }
    }

    // Sort sections by order
    sections.sort((a, b) => a.order - b.order);

    // Merge branding options
    const branding = {
      ...template.branding,
      ...options.customBranding
    };

    return {
      title: this.getReportTitle(report, template),
      subtitle: this.getReportSubtitle(report, template),
      generatedDate: report.generatedAt.toISOString(),
      sections,
      branding,
      metadata: {
        reportId: report.id,
        sessionId: report.sessionId,
        format: report.format,
        templateName: template.name,
        componentCount: report.components.length,
        pageCount: report.metadata.pageCount
      }
    };
  }

  /**
   * Generate content for a specific report section
   */
  private async generateSection(
    section: ReportSection,
    report: ComponentReport,
    options: ExportOptions
  ): Promise<any> {
    switch (section.type) {
      case 'header':
        return this.generateHeaderSection(report, options);
      
      case 'summary':
        return this.generateSummarySection(report, options);
      
      case 'component_list':
        return this.generateComponentListSection(report, options, section.config);
      
      case 'visual_map':
        return this.generateVisualMapSection(report, options);
      
      case 'cross_references':
        return this.generateCrossReferencesSection(report, options);
      
      case 'footer':
        return this.generateFooterSection(report, options);
      
      default:
        return null;
    }
  }

  /**
   * Generate header section
   */
  private generateHeaderSection(
    report: ComponentReport,
    options: ExportOptions
  ): Record<string, any> {
    return {
      reportType: this.formatReportType(report.reportType),
      generatedAt: new Date(report.generatedAt).toLocaleString(),
      sessionId: report.sessionId,
      documentCount: report.metadata.documentCount,
      pageCount: report.metadata.pageCount
    };
  }

  /**
   * Generate summary section
   */
  private generateSummarySection(
    report: ComponentReport,
    options: ExportOptions
  ): Record<string, any> {
    const summary = report.componentSummary;
    
    return {
      totalComponents: summary.totalComponents,
      componentsByType: this.formatComponentsByType(summary.componentsByType),
      totalPages: summary.totalPages,
      averageConfidence: options.includeConfidenceScores 
        ? `${(summary.confidenceAverage * 100).toFixed(1)}%`
        : undefined,
      processingTime: `${summary.processingTime}ms`,
      statistics: this.calculateStatistics(report.components)
    };
  }

  /**
   * Generate component list section
   */
  private generateComponentListSection(
    report: ComponentReport,
    options: ExportOptions,
    sectionConfig?: Record<string, any>
  ): any[] {
    const includePartNumbers = sectionConfig?.includePartNumbers || options.includePartNumbers;
    const includeTechnicalSpecs = options.includeTechnicalSpecs;
    const includeConfidence = options.includeConfidenceScores;

    return report.components.map(component => {
      const item: any = {
        id: component.id,
        type: component.type,
        description: component.description,
        page: component.location.pageNumber,
        zone: component.location.zone || 'N/A'
      };

      if (includeTechnicalSpecs && component.specifications) {
        item.specifications = this.formatSpecifications(component.specifications);
      }

      if (includePartNumbers && component.partInformation) {
        item.partNumber = component.partInformation.partNumber || 'N/A';
        item.manufacturer = component.partInformation.manufacturerPartNumber || 'N/A';
        item.supplier = component.partInformation.supplier || 'N/A';
      }

      if (includeConfidence) {
        item.confidence = `${(component.confidence * 100).toFixed(1)}%`;
      }

      if (component.relatedComponents && component.relatedComponents.length > 0) {
        item.relatedComponents = component.relatedComponents;
      }

      return item;
    });
  }

  /**
   * Generate visual map section
   */
  private generateVisualMapSection(
    report: ComponentReport,
    options: ExportOptions
  ): any[] | null {
    if (!report.visualMaps || report.visualMaps.length === 0) {
      return null;
    }

    return report.visualMaps.map(map => ({
      pageNumber: map.pageNumber,
      documentId: map.documentId,
      componentCount: map.components.length,
      dimensions: `${map.dimensions.width}x${map.dimensions.height}`,
      scale: map.scale,
      components: map.components.map(marker => ({
        id: marker.componentId,
        type: marker.type,
        label: marker.label,
        position: `(${marker.coordinates.x}, ${marker.coordinates.y})`
      }))
    }));
  }

  /**
   * Generate cross references section
   */
  private generateCrossReferencesSection(
    report: ComponentReport,
    options: ExportOptions
  ): any[] | null {
    if (!report.crossPageReferences || report.crossPageReferences.length === 0) {
      return null;
    }

    return report.crossPageReferences.map(ref => ({
      sourceComponent: ref.sourceComponentId,
      targetComponent: ref.targetComponentId,
      sourcePage: ref.sourcePageNumber,
      targetPage: ref.targetPageNumber,
      referenceType: ref.referenceType,
      confidence: options.includeConfidenceScores 
        ? `${(ref.confidence * 100).toFixed(1)}%`
        : undefined
    }));
  }

  /**
   * Generate footer section
   */
  private generateFooterSection(
    report: ComponentReport,
    options: ExportOptions
  ): Record<string, any> {
    return {
      generationTime: `${report.metadata.generationTime}ms`,
      exportVersion: report.metadata.exportVersion,
      notes: report.metadata.userNotes || '',
      disclaimer: 'This report was generated automatically and should be reviewed for accuracy.'
    };
  }

  /**
   * Format report type for display
   */
  private formatReportType(type: string): string {
    const typeMap: Record<string, string> = {
      'component_list': 'Component List Report',
      'parts_order': 'Parts Order Report',
      'technical_analysis': 'Technical Analysis Report',
      'project_summary': 'Project Summary Report'
    };
    return typeMap[type] || type;
  }

  /**
   * Format components by type for display
   */
  private formatComponentsByType(componentsByType: Record<string, number>): any[] {
    return Object.entries(componentsByType)
      .sort(([, a], [, b]) => b - a)
      .map(([type, count]) => ({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        count,
        percentage: 0 // Will be calculated if needed
      }));
  }

  /**
   * Format component specifications
   */
  private formatSpecifications(specs: any): string {
    const parts: string[] = [];
    
    if (specs.value) {
      parts.push(`${specs.value}${specs.unit || ''}`);
    }
    if (specs.tolerance) {
      parts.push(`±${specs.tolerance}`);
    }
    if (specs.rating) {
      parts.push(specs.rating);
    }
    if (specs.package) {
      parts.push(`Package: ${specs.package}`);
    }
    if (specs.manufacturer) {
      parts.push(`Mfr: ${specs.manufacturer}`);
    }

    return parts.join(', ') || 'N/A';
  }

  /**
   * Calculate additional statistics
   */
  private calculateStatistics(components: ComponentReportItem[]): Record<string, any> {
    const stats: Record<string, any> = {};

    // Count unique pages
    const uniquePages = new Set(components.map(c => c.location.pageNumber));
    stats.uniquePages = uniquePages.size;

    // Count components with part numbers
    const withPartNumbers = components.filter(c => c.partInformation?.partNumber).length;
    stats.componentsWithPartNumbers = withPartNumbers;

    // Count components with specifications
    const withSpecs = components.filter(c => 
      c.specifications && (c.specifications.value || c.specifications.rating)
    ).length;
    stats.componentsWithSpecifications = withSpecs;

    // Calculate average confidence
    if (components.length > 0) {
      const avgConfidence = components.reduce((sum, c) => sum + c.confidence, 0) / components.length;
      stats.averageConfidence = (avgConfidence * 100).toFixed(1) + '%';
    }

    return stats;
  }

  /**
   * Get report title
   */
  private getReportTitle(report: ComponentReport, template: ReportTemplate): string {
    const baseTitle = this.formatReportType(report.reportType);
    if (template.branding?.headerText) {
      return template.branding.headerText;
    }
    return baseTitle;
  }

  /**
   * Get report subtitle
   */
  private getReportSubtitle(report: ComponentReport, template: ReportTemplate): string {
    return `Session: ${report.sessionId.substring(0, 8)} | Generated: ${
      new Date(report.generatedAt).toLocaleDateString()
    }`;
  }

  /**
   * Generate unique filename for report
   */
  public generateFileName(
    reportType: string,
    format: string,
    sessionId: string
  ): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionPrefix = sessionId.substring(0, 8);
    return `${reportType}_${sessionPrefix}_${timestamp}.${format}`;
  }

  /**
   * Get full file path for report with security validation
   */
  public async getFilePath(fileName: string): Promise<string> {
    // Sanitize the filename first
    const safeFileName = this.sanitizeFileName(fileName);
    const filePath = path.join(this.exportDirectory, safeFileName);
    
    // Validate the final path is safe
    const resolvedPath = path.resolve(filePath);
    const resolvedExportDir = path.resolve(this.exportDirectory);
    
    if (!resolvedPath.startsWith(resolvedExportDir)) {
      throw new Error('File path outside export directory boundary');
    }
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    return filePath;
  }

  /**
   * Sanitize filename to prevent directory traversal and injection
   */
  private sanitizeFileName(fileName: string): string {
    // Remove any path separators and dangerous characters
    const sanitized = fileName
      .replace(/[\/\\:*?"<>|\x00-\x1f]/g, '_')
      .replace(/\.\.+/g, '_')
      .replace(/^\./g, '_')
      .substring(0, 255);
    
    // Ensure it's not empty
    return sanitized || 'export_file';
  }

  /**
   * Validate report data before generation
   */
  public validateReportData(report: ComponentReport): boolean {
    if (!report.id || !report.sessionId) {
      return false;
    }

    if (!report.components || report.components.length === 0) {
      console.warn('Report has no components');
    }

    if (!report.componentSummary) {
      return false;
    }

    return true;
  }

  /**
   * Format data for specific export format
   */
  public formatForExport(
    data: any,
    format: 'pdf' | 'csv' | 'excel' | 'json'
  ): any {
    switch (format) {
      case 'csv':
        return this.flattenForCsv(data);
      
      case 'excel':
        return this.structureForExcel(data);
      
      case 'json':
        return JSON.stringify(data, null, 2);
      
      case 'pdf':
      default:
        return data;
    }
  }

  /**
   * Flatten data structure for CSV export
   */
  private flattenForCsv(data: any): any[] {
    if (Array.isArray(data)) {
      return data.map(item => this.flattenObject(item));
    }
    return [this.flattenObject(data)];
  }

  /**
   * Flatten nested object
   */
  private flattenObject(obj: any, prefix = ''): Record<string, any> {
    const flattened: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}_${key}` : key;
      
      if (value === null || value === undefined) {
        flattened[newKey] = '';
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        flattened[newKey] = value.join(', ');
      } else {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }

  /**
   * Structure data for Excel export
   */
  private structureForExcel(data: any): any {
    return {
      sheets: [
        {
          name: 'Components',
          data: data.components || []
        },
        {
          name: 'Summary',
          data: [data.summary] || []
        },
        {
          name: 'Cross References',
          data: data.crossReferences || []
        }
      ]
    };
  }
}