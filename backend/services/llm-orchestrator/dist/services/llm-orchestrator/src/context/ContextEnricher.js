"use strict";
/**
 * Context Enrichment and Retrieval System
 * Builds cumulative knowledge and provides relevant context for query enhancement
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextEnricher = void 0;
class ContextEnricher {
    constructor() {
        this.recencyDecayFactor = 0.95;
    }
    /**
     * Build cumulative knowledge from conversation turns
     */
    buildCumulativeContext(turns) {
        const extractedEntities = this.extractAndMergeEntities(turns);
        const documentContext = this.buildDocumentContext(turns);
        const topicProgression = this.buildTopicProgression(turns);
        const keyInsights = this.extractKeyInsights(turns);
        const relationshipMap = this.buildRelationshipMap(turns, extractedEntities);
        return {
            extractedEntities,
            documentContext,
            topicProgression,
            keyInsights,
            relationshipMap
        };
    }
    /**
     * Retrieve relevant context for query enhancement
     */
    async retrieveRelevantContext(request, context) {
        const candidateTurns = this.filterCandidateTurns(context.conversationThread, request.maxContextTurns);
        const relevanceScores = await Promise.all(candidateTurns.map(turn => this.calculateRelevanceScore(request.currentQuery, turn, context.conversationThread.indexOf(turn))));
        return relevanceScores
            .filter(score => score.combinedScore >= request.relevanceThreshold)
            .sort((a, b) => b.combinedScore - a.combinedScore);
    }
    /**
     * Enhance query with relevant context
     */
    async enhanceQueryWithContext(query, relevantContext, conversationContext) {
        const contextSources = this.buildContextSources(relevantContext, conversationContext);
        const relevantEntities = this.extractRelevantEntities(contextSources, conversationContext.cumulativeContext);
        const topicContext = this.extractTopicContext(contextSources, conversationContext.cumulativeContext);
        const enhancedQuery = this.buildEnhancedQuery(query, contextSources, relevantEntities, topicContext);
        const confidence = this.calculateEnhancementConfidence(contextSources);
        return {
            originalQuery: query,
            enhancedQuery,
            contextSources,
            relevantEntities,
            topicContext,
            confidence
        };
    }
    /**
     * Merge related conversation threads
     */
    mergeRelatedContexts(contexts) {
        if (contexts.length === 0) {
            throw new Error('Cannot merge empty context array');
        }
        if (contexts.length === 1) {
            return contexts[0];
        }
        const primaryContext = contexts[0];
        const mergedTurns = this.mergeConversationTurns(contexts);
        const mergedCumulativeContext = this.mergeCumulativeContexts(contexts.map(c => c.cumulativeContext));
        return {
            ...primaryContext,
            conversationThread: mergedTurns,
            cumulativeContext: mergedCumulativeContext,
            lastUpdated: new Date(),
            metadata: {
                ...primaryContext.metadata,
                lastAccessed: new Date(),
                accessCount: primaryContext.metadata.accessCount + 1
            }
        };
    }
    /**
     * Validate context accuracy and consistency
     */
    validateContext(context) {
        const validationErrors = [];
        const inconsistencies = [];
        // Validate basic structure
        if (!context.id || !context.sessionId) {
            validationErrors.push('Missing required context identifiers');
        }
        if (!context.conversationThread || context.conversationThread.length === 0) {
            validationErrors.push('Empty conversation thread');
        }
        // Validate turn sequence
        const turnNumbers = context.conversationThread.map(t => t.turnNumber).sort((a, b) => a - b);
        for (let i = 1; i < turnNumbers.length; i++) {
            if (turnNumbers[i] !== turnNumbers[i - 1] + 1) {
                inconsistencies.push(`Turn sequence gap between ${turnNumbers[i - 1]} and ${turnNumbers[i]}`);
            }
        }
        // Validate cumulative context consistency
        const entityCount = context.cumulativeContext.extractedEntities.size;
        const totalMentions = Array.from(context.cumulativeContext.extractedEntities.values())
            .reduce((sum, mentions) => sum + mentions.length, 0);
        if (entityCount > 0 && totalMentions === 0) {
            inconsistencies.push('Entities present but no mentions found');
        }
        // Validate timestamps
        const timestamps = context.conversationThread.map(t => t.timestamp);
        for (let i = 1; i < timestamps.length; i++) {
            if (timestamps[i] < timestamps[i - 1]) {
                inconsistencies.push(`Timestamp order violation at turn ${i + 1}`);
            }
        }
        return {
            isValid: validationErrors.length === 0,
            validationErrors,
            inconsistencies
        };
    }
    // Private helper methods
    extractAndMergeEntities(turns) {
        const entityMap = new Map();
        for (const turn of turns) {
            // Extract entities from query and response
            const queryEntities = this.extractEntitiesFromText(turn.query.text, turn.id);
            const responseEntities = this.extractEntitiesFromText(turn.response.summary || '', turn.id);
            // Merge entities
            [...queryEntities, ...responseEntities].forEach(entity => {
                const existing = entityMap.get(entity.text) || [];
                entityMap.set(entity.text, [...existing, entity]);
            });
        }
        return entityMap;
    }
    extractEntitiesFromText(text, turnId) {
        // Simple entity extraction - in production would use NLP libraries
        const entities = [];
        // Extract technical terms (electrical components)
        const technicalTerms = text.match(/\b(resistor|capacitor|inductor|transformer|circuit|voltage|current|power)\b/gi) || [];
        technicalTerms.forEach(term => {
            entities.push({
                text: term.toLowerCase(),
                type: 'electrical_component',
                confidence: 0.8,
                context: text,
                turnId,
                position: text.indexOf(term),
                firstMentioned: new Date(),
                mentions: 1
            });
        });
        // Extract numbers with units
        const measurements = text.match(/\d+(\.\d+)?\s*(V|A|W|Ω|F|H|Hz)/gi) || [];
        measurements.forEach(measurement => {
            entities.push({
                text: measurement,
                type: 'measurement',
                confidence: 0.9,
                context: text,
                turnId,
                position: text.indexOf(measurement),
                firstMentioned: new Date(),
                mentions: 1
            });
        });
        return entities;
    }
    buildDocumentContext(turns) {
        const documentMap = new Map();
        turns.forEach(turn => {
            if (turn.query.documentIds && turn.query.documentIds.length > 0) {
                turn.query.documentIds.forEach(docId => {
                    const existing = documentMap.get(docId);
                    if (existing) {
                        documentMap.set(docId, {
                            ...existing,
                            lastReferenced: turn.timestamp,
                            keyFindings: [...new Set([...existing.keyFindings, ...this.extractTopics(turn.query.text)])]
                        });
                    }
                    else {
                        documentMap.set(docId, {
                            documentId: docId,
                            filename: `document-${docId}`,
                            relevantPages: [1],
                            keyFindings: this.extractTopics(turn.query.text),
                            lastReferenced: turn.timestamp
                        });
                    }
                });
            }
        });
        return Array.from(documentMap.values());
    }
    buildTopicProgression(turns) {
        const topics = [];
        let currentTopic = null;
        turns.forEach(turn => {
            const turnTopics = this.extractTopics(turn.query.text);
            turnTopics.forEach(topic => {
                if (topic !== currentTopic) {
                    topics.push({
                        topic,
                        relevance: 0.7,
                        firstIntroduced: turn.timestamp,
                        relatedTopics: turnTopics.filter(t => t !== topic),
                        queryIds: [turn.query.id]
                    });
                    currentTopic = topic;
                }
                else {
                    // Extend current topic by adding query ID
                    const lastTopic = topics[topics.length - 1];
                    if (lastTopic) {
                        topics[topics.length - 1] = {
                            ...lastTopic,
                            queryIds: [...lastTopic.queryIds, turn.query.id]
                        };
                    }
                }
            });
        });
        return topics;
    }
    extractTopics(text) {
        const topics = [];
        // Electrical engineering topics
        if (/circuit|schematic|diagram/i.test(text))
            topics.push('circuit_analysis');
        if (/component|part|element/i.test(text))
            topics.push('component_identification');
        if (/voltage|current|power|resistance/i.test(text))
            topics.push('electrical_properties');
        if (/safety|hazard|warning/i.test(text))
            topics.push('safety_analysis');
        if (/specification|datasheet|rating/i.test(text))
            topics.push('specifications');
        return topics.length > 0 ? topics : ['general_query'];
    }
    extractKeyInsights(turns) {
        const insights = [];
        turns.forEach(turn => {
            if (turn.response.summary && turn.response.confidence.overall >= 0.8) {
                // Extract high-confidence insights
                const summary = turn.response.summary;
                const lowerSummary = summary.toLowerCase();
                if (lowerSummary.includes('identified') || lowerSummary.includes('detected') || lowerSummary.includes('found')) {
                    insights.push(`${turn.turnNumber}: ${summary}`);
                }
            }
        });
        return insights;
    }
    buildRelationshipMap(turns, entities) {
        const relationships = [];
        const entityList = Array.from(entities.keys());
        // Find co-occurring entities
        turns.forEach(turn => {
            const turnText = `${turn.query.text} ${turn.response.summary || ''}`;
            const presentEntities = entityList.filter(entity => turnText.toLowerCase().includes(entity.toLowerCase()));
            // Create relationships between co-occurring entities
            for (let i = 0; i < presentEntities.length; i++) {
                for (let j = i + 1; j < presentEntities.length; j++) {
                    relationships.push({
                        source: presentEntities[i],
                        target: presentEntities[j],
                        relationship: 'co_occurrence',
                        confidence: 0.6,
                        context: turnText
                    });
                }
            }
        });
        return relationships;
    }
    filterCandidateTurns(turns, maxTurns) {
        // Return most recent turns, up to maxTurns
        return turns
            .sort((a, b) => b.turnNumber - a.turnNumber)
            .slice(0, maxTurns);
    }
    async calculateRelevanceScore(query, turn, position) {
        const semanticSimilarity = this.calculateSemanticSimilarity(query, turn);
        const recencyScore = Math.pow(this.recencyDecayFactor, position);
        const combinedScore = (semanticSimilarity * 0.7) + (recencyScore * 0.3);
        return {
            contextId: turn.id,
            turnId: turn.id,
            relevanceScore: semanticSimilarity,
            recencyScore,
            combinedScore,
            matchingConcepts: this.findMatchingConcepts(query, turn)
        };
    }
    calculateSemanticSimilarity(query, turn) {
        const queryWords = query.toLowerCase().split(/\s+/);
        const turnText = `${turn.query.text} ${turn.response.summary || ''}`.toLowerCase();
        const turnWords = turnText.split(/\s+/);
        const commonWords = queryWords.filter(word => turnWords.some(turnWord => turnWord.includes(word) || word.includes(turnWord)));
        return commonWords.length / Math.max(queryWords.length, turnWords.length);
    }
    findMatchingConcepts(query, turn) {
        const queryTopics = this.extractTopics(query);
        const turnTopics = this.extractTopics(turn.query.text);
        return queryTopics.filter(topic => turnTopics.includes(topic));
    }
    buildContextSources(relevantContext, conversationContext) {
        return relevantContext.map(score => {
            const turn = conversationContext.conversationThread.find(t => t.id === score.turnId);
            if (!turn) {
                throw new Error(`Turn not found: ${score.turnId}`);
            }
            return {
                turnId: score.turnId,
                contribution: turn.response.summary || turn.query.text,
                relevanceScore: score.relevanceScore,
                contextType: this.determineContextType(turn)
            };
        });
    }
    determineContextType(turn) {
        const text = turn.query.text.toLowerCase();
        if (text.includes('component') || text.includes('part'))
            return 'entity';
        if (text.includes('document') || text.includes('schematic'))
            return 'document';
        if (text.includes('how') || text.includes('why'))
            return 'insight';
        if (text.includes('connect') || text.includes('relate'))
            return 'relationship';
        return 'topic';
    }
    extractRelevantEntities(contextSources, cumulativeContext) {
        const relevantEntities = new Set();
        contextSources.forEach(source => {
            // Find entities mentioned in this context source
            Array.from(cumulativeContext.extractedEntities.entries()).forEach(([entity, mentions]) => {
                if (mentions.some(mention => mention.turnId === source.turnId)) {
                    relevantEntities.add(entity);
                }
            });
        });
        return Array.from(relevantEntities);
    }
    extractTopicContext(contextSources, cumulativeContext) {
        const relevantTopics = new Set();
        contextSources.forEach(source => {
            // Find topics from context sources
            cumulativeContext.topicProgression.forEach(topic => {
                if (topic.startTurn <= parseInt(source.turnId) && topic.endTurn >= parseInt(source.turnId)) {
                    relevantTopics.add(topic.topic);
                }
            });
        });
        return Array.from(relevantTopics);
    }
    buildEnhancedQuery(originalQuery, contextSources, relevantEntities, topicContext) {
        let enhancedQuery = originalQuery;
        // Add entity context
        if (relevantEntities.length > 0) {
            enhancedQuery += ` [Previously discussed components: ${relevantEntities.join(', ')}]`;
        }
        // Add topic context
        if (topicContext.length > 0) {
            enhancedQuery += ` [Related topics: ${topicContext.join(', ')}]`;
        }
        // Add specific context from sources
        if (contextSources.length > 0) {
            const highRelevanceContext = contextSources
                .filter(source => source.relevanceScore > 0.5)
                .slice(0, 2) // Limit to prevent prompt bloat
                .map(source => source.contribution)
                .join('; ');
            if (highRelevanceContext) {
                enhancedQuery += ` [Previous context: ${highRelevanceContext}]`;
            }
        }
        return enhancedQuery;
    }
    calculateEnhancementConfidence(contextSources) {
        if (contextSources.length === 0)
            return 0;
        const avgRelevance = contextSources.reduce((sum, source) => sum + source.relevanceScore, 0) / contextSources.length;
        const contextCountFactor = Math.min(contextSources.length / 3, 1); // Optimal around 3 sources
        return avgRelevance * contextCountFactor;
    }
    mergeConversationTurns(contexts) {
        const allTurns = contexts.flatMap(context => context.conversationThread);
        // Sort by timestamp and renumber
        return allTurns
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
            .map((turn, index) => ({
            ...turn,
            turnNumber: index + 1
        }));
    }
    mergeCumulativeContexts(contexts) {
        const mergedEntities = new Map();
        const mergedDocuments = [];
        const mergedTopics = [];
        const mergedInsights = [];
        const mergedRelationships = [];
        contexts.forEach(context => {
            // Merge entities
            Array.from(context.extractedEntities.entries()).forEach(([entity, mentions]) => {
                const existing = mergedEntities.get(entity) || [];
                mergedEntities.set(entity, [...existing, ...mentions]);
            });
            // Merge other contexts
            mergedDocuments.push(...context.documentContext);
            mergedTopics.push(...context.topicProgression);
            mergedInsights.push(...context.keyInsights);
            mergedRelationships.push(...context.relationshipMap);
        });
        return {
            extractedEntities: mergedEntities,
            documentContext: mergedDocuments,
            topicProgression: mergedTopics,
            keyInsights: [...new Set(mergedInsights)], // Remove duplicates
            relationshipMap: mergedRelationships
        };
    }
}
exports.ContextEnricher = ContextEnricher;
//# sourceMappingURL=ContextEnricher.js.map