/**
 * Provider Registry
 * 
 * Centralized registration system for all LLM providers.
 * Registers providers with the factory and manages provider initialization.
 */

import { ProviderFactory } from './base/ProviderFactory';
import { BaseProviderConfig } from './base/BaseProvider';
import { LLMProvider } from './base/LLMProvider.interface';
import { ClaudeProvider, ClaudeConfig } from './claude.provider';
import { GeminiProvider, GeminiConfig } from './gemini.provider';

/**
 * Registers all available providers with the factory
 */
export function registerAllProviders(): void {
  const factory = ProviderFactory.getInstance();

  // Register Claude provider
  factory.registerProvider({
    type: 'anthropic',
    name: 'Anthropic Claude 3.5 Sonnet',
    description: 'Anthropic Claude 3.5 Sonnet for advanced visual analysis of electrical drawings',
    factory: (config: Record<string, unknown>) => {
      const claudeConfig: ClaudeConfig = {
        apiKey: config.apiKey as string,
        model: (config.model as string) || 'claude-3-5-sonnet-20241022',
        maxTokens: (config.maxTokens as number) || 4096,
        temperature: (config.temperature as number) || 0.1,
        timeout: (config.timeout as number) || 30000,
        maxRetries: (config.maxRetries as number) || 3,
        anthropicVersion: (config.anthropicVersion as string) || '2023-06-01'
      };

      if (config.baseUrl) {
        (claudeConfig as any).baseUrl = config.baseUrl as string;
      }

      if (config.rateLimit) {
        (claudeConfig as any).rateLimit = config.rateLimit as BaseProviderConfig['rateLimit'];
      }
      
      return new ClaudeProvider(claudeConfig);
    },
    requiredConfig: ['apiKey', 'model', 'maxTokens', 'temperature'],
    defaultConfig: {
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 4096,
      temperature: 0.1,
      timeout: 30000,
      maxRetries: 3,
      anthropicVersion: '2023-06-01'
    }
  });

  // Register Gemini provider
  factory.registerProvider({
    type: 'google',
    name: 'Google Gemini Pro Vision',
    description: 'Google Gemini Pro Vision for advanced multimodal analysis of electrical drawings',
    factory: (config: Record<string, unknown>) => {
      const geminiConfig: GeminiConfig = {
        apiKey: config.apiKey as string,
        model: 'gemini-pro-vision',
        maxTokens: (config.maxTokens as number) || 2048,
        temperature: (config.temperature as number) || 0.1,
        timeout: (config.timeout as number) || 30000,
        maxRetries: (config.maxRetries as number) || 3
      };

      // Add optional properties conditionally
      if (config.safetySettings) {
        (geminiConfig as any).safetySettings = config.safetySettings;
      }

      if (config.generationConfig) {
        (geminiConfig as any).generationConfig = config.generationConfig;
      }

      if (config.baseUrl) {
        (geminiConfig as any).baseUrl = config.baseUrl as string;
      }

      if (config.rateLimit) {
        (geminiConfig as any).rateLimit = config.rateLimit as BaseProviderConfig['rateLimit'];
      }
      
      return new GeminiProvider(geminiConfig);
    },
    requiredConfig: ['apiKey', 'model', 'maxTokens', 'temperature'],
    defaultConfig: {
      model: 'gemini-pro-vision',
      maxTokens: 2048,
      temperature: 0.1,
      timeout: 30000,
      maxRetries: 3
    }
  });

  console.log('✅ All providers registered with factory');
}

/**
 * Creates providers from environment configuration
 */
export function createProvidersFromEnv(): Map<string, LLMProvider> {
  const factory = ProviderFactory.getInstance();
  const providerConfigs: Array<{
    type: string;
    enabled: boolean;
    priority: number;
    config: Record<string, unknown>;
  }> = [];

  // Claude provider configuration
  if (process.env.ANTHROPIC_API_KEY) {
    providerConfigs.push({
      type: 'anthropic',
      enabled: true,
      priority: 90,
      config: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
        maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4096'),
        temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.1'),
        timeout: parseInt(process.env.CLAUDE_TIMEOUT || '30000'),
        maxRetries: parseInt(process.env.CLAUDE_MAX_RETRIES || '3'),
        anthropicVersion: process.env.ANTHROPIC_VERSION || '2023-06-01'
      }
    });
  } else {
    console.warn('⚠️  WARNING: ANTHROPIC_API_KEY environment variable not set! Claude provider will not be available.');
  }

  // Gemini provider configuration
  if (process.env.GOOGLE_API_KEY) {
    providerConfigs.push({
      type: 'google',
      enabled: true,
      priority: 80,
      config: {
        apiKey: process.env.GOOGLE_API_KEY,
        model: 'gemini-pro-vision',
        maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '2048'),
        temperature: parseFloat(process.env.GEMINI_TEMPERATURE || '0.1'),
        timeout: parseInt(process.env.GEMINI_TIMEOUT || '30000'),
        maxRetries: parseInt(process.env.GEMINI_MAX_RETRIES || '3')
      }
    });
  } else {
    console.warn('⚠️  WARNING: GOOGLE_API_KEY environment variable not set! Gemini provider will not be available.');
  }

  if (providerConfigs.length === 0) {
    console.warn('⚠️  WARNING: No provider configurations found. Please set API keys in environment variables.');
    return new Map();
  }

  try {
    return factory.createProviders(providerConfigs);
  } catch (error) {
    console.error('❌ Failed to create providers:', error);
    return new Map();
  }
}

/**
 * Gets provider registration information
 */
export function getProviderRegistrations(): Array<{
  type: string;
  name: string;
  description: string;
  requiredConfig: string[];
}> {
  const factory = ProviderFactory.getInstance();
  return factory.getRegisteredProviderTypes();
}

/**
 * Checks provider health status
 */
export async function checkProviderHealth(providers: Map<string, LLMProvider>): Promise<Map<string, boolean>> {
  const healthStatus = new Map<string, boolean>();
  
  const healthChecks = Array.from(providers.entries()).map(async ([type, provider]) => {
    try {
      const isHealthy = await provider.healthCheck();
      healthStatus.set(type, isHealthy);
      return { type, isHealthy };
    } catch (error) {
      console.error(`Health check failed for ${type} provider:`, error);
      healthStatus.set(type, false);
      return { type, isHealthy: false };
    }
  });

  await Promise.allSettled(healthChecks);
  return healthStatus;
}