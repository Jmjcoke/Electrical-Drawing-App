/**
 * Component Controller
 * 
 * RESTful API endpoints for electrical component database operations
 * 
 * Story: 4.2 Component Database Integration
 * Task: 4.2.4 Build API Endpoints and Database Integration
 */

import { Request, Response } from 'express';
import { Pool } from 'pg';
import {
  // ComponentLibraryEntry, // Used in response types
  ComponentSearchRequest,
  // ComponentSearchResponse, // Used in response types
  ComponentLibraryCreateRequest,
  ComponentLibraryUpdateRequest,
  ComponentLookupRequest,
  // ComponentLookupResponse, // Used in response types
  ComponentIdentificationBatchRequest,
  // ComponentIdentificationBatchResponse, // Used in response types
  ComponentLibraryError,
  ComponentIdentificationError,
  IndustryStandard,
  ElectricalSymbolType,
  SymbolCategory
} from '../../../../shared/types/component-database.types';
// import { DetectedSymbol } from '../../../../shared/types/symbol-detection.types'; // Reserved for future use
import { ComponentLibraryService } from '../components/component-library.service';
import { ComponentSpecificationService } from '../components/specification.service';
import { ComponentIdentificationService } from '../components/identification.service';
import { CrossReferenceService } from '../components/cross-reference.service';
import { PropertySearchService } from '../components/property-search.service';
import { ComponentIdentificationIntegrationService } from '../components/component-identification-integration.service';
import { SymbolDetectionStorageService } from '../services/symbol-detection-storage.service';

interface ComponentQuery {
  search?: string;
  symbolType?: ElectricalSymbolType;
  symbolCategory?: SymbolCategory;
  industryStandards?: string; // Comma-separated values
  manufacturer?: string;
  limit?: string;
  offset?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface ComponentIdentificationQuery {
  sessionId: string;
  detectionResultId?: string;
  symbolId?: string;
  confidenceThreshold?: string;
  maxAlternatives?: string;
  enableFallback?: string;
}

export class ComponentController {
  private componentLibraryService: ComponentLibraryService;
  private specificationService: ComponentSpecificationService;
  private identificationService: ComponentIdentificationService;
  private crossReferenceService: CrossReferenceService;
  private propertySearchService: PropertySearchService;
  private integrationService: ComponentIdentificationIntegrationService;

  constructor(
    database: Pool,
    symbolDetectionService: SymbolDetectionStorageService
  ) {
    // Initialize services
    this.componentLibraryService = new ComponentLibraryService(database);
    this.specificationService = new ComponentSpecificationService(database);
    this.identificationService = new ComponentIdentificationService(
      database,
      this.componentLibraryService,
      this.specificationService
    );
    this.crossReferenceService = new CrossReferenceService(database);
    this.propertySearchService = new PropertySearchService(database, this.componentLibraryService);
    this.integrationService = new ComponentIdentificationIntegrationService(
      database,
      this.componentLibraryService,
      this.specificationService,
      this.identificationService,
      symbolDetectionService
    );

    // Bind methods to preserve 'this' context
    this.getComponent = this.getComponent.bind(this);
    this.searchComponents = this.searchComponents.bind(this);
    this.createComponent = this.createComponent.bind(this);
    this.updateComponent = this.updateComponent.bind(this);
    this.deleteComponent = this.deleteComponent.bind(this);
    this.getComponentProperties = this.getComponentProperties.bind(this);
    this.getComponentRatings = this.getComponentRatings.bind(this);
    this.getComponentCrossReferences = this.getComponentCrossReferences.bind(this);
    this.identifyComponent = this.identifyComponent.bind(this);
    this.identifyBatchComponents = this.identifyBatchComponents.bind(this);
    this.searchByPartNumber = this.searchByPartNumber.bind(this);
    this.searchByManufacturer = this.searchByManufacturer.bind(this);
    this.getComponentsByStandard = this.getComponentsByStandard.bind(this);
    this.getLibraryStatistics = this.getLibraryStatistics.bind(this);
    this.findSimilarComponents = this.findSimilarComponents.bind(this);
    this.getPropertyValueRanges = this.getPropertyValueRanges.bind(this);
    this.suggestComponents = this.suggestComponents.bind(this);
    this.getIdentificationStatistics = this.getIdentificationStatistics.bind(this);
  }

