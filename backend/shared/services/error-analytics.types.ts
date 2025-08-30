/**
 * Types for Error Analytics Service
 */

export interface ErrorAnalyticsConfig {
  analysisInterval: number;
  predictionWindow: number;
  impactAssessmentWindow: number;
  incidentIntelligenceWindow: number;
  earlyWarningWindow: number;
  failurePredictionThreshold: number;
  errorRateThreshold: number;
  minErrorsForIncident: number;
  learningRate: number;
}

export interface ErrorContext {
  id: string;
  timestamp: number;
  errorType: string;
  message: string;
  stack?: string;
  service: string;
  operation?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
  correlationId?: string;
}

export interface ErrorPattern {
  id: string;
  name: string;
  description: string;
  errorTypes: string[];
  frequency: 'low' | 'medium' | 'high';
  severity: 'low' | 'medium' | 'high' | 'critical';
  indicators: string[];
  mitigationStrategies: string[];
  occurrences: number;
  lastSeen: number;
  averageFrequency: number;
}

export interface ErrorTrend {
  timeWindow: {
    start: number;
    end: number;
  };
  errorCounts: Map<string, number>;
  trend: 'increasing' | 'decreasing' | 'stable';
  anomalyScore: number;
  predictedIncrease: number;
}

export interface PredictiveFailureData {
  patternId: string;
  failureProbability: number;
  timeToFailure: number | null;
  confidence: number;
  indicators: string[];
  recommendedActions: string[];
}

export interface ImpactAssessment {
  timestamp: number;
  affectedServices: string[];
  errorVolume: number;
  severityDistribution: Record<string, number>;
  businessImpact: 'low' | 'medium' | 'high';
  recommendedActions: string[];
}

export interface IncidentIntelligence {
  id: string;
  timestamp: number;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedComponents: string[];
  rootCause: string;
  impact: string;
  resolutionSteps: string[];
  preventionMeasures: string[];
}

export interface ErrorCorrelation {
  id: string;
  primaryError: ErrorContext;
  relatedErrors: ErrorContext[];
  correlationStrength: number;
  commonFactors: string[];
  recommendedActions: string[];
}

export interface LearningModel {
  patternId: string;
  features: string[];
  weights: Map<string, number>;
  accuracy: number;
  lastUpdated: number;
}

export interface ErrorAnalyticsResult {
  timestamp: number;
  totalErrors: number;
  errorPatterns: ErrorPattern[];
  activeTrends: ErrorTrend[];
  predictiveInsights: PredictiveFailureData[];
  recentIncidents: IncidentIntelligence[];
  systemHealth: 'healthy' | 'warning' | 'critical';
}

export const defaultErrorAnalyticsConfig: ErrorAnalyticsConfig = {
  analysisInterval: 300000, // 5 minutes
  predictionWindow: 3600000, // 1 hour
  impactAssessmentWindow: 900000, // 15 minutes
  incidentIntelligenceWindow: 1800000, // 30 minutes
  earlyWarningWindow: 600000, // 10 minutes
  failurePredictionThreshold: 0.7,
  errorRateThreshold: 5, // 5 errors per second
  minErrorsForIncident: 10,
  learningRate: 0.1
};
