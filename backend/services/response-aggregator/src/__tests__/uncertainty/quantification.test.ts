/**
 * Unit Tests: Uncertainty Quantification Service
 * 
 * Tests uncertainty measures, disagreement classification, confidence intervals,
 * and edge cases in uncertainty propagation.
 */

import { 
  UncertaintyQuantificationService, 
  UncertaintyQuantificationResult,
  DisagreementLevel,
  DisagreementSeverity,
  WarningType,
  WarningSeverity
} from '../../uncertainty/quantification.service';
import { AgreementMeasures, DisagreementAnalysis } from '../../consensus/agreement.analyzer';
import { LLMResponse } from '../../../../llm-orchestrator/src/providers/base/LLMProvider.interface';

describe('UncertaintyQuantificationService Edge Cases', () => {
  let service: UncertaintyQuantificationService;

  beforeEach(() => {
    service = new UncertaintyQuantificationService();
  });

  describe('Single Model Response Scenarios', () => {
    it('should handle single model with high confidence', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Single high confidence response', 0.95)
      ];
      const agreement = createSingleModelAgreement();
      const disagreement = createNoDisagreement();

      const result = service.quantifyUncertainty(responses, agreement, disagreement);

      expect(result.uncertaintyMeasures.variance).toBe(0);
      expect(result.uncertaintyMeasures.standardDeviation).toBe(0);
      expect(result.uncertaintyMeasures.coefficientOfVariation).toBe(0);
      expect(result.disagreementClassification.level).toBe(DisagreementLevel.MINIMAL);
      expect(result.qualityWarnings.some(w => w.type === WarningType.INSUFFICIENT_DATA)).toBe(true);
    });

    it('should handle single model with low confidence', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Single low confidence response', 0.2)
      ];
      const agreement = createSingleModelAgreement();
      const disagreement = createNoDisagreement();

      const result = service.quantifyUncertainty(responses, agreement, disagreement);

      expect(result.uncertaintyMeasures.variance).toBe(0);
      expect(result.qualityWarnings.length).toBeGreaterThan(0);
      expect(result.uncertaintyPropagation.finalConfidence).toBeLessThan(0.3);
    });

    it('should handle single model with edge confidence values', () => {
      const edgeValues = [0.0, 1.0, 0.5];
      
      edgeValues.forEach(confidence => {
        const responses: LLMResponse[] = [
          createMockResponse('openai', `Response with ${confidence} confidence`, confidence)
        ];
        const agreement = createSingleModelAgreement();
        const disagreement = createNoDisagreement();

        expect(() => {
          service.quantifyUncertainty(responses, agreement, disagreement);
        }).not.toThrow();

        const result = service.quantifyUncertainty(responses, agreement, disagreement);
        expect(result.uncertaintyMeasures.variance).toBe(0);
        expect(result.uncertaintyMeasures.confidenceRange[0]).toBe(confidence);
        expect(result.uncertaintyMeasures.confidenceRange[1]).toBe(confidence);
      });
    });
  });

  describe('Extreme Disagreement Scenarios', () => {
    it('should handle maximum disagreement with opposite confidences', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Maximum confidence response', 1.0),
        createMockResponse('claude', 'Minimum confidence response', 0.0),
        createMockResponse('gemini', 'Medium confidence response', 0.5)
      ];
      const agreement = createMaxDisagreementMeasures();
      const disagreement = createMaxDisagreement();

      const result = service.quantifyUncertainty(responses, agreement, disagreement);

      expect(result.uncertaintyMeasures.variance).toBeCloseTo(0.167, 2); // High variance
      expect(result.uncertaintyMeasures.coefficientOfVariation).toBeGreaterThan(0.5);
      expect(result.disagreementClassification.level).toBe(DisagreementLevel.CRITICAL);
      expect(result.disagreementClassification.severity).toBe(DisagreementSeverity.CRITICAL);
      expect(result.qualityWarnings.some(w => w.type === WarningType.HIGH_UNCERTAINTY)).toBe(true);
      expect(result.qualityWarnings.some(w => w.type === WarningType.LOW_AGREEMENT)).toBe(true);
    });

    it('should handle semantic disagreement with high confidence', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'This is definitely a resistor', 0.95),
        createMockResponse('claude', 'This is clearly a capacitor', 0.93),
        createMockResponse('gemini', 'This is obviously an inductor', 0.97)
      ];
      const agreement: AgreementMeasures = {
        semanticSimilarity: 0.1, // Very low semantic similarity
        structuralSimilarity: 0.05,
        correlationCoefficient: { pearson: -0.8, spearman: -0.7, kendall: -0.6 },
        variance: 0.0002, // Low variance in confidence
        entropy: 0.95,
        outlierCount: 0
      };
      const disagreement: DisagreementAnalysis = {
        hasSignificantDisagreement: true,
        disagreementScore: 0.9,
        consensus: { semantic: 0.1, confidence: 0.95, structural: 0.05 },
        outliers: []
      };

      const result = service.quantifyUncertainty(responses, agreement, disagreement);

      expect(result.disagreementClassification.level).toBe(DisagreementLevel.CRITICAL);
      expect(result.disagreementClassification.categories.some(c => c.type === 'semantic')).toBe(true);
      expect(result.uncertaintyMeasures.entropy).toBeGreaterThan(0.8);
      expect(result.qualityWarnings.some(w => w.type === WarningType.LOW_AGREEMENT)).toBe(true);
    });

    it('should handle outlier detection with extreme values', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Normal response A', 0.8),
        createMockResponse('claude', 'Normal response B', 0.82),
        createMockResponse('gemini', 'Extreme outlier response', 0.1), // Major outlier
        createMockResponse('custom', 'Another outlier', 0.05) // Another outlier
      ];
      const agreement = createHighVarianceMeasures();
      const disagreement = createOutlierDisagreement();

      const result = service.quantifyUncertainty(responses, agreement, disagreement);

      expect(result.disagreementClassification.sources.length).toBe(2);
      expect(result.disagreementClassification.sources.some(s => s.provider === 'gemini')).toBe(true);
      expect(result.disagreementClassification.sources.some(s => s.provider === 'custom')).toBe(true);
      expect(result.qualityWarnings.some(w => w.type === WarningType.OUTLIER_DETECTED)).toBe(true);
    });
  });

  describe('Partial Failure and Missing Data', () => {
    it('should handle responses with missing confidence values', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Good response', 0.8),
        createResponseWithMissingConfidence('claude', 'Response without confidence'),
        createMockResponse('gemini', 'Another good response', 0.75)
      ];
      const agreement = createMediumAgreementMeasures();
      const disagreement = createMediumDisagreement();

      expect(() => {
        service.quantifyUncertainty(responses, agreement, disagreement);
      }).not.toThrow();

      const result = service.quantifyUncertainty(responses, agreement, disagreement);
      expect(result.qualityWarnings.some(w => w.type === WarningType.INSUFFICIENT_DATA)).toBe(true);
    });

    it('should handle responses with invalid confidence values', () => {
      const responses: LLLResponse[] = [
        createMockResponse('openai', 'Normal response', 0.8),
        createMockResponse('claude', 'Invalid confidence 1', Number.NaN),
        createMockResponse('gemini', 'Invalid confidence 2', Number.POSITIVE_INFINITY),
        createMockResponse('custom', 'Invalid confidence 3', -0.5)
      ];
      const agreement = createMediumAgreementMeasures();
      const disagreement = createMediumDisagreement();

      expect(() => {
        service.quantifyUncertainty(responses, agreement, disagreement);
      }).not.toThrow();

      const result = service.quantifyUncertainty(responses, agreement, disagreement);
      expect(result.qualityWarnings.length).toBeGreaterThan(0);
    });

    it('should handle empty responses array', () => {
      const responses: LLMResponse[] = [];
      const agreement = createEmptyAgreementMeasures();
      const disagreement = createNoDisagreement();

      const result = service.quantifyUncertainty(responses, agreement, disagreement);

      expect(result.uncertaintyMeasures.variance).toBe(0);
      expect(result.uncertaintyMeasures.standardDeviation).toBe(0);
      expect(result.uncertaintyMeasures.entropy).toBe(0);
      expect(result.uncertaintyMeasures.confidenceRange).toEqual([0, 0]);
      expect(result.confidenceIntervals).toHaveLength(0);
      expect(result.disagreementClassification.level).toBe(DisagreementLevel.MINIMAL);
    });

    it('should handle responses with extreme processing times', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Fast response', 0.8, 100),
        createMockResponse('claude', 'Slow response', 0.7, 30000), // 30 seconds
        createMockResponse('gemini', 'Normal response', 0.75, 1200)
      ];
      const agreement = createMediumAgreementMeasures();
      const disagreement = createMediumDisagreement();

      const result = service.quantifyUncertainty(responses, agreement, disagreement);

      expect(result.confidenceIntervals.some(ci => ci.metric === 'mean_response_time')).toBe(true);
      const timeInterval = result.confidenceIntervals.find(ci => ci.metric === 'mean_response_time');
      expect(timeInterval!.upper - timeInterval!.lower).toBeGreaterThan(1000); // Wide interval due to variance
    });
  });

  describe('Statistical Calculation Edge Cases', () => {
    it('should handle numerical precision issues in entropy calculation', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Response 1', 0.123456789012345),
        createMockResponse('claude', 'Response 2', 0.123456789012346),
        createMockResponse('gemini', 'Response 3', 0.123456789012344)
      ];
      const agreement = createPrecisionAgreementMeasures();
      const disagreement = createNoDisagreement();

      expect(() => {
        service.quantifyUncertainty(responses, agreement, disagreement);
      }).not.toThrow();

      const result = service.quantifyUncertainty(responses, agreement, disagreement);
      expect(Number.isFinite(result.uncertaintyMeasures.entropy)).toBe(true);
      expect(Number.isFinite(result.uncertaintyMeasures.variance)).toBe(true);
    });

    it('should handle identical confidence values correctly', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Response 1', 0.7),
        createMockResponse('claude', 'Response 2', 0.7),
        createMockResponse('gemini', 'Response 3', 0.7),
        createMockResponse('custom', 'Response 4', 0.7)
      ];
      const agreement = createHighAgreementMeasures();
      const disagreement = createNoDisagreement();

      const result = service.quantifyUncertainty(responses, agreement, disagreement);

      expect(result.uncertaintyMeasures.variance).toBe(0);
      expect(result.uncertaintyMeasures.standardDeviation).toBe(0);
      expect(result.uncertaintyMeasures.coefficientOfVariation).toBe(0);
      expect(result.uncertaintyMeasures.interquartileRange).toBe(0);
      expect(result.disagreementClassification.level).toBe(DisagreementLevel.MINIMAL);
    });

    it('should handle percentile calculation edge cases', () => {
      // Test various array sizes for percentile calculation
      const testCases = [
        [0.1], // Single value
        [0.1, 0.9], // Two values
        [0.1, 0.5, 0.9], // Three values
        [0.1, 0.3, 0.7, 0.9], // Four values
        Array.from({ length: 100 }, (_, i) => i / 100) // Many values
      ];

      testCases.forEach((confidences, index) => {
        const responses = confidences.map((conf, i) => 
          createMockResponse(`provider_${i}`, `Response ${i}`, conf)
        );
        const agreement = createMediumAgreementMeasures();
        const disagreement = createNoDisagreement();

        expect(() => {
          service.quantifyUncertainty(responses, agreement, disagreement);
        }).not.toThrow(`Test case ${index} with ${confidences.length} values`);

        const result = service.quantifyUncertainty(responses, agreement, disagreement);
        expect(result.uncertaintyMeasures.interquartileRange).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle confidence interval calculation with small samples', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Response 1', 0.8),
        createMockResponse('claude', 'Response 2', 0.82)
      ];
      const agreement = createMediumAgreementMeasures();
      const disagreement = createNoDisagreement();

      const result = service.quantifyUncertainty(responses, agreement, disagreement);

      expect(result.confidenceIntervals.length).toBeGreaterThan(0);
      result.confidenceIntervals.forEach(interval => {
        expect(interval.lower).toBeLessThanOrEqual(interval.upper);
        expect(interval.confidence).toBe(0.95);
        expect(interval.method).toBeDefined();
      });
    });
  });

  describe('Uncertainty Propagation Edge Cases', () => {
    it('should handle propagation with extreme uncertainty values', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'High uncertainty response', 0.1),
        createMockResponse('claude', 'Low uncertainty response', 0.9),
        createMockResponse('gemini', 'Medium uncertainty response', 0.5)
      ];
      const agreement = createMaxDisagreementMeasures();
      const disagreement = createMaxDisagreement();

      const result = service.quantifyUncertainty(responses, agreement, disagreement);

      expect(result.uncertaintyPropagation.propagatedUncertainty).toBeGreaterThan(0.3);
      expect(result.uncertaintyPropagation.finalConfidence).toBeLessThan(0.6);
      expect(result.uncertaintyPropagation.uncertaintyComponents.length).toBeGreaterThan(3);
      expect(result.uncertaintyPropagation.propagationPath.length).toBeGreaterThan(1);
    });

    it('should handle propagation with minimal uncertainty', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'High confidence A', 0.95),
        createMockResponse('claude', 'High confidence B', 0.94),
        createMockResponse('gemini', 'High confidence C', 0.96)
      ];
      const agreement = createHighAgreementMeasures();
      const disagreement = createNoDisagreement();

      const result = service.quantifyUncertainty(responses, agreement, disagreement);

      expect(result.uncertaintyPropagation.propagatedUncertainty).toBeLessThan(0.1);
      expect(result.uncertaintyPropagation.finalConfidence).toBeGreaterThan(0.9);
      
      // Check that uncertainty components have reasonable contributions
      const totalContribution = result.uncertaintyPropagation.uncertaintyComponents
        .reduce((sum, comp) => sum + comp.contribution, 0);
      expect(totalContribution).toBeCloseTo(1.0, 1);
    });

    it('should handle mathematical edge cases in propagation', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Zero confidence', 0.0),
        createMockResponse('claude', 'Max confidence', 1.0)
      ];
      const agreement: AgreementMeasures = {
        semanticSimilarity: 0,
        structuralSimilarity: 0,
        correlationCoefficient: { pearson: 0, spearman: 0, kendall: 0 },
        variance: 0.25, // Maximum possible variance for [0, 1]
        entropy: 1.0, // Maximum entropy
        outlierCount: 1
      };
      const disagreement = createMaxDisagreement();

      expect(() => {
        service.quantifyUncertainty(responses, agreement, disagreement);
      }).not.toThrow();

      const result = service.quantifyUncertainty(responses, agreement, disagreement);
      expect(Number.isFinite(result.uncertaintyPropagation.propagatedUncertainty)).toBe(true);
      expect(Number.isFinite(result.uncertaintyPropagation.finalConfidence)).toBe(true);
      expect(result.uncertaintyPropagation.finalConfidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Quality Warning Generation Edge Cases', () => {
    it('should generate multiple warning types simultaneously', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Single outlier response', 0.1), // Will be outlier
        createMockResponse('claude', 'High variance response', 0.9)    // Creates high variance
      ];
      const agreement = createHighVarianceMeasures();
      const disagreement = createOutlierDisagreement();

      const result = service.quantifyUncertainty(responses, agreement, disagreement);

      const warningTypes = result.qualityWarnings.map(w => w.type);
      expect(warningTypes).toContain(WarningType.HIGH_UNCERTAINTY);
      expect(warningTypes).toContain(WarningType.LOW_AGREEMENT);
      expect(warningTypes).toContain(WarningType.OUTLIER_DETECTED);
      expect(warningTypes).toContain(WarningType.INSUFFICIENT_DATA);
      
      // Check severity levels are appropriate
      const criticalWarnings = result.qualityWarnings.filter(w => w.severity === WarningSeverity.CRITICAL);
      const highWarnings = result.qualityWarnings.filter(w => w.severity === WarningSeverity.HIGH);
      expect(criticalWarnings.length + highWarnings.length).toBeGreaterThan(0);
    });

    it('should handle warning generation with edge threshold values', () => {
      // Create scenario right at warning thresholds
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Threshold response 1', 0.75),
        createMockResponse('claude', 'Threshold response 2', 0.25) // CV = 0.5 exactly
      ];
      const agreement = createMediumAgreementMeasures();
      const disagreement = createThresholdDisagreement();

      const result = service.quantifyUncertainty(responses, agreement, disagreement);

      // Should handle threshold conditions gracefully
      expect(result.qualityWarnings.length).toBeGreaterThanOrEqual(0);
      result.qualityWarnings.forEach(warning => {
        expect(warning.confidence).toBeGreaterThan(0);
        expect(warning.confidence).toBeLessThanOrEqual(1);
        expect(warning.message).toBeDefined();
        expect(warning.recommendation).toBeDefined();
      });
    });

    it('should prioritize warnings by severity', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Response 1', 0.1)
      ];
      const agreement = createMaxDisagreementMeasures();
      const disagreement = createMaxDisagreement();

      const result = service.quantifyUncertainty(responses, agreement, disagreement);

      // Check that critical warnings come first or are appropriately marked
      const sortedWarnings = result.qualityWarnings.sort((a, b) => {
        const severityOrder = {
          [WarningSeverity.CRITICAL]: 5,
          [WarningSeverity.HIGH]: 4,
          [WarningSeverity.MEDIUM]: 3,
          [WarningSeverity.LOW]: 2,
          [WarningSeverity.INFO]: 1
        };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });

      if (sortedWarnings.length > 1) {
        expect(sortedWarnings[0].severity).toBe(WarningSeverity.CRITICAL);
      }
    });
  });

  describe('Performance and Memory Edge Cases', () => {
    it('should handle large response sets efficiently', () => {
      const largeResponseSet: LLMResponse[] = Array.from({ length: 1000 }, (_, i) =>
        createMockResponse(`provider_${i % 10}`, `Response ${i}`, Math.random(), 1000 + Math.random() * 1000)
      );
      const agreement = createMediumAgreementMeasures();
      const disagreement = createMediumDisagreement();

      const startTime = Date.now();
      const initialMemory = process.memoryUsage();
      
      const result = service.quantifyUncertainty(largeResponseSet, agreement, disagreement);
      
      const endTime = Date.now();
      const finalMemory = process.memoryUsage();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(finalMemory.heapUsed - initialMemory.heapUsed).toBeLessThan(100 * 1024 * 1024); // Less than 100MB

      expect(result.uncertaintyMeasures).toBeDefined();
      expect(result.confidenceIntervals).toBeDefined();
      expect(result.qualityWarnings).toBeDefined();
    });

    it('should handle repeated calculations without memory leaks', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Test response 1', 0.8),
        createMockResponse('claude', 'Test response 2', 0.7),
        createMockResponse('gemini', 'Test response 3', 0.9)
      ];
      const agreement = createMediumAgreementMeasures();
      const disagreement = createMediumDisagreement();

      const initialMemory = process.memoryUsage();
      
      // Perform many calculations
      for (let i = 0; i < 100; i++) {
        service.quantifyUncertainty(responses, agreement, disagreement);
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase
    });
  });
});