  /**
   * GET /api/components/:componentId
   * Get detailed component specification
   */
  async getComponent(req: Request, res: Response): Promise<void> {
    try {
      const { componentId } = req.params;

      if (!componentId) {
        res.status(400).json({
          success: false,
          error: 'Component ID is required',
          code: 'MISSING_COMPONENT_ID'
        });
        return;
      }

      const component = await this.componentLibraryService.getComponentById(componentId);

      if (!component) {
        res.status(404).json({
          success: false,
          error: 'Component not found',
          code: 'COMPONENT_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        component
      });

    } catch (error) {
      this.handleError(res, error, 'Failed to get component');
    }
  }

  /**
   * GET /api/components/library
   * Get component library with filtering and pagination
   */
  async searchComponents(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query as ComponentQuery;
      
      const searchRequest: ComponentSearchRequest = {
        query: query.search || '',
        symbolType: query.symbolType || undefined,
        symbolCategory: query.symbolCategory || undefined,
        industryStandards: query.industryStandards ? 
          query.industryStandards.split(',').map(s => s.trim()) as IndustryStandard[] : undefined,
        manufacturer: query.manufacturer || undefined,
        limit: query.limit ? parseInt(query.limit) : 50,
        offset: query.offset ? parseInt(query.offset) : 0
      };

      const response = await this.componentLibraryService.searchComponents(searchRequest);

      res.json({
        success: true,
        ...response
      });

    } catch (error) {
      this.handleError(res, error, 'Failed to search components');
    }
  }

  /**
   * POST /api/components/library
   * Add new component to library (admin)
   */
  async createComponent(req: Request, res: Response): Promise<void> {
    try {
      const createRequest: ComponentLibraryCreateRequest = req.body;

      // Enhanced validation
      const validation = this.validateCreateRequest(createRequest);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: validation.errors.join(', '),
          code: 'VALIDATION_FAILED',
          details: { errors: validation.errors }
        });
        return;
      }

      const component = await this.componentLibraryService.createComponent(createRequest);

