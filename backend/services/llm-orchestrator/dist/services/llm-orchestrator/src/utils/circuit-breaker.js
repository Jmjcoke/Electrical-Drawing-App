"use strict";
/**
 * Circuit breaker pattern implementation for LLM provider resilience
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CIRCUIT_BREAKER_CONFIG = exports.CircuitBreakerError = exports.CircuitBreaker = exports.CircuitBreakerState = void 0;
exports.createCircuitBreaker = createCircuitBreaker;
var CircuitBreakerState;
(function (CircuitBreakerState) {
    CircuitBreakerState["CLOSED"] = "CLOSED";
    CircuitBreakerState["OPEN"] = "OPEN";
    CircuitBreakerState["HALF_OPEN"] = "HALF_OPEN"; // Testing if service has recovered
})(CircuitBreakerState || (exports.CircuitBreakerState = CircuitBreakerState = {}));
class CircuitBreaker {
    constructor(name, config) {
        this.name = name;
        this.config = config;
        this.state = CircuitBreakerState.CLOSED;
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses = 0;
        this.totalRequests = 0;
        this.successfulRequests = 0;
        this.failedRequests = 0;
    }
    async execute(operation) {
        this.totalRequests++;
        // Check if circuit breaker should open or close
        this.updateState();
        if (this.state === CircuitBreakerState.OPEN) {
            throw new CircuitBreakerError(`Circuit breaker '${this.name}' is OPEN. Service unavailable.`, this.state, this.getMetrics());
        }
        try {
            const result = await Promise.race([
                operation(),
                this.createTimeoutPromise()
            ]);
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    updateState() {
        const now = new Date();
        switch (this.state) {
            case CircuitBreakerState.CLOSED:
                if (this.consecutiveFailures >= this.config.failureThreshold) {
                    this.state = CircuitBreakerState.OPEN;
                    this.nextAttempt = new Date(now.getTime() + this.config.recoveryTime);
                }
                break;
            case CircuitBreakerState.OPEN:
                if (this.nextAttempt && now >= this.nextAttempt) {
                    this.state = CircuitBreakerState.HALF_OPEN;
                    this.consecutiveSuccesses = 0;
                }
                break;
            case CircuitBreakerState.HALF_OPEN:
                // State transitions happen in onSuccess/onFailure
                break;
        }
    }
    onSuccess() {
        this.successfulRequests++;
        this.lastSuccessTime = new Date();
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses++;
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            // After a successful call in half-open state, close the circuit
            this.state = CircuitBreakerState.CLOSED;
            this.consecutiveSuccesses = 0;
        }
    }
    onFailure() {
        this.failedRequests++;
        this.lastFailureTime = new Date();
        this.consecutiveSuccesses = 0;
        this.consecutiveFailures++;
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            // If we fail in half-open state, go back to open
            this.state = CircuitBreakerState.OPEN;
            this.nextAttempt = new Date(Date.now() + this.config.recoveryTime);
        }
        else if (this.state === CircuitBreakerState.CLOSED && this.consecutiveFailures >= this.config.failureThreshold) {
            // Open the circuit if we've reached the failure threshold
            this.state = CircuitBreakerState.OPEN;
            this.nextAttempt = new Date(Date.now() + this.config.recoveryTime);
        }
    }
    createTimeoutPromise() {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Operation timeout after ${this.config.timeout}ms`));
            }, this.config.timeout);
        });
    }
    getMetrics() {
        return {
            totalRequests: this.totalRequests,
            successfulRequests: this.successfulRequests,
            failedRequests: this.failedRequests,
            state: this.state,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            consecutiveFailures: this.consecutiveFailures,
            consecutiveSuccesses: this.consecutiveSuccesses,
        };
    }
    getState() {
        return this.state;
    }
    getName() {
        return this.name;
    }
    reset() {
        this.state = CircuitBreakerState.CLOSED;
        this.consecutiveFailures = 0;
        this.consecutiveSuccesses = 0;
        this.totalRequests = 0;
        this.successfulRequests = 0;
        this.failedRequests = 0;
        this.lastFailureTime = undefined;
        this.lastSuccessTime = undefined;
        this.nextAttempt = undefined;
    }
    // Manual controls for testing/administration
    forceOpen() {
        this.state = CircuitBreakerState.OPEN;
        this.nextAttempt = new Date(Date.now() + this.config.recoveryTime);
    }
    forceClose() {
        this.state = CircuitBreakerState.CLOSED;
        this.consecutiveFailures = 0;
        this.nextAttempt = undefined;
    }
    forceHalfOpen() {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.consecutiveSuccesses = 0;
    }
}
exports.CircuitBreaker = CircuitBreaker;
class CircuitBreakerError extends Error {
    constructor(message, state, metrics) {
        super(message);
        this.state = state;
        this.metrics = metrics;
        this.name = 'CircuitBreakerError';
    }
}
exports.CircuitBreakerError = CircuitBreakerError;
// Default configuration following industry standards
exports.DEFAULT_CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: 5, // 5 consecutive failures
    timeout: 30000, // 30 seconds timeout
    recoveryTime: 60000, // 60 seconds before attempting recovery
    resetTimeout: 300000, // 5 minutes to reset success count
};
// Factory function for creating circuit breakers with default config
function createCircuitBreaker(name, config = {}) {
    const finalConfig = {
        ...exports.DEFAULT_CIRCUIT_BREAKER_CONFIG,
        ...config
    };
    return new CircuitBreaker(name, finalConfig);
}
//# sourceMappingURL=circuit-breaker.js.map