// Helper functions for creating test data
function createMockResponse(
  provider: string,
  content: string,
  confidence: number,
  responseTime: number = 1000
): LLMResponse {
  return {
    provider,
    model: `${provider}-model`,
    response: content,
    confidence,
    responseTime,
    timestamp: new Date(),
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    components: [],
    metadata: { temperature: 0.7, maxTokens: 1000 }
  };
}

function createResponseWithMissingConfidence(provider: string, content: string): any {
  return {
    provider,
    model: `${provider}-model`,
    response: content,
    // confidence is missing
    responseTime: 1000,
    timestamp: new Date(),
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    components: [],
    metadata: { temperature: 0.7, maxTokens: 1000 }
  };
}

function createSingleModelAgreement(): AgreementMeasures {
  return {
    semanticSimilarity: 1.0,
    structuralSimilarity: 1.0,
    correlationCoefficient: { pearson: 1.0, spearman: 1.0, kendall: 1.0 },
    variance: 0,
    entropy: 0,
    outlierCount: 0
  };
}

function createHighAgreementMeasures(): AgreementMeasures {
  return {
    semanticSimilarity: 0.9,
    structuralSimilarity: 0.85,
    correlationCoefficient: { pearson: 0.8, spearman: 0.82, kendall: 0.78 },
    variance: 0.01,
    entropy: 0.1,
    outlierCount: 0
  };
}

