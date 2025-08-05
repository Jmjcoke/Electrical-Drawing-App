# System Architecture Document
## LLM-Powered Electrical Drawing Analysis App

**Document Version:** 1.0  
**Date:** August 2, 2025  
**System Architect:** Winston (Holistic System Architect)  
**Status:** Technical Blueprint for Implementation  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [High-Level System Architecture](#2-high-level-system-architecture)
3. [Detailed Component Architecture](#3-detailed-component-architecture)
4. [Data Flow and Processing Pipelines](#4-data-flow-and-processing-pipelines)
5. [API Specifications and Integration Patterns](#5-api-specifications-and-integration-patterns)
6. [Deployment Architecture and Infrastructure](#6-deployment-architecture-and-infrastructure)
7. [Security Architecture and Compliance Framework](#7-security-architecture-and-compliance-framework)
8. [Monitoring and Observability Strategy](#8-monitoring-and-observability-strategy)
9. [Performance and Scalability Considerations](#9-performance-and-scalability-considerations)
10. [Implementation Roadmap](#10-implementation-roadmap)
11. [Technical Decision Rationale](#11-technical-decision-rationale)
12. [Appendices](#12-appendices)

---

## 1. Executive Summary

### 1.1 Architecture Overview
This document defines the comprehensive system architecture for the LLM-Powered Electrical Drawing Analysis App, a web-based application that leverages a multi-model ensemble approach using GPT-4V, Claude 3.5 Sonnet, and Gemini Pro for intelligent analysis of electrical drawings.

### 1.2 Core Architectural Principles
- **Microservices Architecture**: Loosely coupled services for scalability and maintainability
- **Multi-Model Ensemble**: Distributed LLM processing with consensus mechanisms
- **Cloud-Native Design**: Designed for elastic scaling and high availability
- **Security-First Approach**: Defense in depth with data protection at every layer
- **Performance Optimization**: Sub-15 second response times with 100+ concurrent users
- **Observability**: Comprehensive monitoring and analytics for system health

### 1.3 Technology Stack Summary
- **Frontend**: React 18 + TypeScript + Material-UI + PDF.js
- **Backend**: Node.js + Express.js + PostgreSQL + Redis
- **Infrastructure**: AWS/Azure/GCP with Kubernetes orchestration
- **LLM Integration**: OpenAI GPT-4V + Anthropic Claude + Google Gemini
- **Monitoring**: Prometheus + Grafana + ELK Stack

---

## 2. High-Level System Architecture

### 2.1 System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Client Layer                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Web Browser (React + TypeScript)                                      │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐          │
│  │ Upload Interface│ │ Q&A Interface   │ │ Analysis Results│          │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                              HTTPS/WebSocket
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                         API Gateway Layer                               │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐          │
│  │ Load Balancer   │ │ Rate Limiting   │ │ Authentication  │          │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐          │
│  │ Request Routing │ │ SSL Termination │ │ API Versioning  │          │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                              Service Mesh
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                      Application Services Layer                         │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐          │
│  │ File Processing │ │ LLM Orchestrator│ │ Response Agg.   │          │
│  │ Service         │ │ Service         │ │ Service         │          │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐          │
│  │ Session Manager │ │ Analytics       │ │ Schematic Gen.  │          │
│  │ Service         │ │ Service         │ │ Service         │          │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                           Message Queue/Event Bus
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                      External Integration Layer                         │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐          │
│  │ OpenAI GPT-4V   │ │ Anthropic Claude│ │ Google Gemini   │          │
│  │ API Client      │ │ API Client      │ │ API Client      │          │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────┐
│                        Data Storage Layer                               │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐          │
│  │ PostgreSQL      │ │ Redis Cache     │ │ Object Storage  │          │
│  │ (Metadata)      │ │ (Sessions)      │ │ (Files)         │          │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Core Architectural Components

#### 2.2.1 Frontend Layer
- **React Application**: Modern SPA with TypeScript for type safety
- **PDF Processing**: Client-side PDF rendering and preview with PDF.js
- **Real-time Communication**: WebSocket connections for streaming responses
- **Responsive Design**: Material-UI components optimized for desktop/tablet

#### 2.2.2 API Gateway Layer
- **NGINX/AWS ALB**: Load balancing and SSL termination
- **Rate Limiting**: Redis-based rate limiting per IP/session
- **Request Routing**: Intelligent routing to appropriate microservices
- **API Security**: Authentication, CORS, and input validation

#### 2.2.3 Microservices Layer
- **File Processing Service**: PDF parsing, image optimization, and validation
- **LLM Orchestrator Service**: Multi-model coordination and consensus building
- **Response Aggregator Service**: Result compilation and ranking
- **Session Manager Service**: Session state and temporary data management
- **Analytics Service**: Usage tracking and performance monitoring
- **Schematic Generator Service**: SVG-based schematic recreation

#### 2.2.4 Data Layer
- **PostgreSQL**: Persistent metadata, analytics, and system configuration
- **Redis**: Session management, caching, and real-time data
- **Object Storage**: Temporary file storage with automatic cleanup

### 2.3 Service Communication Patterns

#### 2.3.1 Synchronous Communication
- **REST APIs**: Standard HTTP/HTTPS for client-server communication
- **GraphQL**: Considered for future complex query requirements
- **Service-to-Service**: Direct HTTP calls for simple request/response

#### 2.3.2 Asynchronous Communication
- **Message Queues**: RabbitMQ/AWS SQS for LLM processing workflows
- **Event Streaming**: Apache Kafka/AWS Kinesis for analytics
- **WebSockets**: Real-time updates for processing status

---

## 3. Detailed Component Architecture

### 3.1 Frontend Architecture

#### 3.1.1 Technology Stack
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

#### 3.1.2 Component Structure
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

#### 3.1.3 State Management Architecture
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

### 3.2 Backend Architecture

#### 3.2.1 Technology Stack
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

#### 3.2.2 Service Architecture
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

#### 3.2.3 Database Schema Design
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

### 3.3 LLM Integration Architecture

#### 3.3.1 Multi-Provider Integration Pattern
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

#### 3.3.2 Circuit Breaker and Resilience Pattern
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

## 4. Data Flow and Processing Pipelines

### 4.1 File Upload and Processing Pipeline

```mermaid
graph TD
    A[Client Upload] --> B[File Validation]
    B --> C{Valid PDF?}
    C -->|No| D[Error Response]
    C -->|Yes| E[Generate Session ID]
    E --> F[Store File Metadata]
    F --> G[Upload to Object Storage]
    G --> H[PDF to Image Conversion]
    H --> I[Image Optimization]
    I --> J[Ready for Analysis]
    J --> K[WebSocket Notification]
```

#### 4.1.1 File Processing Service
```typescript
// File Processing Pipeline
class FileProcessingPipeline {
  async processUpload(file: Express.Multer.File, sessionId: string): Promise<ProcessedFile> {
    // Stage 1: Validation
    await this.validateFile(file)
    
    // Stage 2: PDF Processing
    const images = await this.convertPDFToImages(file.buffer)
    
    // Stage 3: Image Optimization
    const optimizedImages = await this.optimizeImages(images)
    
    // Stage 4: Storage
    const fileRecord = await this.storeFile(file, sessionId, optimizedImages)
    
    // Stage 5: Notification
    await this.notifyProcessingComplete(sessionId, fileRecord.id)
    
    return fileRecord
  }
  
  private async validateFile(file: Express.Multer.File): Promise<void> {
    if (!file.mimetype.includes('pdf')) {
      throw new ValidationError('Only PDF files are supported')
    }
    
    if (file.size > 10 * 1024 * 1024) {
      throw new ValidationError('File size must be under 10MB')
    }
    
    // Additional validation logic...
  }
  
  private async convertPDFToImages(buffer: Buffer): Promise<Buffer[]> {
    const pdf = await getDocument(buffer).promise
    const images: Buffer[] = []
    
    for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 2.0 })
      const canvas = createCanvas(viewport.width, viewport.height)
      const context = canvas.getContext('2d')
      
      await page.render({ canvasContext: context, viewport }).promise
      images.push(canvas.toBuffer('image/jpeg', { quality: 0.9 }))
    }
    
    return images
  }
}
```

### 4.2 Query Processing Pipeline

```mermaid
graph TD
    A[User Query] --> B[Query Validation]
    B --> C[Session Lookup]
    C --> D[Retrieve Documents]
    D --> E[Parallel LLM Processing]
    E --> F[GPT-4V Processing]
    E --> G[Claude Processing]
    E --> H[Gemini Processing]
    F --> I[Response Aggregation]
    G --> I
    H --> I
    I --> J[Consensus Building]
    J --> K[Confidence Scoring]
    K --> L[Format Response]
    L --> M[Store Results]
    M --> N[Send to Client]
```

#### 4.2.1 Query Processing Service
```typescript
// Query Processing Pipeline
class QueryProcessor {
  constructor(
    private llmEnsemble: LLMEnsemble,
    private responseAggregator: ResponseAggregator,
    private sessionManager: SessionManager
  ) {}
  
  async processQuery(query: AnalysisQuery): Promise<AnalysisResult> {
    // Stage 1: Validation and Context
    const session = await this.sessionManager.getSession(query.sessionId)
    const documents = await this.getSessionDocuments(query.sessionId)
    
    // Stage 2: Prepare Images and Prompts
    const images = await this.loadDocumentImages(documents)
    const prompt = await this.buildAnalysisPrompt(query, session.queryHistory)
    
    // Stage 3: Parallel LLM Processing
    const ensembleResponse = await this.llmEnsemble.analyzeWithEnsemble(
      images, 
      prompt, 
      { queryType: query.type }
    )
    
    // Stage 4: Response Processing
    const aggregatedResult = await this.responseAggregator.aggregate(
      ensembleResponse,
      query
    )
    
    // Stage 5: Store and Return
    await this.storeQueryResult(query, aggregatedResult)
    return aggregatedResult
  }
  
  private async buildAnalysisPrompt(query: AnalysisQuery, history: Query[]): Promise<string> {
    const basePrompt = await this.getPromptTemplate(query.type)
    const contextPrompt = this.buildContextFromHistory(history)
    
    return `${basePrompt}\n\nContext from previous queries:\n${contextPrompt}\n\nCurrent question: ${query.text}`
  }
}
```

### 4.3 Response Aggregation Pipeline

```typescript
// Response Aggregation and Consensus
class ResponseAggregator {
  async aggregate(ensembleResponse: EnsembleResponse, query: AnalysisQuery): Promise<AnalysisResult> {
    const responses = ensembleResponse.individual
    
    // Component Analysis Aggregation
    const components = await this.aggregateComponentIdentifications(responses)
    
    // Question Answer Aggregation
    const answer = await this.aggregateTextResponses(responses)
    
    // Confidence Scoring
    const confidence = await this.calculateConfidenceScore(responses, query)
    
    // Schematic Data Aggregation
    const schematicData = await this.aggregateSchematicData(responses)
    
    return {
      answer,
      components,
      schematicData,
      confidence,
      modelComparison: this.buildModelComparison(responses),
      metadata: {
        processingTime: ensembleResponse.metadata.totalTime,
        modelsUsed: responses.map(r => r.model),
        consensus: ensembleResponse.consensus
      }
    }
  }
  
  private async aggregateComponentIdentifications(responses: LLMResponse[]): Promise<ComponentIdentification[]> {
    // Use clustering algorithm to group similar component identifications
    const allComponents = responses.flatMap(r => r.components || [])
    const clusters = await this.clusterComponents(allComponents)
    
    return clusters.map(cluster => ({
      type: this.getMostCommonType(cluster),
      description: this.buildConsensusDescription(cluster),
      location: this.averageLocation(cluster),
      confidence: this.calculateClusterConfidence(cluster)
    }))
  }
  
  private calculateConfidenceScore(responses: LLMResponse[], query: AnalysisQuery): ConfidenceScore {
    const agreement = this.calculateInterModelAgreement(responses)
    const completeness = this.assessResponseCompleteness(responses, query)
    const consistency = this.assessInternalConsistency(responses)
    
    return {
      overall: (agreement * 0.4 + completeness * 0.3 + consistency * 0.3),
      agreement,
      completeness,
      consistency,
      factors: {
        modelConsensus: agreement,
        responseQuality: completeness,
        logicalConsistency: consistency
      }
    }
  }
}
```

---

## 5. API Specifications and Integration Patterns

### 5.1 REST API Specification

#### 5.1.1 Core API Endpoints
```yaml
# OpenAPI 3.0 Specification
openapi: 3.0.3
info:
  title: Electrical Drawing Analysis API
  version: 1.0.0
  description: Multi-model LLM ensemble for electrical drawing analysis

servers:
  - url: https://api.electrical-analysis.com/v1
    description: Production server
  - url: https://staging-api.electrical-analysis.com/v1
    description: Staging server

paths:
  /sessions:
    post:
      summary: Create new analysis session
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                clientId:
                  type: string
                metadata:
                  type: object
      responses:
        '201':
          description: Session created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Session'

  /sessions/{sessionId}/documents:
    post:
      summary: Upload documents for analysis
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                files:
                  type: array
                  items:
                    type: string
                    format: binary
                  maxItems: 3
      responses:
        '201':
          description: Documents uploaded successfully
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Document'

  /sessions/{sessionId}/analyze:
    post:
      summary: Analyze uploaded documents with query
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AnalysisRequest'
      responses:
        '200':
          description: Analysis completed successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AnalysisResponse'

components:
  schemas:
    Session:
      type: object
      properties:
        id:
          type: string
          format: uuid
        createdAt:
          type: string
          format: date-time
        expiresAt:
          type: string
          format: date-time
        status:
          type: string
          enum: [active, expired]

    Document:
      type: object
      properties:
        id:
          type: string
          format: uuid
        filename:
          type: string
        size:
          type: integer
        contentType:
          type: string
        uploadedAt:
          type: string
          format: date-time
        processingStatus:
          type: string
          enum: [uploaded, processing, ready, error]

    AnalysisRequest:
      type: object
      required:
        - query
        - queryType
      properties:
        query:
          type: string
          minLength: 1
          maxLength: 1000
        queryType:
          type: string
          enum: [component_identification, general_question, schematic_analysis]
        context:
          type: object
          description: Additional context for the query

    AnalysisResponse:
      type: object
      properties:
        id:
          type: string
          format: uuid
        answer:
          type: string
        components:
          type: array
          items:
            $ref: '#/components/schemas/ComponentIdentification'
        confidence:
          $ref: '#/components/schemas/ConfidenceScore'
        modelComparison:
          $ref: '#/components/schemas/ModelComparison'
        schematicData:
          $ref: '#/components/schemas/SchematicData'
        processingTime:
          type: integer
          description: Processing time in milliseconds

    ComponentIdentification:
      type: object
      properties:
        type:
          type: string
        description:
          type: string
        location:
          type: object
          properties:
            x:
              type: number
            y:
              type: number
        confidence:
          type: number
          minimum: 0
          maximum: 1

    ConfidenceScore:
      type: object
      properties:
        overall:
          type: number
          minimum: 0
          maximum: 1
        agreement:
          type: number
          minimum: 0
          maximum: 1
        completeness:
          type: number
          minimum: 0
          maximum: 1
        consistency:
          type: number
          minimum: 0
          maximum: 1
```

### 5.2 WebSocket API Specification

#### 5.2.1 Real-time Communication Protocol
```typescript
// WebSocket Event Types
interface WebSocketEvents {
  // Client to Server
  'analysis:start': AnalysisStartEvent
  'analysis:cancel': AnalysisCancelEvent
  'ping': PingEvent
  
  // Server to Client
  'analysis:progress': AnalysisProgressEvent
  'analysis:complete': AnalysisCompleteEvent
  'analysis:error': AnalysisErrorEvent
  'pong': PongEvent
}

// Event Interfaces
interface AnalysisStartEvent {
  sessionId: string
  queryId: string
  query: string
  timestamp: number
}

interface AnalysisProgressEvent {
  sessionId: string
  queryId: string
  progress: {
    stage: 'uploading' | 'processing' | 'analyzing' | 'aggregating'
    percentage: number
    message: string
    modelsComplete: string[]
    modelsInProgress: string[]
  }
  timestamp: number
}

interface AnalysisCompleteEvent {
  sessionId: string
  queryId: string
  result: AnalysisResult
  timestamp: number
}

// WebSocket Handler Implementation
class WebSocketHandler {
  private io: Server
  private sessionManager: SessionManager
  private queryProcessor: QueryProcessor
  
  constructor() {
    this.io = new Server(server, {
      cors: { origin: process.env.ALLOWED_ORIGINS },
      transports: ['websocket', 'polling']
    })
    
    this.setupEventHandlers()
  }
  
  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      socket.on('analysis:start', async (event: AnalysisStartEvent) => {
        try {
          await this.handleAnalysisStart(socket, event)
        } catch (error) {
          socket.emit('analysis:error', {
            queryId: event.queryId,
            error: error.message,
            timestamp: Date.now()
          })
        }
      })
      
      socket.on('disconnect', () => {
        this.handleDisconnection(socket)
      })
    })
  }
  
  private async handleAnalysisStart(socket: Socket, event: AnalysisStartEvent): Promise<void> {
    const progressCallback = (progress: AnalysisProgress) => {
      socket.emit('analysis:progress', {
        sessionId: event.sessionId,
        queryId: event.queryId,
        progress,
        timestamp: Date.now()
      })
    }
    
    const result = await this.queryProcessor.processQuery({
      id: event.queryId,
      sessionId: event.sessionId,
      text: event.query,
      type: 'general_question'
    }, progressCallback)
    
    socket.emit('analysis:complete', {
      sessionId: event.sessionId,
      queryId: event.queryId,
      result,
      timestamp: Date.now()
    })
  }
}
```

### 5.3 External API Integration Patterns

#### 5.3.1 LLM Provider Integration
```typescript
// Unified LLM Client Interface
class LLMApiClient {
  private providers: Map<string, LLMProvider>
  private rateLimiter: RateLimiter
  private costTracker: CostTracker
  
  constructor() {
    this.providers = new Map([
      ['openai', new OpenAIProvider()],
      ['anthropic', new AnthropicProvider()],
      ['google', new GoogleProvider()]
    ])
    
    this.rateLimiter = new RateLimiter({
      openai: { requests: 500, window: 60000 },
      anthropic: { requests: 200, window: 60000 },
      google: { requests: 300, window: 60000 }
    })
  }
  
  async callProvider(
    providerName: string, 
    request: LLMRequest
  ): Promise<LLMResponse> {
    const provider = this.providers.get(providerName)
    if (!provider) {
      throw new Error(`Unknown provider: ${providerName}`)
    }
    
    // Rate limiting
    await this.rateLimiter.waitForToken(providerName)
    
    // Cost tracking
    const startTime = Date.now()
    const estimatedCost = provider.estimateCost(request)
    
    try {
      const response = await provider.analyze(
        request.image, 
        request.prompt, 
        request.options
      )
      
      // Track actual cost and usage
      const actualCost = provider.calculateCost(response.tokensUsed)
      await this.costTracker.recordUsage(providerName, actualCost, response.tokensUsed)
      
      return response
    } catch (error) {
      await this.handleProviderError(providerName, error)
      throw error
    }
  }
}

// Rate Limiting Implementation
class RateLimiter {
  private windows: Map<string, TokenBucket>
  
  constructor(private limits: Record<string, { requests: number, window: number }>) {
    this.windows = new Map()
    
    Object.entries(limits).forEach(([provider, limit]) => {
      this.windows.set(provider, new TokenBucket(limit.requests, limit.window))
    })
  }
  
  async waitForToken(provider: string): Promise<void> {
    const bucket = this.windows.get(provider)
    if (!bucket) return
    
    await bucket.consume()
  }
}

class TokenBucket {
  private tokens: number
  private lastRefill: number
  private waitQueue: Array<{ resolve: () => void, timestamp: number }> = []
  
  constructor(
    private capacity: number,
    private refillInterval: number
  ) {
    this.tokens = capacity
    this.lastRefill = Date.now()
    this.startRefillTimer()
  }
  
  async consume(): Promise<void> {
    this.refill()
    
    if (this.tokens > 0) {
      this.tokens--
      return Promise.resolve()
    }
    
    return new Promise((resolve) => {
      this.waitQueue.push({ resolve, timestamp: Date.now() })
    })
  }
  
  private refill(): void {
    const now = Date.now()
    const timePassed = now - this.lastRefill
    const tokensToAdd = Math.floor(timePassed / this.refillInterval * this.capacity)
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd)
      this.lastRefill = now
      this.processWaitQueue()
    }
  }
  
  private processWaitQueue(): void {
    while (this.waitQueue.length > 0 && this.tokens > 0) {
      const { resolve } = this.waitQueue.shift()!
      this.tokens--
      resolve()
    }
  }
}
```

---

## 6. Deployment Architecture and Infrastructure

### 6.1 Cloud Infrastructure Architecture

#### 6.1.1 Multi-Cloud Strategy
```yaml
# Infrastructure as Code (Terraform)
# AWS Primary Deployment
provider "aws" {
  region = var.aws_region
}

# VPC Configuration
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = {
    Name = "electrical-analysis-vpc"
    Environment = var.environment
  }
}

# EKS Cluster for Container Orchestration
resource "aws_eks_cluster" "main" {
  name     = "electrical-analysis-cluster"
  role_arn = aws_iam_role.cluster.arn
  version  = "1.24"
  
  vpc_config {
    subnet_ids = [
      aws_subnet.private_a.id,
      aws_subnet.private_b.id,
      aws_subnet.public_a.id,
      aws_subnet.public_b.id
    ]
    
    endpoint_private_access = true
    endpoint_public_access  = true
  }
}

# RDS for PostgreSQL
resource "aws_db_instance" "main" {
  identifier     = "electrical-analysis-db"
  engine         = "postgres"
  engine_version = "15.3"
  instance_class = "db.r6g.large"
  
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_encrypted     = true
  
  db_name  = "electrical_analysis"
  username = var.db_username
  password = var.db_password
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  multi_az               = true
  publicly_accessible    = false
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
}

# ElastiCache for Redis
resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "electrical-analysis-redis"
  description                = "Redis cluster for session management"
  
  node_type                  = "cache.r6g.large"
  port                       = 6379
  parameter_group_name       = "default.redis7"
  
  num_cache_clusters         = 2
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  subnet_group_name = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
}

# S3 for Object Storage
resource "aws_s3_bucket" "files" {
  bucket = "electrical-analysis-files-${var.environment}"
}

resource "aws_s3_bucket_lifecycle_configuration" "files" {
  bucket = aws_s3_bucket.files.id
  
  rule {
    id     = "temporary_files"
    status = "Enabled"
    
    expiration {
      days = 1
    }
  }
}
```

#### 6.1.2 Kubernetes Deployment Configuration
```yaml
# Namespace Configuration
apiVersion: v1
kind: Namespace
metadata:
  name: electrical-analysis
  labels:
    name: electrical-analysis

---
# ConfigMap for Application Configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: electrical-analysis
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  SESSION_TIMEOUT: "86400"
  MAX_FILE_SIZE: "10485760"
  MAX_FILES_PER_SESSION: "3"

---
# Secret for Sensitive Configuration
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: electrical-analysis
type: Opaque
stringData:
  DATABASE_URL: "postgresql://username:password@host:5432/electrical_analysis"
  REDIS_URL: "redis://host:6379"
  OPENAI_API_KEY: "sk-..."
  ANTHROPIC_API_KEY: "claude-..."
  GOOGLE_API_KEY: "AIza..."
  JWT_SECRET: "your-jwt-secret"

---
# Frontend Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: electrical-analysis
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: frontend
        image: electrical-analysis/frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: REACT_APP_API_URL
          value: "https://api.electrical-analysis.com"
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10

---
# Backend API Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: electrical-analysis
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
      - name: api-gateway
        image: electrical-analysis/api-gateway:latest
        ports:
        - containerPort: 3001
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "200m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10

---
# File Processing Service Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: file-processor
  namespace: electrical-analysis
spec:
  replicas: 2
  selector:
    matchLabels:
      app: file-processor
  template:
    metadata:
      labels:
        app: file-processor
    spec:
      containers:
      - name: file-processor
        image: electrical-analysis/file-processor:latest
        ports:
        - containerPort: 3002
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1500m"
        volumeMounts:
        - name: temp-storage
          mountPath: /tmp/processing
      volumes:
      - name: temp-storage
        emptyDir:
          sizeLimit: "5Gi"

---
# LLM Orchestrator Service Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llm-orchestrator
  namespace: electrical-analysis
spec:
  replicas: 3
  selector:
    matchLabels:
      app: llm-orchestrator
  template:
    metadata:
      labels:
        app: llm-orchestrator
    spec:
      containers:
      - name: llm-orchestrator
        image: electrical-analysis/llm-orchestrator:latest
        ports:
        - containerPort: 3003
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "300m"
          limits:
            memory: "1Gi"
            cpu: "1000m"

---
# Services Configuration
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: electrical-analysis
spec:
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP

---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway-service
  namespace: electrical-analysis
spec:
  selector:
    app: api-gateway
  ports:
  - port: 80
    targetPort: 3001
  type: ClusterIP

---
# Ingress Configuration
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: main-ingress
  namespace: electrical-analysis
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  tls:
  - hosts:
    - electrical-analysis.com
    - api.electrical-analysis.com
    secretName: tls-secret
  rules:
  - host: electrical-analysis.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
  - host: api.electrical-analysis.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway-service
            port:
              number: 80

---
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
  namespace: electrical-analysis
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### 6.2 Container Architecture

#### 6.2.1 Docker Configuration
```dockerfile
# Frontend Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]

---
# Backend API Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001
CMD ["npm", "start"]

---
# File Processor Service Dockerfile
FROM node:18-alpine AS builder

# Install canvas dependencies for PDF processing
RUN apk add --no-cache \
    build-base \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3002
CMD ["npm", "start"]
```

### 6.3 CI/CD Pipeline Configuration

#### 6.3.1 GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
          
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run type checking
      run: npm run type-check
    
    - name: Run unit tests
      run: npm run test:unit
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        REDIS_URL: redis://localhost:6379
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        REDIS_URL: redis://localhost:6379

  security:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Run security audit
      run: npm audit --audit-level high
    
    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  build:
    needs: [test, security]
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [frontend, api-gateway, file-processor, llm-orchestrator]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Log in to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v4
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/${{ matrix.service }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha,prefix={{branch}}-
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v4
      with:
        context: ./services/${{ matrix.service }}
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}

  deploy-staging:
    if: github.ref == 'refs/heads/staging'
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2
    
    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name electrical-analysis-staging-cluster
    
    - name: Deploy to staging
      run: |
        kubectl apply -f k8s/staging/
        kubectl set image deployment/api-gateway api-gateway=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api-gateway:staging -n electrical-analysis-staging
        kubectl rollout status deployment/api-gateway -n electrical-analysis-staging

  deploy-production:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    environment: production
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2
    
    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name electrical-analysis-cluster
    
    - name: Deploy to production
      run: |
        kubectl apply -f k8s/production/
        kubectl set image deployment/api-gateway api-gateway=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api-gateway:main -n electrical-analysis
        kubectl rollout status deployment/api-gateway -n electrical-analysis
    
    - name: Run smoke tests
      run: npm run test:smoke
      env:
        API_URL: https://api.electrical-analysis.com
```

---

## 7. Security Architecture and Compliance Framework

### 7.1 Defense in Depth Strategy

#### 7.1.1 Network Security Layer
```yaml
# AWS Security Groups Configuration
resource "aws_security_group" "web" {
  name_prefix = "electrical-analysis-web"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "electrical-analysis-web-sg"
  }
}

resource "aws_security_group" "app" {
  name_prefix = "electrical-analysis-app"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 3001
    to_port         = 3003
    protocol        = "tcp"
    security_groups = [aws_security_group.web.id]
  }
  
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  
  tags = {
    Name = "electrical-analysis-app-sg"
  }
}

resource "aws_security_group" "rds" {
  name_prefix = "electrical-analysis-rds"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }
  
  tags = {
    Name = "electrical-analysis-rds-sg"
  }
}

# Network ACLs for additional layer
resource "aws_network_acl" "private" {
  vpc_id     = aws_vpc.main.id
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]

  ingress {
    rule_no    = 100
    protocol   = "tcp"
    from_port  = 5432
    to_port    = 5432
    cidr_block = "10.0.0.0/16"
    action     = "allow"
  }
  
  ingress {
    rule_no    = 110
    protocol   = "tcp"
    from_port  = 6379
    to_port    = 6379
    cidr_block = "10.0.0.0/16"
    action     = "allow"
  }
  
  egress {
    rule_no    = 100
    protocol   = "-1"
    cidr_block = "0.0.0.0/0"
    action     = "allow"
  }
  
  tags = {
    Name = "electrical-analysis-private-nacl"
  }
}
```

#### 7.1.2 Application Security Layer
```typescript
// Security Middleware Stack
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import cors from 'cors'
import { body, validationResult } from 'express-validator'

class SecurityMiddleware {
  static setupSecurity(app: Express): void {
    // Security headers
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
          fontSrc: ["'self'", "fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", process.env.API_URL],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }))
    
    // CORS configuration
    app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      optionsSuccessStatus: 200
    }))
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false,
    })
    app.use('/api/', limiter)
    
    // Stricter rate limiting for analysis endpoints
    const analysisLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 10, // limit each IP to 10 analysis requests per minute
      message: 'Analysis rate limit exceeded',
    })
    app.use('/api/sessions/*/analyze', analysisLimiter)
  }
  
  static validateFileUpload() {
    return [
      body('files').custom((value, { req }) => {
        if (!req.files || req.files.length === 0) {
          throw new Error('No files uploaded')
        }
        
        if (req.files.length > 3) {
          throw new Error('Maximum 3 files allowed')
        }
        
        for (const file of req.files) {
          if (!file.mimetype.includes('pdf')) {
            throw new Error('Only PDF files are allowed')
          }
          
          if (file.size > 10 * 1024 * 1024) {
            throw new Error('File size must be under 10MB')
          }
        }
        
        return true
      })
    ]
  }
  
  static validateAnalysisRequest() {
    return [
      body('query')
        .isString()
        .isLength({ min: 1, max: 1000 })
        .withMessage('Query must be between 1 and 1000 characters')
        .escape(),
      body('queryType')
        .isIn(['component_identification', 'general_question', 'schematic_analysis'])
        .withMessage('Invalid query type'),
      body('context')
        .optional()
        .isObject()
        .withMessage('Context must be an object')
    ]
  }
  
  static handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      })
      return
    }
    next()
  }
}

// File Upload Security
class SecureFileUpload {
  private static readonly ALLOWED_MIME_TYPES = ['application/pdf']
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  private static readonly SCAN_TIMEOUT = 30000 // 30 seconds
  
  static async validateAndScanFile(file: Express.Multer.File): Promise<void> {
    // MIME type validation
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new SecurityError('Invalid file type')
    }
    
    // File size validation
    if (file.size > this.MAX_FILE_SIZE) {
      throw new SecurityError('File too large')
    }
    
    // PDF structure validation
    await this.validatePDFStructure(file.buffer)
    
    // Malware scanning (integration with ClamAV or cloud service)
    await this.scanForMalware(file.buffer)
  }
  
  private static async validatePDFStructure(buffer: Buffer): Promise<void> {
    try {
      const pdf = await getDocument(buffer).promise
      
      // Basic PDF validation
      if (pdf.numPages === 0 || pdf.numPages > 10) {
        throw new SecurityError('Invalid PDF structure')
      }
      
      // Check for embedded JavaScript or forms
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const annotations = await page.getAnnotations()
        
        for (const annotation of annotations) {
          if (annotation.subtype === 'Widget' || annotation.actions) {
            throw new SecurityError('PDF contains interactive elements')
          }
        }
      }
    } catch (error) {
      throw new SecurityError('PDF validation failed')
    }
  }
  
  private static async scanForMalware(buffer: Buffer): Promise<void> {
    // Integration with malware scanning service
    // This could be AWS GuardDuty, ClamAV, or another service
    const scanner = new MalwareScanner()
    const result = await scanner.scan(buffer, { timeout: this.SCAN_TIMEOUT })
    
    if (result.isInfected) {
      throw new SecurityError('File contains malware')
    }
  }
}
```

### 7.2 Data Protection and Privacy

#### 7.2.1 Data Encryption Strategy
```typescript
// Encryption Service
class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly KEY_LENGTH = 32
  private static readonly IV_LENGTH = 16
  private static readonly TAG_LENGTH = 16
  
  static encrypt(data: string, key: Buffer): EncryptedData {
    const iv = crypto.randomBytes(this.IV_LENGTH)
    const cipher = crypto.createCipher(this.ALGORITHM, key, iv)
    
    let encrypted = cipher.update(data, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    
    const tag = cipher.getAuthTag()
    
    return {
      encrypted,
      iv: iv.toString('base64'),
      tag: tag.toString('base64')
    }
  }
  
  static decrypt(encryptedData: EncryptedData, key: Buffer): string {
    const iv = Buffer.from(encryptedData.iv, 'base64')
    const tag = Buffer.from(encryptedData.tag, 'base64')
    const decipher = crypto.createDecipher(this.ALGORITHM, key, iv)
    
    decipher.setAuthTag(tag)
    
    let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
  
  static generateKey(): Buffer {
    return crypto.randomBytes(this.KEY_LENGTH)
  }
}

// Secrets Management
class SecretsManager {
  private kms: AWS.KMS
  private cache: Map<string, { value: string, expires: number }>
  
  constructor() {
    this.kms = new AWS.KMS({ region: process.env.AWS_REGION })
    this.cache = new Map()
  }
  
  async getSecret(secretName: string): Promise<string> {
    // Check cache first
    const cached = this.cache.get(secretName)
    if (cached && cached.expires > Date.now()) {
      return cached.value
    }
    
    // Retrieve from AWS Secrets Manager
    const secretsManager = new AWS.SecretsManager()
    const result = await secretsManager.getSecretValue({ SecretId: secretName }).promise()
    
    if (!result.SecretString) {
      throw new Error(`Secret ${secretName} not found`)
    }
    
    // Cache for 5 minutes
    this.cache.set(secretName, {
      value: result.SecretString,
      expires: Date.now() + 5 * 60 * 1000
    })
    
    return result.SecretString
  }
  
  async rotateApiKeys(): Promise<void> {
    // Implement automatic API key rotation
    const secrets = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY']
    
    for (const secret of secrets) {
      await this.rotateSecret(secret)
    }
  }
  
  private async rotateSecret(secretName: string): Promise<void> {
    // Implementation depends on provider's key rotation API
    console.log(`Rotating secret: ${secretName}`)
  }
}
```

#### 7.2.2 GDPR and Privacy Compliance
```typescript
// Privacy Compliance Manager
class PrivacyComplianceManager {
  private auditLogger: AuditLogger
  private dataProcessor: DataProcessor
  
  constructor() {
    this.auditLogger = new AuditLogger()
    this.dataProcessor = new DataProcessor()
  }
  
  async handleDataSubjectRequest(request: DataSubjectRequest): Promise<DataSubjectResponse> {
    await this.auditLogger.log('data_subject_request', {
      requestType: request.type,
      subjectId: request.subjectId,
      timestamp: new Date().toISOString()
    })
    
    switch (request.type) {
      case 'access':
        return await this.handleAccessRequest(request)
      case 'deletion':
        return await this.handleDeletionRequest(request)
      case 'portability':
        return await this.handlePortabilityRequest(request)
      default:
        throw new Error('Invalid request type')
    }
  }
  
  private async handleAccessRequest(request: DataSubjectRequest): Promise<DataSubjectResponse> {
    const sessionData = await this.dataProcessor.findSessionsBySubject(request.subjectId)
    const queryData = await this.dataProcessor.findQueriesBySubject(request.subjectId)
    
    return {
      requestId: request.id,
      data: {
        sessions: sessionData,
        queries: queryData.map(query => ({
          ...query,
          // Redact sensitive information
          ipAddress: this.redactIP(query.ipAddress)
        }))
      },
      exportedAt: new Date().toISOString()
    }
  }
  
  private async handleDeletionRequest(request: DataSubjectRequest): Promise<DataSubjectResponse> {
    // Implement right to be forgotten
    await this.dataProcessor.deleteSessionsBySubject(request.subjectId)
    await this.dataProcessor.deleteQueriesBySubject(request.subjectId)
    await this.dataProcessor.deleteAnalyticsBySubject(request.subjectId)
    
    await this.auditLogger.log('data_deletion', {
      subjectId: request.subjectId,
      deletedAt: new Date().toISOString()
    })
    
    return {
      requestId: request.id,
      status: 'completed',
      deletedAt: new Date().toISOString()
    }
  }
  
  async enforceDataRetention(): Promise<void> {
    const retentionPolicies = {
      sessions: 24 * 60 * 60 * 1000, // 24 hours
      tempFiles: 24 * 60 * 60 * 1000, // 24 hours
      analytics: 365 * 24 * 60 * 60 * 1000, // 1 year
      auditLogs: 2 * 365 * 24 * 60 * 60 * 1000 // 2 years
    }
    
    for (const [dataType, retentionPeriod] of Object.entries(retentionPolicies)) {
      await this.cleanupExpiredData(dataType, retentionPeriod)
    }
  }
  
  private async cleanupExpiredData(dataType: string, retentionPeriod: number): Promise<void> {
    const cutoffDate = new Date(Date.now() - retentionPeriod)
    
    switch (dataType) {
      case 'sessions':
        await this.dataProcessor.deleteExpiredSessions(cutoffDate)
        break
      case 'tempFiles':
        await this.dataProcessor.deleteExpiredFiles(cutoffDate)
        break
      case 'analytics':
        await this.dataProcessor.deleteExpiredAnalytics(cutoffDate)
        break
      case 'auditLogs':
        await this.auditLogger.deleteExpiredLogs(cutoffDate)
        break
    }
    
    await this.auditLogger.log('data_cleanup', {
      dataType,
      cutoffDate: cutoffDate.toISOString(),
      cleanupAt: new Date().toISOString()
    })
  }
}

// Data Anonymization
class DataAnonymizer {
  static anonymizeIP(ipAddress: string): string {
    if (ipAddress.includes(':')) {
      // IPv6 - zero out last 80 bits
      const parts = ipAddress.split(':')
      return parts.slice(0, 3).join(':') + '::0:0:0:0:0'
    } else {
      // IPv4 - zero out last octet
      const parts = ipAddress.split('.')
      return parts.slice(0, 3).join('.') + '.0'
    }
  }
  
  static anonymizeUserAgent(userAgent: string): string {
    // Remove version numbers and specific identifiers
    return userAgent
      .replace(/\d+\.\d+\.\d+/g, 'X.X.X')
      .replace(/\([^)]*\)/g, '()')
  }
  
  static hashSessionId(sessionId: string): string {
    return crypto.createHash('sha256').update(sessionId).digest('hex')
  }
}
```

### 7.3 API Security and Authentication

#### 7.3.1 JWT and Session Management
```typescript
// JWT Service
class JWTService {
  private static readonly ALGORITHM = 'HS256'
  private static readonly ACCESS_TOKEN_EXPIRY = '15m'
  private static readonly REFRESH_TOKEN_EXPIRY = '7d'
  
  static async generateTokens(sessionId: string, payload: TokenPayload): Promise<TokenPair> {
    const secret = await SecretsManager.getSecret('JWT_SECRET')
    
    const accessToken = jwt.sign(
      { ...payload, sessionId, type: 'access' },
      secret,
      { 
        algorithm: this.ALGORITHM,
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
        issuer: 'electrical-analysis-api',
        audience: 'electrical-analysis-client'
      }
    )
    
    const refreshToken = jwt.sign(
      { sessionId, type: 'refresh' },
      secret,
      {
        algorithm: this.ALGORITHM,
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
        issuer: 'electrical-analysis-api',
        audience: 'electrical-analysis-client'
      }
    )
    
    return { accessToken, refreshToken }
  }
  
  static async verifyToken(token: string, expectedType: 'access' | 'refresh'): Promise<TokenPayload> {
    const secret = await SecretsManager.getSecret('JWT_SECRET')
    
    try {
      const decoded = jwt.verify(token, secret, {
        algorithms: [this.ALGORITHM],
        issuer: 'electrical-analysis-api',
        audience: 'electrical-analysis-client'
      }) as any
      
      if (decoded.type !== expectedType) {
        throw new Error('Invalid token type')
      }
      
      return decoded
    } catch (error) {
      throw new UnauthorizedError('Invalid token')
    }
  }
  
  static async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyToken(refreshToken, 'refresh')
    
    // Verify session is still valid
    const session = await SessionManager.getSession(payload.sessionId)
    if (!session || session.status !== 'active') {
      throw new UnauthorizedError('Invalid session')
    }
    
    // Generate new token pair
    return await this.generateTokens(payload.sessionId, {
      sessionId: payload.sessionId,
      ipAddress: session.ipAddress
    })
  }
}

// Authentication Middleware
class AuthenticationMiddleware {
  static authenticate() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          throw new UnauthorizedError('No valid authorization header')
        }
        
        const token = authHeader.substring(7)
        const payload = await JWTService.verifyToken(token, 'access')
        
        // Verify session
        const session = await SessionManager.getSession(payload.sessionId)
        if (!session || session.status !== 'active') {
          throw new UnauthorizedError('Session expired or invalid')
        }
        
        // Rate limiting per session
        await RateLimiter.checkSessionLimit(payload.sessionId)
        
        req.user = payload
        req.session = session
        next()
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          res.status(401).json({ error: error.message })
        } else {
          res.status(500).json({ error: 'Authentication failed' })
        }
      }
    }
  }
  
  static optionalAuthentication() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authHeader = req.headers.authorization
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7)
          const payload = await JWTService.verifyToken(token, 'access')
          
          const session = await SessionManager.getSession(payload.sessionId)
          if (session && session.status === 'active') {
            req.user = payload
            req.session = session
          }
        }
        next()
      } catch (error) {
        // For optional auth, continue without authentication
        next()
      }
    }
  }
}
```

---

## 8. Monitoring and Observability Strategy

### 8.1 Comprehensive Monitoring Stack

#### 8.1.1 Application Performance Monitoring
```typescript
// APM Service Integration
class APMService {
  private prometheus: PrometheusRegistry
  private grafana: GrafanaClient
  private elasticAPM: ElasticAPMClient
  
  constructor() {
    this.prometheus = new PrometheusRegistry()
    this.setupMetrics()
    this.setupTracing()
  }
  
  private setupMetrics(): void {
    // HTTP Request Metrics
    const httpRequestDuration = new prometheus.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10]
    })
    
    // LLM API Metrics
    const llmRequestDuration = new prometheus.Histogram({
      name: 'llm_request_duration_seconds',
      help: 'Duration of LLM API requests in seconds',
      labelNames: ['provider', 'model', 'success'],
      buckets: [1, 5, 10, 15, 30, 60]
    })
    
    // LLM Cost Metrics
    const llmRequestCost = new prometheus.Histogram({
      name: 'llm_request_cost_usd',
      help: 'Cost of LLM API requests in USD',
      labelNames: ['provider', 'model'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 5]
    })
    
    // File Processing Metrics
    const fileProcessingDuration = new prometheus.Histogram({
      name: 'file_processing_duration_seconds',
      help: 'Duration of file processing in seconds',
      labelNames: ['file_type', 'size_bucket'],
      buckets: [1, 5, 10, 30, 60, 120]
    })
    
    // Query Accuracy Metrics
    const queryAccuracy = new prometheus.Gauge({
      name: 'query_accuracy_score',
      help: 'Accuracy score of query responses',
      labelNames: ['query_type', 'model_ensemble']
    })
    
    // Active Sessions
    const activeSessions = new prometheus.Gauge({
      name: 'active_sessions_total',
      help: 'Number of active user sessions'
    })
    
    this.prometheus.register(httpRequestDuration)
    this.prometheus.register(llmRequestDuration)
    this.prometheus.register(llmRequestCost)
    this.prometheus.register(fileProcessingDuration)
    this.prometheus.register(queryAccuracy)
    this.prometheus.register(activeSessions)
  }
  
  trackHTTPRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.prometheus.getSingleMetric('http_request_duration_seconds')
      ?.observe({ method, route, status_code: statusCode.toString() }, duration / 1000)
  }
  
  trackLLMRequest(provider: string, model: string, success: boolean, duration: number, cost: number): void {
    this.prometheus.getSingleMetric('llm_request_duration_seconds')
      ?.observe({ provider, model, success: success.toString() }, duration / 1000)
    
    this.prometheus.getSingleMetric('llm_request_cost_usd')
      ?.observe({ provider, model }, cost)
  }
  
  trackQueryAccuracy(queryType: string, modelEnsemble: string, accuracy: number): void {
    this.prometheus.getSingleMetric('query_accuracy_score')
      ?.set({ query_type: queryType, model_ensemble: modelEnsemble }, accuracy)
  }
  
  updateActiveSessions(count: number): void {
    this.prometheus.getSingleMetric('active_sessions_total')?.set(count)
  }
}

// Structured Logging Service
class LoggingService {
  private winston: winston.Logger
  private elasticsearch: ElasticsearchClient
  
  constructor() {
    this.winston = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: 'electrical-analysis-api',
        version: process.env.APP_VERSION,
        environment: process.env.NODE_ENV
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error'
        }),
        new winston.transports.File({
          filename: 'logs/combined.log'
        })
      ]
    })
    
    if (process.env.ELASTICSEARCH_URL) {
      this.winston.add(new ElasticsearchTransport({
        client: this.elasticsearch,
        level: 'info'
      }))
    }
  }
  
  logAnalysisRequest(sessionId: string, query: string, metadata: any): void {
    this.winston.info('Analysis request started', {
      event: 'analysis_request',
      sessionId,
      query: this.sanitizeQuery(query),
      metadata,
      timestamp: new Date().toISOString()
    })
  }
  
  logAnalysisComplete(sessionId: string, queryId: string, duration: number, result: any): void {
    this.winston.info('Analysis request completed', {
      event: 'analysis_complete',
      sessionId,
      queryId,
      duration,
      resultSummary: {
        hasAnswer: !!result.answer,
        componentCount: result.components?.length || 0,
        confidence: result.confidence?.overall || 0
      },
      timestamp: new Date().toISOString()
    })
  }
  
  logLLMError(provider: string, error: Error, context: any): void {
    this.winston.error('LLM provider error', {
      event: 'llm_error',
      provider,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      context,
      timestamp: new Date().toISOString()
    })
  }
  
  logSecurityEvent(eventType: string, details: any): void {
    this.winston.warn('Security event', {
      event: 'security_event',
      eventType,
      details,
      timestamp: new Date().toISOString()
    })
  }
  
  private sanitizeQuery(query: string): string {
    // Remove potential PII from logged queries
    return query.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
                .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
  }
}
```

#### 8.1.2 Health Checks and Alerting
```typescript
// Health Check Service
class HealthCheckService {
  private checks: Map<string, HealthCheck>
  
  constructor() {
    this.checks = new Map()
    this.registerHealthChecks()
  }
  
  private registerHealthChecks(): void {
    this.checks.set('database', new DatabaseHealthCheck())
    this.checks.set('redis', new RedisHealthCheck())
    this.checks.set('openai', new OpenAIHealthCheck())
    this.checks.set('anthropic', new AnthropicHealthCheck())
    this.checks.set('google', new GoogleHealthCheck())
    this.checks.set('storage', new StorageHealthCheck())
  }
  
  async performHealthCheck(): Promise<HealthCheckResult> {
    const results = new Map<string, ComponentHealth>()
    const startTime = Date.now()
    
    for (const [name, check] of this.checks) {
      try {
        const componentStartTime = Date.now()
        await check.execute()
        results.set(name, {
          status: 'healthy',
          responseTime: Date.now() - componentStartTime,
          lastChecked: new Date().toISOString()
        })
      } catch (error) {
        results.set(name, {
          status: 'unhealthy',
          error: error.message,
          responseTime: Date.now() - componentStartTime,
          lastChecked: new Date().toISOString()
        })
      }
    }
    
    const overallStatus = Array.from(results.values()).every(r => r.status === 'healthy') 
      ? 'healthy' : 'degraded'
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      totalResponseTime: Date.now() - startTime,
      components: Object.fromEntries(results)
    }
  }
  
  async performReadinessCheck(): Promise<ReadinessCheckResult> {
    // More stringent checks for readiness
    const criticalChecks = ['database', 'redis']
    const results = new Map<string, ComponentHealth>()
    
    for (const checkName of criticalChecks) {
      const check = this.checks.get(checkName)
      if (!check) continue
      
      try {
        const startTime = Date.now()
        await check.execute()
        results.set(checkName, {
          status: 'ready',
          responseTime: Date.now() - startTime,
          lastChecked: new Date().toISOString()
        })
      } catch (error) {
        results.set(checkName, {
          status: 'not_ready',
          error: error.message,
          lastChecked: new Date().toISOString()
        })
      }
    }
    
    const isReady = Array.from(results.values()).every(r => r.status === 'ready')
    
    return {
      ready: isReady,
      timestamp: new Date().toISOString(),
      checks: Object.fromEntries(results)
    }
  }
}

// Individual Health Checks
class DatabaseHealthCheck implements HealthCheck {
  async execute(): Promise<void> {
    const client = await pool.connect()
    try {
      await client.query('SELECT 1')
    } finally {
      client.release()
    }
  }
}

class OpenAIHealthCheck implements HealthCheck {
  async execute(): Promise<void> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    try {
      await client.models.list()
    } catch (error) {
      if (error.status === 401) {
        throw new Error('OpenAI API authentication failed')
      }
      throw error
    }
  }
}

// Alerting Service
class AlertingService {
  private slackWebhook: string
  private pagerDuty: PagerDutyClient
  private emailService: EmailService
  
  constructor() {
    this.slackWebhook = process.env.SLACK_WEBHOOK_URL
    this.pagerDuty = new PagerDutyClient(process.env.PAGERDUTY_INTEGRATION_KEY)
    this.emailService = new EmailService()
  }
  
  async sendAlert(alert: Alert): Promise<void> {
    switch (alert.severity) {
      case 'critical':
        await this.sendCriticalAlert(alert)
        break
      case 'warning':
        await this.sendWarningAlert(alert)
        break
      case 'info':
        await this.sendInfoAlert(alert)
        break
    }
  }
  
  private async sendCriticalAlert(alert: Alert): Promise<void> {
    // Send to all channels for critical alerts
    await Promise.allSettled([
      this.sendSlackAlert(alert),
      this.sendPagerDutyAlert(alert),
      this.sendEmailAlert(alert)
    ])
  }
  
  private async sendWarningAlert(alert: Alert): Promise<void> {
    await Promise.allSettled([
      this.sendSlackAlert(alert),
      this.sendEmailAlert(alert)
    ])
  }
  
  private async sendInfoAlert(alert: Alert): Promise<void> {
    await this.sendSlackAlert(alert)
  }
  
  private async sendSlackAlert(alert: Alert): Promise<void> {
    const color = {
      critical: '#ff0000',
      warning: '#ffaa00',
      info: '#00ff00'
    }[alert.severity]
    
    const payload = {
      text: `🚨 ${alert.title}`,
      attachments: [{
        color,
        fields: [
          { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
          { title: 'Service', value: alert.service, short: true },
          { title: 'Time', value: alert.timestamp, short: true },
          { title: 'Description', value: alert.description, short: false }
        ]
      }]
    }
    
    await fetch(this.slackWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  }
}
```

### 8.2 Business Intelligence and Analytics

#### 8.2.1 Analytics Data Pipeline
```typescript
// Analytics Event Collector
class AnalyticsCollector {
  private eventQueue: EventQueue
  private dataProcessor: AnalyticsProcessor
  
  constructor() {
    this.eventQueue = new EventQueue()
    this.dataProcessor = new AnalyticsProcessor()
    this.startEventProcessor()
  }
  
  trackUserInteraction(event: UserInteractionEvent): void {
    this.eventQueue.enqueue({
      type: 'user_interaction',
      timestamp: Date.now(),
      sessionId: event.sessionId,
      data: {
        action: event.action,
        component: event.component,
        metadata: event.metadata
      }
    })
  }
  
  trackAnalysisRequest(event: AnalysisRequestEvent): void {
    this.eventQueue.enqueue({
      type: 'analysis_request',
      timestamp: Date.now(),
      sessionId: event.sessionId,
      data: {
        queryType: event.queryType,
        processingTime: event.processingTime,
        modelsUsed: event.modelsUsed,
        confidence: event.confidence,
        userRating: event.userRating
      }
    })
  }
  
  trackSystemMetrics(event: SystemMetricsEvent): void {
    this.eventQueue.enqueue({
      type: 'system_metrics',
      timestamp: Date.now(),
      data: {
        cpuUsage: event.cpuUsage,
        memoryUsage: event.memoryUsage,
        activeConnections: event.activeConnections,
        responseTime: event.responseTime
      }
    })
  }
  
  trackBusinessMetrics(event: BusinessMetricsEvent): void {
    this.eventQueue.enqueue({
      type: 'business_metrics',
      timestamp: Date.now(),
      data: {
        dailyActiveUsers: event.dailyActiveUsers,
        averageSessionDuration: event.averageSessionDuration,
        conversionRate: event.conversionRate,
        revenueMetrics: event.revenueMetrics
      }
    })
  }
  
  private startEventProcessor(): void {
    setInterval(async () => {
      const events = this.eventQueue.dequeueAll()
      if (events.length > 0) {
        await this.dataProcessor.processBatch(events)
      }
    }, 5000) // Process every 5 seconds
  }
}

// Real-time Dashboard Service
class DashboardService {
  private websocketServer: WebSocketServer
  private metricsAggregator: MetricsAggregator
  
  constructor() {
    this.websocketServer = new WebSocketServer()
    this.metricsAggregator = new MetricsAggregator()
    this.setupDashboardMetrics()
  }
  
  private setupDashboardMetrics(): void {
    // Real-time metrics updates every 30 seconds
    setInterval(async () => {
      const metrics = await this.collectRealTimeMetrics()
      this.websocketServer.broadcast('metrics_update', metrics)
    }, 30000)
    
    // Hourly business metrics
    setInterval(async () => {
      const businessMetrics = await this.collectBusinessMetrics()
      this.websocketServer.broadcast('business_metrics_update', businessMetrics)
    }, 3600000)
  }
  
  private async collectRealTimeMetrics(): Promise<RealTimeMetrics> {
    const [
      activeSessions,
      responseTime,
      errorRate,
      llmUsage,
      systemHealth
    ] = await Promise.all([
      this.metricsAggregator.getActiveSessions(),
      this.metricsAggregator.getAverageResponseTime(),
      this.metricsAggregator.getErrorRate(),
      this.metricsAggregator.getLLMUsage(),
      this.metricsAggregator.getSystemHealth()
    ])
    
    return {
      timestamp: new Date().toISOString(),
      activeSessions,
      responseTime,
      errorRate,
      llmUsage,
      systemHealth
    }
  }
  
  private async collectBusinessMetrics(): Promise<BusinessMetrics> {
    const now = new Date()
    const startOfDay = new Date(now.setHours(0, 0, 0, 0))
    
    const [
      dailyActiveUsers,
      totalQueries,
      averageAccuracy,
      userSatisfaction,
      costMetrics
    ] = await Promise.all([
      this.metricsAggregator.getDailyActiveUsers(startOfDay),
      this.metricsAggregator.getTotalQueries(startOfDay),
      this.metricsAggregator.getAverageAccuracy(startOfDay),
      this.metricsAggregator.getUserSatisfaction(startOfDay),
      this.metricsAggregator.getCostMetrics(startOfDay)
    ])
    
    return {
      timestamp: new Date().toISOString(),
      dailyActiveUsers,
      totalQueries,
      averageAccuracy,
      userSatisfaction,
      costMetrics
    }
  }
}
```

---

## 9. Performance and Scalability Considerations

### 9.1 Performance Optimization Strategy

#### 9.1.1 Response Time Optimization
```typescript
// Performance Optimization Service
class PerformanceOptimizer {
  private cacheManager: CacheManager
  private loadBalancer: LoadBalancer
  private queryOptimizer: QueryOptimizer
  
  constructor() {
    this.cacheManager = new CacheManager()
    this.loadBalancer = new LoadBalancer()
    this.queryOptimizer = new QueryOptimizer()
  }
  
  async optimizeAnalysisRequest(request: AnalysisRequest): Promise<OptimizedRequest> {
    // Step 1: Check cache for similar queries
    const cachedResult = await this.cacheManager.findSimilarQuery(request)
    if (cachedResult && cachedResult.confidence > 0.9) {
      return {
        ...request,
        cacheHit: true,
        cachedResult,
        estimatedResponseTime: 100 // milliseconds
      }
    }
    
    // Step 2: Optimize LLM provider selection
    const providerLoad = await this.loadBalancer.getProviderLoad()
    const optimizedProviders = this.selectOptimalProviders(providerLoad, request)
    
    // Step 3: Pre-process images for optimal LLM consumption
    const optimizedImages = await this.optimizeImagesForLLM(request.images)
    
    // Step 4: Optimize prompts based on query type
    const optimizedPrompt = await this.queryOptimizer.optimizePrompt(
      request.query, 
      request.queryType
    )
    
    return {
      ...request,
      cacheHit: false,
      optimizedProviders,
      optimizedImages,
      optimizedPrompt,
      estimatedResponseTime: this.estimateResponseTime(optimizedProviders)
    }
  }
  
  private selectOptimalProviders(providerLoad: ProviderLoad, request: AnalysisRequest): LLMProvider[] {
    const providers = ['openai', 'anthropic', 'google']
    
    // Sort by current load and historical performance for this query type
    return providers
      .map(name => ({
        name,
        load: providerLoad[name],
        performance: this.getHistoricalPerformance(name, request.queryType)
      }))
      .sort((a, b) => {
        const scoreA = a.performance.accuracy * 0.6 + (1 - a.load) * 0.4
        const scoreB = b.performance.accuracy * 0.6 + (1 - b.load) * 0.4
        return scoreB - scoreA
      })
      .map(p => p.name)
  }
  
  private async optimizeImagesForLLM(images: Buffer[]): Promise<OptimizedImage[]> {
    return Promise.all(images.map(async (image) => {
      // Resize to optimal dimensions for each LLM
      const resized = await this.resizeImage(image, { width: 1024, height: 1024 })
      
      // Optimize compression
      const compressed = await this.compressImage(resized, { quality: 85 })
      
      // Generate multiple formats if beneficial
      const formats = await this.generateOptimalFormats(compressed)
      
      return {
        original: image,
        optimized: compressed,
        formats,
        metadata: {
          originalSize: image.length,
          optimizedSize: compressed.length,
          compressionRatio: compressed.length / image.length
        }
      }
    }))
  }
  
  private estimateResponseTime(providers: string[]): number {
    const baseTime = 5000 // 5 seconds base processing time
    const providerTimes = {
      openai: 8000,
      anthropic: 6000,
      google: 7000
    }
    
    // Parallel processing, so use the maximum time among selected providers
    const maxProviderTime = Math.max(...providers.map(p => providerTimes[p] || 10000))
    
    return baseTime + maxProviderTime
  }
}

// Intelligent Caching System
class CacheManager {
  private redis: RedisClient
  private similarityThreshold = 0.85
  
  constructor() {
    this.redis = new RedisClient()
  }
  
  async findSimilarQuery(request: AnalysisRequest): Promise<CachedResult | null> {
    const queryVector = await this.vectorizeQuery(request.query)
    const imageHashes = await Promise.all(
      request.images.map(img => this.hashImage(img))
    )
    
    // Search for similar queries with same image hashes
    const cacheKey = this.generateCacheKey(imageHashes)
    const cachedQueries = await this.redis.hgetall(`queries:${cacheKey}`)
    
    for (const [cachedQueryId, cachedData] of Object.entries(cachedQueries)) {
      const cached = JSON.parse(cachedData)
      const similarity = this.calculateSimilarity(queryVector, cached.queryVector)
      
      if (similarity > this.similarityThreshold) {
        // Update access time and hit count
        await this.redis.hincrby(`queries:${cacheKey}`, `${cachedQueryId}:hits`, 1)
        await this.redis.hset(`queries:${cacheKey}`, `${cachedQueryId}:lastAccess`, Date.now())
        
        return {
          result: cached.result,
          confidence: similarity,
          cacheAge: Date.now() - cached.timestamp,
          hitCount: cached.hits + 1
        }
      }
    }
    
    return null
  }
  
  async cacheResult(request: AnalysisRequest, result: AnalysisResult): Promise<void> {
    const queryVector = await this.vectorizeQuery(request.query)
    const imageHashes = await Promise.all(
      request.images.map(img => this.hashImage(img))
    )
    
    const cacheKey = this.generateCacheKey(imageHashes)
    const queryId = this.generateQueryId(request)
    
    const cacheData = {
      queryVector,
      result,
      timestamp: Date.now(),
      hits: 0,
      lastAccess: Date.now()
    }
    
    await this.redis.hset(`queries:${cacheKey}`, queryId, JSON.stringify(cacheData))
    
    // Set expiration for cache cleanup
    await this.redis.expire(`queries:${cacheKey}`, 24 * 60 * 60) // 24 hours
  }
  
  private async vectorizeQuery(query: string): Promise<number[]> {
    // Use a lightweight embedding model to vectorize queries
    const embedding = await this.getQueryEmbedding(query)
    return embedding
  }
  
  private async hashImage(image: Buffer): Promise<string> {
    // Use perceptual hashing to identify similar images
    const hash = crypto.createHash('sha256').update(image).digest('hex')
    return hash.substring(0, 16) // Use first 16 chars for efficiency
  }
  
  private calculateSimilarity(vec1: number[], vec2: number[]): number {
    // Cosine similarity
    const dotProduct = vec1.reduce((sum, a, i) => sum + a * vec2[i], 0)
    const magnitude1 = Math.sqrt(vec1.reduce((sum, a) => sum + a * a, 0))
    const magnitude2 = Math.sqrt(vec2.reduce((sum, a) => sum + a * a, 0))
    
    return dotProduct / (magnitude1 * magnitude2)
  }
}
```

#### 9.1.2 Database Optimization
```typescript
// Database Performance Optimizer
class DatabaseOptimizer {
  private connectionPool: Pool
  private queryAnalyzer: QueryAnalyzer
  
  constructor() {
    this.connectionPool = new Pool({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      
      // Connection pool optimization
      min: 5,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      
      // Performance settings
      statement_timeout: 30000,
      query_timeout: 25000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000
    })
    
    this.queryAnalyzer = new QueryAnalyzer()
  }
  
  async optimizeQueries(): Promise<void> {
    // Analyze slow queries
    const slowQueries = await this.identifySlowQueries()
    
    for (const query of slowQueries) {
      const optimization = await this.analyzeQuery(query)
      if (optimization.canOptimize) {
        await this.implementOptimization(query, optimization)
      }
    }
    
    // Update statistics
    await this.updateTableStatistics()
    
    // Optimize indexes
    await this.optimizeIndexes()
  }
  
  private async identifySlowQueries(): Promise<SlowQuery[]> {
    const result = await this.connectionPool.query(`
      SELECT 
        query,
        mean_exec_time,
        calls,
        total_exec_time,
        rows,
        100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
      FROM pg_stat_statements 
      WHERE mean_exec_time > 1000 -- queries taking more than 1 second
      ORDER BY mean_exec_time DESC
      LIMIT 10
    `)
    
    return result.rows.map(row => ({
      query: row.query,
      meanExecTime: row.mean_exec_time,
      calls: row.calls,
      totalExecTime: row.total_exec_time,
      hitPercent: row.hit_percent
    }))
  }
  
  private async optimizeIndexes(): Promise<void> {
    // Identify missing indexes
    const missingIndexes = await this.findMissingIndexes()
    
    for (const index of missingIndexes) {
      if (index.impact > 0.8) { // High impact threshold
        await this.createIndex(index)
      }
    }
    
    // Identify unused indexes
    const unusedIndexes = await this.findUnusedIndexes()
    
    for (const index of unusedIndexes) {
      if (index.size > 100 * 1024 * 1024) { // 100MB threshold
        await this.dropIndex(index)
      }
    }
  }
  
  private async findMissingIndexes(): Promise<MissingIndex[]> {
    const result = await this.connectionPool.query(`
      SELECT 
        schemaname,
        tablename,
        attname,
        n_distinct,
        correlation,
        most_common_freqs
      FROM pg_stats 
      WHERE schemaname = 'electrical_analysis'
        AND n_distinct > 100
        AND correlation < 0.1
    `)
    
    return result.rows.map(row => ({
      schema: row.schemaname,
      table: row.tablename,
      column: row.attname,
      distinctValues: row.n_distinct,
      impact: this.calculateIndexImpact(row)
    }))
  }
  
  // Connection Pool Monitoring
  async monitorConnectionPool(): Promise<PoolMetrics> {
    const totalConnections = this.connectionPool.totalCount
    const idleConnections = this.connectionPool.idleCount
    const waitingClients = this.connectionPool.waitingCount
    
    return {
      total: totalConnections,
      idle: idleConnections,
      active: totalConnections - idleConnections,
      waiting: waitingClients,
      utilization: (totalConnections - idleConnections) / totalConnections
    }
  }
}

// Query Result Caching
class QueryCache {
  private redis: RedisClient
  private cacheConfig: CacheConfig
  
  constructor() {
    this.redis = new RedisClient()
    this.cacheConfig = {
      defaultTTL: 300, // 5 minutes
      maxMemory: '256mb',
      evictionPolicy: 'allkeys-lru'
    }
  }
  
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key)
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value)
      if (ttl) {
        await this.redis.setex(key, ttl, serialized)
      } else {
        await this.redis.setex(key, this.cacheConfig.defaultTTL, serialized)
      }
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }
  
  generateKey(queryType: string, params: any): string {
    const paramString = JSON.stringify(params, Object.keys(params).sort())
    return `query:${queryType}:${crypto.createHash('md5').update(paramString).digest('hex')}`
  }
}
```

### 9.2 Scalability Architecture

#### 9.2.1 Horizontal Scaling Strategy
```typescript
// Auto-scaling Manager
class AutoScalingManager {
  private kubernetesClient: KubernetesClient
  private metricsCollector: MetricsCollector
  private scalingPolicies: ScalingPolicy[]
  
  constructor() {
    this.kubernetesClient = new KubernetesClient()
    this.metricsCollector = new MetricsCollector()
    this.scalingPolicies = this.initializeScalingPolicies()
  }
  
  private initializeScalingPolicies(): ScalingPolicy[] {
    return [
      {
        name: 'api-gateway-cpu',
        targetDeployment: 'api-gateway',
        metric: 'cpu_utilization',
        targetValue: 70,
        minReplicas: 3,
        maxReplicas: 10,
        scaleUpCooldown: 300, // 5 minutes
        scaleDownCooldown: 600 // 10 minutes
      },
      {
        name: 'llm-orchestrator-response-time',
        targetDeployment: 'llm-orchestrator',
        metric: 'response_time_p95',
        targetValue: 15000, // 15 seconds
        minReplicas: 3,
        maxReplicas: 15,
        scaleUpCooldown: 180,
        scaleDownCooldown: 900
      },
      {
        name: 'file-processor-queue-length',
        targetDeployment: 'file-processor',
        metric: 'queue_length',
        targetValue: 10,
        minReplicas: 2,
        maxReplicas: 8,
        scaleUpCooldown: 120,
        scaleDownCooldown: 600
      }
    ]
  }
  
  async evaluateScaling(): Promise<void> {
    for (const policy of this.scalingPolicies) {
      try {
        await this.evaluatePolicy(policy)
      } catch (error) {
        console.error(`Error evaluating scaling policy ${policy.name}:`, error)
      }
    }
  }
  
  private async evaluatePolicy(policy: ScalingPolicy): Promise<void> {
    const currentMetric = await this.metricsCollector.getMetric(
      policy.targetDeployment, 
      policy.metric
    )
    
    const currentReplicas = await this.kubernetesClient.getCurrentReplicas(
      policy.targetDeployment
    )
    
    const lastScalingEvent = await this.getLastScalingEvent(policy.targetDeployment)
    
    let targetReplicas = currentReplicas
    let scalingReason = ''
    
    if (currentMetric > policy.targetValue) {
      // Scale up needed
      if (this.canScaleUp(policy, lastScalingEvent)) {
        targetReplicas = Math.min(
          Math.ceil(currentReplicas * 1.5),
          policy.maxReplicas
        )
        scalingReason = `${policy.metric} (${currentMetric}) above target (${policy.targetValue})`
      }
    } else if (currentMetric < policy.targetValue * 0.7) {
      // Scale down possible
      if (this.canScaleDown(policy, lastScalingEvent)) {
        targetReplicas = Math.max(
          Math.floor(currentReplicas * 0.8),
          policy.minReplicas
        )
        scalingReason = `${policy.metric} (${currentMetric}) well below target (${policy.targetValue})`
      }
    }
    
    if (targetReplicas !== currentReplicas) {
      await this.executeScaling(policy.targetDeployment, targetReplicas, scalingReason)
    }
  }
  
  private async executeScaling(
    deployment: string, 
    targetReplicas: number, 
    reason: string
  ): Promise<void> {
    console.log(`Scaling ${deployment} to ${targetReplicas} replicas. Reason: ${reason}`)
    
    await this.kubernetesClient.scaleDeployment(deployment, targetReplicas)
    
    await this.recordScalingEvent({
      deployment,
      targetReplicas,
      reason,
      timestamp: new Date()
    })
    
    // Send notification
    await this.sendScalingNotification(deployment, targetReplicas, reason)
  }
}

// Load Balancing Strategy
class LoadBalancer {
  private providerClients: Map<string, LLMProviderClient>
  private healthChecks: Map<string, ProviderHealth>
  private requestCounts: Map<string, number>
  private responseTimesQueue: Map<string, number[]>
  
  constructor() {
    this.providerClients = new Map()
    this.healthChecks = new Map()
    this.requestCounts = new Map()
    this.responseTimesQueue = new Map()
    
    this.initializeProviders()
    this.startHealthMonitoring()
  }
  
  async selectProvider(requestType: string): Promise<string> {
    const availableProviders = await this.getHealthyProviders()
    
    if (availableProviders.length === 0) {
      throw new Error('No healthy LLM providers available')
    }
    
    // Weighted round-robin based on performance and load
    const weights = await this.calculateProviderWeights(availableProviders, requestType)
    
    return this.weightedSelection(availableProviders, weights)
  }
  
  private async calculateProviderWeights(
    providers: string[], 
    requestType: string
  ): Promise<Map<string, number>> {
    const weights = new Map<string, number>()
    
    for (const provider of providers) {
      const health = this.healthChecks.get(provider)
      const load = this.requestCounts.get(provider) || 0
      const avgResponseTime = this.getAverageResponseTime(provider)
      const historicalAccuracy = await this.getHistoricalAccuracy(provider, requestType)
      
      // Weight calculation: accuracy (40%) + response time (30%) + availability (20%) + load (10%)
      const accuracyScore = historicalAccuracy
      const responseTimeScore = Math.max(0, 1 - (avgResponseTime / 30000)) // 30s max
      const availabilityScore = health?.availability || 0
      const loadScore = Math.max(0, 1 - (load / 100)) // Normalize by max expected load
      
      const weight = (
        accuracyScore * 0.4 +
        responseTimeScore * 0.3 +
        availabilityScore * 0.2 +
        loadScore * 0.1
      )
      
      weights.set(provider, weight)
    }
    
    return weights
  }
  
  private weightedSelection(providers: string[], weights: Map<string, number>): string {
    const totalWeight = Array.from(weights.values()).reduce((sum, weight) => sum + weight, 0)
    let random = Math.random() * totalWeight
    
    for (const provider of providers) {
      const weight = weights.get(provider) || 0
      random -= weight
      if (random <= 0) {
        return provider
      }
    }
    
    // Fallback to first provider
    return providers[0]
  }
  
  async recordRequestMetrics(provider: string, responseTime: number, success: boolean): Promise<void> {
    // Update request count
    this.requestCounts.set(provider, (this.requestCounts.get(provider) || 0) + 1)
    
    // Update response time queue (keep last 100 requests)
    const responseTimes = this.responseTimesQueue.get(provider) || []
    responseTimes.push(responseTime)
    if (responseTimes.length > 100) {
      responseTimes.shift()
    }
    this.responseTimesQueue.set(provider, responseTimes)
    
    // Update health status
    const health = this.healthChecks.get(provider)
    if (health) {
      health.lastRequestTime = Date.now()
      health.successRate = this.calculateSuccessRate(provider, success)
    }
  }
}
```

---

## 10. Implementation Roadmap

### 10.1 Development Phases and Timeline

#### 10.1.1 Phase 1: Foundation and Infrastructure (Weeks 1-3)

**Week 1: Project Setup and Core Infrastructure**
```bash
# Development Environment Setup
- Initialize monorepo structure with Lerna/NX
- Setup Docker development environment
- Configure CI/CD pipeline with GitHub Actions
- Setup development databases (PostgreSQL + Redis)
- Establish code quality standards (ESLint, Prettier, Husky)

# Infrastructure as Code
- Terraform configuration for AWS resources
- Kubernetes manifests for local development
- Environment configuration management
- Secrets management setup
```

**Week 2: Backend Foundation**
```typescript
// Core backend services scaffold
- API Gateway service with Express.js
- Database schema implementation with Prisma
- Session management service
- File processing service foundation
- Basic health check endpoints
- Logging and monitoring setup
```

**Week 3: Frontend Foundation and LLM Integration**
```typescript
// Frontend application scaffold
- React application with TypeScript
- Material-UI component library setup
- PDF.js integration for file handling
- WebSocket client for real-time communication

// LLM Provider Integration
- OpenAI GPT-4V client implementation
- Anthropic Claude client implementation  
- Google Gemini client implementation
- Basic circuit breaker pattern
```

**Deliverables:**
- Working development environment for all team members
- Basic file upload and processing pipeline
- Individual LLM provider integrations functional
- CI/CD pipeline operational with automated testing

**Success Criteria:**
- All services start successfully in development environment
- Can upload PDF and convert to images
- Each LLM provider responds to basic queries
- Automated tests pass in CI pipeline

#### 10.1.2 Phase 2: Core Features Implementation (Weeks 4-7)

**Week 4: Multi-Model Ensemble and Orchestration**
```typescript
// LLM Orchestration Service
class LLMEnsemble {
  // Parallel processing implementation
  // Response aggregation algorithms  
  // Consensus building mechanisms
  // Error handling and fallback logic
}

// Performance optimizations
- Async/await patterns for parallel processing
- Timeout handling for LLM requests
- Response caching mechanisms
- Cost tracking and optimization
```

**Week 5: Interactive Q&A System**
```typescript
// Query Processing Pipeline
- Natural language query validation
- Context management from session history
- Response formatting and structuring
- Real-time progress updates via WebSocket

// Frontend Q&A Interface
- Chat-like interface components
- Query history management
- Response display with formatting
- Loading states and error handling
```

**Week 6: Component Identification and Analysis**
```typescript
// Component Identification Service
- Symbol detection algorithms
- Component description generation
- Location mapping and coordinates
- Cross-reference system between components

// Analysis Result Processing
- Component clustering and deduplication
- Confidence scoring for identifications
- Visual overlay generation for frontend
```

**Week 7: Response Aggregation and Comparison**
```typescript
// Response Aggregator Service
- Multi-model response comparison
- Confidence scoring algorithms
- Agreement/disagreement detection
- Model performance tracking

// Model Comparison Dashboard
- Side-by-side response display
- Agreement visualization
- User preference collection
- Feedback integration
```

**Deliverables:**
- Fully functional multi-model ensemble
- Working Q&A interface with real-time responses
- Component identification system with visual feedback
- Model comparison dashboard

**Success Criteria:**
- All three LLM providers process queries in parallel
- Users can ask questions and receive aggregated responses
- Component identification shows 80%+ accuracy on test cases
- Response aggregation provides meaningful confidence scores

#### 10.1.3 Phase 3: Advanced Features and Optimization (Weeks 8-10)

**Week 8: Schematic Recreation and Visualization**
```typescript
// Schematic Generator Service
- SVG-based schematic creation
- Component positioning algorithms
- Connection tracing and visualization
- Interactive schematic display

// Schematic Optimization
- Layout algorithms for clarity
- Component symbol standardization
- Connection routing optimization
- Export functionality
```

**Week 9: Performance Optimization and Caching**
```typescript
// Performance Enhancements
- Query result caching with Redis
- Image optimization for LLM processing
- Database query optimization
- Response time improvements

// Caching Strategy Implementation
- Similar query detection
- Image-based cache keys
- Cache invalidation policies
- Performance monitoring
```

**Week 10: Security Hardening and Monitoring**
```typescript
// Security Implementation
- Input validation and sanitization
- File upload security scanning
- Rate limiting and abuse prevention
- API key rotation and protection

// Monitoring and Observability
- Prometheus metrics collection
- Grafana dashboard setup
- ELK stack for logging
- Alert configuration
```

**Deliverables:**
- Schematic recreation functionality
- Performance-optimized system with caching
- Security-hardened application
- Comprehensive monitoring and alerting

**Success Criteria:**
- Schematic generation works for basic electrical circuits
- System performance meets sub-15 second response targets
- Security audit shows no critical vulnerabilities
- Monitoring provides full system visibility

#### 10.1.4 Phase 4: Testing, Validation, and Deployment (Weeks 11-12)

**Week 11: User Testing and Validation**
```bash
# User Testing Program
- Recruit 10+ electrical professionals
- Conduct structured testing sessions
- Collect detailed feedback and usage data
- Performance monitoring under real usage

# Testing Infrastructure
- Load testing with 100+ concurrent users
- Accuracy validation with expert panel
- Usability testing with target personas
- Security penetration testing
```

**Week 12: Production Deployment and Launch Preparation**
```bash
# Production Environment
- Production infrastructure deployment
- SSL certificate configuration
- Domain setup and DNS configuration
- Production database migration

# Launch Readiness
- Final bug fixes and optimization
- Documentation completion
- Success metrics validation
- Go/No-Go decision framework
```

**Deliverables:**
- Production-ready application deployed
- User testing results and feedback analysis
- Performance validation under load
- Launch decision documentation

**Success Criteria:**
- All MVP success criteria met (90% accuracy, <15s response time)
- Positive user feedback from 10+ electrical professionals
- System passes load testing for 100+ concurrent users
- Security and compliance requirements satisfied

### 10.2 Risk Mitigation and Contingency Planning

#### 10.2.1 Technical Risk Mitigation Schedule

**Weeks 1-2: API and Infrastructure Risks**
- Test all LLM provider APIs for reliability and performance
- Implement circuit breaker patterns early
- Setup monitoring for API rate limits and costs
- Create fallback mechanisms for provider failures

**Weeks 3-4: Accuracy and Performance Risks**
- Establish accuracy baseline with test dataset
- Implement performance monitoring from day one
- Create optimization strategies for response times
- Setup automated performance regression testing

**Weeks 5-6: Scalability and Integration Risks**
- Test concurrent processing with multiple users
- Validate database performance under load
- Implement auto-scaling policies early
- Test WebSocket connections under stress

**Weeks 7-8: Security and Compliance Risks**
- Security audit at mid-point of development
- Implement data protection measures early
- Test file upload security thoroughly
- Validate GDPR compliance mechanisms

#### 10.2.2 Resource and Timeline Contingencies

**Development Velocity Risks:**
- Buffer time built into each phase (20% contingency)
- Parallel development streams where possible
- External contractor identification for critical skills
- Scope reduction plan if timeline pressure increases

**Quality Assurance Contingencies:**
- Automated testing from Week 1
- Continuous integration with quality gates
- User testing throughout development, not just at end
- Expert validation panel established early

**Market and User Acceptance Risks:**
- Early user feedback collection (Week 6+)
- Iterative design improvements based on feedback
- Feature prioritization based on user value
- Market positioning adjustments based on testing

### 10.3 Success Metrics Tracking Schedule

#### 10.3.1 Technical Metrics (Weekly)
```typescript
// Automated Metrics Collection
interface WeeklyMetrics {
  accuracy: {
    componentIdentification: number
    questionAnswering: number
    expertAgreement: number
  }
  performance: {
    averageResponseTime: number
    p95ResponseTime: number
    systemUptime: number
    errorRate: number
  }
  usage: {
    totalQueries: number
    activeUsers: number
    sessionDuration: number
    queryCompletion: number
  }
}
```

#### 10.3.2 User Experience Metrics (Bi-weekly)
- User satisfaction surveys
- Task completion rate analysis
- Feature usage analytics
- Feedback sentiment analysis

#### 10.3.3 Business Validation Metrics (Monthly)
- Willingness to pay assessment
- Commercial viability indicators
- Market fit validation
- Competitive positioning analysis

---

## 11. Technical Decision Rationale

### 11.1 Architecture Decisions

#### 11.1.1 Microservices vs Monolithic Architecture

**Decision: Microservices Architecture**

**Rationale:**
- **Scalability**: Different services have different scaling requirements (LLM orchestrator needs more compute, file processor needs more I/O)
- **Technology Diversity**: Each service can use optimal technology stack (e.g., Node.js for API, Python for ML processing if needed)
- **Fault Isolation**: LLM provider failures don't affect file processing or session management
- **Team Scaling**: As team grows, services can be owned by different developers
- **Deployment Flexibility**: Services can be deployed and updated independently

**Trade-offs Considered:**
- Increased complexity in service communication
- Distributed system challenges (network latency, partial failures)
- More complex deployment and monitoring
- Higher infrastructure overhead

**Mitigation Strategies:**
- Service mesh for communication management
- Comprehensive monitoring and tracing
- Automated deployment pipelines
- Container orchestration with Kubernetes

#### 11.1.2 Database Technology Selection

**Decision: PostgreSQL as Primary Database**

**Rationale:**
- **ACID Compliance**: Critical for session and analytics data consistency
- **JSON Support**: Native JSONB for flexible metadata storage
- **Performance**: Excellent read/write performance for our data patterns
- **Ecosystem**: Rich ecosystem of tools and extensions
- **Scaling**: Proven horizontal scaling options (read replicas, sharding)

**Alternatives Considered:**
- **MongoDB**: Rejected due to consistency requirements and SQL ecosystem benefits
- **MySQL**: Rejected due to inferior JSON support and less advanced features
- **DynamoDB**: Rejected due to vendor lock-in and complex query limitations

**Complementary Technologies:**
- **Redis**: For caching and session management (speed and simplicity)
- **S3/Object Storage**: For temporary file storage (cost and durability)

#### 11.1.3 Frontend Technology Stack

**Decision: React + TypeScript + Material-UI**

**Rationale:**
- **React**: Large ecosystem, excellent performance, team familiarity
- **TypeScript**: Type safety critical for complex data structures and API interactions
- **Material-UI**: Consistent design system, accessibility built-in, rapid development
- **PDF.js**: Proven solution for PDF rendering in browsers

**Alternatives Considered:**
- **Vue.js**: Rejected due to smaller ecosystem and team expertise
- **Angular**: Rejected due to complexity overhead for our use case
- **Svelte**: Rejected due to smaller ecosystem and learning curve

#### 11.1.4 LLM Integration Strategy

**Decision: Multi-Provider Ensemble with Direct API Integration**

**Rationale:**
- **Accuracy**: Ensemble methods proven to increase accuracy over single models
- **Reliability**: Reduces dependence on any single provider
- **Performance**: Can optimize for speed by using fastest available provider
- **Cost Optimization**: Can balance cost vs. accuracy across providers
- **Competitive Advantage**: Unique approach compared to single-model competitors

**Alternatives Considered:**
- **Single Provider**: Rejected due to reliability and vendor lock-in risks
- **LangChain Framework**: Considered but adds complexity layer we don't need
- **Open Source Models**: Rejected due to infrastructure requirements and accuracy concerns
- **Fine-tuned Models**: Future consideration, not needed for MVP

### 11.2 Technology Stack Rationale

#### 11.2.1 Backend Technology Selection

**Primary Stack: Node.js + Express.js + TypeScript**

**Rationale:**
- **JavaScript Ecosystem**: Unified language across frontend and backend
- **Async Performance**: Excellent for I/O heavy operations (API calls, file processing)
- **LLM SDK Support**: Official SDKs available for all target LLM providers
- **Development Speed**: Rapid prototyping and iteration capabilities
- **Team Expertise**: Leverages existing JavaScript/TypeScript knowledge

**Performance Considerations:**
- Event-driven architecture ideal for handling multiple concurrent LLM requests
- Non-blocking I/O perfect for external API integration
- Horizontal scaling easier than vertical scaling

**Alternative Considerations:**
- **Python**: Considered for ML ecosystem but rejected due to performance for web API
- **Go**: Considered for performance but rejected due to ecosystem and development speed
- **Java**: Rejected due to complexity and development velocity

#### 11.2.2 Infrastructure and Deployment

**Primary Strategy: Kubernetes on Cloud Provider**

**Rationale:**
- **Container Orchestration**: Essential for microservices management
- **Auto-scaling**: Built-in horizontal and vertical scaling capabilities
- **Service Discovery**: Native service mesh capabilities
- **Rolling Deployments**: Zero-downtime deployment capabilities
- **Multi-cloud**: Kubernetes provides abstraction layer for cloud portability

**Cloud Provider Selection:**
- **AWS**: Primary choice due to mature services and EKS
- **Azure**: Secondary option with strong Kubernetes support
- **GCP**: Alternative with excellent ML/AI service integration

**Deployment Strategy:**
- **Infrastructure as Code**: Terraform for reproducible infrastructure
- **GitOps**: ArgoCD or Flux for declarative deployment management
- **CI/CD**: GitHub Actions for comprehensive automation

#### 11.2.3 Monitoring and Observability

**Stack: Prometheus + Grafana + ELK + Jaeger**

**Rationale:**
- **Metrics**: Prometheus for time-series metrics collection
- **Visualization**: Grafana for comprehensive dashboards
- **Logging**: ELK stack for centralized log management
- **Tracing**: Jaeger for distributed request tracing
- **Open Source**: Vendor-neutral, extensible solutions

**Integration Strategy:**
- **Application Metrics**: Custom business metrics alongside infrastructure metrics
- **Alerting**: PagerDuty integration for critical alerts
- **Cost Monitoring**: CloudWatch/Azure Monitor for cloud resource costs
- **User Analytics**: Mixpanel or Amplitude for user behavior tracking

### 11.3 Security and Compliance Decisions

#### 11.3.1 Data Protection Strategy

**Decision: Zero Persistence of User Documents**

**Rationale:**
- **Privacy by Design**: Eliminates data breach risks for user documents
- **Regulatory Compliance**: Simplifies GDPR and privacy compliance
- **Trust Building**: Clear value proposition for privacy-conscious users
- **Reduced Liability**: Minimizes legal and financial exposure

**Implementation:**
- 24-hour maximum retention for temporary processing
- Automatic cleanup processes with monitoring
- Encrypted storage for temporary files
- Audit logging for all data access

#### 11.3.2 Authentication and Authorization

**Decision: JWT-based Session Management**

**Rationale:**
- **Stateless**: Reduces server-side session storage requirements
- **Scalability**: No shared session state across service instances
- **Performance**: Faster than database-backed sessions
- **Security**: Industry-standard token-based authentication

**Security Measures:**
- Short-lived access tokens (15 minutes)
- Refresh token rotation
- Rate limiting per session and IP
- API key rotation for LLM providers

#### 11.3.3 Input Validation and Sanitization

**Decision: Multi-layer Validation Approach**

**Rationale:**
- **Defense in Depth**: Multiple validation layers reduce attack surface
- **Type Safety**: TypeScript provides compile-time validation
- **Runtime Validation**: express-validator for runtime input checking
- **File Security**: Dedicated scanning for uploaded PDF files

**Validation Layers:**
1. Frontend validation for user experience
2. API gateway validation for security
3. Service-level validation for business logic
4. Database constraints for data integrity

---

## 12. Appendices

### 12.1 Appendix A: Database Schema Reference

#### 12.1.1 Complete Database Schema
```sql
-- Complete database schema for electrical drawing analysis system
-- PostgreSQL 15+ with required extensions

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create application schema
CREATE SCHEMA IF NOT EXISTS electrical_analysis;
SET search_path TO electrical_analysis, public;

-- Sessions table for temporary session management
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated')),
    metadata JSONB DEFAULT '{}',
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table for uploaded files
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size > 0),
    content_type VARCHAR(100) NOT NULL,
    upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_status VARCHAR(20) DEFAULT 'uploaded' 
        CHECK (processing_status IN ('uploaded', 'processing', 'ready', 'error')),
    file_path TEXT NOT NULL,
    image_paths TEXT[], -- Array of converted image paths
    page_count INTEGER,
    processing_metadata JSONB DEFAULT '{}',
    checksum VARCHAR(64) -- SHA-256 checksum for integrity
);

-- Queries table for user questions
CREATE TABLE queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    document_ids UUID[] DEFAULT '{}', -- Array of document references
    query_text TEXT NOT NULL,
    query_type VARCHAR(50) NOT NULL 
        CHECK (query_type IN ('component_identification', 'general_question', 'schematic_analysis')),
    query_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_start_time TIMESTAMP WITH TIME ZONE,
    processing_end_time TIMESTAMP WITH TIME ZONE,
    response_time_ms INTEGER,
    user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
    user_feedback TEXT,
    context_data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Model responses for ensemble tracking
CREATE TABLE model_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_id UUID REFERENCES queries(id) ON DELETE CASCADE,
    model_name VARCHAR(50) NOT NULL,
    model_version VARCHAR(20),
    response_text TEXT NOT NULL,
    response_structured JSONB, -- Structured response data
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    api_response_time_ms INTEGER,
    api_cost_usd DECIMAL(8,4),
    tokens_used INTEGER,
    tokens_prompt INTEGER,
    tokens_completion INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    provider_metadata JSONB DEFAULT '{}',
    error_details TEXT
);

-- Component identifications
CREATE TABLE component_identifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_id UUID REFERENCES queries(id) ON DELETE CASCADE,
    model_response_id UUID REFERENCES model_responses(id),
    component_type VARCHAR(100) NOT NULL,
    component_description TEXT,
    location_x DECIMAL(8,2),
    location_y DECIMAL(8,2),
    bounding_box JSONB, -- {x, y, width, height}
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    model_consensus JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    page_number INTEGER DEFAULT 1,
    component_properties JSONB DEFAULT '{}'
);

-- Aggregated analysis results
CREATE TABLE analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_id UUID REFERENCES queries(id) ON DELETE CASCADE,
    aggregated_answer TEXT,
    confidence_overall DECIMAL(3,2),
    confidence_breakdown JSONB,
    model_agreement_score DECIMAL(3,2),
    processing_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schematic data
CREATE TABLE schematic_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_id UUID REFERENCES queries(id) ON DELETE CASCADE,
    schematic_svg TEXT,
    schematic_metadata JSONB DEFAULT '{}',
    components JSONB DEFAULT '[]',
    connections JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics and metrics
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(50),
    event_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    ip_address INET
);

-- System metrics tracking
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4),
    metric_unit VARCHAR(20),
    metric_tags JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User feedback and ratings
CREATE TABLE user_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    query_id UUID REFERENCES queries(id) ON DELETE CASCADE,
    feedback_type VARCHAR(50) NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    feedback_text TEXT,
    feedback_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API usage tracking
CREATE TABLE api_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_time_ms INTEGER,
    tokens_used INTEGER,
    cost_usd DECIMAL(8,4),
    success BOOLEAN DEFAULT TRUE,
    error_details TEXT,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_last_activity ON sessions(last_activity);

CREATE INDEX idx_documents_session_id ON documents(session_id);
CREATE INDEX idx_documents_processing_status ON documents(processing_status);
CREATE INDEX idx_documents_upload_timestamp ON documents(upload_timestamp);

CREATE INDEX idx_queries_session_id ON queries(session_id);
CREATE INDEX idx_queries_query_type ON queries(query_type);
CREATE INDEX idx_queries_timestamp ON queries(query_timestamp);
CREATE INDEX idx_queries_status ON queries(status);

CREATE INDEX idx_model_responses_query_id ON model_responses(query_id);
CREATE INDEX idx_model_responses_model ON model_responses(model_name, model_version);
CREATE INDEX idx_model_responses_created_at ON model_responses(created_at);

CREATE INDEX idx_component_identifications_query_id ON component_identifications(query_id);
CREATE INDEX idx_component_identifications_type ON component_identifications(component_type);

CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_session ON analytics_events(session_id);

CREATE INDEX idx_system_metrics_name_timestamp ON system_metrics(metric_name, timestamp);
CREATE INDEX idx_api_usage_provider_timestamp ON api_usage(provider, request_timestamp);

-- Create views for common queries
CREATE VIEW session_summary AS
SELECT 
    s.id,
    s.created_at,
    s.expires_at,
    s.status,
    COUNT(DISTINCT d.id) as document_count,
    COUNT(DISTINCT q.id) as query_count,
    MAX(q.query_timestamp) as last_query_time,
    AVG(q.response_time_ms) as avg_response_time
FROM sessions s
LEFT JOIN documents d ON s.id = d.session_id
LEFT JOIN queries q ON s.id = q.session_id
GROUP BY s.id, s.created_at, s.expires_at, s.status;

CREATE VIEW query_performance AS
SELECT 
    q.id,
    q.query_type,
    q.response_time_ms,
    COUNT(mr.id) as model_count,
    AVG(mr.confidence_score) as avg_confidence,
    AVG(mr.api_response_time_ms) as avg_api_time,
    SUM(mr.api_cost_usd) as total_cost
FROM queries q
LEFT JOIN model_responses mr ON q.id = mr.query_id
WHERE q.status = 'completed'
GROUP BY q.id, q.query_type, q.response_time_ms;

CREATE VIEW daily_metrics AS
SELECT 
    DATE(timestamp) as date,
    COUNT(DISTINCT session_id) as daily_active_sessions,
    COUNT(*) as total_events,
    COUNT(CASE WHEN event_type = 'analysis_request' THEN 1 END) as analysis_requests,
    COUNT(CASE WHEN event_type = 'user_feedback' THEN 1 END) as feedback_events
FROM analytics_events 
GROUP BY DATE(timestamp)
ORDER BY DATE(timestamp) DESC;

-- Functions for data cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_analytics(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM analytics_events 
    WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic cleanup
CREATE OR REPLACE FUNCTION update_last_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE sessions 
    SET last_activity = NOW() 
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_session_activity_on_query
    AFTER INSERT ON queries
    FOR EACH ROW
    EXECUTE FUNCTION update_last_activity();

-- Grant permissions (adjust as needed for your user)
GRANT USAGE ON SCHEMA electrical_analysis TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA electrical_analysis TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA electrical_analysis TO app_user;
```

### 12.2 Appendix B: API Documentation

#### 12.2.1 Complete OpenAPI Specification
```yaml
openapi: 3.0.3
info:
  title: Electrical Drawing Analysis API
  version: 1.0.0
  description: |
    Multi-model LLM ensemble API for intelligent analysis of electrical drawings.
    
    ## Features
    - Upload and process electrical drawings (PDF format)
    - Interactive Q&A system for drawing analysis
    - Component identification and description
    - Multi-model ensemble for improved accuracy
    - Real-time analysis progress updates
    
    ## Authentication
    API uses JWT-based authentication with session management.
    
    ## Rate Limiting
    - General endpoints: 100 requests per 15 minutes per IP
    - Analysis endpoints: 10 requests per minute per session
    
  contact:
    name: API Support
    email: support@electrical-analysis.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.electrical-analysis.com/v1
    description: Production server
  - url: https://staging-api.electrical-analysis.com/v1
    description: Staging server
  - url: http://localhost:3001/v1
    description: Development server

security:
  - BearerAuth: []

paths:
  /health:
    get:
      summary: Health check endpoint
      description: Returns the health status of the API and its dependencies
      tags:
        - System
      security: []
      responses:
        '200':
          description: Service is healthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthStatus'
        '503':
          description: Service is unhealthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthStatus'

  /sessions:
    post:
      summary: Create new analysis session
      description: Creates a new session for uploading documents and performing analysis
      tags:
        - Sessions
      security: []
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                metadata:
                  type: object
                  description: Optional session metadata
                  example:
                    userType: "contractor"
                    projectType: "commercial"
      responses:
        '201':
          description: Session created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SessionResponse'
        '400':
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /sessions/{sessionId}:
    get:
      summary: Get session information
      description: Retrieves information about a specific session
      tags:
        - Sessions
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
            format: uuid
          description: Session identifier
      responses:
        '200':
          description: Session information retrieved successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Session'
        '404':
          description: Session not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

    delete:
      summary: Terminate session
      description: Terminates a session and cleans up associated data
      tags:
        - Sessions
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '204':
          description: Session terminated successfully
        '404':
          description: Session not found

  /sessions/{sessionId}/documents:
    post:
      summary: Upload documents for analysis
      description: |
        Upload PDF documents to a session for analysis. 
        
        **Limits:**
        - Maximum 3 files per session
        - Maximum 10MB per file
        - PDF format only
      tags:
        - Documents
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                files:
                  type: array
                  items:
                    type: string
                    format: binary
                  maxItems: 3
                  description: PDF files to upload
              required:
                - files
      responses:
        '201':
          description: Documents uploaded successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  documents:
                    type: array
                    items:
                      $ref: '#/components/schemas/Document'
                  processingStatus:
                    type: string
                    enum: [queued, processing, completed]
        '400':
          description: Invalid file upload
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '413':
          description: File too large
        '415':
          description: Unsupported file type

    get:
      summary: List session documents
      description: Get list of documents uploaded to a session
      tags:
        - Documents
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Documents retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  documents:
                    type: array
                    items:
                      $ref: '#/components/schemas/Document'

  /sessions/{sessionId}/analyze:
    post:
      summary: Analyze uploaded documents
      description: |
        Perform analysis on uploaded documents using multi-model LLM ensemble.
        
        **Query Types:**
        - `component_identification`: Identify and describe electrical components
        - `general_question`: Ask natural language questions about the drawing
        - `schematic_analysis`: Analyze circuit functionality and connections
      tags:
        - Analysis
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/AnalysisRequest'
      responses:
        '200':
          description: Analysis completed successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AnalysisResponse'
        '400':
          description: Invalid analysis request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: Session or documents not found
        '422':
          description: Documents not ready for analysis
        '429':
          description: Rate limit exceeded

  /sessions/{sessionId}/queries:
    get:
      summary: Get session query history
      description: Retrieve history of queries and responses for a session
      tags:
        - Analysis
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
          description: Maximum number of queries to return
        - name: offset
          in: query
          schema:
            type: integer
            minimum: 0
            default: 0
          description: Number of queries to skip
      responses:
        '200':
          description: Query history retrieved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  queries:
                    type: array
                    items:
                      $ref: '#/components/schemas/QueryWithResponse'
                  total:
                    type: integer
                  hasMore:
                    type: boolean

  /sessions/{sessionId}/feedback:
    post:
      summary: Submit user feedback
      description: Submit feedback on analysis results or overall experience
      tags:
        - Feedback
      parameters:
        - name: sessionId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/FeedbackRequest'
      responses:
        '201':
          description: Feedback submitted successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                    format: uuid
                  message:
                    type: string
                    example: "Thank you for your feedback"

  /metrics:
    get:
      summary: Get system metrics
      description: Retrieve system performance and usage metrics (Prometheus format)
      tags:
        - System
      security:
        - ApiKeyAuth: []
      responses:
        '200':
          description: Metrics in Prometheus format
          content:
            text/plain:
              schema:
                type: string
                example: |
                  # HELP http_requests_total Total number of HTTP requests
                  # TYPE http_requests_total counter
                  http_requests_total{method="GET",status="200"} 1234

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key

  schemas:
    Session:
      type: object
      properties:
        id:
          type: string
          format: uuid
          description: Unique session identifier
        createdAt:
          type: string
          format: date-time
          description: Session creation timestamp
        expiresAt:
          type: string
          format: date-time
          description: Session expiration timestamp
        status:
          type: string
          enum: [active, expired, terminated]
          description: Current session status
        metadata:
          type: object
          description: Session metadata
      required:
        - id
        - createdAt
        - expiresAt
        - status

    SessionResponse:
      allOf:
        - $ref: '#/components/schemas/Session'
        - type: object
          properties:
            accessToken:
              type: string
              description: JWT access token for session
            refreshToken:
              type: string
              description: JWT refresh token
          required:
            - accessToken
            - refreshToken

    Document:
      type: object
      properties:
        id:
          type: string
          format: uuid
          description: Unique document identifier
        filename:
          type: string
          description: Original filename
        size:
          type: integer
          description: File size in bytes
        contentType:
          type: string
          description: MIME type
        uploadedAt:
          type: string
          format: date-time
          description: Upload timestamp
        processingStatus:
          type: string
          enum: [uploaded, processing, ready, error]
          description: Document processing status
        pageCount:
          type: integer
          description: Number of pages in document
        metadata:
          type: object
          description: Document metadata
      required:
        - id
        - filename
        - size
        - contentType
        - uploadedAt
        - processingStatus

    AnalysisRequest:
      type: object
      properties:
        query:
          type: string
          minLength: 1
          maxLength: 1000
          description: Analysis query or question
          example: "What type of electrical panel is shown in this drawing?"
        queryType:
          type: string
          enum: [component_identification, general_question, schematic_analysis]
          description: Type of analysis to perform
        documentIds:
          type: array
          items:
            type: string
            format: uuid
          description: Specific documents to analyze (optional, defaults to all)
        context:
          type: object
          description: Additional context for the query
          properties:
            focusArea:
              type: object
              description: Specific area of drawing to focus on
              properties:
                x:
                  type: number
                y:
                  type: number
                width:
                  type: number
                height:
                  type: number
            previousQueries:
              type: array
              items:
                type: string
              description: Related previous queries for context
      required:
        - query
        - queryType

    AnalysisResponse:
      type: object
      properties:
        id:
          type: string
          format: uuid
          description: Unique response identifier
        query:
          type: string
          description: Original query text
        answer:
          type: string
          description: Aggregated answer from ensemble
        components:
          type: array
          items:
            $ref: '#/components/schemas/ComponentIdentification'
          description: Identified electrical components
        confidence:
          $ref: '#/components/schemas/ConfidenceScore'
        modelComparison:
          $ref: '#/components/schemas/ModelComparison'
        schematicData:
          $ref: '#/components/schemas/SchematicData'
        processingTime:
          type: integer
          description: Total processing time in milliseconds
        timestamp:
          type: string
          format: date-time
          description: Response generation timestamp
        metadata:
          type: object
          description: Additional response metadata
      required:
        - id
        - query
        - answer
        - confidence
        - processingTime
        - timestamp

    ComponentIdentification:
      type: object
      properties:
        id:
          type: string
          format: uuid
        type:
          type: string
          description: Component type (e.g., "circuit_breaker", "outlet", "switch")
          example: "circuit_breaker"
        description:
          type: string
          description: Detailed component description
          example: "20A single-pole circuit breaker"
        location:
          type: object
          properties:
            x:
              type: number
              description: X coordinate (normalized 0-1)
            y:
              type: number
              description: Y coordinate (normalized 0-1)
            page:
              type: integer
              description: Page number (1-based)
          required:
            - x
            - y
            - page
        boundingBox:
          type: object
          properties:
            x:
              type: number
            y:
              type: number
            width:
              type: number
            height:
              type: number
          description: Component bounding box
        confidence:
          type: number
          minimum: 0
          maximum: 1
          description: Confidence score for identification
        properties:
          type: object
          description: Component-specific properties
          additionalProperties: true
        connections:
          type: array
          items:
            type: string
            format: uuid
          description: IDs of connected components
      required:
        - id
        - type
        - description
        - location
        - confidence

    ConfidenceScore:
      type: object
      properties:
        overall:
          type: number
          minimum: 0
          maximum: 1
          description: Overall confidence score
        agreement:
          type: number
          minimum: 0
          maximum: 1
          description: Model agreement score
        completeness:
          type: number
          minimum: 0
          maximum: 1
          description: Response completeness score
        consistency:
          type: number
          minimum: 0
          maximum: 1
          description: Internal consistency score
        factors:
          type: object
          properties:
            modelConsensus:
              type: number
              minimum: 0
              maximum: 1
            responseQuality:
              type: number
              minimum: 0
              maximum: 1
            logicalConsistency:
              type: number
              minimum: 0
              maximum: 1
          description: Detailed confidence factors
      required:
        - overall
        - agreement
        - completeness
        - consistency

    ModelComparison:
      type: object
      properties:
        models:
          type: array
          items:
            $ref: '#/components/schemas/ModelResponse'
          description: Individual model responses
        consensus:
          type: object
          properties:
            agreement:
              type: number
              minimum: 0
              maximum: 1
            disagreements:
              type: array
              items:
                type: object
                properties:
                  aspect:
                    type: string
                  models:
                    type: array
                    items:
                      type: string
                  details:
                    type: string
          description: Consensus analysis
      required:
        - models

    ModelResponse:
      type: object
      properties:
        model:
          type: string
          description: Model identifier
          example: "gpt-4-vision-preview"
        provider:
          type: string
          description: Provider name
          example: "openai"
        response:
          type: string
          description: Model's response text
        confidence:
          type: number
          minimum: 0
          maximum: 1
          description: Model's confidence score
        responseTime:
          type: integer
          description: Response time in milliseconds
        cost:
          type: number
          description: Request cost in USD
        tokensUsed:
          type: integer
          description: Number of tokens consumed
        success:
          type: boolean
          description: Whether the request was successful
        error:
          type: string
          description: Error message if request failed
      required:
        - model
        - provider
        - success

    SchematicData:
      type: object
      properties:
        svg:
          type: string
          description: SVG representation of schematic
        components:
          type: array
          items:
            type: object
            properties:
              id:
                type: string
              type:
                type: string
              position:
                type: object
                properties:
                  x:
                    type: number
                  y:
                    type: number
              properties:
                type: object
                additionalProperties: true
          description: Schematic components
        connections:
          type: array
          items:
            type: object
            properties:
              from:
                type: string
                description: Source component ID
              to:
                type: string
                description: Target component ID
              type:
                type: string
                description: Connection type
          description: Component connections
        metadata:
          type: object
          description: Schematic metadata
      required:
        - components
        - connections

    QueryWithResponse:
      type: object
      properties:
        id:
          type: string
          format: uuid
        query:
          type: string
        queryType:
          type: string
        timestamp:
          type: string
          format: date-time
        response:
          $ref: '#/components/schemas/AnalysisResponse'
        userRating:
          type: integer
          minimum: 1
          maximum: 5
        userFeedback:
          type: string
      required:
        - id
        - query
        - queryType
        - timestamp

    FeedbackRequest:
      type: object
      properties:
        queryId:
          type: string
          format: uuid
          description: ID of query being rated (optional)
        feedbackType:
          type: string
          enum: [rating, bug_report, feature_request, general]
          description: Type of feedback
        rating:
          type: integer
          minimum: 1
          maximum: 5
          description: Rating score (required for rating type)
        text:
          type: string
          maxLength: 2000
          description: Detailed feedback text
        category:
          type: string
          enum: [accuracy, speed, usability, features, other]
          description: Feedback category
        metadata:
          type: object
          description: Additional feedback metadata
      required:
        - feedbackType

    HealthStatus:
      type: object
      properties:
        status:
          type: string
          enum: [healthy, degraded, unhealthy]
          description: Overall system health status
        timestamp:
          type: string
          format: date-time
          description: Health check timestamp
        totalResponseTime:
          type: integer
          description: Total health check time in milliseconds
        components:
          type: object
          additionalProperties:
            type: object
            properties:
              status:
                type: string
                enum: [healthy, unhealthy]
              responseTime:
                type: integer
              lastChecked:
                type: string
                format: date-time
              error:
                type: string
          description: Individual component health status
      required:
        - status
        - timestamp
        - components

    ErrorResponse:
      type: object
      properties:
        error:
          type: string
          description: Error message
        code:
          type: string
          description: Error code
        details:
          type: object
          description: Additional error details
        timestamp:
          type: string
          format: date-time
          description: Error timestamp
        requestId:
          type: string
          description: Request identifier for debugging
      required:
        - error
        - timestamp

  responses:
    BadRequest:
      description: Bad request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
    
    Unauthorized:
      description: Unauthorized
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
    
    Forbidden:
      description: Forbidden
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
    
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
    
    TooManyRequests:
      description: Too many requests
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
          example:
            error: "Rate limit exceeded"
            code: "RATE_LIMIT_EXCEEDED"
            details:
              limit: 10
              window: 60
              retry_after: 45
            timestamp: "2025-08-02T10:30:00Z"
    
    InternalServerError:
      description: Internal server error
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'

tags:
  - name: System
    description: System health and diagnostics
  - name: Sessions
    description: Session management
  - name: Documents
    description: Document upload and management
  - name: Analysis
    description: Electrical drawing analysis
  - name: Feedback
    description: User feedback and ratings
```

### 12.3 Appendix C: Configuration Templates

#### 12.3.1 Environment Configuration
```yaml
# .env.example - Environment variable template

# Application Configuration
NODE_ENV=development
APP_VERSION=1.0.0
API_PORT=3001
LOG_LEVEL=info

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/electrical_analysis
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_CONNECTION_TIMEOUT=5000
DB_STATEMENT_TIMEOUT=30000

# Redis Configuration  
REDIS_URL=redis://localhost:6379
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=1000

# Session Configuration
SESSION_SECRET=your-session-secret-here
SESSION_TIMEOUT=86400
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# File Upload Configuration
MAX_FILE_SIZE=10485760
MAX_FILES_PER_SESSION=3
UPLOAD_TEMP_DIR=/tmp/uploads
FILE_RETENTION_HOURS=24

# LLM Provider Configuration
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_API_KEY=your-google-key

# LLM Configuration
LLM_REQUEST_TIMEOUT=30000
LLM_MAX_RETRIES=3
LLM_CIRCUIT_BREAKER_THRESHOLD=5
LLM_CIRCUIT_BREAKER_TIMEOUT=30000

# Cloud Storage Configuration
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=electrical-analysis-files
S3_PRESIGNED_URL_EXPIRES=3600

# Monitoring Configuration
PROMETHEUS_PORT=9090
METRICS_ENABLED=true
TRACING_ENABLED=true
JAEGER_ENDPOINT=http://localhost:14268/api/traces

# Security Configuration
CORS_ORIGINS=http://localhost:3000,https://electrical-analysis.com
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
ANALYSIS_RATE_LIMIT_WINDOW=60000
ANALYSIS_RATE_LIMIT_MAX=10

# Email Configuration (for alerts)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Slack Configuration (for alerts)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx

# Feature Flags
ENABLE_CACHING=true
ENABLE_ANALYTICS=true
ENABLE_SCHEMATIC_GENERATION=true
ENABLE_MODEL_COMPARISON=true

# Development Configuration
ENABLE_DEBUG_ROUTES=false
ENABLE_MOCK_LLM=false
LOG_SQL_QUERIES=false
```

#### 12.3.2 Docker Compose Development Setup
```yaml
# docker-compose.yml - Development environment
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: electrical-analysis-db
    environment:
      POSTGRES_DB: electrical_analysis
      POSTGRES_USER: dev_user
      POSTGRES_PASSWORD: dev_password
      POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256"
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev_user -d electrical_analysis"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: electrical-analysis-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # MinIO (S3-compatible storage for development)
  minio:
    image: minio/minio:latest
    container_name: electrical-analysis-storage
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  # Prometheus Monitoring
  prometheus:
    image: prom/prometheus:latest
    container_name: electrical-analysis-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

  # Grafana Dashboard
  grafana:
    image: grafana/grafana:latest
    container_name: electrical-analysis-grafana
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin123
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources

  # Jaeger Tracing
  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: electrical-analysis-jaeger
    ports:
      - "16686:16686"
      - "14268:14268"
    environment:
      COLLECTOR_OTLP_ENABLED: true

volumes:
  postgres_data:
  redis_data:
  minio_data:
  prometheus_data:
  grafana_data:

networks:
  default:
    name: electrical-analysis-network
```

#### 12.3.3 Kubernetes Production Configuration
```yaml
# k8s/production/namespace.yml
apiVersion: v1
kind: Namespace
metadata:
  name: electrical-analysis
  labels:
    name: electrical-analysis
    environment: production

---
# k8s/production/configmap.yml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: electrical-analysis
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  API_PORT: "3001"
  SESSION_TIMEOUT: "86400"
  MAX_FILE_SIZE: "10485760"
  MAX_FILES_PER_SESSION: "3"
  FILE_RETENTION_HOURS: "24"
  LLM_REQUEST_TIMEOUT: "30000"
  LLM_MAX_RETRIES: "3"
  RATE_LIMIT_WINDOW: "900000"
  RATE_LIMIT_MAX: "100"
  ANALYSIS_RATE_LIMIT_WINDOW: "60000"
  ANALYSIS_RATE_LIMIT_MAX: "10"
  ENABLE_CACHING: "true"
  ENABLE_ANALYTICS: "true"
  ENABLE_SCHEMATIC_GENERATION: "true"
  ENABLE_MODEL_COMPARISON: "true"

---
# k8s/production/secrets.yml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: electrical-analysis
type: Opaque
stringData:
  DATABASE_URL: "postgresql://prod_user:secure_password@rds-endpoint:5432/electrical_analysis"
  REDIS_URL: "redis://elasticache-endpoint:6379"
  JWT_SECRET: "super-secure-jwt-secret-256-bits-long"
  SESSION_SECRET: "super-secure-session-secret"
  OPENAI_API_KEY: "sk-your-production-openai-key"
  ANTHROPIC_API_KEY: "your-production-anthropic-key"
  GOOGLE_API_KEY: "your-production-google-key"
  AWS_ACCESS_KEY_ID: "your-aws-access-key"
  AWS_SECRET_ACCESS_KEY: "your-aws-secret-key"
  S3_BUCKET_NAME: "electrical-analysis-prod-files"
  SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/xxx"

---
# k8s/production/deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
  namespace: electrical-analysis
  labels:
    app: api-gateway
    version: v1
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3001"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: api-gateway
        image: electrical-analysis/api-gateway:v1.0.0
        ports:
        - containerPort: 3001
          name: http
        envFrom:
        - configMapRef:
            name: app-config
        - secretRef:
            name: app-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "200m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          successThreshold: 1
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          successThreshold: 1
          failureThreshold: 3
        volumeMounts:
        - name: temp-storage
          mountPath: /tmp
      volumes:
      - name: temp-storage
        emptyDir:
          sizeLimit: "1Gi"
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000

---
# k8s/production/service.yml
apiVersion: v1
kind: Service
metadata:
  name: api-gateway-service
  namespace: electrical-analysis
  labels:
    app: api-gateway
spec:
  selector:
    app: api-gateway
  ports:
  - port: 80
    targetPort: 3001
    protocol: TCP
    name: http
  type: ClusterIP

---
# k8s/production/hpa.yml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
  namespace: electrical-analysis
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60

---
# k8s/production/pdb.yml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-gateway-pdb
  namespace: electrical-analysis
spec:
  selector:
    matchLabels:
      app: api-gateway
  maxUnavailable: 1

---
# k8s/production/networkpolicy.yml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-gateway-network-policy
  namespace: electrical-analysis
spec:
  podSelector:
    matchLabels:
      app: api-gateway
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3001
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 5432  # PostgreSQL
    - protocol: TCP
      port: 6379  # Redis
    - protocol: TCP
      port: 443   # HTTPS (LLM APIs)
    - protocol: TCP
      port: 53    # DNS
    - protocol: UDP
      port: 53    # DNS
```

---

## Conclusion

This comprehensive System Architecture Document provides a complete technical blueprint for implementing the LLM-Powered Electrical Drawing Analysis App. The architecture is designed to be:

- **Scalable**: Microservices architecture with auto-scaling capabilities
- **Reliable**: Multi-provider LLM ensemble with comprehensive error handling
- **Secure**: Defense-in-depth security with GDPR compliance
- **Observable**: Full monitoring and analytics stack
- **Maintainable**: Clean separation of concerns and comprehensive documentation

The document serves as the authoritative technical reference for the development team, covering everything from high-level architectural decisions to specific implementation details. Each component has been carefully designed to meet the performance, security, and scalability requirements outlined in the PRD while providing a solid foundation for future expansion.

The implementation roadmap provides a clear path from initial development through production deployment, with specific milestones, success criteria, and risk mitigation strategies. This architecture will enable the development team to build a robust, scalable system that can demonstrate the viability of LLM-powered electrical drawing analysis and serve as the foundation for a commercial product.

### 10.1 Development Phases and Timeline

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"id": "analyze_requirements", "content": "Analyze PRD and extract detailed technical requirements", "status": "completed", "priority": "high"}, {"id": "create_architecture_document", "content": "Create comprehensive system architecture document with all technical specifications", "status": "completed", "priority": "high"}, {"id": "high_level_architecture", "content": "Design high-level system architecture and component interactions", "status": "completed", "priority": "high"}, {"id": "detailed_components", "content": "Specify detailed component architecture with specific technologies", "status": "completed", "priority": "high"}, {"id": "data_flow_design", "content": "Create data flow diagrams and processing pipelines", "status": "completed", "priority": "medium"}, {"id": "api_specifications", "content": "Define API specifications and integration patterns", "status": "completed", "priority": "medium"}, {"id": "deployment_architecture", "content": "Design deployment architecture and infrastructure requirements", "status": "completed", "priority": "medium"}, {"id": "security_framework", "content": "Define security architecture and compliance framework", "status": "completed", "priority": "medium"}, {"id": "monitoring_strategy", "content": "Design monitoring and observability strategy", "status": "completed", "priority": "low"}, {"id": "performance_considerations", "content": "Document performance and scalability considerations", "status": "completed", "priority": "low"}]