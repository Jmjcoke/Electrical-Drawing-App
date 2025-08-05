# 3. Detailed Component Architecture

## 3.1 Frontend Architecture

### 3.1.1 Technology Stack
```typescript
// Core Technologies
- React 18.2+ (Concurrent Features)
- TypeScript 5.0+ (Strict Type Checking)
- Material-UI 5.0+ (Component Library)
- React Query 4.0+ (Server State Management)
- React Router 6.0+ (Client-side Routing)
- PDF.js 3.0+ (PDF Rendering)
- Socket.io-client (Real-time Communication)
```

### 3.1.2 Component Structure
```
src/
├── components/
│   ├── upload/
│   │   ├── FileUpload.tsx
│   │   ├── FilePreview.tsx
│   │   └── ProgressIndicator.tsx
│   ├── analysis/
│   │   ├── QueryInterface.tsx
│   │   ├── ResponseDisplay.tsx
│   │   └── ModelComparison.tsx
│   ├── schematic/
│   │   ├── SchematicViewer.tsx
│   │   └── ComponentHighlight.tsx
│   └── common/
│       ├── ErrorBoundary.tsx
│       ├── LoadingSpinner.tsx
│       └── Toast.tsx
├── services/
│   ├── api.ts
│   ├── websocket.ts
│   └── pdf.ts
├── hooks/
│   ├── useFileUpload.ts
│   ├── useAnalysis.ts
│   └── useWebSocket.ts
├── types/
│   ├── api.ts
│   ├── analysis.ts
│   └── components.ts
└── utils/
    ├── validation.ts
    ├── formatting.ts
    └── constants.ts
```

### 3.1.3 State Management Architecture
```typescript
// Global State with React Query and Context
interface AppState {
  session: SessionState
  analysis: AnalysisState
  ui: UIState
}

// Session Management
interface SessionState {
  sessionId: string
  uploadedFiles: UploadedFile[]
  currentQuery: string
  queryHistory: Query[]
}

// Analysis State
interface AnalysisState {
  isProcessing: boolean
  currentResponses: ModelResponse[]
  aggregatedResult: AnalysisResult
  confidence: ConfidenceScore
}
```

## 3.2 Backend Architecture

### 3.2.1 Technology Stack
```javascript
// Core Backend Technologies
- Node.js 18+ LTS (Runtime)
- Express.js 4.18+ (Web Framework)
- TypeScript 5.0+ (Type Safety)
- PostgreSQL 15+ (Primary Database)
- Redis 7.0+ (Caching & Sessions)
- Prisma 5.0+ (Database ORM)
- Bull 4.0+ (Job Queue)
- Socket.io (WebSocket Server)
```

### 3.2.2 Service Architecture
```
backend/
├── services/
│   ├── file-processor/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   └── utils/
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── llm-orchestrator/
│   │   ├── src/
│   │   │   ├── providers/
│   │   │   ├── ensemble/
│   │   │   └── consensus/
│   │   └── config/
│   ├── response-aggregator/
│   │   ├── src/
│   │   │   ├── aggregation/
│   │   │   ├── ranking/
│   │   │   └── confidence/
│   │   └── algorithms/
│   └── session-manager/
│       ├── src/
│       │   ├── session/
│       │   ├── cache/
│       │   └── cleanup/
│       └── policies/
├── shared/
│   ├── types/
│   ├── utils/
│   ├── config/
│   └── middleware/
└── infrastructure/
    ├── kubernetes/
    ├── docker/
    └── monitoring/
```

