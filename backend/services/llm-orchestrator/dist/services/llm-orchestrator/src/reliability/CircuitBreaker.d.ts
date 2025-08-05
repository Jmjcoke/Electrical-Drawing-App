/**
 * Circuit Breaker Pattern Implementation
 *
 * Implements the circuit breaker pattern for LLM providers to prevent
 * cascading failures and provide graceful degradation when providers fail.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Provider is failing, requests are rejected immediately
 * - HALF_OPEN: Test requests are allowed to check if provider has recovered
 */
export declare enum CircuitBreakerState {
    CLOSED = "CLOSED",
    OPEN = "OPEN",
    HALF_OPEN = "HALF_OPEN"
}
export interface CircuitBreakerConfig {
    readonly failureThreshold: number;
    readonly recoveryTimeout: number;
    readonly halfOpenMaxRequests: number;
    readonly timeout: number;
    readonly monitoringWindow: number;
    readonly minimumRequests: number;
}
export interface CircuitBreakerMetrics {
    readonly state: CircuitBreakerState;
    readonly failures: number;
    readonly successes: number;
    readonly totalRequests: number;
    readonly lastFailureTime?: Date;
    readonly lastSuccessTime?: Date;
    readonly nextRetryTime?: Date;
    readonly halfOpenRequests: number;
}
export interface RequestResult {
    readonly success: boolean;
    readonly error?: Error;
    readonly duration: number;
    readonly timestamp: Date;
}
/**
 * Circuit Breaker implementation for protecting LLM provider calls
 */
export declare class CircuitBreaker {
    private readonly config;
    private readonly name;
    private state;
    private failures;
    private successes;
    private halfOpenRequests;
    private lastFailureTime?;
    private lastSuccessTime?;
    private nextRetryTime?;
    private requestHistory;
    constructor(config: CircuitBreakerConfig, name?: string);
    /**
     * Executes a function with circuit breaker protection
     */
    execute<T>(operation: () => Promise<T>): Promise<T>;
    /**
     * Gets current circuit breaker metrics
     */
    getMetrics(): CircuitBreakerMetrics;
    /**
     * Gets the current state of the circuit breaker
     */
    getState(): CircuitBreakerState;
    /**
     * Forces the circuit breaker to a specific state (useful for testing)
     */
    forceState(state: CircuitBreakerState): void;
    /**
     * Resets the circuit breaker to CLOSED state
     */
    reset(): void;
    /**
     * Gets request history within the monitoring window
     */
    getRequestHistory(): ReadonlyArray<RequestResult>;
    /**
     * Gets failure rate within the monitoring window
     */
    getFailureRate(): number;
    /**
     * Checks if a request can be executed
     */
    private canExecute;
    /**
     * Updates the circuit breaker state based on current conditions
     */
    private updateState;
    /**
     * Handles successful request execution
     */
    private onSuccess;
    /**
     * Handles failed request execution
     */
    private onFailure;
    /**
     * Records a request in the history
     */
    private recordRequest;
    /**
     * Removes old requests outside the monitoring window
     */
    private cleanOldRequests;
    /**
     * Determines if the circuit should be opened based on failure rate
     */
    private shouldOpen;
    /**
     * Wraps a promise with timeout
     */
    private withTimeout;
    /**
     * Validates circuit breaker configuration
     */
    private validateConfig;
}
/**
 * Error thrown when circuit breaker is open
 */
export declare class CircuitBreakerOpenError extends Error {
    readonly circuitBreakerName: string;
    readonly metrics: CircuitBreakerMetrics;
    constructor(message: string, circuitBreakerName: string, metrics: CircuitBreakerMetrics);
}
/**
 * Factory for creating circuit breakers with common configurations
 */
export declare class CircuitBreakerFactory {
    /**
     * Creates a circuit breaker with conservative settings for LLM providers
     */
    static createForLLMProvider(name: string): CircuitBreaker;
    /**
     * Creates a circuit breaker with aggressive settings for high-frequency operations
     */
    static createAggressive(name: string): CircuitBreaker;
    /**
     * Creates a circuit breaker with permissive settings for reliable providers
     */
    static createPermissive(name: string): CircuitBreaker;
}
/**
 * Circuit breaker manager for handling multiple circuit breakers
 */
export declare class CircuitBreakerManager {
    private readonly circuitBreakers;
    /**
     * Gets or creates a circuit breaker for a provider
     */
    getCircuitBreaker(providerName: string, factory?: () => CircuitBreaker): CircuitBreaker;
    /**
     * Gets metrics for all circuit breakers
     */
    getAllMetrics(): Map<string, CircuitBreakerMetrics>;
    /**
     * Resets all circuit breakers
     */
    resetAll(): void;
    /**
     * Removes a circuit breaker
     */
    removeCircuitBreaker(providerName: string): boolean;
    /**
     * Gets the number of managed circuit breakers
     */
    size(): number;
}
//# sourceMappingURL=CircuitBreaker.d.ts.map