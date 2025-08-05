/**
 * Integration Tests: Confidence & Consensus System
 * 
 * Tests the complete consensus and confidence scoring pipeline with realistic
 * multi-model responses and end-to-end scenarios.
 */

import { AgreementAnalyzer } from '../../consensus/agreement.analyzer';
import { AdvancedConfidenceCalculator } from '../../confidence/advanced.confidence';
import { ComponentConsensusClustering } from '../../clustering/component.consensus';
import { ConsensusRankingService } from '../../ranking/consensus.ranking';
import { UncertaintyQuantificationService } from '../../uncertainty/quantification.service';
import { ConfidenceConfigManager, DEFAULT_CONSENSUS_CONFIG } from '../../config/confidence.config';
import { LLMResponse } from '../../../../llm-orchestrator/src/providers/base/LLMProvider.interface';

describe('Confidence & Consensus Integration Tests', () => {
  let agreementAnalyzer: AgreementAnalyzer;
  let confidenceCalculator: AdvancedConfidenceCalculator;
  let componentClustering: ComponentConsensusClustering;
  let rankingService: ConsensusRankingService;
  let uncertaintyService: UncertaintyQuantificationService;
  let configManager: ConfidenceConfigManager;

  beforeEach(() => {
    configManager = new ConfidenceConfigManager(DEFAULT_CONSENSUS_CONFIG);
    agreementAnalyzer = new AgreementAnalyzer();
    confidenceCalculator = new AdvancedConfidenceCalculator(configManager.getConfig());
    componentClustering = new ComponentConsensusClustering(configManager.getConfig());
    rankingService = new ConsensusRankingService(configManager.getConfig());
    uncertaintyService = new UncertaintyQuantificationService();
  });

  describe('End-to-End Pipeline Tests', () => {
    it('should process high-agreement electrical circuit analysis', async () => {
      const responses = createElectricalCircuitResponses();

      // Step 1: Agreement Analysis
      const agreement = agreementAnalyzer.calculateInterModelAgreement(responses);
      const disagreement = agreementAnalyzer.analyzeDisagreements(responses);

      // Step 2: Confidence Calculation
      const confidence = confidenceCalculator.calculateAdvancedConfidence(
        responses,
        agreement,
        disagreement
      );

      // Step 3: Component Clustering
      const componentConsensus = await componentClustering.clusterComponents(responses);

      // Step 4: Text Ranking
      const textRanking = await rankingService.rankResponsesByConsensus(responses);

      // Step 5: Uncertainty Quantification
      const uncertainty = uncertaintyService.quantifyUncertainty(
        responses,
        agreement,
        disagreement
      );

      // Verify end-to-end results
      expect(agreement.semanticSimilarity).toBeGreaterThan(0.7);
      expect(confidence.overallConfidence).toBeGreaterThan(0.8);
      expect(confidence.confidenceLevel).toBe('high');
      expect(componentConsensus.clusteredComponents.length).toBeGreaterThan(0);
      expect(textRanking.rankedResponses.length).toBe(3);
      expect(uncertainty.uncertaintyMeasures.variance).toBeLessThan(0.1);
      expect(uncertainty.qualityWarnings.length).toBe(0);
    });

    it('should handle disagreement scenario with low confidence', async () => {
      const responses = createDisagreementResponses();

      const agreement = agreementAnalyzer.calculateInterModelAgreement(responses);
      const disagreement = agreementAnalyzer.analyzeDisagreements(responses);
      const confidence = confidenceCalculator.calculateAdvancedConfidence(
        responses,
        agreement,
        disagreement
      );
      const uncertainty = uncertaintyService.quantifyUncertainty(
        responses,
        agreement,
        disagreement
      );

      expect(agreement.semanticSimilarity).toBeLessThan(0.5);
      expect(disagreement.hasSignificantDisagreement).toBe(true);
      expect(confidence.overallConfidence).toBeLessThan(0.6);
      expect(confidence.confidenceLevel).toBe('low');
      expect(uncertainty.disagreementClassification.level).toBe('high');
      expect(uncertainty.qualityWarnings.length).toBeGreaterThan(0);
    });

    it('should process component identification consensus correctly', async () => {
      const responses = createComponentIdentificationResponses();

      const agreement = agreementAnalyzer.calculateInterModelAgreement(responses);
      const componentConsensus = await componentClustering.clusterComponents(responses);
      const confidence = confidenceCalculator.calculateAdvancedConfidence(
        responses,
        agreement,
        agreementAnalyzer.analyzeDisagreements(responses)
      );

      expect(componentConsensus.clusteredComponents.length).toBe(3); // Expected clusters
      expect(componentConsensus.confidenceScores.length).toBe(3);
      expect(componentConsensus.spatialAgreement.averageDistance).toBeLessThan(50);
      
      // Verify component consensus affects overall confidence
      const avgComponentConfidence = componentConsensus.confidenceScores.reduce(
        (sum, score) => sum + score.confidence, 0
      ) / componentConsensus.confidenceScores.length;
      
      expect(confidence.factors.completeness).toBeCloseTo(avgComponentConfidence, 1);
    });

    it('should integrate uncertainty propagation across all systems', async () => {
      const responses = createMixedQualityResponses();

      const agreement = agreementAnalyzer.calculateInterModelAgreement(responses);
      const disagreement = agreementAnalyzer.analyzeDisagreements(responses);
      const confidence = confidenceCalculator.calculateAdvancedConfidence(
        responses,
        agreement,
        disagreement
      );
      const uncertainty = uncertaintyService.quantifyUncertainty(
        responses,
        agreement,
        disagreement
      );

      // Verify uncertainty propagation affects final confidence
      expect(uncertainty.uncertaintyPropagation.finalConfidence).toBeLessThanOrEqual(
        confidence.overallConfidence
      );
      expect(uncertainty.uncertaintyPropagation.propagatedUncertainty).toBeGreaterThan(0);
      expect(uncertainty.uncertaintyPropagation.uncertaintyComponents.length).toBeGreaterThan(2);

      // Verify propagation path is logical
      const propagationPath = uncertainty.uncertaintyPropagation.propagationPath;
      expect(propagationPath.some(step => step.source === 'individual_responses')).toBe(true);
      expect(propagationPath.some(step => step.target === 'consensus_confidence')).toBe(true);
    });
  });

  describe('Configuration Integration Tests', () => {
    it('should respect high precision configuration', async () => {
      configManager.loadPreset('high_precision');
      const config = configManager.getConfig();
      
      confidenceCalculator = new AdvancedConfidenceCalculator(config);
      componentClustering = new ComponentConsensusClustering(config);

      const responses = createMediumQualityResponses();
      const agreement = agreementAnalyzer.calculateInterModelAgreement(responses);
      const disagreement = agreementAnalyzer.analyzeDisagreements(responses);
      
      const confidence = confidenceCalculator.calculateAdvancedConfidence(
        responses,
        agreement,
        disagreement
      );

      // High precision should result in stricter thresholds
      expect(config.confidence.thresholds.high).toBe(0.9);
      expect(config.agreement.semanticSimilarityThreshold).toBe(0.8);
      
      // Same responses should get lower confidence level with high precision
      expect(confidence.confidenceLevel).toBe('medium'); // Would be 'high' with default config
    });

    it('should handle fast processing configuration', async () => {
      configManager.loadPreset('fast');
      const config = configManager.getConfig();
      
      confidenceCalculator = new AdvancedConfidenceCalculator(config);
      componentClustering = new ComponentConsensusClustering(config);

      const responses = createLargeResponseSet();
      const startTime = Date.now();

      const agreement = agreementAnalyzer.calculateInterModelAgreement(responses);
      const componentConsensus = await componentClustering.clusterComponents(responses);
      const confidence = confidenceCalculator.calculateAdvancedConfidence(
        responses,
        agreement,
        agreementAnalyzer.analyzeDisagreements(responses)
      );

      const processingTime = Date.now() - startTime;

      // Fast config should process quickly
      expect(processingTime).toBeLessThan(2000);
      expect(config.performance.maxProcessingTime).toBe(1000);
      expect(config.clustering.clusteringAlgorithm).toBe('kmeans'); // Fast algorithm
      expect(config.confidence.propagation.enablePropagation).toBe(false); // Disabled for speed
    });

    it('should adapt thresholds dynamically based on performance', () => {
      const historicalData = {
        avgConfidence: 0.85,
        successRate: 0.92,
        avgProcessingTime: 800,
        totalRequests: 1000
      };

      const initialThresholds = configManager.getConfig().confidence.thresholds;
      configManager.adjustDynamicThresholds(historicalData);
      const adjustedThresholds = configManager.getConfig().confidence.thresholds;

      // Good performance should make thresholds more strict
      expect(adjustedThresholds.high).toBeGreaterThan(initialThresholds.high);
      expect(adjustedThresholds.medium).toBeGreaterThan(initialThresholds.medium);
    });

    it('should create environment-specific configurations', () => {
      const devConfig = configManager.createEnvironmentConfig('development');
      const prodConfig = configManager.createEnvironmentConfig('production');

      // Development should be more lenient
      expect(devConfig.confidence.thresholds.high).toBeLessThan(prodConfig.confidence.thresholds.high);
      expect(devConfig.performance.maxProcessingTime).toBeGreaterThan(prodConfig.performance.maxProcessingTime);
      expect(devConfig.performance.cacheResults).toBe(false);
      expect(prodConfig.performance.cacheResults).toBe(true);
    });
  });

  describe('Performance Integration Tests', () => {
    it('should maintain performance requirements under load', async () => {
      const responses = createLargeResponseSet();
      const startTime = Date.now();

      const agreement = agreementAnalyzer.calculateInterModelAgreement(responses);
      const disagreement = agreementAnalyzer.analyzeDisagreements(responses);
      const confidence = confidenceCalculator.calculateAdvancedConfidence(
        responses,
        agreement,
        disagreement
      );
      const componentConsensus = await componentClustering.clusterComponents(responses);
      const uncertainty = uncertaintyService.quantifyUncertainty(
        responses,
        agreement,
        disagreement
      );

      const totalTime = Date.now() - startTime;

      // Should complete within 3 seconds as per requirements
      expect(totalTime).toBeLessThan(3000);
      expect(agreement).toBeDefined();
      expect(confidence.overallConfidence).toBeDefined();
      expect(componentConsensus.clusteredComponents.length).toBeGreaterThan(0);
      expect(uncertainty.uncertaintyMeasures).toBeDefined();
    });

    it('should handle memory efficiently with large datasets', async () => {
      const largeResponses = Array.from({ length: 50 }, (_, i) =>
        createMockResponse(
          `provider_${i % 3}`,
          `Large response content ${i}`.repeat(100),
          Math.random(),
          1000 + Math.random() * 1000
        )
      );

      const initialMemory = process.memoryUsage();

      const agreement = agreementAnalyzer.calculateInterModelAgreement(largeResponses);
      const confidence = confidenceCalculator.calculateAdvancedConfidence(
        largeResponses,
        agreement,
        agreementAnalyzer.analyzeDisagreements(largeResponses)
      );

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      expect(agreement).toBeDefined();
      expect(confidence).toBeDefined();
    });
  });

  describe('Error Handling Integration Tests', () => {
    it('should gracefully handle provider failures', async () => {
      const responsesWithFailures: LLMResponse[] = [
        createMockResponse('openai', 'Good response', 0.8),
        createFailedResponse('claude', 'Provider timeout'),
        createMockResponse('gemini', 'Another good response', 0.75)
      ];

      expect(async () => {
        const agreement = agreementAnalyzer.calculateInterModelAgreement(responsesWithFailures);
        const disagreement = agreementAnalyzer.analyzeDisagreements(responsesWithFailures);
        const confidence = confidenceCalculator.calculateAdvancedConfidence(
          responsesWithFailures,
          agreement,
          disagreement
        );
        const uncertainty = uncertaintyService.quantifyUncertainty(
          responsesWithFailures,
          agreement,
          disagreement
        );

        return { agreement, confidence, uncertainty };
      }).not.toThrow();
    });

    it('should handle invalid configuration gracefully', () => {
      const invalidConfig = {
        ...DEFAULT_CONSENSUS_CONFIG,
        confidence: {
          ...DEFAULT_CONSENSUS_CONFIG.confidence,
          factors: {
            agreement: -0.1, // Invalid negative weight
            quality: 1.5,   // Invalid weight > 1
            consistency: 0.2,
            coverage: 0.1,
            completeness: 0.1,
            uncertainty: 0.05
          }
        }
      };

      const validation = configManager.validateConfig(invalidConfig);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should handle extreme disagreement without crashing', async () => {
      const extremeResponses: LLMResponse[] = [
        createMockResponse('openai', 'This is definitely a resistor component', 0.95),
        createMockResponse('claude', 'This is clearly a capacitor element', 0.90),
        createMockResponse('gemini', 'This appears to be an inductor coil', 0.88)
      ];

      expect(async () => {
        const agreement = agreementAnalyzer.calculateInterModelAgreement(extremeResponses);
        const disagreement = agreementAnalyzer.analyzeDisagreements(extremeResponses);
        const confidence = confidenceCalculator.calculateAdvancedConfidence(
          extremeResponses,
          agreement,
          disagreement
        );

        expect(disagreement.hasSignificantDisagreement).toBe(true);
        expect(confidence.confidenceLevel).toBe('low');
        expect(confidence.overallConfidence).toBeLessThan(0.5);

        return { agreement, disagreement, confidence };
      }).not.toThrow();
    });
  });

  describe('Real-World Scenario Tests', () => {
    it('should handle electrical schematic analysis workflow', async () => {
      const schematicResponses = createSchematicAnalysisResponses();

      // Full workflow
      const agreement = agreementAnalyzer.calculateInterModelAgreement(schematicResponses);
      const disagreement = agreementAnalyzer.analyzeDisagreements(schematicResponses);
      const confidence = confidenceCalculator.calculateAdvancedConfidence(
        schematicResponses,
        agreement,
        disagreement
      );
      const componentConsensus = await componentClustering.clusterComponents(schematicResponses);
      const textRanking = await rankingService.rankResponsesByConsensus(schematicResponses);
      const uncertainty = uncertaintyService.quantifyUncertainty(
        schematicResponses,
        agreement,
        disagreement
      );

      // Verify realistic outcomes
      expect(componentConsensus.clusteredComponents.length).toBeGreaterThan(2);
      expect(textRanking.consensusText).toContain('circuit');
      expect(confidence.factors.completeness).toBeGreaterThan(0.5);
      expect(uncertainty.confidenceIntervals.length).toBeGreaterThan(0);
    });

    it('should handle partial provider responses', async () => {
      const partialResponses: LLMResponse[] = [
        createMockResponse('openai', 'Complete analysis of the electrical circuit...', 0.85),
        createPartialResponse('claude', 'Partial analysis due to...', 0.4),
        createMockResponse('gemini', 'Full analysis of components and connections...', 0.8)
      ];

      const agreement = agreementAnalyzer.calculateInterModelAgreement(partialResponses);
      const confidence = confidenceCalculator.calculateAdvancedConfidence(
        partialResponses,
        agreement,
        agreementAnalyzer.analyzeDisagreements(partialResponses)
      );

      expect(confidence.degradation.appliedPenalties).toContain('partial_response');
      expect(confidence.degradation.totalPenalty).toBeGreaterThan(0);
      expect(confidence.overallConfidence).toBeLessThan(0.8);
    });
  });
});

