/**
 * Ensemble Confidence Calculator
 * 
 * Implements sophisticated confidence calculation for ensemble responses
 * based on inter-model agreement, response quality, and statistical measures.
 */

import { LLMResponse } from '../../../llm-orchestrator/src/providers/base/LLMProvider.interface';
import { ConsensusResult } from '../aggregation/consensus.service';
import { RankedResponse } from '../aggregation/ranking.service';

export interface ConfidenceConfig {
  readonly agreementWeighting: number;
  readonly qualityWeighting: number;
  readonly consistencyWeighting: number;
  readonly diversityBonus: number;
  readonly outlierPenalty: number;
  readonly minimumResponses: number;
  readonly confidenceThresholds: ConfidenceThresholds;
}

export interface ConfidenceThresholds {
  readonly high: number;
  readonly medium: number;
  readonly low: number;
  readonly veryLow: number;
}

export interface EnsembleConfidenceResult {
  readonly overallConfidence: number;
  readonly confidenceLevel: ConfidenceLevel;
  readonly componentConfidences: ComponentConfidence;
  readonly confidenceFactors: ConfidenceFactors;
  readonly uncertaintyMeasures: UncertaintyMeasures;
  readonly recommendations: string[];
}

export interface ComponentConfidence {
  readonly agreement: number;
  readonly quality: number;
  readonly consistency: number;
  readonly diversity: number;
  readonly coverage: number;
}

export interface ConfidenceFactors {
  readonly positiveFactors: ConfidenceFactor[];
  readonly negativeFactors: ConfidenceFactor[];
  readonly netImpact: number;
}

export interface ConfidenceFactor {
  readonly factor: string;
  readonly impact: number;
  readonly description: string;
}

export interface UncertaintyMeasures {
  readonly variance: number;
  readonly standardDeviation: number;
  readonly coefficientOfVariation: number;
  readonly informationEntropy: number;
  readonly disagreementLevel: number;
}

export enum ConfidenceLevel {
  VERY_HIGH = 'very_high',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  VERY_LOW = 'very_low'
}

export interface ProviderAgreementAnalysis {
  readonly pairwiseAgreements: PairwiseAgreement[];
  readonly clusterAnalysis: ClusterAnalysis;
  readonly outlierAnalysis: OutlierAnalysis;
  readonly consensusStrength: number;
}

export interface PairwiseAgreement {
  readonly provider1: string;
  readonly provider2: string;
  readonly agreement: number;
  readonly similarity: number;
  readonly conflictAreas: string[];
}

export interface ClusterAnalysis {
  readonly clusters: ResponseCluster[];
  readonly silhouetteScore: number;
  readonly intraClusterVariance: number;
  readonly interClusterDistance: number;
}

export interface ResponseCluster {
  readonly id: string;
  readonly responses: string[];
  readonly centroid: ClusterCentroid;
  readonly cohesion: number;
  readonly size: number;
}

export interface ClusterCentroid {
  readonly confidence: number;
  readonly contentLength: number;
  readonly technicalDetail: number;
  readonly specificity: number;
}

export interface OutlierAnalysis {
  readonly outliers: string[];
  readonly outlierImpact: number;
  readonly isolationScores: Record<string, number>;
}

/**
 * Ensemble Confidence Calculator Implementation
 */
export class EnsembleConfidenceCalculator {
  private config: ConfidenceConfig;

  constructor(config: ConfidenceConfig) {
    this.config = config;
  }

  /**
   * Calculates ensemble confidence from multiple inputs
   */
  public calculateEnsembleConfidence(
    responses: LLMResponse[],
    consensus: ConsensusResult,
    rankedResponses: RankedResponse[]
  ): EnsembleConfidenceResult {
    console.log(`🔍 Calculating ensemble confidence for ${responses.length} responses`);

    if (responses.length < this.config.minimumResponses) {
      return this.buildLowConfidenceResult(
        `Insufficient responses (${responses.length} < ${this.config.minimumResponses})`
      );
    }

    // Calculate component confidences
    const componentConfidences = this.calculateComponentConfidences(
      responses,
      consensus,
      rankedResponses
    );

    // Analyze provider agreement
    const agreementAnalysis = this.analyzeProviderAgreement(responses);

    // Calculate uncertainty measures
    const uncertaintyMeasures = this.calculateUncertaintyMeasures(responses, consensus);

    // Identify confidence factors
    const confidenceFactors = this.identifyConfidenceFactors(
      responses,
      consensus,
      rankedResponses,
      agreementAnalysis
    );

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(
      componentConfidences,
      confidenceFactors
    );

    // Determine confidence level
    const confidenceLevel = this.determineConfidenceLevel(overallConfidence);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      overallConfidence,
      confidenceFactors,
      uncertaintyMeasures
    );

