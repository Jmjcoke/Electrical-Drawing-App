/**
 * Cross-Page Navigation Service
 * 
 * Handles navigation between pages for cross-page component references.
 * Creates navigation links, manages visual overlays, and provides user interaction
 * functionality for cross-page reference system.
 * 
 * Story: 4.4 Cross-Reference Engine
 * Task: 4.4.2 Implement Cross-Page Navigation Integration
 */

import { Pool } from 'pg';
import {
  CrossPageNavigationLink,
  CrossPageNavigationRequest,
  CrossPageNavigationResponse,
  VisualOverlayData,
  ComponentReference,
  CrossPageReferenceError,
  CrossPageReferenceErrorCodes
} from '../../../../shared/types/cross-page-reference.types';

export class CrossPageNavigationService {
  private db: Pool;
  private activeNavigationLinks: Map<string, CrossPageNavigationLink> = new Map();

  constructor(database: Pool) {
    this.db = database;
  }

  /**
   * Create navigation links for cross-page references
   */
  async createNavigationLinks(
    sessionId: string,
    documentId: string
  ): Promise<CrossPageNavigationLink[]> {
    const client = await this.db.connect();
    
    try {
      // Get all cross-page references for the document
      const referencesQuery = `
        SELECT cpr.id, cpr.source_component_id, cpr.target_component_id,
               cpr.reference_designation, cpr.source_page_number, cpr.target_page_number,
               ds_source.location_x as source_x, ds_source.location_y as source_y,
               ds_target.location_x as target_x, ds_target.location_y as target_y
        FROM electrical_analysis.cross_page_references cpr
        JOIN electrical_analysis.detected_symbols ds_source ON cpr.source_component_id = ds_source.id
        LEFT JOIN electrical_analysis.detected_symbols ds_target ON cpr.target_component_id = ds_target.id
        WHERE cpr.source_document_id = $1
        ORDER BY cpr.reference_designation, cpr.source_page_number
      `;

      const result = await client.query(referencesQuery, [documentId]);
      const references = result.rows;

      const navigationLinks: CrossPageNavigationLink[] = [];

      for (const ref of references) {
        const targetCoords = ref.target_x && ref.target_y ? {
          x: parseFloat(ref.target_x),
          y: parseFloat(ref.target_y)
        } : undefined;

        const navigationLink: CrossPageNavigationLink = {
          referenceId: ref.id,
          sourceCoordinates: {
            x: parseFloat(ref.source_x),
            y: parseFloat(ref.source_y)
          },
          ...(targetCoords && { targetCoordinates: targetCoords }),
          navigationLabel: `${ref.reference_designation} (Page ${ref.source_page_number} → ${ref.target_page_number})`,
          isActive: false
        };

        navigationLinks.push(navigationLink);
        
        // Store in active links cache
        this.activeNavigationLinks.set(navigationLink.referenceId, navigationLink);
      }

      return navigationLinks;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CrossPageReferenceError(
        `Failed to create navigation links: ${errorMessage}`,
        CrossPageReferenceErrorCodes.NAVIGATION_FAILED,
        { sessionId, documentId, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Handle cross-page navigation request
   */
  async navigateToReference(
    request: CrossPageNavigationRequest
  ): Promise<CrossPageNavigationResponse> {
    const client = await this.db.connect();
    
    try {
      // Get the cross-page reference details
      const referenceQuery = `
        SELECT cpr.*, 
               ds_source.location_x as source_x, ds_source.location_y as source_y,
               ds_target.location_x as target_x, ds_target.location_y as target_y,
               cr_target.reference_designation, cr_target.component_type
        FROM electrical_analysis.cross_page_references cpr
        JOIN electrical_analysis.detected_symbols ds_source ON cpr.source_component_id = ds_source.id
        LEFT JOIN electrical_analysis.detected_symbols ds_target ON cpr.target_component_id = ds_target.id
        LEFT JOIN electrical_analysis.component_references cr_target ON cpr.target_component_id = cr_target.component_id
        WHERE cpr.id = $1
      `;

      const result = await client.query(referenceQuery, [request.referenceId]);
      
      if (result.rows.length === 0) {
        return {
          success: false,
          navigationLink: {} as CrossPageNavigationLink,
          error: 'Reference not found'
        };
      }

      const ref = result.rows[0];

      // Create navigation link
      const targetCoords = ref.target_x && ref.target_y ? {
        x: parseFloat(ref.target_x),
        y: parseFloat(ref.target_y)
      } : undefined;

      const navigationLink: CrossPageNavigationLink = {
        referenceId: request.referenceId,
        sourceCoordinates: {
          x: parseFloat(ref.source_x),
          y: parseFloat(ref.source_y)
        },
        ...(targetCoords && { targetCoordinates: targetCoords }),
        navigationLabel: `${ref.reference_designation} (Page ${request.fromPage} → ${request.toPage})`,
        isActive: true
      };

      // Create target component reference if available
      const targetComponent: ComponentReference | undefined = ref.target_component_id ? {
        componentId: ref.target_component_id,
        referenceDesignation: ref.reference_designation,
        pageNumber: ref.target_page_number,
        documentId: ref.target_document_id || ref.source_document_id,
        componentType: ref.component_type || '',
        isMainReference: true,
        relatedReferences: []
      } : undefined;

      // Create visual overlay data
      const visualOverlayData = this.createVisualOverlay(navigationLink, ref);

      // Update active navigation link
      this.activeNavigationLinks.set(request.referenceId, navigationLink);

      return {
        success: true,
        navigationLink,
        ...(targetComponent && { targetComponent }),
        visualOverlayData
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        navigationLink: {} as CrossPageNavigationLink,
        error: `Navigation failed: ${errorMessage}`
      };
    } finally {
      client.release();
    }
  }

  /**
   * Create visual overlay data for navigation
   */
  private createVisualOverlay(
    navigationLink: CrossPageNavigationLink,
    _referenceData: any
  ): VisualOverlayData {
    const coordinates = navigationLink.targetCoordinates || navigationLink.sourceCoordinates;
    
    return {
      highlightCoordinates: {
        x: coordinates.x - 0.02, // Expand highlight area
        y: coordinates.y - 0.02,
        width: 0.04,
        height: 0.04
      },
      overlayType: 'highlight',
      color: '#FF6B35', // Orange highlight for cross-page references
      label: navigationLink.navigationLabel,
      interactive: true
    };
  }

  /**
   * Get navigation links for a specific page
   */
  async getNavigationLinksForPage(
    documentId: string,
    pageNumber: number
  ): Promise<CrossPageNavigationLink[]> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT cpr.id, cpr.reference_designation, cpr.source_page_number, cpr.target_page_number,
               ds_source.location_x as source_x, ds_source.location_y as source_y,
               ds_target.location_x as target_x, ds_target.location_y as target_y
        FROM electrical_analysis.cross_page_references cpr
        JOIN electrical_analysis.detected_symbols ds_source ON cpr.source_component_id = ds_source.id
        LEFT JOIN electrical_analysis.detected_symbols ds_target ON cpr.target_component_id = ds_target.id
        WHERE cpr.source_document_id = $1 
          AND (cpr.source_page_number = $2 OR cpr.target_page_number = $2)
        ORDER BY cpr.reference_designation
      `;

      const result = await client.query(query, [documentId, pageNumber]);
      const navigationLinks: CrossPageNavigationLink[] = [];

      for (const row of result.rows) {
        const isSourcePage = row.source_page_number === pageNumber;
        const coordinates = isSourcePage ? {
          x: parseFloat(row.source_x),
          y: parseFloat(row.source_y)
        } : row.target_x && row.target_y ? {
          x: parseFloat(row.target_x),
          y: parseFloat(row.target_y)
        } : undefined;

        if (coordinates) {
          const navigationLink: CrossPageNavigationLink = {
            referenceId: row.id,
            sourceCoordinates: coordinates,
            targetCoordinates: !isSourcePage && row.source_x && row.source_y ? {
              x: parseFloat(row.source_x),
              y: parseFloat(row.source_y)
            } : undefined,
            navigationLabel: `${row.reference_designation} → Page ${isSourcePage ? row.target_page_number : row.source_page_number}`,
            isActive: this.activeNavigationLinks.has(row.id)
          };

          navigationLinks.push(navigationLink);
        }
      }

      return navigationLinks;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CrossPageReferenceError(
        `Failed to get navigation links for page: ${errorMessage}`,
        CrossPageReferenceErrorCodes.NAVIGATION_FAILED,
        { documentId, pageNumber, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Activate a navigation link
   */
  activateNavigationLink(referenceId: string): boolean {
    const link = this.activeNavigationLinks.get(referenceId);
    if (link) {
      link.isActive = true;
      this.activeNavigationLinks.set(referenceId, link);
      return true;
    }
    return false;
  }

  /**
   * Deactivate a navigation link
   */
  deactivateNavigationLink(referenceId: string): boolean {
    const link = this.activeNavigationLinks.get(referenceId);
    if (link) {
      link.isActive = false;
      this.activeNavigationLinks.set(referenceId, link);
      return true;
    }
    return false;
  }

  /**
   * Get all active navigation links
   */
  getActiveNavigationLinks(): CrossPageNavigationLink[] {
    return Array.from(this.activeNavigationLinks.values())
      .filter(link => link.isActive);
  }

  /**
   * Clear all navigation links
   */
  clearNavigationLinks(sessionId?: string): void {
    if (sessionId) {
      // In a real implementation, you might filter by session
      // For now, clear all links
      this.activeNavigationLinks.clear();
    } else {
      this.activeNavigationLinks.clear();
    }
  }

  /**
   * Get navigation tooltip information
   */
  async getNavigationTooltip(
    referenceId: string
  ): Promise<{
    title: string;
    description: string;
    targetInfo: string;
    confidence: number;
  } | null> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT cpr.reference_designation, cpr.reference_type, cpr.confidence,
               cpr.source_page_number, cpr.target_page_number,
               ds_source.symbol_type as source_type, ds_target.symbol_type as target_type
        FROM electrical_analysis.cross_page_references cpr
        JOIN electrical_analysis.detected_symbols ds_source ON cpr.source_component_id = ds_source.id
        LEFT JOIN electrical_analysis.detected_symbols ds_target ON cpr.target_component_id = ds_target.id
        WHERE cpr.id = $1
      `;

      const result = await client.query(query, [referenceId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const ref = result.rows[0];
      
      return {
        title: `Reference: ${ref.reference_designation}`,
        description: this.getReferenceTypeDescription(ref.reference_type),
        targetInfo: `From Page ${ref.source_page_number} to Page ${ref.target_page_number}`,
        confidence: parseFloat(ref.confidence)
      };

    } catch (error) {
      console.error('Failed to get navigation tooltip:', error);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Get description for reference type
   */
  private getReferenceTypeDescription(referenceType: string): string {
    const descriptions: Record<string, string> = {
      component_continuation: 'Component continues on another page',
      detail_reference: 'Detailed view available on another page',
      schematic_reference: 'Related schematic on another page',
      part_reference: 'Part details on another page',
      assembly_reference: 'Assembly details on another page'
    };

    return descriptions[referenceType] || 'Cross-page reference';
  }

  /**
   * Generate navigation breadcrumb
   */
  async generateNavigationBreadcrumb(
    referenceId: string
  ): Promise<{
    path: { pageNumber: number; referenceDesignation: string }[];
    currentPage: number;
    totalHops: number;
  } | null> {
    const client = await this.db.connect();
    
    try {
      // For now, implement simple breadcrumb (could be extended for complex chains)
      const query = `
        SELECT cpr.reference_designation, cpr.source_page_number, cpr.target_page_number
        FROM electrical_analysis.cross_page_references cpr
        WHERE cpr.id = $1
      `;

      const result = await client.query(query, [referenceId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const ref = result.rows[0];
      
      return {
        path: [
          {
            pageNumber: ref.source_page_number,
            referenceDesignation: ref.reference_designation
          },
          {
            pageNumber: ref.target_page_number,
            referenceDesignation: ref.reference_designation
          }
        ],
        currentPage: ref.target_page_number,
        totalHops: 1
      };

    } catch (error) {
      console.error('Failed to generate navigation breadcrumb:', error);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Get navigation statistics
   */
  async getNavigationStats(documentId: string): Promise<{
    totalNavigationLinks: number;
    activeLinks: number;
    byReferenceType: Record<string, number>;
    byPagePair: Record<string, number>;
    avgConfidence: number;
  }> {
    const client = await this.db.connect();
    
    try {
      const query = `
        SELECT cpr.reference_type, cpr.source_page_number, cpr.target_page_number,
               cpr.confidence, COUNT(*) as count
        FROM electrical_analysis.cross_page_references cpr
        WHERE cpr.source_document_id = $1
        GROUP BY cpr.reference_type, cpr.source_page_number, cpr.target_page_number, cpr.confidence
      `;

      const result = await client.query(query, [documentId]);
      const stats = {
        totalNavigationLinks: 0,
        activeLinks: this.getActiveNavigationLinks().length,
        byReferenceType: {} as Record<string, number>,
        byPagePair: {} as Record<string, number>,
        avgConfidence: 0
      };

      let totalConfidence = 0;
      
      for (const row of result.rows) {
        const count = parseInt(row.count);
        stats.totalNavigationLinks += count;
        
        stats.byReferenceType[row.reference_type] = 
          (stats.byReferenceType[row.reference_type] || 0) + count;
        
        const pagePair = `${row.source_page_number}-${row.target_page_number}`;
        stats.byPagePair[pagePair] = 
          (stats.byPagePair[pagePair] || 0) + count;
        
        totalConfidence += parseFloat(row.confidence) * count;
      }

      if (stats.totalNavigationLinks > 0) {
        stats.avgConfidence = totalConfidence / stats.totalNavigationLinks;
      }

      return stats;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CrossPageReferenceError(
        `Failed to get navigation statistics: ${errorMessage}`,
        CrossPageReferenceErrorCodes.DATABASE_ERROR,
        { documentId, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }
}