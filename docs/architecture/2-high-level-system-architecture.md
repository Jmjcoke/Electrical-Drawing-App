# 2. High-Level System Architecture

## 2.1 System Overview Diagram

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

## 2.2 Core Architectural Components

### 2.2.1 Frontend Layer
- **React Application**: Modern SPA with TypeScript for type safety
- **PDF Processing**: Client-side PDF rendering and preview with PDF.js
- **Real-time Communication**: WebSocket connections for streaming responses
- **Responsive Design**: Material-UI components optimized for desktop/tablet

### 2.2.2 API Gateway Layer
- **NGINX/AWS ALB**: Load balancing and SSL termination
- **Rate Limiting**: Redis-based rate limiting per IP/session
- **Request Routing**: Intelligent routing to appropriate microservices
- **API Security**: Authentication, CORS, and input validation

### 2.2.3 Microservices Layer
- **File Processing Service**: PDF parsing, image optimization, and validation
- **LLM Orchestrator Service**: Multi-model coordination and consensus building
- **Response Aggregator Service**: Result compilation and ranking
- **Session Manager Service**: Session state and temporary data management
- **Analytics Service**: Usage tracking and performance monitoring
- **Schematic Generator Service**: SVG-based schematic recreation

### 2.2.4 Data Layer
- **PostgreSQL**: Persistent metadata, analytics, and system configuration
- **Redis**: Session management, caching, and real-time data
- **Object Storage**: Temporary file storage with automatic cleanup

## 2.3 Service Communication Patterns

### 2.3.1 Synchronous Communication
- **REST APIs**: Standard HTTP/HTTPS for client-server communication
- **GraphQL**: Considered for future complex query requirements
- **Service-to-Service**: Direct HTTP calls for simple request/response

### 2.3.2 Asynchronous Communication
- **Message Queues**: RabbitMQ/AWS SQS for LLM processing workflows
- **Event Streaming**: Apache Kafka/AWS Kinesis for analytics
- **WebSockets**: Real-time updates for processing status

---
