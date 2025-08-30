import { SharedStorageAlerts } from '../shared-storage.alerts';

// Mock fetch globally
global.fetch = jest.fn();

describe('SharedStorageAlerts', () => {
  let alerts: SharedStorageAlerts;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      slackWebhookUrl: 'https://hooks.slack.com/test',
      pagerdutyRoutingKey: 'test-routing-key',
      environment: 'test',
      alertThresholds: {
        errorRateThreshold: 0.05,
        performanceThresholdMs: 100,
        storageFailureThreshold: 3
      }
    };

    alerts = new SharedStorageAlerts(mockConfig);
    jest.clearAllMocks();
  });

  describe('alertOperationFailure', () => {
    it('should send alert for operation failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      const error = new Error('Test operation failed');
      await alerts.alertOperationFailure('test_operation', 'test_service', error, {
        sessionId: 'session-123',
        filepath: '/test/file.txt'
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(mockConfig.slackWebhookUrl);
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body.text).toContain('SharedStorage Operation Failed');
      expect(body.blocks[0].text.text).toContain('test_operation');
    });

    it('should handle Slack webhook failure gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const error = new Error('Test operation failed');
      await expect(alerts.alertOperationFailure('test_operation', 'test_service', error))
        .resolves.not.toThrow();

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('alertPerformanceDegradation', () => {
    it('should send alert for performance degradation', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      await alerts.alertPerformanceDegradation('test_operation', 'test_service', 150, 100);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);

      expect(body.text).toContain('SharedStorage Performance Degradation');
      expect(body.blocks[0].text.text).toContain('150ms');
    });

    it('should determine correct severity for degradation', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      // High degradation (>50%)
      await alerts.alertPerformanceDegradation('test_operation', 'test_service', 160, 100);

      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);

      expect(body.attachments[0].color).toBe('danger'); // critical severity
    });
  });

  describe('alertHighErrorRate', () => {
    it('should send alert for high error rate', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      await alerts.alertHighErrorRate('test_service', 0.08, 0.05);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);

      expect(body.text).toContain('SharedStorage High Error Rate');
      expect(body.blocks[0].text.text).toContain('8.0%');
    });
  });

  describe('alertStorageFailure', () => {
    it('should send critical alert for volume unmounted', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({ ok: true }); // Slack
      mockFetch.mockResolvedValueOnce({ ok: true }); // PagerDuty

      await alerts.alertStorageFailure('volume_unmounted', {
        volume: 'test-volume',
        mountPoint: '/test/mount'
      });

      expect(mockFetch).toHaveBeenCalledTimes(2); // Both Slack and PagerDuty

      // Check Slack call
      const [slackUrl, slackOptions] = mockFetch.mock.calls[0];
      expect(slackUrl).toBe(mockConfig.slackWebhookUrl);
      const slackBody = JSON.parse(slackOptions.body);
      expect(slackBody.text).toContain('Volume Unmounted');

      // Check PagerDuty call
      const [pdUrl, pdOptions] = mockFetch.mock.calls[1];
      expect(pdUrl).toBe('https://events.pagerduty.com/v2/enqueue');
      const pdBody = JSON.parse(pdOptions.body);
      expect(pdBody.payload.severity).toBe('critical');
    });

    it('should not send PagerDuty alert for non-critical failures', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      await alerts.alertStorageFailure('access_denied');

      expect(global.fetch).toHaveBeenCalledTimes(1); // Only Slack
      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(mockConfig.slackWebhookUrl);
    });
  });

  describe('alertHealthCheckFailure', () => {
    it('should send alert for health check failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      await alerts.alertHealthCheckFailure('storage', {
        storageStatus: 'unhealthy',
        error: 'Connection failed',
        checkDuration: 250
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);

      expect(body.text).toContain('SharedStorage Health Check Failed');
      expect(body.blocks[0].text.text).toContain('storage');
    });
  });

  describe('Rate Limiting', () => {
    it('should respect cooldown period between alerts', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const error = new Error('Test error');

      // First alert should be sent
      await alerts.alertOperationFailure('test_op', 'test_svc', error);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Second alert within cooldown should be rate limited
      await alerts.alertOperationFailure('test_op', 'test_svc', error);
      expect(global.fetch).toHaveBeenCalledTimes(1); // Still 1 call
    });

    it('should respect hourly rate limit', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      const error = new Error('Test error');
      const alertsInstance = alerts as any;

      // Simulate many alerts in short time
      for (let i = 0; i < 15; i++) {
        await alerts.alertOperationFailure(`test_op_${i}`, 'test_svc', error);
      }

      // Should be rate limited after maxAlertsPerHour
      expect(global.fetch).toHaveBeenCalledTimes(10); // maxAlertsPerHour
    });
  });

  describe('Alert Statistics', () => {
    it('should track alert statistics', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await alerts.alertPerformanceDegradation('test_op', 'test_svc', 150, 100);
      await alerts.alertHighErrorRate('test_svc', 0.08, 0.05);

      const stats = alerts.getAlertStats();

      expect(stats.totalAlerts).toBe(2);
      expect(stats.alertsBySeverity.warning).toBe(2);
      expect(stats.alertsByType.performance).toBe(1);
      expect(stats.alertsByType.high_error_rate).toBe(1);
    });
  });

  describe('Slack Message Formatting', () => {
    it('should format Slack messages correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      await alerts.alertOperationFailure('test_operation', 'test_service',
        new Error('Test error'), {
        sessionId: 'session-123',
        filepath: '/test/file.txt'
      });

      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);

      expect(body).toHaveProperty('text');
      expect(body).toHaveProperty('blocks');
      expect(body).toHaveProperty('attachments');
      expect(body.blocks[0].text.text).toContain('test_operation');
      expect(body.attachments[0].fields).toBeDefined();
    });
  });

  describe('PagerDuty Integration', () => {
    it('should send PagerDuty alerts for critical issues', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({ ok: true }); // Slack
      mockFetch.mockResolvedValueOnce({ ok: true }); // PagerDuty

      await alerts.alertStorageFailure('volume_unmounted');

      expect(mockFetch).toHaveBeenCalledTimes(2);

      const [pdUrl, pdOptions] = mockFetch.mock.calls[1];
      expect(pdUrl).toBe('https://events.pagerduty.com/v2/enqueue');

      const pdBody = JSON.parse(pdOptions.body);
      expect(pdBody.event_action).toBe('trigger');
      expect(pdBody.payload.severity).toBe('critical');
      expect(pdBody.routing_key).toBe(mockConfig.pagerdutyRoutingKey);
    });

    it('should not send PagerDuty for non-critical alerts', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      await alerts.alertPerformanceDegradation('test_op', 'test_svc', 120, 100);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(mockConfig.slackWebhookUrl); // Only Slack
    });
  });

  describe('Configuration Handling', () => {
    it('should work without Slack webhook configured', async () => {
      const configWithoutSlack = { ...mockConfig, slackWebhookUrl: undefined };
      const alertsWithoutSlack = new SharedStorageAlerts(configWithoutSlack);

      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      await alertsWithoutSlack.alertStorageFailure('volume_unmounted');

      expect(global.fetch).toHaveBeenCalledTimes(1); // Only PagerDuty
      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://events.pagerduty.com/v2/enqueue');
    });

    it('should work without PagerDuty configured', async () => {
      const configWithoutPD = { ...mockConfig, pagerdutyRoutingKey: undefined };
      const alertsWithoutPD = new SharedStorageAlerts(configWithoutPD);

      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      await alertsWithoutPD.alertPerformanceDegradation('test_op', 'test_svc', 150, 100);

      expect(global.fetch).toHaveBeenCalledTimes(1); // Only Slack
      const [url] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe(mockConfig.slackWebhookUrl);
    });
  });
});
