/**
 * Uncertainty Quantification System
 * 
 * Implements comprehensive uncertainty measures, disagreement analysis,
 * and confidence interval calculations for ensemble responses.
 */

import { LLMResponse } from '../../../llm-orchestrator/src/providers/base/LLMProvider.interface';
import { AgreementMeasures, DisagreementAnalysis } from '../consensus/agreement.analyzer';

export interface UncertaintyQuantificationResult {
  readonly uncertaintyMeasures: UncertaintyMeasures;
  readonly disagreementClassification: DisagreementClassification;
  readonly confidenceIntervals: ConfidenceInterval[];
  readonly qualityWarnings: QualityWarning[];
  readonly uncertaintyPropagation: UncertaintyPropagation;
}

export interface UncertaintyMeasures {
  readonly variance: number;
  readonly standardDeviation: number;
  readonly coefficientOfVariation: number;
  readonly entropy: number;
  readonly interquartileRange: number;
  readonly confidenceRange: [number, number];
}

export interface DisagreementClassification {
  readonly level: DisagreementLevel;
  readonly categories: DisagreementCategory[];
  readonly severity: DisagreementSeverity;
  readonly sources: DisagreementSource[];
}

export enum DisagreementLevel {
  MINIMAL = 'minimal',
  LOW = 'low', 
  MODERATE = 'moderate',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface DisagreementCategory {
  readonly type: DisagreementType;
  readonly score: number;
  readonly examples: string[];
  readonly impact: number;
}

export enum DisagreementType {
  SEMANTIC = 'semantic',
  FACTUAL = 'factual',
  NUMERICAL = 'numerical',
  STRUCTURAL = 'structural',
  CONFIDENCE = 'confidence'
}

export enum DisagreementSeverity {
  NEGLIGIBLE = 'negligible',
  MINOR = 'minor',
  MODERATE = 'moderate', 
  MAJOR = 'major',
  CRITICAL = 'critical'
}

export interface DisagreementSource {
  readonly provider: string;
  readonly contribution: number;
  readonly areas: string[];
}

export interface ConfidenceInterval {
  readonly metric: string;
  readonly lower: number;
  readonly upper: number;
  readonly confidence: number;
  readonly method: string;
}

export interface QualityWarning {
  readonly type: WarningType;
  readonly severity: WarningSeverity;
  readonly message: string;
  readonly recommendation: string;
  readonly confidence: number;
}

export enum WarningType {
  HIGH_UNCERTAINTY = 'high_uncertainty',
  LOW_AGREEMENT = 'low_agreement',
  OUTLIER_DETECTED = 'outlier_detected',
  INCONSISTENT_QUALITY = 'inconsistent_quality',
  INSUFFICIENT_DATA = 'insufficient_data'
}

export enum WarningSeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface UncertaintyPropagation {
  readonly propagatedUncertainty: number;
  readonly propagationPath: PropagationStep[];
  readonly finalConfidence: number;
  readonly uncertaintyComponents: UncertaintyComponent[];
}

export interface PropagationStep {
  readonly source: string;
  readonly target: string;
  readonly effect: number;
  readonly method: string;
}

export interface UncertaintyComponent {
  readonly component: string;
  readonly uncertainty: number;
  readonly contribution: number;
  readonly source: string;
}

/**
 * Uncertainty Quantification Service Implementation
 */
export class UncertaintyQuantificationService {
  
  /**
   * Quantifies uncertainty across ensemble responses
   */
  public quantifyUncertainty(
    responses: LLMResponse[],
    agreement: AgreementMeasures,
    disagreement: DisagreementAnalysis
  ): UncertaintyQuantificationResult {
    console.log(`📊 Quantifying uncertainty for ${responses.length} responses`);

    // Calculate core uncertainty measures
    const uncertaintyMeasures = this.calculateUncertaintyMeasures(responses);

    // Classify disagreements
    const disagreementClassification = this.classifyDisagreements(disagreement, responses);

    // Calculate confidence intervals
    const confidenceIntervals = this.calculateConfidenceIntervals(responses);

    // Generate quality warnings
    const qualityWarnings = this.generateQualityWarnings(
      uncertaintyMeasures,
      disagreementClassification,
      responses
    );

    // Propagate uncertainty through the system
    const uncertaintyPropagation = this.propagateUncertainty(
      uncertaintyMeasures,
      disagreementClassification,
      responses
    );

    return {
      uncertaintyMeasures,
      disagreementClassification,
      confidenceIntervals,
      qualityWarnings,
      uncertaintyPropagation
    };
  }

