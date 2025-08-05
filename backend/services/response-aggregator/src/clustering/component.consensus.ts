/**
 * Component Identification Consensus Clustering
 * 
 * Implements spatial and semantic clustering algorithms for component identifications
 * across multiple providers with confidence scoring and consensus building.
 */

import { LLMResponse } from '../../../llm-orchestrator/src/providers/base/LLMProvider.interface';

export interface ComponentConsensusConfig {
  readonly spatialThreshold: number;
  readonly semanticSimilarityThreshold: number;
  readonly minimumClusterSize: number;
  readonly maxClusters: number;
  readonly clusteringAlgorithm: ClusteringAlgorithm;
  readonly confidenceWeighting: boolean;
  readonly outlierHandling: OutlierHandling;
}

export enum ClusteringAlgorithm {
  KMEANS = 'kmeans',
  DBSCAN = 'dbscan',
  HIERARCHICAL = 'hierarchical',
  ADAPTIVE = 'adaptive'
}

export enum OutlierHandling {
  INCLUDE = 'include',
  EXCLUDE = 'exclude',
  SEPARATE_CLUSTER = 'separate_cluster',
  LOW_CONFIDENCE = 'low_confidence'
}

export interface ComponentIdentification {
  readonly id: string;
  readonly provider: string;
  readonly type: string;
  readonly location: ComponentLocation;
  readonly confidence: number;
  readonly properties: Record<string, any>;
  readonly metadata?: ComponentMetadata;
}

export interface ComponentLocation {
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly rotation?: number;
}

export interface ComponentMetadata {
  readonly extractionMethod: string;
  readonly processingTime: number;
  readonly boundingBoxConfidence: number;
  readonly typeConfidence: number;
}

export interface ComponentCluster {
  readonly id: string;
  readonly components: ComponentIdentification[];
  readonly centroid: ClusterCentroid;
  readonly confidence: ClusterConfidence;
  readonly spatialMetrics: SpatialMetrics;
  readonly semanticMetrics: SemanticMetrics;
  readonly consensusComponent: ConsensusComponent;
}

export interface ClusterCentroid {
  readonly location: ComponentLocation;
  readonly type: string;
  readonly properties: Record<string, any>;
  readonly confidence: number;
}

export interface ClusterConfidence {
  readonly overall: number;
  readonly spatial: number;
  readonly semantic: number;
  readonly agreement: number;
  readonly stability: number;
}

export interface SpatialMetrics {
  readonly variance: SpatialVariance;
  readonly cohesion: number;
  readonly separation: number;
  readonly silhouetteScore: number;
  readonly compactness: number;
}

export interface SpatialVariance {
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
}

export interface SemanticMetrics {
  readonly typeConsistency: number;
  readonly propertyAgreement: number;
  readonly descriptionSimilarity: number;
  readonly functionalAlignment: number;
}

export interface ConsensusComponent {
  readonly id: string;
  readonly type: ComponentType;
  readonly location: ConsensusLocation;
  readonly properties: ConsensusProperties;
  readonly confidence: number;
  readonly supportingProviders: string[];
  readonly disagreements: ComponentDisagreement[];
}

export interface ComponentType {
  readonly primary: string;
  readonly alternatives: Array<{ type: string; support: number }>;
  readonly confidence: number;
}

export interface ConsensusLocation {
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  readonly uncertainty: LocationUncertainty;
  readonly confidence: number;
}

export interface LocationUncertainty {
  readonly xRange: [number, number];
  readonly yRange: [number, number];
  readonly widthRange?: [number, number];
  readonly heightRange?: [number, number];
}

export interface ConsensusProperties {
  readonly agreed: Record<string, PropertyConsensus>;
  readonly disputed: Record<string, PropertyDispute>;
  readonly missing: string[];
}

export interface PropertyConsensus {
  readonly value: any;
  readonly confidence: number;
  readonly support: number;
  readonly alternatives: Array<{ value: any; support: number }>;
}

export interface PropertyDispute {
  readonly candidates: Array<{ value: any; support: number; confidence: number }>;
  readonly resolutionStrategy: string;
  readonly resolved: boolean;
}

export interface ComponentDisagreement {
  readonly aspect: DisagreementAspect;
  readonly description: string;
  readonly conflictingProviders: string[];
  readonly severity: DisagreementSeverity;
  readonly resolution: DisagreementResolution;
}

export enum DisagreementAspect {
  LOCATION = 'location',
  TYPE = 'type',
  PROPERTIES = 'properties',
  EXISTENCE = 'existence'
}

export enum DisagreementSeverity {
  MINOR = 'minor',
  MODERATE = 'moderate',
  MAJOR = 'major',
  CRITICAL = 'critical'
}

export interface DisagreementResolution {
  readonly strategy: ResolutionStrategy;
  readonly confidence: number;
  readonly rationale: string;
}

export enum ResolutionStrategy {
  MAJORITY_VOTE = 'majority_vote',
  CONFIDENCE_WEIGHTED = 'confidence_weighted',
  SPATIAL_PROXIMITY = 'spatial_proximity',
  PROVIDER_PRIORITY = 'provider_priority',
  MANUAL_REVIEW = 'manual_review'
}

export interface ComponentConsensusResult {
  readonly clusters: ComponentCluster[];
  readonly consensusComponents: ConsensusComponent[];
  readonly outliers: ComponentIdentification[];
  readonly metrics: ConsensusMetrics;
  readonly summary: ConsensusSummary;
}

export interface ConsensusMetrics {
  readonly totalComponents: number;
  readonly clustersFormed: number;
  readonly averageClusterSize: number;
  readonly overallAgreement: number;
  readonly spatialAgreement: number;
  readonly semanticAgreement: number;
  readonly confidence: number;
}

export interface ConsensusSummary {
  readonly agreedComponents: number;
  readonly disputedComponents: number;
  readonly highConfidenceComponents: number;
  readonly requiresReview: number;
  readonly processingTime: number;
}

/**
 * Component Consensus Clustering Implementation
 */
export class ComponentConsensusClusterer {
  private config: ComponentConsensusConfig;

