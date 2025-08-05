/**
 * ContextExtractor - Context and entity extraction service
 * Identifies relevant drawing elements, extracts entities, and builds conversation context
 */

import type {
  ExtractedEntity,
  QueryContext,
  DocumentReference,
  ConversationNode,
  ContextExtractionResult
} from '../../../../shared/types/nlp.types';

interface ExtractionConfig {
  readonly entityTypes: ExtractedEntity['type'][];
  readonly confidenceThreshold: number;
  readonly maxEntities: number;
}

interface ExtractionStats {
  totalExtractions: number;
  entitiesExtracted: number;
  averageEntitiesPerQuery: number;
  averageConfidence: number;
  averageProcessingTime: number;
  entityTypeDistribution: Record<string, number>;
}

export class ContextExtractor {
  private readonly config: ExtractionConfig;
  private stats: ExtractionStats;

  // Electrical component patterns for entity recognition
  private readonly componentPatterns = {
    component: [
      /\b(resistor|capacitor|inductor|transistor|diode|led|switch|relay|fuse|breaker|transformer|motor|generator|battery|ic|chip)\b/gi,
      /\b(R\d+|C\d+|L\d+|Q\d+|D\d+|U\d+|IC\d+)\b/g, // Component designators
      /\b\d+(\.\d+)?\s*(ohm|ohms|ω|farad|henry|volt|amp|watt)s?\b/gi // Component values
    ],
    location: [
      /\b(pin|terminal|node|point|connection|junction|ground|vcc|vdd|vss)\s*\d*\b/gi,
      /\b(top|bottom|left|right|center|middle)\s*(side|corner|area|region)\b/gi,
      /\b(input|output|in|out)\s*(port|pin)?\b/gi
    ],
    property: [
      /\b(voltage|current|power|resistance|capacitance|inductance|frequency|impedance)\b/gi,
      /\b(ac|dc|high|low|positive|negative|forward|reverse)\b/gi,
      /\b(analog|digital|active|passive|linear|nonlinear)\b/gi
    ],
    measurement: [
      /\b\d+(\.\d+)?\s*(v|volts?|a|amps?|amperes?|w|watts?|hz|hertz|ω|ohms?|f|farads?|h|henrys?)\b/gi,
      /\b\d+(\.\d+)?\s*(k|m|µ|u|n|p)?(v|a|w|hz|ω|f|h)\b/gi // With SI prefixes
    ]
  };

  // Electrical topics for context classification
  private readonly electricalTopics = [
    'power supply', 'amplifier', 'filter', 'oscillator', 'regulator', 'converter',
    'digital logic', 'analog circuit', 'microcontroller', 'sensor', 'actuator',
    'power management', 'signal processing', 'communication', 'interface'
  ];

  constructor(config: ExtractionConfig) {
    this.config = config;
    this.stats = {
      totalExtractions: 0,
      entitiesExtracted: 0,
      averageEntitiesPerQuery: 0,
      averageConfidence: 0,
      averageProcessingTime: 0,
      entityTypeDistribution: {}
    };
  }

  /**
   * Extract context information from query and session data
   * @param queryText - The sanitized query text
   * @param existingContext - Partial context from previous interactions
   * @param documentIds - Optional document IDs for context
   * @returns Complete context extraction result
   */
  async extractContext(
    queryText: string,
    existingContext?: Partial<QueryContext>,
    documentIds?: string[]
  ): Promise<ContextExtractionResult> {
    const startTime = Date.now();

    try {
      // Extract entities from query text
      const entities = await this.extractEntities(queryText);

      // Extract topics from query
      const topics = this.extractTopics(queryText);

      // Build document references
      const relevantDocuments = await this.buildDocumentReferences(
        queryText,
        entities,
        documentIds
      );

      // Calculate context score based on available information
      const contextScore = this.calculateContextScore(entities, topics, relevantDocuments, existingContext);

      // Calculate extraction confidence
      const extractionConfidence = this.calculateExtractionConfidence(entities, topics);

      const processingTime = Date.now() - startTime;

      // Update statistics
      this.updateStats(entities, processingTime);

      const result: ContextExtractionResult = {
        entities,
        topics,
        relevantDocuments,
        contextScore,
        extractionConfidence
      };

      return result;

    } catch (error) {
      console.error('[ContextExtractor] Extraction failed:', error);
      
      // Return minimal context on error
      return {
        entities: [],
        topics: [],
        relevantDocuments: [],
        contextScore: 0.1,
        extractionConfidence: 0.1
      };
    }
  }

