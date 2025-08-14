/**
 * Component Library Service
 * 
 * Manages electrical component library operations including CRUD operations,
 * search functionality, and component data management.
 * 
 * Story: 4.2 Component Database Integration
 * Task: 4.2.2 Implement Component Specification Engine
 */

import { Pool } from 'pg';
import {
  ComponentLibraryEntry,
  // ComponentSpecification, // Used in types but not directly referenced
  // ComponentProperty, // Used in types but not directly referenced
  // ComponentRating, // Used in types but not directly referenced
  // CrossReference, // Used in types but not directly referenced
  ComponentLibraryCreateRequest,
  ComponentLibraryUpdateRequest,
  ComponentSearchRequest,
  ComponentSearchResponse,
  ComponentLibraryError,
  IndustryStandard,
  ElectricalSymbolType,
  SymbolCategory
} from '../../../../shared/types/component-database.types';

export class ComponentLibraryService {
  private db: Pool;

  constructor(database: Pool) {
    this.db = database;
  }

  /**
   * Get a component by ID with all related data
   */
  async getComponentById(componentId: string): Promise<ComponentLibraryEntry | null> {
    const client = await this.db.connect();
    try {
      // Get main component data
      const componentQuery = `
        SELECT 
          cl.id, cl.symbol_type, cl.symbol_category, cl.component_name,
          cl.component_description, cl.industry_standards, cl.symbol_pattern_data,
          cl.created_at, cl.updated_at, cl.version
        FROM electrical_analysis.component_library cl
        WHERE cl.id = $1
      `;
      
      const componentResult = await client.query(componentQuery, [componentId]);
      
      if (componentResult.rows.length === 0) {
        return null;
      }

      const component = componentResult.rows[0];

      // Get specifications
      const specificationsQuery = `
        SELECT id, function_description, technical_details, operating_conditions,
               certifications, datasheet_url, created_at
        FROM electrical_analysis.component_specifications
        WHERE component_id = $1
      `;
      
      const specsResult = await client.query(specificationsQuery, [componentId]);
      const specifications = specsResult.rows[0] || null;

      // Get properties
      const propertiesQuery = `
        SELECT id, property_name, property_value, property_unit,
               tolerance, conditions, is_searchable, created_at
        FROM electrical_analysis.component_properties
        WHERE component_id = $1
        ORDER BY property_name
      `;
      
      const propertiesResult = await client.query(propertiesQuery, [componentId]);

      // Get ratings
      const ratingsQuery = `
        SELECT id, rating_type, min_value, max_value, nominal_value,
               unit, conditions, created_at
        FROM electrical_analysis.component_ratings
        WHERE component_id = $1
        ORDER BY rating_type
      `;
      
      const ratingsResult = await client.query(ratingsQuery, [componentId]);

      // Get cross references
      const crossRefsQuery = `
        SELECT id, part_number, manufacturer, manufacturer_part_number,
               distributor_info, availability_info, created_at
        FROM electrical_analysis.component_cross_references
        WHERE component_id = $1
        ORDER BY manufacturer, part_number
      `;
      
      const crossRefsResult = await client.query(crossRefsQuery, [componentId]);

      const libraryEntry: ComponentLibraryEntry = {
        id: component.id,
        symbolType: component.symbol_type as ElectricalSymbolType,
        symbolCategory: component.symbol_category as SymbolCategory,
        componentName: component.component_name,
        componentDescription: component.component_description,
        industryStandards: component.industry_standards as IndustryStandard[],
        ...(specifications && {
          specifications: {
            id: specifications.id,
            componentId: componentId,
            functionDescription: specifications.function_description,
            technicalDetails: specifications.technical_details,
            operatingConditions: specifications.operating_conditions,
            certifications: specifications.certifications,
            datasheetUrl: specifications.datasheet_url,
            createdAt: specifications.created_at
          }
        }),
        properties: propertiesResult.rows.map(row => ({
          id: row.id,
          componentId: componentId,
          propertyName: row.property_name,
          propertyValue: row.property_value,
          propertyUnit: row.property_unit,
          tolerance: row.tolerance,
          conditions: row.conditions,
          isSearchable: row.is_searchable,
          createdAt: row.created_at
        })),
        ratings: ratingsResult.rows.map(row => ({
          id: row.id,
          componentId: componentId,
          ratingType: row.rating_type,
          minValue: row.min_value,
          maxValue: row.max_value,
          nominalValue: row.nominal_value,
          unit: row.unit,
          conditions: row.conditions,
          createdAt: row.created_at
        })),
        crossReferences: crossRefsResult.rows.map(row => ({
          id: row.id,
          componentId: componentId,
          partNumber: row.part_number,
          manufacturer: row.manufacturer,
          manufacturerPartNumber: row.manufacturer_part_number,
          distributorInfo: row.distributor_info,
          availabilityInfo: row.availability_info,
          createdAt: row.created_at
        })),
        symbolPatternData: component.symbol_pattern_data,
        createdAt: component.created_at,
        updatedAt: component.updated_at,
        version: component.version
      };

      return libraryEntry;

    } catch (error) {
      throw new ComponentLibraryError(
        `Failed to get component by ID: ${error instanceof Error ? error.message : String(error)}`,
        { componentId, error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Search components with filters and pagination
   */
  async searchComponents(request: ComponentSearchRequest): Promise<ComponentSearchResponse> {
    const startTime = Date.now();
    const client = await this.db.connect();
    
    try {
      const {
        query,
        symbolType,
        symbolCategory,
        industryStandards,
        properties,
        // ratings, // Not used in current implementation
        manufacturer,
        limit = 50,
        offset = 0
      } = request;

      let whereClause = '1=1';
      const queryParams: any[] = [];
      let paramIndex = 1;

      // Build where clause based on filters
      if (query) {
        whereClause += ` AND (
          cl.component_name ILIKE $${paramIndex} OR
          cl.component_description ILIKE $${paramIndex} OR
          to_tsvector('english', cl.component_description) @@ plainto_tsquery('english', $${paramIndex})
        )`;
        queryParams.push(`%${query}%`);
        paramIndex++;
      }

      if (symbolType) {
        whereClause += ` AND cl.symbol_type = $${paramIndex}`;
        queryParams.push(symbolType);
        paramIndex++;
      }

      if (symbolCategory) {
        whereClause += ` AND cl.symbol_category = $${paramIndex}`;
        queryParams.push(symbolCategory);
        paramIndex++;
      }

      if (industryStandards && industryStandards.length > 0) {
        whereClause += ` AND cl.industry_standards && $${paramIndex}`;
        queryParams.push(industryStandards);
        paramIndex++;
      }

      // Handle property filters
      if (properties && properties.length > 0) {
        const propertyConditions = properties.map((prop, index) => {
          const propParamIndex = paramIndex + index * 2;
          const valueParamIndex = propParamIndex + 1;
          
          let condition = `EXISTS (
            SELECT 1 FROM electrical_analysis.component_properties cp 
            WHERE cp.component_id = cl.id 
            AND cp.property_name = $${propParamIndex}
          `;

          switch (prop.operator) {
            case 'equals':
              condition += ` AND cp.property_value = $${valueParamIndex}`;
              break;
            case 'contains':
              condition += ` AND cp.property_value ILIKE $${valueParamIndex}`;
              break;
            case 'greater_than':
              condition += ` AND CAST(cp.property_value AS NUMERIC) > $${valueParamIndex}`;
              break;
            case 'less_than':
              condition += ` AND CAST(cp.property_value AS NUMERIC) < $${valueParamIndex}`;
              break;
            case 'between':
              condition += ` AND CAST(cp.property_value AS NUMERIC) BETWEEN $${valueParamIndex} AND $${valueParamIndex + 1}`;
              break;
          }
          condition += ')';
          return condition;
        });

        whereClause += ` AND (${propertyConditions.join(' AND ')})`;
        
        properties.forEach(prop => {
          queryParams.push(prop.propertyName);
          if (prop.operator === 'contains') {
            queryParams.push(`%${prop.value}%`);
          } else {
            queryParams.push(prop.value);
          }
          if (prop.operator === 'between' && prop.secondValue !== undefined) {
            queryParams.push(prop.secondValue);
          }
        });
        
        paramIndex += properties.length * 2;
      }

      // Handle manufacturer filter
      if (manufacturer) {
        whereClause += ` AND EXISTS (
          SELECT 1 FROM electrical_analysis.component_cross_references ccr
          WHERE ccr.component_id = cl.id AND ccr.manufacturer ILIKE $${paramIndex}
        )`;
        queryParams.push(`%${manufacturer}%`);
        paramIndex++;
      }

      // Count query for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM electrical_analysis.component_library cl
        WHERE ${whereClause}
      `;

      const countResult = await client.query(countQuery, queryParams);
      const totalCount = parseInt(countResult.rows[0].total);

      // Main search query
      const searchQuery = `
        SELECT 
          cl.id, cl.symbol_type, cl.symbol_category, cl.component_name,
          cl.component_description, cl.industry_standards, cl.symbol_pattern_data,
          cl.created_at, cl.updated_at, cl.version
        FROM electrical_analysis.component_library cl
        WHERE ${whereClause}
        ORDER BY cl.component_name
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, offset);
      const searchResult = await client.query(searchQuery, queryParams);

      // Get related data for each component
      const components: ComponentLibraryEntry[] = [];
      
      for (const row of searchResult.rows) {
        const componentData = await this.getComponentById(row.id);
        if (componentData) {
          components.push(componentData);
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        components,
        totalCount,
        hasMore: offset + limit < totalCount,
        processingTimeMs: processingTime
      };

    } catch (error) {
      throw new ComponentLibraryError(
        `Failed to search components: ${error instanceof Error ? error.message : String(error)}`,
        { request, error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Create a new component in the library
   */
  async createComponent(request: ComponentLibraryCreateRequest): Promise<ComponentLibraryEntry> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Insert main component record
      const componentQuery = `
        INSERT INTO electrical_analysis.component_library 
        (symbol_type, symbol_category, component_name, component_description, 
         industry_standards, symbol_pattern_data)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at, updated_at, version
      `;

      const componentResult = await client.query(componentQuery, [
        request.symbolType,
        request.symbolCategory,
        request.componentName,
        request.componentDescription,
        request.industryStandards,
        request.symbolPatternData
      ]);

      const componentId = componentResult.rows[0].id;

      // Insert specifications if provided
      if (request.specifications) {
        const specsQuery = `
          INSERT INTO electrical_analysis.component_specifications
          (component_id, function_description, technical_details, operating_conditions,
           certifications, datasheet_url)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;

        await client.query(specsQuery, [
          componentId,
          request.specifications.functionDescription,
          request.specifications.technicalDetails,
          request.specifications.operatingConditions,
          request.specifications.certifications,
          request.specifications.datasheetUrl
        ]);
      }

      // Insert properties
      if (request.properties && request.properties.length > 0) {
        const propertyValues = request.properties.map((_prop, index) => {
          const baseIndex = index * 7 + 1;
          return `($${baseIndex}, $${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`;
        }).join(', ');

        const propertiesQuery = `
          INSERT INTO electrical_analysis.component_properties
          (component_id, property_name, property_value, property_unit, tolerance, conditions, is_searchable)
          VALUES ${propertyValues}
        `;

        const propertyParams: any[] = [];
        request.properties.forEach(prop => {
          propertyParams.push(
            componentId,
            prop.propertyName,
            prop.propertyValue,
            prop.propertyUnit,
            prop.tolerance,
            prop.conditions,
            prop.isSearchable
          );
        });

        await client.query(propertiesQuery, propertyParams);
      }

      // Insert ratings
      if (request.ratings && request.ratings.length > 0) {
        const ratingValues = request.ratings.map((_rating, index) => {
          const baseIndex = index * 7 + 1;
          return `($${baseIndex}, $${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`;
        }).join(', ');

        const ratingsQuery = `
          INSERT INTO electrical_analysis.component_ratings
          (component_id, rating_type, min_value, max_value, nominal_value, unit, conditions)
          VALUES ${ratingValues}
        `;

        const ratingParams: any[] = [];
        request.ratings.forEach(rating => {
          ratingParams.push(
            componentId,
            rating.ratingType,
            rating.minValue,
            rating.maxValue,
            rating.nominalValue,
            rating.unit,
            rating.conditions
          );
        });

        await client.query(ratingsQuery, ratingParams);
      }

      // Insert cross references if provided
      if (request.crossReferences && request.crossReferences.length > 0) {
        const crossRefValues = request.crossReferences.map((_ref, index) => {
          const baseIndex = index * 6 + 1;
          return `($${baseIndex}, $${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`;
        }).join(', ');

        const crossRefsQuery = `
          INSERT INTO electrical_analysis.component_cross_references
          (component_id, part_number, manufacturer, manufacturer_part_number, distributor_info, availability_info)
          VALUES ${crossRefValues}
        `;

        const crossRefParams: any[] = [];
        request.crossReferences.forEach(ref => {
          crossRefParams.push(
            componentId,
            ref.partNumber,
            ref.manufacturer,
            ref.manufacturerPartNumber,
            ref.distributorInfo,
            ref.availabilityInfo
          );
        });

        await client.query(crossRefsQuery, crossRefParams);
      }

      await client.query('COMMIT');

      // Return the complete component data
      const newComponent = await this.getComponentById(componentId);
      if (!newComponent) {
        throw new ComponentLibraryError('Failed to retrieve created component');
      }

      return newComponent;

    } catch (error) {
      await client.query('ROLLBACK');
      throw new ComponentLibraryError(
        `Failed to create component: ${error instanceof Error ? error.message : String(error)}`,
        { request, error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Update an existing component
   */
  async updateComponent(request: ComponentLibraryUpdateRequest): Promise<ComponentLibraryEntry> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Increment version and update timestamp
      const updateQuery = `
        UPDATE electrical_analysis.component_library
        SET version = version + 1, updated_at = NOW()
        WHERE id = $1
        RETURNING version
      `;

      const updateResult = await client.query(updateQuery, [request.componentId]);
      
      if (updateResult.rows.length === 0) {
        throw new ComponentLibraryError(`Component not found: ${request.componentId}`);
      }

      // Apply updates based on what's provided in request.updates
      if (request.updates.componentName !== undefined ||
          request.updates.componentDescription !== undefined ||
          request.updates.industryStandards !== undefined ||
          request.updates.symbolPatternData !== undefined) {
        
        const fields: string[] = [];
        const params: any[] = [request.componentId];
        let paramIndex = 2;

        if (request.updates.componentName !== undefined) {
          fields.push(`component_name = $${paramIndex++}`);
          params.push(request.updates.componentName);
        }

        if (request.updates.componentDescription !== undefined) {
          fields.push(`component_description = $${paramIndex++}`);
          params.push(request.updates.componentDescription);
        }

        if (request.updates.industryStandards !== undefined) {
          fields.push(`industry_standards = $${paramIndex++}`);
          params.push(request.updates.industryStandards);
        }

        if (request.updates.symbolPatternData !== undefined) {
          fields.push(`symbol_pattern_data = $${paramIndex++}`);
          params.push(request.updates.symbolPatternData);
        }

        if (fields.length > 0) {
          const componentUpdateQuery = `
            UPDATE electrical_analysis.component_library
            SET ${fields.join(', ')}, updated_at = NOW()
            WHERE id = $1
          `;
          
          await client.query(componentUpdateQuery, params);
        }
      }

      await client.query('COMMIT');

      // Return the updated component data
      const updatedComponent = await this.getComponentById(request.componentId);
      if (!updatedComponent) {
        throw new ComponentLibraryError('Failed to retrieve updated component');
      }

      return updatedComponent;

    } catch (error) {
      await client.query('ROLLBACK');
      throw new ComponentLibraryError(
        `Failed to update component: ${error instanceof Error ? error.message : String(error)}`,
        { request, error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Delete a component from the library
   */
  async deleteComponent(componentId: string): Promise<boolean> {
    const client = await this.db.connect();
    
    try {
      const deleteQuery = `
        DELETE FROM electrical_analysis.component_library
        WHERE id = $1
      `;

      const result = await client.query(deleteQuery, [componentId]);
      return (result.rowCount ?? 0) > 0;

    } catch (error) {
      throw new ComponentLibraryError(
        `Failed to delete component: ${error instanceof Error ? error.message : String(error)}`,
        { componentId, error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get components by industry standard
   */
  async getComponentsByStandard(standard: IndustryStandard, limit = 50, offset = 0): Promise<ComponentLibraryEntry[]> {
    const searchRequest: ComponentSearchRequest = {
      industryStandards: [standard],
      limit,
      offset
    };

    const result = await this.searchComponents(searchRequest);
    return result.components;
  }

  /**
   * Get component library statistics
   */
  async getLibraryStatistics(): Promise<{
    totalComponents: number;
    componentsByCategory: Record<string, number>;
    componentsByStandard: Record<string, number>;
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

      // By standard (requires unnesting the array)
      const standardQuery = `
        SELECT unnest(industry_standards) as standard, COUNT(*) as count
        FROM electrical_analysis.component_library
        GROUP BY unnest(industry_standards)
      `;
      const standardResult = await client.query(standardQuery);
      const componentsByStandard: Record<string, number> = {};
      standardResult.rows.forEach(row => {
        componentsByStandard[row.standard] = parseInt(row.count);
      });

      return {
        totalComponents,
        componentsByCategory,
        componentsByStandard
      };

    } catch (error) {
      throw new ComponentLibraryError(
        `Failed to get library statistics: ${error instanceof Error ? error.message : String(error)}`,
        { error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }
}