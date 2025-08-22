/**
 * Component Specification Service
 * 
 * Handles retrieval and management of detailed component specifications,
 * technical details, and operating conditions.
 * 
 * Story: 4.2 Component Database Integration
 * Task: 4.2.2 Implement Component Specification Engine
 */

import { Pool } from 'pg';
import {
  ComponentSpecification,
  ComponentProperty,
  ComponentRating,
  ComponentSpecificationError,
  OperatingConditions,
  RatingType
} from '../../../../shared/types/component-database.types';
import { getErrorMessage } from '../utils/error-utils';

export class ComponentSpecificationService {
  private db: Pool;
  private specificationCache: Map<string, { data: ComponentSpecification; timestamp: number }>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(database: Pool) {
    this.db = database;
    this.specificationCache = new Map();
  }

  /**
   * Get detailed specifications for a component
   */
  async getSpecifications(componentId: string): Promise<ComponentSpecification | null> {
    // Check cache first
    const cached = this.specificationCache.get(componentId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const client = await this.db.connect();
    try {
      const query = `
        SELECT id, component_id, function_description, technical_details,
               operating_conditions, certifications, datasheet_url, created_at
        FROM electrical_analysis.component_specifications
        WHERE component_id = $1
      `;

      const result = await client.query(query, [componentId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const specification: ComponentSpecification = {
        id: row.id,
        componentId: row.component_id,
        functionDescription: row.function_description,
        technicalDetails: row.technical_details,
        operatingConditions: row.operating_conditions,
        certifications: row.certifications,
        datasheetUrl: row.datasheet_url,
        createdAt: row.created_at
      };

      // Cache the result
      this.specificationCache.set(componentId, {
        data: specification,
        timestamp: Date.now()
      });

      return specification;

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new ComponentSpecificationError(
        `Failed to get specifications: ${errorMessage}`,
        { componentId, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get component properties with optional filtering
   */
  async getComponentProperties(
    componentId: string, 
    searchableOnly = false,
    propertyNames?: string[]
  ): Promise<ComponentProperty[]> {
    const client = await this.db.connect();
    try {
      let query = `
        SELECT id, component_id, property_name, property_value, property_unit,
               tolerance, conditions, is_searchable, created_at
        FROM electrical_analysis.component_properties
        WHERE component_id = $1
      `;

      const params: any[] = [componentId];
      let paramIndex = 2;

      if (searchableOnly) {
        query += ` AND is_searchable = true`;
      }

      if (propertyNames && propertyNames.length > 0) {
        query += ` AND property_name = ANY($${paramIndex})`;
        params.push(propertyNames);
        paramIndex++;
      }

      query += ` ORDER BY property_name`;

      const result = await client.query(query, params);

      return result.rows.map(row => ({
        id: row.id,
        componentId: row.component_id,
        propertyName: row.property_name,
        propertyValue: row.property_value,
        propertyUnit: row.property_unit,
        tolerance: row.tolerance,
        conditions: row.conditions,
        isSearchable: row.is_searchable,
        createdAt: row.created_at
      }));

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new ComponentSpecificationError(
        `Failed to get component properties: ${errorMessage}`,
        { componentId, searchableOnly, propertyNames, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get component ratings with optional filtering by rating type
   */
  async getComponentRatings(
    componentId: string,
    ratingTypes?: RatingType[]
  ): Promise<ComponentRating[]> {
    const client = await this.db.connect();
    try {
      let query = `
        SELECT id, component_id, rating_type, min_value, max_value,
               nominal_value, unit, conditions, created_at
        FROM electrical_analysis.component_ratings
        WHERE component_id = $1
      `;

      const params: any[] = [componentId];

      if (ratingTypes && ratingTypes.length > 0) {
        query += ` AND rating_type = ANY($2)`;
        params.push(ratingTypes);
      }

      query += ` ORDER BY rating_type`;

      const result = await client.query(query, params);

      return result.rows.map(row => ({
        id: row.id,
        componentId: row.component_id,
        ratingType: row.rating_type,
        minValue: row.min_value,
        maxValue: row.max_value,
        nominalValue: row.nominal_value,
        unit: row.unit,
        conditions: row.conditions,
        createdAt: row.created_at
      }));

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new ComponentSpecificationError(
        `Failed to get component ratings: ${errorMessage}`,
        { componentId, ratingTypes, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update component specifications
   */
  async updateSpecifications(
    componentId: string,
    updates: Partial<Omit<ComponentSpecification, 'id' | 'componentId' | 'createdAt'>>
  ): Promise<ComponentSpecification> {
    const client = await this.db.connect();
    try {
      // Check if specification exists
      const existingSpec = await this.getSpecifications(componentId);
      
      if (!existingSpec) {
        // Create new specification
        const insertQuery = `
          INSERT INTO electrical_analysis.component_specifications
          (component_id, function_description, technical_details, operating_conditions,
           certifications, datasheet_url)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, created_at
        `;

        const insertResult = await client.query(insertQuery, [
          componentId,
          updates.functionDescription || '',
          updates.technicalDetails || '',
          updates.operatingConditions || {},
          updates.certifications || [],
          updates.datasheetUrl || null
        ]);

        const newSpec: ComponentSpecification = {
          id: insertResult.rows[0].id,
          componentId,
          functionDescription: updates.functionDescription || '',
          technicalDetails: updates.technicalDetails || '',
          operatingConditions: updates.operatingConditions || undefined,
          certifications: updates.certifications || undefined,
          datasheetUrl: updates.datasheetUrl || undefined,
          createdAt: insertResult.rows[0].created_at
        };

        // Clear cache
        this.specificationCache.delete(componentId);

        return newSpec;
      }

      // Update existing specification
      const fields: string[] = [];
      const params: any[] = [existingSpec.id];
      let paramIndex = 2;

      if (updates.functionDescription !== undefined) {
        fields.push(`function_description = $${paramIndex++}`);
        params.push(updates.functionDescription);
      }

      if (updates.technicalDetails !== undefined) {
        fields.push(`technical_details = $${paramIndex++}`);
        params.push(updates.technicalDetails);
      }

      if (updates.operatingConditions !== undefined) {
        fields.push(`operating_conditions = $${paramIndex++}`);
        params.push(updates.operatingConditions);
      }

      if (updates.certifications !== undefined) {
        fields.push(`certifications = $${paramIndex++}`);
        params.push(updates.certifications);
      }

      if (updates.datasheetUrl !== undefined) {
        fields.push(`datasheet_url = $${paramIndex++}`);
        params.push(updates.datasheetUrl);
      }

      if (fields.length === 0) {
        return existingSpec; // No updates to apply
      }

      const updateQuery = `
        UPDATE electrical_analysis.component_specifications
        SET ${fields.join(', ')}
        WHERE id = $1
      `;

      await client.query(updateQuery, params);

      // Clear cache and return updated specification
      this.specificationCache.delete(componentId);
      const updatedSpec = await this.getSpecifications(componentId);
      
      if (!updatedSpec) {
        throw new ComponentSpecificationError('Failed to retrieve updated specification');
      }

      return updatedSpec;

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new ComponentSpecificationError(
        `Failed to update specifications: ${errorMessage}`,
        { componentId, updates, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Add or update a component property
   */
  async upsertProperty(
    componentId: string,
    propertyName: string,
    propertyValue: string,
    propertyUnit?: string,
    tolerance?: string,
    conditions?: string,
    isSearchable = true
  ): Promise<ComponentProperty> {
    const client = await this.db.connect();
    try {
      // Check if property exists
      const existingQuery = `
        SELECT id FROM electrical_analysis.component_properties
        WHERE component_id = $1 AND property_name = $2
      `;

      const existingResult = await client.query(existingQuery, [componentId, propertyName]);

      if (existingResult.rows.length > 0) {
        // Update existing property
        const updateQuery = `
          UPDATE electrical_analysis.component_properties
          SET property_value = $3, property_unit = $4, tolerance = $5,
              conditions = $6, is_searchable = $7
          WHERE id = $1
          RETURNING id, component_id, property_name, property_value, property_unit,
                    tolerance, conditions, is_searchable, created_at
        `;

        const updateResult = await client.query(updateQuery, [
          existingResult.rows[0].id,
          componentId,
          propertyValue,
          propertyUnit,
          tolerance,
          conditions,
          isSearchable
        ]);

        return updateResult.rows[0];
      } else {
        // Insert new property
        const insertQuery = `
          INSERT INTO electrical_analysis.component_properties
          (component_id, property_name, property_value, property_unit, tolerance, conditions, is_searchable)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, component_id, property_name, property_value, property_unit,
                    tolerance, conditions, is_searchable, created_at
        `;

        const insertResult = await client.query(insertQuery, [
          componentId,
          propertyName,
          propertyValue,
          propertyUnit,
          tolerance,
          conditions,
          isSearchable
        ]);

        return insertResult.rows[0];
      }

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new ComponentSpecificationError(
        `Failed to upsert property: ${errorMessage}`,
        { componentId, propertyName, propertyValue, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Add or update a component rating
   */
  async upsertRating(
    componentId: string,
    ratingType: RatingType,
    unit: string,
    nominalValue?: number,
    minValue?: number,
    maxValue?: number,
    conditions?: string
  ): Promise<ComponentRating> {
    const client = await this.db.connect();
    try {
      // Check if rating exists
      const existingQuery = `
        SELECT id FROM electrical_analysis.component_ratings
        WHERE component_id = $1 AND rating_type = $2
      `;

      const existingResult = await client.query(existingQuery, [componentId, ratingType]);

      if (existingResult.rows.length > 0) {
        // Update existing rating
        const updateQuery = `
          UPDATE electrical_analysis.component_ratings
          SET min_value = $3, max_value = $4, nominal_value = $5, unit = $6, conditions = $7
          WHERE id = $1
          RETURNING id, component_id, rating_type, min_value, max_value,
                    nominal_value, unit, conditions, created_at
        `;

        const updateResult = await client.query(updateQuery, [
          existingResult.rows[0].id,
          componentId,
          minValue,
          maxValue,
          nominalValue,
          unit,
          conditions
        ]);

        return updateResult.rows[0];
      } else {
        // Insert new rating
        const insertQuery = `
          INSERT INTO electrical_analysis.component_ratings
          (component_id, rating_type, min_value, max_value, nominal_value, unit, conditions)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, component_id, rating_type, min_value, max_value,
                    nominal_value, unit, conditions, created_at
        `;

        const insertResult = await client.query(insertQuery, [
          componentId,
          ratingType,
          minValue,
          maxValue,
          nominalValue,
          unit,
          conditions
        ]);

        return insertResult.rows[0];
      }

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new ComponentSpecificationError(
        `Failed to upsert rating: ${errorMessage}`,
        { componentId, ratingType, unit, error: errorMessage }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Validate operating conditions against component ratings
   */
  async validateOperatingConditions(
    componentId: string,
    operatingConditions: OperatingConditions
  ): Promise<{
    isValid: boolean;
    violations: string[];
    warnings: string[];
  }> {
    try {
      const ratings = await this.getComponentRatings(componentId);
      const violations: string[] = [];
      const warnings: string[] = [];

      // Check temperature range
      if (operatingConditions.temperatureRange) {
        const tempRating = ratings.find(r => r.ratingType === 'temperature');
        if (tempRating && tempRating.maxValue) {
          const opTempMax = operatingConditions.temperatureRange.max;
          if (opTempMax > tempRating.maxValue) {
            violations.push(
              `Operating temperature ${opTempMax}°C exceeds maximum rating ${tempRating.maxValue}°C`
            );
          } else if (opTempMax > tempRating.maxValue * 0.8) {
            warnings.push(
              `Operating temperature ${opTempMax}°C is close to maximum rating ${tempRating.maxValue}°C`
            );
          }
        }
      }

      // Check voltage range
      if (operatingConditions.voltageRange) {
        const voltageRating = ratings.find(r => r.ratingType === 'voltage');
        if (voltageRating && voltageRating.maxValue) {
          const opVoltageMax = operatingConditions.voltageRange.max;
          if (opVoltageMax > voltageRating.maxValue) {
            violations.push(
              `Operating voltage ${opVoltageMax}V exceeds maximum rating ${voltageRating.maxValue}V`
            );
          } else if (opVoltageMax > voltageRating.maxValue * 0.9) {
            warnings.push(
              `Operating voltage ${opVoltageMax}V is close to maximum rating ${voltageRating.maxValue}V`
            );
          }
        }
      }

      return {
        isValid: violations.length === 0,
        violations,
        warnings
      };

    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new ComponentSpecificationError(
        `Failed to validate operating conditions: ${errorMessage}`,
        { componentId, operatingConditions, error: errorMessage }
      );
    }
  }

  /**
   * Clear specification cache
   */
  clearCache(componentId?: string): void {
    if (componentId) {
      this.specificationCache.delete(componentId);
    } else {
      this.specificationCache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate?: number } {
    return {
      size: this.specificationCache.size
    };
  }
}