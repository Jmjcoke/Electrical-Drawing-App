# 12. Appendices

## 12.1 Appendix A: Technical Specifications

### 12.1.1 API Integration Specifications

**OpenAI GPT-4V Integration**
```json
{
  "endpoint": "https://api.openai.com/v1/chat/completions",
  "model": "gpt-4-vision-preview",
  "max_tokens": 4096,
  "temperature": 0.1,
  "headers": {
    "Authorization": "Bearer {API_KEY}",
    "Content-Type": "application/json"
  },
  "payload_structure": {
    "model": "gpt-4-vision-preview",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "{prompt}"
          },
          {
            "type": "image_url",
            "image_url": {
              "url": "data:image/jpeg;base64,{base64_image}"
            }
          }
        ]
      }
    ]
  }
}
```

**Anthropic Claude 3.5 Sonnet Integration**
```json
{
  "endpoint": "https://api.anthropic.com/v1/messages",
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 4096,
  "headers": {
    "x-api-key": "{API_KEY}",
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01"
  },
  "payload_structure": {
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 4096,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "{prompt}"
          },
          {
            "type": "image",
            "source": {
              "type": "base64",
              "media_type": "image/jpeg",
              "data": "{base64_image}"
            }
          }
        ]
      }
    ]
  }
}
```

**Google Gemini Pro Integration**
```json
{
  "endpoint": "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent",
  "headers": {
    "Content-Type": "application/json",
    "x-goog-api-key": "{API_KEY}"
  },
  "payload_structure": {
    "contents": [
      {
        "parts": [
          {
            "text": "{prompt}"
          },
          {
            "inline_data": {
              "mime_type": "image/jpeg",
              "data": "{base64_image}"
            }
          }
        ]
      }
    ]
  }
}
```

### 12.1.2 Database Schema

**Sessions Table**
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  user_agent TEXT,
  ip_address INET,
  status VARCHAR(20) DEFAULT 'active'
);
```

**Documents Table**
```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  upload_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processing_status VARCHAR(20) DEFAULT 'uploaded',
  file_path TEXT NOT NULL
);
```

**Queries Table**
```sql
CREATE TABLE queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  query_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  response_time_ms INTEGER,
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5)
);
```

**Model Responses Table**
```sql
CREATE TABLE model_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID REFERENCES queries(id) ON DELETE CASCADE,
  model_name VARCHAR(50) NOT NULL,
  response_text TEXT NOT NULL,
  confidence_score DECIMAL(3,2),
  api_response_time_ms INTEGER,
  api_cost_usd DECIMAL(8,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 12.1.3 Prompt Engineering Templates

**Component Identification Prompt**
```
You are an expert electrical engineer analyzing electrical drawings. Please examine this electrical drawing and provide a comprehensive analysis of all electrical components and symbols visible.

For each component or symbol, provide:
1. Component type and standard designation
2. Location description within the drawing
3. Function or purpose in the electrical system
4. Any specifications or ratings visible
5. Connections to other components

Focus on accuracy and be specific about locations using coordinates or descriptive references. If you're uncertain about any identification, indicate your confidence level.

Drawing analysis should follow electrical industry standards and common practices.
```

**Q&A System Prompt**
```
You are an expert electrical engineer assistant helping users understand electrical drawings. The user has uploaded an electrical drawing and wants to ask questions about it.

Provide clear, accurate, and helpful responses about:
- Component identification and specifications
- Circuit functionality and operation
- Safety considerations and code compliance
- Installation and maintenance guidance
- Troubleshooting assistance

Always:
- Reference specific locations in the drawing when relevant
- Indicate confidence levels for complex interpretations
- Suggest when professional verification is recommended
- Use industry-standard terminology
- Prioritize safety in all recommendations

Current user question: {user_query}
```

**Schematic Recreation Prompt**
```
Analyze this electrical drawing and create a simplified schematic representation of the main electrical circuits. Focus on:

1. Main power distribution paths
2. Control circuits and their components
3. Load connections and specifications
4. Safety devices and protection systems

Provide the schematic as a structured description that can be converted to a visual format, including:
- Component positions and types
- Wire connections and routing
- Component labels and ratings
- Circuit flow and logic

Keep the representation clear and simplified while maintaining technical accuracy.
```

## 12.2 Appendix B: User Research Framework

### 12.2.1 User Interview Guide

**Pre-Interview Setup (5 minutes)**
- Introduction and background
- Consent for recording and feedback use
- Overview of testing session structure
- Questions about participant's electrical experience

**Current Workflow Assessment (15 minutes)**
1. "Walk me through how you currently analyze electrical drawings for a new project."
2. "What tools do you use for electrical drawing analysis?"
3. "What are the biggest challenges you face with drawing interpretation?"
4. "How much time do you typically spend on drawing analysis per project?"
5. "What types of errors or issues do you encounter most frequently?"

**Product Demonstration (20 minutes)**
- Upload sample electrical drawing
- Demonstrate Q&A functionality
- Show component identification features
- Display schematic recreation
- Highlight model comparison dashboard

**User Interaction Testing (30 minutes)**
- User uploads their own drawing (if available)
- User asks natural questions about the drawing
- User explores different features independently
- Facilitator observes interaction patterns and difficulties

**Feedback Collection (15 minutes)**
1. "What was your first impression of the tool?"
2. "Which features did you find most valuable? Why?"
3. "What concerns do you have about using AI for electrical analysis?"
4. "How does this compare to your current analysis process?"
5. "What would make you trust the AI analysis results?"
6. "What features are missing that you would need?"
7. "Would you pay for this tool? What would be a fair price?"

**Post-Interview Analysis Template**
```