  /**
   * Extract entities from query text using pattern matching
   */
  private async extractEntities(queryText: string): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];
    const normalizedText = queryText.toLowerCase();

    for (const [entityType, patterns] of Object.entries(this.componentPatterns)) {
      for (const pattern of patterns) {
        const matches = Array.from(normalizedText.matchAll(pattern));
        
        for (const match of matches) {
          if (match.index !== undefined && match[0]) {
            const entity: ExtractedEntity = {
              text: match[0],
              type: entityType as ExtractedEntity['type'],
              confidence: this.calculateEntityConfidence(match[0], entityType),
              position: {
                start: match.index,
                end: match.index + match[0].length
              },
              metadata: {
                pattern: pattern.toString(),
                matchGroups: match.slice(1),
                normalizedText: match[0].toLowerCase().trim()
              }
            };

            // Only include entities above confidence threshold
            if (entity.confidence >= this.config.confidenceThreshold) {
              entities.push(entity);
            }
          }
        }
      }
    }

    // Sort by confidence and limit results
    return entities
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxEntities);
  }

  /**
   * Calculate confidence score for extracted entity
   */
  private calculateEntityConfidence(text: string, entityType: string): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence for specific patterns
    switch (entityType) {
      case 'component':
        if (/^[RLCQDU]\d+$/.test(text.toUpperCase())) {
          confidence += 0.4; // Component designators are highly confident
        } else if (/\d+(\.\d+)?\s*(ohm|farad|henry|volt|amp|watt)/i.test(text)) {
          confidence += 0.3; // Component values are confident
        } else if (['resistor', 'capacitor', 'transistor', 'diode'].includes(text.toLowerCase())) {
          confidence += 0.3; // Common component names
        }
        break;

      case 'location':
        if (/pin|terminal|node/i.test(text)) {
          confidence += 0.3;
        }
        if (/\d+/.test(text)) {
          confidence += 0.2; // Numbered locations are more specific
        }
        break;

      case 'property':
        if (['voltage', 'current', 'power', 'resistance'].includes(text.toLowerCase())) {
          confidence += 0.3; // Core electrical properties
        }
        break;

      case 'measurement':
        if (/^\d+(\.\d+)?\s*[a-z]+$/i.test(text)) {
          confidence += 0.4; // Well-formed measurements
        }
        break;
    }

    // Length-based adjustment
    if (text.length > 2) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Extract electrical engineering topics from query text
   */
  private extractTopics(queryText: string): string[] {
    const normalizedText = queryText.toLowerCase();
    const foundTopics: string[] = [];

    for (const topic of this.electricalTopics) {
      if (normalizedText.includes(topic)) {
        foundTopics.push(topic);
      }
    }

    // Look for compound topics and technical terms
    const technicalPatterns = [
      /power\s+supply/gi,
      /signal\s+processing/gi,
      /analog\s+circuit/gi,
      /digital\s+logic/gi,
      /frequency\s+response/gi,
      /impedance\s+matching/gi
    ];

    for (const pattern of technicalPatterns) {
      const matches = normalizedText.match(pattern);
      if (matches) {
        foundTopics.push(...matches.map(match => match.toLowerCase()));
      }
    }

    return Array.from(new Set(foundTopics));
  }

  /**
   * Build document references with relevance scoring
   */
  private async buildDocumentReferences(
    queryText: string,
    entities: ExtractedEntity[],
    documentIds?: string[]
  ): Promise<DocumentReference[]> {
    if (!documentIds || documentIds.length === 0) {
      return [];
    }

    const references: DocumentReference[] = [];

    for (const docId of documentIds) {
      // In a real implementation, this would query the document metadata/content
      // For now, we'll create a basic reference structure
      const relevanceScore = this.calculateDocumentRelevance(queryText, entities, docId);
      
      references.push({
        documentId: docId,
        fileName: `document-${docId}.pdf`, // Would be retrieved from storage
        relevanceScore
        // extractedContent would be populated in real implementation
      });
    }

    return references.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Calculate relevance score for document
   */
  private calculateDocumentRelevance(
    _queryText: string,
    entities: ExtractedEntity[],
    _documentId: string
  ): number {
    // Simple relevance calculation - in real implementation would analyze document content
    let relevance = 0.5; // Base relevance

    // Boost relevance if entities suggest technical content
    const technicalEntities = entities.filter(e => e.type === 'component' || e.type === 'measurement');
    relevance += Math.min(technicalEntities.length * 0.1, 0.3);

    // Add some randomness to simulate real document analysis
    relevance += (Math.random() - 0.5) * 0.2;

    return Math.max(0.1, Math.min(relevance, 1.0));
  }

  /**
   * Calculate overall context score
   */
  private calculateContextScore(
    entities: ExtractedEntity[],
    topics: string[],
    documents: DocumentReference[],
    existingContext?: Partial<QueryContext>
  ): number {
    let score = 0.3; // Base score

    // Entity contribution
    score += Math.min(entities.length * 0.1, 0.3);
    
    // High-confidence entities boost score more
    const highConfidenceEntities = entities.filter(e => e.confidence > 0.8);
    score += Math.min(highConfidenceEntities.length * 0.05, 0.2);

    // Topic contribution
    score += Math.min(topics.length * 0.05, 0.2);

    // Document context contribution
    score += Math.min(documents.length * 0.05, 0.15);

    // Previous context contribution
    if (existingContext) {
      if (existingContext.sessionHistory && existingContext.sessionHistory.length > 0) {
        score += 0.1;
      }
      if (existingContext.previousQueries && existingContext.previousQueries.length > 0) {
        score += 0.1;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate extraction confidence
   */
  private calculateExtractionConfidence(entities: ExtractedEntity[], topics: string[]): number {
    if (entities.length === 0 && topics.length === 0) {
      return 0.1;
    }

    const avgEntityConfidence = entities.length > 0
      ? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length
      : 0;

    const topicBonus = Math.min(topics.length * 0.1, 0.3);

    return Math.min(avgEntityConfidence + topicBonus + 0.2, 1.0);
  }

  /**
   * Update extraction statistics
   */
  private updateStats(entities: ExtractedEntity[], processingTime: number): void {
    this.stats.totalExtractions++;
    this.stats.entitiesExtracted += entities.length;
    
    // Update average entities per query
    this.stats.averageEntitiesPerQuery = this.stats.entitiesExtracted / this.stats.totalExtractions;

    // Update average confidence
    if (entities.length > 0) {
      const queryAvgConfidence = entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length;
      const oldAvg = this.stats.averageConfidence;
      this.stats.averageConfidence = (oldAvg * (this.stats.totalExtractions - 1) + queryAvgConfidence) / this.stats.totalExtractions;
    }

    // Update processing time
    const oldTimeAvg = this.stats.averageProcessingTime;
    this.stats.averageProcessingTime = (oldTimeAvg * (this.stats.totalExtractions - 1) + processingTime) / this.stats.totalExtractions;

    // Update entity type distribution
    for (const entity of entities) {
      this.stats.entityTypeDistribution[entity.type] = (this.stats.entityTypeDistribution[entity.type] || 0) + 1;
    }
  }

  /**
   * Analyze conversation flow and build context nodes
   */
  buildConversationFlow(
    _currentQuery: string,
    previousQueries: Array<{ id: string; text: string; timestamp: Date; intent?: any }>,
    maxDepth: number = 5
  ): ConversationNode[] {
    const nodes: ConversationNode[] = [];
    const recentQueries = previousQueries.slice(-maxDepth);

    for (const query of recentQueries) {
      const node: ConversationNode = {
        id: query.id,
        queryText: query.text,
        timestamp: query.timestamp,
        intent: query.intent || { type: 'general_question', confidence: 0.5, reasoning: 'Historical query' },
        children: [] // Would be populated based on follow-up relationships
      };
      nodes.push(node);
    }

    return nodes;
  }

  /**
   * Get extraction statistics
   */
  getStats(): ExtractionStats {
    return { ...this.stats };
  }

  /**
   * Health check for context extractor
   */
  async healthCheck(): Promise<boolean> {
    try {
      const testResult = await this.extractContext("What is the voltage across R1?");
      return testResult.entities.length > 0 && testResult.extractionConfidence > 0;
    } catch {
      return false;
    }
  }
}