  constructor(config: ComponentConsensusConfig) {
    this.config = config;
  }

  /**
   * Clusters component identifications and builds consensus
   */
  public async clusterComponents(responses: LLMResponse[]): Promise<ComponentConsensusResult> {
    const startTime = Date.now();
    console.log(`🔧 Clustering components from ${responses.length} provider responses`);

    // Extract all component identifications
    const allComponents = this.extractComponentIdentifications(responses);
    console.log(`📍 Extracted ${allComponents.length} component identifications`);

    if (allComponents.length === 0) {
      return this.buildEmptyResult(startTime);
    }

    // Perform spatial clustering
    const spatialClusters = await this.performSpatialClustering(allComponents);
    console.log(`🗂️ Created ${spatialClusters.length} spatial clusters`);

    // Refine clusters with semantic analysis
    const refinedClusters = await this.refineWithSemanticAnalysis(spatialClusters);
    console.log(`🔍 Refined to ${refinedClusters.length} semantic clusters`);

    // Handle outliers
    const { clusters, outliers } = this.handleOutliers(refinedClusters);

    // Calculate cluster confidence and metrics
    const clustersWithConfidence = await this.calculateClusterConfidence(clusters);

    // Build consensus components
    const consensusComponents = await this.buildConsensusComponents(clustersWithConfidence);

    // Calculate overall metrics
    const metrics = this.calculateConsensusMetrics(clustersWithConfidence, outliers, allComponents);

    // Generate summary
    const summary = this.generateConsensusSummary(consensusComponents, metrics, startTime);

    return {
      clusters: clustersWithConfidence,
      consensusComponents,
      outliers,
      metrics,
      summary
    };
  }

  /**
   * Extracts component identifications from LLM responses
   */
  private extractComponentIdentifications(responses: LLMResponse[]): ComponentIdentification[] {
    const components: ComponentIdentification[] = [];

    for (const response of responses) {
      // Extract components from response metadata or content
      if (response.metadata?.components) {
        const responseComponents = Array.isArray(response.metadata.components) 
          ? response.metadata.components 
          : [response.metadata.components];

        for (const comp of responseComponents) {
          components.push({
            id: `${response.id}_${comp.id || components.length}`,
            provider: response.model,
            type: comp.type || 'unknown',
            location: {
              x: comp.x || comp.location?.x || 0,
              y: comp.y || comp.location?.y || 0,
              width: comp.width || comp.location?.width,
              height: comp.height || comp.location?.height,
              rotation: comp.rotation || comp.location?.rotation
            },
            confidence: comp.confidence || response.confidence,
            properties: comp.properties || {},
            metadata: {
              extractionMethod: comp.extractionMethod || 'llm_response',
              processingTime: response.responseTime,
              boundingBoxConfidence: comp.boundingBoxConfidence || comp.confidence || response.confidence,
              typeConfidence: comp.typeConfidence || comp.confidence || response.confidence
            }
          });
        }
      } else {
        // Try to extract from content using pattern matching
        const extractedComponents = this.extractComponentsFromContent(response);
        components.push(...extractedComponents);
      }
    }

    return components;
  }

  /**
   * Extracts components from response content using pattern matching
   */
  private extractComponentsFromContent(response: LLMResponse): ComponentIdentification[] {
    const components: ComponentIdentification[] = [];
    const content = response.content;

    // Pattern to match component references like "R1", "C2", "U3", etc.
    const componentPattern = /\b([RCLDUQJKM]\d+)\b/g;
    let match;
    let componentIndex = 0;

    while ((match = componentPattern.exec(content)) !== null) {
      const componentRef = match[1];
      const componentType = this.inferComponentType(componentRef);
      
      // Try to extract location information from context
      const location = this.extractLocationFromContext(content, match.index);

      components.push({
        id: `${response.id}_content_${componentIndex++}`,
        provider: response.model,
        type: componentType,
        location: location || { x: 0, y: 0 }, // Default location if not found
        confidence: response.confidence * 0.7, // Reduce confidence for pattern-extracted components
        properties: { reference: componentRef },
        metadata: {
          extractionMethod: 'pattern_matching',
          processingTime: response.responseTime,
          boundingBoxConfidence: 0.3, // Low confidence for location
          typeConfidence: response.confidence * 0.8
        }
      });
    }

    return components;
  }

  /**
   * Infers component type from reference designation
   */
  private inferComponentType(reference: string): string {
    const typeMap: Record<string, string> = {
      'R': 'resistor',
      'C': 'capacitor',
      'L': 'inductor',
      'D': 'diode',
      'U': 'ic',
      'Q': 'transistor',
      'J': 'connector',
      'K': 'relay',
      'M': 'motor'
    };

    const prefix = reference.charAt(0);
    return typeMap[prefix] || 'component';
  }

