/**
 * Highlight Export Service
 * Provides functionality for exporting highlighted schematics in various formats
 */

import type {
  ComponentHighlight,
  ViewportState,
  HighlightGroup
} from '../types/highlighting.types';

export interface ExportOptions {
  readonly format: 'png' | 'svg' | 'pdf' | 'json';
  readonly includeHiddenHighlights?: boolean;
  readonly includeMetadata?: boolean;
  readonly quality?: number; // 0.1 to 1.0 for image formats
  readonly backgroundColor?: string;
  readonly title?: string;
  readonly description?: string;
  readonly author?: string;
}

export interface ExportMetadata {
  readonly exportedAt: Date;
  readonly totalHighlights: number;
  readonly visibleHighlights: number;
  readonly exportOptions: ExportOptions;
  readonly viewportState: ViewportState;
  readonly sessionId: string;
  readonly title?: string;
  readonly description?: string;
  readonly author?: string;
}

export interface ExportResult {
  readonly blob: Blob;
  readonly filename: string;
  readonly metadata: ExportMetadata;
  readonly success: boolean;
  readonly error?: string;
}

export interface HighlightExportData {
  readonly highlights: ComponentHighlight[];
  readonly groups: HighlightGroup[];
  readonly viewport: ViewportState;
  readonly metadata: ExportMetadata;
  readonly version: string;
}

