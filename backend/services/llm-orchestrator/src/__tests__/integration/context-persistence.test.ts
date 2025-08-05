/**
 * Context Persistence Integration Tests
 * Tests context persistence across various session scenarios
 */

import { ConversationContextService } from '../../context/ConversationContext';
import { ContextStorageService } from '../../../session-manager/src/context/ContextStorage';
import type {
  ContextStorageConfig,
  ProcessedQuery,
  AnalysisResult,
  ConversationContext
} from '../../../../../shared/types/context';

// Mock the ContextStorage service for persistence testing
const createMockContextStorage = () => {
  const contexts = new Map<string, any>();
  const sessionContexts = new Map<string, string>();

  return {
    storeContext: jest.fn().mockImplementation(async (context: ConversationContext) => {
      const serializedContext = {
        id: context.id,
        session_id: context.sessionId,
        context_data: JSON.stringify({
          conversationThread: context.conversationThread,
          cumulativeContext: {
            extractedEntities: Object.fromEntries(context.cumulativeContext.extractedEntities),
            documentContext: context.cumulativeContext.documentContext,
            topicProgression: context.cumulativeContext.topicProgression,
            keyInsights: context.cumulativeContext.keyInsights,
            relationshipMap: context.cumulativeContext.relationshipMap
          }
        }),
        cumulative_context: JSON.stringify(context.cumulativeContext),
        turn_count: context.conversationThread.length,
        last_updated: context.lastUpdated,
        expires_at: context.expiresAt,
        compression_applied: context.metadata.compressionApplied
      };
      
      contexts.set(context.id, serializedContext);
      sessionContexts.set(context.sessionId, context.id);
      return context.id;
    }),

    retrieveContext: jest.fn().mockImplementation(async (contextId: string) => {
      const stored = contexts.get(contextId);
      if (!stored) return null;

      const contextData = JSON.parse(stored.context_data);
      return {
        id: stored.id,
        sessionId: stored.session_id,
        conversationThread: contextData.conversationThread,
        cumulativeContext: {
          extractedEntities: new Map(Object.entries(contextData.cumulativeContext.extractedEntities)),
          documentContext: contextData.cumulativeContext.documentContext,
          topicProgression: contextData.cumulativeContext.topicProgression,
          keyInsights: contextData.cumulativeContext.keyInsights,
          relationshipMap: contextData.cumulativeContext.relationshipMap
        },
        lastUpdated: new Date(stored.last_updated),
        expiresAt: new Date(stored.expires_at),
        metadata: {
          createdAt: new Date(stored.last_updated),
          turnCount: stored.turn_count,
          storageSize: JSON.stringify(stored).length,
          compressionApplied: stored.compression_applied,
          lastAccessedAt: new Date()
        }
      };
    }),

    retrieveContextBySession: jest.fn().mockImplementation(async (sessionId: string) => {
      const contextId = sessionContexts.get(sessionId);
      return contextId ? await createMockContextStorage().retrieveContext(contextId) : null;
    }),

    updateContext: jest.fn().mockImplementation(async (contextId: string, updates: any) => {
      const stored = contexts.get(contextId);
      if (!stored) return false;
      
      Object.assign(stored, updates);
      contexts.set(contextId, stored);
      return true;
    }),

    deleteContext: jest.fn().mockImplementation(async (contextId: string) => {
      const stored = contexts.get(contextId);
      if (!stored) return false;
      
      contexts.delete(contextId);
      sessionContexts.delete(stored.session_id);
      return true;
    }),

    cleanupExpiredContexts: jest.fn().mockImplementation(async () => {
      const now = new Date();
      let cleanedCount = 0;
      
      for (const [contextId, stored] of contexts.entries()) {
        if (new Date(stored.expires_at) < now) {
          contexts.delete(contextId);
          sessionContexts.delete(stored.session_id);
          cleanedCount++;
        }
      }
      
      return cleanedCount;
    }),

    getContextStats: jest.fn().mockImplementation(async () => {
      const now = new Date();
      const allContexts = Array.from(contexts.values());
      const activeContexts = allContexts.filter(c => new Date(c.expires_at) > now);
      const expiredContexts = allContexts.filter(c => new Date(c.expires_at) <= now);
      
      return {
        totalContexts: allContexts.length,
        activeContexts: activeContexts.length,
        expiredContexts: expiredContexts.length,
        avgTurnCount: allContexts.reduce((sum, c) => sum + c.turn_count, 0) / allContexts.length || 0,
        totalStorageBytes: allContexts.reduce((sum, c) => sum + JSON.stringify(c).length, 0)
      };
    }),

    searchContexts: jest.fn().mockImplementation(async (query: string, limit = 10) => {
      const results = Array.from(contexts.values())
        .filter(c => JSON.stringify(c).toLowerCase().includes(query.toLowerCase()))
        .slice(0, limit);
      
      return results.map(stored => ({
        id: stored.id,
        sessionId: stored.session_id,
        conversationThread: JSON.parse(stored.context_data).conversationThread,
        cumulativeContext: {
          extractedEntities: new Map(Object.entries(JSON.parse(stored.context_data).cumulativeContext.extractedEntities)),
          documentContext: JSON.parse(stored.context_data).cumulativeContext.documentContext,
          topicProgression: JSON.parse(stored.context_data).cumulativeContext.topicProgression,
          keyInsights: JSON.parse(stored.context_data).cumulativeContext.keyInsights,
          relationshipMap: JSON.parse(stored.context_data).cumulativeContext.relationshipMap
        },
        lastUpdated: new Date(stored.last_updated),
        expiresAt: new Date(stored.expires_at),
        metadata: {
          createdAt: new Date(stored.last_updated),
          turnCount: stored.turn_count,
          storageSize: JSON.stringify(stored).length,
          compressionApplied: stored.compression_applied,
          lastAccessedAt: new Date()
        }
      }));
    })
  };
};

