/**
 * CSV Export Handler
 * Generates CSV format exports for component reports
 * Implements Story 4.5 CSV export functionality
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { v4 as uuidv4 } from 'uuid';
import { 
  ComponentReport, 
  ComponentReportItem,
  ExportOptions,
  ReportTemplate 
} from '../../../../shared/types/nlp.types';

export class CsvExportHandler {
  private exportDirectory: string;

  constructor() {
    this.exportDirectory = process.env.EXPORT_DIR || '/tmp/electrical-exports';
  }

  /**
   * Generate CSV report file
   */
  async generateReport(
    report: ComponentReport,
    template: ReportTemplate | null,
    options: ExportOptions
  ): Promise<string> {
    const fileName = `component_report_${report.id}_${Date.now()}.csv`;
    const filePath = path.join(this.exportDirectory, fileName);

    // Ensure export directory exists
    await fs.mkdir(this.exportDirectory, { recursive: true });

    // Prepare CSV headers based on options
    const headers = this.buildCsvHeaders(options);

    // Create CSV writer
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: headers
    });

    // Transform components to CSV records
    const records = this.transformComponentsToRecords(report.components, options);

    // Write CSV file
    await csvWriter.writeRecords(records);

    // Add summary section if requested
    if (template?.sections_config) {
      const sections = JSON.parse(JSON.stringify(template.sections_config));
      const hasSummary = sections.some((s: any) => s.type === 'summary' && s.enabled);
      
      if (hasSummary) {
        await this.appendSummary(filePath, report);
      }
    }

    return filePath;
  }

  /**
   * Build CSV headers based on export options
   */
  private buildCsvHeaders(options: ExportOptions): any[] {
    const headers = [
      { id: 'id', title: 'Component ID' },
      { id: 'type', title: 'Type' },
      { id: 'description', title: 'Description' },
      { id: 'page', title: 'Page' },
      { id: 'document', title: 'Document' },
      { id: 'zone', title: 'Zone' },
      { id: 'x', title: 'X Position' },
      { id: 'y', title: 'Y Position' }
    ];

    if (options.includeTechnicalSpecs) {
      headers.push(
        { id: 'value', title: 'Value' },
        { id: 'unit', title: 'Unit' },
        { id: 'tolerance', title: 'Tolerance' },
        { id: 'rating', title: 'Rating' },
        { id: 'package', title: 'Package' }
      );
    }

    if (options.includePartNumbers) {
      headers.push(
        { id: 'partNumber', title: 'Part Number' },
        { id: 'manufacturer', title: 'Manufacturer' },
        { id: 'supplier', title: 'Supplier' },
        { id: 'quantity', title: 'Quantity' },
        { id: 'unitPrice', title: 'Unit Price' }
      );
    }

    if (options.includeConfidenceScores) {
      headers.push({ id: 'confidence', title: 'Confidence Score' });
    }

    headers.push(
      { id: 'relatedComponents', title: 'Related Components' },
      { id: 'notes', title: 'Notes' }
    );

    return headers;
  }

  /**
   * Transform components to CSV records
   */
  private transformComponentsToRecords(
    components: ComponentReportItem[],
    options: ExportOptions
  ): any[] {
    return components.map(component => {
      const record: any = {
        id: component.id,
        type: component.type,
        description: component.description || '',
        page: component.location.pageNumber,
        document: component.location.documentId,
        zone: component.location.zone || '',
        x: component.location.coordinates.x,
        y: component.location.coordinates.y
      };

      if (options.includeTechnicalSpecs && component.specifications) {
        record.value = component.specifications.value || '';
        record.unit = component.specifications.unit || '';
        record.tolerance = component.specifications.tolerance || '';
        record.rating = component.specifications.rating || '';
        record.package = component.specifications.package || '';
      }

      if (options.includePartNumbers && component.partInformation) {
        record.partNumber = component.partInformation.partNumber || '';
        record.manufacturer = component.partInformation.manufacturer || '';
        record.supplier = component.partInformation.supplier || '';
        record.quantity = component.partInformation.quantity || 1;
        record.unitPrice = component.partInformation.unitPrice || '';
      }

      if (options.includeConfidenceScores) {
        record.confidence = component.confidence.toFixed(2);
      }

      record.relatedComponents = component.relatedComponents?.join(', ') || '';
      record.notes = component.specifications?.customProperties?.notes || '';

      return record;
    });
  }

  /**
   * Append summary section to CSV file
   */
  private async appendSummary(filePath: string, report: ComponentReport): Promise<void> {
    const summaryContent = [
      '',
      '--- SUMMARY ---',
      `Total Components: ${report.componentSummary.totalComponents}`,
      `Total Pages: ${report.componentSummary.totalPages}`,
      `Average Confidence: ${report.componentSummary.confidenceAverage.toFixed(2)}`,
      `Processing Time: ${report.componentSummary.processingTime}ms`,
      '',
      'Component Breakdown by Type:'
    ];

    for (const [type, count] of Object.entries(report.componentSummary.componentsByType)) {
      summaryContent.push(`  ${type}: ${count}`);
    }

    summaryContent.push('');
    summaryContent.push(`Report Generated: ${report.generatedAt.toISOString()}`);
    summaryContent.push(`Session ID: ${report.sessionId}`);

    const summaryText = summaryContent.join('\n');
    await fs.appendFile(filePath, '\n' + summaryText);
  }

  /**
   * Generate parts order CSV specifically for BOM
   */
  async generatePartsOrderCsv(
    components: ComponentReportItem[],
    sessionId: string
  ): Promise<string> {
    const fileName = `parts_order_${sessionId}_${Date.now()}.csv`;
    const filePath = path.join(this.exportDirectory, fileName);

    await fs.mkdir(this.exportDirectory, { recursive: true });

    // Group components by part number for BOM
    const partsMap = new Map<string, {
      partNumber: string;
      description: string;
      manufacturer: string;
      supplier: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      components: string[];
    }>();

    for (const component of components) {
      if (component.partInformation?.partNumber) {
        const partNumber = component.partInformation.partNumber;
        
        if (partsMap.has(partNumber)) {
          const part = partsMap.get(partNumber)!;
          part.quantity += component.partInformation.quantity || 1;
          part.components.push(component.id);
          part.totalPrice = part.quantity * part.unitPrice;
        } else {
          partsMap.set(partNumber, {
            partNumber,
            description: component.description,
            manufacturer: component.partInformation.manufacturer || '',
            supplier: component.partInformation.supplier || '',
            quantity: component.partInformation.quantity || 1,
            unitPrice: component.partInformation.unitPrice || 0,
            totalPrice: (component.partInformation.quantity || 1) * (component.partInformation.unitPrice || 0),
            components: [component.id]
          });
        }
      }
    }

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'partNumber', title: 'Part Number' },
        { id: 'description', title: 'Description' },
        { id: 'manufacturer', title: 'Manufacturer' },
        { id: 'supplier', title: 'Supplier' },
        { id: 'quantity', title: 'Quantity' },
        { id: 'unitPrice', title: 'Unit Price' },
        { id: 'totalPrice', title: 'Total Price' },
        { id: 'componentRefs', title: 'Component References' }
      ]
    });

    const records = Array.from(partsMap.values()).map(part => ({
      ...part,
      componentRefs: part.components.join(', ')
    }));

    await csvWriter.writeRecords(records);

    return filePath;
  }
}