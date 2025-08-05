/**
 * Analysis controller for LLM-based electrical drawing analysis
 */

import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { OpenAIProvider } from '../providers/openai.provider';
import { PromptService } from '../templates/prompt.service';
import { CircuitBreaker } from '../utils/circuit-breaker';
import { RateLimiter, RateLimitExceededError } from '../utils/rate-limiter';
import { createSessionRateLimiter, createProviderRateLimiter } from '../utils/rate-limiter';
import { createCircuitBreaker } from '../utils/circuit-breaker';
import { QueryProcessor } from '../nlp/QueryProcessor';
import { SuggestionEngine } from '../nlp/SuggestionEngine';
import type { ProcessQueryRequest, GetSuggestionsRequest, NLPConfig } from '../../../../shared/types/nlp.types';
// Local type definitions for LLM analysis
export interface AnalysisRequest {
  sessionId: string;
  documentId: string;
  prompt?: string;
  templateName?: string;
  templateVariables?: Record<string, string | number | boolean>;
  options?: {
    maxTokens?: number;
    temperature?: number;
    model?: string;
  };
}

export interface AnalysisResponse {
  analysisId: string;
  result: string;
  confidence: number;
  processingTime: number;
  provider: string;
  templateUsed?: string | undefined;
  timestamp: Date;
  metadata: {
    model: string;
    tokenUsage?: {
      readonly prompt: number;
      readonly completion: number;
      readonly total: number;
    } | undefined;
    readonly imageCount: number;
    readonly promptLength: number;
  };
}

export interface AnalysisStatusResponse {
  analysisId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: string;
  error?: string;
  processingTime?: number;
  timestamp: Date;
}

export enum AnalysisErrorCodes {
  RATE_LIMITED = 'RATE_LIMITED',
  IMAGES_NOT_FOUND = 'IMAGES_NOT_FOUND',
  MISSING_ANALYSIS_ID = 'MISSING_ANALYSIS_ID',
  ANALYSIS_NOT_FOUND = 'ANALYSIS_NOT_FOUND',
  INVALID_REQUEST = 'INVALID_REQUEST',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR'
}

export class AnalysisController {
  private openaiProvider: OpenAIProvider;
  private promptService: PromptService;
  private circuitBreaker: CircuitBreaker;
  private sessionRateLimit: RateLimiter;
  private providerRateLimit: RateLimiter;
  private analysisResults: Map<string, AnalysisResponse | { error: string }> = new Map();
  private queryProcessor: QueryProcessor;
  private suggestionEngine: SuggestionEngine;

  constructor() {
    // Initialize OpenAI provider
    this.openaiProvider = new OpenAIProvider({
      apiKey: process.env.OPENAI_API_KEY || '',
      timeout: 30000,
      retryAttempts: 3,
    });

    // Initialize prompt service
    this.promptService = new PromptService();

    // Initialize circuit breaker for OpenAI
    this.circuitBreaker = createCircuitBreaker('openai-provider', {
      failureThreshold: 5,
      timeout: 30000,
      recoveryTime: 60000,
      resetTimeout: 300000,
    });

    // Initialize rate limiters
    this.sessionRateLimit = createSessionRateLimiter();
    this.providerRateLimit = createProviderRateLimiter('openai');

    // Initialize NLP components
    const nlpConfig: NLPConfig = {
      classification: {
        confidenceThreshold: 0.6,
        fallbackIntent: 'general_question',
        scoringWeights: {
          componentKeywordWeight: 0.4,
          componentDesignatorWeight: 1.5,
          componentPatternWeight: 0.6,
          componentValueWeight: 0.5,
          componentTermWeight: 0.3,
          schematicKeywordWeight: 0.3,
          schematicPatternWeight: 0.4,
          schematicTermWeight: 0.3,
          generalKeywordWeight: 0.2,
          questionStartWeight: 0.3,
          questionEndWeight: 0.1,
          generalReductionFactor: 0.5,
          dominantIntentBoost: 0.2,
          scoreNormalizationBoost: 1.2
        }
      },
      extraction: {
        entityTypes: ['component', 'location', 'property', 'measurement'],
        confidenceThreshold: 0.5,
        maxEntities: 20
      },
      optimization: {
        enableCaching: true,
        cacheTimeout: 300,
        maxOptimizationTime: 5000
      },
      validation: {
        enableSanitization: true,
        maxQueryLength: 2000,
        blockedPatterns: []
      },
      performance: {
        maxProcessingTime: 10000,
        enableMetrics: true,
        enableAnalytics: true
      }
    };

    this.queryProcessor = new QueryProcessor(nlpConfig);
    this.suggestionEngine = new SuggestionEngine();
  }

