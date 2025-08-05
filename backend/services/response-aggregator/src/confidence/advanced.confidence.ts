/**
 * Advanced Confidence Scoring System
 * 
 * Implements comprehensive multi-factor confidence calculation with configurable weights,
 * confidence propagation, and advanced reliability indicators for ensemble responses.
 */

import { LLMResponse } from '../../../llm-orchestrator/src/providers/base/LLMProvider.interface';
import { ConsensusResult } from '../aggregation/consensus.service';
import { RankedResponse } from '../aggregation/ranking.service';
import { AgreementMeasures, DisagreementAnalysis } from '../consensus/agreement.analyzer';

export interface AdvancedConfidenceConfig {
  readonly factors: ConfidenceFactorWeights;
  readonly thresholds: ConfidenceThresholds;
  readonly normalization: NormalizationMethod;
  readonly degradationHandling: DegradationConfig;
  readonly propagation: PropagationConfig;
}

export interface ConfidenceFactorWeights {
  readonly agreement: number;
  readonly quality: number;
  readonly consistency: number;
  readonly coverage: number;
  readonly completeness: number;
  readonly uncertainty: number;
}

export interface ConfidenceThresholds {
  readonly high: number;
  readonly medium: number;
  readonly low: number;
  readonly critical: number;
}

export enum NormalizationMethod {
  MINMAX = 'minmax',
  ZSCORE = 'zscore',
  SIGMOID = 'sigmoid',
  PERCENTILE = 'percentile'
}

export interface DegradationConfig {
  readonly enableDegradation: boolean;
  readonly partialResponsePenalty: number;
  readonly missingDataPenalty: number;
  readonly timeoutPenalty: number;
}

export interface PropagationConfig {
  readonly enablePropagation: boolean;
  readonly confidenceDecay: number;
  readonly uncertaintyAmplification: number;
  readonly crossFactorInfluence: boolean;
}

export interface AdvancedConfidenceResult {
  readonly overallConfidence: number;
  readonly confidenceLevel: ConfidenceLevel;
  readonly factors: DetailedConfidenceFactors;
  readonly breakdown: ConfidenceBreakdown;
  readonly reliability: ReliabilityMetrics;
  readonly recommendations: ConfidenceRecommendation[];
  readonly metadata: ConfidenceMetadata;
}

export interface DetailedConfidenceFactors {
  readonly agreement: ConfidenceFactor;
  readonly quality: ConfidenceFactor;
  readonly consistency: ConfidenceFactor;
  readonly coverage: ConfidenceFactor;
  readonly completeness: ConfidenceFactor;
  readonly uncertainty: ConfidenceFactor;
}

export interface ConfidenceFactor {
  readonly rawScore: number;
  readonly normalizedScore: number;
  readonly weight: number;
  readonly contribution: number;
  readonly confidence: number;
  readonly evidence: FactorEvidence[];
}

export interface FactorEvidence {
  readonly type: EvidenceType;
  readonly value: number;
  readonly description: string;
  readonly impact: number;
}

export enum EvidenceType {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral'
}

export interface ConfidenceBreakdown {
  readonly componentScores: ComponentScore[];
  readonly factorInteractions: FactorInteraction[];
  readonly degradationImpacts: DegradationImpact[];
  readonly propagationEffects: PropagationEffect[];
}

export interface ComponentScore {
  readonly component: string;
  readonly score: number;
  readonly weight: number;
  readonly normalizedContribution: number;
}

export interface FactorInteraction {
  readonly factor1: string;
  readonly factor2: string;
  readonly interactionType: InteractionType;
  readonly effect: number;
  readonly description: string;
}

export enum InteractionType {
  SYNERGY = 'synergy',
  CONFLICT = 'conflict',
  REINFORCEMENT = 'reinforcement',
  DAMPENING = 'dampening'
}

export interface DegradationImpact {
  readonly cause: string;
  readonly severity: DegradationSeverity;
  readonly impact: number;
  readonly mitigation: string;
}

export enum DegradationSeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  CRITICAL = 'critical'
}

export interface PropagationEffect {
  readonly source: string;
  readonly target: string;
  readonly propagationType: PropagationType;
  readonly magnitude: number;
  readonly confidence: number;
}

export enum PropagationType {
  CONFIDENCE_BOOST = 'confidence_boost',
  CONFIDENCE_REDUCTION = 'confidence_reduction',
  UNCERTAINTY_INCREASE = 'uncertainty_increase',
  UNCERTAINTY_DECREASE = 'uncertainty_decrease'
}

export interface ReliabilityMetrics {
  readonly stability: number;
  readonly robustness: number;
  readonly predictability: number;
  readonly trustworthiness: number;
}

export interface ConfidenceRecommendation {
  readonly type: RecommendationType;
  readonly priority: RecommendationPriority;
  readonly description: string;
  readonly action: string;
  readonly expectedImpact: number;
}

