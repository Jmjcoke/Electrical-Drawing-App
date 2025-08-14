/**
 * Cross-Reference Service
 * 
 * Manages part number mappings, manufacturer information, and distributor
 * cross-references for electrical components.
 * 
 * Story: 4.2 Component Database Integration
 * Task: 4.2.2 Implement Component Specification Engine
 */

import { Pool } from 'pg';
import {
  CrossReference,
  DistributorInfo,
  AvailabilityInfo,
  // PricingInfo, // Not used in current implementation
  ComponentSpecificationError
} from '../../../../shared/types/component-database.types';

export class CrossReferenceService {
  private db: Pool;

  constructor(database: Pool) {
    this.db = database;
  }

  /**
   * Get all cross-references for a component
   */
  async getComponentCrossReferences(componentId: string): Promise<CrossReference[]> {
    const client = await this.db.connect();
    try {
      const query = `
        SELECT id, component_id, part_number, manufacturer, manufacturer_part_number,
               distributor_info, availability_info, created_at
        FROM electrical_analysis.component_cross_references
        WHERE component_id = $1
        ORDER BY manufacturer, part_number
      `;

      const result = await client.query(query, [componentId]);

      return result.rows.map(row => ({
        id: row.id,
        componentId: row.component_id,
        partNumber: row.part_number,
        manufacturer: row.manufacturer,
        manufacturerPartNumber: row.manufacturer_part_number,
        distributorInfo: row.distributor_info,
        availabilityInfo: row.availability_info,
        createdAt: row.created_at
      }));

    } catch (error) {
      throw new ComponentSpecificationError(
        `Failed to get component cross-references: ${error instanceof Error ? error.message : String(error)}`,
        { componentId, error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Search components by part number across all manufacturers
   */
  async searchByPartNumber(partNumber: string, exactMatch = false): Promise<CrossReference[]> {
    const client = await this.db.connect();
    try {
      let query: string;
      let params: any[];

      if (exactMatch) {
        query = `
          SELECT ccr.id, ccr.component_id, ccr.part_number, ccr.manufacturer, 
                 ccr.manufacturer_part_number, ccr.distributor_info, ccr.availability_info, 
                 ccr.created_at, cl.component_name, cl.component_description
          FROM electrical_analysis.component_cross_references ccr
          JOIN electrical_analysis.component_library cl ON ccr.component_id = cl.id
          WHERE ccr.part_number = $1 OR ccr.manufacturer_part_number = $1
          ORDER BY ccr.manufacturer, ccr.part_number
        `;
        params = [partNumber];
      } else {
        query = `
          SELECT ccr.id, ccr.component_id, ccr.part_number, ccr.manufacturer, 
                 ccr.manufacturer_part_number, ccr.distributor_info, ccr.availability_info, 
                 ccr.created_at, cl.component_name, cl.component_description
          FROM electrical_analysis.component_cross_references ccr
          JOIN electrical_analysis.component_library cl ON ccr.component_id = cl.id
          WHERE ccr.part_number ILIKE $1 OR ccr.manufacturer_part_number ILIKE $1
          ORDER BY ccr.manufacturer, ccr.part_number
        `;
        params = [`%${partNumber}%`];
      }

      const result = await client.query(query, params);

      return result.rows.map(row => ({
        id: row.id,
        componentId: row.component_id,
        partNumber: row.part_number,
        manufacturer: row.manufacturer,
        manufacturerPartNumber: row.manufacturer_part_number,
        distributorInfo: row.distributor_info,
        availabilityInfo: row.availability_info,
        createdAt: row.created_at
      }));

    } catch (error) {
      throw new ComponentSpecificationError(
        `Failed to search by part number: ${error instanceof Error ? error.message : String(error)}`,
        { partNumber, exactMatch, error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Search components by manufacturer
   */
  async searchByManufacturer(manufacturer: string, limit = 50, offset = 0): Promise<CrossReference[]> {
    const client = await this.db.connect();
    try {
      const query = `
        SELECT ccr.id, ccr.component_id, ccr.part_number, ccr.manufacturer, 
               ccr.manufacturer_part_number, ccr.distributor_info, ccr.availability_info, 
               ccr.created_at
        FROM electrical_analysis.component_cross_references ccr
        WHERE ccr.manufacturer ILIKE $1
        ORDER BY ccr.part_number
        LIMIT $2 OFFSET $3
      `;

      const result = await client.query(query, [`%${manufacturer}%`, limit, offset]);

      return result.rows.map(row => ({
        id: row.id,
        componentId: row.component_id,
        partNumber: row.part_number,
        manufacturer: row.manufacturer,
        manufacturerPartNumber: row.manufacturer_part_number,
        distributorInfo: row.distributor_info,
        availabilityInfo: row.availability_info,
        createdAt: row.created_at
      }));

    } catch (error) {
      throw new ComponentSpecificationError(
        `Failed to search by manufacturer: ${error instanceof Error ? error.message : String(error)}`,
        { manufacturer, error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Add new cross-reference for a component
   */
  async addCrossReference(
    componentId: string,
    partNumber: string,
    manufacturer: string,
    manufacturerPartNumber?: string,
    distributorInfo?: DistributorInfo,
    availabilityInfo?: AvailabilityInfo
  ): Promise<CrossReference> {
    const client = await this.db.connect();
    try {
      // Check if cross-reference already exists
      const existingQuery = `
        SELECT id FROM electrical_analysis.component_cross_references
        WHERE component_id = $1 AND part_number = $2 AND manufacturer = $3
      `;

      const existingResult = await client.query(existingQuery, [componentId, partNumber, manufacturer]);

      if (existingResult.rows.length > 0) {
        throw new ComponentSpecificationError(
          'Cross-reference already exists for this component, part number, and manufacturer combination'
        );
      }

      const insertQuery = `
        INSERT INTO electrical_analysis.component_cross_references
        (component_id, part_number, manufacturer, manufacturer_part_number, 
         distributor_info, availability_info)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, component_id, part_number, manufacturer, manufacturer_part_number,
                  distributor_info, availability_info, created_at
      `;

      const result = await client.query(insertQuery, [
        componentId,
        partNumber,
        manufacturer,
        manufacturerPartNumber,
        distributorInfo,
        availabilityInfo
      ]);

      return result.rows[0];

    } catch (error) {
      throw new ComponentSpecificationError(
        `Failed to add cross-reference: ${error instanceof Error ? error.message : String(error)}`,
        { componentId, partNumber, manufacturer, error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update cross-reference information
   */
  async updateCrossReference(
    crossReferenceId: string,
    updates: {
      manufacturerPartNumber?: string;
      distributorInfo?: DistributorInfo;
      availabilityInfo?: AvailabilityInfo;
    }
  ): Promise<CrossReference> {
    const client = await this.db.connect();
    try {
      const fields: string[] = [];
      const params: any[] = [crossReferenceId];
      let paramIndex = 2;

      if (updates.manufacturerPartNumber !== undefined) {
        fields.push(`manufacturer_part_number = $${paramIndex++}`);
        params.push(updates.manufacturerPartNumber);
      }

      if (updates.distributorInfo !== undefined) {
        fields.push(`distributor_info = $${paramIndex++}`);
        params.push(updates.distributorInfo);
      }

      if (updates.availabilityInfo !== undefined) {
        fields.push(`availability_info = $${paramIndex++}`);
        params.push(updates.availabilityInfo);
      }

      if (fields.length === 0) {
        throw new ComponentSpecificationError('No updates provided');
      }

      const updateQuery = `
        UPDATE electrical_analysis.component_cross_references
        SET ${fields.join(', ')}
        WHERE id = $1
        RETURNING id, component_id, part_number, manufacturer, manufacturer_part_number,
                  distributor_info, availability_info, created_at
      `;

      const result = await client.query(updateQuery, params);

      if (result.rows.length === 0) {
        throw new ComponentSpecificationError('Cross-reference not found');
      }

      return result.rows[0];

    } catch (error) {
      throw new ComponentSpecificationError(
        `Failed to update cross-reference: ${error instanceof Error ? error.message : String(error)}`,
        { crossReferenceId, updates, error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Delete cross-reference
   */
  async deleteCrossReference(crossReferenceId: string): Promise<boolean> {
    const client = await this.db.connect();
    try {
      const query = `
        DELETE FROM electrical_analysis.component_cross_references
        WHERE id = $1
      `;

      const result = await client.query(query, [crossReferenceId]);
      return (result.rowCount ?? 0) > 0;

    } catch (error) {
      throw new ComponentSpecificationError(
        `Failed to delete cross-reference: ${error instanceof Error ? error.message : String(error)}`,
        { crossReferenceId, error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update distributor information for multiple cross-references
   */
  async bulkUpdateDistributorInfo(updates: {
    crossReferenceId: string;
    distributorInfo: DistributorInfo;
  }[]): Promise<number> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      let updatedCount = 0;

      for (const update of updates) {
        const query = `
          UPDATE electrical_analysis.component_cross_references
          SET distributor_info = $2
          WHERE id = $1
        `;

        const result = await client.query(query, [update.crossReferenceId, update.distributorInfo]);
        if ((result.rowCount ?? 0) > 0) {
          updatedCount++;
        }
      }

      await client.query('COMMIT');
      return updatedCount;

    } catch (error) {
      await client.query('ROLLBACK');
      throw new ComponentSpecificationError(
        `Failed to bulk update distributor info: ${error instanceof Error ? error.message : String(error)}`,
        { updates, error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get availability information for components
   */
  async getComponentAvailability(componentIds: string[]): Promise<{
    componentId: string;
    availability: AvailabilityInfo[];
    lastUpdated: Date;
  }[]> {
    if (componentIds.length === 0) {
      return [];
    }

    const client = await this.db.connect();
    try {
      const query = `
        SELECT component_id, availability_info, created_at
        FROM electrical_analysis.component_cross_references
        WHERE component_id = ANY($1) AND availability_info IS NOT NULL
        ORDER BY component_id, created_at DESC
      `;

      const result = await client.query(query, [componentIds]);

      const availabilityMap = new Map<string, {
        availability: AvailabilityInfo[];
        lastUpdated: Date;
      }>();

      result.rows.forEach(row => {
        const componentId = row.component_id;
        const availabilityInfo = row.availability_info;
        const createdAt = row.created_at;

        if (!availabilityMap.has(componentId)) {
          availabilityMap.set(componentId, {
            availability: [],
            lastUpdated: createdAt
          });
        }

        const existing = availabilityMap.get(componentId)!;
        existing.availability.push(availabilityInfo);
        
        if (createdAt > existing.lastUpdated) {
          existing.lastUpdated = createdAt;
        }
      });

      return Array.from(availabilityMap.entries()).map(([componentId, data]) => ({
        componentId,
        availability: data.availability,
        lastUpdated: data.lastUpdated
      }));

    } catch (error) {
      throw new ComponentSpecificationError(
        `Failed to get component availability: ${error instanceof Error ? error.message : String(error)}`,
        { componentIds, error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Find alternative/substitute components based on cross-references
   */
  async findAlternativeComponents(
    componentId: string,
    sameManufacturer = false
  ): Promise<{
    componentId: string;
    componentName: string;
    manufacturer: string;
    partNumber: string;
    similarity: number;
  }[]> {
    const client = await this.db.connect();
    try {
      // First, get the original component's cross-references
      const originalRefs = await this.getComponentCrossReferences(componentId);
      
      if (originalRefs.length === 0) {
        return [];
      }

      const originalManufacturers = originalRefs.map(ref => ref.manufacturer);
      
      let query = `
        SELECT DISTINCT ccr.component_id, cl.component_name, ccr.manufacturer, ccr.part_number,
               cl.symbol_type, cl.symbol_category
        FROM electrical_analysis.component_cross_references ccr
        JOIN electrical_analysis.component_library cl ON ccr.component_id = cl.id
        WHERE ccr.component_id != $1
      `;

      const params: any[] = [componentId];
      let paramIndex = 2;

      if (sameManufacturer) {
        query += ` AND ccr.manufacturer = ANY($${paramIndex})`;
        params.push(originalManufacturers);
        paramIndex++;
      }

      // Look for components with similar properties or in the same category
      query += `
        AND EXISTS (
          SELECT 1 FROM electrical_analysis.component_library orig
          WHERE orig.id = $1
          AND (
            cl.symbol_category = orig.symbol_category OR
            cl.symbol_type = orig.symbol_type
          )
        )
        ORDER BY cl.component_name
        LIMIT 20
      `;

      const result = await client.query(query, params);

      // Calculate similarity scores
      return result.rows.map(row => {
        let similarity = 0;
        
        // Base similarity for same category/type
        if (row.symbol_category === originalRefs[0]?.manufacturer) {
          similarity += 0.5;
        }
        
        // Additional similarity for same manufacturer
        if (originalManufacturers.includes(row.manufacturer)) {
          similarity += 0.3;
        }

        // Random component gets base score
        similarity += 0.2;

        return {
          componentId: row.component_id,
          componentName: row.component_name,
          manufacturer: row.manufacturer,
          partNumber: row.part_number,
          similarity: Math.min(1.0, similarity)
        };
      }).sort((a, b) => b.similarity - a.similarity);

    } catch (error) {
      throw new ComponentSpecificationError(
        `Failed to find alternative components: ${error instanceof Error ? error.message : String(error)}`,
        { componentId, sameManufacturer, error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get cross-reference statistics
   */
  async getCrossReferenceStatistics(): Promise<{
    totalCrossReferences: number;
    uniqueManufacturers: number;
    uniquePartNumbers: number;
    componentsWithCrossReferences: number;
    topManufacturers: { manufacturer: string; count: number }[];
  }> {
    const client = await this.db.connect();
    try {
      // Total cross-references
      const totalQuery = 'SELECT COUNT(*) as total FROM electrical_analysis.component_cross_references';
      const totalResult = await client.query(totalQuery);
      const totalCrossReferences = parseInt(totalResult.rows[0].total);

      // Unique manufacturers
      const manufacturersQuery = 'SELECT COUNT(DISTINCT manufacturer) as count FROM electrical_analysis.component_cross_references';
      const manufacturersResult = await client.query(manufacturersQuery);
      const uniqueManufacturers = parseInt(manufacturersResult.rows[0].count);

      // Unique part numbers
      const partNumbersQuery = 'SELECT COUNT(DISTINCT part_number) as count FROM electrical_analysis.component_cross_references';
      const partNumbersResult = await client.query(partNumbersQuery);
      const uniquePartNumbers = parseInt(partNumbersResult.rows[0].count);

      // Components with cross-references
      const componentsQuery = 'SELECT COUNT(DISTINCT component_id) as count FROM electrical_analysis.component_cross_references';
      const componentsResult = await client.query(componentsQuery);
      const componentsWithCrossReferences = parseInt(componentsResult.rows[0].count);

      // Top manufacturers
      const topManufacturersQuery = `
        SELECT manufacturer, COUNT(*) as count
        FROM electrical_analysis.component_cross_references
        GROUP BY manufacturer
        ORDER BY count DESC
        LIMIT 10
      `;
      const topManufacturersResult = await client.query(topManufacturersQuery);
      const topManufacturers = topManufacturersResult.rows.map(row => ({
        manufacturer: row.manufacturer,
        count: parseInt(row.count)
      }));

      return {
        totalCrossReferences,
        uniqueManufacturers,
        uniquePartNumbers,
        componentsWithCrossReferences,
        topManufacturers
      };

    } catch (error) {
      throw new ComponentSpecificationError(
        `Failed to get cross-reference statistics: ${error instanceof Error ? error.message : String(error)}`,
        { error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }
}