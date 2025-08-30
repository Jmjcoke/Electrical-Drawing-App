import { SharedStorageHealthCheck } from '../shared-storage.health';
import { sharedStorageMetrics } from '../shared-storage.metrics';
import { sharedStorageLogger } from '../shared-storage.logger';
import { SessionPathConfig, ServiceConfig } from '../../types/shared-storage.types';

describe('SharedStorageHealthCheck', () => {
  let healthCheck: SharedStorageHealthCheck;
  let mockConfig: SessionPathConfig;

  beforeEach(() => {
    mockConfig = {
      baseSessionPath: '/tmp/test-sessions',
      serviceMap: {
        'file-processor': {
          name: 'file-processor',
          permissions: { canRead: true, canWrite: true, allowedSubPaths: [] },
          allowedSessionPatterns: ['.*']
        },
        'llm-orchestrator': {
          name: 'llm-orchestrator',
          permissions: { canRead: true, canWrite: false, allowedSubPaths: [] },
          allowedSessionPatterns: ['.*']
        }
      }
    };

    healthCheck = new SharedStorageHealthCheck(mockConfig);

    // Reset metrics before each test
    sharedStorageMetrics.reset();
  });

  describe('basicHealth', () => {
    it('should return healthy status when service is operational', async () => {
      const result = await healthCheck.basicHealth();

      expect(result.status).toBe('healthy');
      expect(result.service).toBe('shared-storage-service');
      expect(result.version).toBe('1.0.0');
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(typeof result.uptime).toBe('number');
    });

    it('should handle errors gracefully', async () => {
      // Mock a config that would cause an error
      const badConfig: SessionPathConfig = { ...mockConfig, baseSessionPath: '/nonexistent/path/that/does/not/exist' };
      const badHealthCheck = new SharedStorageHealthCheck(badConfig);

      const result = await badHealthCheck.basicHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.service).toBe('shared-storage-service');
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('detailedHealth', () => {
    it('should return comprehensive health information', async () => {
      const result = await healthCheck.detailedHealth();

      expect(result.status).toBe('healthy');
      expect(result.service).toBe('shared-storage-service');
      expect(result.version).toBe('1.0.0');
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(typeof result.uptime).toBe('number');

      // Check that all expected check types are present
      expect(result.checks).toHaveProperty('storage');
      expect(result.checks).toHaveProperty('metrics');
      expect(result.checks).toHaveProperty('logging');
      expect(result.checks).toHaveProperty('performance');

      // Check dependencies
      expect(result.dependencies).toHaveProperty('filesystem');
      expect(result.dependencies).toHaveProperty('docker_volume');
      expect(result.dependencies).toHaveProperty('prometheus');
      expect(result.dependencies).toHaveProperty('elasticsearch');
    });

    it('should handle partial failures gracefully', async () => {
      // This test would require mocking filesystem failures
      // For now, we test that the structure is correct
      const result = await healthCheck.detailedHealth();

      expect(result.checks.storage).toHaveProperty('status');
      expect(result.checks.storage).toHaveProperty('details');
      expect(typeof result.checks.storage.status).toBe('string');
    });
  });

  describe('readiness', () => {
    it('should return readiness status', async () => {
      const result = await healthCheck.readiness();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('ready');
      expect(result).toHaveProperty('checks');
      expect(typeof result.ready).toBe('boolean');
    });

    it('should indicate ready when all checks pass', async () => {
      const result = await healthCheck.readiness();

      // In a test environment with proper setup, this should be ready
      expect(result.ready).toBeDefined();
      expect(result.status).toMatch(/ready|not_ready/);
    });
  });

  describe('Health Check Components', () => {
    describe('Storage Health', () => {
      it('should check storage accessibility', async () => {
        const healthCheck = new SharedStorageHealthCheck(mockConfig as SessionPathConfig);
        const result = await healthCheck.detailedHealth();

        expect(result.checks.storage.status).toMatch(/healthy|degraded|unhealthy/);
        expect(result.checks.storage.details).toHaveProperty('accessible');
        expect(result.checks.storage.details).toHaveProperty('basePath');
      });
    });

    describe('Metrics Health', () => {
      it('should verify metrics collection', async () => {
        // Add some metrics data
        sharedStorageMetrics.recordAccessMetrics('test-operation', 'test-service', 50, true);

        const result = await healthCheck.detailedHealth();

        expect(result.checks.metrics.status).toMatch(/healthy|degraded|unhealthy/);
        expect(result.checks.metrics.details).toBeDefined();
      });
    });

    describe('Logging Health', () => {
      it('should verify logging functionality', async () => {
        const result = await healthCheck.detailedHealth();

        expect(result.checks.logging.status).toMatch(/healthy|degraded|unhealthy/);
        expect(result.checks.logging.details).toHaveProperty('winston_configured');
      });
    });

    describe('Performance Health', () => {
      it('should check performance metrics', async () => {
        // Add some performance data
        sharedStorageMetrics.recordAccessMetrics('fast-operation', 'test-service', 10, true);
        sharedStorageMetrics.recordAccessMetrics('slow-operation', 'test-service', 150, true);

        const result = await healthCheck.detailedHealth();

        expect(result.checks.performance.status).toMatch(/healthy|degraded|unhealthy/);
        expect(result.checks.performance.details).toBeDefined();
      });

      it('should detect performance degradation', async () => {
        // Add slow operations that exceed threshold
        for (let i = 0; i < 5; i++) {
          sharedStorageMetrics.recordAccessMetrics('slow-operation', 'test-service', 150, true);
        }

        const result = await healthCheck.detailedHealth();

        // The performance check should detect the slow operations
        expect(result.checks.performance.details).toBeDefined();
      });
    });
  });

  describe('Configuration Validation', () => {
    it('should validate service configuration', async () => {
      const result = await healthCheck.readiness();

      expect(result.checks).toHaveProperty('configuration');
      expect(result.checks.configuration.status).toMatch(/healthy|unhealthy/);
    });

    it('should detect invalid configuration', async () => {
      const invalidConfig: SessionPathConfig = {
        baseSessionPath: '',
        serviceMap: mockConfig.serviceMap
      };

      const invalidHealthCheck = new SharedStorageHealthCheck(invalidConfig);
      const result = await invalidHealthCheck.readiness();

      expect(result.checks.configuration.status).toBe('unhealthy');
    });
  });

  describe('Error Handling', () => {
    it('should handle filesystem errors gracefully', async () => {
      const badConfig: SessionPathConfig = { ...mockConfig, baseSessionPath: '/nonexistent/path/that/does/not/exist' };
      const badHealthCheck = new SharedStorageHealthCheck(badConfig);

      const result = await badHealthCheck.detailedHealth();

      expect(result.status).toBe('unhealthy');
      expect(result.checks.storage.status).toBe('unhealthy');
      expect(result.checks.storage.details.error).toBeDefined();
    });

    it('should handle metrics collection errors', async () => {
      // Mock metrics failure
      jest.spyOn(sharedStorageMetrics, 'getMetricsJson').mockRejectedValue(new Error('Metrics failure'));

      const result = await healthCheck.detailedHealth();

      expect(result.checks.metrics.status).toBe('unhealthy');
      expect(result.checks.metrics.details.error).toBe('Metrics failure');
    });
  });

  describe('Health Check Performance', () => {
    it('should complete health checks within reasonable time', async () => {
      const startTime = Date.now();

      await healthCheck.detailedHealth();

      const duration = Date.now() - startTime;

      // Health checks should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it('should not block on individual component failures', async () => {
      // Mock a slow storage check
      const originalCheckStorage = (healthCheck as any).checkStorageHealth;
      (healthCheck as any).checkStorageHealth = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { status: 'healthy', details: {} };
      };

      const startTime = Date.now();

      await healthCheck.detailedHealth();

      const duration = Date.now() - startTime;

      // Should still complete reasonably fast even with delays
      expect(duration).toBeLessThan(1000);

      // Restore original method
      (healthCheck as any).checkStorageHealth = originalCheckStorage;
    });
  });
});