export enum RecommendationType {
  IMPROVEMENT = 'improvement',
  WARNING = 'warning',
  OPTIMIZATION = 'optimization',
  VALIDATION = 'validation'
}

export enum RecommendationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ConfidenceMetadata {
  readonly calculationTime: number;
  readonly algorithmsUsed: string[];
  readonly dataQuality: number;
  readonly processingStage: string;
  readonly version: string;
}

export enum ConfidenceLevel {
  VERY_HIGH = 'very_high',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  VERY_LOW = 'very_low',
  CRITICAL = 'critical'
}

/**
 * Advanced Confidence Calculator Implementation
 */
export class AdvancedConfidenceCalculator {
  private config: AdvancedConfidenceConfig;

  constructor(config: AdvancedConfidenceConfig) {
    this.config = config;
  }

  /**
   * Calculates comprehensive confidence from multiple data sources
   */
  public calculateAdvancedConfidence(
    responses: LLMResponse[],
    consensus: ConsensusResult,
    rankedResponses: RankedResponse[],
    agreement: AgreementMeasures,
    disagreement: DisagreementAnalysis
  ): AdvancedConfidenceResult {
    const startTime = Date.now();
    console.log(`🎯 Calculating advanced confidence for ${responses.length} responses`);

    // Calculate individual confidence factors
    const factors = this.calculateDetailedFactors(
      responses,
      consensus,
      rankedResponses,
      agreement,
      disagreement
    );

    // Analyze factor interactions
    const factorInteractions = this.analyzeFactorInteractions(factors);

    // Handle confidence degradation
    const degradationImpacts = this.handleConfidenceDegradation(responses, factors);

    // Apply confidence propagation
    const propagationEffects = this.applyConfidencePropagation(factors);

    // Calculate component scores
    const componentScores = this.calculateComponentScores(factors);

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(
      factors,
      factorInteractions,
      degradationImpacts,
      propagationEffects
    );

    // Determine confidence level
    const confidenceLevel = this.determineConfidenceLevel(overallConfidence);

    // Calculate reliability metrics
    const reliability = this.calculateReliabilityMetrics(factors, agreement, disagreement);

    // Generate recommendations
    const recommendations = this.generateAdvancedRecommendations(
      overallConfidence,
      factors,
      degradationImpacts,
      disagreement
    );

    // Build confidence breakdown
    const breakdown: ConfidenceBreakdown = {
      componentScores,
      factorInteractions,
      degradationImpacts,
      propagationEffects
    };

    // Build metadata
    const metadata: ConfidenceMetadata = {
      calculationTime: Date.now() - startTime,
      algorithmsUsed: ['multi-factor', 'interaction-analysis', 'propagation', 'degradation-handling'],
      dataQuality: this.assessDataQuality(responses),
      processingStage: 'advanced-confidence',
      version: '2.5.0'
    };

    return {
      overallConfidence,
      confidenceLevel,
      factors,
      breakdown,
      reliability,
      recommendations,
      metadata
    };
  }

  /**
   * Calculates detailed confidence factors with evidence
   */
  private calculateDetailedFactors(
    responses: LLMResponse[],
    consensus: ConsensusResult,
    rankedResponses: RankedResponse[],
    agreement: AgreementMeasures,
    disagreement: DisagreementAnalysis
  ): DetailedConfidenceFactors {
    const agreementFactor = this.calculateAgreementFactor(agreement, disagreement);
    const qualityFactor = this.calculateQualityFactor(responses, rankedResponses);
    const consistencyFactor = this.calculateConsistencyFactor(responses, agreement);
    const coverageFactor = this.calculateCoverageFactor(responses, consensus);
    const completenessFactor = this.calculateCompletenessFactor(responses);
    const uncertaintyFactor = this.calculateUncertaintyFactor(agreement, disagreement);

    return {
      agreement: agreementFactor,
      quality: qualityFactor,
      consistency: consistencyFactor,
      coverage: coverageFactor,
      completeness: completenessFactor,
      uncertainty: uncertaintyFactor
    };
  }