// Helper functions for creating test data
function createElectricalCircuitResponses(): LLMResponse[] {
  return [
    createMockResponse(
      'openai',
      'This electrical circuit contains a resistor (R1) with value 100Ω, a capacitor (C1) with 10µF capacity, and an LED connected in series with a 12V power supply.',
      0.88,
      1200,
      [
        { id: 'R1', type: 'resistor', value: '100Ω', location: { x: 100, y: 150 } },
        { id: 'C1', type: 'capacitor', value: '10µF', location: { x: 200, y: 150 } },
        { id: 'LED1', type: 'led', location: { x: 300, y: 150 } }
      ]
    ),
    createMockResponse(
      'claude',
      'The circuit diagram shows a series connection of a 100-ohm resistor, 10 microfarad capacitor, and LED, powered by a 12-volt DC source.',
      0.85,
      1100,
      [
        { id: 'R1', type: 'resistor', value: '100Ω', location: { x: 105, y: 152 } },
        { id: 'C1', type: 'capacitor', value: '10µF', location: { x: 198, y: 148 } },
        { id: 'LED1', type: 'led', location: { x: 302, y: 151 } }
      ]
    ),
    createMockResponse(
      'gemini',
      'Analysis shows an electrical circuit with resistor (100 ohms), capacitor (10 microfarads), and LED in series configuration with 12V supply.',
      0.82,
      1300,
      [
        { id: 'R1', type: 'resistor', value: '100Ω', location: { x: 98, y: 149 } },
        { id: 'C1', type: 'capacitor', value: '10µF', location: { x: 201, y: 153 } },
        { id: 'LED1', type: 'led', location: { x: 299, y: 148 } }
      ]
    )
  ];
}