  /**
   * Attempts to extract location from surrounding content context
   */
  private extractLocationFromContext(content: string, matchIndex: number): ComponentLocation | null {
    // Look for coordinate patterns near the component reference
    const contextWindow = 200; // Characters before and after the match
    const startIndex = Math.max(0, matchIndex - contextWindow);
    const endIndex = Math.min(content.length, matchIndex + contextWindow);
    const context = content.substring(startIndex, endIndex);

    // Pattern to match coordinates like "at (100, 200)" or "x:100, y:200"
    const coordinatePatterns = [
      /(?:at\s*\(|\()\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)/gi,
      /x\s*[:=]\s*(\d+(?:\.\d+)?)\s*,?\s*y\s*[:=]\s*(\d+(?:\.\d+)?)/gi,
      /position\s*[:=]\s*\(?\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)?/gi
    ];

    for (const pattern of coordinatePatterns) {
      const match = pattern.exec(context);
      if (match) {
        return {
          x: parseFloat(match[1]),
          y: parseFloat(match[2])
        };
      }
    }

    return null;
  }

  /**
   * Performs spatial clustering using the configured algorithm
   */
  private async performSpatialClustering(components: ComponentIdentification[]): Promise<ComponentCluster[]> {
    switch (this.config.clusteringAlgorithm) {
      case ClusteringAlgorithm.DBSCAN:
        return this.performDBSCANClustering(components);
      case ClusteringAlgorithm.KMEANS:
        return this.performKMeansClustering(components);
      case ClusteringAlgorithm.HIERARCHICAL:
        return this.performHierarchicalClustering(components);
      case ClusteringAlgorithm.ADAPTIVE:
        return this.performAdaptiveClustering(components);
      default:
        return this.performDBSCANClustering(components);
    }
  }

  /**
   * Performs DBSCAN clustering for spatial grouping
   */
  private async performDBSCANClustering(components: ComponentIdentification[]): Promise<ComponentCluster[]> {
    const clusters: ComponentCluster[] = [];
    const visited = new Set<string>();
    let clusterIndex = 0;

    for (const component of components) {
      if (visited.has(component.id)) continue;

      // Find all components within spatial threshold
      const neighbors = this.findSpatialNeighbors(component, components, this.config.spatialThreshold);
      
      if (neighbors.length >= this.config.minimumClusterSize) {
        // Create a new cluster
        const clusterComponents = [component, ...neighbors.filter(n => !visited.has(n.id))];
        
        // Mark all components as visited
        clusterComponents.forEach(comp => visited.add(comp.id));

        const cluster = await this.createCluster(`dbscan_${clusterIndex++}`, clusterComponents);
        clusters.push(cluster);
      } else {
        visited.add(component.id);
      }
    }

    // Handle noise points (components not in any cluster)
    const noiseComponents = components.filter(comp => !visited.has(comp.id));
    if (noiseComponents.length > 0) {
      const noiseCluster = await this.createCluster('noise_cluster', noiseComponents);
      clusters.push(noiseCluster);
    }

    return clusters;
  }

  /**
   * Performs K-means clustering
   */
  private async performKMeansClustering(components: ComponentIdentification[]): Promise<ComponentCluster[]> {
    const k = Math.min(this.config.maxClusters, Math.ceil(components.length / 3));
    const maxIterations = 100;
    
    // Initialize centroids randomly
    let centroids = this.initializeKMeansCentroids(components, k);
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Assign components to nearest centroid
      const assignments = components.map(comp => this.findNearestCentroid(comp, centroids));
      
      // Update centroids
      const newCentroids = this.updateKMeansCentroids(components, assignments, k);
      
      // Check for convergence
      if (this.centroidsConverged(centroids, newCentroids)) {
        break;
      }
      
      centroids = newCentroids;
    }

    // Create clusters from final assignments
    const clusters: ComponentCluster[] = [];
    const clusterGroups: ComponentIdentification[][] = Array(k).fill(null).map(() => []);
    
    components.forEach((comp, index) => {
      const assignment = this.findNearestCentroid(comp, centroids);
      clusterGroups[assignment].push(comp);
    });

    for (let i = 0; i < k; i++) {
      if (clusterGroups[i].length > 0) {
        const cluster = await this.createCluster(`kmeans_${i}`, clusterGroups[i]);
        clusters.push(cluster);
      }
    }

    return clusters;
  }

  /**
   * Performs hierarchical clustering
   */
  private async performHierarchicalClustering(components: ComponentIdentification[]): Promise<ComponentCluster[]> {
    // Build distance matrix
    const distanceMatrix = this.buildDistanceMatrix(components);
    
    // Create initial clusters (one per component)
    let clusters = components.map((comp, index) => ({
      components: [comp],
      representative: index,
      merged: false
    }));

    // Merge clusters until threshold is reached
    while (clusters.filter(c => !c.merged).length > 1) {
      let minDistance = Infinity;
      let mergeIndices: [number, number] = [0, 0];
      
      // Find closest cluster pair
      for (let i = 0; i < clusters.length; i++) {
        if (clusters[i].merged) continue;
        
        for (let j = i + 1; j < clusters.length; j++) {
          if (clusters[j].merged) continue;
          
          const distance = this.calculateClusterDistance(
            clusters[i], 
            clusters[j], 
            distanceMatrix
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            mergeIndices = [i, j];
          }
        }
      }
      
      // Stop if minimum distance exceeds threshold
      if (minDistance > this.config.spatialThreshold) {
        break;
      }
      
      // Merge clusters
      const [i, j] = mergeIndices;
      clusters[i].components = [...clusters[i].components, ...clusters[j].components];
      clusters[j].merged = true;
    }

    // Convert to ComponentCluster format
    const finalClusters: ComponentCluster[] = [];
    let clusterIndex = 0;
    
    for (const cluster of clusters) {
      if (!cluster.merged && cluster.components.length > 0) {
        const componentCluster = await this.createCluster(`hierarchical_${clusterIndex++}`, cluster.components);
        finalClusters.push(componentCluster);
      }
    }

    return finalClusters;
  }

  /**
   * Performs adaptive clustering based on data characteristics
   */
  private async performAdaptiveClustering(components: ComponentIdentification[]): Promise<ComponentCluster[]> {
    // Analyze data characteristics
    const density = this.calculateComponentDensity(components);
    const distribution = this.analyzeComponentDistribution(components);
    
    // Choose algorithm based on characteristics
    if (density > 0.5 && distribution.uniformity > 0.7) {
      // High density, uniform distribution - use K-means
      return this.performKMeansClustering(components);
    } else if (density < 0.3 || distribution.hasOutliers) {
      // Low density or outliers present - use DBSCAN
      return this.performDBSCANClustering(components);
    } else {
      // Mixed characteristics - use hierarchical
      return this.performHierarchicalClustering(components);
    }
  }

  /**
   * Finds spatial neighbors within threshold distance
   */
  private findSpatialNeighbors(
    component: ComponentIdentification, 
    allComponents: ComponentIdentification[], 
    threshold: number
  ): ComponentIdentification[] {
    return allComponents.filter(other => {
      if (other.id === component.id) return false;
      
      const distance = this.calculateSpatialDistance(component.location, other.location);
      return distance <= threshold;
    });
  }

