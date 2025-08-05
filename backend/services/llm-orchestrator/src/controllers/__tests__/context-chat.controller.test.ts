/**
 * ContextChatController Test Suite
 * Comprehensive unit tests for context-enhanced chat controller functionality
 */

import { Request, Response, NextFunction } from 'express';
import {
  ContextChatController,
  ContextChatRequest,
  ContextSuggestionsRequest,
  ConversationHistoryRequest
} from '../context-chat.controller';
import { ConversationContextService } from '../../context/ConversationContext';
import { ContextAwareQueryEnhancer } from '../../context/ContextAwareQueryEnhancer';
import { ContextSummarizer } from '../../context/ContextSummarizer';
import { contextWebSocketService } from '../../websocket/context-websocket.service';
import {
  ConversationContext,
  ConversationTurn,
  ProcessedQuery,
  AnalysisResult
} from '../../../../../shared/types/context';

// Mock dependencies
jest.mock('../../context/ConversationContext');
jest.mock('../../context/ContextAwareQueryEnhancer');
jest.mock('../../context/ContextSummarizer');
jest.mock('../../websocket/context-websocket.service');

describe('ContextChatController', () => {
  let controller: ContextChatController;
  let mockContextService: jest.Mocked<ConversationContextService>;
  let mockQueryEnhancer: jest.Mocked<ContextAwareQueryEnhancer>;
  let mockContextSummarizer: jest.Mocked<ContextSummarizer>;
  let mockWebSocketService: jest.Mocked<typeof contextWebSocketService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock services
    mockContextService = {
      getContextBySessionId: jest.fn(),
      createContext: jest.fn(),
      addTurn: jest.fn(),
      resetContext: jest.fn(),
      cleanupExpiredContexts: jest.fn()
    } as any;

    mockQueryEnhancer = {
      enhanceQuery: jest.fn()
    } as any;

    mockContextSummarizer = {
      generateContextSummary: jest.fn()
    } as any;

    mockWebSocketService = {
      broadcastContextUpdate: jest.fn(),
      broadcastQueryProcessed: jest.fn(),
      broadcastFollowUpDetected: jest.fn(),
      broadcastContextVisualization: jest.fn()
    } as any;

    // Mock Express objects
    mockRequest = {
      body: {},
      params: {},
      query: {},
      ip: '127.0.0.1'
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    // Initialize controller with mocked dependencies
    controller = new ContextChatController();
    
    // Replace internal services with mocks
    (controller as any).contextService = mockContextService;
    (controller as any).queryEnhancer = mockQueryEnhancer;
    (controller as any).contextSummarizer = mockContextSummarizer;
  });

  describe('processChatQuery', () => {
    const validChatRequest: ContextChatRequest = {
      sessionId: 'test-session-1',
      queryText: 'What is the value of resistor R1?',
      documentIds: ['doc-1'],
      resetContext: false,
      includeContextVisualization: true,
      maxContextHistory: 10
    };

    const mockConversationContext: ConversationContext = {
      id: 'context-1',
      sessionId: 'test-session-1',
      conversationThread: [],
      cumulativeContext: {
        extractedEntities: new Map(),
        documentContext: [],
        topicProgression: [],
        keyInsights: [],
        relationshipMap: []
      },
      lastUpdated: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      metadata: {
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 1,
        compressionLevel: 0,
        tags: ['test']
      }
    };

    const mockEnhancementResult = {
      originalQuery: 'What is the value of resistor R1?',
      enhancedQuery: 'What is the value of the resistor R1 in the electrical schematic?',
      contextSources: [
        {
          type: 'previous_query' as const,
          content: 'Previous analysis of R1',
          relevance: 0.8,
          turnId: 'turn-1'
        }
      ],
      resolvedEntities: [
        {
          originalText: 'resistor R1',
          resolvedText: 'R1 (10kΩ resistor)',
          entityType: 'electrical_component',
          confidence: 0.9,
          contextSource: 'component database',
          alternatives: []
        }
      ],
      detectedAmbiguities: [],
      confidence: 0.85,
      processingTime: 120
    };

    beforeEach(() => {
      mockRequest.body = validChatRequest;
      mockContextService.getContextBySessionId.mockResolvedValue(mockConversationContext);
      mockQueryEnhancer.enhanceQuery.mockResolvedValue(mockEnhancementResult);
    });

    it('should process chat query successfully', async () => {
      const updatedContext = {
        ...mockConversationContext,
        conversationThread: [
          {
            id: 'turn-1',
            turnNumber: 1,
            query: {
              id: 'query-1',
              text: validChatRequest.queryText,
              type: 'component_identification'
            } as unknown as ProcessedQuery,
            response: {
              summary: 'R1 is a 10kΩ resistor',
              components: [],
              confidence: { overall: 0.9, breakdown: {}, reasoning: 'Clear identification' },
              consensus: { agreementLevel: 0.95, conflictingResponses: [], consensusResponse: 'R1 is 10kΩ' }
            } as AnalysisResult,
            contextContributions: ['resistor_identification'],
            followUpDetected: false,
            timestamp: new Date()
          }
        ]
      };

      mockContextService.getContextBySessionId.mockResolvedValueOnce(mockConversationContext).mockResolvedValueOnce(updatedContext);

      await controller.processChatQuery(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockContextService.getContextBySessionId).toHaveBeenCalledWith('test-session-1');
      expect(mockQueryEnhancer.enhanceQuery).toHaveBeenCalledWith(
        'What is the value of resistor R1?',
        mockConversationContext,
        'test-session-1'
      );
      expect(mockContextService.addTurn).toHaveBeenCalled();
      expect(mockWebSocketService.broadcastContextUpdate).toHaveBeenCalledWith(
        'test-session-1',
        'context-1',
        1
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          response: expect.objectContaining({
            originalQuery: 'What is the value of resistor R1?',
            enhancedQuery: 'What is the value of the resistor R1 in the electrical schematic?'
          })
        })
      );
    });

    it('should create new context if none exists', async () => {
      mockContextService.getContextBySessionId.mockResolvedValueOnce(null).mockResolvedValueOnce(mockConversationContext);
      mockContextService.createContext.mockResolvedValue(mockConversationContext);

      await controller.processChatQuery(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockContextService.createContext).toHaveBeenCalledWith('test-session-1');
      expect(mockContextService.addTurn).toHaveBeenCalled();
    });

    it('should reset context when requested', async () => {
      mockRequest.body = { ...validChatRequest, resetContext: true };
      mockContextService.getContextBySessionId.mockResolvedValueOnce(mockConversationContext).mockResolvedValueOnce(mockConversationContext);

      await controller.processChatQuery(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockContextService.resetContext).toHaveBeenCalledWith('test-session-1');
    });

    it('should broadcast follow-up detection when ambiguities found', async () => {
      const enhancementWithAmbiguities = {
        ...mockEnhancementResult,
        detectedAmbiguities: [
          {
            text: 'that component',
            type: 'pronoun' as const,
            possibleResolutions: ['resistor R1', 'capacitor C1'],
            confidence: 0.8,
            requiresContext: true
          }
        ]
      };

      mockQueryEnhancer.enhanceQuery.mockResolvedValue(enhancementWithAmbiguities);
      mockContextService.getContextBySessionId.mockResolvedValueOnce(mockConversationContext).mockResolvedValueOnce(mockConversationContext);

      await controller.processChatQuery(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockWebSocketService.broadcastFollowUpDetected).toHaveBeenCalledWith(
        'test-session-1',
        expect.any(String),
        [
          {
            type: 'pronoun',
            text: 'that component',
            resolvedEntity: 'resistor R1',
            confidence: 0.8
          }
        ]
      );
    });

    it('should validate request parameters', async () => {
      mockRequest.body = { queryText: 'test' }; // Missing sessionId

      await controller.processChatQuery(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('sessionId is required')
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockContextService.getContextBySessionId.mockRejectedValue(new Error('Database connection failed'));

      await controller.processChatQuery(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getContextualSuggestions', () => {
    const validSuggestionsRequest: ContextSuggestionsRequest = {
      sessionId: 'test-session-1',
      partialQuery: 'What is the resistor',
      maxSuggestions: 5,
      includeContextual: true
    };

    beforeEach(() => {
      mockRequest.body = validSuggestionsRequest;
      mockContextService.getContextBySessionId.mockResolvedValue({
        id: 'context-1',
        sessionId: 'test-session-1',
        conversationThread: [
          {
            id: 'turn-1',
            query: {
              text: 'What is the value of resistor R1?'
            } as unknown as ProcessedQuery,
            response: {} as AnalysisResult,
            contextContributions: ['resistor'],
            followUpDetected: false,
            timestamp: new Date(),
            turnNumber: 1
          }
        ],
        cumulativeContext: {
          extractedEntities: new Map([
            ['resistor', [
              { text: 'resistor', type: 'component', confidence: 0.9, context: 'circuit', turnId: 'turn-1', position: 0, firstMentioned: new Date(), mentions: 1 }
            ]]
          ]),
          documentContext: [],
          topicProgression: [],
          keyInsights: [],
          relationshipMap: []
        },
        lastUpdated: new Date(),
        expiresAt: new Date(),
        metadata: {
          createdAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 1,
          compressionLevel: 0,
          tags: []
        }
      });
    });

    it('should generate contextual suggestions', async () => {
      await controller.getContextualSuggestions(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockContextService.getContextBySessionId).toHaveBeenCalledWith('test-session-1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          suggestions: expect.arrayContaining([
            expect.objectContaining({
              text: expect.any(String),
              type: expect.stringMatching(/contextual|template|completion/),
              confidence: expect.any(Number)
            })
          ])
        })
      );
    });

    it('should handle missing context gracefully', async () => {
      mockContextService.getContextBySessionId.mockResolvedValue(null);

      await controller.getContextualSuggestions(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          suggestions: expect.any(Array)
        })
      );
    });

    it('should validate suggestions request', async () => {
      mockRequest.body = { sessionId: 'test' }; // Missing partialQuery

      await controller.getContextualSuggestions(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('partialQuery is required')
        })
      );
    });
  });

  describe('getConversationHistory', () => {
    const validHistoryRequest: ConversationHistoryRequest = {
      sessionId: 'test-session-1',
      limit: 10,
      includeContext: true,
      summarize: true
    };

    const mockContextWithHistory: ConversationContext = {
      id: 'context-1',
      sessionId: 'test-session-1',
      conversationThread: [
        {
          id: 'turn-1',
          turnNumber: 1,
          query: {
            id: 'query-1',
            text: 'What is resistor R1?',
            type: 'component_identification'
          } as unknown as ProcessedQuery,
          response: {
            summary: 'R1 is 10kΩ',
            confidence: { overall: 0.9, breakdown: {}, reasoning: 'Clear' }
          } as AnalysisResult,
          contextContributions: ['resistor'],
          followUpDetected: false,
          timestamp: new Date()
        },
        {
          id: 'turn-2',
          turnNumber: 2,
          query: {
            id: 'query-2',
            text: 'What is its power rating?',
            type: 'component_identification',
            timestamp: new Date('2024-01-01T10:01:00Z'),
            documentIds: ['doc-1'],
            processedText: 'What is its power rating?',
            extractedEntities: [],
            intent: 'component_identification',
            confidence: 0.9
          } as unknown as ProcessedQuery,
          response: {
            summary: 'Power rating is 0.25W',
            confidence: { overall: 0.8, breakdown: {}, reasoning: 'Identified' }
          } as AnalysisResult,
          contextContributions: ['power_rating'],
          followUpDetected: true,
          timestamp: new Date()
        }
      ],
      cumulativeContext: {
        extractedEntities: new Map(),
        documentContext: [],
        topicProgression: [],
        keyInsights: [],
        relationshipMap: []
      },
      lastUpdated: new Date(),
      expiresAt: new Date(),
      metadata: {
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 2,
        compressionLevel: 0,
        tags: []
      }
    };

    beforeEach(() => {
      mockRequest.query = {
        sessionId: validHistoryRequest.sessionId,
        limit: validHistoryRequest.limit?.toString(),
        includeContext: validHistoryRequest.includeContext?.toString(),
        summarize: validHistoryRequest.summarize?.toString()
      };
      mockContextService.getContextBySessionId.mockResolvedValue(mockContextWithHistory);
      mockContextSummarizer.generateContextSummary.mockResolvedValue({
        summary: 'Conversation about resistor R1 specifications',
        keyPoints: ['R1 is 10kΩ', 'Power rating is 0.25W'],
        relevantEntities: ['R1', 'resistor'],
        compressionRatio: 0.5,
        originalTurnCount: 2,
        summaryConfidence: 0.9
      });
    });

    it('should return conversation history with summary', async () => {
      await controller.getConversationHistory(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockContextService.getContextBySessionId).toHaveBeenCalledWith('test-session-1');
      expect(mockContextSummarizer.generateContextSummary).toHaveBeenCalledWith(mockContextWithHistory);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          conversationHistory: expect.arrayContaining([
            expect.objectContaining({
              id: 'turn-1',
              query: expect.objectContaining({ text: 'What is resistor R1?' })
            })
          ]),
          contextSummary: expect.objectContaining({
            summary: 'Conversation about resistor R1 specifications',
            totalTurns: 2
          }),
          contextMetrics: expect.objectContaining({
            totalTurns: 2,
            followUpDetected: 1,
            avgConfidence: expect.any(Number)
          })
        })
      );
    });

    it('should apply limit to conversation history', async () => {
      mockRequest.query = { 
        sessionId: validHistoryRequest.sessionId,
        limit: '1',
        includeContext: validHistoryRequest.includeContext?.toString(),
        summarize: validHistoryRequest.summarize?.toString()
      };

      await controller.getConversationHistory(mockRequest as Request, mockResponse as Response, mockNext);

      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(responseCall.conversationHistory).toHaveLength(1);
      expect(responseCall.conversationHistory[0].id).toBe('turn-2'); // Should get the most recent
    });

    it('should handle missing context', async () => {
      mockContextService.getContextBySessionId.mockResolvedValue(null);

      await controller.getConversationHistory(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'No conversation context found for session'
        })
      );
    });

    it('should validate history request parameters', async () => {
      mockRequest.query = {}; // Missing sessionId

      await controller.getConversationHistory(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('sessionId is required')
        })
      );
    });
  });

  describe('resetConversationContext', () => {
    beforeEach(() => {
      mockRequest.params = { sessionId: 'test-session-1' };
    });

    it('should reset conversation context successfully', async () => {
      await controller.resetConversationContext(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockContextService.resetContext).toHaveBeenCalledWith('test-session-1');
      expect(mockWebSocketService.broadcastContextUpdate).toHaveBeenCalledWith(
        'test-session-1',
        'context-test-session-1',
        0
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Conversation context reset successfully'
        })
      );
    });

    it('should handle missing sessionId', async () => {
      mockRequest.params = {};

      await controller.resetConversationContext(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Session ID is required'
        })
      );
    });

    it('should handle reset errors', async () => {
      mockContextService.resetContext.mockRejectedValue(new Error('Clear context failed'));

      await controller.resetConversationContext(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('getContextHealth', () => {
    beforeEach(() => {
      mockRequest.params = { sessionId: 'test-session-1' };
    });

    it('should return context health with session details', async () => {
      const mockSessionContext: ConversationContext = {
        id: 'context-1',
        sessionId: 'test-session-1',
        conversationThread: [
          { id: 'turn-1' } as ConversationTurn,
          { id: 'turn-2' } as ConversationTurn
        ],
        cumulativeContext: {
          extractedEntities: new Map([['resistor', []]]),
          documentContext: [],
          topicProgression: [],
          keyInsights: ['Key insight 1', 'Key insight 2'],
          relationshipMap: []
        },
        lastUpdated: new Date('2024-01-01T10:00:00Z'),
        expiresAt: new Date('2024-01-02T10:00:00Z'),
        metadata: {
          createdAt: new Date(),
          lastAccessed: new Date(),
          accessCount: 1,
          compressionLevel: 0,
          tags: []
        }
      };

      mockContextService.getContextBySessionId.mockResolvedValue(mockSessionContext);

      await controller.getContextHealth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockContextService.getContextBySessionId).toHaveBeenCalledWith('test-session-1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          contextService: expect.objectContaining({
            healthy: true,
            activeContexts: 5
          }),
          sessionContext: expect.objectContaining({
            id: 'context-1',
            turnCount: 2,
            entityCount: 1,
            keyInsights: 2
          })
        })
      );
    });

    it('should return health without session details when no sessionId provided', async () => {
      mockRequest.params = {};

      await controller.getContextHealth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockContextService.getContextBySessionId).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          contextService: expect.any(Object),
          sessionContext: null
        })
      );
    });

    it('should handle health check errors', async () => {
      mockContextService.getContextBySessionId.mockRejectedValue(new Error('Health check failed'));

      await controller.getContextHealth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('validation methods', () => {
    describe('validateContextChatRequest', () => {
      it('should validate valid request', () => {
        const validRequest = {
          sessionId: 'test-session',
          queryText: 'What is the resistor value?',
          documentIds: ['doc-1'],
          resetContext: false,
          includeContextVisualization: true,
          maxContextHistory: 5
        };

        expect(() => {
          (controller as any).validateContextChatRequest(validRequest);
        }).not.toThrow();
      });

      it('should reject invalid sessionId', () => {
        const invalidRequest = {
          queryText: 'What is the resistor value?'
        };

        expect(() => {
          (controller as any).validateContextChatRequest(invalidRequest);
        }).toThrow('sessionId is required');
      });

      it('should reject invalid queryText', () => {
        const invalidRequest = {
          sessionId: 'test-session',
          queryText: 123
        };

        expect(() => {
          (controller as any).validateContextChatRequest(invalidRequest);
        }).toThrow('queryText is required and must be a string');
      });
    });

    describe('validateContextSuggestionsRequest', () => {
      it('should validate valid suggestions request', () => {
        const validRequest = {
          sessionId: 'test-session',
          partialQuery: 'What is',
          maxSuggestions: 5,
          includeContextual: true
        };

        expect(() => {
          (controller as any).validateContextSuggestionsRequest(validRequest);
        }).not.toThrow();
      });

      it('should reject invalid partialQuery', () => {
        const invalidRequest = {
          sessionId: 'test-session'
        };

        expect(() => {
          (controller as any).validateContextSuggestionsRequest(invalidRequest);
        }).toThrow('partialQuery is required');
      });
    });

    describe('validateConversationHistoryRequest', () => {
      it('should validate valid history request', () => {
        const validRequest = {
          sessionId: 'test-session',
          limit: '10',
          includeContext: 'true',
          summarize: 'false'
        };

        const result = (controller as any).validateConversationHistoryRequest(validRequest);

        expect(result).toEqual({
          sessionId: 'test-session',
          limit: 10,
          includeContext: true,
          summarize: false
        });
      });

      it('should handle string boolean conversions', () => {
        const requestWithStrings = {
          sessionId: 'test-session',
          includeContext: 'true',
          summarize: 'false'
        };

        const result = (controller as any).validateConversationHistoryRequest(requestWithStrings);

        expect(result.includeContext).toBe(true);
        expect(result.summarize).toBe(false);
      });

      it('should reject invalid sessionId', () => {
        const invalidRequest = {
          limit: '10'
        };

        expect(() => {
          (controller as any).validateConversationHistoryRequest(invalidRequest);
        }).toThrow('sessionId is required');
      });
    });
  });
});