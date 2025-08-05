/**
 * Consensus Service
 * 
 * Implements consensus building algorithms for ensemble responses including
 * component identification clustering, text response aggregation, and 
 * confidence-based voting mechanisms.
 */

import { LLMResponse } from '../../../llm-orchestrator/src/providers/base/LLMProvider.interface';

export interface ConsensusConfig {
  readonly componentClusteringThreshold: number;
  readonly textSimilarityThreshold: number;
  readonly minimumAgreementLevel: number;
  readonly votingStrategy: VotingStrategy;
  readonly confidenceWeighting: boolean;
  readonly outlierDetection: boolean;
}

export enum VotingStrategy {
  MAJORITY = 'majority',
  WEIGHTED_MAJORITY = 'weighted_majority',
  CONFIDENCE_WEIGHTED = 'confidence_weighted',
  UNANIMOUS = 'unanimous',
  PLURALITY = 'plurality'
}

export interface ConsensusResult {
  readonly agreementLevel: number;
  readonly consensusContent: string;
  readonly disagreements: string[];
  readonly votingResults: VotingResult[];
  readonly outliers: OutlierDetection[];
  readonly confidence: number;
}

export interface VotingResult {
  readonly topic: string;
  readonly candidates: VotingCandidate[];
  readonly winner: VotingCandidate;
  readonly votingStrategy: VotingStrategy;
  readonly metadata: VotingMetadata;
}

export interface VotingCandidate {
  readonly content: string;
  readonly votes: Vote[];
  readonly totalWeight: number;
  readonly confidence: number;
  readonly supportingProviders: string[];
}

export interface Vote {
  readonly provider: string;
  readonly weight: number;
  readonly confidence: number;
  readonly similarity: number;
}

export interface VotingMetadata {
  readonly totalVoters: number;
  readonly participationRate: number;
  readonly consensusStrength: number;
  readonly disagreementLevel: number;
}

export interface OutlierDetection {
  readonly provider: string;
  readonly response: string;
  readonly deviationScore: number;
  readonly reasons: string[];
}

export interface ComponentConsensus {
  readonly components: ConsensusComponent[];
  readonly agreementLevel: number;
  readonly clusters: ComponentCluster[];
  readonly disagreements: ComponentDisagreement[];
}

export interface ConsensusComponent {
  readonly id: string;
  readonly type: string;
  readonly location: ConsensusLocation;
  readonly confidence: number;
  readonly supportingProviders: string[];
  readonly providerAgreement: number;
  readonly properties: Record<string, ConsensusValue>;
}

export interface ConsensusLocation {
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly confidence: number;
  readonly variance: LocationVariance;
}

export interface LocationVariance {
  readonly xVariance: number;
  readonly yVariance: number;
  readonly widthVariance?: number;
  readonly heightVariance?: number;
}

export interface ConsensusValue {
  readonly value: any;
  readonly confidence: number;
  readonly agreement: number;
  readonly alternatives: Array<{ value: any; support: number }>;
}

export interface ComponentCluster {
  readonly id: string;
  readonly components: ComponentIdentification[];
  readonly centroid: { x: number; y: number };
  readonly variance: number;
  readonly consensusComponent: ConsensusComponent;
}

export interface ComponentIdentification {
  readonly provider: string;
  readonly id: string;
  readonly type: string;
  readonly location: { x: number; y: number; width?: number; height?: number };
  readonly confidence: number;
  readonly properties: Record<string, any>;
}

export interface ComponentDisagreement {
  readonly topic: string;
  readonly conflictingComponents: ComponentIdentification[];
  readonly disagreementLevel: number;
  readonly resolutionStrategy: string;
}

/**
 * Consensus Service Implementation
 */
export class ConsensusService {
  private config: ConsensusConfig;

  constructor(config: ConsensusConfig) {
    this.config = config;
  }