  /**
   * Calculates core uncertainty measures
   */
  private calculateUncertaintyMeasures(responses: LLMResponse[]): UncertaintyMeasures {
    if (responses.length === 0) {
      return {
        variance: 0,
        standardDeviation: 0,
        coefficientOfVariation: 0,
        entropy: 0,
        interquartileRange: 0,
        confidenceRange: [0, 0]
      };
    }

    const confidences = responses.map(r => r.confidence);
    
    // Variance and standard deviation
    const mean = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const variance = confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / confidences.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Coefficient of variation
    const coefficientOfVariation = mean > 0 ? standardDeviation / mean : 0;
    
    // Information entropy
    const entropy = this.calculateInformationEntropy(confidences);
    
    // Interquartile range  
    const sortedConfidences = [...confidences].sort((a, b) => a - b);
    const q1 = this.calculatePercentile(sortedConfidences, 25);
    const q3 = this.calculatePercentile(sortedConfidences, 75);
    const interquartileRange = q3 - q1;
    
    // Confidence range
    const confidenceRange: [number, number] = [Math.min(...confidences), Math.max(...confidences)];

    return {
      variance,
      standardDeviation,
      coefficientOfVariation,
      entropy,
      interquartileRange,
      confidenceRange
    };
  }

  /**
   * Calculates information entropy
   */
  private calculateInformationEntropy(values: number[]): number {
    if (values.length === 0) return 0;

    // Create bins for entropy calculation
    const bins = 10;
    const binCounts = new Array(bins).fill(0);
    
    for (const value of values) {
      const binIndex = Math.min(bins - 1, Math.floor(value * bins));
      binCounts[binIndex]++;
    }

    // Calculate entropy
    let entropy = 0;
    const total = values.length;
    
    for (const count of binCounts) {
      if (count > 0) {
        const probability = count / total;
        entropy -= probability * Math.log2(probability);
      }
    }

    return entropy / Math.log2(bins); // Normalize to 0-1
  }

  /**
   * Calculates percentile from sorted array
   */
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (upper >= sortedValues.length) return sortedValues[sortedValues.length - 1];
    if (lower < 0) return sortedValues[0];
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Classifies disagreements by type and severity
   */
  private classifyDisagreements(
    disagreement: DisagreementAnalysis,
    responses: LLMResponse[]
  ): DisagreementClassification {
    const categories: DisagreementCategory[] = [];
    const sources: DisagreementSource[] = [];

    // Semantic disagreements
    const semanticScore = 1 - disagreement.consensus.semantic;
    if (semanticScore > 0.1) {
      categories.push({
        type: DisagreementType.SEMANTIC,
        score: semanticScore,
        examples: ['Content similarity variance', 'Different interpretations'],
        impact: semanticScore * 0.3
      });
    }

    // Confidence disagreements
    const confidences = responses.map(r => r.confidence);
    const confidenceVariance = this.calculateVariance(confidences);
    if (confidenceVariance > 0.1) {
      categories.push({
        type: DisagreementType.CONFIDENCE,
        score: confidenceVariance,
        examples: ['Provider confidence mismatch'],
        impact: confidenceVariance * 0.2
      });
    }

    // Calculate overall disagreement level
    const avgScore = categories.reduce((sum, cat) => sum + cat.score, 0) / Math.max(categories.length, 1);
    const level = this.determineDisagreementLevel(avgScore);
    const severity = this.determineDisagreementSeverity(avgScore, categories.length);

    // Identify disagreement sources
    for (const outlier of disagreement.outliers) {
      sources.push({
        provider: outlier.provider,
        contribution: outlier.deviationScore,
        areas: outlier.reasons
      });
    }

    return { level, categories, severity, sources };
  }

  /**
   * Calculates variance for array of numbers
   */
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  /**
   * Determines disagreement level from score
   */
  private determineDisagreementLevel(score: number): DisagreementLevel {
    if (score < 0.1) return DisagreementLevel.MINIMAL;
    if (score < 0.25) return DisagreementLevel.LOW;
    if (score < 0.5) return DisagreementLevel.MODERATE;
    if (score < 0.75) return DisagreementLevel.HIGH;
    return DisagreementLevel.CRITICAL;
  }

  /**
   * Determines disagreement severity
   */
  private determineDisagreementSeverity(score: number, categoryCount: number): DisagreementSeverity {
    const combinedScore = score * (1 + categoryCount * 0.1);
    
    if (combinedScore < 0.1) return DisagreementSeverity.NEGLIGIBLE;
    if (combinedScore < 0.2) return DisagreementSeverity.MINOR;
    if (combinedScore < 0.4) return DisagreementSeverity.MODERATE;
    if (combinedScore < 0.7) return DisagreementSeverity.MAJOR;
    return DisagreementSeverity.CRITICAL;
  }

  /**
   * Calculates confidence intervals for key metrics
   */
  private calculateConfidenceIntervals(responses: LLMResponse[]): ConfidenceInterval[] {
    const intervals: ConfidenceInterval[] = [];

    if (responses.length < 2) return intervals;

    // Confidence interval for mean confidence
    const confidences = responses.map(r => r.confidence);
    const meanConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const stdError = Math.sqrt(this.calculateVariance(confidences) / confidences.length);
    const margin = 1.96 * stdError; // 95% confidence interval

    intervals.push({
      metric: 'mean_confidence',
      lower: Math.max(0, meanConfidence - margin),
      upper: Math.min(1, meanConfidence + margin),
      confidence: 0.95,
      method: 'normal_distribution'
    });

    // Confidence interval for response time
    const responseTimes = responses.map(r => r.responseTime);
    const meanTime = responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
    const timeStdError = Math.sqrt(this.calculateVariance(responseTimes) / responseTimes.length);
    const timeMargin = 1.96 * timeStdError;

    intervals.push({
      metric: 'mean_response_time',
      lower: Math.max(0, meanTime - timeMargin),
      upper: meanTime + timeMargin,
      confidence: 0.95,
      method: 'normal_distribution'
    });

    return intervals;
  }

