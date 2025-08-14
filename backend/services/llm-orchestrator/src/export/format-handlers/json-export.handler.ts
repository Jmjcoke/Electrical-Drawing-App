/**
 * JSON Export Handler
 * Generates JSON format exports for component reports
 * Implements Story 4.5 JSON export functionality
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  ComponentReport, 
  ComponentReportItem,
  ExportOptions,
  ReportTemplate 
} from '../../../../shared/types/nlp.types';

export class JsonExportHandler {
  private exportDirectory: string;

  constructor() {
    this.exportDirectory = process.env.EXPORT_DIR || '/tmp/electrical-exports';
  }

  /**
   * Generate JSON report file
   */
  async generateReport(
    report: ComponentReport,
    template: ReportTemplate | null,
    options: ExportOptions
  ): Promise<string> {
    const fileName = `component_report_${report.id}_${Date.now()}.json`;
    const filePath = path.join(this.exportDirectory, fileName);

    // Ensure export directory exists
    await fs.mkdir(this.exportDirectory, { recursive: true });

    // Process report based on options
    const processedReport = this.processReport(report, options);

    // Apply template structure if provided
    if (template) {
      const structuredReport = this.applyTemplateStructure(processedReport, template);
      await fs.writeFile(filePath, JSON.stringify(structuredReport, null, 2));
    } else {
      await fs.writeFile(filePath, JSON.stringify(processedReport, null, 2));
    }

    return filePath;
  }

  /**
   * Process report based on export options
   */
  private processReport(report: ComponentReport, options: ExportOptions): any {
    const processedReport: any = {
      id: report.id,
      reportType: report.reportType,
      sessionId: report.sessionId,
      generatedAt: report.generatedAt,
      format: report.format,
      metadata: {
        ...report.metadata,
        exportOptions: options
      }
    };

    // Add summary
    processedReport.summary = {
      ...report.componentSummary,
      exportDate: new Date().toISOString()
    };

    // Process components based on options
    processedReport.components = this.processComponents(report.components, options);

    // Add cross-page references if available
    if (report.crossPageReferences) {
      processedReport.crossPageReferences = report.crossPageReferences;
    }

    // Add visual maps if available
    if (report.visualMaps) {
      processedReport.visualMaps = this.processVisualMaps(report.visualMaps, options);
    }

    // Add branding information if configured
    if (options.customBranding) {
      processedReport.branding = options.customBranding;
    }

    return processedReport;
  }

  /**
   * Process components based on export options
   */
  private processComponents(
    components: ComponentReportItem[],
    options: ExportOptions
  ): any[] {
    return components.map(component => {
      const processedComponent: any = {
        id: component.id,
        type: component.type,
        description: component.description
      };

      // Always include location
      processedComponent.location = {
        pageNumber: component.location.pageNumber,
        documentId: component.location.documentId,
        coordinates: component.location.coordinates,
        zone: component.location.zone
      };

      // Include technical specifications if requested
      if (options.includeTechnicalSpecs && component.specifications) {
        processedComponent.specifications = {
          value: component.specifications.value,
          unit: component.specifications.unit,
          tolerance: component.specifications.tolerance,
          rating: component.specifications.rating,
          package: component.specifications.package,
          manufacturer: component.specifications.manufacturer
        };

        // Include custom properties if they exist
        if (component.specifications.customProperties) {
          processedComponent.specifications.customProperties = 
            component.specifications.customProperties;
        }
      }

      // Include part information if requested
      if (options.includePartNumbers && component.partInformation) {
        processedComponent.partInformation = component.partInformation;
      }

      // Include confidence score if requested
      if (options.includeConfidenceScores) {
        processedComponent.confidence = component.confidence;
      }

      // Include page references
      if (component.pageReferences && component.pageReferences.length > 0) {
        processedComponent.pageReferences = component.pageReferences;
      }

      // Include related components
      if (component.relatedComponents && component.relatedComponents.length > 0) {
        processedComponent.relatedComponents = component.relatedComponents;
      }

      return processedComponent;
    });
  }

  /**
   * Process visual maps based on options
   */
  private processVisualMaps(visualMaps: any[], options: ExportOptions): any[] {
    return visualMaps.map(map => ({
      pageNumber: map.pageNumber,
      documentId: map.documentId,
      dimensions: map.dimensions,
      scale: map.scale,
      componentCount: map.components.length,
      components: map.components.map((marker: any) => ({
        componentId: marker.componentId,
        type: marker.type,
        label: marker.label,
        coordinates: marker.coordinates,
        color: marker.color,
        shape: marker.shape
      })),
      // Optionally include base64 image if not too large
      imageBase64: map.imageBase64?.length < 1000000 ? map.imageBase64 : undefined,
      imageAvailable: !!map.imageBase64
    }));
  }

  /**
   * Apply template structure to report
   */
  private applyTemplateStructure(report: any, template: ReportTemplate): any {
    const structuredReport: any = {
      reportMetadata: {
        templateId: template.id,
        templateName: template.name,
        templateType: template.templateType,
        ...report.metadata
      }
    };

    // Parse sections configuration
    const sections = typeof template.sections_config === 'string' 
      ? JSON.parse(template.sections_config) 
      : template.sections_config;

    // Build report structure based on template sections
    for (const section of sections) {
      if (!section.enabled) continue;

      switch (section.type) {
        case 'header':
          structuredReport.header = {
            title: template.name,
            description: template.description,
            generatedAt: report.generatedAt,
            sessionId: report.sessionId
          };
          break;

        case 'summary':
          structuredReport.summary = report.summary;
          break;

        case 'component_list':
          structuredReport.components = report.components;
          break;

        case 'cross_references':
          if (report.crossPageReferences) {
            structuredReport.crossPageReferences = report.crossPageReferences;
          }
          break;

        case 'visual_map':
          if (report.visualMaps) {
            structuredReport.visualMaps = report.visualMaps;
          }
          break;

        case 'parts_list':
          if (section.config?.includePartNumbers) {
            structuredReport.partsOrder = this.generatePartsOrder(report.components);
          }
          break;

        default:
          // Custom section
          if (section.id && report[section.id]) {
            structuredReport[section.id] = report[section.id];
          }
      }
    }

    // Add branding if configured
    const brandingConfig = typeof template.branding_config === 'string'
      ? JSON.parse(template.branding_config)
      : template.branding_config;

    if (brandingConfig) {
      structuredReport.branding = brandingConfig;
    }

    return structuredReport;
  }

  /**
   * Generate parts order from components
   */
  private generatePartsOrder(components: any[]): any {
    const partsMap = new Map<string, any>();

    for (const component of components) {
      if (component.partInformation?.partNumber) {
        const partNumber = component.partInformation.partNumber;
        
        if (partsMap.has(partNumber)) {
          const part = partsMap.get(partNumber);
          part.quantity += component.partInformation.quantity || 1;
          part.componentReferences.push(component.id);
          part.totalPrice = part.quantity * part.unitPrice;
        } else {
          partsMap.set(partNumber, {
            partNumber,
            description: component.description,
            manufacturer: component.partInformation.manufacturer || '',
            supplier: component.partInformation.supplier || '',
            quantity: component.partInformation.quantity || 1,
            unitPrice: component.partInformation.unitPrice || 0,
            totalPrice: (component.partInformation.quantity || 1) * 
                       (component.partInformation.unitPrice || 0),
            componentReferences: [component.id]
          });
        }
      }
    }

    const partsList = Array.from(partsMap.values());
    const totalCost = partsList.reduce((sum, part) => sum + part.totalPrice, 0);

    return {
      parts: partsList,
      totalParts: partsList.length,
      totalQuantity: partsList.reduce((sum, part) => sum + part.quantity, 0),
      totalCost,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Generate minimal JSON for API responses
   */
  async generateMinimalJson(
    components: ComponentReportItem[],
    sessionId: string
  ): Promise<string> {
    const fileName = `component_minimal_${sessionId}_${Date.now()}.json`;
    const filePath = path.join(this.exportDirectory, fileName);

    await fs.mkdir(this.exportDirectory, { recursive: true });

    const minimalData = {
      sessionId,
      componentCount: components.length,
      components: components.map(c => ({
        id: c.id,
        type: c.type,
        description: c.description,
        page: c.location.pageNumber,
        confidence: c.confidence
      })),
      exportDate: new Date().toISOString()
    };

    await fs.writeFile(filePath, JSON.stringify(minimalData, null, 2));

    return filePath;
  }

  /**
   * Generate schema-compliant JSON for integration
   */
  async generateSchemaCompliantJson(
    report: ComponentReport,
    schemaVersion: string = '1.0.0'
  ): Promise<string> {
    const fileName = `component_schema_${report.id}_${Date.now()}.json`;
    const filePath = path.join(this.exportDirectory, fileName);

    await fs.mkdir(this.exportDirectory, { recursive: true });

    const schemaCompliantData = {
      $schema: `https://electrical-analysis.com/schemas/component-report/v${schemaVersion}`,
      version: schemaVersion,
      report: {
        id: report.id,
        type: report.reportType,
        sessionId: report.sessionId,
        generatedAt: report.generatedAt.toISOString(),
        format: report.format
      },
      summary: report.componentSummary,
      components: report.components.map(c => this.toSchemaCompliantComponent(c)),
      crossReferences: report.crossPageReferences || [],
      visualMaps: report.visualMaps || [],
      metadata: report.metadata
    };

    await fs.writeFile(filePath, JSON.stringify(schemaCompliantData, null, 2));

    return filePath;
  }

  /**
   * Convert component to schema-compliant format
   */
  private toSchemaCompliantComponent(component: ComponentReportItem): any {
    return {
      id: component.id,
      type: component.type,
      description: component.description,
      location: {
        pageNumber: component.location.pageNumber,
        documentId: component.location.documentId,
        boundingBox: {
          x: component.location.coordinates.x,
          y: component.location.coordinates.y,
          width: component.location.coordinates.width,
          height: component.location.coordinates.height
        },
        zone: component.location.zone
      },
      specifications: component.specifications ? {
        electrical: {
          value: component.specifications.value,
          unit: component.specifications.unit,
          tolerance: component.specifications.tolerance,
          rating: component.specifications.rating
        },
        physical: {
          package: component.specifications.package
        },
        supplier: {
          manufacturer: component.specifications.manufacturer,
          partNumber: component.partInformation?.partNumber,
          supplier: component.partInformation?.supplier
        }
      } : undefined,
      relationships: {
        pageReferences: component.pageReferences || [],
        relatedComponents: component.relatedComponents || []
      },
      quality: {
        confidence: component.confidence
      }
    };
  }
}