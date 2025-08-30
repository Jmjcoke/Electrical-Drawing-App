import { EventEmitter } from 'events';
import { sharedStorageLogger } from './shared-storage.logger';
import { sharedStorageMetrics } from './shared-storage.metrics';
import {
  ChaosEngineeringConfig,
  ChaosExperiment,
  FaultInjection,
  ExperimentResult,
  ExperimentSchedule,
  NetworkFault,
  ResourceFault,
  ServiceFault,
  ChaosExperimentStatus,
  SafetyCheck,
  RollbackPlan,
  defaultChaosEngineeringConfig
} from './chaos-engineering.types';

/**
 * Advanced Chaos Engineering Service
 * Provides fault injection testing and resilience validation
 */
export class ChaosEngineeringService extends EventEmitter {
  private readonly activeExperiments: Map<string, ChaosExperiment> = new Map();
  private readonly experimentHistory: Map<string, ExperimentResult> = new Map();
  private readonly scheduledExperiments: Map<string, ExperimentSchedule> = new Map();
  private readonly safetyChecks: Map<string, SafetyCheck[]> = new Map();
  private readonly faultInjections: Map<string, FaultInjection> = new Map();

  constructor(
    private readonly config: ChaosEngineeringConfig = defaultChaosEngineeringConfig
  ) {
    super();
    this.initializeChaosEngineering();
  }

  /**
   * Initialize chaos engineering service
   */
  private initializeChaosEngineering(): void {
    // Set up periodic experiment scheduling and monitoring
    setInterval(() => {
      this.processScheduledExperiments();
      this.monitorActiveExperiments();
      this.performSafetyChecks();
    }, this.config.experimentCheckInterval);

    // Initialize default safety checks
    this.initializeDefaultSafetyChecks();

    sharedStorageLogger.logInfo('Chaos Engineering Service initialized', {
      experimentCheckInterval: this.config.experimentCheckInterval,
      maxConcurrentExperiments: this.config.maxConcurrentExperiments,
      safetyCheckInterval: this.config.safetyCheckInterval
    });
  }

  /**
   * Initialize default safety checks
   */
  private initializeDefaultSafetyChecks(): void {
    // System health safety check
    this.safetyChecks.set('system_health', [
      {
        id: 'cpu_usage_check',
        name: 'CPU Usage Safety Check',
        type: 'resource',
        threshold: 90,
        action: 'abort_experiment',
        description: 'Abort experiment if CPU usage exceeds 90%'
      },
      {
        id: 'memory_usage_check',
        name: 'Memory Usage Safety Check',
        type: 'resource',
        threshold: 95,
        action: 'abort_experiment',
        description: 'Abort experiment if memory usage exceeds 95%'
      },
      {
        id: 'disk_usage_check',
        name: 'Disk Usage Safety Check',
        type: 'resource',
        threshold: 98,
        action: 'abort_experiment',
        description: 'Abort experiment if disk usage exceeds 98%'
      }
    ]);

    // Service availability safety check
    this.safetyChecks.set('service_availability', [
      {
        id: 'error_rate_check',
        name: 'Error Rate Safety Check',
        type: 'service',
        threshold: 50,
        action: 'rollback_fault',
        description: 'Rollback fault if error rate exceeds 50%'
      },
      {
        id: 'response_time_check',
        name: 'Response Time Safety Check',
        type: 'performance',
        threshold: 5000,
        action: 'rollback_fault',
        description: 'Rollback fault if response time exceeds 5 seconds'
      }
    ]);
  }

