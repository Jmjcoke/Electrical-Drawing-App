/**
 * Comprehensive Unit Tests for ML Classifier
 * Validates machine learning classification for electrical symbols
 * Coverage Target: 80%+ for AC #3 (ML-based classification)
 */

import { MLClassifier } from '../ml-classifier';
import * as tf from '@tensorflow/tfjs-node';
import { 
  DetectedSymbol,
  ElectricalSymbolType,
  ImageRegion
} from '../../../../../shared/types/symbol-detection.types';

// Mock TensorFlow.js
jest.mock('@tensorflow/tfjs-node');

describe('MLClassifier - Machine Learning Classification Tests', () => {
  let mlClassifier: MLClassifier;
  let mockModel: any;
  let mockTensor: any;
  let mockPrediction: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup TensorFlow mocks
    mockTensor = {
      shape: [1, 224, 224, 3],
      dtype: 'float32',
      dispose: jest.fn(),
      expandDims: jest.fn().mockReturnThis(),
      div: jest.fn().mockReturnThis(),
      sub: jest.fn().mockReturnThis(),
      mul: jest.fn().mockReturnThis(),
      reshape: jest.fn().mockReturnThis(),
      as2D: jest.fn().mockReturnThis(),
      as4D: jest.fn().mockReturnThis(),
      arraySync: jest.fn().mockReturnValue([[0.1, 0.85, 0.05]])
    };

    mockPrediction = {
      data: jest.fn().mockResolvedValue([0.1, 0.85, 0.05]),
      array: jest.fn().mockResolvedValue([[0.1, 0.85, 0.05]]),
      dispose: jest.fn()
    };

    mockModel = {
      predict: jest.fn().mockReturnValue(mockPrediction),
      predictOnBatch: jest.fn().mockReturnValue([mockPrediction]),
      summary: jest.fn(),
      save: jest.fn().mockResolvedValue({ modelArtifactsInfo: {} }),
      dispose: jest.fn()
    };

    // Mock TensorFlow functions
    (tf.loadLayersModel as jest.Mock) = jest.fn().mockResolvedValue(mockModel);
    (tf.loadGraphModel as jest.Mock) = jest.fn().mockResolvedValue(mockModel);
    (tf.tensor as jest.Mock) = jest.fn().mockReturnValue(mockTensor);
    (tf.tensor4d as jest.Mock) = jest.fn().mockReturnValue(mockTensor);
    (tf.browser as any) = {
      fromPixels: jest.fn().mockReturnValue(mockTensor)
    };
    (tf.image as any) = {
      resizeBilinear: jest.fn().mockReturnValue(mockTensor),
      resizeNearestNeighbor: jest.fn().mockReturnValue(mockTensor)
    };
    (tf.tidy as any) = jest.fn((fn: Function) => fn());
    (tf.memory as jest.Mock) = jest.fn().mockReturnValue({
      numTensors: 10,
      numBytes: 1000000,
      numDataBuffers: 5
    });
    (tf.disposeVariables as jest.Mock) = jest.fn();

    // Initialize classifier
    mlClassifier = new MLClassifier();
  });

  afterEach(async () => {
    await mlClassifier.cleanup();
  });

  describe('1. Model Initialization and Loading', () => {
    it('should initialize classifier successfully', async () => {
      await mlClassifier.initialize();

      expect(tf.loadLayersModel).toHaveBeenCalled();
      expect(mlClassifier.isInitialized()).toBe(true);
    });

    it('should load model from local path', async () => {
      await mlClassifier.initialize('/models/electrical-symbols/model.json');

      expect(tf.loadLayersModel).toHaveBeenCalledWith(
        expect.stringContaining('electrical-symbols')
      );
    });

    it('should load model from URL', async () => {
      await mlClassifier.initialize('https://example.com/model.json');

      expect(tf.loadLayersModel).toHaveBeenCalledWith('https://example.com/model.json');
    });

    it('should handle model loading errors', async () => {
      (tf.loadLayersModel as jest.Mock).mockRejectedValueOnce(new Error('Model not found'));

      await expect(
        mlClassifier.initialize('/invalid/model.json')
      ).rejects.toThrow('Failed to load ML model');
    });

    it('should cache loaded model', async () => {
      await mlClassifier.initialize();
      await mlClassifier.initialize(); // Second call

      expect(tf.loadLayersModel).toHaveBeenCalledTimes(1); // Only loaded once
    });

    it('should support multiple model formats', async () => {
      // Keras model
      await mlClassifier.initialize('/model.h5');
      expect(tf.loadLayersModel).toHaveBeenCalled();

      // TensorFlow.js model
      jest.clearAllMocks();
      await mlClassifier.initialize('/model.json');
      expect(tf.loadLayersModel).toHaveBeenCalled();

      // Graph model
      jest.clearAllMocks();
      await mlClassifier.initializeGraphModel('/model.pb');
      expect(tf.loadGraphModel).toHaveBeenCalled();
    });
  });

  describe('2. Image Preprocessing for ML', () => {
    const mockRegion: ImageRegion = {
      id: 'region-1',
      boundingBox: { x: 0, y: 0, width: 100, height: 100, area: 10000 },
      confidence: 0.9,
      imageData: Buffer.from('mock-image-data')
    };

    it('should preprocess image region for classification', async () => {
      const tensor = await mlClassifier.preprocessRegion(mockRegion);

      expect(tensor).toBeDefined();
      expect(tf.tensor).toHaveBeenCalled();
      expect(tf.image.resizeBilinear).toHaveBeenCalled();
    });

    it('should resize images to model input size', async () => {
      await mlClassifier.preprocessRegion(mockRegion);

      expect(tf.image.resizeBilinear).toHaveBeenCalledWith(
        expect.anything(),
        [224, 224] // Standard model input size
      );
    });

    it('should normalize pixel values', async () => {
      await mlClassifier.preprocessRegion(mockRegion);

      expect(mockTensor.div).toHaveBeenCalledWith(255); // Normalize to [0, 1]
    });

    it('should handle grayscale conversion', async () => {
      const grayscaleRegion = {
        ...mockRegion,
        channels: 1
      };

      await mlClassifier.preprocessRegion(grayscaleRegion as any);

      // Should convert grayscale to RGB
      expect(tf.tensor).toHaveBeenCalled();
    });

    it('should apply data augmentation for training', async () => {
      const augmentedTensor = await mlClassifier.preprocessRegion(mockRegion, {
        augment: true
      });

      expect(augmentedTensor).toBeDefined();
      // Augmentation operations (rotation, flip, etc.) should be applied
    });

    it('should batch process multiple regions', async () => {
      const regions = Array.from({ length: 5 }, (_, i) => ({
        ...mockRegion,
        id: `region-${i}`
      }));

      const batch = await mlClassifier.preprocessBatch(regions);

      expect(batch).toBeDefined();
      expect(tf.tensor4d).toHaveBeenCalled();
    });
  });

  describe('3. Symbol Classification (AC #3)', () => {
    it('should classify electrical symbols', async () => {
      await mlClassifier.initialize();

      const regions: ImageRegion[] = [{
        id: 'region-1',
        boundingBox: { x: 0, y: 0, width: 50, height: 50, area: 2500 },
        confidence: 0.9,
        imageData: Buffer.from('resistor-image')
      }];

      const symbols = await mlClassifier.classifyRegions(regions, '/test.png');

      expect(symbols).toBeDefined();
      expect(symbols).toHaveLength(1);
      expect(symbols[0].symbolType).toBeDefined();
      expect(symbols[0].confidence).toBeGreaterThan(0);
    });

    it('should identify resistor symbol', async () => {
      mockPrediction.array.mockResolvedValueOnce([[0.95, 0.02, 0.01, 0.01, 0.01]]);
      await mlClassifier.initialize();

      const symbols = await mlClassifier.classifyRegions([{
        id: 'r1',
        boundingBox: { x: 0, y: 0, width: 50, height: 50, area: 2500 },
        confidence: 0.9,
        imageData: Buffer.from('resistor')
      }], '/test.png');

      expect(symbols[0].symbolType).toBe('resistor');
      expect(symbols[0].confidence).toBeGreaterThan(0.9);
    });

    it('should identify capacitor symbol', async () => {
      mockPrediction.array.mockResolvedValueOnce([[0.02, 0.93, 0.02, 0.02, 0.01]]);
      await mlClassifier.initialize();

      const symbols = await mlClassifier.classifyRegions([{
        id: 'c1',
        boundingBox: { x: 0, y: 0, width: 50, height: 50, area: 2500 },
        confidence: 0.9,
        imageData: Buffer.from('capacitor')
      }], '/test.png');

      expect(symbols[0].symbolType).toBe('capacitor');
      expect(symbols[0].confidence).toBeGreaterThan(0.9);
    });

    it('should identify complex symbols (operational amplifier)', async () => {
      // Mock prediction for op-amp
      mockPrediction.array.mockResolvedValueOnce([
        Array(15).fill(0.01).concat([0.88]) // High confidence for op-amp class
      ]);
      await mlClassifier.initialize();

      const symbols = await mlClassifier.classifyRegions([{
        id: 'op1',
        boundingBox: { x: 0, y: 0, width: 80, height: 60, area: 4800 },
        confidence: 0.85,
        imageData: Buffer.from('op-amp')
      }], '/test.png');

      expect(symbols[0].symbolType).toBe('operational_amplifier');
      expect(symbols[0].symbolCategory).toBe('active');
    });

    it('should handle multiple classifications', async () => {
      await mlClassifier.initialize();

      const regions = Array.from({ length: 10 }, (_, i) => ({
        id: `region-${i}`,
        boundingBox: { x: i * 10, y: i * 10, width: 50, height: 50, area: 2500 },
        confidence: 0.8 + i * 0.01,
        imageData: Buffer.from(`image-${i}`)
      }));

      const symbols = await mlClassifier.classifyRegions(regions, '/test.png');

      expect(symbols).toHaveLength(10);
      symbols.forEach(symbol => {
        expect(symbol.symbolType).toBeDefined();
        expect(symbol.confidence).toBeGreaterThan(0);
      });
    });

    it('should filter low confidence predictions', async () => {
      mockPrediction.array.mockResolvedValueOnce([[0.3, 0.3, 0.2, 0.1, 0.1]]);
      await mlClassifier.initialize();

      const symbols = await mlClassifier.classifyRegions([{
        id: 'low-conf',
        boundingBox: { x: 0, y: 0, width: 50, height: 50, area: 2500 },
        confidence: 0.5,
        imageData: Buffer.from('unclear')
      }], '/test.png', { confidenceThreshold: 0.5 });

      // Should either not return or mark as unknown
      expect(symbols.length === 0 || symbols[0].symbolType === 'unknown').toBe(true);
    });
  });

  describe('4. Confidence Score Calculation', () => {
    it('should calculate accurate confidence scores', async () => {
      await mlClassifier.initialize();

      const symbols = await mlClassifier.classifyRegions([{
        id: 'test',
        boundingBox: { x: 0, y: 0, width: 50, height: 50, area: 2500 },
        confidence: 0.9,
        imageData: Buffer.from('test')
      }], '/test.png');

      const confidence = symbols[0].confidence;
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });

    it('should apply softmax to raw predictions', async () => {
      const rawScores = [2.0, 1.0, 0.5];
      const softmaxScores = mlClassifier.applySoftmax(rawScores);

      expect(softmaxScores).toHaveLength(3);
      expect(Math.abs(softmaxScores.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(0.001);
    });

    it('should handle temperature scaling for confidence', async () => {
      const scores = [0.8, 0.1, 0.1];
      
      const scaled1 = mlClassifier.temperatureScale(scores, 0.5); // More confident
      const scaled2 = mlClassifier.temperatureScale(scores, 2.0); // Less confident

      expect(scaled1[0]).toBeGreaterThan(scores[0]);
      expect(scaled2[0]).toBeLessThan(scores[0]);
    });
  });

  describe('5. Batch Processing and Optimization', () => {
    it('should process regions in batches for efficiency', async () => {
      await mlClassifier.initialize();

      const regions = Array.from({ length: 32 }, (_, i) => ({
        id: `region-${i}`,
        boundingBox: { x: 0, y: 0, width: 50, height: 50, area: 2500 },
        confidence: 0.9,
        imageData: Buffer.from(`image-${i}`)
      }));

      const symbols = await mlClassifier.classifyRegions(regions, '/test.png');

      expect(symbols).toHaveLength(32);
      expect(mockModel.predictOnBatch).toHaveBeenCalled();
    });

    it('should optimize batch size based on memory', async () => {
      await mlClassifier.initialize();

      // Simulate limited memory
      (tf.memory as jest.Mock).mockReturnValueOnce({
        numTensors: 100,
        numBytes: 500000000, // 500MB used
        numDataBuffers: 50
      });

      const regions = Array.from({ length: 100 }, (_, i) => ({
        id: `region-${i}`,
        boundingBox: { x: 0, y: 0, width: 50, height: 50, area: 2500 },
        confidence: 0.9,
        imageData: Buffer.from(`image-${i}`)
      }));

      await mlClassifier.classifyRegions(regions, '/test.png');

      // Should process in smaller batches when memory is limited
      expect(mockModel.predict).toHaveBeenCalledTimes(Math.ceil(100 / 16));
    });

    it('should dispose tensors to prevent memory leaks', async () => {
      await mlClassifier.initialize();

      await mlClassifier.classifyRegions([{
        id: 'test',
        boundingBox: { x: 0, y: 0, width: 50, height: 50, area: 2500 },
        confidence: 0.9,
        imageData: Buffer.from('test')
      }], '/test.png');

      expect(mockTensor.dispose).toHaveBeenCalled();
      expect(mockPrediction.dispose).toHaveBeenCalled();
    });

    it('should use tf.tidy for automatic memory management', async () => {
      await mlClassifier.initialize();

      await mlClassifier.classifyRegions([{
        id: 'test',
        boundingBox: { x: 0, y: 0, width: 50, height: 50, area: 2500 },
        confidence: 0.9,
        imageData: Buffer.from('test')
      }], '/test.png');

      expect(tf.tidy).toHaveBeenCalled();
    });
  });

  describe('6. Model Performance and Accuracy', () => {
    it('should achieve high accuracy on standard symbols', async () => {
      const testSymbols = ['resistor', 'capacitor', 'inductor', 'diode', 'transistor'];
      const predictions = [
        [0.92, 0.02, 0.02, 0.02, 0.02], // Resistor
        [0.02, 0.91, 0.02, 0.03, 0.02], // Capacitor
        [0.02, 0.02, 0.93, 0.02, 0.01], // Inductor
        [0.01, 0.02, 0.02, 0.94, 0.01], // Diode
        [0.02, 0.01, 0.01, 0.01, 0.95]  // Transistor
      ];

      await mlClassifier.initialize();
      let correctPredictions = 0;

      for (let i = 0; i < testSymbols.length; i++) {
        mockPrediction.array.mockResolvedValueOnce([predictions[i]]);
        
        const symbols = await mlClassifier.classifyRegions([{
          id: `test-${i}`,
          boundingBox: { x: 0, y: 0, width: 50, height: 50, area: 2500 },
          confidence: 0.9,
          imageData: Buffer.from(testSymbols[i])
        }], '/test.png');

        if (symbols[0].symbolType === testSymbols[i]) {
          correctPredictions++;
        }
      }

      const accuracy = correctPredictions / testSymbols.length;
      expect(accuracy).toBeGreaterThanOrEqual(0.9); // 90% accuracy requirement
    });

    it('should handle class imbalance', async () => {
      await mlClassifier.initialize();

      // Simulate imbalanced predictions
      const imbalancedPredictions = Array(20).fill(0.01);
      imbalancedPredictions[0] = 0.81; // High confidence for rare class

      mockPrediction.array.mockResolvedValueOnce([imbalancedPredictions]);

      const symbols = await mlClassifier.classifyRegions([{
        id: 'rare',
        boundingBox: { x: 0, y: 0, width: 50, height: 50, area: 2500 },
        confidence: 0.9,
        imageData: Buffer.from('rare-symbol')
      }], '/test.png');

      expect(symbols[0].confidence).toBeGreaterThan(0.8);
    });
  });

  describe('7. Feature Extraction and Embedding', () => {
    it('should extract feature embeddings', async () => {
      await mlClassifier.initialize();

      const embedding = await mlClassifier.extractEmbedding({
        id: 'test',
        boundingBox: { x: 0, y: 0, width: 50, height: 50, area: 2500 },
        confidence: 0.9,
        imageData: Buffer.from('test')
      });

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should generate consistent embeddings', async () => {
      await mlClassifier.initialize();

      const region = {
        id: 'test',
        boundingBox: { x: 0, y: 0, width: 50, height: 50, area: 2500 },
        confidence: 0.9,
        imageData: Buffer.from('test')
      };

      const embedding1 = await mlClassifier.extractEmbedding(region);
      const embedding2 = await mlClassifier.extractEmbedding(region);

      expect(embedding1).toEqual(embedding2);
    });
  });

  describe('8. Error Handling and Robustness', () => {
    it('should handle invalid image data', async () => {
      await mlClassifier.initialize();

      const invalidRegion = {
        id: 'invalid',
        boundingBox: { x: 0, y: 0, width: 50, height: 50, area: 2500 },
        confidence: 0.9,
        imageData: null as any
      };

      await expect(
        mlClassifier.classifyRegions([invalidRegion], '/test.png')
      ).rejects.toThrow('Invalid image data');
    });

    it('should handle model prediction errors', async () => {
      await mlClassifier.initialize();
      mockModel.predict.mockImplementationOnce(() => {
        throw new Error('Prediction failed');
      });

      await expect(
        mlClassifier.classifyRegions([{
          id: 'test',
          boundingBox: { x: 0, y: 0, width: 50, height: 50, area: 2500 },
          confidence: 0.9,
          imageData: Buffer.from('test')
        }], '/test.png')
      ).rejects.toThrow('Classification failed');
    });

    it('should handle empty regions gracefully', async () => {
      await mlClassifier.initialize();

      const symbols = await mlClassifier.classifyRegions([], '/test.png');

      expect(symbols).toEqual([]);
    });

    it('should validate input dimensions', async () => {
      await mlClassifier.initialize();

      const oversizedRegion = {
        id: 'oversized',
        boundingBox: { x: 0, y: 0, width: 10000, height: 10000, area: 100000000 },
        confidence: 0.9,
        imageData: Buffer.alloc(100000000)
      };

      // Should resize or reject gracefully
      const result = await mlClassifier.classifyRegions([oversizedRegion], '/test.png');
      expect(result).toBeDefined();
    });
  });

  describe('9. Model Updates and Versioning', () => {
    it('should support model version checking', async () => {
      const version = await mlClassifier.getModelVersion();
      
      expect(version).toBeDefined();
      expect(version).toMatch(/\d+\.\d+\.\d+/); // Semantic versioning
    });

    it('should support model hot-swapping', async () => {
      await mlClassifier.initialize('/models/v1/model.json');
      
      // Load new version
      await mlClassifier.updateModel('/models/v2/model.json');
      
      expect(tf.loadLayersModel).toHaveBeenCalledTimes(2);
      expect(mockModel.dispose).toHaveBeenCalled(); // Old model disposed
    });

    it('should rollback on failed model update', async () => {
      await mlClassifier.initialize('/models/v1/model.json');
      
      (tf.loadLayersModel as jest.Mock).mockRejectedValueOnce(new Error('Load failed'));
      
      await expect(
        mlClassifier.updateModel('/models/invalid/model.json')
      ).rejects.toThrow();
      
      // Should still have original model
      expect(mlClassifier.isInitialized()).toBe(true);
    });
  });

  describe('10. Performance Monitoring', () => {
    it('should track inference time', async () => {
      await mlClassifier.initialize();

      const startTime = Date.now();
      await mlClassifier.classifyRegions([{
        id: 'test',
        boundingBox: { x: 0, y: 0, width: 50, height: 50, area: 2500 },
        confidence: 0.9,
        imageData: Buffer.from('test')
      }], '/test.png');
      const inferenceTime = Date.now() - startTime;

      expect(inferenceTime).toBeLessThan(1000); // Should be fast
    });

    it('should monitor memory usage', async () => {
      await mlClassifier.initialize();

      const memBefore = (tf.memory() as any).numBytes;
      
      await mlClassifier.classifyRegions([{
        id: 'test',
        boundingBox: { x: 0, y: 0, width: 50, height: 50, area: 2500 },
        confidence: 0.9,
        imageData: Buffer.from('test')
      }], '/test.png');
      
      const memAfter = (tf.memory() as any).numBytes;
      
      // Memory should not grow significantly
      expect(memAfter - memBefore).toBeLessThan(10000000); // 10MB max growth
    });

    it('should provide performance metrics', async () => {
      await mlClassifier.initialize();

      const metrics = await mlClassifier.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.averageInferenceTime).toBeDefined();
      expect(metrics.totalPredictions).toBeDefined();
      expect(metrics.memoryUsage).toBeDefined();
    });
  });

  describe('11. Cleanup and Resource Management', () => {
    it('should cleanup resources properly', async () => {
      await mlClassifier.initialize();
      await mlClassifier.cleanup();

      expect(mockModel.dispose).toHaveBeenCalled();
      expect(tf.disposeVariables).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      await mlClassifier.initialize();
      mockModel.dispose.mockImplementationOnce(() => {
        throw new Error('Dispose failed');
      });

      // Should not throw
      await expect(mlClassifier.cleanup()).resolves.not.toThrow();
    });
  });
});