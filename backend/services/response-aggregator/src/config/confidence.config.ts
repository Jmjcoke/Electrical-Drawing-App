/**
 * Confidence Configuration System
 * 
 * Provides comprehensive configuration management for consensus and confidence scoring
 * with dynamic thresholds, user preferences, and environment-specific settings.
 */

export interface ConsensusConfidenceConfig {
  readonly agreement: AgreementConfig;
  readonly confidence: ConfidenceConfig;
  readonly clustering: ClusteringConfig;
  readonly uncertainty: UncertaintyConfig;
  readonly thresholds: ThresholdConfig;
  readonly performance: PerformanceConfig;
}

export interface AgreementConfig {
  readonly semanticSimilarityThreshold: number;
  readonly correlationMinimum: number;
  readonly entropyWeighting: number;
  readonly varianceThreshold: number;
  readonly outlierDetectionThreshold: number;
  readonly conflictDetectionSensitivity: number;
}

export interface ConfidenceConfig {
  readonly factors: ConfidenceFactorWeights;
  readonly thresholds: ConfidenceThresholds;
  readonly normalization: 'minmax' | 'zscore' | 'sigmoid' | 'percentile';
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

export interface ClusteringConfig {
  readonly componentSpatialThreshold: number;
  readonly semanticSimilarityThreshold: number;
  readonly minimumClusterSize: number;
  readonly maxClusters: number;
  readonly clusteringAlgorithm: 'kmeans' | 'dbscan' | 'hierarchical' | 'adaptive';
  readonly outlierHandling: 'include' | 'exclude' | 'separate_cluster' | 'low_confidence';
}

export interface UncertaintyConfig {
  readonly confidenceIntervals: boolean;
  readonly propagateUncertainty: boolean;
  readonly uncertaintyWeighting: number;
  readonly warningThresholds: WarningThresholds;
}

export interface WarningThresholds {
  readonly highUncertainty: number;
  readonly lowAgreement: number;
  readonly outlierDetection: number;
  readonly insufficientData: number;
}

export interface ThresholdConfig {
  readonly confidence: ConfidenceThresholds;
  readonly agreement: AgreementThresholds;
  readonly quality: QualityThresholds;
  readonly uncertainty: UncertaintyThresholds;
}

export interface AgreementThresholds {
  readonly excellent: number;
  readonly good: number;
  readonly acceptable: number;
  readonly poor: number;
}

export interface QualityThresholds {
  readonly high: number;
  readonly medium: number;
  readonly low: number;
  readonly unacceptable: number;
}

export interface UncertaintyThresholds {
  readonly low: number;
  readonly medium: number;
  readonly high: number;
  readonly critical: number;
}

export interface PerformanceConfig {
  readonly maxProcessingTime: number;
  readonly maxComponentClusters: number;
  readonly batchSize: number;
  readonly cacheResults: boolean;
}

/**
 * Default Configuration Sets
 */
export const DEFAULT_CONSENSUS_CONFIG: ConsensusConfidenceConfig = {
  agreement: {
    semanticSimilarityThreshold: 0.7,
    correlationMinimum: 0.5,
    entropyWeighting: 0.3,
    varianceThreshold: 0.2,
    outlierDetectionThreshold: 0.6,
    conflictDetectionSensitivity: 0.5
  },
  confidence: {
    factors: {
      agreement: 0.25,
      quality: 0.25,
      consistency: 0.2,
      coverage: 0.15,
      completeness: 0.1,
      uncertainty: 0.05
    },
    thresholds: {
      high: 0.8,
      medium: 0.6,
      low: 0.4,
      critical: 0.2
    },
    normalization: 'minmax',
    degradationHandling: {
      enableDegradation: true,
      partialResponsePenalty: 0.2,
      missingDataPenalty: 0.1,
      timeoutPenalty: 0.15
    },
    propagation: {
      enablePropagation: true,
      confidenceDecay: 0.05,
      uncertaintyAmplification: 1.2,
      crossFactorInfluence: true
    }
  },
  clustering: {
    componentSpatialThreshold: 50.0,
    semanticSimilarityThreshold: 0.7,
    minimumClusterSize: 2,
    maxClusters: 20,
    clusteringAlgorithm: 'adaptive',
    outlierHandling: 'low_confidence'
  },
  uncertainty: {
    confidenceIntervals: true,
    propagateUncertainty: true,
    uncertaintyWeighting: 0.3,
    warningThresholds: {
      highUncertainty: 0.5,
      lowAgreement: 0.4,
      outlierDetection: 0.7,
      insufficientData: 3
    }
  },
  thresholds: {
    confidence: {
      high: 0.8,
      medium: 0.6,
      low: 0.4,
      critical: 0.2
    },
    agreement: {
      excellent: 0.9,
      good: 0.7,
      acceptable: 0.5,
      poor: 0.3
    },
    quality: {
      high: 0.8,
      medium: 0.6,
      low: 0.4,
      unacceptable: 0.2
    },
    uncertainty: {
      low: 0.2,
      medium: 0.4,
      high: 0.6,
      critical: 0.8
    }
  },
  performance: {
    maxProcessingTime: 3000,
    maxComponentClusters: 100,
    batchSize: 10,
    cacheResults: true
  }
};

/**
 * High Precision Configuration
 */
export const HIGH_PRECISION_CONFIG: ConsensusConfidenceConfig = {
  ...DEFAULT_CONSENSUS_CONFIG,
  agreement: {
    ...DEFAULT_CONSENSUS_CONFIG.agreement,
    semanticSimilarityThreshold: 0.8,
    correlationMinimum: 0.7,
    outlierDetectionThreshold: 0.8
  },
  confidence: {
    ...DEFAULT_CONSENSUS_CONFIG.confidence,
    factors: {
      agreement: 0.35,
      quality: 0.25,
      consistency: 0.25,
      coverage: 0.1,
      completeness: 0.05,
      uncertainty: 0.0
    },
    thresholds: {
      high: 0.9,
      medium: 0.7,
      low: 0.5,
      critical: 0.3
    }
  },
  clustering: {
    ...DEFAULT_CONSENSUS_CONFIG.clustering,
    componentSpatialThreshold: 25.0,
    semanticSimilarityThreshold: 0.8,
    minimumClusterSize: 3
  }
};

/**
 * Fast Processing Configuration
 */
export const FAST_CONFIG: ConsensusConfidenceConfig = {
  ...DEFAULT_CONSENSUS_CONFIG,
  agreement: {
    ...DEFAULT_CONSENSUS_CONFIG.agreement,
    semanticSimilarityThreshold: 0.6,
    correlationMinimum: 0.4,
    outlierDetectionThreshold: 0.5
  },
  confidence: {
    ...DEFAULT_CONSENSUS_CONFIG.confidence,
    factors: {
      agreement: 0.4,
      quality: 0.3,
      consistency: 0.15,
      coverage: 0.1,
      completeness: 0.05,
      uncertainty: 0.0
    },
    degradationHandling: {
      ...DEFAULT_CONSENSUS_CONFIG.confidence.degradationHandling,
      enableDegradation: false
    },
    propagation: {
      ...DEFAULT_CONSENSUS_CONFIG.confidence.propagation,
      enablePropagation: false
    }
  },
  clustering: {
    ...DEFAULT_CONSENSUS_CONFIG.clustering,
    clusteringAlgorithm: 'kmeans',
    maxClusters: 10
  },
  performance: {
    ...DEFAULT_CONSENSUS_CONFIG.performance,
    maxProcessingTime: 1000,
    maxComponentClusters: 50
  }
};

/**
 * Configuration Manager
 */
export class ConfidenceConfigManager {
  private config: ConsensusConfidenceConfig;
  private userPreferences: Partial<ConsensusConfidenceConfig> = {};