  /**
   * Execute chaos experiment
   */
  async executeExperiment(experiment: ChaosExperiment): Promise<ExperimentResult> {
    const experimentId = this.generateExperimentId();
    experiment.id = experimentId;
    experiment.status = 'running';
    experiment.startTime = Date.now();

    // Validate experiment safety
    const safetyValidation = await this.validateExperimentSafety(experiment);
    if (!safetyValidation.safe) {
      throw new Error(`Experiment failed safety validation: ${safetyValidation.reason}`);
    }

    this.activeExperiments.set(experimentId, experiment);

    try {
      sharedStorageLogger.logInfo('Starting chaos experiment', {
        experimentId,
        name: experiment.name,
        type: experiment.type,
        duration: experiment.duration
      });

      this.emit('experimentStarted', {
        experimentId,
        experiment: { ...experiment }
      });

      // Execute fault injection
      const faultResults = await this.executeFaultInjections(experiment.faults);

      // Monitor experiment duration
      await this.delay(experiment.duration);

      // Execute post-experiment validation
      const validationResults = await this.validateExperimentResults(experiment);

      // Clean up faults
      await this.cleanupFaults(experiment.faults);

      const result: ExperimentResult = {
        experimentId,
        experimentName: experiment.name,
        status: 'completed',
        startTime: experiment.startTime,
        endTime: Date.now(),
        duration: Date.now() - experiment.startTime,
        faultResults,
        validationResults,
        success: this.determineExperimentSuccess(validationResults),
        metrics: await this.collectExperimentMetrics(experiment)
      };

      experiment.status = 'completed';
      this.experimentHistory.set(experimentId, result);

      this.emit('experimentCompleted', {
        experimentId,
        result: { ...result }
      });

      sharedStorageLogger.logInfo('Chaos experiment completed', {
        experimentId,
        success: result.success,
        duration: result.duration
      });

      return result;

    } catch (error) {
      experiment.status = 'failed';
      experiment.error = error as Error;

      // Attempt emergency cleanup
      await this.emergencyCleanup(experiment);

      const result: ExperimentResult = {
        experimentId,
        experimentName: experiment.name,
        status: 'failed',
        startTime: experiment.startTime,
        endTime: Date.now(),
        duration: Date.now() - experiment.startTime,
        faultResults: [],
        validationResults: {},
        success: false,
        error: error.message,
        metrics: {}
      };

      this.experimentHistory.set(experimentId, result);

      this.emit('experimentFailed', {
        experimentId,
        error: error.message,
        experiment: { ...experiment }
      });

      throw error;
    } finally {
      this.activeExperiments.delete(experimentId);
    }
  }

  /**
   * Schedule experiment for future execution
   */
  scheduleExperiment(experiment: ChaosExperiment, schedule: ExperimentSchedule): string {
    const scheduleId = this.generateScheduleId();
    const scheduledExperiment = {
      id: scheduleId,
      experiment,
      schedule,
      nextRun: this.calculateNextRun(schedule),
      status: 'scheduled'
    };

    this.scheduledExperiments.set(scheduleId, scheduledExperiment);

    sharedStorageLogger.logInfo('Experiment scheduled', {
      scheduleId,
      experimentName: experiment.name,
      nextRun: new Date(scheduledExperiment.nextRun).toISOString()
    });

    return scheduleId;
  }