  /**
   * Builds consensus from multiple LLM responses
   */
  public async buildConsensus(responses: LLMResponse[]): Promise<ConsensusResult> {
    if (responses.length === 0) {
      throw new Error('Cannot build consensus from empty response set');
    }

    if (responses.length === 1) {
      return this.buildSingleResponseConsensus(responses[0]);
    }

    console.log(`🤝 Building consensus from ${responses.length} responses`);

    // Extract and categorize content from responses
    const extractedContent = await this.extractContentForConsensus(responses);

    // Build voting results for different topics
    const votingResults = await this.conductVoting(extractedContent);

    // Detect outliers if enabled
    const outliers = this.config.outlierDetection 
      ? await this.detectOutliers(responses, extractedContent)
      : [];

    // Build consensus content
    const consensusContent = await this.buildConsensusContent(votingResults);

    // Calculate overall agreement level
    const agreementLevel = this.calculateAgreementLevel(votingResults);

    // Extract disagreements
    const disagreements = this.extractDisagreements(votingResults);

    // Calculate overall confidence
    const confidence = this.calculateConsensusConfidence(votingResults, agreementLevel);

    return {
      agreementLevel,
      consensusContent,
      disagreements,
      votingResults,
      outliers,
      confidence
    };
  }

  /**
   * Builds component consensus from multiple provider responses
   */
  public async buildComponentConsensus(
    componentsByProvider: Map<string, ComponentIdentification[]>
  ): Promise<ComponentConsensus> {
    console.log(`🔧 Building component consensus from ${componentsByProvider.size} providers`);

    // Cluster similar components across providers
    const clusters = await this.clusterComponents(componentsByProvider);

    // Build consensus components from clusters
    const components = await this.buildConsensusComponents(clusters);

    // Calculate overall agreement level
    const agreementLevel = this.calculateComponentAgreementLevel(clusters);

    // Identify disagreements
    const disagreements = this.identifyComponentDisagreements(clusters);

    return {
      components,
      agreementLevel,
      clusters,
      disagreements
    };
  }

  /**
   * Extracts content from responses for consensus building
   */
  private async extractContentForConsensus(responses: LLMResponse[]): Promise<ExtractedContent> {
    const textContent: Array<{ provider: string; content: string; confidence: number }> = [];
    const structuredContent: Map<string, Array<{ provider: string; data: any; confidence: number }>> = new Map();

    for (const response of responses) {
      // Extract main text content
      textContent.push({
        provider: response.model,
        content: response.content,
        confidence: response.confidence
      });

      // Extract structured data if available in metadata
      if (response.metadata) {
        for (const [key, value] of Object.entries(response.metadata)) {
          if (!structuredContent.has(key)) {
            structuredContent.set(key, []);
          }
          structuredContent.get(key)!.push({
            provider: response.model,
            data: value,
            confidence: response.confidence
          });
        }
      }
    }

    return { textContent, structuredContent };
  }

  /**
   * Conducts voting on extracted content
   */
  private async conductVoting(extractedContent: ExtractedContent): Promise<VotingResult[]> {
    const votingResults: VotingResult[] = [];

    // Vote on main text content
    const textVoting = await this.voteOnTextContent(extractedContent.textContent);
    votingResults.push(textVoting);

    // Vote on structured content
    for (const [topic, content] of extractedContent.structuredContent.entries()) {
      const structuredVoting = await this.voteOnStructuredContent(topic, content);
      votingResults.push(structuredVoting);
    }

    return votingResults;
  }