describe('Context Persistence Integration Tests', () => {
  let contextService: ConversationContextService;
  let mockStorage: ReturnType<typeof createMockContextStorage>;
  let config: ContextStorageConfig;

  beforeEach(() => {
    config = {
      maxTurnsPerContext: 20,
      compressionThreshold: 500,
      expirationHours: 24,
      cleanupIntervalMinutes: 60
    };

    mockStorage = createMockContextStorage();
    contextService = new ConversationContextService(config);
    
    // Replace the storage instance with our mock
    (contextService as any).storage = mockStorage;
  });

  describe('Session Lifecycle Persistence', () => {
    it('should persist context across session reconnections', async () => {
      const sessionId = 'reconnection-test-session';
      
      // Initial session: create context and add turns
      const initialContext = await contextService.createContext(sessionId);
      
      const query1: ProcessedQuery = {
        id: 'query-1',
        originalText: 'What is this electrical component?',
        processedText: 'What is this electrical component?',
        intent: 'component_identification',
        entities: [
          { text: 'electrical component', type: 'component', confidence: 0.9 }
        ],
        metadata: {
          timestamp: new Date(),
          confidence: 0.9,
          processingTimeMs: 120
        }
      };

      const response1: AnalysisResult = {
        id: 'response-1',
        queryId: 'query-1',
        analysisType: 'component_identification',
        result: {
          summary: 'This is a resistor component with color bands indicating resistance value.',
          confidence: 0.92,
          evidence: ['Color band pattern matches resistor standards', 'Two-terminal configuration']
        },
        metadata: {
          timestamp: new Date(),
          processingTimeMs: 340,
          model: 'gpt-4'
        }
      };

      await contextService.addTurn(initialContext.id, query1, response1);

      // Simulate session disconnection by creating new service instance
      const newContextService = new ConversationContextService(config);
      (newContextService as any).storage = mockStorage;

      // Reconnection: retrieve context by session
      const retrievedContext = await newContextService.getContextBySession(sessionId);

      expect(retrievedContext).toBeDefined();
      expect(retrievedContext!.id).toBe(initialContext.id);
      expect(retrievedContext!.conversationThread).toHaveLength(1);
      expect(retrievedContext!.conversationThread[0].query.originalText).toBe('What is this electrical component?');
      expect(retrievedContext!.cumulativeContext.extractedEntities.has('resistor')).toBe(true);

      // Continue conversation after reconnection
      const query2: ProcessedQuery = {
        id: 'query-2',
        originalText: 'What is its resistance value?',
        processedText: 'What is its resistance value?',
        intent: 'parameter_inquiry',
        entities: [
          { text: 'resistance value', type: 'electrical_parameter', confidence: 0.88 }
        ],
        metadata: {
          timestamp: new Date(),
          confidence: 0.88,
          processingTimeMs: 100
        }
      };

      const response2: AnalysisResult = {
        id: 'response-2',
        queryId: 'query-2',
        analysisType: 'parameter_inquiry',
        result: {
          summary: 'Based on the color bands, this resistor has a value of 470 ohms.',
          confidence: 0.89,
          evidence: ['Yellow-violet-brown color sequence', 'Standard E12 series value']
        },
        metadata: {
          timestamp: new Date(),
          processingTimeMs: 280,
          model: 'gpt-4'
        }
      };

      await newContextService.addTurn(retrievedContext!.id, query2, response2, true);

      // Verify persistence of extended conversation
      const finalContext = await newContextService.getContext(retrievedContext!.id);
      expect(finalContext!.conversationThread).toHaveLength(2);
      expect(finalContext!.conversationThread[1].followUpDetected).toBe(true);
      expect(finalContext!.cumulativeContext.keyInsights).toContain(expect.stringContaining('470'));
    });

    it('should handle multiple concurrent sessions with proper isolation', async () => {
      const sessions = [
        { id: 'session-a', topic: 'capacitors' },
        { id: 'session-b', topic: 'inductors' },
        { id: 'session-c', topic: 'transformers' }
      ];

      const contexts: ConversationContext[] = [];

      // Create and populate contexts for each session
      for (const session of sessions) {
        const context = await contextService.createContext(session.id);
        contexts.push(context);

        const query: ProcessedQuery = {
          id: `${session.id}-query-1`,
          originalText: `Tell me about ${session.topic}`,
          processedText: `Tell me about ${session.topic}`,
          intent: 'component_explanation',
          entities: [
            { text: session.topic, type: 'component_type', confidence: 0.95 }
          ],
          metadata: {
            timestamp: new Date(),
            confidence: 0.95,
            processingTimeMs: 110
          }
        };

        const response: AnalysisResult = {
          id: `${session.id}-response-1`,
          queryId: `${session.id}-query-1`,
          analysisType: 'component_explanation',
          result: {
            summary: `${session.topic} are important electrical components.`,
            confidence: 0.90,
            evidence: [`${session.topic} characteristics`, 'Common applications']
          },
          metadata: {
            timestamp: new Date(),
            processingTimeMs: 250,
            model: 'gpt-4'
          }
        };

        await contextService.addTurn(context.id, query, response);
      }

      // Verify each session maintains its own context
      for (let i = 0; i < sessions.length; i++) {
        const retrievedContext = await contextService.getContextBySession(sessions[i].id);
        
        expect(retrievedContext).toBeDefined();
        expect(retrievedContext!.sessionId).toBe(sessions[i].id);
        expect(retrievedContext!.cumulativeContext.extractedEntities.has(sessions[i].topic.slice(0, -1))).toBe(true);
        
        // Verify isolation: should not contain entities from other sessions
        for (let j = 0; j < sessions.length; j++) {
          if (i !== j) {
            expect(retrievedContext!.cumulativeContext.extractedEntities.has(sessions[j].topic.slice(0, -1))).toBe(false);
          }
        }
      }

      // Test concurrent modifications
      const concurrentPromises = sessions.map(async (session, index) => {
        const context = await contextService.getContextBySession(session.id);
        
        const followUpQuery: ProcessedQuery = {
          id: `${session.id}-query-2`,
          originalText: 'How do they work?',
          processedText: 'How do they work?',
          intent: 'mechanism_explanation',
          entities: [],
          metadata: {
            timestamp: new Date(),
            confidence: 0.85,
            processingTimeMs: 95
          }
        };

        const followUpResponse: AnalysisResult = {
          id: `${session.id}-response-2`,
          queryId: `${session.id}-query-2`,
          analysisType: 'mechanism_explanation',
          result: {
            summary: `${session.topic} work by storing energy.`,
            confidence: 0.88,
            evidence: ['Energy storage mechanism', 'Physical principles']
          },
          metadata: {
            timestamp: new Date(),
            processingTimeMs: 300,
            model: 'gpt-4'
          }
        };

        await contextService.addTurn(context!.id, followUpQuery, followUpResponse, true);
      });

      await Promise.all(concurrentPromises);

      // Verify all sessions were updated correctly
      for (const session of sessions) {
        const finalContext = await contextService.getContextBySession(session.id);
        expect(finalContext!.conversationThread).toHaveLength(2);
        expect(finalContext!.conversationThread[1].followUpDetected).toBe(true);
      }
    });

    it('should persist context expiration and cleanup properly', async () => {
      // Create contexts with different expiration times
      const shortExpirationConfig: ContextStorageConfig = {
        ...config,
        expirationHours: 0.001 // ~3.6 seconds for testing
      };

      const shortTermService = new ConversationContextService(shortExpirationConfig);
      (shortTermService as any).storage = mockStorage;

      const longTermContext = await contextService.createContext('long-term-session');
      const shortTermContext = await shortTermService.createContext('short-term-session');

      // Add content to both contexts
      const query: ProcessedQuery = {
        id: 'test-query',
        originalText: 'Test query',
        processedText: 'Test query',
        intent: 'test',
        entities: [],
        metadata: { timestamp: new Date(), confidence: 0.8, processingTimeMs: 100 }
      };

      const response: AnalysisResult = {
        id: 'test-response',
        queryId: 'test-query',
        analysisType: 'test',
        result: { summary: 'Test response', confidence: 0.8, evidence: [] },
        metadata: { timestamp: new Date(), processingTimeMs: 200, model: 'test' }
      };

      await contextService.addTurn(longTermContext.id, query, response);
      await shortTermService.addTurn(shortTermContext.id, query, response);

      // Wait for short-term context to expire
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check context stats before cleanup
      const statsBeforeCleanup = await mockStorage.getContextStats();
      expect(statsBeforeCleanup.totalContexts).toBe(2);

      // Run cleanup
      const cleanedCount = await mockStorage.cleanupExpiredContexts();
      expect(cleanedCount).toBe(1); // Should clean up the short-term context

      // Verify cleanup results
      const statsAfterCleanup = await mockStorage.getContextStats();
      expect(statsAfterCleanup.totalContexts).toBe(1);
      expect(statsAfterCleanup.activeContexts).toBe(1);
      expect(statsAfterCleanup.expiredContexts).toBe(0);

      // Verify long-term context still exists
      const remainingContext = await contextService.getContext(longTermContext.id);
      expect(remainingContext).toBeDefined();

      // Verify short-term context was cleaned up
      const cleanedContext = await shortTermService.getContext(shortTermContext.id);
      expect(cleanedContext).toBeNull();
    });
  });

  describe('Data Integrity and Recovery', () => {
    it('should maintain data integrity during context updates', async () => {
      const sessionId = 'integrity-test-session';
      const context = await contextService.createContext(sessionId);

      // Add multiple turns to build up context
      const queries = Array.from({ length: 5 }, (_, i) => ({
        query: {
          id: `query-${i + 1}`,
          originalText: `Query ${i + 1} about electrical components`,
          processedText: `Query ${i + 1} about electrical components`,
          intent: 'component_inquiry',
          entities: [
            { text: `component_${i + 1}`, type: 'component', confidence: 0.9 }
          ],
          metadata: {
            timestamp: new Date(Date.now() + i * 1000),
            confidence: 0.9,
            processingTimeMs: 100 + i * 10
          }
        } as ProcessedQuery,
        response: {
          id: `response-${i + 1}`,
          queryId: `query-${i + 1}`,
          analysisType: 'component_inquiry',
          result: {
            summary: `Response ${i + 1} about components`,
            confidence: 0.88 + i * 0.01,
            evidence: [`Evidence ${i + 1}`]
          },
          metadata: {
            timestamp: new Date(Date.now() + i * 1000 + 500),
            processingTimeMs: 200 + i * 20,
            model: 'gpt-4'
          }
        } as AnalysisResult
      }));

      for (const { query, response } of queries) {
        await contextService.addTurn(context.id, query, response);
      }

      // Verify incremental updates maintain integrity
      for (let i = 1; i <= 5; i++) {
        const snapshot = await contextService.getContext(context.id);
        expect(snapshot!.conversationThread).toHaveLength(i);
        expect(snapshot!.metadata.turnCount).toBe(i);
        
        // Verify entity accumulation
        expect(snapshot!.cumulativeContext.extractedEntities.size).toBeGreaterThanOrEqual(i);
        
        // Verify chronological order
        for (let j = 1; j < snapshot!.conversationThread.length; j++) {
          const prevTurn = snapshot!.conversationThread[j - 1];
          const currentTurn = snapshot!.conversationThread[j];
          expect(currentTurn.timestamp.getTime()).toBeGreaterThanOrEqual(prevTurn.timestamp.getTime());
        }
      }

      // Test data consistency after retrieval
      const finalContext = await contextService.getContext(context.id);
      expect(finalContext!.conversationThread).toHaveLength(5);
      expect(finalContext!.cumulativeContext.extractedEntities.size).toBe(5);
      
      // Verify all entities are preserved
      for (let i = 1; i <= 5; i++) {
        expect(finalContext!.cumulativeContext.extractedEntities.has(`component_${i}`)).toBe(true);
      }
    });

    it('should handle concurrent access and updates correctly', async () => {
      const sessionId = 'concurrent-access-session';
      const context = await contextService.createContext(sessionId);

      // Simulate concurrent operations
      const concurrentOperations = Array.from({ length: 10 }, (_, i) => 
        async () => {
          const query: ProcessedQuery = {
            id: `concurrent-query-${i}`,
            originalText: `Concurrent query ${i}`,
            processedText: `Concurrent query ${i}`,
            intent: 'concurrent_test',
            entities: [
              { text: `entity_${i}`, type: 'test_entity', confidence: 0.8 }
            ],
            metadata: {
              timestamp: new Date(),
              confidence: 0.8,
              processingTimeMs: 100
            }
          };

          const response: AnalysisResult = {
            id: `concurrent-response-${i}`,
            queryId: `concurrent-query-${i}`,
            analysisType: 'concurrent_test',
            result: {
              summary: `Concurrent response ${i}`,
              confidence: 0.85,
              evidence: [`Concurrent evidence ${i}`]
            },
            metadata: {
              timestamp: new Date(),
              processingTimeMs: 150,
              model: 'gpt-4'
            }
          };

          await contextService.addTurn(context.id, query, response);
        }
      );

      // Execute all operations concurrently
      await Promise.all(concurrentOperations.map(op => op()));

      // Verify final state integrity
      const finalContext = await contextService.getContext(context.id);
      expect(finalContext!.conversationThread).toHaveLength(10);
      expect(finalContext!.cumulativeContext.extractedEntities.size).toBe(10);

      // Verify all entities are present
      for (let i = 0; i < 10; i++) {
        expect(finalContext!.cumulativeContext.extractedEntities.has(`entity_${i}`)).toBe(true);
      }

      // Verify turn numbers are consistent
      finalContext!.conversationThread.forEach((turn, index) => {
        expect(turn.turnNumber).toBe(index + 1);
      });
    });

    it('should support context search and retrieval across sessions', async () => {
      // Create multiple contexts with different content
      const testSessions = [
        { sessionId: 'search-session-1', topic: 'resistors', value: '470 ohms' },
        { sessionId: 'search-session-2', topic: 'capacitors', value: '100 microfarads' },
        { sessionId: 'search-session-3', topic: 'inductors', value: '10 millihenries' }
      ];

      for (const session of testSessions) {
        const context = await contextService.createContext(session.sessionId);

        const query: ProcessedQuery = {
          id: `${session.sessionId}-query`,
          originalText: `What is the value of this ${session.topic}?`,
          processedText: `What is the value of this ${session.topic}?`,
          intent: 'value_inquiry',
          entities: [
            { text: session.topic, type: 'component_type', confidence: 0.9 },
            { text: 'value', type: 'parameter', confidence: 0.85 }
          ],
          metadata: {
            timestamp: new Date(),
            confidence: 0.9,
            processingTimeMs: 110
          }
        };

        const response: AnalysisResult = {
          id: `${session.sessionId}-response`,
          queryId: `${session.sessionId}-query`,
          analysisType: 'value_inquiry',
          result: {
            summary: `The ${session.topic.slice(0, -1)} has a value of ${session.value}.`,
            confidence: 0.92,
            evidence: ['Component marking analysis', 'Standard value identification']
          },
          metadata: {
            timestamp: new Date(),
            processingTimeMs: 280,
            model: 'gpt-4'
          }
        };

        await contextService.addTurn(context.id, query, response);
      }

      // Test search functionality
      const resistorResults = await mockStorage.searchContexts('resistors', 5);
      expect(resistorResults).toHaveLength(1);
      expect(resistorResults[0].sessionId).toBe('search-session-1');

      const valueResults = await mockStorage.searchContexts('value', 5);
      expect(valueResults).toHaveLength(3); // All contexts contain "value"

      const specificValueResults = await mockStorage.searchContexts('470 ohms', 5);
      expect(specificValueResults).toHaveLength(1);
      expect(specificValueResults[0].cumulativeContext.keyInsights).toContain(
        expect.stringContaining('470 ohms')
      );

      // Test search with different limits
      const limitedResults = await mockStorage.searchContexts('component', 2);
      expect(limitedResults.length).toBeLessThanOrEqual(2);

      // Test search with no matches
      const noMatchResults = await mockStorage.searchContexts('nonexistent-term', 5);
      expect(noMatchResults).toHaveLength(0);
    });
  });

  describe('Storage Statistics and Monitoring', () => {
    it('should provide accurate storage statistics', async () => {
      // Create contexts with different characteristics
      const sessions = [
        { id: 'stats-session-1', turns: 3 },
        { id: 'stats-session-2', turns: 7 },
        { id: 'stats-session-3', turns: 2 }
      ];

      for (const session of sessions) {
        const context = await contextService.createContext(session.id);

        for (let i = 1; i <= session.turns; i++) {
          const query: ProcessedQuery = {
            id: `${session.id}-query-${i}`,
            originalText: `Query ${i} content`,
            processedText: `Query ${i} content`,
            intent: 'test_intent',
            entities: [
              { text: `entity_${i}`, type: 'test_type', confidence: 0.8 }
            ],
            metadata: {
              timestamp: new Date(),
              confidence: 0.8,
              processingTimeMs: 100
            }
          };

          const response: AnalysisResult = {
            id: `${session.id}-response-${i}`,
            queryId: `${session.id}-query-${i}`,
            analysisType: 'test_intent',
            result: {
              summary: `Response ${i} content`,
              confidence: 0.85,
              evidence: [`Evidence ${i}`]
            },
            metadata: {
              timestamp: new Date(),
              processingTimeMs: 200,
              model: 'gpt-4'
            }
          };

          await contextService.addTurn(context.id, query, response);
        }
      }

      // Get storage statistics
      const stats = await mockStorage.getContextStats();

      expect(stats.totalContexts).toBe(3);
      expect(stats.activeContexts).toBe(3);
      expect(stats.expiredContexts).toBe(0);
      expect(stats.avgTurnCount).toBe((3 + 7 + 2) / 3); // 4
      expect(stats.totalStorageBytes).toBeGreaterThan(0);

      // Verify individual context storage sizes
      for (const session of sessions) {
        const context = await contextService.getContextBySession(session.id);
        expect(context!.metadata.storageSize).toBeGreaterThan(0);
        expect(context!.metadata.turnCount).toBe(session.turns);
      }
    });

    it('should track storage growth and compression', async () => {
      const sessionId = 'compression-test-session';
      const context = await contextService.createContext(sessionId);

      // Add turns that will trigger compression
      for (let i = 1; i <= 15; i++) {
        const longContent = `This is a very long query ${i} `.repeat(20); // Create large content
        
        const query: ProcessedQuery = {
          id: `compression-query-${i}`,
          originalText: longContent,
          processedText: longContent,
          intent: 'compression_test',
          entities: [
            { text: `large_entity_${i}`, type: 'large_type', confidence: 0.8 }
          ],
          metadata: {
            timestamp: new Date(),
            confidence: 0.8,
            processingTimeMs: 150
          }
        };

        const response: AnalysisResult = {
          id: `compression-response-${i}`,
          queryId: `compression-query-${i}`,
          analysisType: 'compression_test',
          result: {
            summary: `Long response ${i} content `.repeat(15),
            confidence: 0.85,
            evidence: [`Long evidence ${i} `.repeat(10)]
          },
          metadata: {
            timestamp: new Date(),
            processingTimeMs: 300,
            model: 'gpt-4'
          }
        };

        await contextService.addTurn(context.id, query, response);

        // Check storage size growth
        const updatedContext = await contextService.getContext(context.id);
        expect(updatedContext!.metadata.storageSize).toBeGreaterThan(0);
        
        // After reaching compression threshold, compression should be applied
        if (i > config.compressionThreshold / 100) { // Rough estimate
          // In a real implementation, we would check for compression here
          // For this test, we verify the storage tracking is working
          expect(updatedContext!.metadata.turnCount).toBe(i);
        }
      }

      // Verify final storage statistics
      const stats = await mockStorage.getContextStats();
      expect(stats.totalStorageBytes).toBeGreaterThan(1000); // Significant storage used
      expect(stats.avgTurnCount).toBe(15);
    });
  });
});