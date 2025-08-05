/**
 * Unit Tests: Advanced Confidence Calculator
 * 
 * Testing multi-factor confidence calculations with various response scenarios,
 * degradation handling, and confidence propagation.
 */

import { AdvancedConfidenceCalculator, AdvancedConfidenceResult, ConfidenceFactors } from '../../confidence/advanced.confidence';
import { AgreementMeasures, DisagreementAnalysis } from '../../consensus/agreement.analyzer';
import { LLMResponse } from '../../../../llm-orchestrator/src/providers/base/LLMProvider.interface';
import { ConsensusConfidenceConfig, DEFAULT_CONSENSUS_CONFIG } from '../../config/confidence.config';

describe('AdvancedConfidenceCalculator', () => {
  let calculator: AdvancedConfidenceCalculator;
  let mockConfig: ConsensusConfidenceConfig;

  beforeEach(() => {
    mockConfig = { ...DEFAULT_CONSENSUS_CONFIG };
    calculator = new AdvancedConfidenceCalculator(mockConfig);
  });

  describe('calculateAdvancedConfidence', () => {
    it('should calculate high confidence for agreeable high-quality responses', () => {
      const responses = createHighQualityResponses();
      const agreement = createHighAgreementMeasures();
      const disagreement = createLowDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.overallConfidence).toBeGreaterThan(0.8);
      expect(result.factors.agreement).toBeGreaterThan(0.8);
      expect(result.factors.quality).toBeGreaterThan(0.7);
      expect(result.factors.consistency).toBeGreaterThan(0.8);
      expect(result.confidenceLevel).toBe('high');
    });

    it('should calculate low confidence for disagreeable low-quality responses', () => {
      const responses = createLowQualityResponses();
      const agreement = createLowAgreementMeasures();
      const disagreement = createHighDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.overallConfidence).toBeLessThan(0.5);
      expect(result.factors.agreement).toBeLessThan(0.5);
      expect(result.factors.quality).toBeLessThan(0.5);
      expect(result.confidenceLevel).toBe('low');
    });

    it('should handle empty responses array', () => {
      const responses: LLMResponse[] = [];
      const agreement = createZeroAgreementMeasures();
      const disagreement = createEmptyDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.overallConfidence).toBe(0);
      expect(result.confidenceLevel).toBe('critical');
      expect(result.factors.coverage).toBe(0);
    });

    it('should handle single response correctly', () => {
      const responses = [createMockResponse('openai', 'Single response', 0.8)];
      const agreement = createSingleResponseAgreementMeasures();
      const disagreement = createEmptyDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.overallConfidence).toBeGreaterThan(0.4);
      expect(result.overallConfidence).toBeLessThan(0.8); // Penalized for single response
      expect(result.factors.coverage).toBeLessThan(0.5);
      expect(result.qualityWarnings).toContain('Single provider response - limited consensus validation');
    });

    it('should apply factor weights correctly', () => {
      const customConfig = {
        ...mockConfig,
        confidence: {
          ...mockConfig.confidence,
          factors: {
            agreement: 0.5,
            quality: 0.3,
            consistency: 0.1,
            coverage: 0.05,
            completeness: 0.04,
            uncertainty: 0.01
          }
        }
      };
      calculator = new AdvancedConfidenceCalculator(customConfig);

      const responses = createMixedQualityResponses();
      const agreement = createMediumAgreementMeasures();
      const disagreement = createMediumDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      // Agreement should have highest impact (0.5 weight)
      expect(result.factors.agreement * 0.5).toBeGreaterThan(result.factors.quality * 0.3);
      expect(result.breakdown.weightedContributions.agreement).toBeGreaterThan(
        result.breakdown.weightedContributions.quality
      );
    });

    it('should normalize confidence scores correctly', () => {
      const responses = createExtremeConfidenceResponses();
      const agreement = createMediumAgreementMeasures();
      const disagreement = createMediumDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
      expect(result.factors.agreement).toBeGreaterThanOrEqual(0);
      expect(result.factors.agreement).toBeLessThanOrEqual(1);
    });
  });

  describe('Confidence Factor Calculations', () => {
    it('should calculate agreement factor from agreement measures', () => {
      const responses = createHighQualityResponses();
      const agreement: AgreementMeasures = {
        semanticSimilarity: 0.9,
        structuralSimilarity: 0.85,
        correlationCoefficient: { pearson: 0.8, spearman: 0.82, kendall: 0.78 },
        variance: 0.02,
        entropy: 0.1,
        outlierCount: 0
      };
      const disagreement = createLowDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.factors.agreement).toBeGreaterThan(0.8);
      expect(result.breakdown.factorDetails.agreement).toContain('High semantic similarity');
    });

    it('should calculate quality factor from response characteristics', () => {
      const responses = [
        createMockResponse('openai', 'Very detailed and comprehensive response with technical specificity', 0.9, 800),
        createMockResponse('claude', 'Another detailed technical response with good coverage', 0.85, 750),
        createMockResponse('gemini', 'Comprehensive analysis with specific details', 0.88, 900)
      ];
      const agreement = createHighAgreementMeasures();
      const disagreement = createLowDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.factors.quality).toBeGreaterThan(0.7);
      expect(result.breakdown.factorDetails.quality).toContain('Good response length distribution');
    });

    it('should calculate consistency factor from response time variance', () => {
      const responses = [
        createMockResponse('openai', 'Response', 0.8, 1000),
        createMockResponse('claude', 'Response', 0.8, 1100), // Consistent timing
        createMockResponse('gemini', 'Response', 0.8, 900)
      ];
      const agreement = createHighAgreementMeasures();
      const disagreement = createLowDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.factors.consistency).toBeGreaterThan(0.6);
    });

    it('should calculate coverage factor from provider diversity', () => {
      const responses = [
        createMockResponse('openai', 'Response A', 0.8),
        createMockResponse('claude', 'Response B', 0.8),
        createMockResponse('gemini', 'Response C', 0.8),
        createMockResponse('custom', 'Response D', 0.8) // Additional provider
      ];
      const agreement = createHighAgreementMeasures();
      const disagreement = createLowDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.factors.coverage).toBeGreaterThan(0.8);
      expect(result.breakdown.factorDetails.coverage).toContain('Excellent provider diversity');
    });

    it('should calculate completeness factor from response content', () => {
      const responses = [
        createMockResponseWithComponents('openai', 'Complete response', 0.8, 1000, 5),
        createMockResponseWithComponents('claude', 'Complete response', 0.8, 1000, 5),
        createMockResponseWithComponents('gemini', 'Complete response', 0.8, 1000, 4)
      ];
      const agreement = createHighAgreementMeasures();
      const disagreement = createLowDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.factors.completeness).toBeGreaterThan(0.6);
    });

    it('should calculate uncertainty factor from disagreement analysis', () => {
      const responses = createHighQualityResponses();
      const agreement = createHighAgreementMeasures();
      const disagreement: DisagreementAnalysis = {
        hasSignificantDisagreement: false,
        disagreementScore: 0.1,
        consensus: { semantic: 0.9, confidence: 0.85, structural: 0.9 },
        outliers: []
      };

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.factors.uncertainty).toBeGreaterThan(0.8);
      expect(result.breakdown.factorDetails.uncertainty).toContain('Low uncertainty detected');
    });
  });

  describe('Degradation Handling', () => {
    it('should apply partial response penalty', () => {
      const responses = [
        createMockResponse('openai', 'Complete response', 0.9),
        createPartialResponse('claude', 'Partial...', 0.7), // Partial response
        createMockResponse('gemini', 'Complete response', 0.8)
      ];
      const agreement = createMediumAgreementMeasures();
      const disagreement = createMediumDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.degradation.appliedPenalties).toContain('partial_response');
      expect(result.degradation.totalPenalty).toBeGreaterThan(0);
      expect(result.overallConfidence).toBeLessThan(0.8);
    });

    it('should apply missing data penalty', () => {
      const responses = [
        createMockResponse('openai', 'Response with data', 0.8),
        createMockResponseWithMissingData('claude', 'Response without components', 0.7)
      ];
      const agreement = createLowAgreementMeasures();
      const disagreement = createHighDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.degradation.appliedPenalties).toContain('missing_data');
      expect(result.degradation.totalPenalty).toBeGreaterThan(0);
    });

    it('should apply timeout penalty for slow responses', () => {
      const responses = [
        createMockResponse('openai', 'Normal response', 0.8, 1000),
        createMockResponse('claude', 'Slow response', 0.7, 8000), // Timeout scenario
        createMockResponse('gemini', 'Normal response', 0.8, 1200)
      ];
      const agreement = createMediumAgreementMeasures();
      const disagreement = createMediumDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.degradation.appliedPenalties).toContain('timeout');
      expect(result.degradation.totalPenalty).toBeGreaterThan(0);
    });

    it('should disable degradation when configured', () => {
      const noDegradationConfig = {
        ...mockConfig,
        confidence: {
          ...mockConfig.confidence,
          degradationHandling: {
            ...mockConfig.confidence.degradationHandling,
            enableDegradation: false
          }
        }
      };
      calculator = new AdvancedConfidenceCalculator(noDegradationConfig);

      const responses = [createPartialResponse('openai', 'Partial response', 0.5)];
      const agreement = createLowAgreementMeasures();
      const disagreement = createHighDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.degradation.appliedPenalties).toHaveLength(0);
      expect(result.degradation.totalPenalty).toBe(0);
    });
  });

  describe('Confidence Propagation', () => {
    it('should propagate confidence through analysis pipeline', () => {
      const responses = createMediumQualityResponses();
      const agreement = createMediumAgreementMeasures();
      const disagreement = createMediumDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.propagation.enabled).toBe(true);
      expect(result.propagation.confidenceDecay).toBeGreaterThan(0);
      expect(result.propagation.uncertaintyAmplification).toBeGreaterThan(1);
      expect(result.propagation.finalConfidence).toBeLessThanOrEqual(result.overallConfidence);
    });

    it('should handle cross-factor influence', () => {
      const responses = createMixedQualityResponses();
      const agreement = createMediumAgreementMeasures();
      const disagreement = createMediumDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.propagation.crossFactorInfluence).toBe(true);
      expect(result.propagation.influenceMatrix).toBeDefined();
      expect(Object.keys(result.propagation.influenceMatrix)).toContain('agreement');
    });

    it('should disable propagation when configured', () => {
      const noPropagationConfig = {
        ...mockConfig,
        confidence: {
          ...mockConfig.confidence,
          propagation: {
            ...mockConfig.confidence.propagation,
            enablePropagation: false
          }
        }
      };
      calculator = new AdvancedConfidenceCalculator(noPropagationConfig);

      const responses = createMediumQualityResponses();
      const agreement = createMediumAgreementMeasures();
      const disagreement = createMediumDisagreementAnalysis();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.propagation.enabled).toBe(false);
      expect(result.propagation.finalConfidence).toBe(result.overallConfidence);
    });
  });

  describe('Confidence Levels and Thresholds', () => {
    it('should classify confidence levels correctly', () => {
      const testCases = [
        { confidence: 0.9, expectedLevel: 'high' },
        { confidence: 0.7, expectedLevel: 'medium' },
        { confidence: 0.5, expectedLevel: 'low' },
        { confidence: 0.1, expectedLevel: 'critical' }
      ];

      testCases.forEach(({ confidence, expectedLevel }) => {
        const responses = createResponsesWithConfidence(confidence);
        const agreement = createAgreementForConfidence(confidence);
        const disagreement = createDisagreementForConfidence(confidence);

        const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

        expect(result.confidenceLevel).toBe(expectedLevel);
      });
    });

    it('should respect custom thresholds', () => {
      const customConfig = {
        ...mockConfig,
        confidence: {
          ...mockConfig.confidence,
          thresholds: {
            high: 0.9,
            medium: 0.7,
            low: 0.5,
            critical: 0.3
          }
        }
      };
      calculator = new AdvancedConfidenceCalculator(customConfig);

      const responses = createResponsesWithConfidence(0.75);
      const agreement = createAgreementForConfidence(0.75);
      const disagreement = createDisagreementForConfidence(0.75);

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.confidenceLevel).toBe('medium'); // Should be medium with 0.75 confidence
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle responses with invalid confidence values', () => {
      const responses = [
        createMockResponse('openai', 'Response', -0.5), // Invalid
        createMockResponse('claude', 'Response', 1.5),  // Invalid
        createMockResponse('gemini', 'Response', 0.8)
      ];
      const agreement = createMediumAgreementMeasures();
      const disagreement = createMediumDisagreementAnalysis();

      expect(() => {
        calculator.calculateAdvancedConfidence(responses, agreement, disagreement);
      }).not.toThrow();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });

    it('should handle extreme disagreement scenarios', () => {
      const responses = createHighQualityResponses();
      const agreement: AgreementMeasures = {
        semanticSimilarity: 0.1,
        structuralSimilarity: 0.05,
        correlationCoefficient: { pearson: -0.8, spearman: -0.7, kendall: -0.6 },
        variance: 0.9,
        entropy: 0.95,
        outlierCount: 2
      };
      const disagreement: DisagreementAnalysis = {
        hasSignificantDisagreement: true,
        disagreementScore: 0.95,
        consensus: { semantic: 0.1, confidence: 0.2, structural: 0.05 },
        outliers: [
          { provider: 'openai', deviationScore: 0.9, reasons: ['semantic', 'confidence'] },
          { provider: 'claude', deviationScore: 0.85, reasons: ['semantic'] }
        ]
      };

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);

      expect(result.overallConfidence).toBeLessThan(0.3);
      expect(result.confidenceLevel).toBe('critical');
      expect(result.qualityWarnings.length).toBeGreaterThan(0);
    });

    it('should handle numerical precision issues', () => {
      const responses = createResponsesWithPrecisionIssues();
      const agreement = createPrecisionAgreementMeasures();
      const disagreement = createPrecisionDisagreementAnalysis();

      expect(() => {
        calculator.calculateAdvancedConfidence(responses, agreement, disagreement);
      }).not.toThrow();

      const result = calculator.calculateAdvancedConfidence(responses, agreement, disagreement);
      expect(Number.isFinite(result.overallConfidence)).toBe(true);
    });
  });
});

