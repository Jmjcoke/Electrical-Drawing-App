import { ErrorCorrelationService } from '../error-correlation.service';
import { defaultErrorCorrelationConfig } from '../error-correlation.types';

describe('ErrorCorrelationService', () => {
  let correlationService: ErrorCorrelationService;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = { ...defaultErrorCorrelationConfig };
    correlationService = new ErrorCorrelationService(mockConfig);
  });

  afterEach(() => {
    correlationService.cleanup();
  });

  describe('Trace Management', () => {
    it('should start a new trace context', () => {
      const trace = correlationService.startTrace(
        'test-operation-123',
        'file_access',
        'shared-storage-service',
        'correlation-456'
      );

      expect(trace).toBeDefined();
      expect(trace.traceId).toBe('correlation-456');
      expect(trace.operationId).toBe('test-operation-123');
      expect(trace.operationType).toBe('file_access');
      expect(trace.service).toBe('shared-storage-service');
      expect(trace.status).toBe('active');
    });

    it('should add spans to traces', () => {
      const trace = correlationService.startTrace(
        'test-operation-123',
        'file_access',
        'shared-storage-service'
      );

      const span = correlationService.addSpan(
        trace.traceId,
        'database-query',
        'database-service',
        trace.spanId
      );

      expect(span).toBeDefined();
      expect(span!.spanName).toBe('database-query');
      expect(span!.service).toBe('database-service');
      expect(span!.parentSpanId).toBe(trace.spanId);
    });

    it('should complete traces and spans', () => {
      const trace = correlationService.startTrace(
        'test-operation-123',
        'file_access',
        'shared-storage-service'
      );

      correlationService.completeTrace(trace.traceId, 'success');

      const retrievedTrace = correlationService.getTrace(trace.traceId);
      expect(retrievedTrace?.status).toBe('success');
      expect(retrievedTrace?.endTime).toBeDefined();
      expect(retrievedTrace?.duration).toBeDefined();
    });

    it('should retrieve traces by service', () => {
      correlationService.startTrace('op1', 'file_access', 'service-a');
      correlationService.startTrace('op2', 'file_access', 'service-b');
      correlationService.startTrace('op3', 'file_access', 'service-a');

      const tracesA = correlationService.getTracesByService('service-a');
      const tracesB = correlationService.getTracesByService('service-b');

      expect(tracesA.length).toBe(2);
      expect(tracesB.length).toBe(1);
    });
  });

  describe('Error Recording and Correlation', () => {
    it('should record errors in traces', () => {
      const trace = correlationService.startTrace(
        'test-operation-123',
        'file_access',
        'shared-storage-service'
      );

      const testError = new Error('Database connection failed');
      correlationService.recordError(
        trace.traceId,
        trace.spanId,
        testError,
        'database-service'
      );

      const retrievedTrace = correlationService.getTrace(trace.traceId);
      expect(retrievedTrace?.status).toBe('error');
      expect(retrievedTrace?.error?.message).toBe('Database connection failed');
    });

    it('should correlate related errors', () => {
      const errorContexts = [
        {
          service: 'database-service',
          operationType: 'file_access',
          error: new Error('Connection timeout'),
          timestamp: Date.now(),
          traceId: 'trace-1'
        },
        {
          service: 'database-service',
          operationType: 'file_access',
          error: new Error('Connection timeout'),
          timestamp: Date.now() + 1000,
          traceId: 'trace-2'
        },
        {
          service: 'database-service',
          operationType: 'file_access',
          error: new Error('Connection timeout'),
          timestamp: Date.now() + 2000,
          traceId: 'trace-3'
        }
      ];

      const result = correlationService.correlateErrors(errorContexts);

      expect(result).toBeDefined();
      expect(result.correlations.length).toBeGreaterThan(0);
      expect(result.severity).toBe('critical'); // Database connectivity correlation - multiple timeouts are critical
      expect(result.rootCauseAnalysis.rootCauseService).toBe('database-service');
    });

    it('should detect circuit breaker correlations', () => {
      const errorContexts = [
        {
          service: 'shared-storage-service',
          operationType: 'file_access',
          error: new Error('Circuit breaker is OPEN'),
          timestamp: Date.now(),
          traceId: 'trace-1'
        },
        {
          service: 'shared-storage-service',
          operationType: 'file_access',
          error: new Error('Circuit breaker is OPEN'),
          timestamp: Date.now() + 1000,
          traceId: 'trace-2'
        }
      ];

      const result = correlationService.correlateErrors(errorContexts);

      expect(result).toBeDefined();
      expect(result.correlations.length).toBeGreaterThan(0);
      const circuitBreakerCorrelation = result.correlations.find(
        c => c.ruleId === 'circuit_breaker_correlation'
      );
      expect(circuitBreakerCorrelation).toBeDefined();
    });
  });

  describe('Root Cause Analysis', () => {
    it('should analyze root cause from error patterns', () => {
      const errorContexts = [
        {
          service: 'database-service',
          operationType: 'query',
          error: new Error('Connection timeout'),
          timestamp: Date.now(),
          traceId: 'trace-1'
        },
        {
          service: 'cache-service',
          operationType: 'get',
          error: new Error('Connection timeout'),
          timestamp: Date.now() + 1000,
          traceId: 'trace-2'
        },
        {
          service: 'database-service',
          operationType: 'query',
          error: new Error('Connection timeout'),
          timestamp: Date.now() + 2000,
          traceId: 'trace-3'
        }
      ];

      const result = correlationService.correlateErrors(errorContexts);

      expect(result.rootCauseAnalysis.rootCauseService).toBe('database-service');
      expect(result.rootCauseAnalysis.confidence).toBeGreaterThan(0);
      expect(result.rootCauseAnalysis.affectedServices).toContain('database-service');
      expect(result.rootCauseAnalysis.affectedServices).toContain('cache-service');
    });

    it('should generate root cause recommendations', () => {
      const errorContexts = [
        {
          service: 'database-service',
          operationType: 'query',
          error: new Error('Connection timeout'),
          timestamp: Date.now(),
          traceId: 'trace-1'
        }
      ];

      const result = correlationService.correlateErrors(errorContexts);

      expect(result.rootCauseAnalysis.recommendations.length).toBeGreaterThan(0);
      expect(result.rootCauseAnalysis.recommendations).toContain(
        'Check database server connectivity and status'
      );
    });
  });

  describe('Incident Management', () => {
    it('should create incidents from high-severity correlations', () => {
      const errorContexts = [
        {
          service: 'database-service',
          operationType: 'query',
          error: new Error('Connection timeout'),
          timestamp: Date.now(),
          traceId: 'trace-1'
        },
        {
          service: 'database-service',
          operationType: 'query',
          error: new Error('Connection timeout'),
          timestamp: Date.now() + 1000,
          traceId: 'trace-2'
        },
        {
          service: 'database-service',
          operationType: 'query',
          error: new Error('Connection timeout'),
          timestamp: Date.now() + 2000,
          traceId: 'trace-3'
        }
      ];

      // Trigger correlation and incident detection
      correlationService.correlateErrors(errorContexts);

      // Force incident detection (normally happens in background)
      (correlationService as any).detectIncidents();

      const activeIncidents = correlationService.getActiveIncidents();
      expect(activeIncidents.length).toBeGreaterThan(0);

      const incident = activeIncidents[0];
      expect(incident.severity).toBe('critical');
      expect(incident.affectedServices).toContain('database-service');
      expect(incident.status).toBe('active');
    });

    it('should update incident status', () => {
      // Create an incident first
      const errorContexts = [
        {
          service: 'database-service',
          operationType: 'query',
          error: new Error('Connection timeout'),
          timestamp: Date.now(),
          traceId: 'trace-1'
        }
      ];

      correlationService.correlateErrors(errorContexts);
      (correlationService as any).detectIncidents();

      const activeIncidents = correlationService.getActiveIncidents();
      const incident = activeIncidents[0];

      const updated = correlationService.updateIncidentStatus(
        incident.incidentId,
        'resolved',
        'test-user'
      );

      expect(updated).toBe(true);

      const retrievedIncident = correlationService.getIncident(incident.incidentId);
      expect(retrievedIncident?.status).toBe('resolved');
      expect(retrievedIncident?.assignedTo).toBe('test-user');
    });
  });

  describe('Error Pattern Analysis', () => {
    it('should track error patterns over time', () => {
      const trace = correlationService.startTrace(
        'test-operation-123',
        'file_access',
        'shared-storage-service'
      );

      // Record multiple errors of the same type
      for (let i = 0; i < 3; i++) {
        const error = new Error('Connection timeout');
        correlationService.recordError(
          trace.traceId,
          trace.spanId,
          error,
          'database-service'
        );
      }

      const patterns = correlationService.getErrorPatterns('database-service');
      expect(patterns.length).toBeGreaterThan(0);

      const timeoutPattern = patterns.find(p => p.errorType === 'timeout');
      expect(timeoutPattern).toBeDefined();
      expect(timeoutPattern!.occurrences).toBe(3);
    });

    it('should provide error pattern statistics', () => {
      const trace = correlationService.startTrace(
        'test-operation-123',
        'file_access',
        'shared-storage-service'
      );

      correlationService.recordError(
        trace.traceId,
        trace.spanId,
        new Error('Connection timeout'),
        'database-service'
      );

      const stats = correlationService.getCorrelationStatistics();
      expect(stats.totalTraces).toBeGreaterThan(0);
      expect(stats.errorTraces).toBeGreaterThan(0);
      expect(stats.topErrorPatterns.length).toBeGreaterThan(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit error recorded events', () => {
      const trace = correlationService.startTrace(
        'test-operation-123',
        'file_access',
        'shared-storage-service'
      );

      const eventSpy = jest.fn();
      correlationService.on('errorRecorded', eventSpy);

      const testError = new Error('Test error');
      correlationService.recordError(
        trace.traceId,
        trace.spanId,
        testError,
        'test-service'
      );

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: trace.traceId,
          spanId: trace.spanId,
          service: 'test-service',
          error: 'Test error'
        })
      );
    });

    it('should emit trace completed events', () => {
      const trace = correlationService.startTrace(
        'test-operation-123',
        'file_access',
        'shared-storage-service'
      );

      const eventSpy = jest.fn();
      correlationService.on('traceCompleted', eventSpy);

      correlationService.completeTrace(trace.traceId, 'success');

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: trace.traceId,
          status: 'success',
          spansCount: 0
        })
      );
    });

    it('should emit correlation completed events', () => {
      const eventSpy = jest.fn();
      correlationService.on('correlationCompleted', eventSpy);

      const errorContexts = [
        {
          service: 'test-service',
          operationType: 'test-operation',
          error: new Error('Test error'),
          timestamp: Date.now(),
          traceId: 'trace-1'
        }
      ];

      correlationService.correlateErrors(errorContexts);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          correlationId: expect.any(String),
          errorCount: 1,
          correlationsFound: expect.any(Number)
        })
      );
    });
  });

  describe('Resource Management', () => {
    it('should cleanup expired traces', () => {
      // Set short expiration time for testing
      const shortConfig = { ...mockConfig, traceExpirationTime: 100 };
      const shortCorrelationService = new ErrorCorrelationService(shortConfig);

      shortCorrelationService.startTrace('test-op', 'file_access', 'test-service');

      // Wait for expiration
      setTimeout(() => {
        // Trigger cleanup (normally happens in background)
        (shortCorrelationService as any).cleanupExpiredTraces();

        const stats = shortCorrelationService.getCorrelationStatistics();
        expect(stats.totalTraces).toBe(0);
      }, 150);

      shortCorrelationService.cleanup();
    });

    it('should respect maximum trace limits', () => {
      const smallConfig = { ...mockConfig, maxTraces: 2 };
      const smallCorrelationService = new ErrorCorrelationService(smallConfig);

      // Create more traces than the limit
      smallCorrelationService.startTrace('trace1', 'file_access', 'service1');
      smallCorrelationService.startTrace('trace2', 'file_access', 'service2');
      smallCorrelationService.startTrace('trace3', 'file_access', 'service3');

      const stats = smallCorrelationService.getCorrelationStatistics();
      expect(stats.totalTraces).toBeLessThanOrEqual(2);

      smallCorrelationService.cleanup();
    });
  });

  describe('Correlation Rules', () => {
    it('should apply correlation rules correctly', () => {
      const errorContexts = [
        {
          service: 'database-service',
          operationType: 'query',
          error: new Error('Connection timeout'),
          timestamp: Date.now(),
          traceId: 'trace-1'
        },
        {
          service: 'database-service',
          operationType: 'query',
          error: new Error('Connection timeout'),
          timestamp: Date.now() + 1000,
          traceId: 'trace-2'
        }
      ];

      const result = correlationService.correlateErrors(errorContexts);

      // Should trigger database connectivity correlation rule
      const dbCorrelation = result.correlations.find(
        c => c.ruleId === 'database_connectivity_correlation'
      );
      expect(dbCorrelation).toBeDefined();
      expect(dbCorrelation!.severity).toBe('critical');
    });

    it('should calculate correlation confidence', () => {
      const errorContexts = [
        {
          service: 'database-service',
          operationType: 'query',
          error: new Error('Connection timeout'),
          timestamp: Date.now(),
          traceId: 'trace-1'
        },
        {
          service: 'database-service',
          operationType: 'query',
          error: new Error('Connection timeout'),
          timestamp: Date.now() + 1000,
          traceId: 'trace-2'
        }
      ];

      const result = correlationService.correlateErrors(errorContexts);

      expect(result.correlations.length).toBeGreaterThan(0);
      result.correlations.forEach(correlation => {
        expect(correlation.confidence).toBeGreaterThanOrEqual(0);
        expect(correlation.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Timeline Analysis', () => {
    it('should build chronological timeline of events', () => {
      const errorContexts = [
        {
          service: 'service-a',
          operationType: 'operation-1',
          error: new Error('Error 1'),
          timestamp: Date.now(),
          traceId: 'trace-1'
        },
        {
          service: 'service-b',
          operationType: 'operation-2',
          error: new Error('Error 2'),
          timestamp: Date.now() + 2000,
          traceId: 'trace-2'
        },
        {
          service: 'service-a',
          operationType: 'operation-3',
          error: new Error('Error 3'),
          timestamp: Date.now() + 1000,
          traceId: 'trace-3'
        }
      ];

      const result = correlationService.correlateErrors(errorContexts);

      expect(result.rootCauseAnalysis.timeline.length).toBe(3);

      // Timeline should be sorted chronologically
      for (let i = 1; i < result.rootCauseAnalysis.timeline.length; i++) {
        expect(result.rootCauseAnalysis.timeline[i].timestamp)
          .toBeGreaterThanOrEqual(result.rootCauseAnalysis.timeline[i - 1].timestamp);
      }
    });
  });
});
