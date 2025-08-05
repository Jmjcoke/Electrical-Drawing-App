/**
 * QueryProcessor - Main query processing pipeline for NLP operations
 * Orchestrates classification, extraction, optimization, and validation
 */

import { v4 as uuidv4 } from 'uuid';
import { QueryClassifier } from './QueryClassifier';
import { ContextExtractor } from './ContextExtractor';
import { QueryOptimizer } from './QueryOptimizer';
import { QueryValidator } from './QueryValidator';
import { SuggestionEngine } from './SuggestionEngine';
import type {
  ProcessedQuery,
  ProcessQueryRequest,
  ProcessQueryResponse,
  QueryProcessingMetadata,
  QueryAnalytics,
  ProcessingStage,
  NLPConfig,
  NLPError
} from '../../../../shared/types/nlp.types';
import { NLPErrorCodes } from '../../../../shared/types/nlp.types';

export class QueryProcessor {
  private readonly classifier: QueryClassifier;
  private readonly contextExtractor: ContextExtractor;
  private readonly optimizer: QueryOptimizer;
  private readonly validator: QueryValidator;
  private readonly suggestionEngine: SuggestionEngine;
  private readonly config: NLPConfig;

  constructor(config: NLPConfig) {
    this.config = config;
    this.classifier = new QueryClassifier(config.classification);
    this.contextExtractor = new ContextExtractor(config.extraction);
    this.optimizer = new QueryOptimizer(config.optimization);
    this.validator = new QueryValidator(config.validation);
    this.suggestionEngine = new SuggestionEngine();
  }

