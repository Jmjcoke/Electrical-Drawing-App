/**
 * Response Ranking Service
 * 
 * Implements quality scoring and ranking algorithms for ensemble responses.
 * Provides sophisticated scoring mechanisms for response quality assessment.
 */

import { LLMResponse } from '../../../llm-orchestrator/src/providers/base/LLMProvider.interface';

export interface RankingConfig {
  readonly qualityMetrics: QualityMetricConfig;
  readonly rankingStrategy: RankingStrategy;
  readonly normalizationMethod: NormalizationMethod;
  readonly outlierHandling: OutlierHandling;
  readonly temporalWeighting: boolean;
  readonly providerReputationWeighting: boolean;
}

export interface QualityMetricConfig {
  readonly completeness: { weight: number; threshold: number };
  readonly coherence: { weight: number; threshold: number };
  readonly specificity: { weight: number; threshold: number };
  readonly accuracy: { weight: number; threshold: number };
  readonly consistency: { weight: number; threshold: number };
  readonly relevance: { weight: number; threshold: number };
}

export enum RankingStrategy {
  WEIGHTED_SCORE = 'weighted_score',
  RELATIVE_RANKING = 'relative_ranking',
  TOURNAMENT = 'tournament',
  PAIRWISE_COMPARISON = 'pairwise_comparison',
  MULTI_CRITERIA = 'multi_criteria'
}

export enum NormalizationMethod {
  MIN_MAX = 'min_max',
  Z_SCORE = 'z_score',
  PERCENTILE = 'percentile',
  SIGMOID = 'sigmoid'
}

export enum OutlierHandling {
  INCLUDE = 'include',
  EXCLUDE = 'exclude',
  WEIGHT_DOWN = 'weight_down',
  SEPARATE_TIER = 'separate_tier'
}

export interface RankingResult {
  readonly rankedResponses: RankedResponse[];
  readonly qualityDistribution: QualityDistribution;
  readonly rankingMetadata: RankingMetadata;
  readonly outliers: OutlierInfo[];
}

export interface RankedResponse {
  readonly response: LLMResponse;
  readonly rank: number;
  readonly overallScore: number;
  readonly qualityScores: QualityScores;
  readonly normalizedScores: QualityScores;
  readonly tier: QualityTier;
  readonly strengths: string[];
  readonly weaknesses: string[];
  readonly comparisonDetails: ComparisonDetails;
}

export interface QualityScores {
  readonly completeness: number;
  readonly coherence: number;
  readonly specificity: number;
  readonly accuracy: number;
  readonly consistency: number;
  readonly relevance: number;
}

export interface QualityDistribution {
  readonly mean: number;
  readonly median: number;
  readonly standardDeviation: number;
  readonly range: { min: number; max: number };
  readonly percentiles: { p25: number; p50: number; p75: number; p90: number; p95: number };
  readonly tierDistribution: Record<QualityTier, number>;
}

export interface RankingMetadata {
  readonly strategy: RankingStrategy;
  readonly totalResponses: number;
  readonly validResponses: number;
  readonly outlierCount: number;
  readonly averageScore: number;
  readonly scoreVariance: number;
  readonly rankingConfidence: number;
}

export interface OutlierInfo {
  readonly response: LLMResponse;
  readonly deviationType: OutlierType;
  readonly deviationScore: number;
  readonly reasons: string[];
  readonly handling: OutlierHandling;
}

export enum QualityTier {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  AVERAGE = 'average',
  POOR = 'poor',
  UNACCEPTABLE = 'unacceptable'
}

export enum OutlierType {
  STATISTICAL = 'statistical',
  SEMANTIC = 'semantic',
  STRUCTURAL = 'structural',
  CONFIDENCE = 'confidence'
}

export interface ComparisonDetails {
  readonly pairwiseComparisons: PairwiseComparison[];
  readonly relativeRankings: RelativeRanking[];
  readonly tournamentResults: TournamentResult[];
}

export interface PairwiseComparison {
  readonly competitor: string;
  readonly winner: 'this' | 'competitor' | 'tie';
  readonly margin: number;
  readonly criteria: string[];
}

export interface RelativeRanking {
  readonly dimension: string;
  readonly rank: number;
  readonly totalCompetitors: number;
  readonly percentile: number;
}

