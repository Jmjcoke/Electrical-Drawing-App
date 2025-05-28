/**
 * Symbol Extraction Service
 * 
 * Based on successful workflows from:
 * - YOLO-based symbol detection for engineering drawings
 * - PDF-Extract-Kit for high-quality content extraction
 * - GROBID-style semi-automatic training data generation
 */

import { ApiResponse } from '@/types/api';
import { getAPIConfig, APIKeyConfig } from '@/config/apiKeys';

export interface SymbolExtractionRequest {
  file: File;
  options?: {
    pageRange?: { start: number; end: number };
    confidenceThreshold?: number;
    extractionMode?: 'fast' | 'accurate';
    symbolTypes?: string[];
  };
}

export interface ExtractedSymbol {
  id: string;
  // Visual data
  imageData: string; // Base64 encoded image
  boundingBox: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  // Extracted information
  description?: string;
  symbolCode?: string; // e.g., "CB-3P" for 3-pole circuit breaker
  category?: string;
  electricalStandard?: 'NEC' | 'IEC' | 'IEEE' | 'ANSI';
  
  // Metadata
  confidence: number;
  ocrConfidence?: number;
  extractionMethod: 'ml' | 'ocr' | 'manual';
  
  // Training data fields
  verified: boolean;
  annotations?: {
    componentType?: string;
    voltage?: string;
    current?: string;
    power?: string;
  };
}

export interface SymbolExtractionJob {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
    stage: 'uploading' | 'preprocessing' | 'detection' | 'ocr' | 'pairing' | 'validation';
  };
  startedAt: string;
  completedAt?: string;
  results?: {
    extractedSymbols: ExtractedSymbol[];
    statistics: {
      totalPages: number;
      totalSymbols: number;
      symbolsByCategory: Record<string, number>;
      averageConfidence: number;
    };
  };
  error?: string;
}

export interface TrainingDataPreparation {
  symbols: ExtractedSymbol[];
  augmentations?: {
    rotation: boolean;
    scaling: boolean;
    noise: boolean;
    lighting: boolean;
  };
  format: 'yolo' | 'coco' | 'pascal_voc' | 'custom';
  splitRatio?: {
    train: number;
    validation: number;
    test: number;
  };
}

class SymbolExtractionService {
  private baseUrl: string;
  private wsUrl: string;
  private apiConfig: APIKeyConfig | null = null;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    this.wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';
  }

  /**
   * Check if API keys are configured
   */
  async checkAPIKeyConfiguration(): Promise<{
    configured: boolean;
    providers: string[];
    features: string[];
  }> {
    try {
      const response = await fetch('/api/settings/api-keys', {
        headers: {
          'Authorization': `Bearer ${this.getToken()}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const configured = data.status.openai.configured || 
                         data.status.computerVision.configured || 
                         data.status.customML.configured;
        
        const providers = [];
        if (data.status.openai.configured) providers.push('openai');
        if (data.status.computerVision.configured) providers.push(data.status.computerVision.provider);
        if (data.status.customML.configured) providers.push('custom');
        
        return {
          configured,
          providers,
          features: data.status.availableFeatures || [],
        };
      }
    } catch (error) {
      console.error('Failed to check API key configuration:', error);
    }

    return {
      configured: false,
      providers: [],
      features: [],
    };
  }

  /**
   * Start symbol extraction job
   * Implements multi-stage extraction pipeline:
   * 1. PDF preprocessing (page segmentation)
   * 2. Symbol detection using YOLO/Faster R-CNN
   * 3. OCR for text extraction
   * 4. Symbol-description pairing
   * 5. Validation and confidence scoring
   */
  async startExtraction(
    request: SymbolExtractionRequest
  ): Promise<ApiResponse<SymbolExtractionJob>> {
    try {
      // Check API key configuration first
      const apiKeyConfig = await this.checkAPIKeyConfiguration();
      if (!apiKeyConfig.configured) {
        return {
          success: false,
          error: 'No API keys configured. Please configure at least one AI provider in settings.',
        };
      }

      const formData = new FormData();
      formData.append('file', request.file);
      
      if (request.options) {
        formData.append('options', JSON.stringify(request.options));
      }

      // Add available providers to the request
      formData.append('providers', JSON.stringify(apiKeyConfig.providers));

      const response = await fetch(`${this.baseUrl}/api/v1/symbols/extract`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${this.getToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      console.error('Symbol extraction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get extraction job status
   */
  async getJobStatus(jobId: string): Promise<ApiResponse<SymbolExtractionJob>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/symbols/jobs/${jobId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.getToken()}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Subscribe to real-time extraction updates via WebSocket
   */
  subscribeToJob(
    jobId: string,
    callbacks: {
      onProgress?: (progress: SymbolExtractionJob['progress']) => void;
      onSymbolExtracted?: (symbol: ExtractedSymbol) => void;
      onComplete?: (job: SymbolExtractionJob) => void;
      onError?: (error: string) => void;
    }
  ): () => void {
    const ws = new WebSocket(`${this.wsUrl}/symbols/jobs/${jobId}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'progress':
          callbacks.onProgress?.(data.progress);
          break;
        case 'symbol_extracted':
          callbacks.onSymbolExtracted?.(data.symbol);
          break;
        case 'complete':
          callbacks.onComplete?.(data.job);
          break;
        case 'error':
          callbacks.onError?.(data.error);
          break;
      }
    };

    ws.onerror = (error) => {
      callbacks.onError?.('WebSocket connection error');
    };

    // Return cleanup function
    return () => {
      ws.close();
    };
  }

  /**
   * Verify and correct extracted symbols
   * Allows manual verification and correction of OCR results
   */
  async verifySymbol(
    symbolId: string,
    corrections: Partial<ExtractedSymbol>
  ): Promise<ApiResponse<ExtractedSymbol>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/symbols/${symbolId}/verify`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getToken()}`,
          },
          body: JSON.stringify(corrections),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Prepare symbols for training
   * Converts extracted symbols into training dataset format
   */
  async prepareTrainingData(
    preparation: TrainingDataPreparation
  ): Promise<ApiResponse<{ datasetId: string; downloadUrl: string }>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/symbols/prepare-training`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getToken()}`,
          },
          body: JSON.stringify(preparation),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Search for similar symbols in the database
   * Uses visual similarity matching
   */
  async findSimilarSymbols(
    imageData: string,
    limit: number = 10
  ): Promise<ApiResponse<ExtractedSymbol[]>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/v1/symbols/search-similar`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.getToken()}`,
          },
          body: JSON.stringify({ imageData, limit }),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private getToken(): string | null {
    return localStorage.getItem('auth-token');
  }
}

export const symbolExtractionService = new SymbolExtractionService();