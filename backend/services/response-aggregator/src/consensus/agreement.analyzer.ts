/**
 * Advanced Agreement Analysis Engine
 * 
 * Implements sophisticated inter-model agreement analysis using semantic similarity,
 * statistical measures, and correlation coefficients for consensus quantification.
 */

import { LLMResponse } from '../../../llm-orchestrator/src/providers/base/LLMProvider.interface';

export interface AgreementMeasures {
  readonly semanticSimilarity: number;
  readonly structuralSimilarity: number;
  readonly correlationCoefficient: CorrelationCoefficients;
  readonly variance: VarianceMeasures;
  readonly entropy: EntropyMeasures;
}

export interface CorrelationCoefficients {
  readonly pearson: number;
  readonly spearman: number;
  readonly kendall: number;
}

export interface VarianceMeasures {
  readonly confidenceVariance: number;
  readonly responseTimeVariance: number;
  readonly contentLengthVariance: number;
  readonly tokenUsageVariance: number;
}

export interface EntropyMeasures {
  readonly informationEntropy: number;
  readonly responseDistributionEntropy: number;
  readonly confidenceDistributionEntropy: number;
}

export interface DisagreementAnalysis {
  readonly outliers: OutlierResponse[];
  readonly conflictAreas: ConflictArea[];
  readonly disagreementScore: number;
  readonly consensus: ConsensusStrength;
}

export interface OutlierResponse {
  readonly responseId: string;
  readonly provider: string;
  readonly deviationScore: number;
  readonly outlierType: OutlierType;
  readonly reasons: string[];
}

export enum OutlierType {
  SEMANTIC = 'semantic',
  STATISTICAL = 'statistical',
  STRUCTURAL = 'structural',
  CONFIDENCE = 'confidence'
}

export interface ConflictArea {
  readonly area: string;
  readonly conflictingResponses: string[];
  readonly severity: ConflictSeverity;
  readonly description: string;
}

export enum ConflictSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ConsensusStrength {
  readonly overall: number;
  readonly semantic: number;
  readonly statistical: number;
  readonly structural: number;
}

export interface AgreementConfig {
  readonly semanticSimilarityThreshold: number;
  readonly correlationMinimum: number;
  readonly entropyWeighting: number;
  readonly varianceThreshold: number;
  readonly outlierDetectionThreshold: number;
  readonly conflictDetectionSensitivity: number;
}

/**
 * Advanced Agreement Analyzer Implementation
 */
export class AgreementAnalyzer {
  private config: AgreementConfig;

  constructor(config: AgreementConfig) {
    this.config = config;
  }

  /**
   * Calculates comprehensive inter-model agreement measures
   */
  public calculateInterModelAgreement(responses: LLMResponse[]): AgreementMeasures {
    console.log(`🔍 Analyzing agreement across ${responses.length} responses`);

    if (responses.length < 2) {
      return this.buildMinimalAgreement();
    }

    // Calculate semantic similarities
    const semanticSimilarity = this.calculateSemanticSimilarity(responses);

    // Calculate structural similarities
    const structuralSimilarity = this.calculateStructuralSimilarity(responses);

    // Calculate correlation coefficients
    const correlationCoefficient = this.calculateCorrelationCoefficients(responses);

    // Calculate variance measures
    const variance = this.calculateVarianceMeasures(responses);

    // Calculate entropy measures
    const entropy = this.calculateEntropyMeasures(responses);

    return {
      semanticSimilarity,
      structuralSimilarity,
      correlationCoefficient,
      variance,
      entropy
    };
  }

  /**
   * Analyzes disagreements and identifies outliers
   */
  public analyzeDisagreements(responses: LLMResponse[]): DisagreementAnalysis {
    console.log(`🔍 Analyzing disagreements in ${responses.length} responses`);

    // Detect outlier responses
    const outliers = this.detectOutliers(responses);

    // Identify conflict areas
    const conflictAreas = this.identifyConflictAreas(responses);

    // Calculate overall disagreement score
    const disagreementScore = this.calculateDisagreementScore(responses, outliers, conflictAreas);

    // Assess consensus strength
    const consensus = this.assessConsensusStrength(responses);

    return {
      outliers,
      conflictAreas,
      disagreementScore,
      consensus
    };
  }

