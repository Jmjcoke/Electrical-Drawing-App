/**
 * SuggestionEngine - Autocomplete suggestions service
 * Provides context-aware query recommendations for electrical engineering queries
 */

import type {
  AutocompleteSuggestion,
  GetSuggestionsRequest,
  GetSuggestionsResponse,
  QueryContext
} from '../../../../shared/types/nlp.types';

interface SuggestionStats {
  totalRequests: number;
  suggestionsGenerated: number;
  averageSuggestionsPerRequest: number;
  averageProcessingTime: number;
  popularSuggestions: Record<string, number>;
}

export class SuggestionEngine {
  private stats: SuggestionStats;

  // Pre-defined electrical engineering question templates
  private readonly questionTemplates = {
    component_identification: [
      "What is this {component} component?",
      "Identify the {component} in the circuit",
      "What type of {component} is shown?",
      "What is the value of {component}?",
      "What is the function of {component}?",
      "Where is {component} located in the circuit?"
    ],
    schematic_analysis: [
      "Analyze this power supply circuit",
      "How does this amplifier work?",
      "Trace the signal path in this circuit",
      "What is the operating principle of this circuit?",
      "Calculate the voltage at node {node}",
      "Determine the current through {component}",
      "Analyze the frequency response",
      "What is the gain of this amplifier?",
      "How does current flow in this circuit?",
      "What happens when {component} fails?"
    ],
    general_question: [
      "How do {component}s work?",
      "What is the difference between {component1} and {component2}?",
      "When would you use a {component}?",
      "What are the applications of {component}s?",
      "How do you calculate {property}?",
      "What is {concept} in electrical engineering?",
      "Why is {component} important in this circuit?",
      "How do you troubleshoot {problem}?"
    ]
  };

  // Common electrical components for template substitution
  private readonly components = [
    'resistor', 'capacitor', 'inductor', 'transistor', 'diode', 'LED',
    'switch', 'relay', 'fuse', 'transformer', 'motor', 'battery',
    'IC', 'op-amp', 'microcontroller', 'sensor', 'connector'
  ];

  // Common electrical properties and concepts
  private readonly properties = [
    'voltage', 'current', 'power', 'resistance', 'capacitance',
    'inductance', 'impedance', 'frequency', 'gain', 'efficiency'
  ];

  private readonly concepts = [
    'Ohm\'s law', 'Kirchhoff\'s laws', 'voltage division', 'current division',
    'AC analysis', 'DC analysis', 'frequency response', 'feedback',
    'amplification', 'filtering', 'rectification', 'regulation'
  ];

  // Common electrical problems
  private readonly problems = [
    'short circuits', 'open circuits', 'voltage drops', 'noise',
    'oscillations', 'instability', 'overheating', 'component failure'
  ];

  // Context-based suggestion patterns
  private readonly contextPatterns = {
    power_supply: [
      "What is the output voltage of this power supply?",
      "How efficient is this power supply?",
      "What type of regulation is used?",
      "Analyze the ripple voltage",
      "What happens during load changes?"
    ],
    amplifier: [
      "What is the gain of this amplifier?",
      "Analyze the frequency response",
      "What is the input impedance?",
      "Calculate the output power",
      "How does feedback affect performance?"
    ],
    filter: [
      "What type of filter is this?",
      "What is the cutoff frequency?",
      "Analyze the frequency response",
      "What is the filter order?",
      "Calculate the phase response"
    ],
    oscillator: [
      "What is the oscillation frequency?",
      "How does this oscillator work?",
      "What determines the frequency?",
      "Analyze the feedback loop",
      "What is the output amplitude?"
    ]
  };

  constructor() {
    this.stats = {
      totalRequests: 0,
      suggestionsGenerated: 0,
      averageSuggestionsPerRequest: 0,
      averageProcessingTime: 0,
      popularSuggestions: {}
    };
  }

  /**
   * Generate autocomplete suggestions based on partial query and context
   * @param request - Suggestion request with partial query and context
   * @returns Array of ranked autocomplete suggestions
   */
  async generateSuggestions(request: GetSuggestionsRequest): Promise<GetSuggestionsResponse> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      const suggestions: AutocompleteSuggestion[] = [];

      // Generate different types of suggestions
      const templateSuggestions = await this.generateTemplateSuggestions(request);
      const contextSuggestions = await this.generateContextSuggestions(request);
      const completionSuggestions = await this.generateCompletionSuggestions(request);
      const popularSuggestions = await this.generatePopularSuggestions(request);

