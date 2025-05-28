// Computer Vision Service Client for AI Canvas Integration

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  ComponentDetectionResult, 
  AnalysisOptions, 
  AnalysisSession, 
  ComponentDetection,
  AIError 
} from '@/types/ai/computerVision';

interface CVServiceConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  retryDelay: number;
}

interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export class ComputerVisionService {
  private client: AxiosInstance;
  private config: CVServiceConfig;

  constructor(config?: Partial<CVServiceConfig>) {
    this.config = {
      baseURL: process.env.NEXT_PUBLIC_AI_GATEWAY_URL || 'http://localhost:8000',
      timeout: 30000, // 30 seconds for AI operations
      retries: 3,
      retryDelay: 1000,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for authentication
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling and retries
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const { config: originalRequest } = error;
        
        if (this.shouldRetry(error) && originalRequest._retryCount < this.config.retries) {
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
          
          await this.delay(this.config.retryDelay * originalRequest._retryCount);
          return this.client(originalRequest);
        }
        
        return Promise.reject(this.createAIError(error));
      }
    );
  }

  private getAuthToken(): string | null {
    // Get token from localStorage or auth store
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth-token');
    }
    return null;
  }

  private shouldRetry(error: any): boolean {
    return (
      error.code === 'NETWORK_ERROR' ||
      error.code === 'TIMEOUT' ||
      (error.response?.status >= 500 && error.response?.status < 600)
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createAIError(error: any): AIError {
    return {
      code: error.response?.data?.error_code || 'AI_SERVICE_ERROR',
      message: error.response?.data?.message || error.message || 'Unknown AI service error',
      details: error.response?.data?.details,
      timestamp: new Date(),
      recoverable: this.shouldRetry(error)
    };
  }

  /**
   * Analyze drawing for component detection
   */
  async analyzeDrawing(
    drawingId: string, 
    options: AnalysisOptions = {}
  ): Promise<ComponentDetectionResult> {
    try {
      const response: AxiosResponse<APIResponse<ComponentDetectionResult>> = 
        await this.client.post('/api/v1/cv/analyze-drawing', {
          drawing_id: drawingId,
          confidence_threshold: options.confidenceThreshold || 0.75,
          include_text_extraction: options.includeText || true,
          max_detections: options.maxDetections || 1000,
          force_refresh: options.forceRefresh || false
        });

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Analysis failed');
      }

      return response.data.data;
    } catch (error) {
      console.error('Computer vision analysis error:', error);
      throw error;
    }
  }

  /**
   * Detect components in specific image regions
   */
  async detectComponents(
    imageFile: File,
    boundingBoxes?: Array<{ x: number; y: number; width: number; height: number }>,
    options: AnalysisOptions = {}
  ): Promise<ComponentDetection[]> {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      if (boundingBoxes) {
        formData.append('bounding_boxes', JSON.stringify(boundingBoxes));
      }
      
      formData.append('confidence_threshold', (options.confidenceThreshold || 0.75).toString());
      formData.append('max_detections', (options.maxDetections || 100).toString());

      const response: AxiosResponse<APIResponse<ComponentDetection[]>> = 
        await this.client.post('/api/v1/cv/detect-components', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        });

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Component detection failed');
      }

      return response.data.data;
    } catch (error) {
      console.error('Component detection error:', error);
      throw error;
    }
  }

  /**
   * Extract text from drawing regions
   */
  async extractText(
    drawingId: string,
    regions?: Array<{ x: number; y: number; width: number; height: number }>
  ): Promise<Array<{ text: string; confidence: number; boundingBox: any }>> {
    try {
      const response: AxiosResponse<APIResponse<any[]>> = 
        await this.client.post('/api/v1/cv/extract-text', {
          drawing_id: drawingId,
          regions: regions || []
        });

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Text extraction failed');
      }

      return response.data.data;
    } catch (error) {
      console.error('Text extraction error:', error);
      throw error;
    }
  }

  /**
   * Get model health status
   */
  async getModelHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unavailable';
    version: string;
    accuracy: number;
    lastUpdate: string;
  }> {
    try {
      const response: AxiosResponse<APIResponse<any>> = 
        await this.client.get('/api/v1/cv/model-health');

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Health check failed');
      }

      return response.data.data;
    } catch (error) {
      console.error('Model health check error:', error);
      return {
        status: 'unavailable',
        version: 'unknown',
        accuracy: 0,
        lastUpdate: new Date().toISOString()
      };
    }
  }

  /**
   * Start analysis session with real-time updates
   */
  async startAnalysisSession(
    drawingId: string,
    options: AnalysisOptions = {}
  ): Promise<AnalysisSession> {
    try {
      const response: AxiosResponse<APIResponse<AnalysisSession>> = 
        await this.client.post('/api/v1/cv/start-analysis', {
          drawing_id: drawingId,
          options: {
            confidence_threshold: options.confidenceThreshold || 0.75,
            include_text: options.includeText || true,
            enable_cloud_detection: options.enableCloudDetection || false,
            enable_circuit_tracing: options.enableCircuitTracing || false
          }
        });

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to start analysis session');
      }

      return response.data.data;
    } catch (error) {
      console.error('Analysis session start error:', error);
      throw error;
    }
  }

  /**
   * Cancel ongoing analysis session
   */
  async cancelAnalysisSession(sessionId: string): Promise<void> {
    try {
      const response: AxiosResponse<APIResponse<void>> = 
        await this.client.post(`/api/v1/cv/cancel-analysis/${sessionId}`);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to cancel analysis session');
      }
    } catch (error) {
      console.error('Analysis session cancellation error:', error);
      throw error;
    }
  }

  /**
   * Get analysis session status
   */
  async getAnalysisStatus(sessionId: string): Promise<AnalysisSession> {
    try {
      const response: AxiosResponse<APIResponse<AnalysisSession>> = 
        await this.client.get(`/api/v1/cv/analysis-status/${sessionId}`);

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Failed to get analysis status');
      }

      return response.data.data;
    } catch (error) {
      console.error('Analysis status error:', error);
      throw error;
    }
  }

  /**
   * Provide feedback on detection accuracy
   */
  async provideFeedback(
    detectionId: string,
    feedback: {
      correct: boolean;
      actualType?: string;
      actualSpecs?: any;
      comments?: string;
    }
  ): Promise<void> {
    try {
      const response: AxiosResponse<APIResponse<void>> = 
        await this.client.post('/api/v1/cv/feedback', {
          detection_id: detectionId,
          feedback
        });

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to submit feedback');
      }
    } catch (error) {
      console.error('Feedback submission error:', error);
      throw error;
    }
  }

  /**
   * Get cached results for a drawing
   */
  async getCachedResults(drawingId: string): Promise<ComponentDetectionResult | null> {
    try {
      const response: AxiosResponse<APIResponse<ComponentDetectionResult>> = 
        await this.client.get(`/api/v1/cv/cached-results/${drawingId}`);

      if (!response.data.success) {
        return null; // No cached results found
      }

      return response.data.data || null;
    } catch (error) {
      console.error('Cached results retrieval error:', error);
      return null;
    }
  }
}

// Create singleton instance
export const computerVisionService = new ComputerVisionService();

// Export types for use in components
export type { CVServiceConfig, APIResponse };