  /**
   * Process a complete query through the NLP pipeline
   * @param request - Query processing request
   * @returns Processed query with all NLP enhancements
   */
  async processQuery(request: ProcessQueryRequest): Promise<ProcessQueryResponse> {
    const queryId = uuidv4();
    const startTime = Date.now();
    const processingStages: ProcessingStage[] = [];

    try {
      // Stage 1: Input Validation and Sanitization
      const validationStage = await this.executeStage(
        'validation',
        () => this.validator.validate(request.queryText)
      );
      processingStages.push(validationStage);

      if (!validationStage.success) {
        throw this.createNLPError(
          NLPErrorCodes.VALIDATION_FAILED,
          'validation',
          'Query validation failed',
          queryId,
          request.sessionId
        );
      }

      const sanitizedText = (validationStage.metadata as any).result.sanitizedText;

      // Stage 2: Intent Classification
      const classificationStage = await this.executeStage(
        'classification',
        () => this.classifier.classifyIntent(sanitizedText)
      );
      processingStages.push(classificationStage);

      if (!classificationStage.success) {
        throw this.createNLPError(
          NLPErrorCodes.CLASSIFICATION_FAILED,
          'classification',
          'Intent classification failed',
          queryId,
          request.sessionId
        );
      }

      const classificationResult = (classificationStage.metadata as any).result;

      // Stage 3: Context Extraction
      const extractionStage = await this.executeStage(
        'extraction',
        () => this.contextExtractor.extractContext(
          sanitizedText,
          request.context,
          request.documentIds
        )
      );
      processingStages.push(extractionStage);

      if (!extractionStage.success) {
        throw this.createNLPError(
          NLPErrorCodes.EXTRACTION_FAILED,
          'extraction',
          'Context extraction failed',
          queryId,
          request.sessionId
        );
      }

      const extractionResult = (extractionStage.metadata as any).result;

      // Stage 4: Query Optimization
      const optimizationStage = await this.executeStage(
        'optimization',
        () => this.optimizer.optimizeForProviders(
          sanitizedText,
          classificationResult.intent,
          extractionResult
        )
      );
      processingStages.push(optimizationStage);

      if (!optimizationStage.success) {
        throw this.createNLPError(
          NLPErrorCodes.OPTIMIZATION_FAILED,
          'optimization',
          'Query optimization failed',
          queryId,
          request.sessionId
        );
      }

      const optimizationResult = (optimizationStage.metadata as any).result;

      // Build processed query result
      const processedQuery: ProcessedQuery = {
        id: queryId,
        originalText: request.queryText,
        cleanedText: sanitizedText,
        intent: classificationResult.intent,
        intentConfidence: classificationResult.intent.confidence,
        entities: extractionResult.entities,
        context: {
          sessionHistory: request.context?.sessionHistory || [],
          documentContext: extractionResult.relevantDocuments,
          previousQueries: request.context?.previousQueries || [],
          conversationFlow: request.context?.conversationFlow || [],
          extractedTopics: extractionResult.topics
        },
        optimizedPrompts: optimizationResult.optimizedPrompts,
        processingMetadata: this.buildProcessingMetadata(processingStages),
        timestamp: new Date()
      };

      // Log analytics
      await this.logAnalytics(queryId, request.sessionId, processingStages);

      const totalTime = Date.now() - startTime;

      return {
        success: true,
        processedQuery,
        processingTime: totalTime
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      
      // Log failed analytics
      await this.logAnalytics(queryId, request.sessionId, processingStages);

      if (error instanceof Error && 'code' in error) {
        return {
          success: false,
          error: error.message,
          processingTime: totalTime
        };
      }

      return {
        success: false,
        error: 'Unknown processing error occurred',
        processingTime: totalTime
      };
    }
  }

  /**
   * Execute a processing stage with timing and error handling
   */
  private async executeStage(
    stageName: string,
    operation: () => Promise<any>
  ): Promise<ProcessingStage> {
    const startTime = new Date();
    
    try {
      const result = await operation();
      const endTime = new Date();

      return {
        stage: stageName as any,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        success: true,
        metadata: { result }
      };
    } catch (error) {
      const endTime = new Date();

      return {
        stage: stageName as any,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: { error }
      };
    }
  }

  /**
   * Build processing metadata from stages
   */
  private buildProcessingMetadata(stages: ProcessingStage[]): QueryProcessingMetadata {
    const classificationStage = stages.find(s => s.stage === 'classification');
    const extractionStage = stages.find(s => s.stage === 'extraction');
    const optimizationStage = stages.find(s => s.stage === 'optimization');

    const totalTime = stages.reduce((sum, stage) => sum + stage.duration, 0);

    return {
      classificationTime: classificationStage?.duration || 0,
      extractionTime: extractionStage?.duration || 0,
      optimizationTime: optimizationStage?.duration || 0,
      totalProcessingTime: totalTime,
      cacheHit: false, // TODO: Implement cache checking
      confidenceBreakdown: {
        intentConfidence: (classificationStage?.metadata as any)?.result?.intent?.confidence || 0,
        entityConfidence: (extractionStage?.metadata as any)?.result?.extractionConfidence || 0,
        contextRelevance: (extractionStage?.metadata as any)?.result?.contextScore || 0
      }
    };
  }

  /**
   * Create standardized NLP error
   */
  private createNLPError(
    code: NLPErrorCodes,
    stage: string,
    message: string,
    queryId?: string,
    sessionId?: string,
    details?: Record<string, any>
  ): NLPError {
    const error = new Error(message) as NLPError;
    (error as any).code = code;
    (error as any).stage = stage;
    (error as any).queryId = queryId;
    (error as any).sessionId = sessionId;
    (error as any).details = details;
    return error;
  }

  /**
   * Log analytics data for query processing
   */
  private async logAnalytics(
    queryId: string,
    sessionId: string,
    stages: ProcessingStage[]
  ): Promise<void> {
    if (!this.config.performance.enableAnalytics) {
      return;
    }

    try {
      const analytics: QueryAnalytics = {
        queryId,
        sessionId,
        processingStages: stages,
        performanceMetrics: {
          totalProcessingTime: stages.reduce((sum, stage) => sum + stage.duration, 0),
          cacheHitRate: 0, // TODO: Implement cache metrics
          memoryUsage: process.memoryUsage().heapUsed
        },
        timestamp: new Date()
      };

      // TODO: Implement analytics storage/logging
      console.log('[QueryProcessor] Analytics:', JSON.stringify(analytics, null, 2));
    } catch (error) {
      console.error('[QueryProcessor] Failed to log analytics:', error);
    }
  }

  /**
   * Get processing statistics for monitoring
   */
  getProcessingStats(): Record<string, any> {
    return {
      classifier: this.classifier.getStats(),
      contextExtractor: this.contextExtractor.getStats(),
      optimizer: this.optimizer.getStats(),
      validator: this.validator.getStats(),
      config: this.config
    };
  }

  /**
   * Health check for all NLP components
   */
  async healthCheck(): Promise<{ healthy: boolean; components: Record<string, boolean> }> {
    const components = {
      classifier: await this.classifier.healthCheck(),
      contextExtractor: await this.contextExtractor.healthCheck(),
      optimizer: await this.optimizer.healthCheck(),
      validator: await this.validator.healthCheck(),
      suggestionEngine: await this.suggestionEngine.healthCheck()
    };

    const healthy = Object.values(components).every(status => status);

    return { healthy, components };
  }
}