// Helper functions for creating test data
function createHighQualityResponses(): LLMResponse[] {
  return [
    createMockResponse('openai', 'High quality detailed response with comprehensive analysis', 0.9, 1200),
    createMockResponse('claude', 'Another high quality response with detailed analysis', 0.85, 1100),
    createMockResponse('gemini', 'Comprehensive high quality response with detailed information', 0.88, 1300)
  ];
}

function createLowQualityResponses(): LLMResponse[] {
  return [
    createMockResponse('openai', 'Short response', 0.3, 200),
    createMockResponse('claude', 'Brief answer', 0.2, 150),
    createMockResponse('gemini', 'Minimal content', 0.25, 180)
  ];
}

function createMediumQualityResponses(): LLMResponse[] {
  return [
    createMockResponse('openai', 'Medium quality response with some detail', 0.7, 800),
    createMockResponse('claude', 'Decent response with moderate analysis', 0.65, 750),
    createMockResponse('gemini', 'Acceptable response with reasonable content', 0.72, 900)
  ];
}

function createMixedQualityResponses(): LLMResponse[] {
  return [
    createMockResponse('openai', 'High quality detailed response', 0.9, 1200),
    createMockResponse('claude', 'Medium response', 0.6, 600),
    createMockResponse('gemini', 'Short response', 0.3, 200)
  ];
}

