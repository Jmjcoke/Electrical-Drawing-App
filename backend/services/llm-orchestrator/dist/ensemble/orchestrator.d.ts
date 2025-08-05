/**
 * Ensemble Orchestrator
 *
 * Main ensemble orchestration engine that coordinates parallel requests to all available
 * providers and manages response aggregation. Implements fault-tolerant parallel processing
 * with circuit breaker integration and performance monitoring.
 */
import { LLMProvider, LLMResponse, AnalysisOptions } from '../providers/base/LLMProvider.interface';
import { CircuitBreaker } from '../reliability/CircuitBreaker';
export interface EnsembleResponse {
    readonly id: string;
    readonly individual: LLMResponse[];
    readonly aggregated: AggregatedResponse;
    readonly consensus: ConsensusResult;
    readonly confidence: number;
    readonly metadata: EnsembleMetadata;
    readonly timestamp: Date;
}
export interface AggregatedResponse {
    readonly content: string;
    readonly components: ComponentIdentification[];
    readonly schematicData: SchematicData;
    readonly answer: string;
    readonly modelComparison: ModelComparison;
}
export interface ConsensusResult {
    readonly agreementLevel: number;
    readonly consensusContent: string;
    readonly disagreements: string[];
    readonly votingResults: VotingResult[];
}
export interface VotingResult {
    readonly topic: string;
    readonly votes: Array<{
        provider: string;
        vote: string;
        confidence: number;
    }>;
    readonly winner: string;
    readonly winnerConfidence: number;
}
export interface ComponentIdentification {
    readonly id: string;
    readonly type: string;
    readonly confidence: number;
    readonly location: Coordinates;
    readonly supportingProviders: string[];
    readonly providerAgreement: number;
}
export interface Coordinates {
    readonly x: number;
    readonly y: number;
    readonly width?: number;
    readonly height?: number;
}
export interface SchematicData {
    readonly connections: Connection[];
    readonly components: ComponentData[];
    readonly metadata: Record<string, unknown>;
}
export interface Connection {
    readonly from: ComponentReference;
    readonly to: ComponentReference;
    readonly type: string;
    readonly confidence: number;
}
export interface ComponentReference {
    readonly componentId: string;
    readonly pin?: string;
    readonly terminal?: string;
}
export interface ComponentData {
    readonly id: string;
    readonly type: string;
    readonly properties: Record<string, unknown>;
    readonly location: Coordinates;
}
export interface ModelComparison {
    readonly providers: ProviderComparison[];
    readonly performanceMetrics: PerformanceMetrics;
    readonly qualityScores: QualityScores;
}
export interface ProviderComparison {
    readonly provider: string;
    readonly responseTime: number;
    readonly tokensUsed: number;
    readonly confidence: number;
    readonly qualityScore: number;
    readonly cost: number;
}
export interface PerformanceMetrics {
    readonly totalTime: number;
    readonly parallelEfficiency: number;
    readonly providersUsed: number;
    readonly providersSuccessful: number;
    readonly providersFailed: number;
}
export interface QualityScores {
    readonly overall: number;
    readonly consistency: number;
    readonly completeness: number;
    readonly accuracy: number;
}
export interface EnsembleMetadata {
    readonly totalTime: number;
    readonly parallelTime: number;
    readonly providersAttempted: string[];
    readonly providersSuccessful: string[];
    readonly providersFailed: Array<{
        provider: string;
        error: string;
    }>;
    readonly circuitBreakerStatus: Record<string, boolean>;
    readonly costBreakdown: CostBreakdown;
    readonly performance: PerformanceMetrics;
}
export interface CostBreakdown {
    readonly total: number;
    readonly byProvider: Array<{
        provider: string;
        cost: number;
    }>;
    readonly breakdown: {
        inputTokens: number;
        outputTokens: number;
        visionAnalysis: number;
    };
}
export interface EnsembleConfig {
    readonly providers: {
        enabled: string[];
        priority: Record<string, number>;
        weights: Record<string, number>;
    };
    readonly performance: {
        maxTotalTimeout: number;
        maxProviderTimeout: number;
        minProvidersRequired: number;
        enableLoadBalancing: boolean;
    };
    readonly aggregation: {
        consensusThreshold: number;
        confidenceWeighting: {
            agreement: number;
            completeness: number;
            consistency: number;
        };
        componentClusteringThreshold: number;
    };
    readonly monitoring: {
        enablePerformanceTracking: boolean;
        enableHealthChecks: boolean;
        healthCheckInterval: number;
    };
}
export interface ProviderExecution {
    readonly provider: LLMProvider;
    readonly circuitBreaker: CircuitBreaker;
    readonly priority: number;
    readonly weight: number;
    readonly enabled: boolean;
}
/**
 * Ensemble Orchestrator Implementation
 */