export interface TournamentResult {
  readonly round: number;
  readonly opponent: string;
  readonly result: 'win' | 'loss' | 'tie';
  readonly score: number;
}

/**
 * Response Ranking Service Implementation
 */
export class RankingService {
  private config: RankingConfig;
  private providerReputations: Map<string, number> = new Map();

  constructor(config: RankingConfig) {
    this.config = config;
    this.initializeProviderReputations();
  }

  /**
   * Ranks responses using the configured strategy
   */
  public async rankResponses(responses: LLMResponse[]): Promise<RankingResult> {
    if (responses.length === 0) {
      throw new Error('Cannot rank empty response set');
    }

    console.log(`📊 Ranking ${responses.length} responses using ${this.config.rankingStrategy} strategy`);

    // Calculate quality scores for all responses
    const qualityAssessments = await this.assessResponseQuality(responses);

    // Detect outliers
    const outliers = await this.detectOutliers(qualityAssessments);

    // Apply outlier handling
    const filteredAssessments = this.handleOutliers(qualityAssessments, outliers);

    // Normalize scores
    const normalizedAssessments = this.normalizeScores(filteredAssessments);

    // Apply ranking strategy
    const rankedResponses = await this.applyRankingStrategy(normalizedAssessments);

    // Calculate quality distribution
    const qualityDistribution = this.calculateQualityDistribution(rankedResponses);

    // Build ranking metadata
    const rankingMetadata = this.buildRankingMetadata(responses, rankedResponses, outliers);

    return {
      rankedResponses,
      qualityDistribution,
      rankingMetadata,
      outliers
    };
  }

  /**
   * Updates provider reputation based on performance
   */
  public updateProviderReputation(provider: string, performanceScore: number): void {
    const currentReputation = this.providerReputations.get(provider) || 0.5;
    const learningRate = 0.1;
    const newReputation = currentReputation + learningRate * (performanceScore - currentReputation);
    
    this.providerReputations.set(provider, Math.max(0, Math.min(1, newReputation)));
    console.log(`📈 Updated ${provider} reputation: ${newReputation.toFixed(3)}`);
  }

  /**
   * Gets current provider reputations
   */
  public getProviderReputations(): Map<string, number> {
    return new Map(this.providerReputations);
  }

  /**
   * Assesses quality of all responses
   */
  private async assessResponseQuality(responses: LLMResponse[]): Promise<QualityAssessment[]> {
    const assessments: QualityAssessment[] = [];

    for (const response of responses) {
      const qualityScores = await this.calculateQualityScores(response, responses);
      
      assessments.push({
        response,
        qualityScores,
        overallScore: this.calculateOverallScore(qualityScores),
        temporal: this.calculateTemporalWeight(response),
        reputation: this.getProviderReputation(response.model)
      });
    }

    return assessments;
  }

  /**
   * Calculates individual quality scores for a response
   */
  private async calculateQualityScores(
    response: LLMResponse,
    allResponses: LLMResponse[]
  ): Promise<QualityScores> {
    const completeness = this.assessCompleteness(response);
    const coherence = this.assessCoherence(response);
    const specificity = this.assessSpecificity(response);
    const accuracy = this.assessAccuracy(response);
    const consistency = this.assessConsistency(response, allResponses);
    const relevance = this.assessRelevance(response);

    return {
      completeness,
      coherence,
      specificity,
      accuracy,
      consistency,
      relevance
    };
  }

  /**
   * Assesses response completeness
   */
  private assessCompleteness(response: LLMResponse): number {
    const content = response.content;
    
    // Basic completeness indicators
    const hasIntroduction = content.length > 50;
    const hasDetails = content.split('.').length > 3;
    const hasConclusion = content.toLowerCase().includes('conclusion') || 
                          content.toLowerCase().includes('summary') ||
                          content.toLowerCase().includes('in summary');
    
    // Check for structured content
    const hasStructure = content.includes('\n') || content.includes('-') || content.includes('1.');
    
    // Check for technical details (relevant for electrical drawings)
    const hasTechnicalTerms = this.containsTechnicalTerms(content);
    
    let score = 0;
    if (hasIntroduction) score += 0.2;
    if (hasDetails) score += 0.3;
    if (hasConclusion) score += 0.2;
    if (hasStructure) score += 0.15;
    if (hasTechnicalTerms) score += 0.15;
    
    return Math.min(score, 1.0);
  }

