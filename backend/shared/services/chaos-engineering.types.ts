/**
 * Types for Chaos Engineering Service
 */

export interface ChaosEngineeringConfig {
  experimentCheckInterval: number;
  maxConcurrentExperiments: number;
  maxExperimentDuration: number;
  safetyCheckInterval: number;
  emergencyCleanupTimeout: number;
}

export interface ChaosExperiment {
  id?: string;
  name: string;
  description: string;
  type: 'network' | 'resource' | 'service' | 'infrastructure';
  duration: number;
  faults: FaultInjection[];
  safetyChecks: SafetyCheck[];
  rollbackPlan?: RollbackPlan;
  tags?: string[];
  status?: ChaosExperimentStatus;
  startTime?: number;
  endTime?: number;
  error?: Error;
}

export interface FaultInjection {
  id: string;
  name: string;
  type: 'network' | 'resource' | 'service';
  target: string;
  parameters: Record<string, any>;
}

export interface NetworkFault extends FaultInjection {
  type: 'network';
  action: 'delay' | 'drop' | 'corrupt' | 'duplicate';
  parameters: {
    delay?: number;
    dropRate?: number;
    corruptRate?: number;
    duplicateRate?: number;
    duration: number;
  };
}

export interface ResourceFault extends FaultInjection {
  type: 'resource';
  resourceType: 'cpu' | 'memory' | 'disk' | 'network';
  action: 'exhaust' | 'limit' | 'corrupt';
  parameters: {
    limit?: number;
    duration: number;
    intensity?: number;
  };
}

export interface ServiceFault extends FaultInjection {
  type: 'service';
  serviceAction: 'kill' | 'restart' | 'isolate' | 'overload';
  parameters: {
    serviceName: string;
    restartDelay?: number;
    isolationDuration?: number;
    overloadIntensity?: number;
    duration: number;
  };
}

export interface ExperimentResult {
  experimentId: string;
  experimentName: string;
  status: 'completed' | 'failed';
  startTime: number;
  endTime: number;
  duration: number;
  faultResults: any[];
  validationResults: Record<string, any>;
  success: boolean;
  error?: string;
  metrics: Record<string, any>;
}

export interface ExperimentSchedule {
  type: 'cron' | 'interval' | 'once';
  cronExpression?: string;
  interval?: number;
  scheduledTime?: number;
  enabled: boolean;
}

export interface SafetyCheck {
  id: string;
  name: string;
  type: 'resource' | 'service' | 'performance';
  threshold: number;
  action: 'abort_experiment' | 'rollback_fault' | 'alert' | 'log';
  description: string;
}

export interface RollbackPlan {
  steps: RollbackStep[];
  timeout: number;
  validationChecks: string[];
}

export interface RollbackStep {
  id: string;
  name: string;
  type: 'service_restart' | 'fault_cleanup' | 'config_restore' | 'resource_reset';
  parameters: Record<string, any>;
  timeout: number;
}

export type ChaosExperimentStatus = 'scheduled' | 'running' | 'completed' | 'failed' | 'aborted';

export const defaultChaosEngineeringConfig: ChaosEngineeringConfig = {
  experimentCheckInterval: 10000, // 10 seconds
  maxConcurrentExperiments: 3,
  maxExperimentDuration: 300000, // 5 minutes
  safetyCheckInterval: 5000, // 5 seconds
  emergencyCleanupTimeout: 60000 // 1 minute
};