function createExtremeConfidenceResponses(): LLMResponse[] {
  return [
    createMockResponse('openai', 'Response', 0.0),
    createMockResponse('claude', 'Response', 1.0),
    createMockResponse('gemini', 'Response', 0.5)
  ];
}

function createResponsesWithConfidence(confidence: number): LLMResponse[] {
  return [
    createMockResponse('openai', 'Test response', confidence),
    createMockResponse('claude', 'Test response', confidence),
    createMockResponse('gemini', 'Test response', confidence)
  ];
}

function createResponsesWithPrecisionIssues(): LLMResponse[] {
  return [
    createMockResponse('openai', 'Response', 0.123456789012345),
    createMockResponse('claude', 'Response', 0.123456789012346),
    createMockResponse('gemini', 'Response', 0.123456789012344)
  ];
}

function createPartialResponse(provider: string, content: string, confidence: number): LLMResponse {
  return {
    ...createMockResponse(provider, content, confidence),
    metadata: { ...createMockResponse(provider, content, confidence).metadata, partial: true }
  };
}

function createMockResponseWithMissingData(provider: string, content: string, confidence: number): LLMResponse {
  return {
    ...createMockResponse(provider, content, confidence),
    components: undefined
  };
}

function createMockResponseWithComponents(
  provider: string,
  content: string,
  confidence: number,
  responseTime: number,
  componentCount: number
): LLMResponse {
  const components = Array.from({ length: componentCount }, (_, i) => ({
    id: `component_${i}`,
    type: 'resistor',
    location: { x: i * 10, y: i * 10 }
  }));

  return {
    ...createMockResponse(provider, content, confidence, responseTime),
    components
  };
}