  /**
   * Analyze images using LLM
   */
  analyzeImages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const analysisRequest = this.validateAnalysisRequest(req.body);
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

      // Rate limiting checks
      try {
        await this.sessionRateLimit.consume(analysisRequest.sessionId);
        await this.providerRateLimit.consume(`${clientIP}:${analysisRequest.sessionId}`);
      } catch (error) {
        if (error instanceof RateLimitExceededError) {
          res.status(429).json({
            error: {
              code: AnalysisErrorCodes.RATE_LIMITED,
              message: error.message,
              retryAfter: error.rateLimitInfo.retryAfter,
              timestamp: new Date().toISOString(),
            }
          });
          return;
        }
        throw error;
      }

      // Load images from converted files
      const imagePaths = await this.getDocumentImages(
        analysisRequest.sessionId, 
        analysisRequest.documentId
      );

      if (imagePaths.length === 0) {
        res.status(404).json({
          error: {
            code: AnalysisErrorCodes.IMAGES_NOT_FOUND,
            message: `No converted images found for document ${analysisRequest.documentId}`,
            timestamp: new Date().toISOString(),
          }
        });
        return;
      }

      // Load image buffers
      const imageBuffers = await Promise.all(
        imagePaths.map(imagePath => fs.readFile(imagePath))
      );

      // Generate or use provided prompt
      const prompt = await this.generatePrompt(analysisRequest);

      // Perform analysis with circuit breaker protection
      const result = await this.circuitBreaker.execute(async () => {
        return await this.openaiProvider.analyze(
          imageBuffers,
          prompt,
          analysisRequest.options
        );
      });

      // Store result for status checking
      this.analysisResults.set(result.analysisId, {
        ...result,
        templateUsed: analysisRequest.templateName,
      });

      // Return response
      const response: AnalysisResponse = {
        ...result,
        templateUsed: analysisRequest.templateName,
      };

      res.status(200).json(response);

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get analysis status by ID
   */
  getAnalysisStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { analysisId } = req.params;

      if (!analysisId) {
        res.status(400).json({
          error: {
            code: AnalysisErrorCodes.MISSING_ANALYSIS_ID,
            message: 'Analysis ID is required',
            timestamp: new Date().toISOString(),
          }
        });
        return;
      }

      const result = this.analysisResults.get(analysisId);

      if (!result) {
        res.status(404).json({
          error: {
            code: AnalysisErrorCodes.ANALYSIS_NOT_FOUND,
            message: `Analysis ${analysisId} not found`,
            timestamp: new Date().toISOString(),
          }
        });
        return;
      }

      let response: AnalysisStatusResponse;

      if ('error' in result) {
        response = {
          analysisId,
          status: 'failed',
          error: result.error,
          timestamp: new Date(),
        };
      } else {
        response = {
          analysisId,
          status: 'completed',
          result: result.result,
          processingTime: result.processingTime,
          timestamp: result.timestamp,
        };
      }