  /**
   * Calculates semantic similarity across all response pairs
   */
  private calculateSemanticSimilarity(responses: LLMResponse[]): number {
    const similarities: number[] = [];

    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const similarity = this.calculatePairwiseSemanticSimilarity(
          responses[i].content,
          responses[j].content
        );
        similarities.push(similarity);
      }
    }

    return similarities.length > 0 
      ? similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length
      : 1.0;
  }

  /**
   * Calculates pairwise semantic similarity using advanced word overlap and context analysis
   */
  private calculatePairwiseSemanticSimilarity(content1: string, content2: string): number {
    // Tokenize and normalize content
    const tokens1 = this.tokenizeContent(content1);
    const tokens2 = this.tokenizeContent(content2);

    // Calculate word overlap similarity (Jaccard)
    const jaccardSimilarity = this.calculateJaccardSimilarity(tokens1, tokens2);

    // Calculate cosine similarity using TF-IDF weights
    const cosineSimilarity = this.calculateCosineSimilarity(tokens1, tokens2);

    // Calculate n-gram similarity for context preservation
    const ngramSimilarity = this.calculateNGramSimilarity(content1, content2);

    // Weighted combination
    return (jaccardSimilarity * 0.3 + cosineSimilarity * 0.5 + ngramSimilarity * 0.2);
  }

  /**
   * Tokenizes content into normalized words
   */
  private tokenizeContent(content: string): string[] {
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

  /**
   * Calculates Jaccard similarity coefficient
   */
  private calculateJaccardSimilarity(tokens1: string[], tokens2: string[]): number {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    
    const intersection = new Set([...set1].filter(token => set2.has(token)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculates cosine similarity with TF-IDF weighting
   */
  private calculateCosineSimilarity(tokens1: string[], tokens2: string[]): number {
    const vocab = new Set([...tokens1, ...tokens2]);
    
    // Calculate term frequencies
    const tf1 = this.calculateTermFrequencies(tokens1, vocab);
    const tf2 = this.calculateTermFrequencies(tokens2, vocab);
    
    // Calculate cosine similarity
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (const term of vocab) {
      const freq1 = tf1.get(term) || 0;
      const freq2 = tf2.get(term) || 0;
      
      dotProduct += freq1 * freq2;
      magnitude1 += freq1 * freq1;
      magnitude2 += freq2 * freq2;
    }
    
    const magnitude = Math.sqrt(magnitude1) * Math.sqrt(magnitude2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  /**
   * Calculates term frequencies for vocabulary
   */
  private calculateTermFrequencies(tokens: string[], vocab: Set<string>): Map<string, number> {
    const frequencies = new Map<string, number>();
    
    for (const term of vocab) {
      const count = tokens.filter(token => token === term).length;
      frequencies.set(term, count / tokens.length);
    }
    
    return frequencies;
  }

  /**
   * Calculates n-gram similarity for context preservation
   */
  private calculateNGramSimilarity(content1: string, content2: string): number {
    const n = 3; // Use trigrams
    const ngrams1 = this.generateNGrams(content1, n);
    const ngrams2 = this.generateNGrams(content2, n);
    
    return this.calculateJaccardSimilarity(ngrams1, ngrams2);
  }

  /**
   * Generates n-grams from content
   */
  private generateNGrams(content: string, n: number): string[] {
    const words = content.toLowerCase().split(/\s+/);
    const ngrams: string[] = [];
    
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(' '));
    }
    
    return ngrams;
  }

  /**
   * Calculates structural similarity based on response format and organization
   */
  private calculateStructuralSimilarity(responses: LLMResponse[]): number {
    const structuralFeatures = responses.map(response => this.extractStructuralFeatures(response));
    
    const similarities: number[] = [];
    
    for (let i = 0; i < structuralFeatures.length; i++) {
      for (let j = i + 1; j < structuralFeatures.length; j++) {
        const similarity = this.compareStructuralFeatures(
          structuralFeatures[i],
          structuralFeatures[j]
        );
        similarities.push(similarity);
      }
    }
    
    return similarities.length > 0 
      ? similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length
      : 1.0;
  }

  /**
   * Extracts structural features from response
   */
  private extractStructuralFeatures(response: LLMResponse): StructuralFeatures {
    const content = response.content;
    
    return {
      sentenceCount: content.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
      paragraphCount: content.split(/\n\s*\n/).filter(p => p.trim().length > 0).length,
      wordCount: content.split(/\s+/).filter(w => w.length > 0).length,
      averageSentenceLength: this.calculateAverageSentenceLength(content),
      technicalTermDensity: this.calculateTechnicalTermDensity(content),
      structuralPatterns: this.identifyStructuralPatterns(content)
    };
  }

  /**
   * Calculates average sentence length
   */
  private calculateAverageSentenceLength(content: string): number {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 0;
    
    const totalWords = sentences.reduce((sum, sentence) => {
      return sum + sentence.split(/\s+/).filter(w => w.length > 0).length;
    }, 0);
    
    return totalWords / sentences.length;
  }

  /**
   * Calculates technical term density
   */
  private calculateTechnicalTermDensity(content: string): number {
    const technicalPatterns = [
      /\b\d+\s*(v|volt|a|amp|ohm|watt|hz)\b/gi,
      /\b[A-Z]\d+\b/g, // Component references
      /\b\d+(\.\d+)?\s*(mm|cm|inch|")\b/gi, // Measurements
      /\b(circuit|component|electrical|voltage|current|resistance)\b/gi
    ];
    
    const words = content.split(/\s+/).filter(w => w.length > 0);
    let technicalTerms = 0;
    
    for (const pattern of technicalPatterns) {
      const matches = content.match(pattern);
      if (matches) technicalTerms += matches.length;
    }
    
    return words.length > 0 ? technicalTerms / words.length : 0;
  }

  /**
   * Identifies structural patterns in content
   */
  private identifyStructuralPatterns(content: string): StructuralPattern[] {
    const patterns: StructuralPattern[] = [];
    
    // Check for bullet points or lists
    if (/^\s*[-*•]\s+/m.test(content)) {
      patterns.push(StructuralPattern.BULLET_POINTS);
    }
    
    // Check for numbered lists
    if (/^\s*\d+\.\s+/m.test(content)) {
      patterns.push(StructuralPattern.NUMBERED_LIST);
    }
    
    // Check for section headers
    if (/^[A-Z][^.!?]*:$/m.test(content)) {
      patterns.push(StructuralPattern.SECTION_HEADERS);
    }
    
    // Check for component references
    if (/\b[A-Z]\d+\b/.test(content)) {
      patterns.push(StructuralPattern.COMPONENT_REFERENCES);
    }
    
    // Check for measurements
    if (/\b\d+(\.\d+)?\s*(mm|cm|inch|v|a|ohm)\b/i.test(content)) {
      patterns.push(StructuralPattern.TECHNICAL_MEASUREMENTS);
    }
    
    return patterns;
  }

  /**
   * Compares structural features between two responses
   */
  private compareStructuralFeatures(features1: StructuralFeatures, features2: StructuralFeatures): number {
    // Normalize features for comparison
    const maxSentenceCount = Math.max(features1.sentenceCount, features2.sentenceCount) || 1;
    const maxParagraphCount = Math.max(features1.paragraphCount, features2.paragraphCount) || 1;
    const maxWordCount = Math.max(features1.wordCount, features2.wordCount) || 1;
    
    const sentenceSimilarity = 1 - Math.abs(features1.sentenceCount - features2.sentenceCount) / maxSentenceCount;
    const paragraphSimilarity = 1 - Math.abs(features1.paragraphCount - features2.paragraphCount) / maxParagraphCount;
    const wordCountSimilarity = 1 - Math.abs(features1.wordCount - features2.wordCount) / maxWordCount;
    const sentenceLengthSimilarity = 1 - Math.abs(features1.averageSentenceLength - features2.averageSentenceLength) / 
      Math.max(features1.averageSentenceLength, features2.averageSentenceLength, 1);
    const technicalDensitySimilarity = 1 - Math.abs(features1.technicalTermDensity - features2.technicalTermDensity);
    
    // Pattern similarity
    const commonPatterns = features1.structuralPatterns.filter(p => features2.structuralPatterns.includes(p));
    const totalPatterns = new Set([...features1.structuralPatterns, ...features2.structuralPatterns]);
    const patternSimilarity = totalPatterns.size > 0 ? commonPatterns.length / totalPatterns.size : 1;
    
    // Weighted average
    return (
      sentenceSimilarity * 0.15 +
      paragraphSimilarity * 0.15 +
      wordCountSimilarity * 0.2 +
      sentenceLengthSimilarity * 0.15 +
      technicalDensitySimilarity * 0.15 +
      patternSimilarity * 0.2
    );
  }

  /**
   * Calculates correlation coefficients between responses
   */
  private calculateCorrelationCoefficients(responses: LLMResponse[]): CorrelationCoefficients {
    // Extract numerical features for correlation analysis
    const features = responses.map(response => ({
      confidence: response.confidence,
      responseTime: response.responseTime,
      tokensUsed: response.tokensUsed,
      contentLength: response.content.length
    }));

    const pearson = this.calculatePearsonCorrelation(features);
    const spearman = this.calculateSpearmanCorrelation(features);
    const kendall = this.calculateKendallCorrelation(features);

    return { pearson, spearman, kendall };
  }

  /**
   * Calculates Pearson correlation coefficient
   */
  private calculatePearsonCorrelation(features: Array<{ confidence: number; responseTime: number; tokensUsed: number; contentLength: number }>): number {
    if (features.length < 2) return 1.0;
    
    // Calculate correlation between confidence and content quality metrics
    const confidences = features.map(f => f.confidence);
    const contentLengths = features.map(f => f.contentLength);
    
    return this.pearsonCorrelation(confidences, contentLengths);
  }

  /**
   * Helper method for Pearson correlation calculation
   */
  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n !== y.length || n < 2) return 0;
    
    const meanX = x.reduce((sum, val) => sum + val, 0) / n;
    const meanY = y.reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let sumXSquared = 0;
    let sumYSquared = 0;
    
    for (let i = 0; i < n; i++) {
      const deltaX = x[i] - meanX;
      const deltaY = y[i] - meanY;
      
      numerator += deltaX * deltaY;
      sumXSquared += deltaX * deltaX;
      sumYSquared += deltaY * deltaY;
    }
    
    const denominator = Math.sqrt(sumXSquared * sumYSquared);
    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Calculates Spearman rank correlation
   */
  private calculateSpearmanCorrelation(features: Array<{ confidence: number; responseTime: number; tokensUsed: number; contentLength: number }>): number {
    if (features.length < 2) return 1.0;
    
    // Rank confidence and content length
    const confidenceRanks = this.calculateRanks(features.map(f => f.confidence));
    const lengthRanks = this.calculateRanks(features.map(f => f.contentLength));
    
    return this.pearsonCorrelation(confidenceRanks, lengthRanks);
  }

  /**
   * Calculates ranks for Spearman correlation
   */
  private calculateRanks(values: number[]): number[] {
    const indexed = values.map((value, index) => ({ value, index }));
    indexed.sort((a, b) => a.value - b.value);
    
    const ranks = new Array(values.length);
    for (let i = 0; i < indexed.length; i++) {
      ranks[indexed[i].index] = i + 1;
    }
    
    return ranks;
  }

  /**
   * Calculates Kendall's tau correlation
   */
  private calculateKendallCorrelation(features: Array<{ confidence: number; responseTime: number; tokensUsed: number; contentLength: number }>): number {
    if (features.length < 2) return 1.0;
    
    const x = features.map(f => f.confidence);
    const y = features.map(f => f.contentLength);
    
    let concordant = 0;
    let discordant = 0;
    const n = x.length;
    
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const xDiff = Math.sign(x[i] - x[j]);
        const yDiff = Math.sign(y[i] - y[j]);
        
        if (xDiff * yDiff > 0) concordant++;
        else if (xDiff * yDiff < 0) discordant++;
      }
    }
    
    const totalPairs = (n * (n - 1)) / 2;
    return totalPairs > 0 ? (concordant - discordant) / totalPairs : 0;
  }

  /**
   * Calculates variance measures across responses
   */
  private calculateVarianceMeasures(responses: LLMResponse[]): VarianceMeasures {
    const confidences = responses.map(r => r.confidence);
    const responseTimes = responses.map(r => r.responseTime);
    const contentLengths = responses.map(r => r.content.length);
    const tokenUsages = responses.map(r => r.tokensUsed);

    return {
      confidenceVariance: this.calculateVariance(confidences),
      responseTimeVariance: this.calculateVariance(responseTimes),
      contentLengthVariance: this.calculateVariance(contentLengths),
      tokenUsageVariance: this.calculateVariance(tokenUsages)
    };
  }

  /**
   * Calculates variance for a dataset
   */
  private calculateVariance(values: number[]): number {
    if (values.length < 2) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDifferences = values.map(val => Math.pow(val - mean, 2));
    
    return squaredDifferences.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculates entropy measures for response distribution
   */
  private calculateEntropyMeasures(responses: LLMResponse[]): EntropyMeasures {
    const informationEntropy = this.calculateInformationEntropy(responses);
    const responseDistributionEntropy = this.calculateResponseDistributionEntropy(responses);
    const confidenceDistributionEntropy = this.calculateConfidenceDistributionEntropy(responses);

    return {
      informationEntropy,
      responseDistributionEntropy,
      confidenceDistributionEntropy
    };
  }

  /**
   * Calculates information entropy of response content
   */
  private calculateInformationEntropy(responses: LLMResponse[]): number {
    // Combine all content and calculate word frequency distribution
    const allContent = responses.map(r => r.content).join(' ');
    const words = this.tokenizeContent(allContent);
    
    // Calculate word frequencies
    const frequencies = new Map<string, number>();
    for (const word of words) {
      frequencies.set(word, (frequencies.get(word) || 0) + 1);
    }
    
    // Calculate entropy
    let entropy = 0;
    const totalWords = words.length;
    
    for (const count of frequencies.values()) {
      const probability = count / totalWords;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }
    
    return entropy;
  }

  /**
   * Calculates response distribution entropy
   */
  private calculateResponseDistributionEntropy(responses: LLMResponse[]): number {
    // Group responses by similarity clusters
    const clusters = this.clusterResponsesByContent(responses);
    
    // Calculate cluster size distribution entropy
    let entropy = 0;
    const totalResponses = responses.length;
    
    for (const cluster of clusters) {
      const probability = cluster.size / totalResponses;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }
    
    return entropy;
  }

  /**
   * Clusters responses by content similarity for entropy calculation
   */
  private clusterResponsesByContent(responses: LLMResponse[]): Array<{ size: number; representative: string }> {
    const clusters: Array<{ size: number; representative: string }> = [];
    const processed = new Set<string>();
    
    for (const response of responses) {
      if (processed.has(response.id)) continue;
      
      let clusterSize = 1;
      processed.add(response.id);
      
      // Find similar responses
      for (const otherResponse of responses) {
        if (processed.has(otherResponse.id)) continue;
        
        const similarity = this.calculatePairwiseSemanticSimilarity(
          response.content,
          otherResponse.content
        );
        
        if (similarity > this.config.semanticSimilarityThreshold) {
          clusterSize++;
          processed.add(otherResponse.id);
        }
      }
      
      clusters.push({
        size: clusterSize,
        representative: response.content.substring(0, 100)
      });
    }
    
    return clusters;
  }

  /**
   * Calculates confidence distribution entropy
   */
  private calculateConfidenceDistributionEntropy(responses: LLMResponse[]): number {
    // Create confidence bins
    const bins = 10;
    const binCounts = new Array(bins).fill(0);
    
    for (const response of responses) {
      const binIndex = Math.min(bins - 1, Math.floor(response.confidence * bins));
      binCounts[binIndex]++;
    }
    
    // Calculate entropy
    let entropy = 0;
    const totalResponses = responses.length;
    
    for (const count of binCounts) {
      if (count > 0) {
        const probability = count / totalResponses;
        entropy -= probability * Math.log2(probability);
      }
    }
    
    return entropy / Math.log2(bins); // Normalize to 0-1
  }

  /**
   * Detects outlier responses using multiple criteria
   */
  private detectOutliers(responses: LLMResponse[]): OutlierResponse[] {
    const outliers: OutlierResponse[] = [];
    
    // Semantic outliers
    const semanticOutliers = this.detectSemanticOutliers(responses);
    outliers.push(...semanticOutliers);
    
    // Statistical outliers
    const statisticalOutliers = this.detectStatisticalOutliers(responses);
    outliers.push(...statisticalOutliers);
    
    // Structural outliers
    const structuralOutliers = this.detectStructuralOutliers(responses);
    outliers.push(...structuralOutliers);
    
    // Confidence outliers
    const confidenceOutliers = this.detectConfidenceOutliers(responses);
    outliers.push(...confidenceOutliers);
    
    return outliers;
  }

  /**
   * Detects semantic outliers based on content similarity
   */
  private detectSemanticOutliers(responses: LLMResponse[]): OutlierResponse[] {
    const outliers: OutlierResponse[] = [];
    
    for (const response of responses) {
      const otherResponses = responses.filter(r => r.id !== response.id);
      let maxSimilarity = 0;
      
      for (const other of otherResponses) {
        const similarity = this.calculatePairwiseSemanticSimilarity(
          response.content,
          other.content
        );
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
      
      const deviationScore = 1 - maxSimilarity;
      if (deviationScore > this.config.outlierDetectionThreshold) {
        outliers.push({
          responseId: response.id,
          provider: response.model,
          deviationScore,
          outlierType: OutlierType.SEMANTIC,
          reasons: [`Low semantic similarity (${maxSimilarity.toFixed(3)}) to other responses`]
        });
      }
    }
    
    return outliers;
  }

  /**
   * Detects statistical outliers using z-score analysis
   */
  private detectStatisticalOutliers(responses: LLMResponse[]): OutlierResponse[] {
    const outliers: OutlierResponse[] = [];
    
    // Analyze confidence values
    const confidences = responses.map(r => r.confidence);
    const confidenceMean = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    const confidenceStd = Math.sqrt(this.calculateVariance(confidences));
    
    for (const response of responses) {
      const zScore = confidenceStd > 0 ? Math.abs(response.confidence - confidenceMean) / confidenceStd : 0;
      
      if (zScore > 2.5) { // 2.5 standard deviations threshold
        outliers.push({
          responseId: response.id,
          provider: response.model,
          deviationScore: zScore / 3, // Normalize to 0-1 range
          outlierType: OutlierType.STATISTICAL,
          reasons: [`Confidence z-score: ${zScore.toFixed(2)}`]
        });
      }
    }
    
    return outliers;
  }

  /**
   * Detects structural outliers based on response format
   */
  private detectStructuralOutliers(responses: LLMResponse[]): OutlierResponse[] {
    const outliers: OutlierResponse[] = [];
    const features = responses.map(r => this.extractStructuralFeatures(r));
    
    // Calculate average structural features
    const avgWordCount = features.reduce((sum, f) => sum + f.wordCount, 0) / features.length;
    const avgSentenceCount = features.reduce((sum, f) => sum + f.sentenceCount, 0) / features.length;
    const avgTechnicalDensity = features.reduce((sum, f) => sum + f.technicalTermDensity, 0) / features.length;
    
    for (let i = 0; i < responses.length; i++) {
      const feature = features[i];
      const response = responses[i];
      
      const reasons: string[] = [];
      let deviationScore = 0;
      
      // Check word count deviation
      const wordCountDev = Math.abs(feature.wordCount - avgWordCount) / Math.max(avgWordCount, 1);
      if (wordCountDev > 0.5) {
        reasons.push(`Word count deviation: ${wordCountDev.toFixed(2)}`);
        deviationScore = Math.max(deviationScore, wordCountDev);
      }
      
      // Check technical density deviation
      const techDensityDev = Math.abs(feature.technicalTermDensity - avgTechnicalDensity);
      if (techDensityDev > 0.3) {
        reasons.push(`Technical density deviation: ${techDensityDev.toFixed(2)}`);
        deviationScore = Math.max(deviationScore, techDensityDev);
      }
      
      if (reasons.length > 0 && deviationScore > this.config.outlierDetectionThreshold) {
        outliers.push({
          responseId: response.id,
          provider: response.model,
          deviationScore: Math.min(deviationScore, 1.0),
          outlierType: OutlierType.STRUCTURAL,
          reasons
        });
      }
    }
    
    return outliers;
  }

  /**
   * Detects confidence outliers
   */
  private detectConfidenceOutliers(responses: LLMResponse[]): OutlierResponse[] {
    const outliers: OutlierResponse[] = [];
    const confidences = responses.map(r => r.confidence);
    
    // Use interquartile range method
    const sortedConfidences = [...confidences].sort((a, b) => a - b);
    const q1 = sortedConfidences[Math.floor(sortedConfidences.length * 0.25)];
    const q3 = sortedConfidences[Math.floor(sortedConfidences.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    for (const response of responses) {
      if (response.confidence < lowerBound || response.confidence > upperBound) {
        const deviationScore = response.confidence < lowerBound
          ? (lowerBound - response.confidence) / (q3 - q1 || 1)
          : (response.confidence - upperBound) / (q3 - q1 || 1);
        
        outliers.push({
          responseId: response.id,
          provider: response.model,
          deviationScore: Math.min(deviationScore, 1.0),
          outlierType: OutlierType.CONFIDENCE,
          reasons: [`Confidence ${response.confidence.toFixed(3)} outside IQR bounds [${lowerBound.toFixed(3)}, ${upperBound.toFixed(3)}]`]
        });
      }
    }
    
    return outliers;
  }

  /**
   * Identifies specific conflict areas between responses
   */
  private identifyConflictAreas(responses: LLMResponse[]): ConflictArea[] {
    const conflictAreas: ConflictArea[] = [];
    
    // Analyze content for contradictory statements
    const contradictions = this.findContradictoryStatements(responses);
    conflictAreas.push(...contradictions);
    
    // Analyze technical measurements for conflicts
    const measurementConflicts = this.findMeasurementConflicts(responses);
    conflictAreas.push(...measurementConflicts);
    
    // Analyze component identifications for conflicts
    const componentConflicts = this.findComponentConflicts(responses);
    conflictAreas.push(...componentConflicts);
    
    return conflictAreas;
  }

  /**
   * Finds contradictory statements in responses
   */
  private findContradictoryStatements(responses: LLMResponse[]): ConflictArea[] {
    const conflicts: ConflictArea[] = [];
    
    // Simple contradiction patterns
    const positivePatterns = [
      /\b(yes|correct|true|can|will|is|are|has|have)\b/gi,
      /\b(working|functional|connected|present)\b/gi
    ];
    
    const negativePatterns = [
      /\b(no|not|never|cannot|won't|isn't|aren't|hasn't|haven't)\b/gi,
      /\b(broken|faulty|disconnected|missing|absent)\b/gi
    ];
    
    for (let i = 0; i < responses.length; i++) {
      for (let j = i + 1; j < responses.length; j++) {
        const response1 = responses[i];
        const response2 = responses[j];
        
        const hasPositive1 = positivePatterns.some(pattern => pattern.test(response1.content));
        const hasNegative2 = negativePatterns.some(pattern => pattern.test(response2.content));
        
        const hasNegative1 = negativePatterns.some(pattern => pattern.test(response1.content));
        const hasPositive2 = positivePatterns.some(pattern => pattern.test(response2.content));
        
        if ((hasPositive1 && hasNegative2) || (hasNegative1 && hasPositive2)) {
          conflicts.push({
            area: 'Statement Contradiction',
            conflictingResponses: [response1.id, response2.id],
            severity: ConflictSeverity.MEDIUM,
            description: `Contradictory statements between ${response1.model} and ${response2.model}`
          });
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Finds conflicts in technical measurements
   */
  private findMeasurementConflicts(responses: LLMResponse[]): ConflictArea[] {
    const conflicts: ConflictArea[] = [];
    
    // Extract measurements from each response
    const measurementPattern = /(\d+(?:\.\d+)?)\s*(v|volt|a|amp|ohm|mm|cm|inch)/gi;
    
    const responseMeasurements = responses.map(response => {
      const measurements: Array<{ value: number; unit: string }> = [];
      let match;
      
      while ((match = measurementPattern.exec(response.content)) !== null) {
        measurements.push({
          value: parseFloat(match[1]),
          unit: match[2].toLowerCase()
        });
      }
      
      return { responseId: response.id, provider: response.model, measurements };
    });
    
    // Compare measurements across responses
    for (let i = 0; i < responseMeasurements.length; i++) {
      for (let j = i + 1; j < responseMeasurements.length; j++) {
        const resp1 = responseMeasurements[i];
        const resp2 = responseMeasurements[j];
        
        // Find measurements with same unit but different values
        for (const m1 of resp1.measurements) {
          for (const m2 of resp2.measurements) {
            if (m1.unit === m2.unit) {
              const percentDiff = Math.abs(m1.value - m2.value) / Math.max(m1.value, m2.value);
              
              if (percentDiff > 0.2) { // 20% difference threshold
                const severity = percentDiff > 0.5 ? ConflictSeverity.HIGH : ConflictSeverity.MEDIUM;
                
                conflicts.push({
                  area: 'Technical Measurement',
                  conflictingResponses: [resp1.responseId, resp2.responseId],
                  severity,
                  description: `Measurement conflict: ${m1.value}${m1.unit} vs ${m2.value}${m2.unit} (${(percentDiff * 100).toFixed(1)}% difference)`
                });
              }
            }
          }
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Finds conflicts in component identifications
   */
  private findComponentConflicts(responses: LLMResponse[]): ConflictArea[] {
    const conflicts: ConflictArea[] = [];
    
    // Extract component references from each response
    const componentPattern = /\b([A-Z]\d+)\b/g;
    
    const responseComponents = responses.map(response => {
      const components: string[] = [];
      let match;
      
      while ((match = componentPattern.exec(response.content)) !== null) {
        components.push(match[1]);
      }
      
      return { responseId: response.id, provider: response.model, components: new Set(components) };
    });
    
    // Find responses with significantly different component sets
    for (let i = 0; i < responseComponents.length; i++) {
      for (let j = i + 1; j < responseComponents.length; j++) {
        const resp1 = responseComponents[i];
        const resp2 = responseComponents[j];
        
        const intersection = new Set([...resp1.components].filter(c => resp2.components.has(c)));
        const union = new Set([...resp1.components, ...resp2.components]);
        
        const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 1;
        
        if (jaccardSimilarity < 0.5 && union.size > 2) { // Significant component disagreement
          const severity = jaccardSimilarity < 0.2 ? ConflictSeverity.HIGH : ConflictSeverity.MEDIUM;
          
          conflicts.push({
            area: 'Component Identification',
            conflictingResponses: [resp1.responseId, resp2.responseId],
            severity,
            description: `Component set conflict: ${jaccardSimilarity.toFixed(2)} similarity between identified components`
          });
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Calculates overall disagreement score
   */
  private calculateDisagreementScore(
    responses: LLMResponse[],
    outliers: OutlierResponse[],
    conflictAreas: ConflictArea[]
  ): number {
    if (responses.length <= 1) return 0;
    
    // Base disagreement from outliers
    const outlierScore = outliers.length / responses.length;
    
    // Conflict area score
    const maxPossibleConflicts = (responses.length * (responses.length - 1)) / 2;
    const conflictScore = maxPossibleConflicts > 0 ? conflictAreas.length / maxPossibleConflicts : 0;
    
    // Severity-weighted conflict score
    const severityWeights = {
      [ConflictSeverity.LOW]: 0.25,
      [ConflictSeverity.MEDIUM]: 0.5,
      [ConflictSeverity.HIGH]: 0.75,
      [ConflictSeverity.CRITICAL]: 1.0
    };
    
    const weightedConflictScore = conflictAreas.reduce((sum, conflict) => {
      return sum + severityWeights[conflict.severity];
    }, 0) / Math.max(conflictAreas.length, 1);
    
    // Combined score
    return Math.min(1.0, (outlierScore * 0.4 + conflictScore * 0.3 + weightedConflictScore * 0.3));
  }

  /**
   * Assesses consensus strength across different dimensions
   */
  private assessConsensusStrength(responses: LLMResponse[]): ConsensusStrength {
    if (responses.length <= 1) {
      return { overall: 1.0, semantic: 1.0, statistical: 1.0, structural: 1.0 };
    }
    
    const semantic = this.calculateSemanticSimilarity(responses);
    const structural = this.calculateStructuralSimilarity(responses);
    
    // Statistical consensus based on confidence variance
    const confidences = responses.map(r => r.confidence);
    const confidenceVariance = this.calculateVariance(confidences);
    const statistical = Math.max(0, 1 - confidenceVariance * 4); // Scale variance to 0-1
    
    const overall = (semantic * 0.4 + statistical * 0.3 + structural * 0.3);
    
    return { overall, semantic, statistical, structural };
  }

  /**
   * Builds minimal agreement for single response
   */
  private buildMinimalAgreement(): AgreementMeasures {
    return {
      semanticSimilarity: 1.0,
      structuralSimilarity: 1.0,
      correlationCoefficient: { pearson: 1.0, spearman: 1.0, kendall: 1.0 },
      variance: {
        confidenceVariance: 0,
        responseTimeVariance: 0,
        contentLengthVariance: 0,
        tokenUsageVariance: 0
      },
      entropy: {
        informationEntropy: 0,
        responseDistributionEntropy: 0,
        confidenceDistributionEntropy: 0
      }
    };
  }
}

/**
 * Helper interfaces
 */
interface StructuralFeatures {
  sentenceCount: number;
  paragraphCount: number;
  wordCount: number;
  averageSentenceLength: number;
  technicalTermDensity: number;
  structuralPatterns: StructuralPattern[];
}

enum StructuralPattern {
  BULLET_POINTS = 'bullet_points',
  NUMBERED_LIST = 'numbered_list',
  SECTION_HEADERS = 'section_headers',
  COMPONENT_REFERENCES = 'component_references',
  TECHNICAL_MEASUREMENTS = 'technical_measurements'
}