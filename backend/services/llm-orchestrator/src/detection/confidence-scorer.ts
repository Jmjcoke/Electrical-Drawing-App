/**
 * Confidence Scorer
 * 
 * Multi-factor confidence scoring system for symbol detection
 * combining pattern matching, ML prediction, and context validation
 */

import { 
  DetectedSymbol,
  ImageQuality,
  SymbolDetectionError
} from '../../../../shared/types/symbol-detection.types';

export interface ConfidenceFactors {
  patternMatchScore: number;
  mlPredictionScore: number;
  contextValidationScore: number;
  imageQualityScore: number;
  geometricConsistencyScore: number;
  spatialCoherenceScore: number;
}

export interface ConfidenceWeights {
  patternMatch: number;
  mlPrediction: number;
  contextValidation: number;
  imageQuality: number;
  geometricConsistency: number;
  spatialCoherence: number;
}

export class ConfidenceScorer {
  private readonly defaultWeights: ConfidenceWeights = {
    patternMatch: 0.25,
    mlPrediction: 0.25,
    contextValidation: 0.20,
    imageQuality: 0.10,
    geometricConsistency: 0.10,
    spatialCoherence: 0.10,
  };

  /**
   * Calculate multi-factor confidence score for a detected symbol
   */
  async calculateConfidence(
    symbol: DetectedSymbol,
    imageBuffer: Buffer,
    imageQuality: ImageQuality,
    weights: Partial<ConfidenceWeights> = {}
  ): Promise<number> {
    try {
      const finalWeights = { ...this.defaultWeights, ...weights };
      
      // Calculate individual confidence factors
      const factors = await this.calculateConfidenceFactors(
        symbol,
        imageBuffer,
        imageQuality
      );

      // Calculate weighted confidence score
      const confidence = 
        (factors.patternMatchScore * finalWeights.patternMatch) +
        (factors.mlPredictionScore * finalWeights.mlPrediction) +
        (factors.contextValidationScore * finalWeights.contextValidation) +
        (factors.imageQualityScore * finalWeights.imageQuality) +
        (factors.geometricConsistencyScore * finalWeights.geometricConsistency) +
        (factors.spatialCoherenceScore * finalWeights.spatialCoherence);

      // Ensure confidence is in valid range [0, 1]
      return Math.max(0, Math.min(1, confidence));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new SymbolDetectionError(
        `Confidence calculation failed: ${errorMessage}`,
        'CONFIDENCE_CALCULATION_ERROR',
        { symbolId: symbol.id, symbolType: symbol.symbolType }
      );
    }
  }

  /**
   * Calculate individual confidence factors
   */
  private async calculateConfidenceFactors(
    symbol: DetectedSymbol,
    imageBuffer: Buffer,
    imageQuality: ImageQuality
  ): Promise<ConfidenceFactors> {
    const factors: ConfidenceFactors = {
      patternMatchScore: this.calculatePatternMatchScore(symbol),
      mlPredictionScore: this.calculateMLPredictionScore(symbol),
      contextValidationScore: await this.calculateContextValidationScore(symbol, imageBuffer),
      imageQualityScore: this.calculateImageQualityScore(imageQuality),
      geometricConsistencyScore: this.calculateGeometricConsistencyScore(symbol),
      spatialCoherenceScore: this.calculateSpatialCoherenceScore(symbol),
    };

    return factors;
  }

