/**
 * Unit tests for ContextDebugger service
 */

import { ContextDebuggerService, ContextDebuggerConfig } from '../ContextDebugger';
import type { ConversationContext } from '../../../../../shared/types/context';

describe('ContextDebuggerService', () => {
  let debuggerService: ContextDebuggerService;
  let config: ContextDebuggerConfig;

  beforeEach(() => {
    config = {
      maxDebugSessions: 10,
      maxOperationsPerSession: 100,
      enableDetailedLogging: false, // Disable for tests
      performanceThresholds: {
        slowOperationMs: 200,
        criticalOperationMs: 500
      }
    };

    debuggerService = new ContextDebuggerService(config);
  });

  describe('debug session management', () => {
    it('should start a debug session', () => {
      const sessionId = 'session-123';
      
      const debugSessionId = debuggerService.startDebugSession(sessionId);
      
      expect(debugSessionId).toBe(sessionId);
      
      const session = debuggerService.getDebugSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.isActive).toBe(true);
    });

    it('should stop a debug session', () => {
      const sessionId = 'session-123';
      
      debuggerService.startDebugSession(sessionId);
      debuggerService.stopDebugSession(sessionId);
      
      const session = debuggerService.getDebugSession(sessionId);
      expect(session?.isActive).toBe(false);
    });

    it('should limit the number of concurrent debug sessions', () => {
      const limitedConfig = { ...config, maxDebugSessions: 2 };
      const limitedService = new ContextDebuggerService(limitedConfig);
      
      limitedService.startDebugSession('session-1');
      limitedService.startDebugSession('session-2');
      limitedService.startDebugSession('session-3'); // Should evict oldest
      
      const activeSessions = limitedService.getActiveDebugSessions();
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.some(s => s.sessionId === 'session-1')).toBe(false);
    });

    it('should get active debug sessions', () => {
      debuggerService.startDebugSession('session-1');
      debuggerService.startDebugSession('session-2');
      debuggerService.stopDebugSession('session-1');
      
      const activeSessions = debuggerService.getActiveDebugSessions();
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].sessionId).toBe('session-2');
    });
  });

  describe('operation recording', () => {
    it('should record operation debug information', () => {
      const sessionId = 'session-123';
      const contextId = 'context-456';
      
      debuggerService.startDebugSession(sessionId);
      debuggerService.recordOperation(
        sessionId,
        contextId,
        'context_retrieval',
        { query: 'test query' },
        { result: 'test result' },
        150,
        [],
        ['minor warning']
      );
      
      const session = debuggerService.getDebugSession(sessionId);
      expect(session?.operations).toHaveLength(1);
      
      const operation = session?.operations[0];
      expect(operation?.operation).toBe('context_retrieval');
      expect(operation?.executionTimeMs).toBe(150);
      expect(operation?.warnings).toEqual(['minor warning']);
    });

    it('should not record operations for inactive sessions', () => {
      const sessionId = 'session-123';
      
      debuggerService.recordOperation(
        sessionId,
        'context-456',
        'test_operation',
        {},
        {},
        100
      );
      
      const session = debuggerService.getDebugSession(sessionId);
      expect(session).toBeNull();
    });

    it('should limit operations per session', () => {
      const limitedConfig = { ...config, maxOperationsPerSession: 2 };
      const limitedService = new ContextDebuggerService(limitedConfig);
      const sessionId = 'session-123';
      
      limitedService.startDebugSession(sessionId);
      
      // Record 3 operations (should keep only last 2)
      limitedService.recordOperation(sessionId, 'ctx-1', 'op1', {}, {}, 100);
      limitedService.recordOperation(sessionId, 'ctx-1', 'op2', {}, {}, 100);
      limitedService.recordOperation(sessionId, 'ctx-1', 'op3', {}, {}, 100);
      
      const session = limitedService.getDebugSession(sessionId);
      expect(session?.operations).toHaveLength(2);
      expect(session?.operations.map(op => op.operation)).toEqual(['op2', 'op3']);
    });
  });

  describe('context diagnostics', () => {
    it('should diagnose healthy context', () => {
      const context = createMockContext();
      
      const diagnostics = debuggerService.diagnoseContext(context);
      
      expect(diagnostics.health.score).toBeGreaterThan(80);
      expect(diagnostics.health.issues).toHaveLength(0);
      expect(diagnostics.structure.turnCount).toBe(1);
      expect(diagnostics.recommendations).toContain('Context is performing well - continue monitoring');
    });

    it('should detect context structure issues', () => {
      const context = createMockContext();
      context.conversationThread[0].turnNumber = 5; // Wrong turn number
      
      const diagnostics = debuggerService.diagnoseContext(context);
      
      expect(diagnostics.health.score).toBeLessThan(100);
      expect(diagnostics.health.issues.some(issue => issue.includes('Turn sequence error'))).toBe(true);
    });

    it('should detect expired contexts', () => {
      const context = createMockContext();
      context.expiresAt = new Date(Date.now() - 1000); // Expired
      
      const diagnostics = debuggerService.diagnoseContext(context);
      
      expect(diagnostics.health.score).toBeLessThan(70);
      expect(diagnostics.health.issues.some(issue => issue.includes('expired'))).toBe(true);
    });

    it('should analyze performance from debug operations', () => {
      const sessionId = 'session-123';
      const contextId = 'context-456';
      const context = createMockContext();
      
      debuggerService.startDebugSession(sessionId);
      debuggerService.recordOperation(sessionId, contextId, 'retrieval', {}, {}, 300);
      debuggerService.recordOperation(sessionId, contextId, 'enhancement', {}, {}, 200);
      
      const diagnostics = debuggerService.diagnoseContext(context, true);
      
      expect(diagnostics.performance.avgOperationTime).toBe(250);
      expect(diagnostics.performance.slowestOperations).toHaveLength(2);
    });
  });

  describe('context validation', () => {
    it('should validate healthy context', () => {
      const context = createMockContext();
      
      const validation = debuggerService.validateContextIntegrity(context);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing context ID', () => {
      const context = createMockContext();
      (context as any).id = null;
      
      const validation = debuggerService.validateContextIntegrity(context);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('Invalid context ID'))).toBe(true);
      expect(validation.detailedFindings.structuralIssues).toContain('Context ID is missing or invalid');
    });

    it('should detect turn sequence issues', () => {
      const context = createMockContext();
      context.conversationThread.push({
        ...context.conversationThread[0],
        id: 'turn-2',
        turnNumber: 5 // Should be 2
      });
      
      const validation = debuggerService.validateContextIntegrity(context);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('sequence is not continuous'))).toBe(true);
    });

    it('should detect timestamp ordering issues', () => {
      const context = createMockContext();
      const pastTime = new Date(Date.now() - 10000);
      const futureTime = new Date(Date.now() + 10000);
      
      context.conversationThread[0].timestamp = futureTime;
      context.conversationThread.push({
        ...context.conversationThread[0],
        id: 'turn-2',
        turnNumber: 2,
        timestamp: pastTime // Earlier than first turn
      });
      
      const validation = debuggerService.validateContextIntegrity(context);
      
      expect(validation.warnings.some(warning => warning.includes('timestamp is earlier'))).toBe(true);
    });

    it('should detect performance warnings', () => {
      const context = createMockContext();
      // Add many large turns
      for (let i = 0; i < 5; i++) {
        const largeTurn = {
          ...context.conversationThread[0],
          id: `turn-${i + 2}`,
          turnNumber: i + 2,
          query: {
            ...context.conversationThread[0].query,
            originalText: 'x'.repeat(10000) // Very large text
          }
        };
        context.conversationThread.push(largeTurn);
      }
      
      const validation = debuggerService.validateContextIntegrity(context);
      
      expect(validation.detailedFindings.performanceWarnings.some(
        warning => warning.includes('turn data compression')
      )).toBe(true);
    });
  });

  describe('query flow tracing', () => {
    it('should trace query flow through operations', () => {
      const sessionId = 'session-123';
      const queryId = 'query-456';
      
      debuggerService.startDebugSession(sessionId);
      debuggerService.recordOperation(
        sessionId,
        'ctx-1',
        'query_processing',
        { queryId },
        { processed: true },
        100
      );
      debuggerService.recordOperation(
        sessionId,
        'ctx-1',
        'context_retrieval',
        { queryId },
        { context: 'retrieved' },
        150
      );
      
      const trace = debuggerService.traceQueryFlow(sessionId, queryId);
      
      expect(trace.queryId).toBe(queryId);
      expect(trace.operations).toHaveLength(2);
      expect(trace.totalTimeMs).toBe(250);
      expect(trace.flowSummary).toEqual([
        'query_processing (100ms)',
        'context_retrieval (150ms)'
      ]);
    });

    it('should handle tracing with errors', () => {
      const sessionId = 'session-123';
      const queryId = 'query-456';
      
      debuggerService.startDebugSession(sessionId);
      debuggerService.recordOperation(
        sessionId,
        'ctx-1',
        'query_processing',
        { queryId },
        {},
        100,
        ['Processing failed']
      );
      
      const trace = debuggerService.traceQueryFlow(sessionId, queryId);
      
      expect(trace.errors).toEqual(['Processing failed']);
      expect(trace.flowSummary[0]).toContain('[ERROR]');
    });

    it('should handle tracing non-existent queries', () => {
      const sessionId = 'session-123';
      const queryId = 'non-existent';
      
      debuggerService.startDebugSession(sessionId);
      
      const trace = debuggerService.traceQueryFlow(sessionId, queryId);
      
      expect(trace.operations).toHaveLength(0);
      expect(trace.totalTimeMs).toBe(0);
    });
  });

  describe('debug data export', () => {
    it('should export debug data for all sessions', () => {
      const sessionId1 = 'session-1';
      const sessionId2 = 'session-2';
      
      debuggerService.startDebugSession(sessionId1);
      debuggerService.startDebugSession(sessionId2);
      debuggerService.recordOperation(sessionId1, 'ctx-1', 'op1', {}, {}, 100);
      debuggerService.recordOperation(sessionId2, 'ctx-2', 'op2', {}, {}, 200);
      
      const exportData = debuggerService.exportDebugData();
      
      expect(exportData.sessions).toHaveLength(2);
      expect(exportData.operations).toHaveLength(2);
      expect(exportData.summary.totalOperations).toBe(2);
      expect(exportData.summary.avgOperationTime).toBe(150);
    });

    it('should export debug data for specific session', () => {
      const sessionId1 = 'session-1';
      const sessionId2 = 'session-2';
      
      debuggerService.startDebugSession(sessionId1);
      debuggerService.startDebugSession(sessionId2);
      debuggerService.recordOperation(sessionId1, 'ctx-1', 'op1', {}, {}, 100);
      debuggerService.recordOperation(sessionId2, 'ctx-2', 'op2', {}, {}, 200);
      
      const exportData = debuggerService.exportDebugData(sessionId1);
      
      expect(exportData.sessions).toHaveLength(1);
      expect(exportData.operations).toHaveLength(1);
      expect(exportData.operations[0].operation).toBe('op1');
    });

    it('should calculate summary statistics correctly', () => {
      const sessionId = 'session-123';
      
      debuggerService.startDebugSession(sessionId);
      debuggerService.recordOperation(sessionId, 'ctx-1', 'op1', {}, {}, 100);
      debuggerService.recordOperation(sessionId, 'ctx-1', 'op1', {}, {}, 200);
      debuggerService.recordOperation(sessionId, 'ctx-1', 'op2', {}, {}, 150, ['error']);
      
      const exportData = debuggerService.exportDebugData();
      
      expect(exportData.summary.avgOperationTime).toBe(150);
      expect(exportData.summary.errorRate).toBeCloseTo(0.333, 2);
      expect(exportData.summary.mostCommonOperations).toEqual([
        { operation: 'op1', count: 2 },
        { operation: 'op2', count: 1 }
      ]);
    });
  });
});

