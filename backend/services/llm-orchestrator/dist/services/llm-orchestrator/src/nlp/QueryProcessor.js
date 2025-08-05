"use strict";
/**
 * QueryProcessor - Main query processing pipeline for NLP operations
 * Orchestrates classification, extraction, optimization, and validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryProcessor = void 0;
const uuid_1 = require("uuid");
const QueryClassifier_1 = require("./QueryClassifier");
const ContextExtractor_1 = require("./ContextExtractor");
const QueryOptimizer_1 = require("./QueryOptimizer");
const QueryValidator_1 = require("./QueryValidator");
const SuggestionEngine_1 = require("./SuggestionEngine");
const nlp_types_1 = require("../../../../shared/types/nlp.types");
class QueryProcessor {
    constructor(config) {
        this.config = config;
        this.classifier = new QueryClassifier_1.QueryClassifier(config.classification);
        this.contextExtractor = new ContextExtractor_1.ContextExtractor(config.extraction);
        this.optimizer = new QueryOptimizer_1.QueryOptimizer(config.optimization);
        this.validator = new QueryValidator_1.QueryValidator(config.validation);
        this.suggestionEngine = new SuggestionEngine_1.SuggestionEngine();
    }
    /**
     * Process a complete query through the NLP pipeline
     * @param request - Query processing request
     * @returns Processed query with all NLP enhancements
     */
    async processQuery(request) {
        const queryId = (0, uuid_1.v4)();
        const startTime = Date.now();
        const processingStages = [];
        try {
            // Stage 1: Input Validation and Sanitization
            const validationStage = await this.executeStage('validation', () => this.validator.validate(request.queryText));
            processingStages.push(validationStage);
            if (!validationStage.success) {
                throw this.createNLPError(nlp_types_1.NLPErrorCodes.VALIDATION_FAILED, 'validation', 'Query validation failed', queryId, request.sessionId);
            }
            const sanitizedText = validationStage.metadata.result.sanitizedText;
            // Stage 2: Intent Classification
            const classificationStage = await this.executeStage('classification', () => this.classifier.classifyIntent(sanitizedText));
            processingStages.push(classificationStage);
            if (!classificationStage.success) {
                throw this.createNLPError(nlp_types_1.NLPErrorCodes.CLASSIFICATION_FAILED, 'classification', 'Intent classification failed', queryId, request.sessionId);
            }
            const classificationResult = classificationStage.metadata.result;
            // Stage 3: Context Extraction
            const extractionStage = await this.executeStage('extraction', () => this.contextExtractor.extractContext(sanitizedText, request.context, request.documentIds));
            processingStages.push(extractionStage);
            if (!extractionStage.success) {
                throw this.createNLPError(nlp_types_1.NLPErrorCodes.EXTRACTION_FAILED, 'extraction', 'Context extraction failed', queryId, request.sessionId);
            }
            const extractionResult = extractionStage.metadata.result;
            // Stage 4: Query Optimization
            const optimizationStage = await this.executeStage('optimization', () => this.optimizer.optimizeForProviders(sanitizedText, classificationResult.intent, extractionResult));
            processingStages.push(optimizationStage);
            if (!optimizationStage.success) {
                throw this.createNLPError(nlp_types_1.NLPErrorCodes.OPTIMIZATION_FAILED, 'optimization', 'Query optimization failed', queryId, request.sessionId);
            }
            const optimizationResult = optimizationStage.metadata.result;
            // Build processed query result
            const processedQuery = {
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
        }
        catch (error) {
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
    async executeStage(stageName, operation) {
        const startTime = new Date();
        try {
            const result = await operation();
            const endTime = new Date();
            return {
                stage: stageName,
                startTime,
                endTime,
                duration: endTime.getTime() - startTime.getTime(),
                success: true,
                metadata: { result }
            };
        }
        catch (error) {
            const endTime = new Date();
            return {
                stage: stageName,
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
    buildProcessingMetadata(stages) {
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
                intentConfidence: classificationStage?.metadata?.result?.intent?.confidence || 0,
                entityConfidence: extractionStage?.metadata?.result?.extractionConfidence || 0,
                contextRelevance: extractionStage?.metadata?.result?.contextScore || 0
            }
        };
    }
    /**
     * Create standardized NLP error
     */
    createNLPError(code, stage, message, queryId, sessionId, details) {
        const error = new Error(message);
        error.code = code;
        error.stage = stage;
        error.queryId = queryId;
        error.sessionId = sessionId;
        error.details = details;
        return error;
    }
    /**
     * Log analytics data for query processing
     */
    async logAnalytics(queryId, sessionId, stages) {
        if (!this.config.performance.enableAnalytics) {
            return;
        }
        try {
            const analytics = {
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
        }
        catch (error) {
            console.error('[QueryProcessor] Failed to log analytics:', error);
        }
    }
    /**
     * Get processing statistics for monitoring
     */
    getProcessingStats() {
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
    async healthCheck() {
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
exports.QueryProcessor = QueryProcessor;
//# sourceMappingURL=QueryProcessor.js.map