  /**
   * Calculates spatial distance between two locations
   */
  private calculateSpatialDistance(loc1: ComponentLocation, loc2: ComponentLocation): number {
    const dx = loc1.x - loc2.x;
    const dy = loc1.y - loc2.y;
    
    // Include size information if available
    if (loc1.width && loc1.height && loc2.width && loc2.height) {
      const dwx = Math.abs(loc1.width - loc2.width);
      const dwy = Math.abs(loc1.height - loc2.height);
      return Math.sqrt(dx * dx + dy * dy + dwx * dwx + dwy * dwy);
    }
    
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Creates a cluster from component list
   */
  private async createCluster(id: string, components: ComponentIdentification[]): Promise<ComponentCluster> {
    const centroid = this.calculateClusterCentroid(components);
    const spatialMetrics = this.calculateSpatialMetrics(components);
    const semanticMetrics = this.calculateSemanticMetrics(components);
    
    // Placeholder confidence - will be calculated later
    const confidence: ClusterConfidence = {
      overall: 0,
      spatial: 0,
      semantic: 0,
      agreement: 0,
      stability: 0
    };

    // Placeholder consensus component - will be built later
    const consensusComponent: ConsensusComponent = {
      id: `consensus_${id}`,
      type: { primary: '', alternatives: [], confidence: 0 },
      location: { x: 0, y: 0, uncertainty: { xRange: [0, 0], yRange: [0, 0] }, confidence: 0 },
      properties: { agreed: {}, disputed: {}, missing: [] },
      confidence: 0,
      supportingProviders: [],
      disagreements: []
    };

    return {
      id,
      components,
      centroid,
      confidence,
      spatialMetrics,
      semanticMetrics,
      consensusComponent
    };
  }

  /**
   * Calculates cluster centroid
   */
  private calculateClusterCentroid(components: ComponentIdentification[]): ClusterCentroid {
    if (components.length === 0) {
      throw new Error('Cannot calculate centroid for empty cluster');
    }

    // Calculate weighted average location
    const totalWeight = components.reduce((sum, comp) => sum + comp.confidence, 0);
    
    let weightedX = 0;
    let weightedY = 0;
    let weightedWidth = 0;
    let weightedHeight = 0;
    let hasSize = false;

    for (const comp of components) {
      const weight = comp.confidence;
      weightedX += comp.location.x * weight;
      weightedY += comp.location.y * weight;
      
      if (comp.location.width && comp.location.height) {
        weightedWidth += comp.location.width * weight;
        weightedHeight += comp.location.height * weight;
        hasSize = true;
      }
    }

    const location: ComponentLocation = {
      x: weightedX / totalWeight,
      y: weightedY / totalWeight
    };

    if (hasSize) {
      location.width = weightedWidth / totalWeight;
      location.height = weightedHeight / totalWeight;
    }

    // Determine consensus type
    const typeCounts = new Map<string, number>();
    for (const comp of components) {
      const currentCount = typeCounts.get(comp.type) || 0;
      typeCounts.set(comp.type, currentCount + comp.confidence);
    }

    const consensusType = Array.from(typeCounts.entries())
      .reduce((max, [type, count]) => count > max.count ? { type, count } : max, { type: '', count: 0 })
      .type;

    // Merge properties
    const properties: Record<string, any> = {};
    const propertyValues = new Map<string, Map<string, number>>();

    for (const comp of components) {
      for (const [key, value] of Object.entries(comp.properties)) {
        if (!propertyValues.has(key)) {
          propertyValues.set(key, new Map());
        }
        const valueStr = JSON.stringify(value);
        const currentWeight = propertyValues.get(key)!.get(valueStr) || 0;
        propertyValues.get(key)!.set(valueStr, currentWeight + comp.confidence);
      }
    }

    for (const [key, valueMap] of propertyValues.entries()) {
      const bestValue = Array.from(valueMap.entries())
        .reduce((max, [value, weight]) => weight > max.weight ? { value, weight } : max, { value: '', weight: 0 });
      properties[key] = JSON.parse(bestValue.value);
    }

    return {
      location,
      type: consensusType,
      properties,
      confidence: totalWeight / components.length
    };
  }

  /**
   * Calculates spatial metrics for cluster quality
   */
  private calculateSpatialMetrics(components: ComponentIdentification[]): SpatialMetrics {
    if (components.length === 0) {
      return {
        variance: { x: 0, y: 0 },
        cohesion: 0,
        separation: 0,
        silhouetteScore: 0,
        compactness: 0
      };
    }

    // Calculate centroid
    const centroid = {
      x: components.reduce((sum, comp) => sum + comp.location.x, 0) / components.length,
      y: components.reduce((sum, comp) => sum + comp.location.y, 0) / components.length
    };

    // Calculate variance
    const variance: SpatialVariance = {
      x: components.reduce((sum, comp) => sum + Math.pow(comp.location.x - centroid.x, 2), 0) / components.length,
      y: components.reduce((sum, comp) => sum + Math.pow(comp.location.y - centroid.y, 2), 0) / components.length
    };

    // Calculate cohesion (average distance to centroid)
    const cohesion = components.reduce((sum, comp) => {
      const distance = Math.sqrt(
        Math.pow(comp.location.x - centroid.x, 2) + 
        Math.pow(comp.location.y - centroid.y, 2)
      );
      return sum + distance;
    }, 0) / components.length;

    // Calculate compactness (normalized cohesion)
    const compactness = cohesion > 0 ? 1 / (1 + cohesion / 100) : 1;

    // Placeholder values for separation and silhouette score
    // These would require comparing with other clusters
    const separation = 0;
    const silhouetteScore = 0;

    return {
      variance,
      cohesion,
      separation,
      silhouetteScore,
      compactness
    };
  }

  /**
   * Calculates semantic metrics for cluster quality
   */
  private calculateSemanticMetrics(components: ComponentIdentification[]): SemanticMetrics {
    if (components.length === 0) {
      return {
        typeConsistency: 0,
        propertyAgreement: 0,
        descriptionSimilarity: 0,
        functionalAlignment: 0
      };
    }

    // Type consistency
    const types = new Map<string, number>();
    for (const comp of components) {
      types.set(comp.type, (types.get(comp.type) || 0) + 1);
    }
    
    const maxTypeCount = Math.max(...types.values());
    const typeConsistency = maxTypeCount / components.length;

    // Property agreement
    const allProperties = new Set<string>();
    for (const comp of components) {
      Object.keys(comp.properties).forEach(key => allProperties.add(key));
    }

    let propertyAgreementSum = 0;
    for (const prop of allProperties) {
      const values = new Map<string, number>();
      let totalWithProperty = 0;
      
      for (const comp of components) {
        if (prop in comp.properties) {
          totalWithProperty++;
          const valueStr = JSON.stringify(comp.properties[prop]);
          values.set(valueStr, (values.get(valueStr) || 0) + 1);
        }
      }
      
      if (totalWithProperty > 0) {
        const maxValueCount = Math.max(...values.values());
        propertyAgreementSum += maxValueCount / totalWithProperty;
      }
    }
    
    const propertyAgreement = allProperties.size > 0 ? propertyAgreementSum / allProperties.size : 1;

    // Description similarity (simplified based on component references)
    const references = components.map(comp => comp.properties.reference).filter(Boolean);
    const uniqueReferences = new Set(references);
    const descriptionSimilarity = references.length > 0 ? uniqueReferences.size / references.length : 1;

    // Functional alignment (based on type categorization)
    const functionalAlignment = this.calculateFunctionalAlignment(components.map(comp => comp.type));

    return {
      typeConsistency,
      propertyAgreement,
      descriptionSimilarity,
      functionalAlignment
    };
  }

  /**
   * Calculates functional alignment between component types
   */
  private calculateFunctionalAlignment(types: string[]): number {
    const functionalGroups = new Map<string, string[]>([
      ['passive', ['resistor', 'capacitor', 'inductor']],
      ['active', ['transistor', 'ic', 'diode']],
      ['connection', ['connector', 'wire', 'terminal']],
      ['mechanical', ['switch', 'relay', 'motor']]
    ]);

    // Find which functional group each type belongs to
    const groupCounts = new Map<string, number>();
    
    for (const type of types) {
      let grouped = false;
      for (const [group, groupTypes] of functionalGroups) {
        if (groupTypes.includes(type)) {
          groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
          grouped = true;
          break;
        }
      }
      
      if (!grouped) {
        groupCounts.set('other', (groupCounts.get(groupCounts) || 0) + 1);
      }
    }

    // Calculate alignment as proportion in largest group
    const maxGroupCount = Math.max(...groupCounts.values());
    return maxGroupCount / types.length;
  }

  /**
   * Refines spatial clusters with semantic analysis
   */
  private async refineWithSemanticAnalysis(spatialClusters: ComponentCluster[]): Promise<ComponentCluster[]> {
    const refinedClusters: ComponentCluster[] = [];

    for (const cluster of spatialClusters) {
      // Check if cluster has good semantic consistency
      if (cluster.semanticMetrics.typeConsistency >= this.config.semanticSimilarityThreshold) {
        refinedClusters.push(cluster);
      } else {
        // Split cluster by semantic similarity
        const semanticSubclusters = await this.splitClusterBySemantic(cluster);
        refinedClusters.push(...semanticSubclusters);
      }
    }

    return refinedClusters;
  }

  /**
   * Splits a cluster based on semantic similarity
   */
  private async splitClusterBySemantic(cluster: ComponentCluster): Promise<ComponentCluster[]> {
    const subclusters: ComponentCluster[] = [];
    const components = cluster.components;
    const processed = new Set<string>();

    for (const component of components) {
      if (processed.has(component.id)) continue;

      // Find semantically similar components
      const similarComponents = [component];
      processed.add(component.id);

      for (const other of components) {
        if (processed.has(other.id)) continue;
        
        if (this.areSemanticallySimilar(component, other)) {
          similarComponents.push(other);
          processed.add(other.id);
        }
      }

      if (similarComponents.length >= this.config.minimumClusterSize) {
        const subcluster = await this.createCluster(
          `${cluster.id}_semantic_${subclusters.length}`,
          similarComponents
        );
        subclusters.push(subcluster);
      }
    }

    return subclusters.length > 0 ? subclusters : [cluster];
  }

  /**
   * Checks if two components are semantically similar
   */
  private areSemanticallySimilar(comp1: ComponentIdentification, comp2: ComponentIdentification): boolean {
    // Type similarity
    if (comp1.type !== comp2.type) return false;

    // Property similarity
    const keys1 = new Set(Object.keys(comp1.properties));
    const keys2 = new Set(Object.keys(comp2.properties));
    const commonKeys = new Set([...keys1].filter(k => keys2.has(k)));
    
    if (commonKeys.size === 0) return true; // No properties to compare

    let agreementCount = 0;
    for (const key of commonKeys) {
      if (JSON.stringify(comp1.properties[key]) === JSON.stringify(comp2.properties[key])) {
        agreementCount++;
      }
    }

    const agreement = agreementCount / commonKeys.size;
    return agreement >= this.config.semanticSimilarityThreshold;
  }

  /**
   * Handles outliers based on configuration
   */
  private handleOutliers(clusters: ComponentCluster[]): { clusters: ComponentCluster[]; outliers: ComponentIdentification[] } {
    const filteredClusters: ComponentCluster[] = [];
    const outliers: ComponentIdentification[] = [];

    for (const cluster of clusters) {
      if (cluster.components.length < this.config.minimumClusterSize) {
        // Small cluster - handle as outliers
        switch (this.config.outlierHandling) {
          case OutlierHandling.EXCLUDE:
            outliers.push(...cluster.components);
            break;
          case OutlierHandling.SEPARATE_CLUSTER:
            filteredClusters.push(cluster);
            break;
          case OutlierHandling.LOW_CONFIDENCE:
            // Reduce confidence and include
            cluster.confidence.overall *= 0.5;
            filteredClusters.push(cluster);
            break;
          case OutlierHandling.INCLUDE:
          default:
            filteredClusters.push(cluster);
            break;
        }
      } else {
        filteredClusters.push(cluster);
      }
    }

    return { clusters: filteredClusters, outliers };
  }

  /**
   * Calculates confidence scores for clusters
   */
  private async calculateClusterConfidence(clusters: ComponentCluster[]): Promise<ComponentCluster[]> {
    return clusters.map(cluster => {
      const spatial = Math.min(1, cluster.spatialMetrics.compactness);
      const semantic = (
        cluster.semanticMetrics.typeConsistency * 0.4 +
        cluster.semanticMetrics.propertyAgreement * 0.3 +
        cluster.semanticMetrics.functionalAlignment * 0.3
      );
      
      const agreement = (spatial + semantic) / 2;
      const stability = cluster.components.length >= this.config.minimumClusterSize ? 1 : 0.5;
      const overall = (spatial * 0.3 + semantic * 0.4 + agreement * 0.2 + stability * 0.1);

      return {
        ...cluster,
        confidence: {
          overall: Math.max(0, Math.min(1, overall)),
          spatial: Math.max(0, Math.min(1, spatial)),
          semantic: Math.max(0, Math.min(1, semantic)),
          agreement: Math.max(0, Math.min(1, agreement)),
          stability: Math.max(0, Math.min(1, stability))
        }
      };
    });
  }

  /**
   * Builds consensus components from clusters
   */
  private async buildConsensusComponents(clusters: ComponentCluster[]): Promise<ConsensusComponent[]> {
    return clusters.map(cluster => this.buildConsensusFromCluster(cluster));
  }

  /**
   * Builds consensus component from cluster
   */
  private buildConsensusFromCluster(cluster: ComponentCluster): ConsensusComponent {
    const components = cluster.components;
    
    // Build consensus type
    const type = this.buildConsensusType(components);
    
    // Build consensus location
    const location = this.buildConsensusLocation(components);
    
    // Build consensus properties
    const properties = this.buildConsensusProperties(components);
    
    // Identify disagreements
    const disagreements = this.identifyComponentDisagreements(components);
    
    // Calculate overall confidence
    const confidence = cluster.confidence.overall;
    
    // Get supporting providers
    const supportingProviders = Array.from(new Set(components.map(comp => comp.provider)));

    return {
      id: cluster.id,
      type,
      location,
      properties,
      confidence,
      supportingProviders,
      disagreements
    };
  }

  /**
   * Builds consensus type from components
   */
  private buildConsensusType(components: ComponentIdentification[]): ComponentType {
    const typeCounts = new Map<string, number>();
    
    for (const comp of components) {
      const weight = comp.confidence;
      typeCounts.set(comp.type, (typeCounts.get(comp.type) || 0) + weight);
    }

    const sortedTypes = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    const primary = sortedTypes[0]?.[0] || 'unknown';
    const alternatives = sortedTypes.slice(1).map(([type, support]) => ({
      type,
      support: support / components.length
    }));

    const totalWeight = Array.from(typeCounts.values()).reduce((sum, weight) => sum + weight, 0);
    const primaryWeight = typeCounts.get(primary) || 0;
    const confidence = totalWeight > 0 ? primaryWeight / totalWeight : 0;

    return { primary, alternatives, confidence };
  }

  /**
   * Builds consensus location from components
   */
  private buildConsensusLocation(components: ComponentIdentification[]): ConsensusLocation {
    const totalWeight = components.reduce((sum, comp) => sum + comp.confidence, 0);
    
    // Weighted average location
    let weightedX = 0;
    let weightedY = 0;
    let weightedWidth = 0;
    let weightedHeight = 0;
    let hasSize = false;

    for (const comp of components) {
      const weight = comp.confidence;
      weightedX += comp.location.x * weight;
      weightedY += comp.location.y * weight;
      
      if (comp.location.width && comp.location.height) {
        weightedWidth += comp.location.width * weight;
        weightedHeight += comp.location.height * weight;
        hasSize = true;
      }
    }

    const x = weightedX / totalWeight;
    const y = weightedY / totalWeight;
    const width = hasSize ? weightedWidth / totalWeight : undefined;
    const height = hasSize ? weightedHeight / totalWeight : undefined;

    // Calculate uncertainty ranges
    const xValues = components.map(comp => comp.location.x);
    const yValues = components.map(comp => comp.location.y);
    
    const uncertainty: LocationUncertainty = {
      xRange: [Math.min(...xValues), Math.max(...xValues)],
      yRange: [Math.min(...yValues), Math.max(...yValues)]
    };

    if (hasSize) {
      const widthValues = components.map(comp => comp.location.width || 0);
      const heightValues = components.map(comp => comp.location.height || 0);
      uncertainty.widthRange = [Math.min(...widthValues), Math.max(...widthValues)];
      uncertainty.heightRange = [Math.min(...heightValues), Math.max(...heightValues)];
    }

    // Calculate location confidence based on agreement
    const avgDistance = components.reduce((sum, comp) => {
      const distance = Math.sqrt(Math.pow(comp.location.x - x, 2) + Math.pow(comp.location.y - y, 2));
      return sum + distance;
    }, 0) / components.length;
    
    const confidence = Math.max(0, 1 - avgDistance / 100); // Normalize by expected distance

    return { x, y, width, height, uncertainty, confidence };
  }

  /**
   * Builds consensus properties from components
   */
  private buildConsensusProperties(components: ComponentIdentification[]): ConsensusProperties {
    const agreed: Record<string, PropertyConsensus> = {};
    const disputed: Record<string, PropertyDispute> = {};
    const allProperties = new Set<string>();

    // Collect all property keys
    for (const comp of components) {
      Object.keys(comp.properties).forEach(key => allProperties.add(key));
    }

    for (const prop of allProperties) {
      const values = new Map<string, { support: number; confidence: number; components: ComponentIdentification[] }>();
      let totalComponents = 0;

      // Collect values for this property
      for (const comp of components) {
        if (prop in comp.properties) {
          totalComponents++;
          const valueStr = JSON.stringify(comp.properties[prop]);
          const existing = values.get(valueStr) || { support: 0, confidence: 0, components: [] };
          existing.support += comp.confidence;
          existing.confidence = Math.max(existing.confidence, comp.confidence);
          existing.components.push(comp);
          values.set(valueStr, existing);
        }
      }

      if (totalComponents > 0) {
        const sortedValues = Array.from(values.entries())
          .map(([valueStr, data]) => ({
            value: JSON.parse(valueStr),
            support: data.support / totalComponents,
            confidence: data.confidence,
            components: data.components
          }))
          .sort((a, b) => b.support - a.support);

        const winner = sortedValues[0];
        const alternatives = sortedValues.slice(1);

        if (winner.support > 0.7 || alternatives.length === 0) {
          // Strong consensus or no alternatives
          agreed[prop] = {
            value: winner.value,
            confidence: winner.confidence,
            support: winner.support,
            alternatives: alternatives.map(alt => ({ value: alt.value, support:alt.support }))
          };
        } else {
          // Disputed property
          disputed[prop] = {
            candidates: sortedValues.map(item => ({
              value: item.value,
              support: item.support,
              confidence: item.confidence
            })),
            resolutionStrategy: 'confidence_weighted',
            resolved: false
          };
        }
      }
    }

    // Find missing properties (properties that some but not all components have)
    const missing: string[] = [];
    for (const prop of allProperties) {
      const componentsWithProperty = components.filter(comp => prop in comp.properties).length;
      if (componentsWithProperty < components.length && componentsWithProperty > 0) {
        missing.push(prop);
      }
    }

    return { agreed, disputed, missing };
  }

  /**
   * Identifies disagreements between components in cluster
   */
  private identifyComponentDisagreements(components: ComponentIdentification[]): ComponentDisagreement[] {
    const disagreements: ComponentDisagreement[] = [];

    // Location disagreements
    const avgX = components.reduce((sum, comp) => sum + comp.location.x, 0) / components.length;
    const avgY = components.reduce((sum, comp) => sum + comp.location.y, 0) / components.length;
    
    const locationVariance = components.reduce((sum, comp) => {
      const dx = comp.location.x - avgX;
      const dy = comp.location.y - avgY;
      return sum + (dx * dx + dy * dy);
    }, 0) / components.length;

    if (locationVariance > this.config.spatialThreshold * this.config.spatialThreshold) {
      const conflictingProviders = components
        .filter(comp => {
          const dx = comp.location.x - avgX;
          const dy = comp.location.y - avgY;
          return (dx * dx + dy * dy) > this.config.spatialThreshold * this.config.spatialThreshold;
        })
        .map(comp => comp.provider);

      disagreements.push({
        aspect: DisagreementAspect.LOCATION,
        description: `High location variance (${Math.sqrt(locationVariance).toFixed(2)})`,
        conflictingProviders,
        severity: locationVariance > (this.config.spatialThreshold * 2) ** 2 
          ? DisagreementSeverity.MAJOR 
          : DisagreementSeverity.MODERATE,
        resolution: {
          strategy: ResolutionStrategy.CONFIDENCE_WEIGHTED,
          confidence: 0.7,
          rationale: 'Use confidence-weighted centroid for location consensus'
        }
      });
    }

    // Type disagreements
    const types = new Set(components.map(comp => comp.type));
    if (types.size > 1) {
      const typeByProvider = new Map<string, string>();
      for (const comp of components) {
        if (!typeByProvider.has(comp.provider) || 
            comp.confidence > (components.find(c => c.provider === comp.provider && typeByProvider.get(comp.provider) === c.type)?.confidence || 0)) {
          typeByProvider.set(comp.provider, comp.type);
        }
      }

      const conflictingProviders = Array.from(typeByProvider.keys());
      
      disagreements.push({
        aspect: DisagreementAspect.TYPE,
        description: `Type disagreement: ${Array.from(types).join(', ')}`,
        conflictingProviders,
        severity: types.size > 2 ? DisagreementSeverity.MAJOR : DisagreementSeverity.MODERATE,
        resolution: {
          strategy: ResolutionStrategy.CONFIDENCE_WEIGHTED,
          confidence: 0.6,
          rationale: 'Use confidence-weighted voting for type consensus'
        }
      });
    }

    return disagreements;
  }

  /**
   * Helper methods for clustering algorithms
   */
  private initializeKMeansCentroids(components: ComponentIdentification[], k: number): ComponentLocation[] {
    const centroids: ComponentLocation[] = [];
    
    // Use k-means++ initialization
    if (components.length > 0) {
      // First centroid is random
      centroids.push({ ...components[Math.floor(Math.random() * components.length)].location });
      
      // Subsequent centroids chosen based on distance to existing centroids
      for (let i = 1; i < k; i++) {
        let maxDistance = -1;
        let farthestComponent: ComponentLocation | null = null;
        
        for (const comp of components) {
          const minDistanceToExistingCentroids = Math.min(
            ...centroids.map(centroid => this.calculateSpatialDistance(comp.location, centroid))
          );
          
          if (minDistanceToExistingCentroids > maxDistance) {
            maxDistance = minDistanceToExistingCentroids;
            farthestComponent = comp.location;
          }
        }
        
        if (farthestComponent) {
          centroids.push({ ...farthestComponent });
        }
      }
    }
    
    return centroids;
  }

  private findNearestCentroid(component: ComponentIdentification, centroids: ComponentLocation[]): number {
    let nearestIndex = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < centroids.length; i++) {
      const distance = this.calculateSpatialDistance(component.location, centroids[i]);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }
    
    return nearestIndex;
  }

