/**
 * ContextABTesting Service Tests
 * Unit tests for A/B testing framework functionality
 */

import { ContextABTestingService, type ContextABTestingConfig } from '../ContextABTesting';
import type { ContextABTestConfig, ContextABVariant } from '../../../../../shared/types/context';

describe('ContextABTestingService', () => {
  let service: ContextABTestingService;
  let config: ContextABTestingConfig;

  beforeEach(() => {
    config = {
      minSampleSize: 100,
      significanceThreshold: 0.05,
      maxConcurrentTests: 5,
      defaultTestDurationDays: 14
    };
    service = new ContextABTestingService(config);
  });

  describe('createTest', () => {
    it('should create a new A/B test successfully', () => {
      const testConfig: Omit<ContextABTestConfig, 'testId'> = {
        name: 'Context Retrieval Speed Test',
        description: 'Testing faster retrieval algorithm',
        enabled: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            description: 'Current implementation',
            isControl: true,
            trafficPercentage: 50,
            configuration: { algorithm: 'current' }
          },
          {
            variantId: 'treatment',
            name: 'Fast Retrieval',
            description: 'Optimized retrieval algorithm',
            isControl: false,
            trafficPercentage: 50,
            configuration: { algorithm: 'optimized' }
          }
        ],
        successMetrics: ['retrieval_time_ms', 'accuracy_score'],
        targetMetric: 'retrieval_time_ms'
      };

      const testId = service.createTest(testConfig);

      expect(testId).toBeDefined();
      expect(typeof testId).toBe('string');
      expect(service.getActiveTests()).toHaveLength(1);
    });

    it('should reject test with insufficient variants', () => {
      const testConfig: Omit<ContextABTestConfig, 'testId'> = {
        name: 'Invalid Test',
        description: 'Test with only one variant',
        enabled: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            description: 'Current implementation',
            isControl: true,
            trafficPercentage: 100,
            configuration: { algorithm: 'current' }
          }
        ],
        successMetrics: ['retrieval_time_ms'],
        targetMetric: 'retrieval_time_ms'
      };

      expect(() => service.createTest(testConfig)).toThrow('Test must have at least 2 variants');
    });

    it('should reject test with invalid traffic percentages', () => {
      const testConfig: Omit<ContextABTestConfig, 'testId'> = {
        name: 'Invalid Traffic Test',
        description: 'Test with incorrect traffic allocation',
        enabled: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            description: 'Current implementation',
            isControl: true,
            trafficPercentage: 60,
            configuration: { algorithm: 'current' }
          },
          {
            variantId: 'treatment',
            name: 'Treatment',
            description: 'New implementation',
            isControl: false,
            trafficPercentage: 30, // Total = 90%, not 100%
            configuration: { algorithm: 'new' }
          }
        ],
        successMetrics: ['retrieval_time_ms'],
        targetMetric: 'retrieval_time_ms'
      };

      expect(() => service.createTest(testConfig)).toThrow('Variant traffic percentages must sum to 100');
    });

    it('should reject test without control variant', () => {
      const testConfig: Omit<ContextABTestConfig, 'testId'> = {
        name: 'No Control Test',
        description: 'Test without control variant',
        enabled: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        variants: [
          {
            variantId: 'treatment1',
            name: 'Treatment 1',
            description: 'First treatment',
            isControl: false,
            trafficPercentage: 50,
            configuration: { algorithm: 'new1' }
          },
          {
            variantId: 'treatment2',
            name: 'Treatment 2',
            description: 'Second treatment',
            isControl: false,
            trafficPercentage: 50,
            configuration: { algorithm: 'new2' }
          }
        ],
        successMetrics: ['retrieval_time_ms'],
        targetMetric: 'retrieval_time_ms'
      };

      expect(() => service.createTest(testConfig)).toThrow('Test must have a control variant');
    });

    it('should enforce maximum concurrent tests limit', () => {
      const baseConfig: Omit<ContextABTestConfig, 'testId'> = {
        name: 'Test',
        description: 'Test description',
        enabled: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            description: 'Control',
            isControl: true,
            trafficPercentage: 50,
            configuration: {}
          },
          {
            variantId: 'treatment',
            name: 'Treatment',
            description: 'Treatment',
            isControl: false,
            trafficPercentage: 50,
            configuration: {}
          }
        ],
        successMetrics: ['metric'],
        targetMetric: 'metric'
      };

      // Create maximum number of tests
      for (let i = 0; i < config.maxConcurrentTests; i++) {
        service.createTest({ ...baseConfig, name: `Test ${i}` });
      }

      // Next test should fail
      expect(() => service.createTest({ ...baseConfig, name: 'Overflow Test' }))
        .toThrow('Maximum number of concurrent tests reached');
    });
  });

  describe('assignVariant', () => {
    it('should assign variant to session', () => {
      const testConfig: Omit<ContextABTestConfig, 'testId'> = {
        name: 'Assignment Test',
        description: 'Testing variant assignment',
        enabled: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            description: 'Control variant',
            isControl: true,
            trafficPercentage: 50,
            configuration: { type: 'control' }
          },
          {
            variantId: 'treatment',
            name: 'Treatment',
            description: 'Treatment variant',
            isControl: false,
            trafficPercentage: 50,
            configuration: { type: 'treatment' }
          }
        ],
        successMetrics: ['metric'],
        targetMetric: 'metric'
      };

      const testId = service.createTest(testConfig);
      const sessionId = 'test-session-123';

      const assignedVariant = service.assignVariant(sessionId, testId);

      expect(assignedVariant).toBeDefined();
      expect(['control', 'treatment']).toContain(assignedVariant!.variantId);
    });

    it('should return consistent variant for same session', () => {
      const testConfig: Omit<ContextABTestConfig, 'testId'> = {
        name: 'Consistency Test',
        description: 'Testing assignment consistency',
        enabled: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            description: 'Control variant',
            isControl: true,
            trafficPercentage: 50,
            configuration: {}
          },
          {
            variantId: 'treatment',
            name: 'Treatment',
            description: 'Treatment variant',
            isControl: false,
            trafficPercentage: 50,
            configuration: {}
          }
        ],
        successMetrics: ['metric'],
        targetMetric: 'metric'
      };

      const testId = service.createTest(testConfig);
      const sessionId = 'consistent-session-456';

      const firstAssignment = service.assignVariant(sessionId, testId);
      const secondAssignment = service.assignVariant(sessionId, testId);

      expect(firstAssignment).toEqual(secondAssignment);
    });

    it('should return null for disabled test', () => {
      const testConfig: Omit<ContextABTestConfig, 'testId'> = {
        name: 'Disabled Test',
        description: 'Testing disabled test handling',
        enabled: false,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            description: 'Control variant',
            isControl: true,
            trafficPercentage: 50,
            configuration: {}
          },
          {
            variantId: 'treatment',
            name: 'Treatment',
            description: 'Treatment variant',
            isControl: false,
            trafficPercentage: 50,
            configuration: {}
          }
        ],
        successMetrics: ['metric'],
        targetMetric: 'metric'
      };

      const testId = service.createTest(testConfig);
      const sessionId = 'disabled-test-session';

      const assignedVariant = service.assignVariant(sessionId, testId);

      expect(assignedVariant).toBeNull();
    });

    it('should return null for expired test', () => {
      const testConfig: Omit<ContextABTestConfig, 'testId'> = {
        name: 'Expired Test',
        description: 'Testing expired test handling',
        enabled: true,
        startDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
        endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            description: 'Control variant',
            isControl: true,
            trafficPercentage: 50,
            configuration: {}
          },
          {
            variantId: 'treatment',
            name: 'Treatment',
            description: 'Treatment variant',
            isControl: false,
            trafficPercentage: 50,
            configuration: {}
          }
        ],
        successMetrics: ['metric'],
        targetMetric: 'metric'
      };

      const testId = service.createTest(testConfig);
      const sessionId = 'expired-test-session';

      const assignedVariant = service.assignVariant(sessionId, testId);

      expect(assignedVariant).toBeNull();
    });
  });

  describe('recordResult', () => {
    it('should record test results correctly', () => {
      const testConfig: Omit<ContextABTestConfig, 'testId'> = {
        name: 'Result Recording Test',
        description: 'Testing result recording',
        enabled: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            description: 'Control variant',
            isControl: true,
            trafficPercentage: 50,
            configuration: {}
          },
          {
            variantId: 'treatment',
            name: 'Treatment',
            description: 'Treatment variant',
            isControl: false,
            trafficPercentage: 50,
            configuration: {}
          }
        ],
        successMetrics: ['retrieval_time_ms'],
        targetMetric: 'retrieval_time_ms'
      };

      const testId = service.createTest(testConfig);
      const sessionId = 'result-recording-session';

      // Assign variant first
      const variant = service.assignVariant(sessionId, testId);
      expect(variant).toBeDefined();

      // Record result
      const metrics = { retrieval_time_ms: 150, accuracy_score: 0.95 };
      service.recordResult(testId, sessionId, metrics, true);

      const results = service.getTestResults(testId);
      expect(results).toHaveLength(1);
      expect(results[0].sessionId).toBe(sessionId);
      expect(results[0].metrics).toEqual(metrics);
      expect(results[0].isSuccessful).toBe(true);
    });

    it('should ignore results for non-existent test', () => {
      const fakeTestId = 'non-existent-test';
      const sessionId = 'test-session';
      const metrics = { metric: 100 };

      // This should not throw an error
      service.recordResult(fakeTestId, sessionId, metrics, true);
      
      const results = service.getTestResults(fakeTestId);
      expect(results).toHaveLength(0);
    });

    it('should ignore results for unassigned session', () => {
      const testConfig: Omit<ContextABTestConfig, 'testId'> = {
        name: 'Unassigned Session Test',
        description: 'Testing unassigned session handling',
        enabled: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            description: 'Control variant',
            isControl: true,
            trafficPercentage: 50,
            configuration: {}
          },
          {
            variantId: 'treatment',
            name: 'Treatment',
            description: 'Treatment variant',
            isControl: false,
            trafficPercentage: 50,
            configuration: {}
          }
        ],
        successMetrics: ['metric'],
        targetMetric: 'metric'
      };

      const testId = service.createTest(testConfig);
      const unassignedSessionId = 'unassigned-session';
      const metrics = { metric: 100 };

      // Record result without assignment
      service.recordResult(testId, unassignedSessionId, metrics, true);

      const results = service.getTestResults(testId);
      expect(results).toHaveLength(0);
    });
  });

  describe('analyzeTest', () => {
    it('should analyze test with sufficient data', () => {
      const testConfig: Omit<ContextABTestConfig, 'testId'> = {
        name: 'Analysis Test',
        description: 'Testing analysis functionality',
        enabled: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            description: 'Control variant',
            isControl: true,
            trafficPercentage: 50,
            configuration: {}
          },
          {
            variantId: 'treatment',
            name: 'Treatment',
            description: 'Treatment variant',
            isControl: false,
            trafficPercentage: 50,
            configuration: {}
          }
        ],
        successMetrics: ['performance'],
        targetMetric: 'performance'
      };

      const testId = service.createTest(testConfig);

      // Generate test data
      for (let i = 0; i < 20; i++) {
        const sessionId = `session-${i}`;
        const variant = service.assignVariant(sessionId, testId);
        
        if (variant) {
          const performance = variant.variantId === 'control' ? 100 + Math.random() * 20 : 80 + Math.random() * 15;
          const isSuccessful = performance < 95;
          service.recordResult(testId, sessionId, { performance }, isSuccessful);
        }
      }

      const analysis = service.analyzeTest(testId);

      expect(analysis).toBeDefined();
      expect(analysis!.testId).toBe(testId);
      expect(analysis!.metrics).toHaveProperty('control');
      expect(analysis!.metrics).toHaveProperty('treatment');
      expect(analysis!.recommendations).toBeInstanceOf(Array);
    });

    it('should return null for non-existent test', () => {
      const analysis = service.analyzeTest('non-existent-test');
      expect(analysis).toBeNull();
    });

    it('should return null for test with no results', () => {
      const testConfig: Omit<ContextABTestConfig, 'testId'> = {
        name: 'No Results Test',
        description: 'Test with no results',
        enabled: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            description: 'Control variant',
            isControl: true,
            trafficPercentage: 50,
            configuration: {}
          },
          {
            variantId: 'treatment',
            name: 'Treatment',
            description: 'Treatment variant',
            isControl: false,
            trafficPercentage: 50,
            configuration: {}
          }
        ],
        successMetrics: ['metric'],
        targetMetric: 'metric'
      };

      const testId = service.createTest(testConfig);
      const analysis = service.analyzeTest(testId);

      expect(analysis).toBeNull();
    });
  });

  describe('concludeTest', () => {
    it('should conclude test and mark as completed', () => {
      const testConfig: Omit<ContextABTestConfig, 'testId'> = {
        name: 'Conclusion Test',
        description: 'Testing test conclusion',
        enabled: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            description: 'Control variant',
            isControl: true,
            trafficPercentage: 50,
            configuration: {}
          },
          {
            variantId: 'treatment',
            name: 'Treatment',
            description: 'Treatment variant',
            isControl: false,
            trafficPercentage: 50,
            configuration: {}
          }
        ],
        successMetrics: ['metric'],
        targetMetric: 'metric'
      };

      const testId = service.createTest(testConfig);

      // Add some test data
      const sessionId = 'conclusion-session';
      const variant = service.assignVariant(sessionId, testId);
      if (variant) {
        service.recordResult(testId, sessionId, { metric: 100 }, true);
      }

      expect(service.getActiveTests()).toHaveLength(1);
      expect(service.getCompletedTests()).toHaveLength(0);

      const result = service.concludeTest(testId, 'Manual conclusion');

      expect(result).toBeDefined();
      expect(service.getActiveTests()).toHaveLength(0);
      expect(service.getCompletedTests()).toHaveLength(1);
    });
  });

  describe('toggleTest', () => {
    it('should enable and disable tests', () => {
      const testConfig: Omit<ContextABTestConfig, 'testId'> = {
        name: 'Toggle Test',
        description: 'Testing test toggling',
        enabled: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        variants: [
          {
            variantId: 'control',
            name: 'Control',
            description: 'Control variant',
            isControl: true,
            trafficPercentage: 50,
            configuration: {}
          },
          {
            variantId: 'treatment',
            name: 'Treatment',
            description: 'Treatment variant',
            isControl: false,
            trafficPercentage: 50,
            configuration: {}
          }
        ],
        successMetrics: ['metric'],
        targetMetric: 'metric'
      };

      const testId = service.createTest(testConfig);

      // Test is initially enabled
      let sessionId = 'toggle-session-1';
      let variant = service.assignVariant(sessionId, testId);
      expect(variant).toBeDefined();

      // Disable test
      const disableResult = service.toggleTest(testId, false);
      expect(disableResult).toBe(true);

      // Should not assign variant when disabled
      sessionId = 'toggle-session-2';
      variant = service.assignVariant(sessionId, testId);
      expect(variant).toBeNull();

      // Re-enable test
      const enableResult = service.toggleTest(testId, true);
      expect(enableResult).toBe(true);

      // Should assign variant when enabled
      sessionId = 'toggle-session-3';
      variant = service.assignVariant(sessionId, testId);
      expect(variant).toBeDefined();
    });

    it('should return false for non-existent test', () => {
      const result = service.toggleTest('non-existent-test', true);
      expect(result).toBe(false);
    });
  });
});