export class HighlightExportService {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    // Create offscreen canvas for export rendering
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Export highlights and schematic as image
   */
  async exportAsImage(
    baseCanvas: HTMLCanvasElement,
    highlights: ComponentHighlight[],
    viewportState: ViewportState,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      if (!this.canvas || !this.ctx) {
        throw new Error('Export canvas not available');
      }

      const { format, quality = 0.9, backgroundColor = 'white', includeHiddenHighlights = false } = options;
      
      // Set canvas size to match base canvas
      this.canvas.width = baseCanvas.width;
      this.canvas.height = baseCanvas.height;

      // Fill background
      this.ctx.fillStyle = backgroundColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Draw base schematic
      this.ctx.drawImage(baseCanvas, 0, 0);

      // Filter highlights based on options
      const highlightsToExport = includeHiddenHighlights 
        ? highlights
        : highlights.filter(h => h.isVisible);

      // Render highlights on export canvas
      await this.renderHighlightsForExport(highlightsToExport, viewportState);

      // Convert to blob based on format
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      const blob = await new Promise<Blob>((resolve, reject) => {
        this.canvas!.toBlob(
          (result) => result ? resolve(result) : reject(new Error('Failed to create blob')),
          mimeType,
          quality
        );
      });

      const metadata: ExportMetadata = {
        exportedAt: new Date(),
        totalHighlights: highlights.length,
        visibleHighlights: highlightsToExport.length,
        exportOptions: options,
        viewportState,
        sessionId: this.generateSessionId(),
        title: options.title,
        description: options.description,
        author: options.author
      };

      const filename = this.generateFilename(format, options.title);

      return {
        blob,
        filename,
        metadata,
        success: true
      };
    } catch (error) {
      return {
        blob: new Blob(),
        filename: '',
        metadata: {} as ExportMetadata,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown export error'
      };
    }
  }

  /**
   * Export highlights as SVG
   */
  async exportAsSVG(
    highlights: ComponentHighlight[],
    canvasWidth: number,
    canvasHeight: number,
    viewportState: ViewportState,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const { includeHiddenHighlights = false, backgroundColor = 'white' } = options;
      
      const highlightsToExport = includeHiddenHighlights 
        ? highlights
        : highlights.filter(h => h.isVisible);

      // Create SVG content
      const svgContent = this.generateSVGContent(
        highlightsToExport,
        canvasWidth,
        canvasHeight,
        viewportState,
        backgroundColor
      );

      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      
      const metadata: ExportMetadata = {
        exportedAt: new Date(),
        totalHighlights: highlights.length,
        visibleHighlights: highlightsToExport.length,
        exportOptions: options,
        viewportState,
        sessionId: this.generateSessionId(),
        title: options.title,
        description: options.description,
        author: options.author
      };

      const filename = this.generateFilename('svg', options.title);

      return {
        blob,
        filename,
        metadata,
        success: true
      };
    } catch (error) {
      return {
        blob: new Blob(),
        filename: '',
        metadata: {} as ExportMetadata,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown SVG export error'
      };
    }
  }

  /**
   * Export highlights data as JSON
   */
  async exportAsJSON(
    highlights: ComponentHighlight[],
    groups: HighlightGroup[],
    viewportState: ViewportState,
    options: ExportOptions
  ): Promise<ExportResult> {
    try {
      const { includeHiddenHighlights = false, includeMetadata = true } = options;
      
      const highlightsToExport = includeHiddenHighlights 
        ? highlights
        : highlights.filter(h => h.isVisible);

      const metadata: ExportMetadata = {
        exportedAt: new Date(),
        totalHighlights: highlights.length,
        visibleHighlights: highlightsToExport.length,
        exportOptions: options,
        viewportState,
        sessionId: this.generateSessionId(),
        title: options.title,
        description: options.description,
        author: options.author
      };

      const exportData: HighlightExportData = {
        highlights: highlightsToExport,
        groups,
        viewport: viewportState,
        metadata: includeMetadata ? metadata : {} as ExportMetadata,
        version: '1.0'
      };

      const jsonContent = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      
      const filename = this.generateFilename('json', options.title);

      return {
        blob,
        filename,
        metadata,
        success: true
      };
    } catch (error) {
      return {
        blob: new Blob(),
        filename: '',
        metadata: {} as ExportMetadata,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown JSON export error'
      };
    }
  }

  /**
   * Import highlights from JSON data
   */
  async importFromJSON(jsonBlob: Blob): Promise<{
    success: boolean;
    data?: HighlightExportData;
    error?: string;
  }> {
    try {
      const jsonText = await jsonBlob.text();
      const data: HighlightExportData = JSON.parse(jsonText);

      // Validate imported data structure
      if (!this.validateImportData(data)) {
        throw new Error('Invalid import data format');
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown import error'
      };
    }
  }

  /**
   * Generate export summary report
   */
  generateExportReport(
    highlights: ComponentHighlight[],
    groups: HighlightGroup[],
    metadata: ExportMetadata
  ): string {
    const visibleHighlights = highlights.filter(h => h.isVisible);
    const hiddenHighlights = highlights.filter(h => !h.isVisible);
    
    const componentTypes = highlights.reduce((acc, h) => {
      acc[h.type] = (acc[h.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const report = `
# Highlight Export Report

**Export Details:**
- Export Date: ${metadata.exportedAt.toISOString()}
- Total Highlights: ${metadata.totalHighlights}
- Visible Highlights: ${visibleHighlights.length}
- Hidden Highlights: ${hiddenHighlights.length}
- Highlight Groups: ${groups.length}

**Component Breakdown:**
${Object.entries(componentTypes)
  .map(([type, count]) => `- ${type}: ${count}`)
  .join('\n')}

**Export Options:**
- Format: ${metadata.exportOptions.format}
- Include Hidden: ${metadata.exportOptions.includeHiddenHighlights ? 'Yes' : 'No'}
- Include Metadata: ${metadata.exportOptions.includeMetadata ? 'Yes' : 'No'}
- Quality: ${metadata.exportOptions.quality || 'Default'}

${metadata.title ? `**Title:** ${metadata.title}\n` : ''}
${metadata.description ? `**Description:** ${metadata.description}\n` : ''}
${metadata.author ? `**Author:** ${metadata.author}\n` : ''}

**Session Information:**
- Session ID: ${metadata.sessionId}
- Viewport Zoom: ${metadata.viewportState.zoom}
- Viewport Pan: (${metadata.viewportState.panX}, ${metadata.viewportState.panY})
    `.trim();

    return report;
  }

  /**
   * Render highlights on export canvas
   */
  private async renderHighlightsForExport(
    highlights: ComponentHighlight[],
    viewportState: ViewportState
  ): Promise<void> {
    if (!this.ctx || !this.canvas) return;

    // Sort highlights by z-index
    const sortedHighlights = [...highlights].sort((a, b) => a.style.zIndex - b.style.zIndex);

    for (const highlight of sortedHighlights) {
      this.ctx.save();
      
      // Apply highlight style
      this.ctx.globalAlpha = highlight.style.opacity;
      this.ctx.strokeStyle = highlight.style.color;
      this.ctx.lineWidth = highlight.style.strokeWidth;
      this.ctx.fillStyle = highlight.style.color;
      
      // Set line dash pattern
      switch (highlight.style.strokeStyle) {
        case 'dashed':
          this.ctx.setLineDash([5, 5]);
          break;
        case 'dotted':
          this.ctx.setLineDash([2, 2]);
          break;
        default:
          this.ctx.setLineDash([]);
      }

      // Calculate position
      const x = highlight.coordinates.x * this.canvas.width;
      const y = highlight.coordinates.y * this.canvas.height;
      const width = (highlight.coordinates.width || 0.05) * this.canvas.width;
      const height = (highlight.coordinates.height || 0.05) * this.canvas.height;

      this.ctx.beginPath();

      // Render based on highlight type
      switch (highlight.type) {
        case 'component':
          this.ctx.rect(x - width / 2, y - height / 2, width, height);
          break;
        case 'area':
          if (highlight.coordinates.radius) {
            const radius = highlight.coordinates.radius * Math.min(this.canvas.width, this.canvas.height);
            this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
          } else {
            // Fallback to rectangle
            this.ctx.rect(x - width / 2, y - height / 2, width, height);
          }
          break;
        default:
          this.ctx.rect(x - width / 2, y - height / 2, width, height);
      }

      // Fill and stroke
      if (highlight.style.fillOpacity > 0) {
        this.ctx.globalAlpha = highlight.style.fillOpacity;
        this.ctx.fill();
      }
      
      this.ctx.globalAlpha = highlight.style.opacity;
      this.ctx.stroke();
      
      this.ctx.restore();
    }
  }

  /**
   * Generate SVG content for highlights
   */
  private generateSVGContent(
    highlights: ComponentHighlight[],
    width: number,
    height: number,
    viewportState: ViewportState,
    backgroundColor: string
  ): string {
    const sortedHighlights = [...highlights].sort((a, b) => a.style.zIndex - b.style.zIndex);
    
    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${backgroundColor}"/>
  <g id="highlights">`;

    for (const highlight of sortedHighlights) {
      const x = highlight.coordinates.x * width;
      const y = highlight.coordinates.y * height;
      const w = (highlight.coordinates.width || 0.05) * width;
      const h = (highlight.coordinates.height || 0.05) * height;

      const strokeDashArray = highlight.style.strokeStyle === 'dashed' ? '5,5' : 
                             highlight.style.strokeStyle === 'dotted' ? '2,2' : 'none';

      if (highlight.type === 'area' && highlight.coordinates.radius) {
        const radius = highlight.coordinates.radius * Math.min(width, height);
        svgContent += `
    <circle cx="${x}" cy="${y}" r="${radius}"
      fill="${highlight.style.color}"
      fill-opacity="${highlight.style.fillOpacity || 0.2}"
      stroke="${highlight.style.color}"
      stroke-width="${highlight.style.strokeWidth}"
      stroke-opacity="${highlight.style.opacity}"
      stroke-dasharray="${strokeDashArray}"
      data-highlight-id="${highlight.id}"
      data-component-id="${highlight.componentId || ''}" />`;
      } else {
        svgContent += `
    <rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}"
      fill="${highlight.style.color}"
      fill-opacity="${highlight.style.fillOpacity || 0.2}"
      stroke="${highlight.style.color}"
      stroke-width="${highlight.style.strokeWidth}"
      stroke-opacity="${highlight.style.opacity}"
      stroke-dasharray="${strokeDashArray}"
      data-highlight-id="${highlight.id}"
      data-component-id="${highlight.componentId || ''}" />`;
      }
    }

    svgContent += `
  </g>
</svg>`;

    return svgContent;
  }

  /**
   * Validate imported data structure
   */
  private validateImportData(data: any): data is HighlightExportData {
    return (
      data &&
      typeof data === 'object' &&
      Array.isArray(data.highlights) &&
      Array.isArray(data.groups) &&
      data.viewport &&
      data.metadata &&
      typeof data.version === 'string'
    );
  }

  /**
   * Generate filename for export
   */
  private generateFilename(format: string, title?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const baseName = title ? title.replace(/[^a-zA-Z0-9]/g, '_') : 'highlights';
    return `${baseName}_${timestamp}.${format}`;
  }

  /**
   * Generate session ID for export metadata
   */
  private generateSessionId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.canvas = null;
    this.ctx = null;
  }
}

// Singleton instance
let highlightExportServiceInstance: HighlightExportService | null = null;

export function getHighlightExportService(): HighlightExportService {
  if (!highlightExportServiceInstance) {
    highlightExportServiceInstance = new HighlightExportService();
  }
  return highlightExportServiceInstance;
}

/**
 * Utility function to download export result
 */
export function downloadExportResult(result: ExportResult): void {
  if (!result.success || !result.blob) {
    console.error('Cannot download failed export:', result.error);
    return;
  }

  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Cleanup
  setTimeout(() => URL.revokeObjectURL(url), 100);
}