### 3.2.3 Database Schema Design
```sql
-- Core Tables
CREATE SCHEMA electrical_analysis;

-- Sessions table for temporary session management
CREATE TABLE electrical_analysis.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'active'
);

-- Documents table for uploaded files
CREATE TABLE electrical_analysis.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES electrical_analysis.sessions(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_status VARCHAR(20) DEFAULT 'uploaded',
    file_path TEXT NOT NULL,
    metadata JSONB
);

-- Queries table for user questions
CREATE TABLE electrical_analysis.queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES electrical_analysis.sessions(id) ON DELETE CASCADE,
    document_id UUID REFERENCES electrical_analysis.documents(id),
    query_text TEXT NOT NULL,
    query_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_time_ms INTEGER,
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    metadata JSONB
);

-- Model responses for ensemble tracking
CREATE TABLE electrical_analysis.model_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID REFERENCES electrical_analysis.queries(id) ON DELETE CASCADE,
    model_name VARCHAR(50) NOT NULL,
    model_version VARCHAR(20),
    response_text TEXT NOT NULL,
    confidence_score DECIMAL(3,2),
    api_response_time_ms INTEGER,
    api_cost_usd DECIMAL(8,4),
    tokens_used INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);

-- Component identifications
CREATE TABLE electrical_analysis.component_identifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID REFERENCES electrical_analysis.queries(id) ON DELETE CASCADE,
    component_type VARCHAR(100) NOT NULL,
    component_description TEXT,
    location_x DECIMAL(6,2),
    location_y DECIMAL(6,2),
    confidence_score DECIMAL(3,2),
    model_consensus JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics and metrics
CREATE TABLE electrical_analysis.analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES electrical_analysis.sessions(id),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sessions_expires_at ON electrical_analysis.sessions(expires_at);
CREATE INDEX idx_documents_session_id ON electrical_analysis.documents(session_id);
CREATE INDEX idx_queries_session_id ON electrical_analysis.queries(session_id);
CREATE INDEX idx_model_responses_query_id ON electrical_analysis.model_responses(query_id);
CREATE INDEX idx_analytics_events_timestamp ON electrical_analysis.analytics_events(timestamp);
```

## 3.3 LLM Integration Architecture

### 3.3.1 Multi-Provider Integration Pattern
```typescript
// Abstract LLM Provider Interface
interface LLMProvider {
  name: string
  version: string
  analyze(image: Buffer, prompt: string, options?: AnalysisOptions): Promise<LLMResponse>
  healthCheck(): Promise<boolean>
  getRateLimit(): RateLimitInfo
  getCost(tokens: number): number
}

// Provider Implementations
class OpenAIProvider implements LLMProvider {
  private client: OpenAI
  name = 'gpt-4-vision-preview'
  version = '0613'
  
  async analyze(image: Buffer, prompt: string): Promise<LLMResponse> {
    const base64Image = image.toString('base64')
    const response = await this.client.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` }}
        ]
      }],
      max_tokens: 4096,
      temperature: 0.1
    })
    
    return this.parseResponse(response)
  }
}

class AnthropicProvider implements LLMProvider {
  private client: Anthropic
  name = 'claude-3-5-sonnet'
  version = '20241022'
  
  async analyze(image: Buffer, prompt: string): Promise<LLMResponse> {
    const base64Image = image.toString('base64')
    const response = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image }}
        ]
      }]
    })
    
    return this.parseResponse(response)
  }
}

// Ensemble Orchestrator
class LLMEnsemble {
  private providers: LLMProvider[]
  private circuitBreaker: CircuitBreaker
  
  async analyzeWithEnsemble(image: Buffer, prompt: string): Promise<EnsembleResponse> {
    const promises = this.providers.map(provider => 
      this.executeWithCircuitBreaker(provider, image, prompt)
    )
    
    const responses = await Promise.allSettled(promises)
    return this.buildConsensus(responses)
  }
  
  private buildConsensus(responses: PromiseSettledResult<LLMResponse>[]): EnsembleResponse {
    const successfulResponses = responses
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<LLMResponse>).value)
    
    return {
      consensus: this.calculateConsensus(successfulResponses),
      individual: successfulResponses,
      confidence: this.calculateConfidence(successfulResponses),
      aggregated: this.aggregateResponses(successfulResponses)
    }
  }
}
```

### 3.3.2 Circuit Breaker and Resilience Pattern
```typescript
// Circuit Breaker Implementation
class CircuitBreaker {
  private failureCount = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  private nextAttempt = 0
  
  constructor(
    private failureThreshold = 5,
    private recoveryTimeout = 30000,
    private timeout = 15000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN')
      }
      this.state = 'HALF_OPEN'
    }
    
    try {
      const result = await Promise.race([
        operation(),
        this.timeoutPromise()
      ])
      
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }
  
  private onSuccess(): void {
    this.failureCount = 0
    this.state = 'CLOSED'
  }
  
  private onFailure(): void {
    this.failureCount++
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN'
      this.nextAttempt = Date.now() + this.recoveryTimeout
    }
  }
}
```

---