    return {
      overallConfidence,
      confidenceLevel,
      componentConfidences,
      confidenceFactors,
      uncertaintyMeasures,
      recommendations
    };
  }

  /**
   * Calculates individual component confidences
   */
  private calculateComponentConfidences(
    responses: LLMResponse[],
    consensus: ConsensusResult,
    rankedResponses: RankedResponse[]
  ): ComponentConfidence {
    // Agreement confidence based on consensus strength
    const agreement = consensus.agreementLevel;

    // Quality confidence based on ranking results
    const quality = rankedResponses.length > 0
      ? rankedResponses.reduce((sum, r) => sum + r.overallScore, 0) / rankedResponses.length
      : 0;

    // Consistency confidence based on response variance
    const consistency = this.calculateConsistencyConfidence(responses);

    // Diversity confidence (balanced diversity is good)
    const diversity = this.calculateDiversityConfidence(responses);

    // Coverage confidence based on response completeness
    const coverage = this.calculateCoverageConfidence(responses);

    return {
      agreement,
      quality,
      consistency,
      diversity,
      coverage
    };
  }

  /**
   * Calculates consistency confidence based on response variance
   */
  private calculateConsistencyConfidence(responses: LLMResponse[]): number {
    if (responses.length < 2) return 1.0;

    // Calculate confidence variance
    const confidences = responses.map(r => r.confidence);
    const mean = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const variance = confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / confidences.length;

    // Calculate response time variance
    const responseTimes = responses.map(r => r.responseTime);
    const rtMean = responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
    const rtVariance = responseTimes.reduce((sum, rt) => sum + Math.pow(rt - rtMean, 2), 0) / responseTimes.length;

    // Lower variance = higher consistency
    const confidenceConsistency = Math.max(0, 1 - variance);
    const timeConsistency = Math.max(0, 1 - rtVariance / (rtMean * rtMean));

    return (confidenceConsistency + timeConsistency) / 2;
  }

  /**
   * Calculates diversity confidence (optimal diversity level)
   */
  private calculateDiversityConfidence(responses: LLMResponse[]): number {
    if (responses.length < 2) return 0.5;

    // Calculate content diversity using simple similarity
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const similarity = this.calculateContentSimilarity(
          responses[i].content,
          responses[j].content
        );
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;

    // Optimal diversity: not too similar (groupthink) but not too different (inconsistent)
    const diversityScore = this.calculateOptimalDiversityScore(avgSimilarity);

    return diversityScore;
  }

  /**
   * Calculates optimal diversity score
   */
  private calculateOptimalDiversityScore(similarity: number): number {
    // Optimal similarity is around 0.3-0.7 (some agreement but not identical)
    const optimal = 0.5;
    const tolerance = 0.2;

    if (similarity >= optimal - tolerance && similarity <= optimal + tolerance) {
      return 1.0;
    } else {
      const deviation = Math.abs(similarity - optimal);
      return Math.max(0, 1 - (deviation - tolerance) / (1 - tolerance));
    }
  }

  /**
   * Calculates coverage confidence based on response completeness
   */
  private calculateCoverageConfidence(responses: LLMResponse[]): number {
    // Coverage based on response length and detail
    const avgContentLength = responses.reduce((sum, r) => sum + r.content.length, 0) / responses.length;
    const avgTokens = responses.reduce((sum, r) => sum + r.tokensUsed, 0) / responses.length;

    // Normalize lengths (assuming reasonable response lengths)
    const lengthScore = Math.min(1.0, avgContentLength / 1000);
    const tokenScore = Math.min(1.0, avgTokens / 500);

    return (lengthScore + tokenScore) / 2;
  }

  /**
   * Analyzes agreement between providers
   */
  private analyzeProviderAgreement(responses: LLMResponse[]): ProviderAgreementAnalysis {
    // Calculate pairwise agreements
    const pairwiseAgreements = this.calculatePairwiseAgreements(responses);

    // Perform cluster analysis
    const clusterAnalysis = this.performClusterAnalysis(responses);

    // Analyze outliers
    const outlierAnalysis = this.analyzeOutliers(responses);

    // Calculate consensus strength
    const consensusStrength = this.calculateConsensusStrength(pairwiseAgreements);

    return {
      pairwiseAgreements,
      clusterAnalysis,
      outlierAnalysis,
      consensusStrength
    };
  }

  /**
   * Calculates pairwise agreements between providers
   */
  private calculatePairwiseAgreements(responses: LLMResponse[]): PairwiseAgreement[] {
    const agreements: PairwiseAgreement[] = [];

    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const response1 = responses[i];
        const response2 = responses[j];

        const similarity = this.calculateContentSimilarity(response1.content, response2.content);
        const confidenceAgreement = 1 - Math.abs(response1.confidence - response2.confidence);
        const agreement = (similarity + confidenceAgreement) / 2;

        agreements.push({
          provider1: response1.model,
          provider2: response2.model,
          agreement,
          similarity,
          conflictAreas: this.identifyConflictAreas(response1.content, response2.content)
        });
      }
    }

    return agreements;
  }

  /**
   * Performs cluster analysis on responses
   */
  private performClusterAnalysis(responses: LLMResponse[]): ClusterAnalysis {
    // Simple clustering based on content similarity
    const clusters: ResponseCluster[] = [];
    const processed = new Set<string>();

    for (const response of responses) {
      if (processed.has(response.id)) continue;

      const cluster: ResponseCluster = {
        id: `cluster_${clusters.length + 1}`,
        responses: [response.id],
        centroid: {
          confidence: response.confidence,
          contentLength: response.content.length,
          technicalDetail: this.calculateTechnicalDetail(response.content),
          specificity: this.calculateSpecificity(response.content)
        },
        cohesion: 1.0,
        size: 1
      };

      processed.add(response.id);

      // Find similar responses to add to cluster
      for (const otherResponse of responses) {
        if (processed.has(otherResponse.id)) continue;

        const similarity = this.calculateContentSimilarity(response.content, otherResponse.content);
        if (similarity > 0.7) { // High similarity threshold for clustering
          cluster.responses.push(otherResponse.id);
          processed.add(otherResponse.id);
          cluster.size++;

          // Update centroid
          cluster.centroid = this.updateClusterCentroid(cluster.centroid, otherResponse, cluster.size);
        }
      }

      clusters.push(cluster);
    }

    // Calculate cluster quality metrics
    const silhouetteScore = this.calculateSilhouetteScore(clusters, responses);
    const intraClusterVariance = this.calculateIntraClusterVariance(clusters, responses);
    const interClusterDistance = this.calculateInterClusterDistance(clusters);

    return {
      clusters,
      silhouetteScore,
      intraClusterVariance,
      interClusterDistance
    };
  }

  /**
   * Analyzes outlier responses
   */
  private analyzeOutliers(responses: LLMResponse[]): OutlierAnalysis {
    const outliers: string[] = [];
    const isolationScores: Record<string, number> = {};

    for (const response of responses) {
      const otherResponses = responses.filter(r => r.id !== response.id);
      let maxSimilarity = 0;

      for (const other of otherResponses) {
        const similarity = this.calculateContentSimilarity(response.content, other.content);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      // Isolation score: how different this response is from all others
      const isolationScore = 1 - maxSimilarity;
      isolationScores[response.id] = isolationScore;

      // Mark as outlier if very different from all others
      if (isolationScore > 0.7) {
        outliers.push(response.id);
      }
    }

    const outlierImpact = outliers.length / responses.length;

    return {
      outliers,
      outlierImpact,
      isolationScores
    };
  }

  /**
   * Calculates uncertainty measures
   */
  private calculateUncertaintyMeasures(
    responses: LLMResponse[],
    consensus: ConsensusResult
  ): UncertaintyMeasures {
    // Confidence variance
    const confidences = responses.map(r => r.confidence);
    const mean = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const variance = confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / confidences.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = mean > 0 ? standardDeviation / mean : 0;

    // Information entropy
    const informationEntropy = this.calculateInformationEntropy(responses);

    // Disagreement level from consensus
    const disagreementLevel = 1 - consensus.agreementLevel;

    return {
      variance,
      standardDeviation,
      coefficientOfVariation,
      informationEntropy,
      disagreementLevel
    };
  }

  /**
   * Calculates information entropy of responses
   */
  private calculateInformationEntropy(responses: LLMResponse[]): number {
    // Simple entropy calculation based on confidence distribution
    const confidences = responses.map(r => r.confidence);
    const bins = 10;
    const binCounts = new Array(bins).fill(0);

    for (const confidence of confidences) {
      const binIndex = Math.min(bins - 1, Math.floor(confidence * bins));
      binCounts[binIndex]++;
    }

    let entropy = 0;
    const total = confidences.length;

    for (const count of binCounts) {
      if (count > 0) {
        const p = count / total;
        entropy -= p * Math.log2(p);
      }
    }

    return entropy / Math.log2(bins); // Normalize to 0-1
  }

  /**
   * Identifies confidence factors
   */
  private identifyConfidenceFactors(
    responses: LLMResponse[],
    consensus: ConsensusResult,
    rankedResponses: RankedResponse[],
    agreementAnalysis: ProviderAgreementAnalysis
  ): ConfidenceFactors {
    const positiveFactors: ConfidenceFactor[] = [];
    const negativeFactors: ConfidenceFactor[] = [];

    // Check positive factors
    if (consensus.agreementLevel > 0.8) {
      positiveFactors.push({
        factor: 'high_consensus',
        impact: 0.2,
        description: `Strong consensus with ${(consensus.agreementLevel * 100).toFixed(1)}% agreement`
      });
    }

    if (responses.length >= 3) {
      positiveFactors.push({
        factor: 'multiple_providers',
        impact: 0.1,
        description: `Multiple providers (${responses.length}) provide diverse perspectives`
      });
    }

    if (rankedResponses.length > 0 && rankedResponses[0].overallScore > 0.8) {
      positiveFactors.push({
        factor: 'high_quality_top_response',
        impact: 0.15,
        description: `Top response has high quality score (${rankedResponses[0].overallScore.toFixed(2)})`
      });
    }

    if (agreementAnalysis.consensusStrength > 0.7) {
      positiveFactors.push({
        factor: 'strong_provider_agreement',
        impact: 0.1,
        description: `Strong agreement between providers (${(agreementAnalysis.consensusStrength * 100).toFixed(1)}%)`
      });
    }

    // Check negative factors
    if (consensus.disagreements.length > 0) {
      negativeFactors.push({
        factor: 'disagreements_present',
        impact: -0.1,
        description: `${consensus.disagreements.length} areas of disagreement identified`
      });
    }

    if (agreementAnalysis.outlierAnalysis.outliers.length > 0) {
      negativeFactors.push({
        factor: 'outlier_responses',
        impact: -0.05 * agreementAnalysis.outlierAnalysis.outliers.length,
        description: `${agreementAnalysis.outlierAnalysis.outliers.length} outlier responses detected`
      });
    }

    if (responses.length < 3) {
      negativeFactors.push({
        factor: 'limited_providers',
        impact: -0.15,
        description: `Limited number of providers (${responses.length}) reduces confidence`
      });
    }

    const avgConfidence = responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length;
    if (avgConfidence < 0.6) {
      negativeFactors.push({
        factor: 'low_individual_confidence',
        impact: -0.2,
        description: `Low average individual confidence (${(avgConfidence * 100).toFixed(1)}%)`
      });
    }

    const netImpact = 
      positiveFactors.reduce((sum, f) => sum + f.impact, 0) +
      negativeFactors.reduce((sum, f) => sum + f.impact, 0);

    return {
      positiveFactors,
      negativeFactors,
      netImpact
    };
  }

  /**
   * Calculates overall confidence
   */
  private calculateOverallConfidence(
    componentConfidences: ComponentConfidence,
    confidenceFactors: ConfidenceFactors
  ): number {
    // Weighted combination of component confidences
    const baseConfidence = 
      componentConfidences.agreement * this.config.agreementWeighting +
      componentConfidences.quality * this.config.qualityWeighting +
      componentConfidences.consistency * this.config.consistencyWeighting;

    const totalWeight = 
      this.config.agreementWeighting +
      this.config.qualityWeighting +
      this.config.consistencyWeighting;

    const normalizedBase = baseConfidence / totalWeight;

    // Apply diversity bonus and factor adjustments
    const diversityAdjustment = componentConfidences.diversity * this.config.diversityBonus;
    const factorAdjustment = confidenceFactors.netImpact;

    const finalConfidence = normalizedBase + diversityAdjustment + factorAdjustment;

    return Math.max(0, Math.min(1, finalConfidence));
  }

  /**
   * Determines confidence level from numerical confidence
   */
  private determineConfidenceLevel(confidence: number): ConfidenceLevel {
    const thresholds = this.config.confidenceThresholds;

    if (confidence >= thresholds.high) return ConfidenceLevel.VERY_HIGH;
    if (confidence >= thresholds.medium) return ConfidenceLevel.HIGH;
    if (confidence >= thresholds.low) return ConfidenceLevel.MEDIUM;
    if (confidence >= thresholds.veryLow) return ConfidenceLevel.LOW;
    return ConfidenceLevel.VERY_LOW;
  }

  /**
   * Generates recommendations based on confidence analysis
   */
  private generateRecommendations(
    overallConfidence: number,
    confidenceFactors: ConfidenceFactors,
    uncertaintyMeasures: UncertaintyMeasures
  ): string[] {
    const recommendations: string[] = [];

    // Low confidence recommendations
    if (overallConfidence < 0.5) {
      recommendations.push('Consider requesting additional provider responses to increase confidence');
      
      if (uncertaintyMeasures.disagreementLevel > 0.3) {
        recommendations.push('High disagreement detected - manual review recommended');
      }
    }

    // High uncertainty recommendations
    if (uncertaintyMeasures.coefficientOfVariation > 0.5) {
      recommendations.push('High response variability - consider ensemble voting mechanisms');
    }

    // Outlier handling
    const outlierFactors = confidenceFactors.negativeFactors.filter(f => f.factor === 'outlier_responses');
    if (outlierFactors.length > 0) {
      recommendations.push('Outlier responses detected - consider excluding from final result');
    }

    // Quality recommendations
    if (confidenceFactors.positiveFactors.length === 0) {
      recommendations.push('No strong positive confidence factors - additional validation recommended');
    }

    // Success case
    if (overallConfidence > 0.8) {
      recommendations.push('High confidence result - suitable for automated processing');
    }

    return recommendations;
  }

  /**
   * Builds low confidence result for insufficient data
   */
  private buildLowConfidenceResult(reason: string): EnsembleConfidenceResult {
    return {
      overallConfidence: 0.1,
      confidenceLevel: ConfidenceLevel.VERY_LOW,
      componentConfidences: {
        agreement: 0,
        quality: 0,
        consistency: 0,
        diversity: 0,
        coverage: 0
      },
      confidenceFactors: {
        positiveFactors: [],
        negativeFactors: [{
          factor: 'insufficient_data',
          impact: -0.9,
          description: reason
        }],
        netImpact: -0.9
      },
      uncertaintyMeasures: {
        variance: 0,
        standardDeviation: 0,
        coefficientOfVariation: 0,
        informationEntropy: 0,
        disagreementLevel: 1.0
      },
      recommendations: ['Increase number of provider responses', 'Manual review required']
    };
  }

  /**
   * Helper methods for calculations
   */
  private calculateContentSimilarity(content1: string, content2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private identifyConflictAreas(content1: string, content2: string): string[] {
    // Simplified conflict identification
    const conflicts: string[] = [];
    
    // Check for contradictory statements (simplified)
    const negationPattern1 = /(no|not|none|never|cannot)/gi;
    const negationPattern2 = /(yes|can|will|always|definitely)/gi;
    
    const hasNegation1 = negationPattern1.test(content1);
    const hasPositive2 = negationPattern2.test(content2);
    
    if (hasNegation1 && hasPositive2) {
      conflicts.push('Contradictory statements detected');
    }
    
    return conflicts;
  }

  private calculateTechnicalDetail(content: string): number {
    const technicalPatterns = [
      /\b\d+\s*(v|volt|a|amp|ohm|watt|hz)\b/gi,
      /\b[A-Z]\d+\b/g, // Component references
      /\b\d+(\.\d+)?\s*(mm|cm|inch|")\b/gi // Measurements
    ];
    
    let technicalCount = 0;
    for (const pattern of technicalPatterns) {
      const matches = content.match(pattern);
      if (matches) technicalCount += matches.length;
    }
    
    return Math.min(1.0, technicalCount / 10); // Normalize
  }

  private calculateSpecificity(content: string): number {
    // Count specific details
    const specificityIndicators = [
      /\b\d+/g, // Numbers
      /\b[A-Z][a-z]*\s+[A-Z][a-z]*/g, // Proper nouns
      /\b(specifically|exactly|precisely|particular)/gi
    ];
    
    let specificityScore = 0;
    for (const pattern of specificityIndicators) {
      const matches = content.match(pattern);
      if (matches) specificityScore += matches.length;
    }
    
    return Math.min(1.0, specificityScore / content.split(/\s+/).length);
  }

  private updateClusterCentroid(
    centroid: ClusterCentroid,
    newResponse: LLMResponse,
    clusterSize: number
  ): ClusterCentroid {
    const weight = 1 / clusterSize;
    
    return {
      confidence: centroid.confidence * (1 - weight) + newResponse.confidence * weight,
      contentLength: centroid.contentLength * (1 - weight) + newResponse.content.length * weight,
      technicalDetail: centroid.technicalDetail * (1 - weight) + this.calculateTechnicalDetail(newResponse.content) * weight,
      specificity: centroid.specificity * (1 - weight) + this.calculateSpecificity(newResponse.content) * weight
    };
  }

  private calculateSilhouetteScore(clusters: ResponseCluster[], responses: LLMResponse[]): number {
    // Simplified silhouette score calculation
    if (clusters.length < 2) return 1.0;
    
    // For now, return a reasonable default based on cluster quality
    const avgCohesion = clusters.reduce((sum, cluster) => sum + cluster.cohesion, 0) / clusters.length;
    return avgCohesion;
  }

  private calculateIntraClusterVariance(clusters: ResponseCluster[], responses: LLMResponse[]): number {
    if (clusters.length === 0) return 0;
    
    let totalVariance = 0;
    let totalResponses = 0;
    
    for (const cluster of clusters) {
      const clusterResponses = responses.filter(r => cluster.responses.includes(r.id));
      if (clusterResponses.length > 1) {
        const confidences = clusterResponses.map(r => r.confidence);
        const mean = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
        const variance = confidences.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / confidences.length;
        
        totalVariance += variance * clusterResponses.length;
        totalResponses += clusterResponses.length;
      }
    }
    
    return totalResponses > 0 ? totalVariance / totalResponses : 0;
  }

  private calculateInterClusterDistance(clusters: ResponseCluster[]): number {
    if (clusters.length < 2) return 1.0;
    
    let totalDistance = 0;
    let comparisons = 0;
    
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const distance = this.calculateCentroidDistance(clusters[i].centroid, clusters[j].centroid);
        totalDistance += distance;
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalDistance / comparisons : 0;
  }

  private calculateCentroidDistance(centroid1: ClusterCentroid, centroid2: ClusterCentroid): number {
    const confidenceDiff = Math.abs(centroid1.confidence - centroid2.confidence);
    const lengthDiff = Math.abs(centroid1.contentLength - centroid2.contentLength) / 1000; // Normalize
    const technicalDiff = Math.abs(centroid1.technicalDetail - centroid2.technicalDetail);
    const specificityDiff = Math.abs(centroid1.specificity - centroid2.specificity);
    
    return Math.sqrt(confidenceDiff ** 2 + lengthDiff ** 2 + technicalDiff ** 2 + specificityDiff ** 2);
  }

  private calculateConsensusStrength(pairwiseAgreements: PairwiseAgreement[]): number {
    if (pairwiseAgreements.length === 0) return 0;
    
    const avgAgreement = pairwiseAgreements.reduce((sum, pa) => sum + pa.agreement, 0) / pairwiseAgreements.length;
    return avgAgreement;
  }
}