function createHighAgreementMeasures(): AgreementMeasures {
  return {
    semanticSimilarity: 0.9,
    structuralSimilarity: 0.85,
    correlationCoefficient: { pearson: 0.8, spearman: 0.82, kendall: 0.78 },
    variance: 0.02,
    entropy: 0.1,
    outlierCount: 0
  };
}

function createLowAgreementMeasures(): AgreementMeasures {
  return {
    semanticSimilarity: 0.3,
    structuralSimilarity: 0.25,
    correlationCoefficient: { pearson: 0.2, spearman: 0.18, kendall: 0.15 },
    variance: 0.4,
    entropy: 0.8,
    outlierCount: 2
  };
}

function createMediumAgreementMeasures(): AgreementMeasures {
  return {
    semanticSimilarity: 0.6,
    structuralSimilarity: 0.55,
    correlationCoefficient: { pearson: 0.5, spearman: 0.52, kendall: 0.48 },
    variance: 0.15,
    entropy: 0.4,
    outlierCount: 1
  };
}

function createZeroAgreementMeasures(): AgreementMeasures {
  return {
    semanticSimilarity: 0,
    structuralSimilarity: 0,
    correlationCoefficient: { pearson: 0, spearman: 0, kendall: 0 },
    variance: 0,
    entropy: 0,
    outlierCount: 0
  };
}

