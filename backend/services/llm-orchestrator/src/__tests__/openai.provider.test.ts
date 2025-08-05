/**
 * OpenAI provider unit tests
 */

import { OpenAIProvider } from '../providers/openai.provider';
import { ProviderConfig } from '../providers/provider.interface';

// Mock OpenAI SDK
jest.mock('openai');

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let mockConfig: ProviderConfig;

  beforeEach(() => {
    mockConfig = {
      apiKey: 'sk-test-key-12345',
      timeout: 30000,
      retryAttempts: 3,
    };

    provider = new OpenAIProvider(mockConfig);
  });

  describe('constructor', () => {
    it('should create provider with valid config', () => {
      expect(provider).toBeInstanceOf(OpenAIProvider);
      expect(provider.getName()).toBe('openai');
    });
  });

  describe('validateConfiguration', () => {
    it('should return true for valid API key', () => {
      expect(provider.validateConfiguration()).toBe(true);
    });

    it('should return false for invalid API key', () => {
      const invalidProvider = new OpenAIProvider({ 
        apiKey: 'invalid-key',
        timeout: 30000 
      });
      expect(invalidProvider.validateConfiguration()).toBe(false);
    });

    it('should return false for empty API key', () => {
      const invalidProvider = new OpenAIProvider({ 
        apiKey: '',
        timeout: 30000 
      });
      expect(invalidProvider.validateConfiguration()).toBe(false);
    });
  });

  describe('getCapabilities', () => {
    it('should return correct capabilities', () => {
      const capabilities = provider.getCapabilities();
      
      expect(capabilities).toEqual({
        supportsVision: true,
        maxImageSize: 20 * 1024 * 1024,
        maxImagesPerRequest: 4,
        supportedFormats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        maxTokens: 4096,
        costPerToken: 0.00003,
      });
    });
  });

  describe('getName', () => {
    it('should return correct provider name', () => {
      expect(provider.getName()).toBe('openai');
    });
  });

  describe('analyze', () => {
    const mockImageBuffer = Buffer.from('mock-image-data');
    const mockPrompt = 'Analyze this electrical schematic';

    beforeEach(() => {
      // Mock the OpenAI client
      const mockClient = {
        chat: {
          completions: {
            create: jest.fn(),
          },
        },
        models: {
          list: jest.fn(),
        },
      };

      (provider as any).client = mockClient;
    });

    it('should successfully analyze images with valid inputs', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'This is a test analysis result',
            },
          },
        ],
        model: 'gpt-4-vision-preview',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };

      (provider as any).client.chat.completions.create.mockResolvedValue(mockResponse);

      const result = await provider.analyze([mockImageBuffer], mockPrompt);

      expect(result).toMatchObject({
        result: 'This is a test analysis result',
        provider: 'openai',
        confidence: expect.any(Number),
        processingTime: expect.any(Number),
        metadata: {
          model: 'gpt-4-vision-preview',
          tokenUsage: {
            prompt: 100,
            completion: 50,
            total: 150,
          },
          imageCount: 1,
          promptLength: mockPrompt.length,
        },
      });

      expect(result.analysisId).toMatch(/^openai_\d+_[a-z0-9]+$/);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should throw error for empty images array', async () => {
      await expect(provider.analyze([], mockPrompt)).rejects.toThrow('No images provided');
    });

    it('should throw error for empty prompt', async () => {
      await expect(provider.analyze([mockImageBuffer], '')).rejects.toThrow('Empty prompt provided');
    });

    it('should throw error for too many images', async () => {
      const tooManyImages = Array(10).fill(mockImageBuffer);
      
      await expect(provider.analyze(tooManyImages, mockPrompt)).rejects.toThrow('Too many images');
    });

    it('should throw error for oversized images', async () => {
      const oversizedImage = Buffer.alloc(25 * 1024 * 1024); // 25MB
      
      await expect(provider.analyze([oversizedImage], mockPrompt)).rejects.toThrow('Image 1 too large');
    });

    it('should handle OpenAI API errors gracefully', async () => {
      const mockError = new Error('API Error');
      (mockError as any).status = 429;
      (mockError as any).code = 'rate_limited';

      (provider as any).client.chat.completions.create.mockRejectedValue(mockError);

      await expect(provider.analyze([mockImageBuffer], mockPrompt)).rejects.toThrow('OpenAI provider error');
    });

    it('should handle empty response content', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
        model: 'gpt-4-vision-preview',
      };

      (provider as any).client.chat.completions.create.mockResolvedValue(mockResponse);

      await expect(provider.analyze([mockImageBuffer], mockPrompt)).rejects.toThrow('No content in OpenAI response');
    });
  });

  describe('healthCheck', () => {
    beforeEach(() => {
      const mockClient = {
        models: {
          list: jest.fn(),
        },
      };

      (provider as any).client = mockClient;
    });

    it('should return true when API is accessible', async () => {
      (provider as any).client.models.list.mockResolvedValue({ data: [] });

      const result = await provider.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false when API is not accessible', async () => {
      (provider as any).client.models.list.mockRejectedValue(new Error('Network error'));

      const result = await provider.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('confidence calculation', () => {
    it('should calculate higher confidence for electrical analysis content', () => {
      const electricalContent = 'This circuit contains resistors, capacitors, and voltage sources';
      const genericContent = 'This is a simple image';

      // Test via the private method (accessing through any)
      const electricalConfidence = (provider as any).calculateConfidence(electricalContent, { model: 'gpt-4-vision-preview' });
      const genericConfidence = (provider as any).calculateConfidence(genericContent, { model: 'gpt-4-vision-preview' });

      expect(electricalConfidence).toBeGreaterThan(genericConfidence);
    });

    it('should never exceed 1.0 confidence', () => {
      const longElectricalContent = 'circuit resistor capacitor voltage current electrical schematic component analysis '.repeat(20);
      
      const confidence = (provider as any).calculateConfidence(longElectricalContent, { model: 'gpt-4-vision-preview' });
      
      expect(confidence).toBeLessThanOrEqual(1.0);
    });
  });
});