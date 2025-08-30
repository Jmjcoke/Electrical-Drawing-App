/**
 * Types for Recovery Orchestrator Service
 */

export interface RecoveryOrchestratorConfig {
  healthCheckInterval: number;
  maxConcurrentRecoveries: number;
  recoveryTimeout: number;
  recoveryCleanupDelay: number;
}

export interface RecoveryPlan {
  id: string;
  name: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  steps: RecoveryStep[];
  estimatedDuration: number;
  successCriteria: Record<string, any>;
}

export interface RecoveryStep {
  id: string;
  name: string;
  type: 'health_check' | 'circuit_breaker_reset' | 'service_restart' | 'connectivity_check' | 'cache_clear' | 'cache_rebuild' | 'validation';
  timeout: number;
  retryCount: number;
  parameters: Record<string, any>;
}

export interface RecoveryExecution {
  id: string;
  planId: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'failed';
  currentStep: number;
  steps: RecoveryStepExecution[];
  context: any;
  result?: RecoveryResult;
  error?: Error;
}

export interface RecoveryStepExecution {
  stepId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  attempts: number;
  startTime?: number;
  endTime?: number;
  result?: any;
  error?: Error;
}

export interface RecoveryResult {
  executionId: string;
  planId: string;
  success: boolean;
  results: any[];
  duration: number;
}

export interface RecoveryStrategy {
  id: string;
  name: string;
  conditions: RecoveryCondition[];
  actions: RecoveryAction[];
}

export interface RecoveryCondition {
  type: 'error_rate' | 'health_check' | 'circuit_breaker' | 'resource_usage';
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  duration?: number;
}

export interface RecoveryAction {
  type: 'restart_service' | 'reset_circuit_breaker' | 'clear_cache' | 'scale_up' | 'alert';
  parameters: Record<string, any>;
  priority: number;
}

export interface ServiceRecoveryState {
  serviceName: string;
  healthy: boolean;
  lastHealthCheck: number;
  recoveryAttempts: number;
  lastRecoveryAttempt?: number;
  consecutiveFailures: number;
}

export interface RecoveryTrigger {
  id: string;
  name: string;
  condition: (event: any) => boolean;
  recoveryPlanId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  cooldownPeriod: number;
  lastTriggered?: number;
}

export const defaultRecoveryOrchestratorConfig: RecoveryOrchestratorConfig = {
  healthCheckInterval: 30000, // 30 seconds
  maxConcurrentRecoveries: 5,
  recoveryTimeout: 300000, // 5 minutes
  recoveryCleanupDelay: 60000 // 1 minute
};
