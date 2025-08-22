/**
 * Component Repository
 * 
 * Data access layer for component database operations with optimized queries
 * and database connection management.
 * 
 * Story: 4.2 Component Database Integration
 * Task: 4.2.1 Build Component Database Schema and Models
 */

import { Pool, PoolClient } from 'pg';
import { getErrorMessage } from '../utils/error-utils';
import {
  ComponentLibraryEntry,
  // ComponentSpecification, // Reserved for future use
  // ComponentProperty, // Reserved for future use
  // ComponentRating, // Reserved for future use
  // CrossReference, // Reserved for future use
  // ComponentIdentificationResult, // Reserved for future use
  ComponentLibraryError,
  ElectricalSymbolType,
  SymbolCategory,
  IndustryStandard,
  RatingType,
  IdentificationMethod
} from '../../../../shared/types/component-database.types';

export class ComponentRepository {
  private db: Pool;

  constructor(database: Pool) {
    this.db = database;
  }

  /**
   * Get component by ID with all related data
   */
  async findComponentById(componentId: string): Promise<ComponentLibraryEntry | null> {
    const client = await this.db.connect();
    try {
      const query = `
        SELECT 
          cl.id, cl.symbol_type, cl.symbol_category, cl.component_name,
          cl.component_description, cl.industry_standards, cl.symbol_pattern_data,
          cl.created_at, cl.updated_at, cl.version,
          -- Specifications
          cs.id as spec_id, cs.function_description, cs.technical_details,
          cs.operating_conditions, cs.certifications, cs.datasheet_url,
          cs.created_at as spec_created_at,
          -- Properties (aggregated)
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', cp.id,
                'propertyName', cp.property_name,
                'propertyValue', cp.property_value,
                'propertyUnit', cp.property_unit,
                'tolerance', cp.tolerance,
                'conditions', cp.conditions,
                'isSearchable', cp.is_searchable,
                'createdAt', cp.created_at
              )
            ) FILTER (WHERE cp.id IS NOT NULL), '[]'
          ) as properties,
          -- Ratings (aggregated)
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', cr.id,
                'ratingType', cr.rating_type,
                'minValue', cr.min_value,
                'maxValue', cr.max_value,
                'nominalValue', cr.nominal_value,
                'unit', cr.unit,
                'conditions', cr.conditions,
                'createdAt', cr.created_at
              )
            ) FILTER (WHERE cr.id IS NOT NULL), '[]'
          ) as ratings,
          -- Cross References (aggregated)
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', ccr.id,
                'partNumber', ccr.part_number,
                'manufacturer', ccr.manufacturer,
                'manufacturerPartNumber', ccr.manufacturer_part_number,
                'distributorInfo', ccr.distributor_info,
                'availabilityInfo', ccr.availability_info,
                'createdAt', ccr.created_at
              )
            ) FILTER (WHERE ccr.id IS NOT NULL), '[]'
          ) as cross_references
        FROM electrical_analysis.component_library cl
        LEFT JOIN electrical_analysis.component_specifications cs ON cl.id = cs.component_id
        LEFT JOIN electrical_analysis.component_properties cp ON cl.id = cp.component_id
        LEFT JOIN electrical_analysis.component_ratings cr ON cl.id = cr.component_id
        LEFT JOIN electrical_analysis.component_cross_references ccr ON cl.id = ccr.component_id
        WHERE cl.id = $1
        GROUP BY 
          cl.id, cl.symbol_type, cl.symbol_category, cl.component_name,
          cl.component_description, cl.industry_standards, cl.symbol_pattern_data,
          cl.created_at, cl.updated_at, cl.version,
          cs.id, cs.function_description, cs.technical_details,
          cs.operating_conditions, cs.certifications, cs.datasheet_url, cs.created_at
      `;

      const result = await client.query(query, [componentId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      
      const component: ComponentLibraryEntry = {
        id: row.id,
        symbolType: row.symbol_type as ElectricalSymbolType,
        symbolCategory: row.symbol_category as SymbolCategory,
        componentName: row.component_name,
        componentDescription: row.component_description,
        industryStandards: row.industry_standards as IndustryStandard[],
        specifications: row.spec_id ? {
          id: row.spec_id,
          componentId: row.id,
          functionDescription: row.function_description,
          technicalDetails: row.technical_details,
          operatingConditions: row.operating_conditions || undefined,
          certifications: row.certifications || undefined,
          datasheetUrl: row.datasheet_url || undefined,
          createdAt: row.spec_created_at
        } : undefined,
        properties: row.properties || [],
        ratings: row.ratings || [],
        crossReferences: row.cross_references || [],
        symbolPatternData: row.symbol_pattern_data || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        version: row.version
      };

      return component;

    } catch (error) {
      throw new ComponentLibraryError(
        `Failed to find component by ID: ${getErrorMessage(error)}`,
        { componentId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Create a new component with transaction support
   */
  async createComponent(data: {
    symbolType: ElectricalSymbolType;
    symbolCategory: SymbolCategory;
    componentName: string;
    componentDescription: string;
    industryStandards: IndustryStandard[];
    symbolPatternData?: Buffer;
  }): Promise<string> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO electrical_analysis.component_library 
        (symbol_type, symbol_category, component_name, component_description, 
         industry_standards, symbol_pattern_data)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;

      const result = await client.query(query, [
        data.symbolType,
        data.symbolCategory,
        data.componentName,
        data.componentDescription,
        data.industryStandards,
        data.symbolPatternData
      ]);

      await client.query('COMMIT');
      return result.rows[0].id;

    } catch (error) {
      await client.query('ROLLBACK');
      throw new ComponentLibraryError(
        `Failed to create component: ${getErrorMessage(error)}`,
        { data, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update component basic information
   */
  async updateComponent(
    componentId: string,
    updates: Partial<{
      componentName: string;
      componentDescription: string;
      industryStandards: IndustryStandard[];
      symbolPatternData: Buffer;
    }>
  ): Promise<boolean> {
    const client = await this.db.connect();
    try {
      const fields: string[] = [];
      const params: any[] = [componentId];
      let paramIndex = 2;

      if (updates.componentName !== undefined) {
        fields.push(`component_name = $${paramIndex++}`);
        params.push(updates.componentName);
      }

      if (updates.componentDescription !== undefined) {
        fields.push(`component_description = $${paramIndex++}`);
        params.push(updates.componentDescription);
      }

      if (updates.industryStandards !== undefined) {
        fields.push(`industry_standards = $${paramIndex++}`);
        params.push(updates.industryStandards);
      }

      if (updates.symbolPatternData !== undefined) {
        fields.push(`symbol_pattern_data = $${paramIndex++}`);
        params.push(updates.symbolPatternData);
      }

      if (fields.length === 0) {
        return true; // No updates to apply
      }

      fields.push('version = version + 1', 'updated_at = NOW()');

      const query = `
        UPDATE electrical_analysis.component_library
        SET ${fields.join(', ')}
        WHERE id = $1
      `;

      const result = await client.query(query, params);
      return result.rowCount > 0;

    } catch (error) {
      throw new ComponentLibraryError(
        `Failed to update component: ${getErrorMessage(error)}`,
        { componentId, updates, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Delete component and all related data
   */
  async deleteComponent(componentId: string): Promise<boolean> {
    const client = await this.db.connect();
    try {
      const query = `
        DELETE FROM electrical_analysis.component_library
        WHERE id = $1
      `;

      const result = await client.query(query, [componentId]);
      return result.rowCount > 0;

    } catch (error) {
      throw new ComponentLibraryError(
        `Failed to delete component: ${getErrorMessage(error)}`,
        { componentId, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Find components by symbol type and category
   */
  async findComponentsBySymbol(
    symbolType: ElectricalSymbolType,
    symbolCategory?: SymbolCategory,
    limit = 50,
    offset = 0
  ): Promise<ComponentLibraryEntry[]> {
    const client = await this.db.connect();
    try {
      let query = `
        SELECT id, symbol_type, symbol_category, component_name,
               component_description, industry_standards, created_at, updated_at, version
        FROM electrical_analysis.component_library
        WHERE symbol_type = $1
      `;

      const params: any[] = [symbolType];

      if (symbolCategory) {
        query += ` AND symbol_category = $2`;
        params.push(symbolCategory);
        query += ` ORDER BY component_name LIMIT $3 OFFSET $4`;
        params.push(limit, offset);
      } else {
        query += ` ORDER BY component_name LIMIT $2 OFFSET $3`;
        params.push(limit, offset);
      }

      const result = await client.query(query, params);

      // Get full component data for each result
      const components: ComponentLibraryEntry[] = [];
      for (const row of result.rows) {
        const component = await this.findComponentById(row.id);
        if (component) {
          components.push(component);
        }
      }

      return components;

    } catch (error) {
      throw new ComponentLibraryError(
        `Failed to find components by symbol: ${getErrorMessage(error)}`,
        { symbolType, symbolCategory, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Search components with text-based filters
   */
  async searchComponents(
    searchQuery?: string,
    symbolType?: ElectricalSymbolType,
    symbolCategory?: SymbolCategory,
    industryStandards?: IndustryStandard[],
    limit = 50,
    offset = 0
  ): Promise<{ components: ComponentLibraryEntry[]; totalCount: number }> {
    const client = await this.db.connect();
    try {
      let baseQuery = `
        FROM electrical_analysis.component_library cl
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      // Apply filters
      if (searchQuery) {
        baseQuery += ` AND (
          cl.component_name ILIKE $${paramIndex} OR
          cl.component_description ILIKE $${paramIndex} OR
          to_tsvector('english', cl.component_description) @@ plainto_tsquery('english', $${paramIndex})
        )`;
        params.push(`%${searchQuery}%`);
        paramIndex++;
      }

      if (symbolType) {
        baseQuery += ` AND cl.symbol_type = $${paramIndex}`;
        params.push(symbolType);
        paramIndex++;
      }

      if (symbolCategory) {
        baseQuery += ` AND cl.symbol_category = $${paramIndex}`;
        params.push(symbolCategory);
        paramIndex++;
      }

      if (industryStandards && industryStandards.length > 0) {
        baseQuery += ` AND cl.industry_standards && $${paramIndex}`;
        params.push(industryStandards);
        paramIndex++;
      }

      // Count query
      const countQuery = `SELECT COUNT(*) as total ${baseQuery}`;
      const countResult = await client.query(countQuery, params);
      const totalCount = parseInt(countResult.rows[0].total);

      // Data query
      const dataQuery = `
        SELECT cl.id, cl.symbol_type, cl.symbol_category, cl.component_name,
               cl.component_description, cl.industry_standards, cl.created_at, 
               cl.updated_at, cl.version
        ${baseQuery}
        ORDER BY cl.component_name
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);
      const dataResult = await client.query(dataQuery, params);

      // Get full component data for each result
      const components: ComponentLibraryEntry[] = [];
      for (const row of dataResult.rows) {
        const component = await this.findComponentById(row.id);
        if (component) {
          components.push(component);
        }
      }

      return { components, totalCount };

    } catch (error) {
      throw new ComponentLibraryError(
        `Failed to search components: ${getErrorMessage(error)}`,
        { searchQuery, symbolType, symbolCategory, industryStandards, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Create component specification
   */
  async createSpecification(data: {
    componentId: string;
    functionDescription: string;
    technicalDetails: string;
    operatingConditions?: any;
    certifications?: string[];
    datasheetUrl?: string;
  }): Promise<string> {
    const client = await this.db.connect();
    try {
      const query = `
        INSERT INTO electrical_analysis.component_specifications
        (component_id, function_description, technical_details, operating_conditions,
         certifications, datasheet_url)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;

      const result = await client.query(query, [
        data.componentId,
        data.functionDescription,
        data.technicalDetails,
        data.operatingConditions,
        data.certifications,
        data.datasheetUrl
      ]);

      return result.rows[0].id;

    } catch (error) {
      throw new ComponentLibraryError(
        `Failed to create specification: ${getErrorMessage(error)}`,
        { data, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Create component property
   */
  async createProperty(data: {
    componentId: string;
    propertyName: string;
    propertyValue: string;
    propertyUnit?: string;
    tolerance?: string;
    conditions?: string;
    isSearchable?: boolean;
  }): Promise<string> {
    const client = await this.db.connect();
    try {
      const query = `
        INSERT INTO electrical_analysis.component_properties
        (component_id, property_name, property_value, property_unit, tolerance, conditions, is_searchable)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;

      const result = await client.query(query, [
        data.componentId,
        data.propertyName,
        data.propertyValue,
        data.propertyUnit,
        data.tolerance,
        data.conditions,
        data.isSearchable ?? true
      ]);

      return result.rows[0].id;

    } catch (error) {
      throw new ComponentLibraryError(
        `Failed to create property: ${getErrorMessage(error)}`,
        { data, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Create component rating
   */
  async createRating(data: {
    componentId: string;
    ratingType: RatingType;
    minValue?: number;
    maxValue?: number;
    nominalValue?: number;
    unit: string;
    conditions?: string;
  }): Promise<string> {
    const client = await this.db.connect();
    try {
      const query = `
        INSERT INTO electrical_analysis.component_ratings
        (component_id, rating_type, min_value, max_value, nominal_value, unit, conditions)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;

      const result = await client.query(query, [
        data.componentId,
        data.ratingType,
        data.minValue,
        data.maxValue,
        data.nominalValue,
        data.unit,
        data.conditions
      ]);

      return result.rows[0].id;

    } catch (error) {
      throw new ComponentLibraryError(
        `Failed to create rating: ${getErrorMessage(error)}`,
        { data, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Create cross reference
   */
  async createCrossReference(data: {
    componentId: string;
    partNumber: string;
    manufacturer: string;
    manufacturerPartNumber?: string;
    distributorInfo?: any;
    availabilityInfo?: any;
  }): Promise<string> {
    const client = await this.db.connect();
    try {
      const query = `
        INSERT INTO electrical_analysis.component_cross_references
        (component_id, part_number, manufacturer, manufacturer_part_number, distributor_info, availability_info)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;

      const result = await client.query(query, [
        data.componentId,
        data.partNumber,
        data.manufacturer,
        data.manufacturerPartNumber,
        data.distributorInfo,
        data.availabilityInfo
      ]);

      return result.rows[0].id;

    } catch (error) {
      throw new ComponentLibraryError(
        `Failed to create cross reference: ${getErrorMessage(error)}`,
        { data, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Create component identification result
   */
  async createIdentificationResult(data: {
    detectedSymbolId: string;
    componentId: string;
    identificationMethod: IdentificationMethod;
    confidence: number;
    matchDetails: any;
    alternativeMatches: any[];
  }): Promise<string> {
    const client = await this.db.connect();
    try {
      const query = `
        INSERT INTO electrical_analysis.component_identifications
        (detected_symbol_id, component_id, identification_method, confidence,
         match_details, alternative_matches)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;

      const result = await client.query(query, [
        data.detectedSymbolId,
        data.componentId,
        data.identificationMethod,
        data.confidence,
        data.matchDetails,
        data.alternativeMatches
      ]);

      return result.rows[0].id;

    } catch (error) {
      throw new ComponentLibraryError(
        `Failed to create identification result: ${getErrorMessage(error)}`,
        { data, error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get component library statistics
   */
  async getStatistics(): Promise<{
    totalComponents: number;
    componentsByCategory: Record<string, number>;
    componentsByType: Record<string, number>;
    componentsWithSpecs: number;
  }> {
    const client = await this.db.connect();
    try {
      // Total components
      const totalQuery = 'SELECT COUNT(*) as total FROM electrical_analysis.component_library';
      const totalResult = await client.query(totalQuery);
      const totalComponents = parseInt(totalResult.rows[0].total);

      // By category
      const categoryQuery = `
        SELECT symbol_category, COUNT(*) as count
        FROM electrical_analysis.component_library
        GROUP BY symbol_category
      `;
      const categoryResult = await client.query(categoryQuery);
      const componentsByCategory: Record<string, number> = {};
      categoryResult.rows.forEach(row => {
        componentsByCategory[row.symbol_category] = parseInt(row.count);
      });

      // By type
      const typeQuery = `
        SELECT symbol_type, COUNT(*) as count
        FROM electrical_analysis.component_library
        GROUP BY symbol_type
      `;
      const typeResult = await client.query(typeQuery);
      const componentsByType: Record<string, number> = {};
      typeResult.rows.forEach(row => {
        componentsByType[row.symbol_type] = parseInt(row.count);
      });

      // Components with specifications
      const specsQuery = `
        SELECT COUNT(DISTINCT cl.id) as count
        FROM electrical_analysis.component_library cl
        JOIN electrical_analysis.component_specifications cs ON cl.id = cs.component_id
      `;
      const specsResult = await client.query(specsQuery);
      const componentsWithSpecs = parseInt(specsResult.rows[0].count);

      return {
        totalComponents,
        componentsByCategory,
        componentsByType,
        componentsWithSpecs
      };

    } catch (error) {
      throw new ComponentLibraryError(
        `Failed to get statistics: ${getErrorMessage(error)}`,
        { error: getErrorMessage(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get components by session for export
   */
  async getComponentsBySession(sessionId: string, documentIds?: string[]): Promise<any[]> {
    try {
      let query = `
        SELECT 
          ci.id,
          ci.symbol_id,
          ci.component_library_id,
          ci.component_name as description,
          ci.specifications,
          ci.part_information,
          ci.related_components,
          ci.confidence_score
        FROM electrical_analysis.component_identifications ci
        WHERE ci.session_id = $1
      `;

      const params: any[] = [sessionId];

      if (documentIds && documentIds.length > 0) {
        query += ` AND ci.document_id = ANY($2)`;
        params.push(documentIds);
      }

      const result = await this.db.query(query, params);

      return result.rows.map(row => ({
        symbolId: row.symbol_id,
        description: row.description,
        specifications: row.specifications,
        partInformation: row.part_information,
        relatedComponents: row.related_components,
        confidence: row.confidence_score
      }));
    } catch (error) {
      throw new ComponentLibraryError(
        'Failed to get components by session',
        'DATABASE_FETCH_ERROR',
        { originalError: error, sessionId }
      );
    }
  }

  /**
   * Execute within transaction
   */
  async executeInTransaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}