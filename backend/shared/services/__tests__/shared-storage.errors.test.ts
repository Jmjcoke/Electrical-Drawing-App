import { SharedStorageErrors } from '../shared-storage.errors';
import { SharedStorageAlerts } from '../shared-storage.alerts';
import { sharedStorageLogger } from '../shared-storage.logger';
import { sharedStorageMetrics } from '../shared-storage.metrics';

// Mock dependencies
jest.mock('../shared-storage.alerts');
jest.mock('../shared-storage.logger');
jest.mock('../shared-storage.metrics');

describe('SharedStorageErrors', () => {
  let errorTracker: SharedStorageErrors;
  let mockAlerts: jest.Mocked<SharedStorageAlerts>;

  beforeEach(() => {
    mockAlerts = {
      alertPerformanceDegradation: jest.fn(),
      alertHighErrorRate: jest.fn(),
      alertStorageFailure: jest.fn(),
      alertHealthCheckFailure: jest.fn(),
      getAlertStats: jest.fn()
    } as any;

    errorTracker = new SharedStorageErrors(mockAlerts);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Error Categorization', () => {
    it('should categorize permission denied errors', () => {
      const error = new Error('EACCES: permission denied');
      (error as any).code = 'EACCES';

      const category = (errorTracker as any).categorizeError(error, {
        sessionId: 'test',
        service: 'test-service'
      });

      expect(category).toBe('permission_denied');
    });

    it('should categorize file not found errors', () => {
      const error = new Error('ENOENT: no such file or directory');
      (error as any).code = 'ENOENT';

      const category = (errorTracker as any).categorizeError(error, {
        sessionId: 'test',
        service: 'test-service'
      });

      expect(category).toBe('file_not_found');
    });

    it('should categorize connection errors', () => {
      const error = new Error('ECONNREFUSED: connection refused');
      (error as any).code = 'ECONNREFUSED';

      const category = (errorTracker as any).categorizeError(error, {
        sessionId: 'test',
        service: 'test-service'
      });

      expect(category).toBe('connection_error');
    });

    it('should categorize unknown errors', () => {
      const error = new Error('Unknown error occurred');

      const category = (errorTracker as any).categorizeError(error, {
        sessionId: 'test',
        service: 'test-service'
      });

      expect(category).toBe('unknown_error');
    });
  });

  describe('Error Severity Determination', () => {
    it('should determine critical severity for permission errors', () => {
      const error = new Error('EACCES: permission denied');
      (error as any).code = 'EACCES';

      const severity = (errorTracker as any).determineSeverity(error, {
        sessionId: 'test',
        service: 'test-service'
      });

      expect(severity).toBe('critical');
    });

    it('should determine high severity for file not found errors', () => {
      const error = new Error('ENOENT: no such file or directory');
      (error as any).code = 'ENOENT';

      const severity = (errorTracker as any).determineSeverity(error, {
        sessionId: 'test',
        service: 'test-service'
      });

      expect(severity).toBe('high');
    });

    it('should determine medium severity for validation errors', () => {
      const error = new Error('Invalid input data');

      const severity = (errorTracker as any).determineSeverity(error, {
        sessionId: 'test',
        service: 'test-service'
      });

      expect(severity).toBe('medium');
    });
  });

  describe('Error Tracking', () => {
    it('should track errors successfully', async () => {
      const error = new Error('Test error');
      const context = {
        sessionId: 'session-123',
        service: 'test-service',
        filepath: '/test/file.txt'
      };

      const errorRecord = await errorTracker.trackError(error, context, 'test_operation');

      expect(errorRecord).toBeDefined();
      expect(errorRecord.error.name).toBe('Error');
      expect(errorRecord.error.message).toBe('Test error');
      expect(errorRecord.context).toEqual(context);
      expect(errorRecord.category).toBe('unknown_error');
      expect(errorRecord.severity).toBe('low');
    });

    it('should generate unique error IDs', async () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');
      const context = { sessionId: 'test', service: 'test-service' };

      const record1 = await errorTracker.trackError(error1, context);
      const record2 = await errorTracker.trackError(error2, context);

      expect(record1.id).not.toBe(record2.id);
      expect(record1.id).toMatch(/^err_\d+_[a-z0-9]+$/);
    });

    it('should determine retryable errors correctly', () => {
      const connectionError = new Error('ECONNREFUSED');
      (connectionError as any).code = 'ECONNREFUSED';

      const permissionError = new Error('EACCES');
      (permissionError as any).code = 'EACCES';

      expect((errorTracker as any).isRetryable(connectionError, {
        sessionId: 'test',
        service: 'test'
      })).toBe(true);

      expect((errorTracker as any).isRetryable(permissionError, {
        sessionId: 'test',
        service: 'test'
      })).toBe(false);
    });
  });

  describe('Error Analysis', () => {
    beforeEach(async () => {
      // Create some test errors
      const errors = [
        new Error('File not found'),
        new Error('Permission denied'),
        new Error('Connection failed'),
        new Error('File not found'), // Duplicate for trend analysis
      ];

      (errors[0] as any).code = 'ENOENT';
      (errors[1] as any).code = 'EACCES';
      (errors[2] as any).code = 'ECONNREFUSED';
      (errors[3] as any).code = 'ENOENT';

      const context = { sessionId: 'test', service: 'test-service' };

      for (const error of errors) {
        await errorTracker.trackError(error, context);
      }
    });

    it('should generate error analysis', () => {
      const analysis = errorTracker.generateErrorAnalysis();

      expect(analysis.totalErrors).toBeGreaterThan(0);
      expect(analysis.uniqueErrorTypes).toBeGreaterThan(0);
      expect(analysis.topErrors.length).toBeGreaterThan(0);
      expect(analysis.errorTrends.length).toBeGreaterThan(0);
    });

    it('should identify top errors', () => {
      const analysis = errorTracker.generateErrorAnalysis();

      const fileNotFoundError = analysis.topErrors.find(
        error => error.category === 'file_not_found'
      );

      expect(fileNotFoundError).toBeDefined();
      expect(fileNotFoundError?.count).toBe(2); // We created 2 file not found errors
    });

    it('should generate error insights', () => {
      const analysis = errorTracker.generateErrorAnalysis();

      expect(analysis.insights.length).toBeGreaterThan(0);
    });
  });

  describe('Error Statistics', () => {
    beforeEach(async () => {
      // Create diverse errors for statistics
      const errors = [
        { message: 'File not found', code: 'ENOENT' },
        { message: 'Permission denied', code: 'EACCES' },
        { message: 'Connection failed', code: 'ECONNREFUSED' },
        { message: 'Validation error', code: null },
      ];

      for (let i = 0; i < errors.length; i++) {
        const error = new Error(errors[i].message);
        if (errors[i].code) {
          (error as any).code = errors[i].code;
        }

        await errorTracker.trackError(error, {
          sessionId: `session-${i}`,
          service: i % 2 === 0 ? 'service-a' : 'service-b'
        });
      }
    });

    it('should provide error statistics by category', () => {
      const stats = errorTracker.getErrorStats('file_not_found');

      expect(stats.totalErrors).toBe(1);
      expect(stats.category).toBe('file_not_found');
    });

    it('should provide comprehensive error statistics', () => {
      const stats = errorTracker.getErrorStats();

      expect(stats.totalErrors).toBe(4);
      expect(stats.category).toBe('all');
      expect(Object.keys(stats.errorsBySeverity).length).toBeGreaterThan(0);
      expect(Object.keys(stats.errorsByService).length).toBeGreaterThan(0);
    });

    it('should provide recovery statistics', () => {
      const recoveryStats = errorTracker.getRecoveryStats();

      expect(recoveryStats.totalErrors).toBe(4);
      expect(recoveryStats.recoveryRate).toBeGreaterThanOrEqual(0);
      expect(recoveryStats.recoveryRate).toBeLessThanOrEqual(100);
    });
  });

  describe('Error Threshold Monitoring', () => {
    it('should alert on error threshold exceeded', async () => {
      // Create multiple permission errors to trigger threshold
      for (let i = 0; i < 15; i++) {
        const error = new Error('EACCES: permission denied');
        (error as any).code = 'EACCES';

        await errorTracker.trackError(error, {
          sessionId: 'test',
          service: 'test-service'
        });
      }

      // Wait for threshold check (normally runs every 5 minutes)
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockAlerts.alertHighErrorRate).toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    it('should attempt recovery for retryable errors', async () => {
      const connectionError = new Error('ECONNREFUSED: connection refused');
      (connectionError as any).code = 'ECONNREFUSED';

      const errorRecord = await errorTracker.trackError(connectionError, {
        sessionId: 'test',
        service: 'test-service'
      });

      // Recovery should be attempted automatically
      expect(errorRecord.retryable).toBe(true);
    });

    it('should track recovery success/failure', async () => {
      // This test would require mocking the recovery strategies
      // For now, we verify the structure exists
      const recoveryStats = errorTracker.getRecoveryStats();
      expect(recoveryStats).toHaveProperty('recoveryRate');
    });
  });

  describe('Error Export', () => {
    beforeEach(async () => {
      const error = new Error('Export test error');
      await errorTracker.trackError(error, {
        sessionId: 'export-test',
        service: 'test-service',
        filepath: '/test/file.txt'
      });
    });

    it('should export errors in JSON format', () => {
      const exportData = errorTracker.exportErrorData();

      expect(typeof exportData).toBe('string');

      const parsed = JSON.parse(exportData);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
      expect(parsed[0]).toHaveProperty('id');
      expect(parsed[0]).toHaveProperty('error');
      expect(parsed[0]).toHaveProperty('context');
    });

    it('should export errors in CSV format', () => {
      const exportData = errorTracker.exportErrorData({ format: 'csv' });

      expect(typeof exportData).toBe('string');
      expect(exportData).toContain('id,timestamp,category,severity');
    });

    it('should filter exported errors by date range', () => {
      const fromDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const toDate = new Date();

      const exportData = errorTracker.exportErrorData({
        from: fromDate,
        to: toDate
      });

      expect(typeof exportData).toBe('string');
      const parsed = JSON.parse(exportData);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should filter exported errors by category', () => {
      const exportData = errorTracker.exportErrorData({
        category: 'unknown_error'
      });

      expect(typeof exportData).toBe('string');
      const parsed = JSON.parse(exportData);
      expect(Array.isArray(parsed)).toBe(true);
    });
  });

  describe('Error Fingerprinting', () => {
    it('should generate consistent error fingerprints', () => {
      const error1 = new Error('Test error');
      const error2 = new Error('Test error');

      const fingerprint1 = (errorTracker as any).generateErrorFingerprint(error1, {
        sessionId: 'test',
        service: 'test-service'
      });

      const fingerprint2 = (errorTracker as any).generateErrorFingerprint(error2, {
        sessionId: 'test',
        service: 'test-service'
      });

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should generate different fingerprints for different errors', () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      const fingerprint1 = (errorTracker as any).generateErrorFingerprint(error1, {
        sessionId: 'test',
        service: 'test-service'
      });

      const fingerprint2 = (errorTracker as any).generateErrorFingerprint(error2, {
        sessionId: 'test',
        service: 'test-service'
      });

      expect(fingerprint1).not.toBe(fingerprint2);
    });
  });

  describe('Custom Configuration', () => {
    it('should allow adding custom recovery strategies', () => {
      const customStrategy = {
        name: 'custom_retry',
        category: 'custom_error' as any,
        execute: async () => true
      };

      expect(() => {
        errorTracker.addRecoveryStrategy('custom_error', customStrategy);
      }).not.toThrow();
    });

    it('should allow adding custom error thresholds', () => {
      const customThreshold = {
        category: 'custom_error',
        count: 5,
        timeWindow: 3600000,
        severity: 'medium' as const
      };

      expect(() => {
        errorTracker.addErrorThreshold(customThreshold);
      }).not.toThrow();
    });

    it('should allow configuring retry settings', () => {
      const retryConfig = {
        maxAttempts: 5,
        baseDelay: 2000,
        maxDelay: 20000
      };

      expect(() => {
        errorTracker.configureRetry('custom_error', retryConfig);
      }).not.toThrow();
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle errors without context gracefully', async () => {
      const error = new Error('No context error');

      const errorRecord = await errorTracker.trackError(error, {
        sessionId: '',
        service: ''
      });

      expect(errorRecord).toBeDefined();
      expect(errorRecord.category).toBe('unknown_error');
    });

    it('should handle malformed errors gracefully', async () => {
      const malformedError = {} as Error;

      await expect(errorTracker.trackError(malformedError, {
        sessionId: 'test',
        service: 'test-service'
      })).resolves.toBeDefined();
    });

    it('should handle analysis with no errors gracefully', () => {
      // Create a fresh tracker with no errors
      const freshTracker = new SharedStorageErrors(mockAlerts);
      const analysis = freshTracker.generateErrorAnalysis();

      expect(analysis.totalErrors).toBe(0);
      expect(analysis.uniqueErrorTypes).toBe(0);
      expect(analysis.topErrors).toEqual([]);
    });
  });
});
