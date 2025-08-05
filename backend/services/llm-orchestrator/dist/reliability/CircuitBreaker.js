"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreakerManager = exports.CircuitBreakerFactory = exports.CircuitBreakerOpenError = exports.CircuitBreaker = exports.CircuitBreakerState = void 0;
var CircuitBreakerState;
(function (CircuitBreakerState) {
    CircuitBreakerState["CLOSED"] = "CLOSED";
    CircuitBreakerState["OPEN"] = "OPEN";
    CircuitBreakerState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitBreakerState || (exports.CircuitBreakerState = CircuitBreakerState = {}));
/**
 * Circuit Breaker implementation for protecting LLM provider calls
 */
class CircuitBreaker {
    constructor(config, name = 'CircuitBreaker') {
        this.config = config;
        this.name = name;
        this.state = CircuitBreakerState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.halfOpenRequests = 0;
        this.requestHistory = [];
        this.validateConfig(config);
    }
    /**
     * Executes a function with circuit breaker protection
     */
    async execute(operation) {
        if (!this.canExecute()) {
            throw new CircuitBreakerOpenError(`Circuit breaker is ${this.state}. Next retry at: ${this.nextRetryTime?.toISOString()}`, this.name, this.getMetrics());
        }
        const startTime = Date.now();
        let result;
        try {
            // Execute with timeout
            const operationResult = await this.withTimeout(operation(), this.config.timeout);
            result = {
                success: true,
                duration: Date.now() - startTime,
                timestamp: new Date()
            };
            this.onSuccess(result);
            return operationResult;
        }
        catch (error) {
            result = {
                success: false,
                error: error instanceof Error ? error : new Error(String(error)),
                duration: Date.now() - startTime,
                timestamp: new Date()
            };
            this.onFailure(result);
            throw error;
        }
    }
    /**
     * Gets current circuit breaker metrics
     */
    getMetrics() {
        this.cleanOldRequests();
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            totalRequests: this.requestHistory.length,
            ...(this.lastFailureTime && { lastFailureTime: this.lastFailureTime }),
            ...(this.lastSuccessTime && { lastSuccessTime: this.lastSuccessTime }),
            ...(this.nextRetryTime && { nextRetryTime: this.nextRetryTime }),
            halfOpenRequests: this.halfOpenRequests
        };
    }
    /**
     * Gets the current state of the circuit breaker
     */
    getState() {
        this.updateState();
        return this.state;
    }
    /**
     * Forces the circuit breaker to a specific state (useful for testing)
     */
    forceState(state) {
        this.state = state;
        if (state === CircuitBreakerState.CLOSED) {
            this.failures = 0;
            this.halfOpenRequests = 0;
            this.nextRetryTime = undefined;
        }
        else if (state === CircuitBreakerState.OPEN) {
            this.nextRetryTime = new Date(Date.now() + this.config.recoveryTimeout);
            this.halfOpenRequests = 0;
        }
        else if (state === CircuitBreakerState.HALF_OPEN) {
            this.halfOpenRequests = 0;
            this.nextRetryTime = undefined;
        }
    }
    /**
     * Resets the circuit breaker to CLOSED state
     */
    reset() {
        this.state = CircuitBreakerState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.halfOpenRequests = 0;
        this.lastFailureTime = undefined;
        this.lastSuccessTime = undefined;
        this.nextRetryTime = undefined;
        this.requestHistory = [];
    }
    /**
     * Gets request history within the monitoring window
     */
    getRequestHistory() {
        this.cleanOldRequests();
        return [...this.requestHistory];
    }
    /**
     * Gets failure rate within the monitoring window
     */
    getFailureRate() {
        this.cleanOldRequests();
        if (this.requestHistory.length === 0) {
            return 0;
        }
        const failures = this.requestHistory.filter(r => !r.success).length;
        return failures / this.requestHistory.length;
    }
    /**
     * Checks if a request can be executed
     */
    canExecute() {
        this.updateState();
        switch (this.state) {
            case CircuitBreakerState.CLOSED:
                return true;
            case CircuitBreakerState.OPEN:
                return false;
            case CircuitBreakerState.HALF_OPEN:
                return this.halfOpenRequests < this.config.halfOpenMaxRequests;
            default:
                return false;
        }
    }
    /**
     * Updates the circuit breaker state based on current conditions
     */
    updateState() {
        const now = new Date();
        switch (this.state) {
            case CircuitBreakerState.OPEN:
                if (this.nextRetryTime && now >= this.nextRetryTime) {
                    this.state = CircuitBreakerState.HALF_OPEN;
                    this.halfOpenRequests = 0;
                }
                break;
            case CircuitBreakerState.HALF_OPEN:
                // State transitions are handled in onSuccess/onFailure
                break;
            case CircuitBreakerState.CLOSED:
                this.cleanOldRequests();
                // Check if we should open due to failure rate
                if (this.shouldOpen()) {
                    this.state = CircuitBreakerState.OPEN;
                    this.nextRetryTime = new Date(now.getTime() + this.config.recoveryTimeout);
                    this.halfOpenRequests = 0;
                }
                break;
        }
    }
    /**
     * Handles successful request execution
     */
    onSuccess(result) {
        this.recordRequest(result);
        this.successes++;
        this.lastSuccessTime = result.timestamp;
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            this.halfOpenRequests++;
            // If we've had enough successful requests in half-open, close the circuit
            if (this.halfOpenRequests >= this.config.halfOpenMaxRequests) {
                this.state = CircuitBreakerState.CLOSED;
                this.failures = 0;
                this.halfOpenRequests = 0;
                this.nextRetryTime = undefined;
            }
        }
    }
    /**
     * Handles failed request execution
     */
    onFailure(result) {
        this.recordRequest(result);
        this.failures++;
        this.lastFailureTime = result.timestamp;
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            // Failure in half-open state immediately opens the circuit
            this.state = CircuitBreakerState.OPEN;
            this.nextRetryTime = new Date(result.timestamp.getTime() + this.config.recoveryTimeout);
            this.halfOpenRequests = 0;
        }
    }
    /**
     * Records a request in the history
     */
    recordRequest(result) {
        this.requestHistory.push(result);
        this.cleanOldRequests();
    }
    /**
     * Removes old requests outside the monitoring window
     */
    cleanOldRequests() {
        const cutoffTime = Date.now() - this.config.monitoringWindow;
        this.requestHistory = this.requestHistory.filter(request => request.timestamp.getTime() > cutoffTime);
    }
    /**
     * Determines if the circuit should be opened based on failure rate
     */
    shouldOpen() {
        // Need minimum number of requests to make a decision
        if (this.requestHistory.length < this.config.minimumRequests) {
            return false;
        }
        const failureRate = this.getFailureRate();
        return failureRate >= this.config.failureThreshold;
    }
    /**
     * Wraps a promise with timeout
     */
    async withTimeout(promise, timeoutMs) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Circuit breaker timeout after ${timeoutMs}ms`));
            }, timeoutMs);
        });
        return Promise.race([promise, timeoutPromise]);
    }
    /**
     * Validates circuit breaker configuration
     */
    validateConfig(config) {
        if (config.failureThreshold <= 0 || config.failureThreshold > 1) {
            throw new Error('Failure threshold must be between 0 and 1');
        }
        if (config.recoveryTimeout <= 0) {
            throw new Error('Recovery timeout must be positive');
        }
        if (config.halfOpenMaxRequests <= 0) {
            throw new Error('Half-open max requests must be positive');
        }
        if (config.timeout <= 0) {
            throw new Error('Timeout must be positive');
        }
        if (config.monitoringWindow <= 0) {
            throw new Error('Monitoring window must be positive');
        }
        if (config.minimumRequests <= 0) {
            throw new Error('Minimum requests must be positive');
        }
    }
}
exports.CircuitBreaker = CircuitBreaker;
/**
 * Error thrown when circuit breaker is open
 */
class CircuitBreakerOpenError extends Error {
    constructor(message, circuitBreakerName, metrics) {
        super(message);
        this.circuitBreakerName = circuitBreakerName;
        this.metrics = metrics;
        this.name = 'CircuitBreakerOpenError';
    }
}
exports.CircuitBreakerOpenError = CircuitBreakerOpenError;
/**
 * Factory for creating circuit breakers with common configurations
 */
class CircuitBreakerFactory {
    /**
     * Creates a circuit breaker with conservative settings for LLM providers
     */
    static createForLLMProvider(name) {
        const config = {
            failureThreshold: 0.5, // 50% failure rate
            recoveryTimeout: 30000, // 30 seconds
            halfOpenMaxRequests: 3, // Allow 3 test requests
            timeout: 30000, // 30 second timeout
            monitoringWindow: 60000, // 1 minute window
            minimumRequests: 5 // Need at least 5 requests to evaluate
        };
        return new CircuitBreaker(config, name);
    }
    /**
     * Creates a circuit breaker with aggressive settings for high-frequency operations
     */
    static createAggressive(name) {
        const config = {
            failureThreshold: 0.3, // 30% failure rate
            recoveryTimeout: 10000, // 10 seconds
            halfOpenMaxRequests: 1, // Allow 1 test request
            timeout: 15000, // 15 second timeout
            monitoringWindow: 30000, // 30 second window
            minimumRequests: 3 // Need at least 3 requests to evaluate
        };
        return new CircuitBreaker(config, name);
    }
    /**
     * Creates a circuit breaker with permissive settings for reliable providers
     */
    static createPermissive(name) {
        const config = {
            failureThreshold: 0.8, // 80% failure rate
            recoveryTimeout: 60000, // 1 minute
            halfOpenMaxRequests: 5, // Allow 5 test requests
            timeout: 60000, // 1 minute timeout
            monitoringWindow: 120000, // 2 minute window
            minimumRequests: 10 // Need at least 10 requests to evaluate
        };
        return new CircuitBreaker(config, name);
    }
}
exports.CircuitBreakerFactory = CircuitBreakerFactory;
/**
 * Circuit breaker manager for handling multiple circuit breakers
 */
class CircuitBreakerManager {
    constructor() {
        this.circuitBreakers = new Map();
    }
    /**
     * Gets or creates a circuit breaker for a provider
     */
    getCircuitBreaker(providerName, factory) {
        let circuitBreaker = this.circuitBreakers.get(providerName);
        if (!circuitBreaker) {
            circuitBreaker = factory ? factory() : CircuitBreakerFactory.createForLLMProvider(providerName);
            this.circuitBreakers.set(providerName, circuitBreaker);
        }
        return circuitBreaker;
    }
    /**
     * Gets metrics for all circuit breakers
     */
    getAllMetrics() {
        const metrics = new Map();
        for (const [name, circuitBreaker] of this.circuitBreakers) {
            metrics.set(name, circuitBreaker.getMetrics());
        }
        return metrics;
    }
    /**
     * Resets all circuit breakers
     */
    resetAll() {
        for (const circuitBreaker of this.circuitBreakers.values()) {
            circuitBreaker.reset();
        }
    }
    /**
     * Removes a circuit breaker
     */
    removeCircuitBreaker(providerName) {
        return this.circuitBreakers.delete(providerName);
    }
    /**
     * Gets the number of managed circuit breakers
     */
    size() {
        return this.circuitBreakers.size;
    }
}
exports.CircuitBreakerManager = CircuitBreakerManager;
//# sourceMappingURL=CircuitBreaker.js.map