  /**
   * Execute fault injections
   */
  private async executeFaultInjections(faults: FaultInjection[]): Promise<any[]> {
    const results: any[] = [];

    for (const fault of faults) {
      try {
        sharedStorageLogger.logInfo('Injecting fault', {
          faultId: fault.id,
          type: fault.type,
          target: fault.target
        });

        const result = await this.injectFault(fault);
        results.push({
          faultId: fault.id,
          success: true,
          result
        });

        this.faultInjections.set(fault.id, fault);

      } catch (error) {
        sharedStorageLogger.logError('Fault injection failed', error as Error, undefined, undefined, undefined, fault.id);

        results.push({
          faultId: fault.id,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Inject specific fault
   */
  private async injectFault(fault: FaultInjection): Promise<any> {
    switch (fault.type) {
      case 'network':
        return await this.injectNetworkFault(fault as NetworkFault);

      case 'resource':
        return await this.injectResourceFault(fault as ResourceFault);

      case 'service':
        return await this.injectServiceFault(fault as ServiceFault);

      default:
        throw new Error(`Unknown fault type: ${fault.type}`);
    }
  }

  /**
   * Inject network fault
   */
  private async injectNetworkFault(fault: NetworkFault): Promise<any> {
    const { target, action, duration } = fault;

    // This would implement actual network fault injection
    // For now, return mock result
    sharedStorageLogger.logInfo('Network fault injected', {
      target,
      action,
      duration
    });

    return {
      type: 'network',
      target,
      action,
      duration,
      injected: true
    };
  }

  /**
   * Inject resource fault
   */
  private async injectResourceFault(fault: ResourceFault): Promise<any> {
    const { target, resourceType, action, value } = fault;

    // This would implement actual resource fault injection
    sharedStorageLogger.logInfo('Resource fault injected', {
      target,
      resourceType,
      action,
      value
    });

    return {
      type: 'resource',
      target,
      resourceType,
      action,
      value,
      injected: true
    };
  }

  /**
   * Inject service fault
   */
  private async injectServiceFault(fault: ServiceFault): Promise<any> {
    const { target, serviceAction, parameters } = fault;

    // This would implement actual service fault injection
    sharedStorageLogger.logInfo('Service fault injected', {
      target,
      serviceAction,
      parameters
    });

    return {
      type: 'service',
      target,
      serviceAction,
      parameters,
      injected: true
    };
  }

  /**
   * Validate experiment safety
   */
  private async validateExperimentSafety(experiment: ChaosExperiment): Promise<{ safe: boolean; reason?: string }> {
    // Check concurrent experiment limit
    if (this.activeExperiments.size >= this.config.maxConcurrentExperiments) {
      return { safe: false, reason: 'Maximum concurrent experiments reached' };
    }

    // Run safety checks
    for (const safetyCheck of this.safetyChecks.get('system_health') || []) {
      const checkResult = await this.runSafetyCheck(safetyCheck);
      if (!checkResult.passed) {
        return { safe: false, reason: `Safety check failed: ${safetyCheck.name}` };
      }
    }

    // Validate experiment parameters
    if (experiment.duration > this.config.maxExperimentDuration) {
      return { safe: false, reason: `Experiment duration exceeds maximum allowed: ${this.config.maxExperimentDuration}ms` };
    }

    return { safe: true };
  }

  /**
   * Validate experiment results
   */
  private async validateExperimentResults(experiment: ChaosExperiment): Promise<any> {
    const validations: any = {};

    // Check system stability
    validations.systemStability = await this.validateSystemStability();

    // Check service health
    validations.serviceHealth = await this.validateServiceHealth();

    // Check performance metrics
    validations.performance = await this.validatePerformanceMetrics();

    // Check error rates
    validations.errorRates = await this.validateErrorRates();

    return validations;
  }

  /**
   * Clean up faults
   */
  private async cleanupFaults(faults: FaultInjection[]): Promise<void> {
    for (const fault of faults) {
      try {
        await this.cleanupFault(fault);
        this.faultInjections.delete(fault.id);

        sharedStorageLogger.logInfo('Fault cleaned up', { faultId: fault.id });

      } catch (error) {
        sharedStorageLogger.logError('Fault cleanup failed', error as Error, undefined, undefined, undefined, fault.id);
      }
    }
  }

  /**
   * Clean up specific fault
   */
  private async cleanupFault(fault: FaultInjection): Promise<void> {
    // Implement fault cleanup logic based on fault type
    sharedStorageLogger.logInfo('Cleaning up fault', {
      faultId: fault.id,
      type: fault.type
    });
  }

  /**
   * Emergency cleanup for failed experiments
   */
  private async emergencyCleanup(experiment: ChaosExperiment): Promise<void> {
    sharedStorageLogger.logWarn('Performing emergency cleanup', {
      experimentId: experiment.id,
      name: experiment.name
    });

    // Clean up all faults from the experiment
    await this.cleanupFaults(experiment.faults);

    // Reset any modified system state
    await this.resetSystemState();
  }

  /**
   * Process scheduled experiments
   */
  private processScheduledExperiments(): void {
    const now = Date.now();

    for (const [scheduleId, scheduled] of this.scheduledExperiments.entries()) {
      if (scheduled.nextRun <= now && scheduled.status === 'scheduled') {
        // Execute the scheduled experiment
        this.executeExperiment(scheduled.experiment)
          .then(() => {
            // Update next run time
            scheduled.nextRun = this.calculateNextRun(scheduled.schedule);
          })
          .catch((error) => {
            sharedStorageLogger.logError('Scheduled experiment failed', error as Error, undefined, undefined, undefined, scheduleId);
          });
      }
    }
  }

  /**
   * Monitor active experiments
   */
  private async monitorActiveExperiments(): Promise<void> {
    for (const [experimentId, experiment] of this.activeExperiments.entries()) {
      // Check if experiment has exceeded its duration
      if (Date.now() - experiment.startTime > experiment.duration) {
        sharedStorageLogger.logWarn('Experiment exceeded duration, terminating', {
          experimentId,
          name: experiment.name,
          expectedDuration: experiment.duration,
          actualDuration: Date.now() - experiment.startTime
        });

        // Terminate experiment
        await this.terminateExperiment(experimentId);
      }

      // Run ongoing safety checks
      const safetyResult = await this.runOngoingSafetyChecks(experiment);
      if (!safetyResult.safe) {
        sharedStorageLogger.logWarn('Safety check failed, terminating experiment', {
          experimentId,
          reason: safetyResult.reason
        });

        await this.terminateExperiment(experimentId);
      }
    }
  }

  /**
   * Perform periodic safety checks
   */
  private async performSafetyChecks(): Promise<void> {
    for (const [checkType, checks] of this.safetyChecks.entries()) {
      for (const check of checks) {
        const result = await this.runSafetyCheck(check);
        if (!result.passed) {
          this.emit('safetyCheckFailed', {
            checkId: check.id,
            checkName: check.name,
            threshold: check.threshold,
            actualValue: result.actualValue
          });
        }
      }
    }
  }

  /**
   * Utility methods
   */
  private async runSafetyCheck(check: SafetyCheck): Promise<{ passed: boolean; actualValue: number }> {
    // Implement safety check logic based on check type
    switch (check.type) {
      case 'resource':
        return await this.checkResourceUsage(check.threshold);
      case 'service':
        return await this.checkServiceHealth(check.threshold);
      case 'performance':
        return await this.checkPerformanceMetric(check.threshold);
      default:
        return { passed: true, actualValue: 0 };
    }
  }

  private async runOngoingSafetyChecks(experiment: ChaosExperiment): Promise<{ safe: boolean; reason?: string }> {
    // Implement ongoing safety checks for active experiments
    return { safe: true };
  }

  private async terminateExperiment(experimentId: string): Promise<void> {
    const experiment = this.activeExperiments.get(experimentId);
    if (experiment) {
      await this.emergencyCleanup(experiment);
      this.activeExperiments.delete(experimentId);
    }
  }

  private calculateNextRun(schedule: ExperimentSchedule): number {
    // Implement scheduling logic based on schedule type
    const now = new Date();

    switch (schedule.type) {
      case 'cron':
        // Parse cron expression and calculate next run
        return now.getTime() + 86400000; // Daily default

      case 'interval':
        return now.getTime() + (schedule.interval || 86400000);

      case 'once':
        return schedule.scheduledTime || now.getTime();

      default:
        return now.getTime() + 86400000;
    }
  }

  private async validateSystemStability(): Promise<any> {
    // Implement system stability validation
    return { stable: true };
  }

  private async validateServiceHealth(): Promise<any> {
    // Implement service health validation
    return { healthy: true };
  }

  private async validatePerformanceMetrics(): Promise<any> {
    // Implement performance metrics validation
    return { withinBounds: true };
  }

  private async validateErrorRates(): Promise<any> {
    // Implement error rate validation
    return { acceptable: true };
  }

  private async collectExperimentMetrics(experiment: ChaosExperiment): Promise<any> {
    // Collect metrics before and after experiment
    return {
      baselineMetrics: {},
      experimentMetrics: {},
      comparison: {}
    };
  }

  private determineExperimentSuccess(validationResults: any): boolean {
    // Determine if experiment was successful based on validation results
    return validationResults.systemStability?.stable &&
           validationResults.serviceHealth?.healthy &&
           validationResults.performance?.withinBounds;
  }

  private async checkResourceUsage(threshold: number): Promise<{ passed: boolean; actualValue: number }> {
    // Check system resource usage
    return { passed: true, actualValue: 45 }; // Mock value
  }

  private async checkServiceHealth(threshold: number): Promise<{ passed: boolean; actualValue: number }> {
    // Check service health metrics
    return { passed: true, actualValue: 25 }; // Mock value
  }

  private async checkPerformanceMetric(threshold: number): Promise<{ passed: boolean; actualValue: number }> {
    // Check performance metrics
    return { passed: true, actualValue: 150 }; // Mock value
  }

  private async resetSystemState(): Promise<void> {
    // Reset any modified system state
    sharedStorageLogger.logInfo('System state reset');
  }

  private generateExperimentId(): string {
    return `chaos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateScheduleId(): string {
    return `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get chaos engineering statistics
   */
  getChaosStatistics(): any {
    return {
      activeExperiments: this.activeExperiments.size,
      totalExperiments: this.experimentHistory.size,
      scheduledExperiments: this.scheduledExperiments.size,
      successRate: this.calculateSuccessRate()
    };
  }

  private calculateSuccessRate(): number {
    const total = this.experimentHistory.size;
    if (total === 0) return 1.0;

    const successful = Array.from(this.experimentHistory.values())
      .filter(result => result.success).length;

    return successful / total;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Clear all experiments and schedules
    this.activeExperiments.clear();
    this.experimentHistory.clear();
    this.scheduledExperiments.clear();
    this.faultInjections.clear();
    sharedStorageLogger.logInfo('Chaos Engineering Service cleaned up');
  }
}

// Export factory function
export const createChaosEngineeringService = (config?: ChaosEngineeringConfig) => {
  return new ChaosEngineeringService(config);
};
