/**
 * Unit tests for Claude Provider
 */

import { ClaudeProvider, ClaudeConfig } from '../../providers/claude.provider';
import { AnalysisError, ConfigurationError, RateLimitError } from '../../providers/base/LLMProvider.interface';

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn()
      }
    }))
  };
});

describe('ClaudeProvider', () => {
  let mockAnthropicClient: any;
  let claudeProvider: ClaudeProvider;
  let validConfig: ClaudeConfig;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup valid configuration
    validConfig = {
      apiKey: 'sk-ant-api03-test-key',
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 4096,
      temperature: 0.1,
      timeout: 30000,
      maxRetries: 3,
      anthropicVersion: '2023-06-01'
    };

    // Mock Anthropic client
    const AnthropicMock = require('@anthropic-ai/sdk').default;
    mockAnthropicClient = {
      messages: {
        create: jest.fn()
      }
    };
    AnthropicMock.mockImplementation(() => mockAnthropicClient);
  });

  describe('Constructor and Configuration', () => {
    it('should create Claude provider with valid configuration', () => {
      claudeProvider = new ClaudeProvider(validConfig);
      
      expect(claudeProvider.name).toBe('claude-3-5-sonnet');
      expect(claudeProvider.version).toBe('20241022');
      expect(claudeProvider.metadata.capabilities.supportsVision).toBe(true);
    });

    it('should throw ConfigurationError for invalid API key', () => {
      const invalidConfig = { ...validConfig, apiKey: '' };
      
      expect(() => new ClaudeProvider(invalidConfig)).toThrow('API key is required');
    });

    it('should throw ConfigurationError for invalid model', () => {
      const invalidConfig = { ...validConfig, model: 'gpt-4' };
      
      expect(() => new ClaudeProvider(invalidConfig)).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for invalid maxTokens', () => {
      const invalidConfig = { ...validConfig, maxTokens: -1 };
      
      expect(() => new ClaudeProvider(invalidConfig)).toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError for invalid temperature', () => {
      const invalidConfig = { ...validConfig, temperature: 2.0 };
      
      expect(() => new ClaudeProvider(invalidConfig)).toThrow(ConfigurationError);
    });
  });

  describe('analyze method', () => {
    beforeEach(() => {
      claudeProvider = new ClaudeProvider(validConfig);
    });

    it('should successfully analyze image with valid input', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'This is a circuit diagram with resistors and capacitors.' }],
        usage: { input_tokens: 100, output_tokens: 50 },
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn'
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      const imageBuffer = Buffer.from('fake-image-data');
      const prompt = 'Analyze this electrical diagram';

      const result = await claudeProvider.analyze(imageBuffer, prompt);

      expect(result.content).toBe('This is a circuit diagram with resistors and capacitors.');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.tokensUsed).toBe(150);
      expect(result.model).toBe('claude-3-5-sonnet-20241022');
      expect(result.metadata).toEqual({
        inputTokens: 100,
        outputTokens: 50,
        imageSize: imageBuffer.length,
        promptLength: prompt.length,
        stopReason: 'end_turn'
      });
    });

    it('should handle API authentication error', async () => {
      const authError = {
        type: 'authentication_error',
        message: 'Invalid API key'
      };

      mockAnthropicClient.messages.create.mockRejectedValue(authError);

      const imageBuffer = Buffer.from('fake-image-data');
      const prompt = 'Analyze this electrical diagram';

      await expect(claudeProvider.analyze(imageBuffer, prompt))
        .rejects.toThrow(ConfigurationError);
    });

    it('should handle rate limit error', async () => {
      const rateLimitError = {
        type: 'rate_limit_error',
        message: 'Rate limit exceeded',
        details: { retry_after: 60 }
      };

      mockAnthropicClient.messages.create.mockRejectedValue(rateLimitError);

      const imageBuffer = Buffer.from('fake-image-data');
      const prompt = 'Analyze this electrical diagram';

      await expect(claudeProvider.analyze(imageBuffer, prompt))
        .rejects.toThrow(RateLimitError);
    });

    it('should handle request too large error', async () => {
      const requestTooLargeError = {
        type: 'request_too_large',
        message: 'Request payload too large'
      };

      mockAnthropicClient.messages.create.mockRejectedValue(requestTooLargeError);

      const imageBuffer = Buffer.from('fake-image-data');
      const prompt = 'Analyze this electrical diagram';

      await expect(claudeProvider.analyze(imageBuffer, prompt))
        .rejects.toThrow(AnalysisError);
    });

    it('should validate image buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const prompt = 'Analyze this electrical diagram';

      await expect(claudeProvider.analyze(emptyBuffer, prompt))
        .rejects.toThrow(AnalysisError);
    });

    it('should validate image size', async () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB, exceeds 5MB limit
      const prompt = 'Analyze this electrical diagram';

      await expect(claudeProvider.analyze(largeBuffer, prompt))
        .rejects.toThrow(AnalysisError);
    });

    it('should validate prompt', async () => {
      const imageBuffer = Buffer.from('fake-image-data');
      const emptyPrompt = '';

      await expect(claudeProvider.analyze(imageBuffer, emptyPrompt))
        .rejects.toThrow(AnalysisError);
    });

    it('should detect media type correctly', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Analysis result' }],
        usage: { input_tokens: 100, output_tokens: 50 },
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn'
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      // JPEG signature
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
      await claudeProvider.analyze(jpegBuffer, 'test');

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.arrayContaining([
                expect.objectContaining({
                  type: 'image',
                  source: expect.objectContaining({
                    media_type: 'image/jpeg'
                  })
                })
              ])
            })
          ])
        })
      );
    });

    it('should calculate confidence based on response characteristics', async () => {
      const mockResponse = {
        content: [{ 
          type: 'text', 
          text: 'This circuit diagram shows electrical components including resistors, capacitors, and voltage sources. I identified 5 resistors and 3 capacitors in the schematic.' 
        }],
        usage: { input_tokens: 100, output_tokens: 150 },
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn'
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      const imageBuffer = Buffer.from('fake-image-data');
      const result = await claudeProvider.analyze(imageBuffer, 'Analyze this electrical diagram');

      // Should have higher confidence due to:
      // - Long detailed response (> 500 chars)
      // - Multiple electrical keywords
      // - High token usage
      // - Contains "identified" keyword
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('healthCheck method', () => {
    beforeEach(() => {
      claudeProvider = new ClaudeProvider(validConfig);
    });

    it('should return true when API is healthy', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Hello' }],
        usage: { input_tokens: 5, output_tokens: 5 },
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn'
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      const isHealthy = await claudeProvider.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should return false when API is unhealthy', async () => {
      mockAnthropicClient.messages.create.mockRejectedValue(new Error('API unavailable'));

      const isHealthy = await claudeProvider.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('getCost method', () => {
    beforeEach(() => {
      claudeProvider = new ClaudeProvider(validConfig);
    });

    it('should calculate cost correctly', () => {
      const tokens = 1000;
      const cost = claudeProvider.getCost(tokens);
      
      // Expected cost: 700 input tokens * $0.003/1K + 300 output tokens * $0.015/1K
      const expectedCost = (700 / 1000) * 0.003 + (300 / 1000) * 0.015;
      expect(cost).toBeCloseTo(expectedCost, 5);
    });

    it('should handle zero tokens', () => {
      const cost = claudeProvider.getCost(0);
      expect(cost).toBe(0);
    });
  });

  describe('getRequiredConfig method', () => {
    beforeEach(() => {
      claudeProvider = new ClaudeProvider(validConfig);
    });

    it('should return required configuration keys', () => {
      const requiredConfig = claudeProvider.getRequiredConfig();
      
      expect(requiredConfig).toEqual([
        'apiKey',
        'model', 
        'maxTokens',
        'temperature'
      ]);
    });
  });

  describe('validateConfig method', () => {
    beforeEach(() => {
      claudeProvider = new ClaudeProvider(validConfig);
    });

    it('should validate correct configuration', () => {
      const config = {
        apiKey: 'sk-ant-api03-test-key',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 4096,
        temperature: 0.1
      };

      expect(() => claudeProvider.validateConfig(config)).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
      const config = {
        apiKey: 'sk-ant-api03-test-key'
        // Missing model, maxTokens, temperature
      };

      expect(() => claudeProvider.validateConfig(config)).toThrow(ConfigurationError);
    });

    it('should throw error for invalid model', () => {
      const config = {
        apiKey: 'sk-ant-api03-test-key',
        model: 'invalid-model',
        maxTokens: 4096,
        temperature: 0.1
      };

      expect(() => claudeProvider.validateConfig(config)).toThrow(ConfigurationError);
    });
  });

  describe('Error handling', () => {
    beforeEach(() => {
      claudeProvider = new ClaudeProvider(validConfig);
    });

    it('should handle HTTP status errors', async () => {
      const httpError = {
        status: 400,
        message: 'Bad request'
      };

      mockAnthropicClient.messages.create.mockRejectedValue(httpError);

      const imageBuffer = Buffer.from('fake-image-data');
      const prompt = 'Analyze this';

      await expect(claudeProvider.analyze(imageBuffer, prompt))
        .rejects.toThrow(AnalysisError);
    });

    it('should handle 401 unauthorized errors', async () => {
      const unauthorizedError = {
        status: 401,
        message: 'Unauthorized'
      };

      mockAnthropicClient.messages.create.mockRejectedValue(unauthorizedError);

      const imageBuffer = Buffer.from('fake-image-data');
      const prompt = 'Analyze this';

      await expect(claudeProvider.analyze(imageBuffer, prompt))
        .rejects.toThrow(ConfigurationError);
    });

    it('should handle 429 rate limit errors', async () => {
      const rateLimitError = {
        status: 429,
        message: 'Too many requests'
      };

      mockAnthropicClient.messages.create.mockRejectedValue(rateLimitError);

      const imageBuffer = Buffer.from('fake-image-data');
      const prompt = 'Analyze this';

      await expect(claudeProvider.analyze(imageBuffer, prompt))
        .rejects.toThrow(RateLimitError);
    });

    it('should handle server errors (5xx)', async () => {
      const serverError = {
        status: 500,
        message: 'Internal server error'
      };

      mockAnthropicClient.messages.create.mockRejectedValue(serverError);

      const imageBuffer = Buffer.from('fake-image-data');
      const prompt = 'Analyze this';

      await expect(claudeProvider.analyze(imageBuffer, prompt))
        .rejects.toThrow(AnalysisError);
    });

    it('should handle unexpected response format', async () => {
      const mockResponse = {
        content: [{ type: 'unknown', data: 'invalid' }],
        usage: { input_tokens: 100, output_tokens: 50 },
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn'
      };

      mockAnthropicClient.messages.create.mockResolvedValue(mockResponse);

      const imageBuffer = Buffer.from('fake-image-data');
      const prompt = 'Analyze this';

      await expect(claudeProvider.analyze(imageBuffer, prompt))
        .rejects.toThrow(AnalysisError);
    });
  });
});