  /**
   * Generates quality warnings based on uncertainty analysis
   */
  private generateQualityWarnings(
    uncertainty: UncertaintyMeasures,
    disagreement: DisagreementClassification,
    responses: LLMResponse[]
  ): QualityWarning[] {
    const warnings: QualityWarning[] = [];

    // High uncertainty warning
    if (uncertainty.coefficientOfVariation > 0.5) {
      warnings.push({
        type: WarningType.HIGH_UNCERTAINTY,
        severity: WarningSeverity.HIGH,
        message: `High uncertainty detected (CV: ${uncertainty.coefficientOfVariation.toFixed(3)})`,
        recommendation: 'Consider requesting additional provider responses or manual review',
        confidence: 0.9
      });
    }

    // Low agreement warning
    if (disagreement.level === DisagreementLevel.HIGH || disagreement.level === DisagreementLevel.CRITICAL) {
      warnings.push({
        type: WarningType.LOW_AGREEMENT,
        severity: disagreement.severity === DisagreementSeverity.CRITICAL ? WarningSeverity.CRITICAL : WarningSeverity.HIGH,
        message: `${disagreement.level} disagreement between providers`,
        recommendation: 'Review individual responses for quality issues',
        confidence: 0.8
      });
    }

    // Outlier detection warning
    if (disagreement.sources.length > 0) {
      const majorOutliers = disagreement.sources.filter(s => s.contribution > 0.7);
      if (majorOutliers.length > 0) {
        warnings.push({
          type: WarningType.OUTLIER_DETECTED,
          severity: WarningSeverity.MEDIUM,
          message: `${majorOutliers.length} outlier response(s) detected`,
          recommendation: 'Consider excluding outlier responses from final analysis',
          confidence: 0.75
        });
      }
    }

    // Insufficient data warning
    if (responses.length < 3) {
      warnings.push({
        type: WarningType.INSUFFICIENT_DATA,
        severity: WarningSeverity.MEDIUM,
        message: `Limited data for uncertainty quantification (${responses.length} responses)`,
        recommendation: 'Increase number of provider responses for better uncertainty estimates',
        confidence: 0.9
      });
    }

    return warnings;
  }

  /**
   * Propagates uncertainty through the analysis pipeline
   */
  private propagateUncertainty(
    uncertainty: UncertaintyMeasures,
    disagreement: DisagreementClassification,
    responses: LLMResponse[]
  ): UncertaintyPropagation {
    const propagationPath: PropagationStep[] = [];
    const uncertaintyComponents: UncertaintyComponent[] = [];

    // Individual response uncertainty
    let responseUncertainty = uncertainty.standardDeviation;
    uncertaintyComponents.push({
      component: 'individual_responses',
      uncertainty: responseUncertainty,
      contribution: 0.4,
      source: 'provider_confidence_variance'
    });

    // Agreement uncertainty
    let agreementUncertainty = 1 - disagreement.categories.reduce(
      (min, cat) => Math.min(min, 1 - cat.score), 1
    );
    uncertaintyComponents.push({
      component: 'inter_model_agreement',
      uncertainty: agreementUncertainty,
      contribution: 0.3,
      source: 'semantic_disagreement'
    });

    // Sample size uncertainty
    let sampleUncertainty = responses.length < 3 ? 0.3 : Math.max(0, 0.2 - responses.length * 0.02);
    uncertaintyComponents.push({
      component: 'sample_size',
      uncertainty: sampleUncertainty,
      contribution: 0.2,
      source: 'limited_providers'
    });

    // Quality uncertainty
    let qualityUncertainty = uncertainty.entropy * 0.5;
    uncertaintyComponents.push({
      component: 'response_quality',
      uncertainty: qualityUncertainty,
      contribution: 0.1,
      source: 'information_entropy'
    });

    // Propagation steps
    propagationPath.push({
      source: 'individual_responses',
      target: 'consensus_confidence',
      effect: -responseUncertainty * 0.4,
      method: 'variance_propagation'
    });

    propagationPath.push({
      source: 'inter_model_agreement',
      target: 'consensus_confidence', 
      effect: -agreementUncertainty * 0.3,
      method: 'disagreement_impact'
    });

    // Calculate propagated uncertainty
    const propagatedUncertainty = Math.sqrt(
      uncertaintyComponents.reduce((sum, comp) => 
        sum + Math.pow(comp.uncertainty * comp.contribution, 2), 0
      )
    );

    // Calculate final confidence with uncertainty
    const baseConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;
    const finalConfidence = Math.max(0, baseConfidence - propagatedUncertainty);

    return {
      propagatedUncertainty,
      propagationPath,
      finalConfidence,
      uncertaintyComponents
    };
  }
}