      // Combine all suggestions
      suggestions.push(
        ...templateSuggestions,
        ...contextSuggestions,
        ...completionSuggestions,
        ...popularSuggestions
      );

      // Remove duplicates and rank suggestions
      const uniqueSuggestions = this.removeDuplicates(suggestions);
      const rankedSuggestions = this.rankSuggestions(uniqueSuggestions, request);

      // Limit results
      const maxSuggestions = request.partialQuery.length < 3 ? 8 : 12;
      const finalSuggestions = rankedSuggestions.slice(0, maxSuggestions);

      // Update statistics
      const processingTime = Date.now() - startTime;
      this.updateStats(finalSuggestions, processingTime);

      return {
        success: true,
        suggestions: finalSuggestions,
        processingTime
      };

    } catch (error) {
      console.error('[SuggestionEngine] Generation failed:', error);
      return {
        success: false,
        suggestions: [],
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Generate suggestions from question templates
   */
  private async generateTemplateSuggestions(request: GetSuggestionsRequest): Promise<AutocompleteSuggestion[]> {
    const suggestions: AutocompleteSuggestion[] = [];
    const partialLower = request.partialQuery.toLowerCase();

    // Match against template patterns
    for (const [category, templates] of Object.entries(this.questionTemplates)) {
      for (const template of templates) {
        const templateLower = template.toLowerCase();
        
        // Check if template matches partial query
        const relevance = this.calculateTemplateRelevance(partialLower, templateLower);
        
        if (relevance > 0.3) {
          // Fill in template variables
          const filledTemplate = this.fillTemplate(template, request.currentContext || {} as QueryContext);
          
          suggestions.push({
            text: filledTemplate,
            category: `template-${category}`,
            relevanceScore: relevance,
            reasoning: `Template suggestion for ${category}`,
            examples: this.getTemplateExamples(template)
          });
        }
      }
    }

    return suggestions;
  }

  /**
   * Generate context-aware suggestions based on document content
   */
  private async generateContextSuggestions(request: GetSuggestionsRequest): Promise<AutocompleteSuggestion[]> {
    const suggestions: AutocompleteSuggestion[] = [];
    
    // Analyze context for circuit types
    const circuitTypes = this.identifyCircuitTypes(request.currentContext || {} as QueryContext);
    
    for (const circuitType of circuitTypes) {
      const patterns = this.contextPatterns[circuitType as keyof typeof this.contextPatterns];
      if (patterns) {
        for (const pattern of patterns) {
          const relevance = this.calculateContextRelevance(request.partialQuery, pattern, circuitType);
          
          if (relevance > 0.4) {
            suggestions.push({
              text: pattern,
              category: `context-${circuitType}`,
              relevanceScore: relevance,
              reasoning: `Context-based suggestion for ${circuitType} circuits`,
              examples: [`Example: ${pattern}`]
            });
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Generate query completion suggestions
   */
  private async generateCompletionSuggestions(request: GetSuggestionsRequest): Promise<AutocompleteSuggestion[]> {
    const suggestions: AutocompleteSuggestion[] = [];
    const partial = request.partialQuery.toLowerCase().trim();

    // Common question starters
    const questionStarters = {
      'what': ['What is', 'What type of', 'What does', 'What happens when', 'What is the purpose of'],
      'how': ['How does', 'How do you', 'How to', 'How can I', 'How is'],
      'why': ['Why is', 'Why does', 'Why do you need', 'Why is it important'],
      'where': ['Where is', 'Where do you', 'Where can I find'],
      'when': ['When do you use', 'When is', 'When should I']
    };

    for (const [starter, completions] of Object.entries(questionStarters)) {
      if (partial.startsWith(starter.substring(0, Math.min(starter.length, partial.length)))) {
        for (const completion of completions) {
          if (completion.toLowerCase().startsWith(partial)) {
            const remaining = completion.substring(partial.length);
            if (remaining.length > 0) {
              suggestions.push({
                text: completion + this.suggestCommonObjects(),
                category: 'completion',
                relevanceScore: 0.7,
                reasoning: `Query completion for "${starter}" questions`,
                examples: [`${completion} a resistor?`, `${completion} this work?`]
              });
            }
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Generate popular/trending suggestions
   */
  private async generatePopularSuggestions(request: GetSuggestionsRequest): Promise<AutocompleteSuggestion[]> {
    const suggestions: AutocompleteSuggestion[] = [];

    // Most common electrical engineering questions
    const popularQueries = [
      "What is the voltage across this resistor?",
      "How does this amplifier circuit work?",
      "Identify the components in this circuit",
      "What is the current through this component?",
      "Analyze the power consumption",
      "What type of filter is this?",
      "How do you calculate the gain?",
      "What happens if this component fails?"
    ];

    for (const query of popularQueries) {
      const relevance = this.calculateStringRelevance(request.partialQuery, query);
      
      if (relevance > 0.2) {
        suggestions.push({
          text: query,
          category: 'popular',
          relevanceScore: relevance + 0.1, // Boost popular suggestions
          reasoning: 'Popular electrical engineering query',
          examples: [query]
        });
      }
    }

    return suggestions;
  }

  /**
   * Fill template variables with context-appropriate values
   */
  private fillTemplate(template: string, context: QueryContext): string {
    let filled = template;

    // Replace component placeholders
    if (filled.includes('{component}')) {
      const component = this.selectContextualComponent(context);
      filled = filled.replace(/{component}/g, component);
    }

    // Replace component pairs for comparison
    if (filled.includes('{component1}') && filled.includes('{component2}')) {
      const components = this.selectComponentPair();
      filled = filled.replace('{component1}', components[0])
                     .replace('{component2}', components[1]);
    }

    // Replace property placeholders
    if (filled.includes('{property}')) {
      const property = this.selectRandomFrom(this.properties);
      filled = filled.replace(/{property}/g, property);
    }

    // Replace concept placeholders
    if (filled.includes('{concept}')) {
      const concept = this.selectRandomFrom(this.concepts);
      filled = filled.replace(/{concept}/g, concept);
    }

    // Replace problem placeholders
    if (filled.includes('{problem}')) {
      const problem = this.selectRandomFrom(this.problems);
      filled = filled.replace(/{problem}/g, problem);
    }

    // Replace node placeholders
    if (filled.includes('{node}')) {
      filled = filled.replace(/{node}/g, this.generateNodeName());
    }

    return filled;
  }

  /**
   * Select component based on context
   */
  private selectContextualComponent(context: QueryContext): string {
    // Try to find components mentioned in previous queries
    for (const query of context.previousQueries) {
      for (const component of this.components) {
        if (query.text.toLowerCase().includes(component)) {
          return component;
        }
      }
    }

    // Try to find components in extracted topics
    for (const topic of context.extractedTopics) {
      for (const component of this.components) {
        if (topic.includes(component)) {
          return component;
        }
      }
    }

    // Default to random component
    return this.selectRandomFrom(this.components);
  }

  /**
   * Select a pair of related components for comparison
   */
  private selectComponentPair(): [string, string] {
    const pairs: [string, string][] = [
      ['resistor', 'capacitor'],
      ['NPN transistor', 'PNP transistor'],
      ['AC motor', 'DC motor'],
      ['analog signal', 'digital signal'],
      ['series circuit', 'parallel circuit']
    ];

    return this.selectRandomFrom(pairs);
  }

  /**
   * Generate a random node name
   */
  private generateNodeName(): string {
    const nodeNames = ['A', 'B', 'C', 'VCC', 'VDD', 'VSS', 'GND', 'IN', 'OUT'];
    return this.selectRandomFrom(nodeNames);
  }

  /**
   * Select random item from array
   */
  private selectRandomFrom<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Identify circuit types from context
   */
  private identifyCircuitTypes(context: QueryContext): string[] {
    const types: string[] = [];
    const contextText = [
      ...context.extractedTopics,
      ...context.sessionHistory,
      ...context.previousQueries.map(q => q.text)
    ].join(' ').toLowerCase();

    // Check for circuit type indicators
    const typeIndicators = {
      power_supply: ['power supply', 'regulator', 'converter', 'rectifier'],
      amplifier: ['amplifier', 'amp', 'gain', 'op-amp', 'operational amplifier'],
      filter: ['filter', 'low pass', 'high pass', 'band pass', 'notch'],
      oscillator: ['oscillator', 'clock', 'frequency generator', 'vco']
    };

    for (const [type, indicators] of Object.entries(typeIndicators)) {
      if (indicators.some(indicator => contextText.includes(indicator))) {
        types.push(type);
      }
    }

    return types;
  }

  /**
   * Calculate template relevance score
   */
  private calculateTemplateRelevance(partial: string, template: string): number {
    return this.calculateStringRelevance(partial, template);
  }

  /**
   * Calculate context-based relevance
   */
  private calculateContextRelevance(partial: string, suggestion: string, circuitType: string): number {
    let relevance = this.calculateStringRelevance(partial, suggestion);
    
    // Boost relevance if partial query contains circuit type indicators
    if (partial.includes(circuitType.replace('_', ' '))) {
      relevance += 0.2;
    }

    return Math.min(relevance, 1.0);
  }

  /**
   * Calculate string similarity/relevance
   */
  private calculateStringRelevance(partial: string, candidate: string): number {
    const partialLower = partial.toLowerCase().trim();
    const candidateLower = candidate.toLowerCase();

    if (partialLower.length === 0) return 0.5;
    if (candidateLower.startsWith(partialLower)) return 0.9;
    if (candidateLower.includes(partialLower)) return 0.7;

    // Word-based matching
    const partialWords = partialLower.split(/\s+/);
    const candidateWords = candidateLower.split(/\s+/);
    
    const matchingWords = partialWords.filter(word => 
      candidateWords.some(cWord => cWord.includes(word) || word.includes(cWord))
    );

    return Math.min(matchingWords.length / partialWords.length, 1.0) * 0.6;
  }

  /**
   * Suggest common electrical objects for completion
   */
  private suggestCommonObjects(): string {
    const objects = [
      ' resistor?', ' capacitor?', ' this circuit?', ' this component?',
      ' voltage?', ' current?', ' power?', ' this work?'
    ];
    return this.selectRandomFrom(objects);
  }

  /**
   * Remove duplicate suggestions
   */
  private removeDuplicates(suggestions: AutocompleteSuggestion[]): AutocompleteSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter(suggestion => {
      const key = suggestion.text.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Rank suggestions by relevance and other factors
   */
  private rankSuggestions(
    suggestions: AutocompleteSuggestion[],
    _request: GetSuggestionsRequest
  ): AutocompleteSuggestion[] {
    return suggestions
      .map(suggestion => ({
        ...suggestion,
        // Boost score based on category preferences
        relevanceScore: suggestion.relevanceScore + this.getCategoryBoost(suggestion.category)
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Get category-specific boost for ranking
   */
  private getCategoryBoost(category: string): number {
    const boosts = {
      'completion': 0.1,
      'popular': 0.05,
      'template-component_identification': 0.15,
      'template-schematic_analysis': 0.1,
      'template-general_question': 0.05,
      'context-power_supply': 0.2,
      'context-amplifier': 0.2,
      'context-filter': 0.15,
      'context-oscillator': 0.15
    };

    return (boosts as any)[category] || 0;
  }

  /**
   * Get template examples for display
   */
  private getTemplateExamples(template: string): string[] {
    const examples: string[] = [];
    
    if (template.includes('{component}')) {
      examples.push(template.replace(/{component}/g, 'resistor'));
      examples.push(template.replace(/{component}/g, 'capacitor'));
    } else {
      examples.push(template);
    }

    return examples.slice(0, 2);
  }

  /**
   * Update suggestion statistics
   */
  private updateStats(suggestions: AutocompleteSuggestion[], processingTime: number): void {
    this.stats.suggestionsGenerated += suggestions.length;
    
    // Update average suggestions per request
    this.stats.averageSuggestionsPerRequest = this.stats.suggestionsGenerated / this.stats.totalRequests;

    // Update average processing time
    const oldTimeAvg = this.stats.averageProcessingTime;
    this.stats.averageProcessingTime = (oldTimeAvg * (this.stats.totalRequests - 1) + processingTime) / this.stats.totalRequests;

    // Track popular suggestions
    for (const suggestion of suggestions) {
      this.stats.popularSuggestions[suggestion.text] = (this.stats.popularSuggestions[suggestion.text] || 0) + 1;
    }
  }

  /**
   * Get suggestion statistics
   */
  getStats(): SuggestionStats {
    return { ...this.stats };
  }

  /**
   * Health check for suggestion engine
   */
  async healthCheck(): Promise<boolean> {
    try {
      const testRequest: GetSuggestionsRequest = {
        partialQuery: "What is",
        sessionId: "test-session",
        documentIds: [],
        currentContext: {
          sessionHistory: [],
          documentContext: [],
          previousQueries: [],
          conversationFlow: [],
          extractedTopics: []
        }
      };

      const response = await this.generateSuggestions(testRequest);
      return response.success && response.suggestions.length > 0;
    } catch {
      return false;
    }
  }
}