function createDisagreementResponses(): LLMResponse[] {
  return [
    createMockResponse(
      'openai',
      'This is clearly a high-frequency amplifier circuit with operational amplifier IC and feedback resistors.',
      0.9,
      1000,
      [
        { id: 'IC1', type: 'op_amp', location: { x: 150, y: 100 } },
        { id: 'R1', type: 'resistor', value: '10kΩ', location: { x: 100, y: 50 } }
      ]
    ),
    createMockResponse(
      'claude',
      'The circuit appears to be a low-pass filter using passive components like resistors and capacitors.',
      0.7,
      1200,
      [
        { id: 'R1', type: 'resistor', value: '1kΩ', location: { x: 120, y: 80 } },
        { id: 'C1', type: 'capacitor', value: '100nF', location: { x: 180, y: 80 } }
      ]
    ),
    createMockResponse(
      'gemini',
      'This looks like a voltage regulator circuit with Zener diode and current limiting resistor.',
      0.6,
      1400,
      [
        { id: 'D1', type: 'zener_diode', value: '5.1V', location: { x: 160, y: 120 } },
        { id: 'R1', type: 'resistor', value: '220Ω', location: { x: 110, y: 120 } }
      ]
    )
  ];
}

function createComponentIdentificationResponses(): LLMResponse[] {
  return [
    createMockResponse(
      'openai',
      'Identified components: resistor at (100,100), capacitor at (200,100), and inductor at (300,100)',
      0.8,
      1000,
      [
        { id: 'R1', type: 'resistor', location: { x: 100, y: 100 } },
        { id: 'C1', type: 'capacitor', location: { x: 200, y: 100 } },
        { id: 'L1', type: 'inductor', location: { x: 300, y: 100 } }
      ]
    ),
    createMockResponse(
      'claude',
      'Components detected: resistor near (105,102), capacitor around (198,99), inductor at (302,101)',
      0.75,
      1100,
      [
        { id: 'R1', type: 'resistor', location: { x: 105, y: 102 } },
        { id: 'C1', type: 'capacitor', location: { x: 198, y: 99 } },
        { id: 'L1', type: 'inductor', location: { x: 302, y: 101 } }
      ]
    ),
    createMockResponse(
      'gemini',
      'Found: resistor (97,98), capacitor (201,103), inductor (298,99)',
      0.78,
      1200,
      [
        { id: 'R1', type: 'resistor', location: { x: 97, y: 98 } },
        { id: 'C1', type: 'capacitor', location: { x: 201, y: 103 } },
        { id: 'L1', type: 'inductor', location: { x: 298, y: 99 } }
      ]
    )
  ];
}

