/**
 * Property Search Service
 * 
 * Handles advanced component property search, filtering, and matching
 * for electrical components based on technical specifications.
 * 
 * Story: 4.2 Component Database Integration
 * Task: 4.2.2 Implement Component Specification Engine
 */

import { Pool } from 'pg';
import {
  PropertyFilter,
  RatingFilter,
  ComponentLibraryEntry,
  ComponentSpecificationError
} from '../../../../shared/types/component-database.types';
import { ComponentLibraryService } from './component-library.service';
import { getErrorMessage } from '../utils/error-utils';

interface PropertySearchOptions {
  propertyFilters?: PropertyFilter[];
  ratingFilters?: RatingFilter[];
  includeAlternativeUnits?: boolean;
  tolerance?: number; // Percentage tolerance for numeric matches
  limit?: number;
  offset?: number;
}

interface PropertySearchResult {
  components: ComponentLibraryEntry[];
  totalMatches: number;
  searchMetadata: {
    appliedFilters: number;
    processingTimeMs: number;
    matchQuality: number;
  };
}

export class PropertySearchService {
  private db: Pool;
  private componentLibraryService: ComponentLibraryService;
  private unitConversions: Map<string, Map<string, number>> = new Map();

  constructor(database: Pool, componentLibraryService: ComponentLibraryService) {
    this.db = database;
    this.componentLibraryService = componentLibraryService;
    this.initializeUnitConversions();
  }