  private updateKMeansCentroids(
    components: ComponentIdentification[], 
    assignments: number[], 
    k: number
  ): ComponentLocation[] {
    const centroids: ComponentLocation[] = [];
    
    for (let i = 0; i < k; i++) {
      const clusterComponents = components.filter((_, index) => assignments[index] === i);
      
      if (clusterComponents.length > 0) {
        const avgX = clusterComponents.reduce((sum, comp) => sum + comp.location.x, 0) / clusterComponents.length;
        const avgY = clusterComponents.reduce((sum, comp) => sum + comp.location.y, 0) / clusterComponents.length;
        centroids.push({ x: avgX, y: avgY });
      } else {
        // Empty cluster - reinitialize randomly
        const randomComponent = components[Math.floor(Math.random() * components.length)];
        centroids.push({ ...randomComponent.location });
      }
    }
    
    return centroids;
  }

  private centroidsConverged(old: ComponentLocation[], new_: ComponentLocation[]): boolean {
    const threshold = 0.1;
    
    for (let i = 0; i < old.length; i++) {
      const distance = this.calculateSpatialDistance(old[i], new_[i]);
      if (distance > threshold) {
        return false;
      }
    }
    
    return true;
  }

  private buildDistanceMatrix(components: ComponentIdentification[]): number[][] {
    const matrix: number[][] = [];
    
    for (let i = 0; i < components.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < components.length; j++) {
        matrix[i][j] = i === j ? 0 : this.calculateSpatialDistance(components[i].location, components[j].location);
      }
    }
    
