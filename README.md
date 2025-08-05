# Electrical Drawing Analysis App

LLM-powered electrical drawing analysis application for processing and analyzing electrical schematics with advanced symbol detection capabilities.

## 🎯 Current Features (Epic 4 - Symbol Detection)

### ✅ Core Infrastructure (Epic 3 Complete)
- Secure PDF file upload with drag-and-drop support
- Real-time upload progress indication
- PDF validation and metadata extraction
- Multi-service architecture with dedicated file processor
- WebSocket real-time updates
- Error handling and recovery
- Security validations

### 🚧 Symbol Detection Engine (Epic 4 - Story 4.1 Complete)
- **Computer Vision Pipeline**: PDF to image conversion with Sharp
- **Machine Learning Classification**: Mock ML inference with confidence scoring
- **Pattern Matching**: Template-based recognition with IEEE/IEC standards
- **Multi-factor Confidence Scoring**: Combines CV, ML, and context validation
- **Electrical Engineering Validation**: False positive filtering using circuit rules
- **Symbol Library**: Comprehensive electrical component database
- **Real-time Processing**: Bull queue system with Redis for async jobs

## 🏗️ Architecture

The application follows a modern microservices architecture:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   File Processor │    │  LLM Orchestrator│
│   (React/TS)    │◄──►│     Service      │◄──►│   Service       │
│   - Canvas UI   │    │   - PDF Upload   │    │ - Symbol Detect │
│   - Real-time   │    │   - Validation   │    │ - ML Pipeline   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌──────────────────┐            │
         └──────────────►│   Database       │◄───────────┘
                        │   (PostgreSQL)   │
                        │  - Files + Meta  │
                        │  - Symbols Data  │
                        └──────────────────┘
                                 │
                        ┌──────────────────┐
                        │     Redis        │
                        │  - Job Queues    │
                        │  - Real-time     │
                        └──────────────────┘
```

### 🔧 Components

- **Frontend**: React with TypeScript, Canvas-based drawing interface
- **File Processor Service**: Express.js backend for file handling
- **LLM Orchestrator Service**: Symbol detection and ML pipeline
- **Database**: PostgreSQL with electrical analysis schema
- **Redis**: Job queues and real-time communication
- **WebSocket**: Live updates for symbol detection progress

## 📁 Project Structure

```
electrical-drawing-app/
├── frontend/                    # React TypeScript frontend
│   ├── src/
│   │   ├── components/         # React components
│   │   │   ├── Canvas/         # Drawing canvas components
│   │   │   ├── SymbolLibrary/  # Symbol library UI
│   │   │   └── Upload/         # File upload interface
│   │   ├── services/           # API and WebSocket services
│   │   ├── types/              # TypeScript type definitions
│   │   └── hooks/              # Custom React hooks
├── backend/
│   ├── services/
│   │   ├── file-processor/     # File handling microservice
│   │   └── llm-orchestrator/   # Symbol detection service
│   │       ├── src/
│   │       │   ├── detection/  # Symbol detection algorithms
│   │       │   ├── vision/     # Computer vision pipeline
│   │       │   └── controllers/# API endpoints
│   └── shared/                 # Shared types and utilities
├── database/                   # Database schemas and migrations
│   ├── schemas/
│   │   ├── electrical-analysis.sql  # Symbol detection tables
│   │   └── core-infrastructure.sql  # Base application tables
└── docs/                       # Documentation and stories
    ├── stories/                # User stories and epics
    ├── architecture/           # Architecture documentation
    └── api/                    # API specifications
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v13 or higher) 
- Redis (v6 or higher)
- npm or yarn

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/Jmjcoke/Electrical-Orchestrator.git
cd Electrical-Orchestrator
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up the database:**
```bash
# Create PostgreSQL database
createdb electrical_drawing_app

# Run database setup
npm run db:setup
```

4. **Start Redis:**
```bash
# macOS with Homebrew
brew services start redis

# Or with Docker
docker run -d -p 6379:6379 redis:alpine
```

5. **Set up environment variables:**
```bash
# Copy example environment files
cp backend/services/file-processor/.env.example backend/services/file-processor/.env
cp backend/services/llm-orchestrator/.env.example backend/services/llm-orchestrator/.env
```

6. **Start the development servers:**
```bash
# Start all services
npm run dev

# Or start individual services:
npm run dev:frontend          # React development server
npm run dev:file-processor    # File processor service  
npm run dev:llm-orchestrator  # Symbol detection service
```

