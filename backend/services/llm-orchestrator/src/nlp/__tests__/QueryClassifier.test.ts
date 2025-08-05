/**
 * Unit tests for QueryClassifier service
 * Tests intent classification accuracy, confidence scoring, and edge cases
 */

import { QueryClassifier } from '../QueryClassifier';
// import type { QueryIntent } from '../../../../../shared/types/nlp.types';

describe('QueryClassifier', () => {
  let classifier: QueryClassifier;

  beforeEach(() => {
    classifier = new QueryClassifier({
      confidenceThreshold: 0.6,
      fallbackIntent: 'general_question'
    });
  });

  describe('Intent Classification', () => {
    describe('component_identification intent', () => {
      it('should classify component identification queries with high confidence', async () => {
        const queries = [
          'What is this resistor?',
          'Identify the capacitor in the circuit',
          'What type of transistor is this?',
          'What is the value of R1?',
          'Find the diode in this schematic'
        ];

        for (const query of queries) {
          const result = await classifier.classifyIntent(query);
          expect(result.intent.type).toBe('component_identification');
          expect(result.intent.confidence).toBeGreaterThan(0.6);
          expect(result.intent.reasoning).toContain('component');
        }
      });

      it('should recognize component designators (R1, C2, etc.)', async () => {
        const queries = [
          'What is R1?',
          'Check C2 value',
          'Measure Q3 voltage',
          'Replace D4',
          'Test IC1 functionality'
        ];

        for (const query of queries) {
          const result = await classifier.classifyIntent(query);
          expect(result.intent.type).toBe('component_identification');
          expect(result.intent.confidence).toBeGreaterThan(0.7);
        }
      });

      it('should handle component values and units', async () => {
        const queries = [
          'What is this 100 ohm resistor?',
          'Identify the 10uF capacitor',
          'Check the 12V supply'
        ];

        for (const query of queries) {
          const result = await classifier.classifyIntent(query);
          expect(result.intent.type).toBe('component_identification');
        }
      });
    });

    describe('schematic_analysis intent', () => {
      it('should classify analysis queries correctly', async () => {
        const queries = [
          'Analyze this power supply circuit',
          'How does current flow in this circuit?',
          'Trace the signal path',
          'What is the circuit topology?',
          'Analyze the frequency response'
        ];

        for (const query of queries) {
          const result = await classifier.classifyIntent(query);
          expect(result.intent.type).toBe('schematic_analysis');
          expect(result.intent.confidence).toBeGreaterThan(0.5);
          expect(result.intent.reasoning).toMatch(/analy|trace|circuit|schematic/i);
        }
      });

      it('should recognize circuit analysis keywords', async () => {
        const analysisKeywords = [
          'analyze the amplifier',
          'trace current path',
          'circuit operation',
          'schematic diagram analysis',
          'signal flow analysis'
        ];

        for (const query of analysisKeywords) {
          const result = await classifier.classifyIntent(query);
          expect(result.intent.type).toBe('schematic_analysis');
        }
      });
    });

    describe('general_question intent', () => {
      it('should classify general questions correctly', async () => {
        const queries = [
          'How do transistors work?',
          'What is Ohm\'s law?',
          'Why do we use capacitors?',
          'When should I use a pull-up resistor?',
          'Explain voltage division'
        ];

        for (const query of queries) {
          const result = await classifier.classifyIntent(query);
          expect(result.intent.type).toBe('general_question');
          expect(result.intent.confidence).toBeGreaterThan(0.5);
        }
      });

      it('should recognize question words and patterns', async () => {
        const questionWords = ['what', 'how', 'why', 'when', 'where', 'which'];
        
        for (const word of questionWords) {
          const query = `${word.charAt(0).toUpperCase() + word.slice(1)} is a resistor?`;
          const result = await classifier.classifyIntent(query);
          expect(result.intent.type).toBe('general_question');
          expect(result.intent.reasoning).toContain('question word');
        }
      });

      it('should recognize questions ending with question marks', async () => {
        const queries = [
          'What is voltage?',
          'How does this work?',
          'Why is this important?'
        ];

        for (const query of queries) {
          const result = await classifier.classifyIntent(query);
          expect(result.intent.type).toBe('general_question');
          expect(result.intent.reasoning).toContain('question mark');
        }
      });
    });
  });

  describe('Confidence Scoring', () => {
    it('should return higher confidence for clear intent matches', async () => {
      const clearQueries = [
        { query: 'Identify this resistor', expectedIntent: 'component_identification' },
        { query: 'Analyze the power supply circuit', expectedIntent: 'schematic_analysis' },
        { query: 'What is Ohm\'s law?', expectedIntent: 'general_question' }
      ];

      for (const { query, expectedIntent } of clearQueries) {
        const result = await classifier.classifyIntent(query);
        expect(result.intent.type).toBe(expectedIntent);
        expect(result.intent.confidence).toBeGreaterThan(0.7);
      }
    });

    it('should return lower confidence for ambiguous queries', async () => {
      const ambiguousQueries = [
        'check this',
        'what about that',
        'look at this thing'
      ];

      for (const query of ambiguousQueries) {
        const result = await classifier.classifyIntent(query);
        expect(result.intent.confidence).toBeLessThan(0.7);
      }
    });

    it('should use fallback intent for low confidence classifications', async () => {
      const vaguefQueries = [
        'hmm',
        'check',
        'this thing'
      ];

      for (const query of vaguefQueries) {
        const result = await classifier.classifyIntent(query);
        // Should either be low confidence or fallback to general_question
        if (result.intent.confidence < 0.6) {
          expect(result.intent.type).toBe('general_question');
          expect(result.intent.reasoning).toContain('fallback');
        }
      }
    });
  });

  describe('Subcategories', () => {
    it('should assign appropriate subcategories for component identification', async () => {
      const subcategoryTests = [
        { query: 'What is this passive component?', expectedSubcategory: 'passive-component' },
        { query: 'Identify the active component', expectedSubcategory: 'active-component' },
        { query: 'What IC is this?', expectedSubcategory: 'integrated-circuit' }
      ];

      for (const { query, expectedSubcategory } of subcategoryTests) {
        const result = await classifier.classifyIntent(query);
        if (result.intent.type === 'component_identification') {
          expect(result.intent.subcategory).toBe(expectedSubcategory);
        }
      }
    });

    it('should assign appropriate subcategories for schematic analysis', async () => {
      const subcategoryTests = [
        { query: 'Analyze the power supply', expectedSubcategory: 'power-analysis' },
        { query: 'Check the AC signal', expectedSubcategory: 'signal-analysis' },
        { query: 'Analyze DC operation', expectedSubcategory: 'dc-analysis' }
      ];

      for (const { query, expectedSubcategory } of subcategoryTests) {
        const result = await classifier.classifyIntent(query);
        if (result.intent.type === 'schematic_analysis') {
          expect(result.intent.subcategory).toBe(expectedSubcategory);
        }
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty queries gracefully', async () => {
      const result = await classifier.classifyIntent('');
      expect(result.intent.type).toBe('general_question');
      expect(result.intent.confidence).toBeLessThan(0.5);
    });

    it('should handle very long queries', async () => {
      const longQuery = 'What is this resistor '.repeat(100) + '?';
      const result = await classifier.classifyIntent(longQuery);
      expect(result.intent).toBeDefined();
      expect(result.processingTime).toBeLessThan(1000); // Should process within 1 second
    });

    it('should handle special characters and numbers', async () => {
      const specialQueries = [
        'What is R1 (100Ω)?',
        'Check C2 [10µF]',
        'Measure V_out @ 1kHz'
      ];

      for (const query of specialQueries) {
        const result = await classifier.classifyIntent(query);
        expect(result.intent).toBeDefined();
        expect(result.intent.confidence).toBeGreaterThan(0);
      }
    });

    it('should handle mixed case queries', async () => {
      const mixedCaseQueries = [
        'WHAT IS THIS RESISTOR?',
        'analyze This Circuit',
        'hOw Do TrAnSiStOrS wOrK?'
      ];

      for (const query of mixedCaseQueries) {
        const result = await classifier.classifyIntent(query);
        expect(result.intent).toBeDefined();
      }
    });
  });

  describe('Alternative Intents', () => {
    it('should provide alternative intents with lower confidence', async () => {
      const result = await classifier.classifyIntent('What is this component in the circuit?');
      
      expect(result.alternativeIntents).toBeDefined();
      expect(result.alternativeIntents.length).toBeGreaterThan(0);
      
      // Alternative intents should have lower confidence than primary
      for (const alt of result.alternativeIntents) {
        expect(alt.confidence).toBeLessThanOrEqual(result.intent.confidence);
      }
    });

    it('should include all three intent types in comprehensive queries', async () => {
      const result = await classifier.classifyIntent('What is this resistor and how does it work in this circuit?');
      
      const allIntentTypes = [result.intent, ...result.alternativeIntents].map(i => i.type);
      const uniqueTypes = new Set(allIntentTypes);
      
      // Should have multiple intent types for complex queries
      expect(uniqueTypes.size).toBeGreaterThan(1);
    });
  });

  describe('Statistics and Performance', () => {
    it('should track classification statistics', async () => {
      await classifier.classifyIntent('What is this resistor?');
      await classifier.classifyIntent('Analyze this circuit');
      
      const updatedStats = classifier.getStats();
      expect(updatedStats.totalClassifications).toBeGreaterThanOrEqual(2);
      expect(updatedStats.successfulClassifications).toBeGreaterThan(0);
    });

    it('should update intent distribution statistics', async () => {
      await classifier.classifyIntent('What is R1?'); // component_identification
      await classifier.classifyIntent('How does this work?'); // general_question
      
      const stats = classifier.getStats();
      expect(stats.intentDistribution).toBeDefined();
      expect(Object.keys(stats.intentDistribution)).toContain('component_identification');
    });

    it('should track average processing time', async () => {
      await classifier.classifyIntent('Test query');
      
      const updatedStats = classifier.getStats();
      expect(updatedStats.averageProcessingTime).toBeGreaterThan(0);
      expect(updatedStats.averageProcessingTime).toBeLessThan(1000); // Should be fast
    });
  });

  describe('Health Check', () => {
    it('should pass health check with valid classifier', async () => {
      const isHealthy = await classifier.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });

  describe('Training Data Management', () => {
    it('should allow adding training data', () => {
      const trainingData = {
        query: 'Test query for training',
        expectedIntent: 'component_identification' as const,
        confidence: 0.9
      };

      classifier.addTrainingData(trainingData);
      const allTrainingData = classifier.getTrainingData();
      
      expect(allTrainingData).toContain(trainingData);
    });

    it('should initialize with default training data', () => {
      const trainingData = classifier.getTrainingData();
      expect(trainingData.length).toBeGreaterThan(0);
      
      // Should have examples for all intent types
      const intentTypes = trainingData.map(d => d.expectedIntent);
      expect(intentTypes).toContain('component_identification');
      expect(intentTypes).toContain('schematic_analysis');
      expect(intentTypes).toContain('general_question');
    });
  });

  describe('Error Handling', () => {
    it('should handle classification errors gracefully', async () => {
      // Spy on console.error to avoid cluttering test output
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Test with potentially problematic input
      const result = await classifier.classifyIntent(null as any);
      
      expect(result.intent.type).toBe('general_question');
      expect(result.intent.confidence).toBeLessThan(0.5);
      expect(result.intent.reasoning).toContain('error');

      consoleSpy.mockRestore();
    });
  });
});