  /**
   * Calculates agreement confidence factor
   */
  private calculateAgreementFactor(
    agreement: AgreementMeasures,
    disagreement: DisagreementAnalysis
  ): ConfidenceFactor {
    const evidence: FactorEvidence[] = [];

    // Semantic similarity evidence
    if (agreement.semanticSimilarity > 0.8) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: agreement.semanticSimilarity,
        description: `High semantic similarity (${(agreement.semanticSimilarity * 100).toFixed(1)}%)`,
        impact: 0.3
      });
    } else if (agreement.semanticSimilarity < 0.4) {
      evidence.push({
        type: EvidenceType.NEGATIVE,
        value: agreement.semanticSimilarity,
        description: `Low semantic similarity (${(agreement.semanticSimilarity * 100).toFixed(1)}%)`,
        impact: -0.25
      });
    }

    // Correlation evidence
    const avgCorrelation = (
      agreement.correlationCoefficient.pearson +
      agreement.correlationCoefficient.spearman +
      agreement.correlationCoefficient.kendall
    ) / 3;

    if (avgCorrelation > 0.7) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: avgCorrelation,
        description: `Strong statistical correlation (${(avgCorrelation * 100).toFixed(1)}%)`,
        impact: 0.2
      });
    }

    // Outlier evidence
    if (disagreement.outliers.length === 0) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: 1.0,
        description: 'No outlier responses detected',
        impact: 0.15
      });
    } else {
      evidence.push({
        type: EvidenceType.NEGATIVE,
        value: disagreement.outliers.length,
        description: `${disagreement.outliers.length} outlier responses detected`,
        impact: -0.1 * disagreement.outliers.length
      });
    }

    // Calculate raw score
    const rawScore = (
      agreement.semanticSimilarity * 0.4 +
      agreement.structuralSimilarity * 0.3 +
      avgCorrelation * 0.2 +
      (1 - disagreement.disagreementScore) * 0.1
    );

    const normalizedScore = this.normalizeScore(rawScore, this.config.normalization);
    const weight = this.config.factors.agreement;
    const contribution = normalizedScore * weight;
    const confidence = this.calculateFactorConfidence(evidence);

    return {
      rawScore,
      normalizedScore,
      weight,
      contribution,
      confidence,
      evidence
    };
  }

  /**
   * Calculates quality confidence factor
   */
  private calculateQualityFactor(
    responses: LLMResponse[],
    rankedResponses: RankedResponse[]
  ): ConfidenceFactor {
    const evidence: FactorEvidence[] = [];

    // Individual response quality
    const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;
    if (avgConfidence > 0.8) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: avgConfidence,
        description: `High average individual confidence (${(avgConfidence * 100).toFixed(1)}%)`,
        impact: 0.25
      });
    }

    // Ranking quality
    if (rankedResponses.length > 0) {
      const topResponseScore = rankedResponses[0].overallScore;
      if (topResponseScore > 0.8) {
        evidence.push({
          type: EvidenceType.POSITIVE,
          value: topResponseScore,
          description: `High-quality top response (${(topResponseScore * 100).toFixed(1)}%)`,
          impact: 0.2
        });
      }

      // Quality distribution
      const qualityVariance = this.calculateVariance(rankedResponses.map(r => r.overallScore));
      if (qualityVariance < 0.1) {
        evidence.push({
          type: EvidenceType.POSITIVE,
          value: 1 - qualityVariance,
          description: 'Consistent quality across responses',
          impact: 0.15
        });
      }
    }

    // Content richness
    const avgContentLength = responses.reduce((sum, r) => sum + r.content.length, 0) / responses.length;
    const avgTokens = responses.reduce((sum, r) => sum + r.tokensUsed, 0) / responses.length;

    if (avgContentLength > 500 && avgTokens > 200) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: Math.min(avgContentLength / 1000, 1),
        description: 'Rich, detailed responses',
        impact: 0.1
      });
    }

    // Calculate raw score
    const rankingScore = rankedResponses.length > 0 
      ? rankedResponses.reduce((sum, r) => sum + r.overallScore, 0) / rankedResponses.length
      : avgConfidence;

    const rawScore = (avgConfidence * 0.6 + rankingScore * 0.4);
    const normalizedScore = this.normalizeScore(rawScore, this.config.normalization);
    const weight = this.config.factors.quality;
    const contribution = normalizedScore * weight;
    const confidence = this.calculateFactorConfidence(evidence);

    return {
      rawScore,
      normalizedScore,
      weight,
      contribution,
      confidence,
      evidence
    };
  }

  /**
   * Calculates consistency confidence factor
   */
  private calculateConsistencyFactor(
    responses: LLMResponse[],
    agreement: AgreementMeasures
  ): ConfidenceFactor {
    const evidence: FactorEvidence[] = [];

    // Confidence variance
    const confidenceVariance = agreement.variance.confidenceVariance;
    if (confidenceVariance < 0.1) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: 1 - confidenceVariance,
        description: 'Low confidence variance across responses',
        impact: 0.2
      });
    }

    // Response time consistency
    const responseTimeVariance = agreement.variance.responseTimeVariance;
    const avgResponseTime = responses.reduce((sum, r) => sum + r.responseTime, 0) / responses.length;
    const normalizedTimeVariance = avgResponseTime > 0 ? responseTimeVariance / (avgResponseTime * avgResponseTime) : 0;

    if (normalizedTimeVariance < 0.25) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: 1 - normalizedTimeVariance,
        description: 'Consistent response times',
        impact: 0.1
      });
    }

    // Content length consistency
    const contentLengthVariance = agreement.variance.contentLengthVariance;
    const avgContentLength = responses.reduce((sum, r) => sum + r.content.length, 0) / responses.length;
    const normalizedLengthVariance = avgContentLength > 0 ? contentLengthVariance / (avgContentLength * avgContentLength) : 0;

    if (normalizedLengthVariance < 0.25) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: 1 - normalizedLengthVariance,
        description: 'Consistent response lengths',
        impact: 0.1
      });
    }

    // Token usage consistency
    const tokenVariance = agreement.variance.tokenUsageVariance;
    const avgTokens = responses.reduce((sum, r) => sum + r.tokensUsed, 0) / responses.length;
    const normalizedTokenVariance = avgTokens > 0 ? tokenVariance / (avgTokens * avgTokens) : 0;

    if (normalizedTokenVariance < 0.25) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: 1 - normalizedTokenVariance,
        description: 'Consistent token usage',
        impact: 0.1
      });
    }

    // Calculate raw score based on variance measures
    const rawScore = (
      Math.max(0, 1 - confidenceVariance * 4) * 0.4 +
      Math.max(0, 1 - normalizedTimeVariance * 2) * 0.2 +
      Math.max(0, 1 - normalizedLengthVariance * 2) * 0.2 +
      Math.max(0, 1 - normalizedTokenVariance * 2) * 0.2
    );

    const normalizedScore = this.normalizeScore(rawScore, this.config.normalization);
    const weight = this.config.factors.consistency;
    const contribution = normalizedScore * weight;
    const confidence = this.calculateFactorConfidence(evidence);

    return {
      rawScore,
      normalizedScore,
      weight,
      contribution,
      confidence,
      evidence
    };
  }

  /**
   * Calculates coverage confidence factor
   */
  private calculateCoverageFactor(
    responses: LLMResponse[],
    consensus: ConsensusResult
  ): ConfidenceFactor {
    const evidence: FactorEvidence[] = [];

    // Provider coverage
    const uniqueProviders = new Set(responses.map(r => r.model)).size;
    if (uniqueProviders >= 3) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: uniqueProviders,
        description: `Good provider coverage (${uniqueProviders} providers)`,
        impact: 0.2
      });
    } else if (uniqueProviders < 2) {
      evidence.push({
        type: EvidenceType.NEGATIVE,
        value: uniqueProviders,
        description: `Limited provider coverage (${uniqueProviders} provider${uniqueProviders === 1 ? '' : 's'})`,
        impact: -0.3
      });
    }

    // Response volume
    if (responses.length >= 3) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: responses.length,
        description: `Adequate response volume (${responses.length} responses)`,
        impact: 0.15
      });
    }

    // Topic coverage from consensus
    const consensusVotingTopics = consensus.votingResults.length;
    if (consensusVotingTopics > 1) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: consensusVotingTopics,
        description: `Multiple topics covered (${consensusVotingTopics} topics)`,
        impact: 0.1
      });
    }

    // Content diversity
    const avgContentLength = responses.reduce((sum, r) => sum + r.content.length, 0) / responses.length;
    const contentLengthVariance = responses.reduce((sum, r) => 
      sum + Math.pow(r.content.length - avgContentLength, 2), 0
    ) / responses.length;
    const diversityScore = Math.min(contentLengthVariance / (avgContentLength * avgContentLength), 1);

    if (diversityScore > 0.1 && diversityScore < 0.5) { // Optimal diversity
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: diversityScore,
        description: 'Good content diversity',
        impact: 0.1
      });
    }

    // Calculate raw score
    const providerScore = Math.min(uniqueProviders / 3, 1);
    const volumeScore = Math.min(responses.length / 3, 1);
    const topicScore = Math.min(consensusVotingTopics / 2, 1);
    const diversityScore_normalized = diversityScore > 0.1 && diversityScore < 0.5 ? 1 : 0.5;

    const rawScore = (
      providerScore * 0.4 +
      volumeScore * 0.3 +
      topicScore * 0.2 +
      diversityScore_normalized * 0.1
    );

    const normalizedScore = this.normalizeScore(rawScore, this.config.normalization);
    const weight = this.config.factors.coverage;
    const contribution = normalizedScore * weight;
    const confidence = this.calculateFactorConfidence(evidence);

    return {
      rawScore,
      normalizedScore,
      weight,
      contribution,
      confidence,
      evidence
    };
  }

  /**
   * Calculates completeness confidence factor
   */
  private calculateCompletenessFactor(responses: LLMResponse[]): ConfidenceFactor {
    const evidence: FactorEvidence[] = [];

    // Response completeness
    const completeResponses = responses.filter(r => 
      r.content.length > 50 && 
      r.tokensUsed > 20 && 
      r.confidence > 0.1
    );

    const completenessRate = completeResponses.length / responses.length;
    if (completenessRate === 1.0) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: completenessRate,
        description: 'All responses are complete',
        impact: 0.3
      });
    } else if (completenessRate < 0.8) {
      evidence.push({
        type: EvidenceType.NEGATIVE,
        value: completenessRate,
        description: `${(completenessRate * 100).toFixed(1)}% response completeness`,
        impact: -0.2 * (1 - completenessRate)
      });
    }

    // Metadata completeness
    const responsesWithMetadata = responses.filter(r => 
      r.metadata && Object.keys(r.metadata).length > 0
    );
    const metadataRate = responsesWithMetadata.length / responses.length;

    if (metadataRate > 0.5) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: metadataRate,
        description: `${(metadataRate * 100).toFixed(1)}% responses include metadata`,
        impact: 0.1
      });
    }

    // Error handling completeness
    const responsesWithErrors = responses.filter(r => r.error);
    if (responsesWithErrors.length === 0) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: 1.0,
        description: 'No error responses',
        impact: 0.15
      });
    } else {
      evidence.push({
        type: EvidenceType.NEGATIVE,
        value: responsesWithErrors.length / responses.length,
        description: `${responsesWithErrors.length} error responses`,
        impact: -0.2 * (responsesWithErrors.length / responses.length)
      });
    }

    // Content depth
    const avgWordCount = responses.reduce((sum, r) => 
      sum + r.content.split(/\s+/).filter(w => w.length > 0).length, 0
    ) / responses.length;

    if (avgWordCount > 100) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: Math.min(avgWordCount / 200, 1),
        description: `Good content depth (${avgWordCount.toFixed(0)} avg words)`,
        impact: 0.1
      });
    }

    // Calculate raw score
    const rawScore = (
      completenessRate * 0.5 +
      metadataRate * 0.2 +
      (responsesWithErrors.length === 0 ? 1 : 1 - responsesWithErrors.length / responses.length) * 0.2 +
      Math.min(avgWordCount / 200, 1) * 0.1
    );

    const normalizedScore = this.normalizeScore(rawScore, this.config.normalization);
    const weight = this.config.factors.completeness;
    const contribution = normalizedScore * weight;
    const confidence = this.calculateFactorConfidence(evidence);

    return {
      rawScore,
      normalizedScore,
      weight,
      contribution,
      confidence,
      evidence
    };
  }

  /**
   * Calculates uncertainty confidence factor
   */
  private calculateUncertaintyFactor(
    agreement: AgreementMeasures,
    disagreement: DisagreementAnalysis
  ): ConfidenceFactor {
    const evidence: FactorEvidence[] = [];

    // Information entropy
    if (agreement.entropy.informationEntropy < 0.5) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: 1 - agreement.entropy.informationEntropy,
        description: 'Low information entropy indicates focused responses',
        impact: 0.2
      });
    } else if (agreement.entropy.informationEntropy > 0.8) {
      evidence.push({
        type: EvidenceType.NEGATIVE,
        value: agreement.entropy.informationEntropy,
        description: 'High information entropy indicates scattered responses',
        impact: -0.15
      });
    }

    // Disagreement level
    if (disagreement.disagreementScore < 0.2) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: 1 - disagreement.disagreementScore,
        description: 'Low disagreement between responses',
        impact: 0.25
      });
    } else if (disagreement.disagreementScore > 0.5) {
      evidence.push({
        type: EvidenceType.NEGATIVE,
        value: disagreement.disagreementScore,
        description: 'High disagreement between responses',
        impact: -0.3
      });
    }

    // Consensus strength
    const avgConsensusStrength = (
      disagreement.consensus.semantic +
      disagreement.consensus.statistical +
      disagreement.consensus.structural
    ) / 3;

    if (avgConsensusStrength > 0.7) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: avgConsensusStrength,
        description: `Strong consensus (${(avgConsensusStrength * 100).toFixed(1)}%)`,
        impact: 0.2
      });
    }

    // Variance measures
    const avgVariance = (
      agreement.variance.confidenceVariance +
      Math.min(agreement.variance.responseTimeVariance / 10000, 1) + // Normalize response time variance
      Math.min(agreement.variance.contentLengthVariance / 100000, 1) + // Normalize content length variance
      Math.min(agreement.variance.tokenUsageVariance / 10000, 1) // Normalize token variance
    ) / 4;

    if (avgVariance < 0.2) {
      evidence.push({
        type: EvidenceType.POSITIVE,
        value: 1 - avgVariance,
        description: 'Low variance across response metrics',
        impact: 0.15
      });
    }

    // Calculate raw score (inverted because lower uncertainty is better)
    const rawScore = (
      (1 - agreement.entropy.informationEntropy) * 0.3 +
      (1 - disagreement.disagreementScore) * 0.3 +
      avgConsensusStrength * 0.2 +
      (1 - avgVariance) * 0.2
    );

    const normalizedScore = this.normalizeScore(rawScore, this.config.normalization);
    const weight = this.config.factors.uncertainty;
    const contribution = normalizedScore * weight;
    const confidence = this.calculateFactorConfidence(evidence);

    return {
      rawScore,
      normalizedScore,
      weight,
      contribution,
      confidence,
      evidence
    };
  }

  /**
   * Normalizes score using specified method
   */
  private normalizeScore(score: number, method: NormalizationMethod): number {
    switch (method) {
      case NormalizationMethod.MINMAX:
        return Math.max(0, Math.min(1, score));
      
      case NormalizationMethod.SIGMOID:
        return 1 / (1 + Math.exp(-10 * (score - 0.5)));
      
      case NormalizationMethod.ZSCORE:
        // Assume mean=0.5, std=0.2 for z-score normalization
        const zScore = (score - 0.5) / 0.2;
        return Math.max(0, Math.min(1, (zScore + 3) / 6));
      
      case NormalizationMethod.PERCENTILE:
        // Simple percentile-based normalization
        return Math.pow(score, 0.5); // Square root for gentle curve
      
      default:
        return Math.max(0, Math.min(1, score));
    }
  }

  /**
   * Calculates confidence for a factor based on evidence
   */
  private calculateFactorConfidence(evidence: FactorEvidence[]): number {
    if (evidence.length === 0) return 0.5;

    const totalImpact = evidence.reduce((sum, e) => sum + Math.abs(e.impact), 0);
    const positiveImpact = evidence
      .filter(e => e.type === EvidenceType.POSITIVE)
      .reduce((sum, e) => sum + e.impact, 0);

    return totalImpact > 0 ? Math.max(0, Math.min(1, 0.5 + positiveImpact / totalImpact)) : 0.5;
  }

  /**
   * Analyzes interactions between confidence factors
   */
  private analyzeFactorInteractions(factors: DetailedConfidenceFactors): FactorInteraction[] {
    const interactions: FactorInteraction[] = [];

    // Agreement-Quality synergy
    if (factors.agreement.normalizedScore > 0.7 && factors.quality.normalizedScore > 0.7) {
      interactions.push({
        factor1: 'agreement',
        factor2: 'quality',
        interactionType: InteractionType.SYNERGY,
        effect: 0.1,
        description: 'High agreement reinforces high quality scores'
      });
    }

    // Consistency-Agreement reinforcement
    if (factors.consistency.normalizedScore > 0.6 && factors.agreement.normalizedScore > 0.6) {
      interactions.push({
        factor1: 'consistency',
        factor2: 'agreement',
        interactionType: InteractionType.REINFORCEMENT,
        effect: 0.05,
        description: 'Consistency supports agreement measurement reliability'
      });
    }

    // Uncertainty-Quality conflict
    if (factors.uncertainty.normalizedScore < 0.4 && factors.quality.normalizedScore > 0.7) {
      interactions.push({
        factor1: 'uncertainty',
        factor2: 'quality',
        interactionType: InteractionType.CONFLICT,
        effect: -0.05,
        description: 'High uncertainty undermines quality assessment'
      });
    }

    // Coverage-Completeness synergy
    if (factors.coverage.normalizedScore > 0.6 && factors.completeness.normalizedScore > 0.6) {
      interactions.push({
        factor1: 'coverage',
        factor2: 'completeness',
        interactionType: InteractionType.SYNERGY,
        effect: 0.05,
        description: 'Good coverage enhances completeness value'
      });
    }

    return interactions;
  }

  /**
   * Handles confidence degradation for partial responses
   */
  private handleConfidenceDegradation(
    responses: LLMResponse[],
    factors: DetailedConfidenceFactors
  ): DegradationImpact[] {
    const impacts: DegradationImpact[] = [];

    if (!this.config.degradationHandling.enableDegradation) {
      return impacts;
    }

    // Check for partial responses
    const partialResponses = responses.filter(r => 
      r.content.length < 50 || r.tokensUsed < 20
    );

    if (partialResponses.length > 0) {
      const severity = partialResponses.length / responses.length > 0.5 
        ? DegradationSeverity.MAJOR 
        : DegradationSeverity.MODERATE;

      impacts.push({
        cause: 'Partial Responses',
        severity,
        impact: -this.config.degradationHandling.partialResponsePenalty * (partialResponses.length / responses.length),
        mitigation: 'Request complete responses from providers'
      });
    }

    // Check for missing metadata
    const responsesWithoutMetadata = responses.filter(r => !r.metadata || Object.keys(r.metadata).length === 0);
    if (responsesWithoutMetadata.length > responses.length * 0.5) {
      impacts.push({
        cause: 'Missing Metadata',
        severity: DegradationSeverity.MINOR,
        impact: -this.config.degradationHandling.missingDataPenalty,
        mitigation: 'Enhance response metadata collection'
      });
    }

    // Check for timeout responses
    const timeoutResponses = responses.filter(r => r.responseTime > 30000); // 30 seconds
    if (timeoutResponses.length > 0) {
      impacts.push({
        cause: 'Response Timeouts',
        severity: timeoutResponses.length > 1 ? DegradationSeverity.MAJOR : DegradationSeverity.MODERATE,
        impact: -this.config.degradationHandling.timeoutPenalty * (timeoutResponses.length / responses.length),
        mitigation: 'Optimize provider response times'
      });
    }

    return impacts;
  }

  /**
   * Applies confidence propagation effects
   */
  private applyConfidencePropagation(factors: DetailedConfidenceFactors): PropagationEffect[] {
    const effects: PropagationEffect[] = [];

    if (!this.config.propagation.enablePropagation) {
      return effects;
    }

    // High agreement boosts other factors
    if (factors.agreement.normalizedScore > 0.8) {
      const boost = factors.agreement.normalizedScore * 0.1;
      
      effects.push({
        source: 'agreement',
        target: 'quality',
        propagationType: PropagationType.CONFIDENCE_BOOST,
        magnitude: boost,
        confidence: factors.agreement.confidence
      });

      effects.push({
        source: 'agreement',
        target: 'consistency',
        propagationType: PropagationType.CONFIDENCE_BOOST,
        magnitude: boost * 0.5,
        confidence: factors.agreement.confidence
      });
    }

    // Low uncertainty reduces other factor uncertainty
    if (factors.uncertainty.normalizedScore > 0.7) {
      const reduction = factors.uncertainty.normalizedScore * 0.05;
      
      effects.push({
        source: 'uncertainty',
        target: 'quality',
        propagationType: PropagationType.UNCERTAINTY_DECREASE,
        magnitude: reduction,
        confidence: factors.uncertainty.confidence
      });
    }

    // High completeness boosts coverage
    if (factors.completeness.normalizedScore > 0.8) {
      effects.push({
        source: 'completeness',
        target: 'coverage',
        propagationType: PropagationType.CONFIDENCE_BOOST,
        magnitude: factors.completeness.normalizedScore * 0.05,
        confidence: factors.completeness.confidence
      });
    }

    return effects;
  }

  /**
   * Calculates component scores for breakdown
   */
  private calculateComponentScores(factors: DetailedConfidenceFactors): ComponentScore[] {
    const totalWeight = Object.values(this.config.factors).reduce((sum, weight) => sum + weight, 0);

    return Object.entries(factors).map(([name, factor]) => ({
      component: name,
      score: factor.normalizedScore,
      weight: factor.weight,
      normalizedContribution: factor.contribution / totalWeight
    }));
  }

  /**
   * Calculates overall confidence with interactions and propagation
   */
  private calculateOverallConfidence(
    factors: DetailedConfidenceFactors,
    interactions: FactorInteraction[],
    degradations: DegradationImpact[],
    propagations: PropagationEffect[]
  ): number {
    // Base confidence from factor contributions
    const baseConfidence = Object.values(factors).reduce((sum, factor) => sum + factor.contribution, 0);
    const totalWeight = Object.values(this.config.factors).reduce((sum, weight) => sum + weight, 0);
    const normalizedBase = baseConfidence / totalWeight;

    // Apply interaction effects
    const interactionEffect = interactions.reduce((sum, interaction) => sum + interaction.effect, 0);

    // Apply degradation impacts
    const degradationEffect = degradations.reduce((sum, degradation) => sum + degradation.impact, 0);

    // Apply propagation effects
    const propagationEffect = propagations.reduce((sum, propagation) => {
      return sum + (propagation.propagationType.includes('BOOST') ? propagation.magnitude : -propagation.magnitude);
    }, 0);

    // Combine all effects
    const finalConfidence = normalizedBase + interactionEffect + degradationEffect + propagationEffect;

    return Math.max(0, Math.min(1, finalConfidence));
  }

  /**
   * Determines confidence level from numerical confidence
   */
  private determineConfidenceLevel(confidence: number): ConfidenceLevel {
    if (confidence >= this.config.thresholds.high) return ConfidenceLevel.VERY_HIGH;
    if (confidence >= this.config.thresholds.medium) return ConfidenceLevel.HIGH;
    if (confidence >= this.config.thresholds.low) return ConfidenceLevel.MEDIUM;
    if (confidence >= this.config.thresholds.critical) return ConfidenceLevel.LOW;
    return ConfidenceLevel.VERY_LOW;
  }

  /**
   * Calculates reliability metrics
   */
  private calculateReliabilityMetrics(
    factors: DetailedConfidenceFactors,
    agreement: AgreementMeasures,
    disagreement: DisagreementAnalysis
  ): ReliabilityMetrics {
    // Stability: how consistent the confidence factors are
    const factorScores = Object.values(factors).map(f => f.normalizedScore);
    const stability = 1 - this.calculateVariance(factorScores);

    // Robustness: resistance to outliers and disagreements
    const robustness = Math.max(0, 1 - disagreement.disagreementScore);

    // Predictability: based on variance measures
    const avgVariance = (
      agreement.variance.confidenceVariance +
      Math.min(agreement.variance.responseTimeVariance / 10000, 1) +
      Math.min(agreement.variance.contentLengthVariance / 100000, 1)
    ) / 3;
    const predictability = Math.max(0, 1 - avgVariance);

    // Trustworthiness: overall assessment based on evidence quality
    const avgEvidenceConfidence = Object.values(factors).reduce((sum, f) => sum + f.confidence, 0) / Object.values(factors).length;
    const trustworthiness = avgEvidenceConfidence;

    return {
      stability: Math.max(0, Math.min(1, stability)),
      robustness: Math.max(0, Math.min(1, robustness)),
      predictability: Math.max(0, Math.min(1, predictability)),
      trustworthiness: Math.max(0, Math.min(1, trustworthiness))
    };
  }

  /**
   * Generates advanced recommendations
   */
  private generateAdvancedRecommendations(
    overallConfidence: number,
    factors: DetailedConfidenceFactors,
    degradations: DegradationImpact[],
    disagreement: DisagreementAnalysis
  ): ConfidenceRecommendation[] {
    const recommendations: ConfidenceRecommendation[] = [];

    // Overall confidence recommendations
    if (overallConfidence < 0.5) {
      recommendations.push({
        type: RecommendationType.WARNING,
        priority: RecommendationPriority.HIGH,
        description: 'Overall confidence is below acceptable threshold',
        action: 'Review response quality and consider additional provider responses',
        expectedImpact: 0.3
      });
    }

    // Factor-specific recommendations
    if (factors.agreement.normalizedScore < 0.5) {
      recommendations.push({
        type: RecommendationType.IMPROVEMENT,
        priority: RecommendationPriority.MEDIUM,
        description: 'Low agreement between provider responses',
        action: 'Investigate response disagreements and validate individual provider outputs',
        expectedImpact: 0.2
      });
    }

    if (factors.quality.normalizedScore < 0.6) {
      recommendations.push({
        type: RecommendationType.IMPROVEMENT,
        priority: RecommendationPriority.MEDIUM,
        description: 'Response quality scores are suboptimal',
        action: 'Review provider configurations and prompt engineering',
        expectedImpact: 0.25
      });
    }

    // Degradation-specific recommendations
    for (const degradation of degradations) {
      if (degradation.severity === DegradationSeverity.MAJOR || degradation.severity === DegradationSeverity.CRITICAL) {
        recommendations.push({
          type: RecommendationType.WARNING,
          priority: RecommendationPriority.HIGH,
          description: `${degradation.cause} causing significant confidence degradation`,
          action: degradation.mitigation,
          expectedImpact: Math.abs(degradation.impact)
        });
      }
    }

    // Disagreement recommendations
    if (disagreement.outliers.length > 0) {
      recommendations.push({
        type: RecommendationType.VALIDATION,
        priority: RecommendationPriority.MEDIUM,
        description: `${disagreement.outliers.length} outlier responses detected`,
        action: 'Review outlier responses for data quality issues or provider-specific problems',
        expectedImpact: 0.15
      });
    }

    // Optimization recommendations
    if (overallConfidence > 0.8) {
      recommendations.push({
        type: RecommendationType.OPTIMIZATION,
        priority: RecommendationPriority.LOW,
        description: 'High confidence achieved - suitable for automated processing',
        action: 'Consider reducing redundancy or optimizing performance',
        expectedImpact: 0.05
      });
    }

    return recommendations;
  }

  /**
   * Assesses overall data quality
   */
  private assessDataQuality(responses: LLMResponse[]): number {
    if (responses.length === 0) return 0;

    const completeResponses = responses.filter(r => 
      r.content && r.content.length > 0 && 
      r.confidence !== undefined && 
      r.responseTime > 0 && 
      r.tokensUsed > 0
    );

    const completenessScore = completeResponses.length / responses.length;
    const avgConfidence = responses.reduce((sum, r) => sum + (r.confidence || 0), 0) / responses.length;
    const hasErrors = responses.some(r => r.error);

    return (completenessScore * 0.5 + avgConfidence * 0.4 + (hasErrors ? 0 : 0.1));
  }

  /**
   * Helper method to calculate variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
    
    return squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length;
  }
}