/**
 * Circuit breaker pattern implementation for LLM provider resilience
 */
export declare enum CircuitBreakerState {
    CLOSED = "CLOSED",// Normal operation
    OPEN = "OPEN",// Failing fast, not calling service
    HALF_OPEN = "HALF_OPEN"
}
export interface CircuitBreakerConfig {
    failureThreshold: number;
    timeout: number;
    recoveryTime: number;
    resetTimeout: number;
}
export interface CircuitBreakerMetrics {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    state: CircuitBreakerState;
    lastFailureTime?: Date | undefined;
    lastSuccessTime?: Date | undefined;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
}
export declare class CircuitBreaker {
    private name;
    private config;
    private state;
    private consecutiveFailures;
    private consecutiveSuccesses;
    private lastFailureTime?;
    private lastSuccessTime?;
    private totalRequests;
    private successfulRequests;
    private failedRequests;
    private nextAttempt?;
    constructor(name: string, config: CircuitBreakerConfig);
    execute<T>(operation: () => Promise<T>): Promise<T>;
    private updateState;
    private onSuccess;
    private onFailure;
    private createTimeoutPromise;
    getMetrics(): CircuitBreakerMetrics;
    getState(): CircuitBreakerState;
    getName(): string;
    reset(): void;
    forceOpen(): void;
    forceClose(): void;
    forceHalfOpen(): void;
}
export declare class CircuitBreakerError extends Error {
    state: CircuitBreakerState;
    metrics: CircuitBreakerMetrics;
    constructor(message: string, state: CircuitBreakerState, metrics: CircuitBreakerMetrics);
}
export declare const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig;
export declare function createCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker;
//# sourceMappingURL=circuit-breaker.d.ts.map