      res.status(200).json(response);

    } catch (error) {
      next(error);
    }
  };

  /**
   * List available prompt templates
   */
  listTemplates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { domain } = req.query;
      
      let templates;
      if (domain && (domain === 'electrical' || domain === 'general')) {
        templates = this.promptService.getTemplatesByDomain(domain as 'electrical' | 'general');
      } else {
        templates = this.promptService.listTemplates();
      }

      res.status(200).json({
        templates: templates.map(template => ({
          name: template.name,
          description: template.description,
          domain: template.domain,
          variables: template.variables,
          version: template.version,
        }))
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Process natural language query for electrical drawing analysis
   */
  processQuery = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request: ProcessQueryRequest = this.validateProcessQueryRequest(req.body);

      // Rate limiting
      const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
      try {
        await this.sessionRateLimit.consume(request.sessionId);
        await this.providerRateLimit.consume(`${clientIP}:${request.sessionId}`);
      } catch (error) {
        if (error instanceof RateLimitExceededError) {
          res.status(429).json({
            error: {
              code: AnalysisErrorCodes.RATE_LIMITED,
              message: error.message,
              retryAfter: error.rateLimitInfo.retryAfter,
              timestamp: new Date().toISOString(),
            }
          });
          return;
        }
        throw error;
      }

      // Process query through NLP pipeline
      const result = await this.queryProcessor.processQuery(request);

      if (result.success) {
        res.status(200).json({
          success: true,
          processedQuery: result.processedQuery,
          processingTime: result.processingTime
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          processingTime: result.processingTime
        });
      }

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get autocomplete suggestions for query input
   */
  getSuggestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const request: GetSuggestionsRequest = this.validateSuggestionsRequest(req.body);

      // Rate limiting for suggestions (lighter)
      try {
        await this.sessionRateLimit.consume(request.sessionId, 0.1); // Use 10% of rate limit
      } catch (error) {
        if (error instanceof RateLimitExceededError) {
          res.status(429).json({
            error: {
              code: AnalysisErrorCodes.RATE_LIMITED,
              message: 'Rate limit exceeded for suggestions',
              retryAfter: error.rateLimitInfo.retryAfter,
              timestamp: new Date().toISOString(),
            }
          });
          return;
        }
        throw error;
      }

      // Generate suggestions
      const response = await this.suggestionEngine.generateSuggestions(request);

      if (response.success) {
        res.status(200).json({
          success: true,
          suggestions: response.suggestions,
          processingTime: response.processingTime
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to generate suggestions',
          processingTime: response.processingTime
        });
      }

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get NLP processing statistics
   */
  getNLPStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = this.queryProcessor.getProcessingStats();
      const healthCheck = await this.queryProcessor.healthCheck();

      res.status(200).json({
        stats,
        health: healthCheck,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Health check endpoint
   */
  healthCheck = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const openaiHealth = await this.openaiProvider.healthCheck();
      const circuitBreakerMetrics = this.circuitBreaker.getMetrics();
      const rateLimitStats = this.sessionRateLimit.getStats();

      const nlpHealth = await this.queryProcessor.healthCheck();

      const isHealthy = openaiHealth && 
                       circuitBreakerMetrics.state === 'CLOSED' &&
                       this.openaiProvider.validateConfiguration() &&
                       nlpHealth.healthy;

      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          openai: openaiHealth ? 'connected' : 'disconnected',
          circuitBreaker: circuitBreakerMetrics.state.toLowerCase(),
          rateLimit: 'active',
          nlp: nlpHealth.healthy ? 'healthy' : 'unhealthy'
        },
        nlpComponents: nlpHealth.components,
        metrics: {
          totalAnalyses: circuitBreakerMetrics.totalRequests,
          successfulAnalyses: circuitBreakerMetrics.successfulRequests,
          failedAnalyses: circuitBreakerMetrics.failedRequests,
          circuitBreakerState: circuitBreakerMetrics.state,
          activeRateLimitKeys: rateLimitStats.activeKeys,
        }
      });

    } catch (error) {
      next(error);
    }
  };

  private validateAnalysisRequest(body: any): AnalysisRequest {
    const errors: string[] = [];

    if (!body.sessionId || typeof body.sessionId !== 'string') {
      errors.push('sessionId is required and must be a string');
    }

    if (!body.documentId || typeof body.documentId !== 'string') {
      errors.push('documentId is required and must be a string');
    }

    if (body.prompt && typeof body.prompt !== 'string') {
      errors.push('prompt must be a string');
    }

    if (body.templateName && typeof body.templateName !== 'string') {
      errors.push('templateName must be a string');
    }

    if (!body.prompt && !body.templateName) {
      errors.push('Either prompt or templateName must be provided');
    }

    // Validate template variables if provided
    if (body.templateVariables && typeof body.templateVariables !== 'object') {
      errors.push('templateVariables must be an object');
    }

    // Validate options if provided
    if (body.options && typeof body.options !== 'object') {
      errors.push('options must be an object');
    } else if (body.options) {
      if (body.options.maxTokens && (typeof body.options.maxTokens !== 'number' || body.options.maxTokens < 1)) {
        errors.push('options.maxTokens must be a positive number');
      }
      if (body.options.temperature && (typeof body.options.temperature !== 'number' || body.options.temperature < 0 || body.options.temperature > 2)) {
        errors.push('options.temperature must be a number between 0 and 2');
      }
      if (body.options.model && typeof body.options.model !== 'string') {
        errors.push('options.model must be a string');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join(', ')}`);
    }

    return body as AnalysisRequest;
  }

  private async getDocumentImages(sessionId: string, documentId: string): Promise<string[]> {
    // Based on Story 1.3's file storage structure: sessions/{session-id}/converted/{doc-id}/
    const convertedDir = path.join(
      process.cwd(),
      'backend/services/file-processor/storage/sessions',
      sessionId,
      'converted',
      documentId
    );

    try {
      const files = await fs.readdir(convertedDir);
      const imageFiles = files
        .filter(file => /\.(png|jpg|jpeg)$/i.test(file))
        .sort() // Ensure consistent ordering
        .map(file => path.join(convertedDir, file));

      return imageFiles;
    } catch (error) {
      console.error(`Error reading converted images directory: ${convertedDir}`, error);
      return [];
    }
  }

  private async generatePrompt(request: AnalysisRequest): Promise<string> {
    if (request.prompt) {
      return request.prompt;
    }

    if (request.templateName) {
      try {
        if (request.templateVariables) {
          this.promptService.validateVariables(request.templateName, request.templateVariables);
        }
        
        return this.promptService.generatePrompt(
          request.templateName, 
          request.templateVariables || {}
        );
      } catch (error) {
        throw new Error(`Failed to generate prompt from template '${request.templateName}': ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Default to component identification if no prompt or template specified
    return this.promptService.generatePrompt('component_identification');
  }

  private validateProcessQueryRequest(body: any): ProcessQueryRequest {
    const errors: string[] = [];

    if (!body.queryText || typeof body.queryText !== 'string') {
      errors.push('queryText is required and must be a string');
    }

    if (!body.sessionId || typeof body.sessionId !== 'string') {
      errors.push('sessionId is required and must be a string');
    }

    if (body.documentIds && !Array.isArray(body.documentIds)) {
      errors.push('documentIds must be an array if provided');
    }

    if (body.context && typeof body.context !== 'object') {
      errors.push('context must be an object if provided');
    }

    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join(', ')}`);
    }

    return body as ProcessQueryRequest;
  }

  private validateSuggestionsRequest(body: any): GetSuggestionsRequest {
    const errors: string[] = [];

    if (!body.sessionId || typeof body.sessionId !== 'string') {
      errors.push('sessionId is required and must be a string');
    }

    if (!body.partialQuery || typeof body.partialQuery !== 'string') {
      errors.push('partialQuery is required and must be a string');
    }

    if (body.maxSuggestions && (typeof body.maxSuggestions !== 'number' || body.maxSuggestions < 1)) {
      errors.push('maxSuggestions must be a positive number if provided');
    }

    if (errors.length > 0) {
      throw new Error(`Validation errors: ${errors.join(', ')}`);
    }

    return body as GetSuggestionsRequest;
  }
}