// Helper function to create mock conversation context
function createMockContext(): ConversationContext {
  return {
    id: 'context-123',
    sessionId: 'session-456',
    conversationThread: [
      {
        id: 'turn-1',
        turnNumber: 1,
        query: {
          id: 'query-1',
          originalText: 'What is this component?',
          cleanedText: 'What is this component?',
          intent: { type: 'component_identification', confidence: 0.9, reasoning: 'Direct component question' },
          intentConfidence: 0.9,
          entities: [
            {
              text: 'component',
              type: 'component',
              confidence: 0.8,
              position: { start: 13, end: 22 },
              metadata: {}
            }
          ],
          context: {
            sessionHistory: [],
            documentContext: [],
            previousQueries: [],
            conversationFlow: [],
            extractedTopics: []
          },
          optimizedPrompts: {},
          processingMetadata: {
            processingTime: 100,
            stagesCompleted: ['cleaning', 'intent', 'entity'],
            warnings: [],
            debug: {}
          },
          timestamp: new Date()
        },
        response: {
          summary: 'This appears to be a resistor',
          components: [],
          confidence: { overall: 0.8, breakdown: {}, reasoning: 'High confidence match' },
          consensus: { agreementLevel: 0.9, conflictingResponses: [], consensusResponse: 'Resistor identified' }
        },
        contextContributions: ['entity:component:component'],
        followUpDetected: false,
        timestamp: new Date()
      }
    ],
    cumulativeContext: {
      extractedEntities: new Map([['component:component', [{
        text: 'component',
        type: 'component',
        confidence: 0.8,
        context: 'What is this component?',
        turnId: 'turn-1',
        position: 13,
        firstMentioned: new Date(),
        mentions: 1
      }]]]),
      documentContext: [],
      topicProgression: [],
      keyInsights: ['This appears to be a resistor'],
      relationshipMap: []
    },
    lastUpdated: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    metadata: {
      createdAt: new Date(),
      lastAccessed: new Date(),
      accessCount: 1,
      compressionLevel: 0,
      tags: []
    }
  };
}