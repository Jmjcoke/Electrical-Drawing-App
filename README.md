# Electrical Drawing Analysis App

LLM-powered electrical drawing analysis application for processing and analyzing electrical schematics.

## Features (Story 1.1 - Basic PDF Upload)

- ✅ Secure PDF file upload with drag-and-drop support
- ✅ Real-time upload progress indication
- ✅ Comprehensive file validation (type, size, structure)
- ✅ Temporary file storage with automatic cleanup
- ✅ Responsive Material-UI interface
- ✅ Error handling for all failure scenarios

## Quick Start

### Prerequisites

- Node.js 18+ LTS
- npm 9+

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd electrical-drawing-app
```

2. Install all dependencies:
```bash
npm run install:all
```

3. Set up environment variables:
```bash
# Frontend
cp frontend/.env.example frontend/.env

# Backend
cp backend/services/file-processor/.env.example backend/services/file-processor/.env
```

### Development

Start both frontend and backend in development mode:
```bash
npm run dev
```

This will start:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### Testing

Run all tests:
```bash
npm test
```

Run tests for specific components:
```bash
npm run test:frontend
npm run test:backend
```

### Building

Build for production:
```bash
npm run build
```

## Project Structure

```
electrical-drawing-app/
├── frontend/                   # React TypeScript application
│   ├── src/
│   │   ├── components/upload/  # Upload components
│   │   ├── services/          # API services
│   │   └── types/             # TypeScript definitions
├── backend/
│   └── services/
│       └── file-processor/    # File upload microservice
└── docs/                      # Documentation and stories
```

## API Endpoints

### POST /api/v1/upload
Upload a PDF file for analysis.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: file (PDF, max 10MB)

**Response:**
```json
{
  "success": true,
  "fileId": "uuid",
  "originalName": "drawing.pdf",
  "size": 1048576,
  "mimeType": "application/pdf",
  "uploadedAt": "2025-08-02T10:00:00.000Z"
}
```

### GET /api/v1/upload/:fileId
Get upload status and file information.

## Development Guidelines

- Follow TypeScript strict mode
- Use Material-UI components for consistency
- Write tests for all new functionality
- Follow the established project structure
- Use conventional commit messages

## Security Features

- Server-side file validation
- MIME type verification
- File size limits (10MB)
- CORS protection
- Helmet security headers
- Temporary file cleanup

## Next Steps

This implements Story 1.1 (Basic PDF Upload Interface). Future stories will add:
- Multi-file upload support
- LLM integration for analysis
- Component identification
- Interactive Q&A system
- Model comparison dashboard