  /**
   * Calculate pattern matching confidence score
   */
  private calculatePatternMatchScore(symbol: DetectedSymbol): number {
    // Base score from detection method
    let score = symbol.confidence;

    // Adjust based on detection method
    switch (symbol.detectionMethod) {
      case 'pattern_matching':
        // Pattern matching typically provides reliable results
        score = Math.min(score * 1.1, 1.0);
        break;
      case 'ml_classification':
        // ML predictions need more validation
        score = score * 0.9;
        break;
      case 'consensus':
        // Consensus methods are more reliable
        score = Math.min(score * 1.2, 1.0);
        break;
      case 'llm_analysis':
        // LLM analysis needs careful weighting
        score = score * 0.8;
        break;
    }

    // Adjust based on symbol features
    if (symbol.features) {
      const aspectRatio = symbol.features.geometricProperties.aspectRatio;
      
      // Penalize extreme aspect ratios (likely false positives)
      if (aspectRatio > 10 || aspectRatio < 0.1) {
        score *= 0.7;
      }

      // Boost score for closed shapes (typically more reliable)
      if (symbol.features.shapeAnalysis.isClosed) {
        score = Math.min(score * 1.1, 1.0);
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate ML prediction confidence score
   */
  private calculateMLPredictionScore(symbol: DetectedSymbol): number {
    let score = symbol.confidence;

    // Boost confidence for well-known symbol types
    const commonSymbols = ['resistor', 'capacitor', 'inductor', 'diode'];
    if (commonSymbols.includes(symbol.symbolType)) {
      score = Math.min(score * 1.1, 1.0);
    }

    // Reduce confidence for rare/complex symbols
    const complexSymbols = ['integrated_circuit', 'operational_amplifier'];
    if (complexSymbols.includes(symbol.symbolType)) {
      score = score * 0.9;
    }

    // Adjust based on symbol category
    switch (symbol.symbolCategory) {
      case 'passive':
        // Passive components are generally easier to detect
        score = Math.min(score * 1.05, 1.0);
        break;
      case 'active':
        // Active components can be more varied
        score = score * 0.95;
        break;
      case 'connector':
        // Connectors can be ambiguous
        score = score * 0.9;
        break;
      case 'custom':
        // Custom symbols have higher uncertainty
        score = score * 0.8;
        break;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate context validation score
   */
  private async calculateContextValidationScore(
    symbol: DetectedSymbol,
    imageBuffer: Buffer
  ): Promise<number> {
    let score = 0.5; // Neutral starting score

    try {
      // Analyze local context around the symbol
      const contextScore = await this.analyzeLocalContext(symbol, imageBuffer);
      score = (score + contextScore) / 2;

      // Check for typical electrical symbol characteristics
      if (symbol.features) {
        const characteristics = this.checkElectricalCharacteristics(symbol);
        score = (score + characteristics) / 2;
      }

      // Validate symbol size is reasonable
      const sizeScore = this.validateSymbolSize(symbol);
      score = (score + sizeScore) / 2;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('Context validation failed:', errorMessage);
      score = 0.3; // Lower confidence if context analysis fails
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate image quality impact on confidence
   */
  private calculateImageQualityScore(imageQuality: ImageQuality): number {
    let score = 0;

    // Resolution impact
    score += imageQuality.resolution * 0.3;

    // Clarity impact
    score += imageQuality.clarity * 0.3;

    // Contrast impact
    score += imageQuality.contrast * 0.2;

    // Noise impact (inverted - less noise is better)
    score += (1 - imageQuality.noiseLevel) * 0.2;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate geometric consistency score
   */
  private calculateGeometricConsistencyScore(symbol: DetectedSymbol): number {
    if (!symbol.features) {
      return 0.5; // Neutral score if no features available
    }

    let score = 0.5;
    const geom = symbol.features.geometricProperties;

    // Check aspect ratio reasonableness for symbol type
    const expectedAspectRatio = this.getExpectedAspectRatio(symbol.symbolType);
    const aspectRatioDiff = Math.abs(geom.aspectRatio - expectedAspectRatio) / expectedAspectRatio;
    const aspectRatioScore = Math.max(0, 1 - aspectRatioDiff);
    score = (score + aspectRatioScore) / 2;

    // Check area reasonableness
    const areaScore = this.validateSymbolArea(symbol);
    score = (score + areaScore) / 2;

    // Check perimeter to area ratio
    const compactness = (4 * Math.PI * geom.area) / Math.pow(geom.area / geom.aspectRatio, 2);
    const compactnessScore = Math.min(compactness, 1);
    score = (score + compactnessScore) / 2;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate spatial coherence score
   */
  private calculateSpatialCoherenceScore(symbol: DetectedSymbol): number {
    let score = 0.7; // Default good score

    // Check if bounding box is reasonable
    const bbox = symbol.boundingBox;
    if (bbox.width <= 0 || bbox.height <= 0) {
      return 0;
    }

    // Penalize extremely small or large symbols
    const area = bbox.area;
    if (area < 100 || area > 50000) {
      score *= 0.8;
    }

    // Check location reasonableness (not at image edges)
    const location = symbol.location;
    if (location.x < 0.05 || location.x > 0.95 || location.y < 0.05 || location.y > 0.95) {
      score *= 0.9; // Slight penalty for edge symbols
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Analyze local context around symbol
   */
  private async analyzeLocalContext(
    _symbol: DetectedSymbol,
    _imageBuffer: Buffer
  ): Promise<number> {
    try {
      // This would analyze the immediate vicinity of the symbol
      // for electrical circuit context like wires, connections, etc.
      
      // For now, return a reasonable default
      return 0.6;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('Local context analysis failed:', errorMessage);
      return 0.4;
    }
  }

  /**
   * Check electrical symbol characteristics
   */
  private checkElectricalCharacteristics(symbol: DetectedSymbol): number {
    let score = 0.5;

    if (!symbol.features) return score;

    const shape = symbol.features.shapeAnalysis;

    // Most electrical symbols have consistent stroke width
    if (shape.strokeWidth > 0 && shape.strokeWidth < 10) {
      score += 0.2;
    }

    // Check complexity appropriateness for symbol type
    const expectedComplexity = this.getExpectedComplexity(symbol.symbolType);
    const complexityDiff = Math.abs(shape.complexity - expectedComplexity);
    if (complexityDiff < 0.3) {
      score += 0.2;
    }

    // Connection points are good indicators
    if (symbol.features.connectionPoints.length > 0) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Validate symbol size reasonableness
   */
  private validateSymbolSize(symbol: DetectedSymbol): number {
    const bbox = symbol.boundingBox;
    const area = bbox.area;

    // Expected size ranges for different symbol types
    const sizeRanges: Partial<Record<string, { min: number; max: number }>> = {
      'resistor': { min: 800, max: 8000 },
      'capacitor': { min: 600, max: 6000 },
      'inductor': { min: 1000, max: 10000 },
      'diode': { min: 400, max: 4000 },
      'transistor': { min: 800, max: 8000 },
      'integrated_circuit': { min: 2000, max: 20000 },
    };

    const range = sizeRanges[symbol.symbolType] || { min: 400, max: 20000 };

    if (area >= range.min && area <= range.max) {
      return 1.0;
    } else if (area < range.min) {
      return Math.max(0.3, area / range.min);
    } else {
      return Math.max(0.3, range.max / area);
    }
  }

  /**
   * Validate symbol area
   */
  private validateSymbolArea(symbol: DetectedSymbol): number {
    if (!symbol.features) return 0.5;

    const calculatedArea = symbol.features.geometricProperties.area;
    const boundingBoxArea = symbol.boundingBox.area;

    // Area should be reasonably close to bounding box area
    const areaRatio = calculatedArea / boundingBoxArea;
    
    if (areaRatio >= 0.3 && areaRatio <= 1.0) {
      return 1.0;
    } else if (areaRatio < 0.3) {
      return areaRatio / 0.3;
    } else {
      return 1.0 / areaRatio;
    }
  }

  /**
   * Get expected aspect ratio for symbol type
   */
  private getExpectedAspectRatio(symbolType: string): number {
    const aspectRatios: Record<string, number> = {
      'resistor': 3.0,
      'capacitor': 1.5,
      'inductor': 2.5,
      'diode': 2.0,
      'transistor': 1.5,
      'integrated_circuit': 1.2,
      'connector': 1.0,
      'switch': 2.0,
      'relay': 1.8,
      'transformer': 2.0,
      'ground': 1.0,
      'power_supply': 1.5,
      'battery': 2.0,
      'fuse': 3.0,
      'led': 1.5,
      'operational_amplifier': 1.3,
      'logic_gate': 1.5,
    };

    return aspectRatios[symbolType] || 1.5;
  }

  /**
   * Get expected complexity for symbol type
   */
  private getExpectedComplexity(symbolType: string): number {
    const complexities: Record<string, number> = {
      'resistor': 0.3,
      'capacitor': 0.2,
      'inductor': 0.6,
      'diode': 0.4,
      'transistor': 0.7,
      'integrated_circuit': 0.9,
      'connector': 0.3,
      'switch': 0.5,
      'relay': 0.8,
      'transformer': 0.8,
      'ground': 0.2,
      'power_supply': 0.4,
      'battery': 0.3,
      'fuse': 0.2,
      'led': 0.4,
      'operational_amplifier': 0.8,
      'logic_gate': 0.6,
    };

    return complexities[symbolType] || 0.5;
  }

  /**
   * Get confidence score interpretation
   */
  getConfidenceInterpretation(confidence: number): string {
    if (confidence >= 0.9) return 'Very High';
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.7) return 'Good';
    if (confidence >= 0.6) return 'Moderate';
    if (confidence >= 0.5) return 'Low';
    return 'Very Low';
  }

  /**
   * Calculate ensemble confidence from multiple detections
   */
  calculateEnsembleConfidence(symbols: DetectedSymbol[]): number {
    if (symbols.length === 0) return 0;
    if (symbols.length === 1) return symbols[0].confidence;

    // Weight by detection method reliability
    const methodWeights = {
      'pattern_matching': 1.0,
      'ml_classification': 1.0,
      'consensus': 1.2,
      'llm_analysis': 0.8,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const symbol of symbols) {
      const weight = methodWeights[symbol.detectionMethod] || 1.0;
      weightedSum += symbol.confidence * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }
}