    return matrix;
  }

  private calculateClusterDistance(
    cluster1: { components: ComponentIdentification[] },
    cluster2: { components: ComponentIdentification[] },
    distanceMatrix: number[][]
  ): number {
    // Use average linkage
    let totalDistance = 0;
    let count = 0;
    
    for (const comp1 of cluster1.components) {
      for (const comp2 of cluster2.components) {
        // Find indices in original component array (simplified)
        totalDistance += this.calculateSpatialDistance(comp1.location, comp2.location);
        count++;
      }
    }
    
    return count > 0 ? totalDistance / count : Infinity;
  }

  private calculateComponentDensity(components: ComponentIdentification[]): number {
    if (components.length < 2) return 0;
    
    let totalDistance = 0;
    let count = 0;
    
    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        totalDistance += this.calculateSpatialDistance(components[i].location, components[j].location);
        count++;
      }
    }
    
    const avgDistance = totalDistance / count;
    return avgDistance > 0 ? 1 / (1 + avgDistance / 100) : 1; // Normalize
  }

  private analyzeComponentDistribution(components: ComponentIdentification[]): { uniformity: number; hasOutliers: boolean } {
    if (components.length < 3) return { uniformity: 1, hasOutliers: false };
    
    // Calculate pairwise distances
    const distances: number[] = [];
    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        distances.push(this.calculateSpatialDistance(components[i].location, components[j].location));
      }
    }
    
    // Calculate uniformity based on distance variance
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;
    const uniformity = avgDistance > 0 ? Math.max(0, 1 - Math.sqrt(variance) / avgDistance) : 1;
    
    // Detect outliers using IQR method
    const sortedDistances = [...distances].sort((a, b) => a - b);
    const q1 = sortedDistances[Math.floor(sortedDistances.length * 0.25)];
    const q3 = sortedDistances[Math.floor(sortedDistances.length * 0.75)];
    const iqr = q3 - q1;
    const outlierThreshold = q3 + 1.5 * iqr;
    const hasOutliers = distances.some(d => d > outlierThreshold);
    
    return { uniformity, hasOutliers };
  }

  /**
   * Result building methods
   */
  private calculateConsensusMetrics(
    clusters: ComponentCluster[], 
    outliers: ComponentIdentification[], 
    allComponents: ComponentIdentification[]
  ): ConsensusMetrics {
    const totalComponents = allComponents.length;
    const clustersFormed = clusters.length;
    const averageClusterSize = clusters.length > 0 
      ? clusters.reduce((sum, cluster) => sum + cluster.components.length, 0) / clusters.length
      : 0;

    // Overall agreement
    const totalAgreement = clusters.reduce((sum, cluster) => sum + cluster.confidence.agreement, 0);
    const overallAgreement = clusters.length > 0 ? totalAgreement / clusters.length : 0;

    // Spatial agreement
    const spatialAgreement = clusters.reduce((sum, cluster) => sum + cluster.confidence.spatial, 0) / Math.max(clusters.length, 1);

    // Semantic agreement
    const semanticAgreement = clusters.reduce((sum, cluster) => sum + cluster.confidence.semantic, 0) / Math.max(clusters.length, 1);

    // Overall confidence
    const confidence = clusters.reduce((sum, cluster) => sum + cluster.confidence.overall, 0) / Math.max(clusters.length, 1);

    return {
      totalComponents,
      clustersFormed,
      averageClusterSize,
      overallAgreement,
      spatialAgreement,
      semanticAgreement,
      confidence
    };
  }

  private generateConsensusSummary(
    consensusComponents: ConsensusComponent[], 
    metrics: ConsensusMetrics, 
    startTime: number
  ): ConsensusSummary {
    const agreedComponents = consensusComponents.filter(comp => comp.disagreements.length === 0).length;
    const disputedComponents = consensusComponents.filter(comp => comp.disagreements.length > 0).length;
    const highConfidenceComponents = consensusComponents.filter(comp => comp.confidence > 0.8).length;
    const requiresReview = consensusComponents.filter(comp => 
      comp.confidence < 0.5 || comp.disagreements.some(d => d.severity === DisagreementSeverity.MAJOR)
    ).length;
    const processingTime = Date.now() - startTime;

    return {
      agreedComponents,
      disputedComponents,
      highConfidenceComponents,
      requiresReview,
      processingTime
    };
  }

  private buildEmptyResult(startTime: number): ComponentConsensusResult {
    return {
      clusters: [],
      consensusComponents: [],
      outliers: [],
      metrics: {
        totalComponents: 0,
        clustersFormed: 0,
        averageClusterSize: 0,
        overallAgreement: 0,
        spatialAgreement: 0,
        semanticAgreement: 0,
        confidence: 0
      },
      summary: {
        agreedComponents: 0,
        disputedComponents: 0,
        highConfidenceComponents: 0,
        requiresReview: 0,
        processingTime: Date.now() - startTime
      }
    };
  }
}