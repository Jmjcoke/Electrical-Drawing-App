import { SharedStorageAlertRules } from '../shared-storage.alert-rules';
import { SharedStorageAlerts } from '../shared-storage.alerts';
import { SharedStorageHealthCheck } from '../shared-storage.health';
import { SessionPathConfig } from '../../types/shared-storage.types';

// Mock dependencies
jest.mock('../shared-storage.alerts');
jest.mock('../shared-storage.health');
jest.mock('../shared-storage.metrics');

describe('SharedStorageAlertRules', () => {
  let alertRules: SharedStorageAlertRules;
  let mockAlerts: jest.Mocked<SharedStorageAlerts>;
  let mockHealthCheck: jest.Mocked<SharedStorageHealthCheck>;
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

    mockAlerts = {
      alertOperationFailure: jest.fn(),
      alertPerformanceDegradation: jest.fn(),
      alertHighErrorRate: jest.fn(),
      alertStorageFailure: jest.fn(),
      alertHealthCheckFailure: jest.fn(),
      getAlertStats: jest.fn()
    } as any;

    mockHealthCheck = {
      detailedHealth: jest.fn(),
      basicHealth: jest.fn()
    } as any;

    alertRules = new SharedStorageAlertRules(mockAlerts, mockHealthCheck, mockConfig);
  });

  describe('Rule Initialization', () => {
    it('should initialize default rules on creation', () => {
      const rules = alertRules.getRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(rule => rule.id === 'performance_degradation')).toBe(true);
      expect(rules.some(rule => rule.id === 'high_error_rate')).toBe(true);
      expect(rules.some(rule => rule.id === 'storage_health_failure')).toBe(true);
    });

    it('should create service-specific rules for each service', () => {
      const rules = alertRules.getRules();
      expect(rules.some(rule => rule.id === 'service_error_rate_file-processor')).toBe(true);
      expect(rules.some(rule => rule.id === 'service_error_rate_llm-orchestrator')).toBe(true);
    });
  });

  describe('Rule Management', () => {
    it('should add new rules', () => {
      const initialCount = alertRules.getRules().length;

      alertRules.addRule({
        id: 'test_rule',
        name: 'Test Rule',
        description: 'Test rule description',
        severity: 'warning',
        condition: async () => true,
        action: async () => {},
        cooldownMs: 60000
      });

      expect(alertRules.getRules().length).toBe(initialCount + 1);
    });

    it('should remove rules', () => {
      alertRules.addRule({
        id: 'test_rule_to_remove',
        name: 'Test Rule',
        description: 'Test rule description',
        severity: 'warning',
        condition: async () => true,
        action: async () => {},
        cooldownMs: 60000
      });

      const countBefore = alertRules.getRules().length;
      alertRules.removeRule('test_rule_to_remove');
      const countAfter = alertRules.getRules().length;

      expect(countAfter).toBe(countBefore - 1);
    });

    it('should enable and disable rules', () => {
      alertRules.addRule({
        id: 'test_toggle_rule',
        name: 'Test Toggle Rule',
        description: 'Test rule for toggling',
        severity: 'warning',
        condition: async () => true,
        action: async () => {},
        cooldownMs: 60000
      });

      alertRules.setRuleEnabled('test_toggle_rule', false);
      const rules = alertRules.getRules();
      const rule = rules.find(r => r.id === 'test_toggle_rule');
      expect(rule?.enabled).toBe(false);

      alertRules.setRuleEnabled('test_toggle_rule', true);
      const updatedRules = alertRules.getRules();
      const updatedRule = updatedRules.find(r => r.id === 'test_toggle_rule');
      expect(updatedRule?.enabled).toBe(true);
    });
  });

  describe('Rule Evaluation', () => {
    beforeEach(() => {
      // Mock health check to return healthy state
      mockHealthCheck.detailedHealth.mockResolvedValue({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'shared-storage-service',
        uptime: 1000,
        checks: {
          storage: { status: 'healthy', details: {} },
          metrics: { status: 'healthy', details: {} },
          logging: { status: 'healthy', details: {} },
          performance: { status: 'healthy', details: {} }
        },
        dependencies: {}
      });
    });

    it('should evaluate rules and trigger alerts when conditions met', async () => {
      // Mock health check to return unhealthy storage
      mockHealthCheck.detailedHealth.mockResolvedValue({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'shared-storage-service',
        uptime: 1000,
        checks: {
          storage: { status: 'unhealthy', details: { error: 'Connection failed' } },
          metrics: { status: 'healthy', details: {} },
          logging: { status: 'healthy', details: {} },
          performance: { status: 'healthy', details: {} }
        },
        dependencies: {}
      });

      await alertRules.evaluateRules();

      expect(mockAlerts.alertHealthCheckFailure).toHaveBeenCalledWith('storage', {
        storageStatus: 'unhealthy',
        storageDetails: { error: 'Connection failed' },
        overallHealth: 'unhealthy'
      });
    });

    it('should respect cooldown periods', async () => {
      // Mock unhealthy state
      mockHealthCheck.detailedHealth.mockResolvedValue({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'shared-storage-service',
        uptime: 1000,
        checks: {
          storage: { status: 'unhealthy', details: {} },
          metrics: { status: 'healthy', details: {} },
          logging: { status: 'healthy', details: {} },
          performance: { status: 'healthy', details: {} }
        },
        dependencies: {}
      });

      // First evaluation should trigger
      await alertRules.evaluateRules();
      expect(mockAlerts.alertHealthCheckFailure).toHaveBeenCalledTimes(1);

      // Second evaluation within cooldown should not trigger
      await alertRules.evaluateRules();
      expect(mockAlerts.alertHealthCheckFailure).toHaveBeenCalledTimes(1);
    });

    it('should skip disabled rules', async () => {
      alertRules.setRuleEnabled('storage_health_failure', false);

      // Mock unhealthy state
      mockHealthCheck.detailedHealth.mockResolvedValue({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'shared-storage-service',
        uptime: 1000,
        checks: {
          storage: { status: 'unhealthy', details: {} },
          metrics: { status: 'healthy', details: {} },
          logging: { status: 'healthy', details: {} },
          performance: { status: 'healthy', details: {} }
        },
        dependencies: {}
      });

      await alertRules.evaluateRules();

      expect(mockAlerts.alertHealthCheckFailure).not.toHaveBeenCalled();
    });
  });

  describe('Monitoring Control', () => {
    it('should start monitoring successfully', () => {
      alertRules.startMonitoring();
      const stats = alertRules.getStats();
      expect(stats.monitoringActive).toBe(true);
    });

    it('should stop monitoring successfully', () => {
      alertRules.startMonitoring();
      alertRules.stopMonitoring();

      const stats = alertRules.getStats();
      expect(stats.monitoringActive).toBe(false);
    });

    it('should handle multiple start/stop calls', () => {
      alertRules.startMonitoring();
      alertRules.startMonitoring(); // Should not error
      expect(alertRules.getStats().monitoringActive).toBe(true);

      alertRules.stopMonitoring();
      alertRules.stopMonitoring(); // Should not error
      expect(alertRules.getStats().monitoringActive).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should provide comprehensive statistics', () => {
      const stats = alertRules.getStats();

      expect(stats).toHaveProperty('totalRules');
      expect(stats).toHaveProperty('enabledRules');
      expect(stats).toHaveProperty('disabledRules');
      expect(stats).toHaveProperty('rulesBySeverity');
      expect(stats).toHaveProperty('monitoringActive');
      expect(stats).toHaveProperty('checkIntervalMs');
      expect(stats).toHaveProperty('lastEvaluation');

      expect(typeof stats.totalRules).toBe('number');
      expect(typeof stats.monitoringActive).toBe('boolean');
    });

    it('should update lastEvaluation on rule evaluation', async () => {
      const statsBefore = alertRules.getStats();
      const lastEvalBefore = statsBefore.lastEvaluation;

      await alertRules.evaluateRules();

      const statsAfter = alertRules.getStats();
      const lastEvalAfter = statsAfter.lastEvaluation;

      // Should be different timestamps
      expect(lastEvalAfter).not.toBe(lastEvalBefore);
    });
  });

  describe('Test Alert Triggering', () => {
    it('should trigger test alerts for different types', async () => {
      await alertRules.triggerTestAlert('performance', { duration: 150 });

      expect(mockAlerts.alertPerformanceDegradation).toHaveBeenCalledWith(
        'test_operation',
        'test_service',
        150,
        100
      );
    });

    it('should handle error test alerts', async () => {
      await alertRules.triggerTestAlert('error', { errorRate: 0.08 });

      expect(mockAlerts.alertHighErrorRate).toHaveBeenCalledWith(
        'test_service',
        0.08,
        0.05
      );
    });

    it('should handle storage failure test alerts', async () => {
      const context = { volume: 'test-volume' };
      await alertRules.triggerTestAlert('storage', context);

      expect(mockAlerts.alertStorageFailure).toHaveBeenCalledWith(
        'access_denied',
        context
      );
    });

    it('should handle unknown alert types gracefully', async () => {
      await alertRules.triggerTestAlert('unknown_type');

      expect(mockAlerts.alertOperationFailure).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle rule condition errors gracefully', async () => {
      alertRules.addRule({
        id: 'failing_rule',
        name: 'Failing Rule',
        description: 'Rule that throws error',
        severity: 'warning',
        condition: async () => {
          throw new Error('Condition evaluation failed');
        },
        action: async () => {},
        cooldownMs: 60000
      });

      // Should not throw when evaluating rules
      await expect(alertRules.evaluateRules()).resolves.not.toThrow();
    });

    it('should handle rule action errors gracefully', async () => {
      alertRules.addRule({
        id: 'failing_action_rule',
        name: 'Failing Action Rule',
        description: 'Rule action that throws error',
        severity: 'warning',
        condition: async () => true,
        action: async () => {
          throw new Error('Action execution failed');
        },
        cooldownMs: 60000
      });

      // Should not throw when evaluating rules
      await expect(alertRules.evaluateRules()).resolves.not.toThrow();
    });

    it('should handle health check errors gracefully', async () => {
      mockHealthCheck.detailedHealth.mockRejectedValue(new Error('Health check failed'));

      // Should not throw when evaluating rules
      await expect(alertRules.evaluateRules()).resolves.not.toThrow();
    });
  });

  describe('Rule Configuration', () => {
    it('should provide rule configuration details', () => {
      const rules = alertRules.getRules();

      rules.forEach(rule => {
        expect(rule).toHaveProperty('id');
        expect(rule).toHaveProperty('name');
        expect(rule).toHaveProperty('description');
        expect(rule).toHaveProperty('severity');
        expect(rule).toHaveProperty('enabled');
        expect(rule).toHaveProperty('cooldownMs');
        expect(rule).toHaveProperty('lastTriggered');

        expect(['critical', 'warning', 'info']).toContain(rule.severity);
        expect(typeof rule.enabled).toBe('boolean');
        expect(typeof rule.cooldownMs).toBe('number');
        expect(typeof rule.lastTriggered).toBe('number');
      });
    });

    it('should maintain rule state across operations', () => {
      const ruleId = 'test_state_rule';
      alertRules.addRule({
        id: ruleId,
        name: 'Test State Rule',
        description: 'Test rule for state management',
        severity: 'warning',
        condition: async () => false,
        action: async () => {},
        cooldownMs: 60000
      });

      let rules = alertRules.getRules();
      let rule = rules.find(r => r.id === ruleId);
      expect(rule?.enabled).toBe(true);

      alertRules.setRuleEnabled(ruleId, false);
      rules = alertRules.getRules();
      rule = rules.find(r => r.id === ruleId);
      expect(rule?.enabled).toBe(false);
    });
  });
});
