/**
 * Chat API service
 * Handles all chat-related API communications
 */

import { Query, SessionState, AnalysisResult } from '../types/chat';

export interface ChatAPIError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

export interface SendQueryRequest {
  queryText: string;
  queryType: 'component_identification' | 'general_question' | 'schematic_analysis';
  documentIds: string[];
  sessionId: string;
}

export interface SendQueryResponse {
  queryId: string;
  queryText: string;
  queryType: string;
  documentIds: string[];
  estimatedResponseTime: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface GetSessionResponse {
  sessionId: string;
  uploadedFiles: Array<{
    fileId: string;
    originalName: string;
    size: number;
    mimeType: string;
    uploadedAt: string;
    processingStatus: 'uploading' | 'processing' | 'ready' | 'error';
    previewUrl?: string;
  }>;
  queryHistory: Query[];
  currentQuery: string;
  createdAt: string;
  expiresAt: string;
}

export interface GetQueryHistoryResponse {
  queries: Query[];
  totalCount: number;
  hasMore: boolean;
}

class ChatAPIService {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Send a new query to the analysis system
   */
  async sendQuery(request: SendQueryRequest): Promise<SendQueryResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/${request.sessionId}/queries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queryText: request.queryText,
        queryType: request.queryType,
        documentIds: request.documentIds
      })
    });

    if (!response.ok) {
      const error: ChatAPIError = await response.json();
      throw new Error(error.message || 'Failed to send query');
    }

    return response.json();
  }

  /**
   * Get session information including uploaded files and query history
   */
  async getSession(sessionId: string): Promise<GetSessionResponse> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const error: ChatAPIError = await response.json();
      throw new Error(error.message || 'Failed to fetch session');
    }

    return response.json();
  }

  /**
   * Get query history for a session with pagination
   */
  async getQueryHistory(
    sessionId: string, 
    options?: {
      limit?: number;
      offset?: number;
      queryType?: 'component_identification' | 'general_question' | 'schematic_analysis';
    }
  ): Promise<GetQueryHistoryResponse> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.queryType) params.append('queryType', options.queryType);

    const response = await fetch(
      `${this.baseUrl}/sessions/${sessionId}/queries?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.ok) {
      const error: ChatAPIError = await response.json();
      throw new Error(error.message || 'Failed to fetch query history');
    }

    return response.json();
  }

  /**
   * Get a specific query by ID
   */
  async getQuery(sessionId: string, queryId: string): Promise<Query> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/queries/${queryId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const error: ChatAPIError = await response.json();
      throw new Error(error.message || 'Failed to fetch query');
    }

    return response.json();
  }

  /**
   * Delete a query from history
   */
  async deleteQuery(sessionId: string, queryId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/queries/${queryId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const error: ChatAPIError = await response.json();
      throw new Error(error.message || 'Failed to delete query');
    }
  }

  /**
   * Cancel a processing query
   */
  async cancelQuery(sessionId: string, queryId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/queries/${queryId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const error: ChatAPIError = await response.json();
      throw new Error(error.message || 'Failed to cancel query');
    }
  }

  /**
   * Provide feedback on a query response
   */
  async provideFeedback(
    sessionId: string, 
    queryId: string, 
    feedback: {
      rating: number; // 1-5 scale
      comment?: string;
      helpful: boolean;
    }
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/queries/${queryId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(feedback)
    });

    if (!response.ok) {
      const error: ChatAPIError = await response.json();
      throw new Error(error.message || 'Failed to submit feedback');
    }
  }

  /**
   * Get suggested questions based on uploaded documents
   */
  async getSuggestedQuestions(sessionId: string): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/suggestions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      const error: ChatAPIError = await response.json();
      throw new Error(error.message || 'Failed to fetch suggestions');
    }

    const data = await response.json();
    return data.suggestions || [];
  }

  /**
   * Export chat history as various formats
   */
  async exportChatHistory(
    sessionId: string, 
    format: 'json' | 'pdf' | 'text'
  ): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/export?format=${format}`, {
      method: 'GET',
      headers: {
        'Accept': format === 'json' ? 'application/json' : 
                format === 'pdf' ? 'application/pdf' : 'text/plain'
      }
    });

    if (!response.ok) {
      const error: ChatAPIError = await response.json();
      throw new Error(error.message || 'Failed to export chat history');
    }

    return response.blob();
  }
}

// Create singleton instance
export const chatAPI = new ChatAPIService();

// Export class for testing or custom instances
export { ChatAPIService };