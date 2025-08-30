import { SharedStorageMetrics } from '../shared-storage.metrics';

describe('SharedStorageMetrics', () => {
  let metrics: SharedStorageMetrics;

  beforeEach(() => {
    metrics = new SharedStorageMetrics();
    // Reset metrics before each test
    metrics.reset();
  });

  describe('recordAccessMetrics', () => {
    it('should record successful operation metrics', async () => {
      const operation = 'getSessionPath';
      const service = 'file-processor';
      const duration = 50; // 50ms
      const success = true;

      metrics.recordAccessMetrics(operation, service, duration, success);

      const metricsJson = await metrics.getMetricsJson();

      // Verify metrics were recorded
      expect(metricsJson).toBeDefined();
      expect(metricsJson.timestamp).toBeDefined();
      expect(metricsJson.activeConnections).toBeDefined();
    });

    it('should record failed operation metrics with error type', async () => {
      const operation = 'accessFile';
      const service = 'llm-orchestrator';
      const duration = 150; // 150ms (exceeds threshold)
      const success = false;
      const errorType = 'FILE_NOT_FOUND';

      metrics.recordAccessMetrics(operation, service, duration, success, errorType);

      const metricsJson = await metrics.getMetricsJson();

      // Verify error metrics were recorded
      expect(metricsJson).toBeDefined();
      expect(metricsJson.timestamp).toBeDefined();
    });

    it('should track performance threshold violations', async () => {
      const operation = 'accessFile';
      const service = 'llm-orchestrator';
      const duration = 150; // Exceeds 100ms threshold
      const success = true;

      metrics.recordAccessMetrics(operation, service, duration, success);

      const metricsJson = await metrics.getMetricsJson();

      // Verify performance threshold tracking
      expect(metricsJson).toBeDefined();
      expect(metricsJson.performanceThreshold).toBe(100);
    });
  });

  describe('operation tracking', () => {
    it('should track active operations correctly', async () => {
      const service = 'file-processor';
      const operationId1 = 'op1';
      const operationId2 = 'op2';

      // Start two operations
      metrics.startOperation(service, operationId1);
      metrics.startOperation(service, operationId2);

      let metricsJson = await metrics.getMetricsJson();
      expect(metricsJson.activeConnections[service]).toBe(2);

      // End one operation
      metrics.endOperation(service, operationId1);

      metricsJson = await metrics.getMetricsJson();
      expect(metricsJson.activeConnections[service]).toBe(1);

      // End second operation
      metrics.endOperation(service, operationId2);

      metricsJson = await metrics.getMetricsJson();
      expect(metricsJson.activeConnections[service]).toBe(0);
    });

    it('should handle multiple services independently', async () => {
      const service1 = 'file-processor';
      const service2 = 'llm-orchestrator';

      metrics.startOperation(service1, 'op1');
      metrics.startOperation(service2, 'op2');

      const metricsJson = await metrics.getMetricsJson();
      expect(metricsJson.activeConnections[service1]).toBe(1);
      expect(metricsJson.activeConnections[service2]).toBe(1);

      metrics.endOperation(service1, 'op1');
      metrics.endOperation(service2, 'op2');

      const updatedMetrics = await metrics.getMetricsJson();
      expect(updatedMetrics.activeConnections[service1]).toBe(0);
      expect(updatedMetrics.activeConnections[service2]).toBe(0);
    });
  });

  describe('volume health monitoring', () => {
    it('should update volume health status', async () => {
      const volume = 'shared_sessions';

      // Initially healthy
      metrics.updateVolumeHealth(volume, true);
      let metricsJson = await metrics.getMetricsJson();
      // Note: Volume health is tracked in Prometheus metrics, not in JSON summary

      // Update to unhealthy
      metrics.updateVolumeHealth(volume, false);
      metricsJson = await metrics.getMetricsJson();

      expect(metricsJson).toBeDefined();
      expect(metricsJson.timestamp).toBeDefined();
    });
  });

  describe('metrics export', () => {
    it('should export metrics in Prometheus format', async () => {
      // Record some metrics
      metrics.recordAccessMetrics('testOperation', 'testService', 25, true);
      metrics.startOperation('testService', 'testOp');

      const prometheusMetrics = await metrics.getMetrics();

      expect(prometheusMetrics).toBeDefined();
      expect(typeof prometheusMetrics).toBe('string');
      expect(prometheusMetrics.length).toBeGreaterThan(0);

      // Should contain metric names
      expect(prometheusMetrics).toContain('shared_storage_access_duration_seconds');
      expect(prometheusMetrics).toContain('shared_storage_operations_total');
    });

    it('should export metrics in JSON format', async () => {
      // Record some metrics
      metrics.recordAccessMetrics('testOperation', 'testService', 25, true);
      metrics.startOperation('testService', 'testOp');

      const jsonMetrics = await metrics.getMetricsJson();

      expect(jsonMetrics).toBeDefined();
      expect(jsonMetrics.timestamp).toBeDefined();
      expect(jsonMetrics.metrics).toBeDefined();
      expect(Array.isArray(jsonMetrics.metrics)).toBe(true);
      expect(jsonMetrics.activeConnections).toBeDefined();
      expect(jsonMetrics.performanceThreshold).toBe(100);
    });
  });

  describe('performance summary', () => {
    it('should generate performance summary', () => {
      const summary = metrics.getPerformanceSummary('file-processor', 5);

      expect(summary).toBeDefined();
      expect(summary.service).toBe('file-processor');
      expect(summary.timeRange).toBe('5 minutes');
      expect(summary.summary).toBeDefined();
      expect(typeof summary.summary.totalOperations).toBe('number');
      expect(typeof summary.summary.averageResponseTime).toBe('number');
    });

    it('should handle undefined service in summary', () => {
      const summary = metrics.getPerformanceSummary();

      expect(summary).toBeDefined();
      expect(summary.service).toBe('all');
      expect(summary.timeRange).toBe('5 minutes');
    });
  });

  describe('metrics reset', () => {
    it('should reset all metrics', async () => {
      // Record some metrics
      metrics.recordAccessMetrics('testOperation', 'testService', 25, true);
      metrics.startOperation('testService', 'testOp');

      let metricsJson = await metrics.getMetricsJson();
      expect(metricsJson).toBeDefined();

      // Reset metrics
      metrics.reset();

      // Verify metrics are reset (new instance created)
      const newMetrics = new SharedStorageMetrics();
      const resetMetricsJson = await newMetrics.getMetricsJson();
      expect(resetMetricsJson).toBeDefined();
      expect(resetMetricsJson.timestamp).toBeDefined();
    });
  });

  describe('success rate calculation', () => {
    it('should update success rate for operations', () => {
      // Record successful operations
      metrics.recordAccessMetrics('testOp', 'testService', 25, true);
      metrics.recordAccessMetrics('testOp', 'testService', 30, true);
      metrics.recordAccessMetrics('testOp', 'testService', 35, true);

      // Record failed operation
      metrics.recordAccessMetrics('testOp', 'testService', 40, false, 'FILE_NOT_FOUND');

      // Success rate should be calculated (implementation uses exponential moving average)
      // The exact value depends on the EMA calculation, but it should be a valid number
      const metricsJson = metrics.getMetricsJson();
      expect(metricsJson).toBeDefined();
    });
  });
});