  /**
   * Assesses response coherence
   */
  private assessCoherence(response: LLMResponse): number {
    const content = response.content;
    const sentences = content.split('.').filter(s => s.trim().length > 0);
    
    if (sentences.length < 2) return 0.5;
    
    // Simple coherence measures
    let coherenceScore = 0;
    
    // Check for logical flow indicators
    const transitionWords = ['however', 'therefore', 'furthermore', 'additionally', 'meanwhile', 'consequently'];
    const hasTransitions = transitionWords.some(word => content.toLowerCase().includes(word));
    if (hasTransitions) coherenceScore += 0.3;
    
    // Check for consistent terminology
    const technicalTerms = this.extractTechnicalTerms(content);
    const consistentTerminology = technicalTerms.length > 0 && technicalTerms.length < 20; // Not too few, not too many
    if (consistentTerminology) coherenceScore += 0.4;
    
    // Check for grammatical coherence (simplified)
    const hasProperPunctuation = content.includes('.') && content.includes(',');
    if (hasProperPunctuation) coherenceScore += 0.3;
    
    return Math.min(coherenceScore, 1.0);
  }

  /**
   * Assesses response specificity
   */
  private assessSpecificity(response: LLMResponse): number {
    const content = response.content;
    
    // Look for specific details
    let specificityScore = 0;
    
    // Numbers and measurements
    const hasNumbers = /\d+/.test(content);
    if (hasNumbers) specificityScore += 0.25;
    
    // Technical specifications
    const hasSpecs = /\d+\s*(mm|cm|m|inch|"|'|volt|amp|ohm|watt|hz)/i.test(content);
    if (hasSpecs) specificityScore += 0.25;
    
    // Component names and model numbers
    const hasComponentNames = this.containsComponentNames(content);
    if (hasComponentNames) specificityScore += 0.25;
    
    // Specific locations or references
    const hasLocations = /(top|bottom|left|right|center|corner|position|location)/i.test(content);
    if (hasLocations) specificityScore += 0.25;
    
    return specificityScore;
  }

  /**
   * Assesses response accuracy (based on confidence and consistency)
   */
  private assessAccuracy(response: LLMResponse): number {
    // Use provider confidence as base accuracy measure
    let accuracyScore = response.confidence;
    
    // Adjust based on response characteristics
    const content = response.content;
    
    // Penalty for uncertain language
    const uncertainWords = ['might', 'possibly', 'perhaps', 'unclear', 'difficult to determine'];
    const uncertaintyCount = uncertainWords.reduce((count, word) => 
      count + (content.toLowerCase().split(word).length - 1), 0
    );
    
    accuracyScore *= Math.max(0.5, 1 - uncertaintyCount * 0.1);
    
    // Bonus for confident, specific statements
    const confidentWords = ['clearly', 'definitely', 'precisely', 'exactly', 'specifically'];
    const confidenceCount = confidentWords.reduce((count, word) => 
      count + (content.toLowerCase().split(word).length - 1), 0
    );
    
    accuracyScore = Math.min(1.0, accuracyScore + confidenceCount * 0.05);
    
    return accuracyScore;
  }

  /**
   * Assesses consistency with other responses
   */
  private assessConsistency(response: LLMResponse, allResponses: LLMResponse[]): number {
    if (allResponses.length < 2) return 1.0;
    
    const otherResponses = allResponses.filter(r => r.id !== response.id);
    let totalSimilarity = 0;
    
    for (const other of otherResponses) {
      const similarity = this.calculateSemanticSimilarity(response.content, other.content);
      totalSimilarity += similarity;
    }
    
    return totalSimilarity / otherResponses.length;
  }

  /**
   * Assesses response relevance to the query context
   */
  private assessRelevance(response: LLMResponse): number {
    const content = response.content;
    
    // Check for electrical/technical relevance
    const electricalTerms = [
      'circuit', 'component', 'wire', 'connection', 'voltage', 'current',
      'resistor', 'capacitor', 'inductor', 'transformer', 'switch', 'relay',
      'schematic', 'diagram', 'drawing', 'blueprint'
    ];
    
    const termCount = electricalTerms.reduce((count, term) => 
      count + (content.toLowerCase().split(term).length - 1), 0
    );
    
    // Normalize by content length
    const relevanceScore = Math.min(1.0, termCount / 5);
    
    return relevanceScore;
  }

  /**
   * Calculates overall quality score
   */
  private calculateOverallScore(qualityScores: QualityScores): number {
    const config = this.config.qualityMetrics;
    
    const weightedSum = 
      qualityScores.completeness * config.completeness.weight +
      qualityScores.coherence * config.coherence.weight +
      qualityScores.specificity * config.specificity.weight +
      qualityScores.accuracy * config.accuracy.weight +
      qualityScores.consistency * config.consistency.weight +
      qualityScores.relevance * config.relevance.weight;
    
    const totalWeight = Object.values(config).reduce((sum, metric) => sum + metric.weight, 0);
    
    return weightedSum / totalWeight;
  }

  /**
   * Calculates temporal weight for a response
   */
  private calculateTemporalWeight(response: LLMResponse): number {
    if (!this.config.temporalWeighting) return 1.0;
    
    const now = new Date();
    const responseTime = response.timestamp;
    const ageInMinutes = (now.getTime() - responseTime.getTime()) / (1000 * 60);
    
    // Decay factor: responses are fully weighted for first 5 minutes, then decay
    const decayFactor = Math.exp(-ageInMinutes / 30); // 30-minute half-life
    return Math.max(0.1, decayFactor);
  }

  /**
   * Gets provider reputation
   */
  private getProviderReputation(provider: string): number {
    return this.providerReputations.get(provider) || 0.5;
  }

  /**
   * Detects outlier responses
   */
  private async detectOutliers(assessments: QualityAssessment[]): Promise<OutlierInfo[]> {
    const outliers: OutlierInfo[] = [];
    
    if (assessments.length < 3) return outliers; // Need minimum responses for outlier detection
    
    const scores = assessments.map(a => a.overallScore);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    
    // Statistical outliers (z-score > 2.5)
    for (const assessment of assessments) {
      const zScore = Math.abs(assessment.overallScore - mean) / stdDev;
      
      if (zScore > 2.5) {
        outliers.push({
          response: assessment.response,
          deviationType: OutlierType.STATISTICAL,
          deviationScore: zScore,
          reasons: [`Z-score of ${zScore.toFixed(2)} exceeds threshold`],
          handling: this.config.outlierHandling
        });
      }
    }
    
    // Semantic outliers (very different content)
    for (let i = 0; i < assessments.length; i++) {
      const assessment = assessments[i];
      const otherAssessments = assessments.filter((_, index) => index !== i);
      
      let maxSimilarity = 0;
      for (const other of otherAssessments) {
        const similarity = this.calculateSemanticSimilarity(
          assessment.response.content,
          other.response.content
        );
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
      
      if (maxSimilarity < 0.2) { // Very dissimilar to all others
        outliers.push({
          response: assessment.response,
          deviationType: OutlierType.SEMANTIC,
          deviationScore: 1 - maxSimilarity,
          reasons: [`Maximum similarity of ${maxSimilarity.toFixed(2)} to other responses`],
          handling: this.config.outlierHandling
        });
      }
    }
    
    return outliers;
  }

  /**
   * Handles outliers according to configuration
   */
  private handleOutliers(
    assessments: QualityAssessment[],
    outliers: OutlierInfo[]
  ): QualityAssessment[] {
    const outlierIds = new Set(outliers.map(o => o.response.id));
    
    switch (this.config.outlierHandling) {
      case OutlierHandling.EXCLUDE:
        return assessments.filter(a => !outlierIds.has(a.response.id));
      
      case OutlierHandling.WEIGHT_DOWN:
        return assessments.map(a => {
          if (outlierIds.has(a.response.id)) {
            return { ...a, overallScore: a.overallScore * 0.5 };
          }
          return a;
        });
      
      case OutlierHandling.INCLUDE:
      case OutlierHandling.SEPARATE_TIER:
      default:
        return assessments;
    }
  }

  /**
   * Normalizes scores across responses
   */
  private normalizeScores(assessments: QualityAssessment[]): QualityAssessment[] {
    if (assessments.length === 0) return assessments;
    
    const scores = assessments.map(a => a.overallScore);
    const normalizedAssessments = [...assessments];
    
    switch (this.config.normalizationMethod) {
      case NormalizationMethod.MIN_MAX:
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        const range = max - min;
        
        if (range > 0) {
          normalizedAssessments.forEach(a => {
            a.overallScore = (a.overallScore - min) / range;
          });
        }
        break;
      
      case NormalizationMethod.Z_SCORE:
        const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        
        if (stdDev > 0) {
          normalizedAssessments.forEach(a => {
            a.overallScore = (a.overallScore - mean) / stdDev;
          });
        }
        break;
      
      case NormalizationMethod.SIGMOID:
        normalizedAssessments.forEach(a => {
          a.overallScore = 1 / (1 + Math.exp(-a.overallScore));
        });
        break;
      
      case NormalizationMethod.PERCENTILE:
        const sortedScores = [...scores].sort((a, b) => a - b);
        normalizedAssessments.forEach(a => {
          const rank = sortedScores.findIndex(score => score >= a.overallScore);
          a.overallScore = rank / (sortedScores.length - 1);
        });
        break;
    }
    
    return normalizedAssessments;
  }

  /**
   * Applies ranking strategy to normalized assessments
   */
  private async applyRankingStrategy(assessments: QualityAssessment[]): Promise<RankedResponse[]> {
    switch (this.config.rankingStrategy) {
      case RankingStrategy.WEIGHTED_SCORE:
        return this.rankByWeightedScore(assessments);
      
      case RankingStrategy.TOURNAMENT:
        return this.rankByTournament(assessments);
      
      case RankingStrategy.PAIRWISE_COMPARISON:
        return this.rankByPairwiseComparison(assessments);
      
      case RankingStrategy.RELATIVE_RANKING:
        return this.rankByRelativeRanking(assessments);
      
      case RankingStrategy.MULTI_CRITERIA:
      default:
        return this.rankByMultiCriteria(assessments);
    }
  }

  /**
   * Ranks responses by weighted score
   */
  private rankByWeightedScore(assessments: QualityAssessment[]): RankedResponse[] {
    // Apply temporal and reputation weighting
    const weightedAssessments = assessments.map(a => ({
      ...a,
      finalScore: a.overallScore * 
        (this.config.temporalWeighting ? a.temporal : 1.0) *
        (this.config.providerReputationWeighting ? a.reputation : 1.0)
    }));
    
    // Sort by final score
    weightedAssessments.sort((a, b) => b.finalScore - a.finalScore);
    
    return weightedAssessments.map((assessment, index) => this.buildRankedResponse(
      assessment,
      index + 1,
      assessment.finalScore
    ));
  }

  /**
   * Ranks responses using multi-criteria approach
   */
  private rankByMultiCriteria(assessments: QualityAssessment[]): RankedResponse[] {
    // For multi-criteria, we consider each quality dimension separately
    const rankedByDimension: Record<keyof QualityScores, QualityAssessment[]> = {
      completeness: [...assessments].sort((a, b) => b.qualityScores.completeness - a.qualityScores.completeness),
      coherence: [...assessments].sort((a, b) => b.qualityScores.coherence - a.qualityScores.coherence),
      specificity: [...assessments].sort((a, b) => b.qualityScores.specificity - a.qualityScores.specificity),
      accuracy: [...assessments].sort((a, b) => b.qualityScores.accuracy - a.qualityScores.accuracy),
      consistency: [...assessments].sort((a, b) => b.qualityScores.consistency - a.qualityScores.consistency),
      relevance: [...assessments].sort((a, b) => b.qualityScores.relevance - a.qualityScores.relevance)
    };
    
    // Calculate composite rank based on average rank across dimensions
    const compositeRanks = new Map<string, number>();
    
    for (const assessment of assessments) {
      let totalRank = 0;
      let totalWeight = 0;
      
      for (const [dimension, sortedAssessments] of Object.entries(rankedByDimension)) {
        const rank = sortedAssessments.findIndex(a => a.response.id === assessment.response.id) + 1;
        const weight = this.config.qualityMetrics[dimension as keyof QualityScores].weight;
        totalRank += rank * weight;
        totalWeight += weight;
      }
      
      compositeRanks.set(assessment.response.id, totalRank / totalWeight);
    }
    
    // Sort by composite rank
    const sortedAssessments = assessments.sort((a, b) => {
      const rankA = compositeRanks.get(a.response.id) || Infinity;
      const rankB = compositeRanks.get(b.response.id) || Infinity;
      return rankA - rankB;
    });
    
    return sortedAssessments.map((assessment, index) => this.buildRankedResponse(
      assessment,
      index + 1,
      assessment.overallScore
    ));
  }

  /**
   * Tournament-style ranking (simplified implementation)
   */
  private rankByTournament(assessments: QualityAssessment[]): RankedResponse[] {
    // Simple tournament: each response competes against all others
    const tournamentResults = new Map<string, number>();
    
    for (const assessment of assessments) {
      let wins = 0;
      for (const competitor of assessments) {
        if (assessment.response.id !== competitor.response.id) {
          if (assessment.overallScore > competitor.overallScore) {
            wins++;
          }
        }
      }
      tournamentResults.set(assessment.response.id, wins);
    }
    
    // Sort by wins
    const sortedAssessments = assessments.sort((a, b) => {
      const winsA = tournamentResults.get(a.response.id) || 0;
      const winsB = tournamentResults.get(b.response.id) || 0;
      return winsB - winsA;
    });
    
    return sortedAssessments.map((assessment, index) => this.buildRankedResponse(
      assessment,
      index + 1,
      assessment.overallScore
    ));
  }

  /**
   * Pairwise comparison ranking (simplified)
   */
  private rankByPairwiseComparison(assessments: QualityAssessment[]): RankedResponse[] {
    // For now, fall back to weighted score ranking
    return this.rankByWeightedScore(assessments);
  }

  /**
   * Relative ranking approach
   */
  private rankByRelativeRanking(assessments: QualityAssessment[]): RankedResponse[] {
    // Sort by overall score
    const sortedAssessments = [...assessments].sort((a, b) => b.overallScore - a.overallScore);
    
    return sortedAssessments.map((assessment, index) => this.buildRankedResponse(
      assessment,
      index + 1,
      assessment.overallScore
    ));
  }

  /**
   * Builds a ranked response object
   */
  private buildRankedResponse(
    assessment: QualityAssessment,
    rank: number,
    finalScore: number
  ): RankedResponse {
    const tier = this.determineQualityTier(finalScore);
    const strengths = this.identifyStrengths(assessment.qualityScores);
    const weaknesses = this.identifyWeaknesses(assessment.qualityScores);
    
    return {
      response: assessment.response,
      rank,
      overallScore: finalScore,
      qualityScores: assessment.qualityScores,
      normalizedScores: assessment.qualityScores, // Already normalized in assessments
      tier,
      strengths,
      weaknesses,
      comparisonDetails: {
        pairwiseComparisons: [],
        relativeRankings: [],
        tournamentResults: []
      }
    };
  }

  /**
   * Determines quality tier for a score
   */
  private determineQualityTier(score: number): QualityTier {
    if (score >= 0.9) return QualityTier.EXCELLENT;
    if (score >= 0.7) return QualityTier.GOOD;
    if (score >= 0.5) return QualityTier.AVERAGE;
    if (score >= 0.3) return QualityTier.POOR;
    return QualityTier.UNACCEPTABLE;
  }

  /**
   * Identifies response strengths
   */
  private identifyStrengths(qualityScores: QualityScores): string[] {
    const strengths: string[] = [];
    const threshold = 0.7;
    
    if (qualityScores.completeness >= threshold) strengths.push('Comprehensive coverage');
    if (qualityScores.coherence >= threshold) strengths.push('Well-structured and coherent');
    if (qualityScores.specificity >= threshold) strengths.push('Specific and detailed');
    if (qualityScores.accuracy >= threshold) strengths.push('High confidence and accuracy');
    if (qualityScores.consistency >= threshold) strengths.push('Consistent with other responses');
    if (qualityScores.relevance >= threshold) strengths.push('Highly relevant to context');
    
    return strengths;
  }

  /**
   * Identifies response weaknesses
   */
  private identifyWeaknesses(qualityScores: QualityScores): string[] {
    const weaknesses: string[] = [];
    const threshold = 0.4;
    
    if (qualityScores.completeness <= threshold) weaknesses.push('Lacks completeness');
    if (qualityScores.coherence <= threshold) weaknesses.push('Poor structure or coherence');
    if (qualityScores.specificity <= threshold) weaknesses.push('Too general or vague');
    if (qualityScores.accuracy <= threshold) weaknesses.push('Low confidence or accuracy');
    if (qualityScores.consistency <= threshold) weaknesses.push('Inconsistent with other responses');
    if (qualityScores.relevance <= threshold) weaknesses.push('Limited relevance to context');
    
    return weaknesses;
  }

  /**
   * Calculates quality distribution statistics
   */
  private calculateQualityDistribution(rankedResponses: RankedResponse[]): QualityDistribution {
    const scores = rankedResponses.map(r => r.overallScore);
    scores.sort((a, b) => a - b);
    
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);
    
    const tierCounts = {
      [QualityTier.EXCELLENT]: 0,
      [QualityTier.GOOD]: 0,
      [QualityTier.AVERAGE]: 0,
      [QualityTier.POOR]: 0,
      [QualityTier.UNACCEPTABLE]: 0
    };
    
    for (const response of rankedResponses) {
      tierCounts[response.tier]++;
    }
    
    return {
      mean,
      median: scores[Math.floor(scores.length / 2)],
      standardDeviation,
      range: { min: scores[0], max: scores[scores.length - 1] },
      percentiles: {
        p25: scores[Math.floor(scores.length * 0.25)],
        p50: scores[Math.floor(scores.length * 0.50)],
        p75: scores[Math.floor(scores.length * 0.75)],
        p90: scores[Math.floor(scores.length * 0.90)],
        p95: scores[Math.floor(scores.length * 0.95)]
      },
      tierDistribution: tierCounts
    };
  }

  /**
   * Builds ranking metadata
   */
  private buildRankingMetadata(
    originalResponses: LLMResponse[],
    rankedResponses: RankedResponse[],
    outliers: OutlierInfo[]
  ): RankingMetadata {
    const scores = rankedResponses.map(r => r.overallScore);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    
    // Calculate ranking confidence based on score distribution
    const rankingConfidence = variance > 0 ? Math.min(1.0, 1 / (1 + variance)) : 1.0;
    
    return {
      strategy: this.config.rankingStrategy,
      totalResponses: originalResponses.length,
      validResponses: rankedResponses.length,
      outlierCount: outliers.length,
      averageScore: mean,
      scoreVariance: variance,
      rankingConfidence
    };
  }

  /**
   * Helper methods for content analysis
   */
  private containsTechnicalTerms(content: string): boolean {
    const technicalTerms = [
      'voltage', 'current', 'resistance', 'capacitance', 'inductance',
      'circuit', 'component', 'schematic', 'diagram', 'wire', 'connection'
    ];
    
    return technicalTerms.some(term => 
      content.toLowerCase().includes(term.toLowerCase())
    );
  }

  private extractTechnicalTerms(content: string): string[] {
    const technicalPatterns = [
      /\b\d+\s*(v|volt|voltage|a|amp|ampere|ohm|watt|hz|hertz)\b/gi,
      /\b(resistor|capacitor|inductor|transformer|diode|transistor|switch|relay)\b/gi,
      /\b(circuit|schematic|diagram|blueprint|drawing)\b/gi
    ];
    
    const terms: string[] = [];
    for (const pattern of technicalPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        terms.push(...matches);
      }
    }
    
    return Array.from(new Set(terms));
  }

  private containsComponentNames(content: string): boolean {
    const componentPatterns = [
      /\b[A-Z]\d+\b/g, // Component references like R1, C2, U1
      /\b(IC|MCU|CPU|FPGA|ASIC)\d*\b/gi,
      /\b\d{2,4}-\d{2,4}(-\d{2,4})?\b/g // Part numbers
    ];
    
    return componentPatterns.some(pattern => pattern.test(content));
  }

  private calculateSemanticSimilarity(text1: string, text2: string): number {
    // Simple word overlap similarity
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private initializeProviderReputations(): void {
    // Initialize with neutral reputation
    const providers = ['openai', 'anthropic', 'google'];
    for (const provider of providers) {
      this.providerReputations.set(provider, 0.5);
    }
  }
}

/**
 * Helper interfaces
 */
interface QualityAssessment {
  response: LLMResponse;
  qualityScores: QualityScores;
  overallScore: number;
  temporal: number;
  reputation: number;
}