  /**
   * Votes on text content using similarity-based clustering
   */
  private async voteOnTextContent(
    textContent: Array<{ provider: string; content: string; confidence: number }>
  ): Promise<VotingResult> {
    // Group similar text responses
    const clusters = await this.clusterTextResponses(textContent);

    // Convert clusters to voting candidates
    const candidates: VotingCandidate[] = clusters.map(cluster => ({
      content: cluster.representative,
      votes: cluster.members.map(member => ({
        provider: member.provider,
        weight: this.config.confidenceWeighting ? member.confidence : 1.0,
        confidence: member.confidence,
        similarity: member.similarity
      })),
      totalWeight: cluster.members.reduce((sum, member) => 
        sum + (this.config.confidenceWeighting ? member.confidence : 1.0), 0
      ),
      confidence: cluster.members.reduce((sum, member) => sum + member.confidence, 0) / cluster.members.length,
      supportingProviders: cluster.members.map(member => member.provider)
    }));

    // Determine winner based on voting strategy
    const winner = this.selectWinner(candidates);

    return {
      topic: 'main_response',
      candidates,
      winner,
      votingStrategy: this.config.votingStrategy,
      metadata: {
        totalVoters: textContent.length,
        participationRate: 1.0,
        consensusStrength: winner.totalWeight / textContent.length,
        disagreementLevel: 1 - (candidates.length === 1 ? 1 : winner.totalWeight / textContent.length)
      }
    };
  }

  /**
   * Votes on structured content
   */
  private async voteOnStructuredContent(
    topic: string,
    content: Array<{ provider: string; data: any; confidence: number }>
  ): Promise<VotingResult> {
    // Group identical structured data
    const groupedData = new Map<string, Array<{ provider: string; data: any; confidence: number }>>();

    for (const item of content) {
      const key = JSON.stringify(item.data);
      if (!groupedData.has(key)) {
        groupedData.set(key, []);
      }
      groupedData.get(key)!.push(item);
    }

    // Convert groups to voting candidates
    const candidates: VotingCandidate[] = Array.from(groupedData.entries()).map(([key, items]) => ({
      content: key,
      votes: items.map(item => ({
        provider: item.provider,
        weight: this.config.confidenceWeighting ? item.confidence : 1.0,
        confidence: item.confidence,
        similarity: 1.0 // Exact match for structured data
      })),
      totalWeight: items.reduce((sum, item) => 
        sum + (this.config.confidenceWeighting ? item.confidence : 1.0), 0
      ),
      confidence: items.reduce((sum, item) => sum + item.confidence, 0) / items.length,
      supportingProviders: items.map(item => item.provider)
    }));

    const winner = this.selectWinner(candidates);

    return {
      topic,
      candidates,
      winner,
      votingStrategy: this.config.votingStrategy,
      metadata: {
        totalVoters: content.length,
        participationRate: 1.0,
        consensusStrength: winner.totalWeight / content.length,
        disagreementLevel: 1 - (candidates.length === 1 ? 1 : winner.totalWeight / content.length)
      }
    };
  }

  /**
   * Clusters similar text responses
   */
  private async clusterTextResponses(
    textContent: Array<{ provider: string; content: string; confidence: number }>
  ): Promise<TextCluster[]> {
    const clusters: TextCluster[] = [];

    for (const item of textContent) {
      let assignedToCluster = false;

      // Try to assign to existing cluster
      for (const cluster of clusters) {
        const similarity = this.calculateTextSimilarity(item.content, cluster.representative);
        if (similarity >= this.config.textSimilarityThreshold) {
          cluster.members.push({
            provider: item.provider,
            content: item.content,
            confidence: item.confidence,
            similarity
          });
          assignedToCluster = true;
          break;
        }
      }

      // Create new cluster if not assigned
      if (!assignedToCluster) {
        clusters.push({
          representative: item.content,
          members: [{
            provider: item.provider,
            content: item.content,
            confidence: item.confidence,
            similarity: 1.0
          }]
        });
      }
    }

    return clusters;
  }

  /**
   * Calculates text similarity using simple word overlap
   * (In production, would use more sophisticated NLP similarity measures)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Selects winner based on voting strategy
   */
  private selectWinner(candidates: VotingCandidate[]): VotingCandidate {
    if (candidates.length === 0) {
      throw new Error('Cannot select winner from empty candidates');
    }

    switch (this.config.votingStrategy) {
      case VotingStrategy.MAJORITY:
      case VotingStrategy.WEIGHTED_MAJORITY:
      case VotingStrategy.CONFIDENCE_WEIGHTED:
        return candidates.reduce((winner, candidate) => 
          candidate.totalWeight > winner.totalWeight ? candidate : winner
        );

      case VotingStrategy.PLURALITY:
        return candidates.reduce((winner, candidate) => 
          candidate.votes.length > winner.votes.length ? candidate : winner
        );

      case VotingStrategy.UNANIMOUS:
        // Check if any candidate has all votes
        const totalVoters = Math.max(...candidates.map(c => c.votes.length));
        const unanimousCandidate = candidates.find(c => c.votes.length === totalVoters);
        return unanimousCandidate || candidates[0];

      default:
        return candidates[0];
    }
  }

