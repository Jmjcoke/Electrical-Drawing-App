"use strict";
/**
 * Ensemble Orchestrator
 *
 * Main ensemble orchestration engine that coordinates parallel requests to all available
 * providers and manages response aggregation. Implements fault-tolerant parallel processing
 * with circuit breaker integration and performance monitoring.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnsembleOrchestrator = void 0;
const LLMProvider_interface_1 = require("../providers/base/LLMProvider.interface");
/**
 * Ensemble Orchestrator Implementation
 */
class EnsembleOrchestrator {
    constructor(config) {
        this.providers = new Map();
        this.requestCount = 0;
        this.config = config;
    }
    /**
     * Registers a provider with the ensemble orchestrator
     */
    registerProvider(name, provider, circuitBreaker, options = {}) {
        const execution = {
            provider,
            circuitBreaker,
            priority: options.priority ?? this.config.providers.priority[name] ?? 50,
            weight: options.weight ?? this.config.providers.weights[name] ?? 1.0,
            enabled: options.enabled ?? this.config.providers.enabled.includes(name)
        };
        this.providers.set(name, execution);
        console.log(`✅ Registered provider ${name} with ensemble orchestrator`);
    }
    /**
     * Unregisters a provider from the ensemble orchestrator
     */
    unregisterProvider(name) {
        const result = this.providers.delete(name);
        if (result) {
            console.log(`✅ Unregistered provider ${name} from ensemble orchestrator`);
        }
        return result;
    }
    /**
     * Gets the list of available providers
     */
    getAvailableProviders() {
        return Array.from(this.providers.keys()).filter(name => this.providers.get(name)?.enabled);
    }
    /**
     * Gets the list of healthy providers based on circuit breaker status
     */
    getHealthyProviders() {
        return Array.from(this.providers.entries())
            .filter(([, execution]) => execution.enabled && !execution.circuitBreaker.isOpen())
            .map(([name]) => name);
    }
    /**
     * Main ensemble analysis method - coordinates parallel provider execution
     */
    async analyzeWithEnsemble(image, prompt, options) {
        const ensembleId = this.generateEnsembleId();
        const startTime = Date.now();
        console.log(`🚀 Starting ensemble analysis ${ensembleId} with ${this.providers.size} providers`);
        // Validate minimum providers requirement
        const healthyProviders = this.getHealthyProviders();
        if (healthyProviders.length < this.config.performance.minProvidersRequired) {
            throw new LLMProvider_interface_1.AnalysisError(`Insufficient healthy providers. Required: ${this.config.performance.minProvidersRequired}, Available: ${healthyProviders.length}`, 'ensemble');
        }
        // Execute parallel provider requests
        const executionResults = await this.executeParallelAnalysis(healthyProviders, image, prompt, options);
        // Build ensemble response
        const ensembleResponse = await this.buildEnsembleResponse(ensembleId, executionResults, startTime);
        const totalTime = Date.now() - startTime;
        console.log(`✅ Completed ensemble analysis ${ensembleId} in ${totalTime}ms`);
        return ensembleResponse;
    }
    /**
     * Executes analysis requests to all providers in parallel with fault tolerance
     */
    async executeParallelAnalysis(providerNames, image, prompt, options) {
        const executorPromises = providerNames.map(name => this.executeWithProvider(name, image, prompt, options));
        // Use Promise.allSettled for fault tolerance
        const results = await Promise.allSettled(executorPromises);
        return results.map((result, index) => ({
            providerName: providerNames[index],
            result
        }));
    }
    /**
     * Executes analysis with a single provider, handling circuit breaker and errors
     */
    async executeWithProvider(providerName, image, prompt, options) {
        const execution = this.providers.get(providerName);
        if (!execution) {
            throw new LLMProvider_interface_1.ProviderError(`Provider not found: ${providerName}`, 'PROVIDER_NOT_FOUND', providerName);
        }
        const { provider, circuitBreaker } = execution;
        const startTime = Date.now();
        try {
            // Check circuit breaker state
            if (circuitBreaker.isOpen()) {
                throw new LLMProvider_interface_1.ProviderError(`Circuit breaker is open for provider ${providerName}`, 'CIRCUIT_BREAKER_OPEN', providerName);
            }
            // Execute with timeout constraint
            const providerTimeout = Math.min(options?.timeout ?? this.config.performance.maxProviderTimeout, this.config.performance.maxProviderTimeout);
            const response = await this.withTimeout(provider.analyze(image, prompt, { ...options, timeout: providerTimeout }), providerTimeout);
            // Record successful execution with circuit breaker
            circuitBreaker.recordSuccess();
            const duration = Date.now() - startTime;
            console.log(`✅ Provider ${providerName} completed analysis in ${duration}ms`);
            return response;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            // Record failure with circuit breaker
            circuitBreaker.recordFailure();
            console.error(`❌ Provider ${providerName} failed after ${duration}ms:`, error);
            // Re-throw appropriate error type
            if (error instanceof LLMProvider_interface_1.ProviderError) {
                throw error;
            }
            else if (error instanceof Error && error.message.includes('timeout')) {
                throw new LLMProvider_interface_1.AnalysisError(`Provider ${providerName} timeout after ${duration}ms`, providerName, error);
            }
            else {
                throw new LLMProvider_interface_1.AnalysisError(`Provider ${providerName} analysis failed: ${error}`, providerName, error instanceof Error ? error : new Error(String(error)));
            }
        }
    }
    /**
     * Builds the final ensemble response from individual provider results
     */
    async buildEnsembleResponse(ensembleId, executionResults, startTime) {
        const totalTime = Date.now() - startTime;
        // Separate successful and failed results
        const successfulResults = [];
        const failedResults = [];
        for (const { providerName, result } of executionResults) {
            if (result.status === 'fulfilled') {
                successfulResults.push({ provider: providerName, response: result.value });
            }
            else {
                failedResults.push({
                    provider: providerName,
                    error: result.reason?.message || String(result.reason)
                });
            }
        }
        if (successfulResults.length === 0) {
            throw new LLMProvider_interface_1.AnalysisError('All providers failed to complete analysis', 'ensemble');
        }
        // Extract individual responses
        const individualResponses = successfulResults.map(result => result.response);
        // Build aggregated response (simplified for now - full implementation in Task 2.4.3)
        const aggregated = await this.buildAggregatedResponse(successfulResults);
        // Build consensus result (simplified for now - full implementation in Task 2.4.3)
        const consensus = await this.buildConsensusResult(successfulResults);
        // Calculate ensemble confidence
        const confidence = this.calculateEnsembleConfidence(successfulResults, consensus);
        // Build metadata
        const metadata = {
            totalTime,
            parallelTime: totalTime, // Will be refined with actual parallel timing
            providersAttempted: executionResults.map(r => r.providerName),
            providersSuccessful: successfulResults.map(r => r.provider),
            providersFailed: failedResults,
            circuitBreakerStatus: this.getCircuitBreakerStatus(),
            costBreakdown: this.calculateCostBreakdown(successfulResults),
            performance: {
                totalTime,
                parallelEfficiency: this.calculateParallelEfficiency(successfulResults, totalTime),
                providersUsed: executionResults.length,
                providersSuccessful: successfulResults.length,
                providersFailed: failedResults.length
            }
        };
        return {
            id: ensembleId,
            individual: individualResponses,
            aggregated,
            consensus,
            confidence,
            metadata,
            timestamp: new Date()
        };
    }
    /**
     * Builds aggregated response from successful provider results
     * (Simplified implementation - full implementation in Task 2.4.3)
     */
    async buildAggregatedResponse(results) {
        // This is a simplified implementation for Task 2.4.1
        // Full aggregation logic will be implemented in Task 2.4.3
        const primaryResponse = results[0].response;
        return {
            content: primaryResponse.content,
            components: [], // Will be implemented in Task 2.4.3
            schematicData: {
                connections: [],
                components: [],
                metadata: {}
            },
            answer: primaryResponse.content,
            modelComparison: this.buildModelComparison(results)
        };
    }
    /**
     * Builds consensus result from successful provider results
     * (Simplified implementation - full implementation in Task 2.4.3)
     */
    async buildConsensusResult(results) {
        // Simplified consensus calculation for Task 2.4.1
        const responses = results.map(r => r.response.content);
        const averageConfidence = results.reduce((sum, r) => sum + r.response.confidence, 0) / results.length;
        return {
            agreementLevel: averageConfidence,
            consensusContent: results[0].response.content, // Simplified - will use proper voting in Task 2.4.3
            disagreements: [],
            votingResults: []
        };
    }
    /**
     * Builds model comparison data
     */
    buildModelComparison(results) {
        const providers = results.map(({ provider, response }) => {
            const execution = this.providers.get(provider);
            const cost = execution?.provider.getCost(response.tokensUsed) || 0;
            return {
                provider,
                responseTime: response.responseTime,
                tokensUsed: response.tokensUsed,
                confidence: response.confidence,
                qualityScore: response.confidence, // Simplified - will be refined
                cost
            };
        });
        const totalTime = Math.max(...providers.map(p => p.responseTime));
        const avgResponseTime = providers.reduce((sum, p) => sum + p.responseTime, 0) / providers.length;
        return {
            providers,
            performanceMetrics: {
                totalTime,
                parallelEfficiency: avgResponseTime / totalTime,
                providersUsed: providers.length,
                providersSuccessful: providers.length,
                providersFailed: 0
            },
            qualityScores: {
                overall: providers.reduce((sum, p) => sum + p.qualityScore, 0) / providers.length,
                consistency: this.calculateConsistencyScore(results),
                completeness: this.calculateCompletenessScore(results),
                accuracy: this.calculateAccuracyScore(results)
            }
        };
    }
    /**
     * Calculates ensemble confidence based on provider agreement and individual confidences
     */
    calculateEnsembleConfidence(results, consensus) {
        const weights = this.config.aggregation.confidenceWeighting;
        // Individual confidence average
        const avgConfidence = results.reduce((sum, r) => sum + r.response.confidence, 0) / results.length;
        // Agreement level from consensus
        const agreementScore = consensus.agreementLevel;
        // Completeness based on number of successful providers
        const completenessScore = Math.min(results.length / this.providers.size, 1.0);
        // Weighted ensemble confidence
        return (avgConfidence * weights.agreement +
            agreementScore * weights.consistency +
            completenessScore * weights.completeness) / (weights.agreement + weights.consistency + weights.completeness);
    }
    /**
     * Calculates consistency score based on response similarity
     */
    calculateConsistencyScore(results) {
        if (results.length < 2)
            return 1.0;
        // Simplified consistency calculation based on confidence variance
        const confidences = results.map(r => r.response.confidence);
        const avg = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
        const variance = confidences.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / confidences.length;
        // Lower variance = higher consistency
        return Math.max(0, 1 - variance);
    }
    /**
     * Calculates completeness score based on response length and detail
     */
    calculateCompletenessScore(results) {
        const avgLength = results.reduce((sum, r) => sum + r.response.content.length, 0) / results.length;
        // Normalize to 0-1 range assuming reasonable response lengths
        return Math.min(avgLength / 1000, 1.0);
    }
    /**
     * Calculates accuracy score (simplified implementation)
     */
    calculateAccuracyScore(results) {
        // Simplified - use average confidence as proxy for accuracy
        return results.reduce((sum, r) => sum + r.response.confidence, 0) / results.length;
    }
    /**
     * Gets circuit breaker status for all providers
     */
    getCircuitBreakerStatus() {
        const status = {};
        for (const [name, execution] of this.providers.entries()) {
            status[name] = execution.circuitBreaker.isOpen();
        }
        return status;
    }
    /**
     * Calculates cost breakdown for the ensemble request
     */
    calculateCostBreakdown(results) {
        const byProvider = results.map(({ provider, response }) => {
            const execution = this.providers.get(provider);
            const cost = execution?.provider.getCost(response.tokensUsed) || 0;
            return { provider, cost };
        });
        const total = byProvider.reduce((sum, p) => sum + p.cost, 0);
        return {
            total,
            byProvider,
            breakdown: {
                inputTokens: total * 0.3, // Simplified breakdown
                outputTokens: total * 0.6,
                visionAnalysis: total * 0.1
            }
        };
    }
    /**
     * Calculates parallel execution efficiency
     */
    calculateParallelEfficiency(results, totalTime) {
        if (results.length === 0)
            return 0;
        const totalSequentialTime = results.reduce((sum, r) => sum + r.response.responseTime, 0);
        return totalSequentialTime / (totalTime * results.length);
    }
    /**
     * Generates unique ensemble ID
     */
    generateEnsembleId() {
        return `ensemble-${Date.now()}-${++this.requestCount}`;
    }
    /**
     * Wraps a promise with timeout
     */
    async withTimeout(promise, timeoutMs) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
        });
        return Promise.race([promise, timeoutPromise]);
    }
    /**
     * Gets orchestration statistics
     */
    getStatistics() {
        return {
            totalProviders: this.providers.size,
            enabledProviders: this.getAvailableProviders().length,
            healthyProviders: this.getHealthyProviders().length,
            requestsProcessed: this.requestCount,
            circuitBreakerStatus: this.getCircuitBreakerStatus()
        };
    }
    /**
     * Updates ensemble configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('✅ Updated ensemble configuration');
    }
    /**
     * Performs health check on all providers
     */
    async performHealthCheck() {
        const healthPromises = Array.from(this.providers.entries()).map(async ([name, execution]) => {
            try {
                const healthy = await execution.provider.healthCheck();
                return { name, healthy };
            }
            catch {
                return { name, healthy: false };
            }
        });
        const results = await Promise.allSettled(healthPromises);
        const healthStatus = {};
        results.forEach((result, index) => {
            const providerName = Array.from(this.providers.keys())[index];
            if (result.status === 'fulfilled') {
                healthStatus[result.value.name] = result.value.healthy;
            }
            else {
                healthStatus[providerName] = false;
            }
        });
        return healthStatus;
    }
}
exports.EnsembleOrchestrator = EnsembleOrchestrator;
//# sourceMappingURL=orchestrator.js.map