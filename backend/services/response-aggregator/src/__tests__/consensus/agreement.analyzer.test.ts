/**
 * Unit Tests: Agreement Analyzer
 * 
 * Comprehensive testing of inter-model agreement analysis algorithms
 * with mock data and statistical validation.
 */

import { AgreementAnalyzer, AgreementMeasures, DisagreementAnalysis } from '../../consensus/agreement.analyzer';
import { LLMResponse } from '../../../../llm-orchestrator/src/providers/base/LLMProvider.interface';

describe('AgreementAnalyzer', () => {
  let analyzer: AgreementAnalyzer;

  beforeEach(() => {
    analyzer = new AgreementAnalyzer();
  });

  describe('calculateInterModelAgreement', () => {
    it('should calculate perfect agreement for identical responses', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Test response content', 0.9),
        createMockResponse('claude', 'Test response content', 0.9),
        createMockResponse('gemini', 'Test response content', 0.9)
      ];

      const agreement = analyzer.calculateInterModelAgreement(responses);

      expect(agreement.semanticSimilarity).toBeCloseTo(1.0, 2);
      expect(agreement.structuralSimilarity).toBeCloseTo(1.0, 2);
      expect(agreement.correlationCoefficient.pearson).toBeCloseTo(1.0, 1);
      expect(agreement.variance).toBeCloseTo(0, 3);
      expect(agreement.entropy).toBeLessThan(0.1);
    });

    it('should detect disagreement in semantic content', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'The component is a resistor with high precision', 0.8),
        createMockResponse('claude', 'This appears to be a capacitor element', 0.7),
        createMockResponse('gemini', 'Identified as an inductor component', 0.6)
      ];

      const agreement = analyzer.calculateInterModelAgreement(responses);

      expect(agreement.semanticSimilarity).toBeLessThan(0.5);
      expect(agreement.variance).toBeGreaterThan(0.01);
      expect(agreement.entropy).toBeGreaterThan(0.3);
      expect(agreement.outlierCount).toBeGreaterThan(0);
    });

    it('should handle empty responses array', () => {
      const responses: LLMResponse[] = [];

      const agreement = analyzer.calculateInterModelAgreement(responses);

      expect(agreement.semanticSimilarity).toBe(0);
      expect(agreement.structuralSimilarity).toBe(0);
      expect(agreement.variance).toBe(0);
      expect(agreement.entropy).toBe(0);
      expect(agreement.outlierCount).toBe(0);
    });

    it('should handle single response', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Single response content', 0.8)
      ];

      const agreement = analyzer.calculateInterModelAgreement(responses);

      expect(agreement.semanticSimilarity).toBe(1.0);
      expect(agreement.structuralSimilarity).toBe(1.0);
      expect(agreement.variance).toBe(0);
      expect(agreement.correlationCoefficient.pearson).toBe(1.0);
    });

    it('should calculate correlation coefficients correctly', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Response A', 0.9),
        createMockResponse('claude', 'Response B', 0.7),
        createMockResponse('gemini', 'Response C', 0.5)
      ];

      const agreement = analyzer.calculateInterModelAgreement(responses);

      expect(agreement.correlationCoefficient.pearson).toBeDefined();
      expect(agreement.correlationCoefficient.spearman).toBeDefined();
      expect(agreement.correlationCoefficient.kendall).toBeDefined();
      expect(agreement.correlationCoefficient.pearson).toBeGreaterThan(-1);
      expect(agreement.correlationCoefficient.pearson).toBeLessThanOrEqual(1);
    });

    it('should detect outliers in responses', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Normal response content here', 0.85),
        createMockResponse('claude', 'Another normal response content', 0.82),
        createMockResponse('gemini', 'Completely different outlier content that does not match', 0.3)
      ];

      const agreement = analyzer.calculateInterModelAgreement(responses);

      expect(agreement.outlierCount).toBe(1);
      expect(agreement.semanticSimilarity).toBeLessThan(0.8);
    });
  });

  describe('analyzeDisagreements', () => {
    it('should classify semantic disagreements', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'This is a resistor component', 0.8),
        createMockResponse('claude', 'This is a capacitor component', 0.7),
        createMockResponse('gemini', 'This is an inductor component', 0.9)
      ];

      const disagreement = analyzer.analyzeDisagreements(responses);

      expect(disagreement.hasSignificantDisagreement).toBe(true);
      expect(disagreement.disagreementScore).toBeGreaterThan(0.5);
      expect(disagreement.consensus.semantic).toBeLessThan(0.7);
      expect(disagreement.outliers.length).toBeGreaterThan(0);
    });

    it('should identify confidence disagreements', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Similar content', 0.9),
        createMockResponse('claude', 'Similar content', 0.2), // Low confidence outlier
        createMockResponse('gemini', 'Similar content', 0.85)
      ];

      const disagreement = analyzer.analyzeDisagreements(responses);

      expect(disagreement.hasSignificantDisagreement).toBe(true);
      expect(disagreement.consensus.confidence).toBeLessThan(0.8);
      expect(disagreement.outliers.some(o => o.provider === 'claude')).toBe(true);
    });

    it('should handle high agreement scenarios', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'High agreement response', 0.85),
        createMockResponse('claude', 'High agreement response', 0.87),
        createMockResponse('gemini', 'High agreement response', 0.83)
      ];

      const disagreement = analyzer.analyzeDisagreements(responses);

      expect(disagreement.hasSignificantDisagreement).toBe(false);
      expect(disagreement.disagreementScore).toBeLessThan(0.3);
      expect(disagreement.consensus.semantic).toBeGreaterThan(0.8);
      expect(disagreement.outliers.length).toBe(0);
    });

    it('should calculate consensus measures', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Test content', 0.8),
        createMockResponse('claude', 'Test content variation', 0.7),
        createMockResponse('gemini', 'Test content similar', 0.75)
      ];

      const disagreement = analyzer.analyzeDisagreements(responses);

      expect(disagreement.consensus).toBeDefined();
      expect(disagreement.consensus.semantic).toBeGreaterThan(0);
      expect(disagreement.consensus.semantic).toBeLessThanOrEqual(1);
      expect(disagreement.consensus.confidence).toBeGreaterThan(0);
      expect(disagreement.consensus.confidence).toBeLessThanOrEqual(1);
      expect(disagreement.consensus.structural).toBeGreaterThan(0);
      expect(disagreement.consensus.structural).toBeLessThanOrEqual(1);
    });
  });

  describe('Statistical Measures', () => {
    it('should calculate entropy correctly', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Content A', 0.9),
        createMockResponse('claude', 'Content B', 0.1),
        createMockResponse('gemini', 'Content C', 0.5)
      ];

      const agreement = analyzer.calculateInterModelAgreement(responses);

      expect(agreement.entropy).toBeGreaterThan(0);
      expect(agreement.entropy).toBeLessThanOrEqual(1);
    });

    it('should calculate variance correctly', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Content', 0.9),
        createMockResponse('claude', 'Content', 0.5),
        createMockResponse('gemini', 'Content', 0.1)
      ];

      const agreement = analyzer.calculateInterModelAgreement(responses);
      const expectedVariance = 0.1067; // Manual calculation: var([0.9, 0.5, 0.1])

      expect(agreement.variance).toBeCloseTo(expectedVariance, 3);
    });

    it('should handle numerical precision correctly', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Content', 0.123456789),
        createMockResponse('claude', 'Content', 0.123456788),
        createMockResponse('gemini', 'Content', 0.123456787)
      ];

      const agreement = analyzer.calculateInterModelAgreement(responses);

      expect(agreement.variance).toBeGreaterThan(0);
      expect(agreement.variance).toBeLessThan(0.001);
    });
  });

  describe('Edge Cases', () => {
    it('should handle responses with missing content', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', '', 0.8),
        createMockResponse('claude', 'Valid content', 0.7),
        createMockResponse('gemini', null as any, 0.6)
      ];

      expect(() => {
        analyzer.calculateInterModelAgreement(responses);
      }).not.toThrow();
    });

    it('should handle extreme confidence values', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Content', 0.0),
        createMockResponse('claude', 'Content', 1.0),
        createMockResponse('gemini', 'Content', 0.5)
      ];

      const agreement = analyzer.calculateInterModelAgreement(responses);

      expect(agreement.variance).toBeGreaterThan(0.2);
      expect(agreement.entropy).toBeGreaterThan(0.5);
    });

    it('should handle very long response content', () => {
      const longContent = 'A'.repeat(10000);
      const responses: LLMResponse[] = [
        createMockResponse('openai', longContent, 0.8),
        createMockResponse('claude', longContent, 0.8),
        createMockResponse('gemini', longContent, 0.8)
      ];

      expect(() => {
        analyzer.calculateInterModelAgreement(responses);
      }).not.toThrow();
    });

    it('should handle invalid confidence values', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Content', -0.5), // Invalid
        createMockResponse('claude', 'Content', 1.5),  // Invalid
        createMockResponse('gemini', 'Content', 0.8)
      ];

      expect(() => {
        analyzer.calculateInterModelAgreement(responses);
      }).not.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should handle large response datasets efficiently', () => {
      const responses: LLMResponse[] = Array.from({ length: 100 }, (_, i) =>
        createMockResponse(`provider_${i}`, `Response content ${i}`, Math.random())
      );

      const startTime = Date.now();
      const agreement = analyzer.calculateInterModelAgreement(responses);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(agreement).toBeDefined();
    });

    it('should handle repeated calculations efficiently', () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Test content', 0.8),
        createMockResponse('claude', 'Test content', 0.7),
        createMockResponse('gemini', 'Test content', 0.9)
      ];

      const startTime = Date.now();
      for (let i = 0; i < 1000; i++) {
        analyzer.calculateInterModelAgreement(responses);
      }
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000); // Should complete 1000 iterations within 2 seconds
    });
  });
});

/**
 * Helper function to create mock LLM responses
 */
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
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150
    },
    components,
    metadata: {
      temperature: 0.7,
      maxTokens: 1000
    }
  };
}