  /**
   * Search components by properties and ratings
   */
  async searchByProperties(options: PropertySearchOptions): Promise<PropertySearchResult> {
    const startTime = Date.now();
    const client = await this.db.connect();
    
    try {
      const {
        propertyFilters = [],
        ratingFilters = [],
        includeAlternativeUnits = true,
        tolerance = 10, // 10% tolerance by default
        limit = 50,
        offset = 0
      } = options;

      let baseQuery = `
        SELECT DISTINCT cl.id
        FROM electrical_analysis.component_library cl
      `;

      const whereConditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      // Apply property filters
      if (propertyFilters.length > 0) {
        for (let i = 0; i < propertyFilters.length; i++) {
          const filter = propertyFilters[i];
          const propertyCondition = this.buildPropertyCondition(
            filter, 
            paramIndex, 
            includeAlternativeUnits, 
            tolerance
          );
          
          if (propertyCondition.condition) {
            baseQuery += ` JOIN electrical_analysis.component_properties cp${i} ON cl.id = cp${i}.component_id`;
            whereConditions.push(propertyCondition.condition);
            params.push(...propertyCondition.params);
            paramIndex += propertyCondition.params.length;
          }
        }
      }

      // Apply rating filters
      if (ratingFilters.length > 0) {
        for (let i = 0; i < ratingFilters.length; i++) {
          const filter = ratingFilters[i];
          const ratingCondition = this.buildRatingCondition(
            filter, 
            paramIndex, 
            includeAlternativeUnits, 
            tolerance
          );
          
          if (ratingCondition.condition) {
            baseQuery += ` JOIN electrical_analysis.component_ratings cr${i} ON cl.id = cr${i}.component_id`;
            whereConditions.push(ratingCondition.condition);
            params.push(...ratingCondition.params);
            paramIndex += ratingCondition.params.length;
          }
        }
      }

      if (whereConditions.length > 0) {
        baseQuery += ` WHERE ${whereConditions.join(' AND ')}`;
      }

      // Count total matches
      const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as matches`;
      const countResult = await client.query(countQuery, params);
      const totalMatches = parseInt(countResult.rows[0].total);

      // Get paginated results
      const searchQuery = `
        ${baseQuery}
        ORDER BY cl.component_name
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      params.push(limit, offset);
      const searchResult = await client.query(searchQuery, params);

      // Get full component data
      const components: ComponentLibraryEntry[] = [];
      for (const row of searchResult.rows) {
        const component = await this.componentLibraryService.getComponentById(row.id);
        if (component) {
          components.push(component);
        }
      }

      const processingTime = Date.now() - startTime;
      const matchQuality = this.calculateMatchQuality(components, propertyFilters, ratingFilters);

      return {
        components,
        totalMatches,
        searchMetadata: {
          appliedFilters: propertyFilters.length + ratingFilters.length,
          processingTimeMs: processingTime,
          matchQuality
        }
      };

    } catch (error) {
      throw new ComponentSpecificationError(
        `Failed to search by properties: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { options, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Find components with similar properties to a reference component
   */
  async findSimilarComponents(
    referenceComponentId: string,
    propertyNames?: string[],
    tolerancePercent = 20,
    limit = 10
  ): Promise<{
    components: ComponentLibraryEntry[];
    similarityScores: Record<string, number>;
  }> {
    const client = await this.db.connect();
    
    try {
      // Get reference component properties
      const referencePropertiesQuery = `
        SELECT property_name, property_value, property_unit
        FROM electrical_analysis.component_properties
        WHERE component_id = $1 AND is_searchable = true
        ${propertyNames ? 'AND property_name = ANY($2)' : ''}
      `;

      const refParams: any[] = [referenceComponentId];
      if (propertyNames) {
        refParams.push(propertyNames);
      }

      const refResult = await client.query(referencePropertiesQuery, refParams);
      const referenceProperties = refResult.rows;

      if (referenceProperties.length === 0) {
        return { components: [], similarityScores: {} };
      }

      // Find components with similar properties
      const similarityMap = new Map<string, number>();
      
      for (const refProp of referenceProperties) {
        const numericValue = this.parseNumericValue(refProp.property_value);
        
        if (numericValue !== null) {
          // Numeric property matching with tolerance
          const minValue = numericValue * (1 - tolerancePercent / 100);
          const maxValue = numericValue * (1 + tolerancePercent / 100);
          
          const similarQuery = `
            SELECT DISTINCT cp.component_id
            FROM electrical_analysis.component_properties cp
            WHERE cp.property_name = $1
            AND cp.component_id != $2
            AND cp.is_searchable = true
            AND (
              CAST(cp.property_value AS NUMERIC) BETWEEN $3 AND $4
              OR cp.property_value ILIKE $5
            )
          `;

          const similarResult = await client.query(similarQuery, [
            refProp.property_name,
            referenceComponentId,
            minValue,
            maxValue,
            `%${refProp.property_value}%`
          ]);

          similarResult.rows.forEach(row => {
            const componentId = row.component_id;
            const currentScore = similarityMap.get(componentId) || 0;
            similarityMap.set(componentId, currentScore + 1);
          });
        } else {
          // String property matching
          const similarQuery = `
            SELECT DISTINCT cp.component_id
            FROM electrical_analysis.component_properties cp
            WHERE cp.property_name = $1
            AND cp.component_id != $2
            AND cp.is_searchable = true
            AND cp.property_value ILIKE $3
          `;

          const similarResult = await client.query(similarQuery, [
            refProp.property_name,
            referenceComponentId,
            `%${refProp.property_value}%`
          ]);

          similarResult.rows.forEach(row => {
            const componentId = row.component_id;
            const currentScore = similarityMap.get(componentId) || 0;
            similarityMap.set(componentId, currentScore + 0.5);
          });
        }
      }

      // Sort by similarity score and get top matches
      const sortedMatches = Array.from(similarityMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      // Get full component data
      const components: ComponentLibraryEntry[] = [];
      const similarityScores: Record<string, number> = {};

      for (const [componentId, score] of sortedMatches) {
        const component = await this.componentLibraryService.getComponentById(componentId);
        if (component) {
          components.push(component);
          similarityScores[componentId] = score / referenceProperties.length;
        }
      }

      return { components, similarityScores };

    } catch (error) {
      throw new ComponentSpecificationError(
        `Failed to find similar components: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { referenceComponentId, propertyNames, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get property value ranges for a specific property across all components
   */
  async getPropertyValueRanges(propertyName: string, symbolCategory?: string): Promise<{
    numericRange?: { min: number; max: number; unit: string };
    commonValues: { value: string; count: number }[];
    totalComponents: number;
  }> {
    const client = await this.db.connect();
    
    try {
      let baseQuery = `
        SELECT cp.property_value, cp.property_unit, COUNT(*) as count
        FROM electrical_analysis.component_properties cp
        JOIN electrical_analysis.component_library cl ON cp.component_id = cl.id
        WHERE cp.property_name = $1 AND cp.is_searchable = true
      `;

      const params: any[] = [propertyName];

      if (symbolCategory) {
        baseQuery += ` AND cl.symbol_category = $2`;
        params.push(symbolCategory);
      }

      baseQuery += `
        GROUP BY cp.property_value, cp.property_unit
        ORDER BY count DESC
        LIMIT 50
      `;

      const result = await client.query(baseQuery, params);

      const commonValues = result.rows.map(row => ({
        value: row.property_value + (row.property_unit ? ` ${row.property_unit}` : ''),
        count: parseInt(row.count)
      }));

      const totalComponents = result.rows.reduce((sum, row) => sum + parseInt(row.count), 0);

      // Try to determine numeric range
      let numericRange: { min: number; max: number; unit: string } | undefined;
      const numericValues: { value: number; unit: string }[] = [];

      result.rows.forEach(row => {
        const numValue = this.parseNumericValue(row.property_value);
        if (numValue !== null) {
          numericValues.push({ value: numValue, unit: row.property_unit || '' });
        }
      });

      if (numericValues.length > 0) {
        const values = numericValues.map(nv => nv.value);
        const commonUnit = this.findMostCommonUnit(numericValues.map(nv => nv.unit));
        
        numericRange = {
          min: Math.min(...values),
          max: Math.max(...values),
          unit: commonUnit
        };
      }

      return {
        ...(numericRange && { numericRange }),
        commonValues,
        totalComponents
      };

    } catch (error) {
      throw new ComponentSpecificationError(
        `Failed to get property value ranges: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { propertyName, symbolCategory, error: error instanceof Error ? error.message : 'Unknown error' }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Suggest components based on partial property specifications
   */
  async suggestComponents(
    partialSpecs: { propertyName: string; propertyValue?: string; unit?: string }[],
    limit = 10
  ): Promise<ComponentLibraryEntry[]> {
    if (partialSpecs.length === 0) {
      return [];
    }

    const client = await this.db.connect();
    
    try {
      // Score components based on how many partial specs they match
      const componentScores = new Map<string, number>();

      for (const spec of partialSpecs) {
        let query = `
          SELECT DISTINCT cp.component_id
          FROM electrical_analysis.component_properties cp
          WHERE cp.property_name = $1 AND cp.is_searchable = true
        `;

        const params: any[] = [spec.propertyName];
        let paramIndex = 2;

        if (spec.propertyValue) {
          query += ` AND cp.property_value ILIKE $${paramIndex}`;
          params.push(`%${spec.propertyValue}%`);
          paramIndex++;
        }

        if (spec.unit) {
          query += ` AND cp.property_unit ILIKE $${paramIndex}`;
          params.push(`%${spec.unit}%`);
        }

        const result = await client.query(query, params);

        result.rows.forEach(row => {
          const componentId = row.component_id;
          const currentScore = componentScores.get(componentId) || 0;
          componentScores.set(componentId, currentScore + 1);
        });
      }

      // Get top scoring components
      const topComponentIds = Array.from(componentScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(entry => entry[0]);

      // Get full component data
      const components: ComponentLibraryEntry[] = [];
      for (const componentId of topComponentIds) {
        const component = await this.componentLibraryService.getComponentById(componentId);
        if (component) {
          components.push(component);
        }
      }

      return components;

    } catch (error) {
      throw new ComponentSpecificationError(
        `Failed to suggest components: ${error.message}`,
        { partialSpecs, error: error.message }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Build property filter condition
   */
  private buildPropertyCondition(
    filter: PropertyFilter,
    paramIndex: number,
    includeAlternativeUnits: boolean,
    tolerance: number
  ): { condition: string; params: any[] } {
    const i = Math.floor(paramIndex / 10); // Use for table alias
    const params: any[] = [];
    let condition = `cp${i}.property_name = $${paramIndex}`;
    params.push(filter.propertyName);

    let valueCondition = '';
    const nextParam = paramIndex + 1;

    switch (filter.operator) {
      case 'equals':
        valueCondition = `cp${i}.property_value = $${nextParam}`;
        params.push(filter.value);
        break;

      case 'contains':
        valueCondition = `cp${i}.property_value ILIKE $${nextParam}`;
        params.push(`%${filter.value}%`);
        break;

      case 'greater_than':
        valueCondition = `CAST(cp${i}.property_value AS NUMERIC) > $${nextParam}`;
        params.push(filter.value);
        break;

      case 'less_than':
        valueCondition = `CAST(cp${i}.property_value AS NUMERIC) < $${nextParam}`;
        params.push(filter.value);
        break;

      case 'between':
        if (filter.secondValue !== undefined) {
          valueCondition = `CAST(cp${i}.property_value AS NUMERIC) BETWEEN $${nextParam} AND $${nextParam + 1}`;
          params.push(filter.value, filter.secondValue);
        }
        break;
    }

    if (valueCondition) {
      condition += ` AND (${valueCondition})`;
    }

    return { condition, params };
  }

  /**
   * Build rating filter condition
   */
  private buildRatingCondition(
    filter: RatingFilter,
    paramIndex: number,
    includeAlternativeUnits: boolean,
    tolerance: number
  ): { condition: string; params: any[] } {
    const i = Math.floor(paramIndex / 10); // Use for table alias
    const params: any[] = [];
    let condition = `cr${i}.rating_type = $${paramIndex}`;
    params.push(filter.ratingType);

    let valueCondition = '';
    const nextParam = paramIndex + 1;

    switch (filter.operator) {
      case 'equals':
        if (typeof filter.value === 'number') {
          // Allow for tolerance in numeric comparisons
          const minValue = filter.value * (1 - tolerance / 100);
          const maxValue = filter.value * (1 + tolerance / 100);
          valueCondition = `(
            (cr${i}.nominal_value BETWEEN $${nextParam} AND $${nextParam + 1}) OR
            (cr${i}.min_value <= $${nextParam + 2} AND cr${i}.max_value >= $${nextParam + 2})
          )`;
          params.push(minValue, maxValue, filter.value);
        }
        break;

      case 'greater_than':
        valueCondition = `(
          cr${i}.nominal_value > $${nextParam} OR
          cr${i}.min_value > $${nextParam}
        )`;
        params.push(filter.value);
        break;

      case 'less_than':
        valueCondition = `(
          cr${i}.nominal_value < $${nextParam} OR
          cr${i}.max_value < $${nextParam}
        )`;
        params.push(filter.value);
        break;

      case 'between':
        if (filter.secondValue !== undefined) {
          valueCondition = `(
            (cr${i}.nominal_value BETWEEN $${nextParam} AND $${nextParam + 1}) OR
            (cr${i}.min_value <= $${nextParam + 1} AND cr${i}.max_value >= $${nextParam})
          )`;
          params.push(filter.value, filter.secondValue);
        }
        break;
    }

    if (valueCondition) {
      condition += ` AND cr${i}.unit = $${paramIndex + params.length} AND (${valueCondition})`;
      params.push(filter.unit);
    }

    return { condition, params };
  }

  /**
   * Parse numeric value from string
   */
  private parseNumericValue(value: string): number | null {
    // Handle common engineering notation and units
    const cleanValue = value
      .replace(/[^\d.,eE+\-kKmMµuUnNpP]/g, '')
      .replace(',', '.');

    const numMatch = cleanValue.match(/^(\d+\.?\d*)/);
    if (!numMatch) return null;

    let num = parseFloat(numMatch[1]);
    
    // Handle engineering prefixes
    if (value.includes('k') || value.includes('K')) num *= 1e3;
    else if (value.includes('M')) num *= 1e6;
    else if (value.includes('m')) num *= 1e-3;
    else if (value.includes('µ') || value.includes('u')) num *= 1e-6;
    else if (value.includes('n') || value.includes('N')) num *= 1e-9;
    else if (value.includes('p') || value.includes('P')) num *= 1e-12;

    return num;
  }

  /**
   * Find most common unit from array of units
   */
  private findMostCommonUnit(units: string[]): string {
    const counts = new Map<string, number>();
    
    units.forEach(unit => {
      const cleanUnit = (unit || '').trim();
      counts.set(cleanUnit, (counts.get(cleanUnit) || 0) + 1);
    });

    let mostCommon = '';
    let maxCount = 0;
    
    counts.forEach((count, unit) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = unit;
      }
    });

    return mostCommon;
  }

  /**
   * Calculate match quality for search results
   */
  private calculateMatchQuality(
    components: ComponentLibraryEntry[],
    propertyFilters: PropertyFilter[],
    ratingFilters: RatingFilter[]
  ): number {
    if (components.length === 0 || (propertyFilters.length === 0 && ratingFilters.length === 0)) {
      return 0;
    }

    let totalScore = 0;
    let totalFilters = propertyFilters.length + ratingFilters.length;

    components.forEach(component => {
      let componentScore = 0;

      // Check property matches
      propertyFilters.forEach(filter => {
        const matchingProperty = component.properties.find(
          prop => prop.propertyName === filter.propertyName
        );
        if (matchingProperty) {
          componentScore += 1;
        }
      });

      // Check rating matches
      ratingFilters.forEach(filter => {
        const matchingRating = component.ratings.find(
          rating => rating.ratingType === filter.ratingType
        );
        if (matchingRating) {
          componentScore += 1;
        }
      });

      totalScore += componentScore / totalFilters;
    });

    return totalScore / components.length;
  }

  /**
   * Initialize unit conversion mappings
   */
  private initializeUnitConversions(): void {
    this.unitConversions = new Map();

    // Resistance units
    const resistance = new Map<string, number>();
    resistance.set('Ω', 1);
    resistance.set('ohm', 1);
    resistance.set('kΩ', 1e3);
    resistance.set('MΩ', 1e6);
    this.unitConversions.set('resistance', resistance);

    // Capacitance units
    const capacitance = new Map<string, number>();
    capacitance.set('F', 1);
    capacitance.set('farad', 1);
    capacitance.set('mF', 1e-3);
    capacitance.set('µF', 1e-6);
    capacitance.set('uF', 1e-6);
    capacitance.set('nF', 1e-9);
    capacitance.set('pF', 1e-12);
    this.unitConversions.set('capacitance', capacitance);

    // Voltage units
    const voltage = new Map<string, number>();
    voltage.set('V', 1);
    voltage.set('volt', 1);
    voltage.set('kV', 1e3);
    voltage.set('mV', 1e-3);
    this.unitConversions.set('voltage', voltage);

    // Current units
    const current = new Map<string, number>();
    current.set('A', 1);
    current.set('amp', 1);
    current.set('mA', 1e-3);
    current.set('µA', 1e-6);
    current.set('uA', 1e-6);
    this.unitConversions.set('current', current);
  }
}