"use strict";
/**
 * Context-Aware Query Enhancement System
 * Integrates context management with NLP processing to enhance queries with relevant contextual information
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextAwareQueryEnhancer = void 0;
const ContextEnricher_1 = require("./ContextEnricher");
const FollowUpDetector_1 = require("./FollowUpDetector");
class ContextAwareQueryEnhancer {
    constructor(config = {}, contextEnricher, followUpDetector) {
        this.config = {
            maxContextLength: 2000,
            entityResolutionThreshold: 0.7,
            ambiguityDetectionThreshold: 0.6,
            contextRelevanceThreshold: 0.4,
            maxContextSources: 5,
            enableDebugMode: false,
            ...config
        };
        this.contextEnricher = contextEnricher || new ContextEnricher_1.ContextEnricher();
        this.followUpDetector = followUpDetector || new FollowUpDetector_1.FollowUpDetectorService({
            confidenceThreshold: 0.7,
            maxLookbackTurns: 5,
            referencePatterns: {
                pronouns: ['it', 'this', 'that', 'these', 'those', 'they', 'them'],
                temporalWords: ['now', 'then', 'before', 'after', 'next', 'previous'],
                implicitWords: ['component', 'part', 'element', 'device'],
                spatialWords: ['here', 'there', 'above', 'below', 'left', 'right']
            }
        });
        this.promptTemplates = this.initializePromptTemplates();
    }
    /**
     * Enhance query with contextual information from conversation history
     */
    async enhanceQuery(query, conversationContext, sessionId) {
        const startTime = Date.now();
        const debugInfo = this.config.enableDebugMode
            ? this.initializeDebugInfo()
            : undefined;
        try {
            // Step 1: Detect follow-up references and ambiguities
            if (debugInfo)
                this.addProcessingStep(debugInfo, 'ambiguity_detection', query, startTime);
            const ambiguities = await this.detectAmbiguities(query, conversationContext, debugInfo);
            // Step 2: Retrieve relevant context
            if (debugInfo)
                this.addProcessingStep(debugInfo, 'context_retrieval', query, startTime);
            const contextSources = await this.retrieveRelevantContext(query, conversationContext, sessionId, debugInfo);
            // Step 3: Resolve entities and references
            if (debugInfo)
                this.addProcessingStep(debugInfo, 'entity_resolution', query, startTime);
            const resolvedEntities = await this.resolveEntities(query, contextSources, conversationContext, debugInfo);
            // Step 4: Build enhanced query
            if (debugInfo)
                this.addProcessingStep(debugInfo, 'query_enhancement', query, startTime);
            const enhancedQuery = this.buildEnhancedQuery(query, contextSources, resolvedEntities, ambiguities);
            // Step 5: Validate enhancement
            if (debugInfo)
                this.addProcessingStep(debugInfo, 'validation', enhancedQuery, startTime);
            const validationResults = this.validateEnhancement(query, enhancedQuery, contextSources);
            if (debugInfo) {
                debugInfo.validationResults.push(...validationResults);
            }
            // Calculate confidence score
            const confidence = this.calculateEnhancementConfidence(contextSources, resolvedEntities, ambiguities, validationResults);
            const processingTime = Date.now() - startTime;
            const result = {
                originalQuery: query,
                enhancedQuery,
                contextSources,
                resolvedEntities,
                detectedAmbiguities: ambiguities,
                confidence,
                processingTime
            };
            if (debugInfo) {
                result.debugInfo = debugInfo;
            }
            return result;
        }
        catch (error) {
            console.error('Query enhancement failed:', error);
            const errorResult = {
                originalQuery: query,
                enhancedQuery: query, // Fallback to original query
                contextSources: [],
                resolvedEntities: [],
                detectedAmbiguities: [],
                confidence: 0,
                processingTime: Date.now() - startTime
            };
            if (debugInfo) {
                errorResult.debugInfo = debugInfo;
            }
            return errorResult;
        }
    }
    /**
     * Generate context-enhanced prompts for LLM providers
     */
    generateContextEnhancedPrompt(_query, enhancementResult, templateName = 'default') {
        const template = this.promptTemplates.get(templateName);
        if (!template) {
            throw new Error(`Template '${templateName}' not found`);
        }
        let prompt = template.template;
        // Replace query placeholder
        prompt = prompt.replace('{{query}}', enhancementResult.enhancedQuery);
        prompt = prompt.replace('{{original_query}}', enhancementResult.originalQuery);
        // Add context sources
        if (enhancementResult.contextSources.length > 0) {
            const contextText = enhancementResult.contextSources
                .map(source => `[${source.type}] ${source.content}`)
                .join('\n');
            prompt = prompt.replace('{{context}}', contextText);
        }
        else {
            prompt = prompt.replace('{{context}}', '');
        }
        // Add resolved entities
        if (enhancementResult.resolvedEntities.length > 0) {
            const entitiesText = enhancementResult.resolvedEntities
                .map(entity => `${entity.originalText} → ${entity.resolvedText}`)
                .join(', ');
            prompt = prompt.replace('{{resolved_entities}}', entitiesText);
        }
        else {
            prompt = prompt.replace('{{resolved_entities}}', '');
        }
        // Add confidence information
        prompt = prompt.replace('{{confidence}}', enhancementResult.confidence.toFixed(2));
        return prompt.trim();
    }
    /**
     * Create debugging report for enhancement issues
     */
    generateDebugReport(enhancementResult) {
        if (!enhancementResult.debugInfo) {
            return 'Debug mode not enabled. Set enableDebugMode: true in configuration.';
        }
        const debug = enhancementResult.debugInfo;
        let report = '# Query Enhancement Debug Report\n\n';
        // Processing steps
        report += '## Processing Steps\n';
        for (const step of debug.processingSteps) {
            report += `- **${step.step}** (${step.duration}ms)\n`;
            report += `  - Input: ${step.input.substring(0, 100)}${step.input.length > 100 ? '...' : ''}\n`;
            report += `  - Output: ${step.output.substring(0, 100)}${step.output.length > 100 ? '...' : ''}\n`;
        }
        // Context retrieval
        report += '\n## Context Retrieval\n';
        report += `- Candidates: ${debug.contextRetrievalDetails.candidateContexts}\n`;
        report += `- Filtered: ${debug.contextRetrievalDetails.filteredContexts}\n`;
        report += `- Selected: ${debug.contextRetrievalDetails.selectedContexts.length}\n`;
        if (debug.contextRetrievalDetails.rejectionReasons.length > 0) {
            report += `- Rejection reasons: ${debug.contextRetrievalDetails.rejectionReasons.join(', ')}\n`;
        }
        // Entity resolution
        report += '\n## Entity Resolution\n';
        for (const attempt of debug.entityResolutionAttempts) {
            report += `- **${attempt.entity}**\n`;
            report += `  - Method: ${attempt.resolutionMethod}\n`;
            report += `  - Confidence: ${attempt.confidence.toFixed(2)}\n`;
            report += `  - Result: ${attempt.selectedResolution}\n`;
        }
        // Ambiguity analysis
        report += '\n## Ambiguity Analysis\n';
        report += `- Total: ${debug.ambiguityAnalysis.totalAmbiguities}\n`;
        report += `- Resolved: ${debug.ambiguityAnalysis.resolvedAmbiguities}\n`;
        report += `- Unresolved: ${debug.ambiguityAnalysis.unresolvedAmbiguities.length}\n`;
        // Validation results
        report += '\n## Validation Results\n';
        for (const result of debug.validationResults) {
            const status = result.passed ? '✓' : '✗';
            report += `- ${status} **${result.rule}** (${result.severity})\n`;
            report += `  - ${result.message}\n`;
        }
        return report;
    }
    // Private implementation methods
    async detectAmbiguities(query, conversationContext, debugInfo) {
        const ambiguities = [];
        // Detect follow-up references using FollowUpDetector
        const followUpResult = await this.followUpDetector.detectFollowUp({ originalText: query, text: query }, conversationContext.conversationThread);
        if (followUpResult.detectedReferences.length > 0) {
            for (const reference of followUpResult.detectedReferences) {
                ambiguities.push({
                    text: reference.text,
                    type: reference.type,
                    possibleResolutions: reference.resolvedEntity ? [reference.resolvedEntity] : [],
                    confidence: reference.confidence,
                    requiresContext: true
                });
            }
        }
        // Detect pronoun references
        const pronouns = query.match(/\b(it|this|that|these|those|they|them|he|she|his|her|its)\b/gi) || [];
        for (const pronoun of pronouns) {
            ambiguities.push({
                text: pronoun,
                type: 'pronoun',
                possibleResolutions: this.findPronounResolutions(pronoun, conversationContext),
                confidence: 0.8,
                requiresContext: true
            });
        }
        // Detect implicit references
        const implicitPatterns = [
            /\b(component|part|element|device|circuit)\b/gi,
            /\b(value|rating|specification|property)\b/gi,
            /\b(connection|terminal|pin|node)\b/gi
        ];
        for (const pattern of implicitPatterns) {
            const matches = query.match(pattern) || [];
            for (const match of matches) {
                if (this.isAmbiguousReference(match, conversationContext)) {
                    ambiguities.push({
                        text: match,
                        type: 'implicit_reference',
                        possibleResolutions: this.findImplicitResolutions(match, conversationContext),
                        confidence: 0.7,
                        requiresContext: true
                    });
                }
            }
        }
        if (debugInfo) {
            debugInfo.ambiguityAnalysis = {
                totalAmbiguities: ambiguities.length,
                resolvedAmbiguities: 0, // Will be updated after resolution
                unresolvedAmbiguities: [...ambiguities],
                resolutionStrategies: ['follow_up_detection', 'pronoun_analysis', 'implicit_reference_detection']
            };
        }
        return ambiguities;
    }
    async retrieveRelevantContext(query, conversationContext, sessionId, debugInfo) {
        const contextRequest = {
            currentQuery: query,
            sessionId,
            maxContextTurns: this.config.maxContextSources,
            relevanceThreshold: this.config.contextRelevanceThreshold,
            contextTypes: ['entity', 'topic', 'document']
        };
        const relevantContextScores = await this.contextEnricher.retrieveRelevantContext(contextRequest, conversationContext);
        const contextSources = [];
        // Convert context scores to context sources
        for (const score of relevantContextScores) {
            const turn = conversationContext.conversationThread.find(t => t.id === score.turnId);
            if (turn) {
                contextSources.push({
                    type: 'previous_query',
                    content: `Query: ${turn.query.text} | Response: ${turn.response.summary || ''}`,
                    relevance: score.combinedScore,
                    turnId: turn.id
                });
            }
        }
        // Add entity-based context
        for (const [entity, mentions] of conversationContext.cumulativeContext.extractedEntities) {
            if (query.toLowerCase().includes(entity.toLowerCase())) {
                const latestMention = mentions[mentions.length - 1];
                contextSources.push({
                    type: 'entity_reference',
                    content: `Entity: ${entity} (${latestMention.type}, confidence: ${latestMention.confidence})`,
                    relevance: latestMention.confidence,
                    entityId: entity
                });
            }
        }
        // Add document context
        for (const docContext of conversationContext.cumulativeContext.documentContext) {
            contextSources.push({
                type: 'document_context',
                content: `Document: ${docContext.documentId} - ${docContext.keyFindings.join(', ')}`,
                relevance: 0.6,
                documentId: docContext.documentId
            });
        }
        // Sort by relevance and limit
        const sortedSources = contextSources
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, this.config.maxContextSources);
        if (debugInfo) {
            debugInfo.contextRetrievalDetails = {
                requestDetails: contextRequest,
                candidateContexts: contextSources.length,
                filteredContexts: sortedSources.length,
                selectedContexts: sortedSources,
                rejectionReasons: contextSources.length > sortedSources.length
                    ? ['relevance_threshold', 'max_sources_limit']
                    : []
            };
        }
        return sortedSources;
    }
    async resolveEntities(query, contextSources, conversationContext, debugInfo) {
        const resolvedEntities = [];
        const entityResolutionAttempts = [];
        // Extract entities from query
        const queryEntities = this.extractEntitiesFromQuery(query);
        for (const entityText of queryEntities) {
            const candidates = this.findEntityCandidates(entityText, conversationContext);
            if (candidates.length > 0) {
                const bestCandidate = candidates[0];
                const confidence = this.calculateEntityResolutionConfidence(entityText, bestCandidate, contextSources);
                entityResolutionAttempts.push({
                    entity: entityText,
                    candidates: candidates.map(c => c.text),
                    selectedResolution: bestCandidate.text,
                    confidence,
                    resolutionMethod: 'context_similarity'
                });
                if (confidence >= this.config.entityResolutionThreshold) {
                    resolvedEntities.push({
                        originalText: entityText,
                        resolvedText: bestCandidate.text,
                        entityType: bestCandidate.type,
                        confidence,
                        contextSource: bestCandidate.context,
                        alternatives: candidates.slice(1, 3).map(c => c.text)
                    });
                }
            }
            else {
                entityResolutionAttempts.push({
                    entity: entityText,
                    candidates: [],
                    selectedResolution: entityText,
                    confidence: 0,
                    resolutionMethod: 'no_resolution'
                });
            }
        }
        if (debugInfo) {
            debugInfo.entityResolutionAttempts = entityResolutionAttempts;
        }
        return resolvedEntities;
    }
    buildEnhancedQuery(originalQuery, contextSources, resolvedEntities, _ambiguities) {
        let enhancedQuery = originalQuery;
        // Replace resolved entities
        for (const entity of resolvedEntities) {
            if (entity.originalText !== entity.resolvedText) {
                enhancedQuery = enhancedQuery.replace(new RegExp(`\\b${entity.originalText}\\b`, 'gi'), entity.resolvedText);
            }
        }
        // Add context information for ambiguities
        const contextualInfo = [];
        // Add high-relevance context
        const highRelevanceContext = contextSources
            .filter(source => source.relevance > 0.7)
            .slice(0, 2);
        if (highRelevanceContext.length > 0) {
            contextualInfo.push(`[Context: ${highRelevanceContext.map(c => c.content).join('; ')}]`);
        }
        // Add resolved entity information
        if (resolvedEntities.length > 0) {
            const entityInfo = resolvedEntities
                .map(e => `${e.originalText} refers to ${e.resolvedText}`)
                .join(', ');
            contextualInfo.push(`[Entities: ${entityInfo}]`);
        }
        // Combine original query with contextual information
        if (contextualInfo.length > 0) {
            enhancedQuery = `${enhancedQuery} ${contextualInfo.join(' ')}`;
        }
        return enhancedQuery;
    }
    validateEnhancement(originalQuery, enhancedQuery, contextSources) {
        const results = [];
        // Rule 1: Enhanced query should not be too long
        if (enhancedQuery.length > this.config.maxContextLength) {
            results.push({
                rule: 'max_length',
                passed: false,
                message: `Enhanced query exceeds maximum length (${enhancedQuery.length} > ${this.config.maxContextLength})`,
                severity: 'warning'
            });
        }
        else {
            results.push({
                rule: 'max_length',
                passed: true,
                message: 'Enhanced query length is within limits',
                severity: 'info'
            });
        }
        // Rule 2: Should preserve original intent
        const originalWords = originalQuery.toLowerCase().split(/\s+/);
        const enhancedWords = enhancedQuery.toLowerCase().split(/\s+/);
        const preservedWords = originalWords.filter(word => enhancedWords.includes(word));
        const preservationRatio = preservedWords.length / originalWords.length;
        if (preservationRatio < 0.8) {
            results.push({
                rule: 'intent_preservation',
                passed: false,
                message: `Original intent may be lost (${(preservationRatio * 100).toFixed(1)}% words preserved)`,
                severity: 'error'
            });
        }
        else {
            results.push({
                rule: 'intent_preservation',
                passed: true,
                message: 'Original intent preserved',
                severity: 'info'
            });
        }
        // Rule 3: Context sources should be relevant
        const lowRelevanceContexts = contextSources.filter(source => source.relevance < 0.4);
        if (lowRelevanceContexts.length > 0) {
            results.push({
                rule: 'context_relevance',
                passed: false,
                message: `${lowRelevanceContexts.length} context sources have low relevance`,
                severity: 'warning'
            });
        }
        else {
            results.push({
                rule: 'context_relevance',
                passed: true,
                message: 'All context sources are relevant',
                severity: 'info'
            });
        }
        return results;
    }
    calculateEnhancementConfidence(contextSources, resolvedEntities, ambiguities, validationResults) {
        let confidence = 0;
        // Context quality score (0-0.4)
        if (contextSources.length > 0) {
            const avgRelevance = contextSources.reduce((sum, source) => sum + source.relevance, 0) / contextSources.length;
            confidence += avgRelevance * 0.4;
        }
        // Entity resolution score (0-0.3)
        if (resolvedEntities.length > 0) {
            const avgEntityConfidence = resolvedEntities.reduce((sum, entity) => sum + entity.confidence, 0) / resolvedEntities.length;
            confidence += avgEntityConfidence * 0.3;
        }
        // Ambiguity resolution score (0-0.2)
        const resolvedAmbiguities = ambiguities.filter(amb => amb.possibleResolutions.length > 0);
        if (ambiguities.length > 0) {
            confidence += (resolvedAmbiguities.length / ambiguities.length) * 0.2;
        }
        else {
            confidence += 0.2; // No ambiguities is good
        }
        // Validation score (0-0.1)
        const passedValidations = validationResults.filter(result => result.passed);
        if (validationResults.length > 0) {
            confidence += (passedValidations.length / validationResults.length) * 0.1;
        }
        return Math.min(confidence, 1.0);
    }
    // Helper methods for implementation details
    findPronounResolutions(_pronoun, context) {
        const resolutions = [];
        // Simple heuristic: look for recent entity mentions
        const recentTurns = context.conversationThread.slice(-3);
        for (const turn of recentTurns) {
            const entityMentions = Array.from(context.cumulativeContext.extractedEntities.keys())
                .filter(entity => turn.query.text.toLowerCase().includes(entity.toLowerCase()) ||
                (turn.response.summary && turn.response.summary.toLowerCase().includes(entity.toLowerCase())));
            resolutions.push(...entityMentions);
        }
        return [...new Set(resolutions)].slice(0, 3);
    }
    isAmbiguousReference(text, context) {
        // Check if the reference could refer to multiple entities
        const matchingEntities = Array.from(context.cumulativeContext.extractedEntities.keys())
            .filter(entity => entity.toLowerCase().includes(text.toLowerCase()) ||
            text.toLowerCase().includes(entity.toLowerCase()));
        // For general terms like "component", consider it ambiguous if we have multiple electrical entities
        if (text.toLowerCase() === 'component' && context.cumulativeContext.extractedEntities.size > 1) {
            return true;
        }
        return matchingEntities.length > 1;
    }
    findImplicitResolutions(text, context) {
        const resolutions = [];
        // Find entities that could match this implicit reference
        for (const [entity, mentions] of context.cumulativeContext.extractedEntities) {
            const latestMention = mentions[mentions.length - 1];
            if (latestMention.type.includes(text.toLowerCase()) ||
                latestMention.context.toLowerCase().includes(text.toLowerCase())) {
                resolutions.push(entity);
            }
        }
        return resolutions.slice(0, 3);
    }
    extractEntitiesFromQuery(query) {
        // Simple entity extraction - in production would use more sophisticated NLP
        const entities = [];
        // Technical terms
        const technicalTerms = query.match(/\b(resistor|capacitor|inductor|transformer|diode|transistor|circuit|voltage|current|power)\b/gi) || [];
        entities.push(...technicalTerms);
        // Measurements
        const measurements = query.match(/\d+(\.\d+)?\s*(V|A|W|Ω|F|H|Hz)/gi) || [];
        entities.push(...measurements);
        // Pronouns and references
        const references = query.match(/\b(it|this|that|the\s+\w+)\b/gi) || [];
        entities.push(...references);
        return [...new Set(entities.map(e => e.toLowerCase()))];
    }
    findEntityCandidates(entityText, context) {
        const candidates = [];
        for (const [_entity, mentions] of context.cumulativeContext.extractedEntities) {
            for (const mention of mentions) {
                if (this.calculateSimilarity(entityText, mention.text) > 0.5) {
                    candidates.push(mention);
                }
            }
        }
        return candidates.sort((a, b) => b.confidence - a.confidence);
    }
    calculateEntityResolutionConfidence(originalText, candidate, contextSources) {
        const textSimilarity = this.calculateSimilarity(originalText, candidate.text);
        const contextRelevance = contextSources.some(source => source.content.toLowerCase().includes(candidate.text.toLowerCase())) ? 0.3 : 0;
        return Math.min(textSimilarity + contextRelevance + (candidate.confidence * 0.3), 1.0);
    }
    calculateSimilarity(text1, text2) {
        // Simple similarity calculation - in production would use more sophisticated algorithms
        const words1 = text1.toLowerCase().split(/\s+/);
        const words2 = text2.toLowerCase().split(/\s+/);
        const commonWords = words1.filter(word => words2.includes(word));
        return commonWords.length / Math.max(words1.length, words2.length);
    }
    initializePromptTemplates() {
        const templates = new Map();
        templates.set('default', {
            name: 'default',
            template: `Analyze the following electrical drawing query with the provided context:

Query: {{query}}
Original Query: {{original_query}}

Relevant Context:
{{context}}

Resolved Entities: {{resolved_entities}}

Enhancement Confidence: {{confidence}}

Please provide a comprehensive analysis based on the query and context.`,
            variables: ['query', 'original_query', 'context', 'resolved_entities', 'confidence'],
            contextPlaceholders: ['context', 'resolved_entities']
        });
        templates.set('component_analysis', {
            name: 'component_analysis',
            template: `Perform component analysis for the electrical drawing query:

Enhanced Query: {{query}}

Context from previous analysis:
{{context}}

Entity resolutions: {{resolved_entities}}

Focus on identifying components, their specifications, and relationships. Confidence level: {{confidence}}`,
            variables: ['query', 'context', 'resolved_entities', 'confidence'],
            contextPlaceholders: ['context', 'resolved_entities']
        });
        templates.set('troubleshooting', {
            name: 'troubleshooting',
            template: `Troubleshoot the electrical issue based on:

Query: {{query}}
Previous context: {{context}}
Known entities: {{resolved_entities}}

Provide step-by-step troubleshooting guidance. Analysis confidence: {{confidence}}`,
            variables: ['query', 'context', 'resolved_entities', 'confidence'],
            contextPlaceholders: ['context', 'resolved_entities']
        });
        return templates;
    }
    initializeDebugInfo() {
        return {
            processingSteps: [],
            contextRetrievalDetails: {},
            entityResolutionAttempts: [],
            ambiguityAnalysis: {},
            validationResults: []
        };
    }
    addProcessingStep(debugInfo, stepName, input, startTime) {
        const timestamp = Date.now();
        debugInfo.processingSteps.push({
            step: stepName,
            timestamp,
            duration: timestamp - startTime,
            input,
            output: '', // Will be filled by calling code
            metadata: {}
        });
    }
}
exports.ContextAwareQueryEnhancer = ContextAwareQueryEnhancer;
//# sourceMappingURL=ContextAwareQueryEnhancer.js.map