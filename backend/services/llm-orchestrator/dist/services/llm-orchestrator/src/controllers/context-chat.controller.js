"use strict";
/**
 * Context-Enhanced Chat Controller
 * Integrates context management with chat interface for conversational electrical drawing analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextChatController = void 0;
const ConversationContext_1 = require("../context/ConversationContext");
const ContextAwareQueryEnhancer_1 = require("../context/ContextAwareQueryEnhancer");
const ContextSummarizer_1 = require("../context/ContextSummarizer");
const analysis_controller_1 = require("./analysis.controller");
const context_websocket_service_1 = require("../websocket/context-websocket.service");
class ContextChatController extends analysis_controller_1.AnalysisController {
    constructor() {
        super();
        /**
         * Process a context-aware chat query
         */
        this.processChatQuery = async (req, res, next) => {
            try {
                const request = this.validateContextChatRequest(req.body);
                const startTime = Date.now();
                // Reset context if requested
                if (request.resetContext) {
                    await this.contextService.resetContext(request.sessionId);
                }
                // Get or create conversation context
                let conversationContext = await this.contextService.getContextBySessionId(request.sessionId);
                if (!conversationContext) {
                    conversationContext = await this.contextService.createContext(request.sessionId);
                }
                // Enhance the query with context
                const enhancementResult = await this.queryEnhancer.enhanceQuery(request.queryText, conversationContext, request.sessionId);
                // Process the enhanced query (this would integrate with your existing LLM processing)
                const analysisResult = await this.processEnhancedQuery(enhancementResult.enhancedQuery, request, enhancementResult);
                // Create conversation turn
                const conversationTurn = {
                    id: `turn-${Date.now()}`,
                    turnNumber: conversationContext.conversationThread.length + 1,
                    query: {
                        id: `query-${Date.now()}`,
                        text: request.queryText,
                        type: 'component_identification', // Would be determined by NLP processing
                        timestamp: new Date(),
                        documentIds: request.documentIds || [],
                        processedText: enhancementResult.enhancedQuery,
                        extractedEntities: [],
                        intent: 'component_identification',
                        confidence: enhancementResult.confidence
                    },
                    response: analysisResult,
                    contextContributions: enhancementResult.contextSources.map(s => s.type),
                    followUpDetected: enhancementResult.detectedAmbiguities.length > 0,
                    timestamp: new Date()
                };
                // Update conversation context with new turn
                const updatedContext = await this.contextService.addTurn(conversationContext.id, conversationTurn.query, conversationTurn.response, conversationTurn.followUpDetected);
                // Broadcast context update via WebSocket
                if (updatedContext) {
                    context_websocket_service_1.contextWebSocketService.broadcastContextUpdate(request.sessionId, updatedContext.id, updatedContext.conversationThread.length);
                }
                // Broadcast query processing result
                context_websocket_service_1.contextWebSocketService.broadcastQueryProcessed(request.sessionId, conversationTurn.query.id, enhancementResult, Date.now() - startTime);
                // Broadcast follow-up detection if detected
                if (enhancementResult.detectedAmbiguities.length > 0) {
                    const references = enhancementResult.detectedAmbiguities.map(amb => ({
                        type: amb.type,
                        text: amb.text,
                        resolvedEntity: amb.possibleResolutions[0],
                        confidence: amb.confidence
                    }));
                    context_websocket_service_1.contextWebSocketService.broadcastFollowUpDetected(request.sessionId, conversationTurn.query.id, references);
                }
                // Broadcast context visualization if requested
                if (request.includeContextVisualization && updatedContext) {
                    const visualization = this.buildContextVisualization(enhancementResult, updatedContext);
                    context_websocket_service_1.contextWebSocketService.broadcastContextVisualization(request.sessionId, visualization);
                }
                // Prepare response
                const responseData = {
                    analysisResult,
                    originalQuery: enhancementResult.originalQuery,
                    enhancedQuery: enhancementResult.enhancedQuery,
                    contextSources: enhancementResult.contextSources
                };
                if (request.includeContextVisualization && updatedContext) {
                    responseData.conversationHistory = updatedContext.conversationThread.slice(-10);
                    responseData.contextVisualization = this.buildContextVisualization(enhancementResult, updatedContext);
                    if (updatedContext.conversationThread.length > 5) {
                        responseData.contextSummary = await this.generateContextSummary(updatedContext);
                    }
                }
                const response = {
                    success: true,
                    response: responseData,
                    processingTime: Date.now() - startTime,
                    timestamp: new Date()
                };
                res.status(200).json(response);
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * Get context-aware autocomplete suggestions
         */
        this.getContextualSuggestions = async (req, res, next) => {
            try {
                const request = this.validateContextSuggestionsRequest(req.body);
                const startTime = Date.now();
                // Get conversation context
                const conversationContext = await this.contextService.getContextBySessionId(request.sessionId);
                let contextualSuggestions = [];
                if (conversationContext && request.includeContextual) {
                    contextualSuggestions = this.generateContextualSuggestions(request.partialQuery, conversationContext);
                }
                // Regular suggestions would be integrated here from parent class
                // const regularSuggestionsResult = await super.getSuggestions(req, res, next);
                const response = {
                    success: true,
                    suggestions: [
                        // Add contextual suggestions with higher priority
                        ...contextualSuggestions.map(cs => ({
                            text: cs.suggestion,
                            type: 'contextual',
                            confidence: 0.9,
                            contextSource: cs.relevantContext
                        })),
                        // Regular suggestions would be added here from parent class
                    ],
                    contextualSuggestions,
                    processingTime: Date.now() - startTime
                };
                res.status(200).json(response);
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * Get conversation history with context
         */
        this.getConversationHistory = async (req, res, next) => {
            try {
                const request = this.validateConversationHistoryRequest(req.query);
                const startTime = Date.now();
                const conversationContext = await this.contextService.getContextBySessionId(request.sessionId);
                if (!conversationContext) {
                    res.status(404).json({
                        success: false,
                        error: 'No conversation context found for session',
                        processingTime: Date.now() - startTime
                    });
                    return;
                }
                // Apply limit if specified
                const history = request.limit
                    ? conversationContext.conversationThread.slice(-request.limit)
                    : conversationContext.conversationThread;
                // Generate context summary if requested
                let contextSummary;
                if (request.summarize && conversationContext.conversationThread.length > 0) {
                    const summary = await this.contextSummarizer.generateContextSummary(conversationContext);
                    contextSummary = {
                        summary: summary.summary,
                        keyPoints: summary.keyPoints,
                        relevantEntities: summary.relevantEntities,
                        totalTurns: summary.originalTurnCount
                    };
                }
                // Calculate metrics
                const contextMetrics = this.calculateContextMetrics(conversationContext);
                const response = {
                    success: true,
                    conversationHistory: history,
                    contextMetrics
                };
                if (contextSummary) {
                    response.contextSummary = contextSummary;
                }
                res.status(200).json(response);
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * Reset conversation context
         */
        this.resetConversationContext = async (req, res, next) => {
            try {
                const { sessionId } = req.params;
                if (!sessionId) {
                    res.status(400).json({
                        success: false,
                        error: 'Session ID is required',
                        timestamp: new Date()
                    });
                    return;
                }
                await this.contextService.resetContext(sessionId);
                // Broadcast context reset via WebSocket
                context_websocket_service_1.contextWebSocketService.broadcastContextUpdate(sessionId, `context-${sessionId}`, 0);
                res.status(200).json({
                    success: true,
                    message: 'Conversation context reset successfully',
                    timestamp: new Date()
                });
            }
            catch (error) {
                next(error);
            }
        };
        /**
         * Get context health and statistics
         */
        this.getContextHealth = async (req, res, next) => {
            try {
                const { sessionId } = req.params;
                // Create a simple health check since the service doesn't have one
                const health = {
                    healthy: true,
                    activeContexts: 0, // Would need to be implemented
                    memoryUsage: { used: 0, total: 0 },
                    avgResponseTime: 0
                };
                let sessionContext;
                if (sessionId) {
                    sessionContext = await this.contextService.getContextBySessionId(sessionId);
                }
                res.status(200).json({
                    contextService: health,
                    sessionContext: sessionContext ? {
                        id: sessionContext.id,
                        turnCount: sessionContext.conversationThread.length,
                        lastUpdated: sessionContext.lastUpdated,
                        expiresAt: sessionContext.expiresAt,
                        entityCount: sessionContext.cumulativeContext.extractedEntities.size,
                        keyInsights: sessionContext.cumulativeContext.keyInsights.length
                    } : null,
                    timestamp: new Date()
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.contextService = new ConversationContext_1.ConversationContextService({
            maxTurnsPerContext: 100,
            compressionThreshold: 0.7,
            expirationHours: 24,
            cleanupIntervalMinutes: 60
        });
        this.queryEnhancer = new ContextAwareQueryEnhancer_1.ContextAwareQueryEnhancer({
            maxContextLength: 2000,
            entityResolutionThreshold: 0.7,
            ambiguityDetectionThreshold: 0.6,
            contextRelevanceThreshold: 0.4,
            maxContextSources: 5,
            enableDebugMode: true
        });
        this.contextSummarizer = new ContextSummarizer_1.ContextSummarizer({
            maxContextLength: 50,
            compressionRatio: 0.3,
            relevanceThreshold: 0.4,
            preserveRecentTurns: 5
        });
    }
    // Private helper methods
    async processEnhancedQuery(enhancedQuery, _request, enhancementResult) {
        // Mock analysis result - in production this would integrate with your LLM processing
        // You would use the enhanced query to get better results from your LLM
        return {
            summary: `Analysis of: ${enhancedQuery}`,
            components: [],
            confidence: {
                overall: enhancementResult.confidence,
                breakdown: {},
                reasoning: 'Context-enhanced analysis'
            },
            consensus: {
                agreementLevel: 0.9,
                conflictingResponses: [],
                consensusResponse: `Context-aware response for: ${enhancedQuery}`
            }
        };
    }
    buildContextVisualization(enhancementResult, context) {
        return {
            influencingQueries: enhancementResult.contextSources
                .filter((cs) => cs.turnId)
                .map((cs) => {
                const turn = context.conversationThread.find(t => t.id === cs.turnId);
                return turn ? {
                    turnId: turn.id,
                    queryText: turn.query.text,
                    relevance: cs.relevance,
                    timestamp: turn.timestamp
                } : null;
            })
                .filter(Boolean),
            resolvedEntities: enhancementResult.resolvedEntities.map((re) => ({
                originalText: re.originalText,
                resolvedText: re.resolvedText,
                confidence: re.confidence
            })),
            detectedAmbiguities: enhancementResult.detectedAmbiguities.map((da) => ({
                text: da.text,
                type: da.type,
                resolutions: da.possibleResolutions
            }))
        };
    }
    async generateContextSummary(context) {
        const summary = await this.contextSummarizer.generateContextSummary(context);
        return {
            summary: summary.summary,
            keyPoints: summary.keyPoints,
            relevantEntities: summary.relevantEntities
        };
    }
    generateContextualSuggestions(partialQuery, context) {
        const suggestions = [];
        // Generate follow-up suggestions based on recent queries
        const recentTurns = context.conversationThread.slice(-3);
        for (const turn of recentTurns) {
            if (turn.query.text.toLowerCase().includes('resistor')) {
                suggestions.push({
                    type: 'follow_up',
                    suggestion: 'What is the power rating of that resistor?',
                    relevantContext: `Previous query: ${turn.query.text}`
                });
            }
            if (turn.query.text.toLowerCase().includes('component')) {
                suggestions.push({
                    type: 'related',
                    suggestion: 'Show me the connections for this component',
                    relevantContext: `Related to: ${turn.query.text}`
                });
            }
        }
        // Generate entity-based suggestions
        for (const [entity] of context.cumulativeContext.extractedEntities) {
            if (partialQuery.toLowerCase().includes(entity.toLowerCase().substring(0, 3))) {
                suggestions.push({
                    type: 'related',
                    suggestion: `What is the ${entity} specification?`,
                    relevantContext: `Based on entity: ${entity}`
                });
            }
        }
        return suggestions.slice(0, 5); // Limit to 5 suggestions
    }
    calculateContextMetrics(context) {
        const totalTurns = context.conversationThread.length;
        const followUpCount = context.conversationThread.filter(t => t.followUpDetected).length;
        const avgConfidence = totalTurns > 0
            ? context.conversationThread.reduce((sum, t) => sum + (t.response.confidence?.overall || 0), 0) / totalTurns
            : 0;
        const entityCounts = new Map();
        for (const [entity, mentions] of context.cumulativeContext.extractedEntities) {
            entityCounts.set(entity, mentions.length);
        }
        const topEntities = Array.from(entityCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([entity]) => entity);
        return {
            totalTurns,
            followUpDetected: followUpCount,
            avgConfidence,
            topEntities
        };
    }
    // Validation methods
    validateContextChatRequest(body) {
        const errors = [];
        if (!body.sessionId || typeof body.sessionId !== 'string') {
            errors.push('sessionId is required and must be a string');
        }
        if (!body.queryText || typeof body.queryText !== 'string') {
            errors.push('queryText is required and must be a string');
        }
        if (body.documentIds && !Array.isArray(body.documentIds)) {
            errors.push('documentIds must be an array if provided');
        }
        if (body.resetContext && typeof body.resetContext !== 'boolean') {
            errors.push('resetContext must be a boolean if provided');
        }
        if (body.includeContextVisualization && typeof body.includeContextVisualization !== 'boolean') {
            errors.push('includeContextVisualization must be a boolean if provided');
        }
        if (body.maxContextHistory && (typeof body.maxContextHistory !== 'number' || body.maxContextHistory < 1)) {
            errors.push('maxContextHistory must be a positive number if provided');
        }
        if (errors.length > 0) {
            throw new Error(`Validation errors: ${errors.join(', ')}`);
        }
        return body;
    }
    validateContextSuggestionsRequest(body) {
        const errors = [];
        if (!body.sessionId || typeof body.sessionId !== 'string') {
            errors.push('sessionId is required and must be a string');
        }
        if (!body.partialQuery || typeof body.partialQuery !== 'string') {
            errors.push('partialQuery is required and must be a string');
        }
        if (body.maxSuggestions && (typeof body.maxSuggestions !== 'number' || body.maxSuggestions < 1)) {
            errors.push('maxSuggestions must be a positive number if provided');
        }
        if (body.includeContextual && typeof body.includeContextual !== 'boolean') {
            errors.push('includeContextual must be a boolean if provided');
        }
        if (errors.length > 0) {
            throw new Error(`Validation errors: ${errors.join(', ')}`);
        }
        return body;
    }
    validateConversationHistoryRequest(query) {
        const errors = [];
        if (!query.sessionId || typeof query.sessionId !== 'string') {
            errors.push('sessionId is required and must be a string');
        }
        if (query.limit && (typeof query.limit !== 'string' || isNaN(Number(query.limit)) || Number(query.limit) < 1)) {
            errors.push('limit must be a positive number if provided');
        }
        if (query.includeContext && typeof query.includeContext !== 'string') {
            errors.push('includeContext must be a string if provided');
        }
        if (query.summarize && typeof query.summarize !== 'string') {
            errors.push('summarize must be a string if provided');
        }
        if (errors.length > 0) {
            throw new Error(`Validation errors: ${errors.join(', ')}`);
        }
        const result = {
            sessionId: query.sessionId,
            includeContext: query.includeContext === 'true',
            summarize: query.summarize === 'true'
        };
        if (query.limit) {
            result.limit = Number(query.limit);
        }
        return result;
    }
}
exports.ContextChatController = ContextChatController;
//# sourceMappingURL=context-chat.controller.js.map