  /**
   * Clusters components from different providers
   */
  private async clusterComponents(
    componentsByProvider: Map<string, ComponentIdentification[]>
  ): Promise<ComponentCluster[]> {
    const allComponents: ComponentIdentification[] = [];
    
    // Flatten all components
    for (const [provider, components] of componentsByProvider.entries()) {
      for (const component of components) {
        allComponents.push({ ...component, provider });
      }
    }

    const clusters: ComponentCluster[] = [];

    for (const component of allComponents) {
      let assignedToCluster = false;

      // Try to assign to existing cluster
      for (const cluster of clusters) {
        const distance = this.calculateComponentDistance(component, cluster.centroid);
        if (distance <= this.config.componentClusteringThreshold) {
          cluster.components.push(component);
          this.updateClusterCentroid(cluster);
          assignedToCluster = true;
          break;
        }
      }

      // Create new cluster if not assigned
      if (!assignedToCluster) {
        const newCluster: ComponentCluster = {
          id: `cluster_${clusters.length + 1}`,
          components: [component],
          centroid: { x: component.location.x, y: component.location.y },
          variance: 0,
          consensusComponent: {} as ConsensusComponent // Will be built later
        };
        clusters.push(newCluster);
      }
    }

    return clusters;
  }

  /**
   * Calculates distance between a component and cluster centroid
   */
  private calculateComponentDistance(
    component: ComponentIdentification,
    centroid: { x: number; y: number }
  ): number {
    const dx = component.location.x - centroid.x;
    const dy = component.location.y - centroid.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Updates cluster centroid after adding a component
   */
  private updateClusterCentroid(cluster: ComponentCluster): void {
    const components = cluster.components;
    const totalX = components.reduce((sum, comp) => sum + comp.location.x, 0);
    const totalY = components.reduce((sum, comp) => sum + comp.location.y, 0);
    
    cluster.centroid = {
      x: totalX / components.length,
      y: totalY / components.length
    };

    // Calculate variance
    const distances = components.map(comp => 
      this.calculateComponentDistance(comp, cluster.centroid)
    );
    cluster.variance = distances.reduce((sum, dist) => sum + dist * dist, 0) / distances.length;
  }

  /**
   * Builds consensus components from clusters
   */
  private async buildConsensusComponents(clusters: ComponentCluster[]): Promise<ConsensusComponent[]> {
    return clusters.map(cluster => {
      const components = cluster.components;
      
      // Determine consensus type (most common type in cluster)
      const typeVotes = new Map<string, number>();
      for (const comp of components) {
        typeVotes.set(comp.type, (typeVotes.get(comp.type) || 0) + comp.confidence);
      }
      const consensusType = Array.from(typeVotes.entries())
        .reduce((max, [type, votes]) => votes > max.votes ? { type, votes } : max, { type: '', votes: 0 })
        .type;

      // Calculate consensus location
      const avgX = components.reduce((sum, comp) => sum + comp.location.x, 0) / components.length;
      const avgY = components.reduce((sum, comp) => sum + comp.location.y, 0) / components.length;
      
      const xVariance = components.reduce((sum, comp) => sum + Math.pow(comp.location.x - avgX, 2), 0) / components.length;
      const yVariance = components.reduce((sum, comp) => sum + Math.pow(comp.location.y - avgY, 2), 0) / components.length;

      // Calculate consensus confidence
      const avgConfidence = components.reduce((sum, comp) => sum + comp.confidence, 0) / components.length;
      const providerAgreement = components.length / new Set(components.map(c => c.provider)).size;

      const consensusComponent: ConsensusComponent = {
        id: cluster.id,
        type: consensusType,
        location: {
          x: avgX,
          y: avgY,
          confidence: avgConfidence,
          variance: { xVariance, yVariance }
        },
        confidence: avgConfidence,
        supportingProviders: Array.from(new Set(components.map(c => c.provider))),
        providerAgreement,
        properties: this.buildConsensusProperties(components)
      };

      cluster.consensusComponent = consensusComponent;
      return consensusComponent;
    });
  }

  /**
   * Builds consensus properties from component properties
   */
  private buildConsensusProperties(components: ComponentIdentification[]): Record<string, ConsensusValue> {
    const properties: Record<string, ConsensusValue> = {};
    const allPropertyKeys = new Set<string>();

    // Collect all property keys
    for (const comp of components) {
      for (const key of Object.keys(comp.properties)) {
        allPropertyKeys.add(key);
      }
    }

    // Build consensus for each property
    for (const key of allPropertyKeys) {
      const values = components
        .filter(comp => key in comp.properties)
        .map(comp => ({ value: comp.properties[key], confidence: comp.confidence }));

      if (values.length === 0) continue;

      // Group by value
      const valueGroups = new Map<string, Array<{ value: any; confidence: number }>>();
      for (const item of values) {
        const valueKey = JSON.stringify(item.value);
        if (!valueGroups.has(valueKey)) {
          valueGroups.set(valueKey, []);
        }
        valueGroups.get(valueKey)!.push(item);
      }

      // Find consensus value (highest weighted support)
      let maxWeight = 0;
      let consensusValue: any = null;
      const alternatives: Array<{ value: any; support: number }> = [];

      for (const [valueKey, group] of valueGroups.entries()) {
        const weight = group.reduce((sum, item) => sum + item.confidence, 0);
        alternatives.push({ value: group[0].value, support: weight });
        
        if (weight > maxWeight) {
          maxWeight = weight;
          consensusValue = group[0].value;
        }
      }

      properties[key] = {
        value: consensusValue,
        confidence: maxWeight / values.length,
        agreement: maxWeight / values.reduce((sum, item) => sum + item.confidence, 0),
        alternatives: alternatives.filter(alt => alt.value !== consensusValue)
      };
    }

    return properties;
  }

  /**
   * Builds consensus content from voting results
   */
  private async buildConsensusContent(votingResults: VotingResult[]): Promise<string> {
    const mainResponse = votingResults.find(result => result.topic === 'main_response');
    if (mainResponse) {
      return mainResponse.winner.content;
    }
    
    // Fallback: combine all winning content
    return votingResults.map(result => `${result.topic}: ${result.winner.content}`).join('\n');
  }

  /**
   * Calculates overall agreement level
   */
  private calculateAgreementLevel(votingResults: VotingResult[]): number {
    if (votingResults.length === 0) return 0;
    
    const totalConsensusStrength = votingResults.reduce((sum, result) => 
      sum + result.metadata.consensusStrength, 0
    );
    
    return totalConsensusStrength / votingResults.length;
  }

  /**
   * Extracts disagreements from voting results
   */
  private extractDisagreements(votingResults: VotingResult[]): string[] {
    const disagreements: string[] = [];
    
    for (const result of votingResults) {
      if (result.metadata.disagreementLevel > 0.3) { // Threshold for significant disagreement
        const losingCandidates = result.candidates.filter(c => c !== result.winner);
        if (losingCandidates.length > 0) {
          disagreements.push(
            `${result.topic}: ${losingCandidates.length} alternative interpretations with ${result.metadata.disagreementLevel.toFixed(2)} disagreement level`
          );
        }
      }
    }
    
    return disagreements;
  }

  /**
   * Calculates consensus confidence
   */
  private calculateConsensusConfidence(votingResults: VotingResult[], agreementLevel: number): number {
    const avgWinnerConfidence = votingResults.reduce((sum, result) => 
      sum + result.winner.confidence, 0
    ) / votingResults.length;
    
    // Combine winner confidence with agreement level
    return (avgWinnerConfidence + agreementLevel) / 2;
  }

  /**
   * Identifies component disagreements
   */
  private identifyComponentDisagreements(clusters: ComponentCluster[]): ComponentDisagreement[] {
    const disagreements: ComponentDisagreement[] = [];
    
    for (const cluster of clusters) {
      if (cluster.variance > this.config.componentClusteringThreshold * 2) {
        // High variance indicates disagreement on location
        disagreements.push({
          topic: `Component ${cluster.id} location`,
          conflictingComponents: cluster.components,
          disagreementLevel: cluster.variance / (this.config.componentClusteringThreshold * 2),
          resolutionStrategy: 'Centroid averaging with variance weighting'
        });
      }
      
      // Check for type disagreements
      const types = new Set(cluster.components.map(c => c.type));
      if (types.size > 1) {
        disagreements.push({
          topic: `Component ${cluster.id} type`,
          conflictingComponents: cluster.components,
          disagreementLevel: (types.size - 1) / types.size,
          resolutionStrategy: 'Confidence-weighted voting'
        });
      }
    }
    
    return disagreements;
  }

  /**
   * Calculates component agreement level
   */
  private calculateComponentAgreementLevel(clusters: ComponentCluster[]): number {
    if (clusters.length === 0) return 1.0;
    
    // Agreement based on cluster quality
    const avgVariance = clusters.reduce((sum, cluster) => sum + cluster.variance, 0) / clusters.length;
    const normalizedVariance = Math.min(avgVariance / this.config.componentClusteringThreshold, 1.0);
    
    return 1.0 - normalizedVariance;
  }

  /**
   * Detects outlier responses
   */
  private async detectOutliers(
    responses: LLMResponse[],
    extractedContent: ExtractedContent
  ): Promise<OutlierDetection[]> {
    const outliers: OutlierDetection[] = [];
    
    // Simple outlier detection based on content similarity
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const otherResponses = responses.filter((_, index) => index !== i);
      
      let maxSimilarity = 0;
      for (const other of otherResponses) {
        const similarity = this.calculateTextSimilarity(response.content, other.content);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
      
      // If response is very different from all others, mark as outlier
      if (maxSimilarity < 0.3) {
        outliers.push({
          provider: response.model,
          response: response.content,
          deviationScore: 1 - maxSimilarity,
          reasons: ['Low content similarity to other responses']
        });
      }
    }
    
    return outliers;
  }

  /**
   * Builds consensus for single response (no voting needed)
   */
  private buildSingleResponseConsensus(response: LLMResponse): ConsensusResult {
    return {
      agreementLevel: 1.0,
      consensusContent: response.content,
      disagreements: [],
      votingResults: [{
        topic: 'main_response',
        candidates: [{
          content: response.content,
          votes: [{
            provider: response.model,
            weight: 1.0,
            confidence: response.confidence,
            similarity: 1.0
          }],
          totalWeight: 1.0,
          confidence: response.confidence,
          supportingProviders: [response.model]
        }],
        winner: {
          content: response.content,
          votes: [{
            provider: response.model,
            weight: 1.0,
            confidence: response.confidence,
            similarity: 1.0
          }],
          totalWeight: 1.0,
          confidence: response.confidence,
          supportingProviders: [response.model]
        },
        votingStrategy: this.config.votingStrategy,
        metadata: {
          totalVoters: 1,
          participationRate: 1.0,
          consensusStrength: 1.0,
          disagreementLevel: 0.0
        }
      }],
      outliers: [],
      confidence: response.confidence
    };
  }
}

/**
 * Helper interfaces
 */
interface ExtractedContent {
  textContent: Array<{ provider: string; content: string; confidence: number }>;
  structuredContent: Map<string, Array<{ provider: string; data: any; confidence: number }>>;
}

interface TextCluster {
  representative: string;
  members: Array<{
    provider: string;
    content: string;
    confidence: number;
    similarity: number;
  }>;
}