function createMixedQualityResponses(): LLMResponse[] {
  return [
    createMockResponse(
      'openai',
      'Detailed analysis: This complex circuit contains multiple stages including input filtering, amplification, and output buffering. The input stage uses a high-impedance buffer...',
      0.9,
      1500,
      Array.from({ length: 8 }, (_, i) => ({ id: `comp_${i}`, type: 'component', location: { x: i * 50, y: 100 } }))
    ),
    createMockResponse(
      'claude',
      'Circuit analysis shows basic amplifier configuration with standard components.',
      0.6,
      800,
      Array.from({ length: 3 }, (_, i) => ({ id: `comp_${i}`, type: 'component', location: { x: i * 50, y: 100 } }))
    ),
    createMockResponse(
      'gemini',
      'Simple circuit.',
      0.3,
      200,
      [{ id: 'comp_1', type: 'component', location: { x: 0, y: 100 } }]
    )
  ];
}

function createMediumQualityResponses(): LLMResponse[] {
  return [
    createMockResponse('openai', 'Medium quality analysis with decent detail level', 0.7, 900),
    createMockResponse('claude', 'Reasonable analysis with some technical content', 0.68, 850),
    createMockResponse('gemini', 'Acceptable analysis with moderate coverage', 0.72, 950)
  ];
}

