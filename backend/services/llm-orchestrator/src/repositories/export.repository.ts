/**
 * Export Repository
 * Handles database operations for component reports and export history
 * Implements Story 4.5 database persistence layer
 */

import { Pool } from 'pg';
import { ExportFormat, ReportType, ReportMetadata } from '../../../../shared/types/nlp.types';

export interface ReportRecord {
  id: string;
  sessionId: string;
  reportType: ReportType;
  exportFormat: ExportFormat;
  templateId?: string;
  filePath?: string;
  fileSize?: number;
  componentCount?: number;
  generationTimeMs?: number;
  downloadCount: number;
  createdAt: Date;
  expiresAt?: Date;
  metadata: ReportMetadata;
}

export interface ExportHistoryRecord {
  id: string;
  sessionId: string;
  reportId: string;
  exportFormat: ExportFormat;
  componentCount?: number;
  fileSize?: number;
  generationTimeMs?: number;
  downloadTimestamp: Date;
  userIp?: string;
  success: boolean;
  errorMessage?: string;
}

export class ExportRepository {
  constructor(private pool: Pool) {}

  /**
   * Save a new report to the database
   */
  async saveReport(report: Partial<ReportRecord>): Promise<ReportRecord> {
    const query = `
      INSERT INTO electrical_analysis.component_reports (
        session_id, report_type, export_format, template_id,
        file_path, file_size, component_count, generation_time_ms,
        metadata, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const values = [
      report.sessionId,
      report.reportType,
      report.exportFormat,
      report.templateId || null,
      report.filePath || null,
      report.fileSize || null,
      report.componentCount || null,
      report.generationTimeMs || null,
      JSON.stringify(report.metadata || {}),
      report.expiresAt || null
    ];

    const result = await this.pool.query(query, values);
    return this.mapToReportRecord(result.rows[0]);
  }

  /**
   * Get a report by ID
   */
  async getReport(reportId: string): Promise<ReportRecord | null> {
    const query = `
      SELECT * FROM electrical_analysis.component_reports
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [reportId]);
    return result.rows.length > 0 ? this.mapToReportRecord(result.rows[0]) : null;
  }

  /**
   * Get all reports for a session
   */
  async getReportsBySession(sessionId: string): Promise<ReportRecord[]> {
    const query = `
      SELECT * FROM electrical_analysis.component_reports
      WHERE session_id = $1
      ORDER BY created_at DESC
    `;

    const result = await this.pool.query(query, [sessionId]);
    return result.rows.map(row => this.mapToReportRecord(row));
  }

  /**
   * Update report download count
   */
  async incrementDownloadCount(reportId: string): Promise<void> {
    const query = `
      UPDATE electrical_analysis.component_reports
      SET download_count = download_count + 1
      WHERE id = $1
    `;

    await this.pool.query(query, [reportId]);
  }

  /**
   * Get expired reports for cleanup
   */
  async getExpiredReports(): Promise<ReportRecord[]> {
    const query = `
      SELECT * FROM electrical_analysis.component_reports
      WHERE expires_at IS NOT NULL AND expires_at < NOW()
    `;

    const result = await this.pool.query(query);
    return result.rows.map(row => this.mapToReportRecord(row));
  }

  /**
   * Delete a report
   */
  async deleteReport(reportId: string): Promise<void> {
    const query = `
      DELETE FROM electrical_analysis.component_reports
      WHERE id = $1
    `;

    await this.pool.query(query, [reportId]);
  }

  /**
   * Save export history record
   */
  async saveExportHistory(history: Partial<ExportHistoryRecord>): Promise<ExportHistoryRecord> {
    const query = `
      INSERT INTO electrical_analysis.export_history (
        session_id, report_id, export_format, component_count,
        file_size, generation_time_ms, user_ip, success, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      history.sessionId,
      history.reportId,
      history.exportFormat,
      history.componentCount || null,
      history.fileSize || null,
      history.generationTimeMs || null,
      history.userIp || null,
      history.success !== false,
      history.errorMessage || null
    ];

    const result = await this.pool.query(query, values);
    return this.mapToExportHistoryRecord(result.rows[0]);
  }

  /**
   * Get export history for a session
   */
  async getExportHistory(sessionId: string): Promise<ExportHistoryRecord[]> {
    const query = `
      SELECT * FROM electrical_analysis.export_history
      WHERE session_id = $1
      ORDER BY download_timestamp DESC
    `;

    const result = await this.pool.query(query, [sessionId]);
    return result.rows.map(row => this.mapToExportHistoryRecord(row));
  }

  /**
   * Get report statistics
   */
  async getReportStatistics(sessionId?: string): Promise<{
    totalReports: number;
    totalDownloads: number;
    averageGenerationTime: number;
    formatBreakdown: Record<ExportFormat, number>;
    typeBreakdown: Record<ReportType, number>;
  }> {
    let query = `
      SELECT 
        COUNT(*) as total_reports,
        SUM(download_count) as total_downloads,
        AVG(generation_time_ms) as avg_generation_time,
        export_format,
        report_type,
        COUNT(*) as format_count
      FROM electrical_analysis.component_reports
    `;

    const values: any[] = [];
    if (sessionId) {
      query += ' WHERE session_id = $1';
      values.push(sessionId);
    }

    query += ' GROUP BY export_format, report_type';

    const result = await this.pool.query(query, values);

    const formatBreakdown: Record<ExportFormat, number> = {
      pdf: 0,
      csv: 0,
      excel: 0,
      json: 0
    };

    const typeBreakdown: Record<ReportType, number> = {
      component_list: 0,
      parts_order: 0,
      technical_analysis: 0,
      project_summary: 0
    };

    let totalReports = 0;
    let totalDownloads = 0;
    let totalGenerationTime = 0;
    let reportCount = 0;

    for (const row of result.rows) {
      const count = parseInt(row.format_count);
      formatBreakdown[row.export_format as ExportFormat] = 
        (formatBreakdown[row.export_format as ExportFormat] || 0) + count;
      typeBreakdown[row.report_type as ReportType] = 
        (typeBreakdown[row.report_type as ReportType] || 0) + count;
      
      totalReports += count;
      totalDownloads += parseInt(row.total_downloads || 0);
      if (row.avg_generation_time) {
        totalGenerationTime += parseFloat(row.avg_generation_time) * count;
        reportCount += count;
      }
    }

    return {
      totalReports,
      totalDownloads,
      averageGenerationTime: reportCount > 0 ? totalGenerationTime / reportCount : 0,
      formatBreakdown,
      typeBreakdown
    };
  }

  /**
   * Map database row to ReportRecord
   */
  private mapToReportRecord(row: any): ReportRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      reportType: row.report_type as ReportType,
      exportFormat: row.export_format as ExportFormat,
      templateId: row.template_id,
      filePath: row.file_path,
      fileSize: row.file_size,
      componentCount: row.component_count,
      generationTimeMs: row.generation_time_ms,
      downloadCount: row.download_count || 0,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      metadata: row.metadata || {}
    };
  }

  /**
   * Map database row to ExportHistoryRecord
   */
  private mapToExportHistoryRecord(row: any): ExportHistoryRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      reportId: row.report_id,
      exportFormat: row.export_format as ExportFormat,
      componentCount: row.component_count,
      fileSize: row.file_size,
      generationTimeMs: row.generation_time_ms,
      downloadTimestamp: row.download_timestamp,
      userIp: row.user_ip,
      success: row.success,
      errorMessage: row.error_message
    };
  }

  /**
   * Get a template by ID
   */
  async getTemplate(templateId: string): Promise<any | null> {
    const query = `
      SELECT * FROM electrical_analysis.report_templates
      WHERE id = $1
    `;

    const result = await this.pool.query(query, [templateId]);
    return result.rows.length > 0 ? this.mapToTemplate(result.rows[0]) : null;
  }

  /**
   * Get default template for report type
   */
  async getDefaultTemplate(reportType: ReportType): Promise<any | null> {
    const query = `
      SELECT * FROM electrical_analysis.report_templates
      WHERE template_type = $1 AND is_default = true
      LIMIT 1
    `;

    const result = await this.pool.query(query, [reportType]);
    return result.rows.length > 0 ? this.mapToTemplate(result.rows[0]) : null;
  }

  /**
   * List all templates
   */
  async listTemplates(templateType?: ReportType): Promise<any[]> {
    let query = `
      SELECT * FROM electrical_analysis.report_templates
    `;
    const params: any[] = [];

    if (templateType) {
      query += ' WHERE template_type = $1';
      params.push(templateType);
    }

    query += ' ORDER BY is_default DESC, is_system DESC, created_at DESC';

    const result = await this.pool.query(query, params);
    return result.rows.map(row => this.mapToTemplate(row));
  }

  /**
   * Save a new template
   */
  async saveTemplate(template: any): Promise<any> {
    const query = `
      INSERT INTO electrical_analysis.report_templates (
        id, name, description, template_type, layout_config,
        branding_config, sections_config, is_default, is_system
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      template.id,
      template.name,
      template.description,
      template.templateType,
      JSON.stringify(template.layout),
      JSON.stringify(template.branding || {}),
      JSON.stringify(template.sections),
      template.isDefault || false,
      template.isSystem || false
    ];

    const result = await this.pool.query(query, values);
    return this.mapToTemplate(result.rows[0]);
  }

  /**
   * Update an existing template
   */
  async updateTemplate(templateId: string, template: any): Promise<any> {
    const query = `
      UPDATE electrical_analysis.report_templates
      SET name = $2, description = $3, layout_config = $4,
          branding_config = $5, sections_config = $6, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const values = [
      templateId,
      template.name,
      template.description,
      JSON.stringify(template.layout),
      JSON.stringify(template.branding || {}),
      JSON.stringify(template.sections)
    ];

    const result = await this.pool.query(query, values);
    return result.rows.length > 0 ? this.mapToTemplate(result.rows[0]) : null;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    const query = `
      DELETE FROM electrical_analysis.report_templates
      WHERE id = $1 AND is_system = false
    `;

    const result = await this.pool.query(query, [templateId]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Set a template as default for its type
   */
  async setDefaultTemplate(templateId: string, templateType: ReportType): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Unset current default for this type
      await client.query(`
        UPDATE electrical_analysis.report_templates
        SET is_default = false
        WHERE template_type = $1 AND is_default = true
      `, [templateType]);

      // Set new default
      const result = await client.query(`
        UPDATE electrical_analysis.report_templates
        SET is_default = true
        WHERE id = $1 AND template_type = $2
        RETURNING id
      `, [templateId, templateType]);

      await client.query('COMMIT');
      return result.rowCount > 0;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Map database row to Template
   */
  private mapToTemplate(row: any): any {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      templateType: row.template_type as ReportType,
      layout: row.layout_config,
      branding: row.branding_config,
      sections: row.sections_config,
      customFields: row.custom_fields,
      isDefault: row.is_default,
      isSystem: row.is_system,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}