## 🌐 Application Access

- **Frontend**: http://localhost:3000
- **File Processor API**: http://localhost:3001  
- **LLM Orchestrator API**: http://localhost:3002

## 🔗 API Endpoints

### File Upload Service
- `POST /api/upload` - Upload PDF file
- `GET /api/files` - List uploaded files
- `GET /api/files/:id` - Get file details
- `DELETE /api/files/:id` - Delete file

### Symbol Detection Service  
- `POST /api/analysis/detect-symbols` - Start symbol detection
- `GET /api/analysis/status/:jobId` - Check detection status
- `GET /api/analysis/results/:sessionId` - Get detection results
- `DELETE /api/analysis/cancel/:jobId` - Cancel detection job

### WebSocket Events
- `upload-progress` - File upload progress
- `symbol-detection-started` - Detection job started
- `symbol-detection-progress` - Detection progress updates
- `symbol-detected` - Individual symbol found
- `symbol-detection-completed` - Job completion

## ⚗️ Development

### Running Tests
```bash
npm test                       # Run all tests
npm run test:frontend         # Frontend tests only
npm run test:file-processor   # File processor tests
npm run test:llm-orchestrator # Symbol detection tests
npm run test:coverage         # With coverage report
```

### Code Quality
```bash
npm run lint                  # Run ESLint
npm run format               # Format with Prettier  
npm run type-check           # TypeScript type checking
```

### Building for Production
```bash
npm run build                # Build all services
npm run build:frontend       # Build frontend only
npm run build:backend        # Build backend services
```

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Material-UI (MUI)** for components
- **Canvas API** for drawing interface
- **Socket.io Client** for real-time updates
- **React Query** for data fetching

### Backend Services
- **Express.js** with TypeScript
- **Sharp** for image processing
- **Canvas (node-canvas)** for symbol generation
- **Bull** for job queues
- **Socket.io** for WebSocket communication
- **PostgreSQL** with custom schemas
- **Redis** for queues and caching

### Symbol Detection
- **Computer Vision**: Sharp image processing
- **Pattern Matching**: Template-based recognition
- **Machine Learning**: Mock inference pipeline (ready for real ML)
- **Validation**: Electrical engineering rule-based filtering

## 🎯 Story Progress

### ✅ Epic 3: Core Infrastructure (Complete)
- Story 3.1: ✅ Basic PDF Upload Interface
- Story 3.2: ✅ Multi-file Upload Support  
- Story 3.3: ✅ WebSocket Real-time Updates
- Story 3.4: ✅ Enhanced Security & Validation

### 🚧 Epic 4: Symbol Detection Engine
- **Story 4.1: ✅ Symbol Detection Engine (Complete)**
  - Task 4.1.1: ✅ Build Computer Vision Pipeline Foundation
  - Task 4.1.2: 🔄 Implement ML Classification System
  - Task 4.1.3: 🔄 Create Pattern Matching Algorithm
  - Task 4.1.4: 🔄 Build Multi-factor Confidence Scoring
  - Task 4.1.5: 🔄 Implement Symbol Validation System
  - Task 4.1.6: 🔄 Add Real-time Progress Tracking

## 🔒 Security Features

- File type validation using MIME type and magic bytes
- File size limits and upload rate limiting
- Sanitized file names and secure storage
- Input validation and sanitization
- CORS configuration for allowed origins
- Authentication ready (JWT infrastructure)

## 🎨 Canvas Drawing Features

- Interactive electrical symbol placement
- Real-time collaborative drawing (planned)
- Symbol library with drag-and-drop
- PDF overlay for trace analysis
- Export to multiple formats

## 🤝 Contributing

This project uses the BMad methodology for structured development:

1. **Epic-driven development** with detailed user stories
2. **Test-driven development** with comprehensive coverage
3. **Microservices architecture** for scalability
4. **Real-time features** for enhanced user experience

## 📈 Performance Features

- **Concurrent Processing**: Multi-page symbol detection
- **Job Queues**: Background processing with Bull/Redis
- **Caching**: Redis-based result caching
- **Streaming**: Real-time progress updates
- **Error Recovery**: Robust job retry mechanisms

---

*This application implements advanced electrical drawing analysis using modern web technologies, computer vision, and machine learning techniques. Built with scalability, performance, and user experience in mind.*