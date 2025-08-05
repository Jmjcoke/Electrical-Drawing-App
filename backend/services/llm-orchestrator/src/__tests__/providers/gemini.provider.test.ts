/**
 * Unit tests for Gemini Provider
 * 
 * Tests cover all core functionality including:
 * - Provider initialization and configuration
 * - Image analysis with various input scenarios
 * - Error handling and edge cases
 * - Health checks and monitoring
 * - Rate limiting and cost calculations
 */

import { GeminiProvider, GeminiConfig } from '../../providers/gemini.provider';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AnalysisError,
  ConfigurationError,
  RateLimitError,
  ProviderError
} from '../../providers/base/LLMProvider.interface';

// Mock the Google Generative AI SDK
jest.mock('@google/generative-ai');
const MockGoogleGenerativeAI = GoogleGenerativeAI as jest.MockedClass<typeof GoogleGenerativeAI>;

describe('GeminiProvider', () => {
  let provider: GeminiProvider;
  let mockClient: jest.Mocked<GoogleGenerativeAI>;
  let mockModel: any;
  let config: GeminiConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup base configuration
    config = {
      apiKey: 'test-api-key',
      model: 'gemini-pro-vision',
      maxTokens: 2048,
      temperature: 0.1,
      timeout: 30000,
      maxRetries: 3
    };

    // Setup mock model
    mockModel = {
      generateContent: jest.fn(),
    };

    // Setup mock client
    mockClient = {
      getGenerativeModel: jest.fn().mockReturnValue(mockModel),
    } as any;

    // Mock GoogleGenerativeAI constructor
    MockGoogleGenerativeAI.mockImplementation(() => mockClient);

    // Create provider instance
    provider = new GeminiProvider(config);
  });

  describe('Provider Initialization', () => {
    it('should initialize with valid configuration', () => {
      expect(provider.name).toBe('gemini-pro-vision');
      expect(provider.version).toBe('1.0');
      expect(provider.metadata.capabilities.supportsVision).toBe(true);
      expect(provider.metadata.capabilities.maxImageSize).toBe(20 * 1024 * 1024);
    });

    it('should throw ConfigurationError for invalid model', () => {
      const invalidConfig = { ...config, model: 'invalid-model' as any };
      expect(() => new GeminiProvider(invalidConfig)).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for invalid maxTokens', () => {
      const invalidConfig = { ...config, maxTokens: -1 };
      expect(() => new GeminiProvider(invalidConfig)).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for invalid temperature', () => {
      const invalidConfig = { ...config, temperature: 2.0 };
      expect(() => new GeminiProvider(invalidConfig)).toThrow(ConfigurationError);
    });

    it('should validate required configuration keys', () => {
      const requiredConfig = provider.getRequiredConfig();
      expect(requiredConfig).toContain('apiKey');
      expect(requiredConfig).toContain('model');
      expect(requiredConfig).toContain('maxTokens');
      expect(requiredConfig).toContain('temperature');
    });
  });

  describe('Image Analysis', () => {
    const testImage = Buffer.from('test-image-data');
    const testPrompt = 'Analyze this electrical schematic';

    beforeEach(() => {
      // Setup successful response mock
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'This electrical schematic shows a simple circuit with resistors and capacitors.',
          candidates: [{
            finishReason: 'STOP',
            safetyRatings: []
          }],
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 50,
            totalTokenCount: 150
          },
          promptFeedback: null
        }
      });
    });

    it('should successfully analyze an image', async () => {
      const result = await provider.analyze(testImage, testPrompt);

      expect(result).toMatchObject({
        content: expect.stringContaining('electrical schematic'),
        confidence: expect.any(Number),
        tokensUsed: expect.any(Number),
        responseTime: expect.any(Number),
        model: 'gemini-pro-vision',
        timestamp: expect.any(Date)
      });

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should include metadata in response', async () => {
      const result = await provider.analyze(testImage, testPrompt);

      expect(result.metadata).toMatchObject({
        finishReason: 'STOP',
        safetyRatings: expect.any(Array),
        usageMetadata: expect.any(Object),
        promptFeedback: null
      });
    });

    it('should handle custom analysis options', async () => {
      const options = {
        maxTokens: 1024,
        temperature: 0.2,
        timeout: 15000
      };

      await provider.analyze(testImage, testPrompt, options);

      expect(mockModel.generateContent).toHaveBeenCalledWith({
        contents: expect.any(Array),
        generationConfig: expect.objectContaining({
          temperature: 0.2,
          maxOutputTokens: 1024
        }),
        safetySettings: expect.any(Array)
      });
    });

    it('should detect image media type correctly', async () => {
      // PNG signature
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...Array(100).fill(0)]);
      await provider.analyze(pngBuffer, testPrompt);

      const call = mockModel.generateContent.mock.calls[0][0];
      const imageData = call.contents[0].parts[1];
      expect(imageData.inlineData.mimeType).toBe('image/png');
    });

    it('should validate image size limits', async () => {
      const largeImage = Buffer.alloc(25 * 1024 * 1024); // 25MB - exceeds 20MB limit
      
      await expect(provider.analyze(largeImage, testPrompt))
        .rejects.toThrow(AnalysisError);
    });

    it('should validate prompt length limits', async () => {
      const longPrompt = 'A'.repeat(1000001); // Exceeds 1M character limit
      
      await expect(provider.analyze(testImage, longPrompt))
        .rejects.toThrow(AnalysisError);
    });

    it('should throw AnalysisError for empty image', async () => {
      const emptyImage = Buffer.alloc(0);
      
      await expect(provider.analyze(emptyImage, testPrompt))
        .rejects.toThrow(AnalysisError);
    });

    it('should throw AnalysisError for empty prompt', async () => {
      await expect(provider.analyze(testImage, ''))
        .rejects.toThrow(AnalysisError);
    });
  });

  describe('Error Handling', () => {
    const testImage = Buffer.from('test-image-data');
    const testPrompt = 'Test prompt';

    it('should handle content blocked by safety filters', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => null,
          candidates: null,
          promptFeedback: {
            blockReason: 'SAFETY'
          }
        }
      });

      await expect(provider.analyze(testImage, testPrompt))
        .rejects.toThrow(AnalysisError);
    });

    it('should handle API authentication errors', async () => {
      mockModel.generateContent.mockRejectedValue({
        message: 'API key not valid'
      });

      await expect(provider.analyze(testImage, testPrompt))
        .rejects.toThrow(ConfigurationError);
    });

    it('should handle rate limit errors', async () => {
      mockModel.generateContent.mockRejectedValue({
        message: 'Quota exceeded'
      });

      await expect(provider.analyze(testImage, testPrompt))
        .rejects.toThrow(RateLimitError);
    });

    it('should handle timeout errors', async () => {
      mockModel.generateContent.mockRejectedValue({
        message: 'Request timeout'
      });

      await expect(provider.analyze(testImage, testPrompt))
        .rejects.toThrow(AnalysisError);
    });

    it('should handle general API errors', async () => {
      mockModel.generateContent.mockRejectedValue({
        message: 'Unknown error'
      });

      await expect(provider.analyze(testImage, testPrompt))
        .rejects.toThrow(AnalysisError);
    });

    it('should preserve original error in ProviderError', async () => {
      const originalError = new Error('Original error');
      mockModel.generateContent.mockRejectedValue(originalError);

      try {
        await provider.analyze(testImage, testPrompt);
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).originalError).toBe(originalError);
      }
    });
  });

  describe('Health Check', () => {
    it('should return true for successful health check', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'Health check response'
        }
      });

      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false for failed health check', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('Health check failed'));

      const isHealthy = await provider.healthCheck();
      expect(isHealthy).toBe(false);
    });

    it('should use minimal configuration for health check', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: { text: () => 'OK' }
      });

      await provider.healthCheck();

      expect(mockModel.generateContent).toHaveBeenCalledWith({
        contents: expect.any(Array),
        generationConfig: {
          maxOutputTokens: 10,
          temperature: 0
        }
      });
    });
  });

  describe('Cost Calculation', () => {
    it('should calculate cost based on token count', () => {
      const cost1000 = provider.getCost(1000);
      const cost2000 = provider.getCost(2000);

      expect(cost1000).toBeCloseTo(0.000375, 6); // $0.000375 per 1K tokens
      expect(cost2000).toBeCloseTo(0.00075, 6);   // $0.00075 per 2K tokens
    });

    it('should handle zero tokens', () => {
      const cost = provider.getCost(0);
      expect(cost).toBe(0);
    });

    it('should handle fractional tokens', () => {
      const cost = provider.getCost(500); // 0.5K tokens
      expect(cost).toBeCloseTo(0.0001875, 6);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate correct configuration', () => {
      const validConfig = {
        apiKey: 'valid-key',
        model: 'gemini-pro-vision',
        maxTokens: 2048,
        temperature: 0.5
      };

      expect(provider.validateConfig(validConfig)).toBe(true);
    });

    it('should reject configuration without API key', () => {
      const invalidConfig = {
        model: 'gemini-pro-vision',
        maxTokens: 2048,
        temperature: 0.5
      };

      expect(() => provider.validateConfig(invalidConfig))
        .toThrow(ConfigurationError);
    });

    it('should reject configuration with invalid model', () => {
      const invalidConfig = {
        apiKey: 'valid-key',
        model: 'invalid-model',
        maxTokens: 2048,
        temperature: 0.5
      };

      expect(() => provider.validateConfig(invalidConfig))
        .toThrow(ConfigurationError);
    });

    it('should reject configuration with invalid maxTokens', () => {
      const invalidConfig = {
        apiKey: 'valid-key',
        model: 'gemini-pro-vision',
        maxTokens: -100,
        temperature: 0.5
      };

      expect(() => provider.validateConfig(invalidConfig))
        .toThrow(ConfigurationError);
    });

    it('should reject configuration with invalid temperature', () => {
      const invalidConfig = {
        apiKey: 'valid-key',
        model: 'gemini-pro-vision',
        maxTokens: 2048,
        temperature: 2.0
      };

      expect(() => provider.validateConfig(invalidConfig))
        .toThrow(ConfigurationError);
    });
  });

  describe('Confidence Score Calculation', () => {
    const testImage = Buffer.from('test-image-data');
    const testPrompt = 'Test prompt';

    it('should adjust confidence based on finish reason', async () => {
      // Test STOP finish reason (should increase confidence)
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'Response text',
          candidates: [{
            finishReason: 'STOP',
            safetyRatings: []
          }],
          usageMetadata: { totalTokenCount: 100 }
        }
      });

      const result = await provider.analyze(testImage, testPrompt);
      expect(result.confidence).toBeGreaterThan(0.85); // Base confidence + STOP bonus
    });

    it('should reduce confidence for MAX_TOKENS finish reason', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'Truncated response',
          candidates: [{
            finishReason: 'MAX_TOKENS',
            safetyRatings: []
          }],
          usageMetadata: { totalTokenCount: 100 }
        }
      });

      const result = await provider.analyze(testImage, testPrompt);
      expect(result.confidence).toBeLessThan(0.85); // Base confidence - MAX_TOKENS penalty
    });

    it('should reduce confidence for safety concerns', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'Response text',
          candidates: [{
            finishReason: 'STOP',
            safetyRatings: [{
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              probability: 'MEDIUM'
            }]
          }],
          usageMetadata: { totalTokenCount: 100 }
        }
      });

      const result = await provider.analyze(testImage, testPrompt);
      expect(result.confidence).toBeLessThan(0.95); // Reduced due to safety rating
    });
  });

  describe('Media Type Detection', () => {
    it('should detect PNG images', async () => {
      const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const pngImage = Buffer.concat([pngSignature, Buffer.alloc(100)]);

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'Response',
          candidates: [{ finishReason: 'STOP', safetyRatings: [] }],
          usageMetadata: { totalTokenCount: 100 }
        }
      });

      await provider.analyze(pngImage, 'Test prompt');

      const call = mockModel.generateContent.mock.calls[0][0];
      expect(call.contents[0].parts[1].inlineData.mimeType).toBe('image/png');
    });

    it('should detect JPEG images', async () => {
      const jpegSignature = Buffer.from([0xFF, 0xD8, 0xFF]);
      const jpegImage = Buffer.concat([jpegSignature, Buffer.alloc(100)]);

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'Response',
          candidates: [{ finishReason: 'STOP', safetyRatings: [] }],
          usageMetadata: { totalTokenCount: 100 }
        }
      });

      await provider.analyze(jpegImage, 'Test prompt');

      const call = mockModel.generateContent.mock.calls[0][0];
      expect(call.contents[0].parts[1].inlineData.mimeType).toBe('image/jpeg');
    });

    it('should default to JPEG for unknown formats', async () => {
      const unknownImage = Buffer.from('unknown image data');

      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'Response',
          candidates: [{ finishReason: 'STOP', safetyRatings: [] }],
          usageMetadata: { totalTokenCount: 100 }
        }
      });

      await provider.analyze(unknownImage, 'Test prompt');

      const call = mockModel.generateContent.mock.calls[0][0];
      expect(call.contents[0].parts[1].inlineData.mimeType).toBe('image/jpeg');
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens when usage metadata is unavailable', async () => {
      mockModel.generateContent.mockResolvedValue({
        response: {
          text: () => 'A response that is exactly twenty characters long',
          candidates: [{ finishReason: 'STOP', safetyRatings: [] }],
          usageMetadata: undefined // No usage metadata
        }
      });

      const result = await provider.analyze(Buffer.from('test'), 'Test prompt that is thirty characters');
      
      // Should estimate based on text length (~4 chars per token)
      // Prompt (30 chars) + Response (50 chars) = ~20 tokens
      expect(result.tokensUsed).toBeGreaterThan(15);
      expect(result.tokensUsed).toBeLessThan(25);
    });
  });
});