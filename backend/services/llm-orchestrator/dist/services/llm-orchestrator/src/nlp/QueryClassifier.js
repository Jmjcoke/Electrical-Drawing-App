"use strict";
/**
 * QueryClassifier - Intent classification service for electrical drawing queries
 * Categorizes queries into component_identification, general_question, or schematic_analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryClassifier = void 0;
class QueryClassifier {
    constructor(config) {
        // Electrical component keywords for classification
        this.componentKeywords = [
            'resistor', 'capacitor', 'inductor', 'transistor', 'diode', 'led', 'switch', 'relay',
            'fuse', 'breaker', 'transformer', 'motor', 'generator', 'battery', 'wire', 'cable',
            'connector', 'terminal', 'ground', 'voltage', 'current', 'power', 'component', 'part',
            'ohm', 'farad', 'henry', 'volt', 'amp', 'watt', 'ic', 'chip', 'pcb', 'board'
        ];
        // Schematic analysis keywords
        this.schematicKeywords = [
            'circuit', 'schematic', 'diagram', 'topology', 'connection', 'node', 'loop', 'path',
            'analyze', 'analysis', 'flow', 'signal', 'trace', 'route', 'network', 'mesh',
            'branch', 'junction', 'configuration', 'layout', 'design', 'structure'
        ];
        // General question indicators
        this.generalKeywords = [
            'what', 'how', 'why', 'where', 'when', 'which', 'explain', 'describe', 'tell',
            'meaning', 'purpose', 'function', 'work', 'operate', 'used', 'application',
            'example', 'difference', 'compare', 'help', 'question'
        ];
        this.config = config;
        this.stats = {
            totalClassifications: 0,
            successfulClassifications: 0,
            averageConfidence: 0,
            intentDistribution: {},
            averageProcessingTime: 0
        };
        this.trainingData = this.initializeTrainingData();
    }
    /**
     * Classify query intent with confidence scoring
     * @param queryText - The sanitized query text to classify
     * @returns Classification result with intent and alternatives
     */
    async classifyIntent(queryText) {
        const startTime = Date.now();
        try {
            // Handle empty queries early
            if (!queryText || queryText.trim().length === 0) {
                const processingTime = Date.now() - startTime;
                this.updateStats({
                    type: this.config.fallbackIntent,
                    confidence: 0.1,
                    subcategory: 'empty-query',
                    reasoning: 'Empty query provided'
                }, processingTime);
                return {
                    intent: {
                        type: this.config.fallbackIntent,
                        confidence: 0.1,
                        subcategory: 'empty-query',
                        reasoning: 'Empty query provided'
                    },
                    alternativeIntents: [],
                    processingTime,
                    modelUsed: 'rule-based-v1'
                };
            }
            const normalizedQuery = this.normalizeText(queryText);
            const scores = this.calculateIntentScores(normalizedQuery);
            // Sort intents by confidence score
            const sortedIntents = Object.entries(scores)
                .map(([type, confidence]) => ({
                type: type,
                confidence,
                subcategory: this.determineSubcategory(type, normalizedQuery),
                reasoning: this.generateReasoning(type, normalizedQuery, confidence)
            }))
                .sort((a, b) => b.confidence - a.confidence);
            const primaryIntent = sortedIntents[0];
            const alternativeIntents = sortedIntents.slice(1);
            // Apply confidence threshold and fallback logic
            const finalIntent = primaryIntent.confidence >= this.config.confidenceThreshold
                ? primaryIntent
                : {
                    type: this.config.fallbackIntent,
                    confidence: 0.5,
                    subcategory: 'fallback',
                    reasoning: `Low confidence (${primaryIntent.confidence.toFixed(2)}) in primary classification, using fallback intent`
                };
            const processingTime = Date.now() - startTime;
            // Update statistics
            this.updateStats(finalIntent, processingTime);
            const result = {
                intent: finalIntent,
                alternativeIntents,
                processingTime,
                modelUsed: 'rule-based-v1'
            };
            return result;
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            // Fallback to default intent on error
            const fallbackIntent = {
                type: this.config.fallbackIntent,
                confidence: 0.1,
                subcategory: 'error-fallback',
                reasoning: `Classification error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
            return {
                intent: fallbackIntent,
                alternativeIntents: [],
                processingTime,
                modelUsed: 'rule-based-v1'
            };
        }
    }
    /**
     * Calculate intent scores based on keyword matching and patterns
     */
    calculateIntentScores(normalizedQuery) {
        const words = normalizedQuery.split(/\s+/);
        const scores = {
            component_identification: 0,
            general_question: 0,
            schematic_analysis: 0
        };
        // Component identification scoring
        const componentMatches = this.countKeywordMatches(words, this.componentKeywords);
        const weights = this.config.scoringWeights;
        scores.component_identification += componentMatches * weights.componentKeywordWeight;
        // Look for component designators (R1, C2, etc.) - very strong indicator
        if (/\b[rlcqdu]\d+\b/i.test(normalizedQuery)) {
            scores.component_identification += weights.componentDesignatorWeight;
        }
        // Look for specific component identification patterns
        if (/identify|find|locate|what\s+is\s+this|type\s+of\s+component/.test(normalizedQuery)) {
            scores.component_identification += weights.componentPatternWeight;
        }
        // Look for component-specific queries
        if (/resistance|capacitance|inductance|value|rating/.test(normalizedQuery)) {
            scores.component_identification += weights.componentValueWeight;
        }
        if (/component|part|device|element/.test(normalizedQuery)) {
            scores.component_identification += weights.componentTermWeight;
        }
        // Schematic analysis scoring
        const schematicMatches = this.countKeywordMatches(words, this.schematicKeywords);
        scores.schematic_analysis += schematicMatches * weights.schematicKeywordWeight;
        // Look for analysis patterns
        if (/analy[sz]e|trace|follow|flow|path|connection/.test(normalizedQuery)) {
            scores.schematic_analysis += weights.schematicPatternWeight;
        }
        if (/circuit|schematic|diagram|topology/.test(normalizedQuery)) {
            scores.schematic_analysis += weights.schematicTermWeight;
        }
        // General question scoring
        const generalMatches = this.countKeywordMatches(words, this.generalKeywords);
        scores.general_question += generalMatches * weights.generalKeywordWeight;
        // Question word patterns
        if (/^(what|how|why|where|when|which|who)\s/.test(normalizedQuery)) {
            scores.general_question += weights.questionStartWeight;
        }
        if (/\?$/.test(normalizedQuery)) {
            scores.general_question += weights.questionEndWeight;
        }
        // Reduce general question score if component-specific terms are present
        if (componentMatches > 0 || /\b[rlcqdu]\d+\b/i.test(normalizedQuery)) {
            scores.general_question *= weights.generalReductionFactor;
        }
        // Normalize scores to 0-1 range, but preserve relative differences
        const maxScore = Math.max(...Object.values(scores));
        if (maxScore > 1.0) {
            Object.keys(scores).forEach(key => {
                scores[key] = Math.min(scores[key] / maxScore, 1.0);
            });
        }
        else if (maxScore > 0) {
            // If all scores are below 1.0, boost the highest one
            const highestKey = Object.entries(scores).reduce((a, b) => scores[a[0]] > scores[b[0]] ? a : b)[0];
            scores[highestKey] = Math.min(scores[highestKey] * weights.scoreNormalizationBoost, 1.0);
        }
        // Boost dominant intent if significantly higher
        const sortedScores = Object.entries(scores).sort(([, a], [, b]) => b - a);
        if (sortedScores[0][1] > sortedScores[1][1] + 0.3) {
            scores[sortedScores[0][0]] = Math.min(scores[sortedScores[0][0]] + weights.dominantIntentBoost, 1.0);
        }
        return scores;
    }
    /**
     * Count keyword matches in query words
     */
    countKeywordMatches(queryWords, keywords) {
        return queryWords.reduce((count, word) => {
            return count + (keywords.some(keyword => word.includes(keyword) || keyword.includes(word)) ? 1 : 0);
        }, 0);
    }
    /**
     * Determine subcategory based on intent type and query content
     */
    determineSubcategory(intentType, normalizedQuery) {
        switch (intentType) {
            case 'component_identification':
                if (/passive/.test(normalizedQuery))
                    return 'passive-component';
                if (/active/.test(normalizedQuery))
                    return 'active-component';
                if (/ic|chip|integrated/.test(normalizedQuery))
                    return 'integrated-circuit';
                return 'general-component';
            case 'schematic_analysis':
                if (/power|supply/.test(normalizedQuery))
                    return 'power-analysis';
                if (/signal|ac|frequency/.test(normalizedQuery))
                    return 'signal-analysis';
                if (/dc|static/.test(normalizedQuery))
                    return 'dc-analysis';
                return 'general-analysis';
            case 'general_question':
                if (/how.*work/.test(normalizedQuery))
                    return 'operation-explanation';
                if (/what.*purpose|function/.test(normalizedQuery))
                    return 'purpose-explanation';
                if (/difference|compare/.test(normalizedQuery))
                    return 'comparison';
                return 'general-inquiry';
            default:
                return 'uncategorized';
        }
    }
    /**
     * Generate reasoning explanation for classification decision
     */
    generateReasoning(intentType, normalizedQuery, confidence) {
        const reasons = [];
        switch (intentType) {
            case 'component_identification':
                if (this.countKeywordMatches(normalizedQuery.split(/\s+/), this.componentKeywords) > 0) {
                    reasons.push('Contains component-related keywords');
                }
                if (/identify|find|locate|what\s+is\s+this/.test(normalizedQuery)) {
                    reasons.push('Uses identification language patterns');
                }
                break;
            case 'schematic_analysis':
                if (this.countKeywordMatches(normalizedQuery.split(/\s+/), this.schematicKeywords) > 0) {
                    reasons.push('Contains schematic analysis keywords');
                }
                if (/analy[sz]e|trace|follow/.test(normalizedQuery)) {
                    reasons.push('Uses analysis action verbs');
                }
                break;
            case 'general_question':
                if (/^(what|how|why|where|when|which|who)\s/.test(normalizedQuery)) {
                    reasons.push('Starts with question word');
                }
                if (/\?$/.test(normalizedQuery)) {
                    reasons.push('Ends with question mark');
                }
                break;
        }
        reasons.push(`Confidence score: ${confidence.toFixed(2)}`);
        return reasons.join('; ');
    }
    /**
     * Normalize text for consistent processing
     */
    normalizeText(text) {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s\?]/g, ' ')
            .replace(/\s+/g, ' ');
    }
    /**
     * Update classification statistics
     */
    updateStats(intent, processingTime) {
        this.stats.totalClassifications++;
        if (intent.confidence >= this.config.confidenceThreshold) {
            this.stats.successfulClassifications++;
        }
        // Update average confidence
        const oldAvg = this.stats.averageConfidence;
        this.stats.averageConfidence = (oldAvg * (this.stats.totalClassifications - 1) + intent.confidence) / this.stats.totalClassifications;
        // Update intent distribution
        this.stats.intentDistribution[intent.type] = (this.stats.intentDistribution[intent.type] || 0) + 1;
        // Update average processing time
        const oldTimeAvg = this.stats.averageProcessingTime;
        this.stats.averageProcessingTime = (oldTimeAvg * (this.stats.totalClassifications - 1) + processingTime) / this.stats.totalClassifications;
    }
    /**
     * Initialize training data for future ML model improvements
     */
    initializeTrainingData() {
        return [
            // Component identification examples
            { query: "What is this resistor?", expectedIntent: 'component_identification', confidence: 0.9 },
            { query: "Identify the capacitor in the circuit", expectedIntent: 'component_identification', confidence: 0.95 },
            { query: "What type of transistor is this?", expectedIntent: 'component_identification', confidence: 0.9 },
            // Schematic analysis examples  
            { query: "Analyze the power supply circuit", expectedIntent: 'schematic_analysis', confidence: 0.9 },
            { query: "Trace the signal path through this amplifier", expectedIntent: 'schematic_analysis', confidence: 0.95 },
            { query: "How does current flow in this circuit?", expectedIntent: 'schematic_analysis', confidence: 0.8 },
            // General question examples
            { query: "How do transistors work?", expectedIntent: 'general_question', confidence: 0.9 },
            { query: "What is the purpose of a capacitor?", expectedIntent: 'general_question', confidence: 0.85 },
            { query: "Explain voltage division", expectedIntent: 'general_question', confidence: 0.9 }
        ];
    }
    /**
     * Get classification statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Health check for classifier component
     */
    async healthCheck() {
        try {
            // Test classification with a simple query
            const testResult = await this.classifyIntent("What is a resistor?");
            return testResult.intent.confidence > 0 && testResult.processingTime < 1000;
        }
        catch {
            return false;
        }
    }
    /**
     * Add training data for future model improvements
     */
    addTrainingData(data) {
        this.trainingData.push(data);
    }
    /**
     * Get training data for analysis
     */
    getTrainingData() {
        return [...this.trainingData];
    }
}
exports.QueryClassifier = QueryClassifier;
//# sourceMappingURL=QueryClassifier.js.map