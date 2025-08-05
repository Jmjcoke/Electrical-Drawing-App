# Data Models

## Frontend TypeScript Interfaces

### Application State Management
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

// UI State
interface UIState {
  theme: 'light' | 'dark'
  sidebarOpen: boolean
  currentView: 'upload' | 'analysis' | 'results'
  notifications: Notification[]
}
```

### Core Data Types
```typescript
interface UploadedFile {
  id: string
  filename: string
  size: number
  type: string
  uploadTimestamp: Date
  processingStatus: 'uploading' | 'processing' | 'ready' | 'error'
  pages: number
  thumbnails: string[]
}

interface Query {
  id: string
  text: string
  type: 'component_identification' | 'general_question' | 'schematic_analysis'
  timestamp: Date
  documentIds: string[]
  responses: ModelResponse[]
  aggregatedResult?: AnalysisResult
}

interface ModelResponse {
  id: string
  modelName: string
  modelVersion: string
  responseText: string
  responseStructured?: any
  confidenceScore: number
  responseTime: number
  cost?: number
  tokensUsed?: number
}

interface AnalysisResult {
  summary: string
  components: ComponentIdentification[]
  confidence: ConfidenceScore
  consensus: ModelConsensus
}

interface ComponentIdentification {
  id: string
  type: string
  description: string
  location: {
    x: number
    y: number
    page: number
  }
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
  confidence: number
  properties: Record<string, any>
}
```

## Database Schema (PostgreSQL)

### Core Tables

#### Sessions Table
```sql
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
```

#### Documents Table
```sql
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
```

#### Queries Table
```sql
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
```

#### Model Responses Table
```sql
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
```

#### Component Identifications Table
```sql
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
```

## Data Relationships

### Entity Relationships
- Sessions (1) → Documents (many)
- Sessions (1) → Queries (many)
- Queries (1) → ModelResponses (many)
- Queries (1) → ComponentIdentifications (many)
- ModelResponses (1) → ComponentIdentifications (many)

### Data Flow
1. **Session Creation**: New session established with unique ID
2. **Document Upload**: Files associated with session
3. **Query Processing**: User questions linked to session and documents
4. **Model Responses**: Multiple LLM responses per query
5. **Component Identification**: Structured data extraction from responses
6. **Analysis Results**: Aggregated and consensus-based results

## Validation Rules

### Data Constraints
- File sizes limited to 50MB per document
- Sessions expire after 24 hours of inactivity
- Confidence scores range from 0.0 to 1.0
- Component locations use normalized coordinates (0.0-1.0)
- Query types restricted to predefined categories

### Integrity Constraints
- Cascade deletion for session-related data
- Foreign key constraints maintained
- JSON schema validation for structured data
- Checksum validation for file integrity