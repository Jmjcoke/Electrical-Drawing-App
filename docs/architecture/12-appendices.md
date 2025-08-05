# 12. Appendices

## 12.1 Appendix A: Database Schema Reference

### 12.1.1 Complete Database Schema
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

## 12.2 Appendix B: API Documentation

### 12.2.1 Complete OpenAPI Specification
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

## 12.3 Appendix C: Configuration Templates

### 12.3.1 Environment Configuration
```yaml