function createLargeResponseSet(): LLMResponse[] {
  return Array.from({ length: 20 }, (_, i) =>
    createMockResponse(
      `provider_${i % 5}`,
      `Response ${i} with varying content and analysis depth`,
      0.6 + Math.random() * 0.3,
      800 + Math.random() * 400,
      Array.from({ length: Math.floor(Math.random() * 10) }, (_, j) => ({
        id: `comp_${i}_${j}`,
        type: 'component',
        location: { x: j * 30, y: i * 20 }
      }))
    )
  );
}

function createSchematicAnalysisResponses(): LLMResponse[] {
  return [
    createMockResponse(
      'openai',
      'Schematic analysis reveals a multi-stage amplifier circuit with input coupling, gain stage, and output buffer. Components include op-amps, resistors, and capacitors.',
      0.85,
      1400,
      [
        { id: 'IC1', type: 'op_amp', location: { x: 150, y: 100 } },
        { id: 'IC2', type: 'op_amp', location: { x: 300, y: 100 } },
        { id: 'R1', type: 'resistor', value: '10kΩ', location: { x: 100, y: 50 } },
        { id: 'R2', type: 'resistor', value: '100kΩ', location: { x: 200, y: 50 } },
        { id: 'C1', type: 'capacitor', value: '1µF', location: { x: 50, y: 100 } }
      ]
    ),
    createMockResponse(
      'claude',
      'The schematic shows an amplifier design with operational amplifiers and supporting passive components for signal conditioning.',
      0.80,
      1300,
      [
        { id: 'IC1', type: 'op_amp', location: { x: 148, y: 102 } },
        { id: 'IC2', type: 'op_amp', location: { x: 302, y: 98 } },
        { id: 'R1', type: 'resistor', value: '10kΩ', location: { x: 102, y: 52 } },
        { id: 'R2', type: 'resistor', value: '100kΩ', location: { x: 198, y: 48 } },
        { id: 'C1', type: 'capacitor', value: '1µF', location: { x: 52, y: 101 } }
      ]
    ),
    createMockResponse(
      'gemini',
      'Circuit schematic contains operational amplifier stages with feedback networks and input/output coupling components.',
      0.78,
      1200,
      [
        { id: 'IC1', type: 'op_amp', location: { x: 152, y: 99 } },
        { id: 'IC2', type: 'op_amp', location: { x: 299, y: 102 } },
        { id: 'R1', type: 'resistor', value: '10kΩ', location: { x: 99, y: 49 } },
        { id: 'R2', type: 'resistor', value: '100kΩ', location: { x: 201, y: 51 } },
        { id: 'C1', type: 'capacitor', value: '1µF', location: { x: 48, y: 99 } }
      ]
    )
  ];
}

function createPartialResponse(provider: string, content: string, confidence: number): LLMResponse {
  return {
    ...createMockResponse(provider, content, confidence),
    metadata: { 
      ...createMockResponse(provider, content, confidence).metadata, 
      partial: true,
      reason: 'timeout'
    }
  };
}

function createFailedResponse(provider: string, error: string): any {
  return {
    provider,
    model: `${provider}-model`,
    response: null,
    confidence: 0,
    responseTime: 0,
    timestamp: new Date(),
    error,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    components: [],
    metadata: { failed: true }
  };
}

function createMockResponse(
  provider: string,
  content: string,
  confidence: number,
  responseTime: number = 1000,
  components: any[] = []
): LLMResponse {
  return {
    provider,
    model: `${provider}-model`,
    response: content,
    confidence,
    responseTime,
    timestamp: new Date(),
    usage: {
      promptTokens: Math.floor(content.length / 4),
      completionTokens: Math.floor(content.length / 4),
      totalTokens: Math.floor(content.length / 2)
    },
    components,
    metadata: {
      temperature: 0.7,
      maxTokens: 1000
    }
  };
}