  constructor(initialConfig: ConsensusConfidenceConfig = DEFAULT_CONSENSUS_CONFIG) {
    this.config = { ...initialConfig };
  }

  /**
   * Gets current configuration
   */
  public getConfig(): ConsensusConfidenceConfig {
    return { ...this.config };
  }

  /**
   * Updates configuration with new values
   */
  public updateConfig(updates: Partial<ConsensusConfidenceConfig>): void {
    this.config = this.mergeConfigs(this.config, updates);
  }

  /**
   * Sets user preferences
   */
  public setUserPreferences(preferences: Partial<ConsensusConfidenceConfig>): void {
    this.userPreferences = { ...preferences };
    this.config = this.mergeConfigs(DEFAULT_CONSENSUS_CONFIG, this.userPreferences);
  }

  /**
   * Gets user preferences
   */
  public getUserPreferences(): Partial<ConsensusConfidenceConfig> {
    return { ...this.userPreferences };
  }

  /**
   * Loads configuration for specific use case
   */
  public loadPreset(preset: 'default' | 'high_precision' | 'fast'): void {
    switch (preset) {
      case 'high_precision':
        this.config = { ...HIGH_PRECISION_CONFIG };
        break;
      case 'fast':
        this.config = { ...FAST_CONFIG };
        break;
      case 'default':
      default:
        this.config = { ...DEFAULT_CONSENSUS_CONFIG };
        break;
    }
    
    // Apply user preferences on top of preset
    if (Object.keys(this.userPreferences).length > 0) {
      this.config = this.mergeConfigs(this.config, this.userPreferences);
    }
  }