      res.status(201).json({
        success: true,
        component,
        message: 'Component created successfully'
      });

    } catch (error) {
      this.handleError(res, error, 'Failed to create component');
    }
  }

  /**
   * PUT /api/components/:componentId
   * Update component specification (admin)
   */
  async updateComponent(req: Request, res: Response): Promise<void> {
    try {
      const { componentId } = req.params;
      const updates = req.body;

      if (!componentId) {
        res.status(400).json({
          success: false,
          error: 'Component ID is required',
          code: 'MISSING_COMPONENT_ID'
        });
        return;
      }

      const updateRequest: ComponentLibraryUpdateRequest = {
        componentId,
        updates,
        versionNotes: updates.versionNotes
      };

      const component = await this.componentLibraryService.updateComponent(updateRequest);

      res.json({
        success: true,
        component,
        message: 'Component updated successfully'
      });

    } catch (error) {
      this.handleError(res, error, 'Failed to update component');
    }
  }

  /**
   * DELETE /api/components/:componentId
   * Remove component from library (admin)
   */
  async deleteComponent(req: Request, res: Response): Promise<void> {
    try {
      const { componentId } = req.params;

      if (!componentId) {
        res.status(400).json({
          success: false,
          error: 'Component ID is required',
          code: 'MISSING_COMPONENT_ID'
        });
        return;
      }

      const deleted = await this.componentLibraryService.deleteComponent(componentId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Component not found',
          code: 'COMPONENT_NOT_FOUND'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Component deleted successfully'
      });

    } catch (error) {
      this.handleError(res, error, 'Failed to delete component');
    }
  }

  /**
   * GET /api/components/:componentId/properties
   * Get component properties and ratings
   */
  async getComponentProperties(req: Request, res: Response): Promise<void> {
    try {
      const { componentId } = req.params;
      const { searchable_only, property_names } = req.query;

      if (!componentId) {
        res.status(400).json({
          success: false,
          error: 'Component ID is required',
          code: 'MISSING_COMPONENT_ID'
        });
        return;
      }

      const properties = await this.specificationService.getComponentProperties(
        componentId,
        searchable_only === 'true',
        property_names ? (property_names as string).split(',') : undefined
      );

      res.json({
        success: true,
        properties
      });

    } catch (error) {
      this.handleError(res, error, 'Failed to get component properties');
    }
  }

  /**
   * GET /api/components/:componentId/ratings
   * Get component ratings
   */
  async getComponentRatings(req: Request, res: Response): Promise<void> {
    try {
      const { componentId } = req.params;
      const { rating_types } = req.query;

      if (!componentId) {
        res.status(400).json({
          success: false,
          error: 'Component ID is required',
          code: 'MISSING_COMPONENT_ID'
        });
        return;
      }

      const ratings = await this.specificationService.getComponentRatings(
        componentId,
        rating_types ? (rating_types as string).split(',') as any[] : undefined
      );

      res.json({
        success: true,
        ratings
      });

    } catch (error) {
      this.handleError(res, error, 'Failed to get component ratings');
    }
  }

  /**
   * GET /api/components/:componentId/cross-references
   * Get part numbers and manufacturer info
   */
  async getComponentCrossReferences(req: Request, res: Response): Promise<void> {
    try {
      const { componentId } = req.params;

      if (!componentId) {
        res.status(400).json({
          success: false,
          error: 'Component ID is required',
          code: 'MISSING_COMPONENT_ID'
        });
        return;
      }

      const crossReferences = await this.crossReferenceService.getComponentCrossReferences(componentId);

      res.json({
        success: true,
        crossReferences
      });

    } catch (error) {
      this.handleError(res, error, 'Failed to get component cross-references');
    }
  }

  /**
   * POST /api/components/identify
   * Identify component from symbol detection result
   */
  async identifyComponent(req: Request, res: Response): Promise<void> {
    try {
      const lookupRequest: ComponentLookupRequest = req.body;

      if (!lookupRequest.detectedSymbol) {
        res.status(400).json({
          success: false,
          error: 'Detected symbol is required',
          code: 'MISSING_DETECTED_SYMBOL'
        });
        return;
      }

      const response = await this.identificationService.identifyComponent(lookupRequest);

      res.json(response);

    } catch (error) {
      this.handleError(res, error, 'Failed to identify component');
    }
  }

  /**
   * POST /api/components/identify/batch
   * Identify multiple components from symbol detection result
   */
  async identifyBatchComponents(req: Request, res: Response): Promise<void> {
    try {
      const batchRequest: ComponentIdentificationBatchRequest = req.body;

      if (!batchRequest.sessionId || !batchRequest.detectionResultId) {
        res.status(400).json({
          success: false,
          error: 'Session ID and detection result ID are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
        return;
      }

      const response = await this.integrationService.processSymbolDetectionResult(batchRequest);

      res.json({
        success: true,
        ...response
      });

    } catch (error) {
      this.handleError(res, error, 'Failed to identify batch components');
    }
  }

  /**
   * GET /api/components/search/part-number/:partNumber
   * Search components by part number
   */
  async searchByPartNumber(req: Request, res: Response): Promise<void> {
    try {
      const { partNumber } = req.params;
      const { exact_match } = req.query;

      if (!partNumber) {
        res.status(400).json({
          success: false,
          error: 'Part number is required',
          code: 'MISSING_PART_NUMBER'
        });
        return;
      }

      const crossReferences = await this.crossReferenceService.searchByPartNumber(
        partNumber,
        exact_match === 'true'
      );

      res.json({
        success: true,
        crossReferences,
        totalCount: crossReferences.length
      });

    } catch (error) {
      this.handleError(res, error, 'Failed to search by part number');
    }
  }

  /**
   * GET /api/components/search/manufacturer/:manufacturer
   * Search components by manufacturer
   */
  async searchByManufacturer(req: Request, res: Response): Promise<void> {
    try {
      const { manufacturer } = req.params;
      const { limit, offset } = req.query;

      if (!manufacturer) {
        res.status(400).json({
          success: false,
          error: 'Manufacturer is required',
          code: 'MISSING_MANUFACTURER'
        });
        return;
      }

      const crossReferences = await this.crossReferenceService.searchByManufacturer(
        manufacturer,
        limit ? parseInt(limit as string) : 50,
        offset ? parseInt(offset as string) : 0
      );

      res.json({
        success: true,
        crossReferences
      });

    } catch (error) {
      this.handleError(res, error, 'Failed to search by manufacturer');
    }
  }

  /**
   * GET /api/components/standards/:standard
   * Get components by industry standard
   */
  async getComponentsByStandard(req: Request, res: Response): Promise<void> {
    try {
      const { standard } = req.params;
      const { limit, offset } = req.query;

      if (!standard) {
        res.status(400).json({
          success: false,
          error: 'Industry standard is required',
          code: 'MISSING_STANDARD'
        });
        return;
      }

      const components = await this.componentLibraryService.getComponentsByStandard(
        standard as IndustryStandard,
        limit ? parseInt(limit as string) : 50,
        offset ? parseInt(offset as string) : 0
      );

      res.json({
        success: true,
        components,
        totalCount: components.length
      });

    } catch (error) {
      this.handleError(res, error, 'Failed to get components by standard');
    }
  }

  /**
   * GET /api/components/statistics
   * Get component library statistics
   */
  async getLibraryStatistics(_req: Request, res: Response): Promise<void> {
    try {
      const statistics = await this.componentLibraryService.getLibraryStatistics();

      res.json({
        success: true,
        statistics
      });

    } catch (error) {
      this.handleError(res, error, 'Failed to get library statistics');
    }
  }

  /**
   * GET /api/components/:componentId/similar
   * Find components with similar properties
   */
  async findSimilarComponents(req: Request, res: Response): Promise<void> {
    try {
      const { componentId } = req.params;
      const { property_names, tolerance, limit } = req.query;

      if (!componentId) {
        res.status(400).json({
          success: false,
          error: 'Component ID is required',
          code: 'MISSING_COMPONENT_ID'
        });
        return;
      }

      const result = await this.propertySearchService.findSimilarComponents(
        componentId,
        property_names ? (property_names as string).split(',') : undefined,
        tolerance ? parseInt(tolerance as string) : 20,
        limit ? parseInt(limit as string) : 10
      );

      res.json({
        success: true,
        ...result
      });

    } catch (error) {
      this.handleError(res, error, 'Failed to find similar components');
    }
  }

  /**
   * GET /api/components/properties/:propertyName/ranges
   * Get property value ranges for analysis
   */
  async getPropertyValueRanges(req: Request, res: Response): Promise<void> {
    try {
      const { propertyName } = req.params;
      const { symbol_category } = req.query;

      if (!propertyName) {
        res.status(400).json({
          success: false,
          error: 'Property name is required',
          code: 'MISSING_PROPERTY_NAME'
        });
        return;
      }

      const ranges = await this.propertySearchService.getPropertyValueRanges(
        propertyName,
        symbol_category as SymbolCategory
      );

      res.json({
        success: true,
        propertyName,
        ...ranges
      });

    } catch (error) {
      this.handleError(res, error, 'Failed to get property value ranges');
    }
  }

  /**
   * POST /api/components/suggest
   * Suggest components based on partial specifications
   */
  async suggestComponents(req: Request, res: Response): Promise<void> {
    try {
      const { partialSpecs, limit } = req.body;

      if (!partialSpecs || !Array.isArray(partialSpecs)) {
        res.status(400).json({
          success: false,
          error: 'Partial specifications array is required',
          code: 'MISSING_PARTIAL_SPECS'
        });
        return;
      }

      const components = await this.propertySearchService.suggestComponents(
        partialSpecs,
        limit || 10
      );

      res.json({
        success: true,
        components,
        totalCount: components.length
      });

    } catch (error) {
      this.handleError(res, error, 'Failed to suggest components');
    }
  }

  /**
   * GET /api/components/identification/statistics
   * Get identification statistics for session
   */
  async getIdentificationStatistics(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.query.sessionId as string;
      
      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: 'Session ID is required',
          code: 'MISSING_SESSION_ID'
        });
        return;
      }

      const statistics = await this.integrationService.getIdentificationStatistics(sessionId);

      res.json({
        success: true,
        sessionId: sessionId,
        statistics
      });

    } catch (error) {
      this.handleError(res, error, 'Failed to get identification statistics');
    }
  }

  /**
   * Enhanced validation for component creation requests
   */
  private validateCreateRequest(request: ComponentLibraryCreateRequest): ValidationResult {
    const errors: string[] = [];

    // Required fields validation
    if (!request.componentName || request.componentName.trim().length === 0) {
      errors.push('Component name is required and cannot be empty');
    }
    
    if (!request.symbolType || request.symbolType.trim().length === 0) {
      errors.push('Symbol type is required and cannot be empty');
    }
    
    if (!request.symbolCategory || request.symbolCategory.trim().length === 0) {
      errors.push('Symbol category is required and cannot be empty');
    }

    // Length validations to match database constraints
    if (request.componentName && request.componentName.length > 100) {
      errors.push('Component name must not exceed 100 characters');
    }

    if (request.symbolType && request.symbolType.length > 50) {
      errors.push('Symbol type must not exceed 50 characters');
    }

    if (request.symbolCategory && request.symbolCategory.length > 20) {
      errors.push('Symbol category must not exceed 20 characters');
    }

    // Industry standards validation
    if (request.industryStandards && request.industryStandards.length > 0) {
      const validStandards = ['IEEE', 'IEC', 'ANSI', 'JIS', 'DIN', 'BS', 'UL'];
      const invalidStandards = request.industryStandards.filter(
        standard => !validStandards.includes(standard)
      );
      if (invalidStandards.length > 0) {
        errors.push(`Invalid industry standards: ${invalidStandards.join(', ')}`);
      }
    }

    // Properties validation
    if (request.properties && request.properties.length > 0) {
      request.properties.forEach((prop, index) => {
        if (!prop.propertyName || prop.propertyName.trim().length === 0) {
          errors.push(`Property ${index + 1}: Property name is required`);
        }
        if (!prop.propertyValue || prop.propertyValue.trim().length === 0) {
          errors.push(`Property ${index + 1}: Property value is required`);
        }
        if (prop.propertyName && prop.propertyName.length > 50) {
          errors.push(`Property ${index + 1}: Property name must not exceed 50 characters`);
        }
        if (prop.propertyValue && prop.propertyValue.length > 100) {
          errors.push(`Property ${index + 1}: Property value must not exceed 100 characters`);
        }
      });
    }

    // Ratings validation
    if (request.ratings && request.ratings.length > 0) {
      request.ratings.forEach((rating, index) => {
        if (!rating.ratingType || rating.ratingType.trim().length === 0) {
          errors.push(`Rating ${index + 1}: Rating type is required`);
        }
        if (!rating.unit || rating.unit.trim().length === 0) {
          errors.push(`Rating ${index + 1}: Unit is required`);
        }
        if (rating.minValue !== undefined && rating.maxValue !== undefined && rating.minValue > rating.maxValue) {
          errors.push(`Rating ${index + 1}: Minimum value cannot be greater than maximum value`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Error handling helper
   */
  private handleError(res: Response, error: any, defaultMessage: string): void {
    console.error('Component Controller Error:', error);

    if (error instanceof ComponentLibraryError || error instanceof ComponentIdentificationError) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details
      });
    } else {
      res.status(500).json({
        success: false,
        error: defaultMessage,
        code: 'INTERNAL_SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}