export declare class EnsembleOrchestrator {
    private providers;
    private config;
    private requestCount;
    constructor(config: EnsembleConfig);
    /**
     * Registers a provider with the ensemble orchestrator
     */
    registerProvider(name: string, provider: LLMProvider, circuitBreaker: CircuitBreaker, options?: {
        priority?: number;
        weight?: number;
        enabled?: boolean;
    }): void;
    /**
     * Unregisters a provider from the ensemble orchestrator
     */
    unregisterProvider(name: string): boolean;
    /**
     * Gets the list of available providers
     */
    getAvailableProviders(): string[];
    /**
     * Gets the list of healthy providers based on circuit breaker status
     */
    getHealthyProviders(): string[];
    /**
     * Main ensemble analysis method - coordinates parallel provider execution
     */
    analyzeWithEnsemble(image: Buffer, prompt: string, options?: AnalysisOptions): Promise<EnsembleResponse>;
    /**
     * Executes analysis requests to all providers in parallel with fault tolerance
     */
    private executeParallelAnalysis;
    /**
     * Executes analysis with a single provider, handling circuit breaker and errors
     */
    private executeWithProvider;
    /**
     * Builds the final ensemble response from individual provider results
     */
    private buildEnsembleResponse;
    /**
     * Builds aggregated response from successful provider results
     * (Simplified implementation - full implementation in Task 2.4.3)
     */
    private buildAggregatedResponse;
    /**
     * Builds consensus result from successful provider results
     * (Simplified implementation - full implementation in Task 2.4.3)
     */
    private buildConsensusResult;
    /**
     * Builds model comparison data
     */
    private buildModelComparison;
    /**
     * Calculates ensemble confidence based on provider agreement and individual confidences
     */
    private calculateEnsembleConfidence;
    /**
     * Calculates consistency score based on response similarity
     */
    private calculateConsistencyScore;
    /**
     * Calculates completeness score based on response length and detail
     */
    private calculateCompletenessScore;
    /**
     * Calculates accuracy score (simplified implementation)
     */
    private calculateAccuracyScore;
    /**
     * Gets circuit breaker status for all providers
     */
    private getCircuitBreakerStatus;
    /**
     * Calculates cost breakdown for the ensemble request
     */
    private calculateCostBreakdown;
    /**
     * Calculates parallel execution efficiency
     */
    private calculateParallelEfficiency;
    /**
     * Generates unique ensemble ID
     */
    private generateEnsembleId;
    /**
     * Wraps a promise with timeout
     */
    private withTimeout;
    /**
     * Gets orchestration statistics
     */
    getStatistics(): {
        totalProviders: number;
        enabledProviders: number;
        healthyProviders: number;
        requestsProcessed: number;
        circuitBreakerStatus: Record<string, boolean>;
    };
    /**
     * Updates ensemble configuration
     */
    updateConfig(newConfig: Partial<EnsembleConfig>): void;
    /**
     * Performs health check on all providers
     */
    performHealthCheck(): Promise<Record<string, boolean>>;
}
//# sourceMappingURL=orchestrator.d.ts.map