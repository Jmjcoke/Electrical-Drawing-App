import * as winston from 'winston';
// Note: Elasticsearch transport would need to be installed and configured separately
// import { ElasticsearchTransport } from 'winston-elasticsearch';
import { performance } from 'perf_hooks';

/**
 * SharedStorageLogger provides structured logging for SharedStorageService operations
 * Implements comprehensive logging with correlation IDs, security events, and performance tracking
 */
export class SharedStorageLogger {
  private logger: winston.Logger;
  private correlationCounter: number = 0;
  private readonly serviceName: string = 'shared-storage-service';
  private readonly performanceThreshold: number = 100; // 100ms threshold

  constructor() {
    this.initializeLogger();
  }

  private initializeLogger(): void {
    const transports: winston.transport[] = [
      // Console transport for development
      new winston.transports.Console({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            return `${timestamp} [${this.serviceName}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
          })
        )
      }),

      // File transport for persistent logging
      new winston.transports.File({
        filename: 'logs/shared-storage-service.log',
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      }),

      // Error-only file transport
      new winston.transports.File({
        filename: 'logs/shared-storage-service-error.log',
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      })
    ];

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      defaultMeta: {
        service: this.serviceName,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      transports
    });

    // Handle uncaught exceptions and unhandled rejections
    this.logger.exceptions.handle(
      new winston.transports.File({
        filename: 'logs/shared-storage-service-exceptions.log'
      })
    );

    this.logger.rejections.handle(
      new winston.transports.File({
        filename: 'logs/shared-storage-service-rejections.log'
      })
    );
  }

  /**
   * Generate a correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${this.correlationCounter++}`;
  }

  /**
   * Log file access operations with performance tracking
   */
  logFileAccess(
    operation: string,
    sessionId: string,
    service: string,
    filepath: string,
    duration: number,
    success: boolean,
    error?: Error,
    correlationId?: string
  ): void {
    const correlation = correlationId || this.generateCorrelationId();
    const level = success ? 'info' : 'error';

    const logEntry = {
      event: 'file_access',
      operation,
      sessionId: this.maskSessionId(sessionId),
      service,
      filepath: this.sanitizeFilePath(filepath),
      duration,
      success,
      correlationId: correlation,
      performanceThresholdExceeded: duration > this.performanceThreshold,
      timestamp: new Date().toISOString()
    };

    if (!success && error) {
      (logEntry as any).error = {
        message: error.message,
        name: error.name,
        stack: error.stack
      };
    }

    this.logger.log(level, `File access ${success ? 'successful' : 'failed'}: ${operation}`, logEntry);
  }

  /**
   * Log permission check operations
   */
  logPermissionCheck(
    sessionId: string,
    service: string,
    filepath: string,
    authorized: boolean,
    reason?: string,
    correlationId?: string
  ): void {
    const correlation = correlationId || this.generateCorrelationId();
    const level = authorized ? 'debug' : 'warn';

    this.logger.log(level, `Permission check: ${authorized ? 'granted' : 'denied'}`, {
      event: 'permission_check',
      sessionId: this.maskSessionId(sessionId),
      service,
      filepath: this.sanitizeFilePath(filepath),
      authorized,
      reason: reason || 'N/A',
      correlationId: correlation,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log security events
   */
  logSecurityEvent(
    eventType: 'access_attempt' | 'path_traversal_attempt' | 'unauthorized_access' | 'suspicious_activity',
    details: Record<string, any>,
    correlationId?: string
  ): void {
    const correlation = correlationId || this.generateCorrelationId();

    this.logger.warn(`Security event: ${eventType}`, {
      event: 'security_event',
      eventType,
      details: this.sanitizeSecurityDetails(details),
      correlationId: correlation,
      timestamp: new Date().toISOString(),
      severity: 'high'
    });
  }

  /**
   * Log performance metrics and thresholds
   */
  logPerformanceMetric(
    operation: string,
    duration: number,
    sessionId: string,
    service: string,
    correlationId?: string
  ): void {
    const correlation = correlationId || this.generateCorrelationId();
    const exceeded = duration > this.performanceThreshold;

    const logEntry = {
      event: 'performance_metric',
      operation,
      duration,
      sessionId: this.maskSessionId(sessionId),
      service,
      thresholdExceeded: exceeded,
      threshold: this.performanceThreshold,
      correlationId: correlation,
      timestamp: new Date().toISOString()
    };

    if (exceeded) {
      this.logger.warn(`Performance threshold exceeded: ${operation}`, logEntry);
    } else {
      this.logger.debug(`Performance metric: ${operation}`, logEntry);
    }
  }

  /**
   * Log service health and status changes
   */
  logServiceHealth(
    component: string,
    status: 'healthy' | 'degraded' | 'unhealthy',
    details: Record<string, any>,
    correlationId?: string
  ): void {
    const correlation = correlationId || this.generateCorrelationId();
    const level = status === 'healthy' ? 'info' : status === 'degraded' ? 'warn' : 'error';

    this.logger.log(level, `Service health: ${component} is ${status}`, {
      event: 'service_health',
      component,
      status,
      details,
      correlationId: correlation,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log error events with categorization
   */
  logError(
    operation: string,
    error: Error | unknown,
    sessionId?: string,
    service?: string,
    filepath?: string,
    correlationId?: string
  ): void {
    const correlation = correlationId || this.generateCorrelationId();
    const errorObj = error instanceof Error ? error : new Error(String(error));

    this.logger.error(`Error in ${operation}`, {
      event: 'error',
      operation,
      sessionId: sessionId ? this.maskSessionId(sessionId) : undefined,
      service,
      filepath: filepath ? this.sanitizeFilePath(filepath) : undefined,
      error: {
        message: errorObj.message,
        name: errorObj.name,
        stack: errorObj.stack
      },
      correlationId: correlation,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log informational events
   */
  logInfo(
    message: string,
    details: Record<string, any> = {},
    correlationId?: string
  ): void {
    const correlation = correlationId || this.generateCorrelationId();

    this.logger.info(message, {
      ...details,
      correlationId: correlation,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Create a child logger with additional context
   */
  childLogger(additionalMeta: Record<string, any>): SharedStorageLogger {
    const childLogger = new SharedStorageLogger();
    // In a real implementation, you'd configure the child logger with additional metadata
    return childLogger;
  }

  /**
   * Sanitize session IDs for logging (mask most of the ID)
   */
  private maskSessionId(sessionId: string): string {
    if (sessionId.length <= 8) return '***masked***';
    return `${sessionId.substring(0, 4)}****${sessionId.substring(sessionId.length - 4)}`;
  }

  /**
   * Sanitize file paths for logging (remove sensitive information)
   */
  private sanitizeFilePath(filepath: string): string {
    // Remove any potential sensitive information from file paths
    return filepath.replace(/\/tmp\/[^\/]+/g, '/tmp/***')
                   .replace(/\/var\/log\/[^\/]+/g, '/var/log/***')
                   .replace(/\/home\/[^\/]+/g, '/home/***');
  }

  /**
   * Sanitize security event details
   */
  private sanitizeSecurityDetails(details: Record<string, any>): Record<string, any> {
    const sanitized = { ...details };

    // Remove or mask sensitive information
    if (sanitized.ip) sanitized.ip = this.maskIp(sanitized.ip);
    if (sanitized.userAgent) sanitized.userAgent = '***masked***';
    if (sanitized.sessionId) sanitized.sessionId = this.maskSessionId(sanitized.sessionId);

    return sanitized;
  }

  /**
   * Mask IP addresses
   */
  private maskIp(ip: string): string {
    if (ip.includes('.')) {
      // IPv4
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.***.***`;
      }
    } else if (ip.includes(':')) {
      // IPv6 - mask most of it
      return `${ip.substring(0, 4)}:****:****:****:****:****:****:****`;
    }
    return '***masked***';
  }

  /**
   * Log health check events
   */
  logHealthCheck(checkType: string, healthy: boolean, details: Record<string, any> = {}): void {
    this.logServiceHealth(
      `health_check_${checkType}`,
      healthy ? 'healthy' : 'unhealthy',
      {
        checkType,
        ...details
      }
    );
  }

  /**
   * Log health check requests
   */
  logHealthCheckRequest(endpoint: string, statusCode: number, status: string, details: Record<string, any> = {}): void {
    this.logger.info(`Health Check Request: ${endpoint}`, {
      correlationId: this.generateCorrelationId(),
      endpoint,
      statusCode,
      status,
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      ...details
    });
  }

  /**
   * Log health check errors
   */
  logHealthCheckError(endpoint: string, error: any): void {
    this.logger.error(`Health Check Error: ${endpoint}`, {
      correlationId: this.generateCorrelationId(),
      endpoint,
      error: error.message || error,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      service: this.serviceName
    });
  }

  /**
   * Log metrics requests
   */
  logMetricsRequest(endpoint: string, statusCode: number): void {
    this.logger.info(`Metrics Request: ${endpoint}`, {
      correlationId: this.generateCorrelationId(),
      endpoint,
      statusCode,
      timestamp: new Date().toISOString(),
      service: this.serviceName
    });
  }

  /**
   * Log metrics errors
   */
  logMetricsError(endpoint: string, error: any): void {
    this.logger.error(`Metrics Error: ${endpoint}`, {
      correlationId: this.generateCorrelationId(),
      endpoint,
      error: error.message || error,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      service: this.serviceName
    });
  }

  /**
   * Flush pending logs (useful for graceful shutdown)
   */
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.logger.on('finish', resolve);
      this.logger.end();
    });
  }
}

/**
 * Singleton instance for application-wide logging
 */
export const sharedStorageLogger = new SharedStorageLogger();
