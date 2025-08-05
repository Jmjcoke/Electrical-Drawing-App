import type { HighlightReference } from './highlighting.types';
import type { UploadedFile } from './api';

export interface Query {
  id: string;
  text: string;
  type: 'component_identification' | 'general_question' | 'schematic_analysis';
  timestamp: Date;
  documentIds: string[];
  responses: ModelResponse[];
  aggregatedResult?: AnalysisResult;
  highlights?: QueryHighlights;
}

export interface ModelResponse {
  id: string;
  modelName: string;
  modelVersion: string;
  responseText: string;
  responseStructured?: any;
  confidenceScore: number;
  responseTime: number;
  cost?: number;
  tokensUsed?: number;
}

export interface AnalysisResult {
  summary: string;
  components: ComponentIdentification[];
  confidence: ConfidenceScore;
  consensus: ModelConsensus;
}

export interface ComponentIdentification {
  id: string;
  type: string;
  description: string;
  location: {
    x: number;
    y: number;
    page: number;
  };
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  properties: Record<string, any>;
}

export interface ConfidenceScore {
  overall: number;
  agreement: number;
  completeness: number;
  consistency: number;
  factors: {
    modelConsensus: number;
    responseQuality: number;
    logicalConsistency: number;
    coverage: number;
    uncertainty: number;
  };
}

export interface ModelConsensus {
  agreementLevel: number;
  conflictingResponses: ModelResponse[];
  consensusResponse: string;
}

export interface QueryHighlights {
  highlightIds: string[];
  suggestedHighlights: string[];
  activeComponents: string[];
  contextualReferences: HighlightReference[];
}

export interface SessionHighlightContext {
  persistentHighlights: string[];
  activeHighlights: string[];
  highlightHistory: QueryHighlights[];
  contextualSuggestions: ComponentSuggestion[];
  lastUpdated: Date;
}

export interface ComponentSuggestion {
  componentId: string;
  componentType: string;
  confidence: number;
  source: 'history' | 'context' | 'semantic';
  reasoning: string;
}

export interface SessionState {
  sessionId: string;
  uploadedFiles: UploadedFile[];
  currentQuery: string;
  queryHistory: Query[];
  highlightContext?: SessionHighlightContext;
}

export interface ChatUIState {
  isTyping: boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  messageActions: {
    selectedMessageId?: string;
    showCopyFeedback: boolean;
  };
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  query?: Query;
  isTyping?: boolean;
  error?: string;
}

export interface ChatWebSocketEvents {
  // Client to Server
  'join-session': { sessionId: string };
  'start-query': { queryId: string; queryText: string; documentIds: string[] };
  'typing-start': { sessionId: string };
  'typing-stop': { sessionId: string };
  'highlight-query-link': { queryId: string; highlightIds: string[] };
  'request-highlight-suggestions': { sessionId: string; currentQuery: string };
  
  // Server to Client
  'query-progress': { queryId: string; stage: string; progress: number };
  'query-response': { queryId: string; response: AnalysisResult; suggestedHighlights?: string[] };
  'typing-indicator': { sessionId: string; isTyping: boolean };
  'session-updated': { sessionId: string; queryHistory: Query[] };
  'highlight-suggestions': { sessionId: string; suggestions: ComponentSuggestion[] };
  'highlight-context-updated': { sessionId: string; context: SessionHighlightContext };
}

export interface AutocompleteOption {
  label: string;
  category: 'suggested' | 'history' | 'template';
  value: string;
}

// Re-export from api.ts for convenience
export type { UploadedFile } from './api';

// Import highlighting types for integration
export type { HighlightReference } from './highlighting.types';