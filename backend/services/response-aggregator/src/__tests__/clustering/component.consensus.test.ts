/**
 * Unit Tests: Component Consensus Clustering
 * 
 * Tests spatial and semantic clustering algorithms for component identification
 * consensus with edge cases and failure scenarios.
 */

import { ComponentConsensusClustering, ComponentConsensusResult, ComponentCluster } from '../../clustering/component.consensus';
import { LLMResponse } from '../../../../llm-orchestrator/src/providers/base/LLMProvider.interface';
import { DEFAULT_CONSENSUS_CONFIG } from '../../config/confidence.config';

describe('ComponentConsensusClustering Edge Cases', () => {
  let clustering: ComponentConsensusClustering;

  beforeEach(() => {
    clustering = new ComponentConsensusClustering(DEFAULT_CONSENSUS_CONFIG);
  });

  describe('Single Model Response Edge Cases', () => {
    it('should handle single model response gracefully', async () => {
      const responses: LLMResponse[] = [
        createResponseWithComponents('openai', 'Single provider response', 0.8, [
          { id: 'R1', type: 'resistor', location: { x: 100, y: 100 } },
          { id: 'C1', type: 'capacitor', location: { x: 200, y: 100 } }
        ])
      ];

      const result = await clustering.clusterComponents(responses);

      expect(result.clusteredComponents).toHaveLength(2);
      expect(result.confidenceScores).toHaveLength(2);
      expect(result.disagreements).toHaveLength(0);
      
      // Single model should result in reduced confidence
      result.confidenceScores.forEach(score => {
        expect(score.confidence).toBeLessThan(0.8); // Penalty for single model
      });
    });

    it('should handle single model with no components', async () => {
      const responses: LLMResponse[] = [
        createResponseWithComponents('openai', 'No components identified', 0.3, [])
      ];

      const result = await clustering.clusterComponents(responses);

      expect(result.clusteredComponents).toHaveLength(0);
      expect(result.confidenceScores).toHaveLength(0);
      expect(result.disagreements).toHaveLength(0);
      expect(result.spatialAgreement.averageDistance).toBe(0);
    });

    it('should handle single model with duplicate components', async () => {
      const responses: LLMResponse[] = [
        createResponseWithComponents('openai', 'Duplicate components', 0.7, [
          { id: 'R1', type: 'resistor', location: { x: 100, y: 100 } },
          { id: 'R1_duplicate', type: 'resistor', location: { x: 102, y: 101 } }, // Very close
          { id: 'R1_another', type: 'resistor', location: { x: 99, y: 99 } }   // Very close
        ])
      ];

      const result = await clustering.clusterComponents(responses);

      expect(result.clusteredComponents.length).toBeLessThan(3); // Should merge similar components
      const resistorClusters = result.clusteredComponents.filter(c => c.consensusType === 'resistor');
      expect(resistorClusters).toHaveLength(1); // All resistors should be clustered together
    });
  });

  describe('Extreme Disagreement Scenarios', () => {
    it('should handle complete disagreement in component types', async () => {
      const responses: LLMResponse[] = [
        createResponseWithComponents('openai', 'Provider 1', 0.9, [
          { id: 'comp1', type: 'resistor', location: { x: 100, y: 100 } }
        ]),
        createResponseWithComponents('claude', 'Provider 2', 0.8, [
          { id: 'comp1', type: 'capacitor', location: { x: 105, y: 102 } } // Same location, different type
        ]),
        createResponseWithComponents('gemini', 'Provider 3', 0.85, [
          { id: 'comp1', type: 'inductor', location: { x: 98, y: 99 } } // Same location, different type
        ])
      ];

      const result = await clustering.clusterComponents(responses);

      expect(result.disagreements.length).toBeGreaterThan(0);
      expect(result.disagreements[0].type).toBe('type_mismatch');
      expect(result.disagreements[0].severity).toBeGreaterThan(0.7);
      
      // Should still create a cluster but with low confidence
      expect(result.clusteredComponents).toHaveLength(1);
      expect(result.confidenceScores[0].confidence).toBeLessThan(0.5);
    });

    it('should handle complete spatial disagreement', async () => {
      const responses: LLMResponse[] = [
        createResponseWithComponents('openai', 'Provider 1', 0.9, [
          { id: 'R1', type: 'resistor', location: { x: 0, y: 0 } }
        ]),
        createResponseWithComponents('claude', 'Provider 2', 0.8, [
          { id: 'R1', type: 'resistor', location: { x: 500, y: 500 } } // Far away
        ]),
        createResponseWithComponents('gemini', 'Provider 3', 0.85, [
          { id: 'R1', type: 'resistor', location: { x: 1000, y: 1000 } } // Even farther
        ])
      ];

      const result = await clustering.clusterComponents(responses);

      expect(result.spatialAgreement.averageDistance).toBeGreaterThan(400);
      expect(result.disagreements.some(d => d.type === 'spatial_mismatch')).toBe(true);
      
      // Might create separate clusters or one low-confidence cluster
      if (result.clusteredComponents.length === 1) {
        expect(result.confidenceScores[0].confidence).toBeLessThan(0.4);
      } else {
        expect(result.clusteredComponents.length).toBe(3); // Separate clusters
      }
    });

    it('should handle mixed agreement/disagreement scenarios', async () => {
      const responses: LLMResponse[] = [
        createResponseWithComponents('openai', 'Provider 1', 0.9, [
          { id: 'R1', type: 'resistor', location: { x: 100, y: 100 } }, // Good agreement
          { id: 'C1', type: 'capacitor', location: { x: 200, y: 100 } }, // Good agreement
          { id: 'L1', type: 'inductor', location: { x: 300, y: 100 } }  // Disagreement ahead
        ]),
        createResponseWithComponents('claude', 'Provider 2', 0.8, [
          { id: 'R1', type: 'resistor', location: { x: 102, y: 101 } }, // Good agreement
          { id: 'C1', type: 'capacitor', location: { x: 198, y: 99 } }, // Good agreement
          { id: 'D1', type: 'diode', location: { x: 305, y: 102 } }    // Type disagreement
        ]),
        createResponseWithComponents('gemini', 'Provider 3', 0.85, [
          { id: 'R1', type: 'resistor', location: { x: 99, y: 102 } },  // Good agreement
          { id: 'C1', type: 'capacitor', location: { x: 201, y: 98 } }, // Good agreement
          { id: 'T1', type: 'transistor', location: { x: 298, y: 99 } } // Type disagreement
        ])
      ];

      const result = await clustering.clusterComponents(responses);

      expect(result.clusteredComponents).toHaveLength(3);
      
      // First two components should have high confidence
      const resistorCluster = result.clusteredComponents.find(c => c.consensusType === 'resistor');
      const capacitorCluster = result.clusteredComponents.find(c => c.consensusType === 'capacitor');
      const thirdCluster = result.clusteredComponents.find(c => 
        c.consensusType !== 'resistor' && c.consensusType !== 'capacitor'
      );

      expect(resistorCluster).toBeDefined();
      expect(capacitorCluster).toBeDefined();
      expect(thirdCluster).toBeDefined();

      const resistorConfidence = result.confidenceScores.find(s => s.componentId === resistorCluster!.id);
      const capacitorConfidence = result.confidenceScores.find(s => s.componentId === capacitorCluster!.id);
      const thirdConfidence = result.confidenceScores.find(s => s.componentId === thirdCluster!.id);

      expect(resistorConfidence!.confidence).toBeGreaterThan(0.8);
      expect(capacitorConfidence!.confidence).toBeGreaterThan(0.8);
      expect(thirdConfidence!.confidence).toBeLessThan(0.6); // Low due to disagreement
    });
  });

  describe('Partial Failure Scenarios', () => {
    it('should handle responses with missing component data', async () => {
      const responses: LLMResponse[] = [
        createResponseWithComponents('openai', 'Complete response', 0.9, [
          { id: 'R1', type: 'resistor', location: { x: 100, y: 100 } },
          { id: 'C1', type: 'capacitor', location: { x: 200, y: 100 } }
        ]),
        createResponseWithoutComponents('claude', 'Failed to identify components', 0.3),
        createResponseWithComponents('gemini', 'Partial response', 0.7, [
          { id: 'R1', type: 'resistor', location: { x: 102, y: 101 } }
        ])
      ];

      const result = await clustering.clusterComponents(responses);

      expect(result.clusteredComponents.length).toBeGreaterThan(0);
      
      // Should penalize confidence due to missing data
      result.confidenceScores.forEach(score => {
        expect(score.confidence).toBeLessThan(0.8);
      });

      expect(result.disagreements.some(d => d.type === 'missing_data')).toBe(true);
    });

    it('should handle responses with malformed component data', async () => {
      const responses: LLMResponse[] = [
        createResponseWithComponents('openai', 'Good response', 0.9, [
          { id: 'R1', type: 'resistor', location: { x: 100, y: 100 } }
        ]),
        createResponseWithMalformedComponents('claude', 'Malformed response', 0.6),
        createResponseWithComponents('gemini', 'Another good response', 0.8, [
          { id: 'R1', type: 'resistor', location: { x: 105, y: 102 } }
        ])
      ];

      expect(async () => {
        await clustering.clusterComponents(responses);
      }).not.toThrow();

      const result = await clustering.clusterComponents(responses);
      expect(result.clusteredComponents.length).toBeGreaterThan(0);
    });

    it('should handle timeout scenarios in clustering algorithms', async () => {
      // Create a large dataset that might cause performance issues
      const largeComponentSet = Array.from({ length: 100 }, (_, i) => ({
        id: `comp_${i}`,
        type: i % 5 === 0 ? 'resistor' : i % 5 === 1 ? 'capacitor' : i % 5 === 2 ? 'inductor' : i % 5 === 3 ? 'diode' : 'transistor',
        location: { x: Math.random() * 1000, y: Math.random() * 1000 }
      }));

      const responses: LLMResponse[] = [
        createResponseWithComponents('openai', 'Large dataset 1', 0.8, largeComponentSet.slice(0, 50)),
        createResponseWithComponents('claude', 'Large dataset 2', 0.8, largeComponentSet.slice(25, 75)),
        createResponseWithComponents('gemini', 'Large dataset 3', 0.8, largeComponentSet.slice(50, 100))
      ];

      const startTime = Date.now();
      const result = await clustering.clusterComponents(responses);
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.clusteredComponents.length).toBeGreaterThan(0);
      expect(result.clusteredComponents.length).toBeLessThanOrEqual(100); // Reasonable cluster count
    });
  });

  describe('Algorithm-Specific Edge Cases', () => {
    it('should handle DBSCAN edge cases - no clusters found', async () => {
      const config = {
        ...DEFAULT_CONSENSUS_CONFIG,
        clustering: {
          ...DEFAULT_CONSENSUS_CONFIG.clustering,
          clusteringAlgorithm: 'dbscan' as const,
          componentSpatialThreshold: 10.0, // Very strict threshold
          minimumClusterSize: 5 // High minimum
        }
      };
      
      clustering = new ComponentConsensusClustering(config);

      // Sparse, widely separated components
      const responses: LLMResponse[] = [
        createResponseWithComponents('openai', 'Sparse components', 0.8, [
          { id: 'R1', type: 'resistor', location: { x: 0, y: 0 } },
          { id: 'C1', type: 'capacitor', location: { x: 500, y: 500 } }
        ]),
        createResponseWithComponents('claude', 'Sparse components', 0.8, [
          { id: 'R1', type: 'resistor', location: { x: 1000, y: 1000 } },
          { id: 'C1', type: 'capacitor', location: { x: 1500, y: 1500 } }
        ])
      ];

      const result = await clustering.clusterComponents(responses);

      // DBSCAN might not find clusters with strict parameters
      expect(result.clusteredComponents.length).toBeGreaterThanOrEqual(0);
      if (result.clusteredComponents.length === 0) {
        expect(result.disagreements.some(d => d.type === 'clustering_failed')).toBe(true);
      }
    });

    it('should handle K-means with insufficient data points', async () => {
      const config = {
        ...DEFAULT_CONSENSUS_CONFIG,
        clustering: {
          ...DEFAULT_CONSENSUS_CONFIG.clustering,
          clusteringAlgorithm: 'kmeans' as const,
          maxClusters: 10 // More clusters than data points
        }
      };
      
      clustering = new ComponentConsensusClustering(config);

      const responses: LLMResponse[] = [
        createResponseWithComponents('openai', 'Few components', 0.8, [
          { id: 'R1', type: 'resistor', location: { x: 100, y: 100 } }
        ]),
        createResponseWithComponents('claude', 'Few components', 0.8, [
          { id: 'R1', type: 'resistor', location: { x: 102, y: 101 } }
        ])
      ];

      expect(async () => {
        await clustering.clusterComponents(responses);
      }).not.toThrow();

      const result = await clustering.clusterComponents(responses);
      expect(result.clusteredComponents.length).toBeLessThanOrEqual(2); // Can't have more clusters than data
    });

    it('should handle hierarchical clustering edge cases', async () => {
      const config = {
        ...DEFAULT_CONSENSUS_CONFIG,
        clustering: {
          ...DEFAULT_CONSENSUS_CONFIG.clustering,
          clusteringAlgorithm: 'hierarchical' as const
        }
      };
      
      clustering = new ComponentConsensusClustering(config);

      // Components at identical locations
      const responses: LLMResponse[] = [
        createResponseWithComponents('openai', 'Identical locations', 0.8, [
          { id: 'R1', type: 'resistor', location: { x: 100, y: 100 } },
          { id: 'R2', type: 'resistor', location: { x: 100, y: 100 } }, // Identical
          { id: 'R3', type: 'resistor', location: { x: 100, y: 100 } }  // Identical
        ])
      ];

      const result = await clustering.clusterComponents(responses);

      expect(result.clusteredComponents).toHaveLength(1); // Should merge identical locations
      expect(result.clusteredComponents[0].components.length).toBe(3);
    });

    it('should gracefully handle adaptive algorithm fallback', async () => {
      const config = {
        ...DEFAULT_CONSENSUS_CONFIG,
        clustering: {
          ...DEFAULT_CONSENSUS_CONFIG.clustering,
          clusteringAlgorithm: 'adaptive' as const
        }
      };
      
      clustering = new ComponentConsensusClustering(config);

      // Create scenario where primary algorithm might fail
      const responses: LLMResponse[] = [
        createResponseWithComponents('openai', 'Edge case data', 0.8, [
          { id: 'R1', type: 'resistor', location: { x: Number.POSITIVE_INFINITY, y: 100 } }, // Invalid coordinate
          { id: 'C1', type: 'capacitor', location: { x: 200, y: Number.NaN } } // Invalid coordinate
        ]),
        createResponseWithComponents('claude', 'Normal data', 0.8, [
          { id: 'R1', type: 'resistor', location: { x: 100, y: 100 } },
          { id: 'C1', type: 'capacitor', location: { x: 200, y: 100 } }
        ])
      ];

      expect(async () => {
        await clustering.clusterComponents(responses);
      }).not.toThrow();

      const result = await clustering.clusterComponents(responses);
      expect(result.clusteredComponents.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle memory efficiently with large component sets', async () => {
      const largeResponses: LLLResponse[] = Array.from({ length: 10 }, (_, i) =>
        createResponseWithComponents(
          `provider_${i}`,
          `Large response ${i}`,
          0.8,
          Array.from({ length: 200 }, (_, j) => ({
            id: `comp_${i}_${j}`,
            type: ['resistor', 'capacitor', 'inductor', 'diode', 'transistor'][j % 5],
            location: { x: (j % 20) * 50, y: Math.floor(j / 20) * 50 }
          }))
        )
      );

      const initialMemory = process.memoryUsage();
      const result = await clustering.clusterComponents(largeResponses);
      const finalMemory = process.memoryUsage();

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // Less than 200MB increase

      expect(result.clusteredComponents.length).toBeGreaterThan(0);
      expect(result.clusteredComponents.length).toBeLessThan(500); // Reasonable cluster count
    });

    it('should respect processing time limits', async () => {
      const config = {
        ...DEFAULT_CONSENSUS_CONFIG,
        performance: {
          ...DEFAULT_CONSENSUS_CONFIG.performance,
          maxProcessingTime: 1000 // 1 second limit
        }
      };
      
      clustering = new ComponentConsensusClustering(config);

      const complexResponses = Array.from({ length: 5 }, (_, i) =>
        createResponseWithComponents(
          `provider_${i}`,
          `Complex response ${i}`,
          0.8,
          Array.from({ length: 100 }, (_, j) => ({
            id: `comp_${i}_${j}`,
            type: 'resistor',
            location: { x: Math.random() * 1000, y: Math.random() * 1000 }
          }))
        )
      );

      const startTime = Date.now();
      const result = await clustering.clusterComponents(complexResponses);
      const processingTime = Date.now() - startTime;

      // Should either complete quickly or handle timeout gracefully
      expect(processingTime).toBeLessThan(2000); // Some buffer for timeout handling
      expect(result).toBeDefined();
    });
  });

  describe('Data Validation Edge Cases', () => {
    it('should handle invalid coordinate values', async () => {
      const responses: LLMResponse[] = [
        createResponseWithComponents('openai', 'Invalid coordinates', 0.8, [
          { id: 'R1', type: 'resistor', location: { x: Number.POSITIVE_INFINITY, y: 100 } },
          { id: 'C1', type: 'capacitor', location: { x: 200, y: Number.NEGATIVE_INFINITY } },
          { id: 'L1', type: 'inductor', location: { x: Number.NaN, y: Number.NaN } },
          { id: 'D1', type: 'diode', location: { x: -1000000, y: 1000000 } } // Extreme values
        ])
      ];

      expect(async () => {
        await clustering.clusterComponents(responses);
      }).not.toThrow();

      const result = await clustering.clusterComponents(responses);
      
      // Should filter out invalid data
      expect(result.clusteredComponents.length).toBeLessThanOrEqual(4);
      expect(result.disagreements.some(d => d.type === 'invalid_data')).toBe(true);
    });

    it('should handle missing required component properties', async () => {
      const responses: LLMResponse[] = [
        {
          provider: 'openai',
          model: 'gpt-4',
          response: 'Components identified',
          confidence: 0.8,
          responseTime: 1000,
          timestamp: new Date(),
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
          components: [
            { id: 'R1', type: 'resistor' }, // Missing location
            { id: 'C1', location: { x: 200, y: 100 } }, // Missing type
            { type: 'inductor', location: { x: 300, y: 100 } }, // Missing id
            null as any, // Null component
            undefined as any // Undefined component
          ],
          metadata: { temperature: 0.7, maxTokens: 1000 }
        }
      ];

      expect(async () => {
        await clustering.clusterComponents(responses);
      }).not.toThrow();

      const result = await clustering.clusterComponents(responses);
      expect(result.disagreements.some(d => d.type === 'malformed_data')).toBe(true);
    });
  });
});

// Helper functions
function createResponseWithComponents(
  provider: string, 
  content: string, 
  confidence: number, 
  components: any[]
): LLMResponse {
  return {
    provider,
    model: `${provider}-model`,
    response: content,
    confidence,
    responseTime: 1000,
    timestamp: new Date(),
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    components,
    metadata: { temperature: 0.7, maxTokens: 1000 }
  };
}

function createResponseWithoutComponents(
  provider: string, 
  content: string, 
  confidence: number
): LLMResponse {
  return {
    provider,
    model: `${provider}-model`,
    response: content,
    confidence,
    responseTime: 1000,
    timestamp: new Date(),
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    components: undefined,
    metadata: { temperature: 0.7, maxTokens: 1000 }
  };
}

function createResponseWithMalformedComponents(
  provider: string, 
  content: string, 
  confidence: number
): LLMResponse {
  return {
    provider,
    model: `${provider}-model`,
    response: content,
    confidence,
    responseTime: 1000,
    timestamp: new Date(),
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    components: [
      'invalid_component_string' as any,
      { invalid: 'structure' } as any,
      42 as any,
      [] as any
    ],
    metadata: { temperature: 0.7, maxTokens: 1000 }
  };
}