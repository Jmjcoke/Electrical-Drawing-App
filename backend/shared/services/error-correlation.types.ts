/**
 * Types and interfaces for the Error Correlation Service
 */

export interface ErrorCorrelationConfig {
  maxTraces: number;
  traceExpirationTime: number;
  traceCleanupInterval: number;
  correlationWindow: number;
  incidentDetectionThreshold: number;
  maxErrorPatterns: number;
  enableDistributedTracing: boolean;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  operationId: string;
  operationType: string;
  service: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  spans: SpanContext[];
  status: 'active' | 'success' | 'error' | 'timeout';
  error?: Error;
  metadata: Record<string, any>;
}

export interface SpanContext {
  spanId: string;
  traceId: string;
  spanName: string;
  service: string;
  parentSpanId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'active' | 'success' | 'error';
  tags: Record<string, any>;
  events: SpanEvent[];
  error?: SpanError;
}

export interface SpanEvent {
  timestamp: number;
  event: string;
  attributes: Record<string, any>;
}

export interface SpanError {
  message: string;
  name: string;
  stack?: string;
  timestamp: number;
}

export interface ErrorContext {
  service: string;
  operationType: string;
  error: Error;
  timestamp: number;
  traceId?: string;
  spanId?: string;
  metadata?: Record<string, any>;
}

export interface CorrelationRule {
  id: string;
  name: string;
  condition: (errors: ErrorContext[]) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendations: string[];
}

export interface Correlation {
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendations: string[];
  confidence: number;
  timestamp: number;
}

export interface CorrelationResult {
  correlationId: string;
  timestamp: number;
  errorContexts: ErrorContext[];
  correlations: Correlation[];
  relatedServices: string[];
  affectedOperations: string[];
  rootCauseAnalysis: RootCauseAnalysis;
  severity: 'low' | 'medium' | 'high' | 'critical';
  processingTime: number;
}

export interface RootCauseAnalysis {
  rootCauseService: string;
  rootCauseErrorType: string;
  confidence: number;
  affectedServices: string[];
  timeline: TimelineEvent[];
  recommendations: string[];
}

export interface TimelineEvent {
  timestamp: number;
  service: string;
  event: string;
  details: Record<string, any>;
}

export interface ServiceDependency {
  service: string;
  type: 'depends_on' | 'uses' | 'provides';
  criticality: 'low' | 'medium' | 'high' | 'critical';
}

export interface ErrorPattern {
  service: string;
  errorType: string;
  occurrences: number;
  firstSeen: number;
  lastSeen: number;
  avgFrequency: number;
  traces: Array<{ traceId: string; spanId: string; timestamp: number }>;
}

export interface Incident {
  incidentId: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: IncidentStatus;
  createdAt: number;
  updatedAt: number;
  affectedServices: string[];
  affectedOperations: string[];
  correlations: CorrelationResult[];
  rootCause: RootCauseAnalysis;
  timeline: TimelineEvent[];
  assignedTo: string | null;
  tags: string[];
}

export type IncidentStatus = 'active' | 'investigating' | 'resolved' | 'closed';

export interface CorrelationStatistics {
  totalTraces: number;
  activeTraces: number;
  errorTraces: number;
  totalIncidents: number;
  activeIncidents: number;
  traceSuccessRate: number;
  averageTraceDuration: number;
  topErrorPatterns: Array<{ pattern: string; count: number }>;
}

export interface TracingOptions {
  enableDistributedTracing?: boolean;
  sampleRate?: number;
  maxSpansPerTrace?: number;
  enableAutoInstrumentation?: boolean;
  customTags?: Record<string, any>;
}

export interface IncidentResponseWorkflow {
  incidentId: string;
  workflowId: string;
  steps: IncidentResponseStep[];
  currentStep: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
}

export interface IncidentResponseStep {
  stepId: string;
  name: string;
  description: string;
  action: string;
  automated: boolean;
  timeout?: number;
  dependencies?: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  result?: any;
  executedAt?: number;
  error?: string;
}

/**
 * Default configuration for the error correlation service
 */
export const defaultErrorCorrelationConfig: ErrorCorrelationConfig = {
  maxTraces: 10000,
  traceExpirationTime: 3600000, // 1 hour
  traceCleanupInterval: 300000, // 5 minutes
  correlationWindow: 300000, // 5 minutes
  incidentDetectionThreshold: 5,
  maxErrorPatterns: 1000,
  enableDistributedTracing: true
};
