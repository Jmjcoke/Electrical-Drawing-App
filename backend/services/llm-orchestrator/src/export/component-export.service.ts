/**
 * Component Export Service
 * Core service for aggregating and exporting component data across sessions
 * Implements Story 4.5 requirements for comprehensive export capabilities
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ComponentExportRequest,
  ComponentReport,
  ComponentReportItem,
  ComponentSummary,
  ExportFormat,
  ReportMetadata,
  ComponentLocationMap,
  ExportOptions,
  ComponentSortOption
} from '../../../../shared/types/nlp.types';
import { CrossPageReference } from '../../../../shared/types/cross-page-reference.types';
import { ComponentRepository } from '../repositories/component.repository';
import { SymbolDetectionRepository } from '../repositories/symbol-detection.repository';
import { CrossPageReferenceRepository } from '../repositories/cross-page-reference.repository';
import { ExportRepository } from '../repositories/export.repository';
import { ReportGeneratorService } from './report-generator.service';
import { TemplateService } from './template.service';
import { PdfExportHandler } from './format-handlers/pdf-export.handler';
import { CsvExportHandler } from './format-handlers/csv-export.handler';
import { ExcelExportHandler } from './format-handlers/excel-export.handler';
import { JsonExportHandler } from './format-handlers/json-export.handler';
import { ExportErrorRecoveryService } from '../services/export-error-recovery.service';
import { StreamExportService } from '../services/stream-export.service';
import { ExportMonitoringService } from '../services/export-monitoring.service';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

export interface ExportResult {
  success: boolean;
  reportId?: string;
  filePath?: string;
  fileSize?: number;
  error?: string;
  generationTime?: number;
  fallbackUsed?: boolean;
}

export class ComponentExportService {
  private formatHandlers: Map<ExportFormat, any>;
  private exportDirectory: string;
  private errorRecoveryService: ExportErrorRecoveryService;
  private streamExportService: StreamExportService;
  private monitoringService: ExportMonitoringService;

  constructor(
    private componentRepository: ComponentRepository,
    private symbolDetectionRepository: SymbolDetectionRepository,
    private crossPageReferenceRepository: CrossPageReferenceRepository,
    private exportRepository: ExportRepository,
    private reportGeneratorService: ReportGeneratorService,
    private templateService: TemplateService
  ) {
    this.initializeFormatHandlers();
    this.exportDirectory = process.env.EXPORT_DIR || '/tmp/electrical-exports';
    this.errorRecoveryService = new ExportErrorRecoveryService();
    this.streamExportService = new StreamExportService();
    this.monitoringService = new ExportMonitoringService();
    this.initializeService();
  }

  /**
   * Initialize service with error recovery
   */
  private async initializeService(): Promise<void> {
    try {
      this.exportDirectory = await this.errorRecoveryService.ensureExportDirectory(this.exportDirectory);
      console.log(`Export service initialized with directory: ${this.exportDirectory}`);
    } catch (error) {
      console.error('Failed to initialize export service:', error);
      throw new Error(`Export service initialization failed: ${error.message}`);
    }
  }

  private initializeFormatHandlers(): void {
    this.formatHandlers = new Map([
      ['pdf', new PdfExportHandler()],
      ['csv', new CsvExportHandler()],
      ['excel', new ExcelExportHandler()],
      ['json', new JsonExportHandler()]
    ]);
  }

  private async ensureExportDirectory(): Promise<void> {
    try {
      // Validate export directory is not above project root
      const sanitizedPath = this.sanitizeDirectoryPath(this.exportDirectory);
      if (!sanitizedPath) {
        throw new Error('Invalid export directory path');
      }
      
      // Use error recovery service for robust directory creation
      this.exportDirectory = await this.errorRecoveryService.ensureExportDirectory(sanitizedPath);
    } catch (error) {
      console.error('Failed to create export directory:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Export directory creation failed: ${errorMessage}`);
    }
  }

  /**
   * Sanitize directory path to prevent path traversal attacks
   */
  private sanitizeDirectoryPath(dirPath: string): string | null {
    try {
      // Resolve the path to get absolute path and normalize
      const resolvedPath = path.resolve(dirPath);
      
      // Check if the resolved path is within allowed bounds
      const allowedRoots = [
        process.env.EXPORT_DIR || '/tmp/electrical-exports',
        '/tmp',
        '/var/tmp'
      ];
      
      const isAllowed = allowedRoots.some(root => {
        const resolvedRoot = path.resolve(root);
        return resolvedPath.startsWith(resolvedRoot);
      });
      
      if (!isAllowed) {
        console.error('Directory path outside allowed boundaries:', resolvedPath);
        return null;
      }
      
      return resolvedPath;
    } catch (error) {
      console.error('Path sanitization error:', error);
      return null;
    }
  }

  /**
   * Generate secure filename to prevent directory traversal
   */
  private generateSecureFileName(reportType: string, format: string, sessionId: string): string {
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(8).toString('hex');
    const safeSessionId = sessionId.replace(/[^a-zA-Z0-9-]/g, '').substring(0, 8);
    const safeReportType = reportType.replace(/[^a-zA-Z0-9_]/g, '');
    const safeFormat = format.replace(/[^a-zA-Z0-9]/g, '');
    
    return `${safeReportType}_${safeSessionId}_${timestamp}_${randomSuffix}.${safeFormat}`;
  }

  /**
   * Generate and export component report with error recovery
   */
  public async exportComponents(request: ComponentExportRequest): Promise<ExportResult> {
    const startTime = Date.now();
    
    // Check system resources before starting
    const resources = await this.errorRecoveryService.checkSystemResources();
    if (!resources.healthy) {
      console.warn('System resources are low, proceeding with caution');
    }

    // Record export start for monitoring
    this.monitoringService.recordExportStart(
      request.sessionId,
      request.exportFormat,
      0 // Will be updated after component aggregation
    );

    const result = await this.errorRecoveryService.executeWithRecovery(
      async () => {
        // Step 1: Aggregate component data from all sources
        const componentData = await this.aggregateComponentData(
          request.sessionId,
          request.documentIds
        );

        // Step 2: Apply sorting and filtering based on export options
        const processedComponents = this.processComponents(
          componentData,
          request.customOptions
        );

        // Check if we should use streaming for large datasets
        const shouldStream = this.streamExportService.shouldUseStreaming(
          processedComponents.length,
          request.exportFormat
        );

        if (shouldStream) {
          console.log(`Using streaming export for ${processedComponents.length} components`);
          return await this.handleStreamingExport(request, processedComponents);
        }

        // Step 3: Generate cross-page references if requested
        let crossPageReferences: CrossPageReference[] | undefined;
        if (request.includeReferences) {
          crossPageReferences = await this.getCrossPageReferences(
            request.sessionId,
            request.documentIds
          );
        }

        // Step 4: Generate visual location maps if requested
        let visualMaps: ComponentLocationMap[] | undefined;
        if (request.includeVisualMap) {
          visualMaps = await this.generateVisualMaps(
            processedComponents,
            request.sessionId
          );
        }

        // Step 5: Create component report structure
        const report = await this.createComponentReport(
          request,
          processedComponents,
          crossPageReferences,
          visualMaps,
          startTime
        );

        // Step 6: Get template configuration
        const template = request.templateId
          ? await this.templateService.getTemplate(request.templateId)
          : await this.templateService.getDefaultTemplate(report.reportType);

        // Step 7: Generate report file using appropriate format handler
        const handler = this.formatHandlers.get(request.exportFormat);
        if (!handler) {
          throw new Error(`Unsupported export format: ${request.exportFormat}`);
        }

        // Generate secure file path
        const secureFileName = this.generateSecureFileName(
          report.reportType,
          request.exportFormat,
          request.sessionId
        );
        const secureFilePath = path.join(this.exportDirectory, secureFileName);
        
        // Validate the generated path is safe
        if (!this.isFilePathSafe(secureFilePath)) {
          throw new Error('Generated file path is not secure');
        }

        const filePath = await handler.generateReport(
          report,
          template,
          request.customOptions,
          secureFilePath
        );

        // Step 8: Get file size
        const stats = await fs.stat(filePath);
        const fileSize = stats.size;

        // Step 9: Save report metadata to database
        const reportRecord = await this.exportRepository.saveReport({
          id: report.id,
          sessionId: request.sessionId,
          reportType: report.reportType,
          exportFormat: request.exportFormat,
          templateId: request.templateId,
          filePath,
          fileSize,
          componentCount: processedComponents.length,
          generationTimeMs: Date.now() - startTime,
          metadata: report.metadata
        });

        const finalResult = {
          success: true,
          reportId: reportRecord.id,
          filePath,
          fileSize,
          generationTime: Date.now() - startTime
        };

        // Record successful export
        this.monitoringService.recordExportSuccess(
          request.sessionId,
          request.exportFormat,
          processedComponents.length,
          finalResult.generationTime,
          fileSize
        );

        return finalResult;
      },
      {
        operation: 'exportComponents',
        request: request
      },
      {
        maxRetries: 2,
        retryDelayMs: 2000,
        enableFallbacks: true
      }
    );

    if (result.success) {
      return result.result!;
    } else {
      console.error('Export failed after all recovery attempts:', result.error);
      
      // Record export failure for monitoring
      this.monitoringService.recordExportFailure(
        request.sessionId,
        request.exportFormat,
        result.error?.message || 'Export failed after all recovery attempts',
        0, // Component count unknown at this point
        result.totalTime
      );
      
      return {
        success: false,
        error: result.error?.message || 'Export failed after all recovery attempts',
        generationTime: result.totalTime,
        fallbackUsed: result.fallbackUsed
      };
    }
  }

  /**
   * Aggregate component data from multiple sources
   */
  private async aggregateComponentData(
    sessionId: string,
    documentIds?: string[]
  ): Promise<ComponentReportItem[]> {
    const components: ComponentReportItem[] = [];

    // Get detected symbols from symbol detection table
    const detectedSymbols = await this.symbolDetectionRepository.getSymbolsBySession(
      sessionId,
      documentIds
    );

    // Get component identifications with specifications
    const componentIdentifications = await this.componentRepository.getComponentsBySession(
      sessionId,
      documentIds
    );

    // Merge data from both sources
    for (const symbol of detectedSymbols) {
      const identification = componentIdentifications.find(
        comp => comp.symbolId === symbol.id
      );

      const componentItem: ComponentReportItem = {
        id: symbol.id,
        type: symbol.type,
        description: identification?.description || symbol.label || '',
        specifications: {
          value: identification?.specifications?.value,
          unit: identification?.specifications?.unit,
          tolerance: identification?.specifications?.tolerance,
          rating: identification?.specifications?.rating,
          package: identification?.specifications?.package,
          manufacturer: identification?.specifications?.manufacturer,
          customProperties: identification?.specifications?.customProperties
        },
        location: {
          pageNumber: symbol.pageNumber,
          documentId: symbol.documentId,
          coordinates: {
            x: symbol.boundingBox.x,
            y: symbol.boundingBox.y,
            width: symbol.boundingBox.width,
            height: symbol.boundingBox.height
          },
          zone: symbol.zone
        },
        pageReferences: [{
          pageNumber: symbol.pageNumber,
          documentId: symbol.documentId,
          referenceType: 'origin'
        }],
        partInformation: identification?.partInformation,
        confidence: symbol.confidence,
        relatedComponents: identification?.relatedComponents
      };

      components.push(componentItem);
    }

    return components;
  }

  /**
   * Process components based on export options
   */
  private processComponents(
    components: ComponentReportItem[],
    options: ExportOptions
  ): ComponentReportItem[] {
    let processed = [...components];

    // Apply filtering based on options
    if (!options.includeConfidenceScores) {
      // Keep components but remove confidence from display
      processed = processed.map(comp => ({
        ...comp,
        confidence: 0 // Will be hidden in export
      }));
    }

    // Apply sorting
    processed = this.sortComponents(processed, options.sortBy);

    // Group by page if requested
    if (options.groupByPage) {
      processed = this.groupComponentsByPage(processed);
    }

    return processed;
  }

  /**
   * Sort components based on sort option
   */
  private sortComponents(
    components: ComponentReportItem[],
    sortBy: ComponentSortOption
  ): ComponentReportItem[] {
    const sorted = [...components];

    switch (sortBy) {
      case 'type':
        return sorted.sort((a, b) => a.type.localeCompare(b.type));
      
      case 'page':
        return sorted.sort((a, b) => {
          const pageCompare = a.location.pageNumber - b.location.pageNumber;
          if (pageCompare !== 0) return pageCompare;
          return a.location.coordinates.y - b.location.coordinates.y;
        });
      
      case 'confidence':
        return sorted.sort((a, b) => b.confidence - a.confidence);
      
      case 'alphabetical':
        return sorted.sort((a, b) => a.description.localeCompare(b.description));
      
      default:
        return sorted;
    }
  }

  /**
   * Group components by page number
   */
  private groupComponentsByPage(
    components: ComponentReportItem[]
  ): ComponentReportItem[] {
    const grouped = new Map<number, ComponentReportItem[]>();

    for (const component of components) {
      const page = component.location.pageNumber;
      if (!grouped.has(page)) {
        grouped.set(page, []);
      }
      grouped.get(page)!.push(component);
    }

    // Sort within each page group by Y coordinate
    const result: ComponentReportItem[] = [];
    const sortedPages = Array.from(grouped.keys()).sort((a, b) => a - b);

    for (const page of sortedPages) {
      const pageComponents = grouped.get(page)!;
      pageComponents.sort((a, b) => 
        a.location.coordinates.y - b.location.coordinates.y
      );
      result.push(...pageComponents);
    }

    return result;
  }

  /**
   * Get cross-page references for components
   */
  private async getCrossPageReferences(
    sessionId: string,
    documentIds?: string[]
  ): Promise<CrossPageReference[]> {
    return await this.crossPageReferenceRepository.getReferencesBySession(
      sessionId,
      documentIds
    );
  }

  /**
   * Generate visual location maps for components
   */
  private async generateVisualMaps(
    components: ComponentReportItem[],
    sessionId: string
  ): Promise<ComponentLocationMap[]> {
    const maps: ComponentLocationMap[] = [];
    const componentsByPage = new Map<string, ComponentReportItem[]>();

    // Group components by document and page
    for (const component of components) {
      const key = `${component.location.documentId}_${component.location.pageNumber}`;
      if (!componentsByPage.has(key)) {
        componentsByPage.set(key, []);
      }
      componentsByPage.get(key)!.push(component);
    }

    // Generate map for each page
    for (const [key, pageComponents] of componentsByPage) {
      const [documentId, pageNumber] = key.split('_');
      
      // Generate visual map (placeholder - actual implementation would use image processing)
      const visualMap: ComponentLocationMap = {
        pageNumber: parseInt(pageNumber),
        documentId,
        imageBase64: '', // Would be generated from actual drawing image
        components: pageComponents.map(comp => ({
          componentId: comp.id,
          type: comp.type,
          label: comp.description || comp.type,
          coordinates: {
            x: comp.location.coordinates.x,
            y: comp.location.coordinates.y
          },
          color: this.getComponentColor(comp.type),
          shape: this.getComponentShape(comp.type)
        })),
        scale: 1.0,
        dimensions: {
          width: 1920,  // Would be actual page dimensions
          height: 1080
        }
      };

      maps.push(visualMap);
    }

    return maps;
  }

  /**
   * Get color for component type
   */
  private getComponentColor(type: string): string {
    const colorMap: Record<string, string> = {
      'resistor': '#8B4513',
      'capacitor': '#4169E1',
      'inductor': '#32CD32',
      'diode': '#FF6347',
      'transistor': '#9370DB',
      'ic': '#FFD700',
      'connector': '#808080',
      'switch': '#20B2AA',
      'transformer': '#FF8C00',
      'fuse': '#DC143C'
    };

    return colorMap[type.toLowerCase()] || '#000000';
  }

  /**
   * Get shape for component type
   */
  private getComponentShape(type: string): 'circle' | 'square' | 'triangle' {
    const shapeMap: Record<string, 'circle' | 'square' | 'triangle'> = {
      'resistor': 'square',
      'capacitor': 'square',
      'inductor': 'square',
      'diode': 'triangle',
      'transistor': 'triangle',
      'ic': 'square',
      'connector': 'circle',
      'switch': 'square',
      'transformer': 'square',
      'fuse': 'square'
    };

    return shapeMap[type.toLowerCase()] || 'circle';
  }

  /**
   * Create component report structure
   */
  private async createComponentReport(
    request: ComponentExportRequest,
    components: ComponentReportItem[],
    crossPageReferences?: CrossPageReference[],
    visualMaps?: ComponentLocationMap[],
    startTime?: number
  ): Promise<ComponentReport> {
    // Calculate component summary
    const componentsByType: Record<string, number> = {};
    let totalConfidence = 0;
    const uniquePages = new Set<number>();
    const uniqueDocuments = new Set<string>();

    for (const component of components) {
      componentsByType[component.type] = (componentsByType[component.type] || 0) + 1;
      totalConfidence += component.confidence;
      uniquePages.add(component.location.pageNumber);
      uniqueDocuments.add(component.location.documentId);
    }

    const summary: ComponentSummary = {
      totalComponents: components.length,
      componentsByType,
      totalPages: uniquePages.size,
      confidenceAverage: components.length > 0 ? totalConfidence / components.length : 0,
      processingTime: startTime ? Date.now() - startTime : 0
    };

    // Create report metadata
    const metadata: ReportMetadata = {
      generationTime: startTime ? Date.now() - startTime : 0,
      documentCount: uniqueDocuments.size,
      pageCount: uniquePages.size,
      templateUsed: request.templateId,
      exportVersion: '1.0.0',
      userNotes: request.customOptions.customBranding?.footerText
    };

    // Determine report type based on export options
    let reportType: 'component_list' | 'parts_order' | 'technical_analysis' | 'project_summary' = 'component_list';
    
    if (request.customOptions.includePartNumbers) {
      reportType = 'parts_order';
    } else if (request.includeReferences && request.includeVisualMap) {
      reportType = 'technical_analysis';
    } else if (visualMaps && visualMaps.length > 0) {
      reportType = 'project_summary';
    }

    return {
      id: uuidv4(),
      reportType,
      sessionId: request.sessionId,
      generatedAt: new Date(),
      format: request.exportFormat,
      componentSummary: summary,
      components,
      crossPageReferences,
      visualMaps,
      metadata
    };
  }

  /**
   * Get report by ID
   */
  public async getReport(reportId: string): Promise<ComponentReport | null> {
    const reportRecord = await this.exportRepository.getReport(reportId);
    if (!reportRecord) {
      return null;
    }

    // Load report data from file if JSON format
    if (reportRecord.exportFormat === 'json' && reportRecord.filePath) {
      try {
        const content = await fs.readFile(reportRecord.filePath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.error('Failed to load report file:', error);
        return null;
      }
    }

    // For other formats, return metadata only
    return {
      id: reportRecord.id,
      reportType: reportRecord.reportType as any,
      sessionId: reportRecord.sessionId,
      generatedAt: reportRecord.createdAt,
      format: reportRecord.exportFormat as ExportFormat,
      componentSummary: {
        totalComponents: reportRecord.componentCount || 0,
        componentsByType: {},
        totalPages: 0,
        confidenceAverage: 0,
        processingTime: reportRecord.generationTimeMs || 0
      },
      components: [],
      metadata: reportRecord.metadata as ReportMetadata
    };
  }

  /**
   * Download report file
   */
  public async downloadReport(reportId: string): Promise<{
    filePath: string;
    fileName: string;
    mimeType: string;
  } | null> {
    const report = await this.exportRepository.getReport(reportId);
    if (!report || !report.filePath) {
      return null;
    }

    // Update download count
    await this.exportRepository.incrementDownloadCount(reportId);

    const fileName = path.basename(report.filePath);
    const mimeTypes: Record<ExportFormat, string> = {
      'pdf': 'application/pdf',
      'csv': 'text/csv',
      'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'json': 'application/json'
    };

    return {
      filePath: report.filePath,
      fileName,
      mimeType: mimeTypes[report.exportFormat as ExportFormat] || 'application/octet-stream'
    };
  }

  /**
   * List all reports for a session
   */
  public async listSessionReports(sessionId: string): Promise<any[]> {
    return await this.exportRepository.getReportsBySession(sessionId);
  }

  /**
   * Clean up expired reports
   */
  public async cleanupExpiredReports(): Promise<number> {
    const expiredReports = await this.exportRepository.getExpiredReports();
    let deletedCount = 0;

    for (const report of expiredReports) {
      if (report.filePath) {
        try {
          await fs.unlink(report.filePath);
          await this.exportRepository.deleteReport(report.id);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete report ${report.id}:`, error);
        }
      }
    }

    return deletedCount;
  }

  /**
   * Handle streaming export for large datasets
   */
  private async handleStreamingExport(
    request: ComponentExportRequest,
    components: ComponentReportItem[]
  ): Promise<ExportResult> {
    try {
      // Generate secure file path for streaming
      const secureFileName = this.generateSecureFileName(
        'component_list',
        request.exportFormat,
        request.sessionId
      );
      const outputPath = path.join(this.exportDirectory, secureFileName);

      // Create optimal streaming options
      const streamingOptions = this.streamExportService.createOptimalStreamingOptions(
        components.length,
        request.exportFormat,
        outputPath
      );

      // Validate streaming setup
      const validation = await this.streamExportService.validateStreamingSetup(streamingOptions);
      if (!validation.valid) {
        throw new Error(`Streaming validation failed: ${validation.issues.join(', ')}`);
      }

      // Process using streaming
      const streamResult = await this.streamExportService.processLargeExport(
        components,
        streamingOptions
      );

      if (!streamResult.success) {
        throw new Error(streamResult.error || 'Streaming export failed');
      }

      // Get file size
      const stats = await fs.stat(outputPath);
      const fileSize = stats.size;

      // Create a simplified report structure for streaming exports
      const reportId = this.generateReportId();
      const reportRecord = await this.exportRepository.saveReport({
        id: reportId,
        sessionId: request.sessionId,
        reportType: 'component_list',
        exportFormat: request.exportFormat,
        templateId: request.templateId,
        filePath: outputPath,
        fileSize,
        componentCount: streamResult.processedCount,
        generationTimeMs: streamResult.processingTime,
        metadata: {
          streamingUsed: true,
          memoryUsage: streamResult.memoryUsage,
          exportVersion: '1.0.0-streaming'
        }
      });

      console.log(`Streaming export completed: ${streamResult.processedCount} components in ${streamResult.processingTime}ms`);
      console.log(`Memory usage - Peak: ${(streamResult.memoryUsage.peak / 1024 / 1024).toFixed(1)}MB, Final: ${(streamResult.memoryUsage.final / 1024 / 1024).toFixed(1)}MB`);

      // Record successful streaming export
      this.monitoringService.recordExportSuccess(
        request.sessionId,
        request.exportFormat,
        streamResult.processedCount,
        streamResult.processingTime,
        fileSize
      );

      return {
        success: true,
        reportId: reportRecord.id,
        filePath: outputPath,
        fileSize,
        generationTime: streamResult.processingTime
      };

    } catch (error) {
      console.error('Streaming export failed:', error);
      throw error; // Let the main error recovery handle this
    }
  }

  /**
   * Generate a unique report ID
   */
  private generateReportId(): string {
    return crypto.randomUUID();
  }

  /**
   * Validate file path is safe and within export directory
   */
  private isFilePathSafe(filePath: string): boolean {
    try {
      const resolvedPath = path.resolve(filePath);
      const resolvedExportDir = path.resolve(this.exportDirectory);
      
      // Check if file is within export directory
      if (!resolvedPath.startsWith(resolvedExportDir)) {
        console.error('File path outside export directory:', resolvedPath);
        return false;
      }
      
      // Check for dangerous characters
      const dangerousChars = /[<>:"|?*\x00-\x1f]/;
      if (dangerousChars.test(path.basename(resolvedPath))) {
        console.error('File path contains dangerous characters:', resolvedPath);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('File path validation error:', error);
      return false;
    }
  }

  /**
   * Get monitoring service instance for external access
   */
  public getMonitoringService(): ExportMonitoringService {
    return this.monitoringService;
  }

  /**
   * Get export health status
   */
  public getHealthStatus() {
    return this.monitoringService.getHealthStatus();
  }

  /**
   * Get export metrics
   */
  public getMetrics() {
    return this.monitoringService.getMetrics();
  }

  /**
   * Get performance report
   */
  public getPerformanceReport() {
    return this.monitoringService.generatePerformanceReport();
  }

  /**
   * Generate export preview without creating file
   */
  public async generatePreview(
    request: ComponentExportRequest
  ): Promise<{
    componentCount: number;
    pageCount: number;
    estimatedSize: number;
    components: ComponentReportItem[];
  }> {
    const componentData = await this.aggregateComponentData(
      request.sessionId,
      request.documentIds
    );

    const processedComponents = this.processComponents(
      componentData,
      request.customOptions
    );

    const uniquePages = new Set(
      processedComponents.map(c => c.location.pageNumber)
    );

    // Estimate file size based on format and component count
    const sizeEstimates: Record<ExportFormat, number> = {
      'pdf': processedComponents.length * 500,     // ~500 bytes per component
      'csv': processedComponents.length * 200,     // ~200 bytes per component
      'excel': processedComponents.length * 300,   // ~300 bytes per component
      'json': processedComponents.length * 400     // ~400 bytes per component
    };

    return {
      componentCount: processedComponents.length,
      pageCount: uniquePages.size,
      estimatedSize: sizeEstimates[request.exportFormat] || 0,
      components: processedComponents.slice(0, 10) // Return first 10 as preview
    };
  }
}