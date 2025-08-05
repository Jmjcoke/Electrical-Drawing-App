/**
 * Circuit breaker pattern implementation for LLM provider resilience
 */

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing fast, not calling service
  HALF_OPEN = 'HALF_OPEN' // Testing if service has recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;     // Number of failures before opening
  timeout: number;              // Time in ms before attempting recovery
  recoveryTime: number;         // Time in ms to wait before half-open
  resetTimeout: number;         // Time in ms to reset success count
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

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  private lastFailureTime?: Date | undefined;
  private lastSuccessTime?: Date | undefined;
  private totalRequests = 0;
  private successfulRequests = 0;
  private failedRequests = 0;
  private nextAttempt?: Date | undefined;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit breaker should open or close
    this.updateState();

    if (this.state === CircuitBreakerState.OPEN) {
      throw new CircuitBreakerError(
        `Circuit breaker '${this.name}' is OPEN. Service unavailable.`,
        this.state,
        this.getMetrics()
      );
    }

    try {
      const result = await Promise.race([
        operation(),
        this.createTimeoutPromise<T>()
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private updateState(): void {
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

  private onSuccess(): void {
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

  private onFailure(): void {
    this.failedRequests++;
    this.lastFailureTime = new Date();
    this.consecutiveSuccesses = 0;
    this.consecutiveFailures++;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // If we fail in half-open state, go back to open
      this.state = CircuitBreakerState.OPEN;
      this.nextAttempt = new Date(Date.now() + this.config.recoveryTime);
    } else if (this.state === CircuitBreakerState.CLOSED && this.consecutiveFailures >= this.config.failureThreshold) {
      // Open the circuit if we've reached the failure threshold
      this.state = CircuitBreakerState.OPEN;
      this.nextAttempt = new Date(Date.now() + this.config.recoveryTime);
    }
  }

  private createTimeoutPromise<T>(): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timeout after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });
  }

  getMetrics(): CircuitBreakerMetrics {
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

  getState(): CircuitBreakerState {
    return this.state;
  }

  getName(): string {
    return this.name;
  }

  reset(): void {
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
  forceOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    this.nextAttempt = new Date(Date.now() + this.config.recoveryTime);
  }

  forceClose(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.consecutiveFailures = 0;
    this.nextAttempt = undefined;
  }

  forceHalfOpen(): void {
    this.state = CircuitBreakerState.HALF_OPEN;
    this.consecutiveSuccesses = 0;
  }
}

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public state: CircuitBreakerState,
    public metrics: CircuitBreakerMetrics
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

// Default configuration following industry standards
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,        // 5 consecutive failures
  timeout: 30000,             // 30 seconds timeout
  recoveryTime: 60000,        // 60 seconds before attempting recovery
  resetTimeout: 300000,       // 5 minutes to reset success count
};

// Factory function for creating circuit breakers with default config
export function createCircuitBreaker(
  name: string, 
  config: Partial<CircuitBreakerConfig> = {}
): CircuitBreaker {
  const finalConfig: CircuitBreakerConfig = {
    ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
    ...config
  };
  
  return new CircuitBreaker(name, finalConfig);
}