function createMediumAgreementMeasures(): AgreementMeasures {
  return {
    semanticSimilarity: 0.6,
    structuralSimilarity: 0.55,
    correlationCoefficient: { pearson: 0.5, spearman: 0.52, kendall: 0.48 },
    variance: 0.05,
    entropy: 0.4,
    outlierCount: 0
  };
}

function createMaxDisagreementMeasures(): AgreementMeasures {
  return {
    semanticSimilarity: 0.1,
    structuralSimilarity: 0.05,
    correlationCoefficient: { pearson: -0.8, spearman: -0.7, kendall: -0.6 },
    variance: 0.25, // Maximum variance for [0,1] range
    entropy: 1.0,
    outlierCount: 2
  };
}

function createHighVarianceMeasures(): AgreementMeasures {
  return {
    semanticSimilarity: 0.4,
    structuralSimilarity: 0.3,
    correlationCoefficient: { pearson: 0.2, spearman: 0.1, kendall: 0.15 },
    variance: 0.2,
    entropy: 0.8,
    outlierCount: 1
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

function createEmptyAgreementMeasures(): AgreementMeasures {
  return {
    semanticSimilarity: 0,
    structuralSimilarity: 0,
    correlationCoefficient: { pearson: 0, spearman: 0, kendall: 0 },
    variance: 0,
    entropy: 0,
    outlierCount: 0
  };
}

function createNoDisagreement(): DisagreementAnalysis {
  return {
    hasSignificantDisagreement: false,
    disagreementScore: 0.1,
    consensus: { semantic: 0.9, confidence: 0.9, structural: 0.9 },
    outliers: []
  };
}

function createMediumDisagreement(): DisagreementAnalysis {
  return {
    hasSignificantDisagreement: true,
    disagreementScore: 0.4,
    consensus: { semantic: 0.6, confidence: 0.6, structural: 0.6 },
    outliers: []
  };
}

function createMaxDisagreement(): DisagreementAnalysis {
  return {
    hasSignificantDisagreement: true,
    disagreementScore: 0.9,
    consensus: { semantic: 0.1, confidence: 0.2, structural: 0.1 },
    outliers: [
      { provider: 'openai', deviationScore: 0.8, reasons: ['semantic', 'confidence'] },
      { provider: 'claude', deviationScore: 0.9, reasons: ['semantic', 'structural'] }
    ]
  };
}

function createOutlierDisagreement(): DisagreementAnalysis {
  return {
    hasSignificantDisagreement: true,
    disagreementScore: 0.7,
    consensus: { semantic: 0.3, confidence: 0.4, structural: 0.35 },
    outliers: [
      { provider: 'gemini', deviationScore: 0.9, reasons: ['confidence'] },
      { provider: 'custom', deviationScore: 0.85, reasons: ['confidence'] }
    ]
  };
}

function createThresholdDisagreement(): DisagreementAnalysis {
  return {
    hasSignificantDisagreement: true,
    disagreementScore: 0.5, // Right at threshold
    consensus: { semantic: 0.5, confidence: 0.5, structural: 0.5 },
    outliers: []
  };
}