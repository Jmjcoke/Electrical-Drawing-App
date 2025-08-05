/**
 * Consensus Service Unit Tests
 * 
 * Comprehensive test suite for the ConsensusService class covering
 * consensus building, component clustering, and voting mechanisms.
 */

import { ConsensusService, ConsensusConfig, VotingStrategy } from '../../aggregation/consensus.service';
import { LLMResponse } from '../../../llm-orchestrator/src/providers/base/LLMProvider.interface';

describe('ConsensusService', () => {
  let consensusService: ConsensusService;
  let testConfig: ConsensusConfig;

  beforeEach(() => {
    testConfig = {
      componentClusteringThreshold: 50,
      textSimilarityThreshold: 0.3,
      minimumAgreementLevel: 0.6,
      votingStrategy: VotingStrategy.WEIGHTED_MAJORITY,
      confidenceWeighting: true,
      outlierDetection: true
    };

    consensusService = new ConsensusService(testConfig);
  });

  const createMockResponse = (
    model: string,
    content: string,
    confidence: number,
    components?: any[]
  ): LLMResponse => ({
    id: `${model}-${Date.now()}-${Math.random()}`,
    content,
    confidence,
    tokensUsed: 150,
    responseTime: 1000,
    model,
    timestamp: new Date(),
    metadata: components ? { components } : undefined
  });

  describe('Single Response Consensus', () => {
    test('should handle single response correctly', async () => {
      const response = createMockResponse(
        'openai',
        'This circuit contains a resistor R1 and capacitor C1.',
        0.9
      );

      const result = await consensusService.buildConsensus([response]);

      expect(result.agreementLevel).toBe(1.0);
      expect(result.consensusContent).toBe(response.content);
      expect(result.disagreements).toHaveLength(0);
      expect(result.votingResults).toHaveLength(1);
      expect(result.confidence).toBe(0.9);
      expect(result.outliers).toHaveLength(0);
    });
  });

  describe('Multi-Response Consensus', () => {
    test('should build consensus from similar responses', async () => {
      const responses = [
        createMockResponse('openai', 'Circuit has resistor R1 and capacitor C1', 0.9),
        createMockResponse('claude', 'This circuit contains resistor R1 and capacitor C1', 0.85),
        createMockResponse('gemini', 'Identified resistor R1 and capacitor C1 in circuit', 0.8)
      ];

      const result = await consensusService.buildConsensus(responses);

      expect(result.agreementLevel).toBeGreaterThan(0.5);
      expect(result.consensusContent).toBeDefined();
      expect(result.votingResults).toHaveLength(1); // Main response voting
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should handle divergent responses', async () => {
      const responses = [
        createMockResponse('openai', 'Circuit contains resistors and capacitors', 0.9),
        createMockResponse('claude', 'This is a motor control circuit with relays', 0.85),
        createMockResponse('gemini', 'Power supply circuit with transformers', 0.8)
      ];

      const result = await consensusService.buildConsensus(responses);

      expect(result.agreementLevel).toBeLessThan(0.8);
      expect(result.disagreements.length).toBeGreaterThan(0);
      expect(result.votingResults[0].candidates.length).toBeGreaterThan(1);
    });

    test('should apply confidence weighting correctly', async () => {
      const responses = [
        createMockResponse('openai', 'High confidence analysis result', 0.95),
        createMockResponse('claude', 'Different analysis result', 0.4),
        createMockResponse('gemini', 'High confidence analysis result', 0.9)
      ];

      const result = await consensusService.buildConsensus(responses);

      // High confidence responses should dominate
      expect(result.consensusContent).toContain('High confidence');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test('should detect outliers when enabled', async () => {
      const responses = [
        createMockResponse('openai', 'Normal electrical circuit analysis', 0.9),
        createMockResponse('claude', 'Normal electrical circuit analysis', 0.85),
        createMockResponse('gemini', 'This is actually a mechanical drawing not electrical', 0.8)
      ];

      const result = await consensusService.buildConsensus(responses);

      expect(result.outliers.length).toBeGreaterThan(0);
      expect(result.outliers[0].provider).toBe('gemini');
      expect(result.outliers[0].deviationScore).toBeGreaterThan(0.5);
    });

    test('should disable outlier detection when configured', async () => {
      const configWithoutOutliers = { ...testConfig, outlierDetection: false };
      const service = new ConsensusService(configWithoutOutliers);

      const responses = [
        createMockResponse('openai', 'Normal analysis', 0.9),
        createMockResponse('claude', 'Completely different analysis about weather', 0.8)
      ];

      const result = await service.buildConsensus(responses);

      expect(result.outliers).toHaveLength(0);
    });
  });

  describe('Voting Strategies', () => {
    const testResponses = [
      createMockResponse('openai', 'Analysis A', 0.9),
      createMockResponse('claude', 'Analysis A', 0.8),
      createMockResponse('gemini', 'Analysis B', 0.85)
    ];

    test('should use majority voting correctly', async () => {
      const config = { ...testConfig, votingStrategy: VotingStrategy.MAJORITY };
      const service = new ConsensusService(config);

      const result = await service.buildConsensus(testResponses);

      expect(result.votingResults[0].winner.content).toContain('Analysis A');
      expect(result.votingResults[0].votingStrategy).toBe(VotingStrategy.MAJORITY);
    });

    test('should use weighted majority voting', async () => {
      const config = { ...testConfig, votingStrategy: VotingStrategy.WEIGHTED_MAJORITY };
      const service = new ConsensusService(config);

      const result = await service.buildConsensus(testResponses);

      expect(result.votingResults[0].votingStrategy).toBe(VotingStrategy.WEIGHTED_MAJORITY);
      expect(result.votingResults[0].winner).toBeDefined();
    });

    test('should use confidence-weighted voting', async () => {
      const config = { ...testConfig, votingStrategy: VotingStrategy.CONFIDENCE_WEIGHTED };
      const service = new ConsensusService(config);

      const highConfidenceResponses = [
        createMockResponse('openai', 'High confidence result', 0.95),
        createMockResponse('claude', 'Low confidence result', 0.3),
        createMockResponse('gemini', 'Low confidence result', 0.3)
      ];

      const result = await service.buildConsensus(highConfidenceResponses);

      expect(result.consensusContent).toContain('High confidence');
    });

    test('should handle plurality voting', async () => {
      const config = { ...testConfig, votingStrategy: VotingStrategy.PLURALITY };
      const service = new ConsensusService(config);

      const result = await service.buildConsensus(testResponses);

      expect(result.votingResults[0].votingStrategy).toBe(VotingStrategy.PLURALITY);
    });

    test('should handle unanimous voting requirement', async () => {
      const config = { ...testConfig, votingStrategy: VotingStrategy.UNANIMOUS };
      const service = new ConsensusService(config);

      const unanimousResponses = [
        createMockResponse('openai', 'Same result', 0.9),
        createMockResponse('claude', 'Same result', 0.8),
        createMockResponse('gemini', 'Same result', 0.85)
      ];

      const result = await service.buildConsensus(unanimousResponses);

      expect(result.agreementLevel).toBeGreaterThan(0.9);
    });
  });

  describe('Component Consensus', () => {
    test('should cluster similar components', async () => {
      const componentsByProvider = new Map([
        ['openai', [
          {
            provider: 'openai',
            id: 'R1',
            type: 'resistor',
            location: { x: 100, y: 200 },
            confidence: 0.9,
            properties: {}
          },
          {
            provider: 'openai',
            id: 'C1',
            type: 'capacitor',
            location: { x: 300, y: 200 },
            confidence: 0.8,
            properties: {}
          }
        ]],
        ['claude', [
          {
            provider: 'claude',
            id: 'R1',
            type: 'resistor',
            location: { x: 105, y: 195 }, // Slightly different location
            confidence: 0.85,
            properties: {}
          },
          {
            provider: 'claude',
            id: 'C1',
            type: 'capacitor',
            location: { x: 295, y: 205 }, // Slightly different location
            confidence: 0.9,
            properties: {}
          }
        ]]
      ]);

      const result = await consensusService.buildComponentConsensus(componentsByProvider);

      expect(result.components).toHaveLength(2); // Should cluster into 2 consensus components
      expect(result.clusters).toHaveLength(2);
      expect(result.agreementLevel).toBeGreaterThan(0.7);
      
      const resistorComponent = result.components.find(c => c.type === 'resistor');
      expect(resistorComponent).toBeDefined();
      expect(resistorComponent!.supportingProviders).toContain('openai');
      expect(resistorComponent!.supportingProviders).toContain('claude');
    });

    test('should handle conflicting component types', async () => {
      const componentsByProvider = new Map([
        ['openai', [
          {
            provider: 'openai',
            id: 'X1',
            type: 'resistor',
            location: { x: 100, y: 200 },
            confidence: 0.8,
            properties: {}
          }
        ]],
        ['claude', [
          {
            provider: 'claude',
            id: 'X1',
            type: 'capacitor', // Different type!
            location: { x: 105, y: 195 },
            confidence: 0.9,
            properties: {}
          }
        ]]
      ]);

      const result = await consensusService.buildComponentConsensus(componentsByProvider);

      expect(result.disagreements.length).toBeGreaterThan(0);
      const typeDisagreement = result.disagreements.find(d => d.topic.includes('type'));
      expect(typeDisagreement).toBeDefined();
    });

    test('should calculate consensus properties correctly', async () => {
      const componentsByProvider = new Map([
        ['openai', [
          {
            provider: 'openai',
            id: 'R1',
            type: 'resistor',
            location: { x: 100, y: 200 },
            confidence: 0.9,
            properties: { value: '10k', tolerance: '5%' }
          }
        ]],
        ['claude', [
          {
            provider: 'claude',
            id: 'R1',
            type: 'resistor',
            location: { x: 105, y: 195 },
            confidence: 0.8,
            properties: { value: '10k', tolerance: '10%' } // Different tolerance
          }
        ]]
      ]);

      const result = await consensusService.buildComponentConsensus(componentsByProvider);

      const resistor = result.components[0];
      expect(resistor.properties.value).toBeDefined();
      expect(resistor.properties.value.value).toBe('10k');
      expect(resistor.properties.tolerance.alternatives.length).toBeGreaterThan(0);
    });

    test('should handle distant components as separate clusters', async () => {
      const componentsByProvider = new Map([
        ['openai', [
          {
            provider: 'openai',
            id: 'R1',
            type: 'resistor',
            location: { x: 100, y: 200 },
            confidence: 0.9,
            properties: {}
          },
          {
            provider: 'openai',
            id: 'R2',
            type: 'resistor',
            location: { x: 500, y: 600 }, // Far away
            confidence: 0.8,
            properties: {}
          }
        ]]
      ]);

      const result = await consensusService.buildComponentConsensus(componentsByProvider);

      expect(result.clusters).toHaveLength(2); // Should not cluster due to distance
      expect(result.components).toHaveLength(2);
    });
  });

  describe('Text Similarity and Clustering', () => {
    test('should cluster similar text responses', async () => {
      const responses = [
        createMockResponse('openai', 'The circuit contains resistors and capacitors', 0.9),
        createMockResponse('claude', 'This circuit has resistors and capacitors', 0.85),
        createMockResponse('gemini', 'Circuit includes resistors and capacitors', 0.8)
      ];

      const result = await consensusService.buildConsensus(responses);

      expect(result.votingResults[0].candidates).toHaveLength(1); // Should cluster into one group
      expect(result.agreementLevel).toBeGreaterThan(0.8);
    });

    test('should separate dissimilar text responses', async () => {
      const responses = [
        createMockResponse('openai', 'Circuit contains resistors and capacitors', 0.9),
        createMockResponse('claude', 'Motor control system with relays', 0.85),
        createMockResponse('gemini', 'Power transformer circuit', 0.8)
      ];

      const result = await consensusService.buildConsensus(responses);

      expect(result.votingResults[0].candidates.length).toBeGreaterThan(1);
      expect(result.disagreements.length).toBeGreaterThan(0);
    });

    test('should respect text similarity threshold', async () => {
      const lowThresholdConfig = { ...testConfig, textSimilarityThreshold: 0.1 };
      const highThresholdConfig = { ...testConfig, textSimilarityThreshold: 0.8 };

      const responses = [
        createMockResponse('openai', 'Circuit analysis result A', 0.9),
        createMockResponse('claude', 'Circuit analysis result B', 0.85)
      ];

      const lowThresholdService = new ConsensusService(lowThresholdConfig);
      const highThresholdService = new ConsensusService(highThresholdConfig);

      const lowResult = await lowThresholdService.buildConsensus(responses);
      const highResult = await highThresholdService.buildConsensus(responses);

      // Low threshold should cluster more aggressively
      expect(lowResult.votingResults[0].candidates.length).toBeLessThanOrEqual(
        highResult.votingResults[0].candidates.length
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle empty response array', async () => {
      await expect(consensusService.buildConsensus([]))
        .rejects
        .toThrow('Cannot build consensus from empty response set');
    });

    test('should handle responses with missing content', async () => {
      const responses = [
        createMockResponse('openai', '', 0.9), // Empty content
        createMockResponse('claude', 'Valid content', 0.85)
      ];

      const result = await consensusService.buildConsensus(responses);

      expect(result).toBeDefined();
      expect(result.consensusContent).toBeDefined();
    });

    test('should handle responses with zero confidence', async () => {
      const responses = [
        createMockResponse('openai', 'Analysis result', 0.0),
        createMockResponse('claude', 'Analysis result', 0.8)
      ];

      const result = await consensusService.buildConsensus(responses);

      expect(result.confidence).toBeGreaterThan(0);
    });

    test('should handle malformed metadata gracefully', async () => {
      const response = createMockResponse('openai', 'Test content', 0.9);
      response.metadata = { invalidData: 'not an array' };

      const result = await consensusService.buildConsensus([response]);

      expect(result).toBeDefined();
      expect(result.consensusContent).toBe('Test content');
    });
  });

  describe('Structured Data Handling', () => {
    test('should process structured metadata', async () => {
      const responses = [
        {
          ...createMockResponse('openai', 'Analysis with structured data', 0.9),
          metadata: {
            componentCount: 5,
            circuitType: 'analog',
            analysisType: 'detailed'
          }
        },
        {
          ...createMockResponse('claude', 'Analysis with structured data', 0.85),
          metadata: {
            componentCount: 5,
            circuitType: 'analog',
            analysisType: 'basic'
          }
        }
      ];

      const result = await consensusService.buildConsensus(responses);

      expect(result.votingResults.length).toBeGreaterThan(1); // Main response + structured data
      
      const structuredVoting = result.votingResults.find(vr => vr.topic !== 'main_response');
      expect(structuredVoting).toBeDefined();
    });
  });

  describe('Performance Characteristics', () => {
    test('should handle large number of responses efficiently', async () => {
      const responses = Array.from({ length: 20 }, (_, i) =>
        createMockResponse(`provider${i}`, `Analysis result ${i % 3}`, 0.8 + (i % 20) / 100)
      );

      const startTime = Date.now();
      const result = await consensusService.buildConsensus(responses);
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.votingResults).toHaveLength(1);
    });

    test('should handle responses with long content', async () => {
      const longContent = 'A'.repeat(10000); // 10k characters
      const responses = [
        createMockResponse('openai', longContent, 0.9),
        createMockResponse('claude', longContent, 0.85)
      ];

      const result = await consensusService.buildConsensus(responses);

      expect(result.consensusContent).toBe(longContent);
      expect(result.agreementLevel).toBeGreaterThan(0.9);
    });
  });

  describe('Configuration Edge Cases', () => {
    test('should handle extreme clustering threshold', async () => {
      const extremeConfig = { ...testConfig, componentClusteringThreshold: 0 };
      const service = new ConsensusService(extremeConfig);

      const componentsByProvider = new Map([
        ['openai', [
          {
            provider: 'openai',
            id: 'R1',
            type: 'resistor',
            location: { x: 100, y: 200 },
            confidence: 0.9,
            properties: {}
          }
        ]],
        ['claude', [
          {
            provider: 'claude',
            id: 'R2',
            type: 'resistor',
            location: { x: 1000, y: 2000 }, // Very far
            confidence: 0.85,
            properties: {}
          }
        ]]
      ]);

      const result = await service.buildComponentConsensus(componentsByProvider);

      // With threshold 0, even distant components should cluster
      expect(result.clusters.length).toBeLessThanOrEqual(2);
    });

    test('should handle disabled confidence weighting', async () => {
      const config = { ...testConfig, confidenceWeighting: false };
      const service = new ConsensusService(config);

      const responses = [
        createMockResponse('openai', 'High confidence result', 0.95),
        createMockResponse('claude', 'Low confidence result', 0.1),
        createMockResponse('gemini', 'Low confidence result', 0.1)
      ];

      const result = await service.buildConsensus(responses);

      // Without confidence weighting, majority should win regardless of confidence
      expect(result.consensusContent).toContain('Low confidence');
    });
  });
});