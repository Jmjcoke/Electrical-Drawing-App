"use strict";
/**
 * QueryOptimizer - Query optimization service for LLM providers
 * Optimizes queries for specific providers and estimates costs
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryOptimizer = void 0;
class QueryOptimizer {
    constructor(config) {
        // Provider-specific templates and configurations
        this.providerConfigs = {
            openai: {
                name: 'OpenAI GPT-4 Vision',
                maxTokens: 4096,
                costPerToken: 0.00003, // Approximate cost per token
                strengths: ['component_identification', 'schematic_analysis'],
                promptStyle: 'detailed',
                systemPrompt: 'You are an expert electrical engineer analyzing circuit diagrams and schematics.',
                optimizations: {
                    useStructuredOutput: true,
                    includeContext: true,
                    verboseExplanations: true
                }
            },
            claude: {
                name: 'Claude 3.5 Sonnet',
                maxTokens: 4096,
                costPerToken: 0.000015,
                strengths: ['general_question', 'analysis'],
                promptStyle: 'conversational',
                systemPrompt: 'You are a knowledgeable electrical engineering assistant. Provide clear, accurate explanations.',
                optimizations: {
                    useStructuredOutput: false,
                    includeContext: true,
                    verboseExplanations: false
                }
            },
            gemini: {
                name: 'Gemini Pro Vision',
                maxTokens: 2048,
                costPerToken: 0.0000125,
                strengths: ['component_identification', 'general_question'],
                promptStyle: 'concise',
                systemPrompt: 'Analyze electrical circuits and components with precision.',
                optimizations: {
                    useStructuredOutput: false,
                    includeContext: false,
                    verboseExplanations: false
                }
            }
        };
        // Intent-specific prompt templates
        this.intentTemplates = {
            component_identification: {
                basePrompt: 'Identify and analyze the electrical components in this image.',
                contextualPrompt: 'Based on the query "{query}" and the electrical diagram, identify the specific components mentioned or visible.',
                requiredInfo: ['component type', 'component value', 'component designation', 'function in circuit']
            },
            schematic_analysis: {
                basePrompt: 'Analyze the electrical schematic and explain its operation.',
                contextualPrompt: 'For the query "{query}", analyze the circuit schematic focusing on the specific aspects mentioned.',
                requiredInfo: ['circuit topology', 'signal flow', 'operating principles', 'key nodes']
            },
            general_question: {
                basePrompt: 'Answer the electrical engineering question based on the provided context.',
                contextualPrompt: 'Answer this electrical engineering question: "{query}". Use the diagram if provided to illustrate your explanation.',
                requiredInfo: ['clear explanation', 'relevant examples', 'practical applications']
            }
        };
        this.config = config;
        this.stats = {
            totalOptimizations: 0,
            cacheHits: 0,
            averageOptimizationTime: 0,
            providerUsage: {},
            averageComplexityScore: 0
        };
        this.optimizationCache = new Map();
    }
    /**
     * Optimize query for all supported LLM providers
     * @param queryText - The sanitized query text
     * @param intent - Classified query intent
     * @param context - Extracted context information
     * @returns Optimization results for all providers
     */
    async optimizeForProviders(queryText, intent, context) {
        const startTime = Date.now();
        try {
            // Check cache first
            const cacheKey = this.generateCacheKey(queryText, intent, context);
            if (this.config.enableCaching) {
                const cached = this.getCachedOptimization(cacheKey);
                if (cached) {
                    this.stats.cacheHits++;
                    return cached;
                }
            }
            // Calculate query complexity
            const complexityScore = this.calculateComplexityScore(queryText, intent, context);
            // Generate optimized prompts for each provider
            const optimizedPrompts = {};
            const providerEnhancements = {};
            for (const [providerId, providerConfig] of Object.entries(this.providerConfigs)) {
                const enhancement = await this.optimizeForProvider(queryText, intent, context, providerId, providerConfig);
                optimizedPrompts[providerId] = enhancement.enhancedQuery;
                providerEnhancements[providerId] = enhancement;
                // Update provider usage stats
                this.stats.providerUsage[providerId] = (this.stats.providerUsage[providerId] || 0) + 1;
            }
            // Generate cost estimation
            const costEstimation = this.calculateCostEstimation(optimizedPrompts, complexityScore);
            const result = {
                optimizedPrompts,
                providerSpecificEnhancements: providerEnhancements,
                costEstimation,
                complexityScore
            };
            // Cache the result
            if (this.config.enableCaching) {
                this.cacheOptimization(cacheKey, result);
            }
            // Update statistics
            const processingTime = Date.now() - startTime;
            this.updateStats(complexityScore, processingTime);
            return result;
        }
        catch (error) {
            console.error('[QueryOptimizer] Optimization failed:', error);
            // Return basic optimization on error
            return this.createFallbackOptimization(queryText, intent);
        }
    }
    /**
     * Optimize query for a specific provider
     */
    async optimizeForProvider(queryText, intent, context, _providerId, providerConfig) {
        const template = this.intentTemplates[intent.type];
        // Build enhanced query based on provider strengths
        let enhancedQuery = this.buildBasePrompt(queryText, intent, template, providerConfig);
        // Add technical context based on extracted entities
        const technicalContext = this.buildTechnicalContext(context, providerConfig);
        // Add provider-specific optimizations
        const parameterAdjustments = this.getProviderParameters(intent, providerConfig);
        // Build reasoning chain for complex queries
        const reasoningChain = this.buildReasoningChain(queryText, intent, context, providerConfig);
        // Apply provider-specific enhancements
        if (providerConfig.optimizations.includeContext && technicalContext.length > 0) {
            enhancedQuery += '\n\nRelevant context:\n' + technicalContext.join('\n');
        }
        if (providerConfig.optimizations.useStructuredOutput) {
            enhancedQuery += '\n\nPlease structure your response with clear headings and bullet points.';
        }
        if (providerConfig.optimizations.verboseExplanations) {
            enhancedQuery += '\n\nProvide detailed explanations for your analysis.';
        }
        return {
            enhancedQuery,
            technicalContext,
            parameterAdjustments,
            reasoningChain
        };
    }
    /**
     * Build base prompt from template and configuration
     */
    buildBasePrompt(queryText, _intent, template, providerConfig) {
        let prompt = providerConfig.systemPrompt + '\n\n';
        // Use contextual template if available
        if (template.contextualPrompt) {
            prompt += template.contextualPrompt.replace('{query}', queryText);
        }
        else {
            prompt += template.basePrompt + '\n\nUser query: ' + queryText;
        }
        // Add intent-specific requirements
        if (template.requiredInfo && template.requiredInfo.length > 0) {
            prompt += '\n\nPlease ensure your response includes:\n';
            prompt += template.requiredInfo.map((info) => `- ${info}`).join('\n');
        }
        return prompt;
    }
    /**
     * Build technical context from extracted entities and topics
     */
    buildTechnicalContext(context, _providerConfig) {
        const technicalContext = [];
        // Add entity information
        if (context.entities.length > 0) {
            const components = context.entities.filter(e => e.type === 'component');
            const measurements = context.entities.filter(e => e.type === 'measurement');
            if (components.length > 0) {
                technicalContext.push(`Components mentioned: ${components.map(c => c.text).join(', ')}`);
            }
            if (measurements.length > 0) {
                technicalContext.push(`Measurements mentioned: ${measurements.map(m => m.text).join(', ')}`);
            }
        }
        // Add topic information
        if (context.topics.length > 0) {
            technicalContext.push(`Technical topics: ${context.topics.join(', ')}`);
        }
        // Add document context if relevant
        if (context.relevantDocuments.length > 0) {
            const docCount = context.relevantDocuments.length;
            technicalContext.push(`Analysis based on ${docCount} electrical drawing${docCount > 1 ? 's' : ''}`);
        }
        return technicalContext;
    }
    /**
     * Get provider-specific parameter adjustments
     */
    getProviderParameters(intent, providerConfig) {
        const baseParams = {
            maxTokens: providerConfig.maxTokens,
            temperature: 0.1 // Low temperature for technical accuracy
        };
        // Adjust parameters based on intent
        switch (intent.type) {
            case 'component_identification':
                return {
                    ...baseParams,
                    temperature: 0.05, // Very low for precise identification
                    topP: 0.9
                };
            case 'schematic_analysis':
                return {
                    ...baseParams,
                    temperature: 0.15, // Slightly higher for analytical reasoning
                    topP: 0.95
                };
            case 'general_question':
                return {
                    ...baseParams,
                    temperature: 0.2, // Higher for more conversational responses
                    topP: 0.9
                };
            default:
                return baseParams;
        }
    }
    /**
     * Build reasoning chain for complex queries
     */
    buildReasoningChain(_queryText, intent, context, _providerConfig) {
        const chain = [];
        // Add intent-based reasoning steps
        switch (intent.type) {
            case 'component_identification':
                chain.push('1. Examine the electrical diagram for visible components');
                chain.push('2. Identify component types by visual characteristics');
                chain.push('3. Determine component values from markings or context');
                chain.push('4. Explain the function of identified components');
                break;
            case 'schematic_analysis':
                chain.push('1. Analyze overall circuit topology');
                chain.push('2. Trace signal flow through the circuit');
                chain.push('3. Identify key operational principles');
                chain.push('4. Explain circuit behavior and functionality');
                break;
            case 'general_question':
                chain.push('1. Understand the specific question being asked');
                chain.push('2. Provide accurate technical explanation');
                chain.push('3. Include relevant examples or applications');
                chain.push('4. Clarify any complex concepts');
                break;
        }
        // Add context-specific steps
        if (context.entities.length > 2) {
            chain.push('5. Consider relationships between multiple components');
        }
        return chain;
    }
    /**
     * Calculate query complexity score
     */
    calculateComplexityScore(queryText, intent, context) {
        let complexity = 0.3; // Base complexity
        // Text length contribution
        complexity += Math.min(queryText.length / 1000, 0.2);
        // Intent complexity
        const intentComplexity = {
            'component_identification': 0.2,
            'general_question': 0.3,
            'schematic_analysis': 0.5
        };
        complexity += intentComplexity[intent.type] || 0.3;
        // Entity complexity
        complexity += Math.min(context.entities.length * 0.05, 0.2);
        // Topic complexity
        complexity += Math.min(context.topics.length * 0.03, 0.15);
        // Technical term density
        const technicalTerms = (queryText.match(/\b(circuit|voltage|current|resistance|capacitor|transistor|analysis)\b/gi) || []).length;
        complexity += Math.min(technicalTerms * 0.02, 0.1);
        return Math.min(complexity, 1.0);
    }
    /**
     * Calculate cost estimation for optimized queries
     */
    calculateCostEstimation(optimizedPrompts, complexityScore) {
        const estimatedTokens = {};
        const estimatedCost = {};
        let lowestCostProvider = '';
        let lowestCost = Number.MAX_VALUE;
        for (const [providerId, prompt] of Object.entries(optimizedPrompts)) {
            const providerConfig = this.providerConfigs[providerId];
            // Rough token estimation (4 chars per token average)
            const estimatedTokenCount = Math.ceil(prompt.length / 4) + Math.ceil(complexityScore * 500); // Response tokens
            const cost = estimatedTokenCount * providerConfig.costPerToken;
            estimatedTokens[providerId] = estimatedTokenCount;
            estimatedCost[providerId] = cost;
            if (cost < lowestCost) {
                lowestCost = cost;
                lowestCostProvider = providerId;
            }
        }
        return {
            estimatedTokens,
            estimatedCost,
            providerRecommendation: lowestCostProvider
        };
    }
    /**
     * Generate cache key for optimization results
     */
    generateCacheKey(queryText, intent, context) {
        const contextHash = JSON.stringify({
            entities: context.entities.map(e => ({ type: e.type, text: e.text })),
            topics: context.topics.sort()
        });
        return `${queryText.toLowerCase()}_${intent.type}_${Buffer.from(contextHash).toString('base64').slice(0, 10)}`;
    }
    /**
     * Get cached optimization result
     */
    getCachedOptimization(cacheKey) {
        const cached = this.optimizationCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout * 1000) {
            return cached.result;
        }
        return null;
    }
    /**
     * Cache optimization result
     */
    cacheOptimization(cacheKey, result) {
        this.optimizationCache.set(cacheKey, {
            result,
            timestamp: Date.now()
        });
        // Clean old cache entries
        this.cleanCache();
    }
    /**
     * Clean expired cache entries
     */
    cleanCache() {
        const now = Date.now();
        const expireTime = this.config.cacheTimeout * 1000;
        for (const [key, value] of this.optimizationCache.entries()) {
            if (now - value.timestamp > expireTime) {
                this.optimizationCache.delete(key);
            }
        }
    }
    /**
     * Create fallback optimization on error
     */
    createFallbackOptimization(queryText, _intent) {
        const basicPrompt = `As an electrical engineering expert, please answer this query: ${queryText}`;
        return {
            optimizedPrompts: {
                openai: basicPrompt,
                claude: basicPrompt,
                gemini: basicPrompt
            },
            providerSpecificEnhancements: {},
            costEstimation: {
                estimatedTokens: { openai: 100, claude: 100, gemini: 100 },
                estimatedCost: { openai: 0.003, claude: 0.0015, gemini: 0.00125 },
                providerRecommendation: 'gemini'
            },
            complexityScore: 0.5
        };
    }
    /**
     * Update optimization statistics
     */
    updateStats(complexityScore, processingTime) {
        this.stats.totalOptimizations++;
        // Update average complexity score
        const oldAvg = this.stats.averageComplexityScore;
        this.stats.averageComplexityScore = (oldAvg * (this.stats.totalOptimizations - 1) + complexityScore) / this.stats.totalOptimizations;
        // Update average processing time
        const oldTimeAvg = this.stats.averageOptimizationTime;
        this.stats.averageOptimizationTime = (oldTimeAvg * (this.stats.totalOptimizations - 1) + processingTime) / this.stats.totalOptimizations;
    }
    /**
     * Get optimization statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Health check for optimizer
     */
    async healthCheck() {
        try {
            const testIntent = {
                type: 'component_identification',
                confidence: 0.8,
                reasoning: 'test'
            };
            const testContext = {
                entities: [],
                topics: [],
                relevantDocuments: [],
                contextScore: 0.5,
                extractionConfidence: 0.5
            };
            const result = await this.optimizeForProviders("What is R1?", testIntent, testContext);
            return Object.keys(result.optimizedPrompts).length > 0;
        }
        catch {
            return false;
        }
    }
}
exports.QueryOptimizer = QueryOptimizer;
//# sourceMappingURL=QueryOptimizer.js.map