function createSingleResponseAgreementMeasures(): AgreementMeasures {
  return {
    semanticSimilarity: 1.0,
    structuralSimilarity: 1.0,
    correlationCoefficient: { pearson: 1.0, spearman: 1.0, kendall: 1.0 },
    variance: 0,
    entropy: 0,
    outlierCount: 0
  };
}

function createAgreementForConfidence(confidence: number): AgreementMeasures {
  return {
    semanticSimilarity: confidence,
    structuralSimilarity: confidence * 0.9,
    correlationCoefficient: { pearson: confidence * 0.8, spearman: confidence * 0.85, kendall: confidence * 0.75 },
    variance: (1 - confidence) * 0.3,
    entropy: (1 - confidence) * 0.5,
    outlierCount: confidence < 0.5 ? 1 : 0
  };
}

function createPrecisionAgreementMeasures(): AgreementMeasures {
  return {
    semanticSimilarity: 0.123456789012345,
    structuralSimilarity: 0.987654321098765,
    correlationCoefficient: { 
      pearson: 0.555555555555555, 
      spearman: 0.444444444444444, 
      kendall: 0.333333333333333 
    },
    variance: 0.000000000000001,
    entropy: 0.999999999999999,
    outlierCount: 0
  };
}

function createLowDisagreementAnalysis(): DisagreementAnalysis {
  return {
    hasSignificantDisagreement: false,
    disagreementScore: 0.15,
    consensus: { semantic: 0.9, confidence: 0.85, structural: 0.9 },
    outliers: []
  };
}

function createHighDisagreementAnalysis(): DisagreementAnalysis {
  return {
    hasSignificantDisagreement: true,
    disagreementScore: 0.8,
    consensus: { semantic: 0.2, confidence: 0.3, structural: 0.25 },
    outliers: [
      { provider: 'openai', deviationScore: 0.7, reasons: ['semantic'] },
      { provider: 'claude', deviationScore: 0.6, reasons: ['confidence'] }
    ]
  };
}

function createMediumDisagreementAnalysis(): DisagreementAnalysis {
  return {
    hasSignificantDisagreement: true,
    disagreementScore: 0.4,
    consensus: { semantic: 0.6, confidence: 0.65, structural: 0.6 },
    outliers: [
      { provider: 'gemini', deviationScore: 0.5, reasons: ['semantic'] }
    ]
  };
}

function createEmptyDisagreementAnalysis(): DisagreementAnalysis {
  return {
    hasSignificantDisagreement: false,
    disagreementScore: 0,
    consensus: { semantic: 0, confidence: 0, structural: 0 },
    outliers: []
  };
}

function createDisagreementForConfidence(confidence: number): DisagreementAnalysis {
  return {
    hasSignificantDisagreement: confidence < 0.6,
    disagreementScore: 1 - confidence,
    consensus: { 
      semantic: confidence, 
      confidence: confidence * 0.9, 
      structural: confidence * 0.95 
    },
    outliers: confidence < 0.5 ? [
      { provider: 'gemini', deviationScore: 1 - confidence, reasons: ['confidence'] }
    ] : []
  };
}

function createPrecisionDisagreementAnalysis(): DisagreementAnalysis {
  return {
    hasSignificantDisagreement: false,
    disagreementScore: 0.123456789012345,
    consensus: { 
      semantic: 0.876543210987655, 
      confidence: 0.654321098765432, 
      structural: 0.987654321012345 
    },
    outliers: []
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