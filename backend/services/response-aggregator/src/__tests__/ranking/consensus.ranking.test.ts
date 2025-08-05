/**
 * Unit Tests: Consensus Ranking Service
 * 
 * Tests text response ranking, semantic similarity, quality assessment,
 * and consensus text generation with edge cases.
 */

import { ConsensusRankingService, ConsensusRankingResult } from '../../ranking/consensus.ranking';
import { LLMResponse } from '../../../../llm-orchestrator/src/providers/base/LLMProvider.interface';
import { DEFAULT_CONSENSUS_CONFIG } from '../../config/confidence.config';

describe('ConsensusRankingService Edge Cases', () => {
  let service: ConsensusRankingService;

  beforeEach(() => {
    service = new ConsensusRankingService(DEFAULT_CONSENSUS_CONFIG);
  });

  describe('Single Response Scenarios', () => {
    it('should handle single response ranking', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Single response for ranking analysis', 0.8, 1000)
      ];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(1);
      expect(result.rankedResponses[0].provider).toBe('openai');
      expect(result.rankedResponses[0].rank).toBe(1);
      expect(result.rankedResponses[0].score).toBeGreaterThan(0);
      expect(result.consensusText).toBe('Single response for ranking analysis');
      expect(result.qualityMetrics.coherence).toBeGreaterThan(0.5);
    });

    it('should handle single response with very short content', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Short', 0.9, 500)
      ];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(1);
      expect(result.consensusText).toBe('Short');
      expect(result.qualityMetrics.completeness).toBeLessThan(0.5); // Penalized for brevity
    });

    it('should handle single response with very long content', async () => {
      const longContent = 'This is a very comprehensive and detailed analysis. '.repeat(100);
      const responses: LLMResponse[] = [
        createMockResponse('openai', longContent, 0.7, 2000)
      ];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(1);
      expect(result.consensusText).toBe(longContent);
      expect(result.qualityMetrics.completeness).toBeGreaterThan(0.7);
    });

    it('should handle single response with empty content', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', '', 0.3, 100)
      ];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(1);
      expect(result.consensusText).toBe('');
      expect(result.qualityMetrics.completeness).toBe(0);
      expect(result.qualityMetrics.coherence).toBeLessThan(0.3);
    });
  });

  describe('Extreme Agreement/Disagreement', () => {
    it('should handle identical responses correctly', async () => {
      const identicalContent = 'This circuit contains a resistor, capacitor, and LED in series configuration.';
      const responses: LLMResponse[] = [
        createMockResponse('openai', identicalContent, 0.9, 1000),
        createMockResponse('claude', identicalContent, 0.85, 1100),
        createMockResponse('gemini', identicalContent, 0.88, 1200)
      ];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(3);
      expect(result.consensusText).toBe(identicalContent);
      expect(result.qualityMetrics.consensus).toBeGreaterThan(0.95);
      expect(result.qualityMetrics.coherence).toBeGreaterThan(0.9);
      
      // All responses should have similar high scores
      result.rankedResponses.forEach(ranked => {
        expect(ranked.score).toBeGreaterThan(0.8);
      });
    });

    it('should handle completely different responses', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'This is an amplifier circuit with operational amplifiers and feedback resistors.', 0.9, 1000),
        createMockResponse('claude', 'The image shows a digital clock display with seven-segment digits.', 0.8, 1100),
        createMockResponse('gemini', 'Weather forecast indicates sunny conditions with temperature around 25°C.', 0.7, 1200)
      ];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(3);
      expect(result.qualityMetrics.consensus).toBeLessThan(0.3);
      expect(result.qualityMetrics.coherence).toBeLessThan(0.5);
      
      // First response should still be ranked based on confidence and quality
      expect(result.rankedResponses[0].provider).toBe('openai');
      expect(result.rankedResponses[0].rank).toBe(1);
    });

    it('should handle responses with partial semantic overlap', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'This electrical circuit contains resistors, capacitors, and shows current flow patterns.', 0.85, 1000),
        createMockResponse('claude', 'The circuit diagram includes resistors and capacitors with voltage measurements.', 0.80, 1100),
        createMockResponse('gemini', 'Electronic components like resistors are visible, but the image quality is poor.', 0.60, 1200)
      ];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(3);
      expect(result.qualityMetrics.consensus).toBeGreaterThan(0.4);
      expect(result.qualityMetrics.consensus).toBeLessThan(0.8);
      
      // Should rank by combination of confidence, quality, and semantic similarity
      expect(result.rankedResponses[0].provider).toBe('openai'); // Highest confidence and quality
      expect(result.rankedResponses[2].provider).toBe('gemini'); // Lowest confidence
    });
  });

  describe('Quality Assessment Edge Cases', () => {
    it('should handle responses with technical jargon vs simple language', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'The circuit exhibits high-frequency oscillations due to parasitic inductance in the PCB traces, causing EMI emissions beyond FCC Class B limits.', 0.9, 1500),
        createMockResponse('claude', 'This circuit has some noise problems that might cause interference.', 0.7, 800),
        createMockResponse('gemini', 'Circuit looks noisy.', 0.5, 300)
      ];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(3);
      
      // Technical detail should be rewarded in quality metrics
      expect(result.rankedResponses[0].provider).toBe('openai');
      expect(result.rankedResponses[0].score).toBeGreaterThan(result.rankedResponses[1].score);
      expect(result.qualityMetrics.completeness).toBeGreaterThan(0.6);
    });

    it('should handle responses with inconsistent confidence vs content quality', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Very detailed and comprehensive technical analysis with specific measurements and component values including precise calculations.', 0.3, 2000), // Low confidence, high quality
        createMockResponse('claude', 'Simple answer.', 0.95, 200), // High confidence, low quality
        createMockResponse('gemini', 'Moderate technical content with reasonable detail level and some specific information.', 0.7, 1000) // Balanced
      ];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(3);
      
      // Should balance confidence and content quality
      expect(result.rankedResponses[0].provider).toBe('gemini'); // Best balance
      
      // OpenAI should rank higher than Claude despite lower confidence due to quality
      const openaiRank = result.rankedResponses.find(r => r.provider === 'openai')!.rank;
      const claudeRank = result.rankedResponses.find(r => r.provider === 'claude')!.rank;
      expect(openaiRank).toBeLessThan(claudeRank);
    });

    it('should handle responses with numerical data vs qualitative descriptions', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Resistor R1 = 10kΩ ±5%, Capacitor C1 = 100µF ±10%, Voltage = 12V DC, Current = 1.2mA', 0.85, 1200),
        createMockResponse('claude', 'The circuit has a medium-sized resistor, large capacitor, and moderate voltage supply.', 0.80, 900),
        createMockResponse('gemini', 'Components present include resistive and capacitive elements with DC power source.', 0.75, 1000)
      ];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(3);
      
      // Quantitative data should score higher in specificity
      expect(result.rankedResponses[0].provider).toBe('openai');
      expect(result.qualityMetrics.specificity).toBeGreaterThan(0.7);
    });
  });

  describe('Text Processing Edge Cases', () => {
    it('should handle responses with special characters and encoding', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Circuit analysis: R₁ = 10kΩ, C₁ = 100µF, voltage ≈ 12V ± 0.5V', 0.8, 1000),
        createMockResponse('claude', 'Circuit analysis: R1 = 10k ohms, C1 = 100uF, voltage ~= 12V +/- 0.5V', 0.8, 1000),
        createMockResponse('gemini', 'Circuit analysis: R1 = 10000 ohms, C1 = 0.0001 F, voltage = 12 volts', 0.8, 1000)
      ];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(3);
      expect(result.qualityMetrics.consensus).toBeGreaterThan(0.7); // Should recognize semantic similarity despite encoding
      expect(result.consensusText).toBeDefined();
      expect(result.consensusText.length).toBeGreaterThan(0);
    });

    it('should handle responses with different languages or mixed content', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'This is an electrical circuit with resistor and capacitor components.', 0.9, 1000),
        createMockResponse('claude', 'Ceci est un circuit électrique avec des résistances et des condensateurs.', 0.8, 1000), // French
        createMockResponse('gemini', 'Mixed content: This circuit has components like resistors (résistances) and capacitors.', 0.7, 1000)
      ];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(3);
      expect(result.rankedResponses[0].provider).toBe('openai'); // English should rank higher in English context
      expect(result.qualityMetrics.consensus).toBeLessThan(0.5); // Lower due to language differences
    });

    it('should handle responses with HTML/XML tags or markup', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', '<p>This circuit contains <strong>resistors</strong> and <em>capacitors</em>.</p>', 0.8, 1000),
        createMockResponse('claude', 'This circuit contains **resistors** and *capacitors*.', 0.8, 1000), // Markdown
        createMockResponse('gemini', 'This circuit contains resistors and capacitors.', 0.8, 1000) // Plain text
      ];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(3);
      expect(result.qualityMetrics.consensus).toBeGreaterThan(0.8); // Should recognize content similarity despite formatting
      expect(result.consensusText).not.toContain('<p>'); // Should clean up formatting in consensus
    });

    it('should handle very long responses that might cause performance issues', async () => {
      const veryLongContent = 'This is a comprehensive analysis of the electrical circuit. '.repeat(1000); // ~50KB of text
      const responses: LLMResponse[] = [
        createMockResponse('openai', veryLongContent, 0.8, 5000),
        createMockResponse('claude', 'Short response about the circuit.', 0.7, 500),
        createMockResponse('gemini', veryLongContent.substring(0, 500) + '...', 0.75, 2000) // Truncated
      ];

      const startTime = Date.now();
      const result = await service.rankResponsesByConsensus(responses);
      const processingTime = Date.now() - startTime;

      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.rankedResponses).toHaveLength(3);
      expect(result.consensusText).toBeDefined();
    });
  });

  describe('Consensus Generation Edge Cases', () => {
    it('should handle consensus generation with conflicting information', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'The resistor value is 10kΩ and the capacitor is 100µF.', 0.9, 1000),
        createMockResponse('claude', 'The resistor value is 5kΩ and the capacitor is 200µF.', 0.8, 1000),
        createMockResponse('gemini', 'The resistor value is 15kΩ and the capacitor is 50µF.', 0.7, 1000)
      ];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(3);
      expect(result.consensusText).toBeDefined();
      
      // Consensus should favor highest-ranked response or indicate uncertainty
      expect(result.consensusText).toContain('resistor');
      expect(result.consensusText).toContain('capacitor');
      expect(result.qualityMetrics.consensus).toBeLessThan(0.5); // Low due to conflicts
    });

    it('should handle consensus with missing information across responses', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'The circuit contains a resistor.', 0.8, 800),
        createMockResponse('claude', 'A capacitor is present in the circuit.', 0.8, 800),
        createMockResponse('gemini', 'There is an LED in the circuit.', 0.8, 800)
      ];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(3);
      expect(result.consensusText).toBeDefined();
      
      // Consensus should combine non-conflicting information
      expect(result.consensusText).toContain('circuit');
      expect(result.qualityMetrics.completeness).toBeGreaterThan(0.5);
    });

    it('should handle consensus with redundant information', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'The circuit has a resistor. The resistor is 10kΩ. This 10kΩ resistor is important.', 0.8, 1200),
        createMockResponse('claude', 'There is a 10kΩ resistor in the circuit.', 0.8, 600),
        createMockResponse('gemini', '10 kiloohm resistor present.', 0.8, 400)
      ];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(3);
      expect(result.consensusText).toBeDefined();
      expect(result.consensusText.length).toBeLessThan(responses[0].response.length); // Should be more concise
      expect(result.qualityMetrics.consensus).toBeGreaterThan(0.8);
    });
  });

  describe('Performance and Memory Edge Cases', () => {
    it('should handle large number of responses efficiently', async () => {
      const responses: LLMResponse[] = Array.from({ length: 100 }, (_, i) =>
        createMockResponse(
          `provider_${i}`,
          `Analysis ${i}: This circuit contains various components with different characteristics and measurements.`,
          0.7 + Math.random() * 0.3,
          1000 + Math.random() * 1000
        )
      );

      const startTime = Date.now();
      const initialMemory = process.memoryUsage();
      
      const result = await service.rankResponsesByConsensus(responses);
      
      const endTime = Date.now();
      const finalMemory = process.memoryUsage();

      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(finalMemory.heapUsed - initialMemory.heapUsed).toBeLessThan(200 * 1024 * 1024); // Less than 200MB

      expect(result.rankedResponses).toHaveLength(100);
      expect(result.rankedResponses[0].rank).toBe(1);
      expect(result.rankedResponses[99].rank).toBe(100);
    });

    it('should handle memory efficiently with repeated processing', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Test response for memory efficiency', 0.8, 1000),
        createMockResponse('claude', 'Another test response for memory testing', 0.7, 1000),
        createMockResponse('gemini', 'Third test response for memory analysis', 0.9, 1000)
      ];

      const initialMemory = process.memoryUsage();
      
      // Process multiple times
      for (let i = 0; i < 50; i++) {
        await service.rankResponsesByConsensus(responses);
      }
      
      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('should handle responses with null or undefined content', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Valid response content', 0.8, 1000),
        { ...createMockResponse('claude', '', 0.5, 500), response: null as any },
        { ...createMockResponse('gemini', '', 0.6, 600), response: undefined as any }
      ];

      expect(async () => {
        await service.rankResponsesByConsensus(responses);
      }).not.toThrow();

      const result = await service.rankResponsesByConsensus(responses);
      expect(result.rankedResponses.length).toBeGreaterThan(0);
      expect(result.rankedResponses[0].provider).toBe('openai'); // Valid response should rank first
    });

    it('should handle responses with invalid confidence values', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Response with valid confidence', 0.8, 1000),
        { ...createMockResponse('claude', 'Response with NaN confidence', 0.7, 1000), confidence: Number.NaN },
        { ...createMockResponse('gemini', 'Response with negative confidence', 0.6, 1000), confidence: -0.5 }
      ];

      expect(async () => {
        await service.rankResponsesByConsensus(responses);
      }).not.toThrow();

      const result = await service.rankResponsesByConsensus(responses);
      expect(result.rankedResponses).toHaveLength(3);
      expect(result.rankedResponses[0].provider).toBe('openai'); // Valid response should rank first
    });

    it('should handle responses with extreme response times', async () => {
      const responses: LLMResponse[] = [
        createMockResponse('openai', 'Normal response', 0.8, 1000),
        createMockResponse('claude', 'Very fast response', 0.7, 1), // 1ms
        createMockResponse('gemini', 'Very slow response', 0.9, 300000) // 5 minutes
      ];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(3);
      
      // Should handle extreme values gracefully in quality metrics
      result.rankedResponses.forEach(ranked => {
        expect(ranked.score).toBeGreaterThan(0);
        expect(Number.isFinite(ranked.score)).toBe(true);
      });
    });

    it('should handle empty responses array', async () => {
      const responses: LLMResponse[] = [];

      const result = await service.rankResponsesByConsensus(responses);

      expect(result.rankedResponses).toHaveLength(0);
      expect(result.consensusText).toBe('');
      expect(result.qualityMetrics.consensus).toBe(0);
      expect(result.qualityMetrics.coherence).toBe(0);
      expect(result.qualityMetrics.completeness).toBe(0);
    });
  });
});

// Helper function
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
    usage: {
      promptTokens: Math.floor(content.length / 4),
      completionTokens: Math.floor(content.length / 4),
      totalTokens: Math.floor(content.length / 2)
    },
    components: [],
    metadata: {
      temperature: 0.7,
      maxTokens: 1000
    }
  };
}