  /**
   * Validates configuration values
   */
  public validateConfig(config: ConsensusConfidenceConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate factor weights sum to approximately 1
    const factorSum = Object.values(config.confidence.factors).reduce((sum, weight) => sum + weight, 0);
    if (Math.abs(factorSum - 1.0) > 0.1) {
      errors.push(`Confidence factor weights sum to ${factorSum.toFixed(3)}, expected ~1.0`);
    }

    // Validate threshold ordering
    const { thresholds } = config.confidence;
    if (thresholds.high <= thresholds.medium) {
      errors.push('High confidence threshold must be greater than medium threshold');
    }
    if (thresholds.medium <= thresholds.low) {
      errors.push('Medium confidence threshold must be greater than low threshold');
    }
    if (thresholds.low <= thresholds.critical) {
      errors.push('Low confidence threshold must be greater than critical threshold');  
    }

    // Validate ranges
    if (config.clustering.componentSpatialThreshold <= 0) {
      errors.push('Component spatial threshold must be positive');
    }
    if (config.clustering.minimumClusterSize < 1) {
      errors.push('Minimum cluster size must be at least 1');
    }
    if (config.performance.maxProcessingTime <= 0) {
      errors.push('Max processing time must be positive');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Adjusts thresholds dynamically based on historical performance
   */
  public adjustDynamicThresholds(historicalData: HistoricalPerformance): void {
    const { avgConfidence, successRate, avgProcessingTime } = historicalData;

    // Adjust confidence thresholds based on historical performance
    if (successRate > 0.9 && avgConfidence > 0.8) {
      // Good performance - can be more strict
      this.config.confidence.thresholds = {
        high: Math.min(0.9, this.config.confidence.thresholds.high + 0.05),
        medium: Math.min(0.75, this.config.confidence.thresholds.medium + 0.05),
        low: Math.min(0.55, this.config.confidence.thresholds.low + 0.05),
        critical: Math.min(0.35, this.config.confidence.thresholds.critical + 0.05)
      };
    } else if (successRate < 0.7 || avgConfidence < 0.6) {
      // Poor performance - be more lenient
      this.config.confidence.thresholds = {
        high: Math.max(0.7, this.config.confidence.thresholds.high - 0.05),
        medium: Math.max(0.5, this.config.confidence.thresholds.medium - 0.05),
        low: Math.max(0.3, this.config.confidence.thresholds.low - 0.05),
        critical: Math.max(0.1, this.config.confidence.thresholds.critical - 0.05)
      };
    }

    // Adjust processing time limits
    if (avgProcessingTime > this.config.performance.maxProcessingTime * 0.8) {
      this.config.performance.maxProcessingTime = Math.min(5000, avgProcessingTime * 1.5);
    }
  }

  /**
   * Creates environment-specific configuration
   */
  public createEnvironmentConfig(environment: 'development' | 'staging' | 'production'): ConsensusConfidenceConfig {
    const baseConfig = { ...this.config };

    switch (environment) {
      case 'development':
        return {
          ...baseConfig,
          performance: {
            ...baseConfig.performance,
            maxProcessingTime: 10000,
            cacheResults: false
          },
          confidence: {
            ...baseConfig.confidence,
            thresholds: {
              high: 0.7,
              medium: 0.5,
              low: 0.3,
              critical: 0.1
            }
          }
        };

      case 'staging':
        return {
          ...baseConfig,
          confidence: {
            ...baseConfig.confidence,
            thresholds: {
              high: 0.75,
              medium: 0.55,
              low: 0.35,
              critical: 0.15
            }
          }
        };

      case 'production':
        return {
          ...baseConfig,
          confidence: {
            ...baseConfig.confidence,
            thresholds: {
              high: 0.85,
              medium: 0.65,
              low: 0.45,
              critical: 0.25
            }
          },
          performance: {
            ...baseConfig.performance,
            maxProcessingTime: 2000
          }
        };

      default:
        return baseConfig;
    }
  }

  /**
   * Merges two configuration objects
   */
  private mergeConfigs(
    base: ConsensusConfidenceConfig, 
    override: Partial<ConsensusConfidenceConfig>
  ): ConsensusConfidenceConfig {
    return {
      agreement: { ...base.agreement, ...override.agreement },
      confidence: {
        factors: { ...base.confidence.factors, ...override.confidence?.factors },
        thresholds: { ...base.confidence.thresholds, ...override.confidence?.thresholds },
        normalization: override.confidence?.normalization || base.confidence.normalization,
        degradationHandling: { ...base.confidence.degradationHandling, ...override.confidence?.degradationHandling },
        propagation: { ...base.confidence.propagation, ...override.confidence?.propagation }
      },
      clustering: { ...base.clustering, ...override.clustering },
      uncertainty: { ...base.uncertainty, ...override.uncertainty },
      thresholds: {
        confidence: { ...base.thresholds.confidence, ...override.thresholds?.confidence },
        agreement: { ...base.thresholds.agreement, ...override.thresholds?.agreement },
        quality: { ...base.thresholds.quality, ...override.thresholds?.quality },
        uncertainty: { ...base.thresholds.uncertainty, ...override.thresholds?.uncertainty }
      },
      performance: { ...base.performance, ...override.performance }
    };
  }
}

/**
 * Helper interfaces
 */
export interface HistoricalPerformance {
  avgConfidence: number;
  successRate: number;
  avgProcessingTime: number;
  totalRequests: number;
}